"use strict";
/* Синхронизация прогресса: гард «кто новее» в pullState исполняется на мок-fetch.
   Правило неприкосновенности прогресса: бут (единственная точка pull) не должен
   затирать локальные ответы, которые ещё не доехали до сервера. */
const assert = require("assert");
const vm = require("vm");
const { blockSrc, html } = require("./helpers/block");

function ctx(serverState, localState) {
  const stored = [];
  const norm = html.match(/function normalizeState\(sv\)\{[\s\S]*?\n\}/);
  const mig1 = html.match(/function migrateTestV1\(t\)\{[\s\S]*?\n\}/);
  const mig2 = html.match(/function migrateV1\(sv\)\{[\s\S]*?\n\}/);
  assert.ok(norm && mig1 && mig2, "normalizeState с миграциями найдены");
  const puts = [], gets = [], timers = [];
  const sb = {
    console, SYNC: { enabled: true }, ST: localState, ME: null, puts,
    LS_KEY: "k", localStorage: { setItem: (k, v) => stored.push(JSON.parse(v)) },
    fetch: async (url, opts) => {
      if (opts && opts.method === "PUT") { puts.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => ({ ok: true, restored: sb.restored === true }) }; }
      gets.push(String(url));
      return { ok: serverState !== "err", json: async () => serverState };
    },
    // pushState живёт на таймере 800 мс — в тесте таймер срабатывает сразу; повторы
    // (20 с: pull после ошибки, ретрай отправки) копятся в timers и не срабатывают сами —
    // иначе упавший pull перезапускал бы себя бесконечно
    setTimeout: (fn, ms) => { if (ms >= 20000) { timers.push({ fn, ms }); return timers.length; } fn(); return 1; },
    clearTimeout: () => {}, timers,
    freshState: () => ({ v: 2, updatedAt: null, modules: {}, fresh: true }),
    updateFooter: () => {}, fetchMe: async () => {}, renderModulesPath: () => {}, setImmediate,
  };
  vm.createContext(sb);
  vm.runInContext(mig1[0] + "\n" + mig2[0] + "\n" + norm[0] + "\n" + blockSrc("SYNCPULL") +
    ";this.pullState=pullState;this.pushState=pushState;", sb);
  sb.gets = gets;
  return { sb, stored, puts, gets };
}
const state = (updatedAt, extra) => Object.assign({ v: 2, updatedAt, modules: { m0: { vocab: {}, test: {} } } }, extra);

(async () => {
  /* 1. Сервер старее локального: свежие ответы этой сессии переживают pull */
  {
    const local = state("2026-08-13T10:00:00Z", { marked: ["m0_05"] });
    const { sb } = ctx(state("2026-08-13T09:00:00Z"), local);
    await sb.pullState();
    assert.strictEqual(sb.ST, local, "локальное состояние не подменено");
    assert.strictEqual(sb.ST.marked[0], "m0_05", "свежие пометки на месте");
  }

  /* 2. Сервер новее (занимался с другого устройства): состояние честно подменяется */
  {
    const srv = state("2026-08-13T11:00:00Z", { skip: ["m0_09"] });
    const { sb, stored } = ctx(srv, state("2026-08-13T10:00:00Z"));
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-08-13T11:00:00Z", "принято серверное состояние");
    assert.strictEqual(sb.ST.skip[0], "m0_09", "вместе с новыми полями");
    assert.strictEqual(stored.length, 1, "и продублировано в localStorage");
  }

  /* 3. Первый вход на устройстве (локального updatedAt нет) — серверное принимается */
  {
    const { sb } = ctx(state("2026-08-13T11:00:00Z"), { v: 2, updatedAt: null, modules: {} });
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-08-13T11:00:00Z", "пустое устройство наполняется с сервера");
  }

  /* 4. Мусор с сервера не роняет и не затирает: normalizeState отбрасывает, локальное живёт */
  {
    const local = state("2026-08-13T10:00:00Z");
    const { sb, stored } = ctx({ v: 99, garbage: true }, local);
    await sb.pullState();
    assert.strictEqual(sb.ST, local, "неопознанное состояние проигнорировано");
    assert.strictEqual(stored.length, 0, "и не записано локально");
    assert.strictEqual(sb.SYNC.status, "ok", "это не ошибка сети — просто нечего брать");
  }

  /* 5. Сеть упала: статус err, состояние нетронуто */
  {
    const local = state("2026-08-13T10:00:00Z");
    const { sb } = ctx("err", local);
    sb.fetch = async () => { throw new Error("net"); };
    await sb.pullState();
    assert.strictEqual(sb.ST, local, "обрыв сети не трогает прогресс");
    assert.strictEqual(sb.SYNC.status, "err");
  }

  /* 6. Общий телефон: локальная копия принадлежит другому логину — она не наследуется,
        даже если новее серверной (порча прогресса преподавателя и ученицы 15.09.2026) */
  {
    const local = state("2026-09-15T02:47:00Z", { login: "altynai", marked: ["m0_05"] });
    const srv = state("2026-09-13T16:26:00Z", { skip: ["m0_09"] });
    const { sb, stored } = ctx(srv, local);
    sb.ME = { login: "cherevko_evgeniya" };
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-09-13T16:26:00Z", "чужая свежая копия проиграла серверной ученицы");
    assert.strictEqual(sb.ST.login, "cherevko_evgeniya", "локальная копия переписана на текущего владельца");
    assert.ok(!sb.ST.marked, "пометки чужого логина не унаследованы");
    assert.strictEqual(stored.length, 1, "и записана в localStorage");
  }
  /* 6б. Чужая копия, а на сервере у этого логина ещё пусто — чистый лист, не чужой прогресс */
  {
    const local = state("2026-09-15T02:47:00Z", { login: "altynai" });
    const { sb } = ctx(null, local);
    sb.ME = { login: "novichok" };
    await sb.pullState();
    assert.ok(sb.ST.fresh && sb.ST.login === "novichok", "новичок на чужом телефоне начинает с чистого листа");
  }
  /* 6в. Свой логин — прежний гард по свежести: локальное новее, остаётся */
  {
    const local = state("2026-08-13T10:00:00Z", { login: "aida", marked: ["m0_05"] });
    const { sb } = ctx(state("2026-08-13T09:00:00Z"), local);
    sb.ME = { login: "aida" };
    await sb.pullState();
    assert.strictEqual(sb.ST, local, "своя свежая копия не подменена");
  }

  /* 6г. Владелец ставится только после сверки: fetchMe до pull не делает чужую копию своей */
  {
    const local = state("2026-09-15T02:47:00Z", { login: "altynai" });
    const srv = state("2026-09-13T16:26:00Z");
    const { sb } = ctx(srv, local);
    sb.ME = { login: "cherevko_evgeniya" };
    sb.ST.courses = ["a1"];   // так делает fetchMe до pull — login при этом не трогается
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-09-13T16:26:00Z", "чужая копия отброшена, хотя fetchMe уже прошёл");
  }
  /* 6д. Сервер ответил 409 (копия другого логина): без ретрая — профиль и серверная копия заново */
  {
    const local = state("2026-09-15T02:47:00Z", { login: "altynai" });
    const srv = state("2026-09-13T16:26:00Z");
    const { sb, puts } = ctx(srv, local);
    sb.ME = { login: "altynai" };
    let meCalls = 0; sb.fetchMe = async () => { meCalls++; sb.ME = { login: "cherevko_evgeniya" }; };
    sb.SYNC.pulled = true;
    const origFetch = sb.fetch;
    sb.fetch = async (url, opts) => (opts && opts.method === "PUT") ? { ok: false, status: 409 } : origFetch(url, opts);
    let retries = 0; sb.scheduleSyncRetry = () => { retries++; };
    sb.pushState();
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    assert.strictEqual(meCalls, 1, "после 409 профиль переспрошен");
    assert.strictEqual(sb.ST.login, "cherevko_evgeniya", "и принята серверная копия настоящего владельца");
    assert.strictEqual(retries, 0, "ретрая отправки нет");
  }

  /* 7. До первого pull пуш не уезжает: устаревшая копия второго браузера раньше
        отправлялась на сервер параллельно с pull и затирала историю тестов */
  {
    const local = state("2026-09-12T06:01:00Z", { login: "aida" });
    const srv = state("2026-09-12T13:01:00Z", { skip: ["m0_09"] });
    const { sb, puts } = ctx(srv, local);
    sb.ME = { login: "aida" };
    sb.pushState();
    assert.strictEqual(puts.length, 0, "пуш до pull отложен");
    assert.strictEqual(sb.SYNC.pending, true, "и запомнен");
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-09-12T13:01:00Z", "pull принял серверную (более свежую) копию");
    assert.strictEqual(puts.length, 1, "отложенный пуш выполнен после pull");
    assert.strictEqual(puts[0].updatedAt, "2026-09-12T13:01:00Z", "и ушла уже свежая копия, а не устаревшая");
    sb.pushState();
    assert.strictEqual(puts.length, 2, "после первого pull пуш работает как раньше");
  }

  /* 8. Обычная отправка не тянет прогресс и профиль заново (раньше — два запроса на каждый ответ,
        и через fetchMe → save → push они шли по кругу); pull — только если сервер что-то вернул */
  {
    const local = state("2026-09-12T13:01:00Z", { login: "aida" });
    const { sb, puts, gets } = ctx(state("2026-09-12T13:01:00Z"), local);
    sb.ME = { login: "aida" }; sb.SYNC.pulled = true;
    let meCalls = 0; sb.fetchMe = async () => { meCalls++; };
    sb.pushState();
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    assert.strictEqual(puts.length, 1, "отправка ушла");
    assert.strictEqual(gets.length, 0, "без restored серверная копия не запрашивается");
    assert.strictEqual(meCalls, 0, "и профиль не перечитывается");
    sb.restored = true;
    sb.pushState();
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    assert.strictEqual(gets.length, 1, "restored → серверная копия забрана");
    assert.strictEqual(meCalls, 1, "и профиль перечитан (замки тропы)");
  }

  /* 9. Первый pull упал (сеть, 5xx): отложенный пуш НЕ уезжает — серверную копию никто не
        видел, и устаревшая локальная затёрла бы её (ревью 25.09.2026: pulled ставился и при
        ошибке). Pull повторяется по таймеру; как только он прошёл — уезжает свежая копия. */
  for (const fail of ["throw", "5xx"]) {
    const local = state("2026-09-12T06:01:00Z", { login: "aida" });
    const srv = state("2026-09-12T13:01:00Z", { skip: ["m0_09"] });
    const { sb, puts } = ctx(srv, local);
    sb.ME = { login: "aida" };
    const timers = sb.timers;
    const okFetch = sb.fetch;
    sb.fetch = fail === "throw" ? async () => { throw new Error("net"); }
      : async (url, opts) => (opts && opts.method === "PUT") ? okFetch(url, opts) : { ok: false, status: 502, json: async () => ({}) };
    sb.pushState();
    await sb.pullState();
    assert.strictEqual(sb.SYNC.status, "err", fail + ": pull упал");
    assert.notStrictEqual(sb.SYNC.pulled, true, fail + ": без удачного pull синхронизация не считается сверенной");
    assert.strictEqual(sb.SYNC.pending, true, fail + ": отложенный пуш ждёт");
    assert.strictEqual(puts.length, 0, fail + ": устаревшая копия на сервер не ушла");
    const retry = timers.find((x) => x.fn === sb.pullState || String(x.fn).includes("pullState"));
    assert.ok(retry, fail + ": повтор pull запланирован");
    sb.fetch = okFetch;
    await retry.fn();
    assert.strictEqual(sb.SYNC.pulled, true, fail + ": после удачного повтора — сверено");
    assert.strictEqual(sb.ST.updatedAt, "2026-09-12T13:01:00Z", fail + ": принята более свежая серверная копия");
    assert.strictEqual(puts.length, 1, fail + ": отложенный пуш выполнен");
    assert.strictEqual(puts[0].updatedAt, "2026-09-12T13:01:00Z", fail + ": и ушла свежая копия, а не устаревшая");
  }

  /* 10. Настоящий порядок загрузки: fetchMe → pullState (15-boot). Профиль принёс другие
         курсы (выдали курс, новое устройство) — fetchMe зовёт save(), тот ставит
         updatedAt=сейчас; раньше устаревшая локальная копия того же логина из-за этого
         «побеждала» серверную и уезжала на сервер (найдено смоуком 25.09.2026). Теперь pull
         сверяет по снимку загрузки SYNC.base. */
  {
    const fm = html.match(/async function fetchMe\(\)\{[\s\S]*?\n\}/);
    assert.ok(fm, "fetchMe найден в отданной странице");
    const local = state("2026-09-12T06:01:00Z", { login: "aida", courses: ["a1"] });
    const srv = state("2026-09-12T13:01:00Z", { skip: ["m0_09"] });
    const { sb, puts } = ctx(srv, local);
    sb.SYNC.base = JSON.parse(JSON.stringify(local));   // как в приложении: снимок при загрузке вкладки
    const me = { login: "aida", courses: ["a1", "a2"] };
    const progressFetch = sb.fetch;
    sb.fetch = async (url, opts) => String(url) === "api/me" ? { ok: true, json: async () => me } : progressFetch(url, opts);
    sb.chatBadgeSync = () => {};
    sb.save = () => { sb.ST.updatedAt = new Date().toISOString(); sb.pushState(); };   // как в приложении: saveLocal + push
    vm.runInContext(fm[0] + ";this.fetchMe=fetchMe;", sb);
    await sb.fetchMe();
    assert.strictEqual(JSON.stringify(sb.ST.courses), '["a1","a2"]', "курсы профиля запомнены локально (сайдбар офлайн)");
    assert.strictEqual(puts.length, 0, "до сверки с сервером ничего не отправлено");
    await sb.pullState();
    assert.strictEqual(sb.ST.updatedAt, "2026-09-12T13:01:00Z", "серверная (более свежая) копия принята");
    assert.strictEqual(sb.ST.skip[0], "m0_09", "вместе с её данными");
    assert.deepStrictEqual(sb.ST.courses, ["a1", "a2"], "а курсы — из профиля, не из серверной копии");
    assert.ok(puts.every((p) => p.updatedAt !== "2026-09-12T06:01:00Z"), "устаревшая копия на сервер не ушла");
    // после сверки смена курсов снова обычная: сохраняется и уезжает
    me.courses = ["a1", "a2", "b1"];
    const before = puts.length;
    await sb.fetchMe();
    assert.ok(puts.length > before, "после сверки новая смена курсов отправляется как раньше");
  }

  /* 11–13. Снимок загрузки (SYNC.base): «кто новее» решается по копии, КАКОЙ ОНА БЫЛА при
         загрузке вкладки, а не по отметке после первых ответов. Раньше ответ, данный до
         окончания первого pull, ставил updatedAt=сейчас, и устаревшая копия целиком
         побеждала серверную. Теперь сервер новее снимка → берётся серверная копия, а сверху
         ложится только сделанное в этой вкладке (ответы, «отложить», настройки). */
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const withVocab = (updatedAt, vocab, extra) => Object.assign({ v: 2, updatedAt, login: "aida", modules: { m0: { vocab, test: {} } } }, extra);
  {
    // 11. ответ в окне до первого pull: устаревшая копия, сервер новее снимка
    const base = withVocab("2026-09-20T08:00:00Z", { m0_05: { box: 1 }, m0_07: { box: 1 } });
    const srv = withVocab("2026-09-24T18:00:00Z", { m0_05: { box: 1 }, m0_07: { box: 3 }, m0_09: { box: 2 } }, { skip: ["m0_11"] });
    const cur = clone(base);
    cur.modules.m0.vocab.m0_05 = { box: 2 };             // ответил, пока шёл pull
    cur.updatedAt = "2026-09-25T09:00:00Z";              // saveLocal поставил «сейчас»
    const { sb, puts } = ctx(srv, cur);
    sb.ME = { login: "aida" }; sb.SYNC.base = clone(base);
    sb.pushState();                                      // отправка ответа ждёт pull
    await sb.pullState();
    const v = sb.ST.modules.m0.vocab;
    assert.strictEqual(v.m0_07.box, 3, "серверный прогресс другого устройства не откатился устаревшей копией");
    assert.ok(v.m0_09, "и серверное новое слово на месте");
    assert.strictEqual(JSON.stringify(sb.ST.skip), '["m0_11"]', "и серверные «отложенные»");   // массив из vm — сверка по JSON
    assert.strictEqual(v.m0_05.box, 2, "ответ, данный до pull, не потерян");
    assert.ok(sb.ST.updatedAt > "2026-09-24T18:00:00Z", "итог свежее серверного — он уедет на сервер");
    assert.strictEqual(puts.length, 1, "итог отправлен после pull");
    assert.strictEqual(puts[0].modules.m0.vocab.m0_07.box, 3, "и в отправке — серверный уровень, а не устаревший");
    assert.strictEqual(sb.SYNC.base, null, "снимок загрузки больше не нужен");
  }
  {
    // 12. офлайн-сессия, других устройств не было: сервер не новее снимка — копия остаётся как есть
    const base = withVocab("2026-09-24T18:00:00Z", { m0_05: { box: 1 } });
    const cur = clone(base); cur.modules.m0.vocab.m0_05 = { box: 3 }; cur.modules.m0.vocab.m0_06 = { box: 1 };
    cur.updatedAt = "2026-09-25T09:00:00Z";
    const { sb, puts } = ctx(clone(base), cur);
    sb.ME = { login: "aida" }; sb.SYNC.base = clone(base);
    await sb.pullState();
    assert.strictEqual(sb.ST, cur, "занятия офлайн целиком сохранены");
    assert.strictEqual(puts.length, 1, "и сразу уезжают на сервер, не дожидаясь следующего ответа");
  }
  {
    // 13. офлайн-сессия, а другое устройство тем временем синхронизировалось: нужны оба
    const base = withVocab("2026-09-20T08:00:00Z", { m0_05: { box: 1 }, m0_06: { box: 1 } }, { settings: { autoPlay: false } });
    const srv = withVocab("2026-09-24T18:00:00Z", { m0_05: { box: 1 }, m0_06: { box: 4 } }, { settings: { autoPlay: false } });
    const cur = clone(base); cur.modules.m0.vocab.m0_05 = { box: 3 }; cur.settings = { autoPlay: true };
    cur.modules.m1 = { vocab: { m1_01: { box: 1 } }, test: null };
    cur.updatedAt = "2026-09-25T09:00:00Z";
    const { sb } = ctx(srv, cur);
    sb.ME = { login: "aida" }; sb.SYNC.base = clone(base);
    await sb.pullState();
    const v = sb.ST.modules.m0.vocab;
    assert.strictEqual(v.m0_05.box, 3, "офлайн-ответ этого устройства сохранён");
    assert.strictEqual(v.m0_06.box, 4, "прогресс другого устройства — тоже");
    assert.ok(sb.ST.modules.m1 && sb.ST.modules.m1.vocab.m1_01, "начатый офлайн модуль сохранён");
    assert.strictEqual(sb.ST.settings.autoPlay, true, "и изменённая настройка");
  }
  assert.ok(/SYNC\.base=/.test(html), "снимок загрузки ставится в отданной странице");

  console.log("sync.test.js: OK (pull: гард по свежести, второе устройство, первый вход, мусор, обрыв; чужой логин на устройстве; пуш ждёт первого pull; pull после отправки — только при restored; курсы профиля до pull не делают копию свежей; снимок загрузки: сервер + изменения этой вкладки)");
})().catch((e) => { console.error(e); process.exitCode = 1; });
