
interface BarSparklineProps {
  series: number[];
  width?: number;
  height?: number;
  color?: string;
  gap?: number;
  className?: string;
}

export function BarSparkline({
  series,
  width = 80,
  height = 40,
  color = '#3b82f6',
  gap = 1,
  className,
}: BarSparklineProps) {
  const n = series.length;
  if (n === 0) return null;

  const max = Math.max(...series, 1);
  const barWidth = Math.max(2, (width - gap * (n - 1)) / n);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width, height }}
      preserveAspectRatio="none"
    >
      {series.map((val, i) => {
        const barHeight = (val / max) * (height - 4);
        const x = i * (barWidth + gap);
        const y = height - barHeight - 2;
        const opacity = 0.4 + (i / n) * 0.6; // fade in effect
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={opacity}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
