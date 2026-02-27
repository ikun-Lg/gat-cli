'use strict';

// GLM 同样兼容 OpenAI 接口格式，复用 client
const { chat } = require('./client');
const prompts = require('./prompts');

async function generateCommitMessage(diff, stat, config, language, style) {
  return chat(config, prompts.commitSystem(language, style), prompts.commitUser(stat, diff), { max_tokens: 500 });
}

module.exports = { generateCommitMessage };
