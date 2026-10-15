import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  active?: boolean;
  size?: number;
}

/** Icon-only control: 48dp target, accessible name and selected state. */
export function IconButton({ icon, onPress, label, active, size }: IconButtonProps) {
  const { colors, radius, touchTarget, iconSize } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      android_ripple={{ color: colors.ripple, borderless: true, radius: touchTarget / 2 }}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.accentSoft : pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Ionicons name={icon} size={size ?? iconSize.md} color={active ? colors.accent : colors.textMuted} />
    </Pressable>
  );
}
