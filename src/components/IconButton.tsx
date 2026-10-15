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

export function IconButton({ icon, onPress, label, active, size = 22 }: IconButtonProps) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.accentSoft : pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Ionicons name={icon} size={size} color={active ? colors.accent : colors.textMuted} />
    </Pressable>
  );
}
