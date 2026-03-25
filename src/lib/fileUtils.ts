export type FileFormat =
  | "javascript"
  | "typescript"
  | "python"
  | "archive"
  | "json"
  | "graphql"
  | "html"
  | "css"
  | "markdown"
  | "xml"
  | "java"
  | "cpp"
  | "rust"
  | "sql"
  | "yaml"
  | "php"
  | "go"
  | "shell"
  | "toml"
  | "ini"
  | "properties"
  | "csv"
  | "docker"
  | "dotenv"
  | "text"
  | "binary";

export type NativeDisplayKind = "image" | "audio" | "video" | "pdf" | "html";

export interface NativeDisplayInfo {
  kind: NativeDisplayKind;
  mimeType: string;
}

export interface FileData {
  name: string;
  size: number;
  format: FileFormat;
  content: string;
  bytes: Uint8Array;
  isBinary: boolean;
  handle: FileSystemFileHandle | null;
  lastModified: number;
  mimeType: string;
}

export type LineEnding = "LF" | "CRLF" | "CR" | "mixed";

export type ArchiveKind = "zip" | "jar" | "war" | "ear" | "apk" | "tar" | "tgz";

export const SUPPORTED_ENCODINGS = [
  "utf-8",
  "ascii",
  "iso-8859-1",
  "utf-16le",
  "utf-16be",
  "windows-1252",
] as const;

export type Encoding = (typeof SUPPORTED_ENCODINGS)[number];

const EXT_TO_FORMAT: Record<string, FileFormat> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".es": "javascript",
  ".es6": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".pyw": "python",
  ".pyi": "python",
  ".json": "json",
  ".jsonc": "json",
  ".json5": "json",
  ".geojson": "json",
  ".topojson": "json",
  ".webmanifest": "json",
  ".har": "json",
  ".ipynb": "json",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".graphqls": "graphql",
  ".html": "html",
  ".htm": "html",
  ".xhtml": "html",
  ".shtml": "html",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
  ".sass": "css",
  ".styl": "css",
  ".stylus": "css",
  ".pcss": "css",
  ".postcss": "css",
  ".md": "markdown",
  ".mdx": "markdown",
  ".markdown": "markdown",
  ".mkd": "markdown",
  ".mkdn": "markdown",
  ".mdown": "markdown",
  ".mkdown": "markdown",
  ".rmd": "markdown",
  ".xml": "xml",
  ".svg": "xml",
  ".xsl": "xml",
  ".xslt": "xml",
  ".plist": "xml",
  ".rss": "xml",
  ".atom": "xml",
  ".xsd": "xml",
  ".wsdl": "xml",
  ".java": "java",
  ".c": "cpp",
  ".h": "cpp",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hxx": "cpp",
  ".hh": "cpp",
  ".ipp": "cpp",
  ".inl": "cpp",
  ".tpp": "cpp",
  ".cu": "cpp",
  ".cuh": "cpp",
  ".rs": "rust",
  ".sql": "sql",
  ".ddl": "sql",
  ".dml": "sql",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".php": "php",
  ".phtml": "php",
  ".php3": "php",
  ".php4": "php",
  ".php5": "php",
  ".phps": "php",
  ".go": "go",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ksh": "shell",
  ".mksh": "shell",
  ".dash": "shell",
  ".envrc": "shell",
  ".bat": "shell",
  ".cmd": "shell",
  ".ps1": "shell",
  ".toml": "toml",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  ".editorconfig": "ini",
  ".gitconfig": "ini",
  ".gitmodules": "ini",
  ".npmrc": "ini",
  ".yarnrc": "ini",
  ".service": "ini",
  ".socket": "ini",
  ".mount": "ini",
  ".target": "ini",
  ".timer": "ini",
  ".slice": "ini",
  ".desktop": "ini",
  ".properties": "properties",
  ".env": "dotenv",
  ".csv": "csv",
  ".tsv": "csv",
  ".txt": "text",
  ".log": "text",
  ".gitignore": "text",
  ".dockerignore": "text",
  ".npmignore": "text",
  ".eslintignore": "text",
  ".prettierignore": "text",
  ".stylelintignore": "text",
  ".lock": "text",
};

const BASENAME_TO_FORMAT: Record<string, FileFormat> = {
  makefile: "shell",
  gnumakefile: "shell",
  dockerfile: "docker",
  containerfile: "docker",
  ".bashrc": "shell",
  ".bash_profile": "shell",
  ".bash_logout": "shell",
  ".bash_aliases": "shell",
  ".profile": "shell",
  ".zshrc": "shell",
  ".zshenv": "shell",
  ".zprofile": "shell",
  ".zlogin": "shell",
  ".zlogout": "shell",
  ".env": "dotenv",
};

const EXT_TO_MIME_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".apng": "image/apng",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".wma": "audio/x-ms-wma",
  ".m4a": "audio/mp4",
  ".weba": "audio/webm",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mpg": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".3gp": "video/3gpp",
  ".3g2": "video/3gpp2",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".xhtml": "application/xhtml+xml",
};

const BINARY_EXTENSIONS = new Set([
  ".png", ".apng", ".jpg", ".jpeg", ".jfif", ".gif", ".bmp", ".ico", ".webp", ".avif",
  ".mp3", ".wav", ".ogg", ".oga", ".opus", ".flac", ".aac", ".wma", ".m4a", ".weba",
  ".mp4", ".m4v", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".ogv", ".mpg", ".mpeg", ".3gp", ".3g2",
  ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar", ".zst",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".wasm",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".class", ".pyc", ".pyo", ".o", ".obj", ".a", ".lib", ".jar", ".war", ".ear",
  ".db", ".sqlite", ".sqlite3", ".apk", ".dmg", ".iso", ".img",
  ".psd", ".ai", ".eps", ".icns", ".heic", ".heif",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".apng", ".jpg", ".jpeg", ".jfif", ".gif", ".bmp", ".ico", ".webp", ".avif", ".svg",
]);

const ZIP_ARCHIVE_EXTENSIONS: Record<string, ArchiveKind> = {
  ".zip": "zip",
  ".jar": "jar",
  ".war": "war",
  ".ear": "ear",
  ".apk": "apk",
};

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".wav", ".ogg", ".oga", ".opus", ".flac", ".aac", ".wma", ".m4a", ".weba",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".m4v", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".ogv", ".mpg", ".mpeg", ".3gp", ".3g2",
]);

const HTML_EXTENSIONS = new Set([
  ".html", ".htm", ".xhtml",
]);

function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx === -1 || dotIdx === filename.length - 1) return "";
  return filename.slice(dotIdx).toLowerCase();
}

function getMimeType(filename: string, fallback = "application/octet-stream"): string {
  const ext = getExtension(filename);
  const normalizedFallback = fallback.toLowerCase();

  if (normalizedFallback && normalizedFallback !== "application/octet-stream") {
    return normalizedFallback;
  }

  return EXT_TO_MIME_TYPE[ext] ?? fallback;
}

export function isBinaryByExtension(filename: string): boolean {
  return isArchiveFile(filename) || BINARY_EXTENSIONS.has(getExtension(filename));
}

export function isBinaryByContent(bytes: Uint8Array): boolean {
  const checkLength = Math.min(bytes.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    const b = bytes[i];
    if (b === 0) return true;
    if (b < 8 && b !== 0) return true;
  }
  return false;
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename));
}

export function detectArchiveKind(filename: string): ArchiveKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tgz";

  const ext = getExtension(lower);
  if (ext === ".tar") return "tar";
  return ZIP_ARCHIVE_EXTENSIONS[ext] ?? null;
}

export function isArchiveFile(filename: string): boolean {
  return detectArchiveKind(filename) !== null;
}

export function getNativeDisplayInfo(
  filename: string,
  mimeType: string,
  format: FileFormat
): NativeDisplayInfo | null {
  const ext = getExtension(filename);
  const resolvedMimeType = getMimeType(filename, mimeType || "application/octet-stream");

  if (resolvedMimeType === "application/pdf" || ext === ".pdf") {
    return { kind: "pdf", mimeType: "application/pdf" };
  }

  if (resolvedMimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) {
    return { kind: "image", mimeType: resolvedMimeType };
  }

  if (resolvedMimeType.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) {
    return { kind: "audio", mimeType: resolvedMimeType };
  }

  if (resolvedMimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) {
    return { kind: "video", mimeType: resolvedMimeType };
  }

  if (
    format === "html" ||
    HTML_EXTENSIONS.has(ext) ||
    resolvedMimeType === "text/html" ||
    resolvedMimeType === "application/xhtml+xml"
  ) {
    return {
      kind: "html",
      mimeType: resolvedMimeType === "application/octet-stream" ? "text/html" : resolvedMimeType,
    };
  }

  return null;
}

export function canDisplayNatively(filename: string, mimeType: string, format: FileFormat): boolean {
  return getNativeDisplayInfo(filename, mimeType, format) !== null;
}

export function detectFormat(filename: string): FileFormat {
  if (isArchiveFile(filename)) return "archive";

  const ext = getExtension(filename);
  if (ext && EXT_TO_FORMAT[ext]) return EXT_TO_FORMAT[ext];

  const base = filename.toLowerCase();
  if (base.startsWith(".env.")) return "dotenv";
  if (BASENAME_TO_FORMAT[base]) return BASENAME_TO_FORMAT[base];
  if (base === "vagrantfile") return "text";
  if (base === "gemfile" || base === "rakefile") return "text";

  if (BINARY_EXTENSIONS.has(ext)) return "binary";

  return "text";
}

export function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) || []).length;
  const cr = (text.match(/\r(?!\n)/g) || []).length;
  const lf = text.split("\n").length - 1 - crlf;

  if (crlf > 0 && lf === 0 && cr === 0) return "CRLF";
  if (lf > 0 && crlf === 0 && cr === 0) return "LF";
  if (cr > 0 && crlf === 0 && lf === 0) return "CR";
  if (crlf + lf + cr > 0) return "mixed";
  return "LF";
}

export function convertLineEnding(text: string, to: "LF" | "CRLF"): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (to === "LF") return normalized;
  return normalized.replace(/\n/g, "\r\n");
}

export function decodeWithEncoding(bytes: Uint8Array, encoding: string): string {
  const decoder = new TextDecoder(encoding, { fatal: false });
  return decoder.decode(bytes);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatLabel(format: FileFormat): string {
  const labels: Record<FileFormat, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    archive: "Archive",
    json: "JSON",
    graphql: "GraphQL",
    html: "HTML",
    css: "CSS",
    markdown: "Markdown",
    xml: "XML",
    java: "Java",
    cpp: "C/C++",
    rust: "Rust",
    sql: "SQL",
    yaml: "YAML",
    php: "PHP",
    go: "Go",
    shell: "Shell",
    toml: "TOML",
    ini: "INI/Config",
    properties: "Properties",
    csv: "CSV/TSV",
    docker: "Dockerfile",
    dotenv: "Dotenv",
    text: "Plain Text",
    binary: "Binary",
  };
  return labels[format];
}

export function countLines(text: string): number {
  if (!text) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") count++;
  }
  return count;
}

export async function readFile(file: File, encoding: string = "utf-8"): Promise<{
  bytes: Uint8Array;
  text: string;
  isBinary: boolean;
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const binary = isBinaryByExtension(file.name) || isBinaryByContent(bytes);

  let text = "";
  if (!binary) {
    text = decodeWithEncoding(bytes, encoding);
  }

  return { bytes, text, isBinary: binary };
}

export function getImageMimeType(filename: string): string {
  const mimeType = getMimeType(filename, "image/png");
  return mimeType.startsWith("image/") ? mimeType : "image/png";
}
