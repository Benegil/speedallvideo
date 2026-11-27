#!/bin/sh
# Publie la version courante sur addons.mozilla.org (canal public « listed »).
# Les clés d'API AMO sont lues dans ~/.config/speedallvideo/amo.env (à créer
# soi-même, chmod 600, hors du dépôt) :
#   WEB_EXT_API_KEY=user:xxxxxxxx:xxx
#   WEB_EXT_API_SECRET=xxxxxxxxxxxxxxxx
set -e
cd "$(dirname "$0")/.."
ENV="${AMO_ENV:-$HOME/.config/speedallvideo/amo.env}"
[ -f "$ENV" ] || { echo "Clés introuvables : créer $ENV (voir l'en-tête de tools/publish.sh)"; exit 2; }
set -a; . "$ENV"; set +a
sh tools/build.sh >/dev/null
V=$(node -p "require('./manifest.json').version")
rm -rf dist/src && mkdir -p dist/src && unzip -q "dist/speedallvideo-$V.xpi" -d dist/src
npx -y web-ext@8 lint --source-dir dist/src --output text
npx -y web-ext@8 sign --source-dir dist/src --channel listed --amo-metadata amo/metadata.json --approval-timeout 0 --artifacts-dir dist
