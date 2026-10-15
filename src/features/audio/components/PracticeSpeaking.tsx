import { useState } from 'react';

import { Button, Card } from '@/components';
import { usePronunciation } from '@/hooks/usePronunciation';
import { speechRecognitionProvider } from '@/services/audio/speechRecognition';
import type { LearningItem } from '@/types/learning';

import { speakableText } from '../domain/pronunciation';
import { usePronunciationPractice } from '../usePronunciationPractice';
import { SpeakCard } from './SpeakCard';

/** "Practise saying it" on detail screens. Hidden when the item or device cannot support it. */
export function PracticeSpeaking({ item }: { item: LearningItem }) {
  const text = speakableText(item);
  const [open, setOpen] = useState(false);
  if (!text || !speechRecognitionProvider.isAvailable()) return null;
  if (!open) return <Button label="Practise saying it" variant="secondary" icon="mic-outline" onPress={() => setOpen(true)} />;
  return <OpenPractice item={item} text={text} />;
}

function OpenPractice({ item, text }: { item: LearningItem; text: string }) {
  const speak = usePronunciation();
  const practice = usePronunciationPractice({ itemId: item.id, expected: text });
  return (
    <Card>
      <SpeakCard
        text={text}
        hint={null}
        state={practice.state}
        attempts={practice.attempts}
        onListen={() => speak(text)}
        onListenSlow={() => speak(text, { slow: true })}
        onSpeak={() => void practice.listen()}
        onStop={practice.stop}
      />
    </Card>
  );
}
