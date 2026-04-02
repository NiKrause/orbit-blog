# Deferred work (from code reviews)

## Deferred from: code review of 5-1-submit-job-lifecycle-status.md (2026-04-02)

- **Sprint status hygiene:** `4-1-json-schema-field-renderer` is still `in-progress` in `sprint-status.yaml` alongside completed work; align statuses when closing Epic 4 / 5.1.

## Deferred from: code review of 4-1-json-schema-field-renderer.md (2026-04-02)

- **Blob URL lifecycle (`AiImageField` `mediaCache`):** Revoke object URLs on teardown or when entries are evicted to reduce memory growth in long sessions; consider sharing helpers with `MediaUploader` if both keep similar caches.

- **`loadImages` concurrency:** If `mediaDB` is swapped or the component unmounts while `loadImages` is in flight, guard with a sequence token or `AbortController`-style cancellation so stale results are not applied.

## Deferred from: code review of 3-3-per-model-url-key-form.md (2026-04-02)

- **`identitySeed32` not cleared on session teardown:** If the app adds logout or identity reset, zero or clear `identitySeed32` (and related in-memory secrets) to match the threat model; not required for current single-session flow.

## Deferred from: code review of 3-2-register-kling-manifests.md (2026-04-02)

- **Expose `selectedModelId` to parent:** Implement in Story 3.3 (`bind:` or store) when credential form needs the current manifest.

- **Optional:** Stricter manifest JSON validation / `labelKey` presence checks if non-devs edit `kling-i2v.json`.

## Deferred from: code review of 2-1-ai-orbitdb-settings.md (2026-04-02)

- **`createDatabaseSet` vs bootstrap DB names:** Prefixed `name-*` vs short names (`ai`, `media`) in different paths — document or unify in a future refactor if it causes operator confusion.

- **`log.info` for `aiDBAddress` in `switchToRemoteDB`:** Optional verbosity tweak.

- **`console.error` in LeSpaceBlog for settings persist:** Align with logger when refactoring that component.

## Deferred from: code review of 1-2-ai-http-transport.md (2026-04-02)

- **`ai/index.ts` barrel:** Re-exports Epic 2 credential helpers alongside transport types; optional split into `ai/transport.ts` vs `ai/credentials.ts` entry points when epics stabilize.

- **`pnpm test` bundles credential + transport suites:** Acceptable monorepo harness; split scripts if CI needs isolation.

- **Unknown `jobId`:** `pollStatus` returns failed; `fetchResult` throws — align or document when implementing real `AiHttpTransport`.

## Deferred from: code review of 2-2-encrypt-per-model-credentials.md (2026-04-02)

- **AES-GCM AAD / `modelId` binding:** Optional hardening — bind ciphertext to `modelId` or doc id via GCM additional authenticated data in a future `schemaVersion` if reordering attacks matter for the threat model.

- **`listAiCredentialModelIds` + OrbitDB `all()`:** Confirm real `aiDB.all()` row shape matches `unwrapCredentialEntry` when integrated in UI (tests used `{ key, value }` mocks).

## Deferred from: code review of 1-1-browser-cors-spike.md (2026-04-02)

- **AC4 matrix row B:** Live `pnpm preview` not run; documented curl-only probe for preview origin; follow-up if preview-specific CORS behavior must be proven.

- **architecture.md scope:** Full architecture decision document shipped alongside spike docs; acceptable as planning artifact; spike ACs satisfied via links and index.
