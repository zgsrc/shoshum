import { describe, it, expect } from "vitest";
import { prettyPrintJSON, minifyJSON, prettyPrintXML, minifyXML } from "../formatters";

describe("prettyPrintJSON", () => {
  it("formats compact JSON", () => {
    const { result, error } = prettyPrintJSON('{"a":1,"b":[2,3]}');
    expect(error).toBeUndefined();
    expect(result).toBe('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it("returns original text and error for invalid JSON", () => {
    const { result, error } = prettyPrintJSON("{bad json}");
    expect(result).toBe("{bad json}");
    expect(error).toBeDefined();
  });

  it("handles empty object", () => {
    const { result } = prettyPrintJSON("{}");
    expect(result).toBe("{}");
  });
});

describe("minifyJSON", () => {
  it("minifies pretty JSON", () => {
    const { result, error } = minifyJSON('{\n  "a": 1,\n  "b": 2\n}');
    expect(error).toBeUndefined();
    expect(result).toBe('{"a":1,"b":2}');
  });

  it("returns original text and error for invalid JSON", () => {
    const { result, error } = minifyJSON("not json");
    expect(result).toBe("not json");
    expect(error).toBeDefined();
  });
});

describe("prettyPrintXML", () => {
  it("formats single-line XML", () => {
    const result = prettyPrintXML("<root><child>text</child></root>");
    expect(result).toContain("  <child>");
    expect(result.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("handles self-closing tags", () => {
    const result = prettyPrintXML("<root><br/></root>");
    expect(result).toContain("<br/>");
  });

  it("handles XML declaration", () => {
    const result = prettyPrintXML('<?xml version="1.0"?><root/>');
    expect(result).toContain("<?xml");
  });
});

describe("minifyXML", () => {
  it("removes whitespace between tags", () => {
    const result = minifyXML("<root>\n  <child>\n    text\n  </child>\n</root>");
    expect(result).not.toContain("\n");
  });

  it("strips XML comments", () => {
    const result = minifyXML("<root><!-- comment --><child/></root>");
    expect(result).not.toContain("comment");
    expect(result).toContain("<root>");
  });
});
