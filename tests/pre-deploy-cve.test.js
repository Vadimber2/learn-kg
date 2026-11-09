"use strict";
/* Проверка CVE перед деплоем (hook PreToolUse на coolify_deploy): деплой не стартует
   на плавающем теге Node, на версии с вышедшим патчем безопасности, на линии вне
   поддержки и при сбое самой проверки. Проверяется поведение: вердикт на модельных
   выпусках и сам хук, запущенный процессом с событием на stdin, — как его зовёт
   Claude Code (exit 2 = отказ, причина в stderr). */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const HOOK = path.join(ROOT, ".claude", "hooks", "pre-deploy-cve.js");
const { nodeImages, verdict, auditVerdict, isRollout, touchesOverride } = require(HOOK);

// 1. Разбор FROM: точная версия, суффиксы, платформа; плавающий тег опознаётся как плавающий
assert.deepStrictEqual(nodeImages("FROM node:22.23.4-alpine\n").map((x) => x.version), ["v22.23.4"]);
assert.deepStrictEqual(nodeImages("FROM --platform=linux/amd64 node:22.23.4-alpine3.20 AS b\n").map((x) => x.version), ["v22.23.4"]);
assert.deepStrictEqual(nodeImages("FROM docker.io/library/node:24.1.0\n").map((x) => x.version), ["v24.1.0"]);
assert.deepStrictEqual(nodeImages("FROM node:22.23.4-alpine@sha256:" + "a".repeat(64) + "\n").map((x) => x.version), ["v22.23.4"], "тег с digest");
assert.strictEqual(nodeImages("FROM node:22-alpine\n")[0].version, null, "node:22-alpine — плавающий");
assert.strictEqual(nodeImages("FROM node:lts\n")[0].version, null, "node:lts — плавающий");
assert.strictEqual(nodeImages("FROM alpine:3.20\n").length, 0, "не-node образ не считается");

// 2. Вердикт на модельных выпусках: перебор случаев
const IDX = [
  { version: "v24.22.1", date: "2026-10-20", security: true },
  { version: "v22.23.5", date: "2026-10-28", security: false },
  { version: "v22.23.4", date: "2026-10-20", security: true },
  { version: "v22.23.3", date: "2026-09-23", security: false },
  { version: "v22.23.2", date: "2026-07-28", security: true },
  { version: "v18.20.8", date: "2025-03-27", security: false },
];
const SCH = { v22: { end: "2027-04-30" }, v24: { end: "2028-04-30" }, v18: { end: "2025-04-30" } };
const V = (df, today) => verdict(nodeImages(df)[0], IDX, SCH, today || "2026-10-29");
assert.deepStrictEqual(V("FROM node:22.23.4-alpine"), [], "последний патч безопасности линии — деплой разрешён");
assert.deepStrictEqual(V("FROM node:22.23.5-alpine"), [], "новее патча (без security) — разрешён");
{
  const w = V("FROM node:22.23.3-alpine");
  assert.strictEqual(w.length, 1, "версия до патча — один отказ");
  assert.ok(/v22\.23\.4/.test(w[0]) && /node:22\.23\.4-alpine/.test(w[0]), "отказ называет патч и строку FROM для правки: " + w[0]);
}
{
  const w = V("FROM node:22.23.2-alpine");
  assert.ok(/v22\.23\.4/.test(w[0]) && !/v22\.23\.2 \(/.test(w[0]), "в списке только НОВЫЕ выпуски безопасности");
  assert.ok(!/v24/.test(w[0]), "чужая линия (24.x) в вердикт 22.x не попадает");
}
assert.ok(/плавающий тег/.test(V("FROM node:22-alpine")[0]), "плавающий тег — отказ");
assert.ok(V("FROM node:18.20.8").some((x) => /вне поддержки с 2025-04-30/.test(x)), "линия вне поддержки — отказ");
assert.ok(V("FROM node:22.99.0-alpine").some((x) => /не опознана/.test(x)), "неизвестная версия — отказ");
assert.ok(V("FROM node:22.23.4-alpine", "2027-05-01").some((x) => /вне поддержки/.test(x)), "та же версия после EOL — отказ");

// 2б. Разбор npm audit: перебор отчётов
assert.deepStrictEqual(auditVerdict(JSON.stringify({ metadata: { vulnerabilities: { low: 3, moderate: 1, high: 0, critical: 0 } } })), [], "low/moderate — не отказ");
assert.ok(/high 2/.test(auditVerdict(JSON.stringify({ metadata: { vulnerabilities: { high: 2 } } }))[0]), "high — отказ");
assert.ok(/critical 1/.test(auditVerdict(JSON.stringify({ metadata: { vulnerabilities: { critical: 1 } } }))[0]), "critical — отказ");
assert.ok(/не дал разбираемого/.test(auditVerdict("npm ERR! no lockfile")[0]), "мусор вместо JSON — отказ");
assert.ok(/нет metadata/.test(auditVerdict(JSON.stringify({ error: { code: "ENOLOCK" } }))[0]), "отчёт без счётчиков — отказ");

// 2в. Что считается выкаткой и что — попыткой агента снять отказ
assert.ok(isRollout({ tool_name: "mcp__cce-enterprise__coolify_deploy" }), "деплой");
assert.ok(isRollout({ tool_name: "mcp__cce-enterprise__coolify_control", tool_input: { action: "restart" } }), "restart");
assert.ok(isRollout({ tool_name: "mcp__cce-enterprise__coolify_control", tool_input: { action: "start" } }), "start");
assert.ok(!isRollout({ tool_name: "mcp__cce-enterprise__coolify_control", tool_input: { action: "stop" } }), "stop — аварийная остановка, не держим");
assert.ok(!isRollout({ tool_name: "Bash", tool_input: { command: "ls" } }), "прочее — не выкатка");
const OV = "kga1-cve-" + "override";   // имя собрано, чтобы сам тест не выглядел записью обхода
assert.ok(touchesOverride({ tool_name: "Bash", tool_input: { command: "echo 2026-10-29 причина > .git/" + OV } }), "Bash-запись файла обхода");
assert.ok(touchesOverride({ tool_name: "Bash", tool_input: { command: "printf x | tee .git/" + OV } }), "tee в файл обхода");
assert.ok(touchesOverride({ tool_name: "Write", tool_input: { file_path: "/r/.git/" + OV } }), "Write файла обхода");
assert.ok(touchesOverride({ tool_name: "Edit", tool_input: { file_path: "/r/.git/" + OV + ".log" } }), "правка журнала обхода");
assert.ok(!touchesOverride({ tool_name: "Bash", tool_input: { command: "rm .git/" + OV } }), "удаление обхода (снимает его) — можно");
assert.ok(!touchesOverride({ tool_name: "Bash", tool_input: { command: "grep -n " + OV + " deploy/CREDENTIALS.md" } }), "чтение/поиск — можно");
assert.ok(!touchesOverride({ tool_name: "Edit", tool_input: { file_path: "deploy/CREDENTIALS.md", old_string: OV } }), "правка доков с упоминанием — можно");

// 3. Хук процессом: событие деплоя, данные из файлов (сеть в тесте не нужна)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "kga1-cve-"));
try {
  const idxF = path.join(TMP, "index.json"), schF = path.join(TMP, "schedule.json");
  fs.writeFileSync(idxF, JSON.stringify(IDX));
  fs.writeFileSync(schF, JSON.stringify(SCH));
  const run = (df, tool, extra) => {
    const dfF = path.join(TMP, "Dockerfile");
    fs.writeFileSync(dfF, df);
    return spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: tool || "mcp__cce-enterprise__coolify_deploy", tool_input: { uuid: "x" } }),
      encoding: "utf8", timeout: 20000,
      env: Object.assign({}, process.env, { KGA1_TEST: "1", CLAUDE_PROJECT_DIR: ROOT, KGA1_DOCKERFILE: dfF,
        KGA1_CVE_OVERRIDE_FILE: path.join(TMP, "override"),
        KGA1_NODE_INDEX: idxF, KGA1_NODE_SCHEDULE: schF, KGA1_TODAY: "2026-10-29" }, extra || {}) });
  };
  const ok = run("FROM node:22.23.4-alpine\n");
  assert.strictEqual(ok.status, 0, "патченый Node — деплой проходит: " + ok.stderr);
  assert.ok(/CVE-проверка перед деплоем: Node v22\.23\.4/.test(ok.stdout), "итог проверки печатается");
  const bad = run("FROM node:22.23.3-alpine\n");
  assert.strictEqual(bad.status, 2, "уязвимый Node — exit 2 (Claude Code отменяет вызов)");
  assert.ok(/Деплой остановлен проверкой CVE/.test(bad.stderr) && /v22\.23\.4/.test(bad.stderr), "причина в stderr");
  assert.strictEqual(run("FROM node:22-alpine\n").status, 2, "плавающий тег — exit 2");
  assert.strictEqual(run("FROM alpine:3.20\n").status, 2, "Dockerfile без node — exit 2");
  // сбой самой проверки (нет данных) — тоже отказ: непроверенный деплой не пропускается
  const fail = run("FROM node:22.23.4-alpine\n", null, { KGA1_NODE_INDEX: path.join(TMP, "nope.json") });
  assert.strictEqual(fail.status, 2, "проверка не выполнена — exit 2");
  assert.ok(/Проверка CVE не выполнена/.test(fail.stderr));
  // вне режима теста переопределения KGA1_* игнорируются: проверяется origin/main
  // настоящего репозитория, а git недоступен (каталог без .git) — отказ, а не локальный файл
  const noGit = fs.mkdtempSync(path.join(os.tmpdir(), "kga1-nogit-"));
  fs.writeFileSync(path.join(noGit, "Dockerfile"), "FROM node:22.23.4-alpine\n");
  const ng = run("FROM node:22.23.4-alpine\n", null, { KGA1_TEST: "", CLAUDE_PROJECT_DIR: noGit });
  fs.rmSync(noGit, { recursive: true, force: true });
  assert.strictEqual(ng.status, 2, "git недоступен — отказ, локальный Dockerfile не подменяет origin/main");
  assert.ok(/Проверка CVE не выполнена/.test(ng.stderr), "причина — проверка не выполнена");
  // аварийный обход: только сегодняшняя дата и причина не короче 10 знаков
  const ovF = path.join(TMP, "override");
  fs.writeFileSync(ovF, "2026-10-29 откат прода после падения, nodejs.org недоступен\n");
  const ov = run("FROM node:22.23.3-alpine\n");
  assert.strictEqual(ov.status, 0, "сегодняшний аварийный файл пропускает деплой");
  assert.ok(/ОБОЙДЕНА/.test(ov.stdout) && /откат прода/.test(ov.stdout) && /v22\.23\.4/.test(ov.stdout),
    "обход громкий: причина обхода и найденное печатаются");
  fs.writeFileSync(ovF, "2026-10-28 вчерашний откат прода и т.п.\n");
  assert.strictEqual(run("FROM node:22.23.3-alpine\n").status, 2, "вчерашний файл не действует");
  fs.writeFileSync(ovF, "2026-10-29 надо\n");
  assert.strictEqual(run("FROM node:22.23.3-alpine\n").status, 2, "причина короче 10 знаков не принимается");
  fs.rmSync(ovF);
  // журнал обхода: строка с причиной ложится рядом с файлом
  fs.writeFileSync(ovF, "2026-10-29 откат прода после падения, nodejs.org недоступен\n");
  run("FROM node:22.23.3-alpine\n");
  assert.ok(/откат прода/.test(fs.readFileSync(ovF + ".log", "utf8")), "обход записан в журнал");
  fs.rmSync(ovF); fs.rmSync(ovF + ".log");
  // агент не может создать файл обхода: хук отклоняет запись (exit 2), чтение — пропускает
  const guard = (tool, input) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ tool_name: tool, tool_input: input }),
    encoding: "utf8", timeout: 10000, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: ROOT }) });
  const g = guard("Bash", { command: "echo 2026-10-29 причина-причина > .git/" + OV });
  assert.strictEqual(g.status, 2, "запись файла обхода агентом — exit 2");
  assert.ok(/только человек/.test(g.stderr), "причина отказа понятна");
  assert.strictEqual(guard("Bash", { command: "ls" }).status, 0, "обычная команда проходит");
  // stop через coolify_control — без проверки даже на уязвимом Dockerfile; restart — с проверкой
  const ctl = (action) => spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "mcp__cce-enterprise__coolify_control", tool_input: { action } }), encoding: "utf8", timeout: 20000,
    env: Object.assign({}, process.env, { KGA1_TEST: "1", CLAUDE_PROJECT_DIR: ROOT, KGA1_DOCKERFILE: path.join(TMP, "Dockerfile"),
      KGA1_NODE_INDEX: idxF, KGA1_NODE_SCHEDULE: schF, KGA1_TODAY: "2026-10-29", KGA1_CVE_OVERRIDE_FILE: ovF }) });
  fs.writeFileSync(path.join(TMP, "Dockerfile"), "FROM node:22.23.3-alpine\n");
  assert.strictEqual(ctl("stop").status, 0, "stop не держим");
  assert.strictEqual(ctl("restart").status, 2, "restart на уязвимом Node — отказ");
  // режим --check (deploy-xpertnet.sh): без события на stdin, тот же вердикт
  const chk = (df) => { fs.writeFileSync(path.join(TMP, "Dockerfile"), df);
    return spawnSync(process.execPath, [HOOK, "--check"], { encoding: "utf8", timeout: 20000, input: "",
      env: Object.assign({}, process.env, { KGA1_TEST: "1", CLAUDE_PROJECT_DIR: ROOT, KGA1_DOCKERFILE: path.join(TMP, "Dockerfile"),
        KGA1_NODE_INDEX: idxF, KGA1_NODE_SCHEDULE: schF, KGA1_TODAY: "2026-10-29", KGA1_CVE_OVERRIDE_FILE: ovF }) }); };
  assert.strictEqual(chk("FROM node:22.23.4-alpine\n").status, 0, "--check: патченый Node проходит");
  assert.strictEqual(chk("FROM node:22-alpine\n").status, 2, "--check: плавающий тег — отказ");
  // чужой инструмент хук не трогает даже на уязвимом Dockerfile
  assert.strictEqual(run("FROM node:22.23.3-alpine\n", "Bash").status, 0, "не деплой — хук молчит");
  assert.strictEqual(run("FROM node:22.23.3-alpine\n", "Bash").stdout, "");
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

// 4. Хук подключён: PreToolUse на деплой Coolify в настройках проекта, и Dockerfile репозитория проходит его сам
{
  const st = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const pre = (st.hooks.PreToolUse || []).find((x) => /coolify_deploy/.test(x.matcher) && /coolify_control/.test(x.matcher));
  assert.ok(pre && pre.hooks.some((h) => /pre-deploy-cve\.js/.test(h.command)), "хук зарегистрирован на coolify_deploy и coolify_control");
  // таймаут хука с запасом над суммой лимитов шагов (git 30 + сеть 15 + audit 40): иначе таймаут = пропуск деплоя
  assert.ok(pre.hooks.every((h) => h.timeout >= 100), "таймаут хука ≥ 100 с");
  const guardReg = (st.hooks.PreToolUse || []).find((x) => /Bash/.test(x.matcher) && /Write/.test(x.matcher) && /Edit/.test(x.matcher));
  assert.ok(guardReg && guardReg.hooks.some((h) => /pre-deploy-cve\.js/.test(h.command)), "страж файла обхода на Bash/Write/Edit");
  // канонический деплой-скрипт зовёт проверку ДО запроса к API (исполнять скрипт в тесте нельзя — он деплоит)
  const sh = fs.readFileSync(path.join(ROOT, "deploy", "deploy-xpertnet.sh"), "utf8");
  assert.ok(sh.indexOf("pre-deploy-cve.js\" --check") > 0 && sh.indexOf("pre-deploy-cve.js\" --check") < sh.indexOf("curl -sS"),
    "deploy-xpertnet.sh: проверка CVE перед вызовом Coolify API");
  const img = nodeImages(fs.readFileSync(path.join(ROOT, "Dockerfile"), "utf8"));
  assert.ok(img.length && img.every((x) => x.version), "Dockerfile проекта закрепляет точную версию Node");
}

console.log("pre-deploy-cve.test.js: OK (FROM: точная версия и плавающий тег; вердикт: патч, новее, до патча, EOL, неизвестная; хук процессом: exit 0/2, сбой проверки и недоступный git = отказ, тестовые переопределения только при KGA1_TEST, аварийный обход на день с журналом, агенту запись обхода запрещена; coolify_control start/restart; --check для deploy-xpertnet.sh; npm audit; регистрация)");
