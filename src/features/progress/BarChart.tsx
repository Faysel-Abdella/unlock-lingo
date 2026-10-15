import { View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

export interface Bar {
  key: string;
  /** Axis label; an empty string leaves the slot blank but keeps its height. */
  label: string;
  value: number;
  /** The current period, drawn in the accent colour. */
  current?: boolean;
}

/** Plain activity bars: counts only, no scores or badges. */
export function BarChart({ bars, minMax = 1, accessibilityLabel }: { bars: Bar[]; minMax?: number; accessibilityLabel: string }) {
  const { colors, radius, spacing } = useTheme();
  const max = Math.max(minMax, ...bars.map((b) => b.value), 1);
  const height = 120;
  const gap = bars.length > 8 ? spacing.xs : spacing.sm;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', alignItems: 'flex-end', gap, height: height + 24 }}>
      {bars.map((bar) => (
        <View key={bar.key} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
          <View
            style={{
              width: '100%',
              height: Math.max(4, (bar.value / max) * height),
              borderRadius: radius.sm,
              backgroundColor: bar.value === 0 ? colors.surfaceMuted : bar.current ? colors.accent : colors.accentSoft,
            }}
          />
          <Text variant="caption" tone={bar.current ? 'default' : 'subtle'} numberOfLines={1} style={{ minWidth: 40, textAlign: 'center' }}>
            {bar.label || '\u00A0'}
          </Text>
        </View>
      ))}
    </View>
  );
}
