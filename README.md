# SpeedAllVideo

Extension Firefox : contrôle de la vitesse de lecture vidéo/audio sur tous les onglets, de **0.25x à 4x**.
Dérivée de [SpeedyVideo](https://addons.mozilla.org/fr/firefox/addon/speedy-video/) (Lin Cheng, MIT), réécrite et resserrée.

## Fonctionnalités

- **Vitesse partagée** : un seul réglage pour tous les onglets ; l'icône affiche la vitesse courante (label long défilant).
- **Badges sur chaque vidéo** : flash central au changement de vitesse, puis badge permanent 10px en haut à droite du lecteur.
- **Badge global** : si aucune vidéo n'est visible mais qu'un conteneur de lecteur existe (ex : YouTube avant le clic sur Play), la vitesse s'affiche dans ce conteneur — pas au coin de l'écran.
- **Force 1x** : force la vitesse à 1.0x et suit les changements faits dans le lecteur du site (pour restaurer la bonne vitesse à la désactivation).
- **Détection passive** : si vous changez la vitesse depuis le menu du site, l'extension adopte cette valeur.
- **Raccourcis clavier** (hors champs de saisie) : `S` ralentir, `D` accélérer, `R` retour à 1x — pas réglable via *Speed Step* dans les options.

## Installation (développement)

1. [about:debugging](about:debugging#/runtime/firefox) → **Ce Firefox** → **Charger une extension temporaire…**
2. Sélectionner le `manifest.json` de ce dossier.

Pour regénérer les icônes statiques du manifest : `python3 tools/make-icons.py` (Pillow requis).

## Tests

`test/` contient des pages HTML autonomes avec un `browser` simulé en mémoire — aucun serveur ni extension n'est nécessaire :

- `test/index.html` — 10 scénarios automatiques (rechargement, forcage, restauration, détection, anti-écho, double-injection, badge global…) ;
- `test/force-test.html` — scénario de forcage pas à pas.

Ouvrir simplement dans Firefox (file:// suffit).

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Manifest V2 (Firefox) |
| `background.js` | Vitesse courante, icône dynamique, diffusion aux onglets |
| `content.js` | Application de la vitesse, overlays, détection, raccourcis |
| `popup.html` / `popup.js` | Fenêtre d'action : vitesse, presets (0.25 → 3.0), reset |
| `options.html` / `options.js` | Réglages : pas de vitesse, Force 1x, raccourcis |
| `test/` | Pages de test autonomes |
| `tools/make-icons.py` | Génération des icônes statiques |

## Stockage (storage.sync)

| Clé | Défaut | Usage |
|---|---|---|
| `defaultSpeed` | 1.0 | Vitesse courante partagée |
| `speedStep` | 0.25 | Pas des boutons ± et des raccourcis S/D |
| `forceOneX` | false | Force la vitesse à 1.0x |

## Licence

MIT — voir `LICENSE`.
