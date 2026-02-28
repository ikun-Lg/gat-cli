'use strict';

const fs = require('fs');
const path = require('path');
const git = require('../git');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');

/**
 * 流式生成 Changelog
 * @param {string} cwd
 * @param {{ from?: string, to?: string, version?: string, output?: string, onChunk?: Function, onDone?: Function, signal?: AbortController }} opts
 */
async function streamLog(cwd, opts = {}) {
  const { from, to = 'HEAD', version = 'Unreleased', output, onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config set 进行配置`);
  }

  let fromRef = from;
  if (!fromRef) {
    const tags = await git.getTags(cwd);
    fromRef = tags[0] || null;
  }

  const commits = await git.getLog(fromRef, to, cwd);
  if (commits.length === 0) {
    throw new Error('该范围内没有 commit');
  }

  const logText = commits
    .map((c) => `${c.hash.slice(0, 7)} ${c.message}${c.body ? '\n  ' + c.body.trim() : ''}`)
    .join('\n');

  const date = new Date().toISOString().slice(0, 10);
  const { language } = config.commit;
  const temperature = config.ai?.temperature ?? 0.3;
  const systemPrompt = config.prompts?.changelogSystem || prompts.changelogSystem(language);

  let savedText = '';
  const wrappedOnDone = output
    ? (full) => {
        savedText = full;
        if (onDone) onDone(full);
      }
    : onDone;

  const fullText = await streamChat(
    providerConfig,
    systemPrompt,
    prompts.changelogUser(logText, version, date),
    {
      onChunk,
      onDone: wrappedOnDone,
      signal,
      maxTokens: config.ai?.maxTokens || 3000,
      temperature,
    }
  );

  // 保存到文件（如果指定了 -o）
  if (output && fullText) {
    const outPath = path.resolve(cwd, output);
    let existing = '';
    if (fs.existsSync(outPath)) {
      existing = '\n\n' + fs.readFileSync(outPath, 'utf-8');
    }
    fs.writeFileSync(outPath, fullText + existing, 'utf-8');
  }

  return { fullText, commits, fromRef, savedToFile: !!output && !!fullText };
}

module.exports = { streamLog };
