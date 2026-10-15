import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface ListRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  /** Short status on the right, e.g. "On". */
  value?: string;
  onPress?: () => void;
  first?: boolean;
}

/** One row of a grouped list. Use inside `ListGroup` so rows share one surface and hairline dividers. */
export function ListRow({ icon, title, subtitle, value, onPress, first }: ListRowProps) {
  const { colors, radius, spacing, iconSize } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <View
        style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={icon} size={iconSize.md} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="captionStrong" tone="muted">
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textSubtle} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
    </View>
  );
  const divider = { borderTopWidth: first ? 0 : 1, borderTopColor: colors.border };
  if (!onPress) return <View style={divider}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
      android_ripple={{ color: colors.ripple }}
      style={({ pressed }) => [divider, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

export function ListGroup({ children }: { children: React.ReactNode }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' }}>
      {children}
    </View>
  );
}
