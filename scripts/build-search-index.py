#!/usr/bin/env python3
"""Build an offline documentation index from the published HTML, never GitHub APIs."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Sections(HTMLParser):
    def __init__(self, url):
        super().__init__()
        self.url = url
        self.main = False
        self.skip = 0
        self.heading = None
        self.parts = []
        self.sections = []
        self.section_anchor = ''
        self.title = "Documentation"
        self.current = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'main':
            self.main = True
        if not self.main:
            return
        if tag in ('nav', 'script', 'style'):
            self.skip += 1
        if self.skip:
            return
        if tag == 'section' and 'id' in attrs:
            self.section_anchor = '#' + attrs['id']
        if self.heading and tag in ('br', 'span'):
            self.parts.append(' ')
        if tag in ('h1', 'h2'):
            if self.current:
                self.sections.append(self.current)
            self.heading = tag
            self.parts = []
            anchor = '#' + attrs['id'] if 'id' in attrs else self.section_anchor
            self.current = {'title': '', 'url': self.url + anchor, 'text': ''}
        elif tag in ('p', 'li', 'br', 'pre') and self.current:
            self.current['text'] += ' '

    def handle_endtag(self, tag):
        if tag == 'main':
            self.main = False
        if self.skip and tag in ('nav', 'script', 'style'):
            self.skip -= 1
        if not self.main or self.skip:
            return
        if tag == self.heading:
            title = ' '.join(''.join(self.parts).split())
            if tag == 'h1':
                self.title = title
            self.current['title'] = title
            self.heading = None

    def handle_data(self, text):
        if not self.main or self.skip:
            return
        if self.heading:
            self.parts.append(text)
        elif self.current:
            self.current['text'] += text + ' '

    def result(self):
        if self.current:
            self.sections.append(self.current)
            self.current = None
        for section in self.sections:
            section['text'] = ' '.join(section['text'].split())
        return [section for section in self.sections if section['title']]


def build(root=ROOT):
    parser = Sections('/')
    parser.feed((root / 'index.html').read_text())
    entries = parser.result()
    return json.dumps(entries, ensure_ascii=False, indent=2) + '\n'


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--check', action='store_true')
    options = args.parse_args()
    target = ROOT / 'assets/search-index.json'
    expected = build()
    if options.check:
        if not target.exists() or target.read_text() != expected:
            raise SystemExit('Search index is stale: run python3 scripts/build-search-index.py')
    else:
        target.write_text(expected)
    print('Documentation search index is current.')


if __name__ == '__main__':
    main()
