#!/usr/bin/env node

'use strict';

if (process.argv.length <= 2) {
  // 无参数：进入 TUI 模式
  const { spawn } = require('child_process');
  const path = require('path');
  const tuiScript = path.join(__dirname, 'gat-tui.mjs');
  const child = spawn(process.execPath, [tuiScript], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
} else {
  // 有参数：普通 CLI 模式
  require('../src/index');
}
