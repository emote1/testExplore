import { useId, useMemo } from 'react';

interface SmoothSparklineProps {
  series: readonly number[];
  accent: string;
}

function curvePath(
  data: readonly number[],
  width: number,
  height: number,
  smoothing = 0.85,
  xPadLeft = 2,
  xPadRight = 14,
  yPad = 4,
): string {
  const n = data.length;
  if (n < 2) return `M0 ${height / 2} L${width} ${height / 2}`;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) {
    min -= 1;
    max += 1;
  }
  const span = max - min;

  const step = (width - xPadLeft - xPadRight) / (n - 1);
  const scaleY = (v: number) => {
    const t = (v - min) / span;
    return height - yPad - t * (height - 2 * yPad);
  };

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: xPadLeft + i * step, y: scaleY(data[i]) });
  }

  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const c1x = p1.x + ((p2.x - p0.x) / 6) * smoothing;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * smoothing;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * smoothing;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * smoothing;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Smooth bezier sparkline used by Active Wallets card.
 *  - Daily series → cubic-bezier curve, no marker cursor
 *  - Teal area gradient (matches accent), thin stroke with non-scaling-stroke
 *  - Bioluminescent endpoint dot offset inside the right padding so it doesn't sit on the edge
 */
export default function SmoothSparkline({ series, accent }: SmoothSparklineProps) {
  const W = 240;
  const H = 60;
  const uid = useId().replace(/:/g, '');
  const areaGrad = `area-${uid}`;
  const lineGrad = `line-${uid}`;

  const X_PAD_LEFT = 2;
  const X_PAD_RIGHT = 14;
  const Y_PAD = 4;

  const line = useMemo(() => curvePath(series, W, H, 0.85, X_PAD_LEFT, X_PAD_RIGHT, Y_PAD), [series]);
  const area = useMemo(() => `${line} L ${W - X_PAD_RIGHT} ${H} L ${X_PAD_LEFT} ${H} Z`, [line]);

  // Endpoint (most recent value) — for the pulsing dot.
  // Sits inside X_PAD_RIGHT so it has breathing room from the card edge.
  const last = series.length > 0 ? series[series.length - 1] : 0;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const endX = W - X_PAD_RIGHT;
  const endY = H - Y_PAD - ((last - min) / span) * (H - 2 * Y_PAD);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={areaGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.40} />
            <stop offset="60%" stopColor={accent} stopOpacity={0.10} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={lineGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
            <stop offset="100%" stopColor="#D5EEF1" stopOpacity={0.95} />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${areaGrad})`} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke={`url(#${lineGrad})`}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={endX}
          cy={endY}
          r={2.4}
          fill="#D5EEF1"
          className="spark-endpoint-pulse"
        />
      </svg>
    </div>
  );
}
