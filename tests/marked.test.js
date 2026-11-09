"use strict";
/* Тест «на запоминание»: isMarked/toggleMarked исполняются из собранной страницы
   и гоняются на стабе ST/save — список живёт в ST.marked и переживает синк. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");

// Исполняем весь блок пометок, а не вырезанные строки: механик у списков общий
// (marked и skip), и вырезание одной функции ловило бы только её текст.
let saves = 0;
const sb = loadBlock("SRS", {
  scheduleDays: true,
  sandbox: { console, ST: { v: 2, modules: {} }, save: () => { saves++; }, homeOf: (id) => id.split("_")[0],
    freshModule: () => ({ vocab: {}, test: {} }) },
  expose: ["isMarked", "toggleMarked", "isSkipped", "toggleSkipped"],
});

// 1. пустой state — ничего не отмечено, toggle создаёт список и сохраняет
assert.strictEqual(sb.isMarked("m0_01"), false, "изначально не отмечено");
sb.toggleMarked("m0_01");
assert.strictEqual(sb.isMarked("m0_01"), true, "отмечено после toggle");
assert.strictEqual(JSON.stringify(sb.ST.marked), '["m0_01"]', "список в ST.marked");
assert.strictEqual(saves, 1, "save() вызван");

// 2. повторный toggle снимает отметку, другие id не задеты
sb.toggleMarked("m3_42");
sb.toggleMarked("m0_01");
assert.strictEqual(sb.isMarked("m0_01"), false, "снято");
assert.strictEqual(sb.isMarked("m3_42"), true, "второе слово осталось");
assert.strictEqual(JSON.stringify(sb.ST.marked), '["m3_42"]');

// 3. Списки независимы: «отложено» — тот же механизм, но своё поле в ST
sb.toggleSkipped("m3_42");
assert.ok(sb.isSkipped("m3_42") && sb.isMarked("m3_42"), "слово может быть и отмеченным, и отложенным");
assert.strictEqual(JSON.stringify(sb.ST.marked), '["m3_42"]', "списки не перепутаны");

// 4. Подмена состояния с сервера (pullState) не оставляет устаревших пометок
sb.ST = { v: 2, modules: {}, marked: ["m1_01"] };
assert.ok(sb.isMarked("m1_01") && !sb.isMarked("m3_42"), "после подмены ST виден новый список");

// 5. UI: чип «На запоминание» и звёздочки (через хелпер starBtn) на карточках
assert.ok(html.includes('"__marked"'), "тема __marked в пуле карточек");
assert.ok(/toggleMarked\(id\)/.test(html), "toggleMarked внутри starBtn");
const cardHead = html.match(/cardHead\(c,mode\)\{[\s\S]*?\n {2}\},/);
assert.ok(cardHead && /starBtn\(c\.id\)/.test(cardHead[0]), "звёздочка — в общей шапке карточки");
assert.strictEqual((html.match(/this\.cardHead\(c,/g) || []).length, 2, "шапку строят обе фазы");

console.log("marked.test.js: OK (toggle/untoggle, ST.marked, звёздочка в шапке карточки)");
