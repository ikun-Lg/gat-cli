'use strict';

const { chat } = require('./client');
const prompts = require('./prompts');

async function generateCommitMessage(diff, stat, config, language, style) {
  return chat(config, prompts.commitSystem(language, style), prompts.commitUser(stat, diff), { max_tokens: 500 });
}

async function generateCommitMessages(diff, stat, config, language, style, count) {
  const raw = await chat(
    config,
    prompts.commitSystemMultiple(language, style, count),
    prompts.commitUser(stat, diff),
    { max_tokens: 500 * count }
  );
  const messages = raw.split(/^---$/m).map((s) => s.trim()).filter(Boolean);
  // 如果解析失败（AI 没按格式输出），降级为单条
  return messages.length >= 1 ? messages.slice(0, count) : [raw.trim()];
}

module.exports = { generateCommitMessage, generateCommitMessages };
