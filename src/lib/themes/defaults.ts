/**
 * Default Theme Definitions
 * 
 * Pre-built themes included with le-space-blog.
 * These serve as starting points for the theme system and can be customized by users.
 */

import type { Theme } from "./types.js";

/**
 * Minimal/Clean Light Theme
 * 
 * A minimalist theme emphasizing clean design and content readability.
 * Focuses on neutral colors, elegant typography, and plenty of whitespace.
 */
export const minimalLightTheme: Theme = {
  id: "minimal-light",
  name: "Minimal Clean",
  description: "Minimalist light theme with emphasis on content",
  category: "default",
  colors: {
    surfaces: {
      default: "#ffffff",
      secondary: "#f7f7f8",
      tertiary: "#ededf0",
      hover: "#f0f0f2",
      active: "#e8e8ec",
    },
    content: {
      default: "#111111",
      secondary: "#555555",
      muted: "#8b8b8b",
      inverse: "#ffffff",
    },
    borders: {
      default: "#e2e2e5",
      subtle: "#efefef",
    },
    accents: {
      primary: "#111111",
      primaryHover: "#333333",
      danger: "#dc2626",
      dangerHover: "#b91c1c",
      success: "#10b981",
      warning: "#f59e0b",
    },
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      default: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    },
  },
  typography: {
    fontFamily: {
      base: "Inter, system-ui, -apple-system, sans-serif",
      heading: "Inter, system-ui, -apple-system, sans-serif",
      mono: "Menlo, Monaco, 'Courier New', monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  layout: {
    maxContentWidth: "65ch",
    spacing: {
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
    },
    borderRadius: {
      sm: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
    },
    transitions: {
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
    },
  },
  metadata: {
    creator: "Default",
    createdAt: "2026-04-17T00:00:00Z",
    updatedAt: "2026-04-17T00:00:00Z",
  },
};

/**
 * Magazine/Editorial Theme
 * 
 * Inspired by editorial websites and magazines.
 * Features serif headings, optimized typography for long-form content,
 * and generous spacing for readability.
 */
export const magazineEditorialTheme: Theme = {
  id: "magazine-editorial",
  name: "Magazine Editorial",
  description: "Magazine-style layout inspired by editorial websites",
  category: "default",
  colors: {
    surfaces: {
      default: "#fafaf9",
      secondary: "#f5f5f4",
      tertiary: "#efefef",
      hover: "#e8e8e7",
      active: "#e1e1de",
    },
    content: {
      default: "#1f2937",
      secondary: "#4b5563",
      muted: "#9ca3af",
      inverse: "#ffffff",
    },
    borders: {
      default: "#d1d5db",
      subtle: "#f3f4f6",
    },
    accents: {
      primary: "#2563eb",
      primaryHover: "#1d4ed8",
      danger: "#ef4444",
      dangerHover: "#dc2626",
      success: "#22c55e",
      warning: "#eab308",
    },
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.08)",
      default: "0 2px 4px 0 rgba(0, 0, 0, 0.1)",
      lg: "0 12px 24px 0 rgba(0, 0, 0, 0.15)",
    },
  },
  typography: {
    fontFamily: {
      base: "'Georgia', 'Garamond', serif",
      heading: "'Georgia', 'Garamond', serif",
      mono: "'Courier New', Courier, monospace",
    },
    fontSize: {
      xs: "0.8125rem",
      sm: "0.9375rem",
      base: "1.0625rem",
      lg: "1.1875rem",
      xl: "1.3125rem",
      "2xl": "1.5625rem",
      "3xl": "1.9375rem",
      "4xl": "2.4375rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.7,
      relaxed: 1.9,
    },
  },
  layout: {
    maxContentWidth: "800px",
    spacing: {
      xs: "0.375rem",
      sm: "0.75rem",
      md: "1.25rem",
      lg: "1.875rem",
      xl: "2.5rem",
      "2xl": "3.75rem",
    },
    borderRadius: {
      sm: "0.375rem",
      md: "0.5rem",
      lg: "0.625rem",
      xl: "1rem",
    },
    transitions: {
      fast: "200ms",
      normal: "300ms",
      slow: "400ms",
    },
  },
  metadata: {
    creator: "Default",
    createdAt: "2026-04-17T00:00:00Z",
    updatedAt: "2026-04-17T00:00:00Z",
  },
};

/**
 * Dark Mode Variant Theme
 * 
 * A dark theme optimized for low-light viewing and reduced eye strain.
 * Inverse color palette with light text on dark backgrounds.
 */
export const darkModeVariantTheme: Theme = {
  id: "dark-mode-variant",
  name: "Dark Mode",
  description: "Dark theme for reduced eye strain",
  category: "default",
  darkMode: true,
  colors: {
    surfaces: {
      default: "#1a1a1a",
      secondary: "#242424",
      tertiary: "#2d2d2d",
      hover: "#333333",
      active: "#404040",
    },
    content: {
      default: "#e5e5e5",
      secondary: "#b0b0b0",
      muted: "#808080",
      inverse: "#1a1a1a",
    },
    borders: {
      default: "#3a3a3a",
      subtle: "#2a2a2a",
    },
    accents: {
      primary: "#60a5fa",
      primaryHover: "#93c5fd",
      danger: "#f87171",
      dangerHover: "#fca5a5",
      success: "#4ade80",
      warning: "#facc15",
    },
    shadows: {
      sm: "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
      default: "0 4px 6px 0 rgba(0, 0, 0, 0.5)",
      lg: "0 20px 25px -5px rgba(0, 0, 0, 0.6)",
    },
  },
  typography: {
    fontFamily: {
      base: "Inter, system-ui, -apple-system, sans-serif",
      heading: "Inter, system-ui, -apple-system, sans-serif",
      mono: "Menlo, Monaco, 'Courier New', monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  layout: {
    maxContentWidth: "65ch",
    spacing: {
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
    },
    borderRadius: {
      sm: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
    },
    transitions: {
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
    },
  },
  metadata: {
    creator: "Default",
    createdAt: "2026-04-17T00:00:00Z",
    updatedAt: "2026-04-17T00:00:00Z",
  },
};

/**
 * Medium.com Style Theme
 * 
 * Minimalist design inspired by Medium blogging platform.
 * Clean, elegant, and focused on typography with a warm color palette.
 */
export const mediumStyleTheme: Theme = {
  id: "medium-style",
  name: "Medium.com Style",
  description: "Minimalist design inspired by Medium blogging platform",
  category: "default",
  colors: {
    surfaces: {
      default: "#fafafa",
      secondary: "#f5f5f5",
      tertiary: "#f0f0f0",
      hover: "#ececec",
      active: "#e8e8e8",
    },
    content: {
      default: "#292929",
      secondary: "#6b6b6b",
      muted: "#9b9b9b",
      inverse: "#ffffff",
    },
    borders: {
      default: "#e5e5e5",
      subtle: "#f0f0f0",
    },
    accents: {
      primary: "#1a8917",
      primaryHover: "#146c12",
      danger: "#d32f2f",
      dangerHover: "#c62828",
      success: "#388e3c",
      warning: "#f57c00",
    },
    shadows: {
      sm: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
      default: "0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)",
      lg: "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
    },
  },
  typography: {
    fontFamily: {
      base: "'Medium Content Serif', Georgia, Cambria, 'Times New Roman', Times, serif",
      heading: "'Medium Content Serif', Georgia, Cambria, 'Times New Roman', Times, serif",
      mono: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.0625rem",
      xl: "1.125rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.6,
      relaxed: 1.8,
    },
  },
  layout: {
    maxContentWidth: "680px",
    spacing: {
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
    },
    borderRadius: {
      sm: "2px",
      md: "4px",
      lg: "6px",
      xl: "8px",
    },
    transitions: {
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
    },
  },
  metadata: {
    creator: "Default",
    createdAt: "2026-04-17T00:00:00Z",
    updatedAt: "2026-04-17T00:00:00Z",
  },
};

/**
 * Substack Style Theme
 * 
 * Newsletter-focused design inspired by Substack.
 * Warm, inviting colors that emphasize community and creator identity.
 */
export const substackStyleTheme: Theme = {
  id: "substack-style",
  name: "Substack Style",
  description: "Newsletter-focused design inspired by Substack",
  category: "default",
  colors: {
    surfaces: {
      default: "#fefdf7",
      secondary: "#faf8f3",
      tertiary: "#f5f2ed",
      hover: "#ece9e1",
      active: "#e8e3db",
    },
    content: {
      default: "#1f2019",
      secondary: "#504d47",
      muted: "#7a7770",
      inverse: "#ffffff",
    },
    borders: {
      default: "#e5e5e0",
      subtle: "#f0ede8",
    },
    accents: {
      primary: "#f97316",
      primaryHover: "#ea580c",
      danger: "#dc2626",
      dangerHover: "#b91c1c",
      success: "#16a34a",
      warning: "#d97706",
    },
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      default: "0 2px 4px 0 rgba(0, 0, 0, 0.1)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    },
  },
  typography: {
    fontFamily: {
      base: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      heading: "Georgia, 'Times New Roman', Times, serif",
      mono: "Menlo, Monaco, monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.3,
      normal: 1.6,
      relaxed: 1.8,
    },
  },
  layout: {
    maxContentWidth: "740px",
    spacing: {
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
    },
    borderRadius: {
      sm: "3px",
      md: "4px",
      lg: "6px",
      xl: "8px",
    },
    transitions: {
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
    },
  },
  metadata: {
    creator: "Default",
    createdAt: "2026-04-17T00:00:00Z",
    updatedAt: "2026-04-17T00:00:00Z",
  },
};

/**
 * Array of all default themes
 * Used for initialization and reset operations
 */
export const DEFAULT_THEMES: Theme[] = [
  minimalLightTheme,
  magazineEditorialTheme,
  darkModeVariantTheme,
  mediumStyleTheme,
  substackStyleTheme,
];
