"""Build vanilla-blocks.json: every Minecraft 1.21.1 block with its states, a placement mode,
a display shape, a palette group and an average texture colour.

Sources (github.com/misode/mcmeta):
  1.21.1-summary  blocks/data.min.json         block ids, properties and default state
  1.21.1-assets   assets/minecraft/blockstates, models/block, textures/block, lang/en_us.json

Usage: python3 build_vanilla_blocks.py SUMMARY_DIR ASSETS_DIR LANG_JSON OUT_JSON
"""
import json, os, re, sys
from PIL import Image

SUM, ASSETS, LANG, OUT = sys.argv[1:5]
MC = os.path.join(ASSETS, 'assets', 'minecraft')
blocks = json.load(open(os.path.join(SUM, 'blocks', 'data.min.json')))
lang = json.load(open(LANG))

# ---------- colour: blockstate -> model -> particle texture -> average colour ----------
def load_model(name):
    name = name.replace('minecraft:', '')
    p = os.path.join(MC, 'models', name + '.json')
    return json.load(open(p)) if os.path.exists(p) else None

def model_textures(name, depth=0):
    m = load_model(name)
    if not m or depth > 10: return {}
    tex = model_textures(m['parent'], depth + 1) if 'parent' in m else {}
    tex.update(m.get('textures', {}))
    return tex

def first_model(block):
    p = os.path.join(MC, 'blockstates', block + '.json')
    if not os.path.exists(p): return None
    bs = json.load(open(p))
    if 'variants' in bs:
        v = next(iter(bs['variants'].values()))
    else:
        v = bs['multipart'][0]['apply']
    if isinstance(v, list): v = v[0]
    return v['model']

def resolve(tex, key, depth=0):
    v = tex.get(key)
    while isinstance(v, str) and v.startswith('#') and depth < 10:
        v = tex.get(v[1:]); depth += 1
    return v

cache = {}
def avg_colour(texname):
    if texname in cache: return cache[texname]
    p = os.path.join(MC, 'textures', texname.replace('minecraft:', '') + '.png')
    if not os.path.exists(p): cache[texname] = None; return None
    im = Image.open(p).convert('RGBA')
    w, h = im.size
    im = im.crop((0, 0, w, min(h, w)))  # animated textures: first frame
    px = [q for q in (im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()) if q[3] > 40]
    if not px: cache[texname] = None; return None
    r = sum(q[0] for q in px) / len(px); g = sum(q[1] for q in px) / len(px); b = sum(q[2] for q in px) / len(px)
    cache[texname] = '#%02x%02x%02x' % (round(r), round(g), round(b))
    return cache[texname]

TINTS = {  # grass/foliage/water are tinted grey in the texture; use plains-biome tints
    'grass_block': '#7cbd6b', 'short_grass': '#79c05a', 'tall_grass': '#79c05a', 'fern': '#68a24a', 'large_fern': '#68a24a',
    'oak_leaves': '#59ae30', 'jungle_leaves': '#30bb0b', 'acacia_leaves': '#aea42a', 'dark_oak_leaves': '#59ae30', 'mangrove_leaves': '#92c648',
    'birch_leaves': '#80a755', 'spruce_leaves': '#619961', 'vine': '#59ae30', 'lily_pad': '#208030', 'water': '#3f76e4', 'bubble_column': '#3f76e4',
    'sugar_cane': '#7fb35a', 'attached_melon_stem': '#8a9a3a', 'attached_pumpkin_stem': '#8a9a3a', 'melon_stem': '#8a9a3a', 'pumpkin_stem': '#8a9a3a',
    'lava': '#d65a14', 'redstone_wire': '#b8352b', 'air': None, 'cave_air': None, 'void_air': None}

def colour_for(bid):
    if bid in TINTS: return TINTS[bid]
    mname = first_model(bid)
    if mname:
        tex = model_textures(mname)
        for key in ('particle', 'all', 'side', 'texture', 'top', 'end', 'cross', 'plant', 'pane', 'wool', 'pattern', 'front'):
            t = resolve(tex, key)
            if t and not t.startswith('#'):
                c = avg_colour(t)
                if c: return c
    for cand in (bid, bid + '_side', bid + '_top', re.sub(r'_(stairs|slab|wall|fence|fence_gate|pressure_plate|button)$', '', bid)):
        c = avg_colour('block/' + cand)
        if c: return c
    return '#8b8b88'

# ---------- shape, placement, group ----------
COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
PLANTS = re.compile(r'(sapling|flower|tulip|orchid|allium|bluet|daisy|poppy|dandelion|cornflower|lily_of_the_valley|wither_rose|torchflower|pitcher|rose_bush|lilac|peony|sunflower|'
                    r'short_grass|tall_grass|^fern$|large_fern|dead_bush|mushroom$|fungus$|roots$|sprouts|sea_grass|seagrass|kelp|coral$|coral_fan$|vines|^vine$|cobweb|sweet_berry_bush|'
                    r'cave_vines|glow_lichen|hanging_roots|spore_blossom|azalea$|propagule|bamboo_sapling|small_dripleaf|big_dripleaf_stem|pointed_dripstone|'
                    r'^wheat$|carrots|potatoes|beetroots|nether_wart|cocoa|melon_stem|pumpkin_stem|attached_|sugar_cane|^bamboo$|pink_petals|frogspawn|sculk_vein|twisting|weeping)')
TECH = re.compile(r'^(moving_piston|piston_head|end_gateway|end_portal|nether_portal|bubble_column|frosted_ice|fire|soul_fire|water|lava|light|barrier|structure_void|structure_block|jigsaw|command_block|chain_command_block|repeating_command_block|test_block|spawner|trial_spawner|vault|budding_amethyst|reinforced_deepslate|petrified_oak_slab)$|_wall_(sign|hanging_sign|banner|head|skull|torch|fan)$|^potted_|^wall_torch$|^soul_wall_torch$|^redstone_wall_torch$|_cauldron$|^infested_|^tall_seagrass$|^kelp_plant$|_plant$|^cave_vines_plant$|^big_dripleaf_stem$|^attached_')
REDSTONE = re.compile(r'redstone|repeater|comparator|piston|observer|^lever$|_button$|_pressure_plate$|daylight_detector|^target$|tripwire|note_block|dispenser|dropper|hopper|'
                      r'(^|_)rail$|^tnt$|lamp$|sculk_sensor|lightning_rod|copper_bulb|^crafter$|_door$|_trapdoor$|_fence_gate$|^bell$|trapped_chest|^slime_block$|^honey_block$')
FUNCTIONAL = re.compile(r'crafting_table|furnace|smoker|^chest$|ender_chest|barrel|shulker_box|anvil|_table$|brewing_stand|^cauldron$|beacon|campfire|_sign$|hanging_sign|_bed$|banner$|'
                        r'lantern|torch|candle|enchanting|lectern|loom|composter|stonecutter|grindstone|jukebox|bookshelf|respawn_anchor|lodestone|beehive|bee_nest|decorated_pot|'
                        r'_head$|_skull$|flower_pot|conduit|end_portal_frame|scaffolding|ladder|^chain$|end_rod|^cake$|_cake$|^bell$|^sponge$|wet_sponge|^suspicious_')
NATURAL = re.compile(r'_ore$|^(dirt|coarse_dirt|rooted_dirt|grass_block|podzol|mycelium|mud|clay|gravel|sand|red_sand|suspicious_sand|suspicious_gravel|snow|snow_block|ice|packed_ice|blue_ice|'
                     r'stone|deepslate|granite|diorite|andesite|tuff|calcite|dripstone_block|netherrack|basalt|blackstone|end_stone|obsidian|crying_obsidian|bedrock|magma_block|soul_sand|soul_soil|'
                     r'glowstone|amethyst_block|amethyst_cluster|large_amethyst_bud|medium_amethyst_bud|small_amethyst_bud|moss_block|moss_carpet|sculk|sculk_catalyst|sculk_shrieker|'
                     r'crimson_nylium|warped_nylium|nether_wart_block|warped_wart_block|shroomlight|bone_block|melon|pumpkin|carved_pumpkin|jack_o_lantern|hay_block|bee_nest|'
                     r'dried_kelp_block|sea_pickle|turtle_egg|sniffer_egg|frogspawn|mangrove_roots|muddy_mangrove_roots|pointed_dripstone|cactus|chorus_plant|chorus_flower|'
                     r'brown_mushroom_block|red_mushroom_block|mushroom_stem|azalea_leaves|flowering_azalea_leaves|cherry_leaves|lily_pad|big_dripleaf|powder_snow|farmland|dirt_path)$|'
                     r'_log$|_stem$|_leaves$|_wood$|_hyphae$|^raw_.*_block$|coral_block$')

def shape(bid, props):
    if bid in ('water', 'lava', 'bubble_column'): return 'fluid'
    if bid in ('fire', 'soul_fire'): return 'fire'
    if re.search(r'_slab$', bid): return 'vslab'
    if re.search(r'_stairs$', bid): return 'stairs'
    if re.search(r'_fence_gate$', bid): return 'gate'
    if re.search(r'_fence$', bid): return 'fence'
    if bid.endswith('_wall'): return 'wall'
    if re.search(r'(_pane$|_bars$|^iron_bars$)', bid): return 'pane'
    if re.search(r'_trapdoor$', bid): return 'trapdoor'
    if re.search(r'_door$', bid): return 'vdoor'
    if re.search(r'(_button$)', bid): return 'button'
    if re.search(r'_pressure_plate$', bid): return 'plate'
    if re.search(r'_carpet$', bid) or bid in ('snow', 'pink_petals', 'lily_pad', 'sculk_vein', 'glow_lichen', 'redstone_wire', 'tripwire'): return 'carpet'
    if re.search(r'(^|_)rail$', bid): return 'rail'
    if re.search(r'(torch|end_rod|lightning_rod|^chain$|candle$)', bid): return 'torch'
    if re.search(r'lantern$', bid): return 'lantern'
    if re.search(r'_bed$', bid): return 'bed'
    if re.search(r'(_sign$|hanging_sign$)', bid): return 'sign'
    if re.search(r'banner$', bid): return 'banner'
    if re.search(r'(_head$|_skull$)', bid): return 'head'
    if re.search(r'(^flower_pot$|^potted_)', bid): return 'pot'
    if re.search(r'(leaves$)', bid): return 'leaves'
    if re.search(r'(glass$|^ice$|^slime_block$|^honey_block$)', bid): return 'glass'
    if bid in ('ladder', 'vine', 'scaffolding'): return 'ladder' if bid != 'scaffolding' else 'frame'
    if bid in ('cake',) or bid.endswith('_cake'): return 'cakeblk'
    if bid in ('lever', 'daylight_detector', 'repeater', 'comparator', 'sculk_sensor', 'calibrated_sculk_sensor', 'stonecutter'): return 'vflat'
    if bid in ('enchanting_table', 'end_portal_frame'): return 'tall75'
    if bid in ('chest', 'trapped_chest', 'ender_chest'): return 'vchest'
    if re.search(r'(anvil$)', bid): return 'vanvil'
    if bid in ('hopper',): return 'hopper'
    if bid in ('cobweb',) or PLANTS.search(bid): return 'cross'
    if bid in ('air', 'cave_air', 'void_air', 'light', 'barrier', 'structure_void'): return 'ghost'
    return 'cube'

def placement(bid, props):
    if bid == 'hopper': return 'hopper'
    if 'axis' in props: return 'axis' if len(props['axis']) == 3 else 'haxis'
    f = props.get('facing')
    if f: return 'facing' if 'up' in f else 'hfacing'
    return 'none'

def group(bid):
    if TECH.search(bid): return 'vtech'
    if any(bid.startswith(c + '_') for c in COLOURS) and re.search(r'(wool|carpet|concrete|terracotta|stained_glass|candle|bed|banner|shulker_box|_glazed)', bid): return 'vcolour'
    if REDSTONE.search(bid): return 'vredstone'
    if FUNCTIONAL.search(bid): return 'vfunctional'
    if NATURAL.search(bid) or PLANTS.search(bid): return 'vnatural'
    return 'vbuilding'

out = []
for bid, (props, default) in sorted(blocks.items()):
    if bid in ('air', 'cave_air', 'void_air'): continue
    name = lang.get(f'block.minecraft.{bid}') or bid.replace('_', ' ').title()
    out.append({'id': 'minecraft:' + bid, 'n': name, 'c': colour_for(bid), 'pl': placement(bid, props), 'm': shape(bid, props),
                'cat': group(bid), 'props': list(props.keys())})
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
from collections import Counter
print(len(out), 'blocks', Counter(b['cat'] for b in out), Counter(b['m'] for b in out).most_common(12), os.path.getsize(OUT), 'bytes')
