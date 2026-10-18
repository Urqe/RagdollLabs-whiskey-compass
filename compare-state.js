/* The comparison model owns keys and display preference. DOM controls are views.
 * Every transaction validates, commits atomically, then emits one notification.
 */
window.WhiskeyComparison = (() => {
  let keys = ["", "", ""];
  let biggestOnly = false;
  function profile(key) {
    if (!key) return null;
    const [styleId, regionId] = key.split("::");
    return WhiskeyCompass.combinedProfile(styleId, regionId);
  }
  const keyOf = item => typeof item === "string" ? item : `${item.styleId}::${item.regionId}`;
  const snapshot = () => ({ keys: keys.slice(), biggestOnly });
  function commit(next, concise, resetWhenThirdCleared = false) {
    const seen = new Set();
    let reference = null;
    keys = [0, 1, 2].map(index => {
      const key = next[index] || "";
      const item = profile(key);
      if (!item || seen.has(key) || (reference && !WhiskeyModel.compatible(reference, item))) return "";
      if (!reference) reference = item;
      seen.add(key);
      return key;
    });
    // Keep filled slots contiguous: if slot 1 is empty, promote the next filled slot.
    if (!keys[0]) keys = keys.filter(Boolean).concat(["", "", ""]).slice(0, 3);
    biggestOnly = Boolean(resetWhenThirdCleared && !keys[2] ? false : concise);
    document.dispatchEvent(new CustomEvent("whiskeycompass:comparison-changed", { detail: snapshot() }));
  }
  function replace(items, options = {}) {
    const next = items.filter(Boolean).slice(0, 3).map(keyOf);
    commit(next, options.biggestOnly ?? Boolean(next[2]), options.biggestOnly == null);
  }
  function setSlot(slot, key) {
    if (![1, 2, 3].includes(slot)) return;
    const next = keys.slice();
    next[slot - 1] = key;
    const concise = slot === 3 ? Boolean(key) : (slot === 1 && !next[2] ? false : biggestOnly);
    commit(next, concise, slot === 1 || slot === 3);
  }
  function remove(slot) {
    if (![1, 2, 3].includes(slot)) return;
    const next = keys.filter((_, index) => index !== slot - 1).filter(Boolean);
    commit(next, Boolean(next[2]));
  }
  function profiles() {
    return keys.map((key, index) => {
      const item = profile(key);
      return item ? { ...item, compareSlot: index + 1 } : null;
    }).filter(Boolean);
  }
  return Object.freeze({ snapshot, profiles, replace, setSlot, remove,
    setBiggestOnly: value => commit(keys, value) });
})();
