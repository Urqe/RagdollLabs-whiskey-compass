import assert from "node:assert/strict";
import { createApp } from "./harness.mjs";

const { window, document, settle, close } = await createApp();
await settle();

assert.equal(window.WhiskeyCompass.ready, true);
assert.equal(typeof window.WhiskeyCompass.combinedProfile, "function");
assert.equal(typeof window.WhiskeyCompass.allPairs, "function");
assert.ok(window.WhiskeyCompass.allPairs().length > 0);

// Focused shell: one visible Explore search, secondary discovery and learning collapsed.
assert.equal(document.querySelectorAll("[data-welcome-action]").length, 3);
assert.ok(document.getElementById("discoverTools") instanceof window.HTMLDetailsElement);
assert.equal(document.getElementById("discoverTools").open, false);
assert.ok(document.getElementById("learnMore") instanceof window.HTMLDetailsElement);
assert.equal(document.getElementById("learnMore").open, false);

assert.equal(window.WhiskeyCompass.selectProfile("peated-malt", "islay"), true);
await settle();
assert.equal(document.getElementById("title").textContent, "Peated single malt · Islay");
assert.ok(document.querySelectorAll("#bars .bar").length > 0);
assert.ok(document.getElementById("notes").textContent.trim().length > 0);
assert.equal(document.querySelectorAll("#serve .box").length, 3);
assert.equal(document.getElementById("winemaking").classList.contains("hidden"), false);

window.WhiskeyCompass.selectProfile("single-malt", "speyside");
await settle();
assert.equal(document.getElementById("maturity").classList.contains("hidden"), false);
assert.equal(document.querySelectorAll("#maturityStages .maturity-stage").length, 3);

window.WhiskeyCompass.selectProfile("pot-still", "ireland");
await settle();
const peatTerm = document.querySelector('.glossary-term[data-glossary-id="peat"]');
assert.ok(peatTerm);
peatTerm.click();
await settle();
assert.equal(document.getElementById("glossaryDialogTitle").textContent, "Peat");
document.getElementById("glossaryClose").click();

// Unified search: food aliases and style text use the same field.
const searchInput = document.getElementById("searchInput");
searchInput.value = "bbq";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await settle();
assert.ok(document.querySelectorAll("#searchResults .search-result").length > 0, "bbq alias should resolve in unified search");

searchInput.value = "chocolate";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await settle();
const chocolateResults = [...document.querySelectorAll("#searchResults .search-result")];
assert.ok(chocolateResults.length > 0);

searchInput.value = "islay";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await settle();
assert.ok([...document.querySelectorAll("#searchResults .search-result")].some(button => /Islay/i.test(button.textContent)));

// Sherry cask influence is modelled as oak and fruit, never as peat smoke.
const sherriedSpeyside = window.WhiskeyCompass.combinedProfile("sherry-malt", "speyside");
assert.equal(sherriedSpeyside.profile.smoke, 0, "sherry-cask Speyside must not carry peat smoke");
assert.ok(sherriedSpeyside.profile.oak >= 4, "sherry-cask Speyside should be oak-forward");
const islayPeated = window.WhiskeyCompass.combinedProfile("peated-malt", "islay");
assert.ok(islayPeated.profile.smoke >= 4.5, "Islay peated should stay heavily smoky");

// Search semantics: smoky means smoke, not any Scottish profile.
searchInput.value = "smoky";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await settle();
const smokyResults = [...document.querySelectorAll("#searchResults .search-result")];
assert.ok(smokyResults.length > 0);
assert.ok(smokyResults.every(button => /Islay/i.test(button.textContent)), "smoky must only match heavily peated profiles");

// Bottle layer: names are searchable and bottles render on the profile.
searchInput.value = "redbreast";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await settle();
assert.ok(document.querySelectorAll("#searchResults .search-result").length > 0, "bottle names must be searchable");
window.WhiskeyCompass.selectProfile("pot-still", "ireland");
await settle();
assert.ok(document.querySelectorAll("#bottle-card, .bottle-card").length >= 2, "profile card must render its bottles");
assert.ok(document.getElementById("bottleList").textContent.includes("Redbreast"));

// Advanced Compare uses canonical metrics and compatibility-aware selectors.
window.WhiskeyCompass.selectProfile("bourbon", "kentucky");
await settle();
window.WhiskeyCompass.setMode("compare");
await settle();
const adv1 = document.getElementById("advancedCompare1");
const adv2 = document.getElementById("advancedCompare2");
const biggestOnly = document.getElementById("advancedBiggestOnly");
assert.ok(adv1 && adv2);
assert.match(adv1.value, /^bourbon::kentucky$/);
const bourbonValues = [...adv2.options].map(option => option.value).filter(Boolean);
assert.ok(bourbonValues.some(value => value.startsWith("wheated-bourbon::")));
assert.equal(bourbonValues.some(value => value.startsWith("single-malt::islay")), false);
adv2.value = bourbonValues.find(value => value.startsWith("wheated-bourbon::"));
adv2.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();

const kentucky = window.WhiskeyCompass.combinedProfile("bourbon", "kentucky");
const compareScores = [...document.querySelectorAll("#advancedCompareGrid .advanced-compare-card:first-child .score")]
  .map(node => Number(node.textContent.trim().split(/\s+/).at(-1)));
const expectedScores = ["body", "smoke", "sweetness", "spice", "fruit", "oak", "finish", "heat"].map(key => kentucky.profile[key]);
assert.deepEqual(compareScores, expectedScores);

// Switching slot 1 to a malt restricts slots 2 and 3 to the malt family.
adv1.value = "peated-malt::islay";
adv1.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();
const maltValues = [...adv2.options].map(option => option.value).filter(Boolean);
assert.ok(maltValues.some(value => value.startsWith("single-malt::speyside")));
assert.equal(maltValues.some(value => value.startsWith("bourbon::kentucky")), false);

// Single-choice navigation remains guarded and URL-backed.
window.WhiskeyCompass.begin("style");
const styleSelect = document.getElementById("style");
styleSelect.value = "japanese-malt";
styleSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();
assert.equal(new URL(window.location.href).searchParams.get("region"), "japan");

console.log("OK: Whiskey Compass DOM smoke tests passed");
await close();
