import { useMemo, useRef, useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { useNewWalletsInflowIcp } from '../../../hooks/use-new-wallets-inflow-icp';
import { copyText } from '../../../utils/clipboard';
import type { NewWalletsInflowEntry } from '../../../data/icp-client';

const ICP_CRON_INTERVAL_HOURS = Number(import.meta.env.VITE_ICP_CRON_INTERVAL_HOURS ?? '4');

/** Top wallets shown before the "Show N more" fold. */
const VISIBLE_COUNT = 5;
/** How long the per-row "copied" check stays visible. */
const COPIED_MS = 1200;

function formatCompactReef(raw?: string): string | null {
  if (!raw) return null;
  try {
    const whole = Number(BigInt(raw) / 10n ** 18n);
    if (!Number.isFinite(whole)) return null;
    if (whole >= 1_000_000_000) return `${(whole / 1_000_000_000).toFixed(2)}B`;
    if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`;
    if (whole >= 1_000) return `${(whole / 1_000).toFixed(2)}K`;
    return `${whole}`;
  } catch {
    return null;
  }
}

/** 5CyckL…QtKLSG — keep the leading network byte + a recognizable tail. */
function truncateAddress(addr: string): string {
  return addr.length <= 14 ? addr : `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function formatEta(ms: number): string {
  if (ms <= 0) return 'soon';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function nextUpdateMs(asOf: string | undefined): number | null {
  if (!asOf || ICP_CRON_INTERVAL_HOURS <= 0) return null;
  const asOfDate = new Date(asOf);
  if (Number.isNaN(asOfDate.getTime())) return null;
  const intervalMs = ICP_CRON_INTERVAL_HOURS * 60 * 60 * 1000;
  const nowMs = Date.now();
  let nextMs = asOfDate.getTime() + intervalMs;
  if (nowMs >= nextMs) {
    const periods = Math.floor((nowMs - asOfDate.getTime()) / intervalMs) + 1;
    nextMs = asOfDate.getTime() + periods * intervalMs;
  }
  return nextMs - nowMs;
}

interface IcpInflowCardProps {
  /** Open a wallet's page (App.tsx search→wallet flow). Tapping a row calls this. */
  onSearch?: (address: string) => void;
}

export default function IcpInflowCard({ onSearch }: IcpInflowCardProps) {
  const inflow = useNewWalletsInflowIcp();
  const [showTip, setShowTip] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minText = formatCompactReef(inflow.data?.minRaw);
  const qualified = inflow.data?.qualified ?? 0;
  const totalNew = inflow.data?.totalNew ?? 0;

  // Entries are pre-filtered (>= minRaw) on the ICP side; sort defensively by amount desc.
  const entries = useMemo<NewWalletsInflowEntry[]>(() => {
    const list = inflow.data?.entries ?? [];
    return [...list].sort((a, b) => {
      try {
        const d = BigInt(b.incomingRaw) - BigInt(a.incomingRaw);
        return d > 0n ? 1 : d < 0n ? -1 : 0;
      } catch {
        return 0;
      }
    });
  }, [inflow.data]);

  const updatedText = inflow.data?.asOf
    ? new Date(inflow.data.asOf).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const etaMs = nextUpdateMs(inflow.data?.asOf);
  const nextUpdateText = etaMs != null ? `Next update in ${formatEta(etaMs)}` : null;

  const status: 'disabled' | 'loading' | 'error' | 'empty' | 'ok' = !inflow.enabled
    ? 'disabled'
    : inflow.error && !inflow.data
      ? 'error'
      : inflow.loading && !inflow.data
        ? 'loading'
        : !inflow.data
          ? 'empty'
          : 'ok';

  const canExpand = status === 'ok' && entries.length > 0;
  const visibleEntries = showAll ? entries : entries.slice(0, VISIBLE_COUNT);

  function toggleExpand() {
    if (!canExpand) return;
    setExpanded((v) => !v);
  }

  async function handleCopy(address: string) {
    const ok = await copyText(address);
    if (!ok) return;
    setCopied(address);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }

  return (
    <div style={{
      background: 'rgba(2, 21, 30, 0.55)',
      border: '1px solid rgba(255, 139, 110, 0.22)',
      borderRadius: 14,
      padding: '28px 32px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      maxWidth: 580, margin: '0 auto',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 180, height: 180,
        background: 'radial-gradient(circle, rgba(255, 139, 110, 0.18), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20, position: 'relative',
      }}>
        <div>
          <div style={{
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
            fontSize: 20, fontWeight: 500,
            color: '#E8F1F3', marginBottom: 4,
          }}>New Wallets Inflow</div>
          <div style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.08em',
            color: 'rgba(168, 223, 229, 0.5)',
            display: 'flex', alignItems: 'center', gap: 6,
            position: 'relative',
          }}>
            <span>24h · on-chain verified</span>
            <span
              role="button"
              tabIndex={0}
              aria-label="What does on-chain verified mean?"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              onClick={(e) => { e.stopPropagation(); setShowTip((s) => !s); }}
              onBlur={() => setShowTip(false)}
              style={{
                display: 'inline-flex', cursor: 'pointer', flexShrink: 0,
                color: showTip ? '#7DD3DA' : 'rgba(168, 223, 229, 0.6)',
                transition: 'color 0.18s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </span>
            {showTip && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                  zIndex: 20, width: 'max-content', maxWidth: 240,
                  background: 'rgba(2, 21, 30, 0.97)',
                  border: '1px solid rgba(91, 192, 217, 0.3)',
                  borderRadius: 10, padding: '10px 12px',
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 10.5, lineHeight: 1.55, letterSpacing: '0.02em',
                  textTransform: 'none',
                  color: 'rgba(232, 241, 243, 0.88)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                Data stored on an Internet Computer canister — on-chain, immutable and independently verifiable.
              </div>
            )}
          </div>
        </div>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          padding: '5px 11px', borderRadius: 999,
          background: 'rgba(255, 139, 110, 0.12)',
          color: '#FF8B6E',
          border: '1px solid rgba(255, 139, 110, 0.32)',
          fontWeight: 600,
        }}>ICP</span>
      </div>

      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.06em',
        color: 'rgba(168, 223, 229, 0.6)',
        marginBottom: 12,
      }}>
        Filter: <span style={{ color: '#FFC8B8', fontWeight: 500 }}>
          {minText ? `≥ ${minText} REEF` : 'Minimum not set'}
        </span>
      </div>

      {/* Big count — clickable to reveal the wallet list (when there are entries). */}
      <div
        onClick={toggleExpand}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={canExpand ? expanded : undefined}
        onKeyDown={canExpand ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } } : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginBottom: expanded && canExpand ? 14 : 22,
          cursor: canExpand ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
          fontSize: 'clamp(44px, 5.5vw, 60px)', fontWeight: 500,
          color: '#E8F1F3', lineHeight: 1, letterSpacing: '-0.02em',
        }}>{status === 'ok' ? qualified : status === 'loading' ? '…' : '—'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
            fontSize: 14, color: '#E8F1F3', letterSpacing: '0.01em',
          }}>
            {status === 'ok'
              ? 'new wallets'
              : status === 'loading'
                ? 'loading…'
                : status === 'disabled'
                  ? 'ICP URL not set'
                  : status === 'error'
                    ? 'could not load'
                    : 'no data yet'}
            {canExpand && (
              <ChevronDown
                size={15}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  color: 'rgba(168, 223, 229, 0.6)',
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            )}
          </span>
          {status === 'ok' && (
            <span style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11, letterSpacing: '0.04em',
              color: 'rgba(168, 223, 229, 0.45)',
            }}>of {totalNew} total{canExpand && !expanded ? ' · tap to view' : ''}</span>
          )}
        </div>
      </div>

      {/* Expandable wallet list */}
      {expanded && canExpand && (
        <div style={{ marginBottom: 14 }}>
          {visibleEntries.map((e) => {
            const label = formatCompactReef(e.incomingRaw);
            const isCopied = copied === e.address;
            const isHovered = hovered === e.address;
            return (
              <div
                key={e.address}
                role="button"
                tabIndex={0}
                onClick={() => onSearch?.(e.address)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') onSearch?.(e.address); }}
                onMouseEnter={() => setHovered(e.address)}
                onMouseLeave={() => setHovered((h) => (h === e.address ? null : h))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: isHovered ? 'rgba(91, 192, 217, 0.07)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 12.5, color: '#E8F1F3', letterSpacing: '0.02em',
                  }}>{truncateAddress(e.address)}</span>
                  <button
                    type="button"
                    aria-label={isCopied ? 'Address copied' : 'Copy address'}
                    onClick={(ev) => { ev.stopPropagation(); handleCopy(e.address); }}
                    style={{
                      background: 'transparent', border: 'none', padding: 2,
                      display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                      color: isCopied ? '#7DD3DA' : 'rgba(168, 223, 229, 0.5)',
                      transition: 'color 0.15s ease', flexShrink: 0,
                    }}
                  >
                    {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <span style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 12.5, fontWeight: 500, color: '#FFC8B8',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{label ? `${label} REEF` : '—'}</span>
              </div>
            );
          })}

          {entries.length > VISIBLE_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              style={{
                width: '100%', marginTop: 6, padding: '8px 0',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(168, 223, 229, 0.6)',
              }}
            >
              {showAll ? 'Show less' : `Show ${entries.length - VISIBLE_COUNT} more`}
            </button>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        paddingTop: 18, borderTop: '1px solid rgba(91, 192, 217, 0.12)',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.08em',
        color: 'rgba(168, 223, 229, 0.5)',
      }}>
        <span>{updatedText ? `Updated ${updatedText}` : '—'}</span>
        <span>{nextUpdateText ?? ''}</span>
      </div>
    </div>
  );
}
