#!/usr/bin/env python3
"""Draw downloads-per-release charts (light + dark SVG) and log a totals snapshot.

Usage: release_stats.py OWNER/REPO OUTPUT_DIR
Reads GITHUB_TOKEN from the environment if set (avoids API rate limits).
"""
import csv
import datetime
import json
import os
import re
import sys
import urllib.request

FORMATS = [("AppImage", ".AppImage"), (".deb", ".deb"), (".rpm", ".rpm")]

THEMES = {
    "light": {
        "surface": "#ffffff", "text": "#1f2328", "muted": "#656d76",
        "grid": "#e1e0d9", "axis": "#c3c2b7",
        "series": ["#2a78d6", "#eb6834", "#1baf7a"],
    },
    "dark": {
        "surface": "#0d1117", "text": "#e6edf3", "muted": "#8d96a0",
        "grid": "#262c36", "axis": "#3d444d",
        "series": ["#3987e5", "#d95926", "#199e70"],
    },
}

FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"


def fetch_releases(repo):
    releases, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/releases?per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json"},
        )
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(req) as resp:
            batch = json.load(resp)
        if not batch:
            return releases
        releases.extend(batch)
        page += 1


def version_key(tag):
    return [int(n) for n in re.findall(r"\d+", tag)]


def per_release_counts(releases):
    """{tag: [appimage, deb, rpm]}, merging releases that share a tag."""
    counts = {}
    for rel in releases:
        if rel.get("draft"):
            continue
        row = counts.setdefault(rel["tag_name"], [0, 0, 0])
        for asset in rel["assets"]:
            for i, (_, suffix) in enumerate(FORMATS):
                if asset["name"].endswith(suffix):
                    row[i] += asset["download_count"]
    return dict(sorted(counts.items(), key=lambda kv: version_key(kv[0])))


def nice_step(max_value):
    for step in (1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000):
        if max_value / step <= 5:
            return step
    return 10000


def top_rounded_rect(x, y, w, h, r, fill):
    r = min(r, h, w / 2)
    return (
        f'<path d="M{x:.1f},{y + h:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} '
        f'H{x + w - r:.1f} Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} V{y + h:.1f} Z" fill="{fill}"/>'
    )


def render_svg(counts, theme, as_of):
    t = THEMES[theme]
    width, height = 840, 340
    left, right, top, bottom = 52, 16, 78, 44
    plot_w, plot_h = width - left - right, height - top - bottom
    tags = list(counts)
    totals = [sum(v) for v in counts.values()]
    grand = sum(totals)
    step = nice_step(max(totals))
    y_max = step * -(-max(totals) // step)
    slot = plot_w / len(tags)
    bar_w = min(28, slot * 0.62)
    gap = 2

    def y_of(v):
        return top + plot_h - v / y_max * plot_h

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" font-family="{FONT}">',
        f'<title>Ollie downloads per release</title>',
        f'<rect width="{width}" height="{height}" fill="{t["surface"]}"/>',
        f'<text x="{left}" y="28" font-size="16" font-weight="600" fill="{t["text"]}">Downloads per release</text>',
        f'<text x="{left}" y="48" font-size="12" fill="{t["muted"]}">'
        f'{grand:,} total across {len(tags)} releases, as of {as_of}</text>',
    ]

    # Legend, top right; text carries identity, the swatch only supports it.
    lx = width - right
    for i in reversed(range(len(FORMATS))):
        label = FORMATS[i][0]
        lx -= len(label) * 7 + 30
        out.append(f'<rect x="{lx}" y="38" width="12" height="12" rx="2" fill="{t["series"][i]}"/>')
        out.append(f'<text x="{lx + 17}" y="48" font-size="12" fill="{t["text"]}">{label}</text>')

    # Recessive gridlines and y ticks.
    for v in range(0, y_max + 1, step):
        y = y_of(v)
        color = t["axis"] if v == 0 else t["grid"]
        out.append(f'<line x1="{left}" x2="{width - right}" y1="{y:.1f}" y2="{y:.1f}" stroke="{color}" stroke-width="1"/>')
        out.append(f'<text x="{left - 8}" y="{y + 4:.1f}" font-size="11" fill="{t["muted"]}" text-anchor="end">{v:,}</text>')

    label_threshold = max(totals) * 0.12
    for idx, (tag, row) in enumerate(counts.items()):
        cx = left + slot * idx + slot / 2
        x = cx - bar_w / 2
        base = y_of(0)
        drawn = [(i, v) for i, v in enumerate(row) if v > 0]
        for n, (i, v) in enumerate(drawn):
            h = v / y_max * plot_h
            seg_top = base - h
            is_top = n == len(drawn) - 1
            seg_h = h - (gap if n > 0 and h > gap * 2 else 0)
            if seg_h <= 0:
                continue
            if is_top:
                out.append(top_rounded_rect(x, seg_top, bar_w, seg_h, 4, t["series"][i]))
            else:
                out.append(f'<rect x="{x:.1f}" y="{seg_top:.1f}" width="{bar_w:.1f}" height="{seg_h:.1f}" fill="{t["series"][i]}"/>')
            base = seg_top
        total = sum(row)
        if total >= label_threshold:
            out.append(f'<text x="{cx:.1f}" y="{y_of(total) - 6:.1f}" font-size="11" fill="{t["text"]}" '
                       f'text-anchor="middle">{total:,}</text>')
        out.append(f'<text x="{cx:.1f}" y="{height - bottom + 16}" font-size="10" fill="{t["muted"]}" '
                   f'text-anchor="middle">{tag.lstrip("v")}</text>')

    out.append("</svg>")
    return "\n".join(out)


def main():
    repo, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    counts = per_release_counts(fetch_releases(repo))
    today = datetime.date.today().isoformat()

    for theme in THEMES:
        with open(os.path.join(out_dir, f"downloads-{theme}.svg"), "w") as f:
            f.write(render_svg(counts, theme, today))

    with open(os.path.join(out_dir, "downloads-by-release.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["release", "appimage", "deb", "rpm", "total"])
        for tag, row in counts.items():
            w.writerow([tag, *row, sum(row)])

    history = os.path.join(out_dir, "downloads-history.csv")
    fmt_totals = [sum(row[i] for row in counts.values()) for i in range(len(FORMATS))]
    rows = []
    if os.path.exists(history):
        with open(history, newline="") as f:
            rows = [r for r in csv.reader(f)][1:]
    rows = [r for r in rows if r[0] != today]
    rows.append([today, *fmt_totals, sum(fmt_totals)])
    with open(history, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["date", "appimage", "deb", "rpm", "total"])
        w.writerows(rows)

    print(f"{len(counts)} releases, {sum(fmt_totals):,} downloads -> {out_dir}")


if __name__ == "__main__":
    main()
