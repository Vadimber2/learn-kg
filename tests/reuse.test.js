"use strict";
/* Тест механизма переиспользования слов (alias-карточки):
   homeOf/resolveVocab лежат в собранной странице между маркерами ===REUSE=== и валидируются без DOM. */
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

let warns = 0;
const sb = loadBlock("REUSE", {
  sandbox: { console: { warn: () => { warns++; }, log: console.log } },
  expose: ["homeOf", "resolveVocab"],
});
const { homeOf, resolveVocab } = sb;

// homeOf: родной модуль по префиксу id (ph_* — фонетика М0)
assert.strictEqual(homeOf("m1_136"), "m1", "m1_136 → m1");
assert.strictEqual(homeOf("m10_01"), "m10", "m10_01 → m10");
assert.strictEqual(homeOf("m0_39"), "m0", "m0_39 → m0");
assert.strictEqual(homeOf("ph_koychu"), "m0", "ph_* → m0");

// resolveVocab: alias резолвится в КОПИЮ карточки-донора с исходным id
const donor = { id: "m1_136", cat: "at", ky: "менин", ru: "мой", en: "my", accept: ["менын"] };
const content = { m1: { vocab: [donor] } };
const list = [
  { id: "m2_01", cat: "uybulo", ky: "үй-бүлө", ru: "семья", en: "family" },
  { ref: "m1_136", cat: "ilik" },
  { ref: "m9_99", cat: "ilik" } // битый ref: донора нет
];
const resolved = resolveVocab(list, content);

assert.strictEqual(resolved.length, 2, "битый ref отброшен, остальные на месте");
assert.strictEqual(warns, 1, "битый ref предупреждён через console.warn");

const own = resolved[0];
assert.strictEqual(own.id, "m2_01", "не-alias проходит насквозь");
assert.strictEqual(own.reuse, undefined, "не-alias не помечен reuse");

const alias = resolved[1];
assert.strictEqual(alias.id, "m1_136", "alias сохраняет ИСХОДНЫЙ id донора");
assert.strictEqual(alias.ky, "менин", "ky из донора");
assert.strictEqual(alias.ru, "мой", "ru из донора");
assert.strictEqual(alias.en, "my", "en из донора");
assert.deepStrictEqual(alias.accept, ["менын"], "accept из донора");
assert.strictEqual(alias.cat, "ilik", "cat из alias-записи (категория нового модуля)");
assert.strictEqual(alias.reuse, true, "помечен reuse:true");

// копия, а не мутация: правка резолвленного не задевает донора (иначе слово исчезнет из словаря М1)
alias.cat = "XXX";
alias.ky = "YYY";
assert.strictEqual(donor.cat, "at", "cat донора не мутирован");
assert.strictEqual(donor.ky, "менин", "ky донора не мутирован");

console.log("reuse.test.js: OK (homeOf, resolveVocab: копия, исходный id, битые ref)");
