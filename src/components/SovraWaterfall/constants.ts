import type { Channel, ChannelId } from './types';

/** Palette: teal (inflow), coral (outflow), staking (gold), swap (violet), neutrals. */
export const C = {
  teal: '#7DD3DA', tealDeep: '#5BC0D9', tealLight: '#A8DFE5',
  coral: '#FF8B6E', coralLight: '#FFC8B8',
  swap: '#B49DDF', staking: '#E4C76B',
  text: '#E8F1F3', textMute: 'rgba(168,223,229,0.74)', textDim: 'rgba(168,223,229,0.55)',
  cardBg: 'rgba(2,21,30,0.5)', border: 'rgba(91,192,217,0.15)',
} as const;

export const DEFAULT_ADDRESS = '5EUChcFqnQ3zckjfNExwEmr6S2s4TJA5PeJGJibr36ggyyTT';

/**
 * Mock REEF->USD multiplier used while wiring the visual layer.
 * Phase 2 replaces this with the live CoinGecko price (React Query).
 */
export const REEF_USD = 0.0000724;

/** Mock wallet balance (REEF). Phase 2 replaces with the real balance. */
export const MOCK_BALANCE = 2400000;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Transactions per page inside a time group. */
export const GROUP_PAGE = 5;

export const COINS = ['All', 'REEF', 'USDC', 'MRD'];

/** Channel definitions: 4 directional buckets. */
export const CHANNELS: Record<ChannelId, Channel> = {
  inflow:  { id: 'inflow',  label: 'Incoming',        dir: 'in',  color: C.teal,    icon: '↓', desc: 'received' },
  stakeIn: { id: 'stakeIn', label: 'Staking rewards', dir: 'in',  color: C.staking, icon: '◈', desc: 'earned' },
  outflow: { id: 'outflow', label: 'Outgoing',        dir: 'out', color: C.coral,   icon: '↑', desc: 'sent' },
  swap:    { id: 'swap',    label: 'Swaps',           dir: 'out', color: C.swap,    icon: '⇄', desc: 'traded' },
};
