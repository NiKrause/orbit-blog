/**
 * Theme System Type Definitions
 * 
 * Defines the complete structure for pluggable themes in the le-space-blog.
 * Themes can be either default (built-in) or custom (user-created).
 * 
 * All theme properties use semantic naming and can be applied as CSS variables
 * for runtime switching without page reload.
 */

/**
 * Color definitions for surfaces (backgrounds)
 */
export interface SurfaceColors {
  /** Primary background (e.g., page background) */
  default: string;
  /** Secondary background (e.g., sidebars, panels) */
  secondary: string;
  /** Tertiary background (e.g., cards, modals) */
  tertiary: string;
  /** Hover state background */
  hover: string;
  /** Active/pressed state background */
  active: string;
}

/**
 * Color definitions for content (text)
 */
export interface ContentColors {
  /** Primary text color */
  default: string;
  /** Secondary text (e.g., descriptions, metadata) */
  secondary: string;
  /** Muted text (e.g., disabled, placeholder) */
  muted: string;
  /** Inverse text (e.g., on dark backgrounds) */
  inverse: string;
}

/**
 * Border color definitions
 */
export interface BorderColors {
  /** Primary border color */
  default: string;
  /** Subtle border (e.g., dividers) */
  subtle: string;
}

/**
 * Accent and semantic colors
 */
export interface AccentColors {
  /** Primary accent color */
  primary: string;
  /** Primary accent hover state */
  primaryHover: string;
  /** Danger/error color */
  danger: string;
  /** Danger hover state */
  dangerHover: string;
  /** Success color */
  success: string;
  /** Warning color */
  warning: string;
}

/**
 * Shadow definitions (CSS box-shadow values)
 */
export interface ShadowDefinitions {
  /** Small shadow (used for subtle depth) */
  sm: string;
  /** Default shadow (standard depth) */
  default: string;
  /** Large shadow (prominent depth) */
  lg: string;
}

/**
 * Complete color palette for a theme
 */
export interface ThemeColors {
  /** Background/surface colors */
  surfaces: SurfaceColors;
  /** Text/content colors */
  content: ContentColors;
  /** Border colors */
  borders: BorderColors;
  /** Accent and semantic colors */
  accents: AccentColors;
  /** Shadow definitions */
  shadows: ShadowDefinitions;
}

/**
 * Font family definitions
 */
export interface FontFamily {
  /** Base font for body text (sans-serif recommended) */
  base: string;
  /** Font for headings (can be serif or sans-serif) */
  heading: string;
  /** Monospace font for code blocks */
  mono: string;
}

/**
 * Font size scale
 */
export interface FontSizeScale {
  xs: string;    // Extra small
  sm: string;    // Small
  base: string;  // Base/default
  lg: string;    // Large
  xl: string;    // Extra large
  "2xl": string; // 2x large
  "3xl": string; // 3x large
  "4xl": string; // 4x large
}

/**
 * Font weight definitions
 */
export interface FontWeights {
  normal: number;     // 400
  medium: number;     // 500
  semibold: number;   // 600
  bold: number;       // 700
}

/**
 * Line height definitions
 */
export interface LineHeights {
  tight: number;      // 1.2 (for headings)
  normal: number;     // 1.5 (for body)
  relaxed: number;    // 1.75 (for long-form content)
}

/**
 * Typography configuration
 */
export interface ThemeTypography {
  /** Font family definitions */
  fontFamily: FontFamily;
  /** Font size scale */
  fontSize: FontSizeScale;
  /** Font weight values */
  fontWeight: FontWeights;
  /** Line height values */
  lineHeight: LineHeights;
}

/**
 * Layout spacing scale
 */
export interface SpacingScale {
  xs: string;    // 0.25rem / 4px
  sm: string;    // 0.5rem / 8px
  md: string;    // 1rem / 16px
  lg: string;    // 1.5rem / 24px
  xl: string;    // 2rem / 32px
  "2xl": string; // 3rem / 48px
}

/**
 * Border radius definitions
 */
export interface BorderRadiusScale {
  sm: string;    // Small radius (0.25rem)
  md: string;    // Medium radius (0.375rem)
  lg: string;    // Large radius (0.5rem)
  xl: string;    // Extra large radius (0.75rem)
}

/**
 * Transition/animation timing scale
 */
export interface TransitionScale {
  fast: string;   // Fast transitions (150ms)
  normal: string; // Normal transitions (250ms)
  slow: string;   // Slow transitions (350ms)
}

/**
 * Layout and spacing configuration
 */
export interface ThemeLayout {
  /** Maximum content width (e.g., "65ch", "800px") */
  maxContentWidth: string;
  /** Spacing scale for padding, margins, gaps */
  spacing: SpacingScale;
  /** Border radius scale */
  borderRadius: BorderRadiusScale;
  /** Transition duration scale */
  transitions: TransitionScale;
}

/**
 * Theme metadata
 */
export interface ThemeMetadata {
  /** Creator name (e.g., "Default" or username) */
  creator: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Optional URL to theme preview image */
  preview?: string;
}

/**
 * Complete Theme object
 * 
 * Represents a single theme with all color, typography, and layout properties.
 * Can be applied at runtime by setting CSS variables on the document root.
 */
export interface Theme {
  /** Unique identifier (e.g., "minimal-light", "custom-nandi-2026") */
  id: string;
  /** Display name for UI (e.g., "Minimal Clean") */
  name: string;
  /** Description of the theme */
  description: string;
  /** Theme category: "default" (built-in) or "custom" (user-created) */
  category: "default" | "custom";
  /** Color definitions */
  colors: ThemeColors;
  /** Typography configuration */
  typography: ThemeTypography;
  /** Layout and spacing configuration */
  layout: ThemeLayout;
  /** Enable dark mode variant (optional) */
  darkMode?: boolean;
  /** Metadata about the theme */
  metadata: ThemeMetadata;
}

/**
 * Theme storage state in SettingsDB
 */
export interface ThemeState {
  /** Currently active theme ID */
  current: string;
  /** All installed themes (default + custom) */
  installed: Theme[];
  /** Last modification timestamp */
  lastModified: string;
}

/**
 * Type guard to validate a Theme object
 */
export function isValidTheme(value: unknown): value is Theme {
  if (!value || typeof value !== "object") return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    (obj.category === "default" || obj.category === "custom") &&
    obj.colors !== null &&
    typeof obj.colors === "object" &&
    obj.typography !== null &&
    typeof obj.typography === "object" &&
    obj.layout !== null &&
    typeof obj.layout === "object" &&
    obj.metadata !== null &&
    typeof obj.metadata === "object"
  );
}
