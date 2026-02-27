'use strict';

const chalk = require('chalk');
const ora = require('ora');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat merge-msg [options]
 *
 * options:
 *   -b, --base <branch>  目标分支，默认自动检测 main/master
 */
async function mergeMsgCommand(options) {
  const cwd = process.cwd();

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const config = configManager.load();
  const currentBranch = await git.getCurrentBranch(cwd);
  const baseBranch = options.base || await git.getDefaultBranch(cwd);

  if (currentBranch === baseBranch) {
    console.error(chalk.red(`当前已在 ${baseBranch} 分支，请切换到 feature 分支后再运行`));
    process.exit(1);
  }

  console.log(chalk.gray(`分析 ${chalk.white(currentBranch)} → ${chalk.white(baseBranch)} 的变更...`));

  let commits, diff;
  try {
    commits = await git.getLogFromBase(baseBranch, cwd);
    const diffResult = await git.getDiffFromBase(baseBranch, cwd);
    diff = diffResult.content;
  } catch (err) {
    console.error(chalk.red(`无法获取与 ${baseBranch} 的差异，请确认基础分支名是否正确`));
    console.error(chalk.gray(err.message));
    process.exit(1);
  }

  if (commits.length === 0) {
    console.log(chalk.yellow(`相对于 ${baseBranch} 没有新的 commit`));
    return;
  }

  const logText = commits.map((c) => `[${c.hash.slice(0, 7)}] ${c.message}`).join('\n');
  const trimmedDiff = diff.length > 6000 ? diff.slice(0, 6000) + '\n...(truncated)' : diff;

  console.log(chalk.gray(`共 ${commits.length} 个 commit`));

  const spinner = ora('AI 正在生成 PR 描述...').start();
  let result;
  try {
    result = await ai.generatePRDescription(logText, trimmedDiff, baseBranch, currentBranch, config);
    spinner.succeed(chalk.green('PR 描述生成完成'));
  } catch (err) {
    spinner.fail(chalk.red('生成失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // 第一行作为 PR title 单独高亮
  const lines = result.split('\n');
  const title = lines[0];
  const body = lines.slice(1).join('\n').trim();

  console.log('\n' + chalk.bold('─── PR Title ────────────────────────────────────────'));
  console.log(chalk.cyan(title));
  console.log(chalk.bold('\n─── PR Description ──────────────────────────────────'));
  console.log(body);
  console.log(chalk.gray('\n────────────────────────────────────────────────────\n'));
}

module.exports = { mergeMsgCommand };
