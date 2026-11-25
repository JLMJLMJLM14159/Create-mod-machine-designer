# Create Factory Planner

A browser-based 3D planner for automated factories built with the [Create](https://github.com/Creators-of-Create/Create) mod.
Targets **Create 6.0.11 on Minecraft 1.21.1**, and includes Create trains plus vanilla transport and processing blocks.

**Use it online: <https://jlmjlmjlm14159.github.io/Create-mod-machine-designer/>**

## Features

- **3D editor.** Place, rotate and remove about 1,190 blocks (all 1,057 Minecraft 1.21.1 blocks plus Create's machines), draw belts and chain conveyors between shafts, view one layer at a time, and undo or redo.
- **Kinetic simulation.** Rotation spreads through shafts, cogwheels, large cogwheels, gearboxes, clutches, gearshifts, chain drives, belts and rotation speed controllers using the same rules as Create's `RotationPropagator`. The planner shows stress use against capacity, gear conflicts and overspeed. Steam boilers are modelled from heat, tank size and water supply.
- **Production rates.** Assign a recipe to a machine to see its operations per minute at its current RPM, plus the net items and fluids per minute for the whole design.
- **Checks.** Flags common mistakes: a press or spout with nothing below it, a mixer without a basin, a missing burner for a heated recipe, a fan with no catalyst, unpaired crushing wheels, a station that isn't on track, and more.
- **Recipe book.** 2,795 recipes with processing times at any speed: every Create recipe that is active with only Create installed, and every Minecraft 1.21.1 recipe including brewing. Recipes the games build in code are included too: all brewing steps, Create's potion mixing, and spout/drain filling and emptying of buckets and bottles. Recipes Minecraft works out from the items used (fireworks, armor dye, map copying, armor trims) are shown as a typical example with a note.
- **Saving and export.** Save and open designs as `.json`, or export a `.nbt` structure (inside a `.zip`) to load with Create's Schematic Table and print with a Schematicannon. Belts and chains aren't exported; place those by hand.

## Running it

The app uses ES modules and loads `recipes.json` with `fetch`, so serve the folder over HTTP rather than opening the file directly:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly as a file won't work, because browsers block modules and data loaded from `file://`.

Three.js 0.160.0 is bundled in `vendor/three` (MIT licence), so the planner works offline and on networks that block CDNs; only the web fonts come from Google Fonts, with system-font fallbacks. The 3D view needs WebGL. If your browser has it turned off, the page says so, and the recipe book and other panels still work.

## Where the data comes from

- **Stress values** (SU per RPM) come from Create's `AllBlocks.java` and `BuilderTransformers.java` on the `mc1.21.1/dev` branch.
- **Processing-time formulas** come from Create's block entity code: press, mixer, millstone, crushing wheel, saw, deployer, encased fan, drill, mechanical arm, pump and belt.
- **Recipes and item tags** come from Create's generated data and the vanilla 1.21.1 data in [misode/mcmeta](https://github.com/misode/mcmeta). Recipe conditions are evaluated as in a game with only Create installed, so recipes for other mods' ores and items are left out. Vanilla brewing is written out from Minecraft's brewing code, which isn't part of the data files.

`vanilla-blocks.json` (every block with its states, shape and texture colour) is built by `tools/build_vanilla_blocks.py` from mcmeta's `1.21.1-summary` and `1.21.1-assets` data.

To rebuild `recipes.json`, check out those two sources and run `tools/build_data.py` (it expects `create/`, `mcdata/` and `dl/` lang files under one folder; see the top of the script):

```bash
python3 tools/build_data.py /path/to/sources recipes.json
```

## Tests

```bash
node tests/sim.test.mjs
```

These cover the gear rules, gearboxes, windmills, boilers, belts, speed controllers, conflict detection and machine timings.

## Notes

The 3D models are original low-poly stand-ins, not Create's assets. Create is a separate project by the Creators of Create and is not affiliated with this planner.

## License

[GNU General Public License v3.0](LICENSE)
