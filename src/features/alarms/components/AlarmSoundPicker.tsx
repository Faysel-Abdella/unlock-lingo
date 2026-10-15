import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Text } from '@/components';
import { SettingRow } from '@/features/settings/components';
import { alarmClock } from '@/native/alarmClock';
import { useTheme } from '@/theme/ThemeProvider';

import type { AlarmSound } from '../domain/types';
import { useAlarmSounds } from '../hooks';

const DEFAULT_TITLE = 'Default alarm sound';

/** Chooses the alarm's sound from the device's alarm sounds, previewing each choice. */
export function AlarmSoundPicker({ value, onChange }: { value: AlarmSound | null; onChange: (sound: AlarmSound | null) => void }) {
  const { colors, spacing, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const sounds = useAlarmSounds(open);

  // Never leave a preview playing behind the editor.
  useEffect(() => () => alarmClock.stopPreview(), []);

  const choose = (sound: AlarmSound | null) => {
    onChange(sound);
    alarmClock.previewSound(sound?.uri ?? null);
  };

  const close = () => {
    alarmClock.stopPreview();
    setOpen(false);
  };

  const options: (AlarmSound | null)[] = [null, ...(sounds.data ?? [])];
  const hint = alarmClock.isAvailable ? undefined : 'Choosing a sound is available in the Android app.';

  return (
    <SettingRow label="Sound" hint={hint}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text style={{ flex: 1 }} numberOfLines={1}>
          {value?.title ?? DEFAULT_TITLE}
        </Text>
        {alarmClock.isAvailable ? (
          <Button label={open ? 'Done' : 'Change'} variant="secondary" onPress={open ? close : () => setOpen(true)} />
        ) : null}
      </View>
      {open ? (
        <View
          accessibilityRole="radiogroup"
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }}
        >
          {sounds.isPending ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            options.map((sound, index) => {
              const selected = (sound?.uri ?? null) === (value?.uri ?? null);
              return (
                <Pressable
                  key={sound?.uri ?? 'default'}
                  onPress={() => choose(sound)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={sound?.title ?? DEFAULT_TITLE}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: 48,
                    paddingHorizontal: spacing.md,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.surfaceMuted : selected ? colors.accentSoft : 'transparent',
                  })}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.accent : colors.textSubtle}
                  />
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {sound?.title ?? DEFAULT_TITLE}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </SettingRow>
  );
}
