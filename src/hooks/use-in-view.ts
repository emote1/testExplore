import React from 'react';

interface UseInViewOptions extends IntersectionObserverInit {
  once?: boolean;
}

interface ObserverEntry {
  observer: IntersectionObserver;
  elements: Map<Element, Set<(entry: IntersectionObserverEntry) => void>>;
}

const registry = new Map<string, ObserverEntry>();

function optionsKey(opts: IntersectionObserverInit): string {
  const rootId = (opts.root && (opts.root as Element).tagName) || 'null';
  const rootMargin = opts.rootMargin ?? '0px';
  const threshold = Array.isArray(opts.threshold) ? opts.threshold.join(',') : String(opts.threshold ?? 0);
  return `${rootId}|${rootMargin}|${threshold}`;
}

function getObserver(opts: IntersectionObserverInit): ObserverEntry {
  const key = optionsKey(opts);
  let entry = registry.get(key);
  if (entry) return entry;

  const elements = new Map<Element, Set<(entry: IntersectionObserverEntry) => void>>();
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const cbs = elements.get(e.target);
      if (!cbs) continue;
      // Clone to avoid mutation during iteration
      const list = Array.from(cbs);
      for (const cb of list) cb(e);
    }
  }, opts);

  entry = { observer, elements };
  registry.set(key, entry);
  return entry;
}

function subscribe(el: Element, opts: IntersectionObserverInit, cb: (entry: IntersectionObserverEntry) => void) {
  const { observer, elements } = getObserver(opts);
  let set = elements.get(el);
  if (!set) {
    set = new Set();
    elements.set(el, set);
    observer.observe(el);
  }
  set.add(cb);
  return () => {
    const s = elements.get(el);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) {
      elements.delete(el);
      observer.unobserve(el);
    }
  };
}

export function useInView<T extends Element = Element>(options: UseInViewOptions = {}): {
  ref: (el: T | null) => void;
  inView: boolean;
  entry: IntersectionObserverEntry | null;
} {
  const { once = false, root = null, rootMargin, threshold } = options;
  const opts = React.useMemo<IntersectionObserverInit>(() => ({ root, rootMargin, threshold }), [root, rootMargin, threshold]);
  const [inView, setInView] = React.useState<boolean>(false);
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | null>(null);
  const cleanupRef = React.useRef<null | (() => void)>(null);
  const elementRef = React.useRef<T | null>(null);

  const ref = React.useCallback((el: T | null) => {
    // cleanup previous
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    elementRef.current = el;
    if (!el) return;

    cleanupRef.current = subscribe(el as Element, opts, (e) => {
      setEntry(e);
      if (e.isIntersecting) {
        setInView(true);
        if (once && cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      } else if (!once) {
        setInView(false);
      }
    });
  }, [opts, once]);

  React.useEffect(() => {
    // detach on unmount
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = null;
      elementRef.current = null;
    };
  }, []);

  return { ref, inView, entry };
}
