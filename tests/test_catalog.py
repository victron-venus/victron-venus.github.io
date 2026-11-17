"""Catalog contract: the machine-readable list matches the landing page.

`assets/catalog.json` is generated from `index.html`. These tests fail when the
two drift, when a group count in the markup disagrees with the cards it
contains, or when the same project is listed twice inside one group.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
CATALOG = ROOT / 'assets' / 'catalog.json'


def run_builder(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(ROOT / 'scripts' / 'build-catalog.py'), *args],
        capture_output=True, text=True, check=False,
    )


class CatalogTests(unittest.TestCase):
    def setUp(self) -> None:
        self.html = INDEX.read_text(encoding='utf-8')
        self.catalog = json.loads(CATALOG.read_text(encoding='utf-8'))

    def test_catalog_is_current(self):
        result = run_builder('--check')
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_every_card_is_in_the_catalog(self):
        cards = re.findall(r'<article class="proj".*?</article>', self.html, re.S)
        names = re.findall(r'<h3><a href="[^"]+">([^<]+)', ' '.join(cards))
        catalogued = {entry['name'] for entry in self.catalog['projects']}
        self.assertEqual(len(names), len(cards))
        self.assertEqual(set(n.strip() for n in names), catalogued)

    def test_group_counts_in_markup_match_their_cards(self):
        for match in re.finditer(
            r'<h2 id="catalog-(?P<group>[a-z-]+)"[^>]*>.*?'
            r'<span class="count">(?P<count>\d+)</span></h2>'
            r'(?P<body>.*?)(?=<h2 |</main>)',
            self.html, re.S,
        ):
            group = match.group('group')
            declared = int(match.group('count'))
            actual = len(re.findall(r'<article class="proj"', match.group('body')))
            self.assertEqual(declared, actual, f'group {group}')

    def test_no_project_repeats_inside_one_group(self):
        seen: set[tuple[str, str]] = set()
        for entry in self.catalog['projects']:
            key = (str(entry['group']), str(entry['name']))
            self.assertNotIn(key, seen, f"{entry['name']} twice in {entry['group']}")
            seen.add(key)

    def test_every_entry_has_a_repository_and_summary(self):
        for entry in self.catalog['projects']:
            self.assertTrue(str(entry['repo']).count('/') == 1, entry['name'])
            self.assertTrue(entry['summary'], entry['name'])
            self.assertTrue(str(entry['url']).startswith('https://github.com/'), entry['name'])


if __name__ == '__main__':
    unittest.main()
