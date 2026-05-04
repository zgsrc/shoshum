import { describe, expect, it } from "vitest";
import { flattenBinaryFields, sniffBinaryFormat } from "../binaryFormatSniffer";
import { getTestFixtureById } from "../testFixtures";
import { BINARY_ASSET_FIXTURES, decodeBinaryAsset, getBinaryAssetFixture } from "./binaryAssetFixtures";

describe("sniffBinaryFormat", () => {
  it.each(BINARY_ASSET_FIXTURES)(
    "detects $expectedKind from real fixture $fileName",
    ({ base64, expectedKind, fileName }) => {
      const bytes = decodeBinaryAsset(base64);
      const summary = sniffBinaryFormat(bytes, fileName);
      const fields = flattenBinaryFields(summary.fields);

      expect(summary.kind).toBe(expectedKind);
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(field.offset).toBeGreaterThanOrEqual(0);
        expect(field.length).toBeGreaterThanOrEqual(0);
        expect(field.offset + field.length).toBeLessThanOrEqual(bytes.length);
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
  });
});

function fixtureSummary(id: string) {
  const fixture = getBinaryAssetFixture(id);
  return sniffBinaryFormat(decodeBinaryAsset(fixture.base64), fixture.fileName);
}
