import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const directory = process.argv[2] || process.env.CERTO_RUN_GOLDEN_DIR;
if (!directory) throw new Error("Provide the extracted supplied golden directory.");
const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8"));
const inventory = JSON.parse(readFileSync(path.join(directory, "interaction-inventory.json"), "utf8"));
const groups = {};
const images = manifest.shots.map((shot) => {
  if (!/^(desktop|phone|desktop-empty)\/[\w-]+\.png$/.test(shot.file)) throw new Error(`Unexpected baseline path: ${shot.file}`);
  const bytes = readFileSync(path.join(directory, shot.file));
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error(`Not PNG: ${shot.file}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const phone = shot.file.startsWith("phone/");
  if (width !== (phone ? 1170 : 1360)) throw new Error(`Unexpected pixel width ${width}: ${shot.file}`);
  groups[shot.file.split("/")[0]] = (groups[shot.file.split("/")[0]] || 0) + 1;
  return { file: shot.file, width, height, sha256: createHash("sha256").update(bytes).digest("hex") };
});
if (images.length !== 125 || Object.keys(inventory).length !== 50 || Object.values(inventory).flat().length !== 3113) throw new Error("Baseline counts differ from the supplied v2 contract.");
console.log(JSON.stringify({clock:manifest.clock, groups, screenshots:images.length, inventoryScreens:50, controls:3113, fixturePresent:existsSync(path.join(directory,"fixture-certo-run-ingest.json")), images}, null, 2));
