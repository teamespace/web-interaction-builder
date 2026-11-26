---
name: web-interaction-builder
description: Bikin animasi dan interaksi web kelas Awwwards dari sebuah referensi, dalam dua mode, 1 section interaktif atau full website. Pakai skill ini setiap kali user kasih link, screenshot, atau screen recording website lalu minta "bikinin interaksi/animasi kayak gini", minta hero atau section dengan efek scroll, cursor, drag, 3D, WebGL, physics, page transition, kinetic typography, partikel, atau bilang "bedah web ini terus bikinin versi kita", walaupun tidak menyebut kata skill. Also use when asked to recreate a website interaction, build a scroll animation like a reference site, make a GSAP / Three.js / Lenis section, or design Awwwards-style landing page motion.
---

# Web Interaction Builder

Skill ini mengubah sebuah referensi (link, rekaman layar, atau deskripsi) jadi kode interaksi yang jalan: **mode A** satu section, atau **mode B** full website. Isinya hasil bedah 17 website (R01–R17) oleh tim di Web Interaction Lab; daftar lengkapnya ada di `references/library.md`.

## Pelajaran inti dari riset (baca dulu, ini yang paling sering bikin hasil jelek)

1. **Yang kelihatan berat sering bukan berat.** Anjing yang menoleh di R04 itu video yang di-scrub cursor, gigi R05 itu SVG, "ASCII" R09 itu pixel dither di Canvas 2D, scene kopi R02 dibuat tanpa satu pun file model, background 3D R10 dibuat di Spline. Selalu pilih teknik **paling ringan yang hasil visualnya setara**:
   CSS/SVG → Canvas 2D → video/image sequence → Three.js dengan geometri prosedural → model GLB.
   Naik satu anak tangga hanya kalau anak tangga di bawahnya jelas tidak bisa.
2. **Satu mesin untuk hampir semua animasi:** sumber progress (scroll, pointer, waktu) → dipotong jadi jendela per gerakan (`range(p, a, b)`) → di-easing → ditulis ke properti. Tabel range ini yang bikin koreografi gampang di-tweak tim.
3. **Gerak berbasis waktu, bukan per frame.** `damp(x, target, lambda, dt)`, bukan `x += (target - x) * 0.1`. Versi per frame jalan dua kali lebih cepat di layar 120 Hz (bug nyata di R06).
4. **Spring tulis tangan + kecepatan lempar dari 100 ms terakhir** bikin drag dan hover terasa "fisik" tanpa library.
5. **Semua section ikut kontrak lifecycle** (setup → jalan hanya saat terlihat → destroy). Loop yang tetap jalan di luar layar adalah masalah performa paling umum di referensi.
6. **Reduced-motion dan mobile hampir selalu dilupakan.** Hanya R08, R11, dan R13 yang menanganinya dengan benar. Di skill ini dua-duanya wajib (lihat Quality gate).
7. **Aset berat membunuh pengalaman.** Referensi memuat 14–27 MB model/frame. Pakai budget di `references/quality-gate.md`.

## Alur kerja

### 1. Intake
Pastikan lima hal ini jelas sebelum menulis kode. Tanya hanya yang benar-benar tidak bisa disimpulkan.
- **Mode:** A (1 section) atau B (full website). Kalau user bilang "section", "hero", "bagian", itu A.
- **Referensi:** URL, file rekaman, atau deskripsi efek, plus **bagian yang disukai**. Kalau bagian tidak disebut, pilih 1–3 interaksi paling kuat dan sebutkan pilihanmu.
- **Konten & brand:** teks, gambar, warna, font. Kalau belum ada, pakai placeholder netral dan tandai jelas di README supaya tim mudah mengganti.
- **Target kode:** default HTML + CSS + ES module statis (paling mudah di-preview dan dipindah). Pakai React/Next/Astro hanya kalau project user sudah memakainya.
- **Lokasi output:** default `web-interaction-lab/demos/<slug>/` kalau folder itu ada, selain itu folder baru di working directory.

### 2. Bedah referensi
Cek `references/library.md` dulu: referensinya mungkin sudah pernah dibedah, tinggal pakai catatannya.
Kalau belum, ikuti `references/bedah-referensi.md`: download HTML dan bundle, grep library, cari kode app-nya sendiri, catat angka (durasi, easing, range, stiffness), dan cocokkan dengan apa yang terlihat. Tujuan bedah adalah **memahami teknik dan angkanya**, bukan menyalin kode. Kode situs orang lain tidak boleh di-copy mentah; tulis ulang dengan kata dan struktur sendiri.

### 3. Pilih pola dan teknik
Buka `references/patterns/index.md`, pilih pola yang paling dekat, lalu baca hanya file keluarga pola itu:
- `scroll.md`: scrub, pin, sticky stack, chapter engine, velocity
- `pointer-gesture.md`: cursor, drag, lempar, physics, video scrub
- `webgl-3d.md`: Three.js, shader, point cloud, konfigurator
- `typography.md`: variable font, split reveal, kinetic type
- `transitions.md`: page transition, morph, wipe, theme switch
- `generative.md`: dither, pixel, garis gambar tangan

Tulis singkat ke user (2–4 baris) pola yang dipilih, tingkat teknik, dan alasannya, sebelum build. Kalau efek referensi bisa dicapai lebih ringan, katakan.

### 4. Build
- Mulai dari `assets/starter/` (salin ke folder output): `index.html`, `style.css`, `motion-core.js`, `main.js`. `motion-core.js` berisi helper bersama; jangan menulis ulang helper yang sudah ada.
- Satu section = satu fungsi `defineSection(el, setup)`. Parameter penting (durasi, range, stiffness, warna) dikumpulkan di satu objek `CONFIG` di atas file, diberi komentar, supaya tim bisa fine-tune tanpa membaca seluruh kode.
- Library hanya kalau perlu, dari CDN dengan versi pasti: GSAP 3.12.5 (cdnjs), Lenis 1.1.13 (jsDelivr), Three.js 0.160.0 lewat import map (jsDelivr), Matter.js 0.20.0 (jsDelivr). Mode A sering cukup tanpa library sama sekali.
- Mode B: baca `references/mode-full-website.md` dulu (urutan section, satu clock, transisi antar section/halaman, budget total).
- Konten tetap HTML asli (heading, paragraf, alt text). Canvas/WebGL hanya lapisan visual.

### 5. Quality gate (wajib sebelum diserahkan)
Jalankan checklist di `references/quality-gate.md`. Ringkasnya:
- reduced-motion punya state statis yang rapi, dan Lenis tidak dinyalakan
- touch/mobile punya jalur sendiri (hover diganti tap/drag, efek berat diturunkan)
- loop berhenti di luar layar, DPR dibatasi, WebGL di-dispose
- semua gerak berbasis waktu (dt), bukan per frame
- keyboard bisa menjangkau elemen interaktif, fokus terlihat
- budget aset terpenuhi, tidak ada error di console

### 6. Verifikasi di browser
Buka hasilnya (preview/dev server atau file lokal lewat server statis sederhana), ambil screenshot desktop dan mobile (375px), cek console, dan coba interaksinya (scroll, hover, drag). Kalau bisa, emulasi reduced-motion. Perbaiki sebelum melapor. Kalau tidak bisa diverifikasi visual, katakan terus terang.

### 7. Serahkan dan catat
Laporkan ke user dalam beberapa baris: apa yang dibuat, pola + teknik yang dipakai, file utama, parameter yang paling enak di-tweak, dan apa yang belum diverifikasi.
Kalau sesi ini punya akses ke doc tim "Web Interaction Lab — References & Log", tambahkan satu baris di tab Log kerja (tanggal, siapa, apa yang dibuat, lokasi file).

## Format output

```
<output>/<slug>/
├── index.html      # markup semantik + import map kalau perlu
├── style.css       # token warna/font di :root, layout, state reduced-motion
├── motion-core.js  # salinan dari assets/starter (jangan diubah tanpa alasan)
├── main.js         # CONFIG + defineSection per section
└── README.md       # pola, sumber referensi (Rxx/URL), parameter CONFIG, cara ganti konten, yang belum diverifikasi
```

Mode B boleh memecah `main.js` jadi `sections/<nama>.js`, satu file per section.

## Peta file skill

| File | Kapan dibaca |
| --- | --- |
| `references/library.md` | Selalu, untuk cek referensi yang sudah dibedah dan pola utamanya |
| `references/bedah-referensi.md` | Ada URL referensi baru yang belum ada di library |
| `references/patterns/index.md` | Memilih pola |
| `references/patterns/<keluarga>.md` | Setelah tahu keluarga polanya; baca yang relevan saja |
| `references/mode-full-website.md` | Mode B |
| `references/quality-gate.md` | Sebelum menyerahkan hasil |
| `assets/starter/*` | Titik awal setiap build |
