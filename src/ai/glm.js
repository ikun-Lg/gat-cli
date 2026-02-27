'use strict';

const axios = require('axios');

async function generateCommitMessage(diff, config, language, style) {
  const { apiKey, baseUrl, model } = config;

  const systemPrompt = buildSystemPrompt(language, style);
  const userPrompt = `以下是这次代码变更的 git diff，请根据这些变更生成一条合适的 commit message：\n\n${diff}`;

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content.trim();
}

function buildSystemPrompt(language, style) {
  const langInstruction =
    language === 'zh'
      ? 'description 部分使用中文，type/scope 保持英文小写'
      : 'Write the entire message in English';

  if (style !== 'conventional') {
    return `你是一个专业的 Git commit message 生成助手。根据提供的 git diff 内容，生成一条简洁准确的 commit message。
规则：
1. 只输出一行纯文本 commit message，不要有任何额外内容
2. ${langInstruction}
3. 简洁描述实际变更，不超过 72 个字符`;
  }

  return `你是一个专业的 Git commit message 生成助手，严格遵循 Conventional Commits 1.0.0 规范。

## 格式
<type>(<scope>): <description>

## type 选择规则（必须从以下选择，不可自造）
- feat     新增功能
- fix      修复 bug
- docs     仅文档变更
- style    不影响逻辑的格式变更（空格、分号、缩进等）
- refactor 既不修 bug 也不加功能的代码重构
- perf     性能优化
- test     新增或修改测试
- chore    构建过程、辅助工具、依赖更新等杂项
- ci       CI/CD 配置变更
- build    影响构建系统或外部依赖的变更
- revert   回退某次提交

## scope 推断规则
- 从变更的文件路径、模块名、功能域推断，使用小写
- 仅影响单一模块时填写，例如：auth、user、api、db、ui
- 跨多个不相关模块时省略 scope
- scope 用英文，不用中文

## description 规则
- ${langInstruction}
- 使用祈使句，描述"做了什么"而非"修改了哪个文件"
- 首字母不大写（英文时），结尾不加句号
- 不超过 72 个字符（含 type 和 scope）

## Breaking Change
- 如果变更包含破坏性改动（删除接口、修改函数签名等），在 type 后加 !，例如：feat(api)!: 移除旧版登录接口

## 输出要求
- 只输出一行 commit message 纯文本，不要有任何解释、引号、代码块

## 示例
feat(auth): 新增 JWT 刷新令牌功能
fix(api): 修复分页参数为负数时崩溃的问题
refactor(user): 提取用户权限校验为独立中间件
perf(db): 为 orders 表 user_id 字段添加索引
chore: 升级 axios 至 1.7.9
feat(payment)!: 重构支付接口，移除旧版回调参数`;
}

module.exports = { generateCommitMessage };
