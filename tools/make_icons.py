#!/usr/bin/env python3
"""Génère les icônes SpeedAllVideo : cercle blanc + grand X gras (double trait)."""
from PIL import Image, ImageDraw

def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Cercle blanc avec bordure grise (comme l'icône d'origine)
    border = max(1, round(size * 0.055))
    pad = max(1, round(size * 0.04))
    d.ellipse([pad, pad, size - 1 - pad, size - 1 - pad], fill=(255, 255, 255, 255),
              outline=(130, 138, 146, 255), width=border)

    # Grand X gras : deux barres croisées épaisses, dessinées en double passe
    # (un peu plus large + un peu moins large) pour un trait net et épais.
    cx = cy = size / 2
    r = (size / 2 - pad - border) * 0.62  # rayon de l'X, avec marge

    def draw_x(width: float, color):
        d.line([(cx - r, cy - r), (cx + r, cy + r)], fill=color, width=max(1, int(round(width))))
        d.line([(cx - r, cy + r), (cx + r, cy - r)], fill=color, width=max(1, int(round(width))))

    base_w = size * 0.20
    draw_x(base_w * 1.35, (90, 96, 104, 255))   # passe large (fond)
    draw_x(base_w, (45, 50, 58, 255))           # passe fine (cœur sombre)

    return img

for s in (16, 32, 48, 128):
    make_icon(s).save(f"/home/gilles/ajean/workspace/speedallvideo/icon{s}.png")
    print(f"icon{s}.png OK")
