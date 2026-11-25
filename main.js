"use strict";
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const https = require("https");
const { spawn } = require("child_process");

const IS_WIN = process.platform === "win32";

// Modelos de voz (whisper.cpp, licença MIT). Baixados uma única vez.
const MODELS = {
  preciso: { file: "ggml-large-v3-turbo-q5_0.bin", label: "Preciso (large-v3-turbo)", approxMB: 574 },
  rapido: { file: "ggml-small-q5_1.bin", label: "Rápido (small)", approxMB: 190 }
};
const MODEL_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/";

const baseDir = () => path.join(app.getPath("documents"), "Degravador");
const binDir = () => (app.isPackaged ? path.join(process.resourcesPath, "bin") : path.join(__dirname, "bin"));
const whisperPath = () => path.join(binDir(), IS_WIN ? "whisper-cli.exe" : "whisper-cli");
function ffmpegPath() {
  try { return require("ffmpeg-static").replace("app.asar", "app.asar.unpacked"); } catch { return ""; }
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 760, minHeight: 560,
    title: "Degravador", backgroundColor: "#F3F4F2",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

app.whenReady().then(async () => {
  for (const d of ["modelos", "tmp", "Saidas"]) await fsp.mkdir(path.join(baseDir(), d), { recursive: true }).catch(() => {});
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { for (const p of procs.values()) try { p.kill(); } catch {} app.quit(); });

/* ---------- informações do motor ---------- */
ipcMain.handle("info", async () => {
  const models = {};
  for (const [k, m] of Object.entries(MODELS)) models[k] = { ...m, path: path.join(baseDir(), "modelos", m.file), ok: fs.existsSync(path.join(baseDir(), "modelos", m.file)) };
  return {
    platform: process.platform, version: app.getVersion(), base: baseDir(),
    whisper: fs.existsSync(whisperPath()) ? whisperPath() : "",
    ffmpeg: fs.existsSync(ffmpegPath()) ? ffmpegPath() : "",
    models
  };
});

/* ---------- download do modelo com progresso ---------- */
let downloading = null;
ipcMain.handle("download-model", async (e, key) => {
  const m = MODELS[key]; if (!m) throw new Error("modelo desconhecido");
  if (downloading) throw new Error("já existe um download em andamento");
  const dest = path.join(baseDir(), "modelos", m.file), part = dest + ".part";
  const send = (p) => win?.webContents.send("download-progress", { key, ...p });
  downloading = key;
  try {
    await new Promise((resolve, reject) => {
      const get = (url, hops = 0) => {
        const req = https.get(url, { headers: { "User-Agent": "Degravador" } }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 8) { res.resume(); return get(new URL(res.headers.location, url).toString(), hops + 1); }
          if (res.statusCode !== 200) { res.resume(); return reject(new Error("servidor respondeu " + res.statusCode)); }
          const total = +res.headers["content-length"] || m.approxMB * 1e6; let got = 0, last = 0;
          const out = fs.createWriteStream(part);
          res.on("data", (c) => { got += c.length; const now = Date.now(); if (now - last > 400) { last = now; send({ got, total }); } });
          res.pipe(out);
          out.on("finish", () => out.close(() => resolve()));
          res.on("error", reject); out.on("error", reject);
        });
        req.on("error", reject);
        req.setTimeout(60000, () => req.destroy(new Error("tempo esgotado sem resposta")));
      };
      get(MODEL_BASE + m.file);
    });
    await fsp.rename(part, dest);
    send({ done: true });
    return dest;
  } finally { downloading = null; }
});

/* ---------- processos (ffmpeg / whisper) ---------- */
const procs = new Map(); let seq = 0;
ipcMain.handle("run", (e, tool, args, cwd) => {
  const cmd = tool === "ffmpeg" ? ffmpegPath() : tool === "whisper" ? whisperPath() : null;
  if (!cmd) throw new Error("ferramenta desconhecida");
  const id = ++seq;
  const p = spawn(cmd, args, { cwd: cwd || baseDir(), windowsHide: true });
  procs.set(id, p);
  p.stdout.setEncoding("utf8"); p.stderr.setEncoding("utf8");
  p.stdout.on("data", (c) => win?.webContents.send("proc", { id, kind: "out", data: c }));
  p.stderr.on("data", (c) => win?.webContents.send("proc", { id, kind: "err", data: c }));
  p.on("error", (err) => { procs.delete(id); win?.webContents.send("proc", { id, kind: "exit", code: -1, error: err.message }); });
  p.on("close", (code) => { procs.delete(id); win?.webContents.send("proc", { id, kind: "exit", code }); });
  return id;
});
ipcMain.handle("kill", (e, id) => { const p = procs.get(id); if (p) { try { p.kill(); } catch {} } return true; });

/* ---------- arquivos ---------- */
const inBase = (p) => { const r = path.resolve(p); return r.startsWith(path.resolve(baseDir())); };
ipcMain.handle("pick-file", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Escolha a gravação", properties: ["openFile"],
    filters: [{ name: "Áudio e vídeo", extensions: ["mp3", "mp4", "m4a", "ogg", "opus", "oga", "wav", "mov", "webm", "mkv", "aac", "flac", "wma", "avi", "3gp", "amr", "mpeg", "mpg", "wmv"] }, { name: "Todos os arquivos", extensions: ["*"] }]
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("new-workdir", async () => { const d = path.join(baseDir(), "tmp", Date.now().toString(36)); await fsp.mkdir(d, { recursive: true }); return d; });
ipcMain.handle("read-bytes", async (e, p) => { if (!inBase(p)) throw new Error("caminho fora da pasta do Degravador"); return new Uint8Array(await fsp.readFile(p)); });
ipcMain.handle("read-text", async (e, p) => { if (!inBase(p)) throw new Error("caminho fora da pasta do Degravador"); return fsp.readFile(p, "utf8"); });
ipcMain.handle("save-output", async (e, folderName, fileName, data) => {
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 100);
  const dir = path.join(baseDir(), "Saidas", safe(folderName)); await fsp.mkdir(dir, { recursive: true });
  const p = path.join(dir, safe(fileName)); await fsp.writeFile(p, data, "utf8"); shell.showItemInFolder(p); return p;
});
ipcMain.handle("open-base", () => shell.openPath(baseDir()));
ipcMain.handle("open-external", (e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle("copy", (e, text) => { clipboard.writeText(String(text)); return true; });
ipcMain.handle("notify", (e, body) => { if (Notification.isSupported()) new Notification({ title: "Degravador", body: String(body).slice(0, 200) }).show(); });
ipcMain.handle("clean-workdir", async (e, d) => { if (inBase(d) && d.includes(path.join("Degravador", "tmp"))) await fsp.rm(d, { recursive: true, force: true }).catch(() => {}); });
