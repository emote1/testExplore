interface SectionHeaderProps {
  label: string;
  title: string;
  accentColor?: string;
}

export default function SectionHeader({
  label,
  title,
  accentColor = '#FF8B6E',
}: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 28, textAlign: 'center' }}>
      <p style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase',
        color: accentColor, margin: '0 0 10px',
      }}>{label}</p>
      <h2 style={{
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 500,
        letterSpacing: '0.04em', margin: 0,
        color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text',
        backgroundImage: 'linear-gradient(180deg, #D5EEF1 0%, #5BC0D9 100%)',
      }}>{title}</h2>
    </div>
  );
}
