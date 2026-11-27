# Fiche Chrome Web Store — SpeedAllVideo 1.3.0

Tout est à copier-coller dans la console développeur (https://chrome.google.com/webstore/devconsole).
Le Chrome Web Store n'affiche pas le Markdown : les textes ci-dessous sont en texte brut.

## 0. Paquet à envoyer
« Nouvel élément » → choisir `speedallvideo-chrome/dist/speedallvideo-chrome-1.3.0.zip`.
(Testé dans Chromium : service worker, popup, options et changement de vitesse OK.)

Le nom et le résumé court viennent du paquet (`_locales/*/messages.json`), rien à saisir.

---

## 1. Onglet « Fiche Play Store » (Store listing)

**Langue par défaut** : English. Ajoute ensuite « Français » avec la description FR.

### Description — English
```
Control the playback speed of every video, everywhere.

SpeedAllVideo sets the speed of any HTML5 video from 0.25x to 4x: YouTube, Twitch, Vimeo, Dailymotion, online courses, video podcasts, social media, streaming sites… Your speed applies across all tabs.

Features
• 0.25x to 4x: slider, ± buttons and presets
• Keyboard shortcuts: S slow down, D speed up, R reset to 1x (adjustable step, keys can be swapped)
• Discreet speed badge on each video, readable on any background (can be hidden in the options)
• Large speed display when the speed changes (can be hidden too)
• Force 1x: stops a site from imposing its own speed
• Respects the speed already chosen in the site's player (e.g. YouTube), and doesn't get reset to 1x by a player reinitializing
• Your speed carries over to the next episode
• Also works in embedded players (iframes), modern players (Shadow DOM) and fullscreen
• Neutral on install: nothing changes until you pick a speed
• Interface in 12 languages

Podcasts: turn on the "Audio" option (off by default) to speed up the audio players of web pages too.

Privacy: no data collected, no network access. Permissions are limited to "tabs" (to share the speed between tabs) and "storage" (to remember your settings).

Derived from SpeedyVideo (Lin Cheng), MIT licensed.
```

### Description — Français
```
Contrôlez la vitesse de lecture de toutes vos vidéos, partout.

SpeedAllVideo règle la vitesse de n'importe quelle vidéo HTML5 de 0.25x à 4x : YouTube, Twitch, Vimeo, Dailymotion, cours en ligne, podcasts vidéo, réseaux sociaux, sites de streaming… La vitesse choisie s'applique à tous les onglets.

Fonctionnalités
• Vitesse de 0.25x à 4x : curseur, boutons ± et préréglages
• Raccourcis clavier : S ralentir, D accélérer, R revenir à 1x (pas réglable, touches échangeables)
• Badge discret sur chaque vidéo, lisible sur tous les fonds (masquable dans les options)
• Grand affichage de la vitesse au changement (masquable aussi)
• Forcer 1x : empêche un site d'imposer sa propre vitesse
• Respecte la vitesse déjà choisie dans le lecteur du site (ex : YouTube), et ne se laisse pas remettre à 1x par un lecteur qui se réinitialise
• La vitesse tient à l'épisode suivant
• Fonctionne aussi dans les lecteurs intégrés (iframes), les lecteurs modernes (Shadow DOM) et en plein écran
• Neutre à l'installation : rien n'est modifié tant que vous n'avez pas choisi de vitesse
• Interface en 12 langues

Podcasts : activez l'option « Audio » (désactivée par défaut) pour accélérer aussi les lecteurs audio des pages.

Vie privée : aucune donnée collectée, aucune connexion réseau. Permissions limitées à « onglets » (partager la vitesse entre onglets) et « stockage » (mémoriser vos réglages).

Dérivée de SpeedyVideo (Lin Cheng), sous licence MIT.
```

### Autres champs
| Champ | Valeur |
|---|---|
| Catégorie | Outils (Tools) — ou « Divertissement » si tu préfères |
| Langue | English (+ Français) |
| Icône de la fiche (128×128) | `speedallvideo-chrome/icon128.png` |
| Captures d'écran (1280×800) | `store/screenshots/1-video-en.png`, `2-popup-en.png`, `3-options-en.png` (versions `-fr` pour la fiche française) |
| Petite vignette promo (440×280) | `store/promo-440x280.png` |
| Site web / Assistance | https://github.com/Benegil/speedallvideo (et `/issues` pour l'assistance) |

---

## 2. Onglet « Pratiques de confidentialité » (Privacy)

**Objectif unique (Single purpose)**
```
Change the playback speed of HTML5 videos (and optionally audio) on web pages, with the same speed applied across all tabs.
```

**Justification — permission `tabs`**
```
Used to send the chosen speed to every open tab (chrome.tabs.query + chrome.tabs.sendMessage) and to apply it to newly created tabs. No tab URL or content is read or stored.
```

**Justification — permission `storage`**
```
Stores the user's settings (current speed, speed step, keyboard shortcuts, display options) with chrome.storage.sync. Nothing else is stored.
```

**Justification — autorisations d'hôte (content script sur `<all_urls>`)**
```
Videos can be on any website, including embedded players in iframes, so the content script must run on all pages to find <video>/<audio> elements and set their playbackRate. It does not read, collect or transmit page content.
```

**Code distant (Remote code)** : « Non, je n'utilise pas de code distant ». Tout le JavaScript est dans le paquet.

**Utilisation des données** : ne coche AUCUNE case de données collectées. Coche les trois certifications (pas de vente, pas d'usage hors objectif, pas d'évaluation de solvabilité).

**URL des règles de confidentialité** : facultative ici (aucune donnée collectée). Si la console l'exige, utilise https://github.com/Benegil/speedallvideo#privacy (section à ajouter au README si besoin).

---

## 3. Onglet « Distribution »
- Visibilité : **Public**
- Pays : tous

## 4. Envoi
« Envoyer pour examen ». Délai habituel : de quelques heures à quelques jours. L'examen peut être plus long à cause de l'accès à tous les sites (`<all_urls>`).
