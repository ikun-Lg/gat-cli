'use strict';

const git = require('../git');
const ai = require('../ai');
const configManager = require('../config');

/**
 * 生成分支名
 * @returns {Promise<string>} 分支名
 */
async function generateBranch(description, cwd) {
  if (!description || !description.trim()) {
    throw new Error('请提供任务描述，例如：/branch 修复用户登录闪退');
  }

  const isRepo = await git.checkIsRepo(cwd);
  if (!isRepo) throw new Error('当前目录不是 git 仓库');

  const config = configManager.load();
  const raw = await ai.generateBranchName(description, config);
  const branchName = raw.replace(/['"` \n]/g, '').split('\n')[0].trim();
  return branchName;
}

/**
 * 创建并切换到分支
 */
async function createAndCheckout(branchName, cwd) {
  await git.createBranch(branchName, cwd);
  return branchName;
}

module.exports = { generateBranch, createAndCheckout };
