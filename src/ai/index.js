'use strict';

const { chat } = require('./client');
const prompts = require('./prompts');

const PROVIDERS = {
  deepseek: require('./deepseek'),
  glm: require('./glm'),
  openai: require('./deepseek'), // OpenAI 接口兼容
};

function getProviderConfig(config) {
  const providerName = config.provider;
  const providerConfig = config.providers[providerName];

  if (!providerConfig) throw new Error(`未知的 AI 提供商: ${providerName}`);
  if (!providerConfig.apiKey) {
    throw new Error(
      `${providerName} 的 API Key 未配置，请运行：gat config set --provider ${providerName} --api-key <your-key>`
    );
  }
  if (!PROVIDERS[providerName]) {
    throw new Error(`不支持的提供商: ${providerName}，支持：${Object.keys(PROVIDERS).join(', ')}`);
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
  return PROVIDERS[config.provider].generateCommitMessage(diff, stat, providerConfig, language, style);
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
  generateReview,
  generateChangelog,
  generateExplanation,
  generatePRDescription,
  generateConflictResolution,
  generateBranchName,
};
