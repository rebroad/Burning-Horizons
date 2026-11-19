# Fred public source and publication

## Current release identity

Play Burning-Horizons at <https://rebroad.github.io/Burning-Horizons/>. Source: <https://github.com/rebroad/Burning-Horizons>. The [matching release](https://github.com/lozknowles/fred/releases/tag/fred-warehouse-2026-11-19) provides the [playable static archive](https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19/release-tv-fix-cd8cddd6eab4-20261118.tgz), its [deployment manifest](https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19/release-tv-fix-cd8cddd6eab4-20261118-manifest.json), a separate packaging bootstrap and [SHA256SUMS](https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19/SHA256SUMS).

| Component | Release revision | Development branch |
| --- | --- | --- |
| Engine | `cd8cddd6eab45528fe48ba46eda423c14a51ea56` | `public` (release source and later documentation) |
| Authored world | `5b459c62a92ead5cdc3d499caf0c7d07426b12bf` | `warehouse-world` |
| Opening manifest SHA-256 | `5933d445246a3ee4c2a0c79a0e9e42630b6bec89db48c9ad32318f56f8976172` | Pinned in `public/opening-world.json` |

Engine and world are independent Git histories held on branches of the same repository. The default source branch is `public`; `main` retains separate development work. Use the exact commits to reproduce this release. Historical uses of “private” in pinned world documentation describe the earlier development context; publishing content does not publish an owner authority or grant runtime permissions.

The packager writes `publication.json`, `opening-world.json` and `published-worlds.json`, recording the engine commit, world commit, content digests, application assets and connected-world inventory. Keep those records and all licence notices with a complete package. The filtered public static release intentionally excludes `publication.json` and the editor; its separate deployment manifest/receipt identifies the published files. Documentation-only commits made after the release do not change its compiled engine identity.

## Build the engine

Install Git, Node.js 24.19.0 and npm 11.17.0 to match the verified build. The locked Vite/Rolldown packages declare Node.js `^20.19.0 || >=22.12.0`; this release reproduction was tested on 24.19.0. From a new working directory:

```sh
git clone https://github.com/lozknowles/fred.git fred
cd fred
git checkout --detach cd8cddd6eab45528fe48ba46eda423c14a51ea56
git worktree add --detach ../fred-world 5b459c62a92ead5cdc3d499caf0c7d07426b12bf
npm ci
npm run build
```

The world worktree must have no modified or untracked files. No authenticated world checkout is required for public source. `npm run dev` starts engine development at `http://127.0.0.1:5189/`. A development build can load the source pin through the repository loader; the packaged game instead reads bundled world files from its own origin.

`npm run build` creates `dist` with application code and public engine assets. It does not bundle the complete authored world or the editor. The full multi-world packager needs four inputs:

1. `dist` from the pinned engine build.
2. A clean Git worktree at the exact world revision above, including retained attribution and original source inventory used for verification.
3. A new output path outside the build and world directories. Its parent must exist and the output itself must not exist.
4. An extracted, reviewed previous complete publication containing `publication.json`, `editor/` and `assets/`. The packager preserves the editor, validates prior publication provenance, and normally retains bounded historical application chunks for open tabs.

## Bootstrap and complete packaging

`--fresh-origin` is suitable for a new local preview or origin without previously open tabs. It omits old application chunks but still needs the prior editor and `publication.json`. For an update to an existing origin, omit this flag and supply the actual prior publication so open tabs can retrieve their previous immutable chunks.

The packager validates the world checkout, manifest and resources, Table Tennis Room source inventory, connected-world routes, avatar media, contract provenance and licence notices. It writes the complete new package and fresh publication metadata. This process uses pinned source and content; it does not promise byte-identical generated metadata or build chunks across different installations and platforms.

The [packaging bootstrap](https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19/Fred-Packaging-Bootstrap-cd8cddd.tar.gz) is `Fred-Packaging-Bootstrap-cd8cddd.tar.gz` (33,405,524 bytes), containing 3,638 authentic prior publication/editor/application/licence files. Its SHA-256 is:

```text
93eafe94a307a0fa7a85ee86c94b1d343743ba60c861378037f66c5e931e69db
```

The matching [bootstrap manifest](https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19/Fred-Packaging-Bootstrap-cd8cddd.manifest.json) records each file's size and SHA-256. Its own SHA-256 is:

```text
95fb22a05641fbecc575d57e96c96bcc568e3848e9cbe6475e0f952fc2fb802b
```

The following commands use Bash, `curl`, `tar` and GNU `sha256sum`. On Windows use Git Bash for this block, or download the same linked files and compare hashes with PowerShell `Get-FileHash -Algorithm SHA256` before extracting with `tar`. Verify the archive and manifest against both `SHA256SUMS` and the pinned hashes above. From the pinned engine checkout, download the bootstrap beside it:

```sh
set -e
release=https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19
curl -fL "$release/Fred-Packaging-Bootstrap-cd8cddd.tar.gz" -o ../Fred-Packaging-Bootstrap-cd8cddd.tar.gz
curl -fL "$release/Fred-Packaging-Bootstrap-cd8cddd.manifest.json" -o ../Fred-Packaging-Bootstrap-cd8cddd.manifest.json
curl -fL "$release/SHA256SUMS" -o ../SHA256SUMS
(cd .. && sha256sum --check --ignore-missing SHA256SUMS)
mkdir ../previous-reviewed-publication
tar -xzf ../Fred-Packaging-Bootstrap-cd8cddd.tar.gz -C ../previous-reviewed-publication
node tools/package-published-worlds.mjs dist ../fred-world ../fred-package ../previous-reviewed-publication --fresh-origin
```

Stop if checksum verification fails. The archive's root contains `publication.json`, `editor/`, `assets/`, credits and licence notices. Do not fabricate provenance, create an empty editor or substitute an operator's unfiltered server directory.

This procedure was verified from a fresh detached clone at the exact engine and world commits using Node.js 24.19.0 and npm 11.17.0. `npm ci`, the engine build and the unchanged `--fresh-origin` packager passed. All 3,638 extracted bootstrap files matched their manifest; the resulting 15 current application chunks, five voice media files, 1,380 world files and 3,607 editor files were byte-identical to the retained full release. The generated `publication.json` was byte-identical too. The lockfile SHA-256 was `3a6a191a37e0cce392320d070fb1cd4a2230e35c5cd7080f322727dc127feabe`.

The separately filtered playable static archive is `release-tv-fix-cd8cddd6eab4-20261118.tgz`, SHA-256 `6952de4b20e02b47bcc6ac8146bd498837d6788d0640d4fa2259019c56224480`. It deliberately excludes both `editor/` and `publication.json`, so it cannot supply the fourth packager input. Compared with its 1,491-file deployment manifest, the reproduced fresh-origin package matched 1,455 files exactly and omitted 36 historical compatibility chunks; no common file differed. The complete package also contains editor/local-server/provenance files excluded from the public static site. This reproduces the active runtime and worlds, not the deployment's historical compatibility inventory.

The complete local package includes `start-local.mjs` and a `.fred-server/` helper tree for optional local services. Run `node ../fred-package/start-local.mjs` and open `http://127.0.0.1:18888/`. Keep optional private service settings outside the package. The filtered public static archive has neither the local server nor the editor. Extract it and serve its root with an ordinary static HTTP server; double-clicking `index.html` is insufficient.

To play the downloadable static release without building, download its archive, manifest and checksums from the matching release. This Bash example uses Python 3 only as a local static server:

```sh
set -e
mkdir fred-static-download
cd fred-static-download
release=https://github.com/lozknowles/fred/releases/download/fred-warehouse-2026-11-19
curl -fL "$release/release-tv-fix-cd8cddd6eab4-20261118.tgz" -o release-tv-fix-cd8cddd6eab4-20261118.tgz
curl -fL "$release/release-tv-fix-cd8cddd6eab4-20261118-manifest.json" -o release-tv-fix-cd8cddd6eab4-20261118-manifest.json
curl -fL "$release/SHA256SUMS" -o SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS
mkdir site
tar -xzf release-tv-fix-cd8cddd6eab4-20261118.tgz -C site
python3 -m http.server 18888 --bind 127.0.0.1 --directory site
```

Stop if checksum verification fails, then open `http://127.0.0.1:18888/` after starting the server. On Windows, `py -m http.server 18888 --bind 127.0.0.1 --directory site` is the equivalent server command when Python is installed with the Windows launcher.

## Publish the public static subset

The complete local package is **not** the upload inventory. A public static release must use the reviewed file manifest and exclude server helpers, `start-local.mjs`, the editor, `publication.json`, private configuration, development tools, `node_modules`, local evidence and unrelated files. Preserve the reviewed game assets, world bundles, credits, licences and runtime configuration/catalog files. Do not upload an entire local output directory merely because packaging succeeded.

The current reviewed archive is already filtered to that static subset. Future releases need a separately recorded manifest with a hash and size for every uploaded file, a privacy review, and verification of representative hosted application/world hashes against that manifest. Uploading source, building `dist`, packaging worlds, publishing a static site and publishing a downloadable asset are separate steps.

## Archived edition and licensing

[ElseMesh Pages](https://lozknowles.github.io/ElseMesh/) and [ElseMesh releases](https://github.com/lozknowles/ElseMesh/releases) are the archived edition. Their downloadable ZIP names and gameplay claims do not identify the current Fred release. The earlier [public world repository](https://github.com/lozknowles/elsemesh-world-loz-opening-island) retains its attribution trail.

The engine's MIT licence applies to engine code. Asset-specific terms remain in force, including Table Tennis Room's CC BY 4.0, Microduck geometry/adaptations' CC BY-NC-SA 4.0, OpenX-derived vehicle notices, Kenney/Poly Haven notices and source records retained with authored world assets. Public repository visibility does not override those terms. Retain original licences, credits, content/source hashes and modification notices.
