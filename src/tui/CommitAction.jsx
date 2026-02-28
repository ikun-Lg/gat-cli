import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';

/**
 * commit 操作面板
 * 显示生成的 message，提供 u/e/r/c 快捷键操作
 */
export function CommitAction({ message, onUse, onEdit, onRegenerate, onCancel }) {
  const { setRawMode } = useStdin();

  useEffect(() => {
    try { setRawMode(true); } catch {}
    return () => { try { setRawMode(false); } catch {} };
  }, []);

  useInput((input, key) => {
    const ch = input.toLowerCase();
    if (ch === 'u') onUse(message);
    else if (ch === 'e') onEdit(message);
    else if (ch === 'r') onRegenerate();
    else if (ch === 'c' || key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
      <Box marginBottom={1}>
        <Text bold>生成的 commit message：</Text>
      </Box>
      <Box marginBottom={1} paddingLeft={2}>
        <Text color="cyan">{message}</Text>
      </Box>
      <Box gap={3}>
        <Text>
          <Text color="green" bold>[u]</Text>
          <Text> 使用</Text>
        </Text>
        <Text>
          <Text color="yellow" bold>[e]</Text>
          <Text> 编辑</Text>
        </Text>
        <Text>
          <Text color="blue" bold>[r]</Text>
          <Text> 重新生成</Text>
        </Text>
        <Text>
          <Text color="red" bold>[c]</Text>
          <Text> 取消</Text>
        </Text>
      </Box>
    </Box>
  );
}

/**
 * 多条 message 选择面板（上下箭头 + Enter）
 */
export function CommitSelect({ messages, onSelect, onCancel }) {
  const [idx, setIdx] = useState(0);
  const { setRawMode } = useStdin();

  useEffect(() => {
    try { setRawMode(true); } catch {}
    return () => { try { setRawMode(false); } catch {} };
  }, []);

  useInput((input, key) => {
    if (key.upArrow) setIdx((i) => Math.max(0, i - 1));
    else if (key.downArrow) setIdx((i) => Math.min(messages.length - 1, i + 1));
    else if (key.return) onSelect(messages[idx]);
    else if (input.toLowerCase() === 'c' || key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
      <Box marginBottom={1}>
        <Text bold>选择一条 commit message（↑↓ 选择，Enter 确认，c 取消）：</Text>
      </Box>
      {messages.map((msg, i) => (
        <Box key={i} paddingLeft={2}>
          <Text>
            <Text color={i === idx ? 'cyan' : undefined}>{i === idx ? '❯ ' : '  '}</Text>
            <Text color={i === idx ? 'cyan' : 'white'}>{msg}</Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * branch 操作面板
 */
export function BranchAction({ branchName, onCreate, onCancel }) {
  const { setRawMode } = useStdin();

  useEffect(() => {
    try { setRawMode(true); } catch {}
    return () => { try { setRawMode(false); } catch {} };
  }, []);

  useInput((input, key) => {
    const ch = input.toLowerCase();
    if (ch === 'y') onCreate(branchName);
    else if (ch === 'n' || ch === 'c' || key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
      <Box marginBottom={1}>
        <Text bold>生成的分支名：</Text>
        <Text color="cyan"> {branchName}</Text>
      </Box>
      <Box gap={3}>
        <Text>
          <Text color="green" bold>[y]</Text>
          <Text> 创建并切换</Text>
        </Text>
        <Text>
          <Text color="red" bold>[n]</Text>
          <Text> 取消</Text>
        </Text>
      </Box>
    </Box>
  );
}
