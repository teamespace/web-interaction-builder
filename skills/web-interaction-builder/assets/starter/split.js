// split.js
// Plugin-free text splitter (see references/patterns/typography.md).
// The original text is kept in .sr-only (read by screen readers); the split visual copy gets aria-hidden.
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
  if (lines) {                                   // group words by visual line (needs layout)
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
