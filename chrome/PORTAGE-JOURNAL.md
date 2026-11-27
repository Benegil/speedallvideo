# Journal de portage Chrome

- Étape 1 faite : `compat.js` créé.
- Étape 4 faite : `content.js` modifié — commentaire mis à jour (ligne ~108), ligne ~117 : fallback `chrome.dom.openOrClosedShadowRoot` ajouté.
- Étape 5 faite : `background.js` modifié — 5a `importScripts('compat.js')`, 5b `OffscreenCanvas` + `getImageData`, 5c `browser.action.setIcon({ imageData })`, 5d `loaded` + `onInstalled`, 5e `onMessage` entouré de `loaded.then`, 5f `tabs.onCreated` entouré de `loaded.then`.
- Étape 2 faite : `manifest.json` (vérifié par Claude).
- Étape 3 faite : `popup.html`, `options.html` (vérifié par Claude).
- Étape 6 faite : vérifié — `build.sh` produit déjà `dist/speedallvideo-chrome-$V.zip`, `package.json` propre (pas de `"publish"`, pas de `"screenshots"`), `tools/publish.sh`, `tools/amo-screenshots.mjs` et `amo/` n'existent pas dans ce projet.
- Étape 7 faite : `README.md` modifié — titre « SpeedAllVideo (Chrome) », « Extension Chrome », section « Aperçu » retirée, installation `chrome://extensions`, paquet `speedallvideo-chrome-<version>.zip`, tableau fichiers mis à jour (`compat.js`, `Manifest V3`, `Service worker`, retrait `amo/`).
- Étape 8 (TERMINÉ) : Portage Chrome terminé.
  Créés : `compat.js`, `PORTAGE-CHROME.md`, `PORTAGE-JOURNAL.md`
  Modifiés : `manifest.json` (V3), `background.js` (service worker), `content.js` (Shadow DOM), `popup.html` (compat), `options.html` (compat), `package.json` (retiré publish/screenshots), `README.md` (Chrome), `exclude.txt`, `tools/build.sh` (zip Chrome)
  Supprimés : `tools/publish.sh`, `tools/amo-screenshots.mjs`, `amo/` (description fr/en, metadata.json, screenshot-bg.jpg, 6 captures)
  Pas de commit git — en attente de vérification Claude.
