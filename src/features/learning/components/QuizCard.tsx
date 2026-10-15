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
  autoPlay?: boolean;
}

/** One multiple-choice question: a single tap answers, a second tap continues. */
export function QuizCard({ question, onAnswer, onContinue, onListen, autoPlay }: QuizCardProps) {
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
      <Text variant="label" tone="subtle">
        {question.prompt}
      </Text>

      {question.subject ? (
        <Text variant={question.subject.length > 40 ? 'heading' : 'display'} accessibilityRole="header">
          {question.subject}
        </Text>
      ) : null}

      {question.audioText && onListen ? (
        <View style={{ alignItems: 'center' }}>
          <IconButton
            icon="volume-high-outline"
            label="Play audio"
            size={32}
            onPress={() => onListen(question.audioText ?? '')}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {question.options.map((option, index) => {
          const isCorrectOption = index === question.correctIndex;
          const isChosen = index === selected;
          let border = colors.border;
          let background = colors.surface;
          let icon: keyof typeof Ionicons.glyphMap | null = null;
          if (answered && isCorrectOption) {
            border = colors.success;
            background = colors.successSoft;
            icon = 'checkmark-circle';
          } else if (answered && isChosen) {
            border = colors.danger;
            background = colors.dangerSoft;
            icon = 'close-circle';
          }
          return (
            <Pressable
              key={`${index}-${option}`}
              onPress={() => choose(index)}
              disabled={answered}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ disabled: answered, selected: isChosen }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 56,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: background,
                opacity: answered && !isChosen && !isCorrectOption ? 0.55 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ flex: 1 }}>{option}</Text>
              {icon ? <Ionicons name={icon} size={22} color={isCorrectOption ? colors.success : colors.danger} /> : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="bodyStrong" tone={correct ? 'success' : 'danger'} accessibilityLiveRegion="polite">
            {correct ? 'Correct' : `Answer: ${question.options[question.correctIndex] ?? ''}`}
          </Text>
          {question.explanation ? <Text tone="muted">{question.explanation}</Text> : null}
          <Button label="Continue" onPress={onContinue} />
        </View>
      ) : null}
    </View>
  );
}
