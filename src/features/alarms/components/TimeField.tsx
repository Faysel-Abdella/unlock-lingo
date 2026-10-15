import { View } from 'react-native';

import { IconButton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

interface TimeFieldProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

const wrap = (value: number, size: number) => ((value % size) + size) % size;

/** Large hour/minute stepper: chevrons move minutes by 5, the +/- buttons by 1. */
export function TimeField({ hour, minute, onChange }: TimeFieldProps) {
  const { spacing } = useTheme();
  const column = (label: string, value: number, step: (delta: number) => void, big: number, small: number) => (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View style={{ flexDirection: 'row' }}>
        <IconButton icon="chevron-up" label={`${label} plus ${big}`} onPress={() => step(big)} />
        {small !== big ? <IconButton icon="add" label={`${label} plus ${small}`} onPress={() => step(small)} /> : null}
      </View>
      <Text variant="display" accessibilityLabel={`${label} ${value}`}>
        {String(value).padStart(2, '0')}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <IconButton icon="chevron-down" label={`${label} minus ${big}`} onPress={() => step(-big)} />
        {small !== big ? <IconButton icon="remove" label={`${label} minus ${small}`} onPress={() => step(-small)} /> : null}
      </View>
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
      {column('Hour', hour, (d) => onChange(wrap(hour + d, 24), minute), 1, 1)}
      <Text variant="display">:</Text>
      {column('Minute', minute, (d) => onChange(hour, wrap(minute + d, 60)), 5, 1)}
    </View>
  );
}
