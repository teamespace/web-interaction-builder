# Kopi Senja · Closing section "drop field"

A closing section for the local coffee brand Kopi Senja (dark brown + cream). Every click or tap inside the dashed field drops one chip (a shape or placeholder image). The chips fall and pile up at the bottom.

- **Mode:** A (one section)
- **Reference:** R14 FORMAT (Obys), https://format.obys.agency, the `.field` block at the end of the page. Notes: `web-interaction-lab/research/R14-format-obys.md`
- **Pattern:** `physics-drop-field` (`references/patterns/pointer-gesture.md`), plus the R14 masked word reveal with a "click/clack" style blink
- **Technique tier:** CSS + Matter.js 0.20.0. Matter.js drives the bodies and each chip is a DOM `div` that copies its body's position and angle. No canvas, no WebGL, no GSAP. A stable pile of rotated boxes needs real rigid-body collision, and a hand-written solver would be heavier and less stable, so this is the lightest tier that gives the same result.

## Files

| File | Contents |
| --- | --- |
| `index.html` | Semantic markup: heading, address, CTA links, the field, and the Drop and Clear buttons. Loads Matter.js 0.20.0 from jsDelivr |
| `style.css` | Brand tokens in `:root`, field layout, chip shapes/tones, word reveal and blink, reduced-motion state |
| `motion-core.js` | Copy of the skill starter. Comments translated to English, code unchanged |
| `main.js` | `CONFIG` + one `defineSection` for the closing section |

The first section ("Previous section (demo filler)") is only there so you can scroll the closing section in and out. Remove it when you place the section on a real page.

## How it works

1. When the field enters view, the four words rise out of their masks (0.9 s, 0.13 s stagger, about `power3.out`) and then blink in turns (2.6 s `step-end` loop). The blink pauses while the field is off-screen.
2. A mouse `pointerdown` spawns a chip immediately at the click point, slightly above it, with a random angle of ±0.2 rad. On touch and pen, only a real tap spawns a chip (moved ≤ 10 px, under 320 ms), so starting a scroll does not drop chips.
3. There is one Matter engine and no `Runner`. It is stepped from `update(dt)` on the page's single clock, so it stops automatically when the section is off-screen. Long frames are split into sub-steps of at most 1000/60 ms.
4. The bounds are a floor and two tall walls with no ceiling. They are rebuilt on resize.
5. Chips are capped (30 on desktop, 18 at ≤ 767 px) and the oldest is removed first.
6. Scrolling fast flips gravity to −0.2, so the pile floats up. Chips that leave through the top are removed. When the section becomes active again, the first frame is ignored so a stale scroll position is not read as a fast scroll.
7. The text fades out after the first drop. **Clear** removes every chip and brings the text back.

## CONFIG (in `main.js`)

| Key | Default | What it does |
| --- | --- | --- |
| `physics.gravity` | 1 | Fall speed. 2–3 feels heavier |
| `physics.restitution` | 0.15 | Bounce. 0.03 is sticky, 0.3 and up is bouncy |
| `physics.friction` / `frictionAir` | 0.4 / 0.01 | How the pile grips / how floaty the fall is |
| `spawn.lift`, `spawn.angle` | 0.35, 0.2 | Spawn height above the click point, random start angle |
| `spawn.minScale` / `maxScale` / `minSide` | 0.55 / 1.15 / 48 | Chip scaling across screen sizes. The shortest side never drops below 48 px |
| `maxChips` | 30 / 18 | FIFO cap on desktop / small screens |
| `scrollFlip` | on, 0.15 vh/s, −0.2 | Gravity flip during fast scroll. Set `enabled: false` to turn it off |
| `intro` | 0.9 s, 0.13 s | Word reveal timing |
| `tap` | 10 px, 320 ms | What counts as a tap on touch |
| `chips` | 8 placeholders | Chip catalogue (see below) |

## Replacing the placeholders

- **Chip images:** each entry in `CONFIG.chips` accepts `src: './chips/latte.webp'`. Once set, the image fills the chip and the striped placeholder disappears. Use transparent PNG/WebP for non-rectangular shapes and match `shape` to the outline (`rect`, `pill`, `circle`, `tri`). Sizes are px for a 1440-wide screen.
- **Chip labels and colours:** `label` and `tone` (`cream`, `caramel`, `brown`, `dark`). The colours live in `style.css`.
- **Text:** heading, address, hours, CTA links and footer are plain HTML in `index.html`. The two `href`s (`#menu`, `#instagram`) are placeholders.
- **Brand colours and fonts:** the tokens at the top of `style.css`. Fraunces + Inter come from Google Fonts and fall back to Georgia/system fonts.

## Accessibility, touch and reduced motion

- **Keyboard:** the **Drop one** button spawns a chip at a random x, and **Clear** resets the field. Both are real `<button>`s with a visible focus ring and are at least 44 px tall. The field text and the chips are decorative (`aria-hidden`).
- **Touch:** spawning is tap-only, the field uses `touch-action: manipulation` so the page keeps scrolling, chips are at least 48 px, and the hint reads "Tap anywhere…" on coarse pointers.
- **Reduced motion:** `renderStatic()` runs, so there is no animation loop at all. The words show without the rise or the blink, there is no gravity flip, and each click or Drop adds a chip that is pre-simulated (240 steps) so it appears already at rest in the pile.
- **Off-screen:** `defineSection` (IntersectionObserver) stops the physics loop, and a second observer pauses the CSS blink.
- **No Matter.js** (CDN blocked): the field shows its text statically and the buttons are hidden. No errors are thrown.

## Not verified yet

- Not opened in a browser in this run. Only static checks were done: `node --check` on both JS files, and the one CDN script URL is pinned (`matter-js@0.20.0`). Visual result, console, the feel of the drops, the 375 px layout and reduced-motion emulation still need a browser pass.
- Whether the chip collider shapes line up exactly with the CSS shapes, especially the triangle offset and the pill/stamp radii.
- The gravity flip threshold (0.15 viewport heights per second, from R14) is low, so almost any scroll may lift the pile. Tune it after watching it run.
- How it feels at 120 Hz and on iOS Safari.
