import { useCallback, useMemo, useRef, useState } from 'react';
import EthereumProvider from '@walletconnect/ethereum-provider';
import { isValidAddress } from '@/utils/address-helpers';

interface WalletConnectProviderLike {
  enable: () => Promise<string[]>;
  disconnect: () => Promise<void>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners?: () => void;
  accounts?: string[];
}

export interface MobileWalletConnectState {
  isMobile: boolean;
  isReady: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
}

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';
const CHAIN_ID = Number(import.meta.env.VITE_REEF_WALLETCONNECT_CHAIN_ID ?? '13939');
const RPC_URL = import.meta.env.VITE_REEF_EVM_RPC_URL ?? 'https://rpc.reefscan.com';

function getIsMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function pickAddress(accounts: string[] | undefined | null): string | null {
  if (!accounts || accounts.length === 0) return null;
  const valid = accounts.find((a) => isValidAddress(a));
  return valid ?? accounts[0] ?? null;
}

export function useMobileWalletConnect(): MobileWalletConnectState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerRef = useRef<WalletConnectProviderLike | null>(null);

  const isMobile = useMemo(() => getIsMobile(), []);
  const isReady = useMemo(() => isMobile && Boolean(PROJECT_ID), [isMobile]);

  const connect = useCallback(async (): Promise<string | null> => {
    if (!isMobile) {
      setError('Mobile WalletConnect flow is available on mobile devices.');
      return null;
    }
    if (!PROJECT_ID) {
      setError('WalletConnect project ID is missing. Set VITE_WALLETCONNECT_PROJECT_ID.');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const provider = await EthereumProvider.init({
        projectId: PROJECT_ID,
        showQrModal: true,
        chains: [CHAIN_ID],
        optionalChains: [CHAIN_ID],
        rpcMap: { [CHAIN_ID]: RPC_URL },
        metadata: {
          name: 'SOVRA Explorer',
          description: 'Reef explorer wallet connection',
          url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          icons: typeof window !== 'undefined' ? [`${window.location.origin}/favicon.ico`] : [],
        },
      });

      providerRef.current = provider as unknown as WalletConnectProviderLike;
      const accounts = await provider.enable();
      const selected = pickAddress(accounts ?? provider.accounts ?? []);

      if (!selected) {
        setError('No account returned by mobile wallet.');
        setAddress(null);
        return null;
      }

      setAddress(selected);

      provider.on('accountsChanged', (next: unknown) => {
        const list = Array.isArray(next) ? next.filter((x): x is string => typeof x === 'string') : [];
        setAddress(pickAddress(list));
      });

      provider.on('disconnect', () => {
        setAddress(null);
      });

      return selected;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WalletConnect mobile connect failed.';
      setError(message);
      setAddress(null);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [isMobile]);

  const disconnect = useCallback(async () => {
    try {
      await providerRef.current?.disconnect();
    } catch {
      // ignore disconnect errors
    }
    providerRef.current?.removeAllListeners?.();
    providerRef.current = null;
    setAddress(null);
    setError(null);
  }, []);

  return {
    isMobile,
    isReady,
    isConnecting,
    isConnected: Boolean(address),
    address,
    error,
    connect,
    disconnect,
  };
}
