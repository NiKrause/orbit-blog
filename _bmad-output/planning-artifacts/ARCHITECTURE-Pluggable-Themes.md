---
title: Pluggable Themes Architecture
version: 0.3
date: 2026-04-17
status: approved
decision_record: CA-0001
---

# Pluggable Themes System — Architecture

## Executive Summary

**Objective:** Enable users to switch between pre-built themes and create custom themes with granular control over colors, typography, layout, and spacing.

**Key Decisions:**
- Theme Definition: JSON-based format for runtime flexibility
- Storage: OrbitDB (SettingsDB) with collapsible UI section
- Default Themes: 5 curated themes inspired by top blogging platforms
- Customization Level: Advanced (3) — full control over colors, typography, layout, spacing

---

## 1. Theme Data Model (JSON Format)

### Theme Object Structure

```typescript
interface Theme {
  id: string;                      // Unique identifier (e.g., "minimal-light", "custom-nandi-2026")
  name: string;                    // Display name
  description: string;             // Short description
  category: "default" | "custom";  // Built-in or user-created
  colors: {
    surfaces: {
      default: string;             // #ffffff
      secondary: string;           // #f7f7f8
      tertiary: string;            // #ededf0
      hover: string;               // #f0f0f2
      active: string;              // #e8e8ec
    };
    content: {
      default: string;             // #111111
      secondary: string;           // #555555
      muted: string;               // #8b8b8b
      inverse: string;             // #ffffff
    };
    borders: {
      default: string;             // #e2e2e5
      subtle: string;              // #efefef
    };
    accents: {
      primary: string;             // #111111
      primaryHover: string;        // #333333
      danger: string;              // #dc2626
      dangerHover: string;         // #b91c1c
      success: string;             // #10b981
      warning: string;             // #f59e0b
    };
    shadows: {
      sm: string;                  // "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      default: string;             // "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      lg: string;                  // "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
    };
  };
  typography: {
    fontFamily: {
      base: string;                // "Inter, system-ui, sans-serif"
      heading: string;             // "Inter, system-ui, sans-serif"
      mono: string;                // "Menlo, monospace"
    };
    fontSize: {
      xs: string;                  // "0.75rem"
      sm: string;                  // "0.875rem"
      base: string;                // "1rem"
      lg: string;                  // "1.125rem"
      xl: string;                  // "1.25rem"
      "2xl": string;               // "1.5rem"
      "3xl": string;               // "1.875rem"
      "4xl": string;               // "2.25rem"
    };
    fontWeight: {
      normal: number;              // 400
      medium: number;              // 500
      semibold: number;            // 600
      bold: number;                // 700
    };
    lineHeight: {
      tight: number;               // 1.2
      normal: number;              // 1.5
      relaxed: number;             // 1.75
    };
  };
  layout: {
    maxContentWidth: string;       // "65ch" or "800px"
    spacing: {
      xs: string;                  // "0.25rem"
      sm: string;                  // "0.5rem"
      md: string;                  // "1rem"
      lg: string;                  // "1.5rem"
      xl: string;                  // "2rem"
      "2xl": string;               // "3rem"
    };
    borderRadius: {
      sm: string;                  // "0.25rem"
      md: string;                  // "0.375rem"
      lg: string;                  // "0.5rem"
      xl: string;                  // "0.75rem"
    };
    transitions: {
      fast: string;                // "150ms"
      normal: string;              // "250ms"
      slow: string;                // "350ms"
    };
  };
  darkMode?: boolean;              // Enable dark variant
  metadata: {
    creator: string;               // "Nandi" or "Default"
    createdAt: string;             // ISO 8601 timestamp
    updatedAt: string;
    preview?: string;              // URL to preview image
  };
}
```

### Default Themes

#### 1. **minimal-light**
```json
{
  "id": "minimal-light",
  "name": "Minimal Clean",
  "description": "Minimalist light theme with emphasis on content",
  "category": "default",
  "colors": { ... },
  "typography": { ... },
  "layout": { ... }
}
```

#### 2. **magazine-editorial**
```json
{
  "id": "magazine-editorial",
  "name": "Magazine Editorial",
  "description": "Magazine-style layout inspired by editorial websites"
}
```

#### 3. **dark-mode-variant**
```json
{
  "id": "dark-mode-variant",
  "name": "Dark Mode",
  "description": "Dark theme for reduced eye strain",
  "darkMode": true
}
```

#### 4. **medium-style**
```json
{
  "id": "medium-style",
  "name": "Medium.com Style",
  "description": "Minimalist design inspired by Medium blogging platform"
}
```

#### 5. **substack-style**
```json
{
  "id": "substack-style",
  "name": "Substack Style",
  "description": "Newsletter-focused design inspired by Substack"
}
```

---

## 2. Storage Architecture — OrbitDB Integration

### SettingsDB Schema Extension

**Current Structure:** SettingsDB stores blog settings (blogName, blogDescription, etc.)

**New Section:** Add `themes` key to SettingsDB

```typescript
// In SettingsDB document
{
  blogName: "Le Space Blog",
  blogDescription: "...",
  categories: [...],
  author: {...},
  
  // NEW: Themes Configuration
  themes: {
    current: "minimal-light",           // Currently active theme ID
    installed: [
      { id: "minimal-light", ... },     // Default theme object
      { id: "magazine-editorial", ... },
      { id: "dark-mode-variant", ... },
      { id: "medium-style", ... },
      { id: "substack-style", ... },
      { id: "custom-nandi-1", ... }     // Custom theme
    ],
    lastModified: "2026-04-17T10:00:00Z"
  }
}
```

### Benefits of OrbitDB Storage

- ✅ **Persistence:** Themes persist across sessions
- ✅ **Sync:** Themes sync across devices if user replicates SettingsDB
- ✅ **Versioning:** Built-in history of theme changes
- ✅ **Multi-user:** Future support for shared blog instances

---

## 3. File Structure & Components

### New Directory Structure

```
src/lib/
├── themes/
│   ├── index.ts                    // Theme system exports
│   ├── defaults.ts                 // 5 default theme definitions
│   ├── themeStore.ts               // Svelte store for active theme
│   ├── themeProvider.svelte        # Root component (injects CSS vars)
│   ├── useTheme.ts                 // Composable for theme management
│   ├── types.ts                    // TypeScript interfaces
│   └── utils.ts                    // Theme validation, parsing, etc.
└── components/
    ├── ThemeToggle.svelte          # Updated: Dropdown instead of button
    ├── ThemeCustomizer.svelte       # NEW: Advanced customization UI
    └── ThemePicker.svelte           # NEW: Theme selection grid
```

### Core Files

#### `src/lib/themes/types.ts`
```typescript
export interface Theme {
  id: string;
  name: string;
  description: string;
  category: "default" | "custom";
  colors: { ... };
  typography: { ... };
  layout: { ... };
  darkMode?: boolean;
  metadata: { ... };
}

export interface ThemeState {
  current: string;           // Active theme ID
  installed: Theme[];        // All available themes
  lastModified: string;
}
```

#### `src/lib/themes/defaults.ts`
Exports the 5 default Theme objects as constants.

#### `src/lib/themes/themeStore.ts`
```typescript
import { writable, derived } from 'svelte/store';
import type { Theme } from './types.js';

export const themeState = writable<ThemeState | null>(null);
export const currentTheme = derived(themeState, $state => 
  $state?.installed.find(t => t.id === $state.current)
);

export async function loadThemesFromDB() {
  // Fetch from SettingsDB
  // Initialize with defaults if empty
}

export async function setActiveTheme(themeId: string) {
  // Switch active theme
  // Save to SettingsDB
}

export async function saveCustomTheme(theme: Theme) {
  // Validate theme
  // Add to SettingsDB.themes.installed
}

export async function deleteCustomTheme(themeId: string) {
  // Remove from SettingsDB
}
```

#### `src/lib/themes/themeProvider.svelte`
```svelte
<script>
  import { currentTheme } from './themeStore.js';
  
  function applyThemeToDOM(theme: Theme | null) {
    if (!theme) return;
    
    const root = document.documentElement;
    
    // Apply color CSS variables
    root.style.setProperty('--bg', theme.colors.surfaces.default);
    root.style.setProperty('--text', theme.colors.content.default);
    // ... more variables
    
    // Apply typography
    root.style.setProperty('--font-base', theme.typography.fontFamily.base);
    root.style.setProperty('--font-size-base', theme.typography.fontSize.base);
    // ... more variables
    
    // Apply layout
    root.style.setProperty('--max-content-width', theme.layout.maxContentWidth);
    root.style.setProperty('--spacing-md', theme.layout.spacing.md);
    // ... more variables
    
    // Store in localStorage for persistence
    localStorage.setItem('active-theme-id', theme.id);
  }
  
  $effect(() => {
    applyThemeToDOM($currentTheme);
  });
</script>

<slot />
```

#### `src/lib/themes/useTheme.ts`
```typescript
import { currentTheme, setActiveTheme, saveCustomTheme, deleteCustomTheme } from './themeStore.js';

export function useTheme() {
  return {
    currentTheme,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
  };
}
```

---

## 4. UI Integration

### Settings Panel Extension

**Location:** `src/lib/components/Settings.svelte`

**New Collapsible Section:**
```svelte
<section class="themes-settings">
  <button onclick={() => toggleThemeSection()}>
    🎨 Theme Settings
  </button>
  
  {#if themesSectionOpen}
    <div class="theme-controls">
      <!-- Theme Picker -->
      <ThemePicker onSelect={setActiveTheme} />
      
      <!-- Active Theme Info -->
      <div class="active-theme-info">
        <h4>{$currentTheme.name}</h4>
        <p>{$currentTheme.description}</p>
      </div>
      
      <!-- Theme Customizer (if custom theme selected) -->
      {#if $currentTheme.category === 'custom'}
        <ThemeCustomizer theme={$currentTheme} onSave={saveCustomTheme} />
      {/if}
      
      <!-- Create Custom Theme Button -->
      <button onclick={() => createCustomThemeFromCurrent()}>
        + Create Custom Theme
      </button>
      
      <!-- Export / Import -->
      <div class="theme-actions">
        <button onclick={exportTheme}>⬇️ Export Theme</button>
        <button onclick={importTheme}>⬆️ Import Theme</button>
      </div>
    </div>
  {/if}
</section>
```

### Theme Picker Component

Displays grid of available themes with preview images/colors.

### Theme Customizer Component

Advanced form with sections for:
- Color Palette Editor
- Typography Controls (font, size, weight, line-height)
- Layout Settings (max-width, spacing, border-radius)
- Transitions & Effects

---

## 5. Implementation Plan (v0.3 Epics)

### Epic 1: Theme Data Model & Defaults
- [ ] Define Theme TypeScript interface
- [ ] Create 5 default theme objects
- [ ] Add validation utilities

### Epic 2: OrbitDB Integration
- [ ] Extend SettingsDB schema
- [ ] Load themes from DB on startup
- [ ] Save active theme preference
- [ ] Add custom theme CRUD operations

### Epic 3: Svelte Store & Provider
- [ ] Create themeStore with reactive state
- [ ] Build ThemeProvider component
- [ ] Integrate CSS variable injection
- [ ] Add localStorage fallback

### Epic 4: Settings UI
- [ ] Update Settings.svelte with themes section
- [ ] Build ThemePicker component
- [ ] Build ThemeCustomizer form
- [ ] Add export/import functionality

### Epic 5: Testing & Polish
- [ ] Unit tests for theme validation
- [ ] E2E tests for theme switching
- [ ] Documentation for custom theme creation

---

## 6. API Examples

### Switch Theme
```typescript
import { setActiveTheme } from '$lib/themes/themeStore.js';

await setActiveTheme('magazine-editorial');
```

### Create Custom Theme
```typescript
import { saveCustomTheme } from '$lib/themes/themeStore.js';

const customTheme: Theme = {
  id: 'custom-nandi-dark',
  name: 'My Dark Theme',
  description: 'Custom dark theme',
  category: 'custom',
  colors: { ... },
  typography: { ... },
  layout: { ... },
  metadata: {
    creator: 'Nandi',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

await saveCustomTheme(customTheme);
```

### Access Current Theme
```typescript
import { currentTheme } from '$lib/themes/themeStore.js';

$: console.log($currentTheme.colors.accents.primary);
```

---

## 7. Dependencies & Compatibility

- ✅ **Svelte 5:** Uses `$effect` for reactive theme application
- ✅ **Tailwind CSS 3.4:** Already uses CSS variables in colors
- ✅ **TypeScript:** Full type safety for themes
- ✅ **OrbitDB:** Integrated with SettingsDB persistence
- ❌ **No new dependencies** required

---

## 8. Migration & Rollout

### Phase 1: Default Themes Only
- Users can switch between 5 built-in themes
- No custom theme creation yet

### Phase 2: Custom Themes
- Add ThemeCustomizer component
- Enable create/edit/delete custom themes

### Phase 3: Advanced Features (Future)
- Theme marketplace/sharing
- Theme preview before switching
- Keyboard shortcuts for theme switching

---

## 9. Success Criteria (v0.3)

- ✅ All 5 default themes implemented and tested
- ✅ Theme switching works without page reload
- ✅ Themes persist in OrbitDB across sessions
- ✅ Custom theme creation/editing works
- ✅ UI is intuitive and accessible
- ✅ Documentation for users & developers

---

## Appendix: Decision Rationale

| Decision | Rationale |
|----------|-----------|
| JSON-based themes | Runtime flexibility, easy export/import, future API integration |
| OrbitDB storage | Persistent, syncable, aligns with decentralized design |
| 5 default themes | Covers common blogging use cases (minimal, editorial, dark, medium, substack) |
| Level 3 customization | Gives users creative control without being overwhelming |
| Collapsible SettingsDB section | Keeps UI clean, themes are secondary to core blog features |

---

**Status:** ✅ Ready for Epics & Stories  
**Next Step:** `[CE] Create Epics and Stories`
