import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Text variant="caption" style={{ color: selected ? colors.accent : colors.textMuted, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
