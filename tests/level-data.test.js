"use strict";
/* Контракт данных теста уровня app/test/level-test.json:
   единый кыргызский банк вопросов (15 штук, градиент сложности a0 → a1 → a1plus),
   трёхъязычный ui с вердиктами, FAQ и WhatsApp-шаблоном. Ошибка данных должна
   падать здесь, до старта сервера, — buildLevelTest() дублирует эти проверки
   fail-fast'ом, но тест называет причину по-человечески. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "app", "test", "level-test.json");
const T = JSON.parse(fs.readFileSync(FILE, "utf8")); // не парсится — тест падает, это и есть проверка

/* ---------- служебные поля ---------- */
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(T.updated), "updated в формате YYYY-MM-DD (едет в sitemap)");
assert.ok(!Number.isNaN(Date.parse(T.updated)), "updated — валидная дата");
assert.strictEqual(typeof T.answersVerifiedByTeacher, "boolean",
  "answersVerifiedByTeacher — маркер пост-деплойной сверки с Алтынай");

/* ---------- банк вопросов ---------- */
const LEVELS = ["a0", "a1", "a1plus"];
assert.strictEqual(T.questions.length, 15, "в банке 15 вопросов, сейчас " + T.questions.length);
const ids = new Set();
for (const q of T.questions) {
  assert.ok(/^t\d{2}$/.test(q.id), "id вопроса формата tNN: " + q.id);
  assert.ok(!ids.has(q.id), "id уникален: " + q.id);
  ids.add(q.id);
  assert.ok(typeof q.ky === "string" && q.ky.trim().length > 0, q.id + ": текст вопроса непуст");
  assert.ok(Array.isArray(q.options) && q.options.length === 4, q.id + ": ровно 4 варианта");
  assert.strictEqual(new Set(q.options).size, 4, q.id + ": варианты уникальны");
  for (const o of q.options) assert.ok(typeof o === "string" && o.trim().length > 0, q.id + ": вариант непуст");
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, q.id + ": correct 0–3");
  assert.ok(LEVELS.includes(q.level), q.id + ": level ∈ {a0,a1,a1plus}");
  assert.ok(typeof q.note === "string" && q.note.trim().length > 0,
    q.id + ": note-обоснование ответа обязательно (по нему сверяемся с Алтынай)");
}
// градиент сложности: лёгкий вход, потолочный финал, ранг уровня не убывает
assert.ok(T.questions.filter((q) => q.level === "a0").length >= 3, "не меньше трёх вопросов a0");
assert.ok(T.questions.filter((q) => q.level === "a1plus").length >= 1, "есть хотя бы один потолочный a1plus");
let prev = 0;
for (const q of T.questions) {
  const r = LEVELS.indexOf(q.level);
  assert.ok(r >= prev, q.id + ": уровень не убывает по ходу теста (" + q.level + " после " + LEVELS[prev] + ")");
  prev = r;
}

/* ---------- ui: паритет трёх языков ---------- */
const LANGS = ["ru", "en", "tr"];
assert.deepStrictEqual(Object.keys(T.ui).sort(), LANGS.slice().sort(), "ровно три языка ui");
for (const l of LANGS) {
  assert.deepStrictEqual(Object.keys(T.ui[l]).sort(), Object.keys(T.ui.ru).sort(), "паритет ключей ui: " + l);
  const u = T.ui[l];
  for (const [k, v] of Object.entries(u)) {
    if (k === "verdicts" || k === "faq") continue;
    assert.ok(typeof v === "string" && v.trim().length > 0, l + "." + k + " — непустая строка");
  }
  // сниппет выдачи
  assert.ok(u.title.length <= 60, "title " + l + " ≤ 60, сейчас " + u.title.length);
  assert.ok(u.desc.length >= 80 && u.desc.length <= 160, "desc " + l + " в 80–160, сейчас " + u.desc.length);
  // вердикты: строго растущие пороги, последний закрывает максимум баллов
  assert.strictEqual(u.verdicts.length, 3, "verdicts " + l + ": три ступени");
  let pmax = -1;
  for (const v of u.verdicts) {
    assert.ok(Number.isInteger(v.max) && v.max > pmax, "verdicts " + l + ": max строго растут");
    pmax = v.max;
    for (const f of ["short", "h", "p"]) assert.ok(v[f] && typeof v[f] === "string", "verdicts " + l + ": поле " + f);
  }
  assert.strictEqual(pmax, T.questions.length, "verdicts " + l + ": последний max = числу вопросов");
  // WhatsApp-шаблон несёт счёт и итог
  assert.ok(u.waMsg.includes("{s}") && u.waMsg.includes("{t}"), "waMsg " + l + " содержит {s} и {t}");
  // FAQ — SEO-нагрузка страницы
  assert.ok(Array.isArray(u.faq) && u.faq.length >= 3, "faq " + l + ": не меньше трёх вопросов");
  for (const f of u.faq) assert.ok(f.q && f.a, "faq " + l + ": у каждого вопроса есть q и a");
  // qLabel несёт счётчик прогресса
  assert.ok(u.qLabel.includes("{n}") && u.qLabel.includes("{t}"), "qLabel " + l + " содержит {n} и {t}");
  // решение владельца 30.10.2026: названия организатора тестирования в текстах нет (адрес
  // официального сайта ставит билдер ссылкой под заданиями), и FAQ прямо говорит, что задания
  // learn.kg с заданиями государственного тестирования не связаны
  const all = JSON.stringify(u);
  assert.ok(!/кыргыз\s*тест|k[ıi]rg[ıi]z\s*test/i.test(all), "ui " + l + ": названия организатора тестирования нет");
  assert.ok(!/как в экзамене|как на экзамене|same .{0,30}format as the exam|sınavdaki gibi/i.test(all), "ui " + l + ": формат курса не выдаётся за экзаменационный");
  assert.ok(u.faq.some((f) => /не связаны|not related|bağlantılı değil/.test(f.a)), "faq " + l + ": сказано, что задания не связаны с официальным тестированием");
  // ссылки FAQ на пробные тесты — на свой язык
  for (const lv of ["a1", "b1", "b2"]) assert.ok(all.includes("|/probny-test-" + lv + "/" + l + "))"), "faq " + l + ": ссылка на пробный тест " + lv + " своего языка");
}
assert.ok(!/кыргыз\s*тест|k[ıi]rg[ıi]z\s*test/i.test(JSON.stringify(T.questions)), "в вопросах нет названия организатора тестирования");

console.log("level-data.test.js: OK (15 вопросов, градиент a0→a1plus, ui ru/en/tr, вердикты и FAQ, без названия организатора тестирования)");
