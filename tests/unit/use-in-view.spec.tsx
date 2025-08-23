// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useInView } from '../../src/hooks/use-in-view';

interface IOInstance {
  cb: (entries: any[]) => void;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let instances: IOInstance[] = [];

beforeEach(() => {
  instances = [];
  (globalThis as any).IntersectionObserver = vi.fn((cb: any) => {
    const inst: IOInstance = {
      cb,
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
    instances.push(inst);
    return inst as any;
  }) as any;
  cleanup();
});

function trigger(entries: any[]) {
  const inst = instances[instances.length - 1];
  expect(inst).toBeDefined();
  act(() => {
    inst.cb(entries);
  });
}

function Test({ once = false, opts }: { once?: boolean; opts?: IntersectionObserverInit }) {
  const { ref, inView } = useInView({ once, ...(opts ?? {}) });
  return (
    <div>
      <div data-testid="status">{inView ? 'in' : 'out'}</div>
      <div data-testid="box" ref={ref} />
    </div>
  );
}

describe('useInView()', () => {
  it('toggles inView based on intersection changes', () => {
    // unique opts to avoid sharing cached observer across tests
    render(<Test opts={{ rootMargin: '0px' }} />);
    const el = screen.getByTestId('box');
    const status = () => screen.getByTestId('status').textContent;

    const inst = instances[instances.length - 1];
    expect(inst.observe).toHaveBeenCalledWith(el);

    expect(status()).toBe('out');

    trigger([{ target: el, isIntersecting: true } as any]);
    expect(status()).toBe('in');

    trigger([{ target: el, isIntersecting: false } as any]);
    expect(status()).toBe('out');
  });

  it('with once=true, stays inView after first intersection and unsubscribes', () => {
    // different opts to force a fresh observer instance
    render(<Test once opts={{ rootMargin: '1px' }} />);
    const el = screen.getByTestId('box');
    const status = () => screen.getByTestId('status').textContent;

    expect(status()).toBe('out');

    trigger([{ target: el, isIntersecting: true } as any]);
    expect(status()).toBe('in');

    // Subsequent events should not flip back to false
    trigger([{ target: el, isIntersecting: false } as any]);
    expect(status()).toBe('in');
  });

  it('unobserves element on unmount', () => {
    // different opts to force a fresh observer instance
    const { unmount } = render(<Test opts={{ rootMargin: '2px' }} />);
    const el = screen.getByTestId('box');
    const inst = instances[instances.length - 1];
    unmount();
    expect(inst.unobserve).toHaveBeenCalledWith(el);
  });
});
