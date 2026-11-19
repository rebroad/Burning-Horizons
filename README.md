# Burning-Horizons

[Play Burning-Horizons](https://rebroad.github.io/Burning-Horizons/) · [Source repository](https://github.com/rebroad/Burning-Horizons) · [Publication and build instructions](docs/PUBLICATION.md)

Burning-Horizons is rebroad's maintained fork of this browser-based 3D world engine and player. Its public identity and GitHub Pages site are maintained separately from upstream. The source configuration opens a pinned public warehouse island; some in-game labels and implementation documents retain the inherited ElseMesh name.

## Run from source

Use Node.js 22.12 or newer. From the repository root, install dependencies and start the Vite development server:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5189/`. `start-local.mjs` is generated in a complete packaged release archive; it is not part of this source checkout, so `node start-local.mjs` does not run the source tree.

WASD walks, mouse drag or arrow keys look, Shift runs, Space jumps, E uses nearby computers or the TV, V switches first-person/follow view, K designs your avatar and H shows or hides controls. The YouTube TV requires an internet connection and the video's embedding permission. Published installations use WebGL2; first-load shader compilation can take time.

## Worlds and packaging

The opening world is configured in `public/opening-world.json`; world data and engine code are maintained separately. The opening snapshot is pinned by repository revision and content digest. See the [repository-world quickstart](docs/repository-world-quickstart.md), [native owner setup](docs/owner-world-setup.md), and [public opening-world packaging](docs/public-opening-world.md).

`npm run build` builds the engine into `dist`; it does not by itself create the complete multi-world game package. Packaging uses the pinned world source and reviewed publication provenance. See [publication and build instructions](docs/PUBLICATION.md).

The GitHub Pages site is built from `bh-main` and published at [rebroad.github.io/Burning-Horizons](https://rebroad.github.io/Burning-Horizons/). The public package retains legacy `elsemesh.*` world and protocol identifiers, browser storage keys and `ELSEMESH_*` configuration names for compatibility.

## Licences and provenance

Engine code is covered by [LICENSE](LICENSE). Models, textures, scenes, media, fonts and other third-party material retain their own licences and attribution; the engine licence does not replace those terms. In particular, Microduck geometry and adaptations are CC BY-NC-SA 4.0 and this package is a noncommercial demonstration. Keep [CREDITS.md](CREDITS.md), [licence notices](LICENSES), packaged credits and each world's attribution with redistributed material.
