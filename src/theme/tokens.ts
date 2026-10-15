import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Design tokens. Direction (ui-ux-pro-max): Minimalism & Swiss Style — flat
 * surfaces, hairline borders, strong type hierarchy, one accent, subtle motion.
 * See docs/DESIGN_SYSTEM.md for the rationale and contrast measurements.
 */

/** 4/8 spacing rhythm. */
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
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Android minimum touch target (dp); also satisfies iOS 44pt. */
export const touchTarget = 48;

export const iconSize = { sm: 18, md: 22, lg: 28 } as const;

/** Durations in ms. Motion is intentionally minimal. */
export const motion = { press: 120, quick: 180, standard: 240 } as const;

/** DM Sans: one family, four weights. Custom fonts need an explicit family per weight on Android. */
export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

export const typography = {
  /** The word on a learning card: the single focal point of the screen. */
  display: { fontFamily: fonts.bold, fontSize: 48, lineHeight: 56, letterSpacing: -1.2 },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  stat: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  /** Dividers and card outlines (decorative). */
  border: string;
  /** Control boundaries (inputs, answer options): ≥3:1 against surfaces. */
  borderStrong: string;
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
  /** Amber highlight (streaks, "learning"). */
  warning: string;
  warningSoft: string;
  ripple: string;
}

/** Every text colour measured ≥4.5:1 against background, surface and surfaceMuted. */
export const lightColors: ColorPalette = {
  background: '#F7F9F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F1',
  border: '#DFE6E3',
  borderStrong: '#7D8F8A',
  text: '#0E1B19',
  textMuted: '#475652',
  textSubtle: '#5F6E6A',
  accent: '#0F766E',
  accentSoft: '#E3F2EF',
  onAccent: '#FFFFFF',
  success: '#166534',
  successSoft: '#E3F4E8',
  danger: '#B91C1C',
  dangerSoft: '#FBE7E5',
  warning: '#92400E',
  warningSoft: '#FDF1DC',
  ripple: 'rgba(15, 118, 110, 0.12)',
};

/** Measured separately from light mode: every text colour ≥4.5:1 on dark surfaces. */
export const darkColors: ColorPalette = {
  background: '#0A1110',
  surface: '#111B19',
  surfaceMuted: '#182421',
  border: '#24312E',
  borderStrong: '#56706A',
  text: '#EAF2F0',
  textMuted: '#A9B8B4',
  textSubtle: '#8D9C98',
  accent: '#5EEAD4',
  accentSoft: '#12302B',
  onAccent: '#042F2E',
  success: '#4ADE80',
  successSoft: '#14301F',
  danger: '#F87171',
  dangerSoft: '#3A1D1C',
  warning: '#FBBF24',
  warningSoft: '#33270F',
  ripple: 'rgba(94, 234, 212, 0.16)',
};

/** Swiss style: flat surfaces. Hierarchy comes from borders and type, not shadows. */
export function cardShadow(_scheme: 'light' | 'dark'): ViewStyle {
  return {};
}
