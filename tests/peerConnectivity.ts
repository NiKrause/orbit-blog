import { expect, type Page } from '@playwright/test';

function parsePeersHeaderCount(text: string | null): number {
  if (!text) throw new Error('peers-header has no text');
  const match = text.match(/\((\d+)\)|\b(\d+)\b/);
  if (!match) throw new Error(`unable to parse peers count from: "${text}"`);
  return Number(match[1] ?? match[2]);
}

export async function ensurePeersHeaderVisible(page: Page, timeoutMs = 30_000) {
  const peersHeader = page.getByTestId('peers-header');
  if (await peersHeader.isVisible().catch(() => false)) return;

  const menuButton = page.getByTestId('menu-button');
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }

  await expect(peersHeader).toBeVisible({ timeout: timeoutMs });
}

export async function waitForPeerCount(page: Page, minimumCount: number, timeoutMs = 90_000) {
  await expect
    .poll(
      async () => {
        await ensurePeersHeaderVisible(page, timeoutMs);
        const peersHeaderText = await page.getByTestId('peers-header').textContent();
        return parsePeersHeaderCount(peersHeaderText);
      },
      {
        timeout: timeoutMs,
        message: `wait for at least ${minimumCount} connected peer(s)`,
      },
    )
    .toBeGreaterThanOrEqual(minimumCount);
}

export async function waitForRelayPeerConnection(
  page: Page,
  relayPeerIds: string[],
  timeoutMs = 120_000,
) {
  await expect
    .poll(
      async () => {
        return page.evaluate((targetPeerIds) => {
          const globalWindow = window as typeof window & {
            libp2p?: {
              getConnections?: () => Array<{
                status?: string;
                remotePeer?: { toString?: () => string };
              }>;
            };
          };

          const connections = globalWindow.libp2p?.getConnections?.() ?? [];
          const connectedPeerIds = connections
            .filter((connection) => connection?.status === 'open')
            .map((connection) => connection?.remotePeer?.toString?.() ?? '')
            .filter(Boolean);

          return targetPeerIds.find((peerId) => connectedPeerIds.includes(peerId)) ?? '';
        }, relayPeerIds);
      },
      {
        timeout: timeoutMs,
        message: `wait for relay connection to one of: ${relayPeerIds.join(', ')}`,
      },
    )
    .not.toBe('');
}
