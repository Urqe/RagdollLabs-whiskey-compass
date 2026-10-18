/* Shared whiskey semantics. These definitions have no DOM or loading dependency. */
window.WhiskeyModel = (() => {
  const metrics = [
    { key: "body", label: "Body", compare: true, high: "Fuller-bodied", low: "Lighter body", advancedHigh: "fuller-bodied", advancedLow: "lighter" },
    { key: "smoke", label: "Peat & smoke", compare: true, high: "Smokier and more peated", low: "Cleaner and less smoky", advancedHigh: "smokier and more peated", advancedLow: "cleaner and less smoky" },
    { key: "sweetness", label: "Sweetness", compare: false, high: "Sweeter", low: "Drier", advancedHigh: "sweeter", advancedLow: "drier" },
    { key: "spice", label: "Spice", compare: true, high: "Spicier", low: "Softer spice", advancedHigh: "spicier", advancedLow: "softer in spice" },
    { key: "fruit", label: "Fruit", compare: true, high: "More fruit-forward", low: "More restrained fruit", advancedHigh: "more fruit-forward", advancedLow: "more restrained in fruit" },
    { key: "oak", label: "Oak", compare: true, high: "More oak-driven", low: "Less oak influence", advancedHigh: "more oak-influenced", advancedLow: "less oak-influenced" },
    { key: "finish", label: "Finish length", compare: true, high: "Longer finish", low: "Shorter finish", advancedHigh: "longer-finishing", advancedLow: "shorter-finishing" },
    { key: "heat", label: "ABV feel", compare: false, high: "Hotter", low: "Gentler", advancedHigh: "hotter on the palate", advancedLow: "gentler on the palate" }
  ].map(Object.freeze);
  Object.freeze(metrics);
  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const cue = item => item.regional?.style?.cue || item.style.cue;
  const COMPARE_GROUPS = { "malt": "malt-whiskey-comparisons", "bourbon": "american-whiskey-comparisons", "rye": "american-whiskey-comparisons", "wheat": "american-whiskey-comparisons", "tennessee": "american-whiskey-comparisons", "pot-still": "irish-whiskey-comparisons", "blended": "blended-whiskey-comparisons", "corn": "american-whiskey-comparisons" };
  const COMPARE_GROUP_LABELS = {
    "malt-whiskey-comparisons": "malt whiskies from any country",
    "american-whiskey-comparisons": "American whiskeys (bourbon, rye, wheated, Tennessee)",
    "irish-whiskey-comparisons": "Irish whiskeys (pot still, single malt, blended)",
    "blended-whiskey-comparisons": "blended whiskeys from any country"
  };
  const familyKey = item => item.regional?.style?.family || item.style.family || "malt";
  const COMPARE_GROUP_OVERRIDES = { "irish-malt": "irish-whiskey-comparisons" };
  const compareGroup = item => COMPARE_GROUP_OVERRIDES[item.styleId] || COMPARE_GROUPS[familyKey(item)] || familyKey(item);
  const compareGroupLabel = item => COMPARE_GROUP_LABELS[compareGroup(item)] || familyKey(item);
  const compatible = (a, b) => Boolean(a && b && compareGroup(a) === compareGroup(b));
  const FLAVOR_LANGUAGE = {
    body: { high: "fuller and weightier on the tongue", low: "lighter and easier-sipping", shared: "full-bodied and weighty" },
    smoke: { high: "smokier, with more bonfire and peat", low: "cleaner, with barely any smoke", shared: "smoky, with bonfire peat" },
    sweetness: { high: "sweeter, more honey and caramel", low: "drier, less sweet", shared: "sweet with honey and caramel" },
    spice: { high: "spicier, with more rye kick and pepper", low: "softer, with gentle spice", shared: "spicy, with rye kick and pepper" },
    fruit: { high: "fruitier, more orchard and dried fruit", low: "more restrained on fruit", shared: "fruity, orchard and dried fruit" },
    oak: { high: "more oak-driven, with more vanilla and wood spice", low: "less oak influence, more spirit character", shared: "oak-driven, with vanilla and wood spice" },
    finish: { high: "longer-finishing, flavors that linger", low: "shorter, quicker finish", shared: "long-finishing" },
    heat: { high: "hotter, more alcohol burn", low: "gentler, smoother to sip", shared: "warm with a gentle burn" }
  };
  Object.freeze(FLAVOR_LANGUAGE);
  const flavorPhrase = (key, direction) => FLAVOR_LANGUAGE[key]?.[direction] || key;
  return Object.freeze({ metrics, normalize, cue, familyKey, compareGroup, compareGroupLabel, compatible, flavorPhrase });
})();
