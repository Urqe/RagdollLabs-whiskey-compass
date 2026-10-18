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
assert.equal(document.querySelectorAll("[data-welcome-action]").length, 4);
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

// Amrut Fusion is genuinely peated: it has its own peated profile, separate
// from the unpeated Indian expression (Rampur).
const amrutPeated = window.WhiskeyCompass.combinedProfile("indian-peated-malt", "india");
assert.ok(amrutPeated.profile.smoke >= 3, "Amrut Fusion's profile must reflect its pronounced peat");
const rampurUnpeated = window.WhiskeyCompass.combinedProfile("indian-malt", "india");
assert.ok(rampurUnpeated.profile.smoke <= 1.5, "the unpeated Indian expression must not carry Fusion's peat");

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
assert.match(hakushu[0].textContent, /Japanese lightly peated malt/i, "hakushu must resolve to the peated Hakushu-style profile");

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
// Whiskey-native serving guidance: five boxes including the age window.
const serveBoxes = [...document.querySelectorAll("#serve .box")].map(box => box.textContent.trim());
assert.equal(serveBoxes.length, 5, "serving guidance shows five boxes");
assert.ok(serveBoxes.some(box => box.startsWith("Age window")), "the age window box must render");
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
assert.ok(tennesseeOptions.some(value => value.startsWith("heavily-peated-malt::")), "any-vs-any: Tennessee can also compare against an Islay malt");
assert.ok(tennesseeOptions.some(value => value.startsWith("pot-still::")), "any-vs-any: Tennessee can also compare against Irish pot still");
const hint = document.getElementById("advancedCompareHint");
assert.match(hint.textContent, /region and production route|eight sensory scales/i, "the compare hint must reflect free any-vs-any comparison");

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

// --- Any-vs-any: Blended Scotch vs sherry-cask malt, cross-category render ---
window.WhiskeyCompass.selectProfile("blended-scotch", "scotland-blends");
await settle(); await settle();
window.WhiskeyCompass.setMode("compare");
await settle(); await settle();
const blendSlot1 = document.getElementById("advancedCompare1");
blendSlot1.value = "blended-scotch::scotland-blends";
blendSlot1.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle(); await settle();
assert.match(blendSlot1.value, /^blended-scotch::scotland-blends$/);
const blendSlot2 = document.getElementById("advancedCompare2");
const blendOptions = [...blendSlot2.options].map(option => option.value).filter(Boolean);
assert.ok(blendOptions.includes("sherry-malt::speyside"), "the acceptance case: sherry-cask malt offered next to Blended Scotch");
// Clear slot 3 left by the earlier three-slot flow, then select the sherry malt.
const blendSlot3 = document.getElementById("advancedCompare3");
if (blendSlot3.value) {
  blendSlot3.value = "";
  blendSlot3.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
}
blendSlot2.value = "sherry-malt::speyside";
blendSlot2.dispatchEvent(new window.Event("change", { bubbles: true }));
await settle();
assert.equal(document.querySelectorAll("#advancedCompareGrid .compareCard").length, 2, "cross-category comparison renders both cards");
assert.ok(document.querySelector(".category-span-note"), "cross-category comparisons show the production-routes qualifier");
assert.ok(document.querySelectorAll("#advancedCompareDifferences .diff-row").length > 0, "differences render for the cross-category pair");
// Same-family comparison omits the qualifier.
window.WhiskeyComparison.replace([
  window.WhiskeyCompass.combinedProfile("heavily-peated-malt", "islay"),
  window.WhiskeyCompass.combinedProfile("unpeated-malt", "islay")
]);
await settle();
assert.ok(!document.querySelector(".category-span-note"), "same-family comparisons do not show the qualifier");

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

// --- Governance: editorial transparency and qualified advice ---
// The sensory chart explains its editorial scale.
assert.ok(document.querySelector(".editorial-scale-note"),
  "the style profile must explain that scores are editorial judgements");
// Japan's malt expressions are separate profiles with distinct charts.
const yamazakiProfile = window.WhiskeyCompass.combinedProfile("japanese-malt-unpeated", "japan");
const hakushuProfile = window.WhiskeyCompass.combinedProfile("japanese-malt-peated", "japan");
assert.ok(yamazakiProfile && hakushuProfile, "both Japanese malt profiles must exist");
assert.ok(hakushuProfile.profile.smoke - yamazakiProfile.profile.smoke >= 1,
  "Hakushu-style must chart as materially smokier than Yamazaki-style");
assert.match(String(hakushuProfile.regional.phenol), /lightly peated/i);
assert.match(String(yamazakiProfile.regional.phenol), /unpeated/i);
// Sources drawer renders profile-level sources for Japan.
window.WhiskeyCompass.selectProfile("japanese-malt-unpeated", "japan");
await settle();
const sourcesText = document.getElementById("sourcesDrawer").textContent;
assert.ok(sourcesText.includes("Suntory") || sourcesText.includes("Nikka"),
  "Japan profile sources must include producer references");
assert.ok(sourcesText.toLowerCase().includes("editorial"),
  "methodology note must mention editorial judgement");
// The peating classification is user-visible on the profile, not just in data.
const peatingRow = document.querySelector("#specialStyle dt");
assert.ok([...document.querySelectorAll("#specialStyle dt")].some(dt => dt.textContent === "Peating"),
  "the production section must show the peating classification");
assert.ok(document.getElementById("specialStyle").textContent.includes("Yamazaki"),
  "Japan's peating row must name the house style");

// --- Every mood button selects a profile on a fresh load ---
const moodButtons = [...document.querySelectorAll("#moodButtons .mood")];
assert.equal(moodButtons.length, 6, "all six moods render");
// The id set is the contract shared with validate.py MOOD_PREDICATES; drift here means the sync guard is broken.
assert.deepEqual(new Set(moodButtons.map(button => button.dataset.mood)),
  new Set(["light-delicate", "big-rich", "smoky-briny", "sweet-sherried", "spicy-bold", "something-unusual"]),
  "mood ids must match the set mirrored in scripts/validate.py");
for (const button of moodButtons) {
  button.click();
  await settle();
  assert.ok(!document.getElementById("exploreView").classList.contains("hidden"),
    `mood '${button.dataset.mood}' must open a profile`);
  assert.ok(document.getElementById("title").textContent.trim().length > 0,
    `mood '${button.dataset.mood}' must set a profile title`);
}

// --- Landing page featured pours carry real tasting cues ---
const featuredCues = [...document.querySelectorAll("#featuredDiscoveries .tasting-cue")];
assert.equal(featuredCues.length, 3, "three featured pours render");
for (const cue of featuredCues) {
  assert.ok(cue.textContent.trim().length > 0, "each featured pour needs a tasting cue");
  assert.ok(!cue.textContent.includes("undefined"), "no literal undefined may render as a tasting cue");
}

// --- Discovery language: flavor explanations, not technical jargon ---
window.WhiskeyCompass.selectProfile("bourbon", "kentucky");
await settle();
const bourbonReasons = [...document.querySelectorAll("#similarProfiles .similar-reason")].map(n => n.textContent);
assert.ok(bourbonReasons.length > 0);
assert.ok(bourbonReasons.every(reason => !/regionalSignature|comparison group|meaningfully comparable|Closest on/i.test(reason)),
  "recommendations must not use technical comparison vocabulary");
assert.ok(bourbonReasons.every(reason => !/both are smoky/i.test(reason)),
  "bourbon recommendations must not claim smokiness as a shared trait");
// Compare differences speak flavor language.
window.WhiskeyCompass.setMode("compare");
await settle();
assert.ok(!document.body.textContent.includes("trends"), "difference sentences must use flavor language");

// --- Regression: no geography-based smoke claims in recommendations ---
// From unpeated Lowlands, a recommendation to unpeated Islay must not promise smoke.
window.WhiskeyCompass.selectProfile("unpeated-malt", "lowlands");
await settle();
const lowlandsRecs = [...document.querySelectorAll("#similarProfiles .similar-item")];
const islayRec = lowlandsRecs.find(item => item.textContent.includes("Islay"));
assert.ok(islayRec, "an Islay recommendation must exist from unpeated Lowlands");
assert.ok(!/smok/i.test(islayRec.querySelector(".similar-reason").textContent),
  "a recommendation to unpeated Islay from unpeated Lowlands must not promise smoke");
// From unpeated Speyside and Highlands likewise.
for (const rid of ["speyside", "highlands"]) {
  window.WhiskeyCompass.selectProfile("unpeated-malt", rid);
  await settle();
  const rec = [...document.querySelectorAll("#similarProfiles .similar-item")].find(item => item.textContent.includes("Islay"));
  assert.ok(rec, `an Islay recommendation must exist from unpeated ${rid}`);
  assert.ok(!/smok/i.test(rec.querySelector(".similar-reason").textContent),
    `a recommendation to unpeated Islay from unpeated ${rid} must not promise smoke`);
}

// --- Regression: relative wording, no unsupported absolutes ---
// Comparing two strongly peated profiles must not call either "less smoky" in absolute terms.
const islayPeated2 = window.WhiskeyCompass.combinedProfile("heavily-peated-malt", "islay");
const campbeltownPeated = window.WhiskeyCompass.combinedProfile("heavily-peated-malt", "campbeltown");
assert.ok(islayPeated2.profile.smoke >= 4 && campbeltownPeated.profile.smoke >= 4,
  "both comparison members must be strongly peated for this regression");
// Flavour language contains only relative phrasing; no ingredient claims from scores.
const samplePhrases = [
  WhiskeyModel => WhiskeyModel.flavorPhrase("spice", "high"),
  WhiskeyModel => WhiskeyModel.flavorPhrase("smoke", "low"),
  WhiskeyModel => WhiskeyModel.flavorPhrase("smoke", "high")
].map(fn => fn(window.WhiskeyModel));
assert.ok(samplePhrases.every(phrase => !/rye|bonfire|iodine|barely/i.test(phrase)),
  "score-derived phrases must not claim specific ingredients or absolutes");
assert.equal(window.WhiskeyModel.flavorPhrase("smoke", "low"), "less smoky",
  "the lower-smoke member must be described relatively");

// --- Regression: India peated smoke calibrated, not clamped ---
const indiaPeated = window.WhiskeyCompass.combinedProfile("indian-peated-malt", "india");
assert.equal(indiaPeated.profile.smoke, 4, "Amrut Fusion expression must chart at exactly 4.0, not a clamped 5");

// --- Regression: Nikka From the Barrel not in the highball blend profile ---
const japanHighballBlend = window.WhiskeyCompass.combinedProfile("japanese-highball-blend", "japan");
assert.ok(!japanHighballBlend.regional.bottles.some(b => b.name.includes("Nikka")),
  "the light, highball-oriented blend profile must not include the 51.4% bold Nikka From the Barrel");
const japanBoldBlend = window.WhiskeyCompass.combinedProfile("japan-made-bold-blend", "japan");
assert.ok(japanBoldBlend.regional.bottles.some(b => b.name.includes("Nikka From the Barrel")),
  "Nikka From the Barrel must live in the bold blend profile where it belongs");
// Japan-made labelling and the imported-whisky disclosure are explicit.
assert.match(japanBoldBlend.style.name, /Japan-made bold blend/i,
  "the style must be labelled Japan-made, not categorically Japanese");
assert.ok(!japanBoldBlend.style.name.match(/^Japanese/),
  "the name must avoid implying the formal Japanese-whisky category");
assert.ok(String(japanBoldBlend.regional.expect).includes("imported whisky"),
  "the profile must disclose that it includes selected imported whisky (Nikka)");
assert.ok(japanBoldBlend.regional.bottles.some(b => b.note.includes("imported whisky")),
  "the bottle note must disclose the imported-whisky content");
assert.ok(!japanBoldBlend.regional.notes["Smoke / peat"],
  "no smoke note without a credible source");
assert.ok(!japanBoldBlend.regional.phenol,
  "no peating classification without a credible source");
assert.ok(String(japanBoldBlend.regional.serve).toLowerCase().includes("highball"),
  "highball must be a serving option");

// --- Nikka search resolves to the bold blend, not the highball Toki profile ---
const nikkaResults = await search("nikka");
assert.ok(nikkaResults.length > 0, "nikka must return a result");
assert.ok(nikkaResults.every(button => /Japan-made bold blend/i.test(button.textContent)),
  "nikka must resolve to the bold Nikka From the Barrel profile");
const ftbResults = await search("from the barrel");
assert.ok(ftbResults.length > 0, "from the barrel must return a result");
assert.ok(ftbResults.every(button => /Japan-made bold blend/i.test(button.textContent)),
  "from the barrel must not resolve to the light highball blend");
const tokiResults = await search("toki");
assert.ok(tokiResults.length > 0 && tokiResults.every(button => /Japanese highball blend/i.test(button.textContent)),
  "toki must resolve to the highball-oriented profile");

// --- Every producer alias returns at least one result ---
const producerQueries = ["laphroaig", "ardbeg", "lagavulin", "macallan", "glenfiddich", "talisker",
  "highland park", "springbank", "longrow", "hazelburn", "redbreast", "jameson", "bushmills",
  "yamazaki", "hakushu", "nikka", "amrut", "elijah craig", "wild turkey", "makers mark",
  "rittenhouse", "jack daniels", "george dickel", "crown royal", "kavalan"];
for (const query of producerQueries) {
  const results = await search(query);
  assert.ok(results.length > 0, `producer query '${query}' must return at least one result`);
}

// --- Browser history: Back walks profiles and returns to welcome ---
// Reset to the welcome entry first so the walk is deterministic.
window.WhiskeyCompass.clearProfileUrl();
await settle();
window.WhiskeyCompass.selectProfile("heavily-peated-malt", "islay");
await settle();
window.WhiskeyCompass.selectProfile("bourbon", "kentucky");
await settle();
assert.equal(window.history.length >= 3, true, "profile navigation creates history entries");
window.history.back();
for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 10));
assert.match(document.getElementById("title").textContent, /Islay/, "Back returns to the previous profile");
window.history.back();
for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 10));
assert.ok(!document.getElementById("welcomeView").classList.contains("hidden"), "Back from the first profile reaches the welcome screen");

// --- Gallery: every profile reachable without dropdowns ---
document.querySelector("[data-gallery-open]")?.click();
await settle();
const galleryCards = [...document.querySelectorAll(".gallery-card")];
assert.equal(galleryCards.length, window.WhiskeyCompass.allPairs().length,
  "the gallery shows every profile");
galleryCards[0].click();
await settle();
assert.ok(document.getElementById("galleryView").classList.contains("hidden"), "selecting from the gallery opens the profile");
assert.ok(document.getElementById("title").textContent.length > 0);

// --- Bottle-name search deep-links with the bottle highlighted ---
const laphroaigResults = await search("laphroaig");
assert.ok(laphroaigResults.length > 0, "laphroaig must be searchable");
laphroaigResults[0].click();
await settle();
assert.match(document.getElementById("title").textContent, /Islay/, "laphroaig lands on the Islay profile");
const highlightedBottle = document.querySelector(".bottle-highlight");
assert.ok(highlightedBottle && highlightedBottle.textContent.includes("Laphroaig 10"),
  "the Laphroaig 10 bottle card must be visible and highlighted");

// --- Welcome action labels match their flows ---
const placeAction = document.querySelector('[data-welcome-action="place"]');
assert.ok(placeAction, "the first welcome action is place-first");
assert.match(placeAction.textContent, /Find a place/, "the label matches the flow it launches");

console.log("OK: Whiskey Compass DOM smoke tests passed");
await close();
