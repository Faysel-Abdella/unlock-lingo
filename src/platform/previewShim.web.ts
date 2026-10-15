/**
 * Web preview only. In sandboxed or file:// pages (an opaque origin) the browser
 * refuses history.pushState/replaceState. Expo Router keeps its own navigation
 * state, so ignoring the URL update keeps the app usable there.
 */
const history = globalThis.history as History | undefined;
if (history) {
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History['pushState']>) => {
      try {
        original(...args);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
      }
    };
  }
}
