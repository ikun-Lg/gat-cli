'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');
const { ensureApiKey } = require('../utils/ensure-key');

/**
 * 按文件粒度智能截断 diff，保留完整的小文件，大文件截断并附说明
 */
function smartTruncateDiff(diff, maxChars = 8000) {
  if (!diff || diff.length <= maxChars) return diff;

  const sections = diff.split(/(?=^diff --git )/m);
  const result = [];
  const skipped = [];
  let totalChars = 0;

  for (const section of sections) {
    if (!section.trim()) continue;
    if (totalChars + section.length <= maxChars) {
      result.push(section);
      totalChars += section.length;
    } else if (result.length === 0) {
      // 至少保留第一个文件的部分内容
      result.push(section.slice(0, maxChars) + '\n...(diff truncated)');
      break;
    } else {
      const m = section.match(/^diff --git a\/(.*?) b\//);
      if (m) skipped.push(m[1]);
    }
  }

  if (skipped.length > 0) {
    result.push(
      `\n# 以下 ${skipped.length} 个文件因 diff 过大已省略：\n` +
        skipped.map((f) => `# - ${f}`).join('\n')
    );
  }

  return result.join('');
}

/**
 * 调用 $EDITOR 让用户在编辑器中修改 commit message
 */
function openInEditor(message) {
  const tmpFile = path.join(os.tmpdir(), `gat-commit-${Date.now()}.txt`);
  const hint = [
    '',
    '# 请编辑上方的 commit message，保存后退出编辑器',
    '# 以 # 开头的行将被忽略',
    '# 保存空文件将取消此次编辑',
  ].join('\n');

  fs.writeFileSync(tmpFile, message + hint, 'utf-8');

  const editor =
    process.env.GIT_EDITOR || process.env.VISUAL || process.env.EDITOR || 'vi';

  const result = spawnSync(editor, [tmpFile], { stdio: 'inherit' });
  if (result.error) {
    console.log(chalk.gray(`无法启动编辑器 "${editor}"，请手动编辑`));
    fs.unlinkSync(tmpFile);
    return null;
  }

  const raw = fs.readFileSync(tmpFile, 'utf-8');
  fs.unlinkSync(tmpFile);

  const edited = raw
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim();

  return edited || null;
}

/**
 * 调用 AI 生成 commit message（支持多条备选）
 * @returns {Promise<string[]>}
 */
async function callAI(diff, stat, config, count = 1) {
  const trimmedDiff = smartTruncateDiff(diff);
  if (count > 1) {
    return ai.generateCommitMessages(trimmedDiff, stat, config, count);
  }
  const msg = await ai.generateCommitMessage(trimmedDiff, stat, config);
  return [msg];
}

/**
 * gat commit [options]
 *
 * options:
 *   -a, --all        自动 stage 所有变更后再提交
 *   -p, --push       提交后自动 push
 *   -y, --yes        跳过确认，直接使用 AI 生成的 message 提交
 *   -m, --message    直接指定 message（跳过 AI 生成）
 *   -n, --num <n>    生成 n 条备选 message 供选择（默认 1）
 */
async function commitCommand(options) {
  const cwd = process.cwd();

  // 1. 检查是否在 git 仓库中
  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  // 2. 读取配置，检查 API Key（若未配置引导用户完成初始化）
  let config = configManager.load();
  if (!options.message) {
    config = await ensureApiKey(config);
  }

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
    const freshStatus = await git.getStatus(cwd);
    if (freshStatus.files.length === 0) {
      console.log(chalk.yellow('没有任何变更需要提交'));
      return;
    }
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

  // 5. 获取最终 staged diff
  const { stat: finalStat, content: finalDiff } = await git.getStagedDiff(cwd);

  if (!finalDiff || finalDiff.trim() === '') {
    console.log(chalk.yellow('没有 staged 的变更，退出'));
    return;
  }

  // 显示变更摘要
  console.log(chalk.bold('\n变更摘要:'));
  console.log(chalk.gray(finalStat || finalDiff.slice(0, 500)));

  // 6. 生成 commit message（支持多条备选，可重新生成）
  const numOptions = options.message ? 1 : Math.max(1, parseInt(options.num) || 1);
  let finalMessage;

  if (options.message) {
    finalMessage = options.message;
  } else {
    // 循环，直到用户确认（避免递归调用整个命令）
    while (true) {
      let messages;
      const spinner = ora(
        numOptions > 1
          ? `AI 正在生成 ${numOptions} 条备选 commit message...`
          : 'AI 正在生成 commit message...'
      ).start();

      try {
        messages = await callAI(finalDiff, finalStat, config, numOptions);
        spinner.succeed(chalk.green('AI 生成完成'));
      } catch (err) {
        spinner.fail(chalk.red('AI 生成失败'));
        console.error(chalk.red(`错误: ${err.message}`));
        if (err.response) {
          console.error(chalk.gray(JSON.stringify(err.response.data, null, 2)));
        }
        process.exit(1);
      }

      // 选择一条 message（多条时展示列表）
      let chosenMessage;
      if (messages.length === 1 || options.yes) {
        chosenMessage = messages[0];
      } else {
        console.log('');
        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: '选择一条 commit message:',
            choices: messages.map((m, i) => ({ name: `${i + 1}. ${m}`, value: m })),
          },
        ]);
        chosenMessage = selected;
      }

      console.log('');
      console.log(chalk.bold('生成的 Commit Message:'));
      console.log(chalk.cyan(`  ${chosenMessage}`));
      console.log('');

      if (options.yes) {
        finalMessage = chosenMessage;
        break;
      }

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: '如何处理这条 commit message?',
          choices: [
            { name: '✓ 使用此 message 提交', value: 'use' },
            { name: '✎ 在编辑器中编辑后提交', value: 'edit' },
            { name: '↺ 重新生成', value: 'regenerate' },
            { name: '✗ 取消', value: 'cancel' },
          ],
        },
      ]);

      if (action === 'cancel') {
        console.log(chalk.gray('已取消'));
        return;
      }

      if (action === 'use') {
        finalMessage = chosenMessage;
        break;
      }

      if (action === 'edit') {
        const edited = openInEditor(chosenMessage);
        if (!edited) {
          console.log(chalk.yellow('编辑内容为空，已取消'));
          return;
        }
        finalMessage = edited;
        break;
      }

      // action === 'regenerate'：循环重新生成，不重走 git 操作
    }
  }

  // 7. 执行 commit
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

  // 8. Push（如果需要）
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
