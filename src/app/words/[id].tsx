import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Chip, EmptyState, Screen, Text, TextField } from '@/components';
import { LearningCard } from '@/features/learning/components/LearningCard';
import { useItem } from '@/features/learning/hooks';
import { useProfile } from '@/features/settings/hooks';
import { ItemProgressCard } from '@/features/vocabulary/components/ItemProgressCard';
import {
  usePersonalWord,
  useRemoveWord,
  useUpdateWordDetails,
  useUpdateWordFlags,
  useUpdateWordNote,
} from '@/features/vocabulary/hooks';
import { SOURCE_LABELS } from '@/features/vocabulary/sources';
import { usePronunciation } from '@/hooks/usePronunciation';
import type { PersonalWord } from '@/repositories/personalVocabularyRepository';
import { useTheme } from '@/theme/ThemeProvider';
import { LANGUAGES } from '@/types/language';

export default function PersonalWordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: word, isPending } = usePersonalWord(id);

  if (isPending) return <Screen edges={[]}>{null}</Screen>;
  if (!word) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="help-circle-outline" title="Not found" message="This word was removed." />
      </Screen>
    );
  }
  return <WordDetail word={word} />;
}

function WordDetail({ word }: { word: PersonalWord }) {
  const { spacing } = useTheme();
  const speak = usePronunciation();
  const progress = useItem(word.itemId).data?.progress ?? null;
  const updateFlags = useUpdateWordFlags();
  const remove = useRemoveWord();
  const [now] = useState(Date.now);

  const toggle = (flag: 'isImportant' | 'isDifficult' | 'isMastered') =>
    updateFlags.mutate({ id: word.id, flags: { [flag]: !word.flags[flag] } });

  const confirmRemove = () =>
    Alert.alert('Remove word?', `“${word.word}” will be removed from My Words.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => remove.mutate(word.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <Screen edges={[]}>
      <LearningCard item={word.item} actions={{ onListen: () => speak(word.word) }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="★ Important" selected={word.flags.isImportant} onPress={() => toggle('isImportant')} />
        <Chip label="Difficult" selected={word.flags.isDifficult} onPress={() => toggle('isDifficult')} />
        <Chip label="Mastered" selected={word.flags.isMastered} onPress={() => toggle('isMastered')} />
      </View>
      <Text variant="caption" tone="muted">
        Important and difficult words come up more often. Mastered words leave your reviews.
      </Text>

      <NoteEditor word={word} />
      {word.isBundled ? null : <DetailsEditor word={word} />}
      <ItemProgressCard progress={progress} flags={word.flags} now={now} />

      <Button label="Remove from My Words" variant="danger" onPress={confirmRemove} loading={remove.isPending} />
    </Screen>
  );
}

function NoteEditor({ word }: { word: PersonalWord }) {
  const update = useUpdateWordNote();
  const [note, setNote] = useState(word.contextNote ?? '');
  const dirty = note !== (word.contextNote ?? '');
  return (
    <Card>
      <Text variant="label" tone="subtle">
        Where you found it · {SOURCE_LABELS[word.source]}
      </Text>
      <TextField label="Context" value={note} onChangeText={setNote} placeholder="Add the sentence or situation" multiline />
      {dirty ? (
        <Button
          label="Save context"
          size="md"
          variant="secondary"
          loading={update.isPending}
          onPress={() => update.mutate({ id: word.id, note, source: word.source })}
        />
      ) : null}
    </Card>
  );
}

/** Manual enrichment for words that are not in the bundled dictionary. */
function DetailsEditor({ word }: { word: PersonalWord }) {
  const { spacing } = useTheme();
  const nativeLanguage = useProfile().data?.nativeLanguage ?? null;
  const update = useUpdateWordDetails();
  const item = word.item;
  const [definition, setDefinition] = useState(item.definition ?? '');
  const [example, setExample] = useState(item.example ?? '');
  const [translation, setTranslation] = useState(nativeLanguage ? (item.translations[nativeLanguage] ?? '') : '');

  const save = () =>
    update.mutate({
      id: word.id,
      details: {
        definition,
        example,
        translations: nativeLanguage
          ? { ...item.translations, [nativeLanguage]: translation.trim() || undefined }
          : item.translations,
      },
    });

  return (
    <Card>
      <Text variant="label" tone="subtle">
        {word.enrichmentStatus === 'pending' ? 'Add a meaning' : 'Details'}
      </Text>
      <Text variant="caption" tone="muted">
        This word isn’t in the built-in dictionary yet. With a meaning, it can appear as quiz questions.
      </Text>
      <View style={{ gap: spacing.md }}>
        <TextField label="Meaning" value={definition} onChangeText={setDefinition} multiline />
        <TextField label="Example sentence" value={example} onChangeText={setExample} multiline />
        {nativeLanguage ? (
          <TextField
            label={`Translation (${LANGUAGES[nativeLanguage].name})`}
            value={translation}
            onChangeText={setTranslation}
          />
        ) : null}
        <Button label="Save details" size="md" onPress={save} loading={update.isPending} />
      </View>
    </Card>
  );
}
