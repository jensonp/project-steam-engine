# Visual Check Stack

This suite combines proven checks from established tooling with project-specific geometry checks.

## Existing checks adopted

1. Playwright visual snapshot regression
   - Docs: https://playwright.dev/docs/test-snapshots
2. Axe accessibility scan in Playwright
   - Docs: https://playwright.dev/docs/accessibility-testing
   - Axe package: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
3. Carbon Design System component guidance
   - Buttons: https://carbondesignsystem.com/components/button/style/
   - Text inputs: https://carbondesignsystem.com/components/text-input/style/
4. USWDS token guidance
   - Design tokens: https://designsystem.digital.gov/design-tokens/
   - Spacing units: https://designsystem.digital.gov/design-tokens/spacing-units/

## Custom checks added

Inside `ui.visual.spec.ts`, we added geometry assertions that are specific to this UI:

- No overlap between paired controls (`steam-field` vs `load-profile-button`, `os-field` vs `detect-os-button`).
- Form controls must stay inside the terminal panel bounds.
- Floating labels must stay inside their field bounds.
- Button labels must not clip.
- No horizontal viewport overflow at key breakpoints.

## Styling constraints adopted

- Use sentence case for field labels and button labels.
- Keep field labels short; move explanatory copy into helper text.
- Use tokenized spacing rather than arbitrary one-off gaps.
- Use productive UI typography, with sans for interface text and mono only for small accents.
