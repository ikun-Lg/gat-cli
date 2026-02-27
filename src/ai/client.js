'use strict';

const axios = require('axios');

/**
 * 通用 OpenAI-compatible chat completion 请求
 * @param {object} providerConfig  { apiKey, baseUrl, model }
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} [extra]         额外参数，如 temperature、max_tokens
 * @returns {Promise<string>}
 */
async function chat(providerConfig, systemPrompt, userPrompt, extra = {}) {
  const { apiKey, baseUrl, model } = providerConfig;

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: extra.temperature ?? 0.3,
        max_tokens: extra.max_tokens ?? 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const message = response.data.choices?.[0]?.message;
    const content = message?.content;
    const reasoningContent = message?.reasoning_content;

    if (content && content.trim() !== '') {
      return content.trim();
    }

    const finish_reason = response.data.choices?.[0]?.finish_reason;
    // 推理模型（deepseek-reasoner 等）token 耗尽时 content 为空，reasoning_content 仅是思考过程
    // 此时应提示用户增大 max_tokens 或切换非推理模型，而非返回思考过程
    if (reasoningContent && reasoningContent.trim() !== '') {
      throw new Error(`推理模型 token 不足，未能生成最终答案（finish_reason: ${finish_reason ?? 'unknown'}）\n  请运行 gat config set --model 切换为非推理模型（如 deepseek-chat / glm-4-flash）`);
    }
    throw new Error(`AI 返回了空内容（finish_reason: ${finish_reason ?? 'unknown'}）\n  原始响应: ${JSON.stringify(response.data).slice(0, 300)}`);
  } catch (err) {
    throw toFriendlyError(err, model);
  }
}

function toFriendlyError(err, model) {
  if (!err.response) {
    // 网络层错误
    if (err.code === 'ECONNABORTED') return new Error('请求超时，请检查网络或稍后重试');
    if (err.code === 'ENOTFOUND') return new Error('无法连接到 API 服务，请检查网络');
    return err;
  }

  const status = err.response.status;
  const data = err.response.data || {};
  const apiMsg = data.error?.message || data.message || '';

  const messages = {
    400: `请求参数错误${apiMsg ? '：' + apiMsg : ''}`,
    401: 'API Key 无效或已过期，请运行 gat config set 重新配置',
    403: `无权访问模型 ${model}，可能需要开通对应套餐`,
    429: `请求频率超限或余额不足（模型：${model}）\n  · 免费模型可尝试：glm-4.7-flash / glm-4.5-flash\n  · 或运行 gat config set 切换模型`,
    500: 'AI 服务内部错误，请稍后重试',
    503: 'AI 服务暂时不可用，请稍后重试',
  };

  const msg = messages[status] || `请求失败（HTTP ${status}）${apiMsg ? '：' + apiMsg : ''}`;
  return new Error(msg);
}

module.exports = { chat };
