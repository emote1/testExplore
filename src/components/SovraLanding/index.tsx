import { useState, useEffect } from 'react';

// Your existing hero (formerly HomeLanding.tsx, kept as a sibling here renamed to HeroLanding).
// If you keep your current HomeLanding.tsx as the hero section, import it from there instead.
import HeroLanding from './HeroLanding';
import DataSection from './DataSection';
import LiveBadge from '../SovraWaterfall/LiveBadge';
import MooringAnchor from './MooringAnchor';

import './sovra-animations.css';

interface SovraLandingProps {
  debug?: boolean;
  onSearch?: (value: string) => void;
}

/**
 * Top-level page composition:
 *  - Sticky hero (flock + search + SOVRA title) that pins to viewport top
 *    and fades out as the user scrolls down
 *  - DataSection below: 3 metric cards + ICP whale inflow tracker
 *
 * Search-bar submission is currently a stub inside HeroLanding/ParticleSearchBar.
 * Wire up to your existing search→wallet flow in App.tsx (see README).
 */
export default function SovraLanding({ debug = false, onSearch }: SovraLandingProps) {
  const [scroll, setScroll] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = window.innerHeight || 1;
        setScroll(Math.min(1, window.scrollY / h));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hero fades to 0 by ~70% of one viewport scrolled
  const heroOpacity = Math.max(0, 1 - scroll * 1.4);
  const heroPointer: 'none' | 'auto' = scroll > 0.6 ? 'none' : 'auto';

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      backgroundColor: '#02151D',
      color: '#E8F1F3',
    }}>
      {/* Fixed underwater gradient layer — iOS-safe alternative to background-attachment: fixed */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, #0A3A4A 0%, #062B38 22%, #04212C 50%, #02151D 80%, #010A10 100%)',
        }}
      />

      {/* indexer health — quiet sonar chip pinned to the corner */}
      <LiveBadge style={{ position: 'fixed', top: 14, right: 14, zIndex: 40 }} />

      {/* wallet mooring — the anchor resting at the bottom of the water */}
      {onSearch && <MooringAnchor onDive={onSearch} />}

      {/* Pinned hero — sticky stays glued to top while user scrolls past */}
      <div style={{
        position: 'sticky', top: 0, height: '100vh',
        opacity: heroOpacity,
        pointerEvents: heroPointer,
        zIndex: 1,
        transition: 'opacity 0.05s linear',
      }}>
        <HeroLanding debug={debug} onSearch={onSearch} />
      </div>

      <DataSection onSearch={onSearch} />
    </div>
  );
}
