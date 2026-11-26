# Changelog

## 0.1.1 — 2026-11-26

Fixes from the first two test builds (`examples/`):

- Starter: English comments; `split.js` (accessible text splitting) and `pointer-kit.js` (`bindDrag`, tap-safe on touch) added; `body { overflow-x: clip }` so sticky works; `.section--flow` for stacks and full-bleed layouts; system fonts by default.
- `defineSection`: new `onEnter` / `onLeave` hooks; `onResize` also runs on window resize, font load and page load.
- `sticky-card-stack`: measure cards with transforms cleared (fixes ~70px drift after a mid-scroll resize); keyboard focus scrolls covered cards into view.
- `physics-drop-field`: spawn on tap instead of pointerdown (touch scrolling no longer drops chips), fixed 1/60 s Matter steps, jsDelivr URL, listener cleanup, reduced motion stays clickable.
- SKILL.md: English is the default language for generated pages and code comments; read only the chosen pattern section; guidance for ambiguous requests and non-interactive runs.
- Quality gate: split-text accessibility via `.sr-only`, focus on covered elements, gzip JS budget, pause CSS loops and video off screen.
- Examples: Kopi Senja physics closing section and Ruang Lantai stacking cards.

## 0.1.0 — 2026-11-26

- First release: SKILL.md with the core lessons and a 7-step workflow (intake, dissect, pick a pattern, build, quality gate, verify, hand over).
- `motion-core.js` runtime: `damp`, `range`, `createSpring`, `createVelocityTracker`, `ticker` (+ GSAP clock), `stickyProgress`, `passProgress`, `setupSmoothScroll`, `defineSection`.
- Starter template with tokens, pinned sections and a reduced-motion state.
- Library of 17 dissected references (R01–R17) and a guide for dissecting new ones.
- 78 patterns in 6 families (scroll, pointer & gesture, WebGL & 3D, typography, transitions, generative) with a generated index.
- Full-website mode guide and a quality gate with an asset budget.
- Installable with `npx skills add`, as a Claude Code plugin, or with `install.sh`.
