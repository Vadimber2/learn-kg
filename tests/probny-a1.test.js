"use strict";
/* Пробный тест learn.kg A1 (/probny-test-a1) — гейт честности и поведения.

   Решение владельца 30.10.2026: название организатора государственного тестирования,
   его формат, числа, правила пересдачи, цитаты и скрины интерфейса со страниц убраны;
   рядом с заданиями — видимая пометка «задания составлены learn.kg… не связаны
   с заданиями официального тестирования», формат и запись — только отсылкой на
   официальный сайт. Тест проверяет ОТДАННЫЕ сервером страницы (не греп исходника):

   1. данные: блоков exam/retake/shots/jazuu нет, их подписей в ui нет;
   2. задания — фразы курса A1 (m1–m10) с пропуском: предложение с верным вариантом
      равно фразе курса ДОСЛОВНО, все варианты — слова курса, ровно один верный;
   3. отданная страница каждого языка: пометка о несвязанности и ссылка на
      официальный сайт под заданиями, названия нет нигде (кроме адреса в ссылке),
      нет цитат, таблицы субтестов, пересдачи, скринов; LD чистый;
   4. перебор ВСЕХ страниц-тестов (/test и три пробных) — пометка есть на каждой;
   5. клиент: вердикт для каждого балла, равномерный шафл, таймер. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "app", "probny-a1", "probny-a1.json"), "utf8"));
const SITE_UI = JSON.parse(fs.readFileSync(path.join(ROOT, "app", "site-ui.json"), "utf8"));
const LANGS = ["ru", "en", "tr"];
// название в любом написании; адрес официального сайта вырезается ДО проверки
const NAME_RE = /кыргыз\s*тест|k[ıi]rg[ıi]z\s*test|kyrgyz\s+test\b/i;
const OFFICIAL_A = '<a href="https://kyrgyztest.gov.kg" target="_blank" rel="noopener noreferrer">kyrgyztest.gov.kg</a>';
const withoutOfficialLink = (html) => html.split(OFFICIAL_A).join("");
// утверждения «наше = официальное/как на экзамене» — запрещены в любом языке
const CLAIM_RE = /как на (настоящем )?экзамене|настоящ\S* экзамен|реальн\S* (тест|экзамен)|идентичн|формате? экзамена|official format|real exam|real test|like in the exam|identical|sınavdaki gibi|gerçek sınav|resmî .{0,20}biçimin/i;
// числа и правила формата тестирования (их не публикуем)
const FORMAT_RE = /\b156\b|\b90 (заданий|задания|tasks|görev)|2 (часа|hours|saat) 50|50[-–]59|балл болгон|тапшырма/i;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 1. Данные: формат и пруфы организатора удалены, а не спрятаны ───────── */
for (const k of ["exam", "retake", "shots", "jazuu"]) assert.ok(!(k in T), "в данных нет блока " + k);
for (const l of LANGS) {
  const u = T.ui[l];
  for (const k of ["examTitle", "examNote", "examCols", "retakeTitle", "retakeNote", "shotsTitle", "shotsIntro"])
    assert.ok(!(k in u), l + ": в ui нет поля " + k);
  const all = JSON.stringify(u);
  assert.ok(!NAME_RE.test(all), l + ": в текстах страницы нет названия");
  assert.ok(!/kyrgyztest\.gov\.kg/.test(all), l + ": адрес сайта живёт только в ссылке под заданиями, не в текстах");
  assert.ok(!FORMAT_RE.test(all), l + ": числа и правила формата тестирования не публикуются");
  assert.ok(!CLAIM_RE.test(all), l + ": нет утверждений «как на экзамене / официальный формат»");
  assert.ok(!/гарантиру|guarantee|garanti/i.test(all), l + ": нет обещания гарантии");
  assert.ok(u.faq.some((f) => /офиц|official|resmî/i.test(f.q) && /не связаны|not related|bağlantılı değil/i.test(f.a)),
    l + ": в FAQ прямо сказано, что задания не связаны с официальным тестированием");
  assert.ok(u.faq.some((f) => f.a.includes("|/blog/gostestirovanie-kak-podgotovitsya/" + l + "))")),
    l + ": FAQ ведёт на статью о подготовке своего языка");
  assert.ok(!/voprosy-zhazuu-a1|kyrgyztest-kak-podgotovitsya/.test(all), l + ": нет ссылок на удалённые статьи");
  assert.ok(/a1/i.test(u.title) && /a1/i.test(u.h1), l + ": уровень A1 в титуле и h1");
  for (const k of ["ctaDemo", "ctaWa", "ctaLogin"]) assert.ok(u[k], l + ": есть магнит " + k);
  assert.ok(u.qLabel.includes("{n}") && u.qLabel.includes("{t}"), l + ": подпись задания несёт номер и итог");
  assert.ok(u.timeLeft.includes("{t}") && u.timeUp, l + ": таймер подписан");
  assert.strictEqual(u.verdicts.length, 3, l + ": три вердикта");
  assert.strictEqual(u.verdicts[2].max, T.questions.length, l + ": верхний вердикт покрывает все задания");
}
assert.ok(T.limitSec >= 300, "лимит не меньше пяти минут");

/* ── 2. Задания — фразы курса A1 с пропуском, дословно ───────────────────── */
const { loadData } = require("../deploy/gen-audio");
const CONTENT = loadData().CONTENT;
const A1_MODS = Object.keys(CONTENT).filter((m) => /^m([1-9]|10)$/.test(m));
const words = new Set();
for (const m of ["m0", ...A1_MODS]) {
  for (const v of CONTENT[m].vocab || []) for (const w of String(v.ky || "").split(/\s+/)) words.add(w.replace(/[.,!?;:«»—]/g, ""));
  for (const d of CONTENT[m].drill || []) for (const o of d.opts || []) words.add(String(o));
}
assert.ok(T.questions.length >= 18 && T.questions.length <= 24, "заданий 18–24");
const mods = new Set();
const ALL_KY = new Set(A1_MODS.flatMap((m) => (CONTENT[m].vocab || []).map((v) => String(v.ky))));
for (const q of T.questions) {
  assert.ok(/^m\d+_\d+$/.test(q.id), q.id + ": id вида <модуль>_<номер>");
  assert.ok(A1_MODS.includes(q.mod), q.id + ": задание из курса A1 (m1–m10)");
  mods.add(q.mod);
  assert.ok(Array.isArray(q.options) && q.options.length === 4 && new Set(q.options).size === 4, q.id + ": четыре разных варианта");
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, q.id + ": correct в 0–3");
  assert.ok(q.ky.includes("____"), q.id + ": формулировка с пропуском");
  assert.ok(!/[A-Za-z()«»=]/.test(q.ky), q.id + ": формулировка только на кыргызском, без подсказок и латиницы");
  assert.ok(!NAME_RE.test([q.ky, ...q.options, q.note, q.noteEn, q.noteTr].join(" ")), q.id + ": в задании нет названия");
  const src = (CONTENT[q.mod].vocab || []).find((v) => v.id === q.id);
  assert.ok(src, q.id + ": фраза-источник существует в курсе");
  assert.strictEqual(q.ky.replace("____", q.options[q.correct]), String(src.ky), q.id + ": предложение с верным словом = фраза курса дословно");
  for (const o of q.options) assert.ok(words.has(o), q.id + ": вариант «" + o + "» — слово курса");
  // атаки: фразу курса восстанавливает ровно один вариант, дистрактор не собирает другую фразу курса
  const fits = q.options.filter((o) => (CONTENT[q.mod].vocab || []).some((v) => String(v.ky) === q.ky.replace("____", o)));
  assert.deepStrictEqual(fits, [q.options[q.correct]], q.id + ": фразу курса восстанавливает ровно один вариант");
  for (const o of q.options) if (o !== q.options[q.correct])
    assert.ok(!ALL_KY.has(q.ky.replace("____", o)), q.id + ": дистрактор «" + o + "» собирает другую фразу курса");
  // ответ не выдаётся формой: не одинок по длине, регистр вариантов одинаков
  const lens = q.options.map((o) => o.length), cl = q.options[q.correct].length;
  assert.ok(lens.filter((l) => Math.abs(l - cl) <= 2).length >= 2, q.id + ": верный вариант не одинок по длине");
  const cap = (x) => /^[А-ЯЁӨҮҢ]/.test(x);
  assert.strictEqual(new Set(q.options.map(cap)).size, 1, q.id + ": регистр вариантов одинаков");
  // дистракторы — формы того же слова (лицо/число/падеж/гармония), а не другие слова
  const ans = q.options[q.correct];
  const sameStem = q.options.filter((o) => o !== ans && o.slice(0, 3) === ans.slice(0, 3)).length;
  const pronounSet = /^(менин|сенин|сиздин|биздин|кимдин|кимде|кимден|кимди)$/;
  assert.ok(sameStem >= 2 || q.options.every((o) => pronounSet.test(o)), q.id + ": дистракторы — формы того же слова, а не другие слова");
}
assert.ok(mods.size >= 5, "задания минимум из пяти модулей A1: " + [...mods].join(","));
// инструкция на кыргызском — фраза курса, а не сочинённая и не взятая извне
const COURSE_KY = new Set(Object.values(CONTENT).flatMap((c) => (c.vocab || []).map((v) => String(v.ky))));
for (const l of LANGS) assert.ok(!T.ui[l].askKy || COURSE_KY.has(T.ui[l].askKy), l + ": askKy — фраза курса");
// анти-каннибализация с B1 — прямая проверка титулов
const PB1 = JSON.parse(fs.readFileSync(path.join(ROOT, "app", "probny-b1", "probny-b1.json"), "utf8"));
for (const l of LANGS) assert.notStrictEqual(T.ui[l].title, PB1.ui[l].title, l + ": титул A1 отличается от B1");

/* ── 3–5. Отданные страницы ───────────────────────────────────────────────── */
// общий контракт честности страницы-теста: пометка под заданиями, ссылка на официальный
// сайт, ни названия, ни формата, ни пруф-блоков; LD без названия и без ключа
function honestPage(html, l, at) {
  const note = esc(SITE_UI[l].quizNote), off = esc(SITE_UI[l].quizOfficial);
  assert.ok(html.includes('<p class="muted quiz-note">' + note + "</p>"), at + ": пометка о несвязанности видима");
  assert.ok(html.includes(off + " " + OFFICIAL_A + "."), at + ": отсылка к официальному сайту — ссылкой");
  const iQuiz = html.indexOf('<div id="quiz"></div>'), iNote = html.indexOf("quiz-note"), iFaq = html.indexOf('<section class="faq">');
  assert.ok(iQuiz > 0 && iNote > iQuiz && (iFaq < 0 || iNote < iFaq), at + ": пометка стоит сразу под заданиями");
  assert.strictEqual(html.split(OFFICIAL_A).length - 1, 1, at + ": ссылка на официальный сайт ровно одна");
  assert.ok(!NAME_RE.test(withoutOfficialLink(html)), at + ": названия нет нигде на странице (кроме адреса в ссылке)");
  assert.ok(!/kyrgyztest\.gov\.kg/.test(withoutOfficialLink(html)), at + ": адрес сайта — только в ссылке");
  assert.ok(!/<blockquote class="proof"|<figure class="shot"|\/lessons\/exam-real|<table/.test(html), at + ": нет цитат, скринов и таблицы субтестов");
  assert.ok(!FORMAT_RE.test(html) && !/субтест|subtest|alt test/i.test(html), at + ": нет формата и правил тестирования");
  assert.ok(!CLAIM_RE.test(html), at + ": нет утверждений «как на экзамене / официальный формат»");
  assert.ok(!/voprosy-zhazuu-a1|kyrgyztest-kak-podgotovitsya/.test(html), at + ": нет ссылок на удалённые статьи");
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(" ");
  assert.ok(ld && !NAME_RE.test(ld) && !/kyrgyztest/.test(ld), at + ": LD без названия");
  return ld;
}

async function sectionPage() {
  const { startServer } = require("./helpers/serve");
  const dir = "/tmp/kga1-pa1-" + process.pid;
  const srv = await startServer({ port: 8213, dataDir: dir });
  try {
    for (const l of LANGS) {
      const r = await srv.req("GET", "/probny-test-a1/" + l);
      assert.strictEqual(r.status, 200, l + ": страница отдаётся");
      const html = r.text, at = "/probny-test-a1/" + l;
      const ld = honestPage(html, l, at);
      assert.ok(html.includes('"limitSec":900'), l + ": лимит времени уехал в клиент");
      assert.ok(html.includes(T.ui[l].ctaLogin), l + ": кнопка входа в результате");
      assert.ok(html.includes('rel="canonical" href="https://learn.kg/probny-test-a1/' + l + '"'), l + ": canonical на себя");
      assert.ok(html.includes('<a href="/blog/gostestirovanie-kak-podgotovitsya/' + l + '">'), l + ": ссылка на статью о подготовке кликабельна");
      for (const q of T.questions.slice(0, 5)) {
        assert.ok(!ld.includes(q.ky), l + ": формулировка задания не попала в LD");
        assert.ok(!ld.includes('"' + q.options[q.correct] + '"'), l + ": верный ответ не попал в LD");
      }
    }
    // перебор ВСЕХ страниц-тестов одного билдера: пометка и чистота — на каждой
    for (const base of ["/test", "/probny-test-a1", "/probny-test-b1", "/probny-test-b2"]) for (const l of LANGS) {
      const r = await srv.req("GET", base + "/" + l);
      assert.strictEqual(r.status, 200, base + "/" + l + " отвечает");
      honestPage(r.text, l, base + "/" + l);
    }
    // вердикт для каждого балла, поля — разбором отданного кода
    const page = (await srv.req("GET", "/probny-test-a1/ru")).text;
    const logic = page.match(/\/\* ===QUIZ-LOGIC=== \*\/\n([\s\S]*?)\/\* ===\/QUIZ-LOGIC=== \*\//)[1];
    // поля итога читает и IIFE после маркера логики — разбираем весь скрипт до </script>
    const code = page.match(/\/\* ===QUIZ-LOGIC=== \*\/\n([\s\S]*?)<\/script>/)[1];
    const fields = new Set([...code.matchAll(/\bv(?:\[[^\]]+\])?\.([a-zA-Z_]\w*)/g)].map((m) => m[1]));
    fields.delete("length");
    assert.ok(fields.has("short") && fields.has("h") && fields.has("p"), "разбор нашёл поля итога");
    assert.ok(/limitSec/.test(page) && /stopTimer/.test(page), "таймер в отданном коде");
    const sbv = { QUIZ: { verdicts: T.ui.ru.verdicts }, Math };
    vm.createContext(sbv); vm.runInContext(logic + "; this.verdictFor=verdictFor; this.shufQ=shufQ;", sbv);
    for (let sc = 0; sc <= T.questions.length; sc++) {
      const v = sbv.verdictFor(sc);
      for (const f of fields) assert.ok(v && v[f], "балл " + sc + ": вердикт с непустым " + f);
    }
    const pos = {};
    for (let k = 0; k < 400; k++) {
      const r = sbv.shufQ({ ky: "с", options: ["A", "B", "C", "D"], correct: 2 });
      assert.strictEqual(r.options[r.correct], "C", "верный ответ следует за перестановкой");
      pos[r.correct] = (pos[r.correct] || 0) + 1;
    }
    for (const p2 of [0, 1, 2, 3]) assert.ok((pos[p2] || 0) / 400 > 0.15, "позиция " + p2 + " выпадает");
    // sitemap несёт три варианта
    const sm = (await srv.req("GET", "/sitemap.xml")).text;
    for (const l of LANGS) assert.ok(sm.includes("<loc>https://learn.kg/probny-test-a1/" + l + "</loc>"), "sitemap: /probny-test-a1/" + l);
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  await sectionPage();
  console.log("probny-a1.test.js: OK (" + T.questions.length + " клоуз-заданий из фраз курса A1, пометка о несвязанности и ссылка на официальный сайт на 4 страницах-тестах × 3 языка, названия и формата нет, таймер " + T.limitSec / 60 + " мин)");
})().catch((e) => { console.error(e); process.exit(1); });
