---
story_key: 2-2-encrypt-per-model-credentials
epic: 2
story: 2.2
frs: FR-3, FR-2
---

# Story 2.2: Encrypt and store per-model credentials

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **each registered model’s base URL and API key stored encrypted**,  
so that **keys are not plaintext at rest**.

## Acceptance Criteria

1. **Given** the current identity can derive encryption keys per [architecture: identity-derived symmetric key]  
   **When** the app saves a credential document for a model id into the **AI OrbitDB** (`aiDB` from Story 2.1)  
   **Then** the **API key** field is stored **encrypted** (ciphertext + IV/nonce + any metadata required for AES-GCM or the chosen Web Crypto primitive).

2. **And** **base URL** may remain **plaintext** in the document (per architecture “per-model credentials” table: base URL + encrypted API key).

3. **And** **round-trip decrypt** succeeds for the same identity in **automated tests** (Node or browser crypto as appropriate).

4. **And** **`aiApiKey` / `aiApiUrl`** in `src/lib/store.ts` are **not** read or written by this code path (translation-only; NFR-2 / architecture separation).

5. **And** decrypted API keys are **never logged** in production code paths (NFR-1); tests must not print secrets.

6. **Not in scope:** AI Manager UI (Epic 3), full multi-model registry UX, job documents — **Story 2.3** will stress multiple coexisting credential documents; this story may use **one** model id for the vertical slice if needed, but the **document must include a stable `modelId` field** so 2.3 can extend without breaking storage.

## Tasks / Subtasks

- [x] **Task 1 — Types (AC: 1–2, 6)**  
  - [x] In `src/lib/types.ts` and/or `src/lib/ai/`, add types for a **credential document** stored in the AI DB, e.g. `schemaVersion`, `modelId`, `baseUrl`, `encryptedApiKey` (structured fields for ciphertext + IV, encoding agreed in Task 2).  
  - [x] Export from `src/lib/ai/index.ts` as needed; keep NodeNext `.js` imports.

- [x] **Task 2 — Identity-bound encryption helpers (AC: 1, 3, 5)**  
  - [x] Implement **AES-GCM** (or AES-256-GCM) encrypt/decrypt for **arbitrary UTF-8 secret strings** (the API key).  
  - [x] **Derive** a symmetric key from material tied to the **same 32-byte identity seed** used for OrbitDB identity (`convertTo32BitSeed` / `createIdentityProvider` path — see `LeSpaceBlog.svelte`, `orbitdb.ts`). Use **Web Crypto** `subtle` with **HKDF** (or project-consistent helper) and a **fixed application `info` string** (e.g. `bolt-orbitdb-blog-ai-credential-v1`) so the same identity always decrypts its own blobs.  
  - [x] **Do not** introduce new cryptographic primitives beyond Web Crypto + existing seed utilities; **do not** log plaintext keys (NFR-1).  
  - [x] If tests run under **Node**, use **`crypto.subtle`** from **`node:crypto`** (global in modern Node) or a small test-only wrapper so round-trip tests do not require a browser.

- [x] **Task 3 — Persistence API on `aiDB` (AC: 1–2)**  
  - [x] Add a small module under `src/lib/ai/` (e.g. `aiCredentialStore.ts`) that: accepts the **OrbitDB documents handle** (`aiDB`), **identity seed** (or pre-derived key) + `modelId` + `baseUrl` + plaintext `apiKey`; **encrypts** the key; **`put`** a document with stable `_id` (e.g. `credential:{modelId}` or hashed id — must not collide with future job doc prefixes from architecture).  
  - [x] Implement **read + decrypt** for the same `modelId` for verification and for later Epic 3 UI.  
  - [x] **Wire-up note:** Callers may need to obtain identity seed from the same place the app already derives identity (password flow / in-memory seed) — document the **expected call site** in Dev Notes; avoid persisting plaintext keys outside RAM.

- [x] **Task 4 — Tests (AC: 3, 5)**  
  - [x] Add **`test/`** file (e.g. `aiCredentialCrypto.test.ts`) using the same **Mocha + ts-node/esm** pattern as `test/aiHttpTransport.test.ts` / `tsconfig.test.json`.  
  - [x] Assert: encrypt → stored shape → decrypt equals original; wrong seed or tampered ciphertext fails predictably.  
  - [x] No secret values in `console.log`.

- [x] **Task 5 — Docs touch (AC: 4)**  
  - [x] One short paragraph in `docs/data-models.md` (or `docs/api-contracts.md` if more appropriate) describing **AI credential documents** and that API keys are **encrypted at rest**.

- [x] **Task 6 — Separation guard (AC: 4)**  
  - [x] Confirm by code structure: new modules **import** `aiDB` / stores only as needed; **never** import `aiApiKey`/`aiApiUrl` from `store.ts` for credential persistence. Comment near module entry if it helps reviewers.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication and Security, Data Architecture] — API key at rest encrypted; identity-derived secret; translation `aiApiKey`/`aiApiUrl` unchanged and isolated.  
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2] — BDD acceptance criteria.  
- [Source: `_bmad-output/project-context.md`] — Secrets must not appear in logs; `pnpm check` + `pnpm test`.

### Implementation sequence

- Depends on **Story 2.1** (`aiDB`, `aiDBAddress`, clone/drop parity). Do not recreate the AI DB bootstrap here.  
- **Story 2.3** will require multiple credential docs and distinct ids; choose `_id` / `modelId` conventions now to avoid migrations.

### Project Structure Notes

- Prefer **`src/lib/ai/`** for new AI credential + crypto helpers per architecture “Naming and Files”.  
- Reuse patterns from `src/lib/cryptoUtils.ts` (AES-GCM, IV layout) where sensible — **do not** reuse password-based PBKDF2 from seed phrase for AI keys; identity derivation should use the **identity seed** path, not the user’s unlock password.

### References

- `src/lib/utils.ts` — `convertTo32BitSeed`, `generateMasterSeed`  
- `src/lib/orbitdb.ts` / `src/lib/components/LeSpaceBlog.svelte` — identity creation  
- `src/lib/store.ts` — `aiDB` / `aiApiKey` (latter **off limits** for AI Manager persistence)  
- `_bmad-output/implementation-artifacts/stories/2-1-ai-orbitdb-settings.md` — AI DB wiring

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- `pnpm test` and `pnpm check` pass.
- Tests use a deterministic 32-byte seed (avoid importing `utils.ts` in tests — unrelated libp2p typing errors under ts-node).
- UI wiring to pass `get(identity)` seed from app bootstrap is deferred to Epic 3; API accepts `Uint8Array` / `Buffer` + `aiDb` handle.

### File List

- `src/lib/ai/credentialTypes.ts`
- `src/lib/ai/aiCredentialCrypto.ts`
- `src/lib/ai/aiCredentialStore.ts`
- `src/lib/ai/index.ts`
- `test/aiCredentialCrypto.test.ts`
- `package.json` (test script)
- `docs/data-models.md`
- `_bmad-output/implementation-artifacts/stories/2-2-encrypt-per-model-credentials.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-02: Implemented HKDF + AES-GCM credential encryption, `saveAiCredential` / `loadAiCredential`, tests, data-models paragraph.
- 2026-04-02: Code review — HKDF comment applied; defer AAD + `all()` integration verification.

### Previous story intelligence (2-1)

- AI DB exists as `aiDB` / `aiDBAddress`; use `saveAiCredential` / `loadAiCredential` with `get(aiDB)` when wiring UI.

---

## Project context reference

- `_bmad-output/project-context.md` — OrbitDB, tests, secrets.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).

### Review Findings

- [x] [Review][Patch] HKDF empty salt — **Fixed:** comment in `deriveAesKey` explaining empty salt + role of `info` (auditor clarity).

- [x] [Review][Defer] AES-GCM **AAD** — Ciphertext is not cryptographically bound to `modelId` / `_id`; a threat model where an attacker reorders credential blobs within the same DB could swap keys between models (same derived AES key for all rows). Consider **`schemaVersion: 2`** with AAD = `modelId` or document id if this becomes a requirement. [`src/lib/ai/aiCredentialCrypto.ts`]

- [x] [Review][Defer] **`all()` entry shape** — `listAiCredentialModelIds` relies on `unwrapCredentialEntry` matching OrbitDB’s `all()` rows (tests use `{ key, value }`). Re-verify when wired to a live `aiDB` in Epic 3. [`src/lib/ai/aiCredentialStore.ts`]
