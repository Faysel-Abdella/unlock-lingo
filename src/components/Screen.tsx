import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Content pinned below the scrollable area, e.g. a primary action. */
  footer?: ReactNode;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = true, footer, edges = ['top'], contentStyle }: ScreenProps) {
  const { colors, spacing } = useTheme();
  const padding = { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg };
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[padding, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, padding, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm }}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
