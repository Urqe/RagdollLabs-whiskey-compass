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
  return Object.freeze({ metrics, normalize, cue, familyKey, compareGroup, compareGroupLabel, compatible });
})();
