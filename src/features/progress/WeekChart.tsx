import { View } from 'react-native';

import { Text } from '@/components';
import type { DailyActivity } from '@/features/learning/domain/stats';
import { useTheme } from '@/theme/ThemeProvider';
import { weekdayShort } from '@/utils/date';

/** Seven-day activity bars. Deliberately simple: counts, no scores or badges. */
export function WeekChart({ days, goal }: { days: DailyActivity[]; goal: number }) {
  const { colors, radius, spacing } = useTheme();
  const max = Math.max(goal, ...days.map((d) => d.interactions), 1);
  const height = 120;
  return (
    <View
      accessible
      accessibilityLabel={`Last 7 days: ${days.map((d) => `${weekdayShort(d.date)} ${d.interactions}`).join(', ')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: height + 24 }}
    >
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        const barHeight = Math.max(4, (d.interactions / max) * height);
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: '100%',
                height: barHeight,
                borderRadius: radius.sm,
                backgroundColor: d.interactions === 0 ? colors.surfaceMuted : isToday ? colors.accent : colors.accentSoft,
              }}
            />
            <Text variant="caption" tone={isToday ? 'default' : 'subtle'}>
              {weekdayShort(d.date)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
