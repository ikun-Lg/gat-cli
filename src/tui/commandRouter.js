'use strict';

/**
 * 解析斜杠命令输入
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

    case 'log': {
      const fromIdx = args.indexOf('--from');
      const from = fromIdx !== -1 ? args[fromIdx + 1] : undefined;
      const toIdx = args.indexOf('--to');
      const to = toIdx !== -1 ? args[toIdx + 1] : 'HEAD';
      const verIdx = args.indexOf('--version');
      const version = verIdx !== -1 ? args[verIdx + 1] : 'Unreleased';
      const oIdx = args.indexOf('-o');
      const output = oIdx !== -1 ? args[oIdx + 1] : undefined;
      return { type: 'log', from, to, version, output };
    }

    case 'explain': {
      // 第一个非 flag 参数为 range
      const range = args.find((a) => !a.startsWith('-')) || undefined;
      return { type: 'explain', range };
    }

    case 'merge-msg':
    case 'mergemsg': {
      const bIdx = args.indexOf('-b');
      const base = bIdx !== -1 ? args[bIdx + 1] : undefined;
      return { type: 'merge-msg', base };
    }

    case 'config': {
      const sub = args[0];
      if (sub === 'set') {
        const key = args[1];
        const value = args.slice(2).join(' ');
        return { type: 'config', action: 'set', key, value };
      }
      return { type: 'config', action: 'show' };
    }

    case 'history': {
      const nIdx = args.indexOf('-n');
      const n = nIdx !== -1 && args[nIdx + 1] ? parseInt(args[nIdx + 1]) || 10 : 10;
      return { type: 'history', n };
    }

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

const HELP_TEXT = `可用命令：
  /commit [-a] [-n <数量>] [-p]         AI 生成 commit message
                                         -a 自动 stage 所有变更
                                         -n <数量> 生成多条备选（默认1条）
                                         -p 提交后自动 push
  /review [-a]                           AI 审查代码变更
  /branch <任务描述>                     AI 生成分支名并可选创建
  /fix                                   AI 分析合并冲突并给出建议
  /log [--from <ref>] [--to <ref>]       AI 生成 Changelog
       [--version <ver>] [-o <file>]     -o 保存到文件
  /explain [range]                       AI 解释 commit 变更（默认最近5条）
  /merge-msg [-b <base>]                 AI 生成 PR 描述
  /config                                查看当前配置
  /config set <key> <value>              修改配置项（即时生效）
  /history [-n <数量>]                   查看最近生成的 commit message 历史
  /help                                  显示此帮助
  /quit                                  退出 gat TUI

配置示例：
  /config set provider deepseek
  /config set providers.deepseek.apiKey sk-xxx
  /config set commit.language en
  /config set ai.temperature 0.5`;

/** 用于自动补全的命令列表（带参数说明） */
const COMMAND_DEFS = [
  { name: '/commit',    args: '[-a] [-n <N>] [-p]',                 desc: 'AI 生成 commit message' },
  { name: '/review',   args: '[-a]',                               desc: 'AI 审查代码变更' },
  { name: '/branch',   args: '<任务描述>',                          desc: 'AI 生成分支名' },
  { name: '/fix',      args: '',                                    desc: 'AI 分析合并冲突' },
  { name: '/log',      args: '[--from <ref>] [-o <file>]',         desc: '生成 Changelog' },
  { name: '/explain',  args: '[range]',                            desc: 'AI 解释 commit 变更' },
  { name: '/merge-msg',args: '[-b <base>]',                        desc: 'AI 生成 PR 描述' },
  { name: '/config',   args: '[set <key> <value>]',                desc: '查看/修改配置' },
  { name: '/history',  args: '[-n <数量>]',                        desc: '查看 commit message 历史' },
  { name: '/help',     args: '',                                    desc: '显示帮助' },
  { name: '/quit',     args: '',                                    desc: '退出 TUI' },
];

module.exports = { parseCommand, HELP_TEXT, COMMAND_DEFS };
