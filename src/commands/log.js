'use strict';

const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat log [options]
 *
 * options:
 *   --from <ref>      起始 ref（tag/commit/分支），默认上一个 tag
 *   --to <ref>        结束 ref，默认 HEAD
 *   --version <ver>   写入 changelog 的版本号，默认 Unreleased
 *   -o, --output <file>  输出到文件（默认打印到终端）
 */
async function logCommand(options) {
  const cwd = process.cwd();

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const config = configManager.load();
  let from = options.from;

  // 未指定 from 时，尝试用上一个 tag
  if (!from) {
    const tags = await git.getTags(cwd);
    from = tags[0] || null;
    if (from) {
      console.log(chalk.gray(`从上一个 tag ${chalk.white(from)} 起生成 changelog`));
    } else {
      console.log(chalk.gray('未找到 tag，将生成全部 commit 的 changelog'));
    }
  }

  const commits = await git.getLog(from, options.to || 'HEAD', cwd);
  if (commits.length === 0) {
    console.log(chalk.yellow('该范围内没有 commit'));
    return;
  }

  console.log(chalk.gray(`共 ${commits.length} 个 commit`));

  const logText = commits
    .map((c) => `${c.hash.slice(0, 7)} ${c.message}${c.body ? '\n  ' + c.body.trim() : ''}`)
    .join('\n');

  const version = options.version || 'Unreleased';
  const date = new Date().toISOString().slice(0, 10);

  const spinner = ora('AI 正在生成 Changelog...').start();
  let result;
  try {
    result = await ai.generateChangelog(logText, config, version, date);
    spinner.succeed(chalk.green('Changelog 生成完成'));
  } catch (err) {
    spinner.fail(chalk.red('生成失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  if (options.output) {
    const outPath = path.resolve(cwd, options.output);
    // 如果文件已存在，插入到头部
    let existing = '';
    if (fs.existsSync(outPath)) {
      existing = '\n\n' + fs.readFileSync(outPath, 'utf-8');
    }
    fs.writeFileSync(outPath, result + existing, 'utf-8');
    console.log(chalk.green(`✓ Changelog 已写入 ${options.output}`));
  } else {
    console.log('\n' + chalk.bold('─── Changelog ──────────────────────────────────────'));
    console.log(result);
    console.log(chalk.gray('────────────────────────────────────────────────────\n'));
  }
}

module.exports = { logCommand };
