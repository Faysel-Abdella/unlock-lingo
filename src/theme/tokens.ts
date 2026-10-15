import { Platform, type ViewStyle } from 'react-native';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  /** The word on a learning card: the single focal point of the screen. */
  display: { fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  bodyLarge: { fontSize: 18, lineHeight: 27, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  stat: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
}

export const lightColors: ColorPalette = {
  background: '#F7F6F2',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEEE9',
  border: '#E3E1DA',
  text: '#1A1D1B',
  textMuted: '#5F6662',
  textSubtle: '#8E948F',
  accent: '#2F6B4F',
  accentSoft: '#E3EFE8',
  onAccent: '#FFFFFF',
  success: '#2F7D4F',
  successSoft: '#E2F2E8',
  danger: '#B4443C',
  dangerSoft: '#F8E5E3',
  warning: '#9A6A12',
  warningSoft: '#F6EDD9',
};

export const darkColors: ColorPalette = {
  background: '#111312',
  surface: '#1A1D1B',
  surfaceMuted: '#232725',
  border: '#2D322F',
  text: '#ECEEEA',
  textMuted: '#A3AAA5',
  textSubtle: '#737A75',
  accent: '#86C9A5',
  accentSoft: '#1F3329',
  onAccent: '#0E1A14',
  success: '#7DCB9A',
  successSoft: '#1C3326',
  danger: '#EE8F86',
  dangerSoft: '#3A2220',
  warning: '#E2B65C',
  warningSoft: '#352B17',
};

export function cardShadow(scheme: 'light' | 'dark'): ViewStyle {
  if (scheme === 'dark') return {};
  return Platform.select<ViewStyle>({
    android: { elevation: 1 },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
  });
}
