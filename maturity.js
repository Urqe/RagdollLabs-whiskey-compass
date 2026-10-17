/*
 * RagDollLabs Whiskey Compass — age-statement evolution
 * ----------------------------------------------------
 * This layer is intentionally sparse: only profiles with a meaningful bottle-age
 * story get an evolution section. It consumes validated data and never infers
 * maturity from the raw ageing-range string.
 *
 * The JSON is optional enrichment and deliberately fails soft. A fetch failure
 * logs an error and leaves the section hidden for that page session; reloading
 * the page is the retry path. Core profile browsing must not depend on this file.
 */

let maturityPromise = null;
let maturityProfile = null;

function loadMaturity() {
  if (!maturityPromise) maturityPromise = WhiskeyData.json("./data/maturity.json", { optional: true });
  return maturityPromise;
}

function signalMaturityRendered(profile, visible) {
  document.dispatchEvent(new CustomEvent("whiskeycompass:maturity-rendered", { detail: { profile, visible } }));
}

async function renderMaturity(profile) {
  const section = document.getElementById("maturity");
  const stagesTarget = document.getElementById("maturityStages");
  const summaryTarget = document.getElementById("maturitySummary");
  const vintageTarget = document.getElementById("vintageEffect");
  if (!section || !stagesTarget || !summaryTarget || !vintageTarget || !profile) return;

  const data = await loadMaturity();
  if (maturityProfile !== profile) return;
  const entry = data?.[profile.regionId]?.[profile.styleId];
  if (!entry) {
    section.classList.add("hidden");
    stagesTarget.replaceChildren();
    summaryTarget.textContent = "";
    vintageTarget.textContent = "";
    signalMaturityRendered(profile, false);
    return;
  }

  summaryTarget.textContent = entry.summary;
  stagesTarget.replaceChildren();
  for (const stage of entry.stages || []) {
    const article = document.createElement("article");
    article.className = "maturity-stage";
    const heading = document.createElement("h4");
    heading.textContent = stage.label;
    const text = document.createElement("p");
    text.textContent = stage.effect;
    article.append(heading, text);
    stagesTarget.appendChild(article);
  }
  vintageTarget.textContent = entry.vintage;
  section.classList.remove("hidden");
  signalMaturityRendered(profile, true);
}

document.addEventListener("whiskeycompass:ready", () => {
  void loadMaturity();
});

document.addEventListener("whiskeycompass:profile-selected", event => {
  maturityProfile = event.detail.profile;
  void renderMaturity(maturityProfile);
});

document.addEventListener("whiskeycompass:selection-needed", () => {
  maturityProfile = null;
  document.getElementById("maturity")?.classList.add("hidden");
});
