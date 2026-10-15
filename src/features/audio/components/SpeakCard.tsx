import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, IconButton, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

import type { PracticeState } from '../usePronunciationPractice';

/** After this many attempts the card stops nudging and simply offers to continue. */
export const SPEAK_ATTEMPTS = 3;

interface SpeakCardProps {
  text: string;
  hint: string | null;
  state: PracticeState;
  attempts: number;
  onListen: () => void;
  onListenSlow: () => void;
  onSpeak: () => void;
  onStop: () => void;
  /** Leaves the exercise; `clear` reports whether the last attempt was understood. */
  onDone?: (clear: boolean) => void;
}

function feedback(state: PracticeState): { tone: 'success' | 'warning' | 'danger' | 'muted'; text: string } | null {
  switch (state.status) {
    case 'scored': {
      const heard = state.score.heard ? `“${state.score.heard}”` : 'something else';
      if (state.score.verdict === 'clear') return { tone: 'success', text: `Clear. We heard ${heard}.` };
      if (state.score.verdict === 'close') return { tone: 'warning', text: `Almost. We heard ${heard}.` };
      return { tone: 'danger', text: `We heard ${heard}. Listen once more, then try again.` };
    }
    case 'silence':
      return { tone: 'muted', text: 'We didn’t catch that. Try again a little closer to the microphone.' };
    case 'blocked':
      return { tone: 'muted', text: state.message };
    default:
      return null;
  }
}

/** "Say it" exercise: speak the word, see whether a speech recogniser understood it. */
export function SpeakCard({ text, hint, state, attempts, onListen, onListenSlow, onSpeak, onStop, onDone }: SpeakCardProps) {
  const { colors, radius, spacing } = useTheme();
  const listening = state.status === 'listening';
  const understood = state.status === 'scored' && state.score.verdict !== 'unclear';
  const message = feedback(state);
  const finished = understood || attempts >= SPEAK_ATTEMPTS || state.status === 'blocked';

  return (
    <View style={{ gap: spacing.lg }}>
      <Text variant="label" tone="accent">
        Say it out loud
      </Text>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text variant={text.includes(' ') ? 'title' : 'display'} align="center" accessibilityRole="header">
          {text}
        </Text>
        {hint ? (
          <Text tone="muted" align="center">
            {hint}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="volume-medium-outline" label="Listen" onPress={onListen} />
          <IconButton icon="speedometer-outline" label="Listen slowly" onPress={onListenSlow} />
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          onPress={listening ? onStop : onSpeak}
          disabled={state.status === 'blocked'}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Speak'}
          accessibilityState={{ busy: listening, disabled: state.status === 'blocked' }}
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={({ pressed }) => ({
            width: 88,
            height: 88,
            borderRadius: radius.pill,
            backgroundColor: listening ? colors.accent : colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: state.status === 'blocked' ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          {listening ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="mic" size={36} color={colors.accent} />}
        </Pressable>
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {listening ? 'Listening…' : attempts === 0 ? 'Tap and say it' : `Attempt ${attempts} of ${SPEAK_ATTEMPTS}`}
        </Text>
      </View>

      {message ? (
        <Text tone={message.tone} align="center" accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      ) : null}

      {onDone ? (
        <Button
          label={finished ? 'Continue' : 'Skip'}
          variant={finished ? 'primary' : 'secondary'}
          disabled={listening}
          onPress={() => onDone(understood)}
        />
      ) : null}
    </View>
  );
}
