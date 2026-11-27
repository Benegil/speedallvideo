#!/usr/bin/env python3
"""Régénère les icônes statiques de SpeedAllVideo (manifest.json) avec le même
rendu que drawSpeedIcon() de background.js : cadre blanc 1px arrondi sur fond
#1e1e1e, label « 1x » centré en blanc. Avant ce script, Firefox affichait
l'ancien X jusqu'à la première mise à jour de l'icône dynamique."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # dossier racine
DARK = (30, 30, 30, 255)   # #1e1e1e
WHITE = (255, 255, 255, 255)
LABEL = "1x"


def find_font(size):
    """Police bold la plus proche de la taille demandée."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_speed_icon(size):
    img = Image.new("RGBA", (size, size), DARK)
    d = ImageDraw.Draw(img)
    radius = max(2, round(size * 0.15))
    # Cadre blanc 1px légèrement arrondi (comme ctx.roundRect en JS).
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, outline=WHITE, width=1)
    # Texte : hauteur = taille − 2 (comme font-size = size - 2 en JS).
    font = find_font(max(4, size - 2))
    bbox = d.textbbox((0, 0), LABEL, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    d.text((x, y), LABEL, font=font, fill=WHITE)
    return img


for size in (16, 32, 48, 128):
    draw_speed_icon(size).save(os.path.join(OUT, f"icon{size}.png"))
    print(f"icon{size}.png régénéré")
