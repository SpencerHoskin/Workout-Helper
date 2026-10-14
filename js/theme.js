import { getSettings, myHealth } from './store.js';

export function applyTheme() {
  const t = getSettings().theme;
  const root = document.documentElement;
  if (['light', 'dark', 'candy', 'neon'].includes(t)) root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const bar = { candy: '#FDE3E8', neon: '#091833' }[t] || (dark ? '#0E0A16' : '#FFF3F8');
  document.querySelector('meta[name=theme-color]').setAttribute('content', bar);
}

/** "My health profile" on/off: index.html marks the owner-only safety notes .mine and the general ones .general. */
export function applyProfile() {
  document.body.classList.toggle('my-health', myHealth());
}
