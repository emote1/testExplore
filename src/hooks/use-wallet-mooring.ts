import { useCallback, useState } from 'react';
import { useReefExtension, type InjectedAccount } from './use-reef-extension';
import { useMobileWalletConnect } from './use-mobile-walletconnect';

/**
 * SOVRA wallet "mooring" — one hook over both connection paths (Reef browser
 * extension + mobile WalletConnect) with a persisted identity.
 *
 * Metaphor: connecting = mooring your wallet in these waters. The chosen
 * {source, address} is remembered in localStorage, so a returning visitor
 * gets a "dive back in" chip with no dialogs: VIEWING a wallet needs no
 * permission at all, the extension is only re-enabled on an explicit moor().
 */

export type MooringSource = 'extension' | 'walletconnect';

interface SavedMooring {
  source: MooringSource;
  address: string;
}

const STORAGE_KEY = 'sovra:mooring';

function readSaved(): SavedMooring | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as SavedMooring;
    if ((j.source === 'extension' || j.source === 'walletconnect')
      && typeof j.address === 'string' && j.address.length > 0) return j;
  } catch { /* private mode etc. */ }
  return null;
}

function writeSaved(v: SavedMooring | null): void {
  try {
    if (v) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode etc. */ }
}

export interface MoorResult {
  address: string | null;
  accounts: InjectedAccount[];
  /** true = several accounts were shared and none is pre-chosen: show a picker */
  needsPick: boolean;
}

/**
 * Raw extension errors are cryptic; translate the known ones into something a
 * person can act on. "not allowed to interact" = the origin sits in the
 * extension's DENIED list (a dismissed/rejected first prompt is remembered).
 */
function friendlyError(raw: string | null): string | null {
  if (!raw) return null;
  if (/not allowed to interact/i.test(raw)) {
    return 'the reef extension has this site blocked — open the extension, '
      + 'Settings → Manage Website Access, allow this site, then drop the anchor again';
  }
  return raw;
}

export function useWalletMooring() {
  const ext = useReefExtension();
  const wc = useMobileWalletConnect();
  const [saved, setSaved] = useState<SavedMooring | null>(() => readSaved());

  const persist = useCallback((source: MooringSource, address: string) => {
    const v = { source, address };
    writeSaved(v);
    setSaved(v);
  }, []);

  const { refreshAccounts, selectAddress, disconnect: extDisconnect } = ext;
  const { connect: wcConnect, disconnect: wcDisconnect } = wc;

  /** Connect via the browser extension; the caller decides what to do with several accounts. */
  const moor = useCallback(async (): Promise<MoorResult> => {
    const accounts = await refreshAccounts();
    if (accounts.length === 0) return { address: null, accounts, needsPick: false };
    // keep the previously chosen account if the wallet still shares it
    const savedNow = readSaved();
    const kept = savedNow?.source === 'extension'
      ? accounts.find((a) => a.address === savedNow.address)
      : undefined;
    if (kept) {
      selectAddress(kept.address);
      persist('extension', kept.address);
      return { address: kept.address, accounts, needsPick: false };
    }
    if (accounts.length === 1) {
      persist('extension', accounts[0].address);
      return { address: accounts[0].address, accounts, needsPick: false };
    }
    return { address: null, accounts, needsPick: true };
  }, [refreshAccounts, selectAddress, persist]);

  /** Mobile path (WalletConnect, EVM address). Needs VITE_WALLETCONNECT_PROJECT_ID. */
  const moorWalletConnect = useCallback(async (): Promise<string | null> => {
    const address = await wcConnect();
    if (address) persist('walletconnect', address);
    return address;
  }, [wcConnect, persist]);

  /** Choose one of the extension accounts as the moored identity. */
  const pick = useCallback((address: string) => {
    selectAddress(address);
    persist('extension', address);
  }, [selectAddress, persist]);

  /** Disconnect + forget. Deliberately does NOT navigate anywhere. */
  const driftAway = useCallback(async () => {
    extDisconnect();
    await wcDisconnect();
    writeSaved(null);
    setSaved(null);
  }, [extDisconnect, wcDisconnect]);

  return {
    /** persisted identity — survives reloads, drives the "dive back in" chip */
    mooredAddress: saved?.address ?? null,
    mooredSource: saved?.source ?? null,
    /** accounts shared by the extension in THIS session (empty until moor()) */
    accounts: ext.accounts,
    extensionAvailable: ext.isAvailable,
    isMobile: wc.isMobile,
    wcReady: wc.isReady,
    isConnecting: ext.isConnecting || wc.isConnecting,
    error: friendlyError(ext.error ?? wc.error),
    moor,
    moorWalletConnect,
    pick,
    driftAway,
  };
}
