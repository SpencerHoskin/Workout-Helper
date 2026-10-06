// Line icons (24px grid, 2px stroke, currentColor) — one consistent set instead of emoji.
const P = {
  kiln: '<path d="M5 20v-8.5a7 7 0 0 1 14 0V20M3 20h18"/><path d="M12 17.5c-1.6 0-2.6-1-2.6-2.3 0-1.6 1.6-2.3 2.6-3.9 1 1.6 2.6 2.3 2.6 3.9 0 1.3-1 2.3-2.6 2.3z"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  chart: '<path d="M4 19h16M6 15l4-4 3 3 5-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  alert: '<path d="M12 3l9.5 17h-19zM12 10v4M12 17.2v.3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10a3 3 0 0 1 6 0M12 10l1.5-2"/>',
  cable: '<path d="M7 3v8a5 5 0 0 0 10 0V3M7 21v-4M17 21v-4M5 3h4M15 3h4"/>',
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4h4l2 3 3 1M11 15l2-7"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  file: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  doctor: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6z"/>',
  breath: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};

/** SVG markup for a named icon. Decorative by default (aria-hidden); pass a label to expose it. */
export function icon(name, size = 20, { stroke = 2, label = '' } = {}) {
  const body = P[name] || P.sparkle;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}</svg>`;
}

export const ICONS = Object.keys(P);
