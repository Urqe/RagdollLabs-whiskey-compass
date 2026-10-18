#!/usr/bin/env python3
"""Static integrity checks for RagDollLabs Whiskey Compass.

The validator intentionally tests data contracts rather than tasting opinions:
JSON parsing, duplicate IDs, style/source references, locator coverage, explicit
why metadata, bottle metadata, production metadata, maturity metadata, glossary
metadata and required profile fields.

Keeping this dependency-free lets reviewers run it locally and keeps CI lightweight.
"""
from __future__ import annotations

import json
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

REGION_FILES = [
    DATA / "regions-classics-scotland.json",
    DATA / "regions-classics-world.json",
    DATA / "regions-discovery.json",
]

REQUIRED_PROFILE_FIELDS = {"notes", "serve", "dilution", "ice", "glass", "ageing", "pairings", "expect"}
METRICS = {"body", "smoke", "sweetness", "spice", "fruit", "oak", "finish", "heat"}
PRODUCTION_PREVALENCE = {"dominant", "very common", "common", "sometimes", "rare"}
MATURITY_STAGE_PREFIXES = ("Young", "Developing", "Mature")
STYLE_FAMILIES = {"malt", "bourbon", "rye", "wheat", "pot-still", "blended", "corn", "tennessee"}
STYLE_CUES = {"malt", "bourbon", "rye", "wheat", "pot-still", "blended", "corn", "tennessee"}


def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def valid_reference_url(value) -> bool:
    if not isinstance(value, str) or any(ord(c) < 32 or ord(c) == 127 for c in value):
        return False
    try:
        url = urlsplit(value)
        _ = url.port  # Reject malformed ports as the browser URL parser would.
        return url.scheme == "https" and bool(url.hostname) and not url.username and not url.password
    except ValueError:
        return False



def food_key_check(alias, label, aliases):
    for targets in aliases.values():
        if alias in targets and label in targets:
            return True
    return False

def main() -> None:
    styles = load(DATA / "styles.json")
    sources = load(DATA / "sources.json")
    for source_id, source in sources.items():
        assert source.get("name") and valid_reference_url(source.get("url")), f"invalid HTTPS reference: {source_id}"

    locators = load(DATA / "locators.json")
    why_rules = load(DATA / "why-rules.json")
    food_aliases = load(DATA / "food-aliases.json")
    production = load(DATA / "production.json")
    maturity = load(DATA / "maturity.json")
    glossary = load(DATA / "glossary.json")

    regions: dict[str, dict] = {}
    for path in REGION_FILES:
        group = load(path)
        for region_id, region in group.items():
            assert region_id not in regions, f"duplicate region id: {region_id}"
            regions[region_id] = region
    assert regions, "no regions loaded"
    assert styles, "no style families loaded"

    for style_id, style in styles.items():
        assert style.get("cue") in STYLE_CUES, f"{style_id}: missing/invalid cue"
        assert style.get("family") in STYLE_FAMILIES, f"{style_id}: missing/invalid family"
        assert isinstance(style.get("regionalSignature"), bool), f"{style_id}: regionalSignature must be boolean"
        for metric in METRICS:
            value = style.get(metric)
            assert isinstance(value, (int, float)) and 0 <= value <= 5, f"{style_id}: invalid {metric}"

    search_rules = load(DATA / "whiskey-search.json")["rules"]
    rule_ids = set()
    for rule in search_rules:
        assert rule["id"] not in rule_ids, "duplicate whiskey search rule"
        rule_ids.add(rule["id"])
        assert rule["label"] and rule["aliases"], f"{rule['id']}: label and aliases required"
        for rid in rule.get("regions", []):
            assert rid in regions, f"whiskey search: unknown region {rid}"
        if "family" in rule:
            assert rule["family"] in STYLE_FAMILIES, f"{rule['id']}: invalid family"

    bottle_count = 0
    pairing_values: set[str] = set()
    for region_id, region in regions.items():
        assert region_id in locators, f"{region_id}: missing locator"
        assert region.get("name") and region.get("country") and region.get("climate"), f"{region_id}: incomplete identity"
        assert region.get("styles"), f"{region_id}: no style profiles"
        for source_id in region.get("sources", []):
            assert source_id in sources, f"{region_id}: unknown source {source_id}"
        for style_id, profile in region["styles"].items():
            prefix = f"{region_id}/{style_id}"
            assert style_id in styles, f"{region_id}: unknown style family {style_id}"
            missing = REQUIRED_PROFILE_FIELDS - profile.keys()
            assert not missing, f"{prefix}: missing {sorted(missing)}"
            pairings = profile.get("pairings")
            assert isinstance(pairings, list) and pairings, f"{prefix}: pairings must be a non-empty list"
            for pairing in pairings:
                assert isinstance(pairing, str) and pairing.strip(), f"{prefix}: invalid pairing"
                assert pairing == pairing.lower(), f"{prefix}: pairing label must be lowercase: {pairing}"
                pairing_values.add(pairing.casefold().strip())
            for metric, modifier in profile.get("mods", {}).items():
                assert metric in METRICS, f"{prefix}: unknown modifier {metric}"
                assert isinstance(modifier, (int, float)), f"{prefix}: non-numeric modifier {metric}"
            style_meta = profile.get("style")
            assert isinstance(style_meta, dict), f"{prefix}: style metadata required"
            assert style_meta.get("family") in STYLE_FAMILIES, f"{prefix}: invalid style family"
            assert style_meta.get("cue") in STYLE_CUES, f"{prefix}: invalid style cue"
            for field in ("cue", "label", "method", "effect"):
                assert isinstance(style_meta.get(field), str) and style_meta[field].strip(), f"{prefix}: invalid style {field}"
            bottles = profile.get("bottles")
            assert isinstance(bottles, list) and bottles, f"{prefix}: bottles must be a non-empty list"
            for bottle in bottles:
                bottle_count += 1
                bprefix = f"{prefix}/bottles/{bottle.get('name')}"
                assert isinstance(bottle.get("name"), str) and bottle["name"].strip(), f"{prefix}: bottle name required"
                assert isinstance(bottle.get("note"), str) and bottle["note"].strip(), f"{bprefix}: note required"
                assert isinstance(bottle.get("tag"), str) and bottle["tag"].strip(), f"{bprefix}: tag required"

    for alias, targets in food_aliases.items():
        assert isinstance(alias, str) and alias.strip(), "food aliases: alias keys must be non-empty strings"
        assert isinstance(targets, list) and targets, f"food aliases/{alias}: targets must be a non-empty list"
        for target in targets:
            assert isinstance(target, str) and target.strip(), f"food aliases/{alias}: invalid target"

    for region_id, rules in why_rules.items():
        assert region_id in regions, f"why-rules: unknown region {region_id}"
        why_items = regions[region_id].get("why") or []
        assert isinstance(rules, dict), f"why-rules/{region_id}: rules must be an object"
        for raw_index, rule in rules.items():
            assert str(raw_index).isdigit(), f"why-rules/{region_id}: invalid index {raw_index}"
            index = int(raw_index)
            assert 0 <= index < len(why_items), f"why-rules/{region_id}: index {index} out of range"
            assert isinstance(rule, dict), f"why-rules/{region_id}/{index}: rule must be an object"
            if "effect" in rule:
                assert isinstance(rule["effect"], str) and rule["effect"].strip(), f"why-rules/{region_id}/{index}: invalid effect"

    assert isinstance(production, dict), "production data must be an object"
    for region_id, style_entries in production.items():
        assert region_id in regions, f"production: unknown region {region_id}"
        for style_id, entry in style_entries.items():
            assert style_id in regions[region_id]["styles"], f"production/{region_id}: unknown profile style {style_id}"
            choices = entry.get("choices")
            assert isinstance(choices, list) and choices, f"production/{region_id}/{style_id}: choices must be non-empty"
            for source_id in entry.get("sources", []):
                assert source_id in sources, f"production/{region_id}/{style_id}: unknown source {source_id}"
            for index, choice in enumerate(choices):
                prefix = f"production/{region_id}/{style_id}/{index}"
                assert isinstance(choice.get("vessel"), str) and choice["vessel"].strip(), f"{prefix}: invalid vessel"
                assert choice.get("prevalence") in PRODUCTION_PREVALENCE, f"{prefix}: invalid prevalence"
                assert isinstance(choice.get("effect"), str) and choice["effect"].strip(), f"{prefix}: invalid effect"

    assert isinstance(maturity, dict), "maturity data must be an object"
    for region_id, style_entries in maturity.items():
        assert region_id in regions, f"maturity: unknown region {region_id}"
        for style_id, entry in style_entries.items():
            prefix = f"maturity/{region_id}/{style_id}"
            assert style_id in regions[region_id]["styles"], f"{prefix}: unknown profile style"
            assert isinstance(entry.get("summary"), str) and entry["summary"].strip(), f"{prefix}: invalid summary"
            assert isinstance(entry.get("vintage"), str) and entry["vintage"].strip(), f"{prefix}: invalid vintage note"
            stages = entry.get("stages")
            assert isinstance(stages, list) and len(stages) == 3, f"{prefix}: stages must contain Young, Developing and Mature"
            for stage, expected in zip(stages, MATURITY_STAGE_PREFIXES):
                assert stage.get("label", "").startswith(expected), f"{prefix}: invalid stage order"
                assert isinstance(stage.get("effect"), str) and stage["effect"].strip(), f"{prefix}: invalid {expected} effect"

    assert isinstance(glossary, dict) and glossary, "glossary data must be a non-empty object"
    aliases_seen: dict[str, str] = {}
    for glossary_id, entry in glossary.items():
        prefix = f"glossary/{glossary_id}"
        assert isinstance(entry, dict), f"{prefix}: entry must be an object"
        for field in ("term", "definition", "why"):
            assert isinstance(entry.get(field), str) and entry[field].strip(), f"{prefix}: invalid {field}"
        aliases = entry.get("aliases")
        assert isinstance(aliases, list) and aliases, f"{prefix}: aliases must be non-empty"
        if "inline" in entry:
            assert isinstance(entry["inline"], bool), f"{prefix}: inline must be boolean"
        source_ids = entry.get("sources")
        assert isinstance(source_ids, list) and source_ids, f"{prefix}: sources must be non-empty"
        for source_id in source_ids:
            assert source_id in sources, f"{prefix}: unknown source {source_id}"
        for alias in [entry["term"], *aliases]:
            normalized = alias.casefold().strip()
            previous = aliases_seen.get(normalized)
            assert previous in {None, glossary_id}, f"{prefix}: alias {alias!r} already belongs to {previous}"
            aliases_seen[normalized] = glossary_id

    extra_locators = set(locators) - set(regions)
    assert not extra_locators, f"locator entries without regions: {sorted(extra_locators)}"

    # Governance: every region needs at least two distinct sources, and every
    # profile-level source ID must resolve against sources.json.
    for region_id, region in regions.items():
        region_sources = set(region.get("sources", []))
        assert len(region_sources) >= 2, f"{region_id}: needs at least 2 region-level sources (governance rule)"
        for source_id in region_sources:
            assert source_id in sources, f"{region_id}: unknown region source {source_id}"
        for style_id, profile in region["styles"].items():
            for source_id in profile.get("sources", []):
                assert source_id in sources, f"{region_id}/{style_id}: unknown profile source {source_id}"

    # Governance: combined metric scores (base + mods) must stay within 0-5 before clamping.
    for region_id, region in regions.items():
        for style_id, profile in region["styles"].items():
            for metric, modifier in profile.get("mods", {}).items():
                combined = styles[style_id][metric] + modifier
                assert 0 <= combined <= 5, f"{region_id}/{style_id}: combined {metric} score {combined} out of range before clamping — recalibrate base or mod"

    # Governance: no absolute serving/maturation directives in profile fields.
    # Contextual absolutes inside historical or legal statements are allowed via the whitelist.
    ABSOLUTE_PATTERNS = ["always dilute", "never dilute", "must dilute", "avoid ice", "never add"]
    for region_id, region in regions.items():
        for style_id, profile in region["styles"].items():
            for field in ("serve", "dilution", "ice", "ageing"):
                value = str(profile.get(field, "")).lower()
                for pattern in ABSOLUTE_PATTERNS:
                    assert pattern not in value, f"{region_id}/{style_id}.{field}: absolute directive '{pattern}' not allowed — qualify the advice"

    # Semantic coverage: every style family must have at least one regional profile.
    profile_styles: set[str] = set()
    for region in regions.values():
        profile_styles.update(region["styles"].keys())
    orphan_styles = set(styles) - profile_styles
    assert not orphan_styles, f"style families with no regional profiles: {sorted(orphan_styles)}"

    # Semantic satisfiability: every search rule must match at least one profile.
    metric_keys = METRICS
    for rule in search_rules:
        satisfied = False
        for region_id, region in regions.items():
            for style_id, profile in region["styles"].items():
                base = styles[style_id]
                combined = {key: max(0, min(5, (base.get(key, 0) or 0) + (profile.get("mods", {}).get(key, 0) or 0))) for key in metric_keys}
                item_ok = (
                    (not rule.get("regions") or region_id in rule["regions"])
                    and (not rule.get("countries") or region.get("country") in rule["countries"])
                    and (not rule.get("families") or profile.get("style", {}).get("family") in rule["families"])
                    and (not rule.get("badges") or any(badge in (region.get("badges") or []) for badge in rule["badges"]))
                    and all(combined[key] >= minimum for key, minimum in (rule.get("minMetrics") or {}).items())
                    and all(combined[key] <= maximum for key, maximum in (rule.get("maxMetrics") or {}).items())
                )
                if item_ok:
                    satisfied = True
                    break
            if satisfied:
                break
        assert satisfied, f"search rule matches no profile: {rule['id']}"

    # Dish guidance must be complete: the guidance UI renders these fields verbatim.
    food_dishes = load(DATA / "food-dishes.json")
    pairing_values_final = pairing_values
    for label, dish in food_dishes["dishes"].items():
        assert dish.get("guidance") and dish["guidance"].strip(), f"dish missing guidance: {label}"
        assert dish.get("source") in food_dishes["sources"], f"dish with unknown source: {label}"
        assert label in food_aliases, f"dish without an alias entry: {label}"
        for alias in dish["aliases"]:
            assert label in food_aliases.get(alias, []) or alias in food_aliases.get(label, []) or food_key_check(alias, label, food_aliases), f"dish alias unresolved: {alias}"

    profile_count = sum(len(region["styles"]) for region in regions.values())
    print(
        f"OK: {len(styles)} style families, {len(regions)} regions, {profile_count} profiles, "
        f"{bottle_count} notable bottles, {len(glossary)} glossary terms"
    )


if __name__ == "__main__":
    main()
