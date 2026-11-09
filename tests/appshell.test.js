"use strict";
/* Сборщик страницы: перебор наборов модулей, а не только тех двух курсов, что есть сейчас.
   Дыра, ради которой сьют написан: замыкание доноров считалось на глубину 1 и только по
   словарю модуля. На наборах «курс целиком» это не проявлялось (доноры оказывались в том
   же курсе), и все тесты были зелёными — пока вариант не собрали из пары модулей.
   Поэтому здесь наборы: одиночные, пары, без первого модуля, вперемешку между курсами. */
const assert = require("assert");
const vm = require("vm");
const appshell = require("../server/appshell");

const MODULES = appshell.MODULES;
const num = (m) => Number(m.slice(1));

// Ссылки на слова чужого модуля, оставшиеся в собранной странице: сборка обязана
// привезти данные каждого упомянутого модуля, иначе alias-карточка ссылается в пустоту.
function foreignRefs(html, dataMods) {
  const out = new Set();
  for (const m of html.matchAll(/"(m\d+)_/g)) if (!dataMods.has(m[1])) out.add(m[1]);
  for (const m of html.matchAll(/\b(?:CATS|VOCAB|DRILL)_M(\d+)\b/g)) if (!dataMods.has("m" + m[1])) out.add("m" + m[1]);
  return [...out];
}

function contentOf(html) {
  const dm = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
  assert.ok(dm, "блок данных на месте");
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(dm[1] + ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;this.DIALOGS=typeof DIALOGS===\"undefined\"?{}:DIALOGS;", sb);
  return sb;
}

/* 1. Перебор наборов: каждый собирается, исполняется и не ссылается наружу */
const SETS = [
  ["один модуль A1", ["m1"]],
  ["один модуль A2", ["m12"]],
  ["пара внутри A2", ["m12", "m13"]],
  ["вперемешку между курсами", ["m3", "m20"]],
  ["последний модуль", [MODULES[MODULES.length - 1]]],
  ["без m0", MODULES.filter((m) => m !== "m0")],
  ["один модуль B1", ["m24"]],
  ["чистый B1", MODULES.filter((m) => +m.slice(1) >= 24 && +m.slice(1) <= 35)],
  ["A2+B1 вперемешку", ["m20", "m30"]],
  ["повторительный B1 без своих слов", ["m34"]],
  ["экзаменационный B1", ["m35"]],
  ["B1 без одного модуля", MODULES.filter((m) => +m.slice(1) >= 24 && +m.slice(1) <= 35 && m !== "m32")],
  ["один модуль B2", ["m36"]],
  ["чистый B2", MODULES.filter((m) => +m.slice(1) >= 36)],
  ["B1+B2 вперемешку", ["m30", "m40"]],
  ["повторительный B2 без своих слов", ["m46"]],
  ["экзаменационный B2", ["m47"]],
  ["B2 без одного модуля", MODULES.filter((m) => +m.slice(1) >= 36 && m !== "m41")],
  ["весь каталог", MODULES.slice()],
];
for (const [name, own] of SETS) {
  const html = appshell.buildAppHtml(own); // сама сборка падает на утечке и на битом синтаксисе
  const data = new Set(appshell.dataModsFor(new Set(own)));
  assert.deepStrictEqual(foreignRefs(html, data), [], name + ": ссылок на модули вне сборки нет");

  const c = contentOf(html);
  for (const mid of own) assert.ok(c.CONTENT_READY.includes(mid), name + ": свой модуль " + mid + " готов");
  assert.ok(c.CONTENT_READY.includes("m0"), name + ": стартовый модуль есть в любом варианте");
  for (const mid of c.CONTENT_READY) {
    for (const v of c.CONTENT[mid].vocab) {
      if (!v.ref) continue;
      const donor = v.ref.startsWith("ph_") ? "m0" : v.ref.split("_")[0];
      assert.ok((c.CONTENT[donor] || {}).vocab && c.CONTENT[donor].vocab.some((x) => x.id === v.ref),
        name + ": донор " + donor + " для " + v.ref + " приехал");
    }
  }
  // чужие модули в интерфейсе не показываются, даже если их данные нужны как донорские
  for (const mid of c.CONTENT_READY) assert.ok(own.includes(mid) || mid === "m0", name + ": в реестре только свои модули");
}

/* 2. Замыкание транзитивно: донор донора обязан приехать (m12 → m7 → m4 — реальная цепочка) */
{
  const direct = appshell.DONORS.get("m12") || new Set();
  const closure = new Set(appshell.dataModsFor(new Set(["m12"])));
  let deeper = null;
  for (const d of direct) for (const dd of appshell.DONORS.get(d) || []) if (!direct.has(dd) && dd !== "m12") deeper = dd;
  if (deeper) assert.ok(closure.has(deeper), "донор донора (" + deeper + ") включён в вариант");
  assert.ok([...direct].every((d) => closure.has(d)), "прямые доноры включены");
}

/* 3. Полная сборка не зависит от аргументов и не мутируется вариантами */
{
  const full1 = appshell.buildAppHtml();
  appshell.buildAppHtml(["m1"]);
  assert.strictEqual(appshell.buildAppHtml(), full1, "полный файл стабилен между сборками вариантов");
  assert.strictEqual(appshell.buildAppHtml(MODULES.slice()).length > 0, true, "вариант со всеми модулями собирается");
}

/* 4. Реестры модулей режутся согласованно: MODULE_META, титулы и MODULE_EXTRAS */
{
  const own = ["m0", "m12", "m13"];
  const html = appshell.buildAppHtml(own);
  const meta = [...html.matchAll(/\{id:"(m\d+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(meta, own, "MODULE_META — ровно свои модули");
  for (const t of ["EN", "TR"]) {
    const block = html.match(new RegExp("const MODULE_TITLES_" + t + "=\\{([\\s\\S]*?)\\};"));
    assert.ok(block, "титулы " + t + " на месте");
    const ids = [...block[1].matchAll(/(m\d+):"/g)].map((m) => m[1]);
    assert.deepStrictEqual(ids, own, "титулы " + t + " — ровно свои модули");
  }
  const extras = [...html.matchAll(/^ (m\d+):\{ref:/gm)].map((m) => m[1]);
  assert.deepStrictEqual(extras, own, "MODULE_EXTRAS — ровно свои модули");
}

/* 5. Результатные модули (отнятый курс) едут урезанно: данные и реестры — да, занятия — нет */
{
  const html = appshell.buildAppHtml(["m0", "m1"], ["m12"]);
  const c = contentOf(html);
  assert.ok(c.CONTENT_READY.includes("m12"), "модуль отнятого курса виден в реестре — иначе результаты не нарисовать");
  assert.ok(c.CONTENT.m12.vocab.length, "его лексика приехала");
  assert.ok(!c.DIALOGS.m12, "диалоги — нет");
  assert.ok(!/function renderGrammarM12\(m\)\{/.test(html), "справочная страница — нет");
  assert.ok(!/^ m12:\{ref:/m.test(html), "и записи в MODULE_EXTRAS тоже нет");
  // то же для отнятого B1: результаты рисуются, занятия не едут
  const hb = appshell.buildAppHtml(["m0", "m1"], ["m24"]);
  const cb = contentOf(hb);
  assert.ok(cb.CONTENT_READY.includes("m24"), "отнятый B1-модуль виден в реестре");
  assert.ok(cb.CONTENT.m24.vocab.length, "его лексика приехала");
  assert.ok(!cb.DIALOGS.m24, "диалоги B1 — нет");
  assert.ok(!/function renderGrammarM24\(m\)\{/.test(hb), "справочная страница B1 — нет");
}

console.log("appshell.test.js: OK (наборы: одиночные, пары, межкурсовые, без m0, B1- и B2-наборы и повторительные, полный; доноры транзитивно; result-only A2 и B1)");
