/*
 * Unified, accent-insensitive Atlas search
 * ----------------------------------------
 * One Explore search handles styles, places, styles and food. When a query
 * resolves through the validated food-alias vocabulary, pairing relevance gets
 * an explicit ranking boost instead of requiring a second food-only input.
 */

function atlasNormalize(value) { return FoodDiscovery.normalize(value); }
function atlasLoadFoodAliases() { return FoodDiscovery.load(); }
function atlasPairingScore(pairings, query) { return FoodDiscovery.score(pairings, query); }

async function renderEnhancedAtlasSearch() {
  const input = document.getElementById("searchInput");
  const container = document.getElementById("searchResults");
  if (!input || !container) return;
  const rawQuery = input.value.trim();
  const query = atlasNormalize(rawQuery);
  container.replaceChildren();
  if (query.length < 2) return;

  const matches = await WhiskeySearch.rank(rawQuery, 10);
  if (input.value.trim() !== rawQuery) return;
  const foodQuery = WhiskeySearch.parse(rawQuery).remainder;
  const aliasKnown = FoodDiscovery.known(foodQuery);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No matching profiles yet.";
    container.appendChild(empty);
    return;
  }

  if (aliasKnown || matches[0]?.pairingScore > 0) {
    const label = document.createElement("div");
    label.className = "search-empty";
    label.textContent = `Pairs well with “${rawQuery}”`;
    container.appendChild(label);
  }

  const searchContext = WhiskeySearch.describe(rawQuery);
  if (searchContext) {
    const context = document.createElement("div");
    context.className = "search-empty";
    context.textContent = `Narrowed to ${searchContext}`;
    container.append(context);
  }
  FoodDiscovery.appendGuidance(container, foodQuery);

  for (const { item, pairingScore } of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.dataset.style = item.styleId;
    button.dataset.region = item.regionId;
    const title = document.createElement("strong");
    const dot = document.createElement("span");
    const displayCue = item.regional.style?.cue || item.style.cue;
    dot.className = `style-cue-dot ${displayCue}`;
    dot.setAttribute("aria-hidden", "true");
    title.append(dot, document.createTextNode(`${item.style.name} · ${item.region.name}`));
    const meta = document.createElement("span");
    const styleLabel = item.regional.style?.label ? ` · ${item.regional.style.label}` : "";
    meta.textContent = pairingScore > 0
      ? `${item.region.country} · pairs with ${WhiskeySearch.matchedPairings(item.regional.pairings, foodQuery).join(" · ")}`
      : `${item.region.country} · ${item.region.climate}${styleLabel}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      WhiskeyCompass.selectProfile(item.styleId, item.regionId, true);
      input.value = "";
      container.replaceChildren();
    });
    container.appendChild(button);
  }
}

document.addEventListener("whiskeycompass:ready", () => {
  void atlasLoadFoodAliases();
  void FoodDiscovery.loadGuidance();
  // app.js owns the input handler and delegates here; avoid two renderers racing.
});
