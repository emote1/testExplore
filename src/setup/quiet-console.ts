// Silences known noisy console hints in development when enabled via env flag.
// Enable by setting VITE_SILENCE_CONSOLE_HINTS=1 (or true)

const env: any = (import.meta as any)?.env ?? {};
const ENABLED: boolean = env?.VITE_SILENCE_CONSOLE_HINTS === '1' || env?.VITE_SILENCE_CONSOLE_HINTS === 'true';

if (ENABLED && typeof window !== 'undefined') {
  const patterns: RegExp[] = [
    /react devtools/i,
    /apollo.*devtools/i,
    /@polkadot\/util.*requires direct dependencies exactly matching version/i,
    /@polkadot\/util-crypto.*multiple versions/i,
    /deprecation warning: tabReply will be removed/i,
    /provider initialised/i,
    /\[page receives\]/i,
    /\[content receives\]/i,
    /module "buffer" has been externalized/i,
  ];

  const shouldSilence = (args: unknown[]): boolean => {
    try {
      for (const a of args) {
        const s = typeof a === 'string' ? a : (typeof a === 'object' ? JSON.stringify(a) : String(a));
        if (patterns.some((re) => re.test(s))) return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
  } as const;

  console.log = (...args: unknown[]) => { if (shouldSilence(args)) return; orig.log(...args); };
  console.info = (...args: unknown[]) => { if (shouldSilence(args)) return; orig.info(...args); };
  console.warn = (...args: unknown[]) => { if (shouldSilence(args)) return; orig.warn(...args); };
  // Never silence errors
}
