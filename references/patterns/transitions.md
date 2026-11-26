# Transitions — pindah halaman, pindah state, morph UI

Katalog pola untuk momen "pindah": antar route (veil, View Transitions), antar state dalam satu section (layout morph, content switcher, theme switch), dan morph elemen (FLIP, clip-path, lift). Prinsip yang berulang di semua referensi: **tutup potongan dengan gerak di titik kecepatan tertinggi** (veil menutup, blur di puncak spin, overlay 200ms), lalu sinkronkan semua layer lain ke satu titik itu. Snippet memakai `motion-core.js` + helper `tween.js` di bagian Fondasi; kalau halaman sudah memuat GSAP, padanannya ditulis di parameter dan cukup panggil `ticker.useGsap(gsap)` supaya satu clock.

| id | ringkas |
|---|---|
| [`route-veil-transition`](#route-veil-transition--tirai-antar-halaman) | Tirai full-screen wipe menutup, halaman lama mundur, fetch paralel, lalu tirai keluar dan konten baru reveal. |
| [`mpa-view-transition`](#mpa-view-transition--view-transitions-tanpa-router) | `@view-transition` lintas dokumen + prefetch saat hover, zero framework. |
| [`flip-morph`](#flip-morph--objek-ke-modal--layout-toggle) | FLIP manual: objek terbang jadi modal, list ↔ grid, shared element antar halaman. |
| [`layout-morph-carousel`](#layout-morph-carousel--susunan-objek-berganti) | N objek berpindah antar K susunan preset mengikuti wheel, wrap tanpa ujung. |
| [`svg-picker-lift`](#svg-picker-lift--pilih-item-svg-salinan-terangkat) | Klik item SVG → tempat asal jadi socket, salinan terangkat dengan spring, panel detail berganti. |
| [`page-zoom-intro`](#page-zoom-intro--halaman-mini-zoom-jadi-penuh) | Intro: tirai naik, logo + nav muncul, halaman mini zoom jadi ukuran penuh. |
| [`circle-wipe`](#circle-wipe--lingkaran-membesar-menutup-layar) | Lingkaran dari elemen asal membesar sampai menutup layar (scroll atau klik). |
| [`clip-path-shape-morph`](#clip-path-shape-morph--morph-bentuk-lewat-polygon) | Morph antar bentuk lewat `clip-path: polygon()` yang di-resample ke 72 titik. Termasuk loader bentuk logo. |
| [`print-curl-transition`](#print-curl-transition--section-jadi-lembar-foto-melengkung) | Section berubah jadi lembar foto yang melengkung sesuai kecepatan scroll lalu terbang keluar. |
| [`theme-token-switch`](#theme-token-switch--ganti-tema-lewat-token) | Ganti tema/persona: tween token warna, overlay swap, nav gelap/terang. |
| [`blinds-reveal`](#blinds-reveal--reveal-tirai-jendela) | 17 strip horizontal membuka konten seperti venetian blinds, di-scrub scroll. |
| [`staggered-content-switcher`](#staggered-content-switcher--tab-dengan-wipe-bertahap) | Tab: underline spring, baris wipe bertahap, media wipe + scale, teks sapuan warna. |

Pola terkait di file lain: `pixelate-swap` (gambar berganti lewat blok pixel 64 → 2px, R14) ada di `generative.md` karena berbasis Canvas2D. Reveal teks yang disinkronkan ke transisi ada di `typography.md` → `masked-split-reveal`.

---

## Fondasi

`tween.js`: tween berbasis waktu di atas `ticker` motion-core, plus konverter `cubic-bezier` supaya ease dari riset bisa dipakai apa adanya. Padanan GSAP: `power1` = quad, `power2` = cubic, `power3` = quart, `power4` = quint.

```js
// tween.js
import { ticker, ease } from './motion-core.js';

/** cubic-bezier CSS → fungsi ease (bisection, x(t) monoton untuk x1, x2 di [0, 1]). */
export function bezier(x1, y1, x2, y2) {
  const f = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < x) lo = t; else hi = t; }
    return f(t, y1, y2);
  };
}
export const E = {
  ...ease,                                   // outCubic = power2.out, inOutCubic = power2.inOut, inOutQuint = power4.inOut
  outQuart: bezier(0.165, 0.84, 0.44, 1),    // power3.out
  inOutQuart: bezier(0.77, 0, 0.175, 1),     // power3.inOut
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (10 - 20 * t)) / 2),
  outExpoCss: bezier(0.16, 1, 0.3, 1),       // "ease-out-expo" CSS (R13, R15)
};

/** onUpdate(k, t) dipanggil tiap frame selama `dur` detik; k = ease(t). Resolve saat selesai. */
export function tween(dur, onUpdate, easeFn = ease.outCubic) {
  return new Promise((done) => {
    if (!(dur > 0)) { onUpdate(1, 1); return done(); }
    let t = 0;
    const off = ticker.add((dt) => {
      t = Math.min(1, t + dt / dur);
      onUpdate(easeFn(t), t);
      if (t === 1) { off(); done(); }
    });
  });
}
export const wait = (s) => tween(s, () => {});
```

Aturan umum: setiap transisi punya **lock** (abaikan klik/navigasi kedua selama jalan), lock dilepas di akhir tween **terpanjang**, dan setiap transisi punya jalur reduced-motion yang tetap mengganti konten (fade ±0.2s atau instan).

### `route-veil-transition` — Tirai antar halaman

**Sumber:** R13, R11 · **Mode:** B · **Tingkat berat:** CSS (opsional WebGL untuk tepi kertas)

**Kapan dipakai:** Site multi-halaman dengan router SPA (Astro ClientRouter, Barba, Swup) yang ingin transisi bermerek: tirai menutup, halaman lama "mundur", halaman baru diambil paralel, lalu tirai keluar dan elemen halaman baru reveal sinkron dengan tirai.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `coverDur` | 1.3s | 0.9–1.4s | Tirai menutup, `clip-path: inset(100% 0 0 0)` → `inset(0)`, `expo.inOut`. |
| `revealDur` | 1.1s | 0.8–1.3s | Tirai keluar ke atas, `inset(0 0 100% 0)`. |
| `recede` | scale 0.96, y 10px | scale 0.94–0.98 | Halaman lama mundur, ease `cubic-bezier(.58,0,.38,1)`, origin = tengah viewport. |
| `scrim` | 0 → 0.55 dalam 0.91s | 0.4–0.6 | Gelap di atas halaman lama, di bawah tirai. |
| `holdLoaderAfter` / `maxWait` / `watchdog` | 500ms / 8s / 6s | 300–800ms / 4–8s / 5–8s | Loader muncul kalau 500ms setelah tertutup belum siap; tunggu font/modul berat maks 8s; watchdog paksa bersih di 6s; fetch > 20s → hard navigation. |
| `revealStartAt` | 40–50% wipe | 30–60% | Elemen `[data-reveal]` mulai di 40%, line mask di 50% (R13). |
| `reduced` | fade 0.2s | 0.15–0.3s | Opacity saja, tanpa wipe dan recede. |

**Resep:**
1. Markup global (persist antar halaman): `<div data-veil aria-hidden="true">` (fixed, inset 0, `z-index: 1200`, warna `--paper`, `visibility: hidden`) dan `<div data-scrim>` (fixed, hitam, opacity 0, di bawah veil). Header di-`z-index` di atas veil supaya tetap terlihat.
2. Saat navigasi dimulai: `cover()` dan fetch halaman baru **paralel** (`Promise.all`). Di Astro bungkus `e.loader` pada `astro:before-preparation`; di Barba/Swup pakai hook `leave`.
3. Swap DOM. Tunggu `document.fonts.ready` dan modul berat halaman tujuan (maks `maxWaitPerAsset`). Kalau lewat 500ms belum siap, tampilkan loader.
4. `reveal()` memancarkan `veil:reveal` dengan `wipeDur`. Modul lain (text reveal, objek 3D) mendengarkan event itu dan mulai di 40–50% durasi. `main` diberi `inert` selama tertutup; setelah reveal, fokus ke `h1` (beri `tabindex="-1"`).
5. **Varian flash (R11 "EXPOSED")**: alih-alih wipe, cover = teks menyala (`text-shadow` membesar) lalu overlay krem full-screen fade-in dengan spring kritis ω 6.5 (13 kalau user baru scroll cepat), swap di puncak putih, reveal = crossfade ke scene berikut.

```js
import { reducedMotion } from './motion-core.js';
import { tween, bezier, E } from './tween.js';
const veil = document.querySelector('[data-veil]'), scrim = document.querySelector('[data-scrim]');
const recede = bezier(0.58, 0, 0.38, 1);
const inset = (top, bottom) => `inset(${top}% 0% ${bottom}% 0%)`;

export async function cover() {
  const main = document.querySelector('main');
  main.inert = true;
  main.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
  veil.style.visibility = 'visible';
  if (reducedMotion()) {
    Object.assign(veil.style, { clipPath: inset(0, 0), opacity: 0 });
    return tween(0.2, (k) => (veil.style.opacity = k));
  }
  await tween(1.3, (k, t) => {
    veil.style.clipPath = inset(100 * (1 - k), 0);                           // bawah → atas
    const q = recede(t);
    main.style.transform = `translateY(${10 * q}px) scale(${1 - 0.04 * q})`;
    scrim.style.opacity = (0.55 * recede(Math.min(1, t / 0.7))).toFixed(3);  // 0.91s dari 1.3s
  }, E.inOutExpo);
}

export async function reveal({ dur = 1.1 } = {}) {
  const r = reducedMotion();
  scrim.style.opacity = 0;
  document.dispatchEvent(new CustomEvent('veil:reveal', { detail: { wipeDur: r ? 0 : dur } }));
  await (r ? tween(0.2, (k) => (veil.style.opacity = 1 - k))
           : tween(dur, (k) => (veil.style.clipPath = inset(0, 100 * k)), E.inOutExpo));   // keluar ke atas
  Object.assign(veil.style, { visibility: 'hidden', opacity: '', clipPath: inset(100, 0) });
  document.querySelector('main h1')?.focus({ preventScroll: true });
}
// Router apa pun:  await Promise.all([fetchPage(url), cover()]);  swapDom();  await assetsReady();  await reveal();
```

**Reduced-motion & aksesibilitas:** Reduce → veil fade 0.2s, tanpa recede. `inert` di `main` selama tertutup supaya Tab tidak masuk ke halaman yang sedang pergi; fokus pindah ke `h1` halaman baru (R13). Veil `aria-hidden`. Hormati gesture back bawaan browser: kalau UA sudah memutar animasi swipe-back sendiri (`hasUAVisualTransition`), lewati veil (R13 melakukan ini).

**Jebakan:**
- Load pertama juga memicu event "page-load". State awal veil harus "tertutup" lewat inline script + CSS di `<head>`, plus `@keyframes` failsafe yang menyembunyikan veil setelah ±4s kalau JS gagal (trik R13).
- Klik kedua saat veil jalan → navigasi dobel: `preventDefault` klik selama jalan, blok back/forward sampai idle. Lenis yang tetap jalan di belakang veil mengacaukan scroll halaman baru: `lenis.stop()` saat cover, sinkronkan ke `scrollY` setelah swap.
- Reveal sebelum modul berat siap = canvas kosong terlihat. Tunggu modul (maks 8s), jangan tunggu tanpa batas.

### `mpa-view-transition` — View Transitions tanpa router

**Sumber:** R13 · **Mode:** B · **Tingkat berat:** CSS

**Kapan dipakai:** Site statis/MPA biasa yang ingin transisi antar halaman tanpa JS router. Paling murah, progressive enhancement: browser tanpa dukungan tetap navigasi normal.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `old(root)` | 0.5s `cubic-bezier(.7,0,.84,0)` | 0.3–0.6s | Halaman lama mundur: scale 0.96, y 10px, brightness 0.45. |
| `new(root)` | 0.9s `cubic-bezier(.87,0,.13,1)` | 0.6–1s | Halaman baru wipe dari bawah (`clip-path inset`). |
| `sharedNames` | `header` | header, hero | Elemen bernama sama di dua halaman di-morph, bukan di-crossfade. |
| `types` | `back` | — | Ditambah lewat `pagereveal` untuk arah berbeda saat navigasi kembali. |
| `prefetch` | Speculation Rules `moderate` | `conservative` · `moderate` | `moderate` ≈ hover ±200ms. Fallback: `<link rel=prefetch>` setelah hover 80ms (Astro `prefetchAll`, R13). |

Contoh named element R13 (list ↔ detail lab): masuk 0.42s expo-out dari `translateY(6%) scale(.96)`, kembali 0.26s `cubic-bezier(.11,0,.5,0)`.

**Resep:**
1. Opt-in di **semua** halaman (asal dan tujuan, same-origin): `@view-transition { navigation: auto; }`.
2. Beri `view-transition-name` unik pada elemen bersama (header, gambar hero yang sama di list dan detail). Atur keyframes `::view-transition-old/new(root)`. Header: `animation: none` di group-nya supaya diam.
3. Script `pagereveal` harus script klasik di `<head>` (bukan `defer`/module), kalau tidak event-nya terlewat.
4. Prefetch: Speculation Rules; fallback hover 80ms, lewati kalau `navigator.connection.saveData`. Kalau konten utama belum ter-parse saat snapshot diambil, tambahkan `<link rel="expect" href="#main" blocking="render">`.

```html
<style>
  @view-transition { navigation: auto; }
  .site-header { view-transition-name: header; }
  ::view-transition-group(header) { animation: none; }
  ::view-transition-old(root) { animation: .5s cubic-bezier(.7,0,.84,0) both page-sink; }
  ::view-transition-new(root) { animation: .9s cubic-bezier(.87,0,.13,1) both page-rise; }
  html:active-view-transition-type(back)::view-transition-new(root) { animation-name: page-drop; }
  @keyframes page-sink { to { transform: scale(.96) translateY(10px); filter: brightness(.45); } }
  @keyframes page-rise { from { clip-path: inset(100% 0 0 0); } }
  @keyframes page-drop { from { clip-path: inset(0 0 100% 0); } }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
  }
</style>
<script type="speculationrules">
  { "prerender": [{ "where": { "and": [{ "href_matches": "/*" }, { "not": { "href_matches": "/logout" } }] }, "eagerness": "moderate" }] }
</script>
<script>
  addEventListener('pagereveal', (e) => {          // klasik, di <head>
    if (e.viewTransition && navigation?.activation?.navigationType === 'traverse') e.viewTransition.types.add('back');
  });
  if (!HTMLScriptElement.supports?.('speculationrules') && !navigator.connection?.saveData) {
    let tid;
    document.addEventListener('pointerover', (e) => {
      const a = e.target.closest('a[href^="/"]');
      if (!a || a.dataset.pf) return;
      tid = setTimeout(() => { document.head.append(Object.assign(document.createElement('link'), { rel: 'prefetch', href: a.href })); a.dataset.pf = 1; }, 80);
    });
    document.addEventListener('pointerout', () => clearTimeout(tid));
  }
</script>
```

**Reduced-motion & aksesibilitas:** Semua pseudo-element `animation: none` → snapshot langsung berganti. Fokus dan pengumuman halaman baru ditangani browser seperti navigasi biasa (kelebihan MPA dibanding SPA router).

**Jebakan:**
- Dukungan cross-document: Chromium 126+ dan Safari 18.2+; Firefox belum pasti per catatan R13. Tidak perlu polyfill, cukup degrade.
- `view-transition-name` harus unik per halaman: dua elemen bernama sama = seluruh transisi batal. `traverse` juga mencakup "forward"; kalau arah penting, bandingkan indeks entry history.
- Prerender semua `/*` ikut menjalankan halaman seperti logout atau tambah-keranjang via GET. Kecualikan URL yang punya efek samping.
- Overlay VT bisa memblok klik selama animasi: `::view-transition { pointer-events: none; }` (R13).

### `flip-morph` — Objek ke modal & layout toggle

**Sumber:** R08, R07 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Elemen yang sama berpindah tempat/ukuran: HP di meja terbang jadi modal (R08), galeri List ↔ Grid (R08), toples terbang ke hero halaman produk (R07). Satu teknik: FLIP (First, Last, Invert, Play).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `dur` | 0.55s | 0.45–0.9s | R08 Flip list↔grid 0.55s; objek → modal 0.85s. |
| `ease` | `power3.inOut` (`E.inOutQuart`) | inOutCubic–inOutQuart | Sama di R08 untuk Flip dan modal. |
| `stagger` | 0.02s | 0–0.04s | Antar item di layout toggle. |
| `contentDelay` | 0.55s | 0.4–0.6s | Isi modal fade-in setelah objek hampir sampai (R08). |
| `crossPage` | 2s `cubic-bezier(.22,1,.36,1)` | 1.2–2s | R07 jar flight lintas halaman, lebih lambat karena jarak jauh. |

**Resep:**
1. Ukur rect semua elemen (First). Jalankan `mutate()` (ganti kelas layout, pindahkan node ke modal). Ukur lagi (Last), set transform invers seketika (sebelum paint), lalu tween ke identitas.
2. Objek → modal: morph "cangkang" (gambar HP/kartu), lalu fade isi modal mulai `contentDelay`. Crossfade bayangan (bayangan meja → bayangan modal) supaya objek terasa terangkat.
3. Lintas halaman (R07): simpan rect + rotasi + snapshot (mis. `canvas.toDataURL()` untuk label dinamis) di `sessionStorage`. Di halaman tujuan, buat clone `position: fixed` di rect lama, tween ke rect hero, sembunyikan elemen asli sampai mendarat. Item lain di halaman asal fade + scale 0.94 dalam 0.42s.
4. Dengan GSAP: `const s = Flip.getState(items); toggle(); Flip.from(s, { duration: .55, ease: 'power3.inOut', absolute: true, stagger: .02 })`, dan `Flip.fit()` untuk grid → slideshow.

```js
import { reducedMotion } from './motion-core.js';
import { tween, E, wait } from './tween.js';

/** FLIP: ukur → mutate() → ukur → invert → play. */
export async function flip(els, mutate, { dur = 0.55, ease = E.inOutQuart, stagger = 0.02 } = {}) {
  const first = els.map((el) => el.getBoundingClientRect());
  mutate();
  if (reducedMotion()) return;
  const last = els.map((el) => el.getBoundingClientRect());
  await Promise.all(els.map(async (el, i) => {
    const a = first[i], b = last[i];
    const dx = a.left - b.left, dy = a.top - b.top;
    const sx = b.width ? a.width / b.width : 1, sy = b.height ? a.height / b.height : 1;
    const set = (k) => {
      const u = 1 - k;
      el.style.transform = `translate(${dx * u}px, ${dy * u}px) scale(${1 + (sx - 1) * u}, ${1 + (sy - 1) * u})`;
    };
    el.style.transformOrigin = '0 0';
    set(0);                                              // invert sebelum paint pertama
    await wait(i * stagger);
    await tween(dur, set, ease);
    el.style.transform = el.style.transformOrigin = '';
  }));
}
// List ↔ grid:   flip(items, () => gallery.classList.toggle('is-grid'));
// Objek → modal: flip([phone], () => modal.append(phone), { dur: 0.85 }).then(() => fadeIn(modalContent));
```

**Reduced-motion & aksesibilitas:** Reduce → DOM langsung berubah, tanpa terbang (R08 mengganti fly-out dengan fade 0.3s). Modal: pakai `<dialog>` + `showModal()` supaya fokus terkunci dan Esc menutup; kembalikan fokus ke objek asal saat tutup. Toggle List/Grid berupa tombol dengan `aria-pressed`.

**Jebakan:**
- `scale` mendistorsi teks, border, dan radius selama terbang. Untuk elemen berisi teks, morph cangkang/gambar saja, isi di-fade belakangan.
- Elemen yang sudah punya `transform` sendiri (rotasi, float idle) akan ditimpa. Bungkus dengan wrapper, FLIP di wrapper.
- Elemen di dalam container ber-`overflow: hidden` terpotong saat terbang. Pindahkan sementara ke layer `position: fixed` (R08, R07). Gambar yang belum termuat memberi ukuran Last salah: `await img.decode()` sebelum `mutate()`.

### `layout-morph-carousel` — Susunan objek berganti

**Sumber:** R08 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Hero "meja kerja" berisi banyak objek (PNG/ilustrasi) yang berpindah antar beberapa susunan preset saat di-scroll: berantakan → analog → digital → kembali. Headline ikut berganti kata.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `layouts` | 3 preset | 2–5 | Posisi `{x, y, r}` per item dalam % stage. x/y < 0 atau > 100 = parkir di luar layar. |
| `gain` | 0.0008 per px deltaY | 0.0005–0.0012 | Satu susunan ≈ 1250px wheel. Touch ×2.75. |
| `follow` | 0.07 per frame @60fps | wheel 0.07, touch 0.16, setelah fling 0.06 | Dikonversi ke λ lewat `followToLambda`. |
| `segmentEase` | `power4.inOut` (`ease.inOutQuint`) | inOutCubic–inOutQuint | Diterapkan per segmen, jadi objek "menahan" di tiap susunan. |
| `idleFloat` | y 3–6px, rot ±0.75°, 2.5–4s | — | Float yoyo per item, pause setelah 1.8s diam (hemat `will-change`). |
| `headlineSwap` | di t = 0.5 segmen | — | Kata tulisan tangan berganti di tengah perpindahan. |
| `exit` | radial 0.9s `power3.inOut`; kembali 0.7s | — | Saat overlay dibuka, semua item terlempar keluar dari pusat. |

**Resep:**
1. Preset: `LAYOUTS = { mix: { laptop: { x: 50, y: 77, r: -3 }, … }, analog: {…}, digital: {…} }`. Item `position: absolute; left: 0; top: 0`, transform dari JS, ukuran = % dari `min(w, h × 1.25)` (preset terpisah untuk < 1000px, item 1.4–1.85×).
2. Wheel menambah `target`; tiap frame `cur` mengejar `target` lewat jalur wrap terpendek.
3. `i = floor(cur)`, `t = ease(frac(cur))`, posisi = lerp preset `i` → `i+1`.
4. Float idle ditambahkan **di atas** hasil interpolasi (proxy terpisah), jangan tween elemen langsung karena bentrok dengan tulisan per frame. Exit radial: vektor dari pusat viewport ke pusat item, dorong sampai lewat tepi + margin (`width × 0.71 + 12`).

```js
import { defineSection, followToLambda, ease, reducedMotion } from './motion-core.js';
export function layoutMorph(desk, LAYOUTS, { gain = 0.0008, follow = 0.07 } = {}) {
  const ORDER = Object.keys(LAYOUTS), K = ORDER.length, lam = followToLambda(follow);
  const items = [...desk.querySelectorAll('[data-item]')], wrap = (v) => ((v % K) + K) % K;
  let target = 0, cur = 0, W = 0, H = 0;
  const place = (p) => {
    const i = Math.floor(wrap(p)), t = ease.inOutQuint(wrap(p) - i);
    const A = LAYOUTS[ORDER[i]], B = LAYOUTS[ORDER[(i + 1) % K]];
    for (const el of items) {
      const a = A[el.dataset.item], b = B[el.dataset.item], m = (k) => a[k] + (b[k] - a[k]) * t;
      el.style.transform = `translate(${(m('x') * W) / 100}px, ${(m('y') * H) / 100}px) translate(-50%, -50%) rotate(${m('r')}deg)`;
    }
    desk.dataset.layout = ORDER[Math.round(wrap(p)) % K];                   // CSS ganti kata headline
  };
  const onWheel = (e) => { e.preventDefault(); target += e.deltaY * gain; };
  const onKey = (e) => {
    const s = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!s) return; e.preventDefault(); target = Math.round(target) + s;
    if (reducedMotion()) place((cur = target));                             // reduce: lompat tanpa animasi
  };
  return defineSection(desk, (ctx) => {
    if (!ctx.reduced) desk.addEventListener('wheel', onWheel, { passive: false });
    desk.addEventListener('keydown', onKey);
    W = desk.clientWidth; H = desk.clientHeight;
    return {
      onResize() { W = desk.clientWidth; H = desk.clientHeight; place(cur); },
      renderStatic: () => place(0),
      update(dt) {
        let d = wrap(target) - wrap(cur);
        if (d > K / 2) d -= K; else if (d < -K / 2) d += K;                  // wrap terpendek
        place((cur += d * (1 - Math.exp(-lam * dt))));
      },
    };
  });
}
```

**Reduced-motion & aksesibilitas:** Reduce → susunan pertama statis, panah keyboard langsung lompat ke susunan berikutnya tanpa animasi, float idle tidak dibuat (R08). Desk diberi `tabindex="0"`, `role="group"`, `aria-label` yang menjelaskan "gunakan panah untuk mengganti susunan". Objek dekoratif `alt=""`; headline tetap teks asli.

**Jebakan:**
- `preventDefault` pada wheel membajak scroll. R08 aman karena hero-nya tidak punya scroll native. Di halaman yang bisa di-scroll, ganti driver jadi `stickyProgress` section pinned (`target = p × (K − 1)`).
- Lerp per frame (0.07) tanpa dt jalan 2× lebih cepat di 120Hz. `followToLambda` + `exp(−λ·dt)` menormalkan ini.
- Item yang sedang dilempar (exit) harus dikecualikan dari loop, kalau tidak loop menimpa posisinya tiap frame.

### `svg-picker-lift` — Pilih item SVG, salinan terangkat

**Sumber:** R05 · **Mode:** A · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Kumpulan objek kecil yang digambar prosedural dalam satu SVG (gigi, kursi bioskop, pin peta, modul produk). Pilih satu → tempat asalnya jadi "socket", salinannya terangkat di layer atas dengan spring, panel detail di samping berganti.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `liftScale` / `liftOffset` | 1.3 / −2.6 unit | 1.15–1.4 | Salinan membesar dan bergeser keluar sepanjang normal lokal item. |
| `liftDur` / `liftEase` | 550ms / `cubic-bezier(.34,1.56,.64,1)` | 400–700ms | Spring dengan overshoot ±10%. Replay tiap ganti pilihan. |
| `entranceStagger` | 32ms × urutan visual | 20–50ms | Pop `scale(0)` → 1 menyapu kiri → kanan saat section 25% terlihat. Item default terangkat fade 300ms setelah stagger (delay 1.1s). |
| `socket` | fill gelap, opacity 0.42 | 0.3–0.5 | Bekas tempat item terpilih. |
| `hitPadding` | stroke transparan 1.6 unit | ≥ 44px di mobile | Area klik lebih lebar dari bentuk. |

**Resep:**
1. Struktur item: `<g class="pick" role="button" tabindex="-1" aria-pressed aria-label data-id>` → `<g data-pose transform="matrix(…)">` → `<g class="pop">` berisi `.shape` + `.hit`. Label teks di luar transform supaya tidak ikut berotasi. Layer `<g class="lifted" aria-hidden="true">` jadi elemen **terakhir** di SVG (paint di atas semua).
2. Pilih: kelas `.is-pick` (CSS mengubah shape jadi socket), clone grup `data-pose`, ganti kelas `.pop` → `.lift`, taruh di layer lifted. Node baru = keyframe otomatis replay.
3. Panel `aria-live="polite"` diisi dari `<template id="rec-{id}">`. Keyboard roving tabindex: hanya item terpilih `tabindex=0`, panah pindah dan langsung memilih, Enter/Space memilih.
4. Kedalaman (opsional R05): dua SVG filter "clay" (drop shadow + highlight + inner shadow); versi lifted bayangannya lebih jauh (blur 1.6, offset 1.8/3.2 vs 0.7/0.9).

```html
<style>
  .pick .hit { fill: #0000; stroke: #0000; stroke-width: 1.6px; }          /* transparan tapi tetap kena klik */
  .pick:hover .hit, .pick:focus-visible .hit { stroke: currentColor; stroke-opacity: .35; }
  .pick.is-pick .shape { fill: #6e1f2e; opacity: .42; }                    /* tempat asal jadi socket */
  .pop, .lift { transform-box: fill-box; transform-origin: 50% 50%; }
  .lifted { pointer-events: none; }  .lift { transform: translateY(-2.6px) scale(1.3); }
  @media (prefers-reduced-motion: no-preference) {
    .lift { animation: lift .55s cubic-bezier(.34,1.56,.64,1) both; }
    svg:not(.is-in) .pop { transform: scale(0); }
    svg.is-in .pop { animation: pop .55s cubic-bezier(.34,1.56,.64,1) both calc(var(--i) * 32ms); }
  }
  @keyframes lift { from { transform: none; } }  @keyframes pop { from { transform: scale(0); } }
</style>
<script type="module">
  const svg = document.querySelector('[data-picker]'), layer = svg.querySelector('.lifted');
  const items = [...svg.querySelectorAll('.pick')], panel = document.querySelector('[data-panel]');
  function select(item, focus = false) {
    items.forEach((it) => { const on = it === item; it.classList.toggle('is-pick', on); it.setAttribute('aria-pressed', on); it.tabIndex = on ? 0 : -1; });
    const clone = item.querySelector('[data-pose]').cloneNode(true);
    clone.querySelector('.pop').classList.replace('pop', 'lift');
    clone.querySelector('.hit')?.remove();
    layer.replaceChildren(clone);                                            // node baru → keyframe replay
    panel.innerHTML = document.getElementById('rec-' + item.dataset.id).innerHTML;
    if (focus) item.focus();
  }
  svg.addEventListener('click', (e) => { const it = e.target.closest('.pick'); if (it) select(it); });
  svg.addEventListener('keydown', (e) => {
    const i = items.indexOf(e.target), s = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (s) { e.preventDefault(); select(items[Math.max(0, Math.min(items.length - 1, i + s))], true); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e.target); }
  });
  new IntersectionObserver(([en], io) => { if (en.isIntersecting) { svg.classList.add('is-in'); io.disconnect(); } },
    { threshold: 0.25 }).observe(svg);
  select(items[0]);
</script>
```

**Reduced-motion & aksesibilitas:** Entrance pop dan keyframe lift hanya di `no-preference`; saat reduce item langsung tampil dan salinan langsung dalam posisi terangkat. SVG diberi `role="group"` + `aria-label` ("Gunakan panah untuk berpindah item"), tiap item `role="button"` + `aria-pressed` + label lengkap, layer lifted `aria-hidden`, panel `aria-live="polite"`.

**Jebakan:**
- Layer lifted tanpa `pointer-events: none` menutupi item tetangga (bug R05, salinan scale 1.3).
- Arrow key langsung memilih + panel `aria-live` = pembaca layar membacakan tiap langkah. Kalau panel panjang, pertimbangkan pilih hanya saat Enter.
- Target sentuh: item kecil (gigi depan bawah R05 ±20px di HP) di bawah 44px, dan ring fokus 0.7 unit sulit terlihat. Tebalkan stroke `.hit` di mobile dan saat `:focus-visible`.

### `page-zoom-intro` — Halaman mini zoom jadi penuh

**Sumber:** R14 · **Mode:** B · **Tingkat berat:** CSS

**Kapan dipakai:** Intro load pertama situs agensi/portfolio: tirai naik, huruf logo naik, bar nav muncul, lalu seluruh halaman yang tadinya tampil sebagai "thumbnail" kecil zoom jadi ukuran penuh.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `startScale` | 191 / 1400 ≈ 0.136 | 0.1–0.3 | Skala halaman awal (strip mini R14). |
| `total` | ±3.7s | 2.5–4s | Seluruh timeline R14. Rincian di bawah adalah usulan yang menjumlah ±3.5s. |
| `curtain` | scaleY 1 → 0, 0.8s `power3.inOut` | 0.6–1s | Tirai warna brand membuka. |
| `letters` / `navbar` | y 110% → 0 0.7s, stagger 50ms / scaleY 0 → 1 0.6s | — | Huruf logo naik dan bar nav tumbuh bersamaan, `power3.out`. |
| `zoom` | 1.4s `power2.inOut` | 1–1.6s | Halaman mini → ukuran penuh. |

**Resep:**
1. Inline script di `<head>` memberi `html.intro`; CSS state awal (tirai menutup, huruf di bawah mask, nav `scaleY(0)`, `.page` di-scale) hanya berlaku di `html.intro`. Tanpa JS, halaman tampil normal.
2. Kunci scroll (`overflow: hidden` / `lenis.stop()`), jalankan urutan, lalu buka kunci.
3. Di akhir: hapus transform `.page` dan panggil `ScrollTrigger.refresh()` (posisi trigger dihitung ulang setelah layout normal). Hanya di kunjungan pertama per sesi (`sessionStorage`), kunjungan berikutnya cukup reveal pendek.

```js
import { reducedMotion } from './motion-core.js';
import { tween, E, wait } from './tween.js';
// html.intro: .curtain menutup, .logo .sc di translateY(110%), .navbar scaleY(0), .page scale(startScale)
export async function pageZoomIntro({ curtain, letters, navbar, page, startScale = 191 / 1400, lenis } = {}) {
  const root = document.documentElement;
  const finish = () => {
    root.classList.remove('intro'); root.style.overflow = '';
    page.style.transform = ''; lenis?.start(); window.ScrollTrigger?.refresh();
  };
  if (reducedMotion()) return finish();
  lenis?.stop(); root.style.overflow = 'hidden';
  page.style.transformOrigin = '50% 50vh';
  page.style.transform = `scale(${startScale})`;
  await tween(0.8, (k) => (curtain.style.transform = `scaleY(${1 - k})`), E.inOutQuart);
  await Promise.all([
    ...letters.map((l, i) => wait(i * 0.05).then(() =>
      tween(0.7, (k) => (l.style.transform = `translateY(${(1 - k) * 110}%)`), E.outQuart))),
    tween(0.6, (k) => (navbar.style.transform = `scaleY(${k})`), E.outQuart),
  ]);
  await wait(0.2);
  await tween(1.4, (k) => (page.style.transform = `scale(${startScale + (1 - startScale) * k})`), E.inOutCubic);
  finish();
}
```

**Reduced-motion & aksesibilitas:** Reduce → langsung state akhir, scroll tidak dikunci. Logo tetap teks/`aria-label` asli. Jangan kunci scroll lebih dari ±4s total; beri tombol/klik untuk skip kalau intro lebih panjang.

**Jebakan:**
- `transform` di `.page` membuat elemen `position: fixed` di dalamnya ikut ter-scale dan menempel ke `.page`, bukan viewport. Taruh header fixed di luar `.page`.
- Lupa `ScrollTrigger.refresh()` → semua trigger di bawah meleset sebesar perbedaan layout saat scale.
- Gambar besar di dalam halaman mini tetap di-decode penuh. Itu memang perlu (halaman langsung tampil), tapi beri `fetchpriority` hanya ke gambar di first viewport.

### `circle-wipe` — Lingkaran membesar menutup layar

**Sumber:** R14, R12 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Transisi warna antar section yang "lahir" dari sebuah elemen (bola jam R14), reveal CTA dari titik klik (R12), atau menu fullscreen yang turun sebagai elips dari atas (R12).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `origin` | pusat elemen asal | — | Lingkaran mulai seukuran elemen asal, lalu membesar. |
| `radiusEnd` | jarak ke sudut terjauh | — | Menutup layar penuh dari titik mana pun. `circle(75%)` cukup hanya kalau origin di tengah. |
| `scrollRange` | 0.55–0.9 progress section | — | Varian scroll (R14: bola bergeser dari ring ke tengah layar lalu membesar). Usulan range. |
| `clickDur` | 1.15s expo-out | 0.8–1.2s | Varian klik (R12 CTA `circle(0%)` → `circle(75%)`). |
| `menuEllipse` | `ellipse(75% 0% at 50% -5%)` → `ellipse(105% 145% at 50% -5%)` | — | Varian menu fullscreen R12, link stagger `yPercent` sesudahnya. |

**Resep:**
1. Layer target (section warna berikut / menu / gambar CTA) absolut di atas konten, `clip-path` dihitung JS.
2. Pusat = tengah elemen asal relatif ke layer. Radius akhir = `hypot(max(x, W − x), max(y, H − y))`.
3. Scroll: radius = `lerp(r0, rEnd, range(p, a, b))`. Klik: tween 1.15s expo-out, tutup dengan ease-in yang lebih cepat. Setelah tertutup penuh, ganti `clip-path` ke `none` (atau tukar warna section) supaya tidak ada biaya clip permanen.

```js
import { defineSection, range, stickyProgress, reducedMotion } from './motion-core.js';
import { tween, E } from './tween.js';
const coverR = (x, y, w, h) => Math.hypot(Math.max(x, w - x), Math.max(y, h - y));

export function circleClip(layer, origin, k) {
  const L = layer.getBoundingClientRect(), o = origin.getBoundingClientRect();
  const x = o.left + o.width / 2 - L.left, y = o.top + o.height / 2 - L.top;
  const r0 = Math.min(o.width, o.height) / 2;                    // mulai seukuran elemen asal
  const r = r0 + (coverR(x, y, L.width, L.height) - r0) * k;
  layer.style.clipPath = k >= 1 ? 'none' : `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
}

// A. Scroll (R14): bola tumbuh sampai menutup section
export const scrollWipe = (section, layer, origin, [a, b] = [0.55, 0.9]) =>
  defineSection(section, () => ({
    renderStatic: () => (layer.style.clipPath = 'none'),
    update: () => circleClip(layer, origin, range(stickyProgress(section), a, b)),
  }));

// B. Klik (R12 CTA / menu): buka 1.15s expo-out, tutup lebih cepat
export function clickWipe(layer, origin, open = true) {
  if (reducedMotion()) {
    layer.style.clipPath = open ? 'none' : 'circle(0 at 50% 50%)';
    return layer.animate({ opacity: [0, 1] }, { duration: 200 }).finished;
  }
  return tween(open ? 1.15 : 0.6, (k) => circleClip(layer, origin, open ? k : 1 - k), open ? E.outExpo : E.inCubic);
}
```

**Reduced-motion & aksesibilitas:** Reduce → layer langsung terbuka (scroll) atau fade 0.2s (klik). Menu fullscreen: tombol toggle `aria-expanded`, fokus masuk ke link pertama saat terbuka, Esc menutup, konten di belakang `inert`.

**Jebakan:**
- `circle(75%)` dari origin di pojok tidak menutup layar. Selalu hitung radius ke sudut terjauh dalam px.
- Origin ikut scroll, jadi rect-nya memang harus dibaca tiap frame di varian scroll (jangan di-cache).
- `clip-path` juga memotong hit-testing, tapi layer yang ter-clip ke 0 tetap ada di accessibility tree. Beri `inert` saat tertutup.

### `clip-path-shape-morph` — Morph bentuk lewat polygon

**Sumber:** R14, R12 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Bingkai gambar yang berganti bentuk (lingkaran → segitiga → kotak) saat state berubah (R14 gauge format), atau loader yang membuka halaman lewat bentuk logo (R12 pohon kelapa).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `points` | 72 | 48–96 | Semua shape di-resample ke jumlah titik sama supaya bisa diinterpolasi titik ke titik (R14). |
| `dur` | 0.55s | 0.4–0.8s | Tween saat indeks shape berubah (R14). |
| `ease` | `power2.inOut` (`E.inOutCubic`) | — | — |
| `start` | titik paling atas, searah jarum jam | — | Semua shape harus mulai dari titik dan arah yang sama, kalau tidak morph-nya terpelintir. |
| Loader R12 | `clip-path: url(#logo-clip)`, panel `xPercent −170` + rotate ±5° | — | Counter → bentuk logo membesar membuka halaman → panel tersapu. Gate event `loaderComplete`. |

**Resep:**
1. Definisikan tiap shape sebagai polygon (% kotak elemen), searah jarum jam, mulai dari titik teratas. `resample()` ke N titik berjarak sama sepanjang keliling. Lingkaran dibangkitkan langsung N titik.
2. Tween dari bentuk **yang sedang tampil** (bukan target sebelumnya), supaya klik cepat tidak melompat.
3. Loader (R12): SVG `<clipPath>` berbentuk logo di-scale dari 0 sampai menutupi viewport, lalu panel loader digeser `xPercent −170` sambil rotate ±5°. Pancarkan event global `loaderComplete` yang ditunggu semua animasi lain. Fallback timeout R12 25s terlalu lama: pakai ≤ 8s.

```js
import { reducedMotion } from './motion-core.js';
import { tween, E } from './tween.js';
const N = 72;
/** Polygon [[x,y],…] dalam %, searah jarum jam, mulai titik teratas → N titik berjarak sama. */
export function resample(poly, n = N) {
  const segs = poly.map((p, i) => { const q = poly[(i + 1) % poly.length]; return [p, q, Math.hypot(q[0] - p[0], q[1] - p[1])]; });
  const total = segs.reduce((s, g) => s + g[2], 0), out = [];
  for (let k = 0, si = 0, acc = 0; k < n; k++) {
    const d = (k / n) * total;
    while (acc + segs[si][2] < d) acc += segs[si++][2];
    const [p, q, len] = segs[si], t = len ? (d - acc) / len : 0;
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}
export const circle = (n = N) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;                 // mulai di atas, searah jarum jam
  return [50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)];
});
const css = (pts) => `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;

export function morphTo(el, target, { dur = 0.55 } = {}) {
  const from = el._pts || target, tok = (el._tok = (el._tok || 0) + 1);
  const paint = (k) => {
    if (tok !== el._tok) return;                                   // tween lama yang tersusul berhenti menulis
    el._pts = from.map((p, i) => [p[0] + (target[i][0] - p[0]) * k, p[1] + (target[i][1] - p[1]) * k]);
    el.style.clipPath = css(el._pts);
  };
  return reducedMotion() ? paint(1) : tween(dur, paint, E.inOutCubic);
}
// morphTo(frame, circle());  morphTo(frame, resample([[50, 0], [100, 100], [0, 100]]));
```

**Reduced-motion & aksesibilitas:** Reduce → bentuk langsung berganti. Bentuk bingkai dekoratif; kalau bentuk membawa makna (indikator format), sertakan label teks yang ikut berganti. Loader: `role="status"` dengan teks persen, dan halaman tidak boleh tergantung loader selesai untuk bisa dibaca.

**Jebakan:**
- Titik awal / arah berbeda antar shape → morph terpelintir dan menyilang. Normalisasi semua shape ke "mulai di atas, searah jarum jam".
- Sudut tajam hilang kalau titik resample tidak jatuh tepat di sudut. Naikkan N atau sisipkan sudut sebagai titik wajib.
- `clip-path` string 72 titik ditulis per frame cukup ringan, tapi jangan morph puluhan elemen sekaligus.

### `print-curl-transition` — Section jadi lembar foto melengkung

**Sumber:** R11 · **Mode:** A+B · **Tingkat berat:** WebGL

**Kapan dipakai:** Transisi keluar dari hero yang "dipotret": notch wheel pertama mengubah hero jadi selembar print berbingkai krem, lalu scroll membuat lembar itu mengecil, naik, dan melengkung sesuai kecepatan scroll sebelum terbang keluar.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `trigger` | Σ deltaY > 12px dalam 250ms | 8–20px | Notch pertama jadi "shutter", bukan scrub. Settle gestur 130ms (cosine). |
| `formSec` | 0.85s | 0.6–1s | Hero → print berbingkai. |
| `wheelGain` | 0.0008 per px | — | ±1250px deltaY untuk progress 0 → 1. Progress dikejar `1 − e^(−5·dt)`. |
| `endScale` | 0.34 | 0.25–0.5 | Skala akhir lembar. |
| `rise` | 0.82 tinggi view | 0.6–1 | Naik ke atas. |
| `pitch` | 0.2 | 0.1–0.3 | Kemiringan (asumsi radian). Plus flutter `0.16 × sin(phase)`. |
| `curl` | `0.1 + |v| × 0.95`, maks 1.15 | — | Lengkung = low-pass kecepatan (λ 13/s). `v` = progress per detik (satuan asli tidak tercatat). |

**Resep:**
1. Render hero ke texture (screenshot DOM tidak bisa langsung; buat hero di WebGL, atau pakai gambar/video hero sebagai texture) dan tampilkan di `PlaneGeometry(w, h, 1, 64)` (segmen di sumbu Y untuk lengkung halus).
2. Vertex shader membungkus koordinat Y ke busur lingkaran dengan panjang busur terjaga: lembar memendek saat melengkung, seperti kertas sungguhan.
3. Per frame: curl target dari kecepatan, di-`damp` λ 13; scale/posisi/rotasi dari progress chapter. Bingkai krem: border di texture atau mesh kedua sedikit lebih besar di belakang.
4. Fallback tanpa WebGL: `transform: perspective(900px) rotateX(P × 20deg) scale(...)` + `box-shadow` (tanpa lengkung sungguhan, tapi arah gerak sama).

```js
import * as THREE from 'three';
import { clamp, damp } from './motion-core.js';

export const curlMaterial = (map, h) => new THREE.ShaderMaterial({
  uniforms: { uMap: { value: map }, uCurl: { value: 0.1 }, uH: { value: h } },
  vertexShader: /* glsl */ `
    uniform float uCurl, uH; varying vec2 vUv;
    void main() {
      vUv = uv; vec3 p = position;
      float s = uH * 0.5 - p.y;                  // panjang busur dari tepi atas (tepi atas dikunci)
      float k = uCurl / uH;                      // kelengkungan 1/R
      if (abs(k) > 1e-4) {
        float R = 1.0 / k;
        p.y = uH * 0.5 - R * sin(s / R);         // panjang busur terjaga → lembar memendek
        p.z = R * (1.0 - cos(s / R));
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `uniform sampler2D uMap; varying vec2 vUv;
    void main() { gl_FragColor = texture2D(uMap, vUv); }`,
  side: THREE.DoubleSide,
});

/** P = progress chapter 0..1, v = |dP/dt|. viewH = tinggi frustum di jarak lembar. */
export function updateSheet(mesh, P, v, dt, { endScale = 0.34, rise = 0.82, pitch = 0.2, viewH = 2 } = {}) {
  const u = mesh.material.uniforms;
  u.uCurl.value = damp(u.uCurl.value, clamp(0.1 + v * 0.95, 0, 1.15), 13, dt);
  mesh.scale.setScalar(1 + (endScale - 1) * P);
  mesh.position.y = rise * viewH * P;
  mesh.rotation.x = -pitch * P;
}
```

**Reduced-motion & aksesibilitas:** Reduce → tanpa curl dan tanpa flutter; hero langsung crossfade ke section berikut (R11 tetap menjalankan scrub chapter, tapi entrance kamera dan efek pendukung dimatikan). Canvas `aria-hidden`; konten hero (judul, CTA) tetap DOM di atas canvas.

**Jebakan:**
- Notch-as-trigger: trackpad mengirim deltaY kecil beruntun, mouse wheel mengirim 100 per notch. Akumulasi dalam jendela 250ms, dan abaikan `ctrlKey` (pinch-zoom trackpad).
- Kecepatan dari wheel mentah sangat "berduri": low-pass (λ 13) wajib, kalau tidak kertas bergetar. Segmen < 32 terlihat patah saat melengkung kuat.
- Teks kecil di texture jadi blur saat lembar mengecil ke 0.34. Gunakan mipmap + anisotropy.

### `theme-token-switch` — Ganti tema lewat token

**Sumber:** R01, R17, R12 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Ganti varian produk/persona yang mengubah warna seluruh halaman (R01 flavor, R17 tipe pod), atau nav yang berganti gelap/terang saat melewati section gelap (R12, R03).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `tokens` | `--bg`, `--surface`, `--ink`, `--accent` | 3–6 | Semua warna UI membaca token ini, termasuk logo (`mask-image` + `background: var(--ink)`). |
| `tweenDur` | 1.2s `power2.inOut` | 0.6–1.4s | `cubic-bezier(.645,.045,.355,1)`. R01, bersamaan dengan spin + copy swap. |
| `overlay` (R17) | opacity → 1, tahan 200ms, swap, pulse 100ms, → 0 | 150–300ms | Varian "tutup-ganti-buka" untuk swap konten besar (gradient, slider, section). |
| `navBand` | rootMargin `-6% 0px -93% 0px` | — | Pita tipis setinggi nav (R03). Section bertanda `data-nav-dark` membalik warna nav. |
| `navDur` | 0.3s | 0.2–0.4s | Transisi warna nav. |

**Resep:**
1. Daftarkan token sebagai `@property` bertipe `<color>` supaya CSS bisa menginterpolasi custom property. Transisi di `:root`.
2. `setTheme(name)` hanya mengganti nilai token. Picu bersamaan dengan transisi lain (spin, `copy-swap`) supaya satu koreografi.
3. Varian overlay (R17): overlay full-screen opacity 1 → tunggu 200ms → tukar atribut `data-persona` + gradient → pulse opacity section 100ms → overlay 0. Kalau ada animasi scroll yang perlu dibangunkan, panggil refresh (R17 menggeser scroll 1px untuk Webflow IX2).
4. Nav: IntersectionObserver dengan pita sempit di posisi nav, toggle kelas `.is-dark`.

```html
<style>
  @property --bg { syntax: '<color>'; inherits: true; initial-value: #f4efe6; }
  @property --ink { syntax: '<color>'; inherits: true; initial-value: #1d1a16; }
  @property --accent { syntax: '<color>'; inherits: true; initial-value: #d2691e; }
  :root { transition: --bg 1.2s, --ink 1.2s, --accent 1.2s; transition-timing-function: cubic-bezier(.645,.045,.355,1); }
  body { background: var(--bg); color: var(--ink); }
  .logo { background: var(--ink); mask: url(logo.svg) center / contain no-repeat; }
  .nav { color: var(--ink); transition: color .3s; }
  .nav.is-dark { color: #fff; }
  @media (prefers-reduced-motion: reduce) { :root { transition: none; } }
</style>
<script type="module">
  const THEMES = {
    honey: { bg: '#f4efe6', ink: '#1d1a16', accent: '#d2691e' },
    matcha: { bg: '#e3ecd9', ink: '#17251a', accent: '#5f8b3a' },
  };
  function setTheme(name, root = document.documentElement) {
    for (const [k, v] of Object.entries(THEMES[name])) root.style.setProperty('--' + k, v);
    root.dataset.theme = name;
  }
  document.querySelectorAll('[data-theme-btn]').forEach((b) =>
    b.addEventListener('click', () => setTheme(b.dataset.themeBtn)));

  const nav = document.querySelector('.nav');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) nav.classList.toggle('is-dark', e.target.hasAttribute('data-nav-dark'));
  }), { rootMargin: '-6% 0px -93% 0px' });
  document.querySelectorAll('main > section').forEach((s) => io.observe(s));
</script>
```

**Reduced-motion & aksesibilitas:** Reduce → token langsung berganti (`transition: none`); varian overlay cukup crossfade 150ms. Periksa kontras **setiap** tema (teks `--ink` di `--bg`, tombol `--accent`), bukan cuma tema default. Tombol tema berupa `<button aria-pressed>`; kalau persona mengubah konten, umumkan lewat `aria-live="polite"` singkat ("Menampilkan: Home").

**Jebakan:**
- Transisi token di `:root` memicu restyle seluruh dokumen tiap frame selama 1.2s. Hindari bersamaan dengan efek berat lain (blur besar, canvas penuh).
- Tanpa `@property`, custom property tidak diinterpolasi, warna loncat di akhir durasi. Browser lama: fallback loncat (dapat diterima) atau tween manual lewat JS.
- Warna hardcode (SVG fill, PNG logo) tidak ikut berubah: logo pakai mask + `var(--ink)` seperti R01. Pita nav 1–6% tinggi viewport; section lebih pendek dari pita tidak terdeteksi.

### `blinds-reveal` — Reveal tirai jendela

**Sumber:** R17 · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** Membuka blok testimoni/review/gambar dengan strip horizontal yang melebar bergantian seperti venetian blinds, di-scrub scroll.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `strips` | 17 | 8–24 | Jumlah strip (R17). |
| `spread` | 0.67 | 0.4–0.8 | Bagian progress tempat awal strip disebar. 0.67 ≈ GSAP durasi 0.5 + `stagger amount: 1`, `ease: none` (R17). |
| `origin` | tengah strip | atas · tengah | Strip tumbuh dari tengah (simetris) atau dari atas. |
| `range` | passProgress 0.1–0.45 | — | Usulan; jendela asli R17 dikendalikan trigger Webflow yang tidak terbaca angkanya. |

**Resep:**
1. SVG tersembunyi berisi `<clipPath id="blinds" clipPathUnits="objectBoundingBox">`; target diberi `clip-path: url(#blinds)`.
2. Bangkitkan N `<rect>` lewat JS. Tiap strip punya jendela `[i/(N−1) × spread, … + (1 − spread)]`.
3. Tinggi strip = `k / N`, `y` digeser supaya tumbuh dari tengah strip. Saat progress ≥ 1 lepas `clip-path` (hairline antar strip hilang, biaya clip hilang).

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <clipPath id="blinds" clipPathUnits="objectBoundingBox"></clipPath>
</svg>
<script type="module">
  import { defineSection, clamp, range, passProgress } from './motion-core.js';
  const target = document.querySelector('[data-blinds]');
  const cp = document.getElementById('blinds'), N = 17, spread = 0.67;
  const rects = Array.from({ length: N }, () =>
    cp.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect')));
  rects.forEach((r) => { r.setAttribute('x', 0); r.setAttribute('width', 1); });
  const paint = (p) => {
    target.style.clipPath = p >= 1 ? 'none' : 'url(#blinds)';
    rects.forEach((r, i) => {
      const k = clamp((p - (i / (N - 1)) * spread) / (1 - spread));
      const h = k / N + (k > 0 ? 0.002 : 0);                        // overlap tipis: tanpa hairline
      r.setAttribute('y', (i / N + (1 / N - h) / 2).toFixed(5));
      r.setAttribute('height', h.toFixed(5));
    });
  };
  defineSection(target, () => ({
    renderStatic: () => paint(1),
    update: () => paint(range(passProgress(target), 0.1, 0.45)),
  }));
</script>
```

**Reduced-motion & aksesibilitas:** Reduce → konten langsung terbuka penuh. Konten yang ter-clip tetap ada di DOM dan dibaca pembaca layar sejak awal, jadi tidak ada informasi yang "terkunci" di balik animasi.

**Jebakan:**
- Garis tipis (hairline) antar strip saat semua strip penuh, akibat anti-aliasing. Overlap 0.002 + lepas clip di p = 1.
- `clipPathUnits="objectBoundingBox"` memakai kotak elemen target; padding/border ikut. Pasang clip di elemen yang ukurannya = area visual.
- Satu `<clipPath id>` hanya untuk satu target. Untuk beberapa blok, bangkitkan id unik per blok.

### `staggered-content-switcher` — Tab dengan wipe bertahap

**Sumber:** R15 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Tab solusi/kapabilitas dengan konten kaya (paragraf, baris statistik, meter, video). Saat tab berganti, tiap bagian masuk dengan cara berbeda tapi satu ritme.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `underline` | spring stiffness 400, damping 35 | 300–500 / 30–40 | Garis bawah tab meluncur ke tab aktif (`createSpring`). |
| `sweep` | 3 warna `#c7cccb` → `#EAECED` → `#24363f`, jendela 8 huruf | jendela 6–12 | Teks disapu warna per huruf. Durasi `clamp(len/60, 0.6, 1.8)` s, expo-out `(.22,1,.36,1)`. |
| `rowWipe` | 0.55s, stagger 0.08s | 0.4–0.7s | Baris stat `inset(0 100% 0 0)` → `inset(0)`. R15: label dan nilai bergantian (`2r × 0.08`, `(2r+1) × 0.08`). |
| `meter` | lebar 0 → nilai, 0.55s | — | Bar meter mengisi bersamaan dengan barisnya. |
| `mediaWipe` | 0.9s `(.76,0,.24,1)` + scale 1.15 → 1 dalam 1.1s | — | Video/gambar baru di-wipe kiri → kanan. |
| `listFocus` | aktif 1, lain `max(1 − 0.1·|offset|, 0.72)`, 500ms | — | Varian list Capabilities R15: item non-aktif mengecil dan memudar. |

**Resep:**
1. Markup tab ARIA: `role="tablist"` / `tab` (`aria-selected`, `aria-controls`) / `tabpanel`. Panah kiri/kanan memindah tab, Home/End ke ujung.
2. Underline: dua `createSpring({ stiffness: 400, damping: 35 })` untuk `x` dan `width`, target = rect tab aktif, `step(dt)` di ticker sampai `isSettled()`.
3. Konten di-render ulang per tab, lalu `showPanel()` menjalankan semua animasi masuk.
4. Preload semua video tab sebelum section terlihat (R15: saat section ≤ 600px dari viewport, desktop saja). Nilai statistik boleh di-scramble singkat (`len / 20` s) saat muncul, matikan di mobile dan reduce.

```js
import { ticker, clamp, reducedMotion } from './motion-core.js';
import { bezier } from './tween.js';
const OUT = 'cubic-bezier(.22,1,.36,1)', INOUT = 'cubic-bezier(.76,0,.24,1)', expoOut = bezier(0.22, 1, 0.36, 1);
const BASE = [199, 204, 203], HI = [234, 236, 237], FINAL = [36, 54, 63];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Sapuan warna per huruf: kepala sapuan maju, `win` huruf di belakangnya sedang berubah. */
export function colorSweep(chars, { win = 8 } = {}) {
  const dur = clamp(chars.length / 60, 0.6, 1.8);
  let t = 0;
  const off = ticker.add((dt) => {
    t = Math.min(1, t + dt / dur);
    const head = expoOut(t) * (chars.length + win);
    chars.forEach((c, i) => {
      const k = clamp((head - i) / win);
      c.style.color = `rgb(${k < 0.5 ? mix(BASE, HI, k * 2) : mix(HI, FINAL, k * 2 - 1)})`;
    });
    if (t === 1) off();
  });
}

export function showPanel(panel) {
  if (reducedMotion()) return panel.animate({ opacity: [0, 1] }, { duration: 150 });
  const wipe = { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] };
  panel.querySelectorAll('[data-row]').forEach((row, r) =>
    row.animate(wipe, { duration: 550, delay: r * 80, easing: OUT, fill: 'backwards' }));
  const media = panel.querySelector('[data-media]');
  media?.animate(wipe, { duration: 900, easing: INOUT, fill: 'backwards' });
  media?.firstElementChild?.animate({ scale: [1.15, 1] }, { duration: 1100, easing: INOUT });
  colorSweep(panel.querySelectorAll('[data-sweep] .sc'));       // huruf dari splitText (typography.md)
}
```

**Reduced-motion & aksesibilitas:** Reduce → panel crossfade 150ms, tanpa wipe, sapuan, dan scramble; teks langsung warna final. Teks yang disapu tetap teks asli (split pakai helper `typography.md` dengan `.sr-only`). Tab mengikuti pola ARIA tabs penuh (roving tabindex, `aria-selected`). Jangan beri `aria-live` di panel tab: perpindahan fokus ke tab sudah cukup.

**Jebakan:**
- Paragraf 300+ huruf × tulis `color` per frame selama 1.8s masih aman, tapi jangan sapu beberapa paragraf panjang bersamaan.
- `fill: 'backwards'` wajib untuk baris yang punya delay, kalau tidak baris tampil penuh lalu tiba-tiba ter-clip saat delay habis.
- Klik tab cepat beruntun memulai sapuan baru di atas yang lama: simpan `off` sapuan terakhir dan panggil sebelum mulai lagi. R15 (React) memicu ulang lewat remount `key`; di vanilla panggil `showPanel` eksplisit tiap ganti tab.
