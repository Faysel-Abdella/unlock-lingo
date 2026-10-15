import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, ProgressBar, Screen, Text } from '@/components';
import { LEVEL_DESCRIPTIONS } from '@/features/onboarding/levels';
import { useSaveProfile } from '@/features/settings/hooks';
import type { UserProfile } from '@/features/settings/schema';
import {
  CEFR_LEVELS,
  type CefrLevel,
  INTERESTS,
  INTEREST_LABELS,
  type Interest,
  LANGUAGES,
  LANGUAGES_WITH_CONTENT,
  type LanguageCode,
  cefrIndex,
} from '@/types/language';
import { useTheme } from '@/theme/ThemeProvider';

const STEPS = ['welcome', 'language', 'native', 'level', 'target', 'interests'] as const;
type Step = (typeof STEPS)[number];
const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];
/** C2 is reserved for later content; onboarding offers A1–C1 as current level. */
const CURRENT_LEVELS = CEFR_LEVELS.filter((l) => l !== 'C2');

export default function Onboarding() {
  const { spacing } = useTheme();
  const save = useSaveProfile();
  const [step, setStep] = useState<Step>('welcome');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('en');
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode | null>(null);
  const [currentLevel, setCurrentLevel] = useState<CefrLevel>('B1');
  const [targetLevel, setTargetLevel] = useState<CefrLevel>('C1');
  const [interests, setInterests] = useState<Interest[]>(['general']);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)] as Step);
  const back = () => setStep(STEPS[Math.max(index - 1, 0)] as Step);

  const finish = async () => {
    const profile: UserProfile = {
      targetLanguage,
      nativeLanguage: nativeLanguage === targetLanguage ? null : nativeLanguage,
      currentLevel,
      targetLevel: cefrIndex(targetLevel) < cefrIndex(currentLevel) ? currentLevel : targetLevel,
      interests: interests.length > 0 ? interests : ['general'],
      onboardedAt: Date.now(),
    };
    await save.mutateAsync(profile);
    router.replace('/(tabs)');
  };

  const toggleInterest = (interest: Interest) =>
    setInterests((list) => (list.includes(interest) ? list.filter((i) => i !== interest) : [...list, interest]));

  const isLast = step === 'interests';
  const footer =
    step === 'welcome' ? (
      <Button label="Get started" onPress={next} />
    ) : (
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button label="Back" variant="secondary" onPress={back} style={{ flex: 1 }} />
        <Button
          label={isLast ? 'Start learning' : 'Continue'}
          onPress={isLast ? finish : next}
          loading={save.isPending}
          style={{ flex: 2 }}
        />
      </View>
    );

  return (
    <Screen footer={footer} edges={['top', 'bottom']}>
      {step !== 'welcome' ? <ProgressBar value={index / (STEPS.length - 1)} height={4} /> : null}

      {step === 'welcome' ? (
        <View style={{ gap: spacing.lg, paddingTop: spacing.xxxl }}>
          <Text variant="label" tone="accent">
            Unlock Lingo
          </Text>
          <Text variant="title">You don’t open the language app.</Text>
          <Text variant="title" tone="muted">
            It meets you during your day.
          </Text>
          <Text variant="bodyLarge" tone="muted">
            Learn in moments you already have: when your alarm rings and when you pick up your phone. Each moment
            takes a few seconds, and spaced repetition makes sure you review words just before you forget them.
          </Text>
        </View>
      ) : null}

      {step === 'language' ? (
        <Question title="Which language are you learning?" hint="More languages are on the way. The app is built for them.">
          <ChipGroup>
            {LANGUAGE_CODES.map((code) => {
              const available = LANGUAGES_WITH_CONTENT.includes(code);
              return (
                <Chip
                  key={code}
                  label={available ? LANGUAGES[code].name : `${LANGUAGES[code].name} · soon`}
                  selected={targetLanguage === code}
                  disabled={!available}
                  onPress={() => setTargetLanguage(code)}
                />
              );
            })}
          </ChipGroup>
        </Question>
      ) : null}

      {step === 'native' ? (
        <Question
          title="What is your first language?"
          hint="Used for translation exercises when a translation is available. You can skip this."
        >
          <ChipGroup>
            {LANGUAGE_CODES.filter((c) => c !== targetLanguage).map((code) => (
              <Chip
                key={code}
                label={LANGUAGES[code].name}
                selected={nativeLanguage === code}
                onPress={() => setNativeLanguage(nativeLanguage === code ? null : code)}
              />
            ))}
          </ChipGroup>
        </Question>
      ) : null}

      {step === 'level' ? (
        <Question title="What is your level now?" hint="A rough guess is fine. The app adapts as you answer.">
          <LevelList levels={CURRENT_LEVELS} selected={currentLevel} onSelect={setCurrentLevel} />
        </Question>
      ) : null}

      {step === 'target' ? (
        <Question title="Where do you want to get to?">
          <LevelList
            levels={CEFR_LEVELS.filter((l) => cefrIndex(l) >= cefrIndex(currentLevel))}
            selected={targetLevel}
            onSelect={setTargetLevel}
          />
        </Question>
      ) : null}

      {step === 'interests' ? (
        <Question title="What do you use the language for?" hint="Examples and new words lean towards these topics.">
          <ChipGroup>
            {INTERESTS.map((interest) => (
              <Chip
                key={interest}
                label={INTEREST_LABELS[interest]}
                selected={interests.includes(interest)}
                onPress={() => toggleInterest(interest)}
              />
            ))}
          </ChipGroup>
        </Question>
      ) : null}
    </Screen>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
      <Text variant="title">{title}</Text>
      {hint ? <Text tone="muted">{hint}</Text> : null}
      {children}
    </View>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}

function LevelList({
  levels,
  selected,
  onSelect,
}: {
  levels: readonly CefrLevel[];
  selected: CefrLevel;
  onSelect: (level: CefrLevel) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {levels.map((level) => {
        const active = level === selected;
        return (
          <Pressable
            key={level}
            onPress={() => onSelect(level)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${level}, ${LEVEL_DESCRIPTIONS[level]}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.accentSoft : colors.surface,
            }}
          >
            <Text variant="heading" tone={active ? 'accent' : 'default'} style={{ width: 36 }}>
              {level}
            </Text>
            <Text tone="muted" style={{ flex: 1 }}>
              {LEVEL_DESCRIPTIONS[level]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
