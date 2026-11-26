# web-interaction-builder

Skill Claude Code untuk membuat animasi dan interaksi web kelas Awwwards dari sebuah referensi (link, rekaman layar, atau deskripsi), dalam dua mode:

- **Mode A: 1 section** interaktif (hero, galeri, penutup, dll)
- **Mode B: full website** dengan ritme, transisi, dan bahasa gerak yang konsisten

Skill ini disusun dari bedah 17 website (R01–R17) di Web Interaction Lab: 12 referensi dari tim dan 5 pemenang Awwwards Site of the Day + Developer Award yang dipilih untuk mengisi celah teknik (page transition, physics, partikel, variable font, konfigurator 3D).

> **Status: v0.1, belum dites.** Tiga skenario tes sudah disiapkan di `evals/`.

## Isi

```
web-interaction-builder/
├── SKILL.md                     # pelajaran inti dari riset + alur kerja 7 langkah
├── assets/starter/              # titik awal setiap build
│   ├── index.html
│   ├── style.css                # token, section pinned, state reduced-motion
│   ├── motion-core.js           # damp, range, spring, velocity tracker, ticker, defineSection, ...
│   └── main.js                  # contoh section + blok CONFIG
├── references/
│   ├── library.md               # R01–R17: pola utama dan teknik sebenarnya
│   ├── bedah-referensi.md       # cara membedah referensi baru
│   ├── mode-full-website.md     # ritme, struktur kode, transisi, budget mode B
│   ├── quality-gate.md          # checklist wajib + budget aset
│   └── patterns/                # katalog pola per keluarga + index.md
├── scripts/build_index.py       # bangun ulang patterns/index.md
└── evals/                       # skenario tes
```

## Pasang

Salin folder ini ke salah satu lokasi skill Claude Code:

```bash
# global, bisa dipakai di semua project
git clone https://github.com/teamespace/web-interaction-builder ~/.claude/skills/web-interaction-builder

# atau khusus satu project
git clone https://github.com/teamespace/web-interaction-builder .claude/skills/web-interaction-builder
```

Lalu minta Claude misalnya: *"bikinin 1 section kayak hero di <url>, bagian yang aku suka X"* atau *"bikin full website one page buat … dengan interaksi kayak <url>"*.

## Prinsip utama

1. Pilih teknik **paling ringan** yang hasil visualnya setara: CSS/SVG → Canvas 2D → video → Three.js prosedural → model GLB. Banyak efek "3D" di referensi ternyata video, SVG, atau Canvas 2D.
2. Satu mesin: progress (scroll / pointer / waktu) → jendela `range()` → easing → properti.
3. Gerak berbasis waktu (`damp` dengan `dt`), spring tulis tangan, kecepatan lempar dari 100 ms terakhir.
4. Setiap section ikut kontrak lifecycle dan berhenti di luar layar.
5. Reduced-motion, touch/mobile, aksesibilitas, dan budget aset wajib lolos `quality-gate.md`.

## Fine-tune

- Angka rasa gerak ada di blok `CONFIG` hasil build dan di tabel **Parameter** tiap pola.
- Pola baru: tambahkan ke file keluarga di `references/patterns/` dengan format heading yang sama, lalu `python3 scripts/build_index.py`.
- Referensi baru: bedah dengan `references/bedah-referensi.md`, tambah baris di `references/library.md`.

## Catatan

Referensi dibedah untuk mempelajari teknik dan angka. Tidak ada kode situs referensi yang disalin; semua snippet ditulis ulang. Nama dan karya situs referensi milik pemiliknya masing-masing.

## Lisensi

[MIT](LICENSE)
