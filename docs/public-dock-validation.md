# Public Dock and mobile controls validation, 2026-10-31

The user explicitly approved including Dock in the public game, with downloadable scene files. The private source repository stays private; only the curated active scene and required licence/source attachments are published. See [Dock curation](dock-publication.md) for exact manifests, source provenance, attachment hashes and audit limits.

The public tour is a bounded Warehouse star with Table Tennis Room and Bracken Quay Dock, four reciprocal routes and three resident package slots. Catalogue routes select authored doorways; unrelated authored destinations cannot expand loading. Microduck keeps only its Warehouse–Room habitat and continues updating while the player visits Dock. No owner identity, service endpoint or network permission grant is created.

On coarse-pointer screens the Avatar button now sits between the movement and look joysticks, with safe-area offsets. Previously it covered the movement stick's centre and intercepted touch starts. Desktop placement remains unchanged. Local hit testing checks the centre and four outer points of each stick, Avatar accessibility, dialog close/input clearing and desktop placement. Actual measured phone layouts were 390×844 and 844×390; other requested resize dimensions were clamped by the browser and are not claimed as coverage.

## Architect gates

- PLAN, mobile: architect approved a scoped CSS fix at the overlapping Avatar control, retaining input and layer behavior; primary used a compact centred button and safe-area offsets.
- PLAN, Dock: architect required a bounded 2/3-world reciprocal star, cache limits and lease protections, catalogue-filtered frames, explicit two-world duck habitat, per-world publisher validation and a curated source/licence audit. Primary adopted these requirements.
- NO-PROGRESS, local browser reachability: standalone server and browser contexts twice timed out on loopback. Architect required proving the serving process and candidate identity instead of altering firewall/publication. Primary used a server embedded in the browser-test process, verified the exact three-world catalogue and loaded real packaged resources.
- NO-PROGRESS, duck regression: the stalled-download test lacked the newly required catalogue fixture and constructed the companion before cleanup registration. Architect identified the test-layer error. Primary supplied a valid minimal habitat and registered cleanup immediately; the original stalled response and timeout assertions now pass.
- NO-PROGRESS, crossing observer: two missing-portal failures were observation races across separate browser awaits, after actual Dock arrival. Architect approved one atomic source-world/pending/portal observation, with explicit unexpected-world and missing-source-door failures. Primary changed only the test observer and selects the reciprocal doorway after settled activation.

## Local evidence

- Published-world runtime/boot, splat preparation/physics/readiness and navigation: 106 tests passed.
- Focused catalogue, runtime, companion and Dock publication checks: 42 passed.
- Companion assets/navigation, Dock native clearance, output transform and profiles: 49 passed. Actual Room tests were then explicitly enabled and all 5 passed.
- Generated three-world package: all 8 closure/privacy/retirement/licensing/editor/previous-module tests passed.
- Dock CPU qualification uses actual loaded world data, verified native Warehouse heights, authored colliders, player floor checks and published arrival validation: 962 sweeps across the full 2.4m usable capsule lane, 5,772 segments and 179,894 support points. Room's existing full-lane qualification also passes.
- Windows Edge keyboard browser: both Warehouse doorway images, Dock entry and Warehouse return image, Room entry and Warehouse return image, and a second Dock round trip. Six actual crossings, three stable roots, settled leases, supported feet and no travel errors.
- Android-style Chromium touch emulation: the same six crossings through real touch joystick events, portrait 390×844 then landscape 844×390, with visible controls, stable roots and no travel errors. No keyboard input or player pose mutation drives this test.

Physical Android/iPhone/iPad and Safari, frame-rate acceptance, TV/provider playback and private multiplayer are not qualified by these checks. A separate earlier Room touch run completed eight repeated crossings before its optional slow lateral-boundary timeout; it is not counted as a fully passing run. The integrated six-crossing touch run above passed.

COMPLETION: architect reviewed the actual changes, package audit and both browser reports, found no material runtime/export blocker, and approved subject to the final clean revision pin, rebuild/package equivalence checks and postdeployment verification. Primary accepted those conditions and clarified historical notice cross-references without changing original attachments. Local acceptance alone is not a deployment claim.
