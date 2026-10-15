import type { LearningStatus } from '@/types/learning';
import { useTheme } from '@/theme/ThemeProvider';
import { View } from 'react-native';

import { Text } from './Text';

export const STATUS_LABEL: Record<LearningStatus, string> = {
  new: 'New',
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
  difficult: 'Difficult',
};

export function StatusBadge({ status }: { status: LearningStatus }) {
  const { colors, radius, spacing } = useTheme();
  const tone = {
    new: { bg: colors.surfaceMuted, fg: colors.textMuted },
    learning: { bg: colors.warningSoft, fg: colors.warning },
    reviewing: { bg: colors.accentSoft, fg: colors.accent },
    mastered: { bg: colors.successSoft, fg: colors.success },
    difficult: { bg: colors.dangerSoft, fg: colors.danger },
  }[status];
  return (
    <View style={{ backgroundColor: tone.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      <Text variant="caption" style={{ color: tone.fg, fontWeight: '600' }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}
