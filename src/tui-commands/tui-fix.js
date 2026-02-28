'use strict';

const git = require('../git');
const configManager = require('../config');
const { streamChat } = require('../ai/stream-client');
const prompts = require('../ai/prompts');

/**
 * 流式分析合并冲突并给出建议
 * @param {string} cwd
 * @param {{ onChunk?: Function, onDone?: Function, signal?: AbortController }} opts
 * @returns {{ fullText: string, conflictFiles: string[] }}
 */
async function streamFix(cwd, opts = {}) {
  const { onChunk, onDone, signal } = opts;

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];
  if (!providerConfig?.apiKey) {
    throw new Error(`${providerName} 的 API Key 未配置，请运行 /config set 进行配置`);
  }

  const conflictFiles = await git.getConflictFiles(cwd);
  if (conflictFiles.length === 0) {
    const msg = '✅ 没有检测到合并冲突';
    if (onDone) onDone(msg);
    return { fullText: msg, conflictFiles: [] };
  }

  const parts = [];
  for (const filename of conflictFiles) {
    let content;
    try {
      content = await git.getConflictContent(filename, cwd);
    } catch {
      content = '（无法读取文件内容）';
    }
    const trimmed =
      content.length > 4000 ? content.slice(0, 4000) + '\n...(truncated)' : content;
    parts.push(`## 文件: ${filename}\n\n${trimmed}`);
  }

  const { language } = config.commit;
  const temperature = config.ai?.temperature ?? 0.3;
  const systemPrompt = config.prompts?.fixSystem || prompts.fixSystem(language);
  const userPrompt = `以下是有合并冲突的文件（共 ${conflictFiles.length} 个）：\n\n${parts.join('\n\n---\n\n')}`;

  const fullText = await streamChat(providerConfig, systemPrompt, userPrompt, {
    onChunk,
    onDone,
    signal,
    maxTokens: config.ai?.maxTokens || 4000,
    temperature,
  });

  return { fullText, conflictFiles };
}

module.exports = { streamFix };
