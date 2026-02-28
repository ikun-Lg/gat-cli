'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const PROVIDERS = require('./providers');

const CONFIG_DIR = path.join(os.homedir(), '.gat-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 从注册表动态生成 providers 默认配置
const defaultProviders = {};
for (const [name, p] of Object.entries(PROVIDERS)) {
  defaultProviders[name] = { apiKey: '', baseUrl: p.defaultBaseUrl, model: p.defaultModel };
}

const DEFAULT_CONFIG = {
  provider: 'deepseek',
  providers: defaultProviders,
  commit: {
    language: 'zh', // zh | en
    style: 'conventional', // conventional | simple
    autoPush: false,
    autoStage: false,
  },
  ai: {
    temperature: 0.3,  // 生成温度，越高越有创意
    maxTokens: null,   // null = 使用各命令默认值
  },
  prompts: {
    // 自定义提示词，null = 使用内置默认值
    commitSystem: null,
    reviewSystem: null,
    explainSystem: null,
    changelogSystem: null,
    mergeMsgSystem: null,
    fixSystem: null,
  },
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function load() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    save(DEFAULT_CONFIG);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const stored = JSON.parse(raw);
    // deep merge with defaults so new fields are always present
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), stored);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function save(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function getConfigFilePath() {
  return CONFIG_FILE;
}

/**
 * 通过点路径设置配置项并保存
 * @param {string} dotPath  例如 'providers.deepseek.apiKey' 或 'commit.language'
 * @param {string} value    字符串值，自动转换 true/false/数字
 * @returns {object} 更新后的 config
 */
function set(dotPath, value) {
  const config = load();
  const keys = dotPath.split('.');
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  // 自动类型转换
  let coerced = value;
  if (value === 'true') coerced = true;
  else if (value === 'false') coerced = false;
  else if (value === 'null') coerced = null;
  else if (value !== '' && !isNaN(value)) coerced = Number(value);
  obj[keys[keys.length - 1]] = coerced;
  save(config);
  return config;
}

module.exports = { load, save, set, getConfigFilePath };
