"use strict";
/* Итоговая проверка курса learn.kg, уровень A1 (вкладка недели m11).

   Решение владельца 30.10.2026: проверка — собственная. Общие инварианты всех
   спецификаций и зоны (нет цитат, источников, названия) стережёт exam-b1.test.js;
   здесь — то, что особо у A1, на банке и текстах ИМЕННО курса A1 (механизм,
   параметризованный курсом, тестируется на каждом элементе набора):
   1) состав A1: письмо — один лист вопросов курса, речь — вопросы вслух и рассказ;
   2) вопросы — фразы курса A1 (сверка по id и тексту), тема — модуль A1;
   3) экраны письма и речи — без кыргызских инструкций, только фразы курса;
   4) адверсарные атаки на задания и тексты. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const { html, blockSrc, loadBlock } = require("./helpers/block");
// каталог модулей — из сборки: «модули A1» берутся из него, а не арифметикой над id
const META = (() => {
  const bx = { console }; vm.createContext(bx);
  vm.runInContext(html.match(/const MODULE_META=\[[\s\S]*?\];/)[0] + "; this.M=MODULE_META;", bx);
  return JSON.parse(JSON.stringify(bx.M));
})();
const A1_MODS = META.filter((m) => m.course === "a1").map((m) => m.id);

/* ---------- спецификация приезжает ученику ---------- */
const sb = loadBlock("EXAM-A1", { expose: ["EXAM_A1", "EXAM_SPECS"] });
const E = JSON.parse(JSON.stringify(sb.EXAM_A1));
assert.strictEqual(JSON.parse(JSON.stringify(sb.EXAM_SPECS)).a1.level, "A1",
  "спека A1 зарегистрирована в реестре EXAM_SPECS");

/* ---------- 0б. Состав A1 — свой ---------- */
{
  assert.ok(!("practice" in E) && !("retake" in E) && !("themes" in E) && !("descriptors" in E),
    "в спеке A1 нет ни практики чужого экзамена, ни пересдачи, ни тем, ни дескрипторов");
  const jz = E.subtests.find((x) => x.id === "jazuu"), sp = E.subtests.find((x) => x.id === "suiloo");
  assert.ok(jz.qPick > 0 && !jz.minSent && jz.tasks === 1, "Жазуу A1 — один лист письменных ответов на вопросы");
  assert.ok(sp.qPick > 0 && sp.minSec > 0 && sp.maxSec > sp.minSec && sp.tasks === 2, "Сүйлөө A1 — вопросы вслух и рассказ");
  assert.deepStrictEqual(E.topicSkip, ["m0", "m10"], "фонетика и неделя объединения темой рассказа не служат");
}

/* ---------- 0в. Таблица стратегии каждой экзаменационной недели называет ВСЕ пять субтестов ----------
   (владелец 29.10.2026: «где Грамматика?» — в М11 строки «Лексика. Грамматика» не было вовсе).
   Рендерер исполняется со шпионом harmonyTable, первая колонка строк сверяется с официальными субтестами. */
{
  const OFFICIAL = E.subtests.map((x) => x.ky);
  assert.strictEqual(OFFICIAL.length, 5, "пять частей проверки в спеке");
  for (const fn of ["renderRefM11", "renderRefM23", "renderRefM35", "renderRefM47"]) {
    const src = html.match(new RegExp("function " + fn + "\\(m\\)\\{[\\s\\S]*?\\n\\}"));
    assert.ok(src, fn + " в сборке");
    const tables = [];
    const node = () => ({ append() {}, kids: [] });
    const ctx = { L: (ru) => ru, h: () => node(), kgw: (w) => w, appendKids: () => node(), icon: () => null,
      harmonyTable: (head, rows) => { tables.push(rows.map((r) => String(r[0]))); return node(); } };
    vm.createContext(ctx);
    for (let k = 0; ; k++) {
      try { vm.runInContext(src[0] + "; " + fn + "({append(){}});", ctx); break; }
      catch (e) { const mm = /^(\w+) is not defined$/.exec(e.message); assert.ok(mm && k < 30, fn + ": " + e.message); ctx[mm[1]] = () => node(); tables.length = 0; }
    }
    const strat = tables.find((t) => t.includes("Жазуу") && t.includes("Сүйлөө"));
    assert.ok(strat, fn + ": таблица стратегии по субтестам найдена");
    for (const sub of OFFICIAL) assert.ok(strat.includes(sub), fn + ": в таблице стратегии нет субтеста «" + sub + "»");
  }
}

/* ---------- 6. Реестры: m11 — экзаменационная неделя A1 ---------- */
{
  const MODS = JSON.parse(JSON.stringify(loadBlock("EXAM-B1", { expose: ["EXAM_MODS"] }).EXAM_MODS));
  assert.ok(MODS.includes("m11"), "m11 в реестре модулей со вкладкой экзамена: " + MODS.join(","));
  const m11 = META.find((m) => m.id === "m11");
  assert.ok(m11 && m11.exam === true && m11.course === "a1", "m11 — exam:true курса a1");
}

console.log("exam-a1.test.js: OK (своя проверка A1: " + E.subtests.map((x) => x.id + " " + x.tasks + "/" + x.min).join(", ") + ")");

/* ---------- 7. Тексты Окуу/Угуу A1: вычитка машиной ---------- */
{
  const TEXTS = JSON.parse(JSON.stringify(loadBlock("EXAM-TEXTS-A1", { expose: ["EXAM_TEXTS_A1"] }).EXAM_TEXTS_A1));
  assert.ok(TEXTS.filter((x) => x.kind === "okuu").length >= 3, "текстов Окуу A1 не меньше трёх");
  assert.ok(TEXTS.filter((x) => x.kind === "uguu").length >= 2, "текстов Угуу A1 не меньше двух");

  const CONTENT = require("../deploy/gen-audio").loadData().CONTENT;
  const byId = {};
  for (const [mid, c] of Object.entries(CONTENT)) {
    if (!A1_MODS.includes(mid)) continue;   // словарь ИМЕННО курса A1 — по каталогу
    for (const v of c.vocab || []) if (v && v.id && v.ky) byId[v.id] = String(v.ky);
  }
  const seen = new Set();
  for (const T of TEXTS) {
    assert.ok(!seen.has(T.id), "id текста уникален: " + T.id);
    seen.add(T.id);
    assert.ok(["okuu", "uguu"].includes(T.kind), T.id + ": субтест назван верно");
    assert.ok(!("topic" in T), T.id + ": у текста нет поля чужой темы");
    for (const l of ["ru", "en", "tr"]) assert.ok(T.title[l], T.id + ": заголовок на " + l);
    assert.ok(T.lines.length >= 6, T.id + ": текст не короче шести предложений");
    for (const ln of T.lines) {
      assert.ok(ln.src, T.id + ": у предложения указан источник");
      assert.ok(byId[ln.src], T.id + ": фраза " + ln.src + " есть в словаре курса A1");
      assert.strictEqual(ln.ky, byId[ln.src], T.id + " / " + ln.src + ": предложение расходится с вычитанной фразой");
      assert.ok(A1_MODS.includes(ln.src.split("_")[0]), T.id + ": предложение из модуля A1");
    }
    assert.ok(T.qs.length >= 5, T.id + ": к тексту не меньше пяти вопросов");
    const body = T.lines.map((l) => l.ky.toLowerCase());
    for (const q of T.qs) {
      assert.ok(Number.isInteger(q.s) && q.s >= 0 && q.s < T.lines.length, T.id + ": номер предложения-ответа в тексте");
      assert.ok(/[?]$/.test(q.ky), T.id + ": вопрос на кыргызском со знаком вопроса — «" + q.ky + "»");
      assert.strictEqual(q.opts.length, 4, T.id + ": четыре варианта у «" + q.ky + "»");
      assert.strictEqual(new Set(q.opts).size, 4, T.id + ": варианты не повторяются");
      const right = q.opts[q.c].toLowerCase();
      assert.ok(body[q.s].includes(right),
        T.id + " / «" + q.ky + "»: ответ «" + q.opts[q.c] + "» обязан встречаться в предложении " + (q.s + 1));
      for (let k = 0; k < q.opts.length; k++) {
        if (k === q.c) continue;
        assert.ok(!body.some((s) => s.includes(q.opts[k].toLowerCase())),
          T.id + " / «" + q.ky + "»: неверный вариант «" + q.opts[k] + "» тоже есть в тексте — у вопроса два ответа");
      }
    }
    if (T.kind === "uguu") assert.strictEqual(T.audio, "lines", T.id + ": режим аудирования — lines");
  }
  console.log("  тексты A1: " + TEXTS.length + ", предложений " + TEXTS.reduce((a, t8) => a + t8.lines.length, 0) +
    " — все сверены с вычитанными фразами курса A1, вопросов " + TEXTS.reduce((a, t8) => a + t8.qs.length, 0));
}

/* ---------- 8. Движок на банке A1: полнота и адверсарные атаки ----------
   На A1 нет кыргызских дефиниций (def — канон B1), поэтому типов шесть из семи;
   однообразие и подсказки формой атакуются так же, как у B1. */
{
  const box = loadBlock("EXAM", { expose: ["examBank", "examItems", "EXAM_KINDS"] });
  const CONTENT = require("../deploy/gen-audio").loadData().CONTENT;   // examBank только читает — клон не нужен
  const bank = box.examBank(CONTENT, A1_MODS.filter((id) => CONTENT[id]), require("../deploy/gen-audio").loadData().DIALOGS);
  const N = E.subtests[0].tasks;
  assert.ok(bank.drills.length + bank.lex.length >= N * 2,
    "банк A1 вдвое больше субтеста (" + (bank.drills.length + bank.lex.length) + " против " + N + ")");

  const posHist = {}, kindHist = {};
  let checked = 0;
  const prev = [];
  for (let v = 0; v < 12; v++) {
    const items = box.examItems(bank, N, 1000 + v * 137);
    assert.ok(items.length >= N * 0.95, "вариант " + v + ": субтест собран целиком (" + items.length + ")");
    assert.strictEqual(new Set(items.map((x) => x.ref)).size, items.length, "вариант " + v + ": без повторов");
    if (prev.length) {
      const same = items.filter((x) => prev.includes(x.ref)).length / items.length;
      assert.ok(same < 0.7, "вариант " + v + ": пересечение с предыдущим " + Math.round(same * 100) + "%");
    }
    prev.length = 0; prev.push(...items.map((x) => x.ref));
    const kinds = {};
    for (const it of items) {
      checked++;
      kinds[it.t] = (kinds[it.t] || 0) + 1;
      kindHist[it.t] = (kindHist[it.t] || 0) + 1;
      posHist[it.c] = (posHist[it.c] || 0) + 1;
      const right = String(it.opts[it.c]);
      assert.strictEqual(it.opts.length, 4, it.ref + ": ровно четыре варианта");
      for (const o of it.opts) assert.ok(String(o).trim().length > 0, it.ref + ": пустой вариант");
      const norm2 = (x) => String(x).toLowerCase().replace(/[.,!?;:\s]+$/, "").trim();
      assert.strictEqual(new Set(it.opts.map(norm2)).size, 4, it.ref + ": два варианта совпадают по сути");
      if (it.t !== "odd") assert.ok(String(it.q).trim().length > 0, it.ref + ": задание без вопроса");
      const lens = it.opts.map((x) => String(x).length);
      const mx = Math.max(...lens), mn = Math.min(...lens);
      if (lens.filter((l) => l === mx).length === 1)
        assert.ok(!(lens[it.c] === mx && mx > mn * 2.5), it.ref + ": верный — единственный длинный");
      if (lens.filter((l) => l === mn).length === 1)
        assert.ok(!(lens[it.c] === mn && mx > mn * 2.5), it.ref + ": верный — единственный короткий");
      const caps = it.opts.filter((x) => /^[А-ЯЁӨҮҢ]/.test(String(x)));
      if (caps.length === 1) assert.ok(caps[0] !== right, it.ref + ": верный — единственный с заглавной");
      const dots = it.opts.filter((x) => /[.!?]$/.test(String(x)));
      if (dots.length === 1) assert.ok(dots[0] !== right, it.ref + ": верный — единственный с точкой");
      if (it.t === "cloze") {
        assert.ok(it.q.includes("____"), it.ref + ": в предложении есть пропуск");
        assert.ok(it.explain && it.explain.ky.toLowerCase().includes(right.toLowerCase()),
          it.ref + ": вставка ответа даёт фразу курса");
      }
      if (it.t === "order") {
        const ref = it.explain.ky.replace(/[.!?]$/, "");
        assert.strictEqual(right, ref, it.ref + ": верный порядок — фраза курса дословно");
      }
      assert.ok(it.explain && it.explain.ky, it.ref + ": нет разбора — ошибка ничему не научит");
      // служебные пометки курса не протекают в задания (класс бага «(М9)»)
      const SERVICE = /\(М\d|\(\d+-е|\(образц|\(пример|М\d\)/i;
      assert.ok(!SERVICE.test(String(it.q)), it.ref + ": служебная пометка в вопросе");
      for (const o of it.opts) assert.ok(!SERVICE.test(String(o)), it.ref + ": служебная пометка в варианте");
    }
    assert.ok(Object.keys(kinds).length >= 5, "вариант " + v + ": типов " + Object.keys(kinds).length + " — мало");
    for (const [k, n] of Object.entries(kinds))
      assert.ok(n <= N * 0.45, "вариант " + v + ": тип " + k + " занимает " + n + " из " + N);
  }
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35, "позиция " + pos + ": " + Math.round(share * 100) + "%");
  }
  // на A1 живут все кыргызские типы, кроме def (дефиниций у уровня нет)
  assert.strictEqual(Object.keys(kindHist).sort().join(","),
    JSON.parse(JSON.stringify(box.EXAM_KINDS)).filter((k) => k !== "def").sort().join(","),
    "на банке A1 живут все типы, кроме def: " + Object.keys(kindHist).join(","));
  assert.ok(!kindHist.def, "тип def на A1 не выпускается: дефиниций у уровня нет (канон B1)");
  console.log("  адверсарно проверено заданий A1: " + checked + " в 12 вариантах, типов " +
    Object.keys(kindHist).length + " (" + Object.entries(kindHist).map(([k, n]) => k + ":" + n).join(" ") + ")");
}

/* ---------- 9. Тексты A1 сквозь движок: шафл и позиции ---------- */
{
  const box = loadBlock(["EXAM-TEXTS-A1", "EXAM"], { expose: ["examTextItems", "EXAM_TEXTS_A1"] });
  box.T = box.EXAM_TEXTS_A1;
  const posHist = {}; let checked = 0;
  for (let v = 0; v < 30; v++) {
    for (const kind of ["okuu", "uguu"]) {
      const texts = JSON.parse(JSON.stringify(box.T)).filter((x) => x.kind === kind);
      const items = JSON.parse(JSON.stringify(box.examTextItems(texts, 30, 1000 + v * 137)));
      assert.ok(items.length >= 10, kind + " v" + v + ": заданий из текстов " + items.length);
      for (const it of items) {
        checked++;
        posHist[it.c] = (posHist[it.c] || 0) + 1;
        const orig = texts.find((t8) => t8.id === it.textId).qs[Number(it.ref.split("_").pop())];
        assert.strictEqual(String(it.opts[it.c]), orig.opts[orig.c], it.ref + ": верный ответ съехал при шафле");
        assert.strictEqual(new Set(it.opts).size, 4, it.ref + ": варианты уникальны");
      }
    }
  }
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35, "тексты A1: позиция " + pos + " = " + Math.round(share * 100) + "%");
  }
  console.log("  текстовые задания A1: " + checked + " в 30 вариантах, позиции равномерны");
}

/* ---------- 9б. Длинные тексты из диалогов курса (отзыв ученицы 29.10.2026:
   на реальном A1 тексты «гораздо длиннее») — на реальных данных курса A1 ---------- */
{
  const box = loadBlock(["EXAM-TEXTS-A1", "EXAM"], { expose: ["examTextItems", "examDialogTexts", "EXAM_TEXTS_A1", "Exam"] });
  const { DIALOGS, CONTENT } = require("../deploy/gen-audio").loadData();
  const mods = A1_MODS.filter((id) => CONTENT[id]);
  const words = (T) => T.lines.map((l) => l.ky).join(" ").split(/\s+/).length;
  const reg = JSON.parse(JSON.stringify(box.EXAM_TEXTS_A1)).filter((x) => x.kind === "okuu");
  const regAvg = reg.reduce((a, T) => a + words(T), 0) / reg.length;
  const RU = new Set();
  for (const d of Object.values(DIALOGS)) for (const p of d.parts || []) for (const q of p.quiz || []) RU.add(q.qRu);
  let dlAvg = 0;
  for (const kind of ["okuu", "uguu"]) {
    const dl = JSON.parse(JSON.stringify(box.examDialogTexts(DIALOGS, mods, kind)));
    assert.ok(dl.length >= 10, kind + ": диалоговых текстов A1 " + dl.length);
    const avg = dl.reduce((a, T) => a + words(T), 0) / dl.length;
    if (kind === "okuu") dlAvg = avg;
    assert.ok(avg >= regAvg * 2, kind + ": диалоговый текст длиннее реестрового хотя бы вдвое (" + Math.round(avg) + " против " + Math.round(regAvg) + " слов)");
    let withProof = 0, nq = 0;
    for (const T of dl) {
      assert.ok(mods.includes(T.id.split("_")[1]), T.id + ": текст из модуля курса A1");
      assert.ok(T.title.ky !== undefined && !T.title.ru, T.id + ": заголовок кыргызский, без русского");
      if (kind === "uguu") assert.ok(T.audio === "lines" && T.lines.every((l) => /^ph_/.test(l.src)), T.id + ": у каждой реплики дорожка");
      for (const q of T.qs) {
        nq++;
        assert.ok(!RU.has(q.ky), T.id + ": вопрос на русском");
        assert.strictEqual(new Set(q.opts).size, 4, T.id + ": четыре разных варианта");
        if (q.s >= 0) withProof++;
      }
    }
    assert.ok(withProof / nq >= 0.5, kind + ": у большинства вопросов найдена реплика-доказательство (" + withProof + "/" + nq + ")");
    // сквозь движок: полный лист, разбор не падает и без реплики-доказательства
    const items = JSON.parse(JSON.stringify(box.examTextItems(reg.concat(dl).filter((x) => x.kind === kind), 30, 77)));
    assert.strictEqual(items.length, 30, kind + ": лист из 30 вопросов собран");
    for (const it of items) {
      assert.ok(it.explain && it.explain.ky, it.ref + ": разбор есть");
      assert.ok(A1_MODS.includes(it.mod), it.ref + ": mod — модуль A1, а не " + it.mod);
    }
  }
  // вкладка экзамена A1 видит диалоговые тексты своего курса и не видит чужих
  box.MODULE_META = [{ id: "m1", course: "a1" }, { id: "m3", course: "a1" }, { id: "m24", course: "b1" }];
  box.DIALOGS = DIALOGS;
  const ids = JSON.parse(JSON.stringify(vm.runInContext("Exam.texts('okuu','a1').map(x=>x.id)", box)));
  assert.ok(ids.some((x) => /^dlg_m3_/.test(x)) && ids.some((x) => /^dlg_m1_/.test(x)), "Окуу A1: тексты из диалогов курса");
  assert.ok(!ids.some((x) => /^dlg_m24_/.test(x)), "диалоги B1 в Окуу A1 не попадают");
  console.log("  длинные тексты A1 из диалогов: " + Math.round(dlAvg) + " слов против " + Math.round(regAvg) + " у реестровых");
}

/* ---------- 10. Продуктивные листы A1 из движка: фразы курса A1, темы — модули A1 ---------- */
{
  const { CONTENT, DIALOGS } = require("../deploy/gen-audio").loadData();
  const box = loadBlock(["EXAM-A1", "EXAM"], { expose: ["Exam"],
    sandbox: { MODULE_META: META, CONTENT: JSON.parse(JSON.stringify(CONTENT)), DIALOGS } });
  vm.runInContext("Exam.course='a1'; Exam.spec=EXAM_A1;", box);
  const byId = {};
  for (const id of A1_MODS) for (const v of (CONTENT[id] || {}).vocab || []) if (v && v.id && v.ky && !v.ref) byId[v.id] = v.ky;
  const run = (kind, seed) => JSON.parse(JSON.stringify(vm.runInContext(
    "Exam.itemsFor(Exam.spec.subtests.find(x=>x.id==='" + kind + "'), " + seed + ")", box)));
  const jazItems = run("jazuu", 42);
  const jz = E.subtests.find((s2) => s2.id === "jazuu");
  assert.strictEqual(jazItems.length, 1, "Жазуу A1 — одно задание-лист");
  assert.strictEqual(jazItems[0].qs.length, jz.qPick, "в листе ровно qPick вопросов");
  assert.strictEqual(new Set(jazItems[0].qs).size, jazItems[0].qs.length, "вопросы не повторяются");
  jazItems[0].qs.forEach((q, i) => assert.strictEqual(byId[jazItems[0].qSrc[i]], q, "вопрос — дословно фраза курса A1: " + q));
  assert.deepStrictEqual(run("jazuu", 42), jazItems, "один сид — тот же лист (обновление страницы не меняет вопросы)");
  assert.notDeepStrictEqual(run("jazuu", 777)[0].qs, jazItems[0].qs, "другой сид — другие вопросы");

  const spkItems = run("suiloo", 42);
  const sSpec = E.subtests.find((s2) => s2.id === "suiloo");
  assert.strictEqual(spkItems.length, 2, "Сүйлөө A1 — два задания");
  assert.deepStrictEqual(spkItems.map((x) => x.part), [1, 2], "задания идут по порядку 1 → 2");
  assert.strictEqual(spkItems[0].qs.length, sSpec.qPick, "зад.1: выбрано " + sSpec.qPick + " вопросов");
  spkItems[0].qs.forEach((q, i) => assert.strictEqual(byId[spkItems[0].qSrc[i]], q, "зад.1: фраза курса A1"));
  assert.notDeepStrictEqual(spkItems[0].qs, jazItems[0].qs.slice(0, sSpec.qPick), "лист речи не повторяет лист письма");
  const top = spkItems[1].topic;
  const mm = META.find((m) => m.id === top.mod);
  assert.ok(mm && mm.course === "a1" && !mm.exam && !E.topicSkip.includes(mm.id), "зад.2: тема — модуль A1: " + top.mod);
  assert.strictEqual(top.ru, mm.title, "тема — название модуля");
  console.log("  продуктивные листы A1: Жазуу " + jz.qPick + " вопросов, Сүйлөө " + sSpec.qPick +
    " + рассказ на тему модуля — фразы и модули курса A1, детерминированы сидом");
}

/* ---------- 11. Экраны Жазуу и Сүйлөө A1 — исполнение с DOM-стабом ---------- */
const { examBox, flat, textOf, drawnWith } = require("./helpers/exam-box");
const { fakeMic } = require("./helpers/mic-mock");
const SPEC_OF = (level, subtests) => ({ level, subtests });
{
  const SPEC = SPEC_OF("A1", [
    { id: "jazuu", ky: "Жазуу", ru: "ж", en: "j", tr: "j", tasks: 1, min: 25, kind: "write", qPick: 3 },
    { id: "suiloo", ky: "Сүйлөө", ru: "г", en: "s", tr: "k", tasks: 2, min: 25, kind: "speak", qPick: 2, minSec: 30, maxSec: 90 },
  ]);
  // словарь курса: пять вопросов и обычные фразы; модуль m1 — тема рассказа
  const VOC = ["Бир сөз?", "Эки сөз?", "Үч сөз?", "Төрт сөз?", "Беш сөз?", "Мен барам."]
    .map((ky, i) => ({ id: "m1_" + i, ky, ru: "р" + i }));
  const box = examBox({ MODULE_META: [{ id: "m1", course: "a1", title: "О себе" }, { id: "m11", course: "a1", exam: true }],
    CONTENT: { m1: { drill: [], vocab: VOC }, m11: { drill: [], vocab: [] } },
    EXAM_A1_SPEC: JSON.parse(JSON.stringify(SPEC)) });
  vm.runInContext("Exam.spec=EXAM_A1_SPEC; Exam.course='a1'; Exam.begin();", box);
  const area = box.area, seen = () => textOf(area);
  // Жазуу: инструкция на языке интерфейса, ровно qPick вопросов курса списком, поле ввода
  const KY_OK = new Set(VOC.map((v) => v.ky));
  let ol = flat(area).find((n) => n.tag === "ol");
  assert.ok(ol && ol.kids.length === 3, "жазуу: вопросы выданы списком (qPick=3): " + (ol && ol.kids.length));
  for (const li of ol.kids) assert.ok(KY_OK.has(li.kids[0]), "жазуу: на экране фраза курса — " + li.kids[0]);
  assert.ok(seen().includes("exam_w_qs"), "жазуу: инструкция — строка словаря, а не кыргызский текст");
  assert.ok(flat(area).some((n) => n.tag === "textarea"), "жазуу: поле ввода есть");
  assert.ok(seen().includes("exam_w_chk"), "жазуу: наша памятка самопроверки подключена");
  // кыргызский на экране письма — только фразы курса (кириллица вне подписей субтеста)
  const kyNodes = flat(area).filter((n) => /kgword/.test(String(n.attrs.class || "")));
  for (const n of kyNodes) assert.ok(n.kids.every((k) => typeof k !== "string" || KY_OK.has(k)), "kgword — только фраза курса: " + n.kids);
  // «Отправить»: два ответа — своя подпись формата (без {a}–{b}); три строки без точек —
  // уходит POST с вопросами отдельным полем и курсом попытки
  const posted = [];
  box.fetch = (url, opt) => { posted.push({ url, body: JSON.parse(opt.body) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "w1" }) }); };
  const ta = flat(area).find((n) => n.tag === "textarea");
  const sendBtn = flat(area).find((n) => n.tag === "button" && n.kids.includes("exam_send"));
  assert.ok(ta && sendBtn, "поле ввода и кнопка отправки на экране");
  ta.value = "Бишкекте\nсаат жетиде";
  sendBtn.attrs.onclick();
  assert.ok(flat(area).some((n) => n.tag === "p" && String(n.textContent || "").includes("exam_w_short_qs")),
    "короткий ответ объяснён строкой формата вопросов, не {a}–{b}");
  assert.strictEqual(posted.length, 0, "и не отправлен");
  ta.value = "Бишкекте\nсаат жетиде\nдарыгер";
  sendBtn.attrs.onclick();
  assert.strictEqual(posted.length, 1, "три ответа построчно без точек — работа отправлена");
  assert.strictEqual(posted[0].body.qs.length, 3, "в теле — все три вопроса листа отдельным полем");
  assert.ok(posted[0].body.qs.every((q) => KY_OK.has(q)), "и это вопросы курса");
  assert.strictEqual(posted[0].body.topic, "exam_qs_topic", "тема листа вопросов — подпись задания (не пустая: сервер требует тему)");
  assert.strictEqual(posted[0].body.kind, "jazuu", "субтест назван");
  assert.ok(posted[0].body.topic.length <= 120, "тема короткая — сервер её не режет");
  // отклик придёт асинхронно; переход дальше — вручную тем же advance, что зовёт then()
  vm.runInContext("Exam.advance(Exam.tokenOf());", box);
  ol = flat(area).find((n) => n.tag === "ol");
  assert.ok(seen().includes("exam_s_qs"), "сүйлөө: подводка задания 1 — строка словаря");
  assert.ok(ol && ol.kids.length === 2, "сүйлөө: 2 вопроса списком");
  for (const li of ol.kids) assert.ok(KY_OK.has(li.kids[0]), "сүйлөө: вопрос — фраза курса");
  assert.ok(seen().includes("exam_s_hint"), "сүйлөө: подсказка по записи — строка словаря");
  assert.ok(flat(area).some((n) => n.attrs && n.attrs.class === "btnrow"), "сүйлөө: ряд действий — btnrow");
  // Запись идёт, и ученик жмёт «Пропустить»: микрофон гаснет, холд самообновления снят
  // (раньше MediaRecorder и дорожки микрофона жили дальше — ревью 25.09.2026)
  const holds = {};
  const mic = fakeMic({ syncOnstop: true, syncMedia: true });   // секция исполняется без await
  box.updateHold = (k, on) => { holds[k] = on; };
  box.Blob = class { constructor() { this.size = 1; } };
  box.navigator = mic.navigator; box.MediaRecorder = mic.MediaRecorder;
  const recBtn = flat(area).find((n) => n.tag === "button" && n.kids.includes("stt_rec"));
  assert.ok(recBtn && recBtn.ev && recBtn.ev.click, "кнопка записи на экране");
  recBtn.ev.click();
  const rec = mic.recs[0];
  assert.strictEqual(rec && rec.state, "recording", "запись пошла");
  assert.strictEqual(holds.rec, true, "самообновление ждёт запись");
  const skipBtn = flat(area).find((n) => n.tag === "button" && n.kids.includes("exam_skip"));
  skipBtn.attrs.onclick();
  assert.strictEqual(rec.state, "inactive", "«Пропустить» остановил запись");
  assert.ok(mic.tracks.length && !mic.live(), "дорожки микрофона отпущены");
  assert.strictEqual(holds.rec, false, "холд самообновления снят");
  // запись идёт, а ученик ушёл на вкладку экзамена (интро тренировки) — микрофон тоже гаснет
  {
    const recBtn2 = flat(area).find((n) => n.tag === "button" && n.kids.includes("stt_rec"));
    recBtn2.ev.click();
    const rec2 = mic.recs[mic.recs.length - 1];
    assert.strictEqual(rec2.state, "recording", "вторая запись идёт");
    vm.runInContext("Exam.st.train=true; Exam.render({append(){}});", box);
    assert.strictEqual(rec2.state, "inactive", "уход на интро экзамена остановил запись");
    assert.ok(!mic.live(), "микрофон отпущен");
    vm.runInContext("Exam.st.train=false; Exam.step();", box);   // назад к заданию для проверок ниже
  }
  // зад.2 — рассказ на тему модуля (перешли той же кнопкой «Пропустить»)
  assert.ok(seen().includes("exam_s_ask") && seen().includes("О себе"), "сүйлөө: задание 2 — рассказ на тему модуля курса");
  console.log("  экраны A1: Жазуу (вопросы курса, памятка) и Сүйлөө (вопросы + рассказ на тему модуля) отрисованы");
}

/* ---------- 12. Курс в снимке: попытка A1 поднимается спекой A1 ---------- */
{
  const SPEC_A = SPEC_OF("A1", [{ id: "lexgram", ky: "ЛА", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" }]);
  const SPEC_B = SPEC_OF("B1", [{ id: "lexgram", ky: "ЛБ", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" }]);
  const vocab = (m, n) => Array.from({ length: n }, (_, i) => ({ id: m + "_" + i, ky: m + "с" + i, ru: m + "р" + i }));
  // стенд «оба курса»: каталог, банки и реестр спек двух курсов; ST — общий по желанию (F5)
  const mk = (ST, over) => examBox({
    ST, MODULE_META: [{ id: "m1", course: "a1" }, { id: "m11", course: "a1" }, { id: "m24", course: "b1" }, { id: "m35", course: "b1" }],
    CONTENT: { m1: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m1 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })), vocab: vocab("m1", 20) }, m24: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m24 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })), vocab: vocab("m24", 20) } },
    EXAM_SPECS: { a1: JSON.parse(JSON.stringify(SPEC_A)), b1: JSON.parse(JSON.stringify(SPEC_B)) }, ...(over || {}) });
  const SH = { ST: {} };
  const c1 = mk(SH.ST);
  vm.runInContext("Exam.use('a1'); Exam.begin();", c1);
  assert.strictEqual(SH.ST.examRun.course, "a1", "снимок помнит курс попытки");
  // «после F5» ученик открыл вкладку B1 — но поднятая попытка живёт своей спекой A1
  const c2 = mk(SH.ST);
  vm.runInContext("Exam.use('b1'); this.ok=Exam.resume(); this.ky=Exam.subSpec().ky; this.crs=Exam.st.course; this.tab=Exam.course;", c2);
  assert.strictEqual(c2.ok, true, "попытка поднимается");
  assert.strictEqual(c2.ky, "ЛА", "лист пересобран спекой СВОЕГО курса, а не открытой вкладки");
  assert.strictEqual(c2.crs, "a1", "курс попытки восстановлен из снимка");
  assert.strictEqual(c2.tab, "b1", "а курс открытой вкладки попыткой не переключается");
  // чужая живая попытка на неделе: заглушка со ссылкой, а не интро с «Начать» —
  // кнопка перезаписала бы попытку без итога (ревью 04.09.2026)
  {
    const cf = mk({});
    vm.runInContext("activeModule='m35'; Exam.use('b1'); Exam.begin(); activeModule='m11'; Exam.use('a1'); Exam.render({append(){}});" +
      "this.alive=!!(Exam.st&&Exam.st.course==='b1');", cf);
    assert.strictEqual(cf.alive, true, "попытка B1 жива после захода на неделю A1");
    assert.ok(!cf.nodes.some((n) => n.tag === "button"), "на неделе A1 нет кнопки «Начать» поверх живой попытки B1");
    assert.ok(drawnWith(cf.nodes, "exam_foreign"), "показана заглушка о чужой попытке");
    assert.ok(cf.nodes.some((n) => n.tag === "a" && String(n.attrs.href).includes("#m35/exam")),
      "и ссылка ведёт на неделю, где попытка началась");
    // прямой вызов begin()/train() на чужой неделе тоже не перезаписывает живую попытку
    vm.runInContext("Exam.begin(); this.stillB1=Exam.st.course==='b1'&&Exam.st.answers!==undefined;" +
      "this.tr=Exam.train('lexgram'); this.stillB1b=Exam.st.course==='b1';", cf);
    assert.strictEqual(cf.stillB1, true, "begin() на неделе A1 не тронул попытку B1");
    assert.strictEqual(cf.tr, false, "train() на неделе A1 отказан");
    assert.strictEqual(cf.stillB1b, true, "и попытка B1 по-прежнему жива");
    // после F5 живого st нет — чужой СНИМОК тоже не даёт «Начать» и не перезаписывается
    // (поймано живым браузером 04.09.2026); протухший чужой снимок — убирается
    const SHs = { ST: {} };
    const cs1 = mk(SHs.ST);
    vm.runInContext("activeModule='m35'; Exam.use('b1'); Exam.begin(); Exam.answer(0);", cs1);
    const cs2 = mk(SHs.ST);   // «F5» на неделе A1
    vm.runInContext("activeModule='m11'; Exam.use('a1'); Exam.render({append(){}}); Exam.begin(); this.tr=Exam.train('lexgram');" +
      "this.run=JSON.stringify({c:ST.examRun.course,n:ST.examRun.answers.length}); this.st=Exam.st;", cs2);
    assert.ok(!cs2.nodes.some((n) => n.tag === "button"), "чужой снимок: интро с «Начать» не рисуется");
    assert.ok(drawnWith(cs2.nodes, "exam_foreign"), "показана заглушка о чужой попытке");
    assert.strictEqual(cs2.run, '{"c":"b1","n":1}', "begin()/train() не перезаписали снимок B1");
    assert.strictEqual(cs2.st, null, "и не подняли его на чужой неделе");
    assert.strictEqual(cs2.tr, false, "train() отказан");
    const SHo = { ST: { examRun: { queue: [0], qi: 0, i: 0, seed: 1, answers: [], course: "b1",
      deadline: Date.now() - 3 * 3600 * 1000, startedAt: Date.now() - 4 * 3600 * 1000 } } };
    const cs3 = mk(SHo.ST);
    vm.runInContext("activeModule='m11'; Exam.use('a1'); Exam.render({append(){}});", cs3);
    assert.ok(!SHo.ST.examRun, "протухший чужой снимок убран");
    assert.ok(cs3.nodes.some((n) => n.tag === "button"), "и неделя A1 открыта — интро со «Начать»");
    // живая ТРЕНИРОВКА чужого курса неделю не блокирует: это репетиция без записи,
    // «Начать экзамен» её заменяет (как и на своей неделе — пре-существующее)
    const cg = mk({});
    vm.runInContext("activeModule='m35'; Exam.use('b1'); Exam.train('lexgram'); activeModule='m11'; Exam.use('a1');" +
      "Exam.begin(); this.ok=!!(Exam.st&&!Exam.st.train&&Exam.st.course==='a1');", cg);
    assert.strictEqual(cg.ok, true, "тренировка B1 не мешает начать экзамен A1");
  }
  // банк тоже курсовой: та же машина, разные курсы — разные банки
  const c3 = mk({});
  vm.runInContext("Exam.use('a1'); this.a=Exam.bank().lex.length&&Exam.bank().lex.every(x=>x.mod==='m1');" +
    "Exam.use('b1'); this.b=Exam.bank().lex.length&&Exam.bank().lex.every(x=>x.mod==='m24');", c3);
  assert.strictEqual(c3.a, true, "банк A1 собран из модулей A1");
  assert.strictEqual(c3.b, true, "банк B1 — из модулей B1, кэш не перепутан");
  // история попыток различает курсы: итог A1 не читается «последним результатом» B1
  const SH4 = { ST: {} }, c4 = mk(SH4.ST);
  vm.runInContext("Exam.use('a1'); Exam.begin(); Exam.finish(false);", c4);
  assert.strictEqual(SH4.ST.exam.last.course, "a1", "итог попытки помнит курс");
  assert.ok(SH4.ST.exam.attempts.every((a) => a.course === "a1"), "и каждая строка ведомости тоже");
  // интро экзамена показывает «последний результат» только своему курсу; запись
  // ДО экзамена A1 (без поля course) — это попытка B1, теряться она не должна
  const lastShown = (ST, course) => {
    const bx = mk(ST);
    vm.runInContext("Exam.use('" + course + "'); Exam.intro();", bx);
    return drawnWith(bx.nodes, "exam_last");
  };
  assert.strictEqual(lastShown({ exam: { last: { pct: 50, date: "2026-09-04", course: "a1" } } }, "b1"), false,
    "итог A1 не показывается на интро B1");
  assert.strictEqual(lastShown({ exam: { last: { pct: 50, date: "2026-09-04", course: "a1" } } }, "a1"), true,
    "и показывается на своём интро");
  assert.strictEqual(lastShown({ exam: { last: { pct: 50, date: "2026-08-01" } } }, "b1"), true,
    "запись без курса (до экзамена A1) — попытка B1, она не теряется");
  // снимок ДО экзамена A1 (без course) — это попытка B1: неделя A1 его не поднимает, неделя B1 — поднимает
  const legacy = (train) => ({ examRun: { queue: [0], qi: 0, i: train ? 0 : 1, seed: 7, train: !!train,
    answers: train ? [] : [{ ref: "x", mod: "m24", t: "lex", ok: true, sub: "lexgram" }],
    deadline: Date.now() + 1e6, startedAt: Date.now() } });
  const cl1 = mk(legacy());
  vm.runInContext("Exam.use('a1'); Exam.render({append(){}}); this.st=Exam.st;", cl1);
  assert.strictEqual(cl1.st, null, "легаси-снимок (без course) на неделе A1 не поднимается");
  const cl2 = mk(legacy());
  vm.runInContext("Exam.use('b1'); Exam.render({append(){}}); this.ky=Exam.st&&Exam.subSpec().ky; this.crs=Exam.st&&Exam.st.course;", cl2);
  assert.strictEqual(cl2.ky, "ЛБ", "а на неделе B1 поднимается своей спекой");
  assert.strictEqual(cl2.crs, "b1", "и получает курс b1 в состоянии");
  const ct = mk(legacy(true));
  vm.runInContext("activeModule='m11'; renderExamTrain({append(){}}, 'lexgram'); this.st=Exam.st;", ct);
  assert.strictEqual(ct.st, null, "легаси-снимок тренировки (без course) на неделе A1 не поднимается");
  assert.ok(drawnWith(ct.nodes, "exam_tr_start"), "и вкладка показывает интро тренировки A1, а не пустую карточку");
  /* Перебор «оба курса»: попытка B1 идёт, ученик открыл неделю A1 (use('a1')), и
     таймер субтеста истёк именно там. Следующий лист обязан собраться спекой и
     текстами B1, экран на неделе A1 — не рисоваться, итог — с курсом b1
     (первая версия собирала лист A1: поймано симуляцией 04.09.2026). */
  {
    const two = (lvl, k) => SPEC_OF(lvl, [
      { id: "lexgram", ky: "Л" + k, ru: "l", en: "l", tr: "l", tasks: 3, min: 70, kind: "mcq" },
      { id: "okuu", ky: "О" + k, ru: "o", en: "o", tr: "o", tasks: 2, min: 25, kind: "read" }]);
    const text = (id, src) => ({ id, kind: "okuu", title: { ru: id }, lines: [{ src, ky: "х." }],
      qs: [{ s: 0, ky: "?", opts: ["1", "2", "3", "4"], c: 0 }, { s: 0, ky: "??", opts: ["5", "6", "7", "8"], c: 0 }] });
    const bx = mk({}, { activeModule: "m35", EXAM_SPECS: { a1: two("A1", "А"), b1: two("B1", "Б") },
      EXAM_TEXT_SETS: { a1: [text("tA", "m1_1")], b1: [text("tB", "m24_1")] } });   // реестр текстов по курсам, как в сборке
    vm.runInContext("Exam.use('b1'); Exam.begin();" +
      " activeModule='m11'; Exam.use('a1'); area.kids.length=0;" +   // ученик открыл неделю A1
      " Exam.nextSub(true);" +                                         // таймер субтеста B1 истёк там
      " this.sub=Exam.subSpec().ky; this.txt=Exam.st.items[0].textId; this.drawn=area.kids.length;" +
      " Exam.finish(false); this.last=ST.exam.last.course;", bx);
    assert.strictEqual(bx.sub, "ОБ", "следующий субтест собран спекой СВОЕГО курса (B1), а не открытой недели");
    assert.strictEqual(bx.txt, "tB", "и текстами своего курса");
    assert.strictEqual(bx.drawn, 0, "на неделе A1 экран попытки B1 не рисуется");
    assert.strictEqual(bx.last, "b1", "итог попытки помечен её курсом");
  }
  console.log("  курс в снимке и истории: попытка A1 не подменяется спекой B1, банки и ведомости курсов раздельны, " +
    "живая попытка при смене недели держит свой курс");
}

/* ---------- 13. Тексты курсов не смешиваются и не утекают в чужой вариант ---------- */
{
  const box = loadBlock(["EXAM-TEXTS", "EXAM-TEXTS-A1", "EXAM"], { expose: ["Exam"] });
  vm.runInContext("Exam.course='a1'; this.a1okuu=Exam.texts('okuu').map(x=>x.id);" +
    "Exam.course='b1'; this.b1okuu=Exam.texts('okuu').map(x=>x.id);", box);
  const a1ids = JSON.parse(JSON.stringify(box.a1okuu)), b1ids = JSON.parse(JSON.stringify(box.b1okuu));
  assert.ok(a1ids.length >= 3 && a1ids.every((id) => id.startsWith("a1_")), "неделя A1 видит только тексты A1: " + a1ids);
  assert.ok(b1ids.length >= 3 && b1ids.every((id) => !id.startsWith("a1_")), "неделя B1 — только тексты B1: " + b1ids);
  // полная пятёрка: на реальной спеке, текстах и словаре A1 готовы ВСЕ части по порядку
  box.MODULE_META = META; box.CONTENT = JSON.parse(JSON.stringify(require("../deploy/gen-audio").loadData().CONTENT));
  vm.runInContext(blockSrc("EXAM-A1") + "; Exam.course='a1';" +
    "this.ready=EXAM_A1.subtests.map(x=>x.id).filter(id=>Exam.ready(id));", box);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(box.ready)),
    ["lexgram", "uguu", "okuu", "jazuu", "suiloo"], "готовы все пять частей A1 в порядке спецификации");

  // вариант ученика: чужие тексты не приезжают байтами (материал курса)
  const appshell = require("../server/appshell");
  const b1only = appshell.buildAppHtml(["m24", "m25", "m26", "m27", "m28", "m29", "m30", "m31", "m32", "m33", "m34", "m35"]);
  // сами фразы m1 в варианте есть — как данные модуля-донора alias-слов (канон),
  // а вот СБОРКА текста экзамена из них — материал курса A1, и её быть не должно
  assert.ok(!b1only.includes("a1_okuu_ozu") && !b1only.includes("a1_uguu_uybulo"),
    "в вариант чистого B1 тексты A1 не едут");
  const a1only = appshell.buildAppHtml(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"]);
  assert.ok(a1only.includes("a1_okuu_ozu"), "своему курсу тексты A1 едут");
  assert.ok(!a1only.includes("okuu_shaar"), "тексты B1 в вариант A1 не едут");
  console.log("  изоляция текстов: движок фильтрует по курсу, варианты не возят чужой материал");
}

/* ---------- 14. Меню недели m11 и план — одно целое ---------- */
{
  const fn = html.match(/const EXAM_TAB_ICON=[\s\S]*?\n(?=const TEACHER_TABS_DEF)/);
  const trail = [null, blockSrc("TRAIL")];
  const SUBS = E.subtests.map((s) => ({ id: s.id, kind: s.kind, ru: s.ru, ky: s.ky }));
  const box = { console, t: (k) => k, bi: () => "", bi3: (o) => o.ru || o.ky,
    CONTENT: { m11: {}, m1: {} }, DIALOGS: { m1: {} }, LESSONS: { m1: {} }, STT_MODS: ["m1"],
    EXAM_MODS: ["m11", "m23"] };
  box.EXAM_SPECS = { a1: { subtests: SUBS } };   // у a2 спеки нет — неделя m23 живёт учебным меню
  box.metaOf = (id) => ({ id, course: id === "m23" ? "a2" : "a1" });
  box.MODULE_META = [{ id: "m1", course: "a1" }, { id: "m11", course: "a1" }, { id: "m23", course: "a2" }];
  box.ME = null; box.ST = { courses: ["a1"] }; box.CONTENT_READY = ["m1", "m11"];
  vm.createContext(box);
  vm.runInContext(trail[1] + fn[0] + "; this.tabsFor=studyTabsFor;", box);
  const keys = (id) => JSON.parse(JSON.stringify(box.tabsFor(id))).map((x) => x[0]);
  assert.deepStrictEqual(keys("m11"),
    ["overview", "grp", "tr_lexgram", "tr_uguu", "tr_okuu", "tr_jazuu", "tr_suiloo", "exam"],
    "меню недели A1: как готовиться → тренажёр формата по субтестам → пробный экзамен");
  for (const gone of ["cards", "dialogs", "harmony", "test", "alphabet", "lessons", "listen"])
    assert.ok(!keys("m11").includes(gone), "в неделе A1 нет вкладки «" + gone + "»");
  const m1 = keys("m1");
  for (const need of ["overview", "cards", "harmony", "test"])
    assert.ok(m1.includes(need), "учебный модуль A1 меню не потерял: " + need);
  // exam:true без спеки — учебное меню, а не пустой тренажёр (адверсарный случай)
  assert.ok(!keys("m23").includes("grp") && !keys("m23").some((k) => k.slice(0, 3) === "tr_"),
    "неделя без спеки экзамена не притворяется экзаменационной");

  // план m11 называет разделы так же, как вкладки, на трёх языках; методика в данных
  const dataBox = { console };
  vm.createContext(dataBox);
  vm.runInContext(blockSrc("DATA") + blockSrc("I18N").replace("const I18N=", "var I18N=") +
    "; this.C=CONTENT; this.I18N=I18N;", dataBox);
  const FIELD = { ru: "plan", en: "planEn", tr: "planTr" };
  const SUBNAME = { ru: "ru", en: "en", tr: "tr" };
  for (const lang of ["ru", "en", "tr"]) {
    const plan = (dataBox.C.m11 || {})[FIELD[lang]] || [];
    assert.ok(plan.length, "план недели m11 на " + lang + " не пуст");
    for (const key of ["tab_howto", "tab_grp_format", "tab_exam"]) {
      const name = dataBox.I18N[lang][key];
      assert.ok(plan.some((s2) => s2.includes(name)), "m11 (" + lang + "): план называет раздел «" + name + "»");
    }
    for (const sp of E.subtests) {
      const nm = sp[SUBNAME[lang]] || sp.ky;
      assert.ok(plan.some((s2) => s2.includes(nm)), "m11 (" + lang + "): план называет тренировку «" + nm + "»");
    }
    const howto = (dataBox.C.m11 || {})[lang === "ru" ? "howto" : lang === "en" ? "howtoEn" : "howtoTr"] || [];
    assert.ok(howto.length >= 4, "m11 (" + lang + "): методика из " + howto.length + " шагов");
    for (const step of howto) assert.ok(String(step).trim().length > 40, "шаг методики содержателен");
  }
  console.log("  неделя m11: меню из реестра (8 пунктов), план и методика названы на трёх языках, " +
    "неделя без спеки не ломается");
}

/* ---------- 15. Серверный гейт: экзамен открывает любая неделя реестра ---------- */
{
  // срез по содержимому, а не по имени файла: декомпозиция server/*.js тест не роняет
  const snip = [require("./helpers/server-src").slice(/let EXAM_MODS_CACHE[\s\S]*?const examAllowed[^\n]*\n/, "examMods").text];
  // allowedMods — как на сервере: Set открытых модулей ученика, null у преподавателя
  const run = (mods) => {
    const bx = { console,
      appshell: { buildAppHtml: () => 'const EXAM_LISTEN_MAX = 2;\nconst EXAM_MODS = ["m11", "m35"];\n' },
      allowedMods: () => (mods === null ? null : new Set(mods)) };
    vm.createContext(bx);
    vm.runInContext(snip[0] + "; this.mods=examMods(); this.ok=examAllowed('x');", bx);
    return bx;
  };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run(["m11"]).mods)), ["m11", "m35"],
    "реестр недель читается из сборки");
  assert.strictEqual(run(["m11"]).ok, true, "ученик A1 (открыт m11) сдаёт экзамен");
  assert.strictEqual(run(["m35"]).ok, true, "ученик B1 (открыт m35) сдаёт экзамен");
  assert.strictEqual(run(["m23"]).ok, false, "неделя вне реестра (a2) экзамен не открывает");
  assert.strictEqual(run([]).ok, false, "без единой недели — 403");
  assert.strictEqual(run(null).ok, true, "преподаватель (весь каталог) — сдаёт");
  // литерала нет — отказ, а не тихий фолбэк на m35 (он закрыл бы экзамен A1 без строки в логе)
  {
    const bx = { console, appshell: { buildAppHtml: () => "const OTHER = 1;" }, allowedMods: () => null };
    vm.createContext(bx);
    assert.throws(() => vm.runInContext(snip[0] + "; examMods();", bx), /EXAM_MODS/, "промах реестра — исключение");
  }
  console.log("  серверный гейт: реестр из сборки, доступ по любой неделе, чужие курсы — 403");
}
