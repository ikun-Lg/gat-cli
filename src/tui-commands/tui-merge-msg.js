'use strict';

const git = require('../git');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');

/**
 * 流式生成 PR / merge commit message 描述
 * @param {string} cwd
 * @param {{ base?: string, onChunk?: Function, onDone?: Function, signal?: AbortController }} opts
 * @returns {{ fullText: string, currentBranch: string, baseBranch: string }}
 */
async function streamMergeMsg(cwd, opts = {}) {
  const { base, onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config set 进行配置`);
  }

  const currentBranch = await git.getCurrentBranch(cwd);
  const baseBranch = base || (await git.getDefaultBranch(cwd));

  if (currentBranch === baseBranch) {
    throw new Error(`当前已在 ${baseBranch} 分支，请切换到 feature 分支后再运行`);
  }

  let commits, diff;
  try {
    commits = await git.getLogFromBase(baseBranch, cwd);
    const diffResult = await git.getDiffFromBase(baseBranch, cwd);
    diff = diffResult.content;
  } catch (err) {
    throw new Error(`无法获取与 ${baseBranch} 的差异，请确认基础分支名是否正确`);
  }

  if (commits.length === 0) {
    throw new Error(`相对于 ${baseBranch} 没有新的 commit`);
  }

  const logText = commits.map((c) => `[${c.hash.slice(0, 7)}] ${c.message}`).join('\n');
  const trimmedDiff =
    diff.length > 6000 ? diff.slice(0, 6000) + '\n...(truncated)' : diff;

  const { language } = config.commit;
  const temperature = config.ai?.temperature ?? 0.3;
  const systemPrompt = config.prompts?.mergeMsgSystem || prompts.mergeMsgSystem(language);

  const fullText = await streamChat(
    providerConfig,
    systemPrompt,
    prompts.mergeMsgUser(logText, trimmedDiff, baseBranch, currentBranch),
    {
      onChunk,
      onDone,
      signal,
      maxTokens: config.ai?.maxTokens || 2000,
      temperature,
    }
  );

  return { fullText, currentBranch, baseBranch, commits };
}

module.exports = { streamMergeMsg };
