# Ruang Lantai — "Recent work" section

One section (mode A) for the architecture studio Ruang Lantai. The section title appears word by word, then 4 project cards stack as you scroll, like the Recent Work section on fragment.im.

## Patterns & sources
| Part | Skill pattern | Source | Technique |
| --- | --- | --- | --- |
| 4 stacking project cards | `sticky-card-stack` (`scroll.md`) | R10 Fragment, Recent Work (`research/R10-fragment.md`) | CSS `position: sticky` plus a small script that scrubs the old card's `scale`/`translateY` from scroll position |
| Title appears word by word | `masked-split-reveal`, unit = word (`typography.md`) | R04/R16 (R10 itself only fades up) | Split into words; each word rises from behind its own mask. CSS transition plus a one-shot IntersectionObserver |

No libraries and no JS from a CDN. The only external request is Google Fonts (Archivo).

## Files
- `index.html`: semantic markup (h2, an `<ol>` with one `<article>` per project). `.intro` and `.outro` are demo lead-in/lead-out only; drop them when placing the section in a real page.
- `style.css`: color/font tokens in `:root`, card layout, title masks, reduced-motion state.
- `motion-core.js`: copy of the skill's `assets/starter/` file. The code is unchanged; only the comments were translated to English.
- `split.js`: text-split helper from `typography.md` (Foundations); code unchanged, comments in English.
- `main.js`: `CONFIG` plus one `defineSection` for this section.

## Parameters worth tweaking (`CONFIG` in `main.js`)
| Name | Default | Effect |
| --- | --- | --- |
| `stack.stickyTop` / `stickyTopMobile` | 106 / 76 px | How far from the top a stuck card sits (R10) |
| `stack.gap` / `gapMobile` | 48 / 24 px | Space between cards before they stack |
| `stack.cardHeight` | 70 (vh) | Card height; a 360px minimum is set in CSS |
| `stack.line` | 0.5 | The old card starts receding when the next card's top passes mid-screen |
| `stack.scaleTo` | 0.85 | Final scale of the old card |
| `stack.yTo` | 24 px | How far the old card drops |
| `stack.shade` | 0 | Dark overlay on the old card (R10 has none; try 0.15) |
| `title.duration` / `stagger` | 0.9 s / 80 ms | Duration per word and delay between words |
| `title.from` | 110% | Where each word starts inside its mask |
| `title.ease` | expo-out `(.16,1,.3,1)` | How the words land |
| `title.rootMargin` | −10% bottom | When the title starts appearing |

## Swapping content
- **Title**: edit the text of `<h2 data-reveal-text="words">`. Plain text only (`<em>`/`<a>` inside it is dropped from the visual copy).
- **Cards**: duplicate one `<li class="card">`. The placeholder gradient colors are set with `--tone-a` / `--tone-b` in its `style` attribute.
- **Images**: replace the contents of `.card__media` (SVG placeholder) with `<img src="…" alt="…" loading="lazy">` and remove `role="img"` + `aria-label` from that div. Add `img { width:100%; height:100%; object-fit:cover }`.
- **Colors & fonts**: tokens in `:root` (`style.css`). Current placeholders: light concrete `#efebe4`, terracotta `#b4532a`, Archivo.

## Behavior
- **Reduced motion**: the title shows in full right away; cards still stick and stack (that is layout) but do not scale or drop.
- **Touch/mobile**: no hover-only effects (button hover is limited to fine pointers). At ≤ 767px cards become one column (image on top, text below), top 76px, gap 24px. Buttons are at least 44px tall.
- **Off-screen**: the stack update only runs on the `defineSection` ticker while the section is near the viewport, and only writes styles when the scroll position changes. The title observer is released after it fires once.
- **Keyboard**: focusing a link in a card that is already covered by later cards scrolls the page back to that card, so the focused link is visible.
- **Screen readers**: the original title lives in `.sr-only`; the word-by-word copy is `aria-hidden`.

## Not yet verified
- Not opened in a browser yet (only `node --check`). Still needed: desktop (≥1280px) and 375px screenshots, console check, scrolling up and down, tabbing through the card links, and reduced-motion emulation.
- Feel at 120 Hz and on iOS Safari (where the changing address bar alters `innerHeight`) is unchecked.
