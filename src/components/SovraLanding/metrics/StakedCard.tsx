import { useState } from 'react';
import type { TotalStakedState } from '../../../hooks/use-total-staked';

interface StakedCardProps {
  isActive: boolean;
  onClick: () => void;
  staked: TotalStakedState;
}

function formatStakedTotal(reef: number): string {
  if (!Number.isFinite(reef) || reef <= 0) return '—';
  if (reef >= 1_000_000_000) return `${(reef / 1_000_000_000).toFixed(2)}B REEF`;
  if (reef >= 1_000_000) return `${(reef / 1_000_000).toFixed(2)}M REEF`;
  if (reef >= 1_000) return `${(reef / 1_000).toFixed(2)}K REEF`;
  return `${reef.toFixed(0)} REEF`;
}

export default function StakedCard({ isActive, onClick, staked }: StakedCardProps) {
  const [shakes, setShakes] = useState(0);

  const total = staked.loading && staked.totalStakedReef === 0
    ? '…'
    : formatStakedTotal(staked.totalStakedReef);
  const percentStaked = staked.stakedPct;
  const apy = staked.apy;

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive ? 'rgba(255, 139, 110, 0.07)' : 'rgba(2, 21, 30, 0.55)',
        border: isActive ? '1px solid rgba(255, 139, 110, 0.42)' : '1px solid rgba(255, 139, 110, 0.18)',
        borderRadius: 14,
        padding: '22px 24px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        transition: 'border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease',
        boxShadow: isActive ? '0 0 32px rgba(255, 139, 110, 0.22)' : 'none',
        transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={(e) => {
        setShakes((c) => c + 1);
        if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 139, 110, 0.35)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 139, 110, 0.18)';
      }}
    >
      {/* Lock icon top-right — shakes briefly on each hover */}
      <div
        key={`lock-${shakes}`}
        style={{
          position: 'absolute', top: 14, right: 14,
          width: 32, height: 32, borderRadius: '50%',
          background: isActive ? 'rgba(255, 139, 110, 0.25)' : 'rgba(255, 139, 110, 0.12)',
          border: '1px solid rgba(255, 139, 110, 0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.3s ease',
          animation: shakes > 0 ? 'lockShake 0.55s ease-in-out' : 'none',
          transformOrigin: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="#FF8B6E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {/* Title row */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
        marginBottom: 18, paddingRight: 44,
      }}>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(168, 223, 229, 0.55)',
        }}>Total Staked</span>
        <span style={{
          fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
          fontSize: 'clamp(17px, 1.8vw, 21px)', fontWeight: 500,
          color: '#FF8B6E', letterSpacing: '-0.01em', lineHeight: 1,
        }}>{total}</span>
      </div>

      {/* Staked progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: 6, fontSize: 11,
        }}>
          <span style={{ color: 'rgba(168, 223, 229, 0.65)' }}>Staked</span>
          <span style={{ color: '#FF8B6E', fontWeight: 600 }}>{percentStaked.toFixed(1)}%</span>
        </div>
        <div style={{
          height: 5,
          background: 'rgba(255, 139, 110, 0.1)',
          borderRadius: 999,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${Math.min(percentStaked, 100)}%`,
            background: 'linear-gradient(90deg, #D8623F, #FF8B6E, #FFC8B8)',
            borderRadius: 999,
            boxShadow: '0 0 8px rgba(255, 139, 110, 0.5)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* APY row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        fontSize: 11,
      }}>
        <span style={{ color: 'rgba(168, 223, 229, 0.65)' }}>APY</span>
        <span style={{
          color: '#7DD3DA',
          fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
          fontSize: 17, fontWeight: 500,
        }}>{apy != null ? `~${apy.toFixed(1)}%` : '—'}</span>
      </div>
    </div>
  );
}
