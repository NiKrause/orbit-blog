import { init, register, locale } from 'svelte-i18n';

// Definiere die verfügbaren Sprachen
export const LANGUAGES = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  ru: 'Русский',
  zh: '中文',
  ar: 'العربية',
  tr: 'Türkçe'
};

// Registriere die Übersetzungsdateien
const registerTranslations = () => {
  // Mit expliziten Dateierweiterungen
  register('en', () => import('./en.js'));
  register('de', () => import('./de.js'));
  register('fr', () => import('./fr.js'));
  register('es', () => import('./es.js'));
  register('it', () => import('./it.js'));
  register('ru', () => import('./ru.js'));
  register('zh', () => import('./zh.js'));
  register('ar', () => import('./ar.js'));
  register('tr', () => import('./tr.js'));
};

// Initialisiere die i18n-Bibliothek
export const setupI18n = () => {
  registerTranslations();

  init({
    fallbackLocale: 'en',
    initialLocale: getInitialLocale(),
  });
};

// Funktion zum Ermitteln der Anfangssprache
function getInitialLocale(): string {
  // Prüfe, ob wir im Browser sind
  if (typeof window !== 'undefined') {
    // Versuche, die gespeicherte Sprache zu laden
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
      return savedLanguage;
    }
    
    // Versuche, die Browsersprache zu verwenden
    const browserLang = navigator.language.split('-')[0];
    if (Object.keys(LANGUAGES).includes(browserLang)) {
      return browserLang;
    }
  }
  
  // Standardsprache
  return 'en';
}

// Funktion zum Ändern der Sprache
export const setLanguage = (newLocale: string) => {
  locale.set(newLocale);
  
  // Speichere die ausgewählte Sprache im localStorage, wenn im Browser
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', newLocale);
  }
};

// Funktion zum Laden der gespeicherten Sprache
export const loadSavedLanguage = () => {
  if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
      locale.set(savedLanguage);
    }
  }
};