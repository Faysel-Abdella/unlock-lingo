import { View } from 'react-native';

import { Text, WheelPicker } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

interface TimeFieldProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));
const MINUTES = Array.from({ length: 60 }, (_, m) => pad(m));

/** 24-hour wheel time picker: scroll or tap each column; screen readers adjust it like a slider. */
export function TimeField({ hour, minute, onChange }: TimeFieldProps) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm }}>
      <WheelPicker label="Hour" items={HOURS} selectedIndex={hour} onChange={(h) => onChange(h, minute)} />
      <Text variant="title" accessibilityElementsHidden importantForAccessibility="no">
        :
      </Text>
      <WheelPicker label="Minute" items={MINUTES} selectedIndex={minute} onChange={(m) => onChange(hour, m)} />
    </View>
  );
}
