// Kinetic network + processing-time simulation, ported from Create 6.0.11 source
// (RotationPropagator, *BlockEntity timing code, BoilerData, PoweredShaftBlockEntity).
import { BY_ID, HARDNESS } from './blocks.js';

export const DIRS = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };
export const DIR_KEYS = Object.keys(DIRS);
export const opp = d => (d[0] === '+' ? '-' : '+') + d[1];
export const key = (x, y, z) => x + ',' + y + ',' + z;
const AX = { x: 0, y: 1, z: 2 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (t, a, b) => a + (b - a) * t;
export const MAX_RPM = 256;

export function rotAxis(b, def = BY_ID[b.id]) {
  const fa = b.f ? b.f[1] : 'y';
  switch (def.rot) {
    case 'facing': return fa;
    case 'perp': return fa === 'y' ? 'x' : (fa === 'x' ? 'z' : 'x');
    case 'hcw': return fa === 'x' ? 'z' : 'x';
    case 'y': return 'y';
    default: return b.axis || 'y';
  }
}
function hasShaft(b, def, d) {
  switch (def.sh) {
    case 'axis': return d[1] === rotAxis(b, def);
    case 'back': return b.f && d === opp(b.f);
    case 'front': return b.f === d;
    case 'down': return d === '-y';
    case 'gearbox': return d[1] !== (b.axis || 'y');
    default: return false;
  }
}
export const isKinetic = def => !!def && (def.sh !== 'none' || !!def.cog || !!def.src || !!def.chain);

function axisMod(b, def, d) {
  const sf = b._srcFace;
  if (!sf) return 1;
  if (def.sh === 'gearbox') {
    if (d[1] === sf[1]) return d === sf ? 1 : -1;
    return d[0] === sf[0] ? -1 : 1;
  }
  if (def.split === 'gearshift') return d !== sf && b.cfg?.powered ? -1 : 1;
  if (def.split === 'clutch') return d !== sf && b.cfg?.powered ? 0 : 1;
  if (def.seq) return d !== sf ? (Number(b.cfg?.ratio) || 1) : 1;
  return 1;
}
const chainMod = (b, def) => {
  if (!def.gs) return 1;
  const s = Number(b.cfg?.signal) || 0;
  return s === 0 ? 1 : 1 + (s + 1) / 16;
};

// Returns [{n, mod, face}] where face is the direction from n back toward b (n's source facing).
function neighbours(world, links, b) {
  const def = BY_ID[b.id], out = [];
  const ax = rotAxis(b, def);
  for (const d of DIR_KEYS) {
    if (!hasShaft(b, def, d)) continue;
    const v = DIRS[d], n = world.get(key(b.x + v[0], b.y + v[1], b.z + v[2]));
    if (!n) continue;
    const nd = BY_ID[n.id];
    if (!nd || !hasShaft(n, nd, opp(d))) continue;
    // Create: getAxisModifier(from, dir) / getAxisModifier(to, -dir); the target's modifier only
    // differs from 1 once it already has a source facing (i.e. when checking an existing link).
    const nm = n._srcFace ? axisMod(n, nd, opp(d)) : 1;
    if (nm === 0) continue;
    out.push({ n, mod: axisMod(b, def, d) / nm, face: opp(d), via: 'shaft' });
  }
  if (def.cog) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      const n = world.get(key(b.x + dx, b.y + dy, b.z + dz));
      if (!n) continue;
      const nd = BY_ID[n.id];
      if (!nd?.cog) continue;
      const diff = [dx, dy, dz], nax = rotAxis(n, nd);
      const man = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      let mod = 0;
      if (def.cog === 'l' && nd.cog === 'l' && ax !== nax) {
        let ok = true;
        for (const a of 'xyz') {
          const v = diff[AX[a]];
          if (a === ax || a === nax) { if (v === 0) ok = false; } else if (v !== 0) ok = false;
        }
        if (ok) mod = (diff[AX[ax]] > 0) !== (diff[AX[nax]] > 0) ? -1 : 1;
      } else if (ax === nax && diff[AX[ax]] === 0 && def.cog !== nd.cog) {
        const ok = [...'xyz'].filter(a => a !== ax).every(a => Math.abs(diff[AX[a]]) === 1);
        if (ok) mod = def.cog === 'l' ? -2 : -0.5;
      } else if (def.cog === 's' && nd.cog === 's' && man === 1 && ax === nax) {
        const dirAxis = dx ? 'x' : dy ? 'y' : 'z';
        if (dirAxis !== ax) mod = -1;
      }
      if (mod) out.push({ n, mod, face: null, via: 'gear' });
    }
  }
  if (def.chain) {
    for (const d of DIR_KEYS) {
      if (d[1] === ax) continue;
      const v = DIRS[d], n = world.get(key(b.x + v[0], b.y + v[1], b.z + v[2]));
      const nd = n && BY_ID[n.id];
      if (!nd?.chain || rotAxis(n, nd) !== ax) continue;
      out.push({ n, mod: chainMod(b, def) / chainMod(n, nd), face: null, via: 'chain' });
    }
  }
  for (const l of links) {
    const other = l.a === b.k ? l.b : l.b === b.k ? l.a : null;
    if (!other) continue;
    const n = world.get(other);
    if (n) out.push({ n, mod: 1, face: null, via: l.type });
  }
  return out;
}

// ---------- Boilers ----------
const TANK = 'create:fluid_tank';
const PIPEISH = new Set(['create:fluid_pipe', 'create:glass_fluid_pipe', 'create:encased_fluid_pipe', 'create:smart_fluid_pipe', 'create:fluid_valve', 'create:mechanical_pump']);
function groups(world, pred) {
  const seen = new Set(), res = [];
  for (const b of world.values()) {
    if (!pred(b) || seen.has(b.k)) continue;
    const g = [], q = [b]; seen.add(b.k);
    while (q.length) {
      const c = q.pop(); g.push(c);
      for (const d of DIR_KEYS) {
        const v = DIRS[d], n = world.get(key(c.x + v[0], c.y + v[1], c.z + v[2]));
        if (n && pred(n) && !seen.has(n.k)) { seen.add(n.k); q.push(n); }
      }
    }
    res.push(g);
  }
  return res;
}
function computeBoilers(world, speeds) {
  const boilers = [];
  const engineInfo = new Map();
  for (const g of groups(world, b => b.id === TANK)) {
    const set = new Set(g.map(b => b.k));
    const minY = Math.min(...g.map(b => b.y));
    let heat = 0, engines = [], water = 0, override = null;
    for (const t of g) {
      if (t.cfg?.water !== undefined && t.cfg.water !== '') override = Number(t.cfg.water);
      if (t.y === minY) {
        const below = world.get(key(t.x, t.y - 1, t.z));
        if (below?.id === 'create:blaze_burner') heat += below.cfg?.heat === 'superheated' ? 2 : below.cfg?.heat === 'smouldering' ? 0 : 1;
      }
      for (const d of DIR_KEYS) {
        const v = DIRS[d], n = world.get(key(t.x + v[0], t.y + v[1], t.z + v[2]));
        if (n?.id === 'create:steam_engine' && !engines.includes(n)) engines.push(n);
      }
    }
    // water: pumps connected to this tank through pipes
    const pipeSeen = new Set(), q = [];
    for (const t of g) for (const d of DIR_KEYS) {
      const v = DIRS[d], n = world.get(key(t.x + v[0], t.y + v[1], t.z + v[2]));
      if (n && PIPEISH.has(n.id) && !pipeSeen.has(n.k)) { pipeSeen.add(n.k); q.push(n); }
    }
    while (q.length) {
      const c = q.pop();
      if (c.id === 'create:mechanical_pump') water += Math.max(1, Math.abs(speeds.get(c.k) || 0) / 2) * ((speeds.get(c.k) || 0) ? 1 : 0);
      for (const d of DIR_KEYS) {
        const v = DIRS[d], n = world.get(key(c.x + v[0], c.y + v[1], c.z + v[2]));
        if (n && PIPEISH.has(n.id) && !pipeSeen.has(n.k) && !set.has(n.k)) { pipeSeen.add(n.k); q.push(n); }
      }
    }
    if (override !== null && !isNaN(override)) water = override;
    const bySize = Math.min(18, Math.floor(g.length / 4)), byWater = Math.min(18, Math.floor(Math.ceil(water) / 10));
    const level = Math.min(heat, bySize, byWater, 18);
    const eff = level === 0 || !engines.length ? 0 : engines.length <= level ? 1 : level / engines.length;
    const mod = 1 + (eff >= 1 ? 3 : Math.min(2, Math.floor(eff * 4)));
    const boiler = { tanks: g, size: g.length, heat, water, level, bySize, byWater, engines: engines.length, eff, rpm: eff ? 16 * mod : 0, suPerEngine: 16384 * eff };
    boilers.push(boiler);
    for (const e of engines) engineInfo.set(e.k, boiler);
  }
  return { boilers, engineInfo };
}

function sourceOutput(b, def, engineInfo) {
  const sign = b.cfg?.reverse ? -1 : 1;
  if (b.id === 'create:windmill_bearing') {
    const sails = Number(b.cfg?.sails) || 0;
    if (sails < 8) return { rpm: 0, su: 0 };
    const rpm = clamp(Math.floor(sails / 8), 1, 16);
    return { rpm: rpm * sign, su: rpm * 512 };
  }
  if (b.id === 'create:steam_engine') {
    const bo = engineInfo.get(b.k);
    if (!bo || !bo.rpm) return { rpm: 0, su: 0, boiler: bo };
    return { rpm: bo.rpm * sign, su: bo.suPerEngine, boiler: bo };
  }
  if (b.id === 'create:creative_motor') {
    const r = clamp(Number(b.cfg?.rpm ?? 16), -256, 256);
    return { rpm: r * sign, su: 16384 * Math.abs(r) };
  }
  if (b.id === 'create:hand_crank' || b.id === 'create:copper_valve_handle') {
    if (b.cfg?.idle) return { rpm: 0, su: 0 };
  }
  return { rpm: def.rpm * sign, su: def.rpm * def.cap };
}

// ---------- Main solver ----------
export function solve(world, links) {
  for (const b of world.values()) { b._srcFace = null; }
  let speeds = new Map();
  let result;
  // two passes: pumps feeding boilers depend on speeds, engines depend on boilers
  for (let pass = 0; pass < 3; pass++) {
    const { boilers, engineInfo } = computeBoilers(world, speeds);
    result = propagate(world, links, engineInfo);
    result.boilers = boilers;
    const same = [...result.speed].every(([k, v]) => speeds.get(k) === v) && speeds.size === result.speed.size;
    speeds = result.speed;
    if (same) break;
  }
  return result;
}

function propagate(world, links, engineInfo) {
  const speed = new Map(), netOf = new Map(), nets = [];
  const nodes = [...world.values()].filter(b => isKinetic(BY_ID[b.id]));
  for (const b of nodes) b._srcFace = null;
  // RSC: the large cog directly above an RSC is driven separately
  const rscTargets = new Map();
  for (const b of nodes) if (BY_ID[b.id].rsc) {
    const up = world.get(key(b.x, b.y + 1, b.z));
    if (up && BY_ID[up.id]?.cog === 'l') rscTargets.set(up.k, b);
  }
  const srcList = nodes.filter(b => BY_ID[b.id].src);
  // order: real sources first, then RSC outputs (so input network speed is known)
  const runNet = (start, startSpeed, kind) => {
    const net = { id: nets.length, members: [], sources: [], capacity: 0, impact: 0, conflict: null, overspeed: false, rscLoads: [] };
    nets.push(net);
    const q = [[start, startSpeed, null]];
    while (q.length) {
      const [b, s, face] = q.shift();
      if (netOf.has(b.k)) {
        const prev = speed.get(b.k);
        if (netOf.get(b.k) === net.id && Math.abs(prev - s) > 1e-3 && !net.conflict)
          net.conflict = { at: b.k, a: prev, b: s };
        continue;
      }
      netOf.set(b.k, net.id); speed.set(b.k, s); b._srcFace = face; net.members.push(b);
      if (Math.abs(s) > MAX_RPM + 1e-6) net.overspeed = true;
      for (const e of neighbours(world, links, b)) {
        if (e.mod === 0) continue;
        if (rscTargets.has(e.n.k) && rscTargets.get(e.n.k) === b) continue; // RSC→cog handled separately
        if (rscTargets.has(b.k) && BY_ID[e.n.id].rsc) continue;
        q.push([e.n, s * e.mod, e.face]);
      }
    }
    return net;
  };
  for (const s of srcList) {
    if (netOf.has(s.k)) continue;
    const out = sourceOutput(s, BY_ID[s.id], engineInfo);
    runNet(s, out.rpm, 'src');
  }
  // RSC outputs
  for (const [cogKey, rsc] of rscTargets) {
    if (netOf.has(cogKey)) continue;
    const inSpeed = speed.get(rsc.k) || 0;
    const target = inSpeed ? clamp(Number(rsc.cfg?.rpm ?? 64), -256, 256) : 0;
    const net = runNet(world.get(cogKey), target, 'rsc');
    net.rscFrom = rsc.k;
  }
  // stragglers (no power)
  for (const b of nodes) if (!netOf.has(b.k)) runNet(b, 0, 'idle');

  // second source conflicts: another source inside a net with a different generated speed
  for (const net of nets) {
    for (const b of net.members) {
      const def = BY_ID[b.id];
      if (def.su) net.impact += def.su * Math.abs(speed.get(b.k));
      if (def.src) {
        const out = sourceOutput(b, def, engineInfo);
        net.sources.push({ k: b.k, ...out });
        if (out.rpm && Math.abs(out.rpm - speed.get(b.k)) > 1e-3 && !net.conflict)
          net.conflict = { at: b.k, a: speed.get(b.k), b: out.rpm, sources: true };
        if (out.rpm) net.capacity += out.su;
      }
    }
  }
  // RSC output stress is charged to the input network
  for (const net of nets) if (net.rscFrom) {
    const inNet = nets[netOf.get(net.rscFrom)];
    if (inNet) { inNet.impact += net.impact; inNet.rscLoads.push(net.id); net.capacity = Infinity; }
  }
  for (const net of nets) {
    net.overstressed = net.impact > net.capacity + 1e-6 && net.capacity !== Infinity;
    if (net.rscFrom) { const inNet = nets[netOf.get(net.rscFrom)]; net.overstressed = inNet?.overstressed; }
    net.rpm = net.members.length ? Math.max(...net.members.map(m => Math.abs(speed.get(m.k)))) : 0;
    net.running = net.rpm > 0 && !net.overstressed && !net.conflict;
  }
  return { speed, netOf, nets };
}

// ---------- Processing timing ----------
// Each returns ticks for one operation at |rpm|.
export const TIMING = {
  press: rpm => { const s = Math.floor(lerp(clamp(rpm / 512, 0, 1), 1, 60)); return Math.ceil(240 / Math.max(1, s)); },
  mixer: (rpm, r) => {
    const rs = r?.t ? r.t / 100 : 1;
    const pt = Math.max(Math.floor(Math.log2(Math.max(1, Math.floor(512 / rpm)))) * Math.ceil(rs * 15) + 1, 1);
    return 40 + pt;
  },
  millstone: (rpm, r) => Math.ceil((r?.t || 100) / clamp(Math.floor(rpm / 16), 1, 512)),
  crusher: (rpm, r, n = 1) => {
    const s = rpm / 50;
    const ps = n > 1 ? clamp(s / Math.log2(n), 0.25, 20) : 20;
    return Math.ceil((r?.t || 100) / ps);
  },
  saw: (rpm, r) => { const s = clamp(rpm / 24, 1, 128); return Math.ceil((r?.t || 50) / s) + Math.ceil(20 / s); },
  deployer: rpm => { const s = clamp(rpm * 2, 8, 512); return 2 * Math.ceil(1000 / s) + 2; },
  fan: (rpm, r, n = 1) => 150 * (Math.floor((n - 1) / 16) + 1) + 1,
  crafter: rpm => Math.ceil(3000 / clamp(rpm, 4, 250)),
  spout: () => 20,
  drain: () => 20,
  arm: rpm => 2 * Math.ceil(1024 / Math.min(256, Math.max(rpm, 1))),
  fixed: (rpm, r) => r?.t || 200,
  vcrafter: () => 6,
};
export function drillTicks(rpm, hardness) {
  const bs = Math.abs(rpm) / 100; if (!bs) return Infinity;
  if (hardness <= 0) return 1;
  let p = 0, t = 0;
  while (p < 10) { p += clamp(Math.floor(bs / hardness), 1, 10 - p); if (p >= 10) break; t += Math.floor(hardness / bs) + 1; }
  return t + 1;
}
export const fanRange = rpm => lerp(Math.min(Math.abs(rpm) / 256, 1), 3, 20);

// Machine kinds: which recipe types, which blocks, which timing.
export const MACHINES = {
  pressing: { label: 'Pressing', blocks: ['create:mechanical_press'], timing: 'press', kinetic: true },
  compacting: { label: 'Compacting (Press + Basin)', blocks: ['create:mechanical_press'], timing: 'press', kinetic: true, basin: true },
  auto_compact: { label: 'Auto-compacting (Press + Basin)', blocks: ['create:mechanical_press'], timing: 'press', kinetic: true, basin: true },
  mixing: { label: 'Mixing (Mixer + Basin)', blocks: ['create:mechanical_mixer'], timing: 'mixer', kinetic: true, basin: true },
  auto_shapeless: { label: 'Shapeless mixing (Mixer + Basin)', blocks: ['create:mechanical_mixer'], timing: 'mixer', kinetic: true, basin: true },
  milling: { label: 'Milling', blocks: ['create:millstone', 'create:crushing_wheel'], timing: 'millstone', kinetic: true },
  crushing: { label: 'Crushing', blocks: ['create:crushing_wheel'], timing: 'crusher', kinetic: true },
  splashing: { label: 'Bulk washing (Fan + water)', blocks: ['create:encased_fan'], timing: 'fan', kinetic: true },
  smoking_fan: { label: 'Bulk smoking (Fan + fire)', blocks: ['create:encased_fan'], timing: 'fan', kinetic: true },
  blasting_fan: { label: 'Bulk blasting (Fan + lava)', blocks: ['create:encased_fan'], timing: 'fan', kinetic: true },
  haunting: { label: 'Bulk haunting (Fan + soul fire)', blocks: ['create:encased_fan'], timing: 'fan', kinetic: true },
  deploying: { label: 'Deploying', blocks: ['create:deployer'], timing: 'deployer', kinetic: true },
  item_application: { label: 'Item application (Deployer / hand)', blocks: ['create:deployer'], timing: 'deployer', kinetic: true },
  sandpaper_polishing: { label: 'Sandpaper polishing (Deployer)', blocks: ['create:deployer'], timing: 'deployer', kinetic: true },
  sequenced_assembly: { label: 'Sequenced assembly', blocks: ['create:deployer', 'create:mechanical_press', 'create:spout', 'create:mechanical_saw'], timing: 'seq', kinetic: true },
  cutting: { label: 'Sawing', blocks: ['create:mechanical_saw'], timing: 'saw', kinetic: true },
  stonecutting: { label: 'Stonecutting', blocks: ['create:mechanical_saw', 'minecraft:stonecutter'], timing: 'saw', kinetic: true },
  mechanical_crafting: { label: 'Mechanical crafting', blocks: ['create:mechanical_crafter'], timing: 'crafter', kinetic: true },
  crafting: { label: 'Crafting (Mechanical Crafter)', blocks: ['create:mechanical_crafter', 'minecraft:crafter', 'minecraft:crafting_table'], timing: 'crafter', kinetic: true },
  filling: { label: 'Filling (Spout)', blocks: ['create:spout'], timing: 'spout' },
  emptying: { label: 'Emptying (Item Drain)', blocks: ['create:item_drain'], timing: 'drain' },
  smelting: { label: 'Smelting', blocks: ['minecraft:furnace'], timing: 'fixed' },
  blasting: { label: 'Blasting', blocks: ['minecraft:blast_furnace'], timing: 'fixed' },
  smoking: { label: 'Smoking', blocks: ['minecraft:smoker'], timing: 'fixed' },
  campfire_cooking: { label: 'Campfire cooking', blocks: ['minecraft:campfire', 'minecraft:soul_campfire'], timing: 'fixed' },
  brewing: { label: 'Brewing (Brewing Stand)', blocks: ['minecraft:brewing_stand'], timing: 'fixed' },
  smithing: { label: 'Smithing', blocks: ['minecraft:smithing_table'], timing: 'none' },
};

// Recipe -> list of machine keys that can run it.
export function machinesFor(r) {
  const m = [];
  switch (r.m) {
    case 'crafting': {
      m.push('crafting');
      if (r.special) break;
      if (!r.shaped && r.i.reduce((a, x) => a + x[1], 0) >= 2) m.push('auto_shapeless');
      if (r.shaped && r.i.length === 1 && r.p) {
        const n = r.i[0][1], w = r.p[0].length, h = r.p.length;
        if ((n === 4 && w === 2 && h === 2) || (n === 9 && w === 3 && h === 3)) m.push('auto_compact');
      }
      break;
    }
    case 'smelting': m.push('smelting', 'blasting_fan'); break;
    case 'blasting': m.push('blasting', 'blasting_fan'); break;
    case 'smoking': m.push('smoking', 'smoking_fan'); break;
    case 'milling': m.push('milling'); break;
    default: if (MACHINES[r.m]) m.push(r.m);
  }
  return m;
}

// ticks for one operation of recipe r on machine mk at |rpm|
export function opTicks(mk, r, rpm, n = 1) {
  const M = MACHINES[mk]; if (!M) return null;
  rpm = Math.abs(rpm);
  if (M.timing === 'none') return null;
  if (M.kinetic && !rpm) return Infinity;
  if (M.timing === 'seq') {
    let per = 0;
    for (const s of r.steps) {
      const t = s.m === 'pressing' ? TIMING.press(rpm) : s.m === 'filling' ? 20 : s.m === 'cutting' ? TIMING.saw(rpm, s) : TIMING.deployer(rpm);
      per += t;
    }
    return per * (r.loops || 1);
  }
  if (mk === 'milling' && n === 'crusher') return TIMING.crusher(rpm, r, 1);
  if (M.timing === 'fixed') return r.t || 200;
  return TIMING[M.timing](rpm, r, n);
}
export function expectedOut(r) {
  if (r.weighted) { // sequenced assembly: first result is the main output by weight
    const tot = r.o.reduce((a, o) => a + (o[2] || 1), 0);
    return [[r.o[0][0], (r.o[0][2] || 1) / tot]];
  }
  return r.o.map(o => [o[0], (o[1] || 1) * (o[2] ?? 1)]);
}
export { HARDNESS };
