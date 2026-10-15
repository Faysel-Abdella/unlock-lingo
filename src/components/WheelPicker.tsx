import { useEffect, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { wheelIndex, wrapIndex } from '@/utils/wheel';

import { Text } from './Text';

export const WHEEL_ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;

interface WheelPickerProps {
  /** Display labels, one per row. */
  items: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  /** Accessible name, e.g. "Hour". */
  label: string;
  width?: number;
}

/**
 * Scroll-to-select column (iOS/Android clock style). Rows snap to the centre;
 * tapping a row selects it. For screen readers it is one adjustable control:
 * swipe up/down to change the value.
 */
export function WheelPicker({ items, selectedIndex, onChange, label, width = 96 }: WheelPickerProps) {
  const { colors, radius, typography } = useTheme();
  const scroll = useRef<ScrollView>(null);
  const [centred, setCentred] = useState(selectedIndex);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pad = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

  // Keep the wheel in place when the value changes from outside (or on mount).
  useEffect(() => {
    scroll.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  const commit = (offset: number) => {
    const index = wheelIndex(offset, WHEEL_ITEM_HEIGHT, items.length);
    setCentred(index);
    if (index !== selectedIndex) onChange(index);
    else scroll.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    setCentred(wheelIndex(offset, WHEEL_ITEM_HEIGHT, items.length));
    // The web has no momentum events: commit once scrolling pauses.
    if (Platform.OS === 'web') {
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => commit(offset), 140);
    }
  };

  const step = (delta: number) => onChange(wrapIndex(selectedIndex, delta, items.length));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[selectedIndex] ?? '' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ width, height: WHEEL_ITEM_HEIGHT * VISIBLE_ROWS }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: pad,
          left: 0,
          right: 0,
          height: WHEEL_ITEM_HEIGHT,
          borderRadius: radius.md,
          backgroundColor: colors.accentSoft,
        }}
      />
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_HEIGHT }}
        contentContainerStyle={{ paddingVertical: pad }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        nestedScrollEnabled
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={Platform.OS === 'web' ? ({ scrollSnapType: 'y mandatory' } as object) : undefined}
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - centred);
          return (
            <Pressable
              key={item}
              onPress={() => onChange(index)}
              style={[
                { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
                Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : null,
              ]}
            >
              <Text
                style={{
                  ...typography.title,
                  color: distance === 0 ? colors.accent : colors.textMuted,
                  opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.35,
                }}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
