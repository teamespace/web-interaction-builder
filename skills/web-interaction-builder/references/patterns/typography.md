# Typography — kinetic type, variable font & text reveal

Katalog pola untuk teks yang bergerak: reveal per baris/kata/huruf, teks yang "menyala" ikut scroll, kata yang berganti, sampai variable font yang berubah tebal-lebarnya karena hover atau jarak kursor. Semua pola di sini bisa jalan tanpa plugin berbayar: teks dipecah sendiri jadi `<span>` (helper di bagian Fondasi), motion pakai `motion-core.js`, dan font variable diambil dari Google Fonts. GSAP SplitText (gratis sejak GSAP 3.13) boleh dipakai sebagai pengganti helper split kalau halaman memang sudah memuat GSAP.

| id | ringkas |
|---|---|
| [`masked-split-reveal`](#masked-split-reveal--reveal-dari-balik-mask) | Baris/kata/huruf naik (atau turun) dari balik mask saat masuk viewport. Default reveal untuk semua heading. |
| [`char-scrub-reveal`](#char-scrub-reveal--huruf-di-scrub-scroll) | Huruf per huruf di-scrub oleh scroll, bisa juga untuk exit per huruf. |
| [`blur-line-reveal`](#blur-line-reveal--kolom-teks-fokus-blur) | Baris muncul dari blur 10px, lalu "keluar fokus" di 20% atas layar. |
| [`word-light-up`](#word-light-up--kata-menyala-ikut-scroll) | Kata redup menyala satu per satu sesuai progress scroll. |
| [`word-counter-swap`](#word-counter-swap--counter-berupa-kata) | Counter yang ditulis sebagai kata (ZERO → THIRTY-SIX) dengan focus-pull tiap ganti. |
| [`slot-word-scrub`](#slot-word-scrub--kata-slot-machine) | Satu slot kata dalam kalimat berganti seperti slot machine, di-scrub scroll. |
| [`variable-font-style-morph`](#variable-font-style-morph--morph-wght--wdth) | Hover/fokus label style → specimen morph halus ke `wght` + `wdth` style itu. |
| [`proximity-weight-field`](#proximity-weight-field--medan-ketebalan-dari-kursor) | Grid huruf yang menebal dan berubah warna mengikuti jarak kursor. |
| [`type-tester`](#type-tester--area-coba-font) | Textarea editable + slider axis, ukuran, leading, tracking. |
| [`fit-text-wordmark`](#fit-text-wordmark--wordmark-selebar-container) | Wordmark raksasa pas selebar container + huruf naik satu per satu. |
| [`sine-arc-badges`](#sine-arc-badges--badge-melayang-di-busur-sinus) | Badge/label naik melintasi section sambil berayun di busur sinus. |
| [`copy-swap`](#copy-swap--copy-keluar-ganti-masuk) | Headline + deskripsi keluar, teks diganti, lalu masuk lagi (sinkron dengan transisi lain). |

Pola terkait di file lain: `strung-type` (huruf single-stroke yang bisa "dipetik" kursor, R06b) ada di `pointer-gesture.md` karena intinya fisika senar dan gesture, bukan tipografi.

---

## Fondasi

**Import.** Semua snippet mengasumsikan `motion-core.js` (dari `assets/starter/`) dan `split.js` di bawah ada di folder yang sama dengan modul section.

**Font variable gratis (Google Fonts).** Axis harus ditulis urut abjad di URL.

| font | axis | URL `family=` |
|---|---|---|
| Roboto Flex | `wght` 100–1000, `wdth` 25–151, `opsz` 8–144 | `Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000` |
| Archivo | `wght` 100–900, `wdth` 62–125 | `Archivo:wdth,wght@62..125,100..900` |
| Anybody | `wght` 100–900, `wdth` 50–150 | `Anybody:wdth,wght@50..150,100..900` |

**Helper split tanpa plugin.** Teks asli disimpan di `.sr-only` (dibaca screen reader), versi visual yang dipecah diberi `aria-hidden`. Ini lebih aman daripada `aria-label` di `<p>`/`<span>`, karena `aria-label` di elemen generic sering diabaikan pembaca layar. `aria-label` tetap boleh di heading, link, dan button.

```js
// split.js
const seg = Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s) => (seg ? [...seg.segment(s)].map((x) => x.segment) : [...s]);
const mk = (cls, text = '') => Object.assign(document.createElement('span'), { className: cls, textContent: text });

export function splitText(el, { chars = false, lines = false } = {}) {
  if (el._split) return el._split;
  const original = el.innerHTML, text = el.textContent.replace(/\s+/g, ' ').trim();
  const visual = mk('split-visual');
  visual.setAttribute('aria-hidden', 'true');
  const words = [], allChars = [], lineEls = [];
  text.split(' ').forEach((w, i) => {
    const word = mk('sw', chars ? '' : w);
    if (chars) graphemes(w).forEach((g) => { const c = mk('sc', g); word.append(c); allChars.push(c); });
    if (i) visual.append(' ');
    visual.append(word); words.push(word);
  });
  el.replaceChildren(mk('sr-only', text), visual);
  if (lines) {                                   // kelompokkan kata per baris visual (butuh layout)
    const rows = [];
    for (const w of words) {
      const last = rows.at(-1);
      if (last && Math.abs(last.top - w.offsetTop) < 2) last.ws.push(w);
      else rows.push({ top: w.offsetTop, ws: [w] });
    }
    visual.replaceChildren(...rows.map(({ ws }) => {
      const mask = mk('sl'), inner = mk('sl-in');
      ws.forEach((w, j) => inner.append(...(j ? [' ', w] : [w])));
      mask.append(inner); lineEls.push(inner);
      return mask;
    }));
  }
  return (el._split = { words, chars: allChars, lines: lineEls,
    revert() { el.innerHTML = original; el._split = null; } });
}
```

```css
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.split-visual { display: block; }
.sw, .sc, .sl-in { display: inline-block; }
/* padding + margin negatif: descender (g, y, p) tidak terpotong mask (trik R16) */
.sl { display: block; overflow: hidden; padding-bottom: .14em; margin-bottom: -.14em; }
```

Aturan umum untuk semua pola di file ini:
- Split **setelah** `document.fonts.ready`. Pecah baris dihitung dari layout, dan layout baru final setelah font termuat.
- Split per baris harus diulang saat lebar container berubah (`revert()` lalu split lagi). Split per kata/huruf tidak perlu.
- Split hanya untuk teks polos. `<em>`, `<a>` di dalam heading akan hilang dari versi visual (versi asli tetap dipulihkan oleh `revert()`).

### `masked-split-reveal` — Reveal dari balik mask

**Sumber:** R04, R16, R07, R12, R13 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Reveal default untuk heading dan paragraf pendek saat masuk viewport. Di mode B ini jadi "sistem" global lewat data-attribute, bukan efek bintang.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `split` | `lines` | `lines` · `words` · `chars` | Unit yang bergerak. R04/R13 per baris, R16 kata di dalam mask baris, R12/R07 per huruf. |
| `from` | `110%` | 105–140% dari bawah, atau −250% + `skewY(-5deg)` dari atas | Jarak awal di dalam mask. Arah dari atas + skew adalah ciri R16. |
| `dur` | 0.9s | 0.55–1.2s | R04 0.9s, R16 1s, R07 baris 0.55s / huruf 0.95s, R12 huruf 0.85s / baris 0.8s, R13 1.2s. |
| `ease` | `cubic-bezier(.22,.61,.36,1)` | expo-out `(.16,1,.3,1)`, R07 "textveil" `(.165,1,.32,1)` | Rasa mendarat. Expo-out lebih "mahal", R04 lebih kalem. |
| `stagger` | 90ms | baris 80–100ms, kata 55–100ms, huruf 20–35ms | Jeda antar unit. |
| `start` | rootMargin bawah −10% | −8% s/d −12% | R04 −8%, R16 `top 90%`, R07 `top 91%`, R12 `top 88%`. Semua referensi jalan sekali (`once`). |

**Resep:**
1. Tandai elemen dengan `data-reveal-text="lines|words|chars"`. Opsional: `style="--from:-250%;--skew:-5deg"` untuk arah R16.
2. Tunggu `document.fonts.ready`, lalu split dengan `lines: true` (kata dan huruf juga dibungkus mask baris, supaya yang terpotong hanya per baris).
3. Beri tiap unit `--i` dan kelas `.u`. Posisi awal dan transisi diatur CSS; IntersectionObserver hanya menambah `.is-in` lalu `unobserve`.
4. Mode B: tunda `.is-in` sampai event `veil:reveal` (`transitions.md` → `route-veil-transition`), mulai di 50% durasi wipe seperti R13.

```html
<style>
  [data-reveal-text] .u {
    transform: translateY(var(--from, 110%)) skewY(var(--skew, 0deg));
    transition: transform var(--dur, .9s) var(--ease, cubic-bezier(.22,.61,.36,1)) calc(var(--i) * var(--stagger, 90ms));
  }
  [data-reveal-text].is-in .u { transform: none; }
  @media (prefers-reduced-motion: reduce) { [data-reveal-text] .u { transform: none; transition: none; } }
</style>
<script type="module">
  import { reducedMotion } from './motion-core.js';
  import { splitText } from './split.js';

  async function maskedReveal(root = document) {
    await document.fonts.ready;
    const els = [...root.querySelectorAll('[data-reveal-text]')];
    if (reducedMotion()) return els.forEach((el) => el.classList.add('is-in'));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add('is-in');
    }), { rootMargin: '0px 0px -10% 0px' });
    for (const el of els) {
      const by = el.dataset.revealText || 'lines';
      const s = splitText(el, { lines: true, chars: by === 'chars' });
      const units = by === 'lines' ? s.lines : by === 'chars' ? s.chars : s.words;
      units.forEach((u, i) => { u.classList.add('u'); u.style.setProperty('--i', i); });
      io.observe(el);
    }
  }
  maskedReveal();
</script>
```

**Reduced-motion & aksesibilitas:** Saat reduce, teks langsung tampil (CSS `transform:none` + kelas `.is-in` langsung). Teks asli ada di `.sr-only`, jadi screen reader membaca kalimat utuh, bukan huruf satu-satu. Copy/paste tetap mengambil teks visual, jadi jangan sisipkan karakter dekoratif ke dalam split.

**Jebakan:**
- Flash teks sebelum JS jalan: heading tampil penuh, lalu tiba-tiba hilang dan reveal. Kalau heading ada di first viewport, sembunyikan dulu lewat CSS (`html.js [data-reveal-text]{visibility:hidden}` lalu buka setelah split) atau biarkan heading hero tanpa reveal.
- Lupa padding di mask: descender huruf terpotong. R16 memakai `padding-bottom:.3em; margin-bottom:-.3em`, helper di atas memakai .14em (cukup untuk leading 1.0–1.2).
- Split per huruf mematikan kerning dan ligature (tiap huruf jadi `inline-block`). Untuk display font dengan kerning ketat, pakai split kata atau baris.
- R12 me-*revert* SplitText setelah animasi selesai supaya resize tidak merusak baris. Lakukan juga kalau container fluid: `transitionend` unit terakhir → `revert()`.

### `char-scrub-reveal` — Huruf di-scrub scroll

**Sumber:** R16, R11 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Judul section atau footer besar yang hurufnya "jatuh" ke posisi mengikuti scroll (bukan sekali jalan), atau sebaliknya keluar satu per satu saat section pergi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `from` | −105% | −105% (dari atas) / 105% (dari bawah) | Posisi awal huruf di dalam mask baris. Mobile R16: −25% + opacity 0. |
| `start` / `end` | top elemen di 100% viewport → tengah elemen di 50% | — | Rentang scrub R16 (`top 100%` → `50% 50%`). |
| `stagger` | 0.1 | 0.05–0.15 | Jeda relatif antar huruf (unit durasi per huruf = 1). Mobile R16 0.15. |
| `ease` | smoothstep | linear–smoothstep | R16 `power1.inOut`; smoothstep dari motion-core cukup dekat. |
| `mode` | `enter` | `enter` · `exit` | `exit` = varian R11: huruf naik keluar di jendela mask ±1.3em saat section meninggalkan atas layar. |

**Resep:**
1. Split `chars + lines`, mask `.sl` dari Fondasi.
2. Hitung progress `p` dari rect elemen tiap frame (hanya saat terlihat, via `defineSection`).
3. Total durasi = `1 + (n − 1) × stagger`. Huruf ke-`i` punya progress lokal `clamp(p × total − i × stagger)`.
4. Tulis transform hanya kalau `p` berubah.
5. Untuk `exit` (R11): pakai `p` dari posisi bawah elemen terhadap atas viewport, lalu `y = −k × 105%`.

```js
import { defineSection, clamp, smoothstep } from './motion-core.js';
import { splitText } from './split.js';

export async function charScrub(el, { from = -105, stagger = 0.1, mode = 'enter' } = {}) {
  await document.fonts.ready;
  const { chars } = splitText(el, { chars: true, lines: true });
  const total = 1 + (chars.length - 1) * stagger;
  let last = -1;
  const paint = (p) => {
    chars.forEach((c, i) => {
      const k = smoothstep(clamp(p * total - i * stagger));
      const y = mode === 'enter' ? (1 - k) * from : -k * Math.abs(from);
      c.style.transform = `translate3d(0, ${y.toFixed(2)}%, 0)`;
    });
  };
  return defineSection(el, () => ({
    renderStatic: () => paint(mode === 'enter' ? 1 : 0),
    update() {
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const p = mode === 'enter'
        ? clamp((vh - r.top) / (vh / 2 + r.height / 2))   // top 100% → tengah 50%
        : clamp((vh * 0.25 - r.bottom) / (vh * 0.25));    // keluar di 25% atas
      if (Math.abs(p - last) < 1e-4) return;
      last = p;
      paint(p);
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** `renderStatic` menaruh semua huruf di posisi akhir dan loop tidak jalan. Teks asli tetap di `.sr-only`.

**Jebakan:**
- Dari atas (−105%) butuh mask baris. Tanpa mask, huruf melayang menutupi baris di atasnya. Judul > 60 huruf: pakai unit kata, tulis style per huruf per frame jadi mahal.
- Jangan pakai `passProgress` untuk pola ini: rentangnya terlalu panjang (masuk sampai keluar), huruf baru lengkap saat judul sudah di atas layar.

### `blur-line-reveal` — Kolom teks fokus-blur

**Sumber:** R11 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Statement panjang yang dibaca baris demi baris sambil scroll, dengan rasa "lensa kamera": baris masuk dari blur, lalu keluar fokus di bagian atas layar.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `trigger` | 0.88 | 0.8–0.92 | Baris menyala saat top-nya lewat 88% tinggi viewport. |
| `blurPx` | 10 | 6–14 | Blur awal dan blur maksimum saat keluar. |
| `dur` | 1.4s | 0.9–1.6s | Durasi masuk (sekali, CSS transition). |
| `ease` | `cubic-bezier(.165,.84,.44,1)` | — | easeOutQuart. R11 menyebut angka ini diambil dari fromanother.love. |
| `stagger` | 0.1s × `(i % 4)` | 0.06–0.12s, wrap 3–5 | Delay berulang tiap 4 baris, jadi baris jauh di bawah tidak menunggu lama. |
| `exitBand` | 0.2 | 0.15–0.3 | Pita teratas viewport tempat opacity + blur di-scrub (smoothstep). |

**Resep:**
1. Tiap baris = elemen blok sendiri (`.ln > .ln-in`), dipecah manual di copy supaya penulis mengontrol ritme. R11 memakai virtual scroll; dengan scroll native cukup `defineSection`.
2. Masuk: tambah kelas `.on` sekali saat lewat `trigger`. Transisinya diserahkan ke CSS.
3. Keluar: per frame, `g = smoothstep(clamp(tengahBaris / (vh × exitBand)))`, tulis opacity dan blur ke wrapper luar (`.ln`), bukan `.ln-in`, supaya tidak bentrok dengan transisi masuk.
4. Baca semua rect dulu, baru tulis style (pola read/write R03).

```html
<style>
  .ln-in { opacity: 0; filter: blur(10px); --e: cubic-bezier(.165,.84,.44,1);
           transition: opacity 1.4s var(--e), filter 1.4s var(--e); }
  .ln-in.on { opacity: 1; filter: none; }
  @media (prefers-reduced-motion: reduce) { .ln-in { opacity: 1; filter: none; transition: none; } }
</style>
<script type="module">
  import { defineSection, clamp, smoothstep } from './motion-core.js';

  const col = document.querySelector('[data-blur-column]');
  const lines = [...col.querySelectorAll('.ln')].map((el, i) => ({ el, inner: el.firstElementChild, i, lit: false }));

  defineSection(col, () => ({
    renderStatic() { lines.forEach((l) => l.inner.classList.add('on')); },
    update() {
      const vh = innerHeight;
      const rects = lines.map((l) => l.el.getBoundingClientRect());   // read semua dulu
      lines.forEach((l, k) => {                                         // baru write
        const r = rects[k];
        if (!l.lit && r.top < vh * 0.88) {
          l.lit = true;
          l.inner.style.transitionDelay = `${(l.i % 4) * 0.1}s`;
          l.inner.classList.add('on');
        }
        const g = smoothstep(clamp((r.top + r.height / 2) / (vh * 0.2)));
        l.el.style.opacity = g < 0.999 ? g.toFixed(3) : '';
        l.el.style.filter = g < 0.999 ? `blur(${((1 - g) * 10).toFixed(2)}px)` : '';
      });
    },
  }));
</script>
```

**Reduced-motion & aksesibilitas:** Semua baris langsung tampil tajam, zona exit tidak di-scrub (loop tidak jalan). Teks tetap DOM biasa, jadi bisa dipilih dan dibaca pembaca layar. Jangan beri `aria-hidden` ke baris yang sedang blur.

**Jebakan:**
- `filter: blur()` per baris per frame mahal di HP low-end. Batasi ke ±12 baris yang terlihat, dan kosongkan `filter` (string kosong, bukan `blur(0)`) saat baris sudah tajam supaya layer-nya dilepas.
- Kalau opacity exit ditulis ke elemen yang sama dengan transisi masuk, transisi CSS ikut "mengejar" nilai scrub dan terasa lag 1.4s.
- Baris yang dimuat sudah berada di atas `trigger` (misal reload di tengah halaman) harus langsung `.on`. Logika `r.top < vh * 0.88` sudah menangani ini.

### `word-light-up` — Kata menyala ikut scroll

**Sumber:** R03, R04 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Kalimat manifesto/statement di section pinned: kata redup berubah terang satu per satu sesuai scroll, jadi user "membaca" sambil scroll.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `a`, `b` | 0.08, 0.66 | a 0–0.15, b 0.5–0.8 | Jendela progress tempat kata menyala (R03). Sisa progress setelah `b` = waktu baca sebelum teks pergi. |
| `offColor` | `#f3f2ee47` (putih 28%) | alpha 20–35% | Warna kata yang belum menyala. |
| `onColor` | `#f3f2ee` | — | Warna akhir. |
| `transition` | 0.5s `cubic-bezier(.22,1,.36,1)` | 0.3–0.6s | Kata "berpendar" walau scroll melompat beberapa kata sekaligus. |

**Resep:**
1. Split per kata (tanpa baris).
2. `lit = floor(smoothstep(range(p, a, b)) × n)`. R03 memakai smoothstep, jadi awal dan akhir sedikit lebih lambat.
3. Toggle kelas `.on` hanya untuk kata yang statusnya berubah (antara `lit` lama dan baru), bukan semua kata tiap frame.
4. Warna diurus CSS transition.
5. Varian R04 "scroll-fill": tiap baris memakai `background: linear-gradient(90deg, #fff var(--fill), #fff4 var(--fill)); background-clip: text; color: transparent;` dan `--fill` dari 0% → 100% saat top baris bergerak dari 88% ke 28% viewport. Hasilnya garis isi yang halus, bukan per kata.

```js
import { defineSection, range, smoothstep, stickyProgress, passProgress } from './motion-core.js';
import { splitText } from './split.js';
/* CSS: .sw { color: #f3f2ee47; transition: color .5s cubic-bezier(.22,1,.36,1); }
        .sw.on { color: #f3f2ee; } */

export function wordLightUp(el, { a = 0.08, b = 0.66, pinned = null } = {}) {
  const { words } = splitText(el);
  let lit = 0;
  const set = (n) => {
    for (let i = Math.min(n, lit); i < Math.max(n, lit); i++) words[i].classList.toggle('on', i < n);
    lit = n;
  };
  return defineSection(pinned || el, () => ({
    renderStatic: () => set(words.length),
    update() {
      const p = pinned ? stickyProgress(pinned) : passProgress(el);
      set(Math.floor(smoothstep(range(p, a, b)) * words.length + 1e-6));
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Semua kata langsung `.on`. Pastikan `offColor` tetap lolos kontras minimal untuk teks besar (3:1) kalau kata redup ikut terbaca sebagai konten. Kalau tidak, anggap redup murni dekoratif dan jangan taruh informasi penting yang hanya terlihat saat menyala.

**Jebakan:**
- Section pinned terlalu pendek: 30 kata di 200vh = ±7vh per kata, terlalu cepat. Patokan R03: 340vh+ untuk satu statement. Tanpa pin, pakai `passProgress` (parameter `pinned` kosong).
- Toggle seluruh kata tiap frame = ratusan `classList` per frame. Loop selisih di atas cukup. Varian R04 di Safari butuh `-webkit-background-clip: text`.

### `word-counter-swap` — Counter berupa kata

**Sumber:** R11 · **Mode:** A · **Tingkat berat:** CSS

**Kapan dipakai:** Angka yang lebih "bercerita" kalau ditulis sebagai kata (ZERO → THIRTY-SIX EXPOSURES), dan kata kedua berganti makna di angka tertentu (EXPOSURES → DECISIONS).

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `from` / `to` | 0 / 36 | 0–99 | Rentang angka. |
| `portion` | 0.1 | 0.08–0.2 | Bagian awal progress section yang dipakai counter (R11: `0.15 × 0.6868 ≈ 0.103`). |
| `swapAt` | 30 | — | Angka saat kata kedua berganti. |
| `huntMs` | 150ms | 100–200ms | Durasi "focus pull" tiap angka berganti (blur + glow singkat). |
| `huntBlur` | 4px | 2–6px | Usulan. R11 hanya menyebut blur + glow + hunt kecil, angka blur tidak tercatat. |

**Resep:**
1. Siapkan daftar kata angka (helper EN di bawah untuk 0–99, atau array manual untuk bahasa lain).
2. `n = floor(smoothstep(range(p, 0, portion)) × (to − from + 0.999)) + from`.
3. Saat `n` berubah: ganti teks, restart animasi `hunt` (hapus kelas, paksa reflow, pasang lagi).
4. Ganti kata kedua kalau `n ≥ swapAt`.
5. Container punya teks final untuk pembaca layar; bagian yang berubah `aria-hidden`.

```js
import { defineSection, range, smoothstep, stickyProgress } from './motion-core.js';
/* CSS: .hunt { animation: hunt .15s ease-out; }
        @keyframes hunt { 40% { filter: blur(4px); text-shadow: 0 0 .4em currentColor; } } */
const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export const wordsEN = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));

export function wordCounter(section, numEl, nounEl, { from = 0, to = 36, portion = 0.1, swapAt = 30,
  nouns = ['exposures', 'decisions'], toWords = wordsEN } = {}) {
  let shown = -1;
  const set = (n) => {
    if (n === shown) return;
    shown = n;
    numEl.textContent = toWords(n);
    nounEl.textContent = nouns[n >= swapAt ? 1 : 0];
    numEl.classList.remove('hunt'); void numEl.offsetWidth; numEl.classList.add('hunt');
  };
  return defineSection(section, () => ({
    renderStatic: () => set(to),
    update() {
      const k = smoothstep(range(stickyProgress(section), 0, portion));
      set(from + Math.floor(k * (to - from + 0.999)));
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Langsung angka akhir, tanpa `hunt`. Bungkus `numEl` + `nounEl` dalam elemen `aria-hidden="true"` dan taruh kalimat final ("Thirty-six exposures") di `.sr-only`. Jangan pasang `aria-live` di counter, nanti pembaca layar membacakan 36 angka beruntun.

**Jebakan:**
- `void el.offsetWidth` memaksa layout. Aman untuk satu elemen, jangan dipakai di loop banyak elemen.
- Lebar kata berubah drastis (SIX vs TWENTY-SEVEN), layout sekitarnya ikut goyang. Taruh counter di baris sendiri atau beri `min-width` yang stabil. Scroll cepat memang melompati beberapa angka, jangan dipaksa tampil satu-satu.

### `slot-word-scrub` — Kata slot machine

**Sumber:** R12 · **Mode:** A · **Tingkat berat:** CSS

**Kapan dipakai:** Kalimat dengan satu kata yang berganti ("refreshingly [natural / light / tropical]") selagi section di-scroll. Kata lain diam, cuma slot yang menggulung vertikal.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `words` | 3–5 kata | 2–7 | Isi slot. Lebih dari 7 terasa seperti daftar, bukan slot. |
| `lambda` | 5 | 3–10 | Smoothing gulungan. 5 ≈ `scrub: 0.6` R12 (95% sampai dalam ±0.6s). |
| `hold` | 0.6 | 0.4–0.8 | Bagian tiap segmen tempat kata diam. Sisanya (0.4) jadi gerak gulung. Pengganti `snap 1/(n−1)` R12. |
| `scrollLen` | 100vh per kata | 60–120vh | Tinggi section sticky. Usulan, R12 memakai section konten biasa. |

**Resep:**
1. Markup slot: `<span class="slot"><span class="slot-col"><span>natural</span>…</span></span>`. `.slot` setinggi satu baris (`height: 1lh` atau `1.1em`) dengan `overflow: hidden`, `.slot-col` berisi kata ditumpuk vertikal.
2. Lebar slot = lebar kata terpanjang (atau tween `width` ke kata aktif kalau ingin rapat).
3. `x = p × (n − 1)`. Indeks tampil = `floor(x) + smoothstep(clamp((frac(x) − hold/2) / (1 − hold)))`. Kata "menahan" di tengah segmen lalu menggulung di sela.
4. Displayed index di-`damp` ke target supaya ada rasa lag seperti `scrub: 0.6`.
5. R12 memakai `snap` yang menggeser posisi scroll halaman ke kata terdekat. Versi di atas hanya snap secara visual, scroll user tidak dibajak.

```js
import { defineSection, clamp, damp, smoothstep, stickyProgress } from './motion-core.js';

export function slotWord(section, slot, { hold = 0.6, lambda = 5 } = {}) {
  const col = slot.querySelector('.slot-col');
  const n = col.children.length;
  const words = [...col.children].map((w) => w.textContent.trim());
  slot.setAttribute('aria-label', words.join(', '));         // dibaca sebagai daftar
  col.setAttribute('aria-hidden', 'true');
  let shown = 0;
  const target = (p) => {
    const x = clamp(p) * (n - 1), i = Math.min(Math.floor(x), n - 2);
    return i + smoothstep(clamp((x - i - hold / 2) / (1 - hold)));
  };
  const paint = () => { col.style.transform = `translate3d(0, ${(-shown * 100 / n).toFixed(3)}%, 0)`; };
  return defineSection(section, () => ({
    renderStatic() { shown = 0; paint(); },
    update(dt) {
      shown = damp(shown, target(stickyProgress(section)), lambda, dt);
      paint();
    },
  }));
}
```

**Reduced-motion & aksesibilitas:** Slot diam di kata pertama, dan pastikan kalimat tetap masuk akal dengan kata itu. `aria-label` di `.slot` berisi semua kata supaya pembaca layar tidak hanya mendengar satu varian. Kalau `.slot` berupa `<span>` generic, lebih aman taruh daftar lengkap di `.sr-only` di sebelahnya.

**Jebakan:**
- `translateY` persen dihitung dari tinggi `.slot-col`, jadi `100 / n` per kata hanya benar kalau semua kata satu baris dengan tinggi sama. Paksa `white-space: nowrap` dan `line-height` tetap.
- Slot sempit memotong kata yang lebih panjang: ukur kata terpanjang setelah `document.fonts.ready`. Dengan `n = 1` rumus membagi nol, jadi minimal dua kata.

### `variable-font-style-morph` — Morph `wght` + `wdth`

**Sumber:** R16 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Section "Weights & Widths" untuk brand atau foundry: daftar nama style di kiri, specimen raksasa di kanan yang berubah halus ke style yang di-hover/fokus.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `font` | Roboto Flex | font variable dengan `wght` + `wdth` | Axis Exat (R16) custom; petakan ke rentang font pengganti. |
| `styles` | 7 weight × 3 width = 21 | 4–24 | Tiap item: `data-wght`, `data-wdth`, `data-x`. |
| `wght` | 100–1000 | sesuai axis font | Roboto Flex 100–1000, Archivo/Anybody 100–900. |
| `wdth` | 25 / 100 / 151 | Archivo 62–125, Anybody 50–150 | Condensed / normal / wide. |
| `lambda` | 8 | 6–12 | Kecepatan morph. 8 ≈ tween 0.5s `power2.out` di R16. |
| `shiftX` | −0.02em s/d 0 | ±0.05em | Koreksi optis supaya sisi kiri glyph tetap sejajar saat lebar berubah (R16 −0.28…+0.05rem). |
| `inactiveOpacity` | 0.2 | 0.2–0.45 | Label yang tidak aktif, transisi CSS 200ms. |

**Resep:**
1. Label style berupa `<button>` (bukan `<li>` seperti R16) supaya bisa difokus keyboard. `aria-pressed` menandai yang aktif.
2. Simpan state `{w, d, x}` sebagai angka. Jangan tween string `font-variation-settings` langsung, interpolasi string antar-browser tidak stabil (catatan R16).
3. Per frame: `damp` ke target, tulis `font-variation-settings` hanya kalau nilai bulatnya berubah, matikan loop saat sampai. State awal = item pertama; tanpa `mouseleave`, style terakhir bertahan (R16).

```js
import { ticker, damp, reducedMotion } from './motion-core.js';

export function styleMorph(list, spec, { lambda = 8 } = {}) {
  const cur = { w: 400, d: 100, x: 0 }, tgt = { ...cur };
  let off = null, last = '';
  const write = () => {
    const fvs = `'wght' ${cur.w.toFixed(0)}, 'wdth' ${cur.d.toFixed(1)}`;
    if (fvs !== last) { spec.style.fontVariationSettings = fvs; last = fvs; }
    spec.style.translate = `${cur.x.toFixed(3)}em 0`;
  };
  const step = (dt) => {
    for (const k in cur) cur[k] = damp(cur[k], tgt[k], lambda, dt);
    if (Math.abs(cur.w - tgt.w) < 0.5 && Math.abs(cur.d - tgt.d) < 0.05) {
      Object.assign(cur, tgt); off(); off = null;
    }
    write();
  };
  const pick = (btn) => {
    if (!btn) return;
    tgt.w = +btn.dataset.wght; tgt.d = +btn.dataset.wdth; tgt.x = parseFloat(btn.dataset.x || 0);
    list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    if (reducedMotion()) { Object.assign(cur, tgt); return write(); }
    off ??= ticker.add(step);
  };
  list.addEventListener('pointerover', (e) => pick(e.target.closest('button')));
  list.addEventListener('focusin', (e) => pick(e.target.closest('button')));
  const first = list.querySelector('button');
  pick(first); Object.assign(cur, tgt); write();
}
/* CSS: .spec { font-family: 'Roboto Flex'; }  button[aria-pressed=false] { opacity: .2; transition: opacity .2s; } */
```

**Reduced-motion & aksesibilitas:** Reduce → specimen langsung lompat ke style terpilih (tanpa interpolasi). Label = `<button>` dengan nama style sebagai teks, jadi keyboard (Tab) dan pembaca layar bisa memicu morph. Specimen besar ("Rẽ") cukup `aria-hidden` kalau isinya cuma contoh glyph.

**Jebakan:**
- `font-variation-settings` menimpa semua axis yang tidak ditulis ke default font. Kalau butuh `opsz` atau `GRAD`, tulis semuanya di string yang sama.
- Ganti `wdth` = lebar teks berubah, layout sekitar bergeser tiap frame. Taruh specimen di kotak ukuran tetap (`contain: layout`).
- Nilai axis Exat (42–228) bukan skala CSS. Jangan salin angka itu ke Roboto Flex.

### `proximity-weight-field` — Medan ketebalan dari kursor

**Sumber:** R16 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Section glyphset/brand yang "wow" tapi ringan: grid huruf yang menebal dan berubah warna di sekitar kursor, makin jauh makin tipis.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `count` | 240 | ≤ 300 | Jumlah huruf. Tiap huruf = re-shaping teks saat `wght` berubah. |
| `radius` | `0.42 × innerWidth` | 0.3–0.5 vw | R16: 6rem dengan root 6.944vw ≈ 600px di layar 1440. |
| `stops` | 1.0 → 200, 0.55 → 450, 0.35 → 700, 0.125 → 1000 | — | `[jarak/radius, wght, warna]`, dari jauh ke dekat. Warna R16: biru tua → biru → kuning/oranye → merah. |
| `fadeAt` | 2.5 | 1.5–3 | Di jarak `fadeAt × radius`, opacity turun ke `idleOpacity`. |
| `idleOpacity` | 0.15 | 0–0.3 | R16 = 0 (grid hanya terlihat di sekitar kursor). Usulan 0.15 supaya grid tetap terbaca. |
| `enter` | λ 12 | 8–16 | Medan tumbuh dari 0 saat kursor masuk section (R16 tween 0.4s `power3.out`). |
| `disableBelow` | 768px / pointer kasar | — | R16 mematikan efek di mobile dan menggantinya dengan video. |

**Resep:**
1. Markup: `.field` berisi N `<span class="cell">a</span>`, CSS `.cell { font-variation-settings: 'wght' var(--w); color: var(--c); opacity: var(--o); }`. Cache titik tengah tiap sel, ukur ulang saat resize dan scroll (bukan tiap frame).
2. `power` di-damp 0 → 1 saat `pointerenter`, → 0 saat `pointerleave`. Jarak dibagi `power`, jadi medan "mengembang" saat kursor masuk.
3. Per sel: `f = jarak / radius`, interpolasi stop untuk `wght` dan warna, opacity dari `f` antara 1 dan `fadeAt`.
4. Bulatkan `wght` ke bilangan bulat dan tulis CSS var hanya kalau berubah (write-avoidance R16).
5. Pointer kasar / layar kecil: tampilkan statis (semua sel weight tengah).

```js
import { defineSection, clamp, damp, lerp } from './motion-core.js';
const STOPS = [[1, 200, [0, 0, 203]], [0.55, 450, [92, 146, 255]], [0.35, 700, [255, 174, 0]], [0.125, 1000, [255, 11, 0]]];
const sample = (f) => {                                   // f = jarak / radius → [wght, rgb]
  for (let i = 1; i < STOPS.length; i++) {
    const [fa, wa, ca] = STOPS[i - 1], [fb, wb, cb] = STOPS[i];
    if (f >= fb) { const t = clamp((fa - f) / (fa - fb)); return [lerp(wa, wb, t), ca.map((v, j) => lerp(v, cb[j], t))]; }
  }
  return STOPS.at(-1).slice(1);
};
export function proximityField(el, { radius = () => innerWidth * 0.42, fadeAt = 2.5, idle = 0.15 } = {}) {
  const cells = [...el.querySelectorAll('.cell')];
  let pts = [], mx = -1e4, my = -1e4, power = 0, inside = false;
  const measure = () => (pts = cells.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  return defineSection(el, (ctx) => {
    if (ctx.reduced || !ctx.fine || ctx.small) { cells.forEach((c) => (c.style.cssText = '--w:450;--o:1')); return {}; }
    addEventListener('scroll', measure, { passive: true });
    el.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; inside = true; });
    el.addEventListener('pointerleave', () => (inside = false));
    return {
      onResize: measure,
      update(dt) {
        if (!pts.length) measure();
        power = damp(power, inside ? 1 : 0, 12, dt);
        const R = radius() * Math.max(power, 1e-3);
        cells.forEach((c, i) => {
          const f = Math.hypot(mx - pts[i][0], my - pts[i][1]) / R, [w, rgb] = sample(f);
          const o = idle + (1 - idle) * (1 - clamp((f - 1) / (fadeAt - 1)));
          const css = `--w:${Math.round(w)};--c:rgb(${rgb.map(Math.round)});--o:${o.toFixed(2)}`;
          if (c._css !== css) c.style.cssText = c._css = css;          // write-avoidance
        });
      },
      destroy: () => removeEventListener('scroll', measure),
    };
  });
}
```

**Reduced-motion & aksesibilitas:** Reduce, pointer kasar, atau layar < 768px → semua sel weight tengah, opacity penuh, loop tidak dipasang (fungsi setup mengembalikan `{}`). Grid huruf murni dekoratif: beri `aria-hidden="true"` ke `.field` (R16 lupa ini) dan sediakan judul/teks biasa di dekatnya.

**Jebakan:**
- `getBoundingClientRect` 240× tiap frame = layout thrash. Ukur hanya saat resize/scroll seperti di atas. Kalau section ada di container scroll (bukan window), pasang listener scroll ke container itu.
- `wght` tanpa pembulatan memicu re-shaping 240 huruf per frame walau kursor diam. Pembulatan + cache string menghentikan tulis begitu kursor berhenti.
- `renderStatic` hanya dipanggil `defineSection` saat reduced-motion. Untuk fallback pointer kasar, state statis harus ditulis sendiri di setup (seperti di atas).

### `type-tester` — Area coba font

**Sumber:** R16 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Section wajib untuk situs font/brand type: pengunjung mengetik sendiri dan mengatur axis, ukuran, leading, tracking, alignment, warna.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `wght` | 400 | sesuai axis (100–1000 Roboto Flex) | Slider weight. R16 masih memakai select static 200–900. |
| `wdth` | 100 | 25–151 (Roboto Flex) | Slider width (tambahan versi variable). |
| `size` | 96px | 16–240px | Ukuran teks. |
| `leading` | 1.05 | 0.8–1.6 | `line-height`. |
| `tracking` | 0em | −0.05–0.2em | `letter-spacing`. Plus `align` left/center/right. |
| `swatches` | 5 | 3–6 | Pasangan bg/fg (R16: 5 warna background). Tinggi textarea selalu mengikuti isi. |

**Resep:**
1. `<textarea>` + kontrol `<input type=range>` / `<button>`. Semua kontrol hanya menulis CSS variable di wrapper, CSS yang menerapkan ke textarea.
2. Satu listener `input` di form (delegasi), bukan satu per kontrol.
3. Auto-height: kosongkan `height`, lalu set ke `scrollHeight`. Kalau halaman memakai ScrollTrigger, panggil `ScrollTrigger.refresh()` sesudahnya (R16).
4. Tampilkan nilai slider di `<output>` supaya terbaca.

```html
<form class="tester" style="--wght:400;--wdth:100;--size:96px;--lead:1.05;--track:0em;--align:left">
  <label>Weight <input type="range" name="wght" min="100" max="1000" value="400"></label>
  <label>Width <input type="range" name="wdth" min="25" max="151" value="100"></label>
  <label>Size <input type="range" name="size" min="16" max="240" value="96" data-unit="px"></label>
  <label>Leading <input type="range" name="lead" min="0.8" max="1.6" step="0.01" value="1.05"></label>
  <label>Tracking <input type="range" name="track" min="-0.05" max="0.2" step="0.005" value="0" data-unit="em"></label>
  <fieldset><legend>Align</legend>
    <button type="button" name="align" value="left">Left</button>
    <button type="button" name="align" value="center">Center</button>
  </fieldset>
  <textarea aria-label="Ketik untuk mencoba font" spellcheck="false" rows="1">Ketik apa saja di sini</textarea>
</form>
<style>
  .tester textarea { font-family: 'Roboto Flex'; font-size: var(--size); line-height: var(--lead);
    letter-spacing: var(--track); text-align: var(--align); resize: none; overflow: hidden; width: 100%;
    font-variation-settings: 'wght' var(--wght), 'wdth' var(--wdth); }
</style>
<script type="module">
  const form = document.querySelector('.tester'), ta = form.querySelector('textarea');
  const fit = () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; };
  const set = (el) => form.style.setProperty('--' + el.name, el.value + (el.dataset.unit || ''));
  form.addEventListener('input', (e) => { if (e.target !== ta) set(e.target); fit(); });
  form.addEventListener('click', (e) => { if (e.target.name === 'align') set(e.target); });
  document.fonts.ready.then(fit);
</script>
```

**Reduced-motion & aksesibilitas:** Tidak ada motion otomatis, jadi tidak perlu cabang khusus. Tiap kontrol punya `<label>`, textarea punya `aria-label`, tombol align bisa diberi `aria-pressed`. Swatch warna harus berupa tombol dengan nama ("Hitam di krem"), bukan kotak warna tanpa label.

**Jebakan:**
- Textarea dengan `font-size` 240px di HP langsung melebar. Clamp di CSS (`min(var(--size), 18vw)`) atau turunkan `max` slider di layar kecil.
- Ukur auto-height setelah `document.fonts.ready`, kalau tidak tinggi awal dihitung dari font fallback.

### `fit-text-wordmark` — Wordmark selebar container

**Sumber:** R03, R04, R01, R16 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Footer atau hero dengan nama brand raksasa yang pas selebar container di semua layar, dengan huruf naik satu per satu saat terlihat.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `measureAt` | 100px | — | Ukur lebar teks di 100px, lalu `fontSize = 100 × lebarContainer / lebarTeks` (R03). |
| `letterDelay` | 45ms | 30–100ms | Jeda per huruf (R04). R16 hero: 100ms per path. |
| `rise` | 110% | 100–120% | Huruf mulai dari bawah mask. |
| `dur` | 0.8s | 0.6–1s | R16 hero 800ms `cubic-bezier(.84,.01,.18,1)`. |
| `threshold` | 0.25 | 0.2–0.4 | IO threshold untuk mulai (R04). |
| `lenFactor` | 0.58 | 0.5–0.65 | Varian CSS murni R01: `font-size: min(40vh, calc(90vw / (var(--len) * .58)))`, cocok untuk teks yang berganti panjang. |

**Resep:**
1. Split per huruf (mask di wordmark itu sendiri: `overflow: hidden` + padding bawah).
2. Ukur dengan `font-size: 100px` dan `white-space: nowrap`, hitung skala, set ulang `font-size`. Ulangi saat resize (ResizeObserver container) dan setelah `document.fonts.ready`.
3. IO threshold 0.25 → `.is-in`, huruf naik dengan delay `--i × 45ms`. Opsional R04: wiggle per huruf saat hover, band wordmark `position: sticky; bottom: 0` yang "terbuka" saat footer di-scroll.
4. Teks yang berganti (nama varian produk): pakai varian R01, set `--len` = jumlah karakter, tanpa JS ukur.

```js
import { reducedMotion } from './motion-core.js';
import { splitText } from './split.js';
/* CSS: .wordmark { white-space: nowrap; line-height: .9; overflow: hidden; padding-bottom: .08em; }
        .wordmark .split-visual { display: inline-block; }   // supaya scrollWidth = lebar teks
        .wordmark .sc { transform: translateY(110%); transition: transform .8s cubic-bezier(.84,.01,.18,1) calc(var(--i) * 45ms); }
        .wordmark.is-in .sc { transform: none; }
        @media (prefers-reduced-motion: reduce) { .wordmark .sc { transform: none; transition: none; } } */

export async function fitWordmark(el, box = el.parentElement) {
  await document.fonts.ready;
  const { chars } = splitText(el, { chars: true });
  chars.forEach((c, i) => c.style.setProperty('--i', i));
  const fit = () => {
    el.style.fontSize = '100px';
    const w = el.querySelector('.split-visual').scrollWidth;
    const avail = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
    el.style.fontSize = `${(100 * avail / w).toFixed(2)}px`;
  };
  fit();
  new ResizeObserver(fit).observe(box);
  if (reducedMotion()) return el.classList.add('is-in');
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
  }, { threshold: 0.25 });
  io.observe(el);
}
```

**Reduced-motion & aksesibilitas:** Huruf langsung di tempat, wiggle hover dimatikan. Wordmark tetap teks asli di `.sr-only`. Kalau wordmark berupa logo SVG (R16 hero), beri `role="img"` + `aria-label` nama brand.

**Jebakan:**
- `.split-visual` harus `inline-block` saat mengukur. Kalau `block`, lebarnya selalu selebar parent dan skala jadi salah.
- ResizeObserver memanggil `fit()` yang mengubah `font-size`, tapi tidak mengubah lebar `box`, jadi tidak loop. Jangan observe elemen wordmark sendiri.
- Huruf dengan overhang (italic, swash) terpotong mask di kanan. Tambah `padding-inline` kecil di wordmark.

### `sine-arc-badges` — Badge melayang di busur sinus

**Sumber:** R12 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Section benefit/stat ("500MG potassium"): badge bulat berisi teks naik melintasi layar sambil berayun ke kiri/kanan dan berputar, bergantian sisi.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `travel` | 70vh → −70vh | ±50–90vh | Lintasan vertikal tiap badge relatif ke tengah viewport (R12). |
| `sectionLen` | 320vh | 200–400vh | Tinggi section sticky (R12 `#benefits` 320vh). |
| `stagger` | 0.3 | 0.2–0.4 | Offset jendela tiap badge, dalam satuan durasi badge (R12 stagger 0.3 di timeline). |
| `swing` | 0.12 × vw | 0.08–0.2 vw | Amplitudo `x = sin(πt) × vw × k`. Usulan, nilai `k` R12 tidak tercatat. |
| `angle` | 12° | 6–20° | Rotasi `sin(πt) × angle`. Usulan. Sisi selang-seling: genap ke kanan, ganjil ke kiri. |

**Resep:**
1. Section tinggi + `.pin` sticky 100vh. Badge `position: absolute` di tengah pin, transform diisi JS.
2. Total durasi = `1 + (n − 1) × stagger`. Badge ke-`i`: `t = clamp(p × total − i × stagger)`.
3. `y = lerp(70, −70, t)` vh, `x = sin(πt) × vw × k × side`, `rotate = sin(πt) × angle × side`.
4. Badge di luar `t ∈ (0, 1)` disembunyikan (`visibility: hidden`) supaya tidak menumpuk di tepi.

```js
import { defineSection, clamp, lerp, stickyProgress } from './motion-core.js';

export function arcBadges(section, { stagger = 0.3, swing = 0.12, angle = 12, from = 70, to = -70 } = {}) {
  const badges = [...section.querySelectorAll('.badge')];
  const total = 1 + (badges.length - 1) * stagger;
  const paint = (p) => {
    const vw = innerWidth / 100, vh = innerHeight / 100;
    badges.forEach((b, i) => {
      const t = clamp(p * total - i * stagger), side = i % 2 ? -1 : 1, s = Math.sin(Math.PI * t);
      b.style.visibility = t > 0 && t < 1 ? 'visible' : 'hidden';
      b.style.transform = `translate(-50%, -50%) translate(${(s * swing * 100 * vw * side).toFixed(1)}px, ` +
        `${(lerp(from, to, t) * vh).toFixed(1)}px) rotate(${(s * angle * side).toFixed(2)}deg)`;
    });
  };
  return defineSection(section, () => ({
    renderStatic() {                               // tanpa busur: badge berjajar statis
      section.classList.add('is-static');
      badges.forEach((b) => { b.style.transform = 'none'; b.style.visibility = 'visible'; });
    },
    update: () => paint(stickyProgress(section)),
  }));
}
/* CSS: .badge { position: absolute; left: 50%; top: 50%; }
        .is-static .badge { position: static; }  .is-static .pin { display: flex; flex-wrap: wrap; gap: 1rem; } */
```

**Reduced-motion & aksesibilitas:** Seperti R12: badge tanpa busur, disusun statis dalam grid/flex (`.is-static`). Badge berisi teks DOM asli. Karena badge yang di luar jendela `visibility: hidden` juga hilang dari pembaca layar, sediakan daftar benefit yang sama di `.sr-only` atau pastikan konten badge juga ada di copy biasa.

**Jebakan:**
- `visibility: hidden` menyembunyikan konten dari pembaca layar. Jangan jadikan badge satu-satunya tempat informasi.
- Rotasi + teks kecil = sulit dibaca. Batasi `angle` ≤ 15° kalau isi badge lebih dari dua kata. `innerWidth` termasuk scrollbar; untuk layout presisi pakai `document.documentElement.clientWidth`.

### `copy-swap` — Copy keluar, ganti, masuk

**Sumber:** R01 · **Mode:** A+B · **Tingkat berat:** CSS

**Kapan dipakai:** Headline + deskripsi berganti saat user memilih varian (produk, flavor, persona), biasanya bersamaan dengan transisi lain (model berputar, warna tema). Swap teks diletakkan di titik "puncak" transisi besar.

**Parameter:**

| nama | default | rentang wajar | efeknya |
|---|---|---|---|
| `outMs` | 350 | 250–450 | Keluar: opacity 1 → 0, turun `y`. `power2.in` = `cubic-bezier(.55,.055,.675,.19)`. |
| `inMs` | 500 | 400–700 | Masuk: naik ke 0, opacity → 1. `power2.out` = `cubic-bezier(.215,.61,.355,1)`. |
| `y` | 14px | 8–24px | Jarak geser. |
| `stagger` | 80ms | 50–120ms | Jeda headline → deskripsi saat masuk. |
| `peakMs` | 600 | = puncak transisi utama | Swap teks di sini. R01 swap di 350ms padahal puncak spin 600ms (tidak sinkron); versi ini menunggu sampai `peakMs`. |
| `lenFactor` | 0.58 | 0.5–0.65 | `font-size: min(40vh, calc(90vw / (var(--len) * .58)))` supaya judul panjang/pendek mengisi lebar yang sama. |

**Resep:**
1. Semua trigger (kartu, menu, panah) memanggil satu fungsi `select(id)`. Kunci input sampai animasi **terpanjang** selesai (R01 melepas lock terlalu cepat).
2. Keluar paralel → tunggu sampai `peakMs` → ganti `textContent` + `--len` → masuk dengan stagger → `cancel()` animasi WAAPI supaya `fill` tidak menempel.

```js
import { reducedMotion } from './motion-core.js';
const IN = 'cubic-bezier(.55,.055,.675,.19)', OUT = 'cubic-bezier(.215,.61,.355,1)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let busy = false;

export async function swapCopy(nodes, texts, { outMs = 350, inMs = 500, y = 14, stagger = 80, peakMs = 600 } = {}) {
  if (busy) return false;
  busy = true;
  const apply = () => nodes.forEach((n, i) => {
    n.textContent = texts[i];
    n.style.setProperty('--len', texts[i].length);
  });
  if (reducedMotion()) { apply(); busy = false; return true; }
  const shown = { opacity: 1, transform: 'none' }, hidden = { opacity: 0, transform: `translateY(${y}px)` };
  const t0 = performance.now();
  await Promise.all(nodes.map((n) => n.animate([shown, hidden], { duration: outMs, easing: IN, fill: 'forwards' }).finished));
  await wait(Math.max(0, peakMs - (performance.now() - t0)));
  apply();
  const ins = nodes.map((n, i) => n.animate([hidden, shown], { duration: inMs, delay: i * stagger, easing: OUT, fill: 'both' }));
  await Promise.all(ins.map((a) => a.finished));
  nodes.forEach((n) => n.getAnimations().forEach((a) => a.cancel()));
  busy = false;
  return true;
}
```

**Reduced-motion & aksesibilitas:** Reduce → teks langsung diganti tanpa fade (R01 tidak menghormati reduce untuk bagian ini). Bungkus headline + deskripsi dalam satu container `aria-live="polite"` supaya varian baru dibacakan sekali setelah swap. Trigger berupa `<button aria-pressed>`.

**Jebakan:**
- Lock dilepas sebelum tween terpanjang selesai → klik cepat memulai transisi kedua di tengah yang pertama (bug R01). Kalau ada spin 2.1s, lock menunggu itu, bukan hanya copy.
- `fill: 'forwards'` yang tidak dibatalkan membuat style "terkunci", kelas CSS berikutnya tidak berefek. Font-size berbasis `--len` perlu kalibrasi ulang `lenFactor` untuk font condensed/wide.
