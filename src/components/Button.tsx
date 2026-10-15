import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  size = 'lg',
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius, spacing, touchTarget, iconSize } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  };
  const p = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [
        {
          minHeight: size === 'lg' ? 56 : touchTarget,
          borderRadius: radius.md,
          backgroundColor: p.bg,
          borderWidth: 1,
          borderColor: p.border,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: inactive ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon ? (
            <Ionicons name={icon} size={iconSize.sm} color={p.fg} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
          <Text variant="button" style={{ color: p.fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
