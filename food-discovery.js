/* Shared food vocabulary for Explore and Compare.
 * Aliases are search-only. Canonical dish names stay in profile pairings.
 * Optional data fails soft; direct pairing search always remains available.
 */
window.FoodDiscovery = (() => {
  let aliasesPromise;
  let guidancePromise;
  let aliases = {};
  let dishes = {};
  let sources = {};
  const normalize = WhiskeyModel.normalize;

  // Search vocabulary is independent of optional prose/reference enrichment.
  function load() {
    if (!aliasesPromise) {
      aliasesPromise = WhiskeyData.json(WhiskeyDataUrl("./data/food-aliases.json"), { optional: true }).then(vocabulary => {
        aliases = {};
        for (const [alias, targets] of Object.entries(vocabulary)) {
          const key = normalize(alias);
          aliases[key] = [...new Set([...(aliases[key] || []), ...targets])];
        }
        return aliases;
      });
    }
    return aliasesPromise;
  }
  function loadGuidance() {
    if (!guidancePromise) {
      guidancePromise = WhiskeyData.json(WhiskeyDataUrl("./data/food-dishes.json"), { optional: true }).then(curated => {
        dishes = curated.dishes || {};
        sources = curated.sources || {};
      });
    }
    return guidancePromise;
  }
  function terms(query) {
    const key = normalize(query);
    return [...new Set([key, ...(aliases[key] || []).map(normalize)].filter(Boolean))];
  }
  function score(pairings, query) {
    const key = normalize(query);
    if (!key) return 0;
    // Known aliases resolve only to their canonical targets. A dish containing
    // "pork" must never accidentally match every generic pork pairing.
    const targets = aliases[key]?.map(normalize);
    let best = 0;
    for (const pairing of pairings || []) {
      const value = normalize(pairing);
      if (value === key || targets?.includes(value)) best = Math.max(best, 100);
      else if (!targets && (` ${value} `).includes(` ${key} `)) best = Math.max(best, 75);
    }
    return best;
  }
  function guidance(query) {
    const targets = terms(query);
    const exact = Object.entries(dishes).find(([label]) => targets.includes(normalize(label)));
    if (!exact) return null;
    const [label, dish] = exact;
    const multiple = Object.keys(dishes).filter(name => targets.includes(normalize(name))).length > 1;
    return multiple ? { label: "Choose a preparation", guidance: "These dishes vary by broth, filling and sauce. Search a specific preparation for a closer pairing.", source: null }
      : { label, guidance: dish.guidance, source: sources[dish.source] };
  }
  function fillGuidance(slot, query) {
    slot.replaceChildren();
    const info = guidance(query);
    if (!info) return;
    const p = WhiskeyDOM.element("p", null, "food-guidance");
    p.append(WhiskeyDOM.element("strong", `${info.label}: `), document.createTextNode(info.guidance));
    if (info.source) {
      const link = WhiskeyDOM.referenceLink(info.source, " Pairing reference");
      link.setAttribute("aria-label", info.source.name);
      p.append(link);
    }
    slot.append(p);
  }
  function appendGuidance(container, query) {
    const slot = WhiskeyDOM.element("div", null, "food-guidance-slot");
    container.append(slot);
    fillGuidance(slot, query);
    // Update only the explanatory slot: preserve result buttons and keyboard focus.
    void loadGuidance().then(() => { if (slot.isConnected) fillGuidance(slot, query); });
  }
  return { load, loadGuidance, normalize, terms, score, guidance, appendGuidance,
    known: query => Boolean(aliases[normalize(query)]) };
})();
