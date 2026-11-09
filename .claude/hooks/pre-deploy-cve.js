#!/usr/bin/env node
"use strict";
/* Проверка CVE перед каждым деплоем (hook PreToolUse на coolify_deploy).
   Зачем: 29.10.2026 прод стоял на Node до патча безопасности (Brotli RCE и ещё
   шесть CVE линии 22.x): Dockerfile брал плавающий node:22-alpine, а сборщик —
   старый образ из кэша. Ни тесты, ни ревью этого не видят: уязвимость не в коде,
   а в рантайме. Поэтому деплой не стартует, пока не доказано:
     1) Node в Dockerfile ветки main закреплён точной версией (плавающий тег — отказ);
     2) у этой линии Node нет более нового выпуска с пометкой security (nodejs.org);
     3) линия Node не вышла из поддержки (расписание nodejs/Release);
     4) если у проекта появятся npm-зависимости — npm audit без high/critical.
   Не смогли проверить (нет сети, не разобрали ответ) — тоже отказ: непроверенный
   деплой не лучше уязвимого. Отказ = exit 2, причина уходит в stderr (её видит Claude).
   Аварийный обход (откат прода при недоступном nodejs.org) — только осознанно и на
   один день: файл <git-common-dir>/kga1-cve-override с первой строкой
   «YYYY-MM-DD причина» (дата — сегодня, причина — не короче 10 знаков); хук пропускает
   деплой и печатает, что проверка обойдена и почему. Процедура — deploy/CREDENTIALS.md.
   Переопределения данных KGA1_* действуют только при KGA1_TEST=1 (режим теста).
   Внешние хосты хука: nodejs.org, raw.githubusercontent.com (только чтение, TLS).
   Лимиты шагов (git 20+10 с, сеть 15 с параллельно, npm audit 40 с) в сумме заметно меньше
   таймаута хука в .claude/settings.json (120 с): таймаут Claude Code счёл бы деплой разрешённым.
   Аварийный обход пишется в журнал <git-common-dir>/kga1-cve-override.log.
   Тест — tests/pre-deploy-cve.test.js (логика и запуск процессом на событиях). */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const INDEX_URL = "https://nodejs.org/dist/index.json";
const SCHEDULE_URL = "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json";

// Образ node из строк FROM: точная версия X.Y.Z (с любым суффиксом -alpine…) или плавающий тег
function nodeImages(dockerfile) {
  const out = [];
  for (const line of String(dockerfile).split("\n")) {
    const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(?:docker\.io\/)?(?:library\/)?node:(\S+)/i.exec(line);
    if (!m) continue;
    const v = /^(\d+)\.(\d+)\.(\d+)(?:-|@|$)/.exec(m[1]);
    out.push({ tag: m[1], version: v ? "v" + v[1] + "." + v[2] + "." + v[3] : null, major: v ? Number(v[1]) : null });
  }
  return out;
}

const cmp = (a, b) => {
  const pa = a.slice(1).split(".").map(Number), pb = b.slice(1).split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

/* Вердикт по одному образу: список причин отказа (пусто — можно). index — массив
   nodejs.org/dist/index.json, schedule — объект расписания, today — "YYYY-MM-DD". */
function verdict(img, index, schedule, today) {
  const why = [];
  if (!img.version) {
    why.push("Dockerfile: node:" + img.tag + " — плавающий тег; сборщик может взять старый образ из кэша. Закрепите точную версию (node:X.Y.Z-alpine).");
    return why;
  }
  const line = index.filter((r) => r && /^v\d+\.\d+\.\d+$/.test(r.version) && Number(r.version.slice(1).split(".")[0]) === img.major);
  if (!line.some((r) => r.version === img.version))
    why.push("Node " + img.version + " нет в списке выпусков nodejs.org — версия не опознана.");
  const sec = line.filter((r) => r.security && cmp(r.version, img.version) > 0).sort((a, b) => cmp(b.version, a.version));
  if (sec.length)
    why.push("Node " + img.version + " уязвим: вышли выпуски безопасности " +
      sec.map((r) => r.version + " (" + r.date + ")").join(", ") +
      ". Поднимите FROM до node:" + sec[0].version.slice(1) + "-alpine или новее и прогоните тесты.");
  const sch = (schedule || {})["v" + img.major];
  if (!sch || !sch.end) why.push("Расписание поддержки Node v" + img.major + " не найдено — линия не опознана.");
  else if (sch.end < today) why.push("Node v" + img.major + " вне поддержки с " + sch.end + ": патчей безопасности больше не будет — переходите на поддерживаемую линию.");
  return why;
}

// переопределения данных — только в режиме теста: в обычной сессии их игнорируем
const TEST = process.env.KGA1_TEST === "1";
const testEnv = (k) => (TEST ? process.env[k] : undefined);

// Данные: по сети, либо из файлов (KGA1_NODE_INDEX / KGA1_NODE_SCHEDULE — тест)
async function loadJson(url, envFile) {
  if (envFile) return JSON.parse(fs.readFileSync(envFile, "utf8"));
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(url + " → HTTP " + r.status);
  return r.json();
}

// Dockerfile того, что уедет на прод: Coolify собирает main с GitHub, поэтому origin/main.
// Локальная рабочая копия НЕ подменяет его: git недоступен — исключение и отказ
// (проверенный «не тот» файл хуже непроверенного). Файл KGA1_DOCKERFILE — только тест.
function deployedDockerfile(dir) {
  const f = testEnv("KGA1_DOCKERFILE");
  if (f) return fs.readFileSync(f, "utf8");
  execFileSync("git", ["-C", dir, "fetch", "-q", "origin", "main"], { stdio: "ignore", timeout: 20000 });
  return execFileSync("git", ["-C", dir, "show", "origin/main:Dockerfile"], { encoding: "utf8", timeout: 10000 });
}

// Аварийный обход на один день (см. шапку): {reason} либо null
function emergencyOverride(dir, today) {
  let file = testEnv("KGA1_CVE_OVERRIDE_FILE");
  if (!file) {
    try {
      const gd = execFileSync("git", ["-C", dir, "rev-parse", "--git-common-dir"], { encoding: "utf8", timeout: 5000 }).trim();
      file = path.resolve(dir, gd, "kga1-cve-override");
    } catch (e) { return null; }
  }
  let first = "";
  try { first = fs.readFileSync(file, "utf8").split("\n")[0].trim(); } catch (e) { return null; }
  const m = /^(\d{4}-\d{2}-\d{2})\s+(.{10,})$/.exec(first);
  return m && m[1] === today ? { reason: m[2].trim(), file } : null;
}

// Разбор отчёта `npm audit --json`: причины отказа (high/critical или неразбираемый ответ)
function auditVerdict(text) {
  let rep;
  try { rep = JSON.parse(text); } catch (e) { return ["npm audit не дал разбираемого ответа — проверка зависимостей не выполнена."]; }
  const v = ((rep || {}).metadata || {}).vulnerabilities;
  if (!v || typeof v !== "object") return ["npm audit: в отчёте нет metadata.vulnerabilities — проверка зависимостей не выполнена."];
  const bad = (v.high || 0) + (v.critical || 0);
  return bad ? ["npm audit: high " + (v.high || 0) + ", critical " + (v.critical || 0) + " — обновите зависимости до деплоя."] : [];
}

// npm-зависимостей у проекта нет; появятся — audit обязателен (high/critical — отказ)
function npmAudit(dir) {
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch (e) { return []; }
  if (!Object.keys(pkg.dependencies || {}).length) return [];
  let out = "";
  try { out = execFileSync("npm", ["audit", "--omit=dev", "--json"], { cwd: dir, encoding: "utf8", timeout: 40000 }); }
  catch (e) { out = String(e.stdout || ""); }
  return auditVerdict(out);
}

// След аварийного обхода — строка в журнале рядом с файлом: кто, когда, почему, что нашли
function logOverride(ov, why) {
  try {
    const user = (() => { try { return require("os").userInfo().username; } catch (e) { return "?"; } })();
    fs.appendFileSync(ov.file + ".log", new Date().toISOString() + "\t" + user + "\t" + ov.reason + "\t" + why.join(" | ").slice(0, 500) + "\n");
  } catch (e) {}
}

/* Что считается выкаткой: деплой Coolify, а также start/restart через coolify_control
   (может поднять или пересобрать образ); stop — аварийная остановка, её не держим.
   Запуск без события (`--check`) — из deploy/deploy-xpertnet.sh перед вызовом API. */
const isRollout = (ev) => /coolify_deploy$/.test(String(ev.tool_name || "")) ||
  (/coolify_control$/.test(String(ev.tool_name || "")) && /^(start|restart)$/.test(String((ev.tool_input || {}).action || "")));
// Файл аварийного обхода создаёт только человек в своём терминале: запись в него инструментами
// агента отклоняется — иначе отказ хука снимался бы самим агентом. Упоминание в тексте (доки,
// чтение, удаление файла — оно обход снимает) не держим: только запись файла и его журнала.
const OVERRIDE_RE = /kga1-cve-override/;
const WRITE_CMD_RE = />|\btee\b|\btouch\b|\bcp\b|\bmv\b|\bln\b|\bdd\b|\binstall\b|\b(?:sed|perl)\s+-i|\bpython3?\b|\bnode\b|\bruby\b/;
const touchesOverride = (ev) => {
  const tool = String(ev.tool_name || ""), inp = ev.tool_input || {};
  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) return OVERRIDE_RE.test(String(inp.file_path || inp.notebook_path || ""));
  if (tool === "Bash") { const c = String(inp.command || ""); return OVERRIDE_RE.test(c) && WRITE_CMD_RE.test(c); }
  return false;
};

async function main(argv) {
  let ev = {};
  if (argv.includes("--check")) ev = { tool_name: "coolify_deploy" };
  else try { ev = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch (e) {}
  if (touchesOverride(ev)) {
    process.stderr.write("Файл аварийного обхода проверки CVE (kga1-cve-override) создаёт только человек в своём терминале " +
      "(процедура — deploy/CREDENTIALS.md, «Откат деплоя»). Агенту этот файл трогать нельзя.\n");
    return 2;
  }
  if (!isRollout(ev)) return 0;   // остальные инструменты хук не трогает
  const dir = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
  const today = testEnv("KGA1_TODAY") || new Date().toISOString().slice(0, 10);
  const why = [];
  try {
    const imgs = nodeImages(deployedDockerfile(dir));
    if (!imgs.length) why.push("В Dockerfile нет образа node — проверять нечего, это подозрительно: деплой остановлен.");
    const [index, schedule] = await Promise.all([
      loadJson(INDEX_URL, testEnv("KGA1_NODE_INDEX")), loadJson(SCHEDULE_URL, testEnv("KGA1_NODE_SCHEDULE"))]);
    if (!Array.isArray(index)) throw new Error("список выпусков Node не массив");
    for (const img of imgs) why.push(...verdict(img, index, schedule, today));
    why.push(...npmAudit(dir));
    if (!why.length) {
      process.stdout.write("CVE-проверка перед деплоем: " + imgs.map((i) => "Node " + i.version).join(", ") +
        " — патчей безопасности новее нет, линия поддерживается.\n");
      return 0;
    }
  } catch (e) {
    why.push("Проверка CVE не выполнена (" + String(e.message || e).slice(0, 200) + ") — повторите, когда сеть доступна.");
  }
  const ov = emergencyOverride(dir, today);
  if (ov) {
    logOverride(ov, why);
    process.stdout.write("ВНИМАНИЕ: проверка CVE ОБОЙДЕНА аварийным файлом " + ov.file + " (причина: " + ov.reason +
      "). Найдено:\n- " + why.join("\n- ") + "\nПосле отката удалите файл и закройте причину.\n");
    return 0;
  }
  process.stderr.write("Деплой остановлен проверкой CVE (.claude/hooks/pre-deploy-cve.js):\n- " + why.join("\n- ") + "\n");
  return 2;
}

// любой непойманный сбой — отказ (exit 2), а не exit 1: его Claude Code счёл бы нефатальным и пропустил деплой
if (require.main === module) main(process.argv.slice(2)).then((code) => process.exit(code),
  (e) => { process.stderr.write("Проверка CVE упала: " + String((e && e.message) || e).slice(0, 300) + "\n"); process.exit(2); });
module.exports = { nodeImages, verdict, cmp, auditVerdict, isRollout, touchesOverride };
