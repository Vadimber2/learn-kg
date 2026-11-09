"use strict";
/* Проверка ответа (ввод) и подбор дистракторов (узнавание) — прямое исполнение
   функций собранной страницы. Два инцидента от учеников:
   — iOS шлёт «й» разложенной (и + U+0306): без NFC верный ответ «кайырлуу кеч»
     считался ошибкой;
   — в узнавании рядом с верным вариантом выпадал его смысловой двойник
     («Кто Вы по национальности?» и он же с «(букв. …)») — клик по двойнику
     считался ошибкой, различить их невозможно. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const m0 = require("../server/appshell").buildAppHtml();
const fnSrc = (name) => {
  // многострочные функции файла закрываются «}» в нулевой колонке
  const m = m0.match(new RegExp("function " + name + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}"));
  assert.ok(m, "функция " + name + " найдена в m0.html");
  return m[0];
};
const glossSrc = m0.match(/function gloss\(c\)\{[^\n]*\}/);
assert.ok(glossSrc, "функция gloss найдена");

/* ---------- ввод: normalizeAnswer / checkAnswer ---------- */
const sbA = {};
vm.createContext(sbA);
vm.runInContext(fnSrc("normalizeAnswer") + "\n" + fnSrc("checkAnswer") +
  ";this.checkAnswer=checkAnswer;this.normalizeAnswer=normalizeAnswer;", sbA);
const card = { ky: "Кайырлуу кеч!" };
assert.ok(sbA.checkAnswer(card, "Кайырлуу кеч!"), "точный ответ принят");
// iOS-автозамена: латинские близнецы в кириллице (третий инцидент — «Жакшы, раxмат.»)
assert.ok(sbA.checkAnswer({ ky: "Жакшы, рахмат." }, "Жaкшы, раxмaт."), "латинские близнецы приняты");
assert.ok(!sbA.checkAnswer({ ky: "бар" }, "бор"), "реально другая буква — по-прежнему ошибка");
assert.ok(sbA.checkAnswer(card, "кайырлуу кеч"), "строчные буквы и без «!» — принят");
assert.ok(sbA.checkAnswer(card, "  кайырлуу   кеч  "), "лишние пробелы — принят");
// «й» разложенной формой (как шлют iOS-клавиатуры): и + комбинирующий бревис U+0306
const decomposed = "Ка" + "\u0438\u0306" + "\u044b\u0440\u043b\u0443\u0443 \u043a\u0435\u0447"; // Кайырлуу кеч
assert.notStrictEqual(decomposed, "Кайырлуу кеч".normalize("NFC"), "фикстура действительно в NFD");
assert.strictEqual(decomposed.normalize("NFC"), "Кайырлуу кеч".normalize("NFC"), "и NFC собирает её обратно в «й»");
assert.ok(sbA.checkAnswer(card, decomposed), "разложенная «й» (iOS) — принят, NFC-нормализация работает");
assert.ok(!sbA.checkAnswer(card, "кайрылуу кеч"), "реальная опечатка по-прежнему ошибка");
assert.ok(!sbA.checkAnswer(card, ""), "пустой ввод — не ответ");

/* ---------- узнавание: pickDistractors не предлагает смысловых двойников ---------- */
const dataSrc = m0.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
assert.ok(dataSrc, "маркеры ===DATA=== найдены");
const sbD = { currentLang: () => "ru", shuffle: (a) => a.slice() };
vm.createContext(sbD);
vm.runInContext(dataSrc[1] + ";this.CONTENT=CONTENT;", sbD);
vm.runInContext(fnSrc("normalizeAnswer") + "\n" + glossSrc[0] + "\n" + fnSrc("glossBase") + "\n" + fnSrc("pickDistractors") +
  ";this.pickDistractors=pickDistractors;this.glossBase=glossBase;this.gloss=gloss;", sbD);
const m1 = sbD.CONTENT.m1.vocab;
const plain = m1.find((c) => c.id === "m1_10"), lit = m1.find((c) => c.id === "m1_117");
assert.ok(plain && lit, "пара двойников m1_10/m1_117 существует");
assert.strictEqual(sbD.glossBase(plain.ru), sbD.glossBase(lit.ru), "их русские переводы — один смысл (база совпадает)");
sbD.VOCAB = m1;
for (const c of [plain, lit]) {
  const other = c === plain ? lit : plain;
  // shuffle заглушен тождеством — прогоняем все карточки как «верные» детерминированно
  const opts = vm.runInContext("pickDistractors(VOCAB.find(v=>v.id===" + JSON.stringify(c.id) + "),3)", sbD);
  assert.strictEqual(opts.length, 3, c.id + ": три дистрактора набраны");
  assert.ok(!opts.includes(sbD.gloss(other)), c.id + ": двойник «" + other.ru.slice(0, 30) + "…» не предлагается как неверный");
  const bases = opts.map((o) => sbD.glossBase(o));
  assert.strictEqual(new Set(bases).size, 3, c.id + ": дистракторы попарно различимы по смыслу");
  assert.ok(!bases.includes(sbD.glossBase(sbD.gloss(c))), c.id + ": ни один не совпадает с верным по смыслу");
}
// смысловая база: скобочные пояснения и пунктуация не делают варианты «разными»
assert.strictEqual(sbD.glossBase("Кто Вы? (вежливо)"), sbD.glossBase("кто вы"), "скобки и регистр не разводят смысл");
assert.notStrictEqual(sbD.glossBase("(целиком в скобках)"), "", "текст целиком в скобках не схлопывается в пустоту");

/* ---------- М5: формулировки вопросов о дне и числе (правки Алтынай) ---------- */
assert.ok(m0.includes('ky:"Бүгүн кайсы күн?"'), "m5_87: «Бүгүн кайсы күн?»");
assert.ok(m0.includes('ky:"Бүгүн канчанчы число?"'), "m5_88: «Бүгүн канчанчы число?»");
assert.ok(!m0.includes("Бүгүн эмне күн"), "старая формулировка «Бүгүн эмне күн» ушла отовсюду (и из диалога)");
assert.ok(!m0.includes('ky:"Бүгүн канчанчы?"'), "старая карточка «Бүгүн канчанчы?» заменена");

console.log("answers.test.js: OK (NFC-ввод, дистракторы без смысловых двойников, М5 «кайсы күн/канчанчы число»)");
