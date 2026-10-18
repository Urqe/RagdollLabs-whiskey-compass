/*
 * RagDollLabs Whiskey Compass — Advanced Compare
 * -----------------------------------------
 * Compares up to three full whiskey profiles rather than only one style across
 * regions. Comparisons stay within one whiskey style family,
 * so differences remain meaningful.
 *
 * Important architecture rule: profile computation is owned by app.js. This
 * module consumes WhiskeyCompass.combinedProfile() / WhiskeyCompass.allPairs() and must
 * not duplicate baseline + regional-modifier logic. Shared compatibility rules
 * live in whiskey-model.js; state lives in compare-state.js. This file owns controls
 * and rendering.
 */

const ADV_COMPARE_METRICS = WhiskeyModel.metrics.map(metric => ({ ...metric,
  high: metric.advancedHigh, low: metric.advancedLow }));

const ADV_COMPARE_MIN_SPREAD = 0.5;
let advancedCompareLastProfile = null;
let advancedCompareInitialized = false;

/* This clamp is presentation-only: the canonical profile engine already clamps
   metrics to 0–5; here we simply keep a CSS percentage within 0–100. */
function advClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function advancedAllProfiles() {
  return WhiskeyCompass.allPairs().sort((a, b) =>
    a.style.name.localeCompare(b.style.name) || a.region.name.localeCompare(b.region.name)
  );
}

function advancedStyle(profile) {
  const style = profile.regional.style;
  const family = style?.family || "malt";
  return {
    family,
    cue: WhiskeyModel.cue(profile),
    label: style?.label || `${profile.style.name} · ${family}`,
    method: style?.method || null,
    effect: style?.effect || null,
    sweetness: style?.sweetness || null
  };
}

function advancedCompatibilityLabel(profile) {
  return "any whiskeys you like";
}

function advancedCompatible(reference, candidate) { return WhiskeyModel.compatible(reference, candidate); }

function advancedProfileKey(profile) {
  return `${profile.styleId}::${profile.regionId}`;
}

function advancedProfileLabel(profile) {
  const style = advancedStyle(profile);
  const extra = ` · ${style.label}`;
  return `${profile.style.name} · ${profile.region.name} — ${profile.region.country}${extra}`;
}

function advancedGroupLabel(profile) {
  const style = advancedStyle(profile);
  return style.family.charAt(0).toUpperCase() + style.family.slice(1);
}

function advancedOptions(select, candidates, selectedKey, allowNone, excluded = new Set()) {
  select.replaceChildren();
  if (allowNone) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— None —";
    select.appendChild(empty);
  } else {
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = "Choose a whiskey…";
    prompt.disabled = true;
    select.appendChild(prompt);
  }

  const grouped = new Map();
  for (const profile of candidates) {
    const key = advancedProfileKey(profile);
    if (excluded.has(key) && key !== selectedKey) continue;
    const group = advancedGroupLabel(profile);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(profile);
  }

  for (const [label, profiles] of grouped) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    for (const profile of profiles) {
      const option = document.createElement("option");
      option.value = advancedProfileKey(profile);
      option.textContent = advancedProfileLabel(profile);
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.value = selectedKey || "";
}

function advancedFindProfile(key) {
  if (!key) return null;
  const [styleId, regionId] = key.split("::");
  return WhiskeyCompass.combinedProfile(styleId, regionId);
}

/* Keep the physical selector slot with each rendered card. Slot 3 can be filled
   while slot 2 is empty, so using filtered-array indexes would make Remove act
   on the wrong selector in that valid edge case. */
function advancedSelections() { return WhiskeyComparison.profiles(); }

function advancedRefreshSelectors() {
  const all = advancedAllProfiles();
  const selected = WhiskeyComparison.snapshot().keys;
  const first = advancedFindProfile(selected[0]);
  const firstSelect = document.getElementById("advancedCompare1");
  if (firstSelect) advancedOptions(firstSelect, all, selected[0], false);
  const compatible = first ? all.filter(item => WhiskeyModel.compatible(first, item)) : [];
  for (let index = 2; index <= 3; index += 1) {
    const select = document.getElementById(`advancedCompare${index}`);
    if (!select) continue;
    select.disabled = !first;
    const excluded = new Set(selected.filter((key, i) => i !== index - 1 && key));
    advancedOptions(select, compatible, selected[index - 1], true, excluded);
  }
  for (let index = 1; index <= 3; index += 1) {
    const button = document.querySelector(`.advanced-slot-remove[data-slot="${index}"]`);
    if (!button) continue;
    const occupied = Boolean(selected[index - 1]);
    button.hidden = !occupied;
    button.disabled = !occupied;
  }
  const checkbox = document.getElementById("advancedBiggestOnly");
  if (checkbox) checkbox.checked = WhiskeyComparison.snapshot().biggestOnly;
}

function advancedMetricBar(metric, profile) {
  const value = profile.profile[metric.key] || 0;
  const width = advClamp(value / 5 * 100, 0, 100);
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `<div class="bar" style="grid-template-columns:70px 1fr 30px"><div>${WhiskeyCompass.escapeHtml(metric.label)}</div><div class="track" aria-hidden="true"><div class="fill" style="width:${width}%"></div></div><div class="score"><span class="sr-only">${WhiskeyCompass.escapeHtml(metric.label)}: </span>${formatted}</div></div>`;
}

function advancedDifferenceRows(selections) {
  if (selections.length < 2) return [];
  return ADV_COMPARE_METRICS.map(metric => {
    const values = selections.map(item => ({ item, value: item.profile[metric.key] || 0 })).sort((a, b) => a.value - b.value);
    const low = values[0];
    const high = values[values.length - 1];
    return { metric, low, high, spread: high.value - low.value };
  }).filter(row => row.spread >= ADV_COMPARE_MIN_SPREAD).sort((a, b) => b.spread - a.spread);
}

function advancedShortName(profile) {
  return `${profile.style.name} · ${profile.region.name}`;
}

function advancedProductionContext(selections) {
  const rows = selections.filter(item => advancedStyle(item).method || advancedStyle(item).effect);
  if (!rows.length) return "";
  return `<section class="advanced-production"><h3>Production context</h3><p class="small">These notes explain relevant production differences without claiming that one technique alone causes every sensory difference above.</p>${rows.map(item => {
    const style = advancedStyle(item);
    return `<div class="advanced-production-row"><strong>${WhiskeyCompass.escapeHtml(advancedShortName(item))}</strong><span>${WhiskeyCompass.escapeHtml(style.method || style.label)}</span>${style.effect ? `<p>${WhiskeyCompass.escapeHtml(style.effect)}</p>` : ""}</div>`;
  }).join("")}</section>`;
}

function advancedSetBiggestOnly(value) { WhiskeyComparison.setBiggestOnly(value); }
function advancedRemoveSlot(slot) { WhiskeyComparison.remove(slot); }

function advancedHandleGridClick(event) {
  const button = event.target.closest?.(".advanced-remove");
  if (!button) return;
  advancedRemoveSlot(Number(button.dataset.slot));
}

function advancedRender() {
  if (!advancedCompareInitialized) return;
  const selections = advancedSelections();
  const message = document.getElementById("advancedCompareMessage");
  const grid = document.getElementById("advancedCompareGrid");
  const differences = document.getElementById("advancedCompareDifferences");
  const hint = document.getElementById("advancedCompareHint");
  if (!message || !grid || !differences || !hint) return;

  if (!selections.length) {
    message.textContent = "Pick a whiskey to start. The next slots will fill with whiskeys you can meaningfully compare it to."
    message.classList.remove("hidden");
    grid.replaceChildren();
    differences.replaceChildren();
    hint.textContent = "You can compare whiskeys from the same family side by side — the differences you see are about the whiskey, not apples vs oranges."
    return;
  }

  message.classList.add("hidden");
  const reference = selections[0];
  hint.textContent = "Differences in the charts reflect both region and production route.";
  const rows = advancedDifferenceRows(selections);
  const biggestOnly = WhiskeyComparison.snapshot().biggestOnly;
  const metricKeys = biggestOnly && rows.length ? new Set(rows.slice(0, 4).map(row => row.metric.key)) : null;

  grid.innerHTML = selections.map(item => {
    const style = advancedStyle(item);
    const metrics = metricKeys ? ADV_COMPARE_METRICS.filter(metric => metricKeys.has(metric.key)) : ADV_COMPARE_METRICS;
    return `<article class="compareCard advanced-compare-card"><div class="advanced-card-head"><div><h3>${WhiskeyCompass.escapeHtml(item.style.name)} · ${WhiskeyCompass.escapeHtml(item.region.name)}</h3><div class="small">${WhiskeyCompass.escapeHtml(item.region.country)} · ${WhiskeyCompass.escapeHtml(style.label)}</div></div><button type="button" class="advanced-remove" data-slot="${item.compareSlot}">Remove</button></div><div class="bars compare-bars">${metrics.map(metric => advancedMetricBar(metric, item)).join("")}</div><p class="small compare-summary">${WhiskeyCompass.escapeHtml(item.regional.expect)}</p><p class="small"><strong>Serve:</strong> ${WhiskeyCompass.escapeHtml(item.regional.serve)} · <strong>Water & ABV:</strong> ${WhiskeyCompass.escapeHtml(item.regional.dilution)}</p></article>`;
  }).join("");

  if (rows.length) {
    differences.innerHTML = `<section class="differences" aria-labelledby="advancedDiffHeading"><h3 id="advancedDiffHeading">What sets them apart</h3>${selections.some(item => WhiskeyModel.familyKey(item) !== WhiskeyModel.familyKey(selections[0])) ? '<p class="small category-span-note">Different production routes: some differences reflect category conventions (cask type, mashbill) as much as region.</p>' : ''}${rows.slice(0, 4).map(row => `<div class="diff-row"><span class="diff-metric">${WhiskeyCompass.escapeHtml(row.metric.label)}</span><span class="diff-text">${WhiskeyCompass.escapeHtml(advancedShortName(row.high.item))} pours ${WhiskeyCompass.escapeHtml(WhiskeyModel.flavorPhrase(row.metric.key, "high"))}; ${WhiskeyCompass.escapeHtml(advancedShortName(row.low.item))} is ${WhiskeyCompass.escapeHtml(WhiskeyModel.flavorPhrase(row.metric.key, "low"))}.</span></div>`).join("")}</section>${advancedProductionContext(selections)}`;
  } else if (selections.length >= 2) {
    differences.innerHTML = `<p class="small">These selections are unusually close on the sensory metrics.</p>${advancedProductionContext(selections)}`;
  } else {
    differences.replaceChildren();
  }
}

function advancedSeedProfile(profile) {
  if (profile) WhiskeyComparison.replace([profile], { biggestOnly: false });
}

function advancedInjectUi() {
  const controls = document.getElementById("compareControls");
  const view = document.getElementById("compareView")?.querySelector("article");
  if (!controls || !view || advancedCompareInitialized) return;

  /*
   * The original same-style Compare remains in app.js as a no-enhancement
   * fallback and regression-tested core path. Advanced Compare hides, rather
   * than deletes, those controls so a failure in this optional layer cannot
   * corrupt core state.
   */
  controls.querySelector("#compareHeading").textContent = "Advanced Compare";
  for (const id of ["cg", "compareStyleCue", "compareRegionControls", "compareHint"]) {
    const node = document.getElementById(id);
    if (node) node.classList.add("advanced-legacy-hidden");
  }
  const cgLabel = controls.querySelector('label[for="cg"]');
  if (cgLabel) cgLabel.classList.add("advanced-legacy-hidden");

  const panel = document.createElement("div");
  panel.id = "advancedCompareControls";
  panel.innerHTML = `
    <p class="small">Start with any whiskey. Slots 2 and 3 are limited to the same style family, so the comparison stays meaningful.</p>
    <label for="advancedCompare1">Whiskey 1</label><div class="advanced-slot"><select id="advancedCompare1"></select><button type="button" class="advanced-slot-remove" data-slot="1" aria-label="Remove Whiskey 1" hidden>Remove</button></div>
    <label for="advancedCompare2">Whiskey 2</label><div class="advanced-slot"><select id="advancedCompare2" disabled></select><button type="button" class="advanced-slot-remove" data-slot="2" aria-label="Remove Whiskey 2" hidden>Remove</button></div>
    <label for="advancedCompare3">Whiskey 3</label><div class="advanced-slot"><select id="advancedCompare3" disabled></select><button type="button" class="advanced-slot-remove" data-slot="3" aria-label="Remove Whiskey 3" hidden>Remove</button></div>
    <label class="advanced-check"><input id="advancedBiggestOnly" type="checkbox"> Show only what sets them apart</label>
    <p id="advancedCompareHint" class="small" role="status" aria-live="polite"></p>`;
  controls.insertBefore(panel, document.getElementById("compareHint"));

  for (const id of ["compareMessage", "compareGrid", "compareDifferences"]) {
    const node = document.getElementById(id);
    if (node) node.classList.add("advanced-legacy-hidden");
  }
  const heading = document.getElementById("regionalComparisonHeading");
  if (heading) heading.textContent = "Whiskey Comparison";
  const message = document.createElement("div");
  message.id = "advancedCompareMessage";
  message.className = "compare-message hidden";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const grid = document.createElement("div");
  grid.id = "advancedCompareGrid";
  grid.className = "compareGrid";
  grid.addEventListener("click", advancedHandleGridClick);
  const differences = document.createElement("div");
  differences.id = "advancedCompareDifferences";
  view.append(message, grid, differences);

  const profileHeader = document.querySelector("#exploreView .titleline");
  if (profileHeader && !document.getElementById("compareCurrentWhiskey")) {
    const button = document.createElement("button");
    button.id = "compareCurrentWhiskey";
    button.type = "button";
    button.className = "compare-current-whiskey";
    button.textContent = "Compare this whiskey";
    button.addEventListener("click", () => {
      if (advancedCompareLastProfile) advancedSeedProfile(advancedCompareLastProfile);
      WhiskeyCompass.setMode("compare");
    });
    profileHeader.appendChild(button);
  }

  [1, 2, 3].forEach(index => {
    document.getElementById(`advancedCompare${index}`)?.addEventListener("change", event => {
      WhiskeyComparison.setSlot(index, event.target.value);
    });
  });
  panel.addEventListener("click", event => {
    const button = event.target.closest?.(".advanced-slot-remove");
    if (button) advancedRemoveSlot(Number(button.dataset.slot));
  });
  document.getElementById("advancedBiggestOnly")?.addEventListener("change", event => {
    WhiskeyComparison.setBiggestOnly(event.target.checked);
  });

  // The legacy controls remain available only if this enhancement is absent.
  document.getElementById("compareRegionControls")?.replaceChildren();
  for (const id of ["compareGrid", "compareDifferences"]) document.getElementById(id)?.replaceChildren();
  advancedCompareInitialized = true;
  advancedRefreshSelectors();
  advancedRender();
}

document.addEventListener("whiskeycompass:ready", () => {
  advancedInjectUi();
});

document.addEventListener("whiskeycompass:profile-selected", event => {
  advancedCompareLastProfile = event.detail.profile;
});

document.addEventListener("whiskeycompass:mode-changed", event => {
  if (event.detail.mode !== "compare" || !advancedCompareInitialized) return;
  if (!WhiskeyComparison.snapshot().keys[0] && advancedCompareLastProfile) {
    advancedSeedProfile(advancedCompareLastProfile);
    return;
  }
  advancedRender();
});

// Only the model emits changes; selectors, cards and discovery consume the same snapshot.
document.addEventListener("whiskeycompass:comparison-changed", () => {
  if (!advancedCompareInitialized) return;
  advancedRefreshSelectors();
  advancedRender();
});
