import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import commandRouter from './commandRouter.js';

const { COMMAND_DEFS } = commandRouter;

export function InputBar({ value, onChange, onSubmit, disabled = false }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // 命令历史（P0-2）
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // 保存用户在翻历史前正在输入的内容
  const pendingInputRef = useRef('');

  // 仅当输入以 / 开头且还没有输入空格时才展示候选列表
  const firstWord = value.includes(' ') ? null : value.toLowerCase();

  const suggestions = useMemo(() => {
    if (!firstWord || !firstWord.startsWith('/')) return [];
    return COMMAND_DEFS.filter((cmd) => cmd.name.startsWith(firstWord));
  }, [firstWord]);

  // 参数提示（P1-9）：输入了完整命令名 + 空格后显示
  const argHint = useMemo(() => {
    if (!value.includes(' ')) return null;
    const word = value.split(' ')[0].toLowerCase();
    const match = COMMAND_DEFS.find((cmd) => cmd.name === word);
    return match || null;
  }, [value]);

  // 输入字符变化时：重置 dismissed 标志并归位高亮
  useEffect(() => {
    setDismissed(false);
    setSelectedIndex(0);
  }, [firstWord]);

  const showPopup = !disabled && !dismissed && suggestions.length > 0;

  const complete = useCallback((index) => {
    const cmd = suggestions[index];
    if (!cmd) return;
    if (cmd.args) {
      onChange(cmd.name + ' ');
    } else {
      onChange('');
      onSubmit(cmd.name);
    }
  }, [suggestions, onChange, onSubmit]);

  useInput((_char, key) => {
    if (disabled) return;

    if (showPopup) {
      if (key.upArrow) {
        setSelectedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      } else if (key.tab || key.return) {
        complete(selectedIndex);
      } else if (key.escape) {
        setDismissed(true);
      }
      return;
    }

    // 历史导航（仅在无弹出层时）
    if (key.upArrow && history.length > 0) {
      if (historyIndex === -1) {
        pendingInputRef.current = value;
      }
      const newIndex = historyIndex === -1
        ? history.length - 1
        : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    } else if (key.downArrow) {
      if (historyIndex === -1) return;
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(-1);
        onChange(pendingInputRef.current);
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        onChange(history[newIndex]);
      }
    }
  }, { isActive: !disabled });

  // 当用户手动修改输入时重置历史导航
  useEffect(() => {
    if (historyIndex !== -1) {
      // 如果输入与当前历史条目不同，说明用户已手动修改
      if (value !== history[historyIndex]) {
        setHistoryIndex(-1);
      }
    }
  }, [value]);

  // Enter 时：如果弹出层可见则补全，否则提交
  const handleSubmit = useCallback((val) => {
    if (showPopup) {
      complete(selectedIndex);
      return;
    }
    const trimmed = val.trim();
    if (trimmed) {
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== trimmed);
        return [...filtered, trimmed];
      });
      setHistoryIndex(-1);
      pendingInputRef.current = '';
    }
    onSubmit(val);
  }, [showPopup, complete, selectedIndex, onSubmit]);

  return (
    <Box flexDirection="column">
      {showPopup && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          marginLeft={1}
          marginRight={1}
          paddingX={1}
        >
          {suggestions.map((cmd, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={cmd.name}>
                <Text
                  color={isSelected ? 'black' : 'cyan'}
                  backgroundColor={isSelected ? 'cyan' : undefined}
                  bold
                >{cmd.name}</Text>
                <Text
                  color={isSelected ? 'black' : undefined}
                  backgroundColor={isSelected ? 'cyan' : undefined}
                >{cmd.args ? ' ' + cmd.args : ''}</Text>
                <Text
                  color={isSelected ? 'black' : undefined}
                  backgroundColor={isSelected ? 'cyan' : undefined}
                  dimColor={!isSelected}
                >{cmd.desc ? '  ' + cmd.desc : ''}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 参数提示（P1-9）*/}
      {!showPopup && argHint && argHint.args && (
        <Box paddingLeft={2} marginBottom={0}>
          <Text dimColor>
            <Text color="cyan">{argHint.name}</Text>
            {' '}
            <Text color="yellow">{argHint.args}</Text>
            {'  '}
            {argHint.desc}
          </Text>
        </Box>
      )}

      <Box borderStyle="single" borderColor={disabled ? 'gray' : 'white'} paddingX={1}>
        <Text color="cyan" bold>❯ </Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={handleSubmit}
          placeholder={disabled ? '处理中...' : '输入 / 查看命令'}
          focus={!disabled}
        />
      </Box>
    </Box>
  );
}
