import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BLOCKS, BY_ID, CATS, HARDNESS } from './blocks.js';
import * as SIM from './sim.js';
import { buildModel, mat } from './models.js';
import { buildNbt, gzip, zip } from './nbt.js';
import { EXAMPLE } from './example.js';

const { DIRS, key, opp } = SIM;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmt = (n, d = 1) => !isFinite(n) ? '—' : Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en') : (+n.toFixed(d)).toString();

// ---------------- state ----------------
const S = {
  world: new Map(), links: [], tool: 'place', cur: 'create:shaft', orient: 0, layer: 32,
  sel: null, tab: 'inspect', hist: [], fut: [], netView: false, linkStart: null,
  solve: null, recipeQuery: '', recipeItem: null, recipeRpm: 128, showUses: false,
};
let DATA = { names: {}, recipes: [] }, BYOUT = new Map(), BYIN = new Map(), RECIPE = new Map();
const STORE = 'create-factory-planner-v1';

const nameOf = id => {
  if (!id) return '';
  if (id[0] === '#') {
    const parts = id.slice(1).split(':')[1].split('/');
    const w = parts.reverse().map(p => p.replace(/_/g, ' ')).join(' ');
    return 'Any ' + w.replace(/\b\w/g, c => c.toUpperCase());
  }
  return DATA.names[id] || BY_ID[id]?.name || id.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
const defName = d => DATA.names[d.id] || d.id.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ---------------- three.js ----------------
const view = $('#view');
// The 3D view needs WebGL. If the browser can't create a context (hardware acceleration off,
// blocked by policy), keep the rest of the planner working and say how to fix it.
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch (e) {
  renderer = null;
  window.__showProblem?.('The 3D view could not start because your browser has WebGL turned off or unavailable.',
    'Turn on hardware acceleration and reload. In Chrome or Edge: Settings → System → “Use graphics acceleration when available”. On a work computer, WebGL may be blocked by your IT policy. The Recipes, Power, Production and Checks tabs still work.');
}
const canvasEl = renderer ? renderer.domElement : document.createElement('canvas');
view.prepend(canvasEl);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(19, 17, 24);
const controls = new OrbitControls(camera, canvasEl);
controls.target.set(1, 3, 3);
controls.enableDamping = true;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x4a4438, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(8, 20, 6); scene.add(sun);
const grid = new THREE.GridHelper(64, 64, 0x8a8170, 0x6f6a60); grid.position.y = -0.5; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
ground.position.y = -0.5; scene.add(ground);
const blockRoot = new THREE.Group(), linkRoot = new THREE.Group(), pickRoot = new THREE.Group(), overlayRoot = new THREE.Group();
scene.add(blockRoot, linkRoot, pickRoot, overlayRoot);
const pickGeo = new THREE.BoxGeometry(1, 1, 1), pickMat = new THREE.MeshBasicMaterial({ visible: false });
const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xe0ad4f, transparent: true, opacity: 0.28, depthWrite: false }));
const ghostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0xe0ad4f }));
ghost.add(ghostEdge);
const ghostArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.9, 0xe0ad4f, 0.3, 0.2);
ghost.add(ghostArrow); scene.add(ghost); ghost.visible = false;
const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.06, 1.06, 1.06)), new THREE.LineBasicMaterial({ color: 0x4fa3e0 }));
selBox.visible = false; scene.add(selBox);

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(cs.getPropertyValue('--viewport').trim() || '#202226');
}
themeColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeColors);
new MutationObserver(themeColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function resize() {
  const r = view.getBoundingClientRect();
  renderer?.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

// ---------------- block meshes ----------------
const meshes = new Map(); // key -> {g, spin, pick}
const vec = d => new THREE.Vector3(...DIRS[d]);
const axisVec = a => new THREE.Vector3(a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0);
function makeMesh(b) {
  const def = BY_ID[b.id]; if (!def) return null;
  const { body, spin, spinOffset } = buildModel(def);
  const g = new THREE.Group(); g.position.set(b.x, b.y, b.z);
  if (body) {
    if (b.f) body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vec(b.f));
    else if (b.axis && def.pl !== 'none') body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisVec(b.axis));
    g.add(body);
  }
  let spinner = null;
  if (spin) {
    spinner = new THREE.Group(); spinner.add(spin);
    const ax = SIM.rotAxis(b, def);
    spinner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisVec(ax));
    if (spinOffset && b.f) spinner.position.copy(vec(b.f).multiplyScalar(spinOffset));
    g.add(spinner);
  }
  const pick = new THREE.Mesh(pickGeo, pickMat); pick.position.copy(g.position); pick.userData.k = b.k;
  return { g, spin, spinner, pick };
}
function addMesh(b) {
  const m = makeMesh(b); if (!m) return;
  blockRoot.add(m.g); pickRoot.add(m.pick); meshes.set(b.k, m);
}
function removeMesh(k) {
  const m = meshes.get(k); if (!m) return;
  blockRoot.remove(m.g); pickRoot.remove(m.pick); meshes.delete(k);
}
function rebuildAll() {
  for (const k of [...meshes.keys()]) removeMesh(k);
  for (const b of S.world.values()) addMesh(b);
  rebuildLinks();
}

// belts & chains
const beltTex = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#3a3733'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#2a2724'; g.fillRect(0, 0, 32, 10); g.fillRect(0, 32, 32, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const linkMeshes = [];
function rebuildLinks() {
  for (const m of linkMeshes) linkRoot.remove(m.mesh); linkMeshes.length = 0;
  for (const l of S.links) {
    const a = S.world.get(l.a), b = S.world.get(l.b); if (!a || !b) continue;
    const A = new THREE.Vector3(a.x, a.y, a.z), Bv = new THREE.Vector3(b.x, b.y, b.z);
    const len = A.distanceTo(Bv), mid = A.clone().add(Bv).multiplyScalar(0.5);
    let mesh;
    if (l.type === 'belt') {
      const tex = beltTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, len + 1);
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.5, len + 1), [mat('#2f2c29'), mat('#2f2c29'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat('#2f2c29'), mat('#2f2c29')]);
      mesh.userData.tex = tex;
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6).rotateX(Math.PI / 2), mat('#8e9095', { metal: 0.6 }));
    }
    mesh.position.copy(mid); mesh.lookAt(Bv);
    linkRoot.add(mesh); linkMeshes.push({ mesh, l, len });
  }
}
function beltCells() {
  const cells = new Map();
  for (const l of S.links) {
    if (l.type !== 'belt') continue;
    const a = S.world.get(l.a), b = S.world.get(l.b); if (!a || !b) continue;
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.z - a.z));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      cells.set(key(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), Math.round(a.z + (b.z - a.z) * t)), l);
    }
  }
  return cells;
}

// ---------------- world ops ----------------
function snapshot() { return JSON.stringify(serialize()); }
function pushHist() { S.hist.push(snapshot()); if (S.hist.length > 150) S.hist.shift(); S.fut = []; }
function serialize() {
  return { v: 1, blocks: [...S.world.values()].map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, f: b.f, axis: b.axis, cfg: b.cfg, recipe: b.recipe })), links: S.links };
}
function load(data) {
  S.world.clear(); S.links = [];
  for (const o of data.blocks || []) { if (!BY_ID[o.id]) continue; const b = { ...o, cfg: { ...(o.cfg || {}) } }; b.k = key(b.x, b.y, b.z); S.world.set(b.k, b); }
  S.links = (data.links || []).filter(l => S.world.has(l.a) && S.world.has(l.b));
  S.sel = null; rebuildAll(); update();
}
function placeBlock(id, x, y, z, f, axis) {
  const def = BY_ID[id];
  const b = { id, x, y, z, k: key(x, y, z), cfg: { ...(def.cfg || {}) } };
  if (f) b.f = f; if (axis) b.axis = axis;
  if (def.pl === 'none' && def.rot !== 'y') b.axis = b.axis || 'y';
  S.world.set(b.k, b); addMesh(b); return b;
}
function eraseAt(k) {
  if (!S.world.has(k)) return;
  pushHist();
  S.world.delete(k); removeMesh(k);
  const before = S.links.length; S.links = S.links.filter(l => l.a !== k && l.b !== k);
  if (S.links.length !== before) rebuildLinks();
  if (S.sel === k) S.sel = null;
  update();
}
function undo() { if (!S.hist.length) return; S.fut.push(snapshot()); load(JSON.parse(S.hist.pop())); toast('Undone'); }
function redo() { if (!S.fut.length) return; S.hist.push(snapshot()); load(JSON.parse(S.fut.pop())); toast('Redone'); }

// ---------------- orientation ----------------
const ORDER = { axis: ['x', 'y', 'z'], haxis: ['x', 'z'], facing: ['+z', '+x', '-z', '-x', '+y', '-y'], hfacing: ['+z', '+x', '-z', '-x'] };
function camHorizontal() {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  return Math.abs(d.x) > Math.abs(d.z) ? (d.x > 0 ? '+x' : '-x') : (d.z > 0 ? '+z' : '-z');
}
function orientFor(def, normal) {
  const list = ORDER[def.pl]; if (!list) return {};
  let auto;
  if (def.pl === 'axis') auto = normal[1];
  else if (def.pl === 'haxis') auto = normal[1] !== 'y' ? normal[1] : camHorizontal()[1];
  else if (def.pl === 'facing') auto = normal;
  else auto = normal[1] !== 'y' ? normal : opp(camHorizontal());
  const i = (list.indexOf(auto) + S.orient) % list.length;
  const v = list[(i + list.length) % list.length];
  return def.pl.includes('axis') ? { axis: v } : { f: v };
}

// ---------------- picking ----------------
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function pickAt(ev) {
  const r = canvasEl.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const vis = pickRoot.children.filter(p => p.visible);
  const hit = ray.intersectObjects(vis, false)[0];
  if (hit) {
    const k = hit.object.userData.k, b = S.world.get(k);
    const n = hit.face.normal; const nd = Math.abs(n.x) > 0.5 ? (n.x > 0 ? '+x' : '-x') : Math.abs(n.y) > 0.5 ? (n.y > 0 ? '+y' : '-y') : (n.z > 0 ? '+z' : '-z');
    const v = DIRS[nd];
    return { block: b, k, normal: nd, place: [b.x + v[0], b.y + v[1], b.z + v[2]] };
  }
  const g = ray.intersectObject(ground)[0];
  if (g) return { block: null, normal: '+y', place: [Math.round(g.point.x), 0, Math.round(g.point.z)] };
  return null;
}
let hover = null, down = null;
canvasEl.addEventListener('contextmenu', e => e.preventDefault());
canvasEl.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button, t: performance.now() }; });
canvasEl.addEventListener('pointermove', e => { hover = pickAt(e); updateGhost(); updateStatus(); });
canvasEl.addEventListener('pointerleave', () => { hover = null; updateGhost(); });
canvasEl.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
  const btn = down.b; down = null;
  if (moved) return;
  const h = pickAt(e); hover = h;
  if (btn === 2) { if (h?.block) eraseAt(h.k); return; }
  if (btn !== 0 || !h) return;
  if (S.tool === 'place') {
    const def = BY_ID[S.cur];
    if (def.tool) { toast('Belts and chains: use the Belt / chain tool (4) and click two shafts.'); return; }
    const [x, y, z] = h.place;
    if (y < 0 || S.world.has(key(x, y, z))) return;
    if (y > S.layer) { toast('That spot is above the visible layer.'); return; }
    pushHist();
    const o = orientFor(def, h.normal);
    const b = placeBlock(S.cur, x, y, z, o.f, o.axis);
    S.sel = b.k; update();
  } else if (S.tool === 'erase') { if (h.block) eraseAt(h.k); }
  else if (S.tool === 'select') { S.sel = h.block ? h.k : null; setTab('inspect'); update(); }
  else if (S.tool === 'belt') linkClick(h);
});
function linkClick(h) {
  if (!h?.block) { S.linkStart = null; render(); return; }
  const b = h.block, def = BY_ID[b.id];
  const isBelt = def.beltable, isChain = b.id === 'create:chain_conveyor';
  if (!isBelt && !isChain) { toast('Belts connect shafts or cogwheels; chains connect Chain Conveyors.'); return; }
  if (!S.linkStart) { S.linkStart = b.k; toast((isBelt ? 'Belt' : 'Chain') + ' start set. Click the other end.'); render(); return; }
  const a = S.world.get(S.linkStart); S.linkStart = null;
  if (!a || a.k === b.k) { render(); return; }
  const err = validateLink(a, b);
  if (err) { toast(err); render(); return; }
  pushHist();
  S.links.push({ type: isChain ? 'chain' : 'belt', a: a.k, b: b.k });
  rebuildLinks(); update(); toast('Connected.');
}
function validateLink(a, b) {
  const da = BY_ID[a.id], db = BY_ID[b.id];
  if (S.links.some(l => (l.a === a.k && l.b === b.k) || (l.a === b.k && l.b === a.k))) return 'Those two are already connected.';
  if (a.id === 'create:chain_conveyor' || b.id === 'create:chain_conveyor') {
    if (a.id !== b.id) return 'Chains only run between two Chain Conveyors.';
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 32) return 'Chains can be at most 32 blocks long.';
    const n = S.links.filter(l => l.type === 'chain' && (l.a === a.k || l.b === a.k || l.a === b.k || l.b === b.k)).length;
    return null;
  }
  if (!da.beltable || !db.beltable) return 'Both belt ends must be shafts or cogwheels.';
  const ax = a.axis;
  if (ax !== b.axis) return 'Both shafts must point the same way.';
  if (ax === 'y') return 'Belts need horizontal shafts (vertical belts run between horizontal shafts stacked above each other).';
  const d = [b.x - a.x, b.y - a.y, b.z - a.z];
  const along = ax === 'x' ? 2 : 0, axisI = ax === 'x' ? 0 : 2;
  if (d[axisI] !== 0) return 'Belt ends must line up: only move across the shafts, not along them.';
  const h = Math.abs(d[along]), v = Math.abs(d[1]);
  if (!(v === 0 || h === 0 || h === v)) return 'Belts run flat, vertical, or at exactly 45°.';
  const len = Math.max(h, v) + 1;
  if (len > 20) return `That belt would be ${len} blocks; the maximum is 20.`;
  if (len < 2) return 'Belt is too short.';
  if (S.links.some(l => l.type === 'belt' && (l.a === a.k || l.b === a.k || l.a === b.k || l.b === b.k))) return 'One of these shafts already has a belt.';
  return null;
}

function updateGhost() {
  if (!hover || S.tool !== 'place' || BY_ID[S.cur]?.tool) { ghost.visible = false; return; }
  const [x, y, z] = hover.place;
  if (y < 0 || S.world.has(key(x, y, z))) { ghost.visible = false; return; }
  ghost.visible = true; ghost.position.set(x, y, z);
  const def = BY_ID[S.cur], o = orientFor(def, hover.normal);
  ghostArrow.visible = !!(o.f || o.axis);
  if (o.f) ghostArrow.setDirection(vec(o.f));
  else if (o.axis) ghostArrow.setDirection(axisVec(o.axis));
}

// ---------------- simulation & render ----------------
function update() {
  S.solve = SIM.solve(S.world, S.links);
  applyLayer(); render(); save();
}
function applyLayer() {
  for (const [k, m] of meshes) { const b = S.world.get(k); const v = b.y <= S.layer; m.g.visible = v; m.pick.visible = v; }
  for (const lm of linkMeshes) { const a = S.world.get(lm.l.a), b = S.world.get(lm.l.b); lm.mesh.visible = a.y <= S.layer && b.y <= S.layer; }
}
function netStatus(net) {
  if (!net) return { cls: 'idle', label: 'No power' };
  if (net.conflict) return { cls: 'bad', label: 'Gears conflict' };
  if (net.overstressed) return { cls: 'bad', label: 'Overstressed' };
  if (net.overspeed) return { cls: 'warn', label: 'Over 256 RPM' };
  if (!net.rpm) return { cls: 'idle', label: 'Not turning' };
  return { cls: 'ok', label: 'Running' };
}
function updateOverlay() {
  overlayRoot.clear();
  if (!S.netView || !S.solve) return;
  const cols = { ok: 0x5cc27e, warn: 0xe3a646, bad: 0xf06a57, idle: 0x777777 };
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
  const mats = {};
  for (const [k, ni] of S.solve.netOf) {
    const b = S.world.get(k); if (!b || b.y > S.layer) continue;
    const st = netStatus(S.solve.nets[ni]).cls;
    mats[st] ||= new THREE.LineBasicMaterial({ color: cols[st] });
    const l = new THREE.LineSegments(geo, mats[st]); l.position.set(b.x, b.y, b.z); overlayRoot.add(l);
  }
}
function render() {
  updateOverlay();
  const sb = S.sel && S.world.get(S.sel);
  selBox.visible = !!sb; if (sb) selBox.position.set(sb.x, sb.y, sb.z);
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool));
  $('#netBtn').setAttribute('aria-pressed', String(S.netView));
  renderHint(); renderPane(); updateStatus(); renderTabsBadge();
}
function renderHint() {
  const def = BY_ID[S.cur];
  const t = {
    place: `<b>Placing ${esc(defName(def))}</b> · click to place · right-click a block to remove · <b>R</b> rotates · right-drag to orbit, middle-drag to pan`,
    select: '<b>Inspect</b> · click a block to see its stats, speed, stress and recipes',
    erase: '<b>Erase</b> · click blocks to remove them',
    belt: S.linkStart ? '<b>Belt / chain</b> · now click the other shaft (or Chain Conveyor)' : '<b>Belt / chain</b> · click a shaft, then a second shaft on the same axis (max 20 blocks; flat, vertical or 45°)',
  }[S.tool];
  $('#hint').innerHTML = t;
}
function updateStatus() {
  const r = S.solve; const nets = r ? r.nets.filter(n => n.sources.length) : [];
  const h = hover?.block;
  let hv = '';
  if (h) {
    const sp = r?.speed.get(h.k);
    hv = `<span><b>${esc(defName(BY_ID[h.id]))}</b> ${h.x}, ${h.y}, ${h.z}${sp !== undefined ? ` · ${fmt(sp)} RPM` : ''}</span>`;
  } else if (hover) hv = `<span>${hover.place.join(', ')}</span>`;
  $('#status').innerHTML = `<span><b>${S.world.size}</b> blocks</span><span><b>${nets.length}</b> powered networks</span><span><b>${DATA.recipes.length.toLocaleString('en')}</b> recipes loaded</span>${hv}`;
}
function renderTabsBadge() {
  const n = S.solve ? runChecks().filter(i => i.sev === 'bad').length : 0;
  const t = document.querySelector('[data-tab="checks"]');
  t.innerHTML = 'Checks' + (n ? `<span class="n">${n}</span>` : '');
}

// ---------------- palette ----------------
const collapsed = new Set(JSON.parse(safeGet('cfp-collapsed') || '[]'));
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { } }
function renderPalette() {
  const q = $('#palSearch').value.trim().toLowerCase();
  let html = '';
  for (const [cid, cname] of CATS) {
    const items = BLOCKS.filter(b => b.cat === cid && (!q || defName(b).toLowerCase().includes(q) || b.id.includes(q)));
    if (!items.length) continue;
    const open = q || !collapsed.has(cid);
    html += `<div class="cat"><h3 data-cat="${cid}">${esc(cname)} <span>${open ? '−' : '+'} ${items.length}</span></h3>`;
    if (open) for (const b of items) {
      const su = b.cap ? `+${b.cap}` : b.su ? `${b.su}` : '';
      html += `<button class="pitem" type="button" data-id="${b.id}" aria-pressed="${b.id === S.cur}"><span class="swatch" style="background:${b.c}"></span>${esc(defName(b))}${su ? `<span class="su" title="${b.cap ? 'SU generated per RPM' : 'SU used per RPM'}">${su}</span>` : ''}</button>`;
    }
    html += '</div>';
  }
  $('#palList').innerHTML = html || '<p class="empty" style="margin:12px">No blocks match.</p>';
}
$('#palList').addEventListener('click', e => {
  const h = e.target.closest('h3[data-cat]');
  if (h) { const c = h.dataset.cat; collapsed.has(c) ? collapsed.delete(c) : collapsed.add(c); safeSet('cfp-collapsed', JSON.stringify([...collapsed])); renderPalette(); return; }
  const b = e.target.closest('.pitem'); if (!b) return;
  S.cur = b.dataset.id; S.orient = 0;
  if (BY_ID[S.cur].tool) S.tool = 'belt'; else S.tool = 'place';
  renderPalette(); render();
  $('#palette').classList.remove('open');
});
$('#palSearch').addEventListener('input', renderPalette);

// ---------------- side panes ----------------
function setTab(t) { S.tab = t; for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === t)); renderPane(); }
document.querySelector('.tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
function renderPane() {
  const p = $('#pane');
  const fn = { inspect: paneInspect, networks: paneNetworks, production: paneProduction, checks: paneChecks, recipes: paneRecipes }[S.tab];
  const scroll = p.scrollTop;
  p.innerHTML = fn();
  p.scrollTop = scroll;
  if (S.tab === 'recipes') { const i = $('#rq'); if (i && document.activeElement?.id !== 'rq' && S._focusRq) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}

function itemChip(id, n, cls = '') {
  const tag = id[0] === '#';
  const members = tag ? (DATA.tags?.[id] || []).slice(0, 12).map(nameOf).join(', ') : '';
  return `<span class="it ${tag ? 'tag' : ''} ${cls}" title="${esc(tag ? id + (members ? ': ' + members : '') : id)}">${n !== undefined && n !== 1 ? `<b>${fmt(n, 2)}×</b>` : ''}${esc(nameOf(id))}</span>`;
}
function recipeHtml(r, opts = {}) {
  const ins = (r.i || []).map(([id, n]) => itemChip(id, n)).join('');
  const fl = (r.f || []).map(([id, a]) => `<span class="it fl" title="${esc(id)}"><b>${a} mB</b>${esc(nameOf(id))}</span>`).join('');
  const outs = (r.o || []).map(([id, n, ch]) => `<span class="it" title="${esc(id)}">${n > 1 ? `<b>${n}×</b>` : ''}${esc(nameOf(id))}${ch !== undefined && ch !== 1 && !r.weighted ? ` <b>${Math.round(ch * 100)}%</b>` : ''}</span>`).join('');
  const fo = (r.fo || []).map(([id, a]) => `<span class="it fl"><b>${a} mB</b>${esc(nameOf(id))}</span>`).join('');
  let steps = '';
  if (r.steps) steps = `<div class="mini">${r.loops}× loop: ${r.steps.map(s => esc(s.m) + (s.i?.length ? ' ' + s.i.map(x => nameOf(x[0])).join(', ') : '') + (s.f?.length ? ' ' + s.f.map(x => x[1] + ' mB ' + nameOf(x[0])).join(', ') : '')).join(' → ')}</div>`;
  if (r.weighted) {
    const tot = r.o.reduce((a, o) => a + (o[2] || 1), 0);
    return `<div class="rec">${itemChip(r.i[0][0])}<span class="arrow">→</span>${r.o.map(o => `<span class="it">${esc(nameOf(o[0]))} <b>${fmt((o[2] || 1) / tot * 100, 1)}%</b></span>`).join('')}</div>${steps}`;
  }
  return `<div class="rec">${ins}${fl}<span class="arrow">→</span>${outs}${fo}</div>${steps}`;
}
function timingMeta(r, mk, rpm, extra = {}) {
  const M = SIM.MACHINES[mk];
  const n = extra.n || 1;
  const t = SIM.opTicks(mk, r, rpm, n);
  if (t === null) return '<div class="meta">Manual</div>';
  const perMin = isFinite(t) && t > 0 ? 1200 / t * (M.timing === 'fan' || M.timing === 'crusher' ? n : 1) : 0;
  const parts = [`<span>${esc(M.label)}</span>`];
  if (isFinite(t)) parts.push(`<span class="t">${t} ticks · ${fmt(t / 20, 2)} s</span>`, `<span class="t">${fmt(perMin)} ops/min</span>`);
  else parts.push('<span class="t">stopped (no rotation)</span>');
  if (r.h) parts.push(`<span class="chip ${r.h === 'superheated' ? 'bad' : 'warn'}">${r.h}</span>`);
  if (M.kinetic) parts.push(`<span>@ ${fmt(Math.abs(rpm))} RPM</span>`);
  if (r.xp) parts.push(`<span>${r.xp} xp</span>`);
  return `<div class="meta">${parts.join('')}</div>`;
}

function machineKeyFor(b, r) {
  return SIM.machinesFor(r).find(mk => SIM.MACHINES[mk].blocks.includes(b.id)) || null;
}
function recipesForBlock(b) {
  const def = BY_ID[b.id];
  if (!def.proc) return [];
  return DATA.recipes.filter(r => SIM.machinesFor(r).some(mk => def.proc.includes(mk) && SIM.MACHINES[mk].blocks.includes(b.id)));
}
function fanCatalyst(b) {
  const r = SIM.fanRange(S.solve?.speed.get(b.k) || 0);
  const v = DIRS[b.f];
  for (let i = 1; i <= Math.floor(r); i++) {
    const n = S.world.get(key(b.x + v[0] * i, b.y + v[1] * i, b.z + v[2] * i));
    if (n && BY_ID[n.id].catalyst) return { type: BY_ID[n.id].catalyst, dist: i, id: n.id };
    if (n && n.id === 'minecraft:campfire') return { type: 'smoking_fan', dist: i, id: n.id };
    if (n && n.id === 'minecraft:soul_campfire') return { type: 'haunting', dist: i, id: n.id };
  }
  return null;
}

function cfgFields(b, def) {
  const c = b.cfg || {}; const f = [];
  const num = (k, label, min, max, step = 1) => f.push(`<label class="field" for="cfg-${k}">${label}<input id="cfg-${k}" data-cfg="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${c[k] ?? ''}"></label>`);
  const chk = (k, label) => f.push(`<label class="field" for="cfg-${k}">${label}<input id="cfg-${k}" data-cfg="${k}" type="checkbox" ${c[k] ? 'checked' : ''}></label>`);
  const sel = (k, label, opts) => f.push(`<label class="field" for="cfg-${k}">${label}<select id="cfg-${k}" data-cfg="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(c[k]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`);
  if (def.src && !def.engine) chk('reverse', 'Reverse direction');
  if (def.src && def.engine) chk('reverse', 'Reverse direction');
  if (b.id === 'create:hand_crank' || b.id === 'create:copper_valve_handle') chk('idle', 'Not being turned');
  if (b.id === 'create:windmill_bearing') num('sails', 'Sail blocks', 0, 2048);
  if (b.id === 'create:creative_motor') num('rpm', 'Speed (RPM)', -256, 256);
  if (def.rsc) num('rpm', 'Target speed (RPM)', -256, 256);
  if (def.split) chk('powered', 'Redstone powered');
  if (def.gs) num('signal', 'Redstone signal', 0, 15);
  if (def.seq) sel('ratio', 'Current step', [[1, 'Rotate ×1'], [2, 'Rotate ×2'], [-1, 'Reverse ×1'], [-2, 'Reverse ×2']]);
  if (b.id === 'create:blaze_burner') sel('heat', 'Heat', [['smouldering', 'Smouldering (no fuel)'], ['heated', 'Heated'], ['superheated', 'Superheated']]);
  if (b.id === 'create:fluid_tank') num('water', 'Water override (mB/t)', 0, 10000);
  if (b.id === 'create:encased_fan' || b.id === 'create:crushing_wheel') num('stack', 'Items per insert (stack)', 1, 64);
  return f.join('');
}

function paneInspect() {
  const b = S.sel && S.world.get(S.sel);
  if (!b) {
    const def = BY_ID[S.cur];
    return `<div><h4>Selected in palette</h4><h2>${esc(defName(def))}</h2><p class="desc">${esc(def.desc || '')}</p></div>
      ${statsTable(def)}
      <div class="empty">Click a placed block with the <b>Inspect</b> tool (2) to see its live speed, stress and recipe timing.</div>
      ${quickStart()}`;
  }
  const def = BY_ID[b.id], r = S.solve;
  const sp = r.speed.get(b.k), ni = r.netOf.get(b.k), net = ni !== undefined ? r.nets[ni] : null;
  const st = netStatus(net);
  let h = `<div><h4>${esc(CATS.find(c => c[0] === def.cat)[1])} · ${b.x}, ${b.y}, ${b.z}</h4><h2>${esc(defName(def))}</h2><p class="desc">${esc(def.desc || '')}</p></div>`;
  if (SIM.isKinetic(def)) {
    const use = def.su ? def.su * Math.abs(sp || 0) : 0;
    let src = '';
    if (def.src) { const s = net?.sources.find(x => x.k === b.k); src = `<dt>Generates</dt><dd>${fmt(s?.su || 0)} SU at ${fmt(Math.abs(s?.rpm || 0))} RPM</dd>`; }
    h += `<div><h4>Rotation</h4><dl class="kv"><dt>Status</dt><dd><span class="chip ${st.cls}">${st.label}</span></dd>
      <dt>Speed</dt><dd>${fmt(sp || 0)} RPM ${sp ? (sp > 0 ? '(+' + SIM.rotAxis(b, def) + ')' : '(−' + SIM.rotAxis(b, def) + ')') : ''}</dd>
      ${def.su ? `<dt>Stress use</dt><dd>${def.su} SU/RPM × ${fmt(Math.abs(sp || 0))} = ${fmt(use)} SU</dd>` : ''}${src}
      ${net ? `<dt>Network</dt><dd>#${net.id + 1}: ${fmt(net.impact)} / ${net.capacity === Infinity ? '∞' : fmt(net.capacity)} SU</dd>` : ''}</dl></div>`;
  }
  if (b.id === 'create:steam_engine' || b.id === 'create:fluid_tank') {
    const bo = r.boilers.find(x => x.tanks.some(t => t.k === b.k)) || r.boilers.find(x => x.tanks.some(t => [...Object.values(DIRS)].some(v => t.x + v[0] === b.x && t.y + v[1] === b.y && t.z + v[2] === b.z)));
    if (bo) h += `<div><h4>Boiler</h4><dl class="kv"><dt>Level</dt><dd>${bo.level} / 18</dd><dt>Heat</dt><dd>${bo.heat}</dd><dt>Size limit</dt><dd>${bo.size} tanks → ${bo.bySize}</dd><dt>Water</dt><dd>${fmt(bo.water)} mB/t → ${bo.byWater}</dd><dt>Engines</dt><dd>${bo.engines} at ${fmt(bo.eff * 100, 0)}% → ${bo.rpm} RPM</dd></dl></div>`;
  }
  if (def.fan) {
    const c = fanCatalyst(b);
    h += `<div><h4>Air current</h4><dl class="kv"><dt>Range</dt><dd>${fmt(SIM.fanRange(sp || 0))} blocks</dd><dt>Catalyst</dt><dd>${c ? esc(nameOf(c.id)) + ' at ' + c.dist + ' → ' + esc(SIM.MACHINES[c.type].label) : 'none in range'}</dd></dl></div>`;
  }
  if (def.drill) {
    const v = DIRS[b.f], tgt = S.world.get(key(b.x + v[0], b.y + v[1], b.z + v[2]));
    const rows = Object.entries(HARDNESS).slice(0, 6).map(([id, hd]) => `<dt>${esc(nameOf(id))}</dt><dd>${fmt(SIM.drillTicks(sp || 0, hd) / 20, 2)} s</dd>`).join('');
    h += `<div><h4>Break time @ ${fmt(Math.abs(sp || 0))} RPM</h4><dl class="kv">${tgt && BY_ID[tgt.id].hardness !== undefined ? `<dt>In front</dt><dd>${esc(nameOf(tgt.id))}: ${fmt(SIM.drillTicks(sp || 0, BY_ID[tgt.id].hardness) / 20, 2)} s</dd>` : ''}${rows}</dl></div>`;
  }
  if (def.arm) h += `<div><h4>Transfer</h4><dl class="kv"><dt>Per item</dt><dd>${sp ? SIM.TIMING.arm(Math.abs(sp)) + ' ticks' : 'stopped'}</dd></dl></div>`;
  if (def.pump) h += `<div><h4>Flow</h4><dl class="kv"><dt>Throughput</dt><dd>${sp ? fmt(Math.max(1, Math.abs(sp) / 2)) + ' mB/t · ' + fmt(Math.max(1, Math.abs(sp) / 2) * 20) + ' mB/s' : 'stopped'}</dd></dl></div>`;
  const belt = S.links.find(l => l.type === 'belt' && (l.a === b.k || l.b === b.k));
  if (belt) h += `<div><h4>Belt</h4><dl class="kv"><dt>Item speed</dt><dd>${fmt(Math.abs(sp || 0) / 24, 2)} blocks/s</dd></dl><div class="row" style="margin-top:6px"><button class="btn" data-act="rmlink" type="button">Remove belt</button></div></div>`;
  h += statsTable(def, true);
  const cf = cfgFields(b, def);
  if (cf) h += `<div><h4>Settings</h4><div style="display:flex;flex-direction:column;gap:6px">${cf}</div></div>`;
  if (def.proc) {
    const list = recipesForBlock(b);
    const cur = b.recipe && RECIPE.get(b.recipe);
    h += `<div><h4>Recipe (${list.length} available)</h4>`;
    if (cur) { const mk = machineKeyFor(b, cur); h += `<div class="card sel">${recipeHtml(cur)}${mk ? timingMeta(cur, mk, sp || 0, { n: Number(b.cfg?.stack) || 1 }) : ''}<div class="row"><button class="btn" data-act="clearRecipe" type="button">Clear recipe</button></div></div>`; }
    h += `<label class="field" for="recFilter" style="margin:8px 0 6px">Find<input id="recFilter" type="text" placeholder="item name" value="${esc(S._recFilter || '')}" style="width:170px"></label>`;
    const q = (S._recFilter || '').toLowerCase();
    const shown = list.filter(r => !q || r.o.some(o => nameOf(o[0]).toLowerCase().includes(q)) || r.i.some(i => nameOf(i[0]).toLowerCase().includes(q))).slice(0, 40);
    h += shown.map(r => { const mk = machineKeyFor(b, r); return `<div class="card pick" data-recipe="${esc(r.id)}" style="margin-bottom:6px">${recipeHtml(r)}${mk ? timingMeta(r, mk, sp || 0, { n: Number(b.cfg?.stack) || 1 }) : ''}</div>`; }).join('');
    if (list.length > shown.length) h += `<p class="mini">Showing ${shown.length} of ${list.length}. Type to narrow down.</p>`;
    h += '</div>';
  }
  h += `<div class="row"><button class="btn" data-act="delete" type="button">Remove block</button></div>`;
  return h;
}
function statsTable(def, compact) {
  const rows = [];
  if (def.su) rows.push(['Stress impact', `${def.su} SU per RPM`]);
  if (def.cap) rows.push(['Stress capacity', `${def.cap} SU per RPM`]);
  if (def.rpm && def.src && !def.engine && def.id !== 'create:windmill_bearing') rows.push(['Speed', `${def.rpm} RPM`]);
  for (const s of def.stats || []) rows.push(s);
  if (def.proc) rows.push(['Recipe types', def.proc.map(p => SIM.MACHINES[p]?.label || p).join(', ')]);
  if (!rows.length) return '';
  return `<div><h4>Stats</h4><dl class="kv">${rows.map(([a, v]) => `<dt>${esc(a)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`;
}
function quickStart() {
  return `<div class="card"><h4>Getting started</h4><p class="mini" style="margin:0">The sample factory is loaded: a windmill drives a press, a washing fan, a mixer with a heated basin and a millstone. Open <b>Power</b> to see stress, <b>Production</b> for item rates and <b>Checks</b> for problems. Use <b>File</b> to start a blank design or export a schematic.</p></div>`;
}

function paneNetworks() {
  const r = S.solve; if (!r) return '';
  const nets = r.nets.filter(n => n.members.length > 1 || n.sources.length);
  if (!nets.length) return '<div class="empty">No kinetic networks yet. Place a power source and connect shafts or cogs to machines.</div>';
  let h = `<div><h2>Power networks</h2><p class="desc">Each network shares one stress budget. Speeds come from Create’s own gear rules.</p></div>`;
  for (const n of nets) {
    const st = netStatus(n);
    const cap = n.capacity === Infinity ? null : n.capacity;
    const pct = cap ? Math.min(100, n.impact / cap * 100) : 0;
    const users = {};
    for (const m of n.members) { const d = BY_ID[m.id]; if (d.su) users[m.id] = (users[m.id] || 0) + d.su * Math.abs(r.speed.get(m.k)); }
    const top = Object.entries(users).sort((a, b) => b[1] - a[1]).slice(0, 5);
    h += `<div class="card pick" data-net="${n.id}">
      <div class="row" style="justify-content:space-between"><b>Network ${n.id + 1}${n.rscFrom ? ' (speed controller output)' : ''}</b><span class="chip ${st.cls}">${st.label}</span></div>
      <dl class="kv"><dt>Fastest part</dt><dd>${fmt(n.rpm)} RPM</dd><dt>Stress</dt><dd>${fmt(n.impact)} / ${cap === null ? 'charged to input' : fmt(cap)} SU</dd><dt>Blocks</dt><dd>${n.members.length}</dd>
      ${n.sources.length ? `<dt>Sources</dt><dd>${n.sources.map(s => esc(defName(BY_ID[S.world.get(s.k).id])) + ' ' + fmt(s.su) + ' SU').join('<br>')}</dd>` : ''}</dl>
      ${cap ? `<div class="bar ${st.cls === 'bad' ? 'bad' : pct > 85 ? 'warn' : ''}"><i style="width:${pct}%"></i></div>` : ''}
      ${top.length ? `<div class="mini">Biggest users: ${top.map(([id, v]) => esc(defName(BY_ID[id])) + ' ' + fmt(v) + ' SU').join(' · ')}</div>` : ''}
      ${n.conflict ? `<div class="mini" style="color:var(--bad)">Two paths want ${fmt(n.conflict.a)} and ${fmt(n.conflict.b)} RPM at ${n.conflict.at}. In-game the gears would break.</div>` : ''}
    </div>`;
  }
  return h;
}

function productionRows() {
  const r = S.solve, rows = [];
  for (const b of S.world.values()) {
    if (!b.recipe) continue;
    const rec = RECIPE.get(b.recipe); if (!rec) continue;
    const mk = machineKeyFor(b, rec); if (!mk) continue;
    const M = SIM.MACHINES[mk];
    const ni = r.netOf.get(b.k), net = ni !== undefined ? r.nets[ni] : null;
    const sp = Math.abs(r.speed.get(b.k) || 0);
    let running = !M.kinetic || (net && net.running && sp > 0);
    let why = running ? '' : !net || !sp ? 'no rotation' : netStatus(net).label.toLowerCase();
    if (running && M.timing === 'fan') { const c = fanCatalyst(b); if (!c || c.type !== mk) { running = false; why = 'needs ' + { splashing: 'water', smoking_fan: 'fire', blasting_fan: 'lava', haunting: 'soul fire' }[mk] + ' in front'; } }
    if (running && rec.h && rec.h !== 'none') {
      const basin = S.world.get(key(b.x, b.y - 2, b.z)), burner = S.world.get(key(b.x, b.y - 3, b.z));
      const heat = burner?.id === 'create:blaze_burner' ? burner.cfg?.heat : null;
      if (!heat || heat === 'smouldering' || (rec.h === 'superheated' && heat !== 'superheated')) { running = false; why = 'needs ' + rec.h + ' burner'; }
    }
    const n = Number(b.cfg?.stack) || 1;
    const t = SIM.opTicks(mk, rec, sp, n);
    const ops = running && t && isFinite(t) ? 1200 / t * (M.timing === 'fan' || M.timing === 'crusher' ? n : 1) : 0;
    rows.push({ b, rec, mk, ops, running, why });
  }
  return rows;
}
function paneProduction() {
  const rows = productionRows();
  if (!rows.length) return `<div><h2>Production</h2></div><div class="empty">No machine has a recipe yet. Inspect a press, mixer, fan, saw, furnace or other machine and pick a recipe; its speed comes from the network it’s on.</div>`;
  const totals = new Map();
  const add = (id, v) => totals.set(id, (totals.get(id) || 0) + v);
  for (const x of rows) {
    if (!x.ops) continue;
    for (const [id, n] of x.rec.i || []) add(id, -n * x.ops);
    for (const [id, a] of x.rec.f || []) add(id + '|fl', -a * x.ops);
    for (const [id, n] of SIM.expectedOut(x.rec)) add(id, n * x.ops);
    for (const [id, a] of x.rec.fo || []) add(id + '|fl', a * x.ops);
  }
  let h = `<div><h2>Production</h2><p class="desc">Rates are the most each machine can do at its current speed, per minute. Feeding and output logistics can lower them.</p></div>
  <table class="prod"><thead><tr><th>Machine</th><th>Recipe</th><th class="num">Ops/min</th></tr></thead><tbody>`;
  for (const x of rows) h += `<tr data-sel="${x.b.k}" style="cursor:pointer"><td>${esc(defName(BY_ID[x.b.id]))}<div class="mini">${x.b.x}, ${x.b.y}, ${x.b.z}</div></td><td>${esc(nameOf(x.rec.o[0]?.[0] || ''))}<div class="mini">${esc(SIM.MACHINES[x.mk].label)}</div></td><td class="num">${x.running ? fmt(x.ops) : `<span class="chip warn">${esc(x.why)}</span>`}</td></tr>`;
  h += '</tbody></table>';
  const tot = [...totals].filter(([, v]) => Math.abs(v) > 1e-6).sort((a, b) => b[1] - a[1]);
  if (tot.length) {
    h += `<div><h4>Net flow per minute</h4><table class="prod"><tbody>${tot.map(([id, v]) => { const fl = id.endsWith('|fl'); const real = fl ? id.slice(0, -3) : id; return `<tr><td>${esc(nameOf(real))}</td><td class="num ${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${fmt(v)}${fl ? ' mB' : ''}</td></tr>`; }).join('')}</tbody></table><p class="mini">Negative = what you need to supply. Chance outputs are counted at their average.</p></div>`;
  }
  return h;
}

function runChecks() {
  const r = S.solve, out = [];
  if (!r) return out;
  const belts = beltCells();
  const at = (x, y, z) => S.world.get(key(x, y, z));
  const surfaceBelow = (b, d = 2) => { const t = at(b.x, b.y - d, b.z); return belts.has(key(b.x, b.y - d, b.z)) || (t && ['create:depot', 'create:basin', 'create:weighted_ejector'].includes(t.id)); };
  for (const n of r.nets) {
    if (n.conflict) out.push({ sev: 'bad', k: n.conflict.at, t: `Network ${n.id + 1}: conflicting speeds`, d: `${fmt(n.conflict.a)} vs ${fmt(n.conflict.b)} RPM meet at ${n.conflict.at}. The gears would break; remove a link or a source.` });
    if (n.overstressed) out.push({ sev: 'bad', k: n.members[0].k, t: `Network ${n.id + 1}: overstressed`, d: `Needs ${fmt(n.impact)} SU but only ${fmt(n.capacity)} SU is available. Everything on it stops.` });
    if (n.overspeed) out.push({ sev: 'warn', k: n.members[0].k, t: `Network ${n.id + 1}: over 256 RPM`, d: 'Create caps speed at 256 RPM; parts above it will be clamped or break.' });
  }
  for (const b of S.world.values()) {
    const def = BY_ID[b.id], sp = r.speed.get(b.k) || 0;
    const name = defName(def);
    if (def.su && !sp && !def.tool) out.push({ sev: 'info', k: b.k, t: `${name} isn’t turning`, d: 'Connect it to a powered shaft or cog.' });
    if (b.id === 'create:mechanical_press' && !surfaceBelow(b)) out.push({ sev: 'warn', k: b.k, t: 'Press has nothing to press', d: 'Put a depot, belt or basin 2 blocks below it (one air gap).' });
    if (b.id === 'create:mechanical_mixer' && at(b.x, b.y - 2, b.z)?.id !== 'create:basin') out.push({ sev: 'warn', k: b.k, t: 'Mixer has no basin', d: 'Put a basin 2 blocks below it (one air gap).' });
    if ((b.id === 'create:mechanical_press' || b.id === 'create:mechanical_mixer') && at(b.x, b.y - 1, b.z)) out.push({ sev: 'bad', k: b.k, t: `${name} head is blocked`, d: 'The block directly below must be air for the head to move.' });
    if (b.id === 'create:spout' && !surfaceBelow(b)) out.push({ sev: 'warn', k: b.k, t: 'Spout has nothing to fill', d: 'Put a depot or belt 2 blocks below it.' });
    if (b.id === 'create:deployer' && b.f) { const v = DIRS[b.f]; const tk = key(b.x + 2 * v[0], b.y + 2 * v[1], b.z + 2 * v[2]); if (!belts.has(tk) && !S.world.get(tk)) out.push({ sev: 'info', k: b.k, t: 'Deployer has no target', d: 'It acts on the block 2 spaces in front (belt, depot or any block).' }); }
    if (b.recipe) {
      const rec = RECIPE.get(b.recipe);
      if (rec?.h && rec.h !== 'none' && b.id === 'create:mechanical_mixer' || rec?.h && b.id === 'create:mechanical_press' && rec.h !== 'none') {
        const burner = at(b.x, b.y - 3, b.z);
        const heat = burner?.id === 'create:blaze_burner' ? burner.cfg?.heat : null;
        if (!heat || heat === 'smouldering' || (rec.h === 'superheated' && heat !== 'superheated')) out.push({ sev: 'bad', k: b.k, t: `Recipe needs a ${rec.h} basin`, d: `Place a Blaze Burner (${rec.h}) directly under the basin.` });
      }
      if (def.fan) { const c = fanCatalyst(b); const mk = machineKeyFor(b, rec); if (!c || c.type !== mk) out.push({ sev: 'bad', k: b.k, t: 'Fan recipe has no catalyst', d: `Place ${{ splashing: 'water', smoking_fan: 'fire or a campfire', blasting_fan: 'lava', haunting: 'soul fire or a soul campfire' }[mk]} in the air stream within ${fmt(SIM.fanRange(sp))} blocks.` }); }
    }
    if (b.id === 'create:crushing_wheel') {
      const ax = b.axis, others = ['x', 'z', 'y'].filter(a => a !== ax);
      const pair = others.map(a => [a === 'x' ? 2 : 0, a === 'y' ? 2 : 0, a === 'z' ? 2 : 0]).flatMap(v => [v, v.map(x => -x)]).map(v => at(b.x + v[0], b.y + v[1], b.z + v[2])).find(n => n?.id === 'create:crushing_wheel' && n.axis === ax);
      if (!pair) out.push({ sev: 'warn', k: b.k, t: 'Crushing wheel needs a partner', d: 'Place a second wheel on the same axis 2 blocks away (one gap between them).' });
      else if (sp && (r.speed.get(pair.k) || 0) !== -sp) out.push({ sev: 'warn', k: b.k, t: 'Crushing wheels must spin inward', d: `They turn at ${fmt(sp)} and ${fmt(r.speed.get(pair.k) || 0)} RPM; they need equal speed in opposite directions.` });
    }
    if (b.id === 'create:water_wheel' || b.id === 'create:large_water_wheel') {
      const rad = b.id === 'create:water_wheel' ? 1 : 2; let wet = false;
      for (let dx = -rad; dx <= rad && !wet; dx++) for (let dy = -rad; dy <= rad && !wet; dy++) for (let dz = -rad; dz <= rad && !wet; dz++) if (at(b.x + dx, b.y + dy, b.z + dz)?.id === 'minecraft:water') wet = true;
      if (!wet) out.push({ sev: 'info', k: b.k, t: `${name}: no water placed`, d: 'In-game it needs flowing water touching its rim. The planner assumes it is supplied.' });
    }
    if (b.id === 'create:windmill_bearing' && (Number(b.cfg?.sails) || 0) < 8) out.push({ sev: 'bad', k: b.k, t: 'Windmill needs at least 8 sails', d: 'Set the sail count in its settings.' });
    if (b.id === 'create:steam_engine') {
      const bo = r.boilers.find(x => x.tanks.some(t => Object.values(DIRS).some(v => t.x + v[0] === b.x && t.y + v[1] === b.y && t.z + v[2] === b.z)));
      if (!bo) out.push({ sev: 'bad', k: b.k, t: 'Steam engine is not on a boiler', d: 'Place it against a Fluid Tank.' });
      else if (!bo.level) out.push({ sev: 'bad', k: b.k, t: 'Boiler is not producing steam', d: !bo.heat ? 'No heated Blaze Burner under the tank.' : !bo.bySize ? 'Boiler needs at least 4 tank blocks.' : 'Not enough water: pump it in (each level needs 10 mB/t) or set a water override on the tank.' });
    }
    if (b.id === 'create:track_station') {
      const near = Object.values(DIRS).some(v => at(b.x + v[0], b.y + v[1], b.z + v[2])?.id === 'create:track');
      if (!near) out.push({ sev: 'warn', k: b.k, t: 'Station is not next to track', d: 'Stations attach to the side of a track.' });
    }
    if (b.id === 'create:mechanical_harvester' || b.id === 'create:mechanical_plough' || b.id === 'create:mechanical_roller') {
      out.push({ sev: 'info', k: b.k, t: `${name} works on a moving contraption`, d: 'Attach it to a piston, bearing, gantry or cart contraption.' });
    }
  }
  const order = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}
function paneChecks() {
  const list = runChecks();
  if (!list.length) return `<div><h2>Checks</h2></div><div class="empty">No problems found.</div>`;
  return `<div><h2>Checks</h2><p class="desc">${list.filter(i => i.sev === 'bad').length} problems, ${list.filter(i => i.sev === 'warn').length} warnings, ${list.filter(i => i.sev === 'info').length} notes. Click one to select the block.</p></div>` +
    list.map(i => `<div class="issue ${i.sev}" data-sel="${i.k}"><div><b>${esc(i.t)}</b><span>${esc(i.d)}</span></div></div>`).join('');
}

function paneRecipes() {
  const q = S.recipeQuery.trim().toLowerCase();
  let h = `<div><h2>Recipe book</h2><p class="desc">${DATA.recipes.length.toLocaleString('en')} recipes from Create 6.0.11 and Minecraft 1.21.1, with times at the speed you pick.</p></div>
    <label class="field" for="rq">Item<input id="rq" type="search" placeholder="e.g. brass, iron sheet" value="${esc(S.recipeQuery)}" style="width:190px" autocomplete="off"></label>
    <label class="field" for="rrpm">Machine speed<span class="row"><input id="rrpm" type="range" min="1" max="256" value="${S.recipeRpm}" style="width:120px;accent-color:var(--brass)"><output style="font-family:var(--font-mono);min-width:5em">${S.recipeRpm} RPM</output></span></label>`;
  if (S.recipeItem) {
    const id = S.recipeItem;
    const makes = BYOUT.get(id) || [], uses = BYIN.get(id) || [];
    h += `<div class="row" style="justify-content:space-between"><h2 style="font-size:15px">${esc(nameOf(id))}</h2><button class="btn" data-act="backItems" type="button">Back</button></div>
      <div class="row"><button class="btn ${!S.showUses ? 'primary' : ''}" data-act="showMakes" type="button">Made by (${makes.length})</button><button class="btn ${S.showUses ? 'primary' : ''}" data-act="showUses" type="button">Used in (${uses.length})</button></div>`;
    const list = (S.showUses ? uses : makes).slice(0, 80);
    if (!list.length) h += '<div class="empty">Nothing here. This item is gathered, dropped or crafted only by a special recipe.</div>';
    for (const r of list) {
      const mks = SIM.machinesFor(r);
      h += `<div class="card">${recipeHtml(r)}${mks.map(mk => timingMeta(r, mk, S.recipeRpm)).join('')}<div class="mini">${esc(r.id)}</div></div>`;
    }
    return h;
  }
  if (!q) {
    const pop = ['create:brass_ingot', 'create:iron_sheet', 'create:andesite_alloy', 'create:precision_mechanism', 'create:crushed_raw_iron', 'create:wheat_flour', 'create:rose_quartz', 'minecraft:iron_ingot', 'create:blaze_cake', 'create:track', 'minecraft:glass'];
    h += `<div><h4>Common lookups</h4><div class="rec">${pop.map(id => `<button class="it" data-item="${id}" type="button" style="border:0;cursor:pointer">${esc(nameOf(id))}</button>`).join('')}</div></div>`;
    return h;
  }
  const ids = new Set([...BYOUT.keys(), ...BYIN.keys()]);
  const hits = [...ids].filter(id => id[0] !== '#' && nameOf(id).toLowerCase().includes(q)).sort((a, b) => (BYOUT.get(b)?.length || 0) - (BYOUT.get(a)?.length || 0)).slice(0, 60);
  h += hits.length ? `<div style="display:flex;flex-direction:column;gap:4px">${hits.map(id => `<button class="card pick" data-item="${id}" type="button" style="text-align:left;flex-direction:row;justify-content:space-between"><span>${esc(nameOf(id))}</span><span class="mini">${plural((BYOUT.get(id) || []).length, 'way')} · ${plural((BYIN.get(id) || []).length, 'use')}</span></button>`).join('')}</div>` : '<div class="empty">No items match.</div>';
  return h;
}

// pane events
$('#pane').addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-recipe],[data-sel],[data-net],[data-item]'); if (!t) return;
  const b = S.sel && S.world.get(S.sel);
  if (t.dataset.recipe && b) { pushHist(); b.recipe = t.dataset.recipe; update(); return; }
  if (t.dataset.sel) { S.sel = t.dataset.sel; const x = S.world.get(S.sel); if (x) controls.target.set(x.x, x.y, x.z); setTab('inspect'); render(); return; }
  if (t.dataset.net !== undefined) { const n = S.solve.nets[+t.dataset.net]; if (n?.members[0]) { S.sel = n.members[0].k; S.netView = true; render(); } return; }
  if (t.dataset.item) { S.recipeItem = t.dataset.item; S.showUses = false; renderPane(); $('#pane').scrollTop = 0; return; }
  switch (t.dataset.act) {
    case 'clearRecipe': pushHist(); delete b.recipe; update(); break;
    case 'delete': eraseAt(S.sel); break;
    case 'rmlink': pushHist(); S.links = S.links.filter(l => !(l.type === 'belt' && (l.a === b.k || l.b === b.k))); rebuildLinks(); update(); break;
    case 'backItems': S.recipeItem = null; renderPane(); break;
    case 'showUses': S.showUses = true; renderPane(); break;
    case 'showMakes': S.showUses = false; renderPane(); break;
  }
});
$('#pane').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'rq') { S.recipeQuery = t.value; S.recipeItem = null; S._focusRq = true; renderPane(); S._focusRq = false; return; }
  if (t.id === 'rrpm') { S.recipeRpm = +t.value; const pos = $('#pane').scrollTop; renderPane(); $('#pane').scrollTop = pos; return; }
  if (t.id === 'recFilter') { S._recFilter = t.value; const p = t.selectionStart; renderPane(); const n = $('#recFilter'); n.focus(); n.setSelectionRange(p, p); return; }
});
$('#pane').addEventListener('change', e => {
  const t = e.target; const k = t.dataset.cfg; if (!k) return;
  const b = S.sel && S.world.get(S.sel); if (!b) return;
  pushHist();
  b.cfg ||= {};
  if (t.type === 'checkbox') b.cfg[k] = t.checked;
  else if (t.type === 'number') b.cfg[k] = t.value === '' ? '' : Number(t.value);
  else b.cfg[k] = isNaN(Number(t.value)) ? t.value : Number(t.value);
  update();
});

// ---------------- file menu ----------------
let dl = null;
(async () => { try { dl = await window.claude?.use?.('downloads'); } catch { dl = null; } })();
async function saveFile(filename, data) {
  if (dl) {
    try { await dl.save({ filename, data }); toast('Saved ' + filename); } catch (e) { if (e?.code !== 'declined') toast('Could not save: ' + (e?.message || e?.code || 'unavailable')); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function fileMenu() {
  S.tab = 'file';
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', 'false');
  const p = $('#pane');
  const blocks = S.world.size;
  p.innerHTML = `<div><h2>File</h2><p class="desc">Designs autosave in this browser. Export to keep a copy or move it to another computer.</p></div>
  <div class="card"><h4>Design</h4><div class="row"><button class="btn" data-f="new" type="button">New blank design</button><button class="btn" data-f="example" type="button">Load sample factory</button></div></div>
  <div class="card"><h4>Save &amp; open</h4><div class="row"><button class="btn primary" data-f="json" type="button">Download .json</button><label class="btn" for="openFile" style="cursor:pointer">Open .json…</label><input id="openFile" type="file" accept=".json,application/json" hidden></div>
    <p class="mini" style="margin:0">Or copy the design as text and paste it into another planner:</p>
    <div class="row"><button class="btn" data-f="copy" type="button">Copy design text</button><button class="btn" data-f="paste" type="button">Load pasted text</button></div>
    <textarea id="jsonBox" placeholder="Paste design text here, then press “Load pasted text”."></textarea></div>
  <div class="card"><h4>Minecraft schematic</h4><p class="mini" style="margin:0">Exports ${blocks} blocks as a structure <b>.nbt</b> (Minecraft 1.21.1) inside a .zip. Unzip it into your instance’s <code>schematics</code> folder, then load it with Create’s Schematic Table and print it with a Schematicannon. Belts and chains are not included: place them by hand. Multi-block machines (water wheels, tanks, vaults) form themselves in-game.</p>
    <div class="row"><button class="btn primary" data-f="nbt" type="button">Export schematic (.zip)</button></div></div>
  <div class="card"><h4>Controls</h4><dl class="kv"><dt>Place / remove</dt><dd>Left click / right click</dd><dt>Orbit / pan / zoom</dt><dd>Right-drag / middle-drag / wheel</dd><dt>Tools</dt><dd>1 Place · 2 Inspect · 3 Erase · 4 Belt</dd><dt>Rotate</dt><dd>R (Shift+R back)</dd><dt>Layer</dt><dd>[ and ]</dd><dt>Undo / redo</dt><dd>Ctrl+Z / Ctrl+Y</dd><dt>Network colours</dt><dd>N</dd></dl></div>`;
}
$('#fileBtn').addEventListener('click', () => { fileMenu(); $('#side').classList.add('open'); });
$('#pane').addEventListener('click', async e => {
  const t = e.target.closest('[data-f]'); if (!t) return;
  switch (t.dataset.f) {
    case 'new': pushHist(); load({ blocks: [], links: [] }); toast('Started a blank design. Undo brings the old one back.'); fileMenu(); break;
    case 'example': pushHist(); load(EXAMPLE); toast('Sample factory loaded.'); fileMenu(); break;
    case 'json': saveFile('factory-design.json', JSON.stringify(serialize(), null, 1)); break;
    case 'copy': {
      const txt = JSON.stringify(serialize()); const box = $('#jsonBox'); box.value = txt;
      try { await navigator.clipboard.writeText(txt); toast('Design copied.'); } catch { box.select(); toast('Select-all is done: press Ctrl+C to copy.'); }
      break;
    }
    case 'paste': {
      try { const d = JSON.parse($('#jsonBox').value); pushHist(); load(d); toast('Design loaded.'); } catch { toast('That text is not a design. Paste the full copied text.'); }
      break;
    }
    case 'nbt': {
      const n = buildNbt(S.world);
      if (!n) { toast('Nothing to export yet.'); break; }
      const gz = await gzip(n.bytes);
      const z = zip([{ name: 'factory_design.nbt', bytes: gz }, { name: 'README.txt', bytes: new TextEncoder().encode(`Create Factory Planner export\nMinecraft 1.21.1 structure, ${n.count} blocks, size ${n.size.join('x')}.\nCopy factory_design.nbt into .minecraft/schematics, then use Create's Schematic Table.\nNot included: belts, chain conveyor chains (${n.skipped} items skipped).\n`) }]);
      saveFile('factory_design.zip', z);
      break;
    }
  }
});
$('#pane').addEventListener('change', e => {
  if (e.target.id !== 'openFile') return;
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { try { pushHist(); load(JSON.parse(t)); toast('Opened ' + f.name); } catch { toast('That file is not a planner design.'); } });
});

// ---------------- toolbar / keys ----------------
document.querySelector('[role=toolbar]').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { S.tool = b.dataset.tool; S.linkStart = null; render(); } });
$('#rotBtn').addEventListener('click', () => { S.orient++; updateGhost(); });
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#netBtn').addEventListener('click', () => { S.netView = !S.netView; render(); });
$('#layer').addEventListener('input', e => { S.layer = +e.target.value; $('#layerOut').textContent = S.layer >= 32 ? 'all' : 'y ≤ ' + S.layer; applyLayer(); render(); });
$('#openPal').addEventListener('click', () => $('#palette').classList.toggle('open'));
$('#openSide').addEventListener('click', () => $('#side').classList.toggle('open'));
canvasEl.addEventListener('pointerdown', () => { $('#palette').classList.remove('open'); $('#side').classList.remove('open'); });
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if (k === '1') S.tool = 'place'; else if (k === '2') S.tool = 'select'; else if (k === '3') S.tool = 'erase'; else if (k === '4') S.tool = 'belt';
  else if (k === 'r') { S.orient += e.shiftKey ? -1 : 1; updateGhost(); return; }
  else if (k === 'n') S.netView = !S.netView;
  else if (k === '[' || k === ']') { S.layer = Math.max(0, Math.min(32, S.layer + (k === ']' ? 1 : -1))); $('#layer').value = S.layer; $('#layer').dispatchEvent(new Event('input')); return; }
  else if ((k === 'delete' || k === 'backspace') && S.sel) { eraseAt(S.sel); return; }
  else if (k === 'escape') { S.linkStart = null; S.sel = null; }
  else return;
  S.linkStart = k === '4' ? null : S.linkStart; render();
});

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function save() { safeSet(STORE, snapshot()); }

// ---------------- animation ----------------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  if (S.solve) {
    for (const [k, m] of meshes) {
      if (!m.spin) continue;
      const ni = S.solve.netOf.get(k), net = ni !== undefined ? S.solve.nets[ni] : null;
      if (!net?.running) continue;
      const rpm = S.solve.speed.get(k) || 0;
      m.spin.rotation.y += rpm / 60 * Math.PI * 2 * dt * 0.5;
    }
    for (const lm of linkMeshes) {
      if (!lm.mesh.userData.tex) continue;
      const ni = S.solve.netOf.get(lm.l.a), net = ni !== undefined ? S.solve.nets[ni] : null;
      if (net?.running) lm.mesh.userData.tex.offset.y -= (S.solve.speed.get(lm.l.a) || 0) / 24 * dt * 0.5;
    }
  }
  renderer?.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------- boot ----------------
async function boot() {
  resize(); renderPalette(); render(); frame();
  try {
    const res = await fetch('recipes.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    window.__showProblem?.('The recipe data (recipes.json) could not be loaded.', 'Recipes and item names will be missing. Make sure recipes.json is next to index.html and that you opened the page through a web server. (' + (e.message || e) + ')');
  }
  for (const r of DATA.recipes) {
    RECIPE.set(r.id, r);
    for (const o of r.o || []) { if (!BYOUT.has(o[0])) BYOUT.set(o[0], []); BYOUT.get(o[0]).push(r); }
    for (const o of r.fo || []) { if (!BYOUT.has(o[0])) BYOUT.set(o[0], []); BYOUT.get(o[0]).push(r); }
    const ins = [...(r.i || []), ...(r.f || []), ...(r.steps || []).flatMap(s => [...(s.i || []), ...(s.f || [])])];
    for (const i of ins) {
      const ids = i[0][0] === '#' ? [i[0], ...(DATA.tags?.[i[0]] || [])] : [i[0]];
      for (const id of ids) { if (!BYIN.has(id)) BYIN.set(id, []); if (!BYIN.get(id).includes(r)) BYIN.get(id).push(r); }
    }
  }
  let saved = null; try { saved = JSON.parse(safeGet(STORE) || 'null'); } catch { }
  load(saved && saved.blocks?.length ? saved : EXAMPLE);
  renderPalette();
  window.__planner = { S, SIM, runChecks, productionRows, serialize, load };
}
boot();
