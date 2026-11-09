"use strict";
/* Правки преподавателя (overrides) должны доезжать до всех трёх языков.
   applyOverrides лежит между маркерами ===OVERRIDES=== и проверяется без DOM. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();
const m = html.match(/\/\* ===OVERRIDES=== \*\/([\s\S]*?)\/\* ===\/OVERRIDES=== \*\//);
assert.ok(m, "маркеры ===OVERRIDES=== найдены");

const card = () => ({ id: "m0_83", cat: "okuu", ky: "калем сап", ru: "ручка", en: "pen", tr: "kalem", accept: ["калем"] });
const run = (overrides, c) => {
  const sb = { console, VOCAB: [c], OVERRIDES: overrides };
  vm.createContext(sb);
  vm.runInContext(m[1] + "; applyOverrides();", sb);
  return sb.VOCAB[0];
};

// 1. Правка перевода применяется ко всем языкам, которые преподаватель заполнил
const full = run({ m0_83: { ky: "калем", ru: "карандаш", en: "pencil", tr: "kurşun kalem" } }, card());
assert.strictEqual(full.ky, "калем", "ky пропатчен");
assert.strictEqual(full.ru, "карандаш", "ru пропатчен");
assert.strictEqual(full.en, "pencil", "en пропатчен — иначе англоязычный ученик видит старый перевод");
assert.strictEqual(full.tr, "kurşun kalem", "tr пропатчен — иначе турецкий ученик видит старый перевод");

// 2. Незаполненные поля не стирают исходные (преподаватель может знать только русский)
const partial = run({ m0_83: { ru: "карандаш" } }, card());
assert.strictEqual(partial.ru, "карандаш", "ru пропатчен");
assert.strictEqual(partial.en, "pen", "пустой en не затирает исходный");
assert.strictEqual(partial.tr, "kalem", "пустой tr не затирает исходный");

// 3. Пустая строка — тоже «не задано»: случайно очищенное поле не обнуляет карточку
const blank = run({ m0_83: { ru: "", en: "", tr: "" } }, card());
assert.strictEqual(blank.ru, "ручка", "пустая строка не затирает ru");
assert.strictEqual(blank.en, "pen", "пустая строка не затирает en");
assert.strictEqual(blank.tr, "kalem", "пустая строка не затирает tr");

// 4. Правка карточки, которой нет в модуле, не роняет применение
const other = run({ m9_99: { ru: "нет такой" }, m0_83: { tr: "kalem (düzeltildi)" } }, card());
assert.strictEqual(other.tr, "kalem (düzeltildi)", "чужой id не мешает применить свой");

// 5. Редактор вычитки даёт преподавателю поля для en/tr и отправляет их на сервер
assert.ok(/const inpEn=h\("input"/.test(html), "в редакторе есть поле English");
assert.ok(/const inpTr=h\("input"/.test(html), "в редакторе есть поле Türkçe");
assert.ok(/en:inpEn\.value\.trim\(\)/.test(html), "значение en уходит в putOverride");
assert.ok(/tr:inpTr\.value\.trim\(\)/.test(html), "значение tr уходит в putOverride");

// 6. Сервер принимает и хранит en/tr (интеграционно это же проверяет server.test.js)
const srv = require("./helpers/server-src").all; // весь server/*.js — переживает декомпозицию
for (const f of ["ky", "ru", "en", "tr"])
  assert.ok(new RegExp("d\\." + f + " != null\\) entry\\." + f).test(srv), "сервер сохраняет override." + f);

/* 7. Произношение для озвучки (`say`): голос читает его, карточка ученика — нет.
   Механизм существует потому, что орфография сбивает модель на заимствованиях:
   «команда» звучала как [куманда], а транскрипция держит кыргызское [о]. */
{
  // на экране написание не меняется
  const shown = run({ m0_83: { say: "/kɑlem sɑp/" } }, card());
  assert.strictEqual(shown.ky, "калем сап", "say не подменяет написание карточки");
  assert.strictEqual(shown.ru, "ручка", "say не трогает переводы");
  // а голос читает именно say — клиентская и батчевая ветки обязаны совпадать
  const sayFn = (overrides, id, ky) => {
    const sb = { console, VOCAB: [], OVERRIDES: overrides };
    vm.createContext(sb);
    vm.runInContext(m[1] + "; this.OUT=sayText(" + JSON.stringify(id) + "," + JSON.stringify(ky) + ");", sb);
    return sb.OUT;
  };
  const { effectiveKy } = require("../deploy/gen-audio");
  const cases = [
    [{ m0_83: { say: "/komɑndɑ/" } }, "/komɑndɑ/", "заданное произношение читается вместо написания"],
    [{ m0_83: { say: "   " } }, "калем сап", "пробелы — это «не задано»"],
    [{ m0_83: { ky: "калем", say: "" } }, "калем", "без say читается правка написания"],
    [{}, "калем сап", "без правок читается исходник"],
  ];
  for (const [ovr, want, why] of cases) {
    // клиент вызывает sayText уже с текстом карточки, то есть после applyOverrides
    const shownKy = run(ovr, card()).ky;
    assert.strictEqual(sayFn(ovr, "m0_83", shownKy), want, "клиент: " + why);
    // батч идёт от исходника — правку написания он применяет сам
    assert.strictEqual(effectiveKy({ id: "m0_83", ky: "калем сап" }, ovr), want, "батч: " + why);
  }
  assert.ok(/say:inpSay\.value\.trim\(\)/.test(html), "значение произношения уходит в putOverride");
  assert.ok(/genTts\(c\.id,sayText\(c\.id,c\.ky\)/.test(html), "кнопка генерации озвучивает произношение, а не написание");
  assert.ok(/d\.say != null\) entry\.say/.test(srv), "сервер сохраняет override.say");
  assert.ok(html.includes("Произношение для озвучки:"), "поле подписано в редакторе");
  assert.ok(/Заполняйте, только если голос читает слово неверно/.test(html), "к полю есть пояснение, как им пользоваться");
  assert.ok(/\},"Отмена"\)/.test(html), "в редакторе есть кнопка «Отмена»");
}

console.log("overrides.test.js: OK (ky/ru/en/tr, частичная правка, пустые строки, чужой id, say для озвучки)");
