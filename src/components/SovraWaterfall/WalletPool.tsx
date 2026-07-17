import { useEffect, useRef } from 'react';
import { C, REEF_USD } from './constants';
import { fmtAmount, fmtUsd } from './format';

/** Animates balance digits "surfacing" one by one. */
function SurfacingText({
  text, baseDelay = 0, step = 55, style,
}: {
  text: string | number;
  baseDelay?: number;
  step?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span style={style}>
      {String(text).split('').map((ch, i) => (
        <span key={i} className="swf-digit-surface" style={{ animationDelay: `${baseDelay + i * step}ms` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

interface Ripple { x: number; y: number; age: number; max: number; }

interface WalletPoolProps {
  netFlow: number;
  balance: number;            // available (transferable) REEF — the "flowing surface"
  /** Real USD value of the balance; falls back to the mock multiplier if omitted. */
  balanceUsd?: number;
  /** Staked REEF — shown as a secondary line under the balance. */
  lockedReef?: number;
  /** Summary still loading — show a quiet placeholder instead of a false 0 balance. */
  loading?: boolean;
  /** Bump to ripple the water from the center (a live transfer just landed). */
  pulse?: number;
  compact?: boolean;
  big?: boolean;
  onDive?: () => void;
  showHint?: boolean;
}

/** Central wallet pool: living-water canvas (rings, ripples, glint) + balance. */
export default function WalletPool({
  netFlow, balance, balanceUsd, lockedReef = 0, loading = false, pulse = 0, compact = false, big = false, onDive, showHint = false,
}: WalletPoolProps) {
  const positive = netFlow >= 0;
  const rgb = positive ? [125, 211, 218] : [255, 139, 110];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);                       // active touch ripples
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const SIZE = 290;

  // live transfer landed -> a ring spreads from the center of the lake
  useEffect(() => {
    if (!pulse) return;
    ripplesRef.current.push({ x: SIZE / 2, y: SIZE / 2, age: 0, max: 1.5 });
  }, [pulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cx = SIZE / 2, cy = SIZE / 2;
    const baseR = SIZE * 0.27; // lake radius
    let raf = 0, t = 0;

    // cache the fill gradient — it never changes, so build it once instead of every frame
    const fillGrad = ctx.createRadialGradient(cx, cy - baseR * 0.25, baseR * 0.1, cx, cy, baseR * 1.15);
    if (positive) {
      fillGrad.addColorStop(0, 'rgba(125,211,218,0.28)');
      fillGrad.addColorStop(0.7, 'rgba(91,192,217,0.10)');
      fillGrad.addColorStop(1, 'rgba(2,21,30,0.0)');
    } else {
      fillGrad.addColorStop(0, 'rgba(255,139,110,0.28)');
      fillGrad.addColorStop(0.7, 'rgba(216,98,63,0.10)');
      fillGrad.addColorStop(1, 'rgba(2,21,30,0.0)');
    }

    // ~30fps cap + pause when tab/app is hidden (saves battery)
    const FRAME_MS = 1000 / 30;
    let lastFrame = 0, paused = false;
    const onVis = () => {
      paused = document.hidden;
      if (!paused) { lastFrame = 0; raf = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', onVis);

    function wavyRing(
      r: number, baseAmp: number, freq: number, phase: number,
      alpha: number | null, lineW: number, fill: CanvasGradient | string | null,
    ) {
      if (!ctx) return;
      ctx.beginPath();
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const wob = Math.sin(a * freq + phase) * baseAmp
          + Math.sin(a * (freq * 1.7) - phase * 0.6) * baseAmp * 0.5
          + Math.sin(a * (freq * 0.5) + phase * 1.3) * baseAmp * 0.35;
        const rr = r + wob;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (alpha != null) {
        ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx.lineWidth = lineW;
        ctx.stroke();
      }
    }

    function tick(now: number) {
      if (paused || !ctx) return;
      raf = requestAnimationFrame(tick);
      if (now && now - lastFrame < FRAME_MS) return; // throttle to ~30fps
      lastFrame = now || 0;

      t += 0.032; // larger step to match the lower frame rate (same visual speed)
      ctx.clearRect(0, 0, SIZE, SIZE);

      // filled water body — wavy surface (gradient is cached above)
      wavyRing(baseR * 1.02, 3, 6, t * 0.9 + 3, null, 0, fillGrad);

      // concentric surface rings rippling outward
      wavyRing(baseR * 1.95, 5, 3, t * 0.6, 0.08, 1, null);
      wavyRing(baseR * 1.62, 4.5, 4, -t * 0.5 + 1, 0.13, 1, null);
      wavyRing(baseR * 1.32, 3.5, 5, t * 0.7 + 2, 0.22, 1.2, null);
      wavyRing(baseR * 1.08, 2.5, 6, t * 0.9 + 3, 0.34, 1.4, null);

      // pointer highlight: a soft moving glint on the surface
      if (pointerRef.current.active) {
        const px = pointerRef.current.x, py = pointerRef.current.y;
        const distToCenter = Math.hypot(px - cx, py - cy);
        if (distToCenter < baseR * 2) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, baseR * 0.9);
          g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.16)`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, baseR * 1.95, 0, Math.PI * 2); ctx.fill();
        }
      }

      // touch ripples — expanding fading circles from tap point
      const live: Ripple[] = [];
      ripplesRef.current.forEach((rp) => {
        rp.age += 0.036; // doubled to match ~30fps (same fade duration)
        const prog = rp.age / rp.max;
        if (prog < 1) {
          const rr = prog * baseR * 2;
          const alpha = (1 - prog) * 0.5;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
          ctx.lineWidth = 1.5 * (1 - prog) + 0.4;
          ctx.stroke();
          live.push(rp);
        }
      });
      ripplesRef.current = live;
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [positive]);

  // pointer handlers (work for both mouse + touch)
  const localCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const te = e as React.TouchEvent;
    const me = e as React.MouseEvent;
    const src = te.touches?.[0] || te.changedTouches?.[0] || me;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const addRipple = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = localCoords(e);
    ripplesRef.current.push({ x, y, age: 0, max: 1.1 });
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = localCoords(e);
    pointerRef.current = { x, y, active: true };
  };
  const onLeave = () => { pointerRef.current.active = false; };

  return (
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '0' : '10px 0' }}>
      <div style={{
        position: 'relative', width: SIZE, height: SIZE,
        transform: compact ? 'scale(0.32)' : (big ? 'scale(1.32)' : 'scale(1)'),
        margin: compact ? `${-SIZE * 0.34}px ${-SIZE * 0.34}px` : (big ? `${SIZE * 0.16}px 0` : 0),
        transition: 'transform 0.6s cubic-bezier(.25,.8,.35,1)',
      }}>
        {/* living-water canvas (rings, ripples, glint) */}
        <canvas
          ref={canvasRef}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onClick={(e) => { addRipple(e); if (onDive) onDive(); }}
          onTouchStart={(e) => { addRipple(e); if (onDive) onDive(); }}
          onTouchMove={onMove}
          onTouchEnd={onLeave}
          style={{ position: 'absolute', inset: 0, width: SIZE, height: SIZE, cursor: 'pointer', touchAction: 'none', zIndex: 2 }}
        />

        {/* balance text inside the water — only in entry/full mode (compact shows it beside) */}
        {!compact && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', pointerEvents: 'none', zIndex: 1, width: '60%',
          }}>
            <div className={big ? 'swf-label-fade' : ''} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMute, marginBottom: 5, animationDelay: '0ms' }}>
              balance
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {loading ? (
                /* placeholder while the summary loads — the digits "surface" on arrival */
                <span className="swf-seal-breath" style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: big ? 32 : 30, fontWeight: 600, color: C.textMute, lineHeight: 1 }}>···</span>
              ) : big ? (
                <SurfacingText text={fmtAmount(balance)} baseDelay={120} step={60}
                  style={{
                    fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 34, fontWeight: 600, color: C.text, lineHeight: 1,
                    // dark shadow for legibility + a soft glow in the flow color (teal/coral)
                    textShadow: `0 2px 12px rgba(2,21,30,0.85), 0 0 26px rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.45)`,
                  }} />
              ) : (
                <span style={{ fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 30, fontWeight: 600, color: C.text, lineHeight: 1, textShadow: '0 2px 12px rgba(2,21,30,0.8)' }}>
                  {fmtAmount(balance)}
                </span>
              )}
              {!loading && (
                <span className={big ? 'swf-label-fade' : ''} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.textDim, animationDelay: '600ms' }}>REEF</span>
              )}
            </div>
            <div className={big ? 'swf-label-fade' : ''} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, color: C.tealLight, marginTop: 4, animationDelay: '750ms' }}>
              {loading ? ' ' : fmtUsd(balanceUsd != null ? balanceUsd : balance * REEF_USD)}
            </div>
            {lockedReef > 0 && (
              <div className={big ? 'swf-label-fade' : ''} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, color: C.staking, opacity: 0.8, marginTop: 5, animationDelay: '900ms', whiteSpace: 'nowrap' }}>
                ◈ {fmtAmount(lockedReef)} staked
              </div>
            )}
          </div>
        )}
      </div>
      {showHint && (
        <div className="swf-seal-breath" style={{
          marginTop: 4, fontFamily: '"JetBrains Mono",monospace', fontSize: 10,
          letterSpacing: '0.18em', textTransform: 'uppercase', color: C.textMute,
        }}>
          tap the water to dive
        </div>
      )}
    </div>
  );
}
