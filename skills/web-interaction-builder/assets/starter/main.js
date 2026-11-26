import { defineSection, damp, createSpring } from './motion-core.js';

/* Every number worth tuning lives here. */
const CONFIG = {
  follow: 9,                                // damp lambda: higher sticks closer to the cursor (6–14 is sensible)
  spring: { stiffness: 170, damping: 18 },  // scale on hover
  hoverScale: 1.6,
};

/* Example section: a dot follows the cursor on desktop and rests neatly on touch / reduced motion. */
defineSection(document.querySelector('[data-section="demo"]'), (ctx) => {
  const dot = ctx.el.querySelector('.demo-dot');
  const scale = createSpring({ ...CONFIG.spring, value: 1 });
  let x = 0, y = 0, tx = 0, ty = 0;

  const onMove = (e) => {
    const r = ctx.el.getBoundingClientRect();
    tx = e.clientX - r.left - r.width / 2;
    ty = e.clientY - r.top - r.height / 2;
  };
  const onEnter = () => scale.set(CONFIG.hoverScale);
  const onLeave = () => { scale.set(1); tx = ty = 0; };

  if (ctx.fine) {
    ctx.el.addEventListener('pointermove', onMove);
    ctx.el.addEventListener('pointerenter', onEnter);
    ctx.el.addEventListener('pointerleave', onLeave);
  }

  return {
    update(dt) {
      x = damp(x, tx, CONFIG.follow, dt);
      y = damp(y, ty, CONFIG.follow, dt);
      dot.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.step(dt).toFixed(3)})`;
    },
    renderStatic() {
      dot.style.transform = 'none';
    },
    destroy() {
      ctx.el.removeEventListener('pointermove', onMove);
      ctx.el.removeEventListener('pointerenter', onEnter);
      ctx.el.removeEventListener('pointerleave', onLeave);
    },
  };
});
