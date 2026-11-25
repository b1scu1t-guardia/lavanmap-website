const NS = 'http://www.w3.org/2000/svg';
const COLORS = { sleep: 'var(--sleep)', eat: 'var(--eat)', both: 'var(--both)' };

// Lieux posés le long de la route : étape, côté, type.
const PINS = [
  [0.55, 1, 'sleep'], [0.9, -1, 'eat'], [1.12, 1, 'both'], [1.5, -1, 'sleep'], [2.1, 1, 'sleep'],
  [2.6, -1, 'both'], [3.05, 1, 'eat'], [3.5, -1, 'sleep'], [4.1, 1, 'sleep'], [4.55, -1, 'eat'],
  [4.8, 1, 'both'], [5.1, -1, 'sleep'],
];

const el = (name, attrs, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.append(n);
  return n;
};

// Suite pseudo-aléatoire fixe : la carte est la même à chaque visite.
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function blob(cx, cy, rx, ry, rnd, n = 9) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.75 + rnd() * 0.45;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = '';
  pts.forEach((p, i) => {
    const next = pts[(i + 1) % n];
    const m = mid(p, next);
    if (i === 0) d += `M${mid(pts[n - 1], p).map(Math.round)}`;
    d += `Q${p.map(Math.round)} ${m.map(Math.round)}`;
  });
  return d + 'Z';
}

/** La carte dessinée de l'app : elle défile sous le van, toujours sur la route. */
export function createMap(svg, van, steps) {
  let w = 0, h = 0, height = 0, samples = [], pins = [], wide = true;

  const roadX = (t) =>
    wide
      ? 0.53 * w + Math.sin(t * 1.9 + 0.5) * w * 0.085 + Math.sin(t * 4.3) * w * 0.02
      : 0.115 * w + Math.sin(t * 2.4) * w * 0.035;
  const vanY = () => h * (wide ? 0.62 : 0.4);
  const yOf = (t) => vanY() + t * h;

  function build() {
    const rnd = seeded(7411);
    svg.replaceChildren();
    height = (steps + 0.6) * h;
    svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
    svg.style.height = `${height}px`;

    for (let s = -0.2; s < steps + 0.4; s += 0.42) {
      const right = rnd() > 0.35;
      el('path', { d: blob((right ? 0.72 + rnd() * 0.3 : -0.06 + rnd() * 0.04) * w, s * h, w * 0.16, h * 0.2, rnd), fill: 'var(--park)' }, svg);
    }
    // Un grand lac à droite, derrière le téléphone, une étape sur deux.
    for (let s = 0; s < steps; s += 2) {
      el('path', { d: blob(w * (wide ? 0.86 : 0.8), (s + 0.55) * h, w * (wide ? 0.21 : 0.36), h * 0.4, rnd, 11), fill: 'var(--water)' }, svg);
    }
    el('path', { d: blob(w * -0.02, 2.95 * h, w * 0.11, h * 0.2, rnd), fill: 'var(--water)' }, svg);
    el('path', { d: blob(w * -0.02, 4.95 * h, w * 0.12, h * 0.22, rnd), fill: 'var(--water)' }, svg);

    // Petites routes, qui partent toutes de la principale.
    let small = '';
    for (let t = -0.5; t < steps; t += 0.3) {
      const x = roadX(t), y = yOf(t);
      // Jamais sous le texte : à gauche, seulement entre deux étapes.
      const between = ((t % 1) + 1) % 1;
      const dir = between > 0.24 && between < 0.52 ? -1 : 1;
      const end = dir > 0 ? w + 40 : -40;
      const ey = y + (rnd() - 0.5) * h * (dir < 0 ? 0.08 : 0.5);
      const bend = dir < 0 ? 40 : 160;
      small += `M${x} ${y}C${x + (end - x) * 0.35} ${y + (rnd() - 0.5) * bend} ${x + (end - x) * 0.6} ${ey + (rnd() - 0.5) * bend} ${end} ${ey}`;
    }
    el('path', { d: small, fill: 'none', stroke: 'var(--road-edge)', 'stroke-width': 13, 'stroke-linecap': 'round' }, svg);
    el('path', { d: small, fill: 'none', stroke: 'var(--road)', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);

    let d = '';
    samples = [];
    for (let t = -1.2; t <= steps; t += 0.02) {
      d += `${d ? 'L' : 'M'}${roadX(t).toFixed(1)} ${yOf(t).toFixed(1)}`;
    }
    const road = wide ? 44 : 32;
    el('path', { d, fill: 'none', stroke: 'var(--main-edge)', 'stroke-width': road + 7, 'stroke-linejoin': 'round' }, svg);
    el('path', { d, fill: 'none', stroke: 'var(--main)', 'stroke-width': road, 'stroke-linejoin': 'round' }, svg);

    pins = PINS.map(([t, side, type]) => {
      const g = el('g', { class: 'pin' }, svg);
      const x = roadX(t) + (wide ? side * 78 : 48), y = yOf(t);
      el('circle', { cx: x, cy: y, r: wide ? 25 : 19, fill: '#fff' }, g);
      el('circle', { cx: x, cy: y, r: wide ? 20 : 15, fill: COLORS[type] }, g);
      el('path', { d: icon(type, x, y, wide ? 1 : 0.75), fill: type === 'sleep' ? '#fff' : 'none', stroke: '#fff', 'stroke-width': type === 'sleep' ? 0 : 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      return { t, g };
    });
  }

  function icon(type, x, y, k) {
    const p = (dx, dy) => `${(x + dx * k).toFixed(1)} ${(y + dy * k).toFixed(1)}`;
    if (type === 'sleep') return `M${p(3, -10)}A${10 * k} ${10 * k} 0 1 0 ${p(9, 6)}A${9 * k} ${9 * k} 0 0 1 ${p(3, -10)}Z`;
    if (type === 'eat') return `M${p(-5, -9)}V${(y + 10 * k).toFixed(1)}M${p(-9, -9)}V${(y - 3 * k).toFixed(1)}H${(x - 1 * k).toFixed(1)}V${(y - 9 * k).toFixed(1)}M${p(6, 10)}V${(y - 9 * k).toFixed(1)}C${p(2, -6)} ${p(2, 0)} ${p(6, 1)}`;
    return `M${p(-10, 5)}V${(y - 5 * k).toFixed(1)}H${(x + 4 * k).toFixed(1)}L${p(10, 1)}V${(y + 5 * k).toFixed(1)}ZM${p(-5, 5)}v${3 * k}M${p(6, 5)}v${3 * k}`;
  }

  return {
    resize(nw, nh) {
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      wide = w > 820;
      build();
    },
    update(p) {
      svg.style.transform = `translate3d(0, ${(-p * h).toFixed(2)}px, 0)`;
      const x = roadX(p);
      const a = Math.atan2(yOf(p + 0.03) - yOf(p), roadX(p + 0.03) - x);
      van.style.transform = `translate3d(${x}px, ${vanY()}px, 0) translate(-50%, -50%) rotate(${a + Math.PI / 2}rad)`;
      for (const pin of pins) pin.g.classList.toggle('is-on', p > pin.t - 0.42);
    },
  };
}
