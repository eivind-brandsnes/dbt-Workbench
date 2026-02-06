from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from app.schemas.theme import ThemeModeConfig, ThemePreference


@dataclass
class ContrastCheck:
    id: str
    label: str
    ratio: float
    min_ratio: float
    passed: bool


def _hex_to_rgb(value: str) -> Tuple[int, int, int]:
    stripped = value.strip().lstrip("#")
    r = int(stripped[0:2], 16)
    g = int(stripped[2:4], 16)
    b = int(stripped[4:6], 16)
    return r, g, b


def _relative_luminance(rgb: Tuple[int, int, int]) -> float:
    def to_linear(channel: int) -> float:
        c = channel / 255.0
        if c <= 0.03928:
            return c / 12.92
        return ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * to_linear(r) + 0.7152 * to_linear(g) + 0.0722 * to_linear(b)


def contrast_ratio(color_a: str, color_b: str) -> float:
    lum_a = _relative_luminance(_hex_to_rgb(color_a))
    lum_b = _relative_luminance(_hex_to_rgb(color_b))
    lighter = max(lum_a, lum_b)
    darker = min(lum_a, lum_b)
    return (lighter + 0.05) / (darker + 0.05)


def _check_pair(
    foreground: str,
    background: str,
    min_ratio: float,
    label: str,
    check_id: str,
) -> ContrastCheck:
    ratio = contrast_ratio(foreground, background)
    return ContrastCheck(
        id=check_id,
        label=label,
        ratio=ratio,
        min_ratio=min_ratio,
        passed=ratio >= min_ratio,
    )


def validate_theme_mode(mode: ThemeModeConfig) -> List[ContrastCheck]:
    colors = mode.colors
    derived = mode.derived
    checks: List[ContrastCheck] = []

    checks.append(
        _check_pair(colors.text, colors.background, 4.5, "Text on background", "text-bg")
    )
    checks.append(
        _check_pair(colors.text, colors.surface, 4.5, "Text on surface", "text-surface")
    )
    checks.append(
        _check_pair(colors.primary, colors.background, 3.0, "Primary on background", "primary-bg")
    )
    checks.append(
        _check_pair(colors.primary, colors.surface, 3.0, "Primary on surface", "primary-surface")
    )
    checks.append(
        _check_pair(colors.secondary, colors.background, 3.0, "Secondary on background", "secondary-bg")
    )
    checks.append(
        _check_pair(colors.secondary, colors.surface, 3.0, "Secondary on surface", "secondary-surface")
    )
    checks.append(
        _check_pair(derived.primary_foreground, colors.primary, 4.5, "Primary text", "primary-foreground")
    )
    checks.append(
        _check_pair(derived.secondary_foreground, colors.secondary, 4.5, "Secondary text", "secondary-foreground")
    )

    return checks


def validate_theme_preference(theme: ThemePreference) -> Dict[str, List[ContrastCheck]]:
    return {
        "light": validate_theme_mode(theme.light),
        "dark": validate_theme_mode(theme.dark),
    }


def collect_violations(checks_by_mode: Dict[str, List[ContrastCheck]]) -> List[Dict[str, object]]:
    violations: List[Dict[str, object]] = []
    for mode, checks in checks_by_mode.items():
        for check in checks:
            if not check.passed:
                violations.append(
                    {
                        "mode": mode,
                        "id": check.id,
                        "label": check.label,
                        "ratio": round(check.ratio, 2),
                        "min_ratio": check.min_ratio,
                    }
                )
    return violations
