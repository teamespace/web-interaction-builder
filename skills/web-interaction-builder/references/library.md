# Library referensi (R01–R17)

Semua referensi yang sudah dibedah di Web Interaction Lab. Catatan lengkap per referensi ada di `web-interaction-lab/research/` (nama file di kolom terakhir). Kalau user memberi URL yang ada di sini, pakai catatannya, tidak perlu bedah ulang.

Sumber: R01–R12 dari tim, R13–R17 dipilih dari Awwwards (Site of the Day + Developer Award) untuk mengisi celah teknik.

| ID | Situs | Yang disukai | Pola utama | Teknik sebenarnya | Cakupan | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | [Bowld](https://dribbble-shot.elx.onl/bowld-hero/) | Objek 3D berganti | `blur-masked-model-swap` | GSAP + model-viewer, spin 720° + blur, swap di puncak | 1 section | `R01-bowld.md` |
| R02 | [Bloom Burr](https://dribbble-shot.elx.onl/bloom-burr/) | Proses bikin kopi | `scroll-3d-product-story` (chapter) | Three.js prosedural tanpa model, Lenis + progress manual | Banyak | `R02-bloom-burr.md` |
| R03 | [The Varnish](https://dribbble-shot.elx.onl/the-varnish/) | Scroll pembuka, reveal lukisan, buku | sticky rooms + range table, tirai clip-path, buku SkinnedMesh | React + Lenis + shader mentah, R3F lazy | Banyak (9 room) | `R03-the-varnish.md` |
| R04 | [Breeder](https://dribbble-shot.elx.onl/breeder-landing/) | Anjing menoleh ikut cursor | `cursor-scrub-video` | Video all-intra 24 fps di-scrub `currentTime` | Banyak | `R04-breeder.md` |
| R05 | [Dental Enamel](https://per-celebrate-continue-housewares.trycloudflare.com/es-saas-dental-enamel/) | Gigi bisa diklik | SVG picker + lifted clone + panel | SVG prosedural, CSS spring, keyboard | Banyak | `R05-dental-enamel.md` |
| R06 | [Interaction Library](https://library.jjangik.kr/) | (dipilih Claude) 11 sample + rak 3D | kontrak lifecycle, drag grid, cursor wake, velocity reel, lempar, semantic zoom, dll | Canvas 2D dominan, Three.js untuk rak | 1 section/sample | `R06a-shelf-dan-sample-1-5.md`, `R06b-sample-6-11.md` |
| R07 | [Agrumea Farm](https://www.agrumeafarm.it/en) | "Library buku" = rak toples hero | `wheel-drag-shelf` | rAF + spring per toples, label via 1 WebGL context bersama | 1 section | `R07-agrumea-farm.md` |
| R08 | [Josh Kern](https://webdesign.kernjosh.com/) | (dipilih Claude) | `velocity-bend-media`, layout morph, easter egg | GSAP Observer/Flip, Three lazy; reduced-motion terbaik | Banyak | `R08-josh-kern.md` |
| R09 | [Andreas Vision](https://andreas.vision/) | Animasi "ASCII" | `pixel-sky-dither` | Canvas 2D grid 22px 5 tone, Bayer dither | Banyak | `R09-andreas-vision.md` |
| R10 | [Fragment](https://www.fragment.im/) | Scroll animation | `scroll-choreographed-backdrop`, sticky stacking cards | Spline + Framer | Banyak | `R10-fragment.md` |
| R11 | [Kinoria Studio](https://kinoria.studio/) | Animasi scroll | `chapter-scroll-engine` | Tanpa native scroll, three.js + HTML, reduced-motion baik | Banyak | `R11-kinoria-studio.md` |
| R12 | [Palmo](https://www.palmo.co.in/) | 3D saat scroll | `scroll-3d-product-story` + burst | R3F + GSAP ScrollTrigger scrub, burst berbasis waktu | Banyak | `R12-palmo.md` |
| R13 | [Carter Ogunsola](https://carterogunsola.com) | Page transition, lanyard | `route-veil-transition`, `mpa-view-transition`, `verlet-rope` | Astro ClientRouter + GSAP veil, Verlet 3D | Banyak (multi-halaman) | `R13-carter-ogunsola.md` |
| R14 | [FORMAT (Obys)](https://format.obys.agency) | Chip jatuh berfisika | `physics-drop-field` | Matter.js di gsap.ticker, DOM ikut body | 1 section | `R14-format-obys.md` |
| R15 | [LiDAR Drone](https://drone.riotters.com) | Point cloud | `morphing-point-cloud`, `scroll-segment-sequencer` | 102k titik dari mesh, simulasi GPU | Banyak | `R15-lidar-drone.md` |
| R16 | [Exat Typeface](https://exat.hottype.co) | Tipografi variable font | `variable-font-style-morph`, `proximity-weight-field` | GSAP tween ke CSS var axis | Banyak | `R16-exat-typeface.md` |
| R17 | [Quiet Cubes](https://configurator.quietcubes.com) | Konfigurator 3D | `product-configurator-3d` | Three r132, UI dari konvensi nama mesh | 1 section | `R17-quiet-cubes.md` |

Catatan: link R05 memakai tunnel sementara dan bisa mati.

## Menambah referensi baru

1. Bedah dengan `bedah-referensi.md`, simpan catatan sebagai `research/R18-<nama>.md`.
2. Tambah satu baris di tabel ini.
3. Kalau polanya baru, tambahkan ke file keluarga yang cocok di `patterns/` dan ke `patterns/index.md`.
4. Catat di doc tim (tab Referensi + Log kerja).
