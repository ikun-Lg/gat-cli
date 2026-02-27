'use strict';

const deepseek = require('./deepseek');
const glm = require('./glm');

// openai-compatible 的 provider 共用同一套实现
const PROVIDERS = {
  deepseek,
  glm,
  openai: deepseek, // OpenAI 接口兼容
};

/**
 * 根据当前配置生成 commit message
 * @param {string} diff
 * @param {object} config  完整的 config 对象
 * @returns {Promise<string>}
 */
async function generateCommitMessage(diff, config) {
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];

  if (!providerConfig) {
    throw new Error(`未知的 AI 提供商: ${providerName}`);
  }
  if (!providerConfig.apiKey) {
    throw new Error(
      `${providerName} 的 API Key 未配置，请运行: gat config set --provider ${providerName} --api-key <your-key>`
    );
  }

  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`不支持的 AI 提供商: ${providerName}，支持的提供商: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const { language, style } = config.commit;
  return provider.generateCommitMessage(diff, providerConfig, language, style);
}

module.exports = { generateCommitMessage };
