"use strict";
/* Справочник алфавита М0: 36 букв со звуком (IPA), латинским соответствием,
   описанием произношения на трёх языках и примером.
   Данные лежат между маркерами ===ALPHABET=== и проверяются без DOM. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");

const { ALPHABET } = loadBlock("ALPHABET", { expose: ["ALPHABET"] });

const ORDER = "АБВГДЕЁЖЗИЙКЛМНҢОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ";
assert.strictEqual(ALPHABET.length, 36, "36 букв: " + ALPHABET.length);
assert.strictEqual(ALPHABET.map((x) => x.up).join(""), ORDER, "порядок алфавита");

for (const a of ALPHABET) {
  const at = a.up + ": ";
  assert.strictEqual(a.low, a.up.toLowerCase(), at + "строчная соответствует заглавной");
  assert.ok(a.ipa && a.ipa.length, at + "звук (IPA)");
  assert.ok(a.lat && a.lat.length, at + "латинское соответствие");
  // lat/ipa не локализуются — в них не должно быть кириллических пояснений,
  // иначе они протекут русским текстом в английский и турецкий интерфейс
  for (const f of ["lat", "ipa"])
    assert.ok(!/[а-яёА-ЯЁ]/.test(a[f]), at + f + " содержит кириллицу: " + a[f]);
  for (const f of ["snd", "ex"]) {
    assert.ok(Array.isArray(a[f]) && a[f].length === 3, at + f + " — три языка");
    for (const s of a[f]) assert.ok(typeof s === "string" && s.trim().length, at + f + ": пустая строка");
  }
  assert.ok(a.word && /[а-яёөүңА-ЯЁӨҮҢ]/.test(a.word), at + "пример-слово по-кыргызски");
  // буква действительно встречается в своём примере — включая ъ/ь: их примеры
  // (объект, фильм) содержат свою букву, поблажка была бы ослаблением на ровном месте
  assert.ok(a.word.toLowerCase().includes(a.low), at + "пример «" + a.word + "» не содержит буквы");
  // описания различаются между языками — значит, это перевод, а не копипаста
  assert.notStrictEqual(a.snd[0], a.snd[1], at + "русское и английское описания совпали");
  assert.notStrictEqual(a.snd[1], a.snd[2], at + "английское и турецкое описания совпали");
  assert.notStrictEqual(a.ex[1], a.ex[2], at + "английский и турецкий перевод примера совпали");
}

// три буквы, которых нет в русском, помечены
const special = ALPHABET.filter((a) => a.special).map((a) => a.up).join("");
assert.strictEqual(special, "ҢӨҮ", "особые буквы: " + special);

// Подпись про эти три буквы должна опираться на язык читателя, а не пересказывать
// русскую рамку: у турка ө/ү уже есть (ö/ü), англоязычному кириллица незнакома целиком.
const LIT = '"(?:[^"\\\\]|\\\\.)*"';
const caption = html.match(new RegExp("L\\(\\s*(\"Фиолетовым[^\"]*\"),\\s*(" + LIT + "),\\s*(" + LIT + ")\\s*\\)"));
assert.ok(caption, "подпись про фиолетовые буквы найдена");
const [capRu, capEn, capTr] = [caption[1], caption[2], caption[3]].map((x) => JSON.parse(x));
for (const [lang, text] of [["ru", capRu], ["en", capEn], ["tr", capTr]])
  for (const ch of ["ө", "ү", "ң"])
    assert.ok(text.includes(ch), lang + ": в подписи не названа буква " + ch);
assert.ok(/ө = ö|ө=ö/.test(capTr), "tr: не сказано, что ө — это турецкое ö");
assert.ok(/ү = ü|ү=ü/.test(capTr), "tr: не сказано, что ү — это турецкое ü");
assert.ok(/ñ/.test(capTr), "tr: ң не соотнесён с ñ");
assert.ok(/sing|German|ö|ü/.test(capEn), "en: нет опоры на знакомые читателю звуки");
assert.ok(/русск/.test(capRu), "ru: потеряна опора на русский алфавит");
assert.notStrictEqual(capRu, capEn, "ru и en подписи совпали");
assert.notStrictEqual(capEn, capTr, "en и tr подписи совпали");

// «Типичная ошибка №1» тоже привязана к языку: русскоязычный подменяет ө/ү,
// турку эти буквы даются легко — у него другие ловушки (ң и ж)
const mistake = html.match(new RegExp("L\\(\\s*(\"Типичная ошибка русскоязычных[^\"]*\"),\\s*(" + LIT + "),\\s*(" + LIT + ")\\s*\\)"));
assert.ok(mistake, "заметка про типичную ошибку найдена");
const mistakeTr = JSON.parse(mistake[3]);
assert.ok(/ң/.test(mistakeTr) && /ж/.test(mistakeTr), "tr: ловушки турка (ң, ж) не названы");
assert.ok(!/Rusça konuşanların/.test(mistakeTr), "tr: осталась русская рамка «ошибка русскоязычных»");

// таблица действительно строится из этих данных. Якоря взяты уникальные: заголовок
// «Буква» есть и в старой карточке «Три новые буквы», по нему удаление всей таблицы
// транскрипции осталось бы незамеченным.
assert.ok(/for\(const a of ALPHABET\)/.test(html), "renderAlphabet перебирает ALPHABET");
assert.ok(/L\("Как звучит","How it sounds","Nasıl duyulur"\)/.test(html), "колонка «Как звучит»");
assert.ok(/L\("Латиницей","Latin","Latin harf"\)/.test(html), "колонка латинского соответствия");
for (const f of ["a.ipa", "a.lat", "a.word"])
  assert.ok(html.includes(f), "таблица выводит " + f);

console.log("alphabet.test.js: OK (букв:", ALPHABET.length, "| особых:", special + ")");
