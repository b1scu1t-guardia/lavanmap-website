import { initTheme } from './theme.js';
import { createMap } from './map.js';

const STEPS = 6;
const root = document.documentElement;
const trip = document.querySelector('.trip');
const stage = document.querySelector('.stage');
const steps = [...document.querySelectorAll('.step')];
const calm = matchMedia('(prefers-reduced-motion: reduce)');

const listeners = new Set();
initTheme((theme) => listeners.forEach((f) => f(theme)));

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2'));
  } catch {
    return false;
  }
}

if (calm.matches || !hasWebGL()) {
  root.classList.add('flat');
} else {
  start();
}

async function start() {
  const map = createMap(document.querySelector('.map'), document.querySelector('.van'), STEPS);
  let phone = null;
  let target = 0;
  let current = 0;
  let last = 0;
  let running = false;

  const read = () => {
    const max = trip.offsetHeight - innerHeight;
    target = clamp((scrollY - trip.offsetTop) / max, 0, 1) * (STEPS - 1);
  };

  const show = (p) => {
    const on = Math.round(p);
    steps.forEach((s, i) => {
      s.classList.toggle('is-on', i === on);
      s.classList.toggle('is-past', i < on);
    });
    map.update(p);
  };

  const frame = (now) => {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.0005) current = target;
    show(current);
    const busy = phone ? phone.render(current, dt) : false;
    if (current !== target || busy) requestAnimationFrame(frame);
    else running = false;
  };
  // Rien ne tourne quand rien ne bouge : batterie préservée.
  const wake = () => {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  const onScroll = () => {
    read();
    wake();
  };
  const onResize = () => {
    map.resize(stage.clientWidth, stage.clientHeight);
    phone?.resize(stage.clientWidth, stage.clientHeight);
    onScroll();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  onResize();

  try {
    const { createPhone } = await import('./phone.js');
    phone = await createPhone(document.querySelector('.phone'), root.dataset.theme, wake);
    listeners.add((t) => {
      phone.setTheme(t);
      wake();
    });
    onResize();
  } catch (e) {
    console.error('Téléphone 3D indisponible', e);
    root.classList.add('flat');
  }
}
