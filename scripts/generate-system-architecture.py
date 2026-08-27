from __future__ import annotations

from dataclasses import dataclass
from html import escape
from math import atan2, cos, sin
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "diagrams"
PNG_PATH = OUTPUT_DIR / "nightingale-system-architecture.png"
SVG_PATH = OUTPUT_DIR / "nightingale-system-architecture.svg"

WIDTH = 1960
HEIGHT = 1120
SCALE = 2

COLORS = {
    "page": "#F7FAFA",
    "ink": "#102A3A",
    "muted": "#5B6B75",
    "line": "#C9D5D2",
    "white": "#FFFFFF",
    "navy": "#123149",
    "teal": "#0F7C79",
    "mint": "#E9F7F3",
    "purple": "#7259B6",
    "lavender": "#F3EFFB",
    "amber": "#C77A12",
    "sand": "#FFF7E8",
    "slate": "#EDF3F4",
}

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


@dataclass(frozen=True)
class Node:
    x: int
    y: int
    w: int
    h: int
    title: str
    lines: tuple[str, ...]
    fill: str
    stroke: str


NODES = {
    "ui": Node(70, 205, 300, 124, "Care Note UI", ("Glance <= 5 items", "role-aware response"), COLORS["mint"], "#7AD9C2"),
    "api": Node(430, 205, 300, 124, "Route Handlers", ("session + validation", "thin HTTP boundary"), COLORS["white"], COLORS["line"]),
    "auth": Node(790, 205, 300, 124, "Authorization DAL", ("clinic / patient scope", "object re-check"), COLORS["white"], COLORS["navy"]),
    "read": Node(1150, 205, 300, 124, "Read + provenance", ("timeline / tasks / Glance", "exact version + span"), COLORS["mint"], "#7AD9C2"),
    "db": Node(1530, 205, 340, 124, "Encrypted SQLite WAL", ("ciphertext + content hashes", "typed relational state"), COLORS["sand"], "#E7B85D"),
    "transcript": Node(70, 525, 300, 124, "Synthetic transcript", ("doctor / nurse / AI-patient", "demo input only"), COLORS["lavender"], "#B9A8E6"),
    "redact": Node(430, 525, 300, 124, "PHI redaction", ("known names + SG IDs", "telephone patterns"), COLORS["lavender"], "#B9A8E6"),
    "mock": Node(790, 525, 300, 124, "Deterministic MockScribe", ("redacted text only", "typed summary + feature"), COLORS["lavender"], COLORS["purple"]),
    "mut": Node(1150, 525, 300, 124, "Atomic mutations", ("append EntryVersion", "baseVersion conflict gate"), COLORS["white"], COLORS["navy"]),
    "audit": Node(1530, 525, 340, 124, "Audit + outbox", ("metadata-only audit", "patient-scoped SSE"), COLORS["mint"], "#7AD9C2"),
    "archive": Node(1530, 825, 340, 124, "Cold archive blob", ("gzip + AES-256-GCM", "SHA-256 verified restore"), COLORS["sand"], "#E7B85D"),
}


EDGES = [
    ([(370, 246), (430, 246)], COLORS["teal"], False),
    ([(430, 288), (370, 288)], COLORS["teal"], False),
    ([(730, 267), (790, 267)], COLORS["navy"], False),
    ([(1090, 267), (1150, 267)], COLORS["teal"], False),
    ([(1450, 246), (1530, 246)], COLORS["teal"], False),
    ([(1530, 288), (1450, 288)], COLORS["teal"], False),
    ([(940, 329), (940, 455), (1300, 455), (1300, 525)], COLORS["navy"], False),
    ([(370, 587), (430, 587)], COLORS["purple"], False),
    ([(730, 587), (790, 587)], COLORS["purple"], False),
    ([(1090, 587), (1150, 587)], COLORS["purple"], False),
    ([(1450, 587), (1530, 587)], COLORS["teal"], False),
    ([(1450, 566), (1490, 566), (1490, 267), (1530, 267)], COLORS["amber"], False),
    ([(1700, 649), (1700, 720), (30, 720), (30, 267), (70, 267)], COLORS["teal"], False),
    ([(1700, 329), (1900, 329), (1900, 887), (1870, 887)], COLORS["amber"], False),
    ([(1870, 921), (1880, 921), (1880, 350), (1745, 350), (1745, 329)], COLORS["amber"], True),
]

EDGE_LABELS = [
    (366, 218, "request"),
    (350, 292, "DTO"),
    (1445, 218, "query"),
    (1430, 292, "rows"),
    (1085, 493, "redacted only"),
    (1450, 542, "same tx"),
    (1468, 378, "ciphertext"),
    (72, 690, "scoped SSE refresh"),
    (1765, 770, "archive / restore"),
]


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size * SCALE)


def draw_arrow(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color: str, dashed: bool = False):
    scaled = [(x * SCALE, y * SCALE) for x, y in points]
    width = 5 * SCALE
    if dashed:
        for start, end in zip(scaled, scaled[1:]):
            dx, dy = end[0] - start[0], end[1] - start[1]
            length = max(abs(dx), abs(dy))
            if length == 0:
                continue
            for offset in range(0, int(length), 22 * SCALE):
                t1 = offset / length
                t2 = min((offset + 12 * SCALE) / length, 1)
                a = (start[0] + dx * t1, start[1] + dy * t1)
                b = (start[0] + dx * t2, start[1] + dy * t2)
                draw.line([a, b], fill=color, width=width)
    else:
        draw.line(scaled, fill=color, width=width, joint="curve")
    (x1, y1), (x2, y2) = scaled[-2], scaled[-1]
    angle = atan2(y2 - y1, x2 - x1)
    size = 16 * SCALE
    left = (x2 - size * cos(angle - 0.52), y2 - size * sin(angle - 0.52))
    right = (x2 - size * cos(angle + 0.52), y2 - size * sin(angle + 0.52))
    draw.polygon([(x2, y2), left, right], fill=color)


def draw_png():
    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), COLORS["page"])
    draw = ImageDraw.Draw(image)

    draw.text((72 * SCALE, 48 * SCALE), "System architecture and trust boundaries", font=font(52, True), fill=COLORS["ink"])
    draw.text((74 * SCALE, 112 * SCALE), "Every path is explicit: who may read, what may change, and how evidence returns to the UI.", font=font(23), fill=COLORS["muted"])

    for y, h, label in [(170, 195, "AUTHORIZED READ PATH"), (485, 205, "SCRIBE + WRITE PATH"), (785, 200, "COLD STORAGE")]:
        draw.rounded_rectangle((45 * SCALE, y * SCALE, 1925 * SCALE, (y + h) * SCALE), radius=24 * SCALE, fill=COLORS["white"], outline=COLORS["line"], width=2 * SCALE)
        draw.text((63 * SCALE, (y + 16) * SCALE), label, font=font(17, True), fill=COLORS["muted"])

    for points, color, dashed in EDGES:
        draw_arrow(draw, points, color, dashed)

    for node in NODES.values():
        box = (node.x * SCALE, node.y * SCALE, (node.x + node.w) * SCALE, (node.y + node.h) * SCALE)
        draw.rounded_rectangle(box, radius=20 * SCALE, fill=node.fill, outline=node.stroke, width=3 * SCALE)
        draw.text(((node.x + 24) * SCALE, (node.y + 22) * SCALE), node.title, font=font(23, True), fill=COLORS["ink"])
        for index, line in enumerate(node.lines):
            draw.text(((node.x + 24) * SCALE, (node.y + 65 + index * 25) * SCALE), line, font=font(17), fill=COLORS["muted"])

    for x, y, label in EDGE_LABELS:
        bbox = draw.textbbox((0, 0), label, font=font(15, True))
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.rounded_rectangle((x * SCALE, y * SCALE, x * SCALE + tw + 18 * SCALE, y * SCALE + th + 12 * SCALE), radius=9 * SCALE, fill=COLORS["page"])
        draw.text(((x + 9) * SCALE, (y + 4) * SCALE), label, font=font(15, True), fill=COLORS["muted"])

    draw.text((76 * SCALE, 1020 * SCALE), "Teal = authorized read / refresh   |   Purple = scribe boundary   |   Amber = encrypted persistence", font=font(17), fill=COLORS["muted"])
    image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).save(PNG_PATH, optimize=True)


def svg_text(x: int, y: int, value: str, size: int, weight: int = 400, fill: str = COLORS["ink"]):
    return f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}">{escape(value)}</text>'


def draw_svg():
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        "<defs>",
        '<marker id="arrow-teal" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#0F7C79"/></marker>',
        '<marker id="arrow-navy" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#123149"/></marker>',
        '<marker id="arrow-purple" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#7259B6"/></marker>',
        '<marker id="arrow-amber" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#C77A12"/></marker>',
        "</defs>",
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="{COLORS["page"]}"/>',
        svg_text(72, 88, "System architecture and trust boundaries", 52, 700),
        svg_text(74, 126, "Every path is explicit: who may read, what may change, and how evidence returns to the UI.", 23, 400, COLORS["muted"]),
    ]

    for y, h, label in [(170, 195, "AUTHORIZED READ PATH"), (485, 205, "SCRIBE + WRITE PATH"), (785, 200, "COLD STORAGE")]:
        parts.append(f'<rect x="45" y="{y}" width="1880" height="{h}" rx="24" fill="{COLORS["white"]}" stroke="{COLORS["line"]}" stroke-width="2"/>')
        parts.append(svg_text(63, y + 31, label, 17, 700, COLORS["muted"]))

    marker_for = {COLORS["teal"]: "teal", COLORS["navy"]: "navy", COLORS["purple"]: "purple", COLORS["amber"]: "amber"}
    for points, color, dashed in EDGES:
        command = "M " + " L ".join(f"{x} {y}" for x, y in points)
        dash = ' stroke-dasharray="12 10"' if dashed else ""
        parts.append(f'<path d="{command}" fill="none" stroke="{color}" stroke-width="5" stroke-linejoin="round" marker-end="url(#arrow-{marker_for[color]})"{dash}/>')

    for node in NODES.values():
        parts.append(f'<rect x="{node.x}" y="{node.y}" width="{node.w}" height="{node.h}" rx="20" fill="{node.fill}" stroke="{node.stroke}" stroke-width="3"/>')
        parts.append(svg_text(node.x + 24, node.y + 43, node.title, 23, 700))
        for index, line in enumerate(node.lines):
            parts.append(svg_text(node.x + 24, node.y + 82 + index * 25, line, 17, 400, COLORS["muted"]))

    for x, y, label in EDGE_LABELS:
        width = max(82, len(label) * 9 + 18)
        parts.append(f'<rect x="{x}" y="{y}" width="{width}" height="28" rx="9" fill="{COLORS["page"]}"/>')
        parts.append(svg_text(x + 9, y + 20, label, 15, 700, COLORS["muted"]))

    parts.append(svg_text(76, 1035, "Teal = authorized read / refresh   |   Purple = scribe boundary   |   Amber = encrypted persistence", 17, 400, COLORS["muted"]))
    parts.append("</svg>")
    SVG_PATH.write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    draw_svg()
    draw_png()
    print(PNG_PATH)
    print(SVG_PATH)
