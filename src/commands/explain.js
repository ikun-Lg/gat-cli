'use strict';

const chalk = require('chalk');
const ora = require('ora');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat explain [range]
 *
 * range 示例：
 *   HEAD~3        最近 3 次提交
 *   v1.0.0..HEAD  v1.0.0 到现在
 *   （不传）       最近 5 次提交
 */
async function explainCommand(range, options) {
  const cwd = process.cwd();

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const config = configManager.load();

  // 解析 range
  let from, to;
  if (!range) {
    from = 'HEAD~5';
    to = 'HEAD';
  } else if (range.includes('..')) {
    [from, to] = range.split('..');
  } else {
    // 视为 HEAD~N 这种格式
    from = range;
    to = 'HEAD';
  }

  const commits = await git.getLog(from, to, cwd);
  if (commits.length === 0) {
    console.log(chalk.yellow('该范围内没有 commit'));
    return;
  }

  const logText = commits
    .map((c) => `[${c.hash.slice(0, 7)}] ${c.message}`)
    .join('\n');

  // 获取该范围的 diff 摘要
  const simpleGit = require('simple-git')(cwd);
  const diffStat = await simpleGit.diff([`${from}..${to}`, '--stat']).catch(() => '');

  console.log(chalk.gray(`解释最近 ${commits.length} 次 commit`));

  const spinner = ora('AI 正在解释变更内容...').start();
  let result;
  try {
    result = await ai.generateExplanation(logText, diffStat, config);
    spinner.succeed(chalk.green('解释完成'));
  } catch (err) {
    spinner.fail(chalk.red('解释失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  console.log('\n' + chalk.bold('─── 变更解释 ───────────────────────────────────────'));
  console.log(result);
  console.log(chalk.gray('────────────────────────────────────────────────────\n'));
}

module.exports = { explainCommand };
