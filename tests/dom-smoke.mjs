import assert from "node:assert/strict";
import { createApp } from "./harness.mjs";

const { window, document, settle, waitFor, close } = await createApp();
await settle();

assert.equal(window.WhiskeyCompass.ready, true);
assert.equal(typeof window.WhiskeyCompass.combinedProfile, "function");
assert.equal(typeof window.WhiskeyCompass.allPairs, "function");
assert.ok(window.WhiskeyCompass.allPairs().length > 0);

const searchInput = document.getElementById("searchInput");
async function search(query) {
  searchInput.value = query;
  searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await settle();
  return [...document.querySelectorAll("#searchResults .search-result")];
}

// Focused shell: one visible Explore search, secondary discovery and learning collapsed.
assert.equal(document.querySelectorAll("[data-welcome-action]").length, 3);
assert.ok(document.getElementById("discoverTools") instanceof window.HTMLDetailsElement);
assert.equal(document.getElementById("discoverTools").open, false);
assert.ok(document.getElementById("learnMore") instanceof window.HTMLDetailsElement);
assert.equal(document.getElementById("learnMore").open, false);

// --- Flavour model: peat levels are distinct, cask influence is independent of peat ---
const islayPeated = window.WhiskeyCompass.combinedProfile("heavily-peated-malt", "islay");
assert.ok(islayPeated.profile.smoke >= 4.5, "heavily peated Islay must stay heavily smoky");

const sherriedSpeyside = window.WhiskeyCompass.combinedProfile("sherry-malt", "speyside");
assert.equal(sherriedSpeyside.profile.smoke, 0, "sherry-cask Speyside must not carry peat smoke");
assert.ok(sherriedSpeyside.profile.oak >= 4, "sherry-cask Speyside should be oak-forward");

const unpeatedIslay = window.WhiskeyCompass.combinedProfile("unpeated-malt", "islay");
assert.ok(unpeatedIslay.profile.smoke <= 0.5, "unpeated Islay malt must have no meaningful smoke");

// Production peating attribute is explicit and displayed.
assert.match(String(islayPeated.regional.phenol), /heavily peated/i, "Islay peated profile must declare its phenol level");
assert.match(String(sherriedSpeyside.regional.phenol), /unpeated/i, "sherry profile must declare unpeated spirit");
assert.match(String(unpeatedIslay.regional.phenol), /unpeated/i, "unpeated Islay must be classified as unpeated");

// Regional expressions are differentiated, not averaged:
// Talisker (powerful smoke) and Highland Park (subtle smoke) no longer share one profile.
const taliskerProfile = window.WhiskeyCompass.combinedProfile("peated-malt", "islands");
const highlandParkProfile = window.WhiskeyCompass.combinedProfile("lightly-peated-malt", "islands");
assert.ok(taliskerProfile.profile.smoke - highlandParkProfile.profile.smoke >= 1.5,
  "Talisker's expression must be materially smokier than Highland Park's");
assert.ok(highlandParkProfile.profile.smoke < taliskerProfile.profile.smoke, "Highland Park must read as the gentler expression");

// Campbeltown distinguishes its three peat lines.
const hazelburn = window.WhiskeyCompass.combinedProfile("unpeated-malt", "campbeltown");
const springbank = window.WhiskeyCompass.combinedProfile("lightly-peated-malt", "campbeltown");
const longrow = window.WhiskeyCompass.combinedProfile("heavily-peated-malt", "campbeltown");
assert.ok(hazelburn.profile.smoke < springbank.profile.smoke, "Hazelburn must be less smoky than Springbank");
assert.ok(springbank.profile.smoke < longrow.profile.smoke, "Springbank must be less smoky than Longrow");

// Peated expressions exist outside Islay: Benromach (Speyside) and Ardmore (Highlands).
const benromach = window.WhiskeyCompass.combinedProfile("lightly-peated-malt", "speyside");
const ardmore = window.WhiskeyCompass.combinedProfile("lightly-peated-malt", "highlands");
assert.ok(benromach.profile.smoke >= 1.5, "Benromach expression must carry light peat");
assert.ok(ardmore.profile.smoke >= 1.5, "Ardmore expression must carry light peat");

// Amrut Fusion is genuinely peated: no generic low-smoke country profile.
const amrut = window.WhiskeyCompass.combinedProfile("indian-malt", "india");
assert.ok(amrut.profile.smoke >= 3, "Amrut Fusion's profile must reflect its pronounced peat");

// --- Search semantics ---
// Smoky means smoke: peated expressions from several regions match; genuinely
// non-smoky expressions are excluded. No geographic assumption.
const smokyResults = await search("smoky");
assert.ok(smokyResults.length > 0, "smoky must match peated expressions");
assert.ok(smokyResults.every(button => !/sherry-cask malt · Speyside/i.test(button.textContent)),
  "smoky must exclude the unpeated sherried Speyside expression");
assert.ok(smokyResults.some(button => /Islay|India|Islands/i.test(button.textContent)),
  "smoky must include peated expressions from more than one region");

// Compound bottle + country searches.
const redbreastIrish = await search("redbreast irish");
assert.equal(redbreastIrish.length, 1, "redbreast irish must resolve to the one pot still profile");
assert.match(redbreastIrish[0].textContent, /Irish pot still/i);

const hakushu = await search("hakushu");
assert.ok(hakushu.length > 0, "hakushu must be searchable");
assert.match(hakushu[0].textContent, /Japanese single malt/i);

// Producer-name collisions: "highland park" is a producer, not the Highlands region.
const highlandPark = await search("highland park");
assert.ok(highlandPark.length > 0, "highland park must resolve to the producer");
assert.ok(highlandPark.every(button => /Islands/i.test(button.textContent)),
  "highland park must resolve to the Islands profile, not a Highlands region filter");

const smokyTalisker = await search("smoky talisker");
assert.equal(smokyTalisker.length, 1, "smoky talisker must resolve to the one Talisker profile");
assert.match(smokyTalisker[0].textContent, /Peated malt · Islands/i);

// Food aliases are bidirectional: canonical and synonym forms both resolve.
const bbqResults = await search("bbq");
assert.ok(bbqResults.length > 0, "bbq must resolve");
const barbecueResults = await search("barbecue");
assert.ok(barbecueResults.length > 0, "barbecue must resolve (bidirectional alias)");
assert.equal(barbecueResults.length, bbqResults.length, "bbq and barbecue must resolve identically");

// Constraints stay restrictive: "irish bourbon" is contradictory and returns nothing.
const contradictory = await search("irish bourbon");
assert.equal(contradictory.length, 0, "a contradictory country+category query must return no results");

// --- Profile rendering ---
assert.equal(window.WhiskeyCompass.selectProfile("heavily-peated-malt", "islay"), true);
await settle();
assert.equal(document.getElementById("title").textContent, "Heavily peated malt · Islay");
assert.ok(document.querySelectorAll("#bars .bar").length > 0);
assert.ok(document.getElementById("notes").textContent.trim().length > 0);
// Whiskey-native serving guidance: four boxes, no wine decanting concept.
const serveBoxes = [...document.querySelectorAll("#serve .box")].map(box => box.textContent.trim());
assert.equal(serveBoxes.length, 4, "serving guidance shows four boxes");
assert.ok(serveBoxes.some(text => text.startsWith("Serve")), "first box is the serve baseline");
assert.ok(document.querySelector(".serve-card h2").textContent === "How to drink it", "serve card uses whiskey-native heading");
assert.ok(!document.body.textContent.includes("Decant"), "no wine decanting vocabulary remains");
// Production choices load asynchronously; wait for the section to appear.
await waitFor(() => document.getElementById("production").classList.contains("hidden") === false, "production choices should render for Islay peated malt");
assert.ok(document.querySelectorAll("#productionChoices .production-choice").length > 0, "Islay peated profile must show its cask choices");

window.WhiskeyCompass.selectProfile("sherry-malt", "speyside");
await settle();
assert.equal(document.getElementById("maturity").classList.contains("hidden"), false);
assert.equal(document.querySelectorAll("#maturityStages .maturity-stage").length, 3);

// Bottle rendering on profiles.
window.WhiskeyCompass.selectProfile("pot-still", "ireland");
await settle();
assert.ok(document.querySelectorAll(".bottle-card").length >= 2, "profile card must render its bottles");
assert.ok(document.getElementById("bottleList").textContent.includes("Redbreast"));

// Glossary interaction still works.
const peatTerm = document.querySelector('.glossary-term[data-glossary-id="peat"]');
assert.ok(peatTerm);
peatTerm.click();
await settle();
assert.equal(document.getElementById("glossaryDialogTitle").textContent, "Peat");
document.getElementById("glossaryClose").click();

// --- Comparison groups: honest labels, meaningful cross-style comparisons ---
window.WhiskeyCompass.selectProfile("tennessee", "tennessee");
await settle();
window.WhiskeyCompass.setMode("compare");
await settle();
const adv1 = document.getElementById("advancedCompare1");
const adv2 = document.getElementById("advancedCompare2");
const biggestOnly = document.getElementById("advancedBiggestOnly");
assert.ok(adv1 && adv2);
assert.match(adv1.value, /^tennessee::tennessee$/);
const tennesseeOptions = [...adv2.options].map(option => option.value).filter(Boolean);
assert.ok(tennesseeOptions.some(value => value.startsWith("bourbon::")), "Tennessee must be able to compare against bourbon");
assert.ok(tennesseeOptions.some(value => value.startsWith("rye::")), "Tennessee must be able to compare against rye");
const hint = document.getElementById("advancedCompareHint");
assert.match(hint.textContent, /American whiskeys/i, "the compare hint must use accurate group terminology");

adv2.value = tennesseeOptions.find(value => value.startsWith("bourbon::"));
adv2.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();
// Two selections do not enable concise mode; only a full third slot does.
assert.equal(biggestOnly.checked, false);
const adv3 = document.getElementById("advancedCompare3");
const thirdOption = tennesseeOptions.find(value => value.startsWith("rye::"));
adv3.value = thirdOption;
adv3.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();
assert.equal(biggestOnly.checked, true, "a filled third slot enables concise mode");
assert.ok(document.querySelectorAll("#advancedCompareGrid .compareCard").length === 3, "all three comparison cards render");

// --- Recommendations: accurate explanations ---
window.WhiskeyCompass.selectProfile("tennessee", "tennessee");
await settle();
const reasons = [...document.querySelectorAll(".similar-reason")].map(node => node.textContent);
assert.ok(reasons.length > 0);
assert.ok(reasons.every(reason => !/another tennessee whiskey/i.test(reason)),
  "recommendations must not describe wheated bourbon as 'another Tennessee whiskey'");
assert.ok(reasons.every(reason => !/scotch malt whiskies/i.test(reason)),
  "Japanese and Indian malts must not be labelled as Scotch");

// Pot still has meaningful comparisons now (Irish malt was added).
window.WhiskeyCompass.selectProfile("pot-still", "ireland");
await settle();
const potStillComparisons = [...document.querySelectorAll("#similarProfiles .similar-item")];
assert.ok(potStillComparisons.length > 0, "pot still must have at least one eligible recommendation");

console.log("OK: Whiskey Compass DOM smoke tests passed");
await close();
