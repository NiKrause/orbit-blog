import { test } from '@playwright/test';
import { waitForDirectWebRTCPeerConnection, waitForPeerCount } from './peerConnectivity';

test.describe('Basic WebRTC Connectivity', () => {
  test.skip('two browsers connect and each sees relay + peer (2 peers) with WebRTC', async ({ browser, baseURL }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    pageA.on('pageerror', (err) => console.error('[A] PAGE ERROR:', err))
    pageB.on('pageerror', (err) => console.error('[B] PAGE ERROR:', err))

    await Promise.all([
      pageA.goto(baseURL || 'http://localhost:5173'),
      pageB.goto(baseURL || 'http://localhost:5173'),
    ])

    // Both should converge to exactly 2 connected peers:
    // 1. the local relay
    // 2. the other browser peer
    await Promise.all([waitForPeerCount(pageA, 2), waitForPeerCount(pageB, 2)])

    // And at least one non-relayed peer connection should upgrade to direct WebRTC.
    await Promise.all([
      waitForDirectWebRTCPeerConnection(pageA),
      waitForDirectWebRTCPeerConnection(pageB)
    ])

    await Promise.all([ctxA.close(), ctxB.close()])
  })
})
