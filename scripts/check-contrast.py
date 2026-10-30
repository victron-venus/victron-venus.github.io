#!/usr/bin/env python3
"""Fail when text or UI colours fall below WCAG AA contrast.

The palette stores both schemes as `light-dark(light, dark)` pairs. This check
reads those tokens from the stylesheet, resolves every pair for both schemes and
compares WCAG 2.1 contrast ratios: 4.5:1 for normal text and 3:1 for graphical
objects and interactive boundaries (WCAG 1.4.11). It also fails when a CSS
`color:` rule references a token that is not listed in TEXT_PAIRS, so a new text
colour cannot silently skip the check.

Limitations: this is a token-level check. It does not measure rendered pixels,
translucent overlays, gradients, images behind text, hover-only declarations
that share a token, or large-text exceptions (3:1). Those still need a browser
pass. Alpha colours are rejected rather than guessed, because compositing
depends on a backdrop this script does not model.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE = ROOT / "assets/css/style.css"
STYLESHEETS = sorted((ROOT / "assets/css").glob("*.css"))

# WCAG 2.1 AA thresholds. Large text (>= 24 px, or >= 18.66 px bold) may use
# 3:1, but every text pair below is also used at body size somewhere.
AA_NORMAL = 4.5
AA_NON_TEXT = 3.0

# (foreground token, background token, what the pair covers)
TEXT_PAIRS = [
    ("--ink", "--bg", "body text"),
    ("--ink", "--bg-deep", "body text on alternate sections"),
    ("--ink", "--panel", "card and code text"),
    ("--ink", "--panel-hi", "raised card text"),
    ("--ink-dim", "--bg", "secondary text"),
    ("--ink-dim", "--bg-deep", "secondary text on alternate sections"),
    ("--ink-dim", "--panel", "secondary text in cards"),
    ("--ink-dim", "--panel-hi", "secondary text in raised cards"),
    ("--ink-faint", "--bg", "captions and notes"),
    ("--ink-faint", "--bg-deep", "footer notes"),
    ("--ink-faint", "--panel", "captions in cards"),
    ("--ink-faint", "--panel-hi", "captions in raised cards"),
    ("--amber", "--bg", "eyebrows and active links"),
    ("--amber", "--bg-deep", "active links on alternate sections"),
    ("--amber", "--panel", "active filter labels"),
    ("--cyan", "--bg", "inline links"),
    ("--cyan", "--bg-deep", "inline links on alternate sections"),
    ("--cyan", "--panel", "links in cards"),
    ("--bg", "--amber", "primary button label"),
]

# Non-text contrast (WCAG 1.4.11): interactive boundaries and meaningful icons.
# `--control-edge` is the boundary of form fields and icon buttons; `--edge`
# is a decorative divider and deliberately not listed here.
UI_PAIRS = [
    ("--control-edge", "--bg", "field and icon-button borders on the page"),
    ("--control-edge", "--panel", "field borders on their fill"),
    ("--control-edge", "--panel-hi", "control borders on raised panels"),
    ("--ink-dim", "--bg", "icon-only button glyphs"),
    ("--ink-dim", "--panel", "icon glyphs on controls"),
    ("--amber", "--bg", "focus ring and amber icons"),
    ("--amber", "--panel", "amber icons on cards"),
    ("--cyan", "--bg", "cyan icons"),
    ("--cyan", "--panel", "cyan icons on cards"),
    ("--cyan-dim", "--bg", "focused field border"),
    ("--cyan-dim", "--panel", "focused field border on its fill"),
    ("--amber-dim", "--bg", "pressed filter boundary on the page"),
    ("--amber-dim", "--panel", "pressed filter boundary on its fill"),
]

# Tokens used as CSS `color` that are not body text and therefore not checked.
# Keep the reason next to the exemption: an empty reason is a configuration bug.
EXEMPT_FOREGROUND = {
    "--edge-hi": "decorative middle dot in .stats, not readable content",
}

TOKEN_BLOCK = re.compile(r"(?ms)^:root\s*\{([^}]*)\}")
LIGHT_DARK = re.compile(r"(?s)^light-dark\((.*)\)$")
HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})")
RGB = re.compile(r"(?s)^rgba?\((.*)\)$")
COLOR_USE = re.compile(r"(?<![\w-])color:\s*var\((--[A-Za-z0-9-]+)\)")


class ContrastError(ValueError):
    """A token or colour value that this checker cannot evaluate."""


def split_arguments(value: str) -> list[str]:
    """Split on commas that are not inside parentheses."""
    parts, depth, start = [], 0, 0
    for index, char in enumerate(value):
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(value[start:index].strip())
            start = index + 1
    parts.append(value[start:].strip())
    return parts


def root_declarations(text: str) -> dict[str, str]:
    """Custom properties declared in top-level `:root` blocks; later wins."""
    declarations: dict[str, str] = {}
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    for block in TOKEN_BLOCK.finditer(text):
        for line in block.group(1).split(";"):
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            name, value = name.strip(), value.strip()
            if name.startswith("--"):
                declarations[name] = value
    return declarations


def light_dark_values(value: str) -> tuple[str, str] | None:
    """Return the light and dark arguments of a `light-dark()` value."""
    match = LIGHT_DARK.match(value)
    if not match:
        return None
    arguments = split_arguments(match.group(1))
    if len(arguments) != 2:
        raise ContrastError(f"light-dark() needs two values, found {len(arguments)}")
    return arguments[0], arguments[1]


def parse_colour(value: str) -> tuple[int, int, int]:
    """Parse an opaque hex or rgb() colour into 0-255 channels."""
    value = value.strip().lower()
    hex_match = HEX.fullmatch(value)
    if hex_match:
        digits = hex_match.group(1)
        if len(digits) == 3:
            digits = "".join(char * 2 for char in digits)
        return tuple(int(digits[index:index + 2], 16) for index in (0, 2, 4))
    rgb_match = RGB.fullmatch(value)
    if not rgb_match:
        raise ContrastError(f"unsupported colour value: {value!r}")
    channels = [part for part in re.split(r"[\s,/]+", rgb_match.group(1)) if part]
    if len(channels) not in (3, 4):
        raise ContrastError(f"rgb() needs three channels, found {len(channels)}: {value!r}")
    if len(channels) == 4 and float(channels[3]) != 1:
        raise ContrastError(f"translucent colour cannot be checked: {value!r}")
    resolved = []
    for channel in channels[:3]:
        number = float(channel[:-1]) * 2.55 if channel.endswith("%") else float(channel)
        resolved.append(max(0, min(255, round(number))))
    return tuple(resolved)


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def linear(channel: int) -> float:
        value = channel / 255
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

    red, green, blue = (linear(channel) for channel in rgb)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    brighter, darker = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (brighter + 0.05) / (darker + 0.05)


def load_tokens(path: Path = STYLE) -> dict[str, tuple[str, str]]:
    """Read every `light-dark()` colour token, rejecting one-scheme values."""
    declarations = root_declarations(path.read_text(encoding="utf-8"))
    tokens = {}
    for name, value in declarations.items():
        pair = light_dark_values(value)
        if pair is None:
            continue
        tokens[name] = pair
    if not tokens:
        raise ContrastError(f"no light-dark() tokens found in {path}")
    return tokens


def uncovered_foregrounds(text: str, checked: set[str], exempt: dict[str, str]) -> list[str]:
    """CSS `color:` tokens that are neither checked nor explicitly exempt."""
    found = {match.group(1) for match in COLOR_USE.finditer(text)}
    return sorted(found - checked - set(exempt))


def check(
    tokens: dict[str, tuple[str, str]],
    pairs: list[tuple[str, str, str]] = TEXT_PAIRS,
    minimum: float = AA_NORMAL,
) -> tuple[list[str], list[str]]:
    """Return readable rows and failures for every pair in both schemes."""
    rows, failures = [], []
    missing = sorted({name for pair in pairs for name in pair[:2]} - set(tokens))
    if missing:
        failures.append("missing light-dark() token(s): " + ", ".join(missing))
    for name, reason in EXEMPT_FOREGROUND.items():
        if not reason:
            failures.append(f"exemption {name} must document why it is not text")
    for foreground, background, purpose in pairs:
        if foreground not in tokens or background not in tokens:
            continue
        values = []
        for index, scheme in enumerate(("light", "dark")):
            try:
                ratio = contrast_ratio(
                    parse_colour(tokens[foreground][index]),
                    parse_colour(tokens[background][index]),
                )
            except ContrastError as error:
                failures.append(f"{scheme}: {foreground} on {background}: {error}")
                continue
            values.append(ratio)
            if ratio < minimum:
                failures.append(
                    f"{scheme}: {foreground} on {background} ({purpose}) is "
                    f"{ratio:.2f}:1, below AA {minimum}:1"
                )
        if len(values) == 2:
            rows.append(
                f"{foreground:>12} on {background:<10} light {values[0]:5.2f}  dark {values[1]:5.2f}  {purpose}"
            )
    return rows, failures


def main() -> int:
    try:
        tokens = load_tokens()
    except (OSError, ContrastError) as error:
        print(f"Contrast check cannot run: {error}", file=sys.stderr)
        return 1
    groups = (
        ("normal text", AA_NORMAL, TEXT_PAIRS),
        ("non-text UI", AA_NON_TEXT, UI_PAIRS),
    )
    rows_by_group, failures = [], []
    checked: set[str] = set()
    for title, minimum, pairs in groups:
        rows, group_failures = check(tokens, pairs, minimum)
        rows_by_group.append((title, minimum, rows))
        failures.extend(group_failures)
        checked |= {foreground for foreground, _background, _purpose in pairs}
        checked |= {background for _foreground, background, _purpose in pairs}
    scan_failures = []
    for stylesheet in STYLESHEETS:
        for token in uncovered_foregrounds(stylesheet.read_text(encoding="utf-8"), checked, EXEMPT_FOREGROUND):
            scan_failures.append(
                f"{stylesheet.name} sets color from {token}, which is not in scripts/check-contrast.py"
            )
    failures.extend(scan_failures)
    print(f"WCAG AA contrast, token pairs from {STYLE.name}")
    for title, minimum, rows in rows_by_group:
        print(f"\n{title} ({minimum}:1)")
        for row in rows:
            print("  " + row)
    if failures:
        print("\nContrast check failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1
    total = len(TEXT_PAIRS) + len(UI_PAIRS)
    print(f"\nContrast check passed: {len(TEXT_PAIRS)} text + {len(UI_PAIRS)} UI pairs x 2 schemes ({total} total).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
