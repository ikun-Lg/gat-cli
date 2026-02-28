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

/**
 * 读取项目根目录下的 .gatignore，返回排除模式数组
 */
function readGatIgnore(cwd) {
  const ignorePath = path.join(cwd || process.cwd(), '.gatignore');
  try {
    const content = fs.readFileSync(ignorePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

/**
 * 简单通配符匹配（支持 * 和 ** 前缀）
 */
function matchIgnorePattern(filename, pattern) {
  // 精确匹配
  if (filename === pattern) return true;
  // 扩展名通配符：*.lock → 任意路径下 .lock 结尾
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return filename.endsWith(ext);
  }
  // 目录通配：dist/ 或 dist/**
  const dir = pattern.replace(/\/\*\*$/, '').replace(/\/$/, '');
  if (dir !== pattern || pattern.endsWith('/')) {
    return filename === dir || filename.startsWith(dir + '/');
  }
  // 无路径分隔符时匹配文件名（basename）
  if (!pattern.includes('/') && !pattern.includes('*')) {
    return filename.split('/').pop() === pattern;
  }
  return false;
}

/**
 * 从 diff 文本中按文件过滤掉 .gatignore 匹配的部分
 */
function applyGatIgnore(diff, ignorePatterns) {
  if (!ignorePatterns.length || !diff) return diff;
  const sections = diff.split(/(?=^diff --git )/m);
  const filtered = sections.filter((section) => {
    if (!section.startsWith('diff --git')) return true;
    const m = section.match(/^diff --git a\/(.*?) b\//);
    if (!m) return true;
    const filename = m[1];
    return !ignorePatterns.some((p) => matchIgnorePattern(filename, p));
  });
  return filtered.join('');
}

async function getStagedDiff(cwd) {
  const git = getGit(cwd);
  const ignorePatterns = readGatIgnore(cwd);

  const stat = await git.diff(['--cached', '--stat', '--diff-algorithm=minimal']);
  const rawContent = await git.diff(['--cached', '--diff-algorithm=minimal']);
  const content = applyGatIgnore(rawContent, ignorePatterns);
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
  const git = getGit(cwd);
  try {
    return await git.push();
  } catch (err) {
    // 新分支没有 upstream 时自动设置
    const msg = err.message || '';
    if (
      msg.includes('no tracking information') ||
      msg.includes('has no upstream') ||
      (msg.includes('The current branch') && msg.includes('no upstream'))
    ) {
      const status = await git.status();
      const branch = status.current;
      return await git.push(['--set-upstream', 'origin', branch]);
    }
    throw err;
  }
}

async function getCurrentBranch(cwd) {
  const status = await getGit(cwd).status();
  return status.current;
}

/**
 * 获取两个 ref 之间的 commit 日志
 */
async function getLog(from, to = 'HEAD', cwd) {
  const git = getGit(cwd);
  const range = from ? `${from}..${to}` : to;
  const result = await git.log([range, '--no-merges']);
  return result.all;
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
    const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return result.trim().replace('refs/remotes/origin/', '');
  } catch {
    const branches = await git.branchLocal();
    return branches.all.includes('main') ? 'main' : 'master';
  }
}

/**
 * 获取有合并冲突的文件列表
 */
async function getConflictFiles(cwd) {
  const status = await getGit(cwd).status();
  return status.conflicted;
}

/**
 * 读取冲突文件内容（保留冲突标记）
 */
async function getConflictContent(filename, cwd) {
  const filePath = path.resolve(cwd || process.cwd(), filename);
  return fs.promises.readFile(filePath, 'utf-8');
}

/**
 * 将解决后的内容写回文件并 stage
 */
async function resolveConflict(filename, resolvedContent, cwd) {
  const filePath = path.resolve(cwd || process.cwd(), filename);
  await fs.promises.writeFile(filePath, resolvedContent, 'utf-8');
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
