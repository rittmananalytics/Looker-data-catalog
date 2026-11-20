"""Check a client's Data Catalog config before a build: brand colours, logo and font files,
privacy defaults and unfilled placeholders.

    <builder venv python> -I check_brand.py catalog_builder/catalog.yml

Exit 1 on any error. Warnings do not fail the check but each one needs a decision.

Contrast rules (WCAG 2.1 ratios):
    ink on canvas and on card            >= 4.5   body text
    muted on card                        >= 4.5   secondary text
    white on primary                     >= 4.5   button labels
    primary on card                      >= 3.0   links and active tabs (error below 3.0, warning below 4.5)
    primary_ink on primary_soft          >= 4.5   chip and selected-row text
    subtle on card                       >= 3.0   hints (warning only)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
FONT_BUDGET = 160_000      # bytes of font files before base64; the whole app must stay under 900 KB


def lum(hex_: str) -> float:
    def ch(c: int) -> float:
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def ratio(a: str, b: str) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    path = Path(sys.argv[1]).resolve()
    base = path.parent
    raw = path.read_text(encoding="utf-8")
    cfg = yaml.safe_load(raw)
    errors, warns = [], []

    left = sorted(set(re.findall(r"\{\{[A-Z_]+\}\}", raw)))
    if left:
        errors.append("placeholders not filled in: " + ", ".join(left))

    b = cfg.get("brand") or {}
    keys = ["primary", "primary_soft", "primary_ink", "ink", "muted", "subtle", "border", "canvas", "card"]
    for k in keys:
        if not HEX.match(str(b.get(k, ""))):
            errors.append(f"brand.{k} must be a 6-digit hex colour, got {b.get(k)!r}")
    if not errors or all(HEX.match(str(b.get(k, ""))) for k in keys):
        checks = [
            ("ink", "canvas", 4.5, 4.5), ("ink", "card", 4.5, 4.5), ("muted", "card", 4.5, 4.5),
            ("#FFFFFF", "primary", 4.5, 4.5), ("primary", "card", 3.0, 4.5), ("primary_ink", "primary_soft", 4.5, 4.5),
            ("subtle", "card", 0, 3.0),
        ]
        for fg, bg, hard, soft in checks:
            f = fg if fg.startswith("#") else b[fg]
            g = bg if bg.startswith("#") else b[bg]
            r = ratio(f, g)
            label = f"{fg} on {bg}: {r:.2f}"
            if r < hard:
                errors.append(f"contrast {label}, needs {hard}")
            elif r < soft:
                warns.append(f"contrast {label}, below {soft}")
        if ratio(b["canvas"], b["card"]) < 1.02 and b["canvas"].lower() != b["card"].lower():
            warns.append("canvas and card are almost the same colour; cards will not stand out")

    c = cfg.get("client") or {}
    for k in ("logo_svg", "mark_svg"):
        p = c.get(k)
        if not p:
            errors.append(f"client.{k} is not set")
        elif not (base / p).is_file():
            errors.append(f"client.{k} not found: {(base / p)}")
        elif not str(p).lower().endswith(".svg"):
            errors.append(f"client.{k} must be an SVG")
        else:
            svg = (base / p).read_text(encoding="utf-8", errors="ignore")
            if "<script" in svg.lower() or re.search(r"\son\w+\s*=", svg, re.I):
                errors.append(f"client.{k} contains script or event handlers; clean the SVG")
            if re.search(r"(href|src)\s*=\s*[\"']https?:", svg, re.I):
                errors.append(f"client.{k} links to an external file; the tile cannot load it")
            if len(svg) > 60_000:
                warns.append(f"client.{k} is {len(svg):,} bytes; simplify it to save app space")

    fonts = b.get("fonts") or {}
    total = 0
    for f in fonts.get("files") or []:
        p = base / f.get("file", "")
        if not p.is_file():
            errors.append(f"font file not found: {p}")
            continue
        total += p.stat().st_size
        if p.suffix.lower() not in (".woff2", ".ttf", ".otf", ".woff"):
            errors.append(f"font file type not supported: {p.name}")
        elif p.suffix.lower() != ".woff2":
            warns.append(f"{p.name} is not woff2; convert it to save space")
    if total > FONT_BUDGET:
        warns.append(f"font files total {total:,} bytes; the app budget allows about {FONT_BUDGET:,}. Subset or drop a weight")
    for role in ("display", "heading"):
        fam = fonts.get(role)
        if fam and not any(f.get("family") == fam for f in fonts.get("files") or []):
            warns.append(f"fonts.{role} is {fam!r} but no file for it is embedded; viewers without it installed see the fallback font")

    if (cfg.get("usage") or {}).get("show_people"):
        warns.append("usage.show_people is true: Looker user names will show. Only with the client's written agreement")
    s = cfg.get("search") or {}
    if not s.get("examples") or s.get("examples") == ["revenue", "customer", "orders"]:
        warns.append("search.examples still has the neutral defaults; write prompts in the client's words")
    if not cfg.get("domain_keywords") and not ((cfg.get("dbt") or {}).get("domain_folders")):
        warns.append("no domain_folders or domain_keywords; most assets will land in Other")

    for e in errors:
        print("error:", e)
    for w in warns:
        print("warning:", w)
    print(f"{len(errors)} error(s), {len(warns)} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
