import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const sourceIcon = path.join(rootDir, "src", "app", "icon.svg");
const resourcesDir = path.join(rootDir, "electron", "resources");
const linuxIconsDir = path.join(resourcesDir, "icons");

const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsTypesBySize = new Map([
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"],
]);

async function renderPng(size) {
  return sharp(sourceIcon, { density: 1024 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
}

function buildIco(entries) {
  const directorySize = 6 + entries.length * 16;
  const directory = Buffer.alloc(directorySize);
  let imageOffset = directorySize;

  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(entries.length, 4);

  for (const [index, { size, buffer }] of entries.entries()) {
    const entryOffset = 6 + index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    directory.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    directory.writeUInt8(0, entryOffset + 2);
    directory.writeUInt8(0, entryOffset + 3);
    directory.writeUInt16LE(1, entryOffset + 4);
    directory.writeUInt16LE(32, entryOffset + 6);
    directory.writeUInt32LE(buffer.length, entryOffset + 8);
    directory.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += buffer.length;
  }

  return Buffer.concat([directory, ...entries.map(({ buffer }) => buffer)]);
}

function buildIcns(entries) {
  const chunks = entries.map(({ type, buffer }) => {
    const chunk = Buffer.alloc(8 + buffer.length);
    chunk.write(type, 0, "ascii");
    chunk.writeUInt32BE(chunk.length, 4);
    buffer.copy(chunk, 8);
    return chunk;
  });

  const totalSize = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(totalSize, 4);

  return Buffer.concat([header, ...chunks], totalSize);
}

await mkdir(resourcesDir, { recursive: true });
await rm(linuxIconsDir, { recursive: true, force: true });
await mkdir(linuxIconsDir, { recursive: true });

const sourceSvg = await readFile(sourceIcon);
await writeFile(path.join(resourcesDir, "icon.svg"), sourceSvg);

const pngs = new Map();
for (const size of pngSizes) {
  const png = await renderPng(size);
  pngs.set(size, png);
  await writeFile(path.join(linuxIconsDir, `${size}x${size}.png`), png);
}

await writeFile(path.join(resourcesDir, "icon.png"), pngs.get(512));
await writeFile(
  path.join(resourcesDir, "icon.ico"),
  buildIco(icoSizes.map((size) => ({ size, buffer: pngs.get(size) })))
);
await writeFile(
  path.join(resourcesDir, "icon.icns"),
  buildIcns(
    [...icnsTypesBySize].map(([size, type]) => ({
      type,
      buffer: pngs.get(size),
    }))
  )
);

console.log("Generated Electron icons in electron/resources");
