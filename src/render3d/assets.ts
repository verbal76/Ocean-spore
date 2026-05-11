// Static require() table of every GLB the game can render. Metro
// bundles each entry into the APK at build time, so this list also
// defines which models ship in the binary. Keep it in sync with the
// `model` fields in src/data/ships.ts and src/data/enemies.ts.
//
// Names match the GLB filenames (without extension) so the data
// modules can index this map directly by their model field.
export const GLB_ASSETS: Record<string, number> = {
  // Player tiers
  'boat-row-small': require('../../assets/boat-row-small.glb'),
  'boat-tow-b': require('../../assets/boat-tow-b.glb'),
  'boat-speed-d': require('../../assets/boat-speed-d.glb'),
  'boat-tug-a': require('../../assets/boat-tug-a.glb'),
  'ship-small': require('../../assets/ship-small.glb'),
  'ship-cargo-c': require('../../assets/ship-cargo-c.glb'),
  'ship-ocean-liner': require('../../assets/ship-ocean-liner.glb'),

  // Enemy archetypes
  'boat-fishing-small': require('../../assets/boat-fishing-small.glb'),
  'boat-tug-c': require('../../assets/boat-tug-c.glb'),
  'boat-tow-a': require('../../assets/boat-tow-a.glb'),
  'boat-fan': require('../../assets/boat-fan.glb'),
  'ship-cargo-a': require('../../assets/ship-cargo-a.glb'),
  'boat-speed-a': require('../../assets/boat-speed-a.glb'),
  'boat-sail-a': require('../../assets/boat-sail-a.glb'),

  // Boss
  'ship-large': require('../../assets/ship-large.glb'),
};
