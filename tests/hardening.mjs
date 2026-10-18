import assert from "node:assert/strict";
import { createApp } from "./harness.mjs";

const app = await createApp();
const { window: w, document: d } = app;
await app.settle();

const profile = (style, region) => w.WhiskeyCompass.combinedProfile(style, region);
const keys = () => Array.from(w.WhiskeyComparison.snapshot().keys);

const bourbon = profile("bourbon", "kentucky");
const wheated = profile("wheated-bourbon", "kentucky");
const rye = profile("rye", "kentucky");
const islay = profile("heavily-peated-malt", "islay");
const speyside = profile("unpeated-malt", "speyside");

w.WhiskeyCompass.setMode("compare");
w.WhiskeyComparison.replace([bourbon, wheated, rye]);

let notifications = 0;
const changed = () => { notifications += 1; };
d.addEventListener("whiskeycompass:comparison-changed", changed);

w.WhiskeyComparison.replace([islay, speyside]);
assert.equal(notifications, 1, "replacement must be one atomic transaction");
assert.deepEqual(keys(), ["heavily-peated-malt::islay", "unpeated-malt::speyside", ""], "old third whiskey must be cleared");
assert.equal(d.querySelectorAll("#advancedCompareGrid .compareCard").length, 2);
assert.equal(d.getElementById("advancedCompare3").value, "");
assert.equal(d.querySelector('.advanced-slot-remove[data-slot="1"]').hidden, false);
assert.equal(d.querySelector('.advanced-slot-remove[data-slot="2"]').hidden, false);
assert.equal(d.querySelector('.advanced-slot-remove[data-slot="3"]').hidden, true);

const slotOneRemove = d.querySelector('.advanced-slot-remove[data-slot="1"]');
slotOneRemove.click();
assert.deepEqual(keys(), ["unpeated-malt::speyside", "", ""], "slot removal must promote the next whiskey");
assert.equal(slotOneRemove.hidden, false, "the promoted first whiskey must remain removable");

w.WhiskeyComparison.replace([islay, speyside]);
const leakedSnapshot = w.WhiskeyComparison.snapshot();
leakedSnapshot.keys[0] = "tampered";
assert.equal(keys()[0], "heavily-peated-malt::islay", "snapshots must not expose the state array");

w.advancedSeedProfile(bourbon);
const input = d.getElementById("compareDiscoveryInput");
input.value = "bourbon";
await w.compareRunDiscovery();
assert.equal(d.querySelector("#compareDiscoveryResults button").disabled, true);

w.advancedRemoveSlot(1);
assert.equal(d.querySelector("#compareDiscoveryResults button").disabled, false, "Remove must refresh discovery without another query");
assert.equal(d.querySelector("#compareDiscoveryResults button").textContent, "Add");
d.querySelector("#compareDiscoveryResults button").click();
assert.deepEqual(keys(), ["bourbon::kentucky", "", ""]);
assert.equal(d.querySelector("#compareDiscoveryResults button").textContent, "Added");

// Manual changes, duplicates and compatibility share the same rules as discovery.
w.WhiskeyComparison.replace([bourbon, wheated, rye]);
const slot1 = d.getElementById("advancedCompare1");
slot1.value = "unpeated-malt::islay";
slot1.dispatchEvent(new w.Event("change", { bubbles: true }));
// Any-vs-any: changing slot 1 to a different family keeps the other
// selections; only duplicates are rejected.
assert.deepEqual(keys(), ["unpeated-malt::islay", "wheated-bourbon::kentucky", "rye::kentucky"]);
// A full three-slot selection enables concise mode (documented semantic).
assert.equal(d.getElementById("advancedBiggestOnly").checked, true);

w.WhiskeyComparison.replace([bourbon, bourbon, profile("unpeated-malt", "islay")]);
// Any-vs-any: the duplicate bourbon is rejected, but the cross-category
// malt companion is kept (group-based clearing is gone).
assert.deepEqual(keys(), ["bourbon::kentucky", "", "unpeated-malt::islay"]);

w.WhiskeyComparison.replace([bourbon]);
w.WhiskeyComparison.setSlot(3, "wheated-bourbon::kentucky");
w.WhiskeyComparison.remove(1);
assert.deepEqual(keys(), ["wheated-bourbon::kentucky", "", ""], "a filled third slot must be promoted when slot 2 is empty");
w.WhiskeyComparison.setSlot(3, "missing::profile");
assert.equal(w.WhiskeyComparison.snapshot().biggestOnly, false, "invalid third selection must not enable concise mode");
w.WhiskeyComparison.setBiggestOnly(true);
assert.equal(d.getElementById("advancedBiggestOnly").checked, true);

d.removeEventListener("whiskeycompass:comparison-changed", changed);
assert.equal(d.querySelectorAll("#compareGrid .compareCard").length, 0, "hidden legacy comparison must not be rendered");
assert.ok(Object.isFrozen(w.WhiskeyModel.metrics));

// Entity encoding is tested only in its documented HTML contexts.
const payloads = [
  '<img src=x onerror="alert(1)">',
  '"><svg onload=alert(1)>',
  "' autofocus onfocus=alert(1) x='",
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '` onmouseover=alert(1)'];
for (const value of payloads) {
  const host = d.createElement("div");
  host.innerHTML = `<span>${w.WhiskeyCompass.escapeHtml(value)}</span><input value="${w.WhiskeyCompass.escapeAttr(value)}">`;
  assert.equal(host.querySelector("span").textContent, value);
  assert.equal(host.querySelector("input").getAttribute("value"), value);
  assert.equal(host.querySelectorAll("img, svg, script, [onerror], [onload], [onfocus], [onmouseover]").length, 0);
}

// --- Optional glossary fetch failing still yields an explained dialog ---
{
  const app404 = await createApp({ fetch: async (resource, options, localFetch) => {
    const url = String(resource);
    if (url.includes("glossary.json")) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    return localFetch(resource, options);
  } });
  const { window: w404, document: d404, settle: settle404 } = app404;
  await settle404();
  d404.getElementById("glossaryOpen").click();
  await settle404();
  await settle404();
  assert.equal(d404.getElementById("glossaryDialog").open, true, "the glossary dialog must open even when its data failed to load");
  const content = d404.getElementById("glossaryContent").textContent;
  assert.ok(content.includes("Definitions could not be loaded"), "the dialog must explain the failure");
  assert.ok(content.includes("Reload the page to retry"), "the dialog must offer the retry action");
  await app404.close();
}

console.log("OK: Whiskey Compass hardening tests passed");
await app.close();
