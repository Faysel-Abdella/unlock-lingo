import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
      <Ionicons name={icon} size={36} color={colors.textSubtle} />
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text tone="muted" align="center" style={{ maxWidth: 300 }}>
        {message}
      </Text>
      {action ? <View style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}
