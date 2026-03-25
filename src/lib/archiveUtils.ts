import { detectArchiveKind, formatBytes, type ArchiveKind } from "@/lib/fileUtils";

export const MAX_ARCHIVE_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRY_BYTES = 24 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 5000;

const MAX_TAR_PAYLOAD_BYTES = 128 * 1024 * 1024;
const TAR_BLOCK_BYTES = 512;

export interface ArchiveEntrySummary {
  path: string;
  size: number;
  compressedSize: number | null;
  directory: boolean;
  encrypted: boolean;
  lastModified: number | null;
  dataOffset?: number;
}

export interface ArchiveData {
  kind: ArchiveKind;
  entries: ArchiveEntrySummary[];
  tarBytes?: Uint8Array;
}

export async function loadArchiveData(
  fileName: string,
  bytes: Uint8Array
): Promise<ArchiveData> {
  const kind = detectArchiveKind(fileName);
  if (!kind) {
    throw new Error("This file type is not a supported archive.");
  }

  if (bytes.byteLength > MAX_ARCHIVE_INPUT_BYTES) {
    throw new Error(
      `Archives larger than ${formatBytes(MAX_ARCHIVE_INPUT_BYTES)} are not supported yet.`
    );
  }

  if (isZipArchiveKind(kind)) {
    return {
      kind,
      entries: await readZipEntries(bytes),
    };
  }

  const tarBytes = kind === "tgz" ? await gunzipArchive(bytes) : bytes;
  if (tarBytes.byteLength > MAX_TAR_PAYLOAD_BYTES) {
    throw new Error(
      `Expanded TAR data is larger than ${formatBytes(MAX_TAR_PAYLOAD_BYTES)}.`
    );
  }

  return {
    kind,
    entries: readTarEntries(tarBytes),
    tarBytes,
  };
}

export async function extractArchiveEntry(
  archiveBytes: Uint8Array,
  archiveData: ArchiveData,
  entryPath: string
): Promise<Uint8Array> {
  const entry = archiveData.entries.find(
    (candidate) => !candidate.directory && candidate.path === entryPath
  );

  if (!entry) {
    throw new Error(`Couldn't find "${entryPath}" in this archive.`);
  }

  if (entry.encrypted) {
    throw new Error("Encrypted archive entries are not supported yet.");
  }

  if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
    throw new Error(
      `"${entry.path}" is ${formatBytes(entry.size)}, which is above the ${formatBytes(MAX_ARCHIVE_ENTRY_BYTES)} extraction limit.`
    );
  }

  if (isZipArchiveKind(archiveData.kind)) {
    return readZipEntry(archiveBytes, entry.path);
  }

  const tarBytes =
    archiveData.tarBytes ??
    (archiveData.kind === "tgz"
      ? await gunzipArchive(archiveBytes)
      : archiveBytes);

  const dataOffset = entry.dataOffset;
  if (dataOffset == null) {
    throw new Error(`"${entry.path}" could not be extracted from this TAR archive.`);
  }

  if (dataOffset + entry.size > tarBytes.length) {
    throw new Error(`"${entry.path}" extends past the TAR archive boundary.`);
  }

  return tarBytes.slice(dataOffset, dataOffset + entry.size);
}

function isZipArchiveKind(kind: ArchiveKind): boolean {
  return kind === "zip" || kind === "jar" || kind === "war" || kind === "ear" || kind === "apk";
}

async function readZipEntries(bytes: Uint8Array): Promise<ArchiveEntrySummary[]> {
  const { BlobReader, ZipReader } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(new Blob([bytes.buffer as ArrayBuffer])), {
    useWebWorkers: false,
  });

  try {
    const entries = await reader.getEntries();
    if (entries.length > MAX_ARCHIVE_ENTRIES) {
      throw new Error(
        `Archives with more than ${MAX_ARCHIVE_ENTRIES.toLocaleString()} entries are not supported yet.`
      );
    }

    return entries
      .map((entry) => ({
        path: normalizeArchivePath(entry.filename, entry.directory),
        size: entry.uncompressedSize,
        compressedSize: entry.compressedSize,
        directory: entry.directory,
        encrypted: entry.encrypted,
        lastModified: entry.lastModDate ? entry.lastModDate.getTime() : null,
      }))
      .filter((entry) => entry.path.length > 0)
      .sort(compareArchiveEntries);
  } finally {
    try {
      await reader.close();
    } catch {
      // Ignore close errors after failed reads.
    }
  }
}

async function readZipEntry(
  bytes: Uint8Array,
  entryPath: string
): Promise<Uint8Array> {
  const { BlobReader, ZipReader } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(new Blob([bytes.buffer as ArrayBuffer])), {
    useWebWorkers: false,
  });

  try {
    const entries = await reader.getEntries();
    const entry = entries.find(
      (candidate) =>
        !candidate.directory &&
        normalizeArchivePath(candidate.filename, false) === entryPath
    );

    if (!entry || entry.directory) {
      throw new Error(`Couldn't find "${entryPath}" in this ZIP archive.`);
    }

    if (entry.encrypted) {
      throw new Error("Encrypted ZIP entries are not supported yet.");
    }

    if (entry.uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new Error(
        `"${entry.filename}" is ${formatBytes(entry.uncompressedSize)}, which is above the ${formatBytes(MAX_ARCHIVE_ENTRY_BYTES)} extraction limit.`
      );
    }

    const buffer = await entry.arrayBuffer({ useWebWorkers: false });
    return new Uint8Array(buffer);
  } finally {
    try {
      await reader.close();
    } catch {
      // Ignore close errors after failed reads.
    }
  }
}

async function gunzipArchive(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const { gunzipSync } = await import("fflate");
    return gunzipSync(bytes);
  } catch {
    throw new Error("This gzip-compressed TAR archive could not be decompressed.");
  }
}

function readTarEntries(tarBytes: Uint8Array): ArchiveEntrySummary[] {
  const entries: ArchiveEntrySummary[] = [];
  let offset = 0;
  let globalPax: Record<string, string> = {};
  let nextPax: Record<string, string> = {};
  let nextLongPath: string | null = null;

  while (offset + TAR_BLOCK_BYTES <= tarBytes.length) {
    const header = tarBytes.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) break;

    const rawSize = parseTarNumber(header.subarray(124, 136));
    const sizeFromHeader = Number(rawSize);
    const payloadOffset = offset + TAR_BLOCK_BYTES;
    const payloadEnd = payloadOffset + sizeFromHeader;

    if (payloadEnd > tarBytes.length) {
      throw new Error("This TAR archive appears to be truncated.");
    }

    const typeFlag = header[156] ? String.fromCharCode(header[156]) : "0";
    const headerName = buildTarPath(
      readTarString(header.subarray(0, 100)),
      readTarString(header.subarray(345, 500))
    );
    const mtimeFromHeader = parseTarNumber(header.subarray(136, 148));
    const payload = tarBytes.subarray(payloadOffset, payloadEnd);

    if (typeFlag === "g") {
      globalPax = {
        ...globalPax,
        ...parsePaxHeader(payload),
      };
    } else if (typeFlag === "x") {
      nextPax = parsePaxHeader(payload);
    } else if (typeFlag === "L") {
      nextLongPath = trimNulls(readTarString(payload)).replace(/\n+$/g, "");
    } else {
      const appliedPax = { ...globalPax, ...nextPax };
      const entrySize = appliedPax.size ? Number(appliedPax.size) : sizeFromHeader;
      const entryMtime = appliedPax.mtime
        ? Number(appliedPax.mtime)
        : Number(mtimeFromHeader);
      let path = appliedPax.path ?? nextLongPath ?? headerName;
      path = normalizeArchivePath(path, typeFlag === "5");

      if (path) {
        const directory = typeFlag === "5" || path.endsWith("/");
        const normalizedPath = directory ? path.replace(/\/+$/g, "") : path;
        if (normalizedPath) {
          const includeEntry =
            directory || typeFlag === "0" || typeFlag === "\0" || typeFlag === "7";

          if (includeEntry) {
            entries.push({
              path: normalizedPath,
              size: directory ? 0 : entrySize,
              compressedSize: null,
              directory,
              encrypted: false,
              lastModified: Number.isFinite(entryMtime)
                ? Math.trunc(entryMtime * 1000)
                : null,
              dataOffset: directory ? undefined : payloadOffset,
            });
          }
        }
      }

      nextPax = {};
      nextLongPath = null;
    }

    offset = payloadOffset + roundUpToTarBlock(sizeFromHeader);
    if (entries.length > MAX_ARCHIVE_ENTRIES) {
      throw new Error(
        `Archives with more than ${MAX_ARCHIVE_ENTRIES.toLocaleString()} entries are not supported yet.`
      );
    }
  }

  return entries.sort(compareArchiveEntries);
}

function parsePaxHeader(bytes: Uint8Array): Record<string, string> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const result: Record<string, string> = {};
  let offset = 0;

  while (offset < text.length) {
    const spaceIndex = text.indexOf(" ", offset);
    if (spaceIndex === -1) break;

    const length = Number(text.slice(offset, spaceIndex));
    if (!Number.isFinite(length) || length <= 0) break;

    const record = text.slice(spaceIndex + 1, offset + length - 1);
    const equalsIndex = record.indexOf("=");
    if (equalsIndex !== -1) {
      const key = record.slice(0, equalsIndex);
      const value = record.slice(equalsIndex + 1);
      result[key] = value;
    }

    offset += length;
  }

  return result;
}

function parseTarNumber(field: Uint8Array): bigint {
  if (field.length === 0) return BigInt(0);

  if ((field[0] & 0x80) !== 0) {
    let value = BigInt(field[0] & 0x7f);
    for (let i = 1; i < field.length; i++) {
      value = (value << BigInt(8)) | BigInt(field[i]);
    }
    return value;
  }

  const raw = readTarString(field).trim();
  if (!raw) return BigInt(0);

  try {
    return BigInt(parseInt(raw, 8));
  } catch {
    return BigInt(0);
  }
}

function readTarString(field: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(field);
  return trimNulls(text);
}

function trimNulls(value: string): string {
  return value.replace(/\0+$/g, "");
}

function buildTarPath(name: string, prefix: string): string {
  if (prefix && name) return `${prefix}/${name}`;
  return prefix || name;
}

function normalizeArchivePath(path: string, directory: boolean): string {
  let normalized = trimNulls(path)
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");

  if (directory) {
    normalized = normalized.replace(/\/+$/g, "");
  }

  return normalized;
}

function roundUpToTarBlock(size: number): number {
  return Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
}

function isZeroBlock(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

function compareArchiveEntries(
  a: ArchiveEntrySummary,
  b: ArchiveEntrySummary
): number {
  if (a.directory !== b.directory) return a.directory ? -1 : 1;
  return a.path.localeCompare(b.path);
}
