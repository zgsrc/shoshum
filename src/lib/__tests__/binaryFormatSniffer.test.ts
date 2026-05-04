import { describe, expect, it } from "vitest";
import { flattenBinaryFields, sniffBinaryFormat } from "../binaryFormatSniffer";
import { getTestFixtureById } from "../testFixtures";
import { BINARY_ASSET_FIXTURES, decodeBinaryAsset, getBinaryAssetFixture } from "./binaryAssetFixtures";

const BUNDLED_PASSWORD_FIXTURE_IDS = ["locked-pdf", "locked-zip"] as const;

describe("sniffBinaryFormat", () => {
  it.each(BINARY_ASSET_FIXTURES)(
    "detects $expectedKind from real fixture $fileName",
    ({ base64, expectedKind, fileName }) => {
      const bytes = decodeBinaryAsset(base64);
      const summary = sniffBinaryFormat(bytes, fileName);

      expect(summary.kind).toBe(expectedKind);
      expect(flattenBinaryFields(summary.fields).length).toBeGreaterThan(0);
      expectFieldsInBounds(summary.fields, bytes.length);
    }
  );

  it.each(BINARY_ASSET_FIXTURES)(
    "does not throw or produce out-of-bounds fields for truncated $fileName",
    ({ base64, fileName }) => {
      const bytes = decodeBinaryAsset(base64);
      const sampleLengths = new Set([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        12,
        16,
        24,
        32,
        64,
        265,
        Math.max(0, bytes.length - 1),
        bytes.length,
      ]);

      for (const length of sampleLengths) {
        const truncated = bytes.slice(0, Math.min(length, bytes.length));
        const summary = sniffBinaryFormat(truncated, fileName);
        expectFieldsInBounds(summary.fields, truncated.length);
      }
    }
  );

  it("detects the bundled password-protected PDF asset", () => {
    const fixture = getTestFixtureById("locked-pdf");
    const summary = sniffBinaryFormat(decodeBinaryAsset(fixture.base64), fixture.fileName);

    expect(summary.kind).toBe("pdf");
    expect(summary.metadata).toContainEqual({ label: "Version", value: "1.3" });
    expect(flattenBinaryFields(summary.fields).some((field) => field.name === "Cross-reference table")).toBe(true);
  });

  it("detects the bundled password-protected ZIP asset", () => {
    const fixture = getTestFixtureById("locked-zip");
    const summary = sniffBinaryFormat(decodeBinaryAsset(fixture.base64), fixture.fileName);

    expect(summary.kind).toBe("zip");
    expect(summary.metadata).toContainEqual({ label: "First entry", value: "shoshum-archive-source.txt" });
  });

  it.each(BUNDLED_PASSWORD_FIXTURE_IDS)(
    "does not throw or produce out-of-bounds fields for truncated bundled fixture %s",
    (id) => {
      const fixture = getTestFixtureById(id);
      const bytes = decodeBinaryAsset(fixture.base64);

      for (const length of [0, 1, 4, 8, 16, 32, 64, Math.max(0, bytes.length - 1), bytes.length]) {
        const truncated = bytes.slice(0, Math.min(length, bytes.length));
        const summary = sniffBinaryFormat(truncated, fixture.fileName);
        expectFieldsInBounds(summary.fields, truncated.length);
      }
    }
  );

  it("parses format-specific details from fixture assets", () => {
    const png = fixtureSummary("png-1x1");
    const sqlite = fixtureSummary("sqlite-header");
    const wasm = fixtureSummary("wasm-module");
    const pe = fixtureSummary("pe-header");
    const javaClass = fixtureSummary("java-class");
    const tar = fixtureSummary("tar-header");

    expect(png.metadata).toContainEqual({ label: "Dimensions", value: "1 x 1" });
    expect(flattenBinaryFields(png.fields).some((field) => field.name === "IHDR chunk")).toBe(true);
    expect(sqlite.metadata).toContainEqual({ label: "Page size", value: "4,096 bytes" });
    expect(sqlite.metadata).toContainEqual({ label: "Page count", value: "2" });
    expect(flattenBinaryFields(wasm.fields).some((field) => field.name === "Type section")).toBe(true);
    expect(pe.metadata).toContainEqual({ label: "Sections", value: "3" });
    expect(javaClass.metadata).toContainEqual({ label: "Major version", value: "52" });
    expect(tar.metadata).toContainEqual({ label: "First entry", value: "hello.txt" });
  });

  it("falls back to unknown binary summaries", () => {
    const summary = sniffBinaryFormat(new Uint8Array([1, 2, 3]), "mystery.bin");
    expect(summary.kind).toBe("unknown");
    expect(summary.fields[0]?.name).toBe("First bytes");
    expectFieldsInBounds(summary.fields, 3);
  });
});

function fixtureSummary(id: string) {
  const fixture = getBinaryAssetFixture(id);
  return sniffBinaryFormat(decodeBinaryAsset(fixture.base64), fixture.fileName);
}

function expectFieldsInBounds(fields: ReturnType<typeof flattenBinaryFields>, byteLength: number): void {
  for (const field of flattenBinaryFields(fields)) {
    expect(field.offset).toBeGreaterThanOrEqual(0);
    expect(field.length).toBeGreaterThanOrEqual(0);
    expect(field.offset + field.length).toBeLessThanOrEqual(byteLength);
  }
}
