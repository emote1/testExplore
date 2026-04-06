import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Search, Wallet, Box, PlugZap, LogOut, ChevronDown, Check, Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

type AppPage = 'search' | 'wallet';

interface WalletAccountOption {
  address: string;
  name?: string;
}

interface NavigationProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  connectedAddress?: string | null;
  walletAccounts?: WalletAccountOption[];
  isConnecting?: boolean;
  walletAvailable?: boolean;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
  onOpenMyWallet?: () => void;
  onSelectWalletAddress?: (address: string) => void;
}

function shortenAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function Navigation({
  currentPage,
  onPageChange,
  connectedAddress,
  walletAccounts = [],
  isConnecting,
  walletAvailable = true,
  onConnectWallet,
  onDisconnectWallet,
  onOpenMyWallet,
  onSelectWalletAddress,
}: NavigationProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const burgerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isPickerOpen) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!pickerRef.current?.contains(target)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isPickerOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !mobileMenuRef.current?.contains(target) &&
        !burgerRef.current?.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [mobileMenuOpen]);

  const selectedAccount = walletAccounts.find((a) => a.address === connectedAddress) ?? null;
  const selectedLabel = selectedAccount?.name ?? 'Wallet';

  const navItems = [
    { id: 'search' as AppPage, label: 'Search', icon: Search },
    { id: 'wallet' as AppPage, label: 'Wallet', icon: Wallet },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 dark:bg-card/90 backdrop-blur-md border-b border-border dark:border-border/50 dark:shadow-lg dark:shadow-black/20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-brand to-brand-light rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
                <Box className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
                BlockExplorer
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => onPageChange(item.id)}
                    className={`flex items-center space-x-2 group transition-all duration-200 hover:scale-105 ${
                      isActive
                        ? 'bg-gradient-to-r from-brand to-brand-light !text-white shadow-md hover:from-brand-light hover:to-brand'
                        : '!text-muted-foreground hover:!text-foreground hover:bg-muted'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <button
              ref={burgerRef}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
            </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {connectedAddress ? (
              <>
                <button
                  type="button"
                  onClick={onOpenMyWallet}
                  className="flex items-center gap-2 rounded-full border border-emerald-200/80 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 shadow-sm dark:shadow-none hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900 dark:hover:to-teal-900"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                  <span className="hidden sm:inline">{selectedLabel}</span>
                  <span className="text-emerald-600/80 dark:text-emerald-400/80">{shortenAddress(connectedAddress)}</span>
                </button>
                {walletAccounts.length > 1 ? (
                  <>
                    <select
                      value={connectedAddress ?? ''}
                      onChange={(e) => onSelectWalletAddress?.(e.target.value)}
                      className="block md:hidden h-8 max-w-[130px] rounded-lg border border-blue-200/70 dark:border-blue-800/70 bg-background px-2 text-xs text-foreground shadow-sm dark:shadow-none"
                    >
                      {walletAccounts.map((account) => (
                        <option key={account.address} value={account.address}>
                          {account.name ?? shortenAddress(account.address)}
                        </option>
                      ))}
                    </select>
                    <div ref={pickerRef} className="relative hidden md:block">
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen((v) => !v)}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-blue-200/70 dark:border-blue-800/70 bg-background px-3 text-xs font-medium text-foreground shadow-sm dark:shadow-none hover:bg-muted"
                    >
                      <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{walletAccounts.length} accounts</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isPickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isPickerOpen ? (
                      <div className="absolute right-0 z-[70] mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                        <div className="border-b border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                          Select active wallet
                        </div>
                        <div className="max-h-80 overflow-auto p-1.5">
                          {walletAccounts.map((account) => {
                            const isSelected = account.address === connectedAddress;
                            return (
                              <button
                                key={account.address}
                                type="button"
                                onClick={() => {
                                  onSelectWalletAddress?.(account.address);
                                  setIsPickerOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                                  isSelected ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'text-foreground hover:bg-muted'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{account.name ?? 'Unnamed Account'}</div>
                                  <div className="truncate text-xs text-muted-foreground">{account.address}</div>
                                </div>
                                {isSelected ? <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisconnectWallet}
                  className="border-border text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Disconnect</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onConnectWallet}
                disabled={isConnecting || !walletAvailable}
                className="border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <PlugZap className="h-4 w-4" />
                <span>{isConnecting ? 'Connecting...' : walletAvailable ? 'Connect Wallet' : 'Wallet Not Found'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border shadow-lg z-40 animate-slide-down"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentPage === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => { onPageChange(item.id); setMobileMenuOpen(false); }}
                  className={`w-full justify-start gap-2 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand to-brand-light !text-white shadow-md'
                      : '!text-muted-foreground hover:!text-foreground hover:bg-muted'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
