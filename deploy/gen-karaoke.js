"use strict";
/* Тайминги строк куплетов для караоке-подсветки (раздел «Диалоги», песни).
   Не на глаз: ElevenLabs Scribe отдаёт пословные таймстампы, скрипт выравнивает
   слова по строкам текста куплета и вписывает поле kt (секунды начала каждой
   строки) прямо в куплет файла app/src/data/dialogs/m<n>.js — тайминги едут
   в персональный вариант вместе с данными своего модуля (глобальная карта
   роняла leak-гвард варианта). Клиент без kt падает на пропорцию по длине
   строк (===KARAOKE=== в 13-dialog-ui.js), kt её уточняет.
   Использование: KGA1_AUTH="логин:пароль" node deploy/gen-karaoke.js
     env KGA1_BASE  — откуда брать mp3 (по умолчанию https://learn.kg)
     env ELEVEN_KEY — ключ ElevenLabs; по умолчанию читается
                      ~/.config/elevenlabs/learn-kg-stt.key
     env KGA1_ONLY  — регексп по id куплета (точечный прогон;
                      после перезаписи куплета гнать его id обязательно) */
const vm = require("vm");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = process.env.KGA1_BASE || "https://learn.kg";
const AUTH = process.env.KGA1_AUTH;
const KEY = process.env.ELEVEN_KEY ||
  fs.readFileSync(path.join(os.homedir(), ".config/elevenlabs/learn-kg-stt.key"), "utf8").trim();
const ONLY = process.env.KGA1_ONLY ? new RegExp(process.env.KGA1_ONLY) : null;
const DLG_DIR = path.join(__dirname, "..", "app", "src", "data", "dialogs");

function loadSongs() {
  const html = require("../server/appshell").buildAppHtml();
  const m = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(m[1] + '; this.DIALOGS=typeof DIALOGS!=="undefined"?DIALOGS:{};', sb);
  const songs = [];
  for (const d of Object.values(sb.DIALOGS)) for (const s of d.songs || []) songs.push(s);
  return songs;
}

// нормализация для сверки слов: STT пишет пунктуацию и регистр по-своему.
// Scribe на песне может решить, что язык турецкий, и выдать ЛАТИНИЦУ («Ay gördüm»
// вместо «Ай көрдүм» — так ph_m5s_full стоял на матче 0/9): латинские буквы
// транслитерируем в кириллицу турецкой фонетикой, дальше добивает нечёткий матч.
const LAT2CYR = { a: "а", b: "б", c: "ж", "ç": "ч", d: "д", e: "е", f: "ф", g: "г", "ğ": "г",
  h: "х", "ı": "ы", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о", "ö": "ө",
  p: "п", q: "к", r: "р", s: "с", "ş": "ш", t: "т", u: "у", "ü": "ү", v: "в", w: "в",
  x: "х", y: "й", z: "з", "â": "а", "î": "и", "û": "у" };
const norm = (w) => w.toLowerCase().replace(/[a-zçğıöşüâîû]/g, (c) => LAT2CYR[c] || "")
  .replace(/[^а-яёңөү]/g, "");

// Выравнивание: строкам достаются слова STT по счёту слов самой строки.
// Если Scribe услышал другое число слов (склейка/дробление), честный фолбэк —
// пропорция по длине строк на отрезке реальной речи [старт первого, конец последнего].
function lineStarts(ky, sttWords) {
  const lines = ky.split("\n").map((l) => l.split(/\s+/).map(norm).filter(Boolean));
  const words = sttWords.filter((w) => w.type === "word" && norm(w.text));
  const total = lines.reduce((s, l) => s + l.length, 0);
  const r2 = (x) => Math.round(x * 100) / 100;
  if (words.length === total) {
    const starts = []; let p = 0;
    for (const l of lines) { starts.push(p === 0 ? 0 : r2(words[p].start)); p += l.length; }
    return { starts, exact: true };
  }
  const t0 = words.length ? words[0].start : 0;
  const t1 = words.length ? words[words.length - 1].end : 0;
  const chars = ky.split("\n").map((l) => l.length);
  const sum = chars.reduce((a, b) => a + b, 0);
  const starts = []; let acc = 0;
  for (const c of chars) { starts.push(acc === 0 ? 0 : r2(t0 + (t1 - t0) * (acc / sum))); acc += c; }
  return { starts, exact: false };
}

// Караоке ПОЛНОЙ песни (Suno, пение с музыкой): пословный Scribe по треку +
// выравнивание Нидлмана-Вунша к словам текста куплетов. Старт строки — таймстамп
// её первого сматченного слова; несматченные строки интерполируются по соседям.
// Гейт качества: ≥70% строк с прямым матчем и монотонный рост — иначе песня
// остаётся без skt (клиент тогда не подсвечивает, это лучше вранья).
// Матч токенов — нечёткий: пение тянет гласные и глотает согласные, Scribe пишет
// «токмок» как «токмак» — точное равенство браковало живые совпадения (m13/m14
// стояли на 5/8 при верной привязке). Порог: ≤1 правка на короткое слово,
// ≤ четверти длины на длинное.
function lev(a, b) {
  const D = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) D[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    D[i][j] = Math.min(D[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1), D[i-1][j] + 1, D[i][j-1] + 1);
  return D[a.length][b.length];
}
function tokEq(a, b) {
  if (a === b) return true;
  const tol = Math.max(1, Math.floor(Math.min(a.length, b.length) / 4));
  return a.length >= 3 && b.length >= 3 && lev(a, b) <= tol;
}
function songLineStarts(song, sttWords) {
  const lines = song.verses.flatMap((v) => v.ky.split("\n"));
  const lineWords = lines.map((l) => l.split(/\s+/).map(norm).filter(Boolean));
  const ref = lineWords.flat();
  const words = sttWords.filter((w) => w.type === "word" && norm(w.text))
    .map((w) => ({ t: norm(w.text), start: w.start }));
  const n = ref.length, k = words.length;
  const D = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let i = 1; i <= n; i++) D[i][0] = i;
  for (let j = 1; j <= k; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= k; j++)
    D[i][j] = Math.min(D[i-1][j-1] + (tokEq(ref[i-1], words[j-1].t) ? 0 : 1), D[i-1][j] + 1, D[i][j-1] + 1);
  const map = new Array(n).fill(null);
  let i = n, j = k;
  while (i > 0 && j > 0) {
    if (tokEq(ref[i-1], words[j-1].t) && D[i][j] === D[i-1][j-1]) { map[i-1] = words[j-1].start; i--; j--; }
    else if (D[i][j] === D[i-1][j-1] + 1) { i--; j--; }
    else if (D[i][j] === D[i-1][j] + 1) i--;
    else j--;
  }
  const starts = []; let p = 0; let direct = 0;
  for (const lw of lineWords) {
    const ts = map.slice(p, p + lw.length).filter((x) => x !== null);
    starts.push(ts.length ? ts[0] : null);
    if (ts.length) direct++;
    p += lw.length;
  }
  // интерполяция пропусков по индексу строки между известными соседями
  for (let a = 0; a < starts.length; a++) if (starts[a] === null) {
    let lo = a - 1; while (lo >= 0 && starts[lo] === null) lo--;
    let hi = a + 1; while (hi < starts.length && starts[hi] === null) hi++;
    if (lo >= 0 && hi < starts.length)
      starts[a] = starts[lo] + (starts[hi] - starts[lo]) * (a - lo) / (hi - lo);
    else if (lo >= 0) starts[a] = starts[lo] + (a - lo);
    else if (hi < starts.length) starts[a] = Math.max(0, starts[hi] - (hi - a));
  }
  const rounded = starts.map((x) => Math.round(x * 10) / 10);
  const mono = rounded.every((x, q) => q === 0 || x > rounded[q-1]);
  if (direct / lines.length < 0.7 || !mono)
    return { skt: null, note: "матч " + direct + "/" + lines.length + (mono ? "" : ", немонотонно") };
  return { skt: rounded, note: "строк с прямым матчем " + direct + "/" + lines.length };
}

async function stt(id) {
  const audio = await fetch(BASE + "/api/audio/m0/" + id + ".mp3",
    { headers: { Authorization: "Basic " + Buffer.from(AUTH).toString("base64") } });
  if (!audio.ok) throw new Error(id + ": аудио HTTP " + audio.status);
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "ky");
  fd.append("file", new Blob([Buffer.from(await audio.arrayBuffer())], { type: "audio/mpeg" }), id + ".mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text",
    { method: "POST", headers: { "xi-api-key": KEY }, body: fd });
  if (!r.ok) throw new Error(id + ": STT HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return (await r.json()).words || [];
}

async function main() {
  if (!AUTH) { console.error("нужен KGA1_AUTH"); process.exit(1); }
  const songs = loadSongs();
  const verses = songs.flatMap((s) => s.verses || []).map((v) => ({ id: v.id, ky: v.ky }))
    .filter((v) => !ONLY || ONLY.test(v.id));
  console.log("куплетов: " + verses.length);
  const map = {}; let approx = 0;
  for (const v of verses) {
    const { starts, exact } = lineStarts(v.ky, await stt(v.id));
    map[v.id] = starts;
    if (!exact) { approx++; console.log("  ~ " + v.id + ": слова не сошлись, пропорция по речи"); }
    else console.log("  ✓ " + v.id + ": " + starts.join(", "));
  }
  // полные песни: skt по выравниванию пения (пропуск, если id не прошёл ONLY-фильтр)
  const songMap = {};
  for (const s of songs.filter((x) => x.fullId && (!ONLY || ONLY.test(x.fullId)))) {
    try {
      const { skt, note } = songLineStarts(s, await stt(s.fullId));
      if (skt) { songMap[s.fullId] = skt; console.log("  ♪ " + s.fullId + ": " + note); }
      else console.log("  ✗ " + s.fullId + " без skt: " + note);
    } catch (e) { console.log("  ✗ " + s.fullId + ": " + e.message); }
  }
  let patched = 0;
  for (const f of fs.readdirSync(DLG_DIR).filter((x) => x.endsWith(".js"))) {
    const p = path.join(DLG_DIR, f);
    let t = fs.readFileSync(p, "utf8");
    const t0 = t;
    for (const [vid, starts] of Object.entries(map))
      t = t.replace(new RegExp('\\{id:"' + vid + '",(kt:\\[[^\\]]*\\],)?'),
        '{id:"' + vid + '",kt:[' + starts.join(",") + "],");
    for (const [fid, skt] of Object.entries(songMap))
      t = t.replace(new RegExp('(fullId:"' + fid + '",)(skt:\\[[^\\]]*\\],)?'),
        'fullId:"' + fid + '",skt:[' + skt.join(",") + "],");
    if (t !== t0) { fs.writeFileSync(p, t); patched++; }
  }
  console.log("готово: файлов диалогов обновлено: " + patched +
    " (куплетов kt: " + Object.keys(map).length + ", приближённых: " + approx +
    "; песен skt: " + Object.keys(songMap).length + ")");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
