/*
 * RagDollLabs Whiskey Compass — Compare discovery
 * ------------------------------------------
 * Compare is its own workspace. Explore-only search/navigation is hidden while
 * Compare is active, and this module turns search terms (including foods) into
 * candidates that fill the Advanced Compare slots instead of navigating away.
 *
 * WhiskeyModel supplies compatibility; WhiskeyComparison owns selections. This layer
 * finds candidates and sends atomic selection commands, then reacts to changes.
 */

let compareDiscoveryMatches = [];

function compareNormalize(value) { return FoodDiscovery.normalize(value); }

function compareProfileKey(item) {
  return `${item.styleId}::${item.regionId}`;
}

function compareAdvancedReady() {
  return typeof window.advancedCompatible === "function" &&
    document.getElementById("advancedCompare1");
}

function compareCurrentProfiles() { return WhiskeyComparison.profiles(); }
function compareSetProfiles(profiles) { WhiskeyComparison.replace(profiles); }

function compareProfileLabel(item) {
  const style = item.regional.style?.label;
  return `${item.style.name} · ${item.region.name}${style ? ` · ${style}` : ""}`;
}

async function rankCompareMatches(rawQuery) {
  return WhiskeySearch.rank(rawQuery, 12);
}

function compareCanAdd(item) {
  if (!compareAdvancedReady()) return { allowed: false, reason: "Compare is still loading" };
  const current = compareCurrentProfiles();
  const key = compareProfileKey(item);
  if (current.some(profile => compareProfileKey(profile) === key)) return { allowed: false, reason: "Added" };
  if (current.length >= 3) return { allowed: false, reason: "Comparison full" };
  if (current[0] && !WhiskeyModel.compatible(current[0], item)) return { allowed: false, reason: "Different comparison style" };
  return { allowed: true, reason: "Add" };
}

function compareRenderResults() {
  const container = document.getElementById("compareDiscoveryResults");
  const topButton = document.getElementById("compareTopMatches");
  if (!container || !topButton) return;
  container.replaceChildren();

  if (!compareDiscoveryMatches.length) {
    topButton.classList.add("hidden");
    return;
  }

  FoodDiscovery.appendGuidance(container, WhiskeySearch.parse(document.getElementById("compareDiscoveryInput")?.value).remainder);

  for (const result of compareDiscoveryMatches) {
    const { item, pairingMatch, foodQuery } = result;
    const state = compareCanAdd(item);
    const row = document.createElement("div");
    row.className = "compare-discovery-result";
    const copy = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = compareProfileLabel(item);
    const meta = document.createElement("span");
    meta.textContent = `${item.region.country}${pairingMatch ? ` · pairs with ${WhiskeySearch.matchedPairings(item.regional.pairings, foodQuery).join(" · ")}` : ""}`;
    copy.append(strong, meta);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = state.reason;
    button.disabled = !state.allowed;
    button.dataset.profileKey = compareProfileKey(item);
    row.append(copy, button);
    container.appendChild(row);
  }

  const best = compareDiscoveryMatches[0]?.item;
  const compatibleCount = best && compareAdvancedReady()
    ? compareDiscoveryMatches.filter(result => WhiskeyModel.compatible(best, result.item)).length
    : 0;
  topButton.classList.toggle("hidden", compatibleCount < 2);
  topButton.disabled = compatibleCount < 2;
}

async function compareRunDiscovery() {
  const input = document.getElementById("compareDiscoveryInput");
  const container = document.getElementById("compareDiscoveryResults");
  if (!input || !container) return;
  const query = input.value.trim();
  if (compareNormalize(query).length < 2) {
    compareDiscoveryMatches = [];
    container.replaceChildren();
    document.getElementById("compareTopMatches")?.classList.add("hidden");
    return;
  }
  const matches = await rankCompareMatches(query);
  if (input.value.trim() !== query) return;
  compareDiscoveryMatches = matches;
  compareRenderResults();
  if (!compareDiscoveryMatches.length) {
    const empty = document.createElement("div");
    empty.className = "compare-discovery-empty";
    empty.textContent = "No comparison candidates found.";
    container.appendChild(empty);
  }
}

function compareAddProfile(item) {
  if (!compareCanAdd(item).allowed) return;
  compareSetProfiles([...compareCurrentProfiles(), item]);
}

function compareFillTopMatches() {
  if (!compareAdvancedReady() || !compareDiscoveryMatches.length) return;
  const first = compareDiscoveryMatches[0].item;
  const compatible = compareDiscoveryMatches
    .map(result => result.item)
    .filter(item => WhiskeyModel.compatible(first, item))
    .slice(0, 3);
  if (compatible.length < 2) return;
  compareSetProfiles(compatible);
}

function compareDiscoveryClick(event) {
  const add = event.target.closest?.("button[data-profile-key]");
  if (add) {
    const result = compareDiscoveryMatches.find(entry => compareProfileKey(entry.item) === add.dataset.profileKey);
    if (result) compareAddProfile(result.item);
    return;
  }
  if (event.target.closest?.("#compareTopMatches")) compareFillTopMatches();
}

function injectCompareDiscovery() {
  const controls = document.getElementById("advancedCompareControls");
  if (!controls || document.getElementById("compareDiscovery")) return;
  const panel = document.createElement("section");
  panel.id = "compareDiscovery";
  panel.className = "compare-discovery";
  panel.innerHTML = `
    <h3>Find whiskeys to compare</h3>
    <p class="small">Search by style, place, region or food. Add candidates individually, or let Whiskey Compass build a compatible comparison from the best matches.</p>
    <label for="compareDiscoveryInput">Search comparison candidates</label>
    <input id="compareDiscoveryInput" type="search" autocomplete="off" placeholder="Try ‘Islay’, ‘bourbon’, ‘peat’ or ‘Speyside’" aria-controls="compareDiscoveryResults">
    <div id="compareDiscoveryResults" class="compare-discovery-results" aria-label="Comparison search results"></div>
    <button id="compareTopMatches" class="compare-top-matches hidden" type="button">Compare top 3 compatible matches</button>`;
  controls.prepend(panel);
  document.getElementById("compareDiscoveryInput")?.addEventListener("input", compareRunDiscovery);
  panel.addEventListener("click", compareDiscoveryClick);
}

function setCompareWorkspaceMode(mode) {
  const comparing = mode === "compare";
  document.getElementById("searchSection")?.classList.toggle("hidden", comparing);
  if (!comparing) {
    const input = document.getElementById("compareDiscoveryInput");
    if (input) input.value = "";
    compareDiscoveryMatches = [];
    document.getElementById("compareDiscoveryResults")?.replaceChildren();
    document.getElementById("compareTopMatches")?.classList.add("hidden");
  }
}

document.addEventListener("whiskeycompass:ready", () => {
  injectCompareDiscovery();
});

document.addEventListener("whiskeycompass:mode-changed", event => {
  setCompareWorkspaceMode(event.detail.mode);
  if (event.detail.mode === "compare") {
    injectCompareDiscovery();
    document.getElementById("compareDiscoveryInput")?.focus();
  }
});

document.addEventListener("whiskeycompass:comparison-changed", () => {
  if (document.getElementById("compareDiscoveryResults")) compareRenderResults();
});
