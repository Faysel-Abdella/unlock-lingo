import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components';
import { alarmClock, type AlarmPermissionStatus } from '@/native/alarmClock';
import { useTheme } from '@/theme/ThemeProvider';

import { requestNotificationPermission, useAlarmPermissions } from '../hooks';

interface Requirement {
  key: keyof AlarmPermissionStatus;
  title: string;
  why: string;
  action: string;
  open: () => void;
  /** Without it alarms still ring, so it is a recommendation rather than a warning. */
  optional?: boolean;
}

const REQUIREMENTS: Requirement[] = [
  {
    key: 'notifications',
    title: 'Notifications',
    why: 'The ringing alarm is shown as a notification. Without it you may not see the alarm.',
    action: 'Allow notifications',
    open: () => {
      void requestNotificationPermission().then((granted) => {
        if (!granted) alarmClock.openNotificationSettings();
      });
    },
  },
  {
    key: 'exactAlarms',
    title: 'Alarms & reminders',
    why: 'Lets the alarm ring at the exact minute. Without it Android may delay it.',
    action: 'Allow exact alarms',
    open: alarmClock.openExactAlarmSettings,
  },
  {
    key: 'fullScreenIntent',
    title: 'Full-screen alarm',
    why: 'Shows the wake-up challenge over the lock screen instead of only a notification.',
    action: 'Allow full screen',
    open: alarmClock.openFullScreenIntentSettings,
  },
  {
    key: 'batteryOptimizationIgnored',
    title: 'Battery optimisation',
    why: 'Some phones stop apps in the background. Exempting Unlock Lingo makes alarms more reliable.',
    action: 'Open battery settings',
    open: alarmClock.openBatteryOptimizationSettings,
    optional: true,
  },
];

/** Lists missing permissions with a one-sentence reason each. Renders nothing when all is well. */
export function AlarmPermissions({ includeOptional = false }: { includeOptional?: boolean }) {
  const { colors, spacing } = useTheme();
  const { data: status } = useAlarmPermissions();

  if (!alarmClock.isAvailable) {
    return (
      <Card tone="muted">
        <Text variant="bodyStrong">Alarms need the Android app</Text>
        <Text tone="muted">
          Learn-to-dismiss alarms use native Android features. They work in the Android development build, not on
          this platform.
        </Text>
      </Card>
    );
  }
  if (!status) return null;
  const missing = REQUIREMENTS.filter((r) => !status[r.key] && (includeOptional || !r.optional));
  if (missing.length === 0) return null;

  return (
    <Card tone="muted">
      <Text variant="bodyStrong">For reliable alarms</Text>
      {missing.map((r) => (
        <View key={r.key} style={{ gap: spacing.xs, paddingTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons
              name={r.optional ? 'information-circle-outline' : 'alert-circle-outline'}
              size={18}
              color={r.optional ? colors.textMuted : colors.warning}
            />
            <Text variant="bodyStrong">{r.title}</Text>
          </View>
          <Text tone="muted">{r.why}</Text>
          <Button label={r.action} size="md" variant="secondary" onPress={r.open} />
        </View>
      ))}
    </Card>
  );
}
