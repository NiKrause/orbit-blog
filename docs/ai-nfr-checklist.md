# AI Manager — NFR verification checklist (M1)

Re-run after meaningful changes under `src/lib/ai/`, `src/lib/components/AiManager.svelte`, `src/lib/mediaIngest.ts`, or credential/crypto paths.

**References:** PRD NFR table (`_bmad-output/planning-artifacts/prd.md`), `src/lib/utils/logger.ts` (imports use `*.js` suffix in TS sources).

---

## NFR-1 — No secrets or full prompts in production logs

**Intent:** Decrypted API keys, raw key material, and **full user prompts** must not be emitted via `console.*` or logger output when `import.meta.env.PROD` is true. Non-sensitive status lines are OK, and development-only diagnostics may log the full provider payload/response.

- [x] **Static scan (expect empty or allowlisted):**

  ```bash
  rg "console\.(log|debug|info|warn|error)" src/lib/ai \
    src/lib/components/AiManager.svelte src/lib/mediaIngest.ts
  ```

  **Expected:** no matches (verified 2026-04-02).

- [x] **Logger usage in AI UI paths:**

  ```bash
  rg "from ['\"].*logger\.js" src/lib/ai src/lib/mediaIngest.ts \
    src/lib/components/AiManager.svelte src/lib/components/AiImageField.svelte
  ```

  **Expected:** **`AiImageField.svelte`** imports **`error`** from `logger.js` for **load/upload** failures. **`AiManager.svelte`** and `FetchAiHttpTransport` may log under **`le-space:blog:ai`**, but production logs must redact secrets and prompt-like fields. **`src/lib/ai/**` has **no** `console.*`.

- [ ] **Manual smoke (optional):** Production build (`pnpm build` + `pnpm preview`), run a mock credential + job; confirm browser console shows no Bearer token, no decrypted key, and no full prompt text in any `le-space:blog:ai` log line.

- [x] **Transport:** `FetchAiHttpTransport` logs request/response diagnostics under `le-space:blog:ai`; auth headers are redacted always, and prompt-like fields are redacted when `import.meta.env.PROD` is true (`src/lib/ai/fetchAiHttpTransport.ts`).

---

## NFR-2 — Crypto hygiene (no ad-hoc ciphers)

- [x] **Credential encryption/decryption** goes through `src/lib/ai/aiCredentialCrypto.ts` (`encryptApiKey` / `decryptApiKey`, HKDF + AES-GCM) only.

- [x] **`src/lib/ai/aiCredentialStore.ts`** is the only persistence layer for encrypted API keys; it imports crypto from `aiCredentialCrypto.js`, not bespoke crypto.

- [x] **Cross-reference:** `docs/data-models.md` § AI credential documents.

---

## NFR-3 — Bundle discipline

**Recorded build (2026-04-02, `pnpm build`, default `outDir`: `dist/`):**

| Asset (hash may change) | Size (approx.) | Notes |
| --- | --- | --- |
| `dist/assets/index-*.js` | ~1.46 MB min | Main SPA chunk; **static** imports pull `PostForm` → `AiManager` → `src/lib/ai/*` and `mediaIngest` into this graph. |
| `dist/assets/p2p-*.js` | ~2.06 MB | libp2p / Helia; not AI-specific. |

- [x] **Finding:** Vite did **not** emit a separate async chunk named for AI only — acceptable for M1 per story (documented). **Optional follow-up:** `import()` `AiManager` from `PostForm` to split AI code when priorities allow.

- [ ] Re-run listing after upgrades:

  ```bash
  ls -la dist/assets/*.js | head -40
  ```

---

## NFR-5 — External references (curated)

| Topic | Link |
| --- | --- |
| Atlas Cloud — Kling v3.0 Pro I2V API | [atlascloud.ai model API tab](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video?tab=api) |
| Atlas — video / queue docs (overview) | [Atlas video models docs](https://www.atlascloud.ai/docs/models/video) |
| ERC-8004 (EIP) | [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004) |
| Reference implementation patterns | [erc-8004-example (GitHub)](https://github.com/vistara-apps/erc-8004-example) |

- [x] Same links appear in **README.md** (Docs) and **docs/index.md** (table).

---

## Gate

- [x] `pnpm check`
- [x] `pnpm test`

---

_Last updated: 2026-04-11 — AI transport logging_
