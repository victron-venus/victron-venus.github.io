"""Contrast checker: WCAG maths, token parsing and palette coverage."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('contrast', ROOT / 'scripts/check-contrast.py')
CONTRAST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTRAST)


class ContrastTests(unittest.TestCase):
    def test_black_on_white_is_maximum(self):
        self.assertAlmostEqual(CONTRAST.contrast_ratio((0, 0, 0), (255, 255, 255)), 21, places=2)

    def test_light_dark_pair_keeps_rgb_commas(self):
        self.assertEqual(
            CONTRAST.light_dark_values('light-dark(rgb(1, 2, 3), #fff)'),
            ('rgb(1, 2, 3)', '#fff'),
        )
        self.assertIsNone(CONTRAST.light_dark_values('#fff'))

    def test_uncovered_text_token_is_reported(self):
        text = '.a { color: var(--new-accent); }'
        self.assertEqual(CONTRAST.uncovered_foregrounds(text, set(), {}), ['--new-accent'])
        self.assertEqual(CONTRAST.uncovered_foregrounds(text, {'--new-accent'}, {}), [])
        self.assertEqual(
            CONTRAST.uncovered_foregrounds(text, set(), {'--new-accent': 'decorative'}),
            [],
        )

    def test_current_palette_passes_both_schemes(self):
        rows, failures = CONTRAST.check(CONTRAST.load_tokens())
        self.assertEqual(len(rows), len(CONTRAST.PAIRS))
        self.assertEqual(failures, [])

    def test_low_contrast_pair_fails(self):
        tokens = {'--fg': ('#777777', '#777777'), '--bg': ('#ffffff', '#ffffff')}
        _rows, failures = CONTRAST.check(tokens, pairs=[('--fg', '--bg', 'fixture')])
        self.assertEqual(len(failures), 2)
        self.assertIn('below AA', failures[0])


if __name__ == '__main__':
    unittest.main()
