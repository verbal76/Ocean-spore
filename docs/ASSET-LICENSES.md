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

## Controller glyph archive (received 2026-10-12)

`Source.zip` was supplied by the owner (SHA-256
`f6c75921b9d6ab2cb2b5249f547c7b7ba19e22da9f4f3b45693cf0912f25ded0`, 12.99 MB,
1,633 entries: 1,428 PNG, 18 SVG, directories only otherwise; no path traversal).
Families: `Keyboard_Mouse` (517 files), `P4Gamepad` (322), `P5Gamepad` (326),
`SGamepad` (241), `XGamepad` (226), each in Default/Alt/Light/Dark/Retro-style
variants. **The archive itself contains no licence, credits or readme file.** Licence evidence
is a screenshot of the publisher's page supplied by the owner (2026-10-12): pack
"Input Prompts" by **JulioCacko**, distributed on itch.io and FAB, published
2023-06-30, last updated 2025-02-03; asset licence **Creative Commons Zero v1.0
Universal (CC0 1.0)**: "free to use in any project, commercial or non-commercial,
no attribution required (but appreciated)"; code licence MIT; icons 128x128 in 5
colour variants (4 gamepad families + keyboard/mouse); "no generative AI used".
Status: **licence identified from owner-supplied publisher-page evidence; not
independently verified by me** (no live page fetched, and the zip carries no
licence text). Suggested hardening before commercial release: save the pack's
page/licence text into the repository next to the glyphs when they are imported.

**Not imported.** Ocean Spore is a touch-only Android game: it has no controller
or keyboard input and no Steam/desktop target, so there is nothing to map glyphs
to, and adding ~17 MB of unused art would only bloat the APK. The archive is kept
outside the repository. If a controller or desktop target is ever authorized, the
glyph mapping and licence verification become part of that work.
