'use strict';

const chalk = require('chalk');
const ora = require('ora');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat review [options]
 *
 * options:
 *   -a, --all   审查所有未提交变更（默认只审查 staged）
 */
async function reviewCommand(options) {
  const cwd = process.cwd();

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const config = configManager.load();
  let diff;

  if (options.all) {
    const status = await git.getStatus(cwd);
    if (status.files.length === 0) {
      console.log(chalk.yellow('没有任何变更'));
      return;
    }
    // 记录原本已 staged 的文件，审查完还原
    const originallyStaged = status.staged;
    await git.stageAll(cwd);
    const result = await git.getStagedDiff(cwd);
    diff = result.content;
    // 还原 staged 状态：只 unstage 原本没有 staged 的文件
    const simpleGit = require('simple-git')(cwd);
    await simpleGit.raw(['restore', '--staged', '.']);
    if (originallyStaged.length > 0) {
      await simpleGit.add(originallyStaged);
    }
  } else {
    const result = await git.getStagedDiff(cwd);
    diff = result.content;
  }

  if (!diff || diff.trim() === '') {
    console.log(chalk.yellow('没有 staged 的变更可供审查，可使用 -a 审查所有变更'));
    return;
  }

  const trimmedDiff = diff.length > 8000 ? diff.slice(0, 8000) + '\n...(truncated)' : diff;

  const spinner = ora('AI 正在审查代码...').start();
  let result;
  try {
    result = await ai.generateReview(trimmedDiff, config);
    spinner.succeed(chalk.green('审查完成'));
  } catch (err) {
    spinner.fail(chalk.red('审查失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  console.log('\n' + chalk.bold('─── 代码审查报告 ───────────────────────────────────'));
  console.log(result);
  console.log(chalk.gray('────────────────────────────────────────────────────\n'));
}

module.exports = { reviewCommand };
