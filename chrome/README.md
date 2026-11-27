# SpeedAllVideo (Chrome)

Extension Chrome : contrôle de la vitesse de lecture des vidéos sur tous les onglets, de **0.25x à 4x**.
Dérivée de [SpeedyVideo](https://addons.mozilla.org/fr/firefox/addon/speedy-video/) (Lin Cheng, MIT), réécrite et resserrée.

**Installer** : [Chrome Web Store](https://chromewebstore.google.com/detail/jjceccjojookhjpjgfpkejggiangilok) (lien actif dès la fin de l'examen par Google) · version Firefox : [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/speedallvideo/).

## Fonctionnalités

- **Vitesse partagée** : un seul réglage pour tous les onglets ; l'icône affiche la vitesse courante (label long défilant).
- **Partout** : pages classiques, lecteurs en **iframe** (streaming, vidéos intégrées), lecteurs en **Shadow DOM** (Web Components), **plein écran**.
- **Badges sur chaque vidéo** : grand affichage central au changement de vitesse (taille relative à la vidéo), puis badge permanent en haut à droite, lisible sur tous les fonds ; recalé sous les en-têtes fixes et rogné par les zones qui défilent. Les deux sont masquables (options).
- **Badge global** : si aucune vidéo n'est visible mais qu'un conteneur de lecteur existe (ex : YouTube avant Play), la vitesse s'affiche dans ce conteneur.
- **Signal sonore** façon jeu vidéo (plus aigu = plus rapide) sur les raccourcis et les boutons ; icône haut-parleur dans le popup (= case des options). Joué d'office quand la vidéo elle-même est en plein écran (aucun affichage possible).
- **Respect du site** : la vitesse posée par le lecteur (menu YouTube…) est adoptée ; un retour à 1.0 n'est adopté qu'après un geste de l'utilisateur — les 1.0 écrits par le lecteur à son initialisation sont ignorés. La vitesse tient à l'épisode suivant.
- **Neutre à l'installation** : rien n'est modifié tant qu'aucune vitesse n'a été choisie.
- **Force 1x** : force la vitesse à 1.0x et mémorise celle choisie dans le lecteur du site (restaurée à la désactivation).
- **Raccourcis clavier** (hors champs de saisie) : `S` ralentir, `D` accélérer, `R` retour à 1x — les trois lettres s'échangent par glisser-déposer dans le popup ou les paramètres (ex : `S` pour « speed » = accélérer).
- **Engrenage** dans le popup : ouvre les paramètres.
- **Audio** (option, désactivée par défaut) : applique aussi la vitesse aux lecteurs `<audio>` des pages (podcasts, livres audio).
- **Interface** en 12 langues (suit la langue du navigateur) : français, anglais, espagnol, allemand, italien, portugais (Brésil), néerlandais, polonais, russe, japonais, chinois simplifié, coréen.

## Installation (développement)

1. `chrome://extensions` → activer **Mode développeur**
2. **Charger l'extension non empaquetée** → choisir ce dossier
3. Après une modification : bouton ⟳ de l'extension, puis recharger les onglets.

Icônes statiques du manifest : `python3 tools/make-icons.py` (Pillow requis).

## Tests

`test/` contient des pages HTML autonomes avec un `browser` simulé en mémoire (aucune extension ni serveur nécessaire).

```sh
npm install        # une fois : playwright-core (aucun navigateur téléchargé)
npm test           # lance toutes les pages automatiques dans Chrome headless
```

Le lanceur (`tools/run-tests.mjs`) utilise Google Chrome ou Chromium installé (variable `CHROME` pour un autre chemin) : la vidéo de test est en H.264. Les pages s'ouvrent aussi à la main dans un navigateur.

| Page | Vérifie |
|---|---|
| `index.html` | Rechargement, Force 1x, détection, anti-écho, raccourcis, double injection |
| `startup-test.html` (`?install`) | Vitesse du site conservée au chargement ; neutre à l'installation |
| `intent-test.html` | 1.0 écrit par le lecteur ignoré ; « Normal » choisi par l'utilisateur adopté |
| `robust-test.html` | Shadow DOM, épisode suivant, vidéo créée en JS, plein écran |
| `iframe-test.html` | Vidéo dans une iframe, raccourcis depuis la page ou le lecteur |
| `abs-test.html` | Vidéo en position absolue (structure YouTube), plein écran du document |
| `header-test.html` / `scroller-test.html` | Badge sous les en-têtes fixes, rogné par les zones qui défilent |
| `orphan-test.html` | Pas de badge en double quand une vidéo est remplacée |
| `flash-test.html` | Grand affichage dimensionné sur la vidéo |
| `display-test.html` | Options masquer badge / grand affichage |
| `sound-test.html` | Signal sonore (option, hauteur, plein écran de la vidéo) |
| `audio-test.html` | Option Audio : lecteurs `<audio>` inclus / remis à 1x |
| `force-test.html` / `overlay-test.html` | Pas à pas manuels |

## Paquet

```sh
npm run build      # → dist/speedallvideo-chrome-<version>.zip (à envoyer sur le Chrome Web Store)
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Manifest V3 (Chrome) |
| `background.js` | Service worker : vitesse courante, icône dynamique, diffusion aux onglets |
| `compat.js` | `browser.*` = `chrome.*` (Chrome) |
| `content.js` | Application de la vitesse, overlays, détection, raccourcis (toutes les frames) |
| `sound.js` | Signal sonore partagé (pages, popup, options) |
| `i18n.js`, `_locales/` | Traductions fr / en |
| `popup.html` / `popup.js` | Fenêtre d'action : vitesse, presets, reset, son |
| `options.html` / `options.js` | Réglages : pas, Force 1x, affichage, son |
| `test/` | Pages de test autonomes |
| `tools/` | Tests, construction du paquet, icônes |

## Stockage (storage.sync)

| Clé | Défaut | Usage |
|---|---|---|
| `defaultSpeed` | *(aucune : neutre)* | Vitesse courante partagée |
| `speedStep` | 0.25 | Pas des boutons ± et des raccourcis S/D |
| `forceOneX` | false | Force la vitesse à 1.0x |
| `hideBadge` | false | Masque le badge permanent |
| `hideFlash` | false | Masque le grand affichage au changement |
| `soundFx` | true | Signal sonore (icône du popup = case des options) |
| `withAudio` | false | Inclut les lecteurs `<audio>` |
| `keyMap` | `{slow:'s', fast:'d', reset:'r'}` | Lettres des raccourcis (permutation de s / d / r) |

## Licence

MIT — voir `LICENSE`.
