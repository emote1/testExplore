import type { TotalStakedState } from '../../../hooks/use-total-staked';
import { useReefPrice } from '../../../hooks/use-reef-price';
import ValidatorRow from './ValidatorRow';

interface StakedExpansionProps {
  onClose: () => void;
  staked: TotalStakedState;
}

function formatUsdCompact(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '—';
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

export default function StakedExpansion({ onClose, staked }: StakedExpansionProps) {
  const { price: reefPrice } = useReefPrice();
  const validatorsCount = staked.validatorCount;
  const stakedPct = staked.stakedPct;
  const era = staked.era;
  const validators = staked.validators;
  const usdText = reefPrice?.usd && staked.totalStakedReef > 0
    ? formatUsdCompact(staked.totalStakedReef * reefPrice.usd)
    : null;

  return (
    <div className="staked-expansion-pad" style={{
      background: 'rgba(2, 21, 30, 0.65)',
      border: '1px solid rgba(255, 139, 110, 0.22)',
      borderRadius: 14,
      padding: '22px 26px 18px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(255, 139, 110, 0.18)',
            border: '1px solid rgba(255, 139, 110, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="#FF8B6E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{
              fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
              fontSize: 18, fontWeight: 500, color: '#E8F1F3', lineHeight: 1.2,
            }}>Validators</div>
            <div style={{
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: '0.08em', marginTop: 4,
              color: 'rgba(168, 223, 229, 0.55)',
            }}>
              {era != null ? <>Era {era.toLocaleString()} <span style={{ opacity: 0.5 }}>·</span>{' '}</> : null}
              <span style={{ color: '#7DD3DA' }}>{validatorsCount} validators</span>{' '}
              <span style={{ opacity: 0.5 }}>·</span>{' '}
              <span style={{ color: '#FF8B6E' }}>{stakedPct.toFixed(1)}% staked</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {usdText && (
            <span style={{
              background: 'rgba(255, 139, 110, 0.12)',
              border: '1px solid rgba(255, 139, 110, 0.32)',
              padding: '5px 11px',
              borderRadius: 999,
              color: '#FF8B6E',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}>{usdText}</span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'rgba(91, 192, 217, 0.08)',
              border: '1px solid rgba(91, 192, 217, 0.25)',
              color: 'rgba(168, 223, 229, 0.85)',
              borderRadius: 999,
              padding: '5px 12px',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(91, 192, 217, 0.16)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(91, 192, 217, 0.08)'}
          >↑ surface</button>
        </div>
      </div>

      {/* Main validators table — scrollable internally */}
      <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8 }}>
        {/* sticky header */}
        <div className="validator-grid" style={{
          padding: '10px 6px',
          borderBottom: '1px solid rgba(91, 192, 217, 0.2)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(168, 223, 229, 0.55)',
          fontWeight: 600,
          position: 'sticky', top: 0,
          background: 'rgba(2, 21, 30, 0.97)',
          backdropFilter: 'blur(8px)',
          zIndex: 1,
        }}>
          <span className="vg-rank">#</span>
          <span>Validator</span>
          <span style={{ textAlign: 'right' }}>Staked</span>
          <span className="vg-comm" style={{ textAlign: 'right' }}>Comm.</span>
          <span style={{ textAlign: 'right' }}>APY</span>
        </div>
        {validators.length === 0 && staked.loading ? (
          <div style={{
            padding: '20px 10px',
            textAlign: 'center',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, color: 'rgba(168, 223, 229, 0.4)',
          }}>loading validators…</div>
        ) : (
          validators.map((v, idx) => (
            <ValidatorRow key={v.address} v={v} rank={idx + 1} />
          ))
        )}
      </div>
    </div>
  );
}
