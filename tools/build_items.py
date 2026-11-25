"""Build items.json: every item in Minecraft 1.21.1 and Create 6.0.11.

Vanilla: mcmeta 1.21.1-summary registries (item list) + item_components (stack size, durability, food, rarity, attack).
Create: every item model in the Create repo (generated + hand-written) that has an English name; stack size and
durability parsed from AllItems.java / AllBlocks.java.

Usage: python3 build_items.py SUMMARY_DIR CREATE_REPO MC_LANG CREATE_LANG OUT_JSON
"""
import json, os, re, sys, glob

SUM, CREATE, MCLANG, CLANG, OUT = sys.argv[1:6]
mlang = json.load(open(MCLANG)); clang = json.load(open(CLANG))
reg = json.load(open(os.path.join(SUM, 'registries', 'data.json')))
comps = json.load(open(os.path.join(SUM, 'item_components', 'data.json')))
vblocks = set(json.load(open(os.path.join(SUM, 'registries', 'data.json')))['block'])

def name(ns, path, lang):
    for k in ('item', 'block'):
        v = lang.get(f'{k}.{ns}.{path}')
        if v: return v
    return None

items = []
for path in reg['item']:
    if path == 'air': continue
    c = comps.get(path) or comps.get('minecraft:' + path) or {}
    g = lambda k: c.get('minecraft:' + k)
    e = {'id': 'minecraft:' + path, 'n': name('minecraft', path, mlang) or path.replace('_', ' ').title(), 's': g('max_stack_size') or 64}
    if g('max_damage'): e['d'] = g('max_damage')
    food = g('food')
    if food: e['f'] = [food.get('nutrition', 0), round(food.get('saturation', 0), 2)]
    if g('rarity') and g('rarity') != 'common': e['r'] = g('rarity')
    mods = (g('attribute_modifiers') or {}).get('modifiers', [])
    for m in mods:
        if m.get('type', '').endswith('attack_damage'): e['a'] = round(m['amount'] + 1, 2)
        if m.get('type', '').endswith('armor') and m.get('amount'): e['ar'] = m['amount']
    if path in vblocks: e['b'] = 1
    if g('fire_resistant') is not None or 'minecraft:fire_resistant' in c: e['fr'] = 1
    items.append(e)

# ---- Create ----
J = os.path.join(CREATE, 'src', 'main', 'java', 'com', 'simibubi', 'create')
src = open(os.path.join(J, 'AllItems.java')).read() + '\n' + open(os.path.join(J, 'AllBlocks.java')).read()
ARMOR = {'HELMET': 11, 'CHESTPLATE': 16, 'LEGGINGS': 15, 'BOOTS': 13}
props = {}
# Split the registration code at every registered name, so each item gets only its own builder calls.
marks = list(re.finditer(r'(?:\.item|REGISTRATE\.item|\.block|REGISTRATE\.block|ingredient|taggedIngredient|sequencedIngredient)\w*(?:<[^>]*>)?\(\s*"([a-z0-9_]+)"', src))
for i, m in enumerate(marks):
    chunk = src[m.end(): marks[i + 1].start() if i + 1 < len(marks) else len(src)]
    p = props.setdefault(m.group(1), {})
    sz = re.search(r'stacksTo\((\d+)\)', chunk)
    if sz: p['s'] = int(sz.group(1))
    d = re.search(r'durability\((\d+)\)', chunk)
    if d: p['d'] = int(d.group(1))
    a = re.search(r'durability\(Type\.(\w+)\.getDurability\((\d+)\)\)', chunk)
    if a: p['d'] = ARMOR[a.group(1)] * int(a.group(2))
    if 'fireResistant' in chunk: p['fr'] = 1
    for r in ('EPIC', 'RARE', 'UNCOMMON'):
        if 'Rarity.' + r in chunk: p['r'] = r.lower(); break
    nu = re.search(r'nutrition\((\d+)\)', chunk); sa = re.search(r'saturationModifier\(([0-9.]+)F?\)', chunk)
    if nu: p['f'] = [int(nu.group(1)), round(int(nu.group(1)) * float(sa.group(1)) * 2, 2) if sa else 0]

# Set inside the item classes rather than at registration (SandPaperItem: durability 8; BaseArmorItem: stacksTo 1).
for k in ('sand_paper', 'red_sand_paper'): props.setdefault(k, {})['d'] = 8
for k in ('copper_backtank', 'netherite_backtank'): props.setdefault(k, {})['s'] = 1

model_dirs = [os.path.join(CREATE, 'src', 'generated', 'resources', 'assets', 'create', 'models', 'item'),
              os.path.join(CREATE, 'src', 'main', 'resources', 'assets', 'create', 'models', 'item')]
paths = set()
for d in model_dirs:
    for f in glob.glob(d + '/*.json'): paths.add(os.path.basename(f)[:-5])
cblocks = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(CREATE, 'src', 'generated', 'resources', 'assets', 'create', 'blockstates', '*.json'))}
for path in sorted(paths):
    n = name('create', path, clang)
    if not n: continue  # internal render-only models (e.g. parts) have no name
    e = {'id': 'create:' + path, 'n': n, 's': 64, **props.get(path, {})}
    if 'd' in e: e['s'] = 1
    if path in cblocks: e['b'] = 1
    items.append(e)

json.dump(items, open(OUT, 'w'), separators=(',', ':'))
print(len(items), 'items:', sum(i['id'].startswith('minecraft:') for i in items), 'vanilla,', sum(i['id'].startswith('create:') for i in items), 'create;',
      os.path.getsize(OUT), 'bytes')
