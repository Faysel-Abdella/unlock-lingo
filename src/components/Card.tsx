import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  tone?: 'surface' | 'muted' | 'accent';
  accessibilityLabel?: string;
}

/** Flat surface with a hairline outline (Swiss style: no shadows). */
export function Card({ children, onPress, style, tone = 'surface', accessibilityLabel }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const background = tone === 'muted' ? colors.surfaceMuted : tone === 'accent' ? colors.accentSoft : colors.surface;
  const base: ViewStyle = {
    backgroundColor: background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: tone === 'surface' ? 1 : 0,
    borderColor: colors.border,
    gap: spacing.sm,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [base, { opacity: pressed ? 0.88 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
