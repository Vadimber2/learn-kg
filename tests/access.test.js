"use strict";
/* Меню «Доступ» карточки ученика: построители PUT-нагрузки между маркерами
   ===ACCESS=== проверяются без DOM (тот же приём, что stats.test.js). */
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

const sb = loadBlock("ACCESS", {
  expose: ["accCourses", "accStatus", "accGrantCourse", "accRevokeCourse", "accOpenAll", "accResetManual",
    "accTrialSet", "accTrialRemove", "accTrialActive", "accTrialDate"],
});
// результаты из vm-realm нормализуются JSON-раундтрипом: их Array.prototype чужой,
// и deepStrictEqual завалил бы сравнение идентичных данных (та же грабля, что в server.test.js)
const plain = (v) => (v === null ? null : JSON.parse(JSON.stringify(v)));
const wrap = (f) => (...a) => plain(f(...a));
const accCourses = wrap(sb.accCourses), accGrantCourse = wrap(sb.accGrantCourse),
  accRevokeCourse = wrap(sb.accRevokeCourse), accOpenAll = wrap(sb.accOpenAll),
  accResetManual = wrap(sb.accResetManual), accStatus = sb.accStatus,
  accTrialSet = wrap(sb.accTrialSet), accTrialRemove = wrap(sb.accTrialRemove),
  accTrialActive = sb.accTrialActive, accTrialDate = sb.accTrialDate;

const META = [
  { id: "m0", course: "a1" }, { id: "m1", course: "a1" }, { id: "m2", course: "a1" },
  { id: "m12", course: "a2" }, { id: "m13", course: "a2" }, { id: "m24", course: "b1" },
];
const mods = (st) => Object.entries(st).map(([id, status]) => ({ id, status }));

// --- accCourses: дефолт ["a1"] у легаси-строк без поля ---
assert.deepStrictEqual(accCourses({}), ["a1"], "нет поля — a1");
assert.deepStrictEqual(accCourses({ courses: [] }), ["a1"], "пустой список — a1");
assert.deepStrictEqual(accCourses({ courses: ["a2"] }), ["a2"], "явный список — как есть");

// --- accGrantCourse / accRevokeCourse ---
assert.deepStrictEqual(accGrantCourse({ courses: ["a1"] }, "a2"), { courses: ["a1", "a2"] }, "выдача добавляет курс");
assert.strictEqual(accGrantCourse({ courses: ["a1", "a2"] }, "a2"), null, "повторная выдача недоступна");
assert.deepStrictEqual(accRevokeCourse({ courses: ["a1", "a2"] }, "a2"), { courses: ["a1"] }, "отзыв убирает курс");
assert.strictEqual(accRevokeCourse({ courses: ["a1"] }, "a1"), null, "единственный курс не забрать");
assert.strictEqual(accRevokeCourse({ courses: ["a1"] }, "a2"), null, "не выдан — забирать нечего");

// --- accOpenAll: сданные не трогаем, locked чистится только у своего курса ---
{
  const s = { courses: ["a1", "a2"], granted: ["m12"], locked: ["m2", "m13"],
    modules: mods({ m0: "passed", m1: "open", m2: "locked_by_teacher", m12: "open", m13: "locked_by_teacher" }) };
  const p = accOpenAll(s, "a1", META);
  assert.deepStrictEqual(p.granted.sort(), ["m1", "m12", "m2"], "granted: несданные a1 + прежние записи, без сданного m0");
  assert.deepStrictEqual(p.locked, ["m13"], "locked: снят только m2 (a1), чужой m13 не тронут");
}
assert.strictEqual(
  accOpenAll({ courses: ["a1"], modules: mods({ m0: "passed", m1: "open", m2: "open" }) }, "a1", META),
  null, "всё уже доступно — открывать нечего");

// --- accResetManual: снимает ручные правки только своего курса ---
{
  const s = { courses: ["a1", "a2"], granted: ["m2", "m13"], locked: ["m1"] };
  assert.deepStrictEqual(accResetManual(s, "a1", META), { granted: ["m13"], locked: [] },
    "сняты granted/locked модулей a1, granted чужого курса цел");
  assert.deepStrictEqual(accResetManual(s, "a2", META), { granted: ["m2"], locked: ["m1"] },
    "для a2 снят только m13");
}
assert.strictEqual(accResetManual({ courses: ["a1"], granted: [], locked: [] }, "a1", META), null,
  "ручных правок нет — сбрасывать нечего");

// --- accStatus: статус из тропы, дефолт locked ---
assert.strictEqual(accStatus({ modules: mods({ m1: "open" }) }, "m1"), "open");
assert.strictEqual(accStatus({}, "m9"), "locked", "модуля нет в тропе — считается закрытым");

// --- Триалы: набор/снятие, активность по дате, пресеты от «сегодня» ---
{
  const s = { courses: ["a1"], trials: { a2: "2026-09-01" } };
  assert.deepStrictEqual(accTrialSet(s, "m7", null), { trials: { a2: "2026-09-01", m7: null } },
    "новый триал добавляется, прежние не трогаются");
  assert.deepStrictEqual(accTrialSet(s, "a2", "2026-10-01"), { trials: { a2: "2026-10-01" } },
    "продление перезаписывает дату того же id");
  assert.deepStrictEqual(accTrialRemove(s, "a2"), { trials: {} }, "снятие триала");
  assert.strictEqual(accTrialRemove(s, "m9"), null, "снимать нечего — действие недоступно");
  assert.strictEqual(accTrialRemove({ courses: ["a1"] }, "a2"), null, "без trials вовсе — null");
}
{
  // активность: до конца дня даты ВКЛЮЧИТЕЛЬНО по Бишкеку (+06), null — бессрочно
  const noonBishkek = Date.parse("2026-09-01T12:00:00+06:00");
  assert.strictEqual(accTrialActive("2026-09-01", noonBishkek), true, "день даты ещё активен");
  assert.strictEqual(accTrialActive("2026-09-01", Date.parse("2026-09-01T23:59:59+06:00")), true, "активен до последней секунды");
  assert.strictEqual(accTrialActive("2026-09-01", Date.parse("2026-09-02T00:00:01+06:00")), false, "следующий день — истёк");
  assert.strictEqual(accTrialActive(null, noonBishkek), true, "null — без ограничения срока");
}
{
  // полдень UTC: дата одинакова в любом поясе от UTC-11 до UTC+11 — тест детерминирован
  const from = "2026-08-18T12:00:00Z";
  assert.strictEqual(accTrialDate(7, from), "2026-08-25", "неделя");
  assert.strictEqual(accTrialDate(14, from), "2026-09-01", "две недели (переход месяца)");
  assert.strictEqual(accTrialDate(30, from), "2026-09-17", "месяц");
}

console.log("access.test.js: OK (курсы: выдача/отзыв, пакетное открытие, сброс на авто-тропу; триалы: набор/срок/активность)");
