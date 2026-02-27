'use strict';

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat branch <description>
 * 根据任务描述生成分支名，确认后创建并切换
 *
 * options:
 *   -n, --no-create   只生成分支名，不创建分支
 */
async function branchCommand(description, options) {
  const cwd = process.cwd();

  if (!description || description.trim() === '') {
    console.error(chalk.red('请提供任务描述，例如：gat branch "修复用户登录闪退"'));
    process.exit(1);
  }

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const config = configManager.load();

  const spinner = ora('AI 生成分支名...').start();
  let branchName;
  try {
    const raw = await ai.generateBranchName(description, config);
    // 清理可能的多余内容（引号、换行等）
    branchName = raw.replace(/['"` \n]/g, '').split('\n')[0].trim();
    spinner.succeed(chalk.green('分支名生成完成'));
  } catch (err) {
    spinner.fail(chalk.red('生成失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold('生成的分支名：') + chalk.cyan(branchName));
  console.log('');

  if (options.noCreate) {
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '如何处理？',
      choices: [
        { name: `✓ 创建并切换到 ${branchName}`, value: 'create' },
        { name: '✎ 修改分支名后创建', value: 'edit' },
        { name: '✗ 取消', value: 'cancel' },
      ],
    },
  ]);

  if (action === 'cancel') {
    console.log(chalk.gray('已取消'));
    return;
  }

  let finalName = branchName;
  if (action === 'edit') {
    const { editedName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'editedName',
        message: '输入分支名：',
        default: branchName,
        validate: (v) => {
          if (!v.trim()) return '分支名不能为空';
          if (/[^\w\-\/.]/.test(v)) return '分支名包含非法字符';
          return true;
        },
      },
    ]);
    finalName = editedName.trim();
  }

  try {
    await git.createBranch(finalName, cwd);
    console.log(chalk.green(`✓ 已创建并切换到分支: ${chalk.white(finalName)}`));
  } catch (err) {
    console.error(chalk.red(`创建分支失败: ${err.message}`));
    process.exit(1);
  }
}

module.exports = { branchCommand };
