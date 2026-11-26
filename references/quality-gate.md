# Quality gate

Checklist wajib sebelum hasil diserahkan. Setiap poin di sini muncul karena ada referensi yang gagal di poin itu.

## 1. Reduced-motion
- [ ] `prefers-reduced-motion: reduce` menghasilkan state statis yang rapi dan tetap bermakna (konten terlihat, layout tidak rusak), bukan halaman kosong atau animasi setengah jalan.
- [ ] Lenis tidak dinyalakan (`setupSmoothScroll` sudah menangani).
- [ ] Section pinned panjang dipendekkan (CSS starter sudah menangani `.section--pinned`).
- [ ] WebGL berat diganti poster/gambar statis.
> Referensi yang benar: R08 (21 cek di JS, 11 di CSS), R11, R13. Kebanyakan lainnya hanya sebagian.

## 2. Touch & mobile
- [ ] Efek hover-only punya pengganti di touch (tap, drag, atau versi otomatis), atau dimatikan dengan rapi. Cek pakai `finePointer()`.
- [ ] Target sentuh minimal 44px (R05 gagal: gigi seri cuma 20–27px di 375px).
- [ ] Jumlah partikel, resolusi shadow, dan ukuran aset diturunkan di layar kecil.
- [ ] Tidak ada horizontal scroll yang tidak disengaja di 375px.
- [ ] Jangan suruh mobile download aset desktop yang tidak dipakai (R04 tetap download 15.8 MB di mobile).

## 3. Performa
- [ ] Loop hanya jalan saat section terlihat (`defineSection` + IntersectionObserver). R04 dan R17 tidak pernah berhenti.
- [ ] `devicePixelRatio` dibatasi (Canvas/WebGL: maks 1.5–2).
- [ ] Semua smoothing pakai `dt` (`damp`, `spring.step(dt)`), bukan faktor per frame.
- [ ] WebGL: geometry/material/texture/renderer di-dispose di `destroy()`; shader di-compile sebelum dipakai kalau scene besar (R11, R02).
- [ ] Hindari layout thrash: baca `getBoundingClientRect` sekali per frame per section, tulis lewat `transform`/`opacity`/CSS variable.

### Budget aset (per halaman, setelah kompresi)
| Jenis | Mode A | Mode B total |
| --- | --- | --- |
| JS (tanpa three) | ≤ 60 KB | ≤ 150 KB |
| three.js + addons | ≤ 180 KB gz | ≤ 180 KB gz |
| Model GLB (Draco/Meshopt) | ≤ 2 MB | ≤ 5 MB |
| Video scrub (all-intra) | ≤ 6 MB desktop, versi mobile lebih kecil | ≤ 12 MB |
| Image sequence | ≤ 8 MB, stream bertahap | ≤ 15 MB |

## 4. Aksesibilitas
- [ ] Konten penting tetap HTML (heading, paragraf, link), bukan hanya di canvas.
- [ ] Teks yang di-split per huruf/kata tetap terbaca screen reader (`aria-label` di parent, span anak `aria-hidden="true"`).
- [ ] Elemen interaktif bisa dijangkau keyboard, fokus terlihat (R05 dan R11 contoh yang baik).
- [ ] Scroll tidak dibajak tanpa jalan keluar: kalau memakai chapter engine tanpa native scroll (R11), keyboard dan touch tetap bisa maju-mundur.

## 5. Kebersihan
- [ ] Tidak ada error/warning di console.
- [ ] Semua angka penting ada di `CONFIG` dengan komentar.
- [ ] README menyebut sumber referensi (Rxx/URL), pola, parameter, dan apa yang belum diverifikasi.
- [ ] Tidak ada kode yang disalin mentah dari situs referensi.

## 6. Verifikasi
- [ ] Dibuka di browser, screenshot desktop (≥1280px) dan mobile (375px).
- [ ] Interaksi utama dicoba (scroll/hover/drag/klik) dan hasilnya sesuai brief.
- [ ] Kalau sesuatu tidak bisa dicek (mis. rasa di 120 Hz, iOS), tulis di laporan.
