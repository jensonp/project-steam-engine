# LiquidGL Demo Resources (Authoritative Set)

This resource list is the exact baseline for LiquidGL behavior replication work in Steam Engine.

## Source URLs
- Landing page: https://liquidgl.naughtyduk.com/
- Demo 1: https://liquidgl.naughtyduk.com/demos/demo-1
- Demo 2: https://liquidgl.naughtyduk.com/demos/demo-2
- Demo 3: https://liquidgl.naughtyduk.com/demos/demo-3
- Demo 4: https://liquidgl.naughtyduk.com/demos/demo-4
- Demo 5: https://liquidgl.naughtyduk.com/demos/demo-5
- Runtime script: https://liquidgl.naughtyduk.com/scripts/liquidGL.js
- Snapshot helper: https://liquidgl.naughtyduk.com/scripts/html2canvas.min.js

## Local Study Copies
- `liquidgl_local/index.html`
- `liquidgl_local/demos/demo-1.html`
- `liquidgl_local/demos/demo-2.html`
- `liquidgl_local/demos/demo-3.html`
- `liquidgl_local/demos/demo-4.html`
- `liquidgl_local/demos/demo-5.html`
- `liquidgl_local/scripts/liquidGL.js`
- `liquidgl_local/scripts/html2canvas.min.js`
- `liquidgl_local/mirror-manifest.json`
- `liquidgl_local/feature-matrix.json`
- `docs/liquidgl-demo-feature-matrix.md`

## Scripts
- Fetch/update demos and scripts:
  - `./scripts/liquidgl/fetch-demos.sh`
- Fetch and audit all mirrored sources:
  - `./scripts/liquidgl/run-source-audit.sh`
- Verify mirrored source completeness:
  - `node ./scripts/liquidgl/check-source-coverage.mjs`
- Generate feature matrix from mirrored pages:
  - `node ./scripts/liquidgl/analyze-demo-features.mjs`
- Extract parsed liquidGL init objects for diffing:
  - `node ./scripts/liquidgl/extract-demo-configs.mjs`
- Verify result-screen parity against extracted demo configs:
  - `node ./scripts/liquidgl/verify-parity.mjs`
- Verify no imitation overlays and enforce layer contract:
  - `node ./scripts/liquidgl/check-contract.mjs`
- Verify demo-4 baseline card visibility:
  - `./scripts/liquidgl/run-demo-visibility.sh`
- Verify app card visibility in forced fallback mode:
  - `./scripts/liquidgl/run-fallback-visibility.sh`
- Verify card readability + canvas layering guard:
  - `./scripts/liquidgl/run-occlusion-check.sh`
- Verify real WebGL renderer path:
  - `./scripts/liquidgl/run-webgl-render-check.sh`
- Serve local demos for direct visual inspection:
  - `./scripts/liquidgl/run-demo-server.sh`
- Local stack smoke checks (`localhost:4200` + `localhost:3000`):
  - `./scripts/liquidgl/local-stack-smoke.sh`
- Drag lens and verify text visibility is preserved:
  - `./scripts/liquidgl/run-drag-visibility.sh`
- Headed UI debug run with trace:
  - `./scripts/liquidgl/run-debug-ui.sh`
- Dump runtime diagnostics (JSON):
  - `./scripts/liquidgl/run-runtime-dump.sh`
- Capture design screenshots:
  - `./scripts/liquidgl/run-design-capture.sh`
- Full integration verification (fetch + extract + parity + e2e + build):
  - `./scripts/liquidgl/test-all.sh`
- Unified command router:
  - `./scripts/liquidgl/workbench.sh audit|smoke|demo|fallback|occlusion|webgl|test|drag|debug|dump|design|all`

## Generated Artifacts
- Runtime dump:
  - `artifacts/liquidgl/debug/runtime-state.json`
- Demo visibility baseline report:
  - `artifacts/liquidgl/debug/demo-visibility.json`
- Design captures:
  - `artifacts/liquidgl/design/results-initial.png`
  - `artifacts/liquidgl/design/lens-expanded.png`
  - `artifacts/liquidgl/design/lens-dragged.png`
  - `artifacts/liquidgl/design/webgl-renderer-check.png`

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
