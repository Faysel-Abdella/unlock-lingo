import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlarmRuntime } from '@/features/alarms/AlarmRuntime';
import { useProfile, useSettings } from '@/features/settings/hooks';
import { WeeklyReminderRuntime } from '@/features/reviews/WeeklyReminderRuntime';
import { UnlockRuntime } from '@/features/unlock/UnlockRuntime';
import { RepositoriesProvider } from '@/hooks/useRepositories';
import { DatabaseProvider } from '@/services/database/DatabaseProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    // Data is local: no retries, no refetch on reconnect; refresh is driven by invalidation.
    queries: { retry: false, staleTime: 30_000, refetchOnReconnect: false },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <QueryClientProvider client={queryClient}>
          <RepositoriesProvider>
            <AppShell />
          </RepositoriesProvider>
        </QueryClientProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const settings = useSettings();
  const profile = useProfile();
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });
  // A font failure falls back to the system font rather than blocking the app.
  const ready = !settings.isPending && !profile.isPending && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <ThemeProvider preference={settings.data?.theme ?? 'system'}>
      <Navigator />
    </ThemeProvider>
  );
}

function Navigator() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AlarmRuntime />
      <UnlockRuntime />
      <WeeklyReminderRuntime />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="vocabulary/index" options={{ title: 'Vocabulary' }} />
        <Stack.Screen name="vocabulary/[id]" options={{ title: '' }} />
        <Stack.Screen name="words/add" options={{ title: 'Add a word', presentation: 'modal' }} />
        <Stack.Screen name="words/[id]" options={{ title: '' }} />
        <Stack.Screen name="alarms/index" options={{ title: 'Alarms' }} />
        <Stack.Screen name="alarms/[id]" options={{ title: 'Alarm' }} />
        <Stack.Screen name="weekly-review" options={{ title: 'Weekly review' }} />
        <Stack.Screen name="unlock-settings" options={{ title: 'Unlock learning' }} />
        <Stack.Screen name="card" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="alarm/ring" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}
