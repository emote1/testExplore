import React from 'react';
import { PreviewPlaybackCtx } from '../hooks/use-preview-playback';

export function PreviewPlaybackProvider({ children, maxConcurrent = 1 }: { children: React.ReactNode; maxConcurrent?: number }) {
  const elementsRef = React.useRef<Set<HTMLVideoElement>>(new Set());

  const register = React.useCallback((el: HTMLVideoElement) => {
    elementsRef.current.add(el);
  }, []);

  const unregister = React.useCallback((el: HTMLVideoElement) => {
    elementsRef.current.delete(el);
    try { el.pause(); } catch (e) { void e; }
  }, []);

  const pauseAll = React.useCallback(() => {
    elementsRef.current.forEach((v) => { try { v.pause(); } catch (e) { void e; } });
  }, []);

  const ensureExclusive = React.useCallback((el: HTMLVideoElement) => {
    // If maxConcurrent > 1, allow up to N, otherwise pause others.
    if (maxConcurrent <= 1) {
      elementsRef.current.forEach((v) => { if (v !== el) { try { v.pause(); } catch (e) { void e; } } });
      return;
    }
    // For N>1, keep the provided el and up to N-1 others; pause the rest.
    let kept = 1;
    elementsRef.current.forEach((v) => {
      if (v === el) return;
      if (kept < maxConcurrent) {
        kept += 1;
      } else {
        try { v.pause(); } catch (e) { void e; }
      }
    });
  }, [maxConcurrent]);

  const value = React.useMemo(() => ({ register, unregister, ensureExclusive, pauseAll }), [register, unregister, ensureExclusive, pauseAll]);

  return <PreviewPlaybackCtx.Provider value={value}>{children}</PreviewPlaybackCtx.Provider>;
}
