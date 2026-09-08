# Running Bloch Golf offline

Bloch Golf is a pure client-side application. The quantum state is simulated in
the browser by [`@qamposer/react`](https://www.npmjs.com/package/@qamposer/react),
the 3D scene is rendered with Three.js and the sound effects are synthesised with
the Web Audio API, so the built bundle makes **no network requests at runtime** —
no API server, no CDN, no web fonts and no downloaded HDRI environment map
(Inter, JetBrains Mono and the environment map are bundled into the build).
Once the files are on the device, the game works fully offline.

## Getting the bundle

Download `bloch-golf-<version>.tar.gz` from the
[Releases page](https://github.com/nyainman-labs/bloch-golf/releases) and verify it:

```bash
sha256sum -c SHA256SUMS
tar -xzf bloch-golf-<version>.tar.gz
```

Or build it yourself (requires Node.js 22+ and pnpm 11; needs network access
once, for dependencies):

```bash
pnpm install --frozen-lockfile
pnpm build          # output in dist/
```

## Serving it

Point any static web server at the extracted directory:

```bash
python3 -m http.server 8000 --directory bloch-golf-<version>
# then open http://localhost:8000/
```

nginx, lighttpd, `busybox httpd` or any other static server works just as well —
there is nothing to configure beyond a document root.

Two things worth knowing:

- **Serve over HTTP, not `file://`.** The bundle is loaded as an ES module, and
  browsers block module scripts on `file://` URLs. Opening `index.html` directly
  from disk shows a blank page.
- **Any URL path works.** The bundle is built with Vite's `base: './'`, so all
  asset references are relative. Serving it from a sub-path such as
  `http://localhost/fun-with-quantum/bloch-golf/` needs no rebuild.

The game renders a WebGL scene, so the browser on the target device needs WebGL
enabled — on a Raspberry Pi that means using the GPU-accelerated Chromium build.

## What is in the bundle

```
bloch-golf-<version>/
├── index.html
├── assets/          # hashed JS, CSS and self-hosted woff2 fonts
├── LICENSE          # Apache-2.0
├── NOTICE
└── OFFLINE.md       # this file
```
