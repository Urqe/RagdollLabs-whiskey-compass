#!/usr/bin/env python3
"""Structural integrity checks for the consolidated CSS layer.

Checks brace balance, token definition coverage and dead-rule residue so the
theme consolidation cannot silently regress. Dependency-free by design.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEAD_PATTERNS = [
    # selectors whose DOM anchors were removed in the interface consolidation
    (r"\.welcome-ragdoll-link", "landing hero was replaced by the whisky-room scene"),
    (r"\.ageing-snapshot", "the ageing snapshot container was removed"),
    (r"#96ind86", "typo'd placeholder color"),
]
REQUIRED_TOKENS = {"bg", "panel", "surface", "line", "text", "muted", "gold", "copper", "focus"}


def main() -> None:
    errors: list[str] = []
    defined: set[str] = set()
    used: set[str] = set()
    for path in sorted(ROOT.glob("*.css")):
        css = path.read_text(encoding="utf-8")
        if css.count("{") != css.count("}"):
            errors.append(f"{path.name}: unbalanced braces ({css.count('{')} vs {css.count('}')})")
        defined |= {m.group(1) for m in re.finditer(r"--([a-z0-9-]+)\s*:", css)}
        used |= {m.group(1) for m in re.finditer(r"var\(--([a-z0-9-]+)", css)}
        for pattern, reason in DEAD_PATTERNS:
            if re.search(pattern, css):
                errors.append(f"{path.name}: dead rule '{pattern}' present ({reason})")

    undefined = used - defined
    if undefined:
        errors.append(f"tokens used but never defined: {sorted(undefined)}")
    missing = REQUIRED_TOKENS - defined
    if missing:
        errors.append(f"required palette tokens missing: {sorted(missing)}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)
    print(f"OK: CSS integrity clean ({len(defined)} tokens, {len(used)} used)")


if __name__ == "__main__":
    main()
