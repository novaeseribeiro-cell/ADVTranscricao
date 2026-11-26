(() => {
"use strict";
const dg = window.dg;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, kids = []) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); } for (const c of [].concat(kids)) if (c != null) n.append(c); return n; };

/* ---------- tempo ---------- */
const pad = (n, l = 2) => String(n).padStart(l, "0");
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const fmtSrt = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)},${pad(Math.floor(ms % 1000), 3)}`; };
const parseTs = t => { const m = String(t).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/); if (!m) return null; return ((+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000 + (m[4] ? +m[4].padEnd(3, "0") : 0); };

/* ---------- estado ---------- */
const S = { segs: [], name: "", source: "", durationMs: 0, example: false, analysis: null, mediaUrl: null };
const PALETTE = ["#0F6B5C", "#9B4D1C", "#3A5BA0", "#7A3F8F", "#5E7A1E", "#A0365A", "#2C7E8F", "#8A6D12"];
const speakers = () => [...new Set(S.segs.map(s => s.f).filter(Boolean))];
const colorOf = name => { const i = speakers().indexOf(name); return i < 0 ? "" : PALETTE[i % PALETTE.length]; };

/* ---------- exemplo fictício ---------- */
const EXEMPLO = [
 [0, "Juíza", "Aberta a audiência de instrução. Presentes a reclamante, acompanhada da advogada, e o preposto da reclamada, acompanhado do advogado. Tentativa de conciliação recusada."],
 [21000, "Juíza", "Vamos ouvir a primeira testemunha da reclamante. O senhor tem algum parentesco ou amizade íntima com a reclamante?"],
 [29500, "Testemunha", "Não, Excelência. A gente só trabalhou junto no estoque."],
 [34000, "Juíza", "Então o senhor fica compromissado a dizer a verdade. Pode perguntar, doutora."],
 [40000, "Advogada da reclamante", "O senhor trabalhou com a reclamante em que período?"],
 [44500, "Testemunha", "De março de 2022 até ela sair, em agosto de 2024."],
 [50000, "Advogada da reclamante", "E qual era o horário de vocês?"],
 [53000, "Testemunha", "A gente entrava às sete e meia. A saída no papel era às cinco e quarenta, mas quase todo dia ficava até umas sete da noite por causa da descarga dos caminhões."],
 [66000, "Advogada da reclamante", "Esse horário depois das cinco e quarenta era anotado no ponto?"],
 [70500, "Testemunha", "Não. O encarregado mandava bater o ponto e voltar pro estoque."],
 [76000, "Advogada da reclamante", "Quem era esse encarregado?"],
 [78500, "Testemunha", "O Sr. Almeida. Ele falava que quem não ficasse ia ser lembrado na hora da escala."],
 [86000, "Advogada da reclamante", "Sem mais perguntas, Excelência."],
 [89000, "Juíza", "Com a palavra o advogado da reclamada."],
 [92000, "Advogado da reclamada", "O senhor disse que ficavam até as sete. Isso era todos os dias da semana?"],
 [97500, "Testemunha", "Todo dia não. Era mais de segunda a quinta, que é quando chegava a carga."],
 [104000, "Advogado da reclamada", "E na sexta-feira?"],
 [106000, "Testemunha", "Na sexta saía no horário, às vezes até mais cedo."],
 [111000, "Advogado da reclamada", "O senhor tinha intervalo de almoço de uma hora?"],
 [114500, "Testemunha", "Tinha, almoçava no refeitório, uma hora certinha."],
 [120000, "Advogado da reclamada", "O senhor tem alguma ação contra a empresa?"],
 [123000, "Testemunha", "Tenho uma, de hora extra também, mas é outra vara."],
 [128000, "Advogado da reclamada", "Excelência, a reclamada requer que conste em ata que a testemunha litiga contra a reclamada com o mesmo objeto."],
 [136000, "Juíza", "Consigne-se. O simples fato de litigar contra a mesma empresa não torna a testemunha suspeita, mas a observação fica registrada. Mais alguma pergunta?"],
 [146000, "Advogado da reclamada", "Só uma. No início o senhor disse que ficava quase todo dia até as sete. Agora disse que era de segunda a quinta. Qual das duas?"],
 [155000, "Testemunha", "É que segunda a quinta é quase todo dia, doutor. Sexta era tranquilo."],
 [161000, "Advogado da reclamada", "Sem mais, Excelência."],
 [163000, "Juíza", "Dispensada a testemunha. Encerrada a instrução. Razões finais remissivas. Autos conclusos para sentença."]
];
function loadExample() {
  S.segs = EXEMPLO.map(([a, f, t], i) => ({ id: i, a, b: (EXEMPLO[i + 1]?.[0] ?? a + 8000), t, f, star: false }));
  Object.assign(S, { name: "Exemplo fictício: audiência de instrução trabalhista", source: "", durationMs: 171000, example: true, analysis: null });
  setMedia(null); renderAll();
}

/* ---------- avisos ---------- */
function banner(kind, text, actions = []) { const b = el("div", { class: `banner ${kind}` }, [el("p", { text })]); actions.forEach(a => b.append(el("button", { class: "btn sm", text: a[0], onclick: a[1] }))); $("#banners").append(b); return b; }
const clearBanners = () => $("#banners").replaceChildren();

/* ---------- degravação ---------- */
function renderMeta() {
  const m = $("#meta"); m.replaceChildren(); if (!S.segs.length) return;
  const add = (k, v) => m.append(el("span", {}, [k + " ", el("b", { text: v })]));
  add("Arquivo", S.name || "sem nome"); add("Duração", fmt(S.durationMs || (S.segs.at(-1)?.b ?? 0))); add("Falas", String(S.segs.length));
  const sp = speakers(); if (sp.length) add("Falantes", String(sp.length));
  add("Marcados", String(S.segs.filter(s => s.star).length));
}
function segRow(s) {
  const row = el("div", { class: "seg" + (s.star ? " star" : ""), "data-id": s.id });
  const ts = el("button", { class: "ts", text: fmt(s.a), title: "Ouvir a partir daqui", onclick: () => seek(s.a) });
  const who = el("button", { class: "who", text: s.f || "falante ?", title: "Renomear este falante em toda a degravação", onclick: () => openRename(s.f || "") });
  if (s.f) who.style.color = colorOf(s.f);
  const tx = el("p", { class: "tx", contenteditable: "true", spellcheck: "true" }); tx.textContent = s.t;
  tx.addEventListener("blur", () => { const v = tx.textContent.trim(); if (v !== s.t) { s.t = v; autosave(); } });
  const st = el("button", { class: "st", text: s.star ? "★" : "☆", title: "Marcar trecho para a peça", "aria-label": "Marcar trecho", onclick: () => { s.star = !s.star; row.classList.toggle("star", s.star); st.textContent = s.star ? "★" : "☆"; renderMeta(); autosave(); } });
  row.append(ts, el("div", { class: "body" }, [who, tx]), st); return row;
}
function renderSegs() {
  const box = $("#segs"); box.replaceChildren();
  if (!S.segs.length) { box.append(el("div", { class: "empty", text: "A degravação aparece aqui, fala por fala, conforme o motor transcreve." })); return; }
  const frag = document.createDocumentFragment(); S.segs.forEach(s => frag.append(segRow(s))); box.append(frag); applyFind();
}
function appendSeg(s) { if (S.segs.length === 1) $("#segs").replaceChildren(); $("#segs").append(segRow(s)); }
function renderAll() { renderMeta(); renderSegs(); renderSpeakers(); renderAnalysis(); }

function applyFind() {
  const q = $("#find").value.trim().toLowerCase(); const only = $("#onlyStar").checked; let n = 0;
  $$(".seg").forEach(r => { const s = S.segs.find(x => x.id === +r.dataset.id); if (!s) return; const hit = q && s.t.toLowerCase().includes(q); if (hit) n++; r.classList.toggle("hit", !!hit); r.hidden = (q && !hit) || (only && !s.star); });
  $("#findCount").textContent = q ? `${n} ocorrência${n === 1 ? "" : "s"}` : "";
}
$("#find").addEventListener("input", applyFind); $("#onlyStar").addEventListener("change", applyFind);

let renameFrom = null;
function openRename(name) { renameFrom = name; $("#renameFrom").textContent = name || "falante ?"; $("#renameTo").value = name; $("#spkList").replaceChildren(...["Juiz(a)", "Promotor(a)", "Defensor(a)", "Advogado(a) do autor", "Advogado(a) do réu", "Autor(a)", "Réu / preposto", "Testemunha 1", "Testemunha 2", "Perito(a)", ...speakers()].map(v => el("option", { value: v }))); $("#renameBox").hidden = false; $("#renameTo").focus(); }
$("#renameOk").onclick = () => { const to = $("#renameTo").value.trim(); if (!to) return; S.segs.forEach(s => { if ((s.f || "") === renameFrom) s.f = to; }); $("#renameBox").hidden = true; renderAll(); autosave(); };
$("#renameNo").onclick = () => { $("#renameBox").hidden = true; };

/* ---------- mídia ---------- */
const player = $("#player");
function setMedia(url) { if (S.mediaUrl && S.mediaUrl !== url) URL.revokeObjectURL(S.mediaUrl); S.mediaUrl = url; if (url) { player.src = url; player.hidden = false; } else { player.removeAttribute("src"); player.hidden = true; } }
function nearest(ms) { let lo = 0, hi = S.segs.length - 1, r = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (S.segs[m].a <= ms) { r = S.segs[m]; lo = m + 1; } else hi = m - 1; } return r || S.segs[0]; }
function seek(ms) { if (S.mediaUrl) { player.currentTime = ms / 1000; player.play().catch(() => {}); } const s = nearest(ms); if (s) highlight(s.id, true); }
let lastNow = -1;
function highlight(id, scroll) { $(".seg.now")?.classList.remove("now"); const r = $(`.seg[data-id="${id}"]`); if (r) { r.classList.add("now"); if (scroll || $("#follow").checked) r.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } lastNow = id; }
player.addEventListener("timeupdate", () => { if (!S.segs.length) return; const s = nearest(player.currentTime * 1000); if (s && s.id !== lastNow) highlight(s.id, false); });

/* ---------- abas ---------- */
$$(".tabs button").forEach(b => b.onclick = () => { $$(".tabs button").forEach(x => x.setAttribute("aria-selected", x === b)); ["an", "ex", "mo", "so"].forEach(t => $("#pane-" + t).hidden = t !== b.dataset.tab); });
const goTab = t => $(`.tabs button[data-tab="${t}"]`).click();

/* ---------- ícone ---------- */
(() => { const g = $("#logo").getContext("2d"); g.fillStyle = "#0F6B5C"; g.beginPath(); g.roundRect(0, 0, 256, 256, 56); g.fill(); g.fillStyle = "#F6D96B"; [40, 78, 120, 92, 150, 104, 66, 118, 56].forEach((h, i) => { g.beginPath(); g.roundRect(34 + i * 21, 128 - h / 2, 12, h, 6); g.fill(); }); g.fillStyle = "#FFFFFF"; g.beginPath(); g.roundRect(56, 206, 144, 10, 5); g.fill(); })();

/* ============================================================
   MOTOR LOCAL: ffmpeg + whisper.cpp (vêm dentro do instalador)
   ============================================================ */
const HALLUCINATIONS = /(amara\.org|legendas pela comunidade|legenda(do)? por|obrigad[oa] por assistir|inscreva-se no canal|^\s*\[(música|musica|aplausos|silêncio)\]\s*$)/i;
const WHISPER_PROMPT = "Transcrição de audiência judicial em português do Brasil. Excelência, Meritíssimo, doutor, doutora, testemunha, reclamante, reclamada, preposto, depoente, contradita, compromissada, consigne-se.";
let INFO = null; let modelKey = localStorage.getItem("dg.model") || "preciso"; let running = null;

function setPill(kind, text) { const p = $("#engPill"); p.className = "pill " + kind; p.lastElementChild.textContent = text; }
const modelReady = () => INFO?.models?.[modelKey]?.ok;
const engineReady = () => INFO && INFO.whisper && INFO.ffmpeg && modelReady();

async function detect() {
  try { INFO = await dg.info(); } catch (e) { INFO = null; }
  if (INFO && !INFO.models[modelKey]?.ok) { const other = Object.keys(INFO.models).find(k => INFO.models[k].ok); if (other) modelKey = other; }
  setPill(engineReady() ? "ok" : "warn", engineReady() ? "pronto para transcrever" : "falta baixar o modelo de voz");
  renderEngine();
  if (INFO && !modelReady()) { goTab("mo"); }
}

function renderEngine() {
  const box = $("#engBox"); box.replaceChildren();
  box.append(el("h3", { text: "Motor de transcrição" }));
  if (!INFO) { box.append(el("p", { text: "Não consegui verificar o motor. Feche e abra o ADV Transcrição de novo." })); return; }
  const line = (label, ok, val) => box.append(el("div", { class: "r" }, [el("span", {}, [el("span", { class: "tag " + (ok ? "ok" : "no"), text: ok ? "ok" : "falta" }), " " + label]), el("code", { text: val || "" })]));
  line("Transcritor (whisper.cpp)", !!INFO.whisper, INFO.whisper ? "incluído no app" : "não encontrado: reinstale o ADV Transcrição");
  line("Conversor de mídia (ffmpeg)", !!INFO.ffmpeg, INFO.ffmpeg ? "incluído no app" : "não encontrado: reinstale o ADV Transcrição");
  box.append(el("h3", { text: "Modelo de voz" }));
  box.append(el("p", { class: "hint", text: "Baixado uma única vez, direto para o seu computador. O Preciso erra menos; o Rápido serve para computador mais simples ou áudio curto." }));
  for (const [k, m] of Object.entries(INFO.models)) {
    const radio = el("input", { type: "radio", name: "model", id: "m-" + k, value: k }); radio.checked = modelKey === k; radio.disabled = !m.ok;
    radio.onchange = () => { modelKey = k; try { localStorage.setItem("dg.model", k); } catch {} detect(); };
    const lab = el("label", { for: "m-" + k }, [` ${m.label} · ~${m.approxMB} MB`]);
    const right = m.ok ? el("span", { class: "tag ok", text: "baixado" }) : el("button", { class: "btn sm primary", text: "Baixar", onclick: () => downloadModel(k) });
    box.append(el("div", { class: "r" }, [el("span", {}, [radio, lab]), right]));
  }
  box.append(el("div", { class: "row" }, [el("button", { class: "btn", text: "Verificar de novo", onclick: detect }), el("button", { class: "btn ghost", text: "Abrir pasta do ADV Transcrição", onclick: () => dg.openBase() })]));
  box.append(el("p", { class: "fmt", text: `versão ${INFO.version} · ${INFO.platform}` }));
}

/* tarefa em andamento */
function jobStart(title) { $("#job").hidden = false; $("#jobTitle").textContent = title; $("#jobBar").style.width = "0%"; $("#jobHint").textContent = ""; $("#jobLog").textContent = ""; $("#jobLog").hidden = true; setPill("run", title); }
function jobPct(p, hint) { $("#jobBar").style.width = Math.max(0, Math.min(100, p)).toFixed(1) + "%"; if (hint != null) $("#jobHint").textContent = hint; }
function logLine(t) { const l = $("#jobLog"); l.hidden = false; l.textContent += t + "\n"; l.scrollTop = l.scrollHeight; }
function jobEnd(ok, msg) { $("#jobTitle").textContent = msg; if (ok) jobPct(100); setPill(engineReady() ? "ok" : "warn", engineReady() ? "pronto para transcrever" : "falta baixar o modelo de voz"); setTimeout(() => { if (!running) $("#job").hidden = true; }, ok ? 3000 : 20000); }
$("#btnCancel").onclick = () => { if (running) { const id = running; running = null; dg.kill(id); jobEnd(false, "Cancelado"); } else $("#job").hidden = true; };

function run(tool, args, cwd, { onOut, onErr } = {}) {
  return new Promise(async (resolve, reject) => {
    let err = ""; let myId = null;
    try {
      myId = await dg.run(tool, args, cwd, {
        onOut, onErr: c => { err = (err + c).slice(-3000); onErr?.(c); },
        onExit: (code, e) => { const cancelled = running !== myId; if (!cancelled) running = null; if (code === 0) resolve(); else reject(new Error(cancelled ? "cancelado" : (e || `código ${code}: ${err.split("\n").filter(Boolean).slice(-3).join(" ")}`))); }
      });
      running = myId;
    } catch (e) { reject(e); }
  });
}

async function downloadModel(k) {
  jobStart("Baixando modelo de voz");
  jobPct(0, "Isso acontece só uma vez. Pode continuar usando o computador.");
  try {
    await dg.downloadModel(k, p => { if (p.total) jobPct(p.got / p.total * 100, `${(p.got / 1e6).toFixed(0)} de ${(p.total / 1e6).toFixed(0)} MB`); });
    modelKey = k; try { localStorage.setItem("dg.model", k); } catch {}
    jobEnd(true, "Modelo pronto. Já pode transcrever.");
  } catch (e) { logLine(e.message); jobEnd(false, "O download falhou. Confira a internet e clique em Baixar de novo."); }
  detect();
}

/* entrada de arquivos */
$("#btnPick").onclick = async () => { if (!engineReady()) { goTab("mo"); banner("err", "Antes de transcrever, baixe um modelo de voz na aba Motor."); return; } const p = await dg.pickFile(); if (p) transcribe(p); };
const zone = $("#zone");
["dragenter", "dragover"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("over"); }));
document.addEventListener("dragover", e => e.preventDefault()); document.addEventListener("drop", e => e.preventDefault());
zone.addEventListener("drop", e => {
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (/\.(srt|vtt|txt|json)$/i.test(f.name)) { importFile(f); return; }
  if (!engineReady()) { goTab("mo"); banner("err", "Antes de transcrever, baixe um modelo de voz na aba Motor."); return; }
  const p = dg.pathForFile(f); if (p) transcribe(p); else banner("err", "Não consegui ler esse arquivo. Use o botão Escolher arquivo.");
});

async function transcribe(path) {
  if (running) { banner("err", "Já existe uma transcrição em andamento. Espere terminar ou cancele."); return; }
  clearBanners();
  const name = path.split(/[\\/]/).pop();
  const work = await dg.newWorkdir();
  Object.assign(S, { segs: [], name, source: path, durationMs: 0, example: false, analysis: null });
  setMedia(null); renderAll();

  jobStart("1/2 Preparando o áudio"); let dur = 0;
  try {
    await run("ffmpeg", ["-hide_banner", "-y", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "audio.wav", "-vn", "-ac", "1", "-b:a", "48k", "previa.mp3"], work, {
      onErr: c => {
        const d = c.match(/Duration: (\d+):(\d+):(\d+\.\d+)/); if (d) { dur = (+d[1] * 3600 + +d[2] * 60 + +d[3]) * 1000; S.durationMs = dur; renderMeta(); }
        const t = [...c.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].pop(); if (t && dur) { const ms = (+t[1] * 3600 + +t[2] * 60 + +t[3]) * 1000; jobPct(ms / dur * 100, `${fmt(ms)} de ${fmt(dur)}`); }
      }
    });
  } catch (e) { logLine(e.message); jobEnd(false, e.message === "cancelado" ? "Cancelado" : "O conversor não conseguiu ler este arquivo. Ele é mesmo de áudio ou vídeo?"); return; }
  try { const bytes = await dg.readBytes(work + (INFO.platform === "win32" ? "\\" : "/") + "previa.mp3"); setMedia(URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }))); } catch {}

  jobStart("2/2 Transcrevendo"); const t0 = Date.now();
  jobPct(0, dur ? `Gravação de ${fmt(dur)}. As falas aparecem abaixo enquanto o motor trabalha.` : "");
  const threads = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  const modelRel = ["..", "..", "modelos", INFO.models[modelKey].file].join(INFO.platform === "win32" ? "\\" : "/");
  let buf = "";
  const pushLine = line => {
    const m = line.match(/^\[(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)\]\s*(.*)$/); if (!m) return;
    const t = m[3].trim(); if (!t || HALLUCINATIONS.test(t)) return;
    const s = { id: S.segs.length, a: parseTs(m[1]), b: parseTs(m[2]), t, f: "", star: false }; S.segs.push(s); appendSeg(s);
    if (dur) { const pct = s.b / dur * 100; const el2 = (Date.now() - t0) / 1000; const rest = pct > 3 ? el2 * (100 - pct) / pct : 0; jobPct(pct, `${fmt(s.b)} de ${fmt(dur)}${rest ? ` · faltam ~${Math.max(1, Math.ceil(rest / 60))} min` : ""}`); }
  };
  try {
    await run("whisper", ["-m", modelRel, "-f", "audio.wav", "-l", "pt", "-t", String(threads), "-pp", "-oj", "-of", "saida", "--prompt", WHISPER_PROMPT], work, {
      onOut: c => { buf += c; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(pushLine); },
      onErr: c => { const p = [...c.matchAll(/progress =\s*(\d+)%/g)].pop(); if (p && !dur) jobPct(Math.min(100, +p[1])); }
    });
    if (buf) pushLine(buf);
  } catch (e) { logLine(e.message); jobEnd(false, e.message === "cancelado" ? "Cancelado" : "A transcrição parou. Veja o registro acima."); return; }

  try {
    const j = JSON.parse(await dg.readText(work + (INFO.platform === "win32" ? "\\" : "/") + "saida.json"));
    const segs = (j.transcription || []).map(x => ({ a: x.offsets.from, b: x.offsets.to, t: (x.text || "").trim() })).filter(x => x.t && !HALLUCINATIONS.test(x.t));
    if (segs.length) S.segs = segs.map((x, i) => ({ id: i, ...x, f: "", star: false }));
  } catch (e) { logLine("Usando o texto recebido ao vivo (" + e.message + ")"); }
  S.durationMs = dur || S.segs.at(-1)?.b || 0;
  renderAll();
  const mins = ((Date.now() - t0) / 60000).toFixed(1).replace(".", ",");
  if (!S.segs.length) jobEnd(false, "Nenhuma fala reconhecida. Confira se a gravação tem voz audível.");
  else jobEnd(true, `Pronto: ${S.segs.length} falas em ${mins} min`);
  dg.notify(`Degravação pronta: ${name}`);
  autosave();
  dg.cleanWorkdir(work);
}

let saveTimer = null;
function autosave() {
  if (S.example || !S.segs.length) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem("dg.last", JSON.stringify(project())); } catch {} }, 800);
}

/* ---------- importar transcrição pronta ---------- */
$("#btnImport").onclick = () => $("#importIn").click();
$("#importIn").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); };
async function importFile(f) {
  const txt = await f.text(); let segs = [];
  try {
    if (/\.json$/i.test(f.name)) {
      const j = JSON.parse(txt);
      if (j.app === "degravador") { Object.assign(S, { segs: j.segs, name: j.name, durationMs: j.durationMs, analysis: j.analysis || null, example: false, source: j.source || "" }); setMedia(null); clearBanners(); renderAll(); return; }
      segs = (j.transcription || []).map(x => ({ a: x.offsets.from, b: x.offsets.to, t: x.text.trim() }));
    } else if (/\.(srt|vtt)$/i.test(f.name)) {
      for (const b of txt.replace(/\r/g, "").split(/\n\n+/)) { const m = b.match(/(\d+:\d+:\d+[.,]\d+|\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+|\d+:\d+[.,]\d+)[^\n]*\n([\s\S]+)/); if (m) segs.push({ a: parseTs(m[1]), b: parseTs(m[2]), t: m[3].replace(/<[^>]+>/g, "").replace(/\n/g, " ").trim() }); }
    } else {
      let t = 0;
      for (const l of txt.replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean)) { const m = l.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–:]?\s*(.*)$/); if (m && parseTs(m[1]) != null) { t = parseTs(m[1]); segs.push({ a: t, b: t + 5000, t: m[2] }); } else { segs.push({ a: t, b: t + 10000, t: l }); t += 10000; } }
    }
  } catch (err) { banner("err", "Não consegui ler este arquivo: " + err.message); return; }
  segs = segs.filter(s => s.t && s.a != null); segs.forEach((s, i) => { if (segs[i + 1] && s.b <= s.a) s.b = segs[i + 1].a; });
  S.segs = segs.map((s, i) => { const m = s.t.match(/^([A-ZÀ-Úa-zà-ú().\/ ]{2,40}):\s+(.+)$/); return { id: i, a: s.a, b: s.b, t: m ? m[2] : s.t, f: m ? m[1].trim() : "", star: false }; });
  Object.assign(S, { name: f.name, source: "", durationMs: S.segs.at(-1)?.b || 0, example: false, analysis: null });
  if (!running) $("#job").hidden = true;
  clearBanners(); setMedia(null); renderAll();
}
$("#btnNew").onclick = () => { Object.assign(S, { segs: [], name: "", example: false, analysis: null }); setMedia(null); clearBanners(); renderAll(); };

/* ============================================================
   DIVULGAÇÃO (TribuJus e NR). Os endereços ficam só aqui.
   Sem endereço preenchido, o botão não aparece.
   ============================================================ */
const PROMO = {
  tribujus: {
    nome: "TribuJus", kick: "Jurisprudência com link oficial",
    texto: "Pesquisa de jurisprudência, súmulas e teses de tribunais brasileiros, com link oficial para conferir cada julgado. Conecta direto no Claude: você pede a pesquisa e ele traz o precedente verificado, sem citação inventada.",
    url: "", botao: "Conhecer o TribuJus"
  },
  nr: {
    nome: "ADVNR", kick: "Sistema jurídico NR",
    texto: "O sistema do escritório integrado ao Claude: processos, autos, minutas e prazos no mesmo lugar, com a IA trabalhando dentro do seu fluxo.",
    url: "", botao: "Conhecer o ADVNR"
  }
};
function renderPromo() {
  const box = $("#promoBox"); if (!box) return; box.replaceChildren();
  for (const p of Object.values(PROMO)) box.append(el("div", { class: "promo" }, [
    el("span", { class: "kick", text: p.kick }), el("strong", { text: p.nome }), el("p", { class: "hint", text: p.texto }),
    p.url ? el("div", { class: "row" }, [el("button", { class: "btn primary sm", text: p.botao, onclick: () => dg.openExternal(p.url) })]) : null
  ]));
  const f = $("#footPromo"); if (f) { f.replaceChildren(document.createTextNode("Gratuito, oferecido por ")); const ps = Object.values(PROMO); ps.forEach((p, i) => { f.append(el("a", { text: p.nome, onclick: () => p.url ? dg.openExternal(p.url) : goTab("so") })); f.append(document.createTextNode(i < ps.length - 2 ? ", " : i === ps.length - 2 ? " e " : ".")); }); }
}
renderPromo();

/* ============================================================
   LEITURA JURÍDICA: ida e volta com o Claude do usuário
   ============================================================ */
const linesFor = segs => segs.map(s => `#${s.id} [${fmt(s.a)}]${s.f ? " " + s.f + ":" : ""} ${s.t}`).join("\n");
function buildClaudePrompt() {
  return `Você vai ajudar um advogado brasileiro com a transcrição automática de uma gravação (audiência, reunião ou áudio de WhatsApp). Cada fala tem número (#), minutagem [hh:mm:ss] e, às vezes, o falante.

Faça duas coisas:
1. Identifique quem fala em cada trecho, deduzindo pelo conteúdo (quem conduz e defere é juiz; quem pergunta é advogado ou promotor; quem responde sob compromisso é testemunha). Use rótulos curtos e consistentes: Juiz(a), Promotor(a), Defensor(a), Advogado(a) do autor, Advogado(a) do réu, Autor(a), Réu / preposto, Testemunha 1, Testemunha 2, Perito(a), Servidor(a). Em conversa comum, Pessoa 1, Pessoa 2. Se não der para saber, "Não identificado". Não invente nomes próprios.
2. Faça uma leitura jurídica objetiva dos fatos da gravação.

Regras obrigatórias:
- Todo "trecho" deve ser cópia LITERAL de palavras da transcrição, sem corrigir nem resumir.
- Use a minutagem exatamente como aparece entre colchetes.
- NÃO cite jurisprudência, súmulas, artigos de lei ou doutrina. É só leitura dos fatos.
- Se algo for incerto (falante, palavra mal transcrita), diga que é incerto.

Responda APENAS com um bloco JSON neste formato, sem texto antes ou depois:
{"falantes":[[primeiro_numero,ultimo_numero,"rótulo"]],"resumo":"5 a 8 linhas","pontos":[{"t":"hh:mm:ss","titulo":"curto","trecho":"citação literal","porque":"por que importa"}],"contradicoes":[{"t1":"hh:mm:ss","t2":"hh:mm:ss","descricao":"o que diverge","trecho1":"literal","trecho2":"literal"}],"citacoes":[{"t":"hh:mm:ss","texto":"Em audiência (mídia, aos hh:mm:ss), [falante] declarou: \\"trecho literal\\"."}],"lacunas":["perguntas sem resposta ou pontos a explorar"]}
Em "falantes", agrupe falas seguidas do mesmo falante num intervalo [de, até, rótulo] e cubra todas as falas. Até 8 pontos, 5 contradições e 6 citações.

TRANSCRIÇÃO (${S.name}):
${linesFor(S.segs)}`;
}
$("#btnCopyClaude").onclick = async () => {
  const msg = $("#copyMsg"); if (!S.segs.length) { msg.textContent = "Ainda não há degravação."; return; }
  await dg.copy(buildClaudePrompt());
  msg.textContent = "Copiado. No Claude, cole com Ctrl+V (no Mac, Cmd+V) e envie. Depois traga a resposta para o passo 2.";
  dg.openExternal("https://claude.ai/new");
};
function extractJson(text) { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a < 0 || b <= a) throw new Error("não encontrei o JSON na resposta"); return JSON.parse(text.slice(a, b + 1)); }
$("#btnApply").onclick = () => {
  const msg = $("#applyMsg"); let j;
  try { j = extractJson($("#paste").value); } catch (e) { msg.textContent = "Não consegui ler a resposta: " + e.message + ". Copie a resposta inteira do Claude, do primeiro { ao último }."; return; }
  let n = 0;
  for (const r of (j.falantes || [])) { const [from, to, lab] = r.length === 2 ? [r[0], r[0], r[1]] : r; if (typeof lab !== "string") continue; S.segs.forEach(s => { if (s.id >= +from && s.id <= +to) { s.f = lab.slice(0, 40); n++; } }); }
  S.analysis = j; $("#paste").value = "";
  renderAll(); autosave();
  msg.textContent = `Aplicado: ${n} falas com falante${j.pontos ? `, ${j.pontos.length} pontos` : ""}${j.contradicoes ? `, ${j.contradicoes.length} contradições` : ""}.`;
};

const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w ]+/g, " ").replace(/\s+/g, " ").trim();
function verify(quote) { const q = norm(quote || ""); if (q.length < 8) return null; const full = norm(S.segs.map(s => s.t).join(" ")); if (full.includes(q)) return true; const w = q.split(" "); if (w.length > 10 && full.includes(w.slice(0, 8).join(" "))) return "parcial"; return false; }
const tsLink = t => { const ms = parseTs(t || ""); return el("button", { class: "ts", text: t || "", onclick: () => ms != null && seek(ms) }); };
const chk = q => { const v = verify(q); if (v === null) return null; return el("span", { class: "tag " + (v ? "ok" : "no"), text: v === true ? "conferido na transcrição" : v === "parcial" ? "confere em parte" : "não localizado literalmente" }); };
function renderSpeakers() {
  const box = $("#spkBox"); box.replaceChildren(); const sp = speakers(); if (!sp.length) return;
  box.append(el("h3", { text: "Quem fala" }));
  const l = el("div", { class: "spk" });
  sp.forEach(n => { const c = S.segs.filter(s => s.f === n).length; const i = el("i"); i.style.background = colorOf(n); l.append(el("div", {}, [i, el("span", { text: `${n} · ${c} fala${c === 1 ? "" : "s"}` }), el("button", { class: "btn sm ghost", text: "renomear", onclick: () => openRename(n) })])); });
  box.append(l, el("p", { class: "hint", text: "Identificação pelo conteúdo, não pela voz. Clique no nome em qualquer fala para corrigir." }));
}
function renderAnalysis() {
  const box = $("#anBox"); box.replaceChildren(); const A = S.analysis; if (!A) return;
  if (A.resumo) box.append(el("h3", { text: "Resumo" }), el("p", { text: A.resumo }));
  if (A.pontos?.length) { box.append(el("h3", { text: "Pontos-chave" })); A.pontos.forEach(p => box.append(el("div", { class: "item" }, [el("div", { class: "hd" }, [tsLink(p.t), el("strong", { text: p.titulo || "" }), chk(p.trecho)]), p.trecho ? el("p", { class: "q", text: "“" + p.trecho + "”" }) : null, p.porque ? el("p", { class: "hint", text: p.porque }) : null]))); }
  if (A.contradicoes?.length) { box.append(el("h3", { text: "Contradições" })); A.contradicoes.forEach(c => box.append(el("div", { class: "item" }, [el("div", { class: "hd" }, [tsLink(c.t1), el("span", { text: "×" }), tsLink(c.t2)]), el("p", { text: c.descricao || "" }), c.trecho1 ? el("p", { class: "q", text: "“" + c.trecho1 + "”" }) : null, c.trecho1 ? chk(c.trecho1) : null, c.trecho2 ? el("p", { class: "q", text: "“" + c.trecho2 + "”" }) : null, c.trecho2 ? chk(c.trecho2) : null]))); }
  if (A.citacoes?.length) { box.append(el("h3", { text: "Citações prontas para a peça" })); A.citacoes.forEach(c => { const q = (c.texto || "").match(/["“](.+?)["”]/); box.append(el("div", { class: "item" }, [el("div", { class: "hd" }, [tsLink(c.t), q ? chk(q[1]) : null, el("button", { class: "btn sm", text: "copiar", onclick: async ev => { await dg.copy(c.texto); ev.target.textContent = "copiado"; } })]), el("p", { text: c.texto || "" })])); }); }
  if (A.lacunas?.length) { box.append(el("h3", { text: "O que ficou em aberto" })); const ul = el("ul"); A.lacunas.forEach(x => ul.append(el("li", { text: x }))); box.append(ul); }
  box.append(el("p", { class: "hint", text: "Leitura feita pelo Claude sobre a transcrição automática. Confira cada trecho ouvindo a mídia antes de usar na peça." }));
  const T = PROMO.tribujus;
  box.append(el("div", { class: "promo inline" }, [el("span", { class: "kick", text: "Próximo passo: fundamentar a peça" }), el("p", { text: "Esta leitura não traz jurisprudência de propósito. Para fundamentar, pesquise no " + T.nome + ": cada julgado vem com link oficial para conferir." }), el("div", { class: "row" }, [el("button", { class: "btn sm", text: T.url ? T.botao : "Saiba mais", onclick: () => T.url ? dg.openExternal(T.url) : goTab("so") })])]));
}

/* ============================================================
   EXPORTAR
   ============================================================ */
const baseName = () => (S.name || "degravacao").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
const project = () => ({ app: "degravador", v: 1, name: S.name, source: S.source, durationMs: S.durationMs, segs: S.segs, analysis: S.analysis });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function buildDoc() {
  const tr = s => `<tr><td style="font-family:Consolas,monospace;white-space:nowrap;vertical-align:top">${fmt(s.a)}</td><td style="vertical-align:top"><b>${esc(s.f || "")}</b></td><td>${esc(s.t)}</td></tr>`;
  const star = S.segs.filter(s => s.star);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Degravação</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4pt 6pt}th{background:#e8efe9;text-align:left}</style></head><body>
<h2>Degravação</h2><p><b>Mídia:</b> ${esc(S.name)}<br><b>Duração:</b> ${fmt(S.durationMs)}<br><b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
<p><i>Transcrição automática; identificação de falantes por inferência de conteúdo. Conferir com a mídia original antes de juntar aos autos.</i></p>
${star.length ? `<h3>Trechos destacados</h3><table><tr><th>Tempo</th><th>Falante</th><th>Fala</th></tr>${star.map(tr).join("")}</table>` : ""}
<h3>Íntegra</h3><table><tr><th>Tempo</th><th>Falante</th><th>Fala</th></tr>${S.segs.map(tr).join("")}</table></body></html>`;
}
function buildMd() {
  const A = S.analysis || {}; const L = [`# Leitura jurídica: ${S.name}`, "", `Duração: ${fmt(S.durationMs)}`, ""];
  if (A.resumo) L.push("## Resumo", A.resumo, "");
  if (A.pontos?.length) { L.push("## Pontos-chave"); A.pontos.forEach(p => L.push(`- [${p.t}] ${p.titulo}: "${p.trecho}" (${p.porque || ""}) ${verify(p.trecho) === true ? "[conferido]" : "[conferir]"}`)); L.push(""); }
  if (A.contradicoes?.length) { L.push("## Contradições"); A.contradicoes.forEach(c => L.push(`- [${c.t1}] x [${c.t2}] ${c.descricao}`)); L.push(""); }
  if (A.citacoes?.length) { L.push("## Citações para a peça"); A.citacoes.forEach(c => L.push(c.texto, "")); }
  const star = S.segs.filter(s => s.star); if (star.length) { L.push("## Trechos marcados"); star.forEach(s => L.push(`- [${fmt(s.a)}] ${s.f ? s.f + ": " : ""}"${s.t}"`)); L.push(""); }
  if (A.lacunas?.length) { L.push("## Em aberto"); A.lacunas.forEach(l => L.push("- " + l)); }
  L.push("", "Leitura gerada sobre transcrição automática. Conferir com a mídia.");
  L.push("", "---", `Transcrito com o ADV Transcrição (gratuito). Para fundamentar a peça com jurisprudência verificada e link oficial: ${PROMO.tribujus.nome}${PROMO.tribujus.url ? " (" + PROMO.tribujus.url + ")" : ""}. Sistema jurídico integrado ao Claude: ${PROMO.nr.nome}${PROMO.nr.url ? " (" + PROMO.nr.url + ")" : ""}.`); return L.join("\n");
}
const builders = {
  doc: () => ["Degravação - " + baseName() + ".doc", buildDoc()],
  txt: () => [baseName() + ".txt", S.segs.map(s => `[${fmt(s.a)}] ${s.f ? s.f + ": " : ""}${s.t}`).join("\r\n")],
  srt: () => [baseName() + ".srt", S.segs.map((s, i) => `${i + 1}\n${fmtSrt(s.a)} --> ${fmtSrt(s.b)}\n${s.f ? s.f + ": " : ""}${s.t}\n`).join("\n")],
  an: () => ["Leitura jurídica - " + baseName() + ".md", buildMd()],
  json: () => [baseName() + ".advtranscricao.json", JSON.stringify(project(), null, 2)]
};
$$("[data-ex]").forEach(b => b.onclick = async () => {
  const msg = $("#exMsg"); if (!S.segs.length) { msg.textContent = "Ainda não há degravação para exportar."; return; }
  const k = b.dataset.ex;
  if (k === "copy") { const star = S.segs.filter(s => s.star); if (!star.length) { msg.textContent = "Marque trechos com a estrela ao lado de cada fala."; return; } await dg.copy(star.map(s => `Em audiência (mídia, aos ${fmt(s.a)}), ${s.f || "o depoente"} declarou: "${s.t}".`).join("\n\n")); msg.textContent = `${star.length} trecho(s) copiados.`; return; }
  if (k === "an" && !S.analysis && !S.segs.some(s => s.star)) { msg.textContent = "Faça a leitura jurídica ou marque trechos antes."; return; }
  const [file, data] = builders[k]();
  try { const p = await dg.saveOutput(baseName(), file, data); msg.textContent = "Salvo em " + p; } catch (e) { msg.textContent = "Não consegui salvar: " + e.message; }
});

/* ---------- início ---------- */
let restored = false;
try { const last = JSON.parse(localStorage.getItem("dg.last") || "null"); if (last?.segs?.length) { Object.assign(S, { segs: last.segs, name: last.name, durationMs: last.durationMs, analysis: last.analysis, source: last.source, example: false }); renderAll(); restored = true; banner("info", `Reabri a última degravação (${last.name}). O áudio não fica guardado; para ouvir de novo, transcreva o arquivo outra vez.`, [["Ver exemplo", () => { clearBanners(); loadExample(); }]]); } } catch {}
if (!restored) { loadExample(); banner("ex", "Você está vendo um exemplo fictício. Clique numa minutagem, veja as contradições ou solte uma gravação de verdade.", [["Começar do zero", () => $("#btnNew").click()]]); }
detect();
})();
