#!/usr/bin/env python3
"""Gera os ícones do PWA a partir do ídolo de ouro do próprio jogo (idolo-sprite.png, exportado de Art.idol).

Uso: python3 src/icons/make.py   (precisa do Pillow; os PNGs gerados ficam versionados e o build.py só os copia)
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
INK, DEEP, MOSS, LEAF, LEAF2, FERN = (13, 20, 16), (27, 46, 34), (36, 64, 44), (47, 90, 54), (63, 116, 66), (91, 146, 72)

def sprite():
    im = Image.open(os.path.join(HERE, "idolo-sprite.png")).convert("RGBA")
    return im.crop(im.getbbox())

def leaf(draw, cx, cy, ang, length, width, color):
    """folha em forma de lança (polígono), desenhada numa grade pequena e ampliada sem suavizar: vira pixel art"""
    side, back = [], []
    for i in range(21):
        t = i / 20
        w = width * math.sin(math.pi * t) * (1 - t * 0.3)
        x, y = cx + math.cos(ang) * t * length, cy + math.sin(ang) * t * length
        nx, ny = -math.sin(ang), math.cos(ang)
        side.append((x + nx * w, y + ny * w)); back.append((x - nx * w, y - ny * w))
    draw.polygon(side + back[::-1], fill=color)

def icon(size, scale, maskable=False):
    img = Image.new("RGBA", (size, size), INK + (255,))
    d = ImageDraw.Draw(img)
    for y in range(size):  # céu da mata: verde escuro em cima, musgo embaixo
        k = y / size
        d.line([(0, y), (size, y)], fill=tuple(round(DEEP[i] * (1 - k) + INK[i] * k) for i in range(3)) + (255,))
    lo = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); ld = ImageDraw.Draw(lo)  # folhas na grade de 64 × 64
    for (cx, cy, ang, ln, wd, col) in [(-20, 80, 0.35, 230, 34, MOSS), (-10, 200, -0.25, 200, 30, LEAF), (532, 60, math.pi - 0.4, 240, 36, MOSS),
                                       (530, 210, math.pi + 0.3, 190, 28, LEAF), (-20, 470, -0.75, 220, 34, LEAF2), (532, 480, math.pi + 0.8, 230, 34, LEAF2),
                                       (120, 540, -1.35, 170, 26, FERN), (400, 545, -1.85, 170, 26, FERN)]:
        if maskable:  # na versão adaptável as folhas recuam para dentro da área segura
            cx, cy = 256 + (cx - 256) * 0.82, 256 + (cy - 256) * 0.82
        k = 64 / 512
        leaf(ld, cx * k, cy * k, ang, ln * k, wd * k * 0.85, col + (255,))
    img.alpha_composite(lo.resize((size, size), Image.NEAREST))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([size * 0.2, size * 0.16, size * 0.8, size * 0.84], fill=(255, 214, 110, 120))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(size * 0.08)))
    sp = sprite()
    sp = sp.resize((sp.width * scale, sp.height * scale), Image.NEAREST)
    shadow = Image.new("RGBA", sp.size, (0, 0, 0, 0)); shadow.putalpha(sp.getchannel("A").point(lambda a: 110 if a else 0))
    ox, oy = (size - sp.width) // 2, (size - sp.height) // 2
    img.alpha_composite(shadow, (ox + scale * 2, oy + scale * 2))
    img.alpha_composite(sp, (ox, oy))
    return img.convert("RGB")

def main():
    out = {  # nome: (tamanho, escala do sprite, adaptável)
        "icon-512.png": (512, 7, False), "icon-192.png": (192, 3, False), "apple-touch-icon.png": (180, 3, False),
        "icon-maskable-512.png": (512, 5, True), "icon-maskable-192.png": (192, 2, True), "favicon-32.png": (32, 1, False),
    }
    for name, (size, scale, mask) in out.items():
        icon(size, scale, mask).save(os.path.join(HERE, name), optimize=True)
        print(name, size)

if __name__ == "__main__":
    main()
