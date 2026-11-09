"use strict";
/* Триал-доступы: курс или одиночный модуль на срок (до даты включительно, Бишкек +06)
   либо без ограничения. Главное обещание владельцу — СУЩЕСТВУЮЩИЕ ученики не задеты:
   запись без поля trials ведёт себя ровно как раньше (постоянный доступ), а откат
   сервера на версию без триалов просто не читает незнакомое поле.
   Механизм параметризован набором (курс/модуль × активный/истёкший/бессрочный) —
   проверяется перебором, включая живой материал страницы и API-гейты. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const PORT = 8197;
const DATA = "/tmp/kga1-tr-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9");
const TC = B("tr_c", "tr-KgA1-26");   // триал-курс
const TM = B("tr_m", "tr-KgA1-26");   // триал-модуль
const TP = B("tr_p", "tr-KgA1-26");   // постоянный (нетронутость)

const iso = (days) => {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
};
const FUTURE = iso(7), PAST = "2020-01-01";

let req;
const status = async (p, auth) => (await req("GET", p, { auth })).status;
const me = async (auth) => JSON.parse((await req("GET", "/api/me", { auth })).text);
const stOf = (m, id) => { const x = m.modules.find((y) => y.id === id); return x ? x.status : "нет"; };

(async () => {
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    req = srv.req;
    for (const login of ["tr_c", "tr_m", "tr_p"])
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
        body: { login, password: "tr-KgA1-26", create: true, role: "student", courses: ["a1"] } })).status, 200, "заведён " + login);

    /* 1. Валидация PUT: мусорные триалы не проходят */
    for (const bad of [{ c1: FUTURE }, { m1: "01.09.2026" }, { m1: "2026-13-40" }, ["a2"], "a2"])
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_c", trials: bad } })).status, 400,
        "bad trials отвергнут: " + JSON.stringify(bad));
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "altynai", trials: { a2: FUTURE } } })).status, 400,
      "триалы — только ученикам");

    /* 2. Триал-КУРС активен: тропа, материал страницы, API — как у выданного */
    {
      const r = await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_c", trials: { a2: FUTURE } } });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(JSON.parse(r.text).student.trials, { a2: FUTURE }, "ответ несёт триалы");
      const m = await me(TC);
      assert.deepStrictEqual(m.courses, ["a1", "a2"], "триал-курс в тропе");
      assert.deepStrictEqual(m.trials, { a2: FUTURE }, "срок отдан клиенту (бейдж «до даты»)");
      assert.strictEqual(stOf(m, "m12"), "open", "первый модуль триал-курса открыт");
      assert.strictEqual(stOf(m, "m13"), "locked", "дальше — обычная тропа по сдаче");
      const page = (await req("GET", "/", { auth: TC })).text;
      assert.ok(page.includes("CATS_M12"), "материал триал-курса приехал в страницу");
      assert.strictEqual(await status("/api/review/m12", TC), 200, "живой API триал-курса открыт");
    }

    /* 3. Триал истёк: как отнятый курс — занятий нет, API закрыт; с прогрессом — result_only */
    {
      // прогресс по m12 — чтобы истёкший триал оставил результаты на виду
      await req("PUT", "/api/progress", { auth: TC, body: { v: 2, updatedAt: new Date().toISOString(),
        modules: { m12: { vocab: { m12_01: { box: 2, streak: 2, due: Date.now() } }, test: {} } } } });
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_c", trials: { a2: PAST } } })).status, 200);
      const m = await me(TC);
      assert.deepStrictEqual(m.courses, ["a1"], "истёкший триал-курс из тропы ушёл");
      assert.strictEqual(stOf(m, "m12"), "result_only", "модуль с прогрессом — только результаты");
      assert.strictEqual(await status("/api/review/m12", TC), 403, "живой API истёкшего триала закрыт");
      const page = (await req("GET", "/", { auth: TC })).text;
      assert.ok(page.includes('"m12_01"'), "материал для показа результатов остался в странице");
      assert.ok(!page.includes("function renderGrammarM12(m){\n"), "а справочная страница — нет");
    }

    /* 4. Триал-МОДУЛЬ чужого курса: открыт сразу, соседний модуль того же курса — нет */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_m", trials: { m14: FUTURE } } })).status, 200);
      const m = await me(TM);
      assert.deepStrictEqual(m.courses, ["a1"], "одиночный модуль курс в тропу не добавляет");
      assert.strictEqual(stOf(m, "m14"), "open", "триал-модуль открыт сразу (тропы у одиночного нет)");
      assert.strictEqual(stOf(m, "m13"), "нет", "сосед по курсу в тропе не появился");
      const page = (await req("GET", "/", { auth: TM })).text;
      assert.ok(page.includes("CATS_M14"), "материал триал-модуля приехал");
      assert.ok(!page.includes("CATS_M13"), "материал соседнего модуля — нет");
      assert.strictEqual(await status("/api/review/m14", TM), 200, "API триал-модуля открыт");
      assert.strictEqual(await status("/api/review/m13", TM), 403, "API соседнего — закрыт");
      // бессрочный триал (null): то же, но без срока
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_m", trials: { m14: null } } })).status, 200);
      const m2 = await me(TM);
      assert.strictEqual(stOf(m2, "m14"), "open", "бессрочный триал-модуль открыт");
      assert.deepStrictEqual(m2.trials, { m14: null }, "null-срок доезжает до клиента");
      // истёкший модуль без прогресса просто исчезает
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_m", trials: { m14: PAST } } })).status, 200);
      const m3 = await me(TM);
      assert.strictEqual(stOf(m3, "m14"), "нет", "истёкший триал-модуль без прогресса не отдаётся");
      assert.strictEqual(await status("/api/review/m14", TM), 403, "и API закрыт");
    }

    /* 5. Постоянная выдача курса гасит его триал (в файле не остаётся мусора) */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_c", trials: { a2: FUTURE } } })).status, 200);
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_c", courses: ["a1", "a2"] } })).status, 200);
      const students = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      assert.ok(!students.tr_c.trials, "триал выданного курса стёрт из файла");
      const m = await me(TC);
      assert.deepStrictEqual(m.courses, ["a1", "a2"], "курс постоянный");
      assert.deepStrictEqual(m.trials, {}, "сроков больше нет");
    }

    /* 5б. Триал → нормальный доступ (требование владельца).
       Курс: PUT courses с этим курсом — триал гашен, доступ постоянный (проверено в №5).
       Модуль: триал без срока (null) — занятия не истекают никогда. */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tr_m", trials: { m14: null } } })).status, 200);
      const m = await me(TM);
      assert.strictEqual(stOf(m, "m14"), "open", "модуль стал постоянным (триал без срока)");
      assert.strictEqual(await status("/api/review/m14", TM), 200, "и API открыт без срока");
      // а превращение триал-курса в постоянный уже покрыто сценарием 5: PUT courses
      // с этим курсом гасит его триал и оставляет обычную постоянную выдачу
    }

    /* 6. ГЛАВНОЕ: постоянный ученик не задет — запись без trials ведёт себя как раньше,
       и ни один сценарий выше не менял чужие записи */
    {
      const students = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      assert.ok(!("trials" in students.tr_p), "у нетронутого ученика поле trials не появилось");
      const m = await me(TP);
      assert.deepStrictEqual(m.courses, ["a1"], "курсы прежние");
      assert.deepStrictEqual(m.trials, {}, "триалов нет");
      assert.strictEqual(stOf(m, "m0"), "open", "тропа прежняя: первый модуль открыт");
      assert.strictEqual(stOf(m, "m1"), "locked", "тропа прежняя: дальше по сдаче");
      assert.strictEqual(await status("/api/review/m1", TP), 200, "API прежний");
      // и наоборот: чужой триал не открывает ничего постоянному ученику
      assert.strictEqual(await status("/api/review/m14", TP), 403, "чужие триалы не протекают");
    }

    console.log("trials.test.js: OK (валидация, курс/модуль × активный/истёкший/бессрочный, гашение при выдаче, нетронутость постоянных)");
  } finally {
    if (srv) await srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
