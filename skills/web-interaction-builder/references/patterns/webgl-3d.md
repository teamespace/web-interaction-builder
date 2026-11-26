# Pola WebGL & 3D

Bab ini berisi pola 3D dari bedah R01–R17: model yang di-swap dengan blur, scene produk tanpa file model, buku yang membalik halaman, sampai point cloud yang menyusun ulang dirinya. Semua resep ditulis ulang pakai **Three.js r160** (import map) dan runtime `motion-core.js`, dengan geometri prosedural/primitive supaya jalan tanpa aset proprietary. Aturan utamanya: 3D itu mahal, jadi cek tangga di bawah dulu.

## Tangga teknik

Naik satu anak tangga hanya kalau yang di bawahnya benar-benar tidak cukup. Banyak referensi "3D" yang sebenarnya cukup dibuat dengan SVG, CSS 3D, atau image sequence.

| # | Teknik | Cukup kalau… | Contoh di riset | Biaya kira-kira |
|---|---|---|---|---|
| 0 | SVG prosedural | objek "2.5D" yang dipilih/diklik, kedalaman cukup dari filter bayangan, tidak perlu diputar bebas | R05: 32 gigi SVG + filter "clay", hit-test native browser, tanpa rAF | ±0 KB JS, tanpa WebGL |
| 1 | CSS 3D (`preserve-3d`) | elemen datar (kartu, foto, tile) yang ditata di ruang 3D: bola, flip, stack | R03 bola 46 tile, R07/R10 card stack | ±0 KB, DOM biasa |
| 2 | Canvas2D / image sequence | gerakan sudah pasti, hanya di-scrub, dan harus foto-real | R02 hero 406 frame (26.7 MB desktop / 14 MB mobile, di-stream), R17 35 AVIF per pod | MB gambar, CPU kecil |
| 3 | Video | sama seperti 2 tapi lebih panjang/halus; atau tekstur untuk WebGL | R03 hero video scrub, R08 video sebagai `VideoTexture` | 1–3 MB per klip |
| 4 | Three.js + primitive + shader | butuh interaksi real-time, deformasi shader, partikel, atau bentuk sederhana (lathe/box/plane/points) | R02, R06a, R07, R08, R15 | lib ±600–700 KB mentah (lazy), 0 B model |
| 5 | GLB model | bentuk organik/produk yang harus akurat | R01, R11, R12, R17 | 0.16–20.4 MB di riset. Target ≤ 1.5 MB, ≤ 50k tris |

## Daftar pola

Semua pola memakai fondasi `gl-stage.js` (bagian 0) kecuali `css3d-sphere-gallery` (DOM murni) dan `cylinder-label-spin` (renderer offscreen sendiri).

| # | id | Judul | Mode | Berat |
|---|---|---|---|---|
| 1 | `blur-masked-model-swap` | Ganti model di puncak blur | A | sedang |
| 2 | `procedural-product-scene` | Scene produk tanpa file model | A+B | sedang |
| 3 | `liquid-fx` | Aliran, isi gelas, riak air | A | sedang–berat |
| 4 | `scroll-3d-product-story` | Cerita produk 3D di-scrub scroll + burst | A+B | berat |
| 5 | `scroll-choreographed-backdrop` | Backdrop 3D fixed yang berpose ikut scroll | B | sedang |
| 6 | `pinned-object-drop` | Objek jatuh ke tengah + transisi cahaya | A+B | sedang–berat |
| 7 | `torn-edge-portal` | Portal bertepi sobek antar section | A+B | ringan–sedang |
| 8 | `skinned-page-flip-book` | Buku yang halamannya membalik oleh scroll | A | berat |
| 9 | `css3d-sphere-gallery` | Bola galeri CSS 3D (tanpa WebGL) | A | ringan |
| 10 | `shelf-room-gallery` | Galeri sebagai rak di ruangan 3D | B (A versi kecil) | berat |
| 11 | `velocity-bend-media` | Kartu media yang melengkung/molor oleh kecepatan | A | sedang |
| 12 | `cylinder-label-spin` | Label berputar di silinder, satu context untuk banyak canvas | A+B | sedang |
| 13 | `morphing-point-cloud` | Point cloud yang di-scan lalu morph | A+B | berat |
| 14 | `product-configurator-3d` | Configurator dengan kontrak nama mesh | A+B | sedang |

## 0. Fondasi bersama: `gl-stage.js`

Semua resep memakai helper kecil ini. Isinya kewajiban yang selalu dilupakan referensi: DPR di-cap, render hanya saat terlihat (`defineSection`), shader di-warm-up, DPR turun otomatis kalau FPS jeblok, `webglcontextlost` ditangani, dan semua GPU resource di-dispose.

**Import map** (sekali per halaman). R02 mengirim `three.module.js` yang **tidak di-minify** (1.27 MB); untuk produksi arahkan `"three"` ke `three.module.min.js` di folder yang sama.

```html
<script type="importmap">{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }</script>
```

**Markup + poster:** tiap section 3D punya `<img class="gl-poster">` (screenshot state akhir) dan `<canvas class="gl" aria-hidden="true">`. Canvas `opacity:0` sampai `.gl-ready`; saat `.gl-off` (tanpa WebGL / context hilang) canvas `display:none` dan poster tetap tampil.

```js
// gl-stage.js
import * as THREE from 'three';
import { defineSection } from './motion-core.js';
let gl;                                                       // cek sekali saja, jangan bikin context berulang
export const hasWebGL = () => (gl ??= (() => { try { const c = document.createElement('canvas');
  return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })());
const disposeTree = (root) => root.traverse((o) => { o.geometry?.dispose();
  for (const m of [].concat(o.material || [])) {
    for (const v of [...Object.values(m), ...Object.values(m.uniforms || {}).map((u) => u.value)]) if (v?.isTexture) v.dispose();
    m.dispose(); } });
export function glSection(el, build, { dprCap = 1.5, alpha = true, antialias = true, staticOnReduce = true, fov = 35 } = {}) {
  if (!hasWebGL()) { el.classList.add('gl-off'); return null; }
  return defineSection(el, (ctx) => {
    const canvas = el.querySelector('canvas.gl'), ac = new AbortController();
    const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias, powerPreference: 'high-performance' });
    let dpr = Math.min(devicePixelRatio, ctx.small ? Math.min(dprCap, 1.25) : dprCap); renderer.setPixelRatio(dpr);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100), render = () => renderer.render(scene, camera);
    const api = build({ ...ctx, THREE, renderer, scene, camera, render, signal: ac.signal }) || {};
    const resize = () => {
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      api.onResize?.(w, h); if (ctx.reduced) render();
    };
    resize();
    renderer.compileAsync(scene, camera).then(() => { render(); el.classList.add('gl-ready'); }); // warm-up shader
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); el.classList.add('gl-off'); }, { signal: ac.signal });
    let slow = 0, frames = 0, drops = 0;
    return {
      onResize: resize,
      update(dt, t) {
        if (api.update?.(dt, t) === false) return;          // tidak ada perubahan → skip render
        render(); slow += dt;
        if (drops < 2 && t > 3 && ++frames >= 90) {          // adaptive DPR: < 48 fps → turun 0.25
          if (slow / frames > 1 / 48) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); drops++; }
          slow = frames = 0;
        }
      },
      renderStatic: staticOnReduce ? () => api.renderStatic?.() : undefined,
      destroy() { ac.abort(); api.destroy?.(); disposeTree(scene); scene.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
    };
  });
}
```

Kontrak `build(ctx)`: `ctx = { el, reduced, fine, small, THREE, renderer, scene, camera, render, signal }`. Kembalikan `{ update(dt, t) → false kalau tidak perlu render, onResize(w, h), renderStatic(), destroy() }`. Pasang listener dengan `{ signal }` supaya lepas otomatis di `destroy`. Pola yang di-scrub scroll memakai `staticOnReduce: false`: scroll tetap dikendalikan user, gerakan idle dimatikan di dalam `update`. Kalau pola tidak punya pose statis yang masuk akal, isi `renderStatic` dengan `el.classList.add('gl-off')` supaya poster yang tampil.

**Lazy mount** (R03, R07, R08): import modul 3D hanya saat section mendekat (`rootMargin: '300% 0px'`), prefetch saat idle.

```js
const io = new IntersectionObserver(async ([e]) => { if (!e.isIntersecting) return; io.disconnect();
  (await import('./sections/product-scene.js')).productScene(el); }, { rootMargin: '300% 0px' });
io.observe(el);
window.requestIdleCallback?.(() => import('./sections/product-scene.js'), { timeout: 4000 });
```

**Budget default per section 3D:** DPR ≤ 1.5 desktop / ≤ 1.25 mobile · shadow map 1024 / 512 · tekstur ≤ 2048, lebih baik digambar di Canvas2D (0 byte) · GLB ≤ 1.5 MB, ≤ 50k tris (Draco/meshopt + KTX2/WebP) · HDRI ≤ 1k atau `RoomEnvironment` (0 byte) · satu WebGL context per halaman kalau bisa (browser membatasi jumlah context aktif; R12 punya satu canvas per kartu flavour, itu risiko).

### `blur-masked-model-swap` — Ganti model di puncak blur

**Sumber:** R01, R17 · **Mode:** A · **Tingkat berat:** sedang (GLB) / ringan (primitive)\
**Kapan dipakai:** hero dengan beberapa varian produk (rasa, warna, tipe) yang dipilih lewat kartu. Pergantiannya disembunyikan oleh putaran cepat + blur, jadi tidak perlu morph antar-model.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `turns` per fase | 1 (total 720°) | 0.5–1 | 360° total sudah cukup kalau ingin kalem |
| fase A | 0.6 s, `power2.in` | 0.4–0.8 s | harus "in" supaya kecepatan puncak jatuh di titik swap |
| fase B | 1.5 s, `back.out(0.7)` | 1–1.8 s | perlambatan + overshoot kecil |
| `blur` puncak | 12 px | 8–16 px | CSS `filter: blur()` di canvas |
| tema + copy | token `:root` 1.2 s `power2.inOut`; copy out 0.35 s / in 0.5 s, y 14 px, stagger 0.08 | — | swap teks idealnya tepat di akhir fase A |
| idle follow | theta ±20°, phi ±9°, lerp 0.05/frame (λ ≈ 3) | — | objek "melihat" kursor |

**Resep:**
1. Semua varian dibangun sekali di scene yang sama, yang tidak aktif `visible = false`. Dengan GLB: preload berantai setelah `load` pertama, dan **jangan swap ke model yang belum `loaded`**.
2. Satu sumber sudut: rotasi = pointer (di-damp) + `rot` dari spin, jadi model baru mewarisi sudut yang sama. Fase A: rotasi `k²` + blur naik → tukar `visible` → fase B `ease.outBack(k, 0.7)` + blur turun. Bersamaan: token warna `:root` (CSS transition pada custom property ber-`@property`), copy out → ganti teks → in.
3. Lock input sampai **tween terpanjang** selesai (2.1 s). Varian murah tanpa spin (R17): fade canvas 300 ms + hold 500 ms.

```js
import { glSection } from './gl-stage.js';
import { damp, ease } from './motion-core.js';
// variants: [{ build: (THREE) => THREE.Group, theme: { bg } }]
export function modelSwap(el, variants, { turns = 1, blur = 12, A = 0.6, B = 1.5 } = {}) {
  let select = () => {};
  const sec = glSection(el, ({ THREE, scene, camera, reduced, fine, render, signal }) => {
    camera.position.set(0, 0.3, 4.5); scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.4));
    const models = variants.map((v, i) => { const g = v.build(THREE); g.visible = i === 0; scene.add(g); return g; });
    const canvas = el.querySelector('canvas.gl'), ptr = { x: 0, y: 0 }, cam = { x: 0, y: 0 };
    let active = 0, next = -1, t = -1, rot = 0;
    if (fine) el.addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }, { signal });
    const show = (i) => { models[active].visible = false; models[i].visible = true; active = i; };
    select = (i) => {
      if (t >= 0 || i === active) return;                              // lock sampai fase B selesai
      document.documentElement.style.setProperty('--bg', variants[i].theme.bg);
      if (reduced) { show(i); render(); return; }                        // reduced: potong langsung
      next = i; t = 0;
    };
    return {
      update(dt) {
        cam.x = damp(cam.x, ptr.x, 3, dt); cam.y = damp(cam.y, ptr.y, 3, dt);
        if (t >= 0) {
          t += dt;
          if (t < A) { const k = (t / A) ** 2; rot = k * turns * 2 * Math.PI; canvas.style.filter = `blur(${k * blur}px)`; }
          else {
            if (next >= 0) { show(next); next = -1; }                    // swap di puncak blur
            const k = Math.min(1, (t - A) / B), e = ease.outBack(k, 0.7);
            rot = (1 + e) * turns * 2 * Math.PI; canvas.style.filter = `blur(${Math.max(0, 1 - e) * blur}px)`;
            if (k === 1) { t = -1; rot = 0; canvas.style.filter = ''; }
          }
        }
        models[active].rotation.set(cam.y * 0.3, rot + cam.x * 0.7, 0); // ±9° / ±20°
      },
      renderStatic() {},
    };
  });
  return { select: (i) => select(i), destroy: () => sec?.destroy() };
}
```

**Performa, mobile & reduced-motion:** budget per varian ≤ 1.5 MB / ≤ 50k tris (decimate tidak kelihatan di ukuran hero). Blur CSS di atas canvas mahal tapi hanya 2.1 s. Mobile: tidak ada hover, jadi pointer-follow mati; tambah gyro kalau perlu. Reduced-motion: tanpa spin/blur/parallax, ganti model langsung + fade CSS 0.3 s pada canvas. Tanpa WebGL: poster per varian (`<img>` di-swap).

**Jebakan:**
- R01: 3 GLB total **≈ 14.2 MB** (~450k tris per pouch), semuanya di-preload; dan swap tetap terjadi di 0.6 s walau GLB target belum dimuat → produk hilang sesaat.
- R01: lock dilepas di 1.7 s (akhir ornamen) padahal spin selesai di 2.1 s → klik di jendela itu memulai spin baru di tengah spin lama.
- R01: rAF tidak pernah berhenti, `getBoundingClientRect()` 5× per frame, tanpa cek reduced-motion; `camera-controls` aktif tapi `cameraOrbit` ditimpa tiap frame.
- R17: tiap swap memanggil loader lagi (tanpa cache di memori); varian 8-10 orang 20.4 MB.

### `procedural-product-scene` — Scene produk tanpa file model

**Sumber:** R02, R17 · **Mode:** A+B · **Tingkat berat:** sedang\
**Kapan dipakai:** produk yang bentuknya bisa dideskripsikan sebagai profil putar (gelas, mug, botol, kaleng, toples) atau kotak/silinder (pod, alat). Hasilnya terlihat "product shot" tanpa mengunduh model sama sekali.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| renderer | DPR cap 1.25 (R02), ACES exposure 1.05 | DPR 1–1.5, exposure 0.9–1.3 | warna "foto produk" |
| env | `RoomEnvironment`, sigma 0.04 | — | refleksi instan 0 byte; HDRI 1k (1.6 MB) di-swap belakangan |
| lampu | key 2.6 (shadow 1024 / 512 mobile) → `ShadowMaterial` opacity 0.32; rim 2.1, warna ikut section, lerp 0.08/frame | opacity 0.08–0.4 | satu caster; mood per chapter |
| lathe segmen | 64–80 (48 mobile) | — | halus vs jumlah vertex |
| idle | wobble `sin(t·0.3..0.4)·0.03` rad, parallax lerp 0.05/frame (λ ≈ 3) | wobble 0–0.05 | tidak pernah benar-benar diam |

**Resep:**
1. Renderer `alpha: true` di atas gradient CSS; env `RoomEnvironment` dulu, HDRI ≤ 1k opsional setelah load. Objek dari `LatheGeometry` (profil 2D diputar). Profil yang sama dipakai untuk `radiusLookup(y)` saat mengisi cairan (`liquid-fx`).
2. Tekstur digambar di Canvas2D (label, speckle, angka timbangan); redraw `CanvasTexture` **hanya kalau isinya berubah**.
3. Key light cast shadow ke `ShadowMaterial`; rim light di-damp ke warna section aktif. Beri nama mesh dengan kontrak (`BODY_*`, `Addon1_*`) supaya part bisa dicari lewat nama (`product-configurator-3d`).

```js
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { glSection } from './gl-stage.js';
import { damp } from './motion-core.js';
export function productScene(el) {
  return glSection(el, ({ THREE, scene, camera, renderer, small, signal }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    camera.position.set(0, 1.4, 4.2); camera.lookAt(0, 0.6, 0);
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(2, 4, 3); key.castShadow = true; key.shadow.mapSize.setScalar(small ? 512 : 1024);
    const rim = new THREE.DirectionalLight(0xffcf9e, 2.1); rim.position.set(-3, 2, -4); scene.add(key, rim);   // rim.color di-damp ke warna section
    const c = Object.assign(document.createElement('canvas'), { width: 512, height: 256 }), g = c.getContext('2d');
    g.fillStyle = '#e9e1d4'; g.fillRect(0, 0, 512, 256);                 // speckle keramik, 0 byte network
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,40,30,${Math.random() * 0.5})`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const profile = [[0, 0], [0.5, 0], [0.56, 0.05], [0.6, 0.6], [0.64, 1.2], [0.6, 1.22], [0.56, 0.62], [0.5, 0.1], [0, 0.1]];
    const cup = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), small ? 48 : 80),
      new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, clearcoat: 0.35 }));
    cup.name = 'BODY_cup'; cup.castShadow = true; scene.add(cup);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: 0x2a1608, opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const ptr = { x: 0 }, cur = { x: 0 }; el.addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth - 0.5; }, { signal });
    return {
      update(dt, t) {
        cur.x = damp(cur.x, ptr.x, 3, dt);
        cup.rotation.set(Math.sin(t * 0.35) * 0.03, cur.x * 0.6, 0);      // idle wobble + parallax
      },
      renderStatic() {},                                                   // pose diam, dirender sekali
    };
  });
}
```

**Performa, mobile & reduced-motion:** model 0 byte; tekstur Canvas2D 0 byte; HDRI opsional ≤ 1.6 MB lazy. Hot loop bebas alokasi (vektor di-reuse, `InstancedMesh` untuk objek kembar, misalnya 72 biji kopi / 50 di mobile di R02). Mobile: shadow 512, segmen lathe 48, jumlah instance dikurangi. Reduced-motion: pose diam (tanpa wobble/parallax), dirender sekali. Tanpa WebGL: poster.

**Jebakan:**
- R02: tidak ada fallback statis kalau WebGL gagal (cuma `console.error`, loader tetap ditutup → layar kosong); idle wobble dan shader `uTime` tetap jalan saat reduced-motion.
- R17: `castShadow = false` di light dan plane bayangan ikut terhapus saat reset scene → bayangan lantai tidak pernah tampil. FOV 75 terlalu lebar untuk produk; pakai 35–45.

### `liquid-fx` — Aliran, isi gelas, riak air

**Sumber:** R02, R12 · **Mode:** A · **Tingkat berat:** sedang (stream + clip) / berat (ripple sim)\
**Kapan dipakai:** cerita produk minuman: kopi dituang, gelas terisi, permukaan air bereaksi ke kursor. Tiga efek kecil yang bisa dipakai terpisah di atas `procedural-product-scene`.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| stream | `seg` 36 × `rad` 6, riak `1 + 0.12·sin(u·38 − t·22)` | 24–48 × 6–10, amp 0.05–0.15 | resolusi tube, aliran "hidup" |
| `head` / `tail` | 0–1 | — | mulai mengucur / putus |
| fill level | `plane.constant` = tinggi isi (world) | — | cairan tetap datar walau wadah miring |
| ripple | RT 512² `HalfFloatType`, Fresnel F0 0.02, brush segmen pointer + 4 tetes ambient | RT 256–512 | riak air ikut kursor |

**Resep:**
1. **Stream:** `TubeGeometry` dibuat sekali (topologi saja), tiap frame posisi vertex ditulis ulang di sepanjang Bézier kuadrat A → C → B.
2. **Isi wadah:** `localClippingEnabled = true` + `clippingPlanes = [Plane((0,−1,0), h)]`: fragmen di atas `y = h` dibuang. Disk permukaan hanya tampil saat wadah tegak, ukurannya dari `radiusLookup(y)`.
3. **Riak (R12):** dua RT 512² ping-pong; sim = persamaan gelombang 4 tetangga + damping + brush; permukaan membaca gradien sim untuk normal, Fresnel Schlick, `depthWrite: false`. UV sim dari bbox posisi lokal supaya tanpa seam. Partikel tetes: lihat varian di `morphing-point-cloud`.

```js
// Stream cairan: topologi tube dibuat sekali, vertex ditulis ulang tiap frame (tanpa alokasi)
export function createStream(THREE, { seg = 36, rad = 6, color = 0x5a3216 } = {}) {
  const geo = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), seg, 0.02, rad, false);
  const attr = geo.attributes.position; attr.setUsage(THREE.DynamicDrawUsage);
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1 })); mesh.frustumCulled = false;
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), tmp = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  // A = bibir wadah, C = titik kontrol, B = target. tail..head (0..1) = bagian aliran yang tampil
  mesh.userData.update = (A, C, B, r0, r1, tail, head, time) => {
    for (let i = 0; i <= seg; i++) {
      const u = tail + (head - tail) * (i / seg), v = 1 - u;
      P.copy(A).multiplyScalar(v * v).addScaledVector(C, 2 * v * u).addScaledVector(B, u * u);
      T.subVectors(C, A).multiplyScalar(2 * v).add(tmp.subVectors(B, C).multiplyScalar(2 * u)).normalize();
      N.crossVectors(T, Z).normalize(); Bn.crossVectors(T, N);
      const r = (r0 + (r1 - r0) * u) * (1 + 0.12 * Math.sin(u * 38 - time * 22));   // riak
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
        attr.setXYZ(i * (rad + 1) + j, P.x + N.x * c + Bn.x * s, P.y + N.y * c + Bn.y * s, P.z + N.z * c + Bn.z * s);
      }
    }
    attr.needsUpdate = true; geo.computeVertexNormals();              // ±260 vertex, murah
  };
  return mesh;
}

// Cairan di wadah miring tetap datar: buang fragmen di atas y = level (world space)
export function fillLevel(THREE, renderer, liquidMesh) {
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  renderer.localClippingEnabled = true; liquidMesh.material.clippingPlanes = [plane];
  return (worldY) => { plane.constant = worldY; };                  // panggil tiap frame dengan tinggi isi
}
```

**Performa, mobile & reduced-motion:** stream dan clip hampir gratis (±260 vertex, satu uniform). Ripple = 2 pass tambahan per frame ke RT 512²: matikan di mobile low-end, pakai `HalfFloatType` (sebagian GPU lama tidak bisa render ke `FloatType`) dan cek dukungan; kalau gagal, permukaan statis dengan normal map. Reduced-motion: riak stream dan tetes ambient mati, isi langsung ke level akhir; ripple hanya merespons kursor (input user), tanpa drip otomatis. Budget: 0 byte aset.

**Jebakan:**
- R12: ripple memakai RT `FloatType` tanpa fallback, dan mesh air di-tessellate saat runtime (`TessellateModifier`) → CPU spike saat mount. Siapkan geometri yang sudah rapat.

### `scroll-3d-product-story` — Cerita produk 3D di-scrub scroll + burst

**Sumber:** R12, R02 · **Mode:** A+B · **Tingkat berat:** berat\
**Kapan dipakai:** satu objek "benang merah" di sticky canvas di belakang beberapa section DOM: berputar, terbelah, menyatu, lalu ada momen klimaks (objek lain muncul dari dalam). Mode A: satu section 300–500vh. Mode B: beberapa chapter dengan objek yang "dioper" antar-chapter.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| panjang scrub | 4 unit ≈ 420vh (1 unit ≈ 105vh) | 300–460vh per chapter (R02) | panjang cerita |
| jendela scrub | `inOutCubic` (≈ `power2.inOut`); rotasi (−10°, 90°, −10°) di 0–1u; belahan x → 1 + rotX −360° di 0.5–2u; dolly z 5 → 3.5 di 0.5–1.5u | — | tiap gerakan = `range(p, a, b)` |
| hold | 0.5u (2–2.5u) | 0.3–0.8u | pose terbuka sempat dibaca |
| burst (time-based) | ≈ 2.7 s; shake ramp 0.6 s, amp ±0.018; belahan ±1.35 di t=1.0 (1.6 s, power2.in); reveal scale `back.out(1.6)` di t=1.3 (1.4 s), miring −60° | 2–3 s | klimaks |
| reverse / runway | burst mundur 1.2× lebih cepat; runway rotZ 0 → 720°, scrub 0.6 s (damp λ ≈ 5) | 360–720° | scroll balik / penutup |
| tilt | ±15°, lerp `dt·3` | 8–15° | pointer / gyro |
| hand-off (R02) | blend matrix di `[.88, 1]` → carry pose → `[0, .08]`, hop `sin(πk)·1.4` | — | objek pindah chapter |

**Resep:**
1. Wrapper tinggi berisi `div` sticky 100vh (`pointer-events:none`) dengan canvas, overlay section DOM di atasnya. Scene graph `tilt > coco{ L, R, can }`: objek reveal disimpan **di dalam** grup dengan scale 0, jadi "keluar dari dalam" tanpa hitung posisi.
2. `p = stickyProgress(wrapper)`; tiap gerakan = jendela `range(p, a, b)` + easing (pengganti timeline GSAP yang di-scrub; `tl.progress(p)` juga boleh).
3. Burst **time-based**, dipicu threshold dengan hysteresis. R12 mengunci scroll 2.7 s (Lenis `stop`); di skill lock itu opsional, default **mati**. HUD DOM disinkronkan lewat event (`seq:burst` + sisa durasi), bukan membaca state Three.js. Mode B: objek yang pindah chapter memakai `matrixAutoUpdate = false`, di-blend (decompose → lerp/slerp → compose) pose A → carry pose → pose B, plus hop `sin(πk)`.

```js
import { glSection } from './gl-stage.js';
import { stickyProgress, range, ease, damp, clamp } from './motion-core.js';
const D = Math.PI / 180, U = 4;                                        // timeline 4 "unit" sepanjang scrub
const W = (p, a, b, f = ease.inOutCubic) => f(range(p, a / U, b / U));
export function productStory(el, { burstAt = 0.985, rearm = 0.95, BURST = 2.7 } = {}) {
  return glSection(el, ({ THREE, scene, camera, reduced, fine, signal }) => {
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2418, 2.2)); camera.position.z = 5;
    const shell = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85, side: THREE.DoubleSide });
    const half = (s) => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI), shell); m.rotation.y = s * Math.PI / 2; g.add(m); return g; };
    const L = half(-1), R = half(1), coco = new THREE.Group(), tilt = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.85, 40), new THREE.MeshStandardMaterial({ color: 0xd9d4c7, metalness: 0.7, roughness: 0.3 }));
    coco.add(L, R, can); tilt.add(coco); scene.add(tilt);              // objek reveal disimpan DI DALAM
    const ptr = { x: 0, y: 0 }; let bt = 0, dir = 0;
    if (fine && !reduced) addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; }, { passive: true, signal });
    return {
      update(dt) {
        const p = stickyProgress(el), back = 1 - W(p, 2.5, 3.5), turn = W(p, 0, 1) * back;
        coco.rotation.set(-10 * D * turn, 90 * D * turn, -10 * D * turn + 30 * D * W(p, 3.5, 4, ease.outCubic));
        const open = W(p, 0.5, 2) * back;
        R.rotation.x = -2 * Math.PI * open; L.rotation.x = -365 * D * W(p, 0.5, 1.5) * back;
        camera.position.z = 5 - 1.5 * W(p, 0.5, 1.5) * back;
        if (p >= burstAt) dir = 1; else if (p < rearm) dir = -1.2;      // hysteresis; mundur 1.2× lebih cepat
        bt = reduced ? (dir > 0 ? BURST : 0) : clamp(bt + dt * dir, 0, BURST);
        const shake = reduced ? 0 : Math.min(bt / 0.6, 1) * (1 - range(bt, 1, 1.5));
        coco.position.set((Math.random() - 0.5) * 0.036 * shake, (Math.random() - 0.5) * 0.036 * shake, 0);
        const fly = range(bt, 1, 2.6) ** 2;                              // power2.in
        L.position.x = -1.35 * fly; R.position.x = open + 1.35 * fly;
        const pop = ease.outBack(range(bt, 1.3, 2.7), 1.6);
        can.visible = pop > 0.001; can.scale.setScalar(Math.max(pop, 0.001)); can.rotation.z = -60 * D * pop;
        tilt.rotation.x = damp(tilt.rotation.x, ptr.y * 15 * D, 3, dt); tilt.rotation.y = damp(tilt.rotation.y, ptr.x * 15 * D, 3, dt);
      },
    };
  }, { staticOnReduce: false });
}
```

**Performa, mobile & reduced-motion:** budget: GLB ≤ 1.5 MB terkompresi (R12: `coconut.glb` 4.65 MB tanpa Draco/KTX2) + HDRI ≤ 1k atau `RoomEnvironment`. DPR `[1, 2]` di R12 terlalu tinggi; pakai cap helper. Render hanya saat in-view (R12: `frameloop` always/never). Mobile: skala model lebih kecil (R12: 7 vs 12), runway 50vh, tilt dari `deviceorientation` (iOS perlu `requestPermission()` di gesture pertama). Reduced-motion: scrub tetap jalan (user yang pegang kendali), tapi burst langsung ke state akhir, tanpa shake/tilt/lock scroll. Tanpa WebGL: poster + section DOM tetap terbaca.

**Jebakan:**
- R12: sekuens 3D tidak mengecek `prefers-reduced-motion` (komponen lain di halaman yang sama mengecek), dan scroll dikunci 2.7 s → user yang scroll cepat merasa "nyangkut".
- R12: perekam debug yang push objek ke `window.__fcrec` tiap frame (cap 30k) ikut ter-deploy; satu `<Canvas>` per kartu flavour = banyak WebGL context.
- Lupa `history.scrollRestoration = 'manual'` + scroll ke 0 saat mount → state timeline kacau saat reload di tengah halaman (R12 menangani ini).

### `scroll-choreographed-backdrop` — Backdrop 3D fixed yang berpose ikut scroll

**Sumber:** R10 · **Mode:** B (A kalau dibatasi ke satu section pinned) · **Tingkat berat:** sedang\
**Kapan dipakai:** layer 3D `position: fixed` di belakang semua section (hero → about → numbers) yang berganti pose di titik-titik scroll, plus intro saat load dan putaran ambient sangat lambat.

**Spline atau Three.js?** Spline (`<spline-viewer>`, jalur R10) paling cepat dibuat dan desainer bisa sendiri, tapi membawa runtime viewer dari CDN + scene 125–145 KB per breakpoint (3 file), keyframe px mentah, render terus-menerus, dan tidak menghormati reduced-motion. Three.js (resep ini) butuh developer, tapi 0 byte geometri, keyframe ditambatkan ke section, bisa berhenti render, dan punya pose statis. Pakai Spline hanya untuk prototipe atau kalau tim tidak punya developer 3D.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| jumlah keping | 40 (24 mobile) | 20–60 | `InstancedMesh`, satu draw call |
| keyframe | 3 pose: 0–800 px, hold 100, 900–1900, hold 100, 2000–3200 | — | di skill ditambatkan ke `#section` + offset |
| per breakpoint | `endAfter` 3200 / 2400 tablet / 4150 mobile px; hold mobile 400 / 350 px | — | teks sempat terbaca di HP |
| smoothing | lerp 0.1 (λ ≈ 6) | 0.08–0.15 | wheel patah-patah tetap halus |
| intro / ambient | 6 s cubic (0,0,0,1) ≈ `outQuint`, rotX ±150° → 0; ambient 1 putaran / 240 s; fade container 3 s | intro 3–6 s | muncul saat load, drift saat diam |

**Resep:**
1. Canvas fixed 100vh di bawah konten, `pointer-events:none`. Grup bersarang `intro > rig > spin > ring` (load / pose scroll / buka putaran / ambient) supaya transform bertumpuk, tidak saling timpa.
2. Keyframe ditambatkan ke section (`offsetTop − vh/2 + offset`), diukur ulang saat resize. Entry kembar dengan offset beda = hold.
3. Per frame: pose target dari `scrollY` (piecewise + `inOutCubic` per segmen), pose aktual di-`damp` ke target.

```js
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glSection } from './gl-stage.js';
import { damp, ease } from './motion-core.js';
const KEYS = [['#hero', 0, [0, 0, 0, 0, 0, 0]], ['#about', 0, [-2.2, -0.7, 1, 0, -58, -32]], ['#about', 100, [-2.2, -0.7, 1, 0, -58, -32]],
  ['#numbers', 0, [1.7, -3.3, 1.6, 66, -13, -48]], ['#numbers', 100, [1.7, -3.3, 1.6, 66, -13, -48]], ['#services', 0, [1.7, -3.3, 1.6, 66, -13, 40]]];
export function backdrop(el, { count = 40 } = {}) {                     // [selector, offsetPx, x,y,z, rx,ry,rz (°)]
  return glSection(el, ({ THREE, scene, camera, reduced, small }) => {
    const n = small ? 24 : count, D = Math.PI / 180, o = new THREE.Object3D();
    const ring = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 0.06, 3, 0.16), new THREE.MeshStandardMaterial({ color: 0xaab2bb, metalness: 1, roughness: 0.2 }), n);
    for (let i = 0; i < n; i++) { const a = (i / n) * 1.6 * Math.PI; o.position.set(Math.cos(a) * 3, Math.sin(a) * 3, -i * 0.04); o.rotation.set(0, 0.5, a); o.updateMatrix(); ring.setMatrixAt(i, o.matrix); }
    const intro = new THREE.Group(), rig = new THREE.Group(), spin = new THREE.Group();
    spin.add(ring); rig.add(spin); intro.add(rig); scene.add(intro, new THREE.HemisphereLight(0xffffff, 0x111111, 2)); camera.position.z = 10;
    let keys = [], age = reduced ? 6 : 0; const cur = new Float32Array(6), tgt = new Float32Array(6);
    const measure = () => { keys = KEYS.map(([s, off, pose]) => [document.querySelector(s).offsetTop - innerHeight / 2 + off, pose]); };
    const poseAt = (y) => {
      const i = keys.findIndex(([px]) => px >= y);
      if (i <= 0) return tgt.set(keys[i < 0 ? keys.length - 1 : 0][1]);
      const [a, A] = keys[i - 1], [b, B] = keys[i], k = ease.inOutCubic((y - a) / Math.max(1, b - a));
      for (let j = 0; j < 6; j++) tgt[j] = A[j] + (B[j] - A[j]) * k;
    };
    const apply = () => { rig.position.set(cur[0], cur[1], cur[2]); rig.rotation.set(cur[3] * D, cur[4] * D, cur[5] * D); }; measure();
    return {
      onResize: measure,
      update(dt) {
        poseAt(scrollY); for (let j = 0; j < 6; j++) cur[j] = damp(cur[j], tgt[j], 6, dt);
        age += dt; const k = 1 - ease.outQuint(Math.min(age / 6, 1));        // intro 6 s, ease-out kuat
        intro.position.set(-1.1 * k, -1.1 * k, -1.7 * k); spin.rotation.x = 2.6 * k;
        ring.rotation.x -= (dt * 2 * Math.PI) / 240;                        // ambient: 1 putaran / 4 menit
        apply();
      },
      renderStatic() { poseAt(scrollY); cur.set(tgt); apply(); },
    };
  });
}
```

**Performa, mobile & reduced-motion:** budget: 0 byte model, 1 draw call. Karena elemen fixed selalu "terlihat", tambahkan berhenti render di `update` (return `false`) setelah lewat key terakhir + 1vh dan pose sudah settle, atau matikan ambient. Mobile: 24 keping, kamera lebih jauh, tabel key sendiri dengan hold lebih panjang. Reduced-motion: pose statis (tanpa intro, ambient, dan scrub), dirender sekali. Tanpa WebGL: gradient/gambar statis di layer yang sama.

**Jebakan:**
- R10: Spline tidak menghormati reduced-motion, kanvas full-screen render terus (ambient 4 menit), tanpa fallback statis di mobile.
- R10: keyframe pakai px mentah; konten berubah sedikit, pose langsung meleset dari section-nya. Scene juga dimuat `loading="eager"`.

### `pinned-object-drop` — Objek jatuh ke tengah + transisi cahaya

**Sumber:** R11 · **Mode:** A+B · **Tingkat berat:** sedang (primitive) / berat (GLB + bloom)\
**Kapan dipakai:** objek "pahlawan" yang jatuh masuk ke tengah layar saat chapter tertentu dimulai, lalu tetap di-pin sementara teks DOM mengalir di depan/belakangnya. Varian mode B: section ditutup dengan ledakan cahaya (glow → layar penuh krem → section berikutnya).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| trigger / re-arm | progress ≥ 0.82 / < 0.58 | — | hysteresis supaya tidak memicu bolak-balik |
| kurva Y (× tinggi viewport) | +0.52 (0.72 mobile) → −0.065 (0–0.6 s) → +0.026 (0.6–1.52 s) → 0 (1.52–1.95 s) | awal 0.4–0.8 | overshoot lalu settle, smoothstep per segmen |
| rotasi | pitch −58°, roll −14°, yaw 10°; osilator ζ 3.5–3.8, ω 8.1–10.2, envelope pudar 0.94–1.25 s | — | `e^(−ζt)(cos ωt + ζ/ω sin ωt)` |
| idle / drag | drift yaw ±0.4 rad @ 0.11 rad/s; drag damp 2.6/s, maks 9 rad/s | drift 0–0.4 | hidup saat diam, inertia saat di-drag |
| light burst | spring kritis ω 6.5 (13 kalau baru scroll cepat) | — | `createSpring({ stiffness: 42, damping: 13 })` |

**Resep:**
1. Canvas fixed di belakang kolom teks; objek primitive (rounded box + silinder lensa) atau GLB. Drop **time-based** 1.95 s yang dipicu threshold progress (bukan di-scrub) supaya terasa berat. Rotasi = amplitudo × osilator teredam × envelope; Y dalam satuan tinggi viewport world (`2·tan(fov/2)·dist`).
2. **Light burst:** progress spring 0 → 1. 0–0.4 judul makin terang (`text-shadow`); 0.4–0.7 overlay krem `#f3ead8` naik ke opacity 1 dan konten diganti di baliknya; 0.7–1 overlay turun. Bloom (R11: 5 level) hanya kalau budget GPU cukup.
3. Chapter berat di-`import()` saat progress mendekat (R11 memanaskan chapter "expose" saat chapter sebelumnya mulai); shader warm-up sudah di helper.

```js
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glSection } from './gl-stage.js';
import { smoothstep, range } from './motion-core.js';
const osc = (t, z, w) => Math.exp(-z * t) * (Math.cos(w * t) + (z / w) * Math.sin(w * t));   // osilator teredam
const dropY = (t, from) => {                                         // detik → fraksi tinggi layar
  const K = [[0, from], [0.6, -0.065], [1.52, 0.026], [1.95, 0]];
  for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [a, ya] = K[i - 1], [b, yb] = K[i]; return ya + (yb - ya) * smoothstep((t - a) / (b - a)); }
  return 0;
};
export function objectDrop(el, getProgress, { at = 0.82, rearm = 0.58 } = {}) {
  return glSection(el, ({ THREE, scene, camera, reduced, small }) => {
    const D = Math.PI / 180, obj = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.9, 0.5, 4, 0.12), new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.5 }));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.4, 48), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.6, roughness: 0.35 }));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.42; obj.add(body, lens);
    scene.add(obj, new THREE.HemisphereLight(0xffffff, 0x404040, 2.5)); camera.position.z = 6;
    let t = -1, armed = true; const from = small ? 0.72 : 0.52;
    return {
      update(dt, time) {
        const p = getProgress();
        if (armed && p >= at) { armed = false; t = reduced ? 1.95 : 0; }   // reduced: langsung pose akhir
        if (!armed && p < rearm) { armed = true; t = -1; }
        obj.visible = t >= 0; if (t < 0) return false;
        t = Math.min(t + dt, 1.95);
        const env = 1 - smoothstep(range(t, 0.94, 1.25)), idle = reduced ? 0 : 1;
        obj.position.y = dropY(t, from) * 2 * Math.tan((camera.fov * D) / 2) * camera.position.z;
        obj.rotation.set(-58 * D * osc(t, 3.5, 8.1) * env, 10 * D * osc(t, 3.8, 8.1) * env + Math.sin(time * 0.11) * 0.4 * idle,
          -14 * D * osc(t, 3.8, 10.2) * env, 'YXZ');
      },
    };
  }, { staticOnReduce: false });
}
```

**Performa, mobile & reduced-motion:** budget primitive 0 byte; kalau GLB, ≤ 1.5 MB dengan tekstur KTX2 (R11 memakai KTX2/Basis). R11 juga: rAF dibatasi ±120 Hz (layar 240 Hz cukup tiap refresh ke-2), dynamic resolution per canvas, canvas tersembunyi di-resize ke 16×16. Mobile: jatuh dari 0.72, tap memajukan beat. Reduced-motion: drop dilewati (langsung pose akhir), idle drift dan burst diganti crossfade 0.3 s. Tanpa WebGL: pesan/poster ala `#deadnote` ("gagal dimuat") + teks DOM tetap ada.

**Jebakan:**
- R11 mematikan scroll native seluruh halaman (virtual scroll): tidak ada scrollbar, anchor, atau find-in-page. Untuk skill, jalankan pola ini di atas sticky + scroll native.
- R11: field cahaya fluid sim + LIC 8-tap adalah bagian termahal (p95 12.5 → 8.5 ms kalau dimatikan). Jangan bawa ke versi ringan.

### `torn-edge-portal` — Portal bertepi sobek antar section

**Sumber:** R03 · **Mode:** A+B · **Tingkat berat:** ringan–sedang\
**Kapan dipakai:** transisi dramatis dari hero ke section berikutnya: lubang bertepi kasar tumbuh dari tengah layar dan section berikutnya sudah terlihat di dalamnya. Varian: tepi kertas sobek yang naik di batas section.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| range / radius | `[0.80, 0.99]` progress hero, smoothstep; `m·(0.5·hypot(w,h) + 0.35·h)` px | — | rumus radius sama persis di CSS dan shader |
| feather mask | hitam di `hole − 30vh`, transparan di `hole − 15vh` | 10–30vh | kelembutan tepi mask CSS |
| tepi | fbm amplitudo 0.32, skala uv 3.2; band rim 0.16, bintik sel 2 px | amp 0.2–0.4 | kekasaran sobekan |
| isi lubang | `#101010` = bg section berikutnya | — | harus sama supaya seamless |
| seam kertas (varian) | tinggi 46vh, `u_r = clamp((1.15 − bottom/vh) / 0.95)` | — | tepi kertas naik saat scroll |

**Resep:**
1. Section berikutnya: `margin-top: -100vh; position: relative; z-index: 4`, transparan sampai tiba. Pin-nya di-mask `radial-gradient(circle, #000 calc(var(--hole) - 30vh), transparent calc(var(--hole) - 15vh))`, dilepas saat `is-arrived`.
2. Selama masih overlap (`rect.top > 0`), geser pin `translateY(-rect.top)` supaya isinya diam di belakang mask (pre-pin).
3. Canvas fullscreen di hero menggambar isi lubang + tepi sobek dengan rumus radius yang sama, render **hanya** saat 0.001 < m < 0.999.

```js
import { glSection } from './gl-stage.js';
import { stickyProgress, range, smoothstep } from './motion-core.js';
const frag = /* glsl */ `uniform vec2 uRes; uniform float uP, uT; uniform vec3 uFill; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + 1.), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.07; a *= .5; } return s; }
void main(){
  float ar = uRes.x / uRes.y; vec2 uv = (vUv - .5) * vec2(ar, 1.);
  float R = uP * (.5 * length(vec2(ar, 1.)) + .35);                  // = rumus --hole (satuan tinggi layar)
  float e = length(uv) + (fbm(uv * 3.2 + uT * .04) - .5) * .32 - R;    // tepi sobek
  float hole = 1. - smoothstep(-.005, 0., e);
  float rim = (1. - smoothstep(0., .16, e)) * step(0., e) * step(.6, h(floor(gl_FragCoord.xy / 2.)));
  gl_FragColor = vec4(uFill, 1.) * max(hole, rim);                    // premultiplied alpha
}`;
export function portal(el, next, { a = 0.8, b = 0.99, fill = 0x101010 } = {}) {
  return glSection(el, ({ THREE, scene }) => {
    const u = { uRes: { value: new THREE.Vector2() }, uP: { value: 0 }, uT: { value: 0 }, uFill: { value: new THREE.Color(fill) } };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, fragmentShader: frag,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', transparent: true, premultipliedAlpha: true }));
    quad.frustumCulled = false; scene.add(quad);
    const canvas = el.querySelector('canvas.gl');
    return {
      onResize: (w, h) => u.uRes.value.set(w, h),
      update(dt, t) {
        const m = smoothstep(range(stickyProgress(el), a, b));
        next.style.setProperty('--hole', `${(m * (0.5 * Math.hypot(innerWidth, innerHeight) + 0.35 * innerHeight)).toFixed(1)}px`);
        next.classList.toggle('is-arrived', m >= 0.999);
        const live = m > 0.001 && m < 0.999; canvas.style.opacity = live ? '1' : '0';
        if (!live) return false;                                          // render hanya saat lubang berubah
        u.uP.value = m; u.uT.value = t;
      },
      renderStatic() { next.classList.add('is-arrived', 'no-portal'); },  // .no-portal: margin-top 0, tanpa mask
    };
  }, { antialias: false });
}
```

**Performa, mobile & reduced-motion:** satu fragment shader fullscreen, DPR 1.5, `antialias: false`, render hanya selama transisi. Kalau halaman tidak memakai Three di tempat lain, versi WebGL mentah (fullscreen triangle, ±60 baris) lebih hemat daripada mengunduh Three hanya untuk ini (R03 begitu). Mobile: pin pakai `100svh`. Reduced-motion: tanpa portal (`.no-portal`), section berikutnya mengalir biasa. Tanpa WebGL: tetap jalankan bagian CSS `--hole` lewat `defineSection` biasa (lubang bulat tanpa tepi sobek), dan seam kertas memakai gambar statis `torn-edge.webp`. Budget: 0 byte aset (seam fallback ±1 gambar).

**Jebakan:**
- R03: reduced-motion hanya dihormati sebagian; portal, video scrub, dan Lenis tetap jalan.
- Rumus radius CSS dan shader berbeda sedikit saja → tepi sobek tidak menempel ke mask, terlihat dua lingkaran.

### `skinned-page-flip-book` — Buku yang halamannya membalik oleh scroll

**Sumber:** R03 · **Mode:** A · **Tingkat berat:** berat\
**Kapan dipakai:** katalog, lookbook, atau portfolio yang ingin terasa seperti buku fisik di atas meja. Halaman benar-benar melengkung saat dibalik, dan semuanya digerakkan scroll pada section pinned (±620vh).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| segmen / tebal | 30 segmen, 31 bone; halaman 0.006, cover 0.022 | 20–40 segmen | halus lengkungan |
| turns | `[.12,.24]`, `[.32,.44]`, `[.52,.64]`, `[.72,.84]`, smoothstep lalu `inOutCubic` | lebar 0.12, jeda 0.08 | jendela tiap balikan, awal/akhir sangat lembut |
| bend | `sin(πn)·0.09·stiff·(i/30)^0.8`; stiffness cover 0.15 | 0.05–0.12; cover 0.1–0.3 | kertas melengkung paling kuat di tengah balikan |
| lift / tumpukan | `cover·0.14·cos(πn)` di 4 bone pertama; 0.014 per halaman | — | halaman terangkat saat cover dibuka; urutan tumpukan benar |
| kamera | fov 32, tilt 0.95 → 0.24 rad (p 0–0.14), dolly 0.78 → 1 (p 0.12–0.24) | — | dari miring ke top-down |
| tekstur halaman | Canvas2D 1024×1536 | 768–1024 lebar | plate + caption + noise kertas |

**Resep:**
1. Halaman = `BoxGeometry(1, 1.5, tebal, 30, 2)` digeser +0.5 di X (pivot di spine), skin weight linear antara bone k dan k+1. Rantai 31 bone berjarak 1/30. Material 6 sisi: 4 tepi warna kertas, +Z depan, −Z belakang.
2. Per frame: bone 0 berputar `−π·n − lift`, bone lain rotasi kecil kumulatif = lengkungan; z di-lerp dari tumpukan kanan ke kiri. Grup rebah (`rotation.x = −π/2`), bergeser ke tengah saat cover terbuka; kamera tilt + dolly dari progress.
3. Tekstur: tunggu `document.fonts.load(...)`, gambar per halaman dengan yield `setTimeout(0)`, lalu `initTexture` + compile; canvas fade-in setelah siap.

```js
import { glSection } from './gl-stage.js';
import { stickyProgress, range, smoothstep, ease, lerp } from './motion-core.js';
const SEG = 30, TURNS = [[0.12, 0.24], [0.32, 0.44], [0.52, 0.64], [0.72, 0.84]], GAP = 0.014;
function page(THREE, thick, mats) {
  const g = new THREE.BoxGeometry(1, 1.5, thick, SEG, 2).translate(0.5, 0, 0);   // pivot di spine
  const pos = g.attributes.position, idx = [], wgt = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * SEG, b = Math.min(Math.floor(x), SEG), f = x - b;
    idx.push(b, Math.min(b + 1, SEG), 0, 0); wgt.push(1 - f, f, 0, 0);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)).setAttribute('skinWeight', new THREE.Float32BufferAttribute(wgt, 4));
  const bones = [];
  for (let i = 0; i <= SEG; i++) { const b = new THREE.Bone(); if (i) { b.position.x = 1 / SEG; bones[i - 1].add(b); } bones.push(b); }
  const mesh = new THREE.SkinnedMesh(g, mats); mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;
  return { mesh, bones };
}
// pageMats: satu array 6 material per lembar; index 0 = cover; jumlah = TURNS.length + 1 (sampul belakang)
export function book(el, pageMats, { fit = 3.2 } = {}) {
  return glSection(el, ({ THREE, scene, camera }) => {
    const group = new THREE.Group(); group.rotation.x = -Math.PI / 2; scene.add(group);
    const pages = pageMats.map((m, i) => { const pg = page(THREE, i ? 0.006 : 0.022, m); group.add(pg.mesh); return pg; });
    camera.fov = 32; camera.up.set(0, 0, -1); scene.add(new THREE.HemisphereLight(0xfff1dd, 0x222222, 1.6));
    return {
      update() {
        const p = stickyProgress(el), turn = (i) => (TURNS[i] ? range(p, ...TURNS[i]) : 0), open0 = turn(0);
        pages.forEach((pg, i) => {
          const n = ease.inOutCubic(smoothstep(turn(i))), stiff = i ? 1 : 0.15;   // double ease
          const lift = i ? open0 * 0.14 * Math.cos(Math.PI * n) : 0;
          pg.mesh.position.z = lerp(-i * GAP, -(pages.length - 1 - i) * GAP, n);
          pg.bones[0].rotation.y = -Math.PI * n - lift;
          for (let k = 1; k <= SEG; k++) pg.bones[k].rotation.y = Math.sin(Math.PI * n) * 0.09 * stiff * (k / SEG) ** 0.8 + (k <= 4 ? lift / 4 : 0);
        });
        group.position.set(-0.5 * (1 - open0), pages.length * GAP + 0.01, 0);
        const ang = lerp(0.95, 0.24, smoothstep(range(p, 0, 0.14))), d = fit * lerp(0.78, 1, smoothstep(open0));
        camera.position.set(0, d * Math.cos(ang), d * Math.sin(ang) + 0.03); camera.lookAt(0, 0, 0);
      },
    };
  }, { staticOnReduce: false, dprCap: 1.75 });
}
```

**Performa, mobile & reduced-motion:** budget: Three lazy (R03: chunk 860 KB termasuk R3F, dimuat via `import()` saat ≤ 300% viewport, prefetch saat idle 4 s), 5 tekstur Canvas2D (±4 MB VRAM per 1024×1536, jangan lebih dari ±8 lembar), shadow map 1024 (R03: 2048, terlalu berat di HP). Mobile: tekstur 768 lebar, DPR 1.25, tanpa partikel debu. Reduced-motion: tetap di-scrub (scroll = kendali user), tapi tanpa lilin berkedip, tanpa partikel, dan kamera tidak ber-tilt (langsung top-down). Tanpa WebGL: daftar spread sebagai gambar statis berurutan.

**Jebakan:**
- R03: klaim "bisa di-swipe" tidak ada di kode; halaman hanya membalik oleh scroll. Kalau brief minta swipe, tambahkan drag → progress sendiri.
- R03: shadow 2048 + DPR 1.75 + Sparkles berat untuk HP low-end; hero 620vh + catalogue 620vh + loupe 440vh = scroll fatigue. Pakai ±100vh per balikan + 100vh.
- Lupa `frustumCulled = false` di SkinnedMesh → halaman hilang saat bone membengkokkannya keluar bounding box awal.

### `css3d-sphere-gallery` — Bola galeri CSS 3D (tanpa WebGL)

**Sumber:** R03, R05 · **Mode:** A · **Tingkat berat:** ringan\
**Kapan dipakai:** koleksi 15–50 gambar yang ingin terasa "melayang di langit": bola yang berputar sendiri, ikut berputar saat scroll, dan bisa di-drag. Karena isinya kartu datar, CSS 3D sudah cukup. Kalau objeknya bisa dipilih dan cuma butuh ilusi kedalaman (gigi, kursi, pin peta), turun satu anak tangga lagi ke **SVG prosedural** seperti R05: hit-test native, filter "clay" untuk kedalaman, dan tanpa rAF.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| tile | 46 (16 karya diulang), golden angle y 0.86 → −0.86; 112 px landscape / 80 px portrait | 20–60 | kepadatan bola, hindari kutub |
| radius / perspective | `clamp(180, 0.24·vw, 330)` px (mobile `0.4·vw`, tile ×0.62); perspective 1400 px | persp. 1000–1800 | ukuran bola dan kedalaman |
| auto-rotate / scroll | 0.06°/frame (follow 0.02); Δprogress × 260° | 0–0.1°; 120–360° | 0 saat reduced |
| drag | vy = dx × 0.25, vx = −dy × 0.15, damping X 0.94/frame, rotX ±40° (awal −8°) | — | — |
| klik vs drag | 6 px | 4–10 px | pointer capture baru diambil setelah lewat ambang |

**Resep:**
1. Markup: `.stage{perspective:1400px; touch-action:pan-y}` > `.ball{transform-style:preserve-3d; width:0; height:0}` > `.tile{position:absolute; translate:-50% -50%; backface-visibility:hidden}`. Posisi tile `rotateY(lon) rotateX(-lat) translateZ(R)`, dihitung sekali dan saat resize.
2. Loop (hanya saat terlihat): auto-rotate di-damp ke target, damping X, scroll coupling dari selisih `passProgress`, tulis satu `transform` ke `.ball`.
3. Klik tile (gerak < 6 px) membuka lightbox; selama lightbox terbuka, hentikan smooth scroll.

```js
import { defineSection, passProgress, clamp, damp } from './motion-core.js';
export function sphereGallery(el) {
  const ball = el.querySelector('.ball'), tiles = [...ball.children], G = Math.PI * (3 - Math.sqrt(5));
  const place = () => {
    const R = innerWidth < 760 ? innerWidth * 0.4 : clamp(innerWidth * 0.24, 180, 330);
    tiles.forEach((t, i) => {
      const y = 0.86 - (i / (tiles.length - 1)) * 1.72, r = Math.sqrt(1 - y * y), a = G * i;
      t.style.transform = `rotateY(${Math.atan2(Math.cos(a) * r, Math.sin(a) * r)}rad) rotateX(${-Math.asin(y)}rad) translateZ(${R}px)`;
    });
  };
  return defineSection(el, ({ reduced }) => {
    const st = { x: -8, y: 0, vx: 0, vy: 0, drag: null }, ac = new AbortController(), on = { signal: ac.signal };
    let prevP = passProgress(el); place();
    el.addEventListener('pointerdown', (e) => { st.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; }, on);
    el.addEventListener('pointermove', (e) => {
      const d = st.drag; if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.moved > 6 && !el.hasPointerCapture(d.id)) el.setPointerCapture(d.id);   // klik vs drag: 6 px
      st.vy = dx * 0.25; st.vx = -dy * 0.15; st.y += st.vy; st.x = clamp(st.x + st.vx, -40, 40);
    }, on);
    el.addEventListener('pointerup', () => { st.drag = null; }, on);         // moved < 6 → click jalan ke tile
    return {
      onResize: place,
      update(dt) {
        const p = passProgress(el), f = dt * 60;
        if (!st.drag) {
          st.vy = damp(st.vy, reduced ? 0 : 0.06, 1.2, dt);                  // auto-rotate 0.06°/frame
          st.vx *= Math.pow(0.94, f);
          st.y += st.vy * f + (reduced ? 0 : (p - prevP) * 260);              // scroll coupling
          st.x = clamp(st.x + st.vx * f, -40, 40);
        }
        prevP = p;
        ball.style.transform = `rotateX(${st.x}deg) rotateY(${st.y}deg)`;
      },
      destroy: () => ac.abort(),
    };
  });
}
```

**Performa, mobile & reduced-motion:** budget: 0 KB JS 3D, 16 gambar unik ±20–40 KB WebP (tile 112 px @2×), total ≤ 600 KB, lazy. Hanya satu `transform` per frame. Mobile: radius 0.4vw, tile ×0.62, stage 64vh, `touch-action: pan-y` supaya scroll vertikal tetap jalan. Reduced-motion: tanpa auto-rotate dan tanpa scroll coupling; drag tetap boleh karena dimulai user. Tanpa CSS 3D (sangat jarang): grid biasa.

**Jebakan:**
- `transform-style: preserve-3d` rusak kalau ada ancestor dengan `overflow: hidden`, `filter`, atau `opacity < 1`. Tile tiba-tiba rata.
- R05 (versi SVG): dengan filter blur di 32 grup, entrance bisa berat di HP low-end; dan gigi depan bawah di 375 px hanya ±20×22 px, di bawah target sentuh 44 px.

### `shelf-room-gallery` — Galeri sebagai rak di ruangan 3D

**Sumber:** R06a · **Mode:** B (A versi kecil: rak saja, tanpa ruangan) · **Tingkat berat:** berat\
**Kapan dipakai:** homepage portfolio/library yang menyajikan koleksi sebagai benda fisik (buku di rak). Hover menarik item keluar, klik menerbangkan item ke depan kamera lalu kontennya diambil alih DOM.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| kamera | FOV 27°, near 0.2, far 90; DPR 1.5 (2 hanya saat halaman dibaca) | FOV 25–35 | lensa tele, kesan diorama |
| parallax kamera | x 1.3, y 0.6 unit, follow 0.05/frame (λ ≈ 3), −55% saat zoom ke rak | — | — |
| pull hover | keluar 0.62, naik 0.03, tip 0.11 rad; spring k 0.055 d 0.3 /frame = `createSpring({ stiffness: 198, damping: 18 })` | — | konversi: k·3600, d·60 |
| terbang & buka | 1.6 s; tip [0–.34], turn [.2–.9], open [.28–1] (cover −2.86 rad), land [.6–.98]; sag 0.22 (`sin²`), roll 0.16 | 1.2–1.8 s | — |
| zoom DOM | 0.6 s, `p' = a·p / (1 + (a−1)·p)`, a = skala akhir/awal | — | zoom terasa seperti dolly rata |

**Resep:**
1. Ruangan primitive: plane dinding/lantai, rak box, item `BoxGeometry` bertekstur Canvas2D; hemisphere + satu spot ber-shadow.
2. Raycast ke item tiap frame (±11 objek, murah); target pull 1 untuk yang di-hover, 0 lainnya, lewat spring per item. Parallax kamera dari pointer, `lookAt` titik tetap.
3. Klik: item terbang lewat kurva kubik ke depan kamera (1.6 s, sag, roll), lalu `onOpen(i)`: tile DOM yang di-clip ke kotak halaman mengambil alih, dan zoom ke full screen dengan progress terkoreksi perspektif. Esc membalik arah. Touch: tap 1 = pilih, tap 2 = buka.

```js
import { glSection } from './gl-stage.js';
import { damp, createSpring, ease, clamp } from './motion-core.js';
export function shelf(el, items /* [{ color }] */, { onOpen } = {}) {
  return glSection(el, ({ THREE, scene, camera, reduced, fine, signal }) => {
    camera.fov = 27; const aim = new THREE.Vector3(0, 1.2, 0); scene.add(new THREE.HemisphereLight(0xfff3e0, 0x2a2420, 2));
    const books = items.map((it, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.2 + (i % 3) * 0.08, 0.9), new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.7 }));
      m.position.set((i - (items.length - 1) / 2) * 0.32, 1.2, 0);
      m.userData = { i, home: m.position.clone(), s: createSpring({ stiffness: 198, damping: 18 }) }; scene.add(m); return m; });
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9), pn = { x: 0, y: 0 }, par = { x: 0, y: 0 }; let hovered = -1, fly = null;
    const aimAt = (e) => { const r = el.getBoundingClientRect(); pn.x = ((e.clientX - r.left) / r.width) * 2 - 1; pn.y = -((e.clientY - r.top) / r.height) * 2 + 1; ndc.set(pn.x, pn.y); };
    el.addEventListener('pointermove', aimAt, { signal }); el.addEventListener('pointerdown', aimAt, { signal });
    el.addEventListener('click', () => { if (hovered < 0 || fly) return;
      const b = books[hovered], a = b.position.clone(), z = camera.position.clone().add(new THREE.Vector3(0, -0.2, -3));
      fly = { b, t: 0, dir: 1, curve: new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(0, 0.6, 1.2)), z.clone().add(new THREE.Vector3(0, 0.4, -0.6)), z) }; }, { signal });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && fly) fly.dir = -1; }, { signal });
    return {
      update(dt) {
        if (!fly) { ray.setFromCamera(ndc, camera); hovered = ray.intersectObjects(books, false)[0]?.object.userData.i ?? -1; }
        for (const b of books) {
          if (fly?.b === b) continue;
          const s = b.userData.s; s.set(b.userData.i === hovered ? 1 : 0); const k = s.step(dt), h = b.userData.home;
          b.position.set(h.x, h.y + k * 0.03, h.z + k * 0.62); b.rotation.x = k * 0.11;
        }
        if (fly) {
          fly.t = clamp(fly.t + (fly.dir * dt) / (reduced ? 0.01 : 1.6)); const e = ease.inOutCubic(fly.t);
          fly.curve.getPoint(e, fly.b.position); fly.b.position.y -= Math.sin(Math.PI * e) ** 2 * 0.22;   // sag
          fly.b.rotation.set(0, (-Math.PI / 2) * ease.inOutCubic(clamp((fly.t - 0.2) / 0.7)), Math.sin(Math.PI * e) * 0.16);
          if (fly.t === 1 && fly.dir > 0 && !fly.done) { fly.done = true; onOpen?.(fly.b.userData.i); }
          if (fly.t === 0 && fly.dir < 0) fly = null;
        }
        const f = fine && !reduced ? 1 : 0;
        par.x = damp(par.x, pn.x * f, 3, dt); par.y = damp(par.y, pn.y * f, 3, dt);
        camera.position.set(par.x * 1.3, 1.4 + par.y * 0.6, 9); camera.lookAt(aim);
      },
    };
  }, { staticOnReduce: false });
}
```

**Performa, mobile & reduced-motion:** budget: 0 byte model untuk versi primitive; ruangan detail (jam, tanaman, karpet) ±1–2 MB tekstur kalau difoto. Upload tekstur dibagi satu per frame (`renderer.initTexture` antri) supaya tidak jank. Konten live di halaman buku hanya jalan (`setRunning(true)`) saat di-hover/dibaca. Mode lite (`pointer: coarse` atau < 760 px): shadow 1024, debu 90 (bukan 240), tanpa grain, konten live tidak di-preload. Reduced-motion: parallax kamera, ayunan lampu, dan pendulum "angin" kursor mati; terbang jadi instan. Aksesibilitas: canvas `role="img"` + `aria-label`, plus daftar item DOM yang terlihat saat fokus (untuk screen reader dan SEO). Tanpa WebGL: daftar item DOM itu sendiri jadi tampilan utama.

**Jebakan:**
- R06a: GSAP + Observer di-load tapi rak tidak memakainya; modul sound lengkap ada tapi tombolnya di-hidden oleh flag (bobot sia-sia).
- R06a (sample): follow per frame tanpa koreksi dt → di layar 120 Hz terasa 2× lebih cepat. Di skill selalu pakai `damp`.
- Untuk mode A jangan bawa ruangan penuh. Ambil tiga hal: parallax kamera dt-corrected, spring pull saat hover, dan zoom DOM yang dikoreksi perspektif.

### `velocity-bend-media` — Kartu media yang melengkung/molor oleh kecepatan

**Sumber:** R06a, R08 · **Mode:** A · **Tingkat berat:** sedang\
**Kapan dipakai:** slider/reel foto atau video proyek. Saat digeser cepat, kartu melengkung ke arah kamera, molor searah gerak, tepinya tertinggal, dan warnanya terpecah. Saat berhenti, snap ke satu item. Lebih halus dari `skewX` biasa karena deformasinya per-vertex.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| input (R08) | wheel `deltaY/200 × 0.015`, clamp ±0.9 (touch ±2.9); friction 0.9/frame (mobile 0.955) | friction 0.88–0.96 | impuls + luncuran |
| snap | target `round(pos + vel·9)` saat \|vel\| < 0.005; spring 0.05, damping 0.5/frame | — | proyeksi titik berhenti |
| bend | `clamp(\|vel\|·9·1.8, 0, 2.5)` unit world (R08) ≈ 0.32 × lebar kartu, smoothing 0.25/frame | 0.2–0.4 × lebar | lengkung ke kamera |
| stretch / trail / split (R06a) | `1 + \|speed\|·0.0045`; tepi `speed·1.5·edge²` px; RGB split `speed·0.0006` UV (cursor wake 0.0016); maks 90 px/frame | 0.003–0.006; 1–2 px | molor, tepi tertinggal berbentuk busur, warna terpecah |
| kartu | SDF radius 24 px + AA `fwidth`; non-aktif dim 0.55; plane 32×32 segmen | segmen 24–32 | sudut bulat tanpa mask |

**Resep:**
1. Stage px: kamera perspektif berjarak `h/2 / tan(fov/2)`, jadi 1 unit = 1 px di z = 0. Satu `PlaneGeometry(1, 1, 32, 32)` dipakai bersama, ukuran lewat `scale` + `uSize`.
2. Shader kartu (R06a): rounded-rect SDF + RGB split 3-tap + `uDim`; vertex: stretch + trail (R06a) + bend sinus ganda (R08). Fisika (R08): mode bebas (friction) → begitu pelan, spring ke item terdekat dari titik berhenti yang diproyeksikan. Touch: drag → `target -= dy / gap`; keyboard panah ±1.
3. Video: hanya item aktif + berikutnya yang `play()`, sisanya pause dengan `preload` bertahap; skip render saat idle (`requestVideoFrameCallback` untuk tahu ada frame baru).

```js
import { glSection } from './gl-stage.js';
import { damp, clamp } from './motion-core.js';
const vert = /* glsl */ `uniform float uV, uBend; uniform vec2 uSize; varying vec2 vUv;
void main(){ vUv = uv; vec3 p = position; float e = uv.x * 2. - 1.;
  p.y *= 1. + abs(uV) * .0045;                                         // molor searah gerak
  p.y -= uV * 1.5 * e * e / uSize.y;                                    // tepi tertinggal (busur)
  p.z += (sin(uv.y * 3.1416) * .5 + sin(uv.x * 3.1416) * .2) * uBend;   // lengkung ke kamera
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;
const frag = /* glsl */ `uniform sampler2D uMap; uniform vec2 uSize, uSplit; uniform float uRadius, uDim; varying vec2 vUv;
void main(){ vec2 q = abs(vUv - .5) * uSize - (uSize * .5 - uRadius);
  float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uRadius, a = 1. - smoothstep(-fwidth(d), fwidth(d), d);
  vec3 c = vec3(texture2D(uMap, vUv + uSplit).r, texture2D(uMap, vUv).g, texture2D(uMap, vUv - uSplit).b);
  gl_FragColor = vec4(c * (1. - uDim), a); }`;
export function bendSlider(el, textures /* VideoTexture | CanvasTexture */) {
  return glSection(el, ({ THREE, scene, camera, reduced, small, signal }) => {
    const geo = new THREE.PlaneGeometry(1, 1, 32, 32), N = textures.length;
    const slides = textures.map((map) => { const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, extensions: { derivatives: true },
      uniforms: { uMap: { value: map }, uSize: { value: new THREE.Vector2() }, uSplit: { value: new THREE.Vector2() }, uV: { value: 0 }, uBend: { value: 0 }, uRadius: { value: 24 }, uDim: { value: 0 } } }));
      scene.add(m); return m; });
    let W = 1, H = 1, pos = 0, vel = 0, target = 0, free = false, bend = 0; const fric = small ? 0.955 : 0.9;
    el.addEventListener('wheel', (e) => { e.preventDefault(); vel = clamp(vel + (e.deltaY / 200) * 0.015, -0.9, 0.9); free = true; }, { passive: false, signal });
    return {
      onResize(w, h) { W = w; H = h; camera.position.z = h / 2 / Math.tan((camera.fov * Math.PI) / 360); camera.far = camera.position.z * 3; camera.updateProjectionMatrix(); },
      update(dt) { const f = dt * 60;
        if (free) { vel *= fric ** f; pos += vel * f; target = Math.round(pos + vel * 9); if (Math.abs(vel) < 0.005) free = false; }
        else { vel += (target - pos) * 0.05 * f; vel *= 0.5 ** f; pos += vel * f; }      // spring snap
        if (reduced) { pos = target; vel = 0; }
        const w = Math.min(W * 0.56, H * 0.62 * 16 / 9), h = (w * 9) / 16, gap = h * 1.08, speed = clamp(vel * gap, -90, 90);
        bend = damp(bend, clamp((Math.abs(vel) * 9 * 1.8) / 7.7, 0, 0.32) * Math.sign(vel), 17, dt);
        slides.forEach((m, i) => {
          let d = i - pos; d = ((((d + N / 2) % N) + N) % N) - N / 2;             // jarak loop terdekat
          const u = m.material.uniforms; m.position.set(0, -d * gap, 0); m.scale.set(w, h, w);
          u.uSize.value.set(w, h); u.uV.value = speed; u.uBend.value = bend; u.uSplit.value.set(0, speed * 0.0006); u.uDim.value = 0.55 * Math.min(1, Math.abs(d));
        });
      },
    };
  }, { staticOnReduce: false });
}
```

**Performa, mobile & reduced-motion:** budget: tekstur ≤ 1024 px sisi panjang, video `-lite`/`-mob` ≤ 2–3 MB per klip, hanya 2 video aktif. DPR 1.5 (R08). Mobile: friction 0.955, bend maks lebih kecil (R08: 2.0 vs 2.5), touch gain naik untuk swipe cepat. Reduced-motion: tanpa bend/stretch/split, snap langsung (atau crossfade 0.15 s). Tanpa WebGL: scroll-snap CSS biasa dengan `<video>`/`<img>` dan `border-radius`.

**Jebakan:**
- R06a (5 sample): tidak ada handling `prefers-reduced-motion` sama sekali, dan follow 0.10–0.22 per frame tanpa koreksi dt.
- Wheel listener harus `passive: false` + `preventDefault`, tapi hanya di dalam section. Kalau dipasang di `window`, halaman tidak bisa di-scroll.

### `cylinder-label-spin` — Label berputar di silinder, satu context untuk banyak canvas

**Sumber:** R07 · **Mode:** A+B · **Tingkat berat:** sedang\
**Kapan dipakai:** deretan produk kemasan silinder (toples, kaleng, botol) di carousel DOM, di mana labelnya harus bisa berputar mengelilingi kemasan saat hover, saat di-scrub, atau saat carousel digeser cepat. Badan kemasan tetap `<img>` biasa; hanya label yang 3D.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| geometri | `LatheGeometry` profil lurus 17 titik, 128 segmen; lebar 0.885, miring 3°; ambient 0.89 + spot 0.58 dari kiri | 64–128 segmen, 2–5° | silinder label |
| `gap` seam | 0.09 | 0.05–0.12 | celah label di-`discard` supaya sambungan tidak terlihat |
| hover spin | 1 putaran dalam 2 s, `inOutQuint`, setelah diam 260 ms | 1.5–2.5 s | — |
| twist / cursor | `−clamp(v/2400)·38°`; cursor ±30°, falloff Gaussian `(1.6·w)²` | 20–40° | label "terpelintir" saat carousel cepat |
| lazy / budget | Three di-import 1000 ms setelah mount; DPR ≤ 3 **dan** total piksel semua canvas label ≤ 12 MP | — | — |

**Resep:**
1. Tiap item carousel = `<img>` kemasan + `<canvas>` 2D label (ukuran sama). **Satu** `WebGLRenderer` offscreen untuk semua label: pasang tekstur + offset → `render()` → `ctx.drawImage(renderer.domElement)` ke canvas item.
2. Patch `MeshStandardMaterial` lewat `onBeforeCompile`: `#include <map_fragment>` diganti sampling `fract(uv.x + offset)` + `discard` di celah seam.
3. Gambar ulang label **hanya** kalau offset berubah **dan** item terlihat. Offset = sudut depan − hover spin − twist; driver bisa hover, progress scroll (halaman detail), atau kecepatan carousel.

```js
// Satu renderer offscreen dipakai bergantian untuk semua label
export async function createLabelPainter({ w = 256, h = 410, gap = 0.09, tiltDeg = 3 } = {}) {
  const THREE = await import('three');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  const scene = new THREE.Scene(), ar = h / w, cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5 * ar, -0.5 * ar, 0.1, 10); cam.position.z = 3;
  const spot = new THREE.SpotLight(0xffffff, 6, 0, 0.8, 1); spot.position.set(-2, 0.5, 2.5);
  scene.add(new THREE.AmbientLight(0xffffff, 0.89), spot);
  const prof = Array.from({ length: 17 }, (_, i) => new THREE.Vector2(0.4425, (i / 16 - 0.5) * 0.6 * ar));   // dinding lurus
  const uOffset = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), transparent: true, roughness: 0.6 });  // map awal → USE_MAP
  mat.onBeforeCompile = (s) => {
    s.uniforms.uOffset = uOffset; s.uniforms.uGap = { value: gap };
    s.fragmentShader = 'uniform float uOffset, uGap;\n' + s.fragmentShader.replace('#include <map_fragment>', `
      float u = fract(vMapUv.x + uOffset);
      if (u >= 1.0 - uGap) discard;                                 // sembunyikan seam label
      diffuseColor *= texture2D(map, vec2(u / (1.0 - uGap), vMapUv.y));`);
  };
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), mat);
  mesh.rotation.x = (tiltDeg * Math.PI) / 180; scene.add(mesh);
  return {
    THREE,
    draw(ctx2d, texture, turns) {                                    // turns: 0..1 = satu putaran
      texture.wrapS = THREE.RepeatWrapping; mat.map = texture; uOffset.value = turns;
      renderer.render(scene, cam);
      ctx2d.clearRect(0, 0, ctx2d.canvas.width, ctx2d.canvas.height);
      ctx2d.drawImage(renderer.domElement, 0, 0, ctx2d.canvas.width, ctx2d.canvas.height);   // task yang sama → tanpa preserveDrawingBuffer
    },
    dispose() { mesh.geometry.dispose(); mat.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
// Pemakaian di update() carousel (defineSection): if (item.visible && item.turns !== item.drawn) { painter.draw(item.ctx, item.tex, item.turns); item.drawn = item.turns; }
// hover: item.turns = FRONT - ease.inOutQuint(clamp(heldFor / 2)) ; FRONT = 182/360
```

**Performa, mobile & reduced-motion:** budget: Three lazy 1 s setelah mount, tekstur label ≤ 1024 px lebar (WebP), 5 label pertama di-preload `fetchpriority=high`, total piksel canvas ≤ 12 MP. Hindari `filter: blur()` + `brightness()` per item per frame seperti R07 (repaint mahal); kalau perlu blur, pakai beberapa level statis. Mobile: hover-spin dan tarikan kursor mati (`hover:hover and pointer:fine`), blur cap 2 px, label tetap bisa ikut twist. Reduced-motion: label diam di sudut depan, tanpa twist/hover spin; carousel tetap bisa digeser user. Tanpa WebGL: label sudah tercetak di `<img>` kemasan (versi "labelled"), canvas disembunyikan.

**Jebakan:**
- R07: rAF jalan terus walau carousel diam, `getBoundingClientRect()` section dibaca tiap frame, dan reduced-motion hanya dihormati sebagian.
- Mengganti `mat.map` dari `null` ke tekstur memicu recompile shader. Pasang tekstur placeholder sejak awal (seperti di snippet).

### `morphing-point-cloud` — Point cloud yang di-scan lalu morph

**Sumber:** R15, R02 · **Mode:** A+B · **Tingkat berat:** berat (FBO 100k) / sedang (atribut 20–40k)\
**Kapan dipakai:** section teknologi/data: titik-titik terrain muncul lewat gelombang scan radial, lalu menyusun ulang dirinya menjadi bola (atau logo/teks), lalu kolaps. Scroll hanya memilih **mode**; transisinya time-based supaya selalu selesai dengan rapi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| jumlah titik | FBO 320² = 102.400 (R15, desktop ≥ 1200 px) / atribut 40k desktop, 20k mobile | 20k–100k | — |
| morph | stagger 0.35 (`fract(seed·7.31)·stagger`), 1.6 s smootherstep `t³(6t²−15t+10)` | stagger 0.2–0.5, 1–2 s | cloud menyusun ulang dirinya, bukan cross-fade |
| swirl | terrain 0.01, bola 0.44, ×(1 + 4.8·x(1−x)) saat transit | — | mengembang di tengah transisi |
| titik | `size·focalPx·(0.55 + seed·0.9)/−z`, cap 14 px; opacity 0.54; `#8F979B` | cap 8–16 | ukuran konsisten walau FOV/DPR berubah |
| scan radial | 5 unit/s × 1.5, edge 3 (skala R15); snippet: 1.5 unit/s, edge 0.4 (terrain radius 1) | — | titik muncul sebagai gelombang dari origin |
| mode | segmen `floor(p·3)`, hysteresis 0.005, fase minimal 1 s; fade in / out / collapse 1.05 / 0.45 / 0.85 s | — | scroll memilih mode, bukan menyetir uniform |

**Resep:**
1. Dua bentuk dengan jumlah titik sama: terrain prosedural (grid acak + noise height) dan shell bola 0.85–1. Bentuk dari mesh: sampling area-weighted (CDF luas segitiga + barycentric acak), normalisasi ke radius 1.
2. Versi ringan (snippet): `position` = bentuk A, `aTarget` = bentuk B, `aSeed`; morph + drift `sin` di vertex shader. Versi berat (R15): pass simulasi ke RT 320² (`FloatType` kalau `EXT_color_buffer_float` ada, lalu `HalfFloatType`, kalau gagal cloud dimatikan) dengan curl noise ternormalisasi.
3. Mode dipilih dari segmen scroll (hysteresis) atau tab; uniform bergerak dengan rate tetap lalu di-ease. Varian R02 (partikel jatuh): `fract(seed + time·rate)` = posisi sepanjang Bézier A→C→B di vertex shader. Untuk mesh terrain, scan yang sama dipakai di overlay dot-grid triplanar (`fract(worldPos.xz·33)`, radius 0.02, hanya permukaan menghadap atas) + kontur `fract(y/spacing)` yang merapat 1.5 → 0.22.

```js
import { glSection } from './gl-stage.js';
import { clamp } from './motion-core.js';
const vert = /* glsl */ `attribute vec3 aTarget; attribute float aSeed;
uniform float uMorph, uStagger, uTime, uSwirl, uScan, uSize, uFocalPx, uMaxPx; varying float vA;
void main(){
  float lag = fract(aSeed * 7.31) * uStagger, m = clamp((uMorph - lag) / max(1. - uStagger, 1e-3), 0., 1.);
  vec3 p = mix(position, aTarget, m);                                   // morph per partikel
  vec3 c = vec3(sin(p.y * 3. + uTime + aSeed * 6.), sin(p.z * 3. + uTime * 1.3), sin(p.x * 3. - uTime));
  p += normalize(c + 1e-4) * uSwirl * (1. + 4.8 * m * (1. - m));        // mengembang saat transit
  vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uSize * uFocalPx * (.55 + aSeed * .9) / max(-mv.z, 1e-3), uMaxPx);
  vA = mix(smoothstep(uScan, uScan - .4, length(position.xz)), 1., m) * (.55 + .45 * aSeed);   // scan radial
}`;
const frag = /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){
  float r = length(gl_PointCoord - .5) * 2.; if (r > 1.) discard; gl_FragColor = vec4(uColor, (1. - smoothstep(.65, 1., r)) * vA * uOpacity); }`;
export function pointCloud(el, { n = 40000, getMode = () => 'terrain' } = {}) {   // getMode → 'terrain' | 'sphere'
  return glSection(el, ({ THREE, scene, camera, renderer, small }) => {
    const N = small ? Math.min(n, 20000) : n, pos = new Float32Array(N * 3), tgt = new Float32Array(N * 3), seed = new Float32Array(N), v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 2 - 1, z = Math.random() * 2 - 1;
      pos.set([x, 0.18 * Math.sin(x * 3.1) * Math.cos(z * 2.3) + 0.06 * Math.sin(x * 9 + z * 7), z], i * 3);   // terrain prosedural
      v.randomDirection().multiplyScalar(0.85 + 0.15 * Math.random()); tgt.set([v.x, v.y, v.z], i * 3); seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)).setAttribute('aTarget', new THREE.BufferAttribute(tgt, 3)).setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const u = { uMorph: { value: 0 }, uStagger: { value: 0.35 }, uTime: { value: 0 }, uSwirl: { value: 0.01 }, uScan: { value: 0 }, uSize: { value: 0.012 },
      uFocalPx: { value: 1 }, uMaxPx: { value: 14 }, uColor: { value: new THREE.Color(0x8f979b) }, uOpacity: { value: 0.54 } };
    scene.add(new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false })));
    camera.position.set(0, 1.6, 3.2); camera.lookAt(0, 0, 0); let morph = 0; const buf = new THREE.Vector2();
    return {
      onResize: () => { u.uFocalPx.value = (0.5 * renderer.getDrawingBufferSize(buf).y) / Math.tan((camera.fov * Math.PI) / 360); },
      update(dt) {
        const want = getMode() === 'sphere' ? 1 : 0;
        morph = clamp(morph + Math.sign(want - morph) * Math.min(Math.abs(want - morph), dt / 1.6));   // 1.6 s, time-based
        const m = morph ** 3 * (morph * (morph * 6 - 15) + 10);                                         // smootherstep
        u.uMorph.value = m; u.uSwirl.value = 0.01 + 0.43 * m; u.uScan.value += dt * 1.5; u.uTime.value += Math.min(dt, 1 / 30) * 0.12;
      },
      renderStatic() { u.uMorph.value = getMode() === 'sphere' ? 1 : 0; u.uSwirl.value = 0; u.uScan.value = 99; },
    };
  });
}
```

**Performa, mobile & reduced-motion:** budget: 0 byte aset untuk versi prosedural (R15 memakai GLB terrain 2.6 MB hanya sebagai sumber sampling; ganti dengan noise). 40k titik × 1 vertex shader masih aman di desktop; mobile 20k dengan drift `sin`. Cap ukuran titik 14 px menahan fill-rate saat titik dekat lensa. DPR: cap helper; R15 memakai budget piksel `sqrt(7 372 800 / (w·h))` (≈ 3840×1920) dan cap 1 di ≤ 1024 px kecuali GPU tier tinggi. Reset state dan sembunyikan cloud begitu keluar section. Reduced-motion: langsung ke mode akhir, `uSwirl = 0`, waktu dibekukan, scan langsung penuh (semua titik tampil, tanpa ring/pulse). Tanpa WebGL atau tanpa float RT (versi FBO): poster statis bentuk akhir.

**Jebakan:**
- R15: partikel hanya dibuat di ≥ 1200 px dan kalau float RT tersedia, **tanpa fallback visual** di bawah itu (section terlihat kosong); `prefers-reduced-motion` tidak ditangani sama sekali.
- R15: brief menyebut "loader .las/LiDAR", padahal titiknya di-sample dari mesh GLB biasa. Tidak perlu data LiDAR sungguhan.
- `sizeAttenuation` bawaan `PointsMaterial` membuat ukuran titik berubah saat DPR berubah; hitung `uFocalPx` dari drawing buffer seperti di snippet.

### `product-configurator-3d` — Configurator dengan kontrak nama mesh

**Sumber:** R17 (+ R01 untuk swap) · **Mode:** A+B · **Tingkat berat:** sedang\
**Kapan dipakai:** produk yang bisa dikustom (warna per zona, add-on furnitur, varian ukuran). Mode A: satu section sticky 100vh dengan canvas + panel kanan (bottom sheet di mobile). Mode B: halaman `/configure` dengan wizard penuh + summary + harga.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| kontrak nama | `ZONE*` (EXTERIOR, INTERIOR, FABRICS, TABLE_TOP) → swatch; `AddonN_*` → grup radio; `Addon_dop_*` → toggle; `Glass*` → fade | — | UI dibangkitkan dari nama mesh |
| kamera | FOV 40 (R17: 75); orbit damping 0.08 (R17: 0.25), `enablePan: false`, jarak 2–7, polar 0.2 → π/2 − 0.05 | FOV 35–45 | "fotografis", user tidak bisa tersesat |
| fly-to-view | 900 ms `outCubic`, fit padding 1.1 / 1.4 mobile | 700–1000 ms | tambahan kita; di R17 kamera loncat |
| fade kaca | 0 ↔ 0.88, 600 ms smoothstep (R17: 1000 ms linear) | 400–1000 ms | `depthWrite` hanya saat hampir opak |
| swap / env | fade 300 ms + hold 300–500 ms, cache build; `RoomEnvironment` (R17: HDR 1.5 MB) | — | lihat `blur-masked-model-swap` |
| panel | 324 px kanan / bottom sheet `translateY(120%)` di < 767 px, 300 ms | — | — |

**Resep:**
1. Bangun produk dari primitive dengan **nama mesh** sesuai kontrak (atau minta 3D artist memakai nama yang sama di GLB); capacity/ukuran jadi parameter builder, bukan file berbeda. Satu traverse mengelompokkan mesh per zona/add-on/kaca, dan UI dibangkitkan dari hasilnya.
2. Satu `state` + satu `apply(state)` sebagai satu-satunya jalan mengubah scene. Simpan ke URL hash supaya bisa di-share; summary/harga membaca state, bukan DOM. Share **satu material** per zona supaya part terkait (kursi ikut interior) berubah dengan satu `color.set()`.
3. Kamera terbang ke view preset (Front / Interior / Top), orbit dimatikan selama terbang. Render **on demand**: hanya saat `controls.update()` melapor perubahan, tween jalan, atau state berubah. Snapshot: pindah ke view frontal, `render()`, langsung `canvas.toDataURL()` di task yang sama, kembalikan kamera.

```js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { glSection } from './gl-stage.js';
import { ease, smoothstep } from './motion-core.js';
export function configurator(el, buildPod, palette /* { EXTERIOR: [...], INTERIOR: [...] } */, onUi) {
  const state = { colors: {}, addon: 'Addon1', glass: false }; let apply = () => {};
  const sec = glSection(el, ({ THREE, scene, camera, renderer, reduced, small }) => {
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    renderer.toneMapping = THREE.ACESFilmicToneMapping; camera.fov = 40;
    const controls = Object.assign(new OrbitControls(camera, renderer.domElement), { enableDamping: true, dampingFactor: 0.08, enablePan: false,
      minDistance: 2, maxDistance: 7, minPolarAngle: 0.2, maxPolarAngle: Math.PI / 2 - 0.05 });
    const pod = buildPod(THREE), zones = {}, addons = {}, glass = []; scene.add(pod);
    pod.traverse((m) => { if (!m.isMesh) return;                         // kontrak nama mesh → UI
      const z = Object.keys(palette).find((k) => m.name.startsWith(k)); if (z) (zones[z] ??= []).push(m);
      if (/^Addon\d/.test(m.name)) (addons[m.name.split('_')[0]] ??= []).push(m);
      if (m.name.startsWith('Glass')) glass.push(m.material); });
    onUi({ zones: Object.keys(zones), addons: Object.keys(addons) });    // lalu UI memanggil apply({ ... })
    const box = new THREE.Box3().setFromObject(pod), c = box.getCenter(new THREE.Vector3()), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const dist = (box.getSize(V()).length() / 2 / Math.sin((camera.fov * Math.PI) / 360)) * (small ? 1.4 : 1.1); let dirty = true, fade = null, fly = null;
    const go = (dir, ms) => { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: c.clone().addScaledVector(dir.normalize(), dist), t: 0, ms }; controls.enabled = false; };
    camera.position.copy(c).add(V(0, 0, dist)); go(V(0.6, 0.35, 1), reduced ? 0 : 900);   // panggil go() juga dari tombol view preset
    apply = (next) => { Object.assign(state, next);
      for (const [z, ms] of Object.entries(zones)) if (state.colors[z]) ms.forEach((m) => m.material.color.set(state.colors[z]));
      for (const [k, ms] of Object.entries(addons)) ms.forEach((m) => (m.visible = k === state.addon));
      fade = { from: glass[0]?.opacity ?? 0, to: state.glass ? 0.88 : 0, t: reduced ? 1 : 0 }; dirty = true; };
    return {
      update(dt) {
        if (fly) { fly.t = Math.min(1, fly.t + (dt * 1000) / Math.max(fly.ms, 1)); const e = ease.outCubic(fly.t);
          camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, c, e); dirty = true;
          if (fly.t === 1) { fly = null; controls.enabled = true; } }
        if (fade) { fade.t = Math.min(1, fade.t + dt / 0.6); const k = smoothstep(fade.t);
          glass.forEach((g) => { g.transparent = true; g.opacity = fade.from + (fade.to - fade.from) * k; g.depthWrite = g.opacity > 0.95; });
          dirty = true; if (fade.t === 1) fade = null; }
        if (controls.update()) dirty = true; if (!dirty) return false; dirty = false;   // render on demand
      },
      destroy: () => controls.dispose(),
    };
  }, { staticOnReduce: false });
  return { apply: (s) => apply(s), destroy: () => sec?.destroy() };
}
```

**Performa, mobile & reduced-motion:** budget: GLB ≤ 1.5 MB per varian (R17: 0.46–1.75 MB, terburuk 20.4 MB), Draco/meshopt + KTX2; env `RoomEnvironment` 0 byte; cache hasil build/load per key. Shadow: contact shadow (plane + blur) lebih murah dan stabil daripada shadow map. AO: bake ke tekstur, atau `GTAOPass` hanya di desktop. Mobile: kamera mundur (fit ×1.4), panel jadi bottom sheet, swatch tetap ≥ 44 px. Reduced-motion: fly-to instan, fade kaca instan, damping orbit tetap (dikendalikan user). Aksesibilitas: swatch = radio yang **bisa difokus** (jangan `display:none` pada input), canvas diberi `aria-label` yang menyebut konfigurasi aktif. Tanpa WebGL: gambar render per varian + panel tetap berfungsi.

**Jebakan:**
- R17: `SAOPass` dibuat lengkap dengan parameternya, tapi `composer.addPass(saoPass)` di-comment. AO tidak pernah aktif, bobot sia-sia.
- R17: `composer.render()` tiap frame walau scene diam, dan **tanpa `setPixelRatio`** (render di DPR 1, blur di retina).
- R17: latensi berantai (3 AJAX dulu, baru GLB diminta; semua tekstur swatch di-load di awal), kamera loncat saat swap, dan DOM dipakai sebagai state (summary membaca `:checked`).
