import { detectArchiveKind, formatBytes, toBlob, type ArchiveKind } from "@/lib/fileUtils";

export const MAX_ARCHIVE_INPUT_BYTES = 64 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRY_BYTES = 24 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 5000;
export const INVALID_ARCHIVE_PASSWORD_MESSAGE = "Invalid password";

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
  sourceName?: string;
  tarBytes?: Uint8Array;
}

export interface ExtractedArchiveEntry {
  path: string;
  bytes: Uint8Array;
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
      sourceName: fileName,
      entries: await readZipEntries(bytes),
    };
  }

  if (isLibarchiveKind(kind)) {
    return {
      kind,
      sourceName: fileName,
      entries: await readLibarchiveEntries(fileName, bytes),
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
    sourceName: fileName,
    entries: readTarEntries(tarBytes),
    tarBytes,
  };
}

export async function extractArchiveEntry(
  archiveBytes: Uint8Array,
  archiveData: ArchiveData,
  entryPath: string,
  password?: string
): Promise<Uint8Array> {
  const [entry] = await extractArchiveEntries(
    archiveBytes,
    archiveData,
    [entryPath],
    password
  );
  return entry.bytes;
}

export async function extractArchiveEntries(
  archiveBytes: Uint8Array,
  archiveData: ArchiveData,
  entryPaths: string[],
  password?: string
): Promise<ExtractedArchiveEntry[]> {
  const entries = resolveRequestedEntries(archiveData, entryPaths, password);
  if (entries.length === 0) return [];

  if (isZipArchiveKind(archiveData.kind)) {
    return readZipEntriesData(archiveBytes, entries, password);
  }

  if (isLibarchiveKind(archiveData.kind)) {
    return readLibarchiveEntriesData(
      archiveData.sourceName ?? `archive.${archiveData.kind}`,
      archiveBytes,
      entries,
      password
    );
  }

  return readTarEntriesData(archiveBytes, archiveData, entries);
}

export function isInvalidArchivePasswordError(error: unknown): boolean {
  return error instanceof Error && error.message === INVALID_ARCHIVE_PASSWORD_MESSAGE;
}

function isZipArchiveKind(kind: ArchiveKind): boolean {
  return kind === "zip" || kind === "jar" || kind === "war" || kind === "ear" || kind === "apk";
}

function isLibarchiveKind(kind: ArchiveKind): boolean {
  return kind === "7z" || kind === "rar" || kind === "tbz2" || kind === "txz";
}

async function readZipEntries(bytes: Uint8Array): Promise<ArchiveEntrySummary[]> {
  const { BlobReader, ZipReader } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(toBlob(bytes)), {
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
        path: normalizeArchivePath(entry.filename),
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

async function readZipEntriesData(
  bytes: Uint8Array,
  requestedEntries: ArchiveEntrySummary[],
  password?: string
): Promise<ExtractedArchiveEntry[]> {
  const { BlobReader, ZipReader, ERR_INVALID_PASSWORD } = await import("@zip.js/zip.js");
  const reader = new ZipReader(new BlobReader(toBlob(bytes)), {
    useWebWorkers: false,
  });

  try {
    const entries = await reader.getEntries();
    const fileEntryMap = new Map(
      entries
        .filter((candidate) => !candidate.directory)
        .map((candidate) => [
          normalizeArchivePath(candidate.filename),
          candidate,
        ])
    );

    const extractedEntries: ExtractedArchiveEntry[] = [];
    for (const requestedEntry of requestedEntries) {
      const entry = fileEntryMap.get(requestedEntry.path);
      if (!entry || entry.directory) {
        throw new Error(`Couldn't find "${requestedEntry.path}" in this ZIP archive.`);
      }

      try {
        const buffer = await entry.arrayBuffer(
          requestedEntry.encrypted && password
            ? { useWebWorkers: false, password }
            : { useWebWorkers: false }
        );
        extractedEntries.push({
          path: requestedEntry.path,
          bytes: new Uint8Array(buffer),
        });
      } catch (error) {
        if (error instanceof Error && error.message === ERR_INVALID_PASSWORD) {
          throw new Error(INVALID_ARCHIVE_PASSWORD_MESSAGE);
        }
        throw error;
      }
    }

    return extractedEntries;
  } finally {
    try {
      await reader.close();
    } catch {
      // Ignore close errors after failed reads.
    }
  }
}

async function readLibarchiveEntries(
  fileName: string,
  bytes: Uint8Array
): Promise<ArchiveEntrySummary[]> {
  const { Archive } = await import("libarchive.js");
  const archive = await Archive.open(
    new File([toBlob(bytes)], fileName, { type: "application/octet-stream" })
  );

  try {
    const archiveEncrypted = await archive.hasEncryptedData().catch(() => null);
    const files = await archive.getFilesArray();

    if (files.length > MAX_ARCHIVE_ENTRIES) {
      throw new Error(
        `Archives with more than ${MAX_ARCHIVE_ENTRIES.toLocaleString()} entries are not supported yet.`
      );
    }

    const entries = files.reduce<ArchiveEntrySummary[]>((acc, item) => {
        const compressedFile = item.file as {
          name?: string;
          size?: number;
          lastModified?: number;
        } | null;

        if (!compressedFile?.name) return acc;

        const path = normalizeArchivePath(
          `${typeof item.path === "string" ? item.path : ""}${compressedFile.name}`
        );
        if (!path) return acc;

        acc.push({
          path,
          size: compressedFile.size ?? 0,
          compressedSize: null,
          directory: false,
          encrypted: archiveEncrypted === true,
          lastModified:
            typeof compressedFile.lastModified === "number"
              ? compressedFile.lastModified
              : null,
        } satisfies ArchiveEntrySummary);

        return acc;
      }, []);

    return entries.sort(compareArchiveEntries);
  } finally {
    await archive.close().catch(() => {});
  }
}

async function readLibarchiveEntriesData(
  fileName: string,
  bytes: Uint8Array,
  requestedEntries: ArchiveEntrySummary[],
  password?: string
): Promise<ExtractedArchiveEntry[]> {
  const { Archive } = await import("libarchive.js");
  const archive = await Archive.open(
    new File([toBlob(bytes)], fileName, { type: "application/octet-stream" })
  );

  try {
    if (password) {
      await archive.usePassword(password);
    }

    const extractedEntries: ExtractedArchiveEntry[] = [];
    for (const requestedEntry of requestedEntries) {
      const file = await archive.extractSingleFile(requestedEntry.path);
      const buffer = await file.arrayBuffer();
      extractedEntries.push({
        path: requestedEntry.path,
        bytes: new Uint8Array(buffer),
      });
    }

    return extractedEntries;
  } catch (error) {
    if (looksLikeInvalidArchivePassword(error)) {
      throw new Error(INVALID_ARCHIVE_PASSWORD_MESSAGE);
    }
    throw error;
  } finally {
    await archive.close().catch(() => {});
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

function looksLikeInvalidArchivePassword(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("password") ||
    message.includes("passphrase") ||
    message.includes("encrypted") ||
    message.includes("crypt") ||
    message.includes("incorrect")
  );
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
      path = normalizeArchivePath(path);

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

async function readTarEntriesData(
  archiveBytes: Uint8Array,
  archiveData: ArchiveData,
  requestedEntries: ArchiveEntrySummary[]
): Promise<ExtractedArchiveEntry[]> {
  const tarBytes =
    archiveData.tarBytes ??
    (archiveData.kind === "tgz"
      ? await gunzipArchive(archiveBytes)
      : archiveBytes);

  return requestedEntries.map((entry) => {
    const dataOffset = entry.dataOffset;
    if (dataOffset == null) {
      throw new Error(`"${entry.path}" could not be extracted from this TAR archive.`);
    }

    if (dataOffset + entry.size > tarBytes.length) {
      throw new Error(`"${entry.path}" extends past the TAR archive boundary.`);
    }

    return {
      path: entry.path,
      bytes: tarBytes.slice(dataOffset, dataOffset + entry.size),
    };
  });
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

function normalizeArchivePath(path: string): string {
  const normalized = trimNulls(path)
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const safeSegments: string[] = [];

  for (const segment of segments) {
    const cleanedSegment = segment.replace(/[\u0000-\u001f\u007f]/g, "");
    if (!cleanedSegment || cleanedSegment === ".") continue;
    if (cleanedSegment === "..") return "";
    safeSegments.push(cleanedSegment);
  }

  if (safeSegments.length === 0) return "";
  return safeSegments.join("/");
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

function resolveRequestedEntries(
  archiveData: ArchiveData,
  entryPaths: string[],
  password?: string
): ArchiveEntrySummary[] {
  const uniqueEntryPaths = [...new Set(entryPaths)];
  const archiveEntryMap = new Map(
    archiveData.entries
      .filter((candidate) => !candidate.directory)
      .map((candidate) => [candidate.path, candidate] as const)
  );

  return uniqueEntryPaths.map((entryPath) => {
    const entry = archiveEntryMap.get(entryPath);
    if (!entry) {
      throw new Error(`Couldn't find "${entryPath}" in this archive.`);
    }

    if (entry.encrypted && !password) {
      throw new Error("This archive entry requires a password.");
    }

    if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new Error(
        `"${entry.path}" is ${formatBytes(entry.size)}, which is above the ${formatBytes(MAX_ARCHIVE_ENTRY_BYTES)} extraction limit.`
      );
    }

    return entry;
  });
}
