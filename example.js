// Sample factory shown on first open. A windmill (64 sails, 8 RPM) is geared up twice to 32 RPM
// and drives a press over a depot, a washing fan, a heated brass mixer and a millstone.
const C = id => 'create:' + id;
const b = [];
const add = (id, x, y, z, o = {}) => b.push({ id, x, y, z, ...o, cfg: o.cfg || {} });

add(C('windmill_bearing'), 0, 6, 0, { f: '-z', cfg: { sails: 64 } });
for (let i = 1; i <= 4; i++) {
  add(C('white_sail'), i, 6, -1, { f: '-z' }); add(C('white_sail'), -i, 6, -1, { f: '-z' });
  add(C('white_sail'), 0, 6 + i, -1, { f: '-z' }); if (6 - i >= 1) add(C('white_sail'), 0, 6 - i, -1, { f: '-z' });
}
add(C('sail_frame'), 0, 6, -1, { f: '-z' });
add(C('shaft'), 0, 6, 1, { axis: 'z' });
add(C('large_cogwheel'), 0, 6, 2, { axis: 'z' });
add(C('cogwheel'), 1, 7, 2, { axis: 'z' });
add(C('large_cogwheel'), 1, 7, 3, { axis: 'z' });
add(C('cogwheel'), 2, 8, 3, { axis: 'z' });
add(C('shaft'), 2, 8, 4, { axis: 'z' });
add(C('mechanical_press'), 2, 8, 5, { f: '+z', recipe: 'create:pressing/iron_ingot' });
add(C('depot'), 2, 6, 5);
add(C('shaft'), 2, 8, 6, { axis: 'z' });
add(C('gearbox'), 2, 8, 7, { axis: 'y' });
// washing line
add(C('shaft'), 2, 8, 8, { axis: 'z' });
add(C('encased_fan'), 2, 8, 9, { f: '+z', recipe: 'create:splashing/gravel', cfg: { stack: 16 } });
add('minecraft:water', 2, 8, 10);
add(C('depot'), 2, 8, 11);
// mixer + millstone
add(C('shaft'), 3, 8, 7, { axis: 'x' });
add(C('gearbox'), 4, 8, 7, { axis: 'z' });
add(C('cogwheel'), 4, 7, 7, { axis: 'y' });
add(C('mechanical_mixer'), 5, 7, 7, { recipe: 'create:mixing/brass_ingot' });
add(C('basin'), 5, 5, 7);
add(C('blaze_burner'), 5, 4, 7, { cfg: { heat: 'heated' } });
add(C('millstone'), 3, 7, 7, { recipe: 'create:milling/wheat' });
add(C('speedometer'), 1, 8, 7, { axis: 'x' });
add(C('stressometer'), 0, 8, 7, { axis: 'x' });
// supports
for (let y = 0; y < 6; y++) add(C('andesite_casing'), 2, y, 5);
for (let y = 0; y < 8; y++) add(C('andesite_casing'), 2, y, 11);
for (let y = 0; y < 4; y++) add(C('andesite_casing'), 5, y, 7);
for (let y = 0; y < 7; y++) add(C('andesite_casing'), 3, y, 7);
// vanilla smelting corner
add('minecraft:chest', -3, 2, 4, { f: '+x' });
add('minecraft:hopper', -3, 1, 4, { f: '-y' });
add('minecraft:furnace', -3, 0, 4, { f: '+x', recipe: 'minecraft:iron_ingot_from_smelting_raw_iron' });
add('minecraft:hopper', -3, 0, 5, { f: '+z' });
// a stretch of train line with a station
for (let x = -5; x <= 7; x++) add(C('track'), x, 0, -4, { f: '+x' });
add(C('track_station'), 1, 0, -3, { f: '+x' });
add(C('track_signal'), -4, 0, -3, { f: '+x' });

export const EXAMPLE = { v: 1, blocks: b, links: [] };
