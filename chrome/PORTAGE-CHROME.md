# Portage Chrome de SpeedAllVideo — consignes pour Jean

Dossier de travail : `/home/gilles/ajean/workspace/speedallvideo-chrome` (copie de la version Firefox 1.2.1).
Objectif : la même extension pour Google Chrome (Manifest V3), **sans changer le comportement**.

## Règles
- Ne modifie QUE ce qui est demandé ci-dessous. Ne réécris pas `content.js` : il ne change que sur une ligne (étape 4).
- Fais les étapes dans l'ordre, une à la fois. Après chaque étape, écris une ligne dans `PORTAGE-JOURNAL.md` : « Étape N faite : fichiers modifiés ».
- Garde le code en français dans les commentaires, comme le reste du projet.
- Ne touche pas à `_locales/`, `popup.js`, `options.js`, `sound.js`, `i18n.js`, ni aux tests `test/`.
- Si une étape est impossible ou si tu doutes, note-le dans le journal et passe à la suivante.

## Étape 1 — `compat.js` (nouveau fichier)
Chrome n'a pas l'objet `browser`, seulement `chrome` (dont les fonctions renvoient des Promises en MV3). Crée `compat.js` :

```js
/* SpeedAllVideo — compatibilité Chrome : browser.* = chrome.* (Promises en MV3) */
if (typeof globalThis.browser === 'undefined') globalThis.browser = chrome;
```

## Étape 2 — `manifest.json` (Manifest V3)
Remplace tout le fichier par :

```json
{
  "manifest_version": 3,
  "name": "SpeedAllVideo",
  "version": "1.2.1",
  "default_locale": "en",
  "description": "__MSG_extDescription__",
  "minimum_chrome_version": "116",
  "icons": { "16": "icon16.png", "32": "icon32.png", "48": "icon48.png", "128": "icon128.png" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["compat.js", "sound.js", "content.js"],
      "all_frames": true,
      "match_about_blank": true,
      "match_origin_as_fallback": true
    }
  ],
  "action": { "default_popup": "popup.html", "default_icon": { "16": "icon16.png", "32": "icon32.png", "48": "icon48.png" } },
  "options_ui": { "page": "options.html", "open_in_tab": false },
  "permissions": ["tabs", "storage"]
}
```

## Étape 3 — `popup.html` et `options.html`
Dans chacun, ajoute `<script src="compat.js"></script>` **juste avant** `<script src="i18n.js"></script>`. Rien d'autre.

## Étape 4 — `content.js` : Shadow DOM fermé (UNE seule ligne)
Ligne ~117 :
```js
            try { sr = el.openOrClosedShadowRoot || el.shadowRoot; } catch (e) {}
```
devient :
```js
            try { sr = el.openOrClosedShadowRoot || (globalThis.chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot ? chrome.dom.openOrClosedShadowRoot(el) : null) || el.shadowRoot; } catch (e) {}
```
Et dans le commentaire au-dessus (ligne ~110), ajoute « / Chrome : chrome.dom.openOrClosedShadowRoot ».

## Étape 5 — `background.js` (service worker)
En MV3 le background est un *service worker* : pas de `document`, et Chrome peut l'arrêter puis le relancer à tout moment (les variables repartent à zéro). Modifications :

5a. Tout en haut du fichier : `importScripts('compat.js');`

5b. Dans `drawIcon` : remplace
```js
    const c = document.createElement('canvas');
    c.width = c.height = size;
```
par
```js
    const c = new OffscreenCanvas(size, size); // pas de document dans un service worker
```
et la dernière ligne `return c.toDataURL('image/png');` par `return x.getImageData(0, 0, size, size);`

5c. Dans `setIcon` : `browser.browserAction.setIcon({ path: { ... } })` devient `browser.action.setIcon({ imageData: { ... } })` (mêmes clés 16/32/48). Ajoute `.catch(() => {})` à la fin de l'appel (c'est une Promise).

5d. État rechargé à chaque réveil : remplace le bloc d'init
`browser.storage.sync.get('defaultSpeed').then(res => { ... });` par :
```js
/* Init (à chaque réveil du service worker) : on recharge la vitesse du stockage
   puis on redessine TOUJOURS l'icône. « loaded » permet de répondre juste. */
const loaded = browser.storage.sync.get('defaultSpeed').then(res => {
    if (res.defaultSpeed) {
        speed = clamp(res.defaultSpeed);
        chosen = true;
    }
    iconSpeed = round2(speed);
    setIcon(iconSpeed);
});
```
(on ne fait plus `broadcast()` ici : en Chrome le service worker se réveille souvent, inutile de re-diffuser à chaque fois.)

À l'installation ou à la mise à jour, on diffuse une fois : ajoute
```js
browser.runtime.onInstalled.addListener(() => loaded.then(() => { if (chosen) broadcast(); }));
```

5e. Le listener `browser.runtime.onMessage` attend `loaded` avant de répondre :
```js
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    loaded.then(() => {
        if (msg.action === 'setSpeed') {
            speed = clamp(msg.speed);
            chosen = true;
            broadcast();
            browser.storage.sync.set({ defaultSpeed: speed });
            iconSpeed = round2(speed);
            setIcon(iconSpeed);
        } else if (msg.action === 'getCurrentSpeed') {
            sendResponse({ speed });
        }
    });
    return msg.action === 'getCurrentSpeed'; // true = réponse asynchrone (obligatoire en Chrome)
});
```

5f. `tabs.onCreated` : même chose, entoure le contenu de `loaded.then(() => { ... })`.

## Étape 6 — Paquet Chrome
- `tools/build.sh` : le fichier produit devient `dist/speedallvideo-chrome-$V.zip` (au lieu de `.xpi`).
- Supprime `tools/publish.sh` (spécifique à Firefox/AMO) et retire la ligne `"publish"` de `package.json`.
- Supprime le dossier `amo/` et la ligne `"screenshots"` de `package.json` ainsi que `tools/amo-screenshots.mjs`.

## Étape 7 — `README.md`
- Titre : « SpeedAllVideo (Chrome) ».
- Première phrase : « Extension Chrome : … ».
- Section « Installation (développement) » remplacée par :
  1. `chrome://extensions` → activer **Mode développeur**
  2. **Charger l'extension non empaquetée** → choisir ce dossier
  3. Après une modification : bouton ⟳ de l'extension, puis recharger les onglets.
- Section « Paquet » : `npm run build` → `dist/speedallvideo-chrome-<version>.zip` (à envoyer sur le Chrome Web Store). Retire les phrases sur AMO et `npm run publish`.
- Retire la section « Aperçu » (les captures étaient dans `amo/`).
- Tableau « Fichiers » : ajoute la ligne `compat.js` | « browser.* = chrome.* (Chrome) » ; `manifest.json` devient « Manifest V3 (Chrome) » ; `background.js` devient « Service worker : vitesse courante, icône dynamique, diffusion aux onglets ». Retire la ligne `amo/`.

## Étape 8 — Fin
Écris dans `PORTAGE-JOURNAL.md` : « TERMINÉ » et la liste des fichiers modifiés/supprimés/créés. Ne fais pas de commit git : Claude vérifiera, testera et corrigera.
