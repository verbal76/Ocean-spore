# Asset licensing ledger (bundled third-party art)

Status date 2026-10-12. Evidence is limited to the repository and the shipped
files; no external research was done (it needs owner permission). **Nothing below
is cleared by evidence.** No model was replaced or removed.

## What the repository proves

- All 76 `.glb` files and the 2 texture PNGs were added in one commit,
  `7b423a6` "Add files via upload" (2026-05-10, account *Hot Attic Games*). The same
  upload added `colormap.png`. No licence file, readme, credits or source URL was
  ever committed (history searched for licence / credit / readme / txt / zip).
- GLB metadata (read from the files): `asset.generator = UnityGLTF`; **no
  `copyright`, no `extras`, no creator field**. Each embeds one image and uses a
  single shared material named `colormap`.
- Code comments (`src/data/ships.ts`, `src/render3d/colormap.ts`) call them
  "Kenney" models, and the file names (`boat-*`, `ship-*`, `blaster-*`,
  `cargo-*`, `colormap.png`) follow Kenney's kit naming. That is an **inference
  from naming and comments, not a licence record**. Kenney's public kits are
  commonly described as CC0, but that is general knowledge, not something this
  repository verifies, and it would need the original download page / licence file.
- The two PNGs are named `*_CodezlyBasicTexturePack1(free)_64_*`. They are **not
  bundled** (referenced by no code; absent from the APK).

## Bundled in every APK (16 files: 15 GLB + `colormap.png`)

All 16 share the same row of evidence: creator **unknown (likely Kenney, unproven)**,
source **unknown (uploaded by owner 2026-05-10)**, licence **unknown / unverified**,
commercial use **unverified**, redistribution **unverified**, attribution
**unknown** (none required if CC0, not established). SHA-256s are pinned in
`assets/bundled-assets.sha256` and equal the original build-39 APK's bytes.

| # | File | Used as | Status |
|---|---|---|---|
| 1 | `assets/boat-row-small.glb` | player ship: Raft | owner review |
| 2 | `assets/boat-tow-b.glb` | player ship | owner review |
| 3 | `assets/boat-speed-d.glb` | player ship | owner review |
| 4 | `assets/boat-tug-a.glb` | player ship | owner review |
| 5 | `assets/ship-small.glb` | player ship | owner review |
| 6 | `assets/ship-cargo-c.glb` | player ship | owner review |
| 7 | `assets/ship-ocean-liner.glb` | player ship (top tier) | owner review |
| 8 | `assets/boat-fishing-small.glb` | enemy | owner review |
| 9 | `assets/boat-tug-c.glb` | enemy | owner review |
| 10 | `assets/boat-tow-a.glb` | enemy | owner review |
| 11 | `assets/boat-fan.glb` | enemy | owner review |
| 12 | `assets/ship-cargo-a.glb` | enemy | owner review |
| 13 | `assets/boat-speed-a.glb` | enemy | owner review |
| 14 | `assets/boat-sail-a.glb` | enemy | owner review |
| 15 | `assets/ship-large.glb` | boss | owner review |
| 16 | `assets/colormap.png` | shared texture palette for all of the above | owner review |

Animations: none. Separate textures/materials: none beyond the shared colormap.

## In the tree but never shipped (61 GLB + 2 PNG)

The other 61 `.glb` (blaster-*, bullet-*, cargo-*, buoy, gate, ramp, scope,
silencer, grenade, smoke, arrow, boat variants) and the two `Codezly` PNGs are
unreferenced and not in any APK. Same unknown provenance. They do not affect the
shipped game; they do matter if the repository itself is made public/redistributed.

## What the owner needs to do (one item)

Locate the original download(s) (the kit pages / zips you took the models from,
including the "Codezly" texture pack page) and either (a) drop the pack's
`License.txt` into `assets/licenses/` and tell me the pack names and URLs so this
ledger can be completed, or (b) tell me to research the licences online (needs
your permission) or replace the models. Until then: fine for private sideload
testing; **do not publish publicly or to Play**. Attribution text, if any pack
requires it, goes in the About screen.
