# Pola Scroll-Driven

Bab ini berisi semua pola yang digerakkan scroll dari bedah R02–R17: section yang di-pin, sekuens gambar/video/3D yang di-scrub, transisi antar section, teks yang menyala, sampai engine scroll virtual. Semua resep ditulis di atas `assets/starter/motion-core.js` (vanilla ES module). GSAP ScrollTrigger hanya dipakai kalau memang lebih tepat, dan alasannya ditulis di pola itu. Mulai selalu dari pola paling ringan yang hasilnya sama, baru naik ke Canvas/Video/WebGL kalau memang perlu.

## Daftar isi

| id | ringkas |
|---|---|
| `pinned-range-timeline` | Section tinggi + stage sticky, satu tabel range `[a,b]` menggerakkan semua elemen, progress dibagikan ke banyak konsumen |
| `scroll-image-sequence` | Render offline jadi frame, di-scrub scroll di canvas dengan cache bitmap LRU |
| `scroll-video-scrub` | `<video>` all-intra yang `currentTime`-nya mengikuti scroll |
| `scroll-3d-story` | Canvas 3D fixed/sticky di belakang konten, pose dikoreografi scroll lintas chapter |
| `scroll-segment-sequencer` | Scroll memilih segmen, segmen memicu animasi berbasis waktu (dengan hysteresis / scroll lock) |
| `hero-recede-expand` | Hero mengecil + gelap saat ditutup section berikut, atau cover melebar dari inset ke full-bleed |
| `clip-curtain-reveal` | Reveal pakai `clip-path`/mask: tirai bergelombang, blinds, portal radial |
| `scroll-text-reveal` | Kata menyala satu per satu, baris terisi warna, baris blur-in lalu keluar fokus |
| `pinned-horizontal-strip` | Scroll vertikal menggeser track horizontal di stage sticky |
| `sticky-card-stack` | Kartu sticky bertumpuk, kartu lama mundur (scale/rotasi/gelap) saat kartu baru naik |
| `sticky-step-story` | Visual sticky di satu kolom, daftar step di kolom lain, visual ganti state per step |
| `scroll-paced-cards` | Kartu melintas stage sticky dengan pacing tetap dan lintasan busur |
| `velocity-marquee` | Marquee jalan terus, makin cepat saat discroll |
| `speed-shaped-gallery` | Galeri yang bentuknya dipengaruhi kecepatan: tunnel kedalaman palsu, list melengkung, reel meregang |
| `chapter-scroll-engine` | Tanpa scroll native: wheel/touch/keyboard jadi progress virtual yang mengalir antar chapter |
| `hero-collapse-to-slot` | Hero larut ke tengah lalu "dipadatkan" jadi objek kecil yang terbang ke slot di judul |

**Aturan main bersama** (berlaku di semua pola, supaya tidak diulang di tiap bagian):
- Pilih **satu** sumber smoothing. Kalau Lenis aktif (`setupSmoothScroll`), progress dipakai mentah. Kalau tidak, pakai `damp()`. Dua-duanya sekaligus bikin gerakan terasa telat dan "karet".
- Jangan pernah `x += (t - x) * 0.1` per frame. Ubah angka referensi pakai `followToLambda(0.1)` lalu `damp(x, t, lambda, dt)`. Lerp per frame jalan 2× lebih cepat di layar 120 Hz (ketemu di R04, R06).
- Stage sticky pakai `height: 100svh`, dan body pakai `overflow-x: clip`, bukan `hidden` (`hidden` mematikan `position: sticky`).
- `motion-core.range()` itu **linear**. `range` di R03 = smoothstep. Kalau mau rasa R03, bungkus: `smoothstep(range(p, a, b))`.
- Reduced-motion: Lenis mati (sudah di `setupSmoothScroll`), efek berbasis waktu (wobble, shake, drift, tilt) mati. Scrub yang posisinya dipegang user boleh tetap jalan, kecuali gerakannya besar (zoom/putaran 3D penuh). Yang itu diganti state statis.

### `pinned-range-timeline` — Section sticky dengan tabel range
**Sumber:** R02 (`R02-bloom-burr.md`), R03 (`R03-the-varnish.md`), R12 (`R12-palmo.md`), R17 (`R17-quiet-cubes.md`, opacity-as-progress bus) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Fondasi hampir semua section scroll-story. Satu section tinggi, isinya di-pin, dan tiap elemen bergerak di "jendela" progress-nya sendiri. Pakai ini dulu sebelum mempertimbangkan library.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `heightVh` | 440 | 300–620 | Panjang scrub. Kira-kira 100vh per "beat" + 100vh stage. R02 Grind 440, Pour 460, Sip 300; R03 hero 620 |
| `windows[]` | `{v, from, to, a, b, e}` | lebar jendela 0.03–0.4 | Tiap entri menulis satu CSS var. R03 judul fade `.06–.19`, R02 caption `.035` |
| `lambda` | 0 (Lenis yang menghaluskan) | 8–20 | Smoothing progress kalau tidak pakai Lenis |
| Lenis `lerp` | 0.08 | 0.07–0.1 | R02 `.08` + `wheelMultiplier .9`, R03 `.075`, R12 `.075` |
| `staticAt` | 1 | 0–1 | Progress yang ditampilkan saat reduced-motion. Pilih titik di mana semua teks terbaca, bukan otomatis 1 |

**Resep:**
1. Markup: `<section class="scene" style="height:440vh"><div class="stage">…</div></section>`, `.stage { position: sticky; top: 0; height: 100svh; overflow: hidden }`. Untuk canvas yang dipakai bersama banyak scene (R02), taruh satu `<canvas>` `position: fixed` di antara layer `.stage.back` dan `.stage.front` (`margin-top: -100svh`).
2. Tulis semua gerakan sebagai tabel range. JS hanya menulis CSS var di section, CSS yang memakainya: `.title { opacity: var(--title-o); translate: 0 calc(var(--title-y) * 100vh) }`. Tabel yang sama dipakai DOM, canvas, dan caption, jadi semuanya sinkron (R03 berbagi konstanta `turns: [[.12,.24],[.32,.44],…]` ke scene buku). Ukur posisi section di `onResize`, lalu hitung progress dari `scrollY` (cara R02). Tidak ada `getBoundingClientRect()` per frame, jadi tidak ada layout thrash walaupun ada banyak section.
3. Untuk besaran "cerita" (detik, gram, persen), pakai keyframe piecewise `pw()`: p → waktu cerita → nilai fisik (R02: `tS = pw([[.3,0],[.36,10],…,[.84,210]], p)`, lalu gram dari `tS`).
4. **Progress bus:** progress yang sama dibagikan ke banyak konsumen. `--p` untuk CSS, `tl.progress(p)` untuk timeline GSAP yang `paused` berdurasi 1 (caption R02, blinds R17), counter `Math.min(99, floor(p*100))` (eco counter R17), `audio.volume = p` (R17). Untuk 3D di React, tulis ke objek mutable lalu baca di `useFrame` (R03), jangan lewat state. Untuk HUD yang harus sinkron dengan animasi berbasis waktu, kirim `CustomEvent` berisi sisa durasi (`budget`, R12).
```js
import { defineSection, clamp, range, smoothstep, ease, damp } from './motion-core.js';

export const pw = (K, x) => {                       // keyframe piecewise linear [[x,y],…]
  if (x <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (x <= K[i][0]) {
    const [ax, ay] = K[i - 1], [bx, by] = K[i];
    return ay + (by - ay) * (x - ax) / (bx - ax);
  }
  return K[K.length - 1][1];
};
export const DEMO = [
  { v: '--title-o', from: 1, to: 0, a: 0.06, b: 0.19, e: smoothstep },        // R03
  { v: '--title-y', from: 0, to: -0.7, a: 0, b: 0.2, e: ease.linear },        // × 100vh di CSS
  { v: '--cap-o', from: 0, to: 1, a: 0.13, b: 0.165, e: ease.outCubic },      // R02 caption .late
];

export function pinnedTimeline(el, windows = DEMO, { lambda = 0, staticAt = 1, onProgress } = {}) {
  return defineSection(el, () => {
    let top = 0, len = 1, p = -1, last = -1;
    const measure = () => { top = el.getBoundingClientRect().top + scrollY; len = Math.max(1, el.offsetHeight - innerHeight); };
    const apply = (q) => {
      if (Math.abs(q - last) < 1e-4) return; last = q;
      el.style.setProperty('--p', q.toFixed(4));
      for (const w of windows) el.style.setProperty(w.v, (w.from + (w.to - w.from) * w.e(range(q, w.a, w.b))).toFixed(4));
      onProgress?.(q);                              // bus: counter, timeline GSAP, volume, event
    };
    measure();
    return {
      onResize: measure,
      update(dt) { const raw = clamp((scrollY - top) / len); p = lambda && p >= 0 ? damp(p, raw, lambda, dt) : raw; apply(p); },
      renderStatic: () => apply(staticAt),
    };
  });
}
```
**Reduced-motion & mobile:** `renderStatic` menulis state `staticAt`, lalu CSS `@media (prefers-reduced-motion: reduce) { .scene { height: auto } .stage { position: relative } }` supaya tidak ada fase scroll kosong (cara R09). Di mobile, turunkan `heightVh` sekitar 30% (R10 mobile malah memanjangkan hold supaya teks sempat dibaca), dan siapkan preset layout `d`/`m` per scene seperti R02.\
**Jebakan:**
- R03 memanggil `getBoundingClientRect()` di banyak section per frame dan harus memakai scheduler read/write agar tidak thrash. Ukur sekali di resize (R02) lebih sederhana. Ingat panggil `measure()` lagi setelah font dan gambar di atas section selesai load.
- Halaman R03 jadi 620 + 620 + 440vh: scroll fatigue di HP. Beat yang tidak membawa informasi baru sebaiknya dipotong.
- Semua efek pakai `range()` mentah = gerakan terasa robotik. Minimal pakai `ease.inOutCubic` untuk gerakan objek dan smoothstep untuk fade.

### `scroll-image-sequence` — Sekuens frame yang di-scrub
**Sumber:** R02 (`R02-bloom-burr.md`, hero walk-through 5 ruangan), R17 (`R17-quiet-cubes.md`, pod render) · **Mode:** A+B · **Tingkat berat:** Canvas2D/SVG\
**Kapan dipakai:** Butuh rasa "3D/sinematik" (walk-through ruangan, produk berputar/terurai) tanpa WebGL. Render atau video di-export jadi frame, lalu scroll memilih frame. Lebih ringan dan lebih bisa ditebak daripada scene 3D live.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `count` | 406 (R02) | 35–400 | Jumlah frame. R17 cuma 35–57 AVIF per pod, sudah cukup untuk rotasi |
| `keys[]` | `[0,95,178,263,346,405]` | 2–8 clip | Batas clip. Tiap clip dapat porsi scroll yang sama |
| `settle` | 0.55 | 0–1 | Campuran smoothstep per clip (`u + (smoothstep(u) − u)·settle`): kamera "berhenti" sebentar di tiap ruangan |
| `keep` | 36 desktop / 24 mobile | 16–48 | Jumlah `ImageBitmap` yang disimpan (LRU) |
| tier | `d` 1280w / `m` 854w | — | R02: 26.7 MB vs 14 MB total. Pakai `m` kalau `min(w,h) < 700` atau koneksi 2g/3g |

**Resep:**
1. Export frame ke WebP/AVIF ber-nomor, simpan `manifest.json` `{count, fps, keys, tiers}`. Siapkan poster (frame 0) sebagai `<img>` di bawah canvas supaya ada gambar sebelum JS jalan.
2. Unduh coarse-to-fine: step 16, 8, 4, 2, 1. Loader cukup menunggu pass pertama (~N/16 frame), sisanya streaming.
3. Simpan sebagai Blob. Decode ke `ImageBitmap` hanya di window sekitar playhead (8 searah scroll, 2 di belakang), buang yang terjauh dengan `close()`. Tiap frame: `frameAt(P)` → frame terdekat yang sudah siap, gambar hanya kalau berubah.
```js
import { defineSection, stickyProgress, clamp, smoothstep } from './motion-core.js';

export function imageSequence(el, { urls, keys = [0, urls.length - 1], settle = 0.55, keep = 36, dprCap = 1.5 }) {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const blobs = [], bmps = new Map(), S = keys.length - 1;
  let shown = -1, want = 0, lastP = 0;
  const frameAt = (P) => { const x = clamp(P) * S, k = Math.min(S - 1, Math.floor(x)), u = x - k;
    return keys[k] + (u + (smoothstep(u) - u) * settle) * (keys[k + 1] - keys[k]); };
  (async () => { for (const step of [16, 8, 4, 2, 1]) await Promise.all(urls.map((u, i) =>
    i % step || blobs[i] ? 0 : fetch(u).then((r) => r.blob()).then((b) => (blobs[i] = b)))); })();
  const evict = () => { while (bmps.size > keep) { let far = -1;
    for (const k of bmps.keys()) if (bmps.get(k) && (far < 0 || Math.abs(k - want) > Math.abs(far - want))) far = k;
    if (far < 0) return; bmps.get(far).close(); bmps.delete(far); } };
  const decode = (i) => { if (i < 0 || i >= urls.length || bmps.has(i) || !blobs[i]) return;
    bmps.set(i, null); createImageBitmap(blobs[i]).then((b) => { bmps.set(i, b); evict(); }); };
  const nearest = () => { for (let d = 0; d < urls.length; d++) for (const i of [want - d, want + d]) if (bmps.get(i)) return i; return -1; };
  const draw = (i) => { const b = bmps.get(i), s = Math.max(cv.width / b.width, cv.height / b.height) * 1.04;
    ctx.drawImage(b, (cv.width - b.width * s) / 2, (cv.height - b.height * s) / 2, b.width * s, b.height * s); shown = i; };
  return defineSection(el, () => ({
    onResize() { const r = Math.min(devicePixelRatio, dprCap); cv.width = cv.clientWidth * r; cv.height = cv.clientHeight * r; shown = -1; },
    update() {
      const P = stickyProgress(el), dir = P >= lastP ? 1 : -1; lastP = P;
      want = Math.round(frameAt(P));
      for (let d = 0; d < 8; d++) decode(want + d * dir);
      for (let d = 1; d < 3; d++) decode(want - d * dir);
      const f = nearest(); if (f >= 0 && f !== shown) draw(f);
    },
  }));
}
```
**Reduced-motion & mobile:** Scrub tetap boleh (R02 membiarkannya karena user yang pegang), tapi matikan parallax pointer. Alternatif yang lebih tenang: tampilkan frame `keys[k]` per clip sebagai gambar statis biasa (tanpa canvas). Mobile: tier `m`, `keep` 24, fetch concurrency 4.\
**Jebakan:**
- R17 menumpuk 57 `<img>` di DOM dan hanya mengganti opacity. Semua gambar di-decode dan memakan memori. Canvas + window decode jauh lebih hemat.
- Satu bitmap 1280×720 ≈ 3.7 MB di memori. 36 bitmap ≈ 133 MB. Tanpa `close()` di LRU, Safari iOS bisa crash.
- Frame yang dibuat dari video AI sering punya background "hidup" (daun, awan). Saat discroll mundur, semuanya ikut mundur dan terasa palsu. Pilih shot dengan kamera bergerak dan lingkungan diam.

### `scroll-video-scrub` — Video yang di-scrub scroll
**Sumber:** R03 (`R03-the-varnish.md`, hero video), R04 (`R04-breeder.md`, encoding all-intra dan seek throttle dari cursor scrub) · **Mode:** A+B · **Tingkat berat:** Video\
**Kapan dipakai:** Gerakan halus panjang (kamera masuk ruangan, produk berputar) dengan satu file, tanpa ratusan frame. Lebih kecil dari image sequence kalau di-encode benar, tapi seek-nya kurang presisi di browser lama.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `endP` | 0.8 | 0.6–1 | Video selesai di 80% progress hero, sisanya untuk transisi keluar (R03) |
| `follow` | 0.25 per frame → `followToLambda(0.25)` ≈ 17 | 0.12–0.3 | Seberapa cepat waktu video mengejar target |
| `fps` snap | 24 | = fps clip | Bulatkan ke frame supaya tidak seek sub-frame (R04) |
| encode | `-g 1 -bf 0 -sc_threshold 0 -crf 20` | crf 20–24 | All-intra: tiap frame bisa di-decode sendiri. R04 = 15.8 MB / 6 s / 20.9 Mbps |

**Resep:**
1. Encode: `ffmpeg -i src.mov -an -r 24 -vf scale=1920:-2 -c:v libx264 -crf 20 -pix_fmt yuv420p -g 1 -keyint_min 1 -bf 0 -sc_threshold 0 -movflags +faststart scrub.mp4`. Tanpa audio, `+faststart` wajib.
2. Markup: `<video muted playsinline preload="auto" poster>`, sumber WebM VP9 lalu MP4. Video `opacity: 0` sampai `loadeddata`, poster `fetchpriority="high"`.
3. Kalau video di CDN, unduh dulu ke Blob (`fetch → blob → URL.createObjectURL`) sebelum scrub diaktifkan. Seek ke file streaming butuh range request per frame dan bisa macet di tepi buffer (R04).
4. Tiap frame: target = progress → detik, kejar pakai `damp`, bulatkan ke frame, seek hanya kalau tidak sedang seeking.
```js
import { defineSection, stickyProgress, range, smoothstep, damp, followToLambda } from './motion-core.js';

export function videoScrub(el, { endP = 0.8, follow = 0.25, fps = 24 } = {}) {
  const v = el.querySelector('video'), L = followToLambda(follow);
  let cur = 0, busy = false;
  v.addEventListener('seeked', () => (busy = false));
  v.addEventListener('loadeddata', () => v.classList.add('is-ready'), { once: true });
  // iOS baru mau decode frame setelah play() pertama
  addEventListener('touchstart', () => v.play().then(() => v.pause()).catch(() => {}), { once: true, passive: true });
  return defineSection(el, () => ({
    update(dt) {
      if (!v.duration) return;
      const target = smoothstep(range(stickyProgress(el), 0, endP)) * (v.duration - 0.05);
      cur = damp(cur, target, L, dt);
      const t = Math.round(cur * fps) / fps;
      if (!busy && !v.seeking && Math.abs(v.currentTime - t) > 1 / 60) { busy = true; v.currentTime = t; }
    },
    renderStatic() { v.preload = 'none'; },        // poster saja, tidak ada video yang bergerak
  }));
}
```
**Reduced-motion & mobile:** Reduced → poster statis (atau satu frame tengah). Mobile → file `-sm` 720p crf 24. Kalau pointer kasar dan file all-intra terlalu besar, lebih baik loop autoplay versi GOP normal (`-g 48`) daripada scrub.\
**Jebakan:**
- File GOP normal (keyframe tiap 2 detik) bikin seek mundur patah-patah. Scrub butuh all-intra atau keyframe rapat.
- R04: `preload="auto"` + `fetch` ke Blob bisa mengunduh dua kali. Set `preload="metadata"` kalau Blob dipakai.
- Tanpa flag `busy`, seek menumpuk dan video tertinggal jauh di Safari.

### `scroll-3d-story` — Cerita 3D yang dikoreografi scroll
**Sumber:** R02 (`R02-bloom-burr.md`, 3 chapter + hand-off objek), R12 (`R12-palmo.md`, kelapa → kaleng), R10 (`R10-fragment.md`, backdrop Spline 3 pose), R15 (`R15-lidar-drone.md`, GLB 1038 frame di-scrub) · **Mode:** A+B · **Tingkat berat:** 3D model (WebGL kalau geometri prosedural)\
**Kapan dipakai:** Produk atau objek yang jadi benang merah lintas beberapa section: berputar, terurai, kamera dolly, lalu menyatu. Pakai hanya kalau image sequence tidak cukup (butuh interaksi pointer, objek berpindah antar section, atau aset bisa dibuat prosedural).

**Kenapa GSAP di sini:** timeline dengan durasi relatif dan position parameter (`'<'`, `'<+.5'`) jauh lebih mudah dirawat untuk 5–10 objek sekaligus, `end` berupa fungsi ikut ter-refresh saat resize, dan ScrollTrigger mengurus pin/scrub. Untuk 1–3 objek, tabel pose vanilla (R10, R02) sudah cukup: `poseAt(progress)` dengan keyframe `{at, pos, rot}` + `ease.inOutCubic` per segmen.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| panjang scrub | ±420vh (R12, 4 unit timeline ≈ 105vh/unit) | 250–900vh | Makin panjang, makin lambat ceritanya |
| hold | 0.5 unit (R12), 100px (R10) | 0.3–0.6 unit | Pose penting ditahan supaya sempat dilihat. Mobile R10 hold 350–400px |
| tilt pointer | ±15°, damp 3/s | 5–15° | Hidup walau scroll diam |
| DPR | `min(dpr, 1.25)` (R02) | 1–1.5 | R02 adaptive: rata-rata 90 frame, < 48 fps → DPR −0.3, maks 2 ronde |
| GLB scrub | `mixer.setTime(p × durasi)`, follow 0.03 desktop / 0.2 mobile | — | R15 drone 1038 frame @30 fps |

**Resep:**
1. Satu canvas transparan `position: fixed` (R02, R10) atau sticky di dalam wrapper tinggi (R12), `pointer-events: none`, di belakang konten. Background tetap CSS gradient.
2. Scene graph bersarang supaya transform tidak saling timpa: `tilt > intro > scrollRig > spin > model` (R10, R12). Intro berbasis waktu, scroll, dan pointer masing-masing punya grup sendiri.
3. Objek yang "muncul dari dalam" disembunyikan di dalam grup objek lain dengan scale 0 (kaleng di dalam kelapa, R12). Objek yang pindah antar section pakai matrix blend `decompose → lerp/slerp → compose` + hop `sin(πk)` (R02). Tambatkan keyframe ke posisi section, bukan px mentah (R10 pakai px 0/800/900/1900/2000/3200 dan meleset kalau konten berubah).
4. Warm-up di balik loader: `renderer.compileAsync()`, `initTexture` dicicil per 24 ms, render 1 frame. Lazy-load chunk Three saat section ≤ 300% viewport (R03).
```js
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ticker, setupSmoothScroll, damp, reducedMotion, finePointer } from './motion-core.js';
gsap.registerPlugin(ScrollTrigger);
ticker.useGsap(gsap);                                   // satu clock: Lenis → ScrollTrigger → render
setupSmoothScroll({ Lenis, gsap, ScrollTrigger, lerp: 0.08 });

// renderer, scene, camera, tilt > rig > (partL, partR) dibuat seperti biasa
const rad = THREE.MathUtils.degToRad, story = document.querySelector('#story'), runway = document.querySelector('#runway');
const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: {
  trigger: story, start: 'top top', scrub: true, invalidateOnRefresh: true,
  end: () => '+=' + (runway.getBoundingClientRect().top - story.getBoundingClientRect().top - innerHeight) } });
tl.to(rig.rotation, { x: rad(-10), y: rad(90), duration: 1 })
  .to(partR.position, { x: 1, duration: 1.5 }, '<+.5')
  .to(camera.position, { z: 3.5, duration: 1 }, '<')
  .to({}, { duration: 0.5 })                            // hold: pose "terbuka" ditahan
  .to([rig.rotation, partR.rotation], { x: 0, y: 0, duration: 1 })
  .to(partR.position, { x: 0, duration: 1 }, '<')
  .to(camera.position, { z: 5, duration: 1 }, '<');
if (reducedMotion()) { tl.scrollTrigger.kill(); tl.progress(0.6).pause(); }   // pose paling informatif, diam

let visible = false;
ScrollTrigger.create({ trigger: story, start: 'top bottom', end: 'bottom top', onToggle: (s) => (visible = s.isActive) });
const ptr = { x: 0, y: 0 };
if (finePointer() && !reducedMotion()) addEventListener('pointermove', (e) => {
  ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
ticker.add((dt) => {
  if (!visible) return;                                 // tidak render di luar section
  tilt.rotation.y = damp(tilt.rotation.y, ptr.x * rad(15), 3, dt);
  tilt.rotation.x = damp(tilt.rotation.x, ptr.y * rad(15), 3, dt);
  renderer.render(scene, camera);
});
```
**Reduced-motion & mobile:** Reduced → timeline dimatikan dan dibekukan di pose yang paling menjelaskan produk, tilt/idle wobble/ambient spin mati. Mobile → scale model lebih kecil (R12 7 vs 12), jumlah partikel/instance turun (R02 biji 72 → 50), shadow 512, tilt pakai `deviceorientation` dengan `requestPermission()` di gesture pertama (iOS). Wajib ada fallback gambar statis kalau WebGL gagal (R02 dan R10 tidak punya).\
**Jebakan:**
- R10 (Spline) render terus karena ada slow spin 4 menit, tidak menghormati reduced-motion, dan tidak punya fallback. R02 menjalankan idle wobble dan shader `uTime` tanpa guard.
- R12 mengirim GLB 4.65 MB tanpa Draco/KTX2/meshopt + HDRI 1.67 MB. Kompres GLB, HDRI ≤ 1k, atau pakai `RoomEnvironment` dulu lalu tukar HDRI setelah load (R02).
- Timeline yang bergantung posisi awal: R12 memaksa `history.scrollRestoration = 'manual'` + scroll ke 0 supaya state konsisten. Kalau tidak, refresh di tengah halaman bisa menampilkan pose yang salah.
- Banyak `<Canvas>` = banyak WebGL context (R12 kartu flavour). Satu canvas bersama lebih aman.

### `scroll-segment-sequencer` — Scroll memilih segmen, waktu yang menganimasikan
**Sumber:** R15 (`R15-lidar-drone.md`, Capabilities 3 segmen), R12 (`R12-palmo.md`, burst dengan scroll lock), R11 (`R11-kinoria-studio.md`, drop kamera dengan hysteresis) · **Mode:** A+B · **Tingkat berat:** CSS (logikanya), visualnya bebas\
**Kapan dipakai:** Animasi yang jelek kalau di-scrub (ledakan, morph partikel, objek jatuh dengan pegas). Scroll hanya memutuskan "sekarang segmen ke berapa", lalu segmen itu memutar animasi berbasis waktu sampai selesai.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `count` | 3 | 2–6 | Jumlah segmen (`floor(progress × count)`) |
| `hysteresis` | 0.005 | 0.003–0.02 | Zona mati di batas segmen supaya tidak bolak-balik |
| `minPhase[]` | `[0, 1, 0]` s | 0–1.5 s | Segmen minimal tampil sekian detik (R15: Connection ≥ 1 s) |
| durasi fase | morph 1.6 s, fade in 1.05 s / out 0.45 s, collapse 0.85 s | — | R15 point cloud |
| trigger + rearm | nyala ≥ 0.82, siap lagi < 0.58 | jarak 0.2–0.3 | R11 drop kamera 1.95 s |
| burst (lock) | ±2.7 s, reverse `timeScale 1.2` | 1.5–3 s | R12: scroll dikunci selama burst |

**Resep:**
1. `segmentSequencer` mengubah progress kontinu jadi segmen diskrit dengan hysteresis dan durasi minimum.
2. `onSegment(seg)` hanya mengganti **mode**, mis. `cloud.mode = ['terrain', 'sphere', 'collapse'][seg]`. Nilai visual bergerak menuju mode itu dengan rate tetap di loop (`morph += sign · dt / 1.6`, lalu `smootherstep`), bukan di-set langsung dari scroll. Untuk trigger tunggal (objek jatuh masuk), pakai `armedTrigger(0.82, 0.58, fire)`: nyala sekali, baru bisa nyala lagi setelah user scroll balik cukup jauh.
3. Varian scroll lock (R12, pakai GSAP): `ScrollTrigger.create({ onLeave, onEnterBack })` dengan range yang sama dengan timeline scrub. `onLeave`: `scrub.disable(false)`, `gsap.set` semua objek ke pose akhir, `lenis.stop()`, ubah pin jadi `position: fixed`, `burst.play()`. Buka kunci (`lenis.start()`) **di `onComplete` burst**. `onEnterBack`: `burst.timeScale(1.2).reverse()`, aktifkan lagi scrub di `onReverseComplete`.
4. Mode "off" saat keluar section: cek `passProgress(el)` 0/1 di update, atau IO, lalu reset state (R15 `CAP_PARTICLE_SECTION_CUT`).
```js
import { defineSection, stickyProgress, clamp } from './motion-core.js';

export function segmentSequencer(el, { count = 3, hysteresis = 0.005, minPhase = [], onSegment }) {
  let cur = -1, phaseT = 0;
  return defineSection(el, () => ({
    update(dt) {
      phaseT += dt;
      const raw = stickyProgress(el) * count;
      let seg = clamp(Math.floor(raw), 0, count - 1);
      if (cur >= 0 && seg !== cur) {
        const edge = seg > cur ? cur + 1 : cur;               // batas yang sedang dilewati
        if (Math.abs(raw - edge) < hysteresis || phaseT < (minPhase[cur] ?? 0)) seg = cur;
      }
      if (seg !== cur) { onSegment(seg, cur); cur = seg; phaseT = 0; }
    },
  }));
}

/** Nyala sekali di ≥ on, baru siap lagi setelah progress turun < rearm (R11: 0.82 / 0.58). */
export const armedTrigger = (on, rearm, fire) => {
  let armed = true;
  return (p) => {
    if (armed && p >= on) { armed = false; fire(); }
    else if (!armed && p < rearm) armed = true;
  };
};
```
**Reduced-motion & mobile:** Reduced → mode langsung ke state akhir tanpa transisi (`morph = target`), swirl/shake 0, tidak ada scroll lock (R12 burst diganti `set` langsung ke state "kaleng"). Mobile: R15 mematikan point cloud di bawah 1200px. Siapkan versi ringan (titik lebih sedikit, atau gambar per segmen).\
**Jebakan:**
- **Unlock terlalu cepat.** Membuka scroll pakai `setTimeout` tebakan durasi, bukan `onComplete`, bikin user bisa scroll di tengah burst dan state melompat.
- Lupa `gsap.set` ke pose akhir sebelum burst: scrub (apalagi dengan Lenis) belum tentu sampai 1 saat `onLeave`, jadi burst mulai dari pose setengah jadi.
- Scroll lock 2.7 s terasa "nyangkut" untuk user yang scroll cepat (R12 sengaja menerimanya). Jaga di bawah ±3 s dan sediakan reverse yang lebih cepat.
- Scroll cepat bisa melompati satu segmen (0 → 2). Pastikan `onSegment` bisa menerima lompatan, jangan mengandalkan urutan.

### `hero-recede-expand` — Hero mundur saat ditutup, cover melebar saat dibuka
**Sumber:** R02 (`R02-bloom-burr.md`, hero → about), R07 (`R07-agrumea-farm.md`, `PageHero` expanding cover), R10 (`R10-fragment.md`, CTA scrub-in via `view()`) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Transisi antar section yang murah tapi terasa premium. Recede: section berikut naik menutupi hero, hero mengecil dan menggelap. Expand: gambar cover mulai sebagai kartu ber-inset + radius, lalu melebar ke full-bleed saat scroll mulai.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| recede `scale` | 1 → 0.94 | 0.9–0.97 | R02 |
| recede overlay | 0 → 0.55 | 0.3–0.6 | Gelap `::after` di stage hero |
| panjang cover | 100vh terakhir hero | 60–100vh | Hero 200vh = 100vh isi + 100vh ditutup |
| expand `--inset` | 1 → 0 | — | R07 `clip-path: inset()` dari kotak ke full-bleed |
| zoom reveal | 1.18 → 1, 1.5 s expo-out | 1.1–1.2 | R07, berbasis waktu (IO), di elemen terpisah |

**Resep:**
1. Recede: hero `height: 200vh`, stage sticky. Section berikutnya `position: relative; z-index: 2` dengan background penuh, jadi dia benar-benar menutupi.
2. Jalur CSS murni (Chromium/Safari baru): section berikut jadi named view timeline, stage hero memakainya. Fallback JS menulis `--cover` dari posisi section berikut.
3. Expand (R07): wrapper pakai `clip-path` dari `--inset`, gambar di dalamnya yang parallax dan zoom. Jangan taruh clip dan zoom di elemen yang sama.
4. Scrub-in kecil (R10): `.cta { animation: in linear both; animation-timeline: view(); animation-range: entry 0% entry 100% }` dengan `@keyframes in { from { opacity: 0; transform: translateY(-32px) scale(.8) } }`.
```js
/* CSS
.hero { height: 200vh; }
.hstage { position: sticky; top: 0; height: 100svh; overflow: hidden; transform-origin: 50% 0;
  transform: scale(calc(1 - .06 * var(--cover, 0))); }
.hstage::after { content: ''; position: absolute; inset: 0; background: #000; pointer-events: none;
  opacity: calc(.55 * var(--cover, 0)); }
.next { position: relative; z-index: 2; background: var(--bg); }
.cover { clip-path: inset(calc(var(--inset, 1) * 10%) calc(var(--inset, 1) * 16%) round calc(var(--inset, 1) * 24px)); }
@property --cover { syntax: '<number>'; inherits: true; initial-value: 0; }
@keyframes recede { to { --cover: 1; } }
@supports (animation-timeline: view()) {
  body { timeline-scope: --next; }
  .next { view-timeline: --next block; }
  .hstage { animation: recede linear both; animation-timeline: --next; animation-range: entry 0% entry 100%; }
} */
import { defineSection, clamp, range } from './motion-core.js';

const hero = document.querySelector('.hero'), next = hero.nextElementSibling;
if (!CSS.supports('animation-timeline: view()')) defineSection(hero, () => ({
  update() {
    const t = next.getBoundingClientRect().top;               // vh → 0 selama hero ditutup
    hero.style.setProperty('--cover', clamp(1 - t / innerHeight).toFixed(4));
  },
  renderStatic() { hero.style.setProperty('--cover', 0); },
}));

export const expandCover = (el, { length = 0.6 } = {}) => defineSection(el, () => ({
  update() {                                                  // inset 1 → 0 di 60% layar pertama scroll
    const k = range(-el.getBoundingClientRect().top / innerHeight, 0, length);
    el.style.setProperty('--inset', (1 - k).toFixed(4));
  },
  renderStatic() { el.style.setProperty('--inset', 0); },
}));
```
**Reduced-motion & mobile:** Reduced → `--cover: 0` dan `--inset: 0` (gambar langsung full-bleed, hero tidak mengecil), section berikut tetap menutupi seperti scroll biasa. Di CSS: `@media (prefers-reduced-motion: reduce) { .hstage { animation: none } }`. Mobile aman, cuma kurangi radius dan inset awal.\
**Jebakan:**
- Tanpa `@property --cover`, CSS var tidak bisa dianimasikan di keyframe (lompat dari 0 ke 1). Daftarkan propertinya.
- Overlay `::after` tanpa `pointer-events: none` menutup semua tombol di hero.
- Scale dari tengah (`transform-origin` default) memperlihatkan celah di atas hero. R02 memakai origin atas dan background gelap di belakang.

### `clip-curtain-reveal` — Reveal dengan tirai, blinds, atau portal
**Sumber:** R03 (`R03-the-varnish.md`, kain tirai Room V dan portal hero → Room I), R17 (`R17-quiet-cubes.md`, reviews "blinds") · **Mode:** A · **Tingkat berat:** CSS (portal dengan rim noise: WebGL opsional)\
**Kapan dipakai:** Momen "membuka" sesuatu: karya, produk, ruangan berikutnya. Tirai = kain bergelombang terangkat. Blinds = 17 strip menutup/membuka. Portal = lubang bundar yang membesar dan memperlihatkan section berikut.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| range tirai | 0.13 → 0.38 | lebar 0.2–0.35 | R03, di section 440vh |
| lampu nyala | p > 0.07, overlay 0.55 → 0 | step | Instan, bukan fade |
| titik polygon `M` | 24 (25 titik) | 16–40 | Kehalusan tepi bawah |
| `sag` | 9% | 5–14% | Tengah naik lebih dulu, seperti ditarik dari atas |
| wobble | `sin(j·.9 + t·1.6)·1.6 + sin(j·.37 − t)·2.2`, × `(0.4 + t)` | amplitudo 0–4% | Berbasis waktu, kain tetap hidup saat scroll berhenti |
| blinds | 17 strip, stagger amount 1, ease none | 8–24 | R17: SVG `<clipPath>` berisi `<rect>`, `scaleY` 0 → 1 |
| portal | range 0.8–0.99, `hole = m·(0.5·diag + 0.35·vh)`, feather 30vh/15vh | — | R03 |

**Resep:**
1. Tirai: div `.cloth` di atas karya, background berlapis (gradient atas-bawah, `repeating-linear-gradient(90deg, …)` untuk lipatan, dasar `#5a0f14`), `transform-origin: top`. Tiap frame: bangun `clip-path: polygon()` dari dua titik atas + tepi bawah yang bergelombang, kanan ke kiri.
2. Blinds: strip ke-i punya jendela `[i/(n−1)·⅔, i/(n−1)·⅔ + ⅓]` (setara stagger amount 1 + durasi 0.5 di timeline 1.5). `scaleY = range(p, a_i, b_i)` per rect.
3. Portal: section berikut `margin-top: -100vh; z-index: 4`, pin-nya di-mask `radial-gradient(circle, #000 calc(var(--hole) - 30vh), transparent calc(var(--hole) - 15vh))`. Selama `rect.top > 0`, geser pin `translateY(-rect.top)` supaya isinya diam. Lepas mask (`is-arrived`) saat masuk > 96%. Rim sobek opsional = fragment shader fbm, render hanya saat 0.001 < m < 0.999.
```js
import { defineSection, stickyProgress, range, smoothstep } from './motion-core.js';

export function curtain(el, { a = 0.13, b = 0.38, lightsAt = 0.07, M = 24, sag = 9 } = {}) {
  const cloth = el.querySelector('.cloth'), dark = el.querySelector('.dark');
  let lastLit = null;
  const draw = (t, time, wob) => {
    const base = 100 - t * 104, pts = [];                    // > 100% = tertutup penuh
    for (let j = M; j >= 0; j--) {                           // tepi bawah, kanan → kiri
      const x = j / M;
      const w = (Math.sin(j * 0.9 + time * 1.6) * 1.6 + Math.sin(j * 0.37 - time) * 2.2) * wob;
      const y = base - Math.sin(x * Math.PI) * t * sag + w * (0.4 + t);
      pts.push(`${(x * 100).toFixed(2)}% ${Math.max(0, y).toFixed(2)}%`);
    }
    cloth.style.clipPath = `polygon(0% 0%, 100% 0%, ${pts.join(',')})`;
    cloth.style.transform = `scaleY(${1 - t * 0.08})`;
    cloth.style.visibility = t >= 0.999 ? 'hidden' : '';
  };
  return defineSection(el, ({ reduced }) => ({
    update(dt, time) {
      const p = stickyProgress(el), lit = p > lightsAt;
      if (lit !== lastLit) { dark.style.opacity = lit ? 0 : 0.55; el.classList.toggle('is-lit', lit); lastLit = lit; }
      draw(smoothstep(range(p, a, b)), time, reduced ? 0 : 1);   // reduced: tanpa goyang waktu
    },
  }));
}
```
**Reduced-motion & mobile:** Tirai tetap terangkat mengikuti scroll (user yang pegang), tapi wobble waktu mati. Kalau ingin benar-benar tenang: tirai langsung `hidden`, karya tampil. Mobile: `M` 16 cukup. Portal shader → fallback mask CSS saja.\
**Jebakan:**
- `clip-path` string dibangun ulang tiap frame itu murah untuk 1–2 elemen, mahal untuk 30. Untuk banyak strip, pakai `transform: scaleY` per strip (blinds R17) daripada polygon.
- R03 kaca pembesar setelah tirai pakai `touch-action: none`: kalau jempol mulai di kaca, halaman tidak bisa discroll. Batasi `touch-action: none` ke handle kecil.
- Portal: lupa counter-translate pin section berikut = isinya ikut naik di balik mask dan terlihat "bergeser" saat lubang membuka.

### `scroll-text-reveal` — Kata menyala, baris terisi, baris blur-in
**Sumber:** R03 (`R03-the-varnish.md`, statement kata per kata), R04 (`R04-breeder.md`, origin title scroll-fill), R11 (`R11-kinoria-studio.md`, blur-line column) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Statement/manifesto yang ingin dibaca pelan. Tiga varian: **words** (kata berubah dari redup ke terang sesuai scroll), **fill** (gradient hard-stop mengisi baris), **lines** (baris fade + blur masuk sekali, lalu keluar fokus di atas layar).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| words range | 0.08 → 0.66 | lebar 0.4–0.7 | `lit = floor(range(p, a, b) × n)` (R03) |
| fill range | top baris 88% → 28% viewport | — | R04 per baris, `background-clip: text` |
| `enterAt` | 0.88 | 0.8–0.95 | Baris masuk saat top-nya < 88% tinggi viewport (R11) |
| blur masuk | 10px, 1.4 s `cubic-bezier(.165,.84,.44,1)` | 6–12px | R11 (angka dari fromanother.love) |
| stagger | `(i % 4) × 0.1 s` | 0.06–0.12 | Diputar per 4 supaya baris jauh tidak menunggu lama |
| `exitBand` | 0.2 | 0.15–0.3 | 20% teratas viewport: opacity + blur di-scrub (depth of field) |

**Resep:**
1. Split teks: words → `<span class="w">` per spasi; lines → `<div class="ln"><span class="ln-in">…</span></div>` (dua elemen, lihat Jebakan). Simpan teks asli di `aria-label` kalau split per huruf.
2. Words: CSS `.w { color: #f3f2ee47; transition: color .5s cubic-bezier(.22,1,.36,1) } .w.on { color: #f3f2ee }`. JS hanya toggle class saat jumlahnya berubah.
3. Fill: `.line { background: linear-gradient(90deg, currentColor var(--fill), #fff3 var(--fill)); -webkit-background-clip: text; color: transparent }`, `--fill = clamp((0.88 − top/vh) / 0.6) × 100%` per baris.
4. Lines: enter = class `.on` di `.ln-in` (transisi CSS sekali jalan), exit = opacity + blur di `.ln` di-scrub tiap frame. Baca semua rect dulu, baru tulis.
```js
import { defineSection, stickyProgress, range, smoothstep, clamp } from './motion-core.js';

/** words: kata menyala satu per satu (R03). Class hanya di-toggle saat jumlah berubah. */
export function wordLight(el, { a = 0.08, b = 0.66 } = {}) {
  const words = [...el.querySelectorAll('.w')]; let lit = -1;
  return defineSection(el, () => ({
    update() {
      const n = Math.floor(range(stickyProgress(el), a, b) * words.length);
      if (n !== lit) { words.forEach((w, i) => w.classList.toggle('on', i < n)); lit = n; }
    },
    renderStatic: () => words.forEach((w) => w.classList.add('on')),
  }));
}

/** lines: masuk sekali (CSS di .ln-in), keluar fokus di pita atas (scrub di .ln) (R11). */
export function blurLines(el, { enterAt = 0.88, exitBand = 0.2 } = {}) {
  const lines = [...el.querySelectorAll('.ln')].map((ln) => ({ ln, inner: ln.firstElementChild, on: false }));
  return defineSection(el, () => ({
    update() {
      const vh = innerHeight, rects = lines.map((l) => l.ln.getBoundingClientRect());   // read semua dulu
      lines.forEach((l, i) => {                                                         // baru write
        const r = rects[i];
        if (!l.on && r.top / vh < enterAt) { l.on = true; l.inner.style.transitionDelay = `${(i % 4) * 0.1}s`; l.inner.classList.add('on'); }
        const g = smoothstep(clamp((r.top + r.height / 2) / vh / exitBand));
        l.ln.style.opacity = g < 0.999 ? g.toFixed(3) : '';
        l.ln.style.filter = g < 0.999 ? `blur(${((1 - g) * 10).toFixed(1)}px)` : '';
      });
    },
    renderStatic: () => lines.forEach((l) => l.inner.classList.add('on')),
  }));
}
```
**Reduced-motion & mobile:** Semua kata/baris langsung terang (`renderStatic`), dan CSS `@media (prefers-reduced-motion: reduce) { .ln-in { opacity: 1; filter: none; transition: none } }`. Mobile aman. Kurangi blur ke 6px kalau baris banyak (filter mahal).\
**Jebakan:**
- Transisi enter (1.4 s) dan scrub exit di elemen yang **sama** = exit ikut ketarik 1.4 s dan terlihat telat. Pisahkan: enter di `.ln-in`, exit di `.ln`.
- `filter: blur()` di 20 baris tiap frame = repaint mahal. Tulis hanya saat `g < 0.999` (R11), kosongkan setelahnya.
- Split per kata/huruf tanpa `aria-label` di parent = screen reader membaca huruf satu-satu.

### `pinned-horizontal-strip` — Scroll vertikal, gerak horizontal
**Sumber:** R02 (`R02-bloom-burr.md`, shop strip), R03 (`R03-the-varnish.md`, Room IV exhibitions) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Deretan produk/pameran/kartu yang lebih enak dilihat menyamping. Stage di-pin, track bergeser selama section discroll.

**Kenapa kadang GSAP:** kalau ada banyak section pinned berurutan, butuh **snap** per kartu, atau animasi di dalam kartu yang harus dipicu saat kartu masuk (bukan saat section masuk), pakai ScrollTrigger: `gsap.to(track, { x: () => -dist, ease: 'none', scrollTrigger: { trigger: el, pin: true, scrub: 1, end: () => '+=' + dist, snap: 1 / (n - 1), invalidateOnRefresh: true } })`, lalu trigger anak pakai `containerAnimation`. Untuk strip biasa, versi sticky di bawah sudah cukup.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `ratio` | 1 | 0.6–1.5 | px horizontal per 1 px scroll (R02: 1:1, tinggi = lebar track − vw + vh) |
| `a`, `b` | 0, 1 | R03: 0.04–0.72 | Jendela gerak. Sisa di awal/akhir = jeda diam sebelum/sesudah |
| progress bar | `scaleX(p)` | — | R03 |

**Resep:**
1. Markup: `<section class="hs"><div class="stage" sticky><div class="track">kartu…</div><i class="bar"></i></div></section>`. `.track { display: flex; width: max-content; will-change: transform }`.
2. Tinggi section diturunkan dari lebar track, jadi kecepatan konsisten di semua lebar layar.
3. Mobile: `.hs.is-static .stage { position: static } .track { overflow-x: auto; scroll-snap-type: x mandatory }`.
```js
import { defineSection, stickyProgress, range } from './motion-core.js';

export function horizontalStrip(el, { a = 0, b = 1, ratio = 1 } = {}) {
  const track = el.querySelector('.track'), bar = el.querySelector('.bar');
  let dist = 0;
  const ro = new ResizeObserver(() => size());               // lebar track berubah saat gambar load
  const size = () => {
    dist = Math.max(0, track.scrollWidth - innerWidth);
    el.style.height = `${dist / (ratio * (b - a)) + innerHeight}px`;   // scroll yang dipakai gerak = dist / ratio
  };
  return defineSection(el, ({ small, reduced }) => {
    if (small || reduced) { el.classList.add('is-static'); return {}; }   // geser native + snap
    ro.observe(track);
    return {
      onResize: size,
      update() {
        const p = range(stickyProgress(el), a, b);
        track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
        if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      },
      destroy: () => ro.disconnect(),
    };
  });
}
```
**Reduced-motion & mobile:** Keduanya jatuh ke `.is-static`: stage tidak di-pin, track bisa digeser native dengan snap. Kontennya sama, hanya cara bergeraknya yang berbeda.\
**Jebakan:**
- `overflow: hidden` di ancestor mana pun mematikan sticky. Pakai `overflow-x: clip` di body (R03).
- `scrollWidth` diukur sebelum gambar load = section terlalu pendek, kartu terakhir tidak pernah terlihat. Observe track-nya juga.
- `smallScreen()` dibaca sekali saat setup. Kalau user memutar tablet melewati breakpoint, butuh `destroy()` + setup ulang.

### `sticky-card-stack` — Kartu sticky bertumpuk
**Sumber:** R10 (`R10-fragment.md`, Recent Work), R07 (`R07-agrumea-farm.md`, Experience stack 3D), R04 (`R04-breeder.md`, Why stack) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Daftar project/fitur 3–6 item yang ingin terasa seperti tumpukan halaman. Kartu baru naik dan menutupi, kartu lama terdorong ke belakang.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `stickyTop` | 106px / 76px mobile | 60–140px | R10. Kartu 70vh, gap 48px / 24px mobile |
| `scaleTo` | 0.85 | 0.85–0.95 | Kartu lama mengecil. R04: `1 − i·0.045` per tingkat kedalaman |
| `yTo` | 24px | 0–40px | Kartu lama turun sedikit (R10) |
| `rotZ` / `rotX` | −3.8° / 8° | 0–5° / 0–10° | R07, dengan `perspective: 1400px` di parent |
| `shade` | 0.26 | 0–0.4 | Overlay gelap kartu lama (R07). R10 tidak pakai |
| `line` | 0.5 | 0.4–0.7 | Progress dihitung saat top kartu berikutnya melewati garis 50% viewport |

**Resep:**
1. Kolom flex `gap: 48px`, tiap `.card { position: sticky; top: 106px; height: 70vh }`. Parent `perspective: 1400px`. `.card::after { background: #000; opacity: var(--shade, 0) }`.
2. Ukur posisi **natural** tiap kartu di `onResize` (set `position: relative` dan `transform: none` sebentar). Jangan membaca `offsetTop` kartu sticky saat scroll, dan jangan mengukur kartu yang masih ter-scale: resize di tengah scroll membuat titik awal meleset ±70px (ditemukan saat tes skill). `defineSection` memanggil `onResize` juga saat window resize, font selesai dimuat, dan `load`.
5. Keyboard: kalau fokus masuk ke link/tombol di kartu yang sedang tertutup kartu lain, scroll ke kartu itu (`focusin` → `scrollTo` ke `starts[i] - stickyTop`).
3. Kartu i dipengaruhi kartu i+1: `p = clamp((scrollY + vh·line − start[i+1]) / tinggi[i+1])`.
4. Varian R04 (fly-away): satu stage sticky 400vh, kartu teratas terbang ke atas (`translateY → −110%`) membuka kartu berikutnya, sisanya `scale(1 − i·0.045)`, copy di kolom kiri ganti lewat `data-active`.
```js
import { defineSection, clamp } from './motion-core.js';

export function cardStack(el, { scaleTo = 0.85, yTo = 24, rotZ = -3.8, rotX = 8, shade = 0.26, line = 0.5 } = {}) {
  const cards = [...el.querySelectorAll('.card')];
  let starts = [], heights = [];
  const measure = () => {                                    // posisi NATURAL: tanpa sticky DAN tanpa transform
    cards.forEach((c) => { c.style.position = 'relative'; c.style.transform = 'none'; });
    starts = cards.map((c) => c.getBoundingClientRect().top + scrollY);
    heights = cards.map((c) => c.offsetHeight);
    cards.forEach((c) => { c.style.position = ''; c.style.transform = ''; });   // update() menulis ulang transform di frame berikutnya
  };
  return defineSection(el, ({ small }) => ({
    onResize: measure,
    update() {
      const y = scrollY + innerHeight * line, r = small ? 0 : 1;   // ≤ mobile: tanpa rotasi 3D
      cards.forEach((card, i) => {
        if (!cards[i + 1]) return;                           // kartu terakhir tidak bergerak
        const p = clamp((y - starts[i + 1]) / heights[i + 1]);
        card.style.transform = `translateY(${(yTo * p).toFixed(1)}px) scale(${(1 - (1 - scaleTo) * p).toFixed(4)}) ` +
          `rotateX(${(rotX * p * r).toFixed(2)}deg) rotate(${(rotZ * p * r).toFixed(2)}deg)`;
        card.style.setProperty('--shade', (shade * p).toFixed(3));
      });
    },
    renderStatic() {},                                       // tetap sticky & bertumpuk, tanpa scale/rotasi
  }));
}
```
**Reduced-motion & mobile:** Reduced → kartu tetap bertumpuk sticky (itu layout, bukan animasi), tanpa scale/rotasi/shade. Framer di R10 melakukan hal serupa: hanya opacity yang di-update. Mobile: `stickyTop` 76px, gap 24px, tanpa rotasi 3D (R07 ≤ 480px malah layout statis).\
**Jebakan:**
- R10 (runtime Framer) menghitung range dari `offsetTop` kartu yang sedang sticky. Setelah kartu berikutnya menempel, progress membeku di ±0.55 (scale ±0.92, bukan 0.85). Ukur posisi natural.
- R10 recipe asli memanggil `requestAnimationFrame` di setiap event scroll: beberapa rAF per frame. Pakai satu ticker.
- Ancestor dengan `overflow: hidden` / `transform` tertentu mematikan sticky. Cek dulu kalau kartu "tidak nempel".

### `sticky-step-story` — Visual sticky + daftar step (scrollytelling)
**Sumber:** R05 (`R05-dental-enamel.md`, section 3 "One red mark"), R15 (`R15-lidar-drone.md`, list Capabilities) · **Mode:** A · **Tingkat berat:** CSS\
**Kapan dipakai:** Menjelaskan proses 4–8 langkah. Satu visual besar sticky di kiri, step di kanan. Visual berganti **state** (bukan di-scrub) saat step aktif berubah. Tidak butuh ticker sama sekali.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `band` | `-45% 0px -50% 0px` | pita 5–15% | IO rootMargin: step aktif = step yang ada di pita tengah viewport (R05) |
| step non-aktif | opacity 0.55, `.4s` | 0.4–0.6 | R05 |
| badge aktif | `scale(1.12) rotate(-4deg)`, `.4s cubic-bezier(.34,1.56,.64,1)` | — | Spring overshoot ±10% |
| varian list (R15) | scale `max(1 − 0.1·|off|, 0.72)`, opacity `max(0.24 − 0.12·(|off|−1), 0.08)` | — | 500ms `cubic-bezier(.22,1,.36,1)`, item aktif digeser ke tengah |
| mobile | ≤ 980px: visual jadi strip sticky atas 130px | 100–160px | R05 |

**Resep:**
1. Grid dua kolom. Kolom visual `position: sticky; top: 9vh`. Kolom step: tiap step `min-height: 60vh`, plus `padding-bottom: 50vh` di akhir supaya step terakhir bisa mencapai pita tengah.
2. State visual murni CSS: `.visual[data-step="2"] .plan, .visual[data-step="3"] .plan { opacity: 1 }`. Elemen SVG yang di-scale pakai `transform-box: fill-box; transform-origin: 50%`.
3. Varian list R15: `.step { scale: max(calc(1 - .1 * var(--off)), .72); opacity: max(calc(.24 - .12 * (var(--off) - 1)), .08); transition: all .5s cubic-bezier(.22,1,.36,1) } .step.is-active { opacity: 1 }`.
```js
/** Tanpa ticker: IntersectionObserver dengan pita tipis di tengah viewport (R05). */
export function stepStory(el, { band = '-45% 0px -50% 0px', onStep } = {}) {
  const steps = [...el.querySelectorAll('[data-step]')];
  const visual = el.querySelector('.visual');
  let active = -1;
  const set = (i) => {
    if (i === active) return; active = i;
    visual.dataset.step = i;                                 // CSS memilih state visual
    steps.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.style.setProperty('--off', Math.abs(k - i));         // dipakai varian list R15
    });
    onStep?.(i);                                             // mis. update counter "01 / 06"
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) set(steps.indexOf(e.target));
  }, { rootMargin: band });
  steps.forEach((s) => io.observe(s));
  set(0);
  return { destroy: () => io.disconnect() };
}
```
**Reduced-motion & mobile:** Logika step tetap jalan (itu navigasi konten). CSS: `@media (prefers-reduced-motion: reduce) { .step, .visual * { transition: none } }`, badge tanpa rotasi. Mobile ≤ 980px: visual jadi strip sticky 130px di atas, elemen tambahan (R05 "Records created" stack) disembunyikan.\
**Jebakan:**
- Step terakhir tidak pernah aktif karena tidak bisa mencapai tengah layar. Tambah ruang di bawah.
- Panel `aria-live` yang berganti setiap step bisa "cerewet" untuk screen reader (R05). Pakai `aria-live` hanya di ringkasan pendek.

### `scroll-paced-cards` — Kartu melintas dengan pacing dan busur
**Sumber:** R04 (`R04-breeder.md`, testimonials `.sky__stage` dan curved coverflow), R12 (`R12-palmo.md`, badge Benefits) · **Mode:** A · **Tingkat berat:** CSS\
**Kapan dipakai:** Testimoni, badge statistik, atau quote yang "melayang" lewat satu per satu di stage sticky, dengan ritme konsisten (2–3 kartu di layar sekaligus) dan lintasan yang tidak lurus.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `stagger` | 0.3 | 0.2–0.6 | Jeda antar kartu dalam satuan "perjalanan satu kartu" (R12) |
| lintasan Y | 70vh → −70vh | ±50–90vh | R12 badge naik dari bawah ke atas |
| pace | 0.7 | 0.5–1 | R04: `top = startY − (scrolled·0.7 − i·gap)` |
| `swing` | 0.18 × vw | 0.08–0.25 | Simpangan busur `sin(πq)`, sisi selang-seling (R12) |
| coverflow busur | `x = R·sin a`, `y = R(1 − cos a) + d²·6`, 5°/slot | — | R04 Animals, smoothing τ 0.2 s |

**Resep:**
1. Stage sticky 100svh di section tinggi. Kartu `position: absolute` di tengah, posisi diatur JS.
2. Progress lokal kartu i: `q = clamp(P·T − i·stagger)` dengan `T = 1 + stagger·(n−1)`, jadi kartu terakhir selesai tepat di P = 1.
3. Busur coverflow (R04) bisa dipakai sebagai lintasan alternatif: `d = i − P·(n−1)`, `a = d·sudutPerSlot`, `rotate = d·5°`. Aslinya jalan sendiri 0.24 slot/s; di sini disetir scroll.
```js
import { defineSection, stickyProgress, clamp, damp } from './motion-core.js';

/** Kartu naik melintasi stage dengan pacing tetap + busur sinus (R12 badge, R04 testimonial). */
export function pacedCards(el, { stagger = 0.3, swing = 0.18, tilt = 8, lambda = 0 } = {}) {
  const cards = [...el.querySelectorAll('.float-card')], n = cards.length;
  let P = -1;
  return defineSection(el, ({ small }) => ({
    update(dt) {
      const raw = stickyProgress(el);
      P = lambda && P >= 0 ? damp(P, raw, lambda, dt) : raw;   // lambda 5 ≈ τ 0.2 s (R04) kalau tanpa Lenis
      const T = 1 + stagger * (n - 1), vw = innerWidth, vh = innerHeight;
      cards.forEach((c, i) => {
        const q = clamp(P * T - i * stagger);
        const side = small ? 0 : (i % 2 ? 1 : -1);          // mobile: lurus di tengah (R04)
        const arc = Math.sin(Math.PI * q);
        c.style.transform = `translate(-50%,-50%) translate3d(${(side * arc * swing * vw).toFixed(1)}px,` +
          `${((0.7 - 1.4 * q) * vh).toFixed(1)}px,0) rotate(${(side * arc * tilt).toFixed(2)}deg)`;
        c.style.visibility = q > 0 && q < 1 ? '' : 'hidden';
      });
    },
    renderStatic() { el.classList.add('is-static'); },       // CSS: grid biasa, tanpa sticky
  }));
}
```
**Reduced-motion & mobile:** Reduced → `.is-static`: section tidak tinggi lagi, kartu jadi grid/list biasa. Mobile: tanpa busur (lurus di tengah), kartu lebih lebar, `stagger` sedikit lebih besar supaya tidak bertumpuk.\
**Jebakan:**
- Kartu dengan teks panjang di busur yang lebar keluar layar di tablet. Batasi `swing` ke `(vw − lebarKartu) / 2`.
- `visibility: hidden` di luar jendela penting. Tanpa itu kartu yang sudah lewat tetap ada di DOM paint dan bisa menangkap klik.

### `velocity-marquee` — Marquee yang ngebut saat discroll
**Sumber:** R04 (`R04-breeder.md`, marquee), R14 (`R14-format-obys.md`, wide reel vertikal dengan `lenis.velocity`) · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** Pita teks/logo/foto yang jalan terus dan bereaksi ke energi scroll. Murah, efektif, cocok jadi pemisah section.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `base` | 60 px/s | 30–120 | Kecepatan diam (R04) |
| `boost` | 6 | 3–10 | Tambahan per "px/frame" kecepatan scroll (R04: `60 + |vel|·6`) |
| `decay` | 6.3 /s | 3–10 | Setara `vel *= 0.9` per frame @60 (R04), versi dt |
| `cap` | 80 px/frame | 40–120 | Batas lonjakan |

**Resep:**
1. Isi track sekali, lalu JS menduplikasi anaknya (`aria-hidden` di salinan). Wrap offset di setengah panjang track.
2. Kecepatan scroll diukur dari selisih `scrollY` per frame, dinormalisasi ke "px per frame @60". Kalau pakai Lenis, `lenis.velocity` sudah dalam satuan itu.
3. Kecepatan naik instan (ambil maksimum), turun eksponensial.
```js
import { defineSection } from './motion-core.js';

export function velocityMarquee(el, { base = 60, boost = 6, decay = 6.3, cap = 80, axis = 'x' } = {}) {
  const track = el.querySelector('.marquee-track');
  track.append(...[...track.children].map((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); return c; }));
  let offset = 0, vel = 0, lastY = null, half = 0;
  return defineSection(el, () => ({
    onResize() { half = (axis === 'x' ? track.scrollWidth : track.scrollHeight) / 2; },
    update(dt) {
      if (!half) return;                                     // ResizeObserver belum lapor ukuran
      const y = scrollY, dy = lastY === null ? 0 : y - lastY; lastY = y;
      const pxPerFrame = Math.min(cap, Math.abs(dy) / Math.max(dt * 60, 1e-3));
      vel = Math.max(vel * Math.exp(-decay * dt), pxPerFrame);   // naik instan, turun halus
      offset = (offset + (base + vel * boost) * dt) % half;
      track.style.transform = axis === 'x' ? `translate3d(${-offset}px,0,0)` : `translate3d(0,${-offset}px,0)`;
    },
    renderStatic() { track.style.transform = 'none'; },     // diam, tetap terbaca
  }));
}
```
**Reduced-motion & mobile:** Reduced → diam (`renderStatic`). Kalau teksnya penting, tampilkan sebagai baris statis yang bisa wrap. Mobile aman, turunkan `boost` ke 3–4 karena scroll sentuh lebih "meledak".\
**Jebakan:**
- `lastY` basi: section di-pause saat di luar layar, lalu saat kembali selisih `scrollY` sangat besar dan marquee melesat. `cap` mencegah itu (R14 juga mencatat: ukur kecepatan sebelum early-return).
- `% half` saat `half = 0` menghasilkan `NaN` permanen. Guard sebelum ukuran ada.
- Konten kurang dari 2× lebar layar setelah diduplikasi = celah kosong terlihat. Duplikasi sampai cukup.

### `speed-shaped-gallery` — Galeri yang dibentuk kecepatan dan kedalaman
**Sumber:** R06a (`R06a-shelf-dan-sample-1-5.md`, Depth Scroll dan Velocity Reel), R06b (`R06b-sample-6-11.md`, Scroll Bend), R07 (`R07-agrumea-farm.md`, lean/twist toples dari kecepatan) · **Mode:** A · **Tingkat berat:** CSS (tunnel) / WebGL (bend, reel)\
**Kapan dipakai:** Galeri portfolio/foto yang ingin terasa fisik. Tiga varian satu keluarga: **tunnel** (scroll = berjalan ke kedalaman, foto dekat membesar lalu lewat), **bend** (list vertikal melengkung dan "jatuh menjauh" saat cepat), **reel** (carousel horizontal meregang, tepi tertinggal, RGB split). Semuanya: input → target → follow → kecepatan → deformasi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `follow` | 0.09 (tunnel), 0.10 (bend/reel) per frame | 0.08–0.12 | Ubah lewat `followToLambda` |
| `falloff` / `near` | 0.9 / 1.6 | 0.6–1.2 / 1.2–2 | Skala palsu `near / (1 + jarak·falloff)` (tunnel) |
| kabut | redup 0.82 dari jarak 1.2 → 6.5 | — | Redup, bukan `THREE.Fog` |
| `lean` | 13% lebar, 10% tinggi, follow 0.07 | 0–0.2 | Pandangan condong ke kursor |
| spread | `1 + |vel|·5.5` | 2–8 | Susunan mengembang saat cepat |
| bend: vel | `Δ/50`, clamp ±2, attack 0.2 / release 0.05 | — | Cepat naik, lambat turun |
| bend: sink / bow | `2·unit` / `0.3·unit`, `unit = H·0.2414`, `camZ = H·1.207` | — | Tengah layar menjauh, sheet melengkung searah gerak |
| reel: stretch / trail / split | 0.0045 per px, 1.5px, 0.0006 UV | 0.003–0.006 | Melebar, tepi tertinggal (busur), RGB split |
| input (hijack) | wheel 0.0022 item/px, drag 1 item / 0.3H, fling ×0.35 | — | Hanya kalau section memang full-screen |

**Resep:**
1. Di dalam halaman biasa (mode A), setir dari `stickyProgress` section tinggi, bukan hijack wheel. Wheel hijack (R06) cuma cocok kalau section-nya full-screen dan ada jalan keluar yang jelas.
2. Tunnel (snippet): tiap kartu punya offset tetap `data-ox` (±0.3..1.0, selang-seling) dan `data-oy` (−1..1). Jarak `d = i − pos`; skala, posisi, kabut, dan urutan dari `d`.
3. Bend versi WebGL: `PlaneGeometry` 80×40 segmen, vertex shader `sink = cos(rel·π)·|v|·2·unit`, `p.y += sin(uv.x·π)·v·0.3·unit`, lalu `p.xy = mid + (p.xy − mid)·camZ/(camZ + sink)`. **Versi lite CSS**: rumus `camZ/(camZ + sink)` dipakai sebagai `scale` per kartu (tanpa lengkung). Rasa "jatuh menjauh"-nya tetap ada.
4. Reel WebGL: `p.x *= 1 + |speed|·0.0045`, `p.x −= speed·1.5·edge²/width`. Foto non-tengah scale 0.8, redup 0.55. Lean toples R07 (varian DOM): `rotate = −sign(vel)·min(|vel|/2400, 1)·6°` lewat `createSpring({ stiffness: 70, damping: 9 })`, stiffness tiap item dikali `0.85 + 0.3·frac(i·0.618)` supaya tidak serempak.
```js
import { defineSection, stickyProgress, damp, followToLambda, smoothstep, clamp, finePointer } from './motion-core.js';

export function depthTunnel(el, { follow = 0.09, falloff = 0.9, near = 1.6, fog = [1.2, 6.5], lean = 0.13 } = {}) {
  const cards = [...el.querySelectorAll('.depth-card')], N = cards.length;
  const L = followToLambda(follow), LV = followToLambda(0.2), LL = followToLambda(0.07);
  const ptr = { x: 0, y: 0 }, lp = { x: 0, y: 0 };
  let pos = 0, vel = 0;
  if (finePointer()) addEventListener('pointermove', (e) => {
    ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  const ss = (a, b, x) => smoothstep(clamp((x - a) / (b - a)));
  return defineSection(el, ({ reduced }) => ({
    update(dt) {
      const prev = pos;
      pos = damp(pos, stickyProgress(el) * (N - 1), L, dt);
      vel = damp(vel, (pos - prev) / Math.max(dt * 60, 1e-3), LV, dt);          // item per frame @60
      lp.x = damp(lp.x, reduced ? 0 : ptr.x, LL, dt); lp.y = damp(lp.y, reduced ? 0 : ptr.y, LL, dt);
      const spread = 1 + Math.abs(reduced ? 0 : vel) * 5.5, W = innerWidth, H = innerHeight;
      cards.forEach((c, i) => {
        const d = i - pos;                                                       // jarak ke depan
        const s = near / Math.max(1 + d * falloff, 0.2);                         // perspektif palsu
        const x = (+c.dataset.ox * 0.4 * spread - lp.x * lean) * W * s;
        const y = (+c.dataset.oy * 0.32 * spread - lp.y * 0.1) * H * s;
        const vis = ss(-0.8, -0.15, d) * (1 - ss(5.5, 7.5, d));
        c.style.visibility = vis > 0.002 ? '' : 'hidden';
        c.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
        c.style.opacity = vis.toFixed(3);
        c.style.setProperty('--dim', (0.82 * ss(fog[0], fog[1], d)).toFixed(3));   // ::after gelap, bukan filter
        c.style.zIndex = String(1000 - Math.round(d * 10));
      });
    },
  }));
}
```
**Reduced-motion & mobile:** Reduced → lean, spread, split, bend, dan stretch mati. Posisi tetap mengikuti scroll tapi tanpa glide panjang (atau ganti ke grid statis). Mobile: lean kursor mati (touch), judul belakang reel disembunyikan < 700px, foto 0.6W. Versi WebGL → fallback ke tunnel/list CSS.\
**Jebakan:**
- **Lerp per frame di 120 Hz.** R06b Scroll Bend memakai follow 0.10 per frame tanpa dt, jadi di ProMotion dua kali lebih cepat. Semua angka "per frame" di tabel harus lewat `followToLambda`.
- `filter: brightness()` per kartu per frame untuk kabut = repaint. Pakai overlay `::after` dengan opacity `--dim`.
- Skala `near/(1 + d·falloff)` meledak/negatif untuk `d < −1.1`. Clamp penyebutnya.
- Wheel hijack + `preventDefault` di tengah halaman = user terjebak. Kalau memang hijack, lepas di ujung (index pertama/terakhir).

### `chapter-scroll-engine` — Scroll virtual antar chapter
**Sumber:** R11 (`R11-kinoria-studio.md`) · **Mode:** B (mode A hanya kalau section full-screen dan boleh mengunci) · **Tingkat berat:** CSS (engine), visual biasanya WebGL\
**Kapan dipakai:** Microsite sinematik di mana tiap chapter butuh kontrol penuh (gate loading, snap per beat, transisi berbasis pegas) dan scroll native malah mengganggu. Mahal dari sisi aksesibilitas, jadi pakai hanya kalau benar-benar perlu.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `chapters[].len` | 1.2 / 2.2 / 2.5 layar | 0.8–6 | "Panjang" chapter dalam layar |
| `wheelGain` | 0.0008 | 0.0005–0.0012 | 1 notch (deltaY 100) = 0.08 layar. Print R11: ±1250px deltaY untuk 0 → 1 |
| `lambda` | 9 | 5–13 | Damping `shown → target` |
| spring kritis | ω 6.5 (13 setelah scroll cepat) | 5–13 | Untuk chapter transisi berat |
| snap | idle 220 ms, rate 8 | 150–300 ms | Snap ke beat terdekat (rows R11: 7 baris) |
| `gate` | 0.985 | 0.95–1 | Chapter berikut baru menerima input kalau sebelumnya sudah ≥ gate |
| touch | axis-lock 9px rasio 1.12, gain 1.35, fling τ 220 ms | — | Lewat `createVelocityTracker` |

**Resep:**
1. `html, body { height: 100%; overflow: hidden; overscroll-behavior: none }`, semua layer `position: fixed`. Wajib: rail navigasi (progress per chapter, klik untuk lompat), dan teks tetap di DOM (bukan di canvas).
2. Satu input → `push(delta)`. Delta mengisi chapter aktif dulu, sisanya (overflow) mengalir ke chapter berikutnya (atau sebelumnya saat mundur).
3. Ticker: `shown` mengejar `target` pakai `damp`. Render semua chapter dari `shown`.
4. Touch: `pointermove` → `(prevY − y) / innerHeight × 1.35`, axis-lock 9px. Saat lepas, fling = kecepatan tracker × `exp(−t/0.22)`.
```js
import { ticker, damp, clamp, reducedMotion } from './motion-core.js';

export function chapterEngine(chapters, { wheelGain = 0.0008, lambda = 9, snapIdleMs = 220, snapRate = 8, render }) {
  const st = chapters.map(() => ({ target: 0, shown: 0 }));
  let lastInput = 0;
  const push = (delta) => {                                   // delta dalam satuan "layar"
    let i = delta > 0 ? st.findIndex((s) => s.target < 1 - 1e-6) : st.findLastIndex((s) => s.target > 1e-6);
    while (i >= 0 && i < st.length && Math.abs(delta) > 1e-6) {
      if (delta > 0 && i > 0 && st[i - 1].shown < (chapters[i].gate ?? 0)) break;   // tunggu chapter sebelumnya mendarat
      const s = st[i], len = chapters[i].len, next = clamp(s.target + delta / len);
      delta -= (next - s.target) * len; s.target = next;
      i += delta > 0 ? 1 : -1;
    }
    lastInput = performance.now();
  };
  addEventListener('wheel', (e) => { if (!e.ctrlKey) push(e.deltaY * wheelGain); }, { passive: true }); // ctrl = pinch trackpad
  addEventListener('keydown', (e) => {
    const k = { ArrowDown: 0.08, ArrowUp: -0.08, PageDown: 0.24, PageUp: -0.24, ' ': 0.24 }[e.key];
    if (k) { e.preventDefault(); push(e.shiftKey && e.key === ' ' ? -k : k); }
  });
  ticker.add((dt) => {
    const idle = performance.now() - lastInput > snapIdleMs, calm = reducedMotion();
    st.forEach((s, i) => {
      const beats = chapters[i].beats;                        // mis. 6 → snap ke kelipatan 1/6
      if (idle && beats) s.target = damp(s.target, Math.round(s.target * beats) / beats, snapRate, dt);
      s.shown = calm ? s.target : damp(s.shown, s.target, lambda, dt);
    });
    render(st);                                               // render() wajib early-out kalau tidak ada perubahan
  });
  return { push, state: st };
}
```
**Reduced-motion & mobile:** Engine tetap dibutuhkan (tanpa input, konten tidak berpindah), tapi `shown = target` langsung tanpa glide, entrance berbasis waktu (drop kamera, flash) dilewati, reveal teks langsung tampil. Mobile: tap memajukan beat berikutnya, axis-lock + fling, rail jadi bar atas ≤ 500px.\
**Jebakan:**
- Tanpa scroll native: tidak ada scrollbar, anchor link, find-in-page, dan navigasi screen reader terasa aneh. Sediakan rail + tombol "lewati", dan teks tetap DOM.
- Pinch trackpad datang sebagai `wheel` + `ctrlKey`. Kalau tidak dibuang, zoom dianggap scroll.
- Tanpa `gate`, user bisa melewati chapter berat sebelum aset/shader-nya siap. R11 memanaskan chapter berikut (lazy `import()` + `compileAsync`) saat progress mendekat.
- Ticker engine ini jalan terus (tidak ada IO). `render()` harus berhenti menulis DOM/WebGL saat semua `shown ≈ target`. R11 juga membatasi rAF ke ±120 Hz.

### `hero-collapse-to-slot` — Hero larut lalu terbang masuk ke judul
**Sumber:** R09 (`R09-andreas-vision.md`, hero cloud → kubus 14×14), R14 (`R14-format-obys.md`, "seven → deck": gambar besar mengecil masuk slot reel) · **Mode:** A (B sebagai motif yang diulang) · **Tingkat berat:** Canvas2D/SVG\
**Kapan dipakai:** Hero yang "memadatkan" dirinya jadi satu ikon/objek kecil yang lalu menempati slot di headline berikutnya. Ceritanya: visual besar → esensi kecil. Sangat cocok untuk portfolio/brand dengan motif visual kuat.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| tinggi stage | 1.8 layar | 1.5–2.5 | R09 sticky `height: 180%` |
| `dissolve` | 0.05 → 0.55, 7 step | 5–12 step | Sel hilang urut radial terbalik, berundak (bukan halus) |
| urutan sel | `jarak radial × 0.82 + acak × 0.18` | acak 0.1–0.3 | Tepi bergerigi saat larut |
| `fly` | 0.6 → 0.85, `ease.inOutCubic` | — | Objek pindah dari tengah ke rect `.slot` |
| `swapAt` | 0.62 | — | Class `.swapped`: judul baru muncul |
| kata lama keluar | `--out = Q/0.3`, per kata `out·1.8 − i·0.16`, naik 0.25em | — | CSS calc, tanpa JS per kata |

**Resep:**
1. `.stage { height: 180% }`, `.sticky { position: sticky; top: 0; height: 100vh }`, canvas absolute di dalamnya. Judul baru punya `<span class="slot">` berukuran `1cap × 1cap`. Ukur rect slot **setelah** `document.fonts.ready` (dan di resize). Posisinya relatif ke stage, jadi tidak tergantung posisi scroll.
2. Bangun grid sel sekali (noise/gambar → tone), simpan `{x, y, tone, order}` dengan `order` 0..1 dari pusat. Render hanya sel dengan `order ≤ keep`.
3. Kata lama (CSS): `.before .word { --gone: clamp(0, calc(var(--out) * 1.8 - var(--i) * .16), 1); opacity: calc(1 - var(--gone)); translate: 0 calc(var(--gone) * -.25em) }`. Kata baru: `.swapped .after .text { animation: pop 500ms step-end calc(var(--i) * 70ms) both }`, keyframe `pop` = scale 0.35 → 0.65 → 1 (sel grid 22px, range 12–40).
4. Varian R14 (tanpa canvas): interpolasi rect `x/y/w/h` elemen gambar ke rect slot (FLIP manual), lalu `clip-path: inset()` di akhir.
```js
import { defineSection, stickyProgress, clamp, lerp, ease } from './motion-core.js';

const stepQ = (t, n) => Math.ceil(t * n) / n;                   // progress berundak ("stop-motion")

export function collapseToSlot(el, { drawCells, drawObject, dissolve = [0.05, 0.55], fly = [0.6, 0.85], swapAt = 0.62, steps = 7 }) {
  const stage = el.querySelector('.sticky'), slot = el.querySelector('.slot');
  let home = null, target = null, lastQ = -1;
  const measure = () => {
    const s = stage.getBoundingClientRect(), r = slot.getBoundingClientRect(), size = Math.min(s.width, s.height) * 0.22;
    home = { x: (s.width - size) / 2, y: (s.height - size) / 2, size };
    target = { x: r.left - s.left, y: r.top - s.top, size: r.height };
    lastQ = -1;
  };
  const frame = (Q) => {
    if (!home || Math.abs(Q - lastQ) < 1e-4) return; lastQ = Q;
    drawCells(stepQ(1 - clamp((Q - dissolve[0]) / (dissolve[1] - dissolve[0])), steps));   // gambar sel dengan order ≤ keep
    const g = ease.inOutCubic(clamp((Q - fly[0]) / (fly[1] - fly[0])));
    const lift = Math.sin(Math.PI * g) * stage.clientHeight * 0.08;
    drawObject({ x: lerp(home.x, target.x, g), y: lerp(home.y, target.y, g) - lift, size: lerp(home.size, target.size, g) });
    el.classList.toggle('swapped', Q >= swapAt);
    el.style.setProperty('--out', clamp(Q / 0.3).toFixed(3));
  };
  document.fonts.ready.then(measure);
  return defineSection(el, () => ({
    onResize: measure,
    update() { frame(stickyProgress(el)); },
    renderStatic() { document.fonts.ready.then(() => { measure(); frame(1); }); },   // judul akhir + objek di slot
  }));
}
```
**Reduced-motion & mobile:** R09: stage dan sticky jadi 100% (tanpa fase scroll), progress dipaksa 1, langsung judul akhir dengan objek di slot, animasi kata `none`, Lenis tidak dibuat. Mobile: ukuran sel tetap 22px (grid jadi lebih kasar, ±18 kolom) dan itu masih terbaca. Canvas `aria-hidden`, `h1` punya `aria-label` teks final.\
**Jebakan:**
- Rect slot diukur sebelum font load = objek mendarat di tempat yang salah. R09 menunggu `document.fonts.ready` + `ResizeObserver`.
- Render tiap frame walau progress tidak berubah. R09 hanya merender saat scroll (dan drift 24 fps saat idle). Guard `lastQ`.
- Koordinat canvas tidak dibulatkan ke pixel device = tepi sel blur. Bulatkan dan pakai `image-rendering: pixelated`.
