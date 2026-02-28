import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useApp } from 'ink';

import { Header } from './Header.jsx';
import { MessageList } from './MessageList.jsx';
import { InputBar } from './InputBar.jsx';
import { CommitAction, CommitSelect, BranchAction } from './CommitAction.jsx';
import { useGitStatus } from './hooks/useGitStatus.js';
import tuiCommit from '../tui-commands/tui-commit.js';
import tuiReview from '../tui-commands/tui-review.js';
import tuiBranch from '../tui-commands/tui-branch.js';
import commandRouter from './commandRouter.js';
import configManager from '../config.js';

const { parseCommand, HELP_TEXT } = commandRouter;

let msgCounter = 0;
function newId() { return ++msgCounter; }

/**
 * 主应用组件
 * phase: 'IDLE' | 'LOADING' | 'STREAMING' | 'ACTION_COMMIT' | 'ACTION_COMMIT_SELECT' | 'ACTION_BRANCH'
 */
export function App({ cwd }) {
  const { exit } = useApp();
  const { branch, staged, unstaged, isRepo } = useGitStatus(cwd);

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

  // 处理 /commit 流程
  const handleCommit = useCallback(async (opts) => {
    setPhase('LOADING');
    addMessage('user', `/commit${opts.autoStage ? ' -a' : ''}${opts.count > 1 ? ` -n ${opts.count}` : ''}`);

    try {
      if (opts.count > 1) {
        // 多条备选：用非流式 prepareCommit
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
      setPhase('STREAMING');

      const result = await tuiCommit.streamCommitMessage(cwd, {
        autoStage: opts.autoStage,
        onChunk: (delta) => {
          streamText += delta;
          updateStreamingMessage(streamId, streamText, false);
        },
        onDone: (full) => {
          updateStreamingMessage(streamId, full, true);
        },
      });

      const finalMessage = result.fullText.trim();
      setCommitMessages([finalMessage]);
      setPendingCommitOpts(opts);
      setPhase('ACTION_COMMIT');
    } catch (err) {
      if (streamingIdRef.current) {
        updateStreamingMessage(streamingIdRef.current, '', true);
      }
      addMessage('error', err.message);
      setPhase('IDLE');
    }
  }, [cwd, addMessage, updateStreamingMessage]);

  // 处理 /review 流程
  const handleReview = useCallback(async (opts) => {
    setPhase('LOADING');
    addMessage('user', `/review${opts.all ? ' -a' : ''}`);

    let streamText = '';
    const streamId = addMessage('assistant', '', { streaming: true });
    streamingIdRef.current = streamId;
    setPhase('STREAMING');

    try {
      await tuiReview.streamReview(cwd, {
        all: opts.all,
        onChunk: (delta) => {
          streamText += delta;
          updateStreamingMessage(streamId, streamText, false);
        },
        onDone: (full) => {
          updateStreamingMessage(streamId, full, true);
          setPhase('IDLE');
        },
      });
    } catch (err) {
      updateStreamingMessage(streamId, streamText || '', true);
      addMessage('error', err.message);
      setPhase('IDLE');
    }
  }, [cwd, addMessage, updateStreamingMessage]);

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
      addMessage('error', err.message);
      setPhase('IDLE');
    }
  }, [cwd, addMessage]);

  // 处理 /config
  const handleConfig = useCallback(() => {
    addMessage('user', '/config');
    const config = configManager.load();
    const prov = config.provider;
    const pc = config.providers[prov] || {};
    const lines = [
      `当前配置：`,
      `  provider:  ${prov}`,
      `  model:     ${pc.model || '(未设置)'}`,
      `  base-url:  ${pc.baseUrl || '(未设置)'}`,
      `  api-key:   ${pc.apiKey ? pc.apiKey.slice(0, 6) + '...' : '(未配置)'}`,
      `  language:  ${config.commit?.language || 'zh'}`,
      `  style:     ${config.commit?.style || 'conventional'}`,
      `  auto-push: ${config.commit?.autoPush ? 'true' : 'false'}`,
    ];
    addMessage('assistant', lines.join('\n'));
  }, [addMessage]);

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
      case 'config':
        handleConfig();
        break;
      case 'unknown':
        addMessage('error', `未知命令: ${trimmed}，输入 /help 查看可用命令`);
        break;
      default:
        addMessage('error', `命令 /${cmd.type} 暂未在 TUI 中实现，请使用 CLI 模式：gat ${cmd.type}`);
    }
  }, [exit, addMessage, handleCommit, handleReview, handleBranch, handleConfig]);

  const isIdle = phase === 'IDLE';

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
          <Text dimColor>AI 生成中... (Ctrl+C 中断)</Text>
        </Box>
      )}
    </Box>
  );
}
