import { useSquidHealth } from '@/hooks/use-squid-health';
import { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, BarChart3, Gauge, Timer, Loader2 } from 'lucide-react';

interface Props {
  compact?: boolean;
}

function formatMs(ms?: number) {
  if (ms == null) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatLag(ts?: number) {
  if (!ts) return '-';
  const lagSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (lagSec < 60) return `${lagSec}s`;
  const m = Math.floor(lagSec / 60);
  const s = lagSec % 60;
  return `${m}m ${s}s`;
}

function formatAgo(ts?: number) {
  if (!ts) return '-';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s ago`;
}

export function SquidHealthIndicator({ compact = false }: Props) {
  const { status, height, lastBlockTs, latencyMsAvg, latencyMsP95, lastUpdated } = useSquidHealth({ intervalMs: 30_000 });
  const [expanded, setExpanded] = useState(false);
  const ui = {
    loading:{ text: 'text-blue-700', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500' },
    live:   { text: 'text-green-700', dot: 'bg-green-500', chip: 'bg-green-100 text-green-700', border: 'border-green-200', bar: 'bg-green-500' },
    lagging:{ text: 'text-yellow-700', dot: 'bg-yellow-500', chip: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200', bar: 'bg-yellow-500' },
    stale:  { text: 'text-orange-700', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', border: 'border-orange-200', bar: 'bg-orange-500' },
    down:   { text: 'text-red-700', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700', border: 'border-red-200', bar: 'bg-red-500' },
  } as const;
  const label = status === 'loading' ? 'Connecting' : status === 'live' ? 'Live' : status === 'lagging' ? 'Lagging' : status === 'stale' ? 'Stale' : 'Down';
  const Icon = status === 'loading' ? Loader2 : status === 'live' ? CheckCircle2 : status === 'lagging' ? Clock : status === 'stale' ? AlertTriangle : XCircle;
  const classes = ui[status];
  const heightText = height != null ? height.toLocaleString() : '-';

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${classes.border} bg-white/70 backdrop-blur-sm shadow-sm`}
        title={`Height: ${height ?? '-'} | Lag: ${formatLag(lastBlockTs)} | Avg: ${formatMs(latencyMsAvg)} | p95: ${formatMs(latencyMsP95)} | Updated: ${formatAgo(lastUpdated)}`}
      >
        <span className={`w-2 h-2 rounded-full ${classes.dot} ${status === 'live' || status === 'loading' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${classes.text}`}>{label}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border ${classes.border} bg-white shadow-sm`}> 
      <div className={`absolute inset-x-0 top-0 h-1 ${classes.bar}`} />
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-2 group"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Toggle health details"
        >
          <Icon className={`${classes.text} ${status === 'loading' ? 'animate-spin' : ''}`} size={18} />
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`font-semibold ${classes.text}`}>{label}</span>
          <span className="text-xs text-gray-500">updated {formatAgo(lastUpdated)}</span>
        </button>
        <span className={`w-2 h-2 rounded-full ${classes.dot} ${status === 'live' || status === 'loading' ? 'animate-pulse' : ''}`} />
      </div>
      {expanded && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${classes.chip}`} title="Blocks indexed">
              <BarChart3 size={14} />
              <span className="font-medium">Height</span>
              <span className="opacity-80">{heightText}</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${classes.chip}`} title="Delay to last block time">
              <Clock size={14} />
              <span className="font-medium">Delay</span>
              <span className="opacity-80">{formatLag(lastBlockTs)}</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${classes.chip}`} title="Average GraphQL response time">
              <Gauge size={14} />
              <span className="font-medium">Avg</span>
              <span className="opacity-80">{formatMs(latencyMsAvg)}</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${classes.chip}`} title="p95 GraphQL response time">
              <Timer size={14} />
              <span className="font-medium">p95</span>
              <span className="opacity-80">{formatMs(latencyMsP95)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
