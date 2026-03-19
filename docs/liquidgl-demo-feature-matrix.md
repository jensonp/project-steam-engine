# LiquidGL Demo Feature Matrix

Generated: 2026-03-19T09:06:32.511Z

| Page | Targets | Snapshot | Blend Modes | Key Runtime |
|---|---|---|---|---|
| index.html | .liquidGL | body | difference, exclusion | syncWith, gsap, lenis, ScrollTrigger |
| demos/demo-1.html | .menu-wrap | (none) | difference | syncWith, gsap, lenis, ScrollTrigger, jquery, ripples |
| demos/demo-2.html | .credit-card-glass | .main-content | difference | syncWith, gsap, lenis, ScrollTrigger, jquery |
| demos/demo-3.html | .morph | (none) | difference | syncWith, gsap, lenis, ScrollTrigger, jquery, ripples |
| demos/demo-4.html | .marquee-card | (none) | difference | syncWith, gsap, lenis, ScrollTrigger |
| demos/demo-5.html | .shape | .main-content | (none) | syncWith, gsap, lenis, ScrollTrigger |

## Porting Notes

1. Demo-4 card liquid effect target is `.marquee-card`; for Steam Engine this is safer via inert overlays to avoid card-content mutation.
2. Demo-5 shape lens uses `.shape` with `snapshot: .main-content`; this should be mounted separately from card lenses to avoid shared-canvas z-order conflicts.
3. Demos keep foreground text readable by explicit z-layering and `pointer-events: none` on liquid canvas/overlay nodes.
4. The controls menu is from `lil-gui`; exact folder naming and parameter ranges should remain aligned.