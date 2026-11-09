"use strict";
/* Тест решений ученика о слове: «уже знаю» и «отложить».
   Оба решения обязаны переживать перезаход (уезжают в прогресс и в журнал занятий)
   и быть видимыми преподавателю — иначе слово исчезает из колоды без следа. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");
const srv = require("./helpers/server-src").all; // весь server/*.js — переживает декомпозицию

/* 1. Кнопки стоят в шапке обеих фаз карточки и уводят решение в журнал */
const ks = html.match(/function knowSkipBtns\(id,onDone\)\{[\s\S]*?\n\}/);
assert.ok(ks, "knowSkipBtns найден");
assert.ok(/setKnown\(id\)/.test(ks[0]) && /card\.know/.test(ks[0]), "«уже знаю» закрепляет слово и пишет событие");
assert.ok(/toggleSkipped\(id\)/.test(ks[0]) && /card\.skip/.test(ks[0]), "«отложить» правит список и пишет событие");
assert.ok(/!isMastered\(id\)/.test(ks[0]), "у закреплённого слова кнопки «уже знаю» нет");
const cardHead = html.match(/cardHead\(c,mode\)\{[\s\S]*?\n {2}\},/);
assert.ok(cardHead && /knowSkipBtns\(c\.id,/.test(cardHead[0]), "кнопки решений — в общей шапке карточки");
assert.strictEqual((html.match(/this\.cardHead\(c,/g) || []).length, 2, "шапку строят обе фазы: узнавание и ввод");
assert.ok(/decided\(id,msg\)\{[\s\S]*?this\.queue=this\.queue\.filter\(q=>q\.c\.id!==id\)/.test(html),
  "решение убирает слово из очереди целиком (включая отложенный повтор внутри сессии)");

/* 2. Отложенное слово вычитается из знаменателей — проверяем исполнением, а не текстом:
   счётчики и прогресс-бар живут в том же блоке ===SRS===, что и сами списки. */
{
  const VOCAB = [{ id: "m0_01" }, { id: "m0_02" }, { id: "m0_03" }, { id: "m0_04" }];
  const sb = loadBlock("SRS", {
    scheduleDays: true,
    sandbox: { console, ST: { modules: {} }, VOCAB, save() {}, freshModule: () => ({ vocab: {}, test: {} }),
      homeOf: (id) => id.split("_")[0] },
    expose: ["grade", "setKnown", "toggleSkipped", "notSkipped", "masteredCount", "doneOnceCount", "progressScoreFor"],
  });

  sb.setKnown("m0_01");                       // закреплено
  sb.grade("m0_02", false);                   // исправляется
  assert.strictEqual(sb.masteredCount(), 1, "закреплённое слово посчитано");
  assert.strictEqual(sb.doneOnceCount(), 2, "в обороте оба тронутых слова");
  const scoreBefore = sb.progressScoreFor(VOCAB);

  sb.toggleSkipped("m0_01");                  // откладываем закреплённое
  assert.strictEqual(sb.masteredCount(), 0, "отложенное не считается закреплённым");
  assert.strictEqual(sb.doneOnceCount(), 1, "и уходит из «в обороте»");
  assert.strictEqual(sb.notSkipped(VOCAB).length, 3, "и из любой выборки слов");
  assert.notStrictEqual(sb.progressScoreFor(VOCAB), scoreBefore, "знаменатель прогресса пересчитан");

  sb.toggleSkipped("m0_01");
  assert.strictEqual(sb.masteredCount(), 1, "возврат в колоду восстанавливает счёт");
}
assert.ok(/skipped\+\+;continue;/.test(html), "globalMastery считает отложенные отдельной величиной");
assert.ok(/sp_skipped/.test(html) && /skip_return/.test(html), "панель «Отложенные» с возвратом слова");

/* 3. Решения переживают перезаход: список живёт в ST, а тот уезжает на сервер целиком */
{
  let saved = 0;
  const sb = loadBlock("SRS", {
    scheduleDays: true,
    sandbox: { console, ST: { v: 2, modules: {} }, VOCAB: [], save: () => { saved++; },
      freshModule: () => ({ vocab: {}, test: {} }), homeOf: (id) => id.split("_")[0] },
    expose: ["toggleSkipped", "isSkipped"],
  });
  sb.toggleSkipped("m0_01");
  assert.strictEqual(JSON.stringify(sb.ST.skip), '["m0_01"]', "решение лежит в ST — уедет на сервер вместе с прогрессом");
  assert.strictEqual(saved, 1, "и сохраняется сразу");
  // состояние, пришедшее с сервера, подменяет ST целиком — список читается заново
  sb.ST = { v: 2, modules: {}, skip: ["m2_07"] };
  assert.ok(sb.isSkipped("m2_07") && !sb.isSkipped("m0_01"), "после синка виден серверный список");
}
const norm = html.match(/function normalizeState\(sv\)\{[\s\S]*?\n\}/);
assert.ok(norm && !/skip/.test(norm[0]), "нормализация состояния не режет новое поле — миграция не нужна");

/* 4. Сервер принимает оба события: без схемы они молча отбрасывались бы.
   Разрешение выводится из EV_FIELDS (EV_TYPES = Object.keys(EV_FIELDS)),
   поэтому наличие схемы ниже И есть разрешение типа. */
assert.ok(/const EV_TYPES = new Set\(Object\.keys\(EV_FIELDS\)\)/.test(srv),
  "типы событий выводятся из схемы");
assert.ok(/"card\.know": \["mod", "cardId", "box0"\]/.test(srv), "поля card.know объявлены");
assert.ok(/"card\.skip": \["mod", "cardId", "on"\]/.test(srv), "поля card.skip объявлены");

/* 5. Отчёты преподавателя: решение видно и построчно в ленте, и сводкой на карточке ученика.
   В агрегате хранится ТЕКУЩЕЕ решение — вернувшееся в колоду слово не числится отложенным. */
assert.ok(/ev\.type==="card\.know"/.test(html) && /ev\.type==="card\.skip"/.test(html), "лента показывает решения");
assert.ok(/pg_decide/.test(html), "сводка решений на карточке ученика");
const fold = srv.match(/} else if \(ev\.type === "card\.know" \|\| ev\.type === "card\.skip"\) \{[\s\S]*?\n {2}\}/);
assert.ok(fold, "агрегат сворачивает решения");
assert.ok(/delete dec\[ref\]/.test(fold[0]), "возврат слова в колоду снимает запись из отчёта");
assert.ok(/decide: \{\}/.test(srv), "поле decide есть в свежем агрегате");
assert.ok(/agg\.decide \|\| \(agg\.decide = \{\}\)/.test(srv),
  "поле аддитивно: агрегаты без него доращиваются, а не пересобираются у всех учеников разом");

/* 6. Событийная часть — как у звёздочки: тот же контракт полей */
const sb = loadBlock("SRS", {
  scheduleDays: true,
  sandbox: { console, ST: { modules: {} }, save() {}, freshModule: () => ({ vocab: {}, test: {} }), homeOf: (id) => id.split("_")[0] },
  expose: ["toggleSkipped", "isSkipped", "toggleMarked", "isMarked"],
});
sb.toggleSkipped("m0_01"); sb.toggleMarked("m0_01");
assert.ok(sb.isSkipped("m0_01") && sb.isMarked("m0_01"), "списки независимы: слово может быть и отмеченным, и отложенным");
assert.strictEqual(sb.ST.skip.length, 1, "в списке ровно одна запись");

console.log("decide.test.js: OK («уже знаю»/«отложить»: колоды, знаменатели, синк, журнал, отчёты)");
