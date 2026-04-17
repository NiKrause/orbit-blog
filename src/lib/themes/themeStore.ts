import { writable, derived, get } from 'svelte/store';
import { DEFAULT_THEMES, isValidTheme, type Theme, type ThemeState } from './index.js';

const THEME_STATE_DB_KEY = 'themeState';

const defaultThemeState: ThemeState = {
  current: DEFAULT_THEMES[0].id,
  installed: DEFAULT_THEMES,
  lastModified: new Date().toISOString(),
};

export const themeState = writable<ThemeState>(defaultThemeState);
export const currentTheme = derived(themeState, ($themeState) => {
  return $themeState.installed.find((theme) => theme.id === $themeState.current) ?? DEFAULT_THEMES[0];
});
export const installedThemes = derived(themeState, ($themeState) => $themeState.installed);
export const currentThemeId = derived(themeState, ($themeState) => $themeState.current);

function themeObjectIsValid(theme: unknown): theme is Theme {
  return isValidTheme(theme);
}

function themeStateIsValid(value: unknown): value is ThemeState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const installed = state.installed;
  if (!Array.isArray(installed) || typeof state.current !== 'string') return false;
  if (typeof state.lastModified !== 'string') return false;
  return installed.every(themeObjectIsValid);
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme.id;

  const styleMap = {
    '--color-surface-default': theme.colors.surfaces.default,
    '--color-surface-secondary': theme.colors.surfaces.secondary,
    '--color-surface-tertiary': theme.colors.surfaces.tertiary,
    '--color-surface-hover': theme.colors.surfaces.hover,
    '--color-surface-active': theme.colors.surfaces.active,

    '--color-text-default': theme.colors.content.default,
    '--color-text-secondary': theme.colors.content.secondary,
    '--color-text-muted': theme.colors.content.muted,
    '--color-text-inverse': theme.colors.content.inverse,

    '--color-border-default': theme.colors.borders.default,
    '--color-border-subtle': theme.colors.borders.subtle,

    '--color-accent-primary': theme.colors.accents.primary,
    '--color-accent-primary-hover': theme.colors.accents.primaryHover,
    '--color-accent-danger': theme.colors.accents.danger,
    '--color-accent-danger-hover': theme.colors.accents.dangerHover,
    '--color-accent-success': theme.colors.accents.success,
    '--color-accent-warning': theme.colors.accents.warning,

    '--shadow-sm': theme.colors.shadows.sm,
    '--shadow-default': theme.colors.shadows.default,
    '--shadow-lg': theme.colors.shadows.lg,

    '--font-family-base': theme.typography.fontFamily.base,
    '--font-family-heading': theme.typography.fontFamily.heading,
    '--font-family-mono': theme.typography.fontFamily.mono,

    '--font-size-xs': theme.typography.fontSize.xs,
    '--font-size-sm': theme.typography.fontSize.sm,
    '--font-size-base': theme.typography.fontSize.base,
    '--font-size-lg': theme.typography.fontSize.lg,
    '--font-size-xl': theme.typography.fontSize.xl,
    '--font-size-2xl': theme.typography.fontSize['2xl'],
    '--font-size-3xl': theme.typography.fontSize['3xl'],
    '--font-size-4xl': theme.typography.fontSize['4xl'],

    '--font-weight-normal': theme.typography.fontWeight.normal.toString(),
    '--font-weight-medium': theme.typography.fontWeight.medium.toString(),
    '--font-weight-semibold': theme.typography.fontWeight.semibold.toString(),
    '--font-weight-bold': theme.typography.fontWeight.bold.toString(),

    '--line-height-tight': theme.typography.lineHeight.tight.toString(),
    '--line-height-normal': theme.typography.lineHeight.normal.toString(),
    '--line-height-relaxed': theme.typography.lineHeight.relaxed.toString(),

    '--max-content-width': theme.layout.maxContentWidth,
    '--spacing-xs': theme.layout.spacing.xs,
    '--spacing-sm': theme.layout.spacing.sm,
    '--spacing-md': theme.layout.spacing.md,
    '--spacing-lg': theme.layout.spacing.lg,
    '--spacing-xl': theme.layout.spacing.xl,
    '--spacing-2xl': theme.layout.spacing['2xl'],

    '--radius-sm': theme.layout.borderRadius.sm,
    '--radius-md': theme.layout.borderRadius.md,
    '--radius-lg': theme.layout.borderRadius.lg,
    '--radius-xl': theme.layout.borderRadius.xl,

    '--transition-fast': theme.layout.transitions.fast,
    '--transition-normal': theme.layout.transitions.normal,
    '--transition-slow': theme.layout.transitions.slow,

    // Map the theme palette to the application's actual root CSS tokens.
    '--bg': theme.colors.surfaces.default,
    '--bg-secondary': theme.colors.surfaces.secondary,
    '--bg-tertiary': theme.colors.surfaces.tertiary,
    '--bg-hover': theme.colors.surfaces.hover,
    '--bg-active': theme.colors.surfaces.active,

    '--text': theme.colors.content.default,
    '--text-secondary': theme.colors.content.secondary,
    '--text-muted': theme.colors.content.muted,
    '--text-inverse': theme.colors.content.inverse,

    '--border': theme.colors.borders.default,
    '--border-subtle': theme.colors.borders.subtle,

    '--accent': theme.colors.accents.primary,
    '--accent-hover': theme.colors.accents.primaryHover,
    '--danger': theme.colors.accents.danger,
    '--danger-hover': theme.colors.accents.dangerHover,
    '--success': theme.colors.accents.success,
    '--warning': theme.colors.accents.warning,
  } as const;

  Object.entries(styleMap).forEach(([property, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      root.style.setProperty(property, value);
    }
  });
}

export async function loadThemeState(settingsDB: any) {
  if (!settingsDB?.get) return defaultThemeState;

  try {
    const entry = await settingsDB.get(THEME_STATE_DB_KEY);
    const raw = entry?.value?.value;

    if (themeStateIsValid(raw)) {
      const state = raw as ThemeState;

      const normalizedInstalled = [
        ...DEFAULT_THEMES,
        ...state.installed.filter((theme) => theme.category === 'custom' && themeObjectIsValid(theme)),
      ];

      const current = normalizedInstalled.find((theme) => theme.id === state.current)
        ? state.current
        : DEFAULT_THEMES[0].id;

      return {
        ...defaultThemeState,
        installed: normalizedInstalled,
        current,
        lastModified: state.lastModified || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn('Unable to load theme state from settingsDB:', error);
  }

  return defaultThemeState;
}

export async function persistThemeState(settingsDB: any) {
  if (!settingsDB?.put) return;

  const state = get(themeState);
  const payload: ThemeState = {
    ...state,
    lastModified: new Date().toISOString(),
  };

  themeState.set(payload);
  await settingsDB.put({ _id: THEME_STATE_DB_KEY, value: payload });
}

export function selectTheme(themeId: string, settingsDB?: any) {
  const state = get(themeState);
  if (state.current === themeId) return;

  const installed = state.installed;
  const selected = installed.find((theme) => theme.id === themeId);
  if (!selected) return;

  const nextState: ThemeState = {
    ...state,
    current: themeId,
    lastModified: new Date().toISOString(),
  };

  themeState.set(nextState);
  applyTheme(selected);

  if (settingsDB?.put) {
    settingsDB.put({ _id: THEME_STATE_DB_KEY, value: nextState }).catch((error) => {
      console.warn('Failed to persist theme state:', error);
    });
  }
}

export function installTheme(theme: Theme) {
  if (!themeObjectIsValid(theme)) return;

  const state = get(themeState);
  if (state.installed.some((installedTheme) => installedTheme.id === theme.id)) return;

  const nextState: ThemeState = {
    ...state,
    installed: [...state.installed, theme],
    lastModified: new Date().toISOString(),
  };

  themeState.set(nextState);
}

export async function saveCustomTheme(theme: Theme, settingsDB?: any) {
  if (!themeObjectIsValid(theme)) {
    throw new Error('Invalid theme object');
  }

  if (theme.category !== 'custom') {
    throw new Error('Only custom themes can be saved using saveCustomTheme');
  }

  const state = get(themeState);
  const existingIndex = state.installed.findIndex((installedTheme) => installedTheme.id === theme.id);
  const installed = existingIndex >= 0
    ? [...state.installed.slice(0, existingIndex), theme, ...state.installed.slice(existingIndex + 1)]
    : [...state.installed, theme];

  const nextState: ThemeState = {
    ...state,
    installed,
    lastModified: new Date().toISOString(),
  };

  themeState.set(nextState);

  if (settingsDB?.put) {
    await settingsDB.put({ _id: THEME_STATE_DB_KEY, value: nextState });
  }

  return nextState;
}

export function resetThemeState() {
  themeState.set(defaultThemeState);
  applyTheme(defaultThemeState.installed[0]);
}
