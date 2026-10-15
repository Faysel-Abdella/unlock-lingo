import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Chip, EmptyState, StatusBadge, Text } from '@/components';
import { useVocabularyList } from '@/features/vocabulary/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import type { CefrLevel } from '@/types/language';

const LEVELS: (CefrLevel | null)[] = [null, 'B1', 'B2', 'C1'];

export default function VocabularyBrowser() {
  const { colors, radius, spacing, typography } = useTheme();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<CefrLevel | null>(null);
  const { data = [], isPending } = useVocabularyList(search, level);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textSubtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search words or meanings"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Search vocabulary"
            autoCorrect={false}
            autoCapitalize="none"
            style={{ ...typography.body, flex: 1, minHeight: 44, color: colors.text }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LEVELS.map((l) => (
            <Chip key={l ?? 'all'} label={l ?? 'All'} selected={level === l} onPress={() => setLevel(l)} />
          ))}
        </View>
      </View>
      <FlatList
        data={data}
        keyExtractor={(entry) => entry.item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={
          isPending ? null : (
            <EmptyState icon="search-outline" title="No matches" message="Try a different word or level." />
          )
        }
        renderItem={({ item: entry }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/vocabulary/[id]', params: { id: entry.item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${entry.item.word}, ${entry.item.cefrLevel}`}
            style={({ pressed }) => ({ paddingVertical: spacing.md, gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="heading" style={{ flex: 1 }}>
                {entry.item.word}
              </Text>
              {entry.isPersonal ? <Ionicons name="bookmark" size={14} color={colors.accent} /> : null}
              <Text variant="caption" tone="subtle">
                {entry.item.cefrLevel}
              </Text>
              <StatusBadge status={entry.status} />
            </View>
            {entry.item.definition ? (
              <Text tone="muted" numberOfLines={1}>
                {entry.item.definition}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
