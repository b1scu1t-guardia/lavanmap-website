import {
  AmbientLight, DirectionalLight, Group, MathUtils, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, Scene,
  ShaderMaterial, SRGBColorSpace, TextureLoader, WebGLRenderer, LinearFilter, LinearMipmapLinearFilter,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SCREENS = ['map', 'card', 'filters', 'spot', 'night', 'route'];

// Pose par étape : rotations (x, y, z). Un tour complet entre 2 et 3 montre le dos.
const POSES = [
  [0.1, -0.5, 0.07],
  [0.04, 0.34, -0.03],
  [0.12, -0.42, 0.05],
  [0.02, 0.4 + Math.PI * 2, -0.05],
  [0.14, -0.34 + Math.PI * 2, 0.06],
  [0.03, 0.3 + Math.PI * 2, -0.03],
];

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export async function createPhone(canvas, theme, wake) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  let ratio = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const ambient = new AmbientLight(0xffffff, 0.3);
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 4, 5);
  const rim = new DirectionalLight(0xa8f0d0, 1.1);
  rim.position.set(4, 1, -2);
  scene.add(ambient, key, rim);

  const camera = new PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.z = 8;

  const loader = new TextureLoader();
  const load = async (name) => {
    const t = await loader.loadAsync(`${import.meta.env.BASE_URL}screens/${name}.webp`);
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    return t;
  };
  const sets = {};
  const loadSet = (t) => (sets[t] ??= Promise.all(SCREENS.map((n) => load(`${n}-${t}`))));

  const [gltf, first] = await Promise.all([
    new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/phone.glb`),
    loadSet(theme),
  ]);
  let textures = first;
  let previous = first;
  let blend = 1; // fondu entre thèmes

  const screen = new ShaderMaterial({
    uniforms: {
      a: { value: first[0] }, b: { value: first[0] }, a0: { value: first[0] }, b0: { value: first[0] },
      wipe: { value: 0 }, blend: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D a, b, a0, b0; uniform float wipe, blend; varying vec2 vUv;
      // L'écran suivant glisse par la droite, comme une page de l'application.
      vec4 page(sampler2D p, sampler2D n) {
        float edge = 1.0 - wipe;
        vec4 from = texture2D(p, vec2(vUv.x + wipe * 0.28, vUv.y));
        vec4 to = texture2D(n, vec2(vUv.x - edge, vUv.y));
        from.rgb *= 1.0 - 0.45 * wipe;
        return vUv.x >= edge ? to : from;
      }
      void main() {
        gl_FragColor = vec4(mix(page(a0, b0).rgb, page(a, b).rgb, blend), 1.0);
        #include <colorspace_fragment>
      }`,
  });

  const model = gltf.scene;
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'Screen') o.material = screen;
    else {
      // Matière simple : le vernis physique coûtait cher pour un effet à peine visible.
      const m = o.material;
      o.material = new MeshStandardMaterial({
        color: m.color, metalness: m.metalness, roughness: m.roughness * 0.85,
        envMapIntensity: m.name === 'Lens' ? 1.6 : 1.1,
      });
    }
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
  model.rotation.x = Math.PI / 2; // Blender : écran vers +Z, export en Y vers le haut
  const phone = new Group();
  phone.add(model);
  scene.add(phone);

  // Le visiteur peut faire tourner le téléphone ; il revient de lui-même.
  const drag = { on: false, x: 0, y: 0, rx: 0, ry: 0 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    drag.on = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag.on) {
      drag.ry += (e.clientX - drag.x) * 0.011;
      drag.rx = MathUtils.clamp(drag.rx + (e.clientY - drag.y) * 0.005, -0.7, 0.7);
      drag.x = e.clientX;
      drag.y = e.clientY;
    } else if (e.pointerType === 'mouse') {
      tilt.tx = (e.clientY / innerHeight - 0.5) * 0.12;
      tilt.ty = (e.clientX / innerWidth - 0.5) * 0.22;
    }
    wake();
  });
  const release = () => {
    drag.on = false;
    // Revient par le chemin le plus court.
    drag.ry = MathUtils.euclideanModulo(drag.ry + Math.PI, Math.PI * 2) - Math.PI;
    wake();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // Tout est envoyé à la carte graphique avant le premier défilement.
  first.forEach((t) => renderer.initTexture(t));
  await renderer.compileAsync(scene, camera);

  let wide = true, aspect = 1, intro = 0;
  let slow = 0;
  /** Machine peu puissante : on baisse la finesse plutôt que la fluidité. */
  const adapt = (dt) => {
    slow = dt > 0.024 ? slow + 1 : Math.max(0, slow - 0.5);
    if (slow > 6 && ratio > 0.6) {
      ratio = Math.max(0.6, ratio - 0.3);
      renderer.setPixelRatio(ratio);
      slow = 0;
    }
  };

  const applyTheme = (t) => {
    const dark = t === 'dark';
    scene.environmentIntensity = dark ? 0.45 : 0.85;
    key.intensity = dark ? 0.9 : 1.6;
    rim.intensity = dark ? 2 : 1.1;
  };
  applyTheme(theme);
  let wanted = theme;

  return {
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      wide = innerWidth > 820;
      aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    async setTheme(t) {
      wanted = t;
      applyTheme(t);
      const next = await loadSet(t);
      next.forEach((x) => renderer.initTexture(x));
      if (wanted !== t || next === textures) return;
      previous = textures;
      textures = next;
      blend = 0;
      wake();
    },
    /** Renvoie vrai tant qu'il reste du mouvement. */
    render(p, dt) {
      adapt(dt);
      const i = MathUtils.clamp(Math.floor(p), 0, SCREENS.length - 2);
      const t = smooth(MathUtils.clamp((p - i - 0.15) / 0.7, 0, 1));
      const u = screen.uniforms;
      u.a.value = textures[i];
      u.b.value = textures[i + 1];
      u.a0.value = previous[i];
      u.b0.value = previous[i + 1];
      u.wipe.value = t;
      blend = Math.min(1, blend + dt * 2.2);
      u.blend.value = smooth(blend);
      intro = Math.min(1, intro + dt * 0.85);
      const enter = 1 - Math.pow(1 - intro, 4);

      const k = 1 - Math.exp(-dt * 6);
      if (!drag.on) {
        drag.rx += -drag.rx * k;
        drag.ry += -drag.ry * k;
      }
      tilt.x += (tilt.tx - tilt.x) * k;
      tilt.y += (tilt.ty - tilt.y) * k;

      const pose = [0, 1, 2].map((n) => MathUtils.lerp(POSES[i][n], POSES[i + 1][n], t));
      phone.rotation.set(
        pose[0] + drag.rx + tilt.x,
        pose[1] + drag.ry + tilt.y - (1 - enter) * 2.4,
        pose[2],
      );
      const viewH = 2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2));
      const viewW = viewH * aspect;
      const hop = Math.sin(t * Math.PI) * 0.06;
      if (wide) {
        phone.scale.setScalar(Math.min(1.36, (viewW * 0.58) / 1.15));
        phone.position.set(viewW * 0.02, hop - (1 - enter) * 1.4, 0);
      } else {
        phone.scale.setScalar(Math.min(1.2, (viewW * 0.62) / 1.05));
        phone.position.set(0, viewH * 0.0 + hop - (1 - enter) * 1.2, 0);
      }
      renderer.render(scene, camera);

      return (
        blend < 1 || intro < 1 || drag.on ||
        Math.abs(drag.rx) + Math.abs(drag.ry) > 0.001 ||
        Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.0008
      );
    },
  };
}
