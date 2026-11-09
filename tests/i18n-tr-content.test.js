"use strict";
/* Полнота турецкого слоя контента: словарь, заголовки модулей, теория, дриллы.
   Инвариант: у каждой словарной записи есть tr, каждый L() трёхъязычен, у каждого
   дрилл-задания есть qTr/noteTr. Английский остаётся аварийным откатом, а не нормой. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();
const field = (s, f) => (s.match(new RegExp("[,{]" + f + ':"((?:[^"\\\\]|\\\\.)*)"')) || [])[1];

// 1. Словарь: tr у каждой фразы
const vocab = [...html.matchAll(/\{id:"(m\d+_\d+)",cat:"[^"]*",ky:"[^"]*"[^}]*\}/g)]
  .map((m) => ({ id: m[1], raw: m[0], tr: field(m[0], "tr") }));
assert.ok(vocab.length > 1000, "словарь найден: " + vocab.length);
const noTr = vocab.filter((v) => !v.tr);
assert.strictEqual(noTr.length, 0, "без tr осталось " + noTr.length + " фраз: " + noTr.slice(0, 6).map((v) => v.id).join(","));

// 2. Заголовки модулей: турецкий титул обязан быть у КАЖДОГО модуля из CONTENT_READY —
// цикл по реальному списку, а не по хардкоду 0..11: новые модули A2 попадают под
// проверку автоматически, без правки этого теста
assert.ok(/const MODULE_TITLES_TR=\{\s*m0:/.test(html), "MODULE_TITLES_TR определён");
const trTitles = (html.match(/const MODULE_TITLES_TR=\{([^}]*)\}/) || [])[1] || ""; // записи построчно
const readyList = (html.match(/const CONTENT_READY\s*=\s*\[([^\]]*)\]/) || [])[1] || "";
const readyMods = [...readyList.matchAll(/"(m\d+)"/g)].map((m) => m[1]);
assert.ok(readyMods.length >= 12, "CONTENT_READY найден: " + readyMods.length);
for (const mid of readyMods)
  assert.ok(new RegExp("\\b" + mid + ':"[^"]+"').test(trTitles), "titleTr для " + mid);
// и английские титулы тоже: забытый EN-титул молча подставил бы русский заголовок
// в оба нерусских интерфейса (titleTr откатывается на titleEn, тот — на title)
const enTitles = (html.match(/const MODULE_TITLES_EN=\{([^}]*)\}/) || [])[1] || "";
for (const mid of readyMods)
  assert.ok(new RegExp("\\b" + mid + ':"[^"]+"').test(enTitles), "titleEn для " + mid);

// 3. Теория: каждый вызов L() получил третий аргумент
const two = [...html.matchAll(/\bL\((?:"(?:[^"\\]|\\.)*")\s*,\s*(?:"(?:[^"\\]|\\.)*")\s*\)/g)];
assert.strictEqual(two.length, 0, "двухъязычных L() осталось " + two.length + ": " +
  two.slice(0, 3).map((m) => m[0].slice(0, 60)).join(" … "));

// 4. Дриллы: у КАЖДОГО задания с английской строкой есть турецкая.
// Считать вхождения по всему файлу нельзя: пропавший qTr у одного задания и лишний
// у другого дают равные суммы, и проверка зеленеет на битых данных.
const cnt = (re) => (html.match(re) || []).length;
const objects = [...html.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]);
for (const [en, tr] of [["qEn", "qTr"], ["noteEn", "noteTr"], ["wEn", "wTr"]]) {
  const gap = objects.filter((o) => new RegExp("[,{]\\s*" + en + ':"').test(o) && !new RegExp("[,{]\\s*" + tr + ':"').test(o));
  assert.strictEqual(gap.length, 0, tr + " отсутствует у " + gap.length + " заданий: " +
    gap.slice(0, 2).map((o) => o.slice(0, 70)).join(" · "));
}

// 5. Подписи модулей: у каждого объявленного *En есть парный *Tr — и в самих словарях
// категорий совпадает набор ключей (иначе catsTr с половиной ключей пройдёт проверку).
for (const f of ["name", "rule", "refLabel", "drillLabel", "drillHint", "plan"]) {
  const en = cnt(new RegExp("\\b" + f + 'En:', "g")), tr = cnt(new RegExp("\\b" + f + 'Tr:', "g"));
  assert.strictEqual(tr, en, f + "Tr: " + tr + " из " + en);
}
const dataBlock = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//)[1];
const dsb = { console };
vm.createContext(dsb);
vm.runInContext(dataBlock + "; this.CONTENT=CONTENT; this.CONTENT_READY=CONTENT_READY;", dsb);
for (const mid of dsb.CONTENT_READY) {
  const c = dsb.CONTENT[mid];
  const keys = (o) => Object.keys(o || {}).sort();
  assert.deepStrictEqual(keys(c.catsTr), keys(c.cats), mid + ": ключи catsTr расходятся с cats");
  assert.deepStrictEqual(keys(c.catsEn), keys(c.cats), mid + ": ключи catsEn расходятся с cats");
  for (const [k, v] of Object.entries(c.catsTr || {}))
    assert.ok(typeof v === "string" && v.trim(), mid + ": пустое имя категории " + k + " в catsTr");
  if (c.plan) {
    assert.strictEqual((c.planTr || []).length, c.plan.length, mid + ": planTr короче plan");
    for (const s of c.planTr) assert.ok(typeof s === "string" && s.trim(), mid + ": пустой пункт planTr");
  }
  for (const g of Object.values(c.drillGroups || {})) {
    assert.ok(g.nameTr && g.nameTr.trim(), mid + ": группа дрилла без nameTr");
    assert.ok(!g.rule || (g.ruleTr && g.ruleTr.trim()), mid + ": правило дрилла без ruleTr");
  }
}

// 6. Строки диалогов и текстов: [ky,ru,en] дополнены четвёртым элементом.
// Исключён только литерал const ALPHABET: там тройки другого вида — [ru,en,tr], их
// полноту проверяет alphabet.test.js. Остальной код внутри маркеров остаётся под контролем.
const S = '"(?:[^"\\\\]|\\\\.)*"';
const alphabetLiteral = html.match(/const ALPHABET=\[[\s\S]*?\}\];/);
assert.ok(alphabetLiteral, "литерал ALPHABET найден (иначе исключение ниже вырежет не то)");
const withoutAlphabet = html.replace(alphabetLiteral[0], "");
const triples = [...withoutAlphabet.matchAll(new RegExp("\\[(" + S + "),(" + S + "),(" + S + ")\\]", "g"))]
  .filter((m) => /[а-яёөүңА-ЯЁӨҮҢ]/.test(JSON.parse(m[1])));
assert.strictEqual(triples.length, 0, "без турецкой строки осталось " + triples.length +
  " реплик: " + triples.slice(0, 3).map((m) => JSON.parse(m[1]).slice(0, 30)).join(" · "));

// 7. Аксессоры знают про турецкий
for (const [name, re] of [["bi", /function bi\(o,f\)\{[^}]*Tr/], ["catName", /function catName\(k\)\{[\s\S]{0,200}catsTr/],
  ["dtr", /function dtr\(row\)\{[^}]*row\[3\]/], ["weekTextsCard", /function weekTextsCard\([^)]*subTr,titleTr\)/],
  ["weekDialog", /function weekDialog\([^)]*h3Tr,taskTr\)/]])
  assert.ok(re.test(html), name + " учитывает турецкий");

// 8. Турецкая типографика: в турецких строках кавычки “ ”, а не русские « »
const S2 = '"(?:[^"\\\\]|\\\\.)*"';
const trFields = [...html.matchAll(new RegExp("(?:^|[,{])\\s*(?:tr|qTr|noteTr|wTr|nameTr|ruleTr|refLabelTr|drillLabelTr|drillHintTr):\\s*(" + S2 + ")", "g"))]
  .filter((m) => m[1].includes("«") || m[1].includes("»"));
assert.strictEqual(trFields.length, 0, "русские кавычки в турецких строках: " +
  trFields.slice(0, 3).map((m) => m[1].slice(0, 50)).join(" · "));
const ruFields = [...html.matchAll(new RegExp("(?:^|[,{])\\s*(?:ru|q|note|name|rule|drillHint):\\s*(" + S2 + ")", "g"))]
  .filter((m) => m[1].includes("“") || m[1].includes("”"));
assert.strictEqual(ruFields.length, 0, "турецкие кавычки протекли в русские строки: " +
  ruFields.slice(0, 3).map((m) => m[1].slice(0, 50)).join(" · "));

// 9. Ссылки на методику ведут в существующие разделы (§6.7 и §9.2 не существует)
// docs/ — внутренние материалы: в публичную копию репозитория не входят, там проверка пропускается
const METOD = path.join(__dirname, "..", "docs", "metodika-podgotovki.md");
if (fs.existsSync(METOD)) {
  const metod = fs.readFileSync(METOD, "utf8");
  const haveSection = (ref) => new RegExp("^#{2,3} " + ref.replace(".", "\\.") + "\\.? ", "m").test(metod);
  const refs = [...new Set([...html.matchAll(/(?:методика|methodology|metodoloji) §(\d+(?:\.\d+)?)/g)].map((m) => m[1]))];
  assert.ok(refs.length > 0, "ссылки на методику найдены");
  for (const r of refs) assert.ok(haveSection(r), "в методике нет раздела §" + r);
}

console.log("i18n-tr-content.test.js: OK (словарь:", vocab.length, "| L():", cnt(/\bL\(/g),
  "| qTr:", cnt(/\bqTr:"/g), "| реплик:", cnt(/\bdtr\(/g) ? [...html.matchAll(new RegExp("\\[" + S + "," + S + "," + S + "," + S + "\\]", "g"))].length : 0, ")");
