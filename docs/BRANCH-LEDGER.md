# Branch and recovery ledger

Read-only audit of the repository, 2026-10-12, measured against the authoritative
line `ccr-47defc1a-89uvnr` at `d944441eb7c01b2eac3b0ea27285c664c85edb65`
(then updated by the commit that added this file). Method: ancestry
(`rev-list`, `merge-base`), patch equivalence (`git cherry`), file and data
comparison. No branch was deleted or rewritten.

## Refs

| Ref | Tip | Unique vs the line | Classification |
|---|---|---|---|
| `ccr-47defc1a-89uvnr` (authoritative) | see HEAD | n/a | the integrated line |
| `origin/main` | `4e1c377` | 0 (line is 105 ahead) | already integrated (strict ancestor) |
| `origin/working-branch-ocean-spore` | `cd44482` | 0 (line is 36 ahead); `git cherry` empty | already integrated. **Forbidden build ref** (auto-OTA) |
| `origin/claude/fix-ui-add-menus-3q8N7` | `44202cd` | 3 commits | integrated through equivalent implementation (below) |
| local `recovery/oceanspore-working`, `recovery/oceanspore-claude-ui` | `cd44482`, `44202cd` | mirror the two above | bookkeeping copies |
| tags `build-11`..`build-39` | mostly `9f08a80`, `f731b62` | 0 | reachable. They point at *main-side workflow commits*, not at the source that was built; the true source is in each release body ("Auto-built from commit ..."). build-39 source = `a3f17b6` (tag `baseline/build-39-source`) |
| tags `baseline/*`, `v40`, `v41` | see `source-line.json` | `baseline/claude-ui-tip` only | `baseline/*` tags are local-only (tag push is refused here), so the guard uses SHAs in `source-line.json` |

No stashes, no extra worktrees, no reverts in the history (searched).

## Missing-work ledger

| Branch | Commit | What | Classification | Disposition |
|---|---|---|---|---|
| claude-ui | `3c495be` | captain flow, pause menu, touch offset fixes, three.js state reset, Splash/Captain/Keyboard/ShipSelect screens | Integrated (equivalent). Re-done on the working branch (`266c085`, `1329629`, `bd830de`, `ac0216f`, `d10845a`), then superseded by the resurrection (`TouchController`, `buildLayout`). `captain-names.ts`: identical 50 adjectives + 50 nouns, only reformatted | none needed |
| claude-ui | `44202cd` | GLB invisibility: keep template centering through clone+place | Superseded. Centering is baked into geometry (`bakeGeometryTransforms` in `src/render3d/templates.ts`) and the working branch had its own fixes (`bd830de`, `a66d7ba`, `380cd4f`) | none needed |
| claude-ui | `e7246bd` | ignore `package-lock.json` | Intentionally reversed. The lockfile is now committed and CI uses `npm ci` (reproducible builds) | none; do not restore |
| working | `cd44482` ... `ac0216f` (44 commits since the claude-ui merge-base) | physics, input, HUD, build triggers, handoff doc | Integrated (ancestor of the line) | none |
| working | `eas-update.yml` push trigger | OTA on every push | Intentionally removed (manual, CI-gated, runtimeVersion-confirmed) | keep removed |
| main | `4e1c377` | README, logo, workflows | Integrated | none |

Assets, configuration and build improvements: the 16 bundled GLBs + colormap are
byte-identical to build-39's APK (CI asset gate). Nothing was found only on a side
branch. No performance or platform-compatibility fix exists outside the line.
Nothing is "Unknown, requiring owner review" except the unrelated, already recorded
items in `docs/RELEASING.md` and `assets/README.md` (production signing: docs/SIGNING.md; GLB licence: docs/ASSET-LICENSES.md).

## Maintaining the ledger

The ledger and `historicalBaselines` are **audit evidence**, read only by
`scripts/audit-branches.py`. A new remote branch with commits outside the line, or
a ledgered branch that moved, produces a warning (never a failed release) until it
is audited and added to `docs/source-line.json` and a row here. Run
`npm run audit:branches` (strict) during periodic reviews. The claude-ui branch is
kept (not deleted) at its recorded tip.
