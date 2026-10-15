import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components';
import { AlarmPermissions } from '@/features/alarms/components/AlarmPermissions';
import { AlarmRow } from '@/features/alarms/components/AlarmRow';
import { describeTimeUntil, formatAlarmTime } from '@/features/alarms/domain/schedule';
import { useAlarms, useNextAlarm, useToggleAlarm } from '@/features/alarms/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export default function AlarmList() {
  const { spacing } = useTheme();
  const { data: alarms = [], isPending } = useAlarms();
  const toggle = useToggleAlarm();
  const [now] = useState(Date.now);
  const next = useNextAlarm(now);

  const edit = (id: string) => router.push({ pathname: '/alarms/[id]', params: { id } });

  return (
    <Screen edges={['bottom']} footer={<Button label="New alarm" icon="add" onPress={() => edit('new')} />}>
      <Text tone="muted">
        {next
          ? `Next: ${formatAlarmTime(next.alarm.hour, next.alarm.minute)}, ${describeTimeUntil(next.at, now)}`
          : 'Wake up with a few quick questions. The alarm stops once you answer them.'}
      </Text>
      <AlarmPermissions includeOptional />
      {!isPending && alarms.length === 0 ? (
        <EmptyState
          icon="alarm-outline"
          title="No alarms yet"
          message="Create an alarm and choose how many questions it takes to turn it off."
        />
      ) : null}
      <View style={{ gap: spacing.md }}>
        {alarms.map((alarm) => (
          <AlarmRow
            key={alarm.id}
            alarm={alarm}
            onPress={() => edit(alarm.id)}
            onToggle={(enabled) => toggle.mutate({ id: alarm.id, enabled })}
          />
        ))}
      </View>
    </Screen>
  );
}
