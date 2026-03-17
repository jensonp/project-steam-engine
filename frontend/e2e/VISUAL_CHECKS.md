# Visual Check Stack

This suite combines proven checks from established tooling with project-specific geometry checks.

## Existing checks adopted

1. Playwright visual snapshot regression
   - Docs: https://playwright.dev/docs/test-snapshots
2. Axe accessibility scan in Playwright
   - Docs: https://playwright.dev/docs/accessibility-testing
   - Axe package: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright

## Custom checks added

Inside `ui.visual.spec.ts`, we added geometry assertions that are specific to this UI:

- No overlap between paired controls (`steam-field` vs `load-profile-button`, `os-field` vs `detect-os-button`).
- Form controls must stay inside the terminal panel bounds.
- Button labels must not clip.
- No horizontal viewport overflow at key breakpoints.
