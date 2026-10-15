import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, SectionHeader, Text } from '@/components';
import { DEFAULT_BACKLOG_LIMIT } from '@/features/learning/domain/queue';
import { useDashboard } from '@/features/learning/hooks';
import { useSettings } from '@/features/settings/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export default function Learn() {
  const { spacing } = useTheme();
  const { data } = useDashboard();
  const settings = useSettings().data;

  const due = data?.dueCount ?? 0;
  const fresh = data?.newRemainingToday ?? 0;
  const difficult = data?.difficultCount ?? 0;
  const levels = data?.levelPolicy.allowedLevels.join(' + ') ?? '';

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Today’s learning</Text>
        <Text tone="muted">
          A short session of about {settings?.sessionSize ?? 10} moments. Reviews come first, then a few new items.
        </Text>
      </View>

      <Card>
        <Row label="Reviews due" value={String(due)} />
        <Row label="New items left today" value={due >= DEFAULT_BACKLOG_LIMIT ? 'Paused until reviews are done' : String(fresh)} />
        <Row label="Difficult items" value={String(difficult)} />
        {levels ? <Row label="New material from" value={levels} /> : null}
        <Button label="Start session" icon="play" onPress={() => router.push('/session')} style={{ marginTop: spacing.sm }} />
      </Card>

      <SectionHeader title="Explore" />
      <Card onPress={() => router.push('/vocabulary')} accessibilityLabel="Browse vocabulary">
        <Text variant="bodyStrong">Vocabulary</Text>
        <Text tone="muted">Browse every word, its status and when it is next due.</Text>
      </Card>
      <Card onPress={() => router.push('/(tabs)/words')} accessibilityLabel="Open My Words">
        <Text variant="bodyStrong">My Words</Text>
        <Text tone="muted">Words you collected yourself. They are prioritised in reviews.</Text>
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text tone="muted">{label}</Text>
      <Text variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
