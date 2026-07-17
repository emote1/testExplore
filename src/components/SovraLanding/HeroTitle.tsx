import { COLORS } from './constants';

/**
 * SOVRA wordmark with an outline-O (SVG ring) and the colored tagline below.
 * Pure presentational — no flock interaction.
 */
export function HeroTitle() {
  return (
    <div style={{ textAlign: 'center', userSelect: 'none' }}>
      <h1 className="hero-brand" aria-label="SOVRA">
        <span aria-hidden="true">S</span>
        <svg className="ring-o" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.brandGradientTop} />
              <stop offset="100%" stopColor={COLORS.brandGradientBottom} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" fill="none" stroke="url(#ringGrad)" strokeWidth="12" />
        </svg>
        <span aria-hidden="true">VRA</span>
      </h1>
      <p className="hero-tagline">
        <span className="tag-word tag-dive">dive.</span>
        <span style={{ display: 'inline-block', width: '0.5em' }} />
        <span className="tag-word tag-decode">decode.</span>
        <span style={{ display: 'inline-block', width: '0.5em' }} />
        <span className="tag-word tag-decide">decide.</span>
      </p>
      <style>{`
        .hero-brand {
          font-family: "Bricolage Grotesque", system-ui, sans-serif;
          font-size: clamp(34px, 4.8vw, 54px);
          font-weight: 500;
          letter-spacing: 0.10em;
          line-height: 1;
          margin: 0;
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          background-image: linear-gradient(180deg, ${COLORS.brandGradientTop} 0%, ${COLORS.brandGradientBottom} 100%);
        }
        .ring-o {
          display: inline-block;
          width: 0.72em;
          height: 0.72em;
          vertical-align: -0.06em;
          margin: 0 0.04em;
          overflow: visible;
        }
        .hero-tagline {
          font-family: "JetBrains Mono", ui-monospace, monospace;
          font-size: clamp(11px, 1vw, 13px);
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: lowercase;
          margin: 20px 0 0 0;
          opacity: 0.9;
        }
        .tag-word   { display: inline-block; }
        .tag-dive   { color: ${COLORS.tagDive}; }
        .tag-decode { color: ${COLORS.tagDecode}; }
        .tag-decide { color: ${COLORS.tagDecide}; }
      `}</style>
    </div>
  );
}
