/*
 * RagDollLabs Whiskey Compass — Smart Discovery
 * ----------------------------------------
 * Replaces the core nearest-neighbour similar whiskey recommendations output with three distinct
 * discovery intents. Profile calculation still comes from WhiskeyCompass.allPairs();
 * this layer only chooses and explains recommendations.
 */

const SMART_METRICS = WhiskeyModel.metrics.map(metric => metric.key);

function smartDistance(a, b) {
  return Math.sqrt(SMART_METRICS.reduce((sum, key) => sum + Math.pow((a.profile[key] || 0) - (b.profile[key] || 0), 2), 0));
}

function smartCompatibilityKey(item) { return WhiskeyModel.compareGroup(item); }
function itemRegionFlavor(item) {
  if (!item) return "elsewhere";
  return item.region.name === "Islay" ? "with more sea and smoke" : `from ${item.region.name}`;
}
function smartAppearance(item) { return WhiskeyModel.cue(item); }

function smartIsDiscovery(item) {
  return Boolean(item.style.regionalSignature) || (item.region.badges || []).some(tag => ["Discovery", "Emerging region"].includes(tag));
}

function smartFlavorBridge(current, candidate) {
  // Shared traits must be pronounced in both pours (score >= 3), not merely absent.
  const AROMATIC_ORDER = ["smoke", "fruit", "oak", "sweetness", "spice", "finish", "body", "heat"];
  const pronounced = SMART_METRICS.filter(key => key !== "heat" && (current.profile[key] || 0) >= 3 && (candidate.profile[key] || 0) >= 3)
    .sort((x, y) => AROMATIC_ORDER.indexOf(x) - AROMATIC_ORDER.indexOf(y));
  const shared = pronounced.slice(0, 2).map(key => WhiskeyModel.flavorPhrase(key, "shared")).join(" and ");
  if (shared) return `Tastes similar: both are ${shared}.`;
  return "A different flavor journey — worth a detour if you're curious.";
}

function smartPick(candidates, used, predicate, score = item => item.distance) {
  return candidates
    .filter(item => !used.has(`${item.styleId}::${item.regionId}`) && predicate(item))
    .sort((a, b) => score(a) - score(b))[0] || null;
}

function smartRecommendations(current) {
  const key = smartCompatibilityKey(current);
  const candidates = WhiskeyCompass.allPairs()
    .filter(item => !(item.styleId === current.styleId && item.regionId === current.regionId))
    .map(item => ({ ...item, distance: smartDistance(current, item) }));
  const compatible = candidates.filter(item => smartCompatibilityKey(item) === key);
  const used = new Set();
  const picks = [];
  const add = (item, kind, label, reason) => {
    if (!item) return;
    used.add(`${item.styleId}::${item.regionId}`);
    picks.push({ item, kind, label, reason });
  };

  const sameStyle = smartPick(compatible, used, item => item.styleId === current.styleId);
  if (sameStyle) {
    add(sameStyle, "same-style", "Same style, different place", `Same kind of whiskey, but ${itemRegionFlavor(sameStyle)} — taste how the place changes it.`);
  }

  const sameFamily = smartPick(compatible, used, item => item.styleId !== current.styleId);
  if (sameFamily) {
    add(sameFamily, "same-group", "A different angle on the same family", `If you like this, you'll likely enjoy its ${sameFamily.style.name.toLowerCase()} cousin — ${smartFlavorBridge(current, sameFamily)}`);
  }

  const adventurous = smartPick(
    compatible,
    used,
    item => smartIsDiscovery(item) && item.styleId !== current.styleId,
    item => item.distance - (item.style.regionalSignature ? 0.35 : 0) - ((item.region.badges || []).includes("Emerging region") ? 0.2 : 0)
  );
  if (adventurous) {
    add(adventurous, "adventurous", "Something more adventurous", `From ${adventurous.region.name} — an emerging region doing things differently. ${smartFlavorBridge(current, adventurous)}`);
  }

  while (picks.length < 3) {
    const fallback = smartPick(compatible, used, () => true);
    if (!fallback) break;
    add(fallback, "similar-flavor", "Similar flavours", smartFlavorBridge(current, fallback));
  }

  return picks.slice(0, 3);
}

function smartRender(current) {
  const container = document.getElementById("similarProfiles");
  if (!container || !current) return;
  const picks = smartRecommendations(current);
  container.replaceChildren();

  for (const { item, kind, label, reason } of picks) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "similar-item smart-similar-item";
    button.dataset.style = item.styleId;
    button.dataset.region = item.regionId;
    button.dataset.discoveryKind = kind;

    const eyebrow = document.createElement("span");
    eyebrow.className = "smart-discovery-label";
    eyebrow.textContent = label;

    const title = document.createElement("strong");
    const dot = document.createElement("span");
    dot.className = `style-cue-dot ${smartAppearance(item)}`;
    dot.setAttribute("aria-hidden", "true");
    title.append(dot, document.createTextNode(item.style.name));

    const region = document.createElement("span");
    region.className = "similar-region";
    region.textContent = `${item.region.name} · ${item.region.country}`;

    const why = document.createElement("span");
    why.className = "similar-reason";
    why.textContent = reason;

    button.append(eyebrow, title, region, why);
    button.addEventListener("click", () => WhiskeyCompass.selectProfile(item.styleId, item.regionId, true));
    container.appendChild(button);
  }
}

document.addEventListener("whiskeycompass:ready", () => {
  const intro = document.querySelector(".similar-card > p.small");
  if (intro) intro.textContent = "Three ways onward: follow the same style, stay close in style, or try something more adventurous.";
});
