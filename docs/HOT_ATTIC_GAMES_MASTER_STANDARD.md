<!-- Plain-text extraction of the owner-provided 'HOT ATTIC GAMES - steamdeck - dev mandate.doc' (Master Engineering Directive v2.0, received 2026-10-12). Tables/hyperlinks are flattened; the .doc is the original. -->

HOT ATTIC GAMES
UNIVERSAL GAME DEVELOPMENT, BUILD, UPDATE AND DISTRIBUTION STANDARD
MASTER ENGINEERING DIRECTIVE — VERSION 2.0
Applies to: Every Hot Attic Games game, new or existing.
Primary commercial destination: Steam.
Required platforms: Android APK, Windows x86-64, Linux x86-64.
Hardware targets: Steam Deck, Steam Machine, and conventional gaming PCs.
Approved input assets: Studio-provided Source.zip controller glyph library.
Core rule: ONE authoritative source line. THREE platform targets. ONE coordinated build number. ONE GitHub Release. SAFE updates. NO accidental publishing.

1. PURPOSE AND AUTHORITY
You are developing a game for Hot Attic Games.
This document is the studio-wide engineering contract. It applies to all games regardless of genre, engine, framework, programming language, or current development stage.
Its purpose is to eliminate recurring development failures:
Choosing technology that cannot support the intended platforms.
Discovering OTA limitations midway through production.
Maintaining separate Android, Windows, and Linux gameplay branches.
Losing valuable work on abandoned branches.
Creating platform artifacts from different source revisions.
Publishing OTA updates or production releases accidentally.
Producing builds that are difficult to locate or identify.
Breaking gameplay while adding platform compatibility.
Wasting GitHub Actions minutes.
Neglecting Steam controller and handheld requirements.
Claiming testing or compatibility that has not occurred.
Losing player saves or rollback capability during updates.
Rebuilding the same infrastructure repeatedly.
Implement the simplest reliable solution that satisfies this standard.
Robust does not mean complicated.
For existing games, preserve verified functionality and correct only what is missing or defective.
For new games, establish the architecture before substantial gameplay development begins.
Do not create infrastructure for its own sake.

2. REQUIRED PLATFORMS AND DISTRIBUTION PRIORITY
Every game must support these three platform targets:
PlatformRequired outputAndroidInstallable APKWindowsx86-64 executable and ZIP packageLinuxNative x86-64 executable and TAR.GZ packageLinux must be suitable for Steam Deck and Steam Machine.
Steam is the primary commercial distribution destination.
Google Play submission is not currently required.
Android APK support remains mandatory for direct installation and playtesting.
All three platforms must be considered when choosing:
Game engine.
Framework.
Renderer.
Input system.
Save system.
Update architecture.
Native dependencies.
Packaging.
Build automation.
Do not choose an Android-only architecture without first proving a realistic Windows and Linux path.
A native Linux build is required. Proton compatibility is valuable additional coverage, not a substitute for the native Linux deliverable.

3. ENGINE AND TECHNOLOGY SELECTION
Before beginning a new game, evaluate the intended experience and all three target platforms.
Consider:
Gameplay requirements.
2D or 3D rendering.
Performance demands.
Physics.
Controller input.
Android compatibility.
Windows packaging.
Native Linux packaging.
Steam Deck performance.
Steam Input.
Steamworks integration.
Save persistence.
Content and native updates.
Toolchain licensing.
Build complexity.
Long-term maintenance.
Choose the engine that best serves the complete game.
Do not select an engine solely because its OTA implementation appears convenient.
Do not assume experimental platform support is production-ready.
Prove that the selected architecture can generate usable distributable packages.
For existing games, preserve the current engine unless a major technical limitation makes migration necessary.
Do not perform disruptive migrations without owner approval.
When multiple architectures are viable, recommend the simplest one that preserves the game's intended feel and supports all required platforms.

4. ONE AUTHORITATIVE SOURCE LINE
Every game must have ONE authoritative development and release source line.
All platform builds must originate from the same approved immutable source commit.
Do not maintain separate long-lived Android, Windows, Linux, or Steam Deck gameplay branches.
Short-lived feature, recovery, and review branches are permitted.
Accepted changes must be integrated into the authoritative source line.
The authoritative branch may have a project-specific name.
Do not assume main is authoritative.
Preserve the established branch arrangement unless the owner approves changing it.
Shared game architecture
Share wherever practical:
Gameplay rules.
Simulation.
Physics.
Progression.
Save schemas.
Assets.
Core logic.
Core tests.
Use platform-specific adapters for:
Input.
Window management.
Rendering backends.
Native integrations.
Filesystem paths.
Update delivery.
Packaging.
Platform flags select the target. They must not select different gameplay histories.
Branch recovery
Before consolidating an existing repository, inspect relevant historical branches for valuable unmerged work.
Classify unique changes as:
Integrated.
Superseded.
Intentionally abandoned.
Still valuable.
Requires owner decision.
Preserve valuable work.
Do not delete historical branches without authorization.
Keep historical branch inventory informational.
Release-critical verification must check the exact approved SHA, authorized source lineage, and artifacts, not the current state of unrelated historical branches.
Do not repeatedly audit already-accounted-for branches without new evidence.

5. ONE BUILD SYSTEM WITH PLATFORM FLAGS
Every repository must expose one coordinated build interface.
Required logical commands:
build --platform android
build --platform windows
build --platform linux
build --platform all
Implement these commands through the actual engine or framework.
Do not create separate source branches to select build targets.
Required build procedure
Step 1 — Toolchain verification
Pin and document:
Engine/framework version.
SDK versions.
Build-tool versions.
Export templates.
Native dependencies.
Platform packaging tools.
Step 2 — Source verification
Identify:
Repository.
Authoritative source line.
Exact approved Git SHA.
Game build number.
Build target.
Build configuration.
Toolchain version.
Production artifacts must not include unrecorded local source changes.
Step 3 — Validation
Run the applicable:
Static checks.
Unit tests.
Integration tests.
Platform-specific checks.
Build configuration checks.
Step 4 — Compilation
Produce the requested platform artifacts.
Android:
Installable APK.
Preserve AAB capability where appropriate, without requiring Google Play distribution.
Windows:
Executable.
Required runtime files.
ZIP package.
Linux:
Native x86-64 executable.
Required runtime files.
Correct executable permissions.
TAR.GZ package.
Use appropriate build runners.
Do not claim a target platform was tested merely because its package compiled.
Step 5 — Provenance
Generate a manifest recording:
Game title.
Build number.
Platform.
Source SHA.
Engine/runtime version.
Build configuration.
Build timestamp.
Artifact SHA-256.
Artifact size.
Verify manifests against the actual packaged files.
Step 6 — Delivery
Place authorized distributable builds in GitHub Releases.
Do not make expiring GitHub Actions artifacts the primary owner-facing download location.

6. ONE BUILD NUMBER ACROSS ALL PLATFORMS
Each game maintains one monotonically increasing build-number sequence.
Examples:
Upwardly Build 45
Ragdoll Rally Build 11
Mote Build 102
A coordinated build uses:
One build number.
One exact source SHA.
One GitHub Release.
The selected platform artifacts.
Do not use unrelated Android, Windows, and Linux build numbers for the same coordinated revision.
Never reuse a build number for different source content.
Do not silently combine platform artifacts built from different commits.

7. STANDARD ARTIFACT NAMING
Use simple human-readable filenames.
Required convention:
Game Title Build NN APK.apk
Game Title Build NN EXE.zip
Game Title Build NN Linux.tar.gz
Example:
Upwardly Build 45 APK.apk
Upwardly Build 45 EXE.zip
Upwardly Build 45 Linux.tar.gz
The Windows ZIP must contain the executable and its dependencies.
The Linux TAR.GZ must contain the native Linux executable and dependencies.
Internal hashes, branch names, and CI identifiers belong in manifests, not player-facing filenames.

8. GITHUB RELEASES — STANDARD BUILD LIBRARY
Every owner-authorized distributable build must be available through GitHub Releases.
Use one release per coordinated build number.
Example:
Upwardly Build 45
Release assets:
Upwardly Build 45 APK.apk
Upwardly Build 45 EXE.zip
Upwardly Build 45 Linux.tar.gz
build-manifest.json
checksums.sha256
Use immutable tags such as build-45, or preserve an established compatible repository convention.
Never move a tag to different source content.
Never overwrite a previously published artifact with different content.
Playtest distribution
Hot Attic Games uses a limited playtest group.
Playtesters receive numbered builds.
Do not create separate development, candidate, beta, and test numbering systems.
The owner-facing name is simply:
Game Title Build NN
Ordinary playtest builds may use GitHub prerelease metadata internally.
Do not add unnecessary release classifications to the visible title.
GitHub prereleases in public repositories are publicly accessible. Use access-controlled distribution if confidentiality is required.
Steam publication
A GitHub Release is not a Steam publication.
Steam publication requires separate explicit owner authorization.
Promote already-verified artifacts when possible instead of rebuilding unnecessarily.

9. MANUAL BUILD AND RELEASE AUTHORIZATION
Each repository must provide one primary manually triggered coordinated build workflow.
Required inputs:
platform:
  android
  windows
  linux
  all

source_sha:
  exact approved commit

build_number:
  coordinated build number

destination:
  github_releases
  local_only
The workflow must:
Validate the requested source SHA.
Verify authorized source lineage.
Check out the exact commit.
Validate build-number uniqueness.
Run required tests.
Build selected platforms.
Package outputs.
Generate manifests and checksums.
Verify artifact integrity.
Upload to the authorized destination.
Report the GitHub Release URL and platform results.
For all, use the same source SHA across all targets.
Do not present a partially completed build as a complete three-platform release.
Automatic triggers
Pushes, merges, tags, and version changes may run lightweight validation.
They must not automatically:
Produce and publish public releases.
Publish OTA updates.
Upload to Steam.
Upload to Google Play.
Trigger expensive three-platform build matrices.
An explicit numbered-build request authorizes the selected build and its stated destination.
It does not authorize unrelated publication, merges, or destructive Git operations.

10. STANDARDIZED UPDATE ARCHITECTURE
Every game must have a defined update strategy before substantial production.
The goal is safe, compatible, efficient, recoverable updates.
Standardize the update contract, not an unsuitable universal updater.
Different engines may require different implementations.
Required identifiers
Maintain:
Game build number.
Source SHA.
Native runtime compatibility identifier.
Content/update version where applicable.
Update channel where applicable.
Artifact integrity information.
Android update strategy
Select the mechanism supported by the actual engine:
Expo Updates.
Godot resource/PCK updates.
Engine-supported content bundles.
Verified downloadable assets.
Full APK replacement.
Do not claim native runtime changes can be delivered through a content-only update mechanism.
If an update requires changes to native code, engine runtime, incompatible plugins, or platform permissions, require a new native build.
OTA implementation
Where compatible OTA is supported, implement:
Authenticated HTTPS update source.
Versioned update manifest.
Runtime compatibility checks.
Explicit update identification.
Staged download.
Integrity and authenticity verification.
Safe activation.
Preservation of a known-good version.
Recovery from interrupted updates.
Rollback or safe fallback.
Diagnostics identifying the active update.
Use reliable engine-native facilities where available.
Do not invent a second update engine unnecessarily.
Do not execute untrusted downloaded code or bypass platform security controls.
If the current architecture cannot support safe gameplay OTA, document the limitation and use full APK replacement rather than implementing a fragile workaround.
Steam updates
Use SteamPipe for Windows and Linux distribution.
Steam handles game-file delivery and native updates.
Do not build a competing Steam binary updater.
Maintain save compatibility, update diagnostics, and recovery procedures.
Publishing separation
Creating a GitHub Release must not automatically publish an OTA.
Publishing an OTA must not automatically create a native build.
Each operation requires explicit authorization.
Never promote an update solely because tests passed.

11. SAVE SYSTEM AND STEAM CLOUD
Every game with persistent progress must use a reliable, versioned save system.
Requirements:
Save schema version.
Safe writes.
Corruption handling.
Backward compatibility where practical.
Save migration strategy.
Platform-appropriate storage paths.
Preservation during ordinary updates.
For Steam distribution, implement automatic cross-device save synchronization where appropriate.
Prefer Steam Cloud.
Players should be able to continue between Steam Deck, Steam Machine, and desktop PCs.
Handle:
Offline saves.
Sync conflicts.
Interrupted synchronization.
Save migrations.
Corrupted data.
Cross-platform paths.
Do not synchronize hardware-specific graphics settings.
Store resolution, rendering preferences, and device-specific settings locally.
Steam Cloud integration requiring unavailable credentials must be marked pending, not falsely reported complete.

12. OFFICIAL STEAM DECK AND STEAM MACHINE STANDARD
Authoritative references:
Steam hardware recommendations:HYPERLINK "https://partner.steamgames.com/doc/steamhardware/recommendations"https://partner.steamgames.com/doc/steamhardware/recommendations
Steam hardware compatibility:HYPERLINK "https://partner.steamgames.com/doc/steamhardware/compat"https://partner.steamgames.com/doc/steamhardware/compat
Use Valve's current official requirements as the authoritative source.
Maintain a project-specific Steam hardware checklist.
Distinguish Valve Verified requirements from additional recommendations.
Aim to satisfy both where technically appropriate.
Do not claim Valve Verified status unless Valve awards it.
12.1 Complete controller functionality
The default controller configuration must expose all essential game functionality.
Controller operation must cover:
Launch.
Menus.
Settings.
Gameplay.
Pause.
Resume.
Save/load.
Exit.
No mandatory physical mouse or keyboard.
Native gamepad support or Steam Input integration is preferred.
If native controller support is unavailable, provide an appropriate Steam Input mapping.
Do not interfere with player remapping.
12.2 Automatic on-screen keyboard
Where required text entry exists, automatically present the Steam on-screen keyboard.
Prefer the appropriate Steamworks API:
ISteamUtils::ShowFloatingGamepadTextInput
ISteamUtils::ShowGamepadTextInput
Verify:
Automatic activation.
Correct text delivery.
Input focus.
Confirmation.
Cancellation.
Dismissal.
Visibility of the active field.
If Steamworks integration is unavailable, mark the requirement pending.
Do not claim compliance merely because users can manually open the keyboard.
12.3 Mixed input
For games with both mouse-style and joystick-style camera control, support simultaneous use.
Accumulate compatible camera movement from both sources.
Do not disable joystick movement because the trackpad or gyro generates mouse input.
Do not disable mouse camera movement because a controller is active.
Do not switch controller glyphs repeatedly during mixed input.
Where appropriate, use deliberate mouse clicks rather than mouse movement alone to change prompt families.
Test simultaneous mouse and joystick camera movement.
Use Steam Input APIs when appropriate.
12.4 Optional camera sensitivity calibration
For applicable 3D camera-driven games, evaluate Valve's Source 2 reference:
0.022 degrees per mouse pixel.
2.5x default mouse sensitivity.
Approximately 6545 dots per 360-degree rotation.
This is optional.
Do not damage established camera feel merely to match these values.
Document whether the recommendation applies.
12.5 Display and aspect ratios
Support:
1280 × 800.
16:10.
16:9.
Other reasonable aspect ratios.
Ultrawide where practical.
Responsive HUD and menus.
Readable handheld text.
Correct fullscreen presentation.
No clipped essential UI.
No inaccessible controls.
Do not distort the gameplay view to force a particular aspect ratio.
12.6 Graphics API
Prefer Vulkan where the chosen engine supports it reliably.
Evaluate performance, battery consumption, driver compatibility, and maintenance cost.
Do not rewrite a stable renderer merely to force Vulkan.
For Windows games under Proton, evaluate DirectX-to-Vulkan translation where appropriate.
Do not claim Vulkan support without actual testing.
12.7 Video and audio codecs
Prefer portable codecs such as VP9 or AV1 where appropriate.
Avoid unnecessary Windows-only or vendor-specific media dependencies.
Verify media playback on all three platforms.
Consider actual decoder availability and performance.
12.8 Graphics settings
Use device-specific graphics defaults where appropriate.
Do not lock graphics settings merely because Steam Deck or Steam Machine hardware is detected.
Store graphics preferences per device.
Do not synchronize graphics configuration through Steam Cloud.
Where meaningful, offer:
Automatic (Recommended).
Quality.
Cool/Battery.
Do not change gameplay simulation, physics timing, or input responsiveness to reduce rendering load.
12.9 Offline single-player functionality
Single-player content must be accessible without Internet connectivity unless the owner explicitly approves an online-only design.
Test:
Offline launch.
Offline gameplay.
Offline saving.
Offline loading.
Reconnection.
Cloud synchronization after reconnection.
Where feasible, test first launch on a new Steam account without connectivity.
Update checks must fail gracefully offline.
Do not block gameplay waiting for OTA servers, analytics, or network checks.
12.10 Avoid external launchers
Launch directly into the game wherever practical.
Do not require a separate launcher for ordinary settings or gameplay.
If unavoidable, make the launcher controller-accessible.
Evaluate ISteamUtils::SetGameLauncherMode where appropriate.
Do not add a launcher solely to handle Steam updates.
12.11 Steam Deck performance
Measure:
Average FPS.
Frame-time consistency.
CPU usage.
GPU usage.
Memory consumption.
Loading times.
Sustained performance.
Battery and thermal behavior where hardware is available.
Prioritize stable frame pacing and responsive controls.
Do not claim physical Steam Deck performance measurements without physical testing.
12.12 Stability and suspend/resume
Test:
Cold launch.
Repeated launch.
Suspend.
Resume.
Focus changes.
Controller reconnection.
Save persistence.
Offline operation.
Extended gameplay.
Clean exit.
Physical hardware-dependent tests must remain pending until performed.

13. STANDARD CONTROLLER GLYPH LIBRARY
Every game must use the approved Hot Attic Games controller glyph library.
The studio development folder contains:
Source.zip
Inspect the archive and use its actual contents.
Do not invent asset filenames.
Do not generate replacement controller prompts when suitable approved glyphs exist.
Required integration
Locate the supplied archive.
Inspect its folders and naming conventions.
Identify relevant gamepad and keyboard/mouse glyph families.
Import only the required assets.
Preserve original source assets.
Create a reusable action-to-glyph mapping.
Support appropriate controller prompt families.
Support keyboard and mouse prompts.
Handle mixed input without prompt flicker.
Provide manual prompt-style selection when automatic detection is unreliable.
Steam Deck should display appropriate ABXY prompts.
Do not assume every controller is Xbox hardware.
Do not hardcode controller identity when Steam Input abstracts it.
Game actions must remain independent from displayed glyph artwork.
Licensing
The owner-provided listing identifies the pack as CC0 1.0.
Verify the original licensing source before commercial distribution.
Record the source and license in the third-party asset inventory.
Do not invent licensing evidence.

14. BRANDING
Use the approved Hot Attic Games master logo and splash asset when available.
Preserve the intended studio cold-launch sequence.
Do not substitute invented branding assets.
Preserve each game's established visual identity.
Use consistent game and build naming.
Expose appropriate version diagnostics:
Game build.
Platform.
Source SHA.
Runtime identifier.
Active update version where applicable.

15. TESTING AND VALIDATION
Maintain tests appropriate to the actual game.
Cover:
Core gameplay.
Controller input.
Mixed input where applicable.
Text input.
Saves.
Startup.
Shutdown.
Platform configurations.
Build provenance.
Release authorization.
OTA compatibility.
Rollback and recovery.
Do not enforce arbitrary test-count thresholds.
Verify the expected test inventory, execution, failures, and skips.
Add regression tests for corrected defects.
Use negative tests for release-critical safeguards.
Distinguish:
Static validation.
Unit testing.
Integration testing.
Packaged executable testing.
Emulator testing.
Physical Android testing.
Physical Windows testing.
Physical Linux testing.
Physical Steam Deck testing.
Do not claim tests that have not actually occurred.
Prepare concise physical test checklists for the owner when required.

16. GITHUB ACTIONS COST CONTROL
Use GitHub Actions efficiently.
Preferred sequence:
Local static checks.
Local unit tests.
Targeted integration tests.
Local platform builds.
Explicitly authorized hosted builds.
Physical testing.
Explicitly authorized distribution.
Do not run all three platform builds on every commit.
Avoid duplicate jobs for identical source and configuration.
Use caching where appropriate.
Keep automatic pull-request checks lightweight but meaningful.
Do not disable required checks merely to save minutes.
Do not trigger expensive builds without authorization.

17. EXISTING GAME ADOPTION
When applying this standard to an existing game:
Inspect the actual repository.
Identify its authoritative source line.
Inspect existing Android, Windows, and Linux support.
Inspect existing update mechanisms.
Preserve proven gameplay.
Preserve player saves.
Preserve signing and runtime compatibility.
Account for valuable historical branch work.
Identify missing requirements.
Implement only necessary corrections.
Validate the resulting architecture.
Document outstanding physical testing.
Do not repeat completed audits without new evidence.
Do not undertake unnecessary rewrites.
Do not publish or merge without authorization.

18. NEW GAME INITIALIZATION
Before substantial implementation, establish:
Core game concept.
Primary development and testing platform.
Three-platform feasibility.
Engine selection.
Shared source architecture.
Input strategy.
Controller glyph integration.
Steam Deck and Steam Machine requirements.
Update strategy.
Native/content update boundary.
Save system.
Steam Cloud strategy.
Offline support.
Build flags.
GitHub Releases workflow.
Build numbering.
Provenance.
Licensing.
Branding.
Testing.
Identify conflicts before committing to the architecture.
Do not discover halfway through development that the selected stack cannot meet the required distribution targets.

19. REQUIRED DOCUMENTATION
Maintain these files or equivalent existing documentation:
CLAUDE.md
docs/PLATFORM_SUPPORT.md
docs/UPDATES.md
docs/RELEASES.md
docs/STEAM_HARDWARE_CHECKLIST.md
docs/BRANCH_LEDGER.md
docs/THIRD_PARTY_ASSETS.md
Keep documentation concise and accurate.
Record actual implementation, not aspirations.
Avoid duplicate documents.

20. OWNER AUTHORIZATION BOUNDARIES
You may autonomously:
Inspect the repository.
Evaluate architecture.
Implement approved platform support.
Add adapters.
Integrate glyphs.
Add tests.
Prepare build workflows.
Implement safe update infrastructure.
Run local validation.
Commit validated work to authorized development branches.
You may NOT without explicit approval:
Replace an established game engine.
Change proven gameplay behavior.
Merge protected branches.
Delete historical branches.
Trigger expensive hosted builds.
Publish OTA updates.
Upload to Steam.
Upload to Google Play.
Modify production signing.
Remove rollback safeguards.
Introduce major gameplay scope changes.
An explicit numbered-build request authorizes the requested platform build and its specified GitHub Releases destination.
It does not authorize Steam publication or OTA deployment.

21. REQUIRED COMPLETION REPORT
At the end of each implementation pass, provide:
PROJECTGame title, authoritative branch, current SHA, build number.
ARCHITECTUREEngine, shared source, platform adapters.
BUILDSAndroid APK, Windows ZIP, Linux TAR.GZ, with actual artifact locations.
GITHUB RELEASESRelease title, URL, available files, manifests, checksums.
UPDATESAndroid OTA/native strategy, SteamPipe strategy, compatibility, rollback.
STEAM HARDWAREController, text input, mixed input, graphics, aspect ratios, offline support, cloud saves, launcher behavior, performance, and physical testing status.
GLYPHSAsset integration and license verification.
VALIDATIONAutomated tests and actual platform execution results.
COSTGitHub Actions runs and minutes consumed, if known.
BLOCKERSGenuine unresolved decisions or unavailable resources.
NEXT ACTIONThe single highest-value next step.

FINAL MANDATE
Every Hot Attic Games title must follow these rules:
ONE authoritative source line.
THREE platform targets selected by flags.
ONE coordinated build number.
ONE GitHub Release with clearly named downloadable files.
STEAM DECK AND STEAM MACHINE compatibility designed in from the beginning.
COMPLETE controller support using the approved glyph library.
SAFE, engine-appropriate update delivery.
OFFLINE single-player functionality and reliable saves.
NO accidental builds or player-facing publication.
NO unnecessary infrastructure complexity.
NO loss of gameplay, player progress, or valuable historical source work.
Preserve what works.
Correct what does not.
Verify what is built.
Make every build easy to find and distribute.
The objective is to spend development time making better games, not repeatedly rebuilding the systems used to ship them.

