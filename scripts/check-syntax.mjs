import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const files = (await Promise.all([".", "scripts", "tests"].map(async dir =>
  (await readdir(dir)).filter(name => /\.(m?js)$/.test(name)).map(name => `${dir}/${name}`)))).flat();
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
console.log(`OK: syntax checked ${files.length} JavaScript files`);
