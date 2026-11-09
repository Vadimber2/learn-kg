"use strict";
/* Тест сборки колоды: блок ===CARDSQ=== исполняется без DOM.
   Фокус-колода (клик по слову в панелях дашборда) — самое хрупкое место механизма:
   она обязана сохранять порядок, не зависеть от выбранной темы и не подменяться
   обычной очередью. Ниже — прямые проверки этого, плюс греп-гарды на вызывающий код. */
const assert = require("assert");
const { html, loadBlock } = require("./helpers/block");

const sb = loadBlock("CARDSQ", { expose: ["buildFocusQueue", "buildSessionQueue"] });

const CARDS = {};
for (const id of ["m0_01", "m0_02", "m0_03", "m0_04", "m1_10"]) CARDS[id] = { id, ky: id };
const cardOf = (id) => CARDS[id] || null;
const NOW = 1000 * 86400000;
const deps = (state, skip) => ({
  stateOf: (id) => state[id] || null,
  skipped: (id) => (skip || []).includes(id),
  mastered: (id) => { const s = state[id]; return !!s && s.box >= 3 && s.due > NOW; },
  now: NOW,
  shuffle: (a) => a, // порядок фиксируем: тест про состав и фазы, не про случайность
});

/* 1. Фокус-колода: порядок кликов, чужие модули, неизвестные id, отложенные */
{
  const state = { m0_02: { box: 2, due: NOW + 5 * 86400000 } };
  const out = sb.buildFocusQueue(["m0_03", "m0_02", "m1_10", "нет-такого", "m0_04"], cardOf, deps(state, ["m0_04"]));
  assert.strictEqual(out.map((x) => x.c.id).join(), "m0_03,m0_02,m1_10", "порядок кликов сохранён");
  assert.strictEqual(out[0].phase, "rec", "новое слово — сначала узнавание");
  assert.strictEqual(out[1].phase, "type", "начатое слово — сразу ввод");
  assert.ok(!out.some((x) => x.c.id === "m0_04"), "отложенное слово в колоду не попадает");
  // слово чужого модуля обязано доехать: звёздочки и панели дашборда работают поверх модулей
  assert.ok(out.some((x) => x.c.id === "m1_10"), "слово другого модуля не теряется");
}

/* 2. Слово, сбитое ошибкой (бокс 0 с записью), идёт через узнавание, а не сразу на ввод */
{
  const out = sb.buildFocusQueue(["m0_01"], cardOf, deps({ m0_01: { box: 0, due: NOW } }));
  assert.strictEqual(out[0].phase, "rec", "исправляемое слово начинает с узнавания");
}

/* 3. Обычная сессия: сначала отлежавшие повторения, затем новые (порция 12) */
{
  const pool = [];
  for (let i = 0; i < 20; i++) pool.push({ id: "n" + i });
  pool.push({ id: "due1" }, { id: "later" });
  const state = { due1: { box: 2, due: NOW - 1 }, later: { box: 2, due: NOW + 86400000 } };
  const ses = sb.buildSessionQueue(pool, deps(state));
  assert.strictEqual(ses.practice, false, "есть что повторять — это не практика");
  assert.strictEqual(ses.items[0].c.id, "due1", "повторения идут первыми");
  assert.ok(!ses.items.some((x) => x.c.id === "later"), "слово с неистёкшим интервалом сегодня не спрашивается");
  assert.strictEqual(ses.items.length, 13, "повторения + порция новых (12)");
  assert.ok(ses.items.slice(1).every((x) => x.phase === "rec"), "новые слова — через узнавание");
}

/* 4. Очередь пуста → практика с честной пометкой (уровни в ней не растут — см. srs.test.js) */
{
  const pool = [{ id: "m0_01" }, { id: "m0_02" }];
  const state = { m0_01: { box: 2, due: NOW + 86400000 }, m0_02: { box: 3, due: NOW + 86400000 } };
  const ses = sb.buildSessionQueue(pool, deps(state));
  assert.strictEqual(ses.practice, true, "всё отлежало — режим практики");
  assert.strictEqual(ses.items.map((x) => x.c.id).join(), "m0_01", "закреплённое слово в практику не берём");
}

/* 5. Отложенные не появляются ни в одной ветке — включая практику */
{
  const pool = [{ id: "m0_01" }, { id: "m0_02" }];
  const ses = sb.buildSessionQueue(pool, deps({}, ["m0_01", "m0_02"]));
  assert.strictEqual(ses.items.length, 0, "отложенные не всплывают ни в новых, ни в практике");
}

/* 6. Вызывающий код: фокус-колода не должна фильтроваться темой и не должна теряться
   при повторной отрисовке вкладки — оба бага уже случались. */
const start = html.match(/ {2}start\(\)\{[\s\S]*?\n {2}\},/);
assert.ok(start, "Cards.start найден");
assert.ok(/buildFocusQueue\(want,\(id\)=>\{const c=cardById\(id\);/.test(start[0]), "фокус резолвится по всему контенту, а не по пулу темы");
assert.ok(/studyableCard\(c\)\?c:null/.test(start[0]), "слово закрытого модуля в фокус-колоду не попадает");
/* 7. Пул колоды: доступность слова считается по словарям ОТКРЫТЫХ модулей.
   Проверяем исполнением: слово A1, переиспользованное в модуле A2, ученик с одним A2
   законно учит, а звёздочка на слове отнятого курса материал не открывает. */
{
  const CARDS = { m1_01: { id: "m1_01", cat: "a" }, m2_09: { id: "m2_09", cat: "a" }, m12_01: { id: "m12_01", cat: "a" } };
  const p = loadBlock("CARDSPOOL", {
    sandbox: { console, ST: { marked: ["m1_01", "m2_09", "m12_01"], skip: [] }, cardsTopic: "__marked",
      CONTENT_READY: ["m0", "m12"], VOCAB: [CARDS.m12_01],
      cardById: (id) => CARDS[id] || null,
      // у ученика открыт только его курс; словарь m12 включает переиспользованное слово m1_01
      studyOpen: (mid) => mid === "m12" || mid === "m0",
      vocabIdsOf: (mid) => (mid === "m12" ? ["m12_01", "m1_01"] : []),
      notSkipped: (list) => list.filter((c) => !p.ST.skip.includes(c.id)) },
    expose: ["cardsPool", "markedCards", "studyableCard"],
  });
  assert.strictEqual(p.markedCards().map((c) => c.id).join(), "m1_01,m12_01",
    "слово своего модуля и переиспользованное — учатся, слово закрытого модуля (m2_09) — нет");
  p.ST.skip = ["m1_01", "m12_01"];
  assert.strictEqual(p.markedCards().length, 0, "отложенное не попадает и в звёздную колоду");
  p.ST.skip = [];
  p.cardsTopic = null;
  assert.strictEqual(p.cardsPool().map((c) => c.id).join(), "m12_01", "обычный пул — словарь активного модуля");
}
assert.ok(/cardsTopic=null;/.test(start[0]), "фокус-сессия сбрасывает липкую тему");
/* 6б. Возврат на вкладку продолжает сессию с той же карточки — уход в диалоги/прогресс
   не повод терять место (жалоба владельца: «возвращаюсь — появляется случайная»).
   Новая очередь — только по явному поводу: фокус-колода, смена модуля или темы. */
assert.ok(/if\(!FOCUS_POOL&&this\.cur&&this\.key===activeModule\+"\|"\+\(cardsTopic\|\|""\)\)\{/.test(start[0]),
  "возврат на вкладку возобновляет живую сессию");
assert.ok((start[0].match(/this\.key=activeModule\+"\|"\+\(cardsTopic\|\|""\);/g) || []).length >= 2,
  "ключ сессии проставляется в обеих ветках старта (фокус и обычная)");
/* 6в. Недописанный ответ переживает уход с вкладки: черновик привязан к id карточки,
   восстанавливается при возврате и не утекает на следующую карточку. */
const typing = html.match(/renderTyping\(area,c\)\{[\s\S]*?\n {2}\},/);
assert.ok(typing && /this\.draft&&this\.draft\.id===c\.id\)input\.value=this\.draft\.value/.test(typing[0]),
  "черновик восстанавливается только на своей карточке");
assert.ok(/this\.draft=\{id:c\.id,value:input\.value\}/.test(typing[0]), "черновик пишется по мере ввода");
assert.ok(/this\.cur=this\.queue\.shift\(\);\n\s*this\.draft=null;/.test(html), "следующая карточка начинает с чистого поля");
assert.ok(/if\(!el\("cards-area"\)\)return;/.test(start[0]), "без отрисованной оболочки фокус-колода не потребляется");
assert.ok(/cardsTopic=null;closeSidePanel\(\)/.test(html), "переход из панели сбрасывает тему карточек");
const setMod = html.match(/function setModule\(id,keepTab\)\{[\s\S]*?\n\}/);
assert.ok(setMod && /fetchReviewData\(\)/.test(setMod[0]), "setModule с догрузкой данных модуля найден");
assert.ok(/activeTab==="cards"&&Cards\.cur/.test(setMod[0]), "догрузка не перезапускает начатую сессию карточек");

/* 7. Правила и темы за разворотом (просьба владельца): исполнение renderCardsShell —
   свёрнуто по умолчанию со строкой «что скрыто · текущая тема», клик раскрывает и
   запоминает в ST.settings.cardsHelp, повторная отрисовка уважает память выбора */
{
  const vm = require("vm");
  const shellFn = html.match(/function renderCardsShell\(m\)\{[\s\S]*?\n\}\n/);
  assert.ok(shellFn, "renderCardsShell в сборке");
  const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], style: {},
    set textContent(v) { this.kids = v === "" ? [] : [v]; },
    get textContent() { return this.kids.filter((k) => typeof k === "string").join(""); },
    append(...k) { this.kids.push(...k); },
    addEventListener(type, fnc) { (this.on = this.on || {})[type] = fnc; } });
  const flat = (n, acc) => { if (!n || !n.kids) return acc;
    for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
  const render = (sb0) => {
    const root = mkNode("main");
    const sb = Object.assign({ console, t: (k) => k,
      h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
      cardsTopicName: () => "ТЕМА", saved: 0, save() { sb.saved++; }, ROOT: root }, sb0);
    vm.createContext(sb);
    vm.runInContext(shellFn[0] + "; renderCardsShell(this.ROOT);", sb);
    const all = flat(root, [root]);
    return { sb,
      help: all.find((n) => n.attrs.id === "cards-help"),
      tgl: all.find((n) => n.attrs.id === "cards-help-tgl"),
      bar: all.find((n) => n.attrs.id === "cards-progress") };
  };
  const r = render({ ST: {} });
  assert.strictEqual(r.help.style.display, "none", "по умолчанию правила и темы свёрнуты");
  assert.strictEqual(r.tgl.textContent, "▸ cards_help_tgl · ТЕМА", "строка сворота называет скрытое и тему");
  assert.ok(r.bar, "прогресс-бар остаётся видимым (вне сворота)");
  r.tgl.on.click();
  assert.strictEqual(r.help.style.display, "", "клик раскрывает блок");
  assert.strictEqual(r.sb.ST.settings.cardsHelp, true, "выбор записан в настройки");
  assert.strictEqual(r.sb.saved, 1, "и сохранён между сессиями");
  assert.strictEqual(r.tgl.textContent, "▾ cards_help_tgl", "в раскрытом виде тема не дублируется");
  r.tgl.on.click();
  assert.strictEqual(r.help.style.display, "none", "повторный клик сворачивает");
  assert.strictEqual(r.sb.ST.settings.cardsHelp, false);
  const r2 = render({ ST: { settings: { cardsHelp: true } } });
  assert.strictEqual(r2.help.style.display, "", "память выбора: новая отрисовка стартует раскрытой");
  // свёрнутая строка не врёт о теме: хвост renderCardTopics обновляет её
  assert.ok(/const tg=el\("cards-help-tgl"\);\s*\n\s*if\(tg&&!\(ST\.settings&&ST\.settings\.cardsHelp\)\)tg\.textContent="▸ "\+t\("cards_help_tgl"\)\+" · "\+cardsTopicName\(\);/.test(html),
    "renderCardTopics освежает свёрнутую строку при смене темы");
  // титул сворота — во всех трёх словарях
  assert.strictEqual((html.match(/cards_help_tgl:"/g) || []).length, 3, "cards_help_tgl есть в ru/en/tr");
}

console.log("cardsq.test.js: OK (фокус-колода, фазы, порция новых, практика, отложенные, разворот правил)");
