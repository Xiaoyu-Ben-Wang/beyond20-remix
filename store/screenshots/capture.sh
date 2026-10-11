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

n=1
for scene in skills advantage favorites initiative themes; do
    out="$here/$n-$scene.png"
    out_native="$out"
    command -v cygpath >/dev/null && out_native="$(cygpath -w "$out")"
    # 853x533 CSS pixels at 1.5x is 1280x800 (the height rounds up a pixel and is trimmed
    # by the window size). The virtual time budget lets the launcher's timers settle.
    "$browser" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
        --force-device-scale-factor=1.5 --window-size=853,533 \
        --virtual-time-budget=4000 --screenshot="$out_native" "$base?scene=$scene" >/dev/null 2>&1
    echo "wrote $out"
    n=$((n + 1))
done
