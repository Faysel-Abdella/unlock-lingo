import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, Screen, Text } from '@/components';
import { LearningCard } from '@/features/learning/components/LearningCard';
import { QuizCard } from '@/features/learning/components/QuizCard';
import { generateQuiz } from '@/features/learning/domain/exercises';
import { useInvalidateLearning, useItem, useRecordReview } from '@/features/learning/hooks';
import { useProfile } from '@/features/settings/hooks';
import { useAddWord } from '@/features/vocabulary/hooks';
import { usePronunciation } from '@/hooks/usePronunciation';
import { useTheme } from '@/theme/ThemeProvider';
import type { LearningItem } from '@/types/learning';

const randomRng = () => Math.random();

/** Full card, opened by tapping an unlock card notification (unlocklingo://card?itemId=…). */
export default function CardScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { data, isPending } = useItem(itemId ?? '');

  if (isPending) return <Screen edges={['bottom']}>{null}</Screen>;
  if (!data?.item) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="help-circle-outline" title="Card not found" message="This item is no longer available." />
      </Screen>
    );
  }
  return <CardBody item={data.item} saved={!!data.personal} />;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

function CardBody({ item, saved: initiallySaved }: { item: LearningItem; saved: boolean }) {
  const { spacing } = useTheme();
  const speak = usePronunciation();
  const record = useRecordReview();
  const addWord = useAddWord();
  const invalidate = useInvalidateLearning();
  const nativeLanguage = useProfile().data?.nativeLanguage ?? null;
  const [saved, setSaved] = useState(initiallySaved);

  const quiz = useMemo(
    () => (item.type === 'grammar' ? generateQuiz(item, { pool: [], nativeLanguage, rng: randomRng }) : null),
    [item, nativeLanguage],
  );

  const finish = () => {
    void invalidate();
    close();
  };

  const selfGrade = (knewIt: boolean) =>
    record.mutate(
      {
        itemId: item.id,
        itemType: item.type,
        exerciseType: 'intro',
        outcome: { kind: 'self', knewIt },
        context: 'unlock',
        now: Date.now(),
      },
      { onSettled: finish },
    );

  if (quiz) {
    return (
      <Screen edges={['bottom']}>
        <QuizCard
          question={quiz}
          onAnswer={(correct, responseMs) =>
            record.mutate({
              itemId: item.id,
              itemType: item.type,
              exerciseType: quiz.exerciseType,
              outcome: { kind: 'quiz', correct, responseMs },
              context: 'unlock',
              now: Date.now(),
            })
          }
          onContinue={finish}
        />
      </Screen>
    );
  }

  const spoken = item.type === 'vocabulary' ? item.word : item.type === 'phrase' ? item.phrase : null;
  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: spacing.md }}>
        <LearningCard
          item={item}
          actions={{
            onListen: spoken ? () => speak(spoken) : undefined,
            onKnow: () => selfGrade(true),
            onReviewLater: () => selfGrade(false),
            onSave:
              item.type === 'vocabulary'
                ? () => {
                    if (saved) return;
                    addWord.mutate({ word: item.word }, { onSuccess: () => setSaved(true) });
                  }
                : undefined,
            saved,
            onDismiss: close,
          }}
        />
        <Text variant="caption" tone="muted" align="center">
          Dismissing leaves your progress unchanged.
        </Text>
      </View>
    </Screen>
  );
}
