"use strict";
/* Тест гейтинга зачётного мини-теста: в тест входят только вычитанные фразы.
   Логика лежит в собранной странице между маркерами ===QUIZLOGIC=== и валидируется без DOM. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");

const sb = loadBlock("QUIZLOGIC", { expose: ["reviewedOk", "quizPool", "quizReady", "QUIZ_MIN_REVIEWED"] });
const { reviewedOk, quizPool, quizReady, QUIZ_MIN_REVIEWED } = sb;

// reviewedOk: только статусы ok/fixed; question/пусто/нет записи — не вычитано
const review = {
  a1: { status: "ok" }, a2: { status: "fixed" },
  a3: { status: "question" }, a4: {}, a5: { status: "todo" }
};
assert.strictEqual(reviewedOk(review, "a1"), true, "ok — вычитано");
assert.strictEqual(reviewedOk(review, "a2"), true, "fixed — вычитано");
assert.strictEqual(reviewedOk(review, "a3"), false, "question — не вычитано");
assert.strictEqual(reviewedOk(review, "a4"), false, "без статуса — не вычитано");
assert.strictEqual(reviewedOk(review, "a5"), false, "неизвестный статус — не вычитано");
assert.strictEqual(reviewedOk(review, "nope"), false, "нет записи — не вычитано");

// quizPool: фильтрует словарь по вычитанности
const vocab = [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "nope" }];
assert.strictEqual(JSON.stringify(quizPool(vocab, review).map(c => c.id)), '["a1","a2"]', "в пул попадают только ok/fixed");
assert.strictEqual(quizPool([], review).length, 0, "пустой словарь — пустой пул");

// quizReady: порог по количеству вычитанных
assert.ok(Number.isInteger(QUIZ_MIN_REVIEWED) && QUIZ_MIN_REVIEWED >= 14,
  "порог ≥14 (8 узнавание + 6 ввод в билете): " + QUIZ_MIN_REVIEWED);
const mk = (n, extra) => {
  const v = [], r = {};
  for (let i = 0; i < n + (extra || 0); i++) {
    v.push({ id: "x" + i });
    if (i < n) r["x" + i] = { status: "ok" };
  }
  return { v, r };
};
{
  const { v, r } = mk(QUIZ_MIN_REVIEWED, 5);
  assert.strictEqual(quizReady(v, r), true, "ровно порог — тест доступен");
}
{
  const { v, r } = mk(QUIZ_MIN_REVIEWED - 1, 5);
  assert.strictEqual(quizReady(v, r), false, "ниже порога — тест закрыт");
}
assert.strictEqual(quizReady([], {}), false, "нет контента — тест закрыт");

// реюз: замок — по СВОИМ словам, билет — по всем («замок — свои, билет — все»)
{
  // своих вычитано мало, зато reuse-слов вычитано с запасом — тест НЕ открывается раньше времени
  const v = [], r = {};
  for (let i = 0; i < QUIZ_MIN_REVIEWED - 1; i++) { v.push({ id: "o" + i }); r["o" + i] = { status: "ok" }; }
  for (let i = 0; i < QUIZ_MIN_REVIEWED + 10; i++) { v.push({ id: "u" + i, reuse: true }); r["u" + i] = { status: "ok" }; }
  assert.strictEqual(quizReady(v, r), false, "вычитанный reuse не открывает замок вместо своих слов");
  assert.strictEqual(quizPool(v, r).length, (QUIZ_MIN_REVIEWED - 1) + (QUIZ_MIN_REVIEWED + 10),
    "в билетный пул reuse-слова входят");
  r["o" + 0] = r["o" + 0]; v.push({ id: "oLast" }); r["oLast"] = { status: "ok" };
  assert.strictEqual(quizReady(v, r), true, "порог по своим добит — тест открыт");
}
{
  // модуль без своих слов (М10/М11): гейт по reuse
  const v = [], r = {};
  for (let i = 0; i < QUIZ_MIN_REVIEWED; i++) { v.push({ id: "u" + i, reuse: true }); r["u" + i] = { status: "ok" }; }
  assert.strictEqual(quizReady(v, r), true, "чистый reuse-модуль гейтится по reuse");
}

// зачётный старт обязан использовать quizPool: в самом Test.start нет прямого shuffle(VOCAB)
const startBody = html.match(/start\(\)\{([\s\S]*?)\n  \},/);
assert.ok(startBody && !/shuffle\(VOCAB\)\.slice\(0,8\)/.test(startBody[1]),
  "Test.start больше не берёт вопросы из невычитанного VOCAB напрямую");

console.log("quiz.test.js: OK (гейтинг мини-теста по вычитке, порог " + QUIZ_MIN_REVIEWED + ")");
