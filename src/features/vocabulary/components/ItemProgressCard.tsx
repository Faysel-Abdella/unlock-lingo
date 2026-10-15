import { View } from 'react-native';

import { Card, StatusBadge, Text } from '@/components';
import { effectiveStatus } from '@/features/learning/domain/review';
import type { LearningProgress, PersonalWordFlags } from '@/types/learning';
import { formatRelativeDue } from '@/utils/date';

/** Learning state for one item, phrased for learners rather than as raw FSRS numbers. */
export function ItemProgressCard({
  progress,
  flags,
  now,
}: {
  progress: LearningProgress | null;
  flags: PersonalWordFlags | null;
  now: number;
}) {
  const status = effectiveStatus(progress?.status ?? 'new', flags);
  const answered = (progress?.correctCount ?? 0) + (progress?.incorrectCount ?? 0);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" tone="subtle">
          Your progress
        </Text>
        <StatusBadge status={status} />
      </View>
      {!progress || progress.reps === 0 ? (
        <Text tone="muted">Not studied yet. It will appear in a session soon.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <Line label="Seen" value={`${progress.seenCount} times`} />
          <Line
            label="Correct"
            value={answered === 0 ? '–' : `${progress.correctCount} of ${answered}`}
          />
          <Line label="Current streak" value={String(progress.streak)} />
          <Line label="Remembered for" value={`~${Math.max(1, Math.round(progress.stability))} days`} />
          <Line
            label="Next review"
            value={flags?.isMastered ? 'Paused (marked mastered)' : progress.dueAt ? formatRelativeDue(progress.dueAt, now) : '–'}
          />
        </View>
      )}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text tone="muted">{label}</Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}
