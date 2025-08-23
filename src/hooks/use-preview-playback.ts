import React from 'react';

export interface PreviewPlaybackContext {
  register: (el: HTMLVideoElement) => void;
  unregister: (el: HTMLVideoElement) => void;
  ensureExclusive: (el: HTMLVideoElement) => void;
  pauseAll: () => void;
}

export const PreviewPlaybackCtx = React.createContext<PreviewPlaybackContext | null>(null);

export function usePreviewPlayback(): PreviewPlaybackContext {
  const ctx = React.useContext(PreviewPlaybackCtx);
  if (ctx) return ctx;
  return {
    register: (el: HTMLVideoElement) => { void el; },
    unregister: (el: HTMLVideoElement) => { void el; },
    ensureExclusive: (el: HTMLVideoElement) => { void el; },
    pauseAll: () => { /* noop */ },
  };
}
