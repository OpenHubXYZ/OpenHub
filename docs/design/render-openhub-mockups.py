from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "design" / "mockups"
W, H = 1487, 1058
SIDEBAR_W = 225
TOP_H = 77
STATUS_H = 58
RIGHT_W = 376
CONTENT_H = H - TOP_H - STATUS_H
MAIN_W = W - SIDEBAR_W - RIGHT_W
MAIN_X = SIDEBAR_W
RIGHT_X = SIDEBAR_W + MAIN_W

COLORS = {
    "page": "#fbfcfe",
    "surface": "#ffffff",
    "line": "#d9dee7",
    "line2": "#edf0f4",
    "text": "#111827",
    "muted": "#667085",
    "soft": "#8a95a5",
    "blue": "#1677f2",
    "blue50": "#eef5ff",
    "green": "#11a35a",
    "green50": "#eaf8f0",
    "amber": "#f5b800",
    "amber50": "#fff5d6",
    "red": "#eb5757",
    "red50": "#fff0ee",
    "cyan": "#24a6b8",
    "black": "#111827",
}

FONT_PATHS = [
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/SFCompact.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/LucidaGrande.ttc",
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size=size, index=1 if bold else 0)
        except Exception:
            continue
    return ImageFont.load_default(size=size)


F = {
    "xs": font(11),
    "sm": font(12),
    "base": font(13),
    "body": font(14),
    "nav": font(15),
    "h2": font(16, True),
    "h1": font(22, True),
    "metric": font(25, True),
    "brand": font(14, True),
}


def text_width(draw: ImageDraw.ImageDraw, value: str, fnt: ImageFont.ImageFont) -> int:
    return int(draw.textbbox((0, 0), value, font=fnt)[2])


def fit(draw: ImageDraw.ImageDraw, value: str, fnt: ImageFont.ImageFont, max_w: int) -> str:
    if text_width(draw, value, fnt) <= max_w:
        return value
    out = value
    while len(out) > 1 and text_width(draw, out + "...", fnt) > max_w:
        out = out[:-1]
    return out + "..."


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    fnt: ImageFont.ImageFont,
    fill: str = COLORS["text"],
    max_w: int | None = None,
) -> None:
    if max_w is not None:
        value = fit(draw, value, fnt, max_w)
    draw.text(xy, value, font=fnt, fill=fill)


def rounded(draw: ImageDraw.ImageDraw, box, fill, outline=None, radius=7, width=1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def pill(draw, x, y, label, tone="neutral", w=None):
    palette = {
        "low": ("#137548", COLORS["green50"]),
        "medium": ("#8a5b00", COLORS["amber50"]),
        "high": ("#c24135", COLORS["red50"]),
        "blue": (COLORS["blue"], COLORS["blue50"]),
        "neutral": ("#4b5563", "#eef0f4"),
    }
    fg, bg = palette[tone]
    tw = text_width(draw, label, F["xs"])
    width = w or tw + 18
    rounded(draw, (x, y, x + width, y + 24), bg, radius=12)
    draw_text(draw, (x + (width - tw) // 2, y + 5), label, F["xs"], fg)
    return width


def tag(draw, x, y, label, tone="neutral"):
    fg = COLORS["blue"] if tone == "blue" else "#384152"
    bg = COLORS["blue50"] if tone == "blue" else "#fbfcfe"
    tw = text_width(draw, label, F["xs"])
    rounded(draw, (x, y, x + tw + 14, y + 22), bg, COLORS["line"], radius=5)
    draw_text(draw, (x + 7, y + 4), label, F["xs"], fg)
    return tw + 14


def small_icon(draw, x, y, kind, color="#4b5563"):
    if kind == "dashboard":
        draw.rectangle((x + 2, y + 8, x + 7, y + 18), outline=color, width=2)
        draw.rectangle((x + 10, y + 3, x + 15, y + 18), outline=color, width=2)
        draw.rectangle((x + 18, y + 11, x + 22, y + 18), outline=color, width=2)
    elif kind == "library":
        draw.rectangle((x + 5, y + 3, x + 20, y + 20), outline=color, width=2)
        for yy in (7, 12, 17):
            draw.line((x + 2, y + yy, x + 5, y + yy), fill=color, width=2)
    elif kind == "discover":
        draw.ellipse((x + 3, y + 3, x + 17, y + 17), outline=color, width=2)
        draw.line((x + 16, y + 16, x + 22, y + 22), fill=color, width=2)
    elif kind == "installs":
        draw.rectangle((x + 5, y + 4, x + 20, y + 20), outline=color, width=2)
        draw.line((x + 9, y + 12, x + 16, y + 12), fill=color, width=2)
        draw.line((x + 12, y + 9, x + 12, y + 16), fill=color, width=2)
    elif kind == "usage":
        for i, h in enumerate((8, 15, 11)):
            xx = x + 5 + i * 7
            draw.line((xx, y + 20, xx, y + 20 - h), fill=color, width=2)
    elif kind == "reviews":
        pts = [(x + 12, y + 3), (x + 15, y + 10), (x + 22, y + 10), (x + 17, y + 15), (x + 19, y + 22), (x + 12, y + 18), (x + 5, y + 22), (x + 7, y + 15), (x + 2, y + 10), (x + 9, y + 10)]
        draw.line(pts + [pts[0]], fill=color, width=2)
    elif kind == "security":
        pts = [(x + 12, y + 3), (x + 5, y + 6), (x + 5, y + 13), (x + 12, y + 22), (x + 19, y + 13), (x + 19, y + 6)]
        draw.line(pts + [pts[0]], fill=color, width=2)
        draw.line((x + 8, y + 12, x + 11, y + 15, x + 16, y + 9), fill=color, width=2)
    elif kind == "settings":
        draw.ellipse((x + 6, y + 6, x + 18, y + 18), outline=color, width=2)
        draw.ellipse((x + 10, y + 10, x + 14, y + 14), fill=color)
    elif kind == "database":
        draw.ellipse((x + 4, y + 4, x + 21, y + 10), outline=color, width=1)
        draw.rectangle((x + 4, y + 7, x + 21, y + 18), outline=color, width=1)
        draw.arc((x + 4, y + 13, x + 21, y + 19), 0, 180, fill=color, width=1)
    else:
        draw.ellipse((x + 6, y + 6, x + 18, y + 18), outline=color, width=2)


NAV = [
    ("dashboard", "Dashboard"),
    ("library", "Library"),
    ("discover", "Discover"),
    ("installs", "Installs"),
    ("usage", "Usage"),
    ("reviews", "Reviews"),
    ("security", "Security"),
    ("settings", "Settings"),
]


def shell(active: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), COLORS["page"])
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, SIDEBAR_W, H), fill="#ffffff")
    draw.rectangle((SIDEBAR_W - 1, 0, SIDEBAR_W, H), fill=COLORS["line"])
    # Logo
    draw.polygon([(33, 28), (49, 37), (49, 55), (33, 64), (18, 55), (18, 37)], outline="#2da8f3", width=4)
    draw.line((33, 28, 33, 46, 49, 37), fill="#2da8f3", width=3)
    draw.line((33, 46, 18, 37), fill="#2da8f3", width=3)
    draw_text(draw, (59, 28), "TheOpenHub", F["brand"], max_w=95)
    pill(draw, 149, 27, "v0.9.0", "blue", 53)
    draw_text(draw, (59, 47), "Skills Studio", F["base"], COLORS["text"])
    # Nav
    y = 96
    for key, label in NAV:
        active_item = key == active
        if active_item:
            rounded(draw, (12, y, 212, y + 40), COLORS["blue50"], radius=8)
            draw.rectangle((12, y + 10, 15, y + 31), fill=COLORS["blue"])
        color = COLORS["blue"] if active_item else "#202938"
        small_icon(draw, 25, y + 8, key, color)
        draw_text(draw, (58, y + 10), label, F["nav"], color)
        y += 47
    # Sidebar foot
    draw_text(draw, (31, 898), "<<  Collapse", F["base"], "#2f3948")
    small_icon(draw, 22, 936, "settings", "#4b5563")
    draw_text(draw, (56, 939), "Help", F["base"], "#2f3948")
    # Top bar
    draw.rectangle((SIDEBAR_W, 0, W, TOP_H), fill="#ffffff")
    draw.rectangle((SIDEBAR_W, TOP_H - 1, W, TOP_H), fill=COLORS["line"])
    rounded(draw, (247, 19, 934, 60), "#ffffff", "#cfd6e3", 6)
    small_icon(draw, 260, 30, "discover", "#5f6b7a")
    draw_text(draw, (291, 33), "Search local skills, sources, reviews...", F["body"], "#6a7280")
    draw_text(draw, (888, 34), "Ctrl K", F["base"], "#6a7280")
    draw.rectangle((949, 21, 950, 57), fill=COLORS["line"])
    rounded(draw, (963, 18, 1099, 61), "#ffffff", "#cfd6e3", 6)
    draw.ellipse((977, 33, 990, 46), fill=COLORS["green"])
    draw_text(draw, (1000, 27), "Offline", F["base"], COLORS["text"])
    draw_text(draw, (1000, 44), "All good", F["xs"], "#6a7280")
    draw_text(draw, (1072, 33), "v", F["body"], "#4b5563")
    rounded(draw, (1115, 21, 1239, 61), "#ffffff", "#cfd6e3", 6)
    small_icon(draw, 1128, 31, "installs", COLORS["text"])
    draw_text(draw, (1155, 33), "Import", F["body"])
    draw_text(draw, (1213, 33), "v", F["body"], "#4b5563")
    rounded(draw, (1254, 21, 1397, 61), COLORS["blue"], radius=7)
    draw_text(draw, (1281, 33), "Download", F["body"], "#ffffff")
    draw_text(draw, (1373, 33), "v", F["body"], "#ffffff")
    rounded(draw, (1417, 21, 1461, 61), "#ffffff", "#cfd6e3", 6)
    draw_text(draw, (1430, 29), "...", F["h2"], COLORS["text"])
    # Bottom bar
    draw.rectangle((SIDEBAR_W, H - STATUS_H, W, H), fill="#ffffff")
    draw.rectangle((SIDEBAR_W, H - STATUS_H, W, H - STATUS_H + 1), fill=COLORS["line"])
    small_icon(draw, 19, 1010, "database", "#344054")
    draw_text(draw, (38, 1014), r"DB: C:\Users\devuser\.theopenhub\skills-studio\library.db", F["sm"], "#344054", 360)
    draw_text(draw, (432, 1014), "Detected agents:", F["sm"], "#344054")
    x = 539
    for label, color in [("Codex  1.2.0", "#111827"), ("Claude  1.5.1", "#e66f4e"), ("Gemini  1.1.0", "#4b83f1"), ("OpenCode  0.9.0", "#111827")]:
        draw.ellipse((x, 1010, x + 18, 1028), fill=color if "OpenCode" not in label else "#ffffff", outline=color)
        draw_text(draw, (x + 25, 1014), label, F["sm"], "#344054")
        x += 145
    draw_text(draw, (1120, 1014), "Last scan: May 8, 2025 8:13 AM", F["sm"], "#344054")
    draw_text(draw, (1332, 1014), "Offline by default", F["sm"], "#344054")
    # Pane divider
    draw.rectangle((RIGHT_X - 1, TOP_H, RIGHT_X, H - STATUS_H), fill=COLORS["line"])
    draw.rectangle((RIGHT_X, TOP_H, W, H - STATUS_H), fill="#ffffff")
    return img, draw


def tabs(draw, labels, active=0, counts=None):
    y = TOP_H
    draw.rectangle((MAIN_X, y, RIGHT_X, y + 49), fill="#ffffff")
    draw.rectangle((MAIN_X, y + 48, RIGHT_X, y + 49), fill=COLORS["line"])
    x = MAIN_X + 16
    counts = counts or {}
    for i, label in enumerate(labels):
        color = COLORS["blue"] if i == active else "#1f2937"
        draw_text(draw, (x, y + 17), label, F["body"], color)
        tw = text_width(draw, label, F["body"])
        if label in counts:
            pill(draw, x + tw + 8, y + 12, str(counts[label]), "neutral", 24)
            tw += 34
        if i == active:
            draw.rounded_rectangle((x, y + 47, x + tw, y + 50), radius=3, fill=COLORS["blue"])
        x += tw + 34


def filters(draw, entries, y=126, action=None):
    draw.rectangle((MAIN_X, y, RIGHT_X, y + 60), fill="#ffffff")
    draw.rectangle((MAIN_X, y + 59, RIGHT_X, y + 60), fill=COLORS["line"])
    x = MAIN_X + 16
    for label, value in entries:
        rounded(draw, (x, y + 15, x + 122, y + 49), "#ffffff", "#d4dae4", 6)
        draw_text(draw, (x + 12, y + 24), label, F["base"], "#1f2937", 48)
        draw_text(draw, (x + 70, y + 24), value, F["base"], "#384152", 35)
        draw_text(draw, (x + 106, y + 24), "v", F["base"], "#4b5563")
        x += 132
    if action:
        rounded(draw, (RIGHT_X - 128, y + 15, RIGHT_X - 16, y + 49), COLORS["blue50"], "#bdd7ff", 6)
        draw_text(draw, (RIGHT_X - 103, y + 24), action, F["base"], COLORS["blue"])


def page_title(draw, title, subtitle, y=210, action=None):
    draw_text(draw, (MAIN_X + 16, y), title, F["h1"])
    draw_text(draw, (MAIN_X + 16, y + 28), subtitle, F["base"], COLORS["muted"], 560)
    if action:
        pill(draw, RIGHT_X - 130, y + 4, action, "blue", 112)


def metric(draw, x, y, label, value, change, w=207):
    rounded(draw, (x, y, x + w, y + 98), "#ffffff", COLORS["line"], 8)
    draw_text(draw, (x + 13, y + 13), label, F["sm"], COLORS["muted"], w - 26)
    draw_text(draw, (x + 13, y + 38), value, F["metric"], COLORS["text"])
    draw_text(draw, (x + 13, y + 72), change, F["sm"], "#137548", w - 26)


def panel(draw, box, title, badge=None):
    rounded(draw, box, "#ffffff", COLORS["line"], 8)
    x1, y1, x2, _ = box
    draw_text(draw, (x1 + 14, y1 + 13), title, F["h2"])
    if badge:
        tag(draw, x2 - 14 - text_width(draw, badge, F["xs"]) - 14, y1 + 12, badge)


def list_rows(draw, x, y, w, rows, row_h=40):
    yy = y
    for label, value in rows:
        draw.line((x, yy, x + w, yy), fill=COLORS["line2"])
        draw_text(draw, (x, yy + 12), label, F["sm"], "#303947", w - 90)
        draw_text(draw, (x + w - 82, yy + 12), value, F["sm"], COLORS["text"], 80)
        yy += row_h


def bars(draw, x, y, values, w=345, h=160):
    draw.line((x, y + h, x + w, y + h), fill=COLORS["line2"])
    gap = 6
    bw = max(5, (w - gap * (len(values) - 1)) // len(values))
    for i, v in enumerate(values):
        color = "#6aa8ff"
        if i % 5 == 0:
            color = "#9dd6c0"
        elif i % 7 == 0:
            color = "#ffd56a"
        xx = x + i * (bw + gap)
        draw.rounded_rectangle((xx, y + h - v, xx + bw, y + h), radius=3, fill=color)


def table(draw, x, y, w, columns, rows, selected=0, row_h=55):
    header_h = 44
    rounded(draw, (x, y, x + w, y + header_h + row_h * len(rows)), "#ffffff", COLORS["line"], 0)
    widths = [int(w * c[1]) for c in columns]
    widths[-1] = w - sum(widths[:-1])
    xx = x
    for (label, _), cw in zip(columns, widths):
        draw_text(draw, (xx + 10, y + 16), label, F["sm"], "#303947", cw - 16)
        xx += cw
    draw.line((x, y + header_h, x + w, y + header_h), fill=COLORS["line"])
    for ri, row in enumerate(rows):
        yy = y + header_h + ri * row_h
        if ri == selected:
            draw.rectangle((x + 1, yy, x + w - 1, yy + row_h), fill="#f1f7ff")
            draw.rectangle((x + 1, yy, x + w - 1, yy + 1), fill="#bdd7ff")
            draw.rectangle((x + 1, yy + row_h - 1, x + w - 1, yy + row_h), fill="#bdd7ff")
        else:
            draw.line((x, yy, x + w, yy), fill=COLORS["line"])
        xx = x
        for ci, (value, cw) in enumerate(zip(row, widths)):
            if isinstance(value, tuple) and value[0] == "pill":
                pill(draw, xx + 10, yy + 16, value[1], value[2])
            elif ci == 0 and isinstance(value, tuple):
                avatar, name, sub, tone = value
                av_color = {"dark": "#111827", "blue": "#287ee6", "green": "#19a95f"}.get(tone, COLORS["cyan"])
                rounded(draw, (xx + 10, yy + 13, xx + 36, yy + 39), av_color, radius=7)
                draw_text(draw, (xx + 19, yy + 17), avatar, F["sm"], "#ffffff")
                draw_text(draw, (xx + 45, yy + 12), name, F["sm"], COLORS["text"], cw - 55)
                draw_text(draw, (xx + 45, yy + 29), sub, F["xs"], COLORS["muted"], cw - 55)
            else:
                draw_text(draw, (xx + 10, yy + 18), str(value), F["sm"], "#17202f", cw - 16)
            xx += cw


def rail(draw, title, subtitle, letter, tone="cyan"):
    color = {"red": COLORS["red"], "blue": COLORS["blue"], "green": COLORS["green"]}.get(tone, COLORS["cyan"])
    rounded(draw, (RIGHT_X + 18, TOP_H + 18, RIGHT_X + 60, TOP_H + 60), color, radius=9)
    draw_text(draw, (RIGHT_X + 32, TOP_H + 29), letter, F["h2"], "#ffffff")
    draw_text(draw, (RIGHT_X + 72, TOP_H + 18), title, F["h2"], COLORS["text"], 220)
    draw_text(draw, (RIGHT_X + 72, TOP_H + 39), subtitle, F["sm"], COLORS["muted"], 220)
    draw_text(draw, (W - 42, TOP_H + 24), "...", F["h2"], COLORS["text"])


def rail_card(draw, y, title, rows=None, body=None, h=126):
    x = RIGHT_X + 14
    w = RIGHT_W - 28
    rounded(draw, (x, y, x + w, y + h), "#ffffff", COLORS["line"], 8)
    draw_text(draw, (x + 12, y + 11), title, F["h2"], COLORS["text"], w - 24)
    if body:
        draw_text(draw, (x + 12, y + 38), body, F["sm"], "#586272", w - 24)
    if rows:
        yy = y + 39
        for a, b in rows:
            draw.line((x + 12, yy - 7, x + w - 12, yy - 7), fill=COLORS["line2"])
            draw_text(draw, (x + 12, yy), a, F["sm"], "#4b5563", w - 120)
            draw_text(draw, (x + w - 94, yy), b, F["sm"], COLORS["text"], 90)
            yy += 27


def dashboard():
    img, draw = shell("dashboard")
    tabs(draw, ["Overview", "Agent roots", "Activity", "Readiness"])
    page_title(draw, "Dashboard", "Local library health, agent coverage, and install readiness.", 138, "Run scan")
    x0, y0 = MAIN_X + 16, 194
    for i, data in enumerate([
        ("Indexed skills", "122", "+8 this week"),
        ("Installed projections", "84", "4 agents detected"),
        ("Needs review", "3", "2 high priority"),
        ("Blocked installs", "2", "policy enforced"),
    ]):
        metric(draw, x0 + i * 219, y0, *data)
    panel(draw, (x0, 318, x0 + 525, 546), "Recent activity", "SQLite source")
    list_rows(draw, x0 + 14, 363, 497, [
        ("sui-move-contract imported from skills.sh", "2m"),
        ("openai-docs installed to Codex and Claude", "18m"),
        ("browser-control scan completed with warning", "42m"),
        ("terraform-helper rolled back to version 4", "1h"),
        ("markdown-pro package exported for review", "2h"),
    ])
    panel(draw, (x0 + 539, 318, RIGHT_X - 16, 546), "Agent coverage", "4 detected")
    bars(draw, x0 + 557, 372, [74, 98, 51, 64, 112, 43, 84, 132, 70, 55, 92, 124, 48, 80, 102, 67])
    panel(draw, (x0, 560, RIGHT_X - 16, 889), "Readiness queue", "3 actions")
    table(draw, x0 + 1, 606, MAIN_W - 33, [
        ("Item", .28), ("Owner", .20), ("Signal", .18), ("Last check", .18), ("Status", .16)
    ], [
        (("S", "Security exceptions", "Two active exemptions", ""), "Security", "Policy drift", "May 8, 2025", ("pill", "Review", "medium")),
        (("A", "Agent root scan", "OpenCode root stale", "blue"), "Adapters", "Missing root", "May 7, 2025", ("pill", "Low", "low")),
        (("P", "Plugin permissions", "1 pending grant", "green"), "Plugins", "Disabled by default", "May 7, 2025", ("pill", "Queued", "neutral")),
        (("R", "Release smoke", "Latest package verified", ""), "Release", "Healthy", "May 7, 2025", ("pill", "Ready", "low")),
    ], 0, 55)
    rail(draw, "Workspace health", "Phase 10 maintainer operations", "OH", "blue")
    rail_card(draw, 154, "Today's focus", [("Risk posture", "Medium"), ("Sync state", "Disabled"), ("DB status", "Healthy"), ("Pending imports", "5")], h=156)
    rail_card(draw, 320, "Agent roots", [("Codex", "OK"), ("Claude", "OK"), ("Gemini", "OK"), ("OpenCode", "Manual")], h=156)
    rail_card(draw, 486, "Next recommended action", body="Open Security and resolve high-risk findings before applying new install plans.", h=112)
    return img


def discover():
    img, draw = shell("discover")
    tabs(draw, ["Featured", "Trending", "Verified sources", "New", "Collections"])
    filters(draw, [("Source", "All"), ("Agent", "All"), ("Category", "All"), ("Risk", "Low")], action="More filters")
    page_title(draw, "Discover", "Browse trusted local and remote skill sources before importing.", 205, "48 sources")
    x0, y0 = MAIN_X + 16, 266
    cards = [
        ("O", "openai-docs", "Search and summarize OpenAI API references.", "docs", "low"),
        ("G", "gh-fix-ci", "Diagnose and explain failing GitHub Actions checks.", "github", "low"),
        ("S", "spreadsheet-auditor", "Audit spreadsheet formulas and consistency.", "excel", "medium"),
        ("B", "browser-control", "Control browsers and extract UI evidence safely.", "browser", "low"),
        ("C", "skill-creator", "Create durable Codex skills with valid structure.", "codex", "low"),
        ("R", "release-packager", "Package desktop releases with checksums.", "release", "low"),
    ]
    for i, (a, title, desc, cat, risk) in enumerate(cards):
        cx = x0 + (i % 3) * 288
        cy = y0 + (i // 3) * 190
        rounded(draw, (cx, cy, cx + 276, cy + 176), "#f1f7ff" if i == 0 else "#ffffff", "#bdd7ff" if i == 0 else COLORS["line"], 8)
        rounded(draw, (cx + 14, cy + 14, cx + 40, cy + 40), COLORS["cyan"] if i != 1 else COLORS["black"], radius=7)
        draw_text(draw, (cx + 23, cy + 18), a, F["sm"], "#ffffff")
        draw_text(draw, (cx + 50, cy + 13), title, F["sm"], COLORS["text"], 148)
        draw_text(draw, (cx + 50, cy + 30), f"skills.sh/{title}", F["xs"], COLORS["muted"], 146)
        pill(draw, cx + 213, cy + 14, "Medium" if risk == "medium" else "Low", risk)
        draw_text(draw, (cx + 14, cy + 61), desc, F["sm"], "#586272", 244)
        tag(draw, cx + 14, cy + 116, "verified")
        tag(draw, cx + 82, cy + 116, cat)
        draw_text(draw, (cx + 185, cy + 117), "5.0 / 5", F["sm"], COLORS["amber"])
    panel(draw, (x0, 665, RIGHT_X - 16, 858), "Source updates", "Offline cache")
    table(draw, x0 + 1, 711, MAIN_W - 33, [
        ("Source", .28), ("Trust", .24), ("New skills", .18), ("Last checked", .18), ("Status", .12)
    ], [
        ("skills.sh official", "Verified signature", "12", "May 8, 2025", ("pill", "Ready", "low")),
        ("GitHub curated", "Maintainer allowlist", "8", "May 7, 2025", ("pill", "Review", "medium")),
        ("Local packages", "User supplied", "5", "May 6, 2025", ("pill", "Cached", "neutral")),
    ], 0, 46)
    rail(draw, "skills.sh official", "Verified remote source", "S")
    rail_card(draw, 154, "Source profile", [("Trust level", "Verified"), ("Signature", "Valid"), ("Catalog size", "312"), ("Default install", "Manual")], h=156)
    rail_card(draw, 320, "Recommended collection", [("Included skills", "18"), ("Avg. risk", "Low"), ("Reviews", "412"), ("Last update", "Today")], h=156)
    rail_card(draw, 486, "Import preview", body="No files are written to agent roots until an install plan is reviewed.", h=112)
    return img


def installs():
    img, draw = shell("installs")
    tabs(draw, ["Install plans", "Installed", "Conflicts", "Exports", "Uninstalls"], counts={"Conflicts": 2})
    filters(draw, [("Agent", "Codex"), ("Scope", "User"), ("Conflict", "All"), ("Status", "Needs")], action="New plan")
    page_title(draw, "Installs", "Plan, apply, rollback, and uninstall app-owned skill projections.", 205, "Copy only")
    x0 = MAIN_X + 16
    panel(draw, (x0, 266, RIGHT_X - 16, 548), "Pending install plans", "2 conflicts")
    table(draw, x0 + 1, 312, MAIN_W - 33, [
        ("Skill", .26), ("Agent", .16), ("Target root", .27), ("Writes", .11), ("Conflict", .11), ("Status", .09)
    ], [
        (("S", "sui-move-contract", "v1.4.2", ""), "Codex", r"C:\Users\devuser\.codex\skills", "24", ("pill", "Clean", "low"), "Ready"),
        (("G", "gh-fix-ci", "v1.2.1", "dark"), "Claude", r"C:\Users\devuser\.claude\skills", "18", ("pill", "Exists", "high"), "Blocked"),
        (("B", "browser-control", "v0.9.3", "blue"), "OpenCode", r"C:\Users\devuser\.opencode\skills", "31", ("pill", "Warn", "medium"), "Review"),
    ], 0, 57)
    panel(draw, (x0, 562, x0 + 425, 824), "Install result stream", "Last 24h")
    list_rows(draw, x0 + 14, 610, 397, [
        ("openai-docs copied to Codex", "installed"),
        ("terraform-helper rollback applied", "verified"),
        ("markdown-pro uninstall skipped unknown file", "safe"),
        ("browser-control plan blocked on warning", "review"),
    ])
    panel(draw, (x0 + 439, 562, RIGHT_X - 16, 824), "Export packages", "Hash checked")
    list_rows(draw, x0 + 453, 610, 397, [
        ("security-baseline.zip", "42 files"),
        ("docs-tools.zip", "19 files"),
        ("devops-pack.zip", "57 files"),
        ("browser-safe-pack.zip", "23 files"),
    ])
    rail(draw, "sui-move-contract", "Clean install plan", "S")
    rail_card(draw, 154, "Plan summary", [("Target agent", "Codex"), ("Scope", "User"), ("Planned writes", "24"), ("Conflicts", "None"), ("Security", "Low")], h=178)
    rail_card(draw, 344, "Write preview", [("SKILL.md", "new"), ("prompts/review.md", "new"), ("scripts/scan.ts", "new"), ("README.md", "new")], h=156)
    rail_card(draw, 510, "Safety rule", body="Apply only writes files recorded by the plan. Uninstall later removes app-owned files only.", h=112)
    return img


def usage():
    img, draw = shell("usage")
    tabs(draw, ["30 days", "Agents", "Skills", "Sources", "Exports"])
    page_title(draw, "Usage", "Local usage signals from installs, launches, scans, and exports.", 138, "Download CSV")
    x0, y0 = MAIN_X + 16, 194
    for i, data in enumerate([
        ("Skill launches", "1,482", "+12%"),
        ("Install actions", "86", "+9 this week"),
        ("Security scans", "214", "100% local"),
        ("Exports", "31", "hash verified"),
    ]):
        metric(draw, x0 + i * 219, y0, *data)
    panel(draw, (x0, 318, RIGHT_X - 16, 578), "Daily activity", "No telemetry")
    bars(draw, x0 + 24, 373, [76, 60, 92, 48, 82, 115, 66, 101, 54, 132, 80, 72, 118, 40, 86, 124, 55, 90, 111, 68, 134, 58, 76, 96, 43, 84, 127, 62, 108, 142], MAIN_W - 80, 165)
    panel(draw, (x0, 592, x0 + 425, 854), "Top skills", "By launch")
    list_rows(draw, x0 + 14, 640, 397, [("sui-move-contract", "312"), ("openai-docs", "241"), ("browser-control", "188"), ("gh-fix-ci", "173")])
    panel(draw, (x0 + 439, 592, RIGHT_X - 16, 854), "Agent split", "Detected roots")
    list_rows(draw, x0 + 453, 640, 397, [("Codex", "44%"), ("Claude", "29%"), ("Gemini", "17%"), ("OpenCode", "10%")])
    rail(draw, "Usage insight", "Local events only", "U", "green")
    rail_card(draw, 154, "Privacy boundary", body="Usage is derived from local SQLite records. No cloud analytics, no account, no skill content upload.", h=124)
    rail_card(draw, 290, "Activity heatmap", body="Dense local activity on weekdays, lighter export usage on weekends.", h=112)
    rail_card(draw, 414, "Recent usage", [("Codex ran openai-docs", "9:41"), ("Claude used gh-fix-ci", "8:12"), ("Export package created", "Yesterday"), ("Security rescan", "Yesterday")], h=156)
    return img


def reviews():
    img, draw = shell("reviews")
    tabs(draw, ["Needs review", "My queue", "Approved", "Rejected", "Community"], counts={"Needs review": 3})
    filters(draw, [("Risk", "All"), ("Reviewer", "All"), ("Source", "All"), ("Age", "Newest")], action="Start review")
    page_title(draw, "Reviews", "Review imported skills, package changes, and source trust decisions.", 205, "3 open")
    x0 = MAIN_X + 16
    panel(draw, (x0, 266, RIGHT_X - 16, 562), "Review queue", "Threaded")
    table(draw, x0 + 1, 312, MAIN_W - 33, [
        ("Review item", .28), ("Reason", .20), ("Source", .15), ("Reviewer", .15), ("Risk", .12), ("Status", .10)
    ], [
        (("G", "gh-fix-ci update", "v1.2.0 -> v1.2.1", "dark"), "Executable script added", "GitHub", "alice.dev", ("pill", "High", "high"), "Open"),
        (("B", "browser-control import", "New local package", ""), "Network capability", "Local ZIP", "web3-builder", ("pill", "Medium", "medium"), "Open"),
        (("S", "spreadsheet-auditor", "Rule warning", "green"), "Large fixture file", "skills.sh", "move-enthusiast", ("pill", "Medium", "medium"), "Open"),
        (("O", "openai-docs", "Source refresh", "blue"), "Docs changed", "skills.sh", "alice.dev", ("pill", "Low", "low"), "Approved"),
    ], 0, 52)
    panel(draw, (x0, 576, x0 + 425, 824), "Review notes", "Open")
    list_rows(draw, x0 + 14, 624, 397, [("Explain why shell script is required.", "open"), ("Confirm no token content is exported.", "open"), ("Attach hash diff for changed files.", "done")])
    panel(draw, (x0 + 439, 576, RIGHT_X - 16, 824), "Community signal", "Local cache")
    list_rows(draw, x0 + 453, 624, 397, [("Average rating", "4.6 / 5"), ("Recent reviews", "48"), ("Maintainer response", "1 day")])
    rail(draw, "gh-fix-ci update", "Review decision", "R", "red")
    rail_card(draw, 154, "Decision checklist", [("Security scan", "High"), ("Diff reviewed", "Pending"), ("Source trust", "GitHub"), ("Install block", "Enabled")], h=156)
    rail_card(draw, 320, "Changed files", [("SKILL.md", "modified"), ("scripts/diagnose.ts", "added"), ("prompts/ci.md", "modified"), ("README.md", "modified")], h=156)
    rail_card(draw, 486, "Reviewer action", body="Approve with exemption, request changes, or reject. High-risk installs stay blocked.", h=112)
    return img


def security():
    img, draw = shell("security")
    tabs(draw, ["Overview", "Scan queue", "Rules", "Exemptions", "History"], counts={"Scan queue": 5})
    page_title(draw, "Security", "Pre-install scanning, policy enforcement, and scoped exemptions.", 138, "Run rescan")
    x0, y0 = MAIN_X + 16, 194
    for i, data in enumerate([
        ("Risk score", "74", "High items blocked"),
        ("Open findings", "11", "3 high"),
        ("Active exemptions", "2", "Scoped"),
        ("Blocked installs", "5", "Default policy"),
    ]):
        metric(draw, x0 + i * 219, y0, *data)
    panel(draw, (x0, 318, RIGHT_X - 16, 592), "Scan queue", "5 pending")
    table(draw, x0 + 1, 364, MAIN_W - 33, [
        ("Skill", .28), ("Rule finding", .22), ("Category", .18), ("Severity", .16), ("Policy", .16)
    ], [
        (("G", "gh-fix-ci", "v1.2.1", "dark"), "Executable script", "runtime", ("pill", "High", "high"), "Blocked"),
        (("B", "browser-control", "v0.9.3", ""), "External transfer", "network", ("pill", "Medium", "medium"), "Warn"),
        (("L", "linux-hardening", "v1.1.0", "green"), "Sensitive path", "filesystem", ("pill", "High", "high"), "Blocked"),
    ], 0, 55)
    panel(draw, (x0, 606, x0 + 425, 854), "Rule details", "6 active")
    list_rows(draw, x0 + 14, 654, 397, [("Dangerous shell command", "High"), ("External data transfer", "Medium"), ("Path traversal reference", "High")])
    panel(draw, (x0 + 439, 606, RIGHT_X - 16, 854), "Exemption lifecycle", "Audited")
    list_rows(draw, x0 + 453, 654, 397, [("browser-control network check", "project"), ("terraform-helper script fixture", "user"), ("expired exemptions", "0")])
    rail(draw, "Current posture", "High risk guarded", "!", "red")
    rail_card(draw, 154, "Policy summary", [("High risk installs", "Blocked"), ("Critical installs", "Blocked"), ("Medium risk", "Warn"), ("Exemptions", "Scoped")], h=156)
    rail_card(draw, 320, "Finding excerpt", body="scripts/diagnose.ts references shell execution and needs explicit reviewer approval before projection.", h=118)
    rail_card(draw, 448, "Recommended action", body="Review changed executable files and record an exemption only if the script is required.", h=118)
    return img


def settings():
    img, draw = shell("settings")
    tabs(draw, ["Agent roots", "Database", "Sync", "Plugins", "Privacy"])
    page_title(draw, "Settings", "Configure local roots, storage, disabled sync, and plugin permissions.", 138, "Save changes")
    x0 = MAIN_X + 16
    panel(draw, (x0, 194, RIGHT_X - 16, 438), "Detected agent roots", "4 agents")
    y = 242
    for label, path_value, status, tone in [
        ("Codex user skills", r"C:\Users\devuser\.codex\skills", "Enabled", "low"),
        ("Claude user skills", r"C:\Users\devuser\.claude\skills", "Enabled", "low"),
        ("Gemini skills", r"C:\Users\devuser\.gemini\skills", "Enabled", "low"),
        ("OpenCode skills", r"C:\Users\devuser\.opencode\skills", "Manual", "neutral"),
    ]:
        rounded(draw, (x0 + 14, y, RIGHT_X - 30, y + 42), "#fbfcfe", "#e1e6ef", 7)
        draw_text(draw, (x0 + 28, y + 8), label, F["sm"], COLORS["text"], 220)
        draw_text(draw, (x0 + 280, y + 8), path_value, F["sm"], COLORS["muted"], 420)
        pill(draw, RIGHT_X - 110, y + 9, status, tone)
        y += 48
    panel(draw, (x0, 452, x0 + 425, 678), "Offline-first sync", "Disabled")
    list_rows(draw, x0 + 14, 500, 397, [("No enabled sync profile", "default"), ("Shared-folder driver", "available"), ("Git package driver", "available"), ("Conflict center", "ready")])
    panel(draw, (x0 + 439, 452, RIGHT_X - 16, 678), "Plugin runtime", "Opt-in")
    list_rows(draw, x0 + 453, 500, 397, [("Manifest validation", "required"), ("Permissions", "manual"), ("Network access", "denied"), ("Host escape scan", "enabled")])
    panel(draw, (x0, 692, RIGHT_X - 16, 886), "Database and privacy", "Local only")
    table(draw, x0 + 1, 738, MAIN_W - 33, [
        ("Setting", .32), ("Value", .42), ("Status", .26)
    ], [
        ("SQLite database", r"C:\Users\devuser\.theopenhub\skills-studio\library.db", ("pill", "Healthy", "low")),
        ("Skill content upload", "Never by default", ("pill", "Protected", "low")),
        ("Secrets storage", "OS keychain only", ("pill", "Required", "low")),
    ], 0, 45)
    rail(draw, "Workspace settings", "Local-first defaults", "S", "blue")
    rail_card(draw, 154, "Current defaults", [("Node integration", "Off"), ("Context isolation", "On"), ("Sync profile", "None"), ("Telemetry", "None"), ("Plugin grants", "Manual")], h=178)
    rail_card(draw, 344, "Sync preview", [("Outbox", "0 queued"), ("Inbox", "0 pending"), ("Conflicts", "0 open"), ("Drivers", "3 available")], h=156)
    rail_card(draw, 510, "Plugin request", body="mock-agent-adapter wants to register one adapter capability. Filesystem and network APIs remain unavailable.", h=118)
    return img


SCREENS = {
    "dashboard": dashboard,
    "discover": discover,
    "installs": installs,
    "usage": usage,
    "reviews": reviews,
    "security": security,
    "settings": settings,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, renderer in SCREENS.items():
        image = renderer()
        image.save(OUT / f"{name}.png")
    print(f"Rendered {len(SCREENS)} mockups into {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
