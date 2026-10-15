import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ value, height = 8 }: { value: number; height?: number }) {
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
