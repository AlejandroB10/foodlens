# F-21 · Barcode scan via webcam requirements

**Owner.** Alejandro Rodriguez Arguimbau

**User story.** As Marc Vidal, I want to scan a product barcode from the shelf so that FoodLens can open the same dual-axis product view without making me type the number manually.

**Acceptance criteria.**
- AC1: The search bar includes a camera button with an accessible label.
- AC2: Camera permission is requested only after the user clicks the camera button.
- AC3: A successful EAN scan fills the search field and runs the existing barcode lookup flow.
- AC4: If camera access is denied, unsupported, or the scanner library fails, the user can paste an 8 to 13 digit barcode manually.
- AC5: The scanner can be dismissed with the close button, backdrop click, or Escape, and it stops the camera stream.

**Out of scope.** Native mobile scanning, product contribution flows for missing barcodes, and multi-barcode shelf comparison; those belong to later features.
