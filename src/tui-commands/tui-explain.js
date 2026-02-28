'use strict';

const git = require('../git');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');

/**
 * 流式解释 commit 变更
 * @param {string} cwd
 * @param {{ range?: string, onChunk?: Function, onDone?: Function, signal?: AbortController }} opts
 */
async function streamExplain(cwd, opts = {}) {
  const { range, onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config set 进行配置`);
  }

  // 解析 range
  let from, to;
  if (!range) {
    from = 'HEAD~5';
    to = 'HEAD';
  } else if (range.includes('..')) {
    [from, to] = range.split('..');
  } else {
    from = range;
    to = 'HEAD';
  }

  const commits = await git.getLog(from, to, cwd);
  if (commits.length === 0) {
    throw new Error('该范围内没有 commit');
  }

  const logText = commits.map((c) => `[${c.hash.slice(0, 7)}] ${c.message}`).join('\n');

  // 获取该范围的 diff 摘要
  const simpleGit = require('simple-git')(cwd);
  const diffStat = await simpleGit.diff([`${from}..${to}`, '--stat']).catch(() => '');

  const { language } = config.commit;
  const temperature = config.ai?.temperature ?? 0.3;
  const systemPrompt = config.prompts?.explainSystem || prompts.explainSystem(language);

  const fullText = await streamChat(
    providerConfig,
    systemPrompt,
    prompts.explainUser(logText, diffStat),
    {
      onChunk,
      onDone,
      signal,
      maxTokens: config.ai?.maxTokens || 1500,
      temperature,
    }
  );

  return { fullText, commits };
}

module.exports = { streamExplain };
