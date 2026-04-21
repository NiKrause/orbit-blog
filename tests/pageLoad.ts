import { expect, type Page } from '@playwright/test';

export async function waitForLoadingOverlayToSettle(
  page: Page,
  visibleTimeoutMs = 30_000,
  hiddenTimeoutMs = 120_000,
) {
  const loadingOverlay = page.getByTestId('loading-overlay');
  const wasVisible = await loadingOverlay.isVisible().catch(() => false);

  if (wasVisible) {
    await expect(loadingOverlay).toBeVisible({ timeout: visibleTimeoutMs });
  }

  await expect(loadingOverlay).toBeHidden({ timeout: hiddenTimeoutMs });
}
