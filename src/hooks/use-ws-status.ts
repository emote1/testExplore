import { useEffect, useRef, useState } from 'react';

export interface WsStatus {
  text: string;
  tone: 'live' | 'warning' | 'error' | 'info';
}

export function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>({ text: 'Live', tone: 'live' });
  const retryEndRef = useRef<number | null>(null);
  const retryAttemptRef = useRef<number>(1);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    retryEndRef.current = null;
  }

  function startCountdown() {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      if (retryEndRef.current == null) return;
      const remaining = Math.max(0, retryEndRef.current - Date.now());
      const secs = Math.max(0.1, Math.round(remaining / 100) / 10);
      if (remaining <= 0) {
        clearTimer();
        setStatus({ text: `Reconnecting... (attempt ${retryAttemptRef.current})`, tone: 'warning' });
      } else {
        setStatus({ text: `Reconnecting in ${secs}s (attempt ${retryAttemptRef.current})`, tone: 'warning' });
      }
    }, 250);
  }

  useEffect(() => {
    const onOpened = () => { clearTimer(); setStatus({ text: 'Live', tone: 'live' }); };
    const onConnected = () => { clearTimer(); setStatus({ text: 'Live', tone: 'live' }); };
    const onClosed = (e: Event) => {
      const detail: any = (e as CustomEvent).detail ?? {};
      const code = detail.code != null ? ` (code ${detail.code})` : '';
      setStatus({ text: `WebSocket closed${code}. Reconnecting...`, tone: 'warning' });
    };
    const onError = (e: Event) => {
      const detail: any = (e as CustomEvent).detail ?? {};
      const msg = detail.message ?? 'Unknown error';
      setStatus({ text: `WebSocket error: ${msg}`, tone: 'error' });
    };
    const onRetry = (e: Event) => {
      const detail: any = (e as CustomEvent).detail ?? {};
      const tries = detail.tries ?? 1;
      const delayMs = detail.delayMs ?? 0;
      retryAttemptRef.current = tries;
      retryEndRef.current = Date.now() + delayMs;
      startCountdown();
    };

    window.addEventListener('ws-opened', onOpened as EventListener);
    window.addEventListener('ws-connected', onConnected as EventListener);
    window.addEventListener('ws-closed', onClosed as EventListener);
    window.addEventListener('ws-error', onError as EventListener);
    window.addEventListener('ws-retry', onRetry as EventListener);

    return () => {
      window.removeEventListener('ws-opened', onOpened as EventListener);
      window.removeEventListener('ws-connected', onConnected as EventListener);
      window.removeEventListener('ws-closed', onClosed as EventListener);
      window.removeEventListener('ws-error', onError as EventListener);
      window.removeEventListener('ws-retry', onRetry as EventListener);
      clearTimer();
    };
  }, []);

  return status;
}
