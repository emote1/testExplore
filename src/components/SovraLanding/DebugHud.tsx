interface Counts {
  formation: number;
  diving: number;
  noGather: number;
}

interface Props {
  fps: number;
  total: number;
  counts: Counts;
  gather: number;
}

/**
 * Dev-only HUD. Top-right fixed overlay.
 * Color-codes FPS: green (>=55), amber (40-55), red (<40).
 */
export function DebugHud({ fps, total, counts, gather }: Props) {
  const fpsColor = fps >= 55 ? '#7DD3DA' : fps >= 40 ? '#FFC8B8' : '#FF6B5A';
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 100,
        padding: '8px 12px',
        background: 'rgba(2, 21, 30, 0.78)',
        border: '1px solid rgba(91, 192, 217, 0.25)',
        borderRadius: 8,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        color: '#E8F1F3',
        pointerEvents: 'none',
        userSelect: 'none',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div>
        <span style={{ opacity: 0.55 }}>fps </span>
        <span style={{ color: fpsColor, fontWeight: 600 }}>{fps}</span>
      </div>
      <div>
        <span style={{ opacity: 0.55 }}>fish </span>
        <span>{total}</span>
        <span style={{ opacity: 0.4 }}> · </span>
        <span style={{ opacity: 0.55 }}>form </span>
        <span>{counts.formation}</span>
        <span style={{ opacity: 0.4 }}> · </span>
        <span style={{ opacity: 0.55 }}>dive </span>
        <span>{counts.diving}</span>
      </div>
      <div>
        <span style={{ opacity: 0.55 }}>noGather </span>
        <span>{counts.noGather}</span>
        <span style={{ opacity: 0.4 }}> · </span>
        <span style={{ opacity: 0.55 }}>gather </span>
        <span>{gather}</span>
      </div>
    </div>
  );
}
