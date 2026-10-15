import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, IconButton, Text } from '@/components';
import { type ChoiceQuestion, isAnswerCorrect } from '@/features/learning/domain/exercises';
import { useTheme } from '@/theme/ThemeProvider';
import { createStopwatch } from '@/utils/date';

interface QuizCardProps {
  question: ChoiceQuestion;
  onAnswer: (correct: boolean, responseMs: number) => void;
  onContinue: () => void;
  onListen?: (text: string) => void;
  onListenSlow?: (text: string) => void;
  autoPlay?: boolean;
}

/** Display size is reserved for single words; sentences step down so they stay readable. */
function subjectVariant(subject: string): 'display' | 'title' | 'heading' {
  if (subject.length <= 16 && !subject.includes(' ')) return 'display';
  if (subject.length <= 48) return 'title';
  return 'heading';
}

/** One multiple-choice question: a single tap answers, a second tap continues. */
export function QuizCard({ question, onAnswer, onContinue, onListen, onListenSlow, autoPlay }: QuizCardProps) {
  const { colors, radius, spacing } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [stopwatch] = useState(createStopwatch);

  useEffect(() => {
    stopwatch.restart();
    if (question.audioText && onListen && (autoPlay || question.exerciseType === 'listening')) {
      onListen(question.audioText);
    }
    // Play once when the question appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const answered = selected !== null;
  const correct = answered && isAnswerCorrect(question, selected);

  const choose = (index: number) => {
    if (answered) return;
    setSelected(index);
    onAnswer(isAnswerCorrect(question, index), stopwatch.elapsedMs());
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Text variant="label" tone="accent">
        {question.prompt}
      </Text>

      {question.subject ? (
        <Text variant={subjectVariant(question.subject)} accessibilityRole="header">
          {question.subject}
        </Text>
      ) : null}

      {question.audioText && onListen ? (
        <Pressable
          onPress={() => onListen(question.audioText ?? '')}
          accessibilityRole="button"
          accessibilityLabel="Play audio"
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={({ pressed }) => ({
            alignSelf: 'center',
            width: 88,
            height: 88,
            borderRadius: radius.pill,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="volume-high" size={36} color={colors.accent} />
        </Pressable>
      ) : null}
      {question.audioText && onListenSlow ? (
        <View style={{ alignSelf: 'center' }}>
          <IconButton icon="speedometer-outline" label="Play slowly" onPress={() => onListenSlow(question.audioText ?? '')} />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {question.options.map((option, index) => {
          const isCorrectOption = index === question.correctIndex;
          const isChosen = index === selected;
          const letter = String.fromCharCode(65 + index);
          let border = colors.borderStrong;
          let background = colors.surface;
          let badgeBg = colors.surfaceMuted;
          let badgeFg = colors.textMuted;
          let icon: keyof typeof Ionicons.glyphMap | null = null;
          if (answered && isCorrectOption) {
            border = colors.success;
            background = colors.successSoft;
            badgeBg = colors.success;
            badgeFg = colors.surface;
            icon = 'checkmark-circle';
          } else if (answered && isChosen) {
            border = colors.danger;
            background = colors.dangerSoft;
            badgeBg = colors.danger;
            badgeFg = colors.surface;
            icon = 'close-circle';
          }
          const state = answered ? (isCorrectOption ? ', correct answer' : isChosen ? ', your answer, incorrect' : '') : '';
          return (
            <Pressable
              key={`${index}-${option}`}
              onPress={() => choose(index)}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={`${letter}: ${option}${state}`}
              accessibilityState={{ disabled: answered, selected: isChosen }}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 56,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: pressed ? colors.surfaceMuted : background,
                overflow: 'hidden',
                opacity: answered && !isChosen && !isCorrectOption ? 0.5 : 1,
              })}
            >
              <View
                style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text variant="captionStrong" style={{ color: badgeFg }}>
                  {letter}
                </Text>
              </View>
              <Text style={{ flex: 1 }}>{option}</Text>
              {icon ? <Ionicons name={icon} size={22} color={isCorrectOption ? colors.success : colors.danger} /> : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View
          style={{
            gap: spacing.sm,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: correct ? colors.successSoft : colors.dangerSoft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons
              name={correct ? 'checkmark-circle' : 'information-circle'}
              size={22}
              color={correct ? colors.success : colors.danger}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text variant="bodyStrong" tone={correct ? 'success' : 'danger'} accessibilityLiveRegion="polite">
              {correct ? 'Correct' : `The answer is “${question.options[question.correctIndex] ?? ''}”`}
            </Text>
          </View>
          {question.explanation ? <Text tone="muted">{question.explanation}</Text> : null}
          <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.xs }} />
        </View>
      ) : null}
    </View>
  );
}
