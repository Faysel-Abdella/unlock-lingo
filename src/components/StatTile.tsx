import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
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
      <Text variant="label" tone="subtle">
        {label}
      </Text>
      <Text variant="stat">{value}</Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
