import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { ThemePreference } from '@/features/settings/schema';

import {
  type ColorPalette,
  cardShadow,
  darkColors,
  fonts,
  iconSize,
  lightColors,
  motion,
  radius,
  spacing,
  touchTarget,
  typography,
} from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fonts: typeof fonts;
  iconSize: typeof iconSize;
  motion: typeof motion;
  touchTarget: number;
  shadow: ReturnType<typeof cardShadow>;
}

function buildTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    fonts,
    iconSize,
    motion,
    touchTarget,
    shadow: cardShadow(scheme),
  };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
