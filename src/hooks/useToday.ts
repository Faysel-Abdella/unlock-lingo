import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toDateKey } from '@/utils/date';

/** Today's local date key; updates when the app returns to the foreground on a new day. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(Date.now()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toDateKey(Date.now()));
    });
    return () => sub.remove();
  }, []);
  return today;
}
