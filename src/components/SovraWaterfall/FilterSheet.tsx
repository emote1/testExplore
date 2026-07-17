import { useEffect, useState } from 'react';
import { C, COINS } from './constants';
import type { PoolFilter } from './types';

interface FilterSheetProps {
  open: boolean;
  filter: PoolFilter;
  onApply: (f: PoolFilter) => void;
  onClose: () => void;
}

/** Modal filter sheet (by coin + amount range, with quick thresholds). */
export default function FilterSheet({ open, filter, onApply, onClose }: FilterSheetProps) {
  const [coin, setCoin] = useState(filter.coin);
  const [min, setMin] = useState<string>(filter.min == null ? '' : String(filter.min));
  const [max, setMax] = useState<string>(filter.max == null ? '' : String(filter.max));
  useEffect(() => {
    if (open) {
      setCoin(filter.coin);
      setMin(filter.min == null ? '' : String(filter.min));
      setMax(filter.max == null ? '' : String(filter.max));
    }
  }, [open]);
  if (!open) return null;

  const apply = () => onApply({ coin, min: min === '' ? null : Number(min), max: max === '' ? null : Number(max) });
  const reset = () => { setCoin('All'); setMin(''); setMax(''); onApply({ coin: 'All', min: null, max: null }); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(1,10,16,0.6)', backdropFilter: 'blur(3px)', animation: 'swfFadeIn 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 380,
        background: 'linear-gradient(180deg,#062B38,#02151D)', borderRadius: 20,
        border: `1px solid ${C.border}`,
        padding: '24px 22px',
        animation: 'swfModalIn 0.28s cubic-bezier(.2,.7,.3,1)', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 19, fontWeight: 500 }}>Filter flows</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(91,192,217,0.08)', border: `1px solid ${C.border}`, color: C.textMute, cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* coin */}
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>coin</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {COINS.map((c) => (
            <button key={c} onClick={() => setCoin(c)} style={{
              padding: '9px 16px', borderRadius: 999,
              background: coin === c ? 'rgba(125,211,218,0.16)' : 'rgba(91,192,217,0.05)',
              border: coin === c ? '1px solid rgba(125,211,218,0.5)' : `1px solid ${C.border}`,
              color: coin === c ? C.teal : C.textMute,
              fontFamily: '"JetBrains Mono",monospace', fontSize: 12, cursor: 'pointer',
            }}>{c}</button>
          ))}
        </div>

        {/* amount range */}
        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textDim, marginBottom: 10 }}>amount range (REEF)</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <input inputMode="numeric" placeholder="min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} style={{
            flex: 1, minWidth: 0, padding: '12px 14px', background: 'rgba(2,21,30,0.5)', border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, fontFamily: '"JetBrains Mono",monospace', fontSize: 13, outline: 'none',
          }} />
          <span style={{ color: C.textDim, flexShrink: 0 }}>—</span>
          <input inputMode="numeric" placeholder="max" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} style={{
            flex: 1, minWidth: 0, padding: '12px 14px', background: 'rgba(2,21,30,0.5)', border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, fontFamily: '"JetBrains Mono",monospace', fontSize: 13, outline: 'none',
          }} />
        </div>

        {/* quick thresholds */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 26, flexWrap: 'wrap' }}>
          {([['≥ 1K', 1000], ['≥ 10K', 10000], ['≥ 100K', 100000], ['whales ≥ 500K', 500000]] as [string, number][]).map(([lbl, mn]) => (
            <button key={lbl} onClick={() => { setMin(String(mn)); setMax(''); }} style={{
              padding: '6px 11px', borderRadius: 999, background: 'rgba(91,192,217,0.05)',
              border: `1px solid ${C.border}`, color: C.textMute,
              fontFamily: '"JetBrains Mono",monospace', fontSize: 10, cursor: 'pointer',
            }}>{lbl}</button>
          ))}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={apply} style={{
            flex: 1, padding: '14px', background: 'rgba(125,211,218,0.16)', border: '1px solid rgba(125,211,218,0.45)',
            borderRadius: 12, color: C.teal, fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
          }}>apply filter</button>
          <button onClick={reset} style={{
            padding: '14px 20px', background: 'rgba(91,192,217,0.06)', border: `1px solid ${C.border}`,
            borderRadius: 12, color: C.textMute, fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
          }}>reset</button>
        </div>
      </div>
    </div>
  );
}
