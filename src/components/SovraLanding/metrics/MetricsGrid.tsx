import { useState } from 'react';
import { useTotalStaked } from '../../../hooks/use-total-staked';
import { useActiveWallets24hIcp } from '../../../hooks/use-active-wallets-24h-icp';
import { useTpsLive } from '../../../hooks/use-tps-live';
import { useMediaQuery } from '../../../hooks/use-media-query';
import { METRICS, type Metric } from '../data/metrics';
import { TpsSparkline } from '../../TpsSparkline';
import MetricCard from './MetricCard';
import StakedCard from './StakedCard';
import ExpandedMetricChart from './ExpandedMetricChart';
import StakedExpansion from './StakedExpansion';
import SmoothSparkline from './SmoothSparkline';

function formatActiveValue(last24h: number | null): string {
  if (last24h == null) return '—';
  return last24h.toLocaleString();
}

export default function MetricsGrid() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  // On mobile cards stack vertically, so the expansion must appear inline
  // right under the tapped card instead of below the whole grid.
  const isMobile = useMediaQuery('(max-width: 520px)');

  const staked = useTotalStaked();
  const activeIcp = useActiveWallets24hIcp();
  const { perMin, tpsTrend } = useTpsLive(60, 'blocks');

  // Active Wallets — live from ICP canister sparkline. No mock fallback —
  // if ICP isn't loaded yet, chart is hidden until real data arrives.
  const activeSeries = activeIcp.sparkDated.map((p) => p.value ?? 0);
  const activeDates = activeIcp.sparkDated.length > 0
    ? activeIcp.sparkDated.map((p) => {
        const d = new Date(p.ts + 'T00:00:00Z');
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      })
    : undefined;

  const liveActiveMetric: Metric = {
    ...METRICS[0],
    value: activeIcp.loading && activeIcp.last24h == null ? '…' : formatActiveValue(activeIcp.last24h),
    change: activeIcp.growthPct ?? undefined,
    series: activeSeries,
    dates: activeDates,
  };

  // Blocks/min — live from useTpsLive (per-second samples over the last 60s).
  const blocksHasData = tpsTrend.length > 0 && Number.isFinite(perMin);
  const blocksMetric: Metric = {
    ...METRICS[2],
    value: blocksHasData ? perMin.toFixed(0) : '…',
    series: tpsTrend.length > 0 ? tpsTrend : METRICS[2].series,
  };

  const handleClick = (i: number) => {
    setHoveredBar(null);
    setActiveIdx(activeIdx === i ? null : i);
  };

  const renderExpansion = (idx: number) => {
    if (idx === 0) {
      return (
        <ExpandedMetricChart
          metric={liveActiveMetric}
          hoveredBar={hoveredBar}
          onBarHover={setHoveredBar}
          onClose={() => setActiveIdx(null)}
        />
      );
    }
    if (idx === 1) {
      return <StakedExpansion onClose={() => setActiveIdx(null)} staked={staked} />;
    }
    return null;
  };

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        alignItems: 'stretch',
      }}>
        <MetricCard
          label={liveActiveMetric.label}
          value={liveActiveMetric.value}
          unit={liveActiveMetric.unit}
          suffix={liveActiveMetric.suffix}
          live={liveActiveMetric.live}
          change={liveActiveMetric.change}
          isActive={activeIdx === 0}
          onClick={() => handleClick(0)}
          sparkNode={liveActiveMetric.series.length >= 2 ? (
            <SmoothSparkline
              series={liveActiveMetric.series}
              accent={liveActiveMetric.accent}
            />
          ) : undefined}
        />

        {isMobile && activeIdx === 0 && (
          <div className="metric-expand-inline">{renderExpansion(0)}</div>
        )}

        <StakedCard
          isActive={activeIdx === 1}
          onClick={() => handleClick(1)}
          staked={staked}
        />

        {isMobile && activeIdx === 1 && (
          <div className="metric-expand-inline">{renderExpansion(1)}</div>
        )}

        <MetricCard
          label={blocksMetric.label}
          value={blocksMetric.value}
          unit={blocksMetric.unit}
          suffix={blocksMetric.suffix}
          live={blocksMetric.live}
          sparkNode={blocksHasData ? (
            <div className="spark-breathe" style={{ width: '100%', height: '100%' }}>
              <TpsSparkline
                series={tpsTrend}
                trendWin={60}
                trendRes={24}
                trendZoom={1.1}
                width={240}
                height={60}
                xpad={6}
                emaAlpha={0.04}
                fixedXFrac={0.5}
                yPadPx={8}
                pathAnimMs={3500}
                strokeWidth={1.8}
                markerR={3}
                smoothFactor={0.05}
              />
            </div>
          ) : undefined}
        />
      </div>

      {!isMobile && (
        <div style={{
          maxHeight: activeIdx !== null ? 720 : 0,
          opacity: activeIdx !== null ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.45s cubic-bezier(.2,.7,.3,1), opacity 0.35s ease, margin-top 0.45s ease',
          marginTop: activeIdx !== null ? 16 : 0,
        }}>
          {activeIdx !== null && renderExpansion(activeIdx)}
        </div>
      )}
    </>
  );
}
