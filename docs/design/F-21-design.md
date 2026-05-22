# F-21 · Barcode scan via webcam design

**Entry point.** Add a camera icon button inside the existing search input group. Manual barcode entry remains the default path.

**Runtime dependency.** Load `@zxing/browser` from jsDelivr only when the user clicks the camera button:

```js
import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm')
```

This keeps the first load unchanged for Marc and avoids adding a build step.

**Interaction.**
- Click camera button.
- Open an in-page dialog with a video viewport, status text, close control, and manual barcode fallback.
- Start `BrowserMultiFormatReader.decodeFromVideoDevice`.
- On scan result, stop controls, close the dialog, place the scanned code in `#search-input`, and call the existing `runSearch(code)` path.
- On denial or failure, keep the dialog open and focus the manual input.

**Accessibility.**
- Dialog uses `role="dialog"` and `aria-modal="true"`.
- Status text uses `aria-live="polite"`.
- Escape and backdrop click dismiss the dialog.
- The camera button has an explicit `aria-label`.
