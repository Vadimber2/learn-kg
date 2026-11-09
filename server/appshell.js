"use strict";
/* Сборка приложения из частей app/src/*: единственный источник кода тренажёра
   после декомпозиции монолита app/m0.html.
   Чистый fs+path, без зависимостей от server.js: тесты require-ят билдер напрямую,
   не поднимая сервер. Порядок склейки задаёт manifest.json; на момент разреза (v1.0.74)
   конкатенация частей была побайтово равна прежнему m0.html — дальше части живут своей
   историей, и полнота сборки держится ассертами ниже, а не сверкой с монолитом. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC_DIR = path.join(__dirname, "..", "app", "src");
const MANIFEST = path.join(SRC_DIR, "manifest.json");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

// Осиротевшая часть (файл есть, в манифесте нет) молча выпала бы из страницы —
// а страница осталась бы синтаксически валидной. Поэтому — ассерт на загрузке модуля.
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(path.relative(SRC_DIR, p));
  }
  return out;
}
{
  const listed = new Set(manifest);
  if (listed.size !== manifest.length) throw new Error("manifest.json: путь повторяется");
  const orphans = walk(SRC_DIR).filter((p) => p !== "manifest.json" && !listed.has(p));
  if (orphans.length) throw new Error("части вне manifest.json: " + orphans.join(", "));
  const missing = manifest.filter((p) => !fs.existsSync(path.join(SRC_DIR, p)));
  if (missing.length) throw new Error("части из manifest.json отсутствуют: " + missing.join(", "));
}

// Модули, чьи данные есть в исходниках: server.js сверяет этот список с реестром
// COURSES, чтобы модуль без данных (или данные без реестра) роняли старт, а не UI.
const MODULES = manifest
  .map((p) => p.match(/^data\/m(\d+)\.js$/))
  .filter(Boolean)
  .map((m) => "m" + m[1])
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

// Части читаются много раз (скан доноров, затем каждый вариант) — держим в памяти:
// это те же байты, что и в собранной странице, а диск перестаёт участвовать вовсе.
const PARTS = new Map();
function partText(p) {
  let t = PARTS.get(p);
  if (t === undefined) { t = fs.readFileSync(path.join(SRC_DIR, p), "utf8"); PARTS.set(p, t); }
  return t;
}

// Доноры: модуль A2 сплошь ссылается на лексику A1 ({ref:"m1_136"}), и слово живёт в
// данных донора — без него resolveVocab теряет карточку. Ссылки ищем во ВСЕХ частях
// модуля, а не только в его словаре: диалоги и справочные страницы тоже называют слова
// по id. Донорские данные входят в вариант, но не в CONTENT_READY/MODULE_META —
// в интерфейсе чужого модуля нет.
function partsOfModule(mid) {
  const rnd = new RegExp("^render/\\d+-render\\w*M" + mid.slice(1) + "\\.js$");
  return manifest.filter((p) =>
    p === "data/" + mid + ".js" || p === "data/content/" + mid + ".js" || p === "data/dialogs/" + mid + ".js" ||
    p === "data/lessons/" + mid + ".js" || p === "data/lessons/" + mid + "-slides.js" || rnd.test(p));
}
const DONORS = new Map();
for (const mid of MODULES) {
  const set = new Set();
  for (const p of partsOfModule(mid))
    for (const m of partText(p).matchAll(/"(m\d+)_/g)) if (m[1] !== mid) set.add(m[1]);
  DONORS.set(mid, set);
}
// Замыкание транзитивное: донор и сам может ссылаться на третий модуль (m12 → m7 → m4),
// и такой модуль обязан приехать, иначе alias-карточка ссылается в пустоту.
function dataModsFor(ownMods) {
  const out = new Set(["m0"]); // m0 в каждом варианте: с него стартует приложение, в его бакете живёт озвучка диалогов
  const queue = [...ownMods];
  while (queue.length) {
    const mid = queue.pop();
    if (out.has(mid)) continue;
    out.add(mid);
    for (const d of DONORS.get(mid) || []) if (!out.has(d)) queue.push(d);
  }
  return MODULES.filter((m) => out.has(m));
}

// Фильтры частей: реестры перечисляют модули построчно, поэтому вариант собирается
// вычёркиванием строк, а не вторым форматом данных.
const linesOf = (src, keep) => src.split("\n").filter((ln) => { const m = ln.match(/^\s*(?:\{id:")?(m\d+)[":]/); return !m || keep.has(m[1]); }).join("\n");

let fullCache = null;
// Без аргументов — полный файл (демо-артефакт, генератор аудио, тесты): он нужен
// многократно, поэтому держится в памяти. Варианты не кэшируем здесь — их хранит
// сервер уже упакованными (тело + gzip + ETag), и вторая копия строки была бы чистой тратой.
// ownMods — модули, по которым ученик учится: данные, диалоги, справочные страницы.
// resultMods — модули отнятого курса: только то, чем рисуются его результаты
// (лексика и метаданные), без диалогов и справочных страниц. Чужих курсов в варианте
// нет вовсе — не «скрыты стилями».
function buildAppHtml(ownMods, resultMods) {
  let out;
  if (!ownMods) out = fullCache || (fullCache = manifest.map(partText).join(""));
  else {
    // m0 доступен всегда: приложение стартует на нём, и без него в реестрах ученик
    // с курсом «без A1» (сдал его вне тренажёра — легальный случай) видел бы вместо
    // стартового экрана заглушку «контент готовится».
    const own = new Set(["m0"].concat(ownMods));
    const ready = new Set([...own, ...(resultMods || [])]); // всё, что видно в реестрах модулей
    const data = new Set(dataModsFor(ready));
    const ordered = MODULES.filter((m) => ready.has(m));
    out = manifest.map((p) => {
      const dataM = p.match(/^data\/(?:content\/)?m(\d+)\.js$/);
      if (dataM) return data.has("m" + dataM[1]) ? partText(p) : "";
      // диалоги и урок модуля (LESSONS.m<n> + слайды) — материал курса: едут только
      // своим; m0-урок живёт в общем data/lessons.js и есть у всех
      const dlg = p.match(/^data\/(?:dialogs|lessons)\/m(\d+)(?:-slides)?\.js$/);
      if (dlg) return own.has("m" + dlg[1]) ? partText(p) : "";
      const rnd = p.match(/^render\/\d+-render\w*M(\d+)\.js$/);
      if (rnd) return own.has("m" + rnd[1]) ? partText(p) : "";
      // Тексты экзамена (любого курса: exam-texts.js — B1, exam-texts-a1.js — A1)
      // собраны из предложений конкретных модулей, поэтому блок текста едет только
      // тому, у кого ВСЕ его модули-источники открыты: иначе чужая лексика утекает
      // в вариант (гейт per-user-shell ловит это как «материал чужих модулей»).
      if (/^data\/exam-texts.*\.js$/.test(p)) {
        const src = partText(p);
        const kept = src.replace(/\n  \{[\s\S]*?\n  \},/g, (block) => {
          const mods = [...block.matchAll(/src:\s*"(m\d+)_/g)].map((x) => x[1]);
          // блок без единого src (опечатка в поле) ушёл бы всем — every([]) истинно
          return mods.length && mods.every((m) => own.has(m)) ? block : "";
        });
        return kept;
      }
      if (p === "data/content.ready.js") return "const CONTENT_READY = [" + ordered.map((m) => '"' + m + '"').join(",") + "];\n";
      if (p === "11-module-meta.js") return linesOf(partText(p), ready);
      if (p === "14-extras.js") return linesOf(partText(p), own); // MODULE_EXTRAS[mid]||{} — отсутствие записи штатно
      return partText(p);
    }).join("");
    assertVariant(out, data, ordered.join("+"));
  }
  return out;
}

// Вариант проверяется на сборке, а не в проде: битый вырез строки реестра — это
// SyntaxError на весь <script>, то есть белый экран у ученика.
function assertVariant(html, dataMods, key) {
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new vm.Script(m[1]); }
    catch (e) { throw new Error("вариант " + key + ": " + e.message); }
  }
  const leak = new Set();
  for (const m of html.matchAll(/"(m\d+)_/g)) if (!dataMods.has(m[1])) leak.add(m[1]);
  for (const m of html.matchAll(/\b(?:CATS|VOCAB|DRILL)_M(\d+)\b/g)) if (!dataMods.has("m" + m[1])) leak.add("m" + m[1]);
  if (leak.size) throw new Error("вариант " + key + ": материал чужих модулей — " + [...leak].join(", "));
}

module.exports = { buildAppHtml, dataModsFor, DONORS, MODULES, manifest };
