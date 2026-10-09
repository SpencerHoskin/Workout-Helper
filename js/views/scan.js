import { startScanner, stopScanner, scanFile } from '../scanner.js';
import { $, beep, openSheet, closeSheet, toast, sheetOpen, onSheetClosed, PLATFORM, standalone } from '../ui.js';
import { current } from '../router.js';
import { handleScanned } from './machines.js';
import { icon } from '../icons.js';

export function render() {
  return `<section class="scan">
    <div class="scan-stage">
      <video id="scanVideo" playsinline muted autoplay></video>
      <div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="laser"></span></div>
      <div class="scan-hint" id="scanHint" role="status">Starting camera…</div>
    </div>
    <div class="scan-actions">
      <label class="btn ghost">${icon('camera', 20)}From photo<input type="file" accept="image/*" data-change="scanPhoto" hidden></label>
      <button class="btn ghost" data-act="typeCode">${icon('keyboard', 20)}Type code</button>
      <a class="btn ghost" href="#/machines">${icon('list', 20)}Pick from list</a>
    </div>
    <p class="muted small center">Every machine at Crunch has a QR sticker for its training video. Scan it once and the app remembers that machine.</p>
  </section>`;
}

function found(text) {
  beep(1320, 120);
  handleScanned(text);
  // New code → a "what machine is this?" sheet opened. If it's dismissed, resume scanning.
  if (sheetOpen()) onSheetClosed(() => setTimeout(() => { if (current().name === 'scan') mount(); }, 300));
}

// How to un-block the camera, per phone.
const CAMERA_FIX = {
  ios: 'iPhone: Settings → Safari → Camera → Allow.',
  android: 'Android: tap the icon left of the address bar → Permissions → Camera → Allow.',
  androidApp: 'Android: long-press the Kiln icon → App info → Permissions → Camera → Allow.',
  other: 'Allow camera access for this site in your browser settings.'
};

export function mount() {
  document.removeEventListener('visibilitychange', onVisibility);
  document.addEventListener('visibilitychange', onVisibility);
  const hint = $('#scanHint');
  startScanner($('#scanVideo'), found)
    .then(() => { hint.textContent = 'Point at the machine’s QR code'; })
    .catch(err => {
      console.warn(err);
      hint.classList.add('err');
      hint.textContent = err.name === 'NotAllowedError'
        ? 'Camera blocked. ' + CAMERA_FIX[PLATFORM === 'android' && standalone() ? 'androidApp' : PLATFORM] + ' Or use “From photo”.'
        : (err.message || 'Camera unavailable') + ' — try “From photo”.';
    });
}

// Stop the camera when the app goes to the background; restart it on return (iOS freezes the feed otherwise).
function onVisibility() {
  if (document.hidden) stopScanner();
  else if (current().name === 'scan' && !sheetOpen()) mount();
}

export function unmount() {
  stopScanner();
  document.removeEventListener('visibilitychange', onVisibility);
}

export const changes = {
  async scanPhoto(el) {
    const file = el.files && el.files[0];
    if (!file) return;
    const text = await scanFile(file).catch(() => null);
    el.value = '';
    if (text) found(text); else toast('No QR code found in that photo', 'warn');
  }
};

export const actions = {
  typeCode() {
    openSheet(`<div class="sheet-head"><h2>Type or paste a code</h2>
      <p class="muted small">Paste the link the QR opens, or any label like “legpress-2”.</p></div>
      <form id="typedCode"><input name="code" placeholder="https://…" autofocus required>
      <button class="btn primary wide" type="submit">Use this code</button></form>`);
  }
};

export const submits = {
  typedCode(form) {
    const code = form.elements.code.value.trim();
    if (!code) return;
    closeSheet();
    stopScanner();
    found(code);
  }
};
