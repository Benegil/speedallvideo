#!/bin/sh
# Construit dist/speedallvideo-<version>.xpi : zip du dossier, sans les fichiers
# listés dans exclude.txt (tests, outils, docs, fiche AMO…).
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./manifest.json').version")
OUT="dist/speedallvideo-$V.xpi"
mkdir -p dist
rm -f "$OUT"
zip -r -X -q "$OUT" . -x@exclude.txt
echo "$OUT"
unzip -l "$OUT"
