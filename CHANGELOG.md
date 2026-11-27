# Changelog
All notable changes to SpeedAllVideo (derived from SpeedyVideo) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-27
### Ajouté
- **Engrenage** dans le popup, avant le haut-parleur : ouvre les paramètres de l'extension.
- **Raccourcis échangeables** : dans le popup et les paramètres, glisser une lettre (S, D, R) sur une autre échange les deux raccourcis (ex : `S` pour « speed » = accélérer). Réglage `keyMap`, appliqué tout de suite à tous les onglets.
- **10 langues de plus** : espagnol, allemand, italien, portugais (Brésil), néerlandais, polonais, russe, japonais, chinois simplifié, coréen.

## [1.2.1] - 2026-11-27
### Corrigé
- Le plugin réécrivait la vitesse deux fois par seconde même quand elle était déjà bonne : l'indicateur de vitesse de certains lecteurs restait affiché en permanence. Il n'écrit plus que si la vitesse change, ou après une action de l'utilisateur.
- Un lecteur qui pose une vitesse de 0 le temps de charger figeait la vidéo à 0x : les vitesses hors limites sont ignorées.

### Modifié
- Firefox 110 minimum déclaré dans le manifest (requêtes de conteneur CSS).

## [1.2.0] - 2026-11-27
### Ajouté
- **Lecteurs en iframe** (sites de streaming, vidéos intégrées) : le script tourne dans toutes les frames.
- **Shadow DOM** : vidéos des lecteurs en Web Components (ex : Reddit), y compris les shadow roots fermés (Firefox).
- **Plein écran** : badge et grand affichage rangés dans l'élément plein écran.
- **Signal sonore** façon jeu vidéo (hauteur = vitesse) : raccourcis, boutons du popup et des options ; icône haut-parleur dans le popup ; joué d'office quand la vidéo elle-même est en plein écran.
- **Options d'affichage** : masquer le badge permanent, masquer le grand affichage au changement.
- **Option Audio** (désactivée par défaut) : la vitesse s'applique aussi aux lecteurs `<audio>` (podcasts).
- **Interface multilingue** français / anglais (`_locales/`, `i18n.js`).
- **Neutre à l'installation** : aucune vitesse imposée tant qu'aucune n'a été choisie.
- Fiche AMO (`amo/`), script de tests automatiques (`npm test`) et de construction du paquet (`npm run build`).

### Modifié
- La vitesse déjà posée par le site au chargement (ex : YouTube à 0.25x) est conservée au lieu d'être écrasée.
- Un retour à 1.0 écrit par le lecteur lui-même (initialisation, bande-annonce, pub) n'est plus pris pour un choix : adopté seulement après un geste de l'utilisateur (menu, touche du lecteur). Idée reprise de Video Speed Controller.
- La vitesse tient à l'épisode suivant (`defaultPlaybackRate`).
- Badge permanent blanc cerclé de noir : lisible sur tous les fonds.
- Grand affichage dimensionné sur la vidéo (plus sur la fenêtre).

### Corrigé
- Vitesse du site écrasée en boucle par l'observateur du DOM ; détections en écho.
- Badge en double (overlays orphelins quand une vidéo est retirée/remplacée).
- Badge affiché par-dessus les en-têtes fixes/collants et hors des zones qui défilent (Civitai).
- Badge invisible sur youtube.com (rognage erroné des vidéos en position absolue).
- Options masquer badge/flash sans effet immédiat.

## [1.1.0] - 2024-10-27
### Added
- System-wide dark mode support using `prefers-color-scheme` media query
- CSS variable-based theming system for consistent appearance
- Dark mode color palette optimized for eye comfort:
    - Background: #121212
    - Text: #ffffff
    - Input fields: #1e1e1e
    - Buttons: #bb86fc with black text
    - Enhanced border contrast for input fields

### Changed
- Implemented CSS custom properties (variables) for all colors:
    - `--background-color`
    - `--text-color`
    - `--input-bg`
    - `--button-bg`
    - `--button-text`
    - `--status-text`
- Improved input field styling with better dark mode contrast
- Enhanced button hover states
- Optimized border colors for dark theme visibility

### Technical
- Restructured CSS using CSS variables for dynamic theme switching
- Added media query `@media (prefers-color-scheme: dark)` for automatic theme detection
- Implemented responsive design with `max-width: 500px` for better usability
- Enhanced accessibility with optimized color contrast ratios
- Maintained consistent spacing with standardized padding and margins

## [1.0.0] - Initial Release
### Features
- Video and audio playback speed control up to 16x
- Cross-tab speed consistency
- Granular speed adjustment (0.25 step increments)
- Speed range from 0.25x to 16x
- Default speed setting persistence
- Clean, intuitive settings interface
- Support for both Firefox Desktop and Android

### Technical
- Implemented number input with precise constraints:
    - Minimum: 0.25
    - Maximum: 16
    - Step: 0.25
- Mobile-responsive design with viewport meta tag
- Efficient DOM manipulation for speed control
- Cross-browser compatible styling
- Status feedback system for user actions
- Optimized performance for high-speed playback

### UI/UX
- Sans-serif font for optimal readability
- Consistent padding and spacing (20px standard)
- Responsive button and input styling
- Clear visual feedback for user interactions
- Intuitive layout with logical element grouping