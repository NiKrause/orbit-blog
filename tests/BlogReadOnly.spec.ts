import { test, expect } from '@playwright/test';

test.describe('Blog Sharing: Bob is read-only on Alice blog', () => {
  test('Alice creates a blog + post, Bob opens it read-only', async ({ browser }) => {
    const contextAlice = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          '--unsafely-treat-insecure-origin-as-secure=ws://localhost:9092',
          '--disable-web-security'
        ]
      }
    });

    const contextBob = await browser.newContext({
      ignoreHTTPSErrors: true,
      launchOptions: {
        args: [
          '--allow-insecure-localhost',
          '--unsafely-treat-insecure-origin-as-secure=ws://localhost:9092',
          '--disable-web-security'
        ]
      }
    });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    pageAlice.on('console', (msg) => console.log('[alice]', msg.text()));
    pageBob.on('console', (msg) => console.log('[bob]', msg.text()));
    pageAlice.on('pageerror', (err) => console.error('[alice] PAGE ERROR:', err.message));
    pageBob.on('pageerror', (err) => console.error('[bob] PAGE ERROR:', err.message));

    await pageAlice.goto('http://localhost:5183');
    await pageAlice.evaluate(() => {
      localStorage.setItem('debug', 'libp2p:*,le-space:*');
    });

    await expect(pageAlice.getByTestId('blog-name')).toBeVisible({ timeout: 60000 });

    // Configure blog settings (new blog owned by Alice).
    await pageAlice.getByTestId('settings-header').click();
    const closeSidebarOverlay = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay.isVisible()) await closeSidebarOverlay.click();

    await pageAlice.getByTestId('blog-settings-accordion').click();
    await pageAlice.getByTestId('blog-name-input').fill('Alice Blog');
    await pageAlice.getByTestId('blog-description-input').fill('A blog created in e2e');

    // Ensure at least one category exists, otherwise the app won't allow publishing.
    await pageAlice.getByTestId('categories').click();
    while (await pageAlice.getByTestId(/^remove-category-button-/).count() > 0) {
      await pageAlice.getByTestId(/^remove-category-button-/).first().click();
    }
    await pageAlice.getByTestId('new-category-input').fill('General');
    await pageAlice.getByTestId('add-category-button').click();

    // Ensure the post form is actually available before interacting with it.
    await expect(pageAlice.getByTestId('post-form')).toBeVisible({ timeout: 60000 });

    // Create a single post.
    await pageAlice.getByTestId('post-title-input').fill('Hello from Alice');
    await pageAlice.getByTestId('post-content-input').fill('This is a post created by Alice in e2e.');
    // Select category in the custom MultiSelect with id="categories"
    await pageAlice.locator('#categories [role="button"]').click();
    await pageAlice.locator('#categories').getByRole('button', { name: 'General', exact: true }).click();
    await pageAlice.locator('#categories [role="button"]').click(); // close dropdown
    await pageAlice.locator('#publish').check();
    await pageAlice.getByTestId('publish-post-button').click();

    // Give the UI time to persist + render the new post.
    await pageAlice.waitForTimeout(2000);
    await expect(
      pageAlice.getByTestId('post-item-title').filter({ hasText: 'Hello from Alice' })
    ).toBeVisible({ timeout: 60000 });

    // Fetch the OrbitDB address to share with Bob.
    await pageAlice.getByTestId('menu-button').click();
    await pageAlice.getByTestId('blogs-header').click();
    await pageAlice.getByTestId('db-manager-container').waitFor({ state: 'visible' });
    const closeSidebarOverlay2 = pageAlice.locator('[aria-label="close_sidebar"]');
    if (await closeSidebarOverlay2.isVisible()) await closeSidebarOverlay2.click();

    const aliceBlogAddress = await pageAlice.getByTestId('db-address-input').inputValue();
    expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);

    // Bob opens Alice blog via hash route and waits for replication.
    await pageBob.goto(`http://localhost:5183/#${aliceBlogAddress}`);
    await pageBob.evaluate(() => {
      localStorage.setItem('debug', 'libp2p:*,le-space:*');
    });
    await expect(pageBob.getByTestId('loading-overlay')).toBeVisible({ timeout: 30000 });
    await expect(pageBob.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });

    await expect(pageBob.getByTestId('blog-name')).toHaveText('Alice Blog', { timeout: 120000 });
    await expect(pageBob.getByTestId('post-item-title').filter({ hasText: 'Hello from Alice' })).toBeVisible({
      timeout: 120000
    });

    // Debug write gating in CI logs if this test ever flakes.
    const bobCanWriteDebug = await pageBob.getByTestId('can-write-debug').textContent();
    console.log('[bob] can-write-debug:', bobCanWriteDebug);

    // Read-only UI assertions for Bob:
    // 1) Post creation form should not render.
    await expect(pageBob.getByTestId('post-form'), `can-write-debug=${bobCanWriteDebug}`).toHaveCount(0);

    // 2) Edit/Delete/History actions should not be present for Bob.
    await expect(pageBob.locator('[data-testid^="post-edit-"]')).toHaveCount(0);
    await expect(pageBob.locator('[data-testid^="post-delete-"]')).toHaveCount(0);
    await expect(pageBob.locator('[data-testid^="post-history-"]')).toHaveCount(0);

    await contextAlice.close();
    await contextBob.close();
  });
});
