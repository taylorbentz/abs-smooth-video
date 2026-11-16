#!/bin/sh
# Re-renders extension icons and the store promo tile from art/*.svg.
# Requires rsvg-convert (brew install librsvg).
set -eu
cd "$(dirname "$0")/.."
for s in 16 32 48; do
  rsvg-convert -w "$s" -h "$s" art/icon.svg -o "extension/icons/icon-$s.png"
done
rsvg-convert -w 128 -h 128 art/icon-store.svg -o extension/icons/icon-128.png
rsvg-convert -w 440 -h 280 art/promo-440x280.svg -o art/promo-440x280.png
echo "icons rendered"
