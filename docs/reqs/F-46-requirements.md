# F-46 Requirements - WA5 evaluation forms

## User Story

As a WA5 evaluator, I want FoodLens to include reusable SUS and Explanation Satisfaction forms so that I can score a participant session immediately after a task and export the result without a separate spreadsheet.

## Acceptance Criteria

- AC1: The app exposes an Evaluation view reachable from the main navigation and `/evaluation`.
- AC2: The view renders Brooke's 10-item System Usability Scale with 1-5 responses.
- AC3: The view renders a compact Explanation Satisfaction instrument with 1-5 responses.
- AC4: Submitting the form computes a SUS score and an explanation satisfaction average locally.
- AC5: Results are stored in `localStorage.foodlens.evaluationResults` as an array of timestamped records.
- AC6: The view includes an export action that downloads all stored results as JSON.
- AC7: The evaluation view participates in the existing accessible navigation state using `aria-pressed` and `aria-current`.

## Out of Scope

- Backend persistence, participant identity management, analytics dashboards, and CSV export.
- Changes to recommendation logic, Open Food Facts requests, onboarding questions, or product-card scoring.
