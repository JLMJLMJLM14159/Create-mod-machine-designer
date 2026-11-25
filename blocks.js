// Block catalog for Create 6.0.11 + Minecraft 1.21.1.
// Stress values (su = SU per RPM consumed, cap = SU per RPM generated) are taken from
// Create's AllBlocks.java / BuilderTransformers.java (CStress.setImpact / setCapacity).
//
// Fields
//  id     registry id
//  cat    palette group
//  pl     placement: 'axis' (any axis), 'haxis' (horizontal axis), 'facing' (6 dirs),
//         'hfacing' (4 horizontal), 'none'
//  rot    rotation axis rule: 'axis' (= placed axis), 'facing' (= facing axis),
//         'perp' (horizontal axis perpendicular to facing; x when facing is vertical),
//         'y' (always vertical), 'hcw' (horizontal clockwise of facing)
//  sh     shaft faces: 'axis' | 'back' | 'front' | 'down' | 'gearbox' | 'none'
//  cog    's' small cog, 'l' large cog (mesh with neighbouring cogs)
//  su     stress impact per RPM;  cap: capacity per RPM;  rpm: generated speed (sources)
//  proc   recipe machine keys this block can run (see MACHINES in sim.js)
//  m      3D model key;  c: colour;  g: glyph shown on the block face
//  stats  extra rows for the info panel

const ANDESITE = '#9c9d94', BRASS = '#d4a03c', COPPER = '#c46e3d', TRAIN = '#4a5868',
  STONE = '#8b8b88', WOOD = '#9a7748', IRON = '#c8c8c4', DARK = '#3b3b40', REDSTONE = '#b8352b';

export const CATS = [
  ['power', 'Power sources'],
  ['transmission', 'Transmission'],
  ['processing', 'Processing'],
  ['gathering', 'Gathering & actors'],
  ['movers', 'Contraptions'],
  ['logistics', 'Item logistics'],
  ['packages', 'Packages & stock'],
  ['fluids', 'Fluids & steam'],
  ['logic', 'Gauges & logic'],
  ['trains', 'Trains'],
  ['vprocess', 'Vanilla processing'],
  ['vtransport', 'Vanilla transport'],
  ['vredstone', 'Vanilla redstone'],
  ['world', 'World & farms'],
];

const L = [];
function B(id, cat, o = {}) { L.push({ id: id.includes(':') ? id : 'create:' + id, cat, pl: 'none', sh: 'none', rot: 'axis', ...o }); }

// ---------- Power sources ----------
B('hand_crank', 'power', { pl: 'facing', rot: 'facing', sh: 'back', cap: 8, rpm: 32, src: true, m: 'crank', c: WOOD, g: 'HC',
  desc: 'Turned by a player. Outputs into the block behind it.', stats: [['Output', '32 RPM × 8 SU/RPM = 256 SU'], ['Hunger', 'Drains hunger while cranking']] });
B('copper_valve_handle', 'power', { pl: 'facing', rot: 'facing', sh: 'back', cap: 8, rpm: 32, src: true, m: 'crank', c: COPPER, g: 'VH',
  desc: 'Hand crank variant; can also rotate by a precise angle.', stats: [['Output', '32 RPM, 256 SU']] });
B('water_wheel', 'power', { pl: 'axis', rot: 'axis', sh: 'axis', cap: 32, rpm: 8, src: true, m: 'waterwheel', c: WOOD, g: 'WW',
  desc: 'Needs flowing water on one side (or a waterfall onto it).', stats: [['Output', '8 RPM × 32 SU/RPM = 256 SU'], ['Footprint', '1 block wheel, water touches its edge']] });
B('large_water_wheel', 'power', { pl: 'axis', rot: 'axis', sh: 'axis', cap: 128, rpm: 4, src: true, m: 'lwaterwheel', c: WOOD, g: 'LW', size: 3,
  desc: '3×3 wheel. Needs flowing water along its rim.', stats: [['Output', '4 RPM × 128 SU/RPM = 512 SU'], ['Footprint', '3×3 around the axle']] });
B('windmill_bearing', 'power', { pl: 'facing', rot: 'facing', sh: 'back', cap: 512, rpm: 1, src: true, cfg: { sails: 8 }, m: 'bearing', c: ANDESITE, g: 'WB',
  desc: 'Assembles attached sails into a windmill. Output goes out of its back.',
  stats: [['Speed', '1 RPM per 8 sail blocks, max 16 RPM'], ['Minimum', '8 sail blocks'], ['Output', '512 SU per RPM → 8,192 SU at 16 RPM']] });
B('sail_frame', 'power', { m: 'sail', c: WOOD, g: '', desc: 'Sail block for windmills (counts as 1 sail).' });
B('white_sail', 'power', { m: 'sail', c: '#e8e4dc', g: '', desc: 'Sail block for windmills (counts as 1 sail).' });
B('steam_engine', 'power', { pl: 'facing', rot: 'facing', sh: 'front', cap: 1024, rpm: 64, src: true, engine: true, m: 'engine', c: BRASS, g: 'SE',
  desc: 'Attach to a Fluid Tank boiler. Drives a shaft placed in front of it (the shaft becomes a Powered Shaft).',
  stats: [['Output', '16,384 SU per engine at full efficiency'], ['Speed', '16 / 32 / 48 / 64 RPM by efficiency'], ['Boiler level', 'min(heat, tank blocks ÷ 4, water mB/t ÷ 10), max 18'],
    ['Heat', 'Heated Blaze Burner = 1, Superheated = 2 per burner under the tank'], ['Efficiency', 'min(1, boiler level ÷ engines)']] });
B('creative_motor', 'power', { pl: 'facing', rot: 'facing', sh: 'front', cap: 16384, rpm: 16, src: true, cfg: { rpm: 16 }, m: 'motor', c: '#a368c9', g: 'CM',
  desc: 'Creative-only. Configurable speed, effectively unlimited stress.', stats: [['Speed', '-256 to 256 RPM']] });
B('flywheel', 'power', { pl: 'axis', rot: 'axis', sh: 'axis', m: 'flywheel', c: BRASS, g: '', desc: 'Decorative brass wheel that passes rotation through.' });

// ---------- Transmission ----------
B('shaft', 'transmission', { pl: 'axis', sh: 'axis', m: 'shaft', c: ANDESITE, beltable: true, desc: 'Transmits rotation along its axis.' });
B('cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 's', m: 'cog', c: WOOD, beltable: true, desc: 'Meshes with adjacent cogwheels (reverses direction, same speed).' });
B('large_cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 'l', m: 'lcog', c: WOOD, desc: 'Meshes diagonally with small cogs (×2 / ×0.5 speed) and with perpendicular large cogs.' });
B('andesite_encased_shaft', 'transmission', { pl: 'axis', sh: 'axis', m: 'eshaft', c: ANDESITE, desc: 'Shaft inside casing.' });
B('brass_encased_shaft', 'transmission', { pl: 'axis', sh: 'axis', m: 'eshaft', c: BRASS, desc: 'Shaft inside casing.' });
B('andesite_encased_cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 's', m: 'ecog', c: ANDESITE, desc: 'Cogwheel inside casing; meshes with neighbouring cogs.' });
B('brass_encased_cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 's', m: 'ecog', c: BRASS, desc: 'Cogwheel inside casing; meshes with neighbouring cogs.' });
B('andesite_encased_large_cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 'l', m: 'elcog', c: ANDESITE, desc: 'Large cogwheel inside casing.' });
B('brass_encased_large_cogwheel', 'transmission', { pl: 'axis', sh: 'axis', cog: 'l', m: 'elcog', c: BRASS, desc: 'Large cogwheel inside casing.' });
B('gearbox', 'transmission', { pl: 'axis', sh: 'gearbox', m: 'gearbox', c: ANDESITE, g: 'GB',
  desc: 'Transmits to the four sides around its axis. Outputs on the opposite side keep direction, outputs at 90° reverse.' });
B('clutch', 'transmission', { pl: 'axis', sh: 'axis', split: 'clutch', cfg: { powered: false }, m: 'split', c: ANDESITE, g: 'CL', desc: 'Disconnects the output side when powered by redstone.' });
B('gearshift', 'transmission', { pl: 'axis', sh: 'axis', split: 'gearshift', cfg: { powered: false }, m: 'split', c: BRASS, g: 'GS', desc: 'Reverses the output side when powered by redstone.' });
B('encased_chain_drive', 'transmission', { pl: 'axis', sh: 'axis', chain: true, m: 'chain', c: ANDESITE, g: 'CD', desc: 'Links to adjacent chain drives with the same axis (same speed and direction).' });
B('adjustable_chain_gearshift', 'transmission', { pl: 'axis', sh: 'axis', chain: true, gs: true, cfg: { signal: 0 }, m: 'chain', c: BRASS, g: 'AG',
  desc: 'Chain drive whose speed ratio follows redstone strength.', stats: [['Modifier', '1 at signal 0, else 1 + (signal + 1) ÷ 16 (up to ×2)']] });
B('belt', 'transmission', { tool: 'belt', m: 'beltitem', c: '#3d3a36', desc: 'Connects two shafts (up to 20 blocks, straight or 45°). Both ends turn at the same speed.',
  stats: [['Item speed', 'RPM ÷ 24 blocks per second'], ['Max length', '20 blocks']] });
B('chain_conveyor', 'transmission', { pl: 'none', rot: 'y', sh: 'axis', cog: 'l', su: 1, tool: 'chain', m: 'chainconv', c: ANDESITE, g: 'CC',
  desc: 'Create 6. Vertical large-cog hub; chains between hubs carry packages.', stats: [['Max chain length', '32 blocks'], ['Connections', 'Up to 4 per hub'], ['Capacity', '20 packages per chain (config)']] });
B('rotation_speed_controller', 'transmission', { pl: 'haxis', rot: 'axis', sh: 'axis', rsc: true, cfg: { rpm: 64 }, m: 'rsc', c: BRASS, g: 'RSC',
  desc: 'Sets the speed of the large cogwheel directly above it. That cog’s stress is charged to the input network.' });
B('sequenced_gearshift', 'transmission', { pl: 'axis', sh: 'axis', cfg: { ratio: 1 }, seq: true, m: 'split', c: BRASS, g: 'SQ',
  desc: 'Runs programmed rotate/wait steps on redstone. Here it is modelled as its current step ratio (−2, −1, 1 or 2).' });
B('gantry_shaft', 'transmission', { pl: 'axis', sh: 'axis', m: 'gantryshaft', c: ANDESITE, desc: 'Rail for Gantry Carriages. Passes rotation along its length.' });

// ---------- Processing ----------
B('mechanical_press', 'processing', { pl: 'hfacing', rot: 'facing', sh: 'axis', su: 8, proc: ['pressing', 'compacting', 'auto_compact'], m: 'press', c: ANDESITE, g: 'PR',
  desc: 'Presses items on a Depot or Belt 2 blocks below, or compacts in a Basin 2 blocks below.',
  stats: [['Cycle', '240 ÷ lerp(RPM/512, 1, 60) ticks'], ['Placement', 'One air gap above the belt / depot / basin']] });
B('mechanical_mixer', 'processing', { pl: 'none', rot: 'y', sh: 'none', cog: 's', su: 4, proc: ['mixing', 'auto_shapeless'], m: 'mixer', c: ANDESITE, g: 'MX',
  desc: 'Mixes the contents of a Basin 2 blocks below. Powered as a cogwheel from the side or above.',
  stats: [['Cycle', '40 + max(log2(512 ÷ RPM) × ⌈duration/100 × 15⌉ + 1, 1) ticks'], ['Heat', 'Recipes may need a Blaze Burner under the basin']] });
B('millstone', 'processing', { pl: 'none', rot: 'y', sh: 'down', cog: 's', su: 4, proc: ['milling'], m: 'millstone', c: STONE, g: 'MS',
  desc: 'Grinds items inserted from the top or sides. Powered from below or as a cog.', stats: [['Time', 'recipe ticks ÷ clamp(⌊RPM/16⌋, 1, 512)']] });
B('crushing_wheel', 'processing', { pl: 'axis', rot: 'axis', sh: 'axis', su: 8, proc: ['crushing', 'milling'], m: 'crusher', c: STONE, g: 'CW', size: 3,
  desc: 'Place two side by side, spinning in opposite directions, items fall in between.',
  stats: [['Speed', 'RPM ÷ 50 ÷ log2(stack size), clamped 0.25 – 20'], ['Quirk', 'Single items always crush at max speed (20/tick)'], ['Visual size', '3×3 wheel']] });
B('encased_fan', 'processing', { pl: 'facing', rot: 'facing', sh: 'back', su: 2, fan: true, proc: ['splashing', 'smoking_fan', 'blasting_fan', 'haunting'], m: 'fan', c: ANDESITE, g: 'FAN',
  desc: 'Blows air out of its front. Air passing through water/lava/fire/soul fire processes items in its path.',
  stats: [['Time', '150 ticks per 16 items in a stack (+1), any RPM'], ['Range', 'lerp(min(RPM/256, 1), 3, 20) blocks'],
    ['Catalysts', 'Water → washing · Fire/campfire → smoking · Lava → blasting · Soul fire → haunting']] });
B('deployer', 'processing', { pl: 'facing', rot: 'perp', sh: 'axis', su: 4, proc: ['deploying', 'item_application', 'sandpaper_polishing', 'sequenced_assembly'], m: 'deployer', c: ANDESITE, g: 'DP',
  desc: 'Uses the held item on whatever is 2 blocks in front (belt, depot or block).', stats: [['Cycle', '2 × ⌈1000 ÷ clamp(RPM × 2, 8, 512)⌉ ticks']] });
B('mechanical_saw', 'processing', { pl: 'facing', rot: 'facing', sh: 'back', su: 4, proc: ['cutting', 'stonecutting'], m: 'saw', c: ANDESITE, g: 'SAW',
  desc: 'Facing up: processes items on a belt/depot. Facing sideways: cuts trees and blocks.', stats: [['Time', '(recipe ticks + 20) ÷ clamp(RPM/24, 1, 128)'], ['Stonecutting', 'Runs vanilla stonecutter recipes']] });
B('mechanical_crafter', 'processing', { pl: 'hfacing', rot: 'perp', sh: 'none', cog: 's', su: 2, proc: ['crafting', 'mechanical_crafting'], m: 'crafter', c: BRASS, g: 'MC',
  desc: 'Arrange crafters in the recipe’s shape and chain them with arrows. Meshes like cogwheels.', stats: [['Speed', 'Countdown steps of 1000 at clamp(RPM, 4, 250) per tick, ≈3 steps per craft']] });
B('basin', 'processing', { m: 'basin', c: ANDESITE, g: '', desc: 'Holds items and fluids for Mixer and Press recipes.', stats: [['Inventory', '9 input slots, 2 fluid tanks of 1,000 mB']] });
B('blaze_burner', 'processing', { m: 'burner', c: '#e0782c', g: '', cfg: { heat: 'heated' },
  desc: 'Heats a Basin or boiler above. Fed with fuel; Blaze Cake → superheated.', stats: [['Heat levels', 'Smouldering · Heated (any fuel) · Superheated (Blaze Cake)']] });
B('depot', 'processing', { m: 'depot', c: ANDESITE, g: '', desc: 'Holds one stack for presses, deployers, spouts, saws and arms to work on.' });
B('item_drain', 'processing', { proc: ['emptying'], m: 'drain', c: COPPER, g: 'DR', desc: 'Empties fluid containers that pass over it.', stats: [['Time', '≈20 ticks per item'], ['Buffer', '1,500 mB']] });
B('spout', 'processing', { proc: ['filling'], m: 'spout', c: COPPER, g: 'SP', desc: 'Fills items on a belt or depot below it with fluid from pipes.', stats: [['Time', '20 ticks per fill'], ['Buffer', '1,000 mB']] });
B('schematicannon', 'processing', { m: 'box', c: DARK, g: 'SC', desc: 'Builds schematics using items from an adjacent inventory and gunpowder.' });

// ---------- Gathering / actors ----------
B('mechanical_drill', 'gathering', { pl: 'facing', rot: 'facing', sh: 'back', su: 4, drill: true, m: 'drill', c: ANDESITE, g: 'DRL',
  desc: 'Breaks the block in front. Works on contraptions too.', stats: [['Break speed', 'RPM ÷ 100 per step, 10 steps, wait ⌊hardness ÷ speed⌋ ticks between steps']] });
B('mechanical_harvester', 'gathering', { pl: 'hfacing', m: 'harvester', c: BRASS, g: 'HV', desc: 'Contraption actor: harvests and replants mature crops it moves through.' });
B('mechanical_plough', 'gathering', { pl: 'hfacing', m: 'plough', c: IRON, g: 'PL', desc: 'Contraption actor: tills soil and breaks small blocks.' });
B('mechanical_roller', 'gathering', { pl: 'hfacing', m: 'roller', c: ANDESITE, g: 'RL', desc: 'Contraption actor: paves or clears terrain (fill depth 12).' });
B('portable_storage_interface', 'gathering', { pl: 'facing', m: 'box', c: BRASS, g: 'PSI', desc: 'Transfers items between a passing contraption and a fixed inventory (timeout 60 ticks).' });
B('portable_fluid_interface', 'gathering', { pl: 'facing', m: 'box', c: COPPER, g: 'PFI', desc: 'Transfers fluids between a passing contraption and a fixed tank.' });
B('white_seat', 'gathering', { m: 'seat', c: '#e8e4dc', g: '', desc: 'Seats a player or mob; mobs on train seats can act as conductors.' });

// ---------- Contraption movers ----------
B('mechanical_piston', 'movers', { pl: 'facing', rot: 'perp', sh: 'axis', su: 4, m: 'piston', c: ANDESITE, g: 'MP', desc: 'Pushes attached blocks. Extension poles set its range.', stats: [['Max poles', '64'], ['Max blocks moved', '2,048']] });
B('sticky_mechanical_piston', 'movers', { pl: 'facing', rot: 'perp', sh: 'axis', su: 4, m: 'piston', c: '#7ba34a', g: 'SMP', desc: 'Mechanical piston that also pulls blocks back.' });
B('piston_extension_pole', 'movers', { pl: 'axis', m: 'pole', c: ANDESITE, desc: 'Extends a mechanical piston by one block each.' });
B('mechanical_bearing', 'movers', { pl: 'facing', rot: 'facing', sh: 'back', su: 4, m: 'bearing', c: ANDESITE, g: 'MB', desc: 'Rotates attached structures at the input speed.' });
B('clockwork_bearing', 'movers', { pl: 'facing', rot: 'facing', sh: 'back', su: 4, m: 'bearing', c: BRASS, g: 'CB', desc: 'Rotates clock hands to match the in-game time.' });
B('gantry_carriage', 'movers', { pl: 'facing', m: 'box', c: ANDESITE, g: 'GC', desc: 'Moves along a powered Gantry Shaft, carrying attached blocks.' });
B('rope_pulley', 'movers', { pl: 'hfacing', rot: 'hcw', sh: 'axis', su: 4, m: 'pulley', c: ANDESITE, g: 'RP', desc: 'Lowers and raises attached blocks on a rope.', stats: [['Max rope', '384 blocks']] });
B('elevator_pulley', 'movers', { pl: 'hfacing', rot: 'hcw', sh: 'axis', su: 4, m: 'pulley', c: BRASS, g: 'EP', desc: 'Rope pulley that stops at Elevator Contacts.' });
B('elevator_contact', 'movers', { m: 'box', c: BRASS, g: 'EC', desc: 'Marks a floor for an Elevator Pulley.' });
B('cart_assembler', 'movers', { m: 'rail', c: ANDESITE, g: 'CA', desc: 'Turns a passing minecart into a moving contraption.' });
B('linear_chassis', 'movers', { pl: 'axis', m: 'chassis', c: WOOD, g: '', desc: 'Glues blocks along its axis to a contraption (range 16).' });
B('secondary_linear_chassis', 'movers', { pl: 'axis', m: 'chassis', c: '#7a5a34', g: '', desc: 'Linear chassis that does not stick to other linear chassis.' });
B('radial_chassis', 'movers', { pl: 'axis', m: 'chassis', c: '#b38b52', g: '', desc: 'Glues blocks around its sides (range 16).' });
B('sticker', 'movers', { pl: 'facing', m: 'box', c: '#7ba34a', g: 'ST', desc: 'Toggles a sticky face on redstone; grabs or releases blocks.' });
B('contraption_controls', 'movers', { pl: 'hfacing', m: 'box', c: ANDESITE, g: 'CTL', desc: 'Toggles actors on a moving contraption.' });
B('turntable', 'movers', { rot: 'y', sh: 'down', su: 4, m: 'turntable', c: WOOD, g: '', desc: 'Spins entities standing on it. Powered from below.' });

// ---------- Item logistics ----------
B('andesite_funnel', 'logistics', { pl: 'facing', m: 'funnel', c: ANDESITE, g: '', desc: 'Inserts into / extracts from inventories and belts.', stats: [['Extraction', 'Up to 64 items every 8 ticks']] });
B('brass_funnel', 'logistics', { pl: 'facing', m: 'funnel', c: BRASS, g: '', desc: 'Funnel with filter and stack-size setting.', stats: [['Extraction', 'Filtered amount every 8 ticks']] });
B('andesite_tunnel', 'logistics', { m: 'tunnel', c: ANDESITE, g: '', desc: 'Covers a belt and splits items off to the sides.' });
B('brass_tunnel', 'logistics', { m: 'tunnel', c: BRASS, g: '', desc: 'Distributes items across adjacent belts (split, round-robin, prefer nearest, synchronise...).', stats: [['Timer', '10 ticks']] });
B('chute', 'logistics', { m: 'chute', c: IRON, g: '', desc: 'Moves items vertically (down by gravity, up with a fan).', stats: [['Speed', '4 blocks/s falling; fans add up to 20 blocks/s']] });
B('smart_chute', 'logistics', { m: 'chute', c: BRASS, g: '', desc: 'Chute with filter; pulls stacks from the inventory above.' });
B('weighted_ejector', 'logistics', { pl: 'hfacing', rot: 'hcw', sh: 'axis', su: 2, m: 'ejector', c: ANDESITE, g: 'EJ', desc: 'Launches items or entities to a target spot.', stats: [['Max distance', '32 blocks']] });
B('mechanical_arm', 'logistics', { rot: 'y', sh: 'down', cog: 's', su: 2, arm: true, m: 'arm', c: BRASS, g: '', desc: 'Picks up from chosen inputs and places into chosen outputs.',
  stats: [['Range', '5 blocks'], ['Move time', '⌈1024 ÷ min(RPM, 256)⌉ ticks per move (2 moves per transfer)']] });
B('item_vault', 'logistics', { m: 'vault', c: IRON, g: '', desc: 'Large storage. Merges with neighbouring vaults up to 3 wide.', stats: [['Capacity', '20 stacks per block']] });
B('item_hatch', 'logistics', { pl: 'hfacing', m: 'box', c: ANDESITE, g: 'IH', desc: 'Lets players dump inventory into an attached container.' });
B('creative_crate', 'logistics', { m: 'box', c: '#a368c9', g: 'CR', desc: 'Creative-only infinite item source.' });
B('black_toolbox', 'logistics', { m: 'box', c: DARK, g: 'TB', desc: 'Portable storage of 8 item types.' });

// ---------- Packages & stock (Create 6) ----------
B('packager', 'packages', { m: 'box', c: '#b0814b', g: 'PKG', desc: 'Packs items from an attached inventory into addressed packages.', stats: [['Cycle', '20 ticks per package']] });
B('repackager', 'packages', { m: 'box', c: '#8b6236', g: 'RPK', desc: 'Re-bundles split packages back into orders.' });
B('package_frogport', 'packages', { m: 'frog', c: '#6c9a50', g: '', desc: 'Sends and receives packages on a Chain Conveyor.' });
B('white_postbox', 'packages', { m: 'box', c: '#e8e4dc', g: 'PB', desc: 'Train station mailbox for packages.' });
B('stock_link', 'packages', { m: 'box', c: BRASS, g: 'SL', desc: 'Connects a Packager to a logistics network.' });
B('stock_ticker', 'packages', { m: 'box', c: BRASS, g: 'STK', desc: 'Shows network stock and places orders.' });
B('factory_gauge', 'packages', { m: 'gauge', c: BRASS, g: 'FG', desc: 'Keeps a target amount in stock by requesting ingredients.', stats: [['Timer', '100 ticks']] });
B('redstone_requester', 'packages', { m: 'box', c: REDSTONE, g: 'RQ', desc: 'Orders a preset list of items on redstone.' });
B('white_table_cloth', 'packages', { m: 'slab', c: '#e8e4dc', g: '', desc: 'Shop display for trading via Stock Keepers.' });

// ---------- Fluids & steam ----------
B('fluid_pipe', 'fluids', { pl: 'axis', m: 'pipe', c: COPPER, desc: 'Carries fluid. Transfer rate is set by pump pressure.', stats: [['Rate', 'max(1, RPM ÷ 2) mB per tick per pump']] });
B('glass_fluid_pipe', 'fluids', { pl: 'axis', m: 'pipe', c: '#cfe3e6', desc: 'Straight pipe that shows its contents.' });
B('encased_fluid_pipe', 'fluids', { pl: 'axis', m: 'epipe', c: COPPER, desc: 'Pipe in copper casing.' });
B('smart_fluid_pipe', 'fluids', { pl: 'facing', m: 'pipe', c: BRASS, desc: 'Filtered pipe; only lets the chosen fluid through.' });
B('fluid_valve', 'fluids', { pl: 'axis', rot: 'axis', sh: 'axis', m: 'pipe', c: '#7c7c7c', desc: 'Opens or closes a pipe with rotation or redstone.' });
B('mechanical_pump', 'fluids', { pl: 'facing', rot: 'facing', sh: 'axis', cog: 's', su: 4, pump: true, m: 'pump', c: COPPER, g: '', desc: 'Pushes fluid in its facing direction.',
  stats: [['Throughput', 'max(1, RPM ÷ 2) mB per tick → 128 mB/t at 256 RPM'], ['Range', '16 blocks of pipe']] });
B('fluid_tank', 'fluids', { m: 'tank', c: COPPER, g: '', desc: 'Stores fluid. Merges up to 3×3 wide and 32 tall. Becomes a boiler with Steam Engines.', stats: [['Capacity', '8 buckets (8,000 mB) per block']] });
B('creative_fluid_tank', 'fluids', { m: 'tank', c: '#a368c9', g: '', desc: 'Creative-only infinite fluid.' });
B('hose_pulley', 'fluids', { pl: 'hfacing', rot: 'hcw', sh: 'axis', su: 4, m: 'pulley', c: COPPER, g: 'HP', desc: 'Drains or fills fluid bodies below it.', stats: [['Range', '128 blocks'], ['Infinite', 'Sources over 10,000 blocks never run dry']] });
B('steam_whistle', 'fluids', { m: 'whistle', c: BRASS, g: '', desc: 'Plays a note from boiler steam.' });

// ---------- Gauges & logic ----------
B('speedometer', 'logic', { pl: 'axis', sh: 'axis', m: 'gauge', c: ANDESITE, g: 'RPM', desc: 'Shows the rotation speed passing through.' });
B('stressometer', 'logic', { pl: 'axis', sh: 'axis', m: 'gauge', c: ANDESITE, g: 'SU', desc: 'Shows the network’s stress use against capacity.' });
B('stockpile_switch', 'logic', { m: 'box', c: BRASS, g: 'TS', desc: 'Emits redstone based on how full an attached inventory or tank is.' });
B('content_observer', 'logic', { m: 'box', c: BRASS, g: 'OB', desc: 'Emits redstone when a filtered item/fluid is present.' });
B('redstone_link', 'logic', { m: 'slab', c: BRASS, g: 'RL', desc: 'Wireless redstone transmitter/receiver (range 256).' });
B('pulse_repeater', 'logic', { m: 'slab', c: REDSTONE, g: 'PR', desc: 'Outputs a 1-tick pulse after a delay.' });
B('pulse_extender', 'logic', { m: 'slab', c: REDSTONE, g: 'PE', desc: 'Extends a pulse by a set time.' });
B('pulse_timer', 'logic', { m: 'slab', c: REDSTONE, g: 'PT', desc: 'Emits pulses at a set interval.' });
B('powered_latch', 'logic', { m: 'slab', c: REDSTONE, g: 'LT', desc: 'Set/reset latch.' });
B('powered_toggle_latch', 'logic', { m: 'slab', c: REDSTONE, g: 'TL', desc: 'Toggles its output on each pulse.' });
B('analog_lever', 'logic', { m: 'slab', c: WOOD, g: 'AL', desc: 'Lever with selectable signal 0–15.' });
B('redstone_contact', 'logic', { pl: 'facing', m: 'box', c: REDSTONE, g: 'RC', desc: 'Emits redstone when two contacts face each other.' });
B('display_link', 'logic', { pl: 'facing', m: 'box', c: BRASS, g: 'DL', desc: 'Reads data from a block and writes it to a display (range 64).' });
B('display_board', 'logic', { pl: 'hfacing', m: 'board', c: DARK, g: '', desc: 'Split-flap display for Display Links.' });
B('nixie_tube', 'logic', { m: 'nixie', c: '#e46a2b', g: '', desc: 'Shows text or redstone strength.' });
B('cuckoo_clock', 'logic', { pl: 'hfacing', sh: 'back', rot: 'facing', su: 1, m: 'box', c: WOOD, g: 'CK', desc: 'Shows the time; driven by rotation.' });

// ---------- Trains ----------
B('track', 'trains', { pl: 'hfacing', m: 'track', c: '#6e5a45', g: '', train: true, desc: 'Train track. Curves and slopes are placed between two points in-game.' });
B('track_station', 'trains', { pl: 'hfacing', m: 'station', c: TRAIN, g: 'STN', train: true, desc: 'Assembles trains and is their stop for schedules.' });
B('track_signal', 'trains', { pl: 'hfacing', m: 'signal', c: TRAIN, g: '', train: true, desc: 'Splits track into blocks so trains do not collide.' });
B('track_observer', 'trains', { pl: 'hfacing', m: 'box', c: TRAIN, g: 'TO', train: true, desc: 'Emits redstone when a train passes.' });
B('controls', 'trains', { pl: 'hfacing', m: 'box', c: TRAIN, g: 'TC', train: true, desc: 'Train controls. A train needs at least one.' });
B('small_bogey', 'trains', { pl: 'hfacing', m: 'bogey', c: DARK, g: '', train: true, desc: 'Small wheel set; carries a train car.' });
B('large_bogey', 'trains', { pl: 'hfacing', m: 'bogey', c: DARK, g: '', train: true, desc: 'Large wheel set.' });
B('railway_casing', 'trains', { m: 'box', c: TRAIN, g: '', train: true, desc: 'Train casing block; place bogeys on it.' });
B('train_door', 'trains', { pl: 'hfacing', m: 'door', c: TRAIN, g: '', train: true, desc: 'Sliding door that opens at stations.' });
B('train_trapdoor', 'trains', { pl: 'hfacing', m: 'slab', c: TRAIN, g: '', train: true, desc: 'Sliding trapdoor for trains.' });
B('fake_track', 'trains', { m: 'slab', c: TRAIN, g: 'TM', train: true, desc: 'Marks a location on train maps.' });
B('controller_rail', 'trains', { pl: 'hfacing', m: 'rail', c: BRASS, g: '', desc: 'Powered rail whose speed follows redstone strength.' });
B('minecart_anchor', 'trains', { m: 'box', c: DARK, g: 'MA', desc: 'Keeps minecart contraptions in place.' });

// ---------- Vanilla processing ----------
B('minecraft:furnace', 'vprocess', { pl: 'hfacing', proc: ['smelting'], m: 'furnace', c: STONE, g: 'F', desc: 'Smelts one item at a time.', stats: [['Time', '200 ticks (10 s) per item'], ['Fuel', 'Coal 8 items · Coal block 80 · Lava 100 · Blaze rod 12 · Dried kelp block 20 · Planks 1.5']] });
B('minecraft:blast_furnace', 'vprocess', { pl: 'hfacing', proc: ['blasting'], m: 'furnace', c: IRON, g: 'BF', desc: 'Twice as fast for ores and metal.', stats: [['Time', '100 ticks (5 s)'], ['Fuel', 'Uses fuel twice as fast']] });
B('minecraft:smoker', 'vprocess', { pl: 'hfacing', proc: ['smoking'], m: 'furnace', c: WOOD, g: 'SM', desc: 'Twice as fast for food.', stats: [['Time', '100 ticks (5 s)']] });
B('minecraft:campfire', 'vprocess', { pl: 'hfacing', proc: ['campfire_cooking'], m: 'campfire', c: WOOD, g: '', desc: 'Cooks 4 food items at once without fuel. Also a smoking catalyst for fans.', stats: [['Time', '600 ticks (30 s), 4 slots']] });
B('minecraft:soul_campfire', 'vprocess', { pl: 'hfacing', proc: ['campfire_cooking'], m: 'campfire', c: '#4fb7c2', g: '', desc: 'Like a campfire; haunting catalyst for fans.' });
B('minecraft:crafter', 'vprocess', { pl: 'facing', proc: ['crafting'], m: 'box', c: STONE, g: 'CRF', desc: 'Auto-crafts one result per redstone pulse. Slots can be disabled.', stats: [['Rate', 'One craft per pulse (≈6 tick cooldown)'], ['Output', 'Ejects in its facing direction or into a container']] });
B('minecraft:crafting_table', 'vprocess', { proc: ['crafting'], m: 'box', c: WOOD, g: 'CT', desc: 'Manual 3×3 crafting.' });
B('minecraft:stonecutter', 'vprocess', { pl: 'hfacing', proc: ['stonecutting'], m: 'slab', c: STONE, g: 'SC', desc: 'Cuts stone into shapes (manual; a Mechanical Saw automates it).' });
B('minecraft:smithing_table', 'vprocess', { proc: ['smithing'], m: 'box', c: DARK, g: 'SMT', desc: 'Netherite upgrades (manual; a Deployer can automate smithing in Create).' });
B('minecraft:brewing_stand', 'vprocess', { proc: ['brewing'], m: 'brew', c: '#6b6056', g: '', desc: 'Brews up to 3 potions.', stats: [['Time', '400 ticks (20 s)'], ['Fuel', '1 blaze powder = 20 brews']] });
B('minecraft:composter', 'vprocess', { m: 'basin', c: WOOD, g: '', desc: 'Turns plant matter into bone meal (7 layers).', stats: [['Chance per item', 'Seeds 30% · Wheat/leaves 65% · Melon 65% · Pumpkin 65% · Cake/pie 100%']] });
B('minecraft:cauldron', 'vprocess', { m: 'basin', c: DARK, g: '', desc: 'Holds water, lava or powder snow. Fills from dripstone or rain.' });
B('minecraft:anvil', 'vprocess', { pl: 'hfacing', m: 'box', c: DARK, g: 'AN', desc: 'Repairs and renames. Falls on contraptions.' });
B('minecraft:grindstone', 'vprocess', { pl: 'hfacing', m: 'box', c: STONE, g: 'GR', desc: 'Removes enchantments.' });
B('minecraft:beehive', 'vprocess', { pl: 'hfacing', m: 'box', c: '#d9b25b', g: 'BH', desc: 'Produces honey; a Spout/drain handles honey in Create.' });

// ---------- Vanilla transport ----------
B('minecraft:hopper', 'vtransport', { pl: 'hopper', m: 'hopper', c: DARK, g: '', desc: 'Moves items from above into the block it points at.', stats: [['Rate', '1 item per 8 ticks (2.5 items/s)'], ['Slots', '5']] });
B('minecraft:dropper', 'vtransport', { pl: 'facing', m: 'box', c: STONE, g: 'DRP', desc: 'Pushes one item per redstone pulse into the block in front.', stats: [['Rate', '1 item per pulse (4 tick minimum delay)'], ['Slots', '9']] });
B('minecraft:dispenser', 'vtransport', { pl: 'facing', m: 'box', c: STONE, g: 'DSP', desc: 'Uses or shoots items on redstone (buckets, bone meal, shulkers).', stats: [['Slots', '9']] });
B('minecraft:chest', 'vtransport', { pl: 'hfacing', m: 'chest', c: WOOD, g: '', desc: 'Storage.', stats: [['Slots', '27 (54 as a double chest)']] });
B('minecraft:barrel', 'vtransport', { pl: 'facing', m: 'box', c: WOOD, g: 'BRL', desc: 'Storage that opens with a block above.', stats: [['Slots', '27']] });
B('minecraft:shulker_box', 'vtransport', { pl: 'facing', m: 'box', c: '#8c6b9c', g: 'SHK', desc: 'Portable storage; keeps contents when broken.', stats: [['Slots', '27']] });
B('minecraft:rail', 'vtransport', { pl: 'hfacing', m: 'rail', c: IRON, g: '', desc: 'Minecart rail.' });
B('minecraft:powered_rail', 'vtransport', { pl: 'hfacing', m: 'rail', c: '#d6b440', g: '', desc: 'Accelerates minecarts when powered.', stats: [['Max cart speed', '8 blocks/s'], ['Spacing', 'One every ~34 blocks on flat track']] });
B('minecraft:detector_rail', 'vtransport', { pl: 'hfacing', m: 'rail', c: REDSTONE, g: '', desc: 'Emits redstone when a cart is on it.' });
B('minecraft:activator_rail', 'vtransport', { pl: 'hfacing', m: 'rail', c: '#a8442f', g: '', desc: 'Activates carts (e.g. hopper minecart lock).' });
B('minecraft:minecart', 'vtransport', { m: 'cart', c: IRON, g: '', desc: 'Basic cart. A Cart Assembler turns it into a contraption.' });
B('minecraft:hopper_minecart', 'vtransport', { m: 'cart', c: DARK, g: 'H', desc: 'Collects items from above and from containers it passes.', stats: [['Rate', 'No cooldown: up to 20 items/s from containers above']] });
B('minecraft:chest_minecart', 'vtransport', { m: 'cart', c: WOOD, g: 'C', desc: 'Cart with 27 slots.' });
B('minecraft:blue_ice', 'vtransport', { m: 'box', c: '#7fb4f0', g: '', desc: 'Fastest surface for boats and item sliding.', stats: [['Slipperiness', '0.989 (boats ≈ 72 blocks/s)']] });
B('minecraft:packed_ice', 'vtransport', { m: 'box', c: '#a9c8f0', g: '', desc: 'Slippery surface for boats/items.', stats: [['Slipperiness', '0.98']] });
B('minecraft:soul_sand', 'vtransport', { m: 'box', c: '#5d4a3a', g: '', desc: 'Makes an upward bubble column in water above it.' });
B('minecraft:magma_block', 'vtransport', { m: 'box', c: '#8a3a1a', g: '', desc: 'Makes a downward bubble column in water above it.' });
B('minecraft:slime_block', 'vtransport', { m: 'glass', c: '#79c05a', g: '', desc: 'Sticks to blocks pushed by pistons; bounces entities.' });
B('minecraft:honey_block', 'vtransport', { m: 'glass', c: '#e9a232', g: '', desc: 'Sticky piston block that does not stick to slime.' });

// ---------- Vanilla redstone ----------
B('minecraft:observer', 'vredstone', { pl: 'facing', m: 'box', c: STONE, g: 'OBS', desc: 'Emits a 2-tick pulse when the block in front changes.' });
B('minecraft:piston', 'vredstone', { pl: 'facing', m: 'vpiston', c: WOOD, g: '', desc: 'Pushes up to 12 blocks.' });
B('minecraft:sticky_piston', 'vredstone', { pl: 'facing', m: 'vpiston', c: '#7ba34a', g: '', desc: 'Pushes and pulls up to 12 blocks.' });
B('minecraft:redstone_wire', 'vredstone', { m: 'wire', c: REDSTONE, g: '', desc: 'Carries signal up to 15 blocks.' });
B('minecraft:repeater', 'vredstone', { pl: 'hfacing', m: 'slab', c: REDSTONE, g: '>', desc: 'Delays 1–4 redstone ticks (2–8 game ticks) and refreshes signal.' });
B('minecraft:comparator', 'vredstone', { pl: 'hfacing', m: 'slab', c: REDSTONE, g: '≥', desc: 'Reads container fullness; compares or subtracts signals.' });
B('minecraft:lever', 'vredstone', { m: 'slab', c: WOOD, g: 'LV', desc: 'Toggle switch.' });
B('minecraft:stone_button', 'vredstone', { m: 'slab', c: STONE, g: 'BT', desc: 'Pulse of 20 ticks.' });
B('minecraft:redstone_torch', 'vredstone', { m: 'torch', c: REDSTONE, g: '', desc: 'Signal inverter / power source.' });
B('minecraft:redstone_block', 'vredstone', { m: 'box', c: REDSTONE, g: '', desc: 'Always-on power source; movable.' });
B('minecraft:daylight_detector', 'vredstone', { m: 'slab', c: WOOD, g: 'DAY', desc: 'Signal by sunlight.' });
B('minecraft:target', 'vredstone', { m: 'box', c: '#e0d3c0', g: 'TG', desc: 'Emits signal when hit by projectiles.' });
B('minecraft:redstone_lamp', 'vredstone', { m: 'box', c: '#b8763a', g: '', desc: 'Light when powered.' });
B('minecraft:sculk_sensor', 'vredstone', { m: 'slab', c: '#0d4f5c', g: '', desc: 'Detects vibrations within 8 blocks.' });

// ---------- World & farms ----------
B('minecraft:water', 'world', { m: 'fluid', c: '#3f76e4', g: '', catalyst: 'splashing', desc: 'Water source. Washing catalyst for fans; drives water wheels when flowing.' });
B('minecraft:lava', 'world', { m: 'fluid', c: '#e25a14', g: '', catalyst: 'blasting_fan', desc: 'Lava source. Blasting catalyst for fans.' });
B('minecraft:fire', 'world', { m: 'fire', c: '#f0a030', g: '', catalyst: 'smoking_fan', desc: 'Smoking catalyst for fans (campfires work too).' });
B('minecraft:soul_fire', 'world', { m: 'fire', c: '#4fb7c2', g: '', catalyst: 'haunting', desc: 'Haunting catalyst for fans (soul campfire works too).' });
B('minecraft:stone', 'world', { m: 'box', c: STONE, g: '', hardness: 1.5, desc: 'Hardness 1.5.' });
B('minecraft:cobblestone', 'world', { m: 'box', c: '#7a7a76', g: '', hardness: 2, desc: 'Hardness 2. Lava + water make a generator for drills.' });
B('minecraft:deepslate', 'world', { m: 'box', c: '#4d4d52', g: '', hardness: 3, desc: 'Hardness 3.' });
B('minecraft:basalt', 'world', { m: 'box', c: '#58585e', g: '', hardness: 1.25, desc: 'Hardness 1.25. Basalt generator: lava over soul soil next to blue ice.' });
B('minecraft:obsidian', 'world', { m: 'box', c: '#24183a', g: '', hardness: 50, desc: 'Hardness 50.' });
B('minecraft:oak_log', 'world', { pl: 'axis', m: 'log', c: WOOD, g: '', hardness: 2, desc: 'Hardness 2. Saws fell whole trees.' });
B('minecraft:farmland', 'world', { m: 'farmland', c: '#5b3d22', g: '', desc: 'Tilled soil for crops (Plough makes it).' });
B('minecraft:wheat', 'world', { m: 'crop', c: '#d6c255', g: '', desc: 'Crop for Harvesters. Mills into flour.' });
B('minecraft:sugar_cane', 'world', { m: 'crop', c: '#83b84e', g: '', desc: 'Grows 3 tall next to water. Harvesters cut the upper parts.' });
B('minecraft:kelp', 'world', { m: 'crop', c: '#4f8a3d', g: '', desc: 'Underwater crop; smoked into dried kelp (fuel).' });
B('minecraft:bamboo', 'world', { m: 'crop', c: '#8cb04a', g: '', desc: 'Fast-growing fuel and scaffold crop.' });
B('minecraft:glass', 'world', { m: 'glass', c: '#cfe3e6', g: '', desc: 'Glass.' });
B('andesite_casing', 'world', { m: 'casingblock', c: ANDESITE, g: '', desc: 'Decorative casing (no function on its own).' });
B('brass_casing', 'world', { m: 'casingblock', c: BRASS, g: '', desc: 'Decorative casing.' });
B('copper_casing', 'world', { m: 'casingblock', c: COPPER, g: '', desc: 'Decorative casing.' });

export const BLOCKS = L;
export const BY_ID = Object.fromEntries(L.map(b => [b.id, b]));

// Common block hardness values used for drill timing.
export const HARDNESS = { 'minecraft:stone': 1.5, 'minecraft:cobblestone': 2, 'minecraft:deepslate': 3, 'minecraft:basalt': 1.25,
  'minecraft:obsidian': 50, 'minecraft:oak_log': 2, 'minecraft:andesite': 1.5, 'minecraft:granite': 1.5, 'minecraft:diorite': 1.5,
  'minecraft:sand': 0.5, 'minecraft:gravel': 0.6, 'minecraft:dirt': 0.5, 'minecraft:netherrack': 0.4, 'minecraft:iron_ore': 3,
  'minecraft:deepslate_iron_ore': 4.5, 'minecraft:ancient_debris': 30, 'minecraft:tuff': 1.5, 'minecraft:calcite': 0.75 };
