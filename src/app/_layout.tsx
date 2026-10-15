import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useProfile, useSettings } from '@/features/settings/hooks';
import { RepositoriesProvider } from '@/hooks/useRepositories';
import { DATABASE_NAME, initializeDatabase } from '@/services/database/initialize';
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
      <Suspense fallback={null}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
          <QueryClientProvider client={queryClient}>
            <RepositoriesProvider>
              <AppShell />
            </RepositoriesProvider>
          </QueryClientProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const settings = useSettings();
  const profile = useProfile();
  const ready = !settings.isPending && !profile.isPending;

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
      </Stack>
    </>
  );
}
