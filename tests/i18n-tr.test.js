"use strict";
/* Тест трёхъязычного интерфейса (ru / en / tr):
   словарь I18N и функции локализации лежат между маркерами ===I18N=== и проверяются без DOM. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();
const m = html.match(/\/\* ===I18N=== \*\/([\s\S]*?)\/\* ===\/I18N=== \*\//);
assert.ok(m, "маркеры ===I18N=== найдены");

const sb = { console, ST: { settings: { lang: "ru" } }, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(sb);
vm.runInContext(m[1] + "; this.I18N=I18N; this.t=t; this.tf=tf; this.L=L; this.gloss=gloss; this.metaTitle=metaTitle;"
  + " this.currentLang=currentLang;", sb);
const { I18N, t, tf, L, gloss, metaTitle } = sb;

/* 0. Приоритет источников языка — исполнением, не грепом. Реальный промах: серверный
   ST.settings.lang приезжал со старым «en» и перебивал только что выбранный на витрине
   русский (kga1-lang) — язык «сам» слетал при входе в тренажёр и при выходе. */
{
  sb.ST.settings.lang = "en";                                    // старый выбор с сервера
  sb.localStorage.getItem = (k) => (k === "kga1-lang" ? "ru" : null); // свежий выбор на устройстве
  assert.strictEqual(sb.currentLang(), "ru", "свежий выбор устройства (kga1-lang) важнее серверного ST");
  sb.localStorage.getItem = () => null;
  assert.strictEqual(sb.currentLang(), "en", "без локального выбора действует серверный ST");
  sb.localStorage.getItem = (k) => (k === "kga1-lang" ? "de" : null); // мусор в хранилище
  assert.strictEqual(sb.currentLang(), "en", "неизвестный код в kga1-lang игнорируется");
  sb.localStorage.getItem = () => { throw new Error("приватный режим"); };
  assert.strictEqual(sb.currentLang(), "en", "недоступный localStorage не роняет выбор языка");
  sb.localStorage.getItem = () => null; sb.ST.settings.lang = "ru";
}

// 1. Полная паритетность ключей: tr не отстаёт от ru/en
const keys = (o) => Object.keys(o).sort();
assert.deepStrictEqual(keys(I18N.en), keys(I18N.ru), "ключи en = ключи ru");
assert.ok(I18N.tr, "словарь tr существует");
assert.deepStrictEqual(keys(I18N.tr), keys(I18N.ru), "ключи tr = ключи ru");
for (const k of keys(I18N.tr)) {
  assert.strictEqual(typeof I18N.tr[k], "string", "tr." + k + " — строка");
  assert.ok(I18N.tr[k].length > 0, "tr." + k + " не пустой");
}

// 2. Плейсхолдеры {n}/{d}/{t}… совпадают с русскими — иначе tf() подставит не туда
const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join(",");
for (const k of keys(I18N.ru))
  assert.strictEqual(ph(I18N.tr[k]), ph(I18N.ru[k]), "плейсхолдеры tr." + k + ": " + ph(I18N.tr[k]));

// 3. t()/tf() отдают турецкий, когда выбран tr
sb.ST.settings.lang = "tr";
assert.strictEqual(t("tab_cards"), I18N.tr.tab_cards, "t() отдаёт tr");
assert.ok(!tf("more_modules", { n: 3 }).includes("{n}"), "tf() подставляет переменные в tr");

// 4. L(ru,en,tr): турецкий, а без него — английский (мягкая деградация непереведённой теории)
assert.strictEqual(L("рус", "eng", "türk"), "türk", "L отдаёт третий аргумент при tr");
assert.strictEqual(L("рус", "eng"), "eng", "L без tr-аргумента откатывается на en");
sb.ST.settings.lang = "en";
assert.strictEqual(L("рус", "eng", "türk"), "eng", "L при en игнорирует tr");
sb.ST.settings.lang = "ru";
assert.strictEqual(L("рус", "eng", "türk"), "рус", "L при ru отдаёт русский");

// 5. Глоссы карточек и заголовки модулей: tr → en → ru
sb.ST.settings.lang = "tr";
assert.strictEqual(gloss({ ru: "дом", en: "house", tr: "ev" }), "ev", "gloss отдаёт tr");
assert.strictEqual(gloss({ ru: "дом", en: "house" }), "house", "gloss без tr → en");
assert.strictEqual(metaTitle({ title: "М1", titleEn: "M1 en", titleTr: "M1 tr" }), "M1 tr", "metaTitle отдаёт tr");
assert.strictEqual(metaTitle({ title: "М1", titleEn: "M1 en" }), "M1 en", "metaTitle без tr → en");

// 6. Дриллы и переключатель языка знают про tr
assert.ok(/function drillQ\(it\)\{[^}]*qTr/.test(html), "drillQ учитывает qTr");
assert.ok(/function drillNote\(it\)\{[^}]*noteTr/.test(html), "drillNote учитывает noteTr");
assert.ok(/function drillW\(it\)\{[^}]*wTr/.test(html), "drillW учитывает wTr");
assert.ok(/val:"tr",label:"Türkçe"/.test(html), "в настройках есть выбор Türkçe");
// <html lang> должен выставляться не только при клике по переключателю, но и на старте:
// иначе после перезагрузки в турецком режиме атрибут остаётся "ru"
assert.ok(/function applyLang\(\)\{[\s\S]{0,200}documentElement\.lang=/.test(html), "applyLang выставляет <html lang>");
// по телу функции, а не по окну символов: длина setLang меняется, контракт — нет
const setLangBody = html.match(/function setLang\(l\)\{[\s\S]*?\n\}/);
assert.ok(setLangBody && setLangBody[0].includes("applyLang()"), "setLang зовёт applyLang");
const boots = (html.match(/applyTheme\(\);applyLang\(\)/g) || []).length;
assert.ok(boots >= 2, "applyLang вызывается на бутстрапе рядом с applyTheme: " + boots);

console.log("i18n-tr.test.js: OK (ключей в словаре:", keys(I18N.tr).length + ")");
