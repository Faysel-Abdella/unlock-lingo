import { View } from 'react-native';

import { IconButton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

import { formatMinuteOfDay } from '../domain/settings';

const STEP = 30;

/** Compact time-of-day stepper in 30-minute steps. */
export function TimeOfDayField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { spacing } = useTheme();
  const shift = (delta: number) => onChange((((value + delta) % 1440) + 1440) % 1440);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text tone="muted" style={{ width: 52 }}>
        {label}
      </Text>
      <IconButton icon="remove" label={`${label} 30 minutes earlier`} onPress={() => shift(-STEP)} />
      <Text variant="heading" style={{ minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${label} ${formatMinuteOfDay(value)}`}>
        {formatMinuteOfDay(value)}
      </Text>
      <IconButton icon="add" label={`${label} 30 minutes later`} onPress={() => shift(STEP)} />
    </View>
  );
}
