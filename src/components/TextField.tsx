import { TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, style, ...rest }: TextFieldProps) {
  const { colors, radius, spacing, typography, touchTarget } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" tone="subtle">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSubtle}
        {...rest}
        style={[
          {
            ...typography.body,
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.borderStrong,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            minHeight: rest.multiline ? 96 : touchTarget,
            textAlignVertical: rest.multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
