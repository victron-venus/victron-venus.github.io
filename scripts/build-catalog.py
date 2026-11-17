#!/usr/bin/env python3
"""Extract the project catalog from the landing page into `assets/catalog.json`.

The catalog used to exist only as hand-written HTML: forty-seven ``<article
class="proj">`` blocks in ``index.html`` plus a separate, drifting copy in the
organization repository. ``assets/catalog.json`` becomes the single machine
readable form, so the landing page, the documentation portal and any future
consumer read one list instead of three.

This script only reads ``index.html`` and writes ``assets/catalog.json``. Use
``--check`` to fail when the two disagree.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
CATALOG = ROOT / 'assets/catalog.json'

# Each catalog group is introduced by an `<h2 id="catalog-<group>">` heading and
# runs until the next `<h2`. The article cards live in the markup between them.
SECTION = re.compile(
    r'<h2 id="catalog-(?P<group>[a-z-]+)"[^>]*>.*?</h2>(?P<body>.*?)(?=<h2 |</main>)',
    re.S,
)
CARD = re.compile(r'<article class="proj"(?P<attrs>[^>]*)>(?P<body>.*?)</article>', re.S)
LINK = re.compile(r'<h3><a href="(?P<href>[^"]+)">(?P<name>[^<]+)')
SUMMARY = re.compile(r'<p>(?P<text>.*?)</p>', re.S)
LANGS = re.compile(r'<span class="lang lang-[a-z0-9+#-]+">(?P<lang>[^<]+)</span>')
TAGS = re.compile(r'<span class="tag">(?P<tag>[^<]+)</span>')
ORG = re.compile(r'<span class="org-chip">(?P<org>[^<]+)</span>')


def clean(value: str) -> str:
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def parse(index_html: str) -> list[dict[str, object]]:
    projects: list[dict[str, object]] = []
    seen: dict[str, int] = {}
    for section in SECTION.finditer(index_html):
        group = section.group('group')
        for card in CARD.finditer(section.group('body')):
            link = LINK.search(card.group('body'))
            if not link:
                continue
            href = link.group('href')
            name = clean(link.group('name'))
            summary = SUMMARY.search(card.group('body'))
            entry: dict[str, object] = {
                'name': name,
                'repo': href.removeprefix('https://github.com/'),
                'url': href,
                'group': group,
                'summary': clean(summary.group('text')) if summary else '',
                'languages': [clean(m.group('lang')) for m in LANGS.finditer(card.group('body'))],
                'tags': [clean(m.group('tag')) for m in TAGS.finditer(card.group('body'))],
                'org': (clean(ORG.search(card.group('body')).group('org'))
                        if ORG.search(card.group('body')) else ''),
            }
            seen[name] = seen.get(name, 0) + 1
            entry['duplicate'] = seen[name] > 1
            projects.append(entry)
    return projects


def build() -> str:
    projects = parse(INDEX.read_text(encoding='utf-8'))
    payload = {
        'version': 1,
        'source': 'index.html',
        'count': len(projects),
        'groups': sorted({str(p['group']) for p in projects}),
        'projects': projects,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False) + '\n'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true',
                        help='fail instead of writing when the catalog is stale')
    args = parser.parse_args()
    built = build()
    if args.check:
        current = CATALOG.read_text(encoding='utf-8') if CATALOG.exists() else ''
        if current != built:
            print('assets/catalog.json is stale; run python3 scripts/build-catalog.py', file=sys.stderr)
            return 1
        print('catalog is current')
        return 0
    CATALOG.write_text(built, encoding='utf-8')
    count = json.loads(built)['count']
    print(f'wrote {CATALOG.relative_to(ROOT)} with {count} projects')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
