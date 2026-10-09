import { getSettings, myHealth } from './store.js';

export function applyTheme() {
  const t = getSettings().theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#080B0A' : '#F3F5F4');
}

/** "My health profile" on/off: index.html marks the owner-only safety notes .mine and the general ones .general. */
export function applyProfile() {
  document.body.classList.toggle('my-health', myHealth());
}
