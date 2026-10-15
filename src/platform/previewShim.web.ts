/**
 * Web preview only. In sandboxed or file:// pages (an opaque origin) the browser
 * refuses history.pushState/replaceState. Expo Router keeps its own navigation
 * state, so URL updates can be skipped. Once that happens, browser-history
 * traversal (back/go) must be skipped too: no entries were pushed, so going
 * back would leave the app instead of returning to the previous screen.
 */
const history = globalThis.history as History | undefined;
if (history) {
  let detached = false;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History['pushState']>) => {
      if (detached) return;
      try {
        original(...args);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
        detached = true;
      }
    };
  }
  for (const method of ['back', 'forward', 'go'] as const) {
    const original = history[method].bind(history) as (delta?: number) => void;
    history[method] = (delta?: number) => {
      if (!detached) original(delta);
    };
  }
}
