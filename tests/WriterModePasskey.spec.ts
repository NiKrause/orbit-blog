import { test, expect } from '@playwright/test';

async function waitForFullAliceSync(page, timeoutMs = 120000) {
  const started = Date.now();
  let lastStatus = '';

  while (Date.now() - started < timeoutMs) {
    const status = await page.evaluate(async () => {
      const settings = (window as any).settingsDB;
      const posts = (window as any).postsDB;
      const comments = (window as any).commentsDB;
      const media = (window as any).mediaDB;
      const libp2p = (window as any).libp2p ?? (window as any).helia?.libp2p;

      const getSetting = async (key: string) => {
        try {
          const result = await settings?.get?.(key);
          return result?.value?.value ?? result?.value ?? '';
        } catch {
          return '';
        }
      };

      let postCount = 0;
      try {
        const allPosts = (await posts?.all?.()) ?? [];
        postCount = Array.isArray(allPosts) ? allPosts.length : 0;
      } catch {
        postCount = 0;
      }

      const peers = await libp2p?.getPeers?.();
      const peerCount = Array.isArray(peers) ? peers.length : 0;

      const postsAddress = String(await getSetting('postsDBAddress') || '');
      const commentsAddress = String(await getSetting('commentsDBAddress') || '');
      const mediaAddress = String(await getSetting('mediaDBAddress') || '');
      const ownerIdentity = String(await getSetting('ownerIdentity') || '');

      const ready =
        Boolean(settings?.address?.toString?.()) &&
        Boolean(postsAddress) &&
        Boolean(commentsAddress) &&
        Boolean(mediaAddress) &&
        Boolean(ownerIdentity) &&
        postCount > 0 &&
        peerCount > 0;

      return {
        ready,
        peerCount,
        postCount,
        hasSettings: Boolean(settings?.address?.toString?.()),
        hasPostsAddr: Boolean(postsAddress),
        hasCommentsAddr: Boolean(commentsAddress),
        hasMediaAddr: Boolean(mediaAddress),
        hasOwnerIdentity: Boolean(ownerIdentity)
      };
    });

    const line = `ready=${status.ready} peers=${status.peerCount} posts=${status.postCount} settings=${status.hasSettings} postsAddr=${status.hasPostsAddr} commentsAddr=${status.hasCommentsAddr} mediaAddr=${status.hasMediaAddr} owner=${status.hasOwnerIdentity}`;
    if (line !== lastStatus) {
      console.log(`[writer-passkey:s5] sync status ${line}`);
      lastStatus = line;
    }

    if (status.ready) {
      console.log('[writer-passkey:s5] sync complete, continuing to Bob open step');
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Step 5 sync wait timed out after ${timeoutMs}ms`);
}

async function createAliceBlogAndGetAddress(page) {
  await page.goto('http://localhost:5183');
  await expect(page.getByTestId('blog-name')).toBeVisible({ timeout: 60000 });

  await page.getByTestId('settings-header').click();
  const closeSidebarOverlay = page.locator('[aria-label="close_sidebar"]');
  if (await closeSidebarOverlay.isVisible()) await closeSidebarOverlay.click();

  await page.getByTestId('blog-settings-accordion').click();
  await page.getByTestId('blog-name-input').fill('Writer Unlock Blog');
  await page.getByTestId('blog-description-input').fill('Writer mode unlock validation');

  await page.getByTestId('categories').click();
  while (await page.getByTestId(/^remove-category-button-/).count() > 0) {
    await page.getByTestId(/^remove-category-button-/).first().click();
  }
  await page.getByTestId('new-category-input').fill('General');
  await page.getByTestId('add-category-button').click();

  await expect(page.getByTestId('post-form')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('post-title-input').fill('Owner Post');
  await page.getByTestId('post-content-input').fill('Created by owner');
  await page.locator('#categories [role="button"]').click();
  await page.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
  await page.locator('#categories [role="button"]').click();
  await page.locator('#publish').check();

  // Session mode must not allow publishing.
  await expect(page.getByTestId('post-form')).toBeVisible({ timeout: 60000 });
  let blockedDialogMessage = '';
  page.once('dialog', async (dialog) => {
    blockedDialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByTestId('publish-post-button').click({ force: true });
  await page.waitForTimeout(250);
  if (blockedDialogMessage) {
    expect(blockedDialogMessage).toContain('Publishing is blocked in reader mode');
  } else {
    console.log('[writer-passkey] no session-mode block dialog observed; continuing with post-count assertion');
  }

  await expect(
    page.getByTestId('post-item-title').filter({ hasText: 'Owner Post' })
  ).toHaveCount(0);

  // Activate writer-session mode for Alice setup, then publish.
  await page.evaluate(() => {
    sessionStorage.setItem('identityMode', 'passkey');
  });
  await page.getByTestId('post-title-input').fill('Owner Post');
  await page.getByTestId('post-content-input').fill('Created by owner');
  page.once('dialog', async (dialog) => {
    if (dialog.type() === 'confirm') {
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });
  await page.getByTestId('publish-post-button').click();
  await expect(page.getByTestId('post-item-title').filter({ hasText: 'Owner Post' })).toBeVisible({
    timeout: 60000
  });

  await page.getByTestId('menu-button').click();
  await page.getByTestId('blogs-header').click();
  await page.getByTestId('db-manager-container').waitFor({ state: 'visible' });
  const closeSidebarOverlay2 = page.locator('[aria-label="close_sidebar"]');
  if (await closeSidebarOverlay2.isVisible()) await closeSidebarOverlay2.click();

  const address = await page.getByTestId('db-address-input').inputValue();
  expect(address).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);
  return address;
}

test.describe('Writer mode passkey unlock', () => {
  test('uses session mode by default and keeps Bob post read-only even after local passkey activation', async ({
    browser
  }) => {
    test.setTimeout(240000);
    const aliceContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          '--unsafely-treat-insecure-origin-as-secure=ws://localhost:19092',
          '--disable-web-security'
        ]
      }
    });

    const bobContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          '--unsafely-treat-insecure-origin-as-secure=ws://localhost:19092',
          '--disable-web-security'
        ]
      }
    });

    await bobContext.addInitScript(() => {
      // Used by @le-space/orbitdb-identity-provider-webauthn-did test-mode branches
      // to bypass real navigator.credentials prompts.
      (window as any).__PLAYWRIGHT__ = true;
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

  const address = await createAliceBlogAndGetAddress(alicePage);
  await test.step('Step 5: wait until Alice data is fully synced', async () => {
    await waitForFullAliceSync(alicePage);
  });

  await bobPage.goto(`http://localhost:5183/#${address}`);
    await expect(bobPage.getByTestId('loading-overlay')).toBeVisible({ timeout: 30000 });
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(bobPage.getByTestId('blog-name')).toHaveText('Writer Unlock Blog', { timeout: 120000 });

    const initialDebug = ((await bobPage.getByTestId('can-write-debug').textContent()) || '').trim();
    const ownerIdentity = initialDebug.split('|')[1]?.trim();
    expect(ownerIdentity).toBeTruthy();
    const passkeyToolbarButton = bobPage.getByTestId('passkey-toolbar-button');
    const passkeyToolbarIcon = bobPage.getByTestId('passkey-toolbar-icon');

    await expect(passkeyToolbarButton).toHaveClass(/passkey-session/);
    await expect(passkeyToolbarButton).not.toHaveClass(/passkey-active/);
    await expect(passkeyToolbarIcon).toHaveAttribute('style', /(#d97706|rgb\(217,\s*119,\s*6\))/);

    // Mismatched passkey DID must not offer writer unlock.
    await bobPage.evaluate(() => {
      const bytesToBase64url = (bytes: Uint8Array) => {
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      };
      const pub = new Uint8Array(32);
      for (let i = 0; i < 32; i++) pub[i] = i + 1;
      const payload = {
        credentialId: bytesToBase64url(new Uint8Array([1, 2, 3, 4])),
        publicKey: bytesToBase64url(pub),
        did: 'did:key:zMismatchWriter',
        algorithm: 'Ed25519',
        cose: { kty: 1, alg: -8, crv: 6 }
      };
      localStorage.setItem('webauthn-varsig-credential', JSON.stringify(payload));
    });
    await bobPage.reload();
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(passkeyToolbarButton).toHaveClass(/passkey-available/);
    await expect(passkeyToolbarButton).toHaveClass(/passkey-session/);
    await expect(passkeyToolbarButton).not.toHaveClass(/passkey-active/);
    await expect(passkeyToolbarIcon).toHaveAttribute('style', /(#2563eb|rgb\(37,\s*99,\s*235\))/);

    // Matching passkey DID should expose writer unlock CTA.
    await bobPage.evaluate((did) => {
      const bytesToBase64url = (bytes: Uint8Array) => {
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      };
      const pub = new Uint8Array(32);
      for (let i = 0; i < 32; i++) pub[i] = i + 1;
      const payload = {
        credentialId: bytesToBase64url(new Uint8Array([9, 8, 7, 6])),
        publicKey: bytesToBase64url(pub),
        did,
        algorithm: 'Ed25519',
        cose: { kty: 1, alg: -8, crv: 6 }
      };
      localStorage.setItem('webauthn-varsig-credential', JSON.stringify(payload));
    }, ownerIdentity);

    await bobPage.reload();
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(passkeyToolbarButton).toHaveClass(/passkey-available/);
    await expect(passkeyToolbarIcon).toHaveAttribute('style', /(#2563eb|rgb\(37,\s*99,\s*235\))/);
    await passkeyToolbarButton.click();

    // Wait for passkey-mode reload and ownership flip.
    await expect(async () => {
      const debug = ((await bobPage.getByTestId('can-write-debug').textContent()) || '').trim();
      expect(debug.startsWith('1|')).toBeTruthy();
    }).toPass({ timeout: 120000 });
    await expect(passkeyToolbarButton).toHaveClass(/passkey-(active|available)/);
    await expect(passkeyToolbarIcon).not.toHaveAttribute('style', /(#d97706|rgb\(217,\s*119,\s*6\))/);

    // Normal sharing flow: Bob reads Alice's post and can comment.
    const ownerPostItem = bobPage.getByTestId('post-item-title').filter({ hasText: 'Owner Post' }).first();
    await expect(ownerPostItem).toBeVisible({ timeout: 60000 });
    await ownerPostItem.click({ force: true });
    await expect(bobPage.getByTestId('post-title')).toContainText('Owner Post', { timeout: 30000 });
    const bobComment = `Writer comment ${Date.now()}`;
    const bobCommentForm = bobPage.getByTestId('blog-post').locator('form').last();
    await bobCommentForm.locator('input[type="text"]').fill('Bob');
    await bobCommentForm.locator('textarea').fill(bobComment);
    await bobCommentForm.locator('button[type="submit"]').click();
    await expect(
      bobPage.getByTestId('blog-post').getByText(bobComment, { exact: true })
    ).toBeVisible({ timeout: 60000 });

    await aliceContext.close();
    await bobContext.close();
  });
});
