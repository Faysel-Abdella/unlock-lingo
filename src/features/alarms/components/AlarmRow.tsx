import { Pressable, Switch, View } from 'react-native';

import { Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

import { describeRepeat, formatAlarmTime } from '../domain/schedule';
import type { Alarm } from '../domain/types';

export function AlarmRow({ alarm, onPress, onToggle }: { alarm: Alarm; onPress: () => void; onToggle: (on: boolean) => void }) {
  const { colors, radius, spacing } = useTheme();
  const subtitle = [alarm.label, describeRepeat(alarm.days), `${alarm.questionCount} questions`].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Alarm ${formatAlarmTime(alarm.hour, alarm.minute)}, ${subtitle}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: spacing.xs, opacity: alarm.enabled ? 1 : 0.5 }}>
        <Text variant="title">{formatAlarmTime(alarm.hour, alarm.minute)}</Text>
        <Text tone="muted">{subtitle}</Text>
      </View>
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        accessibilityLabel={alarm.enabled ? 'Turn alarm off' : 'Turn alarm on'}
        trackColor={{ true: colors.accent, false: colors.surfaceMuted }}
      />
    </Pressable>
  );
}
