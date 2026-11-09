"use strict";
/* Продуктивные субтесты экзамена B1 (Жазуу, Сүйлөө): работа ученика уходит
   преподавателю, тот выставляет балл — решение владельца 22.08.2026.

   Проверяется живым сервером ПОЛНЫЙ ЦИКЛ, а не отдельные ручки: ученик с курсом
   B1 сдаёт письмо и запись → преподаватель видит их в списке → ставит балл
   с комментарием → ученик видит балл. Плюс границы доступа: без экзаменационной недели сдать нельзя,
   чужие работы и чужие записи не читаются, оценивает только преподаватель. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const B = (l, p) => "Basic " + Buffer.from(l + ":" + p).toString("base64");
const ILIM = B("ilim", "Tst-vKIxmveh-9"), ALT = B("altynai", "Tst-lwxo2c1U-9");
const DATA = "/tmp/kga1-examwork-" + process.pid;

(async () => {
  // у Илима курс B1 — m35 открыт; второй ученик без курсов не сдаёт вовсе
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify({ ilim: { courses: ["b1"] } }));
  const srv = await startServer({ port: 8218, dataDir: DATA });
  try {
    // ---- сдача письма: цикл до балла ----
    const text = Array.from({ length: 13 }, (_, i) => "Сүйлөм номер " + (i + 1) + ".").join(" ");
    const sub = await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "jazuu", topic: "Туулган жерим", text }) });
    assert.strictEqual(sub.status, 200, "письмо принято: " + sub.text);
    const workId = JSON.parse(sub.text).id;

    // короткий текст — не работа
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "jazuu", topic: "Туулган жерим", text: "Аз." }) })).status, 400,
      "двухсловное «письмо» отклонено");
    // выдуманный субтест — тоже
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "okuu", topic: "x", text }) })).status, 400, "чужой kind отклонён");

    // ---- запись говорения: байты возвращаются той же дорожкой ----
    const wav = Buffer.from("RIFFexam-voice-bytes" + "x".repeat(64));
    const up = await srv.req("POST", "/api/exam/voice", { auth: ILIM, ct: "audio/webm", body: wav, raw: true });
    assert.strictEqual(up.status, 200, "запись принята: " + up.text);
    const file = JSON.parse(up.text).file;
    // имя: <login>-<base36 ts>-<8 hex>.webm — случайный суффикс против затирания
    // файла и коллизии id при двух сдачах в одну миллисекунду (ревью 22.08)
    assert.ok(/^ilim-[0-9a-z]+-[0-9a-f]{8}\.webm$/.test(file), "имя файла несёт владельца и случайный суффикс: " + file);
    const spk = await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "suiloo", topic: "Менин балалыгым", audio: file, transcript: "менин балалыгым...", sec: 95 }) });
    assert.strictEqual(spk.status, 200, "говорение принято");
    // чужую запись в свою работу не подложить
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ALT, body: ({ kind: "suiloo", topic: "x", audio: file }) })).status, 403,
      "чужая запись в работе отклонена");

    // ---- преподаватель видит, ученик-чужак — нет ----
    const lst = await srv.req("GET", "/api/exam/work?login=ilim", { auth: ALT });
    assert.strictEqual(lst.status, 200, "преподаватель читает работы ученика");
    const works = JSON.parse(lst.text);
    assert.strictEqual(works.length, 2, "обе работы в списке");
    assert.strictEqual(works[0].sentences, 13, "число предложений посчитано сервером");
    assert.strictEqual(works[1].sec, 95, "длительность записи сохранена");
    assert.strictEqual((await srv.req("GET", "/api/exam/work?login=altynai", { auth: ILIM })).status, 403,
      "ученик чужие работы не читает");

    // аудио: владелец и преподаватель слышат, байты целы
    const a1 = await srv.req("GET", "/api/exam/voice/" + file, { auth: ALT });
    assert.strictEqual(a1.status, 200, "преподаватель слушает запись");
    assert.strictEqual(a1.text, wav.toString(), "байты записи не искажены (ASCII-надёжное тело)");

    // ---- оценка: только преподаватель, ученик видит балл ----
    assert.strictEqual((await srv.req("POST", "/api/exam/grade", { auth: ILIM, body: ({ login: "ilim", id: workId, score: 100 }) })).status, 403,
      "ученик сам себя не оценивает");
    const gr = await srv.req("POST", "/api/exam/grade", { auth: ALT, body: ({ login: "ilim", id: workId, score: 72, comment: "Жакшы, бирок макал жетишпейт" }) });
    assert.strictEqual(gr.status, 200, "балл выставлен");
    assert.strictEqual((await srv.req("POST", "/api/exam/grade", { auth: ALT, body: ({ login: "ilim", id: workId, score: 250 }) })).status, 400, "балл за пределами 0..100 отклонён");
    // пустое поле балла — не «0»: Number("") === 0 проходил проверку диапазона (ревью 25.09.2026)
    for (const score of ["", "  ", null, true, []])
      assert.strictEqual((await srv.req("POST", "/api/exam/grade", { auth: ALT, body: ({ login: "ilim", id: workId, score }) })).status, 400,
        "пустой/нечисловой балл отклонён: " + JSON.stringify(score));
    assert.strictEqual((await srv.req("POST", "/api/exam/grade", { auth: ALT,
      body: ({ login: "ilim", id: workId, score: "72", comment: "Жакшы, бирок макал жетишпейт" }) })).status, 200,
      "число строкой из поля ввода — законная оценка");

    const mine = JSON.parse((await srv.req("GET", "/api/exam/work", { auth: ILIM })).text);
    const graded = mine.find((x) => x.id === workId);
    assert.strictEqual(graded.score, 72, "ученик видит балл");
    assert.strictEqual(graded.comment, "Жакшы, бирок макал жетишпейт", "и комментарий преподавателя");
    assert.strictEqual(graded.gradedBy, "altynai", "видно, кто проверил");

    /* ---- находки ревью безопасности 22.08.2026: каждая закрыта проверкой ---- */
    // C1: тело null роняло ПРОЦЕСС (TypeError в колбэке без try/catch)
    for (const bad of ["null", '"str"', "[]", "42"]) {
      const r = await srv.req("POST", "/api/exam/work", { auth: ILIM, ct: "application/json", body: bad, raw: true });
      assert.strictEqual(r.status, 400, "тело " + bad + " → 400, а не падение процесса");
    }
    assert.strictEqual((await srv.req("GET", "/api/health")).status, 200, "сервер жив после мусорных тел");
    assert.strictEqual((await srv.req("POST", "/api/exam/grade", { auth: ALT, ct: "application/json", body: "null", raw: true })).status,
      400, "grade с телом null тоже 400");

    // W3+W5: имена файлов и id уникальны при залпе (Date.now() их коллизировал)
    const burst = await Promise.all(Array.from({ length: 6 }, () =>
      srv.req("POST", "/api/exam/voice", { auth: ILIM, ct: "audio/webm", body: Buffer.from("x".repeat(64)), raw: true })));
    const files = burst.map((r) => JSON.parse(r.text).file);
    assert.strictEqual(new Set(files).size, files.length, "имена записей уникальны в залпе: " + files.join(","));
    const ids = await Promise.all(files.map((f) =>
      srv.req("POST", "/api/exam/work", { auth: ILIM, body: { kind: "suiloo", topic: "T", audio: f } })
        .then((r) => JSON.parse(r.text).id)));
    assert.strictEqual(new Set(ids).size, ids.length, "id работ уникальны в залпе: " + ids.join(","));

    // W4: владение записью — по равенству, а не префиксу строки. Логин «a» не должен
    // присвоить запись логина «a-b» (дефис разрешён в логинах — набор перебирается).
    const own = files[0];
    const spoof = own.replace(/^ilim-/, "ilim-x-");   // имя, проходящее startsWith("ilim-")
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ILIM,
      body: { kind: "suiloo", topic: "spoof", audio: spoof } })).status, 403,
      "имя с чужим владельцем-префиксом отклонено как чужая запись");
    // и файл обязан существовать: выдуманное валидное имя не вписывается в работу
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ILIM,
      body: { kind: "suiloo", topic: "ghost", audio: "ilim-zzzzz-deadbeef.webm" } })).status, 400,
      "несуществующая запись в работу не вписывается");

    // C2: ротация файлов — старые записи не копятся вечно. Владелец при ротации
    // сравнивается РАВЕНСТВОМ разобранного имени: префикс startsWith у логина
    // «ilim» видел файлы логина «ilim-x» своими и сносил их (ревью 22.08)
    const AUD = path.join(DATA, "exam-work", "audio");
    fs.writeFileSync(path.join(AUD, "ilim-x-zzzzz-deadbeef.webm"), "чужая запись");
    for (let k = 0; k < 8; k++)
      await srv.req("POST", "/api/exam/voice", { auth: ILIM, ct: "audio/webm", body: Buffer.from("y".repeat(64)), raw: true });
    const onDisk = fs.readdirSync(AUD).filter((f) => f.replace(/-[0-9a-z]+-[0-9a-f]{8}\.webm$/i, "") === "ilim");
    assert.ok(onDisk.length <= 8, "записи ротируются, на диске " + onDisk.length + " (кап 8)");
    assert.ok(fs.existsSync(path.join(AUD, "ilim-x-zzzzz-deadbeef.webm")),
      "ротация ученика ilim не съела запись владельца ilim-x");

    // ---- формат A1: вопросы задания и курс едут в запись; ответы построчно без точек ----
    {
      const qs = ["Сиз кайда туулгансыз?", "Сиз саат канчада турасыз?", "Бүгүн кайсы күн?"];
      const r = await srv.req("POST", "/api/exam/work", { auth: ILIM,
        body: ({ kind: "jazuu", course: "a1", topic: "1-тапшырма", qs, text: "Бишкекте\nсаат жетиде\nбейшемби" }) });
      assert.strictEqual(r.status, 200, "ответы построчно без точек принимаются: " + r.text);
      const list = JSON.parse((await srv.req("GET", "/api/exam/work", { auth: ILIM })).text);
      const w = list[list.length - 1];
      assert.deepStrictEqual(w.qs, qs, "вопросы задания сохранены отдельным полем");
      assert.strictEqual(w.course, "a1", "работа помечена курсом");
      const bad = await srv.req("POST", "/api/exam/work", { auth: ILIM,
        body: ({ kind: "jazuu", course: "x!", topic: "т", qs: "не массив", text: "а\nб\nв" }) });
      assert.strictEqual(bad.status, 200, "мусорные course/qs не роняют сдачу");
      const w2 = JSON.parse((await srv.req("GET", "/api/exam/work", { auth: ILIM })).text).slice(-1)[0];
      assert.ok(!w2.course && !w2.qs, "но и не сохраняются");
    }
    // ---- гейт доступа: без экзаменационной недели экзамен закрыт ----
    // a2 — курс с exam:true (m23), но БЕЗ спеки экзамена: его недели нет в EXAM_MODS,
    // поэтому a2-only ученик сдавать не может (у a1 и b1 экзамены есть)
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify({ ilim: { courses: ["a2"] } }));
    // students.json перечитывается по запросу — даём файлу смениться
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual((await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "jazuu", topic: "x", text }) })).status, 403,
      "без экзаменационной недели сдать работу нельзя");
    assert.strictEqual((await srv.req("POST", "/api/exam/voice", { auth: ILIM, ct: "audio/webm", body: wav, raw: true })).status, 403,
      "и запись без неё не загрузить");
    // матрица доступа перебором: курс A1 (неделя m11) — сдаёт; истёкший триал A1 при a2 — нет;
    // одиночный триал-модуль m11 — сдаёт (доступ по любой открытой неделе реестра)
    const matrix = [
      [{ courses: ["a1"] }, 200, "ученик A1 сдаёт экзамен A1"],
      [{ courses: ["a2"], trials: { a1: "2020-01-01" } }, 403, "истёкший триал A1 экзамен не открывает"],
      [{ courses: ["a2"], trials: { m11: null } }, 200, "триал-модуль m11 экзамен открывает"],
      [{ courses: ["b1"] }, 200, "ученик B1 сдаёт по-прежнему"],
    ];
    for (const [rec, want, why] of matrix) {
      fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify({ ilim: rec }));   // readStudents читает файл на каждый запрос
      const st = (await srv.req("POST", "/api/exam/work", { auth: ILIM, body: ({ kind: "jazuu", topic: "x", text }) })).status;
      assert.strictEqual(st, want, why + " (" + JSON.stringify(rec) + " → " + st + ")");
    }

    console.log("exam-work.test.js: OK (полный цикл: сдача письма и записи → список у преподавателя → " +
      "балл с комментарием → виден ученику; чужие работы/записи закрыты, без экзаменационной недели — 403)");
  } finally {
    await srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
