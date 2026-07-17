import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';

import { FlockBackground } from './FlockBackground';
import { HeroTitle } from './HeroTitle';
import { ParticleSearchBar } from './ParticleSearchBar';
import { DebugHud } from './DebugHud';
import { useFps } from './useFps';
import { GATHER_THRESHOLD } from './constants';
import type { FlockBackgroundHandle } from './types';
import { isValidAddress } from '@/utils/address-helpers';

/** Shown under the search bar when the typed query is not a valid wallet address. */
const INVALID_ADDRESS_MSG = 'Enter a valid EVM (0x…) or Reef (5…) address';

interface Props {
  /** When true, render a top-right HUD with FPS and entity counts. Use ?debug=1 in URL to enable. */
  debug?: boolean;
  /** Called when the user submits the search bar with a non-empty query. */
  onSearch?: (value: string) => void;
}

interface EntityCounts {
  formation: number;
  diving: number;
  noGather: number;
}

/**
 * SOVRA landing page.
 *  - Flock canvas as background (interactive).
 *  - HeroTitle (SOVRA / dive. decode. decide.) layered on top.
 *  - ParticleSearchBar that summons the flock to form a pill outline.
 *  - Press any printable key or click — search bar appears; Esc to dismiss.
 *  - When 40+ fish are gathered around the cursor, click triggers a "energetic" summon (coral glow).
 */
export default function HeroLanding({ debug = false, onSearch }: Props) {
  const flockRef = useRef<FlockBackgroundHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarWrapperRef = useRef<HTMLDivElement | null>(null);
  const gatherCountRef = useRef(0);
  const scatteredRef = useRef(false);
  const summonEnergeticRef = useRef(false);

  const [query, setQuery] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [gatherCount, setGatherCount] = useState(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [counts, setCounts] = useState<EntityCounts>({ formation: 0, diving: 0, noGather: 0 });

  // Device adaptation: smaller flock on narrow screens, touch-aware hint
  const isMobile =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const isTouch =
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
  const particleCount = isMobile ? 80 : 140;
  const ambientCount = isMobile ? 25 : 50;

  // FPS measurement only when debug HUD is on
  const fps = useFps(debug ? 500 : 0);

  /* Sync ref so handlers can read latest gather count without re-rendering */
  useEffect(() => { gatherCountRef.current = gatherCount; }, [gatherCount]);

  /* Pointer tracking — for cursor counter + activation position. Handles mouse and touch. */
  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      setMousePos({ x: t.clientX, y: t.clientY });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
    };
  }, []);

  /* Flock formation / release based on searchMode */
  useLayoutEffect(() => {
    if (!searchMode) {
      flockRef.current?.releaseFromFormation();
      scatteredRef.current = false;
      summonEnergeticRef.current = false;
      return;
    }
    const measure = () => {
      const el = searchBarWrapperRef.current;
      if (!el || !flockRef.current) return;
      const rect = el.getBoundingClientRect();
      flockRef.current.formSearchBar(
        { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        summonEnergeticRef.current
      );
    };
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [searchMode]);

  /* Global keyboard:
   *   - In hero mode: any printable key → enter search and seed input with it.
   *   - In search mode: Esc → leave, fish-formation released; if there were gathered fish, they dive.
   *   - In hero mode: Esc with gathered fish → dive them. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchMode) {
          setSearchMode(false);
          setQuery('');
          inputRef.current?.blur();
          if (gatherCountRef.current > 0) flockRef.current?.triggerDive();
        } else if (gatherCountRef.current > 0) {
          flockRef.current?.triggerDive();
        }
        return;
      }
      if (searchMode) return;
      // ignore modifier-only keys and keys typed while focused on inputs (defensive)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      setSearchMode(true);
      setQuery(e.key);
      setTimeout(() => inputRef.current?.focus(), 60);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchMode]);

  /* Clear the validation hint whenever the search bar is dismissed. */
  useEffect(() => {
    if (!searchMode) setInvalid(false);
  }, [searchMode]);

  /* Handlers */
  const handleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Block invalid wallet addresses at submit — don't navigate, surface a hint instead.
    if (!isValidAddress(trimmed)) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setInvalid(false);
    flockRef.current?.activate();
    onSearch?.(trimmed);
  }, [query, onSearch]);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    setInvalid(false);
    if (!scatteredRef.current && next.length > 0) {
      scatteredRef.current = true;
      flockRef.current?.scatterGathered();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  const handleHeroClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as Element;
      if (searchMode) {
        // Tap/click outside the search bar dismisses search (Esc analogue for touch devices)
        if (searchBarWrapperRef.current?.contains(target)) return;
        setSearchMode(false);
        setQuery('');
        inputRef.current?.blur();
        if (gatherCountRef.current > 0) flockRef.current?.triggerDive();
        return;
      }
      if (target.closest && target.closest('button')) return;
      if (gatherCountRef.current >= GATHER_THRESHOLD && mousePos) {
        flockRef.current?.activate({ x: mousePos.x, y: mousePos.y });
        summonEnergeticRef.current = true;
      }
      setSearchMode(true);
      setTimeout(() => inputRef.current?.focus(), 60);
    },
    [searchMode, mousePos]
  );

  /* Cursor counter — only when gathering and not in search */
  const showCursorCounter = !searchMode && gatherCount > 0 && mousePos !== null;
  const isReady = gatherCount >= GATHER_THRESHOLD;

  return (
    <div
      onClick={handleHeroClick}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        cursor: searchMode ? 'default' : 'crosshair',
      }}
    >
      {/* Background canvas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      >
        <FlockBackground
          ref={flockRef}
          particleCount={particleCount}
          ambientCount={ambientCount}
          reactToCursor
          onGatherChange={setGatherCount}
          onCountsChange={debug ? setCounts : undefined}
        />
      </div>

      {/* Godrays + caustics (optional decorative layers omitted in production extract — add as needed) */}

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 720, width: '100%', textAlign: 'center' }}>
          <div
            style={{
              opacity: searchMode ? 0.3 : 1,
              transition: 'opacity 0.7s ease',
              pointerEvents: searchMode ? 'none' : 'auto',
            }}
          >
            <HeroTitle />
          </div>

          <div
            style={{
              marginTop: 56,
              minHeight: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
            }}
          >
            {searchMode ? (
              <>
                <ParticleSearchBar
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  onSubmit={handleSearch}
                  inputRef={inputRef}
                  wrapperRef={searchBarWrapperRef}
                  invalid={invalid}
                />
                {invalid && (
                  <div
                    role="alert"
                    style={{
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      color: '#FF8B6E',
                    }}
                  >
                    {INVALID_ADDRESS_MSG}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(168, 223, 229, 0.55)',
                    opacity: invalid ? 0.4 : 1,
                    transition: 'opacity 0.25s ease',
                  }}
                >
                  <kbd
                    style={{
                      padding: '2px 8px',
                      border: '1px solid rgba(255, 139, 110, 0.5)',
                      borderRadius: 4,
                      color: '#FF8B6E',
                      fontWeight: 600,
                    }}
                  >
                    ENTER
                  </kbd>
                  <span style={{ margin: '0 8px' }}>to dive</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <kbd
                    style={{
                      margin: '0 8px 0 8px',
                      padding: '2px 8px',
                      border: '1px solid rgba(168, 223, 229, 0.3)',
                      borderRadius: 4,
                    }}
                  >
                    {isTouch ? 'TAP OUT' : 'ESC'}
                  </kbd>
                  <span>to surface</span>
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'rgba(168, 223, 229, 0.45)',
                  animation: 'hintBreath 4.5s ease-in-out infinite',
                }}
              >
                type anywhere to summon the search
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cursor counter — floats near the mouse while gathering */}
      {showCursorCounter && mousePos && (
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 18,
            top: mousePos.y + 18,
            zIndex: 51,
            pointerEvents: 'none',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: isReady ? '#FF8B6E' : 'rgba(168, 223, 229, 0.7)',
            background: 'rgba(2, 21, 30, 0.55)',
            padding: '4px 10px',
            borderRadius: 999,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: isReady
              ? '1px solid rgba(255, 139, 110, 0.5)'
              : '1px solid rgba(168, 223, 229, 0.15)',
            transition: 'border-color 0.3s ease, color 0.3s ease',
          }}
        >
          +{gatherCount} fish{isReady ? ' · click to summon' : ''}
        </div>
      )}

      {/* Dev HUD */}
      {debug && (
        <DebugHud fps={fps} total={particleCount} counts={counts} gather={gatherCount} />
      )}

      <style>{`
        @keyframes hintBreath {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
