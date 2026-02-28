'use strict';

/**
 * 解析斜杠命令输入
 * 支持: /commit [-a] [-n <num>], /review [-a], /branch <desc>, /fix, /log, /explain, /merge-msg, /config, /help, /quit
 */
function parseCommand(input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { type: 'unknown', raw: input };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'commit': {
      const autoStage = args.includes('-a');
      const nIdx = args.indexOf('-n');
      const count = nIdx !== -1 && args[nIdx + 1] ? parseInt(args[nIdx + 1]) || 1 : 1;
      const pushAfter = args.includes('-p');
      return { type: 'commit', autoStage, count, pushAfter };
    }

    case 'review': {
      const all = args.includes('-a');
      return { type: 'review', all };
    }

    case 'branch': {
      const description = args.join(' ');
      return { type: 'branch', description };
    }

    case 'fix':
      return { type: 'fix' };

    case 'log':
      return { type: 'log' };

    case 'explain':
      return { type: 'explain' };

    case 'merge-msg':
    case 'mergemsg':
      return { type: 'merge-msg' };

    case 'config':
      return { type: 'config' };

    case 'help':
      return { type: 'help' };

    case 'quit':
    case 'exit':
    case 'q':
      return { type: 'quit' };

    default:
      return { type: 'unknown', cmd, raw: input };
  }
}

const HELP_TEXT = `TUI 命令：
  /commit [-a] [-n <数量>] [-p]  — AI 生成 commit message
                                    -a 自动 stage 所有变更
                                    -n <数量> 生成多条备选（默认1条）
                                    -p 提交后自动 push
  /review [-a]                   — AI 审查代码（默认仅 staged 变更，-a 审查全部）
  /branch <任务描述>             — AI 生成分支名并可选创建
  /config                        — 查看当前 provider / model / key 等配置
  /help                          — 显示此帮助
  /quit                          — 退出 gat TUI

CLI 专用命令（gat <命令>）：
  gat fix          — AI 分析并修复最近一次错误
  gat log          — AI 解读 git log 提交历史
  gat explain      — AI 解释当前代码变更
  gat merge-msg    — AI 生成 merge commit message`;

module.exports = { parseCommand, HELP_TEXT };
