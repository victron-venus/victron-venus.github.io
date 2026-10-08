"""Exercise real HTML and reject mismatched or mutable redirect targets."""

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("redirect", ROOT / "scripts/validate_redirect.py")
redirect = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(redirect)


class RedirectTests(unittest.TestCase):
    def setUp(self):
        self.source = (ROOT / "index.html").read_text()

    def test_actual_page_has_consistent_fixed_destination(self):
        redirect.validate_redirect(self.source)

    def test_each_browser_path_rejects_changed_destination(self):
        target = redirect.DESTINATION
        for index in range(4):
            parts = self.source.split(target)
            changed = target.join(parts[:index + 1]) + "https://example.invalid/" + target.join(parts[index + 1:])
            with self.subTest(index=index), self.assertRaises(ValueError):
                redirect.validate_redirect(changed)

    def test_insecure_or_user_controlled_targets_are_rejected(self):
        for target in ("http://victron-venus.github.io/.github/", "//example.invalid/", "javascript:alert(1)"):
            changed = self.source.replace(redirect.DESTINATION, target)
            with self.subTest(target=target), self.assertRaises(ValueError):
                redirect.validate_redirect(changed)

    def test_extra_or_external_scripts_are_rejected(self):
        for script in ('<script src="https://example.invalid/redirect.js"></script>', '<script>location.assign("/other");</script>'):
            changed = self.source + script
            with self.subTest(script=script), self.assertRaises(ValueError):
                redirect.validate_redirect(changed)

    def test_missing_fallback_is_rejected(self):
        changed = self.source.replace('<a href=', '<span data-href=')
        with self.assertRaises(ValueError):
            redirect.validate_redirect(changed)

    def test_duplicate_destination_attributes_are_rejected(self):
        changed = self.source.replace('<a href=', '<a href="https://example.invalid/" href=')
        with self.assertRaises(ValueError):
            redirect.validate_redirect(changed)
