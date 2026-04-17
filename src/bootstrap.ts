import { Buffer } from 'buffer';
import process from 'process';

declare global {
  var Buffer: typeof Buffer;
  var process: typeof process;
  var global: typeof globalThis;
}

function globalRoot(): typeof globalThis {
  if (typeof globalThis !== 'undefined' && globalThis != null) {
    return globalThis;
  }
  if (typeof window !== 'undefined' && window != null) {
    return window as unknown as typeof globalThis;
  }
  if (typeof self !== 'undefined' && self != null) {
    return self as unknown as typeof globalThis;
  }
  if (typeof global !== 'undefined' && global != null) {
    return global as unknown as typeof globalThis;
  }
  throw new Error('[bootstrap] No global object (globalThis / window / self / global)');
}

const root = globalRoot();

if (Buffer == null) {
  throw new Error('[bootstrap] `buffer` did not export Buffer — check Vite resolve / optimizeDeps');
}

if (typeof root.Buffer === 'undefined') {
  root.Buffer = Buffer;
}

if (typeof root.process === 'undefined') {
  root.process = process;
}

if (typeof root.global === 'undefined') {
  root.global = root;
}

await import('./main.js');
