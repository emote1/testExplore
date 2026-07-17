import { DAILY_DATES, type Metric } from '../data/metrics';
import { useMediaQuery } from '../../../hooks/use-media-query';
import CoralPillars from './CoralPillars';

// On phones, 30 thin corals get cramped — show only the recent tail and space them out.
const MOBILE_MAX_BARS = 14;

function pickAxisIndices(length: number, count = 7): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}

interface ExpandedMetricChartProps {
  metric: Metric;
  hoveredBar: number | null;
  onBarHover: (i: number | null) => void;
  onClose: () => void;
}

export default function ExpandedMetricChart({
  metric, hoveredBar, onBarHover, onClose,
}: ExpandedMetricChartProps) {
  const isMobile = useMediaQuery('(max-width: 520px)');

  const fullSeries = metric.series;
  const fullDates: readonly string[] = metric.dates ?? DAILY_DATES;

  // On mobile keep only the most recent days so each coral has room to breathe.
  const series = isMobile ? fullSeries.slice(-MOBILE_MAX_BARS) : fullSeries;
  const dates = isMobile ? fullDates.slice(-MOBILE_MAX_BARS) : fullDates;

  const axisIndices = pickAxisIndices(dates.length, isMobile ? 5 : 7);

  return (
    <div style={{
      background: 'rgba(2, 21, 30, 0.65)',
      border: '1px solid rgba(91, 192, 217, 0.22)',
      borderRadius: 14,
      padding: '22px 26px 18px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
            fontSize: 17, fontWeight: 500, color: '#E8F1F3',
          }}>{metric.label}</span>
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'rgba(168, 223, 229, 0.5)',
          }}>{isMobile ? `daily · last ${series.length}d` : (metric.chartSubtitle ?? 'daily · last 30d')}</span>
        </div>
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
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(91, 192, 217, 0.16)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(91, 192, 217, 0.08)'}
        >↑ surface</button>
      </div>

      {/* live tooltip line */}
      <div style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, marginBottom: 10, minHeight: 18,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {hoveredBar !== null && hoveredBar < series.length ? (
          <>
            <span style={{
              color: 'rgba(168, 223, 229, 0.55)', letterSpacing: '0.04em',
            }}>
              {dates[hoveredBar]}
            </span>
            <span style={{ color: metric.accent, fontWeight: 600 }}>
              {metric.format ? metric.format(series[hoveredBar]) : series[hoveredBar]}
            </span>
          </>
        ) : (
          <span style={{ opacity: 0.4, color: 'rgba(168, 223, 229, 0.55)' }}>
            hover any pillar for the day's value
          </span>
        )}
      </div>

      {/* coral pillars chart */}
      <CoralPillars
        series={series}
        accent={metric.accent}
        hoveredBar={hoveredBar}
        onBarHover={onBarHover}
        gap={isMobile ? 7 : 3}
      />

      {/* date axis */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 9, color: 'rgba(168, 223, 229, 0.35)',
        marginTop: 8, letterSpacing: '0.06em',
      }}>
        {axisIndices.map((idx) => (
          <span key={idx}>{dates[idx]}</span>
        ))}
      </div>
    </div>
  );
}
