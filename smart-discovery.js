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

// Any-vs-any comparison: candidates are all profiles; distance ordering
// keeps the nearest (most similar) picks first without a group filter.
function itemRegionFlavor(current, item) {
  // Explanations derive from the expressions' actual scores, never from geography.
  if (!item) return "elsewhere";
  const contrasts = [];
  const smokeDiff = (item.profile.smoke || 0) - (current.profile.smoke || 0);
  if (smokeDiff >= 1.5) contrasts.push("noticeably smokier");
  else if (smokeDiff <= -1.5) contrasts.push("cleaner, with less smoke");
  const bodyDiff = (item.profile.body || 0) - (current.profile.body || 0);
  if (bodyDiff >= 1.5) contrasts.push("fuller-bodied");
  else if (bodyDiff <= -1.5) contrasts.push("lighter");
  const oakDiff = (item.profile.oak || 0) - (current.profile.oak || 0);
  if (oakDiff >= 1.5) contrasts.push("more oak-driven");
  const sweetDiff = (item.profile.sweetness || 0) - (current.profile.sweetness || 0);
  if (sweetDiff >= 1.5) contrasts.push("sweeter");
  const descriptor = contrasts.length ? contrasts.slice(0, 2).join(" and ") : "a different regional character";
  return `from ${item.region.name}, ${descriptor}`;
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
  const candidates = WhiskeyCompass.allPairs()
    .filter(item => !(item.styleId === current.styleId && item.regionId === current.regionId))
    .map(item => ({ ...item, distance: smartDistance(current, item) }));
  const compatible = candidates;
  const used = new Set();
  const picks = [];
  const add = (item, kind, label, reason) => {
    if (!item) return;
    used.add(`${item.styleId}::${item.regionId}`);
    picks.push({ item, kind, label, reason });
  };

  const sameStyle = smartPick(compatible, used, item => item.styleId === current.styleId);
  if (sameStyle) {
    add(sameStyle, "same-style", "Same style, different place", `Same kind of whiskey, but ${itemRegionFlavor(current, sameStyle)} — taste how the place changes it.`);
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
