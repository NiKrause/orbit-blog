---
story_key: 5-2-ingest-output-video-media-draft
epic: 5
story: 5.2
frs: FR-8
ux_drs: UX-DR8, UX-DR10
---

# Story 5.2: Ingest output video into Media and attach to draft

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **the generated video to appear as media I can use in my post**,  
so that **I can publish it like any other asset**.

## Acceptance Criteria

1. **Given** a **successful** AI job (**`jobPhase === 'succeeded'`**) and a **resolved output** from the transport (**`FetchAiHttpTransport.fetchResult`** returns an **`assetUrl`** or equivalent per **`AiFetchResultOutput`**)  
   **When** the user confirms **ingestion** (or ingestion runs automatically per Dev Notes — pick one approach and document it)  
   **Then** the app **downloads** the video bytes ( **`fetch(assetUrl)`** or provider-documented path), **adds** them to **IPFS** via **`unixfs` + `helia`** (same pattern as **`MediaUploader.svelte`** / **`AiImageField.svelte`**: `addBytes` → CID string), and **writes** a **`mediaDB`** document with **`_id`**, **`name`**, **`type`** (e.g. `video/mp4` from **`Content-Type`** or sensible default), **`size`**, **`cid`**, **`createdAt`**.

2. **And** the new asset **appears in the existing media workflow**: **`mediaDB.events`** / library UIs that already reload on **`PUT`** (e.g. **`AiImageField`**, **`MediaUploader`**) **without** a parallel custom list.

3. **And** **UX-DR8 / UX §7.2 item 6 (Succeeded):** the AI Manager **success** area shows a **native** **`<video controls>`** preview (local **blob URL** from **`fs.cat(cid)`** preferred for preview parity with images; **gateway URL** fallback acceptable if IPFS read fails). **Do not** rely on the temporary provider **`assetUrl`** as the only preview source after success — after ingestion, preview should tie to **local IPFS** or a **stable gateway** of the **CID**.

4. **And** **two** explicit actions (primary / secondary labels per UX — implement **i18n** keys, e.g. “Insert into post” vs “Add to selected media”):  
   - **Primary:** inserts content into the **draft** **`content`** string using a **documented** pattern that **renders as video** in **`renderContent` / `MarkdownRenderer`** (today **`![Media](ipfs://cid)`** is treated as an **image** — you **must** extend the markdown/DOMPurify pipeline **or** add a **video-specific** markdown/HTML pattern so the post preview shows **`<video>`**, not a broken **`<img>`**).  
   - **Secondary:** adds the new media **CID** to **`selectedMedia`** in **`PostForm`** (same array used for posts **`mediaIds`**) **without** duplicating CIDs.

5. **And** removing the asset from **selected media** (existing **`MediaManager`** chip remove) **must** remove the **matching** inserted **post** snippet (extend **`removeMediaFromContent`** / **`postUtils.ts`** or add **video-specific** removal that stays in sync with whatever insert pattern you choose).

6. **And** **FR-8** is satisfied: **successful generation** yields a **Media** document in **`mediaDB`** and surfaces in the **media + post** workflow.

7. **And** **NFR-1:** do **not** log **API keys**, full **prompts**, or **raw** provider error bodies; logging **video byte length** or **CID** is acceptable.

8. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file (English in **`en.js`**; other locales may mirror English until translated).

9. **And** **RTL:** success actions and preview row follow **`AiManager`** **`dir`** / **`$isRTL`** patterns (**UX-DR10**).

10. **Not in scope:** **Story 5.3** (NFR bundle/docs verification); **paid / network provider** paths (**Epic 6+**); **persistent job history** in AI DB; **editing** Media name after ingest.

## Tasks / Subtasks

- [ ] **Task 1 — Pure ingest helper (AC: 1, 6, 7)**  
  - [ ] Add a focused helper (e.g. `ingestRemoteVideoToMedia({ assetUrl, mediaDB, helia }): Promise<{ cid: string; mediaId: string }>`) or equivalent: **`fetch` → bytes**, size guard consistent with app limits (**10MB** aligns with **`MediaUploader`** / **`AiImageField`** unless PRD overrides), **`unixfs.addBytes`**, **`mediaDB.put`** with the same document shape as other uploads.  
  - [ ] Map **`fetch`** failures (network, non-OK HTTP, CORS/opaque) to existing or new **`ai_job_*` / ingest-specific i18n keys**; **no** secrets in error messages.

- [ ] **Task 2 — Wire `AiManager` + `PostForm` (AC: 2–5, 8–9)**  
  - [ ] Import **`mediaDB`** / **`helia`** from **`$lib/store`** in **`AiManager`** (or pass as props from **`PostForm`** — prefer **one** clear pattern; avoid duplicate Helia init).  
  - [ ] After **`fetchResult`** / success path, hold **`ingestedCid`** / **`ingestedMediaId`** state; show **preview** + **Insert** + **Add to selected media** only when ingest **succeeded**.  
  - [ ] **Callbacks** from **`PostForm`** → **`AiManager`**: e.g. `onInsertVideoMarkdown(htmlOrMd: string)` and `onAddToSelectedMedia(cid: string)` **or** bind accessors — **must** reuse **`PostForm`**’s **`content`** / **`selectedMedia`** state (**see** `handleMediaSelected` / **`handleMediaSelection`**).

- [ ] **Task 3 — Markdown / sanitizer (AC: 4–5)**  
  - [ ] Update **`MarkdownRenderer.renderContent`** DOMPurify allowlist so **safe** **`<video>`** embeds ( **`controls`**, **`src`** to **https** gateway or **relative** policy) survive sanitization **if** you insert HTML.  
  - [ ] **Or** extend **`marked`** custom renderer so **`![Video](ipfs://cid)`** (or similar) emits **`<video>`** with CID resolved like images — **document the chosen syntax** in Dev Notes.

- [ ] **Task 4 — Tests + check (AC: all)**  
  - [ ] Unit tests: ingest helper with **mock `fetch`** + mock **`mediaDB`/`helia`** (or stub **`unixfs`**) — happy path + oversize + fetch error.  
  - [ ] Extend **`test/postFormAiI18n.test.ts`** `KEYS` for new strings.  
  - [ ] **`pnpm check`** and **`pnpm test`** green.

### Review Findings

_(None — story not yet implemented.)_

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — FR-7, FR-8] — Reuse **existing Media pipeline** (**`mediaDB`** + **Helia UnixFS**); **no** second persistence format.  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Domain boundaries] — **HTTP to Atlas** stays in **`FetchAiHttpTransport`**; **ingestion** is **app + IPFS + OrbitDB**, callable from **`AiManager`** or a small **`src/lib/ai/`** / **`mediaIngest.ts`** module.  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.2 items 6–7] — Success: **video preview** + **two actions**; errors remain **inline** **`var(--danger)`**.

### Previous story intelligence (5.1)

- **`FetchAiHttpTransport`**: **`fetchResult`** uses **`GET /api/v1/model/getResult?predictionId=`**; **`extractOutputUrl`** reads **`output` / `data.url` / `video_url`** etc. — ingestion should use the **same** `assetUrl` already surfaced as **`resultAssetUrl`** in **`AiManager`**.  
- **Poll / timeout** behavior is **unchanged**; this story **adds post-success ingest** and **UX** after **`jobPhase === 'succeeded'`**.  
- **`buildSubmitJobInput`**, **`MockAiHttpTransport`**, and **`runEpoch`** abandonment: if the user **changes model** mid-flight, **do not** attach stale results — gate ingest UI on **current epoch** / job id.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/AiManager.svelte` | Ingest + preview + primary/secondary actions; optional props/callbacks |
| `src/lib/components/PostForm.svelte` | Pass **`mediaDB`/`helia`** and **callbacks** / bindings |
| `src/lib/utils/postUtils.ts` | **Insert/remove** helpers for **video** embeds consistent with **`selectedMedia`** |
| `src/lib/services/MarkdownRenderer.ts` | **DOMPurify** / **marked** updates for **video** in rendered posts |
| `src/lib/ai/*.ts` or `src/lib/mediaIngest.ts` | **Pure** ingest helper (optional) |
| `src/lib/i18n/*.js` | New keys |
| `test/*.ts` | Ingest + **postUtils** + i18n |

### Testing standards

- **No** real Atlas keys in repo; **stub** **`fetch`** returning **`ArrayBuffer`** or **`Response`** with **`Content-Type: video/mp4`**.  
- Follow **Mocha** + **`ts-node/esm`** patterns in **`package.json`**.

### Library / framework requirements

- **Svelte 5** runes (`$state`, `$derived`, `$props`); **svelte-i18n** **`$_`**.  
- **Helia** + **`@helia/unixfs`** — same as **`AiImageField.svelte`**.

### Latest technical specifics

- **Atlas** output is a **URL** to **video** bytes — browser **`fetch`** must allow **CORS** for that host (project **CORS spike** doc: if blocked, surface **`ai_job_error_cors_or_blocked`** or dedicated ingest key — do **not** silently fail).  
- **IPFS** CID strings match existing **`mediaDB`** consumers (**`ipfs://`**, **`dweb.link`**, **`getBlobUrl`** patterns in **`MediaUploader`**).

## Dev Agent Record

### Agent Model Used

_(To be filled by dev agent.)_

### Debug Log References

### Completion Notes List

### File List

### Change Log

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Should** | AC1 asks to **pick** automatic vs explicit ingestion — **ambiguous** for implementation | Prefer **explicit user action** (“Save to media” / ingest button) in **Task 2** unless product wants auto-ingest — document final choice in **Completion Notes** when implementing. |
| **Should** | **10MB** cap matches image upload; **video** outputs may exceed — **product risk** | Dev agent: if Atlas returns large files, map to **`ai_job_error_*`** or new **oversize** i18n key; document in **Completion Notes** if limit is raised. |
| **Critical** | **Markdown / sanitizer** path (AC4) is the highest integration risk | Task 3 remains the spine; add **component test** or manual checklist before marking done. |
| **OK** | Reuse **`FetchAiHttpTransport.fetchResult`** / **`resultAssetUrl`** | Previous story + Dev Notes. |
| **OK** | **`mediaDB` + UnixFS** parity with **`MediaUploader`** | AC1 + architecture. |
| **OK** | **RTL / i18n / NFR-1** | Covered in ACs. |

**Definition of Done (validation):** Checklist recorded; no mandatory story rewrite — proceed with `bmad-dev-story` after resolving **ingest trigger** (auto vs button) during implementation.

---

**Completion note (create-story):** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
