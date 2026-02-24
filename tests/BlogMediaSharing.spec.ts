import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const RELAY_WS_ORIGIN = 'ws://localhost:19092';
const RELAY_PEER_ID = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE';
const BLOG_NAME = 'Alice Media Blog with Logo';
const BLOG_DESCRIPTION = 'E2E media sharing test with profile logo sync';
const LOGO_FILE_NAME = 'le-space-blog-blog-global.jpg';
const LOGO_FILE_PATH = 'media/le-space-blog-blog-global.jpg';
const POST_IMAGE_FILE_NAME = 'le-space-blog.jpg';
const POST_IMAGE_FILE_PATH = 'media/le-space-blog.jpg';

function postItemByTitle(page, title: string) {
  return page
    .locator('button')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) })
    .first();
}

async function activatePasskeyWriterMode(page) {
  const passkeyButton = page.getByTestId('passkey-toolbar-button');
  await expect(passkeyButton).toBeVisible({ timeout: 60000 });
  page.once('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') {
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });
  await passkeyButton.click();
  await expect(async () => {
    const debug = ((await page.getByTestId('can-write-debug').textContent()) || '').trim();
    expect(debug.startsWith('1|')).toBeTruthy();
  }).toPass({ timeout: 120000 });
}

test.describe('Blog media sharing between Alice and Bob', () => {
  test('Offline source: Bob still loads logo and post media via relay pinning', async ({ browser }) => {
    test.setTimeout(240000);
    const expectedLogoSha256 = createHash('sha256').update(await readFile(LOGO_FILE_PATH)).digest('hex');
    const offlineBlogName = 'Relay Offline Media Test';
    const offlineBlogDescription = 'Bob should see metadata even if Alice is offline';

    const contextAlice = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          `--unsafely-treat-insecure-origin-as-secure=${RELAY_WS_ORIGIN}`,
          '--disable-web-security'
        ]
      }
    });
    await contextAlice.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    const pageAlice = await contextAlice.newPage();

    await pageAlice.goto('http://localhost:5183');
    await expect(pageAlice.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(pageAlice.getByTestId('blog-name')).toBeVisible({ timeout: 120000 });

    await pageAlice.getByTestId('settings-header').click();
    const closeSidebarOverlay = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay.isVisible()) {
      await closeSidebarOverlay.click();
    }

    await pageAlice.getByTestId('blog-settings-accordion').click();
    await pageAlice.getByTestId('blog-name-input').fill(offlineBlogName);
    await pageAlice.getByTestId('blog-name-input').press('Tab');
    await pageAlice.getByTestId('blog-description-input').fill(offlineBlogDescription);
    await pageAlice.getByTestId('blog-description-input').press('Tab');
    await expect
      .poll(async () => {
        return await pageAlice.evaluate(async () => {
          const db = (window as any).settingsDB;
          if (!db?.get) return { name: '', description: '' };
          const name = await db.get('blogName');
          const description = await db.get('blogDescription');
          const n = name?.value?.value ?? name?.value ?? '';
          const d = description?.value?.value ?? description?.value ?? '';
          return { name: String(n), description: String(d) };
        });
      }, { timeout: 60000 })
      .toEqual({ name: offlineBlogName, description: offlineBlogDescription });
    await activatePasskeyWriterMode(pageAlice);

    const profilePictureInput = pageAlice.locator('input#profile-picture');
    await profilePictureInput.setInputFiles(LOGO_FILE_PATH);
    await expect
      .poll(async () => {
        return await pageAlice.evaluate(async () => {
          const db = (window as any).settingsDB;
          if (!db?.get) return '';
          const entry = await db.get('profilePicture');
          const raw = entry?.value;
          if (typeof raw === 'string') return raw;
          if (raw && typeof raw.value === 'string') return raw.value;
          return '';
        });
      }, { timeout: 60000 })
      .toMatch(/^[a-zA-Z0-9]+$/);

    await pageAlice.getByTestId('categories').click();
    while (await pageAlice.getByTestId(/^remove-category-button-/).count() > 0) {
      await pageAlice.getByTestId(/^remove-category-button-/).first().click();
    }
    await pageAlice.getByTestId('new-category-input').fill('General');
    await pageAlice.getByTestId('add-category-button').click();

    const postTitle = `RelayOffline-${Date.now()}`;
    await pageAlice.getByTestId('post-title-input').fill(postTitle);
    await pageAlice.getByTestId('post-content-input').fill('Offline media relay limitation check.');
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.getByTestId('post-content-input').click();

    await pageAlice
      .getByTestId('post-form')
      .getByRole('button', { name: /add media|hide media library/i })
      .first()
      .click();

    const fileInput = pageAlice.locator('input#file-input');
    await fileInput.setInputFiles(POST_IMAGE_FILE_PATH);
    const mediaItem = pageAlice.getByLabel(`Select ${POST_IMAGE_FILE_NAME}`);
    await expect(mediaItem).toBeVisible({ timeout: 60000 });
    await mediaItem.click();
    await expect(pageAlice.getByTestId('post-form').locator(`img[alt="${POST_IMAGE_FILE_NAME}"]`)).toBeVisible({ timeout: 60000 });

    await pageAlice.locator('#publish').check();
    await pageAlice.getByTestId('publish-post-button').click();
    const alicePostTitle = postItemByTitle(pageAlice, postTitle);
    await expect(alicePostTitle).toBeVisible({ timeout: 60000 });

    await pageAlice.getByTestId('menu-button').click();
    await pageAlice.getByTestId('blogs-header').click();
    await pageAlice.getByTestId('db-manager-container').waitFor({ state: 'visible' });
    const closeSidebarOverlay2 = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay2.isVisible()) {
      await closeSidebarOverlay2.click();
    }
    const aliceBlogAddress = await pageAlice.getByTestId('db-address-input').inputValue();
    expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);

    // Alice goes offline; Bob can only use relay/pinned data.
    await contextAlice.close();

    const contextBob = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          `--unsafely-treat-insecure-origin-as-secure=${RELAY_WS_ORIGIN}`,
          '--disable-web-security'
        ]
      }
    });
    // Ensure fallback public gateways cannot mask missing p2p media.
    await contextBob.route('**://dweb.link/**', (route) => route.abort());
    await contextBob.route('**://ipfs.io/**', (route) => route.abort());
    const publicGatewayRequests: string[] = [];

    const pageBob = await contextBob.newPage();
    pageBob.on('request', (request) => {
      const url = request.url();
      const looksLikePublicGateway =
        (url.startsWith('http://') || url.startsWith('https://')) &&
        (
          url.includes('/ipfs/') ||
          url.includes('.ipfs.') ||
          url.includes('dweb.link') ||
          url.includes('ipfs.io') ||
          url.includes('4everland.io') ||
          url.includes('w3s.link')
        ) &&
        !url.includes('localhost') &&
        !url.includes('127.0.0.1');

      if (looksLikePublicGateway) {
        publicGatewayRequests.push(url);
      }
    });

    await pageBob.goto(`http://localhost:5183/#${aliceBlogAddress}`);
    await expect(pageBob.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect
      .poll(async () => {
        return await pageBob.evaluate(async () => {
          const libp2p = (window as any).libp2p ?? (window as any).helia?.libp2p;
          if (!libp2p) return 0;
          const peers = await libp2p.getPeers?.();
          return Array.isArray(peers) ? peers.length : 0;
        });
      }, { timeout: 120000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        return await pageBob.evaluate(async (relayPeerId) => {
          const libp2p = (window as any).libp2p ?? (window as any).helia?.libp2p;
          if (!libp2p) return false;
          const peers = await libp2p.getPeers?.();
          const peerIds = Array.isArray(peers) ? peers.map((p: any) => p?.toString?.() ?? String(p)) : [];
          const connections = libp2p.getConnections?.() ?? [];
          const connectionPeerIds = connections.map((c: any) => c?.remotePeer?.toString?.() ?? '');
          return peerIds.includes(relayPeerId) || connectionPeerIds.includes(relayPeerId);
        }, RELAY_PEER_ID);
      }, { timeout: 120000 })
      .toBeTruthy();
    await expect
      .poll(async () => {
        return await pageBob.evaluate(async (address) => {
          const db = (window as any).settingsDB;
          if (!db?.get) return { address: '', name: '' };
          const openedAddress = db?.address?.toString?.() ?? '';
          const name = await db.get('blogName');
          const n = name?.value?.value ?? name?.value ?? '';
          return { address: openedAddress, name: String(n) };
        }, aliceBlogAddress);
      }, { timeout: 120000 })
      .toEqual({ address: aliceBlogAddress, name: offlineBlogName });

    // OrbitDB metadata is visible (relay has DB/log data).
    await expect(pageBob.getByTestId('blog-name')).toHaveText(offlineBlogName, { timeout: 120000 });
    const bobPostTitle = postItemByTitle(pageBob, postTitle);
    await expect(bobPostTitle).toBeVisible({ timeout: 120000 });
    await bobPostTitle.first().click();

    // With relay media pinning, Bob should still load media bytes while Alice is offline.
    await expect
      .poll(async () => {
        return await pageBob.evaluate(async (expectedHash) => {
          const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
          for (const image of images) {
            if (!image.src) continue;
            if (!/^(blob:|https?:\/\/|ipfs:)/.test(image.src)) continue;
            try {
              const response = await fetch(image.src);
              const buffer = await response.arrayBuffer();
              const digest = await crypto.subtle.digest('SHA-256', buffer);
              const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
              if (hash === expectedHash) return true;
            } catch {
              // Ignore transient fetch/decode failures while blobs are still resolving.
            }
          }
          return false;
        }, expectedLogoSha256);
      }, { timeout: 120000 })
      .toBeTruthy();
    await expect
      .poll(async () => {
        return await pageBob.evaluate(() => {
          const img = document.querySelector('[data-testid="blog-post"] img[alt="Media"]') as HTMLImageElement | null;
          if (!img) return false;
          return img.src.startsWith('blob:');
        });
      }, { timeout: 120000 })
      .toBeTruthy();
    expect(publicGatewayRequests, `Bob should not request public IPFS gateways: ${publicGatewayRequests.join(', ')}`).toEqual([]);

    await contextBob.close();
  });

  test('Alice uploads image and sees it in her published post after reload', async ({ browser }) => {
    test.setTimeout(180000);

    const contextAlice = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          `--unsafely-treat-insecure-origin-as-secure=${RELAY_WS_ORIGIN}`,
          '--disable-web-security'
        ]
      }
    });
    await contextAlice.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    const pageAlice = await contextAlice.newPage();

    await pageAlice.goto('http://localhost:5183');
    await expect(pageAlice.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(pageAlice.getByTestId('blog-name')).toBeVisible({ timeout: 120000 });

    await pageAlice.getByTestId('settings-header').click();
    const closeSidebarOverlay = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay.isVisible()) {
      await closeSidebarOverlay.click();
    }

    await pageAlice.getByTestId('blog-settings-accordion').click();
    await pageAlice.getByTestId('blog-name-input').fill('Alice Local Media Validation Blog');
    await pageAlice.getByTestId('blog-description-input').fill('Validate local media persistence on Alice side');
    await activatePasskeyWriterMode(pageAlice);

    await pageAlice.getByTestId('categories').click();
    while (await pageAlice.getByTestId(/^remove-category-button-/).count() > 0) {
      await pageAlice.getByTestId(/^remove-category-button-/).first().click();
    }
    await pageAlice.getByTestId('new-category-input').fill('General');
    await pageAlice.getByTestId('add-category-button').click();

    await expect(pageAlice.getByTestId('post-form')).toBeVisible({ timeout: 60000 });

    const postTitle = `AliceLocal-${Date.now()}`;
    await pageAlice.getByTestId('post-title-input').fill(postTitle);
    await pageAlice.getByTestId('post-content-input').fill('Alice post with embedded image.');
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.getByTestId('post-content-input').click();

    await pageAlice
      .getByTestId('post-form')
      .getByRole('button', { name: /add media|hide media library/i })
      .first()
      .click();

    const fileInput = pageAlice.locator('input#file-input');
    await fileInput.setInputFiles(POST_IMAGE_FILE_PATH);

    const mediaItem = pageAlice.getByLabel(`Select ${POST_IMAGE_FILE_NAME}`);
    await expect(mediaItem).toBeVisible({ timeout: 60000 });
    await mediaItem.click();

    await expect(pageAlice.getByTestId('post-form').locator(`img[alt="${POST_IMAGE_FILE_NAME}"]`)).toBeVisible({ timeout: 60000 });

    const postContentBeforePublish = await pageAlice.getByTestId('post-content-input').inputValue();
    expect(postContentBeforePublish).toContain('ipfs://');
    expect(postContentBeforePublish).toContain('![Media]');

    await pageAlice.locator('#publish').check();
    await pageAlice.getByTestId('publish-post-button').click();

    const alicePostTitle = postItemByTitle(pageAlice, postTitle);
    await expect(alicePostTitle).toBeVisible({ timeout: 60000 });
    await alicePostTitle.first().click();

    const aliceBlogPostImage = pageAlice.getByTestId('blog-post').locator('img[alt="Media"]');
    await expect(aliceBlogPostImage).toBeVisible({ timeout: 120000 });

    // Persistence check: reload the same blog address and assert the image remains rendered.
    const aliceBlogAddress = await pageAlice.evaluate(() => {
      const db = (window as any).settingsDB;
      return db?.address?.toString?.() || '';
    });
    expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);

    await pageAlice.goto(`http://localhost:5183/#${aliceBlogAddress}`);
    await expect(pageAlice.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    const alicePostTitleAfterReload = postItemByTitle(pageAlice, postTitle);
    await expect(alicePostTitleAfterReload).toBeVisible({ timeout: 120000 });
    await alicePostTitleAfterReload.first().click();
    await expect(pageAlice.getByTestId('blog-post').locator('img[alt="Media"]')).toBeVisible({ timeout: 120000 });

    await contextAlice.close();
  });

  test('Alice uploads image to a post and Bob sees it', async ({ browser }) => {
    test.setTimeout(240000);

    const expectedLogoSha256 = createHash('sha256').update(await readFile(LOGO_FILE_PATH)).digest('hex');

    const contextAlice = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          `--unsafely-treat-insecure-origin-as-secure=${RELAY_WS_ORIGIN}`,
          '--disable-web-security'
        ]
      }
    });
    await contextAlice.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    const contextBob = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          `--unsafely-treat-insecure-origin-as-secure=${RELAY_WS_ORIGIN}`,
          '--disable-web-security'
        ]
      }
    });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    await pageAlice.goto('http://localhost:5183');
    await expect(pageAlice.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(pageAlice.getByTestId('blog-name')).toBeVisible({ timeout: 120000 });

    await pageAlice.getByTestId('settings-header').click();
    const closeSidebarOverlay = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay.isVisible()) {
      await closeSidebarOverlay.click();
    }

    await pageAlice.getByTestId('blog-settings-accordion').click();
    await pageAlice.getByTestId('blog-name-input').fill(BLOG_NAME);
    await pageAlice.getByTestId('blog-description-input').fill(BLOG_DESCRIPTION);
    await activatePasskeyWriterMode(pageAlice);

    const profilePictureInput = pageAlice.locator('input#profile-picture');
    await profilePictureInput.setInputFiles(LOGO_FILE_PATH);

    await expect
      .poll(async () => {
        return await pageAlice.evaluate(async () => {
          const db = (window as any).settingsDB;
          if (!db?.get) return '';
          const entry = await db.get('profilePicture');
          const raw = entry?.value;
          if (typeof raw === 'string') return raw;
          if (raw && typeof raw.value === 'string') return raw.value;
          return '';
        });
      }, { timeout: 60000 })
      .toMatch(/^[a-zA-Z0-9]+$/);

    await expect
      .poll(async () => {
        return await pageAlice.evaluate(async (logoName) => {
          const db = (window as any).mediaDB;
          if (!db?.all) return false;
          const all = await db.all();
          return all.some((entry: any) => entry?.value?.name === logoName);
        }, LOGO_FILE_NAME);
      }, { timeout: 60000 })
      .toBeTruthy();

    await expect(pageAlice.locator('header img[alt="Profile"]').first()).toBeVisible({ timeout: 120000 });

    await pageAlice.getByTestId('categories').click();
    while (await pageAlice.getByTestId(/^remove-category-button-/).count() > 0) {
      await pageAlice.getByTestId(/^remove-category-button-/).first().click();
    }
    await pageAlice.getByTestId('new-category-input').fill('General');
    await pageAlice.getByTestId('add-category-button').click();

    await expect(pageAlice.getByTestId('post-form')).toBeVisible({ timeout: 60000 });

    await pageAlice.getByTestId('post-title-input').fill('Alice image post');
    await pageAlice.getByTestId('post-content-input').fill('Alice post with embedded image.');
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.getByTestId('post-content-input').click();

    await pageAlice
      .getByTestId('post-form')
      .getByRole('button', { name: /add media|hide media library/i })
      .first()
      .click();

    const fileInput = pageAlice.locator('input#file-input');
    await fileInput.setInputFiles(POST_IMAGE_FILE_PATH);

    const mediaItem = pageAlice.getByLabel(`Select ${POST_IMAGE_FILE_NAME}`);
    await expect(mediaItem).toBeVisible({ timeout: 60000 });
    await mediaItem.click();

    await expect(pageAlice.getByTestId('post-form').locator(`img[alt="${POST_IMAGE_FILE_NAME}"]`)).toBeVisible({ timeout: 60000 });
    const contentValue = await pageAlice.getByTestId('post-content-input').inputValue();
    if (!contentValue.trim()) {
      await pageAlice.getByTestId('post-content-input').fill('Alice post with embedded image.');
    }

    await pageAlice.locator('#publish').check();
    await pageAlice.getByTestId('publish-post-button').click();

    const alicePostTitle = postItemByTitle(pageAlice, 'Alice image post');
    await expect(alicePostTitle).toBeVisible({ timeout: 60000 });
    await alicePostTitle.first().click();
    await expect(pageAlice.getByTestId('blog-post').locator('img[alt="Media"]')).toBeVisible({ timeout: 120000 });

    await expect
      .poll(async () => {
        return await pageAlice.evaluate(async () => {
          const db = (window as any).settingsDB;
          if (!db?.get) return '';
          const entry = await db.get('mediaDBAddress');
          return entry?.value?.value || '';
        });
      }, { timeout: 60000 })
      .toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);

    await pageAlice.getByTestId('menu-button').click();
    await pageAlice.getByTestId('blogs-header').click();
    await pageAlice.getByTestId('db-manager-container').waitFor({ state: 'visible' });
    const closeSidebarOverlay2 = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay2.isVisible()) {
      await closeSidebarOverlay2.click();
    }

    const aliceBlogAddress = await pageAlice.getByTestId('db-address-input').inputValue();
    expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);

    await pageBob.goto(`http://localhost:5183/#${aliceBlogAddress}`);
    await expect(pageBob.getByTestId('loading-overlay')).toBeVisible({ timeout: 30000 });
    await expect(pageBob.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(pageBob.getByTestId('blog-name')).toHaveText(BLOG_NAME, { timeout: 120000 });
    await expect(pageBob.getByTestId('blog-description')).toHaveText(BLOG_DESCRIPTION, { timeout: 120000 });

    const bobProfileImage = pageBob.locator('header img[alt="Profile"]').first();
    await expect(bobProfileImage).toBeVisible({ timeout: 120000 });
    await expect(bobProfileImage).toHaveAttribute('src', /^(blob:|https?:\/\/|ipfs:)/);
    const bobProfileImageSha256 = await pageBob.evaluate(async () => {
      const image = document.querySelector('header img[alt="Profile"]') as HTMLImageElement | null;
      if (!image?.src) return '';
      const response = await fetch(image.src);
      const buffer = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    });
    expect(bobProfileImageSha256).toBe(expectedLogoSha256);

    const bobPostTitle = postItemByTitle(pageBob, 'Alice image post');
    await expect(bobPostTitle).toBeVisible({ timeout: 120000 });
    await bobPostTitle.first().click();

    await expect(pageBob.getByTestId('blog-post').locator('img[alt="Media"]')).toBeVisible({ timeout: 120000 });

    await contextAlice.close();
    await contextBob.close();
  });
});
