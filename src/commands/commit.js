'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');

const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat commit [options]
 *
 * options:
 *   -a, --all      自动 stage 所有变更后再提交
 *   -p, --push     提交后自动 push
 *   -y, --yes      跳过确认，直接使用 AI 生成的 message 提交
 *   -m, --message  直接指定 message（跳过 AI 生成）
 */
async function commitCommand(options) {
  const cwd = process.cwd();

  // 1. 检查是否在 git 仓库中
  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  // 2. 读取配置
  const config = configManager.load();

  // 3. 检查是否需要 stage
  const status = await git.getStatus(cwd);
  const shouldAutoStage = options.all || config.commit.autoStage;

  if (shouldAutoStage && status.files.length > 0) {
    await git.stageAll(cwd);
    console.log(chalk.gray('✓ 已 stage 所有变更'));
  }

  // 4. 获取 staged diff
  const { stat, content: diffContent } = await git.getStagedDiff(cwd);

  if (!diffContent || diffContent.trim() === '') {
    // 没有 staged 内容
    const freshStatus = await git.getStatus(cwd);
    if (freshStatus.files.length === 0) {
      console.log(chalk.yellow('没有任何变更需要提交'));
      return;
    }
    // 有未 staged 的文件
    const { doStage } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'doStage',
        message: `有 ${freshStatus.files.length} 个文件未 staged，是否自动 stage 所有变更?`,
        default: true,
      },
    ]);
    if (doStage) {
      await git.stageAll(cwd);
      console.log(chalk.gray('✓ 已 stage 所有变更'));
    } else {
      console.log(chalk.yellow('没有 staged 的变更，退出'));
      return;
    }
  }

  // 5. 获取最新的 staged diff
  const { stat: finalStat, content: finalDiff } = await git.getStagedDiff(cwd);

  if (!finalDiff || finalDiff.trim() === '') {
    console.log(chalk.yellow('没有 staged 的变更，退出'));
    return;
  }

  // 显示变更摘要
  console.log(chalk.bold('\n变更摘要:'));
  console.log(chalk.gray(finalStat || finalDiff.slice(0, 500)));

  // 6. 生成 commit message
  let message = options.message;

  if (!message) {
    const spinner = ora('AI 正在生成 commit message...').start();
    try {
      // 截断 diff 避免 token 过多（保留前 4000 字符）
      const trimmedDiff = finalDiff.length > 4000
        ? finalDiff.slice(0, 4000) + '\n...(diff too large, truncated)'
        : finalDiff;

      message = await ai.generateCommitMessage(trimmedDiff, config);
      spinner.succeed(chalk.green('AI 生成完成'));
    } catch (err) {
      spinner.fail(chalk.red('AI 生成失败'));
      console.error(chalk.red(`错误: ${err.message}`));
      if (err.response) {
        console.error(chalk.gray(JSON.stringify(err.response.data, null, 2)));
      }
      process.exit(1);
    }
  }

  // 7. 显示生成的 message，让用户确认或修改
  console.log('');
  console.log(chalk.bold('生成的 Commit Message:'));
  console.log(chalk.cyan(`  ${message}`));
  console.log('');

  const skipConfirm = options.yes;
  let finalMessage = message;

  if (!skipConfirm) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '如何处理这条 commit message?',
        choices: [
          { name: '✓ 使用此 message 提交', value: 'use' },
          { name: '✎ 编辑后提交', value: 'edit' },
          { name: '↺ 重新生成', value: 'regenerate' },
          { name: '✗ 取消', value: 'cancel' },
        ],
      },
    ]);

    if (action === 'cancel') {
      console.log(chalk.gray('已取消'));
      return;
    }

    if (action === 'edit') {
      const { editedMessage } = await inquirer.prompt([
        {
          type: 'input',
          name: 'editedMessage',
          message: '编辑 commit message:',
          default: message,
          validate: (v) => v.trim() !== '' || 'message 不能为空',
        },
      ]);
      finalMessage = editedMessage.trim();
    }

    if (action === 'regenerate') {
      // 递归调用，重新生成
      return commitCommand({ ...options, message: undefined });
    }
  }

  // 8. 执行 commit
  const commitSpinner = ora('提交中...').start();
  try {
    const branch = await git.getCurrentBranch(cwd);
    await git.commit(finalMessage, cwd);
    commitSpinner.succeed(chalk.green(`✓ 提交成功 [${branch}]`));
    console.log(chalk.white(`  ${finalMessage}`));
  } catch (err) {
    commitSpinner.fail(chalk.red('提交失败'));
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // 9. Push（如果需要）
  const shouldPush = options.push || config.commit.autoPush;
  if (shouldPush) {
    const pushSpinner = ora('推送到远端...').start();
    try {
      await git.push(cwd);
      pushSpinner.succeed(chalk.green('✓ 推送成功'));
    } catch (err) {
      pushSpinner.fail(chalk.red('推送失败'));
      console.error(chalk.red(err.message));
    }
  }
}

module.exports = { commitCommand };
