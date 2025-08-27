/**
 * Generic TTL cache with optional localStorage persistence and simple FIFO eviction.
 * - Namespaced keys when persisting to localStorage to avoid collisions
 * - Centralized invalidation via clearAllTtlCaches()/pruneAllTtlCaches()
 */

interface TtlCacheOptions {
  namespace: string;
  defaultTtlMs: number;
  persist?: boolean;
  maxSize?: number;
  registerGlobal?: boolean; // default true
}

interface TtlEntry<V> {
  value: V;
  ts: number; // stored at time of set
  ttl: number; // ttl at time of set
}

const globalTtlCaches = new Set<{ clear: () => void; pruneExpired: () => void }>();

function now(): number {
  return Date.now();
}

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export class TtlCache<V> {
  private map = new Map<string, TtlEntry<V>>();
  private accessOrder: string[] = [];
  private ns: string;
  private ttlDefault: number;
  private persist: boolean;
  private maxSize: number;

  constructor(opts: TtlCacheOptions) {
    this.ns = opts.namespace;
    this.ttlDefault = Math.max(0, Math.floor(opts.defaultTtlMs));
    this.persist = !!opts.persist;
    this.maxSize = Math.max(0, Math.floor(opts.maxSize ?? 0));
    if (opts.registerGlobal !== false) {
      globalTtlCaches.add(this);
    }
  }

  private lsKey(key: string): string {
    return `${this.ns}:${key}`;
  }

  private markAsAccessed(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  private evictIfNeeded(): void {
    if (this.maxSize <= 0) return;
    while (this.map.size > this.maxSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      if (!oldest) break;
      this.map.delete(oldest);
      if (this.persist && hasWindow()) {
        try { window.localStorage.removeItem(this.lsKey(oldest)); } catch { /* noop */ }
      }
    }
  }

  private isExpired(entry: TtlEntry<V>): boolean {
    return entry.ttl > 0 && now() - entry.ts > entry.ttl;
  }

  private loadFromLs(key: string): TtlEntry<V> | null {
    if (!this.persist || !hasWindow()) return null;
    try {
      const raw = window.localStorage.getItem(this.lsKey(key));
      if (!raw) return null;
      const obj = JSON.parse(raw) as { v: V; ts: number; ttl: number } | null;
      if (!obj || typeof obj.ts !== 'number' || typeof obj.ttl !== 'number') return null;
      const entry: TtlEntry<V> = { value: obj.v, ts: obj.ts, ttl: obj.ttl };
      if (this.isExpired(entry)) {
        window.localStorage.removeItem(this.lsKey(key));
        return null;
      }
      this.map.set(key, entry);
      this.markAsAccessed(key);
      return entry;
    } catch {
      return null;
    }
  }

  get(key: string): V | null {
    const entry = this.map.get(key) ?? this.loadFromLs(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      if (this.persist && hasWindow()) {
        try { window.localStorage.removeItem(this.lsKey(key)); } catch { /* noop */ }
      }
    } else {
      this.markAsAccessed(key);
      return entry.value;
    }
    return null;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  set(key: string, value: V, ttlMs?: number): void {
    const ttl = Math.max(0, Math.floor(ttlMs ?? this.ttlDefault));
    const entry: TtlEntry<V> = { value, ts: now(), ttl };
    this.map.set(key, entry);
    this.markAsAccessed(key);
    if (this.persist && hasWindow()) {
      try {
        const payload = JSON.stringify({ v: value, ts: entry.ts, ttl: entry.ttl });
        window.localStorage.setItem(this.lsKey(key), payload);
      } catch {
        // ignore quota errors
      }
    }
    this.evictIfNeeded();
  }

  delete(key: string): void {
    this.map.delete(key);
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    if (this.persist && hasWindow()) {
      try { window.localStorage.removeItem(this.lsKey(key)); } catch { /* noop */ }
    }
  }

  clear(): void {
    this.map.clear();
    this.accessOrder = [];
    if (this.persist && hasWindow()) {
      try {
        // Iterate over all keys in LS and remove those matching our namespace
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(this.ns + ':')) keys.push(k);
        }
        for (const k of keys) window.localStorage.removeItem(k);
      } catch {
        // noop
      }
    }
  }

  pruneExpired(): void {
    for (const [key, entry] of this.map.entries()) {
      if (this.isExpired(entry)) {
        this.map.delete(key);
        if (this.persist && hasWindow()) {
          try { window.localStorage.removeItem(this.lsKey(key)); } catch { /* noop */ }
        }
      }
    }
  }

  stats(): { size: number; maxSize: number; namespace: string } {
    return { size: this.map.size, maxSize: this.maxSize, namespace: this.ns };
    }
}

export function clearAllTtlCaches(): void {
  for (const c of globalTtlCaches) c.clear();
}

export function pruneAllTtlCaches(): void {
  for (const c of globalTtlCaches) c.pruneExpired();
}
