/**
 * Themes Module
 * 
 * Public API for the pluggable themes system.
 * Export all theme-related types and functions here.
 */

export type {
  Theme,
  ThemeState,
  ThemeColors,
  ThemeTypography,
  ThemeLayout,
  ThemeMetadata,
  SurfaceColors,
  ContentColors,
  BorderColors,
  AccentColors,
  ShadowDefinitions,
  FontFamily,
  FontSizeScale,
  FontWeights,
  LineHeights,
  SpacingScale,
  BorderRadiusScale,
  TransitionScale,
} from "./types.js";

export { isValidTheme } from "./types.js";

export {
  minimalLightTheme,
  magazineEditorialTheme,
  darkModeVariantTheme,
  mediumStyleTheme,
  substackStyleTheme,
  DEFAULT_THEMES,
} from "./defaults.js";

export {
  themeState,
  currentTheme,
  installedThemes,
  currentThemeId,
  applyTheme,
  loadThemeState,
  persistThemeState,
  selectTheme,
  installTheme,
  saveCustomTheme,
  resetThemeState,
} from "./themeStore.js";
