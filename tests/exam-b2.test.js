"use strict";
/* Итоговая проверка курса learn.kg, уровень B2 (вкладка недели m47).

   Решение владельца 30.10.2026: проверка — собственная. Общие инварианты спецификаций
   и зоны (нет цитат, источников, названия; вопросы — фразы курса) стережёт
   exam-b1.test.js перебором всех курсов; здесь — особенности B2 на банке и текстах
   ИМЕННО курса B2: объёмы письма и рассказа выше B1, экран письма, изоляция текстов,
   адверсарные атаки на задания. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const { html, blockSrc, loadBlock } = require("./helpers/block");
// каталог модулей — из сборки: «модули B2» берутся из него, а не арифметикой над id
const META = (() => {
  const bx = { console }; vm.createContext(bx);
  vm.runInContext(html.match(/const MODULE_META=\[[\s\S]*?\];/)[0] +
    html.match(/const MODULE_TITLES_EN=\{[\s\S]*?MODULE_META\.forEach\([^\n]*\n/)[0] + "; this.M=MODULE_META;", bx);
  return JSON.parse(JSON.stringify(bx.M));
})();
const B2_MODS = META.filter((m) => m.course === "b2").map((m) => m.id);
assert.ok(B2_MODS.length >= 12 && B2_MODS.includes("m36") && B2_MODS.includes("m47"), "каталог B2: " + B2_MODS.join(","));

/* ---------- спецификация приезжает ученику ---------- */
const sb = loadBlock("EXAM-B2", { expose: ["EXAM_B2", "EXAM_SPECS"] });
const E = JSON.parse(JSON.stringify(sb.EXAM_B2));
assert.strictEqual(JSON.parse(JSON.stringify(sb.EXAM_SPECS)).b2.level, "B2", "спека B2 зарегистрирована в реестре EXAM_SPECS");

/* ---------- 1. Состав B2 — свой, объёмы выше B1 ---------- */
const jaz = E.subtests.find((s) => s.id === "jazuu");
const suil = E.subtests.find((s) => s.id === "suiloo");
{
  const B1 = JSON.parse(JSON.stringify(loadBlock("EXAM-B1", { expose: ["EXAM_B1"] }).EXAM_B1));
  const b1 = (id) => B1.subtests.find((x) => x.id === id);
  assert.ok(jaz.minSent > b1("jazuu").minSent && jaz.maxSent > b1("jazuu").maxSent, "письмо B2 объёмнее B1: " + jaz.minSent + "–" + jaz.maxSent);
  assert.ok(suil.minSec >= b1("suiloo").minSec && suil.maxSec > b1("suiloo").maxSec, "рассказ B2 длиннее B1");
  assert.deepStrictEqual(E.topicSkip, ["m46"], "неделя повторения B2 темой не служит");
  for (const k of ["quote", "src", "retake", "topics", "descriptors", "totalTasks", "totalMin"]) assert.ok(!(k in E), "в спеке B2 нет поля " + k);
  for (const k of ["q1", "q1From", "q1Intro", "q1Note", "formQuote", "nuskama", "own", "descQuote"])
    assert.ok(!(k in jaz) && !(k in suil), "у письма и речи B2 нет поля " + k);
}

/* ---------- 7. Реестры: m47 — экзаменационная неделя B2 ---------- */
{
  const MODS = JSON.parse(JSON.stringify(loadBlock("EXAM-B1", { expose: ["EXAM_MODS"] }).EXAM_MODS));
  assert.ok(MODS.includes("m47"), "m47 в реестре модулей со вкладкой экзамена: " + MODS.join(","));
  const m47 = META.find((m) => m.id === "m47");
  assert.ok(m47 && m47.exam === true && m47.course === "b2", "m47 — exam:true курса b2");
  assert.ok(!META.filter((m) => m.course === "b2" && m.id !== "m47").some((m) => m.exam), "у B2 ровно одна экзаменационная неделя");
}

/* ---------- 8. Тексты Окуу/Угуу B2: вычитка машиной ---------- */
{
  const TEXTS = JSON.parse(JSON.stringify(loadBlock("EXAM-TEXTS-B2", { expose: ["EXAM_TEXTS_B2", "EXAM_TEXT_SETS"] }).EXAM_TEXTS_B2));
  assert.ok(TEXTS.filter((x) => x.kind === "okuu").length >= 4, "текстов Окуу B2 не меньше четырёх");
  assert.ok(TEXTS.filter((x) => x.kind === "uguu").length >= 4, "текстов Угуу B2 не меньше четырёх");
  const CONTENT = require("../deploy/gen-audio").loadData().CONTENT;
  const byId = {};
  for (const [mid, c] of Object.entries(CONTENT)) {
    if (!B2_MODS.includes(mid)) continue;   // словарь ИМЕННО курса B2 — по каталогу
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
      assert.ok(byId[ln.src], T.id + ": фраза " + ln.src + " есть в словаре курса B2");
      assert.strictEqual(ln.ky, byId[ln.src], T.id + " / " + ln.src + ": предложение расходится с вычитанной фразой курса");
      assert.ok(B2_MODS.includes(ln.src.split("_")[0]), T.id + ": предложение из модуля B2");
    }
    assert.ok(T.qs.length >= 5, T.id + ": к тексту не меньше пяти вопросов");
    const body = T.lines.map((l) => l.ky.toLowerCase());
    for (const q of T.qs) {
      assert.ok(Number.isInteger(q.s) && q.s >= 0 && q.s < T.lines.length, T.id + ": номер предложения-ответа в тексте");
      assert.ok(/[?]$/.test(q.ky), T.id + ": вопрос на кыргызском со знаком вопроса — «" + q.ky + "»");
      assert.strictEqual(q.opts.length, 4, T.id + ": четыре варианта у «" + q.ky + "»");
      assert.strictEqual(new Set(q.opts).size, 4, T.id + ": варианты не повторяются");
      assert.ok(Number.isInteger(q.c) && q.c >= 0 && q.c < 4, T.id + ": верный ответ в диапазоне");
      const right = q.opts[q.c].toLowerCase();
      assert.ok(body[q.s].includes(right), T.id + " / «" + q.ky + "»: ответ «" + q.opts[q.c] + "» обязан встречаться в предложении " + (q.s + 1));
      for (let k = 0; k < q.opts.length; k++) {
        if (k === q.c) continue;
        assert.ok(!body.some((s) => s.includes(q.opts[k].toLowerCase())),
          T.id + " / «" + q.ky + "»: неверный вариант «" + q.opts[k] + "» тоже есть в тексте — у вопроса два ответа");
      }
    }
    if (T.kind === "uguu") assert.strictEqual(T.audio, "lines", T.id + ": режим аудирования — lines");
  }
  console.log("  тексты B2: " + TEXTS.length + ", предложений " + TEXTS.reduce((a, t8) => a + t8.lines.length, 0) +
    " — все сверены с вычитанными фразами курса B2, вопросов " + TEXTS.reduce((a, t8) => a + t8.qs.length, 0));
}

/* ---------- 9. Движок на банке B2: полнота и адверсарные атаки ---------- */
{
  const box = loadBlock("EXAM", { expose: ["examBank", "examItems", "EXAM_KINDS"] });
  const CONTENT = require("../deploy/gen-audio").loadData().CONTENT;
  const bank = box.examBank(CONTENT, B2_MODS.filter((id) => CONTENT[id]), require("../deploy/gen-audio").loadData().DIALOGS);
  const N = E.subtests[0].tasks;
  assert.ok(bank.drills.length + bank.lex.length >= N * 2,
    "банк B2 вдвое больше субтеста (" + (bank.drills.length + bank.lex.length) + " против " + N + ")");
  const posHist = {}, kindHist = {};
  let checked = 0;
  const prev = [];
  const SERVICE = /\(М\d|\(\d+-е|\(образц|\(пример|М\d\)/i;
  for (let v = 0; v < 20; v++) {
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
        assert.ok(it.explain && it.explain.ky.toLowerCase().includes(right.toLowerCase()), it.ref + ": вставка ответа даёт фразу курса");
      }
      if (it.t === "order") {
        const ref = it.explain.ky.replace(/[.!?]$/, "");
        assert.strictEqual(right, ref, it.ref + ": верный порядок — фраза курса дословно");
      }
      assert.ok(it.explain && it.explain.ky, it.ref + ": нет разбора — ошибка ничему не научит");
      if (it.t === "drill") assert.ok(it.explain.rule || it.explain.ru, it.ref + ": у грамматического задания нет ни перевода, ни правила");
      assert.ok(!SERVICE.test(String(it.q)), it.ref + ": служебная пометка в вопросе");
      for (const o of it.opts) assert.ok(!SERVICE.test(String(o)), it.ref + ": служебная пометка в варианте");
    }
    assert.ok(Object.keys(kinds).length >= 6, "вариант " + v + ": типов " + Object.keys(kinds).length + " — мало");
    for (const [k, n] of Object.entries(kinds))
      assert.ok(n <= N * 0.4, "вариант " + v + ": тип " + k + " занимает " + n + " из " + N + " — экзамен однообразен");
  }
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35, "позиция " + pos + ": " + Math.round(share * 100) + "% — тест решается вслепую");
  }
  assert.strictEqual(Object.keys(kindHist).sort().join(","), JSON.parse(JSON.stringify(box.EXAM_KINDS)).slice().sort().join(","),
    "все объявленные типы заданий реально встречаются на банке B2 (дефиниции есть — def в деле): " + Object.keys(kindHist).join(","));
  console.log("  адверсарно проверено заданий B2: " + checked + " в 20 вариантах, типов " +
    Object.keys(kindHist).length + " (" + Object.entries(kindHist).map(([k, n]) => k + ":" + n).join(" ") + ")");
}

/* ---------- 10. Тексты B2 сквозь движок: шафл и позиции ---------- */
{
  const box = loadBlock(["EXAM-TEXTS-B2", "EXAM"], { expose: ["examTextItems", "EXAM_TEXTS_B2"] });
  const posHist = {}; let checked = 0;
  for (let v = 0; v < 30; v++) {
    for (const kind of ["okuu", "uguu"]) {
      const texts = JSON.parse(JSON.stringify(box.EXAM_TEXTS_B2)).filter((x) => x.kind === kind);
      const items = JSON.parse(JSON.stringify(box.examTextItems(texts, 30, 1000 + v * 137)));
      assert.ok(items.length >= 15, kind + " v" + v + ": заданий из текстов " + items.length);
      for (const it of items) {
        checked++;
        posHist[it.c] = (posHist[it.c] || 0) + 1;
        const orig = texts.find((t8) => t8.id === it.textId).qs[Number(it.ref.split("_").pop())];
        assert.strictEqual(String(it.opts[it.c]), orig.opts[orig.c], it.ref + ": верный ответ съехал при шафле");
        assert.strictEqual(new Set(it.opts).size, 4, it.ref + ": варианты уникальны");
        assert.ok(B2_MODS.includes(it.mod), it.ref + ": mod текстового задания — модуль B2");
      }
    }
  }
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35, "тексты B2: позиция " + pos + " = " + Math.round(share * 100) + "%");
  }
  console.log("  текстовые задания B2: " + checked + " в 30 вариантах, позиции равномерны");
}

/* ---------- 11. Тексты курсов не смешиваются, все пять субтестов готовы ---------- */
{
  const box = loadBlock(["EXAM-TEXTS", "EXAM-TEXTS-A1", "EXAM-TEXTS-B2", "EXAM"], { expose: ["Exam"] });
  vm.runInContext("Exam.course='b2'; this.b2okuu=Exam.texts('okuu').map(x=>x.id); this.b2uguu=Exam.texts('uguu').map(x=>x.id);" +
    "Exam.course='b1'; this.b1okuu=Exam.texts('okuu').map(x=>x.id);", box);
  const b2ids = JSON.parse(JSON.stringify(box.b2okuu)), b1ids = JSON.parse(JSON.stringify(box.b1okuu));
  const B2_TEXT_IDS = new Set(JSON.parse(JSON.stringify(loadBlock("EXAM-TEXTS-B2", { expose: ["EXAM_TEXTS_B2"] }).EXAM_TEXTS_B2)).map((t) => t.id));
  assert.ok(b2ids.length >= 4 && b2ids.every((id) => B2_TEXT_IDS.has(id)), "неделя B2 видит только тексты B2: " + b2ids);
  assert.ok(JSON.parse(JSON.stringify(box.b2uguu)).length >= 4, "и тексты Угуу B2 тоже");
  assert.ok(b1ids.length >= 3 && b1ids.every((id) => !B2_TEXT_IDS.has(id)), "неделя B1 текстов B2 не видит: " + b1ids);
  box.MODULE_META = META; box.CONTENT = JSON.parse(JSON.stringify(require("../deploy/gen-audio").loadData().CONTENT));
  vm.runInContext(blockSrc("EXAM-B2") + "; Exam.course='b2';" +
    "this.ready=EXAM_B2.subtests.map(x=>x.id).filter(id=>Exam.ready(id));", box);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(box.ready)),
    ["lexgram", "uguu", "okuu", "jazuu", "suiloo"], "готовы все пять частей B2 в порядке спецификации");

  // вариант ученика: чужие тексты не приезжают байтами (материал курса)
  const appshell = require("../server/appshell");
  const b2only = appshell.buildAppHtml(B2_MODS);
  const b1only = appshell.buildAppHtml(["m24", "m25", "m26", "m27", "m28", "m29", "m30", "m31", "m32", "m33", "m34", "m35"]);
  const a1only = appshell.buildAppHtml(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"]);
  const anyB2 = [...B2_TEXT_IDS][0];
  assert.ok(b2only.includes('"' + anyB2 + '"'), "своему курсу тексты B2 едут");
  assert.ok(!b1only.includes('"' + anyB2 + '"') && !a1only.includes('"' + anyB2 + '"'), "в варианты B1 и A1 тексты B2 не едут");
  assert.ok(!b2only.includes("okuu_shaar") && !b2only.includes("a1_okuu_ozu"), "в вариант B2 тексты B1 и A1 не едут");
  assert.ok(b2only.includes("===EXAM-B2===") && b1only.includes("===EXAM-B2==="), "спека B2 (только числа и подписи частей) — в любом варианте");
  console.log("  изоляция текстов: движок фильтрует по курсу, варианты не возят чужой материал");
}

/* ---------- 12. Курс в снимке и банк: попытка B2 живёт своей спекой ---------- */
const { examBox, flat, textOf, drawnWith } = require("./helpers/exam-box");
{
  const SPEC_OF = (level, subtests) => ({ level, subtests });
  const SPEC_B1 = SPEC_OF("B1", [{ id: "lexgram", ky: "ЛБ1", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" }]);
  const SPEC_B2 = SPEC_OF("B2", [{ id: "lexgram", ky: "ЛБ2", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" }]);
  const vocab = (m, n) => Array.from({ length: n }, (_, i) => ({ id: m + "_" + i, ky: m + "с" + i, ru: m + "р" + i }));
  const mk = (ST) => examBox({
    ST, activeModule: "m47",
    MODULE_META: [{ id: "m24", course: "b1" }, { id: "m35", course: "b1" }, { id: "m36", course: "b2" }, { id: "m47", course: "b2" }],
    CONTENT: { m24: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m24 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })), vocab: vocab("m24", 20) }, m36: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m36 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })), vocab: vocab("m36", 20) } },
    EXAM_SPECS: { b1: JSON.parse(JSON.stringify(SPEC_B1)), b2: JSON.parse(JSON.stringify(SPEC_B2)) } });
  const SH = { ST: {} };
  const c1 = mk(SH.ST);
  vm.runInContext("Exam.use('b2'); Exam.begin(); Exam.answer(0);", c1);
  assert.strictEqual(SH.ST.examRun.course, "b2", "снимок помнит курс попытки");
  const c2 = mk(SH.ST);   // «после F5» ученик открыл неделю B1
  vm.runInContext("activeModule='m35'; Exam.use('b1'); this.ok=Exam.resume(); this.ky=Exam.st&&Exam.subSpec().ky; this.crs=Exam.st&&Exam.st.course;", c2);
  assert.strictEqual(c2.ok, true, "попытка поднимается");
  assert.strictEqual(c2.ky, "ЛБ2", "лист пересобран спекой СВОЕГО курса B2, а не открытой вкладки");
  assert.strictEqual(c2.crs, "b2", "курс попытки восстановлен из снимка");
  const c3 = mk({});
  vm.runInContext("Exam.use('b2'); this.b=Exam.bank().lex.length&&Exam.bank().lex.every(x=>x.mod==='m36');" +
    "Exam.use('b1'); this.a=Exam.bank().lex.length&&Exam.bank().lex.every(x=>x.mod==='m24');", c3);
  assert.strictEqual(c3.b, true, "банк B2 собран из модулей B2");
  assert.strictEqual(c3.a, true, "банк B1 — из модулей B1, кэш не перепутан");
  const SH4 = { ST: {} }, c4 = mk(SH4.ST);
  vm.runInContext("Exam.use('b2'); Exam.begin(); Exam.finish(false);", c4);
  assert.strictEqual(SH4.ST.exam.last.course, "b2", "итог попытки помнит курс b2");
  console.log("  курс в снимке и истории: попытка B2 не подменяется спекой B1, банки раздельны");
}

/* ---------- 13. Экран Жазуу B2 — исполнение с DOM-стабом на реальных данных курса ---------- */
{
  const { CONTENT } = require("../deploy/gen-audio").loadData();
  const SPEC = { level: "B2", topicSkip: E.topicSkip, subtests: [JSON.parse(JSON.stringify(jaz))] };   // без topicSkip тема изредка выпадала на неделю повторения
  const box = examBox({ activeModule: "m47", MODULE_META: META, CONTENT: JSON.parse(JSON.stringify(CONTENT)),
    // t отдаёт шаблон с плейсхолдерами: tf2 живёт внутри блока движка и подставит границы спеки
    EXAM_SPECS: { b2: JSON.parse(JSON.stringify(SPEC)) }, t: (k) => (k === "exam_w_size" ? "{a}–{b} сүйлөм" : k) });
  vm.runInContext("Exam.use('b2'); Exam.begin();", box);
  const area = box.area, seen = () => textOf(area);
  const B2KY = new Set();
  for (const id of B2_MODS) for (const v of (CONTENT[id] || {}).vocab || []) if (v && v.ky && !v.ref) B2KY.add(v.ky);
  // задание 1: qPick вопросов курса B2 списком, инструкция — строкой словаря
  const ol = flat(area).find((n) => n.tag === "ol");
  assert.ok(ol && ol.kids.length === jaz.qPick, "жазуу: вопросы задания 1 выданы списком: " + (ol && ol.kids.length));
  for (const li of ol.kids) assert.ok(B2KY.has(li.kids[0]) && /\?$/.test(li.kids[0]), "жазуу: вопрос — фраза курса B2: " + li.kids[0]);
  assert.ok(seen().includes("exam_w_qs") && seen().includes("exam_w_chk"), "жазуу: инструкция и памятка — строки словаря");
  // задание 2: тема — модуль B2, объём из спеки
  vm.runInContext("Exam.advance(Exam.tokenOf());", box);
  const titles = META.filter((m) => m.course === "b2" && !m.exam && m.id !== "m46").map((m) => m.title);
  assert.ok(titles.some((tp) => seen().includes(tp)), "жазуу: тема задания 2 — название модуля B2");
  assert.ok(seen().includes(jaz.minSent + "–" + jaz.maxSent + " сүйлөм"), "жазуу: подпись объёма несёт границы из спеки");
  console.log("  экран Жазуу B2: задание 1 из " + jaz.qPick + " вопросов курса, задание 2 — тема-модуль, объём " + jaz.minSent + "–" + jaz.maxSent);
}

/* ---------- 14. Меню недели m47 и план — одно целое ---------- */
{
  const fn = html.match(/const EXAM_TAB_ICON=[\s\S]*?\n(?=const TEACHER_TABS_DEF)/);
  const trail = [null, blockSrc("TRAIL")];
  const SUBS = E.subtests.map((s) => ({ id: s.id, kind: s.kind, ru: s.ru, ky: s.ky }));
  const box = { console, t: (k) => k, bi: () => "", bi3: (o) => o.ru || o.ky,
    CONTENT: { m47: {}, m36: {} }, DIALOGS: { m36: {} }, LESSONS: { m36: {} }, STT_MODS: ["m36"],
    EXAM_MODS: ["m11", "m35", "m47"] };
  box.EXAM_SPECS = { b2: { subtests: SUBS } };
  box.metaOf = (id) => ({ id, course: "b2" });
  box.MODULE_META = [{ id: "m36", course: "b2" }, { id: "m47", course: "b2" }];
  box.ME = null; box.ST = { courses: ["b2"] }; box.CONTENT_READY = ["m36", "m47"];
  vm.createContext(box);
  vm.runInContext(trail[1] + fn[0] + "; this.tabsFor=studyTabsFor;", box);
  const keys = (id) => JSON.parse(JSON.stringify(box.tabsFor(id))).map((x) => x[0]);
  assert.deepStrictEqual(keys("m47"),
    ["overview", "grp", "tr_lexgram", "tr_uguu", "tr_okuu", "tr_jazuu", "tr_suiloo", "exam"],
    "меню недели B2: как готовиться → тренажёр формата по субтестам → пробный экзамен");
  for (const gone of ["cards", "dialogs", "harmony", "test", "alphabet", "lessons", "listen"])
    assert.ok(!keys("m47").includes(gone), "в неделе B2 нет вкладки «" + gone + "»");
  const m36 = keys("m36");
  for (const need of ["overview", "cards", "harmony", "test", "dialogs"])
    assert.ok(m36.includes(need), "учебный модуль B2 меню не потерял: " + need);
  assert.ok(!m36.includes("grp") && !m36.some((k) => k.slice(0, 3) === "tr_"), "тренажёр формата не протёк в учебный модуль");

  const dataBox = { console };
  vm.createContext(dataBox);
  vm.runInContext(blockSrc("DATA") + blockSrc("I18N").replace("const I18N=", "var I18N=") + "; this.C=CONTENT; this.I18N=I18N;", dataBox);
  const FIELD = { ru: "plan", en: "planEn", tr: "planTr" };
  const SUBNAME = { ru: "ru", en: "en", tr: "tr" };
  for (const lang of ["ru", "en", "tr"]) {
    const plan = (dataBox.C.m47 || {})[FIELD[lang]] || [];
    assert.ok(plan.length, "план недели m47 на " + lang + " не пуст");
    for (const key of ["tab_howto", "tab_grp_format", "tab_exam"]) {
      const name = dataBox.I18N[lang][key];
      assert.ok(plan.some((s2) => s2.includes(name)), "m47 (" + lang + "): план называет раздел «" + name + "»");
    }
    for (const sp of E.subtests) {
      const nm = sp[SUBNAME[lang]] || sp.ky;
      assert.ok(plan.some((s2) => s2.includes(nm)), "m47 (" + lang + "): план называет тренировку «" + nm + "»");
    }
    const howto = (dataBox.C.m47 || {})[lang === "ru" ? "howto" : lang === "en" ? "howtoEn" : "howtoTr"] || [];
    assert.ok(howto.length >= 4, "m47 (" + lang + "): методика из " + howto.length + " шагов");
    for (const step of howto) assert.ok(String(step).trim().length > 40, "шаг методики содержателен");
  }
  console.log("  неделя m47: меню из реестра (8 пунктов), план и методика названы на трёх языках");
}

/* ---------- 15. Серверный гейт: неделя B2 открывает экзамен ---------- */
{
  const snip = [require("./helpers/server-src").slice(/let EXAM_MODS_CACHE[\s\S]*?const examAllowed[^\n]*\n/, "examMods").text];
  const run = (mods) => {
    const bx = { console,
      appshell: { buildAppHtml: () => 'const EXAM_LISTEN_MAX = 2;\nconst EXAM_MODS = ["m11", "m35", "m47"];\n' },
      allowedMods: () => (mods === null ? null : new Set(mods)) };
    vm.createContext(bx);
    vm.runInContext(snip[0] + "; this.mods=examMods(); this.ok=examAllowed('x');", bx);
    return bx;
  };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run(["m47"]).mods)), ["m11", "m35", "m47"], "реестр недель читается из сборки");
  assert.strictEqual(run(["m47"]).ok, true, "ученик B2 (открыт m47) сдаёт экзамен");
  assert.strictEqual(run(["m46"]).ok, false, "повторительный модуль B2 без недели экзамен не открывает");
  assert.strictEqual(run([]).ok, false, "без единой недели — 403");
  // и реальная сборка называет m47 в литерале реестра — тот, что читает сервер
  const lit = html.match(/const EXAM_MODS\s*=\s*\[([^\]]*)\]/);
  assert.ok(lit && lit[1].includes('"m47"'), "литерал EXAM_MODS в сборке содержит m47");
  console.log("  серверный гейт: неделя m47 в реестре, доступ по ней, m46 — 403");
}

/* Итоговая строка — последней: предкоммитный подсчёт зелёных считает «: OK», и она не
   должна опережать падение поздней секции. */
console.log("exam-b2.test.js: OK (своя проверка B2: письмо " + jaz.minSent + "–" + jaz.maxSent + " предложений, рассказ " +
  suil.minSec + "–" + suil.maxSec + " с; вопросы — фразы курса, темы — модули; банк и тексты B2 атакованы адверсарно, " +
  "неделя m47 в меню и на сервере)");
