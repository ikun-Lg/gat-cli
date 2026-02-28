'use strict';

const { chat } = require('./client');
const prompts = require('./prompts');
const PROVIDERS = require('../providers');

// 适配器映射（从注册表 key 到具体模块）
const ADAPTERS = {
  deepseek: require('./deepseek'),
  glm: require('./glm'),
  openai: require('./deepseek'),  // OpenAI 接口兼容，复用 deepseek 适配器
  ollama: require('./deepseek'),  // Ollama 兼容 OpenAI v1 格式，复用 deepseek 适配器
};

function getProviderConfig(config) {
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];

  if (!PROVIDERS[providerName]) {
    throw new Error(`不支持的提供商: ${providerName}，支持：${Object.keys(PROVIDERS).join(', ')}`);
  }
  if (!providerConfig) {
    throw new Error(`提供商配置不存在: ${providerName}`);
  }
  if (!providerConfig.apiKey) {
    const err = new Error(`${providerName} 的 API Key 未配置，请运行：gat config set --provider ${providerName} --api-key <your-key>`);
    err.code = 'MISSING_API_KEY';
    err.provider = providerName;
    throw err;
  }

  return providerConfig;
}

function call(config, systemPrompt, userPrompt, extra) {
  const providerConfig = getProviderConfig(config);
  return chat(providerConfig, systemPrompt, userPrompt, extra);
}

// ─── 对外接口 ──────────────────────────────────────────────────────────────────

function generateCommitMessage(diff, stat, config) {
  const providerConfig = getProviderConfig(config);
  const { language, style } = config.commit;
  return ADAPTERS[config.provider].generateCommitMessage(diff, stat, providerConfig, language, style);
}

/**
 * 生成多条备选 commit message
 * @returns {Promise<string[]>}
 */
function generateCommitMessages(diff, stat, config, count) {
  if (count <= 1) {
    return generateCommitMessage(diff, stat, config).then((m) => [m]);
  }
  const providerConfig = getProviderConfig(config);
  const { language, style } = config.commit;
  return ADAPTERS[config.provider].generateCommitMessages(diff, stat, providerConfig, language, style, count);
}

function generateReview(diff, config) {
  const { language } = config.commit;
  return call(config, prompts.reviewSystem(language), prompts.reviewUser(diff), { max_tokens: 6000 });
}

function generateChangelog(logs, config, version, date) {
  const { language } = config.commit;
  return call(config, prompts.changelogSystem(language), prompts.changelogUser(logs, version, date), { max_tokens: 2000 });
}

function generateExplanation(logs, diff, config) {
  const { language } = config.commit;
  return call(config, prompts.explainSystem(language), prompts.explainUser(logs, diff), { max_tokens: 1000 });
}

function generatePRDescription(logs, diff, baseBranch, currentBranch, config) {
  const { language } = config.commit;
  return call(
    config,
    prompts.mergeMsgSystem(language),
    prompts.mergeMsgUser(logs, diff, baseBranch, currentBranch),
    { max_tokens: 1500 }
  );
}

function generateConflictResolution(filename, conflictContent, config) {
  const { language } = config.commit;
  return call(config, prompts.fixSystem(language), prompts.fixUser(filename, conflictContent), { max_tokens: 2000 });
}

function generateBranchName(description, config) {
  return call(config, prompts.branchSystem(), prompts.branchUser(description), {
    temperature: 0.2,
    max_tokens: 50,
  });
}

module.exports = {
  generateCommitMessage,
  generateCommitMessages,
  generateReview,
  generateChangelog,
  generateExplanation,
  generatePRDescription,
  generateConflictResolution,
  generateBranchName,
};
