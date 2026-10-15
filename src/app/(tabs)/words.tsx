import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, EmptyState, StatusBadge, Text } from '@/components';
import { usePersonalWords } from '@/features/vocabulary/hooks';
import type { PersonalWord } from '@/repositories/personalVocabularyRepository';
import { useTheme } from '@/theme/ThemeProvider';

type Filter = 'all' | 'important' | 'difficult' | 'mastered' | 'pending';

const FILTERS: { key: Filter; label: string; test: (w: PersonalWord) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'important', label: 'Important', test: (w) => w.flags.isImportant },
  { key: 'difficult', label: 'Difficult', test: (w) => w.status === 'difficult' },
  { key: 'mastered', label: 'Mastered', test: (w) => w.status === 'mastered' },
  { key: 'pending', label: 'Needs details', test: (w) => w.enrichmentStatus === 'pending' },
];

export default function MyWords() {
  const { colors, spacing } = useTheme();
  const { data: words = [], isPending } = usePersonalWords();
  const [filter, setFilter] = useState<Filter>('all');
  const visible = words.filter(FILTERS.find((f) => f.key === filter)?.test ?? (() => true));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title">My Words</Text>
          <Button label="Add" icon="add" size="md" onPress={() => router.push('/words/add')} />
        </View>
        <Text tone="muted">Words from your work, reading and conversations. They come up first in reviews.</Text>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
          renderItem={({ item: f }) => (
            <Chip label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          )}
        />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={
          isPending ? null : words.length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title="Collect your own words"
              message="Heard a word in a meeting or read it in an article? Add it here and it becomes part of your reviews."
              action={<Button label="Add your first word" onPress={() => router.push('/words/add')} />}
            />
          ) : (
            <EmptyState icon="filter-outline" title="Nothing here" message="No words match this filter." />
          )
        }
        renderItem={({ item: w }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/words/[id]', params: { id: w.id } })}
            accessibilityRole="button"
            accessibilityLabel={w.word}
            style={({ pressed }) => ({ paddingVertical: spacing.md, gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="heading" style={{ flex: 1 }}>
                {w.word}
              </Text>
              {w.flags.isImportant ? <Ionicons name="star" size={14} color={colors.warning} /> : null}
              <StatusBadge status={w.status} />
            </View>
            <Text tone="muted" numberOfLines={1}>
              {w.item.definition ?? (w.contextNote ? `“${w.contextNote}”` : 'Tap to add a meaning')}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
