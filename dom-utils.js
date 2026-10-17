/* Plain-text DOM construction and reference URL policy.
 * HTML entity encoding remains only for legacy templates with known contexts.
 */
window.WhiskeyDOM = (() => {
  function element(tag, text = null, className = "") {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }
  function referenceUrl(value) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function referenceLink(source, label = source.name) {
    const url = referenceUrl(source.url);
    const node = element(url ? "a" : "span", label);
    if (url) {
      node.href = url;
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
    return node;
  }
  return Object.freeze({ element, referenceUrl, referenceLink });
})();
