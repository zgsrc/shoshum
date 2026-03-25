const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  protocol,
  net,
  ipcMain,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");

const isDev = process.env.ELECTRON_DEV === "1";
const PROTOCOL = "app";
const PROTOCOL_PREFIX = `${PROTOCOL}://bundle/`;

let mainWindow = null;
let pendingFilePath = null;

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

function getOutDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "out");
  }
  return path.join(__dirname, "..", "out");
}

function resolveFilePath(requestPath) {
  const outDir = getOutDir();
  const decoded = decodeURIComponent(requestPath);

  // Exact match
  const exact = path.join(outDir, decoded);
  if (fs.existsSync(exact) && fs.statSync(exact).isFile()) {
    return exact;
  }

  // Try with .html extension (e.g. /download -> /download.html)
  const withHtml = exact + ".html";
  if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) {
    return withHtml;
  }

  // Try as directory with index.html (e.g. /download/ -> /download/index.html)
  const indexInDir = path.join(exact, "index.html");
  if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
    return indexInDir;
  }

  // Fallback to root index.html for client-side routing
  return path.join(outDir, "index.html");
}

function registerProtocol() {
  protocol.handle(PROTOCOL, (request) => {
    const { pathname } = new URL(request.url);
    const resolvedPath = resolveFilePath(pathname === "/" ? "/index.html" : pathname);
    return net.fetch(url.pathToFileURL(resolvedPath).href);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`${PROTOCOL_PREFIX}index.html`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingFilePath) {
      sendFileToRenderer(pendingFilePath);
      pendingFilePath = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });
}

function sendFileToRenderer(filePath) {
  if (!mainWindow || !mainWindow.webContents) return;

  try {
    const absolutePath = path.resolve(filePath);
    const bytes = fs.readFileSync(absolutePath);
    const name = path.basename(absolutePath);
    const stats = fs.statSync(absolutePath);

    mainWindow.webContents.send("open-file", {
      name,
      path: absolutePath,
      bytes: Array.from(bytes),
      lastModified: stats.mtimeMs,
    });
  } catch (err) {
    console.error("Failed to read file:", err.message);
  }
}

async function handleOpenDialog() {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    sendFileToRenderer(result.filePaths[0]);
  }
}

function buildMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open File…",
          accelerator: "CmdOrCtrl+O",
          click: handleOpenDialog,
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// macOS: file opened via Finder / Open With
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    sendFileToRenderer(filePath);
  } else {
    pendingFilePath = filePath;
  }
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const filePath = argv.find(
        (arg) => !arg.startsWith("-") && arg !== process.execPath && fs.existsSync(arg)
      );
      if (filePath) sendFileToRenderer(filePath);
    }
  });

  app.whenReady().then(() => {
    if (!isDev) {
      registerProtocol();
    }
    buildMenu();
    createWindow();

    const fileArg = process.argv
      .slice(isDev ? 2 : 1)
      .find((arg) => !arg.startsWith("-") && fs.existsSync(arg));
    if (fileArg) {
      pendingFilePath = fileArg;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

// IPC: renderer requests native file open dialog
ipcMain.handle("open-file-dialog", async () => {
  await handleOpenDialog();
});

// IPC: read a file from disk (for drag-drop of paths)
ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const absolutePath = path.resolve(filePath);
    const bytes = fs.readFileSync(absolutePath);
    const name = path.basename(absolutePath);
    const stats = fs.statSync(absolutePath);
    return {
      name,
      path: absolutePath,
      bytes: Array.from(bytes),
      lastModified: stats.mtimeMs,
    };
  } catch {
    return null;
  }
});
