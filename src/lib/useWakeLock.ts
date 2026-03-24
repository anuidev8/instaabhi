import { useEffect, useRef } from 'react';

/**
 * Requests a Screen Wake Lock while `active` is true.
 * Automatically re-acquires the lock if the page becomes visible again
 * (browsers release wake locks when the tab is backgrounded).
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  async function acquire() {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Permission denied or not supported — silently ignore
    }
  }

  function release() {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }

  useEffect(() => {
    if (!active) {
      release();
      return;
    }

    acquire();

    // Re-acquire when the user returns to the tab (browsers auto-release on hide)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && active) {
        acquire();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active]);
}
