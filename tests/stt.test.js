"use strict";
/* Аудирование (эксперимент): платная опция per-ученик с дневным лимитом и учётом
   затрат в единицах ElevenLabs. Гейты — перебором состояний (выключено / триал /
   включено / лимит), внешний STT замещается локальным мок-сервером через
   env ELEVEN_STT_URL (реальный ключ в тестах не нужен и не используется).
   Плюс vm-проверка клиентской сверки слов и очереди дня. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const vm = require("vm");
const { startServer } = require("./helpers/serve");
const { fakeMic } = require("./helpers/mic-mock");

const PORT = 8199, MOCK_PORT = 8198;
const DATA = "/tmp/kga1-stt-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9");
const STU = B("stt_stu", "stt-KgA1-26");
const TRIAL = B("stt_tr", "stt-KgA1-26");

(async () => {
  let srv, mock;
  let mockHits = 0;
  let mockHang = false; const hung = [];   // «ElevenLabs завис»: ответ не приходит вовсе
  try {
    // мок ElevenLabs STT: фиксированный ответ с таймингами слов (для учёта секунд)
    mock = http.createServer((req, res) => {
      mockHits++;
      let n = 0; req.on("data", (c) => { n += c.length; });
      req.on("end", () => {
        if (mockHang) { hung.push(res); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text: "Салам! Менин атым Айгүл.",
          words: [{ start: 0, end: 0.6 }, { start: 0.7, end: 1.1 }, { start: 1.2, end: 1.6 }, { start: 1.7, end: 2.3 }] }));
      });
    });
    await new Promise((r) => mock.listen(MOCK_PORT, r));

    srv = await startServer({ port: PORT, dataDir: DATA,
      env: { ELEVEN_STT_URL: "http://127.0.0.1:" + MOCK_PORT + "/stt", ELEVEN_STT_KEY: "test-key", ELEVEN_STT_TIMEOUT_MS: "1500" } });
    const req = srv.req;
    const postAudio = async (auth) => {
      const r = await fetch("http://127.0.0.1:" + PORT + "/api/stt/m0", {
        method: "POST", headers: { Authorization: auth, "Content-Type": "audio/webm" },
        body: Buffer.from("fake-webm-bytes"),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };

    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
      body: { login: "stt_stu", password: "stt-KgA1-26", create: true, role: "student", courses: ["a1"] } })).status, 200);
    // постоянный a2 + триал a1: раньше сервер отвечал ему «триал» и опция была
    // невключаемой (баг первой сборки B1) — теперь любой постоянный курс открывает путь
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
      body: { login: "stt_tr", password: "stt-KgA1-26", create: true, role: "student", courses: ["a2"], trials: { a1: null } } })).status, 200);

    /* 1. По умолчанию опция выключена у всех */
    {
      const st = JSON.parse((await req("GET", "/api/stt/state", { auth: STU })).text);
      assert.deepStrictEqual(st, { enabled: false, why: "off", used: 0, limit: 20 }, "дефолт — выключено");
      const p = await postAudio(STU);
      assert.strictEqual(p.status, 403, "распознавание закрыто");
      assert.strictEqual(p.body.code, "off", "и сервер называет причину");
      assert.strictEqual(mockHits, 0, "до внешнего STT запрос не дошёл");
    }

    /* 2. Постоянный ученик БЕЗ a1 (a2 + триал a1): опция включается — «триал» сервер
       отвечал бы лишь записи без единого постоянного курса, а таких данные не допускают
       (create с courses:[] — 400, дефолт ["a1"]); ветка why:"trial" — защита на будущее */
    {
      const st0 = JSON.parse((await req("GET", "/api/stt/state", { auth: TRIAL })).text);
      assert.deepStrictEqual({ enabled: st0.enabled, why: st0.why }, { enabled: false, why: "off" },
        "до включения — выключено с причиной off (не «триал»)");
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_tr", stt: true } })).status, 200);
      const st = JSON.parse((await req("GET", "/api/stt/state", { auth: TRIAL })).text);
      assert.deepStrictEqual({ enabled: st.enabled, why: st.why }, { enabled: true, why: null },
        "постоянному a2-ученику опция включается");
      assert.strictEqual((await postAudio(TRIAL)).status, 200, "и распознавание работает");
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_tr", stt: false } })).status, 200);
      mockHits = 0;
    }

    /* 2б. Постоянный ученик БЕЗ a1 (только b1) — опция включается: «триал» сервер
       отвечает лишь тому, у кого нет ни одного постоянного курса (промах первой
       сборки B1: b1-ученику показывали «недоступно на триале» без пути включения) */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
        body: { login: "stt_b1", password: "stt-KgA1-26", create: true, role: "student", courses: ["b1"], stt: true } })).status, 200);
      const st = JSON.parse((await req("GET", "/api/stt/state", { auth: B("stt_b1", "stt-KgA1-26") })).text);
      assert.deepStrictEqual({ enabled: st.enabled, why: st.why }, { enabled: true, why: null },
        "b1-ученику с включённой опцией аудирование доступно");
    }

    /* 2в. Внешний STT завис: ответ 502 за таймаут, а не висящий запрос (у TTS таймаут был,
       у STT — нет: ревью 25.09.2026). Попытка не засчитывается в дневной лимит. */
    {
      mockHang = true;
      const t0 = Date.now();
      const p = await postAudio(B("stt_b1", "stt-KgA1-26"));
      const ms = Date.now() - t0;
      mockHang = false;
      hung.splice(0).forEach((r) => { try { r.destroy(); } catch (e) {} });
      assert.strictEqual(p.status, 502, "зависший STT — 502");
      assert.ok(ms >= 1000 && ms < 6000, "ответ за таймаут (1,5 с), а не бесконечно: " + ms + " мс");
      const st = JSON.parse((await req("GET", "/api/stt/state", { auth: B("stt_b1", "stt-KgA1-26") })).text);
      assert.strictEqual(st.used, 0, "попытка без ответа не съела лимит");
      mockHits = 0;
    }

    /* 3. Включение преподавателем: распознавание работает, затраты пишутся */
    {
      const r = await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_stu", stt: true } });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(JSON.parse(r.text).student.sttOn, true, "ответ несёт состояние тумблера");
      const p = await postAudio(STU);
      assert.strictEqual(p.status, 200, "распознавание прошло");
      assert.strictEqual(p.body.text, "Салам! Менин атым Айгүл.", "текст от STT доехал");
      assert.strictEqual(p.body.used, 1, "попытка посчитана");
      assert.strictEqual(p.body.sec, 2.3, "секунды — из таймингов слов");
      const u = JSON.parse(fs.readFileSync(path.join(DATA, "stt-usage.json"), "utf8"));
      const day = Object.keys(u.users.stt_stu)[0];
      assert.deepStrictEqual(u.users.stt_stu[day], { n: 1, sec: 2.3, chars: 24 }, "затраты в файле: записи, секунды, символы");
      const me = JSON.parse((await req("GET", "/api/me", { auth: STU })).text);
      assert.deepStrictEqual(me.stt, { enabled: true, why: null, used: 1, limit: 20 }, "/api/me знает состояние и остаток");
    }

    /* 4. Лимит 20/день: 21-я попытка — 429, внешний STT не дёргается */
    {
      for (let i = 2; i <= 20; i++) assert.strictEqual((await postAudio(STU)).status, 200, "попытка " + i);
      const hitsAt20 = mockHits;
      const p = await postAudio(STU);
      assert.strictEqual(p.status, 429, "21-я попытка отклонена");
      assert.strictEqual(p.body.used, 20, "и называет расход");
      assert.strictEqual(mockHits, hitsAt20, "внешний STT после лимита не дёргается");
      // расход виден преподавателю в списке учеников
      const list = JSON.parse((await req("GET", "/api/students", { auth: ALT })).text);
      const row = list.find((x) => x.login === "stt_stu");
      assert.strictEqual(row.sttOn, true);
      assert.strictEqual(row.sttUse.today, 20, "сегодняшний расход в карточке");
      assert.strictEqual(row.sttUse.total.n, 20, "и суммарный");
      assert.strictEqual(row.sttUse.total.sec, 46, "секунды суммируются");
    }

    /* 5. Выключение: поле уходит из файла, доступ закрывается */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_stu", stt: false } })).status, 200);
      const students = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      assert.ok(!("stt" in students.stt_stu), "false убирает поле — в файле не мусорим");
      assert.strictEqual((await postAudio(STU)).status, 403, "доступ закрыт");
      // а препод/админ пользуются без тумблера (и их расход тоже пишется)
      assert.strictEqual((await postAudio(ALT)).status, 200, "преподавателю доступно всегда");
    }

    /* 6. stt — только ученикам */
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "altynai", stt: true } })).status, 400);

    /* 6б. Пер-ученик лимит (дефолт 20) и безлимит преподавателя */
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_stu", stt: true, sttLimit: 3 } })).status, 200);
      // вчерашний расход уже 20 — лимит дневной, поэтому заведём нового ученика на чистый день
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
        body: { login: "stt_lim", password: "stt-KgA1-26", create: true, role: "student", courses: ["a1"], stt: true, sttLimit: 3 } })).status, 200);
      const LIM = B("stt_lim", "stt-KgA1-26");
      const st = JSON.parse((await req("GET", "/api/stt/state", { auth: LIM })).text);
      assert.strictEqual(st.limit, 3, "личный лимит отдан клиенту");
      for (let i = 1; i <= 3; i++) assert.strictEqual((await postAudio(LIM)).status, 200, "личная попытка " + i);
      assert.strictEqual((await postAudio(LIM)).status, 429, "4-я — за личным лимитом");
      // сброс на дефолт: null убирает поле из файла
      assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_lim", sttLimit: null } })).status, 200);
      const students = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      assert.ok(!("sttLimit" in students.stt_lim), "дефолтный лимит в файле не хранится");
      assert.strictEqual(JSON.parse((await req("GET", "/api/stt/state", { auth: LIM })).text).limit, 20, "лимит вернулся к 20");
      for (const bad of [0, -1, 501, 2.5, "10"])
        assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "stt_lim", sttLimit: bad } })).status, 400,
          "невалидный лимит отвергнут: " + JSON.stringify(bad));
      // преподавателю — безлимит: 25 подряд без 429, state отдаёт limit null
      const stT = JSON.parse((await req("GET", "/api/stt/state", { auth: ALT })).text);
      assert.strictEqual(stT.limit, null, "у преподавателя лимита нет");
      for (let i = 1; i <= 25; i++) assert.strictEqual((await postAudio(ALT)).status, 200, "преподаватель, попытка " + i);
    }

    /* 7. Вкладка видна ВСЕМ, включая демо, — запертым рендерится тизер-магнит
       (карточка под блюром + «Запросить у Алтынай» с WhatsApp), решение владельца.
       Проверка — исполнением renderListen со всеми тремя запертыми состояниями. */
    {
      const demo = (await req("GET", "/demo/ru", {})).text;
      const page = (await req("GET", "/", { auth: STU })).text;
      assert.ok(page.includes("function renderListen"), "рендер аудирования в странице ученика");
      assert.ok(demo.includes("function renderListen"), "и в демо-странице");
      // реестр модулей раздела едет в страницу вместе с блоками — вкладка выводится
      // из него, поэтому и тест берёт список оттуда, а не повторяет его литералом
      const modsOf = (html) => {
        const bm = html.match(/===STT-BLOCKS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT-BLOCKS=== \*\//);
        assert.ok(bm, "реестр блоков в странице");
        const c = { console }; vm.createContext(c);
        vm.runInContext(bm[1] + "; this.MODS=STT_MODS;", c);
        return JSON.parse(JSON.stringify(c.MODS));
      };
      const tabsOf = (html, isDemo, id) => {
        const fn = html.match(/function studyTabsFor\(id\)\{[\s\S]*?\n(?=const TEACHER_TABS_DEF)/);
        assert.ok(fn, "studyTabsFor найдена");
        // меню спрашивает тропу (isExamWeek у экзаменационной недели) — берём её код,
        // а не заглушку: иначе тест проверял бы не то меню, что видит ученик
        const trail = html.match(/\/\* ===TRAIL=== \*\/([\s\S]*?)\/\* ===\/TRAIL=== \*\//)[1];
        const sb = { console, t: (k) => k, bi: () => "x", CONTENT: { m0: {} }, DIALOGS: {}, LESSONS: {},
          STT_MODS: modsOf(html) };
        if (isDemo) sb.IS_DEMO = true;
        vm.createContext(sb);
        vm.runInContext(trail + fn[0] + "; this.OUT = studyTabsFor(" + JSON.stringify(id || "m0") + ").map(x=>x[0]);", sb);
        return sb.OUT;
      };
      assert.ok(tabsOf(page, false).includes("listen"), "у ученика вкладка аудирования есть");
      assert.ok(tabsOf(demo, true).includes("listen"), "в демо вкладка есть (тизер-магнит)");
      // перебор реестра: вкладка ровно у своих модулей — ни одного пропущенного и
      // ни одного лишнего (мёртвая вкладка в модуле без материала — тизер в никуда)
      const MODS = modsOf(page);
      assert.ok(MODS.includes("m0") && MODS.includes("m1"), "в реестре модулей раздела — m0 и m1");
      for (const id of MODS)
        assert.ok(tabsOf(page, false, id).includes("listen"), "вкладка есть у модуля «" + id + "» из реестра");
      for (const id of ["m2", "m5", "m24"].filter((x) => !MODS.includes(x)))
        assert.ok(!tabsOf(page, false, id).includes("listen"), "у модуля «" + id + "» вне реестра вкладки нет");
      // тизер исполняется: demo / off / trial → WhatsApp-кнопка есть, живой записи нет
      const mkNode = (tag, attrs) => { const n = { tag, attrs: attrs || {}, kids: [],
        append(...k){ this.kids.push(...k); }, addEventListener() {} }; return n; };
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const fn = page.match(/function renderListen\(m\)\{[\s\S]*$/);
      assert.ok(fn, "renderListen извлечён");
      const src = fn[0].slice(0, fn[0].indexOf("\n}\n") + 2);
      const runLocked = (opts) => {
        const root = mkNode("main");
        const sb = { console, t: (k) => k, tf: (k) => k, icon: () => ({ tag: "svg", kids: [], append() {} }),
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x && x.tag)); return n; },
          clear: (n) => { n.kids = []; return n; }, isTeacher: () => false,
          // sttMic — реальная глобаль блока ===STT=== (общий выбор микрофона);
          // здесь исполняется голый renderListen, поэтому стаб обязателен
          ME: opts.me, encodeURIComponent, sttMic: null };
        if (opts.demo) sb.IS_DEMO = true;
        vm.createContext(sb);
        vm.runInContext(src + "; renderListen(this.ROOT);", Object.assign(sb, { ROOT: root }));
        return flat(root, [root]);
      };
      for (const [name, opts] of [
        ["демо", { demo: true, me: null }],
        ["опция выключена", { me: { stt: { enabled: false, why: "off" } } }],
        ["триал", { me: { stt: { enabled: false, why: "trial" } } }],
      ]) {
        const nodes = runLocked(opts);
        const wa = nodes.find((n) => n.tag === "a" && String(n.attrs.href || "").includes("wa.me/996505854856"));
        assert.ok(wa, name + ": в тизере есть кнопка WhatsApp «Запросить у Алтынай»");
        assert.ok(nodes.some((n) => n.attrs && String(n.attrs.class || "").includes("stt-fake")), name + ": фоновая карточка-приманка отрисована");
        assert.ok(nodes.some((n) => n.attrs && String(n.attrs.class || "").includes("stt-over")), name + ": оверлей поверх неё");
      }
    }

    /* 7б. Разблокированный рендер: до прослушивания «Говорить» заперта с внятной
       подсказкой, после «Слушать» — активна. Реальный промах: у активной кнопки
       атрибуты писались строкой "undefined" (disabled="undefined" запирал её навсегда,
       тултип показывал undefined) — гейт эмулирует клик и проверяет оба состояния. */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const fn = page.match(/function renderListen\(m\)\{[\s\S]*$/);
      const src = fn[0].slice(0, fn[0].indexOf("\n}\n") + 2);
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [],
        append(...k){ this.kids.push(...k); },
        addEventListener(type, fnc){ (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const root = mkNode("main");
      const sb = { console, t: (k) => k, tf: (k) => k, icon: () => null,
        h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
        clear: (n) => { n.kids = []; return n; }, isTeacher: () => false,
        ME: { stt: { enabled: true, why: null, used: 0, limit: 20 } },
        VOCAB: [{ id: "x1", ky: "салам" }], AUDIO: new Set(["x1"]),
        dayKeyOf: () => "2026-08-18", recOf: () => null, playAudio: () => null,
        ST: {}, save() {}, evPush() {}, EV: {},
        Date, encodeURIComponent, ROOT: root };
      vm.createContext(sb);
      vm.runInContext(sttSrc + src + "; renderListen(this.ROOT);", sb);
      const findRec = () => flat(root, [root]).find((n) => n.tag === "button" && n.kids.includes(" stt_rec"));
      const before = findRec();
      assert.strictEqual(before.attrs.disabled, "disabled", "до прослушивания запись заперта");
      assert.strictEqual(before.attrs.title, "stt_listen_first", "и подсказка внятная, не «undefined»");
      const listenBtn = flat(root, [root]).find((n) => n.tag === "button" && n.kids.includes(" stt_listen"));
      listenBtn.attrs.onclick(); // прослушал — рендер перерисовался (обработчик — атрибутом)
      const after = findRec();
      assert.ok(!("disabled" in after.attrs), "после прослушивания запись активна");
      assert.ok(!("title" in after.attrs), "и лишнего тултипа нет");
      assert.ok(String(after.attrs.class).includes("primary"), "кнопка визуально главная");
      for (const n of flat(root, [root]))
        for (const [k2, v2] of Object.entries(n.attrs))
          assert.notStrictEqual(v2, undefined, "атрибут-" + k2 + " не undefined ни у одного узла");
    }

    /* 8. Клиентская сверка и очередь дня — vm, без DOM */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const m = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//);
      assert.ok(m, "маркеры ===STT=== в сборке");
      const sb = { console };
      vm.createContext(sb);
      vm.runInContext(m[1] + "; this.cmp=sttCompare; this.q=sttQueue; this.adv=sttAdvice;", sb);
      const full = sb.cmp("Салам! Менин атым Айгүл.", "салам менин атым айгүл");
      assert.strictEqual(full.score, 1, "полное совпадение без регистра и пунктуации");
      const part = sb.cmp("Менин атым Айгүл", "менин аты айгүл");
      assert.ok(part.score > 0.5 && part.score < 1, "частичное совпадение — между 0 и 1");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(part.words.map((w) => w.ok))), [true, false, true], "несовпавшее слово помечено");
      const advice = JSON.parse(JSON.stringify(sb.adv(part)));
      assert.deepStrictEqual(advice.missed, ["атым"], "подсказка называет несовпавшие слова");
      const zero = sb.cmp("Жол", "");
      assert.strictEqual(zero.score, 0, "пустая гипотеза — ноль");
      // выбор микрофона и тексты о разрешении — тоже исполняются
      vm.runInContext("this.cons=sttConstraints; this.perm=sttPermKey;", sb);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.cons(null))), { audio: true }, "без выбора — системный микрофон");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.cons("mic-1"))), { audio: { deviceId: { ideal: "mic-1" } } },
        "выбранный микрофон — ideal, не exact (выдернутый USB не валит запись)");
      assert.strictEqual(sb.perm({ name: "NotAllowedError" }, false), "stt_mic_denied", "запрет в браузере — совет про замок");
      assert.strictEqual(sb.perm({ name: "NotAllowedError" }, true), "stt_mic_denied_pwa", "запрет в PWA — свой совет (замка нет)");
      assert.strictEqual(sb.perm({ name: "NotFoundError" }, false), "stt_mic_none", "нет устройства — свой текст");
      assert.strictEqual(sb.perm({ name: "Whatever" }, false), "stt_mic_err", "прочее — общий текст");
      // очередь дня: детерминирована ключом дня и не содержит фраз без озвучки
      const vocab = [{ id: "a", ky: "бир" }, { id: "b", ky: "эки" }, { id: "c", ky: "үч" }, { id: "d", ref: "x" }];
      const has = (id) => id !== "b";
      const q1 = JSON.parse(JSON.stringify(sb.q(vocab, has, "2026-08-18")));
      const q2 = JSON.parse(JSON.stringify(sb.q(vocab, has, "2026-08-18")));
      assert.deepStrictEqual(q1, q2, "один день — одна очередь");
      assert.ok(!q1.some((c) => c.id === "b" || c.ref), "без озвучки и alias в очередь не попадают");
    }

    /* 9. Блоки аудирования: реестр — данные, дрилл гласных — vm-перебором */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const bm = page.match(/===STT-BLOCKS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT-BLOCKS=== \*\//);
      assert.ok(bm, "реестр блоков приехал в сборку (маркеры ===STT-BLOCKS===)");
      const reg = { console };
      vm.createContext(reg);
      vm.runInContext(bm[1] + "; this.BLOCKS=STT_BLOCKS; this.VOW=STT_VOWELS; this.END=STT_ENDINGS; this.MODS=STT_MODS;", reg);
      const BLOCKS = reg.BLOCKS, VOW = reg.VOW;
      assert.strictEqual(BLOCKS[0].id, "phrases", "первый блок — фразы дня (дефолт)");
      const vb = BLOCKS.find((b) => b.id === "vowels");
      assert.ok(vb && vb.kind === "sounds" && vb.items === VOW, "блок гласных — kind sounds со своим списком");
      // блок окончаний — грамматика M1: скоуплен на свой модуль, у него свои подписи
      const eb = BLOCKS.find((b) => b.id === "endings");
      assert.ok(eb && eb.kind === "sounds" && eb.items === reg.END, "блок окончаний — kind sounds со своим списком");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(eb.mods)), ["m1"], "окончания показаны только в своём модуле");
      assert.ok(!vb.mods, "гласные — без скоупа: звуки нужны в любом модуле");
      // скоуп не может указывать на модуль без вкладки — блок был бы недостижим
      const MODS = JSON.parse(JSON.stringify(reg.MODS));
      for (const b of BLOCKS) for (const id of b.mods || [])
        assert.ok(MODS.includes(id), "модуль «" + id + "» блока «" + b.id + "» есть в реестре модулей раздела");
      // свои подписи блока (интро и заголовок списка фраз) — ключи всех трёх словарей
      for (const b of BLOCKS) for (const k of [b.intro, b.words].filter(Boolean))
        assert.strictEqual((page.match(new RegExp(k + ':"', "g")) || []).length, 3,
          "подпись «" + k + "» блока «" + b.id + "» есть в ru/en/tr словарях");
      // у каждого блока — титул stt_b_<id> во всех трёх словарях (новый блок без
      // перевода дал бы сырой ключ на кнопке при зелёном прогоне)
      for (const b of BLOCKS)
        assert.strictEqual((page.match(new RegExp("stt_b_" + b.id + ':"', "g")) || []).length, 3,
          "титул блока «" + b.id + "» есть в ru/en/tr словарях");
      // демо-артефакт обязан объявлять реестр: renderListen ссылается на него вне DATA
      assert.ok((await req("GET", "/demo/ru", {})).text.includes("const STT_BLOCKS"), "реестр блоков объявлен и в демо");
      // 8 кратких гласных обоих рядов, у каждой — описание на трёх языках
      assert.deepStrictEqual(JSON.parse(JSON.stringify(VOW.map((v) => v.ch))), ["а", "о", "у", "ы", "э", "ө", "ү", "и"], "все восемь гласных, рядами");
      // темы уроков модулей — из тех же байтов страницы: поле track записи обязано
      // указывать на существующую тему, иначе ссылка «подробно в уроке» ведёт в никуда
      // урок m0 живёт в общей части (маркер ===LESSONS===), уроки M1+ — в своих
      // (===LESSON-DATA:m<n>===); гейт обязан находить тему в обоих случаях
      const themesOf = (mid) => {
        const lm = page.match(new RegExp("===LESSON-DATA:" + mid + "===[\\s\\S]*?\\*/([\\s\\S]*?)/\\* ===/LESSON-DATA:" + mid + "===")) ||
          page.match(/===LESSONS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/LESSONS=== \*\//);
        if (!lm) return null;
        const c = { console, LESSONS: {} }; vm.createContext(c);
        vm.runInContext(lm[1] + "; this.T=((LESSONS." + mid + "||{}).themes||[]).map(x=>x.id);", c);
        return JSON.parse(JSON.stringify(c.T));
      };
      // паритет описаний — у ВСЕХ items любых sounds-блоков, не только поимённых гласных
      for (const b of BLOCKS.filter((x) => x.kind === "sounds")) for (const v of b.items) {
        for (const f of ["d", "dEn", "dTr"])
          assert.ok(typeof v[f] === "string" && v[f].length > 20, "описание «" + v.ch + "»." + f + " есть и не заглушка");
        // канон «локализация, а не калька»: en/tr объясняют своими ориентирами
        assert.ok(!/russian/i.test(v.dEn), "en-описание «" + v.ch + "» без отсылки к русскому");
        assert.ok(!/rus[çc]a|rus dili/i.test(v.dTr), "tr-описание «" + v.ch + "» без отсылки к русскому");
        assert.ok(!/английск|немецк|французск|турецк/i.test(v.d), "ru-описание «" + v.ch + "» без чужих языков");
        if (v.m2) assert.ok(typeof v.hint === "string" && v.hint, "у второго набора «" + v.ch + "» есть подсказка hint");
        // подсказка — ключ словаря: без перевода на кнопке висел бы сырой stt_*
        if (v.hint) assert.strictEqual((page.match(new RegExp(v.hint + ':"', "g")) || []).length, 3,
          "подсказка «" + v.hint + "» есть в ru/en/tr словарях");
        if (v.track) {
          const mid = (b.mods || ["m0"])[0];
          const themes = themesOf(mid);
          assert.ok(themes && themes.includes(v.track),
            "тема «" + v.track + "» записи «" + v.ch + "» есть в уроке модуля " + mid + " (там же её источники)");
        }
      }
      assert.deepStrictEqual(JSON.parse(JSON.stringify(VOW.filter((v) => v.m2).map((v) => v.m2[0]))),
        ["аа", "оо", "уу", "ээ", "өө", "үү"], "шесть долгих пар — как в уроке произношения");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(VOW.find((v) => v.ch === "э").m)), ["э", "е"], "э и е — один звук, ищутся оба написания");

      // vm: подбор слов, подсветка, хоткеи — перебором наборов
      const m = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//);
      const sb = { console };
      vm.createContext(sb);
      vm.runInContext(m[1] + "; this.words=sttDrillWords; this.hl=sttHl; this.key=sttHotkey;", sb);
      const vocab = [
        { id: "w1", ky: "салам" }, { id: "w2", ky: "саат" }, { id: "w3", ky: "бала" },
        { id: "w4", ky: "мен" }, { id: "w5", ref: "w1", ky: "салам" }, { id: "w6", ky: "адам" },
      ];
      const has = (id) => id !== "w6";
      const short = JSON.parse(JSON.stringify(sb.words(vocab, has, ["а"], 4))).map((c) => c.id);
      assert.deepStrictEqual(short, ["w3", "w2", "w1"], "слова со звуком, короткие первыми; alias и без озвучки — вне");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(vocab, has, ["аа"], 4))).map((c) => c.id),
        ["w2"], "долгий гласный ищется сдвоенной буквой");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(vocab, has, ["э", "е"], 4))).map((c) => c.id),
        ["w4"], "э находит и написание через е");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(vocab, has, ["ң"], 4))), [], "звука нет в пуле — пусто, не падение");
      // исключения: подстрока окончания живёт и в коротком местоимении, которое иначе
      // вытеснило бы примеры (сортировка — короткие первыми)
      const endVocab = [{ id: "e1", ky: "сиз" }, { id: "e2", ky: "Кайдансыз?" }, { id: "e3", ky: "Канча жаштасыз?" }];
      const hasAll = () => true;
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(endVocab, hasAll, ["сыз", "сиз"], 4))).map((c) => c.id),
        ["e1", "e2", "e3"], "без исключений местоимение идёт первым");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(endVocab, hasAll, ["сыз", "сиз"], 4, ["сиз"]))).map((c) => c.id),
        ["e2", "e3"], "точная фраза из not в примеры не попадает");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.words(endVocab, hasAll, ["сыз"], 4, ["Кайдансыз?"]))).map((c) => c.id),
        ["e3"], "исключение сверяется без учёта регистра");
      // подстрока со спецсимволом регулярки: «би?» — это буквы и знак вопроса, а не
      // «б» с необязательной «и» (иначе подсветилась бы одна буква в середине слова)
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.hl("Ал мугалимби?", ["би?"]))),
        [{ s: "Ал мугалим", hit: false }, { s: "би?", hit: true }], "вопросительная частица подсвечена целиком");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.hl("бирок", ["би?"]))), [{ s: "бирок", hit: false }],
        "без знака вопроса совпадения нет — «б» отдельно не подсвечивается");
      const segs = JSON.parse(JSON.stringify(sb.hl("саат", ["а", "аа"])));
      assert.deepStrictEqual(segs, [{ s: "с", hit: false }, { s: "аа", hit: true }, { s: "т", hit: false }],
        "долгая пара подсвечена целиком, а не двумя «а»");
      assert.ok(JSON.parse(JSON.stringify(sb.hl("Адам", ["а"]))).some((x) => x.hit && x.s === "А"),
        "подсветка не зависит от регистра");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.hl("үй", ["ө"]))), [{ s: "үй", hit: false }], "нет вхождений — один сегмент");
      // хоткеи: Пробел — говорить, модификатор+Пробел — слушать, → — дальше, поля ввода не трогаем
      assert.strictEqual(sb.key({ code: "Space" }), "rec");
      for (const mod of ["ctrlKey", "metaKey", "shiftKey", "altKey"])
        assert.strictEqual(sb.key({ code: "Space", [mod]: true }), "listen", mod + "+Space — слушать");
      assert.strictEqual(sb.key({ code: "ArrowRight" }), "next");
      assert.strictEqual(sb.key({ code: "Space", target: { tagName: "INPUT" } }), null, "в поле ввода пробел — это пробел");
      assert.strictEqual(sb.key({ code: "KeyA" }), null);
    }

    /* 10. Дрилл гласных исполнением: переключение блока, чипы звуков, описание,
       слова с подсветкой, пустой звук — без падения; кнопки в трёх слотах */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const bm = page.match(/===STT-BLOCKS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT-BLOCKS=== \*\//);
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const fn = page.match(/function renderListen\(m\)\{[\s\S]*$/);
      const src = fn[0].slice(0, fn[0].indexOf("\n}\n") + 2);
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [],
        append(...k){ this.kids.push(...k); },
        addEventListener(type, fnc){ (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const root = mkNode("main");
      const sb = { console, t: (k) => k, tf: (k) => k, icon: () => null,
        h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
        clear: (n) => { n.kids = []; return n; }, isTeacher: () => false,
        bi: (o, f) => o[f],
        ME: { stt: { enabled: true, why: null, used: 0, limit: 20 } },
        VOCAB: [{ id: "w1", ky: "салам" }, { id: "w2", ky: "саат" }, { id: "w3", ky: "көл" }],
        AUDIO: new Set(["w1", "w2", "w3"]),
        dayKeyOf: () => "2026-08-18", recOf: () => null, playAudio: () => null,
        ST: {}, save() {}, evPush() {}, EV: {},
        Date, encodeURIComponent, ROOT: root };
      vm.createContext(sb);
      vm.runInContext(bm[1] + sttSrc + src + "; renderListen(this.ROOT);", sb);
      const btn = (label) => flat(root, [root]).find((n) => n.tag === "button" &&
        n.kids.some((k) => typeof k === "string" && k.includes(label)));
      assert.ok(btn("stt_b_phrases") && btn("stt_b_vowels"), "переключатель блоков отрисован");
      btn("stt_b_vowels").attrs.onclick(); // переключились на гласные
      for (const ch of ["а", "о", "у", "ы", "э", "ө", "ү", "и"])
        assert.ok(btn(ch), "чип звука «" + ch + "»");
      const texts = (ns) => ns.flatMap((n) => n.kids.filter((k) => typeof k === "string"));
      assert.ok(texts(flat(root, [root])).some((s) => /[Нн]икогда не глотается/.test(s)),
        "описание выбранного звука («а») показано");
      assert.ok(btn("саат") && btn("салам"), "слова-примеры со звуком «а» — чипами");
      assert.ok(!btn("көл"), "чужое слово (без «а») в список не попало");
      // упражнение: до прослушивания говорить заперто, слово показано с подсветкой
      const rec = flat(root, [root]).find((n) => n.tag === "button" && n.kids.includes(" stt_rec"));
      assert.strictEqual(rec.attrs.disabled, "disabled", "в дрилле тот же протокол: сперва слушать");
      assert.ok(flat(root, [root]).some((n) => n.tag === "b" && (n.kids.includes("а") || n.kids.includes("аа"))),
        "тренируемый звук подсвечен в слове (долгий — целиком)");
      // пустой звук: у «ө» одно слово, у отсутствующего в пуле — карточка-прочерк, не падение
      btn("ө").attrs.onclick();
      assert.ok(btn("көл"), "для «ө» нашлось своё слово");
      btn("и").attrs.onclick();
      assert.ok(flat(root, [root]).length > 0, "звук без слов в пуле не роняет рендер");
      for (const n of flat(root, [root]))
        for (const [k2, v2] of Object.entries(n.attrs))
          assert.notStrictEqual(v2, undefined, "атрибут-" + k2 + " не undefined ни у одного узла");
    }

    /* 10б. Дрилл окончаний M1 исполнением: блок виден в своём модуле и не виден в
       чужом, заголовок берётся из label, местоимение-исключение в примеры не идёт,
       частица подсвечена со знаком вопроса, ссылка ведёт на тему урока. */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const bm = page.match(/===STT-BLOCKS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT-BLOCKS=== \*\//);
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const fn = page.match(/function renderListen\(m\)\{[\s\S]*$/);
      const src = fn[0].slice(0, fn[0].indexOf("\n}\n") + 2);
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [],
        append(...k){ this.kids.push(...k); },
        addEventListener(type, fnc){ (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      // словарь модуля M1: фразы с личным окончанием, вопросом и местоимением-омонимом
      const VOCAB = [{ id: "v1", ky: "Мен мугалиммин." }, { id: "v2", ky: "Мен кыргызмын." },
        { id: "v3", ky: "сиз" }, { id: "v4", ky: "Кайдансыз?" }, { id: "v5", ky: "Ал мугалимби?" },
        { id: "v6", ky: "салам" },
        // слова под дрилл согласных: аффриката, носовой, твёрдое и мягкое «к», дрожащая
        { id: "c1", ky: "Жакшы!" }, { id: "c2", ky: "Кириңиз!" }, { id: "c3", ky: "кыз" },
        { id: "c4", ky: "китеп" }, { id: "c5", ky: "Рахмат!" }];
      const played = [];
      const run = (mid, noSnd) => {
        const root = mkNode("main");
        // дорожки звуков букв лежат рядом с фразами: без них кнопки «сам звук» нет
        const audio = new Set(VOCAB.map((c) => c.id));
        if (!noSnd) for (const id of ["ph_snd_a", "ph_snd_aa", "ph_snd_zh", "ph_snd_k"]) audio.add(id);
        const sb = { console, t: (k) => k, tf: (k) => k, icon: () => null,
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          clear: (n) => { n.kids = []; return n; }, isTeacher: () => false, bi: (o, f) => o[f],
          ME: { stt: { enabled: true, why: null, used: 0, limit: 20 } },
          VOCAB, AUDIO: audio, activeModule: mid,
          LESSONS: { m1: { themes: [{ id: "m1t2", title: { ru: "Аффиксы сказуемости" } }] } },
          dayKeyOf: () => "2026-08-21", recOf: () => null, playAudio: (id) => played.push(id), go: () => null, currentLang: () => "ru",
          ST: {}, save() {}, evPush() {}, EV: {}, Date, encodeURIComponent, ROOT: root };
        vm.createContext(sb);
        vm.runInContext(bm[1] + sttSrc + src + "; renderListen(this.ROOT);", sb);
        return root;
      };
      const btnIn = (root, label) => flat(root, [root]).find((n) => n.tag === "button" &&
        n.kids.some((k) => typeof k === "string" && k.includes(label)));
      const m0root = run("m0");
      assert.ok(btnIn(m0root, "stt_b_vowels"), "в m0 блок гласных на месте");
      assert.ok(!btnIn(m0root, "stt_b_endings"), "в m0 чипа окончаний нет — это грамматика другого модуля");
      // согласные — сразу за гласными, разбор пары «твёрдое/мягкое» у к и г
      assert.ok(btnIn(m0root, "stt_b_consonants"), "в m0 есть блок согласных");
      btnIn(m0root, "stt_b_consonants").attrs.onclick();
      for (const ch of ["ж", "ң", "к", "г", "р"])
        assert.ok(btnIn(m0root, ch), "чип согласного «" + ch + "»");
      const m0strs = () => flat(m0root, [m0root]).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
      assert.ok(m0strs().some((s) => /Слитное «дж»/.test(s)), "описание «ж» показано первым");
      assert.ok(btnIn(m0root, "Жакшы!"), "слово с «ж» в примерах");
      assert.ok(!btnIn(m0root, "китеп"), "слово без «ж» в примеры не попало");
      btnIn(m0root, "ң").attrs.onclick();
      assert.ok(btnIn(m0root, "Кириңиз!"), "слово с носовым «ң» в примерах");
      btnIn(m0root, "к").attrs.onclick();
      assert.ok(btnIn(m0root, "кыз") && btnIn(m0root, "китеп"),
        "у «к» рядом стоят твёрдое и мягкое слово — пару и надо слышать");
      assert.ok(m0strs().some((s) => s === "stt_c_soft"), "подсказка про второй ряд слов показана");
      // сам звук буквы: кнопка есть и играет свою дорожку, а не слово
      played.length = 0;
      btnIn(m0root, "▶ к").attrs.onclick();
      assert.deepStrictEqual(played, ["ph_snd_k"], "кнопка звука «к» играет дорожку звука");
      btnIn(m0root, "ж").attrs.onclick();
      btnIn(m0root, "▶ ж").attrs.onclick();
      assert.deepStrictEqual(played, ["ph_snd_k", "ph_snd_zh"], "у каждой буквы своя дорожка");
      // у гласной с долгой парой — две кнопки: долготу слышно только в сравнении
      btnIn(m0root, "stt_b_vowels").attrs.onclick();
      played.length = 0;
      btnIn(m0root, "▶ а").attrs.onclick();
      btnIn(m0root, "▶ аа").attrs.onclick();
      assert.deepStrictEqual(played, ["ph_snd_a", "ph_snd_aa"], "краткий и долгий — разные дорожки");
      // дорожки нет (озвучка ещё не сгенерирована) — кнопки нет, а не молчащая кнопка
      const bare = run("m0", true);
      btnIn(bare, "stt_b_consonants").attrs.onclick();
      assert.ok(!btnIn(bare, "▶ ж"), "без дорожки кнопка звука не рисуется");
      assert.ok(btnIn(bare, "Жакшы!"), "а слова-примеры на месте — дрилл живёт и без дорожек");
      const root = run("m1");
      assert.ok(btnIn(root, "stt_b_endings"), "в m1 блок окончаний в переключателе");
      btnIn(root, "stt_b_endings").attrs.onclick();
      for (const ch of ["-мын", "-сың", "-быз", "-бы?", "эмес"])
        assert.ok(btnIn(root, ch), "чип окончания «" + ch + "»");
      const strs = () => flat(root, [root]).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
      assert.ok(strs().some((s) => s === "-мын · -мин · -мун · -мүн"), "заголовок карточки — из label, а не из ch");
      assert.ok(strs().some((s) => /связки «есть»/i.test(s)), "описание окончания показано");
      assert.ok(btnIn(root, "Мен мугалиммин.") && btnIn(root, "Мен кыргызмын."), "фразы с личным окончанием — чипами");
      assert.ok(!btnIn(root, "салам"), "фраза без окончания в примеры не попала");
      // вежливое «Вы»: местоимение «сиз» исключено, но фраза с окончанием осталась
      btnIn(root, "-сың").attrs.onclick();
      assert.ok(btnIn(root, "Кайдансыз?"), "фраза с вежливым окончанием во втором наборе");
      assert.ok(!btnIn(root, "сиз"), "само местоимение «сиз» в дрилл окончания не идёт");
      // вопросительная частица: подсветка ловит «би?» целиком, а не одну «б»
      btnIn(root, "-бы?").attrs.onclick();
      const bold = flat(root, [root]).filter((n) => n.tag === "b").flatMap((n) => n.kids);
      assert.ok(bold.includes("би?"), "частица подсвечена вместе со знаком вопроса");
      // связь с уроком: ссылка на тему, где утверждение подтверждено источниками
      btnIn(root, "-мын").attrs.onclick();
      const link = flat(root, [root]).find((n) => n.tag === "a" && n.kids.includes("Аффиксы сказуемости"));
      assert.ok(link && typeof link.attrs.onclick === "function", "ссылка на тему урока с источниками");
      for (const n of flat(root, [root]))
        for (const [k2, v2] of Object.entries(n.attrs))
          assert.notStrictEqual(v2, undefined, "атрибут-" + k2 + " не undefined ни у одного узла");
    }

    /* 11. Общее ядро sttSend (вкладка + карточки): vm с подменой fetch — сверка,
       событие stt.result с block, прогресс ST.stt (best не падает), 429 и отказ */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const events = [], calls = [];
      const sb = { console,
        fetch: async (url, opts) => { calls.push({ url, opts });
          return { status: 200, ok: true, json: async () => ({ text: "салам", used: 5, limit: 20 }) }; },
        tf: (k, v) => k + "=" + (v.p != null ? v.p : v.b),
        EV: {}, ST: {}, save() {}, evPush: (n, p) => events.push([n, JSON.parse(JSON.stringify(p))]), homeOf: () => "m0" };
      vm.createContext(sb);
      vm.runInContext(sttSrc + "; this.send=sttSend; this.scoreTxt=sttScoreText;", sb);
      assert.strictEqual(sb.scoreTxt(0.5, 100), "stt_score=50 · stt_best=100", "балл попытки + лучший, когда он выше");
      assert.strictEqual(sb.scoreTxt(1, 100), "stt_score=100", "равный лучший не дублируется");
      assert.strictEqual(sb.scoreTxt(0, 0), "stt_score=0", "ноль без хвоста");
      const d = await sb.send({ id: "x1", ky: "Салам!" }, { type: "audio/webm", size: 3 }, { block: "card" });
      assert.strictEqual(calls[0].url, "api/stt/m0", "ядро бьёт в ту же ручку — лимит дня общий с вкладкой");
      assert.strictEqual(calls[0].opts.method, "POST");
      assert.strictEqual(calls[0].opts.headers["Content-Type"], "audio/webm", "тип тела — из записи");
      assert.strictEqual(d.cmp.score, 1, "сверка распознанного с эталоном");
      assert.strictEqual(d.said, "салам");
      assert.deepStrictEqual(events[0], ["stt.result", { id: "x1", ky: "Салам!", mod: "m0", score: 100, block: "card" }],
        "событие в журнал: id, фраза, модуль, балл и место занятия");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.ST.stt.x1)), { best: 100, n: 1 }, "личный прогресс записан");
      assert.strictEqual(sb.EV.stt, 1, "счётчик попыток сессии растёт");
      // вторая попытка хуже: best не падает, попытки считаются
      sb.fetch = async () => ({ status: 200, ok: true, json: async () => ({ text: "жок", used: 6, limit: 20 }) });
      await sb.send({ id: "x1", ky: "Салам!" }, { type: "audio/webm" }, { block: "card" });
      assert.deepStrictEqual(JSON.parse(JSON.stringify(sb.ST.stt.x1)), { best: 100, n: 2 }, "best держится, n растёт");
      // лимит дня: {limited}, без события и без прогресса
      const evN = events.length;
      sb.fetch = async () => ({ status: 429, ok: false, json: async () => ({ used: 20, limit: 20 }) });
      const lim = await sb.send({ id: "x2", ky: "Жол" }, { type: "audio/webm" }, { block: "card" });
      assert.strictEqual(lim.limited, true, "429 — лимит, не исключение");
      assert.strictEqual(events.length, evN, "залимитная попытка в журнал не пишется");
      assert.ok(!sb.ST.stt.x2, "и в прогресс не попадает");
      // прочий отказ — исключение с текстом сервера
      sb.fetch = async () => ({ status: 500, ok: false, json: async () => ({ error: "boom" }) });
      await assert.rejects(() => sb.send({ id: "x2", ky: "Жол" }, { type: "audio/webm" }, {}), /boom/, "отказ доносит причину");
    }

    /* 12. Кнопка «повтори за диктором» на карточке: гейты перебором состояний
       (демо / нет опции / триал / нет озвучки / ученик / преподаватель) и полный
       клик-цикл с мок-микрофоном: запись → распознавание → пословная подсветка,
       лимит 429, смена карточки во время распознавания не тратит попытку */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const cardFn = page.match(/function sttCardBtn\(c\)\{[\s\S]*?\n\}\n/);
      assert.ok(cardFn, "sttCardBtn в сборке");
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], isConnected: true,
        set textContent(v) { this.kids = []; }, get textContent() { return ""; },
        append(...k) { this.kids.push(...k); },
        addEventListener(type, fnc) { (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const texts = (n) => flat(n, [n]).flatMap((x) => x.kids.filter((k) => typeof k === "string"));
      const build = (opts) => {
        const calls = [], events = [], mic = fakeMic(), recs = mic.recs;
        const sb = { console, t: (k) => k, tf: (k) => k, icon: () => null,
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          clear: (n) => { n.kids = []; return n; },
          isTeacher: () => !!opts.teacher, ME: opts.me,
          AUDIO: new Set(opts.audio || []),
          navigator: mic.navigator, MediaRecorder: mic.MediaRecorder,
          Blob: class { constructor(chunks, o) { this.size = (chunks || []).reduce((s, x) => s + (x.size || 0), 0); this.type = (o && o.type) || ""; } },
          fetch: async (url, o) => { calls.push({ url, o });
            return { status: opts.status || 200, ok: (opts.status || 200) === 200,
              json: async () => (opts.resp || { text: "салам", used: 1, limit: 20 }) }; },
          setTimeout: () => 0, clearTimeout: () => {},
          // холд самообновления вкладки на время записи (===UPDATE===) — его гейт в update.test.js
          updateHold: () => {},
          EV: {}, ST: {}, save() {}, evPush: (n, p) => events.push([n, JSON.parse(JSON.stringify(p))]), homeOf: () => "m0" };
        if (opts.demo) sb.IS_DEMO = true;
        vm.createContext(sb);
        vm.runInContext(sttSrc + cardFn[0] + "; this.W=sttCardBtn(this.C);", Object.assign(sb, { C: opts.c }));
        return { w: sb.W, calls, events, recs, sb };
      };
      const stuOn = { stt: { enabled: true, why: null, used: 0, limit: 20 } };
      const c = { id: "w1", ky: "салам жок" };
      // гейты перебором: кнопки нет в демо, без опции, на триале, без озвучки
      assert.strictEqual(build({ demo: true, me: stuOn, audio: ["w1"], c }).w, null, "демо — кнопки нет");
      assert.strictEqual(build({ me: null, audio: ["w1"], c }).w, null, "аноним/без /api/me — кнопки нет");
      assert.strictEqual(build({ me: { stt: { enabled: false, why: "off" } }, audio: ["w1"], c }).w, null, "опция выключена — кнопки нет");
      assert.strictEqual(build({ me: { stt: { enabled: false, why: "trial" } }, audio: ["w1"], c }).w, null, "триал — кнопки нет");
      assert.strictEqual(build({ me: stuOn, audio: ["other"], c }).w, null, "слово без озвучки — повторять не за кем");
      assert.ok(build({ me: null, teacher: true, audio: ["w1"], c }).w, "преподавателю кнопка есть без тумблера");
      // полный цикл ученика: клик → запись → стоп → распознано → подсветка
      const run = build({ me: stuOn, audio: ["w1"], c });
      assert.ok(run.w && String(run.w.attrs.class).includes("stt-card"), "виджет отрисован");
      const btn = flat(run.w, [run.w]).find((n) => n.tag === "button");
      assert.strictEqual(btn.attrs.title, "stt_card_hint", "подсказка объясняет, что это");
      await btn.on.click();
      assert.strictEqual(run.recs.length, 1, "клик начал запись");
      assert.strictEqual(run.recs[0].state, "recording");
      run.recs[0].ondataavailable({ data: { size: 3 } });
      await run.recs[0].onstop();
      assert.strictEqual(run.calls.length, 1, "запись ушла на распознавание");
      assert.strictEqual(run.calls[0].url, "api/stt/m0", "в ту же ручку — общий дневной лимит");
      const spans = flat(run.w, [run.w]).filter((n) => n.tag === "span");
      assert.deepStrictEqual(spans.map((s) => String(s.attrs.style).includes("--ok")), [true, false],
        "пословная подсветка: «салам» совпал, «жок» — нет");
      assert.ok(texts(run.w).some((s) => s.includes("stt_said")), "распознанный текст показан");
      assert.ok(texts(run.w).some((s) => s.includes("stt_score")), "строка балла видна на карточке");
      assert.deepStrictEqual(run.events[0], ["stt.result", { id: "w1", ky: "салам жок", mod: "m0", score: 50, block: "card" }],
        "событие в журнал с block:card");
      assert.deepStrictEqual(JSON.parse(JSON.stringify(run.sb.ST.stt.w1)), { best: 50, n: 1 }, "прогресс фразы записан");
      // лимит дня: сообщение вместо результата
      const limRun = build({ me: stuOn, audio: ["w1"], c, status: 429, resp: { used: 20, limit: 20 } });
      const limBtn = flat(limRun.w, [limRun.w]).find((n) => n.tag === "button");
      await limBtn.on.click();
      limRun.recs[0].ondataavailable({ data: { size: 3 } });
      await limRun.recs[0].onstop();
      assert.ok(texts(limRun.w).some((s) => s === "stt_limit_p"), "на лимите — внятное сообщение");
      // смена карточки во время записи: попытка не тратится, чужой DOM не трогается
      const gone = build({ me: stuOn, audio: ["w1"], c });
      const goneBtn = flat(gone.w, [gone.w]).find((n) => n.tag === "button");
      await goneBtn.on.click();
      gone.recs[0].ondataavailable({ data: { size: 3 } });
      for (const n of flat(gone.w, [gone.w]).concat([gone.w])) n.isConnected = false;
      await gone.recs[0].onstop();
      assert.strictEqual(gone.calls.length, 0, "ушедшая карточка не тратит попытку");
      // пустая запись (ни одного чанка) — тоже не тратится
      const empty = build({ me: stuOn, audio: ["w1"], c });
      const emptyBtn = flat(empty.w, [empty.w]).find((n) => n.tag === "button");
      await emptyBtn.on.click();
      await empty.recs[0].onstop();
      assert.strictEqual(empty.calls.length, 0, "пустая запись на сервер не уходит");
    }

    /* 13. Виджет на месте: renderRecognition исполняется с настоящим sttCardBtn —
       у озвученного слова с включённой опцией виджет внизу карточки, без озвучки
       или без опции его нет («что отдали» ≠ «что человек увидит») */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const cardFn = page.match(/function sttCardBtn\(c\)\{[\s\S]*?\n\}\n/)[0];
      const rr = page.match(/renderRecognition\(area,c\)\{[\s\S]*?\n {2}\},/);
      assert.ok(rr, "renderRecognition извлечён");
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], isConnected: true,
        append(...k) { this.kids.push(...k); },
        addEventListener(type, fnc) { (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const render = (opts) => {
        const area = mkNode("div");
        const sb = { console, t: (k) => k, tf: (k) => k, icon: () => null,
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          clear: (n) => { n.kids = []; return n; },
          performance: { now: () => 0 },
          gloss: (c) => "g-" + c.id, pickDistractors: () => ["d1", "d2", "d3"], shuffle: (x) => x,
          optList: () => mkNode("div"), VOCAB: [], evPush() {}, homeOf: () => "m0",
          Cards: { gen: 0 }, isTeacher: () => false, ME: opts.me,
          AUDIO: new Set(opts.audio || []), navigator: {},
          THIS: { cardHead: () => mkNode("div"), autoPlay() {}, queue: [], next() {} },
          AREA: area, C: opts.c };
        vm.createContext(sb);
        vm.runInContext(sttSrc + cardFn + "const R={" + rr[0] + "};R.renderRecognition.call(this.THIS,this.AREA,this.C);", sb);
        return flat(area, [area]);
      };
      const stuOn = { stt: { enabled: true, why: null, used: 0, limit: 20 } };
      const c = { id: "w1", ky: "салам" };
      assert.ok(render({ me: stuOn, audio: ["w1"], c }).some((n) => String(n.attrs.class).includes("stt-card")),
        "озвученное слово при включённой опции — с кнопкой «повтори за диктором»");
      assert.ok(!render({ me: stuOn, audio: [], c }).some((n) => String(n.attrs.class).includes("stt-card")),
        "без озвучки виджета нет, карточка живёт");
      assert.ok(!render({ me: { stt: { enabled: false, why: "off" } }, audio: ["w1"], c }).some((n) => String(n.attrs.class).includes("stt-card")),
        "без опции виджета нет, карточка живёт");
    }

    /* 14. Строка балла на вкладке аудирования: полный цикл слушай → говори →
       распознано исполнением renderListen с мок-микрофоном — resultView показывает
       «Совпадение: N%», после лучшей попытки хвост «· лучший: M%» */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const sttSrc = page.match(/===STT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT=== \*\//)[1];
      const fn = page.match(/function renderListen\(m\)\{[\s\S]*$/);
      const src = fn[0].slice(0, fn[0].indexOf("\n}\n") + 2);
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], isConnected: true,
        append(...k) { this.kids.push(...k); },
        addEventListener(type, fnc) { (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const root = mkNode("main");
      const mic = fakeMic(), recs = mic.recs;
      let resp = { text: "салам", used: 1, limit: 20 };
      let sttCalls = 0;
      const sb = { console, t: (k) => k, tf: (k, v) => k + "=" + (v.p != null ? v.p : v.b != null ? v.b : Object.values(v)[0]),
        icon: () => null,
        h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
        clear: (n) => { n.kids = []; return n; }, isTeacher: () => false,
        ME: { stt: { enabled: true, why: null, used: 0, limit: 20 } },
        VOCAB: [{ id: "x1", ky: "салам жок" }], AUDIO: new Set(["x1"]),
        dayKeyOf: () => "2026-08-19", recOf: () => null, playAudio: () => null,
        navigator: mic.navigator, MediaRecorder: mic.MediaRecorder,
        Blob: class { constructor(ch, o) { this.size = (ch || []).reduce((s, x) => s + (x.size || 0), 0); this.type = (o && o.type) || ""; } },
        URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
        fetch: async () => { sttCalls++; return { status: 200, ok: true, json: async () => resp }; },
        setTimeout: () => 0, clearTimeout: () => {}, homeOf: () => "m0",
        // холд самообновления вкладки на время записи (===UPDATE===) — его гейт в update.test.js
        updateHold: () => {},
        ST: {}, save() {}, evPush() {}, EV: {},
        Date, encodeURIComponent, ROOT: root };
      vm.createContext(sb);
      vm.runInContext(sttSrc + src + "; renderListen(this.ROOT);", sb);
      const btn = (label) => flat(root, [root]).find((n) => n.tag === "button" &&
        n.kids.some((k) => typeof k === "string" && k.includes(label)));
      const strs = () => flat(root, [root]).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
      btn("stt_listen").attrs.onclick(); // протокол: сперва слушать
      await btn("stt_rec").on.click();
      assert.strictEqual(recs.length, 1, "запись началась");
      recs[0].ondataavailable({ data: { size: 3 } });
      recs[0].stop(); await recs[0].onstop();
      assert.ok(strs().some((s) => s === "stt_score=50"), "балл попытки виден (50%, лучший равный не дублируется)");
      // вторая попытка хуже: балл 0, лучший 50 — хвост появился
      resp = { text: "", used: 2, limit: 20 };
      await btn("stt_rec").on.click();
      assert.strictEqual(recs.length, 2, "вторая запись началась");
      recs[1].ondataavailable({ data: { size: 3 } });
      recs[1].stop(); await recs[1].onstop();
      assert.ok(strs().some((s) => s === "stt_score=0 · stt_best=50"), "после худшей попытки виден и лучший результат");
      // Переключил упражнение посреди записи: микрофон гаснет сразу, запись в платное
      // распознавание не уходит и чужой результат на новую фразу не ложится (ревью 25.09.2026)
      await btn("stt_rec").on.click();
      assert.strictEqual(recs[2].state, "recording", "третья запись идёт");
      recs[2].ondataavailable({ data: { size: 3 } });
      const before = sttCalls;
      btn("stt_next").attrs.onclick();
      assert.strictEqual(recs[2].state, "inactive", "смена упражнения остановила запись");
      await recs[2].onstop();   // браузер присылает onstop после stop()
      assert.ok(!mic.live(), "дорожки микрофона отпущены");
      assert.strictEqual(sttCalls, before, "брошенная запись не ушла в распознавание (квота цела)");
      assert.ok(!strs().some((s) => /^stt_score=/.test(s)), "на новой фразе нет результата прошлой");
      // ушёл с вкладки посреди записи: кнопки записи больше нет в документе — попытка не тратится
      btn("stt_listen").attrs.onclick();
      const recB = btn("stt_rec");
      await recB.on.click();
      recs[3].ondataavailable({ data: { size: 3 } });
      recB.isConnected = false;
      recs[3].stop(); await recs[3].onstop();
      assert.strictEqual(sttCalls, before, "запись после ухода с вкладки не ушла в распознавание");
    }

    console.log("stt.test.js: OK (выключено/триал/вкл/лимит перебором, затраты в файле и карточке, демо без вкладки, vm-сверка слов, блоки, дриллы гласных и согласных, окончания M1 со скоупом и ссылкой на урок, кнопка на карточке, строка балла)");
  } finally {
    if (srv) await srv.stop();
    if (mock) await new Promise((r) => mock.close(r));
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
