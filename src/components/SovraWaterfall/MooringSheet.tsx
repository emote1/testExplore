import { C } from './constants';
import type { InjectedAccount } from '@/hooks/use-reef-extension';
import './sovra-waterfall.css';

const MONO = '"JetBrains Mono",monospace';

function shortAddr(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 5)}…${a.slice(-4)}`;
}

export interface MooringSheetAction {
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}

interface MooringSheetProps {
  open: boolean;
  onClose: () => void;
  /** accounts shared by the extension this session (may be empty) */
  accounts: InjectedAccount[];
  /** the moored (persisted) address — gets the pearl */
  mooredAddress: string | null;
  onPick: (address: string) => void;
  /** context actions: return to my waters / another wallet / drift away */
  actions?: MooringSheetAction[];
  showWalletConnect?: boolean;
  onWalletConnect?: () => void;
  isConnecting?: boolean;
  error?: string | null;
  /** shown when there is nothing to list (no extension / no accounts) */
  emptyHint?: string | null;
}

/** The tide sheet: pick an account / connect / drift away. Shared by the
 *  landing anchor and the ocean's address chip. */
export default function MooringSheet({
  open, onClose, accounts, mooredAddress, onPick,
  actions = [], showWalletConnect = false, onWalletConnect,
  isConnecting = false, error = null, emptyHint = null,
}: MooringSheetProps) {
  if (!open) return null;

  // the moored identity may come from a past session the extension has not
  // re-shared yet — still show it, display-only, so the pearl has a home
  const rows: Array<{ address: string; name?: string; ghost?: boolean }> = accounts.length > 0
    ? accounts
    : (mooredAddress ? [{ address: mooredAddress, name: 'moored', ghost: true }] : []);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(1,10,16,0.65)', backdropFilter: 'blur(3px)',
      animation: 'swfFadeIn 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 340,
        background: 'linear-gradient(180deg,#062B38,#02151D)',
        border: `1px solid ${C.border}`, borderRadius: 18,
        padding: '16px 16px 14px',
        animation: 'swfModalIn 0.28s cubic-bezier(.2,.7,.3,1)',
        maxHeight: '80vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          textAlign: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em',
          textTransform: 'lowercase', color: C.textMute, marginBottom: 4,
        }}>~ moor your wallet ~</div>

        {rows.map((a) => {
          const active = mooredAddress != null && a.address === mooredAddress;
          return (
            <button key={a.address} disabled={!!a.ghost} onClick={() => onPick(a.address)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              background: active ? 'rgba(125,211,218,0.08)' : 'rgba(2,21,30,0.5)',
              border: `1px solid ${active ? C.teal + '55' : C.border}`, borderRadius: 12,
              padding: '11px 13px', cursor: a.ghost ? 'default' : 'pointer', textAlign: 'left',
            }}>
              <span className={active ? 'swf-seal-breath' : undefined} style={{
                fontSize: 11, lineHeight: 1, color: active ? C.teal : C.textDim,
              }}>{active ? '◉' : '○'}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontFamily: '"Bricolage Grotesque",sans-serif', fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name || 'unnamed'}
                </span>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: C.textMute, marginTop: 2 }}>
                  {shortAddr(a.address)}
                </span>
              </span>
            </button>
          );
        })}

        {accounts.length === 1 && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, textAlign: 'center', lineHeight: 1.6, padding: '0 8px' }}>
            the extension shares one account with this site — its
            “Manage Website Access” settings decide what SOVRA can see
          </div>
        )}

        {rows.length === 0 && emptyHint && (
          <div style={{
            fontFamily: MONO, fontSize: 10.5, color: C.textMute, lineHeight: 1.6,
            background: 'rgba(2,21,30,0.5)', border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '12px 13px', textAlign: 'center',
          }}>{emptyHint}</div>
        )}

        {showWalletConnect && (
          <button onClick={onWalletConnect} disabled={isConnecting} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(180,157,223,0.10)', border: `1px solid ${C.swap}55`,
            borderRadius: 12, padding: '12px', cursor: 'pointer',
            fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            color: C.swap, opacity: isConnecting ? 0.6 : 1,
          }}>
            ▢ {isConnecting ? 'connecting…' : 'WalletConnect'}
          </button>
        )}

        {error && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.coralLight, lineHeight: 1.5, padding: '2px 4px' }}>
            {error}
          </div>
        )}

        {actions.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.map((act) => (
              <button key={act.label} onClick={act.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                background: 'transparent', border: 'none', borderRadius: 10,
                padding: '9px 10px', cursor: 'pointer', textAlign: 'left',
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
                color: act.color ?? C.textMute,
              }}>
                <span style={{ fontSize: 12 }}>{act.icon}</span>{act.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
