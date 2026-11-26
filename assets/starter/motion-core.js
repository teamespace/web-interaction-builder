/* motion-core.js
 * Runtime kecil yang dipakai bersama oleh semua section interaksi.
 * Isinya pola yang muncul berulang di bedah R01–R17 (lihat references/library.md):
 * smoothing berbasis waktu, spring tulis tangan, kecepatan lempar 100 ms terakhir,
 * satu rAF loop, kontrak lifecycle + pause di luar layar, dan helper progress scroll.
 * Tanpa dependency. Kalau halaman pakai GSAP, panggil ticker.useGsap(gsap) supaya
 * semua jalan di satu clock dengan ScrollTrigger/Lenis.
 */

/* ---------- media query ---------- */
export const mq = (q) => window.matchMedia(q);
export const reducedMotion = () => mq('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => mq('(hover: hover) and (pointer: fine)').matches;
export const smallScreen = () => mq('(max-width: 767px)').matches;

/* ---------- math ---------- */
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, inMin, inMax, outMin = 0, outMax = 1) =>
  outMin + (outMax - outMin) * clamp((v - inMin) / (inMax - inMin));

/** Progress lokal 0..1 di dalam jendela [a, b] dari progress global p (pola "tabel range" R02/R03/R12). */
export const range = (p, a, b) => clamp((p - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);

/**
 * Smoothing yang tidak bergantung frame-rate. lambda kira-kira "per detik".
 * Contoh: x = damp(x, target, 8, dt). Jangan pakai lerp(x, target, 0.1) per frame:
 * itu jalan 2x lebih cepat di layar 120 Hz (bug yang ketemu di R06 Scroll Bend).
 */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Konversi "follow factor per frame @60fps" dari referensi (mis. 0.12) ke lambda untuk damp(). */
export const followToLambda = (f) => -Math.log(1 - f) * 60;

export const ease = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

/* ---------- spring ---------- */
/**
 * Spring 1D (semi-implicit Euler, di-substep 120 Hz supaya stabil di stiffness tinggi).
 * Nilai yang sering dipakai referensi: stiffness 70–170, damping 9–26.
 */
export function createSpring({ stiffness = 170, damping = 26, mass = 1, value = 0 } = {}) {
  let x = value;
  let v = 0;
  let target = value;
  return {
    get value() { return x; },
    get velocity() { return v; },
    get target() { return target; },
    set(t) { target = t; },
    snap(t) { x = target = t; v = 0; },
    kick(impulse) { v += impulse; },
    isSettled(eps = 1e-3) { return Math.abs(x - target) < eps && Math.abs(v) < eps; },
    step(dt) {
      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const a = (-stiffness * (x - target) - damping * v) / mass;
        v += a * h;
        x += v * h;
      }
      return x;
    },
  };
}

/* ---------- pointer velocity (fling / lempar) ---------- */
/**
 * Kecepatan pointer dari sampel windowMs terakhir. Kalau pointer sudah diam lebih dari
 * staleMs sebelum dilepas, kecepatan dianggap 0 (pola R06 Light Table / Infinite Grid).
 */
export function createVelocityTracker({ windowMs = 100, staleMs = 80 } = {}) {
  const samples = [];
  return {
    reset() { samples.length = 0; },
    add(x, y, t = performance.now()) {
      samples.push({ x, y, t });
      while (samples.length > 2 && t - samples[0].t > windowMs) samples.shift();
    },
    /** px per detik */
    get(now = performance.now()) {
      if (samples.length < 2) return { x: 0, y: 0 };
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (now - last.t > staleMs) return { x: 0, y: 0 };
      const dt = Math.max((last.t - first.t) / 1000, 1 / 120);
      return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    },
  };
}

/* ---------- satu loop untuk semua ---------- */
/** Callback menerima (dt detik, time detik). dt dibatasi 1/20 s supaya tidak loncat setelah tab kembali aktif. */
export const ticker = (() => {
  const subs = new Set();
  let raf = 0;
  let last = 0;
  let gsapRef = null;

  const run = (dt, time) => subs.forEach((fn) => fn(Math.min(dt, 1 / 20), time));
  const loop = (now) => {
    run((now - last) / 1000, now / 1000);
    last = now;
    raf = subs.size ? requestAnimationFrame(loop) : 0;
  };
  const start = () => {
    if (gsapRef || raf || !subs.size) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };

  return {
    add(fn) { subs.add(fn); start(); return () => subs.delete(fn); },
    remove(fn) { subs.delete(fn); },
    /** Pindahkan clock ke gsap.ticker supaya sinkron dengan ScrollTrigger dan Lenis. */
    useGsap(gsap) {
      if (gsapRef) return;
      gsapRef = gsap;
      cancelAnimationFrame(raf);
      raf = 0;
      gsap.ticker.add((time, deltaMs) => run(deltaMs / 1000, time));
    },
  };
})();

/* ---------- scroll progress ---------- */
/**
 * Untuk section tinggi (mis. 400vh) yang isinya position: sticky.
 * 0 saat top section menyentuh top viewport, 1 saat bottom section menyentuh bottom viewport.
 */
export function stickyProgress(el) {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  return total > 0 ? clamp(-r.top / total) : 0;
}

/** 0 saat top elemen masuk dari bawah viewport, 1 saat bottom elemen keluar di atas viewport. */
export function passProgress(el) {
  const r = el.getBoundingClientRect();
  return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
}

/* ---------- smooth scroll ---------- */
/** Lenis opsional. Tidak dinyalakan saat reduced-motion (pelajaran R08/R09). */
export function setupSmoothScroll({ Lenis, gsap, ScrollTrigger, lerp: l = 0.1 } = {}) {
  if (!Lenis || reducedMotion()) return null;
  const lenis = new Lenis({ lerp: l });
  if (gsap && ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    ticker.add((_dt, t) => lenis.raf(t * 1000));
  }
  return lenis;
}

/* ---------- kontrak lifecycle section ---------- */
/**
 * Kontrak dari R06 Interaction Library: setup → jalan hanya saat terlihat → destroy.
 *
 * setup(ctx) dipanggil sekali dan mengembalikan objek opsional:
 *   update(dt, time)  dipanggil tiap frame selama section terlihat
 *   onResize()        dipanggil saat ukuran section berubah
 *   renderStatic()    state akhir yang rapi untuk reduced-motion (kalau ada, update tidak dijalankan)
 *   destroy()         bersih-bersih listener/WebGL
 *
 * ctx = { el, reduced, fine, small }
 */
export function defineSection(el, setup, { rootMargin = '15% 0px' } = {}) {
  const ctx = { el, reduced: reducedMotion(), fine: finePointer(), small: smallScreen() };
  const api = setup(ctx) || {};
  const animate = !(ctx.reduced && api.renderStatic);
  if (!animate) api.renderStatic();

  let off = null;
  const io = new IntersectionObserver(([entry]) => {
    if (!animate || !api.update) return;
    if (entry.isIntersecting && !off) off = ticker.add(api.update);
    else if (!entry.isIntersecting && off) { off(); off = null; }
  }, { rootMargin });
  io.observe(el);

  const ro = api.onResize ? new ResizeObserver(() => api.onResize()) : null;
  if (ro) ro.observe(el);

  return {
    destroy() {
      io.disconnect();
      if (ro) ro.disconnect();
      if (off) off();
      if (api.destroy) api.destroy();
    },
  };
}
