// Lieux posés le long de la route : étape, côté, type.
const PINS = [
  [0.55, 1, 'sleep'], [0.9, -1, 'eat'], [1.12, 1, 'both'], [1.5, -1, 'sleep'], [2.1, 1, 'sleep'],
  [2.6, -1, 'both'], [3.05, 1, 'eat'], [3.5, -1, 'sleep'], [4.1, 1, 'sleep'], [4.55, -1, 'eat'],
  [4.8, 1, 'both'], [5.1, -1, 'sleep'],
];

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
  const path = new Path2D();
  path.moveTo(...mid(pts[n - 1], pts[0]));
  pts.forEach((p, i) => path.quadraticCurveTo(...p, ...mid(p, pts[(i + 1) % n])));
  path.closePath();
  const pad = ry * 1.25;
  return { path, top: cy - pad, bottom: cy + pad };
}

const overshoot = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/**
 * La carte dessinée de l'app, dans un seul canevas de la taille de l'écran :
 * seules les formes visibles sont tracées, au lieu d'une image six fois plus haute.
 */
export function createMap(canvas, vanSrc, steps) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const van = new Image();
  let vanReady = false;
  let w = 0, h = 0, ratio = 1, wide = true;
  let areas = [], small = [], road = null, pins = [], colors = {}, badges = {};

  const roadX = (t) =>
    wide
      ? 0.53 * w + Math.sin(t * 1.9 + 0.5) * w * 0.085 + Math.sin(t * 4.3) * w * 0.02
      : 0.115 * w + Math.sin(t * 2.4) * w * 0.035;
  const vanY = () => h * (wide ? 0.62 : 0.4);
  const yOf = (t) => vanY() + t * h;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    for (const k of ['land', 'water', 'park', 'road', 'road-edge', 'main', 'main-edge', 'sleep', 'eat', 'both']) {
      colors[k] = s.getPropertyValue(`--${k}`).trim();
    }
    for (const type of ['sleep', 'eat', 'both']) badges[type] = badge(type);
  }

  /** Chaque pastille est dessinée une fois, puis recopiée. */
  function badge(type) {
    const r = wide ? 25 : 19;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(r * 2 * ratio);
    const x = c.getContext('2d');
    x.scale(ratio, ratio);
    const disc = (radius, color) => {
      x.beginPath();
      x.arc(r, r, radius, 0, Math.PI * 2);
      x.fillStyle = color;
      x.fill();
    };
    disc(r, '#fff');
    disc(r * 0.8, colors[type]);
    x.translate(r, r);
    x.scale(r / 25, r / 25);
    const p = new Path2D(
      type === 'sleep'
        ? 'M3 -10A10 10 0 1 0 9 6A9 9 0 0 1 3 -10Z'
        : type === 'eat'
          ? 'M-5 -9V10M-9 -9V-3H-1V-9M6 10V-9C2 -6 2 0 6 1'
          : 'M-10 5V-5H4L10 1V5ZM-5 5v3M6 5v3',
    );
    x.lineWidth = 2.6;
    x.lineCap = x.lineJoin = 'round';
    x.strokeStyle = x.fillStyle = '#fff';
    if (type === 'sleep') x.fill(p);
    else x.stroke(p);
    return c;
  }

  function build() {
    const rnd = seeded(7411);
    areas = [];
    small = [];
    for (let s = -0.2; s < steps + 0.4; s += 0.42) {
      const right = rnd() > 0.35;
      const cx = (right ? 0.72 + rnd() * 0.3 : -0.06 + rnd() * 0.04) * w;
      areas.push({ ...blob(cx, s * h, w * 0.16, h * 0.2, rnd), color: 'park' });
    }
    for (let s = 0; s < steps; s += 2) {
      areas.push({ ...blob(w * (wide ? 0.86 : 0.8), (s + 0.55) * h, w * (wide ? 0.21 : 0.36), h * 0.4, rnd, 11), color: 'water' });
    }
    areas.push({ ...blob(-0.02 * w, 2.95 * h, w * 0.11, h * 0.2, rnd), color: 'water' });
    areas.push({ ...blob(-0.02 * w, 4.95 * h, w * 0.12, h * 0.22, rnd), color: 'water' });

    for (let t = -0.5; t < steps; t += 0.3) {
      const x = roadX(t), y = yOf(t);
      // Jamais sous le texte : à gauche, seulement entre deux étapes.
      const between = ((t % 1) + 1) % 1;
      const dir = between > 0.24 && between < 0.52 ? -1 : 1;
      const end = dir > 0 ? w + 40 : -40;
      const ey = y + (rnd() - 0.5) * h * (dir < 0 ? 0.08 : 0.5);
      const bend = dir < 0 ? 40 : 160;
      const path = new Path2D();
      path.moveTo(x, y);
      path.bezierCurveTo(x + (end - x) * 0.35, y + (rnd() - 0.5) * bend, x + (end - x) * 0.6, ey + (rnd() - 0.5) * bend, end, ey);
      small.push({ path, top: Math.min(y, ey) - 110, bottom: Math.max(y, ey) + 110 });
    }
    // La route, par tronçons d'une demi-étape.
    road = [];
    for (let t = -1.2; t < steps; t += 0.5) {
      const path = new Path2D();
      for (let k = 0; k <= 25; k++) {
        const u = t + k * 0.0204;
        path[k ? 'lineTo' : 'moveTo'](roadX(u), yOf(u));
      }
      road.push({ path, top: yOf(t) - 40, bottom: yOf(t + 0.51) + 40 });
    }
    pins = PINS.map(([t, side, type], i) => ({
      t, type, x: roadX(t) + (wide ? side * 78 : 48), y: yOf(t), on: pins[i]?.on ?? 0,
    }));
  }

  van.onload = () => {
    vanReady = true;
    api.onReady?.();
  };
  van.src = vanSrc;

  const api = {
    onReady: null,
    resize(nw, nh) {
      const r = Math.min(devicePixelRatio || 1, nw > 820 ? 1.5 : 2);
      if (nw === w && nh === h && r === ratio) return;
      w = nw;
      h = nh;
      ratio = r;
      wide = w > 820;
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      readColors();
      build();
    },
    setTheme: readColors,
    /** Renvoie vrai tant qu'une pastille s'anime. */
    draw(p, dt) {
      const top = p * h, bottom = top + h;
      const seen = (o) => o.bottom > top && o.top < bottom;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = colors.land;
      ctx.fillRect(0, 0, w, h);
      ctx.translate(0, -top);
      for (const a of areas) {
        if (!seen(a)) continue;
        ctx.fillStyle = colors[a.color];
        ctx.fill(a.path);
      }
      ctx.lineCap = ctx.lineJoin = 'round';
      const near = small.filter(seen);
      for (const [width, color] of [[13, 'road-edge'], [9, 'road']]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colors[color];
        for (const s of near) ctx.stroke(s.path);
      }
      const main = road.filter(seen);
      const rw = wide ? 44 : 32;
      for (const [width, color] of [[rw + 7, 'main-edge'], [rw, 'main']]) {
        ctx.lineWidth = width;
        ctx.strokeStyle = colors[color];
        for (const s of main) ctx.stroke(s.path);
      }
      let busy = false;
      const r = wide ? 25 : 19;
      for (const pin of pins) {
        const want = p > pin.t - 0.42 ? 1 : 0;
        if (pin.on !== want) {
          pin.on = want ? Math.min(1, pin.on + dt * 2.4) : Math.max(0, pin.on - dt * 4);
          busy = true;
        }
        if (pin.on === 0 || pin.y < top - r || pin.y > bottom + r) continue;
        const k = r * overshoot(pin.on);
        ctx.drawImage(badges[pin.type], pin.x - k, pin.y - k, k * 2, k * 2);
      }
      if (vanReady) {
        const x = roadX(p);
        const a = Math.atan2(yOf(p + 0.03) - yOf(p), roadX(p + 0.03) - x) + Math.PI / 2;
        const vw = wide ? 46 : 28, vh = (vw * van.naturalHeight) / van.naturalWidth;
        ctx.translate(x, top + vanY());
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(0, 20, 10, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 0, vw * 0.56, vh * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(van, -vw / 2, -vh / 2, vw, vh);
      }
      return busy;
    },
  };
  return api;
}
