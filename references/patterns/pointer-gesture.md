# Pola Pointer, Gesture & Physics

Bab ini berisi pola interaksi yang digerakkan tangan user: kursor yang diikuti, elemen yang di-drag dan dilempar, gesture melingkar, menggambar, zoom, sampai fisika (spring, Verlet, rigid body, Matter.js). Angka diambil dari bedah R01–R16, dan semua resep ditulis ulang di atas `assets/starter/motion-core.js`: satu clock, smoothing berbasis `dt`, section otomatis berhenti saat di luar layar.

Prinsipnya: pakai teknik paling ringan yang hasilnya sama. Kebanyakan pola cukup DOM + CSS transform. WebGL dan library fisika hanya kalau memang tidak ada jalan lain.

| id | ringkas |
|---|---|
| `fondasi` | Pointer Events satu jalur, `bindDrag`, konversi angka referensi, tangan hantu untuk demo |
| `cursor-parallax-depth` | Layer bergeser beda kedalaman + objek utama miring ke arah kursor |
| `proximity-spring` | Sticker/huruf/tombol menghindar atau tertarik ke kursor pakai spring |
| `cursor-facing-rotators` | Mata, panah, glyph yang berputar menghadap kursor |
| `proximity-weight-field` | Grid huruf variable font yang menebal + berubah warna dekat kursor |
| `custom-cursor` | Dot + bracket, label "Open", dan lens yang membuka layer lain |
| `index-lens` | Daftar judul yang membengkak di bawah kursor + poster yang mengikuti |
| `cursor-scrub-video` | Video all-intra yang `currentTime`-nya digerakkan kursor |
| `cursor-wake-dwell` | Tile terdorong jejak kursor, diam di atas tile = buka tanpa klik |
| `infinite-drag-canvas` | Dinding kartu tanpa ujung, drag 1:1, lempar meluncur |
| `wheel-drag-shelf` | Rak objek berputar tanpa ujung lewat wheel, drag, dan rail |
| `drag-rotate` | Putar objek dengan drag lurus atau gerakan melingkar, coast lalu snap |
| `throwable-cards` | Kartu foto yang dipegang di titik mana pun, dilempar, memantul |
| `draw-to-reveal-trail` | Menggambar garis yang memunculkan foto di sepanjang jalur |
| `plucked-string-type` | Huruf single-stroke yang kawatnya bisa dipetik |
| `semantic-zoom` | Mosaik 32×32 yang di-zoom (wheel/pinch) sampai tiap sel jadi foto |
| `physics-drop-field` | Klik = benda jatuh dan menumpuk (Matter.js), scroll cepat = melayang |
| `verlet-rope` | Kartu tergantung di tali Verlet, bisa ditarik dan dilempar |
| `tactile-feedback-kit` | Squash-stretch tombol, burst di titik klik, easter egg platformer |

---

## Fondasi (dipakai semua pola)

**Satu jalur input.** Mouse, touch, dan pen lewat `pointerdown/move/up/cancel`. Jangan bikin cabang `touchstart` terpisah (R06a sample 1 melakukannya lalu harus men-skip pointer touch supaya tidak dobel). `touch-action`: `none` untuk area drag bebas, `pan-y` untuk drag horizontal di halaman yang tetap di-scroll, `manipulation` untuk area yang cuma di-tap.

**Angka gesture yang konsisten di referensi:**
- Slop: 6 px mouse (R06a, R07, R13), 10 px touch (R06a, R11). Tap = gerak < 6 px dan < 320 ms (R13). Double-tap = 2 tap dalam 320 ms (R06b).
- Kecepatan lempar dari sampel 100 ms terakhir; kalau pointer diam > 80 ms sebelum dilepas, kecepatan = 0 (R06b). Sudah ada di `createVelocityTracker`.
- `setPointerCapture` baru dipasang **setelah** lewat slop (R07). Kalau di `pointerdown`, tap biasa di link di dalam elemen tidak sampai ke link-nya.
- Klik yang lahir dari drag diblok di capture phase (R07), kalau tidak lepas drag di atas kartu langsung membuka link.

**Konversi angka referensi ke motion-core:**

| di referensi | di motion-core |
|---|---|
| `x += (t - x) * f` per frame (mis. 0.12) | `x = damp(x, t, followToLambda(f), dt)` |
| time constant τ detik / decay `v *= exp(-dt/τ)` | `damp(x, t, 1 / τ, dt)` / tulis langsung `v *= Math.exp(-dt / tau)` |
| spring per frame `v = (v - x·k)·d` (mis. 0.06 / 0.86) | `createSpring({ stiffness: 3600·k·d, damping: -60·ln d })` → ≈ 186 / 9 |
| spring `v += (k(t-x) - d·v)·dt·60` | `stiffness: 3600·k, damping: 60·d` |
| rasio redaman ζ | `damping: 2·ζ·√(stiffness·mass)` |

Semua lerp per frame di referensi (R04, R06, R16) jalan 2× lebih cepat di layar 120 Hz. Selalu konversi.

**`bindDrag`.** Helper yang dipakai banyak resep di bawah. Usulan: simpan sebagai `assets/starter/pointer-kit.js` di samping `motion-core.js` (belum ada di starter).

```js
import { createVelocityTracker } from './motion-core.js';

export function bindDrag(el, { onStart, onMove, onEnd, onTap, slop = 6 } = {}) {
  const vt = createVelocityTracker();                          // jendela 100 ms, basi 80 ms
  let id = null, x0 = 0, y0 = 0, lx = 0, ly = 0, t0 = 0, moved = false;
  const down = (e) => {
    if (id !== null || e.button > 0) return;
    id = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY; t0 = performance.now(); moved = false;
    vt.reset(); vt.add(lx, ly); onStart?.(e);
  };
  const move = (e) => {
    if (e.pointerId !== id) return;
    const s = e.pointerType === 'mouse' ? slop : slop * 1.7;   // touch: ±10 px
    if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) > s) { moved = true; el.setPointerCapture(id); }
    if (moved) onMove?.(e.clientX - lx, e.clientY - ly, e);
    lx = e.clientX; ly = e.clientY; vt.add(lx, ly);
  };
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    onEnd?.(moved && e.type === 'pointerup' ? vt.get() : { x: 0, y: 0 }, e);   // selalu dipanggil; tap = kecepatan 0
    if (!moved && performance.now() - t0 < 320) onTap?.(e);
  };
  const guard = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
  el.addEventListener('pointerdown', down); el.addEventListener('click', guard, true);   // klik bekas drag diblok
  const win = [['pointermove', move], ['pointerup', up], ['pointercancel', up]];
  win.forEach(([t, f]) => addEventListener(t, f));            // di window: tetap dapat event walau keluar elemen
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('click', guard, true); win.forEach(([t, f]) => removeEventListener(t, f)); };
}
```

**Tangan hantu (R06a, R06b).** Section yang baru hidup kalau disentuh (wake, lens, draw) terlihat kosong saat pertama dibuka. R06a memutar demo dengan gesture sintetis yang diumpankan ke handler yang **sama** dengan input user: pindah ke titik acak (cepat 0.22–0.42 s atau pelan 1–1.6 s, smootherstep), diam 0.35–1 s, ulang. Begitu user menyentuh, demo berhenti. Panggil dari `update(dt)` section supaya ikut pause di luar layar, dan jangan jalankan saat reduced-motion.

```js
import { lerp } from './motion-core.js';

const sst = (t) => t * t * t * (t * (6 * t - 15) + 10), rnd = (a, b) => a + Math.random() * (b - a);
export function createGhostHand() {
  let from = { x: 0.5, y: 0.5 }, to = { x: 0.3, y: 0.4 }, t = 0, dur = 1.2, wait = 0.6;
  return {
    step(dt) {                                                 // hasil 0..1 relatif ke section
      if (wait > 0) wait -= dt; else t = Math.min(1, t + dt / dur);
      const k = sst(t), p = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) };
      if (t === 1) { from = to; to = { x: rnd(0.15, 0.85), y: rnd(0.2, 0.8) }; t = 0; dur = Math.random() < 0.5 ? rnd(0.22, 0.42) : rnd(1, 1.6); wait = rnd(0.35, 1); }
      return p;
    },
  };
}
// update(dt): if (demo) { const p = demo.step(dt); feed(rect.left + p.x * rect.width, rect.top + p.y * rect.height); }
// pointerdown/pointermove pertama dari user → demo = null
```

**Hover → touch.** `finePointer()` false artinya tidak ada hover. Setiap pola di bawah menyebut penggantinya (drag, tap, tahan diam, gyro, atau state statis). Jangan sembunyikan konten di balik hover.

---

### `cursor-parallax-depth` — Parallax berlapis & objek "menoleh" ke kursor
**Sumber:** R01, R06a, R07 · **Mode:** A+B · **Tingkat berat:** CSS (3D model kalau objek utamanya GLB)\
**Kapan dipakai:** hero dengan objek utama + dekorasi yang butuh kedalaman murah tanpa scroll. Cocok sebagai lapisan idle di bawah interaksi lain.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `depth` per layer | FG 46, BG −24, sprig −12 px × posisi −0.5..0.5 (R01) | ±4–50 px | negatif = bergerak berlawanan, terasa di belakang |
| `follow` | 0.05/frame (R01, R06a) → ≈ 3.1/s | 2–8 /s | makin kecil makin berat dan melayang |
| `lookAt` | theta ±20°, phi ±9° (R01 kamera model) | ±8–25° | objek utama miring ke arah kursor |
| `ambient` | float 16 px / 6 s (R01); latar ±14/±10 px, 4/s (R07); parallax ×0.45 saat fokus (R06a) | — | gerak idle, juga pengganti di touch |

**Resep:**
1. Normalisasi pointer ke −0.5..0.5, `damp` satu nilai `cur` per frame, tulis `--px/--py` ke section sekali per frame.
2. Tiap layer menghitung geser di CSS dari `--depth`-nya; objek utama memakai `--px/--py` untuk `rotateY/rotateX` (atau `camera-orbit` kalau model-viewer).
3. Animasi lain di objek yang sama (spin, transisi) dijumlahkan di satu tempat lalu ditulis sekali (R01: offset spin + sudut follow). Parallax layer di properti `translate`, tilt objek utama di `transform`, float-nya lewat keyframe yang hanya menganimasikan `translate` objek itu — satu properti, satu pemilik.

```js
import { defineSection, damp, followToLambda } from './motion-core.js';

defineSection(document.querySelector('[data-parallax]'), ({ el, fine }) => {
  if (!fine) return {};                                       // touch: cukup ambient float CSS
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, lambda = followToLambda(0.05);
  const onMove = (e) => { target.x = e.clientX / innerWidth - 0.5; target.y = e.clientY / innerHeight - 0.5; };
  const onOut = (e) => { if (!e.relatedTarget) target.x = target.y = 0; };   // keluar window → balik ke tengah
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerout', onOut);
  return {
    update(dt) {
      cur.x = damp(cur.x, target.x, lambda, dt); cur.y = damp(cur.y, target.y, lambda, dt);
      el.style.setProperty('--px', cur.x.toFixed(4)); el.style.setProperty('--py', cur.y.toFixed(4));
    },
    renderStatic() { el.style.setProperty('--px', 0); el.style.setProperty('--py', 0); },
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('pointerout', onOut); },
  };
});
/* CSS
.layer { translate: calc(var(--px, 0) * var(--depth) * 1px) calc(var(--py, 0) * var(--depth) * 1px); }
.layer--fg { --depth: 46 } .layer--bg { --depth: -24 } .layer--sprig { --depth: -12 }
.hero-object { transform: perspective(900px) rotateY(calc(var(--px, 0) * 40deg)) rotateX(calc(var(--py, 0) * -18deg)); } */
```

**Touch, keyboard & reduced-motion:** touch tidak punya posisi kursor: float CSS pelan saja (R01: 16 px / 6 s). Gyro boleh sebagai bonus, tapi iOS butuh `DeviceOrientationEvent.requestPermission()` dari gesture user. Keyboard tidak relevan. Reduced: `--px/--py` 0, float mati.

**Jebakan:**
- R01 hanya mendengarkan `mousemove`, jadi di HP pouch diam di sudut default tanpa pengganti apa pun.
- R01 mengaktifkan `camera-controls`, tapi loop menulis `cameraOrbit` tiap frame sehingga drag user langsung ditimpa. Satu properti, satu pemilik.
- Lerp 0.05 per frame tanpa `dt` dan loop yang tidak pernah pause (R01). `defineSection` + `damp` menyelesaikan keduanya.

### `proximity-spring` — Elemen menghindar atau tertarik ke kursor
**Sumber:** R01, R14, R06b, R07, R13, R06a · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** sticker dekorasi yang kabur dari kursor (R01), huruf headline yang terdorong (R14 poster, R06b strung-type), produk yang sedikit tertarik ke kursor (R07), tombol magnetik (R13).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `radius` | 340 px (R01) · 1.125× huruf (R06b) · 1.6× lebar item (R07) | 120–400 px | jangkauan pengaruh |
| `strength` | tolak maks 70 px (R01) · tarik ±16 px (R07) | 10–80 px | tanda + menolak, − menarik |
| `spring` | k .09 / d .85 per frame (R14) → stiffness ≈ 275, damping ≈ 10; R06b k160 ζ0.2 → damping ≈ 5 | stiffness 120–300, damping 5–20 | damping kecil = membal |
| `falloff` / `lean` | `(1 − d/R)²` (R06b) atau Gaussian (R07); miring tangensial (R14), spin ×6 saat dekat (R01) | 0–15° | bentuk medan + rotasi ikut dorongan |

**Resep:**
1. Cache posisi home tiap item (ukur ulang saat scroll/resize), dikurangi offset spring yang sedang berjalan supaya tidak jadi umpan balik.
2. Per frame: vektor kursor → home, falloff, target = arah × strength × falloff. Dua `createSpring` per item.
3. Varian magnetik (R13): target = (kursor − pusat) × 0.3 selama kursor di dalam tombol, 0 saat keluar; damping rendah memberi rasa `elastic.out`. Varian angin (R06a): dorongan dari **kecepatan** kursor, `spring.kick(vx·f)`, hanya kalau kursor lewat dalam 90–210 px.

```js
import { defineSection, createSpring, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-repel]'), ({ el }) => {
  const R = 340, MAX = 70, SIGN = 1;                          // R01. SIGN −1 = tarik (R07)
  const spring = () => createSpring({ stiffness: 275, damping: 10 });
  const items = [...el.querySelectorAll('[data-repel-item]')].map((node) => ({ node, hx: 0, hy: 0, sx: spring(), sy: spring() }));
  const measure = () => items.forEach((it) => {               // cache; JANGAN getBoundingClientRect per frame
    const r = it.node.getBoundingClientRect();
    it.hx = r.left + r.width / 2 - it.sx.value; it.hy = r.top + r.height / 2 - it.sy.value;
  });
  const p = { x: -1e4, y: -1e4 }, hide = () => { p.x = p.y = -1e4; };
  el.addEventListener('pointermove', (e) => { p.x = e.clientX; p.y = e.clientY; });
  el.addEventListener('pointerleave', hide);
  el.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && hide());   // jari diangkat
  addEventListener('scroll', measure, { passive: true }); measure();
  return {
    onResize: measure,
    update(dt) {
      for (const it of items) {
        const dx = it.hx - p.x, dy = it.hy - p.y, d = Math.hypot(dx, dy) || 1, f = clamp(1 - d / R) ** 2 * MAX * SIGN;
        it.sx.set((dx / d) * f); it.sy.set((dy / d) * f);
        if (it.sx.isSettled() && it.sy.isSettled()) continue; // diam = tidak menulis DOM
        const x = it.sx.step(dt), y = it.sy.step(dt), lean = clamp(it.sx.velocity * 0.02, -12, 12);
        it.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${lean}deg)`;
      }
    },
    renderStatic() {},                                         // reduced: semua di home
    destroy() { removeEventListener('scroll', measure); },
  };
});
```

**Touch, keyboard & reduced-motion:** di touch efek hidup hanya selama jari menekan dan bergerak (R06b: hover di desktop, drag di touch); pakai `touch-action: pan-y` kalau section ada di halaman yang di-scroll. Tombol magnetik dimatikan di touch (R13 menggate `hover:hover and pointer:fine`). Reduced: posisi home.

**Jebakan:**
- R01 memanggil `getBoundingClientRect()` 5× per frame untuk repel. Cache.
- R01 punya dua penulis transform (loop repel dan tween implode/explode). Loop harus berhenti menulis selama tween, lalu posisi akhir tween disimpan sebagai home baru supaya tidak loncat.
- Sticker yang terdorong bisa menutupi CTA. Dekorasi wajib `pointer-events: none`.

### `cursor-facing-rotators` — Mata, panah & glyph yang menghadap kursor
**Sumber:** R16, R08 · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** aksen playful yang tersebar: deret huruf/ikon yang berputar menghadap kursor (R16), mata yang melirik (R08 ikon About, R16 grid mata), panah yang menunjuk.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `offsetDeg` | +90° (R16, aset menghadap atas) | −90 / 0 / 90 | koreksi arah "depan" aset |
| `follow` | 0.1/frame (R16) → ≈ 6.3/s | 4–12 /s | kelincahan putar |
| `snapDeg` | 0; 45 untuk panah (R16, tanpa smoothing) | 0 / 45 / 90 | putaran berundak |
| `pupil` | 0.3 × radius mata; R08 dihaluskan 0.15 s `power3.out` | 0.2–0.4 | seberapa jauh pupil bergeser |

**Resep:**
1. Cache pusat tiap elemen, hitung ulang saat scroll/resize (R16: elemen "melirik" ulang saat di-scroll walau mouse diam). Sudut target = `atan2` ke kursor + offset.
2. *Unwrap* target supaya selalu jalur terpendek, lalu `damp` (atau set langsung kalau snap).
3. Mata: tulis offset pupil ke `--eye` dan haluskan dengan CSS `.pupil { translate: var(--eye, 0 0); transition: translate .15s }` — lebih murah dari loop.

```js
import { defineSection, damp, followToLambda, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-face-cursor]'), ({ el, fine, reduced }) => {
  if (reduced) return { renderStatic() {} };                  // semua di 0°, pupil di tengah
  const OFFSET = 90, SNAP = 0, PUPIL = 0.3, lambda = followToLambda(0.1);
  const items = [...el.querySelectorAll('[data-rotator], [data-eye]')].map((node) => ({ node, eye: node.hasAttribute('data-eye'), cx: 0, cy: 0, r: 0, cur: 0, tgt: 0 }));
  let mx = innerWidth / 2, my = innerHeight / 2;               // touch: target = tengah layar (R16)
  const aim = () => items.forEach((it) => {
    const dx = mx - it.cx, dy = my - it.cy, a = Math.atan2(dy, dx), k = clamp(Math.hypot(dx, dy) / 300) * it.r * PUPIL;
    if (it.eye) return it.node.style.setProperty('--eye', `${Math.cos(a) * k}px ${Math.sin(a) * k}px`);
    let deg = (a * 180) / Math.PI + OFFSET;
    if (SNAP) deg = Math.round(deg / SNAP) * SNAP;
    while (deg - it.tgt > 180) deg -= 360;                     // unwrap: jalur terpendek
    while (deg - it.tgt < -180) deg += 360;
    it.tgt = deg;
  });
  const onScroll = () => { items.forEach((it) => { const b = it.node.getBoundingClientRect(); it.cx = b.left + b.width / 2; it.cy = b.top + b.height / 2; it.r = b.width / 2; }); aim(); };
  const onMove = (e) => { mx = e.clientX; my = e.clientY; aim(); };
  if (fine) addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  return {
    onResize: onScroll,
    update(dt) { for (const it of items) if (!it.eye) { it.cur = SNAP ? it.tgt : damp(it.cur, it.tgt, lambda, dt); it.node.style.rotate = `${it.cur}deg`; } },
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); },
  };
});
```

**Touch, keyboard & reduced-motion:** touch: target tetap di tengah layar, jadi elemen tetap melirik saat di-scroll (R16); bonus: target = posisi tap terakhir. Dekoratif → `aria-hidden`. Reduced: semua di 0°, pupil di tengah.

**Jebakan:**
- R16 memakai lerp 0.1 per frame tanpa `dt`: di 120 Hz putaran 2× lebih cepat.
- Tanpa unwrap, elemen berputar hampir satu lingkaran saat kursor melewati sisi kiri (±180°).
- Ukur rect di setiap event scroll untuk ratusan elemen itu mahal. Untuk grid besar, simpan posisi relatif dokumen sekali lalu kurangi `scrollY`.

### `proximity-weight-field` — Grid huruf yang menebal di dekat kursor
**Sumber:** R16 · **Mode:** A (B sebagai section glyphset) · **Tingkat berat:** CSS\
**Kapan dipakai:** type foundry, brand dengan variable font, atau section playground yang ringan tapi wow. Butuh font variable gratis, mis. Roboto Flex (`wght` 100–1000, `wdth` 25–151).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `radius` | 6rem ≈ 600 px di 1440 (R16); opacity 0 di 2.5× radius | 300–700 px | luas medan, huruf jauh menghilang |
| `stops` | faktor radius 1 / .55 / .35 / .125 → wght 200 / 400 / 650 / 900; warna #0000cb → #5c92ff → #ffae00 → #ff0b00 | 3–5 stop | kurva tebal + warna dari jauh ke dekat |
| `enter` | radius tumbuh 0 → 1 dalam 0.4 s `power3.out` | 0.3–0.6 s | medan "mekar" saat kursor masuk |
| `count` | 240 huruf | ≤ 300 | di atas itu re-shaping teks berat |

**Resep:**
1. Grid `<span class="cell">a</span>` × N. Cache pusat tiap huruf, ukur ulang saat scroll/resize.
2. Jarak ke kursor dibagi `power` (0..1, di-`damp` saat enter/leave), lalu interpolasi piecewise ke tabel stop.
3. Tulis `--w`/`--o` **hanya kalau berubah** (wght dibulatkan). Warna dihitung CSS: `font-variation-settings: 'wght' var(--w, 200); color: color-mix(in oklch, #ff0b00 calc((var(--w, 200) - 200) / 7 * 1%), #0000cb)`.

```js
import { defineSection, damp, lerp, clamp } from './motion-core.js';
const STOPS = [[1, 200], [0.55, 400], [0.35, 650], [0.125, 900]];   // [faktor radius, wght]
const wghtAt = (d, R) => {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [fa, wa] = STOPS[i], [fb, wb] = STOPS[i + 1];
    if (d >= fa * R) return wa;
    if (d >= fb * R) return lerp(wb, wa, (d - fb * R) / ((fa - fb) * R));
  }
  return STOPS.at(-1)[1];
};
defineSection(document.querySelector('[data-weight-field]'), ({ el, fine, small }) => {
  if (!fine || small) return { renderStatic() {} };            // touch/≤768: grid statis
  const cells = [...el.querySelectorAll('.cell')];
  let centers = [], R = 600, mx = -1e4, my = -1e4, power = 0, want = 0;
  const measure = () => {
    R = 6 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    centers = cells.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  };
  el.addEventListener('pointerenter', () => (want = 1)); el.addEventListener('pointerleave', () => (want = 0));
  el.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; });
  addEventListener('scroll', measure, { passive: true }); measure();
  return {
    onResize: measure,
    update(dt) {
      power = damp(power, want, 7.5, dt);                       // ≈ 0.4 s power3.out
      cells.forEach((c, i) => {
        const d = Math.hypot(mx - centers[i][0], my - centers[i][1]) / Math.max(power, 1e-3);
        const w = Math.round(wghtAt(d, R)), o = +(1 - clamp((d - R) / (1.5 * R))).toFixed(2);
        if (c._w !== w) { c.style.setProperty('--w', w); c._w = w; } if (c._o !== o) { c.style.setProperty('--o', o); c._o = o; }   // tulis hanya kalau berubah
      });
    },
    renderStatic() {},
  };
});
```

**Touch, keyboard & reduced-motion:** R16 mematikan medan di ≤ 768 px dan menggantinya dengan video. Lebih ringan: medan muncul di titik tap lalu memudar ±0.6 s. Grid `aria-hidden="true"`, teks asli di heading. Reduced: semua huruf di weight dasar, tanpa loop.

**Jebakan:**
- 240 huruf × `font-variation-settings` per frame = re-shaping teks tiap frame. Tanpa write-avoidance dan pembulatan, frame drop.
- Axis Exat di kode (wght 42–228, wdth 10/50/100) adalah unit custom font itu. Petakan ke axis font yang dipakai.
- R16 baru meng-init semua interaksi setelah `glyphset.json` selesai di-fetch; kalau gagal, tidak ada yang jalan dan preloader polling terus. Init jangan bergantung pada data opsional.

### `custom-cursor` — Dot + bracket, label tag, dan lens reveal
**Sumber:** R11, R06a, R07, R09 · **Mode:** A+B · **Tingkat berat:** CSS (lens versi R09: Canvas2D)\
**Kapan dipakai:** kursor sebagai bagian identitas: dot + frame yang mengejar (R11), lingkaran berlabel "Open/Back" (R06a; R07 "Discover product"), atau lens yang membuka layer tersembunyi di sekitar kursor (R09 footer).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `dot` / `tag` | dot 11 px tanpa lag (R11); bracket 32×25 (R11) atau lingkaran 68 px (R06a) | 6–14 / 24–90 px | titik presisi + elemen yang mengejar |
| `followTau` | 0.04 s (R06a) → lambda 25/s | 0.03–0.12 s | lag tag |
| `label` | fade 110 ms (R06a); muncul setelah diam 260 ms (R07) | 80–200 ms | "Open" / "Back" / "Drag" |
| `lens` | radius 150 px, tumbuh 90 ms, susut 120 ms (R09) | 80–220 px | lingkaran yang membuka layer kedua |

**Resep:**
1. Satu `pointermove` global. Dot = posisi mentah, tag = `damp`. Semua elemen kursor `position: fixed; left: 0; top: 0; pointer-events: none`.
2. Label dari `data-cursor` elemen terdekat (`closest`), default "Open" untuk link/tombol: satu deteksi via selector, bukan listener per elemen (R11). Lens: layer kedua di-`clip-path: circle()` di posisi kursor relatif ke layer itu. R09 mengisi lens dengan canvas langit pixel yang di-clip ke siluet; versi CSS jauh lebih murah.
3. `cursor: none` dipasang lewat class **setelah** JS jalan dan hanya di pointer fine.

```js
import { defineSection, damp, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-cursor-root]'), ({ el, fine, reduced }) => {
  if (!fine) return {};                                       // touch: kursor OS saja
  const dot = el.querySelector('.cursor-dot'), tag = el.querySelector('.cursor-tag'), lens = el.querySelector('[data-lens]');
  const p = { x: -200, y: -200 }, f = { x: -200, y: -200 };
  let r = 0, rWant = 0, label = '';
  const onMove = (e) => {
    p.x = e.clientX; p.y = e.clientY;
    const hit = e.target.closest('a, button, [data-cursor]'), next = hit ? hit.dataset.cursor ?? 'Open' : '';
    if (next !== label) { label = next; tag.dataset.label = label; tag.classList.toggle('is-on', !!label); }
    rWant = lens && e.target.closest('[data-lens-zone]') ? 150 : 0;
  };
  const onOut = (e) => { if (!e.relatedTarget) { p.x = p.y = -200; rWant = 0; } };   // keluar window / masuk iframe
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerout', onOut);
  document.documentElement.classList.add('has-cursor');        // CSS: .has-cursor * { cursor: none }
  return {
    update(dt) {
      const b = lens?.getBoundingClientRect();                  // baca dulu, baru tulis (hindari layout thrash)
      f.x = damp(f.x, p.x, reduced ? 1e3 : 25, dt); f.y = damp(f.y, p.y, reduced ? 1e3 : 25, dt);
      dot.style.translate = `${p.x}px ${p.y}px`;
      tag.style.translate = `${f.x}px ${f.y}px`;
      const rate = (rWant > r ? 150 / 0.09 : 150 / 0.12) * dt;  // tumbuh 90 ms, susut 120 ms (R09)
      r = clamp(r + Math.sign(rWant - r) * Math.min(rate, Math.abs(rWant - r)), 0, 150);
      if (b) lens.style.clipPath = `circle(${r}px at ${p.x - b.left}px ${p.y - b.top}px)`;
    },
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('pointerout', onOut); document.documentElement.classList.remove('has-cursor'); },
  };
});
```

**Touch, keyboard & reduced-motion:** touch pakai kursor OS; lens R09 diganti tap: lens muncul di titik tap, tahan ±1.5 s, lalu susut. Keyboard: pastikan `:focus-visible` tetap jelas, karena `cursor: none` sering bikin tim lupa state fokus. Reduced: tanpa lag dan tanpa scale pop (R06a mematikan pop di CSS).

**Jebakan:**
- Elemen kursor tanpa `pointer-events: none` memakan hover dan klik: link di bawah kursor tidak bisa diklik.
- `cursor: none` global sebelum JS jalan, atau di device touch = kursor hilang tanpa pengganti.
- Di atas iframe/embed, `pointermove` berhenti dan kursor kustom membeku. Sembunyikan lewat `pointerout` dengan `relatedTarget` null.

### `index-lens` — Daftar fisheye + poster mengikuti kursor
**Sumber:** R06a, R11 · **Mode:** A (B sebagai halaman index) · **Tingkat berat:** CSS (R06a aslinya WebGL + teks di canvas)\
**Kapan dipakai:** daftar karya, menu proyek, line-up event. Baris di bawah kursor membengkak, tetangga ikut membesar dan terdorong, sisanya meredup, foto karya mengikuti kursor.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `lens` / `swell` | Gaussian 12% tinggi daftar; swell 1.25 → baris aktif ×2.25 | 10–14% / 1.0–1.5 | lebar lensa + pembesaran maksimum |
| `follow` | presence 0.12, lensa 0.22, poster 0.16 per frame | lewat `followToLambda` | kelincahan tiap lapis |
| `poster` | tilt `clamp(−vx·0.005, ±0.2 rad)`, pop −5% decay 0.86/frame | — | foto miring searah gerak, "pop" saat ganti item |
| `alpha` | idle 0.82, aktif `0.2 + 0.8·p`; pitch baris 0.92 | — | baris jauh meredup |

**Resep:**
1. Baris `position: absolute; transform-origin: left center` dengan font di ukuran **maksimum**, skala dasar `1/(1+swell)`, supaya teks tetap tajam saat membesar.
2. Bobot tiap baris `p = exp(−(dy/(0.12·H))²)·presence`, tinggi `m·(1 + swell·p)`, susun berurutan. Lalu geser seluruh daftar dengan rata-rata berbobot `p` dari (posisi asli − posisi baru) supaya baris yang di-hover tetap di bawah kursor.
3. Satu poster saja, ganti `src` saat baris aktif berubah. Ide R11 sejalan: satu "hover band" untuk semua baris, bukan listener per baris.

```js
import { defineSection, damp, followToLambda, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-index-lens]'), ({ el }) => {
  const rows = [...el.querySelectorAll('.row')], poster = el.querySelector('.poster'), N = rows.length, SWELL = 1.25, PITCH = 0.92;
  const L = { pres: followToLambda(0.12), lens: followToLambda(0.22), post: followToLambda(0.16) };
  let m = 0, H = 0, pres = 0, want = 0, py = 0, ly = 0, active = -1, pop = 0;
  const post = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, measure = () => { H = el.clientHeight; m = H / (N * PITCH + 0.5); };
  el.addEventListener('pointermove', (e) => { const b = el.getBoundingClientRect(); want = 1; tgt.x = e.clientX - b.left; tgt.y = py = e.clientY - b.top; });
  el.addEventListener('pointerleave', () => (want = 0));
  measure();
  return {
    onResize: measure,
    update(dt) {
      pres = damp(pres, want, L.pres, dt); ly = pres < 0.05 ? py : damp(ly, py, L.lens, dt);
      let y = 0, shift = 0, wsum = 0, best = 0, bestD = Infinity;
      const out = rows.map((_, i) => {
        const home = (i + 0.5) * m * PITCH, dy = home - ly, p = Math.exp(-((dy / (H * 0.12)) ** 2)) * pres;
        const h = m * (1 + SWELL * p), cy = y + h * 0.46;
        y += h * PITCH; shift += (home - cy) * (p + 1e-4); wsum += p + 1e-4;
        if (Math.abs(dy) < bestD) { bestD = Math.abs(dy); best = i; }
        return { cy, s: h / m / (1 + SWELL), p };              // font di ukuran maks, skala turun
      });
      out.forEach(({ cy, s, p }, i) => {                       // shift/wsum: baris aktif tetap di bawah kursor
        rows[i].style.transform = `translate3d(0,${cy + shift / wsum - m / 2}px,0) scale(${s})`;
        rows[i].style.opacity = 0.82 + (0.2 + (0.8 * p) / Math.max(pres, 1e-3) - 0.82) * pres;
      });
      if (best !== active && pres > 0.5) { active = best; pop = 1; poster.src = rows[best].dataset.img; }
      pop *= Math.pow(0.86, dt * 60);
      const ox = post.x; post.x = damp(post.x, tgt.x, L.post, dt); post.y = damp(post.y, tgt.y, L.post, dt);
      const tilt = clamp((-(post.x - ox) / dt / 60) * 0.005, -0.2, 0.2);
      poster.style.transform = `translate3d(${post.x}px,${post.y}px,0) translate(-50%,-50%) rotate(${tilt}rad) scale(${1 - 0.05 * pop})`;
      poster.style.opacity = pres;
    },
  };
});
```

**Touch, keyboard & reduced-motion:** R06a memakai drag vertikal di touch, tapi itu mengunci scroll halaman. Di halaman yang di-scroll: daftar statis dengan thumbnail kecil, tap = buka. Keyboard: baris adalah `<a>`; saat `focus`, set `py` ke tengah baris dan `want = 1`. Reduced: tanpa swell, cukup opacity aktif/redup, poster diam di sisi kanan.

**Jebakan:**
- Men-scale teks kecil ke ×2.25 = buram. Mulai dari ukuran besar lalu scale turun.
- Tanpa kompensasi `shift`, baris yang di-hover lari dari kursor karena baris di atasnya ikut membesar.
- Ganti `src` tanpa preload = kedip. R06a sendiri tidak punya klik, keyboard, maupun reduced-motion di sample ini.

### `cursor-scrub-video` — Video yang di-scrub kursor
**Sumber:** R04 · **Mode:** A · **Tingkat berat:** Video\
**Kapan dipakai:** subjek yang bereaksi ke user tanpa 3D: hewan/wajah menoleh, produk 360°, mekanisme buka-tutup. Hindari kalau latar banyak elemen hidup (air, daun, kerumunan): semuanya ikut maju-mundur dan terlihat palsu.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `fps` | 24; 145 frame, 6.04 s (R04) | 24–30; 100–150 frame | harus sama dengan clip |
| `mapping` | relatif, sensitivity 0.8 (R04) | **absolut** (disarankan) | absolut = kursor kanan selalu berarti menoleh kanan |
| `smoothing` | 0.12/frame (R04) → τ ≈ 0.12 s | τ 0.1–0.15 s | glide antar frame |
| `start` / `fallback` | frame 0 / loop autoplay (R04) | tengah / loop atau poster | posisi awal; touch dan reduced-motion |

**Resep:**
1. Produksi clip: kamera terkunci, satu gerakan monoton satu arah (kiri → depan → kanan), frame tengah menghadap kamera, 4–6 s.
2. Encode **all-intra** supaya seek ke frame mana pun instan (R04: 145/145 frame tipe I, ±20.9 Mbps, 15.8 MB untuk 6 s). Siapkan juga versi loop ringan untuk touch:
   ```bash
   ffmpeg -i turn_src.mov -an -r 24 -vf "scale=1920:-2" \
     -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
     -g 1 -keyint_min 1 -bf 0 -sc_threshold 0 -x264-params mbtree=0 \
     -movflags +faststart hero-scrub.mp4
   # versi loop (touch): -vf "scale=1280:-2" -crf 24 -g 48, tanpa flag all-intra → jauh lebih kecil
   ffprobe -v error -select_streams v -show_entries frame=pict_type -of csv hero-scrub.mp4 | sort | uniq -c   # harus semua I
   ```
3. Markup `<video muted playsinline preload="none" poster data-scrub-src data-loop-src aria-hidden="true">`. Fetch file scrub ke Blob URL dulu (seek lokal instan, tanpa range request per frame), baru aktifkan scrub.

```js
import { defineSection, damp, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-scrub-video]'), ({ el, fine, reduced }) => {
  const video = el.querySelector('video'), FPS = 24;
  const loop = () => { video.src = video.dataset.loopSrc; video.loop = true; video.play().catch(() => {}); };
  if (reduced) return {};                                     // poster diam
  if (!fine) { loop(); return {}; }                           // touch: file loop ringan, bukan all-intra
  const s = { target: 0, shown: 0, last: -1, busy: false, armed: false };
  (async () => {
    try {
      const blob = await (await fetch(video.dataset.scrubSrc, { cache: 'force-cache' })).blob();
      video.src = URL.createObjectURL(blob);
      await new Promise((ok, no) => { video.onloadeddata = ok; video.onerror = no; });
      video.pause(); s.target = s.shown = video.duration / 2; s.armed = true;   // mulai dari tengah
    } catch { loop(); }
  })();
  video.addEventListener('seeked', () => { s.busy = false; });
  el.addEventListener('pointermove', (e) => {                 // absolut, hanya di area section
    if (!s.armed) return;
    const b = el.getBoundingClientRect();
    s.target = clamp((e.clientX - b.left) / b.width) * (video.duration - 1 / FPS);  // jangan seek ke ujung
  });
  return {
    update(dt) {
      if (!s.armed) return;
      s.shown = damp(s.shown, s.target, 8, dt);               // τ ≈ 0.12 s, sama di 60/120 Hz
      if (s.busy) return;
      const t = Math.round(s.shown * FPS) / FPS;              // snap ke grid frame
      if (t === s.last) return;
      s.last = t; s.busy = true; video.currentTime = t;       // satu seek in-flight
    },
  };
});
```

**Touch, keyboard & reduced-motion:** touch: file loop GOP normal (R04 malah mengunduh file all-intra 15.8 MB yang sama hanya untuk loop). Reduced: poster statis. Kalau ini viewer produk 360° yang informatif, tambahkan `<input type="range">` yang menulis `s.target`.

**Jebakan:**
- Mapping relatif R04 (`target += Δx·0.8·durasi`) bikin arah pandang dan kursor **drift**: kursor di tepi kanan belum tentu menoleh kanan, terutama setelah mentok di clamp lalu balik arah.
- `preload="auto"` + `fetch` blob = potensi unduhan dobel. Seek ke `duration` persis bisa memicu `ended`/frame kosong; clamp ke `duration − 1/fps`.
- R04 mendengarkan `mousemove` di `window` dan rAF tidak pernah pause, jadi video tetap di-seek walau hero sudah lewat. Tanpa flag `busy`, seek menumpuk di decoder (terutama Safari).

### `cursor-wake-dwell` — Riak di belakang kursor + diam untuk membuka
**Sumber:** R06a · **Mode:** A · **Tingkat berat:** CSS (R06a: WebGL untuk RGB split)\
**Kapan dipakai:** grid poster/proyek di mana kursor yang lewat mendorong tile seperti riak di belakang perahu, dan diam di atas satu tile membukanya tanpa klik.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `push` | 0.34 × delta kursor (maks 60 px), reach Gaussian 1.15 tile; balik: 0.06/0.86 per frame → stiffness ≈ 186, damping ≈ 9 | 0.2–0.4; 1–1.5 tile | kekuatan, lebar, dan pegas riak |
| `rest` | EMA `s·0.7 + |Δ|·0.3` < 2.2 px/frame | 1.5–3 | ambang "diam" |
| `dwell` | naik dt/0.6, turun dt/0.3; buka ≥ 1, tutup < 0.6 | 0.6–0.8 s | waktu tunggu + histeresis |
| `open` | spring k300 ζ0.55, skala maks 2 (mobile 2.6), rotasi `clamp(−vx·0.0045, ±0.18 rad)` | 1.6–2.6 | seberapa besar tile membuka |

**Resep:**
1. Cache pusat tiap tile. Akumulasi delta kursor antar frame.
2. Tiap tile: `f = exp(−(d/(1.15·w))²)·0.34·(1 − open)`, lalu `kick` spring searah gerak kursor.
3. Dwell: kursor di atas tile + kecepatan di bawah ambang = isi dwell; tampilkan sebagai cincin (`--ring` → `conic-gradient`). Tile terbuka: tetangga didorong radial `open·w·0.62·exp(−(d/2.2w)²)`, sisanya diredupkan 50% (tidak ditulis di snippet).

```js
import { defineSection, createSpring, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-wake]'), ({ el, reduced }) => {
  const mk = (stiffness, damping) => createSpring({ stiffness, damping });
  const tiles = [...el.querySelectorAll('.tile')].map((node) => ({ node, cx: 0, cy: 0, w: 0, dwell: 0, x: mk(186, 9), y: mk(186, 9), open: mk(300, 19) }));
  const measure = () => tiles.forEach((t) => { const r = t.node.getBoundingClientRect();
    t.cx = r.left + r.width / 2 - t.x.value; t.cy = r.top + r.height / 2 - t.y.value; t.w = r.width; });
  const p = { x: -1e4, y: -1e4, dx: 0, dy: 0, speed: 99 };
  el.addEventListener('pointermove', (e) => {
    if (p.x > -1e3) { p.dx += clamp(e.clientX - p.x, -60, 60); p.dy += clamp(e.clientY - p.y, -60, 60); }
    p.x = e.clientX; p.y = e.clientY;
  });
  el.addEventListener('pointerleave', () => { p.x = p.y = -1e4; });
  addEventListener('scroll', measure, { passive: true }); measure();
  return {
    onResize: measure,
    update(dt) {
      p.speed = p.speed * 0.7 + Math.hypot(p.dx, p.dy) * (1 / 60 / dt) * 0.3;   // EMA px/frame@60
      for (const t of tiles) {
        const d = Math.hypot(p.x - t.cx, p.y - t.cy), f = Math.exp(-((d / (t.w * 1.15)) ** 2)) * 0.34 * (1 - t.open.value);
        if (!reduced) { t.x.kick(p.dx * f * 60); t.y.kick(p.dy * f * 60); }   // dorong searah gerak
        t.dwell = d < t.w / 2 && p.speed < 2.2 ? Math.min(1, t.dwell + dt / 0.6) : Math.max(0, t.dwell - dt / 0.3);
        if (t.dwell >= 1) t.open.set(1); else if (t.dwell < 0.6) t.open.set(0);   // histeresis
        const x = t.x.step(dt), y = t.y.step(dt), o = t.open.step(dt), rot = clamp((-t.x.velocity / 60) * 0.0045, -0.18, 0.18);
        t.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${rot}rad) scale(${1 + o})`;
        t.node.style.zIndex = o > 0.01 ? 2 : '';
        t.node.style.setProperty('--ring', t.dwell.toFixed(3));
      }
      p.dx = p.dy = 0;
    },
    destroy() { removeEventListener('scroll', measure); },
  };
});
```

**Touch, keyboard & reduced-motion:** R06a memakai "tahan diam" di touch, tapi itu bentrok dengan scroll halaman. Di halaman yang di-scroll: tap = buka, tap di luar = tutup. Keyboard: `focus` tile = `dwell = 1`, `Esc` = tutup. Reduced: tanpa riak, tile membuka dengan `open.snap(1)`.

**Jebakan:**
- Dwell-to-open tanpa indikator progress membuat user bingung kenapa tile tiba-tiba membesar (catatan R06a sendiri).
- Spec "opens after 0.8 s" di registry R06a tidak sama dengan kode (dwell 0.6 s + waktu EMA turun). Kalau klien menyebut angka, ukur totalnya.
- Tile yang membesar menutupi dan memblok hover tetangga. Dorong tetangga keluar atau turunkan `pointer-events` mereka.

### `infinite-drag-canvas` — Dinding kartu tanpa ujung
**Sumber:** R06a · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** galeri atau halaman index/journal yang bisa digeser ke segala arah tanpa tepi. Mode A sebagai section galeri fullscreen, mode B sebagai halaman "All work".

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `card` / `gap` / `pool` | 500 / 80 px (≤768: 260/40, ≤480: 176/26); 8 × 6 = 48 elemen di-recycle | lebar pool > viewport + 1 sel | ukuran grid + jumlah elemen DOM nyata |
| `parallax` | 60 px (30/22 mobile), foto scale 1.15 | ≈12% kartu; scale ≥ 1 + 2·par/card | foto bergeser di dalam frame |
| `follow` | 0.12/frame untuk wheel/keyboard; drag 1:1 | 0.08–0.15 | kehalusan input non-drag |
| `glide` | jarak `v·0.9/3`, 0.9 s `outCubic`; abaikan < 40 px/s, clamp 4000 px/s | 0.6–1.2 s | lemparan meluncur lalu berhenti |

**Resep:**
1. Posisi kartu = `wrap(col·cell + pos.x)`; kartu di luar layar `visibility: hidden`. Drag 1:1 tanpa smoothing (tangan harus "memegang" dinding); wheel/keyboard (panah ±120 px) lewat target + `damp`.
2. Lepas: glide berjarak `v·T/3` dengan `ease.outCubic`. Turunan `1−(1−t)³` di t=0 adalah 3, jadi kecepatan awal glide sama persis dengan kecepatan tangan, tanpa patahan.
3. Foto dimuat dari yang terdekat ke tengah, maksimal 6 paralel, placeholder warna dulu (LQIP).

```js
import { defineSection, damp, followToLambda, ease } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-endless]'), ({ el, reduced }) => {
  const CARD = 500, cell = CARD + 80, COLS = 8, ROWS = 6, T = 0.9, PAR = reduced ? 0 : 60, lam = followToLambda(0.12);
  const cards = [...el.querySelectorAll('.card')].map((node, i) => ({ node, img: node.querySelector('img'), c: i % COLS, r: (i / COLS) | 0 }));
  const pos = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, wrap = (v, size) => ((((v + cell) % size) + size) % size) - cell;
  let glide = null, held = false;
  bindDrag(el, {
    onStart: () => { glide = null; held = true; },
    onMove: (dx, dy) => { pos.x = tgt.x = pos.x + dx; pos.y = tgt.y = pos.y + dy; },        // 1:1
    onEnd: (v) => { held = false; const sp = Math.hypot(v.x, v.y), k = Math.min(sp, 4000) / sp;
      if (sp >= 40 && !reduced) glide = { dx: (v.x * k * T) / 3, dy: (v.y * k * T) / 3, t: 0, done: 0 }; },   // jarak v·T/3
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); glide = null; tgt.x -= e.deltaX * 0.8; tgt.y -= e.deltaY * 0.8; }, { passive: false });
  return {
    update(dt) {
      if (glide) {
        glide.t = Math.min(1, glide.t + dt / T);
        const e = ease.outCubic(glide.t), s = e - glide.done; glide.done = e;
        pos.x = tgt.x = pos.x + glide.dx * s; pos.y = tgt.y = pos.y + glide.dy * s;
        if (glide.t === 1) glide = null;
      } else if (!held) { pos.x = damp(pos.x, tgt.x, lam, dt); pos.y = damp(pos.y, tgt.y, lam, dt); }
      const vw = el.clientWidth, vh = el.clientHeight;
      for (const c of cards) {
        const x = wrap(c.c * cell + pos.x, COLS * cell), y = wrap(c.r * cell + pos.y, ROWS * cell), on = x > -CARD && x < vw && y > -CARD && y < vh;
        c.node.style.visibility = on ? '' : 'hidden'; if (!on) continue;
        c.node.style.transform = `translate3d(${x}px,${y}px,0)`;
        const px = (-(x + CARD / 2 - vw / 2) / (vw / 2)) * PAR, py = (-(y + CARD / 2 - vh / 2) / (vh / 2)) * PAR;
        c.img.style.transform = `translate3d(${px}px,${py}px,0) scale(1.15)`;
      }
    },
  };
});
```

**Touch, keyboard & reduced-motion:** satu jalur pointer, `touch-action: none` di section (section ini memang fullscreen). Keyboard: panah ±120 px ke `tgt`; kartu adalah link, saat fokus geser `tgt` supaya kartu itu ke tengah. Reduced: tanpa glide, parallax, dan intro stagger.

**Jebakan:**
- Wheel dengan `preventDefault` di section yang ada di tengah halaman membajak scroll. Pola ini hanya untuk section fullscreen atau halaman tanpa scroll native.
- Lebar pool harus > viewport + 1 sel, kalau tidak kartu "muncul" di tengah layar saat wrap.
- R06a menulis follow 0.12 per frame tanpa `dt` dan tidak punya reduced-motion. Tanpa antrian load dari tengah, foto di tepi ikut menghabiskan bandwidth duluan.

### `wheel-drag-shelf` — Rak objek tanpa ujung (wheel + drag + spring)
**Sumber:** R07, R06a, R11 · **Mode:** A+B · **Tingkat berat:** CSS (label 3D R07: WebGL opsional)\
**Kapan dipakai:** katalog produk/kemasan/buku/vinyl sebagai hero satu layar (R07: rak toples miring di homepage), atau carousel foto yang bentuknya bereaksi ke kecepatan (R06a velocity reel). Rail (R11) sebagai kontrol kedua untuk lompat cepat.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `input` | wheel ×1.15, drag ×1.5, lempar `clamp(v, ±3.5 px/ms)·1.5·190`; smoothing 11/s saat drag, 2.3/s idle (R07) | 2–12 /s | jarak gerak per input; idle lambat = rak meluncur lama |
| `itemSpring` | stiffness `70·(0.85 + 0.3·frac(i·0.618))`, damping 9 | — | kekakuan beda per item, tidak serempak |
| `shape` | scale 0.55 → 1.35 `sin(π·x)`, wobble ±18° periode 3 slot, brightness 0.7 → 1.1 | — | tampilan rak |
| `snap` | setelah 10 frame tanpa input, 0.14/frame (R06a; R07 tidak snap) | 0.15–0.25 s | berhenti tepat di satu item |

**Resep:**
1. Markup `.shelf (touch-action: pan-y) > .track (rotate 10deg) > a.shelf-item × N`, 4 slot per layar (3 di mobile), duplikasi data sampai ≥ 8 item.
2. Input menulis `target`; `H` mengejar dengan `damp`. Tiap item: wrap modulo, bentuk dari posisi, lean dari kecepatan lewat spring per item. Rail (R11): strip tipis dengan `bindDrag`, posisi pointer di rail → `target = −(x/railW)·loop`.
3. Label yang berputar di permukaan toples (R07: satu WebGL renderer offscreen untuk semua item) hanya kalau benar-benar perlu. Versi ringan: label sudah dicetak di gambar.

```js
import { defineSection, damp, createSpring, clamp, followToLambda } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-shelf]'), ({ el, reduced, small }) => {
  const items = [...el.querySelectorAll('.shelf-item')].map((node, i) => ({ node, lean: createSpring({ stiffness: 70 * (0.85 + 0.3 * ((i * 0.618) % 1)), damping: 9 }) }));
  let vw = 0, spacing = 1, loop = 1, H = 0, target = 0, held = false, idle = 0;
  const measure = () => { vw = el.clientWidth; spacing = (vw / (small ? 3 : 4)) * 0.92; loop = items.length * spacing; };
  bindDrag(el, {
    onStart: () => { held = true; },
    onMove: (dx) => { target += dx * 1.5; idle = 0; },
    onEnd: (v) => { held = false; target += clamp(v.x / 1000, -3.5, 3.5) * 1.5 * 190; },   // lempar (R07)
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault(); idle = 0; target -= (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.15;
  }, { passive: false });
  measure();
  return {
    onResize: measure,
    update(dt) {
      if (!held && (idle += dt) > 0.17) target = damp(target, Math.round(target / spacing) * spacing, followToLambda(0.14), dt);
      const prev = H; H = damp(H, target, held ? 11 : 2.3, dt);
      const vel = (H - prev) / dt, speed01 = clamp(Math.abs(vel) / 2400);
      items.forEach((it, i) => {
        const x = ((((i * spacing + H) % loop) + loop) % loop) - spacing;      // wrap tanpa ujung
        const q = x / vw, mid = q >= 0 && q <= 1 ? Math.sin(q * Math.PI) : 0;
        const wobble = reduced ? 0 : Math.sin(((i * spacing + H) / (3 * spacing)) * 2 * Math.PI) * 18;
        it.lean.set(-Math.sign(vel) * speed01 * 6);
        const lean = reduced ? 0 : it.lean.step(dt);
        it.node.style.transform = `translate3d(${x}px,0,0) rotate(${wobble + lean}deg) scale(${0.55 + mid * 0.8})`;
        it.node.style.filter = `brightness(${0.7 + mid * 0.4})`;
      });
    },
  };
});
```

**Touch, keyboard & reduced-motion:** drag jalan di touch (R07); hover-spin label dan tarikan kursor dimatikan di touch. Keyboard: ←/→ = `target ∓ spacing`; item adalah link, saat fokus set `target` supaya item itu di tengah. Reduced: R07 hanya mematikan sebagian (twist label dan parallax). Lebih baik: tanpa wobble/lean, smoothing cepat, snap langsung.

**Jebakan:**
- R07 menulis `filter: blur() brightness()` per item per frame: repaint mahal. Blur per item hanya kalau item sedikit, atau pakai gambar yang sudah di-blur.
- R07 rAF jalan terus walau rak diam. Lewati penulisan DOM kalau kecepatan ≈ 0 dan spring settled.
- Wheel `preventDefault` hanya aman kalau halaman tidak punya scroll native di situ (homepage R07 satu layar). `touch-action: none` di rak horizontal membunuh scroll vertikal di HP; pakai `pan-y`.

### `drag-rotate` — Putar objek dengan drag lurus atau gerakan melingkar
**Sumber:** R11, R09, R06b, R01 · **Mode:** A · **Tingkat berat:** CSS / Canvas2D (3D model kalau objeknya GLB)\
**Kapan dipakai:** objek yang bisa diputar user (R11 kamera 3D, R09 ring foto mengorbit), atau carousel yang diputar dengan gerakan melingkar seperti memutar piringan (R06b spiral wind: 36 sampul vinyl, 12 per putaran).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `mode` | `linear` (dx → sudut, R11/R09) · `circular` (Δ`atan2`, dead zone 30 px, R06b) | — | jenis gesture |
| `coast` | τ 0.55 s (R06b) · damp 2.6/s ≈ τ 0.38 s, maks 9 rad/s (R11) | 0.3–0.6 s | lama meluncur setelah dilepas |
| `slot` / `lag` | 30° (12 per putaran), settle 0.6 s `outCubic` kalau < 40°/s; lag τ 0.06 s | 0 (bebas) / 15–45° | snap ke item, tampilan sedikit di belakang tangan |
| `reward` | 0.2 s setelah diam; spring k150 ζ0.5 (piringan keluar setengah, R06b) | — | detail yang muncul setelah berhenti |

**Resep:**
1. Satu nilai `angle` = satu sumber kebenaran, ditulis ke `--angle`; CSS (`rotate`, `rotateY`) atau scene 3D membacanya.
2. Linear: `angle += dx·degPerPx`. Melingkar: Δsudut `atan2` di-wrap ke ±180°, diabaikan di dead zone. Jeda > 80 ms sebelum lepas = tanpa lempar.
3. Coast `vel *= exp(−dt/τ)`; di bawah 40°/s settle ke slot terdekat, lalu kirim `rotate:rest` untuk reward. Wheel (R06b): `angle += deltaY·0.12`, settle setelah debounce 160 ms.

```js
import { defineSection, damp, ease, clamp } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-rotate]'), ({ el, reduced }) => {
  const CIRC = el.dataset.rotate === 'circular', SLOT = +el.dataset.slot || 0, COAST = CIRC ? 0.55 : 0.38;
  let angle = 0, shown = 0, vel = 0, last = 0, lt = 0, held = false, settle = null;
  const polar = (e) => { const b = el.getBoundingClientRect(), x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2; return [Math.atan2(y, x), Math.hypot(x, y)]; };
  const settleTo = (to) => { settle = { from: angle, to, t: 0 }; vel = 0; };
  const snap = () => SLOT && settleTo(Math.round(angle / SLOT) * SLOT);
  bindDrag(el, {
    onStart: (e) => { held = true; settle = null; vel = 0; [last] = polar(e); lt = performance.now(); },
    onMove: (dx, _dy, e) => {
      let d = dx * 0.35;                                                  // linear: 0.35°/px
      if (CIRC) { const [a, r] = polar(e); d = r < 30 ? 0 : (Math.atan2(Math.sin(a - last), Math.cos(a - last)) * 180) / Math.PI; last = a; }
      const now = performance.now(); vel = d / Math.max((now - lt) / 1000, 1 / 120); lt = now; angle += d;
    },
    onEnd: () => { held = false; vel = performance.now() - lt > 80 || reduced ? 0 : clamp(vel, -515, 515); if (Math.abs(vel) < 40) snap(); },
  });
  el.addEventListener('keydown', (e) => {                                // panah = satu slot
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], step = SLOT || 15;
    if (k) { e.preventDefault(); settleTo((Math.round(angle / step) + k) * step); }
  });
  return {
    update(dt) {
      if (settle) {
        settle.t = Math.min(1, settle.t + dt / (reduced ? 1e-3 : 0.6));
        angle = settle.from + (settle.to - settle.from) * ease.outCubic(settle.t);
        if (settle.t === 1) { settle = null; el.dispatchEvent(new Event('rotate:rest')); }
      } else if (!held && vel) { angle += vel * dt; vel *= Math.exp(-dt / COAST); if (Math.abs(vel) < 40) { vel = 0; snap(); } }
      shown = damp(shown, angle, reduced ? 1e3 : 1 / 0.06, dt);
      el.style.setProperty('--angle', `${shown.toFixed(2)}deg`);
    },
  };
});
```

**Touch, keyboard & reduced-motion:** jalur pointer sama untuk touch; `touch-action: none` hanya di objeknya, bukan seluruh section. Keyboard: panah = satu slot (R06b); objek `tabindex="0"` + `aria-label`. Reduced: tanpa coast, langsung snap, tanpa idle drift (R11/R09 punya drift sinus pelan saat idle).

**Jebakan:**
- R01: `camera-controls` model-viewer aktif tapi loop menulis `cameraOrbit` tiap frame, jadi drag user ditimpa. Satu pemilik sudut.
- Δ`atan2` tanpa wrap ke ±180° = lonjakan hampir 360° saat tangan melewati sisi kiri.
- Gesture melingkar perlu onboarding: R06b menampilkan cincin panduan dengan tick per sampul dan titik di sudut tangan. Untuk sedikit item, CSS `rotateY` + `perspective` lebih sederhana dari perspektif Canvas 2D yang dipotong 12 strip (R06b).

### `throwable-cards` — Kartu yang bisa diangkat dan dilempar
**Sumber:** R06b, R13 · **Mode:** A (B sebagai landing "meja kerja") · **Tingkat berat:** CSS (R06b: Canvas2D)\
**Kapan dipakai:** moodboard, foto tim, kartu testimonial berserakan di meja. Dipegang di titik mana pun, berayun seperti kertas yang dipegang di pojok, dilempar, melambat karena friksi, memantul di tepi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `slideTau` / `spinTau` | 0.42 s / 0.38 s | 0.3–0.6 s | lama meluncur dan berputar |
| `restitution` | 0.5 (normal), friksi dinding 0.3 | 0.3–0.7 | membal di tepi + spin dari friksi |
| `swing` | 0.9/frame × (jarak grip / setengah ukuran), mati kalau grip < 6%; throw: R13 mengalikan kecepatan 0.45 | 0.6–0.95 | badan tertinggal di belakang titik pegang |
| `lift` | naik 0.18 s, turun 0.3 s, scale +3.5%, bayangan 4 → 18 px; ukuran min(W,H)×0.27 (0.42 kalau W < 600) | — | rasa terangkat |

**Resep:**
1. Pointerdown: ubah titik tekan ke koordinat lokal kartu (rotasi terbalik), naikkan `z-index`, class `is-lifted` (CSS `scale: 1.035` + `drop-shadow`, transisi 0.18 s / 0.3 s).
2. Saat dipegang: putar kartu supaya titik grip ada di depan arah gerak, lalu paksa grip tepat di bawah tangan. Lepas: integrasi bebas dengan decay `exp(−dt/τ)`.
3. Dinding: impulse restitusi 0.5 + impulse friksi tangensial; friksi inilah yang menghasilkan spin. R06b memakai titik kontak di sudut yang paling menembus; di sini di tengah sisi — jauh lebih pendek, tetap meyakinkan. Event `impact` untuk glow 1.1 s (160 → 1700 px/s) dan squash (k900 ζ0.3, maks 0.04).

```js
import { defineSection } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';
defineSection(document.querySelector('[data-light-table]'), ({ el, reduced }) => {
  const W = el.clientWidth, H = el.clientHeight, S = Math.min(W, H) * (W < 600 ? 0.42 : 0.27), h = S / 2, I = (S * S) / 6; let z = 1;  // I: momen inersia persegi
  const cards = [...el.querySelectorAll('.print')].map((node) => ({ node, x: h + Math.random() * (W - S), y: h + Math.random() * (H - S), a: Math.random() - 0.5, vx: 0, vy: 0, va: 0, g: null, hx: 0, hy: 0 }));
  cards.forEach((c) => bindDrag(c.node, { slop: 0,
    onStart: (e) => { const b = el.getBoundingClientRect(), dx = (c.hx = e.clientX - b.left) - c.x, dy = (c.hy = e.clientY - b.top) - c.y, co = Math.cos(c.a), si = Math.sin(c.a);
      c.g = { lx: dx * co + dy * si, ly: -dx * si + dy * co }; c.node.style.zIndex = ++z; c.node.classList.add('is-lifted'); },   // titik pegang lokal
    onMove: (dx, dy) => { c.hx += dx; c.hy += dy; },
    onEnd: (v) => { c.g = null; c.node.classList.remove('is-lifted'); [c.vx, c.vy, c.va] = reduced ? [0, 0, 0] : [v.x, v.y, c.va]; },
  }));
  const bounce = (c, nx, ny) => {                             // n = normal dinding ke dalam meja
    const vn = c.vx * nx + c.vy * ny; if (vn >= 0) return;
    const jx = -0.3 * (c.vx - vn * nx), jy = -0.3 * (c.vy - vn * ny);           // friksi tangensial 0.3
    c.vx += -1.5 * vn * nx + jx; c.vy += -1.5 * vn * ny + jy; c.va += (-nx * h * jy + ny * h * jx) / I;   // restitusi 0.5, r × J → spin
    c.node.dispatchEvent(new CustomEvent('impact', { detail: -vn }));
  };
  return {
    update(dt) {
      for (const c of cards) {
        if (c.g) {                                            // swing: badan tertinggal di belakang titik pegang
          const len = Math.hypot(c.g.lx, c.g.ly), a0 = c.a, want = Math.atan2(c.y - c.hy, c.x - c.hx), now = Math.atan2(c.g.ly, c.g.lx) + c.a + Math.PI;
          if (len > S * 0.06) c.a += Math.atan2(Math.sin(want - now), Math.cos(want - now)) * (1 - Math.pow(1 - 0.9 * Math.min(1, len / h), dt * 60));
          const co = Math.cos(c.a), si = Math.sin(c.a);
          c.x = c.hx - (c.g.lx * co - c.g.ly * si); c.y = c.hy - (c.g.lx * si + c.g.ly * co); c.va = (c.a - a0) / dt;
        } else {
          const f = Math.exp(-dt / 0.42); c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.va * dt; c.vx *= f; c.vy *= f; c.va *= Math.exp(-dt / 0.38);
          if (c.x < h) { c.x = h; bounce(c, 1, 0); } if (c.x > W - h) { c.x = W - h; bounce(c, -1, 0); }
          if (c.y < h) { c.y = h; bounce(c, 0, 1); } if (c.y > H - h) { c.y = H - h; bounce(c, 0, -1); }
        }
        c.node.style.transform = `translate3d(${c.x - h}px,${c.y - h}px,0) rotate(${c.a}rad)`;
      }
    },
  };
});
```

**Touch, keyboard & reduced-motion:** satu pointer per kartu sudah cukup (R06b tidak mendukung multi-touch throw). `touch-action: none` di kartu saja, bukan di meja, supaya area kosong tetap bisa di-scroll. Keyboard: kartu `tabindex="0"`, panah geser 40 px, Enter = ke paling atas; sediakan juga versi daftar biasa. Reduced: drag tetap jalan, tanpa lempar, ayun, dan squash.

**Jebakan:**
- Kalau "angkat" dibuat dengan clone `position: fixed`, clone itu memblok klik ke elemen di bawahnya. Clone wajib `pointer-events: none`, atau angkat elemen aslinya seperti di atas.
- `box-shadow` blur besar per frame itu mahal. R06b memakai satu sprite bayangan yang di-blur sekali; di DOM, kasih `filter` hanya ke kartu yang sedang diangkat.
- Snippet menghitung W/H sekali. Saat resize, hitung ulang dan clamp posisi kartu, kalau tidak kartu tertinggal di luar meja.

### `draw-to-reveal-trail` — Menggambar jalur yang memunculkan foto
**Sumber:** R06b · **Mode:** A (B sebagai landing instalasi) · **Tingkat berat:** Canvas2D/SVG\
**Kapan dipakai:** hero atau section playground di mana user menggambar garis dan foto/kata/ikon bermunculan di sepanjang jalur, diwarnai sesuai posisi layar, lalu hilang berurutan.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `spacing` / `size` | 0.55–0.85 × ukuran foto (gap pertama 16 px); 100 px × acak 0.3–1.5 × `clamp(min(W,H)/800, 0.55, 1)` | 30–150 px | kerapatan + variasi ukuran |
| `hue` | `215 + 175·x/W + 50·(y/H − 0.5)` (biru kiri → oranye kanan) | — | warna dari posisi |
| `life` | grow 0.5 s `outCubic` (0.2 → 1), tahan sampai 1 s, go 0.5 s; garis 1.2 px pudar 1.25 s | — | umur tiap foto |
| `maxItems` | 240 (ring buffer) | 120–300 | batas memori |

**Resep:**
1. `bindDrag` dengan `slop: 0`. Titik baru hanya kalau bergerak ≥ 2 px; akumulasi panjang, setiap lewat `gap` spawn satu foto, digeser tegak lurus jalur ±0.12·size dan diputar mengikuti arah garis (dilipat ke ±90°) × 0.25 ± 0.22 rad.
2. Tint **sekali saat spawn** ke canvas ≤ 240 px (`globalCompositeOperation = 'color'`, alpha 0.8). Hilang berurutan gratis karena umur dihitung dari waktu lahir. Garis pena: simpan titik + waktu, pangkas dari depan, gambar dengan alpha `0.5·(1 − umur/1.25)`.
3. Wajib ada stroke demo otomatis (tangan hantu di Fondasi) supaya section tidak kosong saat pertama dibuka.

```js
import { defineSection, lerp, clamp, ease } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';
defineSection(document.querySelector('[data-draw]'), ({ el }) => {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), imgs = [...el.querySelectorAll('img')], items = [];
  let W = 0, H = 0, dpr = 1, run = 0, gap = 16, n = 0, lx = 0, ly = 0, clock = 0;    // clock sendiri, bukan performance.now()
  const resize = () => { dpr = Math.min(devicePixelRatio, 2); W = el.clientWidth; H = el.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  const tinted = (img, size, hue) => {                       // tint SEKALI saat spawn, ke canvas ≤ 240 px
    const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = Math.min(240, Math.ceil(size * dpr));
    g.drawImage(img, 0, 0, c.width, c.height); g.globalCompositeOperation = 'color'; g.fillStyle = `hsl(${hue} 70% 50% / .8)`; g.fillRect(0, 0, c.width, c.height); return c;
  };
  const add = (x, y) => {
    const dx = x - lx, dy = y - ly, len = Math.hypot(dx, dy); if (len < 2) return;
    lx = x; ly = y; run += len; if (run < gap) return;
    const size = 100 * clamp(Math.min(W, H) / 800, 0.55, 1) * lerp(0.3, 1.5, Math.random()), off = 0.12 * size * (Math.random() * 2 - 1);
    let dir = Math.atan2(dy, dx); if (dir > Math.PI / 2) dir -= Math.PI; else if (dir < -Math.PI / 2) dir += Math.PI;
    const img = tinted(imgs[n++ % imgs.length], size, 215 + (175 * x) / W + 50 * (y / H - 0.5));
    items.push({ x: x - (dy / len) * off, y: y + (dx / len) * off, size, img, born: clock, rot: dir * 0.25 + 0.22 * (Math.random() * 2 - 1) });
    if (items.length > 240) items.shift();
    run = 0; gap = size * lerp(0.55, 0.85, Math.random());
  };
  const local = (e) => { const b = el.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  bindDrag(cv, { slop: 0, onStart: (e) => { [lx, ly] = local(e); run = 0; gap = 16; }, onMove: (_x, _y, e) => add(...local(e)) }); resize();
  return {
    onResize: resize,
    update(dt) {
      clock += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      while (items.length && clock - items[0].born > 1.5) items.shift();
      for (const it of items) {                               // grow 0.5 s → tahan → go 0.5 s (mulai di 1 s)
        const age = clock - it.born, k = age < 0.5 ? lerp(0.2, 1, ease.outCubic(age / 0.5)) : age < 1 ? 1 : 1 - ease.outCubic((age - 1) / 0.5);
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(k, k); ctx.globalAlpha = clamp(k * 1.6);
        ctx.drawImage(it.img, -it.size / 2, -it.size / 2, it.size, it.size); ctx.restore();
      }
    },
  };
});
```

**Touch, keyboard & reduced-motion:** touch lewat jalur yang sama; `touch-action: none` di canvas, jadi beri ruang scroll di luar canvas. Konten foto juga tersedia sebagai galeri biasa di DOM (canvas `aria-hidden`). Reduced: foto muncul tanpa grow (k = 1) dan hilang dengan fade singkat; tetap boleh karena digerakkan user.

**Jebakan:**
- Umur item dari `performance.now()`: setelah tab kembali aktif, semua item hilang sekaligus (R06b sampai menggeser timestamp kalau jeda frame > 100 ms). Clock dari `dt` yang di-clamp ticker menyelesaikannya.
- Tint atau blur per frame per foto = frame drop. Rasterisasi sekali saat spawn.
- Loop menggambar terus walau kosong. Kalau `items` kosong dan garis habis, lewati `clearRect` setelah satu frame bersih.

### `plucked-string-type` — Tipografi kawat yang bisa dipetik
**Sumber:** R06b · **Mode:** A (B sebagai intro type foundry) · **Tingkat berat:** Canvas2D/SVG\
**Kapan dipakai:** wordmark hero atau footer brand yang hurufnya digambar sebagai garis tunggal. Pointer pelan mendorong huruf (pakai `proximity-spring`), pointer cepat memetik kawat yang bergetar lalu meluruh.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `letterSpring` | k 160, ζ 0.2; tolak 8000·(1−r/R)², R = 1.125 × huruf; knock ×2.2 | — | huruf menyingkir saat pointer pelan |
| `slip` / `freq` | `min(panjang × 0.34, huruf × 0.4)`; `clamp(360 / panjang_px, 2, 5.5)` Hz | 0.25–0.4 | kawat lepas dari jari; kawat pendek bergetar lebih cepat |
| `ring` | mode ke-n `exp(−t·n²/0.95)`, 4 mode; berhenti kalau fundamental < 0.12 px | τ 0.6–1.2 s | lama getaran |
| `color` | energi → 5 level × 24 bucket hue (hue = x × 300°) | — | kawat yang bergetar berwarna |

**Resep:**
1. Glyph didefinisikan sebagai daftar `line`/`arc` (unit em), bukan dari font file; batasi ke huruf yang dipakai, sampling tiap ±6 px.
2. Tiap frame, segmen gerak pointer (frame lalu → sekarang) diuji **segment–segment intersection** dengan tiap kawat. Saat dipegang, bentuk kawat = segitiga lembut di titik pegang; saat lepas, bentuk diproyeksikan ke 4 mode sinus.
3. Gambar: titik_i = dasar_i + normal × `offset(u)`. Kawat berwarna sama digabung ke satu `Path2D`, `stroke()` sekali (R06b ≤ ±120 stroke per frame). "Pelan = miring, cepat = petik" muncul sendiri karena gaya tolak huruf besar.

```js
import { clamp } from './motion-core.js';

const shape = (t, u) => (u <= t ? Math.sin((Math.PI / 2) * (u / t)) : Math.sin((Math.PI / 2) * ((1 - u) / (1 - t))));
const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
export function createWire(A, B, letterSize) {                     // A, B = {x, y} ujung kawat (px)
  const len = Math.hypot(B.x - A.x, B.y - A.y), nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
  const freq = clamp(360 / len, 2, 5.5), seg = Math.max(10, Math.round(len / 6)), slip = Math.min(len * 0.34, letterSize * 0.4);
  let held = null, amp = [0, 0, 0, 0], since = 0;
  const w = { nx, ny, seg,
    pointer(p0, p1, clock) {                                      // segmen gerak pointer frame ini
      if (!held && side(A, B, p0) * side(A, B, p1) < 0 && side(p0, p1, A) * side(p0, p1, B) < 0) held = { t: 0.5, d: 0 };
      if (!held) return;
      const u = ((p1.x - A.x) * (B.x - A.x) + (p1.y - A.y) * (B.y - A.y)) / (len * len);
      held.t = clamp(u, 0.05, 0.95); held.d = (p1.x - A.x) * nx + (p1.y - A.y) * ny;
      if (u < 0.05 || u > 0.95 || Math.abs(held.d) > slip) w.release(clock);   // slip
    },
    release(clock) {                                              // proyeksi ke 4 mode sinus (trapesium)
      if (!held) return;
      amp = [1, 2, 3, 4].map((n) => { let s = 0;
        for (let i = 0; i <= seg; i++) { const u = i / seg; s += (i % seg ? 1 : 0.5) * held.d * shape(held.t, u) * Math.sin(n * Math.PI * u); }
        return (2 * s) / seg; });
      held = null; since = clock;
    },
    offset(u, clock) {                                            // simpangan normal di u (0..1)
      if (held) return held.d * shape(held.t, u);
      const t = clock - since; let y = 0;
      for (let n = 1; n <= 4; n++) y += amp[n - 1] * Math.cos(2 * Math.PI * n * freq * t) * Math.exp((-t * n * n) / 0.95) * Math.sin(n * Math.PI * u);
      return y;
    },
    energy: (clock) => (held ? Math.abs(held.d) : Math.abs(amp[0]) * Math.exp(-(clock - since) / 0.95)),  // < 0.12 = diam
  };
  return w;
}
```

**Touch, keyboard & reduced-motion:** di desktop hover cukup; di touch kawat hanya dipetik saat jari menekan (R06b mengecek `buttons`). Teks asli wajib ada di DOM (heading visually-hidden) karena canvas tidak terbaca screen reader. Reduced: huruf statis (offset 0), tanpa getaran dan warna energi.

**Jebakan:**
- Tanpa gaya tolak huruf yang kuat, setiap lintasan pelan juga memetik dan efeknya jadi berisik.
- Oscillator inersia di frekuensi tinggi meledak kalau `ω·dt` besar. R06b men-substep sampai `ω·dt ≤ 0.3`.
- Butuh definisi glyph single-stroke sendiri. Masukkan waktu desain ini ke estimasi.

### `semantic-zoom` — Mosaik yang di-zoom sampai jadi foto
**Sumber:** R06b · **Mode:** A+B · **Tingkat berat:** Canvas2D\
**Kapan dipakai:** arsip foto besar yang dari jauh membentuk satu gambar (32 × 32 sel warna). Zoom in = sel berubah jadi foto, tint memudar, lalu judul muncul. Mode B cocok sebagai homepage arsip atau view "all projects".

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `lag` / `glide` | τ 0.12 s, skala di-follow di **log space**; pan `v *= exp(−dt/0.35)` | 0.08–0.2 s / 0.25–0.5 s | zoom terasa rata di semua level; luncuran setelah pan |
| `wheel` | `scale *= exp(−deltaY·0.0016)`; pinch trackpad (`ctrlKey`) 0.012 | — | sensitivitas zoom |
| `limits` | sel min = min(W,H)/32 × 0.9 · sel max = min(W,H) × 0.86 | — | seluruh mosaik muat ↔ satu foto hampir penuh |
| `lod` | foto 22 → 64 px, tint 0.55 hilang 40 → 200, judul 260 → 420, hi-res > 600; double-tap fly 0.9 s | — | apa yang tampil di ukuran sel tertentu |

**Resep:**
1. Peta mosaik dibuat sekali: gambar sumber di-`drawImage` ke 32 × 32, tiap piksel pilih satu dari 4 foto dengan tone rata-rata terdekat (tone 3 warna per foto di-precompute saat build).
2. `zoomAt(sx, sy, f)` menjaga titik world di bawah kursor tetap di tempat. Pinch: dua pointer di `Map`, rasio jarak = zoom, midpoint = pan. Satu pointer = pan 1:1.
3. Render hanya sel yang terlihat (cull lewat rentang index); opacity tiap lapis dari `mapRange(ukuranSel, a, b)`. Foto on-demand 3 tingkat (96 px → small > 200 → large > 600). Double-tap: tween 0.9 s `inOutCubic` di log(scale) ke sel × 0.8 max, atau keluar kalau sudah > max × 0.5.

```js
import { defineSection, clamp, mapRange } from './motion-core.js';

defineSection(document.querySelector('[data-mosaic]'), ({ el, reduced }) => {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), N = 32, pts = new Map();
  let W = 0, H = 0, minS = 1, maxS = 1, s = 1, ts = 1, cx = N / 2, cy = N / 2, tcx = cx, tcy = cy, pinch = 0;
  const resize = () => { W = cv.width = el.clientWidth; H = cv.height = el.clientHeight;
    minS = (Math.min(W, H) / N) * 0.9; maxS = Math.min(W, H) * 0.86; ts = s = clamp(s, minS, maxS); };
  const zoomAt = (sx, sy, f) => {                          // s = px per sel; world unit = 1 sel
    const wx = (sx - W / 2) / ts + tcx, wy = (sy - H / 2) / ts + tcy;
    ts = clamp(ts * f, minS, maxS); tcx = wx - (sx - W / 2) / ts; tcy = wy - (sy - H / 2) / ts;
  };
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); });
  el.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId); if (!prev) return;
    pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d;
    } else { tcx -= (e.offsetX - prev[0]) / ts; tcy -= (e.offsetY - prev[1]) / ts; cx = tcx; cy = tcy; }   // pan 1:1
  });
  const end = (e) => { pts.delete(e.pointerId); pinch = 0; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); resize();
  return {
    onResize: resize,
    update(dt) {
      const k = reduced ? 1 : 1 - Math.exp(-dt / 0.12);
      s = Math.exp(Math.log(s) + (Math.log(ts) - Math.log(s)) * k);   // follow skala di log space
      cx += (tcx - cx) * k; cy += (tcy - cy) * k;
      const lod = { photo: mapRange(s, 22, 64), tint: 0.55 * (1 - mapRange(s, 40, 200)), label: mapRange(s, 260, 420) };
      drawVisibleCells(ctx, { W, H, s, cx, cy, N, lod });          // tulis sendiri: loop hanya index sel di dalam layar
    },
  };
});
```

**Touch, keyboard & reduced-motion:** pinch dua jari lewat pointer, `touch-action: none` mencegah browser zoom; Safari trackpad butuh `gesturestart/gesturechange` tambahan. Keyboard (tidak ada di R06b): `+`/`−` = `zoomAt(tengah, 1.25)`, panah = pan satu sel, Enter = fly ke sel tengah. Reduced: tanpa lag dan glide, fly jadi lompat instan.

**Jebakan:**
- Follow skala secara linear (bukan log) membuat zoom lambat di awal lalu ngebut di akhir.
- Tanpa koreksi `zoomAt`, mosaik "lari" dari kursor saat di-zoom.
- Tanpa clamp center, user bisa kehilangan mosaik di luar layar. R06b: kalau mosaik lebih kecil dari layar, kunci ke tengah; kalau lebih besar, boleh lewat 0.3 sel dari tepi.

### `physics-drop-field` — Klik menjatuhkan benda yang menumpuk
**Sumber:** R14, R07 · **Mode:** A+B · **Tingkat berat:** CSS + Matter.js (DOM digerakkan body fisika)\
**Kapan dipakai:** section penutup/footer playground: tiap klik menjatuhkan satu "chip" (potongan visual dari halaman itu sendiri) yang menumpuk (R14). Atau loader/aksen brand: ilustrasi buah berjatuhan dan bertumpuk (R07).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `body` | restitution 0.15, friction 0.4, frictionAir 0.01 (R14) · restitution 0.03, friction 0.82 (R07) | — | membal vs berat dan lengket |
| `gravity` | 1, scale 0.001 (R14) · 3.35–3.5 (R07 loader/hover) | 1–5 | kecepatan jatuh |
| `spawn` | titik klik, naik 0.35 × tinggi chip, sudut ±0.2 rad, ukuran `w × 0.5 × innerWidth/1440`; maks 30 body FIFO | 20–60 body | posisi, ukuran, batas (> 60: `enableSleeping`) |
| `scrollFlip` | kecepatan scroll > 0.15 vh/s → gravity −0.2 | — | chip melayang saat scroll cepat (tanpa atap → dibuang) |

**Resep:**
1. Muat Matter.js 0.20.0. Satu engine per field, **tanpa `Runner`**: di-step dari `update(dt)` supaya satu clock dengan halaman dan otomatis pause di luar layar. Batas: lantai + 2 dinding tinggi 3×, **tanpa atap**, dibangun ulang saat resize.
2. Klik → chip acak, body (rect / circle / `fromVertices`) + `<img>` dengan origin di tengah. Tiap frame `Engine.update(engine, min(dt, 32 ms))`, lalu tulis `translate + rotate` body ke DOM. CSS: field `position: relative; overflow: hidden; touch-action: manipulation`, chip `position: absolute; left: 0; top: 0; pointer-events: none`.
3. Varian handoff (R14): kartu dari section sebelumnya mengecil lewat scroll lalu diserahkan ke engine sebagai body dengan kecepatan visual terakhirnya; saat scroll balik, body disetir ke lintasan (`setVelocity` ke target, `angle *= 0.75`) lalu dilepas. Varian R07: collider dari hull titik path SVG, gravity 3.35, dipicu load/hover.

```js
import { defineSection } from './motion-core.js';
const { Engine, Bodies, Body, Composite } = window.Matter;     // <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js">
defineSection(document.querySelector('[data-drop-field]'), ({ el, reduced }) => {
  const engine = Engine.create(), CHIPS = JSON.parse(el.dataset.chips), chips = []; let walls = [], lastY = scrollY;  // CHIPS: [{src, w, h, round?}] px artboard 1440
  const build = () => {                                       // lantai + 2 dinding tinggi, TANPA atap
    const w = el.clientWidth, h = el.clientHeight, S = { isStatic: true };
    Composite.remove(engine.world, walls);
    walls = [Bodies.rectangle(w / 2, h + 100, w + 400, 200, S), Bodies.rectangle(-100, h / 2, 200, h * 3, S), Bodies.rectangle(w + 100, h / 2, 200, h * 3, S)];
    Composite.add(engine.world, walls);
  };
  const kill = (c) => { Composite.remove(engine.world, c.body); c.node.remove(); chips.splice(chips.indexOf(c), 1); }; build();
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect(), sc = r.width / el.clientWidth, x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;   // aman walau parent di-scale
    const c = CHIPS[(Math.random() * CHIPS.length) | 0], k = (0.5 * innerWidth) / 1440, w = c.w * k, h = c.h * k, opt = { restitution: 0.15, friction: 0.4, frictionAir: 0.01 };
    const body = c.round ? Bodies.circle(x, y - h * 0.35, w / 2, opt) : Bodies.rectangle(x, y - h * 0.35, w, h, opt);
    const node = Object.assign(new Image(), { src: c.src, alt: '', className: 'chip' });
    Object.assign(node.style, { width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px` });
    Body.setAngle(body, (Math.random() - 0.5) * 0.4); el.append(node); Composite.add(engine.world, body); chips.push({ node, body });
    if (chips.length > 30) kill(chips[0]);                                       // FIFO
    if (reduced) for (let i = 0; i < 240; i++) Engine.update(engine, 16);         // reduced: langsung diam
  });
  return {
    onResize: build,
    update(dt) {
      const dy = Math.abs(scrollY - lastY), speed = dy > innerHeight ? 0 : dy / Math.max(dt, 0.004) / innerHeight; lastY = scrollY;  // abaikan loncatan saat section masuk lagi
      engine.gravity.y = !reduced && speed > 0.15 ? -0.2 : 1;
      Engine.update(engine, Math.min(dt * 1000, 32));
      for (const c of [...chips]) {
        const { x, y } = c.body.position;
        if (y < -el.clientHeight) kill(c);                                       // terbang keluar atas
        else c.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${c.body.angle}rad)`;
      }
    },
  };
});
```

**Touch, keyboard & reduced-motion:** R14 desktop-only (splash di ≤ 767 px). `pointerdown` sudah jalan di touch; `touch-action: manipulation` menjaga scroll tetap hidup, chip minimum ±48 px. Keyboard: tombol "Drop" yang men-spawn di x acak. Reduced: R14 tidak punya cabang reduced; pre-simulasi ±240 step supaya chip langsung diam, tanpa gravity flip, tanpa kedip teks. R07 mengganti fisika dengan susunan statis.

**Jebakan:**
- Kecepatan scroll diukur dari posisi terakhir yang bisa basi saat field aktif lagi, jadi frame pertama terbaca sebagai scroll super cepat (gravity terbalik sekejap). R14 sendiri mencatat: ukur sebelum early-return.
- `fromVertices` memusatkan body di centroid. Simpan offset centroid → pusat gambar dan putar sesuai sudut body, kalau tidak gambar dan collider tidak pas.
- Layer teks di atas field wajib `pointer-events: none` supaya klik tembus. Chip yang sudah ada tidak ikut di-rescale saat resize (R14).

### `verlet-rope` — Kartu tergantung di tali
**Sumber:** R13, R06a · **Mode:** A · **Tingkat berat:** Canvas2D/SVG (R13: 3D dengan Three.js)\
**Kapan dipakai:** ID card/lanyard di halaman about atau studio, tag yang menggantung, lampu dengan kabel. Ditarik, dilempar, berayun, dan di HP bisa ikut kemiringan device.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `step` / `gravity` | 1/120 s fixed, maks 8 substep/frame; 34 unit/s² (≈ 3400 px/s² kalau 1 unit = 100 px), ayun ≈ 2.5 s | — | stabil di 60/120 Hz; berat ayunan |
| `damp` / `vmax` / `iters` | 0.988 per step / 0.14 unit (14 px) per step / 10 | 0.98–0.995 / — / 6–14 | redaman, batas kecepatan, kekakuan solver |
| `rope` | seg 0.22 unit (22 px), ±10–14 partikel; stretch 0.9, bend 0.35 | bend 0 = tali, 1 = batang | kelenturan |
| `drag` | hold 0.55, follow 0.2, throw 0.45; idle breeze 0.0012, nudge 0.01 tiap 8 s | — | "give" saat ditarik, lemparan kalem |

**Resep:**
1. Partikel `{x, y, px, py, w}` (`w = 0` = paku/kinematik). Verlet: kecepatan = posisi − posisi lama, × damp, clamp vmax, + gravitasi. Constraint jarak `{a, b, d, k}` diselesaikan 10 iterasi, dibagi menurut `w`. Tali: link i–i+1 (k 0.9) dan i–i+2 (k 0.35).
2. Kartu versi ringan: elemen DOM (`transform-origin: 50% 0; translate: -50% 0`) ditempel di partikel terakhir, diputar sesuai arah segmen terakhir. R13 memakai 6 partikel kartu dengan 15 constraint all-pairs supaya kartu jadi rigid body 3D.
3. Drag: partikel tangan kinematik disambung ke ujung tali (k 0.55), mengejar pointer dengan lerp 0.2 per step; lepas = kecepatan × 0.45. Varian angin (R06a): kursor lewat dalam 90–210 px dari partikel → `p.px -= vx·k` (di Verlet, menggeser posisi lama = menambah kecepatan).

```js
import { defineSection, lerp } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';
defineSection(document.querySelector('[data-lanyard]'), ({ el }) => {
  const rope = el.querySelector('path'), card = el.querySelector('.pass'), SEG = 22, G = 3400, DAMP = 0.988, VMAX = 14, STEP = 1 / 120;  // R13 × 100 px
  const P = (x, y, w = 1) => ({ x, y, px: x, py: y, w }), C = (a, b, k) => ({ a, b, k, d: Math.hypot(b.x - a.x, b.y - a.y) });
  const pts = Array.from({ length: 12 }, (_, i) => P(el.clientWidth / 2, i * SEG, i ? 1 : 0));   // pts[0] = paku
  const cons = pts.slice(1).flatMap((p, i) => [C(pts[i], p, 0.9), ...(pts[i + 2] ? [C(pts[i], pts[i + 2], 0.35)] : [])]);
  const hand = P(0, 0, 0), aim = { x: 0, y: 0 }; let grab = null, acc = 0;
  bindDrag(card, { slop: 0,
    onStart: (e) => { const b = el.getBoundingClientRect(); hand.x = aim.x = e.clientX - b.left; hand.y = aim.y = e.clientY - b.top;
      grab = C(hand, pts.at(-1), 0.55); grab.d = 0; cons.push(grab); },               // hold 0.55: ada "give"
    onMove: (dx, dy) => { aim.x += dx; aim.y += dy; },
    onEnd: () => { cons.splice(cons.indexOf(grab), 1); grab = null; for (const p of pts) { p.px = lerp(p.x, p.px, 0.45); p.py = lerp(p.y, p.py, 0.45); } },  // throw 0.45
  });
  const step = () => {
    if (grab) { hand.x = lerp(hand.x, aim.x, 0.2); hand.y = lerp(hand.y, aim.y, 0.2); }    // follow 0.2
    for (const p of pts) if (p.w) {
      const vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP, v = Math.hypot(vx, vy), s = v > VMAX ? VMAX / v : 1;
      p.px = p.x; p.py = p.y; p.x += vx * s; p.y += vy * s + G * STEP * STEP;
    }
    for (let i = 0; i < 10; i++) for (const c of cons) {
      const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, len = Math.hypot(dx, dy) || 1e-6, W = c.a.w + c.b.w; if (!W) continue;
      const f = ((len - c.d) / len) * c.k;
      c.a.x += (dx * f * c.a.w) / W; c.a.y += (dy * f * c.a.w) / W; c.b.x -= (dx * f * c.b.w) / W; c.b.y -= (dy * f * c.b.w) / W;
    }
  };
  return {
    update(dt) {
      acc = Math.min(acc + dt, 8 * STEP); while (acc >= STEP) { step(); acc -= STEP; }   // fixed step, maks 8, sisa dibuang
      rope.setAttribute('d', 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L'));
      const a = pts.at(-1), b = pts.at(-2); card.style.transform = `translate3d(${a.x}px,${a.y}px,0) rotate(${Math.atan2(a.y - b.y, a.x - b.x) - Math.PI / 2}rad)`;
    },
    renderStatic() {},                                        // reduced: kartu statis tergantung lurus (CSS)
  };
});
```

**Touch, keyboard & reduced-motion:** drag sama di touch; `touch-action: none` di kartu. Di HP R13 memutar arah gravitasi dari `devicemotion` (dead band 1.2 m/s², faktor tilt 0.16, low-pass 0.015; guncangan > 9 m/s² = impuls); iOS wajib `DeviceMotionEvent.requestPermission()` dari gesture (R13 memanggilnya saat jari diangkat). Keyboard: kartu `tabindex="0"`, Enter = flip / dorongan kecil (R13: klik < 6 px, < 320 ms = flip). Reduced: R13 tidak me-mount fisika sama sekali, hanya kartu statis.

**Jebakan:**
- Verlet dengan `dt` variabel meledak. Wajib fixed step + accumulator, dan batasi substep supaya tidak spiral of death setelah tab lag.
- Angka R13 dalam world unit. Di piksel, gravity dan vmax harus diskalakan (×100 di atas), kalau tidak tali jatuh terlalu lambat atau terlalu cepat.
- Polyline terlihat patah-patah. R13 menggambar ribbon Catmull-Rom 56 sampel; di SVG cukup kurva `Q` antar titik tengah.

### `tactile-feedback-kit` — Squash-stretch, click burst, platformer
**Sumber:** R08 · **Mode:** A+B · **Tingkat berat:** CSS\
**Kapan dipakai:** lapisan polish yang membuat situs terasa fisik dan playful: tombol yang gepeng lalu membal, gambar kecil yang meletup di titik klik, dan (bonus) karakter kecil yang bisa dijalankan dengan keyboard dan berdiri di atas elemen halaman.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `press` / `release` | 1.08 / 0.9, 0.14 s `power3.in` → 0.96 / 1.04 lalu `elastic.out(1.3, 0.3)` 0.45 s ≈ spring 600 / 11 (ζ ≈ 0.22) | ζ 0.15–0.35 | gepeng saat ditekan, membal saat dilepas |
| `burst` | scale 0 → 0.3–0.43, rotasi ±25°, `back.out(1.6)` 0.22 s lalu fade | — | letupan di titik klik |
| `walker` | jalan 320 px/s, lompat 760 px/s, gravitasi 2600 px/s², dt cap 1/30; flipbook 5 pose × 200 ms | — | platformer |
| `collision` | mask alpha 64 px (alpha ≥ 16 = solid), broadphase tiap 150 ms radius 320 px | — | berdiri di atas gambar PNG |

**Resep:**
1. Squash: dua spring lewat properti `scale` (bukan `transform`, supaya tidak bentrok dengan transform lain). Loop hidup hanya selama spring belum settled.
2. Burst: satu layer `position: fixed; inset: 0; pointer-events: none`; gambar dibuat di titik klik, dianimasikan WAAPI, lalu dihapus.
3. Platformer (opsional, desktop): WASD/panah + Space; collision per piksel dari alpha PNG objek yang dirotasi (un-rotate titik ke lokal pakai `DOMMatrix`, baca mask 64 px); kaki dicek di 3 titik (tengah ±35% lebar), grounded kalau ≥ 2 kena; objek yang diinjak bergerak → `x += cx_sekarang − cx_sebelumnya`. Tidak ditulis di snippet karena panjang.

```js
import { createSpring, ticker, reducedMotion } from './motion-core.js';

export function squash(btn) {                                   // ≈ R08 press 1.08/0.9 → elastic release
  const mk = () => createSpring({ stiffness: 600, damping: 11, value: 1 }), sx = mk(), sy = mk();
  let off = null;
  const run = () => { off ??= ticker.add((dt) => {
    btn.style.scale = `${sx.step(dt).toFixed(3)} ${sy.step(dt).toFixed(3)}`;
    if (sx.isSettled() && sy.isSettled()) { off(); off = null; btn.style.scale = ''; }   // loop berhenti sendiri
  }); };
  const press = () => { if (reducedMotion()) return; sx.set(1.08); sy.set(0.9); run(); };
  const release = () => { if (!off) return; sx.set(1); sy.set(1); sx.kick(-3); sy.kick(3); };   // lewat 0.96/1.04 lalu settle
  btn.addEventListener('pointerdown', press);
  ['pointerup', 'pointerleave', 'keyup'].forEach((t) => btn.addEventListener(t, release));
  btn.addEventListener('keydown', (e) => { if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) press(); });
}

export function clickBurst(layer, srcs) {                       // layer: fixed, inset 0, pointer-events none
  document.addEventListener('click', (e) => {
    if (reducedMotion() || e.detail === 0) return;              // detail 0 = klik dari keyboard
    const img = Object.assign(new Image(), { src: srcs[(Math.random() * srcs.length) | 0], alt: '' });
    const s = 0.3 + Math.random() * 0.13, r = `${(Math.random() * 2 - 1) * 25}deg`;
    img.style.cssText = `position:absolute;left:${e.clientX}px;top:${e.clientY}px;translate:-50% -50%`;
    layer.append(img);
    img.animate([
      { scale: 0, rotate: '0deg', opacity: 1, easing: 'cubic-bezier(.34,1.56,.64,1)' },   // ≈ back.out
      { scale: s, rotate: r, opacity: 1, offset: 0.4 },                                    // ±0.22 s
      { scale: s, rotate: r, opacity: 0 },
    ], { duration: 550 }).finished.then(() => img.remove());
  });
}
```

**Touch, keyboard & reduced-motion:** squash jalan di touch dan keyboard (Space/Enter). Burst juga jalan di tap; klik dari keyboard dilewati supaya tidak muncul di pojok kiri atas. Platformer hanya `pointer: fine` (R08 menampilkan animasi jalan statis di coarse) dan mengabaikan tombol kalau fokus ada di input atau overlay terbuka. Reduced: R08 mengecek di 21 tempat di JS: tanpa squash, tanpa burst, stick figure pose statis.

**Jebakan:**
- Squash lewat `transform` bentrok dengan hover `translateY` di tombol yang sama. Pakai properti `scale` terpisah. Burst tanpa `remove()` menumpuk elemen DOM selamanya.
- Flipbook dengan mengganti `src` berkedip di iOS. R08 menumpuk semua frame dan menulis opacity semuanya dalam satu pass.
- R08 membangun mask alpha platformer saat idle (`requestIdleCallback`), bukan saat load. Membangunnya di awal memperlambat first paint.
