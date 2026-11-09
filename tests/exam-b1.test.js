"use strict";
/* Итоговая проверка курса learn.kg, уровень B1 (вкладка недели m35).

   Решение владельца 30.10.2026: проверка — СОБСТВЕННАЯ, а не копия чужого экзамена.
   Поэтому гейт проверяет обратное прежнему правилу «идентичности»:
   1. В спецификациях (A1, B1, B2) нет ни одного поля-цитаты, адреса источника,
      чужих тем, дескрипторов, правил пересдачи; числа частей — свои.
   2. В зоне проверки собранной страницы (спеки, тексты, движок, словарь exam_*,
      экзаменационные недели) нет названия тестирования и претензий на
      официальность; адрес официального сайта — ровно одна ссылка (EXAM_SITE).
   3. Вопросы Жазуу/Сүйлөө — вопросительные фразы курса (сверка по id и тексту
      с CONTENT), темы — названия модулей курса; перебором по всем курсам.
   4. Механика и адверсарные атаки на задания — как прежде.
   Спецификация берётся из СОБРАННОЙ страницы (buildAppHtml + vm). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const html = require("../server/appshell").buildAppHtml();
const { blockSrc } = require("./helpers/block");

/* ---------- спецификация приезжает ученику ---------- */
const src = html.match(/\/\* ===EXAM-B1===[\s\S]*?\/\* ===\/EXAM-B1=== \*\//);
assert.ok(src, "маркер ===EXAM-B1=== в собранной странице");
const sb = { console };
vm.createContext(sb);
vm.runInContext(src[0] + "; this.E=EXAM_B1; this.MODS=EXAM_MODS;", sb);
const E = JSON.parse(JSON.stringify(sb.E));
const SPECS = (() => {
  const bx = { console }; vm.createContext(bx);
  vm.runInContext(["EXAM-A1", "EXAM-B1", "EXAM-B2"].map(blockSrc).join(";") + "; this.S=EXAM_SPECS;", bx);
  return JSON.parse(JSON.stringify(bx.S));
})();
const META = (() => {
  const bx = { console }; vm.createContext(bx);
  vm.runInContext(html.match(/const MODULE_META=\[[\s\S]*?\];/)[0] +
    html.match(/const MODULE_TITLES_EN=\{[\s\S]*?MODULE_META\.forEach\([^\n]*\n/)[0] + "; this.M=MODULE_META;", bx);
  return JSON.parse(JSON.stringify(bx.M));
})();
// название тестирования в любом написании — то, чего в зоне быть не должно
const NAME = /kyrgyztest|кыргызтест|кыргыз тест|kırgıztest|kyrgyz test|kirgiztest/gi;
// претензии на официальность и копию чужого формата применительно к нашим заданиям
const CLAIM = /настоящ\w* экзамен|как на экзамене|как на настоящем|real exam|the real one|as in the exam|as at the exam|just like the exam|gerçek sınav|sınavdaki gibi|идентичн|дескриптор|descriptor|betimleyici|пересдач|retake|нускам|официальн\w* (?:список|списк|тем|правил|порядок|вопрос|задани|образ|формат)|official (?:list|topic|rule|question|task|format)|resmî (?:liste|konu|kural|soru)/i;

/* ---------- 1. Спецификации — свои: ни цитат, ни источников, ни чужих чисел ---------- */
{
  const FORBIDDEN = new Set(["quote", "descQuote", "formQuote", "levelQuote", "nuskama", "src", "levelSrc",
    "descSrc", "formSrc", "nuskamaSrc", "partsSrc", "poolSrcs", "themesSrc", "topicsSrc", "q1Src", "retake",
    "descriptors", "topics", "topicsNote", "themes", "qPool", "poolNote", "part1Pool", "part2Pool",
    "part1Intro", "part2Intro", "part1Note", "part2Note", "part1Pick", "part2Pick", "numNote", "q1", "q1Intro",
    "q1Note", "q1From", "practice", "own", "totalTasks", "totalMin"]);
  const walk = (o, at) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      assert.ok(!FORBIDDEN.has(k), at + "." + k + ": поле цитаты/источника/чужого формата в спецификации");
      walk(v, at + "." + k);
    }
  };
  assert.deepStrictEqual(Object.keys(SPECS).sort(), ["a1", "b1", "b2"], "спеки трёх курсов в реестре");
  for (const [crs, S] of Object.entries(SPECS)) {
    walk(S, crs);
    const raw = JSON.stringify(S);
    assert.ok(!/https?:/.test(raw), crs + ": в спецификации нет ни одного адреса");
    assert.ok(!NAME.test(raw), crs + ": в спецификации нет названия тестирования");
    NAME.lastIndex = 0;
    assert.strictEqual(S.subtests.length, 5, crs + ": пять частей проверки");
    for (const st of S.subtests) {
      for (const l of ["ru", "en", "tr", "ky"]) assert.ok(st[l] && st[l].length > 2, crs + "/" + st.id + ": имя на " + l);
      assert.ok(st.tasks > 0 && st.min > 0, crs + "/" + st.id + ": число заданий и минут заданы");
      // чужие числа формата не публикуем: 90/70, 30/25, по 3 задания на 25 минут
      for (const [a, b] of [[90, 70], [30, 25], [3, 25]])
        assert.ok(!(st.tasks === a && st.min === b), crs + "/" + st.id + ": " + a + "/" + b + " — чужой формат");
      if (st.kind === "write" || st.kind === "speak") {
        assert.ok(st.qPick >= 3 && st.qPick <= 12, crs + "/" + st.id + ": qPick в пределах, что принимает сервер");
        const second = st.kind === "write" ? !!st.minSent : !!st.minSec;
        assert.strictEqual(st.tasks, 1 + (second ? 1 : 0), crs + "/" + st.id + ": tasks = число листов задания");
      }
      if (st.minSent) assert.ok(![[12, 15], [15, 18]].some(([a, b]) => st.minSent === a && st.maxSent === b),
        crs + ": объём письма не чужой (12–15/15–18)");
      if (st.minSec) assert.ok(st.minSec < st.maxSec && !(st.minSec === 120 && st.maxSec === 180), crs + ": свой объём рассказа");
    }
    const sum = S.subtests.reduce((a, s) => a + s.tasks, 0), mins = S.subtests.reduce((a, s) => a + s.min, 0);
    assert.ok(sum !== 156 && mins !== 170, crs + ": итог не совпадает с чужим форматом (156/170)");
    for (const id of S.topicSkip || []) assert.ok(META.some((m) => m.id === id && m.course === crs), crs + ": topicSkip — модуль курса " + id);
  }
}

/* ---------- 2. Зона проверки в собранной странице: без названия и претензий ---------- */
{
  const zone = ["EXAM-A1", "EXAM-B1", "EXAM-B2", "EXAM-TEXTS", "EXAM-TEXTS-A1", "EXAM-TEXTS-B2", "EXAM"].map(blockSrc);
  for (const fn of ["renderRefM11", "renderRefM23", "renderRefM34", "renderRefM35", "renderRefM46", "renderRefM47"]) {
    const m = html.match(new RegExp("function " + fn + "\\(m\\)\\{[\\s\\S]*?\\n\\}"));
    assert.ok(m, fn + " в сборке"); zone.push(m[0]);
  }
  // словарь: все ключи проверки и вкладок недели
  const i18n = [...html.matchAll(/\b((?:exam_|tab_exam|tab_grp_format|tab_howto|fd_exam|howto_hdr)\w*):"((?:[^"\\]|\\.)*)"/g)];
  assert.ok(i18n.length > 150, "строки словаря проверки найдены: " + i18n.length);
  for (const m of i18n) zone.push(m[1] + ":" + m[2]);
  // контент экзаменационных недель и недель повторения (кроме словаря модуля — он вне зоны)
  const dataBox = { console }; vm.createContext(dataBox);
  vm.runInContext(blockSrc("DATA") + "; this.C=CONTENT;", dataBox);
  for (const id of ["m11", "m23", "m34", "m35", "m46", "m47"]) {
    const c = dataBox.C[id] || {};
    for (const [k, v] of Object.entries(c)) if (!["cats", "vocab", "drill"].includes(k)) zone.push(id + "." + k + ":" + JSON.stringify(v));
    assert.ok(!c.shots && !c.shotsSrc && !c.shotsHdr, id + ": скринов чужого интерфейса нет");
  }
  const text = zone.join("\n");
  const hits = [...text.matchAll(NAME)].map((m) => text.slice(Math.max(0, m.index - 40), m.index + 30));
  assert.strictEqual(hits.length, 1, "название в зоне — только адрес официального сайта, ровно один раз: " + JSON.stringify(hits));
  assert.ok(/const EXAM_SITE="https:\/\/kyrgyztest\.gov\.kg"/.test(text), "и это константа EXAM_SITE");
  // и во всей сборке тренажёра (все курсы, словари, диалоги, справочники): кыргызские
  // фразы курса говорят «мамлекеттик тест» (решение владельца 30.10.2026)
  const whole = [...html.matchAll(NAME)].map((m) => html.slice(Math.max(0, m.index - 40), m.index + 30));
  assert.strictEqual(whole.length, 1, "название во всей сборке — только адрес официального сайта: " + JSON.stringify(whole.slice(0, 5)));
  for (const piece of zone) {
    const m = CLAIM.exec(piece);
    assert.ok(!m, "претензия на официальность/копию: «" + (m && piece.slice(Math.max(0, m.index - 50), m.index + 50)) + "»");
  }
  assert.ok(!/\b156 (?:заданий|tasks|görev)|2 часа 50|2 hours 50|2 saat 50|\b90 (?:заданий|tasks|görev)/.test(text), "чужие числа формата не упоминаются");
  assert.ok(!/exam-real-/.test(html), "в странице нет скринов чужого интерфейса");
  // пометка о происхождении заданий — дословно по своду, на трёх языках
  const grab = (k) => [...html.matchAll(new RegExp(k + ':"((?:[^"\\\\]|\\\\.)*)"', "g"))].map((m) => m[1]);
  assert.deepStrictEqual(grab("exam_disclaimer"), [
    "Задания составлены learn.kg по материалам курса. Они не являются заданиями официального тестирования по кыргызскому языку и не связаны с ними.",
    "The tasks are written by learn.kg from the course materials. They are not tasks of the official Kyrgyz language test and are not related to them.",
    "Görevler learn.kg tarafından kurs materyallerinden hazırlanmıştır. Resmî Kırgızca dil sınavının görevleri değildir ve onlarla bağlantılı değildir."],
    "пометка о несвязанности — дословно, ru/en/tr");
  assert.strictEqual(grab("exam_site").length, 3, "строка-отсылка на официальный сайт на трёх языках");
  for (const s of grab("exam_site")) assert.ok(!/kyrgyztest/i.test(s), "адрес — только в ссылке, не в тексте строки");
  // вне зоны (данные модулей других недель) — справка для координатора, не гейт этой зоны
  const outside = (html.match(NAME) || []).length - 1;
  console.log("  зона проверки: название 1 раз (EXAM_SITE), претензий нет; вне зоны в странице ещё " + outside + " упоминаний");
}

/* ---------- 3. Вопросы — фразы курса, темы — модули курса (перебор по курсам) ---------- */
{
  const { CONTENT, DIALOGS } = require("../deploy/gen-audio").loadData();
  const box = { console, MODULE_META: META, CONTENT: JSON.parse(JSON.stringify(CONTENT)), DIALOGS };
  vm.createContext(box);
  vm.runInContext(["EXAM-A1", "EXAM-B1", "EXAM-B2", "EXAM"].map(blockSrc).join(";").replace(/\bconst Exam=/, "this.Exam="), box);
  for (const crs of ["a1", "b1", "b2"]) {
    const S = SPECS[crs];
    const mods = META.filter((m) => m.course === crs).map((m) => m.id);
    const byId = {};
    for (const id of mods) for (const v of (CONTENT[id] || {}).vocab || []) if (v && v.id && v.ky && !v.ref) byId[v.id] = v.ky;
    const topicOk = META.filter((m) => m.course === crs && !m.exam && !(S.topicSkip || []).includes(m.id));
    const seenQ = new Set(), seenT = new Set();
    for (let v = 0; v < 15; v++) {
      for (const kind of ["jazuu", "suiloo"]) {
        const sp = S.subtests.find((x) => x.id === kind);
        const items = JSON.parse(JSON.stringify(vm.runInContext(
          "Exam.use(" + JSON.stringify(crs) + "); Exam.itemsFor(Exam.spec.subtests.find(x=>x.id===" + JSON.stringify(kind) + ")," + (100 + v * 31) + ")", box)));
        assert.strictEqual(items.length, sp.tasks, crs + "/" + kind + ": листов столько, сколько заданий в спеке");
        const q = items.find((x) => x.qs);
        assert.ok(q && q.qs.length === sp.qPick, crs + "/" + kind + ": " + sp.qPick + " вопросов");
        assert.strictEqual(new Set(q.qs).size, q.qs.length, crs + "/" + kind + ": вопросы не повторяются");
        q.qs.forEach((txt, i) => {
          const id = q.qSrc[i];
          assert.ok(mods.includes(id.split("_")[0]), crs + ": вопрос из модуля своего курса — " + id);
          assert.strictEqual(byId[id], txt, crs + ": вопрос «" + txt + "» — дословно фраза курса " + id);
          assert.ok(/\?$/.test(txt), crs + ": фраза курса — вопросительная");
          seenQ.add(txt);
        });
        const t2 = items.find((x) => x.topic);
        if (t2) {
          const mm = topicOk.find((m) => m.id === t2.topic.mod);
          assert.ok(mm, crs + "/" + kind + ": тема — модуль курса, не неделя проверки и не topicSkip: " + t2.topic.mod);
          assert.deepStrictEqual([t2.topic.ru, t2.topic.en, t2.topic.tr], [mm.title, mm.titleEn, mm.titleTr],
            crs + ": тема — название модуля на трёх языках");
          seenT.add(t2.topic.mod);
        }
      }
    }
    assert.ok(seenQ.size >= 20, crs + ": вопросы меняются от попытки к попытке (" + seenQ.size + " разных)");
    if (S.subtests.some((x) => x.minSent || x.minSec)) assert.ok(seenT.size >= 3, crs + ": темы меняются (" + seenT.size + ")");
    console.log("  " + crs + ": вопросы письма и речи — " + seenQ.size + " разных фраз курса, тем-модулей " + seenT.size);
  }
  // чистая функция: только «?», без повторов, однословные вопросы не берутся
  const qs = JSON.parse(JSON.stringify(vm.runInContext(
    "examQuestions([{id:'a',mod:'m1',ky:'Сиз кимсиз?'},{id:'b',mod:'m1',ky:'Сиз кимсиз?'},{id:'c',mod:'m1',ky:'Мен окуйм.'},{id:'d',mod:'m1',ky:'Ким?'}])", box)));
  assert.deepStrictEqual(qs.map((x) => x.id), ["a"], "examQuestions: вопрос, один раз, не короче двух слов");
}

/* ---------- 4. Интро и итог: пометка, одна ссылка, ни справки «настоящего», ни пересдачи ---------- */
{
  const { examBox, drawnWith } = require("./helpers/exam-box");
  const bx = examBox({ activeModule: "m35", MODULE_META: [{ id: "m35", course: "b1", exam: true }],
    EXAM_SPECS: { b1: JSON.parse(JSON.stringify(E)) }, CONTENT: {} });
  vm.runInContext("Exam.use('b1'); Exam.intro();", bx);
  assert.ok(drawnWith(bx.nodes, "exam_disclaimer"), "интро: пометка о несвязанности с официальным тестированием");
  const links = bx.nodes.filter((n) => n.tag === "a");
  assert.strictEqual(links.length, 1, "интро: одна ссылка");
  assert.strictEqual(links[0].attrs.href, "https://kyrgyztest.gov.kg", "и это официальный сайт тестирования");
  assert.ok(drawnWith(bx.nodes, "exam_site"), "рядом — строка-отсылка про формат и запись");
  for (const gone of ["exam_about", "exam_total", "exam_retake_hdr", "exam_src"])
    assert.ok(!drawnWith(bx.nodes, gone), "интро без «" + gone + "»");
  assert.ok(!bx.nodes.some((n) => n.tag === "details"), "свёрнутой справки о чужом экзамене нет");
  bx.nodes.length = 0;
  vm.runInContext("Exam.begin(); Exam.finish(false);", bx);
  assert.ok(drawnWith(bx.nodes, "exam_disclaimer"), "итог: пометка о несвязанности");
  assert.ok(drawnWith(bx.nodes, "exam_calib"), "итог: калибровка «тренировка, не прогноз балла»");
  assert.ok(!drawnWith(bx.nodes, "exam_retake_hdr"), "итог без правила пересдачи");
  const cal = [...html.matchAll(/exam_calib:"([^"]*)"/g)].map((m) => m[1]);
  assert.strictEqual(cal.length, 3, "калибровка на трёх языках");
  for (const c of cal) assert.ok(!/\d/.test(c), "в калибровке нет чисел (процент ≠ балл)");
  assert.ok(/прогноз балла официального тестирования/.test(cal[0]), "калибровка говорит, что это не прогноз");
}

/* ---------- 8. Реестр модулей со вкладкой ---------- */
assert.ok(Array.isArray(sb.MODS) && sb.MODS.length >= 1, "EXAM_MODS — список модулей со вкладкой экзамена");
const metaSrc = html.match(/const MODULE_META=\[([\s\S]*?)\];/);
assert.ok(metaSrc, "MODULE_META найден");
for (const mid of sb.MODS) {
  const row = metaSrc[1].split("\n").find((l) => l.includes('{id:"' + mid + '"'));
  assert.ok(row, "модуль " + mid + " есть в каталоге");
  assert.ok(/exam:true/.test(row), mid + ": вкладка экзамена открыта только экзаменационной неделе");
  // ручная подпись: у каких курсов заведены спеки экзамена (EXAM_SPECS) — новый
  // экзамен = новая строка здесь, в том же PR, что и его данные
  const crs = (row.match(/course:"(\w+)"/) || [])[1];
  assert.ok(["a1", "b1", "b2"].includes(crs), mid + ": экзамен заведён у курсов a1, b1 и b2, а тут " + crs);
}

console.log("exam-b1.test.js: OK (спеки A1/B1/B2 свои, без цитат и источников; зона без названия, кроме EXAM_SITE; " +
  "вопросы — фразы курса, темы — модули; " + E.subtests.reduce((a, x) => a + x.tasks, 0) + " заданий B1)");

/* ---------- 9. Движок: исполнение на модельных данных ----------
   Проверяется поведение, а не текст реализации: сколько заданий выдаётся, откуда
   они берутся, повторяются ли внутри попытки, стабильна ли выборка при одном сиде
   и меняется ли при другом (на экзамене лист один, но у соседа он другой). */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  assert.ok(eng, "маркер ===EXAM=== (движок) в собранной странице");
  const box = { console };
  vm.createContext(box);
  vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") +
    "; this.examBank=examBank; this.examItems=examItems; this.examPct=examPct;", box);

  /* Модель: слова-однословы, предложения на 4+ слов (пропуск, порядок слов) и
     диалог с парами «вопрос → ответ другого персонажа». Слова вопросов у каждой
     пары свои — ответ одной пары не годится к вопросу другой (иначе два верных). */
  const SYL = ["ба", "ке", "ми", "но", "сү", "тө", "жа", "ло", "ры", "гү"];
  const word = (i) => SYL[i % 10] + SYL[Math.floor(i / 10) % 10] + SYL[(i * 7 + 3) % 10] + "р";
  const lines = [];
  for (let i = 0; i < 16; i++) {
    lines.push({ id: "ph_m24d1_" + (2 * i), sp: "Айбек", ky: word(i) + " " + word(i + 30) + "?", ru: "вопрос " + i });
    lines.push({ id: "ph_m24d1_" + (2 * i + 1), sp: "Айгүл", ky: "Мен " + word(i + 60) + " барам.", ru: "ответ " + i });
  }
  // реплика без вопроса и ответ тем же персонажем — не пары
  lines.push({ id: "ph_m24d1_90", sp: "Айгүл", ky: "Жакшы.", ru: "Хорошо." },
    { id: "ph_m24d1_91", sp: "Айгүл", ky: "Мен да барам.", ru: "Я тоже иду." });
  const DIALOGS = { m24: { parts: [{ lines }] } };
  const CONTENT = {
    m24: {
      drill: [{ qKy: "Ал келиптир", opts: ["a", "b", "c", "d"], c: 1 }, { qKy: "Мен барыптырмын", opts: ["a", "b"], c: 0 }],
      vocab: Array.from({ length: 40 }, (_, i) => ({ id: "m24_" + i,
        ky: i < 20 ? "сөз" + i : word(i + 100) + " " + word(i + 200) + " " + word(i + 300) + " " + word(i + 400) + ".",
        ru: "слово" + i })),
    },
    m25: {
      drill: [{ qKy: "Иштеп жүрүптүр", opts: ["a", "b", "c"], c: 2 }],
      // ref-слово — донор чужого модуля, своим заданием быть не может
      vocab: [{ id: "m25_1", ky: "жаңы", ru: "новый" }, { id: "m25_2", ref: "m24_1" }],
    },
  };
  const bank = box.examBank(CONTENT, ["m24", "m25"], DIALOGS);
  assert.strictEqual(bank.drills.length, 3, "в банк вошли все годные дриллы курса");
  assert.strictEqual(bank.lex.length, 41, "в банк вошли свои слова, alias-донор пропущен");
  assert.ok(!bank.lex.some((x) => x.id === "m25_2"), "ref-слово в задания не попадает");
  assert.strictEqual(bank.replies.length, 16, "пары «вопрос → ответ другого» — все 16, не-вопрос и ответ себе пропущены");

  const RU = new Set([...bank.lex.map((x) => x.ru), ...lines.map((l) => l.ru)]);
  const items = box.examItems(bank, 20, 12345);
  assert.ok(items.length >= 18 && items.length <= 20,
    "на модельном банке выдан почти полный лист: " + items.length);
  assert.strictEqual(new Set(items.map((x) => x.ref)).size, items.length, "внутри попытки задания не повторяются");
  for (const it of items) {
    assert.ok(it.opts.length >= 2, it.ref + ": есть варианты");
    assert.ok(Number.isInteger(it.c) && it.c >= 0 && it.c < it.opts.length, it.ref + ": верный ответ внутри списка");
    assert.strictEqual(new Set(it.opts).size, it.opts.length, it.ref + ": варианты не дублируются");
    // на настоящем экзамене русского нет: ни вопрос, ни варианты не берутся из переводов
    assert.ok(!RU.has(it.q) && !it.opts.some((o) => RU.has(o)), it.ref + ": задание на русском — " + it.t);
    assert.ok(!["lex", "rulex"].includes(it.t), it.ref + ": тип «слово → перевод» снят");
    const base = String(it.ref).replace(/_(def|odd)$/, "");
    if (it.t === "drill") {
      const d = bank.drills.find((x) => x.id === base);
      assert.strictEqual(it.c, d.c, it.ref + ": верный ответ дрилла не съехал при перемешивании");
      assert.deepStrictEqual(it.opts, d.opts, it.ref + ": варианты дрилла идут как в курсе");
    } else if (it.t === "reply") {
      const qi = lines.findIndex((l) => l.ky === it.q);
      assert.ok(qi >= 0 && /\?$/.test(it.q), it.ref + ": спрашивается реплика-вопрос диалога");
      assert.strictEqual(it.opts[it.c], lines[qi + 1].ky, it.ref + ": верный — ответ собеседника на ЭТУ реплику");
      for (const o of it.opts) if (o !== it.opts[it.c]) {
        const oi = lines.findIndex((l) => l.ky === o);
        assert.ok(oi > 0 && lines[oi - 1].ky !== it.q, it.ref + ": дистрактор — ответ на другую реплику");
      }
    }
  }
  assert.ok(items.some((x) => x.t === "reply"), "в листе есть задания «реплика → ответ»");
  // сид: тот же — тот же лист (обновление страницы не подсовывает другой набор)
  assert.deepStrictEqual(box.examItems(bank, 20, 12345).map((x) => x.ref), items.map((x) => x.ref),
    "один сид — один и тот же лист заданий");
  assert.notDeepStrictEqual(box.examItems(bank, 20, 999).map((x) => x.ref), items.map((x) => x.ref),
    "другой сид — другой лист: у соседа свой вариант");
  // банк меньше запроса: выдаём что есть, а не падаем и не дублируем
  const small = box.examItems(box.examBank({ m24: CONTENT.m24 }, ["m24"]), 90, 7);
  assert.ok(small.length > 0 && small.length < 90, "при малом банке выдаётся сколько есть: " + small.length);
  assert.strictEqual(new Set(small.map((x) => x.ref)).size, small.length, "и всё равно без повторов");
  // похожие вопросы не дают второго верного ответа: «… кандайсыз?» и «Кандай …?»
  // делят основу — ответ одного не становится дистрактором другого
  {
    const twin = [{ id: "ph_a", sp: "А", ky: "Иштериңиз кандай?", ru: "" }, { id: "ph_b", sp: "Б", ky: "Жакшы эле, рахмат.", ru: "" },
      { id: "ph_c", sp: "А", ky: "Кандайсыз, эже?", ru: "" }, { id: "ph_d", sp: "Б", ky: "Жакшы, өзүңүз кандай?", ru: "" }];
    const tb = box.examBank({ m24: { vocab: [] } }, ["m24"], { m24: { parts: [{ lines: twin.concat(lines) }] } });
    for (let sd = 1; sd < 40; sd++) {
      const its = box.examItems(tb, 30, sd).filter((x) => x.t === "reply" && /кандай/i.test(x.q));
      for (const it of its) assert.ok(!it.opts.some((o) => /^Жакшы/.test(o) && o !== it.opts[it.c]),
        it.ref + ": ответ на похожий вопрос стал дистрактором — два верных варианта");
    }
  }

  // проценты
  assert.strictEqual(box.examPct(45, 90), 50, "процент считается от числа заданий");
  assert.strictEqual(box.examPct(0, 0), 0, "пустая попытка не делит на ноль");
  const engSrc = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//)[0];
  assert.ok(!/examRetake/.test(engSrc), "правил пересдачи в движке нет: это не наш экзамен");

  // реальный банк курса B1 обязан покрывать субтест целиком: иначе экзамен короче обещанного
  const real = require("../deploy/gen-audio").loadData().CONTENT;
  const b1mods = Object.keys(real).filter((id) => Number(id.slice(1)) >= 24);
  const realBank = box.examBank(JSON.parse(JSON.stringify(real)), b1mods, require("../deploy/gen-audio").loadData().DIALOGS);
  const lexgram = E.subtests[0];
  assert.ok(realBank.drills.length + realBank.lex.length >= lexgram.tasks * 2,
    "банк курса вдвое больше субтеста (" + (realBank.drills.length + realBank.lex.length) +
    " против " + lexgram.tasks + ") — попытки не повторяют друг друга");
  const realItems = box.examItems(realBank, lexgram.tasks, 4242);
  assert.strictEqual(realItems.length, lexgram.tasks,
    "на реальных данных выдаётся полный субтест: " + realItems.length + " из " + lexgram.tasks);
}

/* ---------- 10. Тексты Окуу и Угуу: вычитка машиной ----------
   Кыргызский в этом проекте не сочиняется. Текст экзамена собран из предложений
   курса, и здесь это проверяется дословно: каждое предложение обязано совпасть
   с фразой словаря B1 по её id. Плюс проверка, которая ловит самый частый брак
   самодельных тестов — вопрос, у которого верны два варианта. */
{
  const tsrc = html.match(/\/\* ===EXAM-TEXTS===[\s\S]*?\/\* ===\/EXAM-TEXTS=== \*\//);
  assert.ok(tsrc, "маркер ===EXAM-TEXTS=== в собранной странице");
  const tb = { console };
  vm.createContext(tb);
  vm.runInContext(tsrc[0] + "; this.T=EXAM_TEXTS;", tb);
  const TEXTS = JSON.parse(JSON.stringify(tb.T));
  assert.ok(TEXTS.length >= 2, "тексты заведены: " + TEXTS.length);

  // словарь курса: id → фраза (то, что вычитано носителем)
  const CONTENT = require("../deploy/gen-audio").loadData().CONTENT;
  const byId = {};
  for (const [mid, c] of Object.entries(CONTENT)) {
    if (Number(mid.slice(1)) < 24) continue;
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

    // ГЛАВНОЕ: каждое предложение — дословно фраза курса
    for (const ln of T.lines) {
      assert.ok(ln.src, T.id + ": у предложения указан источник");
      assert.ok(byId[ln.src], T.id + ": фраза " + ln.src + " есть в словаре курса B1");
      assert.strictEqual(ln.ky, byId[ln.src],
        T.id + " / " + ln.src + ": предложение расходится с вычитанной фразой курса");
      assert.ok(Number(ln.src.slice(1).split("_")[0]) >= 24, T.id + ": предложение из модуля B1");
    }

    // вопросы: ответ лежит в названном предложении и только в нём
    // (≥4: из «Мои планы» снято предложение с названием тестирования вместе с вопросом)
    assert.ok(T.qs.length >= 4, T.id + ": к тексту не меньше пяти вопросов");
    const body = T.lines.map((l) => l.ky.toLowerCase());
    for (const q of T.qs) {
      assert.ok(Number.isInteger(q.s) && q.s >= 0 && q.s < T.lines.length, T.id + ": номер предложения-ответа в тексте");
      assert.ok(/[?]$/.test(q.ky), T.id + ": вопрос на кыргызском со знаком вопроса — «" + q.ky + "»");
      assert.strictEqual(q.opts.length, 4, T.id + ": четыре варианта у «" + q.ky + "»");
      assert.strictEqual(new Set(q.opts).size, 4, T.id + ": варианты не повторяются у «" + q.ky + "»");
      assert.ok(Number.isInteger(q.c) && q.c >= 0 && q.c < 4, T.id + ": верный ответ в диапазоне");
      const right = q.opts[q.c].toLowerCase();
      assert.ok(body[q.s].includes(right),
        T.id + " / «" + q.ky + "»: ответ «" + q.opts[q.c] + "» обязан встречаться в предложении " + (q.s + 1));
      // дистрактор не должен находиться нигде в тексте — иначе у вопроса два ответа
      for (let k = 0; k < q.opts.length; k++) {
        if (k === q.c) continue;
        const wrong = q.opts[k].toLowerCase();
        assert.ok(!body.some((s) => s.includes(wrong)),
          T.id + " / «" + q.ky + "»: неверный вариант «" + q.opts[k] + "» тоже есть в тексте — у вопроса два ответа");
      }
    }
    // Угуу без дорожки — не готов к показу: молчащих кнопок не бывает
    // строго "lines": движок играет T.lines[].src и сравнивает флаг с литералом —
    // текст с audio:"ph_..." прошёл бы старый ассерт и показал текст вместо звука
    if (T.kind === "uguu") assert.strictEqual(T.audio, "lines",
      T.id + ": режим аудирования — lines (дорожки предложений)");
  }
  console.log("  тексты: " + TEXTS.length + ", предложений " +
    TEXTS.reduce((a, t) => a + t.lines.length, 0) + " — все сверены с вычитанными фразами курса, вопросов " +
    TEXTS.reduce((a, t) => a + t.qs.length, 0));
}

/* ---------- 11. Адверсарная проверка заданий (требование владельца 22.08.2026) ----------
   Гейт не спрашивает «сгенерировалось ли», он ПЫТАЕТСЯ ОПРОВЕРГНУТЬ каждое задание
   двадцати разных вариантов экзамена. Атаки — по списку известных способов сделать
   тест недействительным:
     A. у вопроса два верных ответа (дистрактор равен ответу по смыслу/строке);
     B. ответ угадывается по форме (самый длинный/короткий вариант, единственный
        с заглавной буквы, единственный с точкой) — тогда проверяется не язык;
     C. верный ответ всегда стоит на одном месте — тест решается вслепую;
     D. задание пустое, без вопроса или с вариантом-заглушкой;
     E. однообразие: типов меньше положенного, или один тип съедает половину;
     F. повтор внутри варианта и между соседними вариантами. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const box = { console };
  vm.createContext(box);
  vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") +
    "; this.examBank=examBank; this.examItems=examItems; this.KINDS=EXAM_KINDS;", box);
  const CONTENT = JSON.parse(JSON.stringify(require("../deploy/gen-audio").loadData().CONTENT));
  const b1 = Object.keys(CONTENT).filter((id) => Number(id.slice(1)) >= 24);
  const bank = box.examBank(CONTENT, b1, require("../deploy/gen-audio").loadData().DIALOGS);
  const N = E.subtests[0].tasks;

  const posHist = {}, kindHist = {};
  let checked = 0;
  const prev = [];
  for (let v = 0; v < 20; v++) {
    const items = box.examItems(bank, N, 1000 + v * 137);
    assert.ok(items.length >= N * 0.95,
      "вариант " + v + ": субтест собран целиком (" + items.length + " из " + N + ")");
    // F. внутри варианта — без повторов
    assert.strictEqual(new Set(items.map((x) => x.ref)).size, items.length, "вариант " + v + ": задания не повторяются");
    if (prev.length) {
      const same = items.filter((x) => prev.includes(x.ref)).length / items.length;
      assert.ok(same < 0.7, "вариант " + v + ": пересечение с предыдущим " + Math.round(same * 100) + "% — варианты слишком похожи");
    }
    prev.length = 0; prev.push(...items.map((x) => x.ref));

    const kinds = {};
    for (const it of items) {
      checked++;
      kinds[it.t] = (kinds[it.t] || 0) + 1;
      kindHist[it.t] = (kindHist[it.t] || 0) + 1;
      posHist[it.c] = (posHist[it.c] || 0) + 1;
      const right = it.opts[it.c];

      // D. пустое или дефектное задание
      assert.ok(it.opts.length === 4, it.ref + ": ровно четыре варианта");
      for (const o of it.opts) assert.ok(String(o).trim().length > 0, it.ref + ": пустой вариант ответа");
      assert.strictEqual(new Set(it.opts).size, 4, it.ref + ": варианты повторяются — ответов больше одного");
      if (it.t !== "odd") assert.ok(String(it.q).trim().length > 0, it.ref + ": задание без вопроса");

      // A. дистрактор, совпадающий с ответом без учёта регистра и хвостовой пунктуации
      const norm2 = (x) => String(x).toLowerCase().replace(/[.,!?;:\s]+$/, "").trim();
      assert.strictEqual(new Set(it.opts.map(norm2)).size, 4, it.ref + ": два варианта совпадают по сути");

      // B. ответ не должен вычисляться по форме
      const lens = it.opts.map((x) => String(x).length);
      const uniqLongest = lens.filter((l) => l === Math.max(...lens)).length === 1;
      const uniqShortest = lens.filter((l) => l === Math.min(...lens)).length === 1;
      if (uniqLongest) assert.ok(!(lens[it.c] === Math.max(...lens) && Math.max(...lens) > Math.min(...lens) * 2.5),
        it.ref + ": верный ответ — единственный длинный, угадывается без языка");
      if (uniqShortest) assert.ok(!(lens[it.c] === Math.min(...lens) && Math.max(...lens) > Math.min(...lens) * 2.5),
        it.ref + ": верный ответ — единственный короткий, угадывается без языка");
      const caps = it.opts.filter((x) => /^[А-ЯЁӨҮҢ]/.test(String(x)));
      if (caps.length === 1) assert.ok(caps[0] !== right, it.ref + ": верный — единственный с заглавной буквы");
      const dots = it.opts.filter((x) => /[.!?]$/.test(String(x)));
      if (dots.length === 1) assert.ok(dots[0] !== right, it.ref + ": верный — единственный с точкой");

      // cloze: пропуск действительно есть, и вставка ответа даёт фразу курса
      if (it.t === "cloze") {
        assert.ok(it.q.includes("____"), it.ref + ": в предложении есть пропуск");
        assert.ok(it.explain && it.explain.ky.toLowerCase().includes(String(right).toLowerCase()),
          it.ref + ": вставленное слово даёт исходную фразу курса");
      }
      // order: верный вариант — ровно фраза курса, дистракторы — её перестановки
      if (it.t === "order") {
        const ref = it.explain.ky.replace(/[.!?]$/, "");
        assert.strictEqual(right, ref, it.ref + ": верный порядок — фраза курса дословно");
        for (const o of it.opts) assert.strictEqual(String(o).split(/\s+/).slice().sort().join("|"),
          ref.split(/\s+/).slice().sort().join("|"), it.ref + ": варианты — перестановки тех же слов");
      }
      // обучающий разбор: у каждого типа, кроме дрилла (у него объяснение в самом задании)
      assert.ok(it.explain && it.explain.ky, it.ref + ": нет разбора — ошибка ничему не научит");
      if (it.t === "drill") assert.ok(it.explain.rule || it.explain.ru,
        it.ref + ": у грамматического задания нет ни перевода, ни правила");
    }
    // E. однообразие
    assert.ok(Object.keys(kinds).length >= 6, "вариант " + v + ": типов заданий " + Object.keys(kinds).length + " — мало");
    for (const [k, n] of Object.entries(kinds))
      assert.ok(n <= N * 0.4, "вариант " + v + ": тип " + k + " занимает " + n + " из " + N + " — экзамен однообразен");
  }
  // C. верный ответ не липнет к одной позиции
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35,
      "позиция верного ответа " + pos + ": " + Math.round(share * 100) + "% — тест решается вслепую");
  }
  assert.strictEqual(Object.keys(kindHist).sort().join(","), box.KINDS.slice().sort().join(","),
    "все объявленные типы заданий реально встречаются: " + Object.keys(kindHist).join(","));
  console.log("  адверсарно проверено заданий: " + checked + " в 20 вариантах, типов " +
    Object.keys(kindHist).length + " (" + Object.entries(kindHist).map(([k, n]) => k + ":" + n).join(" ") + ")");
}

/* ---------- 12. Стартовый экран: вход в экзамен виден сразу ----------
   Претензия владельца 22.08.2026 — «где здесь внятный старт экзамена?». Экран
   исполняется с DOM-заглушкой, и проверяется порядок: заголовок и кнопка «Начать»
   идут ДО справочной таблицы, а сама справка свёрнута в details. Это поведение,
   а не текст реализации: перестановка блоков местами валит тест. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const order = [];
  const node = (tag, attrs) => {
    const n = { tag, attrs: attrs || {}, kids: [], append(...xs) { this.kids.push(...xs); return this; } };
    order.push(n);
    return n;
  };
  const box = {
    console,
    h: (tag, attrs, ...kids) => { const n = node(tag, attrs); n.kids.push(...kids); return n; },
    // el отдаёт узел с append: рендер теперь пишет в сам узел, а не в результат clear
    el: () => node("area", {}), clear: (x) => { x.kids.length = 0; return x; },
    t: (k) => k, harmonyTable: (head, rows) => node("table", { rows: rows.length }),
    metaOf: () => ({ num: "М35", title: "Экзаменационная неделя" }), metaTitle: (m) => m.title,
    ST: {}, save: () => {}, saveLocal: () => {}, evPush: () => {}, activeModule: "m35",
    // ВАЖНО: в контексте нет ни одной глобали, которой нет в приложении.
    // Выдуманная LANG однажды уронила вкладку в живом браузере (ReferenceError),
    // а тест с «доброй» заглушкой этого не увидел — теперь имена берутся из кода.
    currentLang: () => "ru", MODULE_META: [{ id: "m35", course: "b1" }], CONTENT: {},
    IS_DEMO: false, ST: {}, fetch: () => Promise.resolve({ ok: false }),
    EXAM_B1: JSON.parse(JSON.stringify(E)),
  };
  vm.createContext(box);
  vm.runInContext(eng[0] + "; this.Exam=Exam; Exam.spec=EXAM_B1; Exam.intro();", box);

  const tags = order.map((n) => n.tag);
  const btnIdx = order.findIndex((n) => n.tag === "button");
  const noteIdx = order.findIndex((n) => n.kids.includes("exam_disclaimer"));
  const linkIdx = order.findIndex((n) => n.tag === "a");
  assert.ok(btnIdx >= 0, "на стартовом экране есть кнопка: " + tags.join(","));
  assert.ok(noteIdx >= 0 && linkIdx >= 0, "пометка о заданиях и ссылка на официальный сайт на экране");
  assert.ok(btnIdx < linkIdx, "кнопка «Начать проверку» идёт РАНЬШЕ справочной ссылки");
  assert.ok(!order.some((n) => n.tag === "details" || n.tag === "table"), "справочной таблицы чужого экзамена нет");
  const hero = order.find((n) => n.attrs && n.attrs.class === "exam-hero");
  assert.ok(hero, "заголовок, суть и кнопка собраны в один блок старта");
  const big = order.find((n) => n.attrs && /\bbig\b/.test(String(n.attrs.class || "")));
  assert.ok(big, "кнопка старта крупная — её видно без поиска глазами");
  // и обещание экрана не расходится со спецификацией: столько заданий и минут реально будет
  const lex = E.subtests[0];
  const line = order.find((n) => n.tag === "p" && n.kids.some((k) => String(k).startsWith("exam_now")));
  assert.ok(line && String(line.kids[0]).includes(lex.ru.toLowerCase() + " (exam_nm)"),
    "старт называет части и их объём (exam_nm из спецификации): " + (line && line.kids[0]));
}

/* ---------- 13. Стартовый экран не повторяется ----------
   Владелец 22.08.2026: «невнятный текст» — заголовок стоял трижды, а справка
   пересказывала строку над кнопкой. Экран обязан говорить каждую вещь один раз. */
{
  const dictSrc = html.match(/const I18N=\{([\s\S]*?)\n\};/);
  assert.ok(dictSrc, "словарь интерфейса найден");
  for (const lang of ["ru", "en", "tr"]) {
    const grab = (key) => {
      const m = html.match(new RegExp(key + ':"((?:[^"\\\\]|\\\\.)*)"', "g")) || [];
      return m.map((x) => x.slice(key.length + 2, -1));
    };
    const pitch = grab("exam_pitch"), warn = grab("exam_warn");
    // ключ справки удалён вместе с пересказом: если вернётся — вернётся и дубль
    assert.strictEqual(grab("exam_intro").length, 0, "справка не пересказывает строку над кнопкой");
    assert.strictEqual(pitch.length, 3, "exam_pitch на трёх языках");
    // одно и то же не сказано дважды: строка под заголовком и предупреждение — про разное
    for (let i = 0; i < 3; i++) {
      const words = (s) => new Set(String(s).toLowerCase().match(/[\p{L}]{5,}/gu) || []);
      const a = words(pitch[i]), b = words(warn[i]);
      const common = [...a].filter((w) => b.has(w));
      assert.ok(common.length <= 2,
        "строка состава и предупреждение пересказывают друг друга (" + common.join(",") + ")");

    }
  }
}

/* ---------- 14. В задание не попадает служебный текст курса ----------
   На проде вылезла дефиниция с методической пометкой «(М9)» — ученик видел
   служебную ссылку на модуль вместо задания. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const box = { console };
  vm.createContext(box);
  vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") +
    "; this.examBank=examBank; this.examItems=examItems;", box);
  const CONTENT = JSON.parse(JSON.stringify(require("../deploy/gen-audio").loadData().CONTENT));
  const bank = box.examBank(CONTENT, Object.keys(CONTENT).filter((id) => Number(id.slice(1)) >= 24), require("../deploy/gen-audio").loadData().DIALOGS);
  const SERVICE = /\(М\d|\(\d+-е|\(образц|\(пример|М\d\)/i;
  let seen = 0;
  for (let v = 0; v < 12; v++) {
    for (const it of box.examItems(bank, 90, 500 + v * 91)) {
      seen++;
      assert.ok(!SERVICE.test(String(it.q)),
        it.ref + ": в тексте задания служебная пометка курса — «" + it.q + "»");
      for (const o of it.opts) assert.ok(!SERVICE.test(String(o)),
        it.ref + ": служебная пометка в варианте ответа — «" + o + "»");
    }
  }
  console.log("  служебные пометки курса: 0 в " + seen + " заданиях 12 вариантов");
}

/* ---------- 15. Находки ревью 22.08.2026 — каждая закрыта тестом ---------- */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const box = { console };
  vm.createContext(box);
  vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") +
    "; this.examSummary=examSummary; this.examOrder=examOrder; this.examTextItems=examTextItems;", box);

  // A. Итог экзамена: верные И всего считаются по ВСЕМ ответам всех субтестов.
  //    Первая версия делила верные по всем на длину последнего листа → до 400%.
  const answers = [
    ...Array.from({ length: 90 }, (_, i) => ({ ref: "a" + i, mod: "m24", sub: "lexgram", ok: i < 60 })),
    ...Array.from({ length: 30 }, (_, i) => ({ ref: "b" + i, mod: "m30", sub: "okuu", ok: i < 15 })),
  ];
  // объекты из vm-реалма ломают deepStrictEqual прототипом — JSON round-trip (канон)
  const sum = JSON.parse(JSON.stringify(box.examSummary(answers)));
  assert.strictEqual(sum.total, 120, "всего — по всем субтестам");
  assert.strictEqual(sum.right, 75, "верные — по всем субтестам");
  assert.strictEqual(sum.pct, 63, "процент 75/120, а не 75/30");
  assert.ok(sum.pct <= 100, "итог не может превышать 100%");
  assert.deepStrictEqual(sum.bySub, { lexgram: { n: 90, ok: 60 }, okuu: { n: 30, ok: 15 } },
    "разбивка по субтестам для ведомости");

  // F. Порядок слов: перемешанное условие никогда не совпадает с верным ответом
  //    (8% сидов читались прямо из условия — замер 252/3000)
  let made = 0;
  for (let seed = 0; seed < 3000; seed++) {
    const it = box.examOrder({ id: "x", mod: "m24", ky: "Атам иште жүрөт бүгүн.", ru: "…" }, seed);
    if (!it) continue;
    made++;
    assert.notStrictEqual(it.q.replace(/ · /g, " "), it.opts[it.c],
      "сид " + seed + ": условие совпало с верным ответом — задание решается чтением");
  }
  assert.ok(made > 2000, "задания порядка слов всё ещё генерируются: " + made);

  // E. У задания по тексту mod — модуль (для разбора и «Где просело»), не id фразы
  const ti = box.examTextItems([{ id: "t1", kind: "okuu", title: { ru: "x" },
    lines: [{ src: "m30_05", ky: "Шаарда мүмкүнчүлүк көп." }],
    qs: [{ s: 0, ky: "Эмне көп?", opts: ["а", "б", "в", "г"], c: 0 }] }], 5, 1);
  assert.strictEqual(ti[0].mod, "m30", "mod текстового задания — модуль, а не id фразы");

  // B. Вкладка экзамена входит в список занятий, запираемых у отнятого курса.
  //    Греп по списку — исполнение renderTab требует полного DOM; список — данные гейта.
  const tabs = html.match(/const STUDY_TABS=\[([^\]]*)\]/);
  assert.ok(tabs && tabs[1].includes('"exam"'),
    "exam в STUDY_TABS — иначе отнятый курс проходит экзамен через #m35/exam");

  // I. События экзамена видны в ленте учителя фильтром, а не только «Все»
  assert.ok(/feedFilter==="test"[^\n]*exam\./.test(html), "фильтр ленты ловит exam.*");

  // G. Слияние прогресса не теряет историю экзамена: устройство без ST.exam
  //    не затирает серверную копию. Исполняем настоящий mergeProgress из server.js.
  const srv = fs.readFileSync(path.join(ROOT, "server", "server.js"), "utf8");
  const mp = srv.match(/function mergeProgress\(prev, next\) \{[\s\S]*?\n\}/);
  assert.ok(mp, "mergeProgress найден в server.js");
  const sb2 = { console };
  vm.createContext(sb2);
  vm.runInContext(mp[0] + "; this.mergeProgress=mergeProgress;", sb2);
  const prev = { v: 2, modules: {}, exam: { last: { pct: 63 }, attempts: [{ pct: 63 }] } };
  const fresh = { v: 2, modules: {} };
  const merged = JSON.parse(JSON.stringify(sb2.mergeProgress(prev, fresh)));
  assert.deepStrictEqual(merged.exam, prev.exam, "история экзамена вернулась из серверной копии");
  const withOwn = { v: 2, modules: {}, exam: { last: { pct: 80 }, attempts: [{ pct: 63 }, { pct: 80 }] } };
  assert.strictEqual(JSON.parse(JSON.stringify(sb2.mergeProgress(prev, withOwn))).exam.last.pct, 80,
    "своя, более полная история не затирается старой");
  console.log("  находки ревью: итог по всем субтестам, порядок слов без подсказки, mod модуля, " +
    "гейт отнятого, лента, слияние ST.exam");
}

/* ---------- 16. Снимок попытки: F5 не теряет 95-минутный экзамен ----------
   Исполняем движок дважды: «до обновления» ученик отвечает на три задания,
   «после обновления» — свежий контекст с тем же ST. resume обязан поднять
   ТОТ ЖЕ лист (сид один — лист один), то же место и те же ответы. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const SPEC = { subtests: [
    { id: "lexgram", ky: "Лексика", ru: "л", en: "l", tr: "l", tasks: 6, min: 70, kind: "mcq" },
    { id: "okuu", ky: "Окуу", ru: "о", en: "o", tr: "o", tasks: 3, min: 25, kind: "read" },
  ] };
  const mkCtx = (SHARED) => {
    const node = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], append(...x) { this.kids.push(...x); } });
    const box = {
      console, setInterval: () => 0, clearInterval: () => {}, Date, Math,
      setTimeout: () => 2, clearTimeout: () => {},   // разбор верного ставит автопереход
      h: (tag, attrs, ...kids) => { const n = node(tag, attrs); n.kids.push(...kids); return n; },
      el: () => node("area", {}), clear: (x) => { x.kids.length = 0; return x; },
      t: (k) => k, harmonyTable: () => node("table", {}), optList: () => node("opts", {}),
      metaOf: (id) => ({ id, num: id, title: "" }), metaTitle: (m) => m.title,
      currentLang: () => "ru", activeModule: "m35", evPush: () => {}, save: () => {}, saveLocal: () => {},
      IS_DEMO: false, fetch: () => Promise.resolve({ ok: false }),
      ST: SHARED.ST, MODULE_META: [{ id: "m24", course: "b1" }, { id: "m35", course: "b1" }],
      // диалог курса: пары «вопрос → ответ другого» — лист Лексики без русского собирается из них
      DIALOGS: { m24: { parts: [{ lines: Array.from({ length: 24 }, (_, i) => {
        const SYL = ["ба", "ке", "ми", "но", "сү", "тө", "жа", "ло", "ры", "гү"];
        const w = (j) => SYL[j % 10] + SYL[Math.floor(j / 10) % 10] + "р";
        return i % 2 ? { id: "ph_x" + i, sp: "Б", ky: "Мен " + w(i + 50) + " барам.", ru: "о" + i }
          : { id: "ph_x" + i, sp: "А", ky: w(i) + " " + w(i + 25) + "?", ru: "в" + i }; }) }] } },
      CONTENT: {
        m24: {
          drill: [{ qKy: "Ал келиптир", opts: ["а", "б", "в", "г"], c: 1, g: "x" }],
          vocab: Array.from({ length: 30 }, (_, i) => ({ id: "m24_" + i, ky: "сөзү" + i, ru: "слово" + i })),
        },
      },
      EXAM_TEXTS: [{ id: "t1", kind: "okuu", title: { ru: "x" },
        lines: [{ src: "m24_1", ky: "Сөзү бир жана эки." }],
        qs: Array.from({ length: 3 }, (_, i) => ({ s: 0, ky: "Суроо " + i + "?", opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: 0 })) }],
    };
    box.EXAM_B1_SPEC = JSON.parse(JSON.stringify(SPEC));
    vm.createContext(box);
    vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") + "; Exam.spec=EXAM_B1_SPEC;", box,
      { contextName: "exam" });
    return box;
  };
  const SHARED = { ST: {} };
  const c1 = mkCtx(SHARED);
  vm.runInContext("Exam.begin();" +
    "Exam.answer(0);Exam.answer(1);Exam.answer(0);" +
    "this.refs1=Exam.st.items.map(x=>x.ref); this.i1=Exam.st.i;", c1);
  assert.ok(SHARED.ST.examRun, "снимок пишется по ходу попытки");
  assert.strictEqual(SHARED.ST.examRun.i, 3, "в снимке — текущее место");
  assert.strictEqual(SHARED.ST.examRun.answers.length, 3, "и все данные ответы");

  const c2 = mkCtx(SHARED);   // «после F5»: движок с нуля, ST тот же
  vm.runInContext("this.ok=Exam.resume();" +
    "this.refs2=Exam.st.items.map(x=>x.ref); this.i2=Exam.st.i; this.n2=Exam.st.answers.length;", c2);
  assert.strictEqual(c2.ok, true, "resume поднимает прерванную попытку");
  assert.strictEqual(JSON.stringify(c2.refs2), JSON.stringify(c1.refs1),
    "после обновления страницы лист ТОТ ЖЕ (сид один — лист один)");
  assert.strictEqual(c2.i2, 3, "место в листе не потеряно");
  assert.strictEqual(c2.n2, 3, "ответы не потеряны");
  // финал закрывает снимок — вторая жизнь попытки исключена
  vm.runInContext("Exam.finish(false);", c2);
  assert.ok(!SHARED.ST.examRun, "после финала снимок стёрт");
  console.log("  снимок попытки: пишется, поднимается тем же листом, стирается финалом");
}

/* ---------- 17. Скринов чужого интерфейса нет ----------
   Решение владельца 30.10.2026: «Обзор» недели не показывает снимков чужих страниц.
   Исполняем renderOverview-код? Нет: достаточно данных и сборки — галерее не из чего
   и нечем рисоваться (поле shots снято у всех недель, код галереи удалён). */
{
  const cb = { console };
  vm.createContext(cb);
  vm.runInContext(blockSrc("DATA") + "; this.C=CONTENT;", cb);
  for (const [id, c] of Object.entries(cb.C))
    for (const k of Object.keys(c || {})) assert.ok(!/^shots/.test(k), id + ": поле " + k + " (скрины чужого интерфейса)");
  const ov = html.match(/function renderOverview\(m\)\{[\s\S]*?\n\}/);
  assert.ok(ov && !/shots/.test(ov[0]), "в «Обзоре» нет кода галереи скринов");
  console.log("  скрины чужого интерфейса: ни данных, ни кода галереи");
}

/* ---------- 18. Адверсарные атаки на задания Окуу/Угуу ----------
   Ревью 22.08 (critical): весь блок атак §11 гонял только examItems, а текстовые
   задания шли без шафла (c:0 всюду) и решались «жми первую кнопку». Теперь те же
   атаки — на examTextItems с РЕАЛЬНЫМИ текстами реестра. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const tsrc = html.match(/\/\* ===EXAM-TEXTS===[\s\S]*?\/\* ===\/EXAM-TEXTS=== \*\//);
  const box = { console };
  vm.createContext(box);
  vm.runInContext(tsrc[0] + eng[0].replace(/\bconst Exam=/, "this.Exam=") +
    "; this.examTextItems=examTextItems; this.T=EXAM_TEXTS;", box);
  const posHist = {}; let checked = 0;
  for (let v = 0; v < 30; v++) {
    for (const kind of ["okuu", "uguu"]) {
      const texts = JSON.parse(JSON.stringify(box.T)).filter((x) => x.kind === kind);
      const items = JSON.parse(JSON.stringify(box.examTextItems(texts, 30, 1000 + v * 137)));
      for (const it of items) {
        checked++;
        posHist[it.c] = (posHist[it.c] || 0) + 1;
        const right = String(it.opts[it.c]);
        // D. целостность после шафла: верный ответ — тот же вариант, что в данных
        const orig = texts.find((t8) => t8.id === it.textId).qs[Number(it.ref.split("_").pop())];
        assert.strictEqual(right, orig.opts[orig.c], it.ref + ": верный ответ съехал при перемешивании");
        assert.strictEqual(new Set(it.opts).size, 4, it.ref + ": варианты уникальны");
        // B. ответ не вычисляется формой (те же пороги, что в §11)
        const lens = it.opts.map((x) => String(x).length);
        const mx = Math.max(...lens), mn = Math.min(...lens);
        if (mx > mn * 2.5) {
          assert.ok(right.length !== mx || lens.filter((l) => l === mx).length > 1,
            it.ref + ": верный — единственный длинный: " + JSON.stringify(it.opts));
          assert.ok(right.length !== mn || lens.filter((l) => l === mn).length > 1,
            it.ref + ": верный — единственный короткий: " + JSON.stringify(it.opts));
        }
      }
    }
  }
  // C. позиция верного ответа равномерна — «первая кнопка» больше не стратегия
  const tot = Object.values(posHist).reduce((a, b) => a + b, 0);
  for (const pos of [0, 1, 2, 3]) {
    const share = (posHist[pos] || 0) / tot;
    assert.ok(share > 0.15 && share < 0.35,
      "текстовые задания: позиция " + pos + " = " + Math.round(share * 100) + "% — решается вслепую");
  }
  console.log("  адверсарно проверено текстовых заданий: " + checked + " в 30 вариантах, позиции равномерны");
}

/* ---------- 19. Жизненный цикл попытки: зомби, stale-отклик, черновик ----------
   Три находки ревью 22.08 одного корня — состояние st жило дольше попытки:
   (1) finish вне вкладки не гасил st → вернувшийся ученик листал закрытую попытку
       и дописывал в неё ответы, в ведомости появлялась вторая строка;
   (2) отклик сервера после истечения времени двигал индекс УЖЕ ДРУГОГО субтеста;
   (3) черновик письма исчезал при любом перерендере.
   Проверяется исполнением: DOM то есть, то нет — как при уходе с вкладки. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const SPEC = { subtests: [
    { id: "lexgram", ky: "Л", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" },
    { id: "jazuu", ky: "Ж", ru: "ж", en: "j", tr: "j", tasks: 2, min: 25, qPick: 2, minSent: 8, maxSent: 12, kind: "write" },
  ] };
  const mk = (SHARED, hasDom) => {
    const nodes = [];
    const node = (tag, attrs) => { const n = { tag, attrs: attrs || {}, kids: [], value: "",
      append(...x) { this.kids.push(...x); }, addEventListener(ev, f) { (this.ev = this.ev || {})[ev] = f; },
      style: {}, };
      nodes.push(n); return n; };
    const box = {
      console, setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 2, clearTimeout: () => {},
      Date, Math, JSON, fgPlay: () => {}, fgStop: () => {}, playAudio: () => ({ addEventListener() {} }),
      h: (tag, attrs, ...kids) => { const n = node(tag, attrs); n.kids.push(...kids); return n; },
      el: () => (hasDom ? node("area", {}) : null), clear: (x) => { x.kids.length = 0; return x; },
      t: (k) => k, tf2: undefined, harmonyTable: () => node("table", {}), optList: () => node("opts", {}),
      metaOf: (id) => ({ id, num: id, title: "" }), metaTitle: () => "", currentLang: () => "ru",
      activeModule: "m35", evPush: () => {}, save: () => {}, saveLocal: () => {}, IS_DEMO: true,
      fetch: () => Promise.resolve({ ok: false }), ST: SHARED.ST, nodes,
      MODULE_META: [{ id: "m24", course: "b1", title: "Тема" }, { id: "m35", course: "b1", exam: true }],
      CONTENT: { m24: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m24 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })),
        vocab: Array.from({ length: 20 }, (_, i) => ({ id: "m24_" + i, ky: i < 4 ? "Сиз " + i + " барасызбы?" : "с" + i, ru: "р" + i })) } },
      EXAM_TEXTS: [], EXAM_B1_SPEC: JSON.parse(JSON.stringify(SPEC)),
    };
    vm.createContext(box);
    vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") + "; Exam.spec=EXAM_B1_SPEC;", box);
    return box;
  };
  // (1) попытка-зомби: время вышло, когда вкладка закрыта
  const SH = { ST: {} };
  const c = mk(SH, false);            // DOM нет — как на другой вкладке
  vm.runInContext("Exam.begin(); Exam.answer(0); Exam.finish(true);" +
    "this.stAfter=Exam.st; this.runAfter=ST.examRun;", c);
  assert.strictEqual(c.stAfter, null, "finish вне вкладки гасит состояние: попытки-зомби нет");
  assert.ok(!c.runAfter, "снимок закрытой попытки стёрт — F5 её не воскресит");
  const att = JSON.parse(JSON.stringify(SH.ST.exam.attempts));
  assert.strictEqual(att.length, 1, "в ведомости одна строка на одну попытку, а не две");
  // повторный finish ничего не дописывает
  vm.runInContext("Exam.finish(true);", c);
  assert.strictEqual(JSON.parse(JSON.stringify(SH.ST.exam.attempts)).length, 1, "повторный финал не дублирует запись");
  // ответ и переход после закрытия попытки — тихий выход, а не TypeError
  vm.runInContext("this.errA=null;this.errS=null;" +
    "try{Exam.answer(0);}catch(e){this.errA=e.constructor.name;}" +
    "try{Exam.step();}catch(e){this.errS=e.constructor.name;}", c);
  assert.strictEqual(c.errA, null, "ответ в закрытую попытку не бросает исключение");
  assert.strictEqual(c.errS, null, "переход в закрытой попытке не бросает исключение");

  // (2) stale-отклик: токен попытки меняется на смене субтеста
  const SH2 = { ST: {} };
  const c2 = mk(SH2, true);
  vm.runInContext("Exam.begin(); this.tokA=Exam.tokenOf(); Exam.nextSub(true); this.tokB=Exam.tokenOf();" +
    "this.freshOld=Exam.fresh(this.tokA); this.freshNew=Exam.fresh(this.tokB);", c2);
  assert.notStrictEqual(c2.tokA, c2.tokB, "токен меняется при переходе к следующему субтесту");
  assert.strictEqual(c2.freshOld, false, "отклик прежнего субтеста больше не «свежий» — индекс не двинется");
  assert.strictEqual(c2.freshNew, true, "отклик текущего субтеста проходит");

  // (3) черновик письма живёт в состоянии и едет в снимок
  vm.runInContext("this.draftBefore=JSON.stringify(Exam.st.draft||{});" +
    "Exam.st.draft={jazuu2:'Мен жазып жатам.'}; Exam.snap();", c2);
  assert.ok(JSON.stringify(SH2.ST.examRun.draft).includes("жазып"), "черновик письма попадает в снимок");
  const c3 = mk(SH2, true);
  vm.runInContext("this.ok=Exam.resume(); this.draft=Exam.st&&Exam.st.draft&&Exam.st.draft.jazuu2;", c3);
  assert.strictEqual(c3.draft, "Мен жазып жатам.", "после F5 черновик восстановлен");

  // (4) протухший снимок не поднимается и не дарит время следующему субтесту
  const SH3 = { ST: { examRun: { queue: [0], qi: 0, i: 1, seed: 7, answers: [],
    deadline: Date.now() - 3 * 3600 * 1000, startedAt: Date.now() - 4 * 3600 * 1000 } } };
  const c4 = mk(SH3, true);
  vm.runInContext("this.ok=Exam.resume();", c4);
  assert.strictEqual(c4.ok, false, "протухшая попытка не возобновляется");
  assert.ok(!SH3.ST.examRun, "и её снимок убран, чтобы не всплыл снова");
  console.log("  жизненный цикл попытки: зомби закрыт, stale-отклик отсечён, черновик переживает F5");
}

/* ---------- 20. ПРАВИЛО: своя итоговая проверка курса ----------
   Решение владельца 30.10.2026 (вместо прежнего «идентичен официальному»):
   механика остаётся (лимит прослушиваний, все пять частей на реальных данных),
   а происхождение заданий — только курс. */
{
  const lim = html.match(/const EXAM_LISTEN_MAX\s*=\s*(\d+)/);
  assert.ok(lim && Number(lim[1]) >= 1 && Number(lim[1]) <= 3,
    "прослушиваний фиксированное число: " + (lim && lim[1]));
  const { CONTENT, DIALOGS } = require("../deploy/gen-audio").loadData();
  const b5 = { console, MODULE_META: META, CONTENT: JSON.parse(JSON.stringify(CONTENT)), DIALOGS };
  vm.createContext(b5);
  vm.runInContext(src[0] + blockSrc("EXAM-TEXTS") + blockSrc("EXAM").replace(/\bconst Exam=/, "this.Exam=") +
    "; Exam.spec=EXAM_B1; Exam.course='b1'; this.q=EXAM_B1.subtests.map(x=>x.id).filter(id=>Exam.ready(id));", b5);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b5.q)), ["lexgram", "uguu", "okuu", "jazuu", "suiloo"],
    "на реальных данных курса готовы все пять частей B1");
  console.log("  своя проверка: лимит прослушиваний " + lim[1] + ", пять частей B1 на материале курса");
}

/* ---------- 21. Экзаменационная неделя устроена как подготовка к экзамену ----------
   Правило владельца 22.08.2026: у M35 своё меню — «Как готовиться» (обзор недели
   вместе с устройством экзамена и методикой), «Тренажёр формата» по субтестам
   реестра и «Пробный экзамен». Учебные вкладки скрыты, материал модуля остаётся.
   Проверяется ИСПОЛНЕНИЕМ studyTabsFor и движка, а не грепом по исходнику. */
{
  // берётся вместе с картой иконок над ней и блоком тропы: предикат «это
  // экзаменационная неделя» живёт там, и подменять его стабом — значит проверять
  // не тот код, который получает ученик
  const fn = html.match(/const EXAM_TAB_ICON=[\s\S]*?\n(?=const TEACHER_TABS_DEF)/);
  assert.ok(fn && /function studyTabsFor/.test(fn[0]), "studyTabsFor извлечён из сборки");
  const trail = html.match(/\/\* ===TRAIL=== \*\/([\s\S]*?)\/\* ===\/TRAIL=== \*\//);
  assert.ok(trail && /function isExamWeek/.test(trail[1]), "предикат экзаменационной недели в срезе тропы");
  const SUBS = [{ id: "lexgram", kind: "mcq", ru: "Лексика. Грамматика" },
                { id: "uguu", kind: "listen", ru: "Угуу" }, { id: "okuu", kind: "read", ru: "Окуу" },
                { id: "jazuu", kind: "write", ru: "Жазуу" }, { id: "suiloo", kind: "speak", ru: "Сүйлөө" }];
  const box = { console, t: (k) => k, bi: () => "", bi3: (o) => o.ru || o.ky,
    CONTENT: { m35: {}, m24: {} }, DIALOGS: { m24: {} }, LESSONS: { m24: {} }, STT_MODS: ["m24"],
    EXAM_MODS: ["m35"], EXAM_B1: { subtests: SUBS } };
  box.EXAM_SPECS = { b1: box.EXAM_B1 };   // меню берёт спеку курса из реестра
  box.metaOf = (id) => ({ id, course: "b1" });
  box.MODULE_META = [{ id: "m24", course: "b1" }, { id: "m35", course: "b1" }];
  box.ME = null; box.ST = { courses: ["b1"] }; box.CONTENT_READY = ["m24", "m35"];
  vm.createContext(box);
  vm.runInContext(trail[1] + fn[0] + "; this.tabsFor=studyTabsFor;", box);
  const keys = (id) => JSON.parse(JSON.stringify(box.tabsFor(id))).map((x) => x[0]);

  assert.deepStrictEqual(keys("m35"),
    ["overview", "grp", "tr_lexgram", "tr_uguu", "tr_okuu", "tr_jazuu", "tr_suiloo", "exam"],
    "меню экзаменационной недели: как готовиться → тренажёр формата по субтестам → пробный экзамен");
  // учебные разделы скрыты — но материал модуля никуда не делся (данные m35 на месте)
  for (const gone of ["cards", "dialogs", "harmony", "test", "alphabet", "lessons", "listen"])
    assert.ok(!keys("m35").includes(gone), "в экзаменационной неделе нет вкладки «" + gone + "»");
  assert.ok(html.includes("VOCAB_M35") && html.includes("DRILL_M35"),
    "материал модуля остаётся в сборке, скрыто только меню");
  // обычный модуль своё меню не потерял
  const m24 = keys("m24");
  for (const need of ["overview", "cards", "harmony", "test", "lessons", "listen", "dialogs"])
    assert.ok(m24.includes(need), "у учебного модуля вкладка «" + need + "» на месте: " + m24.join(","));
  assert.ok(!m24.includes("grp") && !m24.some((k) => k.slice(0, 3) === "tr_"),
    "тренажёр формата не протёк в учебный модуль");

  /* Новый субтест в реестре = новый пункт тренажёра, ноль правок логики. */
  box.EXAM_B1.subtests = SUBS.concat([{ id: "kepteme", kind: "write", ru: "Кептеме" }]);
  assert.ok(keys("m35").includes("tr_kepteme"), "субтест из реестра сам появляется в тренажёре");
  box.EXAM_B1.subtests = SUBS;

  /* «grp» — подпись группы, а не маршрут: иначе #m35/grp открывал бы пустоту. */
  const av = html.match(/function availableTabs\(\)\{[\s\S]*?\n\}/);
  assert.ok(av && /!=="grp"/.test(av[0]), "подпись группы отфильтрована из допустимых вкладок");

  /* Меню и план недели — одно целое (правило владельца 21.08): каждый раздел
     назван в плане на всех трёх языках. Имена берутся из словарей и реестра. */
  const dataBox = { console };
  vm.createContext(dataBox);
  vm.runInContext(html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//)[0] +
    html.match(/(\/\* ===I18N=== \*\/[\s\S]*?\/\* ===\/I18N=== \*\/)/)[1].replace("const I18N=", "var I18N=") +
    "; this.C=CONTENT; this.I18N=I18N; this.SUB=EXAM_B1.subtests;", dataBox);
  const FIELD = { ru: "plan", en: "planEn", tr: "planTr" };
  const SUBNAME = { ru: "ru", en: "en", tr: "tr" };
  for (const lang of ["ru", "en", "tr"]) {
    const plan = (dataBox.C.m35 || {})[FIELD[lang]] || [];
    assert.ok(plan.length, "план недели m35 на " + lang + " не пуст");
    for (const key of ["tab_howto", "tab_grp_format", "tab_exam"]) {
      const name = dataBox.I18N[lang][key];
      assert.ok(name, "ключ " + key + " есть в словаре " + lang);
      assert.ok(plan.some((s2) => s2.includes(name)),
        "m35 (" + lang + "): план называет раздел «" + name + "»");
    }
    // и каждый субтест тренажёра назван в плане своим именем
    for (const sp of dataBox.SUB) {
      const nm = sp[SUBNAME[lang]] || sp.ky;
      assert.ok(plan.some((s2) => s2.includes(nm)),
        "m35 (" + lang + "): план называет тренировку «" + nm + "»");
    }
    // методика подготовки — в данных, а не в коде
    const howto = (dataBox.C.m35 || {})[lang === "ru" ? "howto" : lang === "en" ? "howtoEn" : "howtoTr"] || [];
    assert.ok(howto.length >= 4, "m35 (" + lang + "): методика подготовки из " + howto.length + " шагов");
    for (const step of howto) assert.ok(String(step).trim().length > 40, "шаг методики содержателен: " + step);
  }
  /* Полоса вычитки говорит про зачётный мини-тест — в экзаменационной неделе
     его нет, и строка вводила бы в заблуждение (замечание владельца 22.08.2026).
     Исполняем updateBanner на модуле экзамена и на учебном. */
  {
    const fnB = html.match(/function updateBanner\(\)\{[\s\S]*?\n\}/);
    assert.ok(fnB, "updateBanner извлечён");
    const run = (mod) => {
      const node = { className: "", style: {}, kids: [], append(...x) { this.kids.push(...x); } };
      const bx = { console, el: () => node, clear: (x) => { x.kids.length = 0; return x; },
        icon: () => ({ tag: "svg" }), tf: (k) => k, t: (k) => k, IS_DEMO: false,
        EXAM_MODS: ["m35"], activeModule: mod, VOCAB: [{ id: "a" }, { id: "b" }],
        quizGateBase: (v) => v, reviewedCount: () => 1, REVIEW: {}, DEMO_TOTAL: 0,
        demoWaBtn: () => ({}), metaOf: (id) => ({ id, course: "b1" }),
        MODULE_META: [], ME: null, ST: {}, CONTENT_READY: [] };
      vm.createContext(bx);
      // тот же настоящий предикат, что и в меню: стаб проверял бы не тот код
      vm.runInContext(trail[1] + fnB[0] + "; updateBanner();", bx);
      return node;
    };
    const exam = run("m35"), study = run("m24");
    assert.strictEqual(exam.style.display, "none", "в экзаменационной неделе полосы вычитки нет");
    assert.strictEqual(exam.kids.length, 0, "и в ней ничего не написано");
    assert.notStrictEqual(study.style.display, "none", "у учебного модуля полоса осталась");
    assert.ok(study.kids.length > 0, "и она по-прежнему говорит о вычитке");
  }
  console.log("  экзаменационная неделя: меню из реестра (" + keys("m35").length +
    " пунктов), учебные вкладки скрыты, план и методика названы на трёх языках, " +
    "полоса вычитки убрана (мини-теста нет)");
}

/* ---------- 22. Тренажёр формата: тот же движок, но это репетиция ----------
   Тренировка обязана давать ИМЕННО экзаменационный интерфейс (тот же лист, тот
   же таймер) и при этом не притворяться попыткой: одиночный субтест в истории
   ST.exam читался бы как сданный экзамен целиком. Проверяется исполнением. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//);
  const SPEC = { subtests: [
    { id: "lexgram", ky: "Л", ru: "л", en: "l", tr: "l", tasks: 4, min: 70, kind: "mcq" },
    { id: "okuu", ky: "О", ru: "о", en: "o", tr: "o", tasks: 3, min: 25, kind: "read" },
    { id: "jazuu", ky: "Ж", ru: "ж", en: "j", tr: "j", tasks: 2, min: 25, qPick: 3, minSent: 8, maxSent: 12, kind: "write" },
  ] };
  const mk = (SHARED) => {
    const node = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], value: "", style: {},
      append(...x) { this.kids.push(...x); }, addEventListener(ev, f) { (this.ev = this.ev || {})[ev] = f; } });
    const box = {
      console, setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 2, clearTimeout: () => {},
      Date, Math, JSON, fgPlay: () => {}, fgStop: () => {},
      h: (tag, attrs, ...kids) => { const n = node(tag, attrs); n.kids.push(...kids); return n; },
      el: () => node("area", {}), clear: (x) => { x.kids.length = 0; return x; },
      t: (k) => k, harmonyTable: () => node("table", {}), optList: () => node("opts", {}),
      metaOf: (id) => ({ id, num: id, title: "" }), metaTitle: () => "", currentLang: () => "ru",
      activeModule: "m35", evPush: (n2, p2) => { (SHARED.ev = SHARED.ev || []).push([n2, p2]); },
      save: () => {}, saveLocal: () => {}, IS_DEMO: true, fetch: () => Promise.resolve({ ok: false }),
      ST: SHARED.ST, MODULE_META: [{ id: "m35", course: "b1" }],
      CONTENT: { m35: { drill: Array.from({ length: 20 }, (_, i) => ({ qKy: "m35 суроо " + i, opts: ["а" + i, "б" + i, "в" + i, "г" + i], c: i % 4 })), vocab: Array.from({ length: 20 }, (_, i) => ({ id: "m35_" + i, ky: "с" + i, ru: "р" + i })) } },
      EXAM_TEXTS: [{ id: "t1", kind: "okuu", title: { ru: "x" }, lines: [{ src: "m35_1", ky: "Сүйлөм бир." }],
        qs: [{ s: 0, ky: "С?", opts: ["а", "б", "в", "г"], c: 0 }, { s: 0, ky: "С2?", opts: ["д", "е", "ж", "з"], c: 0 }] }],
      EXAM_B1_SPEC: JSON.parse(JSON.stringify(SPEC)),
    };
    vm.createContext(box);
    vm.runInContext(eng[0].replace(/\bconst Exam=/, "this.Exam=") + "; Exam.spec=EXAM_B1_SPEC;", box);
    return box;
  };

  // (1) тренировка идёт по ОДНОМУ субтесту, лист собран тем же itemsFor
  const SH = { ST: {} };
  const c = mk(SH);
  vm.runInContext("this.ok=Exam.train('okuu'); this.q=Exam.st.queue.length; this.sub=Exam.subSpec().id;" +
    "this.n=Exam.st.items.length; this.tr=!!Exam.st.train; this.dl=Exam.st.deadline>Date.now();", c);
  assert.strictEqual(c.ok, true, "тренировка запускается");
  assert.strictEqual(c.q, 1, "в очереди ровно один субтест");
  assert.strictEqual(c.sub, "okuu", "и это выбранный субтест");
  assert.ok(c.n > 0, "лист заданий собран: " + c.n);
  assert.strictEqual(c.tr, true, "попытка помечена тренировочной");
  assert.strictEqual(c.dl, true, "таймер субтеста идёт, как на экзамене");

  // (2) снимок несёт признак тренировки — F5 не превращает её в экзамен
  assert.strictEqual(SH.ST.examRun.train, true, "снимок помнит, что это тренировка");
  const c2 = mk({ ST: SH.ST });
  vm.runInContext("this.up=Exam.resume(); this.tr=!!(Exam.st&&Exam.st.train); this.q=Exam.st.queue.length;", c2);
  assert.strictEqual(c2.up, true, "тренировка поднимается из снимка");
  assert.strictEqual(c2.tr, true, "и остаётся тренировкой");
  assert.strictEqual(c2.q, 1, "очередь по-прежнему из одного субтеста");

  // (3) финал тренировки НЕ пишет историю попыток, но виден в журнале своим событием
  vm.runInContext("Exam.answer(0); Exam.finish();", c);
  assert.ok(!SH.ST.exam, "история попыток экзамена тренировкой не заполняется");
  assert.ok(!SH.ST.examRun, "снимок закрытой тренировки убран");
  const names = (SH.ev || []).map((x) => x[0]);
  assert.ok(names.includes("exam.train"), "старт тренировки уехал в журнал: " + names.join(","));
  assert.ok(names.includes("exam.train_done"), "и её завершение — отдельным событием, не exam.finish");
  assert.ok(!names.includes("exam.finish"), "тренировка не притворяется сданным экзаменом");
  const done = (SH.ev || []).find((x) => x[0] === "exam.train_done")[1];
  assert.strictEqual(done.sub, "okuu", "в событии назван субтест — учитель видит, что тренировали");
  /* Итог тренировки и попытки: пометка о происхождении заданий есть, правила
     пересдачи чужого экзамена нет. Смотрим на САМ отрисованный экран. */
  const screenText = (SHARED) => {
    const walk = (n2) => !n2 ? "" : (typeof n2 === "string" ? n2
      : (n2.kids || []).map(walk).join(" ") + " " + JSON.stringify(n2.attrs || {}));
    return walk(SHARED.area);
  };
  const withArea = (SHARED) => {
    const ctx = mk(SHARED);
    SHARED.area = { tag: "area", kids: [], attrs: {}, append(...x) { this.kids.push(...x); } };
    ctx.el = () => SHARED.area;
    ctx.clear = (x) => { x.kids.length = 0; return x; };
    return ctx;
  };
  const SHt = { ST: {} }, ct = withArea(SHt);
  vm.runInContext("Exam.train('okuu'); Exam.answer(0); Exam.finish();", ct);
  assert.ok(!screenText(SHt).includes("exam_retake_hdr"), "итог тренировки без правила пересдачи");
  assert.ok(screenText(SHt).includes("exam_disclaimer"), "итог тренировки — с пометкой о заданиях");
  assert.ok(screenText(SHt).includes("exam_tr_again"), "и предлагает повторить тренировку");
  const SHe = { ST: {} }, ce = withArea(SHe);
  vm.runInContext("Exam.begin(); Exam.finish();", ce);
  assert.ok(!screenText(SHe).includes("exam_retake_hdr"), "итог попытки без правила пересдачи");
  assert.ok(screenText(SHe).includes("exam_disclaimer"), "итог попытки — с пометкой о заданиях");

  // (4) настоящий экзамен по-прежнему пишет историю
  const SH2 = { ST: {} };
  const c3 = mk(SH2);
  vm.runInContext("Exam.begin(); Exam.finish();", c3);
  assert.ok(SH2.ST.exam && SH2.ST.exam.last, "экзамен историю пишет");
  assert.ok((SH2.ev || []).map((x) => x[0]).includes("exam.finish"), "и закрывается своим событием");
  /* Снимок принадлежит своему разделу. Живой браузер 22.08.2026: незакрытая
     тренировка «Окуу» открывалась на вкладке «Угуу» — ученик попадал не туда,
     куда нажал. Проверяем оба направления: чужая тренировка и попытка экзамена. */
  {
    const SHo = { ST: {} }, co = mk(SHo);
    vm.runInContext("Exam.train('okuu'); Exam.answer(0);" +
      "this.own=examTrainSubOf(ST.examRun)==='okuu'; this.other=examTrainSubOf(ST.examRun)==='jazuu';" +
      "this.runOwn=examTrainSubOf(Exam.st)==='okuu'; this.runOther=examTrainSubOf(Exam.st)==='jazuu';", co);
    assert.strictEqual(co.own, true, "снимок тренировки признан своим на её разделе");
    assert.strictEqual(co.other, false, "и чужим — на разделе другого субтеста");
    assert.strictEqual(co.runOwn, true, "идущая тренировка продолжается на своём разделе");
    assert.strictEqual(co.runOther, false, "и не открывается на чужом");
    // снимок настоящего экзамена тренировкой не считается ни на одном разделе
    const SHx = { ST: {} }, cx = mk(SHx);
    vm.runInContext("Exam.begin(); Exam.answer(0);" +
      "this.a=examTrainSubOf(ST.examRun)==='lexgram'; this.b=examTrainSubOf(ST.examRun)==='okuu';", cx);
    assert.strictEqual(cx.a, false, "снимок экзамена не подхватывается тренажёром");
    assert.strictEqual(cx.b, false, "ни на одном из его разделов");
  }
  /* ПЕРЕБОРОМ по всем субтестам реестра, на настоящей спецификации и текстах:
     интро тренировки открывается и называет объём. Первая версия падала на
     «Лексике. Грамматике» — банк лексики лежал в состоянии попытки, а на интро
     попытки ещё нет; «типовой» субтест этого не показывал (поймано 22.08.2026). */
  {
    const t2 = html.match(/\/\* ===EXAM-TEXTS===[\s\S]*?\/\* ===\/EXAM-TEXTS=== \*\//)[0];
    const real = mk({ ST: {} });
    vm.runInContext(src[0] + t2 + "; Exam.spec=EXAM_B1; this.SUBS=EXAM_B1.subtests.map(x=>x.id);", real);
    for (const id of JSON.parse(JSON.stringify(real.SUBS))) {
      vm.runInContext("this.err=null; try{ Exam.st=null; Exam.trainIntro(" + JSON.stringify(id) + "); }" +
        "catch(e){ this.err=String(e && e.message || e); }", real);
      assert.strictEqual(real.err, null, "интро тренировки «" + id + "» открывается: " + real.err);
      vm.runInContext("this.n=Exam.factCount(Exam.spec.subtests.find(x=>x.id===" + JSON.stringify(id) + "));", real);
      assert.ok(real.n > 0, "интро «" + id + "» называет объём заданий: " + real.n);
    }
    // банк строится один раз на движок, а не на каждую попытку
    vm.runInContext("this.b1=Exam.bank(); this.same=Exam.bank()===this.b1;", real);
    assert.strictEqual(real.same, true, "банк лексики кэшируется движком");
  }
  console.log("  тренажёр формата: один субтест тем же движком, снимок переживает F5 " +
    "и принадлежит своему разделу, история попыток не засоряется, журнал различает тренировку и экзамен");
}

/* ---------- 23. Отчётность учителя: каждое событие экзамена читается ----------
   Правило владельца: раздел не готов без трекинга ученику И учителю. Событие,
   которое шлёт движок, но которое лента не умеет показать, — это пустая строка
   со временем: «занимался, а чем — неизвестно». Список событий берётся РАЗБОРОМ
   движка, поэтому новое evPush обязано получить свою строку в ленте. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//)[0];
  const sent = [...eng.matchAll(/evPush\((?:"([\w.]+)"|[^,]*\?"([\w.]+)":"([\w.]+)")/g)]
    .flatMap((m) => [m[1], m[2], m[3]]).filter(Boolean);
  const kinds = [...new Set(sent)];
  assert.ok(kinds.includes("exam.train") && kinds.includes("exam.train_done") && kinds.includes("exam.finish"),
    "разбор нашёл события движка: " + kinds.join(","));
  const feed = html.match(/function renderFeedBody\([\s\S]*?\n\}/)[0];
  // «шумные» события каждого ответа/шага в ленту строкой не выносятся — они уже
  // складываются в счётчик сессии; проверяем итоговые, ради которых учитель и смотрит
  const MUST = ["exam.finish", "exam.train_done", "exam.submit", "exam.grade"];
  for (const k of MUST)
    assert.ok(feed.includes('ev.type==="' + k + '"'), "лента показывает событие " + k);
  for (const k of kinds)
    assert.ok(MUST.includes(k) || ["exam.start", "exam.sub", "exam.answer", "exam.train"].includes(k),
      "новое событие " + k + " — решите, как учитель его видит (строка в ленте или счётчик сессии)");
  // фильтр «Мини-тест и экзамен» ловит и тренировки
  assert.ok(/feedFilter==="test"[^\n]*exam\./.test(html), "фильтр ленты ловит все exam.*");
  // имя субтеста в ленте берётся из реестра, а не из литерала — исполнением, не грепом
  {
    const fnS = html.match(/function examSpecs\(\)\{[^\n]*\n/)[0] + html.match(/function examSubName\(id,course\)\{[\s\S]*?\n\}/)[0];
    const bx = { console, bi3: (o) => o.ru || o.ky,
      EXAM_SPECS: { a1: { subtests: [{ id: "uguu", ru: "Слух A1" }] }, b1: { subtests: [{ id: "uguu", ru: "Слух B1" }, { id: "okuu", ru: "Чтение" }] } } };
    vm.createContext(bx);
    vm.runInContext(fnS + "; this.a=examSubName('uguu','b1'); this.b=examSubName('okuu'); this.c=examSubName('nope');", bx);
    assert.strictEqual(bx.a, "Слух B1", "имя субтеста — из спеки названного курса");
    assert.strictEqual(bx.b, "Чтение", "без курса — из любой спеки, где субтест описан");
    assert.strictEqual(bx.c, "nope", "неизвестный id возвращается как есть");
  }
  for (const key of ["fd_exam", "fd_train", "fd_work", "fd_graded"])
    assert.strictEqual((html.match(new RegExp(key + ':"', "g")) || []).length, 3,
      "подпись " + key + " на трёх языках");
  /* Кнопки действий Жазуу/Сүйлөө — flex-рядом (.btnrow), а не ручными отступами:
     margin-left у кнопки, перенесённой на вторую строку, прижимал её к соседям —
     «Отправить преподавателю» наезжала на «Ещё раз» (скрин владельца 23.08.2026,
     мобильный экран). Геометрию (перенос без наезда) проверил живой браузер при
     ширине 460px; здесь стережётся сам механизм — это дополнение к живой проверке,
     а не замена (геометрия в vm не считается). */
  {
    const eng2 = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//)[0];
    assert.ok(!/margin-left/.test(eng2), "в движке экзамена нет ручных горизонтальных отступов кнопок");
    assert.strictEqual((eng2.match(/class:"btnrow"/g) || []).length, 2,
      "оба ряда действий (Жазуу и Сүйлөө) собраны классом btnrow");
    assert.ok(/\.btnrow\{[^}]*flex-wrap:wrap/.test(html), "btnrow переносит кнопки flex-переносом");
  }
  console.log("  отчётность учителя: " + MUST.length + " событий экзамена и тренажёра с читаемой строкой, " +
    "имена субтестов из реестра, подписи на трёх языках; ряды кнопок — flex");
}

/* ---------- 24. Разбор — на месте, без смены экрана ----------
   Замечание владельца 23.08.2026: вердикт на следующем экране стирал контекст —
   ошибку разбирали по памяти. Проверяется ИСПОЛНЕНИЕМ с НАСТОЯЩИМИ optList и
   revealOpts (срез render/002-common), а не стабами: клик по варианту красит
   кнопки на том же экране, разбор выезжает ниже, вопрос никуда не девается. */
{
  const eng = html.match(/\/\* ===EXAM===[\s\S]*?\/\* ===\/EXAM=== \*\//)[0];
  const common = html.match(/function optList\(labels,onPick\)\{[\s\S]*?\n\}/)[0] +
    html.match(/function revealOpts\(box,correctIdx,pickedIdx\)\{[\s\S]*?\n\}/)[0];
  const SPEC = { subtests: [
    { id: "okuu", ky: "О", ru: "о", en: "o", tr: "o", tasks: 3, min: 25, kind: "read" },
  ] };
  const node = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], style: {}, disabled: false,
    cls: [], classList: { add(c) { this._n.cls.push(c); }, _n: null },
    append(...x) { this.kids.push(...x); }, addEventListener(ev, f) { (this.ev = this.ev || {})[ev] = f; },
    querySelectorAll(sel) { return this.kids.filter((k) => k && k.tag === sel); } });
  const mkN = (tag, attrs) => { const n = node(tag, attrs); n.classList._n = n; return n; };
  const timers = [];
  const area = mkN("area", {});
  const box = {
    console, setInterval: () => 1, clearInterval() {}, clearTimeout() {},
    setTimeout: (f) => { timers.push(f); return timers.length; },
    Date, Math, JSON, fgPlay() {}, fgStop() {},
    h: (tag, attrs, ...kids) => { const n = mkN(tag, attrs); n.kids.push(...kids); return n; },
    el: () => area, clear: (x) => { x.kids.length = 0; return x; },
    t: (k) => k, harmonyTable: () => mkN("table", {}),
    metaOf: (id) => ({ id, num: id, title: "" }), metaTitle: () => "", currentLang: () => "ru",
    activeModule: "m35", evPush() {}, save() {}, saveLocal() {}, IS_DEMO: true,
    fetch: () => Promise.resolve({ ok: false }), ST: {},
    MODULE_META: [{ id: "m35", course: "b1" }], CONTENT: { m35: { drill: [], vocab: [] } },
    EXAM_TEXTS: [{ id: "t1", kind: "okuu", title: { ru: "Текст" },
      lines: [{ src: "m35_1", ky: "Сүйлөм бир." }],
      qs: [{ s: 0, ky: "Суроо?", opts: ["а", "б", "в", "г"], c: 0 },
           { s: 0, ky: "Экинчи?", opts: ["д", "е", "ж", "з"], c: 0 },
           { s: 0, ky: "Үчүнчү?", opts: ["и", "к", "л", "м"], c: 0 }] }],
    EXAM_B1_SPEC: JSON.parse(JSON.stringify(SPEC)),
  };
  vm.createContext(box);
  vm.runInContext(common + eng.replace(/\bconst Exam=/, "this.Exam=") + "; Exam.spec=EXAM_B1_SPEC; Exam.begin();", box);

  const flat = (n, acc) => { for (const k of (n.kids || [])) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
  const optsBox = () => flat(area, []).find((n) => (n.attrs.class || "") === "opts");
  const texts = () => JSON.stringify(flat(area, []).map((n) => n.kids.filter((x) => typeof x === "string")));

  // ошибка: кликаем неверный вариант (данные шафлятся — ищем индекс не-верного)
  const ob = optsBox();
  assert.ok(ob && ob.kids.length === 4, "вопрос отрисован с четырьмя вариантами");
  const it0 = vm.runInContext("Exam.st.items[0]", box);
  const wrongIdx = it0.c === 0 ? 1 : 0;
  const beforeKids = area.kids.length;
  ob.kids[wrongIdx].ev.click();
  assert.strictEqual(area.kids.length, beforeKids, "экран НЕ перерисован: вопрос и текст остались на месте");
  assert.ok(ob.kids.every((b) => b.disabled), "варианты заперты после ответа");
  assert.ok(ob.kids[it0.c].cls.includes("correct"), "верный вариант подсвечен зелёным");
  assert.ok(ob.kids[wrongIdx].cls.includes("wrong"), "выбранный ошибочный — красным");
  assert.ok(texts().includes("exam_no"), "вердикт показан на этом же экране");
  assert.ok(texts().includes("Сүйлөм бир."), "разбор указывает предложение-обоснование");
  const nextBtn = flat(area, []).find((n) => n.tag === "button" && n.kids.includes("exam_next"));
  assert.ok(nextBtn, "после ошибки — кнопка «Дальше», НЕ таймер");
  assert.strictEqual(timers.length, 0, "никакого автоперехода после ошибки — темп задаёт ученик");

  // «Дальше» листает на следующий вопрос (кнопка объявляет onclick атрибутом)
  nextBtn.attrs.onclick();
  const ob2 = optsBox();
  assert.ok(ob2 && ob2 !== ob, "следующий вопрос отрисован");
  assert.ok(ob2.kids.every((b) => !b.disabled), "его варианты активны");

  // верный ответ: подсветка + автопереход 700мс, кнопки «Дальше» нет
  const it1 = vm.runInContext("Exam.st.items[1]", box);
  ob2.kids[it1.c].ev.click();
  assert.ok(ob2.kids[it1.c].cls.includes("correct"), "верный подсвечен");
  assert.ok(texts().includes("exam_ok"), "короткий вердикт «верно» на месте");
  assert.ok(!flat(area, []).some((n) => n.tag === "button" && n.kids.includes("exam_next")),
    "после верного кнопки «Дальше» нет — листается само");
  assert.strictEqual(timers.length, 1, "автопереход поставлен");
  timers[0]();   // 700мс прошли
  const i2 = vm.runInContext("Exam.st.i", box);
  assert.strictEqual(i2, 2, "автопереход двинул попытку дальше");
  console.log("  разбор на месте: варианты подсвечены и заперты, экран не перерисован, " +
    "ошибка ждёт ученика, верный листается сам");
}
