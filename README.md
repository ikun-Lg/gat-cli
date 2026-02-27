# gat-cli

> AI 驱动的 Git 提交工具，自动生成 commit message，告别手写提交信息。

支持 DeepSeek、智谱 GLM、OpenAI 等多种 AI 提供商。

## 安装

```bash
npm install -g gat-cli
```

## 快速开始

**1. 配置 AI 提供商**

```bash
gat config set
```

按照交互式向导选择提供商并填入 API Key 即可。

**2. 提交代码**

```bash
gat commit -a
```

gat 会自动分析你的代码变更，调用 AI 生成 commit message，确认后完成提交。

---

## 命令

### `gat commit`

使用 AI 生成 commit message 并提交代码。

```bash
gat commit [options]
```

| 选项 | 说明 |
|------|------|
| `-a, --all` | 自动执行 `git add .` 后再提交 |
| `-p, --push` | 提交后自动 push 到远端 |
| `-y, --yes` | 跳过确认，直接使用生成的 message 提交 |
| `-m, --message <msg>` | 直接指定 message（跳过 AI 生成） |

**交互式确认界面：**

```
变更摘要:
 src/auth.js | 42 ++++++++++++++

生成的 Commit Message:
  feat(auth): 添加用户登录和 JWT 鉴权功能

? 如何处理这条 commit message?
❯ ✓ 使用此 message 提交
  ✎ 编辑后提交
  ↺ 重新生成
  ✗ 取消
```

---

### `gat config set`

设置配置项。不带任何参数时进入交互式配置向导。

```bash
gat config set [options]
```

| 选项 | 说明 |
|------|------|
| `--provider <name>` | 设置 AI 提供商：`deepseek` \| `glm` \| `openai` |
| `--api-key <key>` | 设置当前提供商的 API Key |
| `--model <model>` | 设置模型名称 |
| `--base-url <url>` | 设置自定义 API 地址（支持中转服务） |
| `--language <lang>` | commit message 语言：`zh` \| `en` |
| `--style <style>` | commit message 风格：`conventional` \| `simple` |
| `--auto-push <bool>` | 提交后自动 push：`true` \| `false` |

### `gat config get`

查看当前所有配置。

```bash
gat config get
```

---

## 支持的 AI 提供商

| 提供商 | 默认模型 | API 地址 | 申请地址 |
|--------|---------|----------|---------|
| `deepseek` | deepseek-chat | https://api.deepseek.com | [platform.deepseek.com](https://platform.deepseek.com) |
| `glm` | glm-4-flash | https://open.bigmodel.cn/api/paas/v4 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| `openai` | gpt-4o-mini | https://api.openai.com/v1 | [platform.openai.com](https://platform.openai.com) |

所有兼容 OpenAI 接口格式的服务均可通过 `--base-url` 配置使用。

---

## 配置示例

```bash
# 使用 DeepSeek（推荐，性价比高）
gat config set --provider deepseek --api-key sk-xxxx

# 使用智谱 GLM（glm-4-flash 免费额度）
gat config set --provider glm --api-key xxxx.yyyy

# 使用自定义中转地址
gat config set --provider openai --api-key sk-xxxx --base-url https://your-proxy.com/v1

# 切换为英文 commit message
gat config set --language en

# 提交后自动 push
gat config set --auto-push true
```

## 使用示例

```bash
# 标准流程：stage 所有变更，AI 生成 message，交互确认后提交
gat commit -a

# 一键完成：stage + 提交 + push，跳过确认
gat commit -a -p -y

# 只提交已 staged 的内容
git add src/
gat commit

# 提交后自动 push
gat commit -a --push
```

## commit message 风格

**Conventional Commits（默认）**

```
feat(user): 新增用户注册功能
fix(api): 修复分页查询参数错误
refactor: 提取公共请求拦截器
docs: 更新接口文档
```

**Simple（简单描述）**

```
新增用户注册功能
修复分页查询参数错误
```

## 配置文件

配置保存在 `~/.gat-cli/config.json`，可以直接编辑。

```json
{
  "provider": "deepseek",
  "providers": {
    "deepseek": {
      "apiKey": "sk-xxxx",
      "baseUrl": "https://api.deepseek.com",
      "model": "deepseek-chat"
    },
    "glm": {
      "apiKey": "",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "model": "glm-4-flash"
    }
  },
  "commit": {
    "language": "zh",
    "style": "conventional",
    "autoPush": false,
    "autoStage": false
  }
}
```

## License

ISC
