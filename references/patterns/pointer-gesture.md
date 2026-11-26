# Pola Pointer, Gesture & Physics

Bab ini berisi pola interaksi yang digerakkan tangan user: kursor yang diikuti, elemen yang di-drag dan dilempar, gesture melingkar, menggambar, zoom, sampai fisika (spring, Verlet, rigid body, Matter.js). Semua angka diambil dari bedah R01–R16 dan semua resep ditulis ulang di atas `assets/starter/motion-core.js`, jadi satu clock, smoothing berbasis `dt`, dan section yang otomatis berhenti saat di luar layar.

Prinsipnya: pakai teknik paling ringan yang hasilnya sama. Kebanyakan pola di sini cukup DOM + CSS transform. WebGL dan library fisika hanya kalau memang tidak ada jalan lain.

## Daftar isi

| id | ringkas |
|---|---|
| [`fondasi`](#fondasi-dipakai-semua-pola) | Pointer Events satu jalur, `bindDrag`, konversi angka referensi, tangan hantu untuk demo |
| [`cursor-parallax-depth`](#cursor-parallax-depth--parallax-berlapis--objek-menoleh-ke-kursor) | Layer bergeser beda kedalaman + objek utama miring ke arah kursor |
| [`proximity-spring`](#proximity-spring--elemen-menghindar-atau-tertarik-ke-kursor) | Sticker/huruf/tombol menghindar atau tertarik ke kursor pakai spring |
| [`cursor-facing-rotators`](#cursor-facing-rotators--mata-panah--glyph-yang-menghadap-kursor) | Mata, panah, glyph yang berputar menghadap kursor |
| [`proximity-weight-field`](#proximity-weight-field--grid-huruf-yang-menebal-di-dekat-kursor) | Grid huruf variable font yang menebal + berubah warna dekat kursor |
| [`custom-cursor`](#custom-cursor--dot--bracket-label-tag-dan-lens-reveal) | Dot + bracket, label "Open", dan lens yang membuka layer lain |
| [`index-lens`](#index-lens--daftar-fisheye--poster-mengikuti-kursor) | Daftar judul yang membengkak di bawah kursor + poster yang mengikuti |
| [`cursor-scrub-video`](#cursor-scrub-video--video-yang-di-scrub-kursor) | Video all-intra yang `currentTime`-nya digerakkan kursor |
| [`cursor-wake-dwell`](#cursor-wake-dwell--riak-di-belakang-kursor--diam-untuk-membuka) | Tile terdorong jejak kursor, diam di atas tile = buka tanpa klik |
| [`infinite-drag-canvas`](#infinite-drag-canvas--dinding-kartu-tanpa-ujung) | Dinding kartu tanpa ujung, drag 1:1, lempar meluncur |
| [`wheel-drag-shelf`](#wheel-drag-shelf--rak-objek-tanpa-ujung-wheel--drag--spring) | Rak objek berputar tanpa ujung lewat wheel, drag, rail |
| [`drag-rotate`](#drag-rotate--putar-objek-dengan-drag-lurus-atau-gerakan-melingkar) | Putar objek dengan drag lurus atau gerakan melingkar, coast lalu snap |
| [`throwable-cards`](#throwable-cards--kartu-yang-bisa-diangkat-dan-dilempar) | Kartu foto yang dipegang di titik mana pun, dilempar, memantul |
| [`draw-to-reveal-trail`](#draw-to-reveal-trail--menggambar-jalur-yang-memunculkan-foto) | Menggambar garis yang memunculkan foto di sepanjang jalur |
| [`plucked-string-type`](#plucked-string-type--tipografi-kawat-yang-bisa-dipetik) | Huruf single-stroke yang kawatnya bisa dipetik |
| [`semantic-zoom`](#semantic-zoom--mosaik-yang-di-zoom-sampai-jadi-foto) | Mosaik 32×32 yang di-zoom (wheel/pinch) sampai tiap sel jadi foto |
| [`physics-drop-field`](#physics-drop-field--klik-menjatuhkan-benda-yang-menumpuk) | Klik = benda jatuh dan menumpuk (Matter.js), scroll cepat = melayang |
| [`verlet-rope`](#verlet-rope--kartu-tergantung-di-tali) | Kartu tergantung di tali Verlet, bisa ditarik dan dilempar |
| [`tactile-feedback-kit`](#tactile-feedback-kit--squash-stretch-click-burst-platformer) | Squash-stretch tombol, burst di titik klik, easter egg platformer |

---

## Fondasi (dipakai semua pola)

**Satu jalur input.** Mouse, touch, dan pen lewat `pointerdown/move/up/cancel`. Jangan bikin cabang `touchstart` terpisah (R06a sample 1 melakukannya lalu harus men-skip pointer touch supaya tidak dobel). Atur `touch-action` per arah gesture: `none` untuk area drag bebas, `pan-y` untuk drag horizontal di halaman yang tetap bisa di-scroll, `manipulation` untuk area tap saja.

**Angka gesture yang konsisten di referensi:**
- Slop (ambang drag): 6 px mouse (R06a, R07, R13), 10 px touch (R06a, R11).
- Tap vs drag: gerak < 6 px dan < 320 ms (R13). Double-tap: 2× `pointerdown` dalam 320 ms (R06b).
- Kecepatan lempar: sampel 100 ms terakhir. Kalau pointer sudah diam > 80 ms sebelum dilepas, kecepatan = 0 (R06b, `createVelocityTracker`).
- `setPointerCapture` baru dipasang **setelah** lewat slop (R07). Kalau dipasang di `pointerdown`, klik biasa di link di dalam elemen jadi tidak sampai ke link-nya.
- Klik yang lahir dari drag harus diblok di capture phase (R07), kalau tidak, lepas drag di atas kartu langsung membuka link.

**Konversi angka referensi ke motion-core:**

| di referensi | di motion-core |
|---|---|
| `x += (t - x) * f` per frame (mis. 0.12) | `x = damp(x, t, followToLambda(f), dt)` |
| time constant τ detik (`1 - exp(-dt/τ)`) | `damp(x, t, 1 / τ, dt)` |
| decay `v *= exp(-dt/τ)` | tulis langsung: `v *= Math.exp(-dt / tau)` |
| spring per frame `v = (v - x·k)·d` (mis. 0.06 / 0.86) | `createSpring({ stiffness: 3600·k·d, damping: -60·ln d })` → ≈ 186 / 9 |
| spring `v += (k(t-x) - d·v)·dt·60` (R06a rak) | `stiffness: 3600·k, damping: 60·d` |
| spring dengan rasio redaman ζ | `damping: 2·ζ·√(stiffness·mass)` |

Semua lerp per frame di referensi (R04, R06, R16) jalan 2× lebih cepat di layar 120 Hz. Selalu konversi.

**`bindDrag`**: helper kecil yang dipakai banyak resep di bawah. Usulan: simpan sebagai `assets/starter/pointer-kit.js` di samping `motion-core.js` (belum ada di starter).

```js
import { createVelocityTracker } from './motion-core.js';

export function bindDrag(el, { onStart, onMove, onEnd, onTap, slop = 6 } = {}) {
  const vt = createVelocityTracker();                     // jendela 100 ms, basi 80 ms
  let id = null, x0 = 0, y0 = 0, lx = 0, ly = 0, t0 = 0, moved = false;
  const down = (e) => {
    if (id !== null || e.button > 0) return;
    id = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY; t0 = performance.now(); moved = false;
    vt.reset(); vt.add(lx, ly); onStart?.(e);
  };
  const move = (e) => {
    if (e.pointerId !== id) return;
    const s = e.pointerType === 'mouse' ? slop : slop * 1.7;            // touch butuh slop lebih besar
    if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) > s) { moved = true; el.setPointerCapture(id); }
    if (moved) onMove?.(e.clientX - lx, e.clientY - ly, e);
    lx = e.clientX; ly = e.clientY; vt.add(lx, ly);
  };
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    onEnd?.(moved && e.type !== 'pointercancel' ? vt.get() : { x: 0, y: 0 }, e);  // selalu dipanggil
    if (!moved && performance.now() - t0 < 320) onTap?.(e);
  };
  const guard = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };
  const on = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]];
  on.forEach(([t, f]) => el.addEventListener(t, f));
  el.addEventListener('click', guard, true);                            // klik bekas drag tidak membuka link
  return () => { on.forEach(([t, f]) => el.removeEventListener(t, f)); el.removeEventListener('click', guard, true); };
}
```

**Tangan hantu (`ghost-hand`, R06a/R06b).** Section yang baru "hidup" kalau disentuh (wake, lens, draw) terlihat kosong saat pertama dibuka. R06a memutar demo dengan gesture sintetis yang diumpankan ke handler yang **sama** dengan input user: pindah ke titik acak (cepat 0.22–0.42 s atau pelan 1–1.6 s, kurva smootherstep), diam 0.35–1 s, ulang. Begitu user menyentuh, demo berhenti. Panggil dari `update(dt)` section supaya ikut pause saat off-screen, dan jangan jalankan saat reduced-motion.

```js
import { lerp } from './motion-core.js';

const sst = (t) => t * t * t * (t * (6 * t - 15) + 10);          // smootherstep
const rnd = (a, b) => a + Math.random() * (b - a);
export function createGhostHand() {
  let from = { x: 0.5, y: 0.5 }, to = { x: 0.3, y: 0.4 }, t = 0, dur = 1.2, wait = 0.6;
  return {
    step(dt) {                                                     // hasil 0..1 relatif ke section
      if (wait > 0) wait -= dt; else t = Math.min(1, t + dt / dur);
      const k = sst(t), p = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) };
      if (t === 1) {
        from = to; to = { x: rnd(0.15, 0.85), y: rnd(0.2, 0.8) }; t = 0;
        dur = Math.random() < 0.5 ? rnd(0.22, 0.42) : rnd(1, 1.6); wait = rnd(0.35, 1);
      }
      return p;
    },
  };
}
// di update(dt): if (demo) { const p = demo.step(dt); feed(rect.left + p.x * rect.width, rect.top + p.y * rect.height); }
// pointerdown/pointermove pertama dari user: demo = null;
```

**Aturan umum hover → touch.** `finePointer()` false artinya tidak ada hover. Setiap pola harus menyebut penggantinya: drag, tap, "tahan diam", gyro, atau state statis. Jangan menyembunyikan konten di balik hover.

---

### `cursor-parallax-depth` — Parallax berlapis & objek "menoleh" ke kursor
**Sumber:** R01, R06a, R07 · **Mode:** A+B · **Tingkat berat:** CSS (3D model kalau objek utamanya GLB)

**Kapan dipakai:** hero dengan objek utama + dekorasi, yang butuh kedalaman murah tanpa scroll. Paling cocok sebagai lapisan "idle" di bawah interaksi lain.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `depth` per layer | FG 46, BG −24, sprig −12 px (R01, dikali posisi −0.5..0.5 → ±23/∓12/∓6 px) | ±4–50 px | negatif = layer bergerak berlawanan, terasa di belakang |
| `follow` | 0.05/frame (R01, R06a) → `followToLambda(0.05)` ≈ 3.1/s | 2–8 /s | makin kecil makin "berat" dan melayang |
| `lookAt` | theta ±20°, phi ±9° (R01 kamera model) | ±8–25° | sudut miring objek utama ke arah kursor |
| `zoomDamp` | 0.55 (R06a, parallax dikurangi saat fokus) | 0.3–1 | redam parallax saat konten sedang dibaca |
| `ambient` | float 16 px / 6 s (R01), parallax latar ±14/±10 px smoothing 4/s (R07) | — | gerak idle untuk touch |

**Resep:**
1. Normalisasi pointer ke −0.5..0.5 (viewport atau section).
2. Satu nilai `cur` yang di-`damp` per frame, dibaca semua layer. Kalau ada animasi lain di objek yang sama (spin, transisi), jumlahkan di satu tempat (R01: offset spin ditambah ke sudut follow, lalu ditulis sekali).
3. Tulis `--px/--py` ke section satu kali per frame. Layer menghitung geser di CSS dengan `--depth` masing-masing.
4. Pakai properti `translate` untuk parallax dan `transform`/`animation` untuk float, supaya dua penulis tidak saling timpa.

```js
import { defineSection, damp, followToLambda } from './motion-core.js';

defineSection(document.querySelector('[data-parallax]'), ({ el, fine }) => {
  if (!fine) return {};                                   // touch: tanpa hover → pakai ambient CSS saja
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const lambda = followToLambda(0.05);                    // R01/R06a: 0.05 per frame @60
  const onMove = (e) => { target.x = e.clientX / innerWidth - 0.5; target.y = e.clientY / innerHeight - 0.5; };
  const onOut = (e) => { if (!e.relatedTarget) target.x = target.y = 0; };   // keluar window → balik ke tengah
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerout', onOut);
  return {
    update(dt) {
      cur.x = damp(cur.x, target.x, lambda, dt);
      cur.y = damp(cur.y, target.y, lambda, dt);
      el.style.setProperty('--px', cur.x.toFixed(4));
      el.style.setProperty('--py', cur.y.toFixed(4));
    },
    renderStatic() { el.style.setProperty('--px', 0); el.style.setProperty('--py', 0); },
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('pointerout', onOut); },
  };
});
/* CSS
.layer { translate: calc(var(--px, 0) * var(--depth) * 1px) calc(var(--py, 0) * var(--depth) * 1px); }
.layer--fg { --depth: 46 } .layer--bg { --depth: -24 } .layer--sprig { --depth: -12 }
.hero-object { transform: perspective(900px) rotateY(calc(var(--px, 0) * 40deg)) rotateX(calc(var(--py, 0) * -18deg)); }
.hero-object { animation: float 6s ease-in-out infinite; } // float di animation, parallax di translate
*/
```

**Touch, keyboard & reduced-motion:** touch tidak punya posisi kursor, jadi cukup float CSS pelan (R01: 16 px / 6 s). Gyro (`deviceorientation`) boleh sebagai bonus, tapi iOS butuh `requestPermission()` dari gesture user. Keyboard tidak relevan. Reduced: `--px/--py` 0, float dimatikan.

**Jebakan:**
- R01 hanya mendengarkan `mousemove`. Di HP pouch diam di sudut default, jadi efeknya hilang total tanpa pengganti.
- R01 mengaktifkan `camera-controls` (drag-to-rotate), tapi loop rAF menulis `cameraOrbit` tiap frame, jadi drag user langsung ditimpa. Satu properti cuma boleh punya satu pemilik.
- R01 memakai lerp 0.05 per frame tanpa `dt` dan loop tidak pernah pause. `defineSection` + `damp` menyelesaikan dua-duanya.
- Lupa reset saat kursor keluar window membuat objek "beku" menoleh ke tepi.

---

### `proximity-spring` — Elemen menghindar atau tertarik ke kursor
**Sumber:** R01, R14, R06b, R07, R13, R06a · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** sticker dekorasi yang "kabur" dari kursor (R01), huruf headline yang terdorong (R14 poster, R06b huruf strung-type), produk yang sedikit tertarik ke kursor (R07), atau tombol magnetik (R13).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `radius` | 340 px (R01) · 1.125× ukuran huruf (R06b) · 1.6× lebar item (R07) | 120–400 px | jangkauan pengaruh kursor |
| `strength` | maks 70 px tolak (R01) · ±16 px tarik (R07) | 10–80 px | tanda + menolak, − menarik |
| `falloff` | `(1 − d/R)²` (R06b) · Gaussian `exp(−(d/R)²)` (R07) | — | kuadrat = tegas di dekat, Gaussian = lembut |
| `spring` | per frame k .09 / d .85 (R14) → stiffness ≈ 275, damping ≈ 10 | stiffness 120–300, damping 5–20 | R06b huruf k160 ζ0.2 → damping ≈ 5, sangat membal |
| `lean` | miring tangensial (R14), spin ×6 saat dekat (R01) | 0–15° | rotasi ikut dorongan |
| `knock` | kecepatan pointer × 2.2 (R06b) | 0–3 | kursor cepat "menabrak" lebih keras |

**Resep:**
1. Ukur posisi "home" tiap item sekali (dan saat scroll/resize), dikurangi offset spring yang sedang berjalan supaya tidak terjadi umpan balik.
2. Per frame: vektor dari kursor ke home, falloff, target offset = arah × strength × falloff.
3. Dua `createSpring` per item (x, y). `set(target)` lalu `step(dt)`.
4. Varian tarik/magnetik (R13): target = (kursor − pusat) × 0.3 selama kursor di dalam tombol, 0 saat keluar. Spring dengan damping rendah memberi efek `elastic.out`.
5. Varian angin (R06a): dorongan dari **kecepatan** kursor, bukan posisinya. `spring.kick(vx * f)` hanya saat kursor lewat dalam radius 90–210 px.

```js
import { defineSection, createSpring, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-repel]'), ({ el }) => {
  const R = 340, MAX = 70, SIGN = 1;                     // R01. SIGN −1 = tarik (R07)
  const items = [...el.querySelectorAll('[data-repel-item]')].map((node) => ({
    node, hx: 0, hy: 0,
    sx: createSpring({ stiffness: 275, damping: 10 }),    // ≈ R14 k .09 / d .85 per frame
    sy: createSpring({ stiffness: 275, damping: 10 }),
  }));
  const measure = () => items.forEach((it) => {           // cache home, JANGAN getBoundingClientRect per frame
    const r = it.node.getBoundingClientRect();
    it.hx = r.left + r.width / 2 - it.sx.value; it.hy = r.top + r.height / 2 - it.sy.value;
  });
  const p = { x: -1e4, y: -1e4 };
  const hide = () => { p.x = p.y = -1e4; };
  el.addEventListener('pointermove', (e) => { p.x = e.clientX; p.y = e.clientY; });
  el.addEventListener('pointerleave', hide);
  el.addEventListener('pointerup', (e) => e.pointerType !== 'mouse' && hide()); // jari diangkat = kursor hilang
  addEventListener('scroll', measure, { passive: true });
  measure();
  return {
    onResize: measure,
    update(dt) {
      for (const it of items) {
        const dx = it.hx - p.x, dy = it.hy - p.y, d = Math.hypot(dx, dy) || 1;
        const f = clamp(1 - d / R) ** 2 * MAX * SIGN;
        it.sx.set((dx / d) * f); it.sy.set((dy / d) * f);
        if (it.sx.isSettled() && it.sy.isSettled()) continue;           // diam = tidak menulis DOM
        const x = it.sx.step(dt), y = it.sy.step(dt), lean = clamp(it.sx.velocity * 0.02, -12, 12);
        it.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${lean}deg)`;
      }
    },
    renderStatic() {},                                    // reduced: semua di posisi home
    destroy() { removeEventListener('scroll', measure); },
  };
});
```

**Touch, keyboard & reduced-motion:** di touch efek hanya hidup selama jari menekan dan bergerak (R06b: hover di desktop, drag di touch). Pakai `touch-action: pan-y` kalau section ada di halaman yang di-scroll, supaya scroll tetap jalan. Tombol magnetik: matikan di touch (R13 menggate `hover:hover and pointer:fine`). Reduced: posisi home, tanpa spring.

**Jebakan:**
- R01 memanggil `getBoundingClientRect()` 5× per frame untuk repel. Cache rect, ukur ulang hanya saat scroll/resize.
- R01 punya dua penulis transform (loop repel dan tween implode/explode). Solusinya: loop berhenti menulis selama tween, lalu posisi akhir tween disimpan sebagai "home" baru supaya loop lanjut tanpa loncat.
- Ukur home tanpa mengurangi offset spring = item terus "lari" karena rect-nya sudah tergeser.
- Sticker yang terdorong bisa menutupi CTA. Dekorasi wajib `pointer-events: none`.

---

### `cursor-facing-rotators` — Mata, panah & glyph yang menghadap kursor
**Sumber:** R16, R08 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** aksen playful yang tersebar: deret huruf atau ikon yang berputar menghadap kursor (R16), mata yang melirik (R08 ikon About, R16 grid mata), panah yang menunjuk.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `offsetDeg` | +90° (R16, gambar menghadap atas) | −90 / 0 / 90 | koreksi arah "depan" aset |
| `follow` | 0.1/frame (R16) → `followToLambda(0.1)` ≈ 6.3/s | 4–12 /s | kelincahan putar |
| `snapDeg` | 0, atau 45 untuk panah (R16, tanpa smoothing) | 0 / 45 / 90 | putaran berundak |
| `pupil` | 0.3 × radius mata; R08 halus 0.15 s `power3.out` | 0.2–0.4 | seberapa jauh pupil bergeser |
| `reaimOnScroll` | ya (R16) | — | elemen bergeser saat scroll → sudut dihitung ulang |

**Resep:**
1. Cache pusat tiap elemen. Hitung ulang saat scroll/resize.
2. Sudut target = `atan2` ke kursor + offset. *Unwrap* supaya selalu ambil jalur terpendek (tidak berputar 350° saat melewati ±180°).
3. `damp` sudut per frame, atau langsung set kalau pakai snap.
4. Mata: tulis offset pupil ke CSS var, haluskan dengan CSS transition 0.15 s (lebih murah dari loop).

```js
import { defineSection, damp, followToLambda, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-face-cursor]'), ({ el, fine }) => {
  const OFFSET = 90, SNAP = 0, PUPIL = 0.3, lambda = followToLambda(0.1);
  const items = [...el.querySelectorAll('[data-rotator], [data-eye]')].map((node) => ({
    node, eye: node.hasAttribute('data-eye'), cx: 0, cy: 0, r: 0, cur: 0, tgt: 0,
  }));
  let mx = innerWidth / 2, my = innerHeight / 2;           // touch: target = tengah layar (R16)
  const measure = () => items.forEach((it) => {
    const b = it.node.getBoundingClientRect();
    it.cx = b.left + b.width / 2; it.cy = b.top + b.height / 2; it.r = b.width / 2;
  });
  const aim = () => items.forEach((it) => {
    const dx = mx - it.cx, dy = my - it.cy, a = Math.atan2(dy, dx);
    if (it.eye) {                                          // pupil: makin jauh kursor, makin ke tepi
      const k = clamp(Math.hypot(dx, dy) / 300) * it.r * PUPIL;
      it.node.style.setProperty('--ex', `${Math.cos(a) * k}px`); it.node.style.setProperty('--ey', `${Math.sin(a) * k}px`);
      return;
    }
    let deg = (a * 180) / Math.PI + OFFSET;
    if (SNAP) deg = Math.round(deg / SNAP) * SNAP;
    while (deg - it.tgt > 180) deg -= 360;                 // unwrap: jalur terpendek
    while (deg - it.tgt < -180) deg += 360;
    it.tgt = deg;
  });
  const onMove = (e) => { mx = e.clientX; my = e.clientY; aim(); };
  const onScroll = () => { measure(); aim(); };            // "melirik" ulang walau mouse diam
  if (fine) addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return {
    onResize: onScroll,
    update(dt) { for (const it of items) if (!it.eye) { it.cur = SNAP ? it.tgt : damp(it.cur, it.tgt, lambda, dt); it.node.style.rotate = `${it.cur}deg`; } },
    renderStatic() {},
    destroy() { removeEventListener('pointermove', onMove); removeEventListener('scroll', onScroll); },
  };
});
/* CSS: .pupil { translate: var(--ex, 0) var(--ey, 0); transition: translate .15s cubic-bezier(.215,.61,.355,1); } */
```

**Touch, keyboard & reduced-motion:** touch: target tetap di tengah layar, jadi elemen tetap "melirik" saat di-scroll (R16). Bonus: target = posisi tap terakhir. Keyboard tidak relevan (dekoratif, `aria-hidden`). Reduced: semua di 0°, pupil di tengah.

**Jebakan:**
- R16 memakai lerp 0.1 per frame tanpa `dt`, jadi di 120 Hz putaran 2× lebih cepat.
- Tanpa unwrap, elemen berputar hampir satu lingkaran penuh saat kursor melewati sisi kiri.
- Ukur rect di event scroll untuk ratusan elemen itu mahal. Untuk grid besar, simpan posisi relatif dokumen sekali lalu kurangi `scrollY`.
- R16 tidak punya cek reduced-motion sama sekali.

---

### `proximity-weight-field` — Grid huruf yang menebal di dekat kursor
**Sumber:** R16 · **Mode:** A (B sebagai section glyphset) · **Tingkat berat:** CSS

**Kapan dipakai:** situs type foundry, brand dengan variable font, atau section "playground" yang ringan tapi terasa wow. Butuh font variable (mis. Roboto Flex `wght` 100–1000, `wdth` 25–151).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `radius` | 6rem ≈ 600 px di 1440 (R16, 1rem = 6.944vw) | 300–700 px | luas medan |
| `stops` | faktor radius 1 / 0.55 / 0.35 / 0.125 → wght 200 / 400 / 650 / 900, warna #0000cb → #5c92ff → #ffae00 → #ff0b00 | 3–5 stop | kurva tebal + warna dari jauh ke dekat |
| `fadeOutside` | opacity 0 di 2.5× radius | 2–3× | huruf jauh menghilang |
| `enter` | radius tumbuh 0 → 1 dalam 0.4 s `power3.out` | 0.3–0.6 s | medan "mekar" saat kursor masuk section |
| `count` | 240 huruf | ≤ 300 | di atas itu re-shaping teks mulai berat |

**Resep:**
1. Grid N huruf `<span class="cell">`. Cache pusat tiap huruf, ukur ulang saat scroll/resize.
2. Per frame: jarak ke kursor dibagi `power` (0..1 yang di-`damp` saat enter/leave), lalu interpolasi piecewise ke tabel stop.
3. Tulis `--w` dan `--o` **hanya kalau berubah** (wght dibulatkan ke integer).
4. Warna tidak perlu dihitung di JS: CSS `color-mix` membaca `--w`.

```js
import { defineSection, damp, lerp, clamp } from './motion-core.js';

const STOPS = [[1, 200], [0.55, 400], [0.35, 650], [0.125, 900]];   // [faktor radius, wght]
function wghtAt(d, R) {
  if (d >= STOPS[0][0] * R) return STOPS[0][1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [fa, wa] = STOPS[i], [fb, wb] = STOPS[i + 1];
    if (d >= fb * R) return lerp(wb, wa, (d - fb * R) / ((fa - fb) * R));
  }
  return STOPS.at(-1)[1];
}
defineSection(document.querySelector('[data-weight-field]'), ({ el, fine, small }) => {
  if (!fine || small) return { renderStatic() {} };            // touch/≤768: grid statis (R16 ganti video)
  const cells = [...el.querySelectorAll('.cell')];
  let centers = [], R = 600, mx = -1e4, my = -1e4, power = 0, want = 0;
  const measure = () => {
    R = 6 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    centers = cells.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  };
  el.addEventListener('pointerenter', () => (want = 1));
  el.addEventListener('pointerleave', () => (want = 0));
  el.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; });
  addEventListener('scroll', measure, { passive: true });
  measure();
  return {
    onResize: measure,
    update(dt) {
      power = damp(power, want, 7.5, dt);                       // ≈ 0.4 s power3.out
      cells.forEach((c, i) => {
        const d = Math.hypot(mx - centers[i][0], my - centers[i][1]) / Math.max(power, 1e-3);
        const w = Math.round(wghtAt(d, R)), o = +(1 - clamp((d - R) / (1.5 * R))).toFixed(2);
        if (c._w !== w) { c.style.setProperty('--w', w); c._w = w; }   // tulis hanya kalau berubah
        if (c._o !== o) { c.style.setProperty('--o', o); c._o = o; }
      });
    },
    renderStatic() {},
    destroy() { removeEventListener('scroll', measure); },
  };
});
/* CSS
.cell { font-variation-settings: 'wght' var(--w, 200), 'wdth' 100; opacity: var(--o, 1);
        color: color-mix(in oklch, #ff0b00 calc((var(--w, 200) - 200) / 7 * 1%), #0000cb); }
*/
```

**Touch, keyboard & reduced-motion:** R16 mematikan medan di ≤ 768 px dan menggantinya dengan video. Alternatif lebih ringan: medan muncul di titik tap lalu memudar 0.6 s. Grid dekoratif → `aria-hidden="true"`, taruh teks asli di heading. Reduced: semua huruf di weight dasar, tanpa loop.

**Jebakan:**
- 240 huruf × `font-variation-settings` per frame = re-shaping teks tiap frame. Tanpa write-avoidance dan pembulatan, frame drop.
- Angka axis Exat (wght 42–228, wdth 10/50/100) adalah unit custom font itu. Petakan ulang ke axis font yang dipakai.
- R16 baru meng-init semua interaksi setelah `glyphset.json` selesai di-fetch. Kalau fetch gagal, tidak ada yang jalan dan preloader polling terus. Init jangan bergantung pada data opsional.
- Tidak ada reduced-motion dan label tidak bisa difokus keyboard di referensi.

---

### `custom-cursor` — Dot + bracket, label tag, dan lens reveal
**Sumber:** R11, R06a, R07, R09 · **Mode:** A+B · **Tingkat berat:** CSS (lens versi R09: Canvas2D)

**Kapan dipakai:** kursor sebagai bagian identitas: dot kecil + frame yang mengejar (R11), lingkaran berlabel "Open/Back" (R06a, R07 "Discover product"), atau lens yang membuka layer tersembunyi di sekitar kursor (R09 footer).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `dot` | 11 px, menempel tanpa lag (R11) | 6–14 px | titik presisi |
| `frame` / `tag` | bracket 32×25 (R11) · lingkaran 68 px (R06a) | 24–90 px | elemen yang mengejar |
| `followTau` | 0.04 s (R06a) → lambda 25/s | 0.03–0.12 s | lag frame/tag |
| `labelFade` | 110 ms (R06a); label muncul setelah diam 260 ms (R07) | 80–200 ms | ganti label "Open" / "Back" / "Drag" |
| `lensRadius` | 150 px, tumbuh 90 ms, susut 120 ms (R09) | 80–220 px | lingkaran yang membuka layer kedua |

**Resep:**
1. Satu listener `pointermove` global. Dot ditulis posisi mentah, frame/tag di-`damp`.
2. Label diambil dari `data-cursor` elemen terdekat (`closest`), atau "Open" untuk link/tombol. Satu deteksi lewat selector, bukan listener per elemen (R11).
3. Lens: layer kedua (gambar, video, atau canvas) di-`clip-path: circle()` pada posisi kursor relatif ke layer itu. R09 mengisi lens dengan canvas langit pixel yang di-clip ke siluet. Versi CSS jauh lebih murah dan cukup untuk kebanyakan kasus.
4. `cursor: none` hanya dipasang lewat class setelah JS jalan dan pointer-nya fine.

```js
import { defineSection, damp, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-cursor-root]'), ({ el, fine, reduced }) => {
  if (!fine) return {};                                       // touch: kursor OS saja
  const dot = el.querySelector('.cursor-dot'), tag = el.querySelector('.cursor-tag');
  const lens = el.querySelector('[data-lens]');                // layer yang di-clip (opsional)
  const p = { x: -200, y: -200 }, f = { x: -200, y: -200 };
  let r = 0, rWant = 0, label = '';
  const onMove = (e) => {
    p.x = e.clientX; p.y = e.clientY;
    const hit = e.target.closest('a, button, [data-cursor]');
    const next = hit ? hit.dataset.cursor ?? 'Open' : '';
    if (next !== label) { label = next; tag.dataset.label = label; tag.classList.toggle('is-on', !!label); }
    rWant = lens && e.target.closest('[data-lens-zone]') ? 150 : 0;
  };
  const onOut = (e) => { if (!e.relatedTarget) { p.x = p.y = -200; rWant = 0; } };
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
    destroy() {
      removeEventListener('pointermove', onMove); removeEventListener('pointerout', onOut);
      document.documentElement.classList.remove('has-cursor');
    },
  };
});
/* CSS: .cursor-dot, .cursor-tag { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 1000; }
        .cursor-tag::after { content: attr(data-label); transition: opacity .11s; } */
```

**Touch, keyboard & reduced-motion:** touch tidak dapat kursor kustom. Lens R09 diganti tap: lens muncul di titik tap, tahan ±1.5 s, lalu susut. Keyboard: kursor tidak berperan, pastikan `:focus-visible` tetap terlihat karena `cursor: none` sering bikin tim lupa state fokus. Reduced: tanpa lag dan tanpa scale pop (R06a mematikan pop di CSS).

**Jebakan:**
- Elemen kursor tanpa `pointer-events: none` memakan hover dan klik. Gejalanya: link di bawah kursor tidak bisa diklik.
- `cursor: none` di CSS global sebelum JS jalan atau di device touch = kursor hilang tanpa pengganti.
- Di atas iframe/video embed `pointermove` berhenti dan kursor kustom membeku. Sembunyikan lewat `pointerout` dengan `relatedTarget` null.
- Membaca rect setelah menulis style di frame yang sama memaksa layout. Baca dulu di awal `update`.

---

### `index-lens` — Daftar fisheye + poster mengikuti kursor
**Sumber:** R06a, R11 · **Mode:** A (B sebagai halaman index) · **Tingkat berat:** CSS (R06a aslinya WebGL + teks di canvas)

**Kapan dipakai:** daftar karya, menu proyek, line-up event. Baris di bawah kursor membengkak, tetangga ikut membesar dan terdorong, baris lain meredup, dan foto karya mengikuti kursor di samping.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `lens` | 12% tinggi daftar (Gaussian) | 10–14% | lebar lensa |
| `swell` | 1.25 → baris aktif ×2.25 | 1.0–1.5 | pembesaran maksimum |
| `pitch` | 0.92 × tinggi baris | 0.85–1 | kerapatan baris |
| `follow` | presence 0.12, lensa 0.22, poster 0.16 per frame | `followToLambda(...)` | kelincahan tiap lapis |
| `poster` | tilt `clamp(−vx·0.005, ±0.2 rad)`, pop −5% decay 0.86/frame | — | foto miring searah gerak dan "pop" saat ganti item |
| `alpha` | idle 0.82, aktif `0.2 + 0.8·p` | — | baris jauh meredup |

**Resep:**
1. Baris `position: absolute`, ukuran font = ukuran **maksimum**, lalu skala dasar `1 / 2.25` supaya teks tetap tajam saat membesar.
2. Per frame: bobot lensa tiap baris `p = exp(−(dy / (0.12·H))²) · presence`, tinggi baris `m·(1 + swell·p)`, susun berurutan.
3. Kompensasi: geser seluruh daftar dengan rata-rata berbobot `p` dari (posisi asli − posisi baru), supaya baris yang di-hover tetap di bawah kursor.
4. Satu poster (bukan N gambar), ganti `src` saat baris aktif berubah. R11 punya ide sejenis: satu "hover band" untuk semua baris, bukan listener per baris.

```js
import { defineSection, damp, followToLambda, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-index-lens]'), ({ el }) => {
  const rows = [...el.querySelectorAll('.row')], poster = el.querySelector('.poster');
  const N = rows.length, SWELL = 1.25, LENS = 0.12, PITCH = 0.92, BASE = 1 / (1 + SWELL);
  const L = { pres: followToLambda(0.12), lens: followToLambda(0.22), post: followToLambda(0.16) };
  let m = 0, H = 0, pres = 0, want = 0, py = 0, ly = 0, active = -1, pop = 0;
  const post = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
  const measure = () => { H = el.clientHeight; m = H / (N * PITCH + 0.5); };
  el.addEventListener('pointermove', (e) => { const b = el.getBoundingClientRect(); want = 1; tgt.x = e.clientX - b.left; tgt.y = py = e.clientY - b.top; });
  el.addEventListener('pointerleave', () => (want = 0));
  measure();
  return {
    onResize: measure,
    update(dt) {
      pres = damp(pres, want, L.pres, dt); ly = pres < 0.05 ? py : damp(ly, py, L.lens, dt);
      let y = 0, shift = 0, wsum = 0, best = 0, bestD = Infinity;
      const out = rows.map((_, i) => {
        const home = (i + 0.5) * m * PITCH, dy = home - ly;
        const p = Math.exp(-((dy / (H * LENS)) ** 2)) * pres, h = m * (1 + SWELL * p), cy = y + h * 0.46;
        y += h * PITCH; shift += (home - cy) * (p + 1e-4); wsum += p + 1e-4;
        if (Math.abs(dy) < bestD) { bestD = Math.abs(dy); best = i; }
        return { cy, s: (h / m) * BASE, p };
      });
      shift /= wsum;                                          // baris aktif tetap di bawah kursor
      out.forEach(({ cy, s, p }, i) => {
        rows[i].style.transform = `translate3d(0,${cy + shift - m / 2}px,0) scale(${s})`;
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

**Touch, keyboard & reduced-motion:** R06a memakai drag vertikal di touch, tapi itu mengunci scroll halaman. Untuk section di halaman yang di-scroll: tampilkan daftar statis dengan thumbnail kecil, tap = buka. Keyboard: baris adalah `<a>`; saat `focus`, set `py` ke tengah baris dan `want = 1`, jadi lensa ikut fokus. Reduced: tanpa swell, cukup opacity aktif/redup, poster diam di sisi kanan.

**Jebakan:**
- Men-scale teks dari ukuran kecil ke ×2.25 bikin teks buram. Mulai dari ukuran besar lalu scale turun.
- Tanpa kompensasi `shift`, baris yang di-hover lari dari kursor karena tinggi baris di atasnya bertambah.
- Ganti `src` poster tanpa preload = kedip putih. Preload semua thumbnail (kecil) lebih dulu.
- R06a tidak punya klik, keyboard, maupun reduced-motion di sample ini.

---

### `cursor-scrub-video` — Video yang di-scrub kursor
**Sumber:** R04 · **Mode:** A · **Tingkat berat:** Video

**Kapan dipakai:** subjek yang "bereaksi" ke user tanpa 3D: hewan/wajah menoleh, produk 360°, mekanisme buka-tutup. Hindari kalau latar banyak elemen hidup (air, daun, kerumunan) karena semuanya ikut maju-mundur dan terlihat palsu.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `fps` | 24, 145 frame, 6.04 s (R04 ffprobe) | 24–30, 100–150 frame | harus sama dengan clip |
| `mapping` | relatif, sensitivity 0.8 (R04) | relatif / **absolut** (disarankan) | absolut = kursor kanan selalu berarti menoleh kanan |
| `smoothing` | 0.12/frame (R04) → τ ≈ 0.12 s, lambda ≈ 8 | τ 0.1–0.15 s | glide antar frame |
| `snapToFrame` | ya, satu seek in-flight | — | mencegah judder dan antrean seek |
| `start` | frame 0 (R04) | tengah (disarankan) | subjek mulai menghadap kamera |
| `fallback` | loop autoplay (R04) | loop / poster | touch dan reduced-motion |

**Resep:**
1. Produksi clip: kamera terkunci, satu gerakan monoton satu arah (kiri → depan → kanan), frame tengah menghadap kamera, 4–6 s.
2. Encode **all-intra** supaya seek ke frame mana pun instan (R04: `keyint=1`, 145/145 frame tipe I, ~20.9 Mbps, 15.8 MB untuk 6 s). Siapkan juga versi loop ringan untuk touch:
   ```bash
   ffmpeg -i turn_src.mov -an -r 24 -vf "scale=1920:-2" \
     -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
     -g 1 -keyint_min 1 -bf 0 -sc_threshold 0 -x264-params mbtree=0 \
     -movflags +faststart hero-scrub.mp4
   # versi loop (touch): -vf "scale=1280:-2" -crf 24 -g 48, tanpa flag all-intra → jauh lebih kecil
   # cek: semua frame harus "I"
   ffprobe -v error -select_streams v -show_entries frame=pict_type -of csv hero-scrub.mp4 | sort | uniq -c
   ```
3. Markup: `<video muted playsinline preload="none" poster="..." data-scrub-src data-loop-src aria-hidden="true">`.
4. Fetch file scrub ke Blob URL dulu (seek lokal instan, tanpa range request per frame), baru aktifkan scrub.

```js
import { defineSection, damp, clamp } from './motion-core.js';

defineSection(document.querySelector('[data-scrub-video]'), ({ el, fine, reduced }) => {
  const video = el.querySelector('video'), FPS = 24;
  const loop = () => { video.src = video.dataset.loopSrc; video.loop = true; video.play().catch(() => {}); };
  if (reduced) return {};                                   // poster diam
  if (!fine) { loop(); return {}; }                         // touch: file loop ringan, bukan file all-intra
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
  el.addEventListener('pointermove', (e) => {               // mapping absolut, hanya di area section
    if (!s.armed) return;
    const b = el.getBoundingClientRect();
    s.target = clamp((e.clientX - b.left) / b.width) * (video.duration - 1 / FPS);  // jangan seek ke ujung
  });
  return {
    update(dt) {
      if (!s.armed) return;
      s.shown = damp(s.shown, s.target, 8, dt);             // τ ≈ 0.12 s, sama di 60/120 Hz
      if (s.busy) return;
      const t = Math.round(s.shown * FPS) / FPS;            // snap ke grid frame
      if (t === s.last) return;
      s.last = t; s.busy = true; video.currentTime = t;     // satu seek in-flight
    },
  };
});
```

**Touch, keyboard & reduced-motion:** touch: putar file loop GOP normal (R04 justru mengunduh file all-intra 15.8 MB yang sama hanya untuk loop). Reduced: poster statis. Keyboard: video dekoratif. Kalau ini viewer produk 360° yang informatif, tambahkan `<input type="range">` yang menulis `s.target`.

**Jebakan:**
- Mapping relatif R04 (`target += Δx · 0.8 · durasi`) bikin arah pandang dan kursor **drift**: kursor di tepi kanan belum tentu berarti menoleh kanan, apalagi setelah mentok di clamp lalu balik arah.
- `preload="auto"` + `fetch` blob = potensi unduhan dobel. Pakai `preload="none"`.
- Seek ke `duration` persis bisa memicu `ended` atau frame kosong. Clamp ke `duration − 1/fps`.
- R04 mendengarkan `mousemove` di `window` dan rAF tidak pernah pause, jadi video tetap di-seek walau hero sudah lewat. `defineSection` + listener di section menyelesaikannya.
- Seek beruntun tanpa flag `busy` menumpuk di decoder dan terasa lag, terutama di Safari.

---

### `cursor-wake-dwell` — Riak di belakang kursor + diam untuk membuka
**Sumber:** R06a · **Mode:** A · **Tingkat berat:** CSS (R06a: WebGL untuk RGB split)

**Kapan dipakai:** grid poster/proyek di mana kursor yang lewat mendorong tile seperti riak di belakang perahu, dan diam di atas satu tile membukanya tanpa klik. Cocok untuk index portofolio yang ingin terasa "hidup".

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `pushGain` | 0.34 × delta kursor, Gaussian reach 1.15 tile | 0.2–0.4, 1–1.5 tile | kekuatan dan lebar riak |
| `returnSpring` | per frame 0.06 / 0.86 → stiffness ≈ 186, damping ≈ 9 | — | cara tile kembali |
| `restSpeed` | EMA `s·0.7 + |Δ|·0.3` < 2.2 px/frame | 1.5–3 | ambang "diam" |
| `dwell` | naik dt/0.6, turun dt/0.3; buka ≥ 1, tutup < 0.6 | 0.6–0.8 s | waktu tunggu + histeresis |
| `open` | spring k300 ζ0.55 (sedikit overshoot), skala maks 2 (mobile 2.6) | 1.6–2.6 | seberapa besar tile membuka |
| `rotation` | `clamp(−vx·0.0045, ±0.18 rad)` | — | tile miring saat terdorong |

**Resep:**
1. Cache pusat tiap tile. Akumulasi delta kursor (clamp 60 px per event) antar frame.
2. Tiap frame, tiap tile: `f = exp(−(d / (1.15·w))²) · 0.34 · (1 − open)`, lalu `kick` spring searah gerak kursor.
3. Dwell: kalau kursor di atas tile dan kecepatan EMA di bawah ambang, isi dwell. Tampilkan sebagai cincin progress di kursor/tile (wajib, lihat jebakan).
4. Tile yang terbuka: `z-index` naik, tetangga didorong radial `open·w·0.62·exp(−(d/2.2w)²)` dan sisanya diredupkan 50% (tidak ditulis di snippet).

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
  addEventListener('scroll', measure, { passive: true });
  measure();
  return {
    onResize: measure,
    update(dt) {
      p.speed = p.speed * 0.7 + Math.hypot(p.dx, p.dy) * (1 / 60 / dt) * 0.3;   // EMA px/frame@60
      for (const t of tiles) {
        const d = Math.hypot(p.x - t.cx, p.y - t.cy);
        const f = Math.exp(-((d / (t.w * 1.15)) ** 2)) * 0.34 * (1 - t.open.value);
        if (!reduced) { t.x.kick(p.dx * f * 60); t.y.kick(p.dy * f * 60); }   // dorong searah gerak
        const over = d < t.w / 2 && p.speed < 2.2;
        t.dwell = over ? Math.min(1, t.dwell + dt / 0.6) : Math.max(0, t.dwell - dt / 0.3);
        if (t.dwell >= 1) t.open.set(1); else if (t.dwell < 0.6) t.open.set(0);   // histeresis
        const x = t.x.step(dt), y = t.y.step(dt), o = t.open.step(dt);
        const rot = clamp((-t.x.velocity / 60) * 0.0045, -0.18, 0.18);
        t.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${rot}rad) scale(${1 + o})`;
        t.node.style.zIndex = o > 0.01 ? 2 : '';
        t.node.style.setProperty('--ring', t.dwell.toFixed(3));        // cincin: conic-gradient di CSS
      }
      p.dx = p.dy = 0;
    },
    destroy() { removeEventListener('scroll', measure); },
  };
});
```

**Touch, keyboard & reduced-motion:** R06a memakai "tahan diam" di touch, tapi itu bentrok dengan scroll halaman. Untuk section di halaman yang di-scroll: tap = buka, tap di luar = tutup, riak hanya saat jari menggeser. Keyboard: `focus` tile = `dwell = 1`, `Esc` = tutup. Reduced: tanpa riak, tile terbuka dengan `open.snap(1)`.

**Jebakan:**
- Dwell-to-open tanpa indikator progress membuat user bingung kenapa tile tiba-tiba membesar (catatan R06a sendiri).
- Spec "opens after 0.8 s" di registry R06a tidak sama dengan kode (dwell 0.6 s + waktu EMA turun). Kalau klien menyebut angka, ukur dari total, bukan dari konstanta dwell.
- Tile yang membesar menutupi tetangga dan memblok hover mereka. Turunkan `pointer-events` tetangga atau dorong mereka keluar.
- Push ditulis per frame tanpa `dt` di R06a (0.06/0.86 per frame). Di sini sudah dikonversi ke spring per detik.

---

### `infinite-drag-canvas` — Dinding kartu tanpa ujung
**Sumber:** R06a · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** galeri atau halaman index/journal yang bisa digeser ke segala arah tanpa tepi. Mode A sebagai section galeri fullscreen, mode B sebagai halaman "All work".

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `card` / `gap` | 500 / 80 px (≤768: 260/40, ≤480: 176/26) | — | ukuran grid |
| `pool` | 8 × 6 = 48 elemen DOM (di-recycle) | lebar pool > viewport + 1 sel | jumlah elemen nyata |
| `parallax` | 60 px (30/22 mobile), foto scale 1.15 | ≈12% kartu, scale ≥ 1 + 2·par/card | foto bergeser di dalam frame |
| `follow` | 0.12/frame untuk wheel/keyboard | `followToLambda(0.08–0.15)` | drag tetap 1:1 tanpa lag |
| `glide` | jarak `v·0.9/3`, 0.9 s `outCubic` | 0.6–1.2 s | lemparan meluncur lalu berhenti |
| `fling` | abaikan < 40 px/s, clamp 4000 px/s | — | lepas pelan = tidak meluncur |

**Resep:**
1. Pool kartu sebanyak `COLS × ROWS`, posisi = `wrap(col·cell + pos.x)`. Kartu di luar layar `visibility: hidden`.
2. Drag 1:1 tanpa smoothing (tangan harus "memegang" dinding). Wheel/keyboard lewat target + `damp`.
3. Lepas: glide dengan jarak `v·T/3` dan `ease.outCubic`. Turunan `1−(1−t)³` di t=0 adalah 3, jadi kecepatan awal glide sama persis dengan kecepatan tangan. Tidak ada patahan.
4. Foto di-load mulai dari yang terdekat ke tengah, maksimal 6 paralel, dengan placeholder warna dulu (LQIP).

```js
import { defineSection, damp, followToLambda, ease } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-endless]'), ({ el, reduced }) => {
  const CARD = 500, GAP = 80, COLS = 8, ROWS = 6, T = 0.9, PAR = reduced ? 0 : 60, cell = CARD + GAP;
  const W = COLS * cell, H = ROWS * cell, lam = followToLambda(0.12);
  const cards = [...el.querySelectorAll('.card')].map((node, i) => ({ node, img: node.querySelector('img'), c: i % COLS, r: (i / COLS) | 0 }));
  const pos = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
  let glide = null, held = false;
  const wrap = (v, size) => ((((v + cell) % size) + size) % size) - cell;
  bindDrag(el, {
    onStart: () => { glide = null; held = true; },
    onMove: (dx, dy) => { pos.x = tgt.x = pos.x + dx; pos.y = tgt.y = pos.y + dy; },   // 1:1
    onEnd: (v) => {
      held = false;
      const sp = Math.hypot(v.x, v.y); if (sp < 40 || reduced) return;
      const k = Math.min(sp, 4000) / sp;                            // clamp 4000 px/s
      glide = { dx: (v.x * k * T) / 3, dy: (v.y * k * T) / 3, t: 0, done: 0 };
    },
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); glide = null; tgt.x -= e.deltaX * 0.8; tgt.y -= e.deltaY * 0.8; }, { passive: false });
  el.addEventListener('keydown', (e) => { const d = { ArrowLeft: [120, 0], ArrowRight: [-120, 0], ArrowUp: [0, 120], ArrowDown: [0, -120] }[e.key]; if (d) { tgt.x += d[0]; tgt.y += d[1]; } });
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
        const x = wrap(c.c * cell + pos.x, W), y = wrap(c.r * cell + pos.y, H);
        const on = x > -CARD && x < vw && y > -CARD && y < vh;
        c.node.style.visibility = on ? '' : 'hidden'; if (!on) continue;
        c.node.style.transform = `translate3d(${x}px,${y}px,0)`;
        const px = (-(x + CARD / 2 - vw / 2) / (vw / 2)) * PAR, py = (-(y + CARD / 2 - vh / 2) / (vh / 2)) * PAR;
        c.img.style.transform = `translate3d(${px}px,${py}px,0) scale(1.15)`;
      }
    },
  };
});
```

**Touch, keyboard & reduced-motion:** satu jalur pointer, `touch-action: none` di section (section ini memang fullscreen). Keyboard: panah ±120 px (R06a), kartu adalah link yang bisa di-Tab; saat fokus, geser `tgt` supaya kartu itu ke tengah. Reduced: tanpa glide dan parallax, intro stagger dimatikan.

**Jebakan:**
- Wheel dengan `preventDefault` di section yang ada di tengah halaman membajak scroll. Pola ini hanya untuk section fullscreen atau halaman tanpa scroll native.
- Klik setelah drag membuka kartu. `bindDrag` sudah memblok, jangan dilepas.
- R06a menulis follow 0.12 per frame tanpa `dt`, dan tidak punya reduced-motion.
- Lebar pool harus lebih besar dari viewport + 1 sel, kalau tidak kartu "muncul" di tengah layar saat wrap.
- Tanpa antrian load dari tengah, foto di tepi yang tidak terlihat ikut menghabiskan bandwidth duluan.

---

### `wheel-drag-shelf` — Rak objek tanpa ujung (wheel + drag + spring)
**Sumber:** R07, R06a, R11 · **Mode:** A+B · **Tingkat berat:** CSS (R07 label 3D: WebGL opsional)

**Kapan dipakai:** katalog produk/kemasan/buku/vinyl sebagai hero satu layar (R07 homepage = satu rak toples miring), atau carousel foto yang bentuknya bereaksi ke kecepatan (R06a velocity reel). Rail (R11) adalah kontrol kedua untuk lompat cepat.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `input` | wheel ×1.15, drag ×1.5, lempar `clamp(v, ±3.5 px/ms)·1.5·190` (R07) | — | seberapa jauh rak bergerak per input |
| `smoothing` | 11/s saat drag, 2.3/s idle (R07) | 2–12 /s | idle yang lambat = rak "meluncur" lama |
| `itemSpring` | stiffness `70·(0.85 + 0.3·frac(i·0.618))`, damping 9 | — | kekakuan beda tiap item supaya tidak serempak |
| `shape` | scale 0.55 tepi → 1.35 tengah `sin(π·x)`, wobble ±18° periode 3 slot, brightness 0.7 → 1.1 | — | tampilan rak |
| `snap` | setelah 10 frame tanpa input, rate 0.14/frame (R06a) | 0.15–0.25 s | berhenti tepat di satu item (opsional, R07 tidak snap) |
| `layout` | 4 slot per viewport (3 di tablet/mobile), spacing 0.92, track miring 10°, ≥ 8 item | — | duplikasi data kalau item kurang |

**Resep:**
1. Markup: `.shelf (touch-action: pan-y) > .track (rotate 10deg) > a.shelf-item × N`. Duplikasi data sampai ≥ 8 item.
2. Input menulis `target`; tampilan `H` mengejar dengan `damp`. Kecepatan = selisih `H` per detik.
3. Tiap item: wrap modulo, bentuk dari posisi (`sin(π·q)`), lean dari kecepatan lewat spring per item.
4. Rail (R11): strip tipis yang di-`bindDrag`; posisi pointer di rail → `target = −(x / railW)·loop`. Capture membuat jempol boleh keluar rail.
5. Label 3D yang berputar di permukaan toples (R07: satu WebGL renderer offscreen untuk semua item) hanya kalau benar-benar perlu. Versi ringan: label sudah dicetak di gambar.

```js
import { defineSection, damp, createSpring, clamp, followToLambda } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-shelf]'), ({ el, reduced, small }) => {
  const items = [...el.querySelectorAll('.shelf-item')].map((node, i) => ({
    node, lean: createSpring({ stiffness: 70 * (0.85 + 0.3 * ((i * 0.618) % 1)), damping: 9 }),
  }));
  let vw = 0, spacing = 1, loop = 1, H = 0, target = 0, held = false, idle = 0;
  const measure = () => { vw = el.clientWidth; spacing = (vw / (small ? 3 : 4)) * 0.92; loop = items.length * spacing; };
  bindDrag(el, {
    onStart: () => { held = true; },
    onMove: (dx) => { target += dx * 1.5; idle = 0; },
    onEnd: (v) => { held = false; target += clamp(v.x / 1000, -3.5, 3.5) * 1.5 * 190; },   // lempar (R07)
  });
  el.addEventListener('wheel', (e) => {
    e.preventDefault(); idle = 0;
    target -= (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * 1.15;
  }, { passive: false });
  el.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') target -= spacing; if (e.key === 'ArrowLeft') target += spacing; });
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

**Touch, keyboard & reduced-motion:** drag jalan di touch (R07). Hover-spin label dan tarikan kursor dimatikan di touch. Keyboard: ←/→ = satu item, item adalah link; saat fokus, set `target` supaya item itu di tengah. Reduced: R07 hanya mematikan sebagian (twist label dan parallax). Lebih baik: tanpa wobble/lean, snap langsung, smoothing cepat.

**Jebakan:**
- R07 menulis `filter: blur() brightness()` per item per frame. Itu repaint mahal. Blur per item cuma kalau jumlah item kecil, atau ganti dengan gambar blur yang sudah disiapkan.
- R07 rAF jalan terus walau rak diam. Lewati penulisan DOM kalau `|vel|` ≈ 0 dan spring settled.
- Wheel `preventDefault` hanya aman kalau halaman memang tidak punya scroll native di situ (homepage R07 satu layar).
- `touch-action: none` di rak horizontal membunuh scroll vertikal di HP. Pakai `pan-y`.
- Klik item setelah drag harus diblok (R07 pakai capture `click` handler). `bindDrag` sudah melakukannya.

---

### `drag-rotate` — Putar objek dengan drag lurus atau gerakan melingkar
**Sumber:** R11, R09, R06b, R01 · **Mode:** A · **Tingkat berat:** CSS / Canvas2D (3D model kalau objeknya GLB)

**Kapan dipakai:** objek 3D yang bisa diputar user (R11 kamera, R09 ring foto mengorbit), atau carousel yang diputar dengan gerakan melingkar seperti memutar piringan (R06b spiral wind: 36 sampul vinyl, 12 per putaran).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `mode` | `linear` (dx → sudut, R11/R09) · `circular` (Δ`atan2` → sudut, R06b) | — | jenis gesture |
| `coast` | τ 0.55 s (R06b) · damp 2.6/s ≈ τ 0.38 s (R11) | 0.3–0.6 s | lama meluncur setelah dilepas |
| `maxSpin` | 9 rad/s ≈ 515°/s (R11) | — | batas lemparan |
| `slot` | 30° (12 per putaran), settle 0.6 s `outCubic`, min fling 40°/s | 0 (bebas) / 15–45° | snap ke item |
| `lag` | τ 0.06 s (R06b) | 0.04–0.1 s | tampilan sedikit di belakang tangan |
| `deadZone` | 30 px dari pusat (R06b) | 20–40 px | cegah lonjakan sudut di tengah |
| `reward` | 0.2 s setelah diam, spring k150 ζ0.5 (R06b: piringan keluar setengah) | — | detail yang muncul setelah berhenti |

**Resep:**
1. Satu nilai `angle` (derajat) = satu sumber kebenaran. Tulis ke `--angle` dan biarkan CSS/3D membacanya.
2. Linear: `angle += dx · degPerPx`. Melingkar: Δsudut `atan2` di-wrap ke ±180°, abaikan di dalam dead zone.
3. Kecepatan sudut dari waktu antar event; kalau jeda > 80 ms sebelum lepas, anggap 0.
4. Coast `vel *= exp(−dt/τ)`. Di bawah 40°/s: settle ke slot terdekat dengan `ease.outCubic` 0.6 s. Kirim event `rotate:rest` untuk "reward".
5. Wheel (R06b): `angle += deltaY · 0.12`, settle setelah debounce 160 ms.

```js
import { defineSection, damp, ease, clamp } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-rotate]'), ({ el, reduced }) => {
  const CIRC = el.dataset.rotate === 'circular', SLOT = +el.dataset.slot || 0;
  const COAST = CIRC ? 0.55 : 0.38, DEG_PX = 0.35;
  let angle = 0, shown = 0, vel = 0, last = 0, lt = 0, held = false, settle = null;
  const polar = (e) => { const b = el.getBoundingClientRect(), x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2; return [Math.atan2(y, x), Math.hypot(x, y)]; };
  const settleTo = (to) => { settle = { from: angle, to, t: 0 }; vel = 0; };
  const snap = () => SLOT && settleTo(Math.round(angle / SLOT) * SLOT);
  bindDrag(el, {
    onStart: (e) => { held = true; settle = null; vel = 0; [last] = polar(e); lt = performance.now(); },
    onMove: (dx, _dy, e) => {
      let d = dx * DEG_PX;
      if (CIRC) { const [a, r] = polar(e); d = r < 30 ? 0 : (Math.atan2(Math.sin(a - last), Math.cos(a - last)) * 180) / Math.PI; last = a; }
      const now = performance.now(); vel = d / Math.max((now - lt) / 1000, 1 / 120); lt = now; angle += d;
    },
    onEnd: () => {
      held = false;
      vel = performance.now() - lt > 80 || reduced ? 0 : clamp(vel, -515, 515);   // berhenti dulu = tanpa lempar
      if (Math.abs(vel) < 40) snap();
    },
  });
  el.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], step = SLOT || 15;
    if (k) { e.preventDefault(); settleTo((Math.round(angle / step) + k) * step); }
  });
  return {
    update(dt) {
      if (settle) {
        settle.t = Math.min(1, settle.t + dt / (reduced ? 1e-3 : 0.6));
        angle = settle.from + (settle.to - settle.from) * ease.outCubic(settle.t);
        if (settle.t === 1) { settle = null; el.dispatchEvent(new Event('rotate:rest')); }
      } else if (!held && vel) {
        angle += vel * dt; vel *= Math.exp(-dt / COAST);
        if (Math.abs(vel) < 40) { vel = 0; snap(); }
      }
      shown = damp(shown, angle, reduced ? 1e3 : 1 / 0.06, dt);
      el.style.setProperty('--angle', `${shown.toFixed(2)}deg`);
    },
  };
});
```

**Touch, keyboard & reduced-motion:** jalur pointer sama untuk touch; `touch-action: none` hanya di objeknya, bukan seluruh section. Keyboard: panah = satu slot (R06b), objek `tabindex="0"` + `aria-label`. Reduced: tanpa coast, langsung snap, tanpa idle drift (R11/R09 punya drift sinus pelan saat idle).

**Jebakan:**
- R01: `camera-controls` model-viewer aktif tapi loop menulis `cameraOrbit` tiap frame, jadi drag user langsung ditimpa. Satu pemilik sudut.
- Δ`atan2` tanpa wrap ke ±180° = lonjakan hampir 360° saat tangan melewati sisi kiri.
- Gesture melingkar perlu onboarding: R06b menampilkan cincin panduan dengan tick per sampul dan titik di sudut tangan. Tanpa itu, user men-drag lurus dan bingung.
- Lepas setelah berhenti tetap dihitung lempar kalau tidak ada cek "basi" 80 ms.
- R06b spiral menggambar perspektif di Canvas 2D dengan memotong tiap sampul jadi 12 strip `drawImage`. Untuk beberapa item, CSS `rotateY` + `perspective` lebih sederhana.

---

### `throwable-cards` — Kartu yang bisa diangkat dan dilempar
**Sumber:** R06b, R13 · **Mode:** A (B sebagai landing "meja kerja") · **Tingkat berat:** CSS (R06b: Canvas2D)

**Kapan dipakai:** moodboard, foto tim, kartu testimonial yang berserakan di meja. Dipegang di titik mana pun, berayun seperti kertas yang dipegang di pojok, dilempar, melambat karena friksi, memantul di tepi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `slideTau` / `spinTau` | 0.42 s / 0.38 s | 0.3–0.6 s | lama meluncur dan berputar |
| `restitution` | 0.5 (komponen normal), friksi dinding 0.3 | 0.3–0.7 | seberapa membal di tepi |
| `swing` | 0.9/frame × (jarak grip / setengah ukuran), mati kalau grip < 6% | 0.6–0.95 | badan tertinggal di belakang titik pegang |
| `throw` | kecepatan 100 ms terakhir; R13 mengalikan 0.45 | 0.45–1 | lemparan penuh atau kalem |
| `lift` | naik 0.18 s, turun 0.3 s, scale +3.5%, bayangan 4 → 18 px | — | rasa "terangkat" |
| `size` | min(W,H) × 0.27 (0.42 kalau W < 600) | — | ukuran print |
| `impact` | glow 1.1 s dari kecepatan 160 → 1700 px/s, squash k900 ζ0.3 maks 0.04 | — | feedback tabrakan |

**Resep:**
1. Pointerdown: ubah titik tekan ke koordinat lokal kartu (rotasi terbalik), naikkan `z-index`, tambah class `is-lifted`.
2. Saat dipegang: putar kartu supaya titik grip berada di depan arah gerak, lalu paksa grip tepat di bawah tangan.
3. Lepas: kecepatan dari `bindDrag` (sudah ada aturan basi 80 ms). Integrasi bebas dengan decay `exp(−dt/τ)`.
4. Tabrakan dinding: impulse dengan restitusi 0.5 + impulse friksi tangensial. Friksi itulah yang menghasilkan spin. (R06b memakai impulse rigid-body penuh dengan titik kontak di sudut; versi di bawah memakai titik kontak di tengah sisi, cukup meyakinkan dan jauh lebih pendek.)

```js
import { defineSection } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-light-table]'), ({ el, reduced }) => {
  let W = el.clientWidth, H = el.clientHeight, z = 1;
  const S = Math.min(W, H) * (W < 600 ? 0.42 : 0.27), h = S / 2, I = (S * S) / 6;     // momen inersia persegi
  const cards = [...el.querySelectorAll('.print')].map((node) => ({ node, x: h + Math.random() * (W - S), y: h + Math.random() * (H - S), a: Math.random() - 0.5, vx: 0, vy: 0, va: 0, g: null, hx: 0, hy: 0 }));
  cards.forEach((c) => bindDrag(c.node, { slop: 0,
    onStart: (e) => { const b = el.getBoundingClientRect(); c.hx = e.clientX - b.left; c.hy = e.clientY - b.top;
      const dx = c.hx - c.x, dy = c.hy - c.y, co = Math.cos(c.a), si = Math.sin(c.a);
      c.g = { lx: dx * co + dy * si, ly: -dx * si + dy * co }; c.node.style.zIndex = ++z; c.node.classList.add('is-lifted'); },
    onMove: (dx, dy) => { c.hx += dx; c.hy += dy; },
    onEnd: (v) => { c.g = null; c.node.classList.remove('is-lifted'); c.vx = reduced ? 0 : v.x; c.vy = reduced ? 0 : v.y; if (reduced) c.va = 0; },
  }));
  const bounce = (c, nx, ny) => {                         // n = normal dinding ke dalam meja
    const vn = c.vx * nx + c.vy * ny; if (vn >= 0) return;
    const jx = -0.3 * (c.vx - vn * nx), jy = -0.3 * (c.vy - vn * ny);        // friksi tangensial 0.3
    c.vx += -1.5 * vn * nx + jx; c.vy += -1.5 * vn * ny + jy;                 // restitusi 0.5
    c.va += (-nx * h * jy + ny * h * jx) / I;                                  // r × J → spin
    c.node.dispatchEvent(new CustomEvent('impact', { detail: -vn }));          // glow/squash di listener
  };
  return {
    onResize() { W = el.clientWidth; H = el.clientHeight; },
    update(dt) {
      for (const c of cards) {
        if (c.g) {
          const len = Math.hypot(c.g.lx, c.g.ly), a0 = c.a;
          if (len > S * 0.06) {                           // swing: badan tertinggal di belakang titik pegang
            const want = Math.atan2(c.y - c.hy, c.x - c.hx), now = Math.atan2(c.g.ly, c.g.lx) + c.a + Math.PI;
            c.a += Math.atan2(Math.sin(want - now), Math.cos(want - now)) * (1 - Math.pow(1 - 0.9 * Math.min(1, len / h), dt * 60));
          }
          const co = Math.cos(c.a), si = Math.sin(c.a);
          c.x = c.hx - (c.g.lx * co - c.g.ly * si); c.y = c.hy - (c.g.lx * si + c.g.ly * co); c.va = (c.a - a0) / dt;
        } else {
          c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.va * dt;
          const f = Math.exp(-dt / 0.42); c.vx *= f; c.vy *= f; c.va *= Math.exp(-dt / 0.38);
          if (c.x < h) { c.x = h; bounce(c, 1, 0); } if (c.x > W - h) { c.x = W - h; bounce(c, -1, 0); }
          if (c.y < h) { c.y = h; bounce(c, 0, 1); } if (c.y > H - h) { c.y = H - h; bounce(c, 0, -1); }
        }
        c.node.style.transform = `translate3d(${c.x - h}px,${c.y - h}px,0) rotate(${c.a}rad)`;
      }
    },
  };
});
/* CSS: .print { position: absolute; left: 0; top: 0; width: var(--s); touch-action: none; transition: scale .3s, filter .3s; }
        .print.is-lifted { scale: 1.035; filter: drop-shadow(0 18px 22px rgb(0 0 0 / .35)); transition-duration: .18s; } */
```

**Touch, keyboard & reduced-motion:** satu pointer per kartu sudah cukup (R06b tidak mendukung multi-touch throw). `touch-action: none` di kartu saja, bukan di meja, supaya meja kosong tetap bisa di-scroll. Keyboard: kartu `tabindex="0"`, panah geser 40 px, Enter = ke paling atas; sediakan juga versi daftar biasa. Reduced: drag tetap jalan (digerakkan user), tapi tanpa lempar, ayun, dan squash.

**Jebakan:**
- Kalau "angkat" dibuat dengan clone `position: fixed`, clone itu memblok klik ke elemen di bawahnya. Clone wajib `pointer-events: none`, atau lebih baik angkat elemen aslinya seperti di atas.
- Bayangan `box-shadow` blur besar per frame itu mahal. R06b memakai satu sprite bayangan yang di-blur sekali. Di DOM, cukup kasih `filter` hanya ke kartu yang sedang diangkat.
- Tanpa aturan basi 80 ms, user yang berhenti dulu baru melepas tetap melempar kartu.
- Saat resize, kartu bisa berada di luar meja. Clamp posisi di `onResize`.
- Tanpa `++z`, kartu yang dipegang bisa berada di bawah kartu lain.

---

### `draw-to-reveal-trail` — Menggambar jalur yang memunculkan foto
**Sumber:** R06b · **Mode:** A (B sebagai landing instalasi) · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** hero atau section "playground" di mana user menggambar garis dan foto/kata/ikon bermunculan di sepanjang jalur, diwarnai sesuai posisi layar, lalu hilang berurutan.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `spacing` | 0.55–0.85 × ukuran foto; gap pertama 16 px | — | kerapatan foto di jalur |
| `size` | 100 px × acak 0.3–1.5 × `clamp(min(W,H)/800, 0.55, 1)` | 30–150 px | variasi ukuran |
| `hue` | `215 + 175·x/W + 50·(y/H − 0.5)` (biru kiri → oranye kanan) | — | warna dari posisi |
| `timing` | grow 0.5 s `outCubic` (scale 0.2 → 1), tahan sampai 1 s, go 0.5 s | — | umur tiap foto |
| `line` | 1.2 px, alpha 0.5 → 0 dalam 1.25 s | — | jejak pena |
| `maxItems` | 240 (ring buffer) | 120–300 | batas memori |

**Resep:**
1. Pointer dengan `slop: 0`. Titik baru hanya kalau bergerak ≥ 2 px. Akumulasi panjang jalur; setiap lewat `gap`, spawn satu foto.
2. Foto digeser tegak lurus jalur ±0.12·size, dirotasi mengikuti arah garis (dilipat ke ±90°) × 0.25 ± 0.22 rad.
3. Tint **sekali saat spawn** ke canvas kecil ≤ 240 px (`globalCompositeOperation = 'color'`, alpha 0.8). Jangan tint per frame.
4. Hilang berurutan gratis: umur dihitung dari waktu lahir, jadi urutan lahir = urutan pergi.
5. Wajib ada stroke demo otomatis (`ghost-hand` atau sinus) supaya section tidak kosong saat pertama dibuka.

```js
import { defineSection, lerp, clamp, ease } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-draw]'), ({ el }) => {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), imgs = [...el.querySelectorAll('img')];
  const items = [];
  let W = 0, H = 0, dpr = 1, run = 0, gap = 16, n = 0, lx = 0, ly = 0, clock = 0;   // clock sendiri, bukan performance.now()
  const resize = () => { dpr = Math.min(devicePixelRatio, 2); W = el.clientWidth; H = el.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  const tinted = (img, size, hue) => {
    const c = document.createElement('canvas'); c.width = c.height = Math.min(240, Math.ceil(size * dpr));
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'color'; g.fillStyle = `hsl(${hue} 70% 50% / .8)`; g.fillRect(0, 0, c.width, c.height);
    return c;
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
  bindDrag(cv, { slop: 0, onStart: (e) => { [lx, ly] = local(e); run = 0; gap = 16; }, onMove: (_x, _y, e) => add(...local(e)) });
  resize();
  return {
    onResize: resize,
    update(dt) {
      clock += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      while (items.length && clock - items[0].born > 1.5) items.shift();
      for (const it of items) {
        const age = clock - it.born, k = age < 0.5 ? lerp(0.2, 1, ease.outCubic(age / 0.5)) : age < 1 ? 1 : 1 - ease.outCubic((age - 1) / 0.5);
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(k, k); ctx.globalAlpha = clamp(k * 1.6);
        ctx.drawImage(it.img, -it.size / 2, -it.size / 2, it.size, it.size); ctx.restore();
      }   // garis pena 1.2 px yang pudar 1.25 s: simpan titik + waktu, pangkas dari depan, gambar dengan alpha
    },
  };
});
```

**Touch, keyboard & reduced-motion:** touch = jalur yang sama; `touch-action: none` di canvas, jadi beri section tinggi yang wajar dan ruang scroll di luar canvas. Keyboard: konten foto juga tersedia sebagai galeri biasa di DOM (canvas `aria-hidden`). Reduced: foto muncul tanpa grow (k = 1) dan hilang dengan fade singkat; tetap boleh karena digerakkan user.

**Jebakan:**
- Pakai `performance.now()` untuk umur item: setelah tab kembali aktif, semua item hilang sekaligus (R06b sampai harus menggeser timestamp kalau jeda frame > 100 ms). Clock sendiri dari `dt` yang di-clamp ticker menyelesaikannya.
- Tint atau blur per frame per foto = frame drop. Rasterisasi sekali saat spawn.
- Loop menggambar terus walau kosong. Kalau `items` kosong dan garis habis, lewati `clearRect` setelah satu frame bersih.
- Tanpa demo stroke, section terlihat seperti kotak kosong yang rusak.

---

### `plucked-string-type` — Tipografi kawat yang bisa dipetik
**Sumber:** R06b · **Mode:** A (B sebagai intro type foundry) · **Tingkat berat:** Canvas2D/SVG

**Kapan dipakai:** wordmark hero atau footer brand yang hurufnya digambar sebagai garis tunggal. Pointer pelan mendorong huruf (lihat `proximity-spring`), pointer cepat memetik kawat yang lalu bergetar dan meluruh.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `letterSpring` | k 160, ζ 0.2; tolak 8000·(1−r/R)², R = 1.125 × huruf, knock ×2.2 | — | huruf menyingkir saat pointer pelan |
| `slip` | `min(panjang × 0.34, huruf × 0.4)` | 0.25–0.4 | kawat lepas dari jari |
| `freq` | `clamp(360 / panjang_px, 2, 5.5)` Hz | — | kawat pendek bergetar lebih cepat |
| `ring` | mode ke-n meluruh `exp(−t·n²/0.95)`, 4 mode | 3–5 mode, τ 0.6–1.2 s | lama getaran |
| `settle` | getaran berhenti kalau amplitudo fundamental < 0.12 px | — | loop bisa diam |
| `color` | energi → 5 level × 24 bucket hue (hue = posisi x × 300°) | — | kawat yang bergetar berwarna |

**Resep:**
1. Definisikan glyph sebagai daftar primitif `line` / `arc` (unit em), bukan dari font file. Batasi ke huruf yang dipakai. Sampling tiap ~6 px.
2. Tiap frame, segmen gerak pointer (frame lalu → sekarang) diuji **segment–segment intersection** dengan tiap kawat. Kena = kawat dipegang.
3. Saat dipegang, bentuk kawat = segitiga lembut di titik pegang. Lepas (slip, keluar ujung, atau pointer pergi) → proyeksikan bentuk ke 4 mode sinus.
4. Gambar: titik_i = dasar_i + normal × `offset(u)`. Kelompokkan kawat dengan warna sama ke satu `Path2D` lalu `stroke()` sekali (R06b ≤ ~120 stroke per frame).
5. "Pelan = miring, cepat = petik" muncul sendiri karena gaya tolak huruf besar: kalau pointer pelan, huruf sudah menyingkir sebelum kawat sempat terpotong.

```js
import { clamp } from './motion-core.js';

const shape = (t, u) => (u <= t ? Math.sin((Math.PI / 2) * (u / t)) : Math.sin((Math.PI / 2) * ((1 - u) / (1 - t))));
const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
export function createWire(A, B, letterSize) {                     // A, B = {x, y} ujung kawat (px)
  const len = Math.hypot(B.x - A.x, B.y - A.y), nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
  const freq = clamp(360 / len, 2, 5.5), seg = Math.max(10, Math.round(len / 6)), slip = Math.min(len * 0.34, letterSize * 0.4);
  let held = null, amp = [0, 0, 0, 0], since = 0;
  const w = {
    nx, ny, seg,
    pointer(p0, p1, clock) {                                      // segmen gerak pointer frame ini
      const cross = side(A, B, p0) * side(A, B, p1) < 0 && side(p0, p1, A) * side(p0, p1, B) < 0;
      if (cross && !held) held = { t: 0.5, d: 0 };
      if (!held) return;
      const u = ((p1.x - A.x) * (B.x - A.x) + (p1.y - A.y) * (B.y - A.y)) / (len * len);
      held.t = clamp(u, 0.05, 0.95); held.d = (p1.x - A.x) * nx + (p1.y - A.y) * ny;
      if (u < 0.05 || u > 0.95 || Math.abs(held.d) > slip) w.release(clock);   // slip
    },
    release(clock) {                                              // proyeksi ke 4 mode sinus (trapesium)
      if (!held) return;
      amp = [1, 2, 3, 4].map((n) => {
        let s = 0;
        for (let i = 0; i <= seg; i++) { const u = i / seg; s += (i % seg ? 1 : 0.5) * held.d * shape(held.t, u) * Math.sin(n * Math.PI * u); }
        return (2 * s) / seg;
      });
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

**Touch, keyboard & reduced-motion:** di desktop hover saja cukup; di touch kawat hanya dipetik saat jari menekan (R06b mengecek `buttons`). Teks asli wajib ada di DOM (heading visually-hidden) karena canvas tidak terbaca screen reader. Reduced: gambar huruf statis (offset 0), tanpa getaran dan tanpa warna energi.

**Jebakan:**
- Tanpa gaya tolak huruf yang kuat, setiap lintasan pelan juga memetik, dan efeknya jadi berisik.
- Integrasi spring/inersia di frekuensi tinggi meledak kalau `ω·dt` terlalu besar. R06b men-substep sampai `ω·dt ≤ 0.3`.
- Satu `stroke()` per kawat per frame itu lambat. Batch per warna.
- Butuh definisi glyph single-stroke sendiri. Sertakan waktu desain ini di estimasi.

---

### `semantic-zoom` — Mosaik yang di-zoom sampai jadi foto
**Sumber:** R06b · **Mode:** A+B · **Tingkat berat:** Canvas2D

**Kapan dipakai:** arsip foto besar yang dari jauh membentuk satu gambar (32 × 32 sel warna). Zoom in = sel berubah jadi foto, tint memudar, lalu judul muncul. Mode B cocok sebagai homepage arsip atau view "all projects".

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `grid` | 32 × 32 | 16–48 | resolusi mosaik |
| `lag` | τ 0.12 s, skala di-follow di **log space** | 0.08–0.2 s | zoom terasa rata di semua level |
| `glide` | pan `v *= exp(−dt/0.35)` | 0.25–0.5 s | luncuran setelah pan |
| `wheel` | `scale *= exp(−deltaY·0.0016)`; pinch trackpad (`ctrlKey`) 0.012 | — | sensitivitas zoom |
| `limits` | min: sel = min(W,H)/32 × 0.9 · max: sel = min(W,H) × 0.86 | — | seluruh mosaik muat ↔ satu foto hampir penuh |
| `lod` | foto 22 → 64 px, tint 0.55 hilang 40 → 200, judul 260 → 420, hi-res > 600 | — | apa yang tampil di ukuran sel tertentu |
| `fly` | double-tap (2 tap < 320 ms) → 0.9 s `inOutCubic` ke sel × 0.8 max | — | lompat masuk/keluar |

**Resep:**
1. Peta mosaik dibuat sekali: gambar sumber di-`drawImage` ke 32 × 32, tiap piksel pilih satu dari 4 foto dengan tone rata-rata terdekat. Tone 3 warna per foto di-precompute saat build.
2. Kamera: `zoomAt(sx, sy, f)` menjaga titik world di bawah kursor tetap di tempat.
3. Pinch: dua pointer di `Map`; rasio jarak = zoom, pergeseran midpoint = pan. Satu pointer = pan 1:1.
4. Render hanya sel yang terlihat (cull lewat rentang index). Opacity tiap lapis dari `mapRange(ukuranSel, a, b)`.
5. Foto dimuat on-demand dengan 3 tingkat (96 px canvas → small > 200 → large > 600).

```js
import { defineSection, clamp, mapRange } from './motion-core.js';

defineSection(document.querySelector('[data-mosaic]'), ({ el, reduced }) => {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), N = 32;
  let W = 0, H = 0, minS = 1, maxS = 1, s = 1, ts = 1, cx = N / 2, cy = N / 2, tcx = cx, tcy = cy, pinch = 0;
  const resize = () => { W = cv.width = el.clientWidth; H = cv.height = el.clientHeight;
    minS = (Math.min(W, H) / N) * 0.9; maxS = Math.min(W, H) * 0.86; ts = s = clamp(s, minS, maxS); };
  const zoomAt = (sx, sy, f) => {                          // s = px per sel; world unit = 1 sel
    const wx = (sx - W / 2) / ts + tcx, wy = (sy - H / 2) / ts + tcy;
    ts = clamp(ts * f, minS, maxS); tcx = wx - (sx - W / 2) / ts; tcy = wy - (sy - H / 2) / ts;
  };
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  const pts = new Map();
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
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  resize();
  return {
    onResize: resize,
    update(dt) {
      const k = reduced ? 1 : 1 - Math.exp(-dt / 0.12);
      s = Math.exp(Math.log(s) + (Math.log(ts) - Math.log(s)) * k);   // follow skala di log space
      cx += (tcx - cx) * k; cy += (tcy - cy) * k;
      const lod = { photo: mapRange(s, 22, 64), tint: 0.55 * (1 - mapRange(s, 40, 200)), label: mapRange(s, 260, 420) };
      drawVisibleCells(ctx, { W, H, s, cx, cy, N, lod });          // cull: hanya index sel di dalam layar
    },
  };
});
```

**Touch, keyboard & reduced-motion:** pinch dua jari native lewat pointer, `touch-action: none` mencegah browser zoom. Safari trackpad butuh `gesturestart/gesturechange` tambahan. Keyboard (tidak ada di R06b): `+`/`−` = `zoomAt(tengah, 1.25)`, panah = pan satu sel, Enter = fly ke sel tengah. Reduced: tanpa lag, tanpa glide, fly jadi lompat instan.

**Jebakan:**
- Follow skala secara linear (bukan log) membuat zoom terasa lambat di awal lalu ngebut di akhir.
- Lupa koreksi `zoomAt` = mosaik "lari" dari kursor saat di-zoom.
- Clamp center: kalau mosaik lebih kecil dari layar, kunci ke tengah; kalau lebih besar, boleh lewat 0.3 sel dari tepi (R06b). Tanpa itu user bisa kehilangan mosaik di luar layar.
- Memuat semua foto resolusi besar sekaligus. Hanya sel yang terlihat, dengan tingkat sesuai ukuran sel.

---

### `physics-drop-field` — Klik menjatuhkan benda yang menumpuk
**Sumber:** R14, R07 · **Mode:** A+B · **Tingkat berat:** CSS + Matter.js (DOM digerakkan body fisika)

**Kapan dipakai:** section penutup/footer playground: tiap klik menjatuhkan satu "chip" (potongan visual dari halaman itu sendiri) yang menumpuk (R14). Atau loader/aksen brand: ilustrasi buah berjatuhan dan bertumpuk (R07).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `body` | restitution 0.15, friction 0.4, frictionAir 0.01 (R14) · restitution 0.03, friction 0.82 (R07) | — | membal vs "berat dan lengket" |
| `gravity` | 1 (scale 0.001, R14) · 3.35–3.5 (R07 loader/hover) | 1–5 | kecepatan jatuh |
| `spawn` | di titik klik, naik 0.35 × tinggi chip, sudut ±0.2 rad | — | posisi lahir |
| `size` | `w × 0.5 × innerWidth/1440` | — | skala dari artboard |
| `maxBodies` | 30, FIFO | 20–60 | > 60: nyalakan `enableSleeping` |
| `scrollFlip` | kecepatan scroll > 0.15 vh/s → gravity −0.2 | — | chip melayang saat scroll cepat |
| `bounds` | lantai + 2 dinding tinggi 3×, **tanpa atap** | — | chip yang terbang keluar atas dibuang |

**Resep:**
1. Muat Matter.js 0.20.0 (`<script>` dari cdnjs). Satu engine per field, **tanpa `Runner`**: di-step dari `update(dt)` supaya satu clock dengan halaman dan otomatis pause saat off-screen.
2. Batas: lantai di bawah field + 2 dinding di luar sisi, dibangun ulang saat resize.
3. Klik → pilih chip acak, buat body (rect / circle / `fromVertices` untuk bentuk lain) + elemen `<img>` dengan origin di tengah (`margin: −size/2`).
4. Tiap frame: `Engine.update(engine, min(dt, 32 ms))`, lalu tulis `translate + rotate` dari body ke DOM.
5. Varian handoff (R14): elemen dari section sebelumnya mengecil lewat scroll lalu "diserahkan" ke engine sebagai body dengan kecepatan visual terakhirnya. Saat scroll balik, body disetir kembali ke lintasan (`setVelocity` ke target, `angle *= 0.75`) lalu dilepas dari engine.
6. Varian R07: collider dari hull titik path SVG, gravity 3.35, dipicu load atau hover.

```js
import { defineSection } from './motion-core.js';
const { Engine, Bodies, Body, Composite } = window.Matter;     // <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js">

defineSection(document.querySelector('[data-drop-field]'), ({ el, reduced }) => {
  const engine = Engine.create(), CHIPS = JSON.parse(el.dataset.chips);   // [{src, w, h, round?}] px artboard 1440
  const chips = []; let walls = [], lastY = scrollY;
  const build = () => {
    Composite.remove(engine.world, walls);
    const w = el.clientWidth, h = el.clientHeight, S = { isStatic: true };
    walls = [Bodies.rectangle(w / 2, h + 100, w + 400, 200, S), Bodies.rectangle(-100, h / 2, 200, h * 3, S), Bodies.rectangle(w + 100, h / 2, 200, h * 3, S)];
    Composite.add(engine.world, walls);                       // lantai + 2 dinding, TANPA atap
  };
  const kill = (c) => { Composite.remove(engine.world, c.body); c.node.remove(); chips.splice(chips.indexOf(c), 1); };
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect(), sc = r.width / el.clientWidth;          // aman walau parent di-scale
    const x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
    const c = CHIPS[(Math.random() * CHIPS.length) | 0], k = (0.5 * innerWidth) / 1440, w = c.w * k, h = c.h * k;
    const opt = { restitution: 0.15, friction: 0.4, frictionAir: 0.01 };
    const body = c.round ? Bodies.circle(x, y - h * 0.35, w / 2, opt) : Bodies.rectangle(x, y - h * 0.35, w, h, opt);
    Body.setAngle(body, (Math.random() - 0.5) * 0.4);
    const node = Object.assign(new Image(), { src: c.src, alt: '', className: 'chip' });
    Object.assign(node.style, { width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px` });
    el.append(node); Composite.add(engine.world, body); chips.push({ node, body });
    if (chips.length > 30) kill(chips[0]);                                       // FIFO
    if (reduced) for (let i = 0; i < 240; i++) Engine.update(engine, 16);         // reduced: langsung diam
  });
  build();
  return {
    onResize: build,
    update(dt) {
      const dy = Math.abs(scrollY - lastY); lastY = scrollY;
      const speed = dy > innerHeight ? 0 : dy / Math.max(dt, 0.004) / innerHeight;  // abaikan loncatan saat section masuk lagi
      engine.gravity.y = !reduced && speed > 0.15 ? -0.2 : 1;
      Engine.update(engine, Math.min(dt * 1000, 32));
      for (const c of [...chips]) {
        const { x, y } = c.body.position;
        if (y < -el.clientHeight) { kill(c); continue; }                         // terbang keluar atas
        c.node.style.transform = `translate3d(${x}px,${y}px,0) rotate(${c.body.angle}rad)`;
      }
    },
  };
});
/* CSS: [data-drop-field] { position: relative; overflow: hidden; cursor: crosshair; touch-action: manipulation; }
        .chip { position: absolute; left: 0; top: 0; will-change: transform; pointer-events: none; } */
```

**Touch, keyboard & reduced-motion:** R14 desktop-only (splash di ≤ 767 px). `pointerdown` sudah jalan di touch; pakai `touch-action: manipulation` supaya scroll tetap hidup dan chip minimum ±48 px. Keyboard: tombol "Drop" di field yang men-spawn di x acak. Reduced: R14 tidak punya cabang reduced. Pre-simulasi ±240 step supaya chip langsung diam di tumpukan, tanpa gravity flip, dan matikan kedip teks; R07 mengganti fisika dengan susunan statis.

**Jebakan:**
- Ukur kecepatan scroll **sebelum** early-return/pause. Di R14 posisi scroll terakhir bisa basi saat field aktif lagi, dan frame pertama terbaca sebagai scroll super cepat (gravity terbalik sekejap).
- `Matter.Runner` membuat loop kedua di luar clock halaman. Step manual dengan `dt` di-clamp 32 ms (anti tunneling setelah tab lag).
- `fromVertices` memusatkan body di centroid. Simpan offset centroid → pusat gambar dan putar sesuai sudut body, kalau tidak gambar dan collider tidak pas.
- Chip yang sudah ada tidak ikut di-rescale saat resize (R14). Terima saja atau rebuild semua.
- Layer teks di atas field wajib `pointer-events: none` supaya klik tembus ke field.

---

### `verlet-rope` — Kartu tergantung di tali
**Sumber:** R13, R06a · **Mode:** A · **Tingkat berat:** Canvas2D/SVG (R13: 3D dengan Three.js)

**Kapan dipakai:** ID card/lanyard di halaman about atau studio, tag harga yang menggantung, lampu dengan kabel yang bisa ditarik. Ditarik, dilempar, berayun, dan di HP ikut kemiringan device.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `step` | 1/120 s fixed, accumulator, maks 8 substep/frame | — | stabil di 60/120 Hz |
| `gravity` | 34 unit/s² (≈ 3400 px/s² kalau 1 unit = 100 px) | — | periode ayun ≈ 2.5 s |
| `damp` / `vmax` | 0.988 per step / 0.14 unit/step (14 px) | 0.98–0.995 | redaman dan batas kecepatan |
| `iters` | 10 | 6–14 | kekakuan solver |
| `seg` | 0.22 unit (22 px), ±10–14 partikel | — | resolusi tali |
| `stretch` / `bend` | 0.9 (i–i+1) / 0.35 (i–i+2) | bend 0 = tali, 1 = batang | kelenturan |
| `drag` | hold 0.55, follow 0.2, throw 0.45 | — | "give" saat ditarik dan lemparan kalem |
| `idle` | breeze 0.0012, nudge 0.01 tiap 8 s ±40% | — | gerak hidup saat diam |

**Resep:**
1. Partikel `{x, y, px, py, w}` (`w = 0` = paku/kinematik). Integrasi Verlet: kecepatan = posisi − posisi lama, dikali damp, di-clamp vmax, ditambah gravitasi.
2. Constraint jarak `{a, b, d, k}` diselesaikan N iterasi, dibagi menurut `w`.
3. Tali: partikel tiap `seg`, link i–i+1 (k 0.9) dan i–i+2 (k 0.35).
4. Kartu: versi ringan di bawah = elemen DOM yang ditempel di partikel terakhir dan diputar sesuai arah segmen terakhir. R13 memakai 6 partikel kartu dengan 15 constraint all-pairs supaya kartu jadi rigid body 3D.
5. Drag: partikel "tangan" kinematik di titik tekan, disambung ke ujung tali dengan k 0.55. Tangan mengejar pointer dengan lerp 0.2 per step. Lepas: kecepatan dikali 0.45.
6. Varian angin (R06a): kalau kursor lewat dalam 90–210 px dari sebuah partikel, `p.px -= vx·k` (di Verlet, menggeser posisi lama = menambah kecepatan).

```js
import { defineSection, lerp } from './motion-core.js';
import { bindDrag } from './pointer-kit.js';

defineSection(document.querySelector('[data-lanyard]'), ({ el }) => {
  const rope = el.querySelector('path'), card = el.querySelector('.pass');
  const SEG = 22, G = 3400, DAMP = 0.988, VMAX = 14, ITERS = 10, STEP = 1 / 120;   // R13, 1 unit = 100 px
  const P = (x, y, w = 1) => ({ x, y, px: x, py: y, w });
  const C = (a, b, k) => ({ a, b, k, d: Math.hypot(b.x - a.x, b.y - a.y) });
  const ax = el.clientWidth / 2, pts = Array.from({ length: 12 }, (_, i) => P(ax, i * SEG, i ? 1 : 0));
  const cons = pts.slice(1).flatMap((p, i) => [C(pts[i], p, 0.9), ...(pts[i + 2] ? [C(pts[i], pts[i + 2], 0.35)] : [])]);
  const hand = P(0, 0, 0), aim = { x: 0, y: 0 }; let grab = null, acc = 0;
  bindDrag(card, { slop: 0,
    onStart: (e) => { const b = el.getBoundingClientRect(); hand.x = aim.x = e.clientX - b.left; hand.y = aim.y = e.clientY - b.top;
      grab = C(hand, pts.at(-1), 0.55); grab.d = 0; cons.push(grab); },
    onMove: (dx, dy) => { aim.x += dx; aim.y += dy; },
    onEnd: () => { cons.splice(cons.indexOf(grab), 1); grab = null;
      for (const p of pts) { p.px = lerp(p.x, p.px, 0.45); p.py = lerp(p.y, p.py, 0.45); } },   // throw 0.45
  });
  const step = () => {
    if (grab) { hand.x = lerp(hand.x, aim.x, 0.2); hand.y = lerp(hand.y, aim.y, 0.2); }   // follow 0.2
    for (const p of pts) {
      if (!p.w) continue;
      let vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP; const v = Math.hypot(vx, vy);
      if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; }
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + G * STEP * STEP;
    }
    for (let i = 0; i < ITERS; i++) for (const c of cons) {
      const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, len = Math.hypot(dx, dy) || 1e-6, W = c.a.w + c.b.w; if (!W) continue;
      const f = ((len - c.d) / len) * c.k;
      c.a.x += (dx * f * c.a.w) / W; c.a.y += (dy * f * c.a.w) / W; c.b.x -= (dx * f * c.b.w) / W; c.b.y -= (dy * f * c.b.w) / W;
    }
  };
  return {
    update(dt) {
      acc += dt; let n = 0; while (acc >= STEP && n++ < 8) { step(); acc -= STEP; }      // fixed step, maks 8
      rope.setAttribute('d', 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L'));
      const a = pts.at(-1), b = pts.at(-2);
      card.style.transform = `translate3d(${a.x}px,${a.y}px,0) rotate(${Math.atan2(a.y - b.y, a.x - b.x) - Math.PI / 2}rad)`;
    },
    renderStatic() {},                                        // reduced: kartu statis tergantung lurus (CSS)
  };
});
/* CSS: .pass { position: absolute; left: 0; top: 0; transform-origin: 50% 0; translate: -50% 0; touch-action: none; } */
```

**Touch, keyboard & reduced-motion:** drag sama di touch. Di HP R13 mengubah arah gravitasi dari `devicemotion` (dead band 1.2 m/s², faktor tilt 0.16, low-pass 0.015; guncangan > 9 m/s² = impuls); iOS wajib `DeviceMotionEvent.requestPermission()` dari gesture (R13 memanggilnya saat jari diangkat). Keyboard: kartu `tabindex="0"`, Enter = flip / dorongan kecil. Klik singkat (< 6 px, < 320 ms) = flip kartu di R13. Reduced: R13 tidak me-mount fisika sama sekali, hanya kartu statis.

**Jebakan:**
- Verlet dengan `dt` variabel meledak. Wajib fixed step + accumulator, dan batasi substep (8) supaya tidak terjadi spiral of death setelah tab lag.
- Angka R13 dalam "world unit". Di piksel, gravity dan vmax harus diskalakan (×100 di atas), kalau tidak tali jatuh terlalu lambat atau terlalu cepat.
- Tali polyline terlihat patah-patah. R13 menggambar ribbon lewat Catmull-Rom 56 sampel; di SVG cukup ganti `L` dengan kurva `Q`/`C` antar titik tengah.
- Tanpa `touch-action: none` di kartu, menarik kartu ke bawah di HP malah men-scroll halaman.

---

### `tactile-feedback-kit` — Squash-stretch, click burst, platformer
**Sumber:** R08 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** lapisan polish yang membuat situs terasa "fisik" dan playful: tombol yang gepeng lalu membal, gambar kecil yang meletup di titik klik, dan (bonus) karakter kecil yang bisa dijalankan dengan keyboard dan berdiri di atas elemen halaman.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `press` | scale 1.08 / 0.9, 0.14 s `power3.in` | 1.04–1.1 / 0.88–0.95 | gepeng melebar saat ditekan |
| `release` | 0.96 / 1.04 lalu `elastic.out(1.3, 0.3)` 0.45 s → spring stiffness 600, damping 11 (ζ ≈ 0.22) | ζ 0.15–0.35 | membal |
| `burst` | scale 0 → 0.3–0.43, rotasi acak ±25°, `back.out(1.6)` 0.22 s lalu fade | — | letupan di titik klik |
| `walker` | jalan 320 px/s, lompat 760 px/s, gravitasi 2600 px/s², dt cap 1/30 | — | platformer |
| `collision` | mask alpha 64 px, alpha ≥ 16 = solid, broadphase tiap 150 ms radius 320 px | — | berdiri di atas gambar PNG |

**Resep:**
1. Squash: dua spring (`scaleX`, `scaleY`) via properti `scale` (bukan `transform`, supaya tidak bentrok dengan transform lain). Loop hidup hanya saat spring belum settled.
2. Burst: satu layer `position: fixed; pointer-events: none`. Gambar dibuat di titik klik, dianimasikan WAAPI, lalu dihapus.
3. Platformer (opsional, desktop only): flipbook 5 pose 200 ms/pose; WASD/panah + Space; collision per piksel dari alpha PNG objek yang sudah dirotasi (un-rotate titik ke lokal pakai `DOMMatrix`, baca mask 64 px); cek kaki di 3 titik (tengah ±35% lebar), grounded kalau ≥ 2 kena; kalau objek yang diinjak bergerak, `x += cx_sekarang − cx_sebelumnya` (platform bergerak). Tidak ditulis di snippet karena panjang.

```js
import { createSpring, ticker, reducedMotion } from './motion-core.js';

export function squash(btn) {                                   // ≈ R08 press 1.08/0.9 → elastic release
  const sx = createSpring({ stiffness: 600, damping: 11, value: 1 }), sy = createSpring({ stiffness: 600, damping: 11, value: 1 });
  let off = null;
  const run = () => { off ??= ticker.add((dt) => {
    btn.style.scale = `${sx.step(dt).toFixed(3)} ${sy.step(dt).toFixed(3)}`;
    if (sx.isSettled() && sy.isSettled()) { off(); off = null; btn.style.scale = ''; }   // loop berhenti sendiri
  }); };
  const press = () => { if (reducedMotion()) return; sx.set(1.08); sy.set(0.9); run(); };
  const release = () => { sx.set(1); sy.set(1); sx.kick(-3); sy.kick(3); run(); };      // lewat 0.96/1.04 lalu settle
  btn.addEventListener('pointerdown', press);
  ['pointerup', 'pointerleave', 'keyup'].forEach((t) => btn.addEventListener(t, release));
  btn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') press(); });
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
      { scale: s, rotate: r, opacity: 1, offset: 0.4 },                                    // 0.22 s
      { scale: s, rotate: r, opacity: 0 },
    ], { duration: 550 }).finished.then(() => img.remove());
  });
}
```

**Touch, keyboard & reduced-motion:** squash jalan di touch dan keyboard (Space/Enter). Burst juga jalan di tap; klik dari keyboard dilewati supaya tidak muncul di pojok kiri atas. Platformer hanya `pointer: fine` (R08 mematikannya di coarse, hanya animasi jalan statis), kontrolnya diabaikan kalau fokus ada di input atau overlay terbuka. Reduced: R08 menyalakan cek di 21 tempat di JS: tanpa squash, tanpa burst, stick figure pose statis.

**Jebakan:**
- Squash lewat `transform` bentrok dengan hover `translateY` di tombol yang sama. Pakai properti `scale` terpisah.
- Loop spring yang tidak pernah berhenti. `isSettled()` lalu lepas dari ticker.
- Burst tanpa `remove()` menumpuk elemen DOM selamanya.
- Flipbook dengan mengganti `src` berkedip di iOS. R08 menumpuk semua frame dan menulis opacity semuanya dalam satu pass.
- Platformer: R08 baru membangun mask alpha saat idle (`requestIdleCallback`), bukan saat load. Membangunnya di awal memperlambat first paint.
