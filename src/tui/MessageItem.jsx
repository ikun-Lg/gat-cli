import React from 'react';
import { Box, Text } from 'ink';
import { StreamingText } from './StreamingText.jsx';

export function MessageItem({ message }) {
  const { role, content, streaming } = message;

  if (role === 'system') {
    return (
      <Box marginBottom={1}>
        <Text dimColor>{content}</Text>
      </Box>
    );
  }

  if (role === 'error') {
    return (
      <Box marginBottom={1}>
        <Text color="red">✗ {content}</Text>
      </Box>
    );
  }

  if (role === 'user') {
    return (
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          ❯{' '}
        </Text>
        <Text>{content}</Text>
      </Box>
    );
  }

  // assistant
  return (
    <Box marginBottom={1} flexDirection="column">
      <StreamingText text={content} streaming={!!streaming} />
    </Box>
  );
}
