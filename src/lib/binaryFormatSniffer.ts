import { formatOffset } from "./hexViewerUtils";

export type BinaryFormatKind =
  | "png"
  | "jpeg"
  | "gif"
  | "ico"
  | "pdf"
  | "zip"
  | "gzip"
  | "tar"
  | "7z"
  | "rar"
  | "sqlite"
  | "wasm"
  | "elf"
  | "pe"
  | "macho"
  | "java-class"
  | "plist"
  | "ttf"
  | "otf"
  | "woff"
  | "riff"
  | "mp4"
  | "unknown";

export interface BinaryField {
  id: string;
  name: string;
  offset: number;
  length: number;
  value?: string;
  description?: string;
  children?: BinaryField[];
  severity?: "info" | "warning" | "error";
}

export interface BinaryFormatSummary {
  kind: BinaryFormatKind;
  label: string;
  description: string;
  confidence: "high" | "medium" | "low";
  mimeType?: string;
  fields: BinaryField[];
  metadata: Array<{ label: string; value: string }>;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WASM_SIGNATURE = [0x00, 0x61, 0x73, 0x6d];
const GZIP_SIGNATURE = [0x1f, 0x8b];
const SEVEN_Z_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];

export function sniffBinaryFormat(bytes: Uint8Array, filename = ""): BinaryFormatSummary {
  return (
    parsePng(bytes) ??
    parseJpeg(bytes) ??
    parseGif(bytes) ??
    parseIco(bytes) ??
    parsePdf(bytes) ??
    parseZip(bytes) ??
    parseGzip(bytes) ??
    parseSevenZip(bytes) ??
    parseRar(bytes) ??
    parseTar(bytes) ??
    parseSqlite(bytes) ??
    parseWasm(bytes) ??
    parseElf(bytes) ??
    parsePe(bytes) ??
    parseJavaClass(bytes) ??
    parseMachO(bytes) ??
    parseBinaryPlist(bytes) ??
    parseWoff(bytes) ??
    parseSfntFont(bytes) ??
    parseRiff(bytes) ??
    parseMp4(bytes) ??
    unknownSummary(bytes, filename)
  );
}

export function flattenBinaryFields(fields: BinaryField[]): BinaryField[] {
  const result: BinaryField[] = [];
  const visit = (field: BinaryField) => {
    result.push(field);
    field.children?.forEach(visit);
  };
  fields.forEach(visit);
  return result;
}

function parsePng(bytes: Uint8Array): BinaryFormatSummary | null {
  if (!startsWith(bytes, PNG_SIGNATURE)) return null;

  const fields: BinaryField[] = [
    field("png-signature", "PNG signature", 0, 8, "89 50 4E 47 0D 0A 1A 0A"),
  ];
  const metadata: BinaryFormatSummary["metadata"] = [];
  let offset = 8;
  let chunkCount = 0;

  while (offset + 12 <= bytes.length && chunkCount < 32) {
    const length = readUInt32BE(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    const totalLength = 12 + length;
    const chunk: BinaryField = {
      id: `png-chunk-${offset}`,
      name: `${type} chunk`,
      offset,
      length: Math.min(totalLength, bytes.length - offset),
      value: `${length.toLocaleString()} data bytes`,
      children: [
        field(`png-chunk-${offset}-length`, "Length", offset, 4, length.toLocaleString()),
        field(`png-chunk-${offset}-type`, "Type", offset + 4, 4, type),
      ],
    };

    if (offset + 8 + length + 4 <= bytes.length) {
      chunk.children?.push(field(`png-chunk-${offset}-data`, "Data", offset + 8, length, undefined));
      chunk.children?.push(field(`png-chunk-${offset}-crc`, "CRC", offset + 8 + length, 4, hexUInt32(readUInt32BE(bytes, offset + 8 + length))));
    } else {
      chunk.severity = "warning";
      chunk.description = "Chunk extends past the available bytes.";
    }

    fields.push(chunk);
    if (type === "IHDR" && offset + 24 <= bytes.length) {
      metadata.push({ label: "Dimensions", value: `${readUInt32BE(bytes, offset + 8)} x ${readUInt32BE(bytes, offset + 12)}` });
      metadata.push({ label: "Bit depth", value: bytes[offset + 16].toString() });
      metadata.push({ label: "Color type", value: bytes[offset + 17].toString() });
    }
    offset += totalLength;
    chunkCount++;
    if (type === "IEND") break;
  }

  metadata.unshift({ label: "Chunks", value: chunkCount.toLocaleString() });
  return summary("png", "PNG image", "Portable Network Graphics file with chunked binary structure.", "image/png", fields, metadata);
}

function parseJpeg(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const fields: BinaryField[] = [field("jpeg-soi", "Start of image", 0, 2, "FFD8")];
  const metadata: BinaryFormatSummary["metadata"] = [];
  let offset = 2;
  let segmentCount = 0;

  while (offset + 1 < bytes.length && segmentCount < 64) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    const markerName = jpegMarkerName(marker);
    if (marker === 0xd9) {
      fields.push(field(`jpeg-marker-${offset}`, markerName, offset, 2, hexByte(marker)));
      break;
    }
    if (marker === 0xda) {
      fields.push(field(`jpeg-marker-${offset}`, markerName, offset, bytes.length - offset, "scan data follows"));
      break;
    }

    const segmentLength = offset + 4 <= bytes.length ? readUInt16BE(bytes, offset + 2) : 0;
    const totalLength = Math.max(2, segmentLength + 2);
    const segment = field(`jpeg-marker-${offset}`, markerName, offset, Math.min(totalLength, bytes.length - offset), hexByte(marker));
    if (marker === 0xe1) segment.description = "Often contains EXIF metadata.";
    fields.push(segment);
    segmentCount++;
    offset += totalLength;
  }

  metadata.push({ label: "Segments shown", value: segmentCount.toLocaleString() });
  return summary("jpeg", "JPEG image", "JPEG stream with marker segments and compressed scan data.", "image/jpeg", fields, metadata);
}

function parseGif(bytes: Uint8Array): BinaryFormatSummary | null {
  const header = readAscii(bytes, 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;

  const width = bytes.length >= 10 ? readUInt16LE(bytes, 6) : 0;
  const height = bytes.length >= 10 ? readUInt16LE(bytes, 8) : 0;
  return summary("gif", "GIF image", "GIF image with logical screen descriptor and block stream.", "image/gif", [
    field("gif-header", "Header", 0, 6, header),
    field("gif-screen", "Logical screen descriptor", 6, Math.min(7, Math.max(0, bytes.length - 6)), `${width} x ${height}`),
  ], [
    { label: "Version", value: header.slice(3) },
    { label: "Dimensions", value: `${width} x ${height}` },
  ]);
}

function parseIco(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 6 || readUInt16LE(bytes, 0) !== 0 || ![1, 2].includes(readUInt16LE(bytes, 2))) return null;

  const kind = readUInt16LE(bytes, 2) === 1 ? "Icon" : "Cursor";
  const count = readUInt16LE(bytes, 4);
  const fields: BinaryField[] = [
    field("ico-header", "ICO header", 0, 6, `${kind}, ${count} entries`),
  ];

  for (let i = 0; i < Math.min(count, 16); i++) {
    const offset = 6 + i * 16;
    if (offset + 16 > bytes.length) break;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    const size = readUInt32LE(bytes, offset + 8);
    const imageOffset = readUInt32LE(bytes, offset + 12);
    fields.push(field(`ico-entry-${i}`, `Image ${i + 1}`, offset, 16, `${width} x ${height}, ${size.toLocaleString()} bytes at 0x${formatOffset(imageOffset)}`));
  }

  return summary("ico", "ICO image", "Windows icon/cursor container with one or more embedded images.", "image/x-icon", fields, [
    { label: "Type", value: kind },
    { label: "Images", value: count.toLocaleString() },
  ]);
}

function parsePdf(bytes: Uint8Array): BinaryFormatSummary | null {
  const headerOffset = indexOfAscii(bytes, "%PDF-", 0, 1024);
  if (headerOffset === -1) return null;

  const headerEnd = findLineEnd(bytes, headerOffset);
  const header = readAscii(bytes, headerOffset, Math.max(0, headerEnd - headerOffset));
  const fields: BinaryField[] = [field("pdf-header", "PDF header", headerOffset, Math.max(5, headerEnd - headerOffset), header)];
  const xrefOffset = indexOfAscii(bytes, "xref", 0, bytes.length);
  const trailerOffset = indexOfAscii(bytes, "trailer", 0, bytes.length);
  const startXrefOffset = indexOfAscii(bytes, "startxref", 0, bytes.length);

  if (xrefOffset !== -1) fields.push(field("pdf-xref", "Cross-reference table", xrefOffset, 4, "xref"));
  if (trailerOffset !== -1) fields.push(field("pdf-trailer", "Trailer dictionary", trailerOffset, 7, "trailer"));
  if (startXrefOffset !== -1) fields.push(field("pdf-startxref", "startxref pointer", startXrefOffset, 9, "startxref"));

  return summary("pdf", "PDF document", "Portable Document Format with header, objects, and cross-reference data.", "application/pdf", fields, [
    { label: "Version", value: header.replace("%PDF-", "") || "unknown" },
    { label: "xref", value: xrefOffset === -1 ? "not found" : `0x${formatOffset(xrefOffset)}` },
  ]);
}

function parseZip(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 4 || readUInt32LE(bytes, 0) !== 0x04034b50) return null;

  const method = bytes.length >= 10 ? readUInt16LE(bytes, 8) : 0;
  const compressedSize = bytes.length >= 22 ? readUInt32LE(bytes, 18) : 0;
  const nameLength = bytes.length >= 28 ? readUInt16LE(bytes, 26) : 0;
  const extraLength = bytes.length >= 30 ? readUInt16LE(bytes, 28) : 0;
  const filename = bytes.length >= 30 + nameLength ? readAscii(bytes, 30, nameLength) : "";
  const children = [
    field("zip-signature", "Signature", 0, 4, "PK\\x03\\x04"),
    maybeField(bytes, "zip-method", "Compression method", 8, 2, method.toString()),
    maybeField(bytes, "zip-compressed-size", "Compressed size", 18, 4, compressedSize.toLocaleString()),
    maybeField(bytes, "zip-filename", "Filename", 30, nameLength, filename || undefined),
  ].filter((candidate): candidate is BinaryField => candidate !== null);
  const fields: BinaryField[] = [
    {
      id: "zip-local-header",
      name: "Local file header",
      offset: 0,
      length: Math.min(30 + nameLength + extraLength, bytes.length),
      value: filename || "first entry",
      children,
    },
  ];

  return summary("zip", "ZIP archive", "ZIP-family archive beginning with a local file header.", "application/zip", fields, [
    { label: "First entry", value: filename || "unknown" },
    { label: "Compression method", value: method.toString() },
  ]);
}

function parseGzip(bytes: Uint8Array): BinaryFormatSummary | null {
  if (!startsWith(bytes, GZIP_SIGNATURE)) return null;

  const method = bytes[2] ?? 0;
  const flags = bytes[3] ?? 0;
  return summary("gzip", "gzip stream", "gzip-compressed stream with a small header and compressed DEFLATE payload.", "application/gzip", [
    field("gzip-header", "gzip header", 0, Math.min(10, bytes.length), `method ${method}, flags 0x${formatOffset(flags, 2)}`),
  ], [
    { label: "Compression method", value: method === 8 ? "DEFLATE" : method.toString() },
    { label: "Flags", value: `0x${formatOffset(flags, 2)}` },
  ]);
}

function parseSevenZip(bytes: Uint8Array): BinaryFormatSummary | null {
  if (!startsWith(bytes, SEVEN_Z_SIGNATURE)) return null;
  return summary("7z", "7z archive", "7-Zip archive signature and header.", "application/x-7z-compressed", [
    field("7z-signature", "7z signature", 0, Math.min(6, bytes.length), "37 7A BC AF 27 1C"),
    field("7z-version", "Version", 6, Math.min(2, Math.max(0, bytes.length - 6)), bytes.length >= 8 ? `${bytes[6]}.${bytes[7]}` : undefined),
  ], []);
}

function parseRar(bytes: Uint8Array): BinaryFormatSummary | null {
  if (startsWith(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])) {
    return summary("rar", "RAR archive", "RAR 4 archive marker block.", "application/vnd.rar", [
      field("rar4-signature", "RAR4 signature", 0, 7, "Rar!"),
    ], [{ label: "Version", value: "RAR4" }]);
  }
  if (startsWith(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00])) {
    return summary("rar", "RAR archive", "RAR 5 archive marker block.", "application/vnd.rar", [
      field("rar5-signature", "RAR5 signature", 0, 8, "Rar!"),
    ], [{ label: "Version", value: "RAR5" }]);
  }
  return null;
}

function parseTar(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 265 || readAscii(bytes, 257, 5) !== "ustar") return null;

  const name = readNullTerminatedAscii(bytes, 0, 100);
  const sizeOctal = readNullTerminatedAscii(bytes, 124, 12).trim();
  const size = Number.parseInt(sizeOctal || "0", 8);
  return summary("tar", "tar archive", "POSIX tar archive with 512-byte header records.", "application/x-tar", [
    field("tar-header", "First file header", 0, Math.min(512, bytes.length), name || "entry"),
    field("tar-magic", "ustar magic", 257, availableLength(bytes, 257, 6), readAscii(bytes, 257, 6)),
  ], [
    { label: "First entry", value: name || "unknown" },
    { label: "First size", value: Number.isNaN(size) ? "unknown" : size.toLocaleString() },
  ]);
}

function parseSqlite(bytes: Uint8Array): BinaryFormatSummary | null {
  if (readAscii(bytes, 0, 16) !== "SQLite format 3\0") return null;

  const pageSize = bytes.length >= 18 ? readUInt16BE(bytes, 16) || 65536 : 0;
  const pageCount = bytes.length >= 32 ? readUInt32BE(bytes, 28) : 0;
  const fields = [
    field("sqlite-header", "Database header", 0, Math.min(100, bytes.length), "SQLite format 3"),
    maybeField(bytes, "sqlite-page-size", "Page size", 16, 2, pageSize.toLocaleString()),
    maybeField(bytes, "sqlite-page-count", "Page count", 28, 4, pageCount.toLocaleString()),
  ].filter((candidate): candidate is BinaryField => candidate !== null);

  return summary("sqlite", "SQLite database", "SQLite database file with a 100-byte database header.", "application/vnd.sqlite3", fields, [
    { label: "Page size", value: `${pageSize.toLocaleString()} bytes` },
    { label: "Page count", value: pageCount.toLocaleString() },
  ]);
}

function parseWasm(bytes: Uint8Array): BinaryFormatSummary | null {
  if (!startsWith(bytes, WASM_SIGNATURE)) return null;

  const version = bytes.length >= 8 ? readUInt32LE(bytes, 4) : 0;
  const fields: BinaryField[] = [
    field("wasm-magic", "WASM magic", 0, 4, "\\0asm"),
    field("wasm-version", "Version", 4, Math.min(4, Math.max(0, bytes.length - 4)), version.toString()),
  ];
  let offset = 8;
  let sectionCount = 0;
  while (offset < bytes.length && sectionCount < 32) {
    const id = bytes[offset];
    const size = readVarUint(bytes, offset + 1);
    if (!size) break;
    const headerLength = 1 + size.length;
    fields.push(field(`wasm-section-${offset}`, wasmSectionName(id), offset, Math.min(headerLength + size.value, bytes.length - offset), size.value.toLocaleString()));
    offset += headerLength + size.value;
    sectionCount++;
  }

  return summary("wasm", "WebAssembly module", "WebAssembly binary module with section-based encoding.", "application/wasm", fields, [
    { label: "Version", value: version.toString() },
    { label: "Sections shown", value: sectionCount.toLocaleString() },
  ]);
}

function parseElf(bytes: Uint8Array): BinaryFormatSummary | null {
  if (!startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return null;

  const className = bytes[4] === 1 ? "32-bit" : bytes[4] === 2 ? "64-bit" : "unknown class";
  const endian = bytes[5] === 1 ? "little-endian" : bytes[5] === 2 ? "big-endian" : "unknown endian";
  const fields = [
    field("elf-ident", "ELF identification", 0, Math.min(16, bytes.length), `${className}, ${endian}`),
    maybeField(bytes, "elf-type", "Object type", 16, 2, bytes.length >= 18 ? readUInt16ByEndian(bytes, 16, bytes[5] === 1).toString() : undefined),
  ].filter((candidate): candidate is BinaryField => candidate !== null);

  return summary("elf", "ELF executable", "Executable and Linkable Format binary header.", "application/x-elf", fields, [
    { label: "Class", value: className },
    { label: "Endian", value: endian },
  ]);
}

function parsePe(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 64 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return null;
  const peOffset = readUInt32LE(bytes, 0x3c);
  if (peOffset + 4 > bytes.length || readAscii(bytes, peOffset, 4) !== "PE\0\0") return null;

  const machine = peOffset + 6 <= bytes.length ? readUInt16LE(bytes, peOffset + 4) : 0;
  const sections = peOffset + 8 <= bytes.length ? readUInt16LE(bytes, peOffset + 6) : 0;
  return summary("pe", "PE executable", "Windows Portable Executable with DOS stub and PE header.", "application/vnd.microsoft.portable-executable", [
    field("pe-dos-header", "DOS header", 0, Math.min(64, bytes.length), "MZ"),
    field("pe-signature", "PE signature", peOffset, 4, "PE\\0\\0"),
    field("pe-file-header", "COFF file header", peOffset + 4, Math.min(20, Math.max(0, bytes.length - peOffset - 4)), `${sections} sections`),
  ], [
    { label: "Machine", value: `0x${formatOffset(machine, 4)}` },
    { label: "Sections", value: sections.toString() },
  ]);
}

function parseMachO(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 4) return null;
  const magic = readUInt32BE(bytes, 0);
  const known: Record<number, string> = {
    0xfeedface: "32-bit big-endian",
    0xcefaedfe: "32-bit little-endian",
    0xfeedfacf: "64-bit big-endian",
    0xcffaedfe: "64-bit little-endian",
    0xcafebabe: "Universal/fat binary",
    0xbebafeca: "Universal/fat binary",
  };
  const value = known[magic];
  if (!value) return null;

  return summary("macho", "Mach-O binary", "macOS Mach-O executable or universal binary header.", "application/x-mach-binary", [
    field("macho-magic", "Magic", 0, 4, `0x${formatOffset(magic)}`),
    field("macho-header", "Mach-O header", 0, Math.min(value.includes("64") ? 32 : 28, bytes.length), value),
  ], [{ label: "Kind", value }]);
}

function parseJavaClass(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 8 || readUInt32BE(bytes, 0) !== 0xcafebabe) return null;

  const minor = readUInt16BE(bytes, 4);
  const major = readUInt16BE(bytes, 6);
  return summary("java-class", "Java class file", "JVM class file with constant pool and bytecode metadata.", "application/java-vm", [
    field("class-magic", "Magic", 0, 4, "CAFEBABE"),
    field("class-version", "Version", 4, 4, `${major}.${minor}`),
  ], [
    { label: "Major version", value: major.toString() },
    { label: "Minor version", value: minor.toString() },
  ]);
}

function parseBinaryPlist(bytes: Uint8Array): BinaryFormatSummary | null {
  if (readAscii(bytes, 0, 8) !== "bplist00") return null;
  return summary("plist", "Binary property list", "Apple binary property list with object table and trailer.", "application/x-plist", [
    field("plist-header", "Binary plist header", 0, 8, "bplist00"),
    field("plist-trailer", "Trailer", Math.max(0, bytes.length - 32), Math.min(32, bytes.length), "offset table metadata"),
  ], []);
}

function parseWoff(bytes: Uint8Array): BinaryFormatSummary | null {
  const signature = readAscii(bytes, 0, 4);
  if (signature !== "wOFF" && signature !== "wOF2") return null;

  const flavor = bytes.length >= 8 ? readUInt32BE(bytes, 4) : 0;
  const length = bytes.length >= 12 ? readUInt32BE(bytes, 8) : 0;
  const tables = bytes.length >= 14 ? readUInt16BE(bytes, 12) : 0;
  return summary("woff", signature === "wOF2" ? "WOFF2 font" : "WOFF font", "Web Open Font Format wrapper around font table data.", signature === "wOF2" ? "font/woff2" : "font/woff", [
    field("woff-header", "WOFF header", 0, Math.min(44, bytes.length), `${tables} tables`),
  ], [
    { label: "Flavor", value: `0x${formatOffset(flavor)}` },
    { label: "Declared length", value: length.toLocaleString() },
    { label: "Tables", value: tables.toLocaleString() },
  ]);
}

function parseSfntFont(bytes: Uint8Array): BinaryFormatSummary | null {
  const signature = readAscii(bytes, 0, 4);
  const sfntVersion = readUInt32BE(bytes, 0);
  if (signature !== "OTTO" && sfntVersion !== 0x00010000) return null;

  const tables = bytes.length >= 6 ? readUInt16BE(bytes, 4) : 0;
  return summary(signature === "OTTO" ? "otf" : "ttf", signature === "OTTO" ? "OpenType font" : "TrueType font", "SFNT font file with table directory.", signature === "OTTO" ? "font/otf" : "font/ttf", [
    field("font-offset-table", "Offset table", 0, Math.min(12, bytes.length), `${tables} tables`),
  ], [{ label: "Tables", value: tables.toLocaleString() }]);
}

function parseRiff(bytes: Uint8Array): BinaryFormatSummary | null {
  if (readAscii(bytes, 0, 4) !== "RIFF" || bytes.length < 12) return null;

  const kind = readAscii(bytes, 8, 4);
  const declaredSize = readUInt32LE(bytes, 4);
  const label = kind === "WAVE" ? "WAV audio" : kind === "WEBP" ? "WebP image" : "RIFF container";
  return summary("riff", label, "RIFF container with FourCC chunks.", kind === "WAVE" ? "audio/wav" : kind === "WEBP" ? "image/webp" : undefined, [
    field("riff-header", "RIFF header", 0, 12, `${kind}, ${declaredSize.toLocaleString()} bytes`),
  ], [
    { label: "FourCC", value: kind },
    { label: "Declared size", value: declaredSize.toLocaleString() },
  ]);
}

function parseMp4(bytes: Uint8Array): BinaryFormatSummary | null {
  if (bytes.length < 12) return null;
  const boxType = readAscii(bytes, 4, 4);
  if (boxType !== "ftyp") return null;

  const size = readUInt32BE(bytes, 0);
  const brand = readAscii(bytes, 8, 4);
  return summary("mp4", "ISO BMFF / MP4 media", "ISO base media file format with box-based structure.", "video/mp4", [
    field("mp4-ftyp", "File type box", 0, Math.min(size || 8, bytes.length), brand),
  ], [
    { label: "Major brand", value: brand },
    { label: "ftyp size", value: size.toLocaleString() },
  ]);
}

function unknownSummary(bytes: Uint8Array, filename: string): BinaryFormatSummary {
  return {
    kind: "unknown",
    label: "Unknown binary",
    description: filename
      ? `No known binary signature was detected for ${filename}.`
      : "No known binary signature was detected.",
    confidence: "low",
    fields: bytes.length > 0 ? [field("unknown-prefix", "First bytes", 0, Math.min(64, bytes.length), `${Math.min(64, bytes.length)} bytes`)] : [],
    metadata: [{ label: "Size", value: bytes.length.toLocaleString() }],
  };
}

function summary(
  kind: BinaryFormatKind,
  label: string,
  description: string,
  mimeType: string | undefined,
  fields: BinaryField[],
  metadata: BinaryFormatSummary["metadata"],
  confidence: BinaryFormatSummary["confidence"] = "high"
): BinaryFormatSummary {
  return { kind, label, description, confidence, mimeType, fields, metadata };
}

function field(id: string, name: string, offset: number, length: number, value?: string): BinaryField {
  return { id, name, offset, length: Math.max(0, length), value };
}

function maybeField(
  bytes: Uint8Array,
  id: string,
  name: string,
  offset: number,
  length: number,
  value?: string
): BinaryField | null {
  const boundedLength = availableLength(bytes, offset, length);
  return boundedLength > 0 ? field(id, name, offset, boundedLength, value) : null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset >= bytes.length || length <= 0) return "";
  let result = "";
  const end = Math.min(bytes.length, offset + length);
  for (let i = offset; i < end; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function availableLength(bytes: Uint8Array, offset: number, requestedLength: number): number {
  if (offset < 0 || offset >= bytes.length || requestedLength <= 0) return 0;
  return Math.min(requestedLength, bytes.length - offset);
}

function readNullTerminatedAscii(bytes: Uint8Array, offset: number, length: number): string {
  const raw = readAscii(bytes, offset, length);
  const nul = raw.indexOf("\0");
  return (nul === -1 ? raw : raw.slice(0, nul)).trim();
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] * 256 + bytes[offset + 1];
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] + bytes[offset + 1] * 256;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return bytes[offset] * 2 ** 24 + bytes[offset + 1] * 2 ** 16 + bytes[offset + 2] * 2 ** 8 + bytes[offset + 3];
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return bytes[offset] + bytes[offset + 1] * 2 ** 8 + bytes[offset + 2] * 2 ** 16 + bytes[offset + 3] * 2 ** 24;
}

function readUInt16ByEndian(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  return littleEndian ? readUInt16LE(bytes, offset) : readUInt16BE(bytes, offset);
}

function readVarUint(bytes: Uint8Array, offset: number): { value: number; length: number } | null {
  let value = 0;
  let shift = 0;
  for (let i = offset; i < bytes.length && i < offset + 5; i++) {
    value |= (bytes[i] & 0x7f) << shift;
    if ((bytes[i] & 0x80) === 0) return { value, length: i - offset + 1 };
    shift += 7;
  }
  return null;
}

function indexOfAscii(bytes: Uint8Array, value: string, start: number, end: number): number {
  const pattern = new TextEncoder().encode(value);
  const limit = Math.min(end, bytes.length) - pattern.length;
  for (let i = Math.max(0, start); i <= limit; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function findLineEnd(bytes: Uint8Array, offset: number): number {
  for (let i = offset; i < bytes.length; i++) {
    if (bytes[i] === 0x0a || bytes[i] === 0x0d) return i;
  }
  return Math.min(bytes.length, offset + 32);
}

function hexByte(byte: number): string {
  return `0x${formatOffset(byte, 2)}`;
}

function hexUInt32(value: number): string {
  return `0x${formatOffset(value)}`;
}

function jpegMarkerName(marker: number): string {
  if (marker >= 0xe0 && marker <= 0xef) return `APP${marker - 0xe0} marker`;
  const names: Record<number, string> = {
    0xc0: "Start of frame",
    0xc2: "Progressive frame",
    0xc4: "Huffman table",
    0xdb: "Quantization table",
    0xd9: "End of image",
    0xda: "Start of scan",
    0xdd: "Restart interval",
    0xfe: "Comment",
  };
  return names[marker] ?? `Marker ${hexByte(marker)}`;
}

function wasmSectionName(id: number): string {
  const names: Record<number, string> = {
    0: "Custom section",
    1: "Type section",
    2: "Import section",
    3: "Function section",
    4: "Table section",
    5: "Memory section",
    6: "Global section",
    7: "Export section",
    8: "Start section",
    9: "Element section",
    10: "Code section",
    11: "Data section",
    12: "Data count section",
  };
  return names[id] ?? `Section ${id}`;
}
