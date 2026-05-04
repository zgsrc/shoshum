import type { BinaryFormatKind } from "../binaryFormatSniffer";

export interface BinaryAssetFixture {
  id: string;
  fileName: string;
  expectedKind: BinaryFormatKind;
  base64: string;
}

export const BINARY_ASSET_FIXTURES: readonly BinaryAssetFixture[] = [
  {
    id: "png-1x1",
    fileName: "pixel.png",
    expectedKind: "png",
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  },
  {
    id: "jpeg-marker-stream",
    fileName: "marker-stream.jpg",
    expectedKind: "jpeg",
    base64: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wAEAAD/2Q==",
  },
  {
    id: "gif-1x1",
    fileName: "pixel.gif",
    expectedKind: "gif",
    base64: "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  },
  {
    id: "ico-1x1",
    fileName: "icon.ico",
    expectedKind: "ico",
    base64: "AAABAAEAAQEAAAEAIAAEAAAAFgAAAAAAAAA=",
  },
  {
    id: "gzip-empty",
    fileName: "empty.gz",
    expectedKind: "gzip",
    base64: "H4sIAAAAAAAAAwMAAAAAAAAAAAA=",
  },
  {
    id: "sevenzip-header",
    fileName: "archive.7z",
    expectedKind: "7z",
    base64: "N3q8ryccAAQAAAAAAAAAAA==",
  },
  {
    id: "rar4-marker",
    fileName: "archive.rar",
    expectedKind: "rar",
    base64: "UmFyIRoHAA==",
  },
  {
    id: "tar-header",
    fileName: "archive.tar",
    expectedKind: "tar",
    base64:
      "aGVsbG8udHh0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAwMDAwMDA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1c3RhcgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
  {
    id: "sqlite-header",
    fileName: "database.sqlite",
    expectedKind: "sqlite",
    base64:
      "U1FMaXRlIGZvcm1hdCAzABAAAQEAQCAgAAAAAQAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  },
  {
    id: "wasm-module",
    fileName: "module.wasm",
    expectedKind: "wasm",
    base64: "AGFzbQEAAAABBAFgAAA=",
  },
  {
    id: "elf-header",
    fileName: "program.elf",
    expectedKind: "elf",
    base64: "f0VMRgIBAQAAAAAAAAAAAAIAPgABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
  {
    id: "pe-header",
    fileName: "program.exe",
    expectedKind: "pe",
    base64:
      "TVoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAFBFAABkhgMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
  {
    id: "macho-header",
    fileName: "program.macho",
    expectedKind: "macho",
    base64: "z/rt/gwAAAEAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
  {
    id: "java-class",
    fileName: "Example.class",
    expectedKind: "java-class",
    base64: "yv66vgAAADQAAQ==",
  },
  {
    id: "binary-plist",
    fileName: "Info.plist",
    expectedKind: "plist",
    base64: "YnBsaXN0MDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
  },
  {
    id: "ttf-font",
    fileName: "font.ttf",
    expectedKind: "ttf",
    base64: "AAEAAAABAAAAAAAAAAAAAA==",
  },
  {
    id: "otf-font",
    fileName: "font.otf",
    expectedKind: "otf",
    base64: "T1RUTwABAAAAAAAAAAAAAA==",
  },
  {
    id: "woff-font",
    fileName: "font.woff",
    expectedKind: "woff",
    base64: "d09GRgABAAAAAAAsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
  {
    id: "woff2-font",
    fileName: "font.woff2",
    expectedKind: "woff",
    base64: "d09GMgABAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  {
    id: "wav-riff",
    fileName: "tone.wav",
    expectedKind: "riff",
    base64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=",
  },
  {
    id: "mp4-ftyp",
    fileName: "movie.mp4",
    expectedKind: "mp4",
    base64: "AAAAGGZ0eXBpc29tAAAAAGlzb20=",
  },
] as const;

export function decodeBinaryAsset(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function getBinaryAssetFixture(id: string): BinaryAssetFixture {
  const fixture = BINARY_ASSET_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Unknown binary asset fixture: ${id}`);
  return fixture;
}
