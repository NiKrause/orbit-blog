import './app.css'
import App from './App.svelte'
import { mount } from "svelte";
import { setupI18n, loadSavedLanguage } from './lib/i18n/index.js';
import { locale, waitLocale } from 'svelte-i18n';

// Initialisiere die i18n-Bibliothek
setupI18n();

// Lade die gespeicherte Sprache, falls vorhanden
loadSavedLanguage();

// Warte, bis die Sprache geladen ist, bevor die App gerendert wird
waitLocale().then(() => {
  const app = mount(App, {
    target: document.getElementById('app')!,
  });
});
