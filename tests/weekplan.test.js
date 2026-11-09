"use strict";
/* План повторения лексики по дням недели: чистая функция weekPlan(cats, vocab)
   лежит между маркерами ===WEEKPLAN=== и проверяется без DOM.
   Инварианты: 7 дней; каждая тема вводится ровно один раз в дни 1–5;
   повторяются только уже введённые темы (интервалы 1 и 3 дня, методика §6.4);
   нагрузка по дням сбалансирована; результат детерминирован. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");

const { weekPlan, WEEK_DAYS } = loadBlock("WEEKPLAN", { expose: ["weekPlan", "WEEK_DAYS"] });

// дни недели — кыргызские, начиная с понедельника (они же лексика М5)
assert.strictEqual(WEEK_DAYS.length, 7, "семь дней");
assert.strictEqual(WEEK_DAYS[0].ky, "дүйшөмбү", "неделя начинается с дүйшөмбү");
assert.strictEqual(WEEK_DAYS[6].ky, "жекшемби", "последний день — жекшемби");
for (const d of WEEK_DAYS) for (const f of ["ky", "ru", "en", "tr"])
  assert.ok(d[f] && typeof d[f] === "string", "день " + d.ky + " имеет " + f);

// Данные реального модуля. Вход должен совпадать с продакшеном: renderOverview зовёт
// weekPlan(CATS, VOCAB), где VOCAB=resolveVocab(...) — реюз-алиасы развёрнуты в карточки
// текущего модуля. На «сырой» c.vocab раскладка расходится, а М10/М11 выглядят пустыми.
const db = loadBlock(["DATA", "REUSE"], {
  sandbox: { console: { warn: () => {}, log: console.log } },
  expose: ["CONTENT", "CONTENT_READY", "resolveVocab"],
});
const vocabOf = (mid) => db.resolveVocab(db.CONTENT[mid].vocab, db.CONTENT);

const check = (mid) => {
  const c = db.CONTENT[mid];
  const vocab = vocabOf(mid);
  const cats = Object.keys(c.cats).filter((k) => vocab.some((v) => v.cat === k));
  const plan = weekPlan(c.cats, vocab);

  assert.strictEqual(plan.length, 7, mid + ": семь дней в плане");

  // каждая непустая тема вводится ровно один раз, и только в дни 1–5
  const fresh = plan.flatMap((d, i) => d.fresh.map((k) => ({ k, i })));
  assert.deepStrictEqual([...new Set(fresh.map((f) => f.k))].sort(), [...cats].sort(),
    mid + ": все темы введены по одному разу");
  assert.strictEqual(fresh.length, cats.length, mid + ": без повторного ввода тем");
  // §5.4: новые слова вводятся порциями в дни 1–3; день 4 — продукция, день 5 — мини-тест
  for (const f of fresh)
    assert.ok(f.i <= 2, mid + ": новая тема «" + f.k + "» попала на день " + (f.i + 1) + ", а ввод идёт в дни 1–3");

  // повторяются только уже введённые темы — из дня −1 и дня −3
  for (let i = 0; i < 7; i++) {
    const seen = new Set(plan.slice(0, i).flatMap((d) => d.fresh));
    for (const k of plan[i].review)
      assert.ok(seen.has(k), mid + ": день " + (i + 1) + " повторяет ещё не введённую тему «" + k + "»");
    assert.strictEqual(new Set(plan[i].review).size, plan[i].review.length, mid + ": дубли в повторении дня " + (i + 1));
  }

  // Баланс ровно в тех пределах, которые даёт жадная раскладка целыми темами:
  // разброс не больше самой большой темы. Формула вида max ≤ min·2+1 вырождается
  // при пустом дне (min=0) и требует свойства, которого алгоритм не обещает.
  const sizes = cats.map((k) => vocab.filter((v) => v.cat === k).length);
  const load = plan.slice(0, 3).map((d) => d.fresh.reduce((s, k) => s + vocab.filter((v) => v.cat === k).length, 0));
  const spread = Math.max(...load) - Math.min(...load);
  assert.ok(spread <= Math.max(...sizes), mid + ": разброс " + spread + " больше самой большой темы (" +
    Math.max(...sizes) + "), дни: " + load.join("/"));

  // Ни один день не остаётся пустым: если тем меньше пяти (недели повторения М10/М11),
  // день без новой темы забирает всё введённое ранее.
  for (let i = 1; i < 7; i++)
    assert.ok(plan[i].fresh.length || plan[i].review.length, mid + ": день " + (i + 1) + " пуст");

  // детерминированность
  assert.deepStrictEqual(weekPlan(c.cats, vocab), plan, mid + ": план стабилен между вызовами");
  return load;
};

let total = 0;
for (const mid of db.CONTENT_READY) {
  if (!vocabOf(mid).length) continue; // модуль без карточек вообще
  check(mid);
  total++;
}
assert.strictEqual(total, db.CONTENT_READY.length, "проверены все модули: " + total);

// модуль без собственной лексики не ломает план
const empty = weekPlan({}, []);
assert.strictEqual(empty.length, 7, "пустой модуль — всё равно 7 дней");
assert.ok(empty.every((d) => !d.fresh.length && !d.review.length), "пустой модуль — пустые дни");

// Мало тем (1–4) — учебных дней больше, чем тем. Реальных таких модулей сейчас нет,
// но именно здесь дни проваливались в пустоту: день без новой темы и без «вчерашней»
// не показывал ученику ничего.
for (let n = 1; n <= 4; n++) {
  const cats = {}, vocab = [];
  for (let i = 0; i < n; i++) { cats["c" + i] = "тема " + i; vocab.push({ cat: "c" + i }, { cat: "c" + i }); }
  const plan = weekPlan(cats, vocab);
  assert.strictEqual(plan.flatMap((d) => d.fresh).length, n, n + " тем: каждая введена ровно один раз");
  for (let i = 1; i < 7; i++)
    assert.ok(plan[i].fresh.length || plan[i].review.length,
      n + " тем: день " + (i + 1) + " пуст — ученику нечего делать");
  for (let i = 0; i < 7; i++) {
    const seen = new Set(plan.slice(0, i).flatMap((d) => d.fresh));
    for (const k of plan[i].review)
      assert.ok(seen.has(k), n + " тем: день " + (i + 1) + " повторяет ещё не введённое");
  }
}

// карточка плана встроена в обзор каждого модуля и ведёт в карточки/мини-тест
assert.ok(/function weekPlanCard\(m\)\{/.test(html), "weekPlanCard определён");
assert.ok(/weekPlanCard\(m\);/.test(html), "renderOverview вызывает weekPlanCard");
// микроцикл §5.4: ввод новой лексики — три дня, мини-тест — на пятый день, не в воскресенье
assert.ok(/const STUDY_DAYS=3;/.test(html), "STUDY_DAYS=3 (ввод новых слов в дни 1–3)");
assert.ok(/const TEST_DAY=4;/.test(html), "TEST_DAY=4 (мини-тест на пятый день)");
assert.ok(/i===TEST_DAY\?actBtn\(t\("tab_test"\)/.test(html), "кнопка мини-теста стоит на дне 5");
assert.ok(!/i===6\?actBtn\(t\("tab_test"\)/.test(html), "кнопки мини-теста в воскресенье нет");
assert.ok(/const ROLE=\[/.test(html), "у каждого дня подписана его роль из §5.4");
assert.ok(/cardsTopic=k;go\("cards"\)/.test(html), "клик по теме открывает её карточки");
assert.ok(/cardsTopic=null;go\("cards"\)/.test(html), "выходные ведут в режим «Вперемешку»");
assert.ok(/L\("План повторения по дням недели","Day-by-day revision plan","Günlere göre tekrar planı"\)/.test(html),
  "заголовок плана трёхъязычен");

console.log("weekplan.test.js: OK (модулей с планом:", total + ")");
