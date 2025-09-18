// Minimal browser polyfills for Node globals used by some libraries.
// Install with: npm i buffer --save

import { Buffer as BufferPolyfill } from 'buffer';

declare global {
  interface Window { Buffer?: typeof BufferPolyfill }
}

if (typeof window !== 'undefined') {
  if (!window.Buffer) {
    window.Buffer = BufferPolyfill;
  }
}
