import { Redirect } from 'expo-router';

/** Unknown paths (e.g. a static host serving /index.html) go to the entry gate. */
export default function NotFound() {
  return <Redirect href="/" />;
}
