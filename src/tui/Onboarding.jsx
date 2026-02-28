import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import configManager from '../config.js';

const PROVIDERS = [
  { key: 'deepseek', label: 'DeepSeek',   hint: 'https://platform.deepseek.com' },
  { key: 'glm',      label: 'GLM (智谱)', hint: 'https://open.bigmodel.cn' },
  { key: 'openai',   label: 'OpenAI',     hint: 'https://platform.openai.com' },
  { key: 'ollama',   label: 'Ollama (本地)', hint: '无需 API Key，输入任意字符即可' },
];

/**
 * 首次使用引导向导
 * @param {{ onComplete: () => void }} props
 */
export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);          // 0=选 provider, 1=输入 apiKey
  const [providerIdx, setProviderIdx] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedProvider = PROVIDERS[providerIdx];
  const isOllama = selectedProvider?.key === 'ollama';

  // Step 0: 方向键选 provider，Enter 确认
  useInput((input, key) => {
    if (step !== 0) return;
    if (key.upArrow) setProviderIdx((i) => (i > 0 ? i - 1 : PROVIDERS.length - 1));
    else if (key.downArrow) setProviderIdx((i) => (i < PROVIDERS.length - 1 ? i + 1 : 0));
    else if (key.return) setStep(1);
  }, { isActive: step === 0 });

  const handleApiKeySubmit = useCallback((val) => {
    const trimmed = val.trim();
    if (!trimmed && !isOllama) {
      setError('API Key 不能为空');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const prov = selectedProvider.key;
      // 设置 provider
      configManager.set('provider', prov);
      // 设置 apiKey（Ollama 可以是任意值，如 'ollama'）
      configManager.set(`providers.${prov}.apiKey`, trimmed || 'ollama');
      onComplete();
    } catch (e) {
      setError(`保存失败: ${e.message}`);
      setSaving(false);
    }
  }, [selectedProvider, isOllama, onComplete]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">欢迎使用 gat — AI-powered Git 助手</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>首次使用需要配置 AI 提供商。完成后可随时用 /config set 修改。</Text>
      </Box>

      {step === 0 && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>请选择 AI 提供商（↑↓ 选择，Enter 确认）：</Text>
          </Box>
          {PROVIDERS.map((p, i) => (
            <Box key={p.key}>
              <Text color={i === providerIdx ? 'black' : undefined}
                    backgroundColor={i === providerIdx ? 'cyan' : undefined}>
                {i === providerIdx ? '❯ ' : '  '}
                <Text bold={i === providerIdx}>{p.label}</Text>
                {'  '}
                <Text dimColor={i !== providerIdx} color={i === providerIdx ? 'black' : 'gray'}>
                  {p.hint}
                </Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {step === 1 && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>已选择: <Text bold color="cyan">{selectedProvider.label}</Text></Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>
              {isOllama ? '确认 Ollama 地址（回车使用默认 http://localhost:11434/v1）：' : `请输入 ${selectedProvider.label} API Key：`}
            </Text>
          </Box>
          <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text color="cyan" bold>❯ </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              placeholder={isOllama ? '留空使用默认地址' : '粘贴 API Key...'}
              mask={isOllama ? undefined : '*'}
            />
          </Box>
          {error ? (
            <Box marginTop={1}>
              <Text color="red">✗ {error}</Text>
            </Box>
          ) : (
            <Box marginTop={1}>
              <Text dimColor>{isOllama ? '提示：Ollama 无需 API Key，直接按 Enter 即可' : `获取 Key：${selectedProvider.hint}`}</Text>
            </Box>
          )}
          {saving && (
            <Box marginTop={1}>
              <Text color="green">✓ 配置已保存，正在进入 TUI...</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
