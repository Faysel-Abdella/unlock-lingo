import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Button, EmptyState, IconButton, ProgressBar, Screen, StatTile, Text } from '@/components';
import { SpeakCard } from '@/features/audio/components/SpeakCard';
import { speakableText } from '@/features/audio/domain/pronunciation';
import { usePronunciationPractice } from '@/features/audio/usePronunciationPractice';
import { LearningCard } from '@/features/learning/components/LearningCard';
import { QuizCard } from '@/features/learning/components/QuizCard';
import { useInvalidateLearning } from '@/features/learning/hooks';
import { useLearningSession } from '@/features/learning/useLearningSession';
import { useSettings } from '@/features/settings/hooks';
import { usePronunciation } from '@/hooks/usePronunciation';
import { useTheme } from '@/theme/ThemeProvider';
import type { LearningItem } from '@/types/learning';

function spokenText(item: LearningItem): string | null {
  if (item.type === 'vocabulary') return item.word;
  if (item.type === 'phrase') return item.phrase;
  return null;
}

export default function SessionScreen() {
  const { colors, spacing } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const weekly = kind === 'weekly';
  const session = useLearningSession(weekly ? 'weekly' : 'daily');
  const speak = usePronunciation();
  const invalidate = useInvalidateLearning();
  const autoPlay = useSettings().data?.autoPlayAudio ?? false;

  const close = () => {
    void invalidate();
    router.back();
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <IconButton icon="close" label="Close session" onPress={close} />
      <View style={{ flex: 1 }}>
        <ProgressBar value={session.phase === 'done' ? 1 : session.progress} height={6} />
      </View>
      {session.position && session.phase === 'active' ? (
        <Text variant="caption" tone="muted">
          {session.position.index + 1}/{session.position.total}
        </Text>
      ) : null}
    </View>
  );

  if (session.phase === 'loading') {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (session.phase === 'error') {
    return (
      <Screen edges={['top', 'bottom']}>
        {header}
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn’t start the session"
          message={session.error?.message ?? 'Something went wrong.'}
          action={<Button label="Close" variant="secondary" onPress={close} />}
        />
      </Screen>
    );
  }

  if (session.phase === 'empty') {
    return (
      <Screen edges={['top', 'bottom']}>
        {header}
        <EmptyState
          icon="checkmark-done-outline"
          title={weekly ? 'Nothing to review this week' : 'You’re all caught up'}
          message={
            weekly
              ? 'Practise during the week and your weekly review will collect what to revisit.'
              : 'No reviews are due and today’s new words are done. Your next reviews will appear when they are due.'
          }
          action={<Button label="Back to today" onPress={close} />}
        />
      </Screen>
    );
  }

  if (session.phase === 'done' && session.summary) {
    const { summary } = session;
    return (
      <Screen edges={['top', 'bottom']} footer={<Button label="Done" onPress={close} />}>
        {header}
        <View style={{ gap: spacing.sm, paddingTop: spacing.xl }}>
          <Text variant="title">{weekly ? 'Weekly review complete' : 'Session complete'}</Text>
          <Text tone="muted">
            {weekly
              ? 'Saved to your progress. Words you missed come back sooner next week.'
              : 'Every answer has been scheduled for review at the right time.'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <StatTile label="Moments" value={String(summary.interactions)} />
          <StatTile
            label="Accuracy"
            value={summary.accuracy === null ? '–' : `${Math.round(summary.accuracy * 100)}%`}
            hint={`${summary.correct} of ${summary.quizzes} questions`}
          />
          <StatTile label="New items" value={String(summary.newItems)} />
          {summary.spoken > 0 ? (
            <StatTile label="Spoken" value={`${summary.spokenClear}/${summary.spoken}`} hint="understood clearly" />
          ) : null}
        </View>
      </Screen>
    );
  }

  const { question, item, step } = session;
  if (step?.mode === 'speak' && item) {
    return (
      <Screen edges={['top', 'bottom']}>
        {header}
        <View style={{ paddingTop: spacing.md }}>
          <SpeakStep key={`${session.position?.index}-${item.id}`} item={item} onDone={session.completeSpeaking} speak={speak} />
        </View>
      </Screen>
    );
  }
  if (!question || !item || !step) return null;
  const text = spokenText(item);
  const listen = text ? () => speak(text) : undefined;
  const listenSlow = text ? () => speak(text, { slow: true }) : undefined;
  const save =
    item.type === 'vocabulary' ? () => void session.toggleSave(item.id, item.word) : undefined;

  const answerCard = async (knewIt: boolean) => {
    void Haptics.selectionAsync();
    const answer = await session.record({ kind: 'self', knewIt }, 'intro');
    session.advance(answer);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {header}
      <View style={{ paddingTop: spacing.md }}>
        {question.kind === 'card' ? (
          <LearningCard
            item={item}
            actions={{
              onListen: listen,
              onListenSlow: listenSlow,
              onSave: save,
              saved: session.savedIds.has(item.id),
              onKnow: () => void answerCard(true),
              onReviewLater: () => void answerCard(false),
              knowLabel: step.mode === 'intro' && step.reason === 'new' ? 'I know this' : 'I remember',
              laterLabel: step.mode === 'intro' && step.reason === 'new' ? 'New to me' : 'Not yet',
            }}
          />
        ) : (
          <QuizCard
            key={`${session.position?.index}-${question.itemId}`}
            question={question}
            autoPlay={autoPlay}
            onListen={speak}
            onListenSlow={(text) => speak(text, { slow: true })}
            onAnswer={(correct, responseMs) => {
              void Haptics.notificationAsync(
                correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
              );
              void session.record({ kind: 'quiz', correct, responseMs }, question.exerciseType);
            }}
            onContinue={() => session.advance()}
          />
        )}
      </View>
    </Screen>
  );
}

function SpeakStep({
  item,
  onDone,
  speak,
}: {
  item: LearningItem;
  onDone: (clear: boolean) => void;
  speak: (text: string, options?: { slow?: boolean }) => void;
}) {
  const text = speakableText(item) ?? '';
  const practice = usePronunciationPractice({ itemId: item.id, expected: text });
  const hint = item.type === 'vocabulary' ? item.definition : item.type === 'phrase' ? item.meaning : null;
  return (
    <SpeakCard
      text={text}
      hint={hint}
      state={practice.state}
      attempts={practice.attempts}
      onListen={() => speak(text)}
      onListenSlow={() => speak(text, { slow: true })}
      onSpeak={() => void practice.listen()}
      onStop={practice.stop}
      onDone={onDone}
    />
  );
}
