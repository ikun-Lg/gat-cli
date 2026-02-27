'use strict';

const simpleGit = require('simple-git');
const path = require('path');

function getGit(cwd = process.cwd()) {
  return simpleGit(cwd);
}

async function checkIsRepo(cwd) {
  try {
    const git = getGit(cwd);
    await git.status();
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 staged 的 diff
 */
async function getStagedDiff(cwd) {
  const git = getGit(cwd);
  const diff = await git.diff(['--cached', '--stat', '--diff-algorithm=minimal']);
  const diffContent = await git.diff(['--cached', '--diff-algorithm=minimal']);
  return { stat: diff, content: diffContent };
}

/**
 * 获取工作区所有变更的 diff（未 staged）
 */
async function getUnstagedDiff(cwd) {
  const git = getGit(cwd);
  return git.diff(['--diff-algorithm=minimal']);
}

/**
 * 获取 status
 */
async function getStatus(cwd) {
  const git = getGit(cwd);
  return git.status();
}

/**
 * Stage 所有变更
 */
async function stageAll(cwd) {
  const git = getGit(cwd);
  await git.add('.');
}

/**
 * 执行 commit
 */
async function commit(message, cwd) {
  const git = getGit(cwd);
  return git.commit(message);
}

/**
 * Push 到远端
 */
async function push(cwd) {
  const git = getGit(cwd);
  return git.push();
}

/**
 * 获取当前分支名
 */
async function getCurrentBranch(cwd) {
  const git = getGit(cwd);
  const status = await git.status();
  return status.current;
}

module.exports = {
  checkIsRepo,
  getStagedDiff,
  getUnstagedDiff,
  getStatus,
  stageAll,
  commit,
  push,
  getCurrentBranch,
};
