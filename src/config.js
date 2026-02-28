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

module.exports = { load, save, getConfigFilePath };
