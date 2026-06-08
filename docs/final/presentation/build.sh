#!/usr/bin/env bash
# Build the FoodLens final presentation from slides.md:
#   - slides.pdf   : beamer (Singapore/dolphin) — projector-friendly
#   - slides.pptx  : each slide is the beamer page image + the speaker notes
#                    (this is how we keep the beamer look in .pptx — pandoc does
#                     NOT apply beamer themes to its native pptx output)
#
# Requirements: pandoc, a LaTeX engine (pdflatex), pdftoppm (poppler-utils),
#               python3 with python-pptx  (pip install python-pptx)
#
# Usage:  ./build.sh        # build both slides.pdf and slides.pptx
#
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/3] slides.md -> slides.pdf (beamer Singapore/dolphin)"
pandoc slides.md -t beamer -o slides.pdf

echo "[2/3] slides.pdf -> page images (300 dpi)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pdftoppm -png -r 300 slides.pdf "$TMP/slide"

echo "[3/3] page images + speaker notes -> slides.pptx"
python3 build_pptx.py "$TMP"

echo "Done -> slides.pdf  +  slides.pptx"
