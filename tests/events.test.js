"use strict";
/* Журнал занятий: событие, которое шлёт клиент, обязан принимать сервер.

   Дефект, ради которого написан этот гейт (22.08.2026, пойман живым браузером):
   белый список EV_TYPES не пополняли при появлении разделов, и сервер молча
   отбрасывал 17 типов — весь пробный экзамен, аудирование (stt.result), уроки
   (lesson.*), бейджи, видео и обращения к преподавателю. Клиентские тесты
   проверяли, что evPush вызван; серверные — что список валиден; НИКТО не
   проверял, что это один и тот же набор. Раздел считался готовым по правилу
   «трекинг ученику и учителю», а учитель не видел ничего.

   Здесь оба конца сверяются РАЗБОРОМ: типы вынимаются из собранной страницы и
   из EV_TYPES, а приём проверяется живым сервером — не литералом в тесте. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const ROOT = path.join(__dirname, "..");
const html = require("../server/appshell").buildAppHtml();
const B = (l, p) => "Basic " + Buffer.from(l + ":" + p).toString("base64");
const ILIM = B("ilim", "Tst-vKIxmveh-9"), ALT = B("altynai", "Tst-lwxo2c1U-9");
const DATA = "/tmp/kga1-events-" + process.pid;

// что клиент реально отправляет: прямые вызовы и тернарные («тренировка или экзамен»)
const direct = [...html.matchAll(/evPush\(\s*"([\w.]+)"/g)].map((m) => m[1]);
const ternary = [...html.matchAll(/evPush\(\s*[^,"]*\?\s*"([\w.]+)"\s*:\s*"([\w.]+)"/g)]
  .flatMap((m) => [m[1], m[2]]);
const sent = [...new Set(direct.concat(ternary))].sort();
assert.ok(sent.length >= 30, "разбор нашёл события клиента: " + sent.length);

// что принимает сервер: типы — ключи схемы, схема — единственный источник
const srv = fs.readFileSync(path.join(ROOT, "server", "server.js"), "utf8");
const fieldsBlock = srv.match(/const EV_FIELDS = \{([\s\S]*?)\n\};/)[1];
const schema = {};
for (const m of fieldsBlock.matchAll(/"([\w.]+)":\s*\[([^\]]*)\]/g))
  schema[m[1]] = [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1]);
const known = new Set(Object.keys(schema));
assert.ok(/const EV_TYPES = new Set\(Object\.keys\(EV_FIELDS\)\)/.test(srv),
  "типы событий выводятся из схемы, а не переписаны вторым списком");

/* ПОЛЯ каждого события сверяются с тем, что реально кладёт клиент: схемы, написанные
   «по памяти», выбрасывали полезную нагрузку шести событий (wa.click, lesson.*,
   video.*) — тип доезжал, а строка в журнале была пустой. */
{
  const re = /evPush\(\s*(?:"([\w.]+)"|[^,"]*\?\s*"([\w.]+)"\s*:\s*"([\w.]+)")\s*,\s*\{/g;
  const payload = {};
  let m;
  while ((m = re.exec(html))) {
    let depth = 0, j = re.lastIndex - 1;
    for (; j < html.length; j++) { const c = html[j]; if (c === "{") depth++; else if (c === "}") { depth--; if (!depth) break; } }
    const keys = [...html.slice(re.lastIndex, j).matchAll(/(?:^|[,{])\s*([A-Za-z_]\w*)\s*:/g)].map((x) => x[1]);
    for (const t of [m[1], m[2], m[3]].filter(Boolean))
      payload[t] = [...new Set((payload[t] || []).concat(keys))];
  }
  const holes = [];
  for (const [type, keys] of Object.entries(payload)) {
    const lost = keys.filter((k) => !(schema[type] || []).includes(k));
    if (lost.length) holes.push(type + " теряет " + lost.join("/"));
  }
  assert.deepStrictEqual(holes, [],
    "эти поля клиент шлёт, а схема их выбросит: " + holes.join("; "));
}

const lost = sent.filter((t) => !known.has(t));
assert.deepStrictEqual(lost, [],
  "сервер молча отбросил бы эти события — допишите их в EV_TYPES: " + lost.join(", "));

// и наоборот: список не хранит типы, которых никто не шлёт (мусор копится молча)
const stale = [...known].filter((t) => !sent.includes(t));
assert.deepStrictEqual(stale, [],
  "в EV_TYPES остались типы, которых клиент не шлёт: " + stale.join(", "));

/* Каждое поле схемы должно быть РАЗОБРАНО санитайзером: имя, которого нет ни в
   одном наборе и без своей ветки, молча выбрасывается — событие доедет пустым.
   Ровно так терялись цифры экзамена, когда типы уже были в EV_TYPES. */
{
  const setOf = (name) => new Set([...(srv.match(new RegExp("const " + name + " = new Set\\(\\[([\\s\\S]*?)\\]\\)"))[1])
    .matchAll(/"([\w.]+)"/g)].map((m) => m[1]));
  const parsed = new Set([...setOf("EV_NUM"), ...setOf("EV_BOOL"), ...setOf("EV_STR"),
    // поля со своей веткой в sanitizeEvent
    "mod", "cardId", "ref", "ms", "wrong"]);
  const fieldsBlock = srv.match(/const EV_FIELDS = \{([\s\S]*?)\n\};/)[1];
  const declared = new Set([...fieldsBlock.matchAll(/"([\w.]+)"/g)].map((m) => m[1])
    .filter((x) => !x.includes(".")));   // ключи-типы содержат точку, поля — нет
  const unparsed = [...declared].filter((f) => !parsed.has(f));
  assert.deepStrictEqual(unparsed, [],
    "эти поля объявлены в EV_FIELDS, но санитайзер их выбросит: " + unparsed.join(", "));
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify({ ilim: { courses: ["b1"] } }));
  const s = await startServer({ port: 8221, dataDir: DATA });
  try {
    /* Живой приём: шлём по одному событию каждого типа и требуем, чтобы КАЖДОЕ
       вернулось преподавателю. Раньше запрос отвечал 200 и на отброшенных. */
    const events = sent.map((type, i) => ({ seq: i + 1, type, mod: "m35", dt: 10 }));
    const r = await s.req("POST", "/api/events", { auth: ILIM, body: { sid: "testsid0122", events } });
    assert.strictEqual(r.status, 200, "батч принят: " + r.text);

    const back = JSON.parse((await s.req("GET", "/api/events?login=ilim&limit=200", { auth: ALT })).text);
    const items = back.items || back;
    const got = new Set(items.map((x) => x.type));
    const dropped = sent.filter((t) => !got.has(t));
    assert.deepStrictEqual(dropped, [],
      "эти события не доехали до журнала учителя: " + dropped.join(", "));

    /* Мало довезти тип — учителю нужны ЦИФРЫ. Второй слой той же дыры: у типа не
       было схемы EV_FIELDS, запись падала 500-й на весь батч; без полей строка в
       ленте была бы пустой. Шлём событие с данными и проверяем, что они дошли. */
    const rich = await s.req("POST", "/api/events", { auth: ILIM, body: { sid: "testsid0122", events: [
      { seq: 500, type: "exam.finish", mod: "m35", pct: 63, right: 57, total: 90, byTime: true, sec: 4200 },
      { seq: 501, type: "exam.train_done", mod: "m35", sub: "uguu", pct: 80, right: 8, total: 10 },
      { seq: 502, type: "exam.submit", mod: "m35", sub: "jazuu", sentences: 13 },
      { seq: 503, type: "stt.result", mod: "m0", id: "m0_01", score: 92 },
    ] } });
    assert.strictEqual(rich.status, 200, "батч с данными принят: " + rich.text);
    const rows = JSON.parse((await s.req("GET", "/api/events?login=ilim&limit=200", { auth: ALT })).text);
    const byType = (t2) => ((rows.items || rows).find((x) => x.type === t2 && x.seq >= 500)) || {};
    assert.strictEqual(byType("exam.finish").pct, 63, "процент попытки дошёл до учителя");
    assert.strictEqual(byType("exam.finish").right, 57, "и число верных ответов");
    assert.strictEqual(byType("exam.train_done").sub, "uguu", "тренировка называет свой субтест");
    assert.strictEqual(byType("exam.train_done").pct, 80, "и свой результат");
    assert.strictEqual(byType("exam.submit").sentences, 13, "объём отправленной работы виден");
    assert.strictEqual(byType("stt.result").score, 92, "балл за произнесение доезжает");

    // выдуманный тип по-прежнему отбрасывается — список не превратился в «принимаем всё»
    const bad = await s.req("POST", "/api/events", { auth: ILIM,
      body: { sid: "testsid0122", events: [{ seq: 99, type: "hack.inject", mod: "m35" }] } });
    assert.strictEqual(bad.status, 200, "неизвестный тип не роняет запрос");
    const after = JSON.parse((await s.req("GET", "/api/events?login=ilim&limit=200", { auth: ALT })).text);
    assert.ok(!(after.items || after).some((x) => x.type === "hack.inject"),
      "неизвестный тип в журнал не попадает");

    console.log("events.test.js: OK (" + sent.length + " типов событий клиента приняты сервером и " +
      "видны учителю; список EV_TYPES сверен разбором в обе стороны, чужой тип отброшен)");
  } finally { await s.stop(); fs.rmSync(DATA, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
