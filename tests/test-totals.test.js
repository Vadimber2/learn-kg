"use strict";
/* Регрессия «/20 → total»: демо-тест ввёл переменную длину (lastAttempt.total), но у всех
   СУЩЕСТВУЮЩИХ учеников записи сохранены БЕЗ этого поля — три DOM-места обязаны рендерить
   их с фолбэком ||20. Тест не переписывает выражения, а ВЫДЁРГИВАЕТ их из исходника
   регекспом и исполняет с заглушками: легаси-запись → «17/20», новая (демо) → «9/10». */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();
const LEGACY = { score: 17, passed: true, date: "2026-08-01" };            // как у всех до демо
const FRESH = { score: 9, total: 10, passed: true, date: "2026-08-07" };   // демо-запись

function evalExpr(expr, sandbox) {
  vm.createContext(sandbox);
  return vm.runInContext("(" + expr + ")", sandbox);
}

// 1. Футер: `M0: 17/20 (сдана)` — выражение из updateFooter
const fm = html.match(/el\("f-test"\)\.textContent=((?:\(tst&&tst\.lastAttempt\))[\s\S]*?);\n/);
assert.ok(fm, "футерное выражение найдено");
for (const [rec, want] of [[LEGACY, "17/20"], [FRESH, "9/10"]]) {
  const out = evalExpr(fm[1], { tst: { lastAttempt: rec, everPassed: true }, metaOf: () => ({ num: "M0" }), t: (k) => k, activeModule: "m0" });
  assert.ok(out.includes(want), "футер: " + JSON.stringify(rec.total) + " → " + out);
}

// 2. Плитка обзора: `17/20` из renderOverview
const om = html.match(/statTile\(((?:\(mod\(\)\.test&&mod\(\)\.test\.lastAttempt\))[\s\S]*?:"—"),/);
assert.ok(om, "выражение плитки обзора найдено");
for (const [rec, want] of [[LEGACY, "17/20"], [FRESH, "9/10"]]) {
  const out = evalExpr(om[1], { mod: () => ({ test: { lastAttempt: rec } }) });
  assert.strictEqual(out, want, "плитка: " + JSON.stringify(rec.total) + " → " + out);
}

// 3. Интро теста: аргументы tf("test_last", {...}) — t обязан падать в 20 для легаси
const im = html.match(/tf\("test_last",(\{s:tst\.lastAttempt\.score,[\s\S]*?\})\)/);
assert.ok(im, "аргументы test_last найдены");
for (const [rec, wantT] of [[LEGACY, 20], [FRESH, 10]]) {
  const vars = evalExpr(im[1], { tst: { lastAttempt: rec }, t: (k) => k });
  assert.strictEqual(vars.s, rec.score);
  assert.strictEqual(vars.t, wantT, "test_last.t: " + JSON.stringify(rec.total) + " → " + vars.t);
}

// 4. Экран результата: `9/10 — ...` строится от this.items.length (total), порог — ceil(0.8)
const rm = html.match(/const total=this\.items\.length,th=Math\.ceil\(total\*0\.8\),passed=this\.score>=th/);
assert.ok(rm, "финиш: total/порог считаются от длины теста (не от констант 20/16)");

// 5. saveRoute при <base href="/"> (демо-страницы глубины 2): hash-URL обязан строиться
//    от location.pathname, иначе replaceState("#…") переписывает адрес на корень и
//    перезагрузка выбрасывает из /demo/<lang>. Прямая проверка поведения с заглушками.
const sm2 = html.match(/function routeToken\(\)\{[\s\S]*?\n\}\nfunction saveRoute\(\)\{[\s\S]*?\n\}/);
assert.ok(sm2, "routeToken+saveRoute извлечены");
for (const pathname of ["/demo/tr", "/"]) {
  let put = null;
  const rsb = {
    GLOBAL_TABS: ["settings"], activeTab: "cards", activeModule: "m0", rosterLogin: null,
    ROUTE_KEY: "x", localStorage: { setItem() {}, getItem: () => null },
    location: { pathname }, history: { replaceState: (a, b, u) => { put = u; } },
  };
  vm.createContext(rsb);
  vm.runInContext(sm2[0] + ";saveRoute();", rsb);
  assert.strictEqual(put, pathname + "#m0/cards", "saveRoute на " + pathname + " → " + put);
}

// 6. availableTabs: parseRoute питается от тех же определений, что сайдбар; демо —
//    только учебные вкладки и настройки, без преподавательских и «Мой прогресс»
const am = html.match(/function availableTabs\(\)\{[\s\S]*?\n\}/);
assert.ok(am, "availableTabs извлечена");
for (const [isDemo, want] of [
  [true, ["overview", "alphabet", "cards", "harmony", "test", "settings"]],
  [false, ["overview", "alphabet", "cards", "harmony", "test", "settings", "progress", "review", "students", "roster", "metodika"]],
]) {
  const tsb = {
    IS_DEMO: isDemo, activeModule: "m0",
    studyTabsFor: () => [["overview"], ["alphabet"], ["cards"], ["harmony"], ["test"]],
    TEACHER_TABS_DEF: [["review"], ["students"], ["roster"], ["metodika"]],
  };
  vm.createContext(tsb);
  const got = vm.runInContext(am[0] + ";availableTabs();", tsb);
  assert.deepStrictEqual([...got].sort(), [...want].sort(), "availableTabs при IS_DEMO=" + isDemo);
}

console.log("test-totals.test.js: OK (легаси без total → /20; демо → /10; порог от длины; saveRoute при base; availableTabs)");
