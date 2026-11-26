# Index pola

Total 72 pola dari 17 referensi (R01–R17).

Dibuat otomatis oleh `scripts/build_index.py`. Jangan edit manual; edit file keluarganya lalu jalankan ulang script.

Cara pakai: cari pola yang paling dekat dengan efek referensi, lalu buka hanya file keluarganya. Mode A = 1 section, B = full website. Kolom Berat membantu memilih teknik paling ringan.

## Scroll (`scroll.md`)

scrub, pin, sticky, chapter, velocity. 16 pola.

| Pola | Judul | Mode | Berat | Sumber |
| --- | --- | --- | --- | --- |
| `pinned-range-timeline` | Section sticky dengan tabel range | A+B | CSS | R02, R03, R12, R17 |
| `scroll-image-sequence` | Sekuens frame yang di-scrub | A+B | Canvas2D/SVG | R02, R17 |
| `scroll-video-scrub` | Video yang di-scrub scroll | A+B | Video | R03, R04 |
| `scroll-3d-story` | Cerita 3D yang dikoreografi scroll | A+B | 3D model (WebGL kalau geometri prosedural) | R02, R10, R12, R15 |
| `scroll-segment-sequencer` | Scroll memilih segmen, waktu yang menganimasikan | A+B | CSS (logikanya), visualnya bebas | R11, R12, R15 |
| `hero-recede-expand` | Hero mundur saat ditutup, cover melebar saat dibuka | A+B | CSS | R02, R07, R10 |
| `clip-curtain-reveal` | Reveal dengan tirai, blinds, atau portal | A | CSS (portal dengan rim noise: WebGL opsional) | R03, R17 |
| `scroll-text-reveal` | Kata menyala, baris terisi, baris blur-in | A+B | CSS | R03, R04, R11 |
| `pinned-horizontal-strip` | Scroll vertikal, gerak horizontal | A+B | CSS | R02, R03 |
| `sticky-card-stack` | Kartu sticky bertumpuk | A+B | CSS | R04, R07, R10 |
| `sticky-step-story` | Visual sticky + daftar step (scrollytelling) | A | CSS | R05, R15 |
| `scroll-paced-cards` | Kartu melintas dengan pacing dan busur | A | CSS | R04, R12 |
| `velocity-marquee` | Marquee yang ngebut saat discroll | A+B | CSS | R04, R14 |
| `speed-shaped-gallery` | Galeri yang dibentuk kecepatan dan kedalaman | A | CSS (tunnel) / WebGL (bend, reel) | R06, R07 |
| `chapter-scroll-engine` | Scroll virtual antar chapter | B (mode A hanya kalau section full-screen dan boleh mengunci) | CSS (engine), visual biasanya WebGL | R11 |
| `hero-collapse-to-slot` | Hero larut lalu terbang masuk ke judul | A (B sebagai motif yang diulang) | Canvas2D/SVG | R09, R14 |

## Pointer, gesture & physics (`pointer-gesture.md`)

cursor, drag, lempar, physics, video scrub. 18 pola.

| Pola | Judul | Mode | Berat | Sumber |
| --- | --- | --- | --- | --- |
| `cursor-parallax-depth` | Parallax berlapis & objek "menoleh" ke kursor | A+B | CSS (3D model kalau objek utamanya GLB) | R01, R06, R07 |
| `proximity-spring` | Elemen menghindar atau tertarik ke kursor | A+B | CSS | R01, R06, R07, R13, R14 |
| `cursor-facing-rotators` | Mata, panah & glyph yang menghadap kursor | A+B | CSS | R08, R16 |
| `proximity-weight-field` | Grid huruf yang menebal di dekat kursor | A (B sebagai section glyphset) | CSS | R16 |
| `custom-cursor` | Dot + bracket, label tag, dan lens reveal | A+B | CSS (lens versi R09: Canvas2D) | R06, R07, R09, R11 |
| `index-lens` | Daftar fisheye + poster mengikuti kursor | A (B sebagai halaman index) | CSS (R06a aslinya WebGL + teks di canvas) | R06, R11 |
| `cursor-scrub-video` | Video yang di-scrub kursor | A | Video | R04 |
| `cursor-wake-dwell` | Riak di belakang kursor + diam untuk membuka | A | CSS (R06a: WebGL untuk RGB split) | R06 |
| `infinite-drag-canvas` | Dinding kartu tanpa ujung | A+B | CSS | R06 |
| `wheel-drag-shelf` | Rak objek tanpa ujung (wheel + drag + spring) | A+B | CSS (R07 label 3D: WebGL opsional) | R06, R07, R11 |
| `drag-rotate` | Putar objek dengan drag lurus atau gerakan melingkar | A | CSS / Canvas2D (3D model kalau objeknya GLB) | R01, R06, R09, R11 |
| `throwable-cards` | Kartu yang bisa diangkat dan dilempar | A (B sebagai landing "meja kerja") | CSS (R06b: Canvas2D) | R06, R13 |
| `draw-to-reveal-trail` | Menggambar jalur yang memunculkan foto | A (B sebagai landing instalasi) | Canvas2D/SVG | R06 |
| `plucked-string-type` | Tipografi kawat yang bisa dipetik | A (B sebagai intro type foundry) | Canvas2D/SVG | R06 |
| `semantic-zoom` | Mosaik yang di-zoom sampai jadi foto | A+B | Canvas2D | R06 |
| `physics-drop-field` | Klik menjatuhkan benda yang menumpuk | A+B | CSS + Matter.js (DOM digerakkan body fisika) | R07, R14 |
| `verlet-rope` | Kartu tergantung di tali | A | Canvas2D/SVG (R13: 3D dengan Three.js) | R06, R13 |
| `tactile-feedback-kit` | Squash-stretch, click burst, platformer | A+B | CSS | R08 |

## WebGL & 3D (`webgl-3d.md`)

Three.js, shader, point cloud, konfigurator. 14 pola.

| Pola | Judul | Mode | Berat | Sumber |
| --- | --- | --- | --- | --- |
| `blur-masked-model-swap` | Ganti model di puncak blur | A | sedang (GLB) / ringan (primitive) | R01, R17 |
| `procedural-product-scene` | Scene produk tanpa file model | A+B | sedang | R02, R17 |
| `liquid-fx` | Aliran, isi gelas, riak air | A | sedang (stream + clip) / berat (ripple sim) | R02, R12 |
| `scroll-3d-product-story` | Cerita produk 3D di-scrub scroll + burst | A+B | berat | R02, R12 |
| `scroll-choreographed-backdrop` | Backdrop 3D fixed yang berpose ikut scroll | B (A kalau dibatasi ke satu section pinned) | sedang | R10 |
| `pinned-object-drop` | Objek jatuh ke tengah + transisi cahaya | A+B | sedang (primitive) / berat (GLB + bloom) | R11 |
| `torn-edge-portal` | Portal bertepi sobek antar section | A+B | ringan–sedang | R03 |
| `skinned-page-flip-book` | Buku yang halamannya membalik oleh scroll | A | berat | R03 |
| `css3d-sphere-gallery` | Bola galeri CSS 3D (tanpa WebGL) | A | ringan | R03, R05 |
| `shelf-room-gallery` | Galeri sebagai rak di ruangan 3D | B (A versi kecil: rak saja, tanpa ruangan) | berat | R06 |
| `velocity-bend-media` | Kartu media yang melengkung/molor oleh kecepatan | A | sedang | R06, R08 |
| `cylinder-label-spin` | Label berputar di silinder, satu context untuk banyak canvas | A+B | sedang | R07 |
| `morphing-point-cloud` | Point cloud yang di-scan lalu morph | A+B | berat (FBO 100k) / sedang (atribut 20–40k) | R02, R15 |
| `product-configurator-3d` | Configurator dengan kontrak nama mesh | A+B | sedang | R01, R17 |

## Typography (`typography.md`)

variable font, split reveal, kinetic type. 12 pola.

| Pola | Judul | Mode | Berat | Sumber |
| --- | --- | --- | --- | --- |
| `masked-split-reveal` | Reveal dari balik mask | A+B | CSS | R04, R07, R12, R13, R16 |
| `char-scrub-reveal` | Huruf di-scrub scroll | A+B | CSS | R11, R16 |
| `blur-line-reveal` | Kolom teks fokus-blur | A+B | CSS | R11 |
| `word-light-up` | Kata menyala ikut scroll | A+B | CSS | R03, R04 |
| `word-counter-swap` | Counter berupa kata | A | CSS | R11 |
| `slot-word-scrub` | Kata slot machine | A | CSS | R12 |
| `variable-font-style-morph` | Morph `wght` + `wdth` | A+B | CSS | R16 |
| `proximity-weight-field` | Medan ketebalan dari kursor | A+B | CSS | R16 |
| `type-tester` | Area coba font | A+B | CSS | R16 |
| `fit-text-wordmark` | Wordmark selebar container | A+B | CSS | R01, R03, R04, R16 |
| `sine-arc-badges` | Badge melayang di busur sinus | A+B | CSS | R12 |
| `copy-swap` | Copy keluar, ganti, masuk | A+B | CSS | R01 |

## Transitions (`transitions.md`)

page transition, morph, wipe, theme switch. 12 pola.

| Pola | Judul | Mode | Berat | Sumber |
| --- | --- | --- | --- | --- |
| `route-veil-transition` | Tirai antar halaman | B | CSS (opsional WebGL untuk tepi kertas) | R11, R13 |
| `mpa-view-transition` | View Transitions tanpa router | B | CSS | R13 |
| `flip-morph` | Objek ke modal & layout toggle | A+B | CSS | R07, R08 |
| `layout-morph-carousel` | Susunan objek berganti | A+B | CSS | R08 |
| `svg-picker-lift` | Pilih item SVG, salinan terangkat | A | Canvas2D/SVG | R05 |
| `page-zoom-intro` | Halaman mini zoom jadi penuh | B | CSS | R14 |
| `circle-wipe` | Lingkaran membesar menutup layar | A+B | CSS | R12, R14 |
| `clip-path-shape-morph` | Morph bentuk lewat polygon | A+B | CSS | R12, R14 |
| `print-curl-transition` | Section jadi lembar foto melengkung | A+B | WebGL | R11 |
| `theme-token-switch` | Ganti tema lewat token | A+B | CSS | R01, R12, R17 |
| `blinds-reveal` | Reveal tirai jendela | A+B | Canvas2D/SVG | R17 |
| `staggered-content-switcher` | Tab dengan wipe bertahap | A+B | CSS | R15 |

## Generative (`generative.md`)

_Belum ada._
