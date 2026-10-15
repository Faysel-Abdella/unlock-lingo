import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';

import { IconButton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.xs,
      }}
      accessibilityLabel={`${label}: ${value}`}
    >
      <IconButton icon="remove" label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, value - step))} />
      <Text variant="heading" style={{ minWidth: 32, textAlign: 'center' }}>
        {value}
      </Text>
      <IconButton icon="add" label={`Increase ${label}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.accent, false: colors.surfaceMuted }}
      />
    </View>
  );
}
