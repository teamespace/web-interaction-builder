# web-interaction-builder

A skill for AI coding agents (Claude Code, Codex, Cursor) that builds Awwwards-level web interactions from a reference: a link, a screen recording or a description. Two modes:

- **Mode A: one section** (a hero, a gallery, a closing section)
- **Mode B: a full website** with one rhythm, transitions and a consistent motion language

It is distilled from dissecting 17 websites (R01–R17): 12 picked by the team and 5 Awwwards Site of the Day + Developer Award winners chosen to fill technique gaps (page transitions, physics, particles, variable fonts, 3D configurators). The result is 78 patterns, a small shared motion runtime and a quality gate.

> **Status: 0.1.0.** The skill's instructions and pattern notes are written in Indonesian (the team's working language); the agent reads them fine and the pages it builds can be in any language.

## Install

```bash
npx skills add teamespace/web-interaction-builder
```

That installs the skill with the [`skills`](https://github.com/vercel-labs/skills) CLI and asks which agents to add it to. Add `-g` to install it for your user instead of the current project.

<details>
<summary>Claude Code plugin</summary>

```text
/plugin marketplace add teamespace/web-interaction-builder
/plugin install web-interaction-builder@web-interaction-builder
```

`/plugin update` upgrades it later.

</details>

<details>
<summary>From a clone (symlink, updates with git pull)</summary>

```bash
git clone https://github.com/teamespace/web-interaction-builder
cd web-interaction-builder
./install.sh               # Claude Code
./install.sh --codex       # Codex
./install.sh --all-agents  # both
```

</details>

## Use

Ask your agent, for example:

- *"Build one section like the hero on https://example.com, the part I like is the object that follows the cursor."*
- *"Make a closing section where every click drops shapes that pile up, like format.obys.agency."*
- *"Build a one-page portfolio with a scroll-velocity photo reel, blur line reveals and a draggable gallery."*

The skill checks its library first, dissects new references, picks the lightest technique that looks the same, builds from a starter, and runs a quality gate before handing the result over.

## What's inside

```
skills/web-interaction-builder/
├── SKILL.md                     # core lessons from the research + 7-step workflow
├── assets/starter/              # starting point for every build
│   ├── index.html
│   ├── style.css                # tokens, pinned sections, reduced-motion state
│   ├── motion-core.js           # damp, range, spring, velocity tracker, ticker, defineSection, ...
│   └── main.js                  # example section + CONFIG block
├── references/
│   ├── library.md               # R01–R17: main pattern and the real technique behind it
│   ├── bedah-referensi.md       # how to dissect a new reference
│   ├── mode-full-website.md     # rhythm, code structure, transitions, budget for mode B
│   ├── quality-gate.md          # mandatory checklist + asset budget
│   └── patterns/                # 78 patterns in 6 families + generated index.md
└── scripts/build_index.py       # rebuilds patterns/index.md
evals/                           # test scenarios
```

| Family | Patterns | Examples |
| --- | --- | --- |
| Scroll | 16 | `pinned-range-timeline`, `sticky-card-stack`, `scroll-video-scrub`, `chapter-scroll-engine` |
| Pointer, gesture & physics | 19 | `cursor-scrub-video`, `infinite-drag-canvas`, `throwable-cards`, `physics-drop-field` |
| WebGL & 3D | 14 | `blur-masked-model-swap`, `procedural-product-scene`, `morphing-point-cloud`, `product-configurator-3d` |
| Typography | 12 | `masked-split-reveal`, `blur-line-reveal`, `variable-font-style-morph` |
| Transitions | 12 | `route-veil-transition`, `mpa-view-transition`, `flip-morph`, `circle-wipe` |
| Generative | 6 | `pixel-sky-dither`, `ascii-glyph-ramp`, `hand-drawn-liveliness` |

## Principles

1. Pick the **lightest technique** that looks the same: CSS/SVG → Canvas 2D → video → procedural Three.js → GLB model. Many "3D" effects in the references turned out to be video, SVG or Canvas 2D.
2. One engine: progress (scroll, pointer or time) → `range()` windows → easing → properties.
3. Time-based motion (`damp` with `dt`), hand-written springs, fling velocity from the last 100 ms.
4. Every section follows a lifecycle contract and stops when off screen.
5. Reduced motion, touch/mobile, accessibility and the asset budget must pass `quality-gate.md`.

## Contributing

- New pattern: add it to a family file in `references/patterns/` using the same heading format, then run `python3 scripts/build_index.py`.
- New reference: dissect it with `references/bedah-referensi.md` and add a row to `references/library.md`.

## Notes

References were dissected to learn techniques and numbers. No code from the reference sites is copied; every snippet is rewritten. Site names and work belong to their owners.

## License

[MIT](LICENSE)
