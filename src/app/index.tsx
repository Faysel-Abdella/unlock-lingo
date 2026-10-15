import { Redirect } from 'expo-router';

import { useProfile } from '@/features/settings/hooks';

/** Entry gate: first launch goes to onboarding, afterwards straight to the dashboard. */
export default function Index() {
  const { data: profile, isPending } = useProfile();
  if (isPending) return null;
  return <Redirect href={profile?.onboardedAt ? '/(tabs)' : '/onboarding'} />;
}
