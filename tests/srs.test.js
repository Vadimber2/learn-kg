"use strict";
/* Тест интервального повторения: блок ===SRS=== исполняется без DOM на подставном ST.
   Стережёт два правила, которые легко потерять правкой соседнего кода:
   слово, сбитое ошибкой в бокс 0, остаётся в обороте и в очереди повторений,
   а уровень растёт только по отлежавшему интервалу — не за одну посадку. */
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

const DAY = 86400000;
function ctx() {
  return loadBlock("SRS", {
    scheduleDays: true,
    sandbox: { console, ST: { modules: {} }, save() {}, freshModule: () => ({ vocab: {}, test: {} }),
      homeOf: (id) => id.split("_")[0] },
    expose: ["grade", "setKnown", "isNew", "isDue", "isFixing", "isMastered", "cardState", "recOf",
      "isSkipped", "toggleSkipped", "notSkipped", "MASTERY_BOX", "SCHEDULE_DAYS"],
  });
}

/* 1. Нетронутое слово — новое, но не «исправляется» и не ждёт повторения */
{
  const s = ctx();
  assert.ok(s.isNew("m0_01"), "без записи слово новое");
  assert.ok(!s.isFixing("m0_01") && !s.isDue("m0_01"), "новое слово не в очереди повторений");
}

/* 2. Ошибка: слово падает в бокс 0, но остаётся В ОБОРОТЕ и сразу ждёт повторения.
   Прежде такое слово снова считалось новым и выпадало из очереди (isDue требовал box>0). */
{
  const s = ctx();
  s.grade("m0_01", true);
  s.grade("m0_01", false);
  assert.strictEqual(s.cardState("m0_01").box, 0, "ошибка опускает бокс");
  assert.ok(!s.isNew("m0_01"), "сбитое слово не новое — оно исправляется");
  assert.ok(s.isFixing("m0_01"), "isFixing различает сбитое слово");
  assert.ok(s.isDue("m0_01"), "сбитое слово сразу в очереди повторений");
}

/* 3. Уровень растёт только по отлежавшему интервалу: три верных ответа подряд
   в одной посадке больше не проводят слово в «закреплено». */
{
  const s = ctx();
  s.grade("m0_01", true);
  assert.strictEqual(s.cardState("m0_01").box, 1, "первый верный ввод нового слова: бокс 1");
  const due1 = s.cardState("m0_01").due;
  s.grade("m0_01", true);
  s.grade("m0_01", true);
  assert.strictEqual(s.cardState("m0_01").box, 1, "вне интервала уровень стоит");
  assert.strictEqual(s.cardState("m0_01").due, due1, "вне интервала срок не сдвигается");
  assert.strictEqual(s.cardState("m0_01").streak, 3, "но практика считается серией");
  assert.ok(!s.isMastered("m0_01"), "за одну посадку слово не закрепляется");
}

/* 4. Отлежавший интервал — уровень растёт; полная лестница до закрепления */
{
  const s = ctx();
  for (let i = 0; i < 3; i++) {
    s.grade("m0_01", true);
    s.recOf("m0_01").due = Date.now() - 1; // интервал отлежал
  }
  assert.strictEqual(s.cardState("m0_01").box, 3, "три интервала — бокс 3");
  s.grade("m0_01", true);
  assert.strictEqual(s.cardState("m0_01").box, 4, "четвёртый — подтверждение с интервалом 16 дней");
  assert.ok(s.isMastered("m0_01"), "закреплено");
}

/* 5. Внутрисессионное исправление разрешено: слово, сбитое ошибкой, due=now,
   поэтому верный ответ в той же сессии честно поднимает его обратно в бокс 1. */
{
  const s = ctx();
  s.grade("m0_01", true);
  s.grade("m0_01", false);
  s.grade("m0_01", true);
  assert.strictEqual(s.cardState("m0_01").box, 1, "исправление в сессии поднимает бокс");
}

/* 6. «Уже знаю»: закреплено сразу, но подтверждение — через неделю, а не через 16 дней */
{
  const s = ctx();
  s.setKnown("m0_01");
  const cs = s.cardState("m0_01");
  assert.strictEqual(cs.box, s.MASTERY_BOX, "слово в боксе закрепления");
  assert.ok(s.isMastered("m0_01"), "isMastered сразу");
  assert.ok(!s.isNew("m0_01") && !s.isDue("m0_01"), "из новых ушло, сегодня не спрашивается");
  const days = Math.round((cs.due - Date.now()) / DAY);
  assert.strictEqual(days, s.SCHEDULE_DAYS[s.MASTERY_BOX - 1], "подтверждение через 7 дней");
  // самооценка проверяется вводом: ошибка деградирует слово обычным порядком
  s.grade("m0_01", false);
  assert.strictEqual(s.cardState("m0_01").box, s.MASTERY_BOX - 1, "ошибка опускает на ступень");
  assert.ok(!s.isMastered("m0_01") && s.isDue("m0_01"), "закрепление снято, слово ждёт повторения");
}

/* 7. «Отложить»: обратимый глобальный список, исключающий слово из выборок */
{
  const s = ctx();
  assert.ok(!s.isSkipped("m0_01"), "по умолчанию ничего не отложено");
  s.toggleSkipped("m0_01");
  assert.ok(s.isSkipped("m0_01"), "слово отложено");
  assert.strictEqual(s.notSkipped([{ id: "m0_01" }, { id: "m0_02" }]).map((c) => c.id).join(), "m0_02",
    "notSkipped убирает отложенные из выборки");
  s.toggleSkipped("m0_01");
  assert.ok(!s.isSkipped("m0_01"), "возврат в колоду");
  assert.strictEqual(s.ST.skip.length, 0, "список пуст после возврата");
}

/* 8. Прогресс переиспользованного слова един: бакет — родного модуля, не активного */
{
  const s = ctx();
  s.grade("m1_136", true);
  assert.ok(s.ST.modules.m1.vocab.m1_136, "запись легла в бакет родного модуля");
  assert.deepStrictEqual(Object.keys(s.ST.modules), ["m1"], "чужих бакетов не появилось");
}

console.log("srs.test.js: OK (исправляется/новое, уровень только по интервалу, «уже знаю», «отложить»)");
