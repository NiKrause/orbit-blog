import { test, expect, type Page } from '@playwright/test'

function parsePeersHeaderCount(text: string | null): number {
  if (!text) throw new Error('peers-header has no text')
  const m = text.match(/\((\d+)\)/)
  if (!m) throw new Error(`unable to parse peers count from: "${text}"`)
  return Number(m[1])
}

async function expectPeerCount(page: Page, expected: number, timeoutMs = 90_000) {
  await expect(async () => {
    const headerText = await page.getByTestId('peers-header').textContent()
    const count = parsePeersHeaderCount(headerText)
    expect(count).toBe(expected)
  }).toPass({ timeout: timeoutMs })
}

async function expectHasWebRTCTransport(page: Page, timeoutMs = 90_000) {
  // Expand peers list and assert at least one connection is WebRTC (i.e. browser<->browser).
  await page.getByTestId('peers-header').click()
  await expect(page.getByTestId('peers-list')).toContainText('WebRTC', { timeout: timeoutMs })
}

test.describe('Basic WebRTC Connectivity', () => {
  test('two browsers connect and each sees relay + peer (2 peers) with WebRTC', async ({ browser, baseURL }) => {
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
    await Promise.all([expectPeerCount(pageA, 2), expectPeerCount(pageB, 2)])

    // And at least one of the connections should be a WebRTC transport (peer-to-peer).
    await Promise.all([expectHasWebRTCTransport(pageA), expectHasWebRTCTransport(pageB)])

    await Promise.all([ctxA.close(), ctxB.close()])
  })
})

