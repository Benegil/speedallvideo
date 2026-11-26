# Changelog
All notable changes to SpeedyVideo Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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