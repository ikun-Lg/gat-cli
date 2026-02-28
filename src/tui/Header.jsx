import React from 'react';
import { Box, Text } from 'ink';

export function Header({ branch, staged, unstaged, isRepo }) {
  if (!isRepo) {
    return (
      <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
        <Text color="red">✗ 非 git 仓库</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1} gap={2}>
      <Text color="green" bold>
        gat
      </Text>
      <Text dimColor>│</Text>
      <Text>
        <Text color="magenta">⎇ </Text>
        <Text bold>{branch || '(无分支)'}</Text>
      </Text>
      {staged > 0 && (
        <>
          <Text dimColor>│</Text>
          <Text color="yellow">● staged: {staged}</Text>
        </>
      )}
      {unstaged > 0 && (
        <>
          <Text dimColor>│</Text>
          <Text color="red">○ unstaged: {unstaged}</Text>
        </>
      )}
      {staged === 0 && unstaged === 0 && (
        <>
          <Text dimColor>│</Text>
          <Text color="green">✓ clean</Text>
        </>
      )}
    </Box>
  );
}
