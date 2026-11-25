// Procedural low-poly models. Original shapes, not copies of Create's textures.
// Each builder returns { body, spin, spinOffset }:
//  body  - static parts in "facing frame": +Z is the block's front, +Y up
//  spin  - parts built around local +Y that turn at the block's speed (oriented to the rotation axis by the app)
import * as THREE from 'three';

const matCache = new Map(), texCache = new Map();
const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f))); return c;
};
export function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  const { metal, ...rest } = opts;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: metal ?? 0.08, flatShading: true, ...rest }));
  return matCache.get(k);
}
function canvasTex(key, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
function frameTex(color, glyph = '') {
  return canvasTex('f' + color + glyph, g => {
    g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#' + shade(color, 0.62).getHexString(); g.lineWidth = 14; g.strokeRect(7, 7, 114, 114);
    g.strokeStyle = '#' + shade(color, 1.22).getHexString(); g.lineWidth = 3; g.strokeRect(17, 17, 94, 94);
    g.fillStyle = '#' + shade(color, 0.55).getHexString();
    for (const [x, y] of [[14, 14], [114, 14], [14, 114], [114, 114]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    if (glyph) {
      g.fillStyle = 'rgba(20,18,16,.82)';
      g.font = `700 ${glyph.length > 2 ? 34 : 44}px "Chakra Petch", "Segoe UI", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, 64, 67);
    }
  });
}
const texMat = (color, glyph, extra = {}) => {
  const k = 'tm' + color + glyph + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ map: frameTex(color, glyph), roughness: 0.8, metalness: 0.05, ...extra }));
  return matCache.get(k);
};

function box(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
function cyl(r, h, m, seg = 12, y = 0) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.y = y; return o; }
function cog(r, h, color, teeth) {
  const g = new THREE.Group();
  g.add(cyl(r * 0.82, h, mat(color), 16));
  const tm = mat(shade(color, 0.8).getHex());
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = box(r * 0.28, h * 0.9, r * 0.22, tm, Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9);
    t.rotation.y = -a; g.add(t);
  }
  return g;
}
const SHAFT = '#8a8b84';
const shaftMesh = (len = 1) => cyl(0.11, len, mat(SHAFT, { metal: 0.3 }), 8);
// casing cube with glyph on front and top
function casing(color, glyph, s = 0.96) {
  const plain = texMat(color, ''), face = texMat(color, glyph);
  return new THREE.Mesh(new THREE.BoxGeometry(s, s, s), [plain, plain, glyph ? face : plain, plain, glyph ? face : plain, plain]);
}
function group(...xs) { const g = new THREE.Group(); xs.forEach(x => x && g.add(x)); return g; }
function glassMat(color, op = 0.35) { return mat(color, { transparent: true, opacity: op, depthWrite: false }); }

const B = {
  shaft: d => ({ spin: shaftMesh(1) }),
  cog: d => ({ spin: group(cog(0.42, 0.24, d.c, 12), shaftMesh(1)) }),
  lcog: d => ({ spin: group(cog(0.92, 0.24, d.c, 22), cyl(0.3, 0.3, mat(shade(d.c, 0.7).getHex())), shaftMesh(1)) }),
  eshaft: d => ({ body: casing(d.c, ''), spin: shaftMesh(1.04) }),
  ecog: d => ({ body: casing(d.c, '', 0.9), spin: group(cog(0.47, 0.22, '#9a7748', 12), shaftMesh(1.04)) }),
  elcog: d => ({ body: casing(d.c, '', 0.9), spin: group(cog(0.92, 0.22, '#9a7748', 22), shaftMesh(1.04)) }),
  gearbox: d => ({ body: group(casing(d.c, d.g), box(1.02, 0.22, 0.22, mat(SHAFT)), box(0.22, 0.22, 1.02, mat(SHAFT))) }),
  split: d => ({ body: group(box(0.94, 0.46, 0.94, texMat(d.c, ''), 0, 0.24, 0), box(0.94, 0.46, 0.94, texMat(shade(d.c, 0.8).getStyle(), d.g), 0, -0.24, 0)), spin: shaftMesh(1.04) }),
  chain: d => ({ body: casing(d.c, d.g, 0.94), spin: shaftMesh(1.04) }),
  rsc: d => ({ body: group(box(0.96, 0.7, 0.96, texMat(d.c, d.g), 0, -0.13, 0)), spin: shaftMesh(1.04) }),
  gantryshaft: d => ({ spin: box(0.34, 1, 0.34, mat(d.c)) }),
  box: d => ({ body: casing(d.c, d.g) }),
  casingblock: d => ({ body: casing(d.c, '') }),
  press: d => ({ body: group(box(0.96, 0.6, 0.96, texMat(d.c, d.g), 0, 0.2, 0), box(0.18, 0.6, 0.18, mat(SHAFT), 0, -0.3, 0), box(0.62, 0.14, 0.62, mat('#6d6e68'), 0, -0.6, 0)), spin: shaftMesh(1.04), spinAxisLocal: 'z' }),
  mixer: d => ({ body: group(box(0.96, 0.5, 0.96, texMat(d.c, d.g), 0, 0.25, 0)), spin: group(cog(0.5, 0.16, '#9a7748', 12), cyl(0.06, 0.9, mat(SHAFT), 6, -0.45), box(0.5, 0.25, 0.05, mat('#bbb'), 0, -0.85, 0), box(0.05, 0.25, 0.5, mat('#bbb'), 0, -0.85, 0)) }),
  millstone: d => ({ body: cyl(0.48, 0.5, mat(shade(d.c, 0.8).getHex()), 14, -0.25), spin: group(cyl(0.44, 0.42, mat(d.c), 14, 0.22), box(0.2, 0.06, 0.6, mat('#555'), 0, 0.45, 0)) }),
  crusher: d => {
    const g = group(cyl(1.35, 0.9, mat(d.c), 20));
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const t = box(0.22, 0.92, 0.2, mat(shade(d.c, 0.7).getHex()), Math.cos(a) * 1.34, 0, Math.sin(a) * 1.34); t.rotation.y = -a; g.add(t); }
    g.add(shaftMesh(1.1)); return { spin: g };
  },
  fan: d => ({ body: group(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.7), texMat(d.c, '')), box(0.82, 0.82, 0.04, mat('#222'), 0, 0, 0.37)),
    spin: (() => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const b = box(0.12, 0.04, 0.76, mat('#cfcfc8')); b.rotation.y = i * Math.PI / 4 * 2; b.rotation.z = 0.35; g.add(b); } g.add(cyl(0.12, 0.12, mat('#888'))); return g; })(), spinOffset: 0.3 }),
  drill: d => ({ body: box(0.96, 0.96, 0.5, texMat(d.c, ''), 0, 0, -0.24), spin: (() => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.75, 8), mat('#b9bab6', { metal: 0.5 })); c.position.y = 0.2; return group(c); })(), spinOffset: 0.15 }),
  saw: d => ({ body: box(0.96, 0.96, 0.6, texMat(d.c, ''), 0, 0, -0.2), spin: group(cyl(0.48, 0.05, mat('#d4d4d0', { metal: 0.6 }), 20), ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; const t = box(0.1, 0.05, 0.12, mat('#999'), Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5); t.rotation.y = -a + 0.6; return t; })), spinOffset: 0.2 }),
  deployer: d => ({ body: group(casing(d.c, d.g, 0.94), box(0.14, 0.14, 0.7, mat(SHAFT), 0, 0, 0.6), box(0.36, 0.3, 0.12, mat('#d9c39a'), 0, 0, 0.98)), spin: shaftMesh(1.04) }),
  crank: d => ({ spin: group(cyl(0.1, 0.4, mat(SHAFT), 8, -0.25), box(0.8, 0.09, 0.12, mat(d.c), 0, 0, 0), box(0.12, 0.3, 0.12, mat(shade(d.c, 0.7).getHex()), 0.36, 0.15, 0)), spinOffset: -0.05 }),
  waterwheel: d => ({ spin: (() => { const g = group(shaftMesh(1.02), new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20).rotateX(Math.PI / 2), mat(d.c))); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = box(0.12, 0.7, 0.3, mat(shade(d.c, 0.85).getHex()), Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); p.rotation.y = -a; g.add(p); } return g; })() }),
  lwaterwheel: d => ({ spin: (() => { const g = group(shaftMesh(1.02), new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.07, 6, 32).rotateX(Math.PI / 2), mat(d.c))); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const p = box(0.14, 0.8, 0.4, mat(shade(d.c, 0.85).getHex()), Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35); p.rotation.y = -a; g.add(p); } for (let i = 0; i < 4; i++) { const s = box(2.6, 0.08, 0.1, mat(d.c)); s.rotation.y = i * Math.PI / 4; g.add(s); } return g; })() }),
  bearing: d => ({ body: box(0.96, 0.96, 0.7, texMat(d.c, d.g), 0, 0, -0.14), spin: cyl(0.44, 0.18, mat(shade(d.c, 1.15).getHex()), 16), spinOffset: 0.38 }),
  engine: d => ({ body: group(box(0.8, 0.5, 0.9, texMat(d.c, d.g), 0, -0.24, 0), cyl(0.2, 0.5, mat('#9a7a33', { metal: 0.4 }), 10, 0.2), box(0.7, 0.12, 0.2, mat('#6b5520'), 0, 0.35, 0.3)) }),
  motor: d => ({ body: box(0.96, 0.96, 0.72, texMat(d.c, d.g), 0, 0, -0.12), spin: shaftMesh(0.5), spinOffset: 0.3 }),
  flywheel: d => ({ spin: group(shaftMesh(1.02), new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 28).rotateX(Math.PI / 2), mat(d.c, { metal: 0.5 })), box(1.7, 0.1, 0.12, mat(d.c)), box(0.12, 0.1, 1.7, mat(d.c))) }),
  sail: d => ({ body: group(box(0.98, 0.98, 0.08, mat(d.c)), box(1, 0.06, 0.1, mat('#6b5530'), 0, 0.46, 0), box(1, 0.06, 0.1, mat('#6b5530'), 0, -0.46, 0)) }),
  beltitem: d => ({ body: box(0.9, 0.2, 0.9, mat(d.c)) }),
  chainconv: d => ({ body: cyl(0.2, 1, mat(SHAFT)), spin: group(cog(0.85, 0.3, d.c, 20), cyl(0.5, 0.4, mat('#666'))) }),
  basin: d => ({ body: group(box(0.9, 0.08, 0.9, mat(shade(d.c, 0.8).getHex()), 0, -0.44, 0), box(0.9, 0.8, 0.08, mat(d.c), 0, -0.08, 0.41), box(0.9, 0.8, 0.08, mat(d.c), 0, -0.08, -0.41), box(0.08, 0.8, 0.9, mat(d.c), 0.41, -0.08, 0), box(0.08, 0.8, 0.9, mat(d.c), -0.41, -0.08, 0)) }),
  burner: d => ({ body: group(box(0.8, 0.12, 0.8, mat('#3b3b40'), 0, -0.44, 0), box(0.62, 0.62, 0.62, glassMat('#4a4a50', 0.45), 0, -0.05, 0), (() => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), mat('#ffb347', { emissive: '#ff7a18', emissiveIntensity: 1.1 })); c.position.y = -0.05; return c; })()) }),
  depot: d => ({ body: group(box(0.96, 0.42, 0.96, texMat(d.c, ''), 0, -0.29, 0), box(0.72, 0.04, 0.72, mat('#5a4b3a'), 0, -0.07, 0)) }),
  drain: d => ({ body: group(box(0.96, 0.5, 0.96, mat(d.c, { metal: 0.3 }), 0, -0.25, 0), box(0.8, 0.04, 0.8, mat('#2a2522'), 0, 0.01, 0)) }),
  spout: d => ({ body: group(box(0.8, 0.5, 0.8, mat(d.c, { metal: 0.3 }), 0, 0.2, 0), cyl(0.12, 0.4, mat(shade(d.c, 0.7).getHex()), 8, -0.25)) }),
  harvester: d => ({ body: group(box(0.9, 0.3, 0.3, mat(d.c), 0, -0.3, -0.2), ...[-0.3, 0, 0.3].map(x => box(0.08, 0.5, 0.5, mat('#ccc'), x, -0.1, 0.15))) }),
  plough: d => ({ body: group(box(0.9, 0.3, 0.4, mat(d.c), 0, -0.3, -0.15), box(0.8, 0.2, 0.4, mat('#777'), 0, -0.35, 0.25)) }),
  roller: d => ({ body: group(box(0.9, 0.5, 0.4, mat(d.c), 0, 0, -0.2)), spin: cyl(0.3, 0.9, mat('#777'), 10), spinOffset: 0.25 }),
  seat: d => ({ body: group(box(0.9, 0.3, 0.9, mat(d.c), 0, -0.3, 0), box(0.9, 0.1, 0.9, mat(shade(d.c, 0.7).getHex()), 0, -0.48, 0)) }),
  piston: d => ({ body: group(box(0.96, 0.96, 0.78, texMat(d.c, d.g), 0, 0, -0.1), box(0.96, 0.96, 0.16, mat('#a07a4a'), 0, 0, 0.4)), spin: shaftMesh(1.04) }),
  pole: d => ({ spin: box(0.25, 1, 0.25, mat(d.c)) }),
  pulley: d => ({ body: casing(d.c, d.g, 0.94), spin: shaftMesh(1.04) }),
  chassis: d => ({ body: new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), texMat(d.c, '')) }),
  turntable: d => ({ body: box(0.96, 0.5, 0.96, texMat('#9c9d94', ''), 0, -0.25, 0), spin: cyl(0.46, 0.12, mat(d.c), 16, 0.06) }),
  funnel: d => ({ body: group(box(0.9, 0.9, 0.3, mat(d.c), 0, 0, -0.32), box(0.6, 0.6, 0.12, mat('#262420'), 0, 0, -0.16)) }),
  tunnel: d => ({ body: group(box(0.12, 0.6, 0.96, mat(d.c), 0.42, -0.2, 0), box(0.12, 0.6, 0.96, mat(d.c), -0.42, -0.2, 0), box(0.96, 0.12, 0.96, mat(shade(d.c, 1.1).getHex()), 0, 0.14, 0)) }),
  chute: d => ({ body: group(box(0.7, 1, 0.08, mat(d.c), 0, 0, 0.33), box(0.7, 1, 0.08, mat(d.c), 0, 0, -0.33), box(0.08, 1, 0.7, mat(d.c), 0.33, 0, 0), box(0.08, 1, 0.7, mat(d.c), -0.33, 0, 0)) }),
  ejector: d => ({ body: group(box(0.96, 0.5, 0.96, texMat('#9c9d94', d.g), 0, -0.25, 0), box(0.8, 0.08, 0.8, mat('#8a6c3e'), 0, 0.05, 0)) }),
  arm: d => ({ body: group(cyl(0.45, 0.3, mat('#9c9d94'), 12, -0.35), box(0.16, 0.6, 0.16, mat(d.c), 0, 0.15, 0), box(0.12, 0.12, 0.8, mat(d.c), 0, 0.42, 0.3), box(0.3, 0.1, 0.1, mat('#666'), 0, 0.42, 0.72)), spin: cog(0.48, 0.12, d.c, 12), spinOffset: 0 }),
  vault: d => ({ body: group(new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), texMat(d.c, '')), box(1, 0.1, 1, mat('#555'), 0, 0.3, 0), box(1, 0.1, 1, mat('#555'), 0, -0.3, 0)) }),
  tank: d => ({ body: group(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.98, 0.92), glassMat('#9fd4e8', 0.3)), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => box(0.1, 1, 0.1, mat(d.c, { metal: 0.3 }), x * 0.45, 0, z * 0.45)), box(1, 0.08, 1, mat(d.c), 0, 0.46, 0), box(1, 0.08, 1, mat(d.c), 0, -0.46, 0)) }),
  pipe: d => ({ spin: cyl(0.2, 1, mat(d.c, { metal: 0.35 }), 10) }),
  epipe: d => ({ body: casing(d.c, '') }),
  pump: d => ({ body: cyl(0.24, 1, mat('#c46e3d', { metal: 0.3 }), 10), spin: cog(0.45, 0.2, '#9a7748', 12) }),
  whistle: d => ({ body: group(cyl(0.18, 0.8, mat(d.c, { metal: 0.5 }), 10, 0), cyl(0.24, 0.15, mat(shade(d.c, 0.7).getHex()), 10, -0.42)) }),
  gauge: d => ({ body: group(casing('#9c9d94', ''), box(0.6, 0.6, 0.04, mat('#f0ead8'), 0, 0, 0.49), box(0.6, 0.6, 0.04, mat('#f0ead8'), 0, 0, -0.49), box(0.04, 0.26, 0.05, mat('#c0392b'), 0.06, 0.06, 0.52)), spin: shaftMesh(1.04) }),
  slab: d => ({ body: group(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.96), [texMat(d.c, ''), texMat(d.c, ''), texMat(d.c, d.g), texMat(d.c, ''), texMat(d.c, ''), texMat(d.c, '')]).translateY(-0.42)) }),
  board: d => ({ body: group(box(0.98, 0.98, 0.18, mat(d.c), 0, 0, -0.4), box(0.8, 0.3, 0.02, mat('#f0ead8'), 0, 0.2, -0.3), box(0.8, 0.3, 0.02, mat('#f0ead8'), 0, -0.2, -0.3)) }),
  nixie: d => ({ body: group(box(0.5, 0.15, 0.4, mat('#3b3b40'), 0, -0.42, 0), cyl(0.16, 0.6, mat(d.c, { emissive: d.c, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }), 10, -0.05)) }),
  track: d => ({ body: group(...[-0.32, 0.32].map(x => box(0.08, 0.1, 1, mat('#8e9095', { metal: 0.6 }), x, -0.38, 0)), ...[-0.33, 0, 0.33].map(z => box(0.98, 0.08, 0.18, mat(d.c), 0, -0.46, z))) }),
  station: d => ({ body: group(casing(d.c, d.g), box(0.3, 0.3, 0.06, mat('#f2c14e', { emissive: '#f2c14e', emissiveIntensity: 0.4 }), 0, 0.2, 0.5)) }),
  signal: d => ({ body: group(box(0.9, 0.2, 0.9, mat(d.c), 0, -0.4, 0), box(0.14, 0.8, 0.14, mat('#333'), 0, 0.1, 0), box(0.3, 0.3, 0.2, mat('#3aa655', { emissive: '#3aa655', emissiveIntensity: 0.6 }), 0, 0.4, 0)) }),
  bogey: d => ({ body: group(box(0.9, 0.2, 0.9, mat(d.c), 0, -0.1, 0), ...[[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.3], [0.36, 0.3]].map(([x, z]) => { const w = cyl(0.22, 0.1, mat('#555', { metal: 0.6 }), 12, 0); w.rotation.z = Math.PI / 2; w.position.set(x, -0.3, z); return w; })) }),
  door: d => ({ body: group(box(0.98, 0.98, 0.16, mat(d.c), 0, 0, -0.4), box(0.5, 0.4, 0.04, glassMat('#a8d0e0', 0.5), 0, 0.2, -0.3)) }),
  rail: d => ({ body: group(...[-0.3, 0.3].map(x => box(0.07, 0.06, 1, mat(d.c, { metal: 0.6 }), x, -0.46, 0)), ...[-0.35, 0, 0.35].map(z => box(0.86, 0.04, 0.14, mat('#6e5a45'), 0, -0.48, z))) }),
  cart: d => ({ body: group(box(0.8, 0.08, 0.9, mat(d.c), 0, -0.3, 0), box(0.8, 0.4, 0.06, mat(d.c), 0, -0.1, 0.42), box(0.8, 0.4, 0.06, mat(d.c), 0, -0.1, -0.42), box(0.06, 0.4, 0.9, mat(d.c), 0.4, -0.1, 0), box(0.06, 0.4, 0.9, mat(d.c), -0.4, -0.1, 0)) }),
  furnace: d => ({ body: group(casing(d.c, ''), box(0.5, 0.3, 0.04, mat('#ff8c2a', { emissive: '#ff6a00', emissiveIntensity: 0.7 }), 0, -0.15, 0.49), box(0.5, 0.14, 0.04, mat('#222'), 0, 0.2, 0.49)) }),
  campfire: d => ({ body: group(box(0.9, 0.12, 0.2, mat('#6b4f2e'), 0, -0.44, 0.2), box(0.9, 0.12, 0.2, mat('#6b4f2e'), 0, -0.44, -0.2), box(0.2, 0.12, 0.9, mat('#5a4126'), 0.2, -0.32, 0), box(0.2, 0.12, 0.9, mat('#5a4126'), -0.2, -0.32, 0), (() => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), mat(d.c, { emissive: d.c, emissiveIntensity: 0.9 })); c.position.y = -0.05; return c; })()) }),
  brew: d => ({ body: group(cyl(0.05, 0.8, mat('#c9a227'), 6, -0.1), box(0.8, 0.08, 0.8, mat(d.c), 0, -0.46, 0), ...[0, 2.1, 4.2].map(a => { const b = cyl(0.1, 0.3, glassMat('#d04080', 0.7), 8, -0.3); b.position.x = Math.cos(a) * 0.3; b.position.z = Math.sin(a) * 0.3; return b; })) }),
  hopper: d => ({ body: group(box(0.96, 0.4, 0.96, mat(d.c), 0, 0.28, 0), box(0.5, 0.4, 0.5, mat(d.c), 0, -0.1, 0), box(0.24, 0.24, 0.4, mat(shade(d.c, 1.2).getHex()), 0, -0.2, 0.32)) }),
  chest: d => ({ body: group(box(0.88, 0.62, 0.88, mat(d.c), 0, -0.13, 0), box(0.88, 0.26, 0.88, mat(shade(d.c, 1.1).getHex()), 0, 0.31, 0), box(0.14, 0.2, 0.06, mat('#c0c0c0'), 0, 0.15, 0.46)) }),
  glass: d => ({ body: new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.99, 0.99), glassMat(d.c, 0.45)) }),
  fluid: d => ({ body: box(1, 0.88, 1, glassMat(d.c, 0.6), 0, -0.06, 0) }),
  fire: d => ({ body: group(...[[-0.2, 0], [0.2, 0.1], [0, -0.2]].map(([x, z]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 5), mat(d.c, { emissive: d.c, emissiveIntensity: 1, transparent: true, opacity: 0.85 })); c.position.set(x, -0.15, z); return c; })) }),
  log: d => ({ body: group(cyl(0.48, 1, mat(d.c), 10), cyl(0.38, 1.01, mat('#c9a76b'), 10)) }),
  farmland: d => ({ body: box(1, 0.94, 1, mat(d.c), 0, -0.03, 0) }),
  crop: d => ({ body: group(...[0, Math.PI / 2].map(a => { const p = box(0.9, 0.85, 0.02, mat(d.c, { side: THREE.DoubleSide })); p.rotation.y = a + Math.PI / 4; p.position.y = -0.07; return p; })) }),
  torch: d => ({ body: group(box(0.12, 0.6, 0.12, mat('#6b4f2e'), 0, -0.2, 0), box(0.16, 0.16, 0.16, mat(d.c, { emissive: d.c, emissiveIntensity: 1 }), 0, 0.15, 0)) }),
  wire: d => ({ body: group(box(0.9, 0.03, 0.14, mat(d.c, { emissive: d.c, emissiveIntensity: 0.4 }), 0, -0.48, 0), box(0.14, 0.03, 0.9, mat(d.c, { emissive: d.c, emissiveIntensity: 0.4 }), 0, -0.48, 0)) }),
  vpiston: d => ({ body: group(box(0.96, 0.96, 0.72, mat('#7a7a76'), 0, 0, -0.12), box(0.96, 0.96, 0.24, mat(d.c), 0, 0, 0.36)) }),
  frog: d => ({ body: group(box(0.7, 0.4, 0.7, mat(d.c), 0, -0.3, 0), box(0.15, 0.15, 0.15, mat('#f0ead8'), 0.18, -0.05, 0.25), box(0.15, 0.15, 0.15, mat('#f0ead8'), -0.18, -0.05, 0.25)) }),
};

export function buildModel(def) {
  const f = B[def.m] || B.box;
  const r = f(def);
  return { body: r.body || null, spin: r.spin || null, spinOffset: r.spinOffset || 0 };
}
export { frameTex };
