import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ value, height = 6 }: { value: number; height?: number }) {
  const { colors, radius } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: radius.pill, backgroundColor: colors.accent }} />
    </View>
  );
}

/**
 * Daily goal as discrete segments: one per micro lesson (grouped when the goal
 * is large). Goes past full without visual overflow.
 */
export function SegmentedProgress({ done, goal, label }: { done: number; goal: number; label: string }) {
  const { colors, spacing } = useTheme();
  const segments = Math.max(1, Math.min(goal, 20));
  const filled = Math.min(segments, Math.floor((done / Math.max(goal, 1)) * segments));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: goal, now: Math.min(done, goal) }}
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: i < filled ? colors.accent : colors.surfaceMuted }}
        />
      ))}
    </View>
  );
}
