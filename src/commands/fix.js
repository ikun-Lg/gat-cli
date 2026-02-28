'use strict';

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const configManager = require('../config');
const git = require('../git');
const ai = require('../ai');

/**
 * gat fix
 * 检测当前仓库中有合并冲突的文件，逐一调用 AI 给出合并建议
 */
async function fixCommand() {
  const cwd = process.cwd();

  if (!await git.checkIsRepo(cwd)) {
    console.error(chalk.red('✗ 当前目录不是 git 仓库'));
    process.exit(1);
  }

  const conflictFiles = await git.getConflictFiles(cwd);

  if (conflictFiles.length === 0) {
    console.log(chalk.green('✓ 没有检测到合并冲突'));
    return;
  }

  const config = configManager.load();
  console.log(chalk.yellow(`检测到 ${conflictFiles.length} 个冲突文件：`));
  conflictFiles.forEach((f) => console.log(chalk.gray(`  • ${f}`)));
  console.log('');

  for (const filename of conflictFiles) {
    console.log(chalk.bold(`\n处理冲突文件：${chalk.cyan(filename)}`));

    let conflictContent;
    try {
      conflictContent = await git.getConflictContent(filename, cwd);
    } catch {
      console.error(chalk.red(`  无法读取文件: ${filename}`));
      continue;
    }

    // 截断避免 token 过多
    const trimmed =
      conflictContent.length > 6000
        ? conflictContent.slice(0, 6000) + '\n...(truncated)'
        : conflictContent;

    const spinner = ora('AI 分析冲突中...').start();
    let suggestion;
    try {
      suggestion = await ai.generateConflictResolution(filename, trimmed, config);
      spinner.succeed('分析完成');
    } catch (err) {
      spinner.fail(chalk.red('分析失败'));
      console.error(chalk.red(err.message));
      continue;
    }

    console.log('\n' + chalk.bold('─── AI 建议 ─────────────────────────────────────────'));
    console.log(suggestion);
    console.log(chalk.gray('────────────────────────────────────────────────────'));

    // 尝试从 AI 输出中提取代码块
    const codeMatch = suggestion.match(/```[\w]*\n([\s\S]*?)```/);
    const resolvedCode = codeMatch ? codeMatch[1] : null;

    const choices = [
      { name: '跳过，手动处理', value: 'skip' },
    ];
    if (resolvedCode) {
      choices.unshift({ name: '✓ 应用 AI 建议的解决方案', value: 'apply' });
    }
    choices.push({ name: '用编辑器打开', value: 'open' });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '如何处理这个冲突？',
        choices,
      },
    ]);

    if (action === 'apply' && resolvedCode) {
      await git.resolveConflict(filename, resolvedCode, cwd);
      console.log(chalk.green(`✓ 已应用并 stage: ${filename}`));
    } else if (action === 'open') {
      const { execSync } = require('child_process');
      const filePath = path.resolve(cwd, filename);
      const editor = process.env.EDITOR || 'vi';
      try {
        execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
      } catch {
        console.log(chalk.gray(`请手动打开: ${filePath}`));
      }
    } else {
      console.log(chalk.gray(`已跳过: ${filename}`));
    }
  }

  // 检查是否还有冲突
  const remaining = await git.getConflictFiles(cwd);
  if (remaining.length === 0) {
    console.log(chalk.green('\n✓ 所有冲突已解决，可以运行 gat commit 提交'));
  } else {
    console.log(chalk.yellow(`\n还有 ${remaining.length} 个冲突文件未解决：`));
    remaining.forEach((f) => console.log(chalk.gray(`  • ${f}`)));
  }
}

module.exports = { fixCommand };
