export interface LruOptions {
  max?: number;
  ttlMs?: number;
}

interface LruEntry<V> {
  value: V;
  expiresAt: number;
}

function now(): number {
  return Date.now();
}

export function createLruCache<K, V>(options: LruOptions = {}) {
  const max = options.max ?? 200;
  const defaultTtlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
  const map = new Map<K, LruEntry<V>>();

  function get(key: K): V | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      map.delete(key);
      return undefined;
    }
    // refresh recency
    map.delete(key);
    map.set(key, entry);
    return entry.value;
  }

  function set(key: K, value: V, ttlMs?: number): void {
    const expiresAt = now() + (ttlMs ?? defaultTtlMs);
    if (map.has(key)) map.delete(key);
    map.set(key, { value, expiresAt });
    if (map.size > max) {
      const firstKey = map.keys().next().value as K | undefined;
      if (firstKey !== undefined) map.delete(firstKey);
    }
  }

  function has(key: K): boolean {
    return get(key) !== undefined;
  }

  function clear(): void {
    map.clear();
  }

  function size(): number {
    return map.size;
  }

  return { get, set, has, clear, size };
}
