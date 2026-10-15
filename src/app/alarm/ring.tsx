import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, View } from 'react-native';

import { Button, ProgressBar, Screen, Text } from '@/components';
import { remainingCorrect } from '@/features/alarms/domain/challenge';
import { formatAlarmTime } from '@/features/alarms/domain/schedule';
import { useAlarmChallenge } from '@/features/alarms/useAlarmChallenge';
import { QuizCard } from '@/features/learning/components/QuizCard';
import { useInvalidateLearning } from '@/features/learning/hooks';
import { useTheme } from '@/theme/ThemeProvider';

/** How long the emergency stop must be held. Deliberate, but easy even half-asleep. */
const EMERGENCY_HOLD_MS = 3000;

export default function AlarmRingScreen() {
  const { alarmId } = useLocalSearchParams<{ alarmId: string }>();
  const { colors, spacing } = useTheme();
  const c = useAlarmChallenge(alarmId ?? '');
  const invalidate = useInvalidateLearning();
  const [clock] = useState(() => new Date());

  // While ringing, Back must not hide the alarm. The emergency stop is the way out.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => c.phase === 'loading' || c.phase === 'active');
    return () => sub.remove();
  }, [c.phase]);

  const leave = () => {
    void invalidate();
    router.replace('/(tabs)');
  };

  if (c.phase === 'stopped' || c.phase === 'ended') {
    const solved = c.phase === 'stopped' && c.challenge?.status === 'completed';
    const title = solved ? 'Good morning' : c.snoozed ? 'Snoozed' : 'Alarm stopped';
    const message = c.snoozed
      ? `It will ring again in ${c.snooze?.minutes ?? ''} minutes.`
      : c.phase === 'ended'
        ? 'The alarm was stopped from the notification or ended on its own.'
        : 'Stopped without the challenge. No worries, your words will wait.';
    return (
      <Screen scroll={false} edges={['top', 'bottom']} footer={<Button label="Start the day" onPress={leave} />}>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <Text variant="title">{title}</Text>
          {solved && c.challenge ? (
            <Text variant="bodyLarge" tone="muted">
              {c.challenge.correct} correct in {c.challenge.attempts} {c.challenge.attempts === 1 ? 'answer' : 'answers'}.
              Your answers were added to today’s reviews.
            </Text>
          ) : (
            <Text variant="bodyLarge" tone="muted">
              {message}
            </Text>
          )}
        </View>
      </Screen>
    );
  }

  const challenge = c.challenge;
  const header = (
    <View style={{ gap: spacing.sm }}>
      <Text variant="display">{formatAlarmTime(clock.getHours(), clock.getMinutes())}</Text>
      {c.alarm?.label ? <Text tone="muted">{c.alarm.label}</Text> : null}
      {challenge && challenge.status === 'active' ? (
        <>
          <Text variant="bodyStrong" accessibilityLiveRegion="polite">
            {remainingCorrect(challenge)} more correct {remainingCorrect(challenge) === 1 ? 'answer' : 'answers'} to stop the alarm
          </Text>
          <ProgressBar value={challenge.correct / challenge.required} />
        </>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: spacing.sm }}>
      {c.snooze?.allowed ? (
        <Button
          label={`Snooze ${c.snooze.minutes} min (${c.snooze.remaining} left)`}
          variant="secondary"
          onPress={() => void c.snoozeAlarm()}
        />
      ) : null}
      <EmergencyStop onStop={c.emergency} />
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']} footer={footer}>
      {header}
      {c.phase === 'loading' || !challenge ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      ) : c.question ? (
        <QuizCard
          key={c.questionNumber}
          question={c.question}
          onAnswer={(correct, responseMs) => {
            void Haptics.notificationAsync(
              correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
            );
            void c.answer(correct, responseMs);
          }}
          onContinue={c.next}
        />
      ) : null}
    </Screen>
  );
}

/** Press and hold to stop the alarm without answering. Always visible, never disabled. */
function EmergencyStop({ onStop }: { onStop: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const [holding, setHolding] = useState(false);
  return (
    <Pressable
      onPressIn={() => setHolding(true)}
      onPressOut={() => setHolding(false)}
      onLongPress={() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onStop();
      }}
      delayLongPress={EMERGENCY_HOLD_MS}
      accessibilityRole="button"
      accessibilityLabel="Emergency stop"
      accessibilityHint="Press and hold for three seconds to stop the alarm without answering"
      style={{
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: holding ? colors.danger : colors.border,
        backgroundColor: holding ? colors.dangerSoft : 'transparent',
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text variant="caption" tone={holding ? 'danger' : 'muted'} style={{ fontWeight: '600' }}>
        {holding ? 'Keep holding…' : 'Emergency stop: press and hold'}
      </Text>
    </Pressable>
  );
}
