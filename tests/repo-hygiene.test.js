"use strict";
/* Гигиена репозитория: то, что ломает прод, но не ловится ни одним предметным тестом.

   Повод — авария 22.08.2026: после сквош-мержа я разрешил конфликты выборочно
   (`git checkout --ours` для двух файлов), а остальное добавил массовым `git add -A`.
   В app/probny-b1/probny-b1.json уехали маркеры `<<<<<<< HEAD`, сервер упал на старте
   (`JSON.parse` в билдере страницы-теста), прод отдавал «no available server».
   Ни один сьют этого не увидел: прогон был ДО мержа, а после — не повторялся.

   Отсюда две проверки: (1) в рабочем дереве нет маркеров конфликта, (2) каждый JSON,
   который сервер читает при старте, действительно парсится. Обе — про артефакт,
   а не про намерение: они падают ровно в том случае, который положил прод. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
/* Список файлов: git ls-files даёт ровно отслеживаемое, но в прод-образе git не
   установлен (node:22-alpine) — тогда обходим дерево сами, пропуская служебные
   каталоги. Без фолбэка этот сьют валил бы весь докер-прогон, а он идёт первым. */
const SKIP_DIR = new Set(["node_modules", ".git", "deploy/out", "deploy/video-cache", ".claude"]);
function walk(dir, base) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir || "."), { withFileTypes: true })) {
    const rel = dir ? dir + "/" + e.name : e.name;
    if (SKIP_DIR.has(rel) || SKIP_DIR.has(e.name)) continue;
    if (e.isDirectory()) out.push(...walk(rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}
let tracked;
try {
  tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n").filter(Boolean);
  if (!tracked.length) throw new Error("пусто");
} catch { tracked = walk(""); }
assert.ok(tracked.length > 100, "список файлов репозитория получен: " + tracked.length);

/* ── 1. Маркеры конфликта ────────────────────────────────────────────────────
   Ищем только в начале строки: «=======» встречается в текстах и рамках, а
   «<<<<<<< » с семью угловыми и пробелом — исключительно конфликт. */
const CONFLICT = /^(<{7} |={7}$|>{7} )/m;
const SKIP = new Set(["tests/repo-hygiene.test.js"]); // этот файл описывает маркеры в комментарии
const dirty = [];
for (const rel of tracked) {
  if (SKIP.has(rel)) continue;
  const abs = path.join(ROOT, rel);
  let st;
  try { st = fs.statSync(abs); } catch { continue; }          // файл удалён в рабочем дереве
  if (!st.isFile() || st.size > 4 * 1024 * 1024) continue;     // бинарники не читаем целиком
  if (/\.(webp|png|jpe?g|mp3|mp4|ico|woff2?|gz|zip)$/i.test(rel)) continue;
  const text = fs.readFileSync(abs, "utf8");
  if (CONFLICT.test(text)) dirty.push(rel + ":" + (text.split("\n").findIndex((l) => CONFLICT.test(l)) + 1));
}
assert.deepStrictEqual(dirty, [], "в репозитории есть маркеры незавершённого слияния: " + dirty.join(", "));

/* ── 2. Каждый JSON парсится ─────────────────────────────────────────────────
   Битый JSON данных роняет сервер при старте (fail-fast билдеров), а не отдаёт
   страницу с ошибкой: проверяем разбор всех отслеживаемых .json. */
const broken = [];
for (const rel of tracked.filter((f) => f.endsWith(".json"))) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  try { JSON.parse(fs.readFileSync(abs, "utf8")); }
  catch (e) { broken.push(rel + " — " + e.message.split("\n")[0]); }
}
assert.deepStrictEqual(broken, [], "битые JSON: " + broken.join(" | "));

/* ── 3. Данные, которые читает старт сервера, содержат ожидаемые корни ───────
   Мало распарсить: пустой или обрезанный файл тоже валидный JSON. Проверяем,
   что у ключевых наборов на месте верхнеуровневые поля, по которым их читает билдер. */
const ROOTS = [
  ["app/test/level-test.json", ["questions", "ui"]],
  ["app/probny-b1/probny-b1.json", ["questions", "ui", "limitSec"]],
  ["app/probny-a1/probny-a1.json", ["questions", "ui", "limitSec"]],
  ["app/probny-b2/probny-b2.json", ["questions", "ui", "limitSec"]],
  ["app/razgovornik/razgovornik.json", ["ui"]],
  ["app/perevodchik/perevodchik.json", ["ui"]],
  ["app/kurs/kurs.json", ["courses"]],
  ["app/help/help.json", ["ui"]],
  ["app/site-ui.json", ["ru", "en", "tr"]],
  ["app/seo-lastmod.json", ["landing.html"]],
  ["deploy/seo-keywords.json", ["pages"]],
  ["deploy/voices.json", ["voices", "characters"]],
];
for (const [rel, keys] of ROOTS) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  for (const k of keys) assert.ok(data[k] !== undefined && data[k] !== null, rel + ": нет корневого поля «" + k + "»");
}

/* ── 4. Скрипты страниц — валидный JS (данные едут внутрь <script>) ──────────
   Проверяется на артефакте: сборка страницы-теста уже делает vmScanScripts, здесь
   же ловим случай, когда JSON распарсился, но внутри строки остался мусор слияния. */
{
  const suspicious = [];
  for (const rel of tracked.filter((f) => f.endsWith(".json"))) {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (/<{7}|>{7} origin\//.test(text)) suspicious.push(rel);
  }
  assert.deepStrictEqual(suspicious, [], "следы слияния внутри JSON-строк: " + suspicious.join(", "));
}

/* Node прода закреплён в ОДНОМ месте по смыслу, но записан в четырёх: FROM Dockerfile (тег +
   digest), CI, команды докер-прогона в CLAUDE.md и в чеклисте модуля. Патч безопасности,
   поднятый в одном месте и забытый в другом, гонял бы тесты не на той Node, что прод (ревью 29.10.2026). */
{
  const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const from = /^FROM\s+node:(\d+\.\d+\.\d+)-alpine@(sha256:[0-9a-f]{64})\s*$/m.exec(rd("Dockerfile"));
  assert.ok(from, "Dockerfile: FROM node:X.Y.Z-alpine@sha256:<digest> — точная версия и digest");
  const [, ver, dig] = from;
  assert.ok(new RegExp("node-version:\\s*" + ver.replace(/\./g, "\\.") + "\\b").test(rd(".github/workflows/ci.yml")), "CI на той же Node " + ver);
  for (const f of ["CLAUDE.md", ".claude/skills/kyrgyz-course/references/module-checklist.md"]) {
    const tags = [...rd(f).matchAll(/node:(\d+[^\s'"`]*)-alpine(@sha256:[0-9a-f]{64})?/g)];
    assert.ok(tags.length, f + ": команда докер-прогона найдена");
    for (const m of tags) assert.strictEqual(m[1] + (m[2] || ""), ver + "@" + dig, f + ": докер-прогон на образе прода (тег и digest)");
  }
}

console.log("repo-hygiene.test.js: OK (" + tracked.length + " файлов без маркеров слияния, " +
  tracked.filter((f) => f.endsWith(".json")).length + " JSON парсятся, корни данных на месте)");
