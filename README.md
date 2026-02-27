# gat-cli

> AI 驱动的 Git 工作流工具，覆盖从开发到发布的完整流程。

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

## 命令概览

| 命令 | 功能 |
|------|------|
| `gat commit` | AI 生成 commit message 并提交 |
| `gat review` | 提交前 AI 代码审查，发现潜在问题 |
| `gat log` | 根据 commit 历史生成版本 Changelog |
| `gat explain` | 用自然语言解释最近的代码变更 |
| `gat merge-msg` | 生成 Pull Request 标题和描述 |
| `gat fix` | AI 辅助逐文件解决 merge conflict |
| `gat branch` | 根据任务描述生成规范分支名并创建 |
| `gat config` | 配置 AI 提供商和参数 |

---

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

---

### `gat review`

Push 前让 AI 做一轮代码审查。

```bash
gat review        # 审查已 staged 的变更
gat review -a     # 审查所有未提交变更
```

审查维度：Bug 风险、安全问题、性能问题、代码质量、最佳实践。

---

### `gat log`

根据 commit 历史自动生成结构化 Changelog。

```bash
gat log                              # 从上一个 tag 到 HEAD
gat log --version 1.2.0             # 指定版本号
gat log --from v1.0.0 --to v1.2.0  # 指定范围
gat log --version 1.2.0 -o CHANGELOG.md  # 写入文件
```

---

### `gat explain`

用自然语言解释最近的代码改动，方便向同事或 PM 同步进度。

```bash
gat explain              # 解释最近 5 次 commit
gat explain HEAD~10      # 解释最近 10 次 commit
gat explain v1.0.0..HEAD # 解释某个版本之后的所有变更
```

---

### `gat merge-msg`

在 feature 分支上运行，自动生成 PR 标题和描述，直接贴到 GitHub/GitLab。

```bash
gat merge-msg                    # 自动检测目标分支 (main/master)
gat merge-msg --base develop     # 指定目标分支
```

---

### `gat fix`

merge 冲突后运行，AI 逐文件分析冲突双方意图，给出推荐的合并方案。

```bash
gat fix
```

支持一键应用 AI 建议的解决方案，或手动编辑后继续。

---

### `gat branch`

描述任务，AI 生成符合规范的分支名并直接创建切换。

```bash
gat branch "修复购物车数量显示错误"
# → fix/cart-quantity-display

gat branch "新增用户消息通知功能"
# → feat/user-message-notification

gat branch "优化首页加载速度" --no-create
# 只生成分支名，不创建
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
