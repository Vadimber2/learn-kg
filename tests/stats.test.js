"use strict";
/* Чистая логика журнала занятий: dayKeyOf/streakOf/weeksOf/flagsOf/groupBySession лежат
   между маркерами ===STATS=== и проверяются без DOM (тот же приём, что и weekplan.test.js). */
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

const sb = loadBlock("STATS", {
  expose: ["dayKeyOf", "streakOf", "weeksOf", "isoWeekKeyOf", "flagsOf", "groupBySession",
    "rosterSubset", "attentionQueue", "nudgeText", "finishForecast", "consultSignal"],
});
const { dayKeyOf, streakOf, weeksOf, isoWeekKeyOf, flagsOf, groupBySession, rosterSubset, attentionQueue, nudgeText, finishForecast } = sb;
// vm-realm: у объектов чужой прототип — нормализуем JSON-раундтрипом (как в access.test.js)
const consultSignal = (...args) => { const r = sb.consultSignal(...args); return r === null ? null : JSON.parse(JSON.stringify(r)); };

// --- dayKeyOf: день считается по времени Бишкека (UTC+6), не UTC ---
assert.strictEqual(dayKeyOf("2026-08-04T17:59:00Z"), "2026-08-04", "23:59 по Бишкеку — ещё тот же день");
assert.strictEqual(dayKeyOf("2026-08-04T18:01:00Z"), "2026-08-05", "00:01 по Бишкеку — уже следующий");
assert.strictEqual(dayKeyOf("2026-08-04T00:00:00Z"), "2026-08-04", "полночь UTC — 06:00 Бишкек, тот же день");

// --- streakOf: серия дней подряд ---
{
  const days = { "2026-08-01": { ans: 3 }, "2026-08-02": { ans: 1 }, "2026-08-03": { ans: 2 } };
  const r = streakOf(days, "2026-08-04");
  assert.strictEqual(r.current, 3, "сегодня ещё не занимался — серия не рвётся, считает Aug1-3");
  assert.strictEqual(r.best, 3, "лучшая серия совпадает с текущей");
  assert.strictEqual(r.activeToday, false, "сегодня активности нет");
}
{
  const days = { "2026-08-01": { ans: 3 }, "2026-08-02": { ans: 1 }, "2026-08-04": { ans: 2 } };
  const r = streakOf(days, "2026-08-04");
  assert.strictEqual(r.current, 1, "разрыв на Aug3 обрывает серию до одного дня (сегодня)");
  assert.strictEqual(r.best, 2, "лучшая серия — Aug1-2, до разрыва");
  assert.strictEqual(r.activeToday, true, "сегодня есть активность");
}
{
  const r = streakOf({}, "2026-08-04");
  assert.strictEqual(r.current, 0, "пустая история — серии нет");
  assert.strictEqual(r.best, 0);
  assert.strictEqual(r.activeToday, false);
}
{
  // ans:0 (например, только session.start без ответов) — не считается активным днём
  const days = { "2026-08-03": { ans: 0 }, "2026-08-04": { ans: 1 } };
  const r = streakOf(days, "2026-08-04");
  assert.strictEqual(r.current, 1, "день без ответов в серию не входит");
}

// --- isoWeekKeyOf / weeksOf ---
assert.strictEqual(isoWeekKeyOf("2026-08-04"), "2026-08-03", "вторник → понедельник той же недели");
assert.strictEqual(isoWeekKeyOf("2026-08-03"), "2026-08-03", "сам понедельник — ключ своей недели");
{
  const days = {
    "2026-07-27": { ans: 10, ok: 8, ms: 60000 }, // неделя A (пн 2026-07-27)
    "2026-07-28": { ans: 5, ok: 5, ms: 30000 },  // та же неделя A
    "2026-08-03": { ans: 4, ok: 2, ms: 20000 }   // неделя B (пн 2026-08-03), с разрывом недели между
  };
  const weeks = weeksOf(days, 8);
  assert.strictEqual(weeks.length, 2, "недель без данных не создаём — только 2 непустые");
  assert.strictEqual(weeks[0].w, "2026-07-27");
  assert.strictEqual(weeks[0].answers, 15, "сумма ответов за неделю A");
  assert.strictEqual(weeks[0].acc, 13 / 15, "точность = ok/ans");
  assert.strictEqual(weeks[0].minutes, Math.round(90000 / 60000));
  assert.strictEqual(weeks[1].w, "2026-08-03");
  assert.strictEqual(weeks[1].acc, 0.5);
  // отдаёт последние n, отсортированные по возрастанию недели
  // ([...] — массив из vm-песочницы кросс-реалменный, deepStrictEqual с литералом основного
  // контекста иначе падает на несовпадении прототипов при равном содержимом)
  assert.deepStrictEqual([...weeksOf(days, 1).map((w) => w.w)], ["2026-08-03"], "n=1 — только последняя неделя");
}
{
  const weeks = weeksOf({ "2026-08-03": { ans: 0, ok: 0, ms: 5000 } }, 4);
  assert.strictEqual(weeks[0].acc, null, "точность null, если за неделю не было ответов (только время)");
}

// --- flagsOf: сигналы дашборда учителя ---
const NOW = Date.parse("2026-08-04T12:00:00Z");
{
  // Отдельный сигнал: «не заходил {n} дн.» с пустым n давало бессмысленное «не заходил — дн.»
  const flags = flagsOf({ lastSeen: null, streak: 0, testFails2: false }, NOW);
  assert.ok(flags.some((f) => f.key === "never"), "нет lastSeen — сигнал «ни разу не заходил», а не idle с пустым числом");
  assert.ok(!flags.some((f) => f.key === "idle"), "idle не выдаётся без числа дней");
  for (const f of flags) assert.ok(f.n === undefined || typeof f.n === "number", "у сигнала либо число, либо ничего: " + JSON.stringify(f));
}
{
  const flags = flagsOf({ lastSeen: "2026-08-01T12:00:00Z", streak: 0, testFails2: false }, NOW);
  assert.ok(!flags.some((f) => f.key === "idle"), "3 дня — порог >=4, сигнала ещё нет");
}
{
  const flags = flagsOf({ lastSeen: "2026-07-31T12:00:00Z", streak: 0, testFails2: false }, NOW);
  assert.ok(flags.some((f) => f.key === "idle" && f.n === 4), "4 дня — уже сигнал (граница снизу)");
}
{
  const flags = flagsOf({ lastSeen: "2026-08-03T12:00:00Z", streak: 0, testFails2: false }, NOW);
  assert.ok(!flags.some((f) => f.key === "idle"), "1 день — сигнала нет");
}
{
  const flags = flagsOf({ lastSeen: "2026-08-04T11:00:00Z", streak: 0, testFails2: true }, NOW);
  assert.ok(flags.some((f) => f.key === "fail2"), "два провала подряд — сигнал есть");
}
{
  const flags6 = flagsOf({ lastSeen: "2026-08-04T11:00:00Z", streak: 6, testFails2: false }, NOW);
  assert.ok(!flags6.some((f) => f.key === "streak"), "серия 6 — ещё не позитивный сигнал");
  const flags7 = flagsOf({ lastSeen: "2026-08-04T11:00:00Z", streak: 7, testFails2: false }, NOW);
  assert.ok(flags7.some((f) => f.key === "streak" && f.n === 7), "серия 7 — позитивный сигнал");
}
{
  const flags = flagsOf({ lastSeen: "2026-08-04T11:00:00Z", streak: 7, testFails2: false }, NOW);
  assert.strictEqual(flags.length, 1, "активный ученик без провалов — только позитивный сигнал, шума нет");
}

// --- groupBySession: лента событий → сессии для заголовков ---
{
  const events = [
    { sid: "s1", ts: "2026-08-04T09:00:00Z", type: "session.start" },
    { sid: "s1", ts: "2026-08-04T09:01:00Z", type: "card.answer", ok: true },
    { sid: "s1", ts: "2026-08-04T09:02:00Z", type: "card.answer", ok: false },
    { sid: "s2", ts: "2026-08-04T18:00:00Z", type: "test.answer", ok: true },
  ];
  const sessions = groupBySession(events);
  assert.strictEqual(sessions.length, 2, "две сессии по двум sid");
  assert.strictEqual(sessions[0].sid, "s1", "порядок — по первому появлению sid");
  assert.strictEqual(sessions[0].items.length, 3);
  assert.strictEqual(sessions[0].ans, 2, "session.start в счёт ответов не входит");
  assert.strictEqual(sessions[0].ok, 1);
  assert.strictEqual(sessions[0].start, "2026-08-04T09:00:00Z");
  assert.strictEqual(sessions[0].end, "2026-08-04T09:02:00Z");
  assert.strictEqual(sessions[1].sid, "s2");
  assert.strictEqual(sessions[1].ans, 1);
}
{
  const sessions = groupBySession([{ ts: "2026-08-04T09:00:00Z", type: "session.start" }]);
  assert.strictEqual(sessions[0].sid, "-", "событие без sid группируется отдельным ключом, не падает");
}
assert.strictEqual(groupBySession([]).length, 0, "пустая лента — пустой список сессий");

// --- rosterSubset: за каждым числом сводки стоит именно тот список, который откроет панель ---
{
  const now = Date.parse("2026-08-07T12:00:00Z"), today = dayKeyOf("2026-08-07T12:00:00Z");
  const mk = (login, lastSeen, extra) => Object.assign({ login, lastSeen, streak: 0, testFails2: false }, extra || {});
  const rows = [
    mk("segodnya", "2026-08-07T09:00:00Z"),
    mk("vchera", "2026-08-06T09:00:00Z"),
    mk("davno", "2026-07-20T09:00:00Z"),
    mk("nikogda", null),
    mk("proval", "2026-08-07T08:00:00Z", { testFails2: true }),
  ].map((r) => Object.assign({ flags: flagsOf(r, now) }, r));
  const names = (kind) => rosterSubset(rows, kind, now, today).map((r) => r.login).sort();
  assert.deepStrictEqual(names("today"), ["proval", "segodnya"], "сегодня — только заходившие сегодня");
  assert.deepStrictEqual(names("week"), ["proval", "segodnya", "vchera"], "неделя — за последние 7 суток");
  assert.deepStrictEqual(names("attention"), ["davno", "nikogda", "proval"], "внимание — давно не заходил, ни разу и провал теста");
  assert.strictEqual(rosterSubset(rows, "today", now, today).length + rosterSubset(rows, "week", now, today).length > 0, true);
  // числа в сводке и длины списков — одно и то же вычисление, расхождение невозможно
  assert.strictEqual(names("week").length >= names("today").length, true, "недельный список включает сегодняшний");
}

// --- очередь внимания: тревога сильнее похвалы, шаблон — по старшему сигналу ---
{
  const rows = [
    { login: "a", flags: [{ key: "idle", n: 6 }] },
    { login: "b", flags: [{ key: "streak", n: 9 }] },
    { login: "c", flags: [{ key: "fail2" }, { key: "streak", n: 8 }] },
    { login: "d", flags: [] },
  ];
  const q = attentionQueue(rows);
  assert.deepStrictEqual(q.need.map((r) => r.login), ["a", "c"], "в тревоге — idle и fail2");
  assert.deepStrictEqual(q.praise.map((r) => r.login), ["b"], "хвалим только без тревоги: c не дублируется");
  assert.ok(nudgeText(rows[2]).includes("мини-тест"), "fail2 приоритетнее серии в шаблоне");
  assert.ok(nudgeText(rows[0]).includes("6 дн."), "idle подставляет число дней");
  assert.ok(nudgeText(rows[1]).includes("9 дн."), "похвала за серию");
  assert.strictEqual(nudgeText(rows[3]), "", "без сигналов — пусто");
}

// --- прогноз финиша: регулярность ускоряет срок, тишина две недели гасит прогноз ---
{
  const daysAll = {}; // занимался все 14 дней
  for (let i = 1; i <= 14; i++) daysAll["2026-08-" + String(i).padStart(2, "0")] = { ans: 5 };
  assert.strictEqual(finishForecast(daysAll, "2026-08-14", 4), "2026-09-11", "полная регулярность: 4 модуля ≈ 28 дней");
  const daysHalf = { "2026-08-13": { ans: 3 }, "2026-08-11": { ans: 3 }, "2026-08-09": { ans: 3 } };
  const half = finishForecast(daysHalf, "2026-08-14", 4);
  assert.ok(half > "2026-09-11", "редкие занятия отодвигают срок: " + half);
  assert.strictEqual(finishForecast({}, "2026-08-14", 4), null, "две недели тишины — прогноза нет");
  assert.strictEqual(finishForecast(daysAll, "2026-08-14", 0), null, "всё сдано — прогноз не нужен");
}

// --- сигнал консультации: старшинство и гашение только разговорной карточки ---
{
  const base = { fails2Mod: null, ans7: 50, acc7: 0.9, mockMod: null, lastPassed: "m5", dismissed: null };
  assert.deepStrictEqual(consultSignal({ ...base, fails2Mod: "m3", mockMod: "m11" }), { kind: "fail2", mod: "m3" }, "двойной провал важнее всего");
  assert.deepStrictEqual(consultSignal({ ...base, acc7: 0.6, mockMod: "m11" }), { kind: "lowacc" }, "слабая точность важнее мока");
  assert.strictEqual(consultSignal({ ...base, acc7: 0.6, ans7: 10 }).kind, "talk", "мало ответов — по точности не судим");
  assert.deepStrictEqual(consultSignal({ ...base, mockMod: "m23" }), { kind: "mock", mod: "m23" }, "экзаменационная неделя зовёт на мок");
  assert.deepStrictEqual(consultSignal(base), { kind: "talk", mod: "m5" }, "по умолчанию — разговорная практика");
  assert.strictEqual(consultSignal({ ...base, dismissed: "m5" }), null, "скрытая разговорная не возвращается для того же модуля");
  assert.deepStrictEqual(consultSignal({ ...base, dismissed: "m4" }), { kind: "talk", mod: "m5" }, "новый сданный модуль воскрешает карточку");
}

/* --- ===GAMIF===: вехи с фиксацией, недельная цель, неделя против прошлой --- */
{
  const g = loadBlock(["STATS", "GAMIF"], {
    expose: ["badgesCommit", "weekActiveDays", "weekCompare", "deltaTxt", "WEEK_GOAL_DAYS"],
  });

  // badgesCommit: фиксация с датой, повторный вызов пуст, веха не отбирается
  {
    const map = {};
    const fresh = JSON.parse(JSON.stringify(g.badgesCommit(map, [["bd_100", true], ["bd_500", false]], "2026-08-19")));
    assert.deepStrictEqual(fresh, ["bd_100"], "свежезаработанная веха возвращается для журнала");
    assert.strictEqual(map.bd_100, "2026-08-19", "дата получения зафиксирована");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(g.badgesCommit(map, [["bd_100", true]], "2026-08-20"))), [],
      "повторный визит не выдаёт веху заново");
    assert.strictEqual(map.bd_100, "2026-08-19", "и не переписывает дату");
    // mastered просел ниже порога — заработанное остаётся (условие false, запись есть)
    assert.deepStrictEqual(JSON.parse(JSON.stringify(g.badgesCommit(map, [["bd_100", false]], "2026-08-21"))), []);
    assert.strictEqual(map.bd_100, "2026-08-19", "просевший счётчик не отбирает веху");
  }

  // weekActiveDays: календарная неделя пн–вс, соседние недели не считаются
  {
    // 2026-08-19 — среда; неделя 17.08 (пн) … 23.08 (вс)
    const days = { "2026-08-16": { ans: 5 }, "2026-08-17": { ans: 1 }, "2026-08-19": { ans: 2 },
      "2026-08-23": { ans: 1 }, "2026-08-24": { ans: 9 }, "2026-08-18": { ans: 0 } };
    assert.strictEqual(g.weekActiveDays(days, "2026-08-19"), 3, "пн+ср+вс; вс прошлой и пн следующей — вне; день с 0 ответов не активен");
    assert.strictEqual(g.WEEK_GOAL_DAYS, 5, "цель — пять дней (микроцикл §5.4)");
  }

  // weekCompare: дельты к прошлой календарной неделе; без прошлой — null
  {
    const days = {
      "2026-08-10": { ans: 10, ok: 8, ms: 600000 }, "2026-08-13": { ans: 10, ok: 6, ms: 600000 }, // прошлая: 20 отв, 70%, 20 мин
      "2026-08-17": { ans: 20, ok: 18, ms: 1800000 }, "2026-08-19": { ans: 10, ok: 9, ms: 600000 }, // эта: 30 отв, 90%, 40 мин
    };
    const c = JSON.parse(JSON.stringify(g.weekCompare(days, "2026-08-19")));
    assert.deepStrictEqual(c.cur, { has: true, ans: 30, acc: 90, min: 40 }, "эта неделя посчитана");
    assert.deepStrictEqual(c.prev, { has: true, ans: 20, acc: 70, min: 20 }, "прошлая посчитана");
    assert.strictEqual(c.dAns, 10); assert.strictEqual(c.dAcc, 20); assert.strictEqual(c.dMin, 20);
    assert.strictEqual(g.weekCompare({ "2026-08-19": { ans: 5, ok: 5, ms: 0 } }, "2026-08-19"), null,
      "первая неделя — сравнивать не с чем, null вместо упрёка нулями");
    // прошлая неделя была, эта пустая — сравнение честно показывает нули
    const idle = JSON.parse(JSON.stringify(g.weekCompare({ "2026-08-13": { ans: 4, ok: 2, ms: 60000 } }, "2026-08-19")));
    assert.deepStrictEqual([idle.cur.ans, idle.cur.acc, idle.dAns], [0, null, -4], "пустая текущая неделя — нули и отрицательная дельта");
  }

  // deltaTxt: знак виден всегда
  assert.strictEqual(g.deltaTxt(3), "+3");
  assert.strictEqual(g.deltaTxt(-2), "-2");
  assert.strictEqual(g.deltaTxt(0), "0");

  // связка с рендером: вехи проходят через фиксацию, свежие журналятся,
  // отображение — по ST.badges (не по живому условию); новые вехи в реестре
  const { html } = require("./helpers/block");
  assert.ok(/badgesCommit\(ST\.badges,BADGES\.map/.test(html), "рендер фиксирует вехи через badgesCommit");
  assert.ok(/evPush\("badge\.earn",\{badge:key\}\)/.test(html), "свежая веха уходит событием в журнал");
  assert.ok(/\["star","bd_1000w",gm\.mastered>=1000\]/.test(html), "веха 1000 фраз в реестре");
  assert.ok(/\["flame","bd_streak100",streak\.best>=100\]/.test(html), "веха серии 100 дней в реестре");
  for (const key of ["bd_1000w", "bd_streak100", "pg_week_ring", "pg_week_cmp"])
    assert.strictEqual((html.match(new RegExp(key + ':"', "g")) || []).length, 3, key + " в трёх словарях");
}

console.log("stats.test.js: OK (dayKeyOf, streakOf, weeksOf, flagsOf, rosterSubset, groupBySession, вехи и недели)");
