import { Pressable, View } from 'react-native';

import { Text } from './Text';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Text variant="label" tone="subtle">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" tone="accent" style={{ fontWeight: '600' }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
