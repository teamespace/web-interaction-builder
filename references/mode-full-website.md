# Mode B: full website

Mode B merangkai beberapa section interaktif jadi satu situs yang terasa satu kesatuan. Yang membedakan situs kelas Awwwards dari kumpulan efek adalah **ritme** dan **konsistensi**, bukan jumlah efek.

## 1. Rencanakan dulu (tulis ke user sebelum build)

Buat tabel alur singkat:

| # | Section | Tujuan konten | Pola | Berat | Trigger |
| --- | --- | --- | --- | --- | --- |
| 1 | Hero | Kesan pertama | mis. `scroll-3d-product-story` | WebGL | scroll |
| 2 | … | … | … | … | … |

Aturan ritme yang terlihat di referensi terbaik (R02, R08, R11, R12):
- **Maksimal 1–2 "momen besar"** (WebGL/pinned panjang) per halaman. Sisanya reveal ringan.
- **Selang-seling berat dan ringan**: setelah section pinned panjang, beri section yang scroll biasa.
- **Satu bahasa gerak**: 1–2 kurva easing utama untuk seluruh situs (mis. `cubic-bezier(.22,1,.36,1)` untuk masuk, `expo.inOut` untuk transisi besar), durasi dalam keluarga yang sama (0.6 / 0.9 / 1.2s).
- **Objek yang terbawa** antar section (carafe R02, kaleng R12, kubus R09) bikin cerita terasa nyambung.
- Penutup punya momen kecil yang bisa dimainkan (physics field R14, Fruit Ninja R12, platformer R08).

## 2. Struktur kode

```
<slug>/
├── index.html
├── style.css
├── motion-core.js
├── main.js              # setup global: smooth scroll, ticker, register section
└── sections/
    ├── hero.js          # export function hero(el) { return defineSection(el, ...) }
    ├── story.js
    └── outro.js
```

- **Satu clock.** Kalau ada GSAP: `ticker.useGsap(gsap)` lalu `setupSmoothScroll({ Lenis, gsap, ScrollTrigger })`. Tanpa GSAP: `ticker` bawaan + `setupSmoothScroll({ Lenis })`.
- **Satu sumber progress per section.** `stickyProgress(el)` untuk section pinned, `passProgress(el)` untuk yang lewat biasa, atau ScrollTrigger kalau perlu pin + snap banyak section.
- **Event bus kecil** untuk sinkron antar layer (pola R12 "budget" dan R17 "scroll-progress-bus"): `window.dispatchEvent(new CustomEvent('section:progress', { detail: { id, p } }))`.
- **Lazy-load yang berat**: `import()` modul WebGL saat section hampir terlihat (rootMargin 50%), prefetch saat idle (R03).
- Satu WebGL renderer bersama kalau ada lebih dari satu scene, atau satu context yang di-`drawImage` ke banyak canvas (R07).

## 3. Transisi

| Kebutuhan | Pola | Ref |
| --- | --- | --- |
| Antar halaman, situs statis multi-page | `mpa-view-transition`: `@view-transition { navigation: auto; }` + `::view-transition-*` | R13 |
| Antar halaman dengan tirai/veil dramatis | `route-veil-transition` (fetch dan animasi tutup berjalan paralel) | R13 |
| Antar section dalam satu halaman | wipe/clip-path, light burst, objek yang terbawa | R11, R14, R12 |
| Ganti state/konten di section yang sama | `staggered-content-switcher`, Flip | R15, R08 |

Detail resep ada di `patterns/transitions.md`. Transisi wajib punya fallback: tanpa dukungan View Transitions atau saat reduced-motion, halaman tetap berpindah biasa (fade singkat atau langsung).

## 4. Intro / loader
- Loader hanya kalau memang ada aset yang perlu ditunggu. Progress harus jujur: naik saat aset benar-benar siap (R06 curtain).
- Maksimal ±2.5s sebelum konten bisa dibaca. Sediakan skip (klik/scroll).

## 5. Budget total
Pakai tabel budget mode B di `quality-gate.md`. Hitung total semua section, bukan per section.

## 6. Checklist tambahan mode B
- [ ] Navigasi tetap jelas dan bisa dipakai keyboard di semua section.
- [ ] Section bisa diakses lewat anchor/URL (tidak hanya lewat scroll berurutan).
- [ ] Tidak ada dua section yang membajak scroll berturut-turut.
- [ ] Mobile punya alur yang lebih pendek (section pinned dipendekkan, momen besar disederhanakan).
