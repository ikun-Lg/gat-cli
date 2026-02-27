'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const configManager = require('../config');

const SUPPORTED_PROVIDERS = ['deepseek', 'glm', 'openai'];

/**
 * gat config set [options]
 */
async function configSet(options) {
  const config = configManager.load();

  // 交互式配置（未提供参数时）
  if (!options.provider && !options.apiKey && !options.model && !options.language && !options.style) {
    await interactiveConfig(config);
    return;
  }

  if (options.provider) {
    if (!SUPPORTED_PROVIDERS.includes(options.provider)) {
      console.error(chalk.red(`不支持的提供商: ${options.provider}`));
      console.error(chalk.gray(`支持的提供商: ${SUPPORTED_PROVIDERS.join(', ')}`));
      process.exit(1);
    }
    config.provider = options.provider;
    console.log(chalk.green(`✓ 已设置 AI 提供商为: ${options.provider}`));
  }

  if (options.apiKey) {
    const provider = options.provider || config.provider;
    if (!config.providers[provider]) {
      console.error(chalk.red(`未知提供商: ${provider}`));
      process.exit(1);
    }
    config.providers[provider].apiKey = options.apiKey;
    console.log(chalk.green(`✓ 已设置 ${provider} 的 API Key`));
  }

  if (options.model) {
    const provider = options.provider || config.provider;
    config.providers[provider].model = options.model;
    console.log(chalk.green(`✓ 已设置 ${provider} 的模型为: ${options.model}`));
  }

  if (options.baseUrl) {
    const provider = options.provider || config.provider;
    config.providers[provider].baseUrl = options.baseUrl;
    console.log(chalk.green(`✓ 已设置 ${provider} 的 baseUrl 为: ${options.baseUrl}`));
  }

  if (options.language) {
    if (!['zh', 'en'].includes(options.language)) {
      console.error(chalk.red('language 只支持 zh 或 en'));
      process.exit(1);
    }
    config.commit.language = options.language;
    console.log(chalk.green(`✓ 已设置 commit message 语言为: ${options.language}`));
  }

  if (options.style) {
    if (!['conventional', 'simple'].includes(options.style)) {
      console.error(chalk.red('style 只支持 conventional 或 simple'));
      process.exit(1);
    }
    config.commit.style = options.style;
    console.log(chalk.green(`✓ 已设置 commit message 风格为: ${options.style}`));
  }

  if (options.autoPush !== undefined) {
    config.commit.autoPush = options.autoPush === 'true' || options.autoPush === true;
    console.log(chalk.green(`✓ 已设置 autoPush: ${config.commit.autoPush}`));
  }

  configManager.save(config);
}

/**
 * gat config get
 */
function configGet() {
  const config = configManager.load();
  const filePath = configManager.getConfigFilePath();

  console.log(chalk.bold('\n当前配置：'));
  console.log(chalk.gray(`配置文件: ${filePath}\n`));

  console.log(chalk.cyan('AI 提供商:'), chalk.white(config.provider));
  console.log('');

  for (const [name, pc] of Object.entries(config.providers)) {
    const isActive = name === config.provider;
    const label = isActive ? chalk.green(`● ${name} (当前)`) : chalk.gray(`○ ${name}`);
    console.log(label);
    console.log(`  model   : ${pc.model}`);
    console.log(`  baseUrl : ${pc.baseUrl}`);
    console.log(`  apiKey  : ${pc.apiKey ? chalk.green('已配置 ✓') : chalk.red('未配置 ✗')}`);
    console.log('');
  }

  console.log(chalk.cyan('Commit 配置:'));
  console.log(`  language : ${config.commit.language} (${config.commit.language === 'zh' ? '中文' : '英文'})`);
  console.log(`  style    : ${config.commit.style}`);
  console.log(`  autoPush : ${config.commit.autoPush}`);
  console.log(`  autoStage: ${config.commit.autoStage}`);
  console.log('');
}

async function interactiveConfig(config) {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '选择 AI 提供商:',
      choices: SUPPORTED_PROVIDERS,
      default: config.provider,
    },
    {
      type: 'password',
      name: 'apiKey',
      message: (ans) => `输入 ${ans.provider} 的 API Key (留空保持不变):`,
      mask: '*',
    },
    {
      type: 'list',
      name: 'language',
      message: 'Commit message 语言:',
      choices: [
        { name: '中文', value: 'zh' },
        { name: 'English', value: 'en' },
      ],
      default: config.commit.language,
    },
    {
      type: 'list',
      name: 'style',
      message: 'Commit message 风格:',
      choices: [
        { name: 'Conventional Commits (feat: xxx)', value: 'conventional' },
        { name: '简单描述', value: 'simple' },
      ],
      default: config.commit.style,
    },
    {
      type: 'confirm',
      name: 'autoPush',
      message: '提交后自动 push?',
      default: config.commit.autoPush,
    },
  ]);

  config.provider = answers.provider;
  if (answers.apiKey) {
    config.providers[answers.provider].apiKey = answers.apiKey;
  }
  config.commit.language = answers.language;
  config.commit.style = answers.style;
  config.commit.autoPush = answers.autoPush;

  configManager.save(config);
  console.log(chalk.green('\n✓ 配置已保存'));
}

module.exports = { configSet, configGet };
