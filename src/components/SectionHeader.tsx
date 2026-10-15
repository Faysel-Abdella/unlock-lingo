import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { spacing, touchTarget } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}
      accessibilityRole="header"
    >
      <Text variant="label" tone="subtle">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={{ minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs }}
        >
          <Text variant="captionStrong" tone="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
