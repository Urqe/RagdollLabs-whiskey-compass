/*
 * RagDollLabs Whiskey Compass — contextual learning layer
 * -------------------------------------------------
 * Advanced whiskey terms can be defined in place without turning profile prose into
 * permanent glossary clutter. Inline terms open the same native <dialog> used by
 * the full glossary browser in the sidebar.
 *
 * The dialog is opened with showModal() on supported browsers. That is deliberate:
 * the platform provides modal focus containment, an inert background and Escape
 * cancellation, so we do not maintain a second custom focus-trap implementation.
 * The fallback `open` attribute exists only for environments without showModal().
 *
 * Glossary JSON is optional enrichment and fails soft. A failed fetch is logged
 * and definitions stay unavailable for that page session; reload is the retry.
 */

let glossaryPromise = null;
let glossaryData = {};
let glossaryAliases = [];

function loadGlossary() {
  if (!glossaryPromise) {
    glossaryPromise = WhiskeyData.json(WhiskeyDataUrl("./data/glossary.json"), { optional: true }).then(data => {
      glossaryData = data;
      glossaryAliases = buildAliasIndex(data);
      return data;
    });
  }
  return glossaryPromise;
}

function buildAliasIndex(data) {
  const seen = new Set();
  const aliases = [];
  for (const [id, entry] of Object.entries(data || {})) {
    if (entry.inline === false) continue;
    for (const alias of [entry.term, ...(entry.aliases || [])]) {
      const normalized = String(alias).trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      aliases.push({ id, alias: String(alias).trim(), normalized });
    }
  }
  return aliases.sort((a, b) => b.alias.length - a.alias.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function glossaryRegex() {
  if (!glossaryAliases.length) return null;
  const alternatives = glossaryAliases.map(item => escapeRegExp(item.alias)).join("|");
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${alternatives})(?=$|[^\\p{L}\\p{N}])`, "giu");
}

function glossaryIdForAlias(alias) {
  const normalized = String(alias).toLocaleLowerCase();
  return glossaryAliases.find(item => item.normalized === normalized)?.id || null;
}

function shouldSkipGlossaryNode(node) {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue?.trim()) return true;
  return Boolean(parent.closest("button, a, script, style, input, select, textarea, .glossary-dialog, .glossary-term, [aria-hidden='true']"));
}

function annotateRoot(root, regex) {
  if (!root || !regex) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return shouldSkipGlossaryNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const text = node.nodeValue;
    regex.lastIndex = 0;
    let cursor = 0;
    let match;
    let changed = false;
    const fragment = document.createDocumentFragment();

    while ((match = regex.exec(text))) {
      const prefix = match[1] || "";
      const term = match[2];
      const id = glossaryIdForAlias(term);
      if (!id) continue;
      changed = true;
      const start = match.index;
      fragment.append(document.createTextNode(text.slice(cursor, start)));
      if (prefix) fragment.append(document.createTextNode(prefix));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "glossary-term";
      button.dataset.glossaryId = id;
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-label", `Define ${term}`);
      button.textContent = term;
      fragment.appendChild(button);
      cursor = regex.lastIndex;
    }

    if (!changed) continue;
    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}

async function annotateContext() {
  await loadGlossary();
  const regex = glossaryRegex();
  if (!regex) return;
  ["expect", "climate", "identity", "why", "production", "notes", "maturity"]
    .map(id => document.getElementById(id))
    .forEach(root => annotateRoot(root, regex));
}

function dialogElement() {
  return document.getElementById("glossaryDialog");
}

function openDialog() {
  const dialog = dialogElement();
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.getElementById("glossaryClose")?.focus();
}

function closeDialog() {
  const dialog = dialogElement();
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function glossaryEntryCard(entry, compact = false) {
  const article = document.createElement("article");
  article.className = compact ? "glossary-entry glossary-entry-focused" : "glossary-entry";
  const heading = document.createElement("h3");
  heading.textContent = entry.term;
  const definition = document.createElement("p");
  definition.textContent = entry.definition;
  const why = document.createElement("p");
  why.className = "glossary-why";
  const strong = document.createElement("strong");
  strong.textContent = "Why it matters: ";
  why.append(strong, document.createTextNode(entry.why));
  article.append(heading, definition, why);
  return article;
}

async function showGlossaryEntry(id) {
  await loadGlossary();
  const entry = glossaryData[id];
  if (!entry) {
    if (Object.keys(glossaryData).length === 0) return showGlossaryUnavailable();
    return;
  }
  const title = document.getElementById("glossaryDialogTitle");
  const intro = document.getElementById("glossaryIntro");
  const content = document.getElementById("glossaryContent");
  if (!title || !intro || !content) return;
  title.textContent = entry.term;
  intro.textContent = "A quick definition in the context of whiskey.";
  content.replaceChildren(glossaryEntryCard(entry, true));

  const browse = document.createElement("button");
  browse.type = "button";
  browse.className = "glossary-browse-all";
  browse.textContent = "Browse the full glossary";
  browse.addEventListener("click", showFullGlossary, { once: true });
  content.appendChild(browse);
  openDialog();
}

function showGlossaryUnavailable() {
  const title = document.getElementById("glossaryDialogTitle");
  const intro = document.getElementById("glossaryIntro");
  const content = document.getElementById("glossaryContent");
  if (!title || !intro || !content) return;
  title.textContent = "Whiskey glossary";
  intro.textContent = "Short explanations for technical terms that appear across Whiskey Compass.";
  const retry = document.createElement("p");
  retry.className = "small";
  retry.textContent = "Definitions could not be loaded. Reload the page to retry.";
  content.replaceChildren(retry);
  openDialog();
}

async function showFullGlossary() {
  await loadGlossary();
  if (!Object.keys(glossaryData).length) return showGlossaryUnavailable();
  const title = document.getElementById("glossaryDialogTitle");
  const intro = document.getElementById("glossaryIntro");
  const content = document.getElementById("glossaryContent");
  if (!title || !intro || !content) return;
  title.textContent = "Whiskey glossary";
  intro.textContent = "Short explanations for technical terms that appear across Whiskey Compass.";
  const entries = Object.values(glossaryData).sort((a, b) => a.term.localeCompare(b.term));
  content.replaceChildren(...entries.map(entry => glossaryEntryCard(entry)));
  openDialog();
}

function wireLearningLayer() {
  document.getElementById("glossaryOpen")?.addEventListener("click", showFullGlossary);
  document.getElementById("glossaryClose")?.addEventListener("click", closeDialog);
  dialogElement()?.addEventListener("click", event => {
    if (event.target === dialogElement()) closeDialog();
  });
  document.getElementById("exploreView")?.addEventListener("click", event => {
    const button = event.target.closest?.(".glossary-term");
    if (button) void showGlossaryEntry(button.dataset.glossaryId);
  });
}

document.addEventListener("whiskeycompass:ready", () => {
  wireLearningLayer();
  void loadGlossary();
  void annotateContext();
});

document.addEventListener("whiskeycompass:profile-selected", () => {
  void annotateContext();
});

document.addEventListener("whiskeycompass:production-rendered", () => {
  void annotateContext();
});

document.addEventListener("whiskeycompass:maturity-rendered", () => {
  void annotateContext();
});
