import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

import { Header } from './Header.jsx';
import { MessageList } from './MessageList.jsx';
import { InputBar } from './InputBar.jsx';
import { CommitAction, CommitSelect, BranchAction } from './CommitAction.jsx';
import { Onboarding } from './Onboarding.jsx';
import { useGitStatus } from './hooks/useGitStatus.js';
import tuiCommit from '../tui-commands/tui-commit.js';
import tuiReview from '../tui-commands/tui-review.js';
import tuiBranch from '../tui-commands/tui-branch.js';
import tuiFix from '../tui-commands/tui-fix.js';
import tuiLog from '../tui-commands/tui-log.js';
import tuiExplain from '../tui-commands/tui-explain.js';
import tuiMergeMsg from '../tui-commands/tui-merge-msg.js';
import commandRouter from './commandRouter.js';
import configManager from '../config.js';
import historyUtil from '../utils/history.js';

const { parseCommand, HELP_TEXT } = commandRouter;

let msgCounter = 0;
function newId() { return ++msgCounter; }

/**
 * 检查当前 provider 是否配置了 API Key
 */
function needsOnboarding() {
  try {
    const config = configManager.load();
    const prov = config.provider;
    return !config.providers[prov]?.apiKey;
  } catch {
    return true;
  }
}

/**
 * 主应用组件
 * phase: 'IDLE' | 'LOADING' | 'STREAMING' | 'ACTION_COMMIT' | 'ACTION_COMMIT_SELECT' | 'ACTION_BRANCH'
 */
export function App({ cwd }) {
  const { exit } = useApp();
  const { branch, staged, unstaged, isRepo } = useGitStatus(cwd);

  const [showOnboarding, setShowOnboarding] = useState(() => needsOnboarding());
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: newId(), role: 'system', content: '欢迎使用 gat TUI！输入 /help 查看可用命令。' },
  ]);
  const [phase, setPhase] = useState('IDLE');

  // commit action 状态
  const [commitMessages, setCommitMessages] = useState([]);
  const [pendingCommitOpts, setPendingCommitOpts] = useState(null);

  // branch action 状态
  const [pendingBranch, setPendingBranch] = useState(null);

  // 当前流式消息 ID
  const streamingIdRef = useRef(null);

  // AbortController 用于取消流式请求（P1-11）
  const abortControllerRef = useRef(null);

  // 上次失败的命令，用于重试（P1-6）
  const lastFailedCmdRef = useRef(null);

  // Ctrl+C 拦截：STREAMING 时取消流，IDLE 时退出
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (phase === 'STREAMING' || phase === 'LOADING') {
        abortControllerRef.current?.abort();
        if (streamingIdRef.current) {
          updateStreamingMessage(streamingIdRef.current, '（已取消）', true);
          streamingIdRef.current = null;
        }
        setPhase('IDLE');
      } else {
        exit();
      }
    }
    // 重试快捷键（P1-6）
    if (input === 'r' && phase === 'IDLE' && lastFailedCmdRef.current) {
      const cmd = lastFailedCmdRef.current;
      lastFailedCmdRef.current = null;
      dispatchCommand(cmd);
    }
  });

  // 追加消息
  const addMessage = useCallback((role, content, extra = {}) => {
    const id = newId();
    setMessages((prev) => [...prev, { id, role, content, ...extra }]);
    return id;
  }, []);

  // 更新流式消息
  const updateStreamingMessage = useCallback((id, content, done = false) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content, streaming: !done } : m))
    );
  }, []);

  /** 通用流式命令包装器 */
  const runStream = useCallback(async (userLine, streamFn, streamArgs, onDoneExtra) => {
    setPhase('LOADING');
    addMessage('user', userLine);

    let streamText = '';
    const streamId = addMessage('assistant', '', { streaming: true });
    streamingIdRef.current = streamId;

    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPhase('STREAMING');

    try {
      const result = await streamFn({
        ...streamArgs,
        signal: controller,
        onChunk: (delta) => {
          streamText += delta;
          updateStreamingMessage(streamId, streamText, false);
        },
        onDone: (full) => {
          updateStreamingMessage(streamId, full, true);
        },
      });
      streamingIdRef.current = null;
      if (onDoneExtra) onDoneExtra(result);
      else setPhase('IDLE');
    } catch (err) {
      if (streamingIdRef.current) {
        updateStreamingMessage(streamingIdRef.current, streamText || '（已取消）', true);
        streamingIdRef.current = null;
      }
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED' && err.message !== '已取消') {
        lastFailedCmdRef.current = null; // will be set by caller
        addMessage('error', `${err.message}\n[按 r 重试]`);
      }
      setPhase('IDLE');
      throw err;
    }
  }, [addMessage, updateStreamingMessage]);

  // 处理 /commit 流程
  const handleCommit = useCallback(async (opts) => {
    setPhase('LOADING');
    addMessage('user', `/commit${opts.autoStage ? ' -a' : ''}${opts.count > 1 ? ` -n ${opts.count}` : ''}${opts.pushAfter ? ' -p' : ''}`);

    try {
      if (opts.count > 1) {
        const streamId = addMessage('assistant', `正在生成 ${opts.count} 条备选...`, { streaming: true });
        const prepResult = await tuiCommit.prepareCommit(cwd, { autoStage: opts.autoStage, count: opts.count });
        updateStreamingMessage(streamId, `已生成 ${opts.count} 条备选`, true);
        if (prepResult.type === 'messages_ready') {
          setCommitMessages(prepResult.messages);
          setPendingCommitOpts(opts);
          setPhase('ACTION_COMMIT_SELECT');
        } else if (prepResult.type === 'needs_stage') {
          addMessage('error', `有 ${prepResult.unstaged} 个文件未 staged，请使用 /commit -a 自动 stage`);
          setPhase('IDLE');
        } else {
          addMessage('error', prepResult.message || '没有变更可提交');
          setPhase('IDLE');
        }
        return;
      }

      // 单条：流式生成
      let streamText = '';
      const streamId = addMessage('assistant', '', { streaming: true });
      streamingIdRef.current = streamId;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setPhase('STREAMING');

      const result = await tuiCommit.streamCommitMessage(cwd, {
        autoStage: opts.autoStage,
        signal: controller,
        onChunk: (delta) => {
          streamText += delta;
          updateStreamingMessage(streamId, streamText, false);
        },
        onDone: (full) => {
          updateStreamingMessage(streamId, full, true);
        },
      });

      streamingIdRef.current = null;
      const finalMessage = result.fullText.trim();
      setCommitMessages([finalMessage]);
      setPendingCommitOpts(opts);
      setPhase('ACTION_COMMIT');
    } catch (err) {
      if (streamingIdRef.current) {
        updateStreamingMessage(streamingIdRef.current, '', true);
        streamingIdRef.current = null;
      }
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        lastFailedCmdRef.current = { type: 'commit', ...opts };
        addMessage('error', `${err.message}\n[按 r 重试]`);
      }
      setPhase('IDLE');
    }
  }, [cwd, addMessage, updateStreamingMessage]);

  // 处理 /review 流程
  const handleReview = useCallback(async (opts) => {
    lastFailedCmdRef.current = { type: 'review', ...opts };
    try {
      await runStream(
        `/review${opts.all ? ' -a' : ''}`,
        (streamOpts) => tuiReview.streamReview(cwd, { all: opts.all, ...streamOpts }),
        {},
        () => setPhase('IDLE')
      );
      lastFailedCmdRef.current = null;
    } catch {}
  }, [cwd, runStream]);

  // 处理 /branch 流程
  const handleBranch = useCallback(async (opts) => {
    if (!opts.description?.trim()) {
      addMessage('error', '请提供任务描述，例如：/branch 修复用户登录闪退');
      return;
    }
    setPhase('LOADING');
    addMessage('user', `/branch ${opts.description}`);
    try {
      const branchName = await tuiBranch.generateBranch(opts.description, cwd);
      setPendingBranch(branchName);
      setPhase('ACTION_BRANCH');
    } catch (err) {
      lastFailedCmdRef.current = { type: 'branch', ...opts };
      addMessage('error', `${err.message}\n[按 r 重试]`);
      setPhase('IDLE');
    }
  }, [cwd, addMessage]);

  // 处理 /fix 流程（P0-1）
  const handleFix = useCallback(async () => {
    lastFailedCmdRef.current = { type: 'fix' };
    try {
      await runStream(
        '/fix',
        (streamOpts) => tuiFix.streamFix(cwd, streamOpts),
        {},
        () => setPhase('IDLE')
      );
      lastFailedCmdRef.current = null;
    } catch {}
  }, [cwd, runStream]);

  // 处理 /log 流程（P0-1）
  const handleLog = useCallback(async (opts) => {
    const flagStr = [
      opts.from ? `--from ${opts.from}` : '',
      opts.to && opts.to !== 'HEAD' ? `--to ${opts.to}` : '',
      opts.version && opts.version !== 'Unreleased' ? `--version ${opts.version}` : '',
      opts.output ? `-o ${opts.output}` : '',
    ].filter(Boolean).join(' ');
    lastFailedCmdRef.current = { type: 'log', ...opts };
    try {
      await runStream(
        `/log${flagStr ? ' ' + flagStr : ''}`,
        (streamOpts) => tuiLog.streamLog(cwd, { ...opts, ...streamOpts }),
        {},
        (result) => {
          if (result?.savedToFile && opts.output) {
            addMessage('system', `✓ Changelog 已写入 ${opts.output}`);
          }
          setPhase('IDLE');
        }
      );
      lastFailedCmdRef.current = null;
    } catch {}
  }, [cwd, runStream, addMessage]);

  // 处理 /explain 流程（P0-1）
  const handleExplain = useCallback(async (opts) => {
    lastFailedCmdRef.current = { type: 'explain', ...opts };
    try {
      await runStream(
        `/explain${opts.range ? ' ' + opts.range : ''}`,
        (streamOpts) => tuiExplain.streamExplain(cwd, { range: opts.range, ...streamOpts }),
        {},
        () => setPhase('IDLE')
      );
      lastFailedCmdRef.current = null;
    } catch {}
  }, [cwd, runStream]);

  // 处理 /merge-msg 流程（P0-1）
  const handleMergeMsg = useCallback(async (opts) => {
    lastFailedCmdRef.current = { type: 'merge-msg', ...opts };
    try {
      await runStream(
        `/merge-msg${opts.base ? ' -b ' + opts.base : ''}`,
        (streamOpts) => tuiMergeMsg.streamMergeMsg(cwd, { base: opts.base, ...streamOpts }),
        {},
        () => setPhase('IDLE')
      );
      lastFailedCmdRef.current = null;
    } catch {}
  }, [cwd, runStream]);

  // 处理 /config（P0-3）
  const handleConfig = useCallback((opts) => {
    if (opts.action === 'set') {
      if (!opts.key) {
        addMessage('error', '用法：/config set <key> <value>\n例如：/config set providers.deepseek.apiKey sk-xxx');
        return;
      }
      addMessage('user', `/config set ${opts.key} ${opts.value}`);
      try {
        configManager.set(opts.key, opts.value);
        addMessage('system', `✓ 已设置 ${opts.key} = ${opts.value}`);
      } catch (err) {
        addMessage('error', `设置失败: ${err.message}`);
      }
      return;
    }

    addMessage('user', '/config');
    const config = configManager.load();
    const prov = config.provider;
    const pc = config.providers[prov] || {};
    const lines = [
      `当前配置：`,
      `  provider:    ${prov}`,
      `  model:       ${pc.model || '(未设置)'}`,
      `  base-url:    ${pc.baseUrl || '(未设置)'}`,
      `  api-key:     ${pc.apiKey ? pc.apiKey.slice(0, 6) + '...' : '(未配置)'}`,
      `  language:    ${config.commit?.language || 'zh'}`,
      `  style:       ${config.commit?.style || 'conventional'}`,
      `  auto-push:   ${config.commit?.autoPush ? 'true' : 'false'}`,
      `  temperature: ${config.ai?.temperature ?? 0.3}`,
      ``,
      `修改：/config set <key> <value>`,
    ];
    addMessage('assistant', lines.join('\n'));
  }, [addMessage]);

  // 处理 /history（P2-15）
  const handleHistory = useCallback((opts) => {
    addMessage('user', `/history${opts.n !== 10 ? ' -n ' + opts.n : ''}`);
    const entries = historyUtil.recent(opts.n);
    if (entries.length === 0) {
      addMessage('assistant', '暂无生成历史。使用 /commit 生成并提交后，历史会保存在此。');
      return;
    }
    const lines = ['最近生成的 commit messages：', ''];
    entries.forEach((e, i) => {
      const date = new Date(e.ts).toLocaleString('zh-CN', { hour12: false });
      lines.push(`${i + 1}. [${date}]`);
      lines.push(`   ${e.message}`);
      lines.push('');
    });
    addMessage('assistant', lines.join('\n'));
  }, [addMessage]);

  // 分派命令（供重试用）
  const dispatchCommand = useCallback((cmd) => {
    switch (cmd.type) {
      case 'commit':   handleCommit(cmd); break;
      case 'review':   handleReview(cmd); break;
      case 'branch':   handleBranch(cmd); break;
      case 'fix':      handleFix(); break;
      case 'log':      handleLog(cmd); break;
      case 'explain':  handleExplain(cmd); break;
      case 'merge-msg':handleMergeMsg(cmd); break;
    }
  }, [handleCommit, handleReview, handleBranch, handleFix, handleLog, handleExplain, handleMergeMsg]);

  // 提交 commit message
  const handleUseCommit = useCallback(async (message) => {
    setPhase('LOADING');
    addMessage('system', `正在提交: ${message}`);
    try {
      const { branch: br } = await tuiCommit.doCommit(message, cwd);
      addMessage('system', `✓ 提交成功 [${br}]: ${message}`);

      if (pendingCommitOpts?.pushAfter) {
        addMessage('system', '正在推送...');
        await tuiCommit.doPush(cwd);
        addMessage('system', '✓ 推送成功');
      }
    } catch (err) {
      addMessage('error', `提交失败: ${err.message}`);
    }
    setPendingCommitOpts(null);
    setCommitMessages([]);
    setPhase('IDLE');
  }, [cwd, addMessage, pendingCommitOpts]);

  const handleCancelCommit = useCallback(() => {
    addMessage('system', '已取消');
    setCommitMessages([]);
    setPendingCommitOpts(null);
    setPhase('IDLE');
  }, [addMessage]);

  const handleRegenerateCommit = useCallback(() => {
    if (!pendingCommitOpts) return;
    setCommitMessages([]);
    handleCommit(pendingCommitOpts);
  }, [pendingCommitOpts, handleCommit]);

  const handleEditCommit = useCallback((message) => {
    setInput(message);
    setCommitMessages([]);
    setPendingCommitOpts(null);
    setPhase('IDLE');
  }, []);

  const handleCreateBranch = useCallback(async (branchName) => {
    setPhase('LOADING');
    try {
      await tuiBranch.createAndCheckout(branchName, cwd);
      addMessage('system', `✓ 已创建并切换到分支: ${branchName}`);
    } catch (err) {
      addMessage('error', `创建分支失败: ${err.message}`);
    }
    setPendingBranch(null);
    setPhase('IDLE');
  }, [cwd, addMessage]);

  const handleCancelBranch = useCallback(() => {
    addMessage('system', '已取消');
    setPendingBranch(null);
    setPhase('IDLE');
  }, [addMessage]);

  // 处理输入提交
  const handleSubmit = useCallback((value) => {
    const trimmed = value.trim();
    setInput('');
    if (!trimmed) return;

    const cmd = parseCommand(trimmed);

    switch (cmd.type) {
      case 'quit':
        exit();
        break;
      case 'help':
        addMessage('user', '/help');
        addMessage('assistant', HELP_TEXT);
        break;
      case 'commit':
        handleCommit(cmd);
        break;
      case 'review':
        handleReview(cmd);
        break;
      case 'branch':
        handleBranch(cmd);
        break;
      case 'fix':
        handleFix();
        break;
      case 'log':
        handleLog(cmd);
        break;
      case 'explain':
        handleExplain(cmd);
        break;
      case 'merge-msg':
        handleMergeMsg(cmd);
        break;
      case 'config':
        handleConfig(cmd);
        break;
      case 'history':
        handleHistory(cmd);
        break;
      case 'unknown':
        addMessage('error', `未知命令: ${trimmed}，输入 /help 查看可用命令`);
        break;
      default:
        addMessage('error', `命令 /${cmd.type} 暂未实现`);
    }
  }, [exit, addMessage, handleCommit, handleReview, handleBranch, handleFix, handleLog, handleExplain, handleMergeMsg, handleConfig, handleHistory]);

  const isIdle = phase === 'IDLE';

  // 首次使用引导（P0-4）
  if (showOnboarding) {
    return (
      <Onboarding onComplete={() => setShowOnboarding(false)} />
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header branch={branch} staged={staged} unstaged={unstaged} isRepo={isRepo} />
      <Box flexDirection="column" flexGrow={1}>
        <MessageList messages={messages} />
      </Box>

      {phase === 'ACTION_COMMIT' && commitMessages.length > 0 && (
        <CommitAction
          message={commitMessages[0]}
          onUse={handleUseCommit}
          onEdit={handleEditCommit}
          onRegenerate={handleRegenerateCommit}
          onCancel={handleCancelCommit}
        />
      )}

      {phase === 'ACTION_COMMIT_SELECT' && commitMessages.length > 0 && (
        <CommitSelect
          messages={commitMessages}
          onSelect={handleUseCommit}
          onCancel={handleCancelCommit}
        />
      )}

      {phase === 'ACTION_BRANCH' && pendingBranch && (
        <BranchAction
          branchName={pendingBranch}
          onCreate={handleCreateBranch}
          onCancel={handleCancelBranch}
        />
      )}

      {(isIdle || phase === 'LOADING') && (
        <InputBar
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={phase === 'LOADING'}
        />
      )}

      {phase === 'STREAMING' && (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>AI 生成中... (Ctrl+C 取消)</Text>
        </Box>
      )}
    </Box>
  );
}
