'use strict';

const axios = require('axios');

/**
 * 流式 SSE chat completion 请求
 * @param {object} providerConfig  { apiKey, baseUrl, model }
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts
 * @param {function} opts.onChunk  (delta: string) => void
 * @param {function} opts.onDone   (fullText: string) => void
 * @param {AbortController} [opts.signal]
 * @param {number} [opts.maxTokens]
 */
async function streamChat(providerConfig, systemPrompt, userPrompt, opts = {}) {
  const { apiKey, baseUrl, model } = providerConfig;
  const { onChunk, onDone, signal, maxTokens = 6000 } = opts;

  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      responseType: 'stream',
      timeout: 120000,
      signal: signal?.signal || signal,
    }
  );

  return new Promise((resolve, reject) => {
    let fullText = '';
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完成的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk && onChunk(delta);
          }
        } catch {
          // 忽略非 JSON 行
        }
      }
    });

    response.data.on('end', () => {
      onDone && onDone(fullText);
      resolve(fullText);
    });

    response.data.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { streamChat };
