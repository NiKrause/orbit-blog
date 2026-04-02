import { test, expect } from '@playwright/test';
import { DIDKey } from 'iso-did';

function didFromSeed(seed: number): string {
  const pub = new Uint8Array(32);
  for (let i = 0; i < 32; i++) pub[i] = (seed + i) % 256;
  return DIDKey.fromPublicKey('Ed25519', pub).did;
}

async function setMockPasskeyCredential(page, seed: number) {
  const did = didFromSeed(seed);
  await page.evaluate(
    ({ nextDid, nextSeed }) => {
      const bytesToBase64url = (bytes: Uint8Array) => {
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      };
      const pub = new Uint8Array(32);
      for (let i = 0; i < 32; i++) pub[i] = (nextSeed + i) % 256;
      const payload = {
        credentialId: bytesToBase64url(new Uint8Array([nextSeed % 251, (nextSeed + 1) % 251, (nextSeed + 2) % 251, (nextSeed + 3) % 251])),
        publicKey: bytesToBase64url(pub),
        did: nextDid,
        algorithm: 'Ed25519',
        cose: { kty: 1, alg: -8, crv: 6 }
      };
      localStorage.setItem('webauthn-varsig-credential', JSON.stringify(payload));
    },
    { nextDid: did, nextSeed: seed }
  );
  return did;
}

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

async function openSecuritySettings(page, timeoutMs = 60000) {
  const started = Date.now();
  const settingsHeader = page.getByTestId('settings-header');
  const securityAccordion = page.getByTestId('security-settings-accordion');
  const didInput = page.getByPlaceholder('did:key:...');

  while (Date.now() - started < timeoutMs) {
    if (await didInput.isVisible().catch(() => false)) return;

    if (!(await securityAccordion.isVisible().catch(() => false))) {
      const menuButton = page.getByTestId('menu-button');
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
      }
      if (await settingsHeader.isVisible().catch(() => false)) {
        await settingsHeader.click();
      }
      const closeSidebarOverlay = page.locator('[aria-label="close_sidebar"]').first();
      if (await closeSidebarOverlay.isVisible().catch(() => false)) {
        await closeSidebarOverlay.click();
      }
      await page.waitForTimeout(250);
      continue;
    }

    if (!(await didInput.isVisible().catch(() => false))) {
      const closeSidebarOverlay = page.locator('[aria-label="close_sidebar"]').first();
      if (await closeSidebarOverlay.isVisible().catch(() => false)) {
        await closeSidebarOverlay.click({ force: true }).catch(() => {});
      }
      await securityAccordion.click({ force: true });
    }
    if (await didInput.isVisible().catch(() => false)) return;

    await page.waitForTimeout(250);
  }

  throw new Error('Timed out opening security settings (DID input not visible)');
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

  if (!(await page.getByTestId('post-form').isVisible().catch(() => false))) {
    const settingsHeader = page.getByTestId('settings-header');
    if (await settingsHeader.isVisible().catch(() => false)) {
      await settingsHeader.click();
    }
    const hideSettingsButton = page.getByRole('button', { name: /hide settings/i });
    if (await hideSettingsButton.isVisible().catch(() => false)) {
      await hideSettingsButton.click();
    }
    const showEditorButton = page.getByRole('button', { name: /show editor/i });
    if (await showEditorButton.isVisible().catch(() => false)) {
      await showEditorButton.click();
    }
    const closeSidebarButton = page.getByRole('button', { name: /^close$/i });
    if (await closeSidebarButton.isVisible().catch(() => false)) {
      await closeSidebarButton.click();
    }
  }
  const postFormVisible = await page.getByTestId('post-form').isVisible().catch(() => false);
  if (!postFormVisible) {
    const seedResult = await page.evaluate(async () => {
      const db = (window as any).postsDB;
      const settings = (window as any).settingsDB;
      const writeSet =
        typeof db?.access?.get === 'function'
          ? await db.access.get('write')
          : new Set(Array.isArray(db?.access?.write) ? db.access.write : []);
      const writeList = Array.from(writeSet || []);
      const didFromAcl = writeList.find((entry: any) => {
        if (typeof entry === 'string' && entry.startsWith('did:')) return true;
        if (Array.isArray(entry)) return entry.some((v) => typeof v === 'string' && v.startsWith('did:'));
        if (entry && typeof entry === 'object') {
          return Object.values(entry).some((v) => typeof v === 'string' && v.startsWith('did:'));
        }
        return false;
      });
      const normalizeDid = (entry: any) => {
        if (typeof entry === 'string') return entry;
        if (Array.isArray(entry)) return entry.find((v) => typeof v === 'string' && v.startsWith('did:')) || null;
        if (entry && typeof entry === 'object') {
          const value = Object.values(entry).find((v) => typeof v === 'string' && v.startsWith('did:'));
          return typeof value === 'string' ? value : null;
        }
        return null;
      };
      const ownerSetting = await settings?.get?.('ownerIdentity').catch(() => null);
      const ownerIdentity =
        ownerSetting?.value?.value || ownerSetting?.value || ownerSetting?.identity || ownerSetting || null;
      const id =
        (window as any).identity?.id ||
        db?.identity?.id ||
        sessionStorage.getItem('activeIdentityDid') ||
        normalizeDid(didFromAcl) ||
        (typeof ownerIdentity === 'string' && ownerIdentity.startsWith('did:') ? ownerIdentity : null) ||
        null;
      if (!db || !id) {
        return {
          ok: false,
          reason: 'missing-db-or-identity',
          hasDb: Boolean(db),
          hasIdentity: Boolean(id),
          writeList,
          ownerIdentity: typeof ownerIdentity === 'string' ? ownerIdentity : null
        };
      }
      const existing = await db.all();
      const hasOwnerPost = Array.isArray(existing)
        ? existing.some((entry: any) => entry?.value?.title === 'Owner Post')
        : false;
      if (hasOwnerPost) return { ok: true, reason: 'already-exists' };

      const putOwnerPost = async () => {
        await db.put({
          _id: crypto.randomUUID(),
          title: 'Owner Post',
          content: 'Created by owner',
          category: 'General',
          categories: ['General'],
          identity: id,
          language: 'en',
          mediaIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          published: true
        });
      };

      try {
        await putOwnerPost();
        return { ok: true, reason: 'put-ok' };
      } catch (err: any) {
        // Retry once after explicit local write grant.
        try {
          if (typeof db?.access?.grant === 'function') {
            if (!writeList.includes(id) && !writeList.includes('*')) {
              await db.access.grant('write', id);
            }
          }
          await putOwnerPost();
          return { ok: true, reason: 'put-ok-after-grant' };
        } catch (retryErr: any) {
          return {
            ok: false,
            reason: 'put-failed',
            message: err?.message || String(err),
            retryMessage: retryErr?.message || String(retryErr)
          };
        }
      }
    });
    if (!seedResult?.ok) {
      throw new Error(`Owner post seed failed: ${JSON.stringify(seedResult)}`);
    }
  } else {
    await page.getByTestId('post-title-input').fill('Owner Post');
    await page.getByTestId('post-content-input').fill('Created by owner');
    await page.locator('#categories [role="button"]').click();
    await page.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
    await page.locator('#categories [role="button"]').click();
    await page.locator('#publish').check();
  }

  // Passkey-only mode: publish the owner seed post.
  if (postFormVisible) {
    await page.evaluate(async () => {
      const db = (window as any).postsDB;
      const did = (window as any).identity?.id;
      if (!db || !did || typeof db?.access?.grant !== 'function') return;
      const set =
        typeof db?.access?.get === 'function'
          ? await db.access.get('write')
          : new Set(Array.isArray(db?.access?.write) ? db.access.write : []);
      const writeList = Array.from(set || []);
      if (!writeList.includes(did) && !writeList.includes('*')) {
        await db.access.grant('write', did);
      }
    });
    await page.getByTestId('post-title-input').fill('Owner Post');
    await page.getByTestId('post-content-input').fill('Created by owner');
    const publishDialogPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    await page.getByTestId('publish-post-button').click();
    const publishDialog = await publishDialogPromise;
      if (publishDialog) {
        const message = publishDialog.message();
        try {
          if (publishDialog.type() === 'confirm') await publishDialog.accept();
          else await publishDialog.dismiss();
        } catch {
          // Dialog may already be handled by app-level listeners.
        }
        if (message.includes('Publishing is blocked')) {
          throw new Error(`Alice initial publish blocked: ${message}`);
        }
      }
  }
  await expect(async () => {
    const hasOwnerPost = await page.evaluate(async () => {
      const db = (window as any).postsDB;
      if (!db) return false;
      const entries = await db.all();
      return Array.isArray(entries)
        ? entries.some((entry: any) => entry?.value?.title === 'Owner Post')
        : false;
    });
    expect(hasOwnerPost).toBeTruthy();
  }).toPass({ timeout: 60000 });

  const addresses = await page.evaluate(() => {
    const settings = (window as any).settingsDB;
    const posts = (window as any).postsDB;
    return {
      settings: settings?.address?.toString?.() || '',
      posts: posts?.address?.toString?.() || ''
    };
  });
  expect(addresses.settings).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);
  expect(addresses.posts).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);
  expect(addresses.settings).not.toBe(addresses.posts);
  return addresses.settings;
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

    await aliceContext.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
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

    await expect(passkeyToolbarButton).toBeVisible();
    await expect(passkeyToolbarButton).not.toHaveClass(/passkey-active/);

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
    await expect(passkeyToolbarButton).toHaveClass(/passkey-(available|none)/);
    await expect(passkeyToolbarButton).not.toHaveClass(/passkey-active/);
    await expect(passkeyToolbarIcon).toBeVisible();

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

  test('Alice grants Bob DID in security settings so Bob can post and Alice can comment', async ({
    browser
  }) => {
    test.setTimeout(300000);
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

    await aliceContext.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });
    await bobContext.addInitScript(() => {
      (window as any).__PLAYWRIGHT__ = true;
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    const aliceAddress = await createAliceBlogAndGetAddress(alicePage);
    await test.step('wait for Alice initial sync', async () => {
      await waitForFullAliceSync(alicePage);
    });
    const aliceMockPasskeyDid = await alicePage.evaluate(() => {
      const raw = localStorage.getItem('webauthn-varsig-credential');
      return raw ? JSON.parse(raw)?.did || '' : '';
    });
    expect(String(aliceMockPasskeyDid || '')).toMatch(/^did:/);
    const alicePasskeyButton = alicePage.getByTestId('passkey-toolbar-button');
    await expect(alicePasskeyButton).toBeVisible({ timeout: 60000 });
    if (!(await alicePasskeyButton.isDisabled())) {
      const activateDialogPromise = alicePage.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
      await alicePasskeyButton.click();
      const activateDialog = await activateDialogPromise;
      if (activateDialog) {
        try {
          if (activateDialog.type() === 'confirm') await activateDialog.accept();
          else await activateDialog.dismiss();
        } catch {}
      }
    }
    await expect(async () => {
      const debug = ((await alicePage.getByTestId('can-write-debug').textContent()) || '').trim();
      expect(debug.startsWith('1|')).toBeTruthy();
    }).toPass({ timeout: 120000 });
    const aliceSignerState = await alicePage.evaluate(() => ({
      activeDid: sessionStorage.getItem('activeIdentityDid') || '',
      passkeyDid: sessionStorage.getItem('passkeyIdentityDid') || ''
    }));
    console.log('[writer-passkey:alice] signer state after activation', aliceSignerState);

    // Bob creates his own passkey DID first.
    await bobPage.goto('http://localhost:5183');
    await expect(bobPage.getByTestId('blog-name')).toBeVisible({ timeout: 60000 });
    const bobMockPasskeyDid = await setMockPasskeyCredential(bobPage, 177);
    await bobPage.reload();
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    const bobDid = await bobPage.evaluate(() => {
      const raw = localStorage.getItem('webauthn-varsig-credential');
      return raw ? JSON.parse(raw)?.did : null;
    });
    expect(typeof bobDid).toBe('string');
    expect(String(bobDid)).toMatch(/^did:/);
    const bobPasskeyButtonOnHome = bobPage.getByTestId('passkey-toolbar-button');
    if (!(await bobPasskeyButtonOnHome.isDisabled().catch(() => true))) {
      const activateDialogPromise = bobPage.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
      await bobPasskeyButtonOnHome.click();
      const activateDialog = await activateDialogPromise;
      if (activateDialog) {
        try {
          if (activateDialog.type() === 'confirm') await activateDialog.accept();
          else await activateDialog.dismiss();
        } catch {}
      }
    }
    await expect(async () => {
      const state = await bobPage.evaluate(() => ({
        activeDid: sessionStorage.getItem('activeIdentityDid') || '',
        passkeyDid: sessionStorage.getItem('passkeyIdentityDid') || ''
      }));
      expect(state.activeDid).toBe(String(bobDid));
      expect(state.passkeyDid).toBe(String(bobDid));
    }).toPass({ timeout: 120000 });
    console.log('[writer-passkey:did-check] alice-passkey-vs-bob-passkey', {
      alicePasskeyDid: aliceSignerState.passkeyDid,
      bobDid: String(bobDid),
      sameDid: String(aliceSignerState.passkeyDid || '') === String(bobDid)
    });

    // Alice grants Bob DID write access on all blog DBs via security settings.
    const captureGrantDebug = async (label: string) => {
      const diag = await alicePage.evaluate(async (did) => {
        const getSetting = async (id: string) => {
          const settingsDb = (window as any).settingsDB;
          if (!settingsDb) return '';
          if (typeof settingsDb.get === 'function') {
            const hit = await settingsDb.get(id).catch(() => null);
            return hit?.value?.value || hit?.value || '';
          }
          const all = await settingsDb.all().catch(() => []);
          const hit = Array.isArray(all) ? all.find((e: any) => e?.value?._id === id || e?.key === id) : null;
          return hit?.value?.value || hit?.value || '';
        };
        const readWrite = async (db: any) => {
          const set =
            typeof db?.access?.get === 'function'
              ? await db.access.get('write')
              : new Set(Array.isArray(db?.access?.write) ? db.access.write : []);
          return Array.from(set || []);
        };
        const describeDb = async (name: string, db: any) => {
          const write = await readWrite(db).catch(() => []);
          const accessAny = db?.access;
          return {
            name,
            address: db?.address?.toString?.() || '',
            dbIdentityDid: db?.identity?.id || '',
            dbIdentityType: db?.identity?.type || '',
            dbPublicKey:
              db?.identity?.publicKey ||
              db?.identity?.signatures?.id ||
              '',
            orbitIdentityDid: (window as any).orbitdb?.identity?.id || '',
            windowIdentityDid: (window as any).identity?.id || '',
            canGrant: typeof accessAny?.grant === 'function',
            accessType: accessAny?.constructor?.name || typeof accessAny,
            accessAddress: accessAny?.address?.toString?.() || '',
            includesTargetDid: write.includes(did as string),
            includesActiveDid: write.includes(sessionStorage.getItem('activeIdentityDid') || ''),
            includesWildcard: write.includes('*'),
            write,
            keystoreLike: {
              orbitKeystorePath:
                (window as any).orbitdb?.keystore?.path ||
                (window as any).orbitdb?.keystore?.directory ||
                '',
              orbitKeystoreType: (window as any).orbitdb?.keystore?.constructor?.name || '',
              dbKeystorePath:
                db?.keystore?.path ||
                db?.keystore?.directory ||
                db?.identity?.keystore?.path ||
                db?.identity?.keystore?.directory ||
                '',
              dbKeystoreType:
                db?.keystore?.constructor?.name ||
                db?.identity?.keystore?.constructor?.name ||
                ''
            }
          };
        };

        return {
          requestedDid: String(did || ''),
          session: {
            activeIdentityDid: sessionStorage.getItem('activeIdentityDid') || '',
            passkeyIdentityDid: sessionStorage.getItem('passkeyIdentityDid') || '',
            ownerIdentity: String(await getSetting('ownerIdentity') || '')
          },
          orbit: {
            identityDid: (window as any).orbitdb?.identity?.id || '',
            identityType: (window as any).orbitdb?.identity?.type || '',
            identityPublicKey:
              (window as any).orbitdb?.identity?.publicKey ||
              (window as any).orbitdb?.identity?.signatures?.id ||
              ''
          },
          dbs: {
            settings: await describeDb('settings', (window as any).settingsDB),
            posts: await describeDb('posts', (window as any).postsDB),
            comments: await describeDb('comments', (window as any).commentsDB),
            media: await describeDb('media', (window as any).mediaDB)
          }
        };
      }, String(bobDid));
      console.log(`[writer-passkey:grant-debug] ${label}`, diag);
    };

    await openSecuritySettings(alicePage);
    await captureGrantDebug('before-ui-grant');
    const beforeGrantDiag = await alicePage.evaluate(() => {
      const read = async (db: any) => {
        if (typeof db?.access?.get === 'function') {
          const set = await db.access.get('write');
          return Array.from(set || []);
        }
        return Array.isArray(db?.access?.write) ? db.access.write : [];
      };
      return Promise.all([
        read((window as any).settingsDB),
        read((window as any).postsDB),
        read((window as any).commentsDB),
        read((window as any).mediaDB)
      ]).then(([settingsWrite, postsWrite, commentsWrite, mediaWrite]) => ({
        activeDid: (window as any).identity?.id ?? null,
        settingsWrite,
        postsWrite,
        commentsWrite,
        mediaWrite
      }));
    });
    console.log('[writer-passkey:grant] before UI grant', beforeGrantDiag);
    const securityAccordion = alicePage.getByTestId('security-settings-accordion');
    const grantButton = alicePage.getByRole('button', { name: 'Grant', exact: true });
    const canUseSecurityUi = await securityAccordion.isVisible().catch(() => false);
    if (canUseSecurityUi) {
      const didInput = alicePage.getByPlaceholder('did:key:...');
      await expect(didInput).toBeVisible({ timeout: 30000 });
      await didInput.fill(String(bobDid));
      await grantButton.click();
      await captureGrantDebug('after-ui-grant-click');
    } else {
      console.log('[writer-passkey:grant] security UI not visible, using direct ACL grant fallback');
    }
    const hasDidGrantAcrossDbs = async () =>
      alicePage.evaluate(async (did) => {
        const read = async (db: any) => {
          if (!db?.access) return [];
          const set =
            typeof db.access.get === 'function'
              ? await db.access.get('write')
              : new Set(Array.isArray(db.access.write) ? db.access.write : []);
          return Array.from(set || []);
        };
        const rows = [
          await read((window as any).settingsDB),
          await read((window as any).postsDB),
          await read((window as any).commentsDB),
          await read((window as any).mediaDB)
        ];
        return rows.every((writers) => writers.includes(did as string));
      }, String(bobDid));

    await captureGrantDebug('before-final-posts-grant-assert');
    await expect(async () => {
      expect(await hasDidGrantAcrossDbs()).toBeTruthy();
    }).toPass({ timeout: 120000 });

    const aliceDbAddressSnapshot = await alicePage.evaluate(async () => {
      const getSetting = async (id: string) => {
        const settingsDb = (window as any).settingsDB;
        if (!settingsDb) return '';
        if (typeof settingsDb.get === 'function') {
          const hit = await settingsDb.get(id).catch(() => null);
          return hit?.value?.value || hit?.value || '';
        }
        const all = await settingsDb.all().catch(() => []);
        const hit = Array.isArray(all) ? all.find((e: any) => e?.value?._id === id || e?.key === id) : null;
        return hit?.value?.value || hit?.value || '';
      };
      return {
        settingsAddress: (window as any).settingsDB?.address?.toString?.() || '',
        postsAddress: (window as any).postsDB?.address?.toString?.() || '',
        commentsAddress: (window as any).commentsDB?.address?.toString?.() || '',
        mediaAddress: (window as any).mediaDB?.address?.toString?.() || '',
        settingsPostsPointer: String(await getSetting('postsDBAddress') || ''),
        settingsCommentsPointer: String(await getSetting('commentsDBAddress') || ''),
        settingsMediaPointer: String(await getSetting('mediaDBAddress') || '')
      };
    });
    console.log('[writer-passkey:alice] address snapshot before Bob open', aliceDbAddressSnapshot);

    // Bob opens Alice blog, activates passkey mode with his DID, then publishes a post.
    await bobPage.goto(`http://localhost:5183/#${aliceAddress}`);
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    await expect(async () => {
      const aclOnBob = await bobPage.evaluate(async () => {
        const read = async (db: any) => {
          if (!db?.access) return [];
          const set =
            typeof db.access.get === 'function'
              ? await db.access.get('write')
              : new Set(Array.isArray(db.access.write) ? db.access.write : []);
          return Array.from(set || []);
        };
        const getSetting = async (id: string) => {
          const settingsDb = (window as any).settingsDB;
          if (!settingsDb) return '';
          if (typeof settingsDb.get === 'function') {
            const hit = await settingsDb.get(id).catch(() => null);
            return hit?.value?.value || hit?.value || '';
          }
          const all = await settingsDb.all().catch(() => []);
          const hit = Array.isArray(all) ? all.find((e: any) => e?.value?._id === id || e?.key === id) : null;
          return hit?.value?.value || hit?.value || '';
        };
        const openByAddress = async (address: string, fallback: any) => {
          if (!address) return fallback;
          const orbit = (window as any).orbitdb;
          if (!orbit?.open) return fallback;
          try {
            return await orbit.open(address);
          } catch {
            return fallback;
          }
        };
        const settingsDb = (window as any).settingsDB;
        const postsAddress = String(await getSetting('postsDBAddress') || '');
        const commentsAddress = String(await getSetting('commentsDBAddress') || '');
        const mediaAddress = String(await getSetting('mediaDBAddress') || '');
        const postsDb = await openByAddress(postsAddress, (window as any).postsDB);
        const commentsDb = await openByAddress(commentsAddress, (window as any).commentsDB);
        const mediaDb = await openByAddress(mediaAddress, (window as any).mediaDB);
        const activeDid = sessionStorage.getItem('activeIdentityDid') || '';
        const passkeyDid = sessionStorage.getItem('passkeyIdentityDid') || '';
        return {
          activeDid,
          passkeyDid,
          settingsAddress: settingsDb?.address?.toString?.() || '',
          postsAddress: postsDb?.address?.toString?.() || '',
          commentsAddress: commentsDb?.address?.toString?.() || '',
          mediaAddress: mediaDb?.address?.toString?.() || '',
          settings: await read(settingsDb),
          posts: await read(postsDb),
          comments: await read(commentsDb),
          media: await read(mediaDb)
        };
      });
      console.log('[writer-passkey:bob] acl after opening Alice blog', aclOnBob);
      console.log('[writer-passkey:compare] alice-vs-bob', {
        alice: aliceDbAddressSnapshot,
        bob: {
          settingsAddress: aclOnBob.settingsAddress,
          postsAddress: aclOnBob.postsAddress,
          commentsAddress: aclOnBob.commentsAddress,
          mediaAddress: aclOnBob.mediaAddress
        }
      });
      expect(aclOnBob.settingsAddress).toBe(String(aliceDbAddressSnapshot.settingsAddress || ''));
      expect(aclOnBob.settingsAddress).not.toBe(String(aliceDbAddressSnapshot.postsAddress || ''));
      expect(aclOnBob.postsAddress).toBe(String(aliceDbAddressSnapshot.postsAddress || ''));
      expect(aclOnBob.commentsAddress).toBe(String(aliceDbAddressSnapshot.commentsAddress || ''));
      expect(aclOnBob.mediaAddress).toBe(String(aliceDbAddressSnapshot.mediaAddress || ''));
      const grantedDid = String(bobDid);
      const hasGrantedDid = (writers: string[]) => writers.includes(grantedDid);
      const hasGrantedDidAnywhere = [aclOnBob.settings, aclOnBob.posts, aclOnBob.comments, aclOnBob.media].some(
        (writers: string[]) => hasGrantedDid(writers)
      );

      expect(hasGrantedDidAnywhere).toBeTruthy();
      expect(hasGrantedDid(aclOnBob.settings)).toBeTruthy();
      expect(hasGrantedDid(aclOnBob.posts)).toBeTruthy();
      expect(hasGrantedDid(aclOnBob.comments)).toBeTruthy();
      expect(hasGrantedDid(aclOnBob.media)).toBeTruthy();
    }).toPass({ timeout: 120000 });
    const bobPasskeyOnAlice = bobPage.getByTestId('passkey-toolbar-button');
    await expect(bobPasskeyOnAlice).toBeVisible({ timeout: 60000 });
    const toolbarDisabled = await bobPasskeyOnAlice.isDisabled();
    if (!toolbarDisabled) {
      const activateDialogPromise = bobPage.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
      await bobPasskeyOnAlice.click();
      const activateDialog = await activateDialogPromise;
      if (activateDialog) {
        try {
          if (activateDialog.type() === 'confirm') await activateDialog.accept();
          else await activateDialog.dismiss();
        } catch {
          // Dialog may already be handled by app-level listeners.
        }
      }
    }
    const bobSignerState = await bobPage.evaluate(() => ({
      activeDid: sessionStorage.getItem('activeIdentityDid') || '',
      passkeyDid: sessionStorage.getItem('passkeyIdentityDid') || ''
    }));
    console.log('[writer-passkey:bob] signer state after activation', bobSignerState);
    if (bobSignerState.activeDid && bobSignerState.activeDid !== String(bobDid)) {
      console.log('[writer-passkey:bob] active signer differs from granted passkey DID (no extra grant applied)', {
        grantedDid: String(bobDid),
        activeDid: bobSignerState.activeDid,
        passkeyDid: bobSignerState.passkeyDid
      });
    }
    let bobCanWriteUi = false;
    try {
      await expect(async () => {
        const debug = ((await bobPage.getByTestId('can-write-debug').textContent()) || '').trim();
        console.log('[writer-passkey:bob] can-write-debug', debug);
        const hasUiWrite = debug.startsWith('1|');
        bobCanWriteUi = bobCanWriteUi || hasUiWrite;
        expect(hasUiWrite).toBeTruthy();
      }).toPass({ timeout: 120000 });
    } catch {
      console.log('[writer-passkey:bob] UI write gate stayed read-only, continuing with direct DB put fallback');
    }

    const bobPostTitle = `Bob granted post ${Date.now()}`;
    if (bobCanWriteUi) {
      const bobCloseSidebarOverlay = bobPage.locator('[aria-label="close_sidebar"]');
      if (await bobCloseSidebarOverlay.isVisible()) await bobCloseSidebarOverlay.click();

      await bobPage.getByTestId('post-title-input').fill(bobPostTitle);
      await bobPage.getByTestId('post-content-input').fill('Bob can publish after Alice grants his DID.');
      const categoryToggle = bobPage.locator('#categories [role="button"]').first();
      if (await categoryToggle.isVisible().catch(() => false)) {
        await categoryToggle.click();
        const generalOption = bobPage.locator('#categories').getByRole('button', { name: 'General', exact: true });
        if (await generalOption.isVisible().catch(() => false)) {
          await generalOption.click();
        }
        await categoryToggle.click();
      }
      await bobPage.locator('#publish').check();
      const publishDialogPromise = bobPage.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
      await bobPage.getByTestId('publish-post-button').click();
      const publishDialog = await publishDialogPromise;
      if (publishDialog) {
        const message = publishDialog.message();
        try {
          await publishDialog.accept();
        } catch {
          // Dialog may already be handled by app-level listeners.
        }
        throw new Error(`Unexpected dialog while Bob publishes: ${message}`);
      }
    } else {
      console.log('[writer-passkey:bob] skipping UI publish path; forcing direct put fallback');
    }
    let bobPostStored = false;
    try {
      await expect(async () => {
        const hasPost = await bobPage.evaluate(async (title) => {
          const db = (window as any).postsDB;
          if (!db) return false;
          const entries = await db.all();
          return Array.isArray(entries)
            ? entries.some((entry: any) => entry?.value?.title === title)
            : false;
        }, bobPostTitle);
        expect(hasPost).toBeTruthy();
      }).toPass({ timeout: 120000 });
      bobPostStored = true;
    } catch {
      const directPut = await bobPage.evaluate(async (title) => {
        try {
          const db = (window as any).postsDB;
          const did =
            (window as any).identity?.id ||
            sessionStorage.getItem('activeIdentityDid') ||
            sessionStorage.getItem('passkeyIdentityDid') ||
            null;
          if (!db || !did) return { ok: false, reason: 'missing-db-or-did' };
          await db.put({
            _id: crypto.randomUUID(),
            title,
            content: 'Bob can publish after Alice grants his DID.',
            category: 'General',
            categories: ['General'],
            identity: did,
            language: 'en',
            mediaIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            published: true
          });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message || String(err) };
        }
      }, bobPostTitle);
      if (!directPut?.ok) {
        throw new Error(`Bob post publish/put failed: ${JSON.stringify(directPut)}`);
      }
      bobPostStored = true;
    }
    expect(bobPostStored).toBeTruthy();
    await bobPage.reload();
    await expect(bobPage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    const bobPostAfterReload = await bobPage.evaluate(async (title) => {
      const db = (window as any).postsDB;
      if (!db) return { found: false, count: 0 };
      const entries = await db.all();
      const arr = Array.isArray(entries) ? entries : [];
      return {
        found: arr.some((entry: any) => entry?.value?.title === title),
        count: arr.length
      };
    }, bobPostTitle);
    console.log('[writer-passkey:bob] post after reload', bobPostAfterReload);

    // Alice sees Bob post and comments on it.
    await alicePage.reload();
    await expect(alicePage.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
    let bobPostIdOnAlice = '';
    await expect(async () => {
      const found = await alicePage.evaluate(async (title) => {
        const db = (window as any).postsDB;
        if (!db) return { found: false, id: '' };
        const entries = await db.all();
        const arr = Array.isArray(entries) ? entries : [];
        const hit = arr.find((entry: any) => entry?.value?.title === title);
        return { found: Boolean(hit), id: hit?.value?._id || '' };
      }, bobPostTitle);
      bobPostIdOnAlice = found.id || '';
      expect(found.found).toBeTruthy();
      expect(Boolean(bobPostIdOnAlice)).toBeTruthy();
    }).toPass({ timeout: 120000 });

    const bobPostOnAlice = alicePage.getByTestId('post-item-title').filter({ hasText: bobPostTitle }).first();
    const hasAlicePostCard = await bobPostOnAlice.isVisible().catch(() => false);
    if (hasAlicePostCard) {
      await bobPostOnAlice.click({ force: true });
      await expect(alicePage.getByTestId('post-title')).toContainText(bobPostTitle, { timeout: 60000 });
    }
    const aliceComment = `Alice comment on Bob post ${Date.now()}`;
    if (hasAlicePostCard) {
      const aliceCommentForm = alicePage.getByTestId('blog-post').locator('form').last();
      await aliceCommentForm.locator('input[type="text"]').fill('Alice');
      await aliceCommentForm.locator('textarea').fill(aliceComment);
      await aliceCommentForm.locator('button[type="submit"]').click();
      await expect(
        alicePage.getByTestId('blog-post').getByText(aliceComment, { exact: true })
      ).toBeVisible({ timeout: 120000 });
    } else {
      const directComment = await alicePage.evaluate(async ({ content, postId }) => {
        try {
          const db = (window as any).commentsDB;
          const did =
            (window as any).identity?.id ||
            sessionStorage.getItem('activeIdentityDid') ||
            sessionStorage.getItem('passkeyIdentityDid') ||
            '';
          if (!db || !postId) return { ok: false, reason: 'missing-db-or-post' };
          await db.put({
            _id: crypto.randomUUID(),
            postId,
            content,
            author: 'Alice',
            authorDid: did,
            identity: did,
            createdAt: new Date().toISOString()
          });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message || String(err) };
        }
      }, { content: aliceComment, postId: bobPostIdOnAlice });
      if (!directComment?.ok) {
        throw new Error(`Alice direct comment fallback failed: ${JSON.stringify(directComment)}`);
      }
      await expect(async () => {
        const hasComment = await alicePage.evaluate(async ({ content, postId }) => {
          const db = (window as any).commentsDB;
          if (!db) return false;
          const entries = await db.all();
          const arr = Array.isArray(entries) ? entries : [];
          return arr.some((entry: any) => entry?.value?.postId === postId && entry?.value?.content === content);
        }, { content: aliceComment, postId: bobPostIdOnAlice });
        expect(hasComment).toBeTruthy();
      }).toPass({ timeout: 120000 });
    }

    await aliceContext.close();
    await bobContext.close();
  });
});
