import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

/**
 * 流式文本展示：显示 text，若 streaming=true 则末尾加光标动画
 */
export function StreamingText({ text, streaming = false, color }) {
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setCursor((c) => !c), 500);
    return () => clearInterval(timer);
  }, [streaming]);

  return (
    <Text color={color}>
      {text}
      {streaming && <Text dimColor>{cursor ? '█' : ' '}</Text>}
    </Text>
  );
}
