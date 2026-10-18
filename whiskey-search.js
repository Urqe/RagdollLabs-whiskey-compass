/*
 * One query engine for Explore and Compare.
 * Recognized whiskey names impose AND constraints before textual/food ranking.
 * Producer names match their actual bottles, never a similarly named region.
 */
window.WhiskeySearch = (() => {
  const normalize = value => FoodDiscovery.normalize(value).replace(/[’']/g, " ")
    .replace(/-/g, " ").replace(/\s+/g, " ").trim();

  let index;
  function searchIndex() {
    if (!index) {
      const aliases = WhiskeyCompass.getSearchRules().flatMap(rule => rule.aliases.map(alias => ({ rule, alias: normalize(alias) })))
        .sort((a, b) => b.alias.length - a.alias.length);
      const styles = Object.entries(WhiskeyCompass.getData().styles).map(([id, style]) => ({ id, names: style.name.split("/").map(normalize) }));
      const profiles = WhiskeyCompass.allPairs().map(item => ({ item, identity: identity(item), bottles: bottleText(item), haystack: haystack(item),
        style: normalize(item.style.name), region: normalize(item.region.name), country: normalize(item.region.country) }));
      index = { aliases, styles, profiles };
    }
    return index;
  }
  document.addEventListener("whiskeycompass:data-loaded", () => { index = null; });

  function parse(rawQuery) {
    let remainder = ` ${normalize(rawQuery)} `;
    const constraints = [];
    // Longest phrases win, so "sparkling wines" is not partly consumed as "sparkling".
    const { aliases } = searchIndex();
    const producerSpans = [];
    for (const { rule, alias } of aliases) {
      const phrase = ` ${alias} `;
      if (!remainder.includes(phrase)) continue;
      if (!constraints.some(item => item.id === rule.id)) constraints.push(rule);
      if (rule.producer) {
        // Producer/bottle names must not be consumed by shorter geographic aliases
        // ("highland park" must never trigger a "highlands" region constraint).
        // Protect the span with a placeholder, then restore it for ranking text.
        const token = ` \u0000${producerSpans.length}\u0000 `;
        producerSpans.push(normalize(rule.label || phrase.trim()));
        remainder = remainder.split(phrase).join(token);
      } else {
        while (remainder.includes(phrase)) remainder = remainder.replace(phrase, " ");
      }
    }
    for (let index = 0; index < producerSpans.length; index += 1) {
      remainder = remainder.split(` \u0000${index}\u0000 `).join(` ${producerSpans[index]} `);
    }
    const rest = remainder.trim().replace(/\s+/g, " ");
    const styleIds = constraints.length ? searchIndex().styles
      .filter(style => style.names.some(name => (` ${rest} `).includes(` ${name} `)))
      .map(style => style.id) : [];
    return { constraints, styleIds, remainder: rest };
  }

  function allows(item, intent) {
    const profile = item.profile;
    return intent.styleIds.every(id => item.styleId === id) && intent.constraints.every(rule =>
      (!rule.family || item.regional.style?.family === rule.family) &&
      (!rule.families || rule.families.includes(item.regional.style?.family || item.style.family)) &&
      (!rule.regions || rule.regions.includes(item.regionId)) &&
      (!rule.countries || rule.countries.includes(item.region.country)) &&
      (!rule.badges || rule.badges.some(badge => (item.region.badges || []).includes(badge))) &&
      Object.entries(rule.minMetrics || {}).every(([key, min]) => (profile[key] || 0) >= min) &&
      Object.entries(rule.maxMetrics || {}).every(([key, max]) => (profile[key] || 0) <= max) &&
      (!rule.text || rule.text.every(term => haystack(item).includes(normalize(term)))));
  }
  function identity(item) {
    // Only the displayed style/expression is indexed here. Explanatory prose
    // must not masquerade as this expression.
    return normalize([item.style.name, item.region.name, item.region.country,
      item.regional.style?.label].filter(Boolean).join(" "));
  }
  function bottleText(item) {
    // Bottle names are deliberate entity matches, unlike prose mentions.
    return normalize((item.regional.bottles || []).flatMap(bottle => [bottle.name, bottle.note, bottle.tag]).join(" "));
  }
  function haystack(item) {
    const style = item.regional.style || {};
    const bottles = item.regional.bottles || [];
    return normalize([identity(item), item.region.climate, item.region.summary,
      item.regional.expect, ...Object.values(item.regional.notes || {}).flat(),
      ...(item.regional.pairings || []), ...(item.region.badges || []),
      ...bottles.flatMap(bottle => [bottle.name, bottle.note, bottle.tag]),
      style.family, style.cue, style.method, style.effect].filter(Boolean).join(" "));
  }
  function matchedPairings(pairings, foodQuery) {
    return (pairings || []).filter(label => FoodDiscovery.score([label], foodQuery) > 0);
  }
  async function rank(rawQuery, limit = 10) {
    if (normalize(rawQuery).length < 2) return [];
    const intent = parse(rawQuery);
    const query = intent.remainder;
    const terms = query.split(/\s+/).filter(Boolean);
    const candidates = searchIndex().profiles.filter(({item}) => allows(item, intent));
    // Pure category/origin queries need no food network request. A food query can
    // wait for aliases, but only for the bounded optional request, never guidance.
    const identityMatch = candidates.some(row => terms.every(term => row.identity.includes(term)));
    if (query && !identityMatch) await FoodDiscovery.load();
    const foodKnown = FoodDiscovery.known(query);
    return candidates.map(row => {
      const { item } = row;
      const pairingScore = query ? FoodDiscovery.score(item.regional.pairings, query) : 0;
      const text = intent.constraints.length ? `${row.identity} ${row.bottles}` : row.haystack;
      const textMatch = terms.every(term => intent.constraints.length
        ? (` ${text} `).includes(` ${term} `) : text.includes(term));
      const matched = !query || pairingScore > 0 || (!foodKnown && textMatch);
      let score = pairingScore;
      if (query && !foodKnown) {
        if (row.style.includes(query)) score += 60;
        if (row.region.includes(query)) score += 60;
        if (row.country.includes(query)) score += 50;
        score += terms.filter(term => text.includes(term)).length * 5;
      }
      return { item, matched, score, pairingScore, pairingMatch: pairingScore > 0, foodQuery: query };
    }).filter(row => row.matched)
      .sort((a, b) => b.score - a.score || a.item.region.name.localeCompare(b.item.region.name) || a.item.style.name.localeCompare(b.item.style.name))
      .slice(0, limit);
  }
  function describe(rawQuery) {
    return parse(rawQuery).constraints.map(rule => rule.label).join(" · ");
  }
  return { parse, allows, rank, describe, matchedPairings };
})();
