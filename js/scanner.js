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

let step = 0;
/**
 * Decode a QR from a video frame / image. Live frames rotate through cheap passes —
 * centre square normal, centre square inverted, whole frame — instead of one heavy
 * full-frame "attemptBoth" pass every tick. Photos get one thorough pass.
 */
async function decode(source, w, h, { photo = false } = {}) {
  if (detector) {
    const codes = await detector.detect(source);
    return codes.length ? codes[0].rawValue : null;
  }
  const pass = photo ? 'full' : ['centre', 'centre-inv', 'full'][step++ % 3];
  const side = Math.min(w, h) * 0.8;
  const [sx, sy, sw, sh] = pass === 'full' ? [0, 0, w, h] : [(w - side) / 2, (h - side) / 2, side, side];
  const scale = Math.min(1, (photo ? 1200 : pass === 'full' ? 640 : 480) / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const inversionAttempts = photo ? 'attemptBoth' : pass === 'centre-inv' ? 'onlyInvert' : 'dontInvert';
  const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts });
  return code && code.data ? code.data : null;
}

export async function startScanner(video, onCode) {
  stopScanner();
  const mine = ++session;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera not available here. Open the app over https (or use "From photo").');
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
    return await decode(img, img.naturalWidth, img.naturalHeight, { photo: true });
  } finally {
    URL.revokeObjectURL(url);
  }
}
