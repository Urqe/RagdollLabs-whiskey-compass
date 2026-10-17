import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function createApp({ fetch: intercept, expectError = false, omitScripts = [], url = "https://example.test/RagdollLabs-whiskey-compass/" } = {}) {
  const html = await readFile(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\s+src="\.\/([^"?]+)[^"]*"[^>]*><\/script>/g)]
    .map(match => match[1]).filter(file => !omitScripts.includes(file));
  const code = await Promise.all(scripts.map(file => readFile(path.join(ROOT, file), "utf8")));
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  async function localFetch(resource) {
    const pathname = new URL(typeof resource === "string" ? resource : resource.url, url).pathname;
    const relative = pathname.replace(/^\/RagdollLabs-whiskey-compass\//, "").replace(/^\//, "");
    try {
      const text = await readFile(path.join(ROOT, relative), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
    } catch {
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    }
  }
  window.fetch = async (resource, options) => {
    const replacement = intercept ? await intercept(resource, options, localFetch) : undefined;
    return replacement === undefined ? localFetch(resource) : replacement;
  };
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Whiskey Compass did not finish initialization")), 2000);
    const done = result => { clearTimeout(timeout); resolve(result); };
    document.addEventListener("whiskeycompass:ready", () => done("ready"), { once: true });
    document.addEventListener("whiskeycompass:error", () => done("error"), { once: true });
  });
  code.forEach(script => window.eval(script));
  // JSDOM emits DOMContentLoaded after this synchronous installation, exactly once.
  const status = await ready;
  assert.equal(status, expectError ? "error" : "ready");
  async function settle() {
    await window.WhiskeyData.whenIdle();
    // Drain promise continuations/DOM mutations without a guessed millisecond delay.
    await new Promise(resolve => setImmediate(resolve));
  }
  async function waitFor(predicate, message = "condition was not met") {
    if (predicate()) return;
    await new Promise((resolve, reject) => {
      const observer = new window.MutationObserver(check);
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(message)); }, 1000);
      function check() {
        if (!predicate()) return;
        clearTimeout(timeout); observer.disconnect(); resolve();
      }
      observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      check();
    });
  }
  async function close() {
    await settle();
    assert.deepEqual(errors.map(error => error.message), [], "unexpected browser script errors");
    window.close();
  }
  return { window, document, settle, waitFor, close, errors, scripts };
}
