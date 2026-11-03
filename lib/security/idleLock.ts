/** Default inactivity window before quick-unlock lock (15 minutes). */
export const IDLE_LOCK_MS = 15 * 60 * 1000;

const DEFAULT_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

/**
 * Watches user activity and invokes `onIdle` after `timeoutMs` of inactivity.
 * Returns a cleanup function that removes listeners and clears the timer.
 */
export function createIdleWatcher(
  onIdle: () => void,
  timeoutMs: number = IDLE_LOCK_MS,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onIdle();
    }, timeoutMs);
  };

  const onActivity = () => {
    reset();
  };

  for (const event of DEFAULT_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true });
  }

  reset();

  return () => {
    if (timer) clearTimeout(timer);
    for (const event of DEFAULT_EVENTS) {
      window.removeEventListener(event, onActivity);
    }
  };
}
