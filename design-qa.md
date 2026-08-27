# Nightingale Clinical UI — Design QA

## Evidence

- Selected reference: `/Users/renhongxu/.codex/generated_images/01a0387f-06f7-70b2-9806-62eb2a8d47dd/exec-a5f06bf6-a7a9-40bb-b45f-fa4aecb9f261.png`
- Implementation capture: `/private/tmp/nightingale-clinical-ui.png`
- Combined comparison: `/private/tmp/nightingale-clinical-comparison-final.png`
- Primary comparison viewport: 1440 × 1024 CSS px; both raster inputs are 1440 × 1024 px.
- Responsive evidence: `/private/tmp/nightingale-clinical-ui-900.png` at 900 × 900 and `/private/tmp/nightingale-clinical-ui-390.png` at 390 × 844.
- State: clinician role, Maya Tan synthetic record, first Glance signal selected, production-like data loaded from the existing local API.
- Full-view evidence was sufficient because the redesign concerns the complete single-screen workspace; source verification was additionally tested as a focused modal interaction.

## Visual comparison

| Area | Result |
| --- | --- |
| Layout | Matches the selected command-strip direction: slim navy rail, persistent top bar, patient identity band, dense central record, and narrow contextual action rail. |
| Type | Compact clinical hierarchy is preserved with restrained sizes, uppercase metadata labels, readable body text, and no decorative display typography beyond the existing brand mark. |
| Spacing | Repeated 8–16 px rhythm, aligned Glance rows, restrained dividers, and dense timeline spacing fit a production hospital workspace. |
| Color | Navy, clinical teal, white, muted blue-gray, and semantic risk colors track the reference without gradients, neon, or glass effects. |
| Assets | Lucide icons are used consistently for navigation, safety, provenance, tasks, and actions. No placeholder, fake, or generated decorative assets remain. |
| Copy | Existing synthetic clinical content and safety language were retained. Reference-only hallucinated patient facts were intentionally not copied. |

## QA history

1. First 1440 × 1024 comparison found a P1 fidelity issue: the left navigation occupied 224 px instead of behaving like the selected slim command rail.
2. Fixed the rail to 84 px, centered icon/label navigation, widened the record canvas, and removed excess outer workspace padding.
3. Second comparison confirmed the target hierarchy and density. Remaining content differences are intentional because the implementation preserves the app's existing synthetic patient data and RBAC behavior.

## Interaction and responsive checks

- Selecting a different Glance row updates the selected-signal rail.
- Exact-source verification opens an immutable provenance modal with entry, version, span, session, source copy, and exact referenced text; Close dismisses it.
- Mock scribe opens a provider disclosure showing deterministic local mock behavior and no external transmission.
- Patient role exposes the patient-facing summary and removes internal timeline, raw AI source labels, and internal Comments navigation.
- 900 px viewport: no horizontal page overflow (`scrollWidth = clientWidth = 900`).
- 390 px viewport: no horizontal page overflow (`scrollWidth = clientWidth = 390`); command navigation remains horizontally scrollable and the content collapses to one column.
- Browser console: no error-level entries after the tested interactions.
- Automated checks: ESLint passed, TypeScript passed, Vitest passed 5/5 tests, and the optimized Next.js production build completed successfully.

## Final result

passed
