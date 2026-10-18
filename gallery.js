/*
 * RagDollLabs Whiskey Compass — Overview gallery
 * ------------------------------------------------
 * A browse-everything view: all profiles grouped by country -> region,
 * with style-cue dots and one-line character notes. Reached from the
 * welcome screen and the sidebar; a table of contents for systematic
 * learners. Pure progressive enhancement over the existing profile API.
 */
(function initGallery() {
  function buildGallery() {
    const data = WhiskeyCompass.getData();
    const pairs = WhiskeyCompass.allPairs();
    const container = document.getElementById("galleryGrid");
    if (!container) return;

    const byCountry = new Map();
    for (const item of pairs) {
      const country = item.region.country;
      if (!byCountry.has(country)) byCountry.set(country, []);
      byCountry.get(country).push(item);
    }

    const countries = [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    container.replaceChildren();
    for (const [country, items] of countries) {
      const section = document.createElement("section");
      section.className = "gallery-country";
      section.setAttribute("aria-label", country);
      const heading = document.createElement("h3");
      heading.textContent = country;
      section.append(heading);
      const grid = document.createElement("div");
      grid.className = "gallery-region-grid";
      const byRegion = new Map();
      for (const item of items) {
        if (!byRegion.has(item.region.name)) byRegion.set(item.region.name, []);
        byRegion.get(item.region.name).push(item);
      }
      for (const [regionName, regionItems] of byRegion) {
        for (const item of regionItems) {
          const card = document.createElement("button");
          card.type = "button";
          card.className = "gallery-card";
          const head = document.createElement("div");
          head.className = "gallery-card-head";
          const dot = document.createElement("span");
          dot.className = `style-cue-dot ${WhiskeyModel.cue(item)}`;
          dot.setAttribute("aria-hidden", "true");
          const title = document.createElement("strong");
          title.textContent = item.style.name;
          head.append(dot, title);
          const region = document.createElement("span");
          region.className = "gallery-card-region";
          region.textContent = `${regionName} · ${country}`;
          const note = document.createElement("span");
          note.className = "gallery-card-note";
          note.textContent = item.regional.expect || "";
          card.append(head, region, note);
          card.addEventListener("click", () => {
            WhiskeyCompass.selectProfile(item.styleId, item.regionId, true);
          });
          grid.append(card);
        }
      }
      section.append(grid);
      container.append(section);
    }
  }

  function showGallery() {
    const gallery = document.getElementById("galleryView");
    const shell = document.getElementById("appShell");
    if (!gallery || !shell) return;
    document.getElementById("welcomeView")?.classList.add("hidden");
    document.getElementById("exploreView")?.classList.add("hidden");
    gallery.classList.remove("hidden");
    shell.classList.remove("hidden");
    buildGallery();
  }

  function hideGallery() {
    document.getElementById("galleryView")?.classList.add("hidden");
  }

  document.addEventListener("whiskeycompass:profile-selected", hideGallery);
  document.addEventListener("whiskeycompass:mode-changed", hideGallery);
  document.addEventListener("whiskeycompass:ready", () => {
    document.querySelectorAll("[data-gallery-open]").forEach(button =>
      button.addEventListener("click", showGallery));
    // The welcome "Explore whiskeys" flow keeps its place-first behavior;
    // the gallery is a separate, parallel entry point.
  });
})();
