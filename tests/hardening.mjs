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
assert.deepEqual(keys(), ["unpeated-malt::islay", "", ""]);
assert.equal(d.getElementById("advancedBiggestOnly").checked, false);

w.WhiskeyComparison.replace([bourbon, bourbon, profile("unpeated-malt", "islay")]);
assert.deepEqual(keys(), ["bourbon::kentucky", "", ""]);

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

console.log("OK: Whiskey Compass hardening tests passed");
await app.close();
