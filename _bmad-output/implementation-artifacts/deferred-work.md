# Deferred work (from code reviews)

## Deferred from: code review of 4-2-image-input-library-upload.md (2026-04-04)

- **Docs vs code — relay LED in Story 4.2 widget:** `AiImageField` ships `RelaySyncLed` (FR-7c-style) while story AC12 still says LED belongs to Story 4.3 only; reconcile `epics.md` / story traceability when Epic 4 is finalized.

- **`getBlobUrl` chunk concat performance:** Inefficient byte merging for large images in `AiImageField`; optimize if authors upload multi‑MB files regularly.

## Deferred from: code review of 4-3-relay-replication-and-pin-status-for-ai-inputs.md (2026-04-04)

- **AC4 vs relay API surface:** No JSON “replicated DB addresses” on **`orbitdb-relay-pinner`** today; LED uses **`GET /health`** + CID **HEAD**/Range as documented. Revisit if the relay gains a first-class replication API and PRD text should be tightened to match.

- **Timer-based `startRelayPinPolling` tests:** `sleep()`-driven assertions; switch to fake timers or a test seam if CI flakes.

## Deferred from: code review of 5-1-submit-job-lifecycle-status.md (2026-04-04)

- **Silent AIDB `put` failures:** Run persistence errors are swallowed so Generate never blocks; consider a lightweight, non-secret UI hint if `aiDB.put` repeatedly fails and history matters.

## Deferred from: code review of 6-1-advertise-supported-models-to-peers.md (2026-04-04)

- **Cap incoming gossipsub payload size before `JSON.parse`:** Harden `onMessage` with a max-bytes guard to reduce memory DoS risk from oversized gossipsub payloads; out of scope for Story 6.1 unless architecture sets a limit.

- **Silent `publish` failures:** Empty catch around `pubsub.publish` avoids noise and payload logging; add optional debug/metrics later if providers cannot diagnose mesh publish issues.

## Deferred from: code review of 5-3-nfr-verification-and-documentation-touchpoint.md (2026-04-02)

- **Optional NFR-1 manual smoke:** Run `pnpm build` + `pnpm preview` and exercise AI Manager with mock credentials; confirm console/network panels show no Bearer token, decrypted key, or full prompt text — checklist checkbox remains optional.

## Deferred from: code review of 5-2-ingest-output-video-media-draft.md (2026-04-04)

- **Post embed gateway vs relay base:** `appendVideoEmbedToContent` uses dweb.link while LED uses `VITE_RELAY_PINNED_CID_BASE`; optional alignment for consistent relay URLs in saved markdown.

- **`output.textBodyMerge: "replace"` impact:** Full draft replace is spec-correct but risky UX; prefer `append` in manifests unless product explicitly wants replace.

## Deferred from: code review of 5-2-ingest-output-video-media-draft.md (2026-04-02)

- **Repeated “Insert into post”:** Optional dedupe or disable-after-insert for AI-generated video embeds if users report duplicate blocks.

- **Fragile removal if embed edited:** `removeVideoEmbedFromContent` regex may not match hand-edited `<video>` tags; acceptable for v1; tighten if support load appears.

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
