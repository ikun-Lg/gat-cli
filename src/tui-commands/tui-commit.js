'use strict';

const git = require('../git');
const ai = require('../ai');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');
const history = require('../utils/history');

/**
 * 按文件粒度智能截断 diff
 */
function smartTruncateDiff(diff, maxChars = 8000) {
  if (!diff || diff.length <= maxChars) return diff;
  const sections = diff.split(/(?=^diff --git )/m);
  const result = [];
  const skipped = [];
  let totalChars = 0;
  for (const section of sections) {
    if (!section.trim()) continue;
    if (totalChars + section.length <= maxChars) {
      result.push(section);
      totalChars += section.length;
    } else if (result.length === 0) {
      result.push(section.slice(0, maxChars) + '\n...(diff truncated)');
      break;
    } else {
      const m = section.match(/^diff --git a\/(.*?) b\//);
      if (m) skipped.push(m[1]);
    }
  }
  if (skipped.length > 0) {
    result.push(`\n# 以下 ${skipped.length} 个文件因 diff 过大已省略：\n` + skipped.map((f) => `# - ${f}`).join('\n'));
  }
  return result.join('');
}

/**
 * 准备 commit 所需的 diff 数据（非流式，用于多条备选）
 * @returns {{ type: 'messages_ready', messages, stat, diff } | { type: 'no_changes' } | { type: 'needs_stage', unstaged } | { type: 'error', message }}
 */
async function prepareCommit(cwd, options = {}) {
  const { autoStage = false, count = 1 } = options;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) {
    return { type: 'error', message: '当前目录不是 git 仓库' };
  }

  const config = configManager.load();
  const status = await git.getStatus(cwd);

  if (autoStage && status.files.length > 0) {
    await git.stageAll(cwd);
  }

  let { stat, content: diff } = await git.getStagedDiff(cwd);

  if (!diff || diff.trim() === '') {
    const freshStatus = await git.getStatus(cwd);
    if (freshStatus.files.length === 0) {
      return { type: 'no_changes' };
    }
    return { type: 'needs_stage', unstaged: freshStatus.files.length };
  }

  const trimmedDiff = smartTruncateDiff(diff);

  let messages;
  if (count > 1) {
    messages = await ai.generateCommitMessages(trimmedDiff, stat, config, count);
  } else {
    const msg = await ai.generateCommitMessage(trimmedDiff, stat, config);
    messages = [msg];
  }

  return { type: 'messages_ready', messages, stat, diff: trimmedDiff, config };
}

/**
 * 流式生成 commit message
 */
async function streamCommitMessage(cwd, opts = {}) {
  const { autoStage = false, onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config 进行配置`);
  }

  const status = await git.getStatus(cwd);
  if (autoStage && status.files.length > 0) {
    await git.stageAll(cwd);
  }

  let { stat, content: diff } = await git.getStagedDiff(cwd);
  if (!diff || diff.trim() === '') {
    throw new Error('没有 staged 的变更，请先 git add 或使用 /commit -a');
  }

  const trimmedDiff = smartTruncateDiff(diff);
  const { language, style } = config.commit;
  const temperature = config.ai?.temperature ?? 0.3;

  const systemPrompt = config.prompts?.commitSystem || prompts.commitSystem(language, style);
  const userPrompt = prompts.commitUser(stat, trimmedDiff);

  const fullText = await streamChat(providerConfig, systemPrompt, userPrompt, {
    onChunk,
    onDone,
    signal,
    maxTokens: config.ai?.maxTokens || 1000,
    temperature,
  });

  return { fullText, stat, diff: trimmedDiff, config };
}

/**
 * 执行 git commit，并记录 message 到历史
 */
async function doCommit(message, cwd) {
  const branch = await git.getCurrentBranch(cwd);
  await git.commit(message, cwd);
  history.save(message);
  return { branch };
}

/**
 * 执行 git push
 */
async function doPush(cwd) {
  await git.push(cwd);
}

module.exports = { prepareCommit, streamCommitMessage, doCommit, doPush };
