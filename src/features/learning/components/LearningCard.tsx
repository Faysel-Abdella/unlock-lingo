import { View } from 'react-native';

import { Button, IconButton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';
import type { LearningItem } from '@/types/learning';

export interface LearningCardActions {
  onListen?: () => void;
  onKnow?: () => void;
  onReviewLater?: () => void;
  onSave?: () => void;
  onDismiss?: () => void;
  saved?: boolean;
  knowLabel?: string;
  laterLabel?: string;
}

/**
 * The core learning surface. The word (or phrase) sits at the centre of
 * attention, with supporting detail below and at most two primary actions.
 */
export function LearningCard({ item, actions }: { item: LearningItem; actions?: LearningCardActions }) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.xl,
        padding: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="label" tone="accent">
            {item.type === 'vocabulary' ? 'Word' : item.type === 'phrase' ? 'Phrase' : 'Grammar'}
          </Text>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.xs + 2 }}>
            <Text variant="captionStrong" tone="muted">
              {item.cefrLevel}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {actions?.onSave ? (
            <IconButton
              icon={actions.saved ? 'bookmark' : 'bookmark-outline'}
              label={actions.saved ? 'Saved to My Words' : 'Save to My Words'}
              active={actions.saved}
              onPress={actions.onSave}
            />
          ) : null}
          {actions?.onDismiss ? <IconButton icon="close" label="Dismiss" onPress={actions.onDismiss} /> : null}
        </View>
      </View>

      {item.type === 'vocabulary' ? <VocabularyBody item={item} onListen={actions?.onListen} /> : null}
      {item.type === 'phrase' ? <PhraseBody item={item} onListen={actions?.onListen} /> : null}
      {item.type === 'grammar' ? <GrammarBody item={item} /> : null}

      {actions?.onKnow || actions?.onReviewLater ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {actions.onReviewLater ? (
            <Button
              label={actions.laterLabel ?? 'Review later'}
              variant="secondary"
              onPress={actions.onReviewLater}
              style={{ flex: 1 }}
            />
          ) : null}
          {actions.onKnow ? (
            <Button label={actions.knowLabel ?? 'I know this'} onPress={actions.onKnow} style={{ flex: 1 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ListenButton({ onListen }: { onListen?: () => void }) {
  if (!onListen) return null;
  return <IconButton icon="volume-medium-outline" label="Listen" onPress={onListen} />;
}

function Example({ text }: { text: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.accent }} />
      <Text tone="muted" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function VocabularyBody({ item, onListen }: { item: Extract<LearningItem, { type: 'vocabulary' }>; onListen?: () => void }) {
  const { colors, spacing } = useTheme();
  const meta = [item.pronunciation, item.partOfSpeech].filter(Boolean).join('  ·  ');
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg }}>
        <Text variant="display" align="center" accessibilityRole="header">
          {item.word}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {meta ? (
            <Text tone="muted" align="center">
              {meta}
            </Text>
          ) : null}
          <ListenButton onListen={onListen} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      {item.definition ? <Text variant="bodyLarge">{item.definition}</Text> : (
        <Text tone="muted">No definition yet. Add one from My Words.</Text>
      )}
      {item.example ? <Example text={item.example} /> : null}
      {item.synonyms.length > 0 ? (
        <Text variant="caption" tone="subtle">
          Similar: {item.synonyms.join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function PhraseBody({ item, onListen }: { item: Extract<LearningItem, { type: 'phrase' }>; onListen?: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md }}>
        <Text variant="title" align="center" accessibilityRole="header">
          {item.phrase}
        </Text>
        <ListenButton onListen={onListen} />
      </View>
      <Text variant="bodyLarge">{item.meaning}</Text>
      <Example text={item.example} />
      {item.usageNote ? (
        <Text variant="caption" tone="subtle">
          {item.usageNote}
        </Text>
      ) : null}
    </View>
  );
}

function GrammarBody({ item }: { item: Extract<LearningItem, { type: 'grammar' }> }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="title" accessibilityRole="header">
        {item.rule}
      </Text>
      <Text variant="bodyLarge">{item.explanation}</Text>
      <Example text={item.example} />
    </View>
  );
}
