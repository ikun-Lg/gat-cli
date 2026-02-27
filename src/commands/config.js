'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const configManager = require('../config');

const SUPPORTED_PROVIDERS = ['deepseek', 'glm', 'openai'];

// 各提供商的常用模型预设
const PROVIDER_MODELS = {
  deepseek: [
    { name: 'deepseek-chat       (通用，推荐)', value: 'deepseek-chat' },
    { name: 'deepseek-reasoner   (深度推理，R1)', value: 'deepseek-reasoner' },
    { name: '自定义...', value: '__custom__' },
  ],
  glm: [
    new inquirer.Separator('── 旗舰模型 ──'),
    { name: 'glm-5               (最新旗舰)', value: 'glm-5' },
    { name: 'glm-4.7             (高性能)', value: 'glm-4.7' },
    new inquirer.Separator('── 均衡模型 ──'),
    { name: 'glm-4.7-flashx      (快速)', value: 'glm-4.7-flashx' },
    { name: 'glm-4.5-air         (均衡)', value: 'glm-4.5-air' },
    { name: 'glm-4.5-airx        (均衡快速)', value: 'glm-4.5-airx' },
    { name: 'glm-4-long          (长上下文)', value: 'glm-4-long' },
    new inquirer.Separator('── 免费模型 ──'),
    { name: 'glm-4.7-flash       (免费)', value: 'glm-4.7-flash' },
    { name: 'glm-4.5-flash       (免费，支持推理)', value: 'glm-4.5-flash' },
    { name: 'glm-4-flash-250414  (免费)', value: 'glm-4-flash-250414' },
    new inquirer.Separator('── GLM Plan 编程模型 ──'),
    { name: 'codegeex-4          (代码生成)', value: 'codegeex-4' },
    { name: 'glm-4.6             (对话+编程)', value: 'glm-4.6' },
    new inquirer.Separator(),
    { name: '自定义...', value: '__custom__' },
  ],
  openai: [
    { name: 'gpt-4o-mini         (快速，低成本)', value: 'gpt-4o-mini' },
    { name: 'gpt-4o              (旗舰)', value: 'gpt-4o' },
    { name: 'o1-mini             (推理)', value: 'o1-mini' },
    { name: '自定义...', value: '__custom__' },
  ],
};

const GLM_BASE_URLS = {
  chat: 'https://open.bigmodel.cn/api/paas/v4',
  plan: 'https://open.bigmodel.cn/api/coding/paas/v4',
};

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
    if (provider === 'glm' && !options.baseUrl) {
      console.log(chalk.yellow(`  提示：如 baseUrl 不对请手动指定：`));
      console.log(chalk.gray(`    普通套餐：--base-url ${GLM_BASE_URLS.chat}`));
      console.log(chalk.gray(`  Coding套餐：--base-url ${GLM_BASE_URLS.plan}`));
    }
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
      name: 'model',
      message: (ans) => `选择 ${ans.provider} 的模型:`,
      choices: (ans) => PROVIDER_MODELS[ans.provider] || [{ name: '自定义...', value: '__custom__' }],
      default: (ans) => config.providers[ans.provider]?.model,
    },
    {
      type: 'input',
      name: 'customModel',
      message: '输入自定义模型名称:',
      when: (ans) => ans.model === '__custom__',
      validate: (v) => v.trim() !== '' || '模型名称不能为空',
    },
    {
      type: 'list',
      name: 'glmPlan',
      message: '你购买的是哪种 GLM 套餐？',
      when: (ans) => ans.provider === 'glm',
      choices: [
        { name: '普通套餐  (api/paas/v4)', value: 'chat' },
        { name: 'Coding 套餐  (api/coding/paas/v4)', value: 'plan' },
      ],
      default: () => {
        const cur = config.providers.glm?.baseUrl || '';
        return cur.includes('coding') ? 'plan' : 'chat';
      },
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
  const selectedModel = answers.model === '__custom__' ? answers.customModel.trim() : answers.model;
  if (selectedModel) {
    config.providers[answers.provider].model = selectedModel;
  }
  if (answers.provider === 'glm' && answers.glmPlan) {
    config.providers.glm.baseUrl = GLM_BASE_URLS[answers.glmPlan];
  }
  config.commit.language = answers.language;
  config.commit.style = answers.style;
  config.commit.autoPush = answers.autoPush;

  configManager.save(config);
  console.log(chalk.green('\n✓ 配置已保存'));
}

module.exports = { configSet, configGet };
