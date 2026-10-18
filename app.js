/*
 * RagDollLabs Whiskey Compass application logic
 * ----------------------------------------
 * Core responsibilities live here: data loading, guarded profile lookup,
 * profile rendering, comparison, search, discovery and URL state.
 *
 * UX layers integrate through explicit `whiskeycompass:*` CustomEvents instead of
 * polling globals or replacing core functions. This keeps progressive
 * enhancements optional without making their failure silent or mysterious.
 */

const METRICS = WhiskeyModel.metrics;
const COMPARE_METRICS = METRICS.filter(metric => metric.compare);
const MIN_MEANINGFUL_SPREAD = 0.5;
const DISCOVERY_WEIGHT = 3;
const CLASSIC_WEIGHT = 1;
const INITIAL_ROUTE = new URL(window.location.href);

const MOODS = [
  { id: "light-delicate", label: "Light & delicate", hint: "Soft, sippable and gentle", test: ({ profile }) => profile.body <= 2.5 && profile.smoke <= 1.5 },
  { id: "big-rich", label: "Big & rich", hint: "Dried fruit, chocolate and weight", test: ({ profile }) => profile.body >= 4 && profile.oak >= 3.5 && profile.fruit >= 3 },
  { id: "smoky-briny", label: "Smoky & briny", hint: "Bonfires, iodine and sea air", test: ({ profile }) => profile.smoke >= 3.5 },
  { id: "sweet-sherried", label: "Sweet & sherried", hint: "Honey, raisins and cocoa", test: ({ profile }) => profile.sweetness >= 3 && profile.fruit >= 3 },
  { id: "spicy-bold", label: "Spicy & bold", hint: "Pepper, rye bite and warmth", test: ({ profile }) => profile.spice >= 3.5 },
  { id: "something-unusual", label: "Something unusual", hint: "Off the beaten path: India, Taiwan, England", test: ({ style, region }) => Boolean(style.regionalSignature) || (region.badges || []).some(tag => ["Discovery", "Emerging region"].includes(tag)) }
];

const NOTE_ICONS = {
  "Fruit": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="14" r="5"/><circle cx="15.5" cy="10.5" r="4"/><path d="M12 5c1.5-2 4-2 5-1.5-.5 2-2.5 3-5 1.5z"/></svg>',
  "Floral": '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 4c1 2 1 4 0 5-1-1-1-3 0-5zM12 15c1 2 1 4 0 5-1-1-1-3 0-5zM4 12c2-1 4-1 5 0-1 1-3 1-5 0zM15 12c2-1 4-1 5 0-1 1-3 1-5 0z"/></svg>',
  "Spice": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/></svg>',
  "Earth / savory": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-6 3-9 7-9 1 3-1 4-1 6 0 1.5 1 2.5 3 3-2 1-9 1-9 0z"/></svg>',
  "Oak / ageing": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v3c0 5-2 8-6 13-4-5-6-8-6-13z"/></svg>',
  "Mineral / herbal": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20l5-9 5 9z"/></svg>'
};
const DEFAULT_NOTE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke-width="1.5"/></svg>';

let STYLES = {};
let REGIONS = {};
let SEARCH_RULES = [];
let SOURCES = {};
let LOCATORS = {};
let WHY_RULES = {};
let PAIR_CACHE = null;
let lastSurprise = null;
let browseMethod = "place";
let currentProfile = null;

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const byName = ([, a], [, b]) => a.name.localeCompare(b.name);

/* Entity encoder for HTML text and quoted ordinary attributes ONLY.
 * Not a sanitizer or a URL/CSS/JavaScript encoder. Prefer WhiskeyDOM for new UI. */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
/*
 * All current template attributes are quoted. escapeHtml already escapes both
 * quote characters plus &, < and >, so escapeAttr intentionally documents the
 * context rather than maintaining a second escaping algorithm.
 */
function escapeAttr(value) { return escapeHtml(value); }
function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(`whiskeycompass:${name}`, { detail }));
}

async function loadData() {
  const paths = [
    "./data/styles.json",
    "./data/regions-classics-scotland.json",
    "./data/regions-classics-world.json",
    "./data/regions-discovery.json",
    "./data/sources.json",
    "./data/locators.json",
    "./data/why-rules.json",
    "./data/whiskey-search.json"
  ];
  const [styles, classicScotland, classicWorld, discovery, sources, locators, whyRules, whiskeySearch] = await Promise.all(paths.map(path => WhiskeyData.json(path)));
  const regionGroups = [classicScotland, classicWorld, discovery];
  const seen = new Set();
  for (const group of regionGroups) {
    for (const id of Object.keys(group)) {
      if (seen.has(id)) throw new Error(`Duplicate region id across data files: ${id}`);
      seen.add(id);
    }
  }
  STYLES = styles;
  REGIONS = Object.assign({}, ...regionGroups);
  SOURCES = sources;
  LOCATORS = locators;
  WHY_RULES = whyRules;
  SEARCH_RULES = whiskeySearch.rules;
  PAIR_CACHE = null;
  emit("data-loaded");
}

function relevantRegions(styleId) {
  return Object.entries(REGIONS).filter(([, region]) => region.styles?.[styleId]).sort(byName);
}

function combinedProfile(styleId, regionId) {
  const style = STYLES[styleId];
  const region = REGIONS[regionId];
  const regional = region?.styles?.[styleId];
  if (!style || !region || !regional) return null;
  const profile = { ...style };
  for (const [key, modifier] of Object.entries(regional.mods || {})) {
    profile[key] = clamp((profile[key] || 0) + modifier, 0, 5);
  }
  return { styleId, regionId, style, region, regional, profile };
}

/* Whiskey data is immutable after load, so profile pairs are safely memoized. */
function allPairs() {
  if (PAIR_CACHE) return PAIR_CACHE;
  const pairs = [];
  for (const [regionId, region] of Object.entries(REGIONS)) {
    for (const styleId of Object.keys(region.styles || {})) {
      const item = combinedProfile(styleId, regionId);
      if (item) pairs.push(item);
    }
  }
  PAIR_CACHE = pairs;
  return PAIR_CACHE;
}

/* No-enhancement fallback: legacy Compare option builder; exercised by tests. */
function optionMarkup(entries, includeCountry = false) {
  return entries.map(([id, item]) => {
    const label = includeCountry && item.country ? `${item.name} · ${item.country}` : item.name;
    return `<option value="${escapeAttr(id)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function setSelectOptions(select, entries, includeCountry = false) {
  select.replaceChildren(...entries.map(([id, item]) => {
    const label = includeCountry && item.country ? `${item.name} · ${item.country}` : item.name;
    const option = WhiskeyDOM.element("option", label);
    option.value = id;
    return option;
  }));
}

function prependPlaceholder(select, text) {
  let option = [...select.options].find(item => item.dataset.placeholder === "true");
  if (!option) {
    option = document.createElement("option");
    option.value = "";
    option.disabled = true;
    option.dataset.placeholder = "true";
    select.prepend(option);
  }
  option.textContent = text;
  select.value = "";
}

function populateStyles() {
  const entries = Object.entries(STYLES).sort(byName);
  setSelectOptions($("style"), entries);
  setSelectOptions($("cg"), entries);
  const initial = entries[0]?.[0] || "";
  $("style").value = initial;
  $("cg").value = initial;
}

function fillExploreRegions(styleId, preferredRegion = null, withPlaceholder = false) {
  const entries = relevantRegions(styleId);
  setSelectOptions($("region"), entries, true);
  if (preferredRegion && entries.some(([id]) => id === preferredRegion)) {
    $("region").value = preferredRegion;
  } else if (withPlaceholder && entries.length > 1) {
    prependPlaceholder($("region"), "Choose a region…");
  } else if (entries[0]) {
    $("region").value = entries[0][0];
  }
  return entries;
}

function populateCountries(preferredCountry = null, withPlaceholder = false) {
  const countries = [...new Set(Object.values(REGIONS).map(region => region.country))].sort((a, b) => a.localeCompare(b));
  setSelectOptions($("country"), countries.map(country => [country, { name: country }]));
  if (preferredCountry && countries.includes(preferredCountry)) $("country").value = preferredCountry;
  else if (withPlaceholder) prependPlaceholder($("country"), "Choose a country…");
  else if (countries[0]) $("country").value = countries[0];
  return countries;
}

function populatePlaceRegions(preferredRegion = null, withPlaceholder = false) {
  const country = $("country").value;
  const entries = Object.entries(REGIONS).filter(([, region]) => region.country === country).sort(byName);
  setSelectOptions($("placeRegion"), entries);
  if (preferredRegion && entries.some(([id]) => id === preferredRegion)) $("placeRegion").value = preferredRegion;
  else if (withPlaceholder && entries.length > 1) prependPlaceholder($("placeRegion"), "Choose a region…");
  else if (entries[0]) $("placeRegion").value = entries[0][0];
  return entries;
}

function populatePlaceStyles(preferredStyle = null, withPlaceholder = false) {
  const region = REGIONS[$("placeRegion").value];
  const entries = Object.keys(region?.styles || {}).map(id => [id, STYLES[id]]).filter(([, style]) => style).sort(byName);
  setSelectOptions($("placeStyle"), entries);
  if (preferredStyle && entries.some(([id]) => id === preferredStyle)) $("placeStyle").value = preferredStyle;
  else if (withPlaceholder && entries.length > 1) prependPlaceholder($("placeStyle"), "Choose a style…");
  else if (entries[0]) $("placeStyle").value = entries[0][0];
  return entries;
}

function syncPlaceControls(styleId, regionId) {
  const region = REGIONS[regionId];
  if (!region) return;
  populateCountries(region.country, false);
  populatePlaceRegions(regionId, false);
  populatePlaceStyles(styleId, false);
}

function setBrowseMethod(method) {
  browseMethod = method;
  const styleMode = method === "style";
  $("browseByStyle").classList.toggle("on", styleMode);
  $("browseByPlace").classList.toggle("on", !styleMode);
  $("browseByStyle").setAttribute("aria-pressed", String(styleMode));
  $("browseByPlace").setAttribute("aria-pressed", String(!styleMode));
  $("styleBrowseControls").classList.toggle("hidden", !styleMode);
  $("placeBrowseControls").classList.toggle("hidden", styleMode);
  if (!styleMode && currentProfile) syncPlaceControls(currentProfile.styleId, currentProfile.regionId);
}

function formatScore(value) { return value.toFixed(value % 1 ? 1 : 0); }
function metricBar(metric, profile, compact = false) {
  const columns = compact ? ' style="grid-template-columns:70px 1fr 30px"' : "";
  const width = clamp(profile[metric.key] / 5 * 100, 0, 100);
  return `<div class="bar"${columns}><div>${escapeHtml(metric.label)}</div><div class="track" aria-hidden="true"><div class="fill" style="width:${width}%"></div></div><div class="score"><span class="sr-only">${escapeHtml(metric.label)}: </span>${formatScore(profile[metric.key])}</div></div>`;
}

function renderFlavorGroups(noteGroups) {
  const groups = WhiskeyDOM.element("div", null, "note-groups");
  for (const [category, notes] of Object.entries(noteGroups || {})) {
    const section = WhiskeyDOM.element("section", null, "note-group");
    section.setAttribute("aria-label", category);
    const title = WhiskeyDOM.element("h4", null, "note-group-title");
    // Only fixed, code-owned SVG strings enter this HTML sink. Data uses textContent.
    const icon = document.createElement("template");
    icon.innerHTML = Object.hasOwn(NOTE_ICONS, category) ? NOTE_ICONS[category] : DEFAULT_NOTE_ICON;
    title.append(icon.content.cloneNode(true), WhiskeyDOM.element("span", category));
    const chips = WhiskeyDOM.element("div", null, "chips");
    chips.append(...notes.map(note => WhiskeyDOM.element("span", note, "chip")));
    section.append(title, chips);
    groups.append(section);
  }
  return groups;
}

function renderBadges(region, style) {
  const badges = (region.badges || []).filter(badge => badge !== "Signature style");
  if (style.regionalSignature) badges.push("Signature style");
  if (!badges.length) return "";
  return `<div class="badges">${[...new Set(badges)].map(badge => `<span class="badge">${escapeHtml(badge)}</span>`).join("")}</div>`;
}

function renderIdentity(region) {
  const identity = region.identity;
  if (!identity) return "";
  const rows = [
    ["Climate", identity.setting],
    ["Terrain", identity.terrain],
    ["Soils", identity.soil],
    ["Influence", (identity.influences || []).join(" · ")]
  ].filter(([, value]) => value);
  return `<section class="identity" aria-labelledby="identityHeading"><h3 id="identityHeading">Regional identity</h3><dl class="identity-grid">${rows.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
}

/*
 * Why metadata is explicit. Region text is never parsed for style names and is
 * never rewritten by regex. Optional rules can scope an item to styles or
 * replace wording that needs a more careful scientific explanation.
 */
function renderWhy(regionId, region, regional, styleId) {
  const hasProfileWhy = Array.isArray(regional.why) && regional.why.length;
  const source = hasProfileWhy ? regional.why : region.why;
  if (!Array.isArray(source)) return "";
  const rules = hasProfileWhy ? {} : (WHY_RULES[regionId] || {});
  const why = source.map((item, index) => {
    const rule = rules[String(index)] || {};
    if (Array.isArray(rule.styles) && !rule.styles.includes(styleId)) return null;
    return {
      cause: rule.cause || item.cause,
      effect: rule.effect || item.effect
    };
  }).filter(Boolean);
  if (!why.length) return "";
  return `<section class="why" aria-labelledby="whyHeading"><h3 id="whyHeading">Why does it taste like this?</h3><p class="small">Typical raw-material, production and maturation associations; sensory descriptors are style associations, not literal flavor transfer.</p><ul class="why-list">${why.map(item => `<li><span class="why-cause">${escapeHtml(item.cause)}</span><span class="why-arrow" aria-hidden="true">→</span><span class="why-effect">${escapeHtml(item.effect)}</span></li>`).join("")}</ul></section>`;
}

function renderSources(region, regional = null) {
  const details = WhiskeyDOM.element("details", null, "sources");
  details.append(WhiskeyDOM.element("summary", "Sources & methodology"),
    WhiskeyDOM.element("p", "Regional profiles summarize typical characteristics. Distilleries, batches and age statements vary. Flavour scores are editorial judgements; production and historical claims are tied to the sources below.", "small"));
  const profileSources = (regional?.sources || []).map(id => SOURCES[id]).filter(Boolean);
  const resolved = [...new Map([...(region.sources || []), ...(regional?.sources || [])].map(id => [id, SOURCES[id]]).filter(([, source]) => source)).values()];
  if (resolved.length) {
    const list = WhiskeyDOM.element("ul", null, "source-list");
    for (const source of resolved) {
      const row = WhiskeyDOM.element("li");
      row.append(WhiskeyDOM.referenceLink(source));
      list.append(row);
    }
    details.append(list);
  }
  return details;
}

function renderLocator(regionId, region) {
  const point = LOCATORS[regionId];
  if (!point) return "";
  const width = 320, height = 160;
  const x = ((point.lon + 180) / 360) * width;
  const y = ((90 - point.lat) / 180) * height;
  const regionName = escapeHtml(region.name);
  const country = escapeHtml(region.country);
  return `<div class="locator" aria-label="Approximate location of ${escapeAttr(region.name)}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="World locator map showing ${escapeAttr(region.name)} in ${escapeAttr(region.country)}"><path class="land" d="M18 36l30-20 42 3 20 20-15 22-35 7-16 28-20-7-8-27zM94 93l20 8 17 24-7 31-18-5-12-25zM151 30l42-19 52 7 34 22-7 20-29 4-12 18-24-6-14 23-30-8-4-25-23-15zM221 91l21 2 19 22-7 30-23 10-14-22zM279 119l25 4 8 16-12 13-25-8z"/><path class="gridline" d="M0 80h320M80 0v160M160 0v160M240 0v160"/><circle class="marker-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/><circle class="marker-core" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"/></svg><div class="locator-caption">${country} · approximate regional location</div></div>`;
}

function styleCueDot(style, regional = null) {
  const cue = regional?.style?.cue || style?.cue;
  if (!cue) return "";
  return `<span class="style-cue-dot ${escapeAttr(cue)}" aria-hidden="true"></span>`;
}

function profileDistance(a, b) {
  return Math.sqrt(METRICS.reduce((sum, metric) => sum + Math.pow((a[metric.key] || 0) - (b[metric.key] || 0), 2), 0));
}

function similarReason(source, candidate) {
  const diffs = METRICS.map(metric => ({ key: metric.key, diff: Math.abs(source[metric.key] - candidate[metric.key]) }))
    .sort((a, b) => a.diff - b.diff);
  const AROMATIC_ORDER = ["smoke", "fruit", "oak", "sweetness", "spice", "finish", "body", "heat"];
  const shared = diffs.filter(item => item.key !== "heat" && item.diff <= 1 && source[item.key] >= 3 && candidate[item.key] >= 3)
    .sort((a, b) => AROMATIC_ORDER.indexOf(a.key) - AROMATIC_ORDER.indexOf(b.key)).slice(0, 2)
    .map(item => WhiskeyModel.flavorPhrase(item.key, "shared"));
  const biggest = diffs[diffs.length - 1];
  const contrast = biggest && biggest.diff >= 1.5
    ? `expect it ${WhiskeyModel.flavorPhrase(biggest.key, candidate[biggest.key] > source[biggest.key] ? "high" : "low")}`
    : null;
  if (shared.length && contrast) return `Tastes similar — both ${shared.join(" and ")} — but ${contrast}.`;
  if (shared.length) return `Tastes similar: both are ${shared.join(" and ")}.`;
  if (contrast) return `A different pour: ${contrast}.`;
  return "A different pour entirely — useful when you want a change of pace.";
}

function renderSimilar(current) {
  if (typeof window.smartRender === "function") { smartRender(current); return; }
  const candidates = allPairs()
    .filter(item => !(item.styleId === current.styleId && item.regionId === current.regionId))
    .map(item => ({ ...item, score: profileDistance(current.profile, item.profile) + (item.styleId === current.styleId ? 0.12 : 0) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  $("similarProfiles").innerHTML = candidates.map(item => `<button type="button" class="similar-item" data-style="${escapeAttr(item.styleId)}" data-region="${escapeAttr(item.regionId)}"><strong>${styleCueDot(item.style, item.regional)}${escapeHtml(item.style.name)}</strong><span class="similar-region">${escapeHtml(item.region.name)} · ${escapeHtml(item.region.country)}</span><span class="similar-reason">${escapeHtml(similarReason(current.profile, item.profile))}</span></button>`).join("");
  $("similarProfiles").querySelectorAll(".similar-item").forEach(button => button.addEventListener("click", () => selectProfile(button.dataset.style, button.dataset.region, true)));
}

function renderExplore() {
  const current = combinedProfile($("style").value, $("region").value);
  if (!current) return false;
  const { styleId, regionId, style, region, regional, profile } = current;
  $("title").textContent = `${style.name} · ${region.name}`;
  $("pill").textContent = `${region.country} · ${region.climate}`;
  $("expect").textContent = regional.expect;
  $("climate").replaceChildren(WhiskeyDOM.element("strong", "Climate effect:"), document.createTextNode(` ${region.summary}`));
  $("locatorMap").innerHTML = renderLocator(regionId, region);
  $("identity").innerHTML = renderBadges(region, style) + renderIdentity(region);
  $("why").innerHTML = renderWhy(regionId, region, regional, styleId);
  $("sourcesDrawer").replaceChildren(renderSources(region, regional));
  $("bars").innerHTML = METRICS.map(metric => metricBar(metric, profile)).join("");
  $("notes").replaceChildren(renderFlavorGroups(regional.notes));
  $("serve").replaceChildren(...[["Serve", regional.serve], ["Water & ABV", regional.dilution], ["Ice & highball", regional.ice], ["Glass", regional.glass]].map(([key, value]) => {
    const box = WhiskeyDOM.element("div", null, "box");
    box.append(WhiskeyDOM.element("div", key, "k"), WhiskeyDOM.element("div", value, "v"));
    return box;
  }));
  $("pair").replaceChildren(...regional.pairings.map(item => WhiskeyDOM.element("span", item, "chip")));
  renderBottles(regional);
  renderSimilar(current);
  return true;
}
function renderBottles(regional) {
  const target = document.getElementById("bottleList");
  if (!target) return;
  target.replaceChildren();
  const bottles = regional.bottles || [];
  const section = document.getElementById("bottleSection");
  if (section) section.classList.toggle("hidden", bottles.length === 0);
  for (const bottle of bottles) {
    const card = WhiskeyDOM.element("article", null, "bottle-card");
    const head = WhiskeyDOM.element("div", null, "bottle-head");
    head.append(WhiskeyDOM.element("strong", bottle.name), WhiskeyDOM.element("span", bottle.tag, "bottle-tag"));
    card.append(head, WhiskeyDOM.element("p", bottle.note, "bottle-note"));
    target.append(card);
  }
}

/* No-enhancement fallback: rendered only when the Advanced Compare UI is absent; exercised by tests. */
function renderBiggestDifferences(selections) {
  if (selections.length < 2) return "";
  const rows = [];
  for (const metric of COMPARE_METRICS) {
    const sorted = selections.map(item => ({ item, value: item.profile[metric.key] })).sort((a, b) => a.value - b.value);
    const low = sorted[0], high = sorted[sorted.length - 1];
    const spread = high.value - low.value;
    if (spread >= MIN_MEANINGFUL_SPREAD && high.item.regionId !== low.item.regionId) rows.push({ metric, spread, high, low });
  }
  rows.sort((a, b) => b.spread - a.spread);
  if (!rows.length) return "";
  return `<section class="differences" aria-labelledby="diffHeading"><h3 id="diffHeading">What sets them apart</h3>${rows.slice(0, 4).map(row => `<div class="diff-row"><span class="diff-metric">${escapeHtml(row.metric.label)}</span><span class="diff-text">${escapeHtml(row.high.item.region.name)} pours ${escapeHtml(WhiskeyModel.flavorPhrase(row.metric.key, "high"))}; ${escapeHtml(row.low.item.region.name)} is ${escapeHtml(WhiskeyModel.flavorPhrase(row.metric.key, "low"))}.</span></div>`).join("")}</section>`;
}

/* No-enhancement fallback: the legacy Compare controls, hidden behind the Advanced Compare UI in production; exercised by tests. */
function resetCompare() {
  if (document.getElementById("advancedCompareControls")) return;
  const styleId = $("cg").value;
  const regions = relevantRegions(styleId);
  $("compareRegionControls").innerHTML = "";
  if (!styleId) {
    $("compareHint").textContent = "Choose a style to compare regional expressions.";
    renderCompare();
    emit("compare-controls", { styleId, regions });
    return;
  }
  if (regions.length < 2) {
    $("compareHint").textContent = "More regional expressions coming soon.";
    renderCompare();
    emit("compare-controls", { styleId, regions });
    return;
  }
  $("compareHint").textContent = "Choose two or three regional expressions to compare.";
  for (let index = 0; index < 3; index += 1) {
    const id = `compareRegion${index + 1}`;
    const wrapper = document.createElement("div");
    wrapper.className = "compare-region-field";
    wrapper.innerHTML = `<label for="${id}">Region ${index + 1}</label><select id="${id}" class="cr"><option value="">— None —</option>${optionMarkup(regions, true)}</select>`;
    $("compareRegionControls").appendChild(wrapper);
    const select = wrapper.querySelector("select");
    if (regions[index]) select.value = regions[index][0];
    select.addEventListener("change", renderCompare);
  }
  renderCompare();
  emit("compare-controls", { styleId, regions });
}

/* No-enhancement fallback: reads the hidden legacy .cr selects; exercised by tests. */
function collectCompareSelections(styleId) {
  const seen = new Set();
  const selections = [];
  let duplicateCount = 0;
  for (const select of document.querySelectorAll(".cr")) {
    const regionId = select.value;
    if (!regionId) continue;
    if (seen.has(regionId)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(regionId);
    const profile = combinedProfile(styleId, regionId);
    if (profile) selections.push(profile);
  }
  return { selections, duplicateCount };
}

/* No-enhancement fallback: legacy Compare renderer behind the Advanced Compare UI; exercised by tests. */
function renderCompare() {
  if (document.getElementById("advancedCompareControls")) return;
  const styleId = $("cg").value;
  const regions = relevantRegions(styleId);
  if (!styleId) {
    $("compareGrid").innerHTML = "";
    $("compareDifferences").innerHTML = "";
    $("compareMessage").textContent = "Choose a style to compare regional expressions.";
    $("compareMessage").classList.remove("hidden");
    return;
  }
  if (regions.length < 2) {
    $("compareGrid").innerHTML = "";
    $("compareDifferences").innerHTML = "";
    $("compareMessage").textContent = "More regional expressions coming soon.";
    $("compareMessage").classList.remove("hidden");
    return;
  }
  $("compareMessage").classList.add("hidden");
  const { selections, duplicateCount } = collectCompareSelections(styleId);
  $("compareHint").textContent = duplicateCount
    ? "Each region can only be compared once; duplicate selections are ignored."
    : "Choose two or three regional expressions to compare.";
  $("compareGrid").innerHTML = selections.map(({ style, region, regional, profile }) => `<article class="compareCard"><h3>${escapeHtml(region.name)}</h3><div class="small">${escapeHtml(region.country)} · ${escapeHtml(region.climate)}</div>${renderBadges(region, style)}<div class="bars compare-bars">${COMPARE_METRICS.map(metric => metricBar(metric, profile, true)).join("")}</div><p class="small compare-summary">${escapeHtml(regional.expect)}</p><p class="small"><strong>Serve:</strong> ${escapeHtml(regional.serve)} · <strong>Water & ABV:</strong> ${escapeHtml(regional.dilution)}</p></article>`).join("") || '<p class="small">Select regions to compare.</p>';
  $("compareDifferences").innerHTML = renderBiggestDifferences(selections);
}

function isDiscoveryRegion(region) { return (region.badges || []).some(tag => ["Discovery", "Emerging region"].includes(tag)); }
function pickWeighted(items) {
  const weighted = items.map(item => ({ item, weight: isDiscoveryRegion(item.region) ? DISCOVERY_WEIGHT : CLASSIC_WEIGHT }));
  let ticket = Math.random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    ticket -= entry.weight;
    if (ticket <= 0) return entry.item;
  }
  return weighted.length ? weighted[weighted.length - 1].item : null;
}

function surpriseMe() {
  let candidates = allPairs();
  if (lastSurprise && candidates.length > 1) candidates = candidates.filter(item => !(item.styleId === lastSurprise.styleId && item.regionId === lastSurprise.regionId));
  const pick = pickWeighted(candidates);
  if (!pick) return;
  lastSurprise = pick;
  selectProfile(pick.styleId, pick.regionId, true);
}

function moodPick(mood) {
  const matches = allPairs().filter(mood.test);
  if (!matches.length) return announce("No profiles match that mood right now.");
  const pick = matches[Math.floor(Math.random() * matches.length)];
  selectProfile(pick.styleId, pick.regionId, true);
}

function renderMoods() {
  $("moodButtons").innerHTML = MOODS.map(mood => `<button type="button" class="mood" data-mood="${escapeAttr(mood.id)}"><span class="mood-label">${escapeHtml(mood.label)}</span><span class="mood-hint">${escapeHtml(mood.hint)}</span></button>`).join("");
  $("moodButtons").querySelectorAll(".mood").forEach(button => button.addEventListener("click", () => {
    const mood = MOODS.find(item => item.id === button.dataset.mood);
    if (mood) moodPick(mood);
  }));
}

function flattenNotes(notes) { return Object.values(notes || {}).flat().join(" "); }
function searchHaystack(item) {
  return [item.style.name, item.region.name, item.region.country, item.region.climate, item.region.summary, item.regional.expect, flattenNotes(item.regional.notes), ...(item.region.badges || [])].join(" ").toLowerCase();
}

function runSearch() {
  if (typeof window.renderEnhancedCompassSearch === "function") {
    void window.renderEnhancedCompassSearch();
    return;
  }
  const query = $("searchInput").value.trim().toLowerCase();
  if (query.length < 2) { $("searchResults").innerHTML = ""; return; }
  const terms = query.split(/\s+/).filter(Boolean);
  const matches = allPairs().map(item => {
    const haystack = searchHaystack(item);
    const matched = terms.every(term => haystack.includes(term));
    let score = 0;
    if (item.style.name.toLowerCase().includes(query)) score += 5;
    if (item.region.name.toLowerCase().includes(query)) score += 5;
    if (item.region.country.toLowerCase().includes(query)) score += 4;
    score += terms.filter(term => haystack.includes(term)).length;
    return { item, matched, score };
  }).filter(result => result.matched).sort((a, b) => b.score - a.score || a.item.region.name.localeCompare(b.item.region.name)).slice(0, 10);
  $("searchResults").innerHTML = matches.length ? matches.map(({ item }) => `<button type="button" class="search-result" data-style="${escapeAttr(item.styleId)}" data-region="${escapeAttr(item.regionId)}"><strong>${styleCueDot(item.style, item.regional)}${escapeHtml(item.style.name)} · ${escapeHtml(item.region.name)}</strong><span>${escapeHtml(item.region.country)} · ${escapeHtml(item.region.climate)}</span></button>`).join("") : '<div class="search-empty">No matching profiles yet.</div>';
  $("searchResults").querySelectorAll(".search-result").forEach(button => button.addEventListener("click", () => {
    selectProfile(button.dataset.style, button.dataset.region, true);
    $("searchInput").value = "";
    $("searchResults").innerHTML = "";
  }));
}

function updateUrl(styleId, regionId) {
  if (!styleId || !regionId) return;
  const url = new URL(window.location.href);
  url.searchParams.set("style", styleId);
  url.searchParams.set("region", regionId);
  window.history.replaceState(null, "", url);
}
function clearProfileUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("style");
  url.searchParams.delete("region");
  window.history.replaceState(null, "", url);
}

function selectProfile(styleId, regionId, shouldAnnounce = false) {
  const profile = combinedProfile(styleId, regionId);
  if (!profile) return false;
  setMode("explore");
  $("style").value = styleId;
  fillExploreRegions(styleId, regionId, false);
  syncPlaceControls(styleId, regionId);
  renderExplore();
  currentProfile = profile;
  updateUrl(styleId, regionId);
  emit("profile-selected", { profile });
  if (shouldAnnounce) announce(`Showing ${profile.style.name} from ${profile.region.name}.`);
  return true;
}

function announce(text) {
  $("liveStatus").textContent = "";
  window.setTimeout(() => { $("liveStatus").textContent = text; }, 30);
}

function applyInitialRoute() {
  const styleId = INITIAL_ROUTE.searchParams.get("style");
  const regionId = INITIAL_ROUTE.searchParams.get("region");
  return Boolean(styleId && regionId && selectProfile(styleId, regionId, false));
}

function setMode(mode) {
  const explore = mode === "explore";
  $("bExplore").classList.toggle("on", explore);
  $("bCompare").classList.toggle("on", !explore);
  $("bExplore").setAttribute("aria-pressed", String(explore));
  $("bCompare").setAttribute("aria-pressed", String(!explore));
  $("exploreControls").classList.toggle("hidden", !explore);
  $("compareControls").classList.toggle("hidden", explore);
  $("exploreView").classList.toggle("hidden", !explore);
  $("compareView").classList.toggle("hidden", explore);
  $("moodSection").classList.toggle("hidden", !explore);
  if (!explore) renderCompare();
  emit("mode-changed", { mode, hasProfile: Boolean(currentProfile) });
}

function clearCurrentProfile() {
  currentProfile = null;
  clearProfileUrl();
}

function begin(action) {
  if (action === "surprise") return surpriseMe();
  clearCurrentProfile();

  if (action === "compare") {
    setMode("compare");
    prependPlaceholder($("cg"), "Choose a style…");
    resetCompare();
    return;
  }

  setMode("explore");
  if (action === "place") {
    setBrowseMethod("place");
    populateCountries(null, true);
    $("placeRegion").innerHTML = '<option value="" disabled selected>Choose a country first…</option>';
    $("placeStyle").innerHTML = '<option value="" disabled selected>Choose a region first…</option>';
    emit("selection-needed", { title: "Explore by place", text: "Choose a country, then a region and style to open a profile.", focus: "country" });
    return;
  }
  if (action === "search") {
    emit("selection-needed", { title: "Search the Compass", text: "Search for a style, region, country or food, then choose a result.", focus: "searchInput" });
    return;
  }

  setBrowseMethod("style");
  prependPlaceholder($("style"), "Choose a style…");
  $("region").innerHTML = '<option value="" disabled selected>Choose a style first…</option>';
  emit("selection-needed", { title: "Start with a style", text: "Choose a style. If it has one regional expression, Whiskey Compass will open it automatically.", focus: "style" });
}

function handleStyleChange() {
  const styleId = $("style").value;
  const regions = fillExploreRegions(styleId, null, true);
  if (regions.length === 1) {
    selectProfile(styleId, regions[0][0], false);
  } else if (regions.length > 1) {
    clearCurrentProfile();
    emit("selection-needed", { title: "Choose a region", text: "Now choose the regional expression you want to explore.", focus: "region" });
  } else {
    clearCurrentProfile();
    emit("selection-needed", { title: "No regional expression yet", text: "This style is not currently mapped to a region in the Compass." });
  }
}

function handleCountryChange() {
  const regions = populatePlaceRegions(null, true);
  if (regions.length === 1) {
    $("placeRegion").value = regions[0][0];
    handlePlaceRegionChange();
  } else {
    $("placeStyle").innerHTML = '<option value="" disabled selected>Choose a region first…</option>';
    clearCurrentProfile();
    emit("selection-needed", { title: "Choose a region", text: "Choose a whiskey region within that country.", focus: "placeRegion" });
  }
}

function handlePlaceRegionChange() {
  const styles = populatePlaceStyles(null, true);
  if (styles.length === 1) {
    $("placeStyle").value = styles[0][0];
    selectProfile(styles[0][0], $("placeRegion").value, false);
  } else {
    clearCurrentProfile();
    emit("selection-needed", { title: "Choose a style", text: "Choose one of the styles represented in this region.", focus: "placeStyle" });
  }
}

function wireEvents() {
  $("style").addEventListener("change", handleStyleChange);
  $("region").addEventListener("change", () => selectProfile($("style").value, $("region").value, false));
  $("country").addEventListener("change", handleCountryChange);
  $("placeRegion").addEventListener("change", handlePlaceRegionChange);
  $("placeStyle").addEventListener("change", () => selectProfile($("placeStyle").value, $("placeRegion").value, false));
  $("cg").addEventListener("change", resetCompare);
  $("surprise").addEventListener("click", surpriseMe);
  $("searchInput").addEventListener("input", runSearch);
  $("browseByStyle").addEventListener("click", () => setBrowseMethod("style"));
  $("browseByPlace").addEventListener("click", () => setBrowseMethod("place"));
  $("bExplore").addEventListener("click", () => setMode("explore"));
  $("bCompare").addEventListener("click", () => setMode("compare"));
}

async function init() {
  try {
    await loadData();
    setBrowseMethod("place");
    populateStyles();
    fillExploreRegions($("style").value, null, false);
    populateCountries(null, false);
    populatePlaceRegions(null, false);
    populatePlaceStyles(null, false);
    renderMoods();
    wireEvents();
    const sharedProfile = applyInitialRoute();
    if (!sharedProfile) renderExplore();
    resetCompare();
    window.WhiskeyCompass.ready = true;
    emit("ready", { sharedProfile, initialRoute: new URL(INITIAL_ROUTE.href) });
  } catch (error) {
    console.error(error);
    $("welcomeView").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    document.querySelector(".layout > aside")?.classList.add("hidden");
    document.querySelector("main").setAttribute("role", "alert");
    document.querySelector("main").innerHTML = `<article class="card"><h2>Whiskey Compass could not load</h2><p class="small">Please refresh the page. If running locally, serve the folder through a local web server rather than opening index.html directly.</p></article>`;
    emit("error", { error });
  }
}

/*
 * Public API contract for optional feature modules. Profile computation belongs
 * here and nowhere else. allPairs() returns a shallow copy so consumers may sort
 * or filter without mutating the memoized core cache.
 */
window.WhiskeyCompass = {
  ready: false,
  begin,
  selectProfile,
  setMode,
  setBrowseMethod,
  resetCompare,
  clearProfileUrl,
  combinedProfile,
  allPairs: () => allPairs().slice(),
  hasActiveProfile: () => Boolean(currentProfile),
  getSearchRules: () => SEARCH_RULES,
  getData: () => ({ styles: STYLES, regions: REGIONS }),
  escapeHtml,
  escapeAttr
};

document.addEventListener("DOMContentLoaded", init);
