---
title: Pluggable Themes — Epics and Stories
version: 0.3
date: 2026-04-17
status: ready-for-sprint-planning
architecture: ARCHITECTURE-Pluggable-Themes.md
---

# v0.3 Pluggable Themes — Epics & Stories

## Overview

This document breaks down the **5 Implementation Epics** from the Architecture into **15 User Stories** for v0.3 Milestone.

**Total Estimated Effort:** ~13 story points (assuming 2-point base units)

---

## Epic 1: Theme Data Model & Defaults

**Epic ID:** `E-THEMES-001`  
**Description:** Define the Theme TypeScript interface and create 5 default theme definitions.  
**Estimated Effort:** 3 story points  
**Dependencies:** None

---

### Story 1.1: Define Theme TypeScript Interface
**Story ID:** `THEMES-001`  
**Title:** Create Theme interface with color, typography, layout properties  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a comprehensive TypeScript interface (`Theme`) that defines the structure for all theme objects. The interface should include nested objects for colors, typography, layout, and metadata.

**Acceptance Criteria:**
- [ ] `src/lib/themes/types.ts` created with Theme interface
- [ ] Includes all required properties: id, name, description, category, colors, typography, layout, darkMode, metadata
- [ ] Type safety for nested color objects (surfaces, content, borders, accents, shadows)
- [ ] Type safety for typography (fontFamily, fontSize, fontWeight, lineHeight)
- [ ] Type safety for layout (maxContentWidth, spacing, borderRadius, transitions)
- [ ] Metadata includes creator, createdAt, updatedAt, and optional preview URL
- [ ] Documentation comments for each property
- [ ] Unit tests verify interface structure

**Acceptance Criteria Details:**
```typescript
✅ Compiles without errors
✅ All properties are typed (no `any`)
✅ Optional properties marked as `?`
✅ Enum for category: "default" | "custom"
✅ Export for use in other modules
```

**Definition of Done:**
- TypeScript compiles without errors
- Exported in `src/lib/themes/index.ts`
- Documented in architecture

---

### Story 1.2: Create Minimal/Clean Light Default Theme
**Story ID:** `THEMES-002`  
**Title:** Define minimal-light theme constants  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a complete default Theme object for "Minimal/Clean Light" theme with all color, typography, and layout values.

**Acceptance Criteria:**
- [ ] `src/lib/themes/defaults.ts` created
- [ ] `minimalLightTheme` constant defined with id="minimal-light"
- [ ] All colors defined: surfaces, content, borders, accents, shadows
- [ ] Typography defined: fontFamily (Inter), sizes, weights, line-heights
- [ ] Layout defined: maxContentWidth, spacing, borderRadius, transitions
- [ ] Metadata includes creator="Default", timestamps
- [ ] Theme validates against Theme interface
- [ ] Export default theme as constant

**Color Values Reference:**
```json
{
  "surfaces": { "default": "#ffffff", "secondary": "#f7f7f8", ... },
  "content": { "default": "#111111", "secondary": "#555555", ... },
  "accents": { "primary": "#111111", "primaryHover": "#333333", ... }
}
```

---

### Story 1.3: Create Magazine/Editorial Default Theme
**Story ID:** `THEMES-003`  
**Title:** Define magazine-editorial theme constants  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a Magazine/Editorial themed Theme object inspired by editorial websites. Should have distinct typography (serif headlines) and layout optimizations for content-heavy blogs.

**Acceptance Criteria:**
- [ ] `magazineEditorialTheme` constant in defaults.ts with id="magazine-editorial"
- [ ] Serif font family for headings
- [ ] Larger line-height for better readability
- [ ] Optimized spacing for long-form content
- [ ] Color palette suitable for editorial design
- [ ] maxContentWidth set to ~800px
- [ ] Theme validates against interface

**Key Differences from Minimal:**
- Heading font: "Georgia, serif" or similar
- Content line-height: 1.75 (higher than minimal)
- Larger font sizes for headings

---

### Story 1.4: Create Dark Mode Variant Default Theme
**Story ID:** `THEMES-004`  
**Title:** Define dark-mode-variant theme constants  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a Dark Mode Theme object for reduced eye strain and modern aesthetic. Inverse color palette with light text on dark backgrounds.

**Acceptance Criteria:**
- [ ] `darkModeVariantTheme` constant with id="dark-mode-variant"
- [ ] `darkMode: true` flag set
- [ ] Inverted color palette: dark surfaces, light text
- [ ] Proper contrast ratios (WCAG AA minimum)
- [ ] All accents adapted for dark backgrounds
- [ ] Shadow definitions adjusted for dark mode
- [ ] Metadata notes "dark mode variant"

**Color Palette:**
```json
{
  "surfaces": { "default": "#1a1a1a", "secondary": "#242424", ... },
  "content": { "default": "#e5e5e5", "secondary": "#b0b0b0", ... }
}
```

---

### Story 1.5: Create Medium.com Style Default Theme
**Story ID:** `THEMES-005`  
**Title:** Define medium-style theme constants  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a minimalist theme inspired by Medium.com's design philosophy: clean, elegant, focused on typography.

**Acceptance Criteria:**
- [ ] `mediumStyleTheme` constant with id="medium-style"
- [ ] Font: -apple-system, BlinkMacSystemFont, or similar system fonts
- [ ] Generous whitespace around content
- [ ] Subtle shadows and borders
- [ ] Neutral color palette (mostly grays and blacks)
- [ ] Typography optimized for scanning

---

### Story 1.6: Create Substack Style Default Theme
**Story ID:** `THEMES-006`  
**Title:** Define substack-style theme constants  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a newsletter-focused theme inspired by Substack's design. Emphasizes community and email aesthetics.

**Acceptance Criteria:**
- [ ] `substackStyleTheme` constant with id="substack-style"
- [ ] Warm, inviting color palette
- [ ] Typography for newsletter-style posts
- [ ] Emphasis on author/creator identity
- [ ] Call-to-action friendly spacing

---

## Epic 2: OrbitDB Integration

**Epic ID:** `E-THEMES-002`  
**Description:** Integrate theme storage and retrieval with OrbitDB SettingsDB.  
**Estimated Effort:** 3 story points  
**Dependencies:** Epic 1 (needs Theme interface)

---

### Story 2.1: Extend SettingsDB Schema for Themes
**Story ID:** `THEMES-007`  
**Title:** Add themes section to SettingsDB  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Document and implement the schema extension for SettingsDB to include a `themes` key with current active theme ID and installed themes array.

**Acceptance Criteria:**
- [ ] SettingsDB document structure documented
- [ ] `themes` key added with structure:
  ```json
  {
    "current": "theme-id",
    "installed": [...],
    "lastModified": "ISO timestamp"
  }
  ```
- [ ] All 5 default themes added to SettingsDB on first initialization
- [ ] Migration logic handles existing SettingsDB (backward compatible)
- [ ] Tested with local OrbitDB instance

---

### Story 2.2: Implement loadThemesFromDB Function
**Story ID:** `THEMES-008`  
**Title:** Fetch themes from SettingsDB on startup  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create async function to load themes from SettingsDB. If themes don't exist (first launch), initialize with 5 default themes.

**Acceptance Criteria:**
- [ ] `loadThemesFromDB()` exported from `src/lib/themes/themeStore.ts`
- [ ] Retrieves themes.current and themes.installed from SettingsDB
- [ ] Falls back to defaults if themes key missing
- [ ] Returns ThemeState object
- [ ] Handles errors gracefully (logs, returns defaults)
- [ ] Updates themeState store with loaded themes
- [ ] Unit tests for success and error cases

---

### Story 2.3: Implement setActiveTheme Function
**Story ID:** `THEMES-009`  
**Title:** Switch active theme and persist to DB  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create async function to change the active theme by ID, validate it exists, and persist the change to SettingsDB.

**Acceptance Criteria:**
- [ ] `setActiveTheme(themeId: string)` function created
- [ ] Validates theme ID exists in installed themes
- [ ] Updates SettingsDB.themes.current with new ID
- [ ] Updates themeState store
- [ ] Updates lastModified timestamp
- [ ] Throws error if theme not found
- [ ] Unit tests for valid/invalid theme IDs

---

### Story 2.4: Implement saveCustomTheme Function
**Story ID:** `THEMES-010`  
**Title:** Save custom theme to SettingsDB  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create async function to validate and save a custom theme to SettingsDB.themes.installed.

**Acceptance Criteria:**
- [ ] `saveCustomTheme(theme: Theme)` function created
- [ ] Validates theme object against Theme interface
- [ ] Checks category is "custom"
- [ ] Prevents overwriting default themes
- [ ] Generates unique ID if not provided
- [ ] Updates SettingsDB
- [ ] Updates themeState store
- [ ] Unit tests for validation errors

---

### Story 2.5: Implement deleteCustomTheme Function
**Story ID:** `THEMES-011`  
**Title:** Delete custom theme from SettingsDB  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create async function to remove a custom theme from SettingsDB. Should not allow deletion of default themes.

**Acceptance Criteria:**
- [ ] `deleteCustomTheme(themeId: string)` function created
- [ ] Prevents deletion of default themes (category === "default")
- [ ] Removes theme from SettingsDB.themes.installed
- [ ] If deleted theme is active, switches to minimal-light
- [ ] Updates lastModified timestamp
- [ ] Unit tests

---

## Epic 3: Svelte Store & Theme Provider

**Epic ID:** `E-THEMES-003`  
**Description:** Create reactive Svelte stores and ThemeProvider component for runtime theme application.  
**Estimated Effort:** 3 story points  
**Dependencies:** Epic 1, 2

---

### Story 3.1: Create themeState Svelte Store
**Story ID:** `THEMES-012`  
**Title:** Define themeState writable store  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a writable Svelte store to hold the current ThemeState (current theme ID, installed themes list).

**Acceptance Criteria:**
- [ ] `themeState` writable store created in `themeStore.ts`
- [ ] Type: `Writable<ThemeState | null>`
- [ ] Initial value is null
- [ ] Exported for use in components
- [ ] Derived store `currentTheme` created (finds active theme from state)

---

### Story 3.2: Create ThemeProvider Svelte Component
**Story ID:** `THEMES-013`  
**Title:** Build ThemeProvider component to inject CSS variables  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create `ThemeProvider.svelte` component that applies theme colors, typography, and layout as CSS variables on the document root.

**Acceptance Criteria:**
- [ ] `src/lib/themes/ThemeProvider.svelte` created
- [ ] Uses `$effect` to reactively apply CSS variables when theme changes
- [ ] Sets all color CSS variables: --bg, --text, --accent, --danger, etc.
- [ ] Sets typography variables: --font-base, --font-size-base, etc.
- [ ] Sets layout variables: --max-content-width, --spacing-md, etc.
- [ ] Persists active theme ID to localStorage
- [ ] Component wraps entire app in App.svelte
- [ ] No props required (uses store)

**CSS Variables Applied:**
```css
--bg, --bg-secondary, --bg-tertiary, --bg-hover, --bg-active
--text, --text-secondary, --text-muted, --text-inverse
--border, --border-subtle
--accent, --accent-hover, --danger, --danger-hover, --success, --warning
--shadow-sm, --shadow, --shadow-lg
--font-base, --font-heading, --font-mono
--font-size-base, --font-size-sm, --font-size-lg, etc.
--spacing-xs, --spacing-sm, --spacing-md, etc.
```

---

### Story 3.3: Create useTheme Composable
**Story ID:** `THEMES-014`  
**Title:** Build useTheme composable for accessing theme functions  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Create a TypeScript composable that exports all theme-related functions and stores for easy access in components.

**Acceptance Criteria:**
- [ ] `src/lib/themes/useTheme.ts` created
- [ ] Exports: currentTheme store, setActiveTheme, saveCustomTheme, deleteCustomTheme
- [ ] Type-safe exports
- [ ] Used like: `const { currentTheme, setActiveTheme } = useTheme()`
- [ ] Documentation with examples

---

### Story 3.4: Integrate ThemeProvider into App.svelte
**Story ID:** `THEMES-015`  
**Title:** Wrap App.svelte with ThemeProvider  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Update `App.svelte` to wrap all content with ThemeProvider component so CSS variables are applied globally.

**Acceptance Criteria:**
- [ ] `ThemeProvider` imported and wrapped around `<slot />`
- [ ] Verify app loads with theme applied on first visit
- [ ] Check localStorage persistence works
- [ ] E2E test: theme persists after page reload

---

## Epic 4: Settings UI

**Epic ID:** `E-THEMES-004`  
**Description:** Build UI components for theme selection, preview, and customization.  
**Estimated Effort:** 3 story points  
**Dependencies:** Epic 2, 3

---

### Story 4.1: Update ThemeToggle to Dropdown
**Story ID:** `THEMES-016`  
**Title:** Refactor ThemeToggle.svelte into theme dropdown  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Update the existing `ThemeToggle.svelte` component from a simple button to a dropdown that lists all available themes.

**Acceptance Criteria:**
- [ ] Component displays current theme name
- [ ] Dropdown shows all installed themes (default + custom)
- [ ] Clicking theme switches to it immediately
- [ ] Visual indicator for active theme
- [ ] Loading state while switching
- [ ] Accessible: keyboard navigation, ARIA labels

---

### Story 4.2: Build ThemePicker Grid Component
**Story ID:** `THEMES-017`  
**Title:** Create visual theme picker with color preview  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Build `ThemePicker.svelte` component that displays themes as a grid with visual color previews.

**Acceptance Criteria:**
- [ ] `src/lib/components/ThemePicker.svelte` created
- [ ] Displays all themes in responsive grid (2-3 columns)
- [ ] Each card shows: theme name, description, color palette preview
- [ ] Click to select theme
- [ ] Visual highlight for active theme
- [ ] "+" button to create custom theme
- [ ] Scrollable if many themes

---

### Story 4.3: Extend Settings.svelte with Themes Section
**Story ID:** `THEMES-018`  
**Title:** Add collapsible themes section to Settings panel  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Update `Settings.svelte` to include a new collapsible "🎨 Theme Settings" section with ThemePicker.

**Acceptance Criteria:**
- [ ] New collapsible section added (starts closed)
- [ ] Section title: "🎨 Theme Settings"
- [ ] ThemePicker component rendered inside
- [ ] Active theme details displayed
- [ ] Export/Import buttons below picker
- [ ] Responsive layout on mobile

---

### Story 4.4: Build ThemeCustomizer Component
**Story ID:** `THEMES-019`  
**Title:** Create advanced theme customization form  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Build `ThemeCustomizer.svelte` component with controls for editing colors, typography, and layout of a custom theme.

**Acceptance Criteria:**
- [ ] `src/lib/components/ThemeCustomizer.svelte` created
- [ ] Renders only if editing a custom theme
- [ ] Tabs for: Colors, Typography, Layout
- [ ] Color picker inputs for all color tokens
- [ ] Font family, size, weight dropdowns for typography
- [ ] Spacing, border-radius sliders for layout
- [ ] Live preview of changes
- [ ] Save button to persist to DB
- [ ] Cancel/Reset options

**Color Tab:**
```
- Surface Colors: bg, bg-secondary, bg-tertiary, bg-hover, bg-active
- Text Colors: text, text-secondary, text-muted, text-inverse
- Border Colors: border, border-subtle
- Accent Colors: primary, primary-hover
- Semantic: danger, danger-hover, success, warning
```

**Typography Tab:**
```
- Font Family: base, heading, mono (with system font recommendations)
- Font Sizes: xs, sm, base, lg, xl, 2xl, 3xl, 4xl
- Font Weights: normal, medium, semibold, bold
- Line Heights: tight, normal, relaxed
```

**Layout Tab:**
```
- Max Content Width: input
- Spacing Scale: xs, sm, md, lg, xl, 2xl
- Border Radius: sm, md, lg, xl
- Transitions: fast, normal, slow
```

---

### Story 4.5: Implement Export/Import Theme
**Story ID:** `THEMES-020`  
**Title:** Add export/import functionality for themes  
**Type:** Feature  
**Effort:** 1 pt

**Description:**
Add buttons to export active theme as JSON file and import a custom theme from JSON.

**Acceptance Criteria:**
- [ ] Export button: downloads theme as `theme-{name}.json`
- [ ] Import button: file picker, validates JSON against Theme interface
- [ ] Successful import: adds theme to installed list
- [ ] Error handling: shows validation errors
- [ ] Can share themes with other users

---

## Epic 5: Testing & Polish

**Epic ID:** `E-THEMES-005`  
**Description:** Unit tests, E2E tests, documentation, and refinement.  
**Estimated Effort:** 1 story point  
**Dependencies:** Epic 1-4

---

### Story 5.1: Unit Tests for Theme Validation
**Story ID:** `THEMES-021`  
**Title:** Write unit tests for theme validation and utilities  
**Type:** Quality  
**Effort:** 1 pt

**Description:**
Create comprehensive unit tests for theme validation, parsing, and utility functions.

**Acceptance Criteria:**
- [ ] Test file: `test/themes.test.ts`
- [ ] Tests for Theme interface compliance
- [ ] Tests for loadThemesFromDB
- [ ] Tests for setActiveTheme with valid/invalid IDs
- [ ] Tests for saveCustomTheme validation
- [ ] Tests for deleteCustomTheme with default theme protection
- [ ] Coverage > 80%
- [ ] All tests pass

---

### Story 5.2: E2E Tests for Theme Switching
**Story ID:** `THEMES-022`  
**Title:** Write Playwright E2E tests for theme UX  
**Type:** Quality  
**Effort:** 1 pt

**Description:**
Create end-to-end tests for the complete theme switching workflow.

**Acceptance Criteria:**
- [ ] Test file: `tests/ThemeSwitching.spec.ts`
- [ ] Test: Switch from minimal-light to magazine-editorial
- [ ] Test: CSS variables update correctly
- [ ] Test: Theme persists after page reload
- [ ] Test: Create custom theme
- [ ] Test: Edit custom theme colors
- [ ] Test: Delete custom theme
- [ ] Test: Export and import theme
- [ ] All tests pass in headless mode

---

### Story 5.3: Documentation for Users
**Story ID:** `THEMES-023`  
**Title:** Write theme user guide and FAQ  
**Type:** Documentation  
**Effort:** 1 pt

**Description:**
Create user-facing documentation explaining how to use, customize, and share themes.

**Acceptance Criteria:**
- [ ] File: `docs/THEMES-USER-GUIDE.md`
- [ ] Sections: Overview, Using Themes, Creating Custom Themes, Export/Import, Troubleshooting
- [ ] Screenshots/GIFs of theme switching
- [ ] Example custom theme JSON
- [ ] FAQ section
- [ ] Accessible language (non-technical)

---

### Story 5.4: Documentation for Developers
**Story ID:** `THEMES-024`  
**Title:** Write theme developer guide  
**Type:** Documentation  
**Effort:** 1 pt

**Description:**
Create developer documentation for extending themes or creating new themes programmatically.

**Acceptance Criteria:**
- [ ] File: `docs/THEMES-DEVELOPER-GUIDE.md`
- [ ] Sections: Theme Object Structure, Creating Themes, Using useTheme, API Reference
- [ ] Code examples
- [ ] Type definitions reference
- [ ] Performance considerations

---

## Sprint Planning Roadmap

### Sprint 1 (Week 1-2): Foundation & Defaults
**Stories:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6  
**Focus:** Theme data model and 5 default themes  
**Effort:** 6 pts

### Sprint 2 (Week 3-4): Database & Store
**Stories:** 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3  
**Focus:** OrbitDB integration and Svelte stores  
**Effort:** 8 pts

### Sprint 3 (Week 5-6): UI & Components
**Stories:** 3.4, 4.1, 4.2, 4.3, 4.4, 4.5  
**Focus:** Settings UI and customizer  
**Effort:** 6 pts

### Sprint 4 (Week 7): Testing & Deployment
**Stories:** 5.1, 5.2, 5.3, 5.4  
**Focus:** Tests, documentation, refinement  
**Effort:** 4 pts

---

## Success Criteria (v0.3 Complete)

- ✅ All 24 stories completed and tested
- ✅ All 5 default themes working
- ✅ Theme switching without page reload
- ✅ Custom theme creation/edit/delete working
- ✅ Themes persist in OrbitDB
- ✅ Unit test coverage > 80%
- ✅ E2E tests pass
- ✅ User & developer documentation complete
- ✅ No known bugs
- ✅ Ready for v0.4 (Enhanced Features)

---

**Status:** ✅ Ready for Sprint Planning  
**Next Step:** `[SP] Sprint Planning`
