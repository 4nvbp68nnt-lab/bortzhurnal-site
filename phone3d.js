/* Объёмный телефон на three.js: корпус, стекло, экран-текстура, задняя крышка.
   Обобщённый дизайн смартфона, без логотипов. */
import * as THREE from './js/three.module.min.js';

const W = 71.6, H = 147, D = 8.25, R = 11, B = 1.3;   // размеры в мм

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// плоская фигура со скруглёнными углами и UV 0..1
function rrPlane(w, h, r, seg = 24) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), seg), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + .5, p.getY(i) / h + .5);
  return g;
}
function rrSlab(w, h, r, d, bev, seg = 32) {
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * bev, h - 2 * bev, Math.max(.5, r - bev)),
    { depth: Math.max(.01, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 10, curveSegments: seg });
  g.center(); g.computeVertexNormals(); return g;
}

// студийное окружение для отражений: тёмная комната с софтбоксами
function studioEnv(renderer) {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x0c0c0d);
  const box = (w, h, x, y, z, ry, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; s.add(m); };
  box(1.6, 9, -5, 0, 1, Math.PI / 2, 14);     // левая полоса
  box(1.2, 9, 5, 0, .5, -Math.PI / 2, 9);    // правая полоса
  box(8, 3, 0, 5, 2, 0, 4); s.children.at(-1).rotation.x = Math.PI / 2;  // верхний софтбокс
  box(4, 4, -2.5, 1.5, 5, 0, 2.4); box(5, 5, 2, 0, -5, Math.PI, 2.2);            // ключевой спереди слева
  box(10, 2, 0, -4.5, 0, 0, .25); s.children.at(-1).rotation.x = -Math.PI / 2;
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .035).texture; pm.dispose(); return t;
}

const loader = new THREE.TextureLoader();
function tex(url, renderer) {
  const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}

function makePhone(renderer, screenUrl) {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x8a8a90, metalness: 1, roughness: .2, clearcoat: .5, clearcoatRoughness: .15 });
  const body = new THREE.Mesh(rrSlab(W, H, R, D, B), metal); g.add(body);
  // переднее стекло (чёрная рамка вокруг экрана)
  const front = new THREE.Mesh(rrPlane(W - 1.1, H - 1.1, R - .55, 40), new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: .08, clearcoat: 1, clearcoatRoughness: .03 }));
  front.position.z = D / 2 + .01; g.add(front);
  // экран
  const sw = W - 1.1 - 3.6, sh = H - 1.1 - 3.6;
  const scrMat = new THREE.MeshBasicMaterial({ map: tex(screenUrl, renderer), toneMapped: false });
  const scr = new THREE.Mesh(rrPlane(sw, sh, R - 2.4, 40), scrMat); scr.position.z = D / 2 + .02; g.add(scr);
  // второй слой экрана для плавной смены картинки
  const scr2Mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0 });
  const scr2 = new THREE.Mesh(scr.geometry, scr2Mat); scr2.position.z = D / 2 + .025; g.add(scr2);
  // блики стекла поверх экрана: только отражение (аддитивно)
  const gloss = new THREE.Mesh(rrPlane(W - 1.1, H - 1.1, R - .55, 40), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: .05, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: .16 }));
  gloss.position.z = D / 2 + .05; g.add(gloss);
  // вырез с камерой
  const iw = sw * .3, ih = sh * .042;
  const isl = new THREE.Mesh(rrPlane(iw, ih, ih / 2 - .01, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  isl.position.set(0, sh / 2 - sh * .03 - ih / 2, D / 2 + .04); g.add(isl);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(ih * .22, 24), new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: .05, clearcoat: 1 }));
  lens.position.set(iw / 2 - ih * .55, isl.position.y, D / 2 + .045); g.add(lens);
  // боковые кнопки
  const btn = (x, y, h) => { const b = new THREE.Mesh(rrSlab(1.6, h, .8, 3.4, .5, 12), metal); b.position.set(x, y, 0); g.add(b); };
  btn(-W / 2 - .45, H * .27, 7); btn(-W / 2 - .45, H * .15, 12.5); btn(-W / 2 - .45, H * .045, 12.5); btn(W / 2 + .45, H * .12, 21);
  // задняя крышка: матовое стекло и блок камер
  const back = new THREE.Mesh(rrPlane(W - 1.1, H - 1.1, R - .55, 40), new THREE.MeshPhysicalMaterial({ color: 0x3a3a40, roughness: .42, clearcoat: .35, clearcoatRoughness: .35 }));
  back.position.z = -D / 2 - .01; back.rotation.y = Math.PI; g.add(back);
  const bump = new THREE.Mesh(rrSlab(30, 30, 7.5, 1.6, .6, 20), new THREE.MeshPhysicalMaterial({ color: 0x45454b, roughness: .12, clearcoat: 1, metalness: .3 }));
  bump.position.set(W / 2 - 19, H / 2 - 19, -D / 2 - .7); g.add(bump);
  [[-6.5, 6.5], [6.5, -6.5]].forEach(([dx, dy]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.4, 48), metal); ring.rotation.x = Math.PI / 2;
    ring.position.set(bump.position.x + dx, bump.position.y + dy, -D / 2 - 2.0); g.add(ring);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshPhysicalMaterial({ color: 0x05060a, roughness: .03, clearcoat: 1, metalness: .3 }));
    gl.position.set(ring.position.x, ring.position.y, -D / 2 - 2.72); gl.rotation.y = Math.PI; g.add(gl);
  });
  g.userData = { scrMat, scr2Mat };
  return g;
}

function mount(host, opts) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const cv = renderer.domElement; cv.className = 'gl'; host.appendChild(cv);
  const scene = new THREE.Scene(); scene.environment = studioEnv(renderer);
  const cam = new THREE.PerspectiveCamera(opts.fov || 24, 1, 10, 3000);
  const rig = new THREE.Group(); scene.add(rig);
  const phones = opts.screens.map(u => makePhone(renderer, u));
  phones.forEach((p, i) => { const o = (opts.layout || [])[i] || {}; p.position.set(o.x || 0, o.y || 0, o.z || 0); p.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); rig.add(p); });
  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h;
    const tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), vh = opts.fit || 190, vw = opts.fitW || vh * .62;
    cam.position.set(0, 0, Math.max(vh / 2 / tn, vw / 2 / (tn * cam.aspect))); cam.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(host); size();

  // управление: курсор/палец вращают, после отпускания возвращается
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = { x: opts.baseX ?? .12, y: opts.baseY ?? -.38 };
  // поворот ограничен: задняя крышка не показывается (не больше ~40° от лицевой стороны)
  const LIM = .55, clampY = v => Math.max(-LIM, Math.min(LIM, v));
  let tx = base.x, ty = base.y, vx = 0, vy = 0, rx = base.x, ry = base.y, drag = null, hover = false;
  const area = opts.pointerArea || host;
  area.addEventListener('pointermove', e => { if (drag || e.pointerType !== 'mouse') return; const r = area.getBoundingClientRect();
    hover = true; ty = clampY(base.y + ((e.clientX - r.left) / r.width - .5) * .9); tx = base.x + ((e.clientY - r.top) / r.height - .5) * .45; });
  area.addEventListener('pointerleave', () => { hover = false; if (!drag) { tx = base.x; ty = base.y; } });
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ry, rx }; cv.setPointerCapture(e.pointerId); cv.classList.add('grab'); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    ty = clampY(drag.ry + dx * .006); tx = Math.max(base.x - .25, Math.min(base.x + .25, drag.rx + dy * .004)); });
  const up = () => { if (!drag) return; drag = null; cv.classList.remove('grab'); ty = base.y; tx = base.x; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  let fade = null;
  const api = {
    setScreen(url) { const p = phones[0], { scrMat, scr2Mat } = p.userData; const t = tex(url, renderer);
      scr2Mat.map = t; scr2Mat.needsUpdate = true; scr2Mat.opacity = 0; fade = { t0: performance.now(), p, t }; }
  };
  let on = true, t0 = performance.now();
  new IntersectionObserver(es => { on = es[0].isIntersecting; }).observe(host);
  const loop = now => {
    requestAnimationFrame(loop); if (!on) return;
    const t = (now - t0) / 1000, idle = reduce || drag || hover ? 0 : 1;
    const k = drag ? .35 : .08;
    vx += ((tx + Math.sin(t * .6) * .05 * idle) - rx) * k; vy += ((ty + Math.sin(t * .45) * .12 * idle) - ry) * k; vx *= .72; vy *= .72; rx += vx; ry += vy;
    ry = clampY(ry); rig.rotation.set(rx, ry, opts.rz || 0); rig.position.y = reduce ? 0 : Math.sin(t * 1.1) * 1.6;
    if (fade) { const k2 = Math.min(1, (now - fade.t0) / 450), { scrMat, scr2Mat } = fade.p.userData; scr2Mat.opacity = k2;
      if (k2 >= 1) { scrMat.map = fade.t; scrMat.needsUpdate = true; scr2Mat.opacity = 0; fade = null; } }
    renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);
  host.classList.add('is3d');
  return api;
}

// первый экран: два телефона
const stage = document.getElementById('stage');
if (stage) {
  const host = document.createElement('div'); host.className = 'gl-host'; stage.appendChild(host);
  mount(host, { screens: ['img/scr-home-light.webp'], fit: 178, fitW: 120, baseY: -.42, baseX: .1, rz: .08, pointerArea: stage.closest('.hero') || stage });
}
// история на компьютере: один телефон, экран меняется по блокам
const mobile = matchMedia('(max-width: 860px)');
const shots = ['to-light', 'parts-light', 'issues-light', 'fuelsheet-light'].map(n => 'img/scr-' + n + '.webp');
const stack = document.querySelector('.devstack');
let deskDone = false;
function desk() {
  if (deskDone || !stack || mobile.matches) return; deskDone = true;
  const api = mount(stack, { screens: [shots[0]], fit: 168, fitW: 100, baseY: -.3, baseX: .06 });
  if (api) { shots.slice(1).forEach(u => loader.load(u)); let cur = 0;
    document.addEventListener('story', e => { const i = e.detail | 0; if (i !== cur) { cur = i; api.setScreen(shots[i]); } }); }
}
// история на телефоне: объёмный телефон под каждым блоком, создаётся при подлёте к экрану
const inl = [...document.querySelectorAll('.st img.inline')];
const lazy = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting || !mobile.matches) return; lazy.unobserve(e.target);
  const st = e.target.closest('.st'), i = Number(st.dataset.i) || 0;
  const host = document.createElement('div'); host.className = 'gl-inline'; e.target.after(host);
  const api = mount(host, { screens: [shots[i]], fit: 168, fitW: 96, baseY: i % 2 ? .3 : -.3, baseX: .06 });
  if (api) st.classList.add('has3d'); else host.remove();
}), { rootMargin: '300px 0px' });
function mob() { if (mobile.matches) inl.forEach(im => lazy.observe(im)); }
desk(); mob();
mobile.addEventListener('change', () => { desk(); mob(); });
