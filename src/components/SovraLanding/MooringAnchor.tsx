import { useEffect, useState } from 'react';
import { useWalletMooring } from '@/hooks/use-wallet-mooring';
import MooringSheet from '../SovraWaterfall/MooringSheet';

const MONO = '"JetBrains Mono",monospace';
const TEAL = '#7DD3DA';

function shortAddr(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 5)}…${a.slice(-4)}`;
}

/**
 * The anchor — the landing's quiet wallet-connect entry point, resting at the
 * bottom center. One tap moors the wallet and dives straight into its pool:
 *  - not moored, extension with ONE account  -> connect, ripple, dive
 *  - several accounts                        -> tide sheet to pick
 *  - nothing to connect with                 -> tide sheet explains
 *  - already moored (localStorage)           -> chip "dive back in", no dialogs
 */
export default function MooringAnchor({ onDive }: { onDive: (address: string) => void }) {
  const m = useWalletMooring();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rippling, setRippling] = useState(false);

  // Opening the sheet re-shares the extension accounts for the picker —
  // silent, since a moored extension identity means permission is granted.
  const { mooredSource, accounts, extensionAvailable, moor } = m;
  useEffect(() => {
    if (!sheetOpen) return;
    if (mooredSource === 'extension' && accounts.length === 0 && extensionAvailable) {
      void moor();
    }
  }, [sheetOpen, mooredSource, accounts.length, extensionAvailable, moor]);

  const dive = (address: string) => {
    setSheetOpen(false);
    setRippling(true);
    // let the rings spread, then hand over to the app's dive transition
    window.setTimeout(() => onDive(address), 640);
  };

  const onTap = async () => {
    if (m.isConnecting || rippling) return;
    // the water remembers you — viewing needs no permission, just dive
    if (m.mooredAddress) { dive(m.mooredAddress); return; }
    if (m.extensionAvailable) {
      const res = await m.moor();
      if (res.address) dive(res.address);
      else setSheetOpen(true); // pick one of several, or see the error
      return;
    }
    if (m.isMobile && m.wcReady) {
      const addr = await m.moorWalletConnect();
      if (addr) dive(addr); else setSheetOpen(true);
      return;
    }
    setSheetOpen(true); // nothing injected — explain the ways in
  };

  const moored = m.mooredAddress;

  return (
    <>
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', justifyContent: 'center',
        zIndex: 40, pointerEvents: 'none',
      }}>
        <div
          className={m.isConnecting ? 'svl-anchor-pulse' : (moored ? undefined : 'svl-anchor-bob')}
          style={{
            position: 'relative', pointerEvents: 'auto',
            background: moored ? 'rgba(2,21,30,0.55)' : 'transparent',
            border: moored ? '1px solid rgba(91,192,217,0.25)' : 'none',
            borderRadius: 999,
            display: 'inline-flex', alignItems: 'stretch',
            backdropFilter: moored ? 'blur(4px)' : undefined,
          }}
        >
          {rippling && (
            <>
              <span className="svl-moor-ring" style={{ border: `2px solid ${TEAL}`, boxShadow: `0 0 18px ${TEAL}` }} />
              <span className="svl-moor-ring" style={{ border: '1.5px solid rgba(168,223,229,0.8)', animationDelay: '0.12s' }} />
              <span className="svl-moor-ring" style={{ border: '1px solid rgba(168,223,229,0.5)', animationDelay: '0.22s' }} />
            </>
          )}
          <button
            onClick={onTap}
            aria-label={moored ? 'dive back into your wallet' : 'moor your wallet'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: moored ? '8px 10px 8px 14px' : '10px 14px',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {moored ? (
              <>
                <span style={{ fontFamily: '"Hiragino Sans","Yu Gothic","Noto Sans CJK JP",sans-serif', fontSize: 12, color: TEAL }}>水</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(232,241,243,0.92)' }}>{shortAddr(moored)}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: 'rgba(168,223,229,0.6)' }}>
                  · dive back in
                </span>
              </>
            ) : (
              <span style={{
                fontSize: 20, lineHeight: 1,
                color: 'rgba(168,223,229,0.45)',
                textShadow: '0 0 12px rgba(125,211,218,0.35)',
              }}>⚓</span>
            )}
          </button>
          {/* switch-account zone — only once moored: the tide sheet with all
              the accounts the extension shares (and drift away) */}
          {moored && (
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="switch account"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderLeft: '1px solid rgba(91,192,217,0.2)',
                padding: '8px 13px 8px 11px',
                display: 'inline-flex', alignItems: 'center',
                fontFamily: MONO, fontSize: 10, color: 'rgba(168,223,229,0.65)',
              }}
            >⌄</button>
          )}
        </div>
      </div>

      <MooringSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        accounts={m.accounts}
        mooredAddress={m.mooredAddress}
        onPick={(address) => { m.pick(address); dive(address); }}
        showWalletConnect={m.isMobile}
        onWalletConnect={async () => {
          const addr = await m.moorWalletConnect();
          if (addr) dive(addr);
        }}
        isConnecting={m.isConnecting}
        error={m.error}
        actions={m.mooredAddress ? [{
          icon: '✕', label: 'drift away', color: '#FF8B6E',
          onClick: () => { void m.driftAway(); setSheetOpen(false); },
        }] : []}
        emptyHint={m.isMobile
          ? 'no wallet found in this browser — use WalletConnect below, or open SOVRA inside the Reef mobile app'
          : 'no reef wallet found in this browser — install the Reef browser extension, then drop the anchor again'}
      />
    </>
  );
}
