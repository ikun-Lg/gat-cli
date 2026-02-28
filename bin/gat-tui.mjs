#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 动态 import 编译后的 ESM bundle
const { App } = await import(join(__dirname, '../dist/tui.mjs'));

const { waitUntilExit } = render(
  React.createElement(App, { cwd: process.cwd() })
);

await waitUntilExit();
process.exit(0);
