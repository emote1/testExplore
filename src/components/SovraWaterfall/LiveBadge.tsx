import { useState } from 'react';
import { useSquidHealth } from '@/hooks/use-squid-health';
import { C } from './constants';
import './sovra-waterfall.css';

/**
 * SOVRA live-status badge, backed by the real indexer health poll
 * (use-squid-health: one tiny network-only query every 30s, with backoff,
 * circuit breaker and hidden-tab pause). The dot emits a sonar ring on every
 * successful poll; tapping the chip opens a detail panel (height, lag, latency).
 */

const STATUS_UI = {
  loading: { color: 'rgba(168,223,229,0.55)', label: 'sounding' },
  live:    { color: C.teal,    label: 'live' },
  lagging: { color: C.staking, label: 'lagging' },
  stale:   { color: C.coral,   label: 'stale' },
  down:    { color: '#FF6B6B', label: 'offline' },
} as const;

function fmtMs(ms?: number) {
  if (ms == null) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function fmtAgo(ts?: number | null) {
  if (!ts) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s ago`;
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16,
  fontFamily: '"JetBrains Mono",monospace', fontSize: 9.5, letterSpacing: '0.05em',
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 8.5 }}>{label}</span>
      <span style={{ color: C.textMute }}>{value}</span>
    </div>
  );
}

export default function LiveBadge({ style }: { style?: React.CSSProperties }) {
  const { status, height, lastBlockTs, processorTs, latencyMsAvg, lastUpdated } = useSquidHealth({ intervalMs: 30_000 });
  const [open, setOpen] = useState(false);
  const ui = STATUS_UI[status];

  // same freshness the hook grades on: the newest of processor/block time
  const freshTs = Math.max(processorTs ?? 0, lastBlockTs ?? 0) || null;
  const lagSec = freshTs ? Math.max(0, Math.floor((Date.now() - freshTs) / 1000)) : null;

  return (
    <div style={{ position: 'relative', ...style }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
        background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, cursor: 'pointer',
      }}>
        <span style={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
          <span className="swf-live-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: ui.color, boxShadow: `0 0 8px ${ui.color}` }} />
          {/* sonar ping — remounts (and replays) on every successful poll */}
          {lastUpdated != null && status !== 'down' && status !== 'loading' && (
            <span key={lastUpdated} className="swf-sonar" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${ui.color}` }} />
          )}
        </span>
        <span style={{
          fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600,
          color: status === 'live' ? C.textMute : ui.color,
        }}>{ui.label}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 60,
          display: 'flex', flexDirection: 'column', gap: 7, minWidth: 190,
          background: 'rgba(2,21,30,0.92)', border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '11px 13px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <DetailRow label="block" value={height != null ? `#${height.toLocaleString('en-US')}` : '—'} />
          <DetailRow label="behind" value={lagSec != null ? (lagSec < 60 ? `${lagSec}s` : `${Math.floor(lagSec / 60)}m ${lagSec % 60}s`) : '—'} />
          <DetailRow label="response" value={fmtMs(latencyMsAvg)} />
          <DetailRow label="checked" value={fmtAgo(lastUpdated)} />
        </div>
      )}
    </div>
  );
}
