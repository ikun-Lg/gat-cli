# gat — AI-powered Git Assistant

[![npm version](https://img.shields.io/npm/v/gat-cli.svg)](https://www.npmjs.com/package/gat-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

`gat` 是一个 AI 驱动的 Git 辅助工具，帮助你：

- **一键生成** 符合 Conventional Commits 规范的 commit message
- **AI 代码审查**：在提交前发现潜在问题
- **冲突解决建议**：合并冲突时让 AI 给出方案
- **生成 Changelog / PR 描述**：省去手写文档的时间
- **智能分支命名**：根据任务描述生成语义化分支名

支持 **TUI 交互模式**（类 Claude Code 的 REPL）和 **CLI 子命令模式**，无需切换工具即可完成全部 Git 工作流。

---

## 安装

```bash
npm install -g gat-cli
```

**系统要求**：Node.js >= 16

---

## 快速开始

### 1. 配置 API Key

```bash
# 使用 DeepSeek（推荐，性价比高）
gat config set --provider deepseek --api-key sk-xxx

# 使用 GLM（智谱 AI，国内访问稳定）
gat config set --provider glm --api-key xxxxxxxx

# 使用 OpenAI
gat config set --provider openai --api-key sk-xxx

# 使用 Ollama（本地运行，无需 API Key）
gat config set --provider ollama
```

### 2. 进入 TUI 模式（推荐）

```bash
gat
```

首次运行如果未配置 API Key，会自动进入交互式配置向导。

### 3. 直接使用 CLI 命令

```bash
git add .
gat commit       # AI 生成 commit message
```

---

## TUI 模式

运行 `gat`（不带任何参数）进入 TUI 交互界面：

```
┌─────────────────────────────────────────────────────────┐
│ ⎇ main  ● 3 staged  ○ 2 unstaged                       │
├─────────────────────────────────────────────────────────┤
│ 欢迎使用 gat TUI！输入 /help 查看可用命令。              │
│                                                         │
│ > /commit -a                                            │
│                                                         │
│ feat(auth): 新增 JWT token 刷新机制                     │
│                                                         │
│ - 添加 refreshToken 接口，支持无感续期                  │
│ - 修复 token 过期后跳转登录页的闪烁问题                 │
│                                                         │
│ [u] 使用  [e] 编辑  [r] 重新生成  [c] 取消             │
├─────────────────────────────────────────────────────────┤
│ ❯ _                                                     │
└─────────────────────────────────────────────────────────┘
```

### TUI 命令

| 命令 | 说明 |
|------|------|
| `/commit [-a] [-n <N>] [-p]` | AI 生成 commit message（-a 自动 stage，-n 多条备选，-p 提交后 push） |
| `/review [-a]` | AI 代码审查（-a 审查全部变更） |
| `/branch <描述>` | 根据任务描述生成分支名并可选创建 |
| `/fix` | AI 分析合并冲突并给出建议 |
| `/log [--from <ref>] [-o <file>]` | 生成 Changelog（-o 保存到文件） |
| `/explain [range]` | 解释 commit 变更（默认最近 5 条） |
| `/merge-msg [-b <base>]` | 生成 PR 描述 |
| `/config` | 查看当前配置 |
| `/config set <key> <value>` | 修改配置（即时生效） |
| `/history [-n <N>]` | 查看最近生成的 commit message 历史 |
| `/help` | 显示帮助 |
| `/quit` | 退出 |

### TUI 快捷键

| 按键 | 功能 |
|------|------|
| `↑` / `↓` | 补全候选导航 / 历史命令导航 |
| `Tab` / `Enter` | 补全命令 |
| `Escape` | 关闭补全列表 |
| `Ctrl+C` | 取消当前 AI 生成 / 退出 TUI |
| `r` | 重试上次失败的命令 |

---

## CLI 命令

### `gat commit` — 生成 commit message

```bash
gat commit           # 生成单条 commit message（需要已 staged 变更）
gat commit -a        # 自动 stage 全部变更后生成
gat commit -n 3      # 生成 3 条备选，交互式选择
gat commit -a -p     # 自动 stage + 提交后自动 push
```

### `gat review` — 代码审查

```bash
gat review           # 审查 staged 变更
gat review -a        # 审查全部（staged + unstaged）变更
```

### `gat branch` — 生成分支名

```bash
gat branch "修复支付超时问题"
# → fix/payment-timeout
```

### `gat fix` — 解决合并冲突

```bash
gat fix              # 检测冲突文件，AI 给出建议，可选择应用或跳过
```

### `gat log` — 生成 Changelog

```bash
gat log                          # 从上一个 tag 到 HEAD
gat log --from v1.0.0            # 从指定 tag 开始
gat log --version 1.2.0 -o CHANGELOG.md  # 指定版本号并写入文件
```

### `gat explain` — 解释代码变更

```bash
gat explain          # 解释最近 5 次提交
gat explain HEAD~3   # 解释最近 3 次提交
gat explain v1.0.0..HEAD  # 解释版本间的变更
```

### `gat merge-msg` — 生成 PR 描述

```bash
gat merge-msg               # 自动检测目标分支（main/master）
gat merge-msg -b develop    # 指定目标分支
```

### `gat config` — 配置管理

```bash
gat config list              # 查看所有配置
gat config set --provider deepseek --api-key sk-xxx
gat config set --model deepseek-chat
gat config set --language en
gat config set --style simple    # conventional | simple
gat config set --auto-push true
```

---

## 配置项

配置文件位于 `~/.gat-cli/config.json`。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `provider` | `deepseek` | AI 提供商 |
| `providers.<name>.apiKey` | `""` | 对应 provider 的 API Key |
| `providers.<name>.model` | 见下表 | 使用的模型 |
| `providers.<name>.baseUrl` | 见下表 | API 地址 |
| `commit.language` | `zh` | commit 语言（`zh` / `en`） |
| `commit.style` | `conventional` | commit 风格（`conventional` / `simple`） |
| `commit.autoPush` | `false` | 提交后自动 push |
| `ai.temperature` | `0.3` | 生成温度（0-2，越高越有创意） |
| `ai.maxTokens` | `null` | 最大 token 数（null = 各命令默认值） |
| `prompts.commitSystem` | `null` | 自定义 commit system prompt |
| `prompts.reviewSystem` | `null` | 自定义 review system prompt |

### 在 TUI 中修改配置

```
/config set providers.deepseek.apiKey sk-xxx
/config set commit.language en
/config set ai.temperature 0.7
/config set prompts.commitSystem "你是一个 commit message 专家，用英文输出 Angular 规范的 message"
```

---

## Provider 对比

| Provider | 默认模型 | 特点 | 获取 Key |
|----------|----------|------|----------|
| **DeepSeek** | `deepseek-chat` | 性价比极高，中英文俱佳 | [platform.deepseek.com](https://platform.deepseek.com) |
| **GLM** | `glm-4.7-flash` | 国内访问稳定，有免费额度 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| **OpenAI** | `gpt-4o-mini` | 效果最佳，价格较高 | [platform.openai.com](https://platform.openai.com) |
| **Ollama** | `llama3` | 本地运行，完全免费，无需联网 | 安装 [Ollama](https://ollama.ai) |

### 使用 Ollama（本地 LLM）

```bash
# 1. 安装并启动 Ollama
brew install ollama
ollama pull llama3   # 或 ollama pull qwen2.5

# 2. 配置 gat 使用 ollama
gat config set --provider ollama --model llama3
```

### 使用其他 OpenAI 兼容 API

```bash
gat config set --provider openai --base-url https://your-api.com/v1 --api-key sk-xxx --model your-model
```

---

## .gatignore — 排除文件

在项目根目录创建 `.gatignore`，排除不需要发送给 AI 的文件（如 lock 文件、生成文件），减少 token 消耗：

```gitignore
# 依赖锁文件
*.lock
package-lock.json
yarn.lock

# 生成文件
dist/
build/
*.min.js

# 大型数据文件
*.sql
*.csv
```

---

## 自定义 Prompt 模板

通过配置覆盖内置 prompt，满足团队规范（如强制 Jira ticket 格式）：

```bash
# 在 TUI 中设置
/config set prompts.commitSystem "你是一个 commit message 专家。格式：[JIRA-123] <type>: <desc>"
```

或直接编辑 `~/.gat-cli/config.json`：

```json
{
  "prompts": {
    "commitSystem": "你是一个 commit message 专家。每条 commit 必须包含 Jira ticket 编号..."
  }
}
```

---

## commit message 历史

gat 自动保存最近 50 条已提交的 commit message 到 `~/.gat-cli/history.json`。

```bash
# 在 TUI 中查看
/history
/history -n 20
```

---

## 常见问题

**Q: API Key 报 401 错误？**
运行 `gat config set --provider <name> --api-key <new-key>` 重新配置。

**Q: 生成内容为空或报"token 不足"？**
切换为非推理模型：`gat config set --model deepseek-chat`（而非 `deepseek-reasoner`）。

**Q: 在公司内网无法连接 API？**
使用 Ollama 本地运行，或设置 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量。

**Q: commit message 总是中文，如何改英文？**
`gat config set --language en` 或 TUI 内 `/config set commit.language en`。

---

## 开发

```bash
git clone https://github.com/ikun-Lg/gat-cli.git
cd gat-cli
npm install

# 修改 src/tui/ 后需重新构建
npm run build:tui

# 本地测试
node bin/gat.js
node bin/gat.js commit -a
```

---

## License

ISC © [lggbond](https://github.com/ikun-Lg)
