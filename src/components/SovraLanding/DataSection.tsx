import SectionHeader from './shared/SectionHeader';
import MetricsGrid from './metrics/MetricsGrid';
import IcpInflowCard from './icp/IcpInflowCard';

interface DataSectionProps {
  /** Threaded down to the inflow card so tapping a wallet row opens its page. */
  onSearch?: (value: string) => void;
}

export default function DataSection({ onSearch }: DataSectionProps) {
  return (
    <>
      {/* SECTION 1: 3 metric cards (Active Wallets · Total Staked · Blocks/min) */}
      <section style={{
        position: 'relative', zIndex: 2,
        padding: '48px 24px 32px',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <SectionHeader label="the depths · scan" title="network at a glance" />
        <MetricsGrid />
      </section>

      {/* SECTION 2: ICP whale inflow */}
      <section style={{
        position: 'relative', zIndex: 2,
        padding: '60px 24px 32px',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <SectionHeader label="the trenches · ICP" title="whale inflow tracker" />
        <IcpInflowCard onSearch={onSearch} />

        <p style={{
          marginTop: 48, marginBottom: 80, textAlign: 'center',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'rgba(168, 223, 229, 0.4)',
        }}>
          scroll up to surface
        </p>
      </section>
    </>
  );
}
