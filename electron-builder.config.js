/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.zgsrc.shoshum",
  productName: "Shoshum",
  directories: {
    output: "dist-electron",
    buildResources: "electron/resources",
  },
  files: ["electron/**/*", "!**/node_modules/**/*"],
  extraResources: [
    {
      from: "out",
      to: "out",
      filter: ["**/*"],
    },
  ],
  asar: true,
  mac: {
    target: [
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ],
    artifactName: "Shoshum-mac-universal.${ext}",
    category: "public.app-category.developer-tools",
    darkModeSupport: true,
    hardenedRuntime: true,
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
  win: {
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
    {
      ext: ["txt", "md", "json", "xml", "html", "css", "js", "ts", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "yaml", "yml", "toml", "ini", "cfg", "conf", "log", "csv", "sql", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd"],
      name: "Text File",
      description: "Text file",
      role: "Editor",
    },
    {
      ext: ["zip", "tar", "gz", "tgz", "jar", "war", "ear", "apk"],
      name: "Archive",
      description: "Archive file",
      role: "Viewer",
    },
    {
      ext: ["pdf"],
      name: "PDF Document",
      description: "PDF file",
      role: "Viewer",
    },
    {
      ext: ["docx"],
      name: "Word Document",
      description: "Word document",
      role: "Viewer",
    },
    {
      ext: ["xlsx", "xls"],
      name: "Spreadsheet",
      description: "Spreadsheet file",
      role: "Viewer",
    },
    {
      ext: ["sqlite", "db", "sqlite3"],
      name: "SQLite Database",
      description: "SQLite database",
      role: "Viewer",
    },
  ],
  publish: {
    provider: "github",
    owner: "zgsrc",
    repo: "shoshum",
  },
};
