import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** Selectable chip. Selection shows a check mark as well as colour. */
export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  const { colors, radius, spacing, touchTarget } = useTheme();
  const height = 40;
  const slop = (touchTarget - height) / 2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      hitSlop={{ top: slop, bottom: slop }}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => ({
        minHeight: height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        overflow: 'hidden',
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
      <Text variant="captionStrong" style={{ color: selected ? colors.accent : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}
