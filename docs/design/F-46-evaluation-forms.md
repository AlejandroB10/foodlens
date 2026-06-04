# F-46 Design - WA5 evaluation forms

## Route and Navigation

Add a third top-level view, `evaluation`, to the existing single-page router:

- `VIEW_PATHS.evaluation = "/evaluation"`
- `viewFromPath("/evaluation") -> "evaluation"`
- The main navigation adds an `Evaluate` button with the same `aria-pressed` pattern as Search and Saved.

## UI Structure

The view mounts into `#evaluation` and stays hidden outside the Evaluation route.

- Left column: one form with two blocks.
- Right column: sticky result panel shown after scoring.
- Mobile: a single-column layout with the result below the form.

## Instruments

**SUS.** Ten 1-5 Likert items. Scoring uses the Brooke formula:

- Odd items: `score - 1`
- Even items: `5 - score`
- Total contribution multiplied by `2.5`

**Explanation Satisfaction.** Six 1-5 items focused on clarity, usefulness, trust, verifiability and trade-off judgement. Score is the arithmetic mean.

## Persistence and Export

On submit, append a timestamped record to `localStorage.foodlens.evaluationResults`:

```json
{
  "createdAt": "2026-06-04T00:00:00.000Z",
  "susAnswers": [5, 2, 5, 2, 5, 2, 5, 2, 5, 2],
  "explanationAnswers": [4, 5, 4, 5, 4, 5],
  "susScore": 87.5,
  "explanationAverage": 4.5
}
```

The export button downloads the full array as `foodlens-evaluation-results.json`.

## Constraints

The feature remains frontend-only and uses no new runtime dependency. Copy stays neutral and study-oriented; it does not moralise product choices.
