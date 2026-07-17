import type { ReactNode } from 'react';
import MiniSparkline from './MiniSparkline';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  suffix?: string;
  live?: boolean;
  change?: number;
  isActive?: boolean;
  onClick?: () => void;
  sparkline?: { series: readonly number[]; accent: string };
  /** Custom sparkline content; renders in place of MiniSparkline when provided. Height fixed to 28px. */
  sparkNode?: ReactNode;
}

export default function MetricCard({
  label, value, unit, suffix, live, change,
  isActive = false, onClick, sparkline, sparkNode,
}: MetricCardProps) {
  const expandable = !!onClick;
  const showChange = typeof change === 'number';
  const positive = (change ?? 0) > 0;
  const zero = change === 0;
  const changeColor = zero
    ? 'rgba(168, 223, 229, 0.5)'
    : positive ? '#7DD3DA' : '#FF8B6E';
  const changeBg = zero
    ? 'rgba(168, 223, 229, 0.08)'
    : positive ? 'rgba(91, 192, 217, 0.10)' : 'rgba(255, 139, 110, 0.10)';
  const changeBorder = zero
    ? 'rgba(168, 223, 229, 0.2)'
    : positive ? 'rgba(91, 192, 217, 0.28)' : 'rgba(255, 139, 110, 0.28)';

  return (
    <div
      onClick={onClick}
      style={{
        background: isActive ? 'rgba(91, 192, 217, 0.08)' : 'rgba(2, 21, 30, 0.55)',
        border: isActive ? '1px solid rgba(91, 192, 217, 0.45)' : '1px solid rgba(91, 192, 217, 0.15)',
        borderRadius: 14,
        padding: '22px 24px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: isActive ? '0 0 32px rgba(91, 192, 217, 0.2)' : 'none',
        transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (expandable && !isActive) {
          e.currentTarget.style.borderColor = 'rgba(91, 192, 217, 0.32)';
        }
      }}
      onMouseLeave={(e) => {
        if (expandable && !isActive) {
          e.currentTarget.style.borderColor = 'rgba(91, 192, 217, 0.15)';
        }
      }}
    >
      {/* chart-icon hint (top-right) — only on cards that expand */}
      {expandable && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          width: 28, height: 28, borderRadius: 8,
          background: isActive ? 'rgba(91, 192, 217, 0.2)' : 'rgba(91, 192, 217, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.3s ease',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke={isActive ? '#7DD3DA' : 'rgba(168, 223, 229, 0.55)'}
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        </div>
      )}

      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(168, 223, 229, 0.55)',
        marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
        paddingRight: expandable ? 36 : 0,
      }}>
        {live && (
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: '#7DD3DA',
            boxShadow: '0 0 10px #7DD3DA',
            animation: 'liveDot 1.8s ease-in-out infinite',
            flexShrink: 0,
          }} />
        )}
        <span>{label}</span>
        {suffix && <span style={{ color: 'rgba(168, 223, 229, 0.4)' }}>{suffix}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
          fontSize: 'clamp(28px, 3.2vw, 40px)', fontWeight: 500,
          color: '#E8F1F3', lineHeight: 1,
          letterSpacing: '-0.01em',
        }}>{value}</span>

        {unit && <span style={{
          fontSize: 13, color: 'rgba(168, 223, 229, 0.55)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          letterSpacing: '0.05em',
        }}>{unit}</span>}

        {showChange && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, fontWeight: 600,
            padding: '3px 9px', borderRadius: 999,
            background: changeBg,
            color: changeColor,
            border: `1px solid ${changeBorder}`,
            whiteSpace: 'nowrap',
          }}>
            {zero ? '±0.0%' : `${positive ? '+' : ''}${change!.toFixed(1)}%`}
          </span>
        )}
      </div>

      {sparkNode ? (
        <div style={{ marginTop: 14, height: 60 }}>{sparkNode}</div>
      ) : sparkline ? (
        <MiniSparkline series={sparkline.series} accent={sparkline.accent} />
      ) : null}
    </div>
  );
}
