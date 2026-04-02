---
story_key: 3-1-ai-toggle-panel-postform
epic: 3
story: 3.1
frs: FR-1
ux_drs: UX-DR1, UX-DR2, UX-DR3, UX-DR5, UX-DR9, UX-DR10
---

# Story 3.1: AI toggle and panel in PostForm

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **an AI button next to Add media that expands an AI panel**,  
so that **I can configure generation without leaving the post editor**.

## Acceptance Criteria

1. **Given** the post composer (`PostForm` for new post; see Scope: create vs edit)  
   **When** the user clicks the AI control  
   **Then** the AI panel toggles open or closed and the button label or state reflects open vs closed (UX-DR1).

2. **And** the expanded region is a **card/panel** below the content toolbar (or same vertical rhythm as `MediaUploader` / media toggle) using existing design tokens (`var(--border)`, `var(--bg-tertiary)`, `btn-ghost` / `btn-sm` as in UX spec) and **does not replace** the markdown editor (UX-DR2).

3. **And** `aria-expanded` and `aria-controls` associate the AI toggle with the panel (`id` on the panel region) (UX-DR5).

4. **And** all **new** user-visible strings use **svelte-i18n** `$_('…')` keys — no hardcoded English in the new UI (UX-DR3). Add the same keys to **all** locale files under `src/lib/i18n/*.js` (English value in `en.js`; other locales may use English placeholder until translated).

5. **And** AI Manager does **not** embed translation API settings (`aiApiKey` / `aiApiUrl`); no reuse of translation Settings UI in this story (UX-DR9).

6. **And** RTL: layout for the new toolbar controls and panel respects existing `PostForm` `$isRTL` / `rtl` class patterns (UX-DR10).

7. **Not in scope for this story:** Model dropdown / manifests (Story 3.2), credential form / save / mask (Story 3.3), schema-driven fields, job run, OrbitDB writes for credentials. **Empty or placeholder panel content** (short i18n subtitle) is acceptable.

## Tasks / Subtasks

- [x] **Task 1 — State and layout (AC: 1–2, 6–7)**  
  - [x] In `PostForm.svelte`, add local state (e.g. `showAiPanel`) toggled by the AI control.  
  - [x] Place the **AI** control as a **peer** to **Add media** in the content row toolbar (same flex row as existing `Add media` / preview / help).  
  - [x] When open, render a bordered panel below the toolbar block (mirror `showMediaUploader` placement / spacing).  
  - [x] Panel may delegate to a new component (e.g. `AiManager.svelte`) with **placeholder** body only for 3.1.

- [x] **Task 2 — Accessibility (AC: 3)**  
  - [x] Toggle button: `type="button"`, `aria-expanded={showAiPanel}`, `aria-controls` pointing to a **stable panel id** (e.g. `post-form-ai-panel`) on the panel wrapper.  
  - [x] Panel: `id` matches `aria-controls`; optionally `role="region"` and `aria-label` (or `aria-labelledby` to a visible heading) using an i18n string so screen readers get a name for the expandable area.

- [x] **Task 3 — i18n (AC: 4)**  
  - [x] Add keys for AI label, toggle show/hide, panel title/placeholder, and any aria-only strings if exposed.  
  - [x] Update **every** file in `src/lib/i18n/*.js` with the new keys (same structure as existing keys).

- [x] **Task 4 — Separation guard (AC: 5)**  
  - [x] Do not import or display `aiApiKey` / `aiApiUrl` from `store.ts` for this panel.

- [x] **Task 5 — Verification**  
  - [x] `pnpm check` passes.  
  - [x] Optional: `data-testid` on AI toggle and panel for future Playwright (align with existing `post-form` patterns).

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend] — `PostForm.svelte`; AI Manager card toggled like MediaManager; one root under `src/lib/ai/` or `src/lib/components/`.  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §5 Placement, §4 Design system] — Toolbar peer to Add media; card surface; tokens.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/PostForm.svelte` | AI toggle + panel slot |
| `src/lib/components/AiManager.svelte` (new) | Shell / placeholder for Epic 3+ |
| `src/lib/i18n/*.js` | New keys |
| `src/lib/index.ts` | Optional: export `AiManager` only if library consumers need it (`MediaManager` is **not** exported from `index.ts` today—default is **no** new export unless you need the lib bundle surface). |

### Previous story intelligence (Epic 2)

- `aiDB`, credentials API (`saveAiCredential`, `listAiCredentialModelIds`) exist but **are not required** for 3.1 shell-only.

### Scope: create vs edit

- **Primary target:** `PostForm.svelte` as mounted from `LeSpaceBlog.svelte` (new post). That satisfies “create post view.”
- **Edit flows:** The app does not currently embed `PostForm` for in-place editing of an existing post in another shell. If product later adds edit-in-list or a dedicated edit view, replicate the AI toolbar/panel there in a follow-up story—**do not block 3.1** on those routes.

### Testing standards

- `pnpm check` required.  
- `pnpm test` should remain green (no new mocha dependency required for UI-only story unless adding a small component test).

### Git / conventions

- NodeNext `.js` imports in TS/Svelte.  
- Match `MediaManager` / media toggle patterns for consistency.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- `PostForm.svelte`: `showAiPanel`, AI toggle peer to Add media, `AiManager` placeholder panel after `MediaUploader` block; `data-testid` on toggle and panel; form already uses `$isRTL` / `rtl` for toolbar.
- `AiManager.svelte`: placeholder title + subtitle via i18n only; no `store` translation keys.
- All 18 `src/lib/i18n/*.js` files: keys `ai_toggle_show`, `ai_toggle_hide`, `ai_panel_title`, `ai_panel_placeholder` (English placeholder in non-`en` locales per story). Panel region uses `aria-labelledby` to the visible heading (`ai_panel_title`); no separate `ai_region_label` key.
- AI panel wrapper: always in DOM with `hidden={!showAiPanel}` so `#post-form-ai-panel` exists for `aria-controls` when collapsed.
- `test/postFormAiI18n.test.ts`: asserts the four AI keys exist in every locale file.
- `pnpm check` and `pnpm test` pass (including new i18n test).

### File List

- `src/lib/components/PostForm.svelte`
- `src/lib/components/AiManager.svelte` (new)
- `src/lib/i18n/ar.js`, `de.js`, `el.js`, `en.js`, `es.js`, `fa.js`, `fr.js`, `he.js`, `hi.js`, `id.js`, `it.js`, `ka.js`, `nl.js`, `pt.js`, `ru.js`, `th.js`, `tr.js`, `zh.js`
- `test/postFormAiI18n.test.ts`
- `package.json` (test script includes `postFormAiI18n.test.ts`)
- `_bmad-output/implementation-artifacts/stories/3-1-ai-toggle-panel-postform.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-04-02:** Story 3.1 — AI toggle + panel in PostForm, i18n, a11y, no translation API keys in AI path.
- **2026-04-02:** Code review — removed unused `ai_region_label` locale keys (region named via `aria-labelledby`); story **done**.
- **2026-04-02:** `bmad-dev-story` — `AiManager` uses `ai_panel_*` keys; panel uses `hidden` + `aria-labelledby`; added `test/postFormAiI18n.test.ts`.

### Review Findings

- [x] [Review][Patch] **Unused i18n key `ai_region_label`** — All locales defined it, but `PostForm` names the region with **`aria-labelledby="post-form-ai-heading"`** (heading text from `ai_panel_title`). Removed the orphan key from every `src/lib/i18n/*.js` file to avoid translation drift.

- [x] [Review][Dismiss] **“Resolve Imports” hardcoded English** in the same toolbar — Pre-existing; out of story 3.1 scope.

- [x] [Review][Dismiss] **Media toggle uses `{#if}` vs AI panel uses `hidden`** — Intentional: stable `id="post-form-ai-panel"` for `aria-controls` while collapsed; valid a11y pattern.

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Should** | Story implied `MediaManager`-style export from `src/lib/index.ts`; **`MediaManager` is not exported** from package `index.ts` today. | Dev Notes table updated: default **no** `AiManager` export unless required. |
| **Should** | AC says “edit post view” but **`PostForm` is only used for new post** in `LeSpaceBlog`; no separate edit shell using `PostForm`. | Added **Scope: create vs edit** so devs do not search for a non-existent edit `PostForm`. |
| **Should** | **a11y**: `aria-controls` alone is thin without a **named region** (`aria-label` / `role="region"`). | Task 2 expanded: stable `id`, optional `role="region"` + i18n label. |
| **OK** | Epic 3.1 AC and UX-DR refs align with `_bmad-output/planning-artifacts/epics.md` and UX spec §4–5. | — |
| **OK** | Separation from translation keys explicit (UX-DR9). | — |

**Definition of Done (validation):** Story updated; ready for `bmad-dev-story`.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
