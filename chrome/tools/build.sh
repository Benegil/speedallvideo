#!/bin/sh
# Construit dist/speedallvideo-chrome-<version>.zip : zip du dossier, sans les fichiers
# listés dans exclude.txt (tests, outils, docs…).
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./manifest.json').version")
OUT="dist/speedallvideo-chrome-$V.zip"
mkdir -p dist
rm -f "$OUT"
zip -r -X -q "$OUT" . -x@exclude.txt
echo "$OUT"
unzip -l "$OUT"
