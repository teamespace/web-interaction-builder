import { defineSection, clamp, smallScreen } from './motion-core.js';

/* ==========================================================================
 * Kopi Senja · closing section "physics-drop-field"
 * Reference: R14 FORMAT (Obys) https://format.obys.agency (the .field block)
 * Every number worth tweaking lives in CONFIG. Default physics values = R14.
 * ========================================================================== */
const CONFIG = {
  physics: {
    gravity: 1,          // Matter gravity.y (default scale 0.001). 1 = R14. 2–3 = chips fall "heavier"
    restitution: 0.15,   // bounciness. 0.03 = sticky (R07), 0.3+ = bouncy
    friction: 0.4,       // chip-to-chip friction. Raise (0.6–0.9) if the pile keeps sliding
    frictionAir: 0.01,   // air drag. Raise for a slower, floatier fall
  },
  spawn: {
    lift: 0.35,          // chip spawns slightly above the click point (× chip height), R14
    angle: 0.2,          // random start angle ±rad, R14
    artboard: 1440,      // chip sizes in CONFIG.chips are px for a 1440-wide screen
    minScale: 0.55,      // lower scale bound on small screens
    maxScale: 1.15,      // upper scale bound on large screens
    minSide: 48,         // shortest chip side is at least 48 px (touch target + legibility)
    cornerRadius: 14,    // corner radius of "rect" chips (px @1440), used by collider + CSS
  },
  maxChips: { desktop: 30, small: 18 }, // FIFO: oldest chip is removed past the cap
  scrollFlip: {
    enabled: true,
    threshold: 0.15,     // scroll speed (viewport heights per second) that flips gravity, R14
    gravity: -0.2,       // gravity during fast scroll: chips drift up; those leaving the top are removed
  },
  intro: {
    duration: 0.9,       // words rise out of their mask (seconds), R14
    stagger: 0.13,       // delay between words (seconds), R14
    threshold: 0.25,     // fraction of the field visible before the words rise
  },
  tap: { maxMove: 10, maxMs: 320 },     // touch: spawn only on a real tap, not at the start of a scroll
  stepMs: 1000 / 60,     // Matter 0.20 recommends delta ≤ 1000/60 ms per update → long frames are sub-stepped
  reducedPresimSteps: 240, // reduced motion: chips are pre-simulated to rest, no visible fall

  /* Chip catalogue. Placeholders: change `label`/`tone`, or set `src` to an image (webp / transparent png).
   * shape: 'rect' | 'pill' (stadium) | 'circle' | 'tri' (triangle; height derived from w).
   * tone : 'cream' | 'caramel' | 'brown' | 'dark' (colours in style.css). */
  chips: [
    { kind: 'photo',   shape: 'rect',   w: 220, h: 290, tone: 'cream',   label: 'Product photo' },
    { kind: 'photo',   shape: 'rect',   w: 290, h: 210, tone: 'caramel', label: 'Ambience photo' },
    { kind: 'pill',    shape: 'pill',   w: 330, h: 88,  tone: 'caramel', label: 'Senja Milk Coffee' },
    { kind: 'pill',    shape: 'pill',   w: 290, h: 88,  tone: 'cream',   label: 'Iced Palm Sugar' },
    { kind: 'stamp',   shape: 'circle', w: 180, h: 180, tone: 'cream',   label: 'KS' },
    { kind: 'bean',    shape: 'pill',   w: 120, h: 170, tone: 'brown',   label: '' },
    { kind: 'tri',     shape: 'tri',    w: 190,         tone: 'caramel', label: '' },
    { kind: 'sticker', shape: 'rect',   w: 170, h: 170, tone: 'dark',    label: 'Open 7–22' },
  ],
};

const SQRT3 = Math.sqrt(3);

defineSection(document.querySelector('[data-section="closing"]'), (ctx) => {
  const field = ctx.el.querySelector('[data-drop-field]');
  const layer = field.querySelector('.field__chips');
  const dropBtn = field.querySelector('[data-drop]');
  const clearBtn = field.querySelector('[data-clear]');

  /* ---------- word intro: rises once, then the CSS blink runs only while visible ---------- */
  let upTimer = 0;
  const introIO = new IntersectionObserver(([entry]) => {
    field.classList.toggle('is-offscreen', !entry.isIntersecting);   // pause CSS animation off-screen
    if (entry.isIntersecting && !field.classList.contains('is-in')) {
      field.classList.add('is-in');
      const total = (CONFIG.intro.duration + CONFIG.intro.stagger * 3) * 1000;
      if (!ctx.reduced) upTimer = setTimeout(() => field.classList.add('is-up'), total);
    }
  }, { threshold: CONFIG.intro.threshold });
  introIO.observe(field);
  field.style.setProperty('--intro-dur', `${CONFIG.intro.duration}s`);
  field.style.setProperty('--intro-stagger', `${CONFIG.intro.stagger}s`);

  /* ---------- no Matter (CDN failed): static view, buttons hidden ---------- */
  const M = window.Matter;
  if (!M) {
    field.classList.add('is-in', 'no-physics');
    return { destroy() { introIO.disconnect(); clearTimeout(upTimer); } };
  }
  const { Engine, Bodies, Body, Composite } = M;

  /* ---------- engine: one per field, NO Runner (stepped from the page clock) ---------- */
  const engine = Engine.create();
  engine.gravity.y = CONFIG.physics.gravity;
  const chips = [];
  let walls = [];
  let lastSpec = -1;

  const buildWalls = () => {                                   // floor + 2 tall walls, deliberately no ceiling
    const w = field.clientWidth, h = field.clientHeight, S = { isStatic: true };
    Composite.remove(engine.world, walls);
    walls = [
      Bodies.rectangle(w / 2, h + 100, w + 400, 200, S),
      Bodies.rectangle(-100, h / 2, 200, h * 3, S),
      Bodies.rectangle(w + 100, h / 2, 200, h * 3, S),
    ];
    Composite.add(engine.world, walls);
  };
  buildWalls();

  const step = (ms) => {                                        // sub-step so each update is ≤ CONFIG.stepMs
    const n = Math.max(1, Math.ceil(ms / CONFIG.stepMs - 1e-6));
    for (let i = 0; i < n; i++) Engine.update(engine, ms / n);
  };

  const place = (c) => {                                        // body position → DOM transform (offset rotated with the angle)
    const { x, y } = c.body.position, a = c.body.angle, cos = Math.cos(a), sin = Math.sin(a);
    const tx = x + c.offX * cos - c.offY * sin;
    const ty = y + c.offX * sin + c.offY * cos;
    c.node.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotate(${a.toFixed(4)}rad)`;
  };

  const kill = (c) => {
    Composite.remove(engine.world, c.body);
    c.node.remove();
    chips.splice(chips.indexOf(c), 1);
  };

  const makeNode = (spec, w, h, s) => {
    const node = document.createElement('div');
    node.className = `chip chip--${spec.kind}`;
    node.dataset.tone = spec.tone;
    node.dataset.shape = spec.shape;
    Object.assign(node.style, {
      width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px`,   // origin at the centre
    });
    node.style.setProperty('--r', `${CONFIG.spawn.cornerRadius * s}px`);
    node.style.setProperty('--fs', `${Math.max(12, 22 * s).toFixed(1)}px`);
    if (spec.src) {
      node.append(Object.assign(new Image(), { src: spec.src, alt: '', decoding: 'async', draggable: false }));
    } else if (spec.label) {
      const span = document.createElement('span');
      span.className = 'chip__label';
      span.textContent = spec.label;
      node.append(span);
    }
    return node;
  };

  const spawn = (x, y) => {
    let idx = (Math.random() * CONFIG.chips.length) | 0;
    if (idx === lastSpec) idx = (idx + 1) % CONFIG.chips.length;   // never the same chip twice in a row
    lastSpec = idx;
    const spec = CONFIG.chips[idx], sp = CONFIG.spawn;

    // size: 1440 artboard scale, clamped, shortest side ≥ minSide
    const baseH = spec.shape === 'tri' ? (spec.w / 1.5) * SQRT3 : spec.h;
    const k = clamp(innerWidth / sp.artboard, sp.minScale, sp.maxScale);
    const s = Math.max(k, sp.minSide / Math.min(spec.w, baseH));
    const w = spec.w * s, h = baseH * s;

    const fw = field.clientWidth;
    x = w < fw ? clamp(x, w / 2 + 2, fw - w / 2 - 2) : fw / 2;     // never spawn inside a wall
    y -= h * sp.lift;

    const { restitution, friction, frictionAir } = CONFIG.physics, opt = { restitution, friction, frictionAir };
    let body, offX = 0, offY = 0;
    if (spec.shape === 'circle') body = Bodies.circle(x, y, w / 2, opt);
    else if (spec.shape === 'tri') {
      const r = w / 1.5;                                          // Bodies.polygon(3): left vertex (−r,0), right vertices (r/2, ±0.866r)
      body = Bodies.polygon(x, y, 3, r, opt);
      offX = -0.25 * r;                                           // image box centre relative to the body centroid
    } else {
      const radius = spec.shape === 'pill' ? Math.min(w, h) / 2 - 0.01 : Math.min(sp.cornerRadius * s, Math.min(w, h) / 2 - 0.01);
      body = Bodies.rectangle(x, y, w, h, { ...opt, chamfer: { radius } });
    }
    Body.setAngle(body, (Math.random() * 2 - 1) * sp.angle);

    const node = makeNode(spec, w, h, s);
    const c = { body, node, offX, offY };
    layer.append(node);
    Composite.add(engine.world, body);
    chips.push(c);
    place(c);                                                     // placed right away, no flash at (0,0)

    const cap = smallScreen() ? CONFIG.maxChips.small : CONFIG.maxChips.desktop;
    while (chips.length > cap) kill(chips[0]);

    field.classList.add('is-played');                             // text fades after the first drop
    if (ctx.reduced) {                                            // reduced: no fall animation, settle instantly
      for (let i = 0; i < CONFIG.reducedPresimSteps; i++) Engine.update(engine, CONFIG.stepMs);
      chips.forEach(place);
    }
  };

  /* ---------- input: mouse = instant pointerdown (R14); touch/pen = tap only ---------- */
  const toLocal = (e) => {
    const r = field.getBoundingClientRect(), sc = r.width / field.offsetWidth || 1;   // safe even if a parent is scaled
    return [(e.clientX - r.left) / sc, (e.clientY - r.top) / sc];
  };
  let tap = null;
  const onDown = (e) => {
    if (e.button > 0 || e.target.closest('button, a')) return;
    if (e.pointerType === 'mouse') { spawn(...toLocal(e)); return; }
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onUp = (e) => {
    if (!tap || e.pointerId !== tap.id) return;
    const ok = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= CONFIG.tap.maxMove
      && performance.now() - tap.t <= CONFIG.tap.maxMs;
    tap = null;
    if (ok) spawn(...toLocal(e));
  };
  const onCancel = () => { tap = null; };                         // the browser took over for scrolling
  const onDrop = () => {                                          // keyboard / button: random x, from the top of the field
    spawn(field.clientWidth * (0.15 + Math.random() * 0.7), field.clientHeight * 0.18);
  };
  const onClear = () => {
    while (chips.length) kill(chips[0]);
    field.classList.remove('is-played');
  };

  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onCancel);
  dropBtn.addEventListener('click', onDrop);
  clearBtn.addEventListener('click', onClear);

  /* ---------- loop ---------- */
  let lastY = scrollY, lastT = -1;

  return {
    onResize: buildWalls,

    update(dt, time) {
      // Measure scroll speed first. The first frame after the section becomes active again (gap > 0.1 s)
      // is ignored, so a stale lastY is not read as a super-fast scroll.
      const y = scrollY, fresh = time - lastT < 0.1;
      const speed = fresh ? Math.abs(y - lastY) / Math.max(dt, 1 / 240) / innerHeight : 0;
      lastY = y; lastT = time;

      const flip = CONFIG.scrollFlip;
      engine.gravity.y = flip.enabled && speed > flip.threshold ? flip.gravity : CONFIG.physics.gravity;

      if (!chips.length) return;
      step(dt * 1000);                                            // dt is already capped at 1/20 s by the ticker

      const h = field.clientHeight;
      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i], py = c.body.position.y;
        if (py < -h || py > h + 600) kill(c);                     // flew out the top / escaped below
        else place(c);
      }
    },

    // Reduced motion: no loop at all. Text is shown still; clicks still add chips that appear already at rest.
    renderStatic() {
      field.classList.add('is-in', 'is-static');
    },

    destroy() {
      introIO.disconnect();
      clearTimeout(upTimer);
      field.removeEventListener('pointerdown', onDown);
      field.removeEventListener('pointerup', onUp);
      field.removeEventListener('pointercancel', onCancel);
      dropBtn.removeEventListener('click', onDrop);
      clearBtn.removeEventListener('click', onClear);
      while (chips.length) kill(chips[0]);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
});
