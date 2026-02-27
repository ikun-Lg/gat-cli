'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const { commitCommand } = require('./commands/commit');
const { configSet, configGet } = require('./commands/config');

const program = new Command();

program
  .name('gat')
  .description('AI 驱动的 Git 提交工具')
  .version('1.0.0');

// ─── commit ───────────────────────────────────────────────────────────────────
program
  .command('commit')
  .description('使用 AI 生成 commit message 并提交代码')
  .option('-a, --all', '自动 stage 所有变更（git add .）')
  .option('-p, --push', '提交后自动 push 到远端')
  .option('-y, --yes', '跳过确认，直接提交')
  .option('-m, --message <msg>', '直接指定 commit message（跳过 AI 生成）')
  .action(async (options) => {
    try {
      await commitCommand(options);
    } catch (err) {
      console.error(chalk.red(`\n错误: ${err.message}`));
      process.exit(1);
    }
  });

// ─── config ───────────────────────────────────────────────────────────────────
const configCmd = program
  .command('config')
  .description('管理 gat-cli 配置');

configCmd
  .command('set')
  .description('设置配置项（不带参数则进入交互式配置）')
  .option('--provider <name>', '设置 AI 提供商 (deepseek | glm | openai)')
  .option('--api-key <key>', '设置 API Key')
  .option('--model <model>', '设置模型名称')
  .option('--base-url <url>', '设置 API Base URL（自定义中转地址）')
  .option('--language <lang>', '设置 commit message 语言 (zh | en)')
  .option('--style <style>', '设置 commit message 风格 (conventional | simple)')
  .option('--auto-push <bool>', '设置是否自动 push (true | false)')
  .action(async (options) => {
    try {
      await configSet(options);
    } catch (err) {
      console.error(chalk.red(`\n错误: ${err.message}`));
      process.exit(1);
    }
  });

configCmd
  .command('get')
  .description('查看当前配置')
  .action(() => {
    configGet();
  });

// ─── 默认提示 ─────────────────────────────────────────────────────────────────
program.addHelpText('after', `
示例:
  $ gat commit               # AI 生成 message，交互式确认后提交
  $ gat commit -a            # stage 所有变更后再提交
  $ gat commit -a -p         # stage + 提交 + push
  $ gat commit -y            # 跳过确认直接提交
  $ gat config set           # 交互式配置向导
  $ gat config set --provider deepseek --api-key sk-xxx
  $ gat config set --language en --style conventional
  $ gat config get           # 查看当前配置
`);

program.parse(process.argv);

// 没有输入子命令时显示帮助
if (process.argv.length <= 2) {
  program.help();
}
