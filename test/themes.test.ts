import assert from "node:assert/strict";
import {
  isValidTheme,
  minimalLightTheme,
  magazineEditorialTheme,
  darkModeVariantTheme,
  mediumStyleTheme,
  substackStyleTheme,
  DEFAULT_THEMES,
} from "../src/lib/themes/index.js";

describe("Theme System", () => {
  describe("Type Validation", () => {
    it("should validate minimal light theme", () => {
      assert.strictEqual(isValidTheme(minimalLightTheme), true);
    });

    it("should validate magazine editorial theme", () => {
      assert.strictEqual(isValidTheme(magazineEditorialTheme), true);
    });

    it("should validate dark mode variant theme", () => {
      assert.strictEqual(isValidTheme(darkModeVariantTheme), true);
    });

    it("should validate medium style theme", () => {
      assert.strictEqual(isValidTheme(mediumStyleTheme), true);
    });

    it("should validate substack style theme", () => {
      assert.strictEqual(isValidTheme(substackStyleTheme), true);
    });

    it("should reject invalid theme objects", () => {
      assert.strictEqual(isValidTheme(null), false);
      assert.strictEqual(isValidTheme(undefined), false);
      assert.strictEqual(isValidTheme({}), false);
      assert.strictEqual(isValidTheme("not a theme"), false);
    });
  });

  describe("Default Themes Array", () => {
    it("should have exactly 5 default themes", () => {
      assert.strictEqual(DEFAULT_THEMES.length, 5);
    });

    it("should contain all default themes", () => {
      const ids = DEFAULT_THEMES.map((t) => t.id);
      assert(ids.includes("minimal-light"));
      assert(ids.includes("magazine-editorial"));
      assert(ids.includes("dark-mode-variant"));
      assert(ids.includes("medium-style"));
      assert(ids.includes("substack-style"));
    });

    it("should have all themes marked as category 'default'", () => {
      DEFAULT_THEMES.forEach((theme) => {
        assert.strictEqual(theme.category, "default");
      });
    });

    it("should all themes be valid", () => {
      DEFAULT_THEMES.forEach((theme) => {
        assert.strictEqual(isValidTheme(theme), true);
      });
    });
  });

  describe("Theme Structure", () => {
    const testTheme = minimalLightTheme;

    it("should have required top-level properties", () => {
      assert(testTheme.id);
      assert(testTheme.name);
      assert(testTheme.description);
      assert(testTheme.category);
      assert(testTheme.colors);
      assert(testTheme.typography);
      assert(testTheme.layout);
      assert(testTheme.metadata);
    });

    it("should have required color properties", () => {
      const { colors } = testTheme;
      assert(colors.surfaces);
      assert(colors.content);
      assert(colors.borders);
      assert(colors.accents);
      assert(colors.shadows);
    });

    it("should have required typography properties", () => {
      const { typography } = testTheme;
      assert(typography.fontFamily);
      assert(typography.fontSize);
      assert(typography.fontWeight);
      assert(typography.lineHeight);
    });

    it("should have required layout properties", () => {
      const { layout } = testTheme;
      assert(layout.maxContentWidth);
      assert(layout.spacing);
      assert(layout.borderRadius);
      assert(layout.transitions);
    });

    it("should have required metadata properties", () => {
      const { metadata } = testTheme;
      assert(metadata.creator);
      assert(metadata.createdAt);
      assert(metadata.updatedAt);
    });
  });

  describe("Theme Color Values", () => {
    it("minimal light theme should have valid hex colors", () => {
      const hexRegex = /^#[0-9a-f]{6}$/i;
      const colors = minimalLightTheme.colors;

      // Check surfaces
      Object.values(colors.surfaces).forEach((color) => {
        assert(hexRegex.test(color), `Invalid color: ${color}`);
      });

      // Check content
      Object.values(colors.content).forEach((color) => {
        assert(hexRegex.test(color), `Invalid color: ${color}`);
      });

      // Check accents
      Object.values(colors.accents).forEach((color) => {
        assert(hexRegex.test(color), `Invalid color: ${color}`);
      });
    });

    it("dark mode theme should have darkMode flag set", () => {
      assert.strictEqual(darkModeVariantTheme.darkMode, true);
    });
  });

  describe("Theme Uniqueness", () => {
    it("should have unique IDs", () => {
      const ids = DEFAULT_THEMES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      assert.strictEqual(ids.length, uniqueIds.size);
    });

    it("should have unique names", () => {
      const names = DEFAULT_THEMES.map((t) => t.name);
      const uniqueNames = new Set(names);
      assert.strictEqual(names.length, uniqueNames.size);
    });
  });

  describe("Theme Timestamps", () => {
    it("should have valid ISO 8601 timestamps", () => {
      const isoRegex =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

      DEFAULT_THEMES.forEach((theme) => {
        assert(
          isoRegex.test(theme.metadata.createdAt),
          `Invalid createdAt: ${theme.metadata.createdAt}`
        );
        assert(
          isoRegex.test(theme.metadata.updatedAt),
          `Invalid updatedAt: ${theme.metadata.updatedAt}`
        );
      });
    });
  });
});
