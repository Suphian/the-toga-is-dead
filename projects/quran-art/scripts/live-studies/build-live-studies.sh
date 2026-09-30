#!/usr/bin/env bash
# Rebuild the LIVE Quran studies (Verse Shell / Word Current / Verse Lines: the generator at commit
# 1fa0c9c, which is what suph.app serves) with the crawl layer from scripts/page-meta.js, and copy
# the output into site/quran and site/surah. The generator at HEAD emits the one-rule prototype
# (Rays / Rows / Spiral), which is not approved; use this script until it is, then run
# `ONE_RULE_APPROVED=1 node scripts/build_site.js` instead and delete this directory. HEAD's
# build_site.js refuses to run without that variable; this script builds the archived 1fa0c9c copy.
#   usage (from anywhere): bash projects/quran-art/scripts/live-studies/build-live-studies.sh
# Needs git, python and `npm ci` in projects/quran-art (for @resvg/resvg-js and sharp).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${1:-$(cd "$HERE/../../../.." && pwd)}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$REPO" archive 1fa0c9c projects/quran-art | tar -x -C "$TMP"
cd "$TMP/projects/quran-art"
python "$HERE/live-studies.py"
cp "$REPO/projects/quran-art/scripts/page-meta.js" scripts/
NODE_PATH="$REPO/projects/quran-art/node_modules" node scripts/build_site.js
cp -r "$TMP/site/quran/." "$REPO/site/quran/"
cp -r "$TMP/site/surah/." "$REPO/site/surah/"
echo "live studies rebuilt into $REPO/site/quran and $REPO/site/surah"
