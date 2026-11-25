import { solve, key, TIMING, drillTicks, opTicks } from '../sim.js';
let fails = 0;
const eq = (name, a, b) => { const ok = Math.abs(a - b) < 1e-6; if (!ok) fails++; console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name + ' got ' + a + ' want ' + b); };
function W(list) { const w = new Map(); for (const b of list) { b.k = key(b.x, b.y, b.z); b.cfg = b.cfg || {}; w.set(b.k, b); } return w; }
const C = id => 'create:' + id;
// 1. crank -> shaft line -> press
{ const w = W([{ id: C('hand_crank'), x: 0, y: 0, z: 0, f: '+x' }, { id: C('shaft'), x: -1, y: 0, z: 0, axis: 'x' }, { id: C('mechanical_press'), x: -2, y: 0, z: 0, f: '+x' }]);
  const r = solve(w, []); const n = r.nets[0];
  eq('crank speed at press', r.speed.get('-2,0,0'), 32); eq('capacity 256', n.capacity, 256); eq('impact 8*32', n.impact, 256); console.log('  overstressed', n.overstressed); }
// 2. small cog meshing reverses, large->small doubles
{ const w = W([{ id: C('creative_motor'), x: 0, y: -1, z: 0, f: '+y', cfg: { rpm: 32 } }, { id: C('large_cogwheel'), x: 0, y: 0, z: 0, axis: 'y' },
  { id: C('cogwheel'), x: 1, y: 0, z: 1, axis: 'y' }, { id: C('cogwheel'), x: 2, y: 0, z: 1, axis: 'y' }]);
  const r = solve(w, []);
  eq('large cog', r.speed.get('0,0,0'), 32); eq('small diag x2 reversed', r.speed.get('1,0,1'), -64); eq('small-small reverse', r.speed.get('2,0,1'), 64); }
// 3. gearbox: opposite side same, perpendicular reverse (per Create formula)
{ const w = W([{ id: C('creative_motor'), x: -1, y: 0, z: 0, f: '+x', cfg: { rpm: 16 } }, { id: C('gearbox'), x: 0, y: 0, z: 0, axis: 'y' },
  { id: C('shaft'), x: 1, y: 0, z: 0, axis: 'x' }, { id: C('shaft'), x: 0, y: 0, z: 1, axis: 'z' }, { id: C('shaft'), x: 0, y: 0, z: -1, axis: 'z' }]);
  const r = solve(w, []);
  console.log('  gearbox outs: +x', r.speed.get('1,0,0'), '+z', r.speed.get('0,0,1'), '-z', r.speed.get('0,0,-1')); }
// 4. conflict: loop of 3 small cogs in a triangle isn't possible; use 4 cogs square -> fine; make loop shaft+gear mismatch
{ const w = W([{ id: C('creative_motor'), x: 0, y: -1, z: 0, f: '+y', cfg: { rpm: 16 } }, { id: C('cogwheel'), x: 0, y: 0, z: 0, axis: 'y' }, { id: C('cogwheel'), x: 1, y: 0, z: 0, axis: 'y' },
  { id: C('cogwheel'), x: 1, y: 0, z: 1, axis: 'y' }, { id: C('cogwheel'), x: 0, y: 0, z: 1, axis: 'y' }]);
  console.log('  4-cog square conflict (expect none):', solve(w, []).nets[0].conflict);
  w.delete('1,0,1'); const b = { id: C('large_cogwheel'), x: 1, y: 0, z: 1, axis: 'y', cfg: {} }; b.k = '1,0,1';
}
// 5. windmill 24 sails -> 3 RPM, 1536 SU
{ const w = W([{ id: C('windmill_bearing'), x: 0, y: 0, z: 0, f: '+z', cfg: { sails: 24 } }, { id: C('shaft'), x: 0, y: 0, z: -1, axis: 'z' }]);
  const r = solve(w, []); eq('windmill rpm', r.speed.get('0,0,-1'), 3); eq('windmill SU', r.nets[0].capacity, 1536); }
// 6. boiler: 4 tanks (2x2), 2 superheated burners -> heat 4 but size/4 = 1 -> level 1, 1 engine full eff -> 64 rpm, 16384 SU
{ const L = [];
  for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) L.push({ id: C('fluid_tank'), x, y: 0, z, cfg: { water: 200 } });
  L.push({ id: C('blaze_burner'), x: 0, y: -1, z: 0, cfg: { heat: 'superheated' } }, { id: C('blaze_burner'), x: 1, y: -1, z: 0, cfg: { heat: 'superheated' } });
  L.push({ id: C('steam_engine'), x: -1, y: 0, z: 0, f: '-z' }, { id: C('shaft'), x: -1, y: 0, z: -1, axis: 'z' });
  const r = solve(W(L), []); const bo = r.boilers[0];
  eq('boiler level', bo.level, 1); eq('engine rpm', r.speed.get('-1,0,-1'), 64); eq('engine SU', r.nets.find(n => n.capacity).capacity, 16384); }
// 7. belt link
{ const w = W([{ id: C('creative_motor'), x: 0, y: 0, z: -1, f: '+z', cfg: { rpm: 64 } }, { id: C('shaft'), x: 0, y: 0, z: 0, axis: 'z' }, { id: C('shaft'), x: 5, y: 0, z: 0, axis: 'z' }]);
  const r = solve(w, [{ type: 'belt', a: '0,0,0', b: '5,0,0' }]); eq('belt far end', r.speed.get('5,0,0'), 64); }
// 8. RSC
{ const w = W([{ id: C('creative_motor'), x: -1, y: 0, z: 0, f: '+x', cfg: { rpm: 32 } }, { id: C('rotation_speed_controller'), x: 0, y: 0, z: 0, axis: 'x', cfg: { rpm: 128 } },
  { id: C('large_cogwheel'), x: 0, y: 1, z: 0, axis: 'x' }, { id: C('mechanical_press'), x: 1, y: 1, z: 0, f: '+x' }]);
  const r = solve(w, []); eq('rsc out', r.speed.get('1,1,0'), 128); eq('rsc load charged to input', r.nets[0].impact, 1024); }
// timings
eq('press ticks @256', TIMING.press(256), 8); eq('press @32', TIMING.press(32), 60);
eq('millstone wheat 150 @256', TIMING.millstone(256, { t: 150 }), 10);
eq('fan 1 item', TIMING.fan(256, null, 1), 151); eq('fan 64', TIMING.fan(256, null, 64), 601);
console.log('  mixer brass @256:', TIMING.mixer(256, {}), ' @32:', TIMING.mixer(32, {}));
console.log('  drill stone @256:', drillTicks(256, 1.5), ' obsidian:', drillTicks(256, 50), ' @32 stone:', drillTicks(32, 1.5));
console.log(fails ? fails + ' FAILED' : 'all passed');
{ const w = W([{ id: C('creative_motor'), x: 0, y: 0, z: -1, f: '+z', cfg: { rpm: 16 } }, { id: C('cogwheel'), x: 0, y: 0, z: 0, axis: 'z' }, { id: C('cogwheel'), x: 1, y: 0, z: 0, axis: 'z' }]);
  const r = solve(w, [{ type: 'belt', a: '0,0,0', b: '1,0,0' }]); console.log((r.nets[0].conflict ? 'ok  ' : 'FAIL') + ' mesh+belt conflict detected'); if (!r.nets[0].conflict) process.exitCode = 1; }
