'use strict';

/**
 * 所有支持的 AI 提供商注册表（单一来源）
 * config.js / ai/index.js / commands/config.js 均从此处读取
 */
const PROVIDERS = {
  deepseek: {
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  glm: {
    defaultModel: 'glm-4.7-flash',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  openai: {
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  ollama: {
    defaultModel: 'llama3',
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
};

module.exports = PROVIDERS;
