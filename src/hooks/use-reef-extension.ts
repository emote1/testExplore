import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isValidAddress } from '@/utils/address-helpers';

export interface InjectedAccount {
  address: string;
  name?: string;
  genesisHash?: string | null;
  type?: string;
}

interface InjectedAccountsSource {
  get?: () => Promise<InjectedAccount[]>;
}

interface InjectedEnableResult {
  accounts?: InjectedAccountsSource;
}

interface InjectedProviderMeta {
  name?: string;
  version?: string;
}

interface InjectedProvider {
  enable?: (originName: string) => Promise<InjectedEnableResult>;
  version?: string;
}

interface InjectedWalletMap {
  [key: string]: InjectedProviderMeta | undefined;
}

interface ReefExtensionStatus {
  source: string | null;
  isAvailable: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  accounts: InjectedAccount[];
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  selectAddress: (nextAddress: string) => void;
  refreshAccounts: () => Promise<InjectedAccount[]>;
}

declare global {
  interface Window {
    injectedWeb3?: InjectedWalletMap;
  }
}

const PREFERRED_SOURCES = ['reef', 'reef_wallet', 'polkadot-js', 'talisman', 'subwallet-js'];
const APP_NAME = 'SOVRA Explorer';

function getInjectedSource(): string | null {
  if (typeof window === 'undefined' || !window.injectedWeb3) return null;
  const sources = Object.keys(window.injectedWeb3);
  if (sources.length === 0) return null;
  for (const preferred of PREFERRED_SOURCES) {
    const match = sources.find((source) => source.toLowerCase() === preferred.toLowerCase());
    if (match) return match;
  }
  return sources[0] ?? null;
}

async function getInjectedProvider(source: string): Promise<InjectedProvider | null> {
  if (typeof window === 'undefined') return null;
  const maybeProvider = (window as Window & { injectedWeb3?: Record<string, InjectedProvider> }).injectedWeb3?.[source];
  if (!maybeProvider) return null;
  return maybeProvider;
}

function pickUsableAccount(accounts: InjectedAccount[]): InjectedAccount | null {
  return accounts.find((account) => isValidAddress(account.address)) ?? accounts[0] ?? null;
}

export function useReefExtension(): ReefExtensionStatus {
  const [source, setSource] = useState<string | null>(() => getInjectedSource());
  const [accounts, setAccounts] = useState<InjectedAccount[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const availabilityPollRef = useRef<number | null>(null);

  useEffect(() => {
    const syncAvailability = () => {
      const nextSource = getInjectedSource();
      setSource(nextSource);
      if (nextSource) {
        setHasCheckedAvailability(true);
        if (availabilityPollRef.current !== null) {
          window.clearInterval(availabilityPollRef.current);
          availabilityPollRef.current = null;
        }
      }
    };

    syncAvailability();

    if (!getInjectedSource()) {
      availabilityPollRef.current = window.setInterval(() => {
        syncAvailability();
      }, 1000);

      window.setTimeout(() => {
        setHasCheckedAvailability(true);
      }, 2500);
    }

    return () => {
      if (availabilityPollRef.current !== null) {
        window.clearInterval(availabilityPollRef.current);
      }
    };
  }, []);

  const refreshAccounts = useCallback(async (): Promise<InjectedAccount[]> => {
    const nextSource = getInjectedSource();
    setSource(nextSource);
    if (!nextSource) {
      setAccounts([]);
      setAddress(null);
      setError('Reef wallet extension was not found in this browser.');
      return [];
    }

    const provider = await getInjectedProvider(nextSource);
    if (!provider?.enable) {
      setAccounts([]);
      setAddress(null);
      setError('Wallet extension was detected, but it does not expose an enable() API.');
      return [];
    }

    try {
      const enabled = await provider.enable(APP_NAME);
      const nextAccounts = await enabled.accounts?.get?.() ?? [];
      const validAccounts = nextAccounts.filter((account) => typeof account.address === 'string' && account.address.length > 0);
      setAccounts(validAccounts);
      const usable = pickUsableAccount(validAccounts);
      setAddress(usable?.address ?? null);
      setError(usable ? null : 'No accounts were shared by the wallet extension.');
      return validAccounts;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to the wallet extension.';
      setAccounts([]);
      setAddress(null);
      setError(message);
      return [];
    }
  }, []);

  const connect = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true);
    try {
      const nextAccounts = await refreshAccounts();
      const usable = pickUsableAccount(nextAccounts);
      return usable?.address ?? null;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshAccounts]);

  const disconnect = useCallback(() => {
    setAccounts([]);
    setAddress(null);
    setError(null);
  }, []);

  const selectAddress = useCallback((nextAddress: string) => {
    if (!nextAddress) return;
    const exists = accounts.some((account) => account.address === nextAddress);
    if (!exists) return;
    setAddress(nextAddress);
  }, [accounts]);

  const isAvailable = useMemo(() => source !== null, [source]);
  const isConnected = useMemo(() => Boolean(address), [address]);

  return {
    source,
    isAvailable: hasCheckedAvailability ? isAvailable : true,
    isConnecting,
    isConnected,
    address,
    accounts,
    error,
    connect,
    disconnect,
    selectAddress,
    refreshAccounts,
  };
}
