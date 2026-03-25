export function prettyPrintJSON(text: string): { result: string; error?: string } {
  try {
    const parsed = JSON.parse(text);
    return { result: JSON.stringify(parsed, null, 2) };
  } catch (e) {
    return { result: text, error: String(e) };
  }
}

export function minifyJSON(text: string): { result: string; error?: string } {
  try {
    const parsed = JSON.parse(text);
    return { result: JSON.stringify(parsed) };
  } catch (e) {
    return { result: text, error: String(e) };
  }
}

export function prettyPrintXML(text: string): string {
  let formatted = "";
  let indent = 0;
  const tokens = text.replace(/>\s*</g, ">\n<").split("\n");

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("</")) {
      indent = Math.max(0, indent - 1);
    }

    formatted += "  ".repeat(indent) + trimmed + "\n";

    if (
      trimmed.startsWith("<") &&
      !trimmed.startsWith("</") &&
      !trimmed.startsWith("<?") &&
      !trimmed.startsWith("<!") &&
      !trimmed.endsWith("/>") &&
      !/<\/[^>]+>$/.test(trimmed)
    ) {
      indent++;
    }
  }

  return formatted.trimEnd();
}

export function minifyXML(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/^\s+|\s+$/gm, "")
    .replace(/\n/g, "");
}
