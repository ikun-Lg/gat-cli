import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

const COMMANDS = [
  { name: '/commit',  args: '[-a] [-n <N>] [-p]', desc: 'AI 生成 commit message' },
  { name: '/review',  args: '[-a]',                desc: 'AI 审查代码变更' },
  { name: '/branch',  args: '<任务描述>',           desc: 'AI 生成分支名并可选创建' },
  { name: '/config',  args: '',                    desc: '查看当前配置' },
  { name: '/help',    args: '',                    desc: '显示帮助' },
  { name: '/quit',    args: '',                    desc: '退出 TUI' },
];

export function InputBar({ value, onChange, onSubmit, disabled = false }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // 仅当输入以 / 开头且还没有输入空格（尚未进入参数区）时才展示候选列表
  const firstWord = value.includes(' ') ? null : value.toLowerCase();

  const suggestions = useMemo(() => {
    if (!firstWord || !firstWord.startsWith('/')) return [];
    return COMMANDS.filter((cmd) => cmd.name.startsWith(firstWord));
  }, [firstWord]);

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
      // 有参数：填入命令 + 空格，等用户继续输入参数（列表会因为空格消失）
      onChange(cmd.name + ' ');
    } else {
      // 无参数：直接执行
      onChange('');
      onSubmit(cmd.name);
    }
  }, [suggestions, onChange, onSubmit]);

  useInput((_char, key) => {
    if (!showPopup) return;

    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (key.tab || key.return) {
      complete(selectedIndex);
    } else if (key.escape) {
      setDismissed(true);
    }
  }, { isActive: !disabled });

  // Enter 时：如果弹出层可见则补全而非提交（onSubmit 由 complete 在无参命令时调用）
  const handleSubmit = useCallback((val) => {
    if (showPopup) {
      complete(selectedIndex);
      return;
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
