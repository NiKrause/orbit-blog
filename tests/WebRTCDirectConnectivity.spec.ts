import { test } from '@playwright/test';
import {
  waitForDirectWebRTCPeerConnection,
  waitForNonRelayPeerConnection,
  waitForRelayPeerConnection,
} from './peerConnectivity';
import { waitForLoadingOverlayToSettle } from './pageLoad';
import { getRelaySeedPeerIds } from './relayTestEnv';

test.describe('Remote Direct WebRTC Connectivity', () => {
  test('two browsers connect through the relay and then upgrade to direct WebRTC', async ({
    browser,
    baseURL,
  }) => {
    test.slow();

    const relayPeerIds = getRelaySeedPeerIds();
    const contextAlice = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextBob = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    pageAlice.on('console', (msg) => console.log('[alice]', msg.text()));
    pageBob.on('console', (msg) => console.log('[bob]', msg.text()));
    pageAlice.on('pageerror', (err) => console.error('[alice] PAGE ERROR:', err.message));
    pageBob.on('pageerror', (err) => console.error('[bob] PAGE ERROR:', err.message));

    await Promise.all([
      pageAlice.goto(baseURL || 'http://localhost:5173'),
      pageBob.goto(baseURL || 'http://localhost:5173'),
    ]);

    await Promise.all([
      pageAlice.evaluate(() => {
        localStorage.setItem('debug', 'libp2p:*,le-space:*');
      }),
      pageBob.evaluate(() => {
        localStorage.setItem('debug', 'libp2p:*,le-space:*');
      }),
    ]);

    await Promise.all([
      waitForLoadingOverlayToSettle(pageAlice),
      waitForLoadingOverlayToSettle(pageBob),
    ]);

    await Promise.all([
      waitForRelayPeerConnection(pageAlice, relayPeerIds),
      waitForRelayPeerConnection(pageBob, relayPeerIds),
    ]);

    await Promise.all([
      waitForNonRelayPeerConnection(pageAlice, relayPeerIds),
      waitForNonRelayPeerConnection(pageBob, relayPeerIds),
    ]);

    await Promise.all([
      waitForDirectWebRTCPeerConnection(pageAlice, relayPeerIds),
      waitForDirectWebRTCPeerConnection(pageBob, relayPeerIds),
    ]);

    await Promise.all([contextAlice.close(), contextBob.close()]);
  });
});
