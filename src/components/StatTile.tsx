import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: Stat) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
      style={{
        flex: 1,
        minWidth: 140,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.xs,
      }}
    >
      <StatContent label={label} value={value} hint={hint} />
    </View>
  );
}

function StatContent({ label, value, hint }: Stat) {
  return (
    <>
      <Text variant="label" tone="subtle">
        {label}
      </Text>
      <Text variant="stat">{value}</Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </>
  );
}

/** Swiss grid: stats in two columns separated by hairlines, inside one surface. */
export function StatGrid({ stats }: { stats: Stat[] }) {
  const { colors, radius, spacing } = useTheme();
  const rows: Stat[][] = [];
  for (let i = 0; i < stats.length; i += 2) rows.push(stats.slice(i, i + 2));
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface }}>
      {rows.map((row, r) => (
        <View
          key={r}
          style={{ flexDirection: 'row', borderTopWidth: r === 0 ? 0 : 1, borderTopColor: colors.border }}
        >
          {row.map((stat, c) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.label}: ${stat.value}${stat.hint ? `, ${stat.hint}` : ''}`}
              style={{
                flex: 1,
                padding: spacing.lg,
                gap: spacing.xs,
                borderLeftWidth: c === 0 ? 0 : 1,
                borderLeftColor: colors.border,
              }}
            >
              <StatContent {...stat} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
