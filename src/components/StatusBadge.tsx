import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { LearningStatus } from '@/types/learning';

import { Text } from './Text';

export const STATUS_LABEL: Record<LearningStatus, string> = {
  new: 'New',
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
  difficult: 'Difficult',
};

/** Dot + label: the text carries the meaning, colour only reinforces it. */
export function StatusBadge({ status }: { status: LearningStatus }) {
  const { colors, radius, spacing } = useTheme();
  const tone = {
    new: colors.textSubtle,
    learning: colors.warning,
    reviewing: colors.accent,
    mastered: colors.success,
    difficult: colors.danger,
  }[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
      <Text variant="captionStrong" style={{ color: tone }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}
