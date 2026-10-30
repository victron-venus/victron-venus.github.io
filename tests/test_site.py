"""Publishing contracts: local navigation, stable search anchors and asset bounds."""
import importlib.util
import json
import re
from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('site_index', ROOT / 'scripts/build-search-index.py')
INDEX = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INDEX)


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links, self.resources = [], [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'a' and 'href' in attrs:
            self.links.append(attrs['href'])
        if tag in ('script', 'img') and attrs.get('src'):
            self.resources.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.resources.append(attrs['href'])


class PublicSiteTests(unittest.TestCase):
    def test_index_is_current(self):
        self.assertEqual((ROOT / 'assets/search-index.json').read_text(), INDEX.build())

    def test_index_anchors_exist_without_javascript(self):
        entries = json.loads(INDEX.build())
        self.assertGreater(len(entries), 15)
        for entry in entries:
            url = urlsplit(entry['url'])
            self.assertFalse(url.scheme or url.netloc)
            target = ROOT / 'index.html' if url.path in ('', '/') else ROOT / url.path.lstrip('/')
            page = Page(target.read_text())
            if url.fragment:
                self.assertIn(url.fragment, page.ids, entry['url'])
        self.assertTrue(any('battery' in e['text'].lower() for e in entries))

    def test_public_pages_have_local_assets_and_no_duplicate_ids(self):
        for path in [*ROOT.glob('*.html'), *(ROOT / 'wiki').glob('*.html')]:
            page = Page(path.read_text())
            self.assertEqual(len(page.ids), len(set(page.ids)), path.name)
            for value in page.resources:
                url = urlsplit(value)
                self.assertFalse(url.netloc or url.scheme, value)
                target = ROOT / unquote(url.path.lstrip('/')) if url.path.startswith('/') else path.parent / unquote(url.path)
                self.assertTrue(target.is_file(), value)

    def test_local_navigation_keeps_existing_targets(self):
        for path in [ROOT / 'index.html', ROOT / 'projects.html', *(ROOT / 'wiki').glob('*.html')]:
            for value in Page(path.read_text()).links:
                url = urlsplit(value)
                if url.netloc or url.scheme:
                    continue
                if url.path.startswith('/'):
                    target = ROOT / unquote(url.path.lstrip('/'))
                else:
                    target = path.parent / unquote(url.path) if url.path else path
                if target.is_dir():
                    target /= 'index.html'
                self.assertTrue(target.is_file(), f'{path.name}: {value}')
                if url.fragment:
                    self.assertIn(unquote(url.fragment), Page(target.read_text()).ids, value)

    def test_search_excludes_navigation_and_script(self):
        parser = INDEX.Sections('guide.html')
        parser.feed('<main><nav>private nav noise</nav><h1>Guide</h1><p>Intro</p><h2 id="install">Install</h2><p>Read <strong>this</strong>.</p><script>secret()</script></main>')
        entries = parser.result()
        self.assertEqual(entries[1]['url'], 'guide.html#install')
        self.assertEqual(entries[1]['title'], 'Install')
        self.assertNotIn('private', json.dumps(entries))
        self.assertNotIn('secret', json.dumps(entries))

    def test_no_large_hero_or_javascript_dependencies(self):
        self.assertLess((ROOT / 'assets/js/site.js').stat().st_size, 8_000)
        self.assertLess((ROOT / 'assets/js/app.js').stat().st_size, 24_000)
        self.assertLess((ROOT / 'assets/css/elevate.css').stat().st_size, 40_000)

    def test_pages_load_the_shared_motion_layer(self):
        for path in [ROOT / 'index.html', ROOT / '404.html']:
            text = path.read_text()
            self.assertIn('elevate.css', text, path.name)
            self.assertIn('app.js', text, path.name)

    def test_legacy_pages_redirect_to_single_page(self):
        index_ids = set(Page((ROOT / 'index.html').read_text()).ids)
        for path in [ROOT / 'projects.html', *(ROOT / 'wiki').glob('*.html')]:
            text = path.read_text()
            self.assertIn('name="robots" content="noindex"', text, path.name)
            self.assertIn('http-equiv="refresh"', text, path.name)
            self.assertRegex(text, r'url=/#[a-z]+', path.name)
            self.assertRegex(text, r'rel="canonical" href="https://victron-venus\.github\.io/#[a-z]+"', path.name)
            for old, new in re.findall(r'"(#[^"]+)": "(#[^"]+)"', text):
                self.assertIn(new.lstrip('#'), index_ids, f'{path.name}: {old} -> {new}')
            self.assertNotIn(' + (map[location.hash]', text, path.name)

    def test_canonical_urls_use_the_root_domain(self):
        for path in [ROOT / 'index.html', ROOT / 'projects.html', *sorted((ROOT / 'wiki').glob('*.html'))]:
            for match in re.finditer(r'<(?:link rel="canonical"|meta property="og:url")[^>]+(?:href|content)="([^"]+)"', path.read_text()):
                self.assertTrue(match.group(1).startswith('https://victron-venus.github.io/'), path.name)
                self.assertNotIn('/.github/', match.group(1), path.name)

    def test_static_pages_do_not_load_third_party_scripts(self):
        for path in [ROOT / 'index.html', ROOT / '404.html', ROOT / 'projects.html', *sorted((ROOT / 'wiki').glob('*.html'))]:
            for source in re.findall(r'<script[^>]+src="([^"]+)"', path.read_text()):
                self.assertFalse(urlsplit(source).netloc, f'{path.name}: {source}')


if __name__ == '__main__':
    unittest.main()
