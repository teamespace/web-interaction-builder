# Generative — visual prosedural di Canvas2D

Katalog pola visual yang dibangkitkan kode di `<canvas>` 2D, tanpa WebGL dan tanpa aset gambar: langit pixel ber-dither yang terbaca seperti ASCII, dissolve jadi kubus, foto yang diubah jadi stamp pixel, ASCII asli dengan ramp karakter, garis gambar tangan yang "hidup", dan swap gambar lewat blok pixel. Semuanya deterministik (pakai seed), ringan (ribuan `fillRect` per frame masih aman), dan sengaja dirender di frame rate rendah (12–24fps) supaya terasa stop-motion, bukan halus seperti video.

| id | ringkas |
|---|---|
| [`pixel-sky-dither`](#pixel-sky-dither--langit-pixel-5-tone) | Langit/awan dari value-noise, dikuantisasi ke 5 tone dengan 2 tone checker, melayang 24fps, reveal radial berundak. |
| [`dissolve-to-cube`](#dissolve-to-cube--langit-larut-jadi-kubus) | Saat scroll, langit larut radial dan memadat jadi kubus pixel yang terbang masuk ke celah di judul. |
| [`bayer-dither-stamp`](#bayer-dither-stamp--foto-jadi-stamp-pixel) | Foto → pixel 5 tone lewat ordered dither Bayer 4×4. |
| [`ascii-glyph-ramp`](#ascii-glyph-ramp--ascii-asli-dengan-ramp-karakter) | Medan nilai (noise atau gambar) dirender sebagai karakter dari ramp `" .:-=+*#%@"`. |
| [`hand-drawn-liveliness`](#hand-drawn-liveliness--garis-tangan-yang-hidup) | Kit gambar tangan: garis "boiling" 2 pose, warna garis dari posisi layar, click burst, noise overlay. |
| [`pixelate-swap`](#pixelate-swap--ganti-gambar-lewat-blok-pixel) | Gambar berganti lewat blok pixel 64 → 2px (70ms per langkah) + percikan kecil dari tombol. |

---

## Fondasi

`gen-core.js`: hash, value noise + fBm (3 oktaf 0.6/0.3/0.1 seperti R09), canvas DPR, pattern checker, dan matriks Bayer. Semua koordinat gambar memakai **device pixel yang dibulatkan**, supaya tepi sel tajam dan tidak ada garis seam di DPR 1.5.

```js
// gen-core.js (1/2): noise & dither
import { smoothstep } from './motion-core.js';

export function hash2(x, y, seed = 0) {                          // integer → 0..1, deterministik
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 0) {                             // value noise 2D, 0..1
  const xi = Math.floor(x), yi = Math.floor(y), u = smoothstep(x - xi), v = smoothstep(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  const top = a + (b - a) * u;
  return top + (c + (d - c) * u - top) * v;
}
export const fbm = (x, y, s = 0) => 0.6 * vnoise(x, y, s) + 0.3 * vnoise(2 * x, 2 * y, s + 1) + 0.1 * vnoise(4 * x, 4 * y, s + 2);
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // ordered dither 4×4
```

```js
// gen-core.js (2/2): canvas
export function fitCanvas(canvas, maxDpr = 2) {                   // ukuran intrinsik = CSS × DPR
  const dpr = Math.min(devicePixelRatio || 1, maxDpr), w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { ctx, w, h, dpr };
}
export function checker(ctx, a, b, px) {                          // tile 2×2 → pattern "halftone"
  const c = Object.assign(document.createElement('canvas'), { width: px * 2, height: px * 2 }), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, px * 2, px * 2);
  g.fillStyle = b; g.fillRect(0, 0, px, px); g.fillRect(px, px, px, px);
  return ctx.createPattern(c, 'repeat');
}
export function makeFills(ctx, el, dpr, cell) {                   // 5 tone dari CSS var
  const v = (n, f) => getComputedStyle(el).getPropertyValue(n).trim() || f;
  const deep = v('--sky-deep', '#0af'), mid = v('--sky-mid', '#7cf'), pale = v('--sky-pale', '#fff');
  const px = Math.max(1, Math.round((cell * dpr) / 10));
  return [deep, checker(ctx, deep, mid, px), mid, checker(ctx, mid, pale, px), pale];
}
/** Gambar sel {c, r, tone} yang lolos `keep`. size = ukuran sel (px CSS), off = offset kotak. Tepi dibulatkan di device px. */
export function drawCells({ ctx, dpr }, cells, fills, size, keep, off = { x: 0, y: 0 }) {
  for (const s of cells) {
    if (!keep(s)) continue;
    const x0 = Math.round((off.x + s.c * size) * dpr), y0 = Math.round((off.y + s.r * size) * dpr);
    ctx.fillStyle = fills[s.tone];
    ctx.fillRect(x0, y0, Math.round((off.x + (s.c + 1) * size) * dpr) - x0, Math.round((off.y + (s.r + 1) * size) * dpr) - y0);
  }
}
```

Aturan umum:
- Canvas generatif selalu `aria-hidden="true"`. Teks penting tidak boleh hanya ada di dalam canvas.
- Loop hanya jalan saat terlihat (`defineSection` sudah mengurus) dan di-throttle ke fps target. Render ulang saat resize dan saat tema berubah (warna dibaca dari CSS var).
- Pasang `image-rendering: pixelated` di canvas supaya browser tidak menghaluskan saat skala CSS ≠ intrinsik.

### `pixel-sky-dither` — Langit pixel 5 tone

**Sumber:** R09 · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Hero atau motif pemersatu situs (divider band, header kartu, footer) dengan look bitmap/halftone yang sering dikira ASCII: grid sel 22px, 5 tone, dua di antaranya checker 2px.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `cell` | 22px | 12–40px | Ukuran sel. Di mobile tetap 22 (R09), grid jadi lebih kasar tapi tetap terbaca. |
| `thresholds` | `[.42, .49, .55, .61]` | geser ±0.05 | Batas 5 tone dari fBm. Naikkan semua = langit lebih putih. |
| `tones` | `#0AF`, checker, `#7CF`, checker, `#fff` | 3 warna CSS var | deep / mid / pale, checker = campuran 2×2. Dark theme R09: `#6BF` / `#9DF`. |
| `checkerPx` | `round(cell × dpr / 10)` | 1–3 device px | Ukuran kotak checker (≈2px). |
| `chunky` | noise ke-2 > 0.6 → snap 3× sel | scale 2–4, threshold 0.5–0.7 | Blok kasar di antara sel kecil: resolusi campur yang bikin terasa seperti ASCII art. |
| `stretchY` | 2.2 | 1.5–3 | Frekuensi Y lebih tinggi → awan memanjang horizontal. Skala noise `2.4 / lebar`. |
| `wind` / `fps` | 40s per lebar layar / 24fps | 20–80s / 12–24fps | Drift horizontal, dirender stop-motion. `wind: 0` = statis. |
| `reveal` | radial, 900ms, 12 step | 480–1200ms, 6–12 step | Sel muncul dari pusat; order = jarak radial × 0.82 + acak × 0.18. Popup R09: 480ms, 6 step. |
| `seed` | 12 | — | Deterministik: refresh memberi langit yang sama. |

**Resep:**
1. Canvas absolut memenuhi container (`aria-hidden`, `image-rendering: pixelated`), copy di atasnya.
2. Bangun grid: tiap sel ambil nilai fBm di posisi sel (+ offset wind), snap ke grid 3× kalau berada di zona "chunky", kuantisasi ke tone 0–4.
3. Simpan `order` per sel dari jarak radial + hash (bukan `Math.random()`, supaya order tidak berkedip saat grid dibangun ulang tiap frame wind).
4. Render: `clearRect`, lalu `fillRect` per sel dengan `fills[tone]`, hanya sel `order ≤ reveal`. Reveal dikuantisasi `ceil(p × steps) / steps` supaya muncul "pop" per ring.
5. Zona bersih di sekitar teks (R09): untuk tiap sel, `d = jarak ke rect copy / cell + (fbm − 0.5) × 6`, `t = max(0, d − 2)`, paksa tone naik ke `[4, 3, 2, 1][ceil(t)]` (≥ 4 tidak diubah), ambil max dengan tone asli. Hasilnya halo putih bergerigi.
6. Horizon bawah (R09): buang sel di bawah `tinggi − peek(80px) − noise`, beri lapisan tepi tone 3/4 dan bintik acak 5%.

```js
// pixel-sky.js
import { defineSection, clamp } from './motion-core.js';
import { hash2, vnoise, fbm, fitCanvas, makeFills, drawCells } from './gen-core.js';
const STOPS = [0.42, 0.49, 0.55, 0.61];

export function buildSky({ w, h }, { cell = 22, seed = 12 }, shift = 0) {
  const k = 2.4 / w, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), maxR = Math.hypot(cols, rows) / 2, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let sx = c * cell + shift, sy = r * cell;
    if (vnoise(sx * k * 1.3, sy * k * 1.3, seed + 7) > 0.6) { sx -= sx % (cell * 3); sy -= sy % (cell * 3); }
    const n = fbm(sx * k, sy * k * 2.2, seed), tone = STOPS.filter((t) => n >= t).length;
    out.push({ c, r, tone, order: (Math.hypot(c - cols / 2, r - rows / 2) / maxR) * 0.82 + hash2(c, r, seed) * 0.18 });
  }
  return out;
}
export function pixelSky(canvas, { cell = 22, seed = 12, wind = 40, fps = 24, revealMs = 900, steps = 12 } = {}) {
  let g = fitCanvas(canvas), fills = makeFills(g.ctx, canvas, g.dpr, cell), t0 = -1, last = -1;
  const frame = (e) => {
    const q = Math.ceil(clamp((e * 1000) / revealMs) * steps) / steps;            // reveal berundak
    g.ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCells(g, buildSky(g, { cell, seed }, wind ? (e * g.w) / wind : 0), fills, cell, (s) => s.order <= q);
  };
  return defineSection(canvas, () => ({
    onResize() { g = fitCanvas(canvas); fills = makeFills(g.ctx, canvas, g.dpr, cell); frame(Math.max(last, 0)); },
    renderStatic: () => frame((last = revealMs / 1000)),                       // reduce: 1 frame penuh
    update(dt, time) {
      if (t0 < 0) t0 = time;
      const e = time - t0;
      if (last >= 0 && e - last < 1 / fps) return;                                   // 24fps stop-motion
      frame((last = e));
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Reduce → satu frame statis yang sudah ter-reveal penuh, tanpa wind (R09 merender Sky statis 1 frame). Canvas `aria-hidden`; teks di atasnya tetap DOM. Pastikan kontras teks di atas tone `deep` cukup, atau andalkan zona bersih (langkah 5) supaya teks selalu duduk di tone pale.

**Jebakan:**
- `Math.random()` untuk order → sel berkedip tiap frame wind. Pakai hash dari koordinat sel.
- `setTransform(dpr)` + ukuran sel pecahan di DPR 1.5 = garis seam tipis antar sel. Hitung tepi tiap sel di device px lalu bulatkan (seperti `drawCells`).
- Membangun ulang grid tiap frame aman untuk ±2.700 sel (1440×900 @22px), tapi `cell` 12px di layar 4K = 30k+ sel. Naikkan `cell` atau turunkan fps di layar besar.
- Warna dibaca dari CSS var hanya saat init/resize. Kalau ada theme switch, panggil ulang `makeFills` (R09 memakai MutationObserver pada atribut tema).

### `dissolve-to-cube` — Langit larut jadi kubus

**Sumber:** R09 · **Mode:** A · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Hero sticky yang menceritakan "dari luas ke satu fokus": saat scroll, langit pixel tersedot ke tengah, menyisakan kubus 14×14 sel yang terbang dan mendarat di celah di judul baru ("Design ▦ Engineer").

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `screens` | 1.8 | 1.5–2.5 | Tinggi stage (180%) dengan child sticky 100vh. |
| `dissolve` | Q 0.05 → 0.55, 7 step | — | Sel hilang dari luar ke dalam (order radial), berundak. |
| `across` | 14 | 8–16 | Kubus = mini-sky 14×14 sel dengan reveal radial sendiri. |
| `fly` | Q 0.6 → 0.85, `easeInOutCubic` | — | Kubus pindah dari tengah ke rect `.slot` (1cap × 1cap di judul), mengecil. |
| `lift` | `sin(πt) × 0.08 × tinggi` | 0.05–0.12 | Lintasan melengkung ke atas. |
| `swapAt` | Q ≥ 0.62 | — | Kelas `.swapped`: judul lama keluar, judul baru muncul. |
| `wordOut` | `--out = Q / 0.3`, per kata `out × 1.8 − i × 0.16` | — | Kata judul lama fade + naik 0.25em berurutan (CSS calc). |
| `wordIn` | 500ms `step-end`, stagger 70ms | — | Kata baru tumbuh 0.35 → 0.65 → 1 berundak, didahului "pixel mark" 0.12em. |

**Resep:**
1. Markup: `.stage { height: 180% }` → `.sticky { position: sticky; top: 0; height: 100vh }` berisi canvas, `h1.before` (judul lama per kata) dan `h1.after` (judul baru dengan `<span class="slot">`).
2. Pakai `buildSky` (dari `pixel-sky-dither`) dan `drawCells` (Fondasi). Kubus = grid kedua seukuran `across × cell`.
3. Per frame: `keep` sel langit = `1 − dissolve` (berundak), kubus menampilkan sel dengan `order × 0.9 ≤ 1 − keep` (terisi saat langit larut).
4. Posisi kubus: lerp dari tengah canvas ke rect `.slot` relatif canvas, ukuran sel = `lerp(home, slot.height) / across`.
5. CSS judul lama: `.before .word { --gone: clamp(0, calc(var(--out) * 1.8 - var(--i) * .16), 1); opacity: calc(1 - var(--gone)); translate: 0 calc(var(--gone) * -.25em); }`. Judul baru: `.swapped .after .text { animation: grow 500ms step-end calc(var(--i) * 70ms) both; }` dengan keyframe scale 0.35 → 0.65 → 1.

```js
import { defineSection, stickyProgress, clamp, lerp, ease } from './motion-core.js';
import { fitCanvas, makeFills, drawCells } from './gen-core.js';
import { buildSky } from './pixel-sky.js';

export function skyToCube(stage, canvas, slot, root, { cell = 22, seed = 12, across = 14 } = {}) {
  let g, fills, sky, cube, lastQ = -1, fixed = null;
  const init = () => {
    g = fitCanvas(canvas); fills = makeFills(g.ctx, canvas, g.dpr, cell);
    sky = buildSky(g, { cell, seed });
    cube = buildSky({ w: across * cell, h: across * cell }, { cell, seed: seed + 1 });
  };
  const render = (Q) => {
    if (Math.abs(Q - lastQ) < 1e-4) return;
    lastQ = Q;
    const keep = Math.ceil((1 - clamp((Q - 0.05) / 0.5)) * 7) / 7;            // larut radial, 7 step
    g.ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCells(g, sky, fills, cell, (s) => s.order <= keep);
    const home = { x: (g.w - across * cell) / 2, y: (g.h - across * cell) / 2, size: across * cell };
    const sr = slot.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    const t = ease.inOutCubic(clamp((Q - 0.6) / 0.25));
    const box = { x: lerp(home.x, sr.left - cr.left, t), y: lerp(home.y, sr.top - cr.top, t) - Math.sin(Math.PI * t) * g.h * 0.08 };
    drawCells(g, cube, fills, lerp(home.size, sr.height, t) / across, (s) => s.order * 0.9 <= 1 - keep, box);
    root.classList.toggle('swapped', Q >= 0.62);
    root.style.setProperty('--out', clamp(Q / 0.3).toFixed(3));
  };
  init();
  return defineSection(stage, () => ({
    onResize() { init(); lastQ = -1; render(fixed ?? stickyProgress(stage)); },
    renderStatic: () => render((fixed = 1)),
    update: () => render(stickyProgress(stage)),
  }));
}
```

**Reduced-motion & aksesibilitas:** Reduce → stage dan sticky jadi 100% (tanpa fase scroll), progress dipaksa 1: judul akhir + kubus sudah di slot, animasi kata `none`, Lenis tidak dinyalakan (semua seperti R09). `h1` diberi `aria-label` teks final; span visual per kata dan `.slot` `aria-hidden`. Judul lama yang memudar juga `aria-hidden` supaya pembaca layar tidak membaca dua judul.

**Jebakan:**
- `.slot` diukur tiap frame dan harus sudah punya ukuran sebelum `.swapped` (pakai `visibility: hidden`, bukan `display: none`, untuk judul baru sebelum swap).
- Stage dengan scroller custom (R09: Lenis di wrapper div) → event `scroll` tidak di `window`. Listener R09 dipasang capture di `document`; dengan `defineSection` cukup karena progress dibaca dari rect tiap frame.
- `step-end` di keyframe berarti nilai berubah di akhir tiap segmen. Keyframe 0/15/30/55% dengan `step-end` memberi rasa "berundak" khas R09; dengan ease biasa efeknya hilang.

### `bayer-dither-stamp` — Foto jadi stamp pixel

**Sumber:** R09 · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Thumbnail/foto yang diseragamkan ke bahasa visual pixel situs (R09 "Taste notes": stamp pos bergerigi berisi foto 5 tone per warna biru/hijau/pink/oranye).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `px` | 4 | 2–8 | Ukuran pixel hasil (px CSS). Kecil = detail, besar = lebih "stamp". |
| `levels` | 5 | 2–8 | Jumlah tone palet. R09 = 5. |
| `palette` | 5 warna gelap → terang satu hue | — | Satu palet per stamp (biru, hijau, pink, oranye). |
| `mode` | `luma` | `luma` · `nearest` | `luma`: urutkan palet per kecerahan (R09 luminance rank). `nearest`: pilih warna palet terdekat (weighted RGB) untuk foto berwarna. |
| `contrast` | 1.1 | 0.9–1.4 | Perentang luminance sebelum dither. Foto kusam butuh > 1. |
| `matrix` | Bayer 4×4 | 2×2 · 4×4 · 8×8 | Pola ordered dither. 4×4 = tekstur "anyaman" yang khas. |

**Resep:**
1. Downsample foto ke `lebar / px` kolom (satu pixel kecil = satu sel), ambil `getImageData`.
2. Per pixel: luminance `0.2126R + 0.7152G + 0.0722B`, regang dengan `contrast`.
3. Tone = `floor(L × (levels − 1) + (B[x&3, y&3] + 0.5) / 16)`, clamp. Ambang yang bergeser per posisi menghasilkan pola checker di gradasi.
4. Tulis warna palet, `putImageData`, lalu gambar ke canvas tampil dengan `imageSmoothingEnabled = false`.
5. Tepi stamp bergerigi: CSS `mask` dengan `radial-gradient` berulang di tepi (perforasi), atau `clip-path` polygon zigzag.

```js
import { BAYER4 } from './gen-core.js';
const hexRgb = (hex) => hex.match(/\w\w/g).map((x) => parseInt(x, 16));   // butuh format #rrggbb

/** img (same-origin / CORS) → canvas berisi pixel `levels` tone. */
export async function ditherStamp(img, canvas, {
  px = 4, contrast = 1.1, palette = ['#0b2a6f', '#1f5fd1', '#5aa0ff', '#bcd9ff', '#ffffff'],
} = {}) {
  await img.decode();
  const w = Math.max(1, Math.round(canvas.clientWidth / px));
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const src = Object.assign(document.createElement('canvas'), { width: w, height: h })
    .getContext('2d', { willReadFrequently: true });
  src.drawImage(img, 0, 0, w, h);                                           // 1 pixel = 1 sel
  const data = src.getImageData(0, 0, w, h), d = data.data, n = palette.length, rgb = palette.map(hexRgb);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    L = Math.min(1, Math.max(0, (L - 0.5) * contrast + 0.5));
    const tone = Math.min(n - 1, Math.floor(L * (n - 1) + (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16));
    [d[i], d[i + 1], d[i + 2]] = rgb[tone];
  }
  src.putImageData(data, 0, 0);
  canvas.width = w * px; canvas.height = h * px;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src.canvas, 0, 0, canvas.width, canvas.height);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', img.alt || '');
}
```

**Reduced-motion & aksesibilitas:** Tidak ada motion, jadi aman di reduce. Canvas hasil mewarisi `alt` foto lewat `role="img"` + `aria-label`; kalau foto dekoratif (`alt=""`), beri `aria-hidden` saja. Jangan dither foto yang berisi teks penting (poster, screenshot UI): teks hancur.

**Jebakan:**
- `getImageData` dari gambar beda origin tanpa CORS = canvas "tainted", error. Gambar harus same-origin atau `crossOrigin="anonymous"` + header CORS dari server.
- Hitung sekali per gambar (atau saat build), jangan per frame. Untuk banyak stamp, jalankan saat `requestIdleCallback`.
- Canvas `w × px` intrinsik di layar DPR 2 akan di-upscale browser dan blur tanpa `image-rendering: pixelated`.
- Palet `nearest` dengan jarak RGB polos memberi hasil kotor di warna kulit/hijau. Bobot (0.3, 0.59, 0.11) per kanal lebih stabil.

### `ascii-glyph-ramp` — ASCII asli dengan ramp karakter

**Sumber:** R09 · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Kalau tim memang mau **huruf** (bukan pixel dither): medan noise atau gambar yang dirender sebagai karakter mono. R09 sendiri tidak memakai glyph (look "ASCII"-nya dari checker), varian ini adalah opsi yang dicatat di riset.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `cell` | 12px | 8–18px | Tinggi baris = ukuran font. Lebar kolom = lebar glyph mono (±0.6 × cell). |
| `ramp` | `" .:-=+*#%@"` | 5–16 karakter | Terang → gelap (untuk glyph gelap di bg terang). Balik urutan untuk bg gelap. Versi 5 tone R09: `@ % + : (spasi)`. Blok: `░▒▓█`. |
| `source` | noise fBm | noise · gambar · video | Fungsi `(col, row, shift) → 0..1`. Gambar: luminance per sel (pakai langkah 1 `bayer-dither-stamp`). |
| `stretch` | `(n − 0.38) / 0.28` | — | fBm berkumpul di 0.3–0.7; regangkan supaya ramp terpakai penuh. |
| `wind` / `fps` | 40s / 12fps | 20–80s / 8–24fps | ASCII terasa lebih "terminal" di fps rendah. |
| `mode` | canvas | canvas · `<pre>` | `<pre>` DOM cocok kalau grid ≤ ±80 × 40; teks bisa dipilih. |

**Resep:**
1. Ukur lebar glyph sekali: `ctx.measureText('M').width` dengan font mono, hitung jumlah kolom/baris.
2. Per frame: untuk tiap baris, susun string karakter dari ramp, lalu **satu** `fillText` per baris (bukan per karakter).
3. Warna glyph dari CSS `color` canvas, jadi ikut tema.
4. Untuk sumber gambar: downsample ke `cols × rows`, ambil luminance, lalu (opsional) tambahkan offset Bayer supaya gradasi tidak "berpita".

```js
import { defineSection, clamp } from './motion-core.js';
import { fbm } from './gen-core.js';

export function asciiField(canvas, { cell = 12, ramp = ' .:-=+*#%@', seed = 12, wind = 40, fps = 12, source = null } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, cols = 0, rows = 0, cw = 0, t0 = -1, last = -1;
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${cell}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'top';
    cw = ctx.measureText('M').width; cols = Math.floor(W / cw); rows = Math.floor(H / cell);
  };
  const value = source || ((c, r, sh) => clamp((fbm(((c * cw + sh) * 2.4) / W, (r * cell * 5.28) / W, seed) - 0.38) / 0.28));
  const draw = (e) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const sh = wind ? (e * W) / wind : 0, top = ramp.length - 1;
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) line += ramp[Math.min(top, Math.floor(value(c, r, sh) * ramp.length))];
      ctx.fillText(line, 0, r * cell);                                      // satu fillText per baris
    }
  };
  fit();
  return defineSection(canvas, () => ({
    onResize() { fit(); draw(Math.max(last, 0)); },
    renderStatic: () => draw(0),
    update(dt, time) {
      const e = time - (t0 < 0 ? (t0 = time) : t0);
      if (last >= 0 && e - last < 1 / fps) return;
      draw((last = e));
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Reduce → satu frame statis. Canvas `aria-hidden`. Varian `<pre>` juga harus `aria-hidden="true"`, kalau tidak pembaca layar membacakan ribuan simbol. Kalau ASCII membentuk kata/logo, sediakan teks asli di `.sr-only`.

**Jebakan:**
- Font mono belum termuat saat `measureText` → lebar kolom salah, baris bergeser. Panggil `fit()` lagi setelah `document.fonts.ready`.
- Font "mono" yang fallback ke proporsional (karakter blok `░▒▓` tidak ada di font) membuat kolom tidak lurus. Uji glyph ramp di font target.
- `<pre>` dengan 100+ kolom × 60 baris yang di-update 12fps = reflow besar. Di atas ±80 × 40 pakai canvas.

### `hand-drawn-liveliness` — Garis tangan yang hidup

**Sumber:** R08, R06b · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Situs bergaya gambar tangan/scan yang harus terasa hidup walau diam: garis "boiling" (bergetar 2 pose), garis yang digambar user berubah warna menurut posisinya, burst gambar kecil di titik klik, dan grain kertas.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `boil` | 2 pose, loop 0.7s `step-end` (0.35s per pose) | 2–3 pose, 0.5–0.9s | R08: kata tulisan tangan dan ikon. Untuk canvas: jitter titik dengan seed yang berganti tiap pose. |
| `boilPx` | 1.2px | 0.6–2px | Amplitudo jitter garis canvas. Usulan (R08 memakai 2 frame gambar, bukan jitter). |
| `flipbook` | 8 frame × 0.16s | — | Loader bunga R08 (opacity per frame, repeat −1). |
| `hue` | `215 + 175 × x/W + 50 × (y/H − 0.5)` | — | Garis/foto biru di kiri → oranye di kanan, ±25° vertikal (R06b). Saturasi 0.7. |
| `line` | 1.2px, alpha 0.5 → 0 dalam 1.25s (easeInOut) | 1–2px, 0.8–1.5s | Garis yang digambar memudar sendiri (R06b). Titik dicatat tiap gerak ≥ 2px. |
| `burst` | scale 0 → 0.3–0.43, rot ±25°, `back.out(1.6)` 0.22s, lalu fade | — | Gambar kecil di titik klik (R08), dihapus setelah selesai. |
| `grain` | PNG noise fixed, `mix-blend-mode: color-burn`, opacity 0.1 | 0.06–0.18 | Tekstur kertas (R08). R03: `body::after` grain opacity 0.18. |

**Resep:**
1. **Boil gambar (CSS):** dua `<img>` pose A/B ditumpuk, `@keyframes boil { 50% { opacity: 0 } }` pada pose A dengan `animation: boil .7s step-end infinite`. Flipbook loader: N frame, satu frame `opacity: 1` per langkah 0.16s.
2. **Garis canvas:** simpan titik `{x, y, t, id}`; tiap frame buang titik yang umurnya > `life`, gambar segmen dengan alpha memudar dan warna dari posisi.
3. **Boil garis:** jitter tiap titik = `hash(id, sumbu, pose)`, pose = `floor(time / 0.35) % 2`. Pakai `id` monoton (bukan indeks array), kalau tidak pola jitter berubah setiap titik lama dibuang.
4. **Click burst:** `<img>` di layer fixed `pointer-events: none` pada titik klik, WAAPI scale 0 → 0.3–0.43 + rotasi acak ±25° 220ms `cubic-bezier(.34,1.56,.64,1)`, lalu fade, `remove()` di `finished`.
5. Varian R06b "draw-to-reveal": setiap jalur menempuh `size × (0.55–0.85)`, munculkan foto/kata di sepanjang garis (di-tint warna posisi sekali saat spawn), maks 240 item FIFO.

```js
import { defineSection, clamp, ease } from './motion-core.js';
import { hash2 } from './gen-core.js';

export function drawnTrail(canvas, { life = 1.25, width = 1.2, boilPx = 1.2, boilStep = 0.35 } = {}) {
  const ctx = canvas.getContext('2d'), pts = [];
  let W = 0, H = 0, down = false, now = 0, id = 0;
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const hue = (x, y) => 215 + 175 * (x / W) + 50 * (y / H - 0.5);              // biru kiri → oranye kanan
  canvas.addEventListener('pointerdown', (e) => { down = true; canvas.setPointerCapture(e.pointerId); pts.push(null); });
  canvas.addEventListener('pointerup', () => (down = false));
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, p = pts.at(-1);
    if (!p || Math.hypot(x - p.x, y - p.y) >= 2) pts.push({ x, y, t: now, id: id++ });
  });
  fit();
  return defineSection(canvas, (s) => ({
    onResize: fit,
    update(dt, time) {
      now = time; while (pts.length && (!pts[0] || now - pts[0].t > life)) pts.shift();
      ctx.clearRect(0, 0, W, H); ctx.lineWidth = width; ctx.lineCap = 'round';
      const pose = s.reduced ? 0 : Math.floor(time / boilStep) % 2;            // boil: 2 pose bergantian
      const J = (p, ax) => (hash2(p.id, ax, pose) - 0.5) * 2 * boilPx;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; if (!a || !b) continue;              // null = pemisah stroke
        const fade = 1 - ease.inOutCubic(clamp((now - b.t) / life));
        ctx.strokeStyle = `hsl(${hue(b.x, b.y).toFixed(0)} 70% 55% / ${(0.5 * fade).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x + J(a, 0), a.y + J(a, 1)); ctx.lineTo(b.x + J(b, 0), b.y + J(b, 1)); ctx.stroke();
      }
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Reduce → pose boil dibekukan (garis tetap bisa digambar karena dipicu user), flipbook berhenti di satu pose, burst diganti titik kecil yang fade 150ms atau tidak ada, demo stroke otomatis dimatikan (R08 mematikan float, flipbook, dan micro-interaction saat reduce). Canvas gambar `aria-hidden` + `touch-action: none` hanya di area gambar, beri instruksi teks ("Tekan dan gambar") di dekatnya. Burst gambar `alt=""`.

**Jebakan:**
- `touch-action: none` di area besar membuat halaman tidak bisa di-scroll di HP kalau sentuhan dimulai di situ. Batasi area gambar, atau aktifkan gambar hanya setelah tap pertama.
- Canvas kosong saat pertama dibuka terasa "rusak". R06b memutar garis demo bergelombang sampai user mulai menggambar.
- Burst `<img>` yang tidak dihapus menumpuk di DOM. Hapus di `animation.finished`, dan batasi jumlah burst aktif (mis. 12).
- `mix-blend-mode` di overlay grain full-screen memaksa compositing seluruh halaman. Kalau scroll terasa berat di HP, ganti dengan grain biasa opacity rendah.

### `pixelate-swap` — Ganti gambar lewat blok pixel

**Sumber:** R14 · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Toggle mode yang mengganti semua gambar ke versi lain (R14 "Daughter": gambar asli ↔ versi gambar pensil anak), atau swap gambar produk/varian yang ingin terasa digital/retro, plus percikan kecil dari tombol pemicu.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `blocks` | 64, 32, 16, 8, 4, 2 px | mulai 32–96, akhir 2–4 | Ukuran blok tiap langkah, lalu gambar tajam. |
| `stepMs` | 70ms | 50–100ms | Durasi per langkah (R14). 6 langkah ≈ 0.42s. |
| `mask` | `destination-in` dengan gambar asli | — | Blok dipotong ke siluet gambar (PNG transparan), jadi tepi tidak "bocor" jadi kotak. |
| `stagger` | 0–40ms antar gambar | — | Kalau banyak gambar berganti sekaligus. Usulan. |
| `sparks` | 4 percikan dari tombol | 3–8 | R14: percikan terlempar dengan gravitasi sederhana. Angka usulan: vx ±120–240 px/s, vy −300…−420 px/s, g 1200 px/s², hidup 0.6s. |

**Resep:**
1. Tiap gambar yang bisa di-swap dirender ke `<canvas>` seukuran kotaknya (aspek canvas = aspek gambar, atau hitung `contain` sendiri).
2. Per langkah: downsample gambar baru ke `w / blok × h / blok` dengan smoothing **on** (rata-rata warna), lalu upscale ke canvas dengan smoothing **off** (blok tajam).
3. `destination-in` dengan gambar resolusi penuh memotong blok ke siluet asli.
4. Setelah langkah terakhir, gambar tajam. Timing per langkah memakai `setTimeout` karena memang berundak (bukan per frame).
5. Percikan: 4 elemen kecil di posisi tombol, integrasi `vy += g × dt`, posisi += v × dt di `ticker`, fade di akhir umur, lalu dihapus.

```js
import { reducedMotion } from './motion-core.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ganti isi canvas ke `next` dengan pixelate-in 64 → 2px, siluet dijaga lewat destination-in. */
export async function pixelateSwap(canvas, next, { blocks = [64, 32, 16, 8, 4, 2], stepMs = 70 } = {}) {
  await next.decode();
  const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d'), tmp = document.createElement('canvas'), t = tmp.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sharp = () => {
    ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, W, H); ctx.drawImage(next, 0, 0, W, H);
  };
  if (reducedMotion()) return sharp();
  for (const b of blocks) {
    tmp.width = Math.max(1, Math.round(w / b)); tmp.height = Math.max(1, Math.round(h / b));
    t.imageSmoothingEnabled = true;
    t.drawImage(next, 0, 0, tmp.width, tmp.height);                 // rata-rata warna per blok
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, W, H);                                   // upscale tanpa smoothing = blok tajam
    ctx.globalCompositeOperation = 'destination-in';                 // potong ke siluet asli
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(next, 0, 0, W, H);
    await sleep(stepMs);
  }
  sharp();
}
// Toggle mode: Promise.all(canvases.map((c, i) => sleep(i * 30).then(() => pixelateSwap(c, imgs[mode][i]))))
```

**Reduced-motion & aksesibilitas:** Reduce → gambar langsung berganti, tanpa percikan. Canvas pengganti `<img>` harus membawa `role="img"` + `aria-label` dari `alt` gambar yang sedang tampil, dan label ikut diganti saat swap. Tombol mode berupa `<button aria-pressed>` dengan nama yang jelas ("Mode gambar anak").

**Jebakan:**
- `drawImage` gambar beda origin ke canvas tidak masalah untuk menggambar, tapi kalau nanti `getImageData`/`toDataURL` dipakai, canvas tainted. Simpan aset swap di origin yang sama.
- Downsample dengan smoothing off memberi blok berwarna "acak" (sampling satu pixel), bukan rata-rata. Smoothing harus on di langkah kecil, off di langkah besar.
- Canvas dengan aspek beda dari gambar → gambar gepeng. Hitung rect `contain`/`cover` sendiri sebelum `drawImage`.
- Swap beruntun cepat (klik toggle berkali-kali) → dua loop menulis canvas yang sama. Simpan token per canvas dan hentikan loop lama, sama seperti `morphTo` di `transitions.md`.
