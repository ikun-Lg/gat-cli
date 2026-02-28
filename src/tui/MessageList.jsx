import React from 'react';
import { Box, Static } from 'ink';
import { MessageItem } from './MessageItem.jsx';

export function MessageList({ messages }) {
  // 已完成的消息用 Static 渲染（不可变），流式消息动态渲染
  const doneMessages = messages.filter((m) => !m.streaming);
  const streamingMessages = messages.filter((m) => m.streaming);

  return (
    <Box flexDirection="column">
      <Static items={doneMessages}>
        {(msg) => <MessageItem key={msg.id} message={msg} />}
      </Static>
      {streamingMessages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </Box>
  );
}
