#!/usr/bin/env python3
"""Structural integrity checks for the consolidated CSS layer.

Checks brace balance, token definition coverage, dead-rule residue and the
raw-hex invariant so the theme consolidation cannot silently regress.
Dependency-free by design.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEAD_PATTERNS = [
    # selectors whose DOM anchors were removed in the interface consolidation
    (r"\.welcome-ragdoll-link", "landing hero was replaced by the whisky-room scene"),
    (r"\.ageing-snapshot", "the ageing snapshot container was removed"),
    (r"\.welcome-brand\b", "the welcome-brand span was removed by the whisky-room hero"),
    (r"#96ind86", "typo'd placeholder color"),
    (r"\.style-cue-dot\.corn", "corn whiskey style was removed"),
    (r"\.style-cue-dot\.orange", "orange was a wine-era cue"),
]
REQUIRED_TOKENS = {"bg", "panel", "surface", "line", "text", "muted", "gold", "copper", "focus"}

# Raw hexes allowed outside styles.css :root. These are semantic per-family cue
# colors and whisky-room scene/art values that legitimately live as literals.
CUE_DOT_COLORS = {"c47f3a", "b8642a", "a34d2e", "edb05c", "d9a44e", "8a6a3d", "3f7d5a", "6b4a2f"}
SCENE_ART_COLORS = {
    # whisky-room hero scene, gradients and button-text values tied to the artwork
    "10252c", "173039", "172025", "263035", "0c1b20", "193943", "203b43", "3b5359",
    "2e4950", "24434c", "fff1dc", "edb05c", "e9b467", "a75d36",
}


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

        # Raw-hex invariant: outside the styles.css :root block, only whitelisted
        # semantic cue colors and scene-art values may appear as hex literals.
        if path.name == "styles.css":
            body = css.split("}", 1)[1]  # skip the :root block only
        else:
            body = css
        for m in re.finditer(r"#([0-9a-fA-F]{6})\b", body):
            hexval = m.group(1).lower()
            if hexval not in CUE_DOT_COLORS and hexval not in SCENE_ART_COLORS:
                errors.append(f"{path.name}: raw hex #{hexval} outside :root — use a palette token")

    # Asset integrity: every referenced asset exists, every asset is referenced.
    referenced: set[str] = set()
    for path in sorted(ROOT.glob("*.css")) + [ROOT / "index.html"] + sorted(ROOT.glob("*.js")):
        referenced |= {m.group(1) for m in re.finditer(r"assets/([a-z0-9.-]+)", path.read_text(encoding="utf-8"))}
    existing = {p.name for p in (ROOT / "assets").glob("*")} if (ROOT / "assets").is_dir() else set()
    for orphan in sorted(existing - referenced):
        errors.append(f"orphaned asset not referenced anywhere: assets/{orphan}")
    for missing in sorted(referenced - existing):
        errors.append(f"asset referenced but missing: assets/{missing}")

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
    print(f"OK: CSS integrity clean ({len(defined)} tokens, {len(used)} used, raw-hex invariant enforced)")


if __name__ == "__main__":
    main()
