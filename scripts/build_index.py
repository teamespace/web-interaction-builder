#!/usr/bin/env python3
"""Bangun ulang references/patterns/index.md dari heading di file-file keluarga pola.

Jalankan setiap kali menambah atau mengganti nama pola:
    python3 scripts/build_index.py

Format heading yang dibaca (wajib diikuti di file pola):
    ### `pattern-id` — Judul singkat
    **Sumber:** R01, R02 · **Mode:** A+B · **Tingkat berat:** CSS
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = ROOT / "references" / "patterns"

FAMILIES = [
    ("scroll.md", "Scroll", "scrub, pin, sticky, chapter, velocity"),
    ("pointer-gesture.md", "Pointer, gesture & physics", "cursor, drag, lempar, physics, video scrub"),
    ("webgl-3d.md", "WebGL & 3D", "Three.js, shader, point cloud, konfigurator"),
    ("typography.md", "Typography", "variable font, split reveal, kinetic type"),
    ("transitions.md", "Transitions", "page transition, morph, wipe, theme switch"),
    ("generative.md", "Generative", "dither, pixel, garis gambar tangan"),
]

HEAD = re.compile(r"^### `([^`]+)`\s*[—-]\s*(.+?)\s*$")
FIELD = lambda name: re.compile(r"\*\*" + name + r":\*\*\s*([^·\\\n]+)")


def parse(path: Path):
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    for i, line in enumerate(lines):
        m = HEAD.match(line)
        if not m:
            continue
        meta = " ".join(lines[i + 1 : i + 3])
        mode = FIELD("Mode").search(meta)
        heavy = FIELD("Tingkat berat").search(meta)
        src = FIELD("Sumber").search(meta)
        refs = sorted(set(re.findall(r"R\d{2}", src.group(1)))) if src else []
        out.append({
            "id": m.group(1),
            "title": m.group(2),
            "mode": mode.group(1).strip() if mode else "?",
            "heavy": heavy.group(1).strip() if heavy else "?",
            "refs": ", ".join(refs),
        })
    return out


def main():
    parts = [
        "# Index pola",
        "",
        "Dibuat otomatis oleh `scripts/build_index.py`. Jangan edit manual; edit file keluarganya lalu jalankan ulang script.",
        "",
        "Cara pakai: cari pola yang paling dekat dengan efek referensi, lalu buka hanya file keluarganya. "
        "Mode A = 1 section, B = full website. Kolom Berat membantu memilih teknik paling ringan.",
        "",
    ]
    total = 0
    for fname, label, hint in FAMILIES:
        path = PATTERNS / fname
        if not path.exists():
            parts += [f"## {label} (`{fname}`)", "", "_Belum ada._", ""]
            continue
        rows = parse(path)
        total += len(rows)
        parts += [f"## {label} (`{fname}`)", "", f"{hint}. {len(rows)} pola.", "",
                  "| Pola | Judul | Mode | Berat | Sumber |", "| --- | --- | --- | --- | --- |"]
        parts += [f"| `{r['id']}` | {r['title']} | {r['mode']} | {r['heavy']} | {r['refs']} |" for r in rows]
        parts.append("")
    parts.insert(2, f"Total {total} pola dari 17 referensi (R01–R17).")
    parts.insert(3, "")
    (PATTERNS / "index.md").write_text("\n".join(parts), encoding="utf-8")
    print(f"index.md: {total} pola")


if __name__ == "__main__":
    main()
