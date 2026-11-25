"""Build create-blocks.json: every Create 6.0.11 block with its block states, a placement mode, a display shape,
a palette group and the average colour of its texture.

Block list and states come from Create's generated blockstate files (one per registered block).
Colours follow blockstate -> model -> particle texture, looking in Create's generated and hand-written models
and falling back to vanilla assets for minecraft: references.

Usage: python3 build_create_blocks.py CREATE_REPO MC_ASSETS_DIR CREATE_LANG OUT_JSON
"""
import json, os, re, sys
from PIL import Image

CREATE, MCA, CLANG, OUT = sys.argv[1:5]
GEN = os.path.join(CREATE, 'src', 'generated', 'resources', 'assets', 'create')
MAIN = os.path.join(CREATE, 'src', 'main', 'resources', 'assets', 'create')
MC = os.path.join(MCA, 'assets', 'minecraft')
lang = json.load(open(CLANG))

def find(kind, ref, ext):
    ns, path = ref.split(':', 1) if ':' in ref else ('minecraft', ref)
    roots = [GEN, MAIN] if ns == 'create' else [MC]
    for r in roots:
        p = os.path.join(r, kind, path + ext)
        if os.path.exists(p): return p
    return None

def model_textures(ref, depth=0):
    p = find('models', ref, '.json')
    if not p or depth > 10: return {}
    m = json.load(open(p))
    tex = model_textures(m['parent'], depth + 1) if 'parent' in m else {}
    tex.update(m.get('textures', {}))
    return tex

def resolve(tex, key):
    v = tex.get(key); n = 0
    while isinstance(v, str) and v.startswith('#') and n < 10: v = tex.get(v[1:]); n += 1
    return v

cache = {}
def avg(ref):
    if ref in cache: return cache[ref]
    p = find('textures', ref, '.png'); c = None
    if p:
        im = Image.open(p).convert('RGBA'); w, h = im.size
        im = im.crop((0, 0, w, min(w, h)))
        data = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
        px = [q for q in data if q[3] > 40]
        if px: c = '#%02x%02x%02x' % tuple(round(sum(q[i] for q in px) / len(px)) for i in range(3))
    cache[ref] = c; return c

def states(bs):
    props = {}
    if 'variants' in bs:
        for k in bs['variants']:
            for kv in filter(None, k.split(',')):
                a, _, b = kv.partition('='); props.setdefault(a, set()).add(b)
    for part in bs.get('multipart', []):
        conds = part.get('when', {})
        for c in conds.get('OR', [conds]):
            for a, b in c.items():
                if a != 'OR': props.setdefault(a, set()).update(str(b).split('|'))
    return {k: sorted(v) for k, v in props.items()}

def first_model(bs):
    v = next(iter(bs['variants'].values())) if 'variants' in bs else bs['multipart'][0]['apply']
    return (v[0] if isinstance(v, list) else v)['model']

def colour(bid, bs):
    try:
        tex = model_textures(first_model(bs))
    except Exception:
        tex = {}
    for key in ('particle', 'all', 'side', 'texture', '0', '1', 'top', 'end', 'cross', 'pane', 'front'):
        t = resolve(tex, key)
        if t and not t.startswith('#'):
            c = avg(t)
            if c: return c
    return None

COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
STONES = ('asurine', 'crimsite', 'limestone', 'ochrum', 'scoria', 'scorchia', 'veridium', 'andesite', 'calcite', 'deepslate', 'diorite', 'dripstone', 'granite', 'tuff')

def shape(bid):
    if bid.endswith('_slab'): return 'vslab'
    if bid.endswith('_stairs'): return 'stairs'
    if bid.endswith('_wall'): return 'wall'
    if re.search(r'(_pane$|_bars$)', bid): return 'pane'
    if bid.endswith('_trapdoor'): return 'trapdoor'
    if bid.endswith('_door'): return 'vdoor'
    if bid.endswith('_window'): return 'glass'
    if re.search(r'framed_glass$|tiled_glass$', bid): return 'glass'
    if bid.endswith('_ladder'): return 'ladder'
    if bid.endswith('_scaffolding'): return 'frame'
    if bid.endswith('_seat'): return 'seat'
    if bid.endswith('_sail'): return 'sail'
    if bid.endswith('_table_cloth') or bid.endswith('_table_cover'): return 'slab'
    if bid.endswith('_valve_handle'): return 'crank'
    if bid.endswith('_nixie_tube'): return 'nixie'
    if bid.endswith('_toolbox') or bid.endswith('_postbox'): return 'box'
    if bid.startswith('copycat_'): return 'box'
    return 'cube'

def placement(props):
    if 'axis' in props: return 'axis' if len(props['axis']) == 3 else 'haxis'
    f = props.get('facing') or props.get('horizontal_facing')
    if f: return 'facing' if 'up' in f else 'hfacing'
    return 'none'

def group(bid):
    if any(bid.startswith(c + '_') for c in COLOURS): return 'ccolour'
    if bid.endswith('_ore') or bid.startswith('raw_zinc'): return 'cstone'
    if any(s in bid for s in STONES) and not re.search(r'(casing|funnel|tunnel|alloy)', bid): return 'cstone'
    if re.search(r'(window|glass|casing|bars|ladder|scaffolding|_door$|trapdoor|shingle|tile|girder|bracket|pillar|block_of|_block$|copycat|cardboard)', bid): return 'cbuild'
    return 'ctech'

out = []
for f in sorted(os.listdir(os.path.join(GEN, 'blockstates'))):
    bid = f[:-5]
    bs = json.load(open(os.path.join(GEN, 'blockstates', f)))
    props = states(bs)
    n = lang.get(f'block.create.{bid}') or bid.replace('_', ' ').title()
    out.append({'id': 'create:' + bid, 'n': n, 'c': colour(bid, bs) or '#9c9d94', 'pl': placement(props), 'm': shape(bid), 'cat': group(bid),
                'props': list(props.keys())})
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
from collections import Counter
print(len(out), 'create blocks', Counter(b['cat'] for b in out), 'no colour:', sum(1 for b in out if b['c'] == '#9c9d94'), os.path.getsize(OUT), 'bytes')
