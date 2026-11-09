"use strict";
/* Интеграционные тесты персональной сборки приложения.
   Правило: ученик получает данные только своих курсов — материал чужого курса не должен
   ни приезжать в исходнике страницы, ни доставаться через API. Отдельно проверяется
   обещание владельца: при отъёме курса ученик продолжает видеть свои результаты по нему,
   но учиться по нему не может. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { startServer } = require("./helpers/serve");

const PORT = 8193;
const DATA = "/tmp/kga1-pu-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9"); // преподаватель
const A1 = B("pu_a1", "pu-KgA1-26"), A2 = B("pu_a2", "pu-KgA1-26"), EX = B("pu_ex", "pu-KgA1-26");

let req;
const status = async (p, auth) => (await req("GET", p, { auth })).status;

(async () => {
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    req = srv.req;
    // ученики: A1, A2, и тот, у кого курс A2 отберут
    for (const [login, courses] of [["pu_a1", ["a1"]], ["pu_a2", ["a2"]], ["pu_ex", ["a1", "a2"]]]) {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
        body: { login, password: "pu-KgA1-26", create: true, role: "student", courses } })).status, 200, "заведён " + login);
    }

    /* 1. Материала чужого курса нет в исходнике страницы — ни данных, ни справочных страниц */
    const pageA1 = (await req("GET", "/", { auth: A1 })).text;
    for (const marker of ["CATS_M12", "VOCAB_M12", '"m12_', "renderGrammarM12", "m12:{ref:"])
      assert.ok(!pageA1.includes(marker), "ученику A1 не приезжает " + marker);
    assert.ok(pageA1.includes("CATS_M1 ") || pageA1.includes("CATS_M1="), "свой материал на месте");
    assert.ok(pageA1.includes("===DATA==="), "маркеры блока данных сохранены");

    const pageTeacher = (await req("GET", "/", { auth: ALT })).text;
    assert.ok(pageTeacher.includes("CATS_M23") && pageTeacher.includes("renderRefM23"), "преподаватель видит весь каталог");
    assert.ok(pageA1.length < pageTeacher.length * 0.8, "вариант ученика заметно меньше полного каталога");

    /* 2. Вариант остаётся рабочей страницей: данные исполняются, alias-слова резолвятся */
    const dm = pageA1.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
    const sb = { console };
    vm.createContext(sb);
    vm.runInContext(dm[1] + ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;", sb);
    assert.strictEqual(sb.CONTENT_READY.join(), "m0,m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11", "готов ровно курс A1");
    for (const mid of sb.CONTENT_READY) {
      for (const v of sb.CONTENT[mid].vocab) {
        if (!v.ref) continue;
        const donor = mid === "m0" ? "m0" : v.ref.split("_")[0];
        assert.ok(sb.CONTENT[donor], "донор " + donor + " для alias " + v.ref + " есть в варианте");
      }
    }

    /* 3. Набор без A1 (ученик сдал A1 вне тренажёра) — рабочий стартовый экран */
    const pageA2 = (await req("GET", "/", { auth: A2 })).text;
    const dm2 = pageA2.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
    const sb2 = { console };
    vm.createContext(sb2);
    vm.runInContext(dm2[1] + ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;", sb2);
    assert.ok(sb2.CONTENT.m0, "m0 есть в любом варианте: с него стартует приложение");
    assert.ok(sb2.CONTENT_READY.includes("m0"), "стартовый модуль готов, а не «контент скоро»");
    assert.ok(sb2.CONTENT_READY.includes("m12"), "свой курс на месте");
    assert.ok(sb2.CONTENT.m1, "донор alias-слов A2 приехал вместе с курсом");
    assert.ok(!sb2.CONTENT_READY.includes("m1"), "но донор не показывается как отдельный модуль");

    /* 3б. Ученик без A1 должен попасть в СВОЙ модуль, а не в чужой М0, и увидеть тропу
       даже офлайн (ME ещё нет). Оба правила живут в клиенте — проверяем их в исходнике. */
    assert.ok(/function startModule\(\)\{[\s\S]*?myCourses\(\)/.test(pageA2), "стартовый модуль выбирается по тропе ученика");
    assert.ok(/activeModule=startModule\(\);activeTab="overview"/.test(pageA2), "откат с закрытого модуля — на первый доступный");
    assert.ok(/ST\.courses=ME\.courses/.test(pageA2), "курсы запоминаются локально для офлайна");
    assert.ok(/function readyCourses\(\)/.test(pageA2) && /\|\|readyCourses\(\)\)/.test(pageA2),
      "без профиля тропа берётся из сборки, а не из жёсткого «a1»");
    // Слово, переиспользованное в модуле A2, живёт в бакете A1 — ученик с одним A2 его учит
    assert.ok(/function studyableCard\(c\)\{return !!c&&studyableIds\(\)\.has\(c\.id\);\}/.test(pageA2),
      "доступность слова — по словарям открытых модулей, а не по модулю-донору");

    /* 4. API чужого курса закрыт: контент не вынуть в обход страницы */
    for (const p of ["/api/review/m12", "/api/overrides/m12", "/api/audio/m12/list", "/api/audio/m12/meta"])
      assert.strictEqual(await status(p, A1), 403, "ученику A1 закрыт " + p);
    assert.strictEqual(await status("/api/audio/m12/m12_01.mp3", A1), 403, "аудио чужого модуля закрыто");
    for (const p of ["/api/review/m3", "/api/overrides/m3", "/api/audio/m0/list"])
      assert.strictEqual(await status(p, A1), 200, "свой модуль открыт: " + p);
    assert.strictEqual(await status("/api/review/m1", A2), 200, "донор alias-слов открыт ученику A2");
    for (const p of ["/api/review/m12", "/api/audio/m23/list"])
      assert.strictEqual(await status(p, ALT), 200, "преподавателю открыт " + p);

    /* 4б. Полный набор A1+A2: тропа целиком, все alias резолвятся, ничего не потеряно */
    {
      const both = (await req("GET", "/", { auth: EX })).text;
      const d = both.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
      const s = { console };
      vm.createContext(s);
      vm.runInContext(d[1] + ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;this.DIALOGS=DIALOGS;", s);
      assert.strictEqual(s.CONTENT_READY.length, 24, "оба курса целиком");
      let alias = 0;
      for (const mid of s.CONTENT_READY) for (const v of s.CONTENT[mid].vocab) {
        if (!v.ref) continue;
        alias++;
        const donor = v.ref.startsWith("ph_") ? "m0" : v.ref.split("_")[0];
        assert.ok((s.CONTENT[donor].vocab || []).some((x) => x.id === v.ref), "донор для " + v.ref);
      }
      assert.ok(alias > 400, "переиспользованные слова на месте: " + alias);
      assert.ok(Object.keys(s.DIALOGS).length >= 22, "диалоги обоих курсов");
      assert.ok(/renderGrammarM1\(m\)\{/.test(both) && /renderRefM23\(m\)\{/.test(both), "справочные страницы обоих курсов");
    }

    /* 5. Кэш и заголовки: вариант ревалидируется, но общим кэшем не хранится */
    const r1 = await req("GET", "/", { auth: A1, gzip: true });
    assert.ok(/private/.test(r1.headers.get("cache-control")), "персональная страница — private");
    assert.ok(/no-cache/.test(r1.headers.get("cache-control")), "и всегда ревалидируется");
    assert.ok(/Cookie/.test(r1.headers.get("vary") || ""), "Vary: Cookie");
    assert.strictEqual(r1.headers.get("content-encoding"), "gzip", "страница жмётся");
    const tag = r1.headers.get("etag");
    const r304 = await req("GET", "/", { auth: A1, etag: tag, gzip: true });
    assert.strictEqual(r304.status, 304, "повторный заход — 304");
    // 304 — ОБЫЧНЫЙ путь возвращающегося ученика (private, no-cache): контракт офлайн-оболочки
    // обязан ехать и с ним, иначе каждый повторный заход стирал бы кэш sw.js.
    assert.ok(r304.headers.get("x-app-shell"), "X-App-Shell едет и с 304");
    const other = await req("GET", "/", { auth: EX });
    assert.notStrictEqual(other.headers.get("etag"), tag, "у другого набора курсов другой вариант");

    /* 6. Отъём курса: результаты остаются видимыми, занятия закрываются.
       Право на просмотр даёт история выдач (formerly), а не прогресс — тот ученик присылает сам. */
    await req("PUT", "/api/progress", { auth: EX, body: { v: 2, updatedAt: new Date().toISOString(),
      modules: { m12: { vocab: { m12_01: { box: 2, streak: 1, due: Date.now() } }, test: {} } } } });
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "pu_ex", courses: ["a1"] } })).status, 200, "курс A2 отобран");

    const students = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
    assert.deepStrictEqual(students.pu_ex.formerly, ["a2"], "отнятый курс записан в историю выдач");
    const prog = JSON.parse((await req("GET", "/api/progress", { auth: EX })).text);
    assert.ok(prog.modules.m12.vocab.m12_01, "прогресс ученика при отъёме курса не тронут");

    const pageEx = (await req("GET", "/", { auth: EX })).text;
    assert.ok(pageEx.includes('"m12_01"'), "материал для показа результатов приехал");
    assert.ok(!pageEx.includes("function renderGrammarM12(m){\n"), "но справочная страница отнятого курса — нет");
    const dm3 = pageEx.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
    const sb3 = { console };
    vm.createContext(sb3);
    vm.runInContext(dm3[1] + ";this.CONTENT_READY=CONTENT_READY;", sb3);
    assert.ok(sb3.CONTENT_READY.includes("m12"), "модуль отнятого курса числится готовым — иначе результаты по нему не нарисовать");

    const me = JSON.parse((await req("GET", "/api/me", { auth: EX })).text);
    assert.deepStrictEqual(me.courses, ["a1"], "в тропе ученика отнятого курса нет");
    // Сервер сам называет состояние отнятого курса: клиенту не приходится выводить его
    // пересечением courses×status, а старый клиент трактует незнакомый статус как запертый.
    const m12 = me.modules.find((m) => m.id === "m12");
    assert.ok(m12 && m12.status === "result_only", "модуль отнятого курса отдан со статусом result_only");
    assert.ok(!me.modules.some((m) => m.id === "m12" && (m.status === "open" || m.status === "passed")),
      "и не открыт для занятий");
    assert.strictEqual(await status("/api/review/m12", EX), 403, "и его материал по API закрыт");

    /* 7. Самописный прогресс без истории выдач курса не открывает: PUT /api/progress принимает
       любой стейт, поэтому «есть прогресс» не может быть основанием для доступа. */
    await req("PUT", "/api/progress", { auth: A1, body: { v: 2, updatedAt: new Date().toISOString(),
      modules: { m12: { vocab: { m12_01: { box: 3, streak: 3, due: Date.now() } }, test: {} } } } });
    assert.ok(!(await req("GET", "/", { auth: A1 })).text.includes("CATS_M12"), "вписанный себе прогресс курса не открывает");

    /* 8. Повторная выдача возвращает курс целиком */
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "pu_ex", courses: ["a1", "a2"] } })).status, 200);
    const back = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
    assert.ok(!back.pu_ex.formerly, "курс вернули — истории отъёма больше нет");
    assert.ok((await req("GET", "/", { auth: EX })).text.includes("renderGrammarM12"), "материал курса вернулся полностью");

    /* 9. Серверный гейт согласован с клиентским замыканием: всё, что клиент легитимно
       запросит (depModules своих модулей — доноры alias-слов, бакеты диалогов), входит
       в allowedMods. Расхождение немое: клиент глотает не-ok ответы, ученик просто
       теряет озвучку и правки преподавателя без единого симптома. */
    {
      const page = (await req("GET", "/", { auth: A2 })).text;
      const dmA2 = page.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
      const reuse = page.match(/\/\* ===REUSE=== \*\/([\s\S]*?)\/\* ===\/REUSE=== \*\//);
      const sbx = { console };
      vm.createContext(sbx);
      vm.runInContext(reuse[1] + dmA2[1] +
        ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;this.DIALOGS=typeof DIALOGS===\"undefined\"?{}:DIALOGS;" +
        "this.homeOf=homeOf;this.resolveVocab=resolveVocab;", sbx);
      const needs = new Set();
      for (const mid of sbx.CONTENT_READY) { // повторяем клиентский depModules для каждого модуля тропы
        for (const c of sbx.resolveVocab(sbx.CONTENT[mid].vocab, sbx.CONTENT)) needs.add(sbx.homeOf(c.id));
        const D = sbx.DIALOGS[mid];
        if (D) for (const part of D.parts) for (const ln of part.lines || []) needs.add(sbx.homeOf(ln.id));
      }
      for (const mid of needs)
        assert.strictEqual(await status("/api/review/" + mid, A2), 200,
          "клиент легитимно запросит " + mid + " — гейт обязан пропустить");
    }

    console.log("per-user-shell.test.js: OK (данные по курсам, API-гейт, кэш, результаты по отнятому курсу)");
  } catch (e) {
    console.error(e);
    if (srv && srv.logs.length) console.error("логи сервера:\n" + srv.logs.join("\n"));
    process.exitCode = 1;
  } finally {
    if (srv) srv.stop(); // гасит сервер и прибирает DATA
    else fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
