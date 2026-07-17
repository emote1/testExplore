import { useCallback, useState } from 'react';
import type { ValidatorStake } from '../../../hooks/use-total-staked';
import { copyText } from '../../../utils/clipboard';

interface ValidatorRowProps {
  v: ValidatorStake;
  rank: number;
}

function formatStaked(reef: number): string {
  if (!Number.isFinite(reef) || reef <= 0) return '—';
  if (reef >= 1_000_000_000) return `${(reef / 1_000_000_000).toFixed(2)}B`;
  if (reef >= 1_000_000) return `${(reef / 1_000_000).toFixed(0)}M`;
  if (reef >= 1_000) return `${(reef / 1_000).toFixed(0)}K`;
  return `${reef.toFixed(0)}`;
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function CopyGlyph({ copied, dim }: { copied: boolean; dim: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{
        flexShrink: 0,
        color: copied ? '#7DD3DA' : 'rgba(168, 223, 229, 0.85)',
        opacity: copied ? 1 : dim ? 0.45 : 0.9,
        transition: 'opacity 0.18s ease, color 0.18s ease',
      }}
    >
      {copied ? (
        <path d="M20 6 9 17l-5-5" />
      ) : (
        <>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
    </svg>
  );
}

export default function ValidatorRow({ v, rank }: ValidatorRowProps) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const stakedText = formatStaked(v.stakedReef);
  const commissionText = v.commissionPct != null ? `${v.commissionPct.toFixed(0)}%` : '—';
  const apyText = v.apy != null ? `${v.apy.toFixed(0)}%` : '—';
  const apyHigh = v.apy != null && v.apy >= 85;
  const shortAddr = shortenAddress(v.address);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(v.address);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }, [v.address]);

  return (
    <div
      className="validator-grid"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '9px 6px',
        borderBottom: '1px solid rgba(91, 192, 217, 0.05)',
        background: hovered ? 'rgba(91, 192, 217, 0.05)' : 'transparent',
        fontSize: 12,
        transition: 'background 0.18s ease',
      }}
    >
      <span className="vg-rank" style={{
        color: 'rgba(168, 223, 229, 0.4)',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      }}>{rank}</span>

      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${v.address}`}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: 1, minWidth: 0, overflow: 'hidden',
          background: 'none', border: 'none', padding: 0, margin: 0,
          font: 'inherit', textAlign: 'left', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%',
        }}>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: v.name ? 'inherit' : '"JetBrains Mono", ui-monospace, monospace',
            fontSize: v.name ? 12 : 11,
            color: copied ? '#7DD3DA' : v.name ? '#E8F1F3' : 'rgba(168, 223, 229, 0.75)',
            transition: 'color 0.18s ease',
          }}>{copied ? 'copied!' : (v.name ?? shortAddr)}</span>
          <CopyGlyph copied={copied} dim={!hovered} />
        </span>
        {v.name && (
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 9.5,
            color: 'rgba(168, 223, 229, 0.4)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>{shortAddr}</span>
        )}
      </button>

      <span style={{
        textAlign: 'right',
        color: 'rgba(168, 223, 229, 0.75)',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      }}>{stakedText}</span>

      <span className="vg-comm" style={{
        textAlign: 'right',
        color: 'rgba(168, 223, 229, 0.55)',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11,
      }}>{commissionText}</span>

      <span style={{
        textAlign: 'right',
        color: apyHigh ? '#7DD3DA' : 'rgba(168, 223, 229, 0.75)',
        fontWeight: 600,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      }}>{apyText}</span>
    </div>
  );
}
