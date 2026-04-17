import { expect } from 'chai';
import { themeState, currentTheme, selectTheme, loadThemeState, persistThemeState, resetThemeState, saveCustomTheme } from '../src/lib/themes/themeStore.js';
import { DEFAULT_THEMES } from '../src/lib/themes/defaults.js';

class MockSettingsDB {
  entries = new Map();

  constructor(initialEntries = []) {
    for (const entry of initialEntries) {
      this.entries.set(entry._id, {
        value: {
          _id: entry._id,
          value: entry.value,
        },
      });
    }
  }

  async get(id) {
    return this.entries.get(id) ?? null;
  }

  async put(record) {
    const stored = {
      value: {
        _id: record._id,
        value: record.value,
      },
    };
    this.entries.set(record._id, stored);
    return stored;
  }
}

describe('themeStore', () => {
  afterEach(() => {
    resetThemeState();
  });

  it('starts with a default theme state', () => {
    const state = themeState.subscribe((value) => {
      expect(value.current).to.equal(DEFAULT_THEMES[0].id);
      expect(value.installed).to.have.length.greaterThan(0);
    });
    state();
  });

  it('selectTheme updates the current theme id', () => {
    selectTheme(DEFAULT_THEMES[1].id);
    let current;
    const unsubscribe = currentTheme.subscribe((theme) => {
      current = theme;
    });
    unsubscribe();

    expect(current?.id).to.equal(DEFAULT_THEMES[1].id);
  });

  it('persistThemeState saves the theme state to settingsDB', async () => {
    const db = new MockSettingsDB();
    selectTheme(DEFAULT_THEMES[2].id);
    await persistThemeState(db);

    const stored = await db.get('themeState');
    expect(stored).to.exist;
    expect(stored.value.value.current).to.equal(DEFAULT_THEMES[2].id);
    expect(stored.value.value.installed).to.be.an('array');
  });

  it('loadThemeState falls back to defaults for missing or invalid theme state', async () => {
    const db = new MockSettingsDB();
    const loaded = await loadThemeState(db);

    expect(loaded.current).to.equal(DEFAULT_THEMES[0].id);
    expect(loaded.installed).to.deep.equal(DEFAULT_THEMES);
  });

  it('loadThemeState restores valid persisted theme state', async () => {
    const persisted = {
      _id: 'themeState',
      value: {
        current: DEFAULT_THEMES[3].id,
        installed: [DEFAULT_THEMES[0], DEFAULT_THEMES[3]],
        lastModified: new Date().toISOString(),
      },
    };
    const db = new MockSettingsDB([persisted]);
    const loaded = await loadThemeState(db);

    expect(loaded.current).to.equal(DEFAULT_THEMES[3].id);
    expect(loaded.installed.map((theme) => theme.id)).to.include(DEFAULT_THEMES[3].id);
  });

  it('saveCustomTheme persists a new custom theme to settingsDB', async () => {
    const db = new MockSettingsDB();
    const customTheme = {
      id: 'custom-blue',
      name: 'Custom Blue',
      description: 'A custom blue theme',
      category: 'custom',
      colors: {
        surfaces: { default: '#001f3f', secondary: '#003366', tertiary: '#004080', hover: '#0059b3', active: '#0073e6' },
        content: { default: '#ffffff', secondary: '#cce0ff', muted: '#99b3cc', inverse: '#0b2242' },
        borders: { default: '#0059b3', subtle: '#003366' },
        accents: { primary: '#66b2ff', primaryHover: '#99ccff', danger: '#ff6b6b', dangerHover: '#ff8c8c', success: '#4cd964', warning: '#ffd700' },
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', default: '0 2px 4px rgba(0,0,0,0.1)', lg: '0 10px 30px rgba(0,0,0,0.15)' },
      },
      typography: {
        fontFamily: { base: 'Inter, sans-serif', heading: 'Inter, sans-serif', mono: 'Menlo, monospace' },
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
      },
      layout: {
        maxContentWidth: '72ch',
        spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem' },
        borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' },
        transitions: { fast: '150ms', normal: '250ms', slow: '350ms' },
      },
      metadata: { creator: 'Tester', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    await saveCustomTheme(customTheme, db);

    const stored = await db.get('themeState');
    expect(stored).to.exist;
    expect(stored.value.value.installed.some((theme) => theme.id === 'custom-blue')).to.be.true;
  });

  it('saveCustomTheme updates an existing custom theme in settingsDB', async () => {
    const customTheme = {
      id: 'custom-blue',
      name: 'Custom Blue',
      description: 'A custom blue theme',
      category: 'custom',
      colors: {
        surfaces: { default: '#001f3f', secondary: '#003366', tertiary: '#004080', hover: '#0059b3', active: '#0073e6' },
        content: { default: '#ffffff', secondary: '#cce0ff', muted: '#99b3cc', inverse: '#0b2242' },
        borders: { default: '#0059b3', subtle: '#003366' },
        accents: { primary: '#66b2ff', primaryHover: '#99ccff', danger: '#ff6b6b', dangerHover: '#ff8c8c', success: '#4cd964', warning: '#ffd700' },
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', default: '0 2px 4px rgba(0,0,0,0.1)', lg: '0 10px 30px rgba(0,0,0,0.15)' },
      },
      typography: {
        fontFamily: { base: 'Inter, sans-serif', heading: 'Inter, sans-serif', mono: 'Menlo, monospace' },
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
      },
      layout: {
        maxContentWidth: '72ch',
        spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem' },
        borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem' },
        transitions: { fast: '150ms', normal: '250ms', slow: '350ms' },
      },
      metadata: { creator: 'Tester', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const db = new MockSettingsDB();
    await saveCustomTheme(customTheme, db);

    const updatedTheme = {
      ...customTheme,
      name: 'Custom Blue Updated',
      description: 'Updated description',
    };

    await saveCustomTheme(updatedTheme, db);
    const stored = await db.get('themeState');
    expect(stored.value.value.installed.find((theme) => theme.id === 'custom-blue').name).to.equal('Custom Blue Updated');
  });
});
