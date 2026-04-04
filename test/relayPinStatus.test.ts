import assert from 'node:assert/strict';
import { normalizeRelayPinnedBase, relayPreviewUrl } from '../src/lib/relay/relayEnv.js';
import {
  probeCidPinned,
  probeRelayHealth,
  startRelayPinPolling,
  type RelayLedState,
} from '../src/lib/services/relayPinStatus.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('relayEnv', () => {
  it('normalizeRelayPinnedBase trims and adds trailing slash', () => {
    assert.strictEqual(normalizeRelayPinnedBase(''), '');
    assert.strictEqual(normalizeRelayPinnedBase('  http://x/ipfs  '), 'http://x/ipfs/');
    assert.strictEqual(normalizeRelayPinnedBase('http://x/ipfs/'), 'http://x/ipfs/');
  });

  it('relayPreviewUrl joins base and cid', () => {
    assert.strictEqual(relayPreviewUrl('http://h/ipfs/', 'bafyTEST'), 'http://h/ipfs/bafyTEST');
    assert.strictEqual(relayPreviewUrl('http://h/ipfs', 'bafyTEST'), 'http://h/ipfs/bafyTEST');
  });
});

describe('relayPinStatus probes', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('probeRelayHealth returns true on ok response', async () => {
    globalThis.fetch = async () =>
      ({ ok: true, status: 200 }) as Response;
    assert.strictEqual(await probeRelayHealth('http://localhost:9090'), true);
  });

  it('probeCidPinned returns true when HEAD is ok', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return { ok: true, status: 200 } as Response;
      }
      return { ok: false, status: 404 } as Response;
    };
    assert.strictEqual(await probeCidPinned('http://g/ipfs/', 'bafyX'), true);
  });

  it('probeCidPinned falls back to Range GET when HEAD not ok', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD') return { ok: false, status: 405 } as Response;
      if (init?.method === 'GET' && init.headers && (init.headers as Record<string, string>).Range === 'bytes=0-0') {
        return { ok: true, status: 206 } as Response;
      }
      return { ok: false, status: 404 } as Response;
    };
    assert.strictEqual(await probeCidPinned('http://g/ipfs/', 'bafyX'), true);
  });
});

describe('startRelayPinPolling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('emits yellow then green when HEAD succeeds on first tick', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'HEAD' && String(input).includes('bafyOK')) {
        return { ok: true, status: 200 } as Response;
      }
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafyOK',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      metricsBase: 'http://127.0.0.1:9090',
      onState: (s) => states.push(s),
    });
    await sleep(30);
    assert.deepStrictEqual(states, ['yellow', 'green']);
    ac.abort();
  });

  it('emits orange then green when HEAD fails once then succeeds', async () => {
    let headOkAfter = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD' && u.includes('/ipfs/bafySTEP')) {
        headOkAfter += 1;
        if (headOkAfter < 2) return { ok: false, status: 404 } as Response;
        return { ok: true, status: 200 } as Response;
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafySTEP',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      metricsBase: 'http://127.0.0.1:9090',
      onState: (s) => states.push(s),
    });
    await sleep(30);
    assert.ok(states.includes('yellow'));
    assert.ok(states.includes('orange'));
    await sleep(850);
    assert.ok(states.includes('green'), `expected green, got: ${states.join(',')}`);
    ac.abort();
  });

  it('emits error when maxIterations exhausted', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD') return { ok: false, status: 404 } as Response;
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafyFAIL',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      metricsBase: 'http://127.0.0.1:9090',
      maxIterations: 3,
      onState: (s) => states.push(s),
    });
    await sleep(2500);
    assert.ok(states.includes('error'), `expected error, got: ${states.join(',')}`);
    ac.abort();
  });

  it('stop() prevents further ticks after first orange', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD') return { ok: false, status: 404 } as Response;
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    const dispose = startRelayPinPolling({
      cid: 'bafySTOP',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      metricsBase: 'http://127.0.0.1:9090',
      onState: (s) => states.push(s),
    });
    await sleep(40);
    const orangeBefore = states.filter((s) => s === 'orange').length;
    assert.ok(orangeBefore >= 1);
    dispose();
    ac.abort();
    const lenAfter = states.length;
    await sleep(900);
    assert.strictEqual(states.length, lenAfter);
  });
});
