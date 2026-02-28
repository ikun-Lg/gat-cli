'use strict';

const git = require('../git');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');

/**
 * 流式审查代码
 * @param {string} cwd
 * @param {{ all?: boolean, onChunk?: Function, onDone?: Function, signal?: AbortController }} opts
 */
async function streamReview(cwd, opts = {}) {
  const { all = false, onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config 进行配置`);
  }

  let diff;
  if (all) {
    const status = await git.getStatus(cwd);
    if (status.files.length === 0) throw new Error('没有任何变更');
    const originallyStaged = status.staged;
    await git.stageAll(cwd);
    const result = await git.getStagedDiff(cwd);
    diff = result.content;
    // 还原 staged 状态
    const simpleGit = require('simple-git')(cwd);
    await simpleGit.raw(['restore', '--staged', '.']);
    if (originallyStaged.length > 0) {
      await simpleGit.add(originallyStaged);
    }
  } else {
    const result = await git.getStagedDiff(cwd);
    diff = result.content;
  }

  if (!diff || diff.trim() === '') {
    throw new Error('没有 staged 的变更可供审查，可使用 /review -a 审查所有变更');
  }

  const trimmedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n...(truncated)' : diff;
  const { language } = config.commit;

  await streamChat(providerConfig, prompts.reviewSystem(language), prompts.reviewUser(trimmedDiff), {
    onChunk,
    onDone,
    signal,
    maxTokens: 6000,
  });
}

module.exports = { streamReview };
