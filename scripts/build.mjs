// Builds store-ready zips into dist/:
//   abs-smooth-video-chrome-<version>.zip   (Chrome Web Store, Edge Add-ons)
//   abs-smooth-video-firefox-<version>.zip  (addons.mozilla.org)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "extension");
const dist = path.join(root, "dist");

const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
const fixJs = fs.readFileSync(path.join(src, "fix.js"), "utf8");
if (!fixJs.includes(`const VERSION = "${manifest.version}"`)) {
  console.error(`Version mismatch: manifest is ${manifest.version} but fix.js VERSION differs.`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

function stage(name, editManifest) {
  const dir = path.join(dist, name);
  fs.cpSync(src, dir, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });
  const m = editManifest(structuredClone(manifest));
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
  const zip = path.join(dist, `abs-smooth-video-${name}-${manifest.version}.zip`);
  execFileSync("zip", ["-q", "-r", "-X", zip, "."], { cwd: dir });
  fs.rmSync(dir, { recursive: true });
  console.log("built", path.relative(root, zip));
}

stage("chrome", (m) => m);

stage("firefox", (m) => {
  delete m.minimum_chrome_version;
  m.browser_specific_settings = {
    gecko: {
      id: "{d554b32f-5a68-4e9f-b26d-8053f4ef82c5}",
      strict_min_version: "128.0",
      data_collection_permissions: { required: ["none"] },
    },
  };
  return m;
});
