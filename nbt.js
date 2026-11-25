// Minecraft structure (.nbt) writer for Create's Schematic Table / Schematicannon,
// plus a tiny store-only ZIP so the file can be offered as a download.
import { BY_ID } from './blocks.js';

const DATA_VERSION = 3955; // Minecraft 1.21.1
const MC_DIR = { '+x': 'east', '-x': 'west', '+y': 'up', '-y': 'down', '+z': 'south', '-z': 'north' };
const NON_BLOCKS = new Set(['create:belt', 'minecraft:minecart', 'minecraft:hopper_minecart', 'minecraft:chest_minecart']);
const RENAME = { 'minecraft:wheat': 'minecraft:wheat', 'minecraft:redstone_wire': 'minecraft:redstone_wire' };

class W {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 255); }
  i16(v) { this.u8(v >> 8); this.u8(v); }
  i32(v) { this.u8(v >> 24); this.u8(v >> 16); this.u8(v >> 8); this.u8(v); }
  str(s) { const e = new TextEncoder().encode(s); this.i16(e.length); for (const x of e) this.u8(x); }
}
// value encoders: {t:'int'|'string'|'compound'|'list', v, of?}
const T = { end: 0, int: 3, string: 8, list: 9, compound: 10 };
function payload(w, n) {
  switch (n.t) {
    case 'int': w.i32(n.v); break;
    case 'string': w.str(n.v); break;
    case 'list': w.u8(T[n.of]); w.i32(n.v.length); for (const x of n.v) payload(w, { t: n.of, v: x }); break;
    case 'compound':
      for (const [k, c] of Object.entries(n.v)) { w.u8(T[c.t]); w.str(k); payload(w, c); }
      w.u8(0); break;
  }
}
const I = v => ({ t: 'int', v }), S = v => ({ t: 'string', v }), C = v => ({ t: 'compound', v });

function stateOf(b) {
  const def = BY_ID[b.id];
  const props = {};
  if (def.pl === 'axis' || def.pl === 'haxis') props.axis = S(b.axis || 'y');
  if ((def.pl === 'facing' || def.pl === 'hfacing') && b.f) {
    if (b.id === 'create:mechanical_press' || def.pl === 'hfacing') props.facing = S(MC_DIR[b.f]);
    else props.facing = S(MC_DIR[b.f]);
  }
  if (b.id === 'create:blaze_burner') props.blaze = S(b.cfg?.heat === 'superheated' ? 'seething' : b.cfg?.heat === 'smouldering' ? 'smouldering' : 'kindled');
  if (b.id === 'minecraft:water' || b.id === 'minecraft:lava') props.level = S('0');
  return { Name: RENAME[b.id] || b.id, props };
}

export function buildNbt(world) {
  const blocks = [...world.values()].filter(b => !NON_BLOCKS.has(b.id));
  const skipped = [...world.values()].filter(b => NON_BLOCKS.has(b.id)).length;
  if (!blocks.length) return null;
  const min = [0, 1, 2].map(i => Math.min(...blocks.map(b => [b.x, b.y, b.z][i])));
  const max = [0, 1, 2].map(i => Math.max(...blocks.map(b => [b.x, b.y, b.z][i])));
  const palette = [], pIndex = new Map(), list = [];
  for (const b of blocks) {
    const s = stateOf(b);
    const k = s.Name + JSON.stringify(Object.entries(s.props).map(([a, v]) => [a, v.v]));
    if (!pIndex.has(k)) {
      pIndex.set(k, palette.length);
      const e = { Name: S(s.Name) };
      if (Object.keys(s.props).length) e.Properties = C(s.props);
      palette.push(e);
    }
    list.push({ pos: { t: 'list', of: 'int', v: [b.x - min[0], b.y - min[1], b.z - min[2]] }, state: I(pIndex.get(k)) });
  }
  const root = C({
    DataVersion: I(DATA_VERSION),
    size: { t: 'list', of: 'int', v: [0, 1, 2].map(i => max[i] - min[i] + 1) },
    palette: { t: 'list', of: 'compound', v: palette },
    blocks: { t: 'list', of: 'compound', v: list },
    entities: { t: 'list', of: 'end', v: [] },
  });
  const w = new W();
  w.u8(T.compound); w.str(''); payload(w, root);
  return { bytes: new Uint8Array(w.b), count: blocks.length, skipped, size: [0, 1, 2].map(i => max[i] - min[i] + 1) };
}

export async function gzip(bytes) {
  const cs = new CompressionStream('gzip');
  const out = new Blob([bytes]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

// store-only zip with one or more files: [{name, bytes}]
export function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  const le = (n, v) => { const a = []; for (let i = 0; i < n; i++) a.push((v >>> (8 * i)) & 255); return a; };
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), crc = crc32(f.bytes), sz = f.bytes.length;
    const head = [...le(4, 0x04034b50), ...le(2, 20), ...le(2, 0), ...le(2, 0), ...le(2, 0), ...le(2, 0x21), ...le(4, crc), ...le(4, sz), ...le(4, sz), ...le(2, name.length), ...le(2, 0)];
    parts.push(new Uint8Array(head), name, f.bytes);
    central.push(new Uint8Array([...le(4, 0x02014b50), ...le(2, 20), ...le(2, 20), ...le(2, 0), ...le(2, 0), ...le(2, 0), ...le(2, 0x21), ...le(4, crc), ...le(4, sz), ...le(4, sz), ...le(2, name.length), ...le(2, 0), ...le(2, 0), ...le(2, 0), ...le(2, 0), ...le(4, 0), ...le(4, offset)]), name);
    offset += head.length + name.length + sz;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new Uint8Array([...le(4, 0x06054b50), ...le(2, 0), ...le(2, 0), ...le(2, files.length), ...le(2, files.length), ...le(4, cdSize), ...le(4, offset), ...le(2, 0)]);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
