---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - ./prd.md
  - ./architecture.md
  - ../project-context.md
  - ../../docs/ai-api-browser-cors-spike-checklist.md
workflowType: ux-design
project_name: bolt-orbitdb-blog
user_name: Nandi
date: '2026-04-02'
status: complete
workflowNote: >-
  Single-pass UX spec for AI Manager (M1) with placeholders for M2–M4. Aligns with existing
  PostForm / MediaManager patterns and design tokens (CSS variables + Tailwind).
---

# UX Design Specification — bolt-orbitdb-blog (AI Manager)

**Author:** Nandi  
**Date:** 2026-04-02

## 1. Scope and inputs

This specification covers **user experience and UI behavior** for:

- **Milestone 1:** AI Manager on **create / edit post** (first-party API, per-model credentials, schema-driven form, media integration, job lifecycle).
- **Milestone 2–4 (preview):** Discovery of remote providers, paid runs, reputation—**interaction principles** only until detailed flows exist.

**Inputs:** [`prd.md`](./prd.md), [`architecture.md`](./architecture.md), [`docs/ai-api-browser-cors-spike-checklist.md`](../../docs/ai-api-browser-cors-spike-checklist.md).

**Out of scope for this document:** Pixel-perfect visual design beyond existing app patterns; implementation code.

---

## 2. Core experience (M1)

**One-line promise:** From the post editor, authors can **configure AI models**, **run a generation**, and **attach the result to the post** using the same mental model as **media**—without confusing **translation** (Settings / separate keys).

**Primary task:** *Run an AI job (e.g. image-to-video) and add the output to my draft.*

**Success criteria (UX):**

- User finds **AI** in **one** obvious place next to existing content tools.
- User understands **which model** is active and **that credentials are per model**, not shared with translation.
- User sees **clear progress and failure** (including CORS / API errors in human language).
- Output appears as **media** the user can insert like other uploads.

---

## 3. Emotional response and tone

| Goal | UX implication |
| --- | --- |
| **Trust** | Masked API keys; short copy that data is encrypted at rest; no key echoed in full. |
| **Control** | Explicit model selection; cancel where technically possible; no silent overwrite of post body. |
| **Competence** | Technical errors mapped to **actionable** messages (“Check URL”, “CORS blocked—see docs”, “Invalid key”). |
| **Calm** | Job running state uses non-alarming loading UI consistent with the rest of the app (no aggressive modals for progress). |

Avoid **dark patterns**: do not bundle “translation API” settings inside AI Manager; do not auto-send post text to AI without explicit user action.

---

## 4. Design system alignment (existing product)

The app already uses:

- **Tailwind** utility classes and **CSS variables** for theming: `var(--text-secondary)`, `var(--border)`, `var(--bg-tertiary)`, `var(--accent)`, `var(--danger)`, etc. (see `PostForm.svelte`).
- **Buttons:** `btn-ghost`, `btn-outline`, `btn-primary`, `btn-sm` patterns.
- **Form controls:** `input`, `label` with `text-xs font-medium` labels; `MultiSelect` for categories.
- **i18n:** **svelte-i18n** — all new user-visible strings **must** use `$_('…')` keys in locale files.

**AI Manager must:**

- Reuse **label / input / button** hierarchy from **PostForm** content row (toolbar pattern: label left, actions right where applicable).
- For expandable panels, mirror the **Add media** toggle: a **text button** (`btn-ghost btn-sm` or link-style consistent with `MediaManager` secondary control) that shows/hides the **card** below.
- Use **the same card surface** as surrounding content: bordered region with `var(--border)` and `var(--bg-tertiary)` where the app already uses it for preview/import blocks.

---

## 5. Information architecture — create / edit post

### 5.1 Placement

- **Content row toolbar** (same row as “Add media”, Markdown help, preview): add **`AI`** (or localized equivalent) as a **peer** to **Add media**—same visual weight, **not** more prominent than primary submit.
- **Expanded panel:** When **AI** is on, show an **AI Manager** block **below** the content editor (or directly under the toolbar block—**same vertical rhythm** as `MediaUploader` when `showMediaUploader` is true). **Do not** replace the markdown editor unless a future mode requires it.

### 5.2 Relationship to Media Manager

- **MediaManager** remains the place for **selected media chips** and the secondary **Add media** control in `MediaManager.svelte`.
- **AI Manager** uses **media** as **inputs** (pick existing + upload via existing pipeline) and **outputs** (new video → appears in media library / selectable list). UX copy should say **“Use from library”** / **“Upload for this job”** where it helps.

### 5.3 Separation from translation

- **No** shared UI block with translation controls.
- Optional: one line of helper text in AI settings sub-area: *“Translation uses separate API settings in Settings.”* (only if user testing shows confusion.)

---

## 6. User journeys (M1)

### Journey A — First-time: register a model and run

1. User opens **Create post**.
2. User clicks **AI** → panel opens (empty or partial config).
3. User chooses **model** (e.g. Kling Pro I2V) from dropdown.
4. User enters **base URL** and **API key** for **that** model (save action).
5. User fills **schema-driven** fields (prompt, image: upload or pick from library, optional advanced fields).
6. User clicks **Run** (or **Generate**).
7. User sees **progress** → **success** with preview/thumbnail of video + **Add to post** / **Attach to media** (exact primary action label TBD; must insert markdown or add to `selectedMedia` consistent with existing media flow).
8. User continues writing and submits post as today.

**Failure points:** invalid URL, CORS (link to internal doc or short explanation), quota, timeout—each with **retry** or **edit config** path.

### Journey B — Returning user

1. User clicks **AI** → saved models listed; last-used model pre-selected if stored.
2. User adjusts inputs and runs **without** re-entering keys (keys masked).

### Journey C — Edit post

Same as create; panel state should **not** destroy draft content when toggling AI.

---

## 7. Screen / component specification (M1)

### 7.1 AI toolbar control

- **Control type:** `button`, `type="button"`.
- **Label:** e.g. `AI` or `$_('ai_manager')` — short.
- **State:** `aria-expanded` tied to panel visibility; `aria-controls` pointing to panel id.

### 7.2 AI Manager panel (card)

**Sections (top to bottom):**

1. **Header row:** Title “AI generation” (i18n) + optional **collapse** (same as toggle).
2. **Model selection:** `<select>` or searchable list if model count grows; show **vendor + model name** (e.g. “Kling v3.0 Pro — Image to video”).
3. **Credentials (per selected model):**  
   - Base URL (text).  
   - API key (password field).  
   - **Save** for this model (explicit save avoids accidental runs with stale config).  
   - Show **masked** key after save (`••••••last4` if available).
4. **Dynamic inputs:** Render from schema—**order:** required fields first (e.g. **image**), then prompt, then optional (negative prompt, duration, etc.).  
   - **Image:** two sub-paths: **Pick from library** (opens compact picker: grid/list of existing `mediaDB` images) and **Upload** (reuse `MediaUploader` or shared uploader component—**same** as post media pipeline per PRD).
5. **Primary action:** **Run generation** — disabled if required fields missing or no saved credentials for this model.
6. **Job status area:**  
   - Idle / Running (spinner + optional step text) / Succeeded / Failed.  
   - **Succeeded:** video preview (native `<video controls>`), **Insert into post** + **Add to selected media** (align with product: one primary, one secondary).
7. **Errors:** Inline alert using `var(--danger)`; no toast-only for blocking errors.

### 7.3 Responsive behavior

- **Mobile:** Panel stacks full width; image picker grid **1 column**; keep touch targets ≥ 44px where possible (buttons).
- **Desktop:** Same layout; max-width consistent with form (no wider than post column if the form is constrained).

### 7.4 Accessibility

- All inputs have **associated `<label>`** or `aria-label`.
- **Keyboard:** Tab order follows visual order; Run disabled state announced.
- **Video preview:** `controls` enabled; **poster** optional for loading.
- **RTL:** Reuse `[dir="rtl"]` patterns from `PostForm` for flex rows in the new panel.

---

## 8. UX patterns (consistency rules)

| Pattern | Rule |
| --- | --- |
| **Toggle panels** | AI panel open/close matches **Add media** / **showMediaUploader** behavior—button label reflects state (e.g. “Hide AI” / “AI”). |
| **Destructive** | Removing a queued job or clearing API key requires **confirm** only if data loss is real (optional MVP: clear key = confirm). |
| **Loading** | Use same **disabled + spinner** convention as other async actions in the app (e.g. resolve imports). |
| **Errors** | Prefer **inline** under the panel; reserve **global** alerts for identity/system failures only. |
| **i18n** | No hardcoded English in new UI. |

---

## 9. Component strategy

| Piece | Approach |
| --- | --- |
| **AiManager.svelte** (new) | Owns panel layout, job state UI, calls services. |
| **Schema form** | Small set of **typed field components** (`SchemaTextarea`, `SchemaFile`, `SchemaSelect`, `SchemaCheckbox`) driven by manifest—avoid one mega-template. |
| **Media** | Reuse **MediaUploader** / media list queries from existing patterns; **no duplicate** IPFS upload logic in AI-only code. |
| **Settings** | Translation stays in **Settings**; AI Manager **does not** embed `aiApiKey` / `aiApiUrl` from store. |

---

## 10. Future milestones (UX principles only)

| Milestone | UX principle |
| --- | --- |
| **M2 Remote** | Add **source** toggle: **This device (API)** vs **Network (peer)**; peer list with **model badges**; explain **no API key** needed for remote when applicable. |
| **M3 Payment** | Show **price** / **approval** step before run; clear **receipt** / tx reference; never show full prompt on chain in UI copy. |
| **M4 Reputation** | Optional **Trust** / **feedback** affordance after successful remote job; **gas** warning before chain txs. |

---

## 11. Open UX decisions (to validate in build)

1. **Primary success action** name: “Insert into post” vs “Add markdown” vs only “Add to media library”—depends on final markdown insertion helper.
2. **Where** to manage **multiple models** (inline list vs “Manage models” sub-dialog)—start **inline** if ≤ 5 models.
3. **CORS failure** copy: link to [`docs/ai-api-browser-cors-spike-checklist.md`](../../docs/ai-api-browser-cors-spike-checklist.md) from a **Learn more** in error state (optional).

---

## 12. Traceability

| PRD area | UX section |
| --- | --- |
| SC-1, FR-1 | §5–§7 toolbar + panel |
| SC-2–SC-3 | §7.2 credentials + dynamic form |
| SC-4–SC-5 | §5.2, §7.2 image + output |
| Translation separation | §5.3 |
| NFR i18n | §4, §8 |

---

_End of UX Design Specification._
