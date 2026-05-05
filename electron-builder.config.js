/** @type {import('electron-builder').Configuration} */
const iconPng = "electron/resources/icon.png";
const iconIco = "electron/resources/icon.ico";
const iconIcns = "electron/resources/icon.icns";

module.exports = {
  appId: "com.zgsrc.shoshum",
  productName: "Shoshum",
  directories: {
    output: "dist-electron",
    buildResources: "electron/resources",
  },
  files: ["electron/**/*", "!electron/resources/**/*", "!**/node_modules/**/*"],
  extraResources: [
    {
      from: "out",
      to: "out",
      filter: ["**/*"],
    },
    {
      from: iconPng,
      to: "icon.png",
    },
  ],
  asar: true,
  mac: {
    icon: iconIcns,
    identity: "Developer ID Application",
    target: [
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ],
    artifactName: "Shoshum-mac-universal.${ext}",
    category: "public.app-category.developer-tools",
    darkModeSupport: true,
    hardenedRuntime: true,
    notarize: false,
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
  win: {
    icon: iconIco,
    target: [
      { target: "nsis", arch: ["x64", "arm64"] },
      { target: "portable", arch: ["x64"] },
    ],
  },
  nsis: {
    artifactName: "Shoshum-Setup-${arch}.${ext}",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
  },
  portable: {
    artifactName: "Shoshum-Portable-${arch}.${ext}",
  },
  linux: {
    icon: iconPng,
    target: [
      { target: "AppImage", arch: ["x64", "arm64"] },
      { target: "deb", arch: ["x64", "arm64"] },
    ],
    category: "Development;Utility",
    maintainer: "zgsrc",
  },
  appImage: {
    artifactName: "Shoshum-linux-${arch}.AppImage",
  },
  deb: {
    artifactName: "shoshum-linux-${arch}.deb",
  },
  fileAssociations: [
    ...["txt", "md", "json", "xml", "html", "css", "js", "ts", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "yaml", "yml", "toml", "ini", "cfg", "conf", "log", "csv", "sql", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"]
      .map((ext) => ({ ext, name: "Text File", description: "Text file", role: "Editor" })),
    ...["zip", "tar", "gz", "tgz", "jar", "war", "ear", "apk"]
      .map((ext) => ({ ext, name: "Archive", description: "Archive file", role: "Viewer" })),
    { ext: "pdf", name: "PDF Document", description: "PDF file", role: "Viewer" },
    { ext: "docx", name: "Word Document", description: "Word document", role: "Viewer" },
    ...["xlsx", "xls"]
      .map((ext) => ({ ext, name: "Spreadsheet", description: "Spreadsheet file", role: "Viewer" })),
    ...["sqlite", "db", "sqlite3"]
      .map((ext) => ({ ext, name: "SQLite Database", description: "SQLite database", role: "Viewer" })),
  ],
  publish: {
    provider: "github",
    owner: "zgsrc",
    repo: "shoshum",
  },
};
