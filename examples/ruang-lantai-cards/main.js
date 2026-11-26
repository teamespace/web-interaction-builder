import { defineSection, clamp, mq } from './motion-core.js';
import { splitText } from './split.js';

/* Every number the team may want to tweak lives here.
 * Sources: R10 Fragment (Recent Work) for the stack, typography.md → masked-split-reveal for the title. */
const CONFIG = {
  stack: {
    stickyTop: 106,        // px, distance of a stuck card from the top of the screen (R10 desktop)
    stickyTopMobile: 76,   // px, at ≤ 767px (R10 mobile)
    gap: 48,               // px, space between cards before they stack (R10 desktop)
    gapMobile: 24,         // px, at ≤ 767px
    cardHeight: 70,        // vh, card height (R10: 70vh). A 360px minimum is set in CSS
    line: 0.5,             // 0..1, the old card starts receding when the next card's top passes this line (0.5 = mid-screen)
    scaleTo: 0.85,         // final scale of the old card (R10: 0.85; 0.85–0.95 is reasonable)
    yTo: 24,               // px, the old card drops slightly (R10: 24)
    shade: 0,              // 0..0.4, dark overlay on the old card. R10 does not use it; try 0.15 for more depth
  },
  title: {
    from: '110%',          // start offset of each word inside its mask (105–140%)
    duration: 0.9,         // seconds per word (0.55–1.2)
    stagger: 80,           // ms between words (55–100)
    ease: 'cubic-bezier(.16, 1, .3, 1)', // expo-out
    rootMargin: '0px 0px -10% 0px',      // start once the title is 10% above the bottom of the viewport
  },
};

const isMobile = mq('(max-width: 767px)');

/* ---------- "Recent work" section: word-by-word title + sticky card stack ---------- */
defineSection(document.querySelector('[data-section="work"]'), (ctx) => {
  const { el } = ctx;
  const S = CONFIG.stack;
  const T = CONFIG.title;
  const cards = [...el.querySelectorAll('.card')];
  const title = el.querySelector('[data-reveal-text]');

  /* CONFIG → CSS variables, so CSS and JS share the same numbers. */
  const applyVars = () => {
    const m = isMobile.matches;
    el.style.setProperty('--stack-top', `${m ? S.stickyTopMobile : S.stickyTop}px`);
    el.style.setProperty('--stack-gap', `${m ? S.gapMobile : S.gap}px`);
    el.style.setProperty('--card-h', String(S.cardHeight));
  };
  applyVars();

  /* ----- title: split into words, each word gets its own mask (no dependence on line breaks) ----- */
  const split = splitText(title);
  split.words.forEach((w, i) => {
    const mask = document.createElement('span');
    mask.className = 'sw-mask';
    w.replaceWith(mask);
    mask.append(w);
    w.classList.add('u');
    w.style.setProperty('--i', i);
  });
  title.style.setProperty('--from', T.from);
  title.style.setProperty('--dur', `${T.duration}s`);
  title.style.setProperty('--stagger', `${T.stagger}ms`);
  title.style.setProperty('--ease', T.ease);
  title.classList.add('is-split');

  let titleIO = null;
  if (ctx.reduced) {
    title.classList.add('is-in');
  } else {
    titleIO = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      title.classList.add('is-in');
      titleIO.disconnect();          // runs once, then the observer is released
      titleIO = null;
    }, { rootMargin: T.rootMargin });
    titleIO.observe(title);
  }

  /* ----- stack: measure each card's NATURAL position (not its stuck position, and without transforms) ----- */
  let starts = [], heights = [], stickyTop = 0;
  let dirty = true, lastY = -1, lastVh = -1;

  const measure = () => {
    const saved = cards.map((c) => c.style.transform);
    cards.forEach((c) => { c.style.position = 'relative'; c.style.transform = 'none'; });
    const y = window.scrollY;
    starts = cards.map((c) => c.getBoundingClientRect().top + y);
    heights = cards.map((c) => c.offsetHeight);
    cards.forEach((c, i) => { c.style.position = ''; c.style.transform = saved[i]; });
    stickyTop = parseFloat(getComputedStyle(cards[0]).top) || 0;
    dirty = true;
  };
  measure();

  const onWindowResize = () => { applyVars(); measure(); };
  window.addEventListener('resize', onWindowResize);
  // Web fonts can change the height of content above the section without resizing the section itself.
  if (document.fonts) document.fonts.ready.then(measure);

  /* Keyboard: a link in a card already covered by later cards is still "in view" geometrically,
   * so the browser does not scroll. Bring the focused card back to its stuck position. */
  const onFocusIn = (e) => {
    const i = cards.findIndex((c) => c.contains(e.target));
    if (i < 0) return;
    const target = starts[i] - stickyTop;
    if (window.scrollY > target + 1) {
      window.scrollTo({ top: target, behavior: ctx.reduced ? 'auto' : 'smooth' });
    }
  };
  el.addEventListener('focusin', onFocusIn);

  return {
    onResize: measure,

    // Scrubbed straight from scroll position (like R10: linear, no spring), so no dt is needed.
    // Styles are only written when scroll position or viewport size changes.
    update() {
      const y = window.scrollY, vh = window.innerHeight;
      if (!dirty && y === lastY && vh === lastVh) return;
      dirty = false; lastY = y; lastVh = vh;

      const lineY = y + vh * S.line;
      for (let i = 0; i < cards.length - 1; i++) {      // the last card never moves
        const p = clamp((lineY - starts[i + 1]) / heights[i + 1]);
        const s = 1 - (1 - S.scaleTo) * p;
        cards[i].style.transform = p > 0
          ? `translate3d(0, ${(S.yTo * p).toFixed(1)}px, 0) scale(${s.toFixed(4)})`
          : '';
        if (S.shade) cards[i].style.setProperty('--shade', (S.shade * p).toFixed(3));
      }
    },

    // Reduced motion: cards still stick and stack (layout), with no scale, drop or shade.
    renderStatic() {
      cards.forEach((c) => { c.style.transform = ''; c.style.removeProperty('--shade'); });
    },

    destroy() {
      window.removeEventListener('resize', onWindowResize);
      el.removeEventListener('focusin', onFocusIn);
      if (titleIO) titleIO.disconnect();
      split.revert();
    },
  };
});
