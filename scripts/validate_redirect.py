"""Check the fixed website redirect and its browser fallback without navigating."""

from html.parser import HTMLParser
from pathlib import Path

DESTINATION = "https://victron-venus.github.io/.github/"


class RedirectPage(HTMLParser):
    """Collect the four independently used redirect destinations."""

    def __init__(self):
        super().__init__()
        self.refresh = []
        self.canonical = []
        self.links = []
        self.scripts = []
        self.in_script = False

    def handle_starttag(self, tag, attributes):
        names = [name for name, _ in attributes]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate HTML attributes make the redirect ambiguous")
        attrs = dict(attributes)
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            self.refresh.append(attrs.get("content"))
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        elif tag == "a":
            self.links.append(attrs.get("href"))
        elif tag == "script":
            if attributes:
                raise ValueError("The redirect must use its fixed inline script")
            self.scripts.append("")
            self.in_script = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_script = False

    def handle_data(self, data):
        if self.in_script:
            self.scripts[-1] += data


def validate_redirect(source):
    """Require a single consistent HTTPS destination for every browser path."""
    page = RedirectPage()
    page.feed(source)
    page.close()
    expected = (["0; url=" + DESTINATION], [DESTINATION], [DESTINATION])
    if (page.refresh, page.canonical, page.links) != expected:
        raise ValueError("Refresh, canonical URL and fallback link must agree")
    if [script.strip() for script in page.scripts] != [
        'location.replace("' + DESTINATION + '");'
    ]:
        raise ValueError("The script must replace history with the fixed HTTPS destination")


if __name__ == "__main__":
    validate_redirect((Path(__file__).resolve().parents[1] / "index.html").read_text())
    print("Fixed redirect and fallback destinations are consistent.")
