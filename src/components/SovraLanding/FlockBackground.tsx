import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type {
  AmbientParticle,
  Boid,
  Bubble,
  BurstParticle,
  CursorState,
  DisturbanceState,
  FlockBackgroundHandle,
  FlockBackgroundProps,
  Point,
  Rect,
} from './types';
import {
  AUTO_PULSE_MS,
  BUBBLE_SPAWN_JITTER_MS,
  BUBBLE_SPAWN_MIN_MS,
  CURSOR_FORCE,
  CURSOR_RADIUS,
  CURSOR_RADIUS_SQ,
  DISTURBANCE_DECAY,
  DISTURBANCE_MAX_MS,
  DISTURBANCE_MIN_MS,
  DISTURBANCE_RADIUS,
  DISTURBANCE_STRENGTH,
  FORM_ENERGY_DURATION_MS,
  FORMATION_COUNT,
  FORMATION_DURATION_BASE,
  FORMATION_DURATION_JITTER,
  GATHER_RADIUS_SQ,
  MAX_SPEED,
  MIN_SPEED,
  PALETTE,
  PALETTE_LARGE,
  PALETTE_SCOUT,
  PALETTE_SNOW,
  PERCEPTION_RADIUS_SQ,
  SB_MARGIN,
  SB_REPULSE_STRENGTH,
  SCATTER_FORCE,
  SCATTER_GATHER_THRESHOLD,
  SEPARATION_RADIUS,
  SEPARATION_RADIUS_SQ,
  TRAIL_FADE,
} from './constants';

/* -------- module-level helper: memoized hex -> RGB parse -------- */
const hexCache = new Map<string, { r: number; g: number; b: number }>();
function withAlpha(hex: string, alpha: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  let rgb = hexCache.get(hex);
  if (!rgb) {
    rgb = {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
    hexCache.set(hex, rgb);
  }
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/* ========================================================================
 * FlockBackground — full-page canvas with boid school, gather/formation,
 * dive + respawn-as-noGather cycle, periodic disturbances, rising bubbles.
 * ======================================================================== */
export const FlockBackground = forwardRef<FlockBackgroundHandle, FlockBackgroundProps>(
  function FlockBackground(props, ref) {
    const {
      particleCount = 140,
      ambientCount = 50,
      reactToCursor = true,
      onGatherChange,
      onCountsChange,
    } = props;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boidsRef = useRef<Boid[]>([]);
    const ambientRef = useRef<AmbientParticle[]>([]);
    const burstRef = useRef<BurstParticle[]>([]);
    const cursorRef = useRef<CursorState>({ x: 0, y: 0, active: false });
    const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    const runningRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const lastPulseRef = useRef(0);
    const reducedMotionRef = useRef(false);
    const bubblesRef = useRef<Bubble[]>([]);
    const lastBubbleSpawnRef = useRef(0);
    const disturbanceRef = useRef<DisturbanceState>({ x: 0, y: 0, strength: 0 });
    const searchBarRectRef = useRef<Rect | null>(null);

    /* ---------------- Imperative API ---------------- */
    useImperativeHandle(
      ref,
      () => ({
        activate(point?: Point) {
          const { w, h } = sizeRef.current;
          const px = point?.x ?? w / 2;
          const py = point?.y ?? h / 2;
          // Spawn burst
          const burst = burstRef.current;
          for (let i = 0; i < 28; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1.5 + Math.random() * 3;
            burst.push({
              x: px,
              y: py,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              life: 1,
              color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
              size: 1.5 + Math.random() * 2,
            });
          }
          // Push nearby boids outward
          const boids = boidsRef.current;
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            const dx = b.x - px;
            const dy = b.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < CURSOR_RADIUS_SQ) {
              const d = Math.sqrt(d2) || 1;
              const force = (1 - d / CURSOR_RADIUS) * 2.4;
              b.vx += (dx / d) * force;
              b.vy += (dy / d) * force;
            }
          }
        },

        triggerDive() {
          const boids = boidsRef.current;
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            if (b.gather > 0.3 && !b.diving) {
              b.diving = true;
              b.divingAge = -Math.random() * 30;
              b.diveDeath = 130 + Math.random() * 55;
            }
          }
        },

        formSearchBar(rect: Rect, energetic = false) {
          searchBarRectRef.current = rect;
          // orbit center nudged down 14px so the top arc clears the tagline above the bar
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2 + 14;
          // elliptical orbit sized to the bar — tall enough to clear the hint row below,
          // and clamped so the outer lane (~×1.44) never leaves the viewport
          const maxA = window.innerWidth / 2 - 60;
          const orbitA = Math.min(rect.width / 2 + 34, maxA / 1.45);
          const orbitB = rect.height / 2 + 58; // clears the "ENTER TO DIVE" hints under the bar

          // Pick fish: gathered first, then nearest to orbit center
          const candidates: Array<{ idx: number; isGathered: boolean; dist2: number }> = [];
          const boids = boidsRef.current;
          for (let i = 0; i < boids.length; i++) {
            if (boids[i].diving) continue;
            const dx = boids[i].x - cx;
            const dy = boids[i].y - cy;
            candidates.push({
              idx: i,
              isGathered: boids[i].gather > 0.5,
              dist2: dx * dx + dy * dy,
            });
          }
          candidates.sort((a, b) => {
            if (a.isGathered !== b.isGathered) return a.isGathered ? -1 : 1;
            return a.dist2 - b.dist2;
          });

          const used = Math.min(FORMATION_COUNT, candidates.length);
          const now = performance.now();
          for (let i = 0; i < used; i++) {
            const fish = boids[candidates[i].idx];
            // orbital slot: spread angles evenly with jitter, 3 loose radius layers, own angular speed
            const layer = i % 3;                                       // inner / mid / outer lane
            const layerScale = 1 + layer * 0.22 + Math.random() * 0.1; // lanes are loose, not rings
            fish.orbitAngle = (i / used) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            fish.orbitA = orbitA * layerScale;
            fish.orbitB = orbitB * layerScale;
            // slow drift; ~60% swim one way, 40% the other — reads as a living school, not a carousel
            fish.orbitSpeed = (0.00018 + Math.random() * 0.00022) * (Math.random() < 0.6 ? 1 : -1);
            fish.orbitWobble = Math.random() * Math.PI * 2;            // radius breathing phase
            fish.lastOrbitTick = null;                                 // fresh delta on first orbit tick
            const startX = cx + Math.cos(fish.orbitAngle) * fish.orbitA;
            const startY = cy + Math.sin(fish.orbitAngle) * fish.orbitB;
            fish.formTarget = { x: startX, y: startY };
            fish.formStartX = fish.x;
            fish.formStartY = fish.y;
            fish.formStartTime = now;
            fish.formDuration = FORMATION_DURATION_BASE + Math.random() * FORMATION_DURATION_JITTER;
            fish.formAngle = Math.atan2(startY - fish.y, startX - fish.x);
            fish.formPhase = Math.random() * Math.PI * 2;
            fish.formEnergetic = energetic;
            fish.formEnergy = energetic ? 1 : 0;
            // an orbiting fish is no longer exiled (covers re-focus while a fish was off-screen)
            fish.exiled = false;
            fish.exileTarget = null;
            fish.returnAt = null;
            fish.returnTarget = null;
            fish.returnSpeed = null;
          }

          // everyone NOT in orbit swims off-screen — the stage clears for the search
          const w = window.innerWidth, h = window.innerHeight;
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            if (b.formTarget || b.diving) continue;
            b.exiled = true;
            b.returnAt = null; b.returnTarget = null; b.returnSpeed = null; // cancel any pending return
            // pick the nearest screen edge and aim well past it
            const dl = b.x, dr = w - b.x, dt = b.y, db = h - b.y;
            const m = Math.min(dl, dr, dt, db);
            const pad = 90 + Math.random() * 60;
            if (m === dl)      b.exileTarget = { x: -pad, y: b.y + (Math.random() - 0.5) * 160 };
            else if (m === dr) b.exileTarget = { x: w + pad, y: b.y + (Math.random() - 0.5) * 160 };
            else if (m === dt) b.exileTarget = { x: b.x + (Math.random() - 0.5) * 160, y: -pad };
            else               b.exileTarget = { x: b.x + (Math.random() - 0.5) * 160, y: h + pad };
          }
        },

        scatterGathered() {
          const rect = searchBarRectRef.current;
          if (!rect) return;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const boids = boidsRef.current;
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            if (b.formTarget || b.diving) continue;
            if (b.gather > SCATTER_GATHER_THRESHOLD) {
              const dx = b.x - cx;
              const dy = b.y - cy;
              const d = Math.sqrt(dx * dx + dy * dy) || 1;
              b.vx += (dx / d) * SCATTER_FORCE;
              b.vy += (dy / d) * SCATTER_FORCE;
              b.gather = 0;
            }
          }
        },

        releaseFromFormation() {
          searchBarRectRef.current = null;
          const boids = boidsRef.current;
          const w = window.innerWidth, h = window.innerHeight;
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            if (b.formTarget) {
              // orbiting fish fly off along their current tangent of travel
              const ang = b.formAngle != null ? b.formAngle : Math.random() * Math.PI * 2;
              const sp = 0.55 + Math.random() * 0.25;
              b.vx = Math.cos(ang) * sp;
              b.vy = Math.sin(ang) * sp;
            }
            // exiled fish return in a soft trickle — a couple of scouts first, the rest
            // over ~4s with varied speeds; ~1/3 just drift back near the edges (lingerers)
            if (b.exiled) {
              const r = Math.random();
              b.returnAt = performance.now() + Math.sqrt(r) * 4000; // skewed late: scouts first, crowd later
              const lingerer = Math.random() < 0.35;
              const tx = lingerer
                ? (b.x < w / 2 ? w * 0.12 + Math.random() * w * 0.2 : w * 0.68 + Math.random() * w * 0.2)
                : w * 0.2 + Math.random() * w * 0.6;
              const ty = lingerer
                ? h * 0.15 + Math.random() * h * 0.7
                : h * 0.2 + Math.random() * h * 0.6;
              b.returnTarget = { x: tx, y: ty };
              b.returnSpeed = lingerer ? 0.25 + Math.random() * 0.2 : 0.4 + Math.random() * 0.5;
              // keep exiled=true; the step loop releases each fish when its returnAt comes
            } else {
              b.exiled = false;
              b.exileTarget = null;
            }
            b.formTarget = null;
            b.formStartX = null;
            b.formStartY = null;
            b.formStartTime = null;
            b.formDuration = null;
            b.formAngle = null;
            b.formPhase = null;
            b.formWag = null;
            b.formShimmer = null;
            b.formEnergetic = false;
            b.formEnergy = 0;
            b.gather = 0;
            b.orbitAngle = null;
            b.orbitA = null;
            b.orbitB = null;
            b.orbitSpeed = null;
            b.orbitWobble = null;
            b.lastOrbitTick = null;
          }
        },
      }),
      []
    );

    /* ---------------- Main effect: setup canvas + RAF loop ---------------- */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctxMaybe = canvas.getContext('2d');
      if (!ctxMaybe) return;
      const ctx: CanvasRenderingContext2D = ctxMaybe;
      // Cap DPR at 2 — going above is visually imperceptible but multiplies pixel count (3x DPR = 9x pixels).
      // Biggest single win for mobile FPS, since fillRect/arc cost scales with canvas pixel buffer size.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onMqChange = () => { reducedMotionRef.current = mq.matches; };
      onMqChange();
      mq.addEventListener('change', onMqChange);

      const initParticles = (w: number, h: number) => {
        const main: Boid[] = [];
        for (let i = 0; i < particleCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
          const r = Math.random();
          let type: Boid['type'];
          let sizeMul: number;
          let speedMul: number;
          let brightnessMul: number;
          let colorPool: readonly string[];
          if (r < 0.03) {
            type = 'large';
            sizeMul = 1.8 + Math.random() * 0.5;
            speedMul = 0.55 + Math.random() * 0.15;
            brightnessMul = 0.78;
            colorPool = PALETTE_LARGE;
          } else if (r < 0.11) {
            type = 'scout';
            sizeMul = 0.55 + Math.random() * 0.15;
            speedMul = 1.45 + Math.random() * 0.25;
            brightnessMul = 1.1;
            colorPool = PALETTE_SCOUT;
          } else {
            type = 'regular';
            sizeMul = 0.9 + Math.random() * 0.2;
            speedMul = 0.9 + Math.random() * 0.2;
            brightnessMul = 1;
            colorPool = PALETTE;
          }
          main.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: Math.cos(a) * s * speedMul,
            vy: Math.sin(a) * s * speedMul,
            size: (1.1 + Math.random() * 2.4) * sizeMul,
            color: colorPool[Math.floor(Math.random() * colorPool.length)],
            type,
            speedMul,
            brightnessMul,
            gather: 0,
            diving: false,
            divingAge: 0,
            formTarget: null,
            formStartX: null,
            formStartY: null,
            formStartTime: null,
            formDuration: null,
            formAngle: null,
            formPhase: null,
            formWag: null,
            formShimmer: null,
            formEnergetic: false,
            formEnergy: 0,
            noGather: false,
            orbitAngle: null,
            orbitA: null,
            orbitB: null,
            orbitSpeed: null,
            orbitWobble: null,
            lastOrbitTick: null,
            exiled: false,
            exileTarget: null,
            returnAt: null,
            returnTarget: null,
            returnSpeed: null,
          });
        }
        boidsRef.current = main;

        const ambient: AmbientParticle[] = [];
        for (let i = 0; i < ambientCount; i++) {
          ambient.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.12,
            vy: 0.04 + Math.random() * 0.10,
            size: 0.3 + Math.random() * 0.5,
            color: PALETTE_SNOW[Math.floor(Math.random() * PALETTE_SNOW.length)],
            tw: 0.4 + Math.random() * 0.6,
            twSpeed: 0.005 + Math.random() * 0.01,
          });
        }
        ambientRef.current = ambient;
      };

      let canvasRect = canvas.getBoundingClientRect();

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvasRect = rect;
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sizeRef.current = { w, h };
        if (boidsRef.current.length === 0) initParticles(w, h);
      };
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const onScroll = () => { canvasRect = canvas.getBoundingClientRect(); };
      window.addEventListener('scroll', onScroll, { passive: true });

      const onMove = (e: MouseEvent) => {
        cursorRef.current.x = e.clientX - canvasRect.left;
        cursorRef.current.y = e.clientY - canvasRect.top;
        cursorRef.current.active = true;
      };
      const onLeave = () => { cursorRef.current.active = false; };
      document.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);

      const onTouch = (e: TouchEvent) => {
        if (e.touches.length === 0) return;
        const t = e.touches[0];
        cursorRef.current.x = t.clientX - canvasRect.left;
        cursorRef.current.y = t.clientY - canvasRect.top;
        cursorRef.current.active = true;
      };
      const onTouchEnd = () => { cursorRef.current.active = false; };
      document.addEventListener('touchstart', onTouch, { passive: true });
      document.addEventListener('touchmove', onTouch, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
      document.addEventListener('touchcancel', onTouchEnd, { passive: true });

      let isVisible = true;
      let isPageVisible = document.visibilityState === 'visible';
      const updateRunning = () => {
        if (isVisible && isPageVisible) start(); else stop();
      };

      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) { isVisible = entry.isIntersecting; }
          updateRunning();
        },
        { threshold: 0.01 }
      );
      io.observe(canvas);

      const onVisibility = () => {
        isPageVisible = document.visibilityState === 'visible';
        updateRunning();
      };
      document.addEventListener('visibilitychange', onVisibility);

      let lastGatherCount = -1;
      let lastFormation = -1;
      let lastDiving = -1;
      let lastNoGather = -1;

      function step(now: number) {
        const boids = boidsRef.current;
        const ambient = ambientRef.current;
        const burst = burstRef.current;
        const { w, h } = sizeRef.current;
        const cursor = cursorRef.current;
        const reduced = reducedMotionRef.current;

        /* Auto-pulse from a random edge */
        if (!reduced && now - lastPulseRef.current > AUTO_PULSE_MS) {
          lastPulseRef.current = now;
          const edge = Math.floor(Math.random() * 4);
          let px: number, py: number;
          if (edge === 0)      { px = Math.random() * w; py = -10; }
          else if (edge === 1) { px = w + 10; py = Math.random() * h; }
          else if (edge === 2) { px = Math.random() * w; py = h + 10; }
          else                 { px = -10; py = Math.random() * h; }

          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            const dx = b.x - px;
            const dy = b.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < 90000) {
              const d = Math.sqrt(d2) || 1;
              const force = (1 - d / 300) * 0.4;
              b.vx += (dx / d) * force;
              b.vy += (dy / d) * force;
            }
          }
        }

        /* Disturbance: predator wave occasionally */
        const dist = disturbanceRef.current;
        if (!reduced && dist.strength < 0.01 && Math.random() < 1 / (60 * (DISTURBANCE_MIN_MS / 1000 + Math.random() * ((DISTURBANCE_MAX_MS - DISTURBANCE_MIN_MS) / 1000)))) {
          const edge = Math.floor(Math.random() * 4);
          if (edge === 0)      { dist.x = Math.random() * w; dist.y = -20; }
          else if (edge === 1) { dist.x = w + 20; dist.y = Math.random() * h; }
          else if (edge === 2) { dist.x = Math.random() * w; dist.y = h + 20; }
          else                 { dist.x = -20; dist.y = Math.random() * h; }
          dist.strength = DISTURBANCE_STRENGTH;
        }
        if (dist.strength > 0.01) {
          for (let i = 0; i < boids.length; i++) {
            const b = boids[i];
            const ddx = b.x - dist.x;
            const ddy = b.y - dist.y;
            const dd2 = ddx * ddx + ddy * ddy;
            const radSq = DISTURBANCE_RADIUS * DISTURBANCE_RADIUS;
            if (dd2 < radSq) {
              const dd = Math.sqrt(dd2) || 1;
              const f = (1 - dd / DISTURBANCE_RADIUS) * dist.strength;
              b.vx += (ddx / dd) * f;
              b.vy += (ddy / dd) * f;
            }
          }
          dist.strength *= DISTURBANCE_DECAY;
        }

        /* Main boid loop */
        for (let i = 0; i < boids.length; i++) {
          const b = boids[i];
          if (b.diving || b.formTarget) continue;

          // Exiled fish: glide off-screen and idle there — excluded from flocking AND wrap
          // (wrap would teleport them back into frame). Each returns when its returnAt comes.
          if (b.exiled && b.exileTarget) {
            if (b.returnAt != null && now >= b.returnAt && b.returnTarget) {
              // this fish's time has come — impulse toward its return spot, then rejoin the flock
              const rdx = b.returnTarget.x - b.x, rdy = b.returnTarget.y - b.y;
              const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
              const rsp = b.returnSpeed || (0.6 + Math.random() * 0.4);
              b.vx = (rdx / rd) * rsp;
              b.vy = (rdy / rd) * rsp;
              b.exiled = false;
              b.exileTarget = null;
              b.returnAt = null;
              b.returnTarget = null;
              b.returnSpeed = null;
              // falls through to normal flocking this frame
            } else {
              // glide toward the off-screen spot, then settle (no wrap, no flocking)
              const ex = b.exileTarget.x - b.x, ey = b.exileTarget.y - b.y;
              const ed = Math.sqrt(ex * ex + ey * ey);
              if (ed > 8) {
                const sp = Math.min(MAX_SPEED * b.speedMul * 1.15, ed * 0.06);
                b.vx += ((ex / ed) * sp - b.vx) * 0.08;
                b.vy += ((ey / ed) * sp - b.vy) * 0.08;
              } else {
                b.vx *= 0.9;
                b.vy *= 0.9;
              }
              b.x += b.vx;
              b.y += b.vy;
              continue;
            }
          }

          let ax = 0, ay = 0, sx = 0, sy = 0, cx = 0, cy = 0;
          let count = 0, scount = 0;

          for (let j = 0; j < boids.length; j++) {
            if (i === j) continue;
            const o = boids[j];
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < PERCEPTION_RADIUS_SQ) {
              ax += o.vx; ay += o.vy;
              cx += o.x; cy += o.y;
              count++;
              if (d2 < SEPARATION_RADIUS_SQ) {
                const d = Math.sqrt(d2) || 1;
                sx -= dx / d;
                sy -= dy / d;
                scount++;
              }
            }
          }

          let fx = 0, fy = 0;
          if (count > 0) {
            ax /= count; ay /= count;
            const am = Math.sqrt(ax * ax + ay * ay) || 1;
            fx += ((ax / am) * MAX_SPEED - b.vx) * 0.06;
            fy += ((ay / am) * MAX_SPEED - b.vy) * 0.06;

            cx = cx / count - b.x;
            cy = cy / count - b.y;
            const cm = Math.sqrt(cx * cx + cy * cy) || 1;
            fx += ((cx / cm) * MAX_SPEED - b.vx) * 0.02;
            fy += ((cy / cm) * MAX_SPEED - b.vy) * 0.02;
          }
          if (scount > 0) {
            sx /= scount; sy /= scount;
            const sm = Math.sqrt(sx * sx + sy * sy) || 1;
            fx += ((sx / sm) * MAX_SPEED - b.vx) * 0.10;
            fy += ((sy / sm) * MAX_SPEED - b.vy) * 0.10;
          }

          if (reactToCursor && cursor.active && !reduced && !searchBarRectRef.current && !b.noGather) {
            const dx = cursor.x - b.x;
            const dy = cursor.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < CURSOR_RADIUS_SQ) {
              const d = Math.sqrt(d2) || 1;
              const radialForce = (1 - d / CURSOR_RADIUS) * CURSOR_FORCE;
              fx += (dx / d) * radialForce;
              fy += (dy / d) * radialForce;
              fx += (-dy / d) * CURSOR_FORCE * 0.5;
              fy += (dx / d) * CURSOR_FORCE * 0.5;
            }
          }

          // Search-bar repulsion
          const sbRect = searchBarRectRef.current;
          if (sbRect) {
            const sbCx = sbRect.left + sbRect.width / 2;
            const sbCy = sbRect.top + sbRect.height / 2;
            const sbHalfW = sbRect.width / 2 + SB_MARGIN;
            const sbHalfH = sbRect.height / 2 + SB_MARGIN;
            const sbDx = b.x - sbCx;
            const sbDy = b.y - sbCy;
            if (Math.abs(sbDx) < sbHalfW && Math.abs(sbDy) < sbHalfH) {
              const overlapX = sbHalfW - Math.abs(sbDx);
              const overlapY = sbHalfH - Math.abs(sbDy);
              const depth = Math.min(overlapX, overlapY);
              const len = Math.sqrt(sbDx * sbDx + sbDy * sbDy) || 0.01;
              const repulse = (depth / SB_MARGIN) * SB_REPULSE_STRENGTH;
              fx += (sbDx / len) * repulse;
              fy += (sbDy / len) * repulse;
            }
          }

          if (reduced) { fx *= 0.2; fy *= 0.2; }

          b.vx += fx;
          b.vy += fy;

          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const targetMax = MAX_SPEED * b.speedMul;
          const targetMin = MIN_SPEED * b.speedMul;
          if (speed > targetMax) { b.vx = (b.vx / speed) * targetMax; b.vy = (b.vy / speed) * targetMax; }
          else if (speed < targetMin && speed > 0) { b.vx = (b.vx / speed) * targetMin; b.vy = (b.vy / speed) * targetMin; }

          b.x += b.vx;
          b.y += b.vy;

          // Wrap edges
          if (b.x < -SEPARATION_RADIUS) b.x = w + SEPARATION_RADIUS;
          else if (b.x > w + SEPARATION_RADIUS) b.x = -SEPARATION_RADIUS;
          if (b.y < -SEPARATION_RADIUS) b.y = h + SEPARATION_RADIUS;
          else if (b.y > h + SEPARATION_RADIUS) b.y = -SEPARATION_RADIUS;
        }

        /* Ambient marine snow drift */
        for (let i = 0; i < ambient.length; i++) {
          const a = ambient[i];
          a.x += a.vx;
          a.y += a.vy;
          a.tw += a.twSpeed;
          if (a.tw > 1 || a.tw < 0.2) a.twSpeed = -a.twSpeed;
          if (a.y > h + 10) { a.y = -10; a.x = Math.random() * w; }
          if (a.x < -10) a.x = w + 10;
          else if (a.x > w + 10) a.x = -10;
        }

        /* Burst particles */
        for (let i = burst.length - 1; i >= 0; i--) {
          const p = burst[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.life -= 0.025;
          if (p.life <= 0) burst.splice(i, 1);
        }

        /* Gather / diving / formation pass */
        const cursorActive = cursor.active && !reduced && !searchBarRectRef.current;
        let gatherCount = 0;
        let formationCount = 0;
        let divingCount = 0;
        let noGatherCount = 0;

        for (let i = 0; i < boids.length; i++) {
          const b = boids[i];

          if (b.noGather) noGatherCount++;

          if (b.diving) {
            divingCount++;
            b.divingAge += 1;
            if (b.divingAge > 0) {
              b.vy = Math.min(2.4, b.vy + 0.045);
              b.vx *= 0.965;
              b.x += b.vx;
              b.y += b.vy;
            }
            if (b.diveDeath != null && b.divingAge > b.diveDeath) {
              const edge = Math.floor(Math.random() * 4);
              if (edge === 0)      { b.x = Math.random() * w; b.y = -10; }
              else if (edge === 1) { b.x = w + 10; b.y = Math.random() * h; }
              else if (edge === 2) { b.x = Math.random() * w; b.y = h + 10; }
              else                 { b.x = -10; b.y = Math.random() * h; }
              const a = Math.random() * Math.PI * 2;
              const sp = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
              b.vx = Math.cos(a) * sp * b.speedMul;
              b.vy = Math.sin(a) * sp * b.speedMul;
              b.diving = false;
              b.divingAge = 0;
              b.gather = 0;
            }
            continue;
          }

          if (b.formTarget && b.formStartTime != null && b.formStartX != null && b.formStartY != null && b.formDuration != null) {
            formationCount++;
            const elapsed = now - b.formStartTime;
            const t = Math.min(1, elapsed / b.formDuration);
            const eased = 1 - Math.pow(1 - t, 3);
            const sbR = searchBarRectRef.current;
            const arrivedFor = Math.max(0, elapsed - b.formDuration) / 1000;
            const aliveAmp = Math.min(1, arrivedFor / 0.6);
            const formStartX = b.formStartX;
            const formStartY = b.formStartY;
            if (
              sbR &&
              b.orbitAngle != null && b.orbitSpeed != null &&
              b.orbitA != null && b.orbitB != null && b.orbitWobble != null
            ) {
              // Seamless entry: the orbit angle advances from the very first frame, so the
              // approach targets a MOVING point on the orbit — arrival blends into circling
              // with no freeze at the seam.
              const orbitSpeed = b.orbitSpeed;
              const orbitA = b.orbitA;
              const orbitB = b.orbitB;
              const orbitWobble = b.orbitWobble;
              const ocx = sbR.left + sbR.width / 2;
              const ocy = sbR.top + sbR.height / 2 + 14; // same nudge as formSearchBar
              b.orbitAngle += orbitSpeed * Math.min(50, now - (b.lastOrbitTick ?? now));
              b.lastOrbitTick = now;
              const breathe = 1 + Math.sin(now * 0.0007 + orbitWobble) * 0.06;
              const phase = b.formPhase ?? 0;
              const ox = ocx + Math.cos(b.orbitAngle) * orbitA * breathe + Math.sin(now * 0.0011 + phase) * 1.2 * aliveAmp;
              const oy = ocy + Math.sin(b.orbitAngle) * orbitB * breathe + Math.cos(now * 0.0009 + phase * 1.4) * 0.9 * aliveAmp;
              if (t < 1) {
                // approach: glide toward the current (moving) orbit position
                b.x = formStartX + (ox - formStartX) * eased;
                b.y = formStartY + (oy - formStartY) * eased;
                b.formAngle = Math.atan2(oy - b.y, ox - b.x); // face where we're heading
              } else {
                b.x = ox;
                b.y = oy;
                // face along the orbit tangent (direction of travel)
                const dir = orbitSpeed >= 0 ? 1 : -1;
                b.formAngle = Math.atan2(
                  Math.cos(b.orbitAngle) * orbitB * dir,
                  -Math.sin(b.orbitAngle) * orbitA * dir,
                );
              }
            } else {
              // fallback: static target (no orbit data)
              b.x = formStartX + (b.formTarget.x - formStartX) * eased;
              b.y = formStartY + (b.formTarget.y - formStartY) * eased;
            }
            if (b.formPhase != null) {
              b.formWag = Math.sin(now * 0.007 + b.formPhase * 2) * 0.10 * aliveAmp;
              b.formShimmer = 1 + Math.sin(now * 0.002 + b.formPhase * 1.7) * 0.12 * aliveAmp;
            }
            if (b.formEnergetic) {
              const energyT = Math.min(1, elapsed / FORM_ENERGY_DURATION_MS);
              b.formEnergy = Math.pow(1 - energyT, 2);
            }
            b.vx = 0;
            b.vy = 0;
            b.gather = 0;
            continue;
          }

          if (cursorActive) {
            const dx = b.x - cursor.x;
            const dy = b.y - cursor.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < GATHER_RADIUS_SQ) {
              if (!b.noGather) b.gather = Math.min(1, b.gather + 0.022);
            } else {
              b.gather = Math.max(0, b.gather - 0.012);
            }
          } else if (!searchBarRectRef.current) {
            b.gather = Math.max(0, b.gather - 0.018);
          }

          if (b.gather > 0.5) gatherCount++;
        }

        /* Notify parent */
        if (gatherCount !== lastGatherCount) {
          lastGatherCount = gatherCount;
          onGatherChange?.(gatherCount);
        }
        if (
          onCountsChange &&
          (formationCount !== lastFormation || divingCount !== lastDiving || noGatherCount !== lastNoGather)
        ) {
          lastFormation = formationCount;
          lastDiving = divingCount;
          lastNoGather = noGatherCount;
          onCountsChange({ formation: formationCount, diving: divingCount, noGather: noGatherCount });
        }

        /* Bubble spawn + update */
        const bubbles = bubblesRef.current;
        if (!reduced && now - lastBubbleSpawnRef.current > BUBBLE_SPAWN_MIN_MS + Math.random() * BUBBLE_SPAWN_JITTER_MS) {
          lastBubbleSpawnRef.current = now;
          bubbles.push({
            x: Math.random() * w,
            y: h + 10,
            vy: -0.5 - Math.random() * 0.6,
            vx: (Math.random() - 0.5) * 0.18,
            radius: 1.6 + Math.random() * 2.4,
            wobblePhase: Math.random() * Math.PI * 2,
          });
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const bu = bubbles[i];
          bu.y += bu.vy;
          bu.x += bu.vx + Math.sin(now * 0.002 + bu.wobblePhase) * 0.15;
          if (bu.y < -12) bubbles.splice(i, 1);
        }
      }

      function draw() {
        const { w, h } = sizeRef.current;
        const boids = boidsRef.current;
        const ambient = ambientRef.current;
        const burst = burstRef.current;

        ctx.globalCompositeOperation = 'source-over';
        // Stronger fade while fish orbit the search bar — otherwise 55 trails piling up along
        // one ellipse accumulate into a dark smoky halo around the bar.
        ctx.fillStyle = searchBarRectRef.current ? 'rgba(3, 22, 32, 0.45)' : TRAIL_FADE;
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';

        /* Marine snow */
        for (let i = 0; i < ambient.length; i++) {
          const a = ambient[i];
          ctx.fillStyle = withAlpha(a.color, a.tw * 0.24);
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
          ctx.fill();
        }

        /* Burst particles */
        for (let i = 0; i < burst.length; i++) {
          const p = burst[i];
          ctx.fillStyle = withAlpha(p.color, p.life * 0.32);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = withAlpha(p.color, p.life);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        /* Boids */
        for (let i = 0; i < boids.length; i++) {
          const b = boids[i];
          const angle = b.formAngle != null ? b.formAngle + (b.formWag || 0) : Math.atan2(b.vy, b.vx);
          const s = b.size;
          const gatherBoost = 1 + b.gather * 0.35;
          const diveAlpha = b.diving && b.diveDeath != null
            ? Math.max(0, 1 - Math.max(0, b.divingAge) / b.diveDeath)
            : 1;
          const formAlpha = b.formTarget ? 0.55 : 1;
          const shimmer = b.formTarget ? (b.formShimmer || 1) : 1;
          const finalAlpha = 0.7 * b.brightnessMul * gatherBoost * diveAlpha * formAlpha * shimmer;

          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(angle);
          ctx.fillStyle = withAlpha(b.color, finalAlpha);

          // body
          ctx.beginPath();
          ctx.ellipse(s * 0.2, 0, s * 1.8, s * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();

          // forked tail
          ctx.beginPath();
          ctx.moveTo(-s * 1.5, 0);
          ctx.lineTo(-s * 3.0, s * 1.15);
          ctx.lineTo(-s * 2.3, 0);
          ctx.lineTo(-s * 3.0, -s * 1.15);
          ctx.closePath();
          ctx.fill();

          // dorsal fin (large fish only)
          if (b.type === 'large') {
            ctx.beginPath();
            ctx.moveTo(-s * 0.3, -s * 0.55);
            ctx.lineTo(s * 0.2, -s * 1.5);
            ctx.lineTo(s * 0.7, -s * 0.5);
            ctx.closePath();
            ctx.fill();
          }

          // coral energy overlay — fades over FORM_ENERGY_DURATION_MS
          if (b.formEnergy > 0.01) {
            ctx.fillStyle = `rgba(255, 139, 110, ${b.formEnergy * 0.75})`;
            ctx.beginPath();
            ctx.ellipse(s * 0.2, 0, s * 1.8, s * 0.75, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-s * 1.5, 0);
            ctx.lineTo(-s * 3.0, s * 1.15);
            ctx.lineTo(-s * 2.3, 0);
            ctx.lineTo(-s * 3.0, -s * 1.15);
            ctx.closePath();
            ctx.fill();
            if (b.type === 'large') {
              ctx.beginPath();
              ctx.moveTo(-s * 0.3, -s * 0.55);
              ctx.lineTo(s * 0.2, -s * 1.5);
              ctx.lineTo(s * 0.7, -s * 0.5);
              ctx.closePath();
              ctx.fill();
            }
          }

          ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';

        /* Bubbles — translucent glass spheres */
        const bubbles = bubblesRef.current;
        for (let i = 0; i < bubbles.length; i++) {
          const bu = bubbles[i];
          const lifeY = (h - bu.y) / (h * 0.85);
          let alpha: number;
          if (lifeY < 0.12) alpha = lifeY / 0.12;
          else if (lifeY > 0.85) alpha = (1 - lifeY) / 0.15;
          else alpha = 1;
          if (alpha <= 0) continue;
          alpha = Math.max(0, Math.min(1, alpha));

          ctx.save();
          ctx.globalAlpha = alpha;
          // tint
          ctx.fillStyle = 'rgba(140, 210, 225, 0.13)';
          ctx.beginPath();
          ctx.arc(bu.x, bu.y, bu.radius, 0, Math.PI * 2);
          ctx.fill();
          // rim
          ctx.strokeStyle = 'rgba(225, 245, 252, 0.5)';
          ctx.lineWidth = bu.radius * 0.22;
          ctx.beginPath();
          ctx.arc(bu.x, bu.y, bu.radius * 0.93, 0, Math.PI * 2);
          ctx.stroke();
          // top-left highlight
          ctx.fillStyle = 'rgba(220, 245, 252, 0.55)';
          ctx.beginPath();
          ctx.arc(bu.x - bu.radius * 0.3, bu.y - bu.radius * 0.32, bu.radius * 0.32, 0, Math.PI * 2);
          ctx.fill();
          // bottom-right caustic
          ctx.fillStyle = 'rgba(180, 225, 240, 0.32)';
          ctx.beginPath();
          ctx.arc(bu.x + bu.radius * 0.28, bu.y + bu.radius * 0.32, bu.radius * 0.20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      function frame(now: number) {
        if (!runningRef.current) return;
        step(now);
        draw();
        rafRef.current = requestAnimationFrame(frame);
      }
      function start() {
        if (runningRef.current) return;
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(frame);
      }
      function stop() {
        runningRef.current = false;
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      start();

      return () => {
        stop();
        ro.disconnect();
        io.disconnect();
        mq.removeEventListener('change', onMqChange);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseleave', onLeave);
        document.removeEventListener('touchstart', onTouch);
        document.removeEventListener('touchmove', onTouch);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('scroll', onScroll);
      };
    }, [particleCount, ambientCount, reactToCursor, onGatherChange, onCountsChange]);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    );
  }
);
