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
  const y = H / 2;
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
  const span = max - min || 1e-9;
  const step = (width - 2 * xPad) / Math.max(n - 1, 1);
  const pad = Math.max(0, Math.floor(yPadPx));
  const scaleY = (v: number) => {
    const t = (v - min) / span;
    const y = height - (pad + t * (height - 2 * pad));
    return Math.max(0, Math.min(height, y));
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
  fixedXFrac = 0.8,
  yPadPx = 3,
  pathAnimMs = 2400,
}: TpsSparklineProps) {
  const W = width, H = height, XPAD = xpad;
  const smoothed = React.useMemo(() => rollingAverage(series ?? [], 5), [series]);
  const windowed = React.useMemo(() => smoothed.slice(-trendWin), [smoothed, trendWin]);
  const renderSeries = React.useMemo(() => upsampleLinear(windowed, trendRes), [windowed, trendRes]);
  // series actually displayed (frozen when not hovered)
  const [displaySeries, setDisplaySeries] = React.useState<number[]>([]);
  const seededRef = React.useRef(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const pathAnimRef = React.useRef<number | null>(null);
  const targetRef = React.useRef<number[]>([]);
  const lastTsRef = React.useRef<number | null>(null);
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
    if (!isHovered) {
      if (pathAnimRef.current) cancelAnimationFrame(pathAnimRef.current);
      pathAnimRef.current = null;
      lastTsRef.current = null;
      return;
    }
    function step(now: number) {
      const prevTs = lastTsRef.current;
      lastTsRef.current = now;
      const to = targetRef.current;
      if (to.length > 0) {
        const outLen = to.length;
        const fromArr = resampleToLength(displaySeries.length ? displaySeries : to, outLen);
        const tgtArr = resampleToLength(to, outLen);
        const dt = prevTs == null ? 16 : Math.max(0, now - prevTs);
        const tau = Math.max(50, pathAnimMs / 2);
        const alpha = 1 - Math.exp(-dt / tau); // 0..1
        const blended = new Array(outLen);
        for (let i = 0; i < outLen; i++) blended[i] = fromArr[i] + (tgtArr[i] - fromArr[i]) * alpha;
        blendedRef.current = blended;
        // compute path and update d attributes without re-render
        const d = trendToCurvePath(blended, W, H, 0.95, XPAD, yPadPx, yRef.current);
        if (pathBackRef.current) pathBackRef.current.setAttribute('d', d);
        if (pathMidRef.current) pathMidRef.current.setAttribute('d', d);
        if (pathTopRef.current) pathTopRef.current.setAttribute('d', d);
        if (areaRef.current) {
          const areaD = `${d} L ${W - XPAD} ${H} L ${XPAD} ${H} Z`;
          areaRef.current.setAttribute('d', areaD);
        }
        // update marker in the same frame
        const markX = XPAD + (W - 2 * XPAD) * fixedXFrac;
        const stepX = (W - 2 * XPAD) / Math.max(outLen - 1, 1);
        const min = (yRef.current ? yRef.current.min : Math.min(...blended));
        const max = (yRef.current ? yRef.current.max : Math.max(...blended));
        const span = Math.max(1e-9, max - min);
        const pad = Math.max(0, Math.floor(yPadPx));
        const scaleY = (v: number) => {
          const t = (v - min) / span;
          const y = H - (pad + t * (H - 2 * pad));
          return Math.max(0, Math.min(H, y));
        };
        const pos = (markX - XPAD) / stepX;
        const i = Math.max(0, Math.min(outLen - 1, Math.floor(pos)));
        const j = Math.max(0, Math.min(outLen - 1, i + 1));
        const f = Math.max(0, Math.min(1, pos - i));
        const v = i === j ? blended[i] : blended[i] * (1 - f) + blended[j] * f;
        if (markerRef.current) {
          markerRef.current.setAttribute('cx', String(markX));
          markerRef.current.setAttribute('cy', String(scaleY(v)));
        } else {
          setMarker({ x: markX, y: scaleY(v) });
        }
      }
      pathAnimRef.current = requestAnimationFrame(step);
    }
    if (pathAnimRef.current) cancelAnimationFrame(pathAnimRef.current);
    pathAnimRef.current = requestAnimationFrame(step);
    return () => { if (pathAnimRef.current) cancelAnimationFrame(pathAnimRef.current); };
  }, [isHovered, pathAnimMs]);

  const seriesStats = React.useMemo(() => {
    const n = displaySeries.length;
    if (n === 0) return { n: 0, min: 0, max: 0, span: 0, isFlat: true };
    let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < n; i++) { const v = displaySeries[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    const span = ma - mi;
    return { n, min: mi, max: ma, span, isFlat: n < 2 || span < 1e-6 };
  }, [displaySeries]);

  // target y-domain based on incoming data to avoid per-frame domain changes
  const yTarget = React.useMemo(() => {
    const n = renderSeries.length;
    if (n === 0) return undefined;
    let mi = Infinity, ma = -Infinity;
    for (let i = 0; i < n; i++) { const v = renderSeries[i]; if (v < mi) mi = v; if (v > ma) ma = v; }
    let span = ma - mi;
    if (span === 0) {
      const base = (mi === 0 ? 0.1 : Math.abs(mi) * 0.1) * trendZoom;
      mi -= base / 2; ma += base / 2;
    } else {
      const extra = span * (trendZoom - 1) / 2;
      const pad = span * 0.1 + extra;
      mi -= pad; ma += pad;
    }
    return { min: mi, max: ma };
  }, [renderSeries, trendZoom]);

  const [yDomain, setYDomain] = React.useState<{ min: number; max: number } | undefined>(undefined);
  const yRef = React.useRef<{ min: number; max: number } | undefined>(undefined);
  React.useEffect(() => {
    if (!yTarget) { yRef.current = undefined; setYDomain(undefined); return; }
    const prev = yRef.current;
    const a = emaAlpha;
    const sm = prev ? { min: prev.min + a * (yTarget.min - prev.min), max: prev.max + a * (yTarget.max - prev.max) } : yTarget;
    yRef.current = sm;
    setYDomain(sm);
  }, [yTarget, emaAlpha]);

  const lastDeltaSrc = isHovered ? windowed : displaySeries;
  const lastDelta = lastDeltaSrc.length > 1 ? lastDeltaSrc[lastDeltaSrc.length - 1] - lastDeltaSrc[lastDeltaSrc.length - 2] : 0;
  const trendColor = lastDelta > 0 ? '#10b981' : lastDelta < 0 ? '#f59e0b' : '#7c3aed';
  const colorStart = lastDelta > 0 ? '#34d399' : lastDelta < 0 ? '#fbbf24' : '#a78bfa';

  const isFlat = seriesStats.isFlat;
  const sparkPath = React.useMemo(() => isFlat ? flatPath(W, H, XPAD) : trendToCurvePath(displaySeries, W, H, 0.95, XPAD, yPadPx, yDomain), [displaySeries, yDomain, isFlat, W, H, XPAD, yPadPx]);
  const areaPath = React.useMemo(() => isFlat ? '' : `${sparkPath} L ${W - XPAD} ${H} L ${XPAD} ${H} Z`, [sparkPath, isFlat, W, H, XPAD]);

  // marker
  const [marker, setMarker] = React.useState<{ x: number; y: number }>({ x: XPAD + (W - 2 * XPAD) * fixedXFrac, y: H / 2 });
  // Snap marker when not hovered (use current series and domain)
  React.useEffect(() => {
    const n = displaySeries.length;
    const markX = XPAD + (W - 2 * XPAD) * fixedXFrac;
    if (!isHovered || isFlat || n === 0) {
      const stepX = (W - 2 * XPAD) / Math.max(n - 1, 1);
      const min = yDomain ? yDomain.min : (n ? Math.min(...displaySeries) : 0);
      const max = yDomain ? yDomain.max : (n ? Math.max(...displaySeries) : 1);
      const span = Math.max(1e-9, max - min);
      const pad = Math.max(0, Math.floor(yPadPx));
      const scaleY = (v: number) => {
        const t = (v - min) / span;
        const y = H - (pad + t * (H - 2 * pad));
        return Math.max(0, Math.min(H, y));
      };
      let markY = H / 2;
      if (n > 0) {
        const pos = (markX - XPAD) / stepX;
        const i = Math.max(0, Math.min(n - 1, Math.floor(pos)));
        const j = Math.max(0, Math.min(n - 1, i + 1));
        const f = Math.max(0, Math.min(1, pos - i));
        const v = i === j ? displaySeries[i] : displaySeries[i] * (1 - f) + displaySeries[j] * f;
        markY = scaleY(v);
      }
      setMarker({ x: markX, y: markY });
    }
  }, [isHovered, isFlat, displaySeries, yDomain, W, H, XPAD, fixedXFrac, yPadPx]);

  // refs for imperative updates to avoid rerender cost during RAF
  const pathBackRef = React.useRef<SVGPathElement>(null);
  const pathMidRef = React.useRef<SVGPathElement>(null);
  const pathTopRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const markerRef = React.useRef<SVGCircleElement>(null);
  const blendedRef = React.useRef<number[]>([]);
  // Update displaySeries on hover end to freeze the last blended path
  React.useEffect(() => {
    if (!isHovered && blendedRef.current.length) setDisplaySeries(blendedRef.current.slice());
  }, [isHovered]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <defs>
        <linearGradient id="tpsStroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={colorStart} />
          <stop offset="100%" stopColor={trendColor} />
        </linearGradient>
        <linearGradient id="tpsArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colorStart} stopOpacity={0.12} />
          <stop offset="100%" stopColor={trendColor} stopOpacity={0.01} />
        </linearGradient>
        <linearGradient id="fadeRight" x1="0" x2="1" y1="0" y2="0">
          <stop offset="80%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="maskRight">
          <rect x={0} y={0} width={W} height={H} fill="url(#fadeRight)" />
        </mask>
      </defs>
      <g stroke="#e5e7eb" strokeOpacity={0.25} strokeWidth={0.5} shapeRendering="crispEdges">
        <line x1={0} y1={H * 0.25} x2={W} y2={H * 0.25} />
        <line x1={0} y1={H * 0.5} x2={W} y2={H * 0.5} />
        <line x1={0} y1={H * 0.75} x2={W} y2={H * 0.75} />
      </g>
      {!isFlat && areaPath ? <path ref={areaRef} d={areaPath} fill="url(#tpsArea)" stroke="none" mask="url(#maskRight)" /> : null}
      <path ref={pathBackRef} d={sparkPath} fill="none" stroke="url(#tpsStroke)" strokeWidth={2.0} strokeOpacity={0.12} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={pathMidRef} d={sparkPath} fill="none" stroke="url(#tpsStroke)" strokeWidth={1.2} strokeOpacity={0.20} strokeLinecap="round" strokeLinejoin="round" />
      <path ref={pathTopRef} d={sparkPath} fill="none" stroke="url(#tpsStroke)" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
      <circle ref={markerRef} cx={marker.x} cy={marker.y} r={1.0} fill={trendColor} stroke="#fff" strokeWidth={0.45} />
    </svg>
  );
});

export default TpsSparkline;
