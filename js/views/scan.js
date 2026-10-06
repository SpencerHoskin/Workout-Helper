import { startScanner, stopScanner, scanFile } from '../scanner.js';
import { $, beep, openSheet, closeSheet, toast, sheetOpen, onSheetClosed } from '../ui.js';
import { current } from '../router.js';
import { handleScanned } from './machines.js';

export function render() {
  return `<section class="scan">
    <div class="scan-stage">
      <video id="scanVideo" playsinline muted autoplay></video>
      <div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="laser"></span></div>
      <div class="scan-hint" id="scanHint" role="status">Starting camera…</div>
    </div>
    <div class="scan-actions">
      <label class="btn ghost">📸 Scan from photo<input type="file" accept="image/*" data-change="scanPhoto" hidden></label>
      <button class="btn ghost" data-act="typeCode">⌨️ Type code</button>
      <a class="btn ghost" href="#/machines">📋 Pick from list</a>
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

export function mount() {
  const hint = $('#scanHint');
  startScanner($('#scanVideo'), found)
    .then(() => { hint.textContent = 'Point at the machine’s QR code'; })
    .catch(err => {
      console.warn(err);
      hint.classList.add('err');
      hint.textContent = err.name === 'NotAllowedError'
        ? 'Camera blocked. iPhone: Settings → Safari → Camera → Allow. Or use “Scan from photo”.'
        : (err.message || 'Camera unavailable') + ' — try “Scan from photo”.';
    });
}

export function unmount() { stopScanner(); }

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
