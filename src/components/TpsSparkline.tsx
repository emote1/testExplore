import React from 'react';

interface TpsSparklineProps {
  series: number[];
  trendWin?: number;       // points (seconds)
  trendRes?: number;       // upsample factor 1..8
  trendZoom?: number;      // y-domain zoom, >=1
  height?: number;         // viewBox H
  width?: number;          // viewBox W
  xpad?: number;           // horizontal padding
  emaAlpha?: number;       // EMA for y-domain
  fixedXFrac?: number;     // marker X in [0..1]
  animDurMs?: number;      // marker animation duration
  ease?: 'linear' | 'cubic';
  yPadPx?: number;         // vertical padding in pixels for top/bottom
  pathAnimMs?: number;     // path morph duration
}

function rollingAverage(data: number[], window: number): number[] {
  if (window <= 1) return data.slice();
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= window) sum -= data[i - window];
    const count = Math.min(i + 1, window);
    out.push(sum / count);
  }
  return out;
}

function upsampleLinear(data: number[], factor: number): number[] {
  const f = Math.max(1, Math.floor(factor || 1));
  const n = data.length;
  if (n <= 1 || f === 1) return data.slice();
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    out.push(a);
    for (let k = 1; k < f; k++) {
      const t = k / f;
      out.push(a + (b - a) * t);
    }
  }
  out.push(data[n - 1]);
  return out;
}

function flatPath(W: number, H: number, XPAD: number): string {
  const y = Math.max(0, (H / 2) - 0.6);
  return `M${XPAD} ${y} L${W - XPAD} ${y}`;
}

function resampleToLength(arr: number[], n: number): number[] {
  const m = arr.length;
  if (n <= 0) return [];
  if (m === 0) return new Array(n).fill(0);
  if (m === n) return arr.slice();
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const pos = t * (m - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(m - 1, i0 + 1);
    const f = pos - i0;
    out.push(arr[i0] * (1 - f) + arr[i1] * f);
  }
  return out;
}

function trendToCurvePath(
  data: number[],
  width: number,
  height: number,
  smoothing = 0.8,
  xPad = 1,
  yPadPx = 1,
  yDomain?: { min: number; max: number },
): string {
  const n = data.length;
  if (n === 0) return `M0 ${height / 2} L${width} ${height / 2}`;
  let min: number; let max: number;
  if (yDomain && Number.isFinite(yDomain.min) && Number.isFinite(yDomain.max) && yDomain.max > yDomain.min) {
    min = yDomain.min; max = yDomain.max;
  } else {
    let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < n; i++) { const v = data[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    min = mi; max = ma;
  }
  // Adjust min/max for flat zero data to center the line visibly
  if (max <= 0 && min >= 0) {
    // All zeros or near-zero - create artificial range to show line in middle
    min = -1;
    max = 2;
  }
  // ensure minimum span so flat data renders at reasonable height (not collapsed)
  const rawSpan = max - min;
  const minSpan = 3; // Always at least 3 units span for visibility
  const span = rawSpan < minSpan ? minSpan : rawSpan;
  const step = (width - 2 * xPad) / Math.max(n - 1, 1);
  const pad = Math.max(0, Math.floor(yPadPx));
  const scaleY = (v: number) => {
    // Clamp value to domain to prevent line from falling through
    const clampedV = Math.max(min, Math.min(max, v));
    const t = (clampedV - min) / span;
    const y = height - (pad + t * (height - 2 * pad));
    // Extra clamping for safety
    return Math.max(pad + 0.5, Math.min(height - pad - 0.5, y));
  };
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) pts.push({ x: xPad + i * step, y: scaleY(data[i]) });
  if (pts.length === 1) return `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L${width - xPad} ${pts[0].y.toFixed(2)}`;
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? pts[i + 1];
    const c1x = p1.x + (p2.x - p0.x) / 6 * smoothing;
    const c1y = p1.y + (p2.y - p0.y) / 6 * smoothing;
    const c2x = p2.x - (p3.x - p1.x) / 6 * smoothing;
    const c2y = p2.y - (p3.y - p1.y) / 6 * smoothing;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export const TpsSparkline = React.memo(function TpsSparkline({
  series,
  trendWin = 60,
  trendRes = 8,
  trendZoom = 2,
  height = 20,
  width = 40,
  xpad = 4,
  emaAlpha = 0.18,
  fixedXFrac = 0.5,
  yPadPx = 3,
  pathAnimMs = 2400,
}: TpsSparklineProps) {
  const W = width, H = height, XPAD = xpad;
  // per-instance unique IDs for gradients/masks to avoid collisions
  const uid = React.useRef(`tps-${Math.random().toString(36).slice(2, 9)}`).current;
  const gradStrokeId = `${uid}-stroke`;
  const gradAreaId = `${uid}-area`;
  const fadeRightId = `${uid}-fade`;
  const maskRightId = `${uid}-mask`;
  const strokeUrl = `url(#${gradStrokeId})`;
  const areaUrl = `url(#${gradAreaId})`;
  const fadeUrl = `url(#${fadeRightId})`;
  const maskUrl = `url(#${maskRightId})`;
  const smoothed = React.useMemo(() => rollingAverage(series ?? [], 12), [series]);
  const windowed = React.useMemo(() => smoothed.slice(-trendWin), [smoothed, trendWin]);
  const renderSeries = React.useMemo(() => {
    const arr = upsampleLinear(windowed, trendRes);
    if (arr.length >= 2) return arr;
    const n = Math.max(2, trendRes * Math.max(2, trendWin));
    return new Array(n).fill(0);
  }, [windowed, trendRes, trendWin]);
  // series actually displayed (frozen when not hovered)
  const [displaySeries, setDisplaySeries] = React.useState<number[]>([]);
  const seededRef = React.useRef(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const hoverXFracRef = React.useRef<number>(fixedXFrac);
  const pathAnimRef = React.useRef<number | null>(null);
  const targetRef = React.useRef<number[]>([]);
  const lastTsRef = React.useRef<number | null>(null);
  // Smooth marker Y position (interpolated for fluid movement)
  const markerYRef = React.useRef<number>(height / 2);
  React.useEffect(() => {
    if (!seededRef.current && renderSeries.length) {
      setDisplaySeries(renderSeries);
      seededRef.current = true;
    }
  }, [renderSeries]);
  // Update target on new data
  React.useEffect(() => { targetRef.current = renderSeries; }, [renderSeries]);
  // Continuous smoothing loop while hovered
  React.useEffect(() => {
    function step(now: number) {
      const prevTs = lastTsRef.current;
      lastTsRef.current = now;
      const dt = prevTs == null ? 16 : Math.max(0, now - prevTs);
      const yT = yTargetRef.current;
      if (yT) {
        const cur = yRef.current;
        const yTau = Math.max(2000, pathAnimMs * 2) / Math.max(emaAlpha, 0.01);
        const aBase = 1 - Math.exp(-dt / yTau);
        if (!cur) {
          yRef.current = yT;
        } else {
          // faster contraction when domain shrinks (flat data)
          const aRaiseMax = Math.max(aBase, 0.35);
          const aRaiseMin = aBase * 0.5;
          const aLowerMin = Math.max(aBase * 1.5, 0.08); // faster when lowering min
          const aLowerMax = Math.max(aBase * 1.5, 0.08); // faster when lowering max
          const aMin = yT.min > cur.min ? aRaiseMin : aLowerMin;
          const aMax = yT.max > cur.max ? aRaiseMax : aLowerMax;
          yRef.current = {
            min: cur.min + aMin * (yT.min - cur.min),
            max: cur.max + aMax * (yT.max - cur.max),
          };
        }
      }
      const to = targetRef.current;
      if (to.length > 0) {
        const outLen = to.length;
        const base = (blendedRef.current && blendedRef.current.length) ? blendedRef.current : (displaySeries.length ? displaySeries : to);
        const fromArr = resampleToLength(base, outLen);
        const tgtArr = resampleToLength(to, outLen);
        // Very smooth exponential interpolation for fluid transitions
        const smoothFactor = 0.012; // Very low = very smooth (0.01-0.02 range)
        const blended = new Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const diff = tgtArr[i] - fromArr[i];
          // Smooth exponential easing for fluid movement
          blended[i] = fromArr[i] + diff * smoothFactor;
        }
        blendedRef.current = blended;
        
        // Update path with actual data (no artificial scrolling)
        // Graph now reflects real tx/min changes - jumps up when rate increases!
        // Higher smoothing (1.2) for very smooth curves
        const d = trendToCurvePath(blended, W, H, 1.2, XPAD, yPadPx, yRef.current);
        if (pathTopRef.current) pathTopRef.current.setAttribute('d', d);
        if (areaRef.current) {
          const areaD = `${d} L ${W - XPAD} ${H} L ${XPAD} ${H} Z`;
          areaRef.current.setAttribute('d', areaD);
        }
        
        // Marker in center
        const MARKER_POS = 0.5; // 50% = center
        const markX = XPAD + (W - 2 * XPAD) * MARKER_POS;
        const stepX = (W - 2 * XPAD) / Math.max(outLen - 1, 1);
        
        // Use the same Y domain as the path to prevent marker from "falling through"
        let dom = yRef.current ?? { min: 0, max: 1 };
        // Adjust for zero data - same logic as trendToCurvePath
        if (dom.max <= 0 && dom.min >= 0) {
          dom = { min: -1, max: 2 };
        }
        const rawSpan = dom.max - dom.min;
        const minSpan = 3;
        const span = rawSpan < minSpan ? minSpan : rawSpan;
        const pad = Math.max(0, Math.floor(yPadPx));
        const scaleY = (v: number) => {
          // Clamp value to domain before scaling
          const clampedV = Math.max(dom.min, Math.min(dom.max, v));
          const t = (clampedV - dom.min) / span;
          const y = H - (pad + t * (H - 2 * pad));
          // Extra clamping to ensure marker stays visible
          return Math.max(pad + 1, Math.min(H - pad - 1, y));
        };
        
        const pos = (markX - XPAD) / stepX;
        const i = Math.max(0, Math.min(outLen - 1, Math.floor(pos)));
        const j = Math.max(0, Math.min(outLen - 1, i + 1));
        const f = Math.max(0, Math.min(1, pos - i));
        
        // Safely get values with fallback
        const vi = blended[i] ?? 0;
        const vj = blended[j] ?? vi;
        const v = i === j ? vi : vi * (1 - f) + vj * f;
        
        if (markerRef.current && Number.isFinite(v)) {
          const targetY = scaleY(v);
          // Very smooth exponential easing for fluid marker movement
          const markerSmooth = 0.02; // Very low = very smooth
          markerYRef.current += (targetY - markerYRef.current) * markerSmooth;
          
          markerRef.current.setAttribute('cx', String(markX));
          markerRef.current.setAttribute('cy', String(markerYRef.current));
        }
      }
      pathAnimRef.current = requestAnimationFrame(step);
    }
    if (pathAnimRef.current) cancelAnimationFrame(pathAnimRef.current);
    pathAnimRef.current = requestAnimationFrame(step);
    return () => { if (pathAnimRef.current) cancelAnimationFrame(pathAnimRef.current); };
  }, [pathAnimMs]);

  // target y-domain based on incoming data to avoid per-frame domain changes
  const yTarget = React.useMemo(() => {
    const n = renderSeries.length;
    if (n === 0) return undefined;
    let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < n; i++) { const v = renderSeries[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    // anchor floor at zero to avoid lifting the graph too high
    mi = Math.min(0, mi);
    let span = ma - mi;
    // ensure minimum span so flat data still has visible height
    const minSpan = Math.max(1, ma * 0.15, 5);
    if (span < minSpan) {
      const center = (mi + ma) / 2;
      mi = center - minSpan / 2;
      ma = center + minSpan / 2;
      // keep floor at zero if center is positive
      if (center >= 0) mi = Math.min(0, mi);
      span = ma - mi;
    }
    const extra = span * (trendZoom - 1) / 2;
    const pad = span * 0.1 + extra;
    mi -= pad; ma += pad;
    return { min: mi, max: ma };
  }, [renderSeries, trendZoom]);

  const yTargetRef = React.useRef<{ min: number; max: number } | undefined>(undefined);
  React.useEffect(() => { yTargetRef.current = yTarget; }, [yTarget]);

  const [yDomain, setYDomain] = React.useState<{ min: number; max: number } | undefined>(undefined);
  const yRef = React.useRef<{ min: number; max: number } | undefined>(undefined);
  React.useEffect(() => {
    if (!yTarget) { yRef.current = undefined; setYDomain(undefined); return; }
    if (!yRef.current) { yRef.current = yTarget; setYDomain(yTarget); }
  }, [yTarget]);

  React.useEffect(() => {
    if (!isHovered) return;
    setDisplaySeries(renderSeries);
  }, [isHovered, renderSeries]);

  const lastDeltaSrc = windowed;
  const lastDelta = lastDeltaSrc.length > 1 ? lastDeltaSrc[lastDeltaSrc.length - 1] - lastDeltaSrc[lastDeltaSrc.length - 2] : 0;
  const trendColor = lastDelta > 0 ? '#10b981' : lastDelta < 0 ? '#f59e0b' : '#7c3aed';
  const colorStart = lastDelta > 0 ? '#34d399' : lastDelta < 0 ? '#fbbf24' : '#a78bfa';

  // Keep last curve shape - only draw flat when data is truly empty
  // Don't collapse to flat just because values are near zero (prevents flicker)
  const drawFlat = displaySeries.length < 2;
  const sparkPath = React.useMemo(
    () => drawFlat ? flatPath(W, H, XPAD) : trendToCurvePath(displaySeries, W, H, 0.9, XPAD, yPadPx, yDomain),
    [displaySeries, yDomain, drawFlat, W, H, XPAD, yPadPx]
  );
  const areaPath = React.useMemo(() => `${sparkPath} L ${W - XPAD} ${H} L ${XPAD} ${H} Z`, [sparkPath, W, H, XPAD]);

  // marker initial position (center)
  const [marker] = React.useState<{ x: number; y: number }>({ x: XPAD + (W - 2 * XPAD) * 0.5, y: H / 2 });

  // refs for imperative updates to avoid rerender cost during RAF
  const pathTopRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const markerRef = React.useRef<SVGCircleElement>(null);
  const blendedRef = React.useRef<number[]>([]);
  React.useEffect(() => {
    if (!isHovered && blendedRef.current.length) setDisplaySeries(blendedRef.current.slice());
  }, [isHovered]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      onMouseEnter={(e) => {
        setIsHovered(true);
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const relX = (e as React.MouseEvent<SVGSVGElement>).clientX - rect.left;
        const frac = (relX - XPAD) / Math.max(1, (W - 2 * XPAD));
        hoverXFracRef.current = Math.max(0, Math.min(1, frac));
      }}
      onMouseLeave={() => { setIsHovered(false); }}
      onMouseMove={(e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const frac = (relX - XPAD) / Math.max(1, (W - 2 * XPAD));
        hoverXFracRef.current = Math.max(0, Math.min(1, frac));
      }}
    >
      <defs>
        <linearGradient id={gradStrokeId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={colorStart} />
          <stop offset="100%" stopColor={trendColor} />
        </linearGradient>
        <linearGradient id={gradAreaId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colorStart} stopOpacity={0.12} />
          <stop offset="100%" stopColor={trendColor} stopOpacity={0.01} />
        </linearGradient>
        <linearGradient id={fadeRightId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="80%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={maskRightId}>
          <rect x={0} y={0} width={W} height={H} fill={fadeUrl} />
        </mask>
      </defs>
      <g stroke="#e5e7eb" strokeOpacity={0.25} strokeWidth={0.5} shapeRendering="crispEdges">
        <line x1={0} y1={H * 0.25} x2={W} y2={H * 0.25} />
        <line x1={0} y1={H * 0.5} x2={W} y2={H * 0.5} />
        <line x1={0} y1={H * 0.75} x2={W} y2={H * 0.75} />
      </g>
      {/* Always show area (even when flat) to avoid flicker */}
      <path ref={areaRef} d={areaPath} fill={areaUrl} stroke="none" mask={maskUrl} />
      <path ref={pathTopRef} d={sparkPath} fill="none" stroke={strokeUrl} strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle ref={markerRef} cx={marker.x} cy={marker.y} r={0.8} fill={trendColor} stroke="#fff" strokeWidth={0.3} />
    </svg>
  );
});

export default TpsSparkline;
