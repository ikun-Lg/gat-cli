'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const HISTORY_DIR = path.join(os.homedir(), '.gat-cli');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');
const MAX_ENTRIES = 50;

function ensureDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

function load() {
  ensureDir();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 保存一条生成的 commit message 到历史
 * @param {string} message
 */
function save(message) {
  if (!message || !message.trim()) return;
  const entries = load();
  // 去重：移除相同内容的旧记录
  const filtered = entries.filter((e) => e.message !== message);
  filtered.push({ message, ts: Date.now() });
  // 保留最新 MAX_ENTRIES 条
  const trimmed = filtered.slice(-MAX_ENTRIES);
  ensureDir();
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch {
    // 写入失败静默忽略
  }
}

/**
 * 获取最近 N 条历史，倒序（最新在前）
 * @param {number} n
 * @returns {{ message: string, ts: number }[]}
 */
function recent(n = MAX_ENTRIES) {
  const entries = load();
  return entries.slice(-n).reverse();
}

module.exports = { save, recent, load };
