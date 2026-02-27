'use strict';

const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

function getGit(cwd = process.cwd()) {
  return simpleGit(cwd);
}

async function checkIsRepo(cwd) {
  try {
    await getGit(cwd).status();
    return true;
  } catch {
    return false;
  }
}

async function getStagedDiff(cwd) {
  const git = getGit(cwd);
  const stat = await git.diff(['--cached', '--stat', '--diff-algorithm=minimal']);
  const content = await git.diff(['--cached', '--diff-algorithm=minimal']);
  return { stat, content };
}

async function getStatus(cwd) {
  return getGit(cwd).status();
}

async function stageAll(cwd) {
  await getGit(cwd).add('.');
}

async function commit(message, cwd) {
  return getGit(cwd).commit(message);
}

async function push(cwd) {
  return getGit(cwd).push();
}

async function getCurrentBranch(cwd) {
  const status = await getGit(cwd).status();
  return status.current;
}

/**
 * 获取两个 ref 之间的 commit 日志
 * @param {string} from  起始 ref（不含），如 'v1.0.0' 或 'HEAD~10'
 * @param {string} to    结束 ref（含），默认 HEAD
 */
async function getLog(from, to = 'HEAD', cwd) {
  const git = getGit(cwd);
  const range = from ? `${from}..${to}` : to;
  const result = await git.log([range, '--no-merges']);
  return result.all; // Array<{ hash, date, message, author_name, body }>
}

/**
 * 获取所有 tag，按版本倒序
 */
async function getTags(cwd) {
  const git = getGit(cwd);
  const result = await git.tags(['--sort=-version:refname']);
  return result.all;
}

/**
 * 获取当前分支相对于 baseBranch 的 diff
 */
async function getDiffFromBase(baseBranch, cwd) {
  const git = getGit(cwd);
  const mergeBase = await git.raw(['merge-base', 'HEAD', baseBranch]);
  const base = mergeBase.trim();
  const stat = await git.diff([`${base}...HEAD`, '--stat']);
  const content = await git.diff([`${base}...HEAD`]);
  return { stat, content };
}

/**
 * 获取当前分支相对于 baseBranch 的 commit 日志
 */
async function getLogFromBase(baseBranch, cwd) {
  const git = getGit(cwd);
  const mergeBase = await git.raw(['merge-base', 'HEAD', baseBranch]);
  const base = mergeBase.trim();
  const result = await git.log([`${base}..HEAD`, '--no-merges']);
  return result.all;
}

/**
 * 获取默认主分支名（main 或 master）
 */
async function getDefaultBranch(cwd) {
  const git = getGit(cwd);
  try {
    // 尝试从远端获取
    const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return result.trim().replace('refs/remotes/origin/', '');
  } catch {
    // 本地判断
    const branches = await git.branchLocal();
    return branches.all.includes('main') ? 'main' : 'master';
  }
}

/**
 * 获取有合并冲突的文件列表
 */
async function getConflictFiles(cwd) {
  const status = await getGit(cwd).status();
  return status.conflicted; // string[]
}

/**
 * 读取冲突文件内容（保留冲突标记）
 */
function getConflictContent(filename, cwd) {
  const filePath = path.resolve(cwd || process.cwd(), filename);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 将解决后的内容写回文件并 stage
 */
async function resolveConflict(filename, resolvedContent, cwd) {
  const filePath = path.resolve(cwd || process.cwd(), filename);
  fs.writeFileSync(filePath, resolvedContent, 'utf-8');
  await getGit(cwd).add(filename);
}

/**
 * 创建并切换到新分支
 */
async function createBranch(branchName, cwd) {
  await getGit(cwd).checkoutLocalBranch(branchName);
}

/**
 * 切换到已有分支
 */
async function checkout(branchName, cwd) {
  await getGit(cwd).checkout(branchName);
}

module.exports = {
  checkIsRepo,
  getStagedDiff,
  getStatus,
  stageAll,
  commit,
  push,
  getCurrentBranch,
  getLog,
  getTags,
  getDiffFromBase,
  getLogFromBase,
  getDefaultBranch,
  getConflictFiles,
  getConflictContent,
  resolveConflict,
  createBranch,
  checkout,
};
