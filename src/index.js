'use strict';

const { Command } = require('commander');
const chalk = require('chalk');

const { commitCommand } = require('./commands/commit');
const { configSet, configGet } = require('./commands/config');
const { reviewCommand } = require('./commands/review');
const { logCommand } = require('./commands/log');
const { explainCommand } = require('./commands/explain');
const { mergeMsgCommand } = require('./commands/merge-msg');
const { fixCommand } = require('./commands/fix');
const { branchCommand } = require('./commands/branch');

const program = new Command();

program
  .name('gat')
  .description('AI 驱动的 Git 工作流工具')
  .version('1.1.0');

// ─── commit ───────────────────────────────────────────────────────────────────
program
  .command('commit')
  .description('AI 生成 commit message 并提交')
  .option('-a, --all', '自动 stage 所有变更（git add .）')
  .option('-p, --push', '提交后自动 push 到远端')
  .option('-y, --yes', '跳过确认，直接提交')
  .option('-m, --message <msg>', '直接指定 message（跳过 AI 生成）')
  .action(async (options) => {
    try { await commitCommand(options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── review ───────────────────────────────────────────────────────────────────
program
  .command('review')
  .description('AI 审查代码变更，指出潜在问题')
  .option('-a, --all', '审查所有未提交变更（默认只审查 staged）')
  .action(async (options) => {
    try { await reviewCommand(options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── log ──────────────────────────────────────────────────────────────────────
program
  .command('log')
  .description('AI 生成 Changelog（基于 commit 历史）')
  .option('--from <ref>', '起始 ref（tag/commit），默认上一个 tag')
  .option('--to <ref>', '结束 ref，默认 HEAD')
  .option('--version <ver>', '写入 changelog 的版本号，默认 Unreleased')
  .option('-o, --output <file>', '输出到文件（如 CHANGELOG.md）')
  .action(async (options) => {
    try { await logCommand(options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── explain ──────────────────────────────────────────────────────────────────
program
  .command('explain [range]')
  .description('AI 解释最近的代码变更（默认最近 5 次 commit）')
  .addHelpText('after', `
  range 示例：
    HEAD~3          最近 3 次 commit
    v1.0.0..HEAD    v1.0.0 到现在
    HEAD~10..HEAD~5 某个区间`)
  .action(async (range, options) => {
    try { await explainCommand(range, options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── merge-msg ────────────────────────────────────────────────────────────────
program
  .command('merge-msg')
  .description('AI 生成 Pull Request 标题和描述')
  .option('-b, --base <branch>', '目标分支，默认自动检测 main/master')
  .action(async (options) => {
    try { await mergeMsgCommand(options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── fix ──────────────────────────────────────────────────────────────────────
program
  .command('fix')
  .description('AI 辅助解决 merge conflict，逐文件给出合并建议')
  .action(async () => {
    try { await fixCommand(); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── branch ───────────────────────────────────────────────────────────────────
program
  .command('branch <description>')
  .description('根据任务描述 AI 生成分支名并创建')
  .option('-n, --no-create', '只生成分支名，不实际创建')
  .action(async (description, options) => {
    try { await branchCommand(description, options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

// ─── config ───────────────────────────────────────────────────────────────────
const configCmd = program
  .command('config')
  .description('管理 gat-cli 配置');

configCmd
  .command('set')
  .description('设置配置项（不带参数则进入交互式向导）')
  .option('--provider <name>', '设置 AI 提供商 (deepseek | glm | openai)')
  .option('--api-key <key>', '设置 API Key')
  .option('--model <model>', '设置模型名称')
  .option('--base-url <url>', '设置 API Base URL（自定义中转地址）')
  .option('--language <lang>', '设置 commit message 语言 (zh | en)')
  .option('--style <style>', '设置 commit message 风格 (conventional | simple)')
  .option('--auto-push <bool>', '设置是否自动 push (true | false)')
  .action(async (options) => {
    try { await configSet(options); }
    catch (err) { console.error(chalk.red(`\n错误: ${err.message}`)); process.exit(1); }
  });

configCmd
  .command('get')
  .description('查看当前配置')
  .action(() => configGet());

// ─── 全局帮助补充 ──────────────────────────────────────────────────────────────
program.addHelpText('after', `
命令速查：
  commit      AI 生成 message 并提交
  review      提交前 AI 代码审查
  log         生成版本 Changelog
  explain     解释最近的代码变更
  merge-msg   生成 Pull Request 描述
  fix         AI 辅助解决 merge conflict
  branch      根据任务描述生成并创建分支
  config      配置 AI 提供商和参数

示例：
  $ gat commit -a -p
  $ gat review -a
  $ gat log --version 1.2.0 -o CHANGELOG.md
  $ gat explain HEAD~5
  $ gat merge-msg
  $ gat fix
  $ gat branch "修复购物车数量显示错误"
  $ gat config set --provider deepseek --api-key sk-xxx
`);

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
