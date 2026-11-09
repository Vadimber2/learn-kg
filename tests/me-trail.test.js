"use strict";
/* Сцепка сервера и клиента на живых данных: настоящий ответ /api/me исполняется
   настоящим блоком ===TRAIL=== из ТОЙ ЖЕ страницы, которую получил этот ученик.
   До этого сьюта trail.test.js кормил тропу рукописным профилем, а per-user-shell
   проверял JSON сервера — согласованность двух половин держалась на дисциплине.
   Канон: состав артефакта ≠ поведение с ним. */
const assert = require("assert");
const vm = require("vm");
const { startServer } = require("./helpers/serve");

const PORT = 8195;
const DATA = "/tmp/kga1-mt-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9");

// Тропа ученика, собранная из его страницы и его /api/me — глазами клиента
function trailFor(page, me) {
  const cut = (re, what) => { const m = page.match(re); assert.ok(m, what + " найден в странице ученика"); return m[0]; };
  const meta = cut(/const MODULE_META=\[[\s\S]*?\];/, "MODULE_META");
  const ready = cut(/const CONTENT_READY = \[[^\n]*\];/, "CONTENT_READY");
  const metaOf = cut(/function metaOf\(id\)\{[^\n]*\}/, "metaOf");
  const trail = page.match(/\/\* ===TRAIL=== \*\/([\s\S]*?)\/\* ===\/TRAIL=== \*\//);
  assert.ok(trail, "маркеры ===TRAIL=== найдены в странице ученика");
  const sb = { console, ME: me, ST: {}, activeTab: "overview", activeModule: "m0",
    isTeacher: () => !!(me && (me.role === "teacher" || me.role === "admin")) };
  vm.createContext(sb);
  vm.runInContext(meta + "\n" + ready + "\n" + metaOf + "\n" + trail[1] +
    ";this.myCourses=myCourses;this.startModule=startModule;this.studyOpen=studyOpen;this.isRevoked=isRevoked;", sb);
  return sb;
}

(async () => {
  const srv = await startServer({ port: PORT, dataDir: DATA });
  try {
    for (const [login, courses] of [["mt_a1", ["a1"]], ["mt_a2", ["a2"]], ["mt_ex", ["a1", "a2"]]]) {
      assert.strictEqual((await srv.req("PUT", "/api/students", { auth: ALT,
        body: { login, password: "mt-KgA1-26", create: true, role: "student", courses } })).status, 200, "заведён " + login);
    }
    const page = async (a) => (await srv.req("GET", "/", { auth: a })).text;
    const me = async (a) => JSON.parse((await srv.req("GET", "/api/me", { auth: a })).text);

    /* 1. Ученик A1: живая тропа совпадает с обещанием сервера */
    {
      const t = trailFor(await page(B("mt_a1", "mt-KgA1-26")), await me(B("mt_a1", "mt-KgA1-26")));
      assert.strictEqual(t.myCourses().join(), "a1");
      assert.strictEqual(t.startModule(), "m0");
      assert.ok(t.studyOpen("m0") && !t.isRevoked("m0"));
    }

    /* 2. Ученик без A1: сервер не отдал m1 — клиент стартует в своём курсе, m0 просто заперт */
    {
      const auth = B("mt_a2", "mt-KgA1-26");
      const t = trailFor(await page(auth), await me(auth));
      assert.strictEqual(t.myCourses().join(), "a2");
      assert.strictEqual(t.startModule(), "m12", "живой профиль ведёт в первый модуль своего курса");
      assert.ok(!t.studyOpen("m0") && !t.isRevoked("m0"), "чужой m0 заперт, но не «отнят»");
    }

    /* 3. Отъём курса на живом сервере: result_only доезжает до клиентского предиката */
    {
      const auth = B("mt_ex", "mt-KgA1-26");
      await srv.req("PUT", "/api/progress", { auth, body: { v: 2, updatedAt: new Date().toISOString(),
        modules: { m12: { vocab: { m12_01: { box: 2, streak: 1, due: Date.now() } }, test: {} } } } });
      assert.strictEqual((await srv.req("PUT", "/api/students", { auth: ALT, body: { login: "mt_ex", courses: ["a1"] } })).status, 200);
      const t = trailFor(await page(auth), await me(auth));
      assert.strictEqual(t.myCourses().join(), "a1", "тропа — только выданный курс");
      assert.ok(t.isRevoked("m12"), "живой result_only распознан клиентским isRevoked");
      assert.ok(!t.studyOpen("m12"), "занятия по отнятому закрыты");
      assert.strictEqual(t.startModule(), "m0", "старт — в своём курсе");
    }

    /* 4. Возврат к пройденному модулю не закрывает следующий (жалоба преподавателя 21.08.2026).
       Сценарий: ученик сдал m1, потом вернулся в m0 повторять слова — и прислал прогресс,
       в котором m1 нет (второе устройство, вкладка со старым состоянием, гонка pull).
       Сервер писал файл как есть, отметка о сдаче исчезала, m1 снова требовал теста,
       а m2 запирался. Сдача и выученные слова обязаны переживать такую отправку. */
    {
      const auth = B("mt_a1", "mt-KgA1-26");
      const passedM1 = { v: 2, updatedAt: "2026-08-21T10:00:00Z", modules: {
        m0: { vocab: { m0_01: { box: 3, streak: 2, due: 1 } }, test: { everPassed: true, lastAttempt: { score: 18, passed: true }, attempts: [{ score: 18 }] } },
        m1: { vocab: { m1_01: { box: 4, streak: 3, due: 1 } }, test: { everPassed: true, lastAttempt: { score: 19, passed: true }, attempts: [{ score: 19 }] } } } };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: passedM1 })).status, 200);
      {
        const t = trailFor(await page(auth), await me(auth));
        assert.ok(t.studyOpen("m1") && t.studyOpen("m2"), "после сдачи m1 открыт следующий модуль");
      }
      // возврат в m0: клиент прислал состояние без m1 и с одним новым словом m0
      const backToM0 = { v: 2, updatedAt: "2026-08-21T12:00:00Z", modules: {
        m0: { vocab: { m0_02: { box: 1, streak: 1, due: 1 } }, test: { everPassed: true, lastAttempt: { score: 18, passed: true }, attempts: [{ score: 18 }] } } } };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: backToM0 })).status, 200);

      const saved = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text);
      assert.ok(saved.modules.m1 && saved.modules.m1.test && saved.modules.m1.test.everPassed,
        "сдача m1 пережила отправку прогресса без m1");
      assert.ok(saved.modules.m1.vocab.m1_01, "и выученные слова m1 не потеряны");
      assert.ok(saved.modules.m0.vocab.m0_01 && saved.modules.m0.vocab.m0_02,
        "слова m0: и прежние, и новое");
      const st2 = JSON.parse((await srv.req("GET", "/api/me", { auth })).text);
      const stat = (id) => (st2.modules.find((x) => x.id === id) || {}).status;
      assert.strictEqual(stat("m1"), "passed", "m1 остаётся сданным");
      assert.strictEqual(stat("m2"), "open", "и m2 не запирается обратно");
      const t2 = trailFor(await page(auth), st2);
      assert.ok(t2.studyOpen("m1") && t2.studyOpen("m2"), "клиентская тропа тоже не схлопнулась");

      // но осознанный сброс модуля учеником обязан срабатывать: он помечен отметкой времени
      const withReset = { v: 2, updatedAt: "2026-08-21T13:00:00Z", modules: Object.assign({}, saved.modules, {
        m1: { vocab: {}, test: null, reset: "2026-08-21T13:00:00Z" } }) };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: withReset })).status, 200);
      const afterReset = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text);
      assert.ok(!afterReset.modules.m1.test, "сброс модуля учеником действительно стирает сдачу");
      assert.deepStrictEqual(afterReset.modules.m1.vocab, {}, "и слова модуля");
      assert.strictEqual(afterReset.modules.m0.vocab.m0_01.box, 3, "соседний модуль сбросом не задет");

      // повторная отправка того же состояния (тот же reset) не должна отключать защиту:
      // сдача m0 обязана пережить отправку, где m0 внезапно пропал
      const lostM0 = { v: 2, updatedAt: "2026-08-21T14:00:00Z", modules: { m1: afterReset.modules.m1 } };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: lostM0 })).status, 200);
      const final = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text);
      assert.ok(final.modules.m0 && final.modules.m0.test.everPassed, "сдача m0 пережила потерю модуля");
      assert.ok(!final.modules.m1.test, "а сброшенный m1 не воскрес повторной отправкой");

      // Второе устройство сброса не видело (не было pull): его m1 — прежний, со сдачей и
      // словами, без отметки сброса. Раньше слияние брало его за основу, и сброс молча
      // откатывался (ревью 25.09.2026). Копия, старшая сброса, по этому модулю не принимается.
      const staleB = { v: 2, updatedAt: "2026-08-21T15:00:00Z", modules: Object.assign({}, final.modules, {
        m1: { vocab: { m1_01: { box: 4, streak: 3, due: 1 } }, test: { everPassed: true, lastAttempt: { score: 19, passed: true }, attempts: [{ score: 19 }] } } }) };
      const rStale = await srv.req("PUT", "/api/progress", { auth, body: staleB });
      assert.strictEqual(rStale.status, 200);
      assert.strictEqual(JSON.parse(rStale.text).restored, true, "устройству сказано забрать серверную копию");
      const afterStale = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text);
      assert.ok(!afterStale.modules.m1.test, "сброс m1 не откатился устаревшим устройством");
      assert.deepStrictEqual(afterStale.modules.m1.vocab, {}, "и старые слова m1 не вернулись");
      assert.ok(afterStale.modules.m0.test.everPassed, "соседний модуль с устройства B принят как обычно");
      // устройство, которое сброс уже видело (pull принёс resetAt), занимается дальше — принимается
      const knowsReset = { v: 2, updatedAt: "2026-08-21T16:00:00Z", modules: Object.assign({}, afterStale.modules, {
        m1: Object.assign({}, afterStale.modules.m1, { vocab: { m1_02: { box: 1, streak: 1, due: 1 } } }) }) };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: knowsReset })).status, 200);
      const afterNew = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text);
      assert.ok(afterNew.modules.m1.vocab.m1_02, "занятия после сброса сохраняются");

      // История пробного экзамена сливается, а не заменяется: две попытки на разных устройствах
      // (одно было офлайн) обе остаются — «прогресс не убывает» (ревью PR #237)
      const att = (date, pct) => ({ subs: ["lexgram"], pct, right: pct, total: 100, date, course: "a1" });
      const withExam = (upd, attempts) => ({ v: 2, updatedAt: upd, modules: afterNew.modules,
        exam: { last: Object.assign({ byMod: {} }, attempts[attempts.length - 1]), attempts } });
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: withExam("2026-08-22T10:00:00Z", [att("2026-08-20", 40), att("2026-08-22", 70)]) })).status, 200);
      const rEx = await srv.req("PUT", "/api/progress", { auth, body: withExam("2026-08-22T11:00:00Z", [att("2026-08-20", 40), att("2026-08-21", 55)]) });
      assert.strictEqual(JSON.parse(rEx.text).restored, true, "устройству сказано забрать слитую историю");
      const ex = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text).exam;
      assert.deepStrictEqual(ex.attempts.map((a) => a.date + ":" + a.pct), ["2026-08-20:40", "2026-08-21:55", "2026-08-22:70"],
        "обе попытки сохранены, без дублей, по дате");
      assert.strictEqual(ex.last.date, "2026-08-22", "последняя попытка — самая поздняя из обеих копий");

      // Метка сброса из будущего (часы устройства убежали вперёд) не блокирует сбросы навсегда
      const future = { v: 2, updatedAt: "2026-08-22T12:00:00Z", modules: Object.assign({}, afterNew.modules, {
        m1: { vocab: {}, test: null, reset: "2099-01-01T00:00:00.000Z" } }) };
      assert.strictEqual((await srv.req("PUT", "/api/progress", { auth, body: future })).status, 200);
      const fr = JSON.parse((await srv.req("GET", "/api/progress", { auth })).text).modules.m1.resetAt;
      assert.ok(Date.parse(fr) <= Date.now() + 1000, "метка сброса не позже часов сервера: " + fr);
    }

    console.log("me-trail.test.js: OK (живой /api/me исполнен живым ===TRAIL=== ученика: a1, a2 без a1, отъём, возврат к пройденному, сброс против устаревшего устройства)");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await srv.stop();
  }
})();
