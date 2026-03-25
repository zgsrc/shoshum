const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  onOpenFile: (callback) => {
    const handler = (_event, fileData) => callback(fileData);
    ipcRenderer.on("open-file", handler);
    return () => ipcRenderer.removeListener("open-file", handler);
  },

  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),

  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
});
