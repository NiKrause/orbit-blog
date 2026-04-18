import assert from 'node:assert/strict';
import {
  normalizeRelayPinnedBase,
  relayOnlyIpfsUrlForCid,
  relayOriginFromLegacyPinnedBase,
  relayPreviewUrl,
} from '../src/lib/relay/relayEnv.js';
import {
  fetchRelayDatabaseListing,
  probeCidPinned,
  probeRelayHealth,
  probeRelayMediaDbInPinningList,
  requestRelayMediaDbPinSync,
  startRelayDatabasePolling,
  startRelayPinPolling,
  type RelayDatabasePollUpdate,
  type RelayLedState,
} from '../src/lib/services/relayPinStatus.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Minimal mock for `POST /pinning/sync` when tests use `mediaDbAddress` + `metricsOrigin`. */
function pinSyncOkResponse() {
  return new Response(JSON.stringify({ ok: true, dbAddress: '/orbitdb/x' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

  it('relayOnlyIpfsUrlForCid returns empty for blank cid', () => {
    assert.strictEqual(relayOnlyIpfsUrlForCid(''), '');
    assert.strictEqual(relayOnlyIpfsUrlForCid('   '), '');
  });

  it('relayOriginFromLegacyPinnedBase strips /ipfs suffix', () => {
    assert.strictEqual(relayOriginFromLegacyPinnedBase('http://localhost:81/ipfs/'), 'http://localhost:81');
    assert.strictEqual(relayOriginFromLegacyPinnedBase('http://localhost:81/ipfs'), 'http://localhost:81');
    assert.strictEqual(relayOriginFromLegacyPinnedBase('  http://x:81/ipfs/  '), 'http://x:81');
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

  it('probeRelayMediaDbInPinningList returns listed when targeted GET returns 200 with address', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const u = String(input);
      assert.ok(u.includes('/pinning/databases'));
      assert.ok(u.includes('address='));
      assert.ok(u.includes(encodeURIComponent('/orbitdb/zdpuSame')));
      return new Response(JSON.stringify({ databases: [{ address: '/orbitdb/zdpuSame' }], total: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    assert.strictEqual(await probeRelayMediaDbInPinningList('http://m:9', '/orbitdb/zdpuSame/'), 'listed');
  });

  it('probeRelayMediaDbInPinningList returns not_listed when JSON ok but no match', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ databases: [{ address: '/orbitdb/other' }], total: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    assert.strictEqual(await probeRelayMediaDbInPinningList('http://m:9', '/orbitdb/want'), 'not_listed');
  });

  it('probeRelayMediaDbInPinningList returns not_listed on 404 (targeted: not in sync history)', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, error: 'Database address not found in relay sync history' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    assert.strictEqual(await probeRelayMediaDbInPinningList('http://m:9', '/orbitdb/x'), 'not_listed');
  });

  it('probeRelayMediaDbInPinningList returns unknown on other non-OK response', async () => {
    globalThis.fetch = async () => new Response('', { status: 500 });
    assert.strictEqual(await probeRelayMediaDbInPinningList('http://m:9', '/orbitdb/x'), 'unknown');
  });

  it('probeRelayMediaDbInPinningList returns listed_stale_sync when lastSyncedAt is before media createdAt', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          databases: [{ address: '/orbitdb/zdpuOld', lastSyncedAt: '2026-01-01T00:00:00.000Z' }],
          total: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    assert.strictEqual(
      await probeRelayMediaDbInPinningList(
        'http://m:9',
        '/orbitdb/zdpuOld',
        undefined,
        '2026-06-15T12:00:00.000Z',
      ),
      'listed_stale_sync',
    );
  });

  it('probeRelayMediaDbInPinningList returns listed when lastSyncedAt is at or after media createdAt', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          databases: [{ address: '/orbitdb/zdpuFresh', lastSyncedAt: '2026-06-20T00:00:00.000Z' }],
          total: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    assert.strictEqual(
      await probeRelayMediaDbInPinningList(
        'http://m:9',
        '/orbitdb/zdpuFresh',
        undefined,
        '2026-06-15T12:00:00.000Z',
      ),
      'listed',
    );
  });

  it('requestRelayMediaDbPinSync posts JSON dbAddress and returns true on ok', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.strictEqual(init?.method, 'POST');
      assert.ok(String(input).includes('/pinning/sync'));
      assert.strictEqual(init?.headers && (init.headers as Record<string, string>)['Content-Type'], 'application/json');
      assert.strictEqual(init?.body, JSON.stringify({ dbAddress: '/orbitdb/zdpuABC' }));
      return new Response(JSON.stringify({ ok: true, dbAddress: '/orbitdb/zdpuABC' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    assert.strictEqual(await requestRelayMediaDbPinSync('http://m:9', '/orbitdb/zdpuABC'), true);
  });

  it('fetchRelayDatabaseListing returns listed row with lastSyncedAt', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          databases: [{ address: '/orbitdb/zdpuListed', lastSyncedAt: '2026-04-18T10:11:12.000Z' }],
          total: 1,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    const result = await fetchRelayDatabaseListing('http://m:9', '/orbitdb/zdpuListed');
    assert.strictEqual(result.probe, 'listed');
    assert.strictEqual(result.row?.address, '/orbitdb/zdpuListed');
    assert.strictEqual(result.row?.lastSyncedAt, '2026-04-18T10:11:12.000Z');
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
      healthOrigin: 'http://127.0.0.1:9090',
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
      healthOrigin: 'http://127.0.0.1:9090',
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
      healthOrigin: 'http://127.0.0.1:9090',
      maxIterations: 3,
      onState: (s) => states.push(s),
    });
    await sleep(2500);
    assert.ok(states.includes('error'), `expected error, got: ${states.join(',')}`);
    ac.abort();
  });

  it('stays yellow when mediaDB not in pinning/databases though health ok', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD' && u.includes('/ipfs/')) return { ok: false, status: 404 } as Response;
      if (u.includes('/pinning/sync') && init?.method === 'POST') return pinSyncOkResponse();
      if (u.includes('/pinning/databases')) {
        return new Response(JSON.stringify({ ok: false, error: 'Database address not found in relay sync history' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafyNoDb',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      healthOrigin: 'http://127.0.0.1:9090',
      mediaDbAddress: '/orbitdb/zdpuMissing',
      metricsOrigin: 'http://127.0.0.1:9090',
      onState: (s) => states.push(s),
    });
    await sleep(120);
    assert.ok(!states.includes('orange'), `expected no orange, got: ${states.join(',')}`);
    ac.abort();
  });

  it('orange when mediaDB listed on relay but CID not yet on gateway', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD' && u.includes('/ipfs/bafyListed')) return { ok: false, status: 404 } as Response;
      if (u.includes('/pinning/sync') && init?.method === 'POST') return pinSyncOkResponse();
      if (u.includes('/pinning/databases')) {
        return new Response(
          JSON.stringify({ databases: [{ address: '/orbitdb/zdpuOnRelay', lastSyncedAt: '2026-01-01T00:00:00.000Z' }], total: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafyListed',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      healthOrigin: 'http://127.0.0.1:9090',
      mediaDbAddress: '/orbitdb/zdpuOnRelay',
      metricsOrigin: 'http://127.0.0.1:9090',
      mediaContentCreatedAtIso: '2020-01-01T00:00:00.000Z',
      onState: (s) => states.push(s),
    });
    await sleep(80);
    assert.ok(states.includes('orange'), `expected orange, got: ${states.join(',')}`);
    ac.abort();
  });

  it('stays yellow when DB listed but lastSyncedAt is before mediaContentCreatedAtIso', async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (init?.method === 'HEAD' && u.includes('/ipfs/bafyStale')) return { ok: false, status: 404 } as Response;
      if (u.includes('/pinning/sync') && init?.method === 'POST') return pinSyncOkResponse();
      if (u.includes('/pinning/databases')) {
        return new Response(
          JSON.stringify({ databases: [{ address: '/orbitdb/zdpuStale', lastSyncedAt: '2026-01-01T00:00:00.000Z' }], total: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };
    const states: RelayLedState[] = [];
    const ac = new AbortController();
    startRelayPinPolling({
      cid: 'bafyStale',
      pinnedBase: 'http://g/ipfs/',
      signal: ac.signal,
      healthOrigin: 'http://127.0.0.1:9090',
      mediaDbAddress: '/orbitdb/zdpuStale',
      metricsOrigin: 'http://127.0.0.1:9090',
      mediaContentCreatedAtIso: '2026-12-01T00:00:00.000Z',
      onState: (s) => states.push(s),
    });
    await sleep(100);
    assert.ok(!states.includes('orange'), `expected no orange, got: ${states.join(',')}`);
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
      healthOrigin: 'http://127.0.0.1:9090',
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

describe('startRelayDatabasePolling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('emits green with the latest lastSyncedAt when database is listed on relay', async () => {
    let listingCalls = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('/pinning/sync') && init?.method === 'POST') return pinSyncOkResponse();
      if (u.includes('/pinning/databases')) {
        listingCalls += 1;
        return new Response(
          JSON.stringify({
            databases: [
              {
                address: '/orbitdb/zdpuDbLed',
                lastSyncedAt:
                  listingCalls > 1 ? '2026-04-18T10:15:00.000Z' : '2026-04-18T10:10:00.000Z',
              },
            ],
            total: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };

    const updates: RelayDatabasePollUpdate[] = [];
    const ac = new AbortController();
    const dispose = startRelayDatabasePolling({
      dbAddress: '/orbitdb/zdpuDbLed',
      signal: ac.signal,
      metricsOrigin: 'http://127.0.0.1:9090',
      healthOrigin: 'http://127.0.0.1:9090',
      onUpdate: (update) => updates.push(update),
    });

    await sleep(120);
    assert.ok(
      updates.some(
        (update) => update.state === 'green' && update.lastSyncedAt === '2026-04-18T10:10:00.000Z',
      ),
      `expected a green update with lastSyncedAt, got: ${JSON.stringify(updates)}`,
    );

    dispose();
    ac.abort();
  });

  it('does not regress back to yellow after a database was already confirmed on relay', async () => {
    let listingCalls = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('/pinning/sync') && init?.method === 'POST') return pinSyncOkResponse();
      if (u.includes('/pinning/databases')) {
        listingCalls += 1;
        if (listingCalls === 1) {
          return new Response(
            JSON.stringify({
              databases: [{ address: '/orbitdb/zdpuSticky', lastSyncedAt: '2026-04-18T10:28:08.861Z' }],
              total: 1,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ ok: false, error: 'Database address not found in relay sync history' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('/health')) return { ok: true, status: 200 } as Response;
      return { ok: false, status: 404 } as Response;
    };

    const updates: RelayDatabasePollUpdate[] = [];
    const ac = new AbortController();
    const dispose = startRelayDatabasePolling({
      dbAddress: '/orbitdb/zdpuSticky',
      signal: ac.signal,
      metricsOrigin: 'http://127.0.0.1:9090',
      healthOrigin: 'http://127.0.0.1:9090',
      onUpdate: (update) => updates.push(update),
    });

    await sleep(1400);

    assert.ok(
      updates.some(
        (update) => update.state === 'green' && update.lastSyncedAt === '2026-04-18T10:28:08.861Z',
      ),
      `expected green confirmation, got: ${JSON.stringify(updates)}`,
    );
    assert.ok(
      !updates.some(
        (update) => update.state === 'yellow' && update.lastSyncedAt === '2026-04-18T10:28:08.861Z',
      ),
      `expected no yellow regression after confirmation, got: ${JSON.stringify(updates)}`,
    );

    dispose();
    ac.abort();
  });
});
