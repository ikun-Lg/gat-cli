import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export function InputBar({ value, onChange, onSubmit, disabled = false }) {
  return (
    <Box borderStyle="single" borderColor={disabled ? 'gray' : 'white'} paddingX={1}>
      <Text color="cyan" bold>
        ❯{' '}
      </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={disabled ? '处理中...' : '输入 /help 查看命令'}
        focus={!disabled}
      />
    </Box>
  );
}
