#!/usr/bin/env python3
"""Genera iconos PNG para la PWA a partir de un diseño simple."""

from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "src", "public", "icons")

COLORS = {
    "bg": "#0a0a0a",
    "circle": "#1a1a1a",
    "stroke": "#333333",
    "text": "#ffffff",
}


def create_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), COLORS["bg"])
    draw = ImageDraw.Draw(img)

    padding = int(size * 0.12)
    circle_box = [padding, padding, size - padding, size - padding]
    stroke_width = max(2, int(size * 0.015))
    draw.ellipse(circle_box, fill=COLORS["circle"], outline=COLORS["stroke"], width=stroke_width)

    # Intentar usar una fuente del sistema; si falla, usa la fuente por defecto
    font_size = int(size * 0.55)
    text = "M"
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) / 2
    y = (size - text_height) / 2 - text_height * 0.1
    draw.text((x, y), text, font=font, fill=COLORS["text"])

    return img


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    sizes = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
    }
    for filename, size in sizes.items():
        img = create_icon(size)
        img.save(os.path.join(OUTPUT_DIR, filename), "PNG")
        print(f"Generated {filename} ({size}x{size})")

    # Icono para system tray (Windows)
    tray_icon = create_icon(64)
    tray_icon.save(
        os.path.join(OUTPUT_DIR, "icon.ico"),
        format="ICO",
        sizes=[(64, 64), (48, 48), (32, 32), (16, 16)]
    )
    print("Generated icon.ico (tray icon)")


if __name__ == "__main__":
    main()
