import { readdir, rm, access } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const rootDir = dirname(fileURLToPath(import.meta.url));
const deep = process.argv.includes("--deep");
const removed = [];

const artifacts = [
  ".cache",
  ".expo",
  ".gradle",
  ".next",
  ".turbo",
  ".vitest",
  ".wrangler",
  "coverage",
  "dist",
  "dist-electron",
  "out",
  "playwright-report",
  "storybook-static",
  "test-results",
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function remove(p) {
  if (!(await exists(p))) return;
  await rm(p, { recursive: true, force: true });
  removed.push(relative(rootDir, p) || p);
}

async function cleanDir(dir) {
  for (const name of artifacts) {
    await remove(join(dir, name));
  }

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
      await remove(join(dir, entry.name));
    }
  }

  if (deep) {
    await remove(join(dir, "node_modules"));
  }
}

if (await exists(join(rootDir, "turbo.json"))) {
  try {
    execSync("node_modules/.bin/turbo daemon stop", {
      cwd: rootDir,
      stdio: "ignore",
      timeout: 10_000,
    });
  } catch {}
}

await cleanDir(rootDir);
await remove(join(rootDir, "node_modules", ".cache"));

for (const wsDir of ["apps", "packages"]) {
  const wsPath = join(rootDir, wsDir);
  if (!(await exists(wsPath))) continue;

  const entries = await readdir(wsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await cleanDir(join(wsPath, entry.name));
    }
  }
}

if (removed.length === 0) {
  console.log("Nothing to clean.");
} else {
  console.log(`Removed ${removed.length} item(s):`);
  for (const p of removed) {
    console.log(`  ${p}`);
  }
}
