"use strict";
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const procListeners = new Map();
ipcRenderer.on("proc", (e, msg) => { const l = procListeners.get(msg.id); if (!l) return; if (msg.kind === "out") l.onOut?.(msg.data); else if (msg.kind === "err") l.onErr?.(msg.data); else { procListeners.delete(msg.id); l.onExit?.(msg.code, msg.error); } });
let dlListener = null;
ipcRenderer.on("download-progress", (e, p) => dlListener?.(p));

contextBridge.exposeInMainWorld("dg", {
  info: () => ipcRenderer.invoke("info"),
  pickFile: () => ipcRenderer.invoke("pick-file"),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ""; } },
  newWorkdir: () => ipcRenderer.invoke("new-workdir"),
  cleanWorkdir: (d) => ipcRenderer.invoke("clean-workdir", d),
  run: async (tool, args, cwd, handlers) => { const id = await ipcRenderer.invoke("run", tool, args, cwd); procListeners.set(id, handlers || {}); return id; },
  kill: (id) => ipcRenderer.invoke("kill", id),
  downloadModel: (key, onProgress) => { dlListener = onProgress; return ipcRenderer.invoke("download-model", key); },
  readBytes: (p) => ipcRenderer.invoke("read-bytes", p),
  readText: (p) => ipcRenderer.invoke("read-text", p),
  saveOutput: (folder, name, data) => ipcRenderer.invoke("save-output", folder, name, data),
  openBase: () => ipcRenderer.invoke("open-base"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  copy: (text) => ipcRenderer.invoke("copy", text),
  notify: (body) => ipcRenderer.invoke("notify", body)
});
