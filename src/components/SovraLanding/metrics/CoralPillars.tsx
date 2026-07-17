import { useState, useRef, useCallback } from 'react';
import { coralSeed, CORAL_HUES } from '../data/coralSeed';

/**
 * CoralPillars — a living reef bar chart (pure CSS: divs + gradients, no canvas/SVG).
 *
 * Each bar is a coral. Four species (deterministic per index):
 *   column 40% · finger 25% · massive brain 20% · tube cluster 15%
 * Bar height honestly encodes the data value (tallest part = the day's value).
 *
 * Required keyframes (coralSway, coralGlow) + .coral-sway live in sovra-animations.css.
 */

interface CoralPillarsProps {
  series: readonly number[];
  accent: string;                      // hex like '#7DD3DA' — hue-rotate builds the palette per coral
  hoveredBar: number | null;
  onBarHover: (i: number | null) => void;
  /** Spacing between corals (px). Larger on mobile where fewer bars are shown. */
  gap?: number;
}

type Species = 'column' | 'finger' | 'massive' | 'tube';

export default function CoralPillars({
  series, accent, hoveredBar, onBarHover, gap = 3,
}: CoralPillarsProps) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = (max - min) || 1;

  // cursor tracking for parallax (rAF-throttled so we don't re-render 60+/sec)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const rafPending = useRef(false);
  const pendingX = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pendingX.current = e.clientX - rect.left;
    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        setCursorX(pendingX.current);
        rafPending.current = false;
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCursorX(null);
    onBarHover(null);
  }, [onBarHover]);

  const containerW = containerRef.current?.offsetWidth || 1000;
  // -1 (cursor at left edge) → +1 (cursor at right edge), 0 = centered
  const normalizedCursor = cursorX !== null
    ? (cursorX - containerW / 2) / (containerW / 2)
    : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex', alignItems: 'flex-end', gap,
        height: 140, padding: '14px 0 0', position: 'relative',
      }}
    >
      {/* Sand floor — in FRONT of coral bases (z 5 vs corals z 1) so corals look planted */}
      <div style={{
        position: 'absolute', left: -12, right: -12, bottom: 0, height: 7,
        background: 'linear-gradient(180deg, '
          + 'rgba(190, 210, 160, 0.7) 0%, '
          + 'rgba(140, 155, 105, 0.88) 30%, '
          + 'rgba(95, 105, 70, 0.95) 65%, '
          + 'rgba(60, 70, 40, 0.98) 100%)',
        boxShadow: '0 -1px 0 rgba(220, 235, 190, 0.55)',
        pointerEvents: 'none', zIndex: 5,
      }}/>
      {/* Sediment specks on the sand */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 7,
        backgroundImage:
          'radial-gradient(circle, rgba(220, 235, 180, 0.75) 0.7px, transparent 1.2px), '
          + 'radial-gradient(circle, rgba(200, 215, 165, 0.55) 0.5px, transparent 1px), '
          + 'radial-gradient(circle, rgba(160, 170, 120, 0.5) 1px, transparent 1.5px)',
        backgroundSize: '13px 7px, 19px 7px, 31px 7px',
        backgroundPosition: '0 3px, 7px 1px, 15px 4px',
        pointerEvents: 'none', zIndex: 6,
      }}/>

      {series.map((v, i) => {
        // honest height from data
        const normHeight = ((v - min) / range) * 0.82 + 0.18;
        const isHovered = hoveredBar === i;
        const dist = hoveredBar !== null ? Math.abs(i - hoveredBar) : Infinity;
        const prox = dist <= 2 ? (1 - dist / 3) : 0;
        const lift = isHovered ? -5 : (prox > 0 ? -2 * prox : 0);

        // per-coral organic DNA — all deterministic from index
        const widthPct   = 55 + coralSeed(i, 1) * 38;
        const tilt       = (coralSeed(i, 2) - 0.5) * 2.8;
        const tipSize    = 6 + coralSeed(i, 3) * 7;
        const bandStep   = 10 + Math.floor(coralSeed(i, 5) * 9);
        const bandAlpha  = 0.07 + coralSeed(i, 6) * 0.09;
        const hasBranch  = coralSeed(i, 7) > 0.74;
        const branchSide: 'left' | 'right' = coralSeed(i, 8) > 0.5 ? 'left' : 'right';
        const branchTop  = 28 + coralSeed(i, 9) * 35;
        const topRound   = 40 + coralSeed(i, 10) * 20;

        const hueShift = CORAL_HUES[Math.floor(coralSeed(i, 30) * CORAL_HUES.length)];
        const satShift = 0.75 + coralSeed(i, 31) * 0.30;

        // species selector — a reef, not a bar chart
        const sp = coralSeed(i, 32);
        const species: Species = sp < 0.40 ? 'column' : sp < 0.65 ? 'finger' : sp < 0.85 ? 'massive' : 'tube';

        // species DNA
        const fingerCount = 2 + (coralSeed(i, 33) > 0.5 ? 1 : 0);
        const fingerDrop2 = 0.72 + coralSeed(i, 34) * 0.16;
        const fingerDrop3 = 0.5 + coralSeed(i, 35) * 0.18;
        const blobSquish  = 0.9 + coralSeed(i, 36) * 0.25;
        // organic 8-value border radius (asymmetric blob edges)
        const br = (s: number) =>
          `${38 + coralSeed(i, s) * 30}% ${38 + coralSeed(i, s + 1) * 30}% ${34 + coralSeed(i, s + 2) * 26}% ${34 + coralSeed(i, s + 3) * 26}% / ${44 + coralSeed(i, s + 4) * 28}% ${44 + coralSeed(i, s + 5) * 28}% ${30 + coralSeed(i, s + 6) * 22}% ${30 + coralSeed(i, s + 7) * 22}%`;

        // polyps (columns + massive only; fingers/tubes glow on their own)
        const polypCount = 1 + Math.floor(coralSeed(i, 40) * 2.99);
        const polyps = Array.from({ length: polypCount }, (_, k) => ({
          size: tipSize * (0.55 + coralSeed(i, 41 + k * 4) * 0.55),
          xOffset: (coralSeed(i, 42 + k * 4) - 0.5) * 7,
          yOffset: -1 + (coralSeed(i, 43 + k * 4) - 0.5) * 3,
          bright: 0.5 + coralSeed(i, 44 + k * 4) * 0.5,
        }));

        // interaction
        const susceptibility = 0.4 + coralSeed(i, 50) * 1.6;
        const parallaxX = -normalizedCursor * susceptibility;
        const swayDuration = 6 + coralSeed(i, 60) * 4;
        const swayDelay = coralSeed(i, 61) * 3;

        const baseFilter = `hue-rotate(${hueShift}deg) saturate(${satShift.toFixed(2)})`;
        const hoverFilter = isHovered ? 'brightness(1.35)' : (prox > 0 ? `brightness(${1 + prox * 0.2})` : 'brightness(1)');

        return (
          <div
            key={i}
            onMouseEnter={() => onBarHover(i)}
            style={{
              flex: 1,
              height: `${normHeight * 100}%`,
              position: 'relative',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
              cursor: 'pointer',
              transition: 'transform 0.28s cubic-bezier(.2,.7,.3,1), filter 0.25s ease',
              transform: `translate(${parallaxX.toFixed(2)}px, ${lift}px) rotate(${tilt}deg) ${isHovered ? 'scale(1.08)' : 'scale(1)'}`,
              filter: `${baseFilter} ${hoverFilter}`,
              transformOrigin: 'bottom center',
              zIndex: 1,
            }}
          >
            <div className="coral-sway" style={{
              width: '100%', height: '100%',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
              position: 'relative',
              animationDuration: `${swayDuration.toFixed(2)}s`,
              animationDelay: `${swayDelay.toFixed(2)}s`,
            }}>

            {species === 'finger' ? (
              /* ===== FINGER CORAL — 2-3 digits from one base, tallest = data height ===== */
              <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '6%' }}>
                {Array.from({ length: fingerCount }, (_, f) => {
                  const hRatio = f === 0 ? 1 : (f === 1 ? fingerDrop2 : fingerDrop3);
                  const order = Math.floor(coralSeed(i, 70 + f) * 3);
                  return (
                    <div key={f} style={{
                      order,
                      width: `${(widthPct * 0.34).toFixed(1)}%`, minWidth: 4,
                      height: `${(hRatio * 100).toFixed(1)}%`,
                      background: `linear-gradient(115deg, ${accent} 0%, ${accent}d0 45%, ${accent}70 100%)`,
                      borderRadius: '46% 54% 40% 42% / 70% 66% 8% 8%',
                      boxShadow: isHovered
                        ? `0 0 18px ${accent}90, inset -2px 0 6px rgba(0,15,25,0.45), inset 0 -8px 10px rgba(0,15,25,0.35)`
                        : `0 0 6px ${accent}35, inset -2px 0 6px rgba(0,15,25,0.45), inset 0 -8px 10px rgba(0,15,25,0.35)`,
                      transition: 'box-shadow 0.25s ease',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                        width: '70%', height: 6, borderRadius: '50%',
                        background: `radial-gradient(ellipse, rgba(255,255,255,0.75) 0%, ${accent} 55%, transparent 100%)`,
                        boxShadow: `0 0 6px ${accent}`,
                        pointerEvents: 'none',
                      }}/>
                    </div>
                  );
                })}
                <div style={{
                  position: 'absolute', bottom: -1, left: '8%', right: '8%', height: '14%', minHeight: 5,
                  background: `linear-gradient(180deg, ${accent}90 0%, ${accent}45 100%)`,
                  borderRadius: '50% 50% 6px 6px / 90% 90% 6px 6px',
                  boxShadow: 'inset 0 -4px 6px rgba(0,15,25,0.4)',
                  pointerEvents: 'none',
                }}/>
              </div>
            ) : species === 'massive' ? (
              /* ===== MASSIVE BRAIN CORAL — stacked organic boulders with grooves ===== */
              <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                <div style={{
                  width: `${Math.min(widthPct * 1.2, 96)}%`,
                  height: `${(58 * blobSquish).toFixed(0)}%`,
                  background: `radial-gradient(ellipse at 32% 26%, #ffffff30 0%, transparent 42%), linear-gradient(115deg, ${accent} 0%, ${accent}cc 50%, ${accent}78 100%)`,
                  borderRadius: br(80),
                  boxShadow: isHovered
                    ? `0 0 20px ${accent}90, inset -4px -6px 14px rgba(0,15,25,0.4)`
                    : `0 0 7px ${accent}38, inset -4px -6px 14px rgba(0,15,25,0.4)`,
                  position: 'relative', zIndex: 2,
                  transition: 'box-shadow 0.25s ease',
                }}>
                  <div style={{
                    position: 'absolute', inset: '6% 8%',
                    backgroundImage: `repeating-radial-gradient(ellipse at 45% 40%, transparent 0px, transparent 3px, rgba(0,15,25,${(bandAlpha + 0.08).toFixed(2)}) 3px, rgba(0,15,25,${(bandAlpha + 0.08).toFixed(2)}) 4.5px)`,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                  }}/>
                </div>
                <div style={{
                  width: `${Math.min(widthPct * 1.05, 90)}%`,
                  flex: 1, marginTop: -6,
                  background: `linear-gradient(115deg, ${accent}b8 0%, ${accent}80 55%, ${accent}48 100%)`,
                  borderRadius: br(90),
                  boxShadow: 'inset -3px -6px 12px rgba(0,15,25,0.5)',
                  position: 'relative', zIndex: 1,
                }}/>
              </div>
            ) : species === 'tube' ? (
              /* ===== TUBE CORAL — cluster of short tubes, dark mouths, glowing rims ===== */
              <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4%' }}>
                {Array.from({ length: 3 + (coralSeed(i, 74) > 0.55 ? 1 : 0) }, (_, tIdx) => {
                  const tCount = 3 + (coralSeed(i, 74) > 0.55 ? 1 : 0);
                  const hRatio = tIdx === 0 ? 1 : 0.55 + coralSeed(i, 75 + tIdx) * 0.35;
                  const order = Math.floor(coralSeed(i, 78 + tIdx) * tCount);
                  return (
                    <div key={tIdx} style={{
                      order,
                      width: `${(widthPct * 0.30).toFixed(1)}%`, minWidth: 5,
                      height: `${(hRatio * 100).toFixed(1)}%`,
                      background: `linear-gradient(115deg, ${accent}f0 0%, ${accent}b0 50%, ${accent}68 100%)`,
                      borderRadius: '38% 42% 30% 32% / 18% 20% 6% 6%',
                      boxShadow: isHovered
                        ? `0 0 16px ${accent}88, inset -2px 0 5px rgba(0,15,25,0.45), inset 0 -6px 8px rgba(0,15,25,0.35)`
                        : `0 0 5px ${accent}32, inset -2px 0 5px rgba(0,15,25,0.45), inset 0 -6px 8px rgba(0,15,25,0.35)`,
                      transition: 'box-shadow 0.25s ease',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
                        width: '86%', height: 7, borderRadius: '50%',
                        background: `radial-gradient(ellipse at 50% 58%, rgba(0,15,25,0.9) 0%, rgba(0,15,25,0.6) 42%, ${accent} 68%, ${accent}d0 100%)`,
                        boxShadow: `0 0 5px ${accent}90, inset 0 1px 2px rgba(255,255,255,0.25)`,
                        pointerEvents: 'none',
                      }}/>
                    </div>
                  );
                })}
                <div style={{
                  position: 'absolute', bottom: -1, left: '6%', right: '6%', height: '12%', minHeight: 4,
                  background: `linear-gradient(180deg, ${accent}80 0%, ${accent}40 100%)`,
                  borderRadius: '50% 50% 5px 5px / 85% 85% 5px 5px',
                  boxShadow: 'inset 0 -3px 5px rgba(0,15,25,0.4)',
                  pointerEvents: 'none',
                }}/>
              </div>
            ) : (
              /* ===== COLUMN CORAL — organic pillar, side-lit, growth rings ===== */
              <div style={{
                width: `${widthPct}%`,
                height: '100%',
                position: 'relative',
                background: `radial-gradient(ellipse at 30% 8%, #ffffff28 0%, transparent 36%), linear-gradient(115deg, ${accent} 0%, ${accent}d4 48%, ${accent}68 100%)`,
                borderRadius: `${topRound}% ${100 - topRound}% 42% 38% / 30% 26% 5% 5%`,
                boxShadow: isHovered
                  ? `0 0 22px ${accent}99, inset -3px 0 10px rgba(0,15,25,0.4), inset 0 -10px 14px rgba(0,15,25,0.3)`
                  : `0 0 7px ${accent}40, inset -3px 0 10px rgba(0,15,25,0.4), inset 0 -10px 14px rgba(0,15,25,0.3)`,
                transition: 'box-shadow 0.25s ease',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `repeating-linear-gradient(0deg, rgba(0,15,25,${bandAlpha}) 0px, rgba(0,15,25,${bandAlpha}) 1px, transparent 1px, transparent ${bandStep}px)`,
                  borderRadius: 'inherit',
                  pointerEvents: 'none',
                }}/>
                {hasBranch && (
                  <>
                    <div style={{
                      position: 'absolute', top: `${branchTop}%`, [branchSide]: -3,
                      width: 5, height: 7,
                      background: `linear-gradient(${branchSide === 'left' ? '270deg' : '90deg'}, ${accent} 20%, ${accent}80 100%)`,
                      borderRadius: branchSide === 'left' ? '60% 20% 20% 60%' : '20% 60% 60% 20%',
                      boxShadow: `0 0 4px ${accent}60`,
                      pointerEvents: 'none',
                    }}/>
                    <div style={{
                      position: 'absolute', top: `${branchTop - 1}%`, [branchSide]: -5,
                      width: 4, height: 4,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, ${accent} 0%, ${accent}80 60%, transparent 100%)`,
                      boxShadow: `0 0 3px ${accent}`,
                      opacity: 0.85,
                      pointerEvents: 'none',
                    }}/>
                  </>
                )}
              </div>
            )}

            {/* Polyps — glowing dots (fingers and tubes glow on their own tips) */}
            {species !== 'finger' && species !== 'tube' && polyps.map((p, k) => (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  top: `${p.yOffset - p.size / 2}px`,
                  left: `calc(50% + ${p.xOffset.toFixed(2)}px)`,
                  transform: 'translateX(-50%)',
                  width: p.size, height: p.size,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(255,255,255,${(0.85 * p.bright).toFixed(2)}) 0%, ${accent} 35%, transparent 80%)`,
                  boxShadow: isHovered
                    ? `0 0 ${(10 + p.size).toFixed(0)}px ${accent}, 0 0 5px #fff`
                    : `0 0 ${(3 + p.bright * 6).toFixed(0)}px ${accent}`,
                  animation: `coralGlow ${(1.5 + ((i + k) % 5) * 0.4).toFixed(2)}s ease-in-out infinite`,
                  animationDelay: `${(((i * 0.17) + (k * 0.31)) % 2.5).toFixed(2)}s`,
                  opacity: p.bright,
                  pointerEvents: 'none',
                  transition: 'box-shadow 0.25s ease',
                }}
              />
            ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
