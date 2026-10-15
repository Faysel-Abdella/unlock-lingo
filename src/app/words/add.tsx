import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Screen, Text, TextField } from '@/components';
import { useAddWord } from '@/features/vocabulary/hooks';
import { SOURCE_LABELS } from '@/features/vocabulary/sources';
import { WORD_SOURCES, type WordSource } from '@/repositories/personalVocabularyRepository';
import { useTheme } from '@/theme/ThemeProvider';

export default function AddWord() {
  const { spacing } = useTheme();
  const addWord = useAddWord();
  const [word, setWord] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<WordSource>('other');

  const submit = async () => {
    const result = await addWord.mutateAsync({ word, contextNote: note, source });
    router.replace({ pathname: '/words/[id]', params: { id: result.word.id } });
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          label="Add word"
          onPress={submit}
          disabled={word.trim().length === 0}
          loading={addWord.isPending}
        />
      }
    >
      <TextField
        label="Word or phrase"
        value={word}
        onChangeText={setWord}
        placeholder="e.g. serendipity"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        hint="Just the word is enough. If it’s in the built-in dictionary, the meaning is filled in for you."
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label" tone="subtle">
          Where did you see it?
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {WORD_SOURCES.map((s) => (
            <Chip key={s} label={SOURCE_LABELS[s]} selected={source === s} onPress={() => setSource(s)} />
          ))}
        </View>
      </View>
      <TextField
        label="Context (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="The sentence where you found it"
        multiline
      />
      {addWord.error ? <Text tone="danger">{addWord.error.message}</Text> : null}
    </Screen>
  );
}
