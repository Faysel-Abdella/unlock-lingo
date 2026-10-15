import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorPalette, TypographyVariant } from '@/theme/tokens';

type Tone = 'default' | 'muted' | 'subtle' | 'accent' | 'success' | 'danger' | 'warning' | 'onAccent';

const TONE: Record<Tone, keyof ColorPalette> = {
  default: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  accent: 'accent',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  onAccent: 'onAccent',
};

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  return (
    <RNText
      {...rest}
      style={[typography[variant] as TextStyle, { color: colors[TONE[tone]], textAlign: align }, style]}
    />
  );
}
