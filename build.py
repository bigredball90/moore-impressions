#!/usr/bin/env python3
"""Builds the Moore Impressions static site.

Each page in src/pages/ starts with a front-matter comment (title, slug,
description, nav). The page body is wrapped with the shared head, header and
footer from src/partials/ and written to <slug>/index.html, so URLs match the
WordPress slugs (/custom-orders/, /art-requirements/, ...).

Run:  python3 build.py
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
SITE_URL = "https://bigredball90.github.io/moore-impressions/"

NAV = [
    ("", "Home"),
    ("custom-orders", "Custom Orders"),
    ("custom-web-stores", "Custom Web Stores"),
    ("art-requirements", "Art Requirements"),
    ("gallery", "Gallery"),
    ("contact-hours", "Contact &amp; Hours"),
    ("shop", "Shop"),
]


def read(path):
    return (SRC / path).read_text(encoding="utf-8")


def parse(page_text):
    m = re.match(r"\s*<!--(.*?)-->\s*", page_text, re.S)
    meta = {}
    for line in m.group(1).strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, page_text[m.end():]


def nav_html(active):
    items = []
    for slug, label in NAV:
        href = "{{root}}" + (slug + "/" if slug else "")
        current = ' aria-current="page"' if slug == active else ""
        items.append(f'<li><a href="{href}"{current}>{label}</a></li>')
    return "\n        ".join(items)


def build():
    head, header, footer = read("partials/head.html"), read("partials/header.html"), read("partials/footer.html")
    pages = sorted((SRC / "pages").glob("*.html"))
    for page in pages:
        meta, body = parse(page.read_text(encoding="utf-8"))
        slug = meta.get("slug", "")
        is_404 = page.stem == "404"
        if is_404:
            out = ROOT / "404.html"
        elif slug:
            out = ROOT / slug / "index.html"
        else:
            out = ROOT / "index.html"

        html = (head + header + body + footer)
        html = html.replace("{{nav}}", nav_html(meta.get("nav", slug)))
        html = html.replace("{{title}}", meta["title"])
        html = html.replace("{{description}}", meta.get("description", ""))
        html = html.replace("{{canonical}}", SITE_URL + (slug + "/" if slug else ""))
        html = html.replace("{{og_image}}", SITE_URL + "assets/img/" + meta.get("og_image", "jacqui.jpg"))
        html = html.replace("{{site_url}}", SITE_URL)
        html = html.replace("{{body_class}}", meta.get("body_class", ""))
        # GitHub Pages serves 404.html from any depth, so it uses absolute links.
        root = "/moore-impressions/" if is_404 else ("../" if slug else "")
        html = html.replace("{{root}}", root)

        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print("built", out.relative_to(ROOT))


if __name__ == "__main__":
    build()
