import { C } from './constants';

/** Thin divider line with a centered uppercase label (inflow / outflow). */
export default function FlowDivider({ label, color }: { label: string; color: string }) {
  const rgb = color === C.teal ? [125, 211, 218] : [255, 139, 110];
  const rgbStr = `${rgb[0]},${rgb[1]},${rgb[2]}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 4px', margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, rgba(${rgbStr},0.35))` }} />
      <span style={{
        fontFamily: '"JetBrains Mono",monospace', fontSize: 9, letterSpacing: '0.28em',
        textTransform: 'uppercase', color, fontWeight: 600, opacity: 0.85, flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(${rgbStr},0.35), transparent)` }} />
    </div>
  );
}
