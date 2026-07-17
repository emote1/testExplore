interface MiniSparklineProps {
  series: readonly number[];
  accent: string;
}

export default function MiniSparkline({ series, accent }: MiniSparklineProps) {
  if (!series || series.length < 2) return null;

  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = (max - min) || 1;
  const W = 100;
  const H = 28;
  const WRAPPER_H = 60;

  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  const areaPoints = `0,${H} ${points} ${W},${H}`;
  const gradId = `spark-${accent.replace('#', '')}`;

  return (
    <div style={{ marginTop: 14, height: WRAPPER_H, position: 'relative' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradId})`} />
        <polyline
          points={points}
          fill="none"
          stroke={accent}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
