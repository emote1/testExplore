import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ToastState {
  text: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  visible: boolean;
}

function toneStyles(tone: ToastState['tone']) {
  if (tone === 'success') return 'bg-green-50 border-green-200 text-green-900';
  if (tone === 'warning') return 'bg-yellow-50 border-yellow-200 text-yellow-900';
  if (tone === 'error') return 'bg-red-50 border-red-200 text-red-900';
  return 'bg-gray-50 border-gray-200 text-gray-900';
}

function toneIcon(tone: ToastState['tone']) {
  if (tone === 'success') return <CheckCircle2 className="h-5 w-5" />;
  if (tone === 'warning') return <AlertTriangle className="h-5 w-5" />;
  if (tone === 'error') return <XCircle className="h-5 w-5" />;
  return <RefreshCw className="h-5 w-5" />;
}

export function WsStatusToast() {
  const [state, setState] = React.useState<ToastState>({ text: '', tone: 'info', visible: false });
  const hideTimer = React.useRef<number | null>(null);
  const hadIssueRef = React.useRef<boolean>(false);

  function show(text: string, tone: ToastState['tone'], ttlMs: number) {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setState({ text, tone, visible: true });
    hideTimer.current = window.setTimeout(() => setState((s) => ({ ...s, visible: false })), ttlMs);
  }

  React.useEffect(() => {
    const onOpened = () => { /* no toast on initial open */ };
    const onConnected = () => { if (hadIssueRef.current) show('WebSocket restored', 'success', 2500); };
    const onClosed = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail: any = (e as CustomEvent).detail ?? {};
      const code = detail.code != null ? ` (code ${detail.code})` : '';
      hadIssueRef.current = true;
      show(`WebSocket closed${code}. Reconnecting...`, 'warning', 5000);
    };
    const onError = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail: any = (e as CustomEvent).detail ?? {};
      const msg = detail.message ?? 'Unknown error';
      hadIssueRef.current = true;
      show(`WebSocket error: ${msg}`, 'error', 6000);
    };
    const onRetry = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail: any = (e as CustomEvent).detail ?? {};
      const tries = detail.tries ?? 1;
      const delayMs = detail.delayMs ?? 0;
      const secs = Math.max(0.1, Math.round(delayMs / 100) / 10);
      hadIssueRef.current = true;
      show(`Reconnecting in ${secs}s (attempt ${tries})`, 'warning', Math.min(4000, delayMs + 1000));
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
    };
  }, []);

  if (!state.visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm w-[360px] p-3 rounded-lg shadow-lg border ${toneStyles(state.tone)}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div>{toneIcon(state.tone)}</div>
        <div className="text-sm leading-snug">{state.text}</div>
      </div>
    </div>
  );
}
