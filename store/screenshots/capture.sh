#!/usr/bin/env bash
# Render every scene of harness.html to a 1280x800 PNG for the Chrome Web Store.
# Usage: store/screenshots/capture.sh   (needs Chrome or Edge installed)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

browser=""
for candidate in \
    "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
    "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then browser="$candidate"; break; fi
done
[ -n "$browser" ] || { echo "No Chrome or Edge found" >&2; exit 1; }

# A file:// URL the browser understands on every platform.
if command -v cygpath >/dev/null; then
    base="file:///$(cygpath -m "$here")/harness.html"
else
    base="file://$here/harness.html"
fi

# scene, output file, CSS width, CSS height, device scale factor. The CSS size times the
# scale is the store's size: 1280x800 screenshots, a 440x280 small promo tile and a
# 1400x560 marquee.
shots="
skills 1-skills.png 853 533 1.5
advantage 2-advantage.png 853 533 1.5
favorites 3-favorites.png 853 533 1.5
initiative 4-initiative.png 853 533 1.5
themes 5-themes.png 853 533 1.5
promo-small promo-small-440x280.png 440 280 1
promo-marquee promo-marquee-1400x560.png 700 280 2
"

echo "$shots" | while read -r scene file width height scale; do
    [ -n "$scene" ] || continue
    out="$here/$file"
    out_native="$out"
    command -v cygpath >/dev/null && out_native="$(cygpath -w "$out")"
    # (853x533 at 1.5x rounds up to 1280x800.) The virtual time budget lets the
    # launcher's timers settle.
    "$browser" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
        --force-device-scale-factor="$scale" --window-size="$width,$height" \
        --virtual-time-budget=4000 --screenshot="$out_native" "$base?scene=$scene" >/dev/null 2>&1
    echo "wrote $out"
done
