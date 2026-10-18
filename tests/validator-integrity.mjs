import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runValidate(appDir) {
  try {
    execFileSync("python3", [path.join(appDir, "scripts/validate.py")], { encoding: "utf8" });
    return { ok: true };
  } catch (error) {
    return { ok: false, stderr: error.stderr };
  }
}

function withCorruptedData(mutate, expectation, message) {
  const work = mkdtempSync(path.join(tmpdir(), "whiskey-compass-"));
  try {
    cpSync(ROOT, path.join(work, "app"), { recursive: true, filter: source => !source.includes("node_modules") && !source.includes(".git") });
    const appDir = path.join(work, "app");
    const dataPath = path.join(appDir, "data/regions-discovery.json");
    const data = JSON.parse(readFileSync(dataPath, "utf8"));
    mutate(data);
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
    const result = runValidate(appDir);
    expectation(result);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Unknown profile-level source IDs must fail validation.
withCorruptedData(
  data => { data.india.styles["indian-malt"].sources = ["made-up-source"]; },
  result => {
    assert.equal(result.ok, false, "an unknown profile source ID must fail validation");
    assert.match(result.stderr, /unknown profile source/);
  }
);
console.log("OK: unknown profile source IDs rejected");

// Pre-clamp out-of-range combined scores must fail validation.
withCorruptedData(
  data => { data.india.styles["indian-peated-malt"].mods.smoke = 3.5; },
  result => {
    assert.equal(result.ok, false, "a combined score beyond 5 must fail validation before clamping");
    assert.match(result.stderr, /out of range before clamping/);
  }
);
console.log("OK: out-of-range combined scores rejected before clamping");

console.log("OK: validator integrity tests passed");
