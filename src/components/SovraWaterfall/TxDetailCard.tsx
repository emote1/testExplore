import { useEffect, useRef, useState } from 'react';
import { C, CHANNELS } from './constants';
import { fmtUsd } from './format';
import { copyText } from '@/utils/clipboard';
import { reefscanTransferHref } from './reefscan-link';
import type { SovraTx } from './types';

const MONO = '"JetBrains Mono",monospace';

/** Exact (non-abbreviated) amount — the row shows 19.80M, the detail shows it all. */
function exactAmount(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : 4 });
}

function fmtWhen(tx: SovraTx): string {
  const d = new Date(tx.timestamp ?? Date.now() - tx.ageMs);
  const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

function MetaRow({ k, v, last = false }: { k: string; v: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      padding: '8px 12px', borderBottom: last ? 'none' : '1px solid rgba(91,192,217,0.07)',
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>{k}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.text, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

/**
 * Transaction detail that unfolds INLINE, right under the tapped row — no
 * bottom sheet, no overlay: on a phone the detail appears where the finger is.
 */
export default function TxDetailCard({ tx, onClose }: { tx: SovraTx; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ch = CHANNELS[tx.channel];

  const reefscan = reefscanTransferHref(tx);

  // If the card unfolds below the fold, nudge it into view (minimal scroll).
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const copy = (key: string, value: string) => {
    void copyText(value).then((ok) => {
      if (!ok) return;
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1400);
    });
  };

  const copyBlock = (key: string, label: string, value: string) => (
    <button onClick={() => copy(key, value)} title="tap to copy" style={{
      width: '100%', textAlign: 'left', display: 'block',
      background: 'rgba(2,21,30,0.45)', borderRadius: 10, cursor: 'pointer',
      border: `1px solid ${copied === key ? ch.color + '66' : 'transparent'}`,
      padding: '8px 12px 9px', transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', color: copied === key ? ch.color : C.textDim }}>
          {copied === key ? '✓ copied' : '⧉ copy'}
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.textMute, wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</div>
    </button>
  );

  return (
    <div ref={ref} className="swf-detail-unfold" style={{
      background: 'rgba(2,21,30,0.82)', borderRadius: 12,
      borderTop: `1px solid ${ch.color}30`, borderRight: `1px solid ${ch.color}30`,
      borderBottom: `1px solid ${ch.color}30`, borderLeft: `3px solid ${ch.color}`,
      padding: '13px 13px 12px',
      boxShadow: `0 6px 22px rgba(1,10,16,0.5), 0 0 18px ${ch.color}1c`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* exact amount — the headline the row only abbreviated */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '0 1px' }}>
        <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: tx.whale ? C.coralLight : C.text }}>
          {ch.dir === 'in' ? '+' : '−'}{exactAmount(tx.amount)}
          {' '}<span style={{ fontSize: 12, color: C.textDim, fontWeight: 400 }}>{tx.coin || 'REEF'}</span>
          {tx.whale && <span style={{ marginLeft: 6, fontSize: 14 }}>🐋</span>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.tealLight }}>{fmtUsd(tx.valueUsd)}</div>
      </div>

      <div style={{ background: 'rgba(2,21,30,0.45)', borderRadius: 10, overflow: 'hidden' }}>
        <MetaRow k="when" v={fmtWhen(tx)} />
        <MetaRow k="block" v={'#' + tx.block.toLocaleString('en-US')} />
        <MetaRow k="status" last v={
          <><span style={{ color: tx.status === 'confirmed' ? C.teal : C.staking, marginRight: 5 }}>●</span>{tx.status}</>
        } />
      </div>

      {copyBlock('cp', tx.channel === 'stakeIn' ? 'source' : 'counterparty', tx.counterparty)}
      {copyBlock('tx', 'tx id', tx.hash)}

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <a href={reefscan} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, textAlign: 'center', padding: '11px',
          background: `${ch.color}14`, border: `1px solid ${ch.color}44`, borderRadius: 10,
          color: ch.color, textDecoration: 'none',
          fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>reefscan ↗</a>
        <button onClick={onClose} style={{
          padding: '11px 18px', background: 'rgba(91,192,217,0.06)',
          border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer',
          color: C.textMute, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>close</button>
      </div>
    </div>
  );
}
