import json, glob, os, sys
S = sys.argv[1]; OUT = sys.argv[2]
CR = S + '/create/src/generated/resources/data/create/recipe'
VR = S + '/mcdata/data/minecraft/recipe'
clang = json.load(open(S + '/dl/create_en_us.json'))
mlang = json.load(open(S + '/dl/mc_en_us.json'))
names = {}
def nm(i):
    if i.startswith('#'): return i
    ns, p = i.split(':', 1)
    lang = clang if ns == 'create' else mlang
    for pre in ('item', 'block', 'fluid'):
        k = f'{pre}.{ns}.{p}'
        if k in lang: return lang[k]
    return p.replace('_', ' ').title()
used = set()
def ing(x):
    """returns ('item', id_or_tag, count) or ('fluid', id, amount)"""
    if isinstance(x, list):
        x = x[0]  # alternatives: show first
    if 'amount' in x and ('fluid' in x or x.get('type') in ('neoforge:tag', 'neoforge:single', 'fluid_stack') or 'tag' in x):
        f = x.get('fluid') or x.get('id') or ('#' + x['tag'])
        used.add(f); return ('fluid', f, x['amount'])
    if 'item' in x: i = x['item']
    elif 'tag' in x: i = '#' + x['tag']
    elif 'items' in x: i = x['items'][0] if isinstance(x['items'], list) else x['items']
    else: i = str(x)
    used.add(i); return ('item', i, x.get('count', 1))
def res(r):
    i = r.get('id') or r.get('item')
    used.add(i)
    if 'amount' in r: return ('fluid', i, r['amount'])
    return ('item', i, r.get('count', 1), r.get('chance', 1))
def split(lst):
    items, fl = [], []
    for e in lst:
        if e[0] == 'fluid': fl.append([e[1], e[2]])
        else: items.append(list(e[1:]))
    return items, fl
recipes = []
def add_create(d, rid):
    if d['type'].startswith('minecraft:'):
        return add_vanilla(d, rid)
    t = d['type'].split(':')[1]
    if t == 'sequenced_assembly':
        base = ing(d['ingredient'])
        steps = []
        for s in d['sequence']:
            ii, ff = split([ing(x) for x in s['ingredients'][1:]])
            st = {'m': s['type'].split(':')[1], 'i': ii, 'f': ff}
            if 'processing_time' in s: st['t'] = s['processing_time']
            steps.append(st)
        oi, of = split([res(r) for r in d['results']])
        tr = d.get('transitional_item', {}).get('id')
        recipes.append({'id': rid, 'm': t, 'i': [[base[1], 1]], 'steps': steps, 'loops': d.get('loops', 1), 'o': oi, 'weighted': True})
        return
    if t == 'mechanical_crafting':
        key = {k: ing(v)[1] for k, v in d['key'].items()}
        cnt = {}
        for row in d['pattern']:
            for ch in row:
                if ch != ' ': cnt[key[ch]] = cnt.get(key[ch], 0) + 1
        r = res(d['result'])
        recipes.append({'id': rid, 'm': t, 'i': [[k, v] for k, v in cnt.items()], 'o': [list(r[1:])], 'p': d['pattern'], 'k': key})
        return
    if t in ('crafting', 'blasting', 'smelting', 'smoking', 'campfire_cooking'):
        return add_vanilla(d, rid)
    ins = [ing(x) for x in d.get('ingredients', [])]
    ii, ff = split(ins)
    outs = [res(r) for r in d.get('results', [])]
    oi, of = split(outs)
    e = {'id': rid, 'm': t, 'i': ii, 'o': oi}
    if ff: e['f'] = ff
    if of: e['fo'] = of
    if 'processing_time' in d: e['t'] = d['processing_time']
    if 'heat_requirement' in d: e['h'] = d['heat_requirement']
    if d.get('keep_held_item'): e['keep'] = True
    recipes.append(e)
def add_vanilla(d, rid):
    t = d['type'].split(':')[1]
    if t.startswith('crafting_special') or t == 'crafting_decorated_pot' or t == 'smithing_trim':
        return
    if t == 'crafting_shaped':
        key = {k: ing(v)[1] for k, v in d['key'].items()}
        cnt = {}
        for row in d['pattern']:
            for ch in row:
                if ch != ' ': cnt[key[ch]] = cnt.get(key[ch], 0) + 1
        r = res(d['result'])
        recipes.append({'id': rid, 'm': 'crafting', 'shaped': True, 'i': [[k, v] for k, v in cnt.items()], 'o': [list(r[1:])], 'p': d['pattern'], 'k': key})
    elif t == 'crafting_shapeless':
        cnt = {}
        for x in d['ingredients']:
            i = ing(x)[1]; cnt[i] = cnt.get(i, 0) + 1
        r = res(d['result'])
        recipes.append({'id': rid, 'm': 'crafting', 'shaped': False, 'i': [[k, v] for k, v in cnt.items()], 'o': [list(r[1:])]})
    elif t in ('smelting', 'blasting', 'smoking', 'campfire_cooking'):
        r = res(d['result'])
        defaults = {'smelting': 200, 'blasting': 100, 'smoking': 100, 'campfire_cooking': 100}
        recipes.append({'id': rid, 'm': t, 'i': [[ing(d['ingredient'])[1], 1]], 'o': [list(r[1:])], 't': d.get('cookingtime', defaults[t]), 'xp': d.get('experience', 0)})
    elif t == 'stonecutting':
        r = res(d['result'])
        recipes.append({'id': rid, 'm': 'stonecutting', 'i': [[ing(d['ingredient'])[1], 1]], 'o': [list(r[1:])]})
    elif t == 'smithing_transform':
        r = res(d['result'])
        recipes.append({'id': rid, 'm': 'smithing', 'i': [[ing(d['template'])[1], 1], [ing(d['base'])[1], 1], [ing(d['addition'])[1], 1]], 'o': [list(r[1:])]})
skipped = 0
for f in sorted(glob.glob(CR + '/**/*.json', recursive=True)):
    d = json.load(open(f))
    conds = d.get('neoforge:conditions', [])
    if any(c.get('type') == 'neoforge:mod_loaded' or c.get('type') == 'neoforge:not' for c in conds) or '/compat/' in f:
        skipped += 1; continue
    rid = 'create:' + os.path.relpath(f, CR)[:-5]
    try: add_create(d, rid)
    except Exception as ex: print('ERR', rid, ex); skipped += 1
for f in sorted(glob.glob(VR + '/*.json')):
    d = json.load(open(f))
    add_vanilla(d, 'minecraft:' + os.path.basename(f)[:-5])
for u in used:
    if not u.startswith('#'): names[u] = nm(u)
# also name all create blocks/items for palette
for k, v in clang.items():
    p = k.split('.')
    if len(p) == 3 and p[0] in ('item', 'block') and p[1] == 'create': names['create:' + p[2]] = v
for k, v in mlang.items():
    p = k.split('.')
    if len(p) == 3 and p[0] in ('item', 'block') and p[1] == 'minecraft': names.setdefault('minecraft:' + p[2], v)
# ---------- tags ----------
TAGDIRS = [('minecraft', S + '/mcdata/data/minecraft/tags/item'), ('c', S + '/create/src/generated/resources/data/c/tags/item'), ('create', S + '/create/src/generated/resources/data/create/tags/item')]
raw = {}
for ns, d in TAGDIRS:
    for f in glob.glob(d + '/**/*.json', recursive=True):
        t = ns + ':' + os.path.relpath(f, d)[:-5]
        for v in json.load(open(f)).get('values', []):
            raw.setdefault(t, []).append(v['id'] if isinstance(v, dict) else v)
allids = set(names)
SPECIAL = {'c:dusts/redstone': ['minecraft:redstone'], 'c:gems/quartz': ['minecraft:quartz'], 'c:gems/lapis': ['minecraft:lapis_lazuli'],
  'c:eggs': ['minecraft:egg'], 'c:strings': ['minecraft:string'], 'c:leathers': ['minecraft:leather'], 'c:feathers': ['minecraft:feather'],
  'c:gunpowders': ['minecraft:gunpowder'], 'c:slimeballs': ['minecraft:slime_ball'], 'c:ender_pearls': ['minecraft:ender_pearl'],
  'c:obsidians': ['minecraft:obsidian', 'minecraft:crying_obsidian'], 'c:netherracks': ['minecraft:netherrack'],
  'c:cobblestones': ['minecraft:cobblestone', 'minecraft:cobbled_deepslate', 'minecraft:mossy_cobblestone'],
  'c:stones': ['minecraft:stone', 'minecraft:andesite', 'minecraft:diorite', 'minecraft:granite', 'minecraft:tuff', 'minecraft:deepslate'],
  'c:rods/wooden': ['minecraft:stick'], 'c:glass_blocks': ['minecraft:glass', 'minecraft:tinted_glass'], 'c:glass_blocks/colorless': ['minecraft:glass'],
  'c:glass_panes': ['minecraft:glass_pane'], 'c:glass_panes/colorless': ['minecraft:glass_pane'], 'c:sands/red': ['minecraft:red_sand'],
  'c:sands/colorless': ['minecraft:sand'], 'c:chests/wooden': ['minecraft:chest', 'minecraft:trapped_chest'], 'c:barrels/wooden': ['minecraft:barrel'],
  'c:player_workstations/crafting_tables': ['minecraft:crafting_table'], 'c:milk': ['minecraft:milk'], 'c:honey': ['create:honey'],
  'c:ingots/netherite': ['minecraft:netherite_ingot'],
  'c:stripped_logs': sorted(i for i in allids if i.startswith('minecraft:stripped_') and (i.endswith('_log') or i.endswith('_stem'))),
  'c:stripped_woods': sorted(i for i in allids if i.startswith('minecraft:stripped_') and (i.endswith('_wood') or i.endswith('_hyphae')))}
PATS = {'ingots': ['{m}_ingot'], 'nuggets': ['{m}_nugget'], 'storage_blocks': ['{m}_block'], 'raw_materials': ['raw_{m}'],
        'ores': ['{m}_ore', 'deepslate_{m}_ore'], 'dyes': ['{m}_dye'], 'plates': ['{m}_sheet']}
def guess(t):
    if t in SPECIAL: return SPECIAL[t]
    ns, path = t.split(':', 1)
    if ns != 'c' or '/' not in path: return []
    cat, mat = path.split('/', 1)
    return [f'{n}:{p.format(m=mat)}' for p in PATS.get(cat, []) for n in ('minecraft', 'create') if f'{n}:{p.format(m=mat)}' in allids]
memo = {}
def resolve(t, depth=0):
    if t in memo: return memo[t]
    res = []
    for v in raw.get(t, []):
        if v.startswith('#'): res += resolve(v[1:], depth + 1) if depth < 8 else []
        else: res.append(v)
    if not res: res = guess(t)
    memo[t] = sorted(set(res)); return memo[t]
used_tags = set()
def scan(lst):
    for i in lst:
        if i[0].startswith('#'): used_tags.add(i[0][1:])
for r in recipes:
    scan(r.get('i', []) + r.get('f', []))
    for st in r.get('steps', []): scan(st.get('i', []) + st.get('f', []))
tags = {'#' + t: resolve(t) for t in sorted(used_tags)}
print('tags', len(tags), 'unresolved', [t for t, v in tags.items() if not v])
out = {'version': {'create': '6.0.11', 'minecraft': '1.21.1'}, 'names': names, 'tags': tags, 'recipes': recipes}
js = json.dumps(out, separators=(',', ':'))
open(OUT, 'w').write(js)
from collections import Counter
print('recipes', len(recipes), 'skipped', skipped, 'names', len(names), 'bytes', len(js))
print(Counter(r['m'] for r in recipes))
