# F-37 Requirements - WCAG audit and fixes

## User Story

As Marc, Pau, Lluis, and low-vision users, I want the main FoodLens interface to be navigable and understandable with keyboard and assistive technology, so that the Health/Eco trade-off and reasoning remain available without relying on mouse use or low-contrast colour cues.

## Acceptance Criteria

- AC1: axe-core reports no WCAG A/AA violations on the loaded home page with sample product cards.
- AC2: Every interactive control has a visible focus state with sufficient contrast against the paper theme.
- AC3: Score badges that open methodology tooltips are reachable by keyboard and activate with Enter or Space.
- AC4: Dialog-like surfaces keep keyboard focus inside while open, including Settings and the barcode scanner.
- AC5: Generated cards expose useful accessible names for clickable alternatives, saved products, recently viewed products, score badges, tables and chart canvases.
- AC6: H1 remains intact: Health and Eco badges are still both rendered on product cards, including unknown and not-applicable states.

## Out of Scope

- New visual redesigns, i18n, alternative ranking logic, API shape changes, or changes to the Open Food Facts data contract.
- Full Lighthouse performance work, which belongs to F-38.
