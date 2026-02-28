'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const configManager = require('../config');

/**
 * 检查当前 provider 是否配置了 API Key。
 * 若未配置，提示用户是否立即运行交互式配置向导。
 * @param {object} config  当前 config 对象
 * @returns {Promise<object>} 返回（可能更新后的）config，或直接 process.exit
 */
async function ensureApiKey(config) {
  const providerName = config.provider;
  if (config.providers[providerName]?.apiKey) return config;

  console.log(chalk.yellow(`\n⚠  ${providerName} 的 API Key 尚未配置`));
  const { doSetup } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'doSetup',
      message: '是否现在运行配置向导？',
      default: true,
    },
  ]);

  if (!doSetup) {
    console.log(chalk.gray(`请运行：gat config set --provider ${providerName} --api-key <your-key>`));
    process.exit(0);
  }

  // 延迟 require 避免循环依赖
  const { configSet } = require('../commands/config');
  await configSet({});
  return configManager.load();
}

module.exports = { ensureApiKey };
