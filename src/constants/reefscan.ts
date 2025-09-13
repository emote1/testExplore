// Base origin for Reefscan links (UI). Do NOT include trailing slash.
// Can be overridden via VITE_REEFSCAN_ORIGIN env var.
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
export const REEFSCAN_ORIGIN: string = ENV.VITE_REEFSCAN_ORIGIN ?? 'http://reefscan.com';
