import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { EmptyState, Screen, Text } from '@/components';
import { PracticeSpeaking } from '@/features/audio/components/PracticeSpeaking';
import { LearningCard } from '@/features/learning/components/LearningCard';
import { useItem } from '@/features/learning/hooks';
import { useProfile } from '@/features/settings/hooks';
import { ItemProgressCard } from '@/features/vocabulary/components/ItemProgressCard';
import { useAddWord } from '@/features/vocabulary/hooks';
import { usePronunciation } from '@/hooks/usePronunciation';
import { LANGUAGES } from '@/types/language';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending } = useItem(id);
  const nativeLanguage = useProfile().data?.nativeLanguage ?? null;
  const speak = usePronunciation();
  const addWord = useAddWord();
  const [now] = useState(Date.now);

  if (isPending) return <Screen edges={[]}>{null}</Screen>;
  if (!data?.item) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="help-circle-outline" title="Not found" message="This item no longer exists." />
      </Screen>
    );
  }

  const { item, progress, personal } = data;
  const spoken = item.type === 'vocabulary' ? item.word : item.type === 'phrase' ? item.phrase : null;
  const translation = item.type === 'vocabulary' && nativeLanguage ? item.translations[nativeLanguage] : undefined;

  return (
    <Screen edges={[]}>
      <LearningCard
        item={item}
        actions={{
          onListen: spoken ? () => speak(spoken) : undefined,
          onListenSlow: spoken ? () => speak(spoken, { slow: true }) : undefined,
          onSave: item.type === 'vocabulary' ? () => addWord.mutate({ word: item.word }) : undefined,
          saved: !!personal,
        }}
      />
      {translation && nativeLanguage ? (
        <Text tone="muted">
          {LANGUAGES[nativeLanguage].name}: <Text variant="bodyStrong">{translation}</Text>
        </Text>
      ) : null}
      <PracticeSpeaking item={item} />
      <ItemProgressCard progress={progress} flags={personal?.flags ?? null} now={now} />
    </Screen>
  );
}
