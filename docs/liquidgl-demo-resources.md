# LiquidGL Demo Resources (Authoritative Set)

This resource list is the exact baseline for LiquidGL behavior replication work in Steam Engine.

## Source URLs
- Demo 3: https://liquidgl.naughtyduk.com/demos/demo-3
- Demo 4: https://liquidgl.naughtyduk.com/demos/demo-4
- Demo 5: https://liquidgl.naughtyduk.com/demos/demo-5
- Runtime script: https://liquidgl.naughtyduk.com/scripts/liquidGL.js
- Snapshot helper: https://liquidgl.naughtyduk.com/scripts/html2canvas.min.js

## Local Study Copies
- `liquidgl_local/demos/demo-3.html`
- `liquidgl_local/demos/demo-4.html`
- `liquidgl_local/demos/demo-5.html`
- `liquidgl_local/scripts/liquidGL.js`
- `liquidgl_local/scripts/html2canvas.min.js`

## Scripts
- Fetch/update demos and scripts:
  - `./scripts/liquidgl/fetch-demos.sh`
- Extract parsed liquidGL init objects for diffing:
  - `node ./scripts/liquidgl/extract-demo-configs.mjs`
- Verify result-screen parity against extracted demo configs:
  - `node ./scripts/liquidgl/verify-parity.mjs`
- Serve local demos for direct visual inspection:
  - `./scripts/liquidgl/run-demo-server.sh`

## Expected Extracted Profiles
- Demo 3 profile:
  - `target: .morph`
  - `refraction: 0`
  - `bevelDepth: 0.052`
  - `bevelWidth: 0.211`
  - `frost: 7`
  - `shadow: false`
  - `specular: true`
  - `tilt: false`
  - `tiltFactor: 5`
  - `reveal: fade`
- Demo 4 profile:
  - `target: .marquee-card`
  - `refraction: 0`
  - `bevelDepth: 0.052`
  - `bevelWidth: 0.18`
  - `frost: 2`
  - `shadow: true`
  - `specular: true`
  - `tilt: false`
  - `tiltFactor: 5`
  - `reveal: fade`
- Demo 5 profile:
  - `target: .shape`
  - `snapshot: .main-content`
  - `refraction: 0.026`
  - `bevelDepth: 0.119`
  - `bevelWidth: 0.057`
  - `frost: 0`
  - `specular: true`
  - `shadow: true`
  - `reveal: fade`
