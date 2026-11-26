// pointer-kit.js
// One input path for mouse and touch (Pointer Events), used by the drag/throw/draw
// recipes in references/patterns/pointer-gesture.md.
import { createVelocityTracker } from './motion-core.js';

/**
 * bindDrag(el, { onStart, onMove, onEnd, onTap, slop })
 *   onStart(e)            pointer went down on el
 *   onMove(dx, dy, e)     pointer moved after passing the slop distance (drag started)
 *   onEnd(velocity, e)    pointer released; velocity {x, y} in px/s from the last 100 ms, {0,0} for a tap
 *   onTap(e)              short press without movement (< 320 ms). On touch this is the safe place to
 *                         spawn things, because pointerdown also fires when a scroll starts.
 * Returns an unbind function.
 */
export function bindDrag(el, { onStart, onMove, onEnd, onTap, slop = 6 } = {}) {
  const vt = createVelocityTracker();
  let id = null, x0 = 0, y0 = 0, lx = 0, ly = 0, t0 = 0, moved = false;

  const down = (e) => {
    if (id !== null || e.button > 0) return;
    id = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY; t0 = performance.now(); moved = false;
    vt.reset(); vt.add(lx, ly);
    if (onStart) onStart(e);
  };
  const move = (e) => {
    if (e.pointerId !== id) return;
    const s = e.pointerType === 'mouse' ? slop : slop * 1.7; // touch: about 10 px
    if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) > s) {
      moved = true;
      el.setPointerCapture(id);
    }
    if (moved && onMove) onMove(e.clientX - lx, e.clientY - ly, e);
    lx = e.clientX; ly = e.clientY; vt.add(lx, ly);
  };
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (onEnd) onEnd(moved && e.type === 'pointerup' ? vt.get() : { x: 0, y: 0 }, e);
    if (!moved && e.type === 'pointerup' && performance.now() - t0 < 320 && onTap) onTap(e);
  };
  // Block the click that follows a drag, so dragging a link doesn't open it.
  const guard = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };

  el.addEventListener('pointerdown', down);
  el.addEventListener('click', guard, true);
  const win = [['pointermove', move], ['pointerup', up], ['pointercancel', up]];
  win.forEach(([t, f]) => window.addEventListener(t, f)); // keep events when the pointer leaves el

  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('click', guard, true);
    win.forEach(([t, f]) => window.removeEventListener(t, f));
  };
}
