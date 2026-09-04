#!/usr/bin/env python3
"""Генерирует иконки PWA из фирменного знака.

Источник — src/assets/logo-mj.webp (квадратный знак «МоДелизМ»). Результат
кладётся в public/pwa/ и подхватывается манифестом из vite.config.ts.

Запуск (нужен Pillow):  python3 scripts/generate-pwa-icons.py

Иконки лежат в репозитории, поэтому обычная сборка скрипт не запускает —
перегенерируйте руками, если поменялся знак.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "assets" / "logo-mj.webp"
OUT = ROOT / "public" / "pwa"

# Фон знака (он непрозрачный) — им же добиваем поля у maskable-иконки,
# чтобы обрезка под любую форму выглядела как задумано.
BACKGROUND = (245, 245, 245, 255)
# Безопасная зона maskable по спецификации — круг в 80% ширины; кладём
# содержимое в 72%, чтобы знак не подрезало ни кругом, ни «squircle».
MASKABLE_CONTENT_RATIO = 0.72


def fit_square(image: Image.Image, size: int, content_ratio: float = 1.0) -> Image.Image:
    content = round(size * content_ratio)
    scaled = image.copy()
    scaled.thumbnail((content, content), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    canvas.paste(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
        scaled,
    )
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-192.png", 192, MASKABLE_CONTENT_RATIO),
        ("icon-maskable-512.png", 512, MASKABLE_CONTENT_RATIO),
        ("apple-touch-icon.png", 180, 1.0),
    ]

    for name, size, ratio in targets:
        fit_square(source, size, ratio).save(OUT / name, "PNG", optimize=True)
        print(f"{name}: {size}x{size}")


if __name__ == "__main__":
    main()
