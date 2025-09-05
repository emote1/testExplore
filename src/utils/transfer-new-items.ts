// src/utils/transfer-new-items.ts

export interface NewItemDetectorOptions<T> {
  key: (item: T) => string | null | undefined;
  max?: number; // cap remembered IDs
}

interface InternalState {
  primed: boolean;
}

export interface NewItemDetector<T> {
  // Returns only items not seen before. First call primes and returns []
  detectNew: (items: T[]) => T[];
  // Manually add an id to the seen set
  add: (id: string) => void;
  // Reset internal memory
  reset: () => void;
}

export function createNewItemDetector<T>(opts: NewItemDetectorOptions<T>): NewItemDetector<T> {
  const max = Math.max(1, Math.floor(opts.max ?? 200));
  const seen = new Set<string>();
  const order: string[] = [];
  const state: InternalState = { primed: false };

  function remember(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    if (order.length > max) {
      const oldest = order.shift();
      if (oldest) seen.delete(oldest);
    }
  }

  function detectNew(items: T[]): T[] {
    // Build an index-aligned array of keys, preserving positions of falsy keys as null
    const keys: (string | null)[] = [];
    for (let i = 0; i < items.length; i++) {
      const k = opts.key(items[i]!);
      keys.push(k ? String(k) : null);
    }

    if (!state.primed) {
      for (const k of keys) if (k) remember(k);
      state.primed = true;
      return [];
    }

    const result: T[] = [];
    for (let i = 0; i < items.length; i++) {
      const k = keys[i];
      if (!k) continue;
      if (!seen.has(k)) {
        result.push(items[i]!);
      }
    }
    // After collecting, remember all keys to update state
    for (const k of keys) if (k) remember(k);
    return result;
  }

  function add(id: string) {
    if (!id) return;
    remember(id);
  }

  function reset() {
    seen.clear();
    order.length = 0;
    state.primed = false;
  }

  return { detectNew, add, reset };
}
