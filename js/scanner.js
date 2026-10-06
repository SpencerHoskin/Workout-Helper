// Camera QR scanning. Uses the native BarcodeDetector when present (Chrome/Android),
// otherwise the vendored jsQR decoder (iPhone Safari has no BarcodeDetector).

let stream = null, timer = null, detector = null, session = 0;

function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/jsQR.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the QR decoder'));
    document.head.appendChild(s);
  });
}

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) return new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch { /* fall through to jsQR */ }
  }
  await loadJsQR();
  return null;
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

/** Decode a QR from a video frame / image / canvas. Returns the text or null. */
async function decode(source, w, h) {
  if (detector) {
    const codes = await detector.detect(source);
    return codes.length ? codes[0].rawValue : null;
  }
  const scale = Math.min(1, 720 / Math.max(w, h));
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return code && code.data ? code.data : null;
}

export async function startScanner(video, onCode) {
  stopScanner();
  const mine = ++session;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera not available here. Open the app over https (or use "Scan from photo").');
  }
  detector = await makeDetector();
  const s = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  if (mine !== session) { s.getTracks().forEach(t => t.stop()); return; } // user left while camera was starting
  stream = s;
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  let busy = false;
  timer = setInterval(async () => {
    if (busy || !video.videoWidth) return;
    busy = true;
    try {
      const text = await decode(video, video.videoWidth, video.videoHeight);
      if (text) { stopScanner(); onCode(text); }
    } catch (e) {
      console.warn('decode failed', e);
    } finally { busy = false; }
  }, 150);
}

export function stopScanner() {
  session++;
  clearInterval(timer); timer = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
}

/** Fallback: decode from a photo the user takes / picks (works even when live camera is blocked). */
export async function scanFile(file) {
  detector = await makeDetector();
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await decode(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
