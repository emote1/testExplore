import { useEffect, useState } from 'react';

/**
 * Measures FPS via requestAnimationFrame and reports a rolling average every `updateMs`.
 * Lightweight — adds ~1 RAF callback that does only counter math.
 *
 * Use under a flag so it doesn't run in production:
 *   const fps = useFps(enabled ? 500 : 0);
 *
 * Passing 0 disables the measurement loop entirely.
 */
export function useFps(updateMs: number = 500): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (updateMs <= 0) return;

    let frames = 0;
    let last = performance.now();
    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      frames++;
      const now = performance.now();
      const elapsed = now - last;
      if (elapsed >= updateMs) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [updateMs]);

  return fps;
}
