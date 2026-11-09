"use strict";
/* Пробный тест learn.kg B1 (/probny-test-b1) — гейт честности и поведения.

   Решение владельца 30.10.2026: название организатора государственного тестирования,
   его формат (субтесты, число заданий, время), правила пересдачи, цитаты и скрины
   интерфейса со страницы убраны; рядом с заданиями — видимая пометка «задания
   составлены learn.kg… не связаны с заданиями официального тестирования», формат и
   запись — только отсылкой на официальный сайт.

   Тест проверяет: (1) данные — блоков exam/retake/shots нет; (2) задания дословно
   совпадают с дриллами курса B1 (m24+), вычитанными носителем; (3) отданная страница
   каждого языка несёт пометку и ссылку, но не несёт названия, формата, цитат и
   скринов; LD чистый; (4) клиент — вердикт для каждого балла, равномерный шафл. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const LEVEL = "b1", MIN_MOD = 24, PORT = 8207;
const BASE = "/probny-test-" + LEVEL;
const ROOT = path.join(__dirname, "..");
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "app", "probny-" + LEVEL, "probny-" + LEVEL + ".json"), "utf8"));
const SITE_UI = JSON.parse(fs.readFileSync(path.join(ROOT, "app", "site-ui.json"), "utf8"));
const LANGS = ["ru", "en", "tr"];
const NAME_RE = /кыргыз\s*тест|k[ıi]rg[ıi]z\s*test|kyrgyz\s+test\b/i;
const OFFICIAL_A = '<a href="https://kyrgyztest.gov.kg" target="_blank" rel="noopener noreferrer">kyrgyztest.gov.kg</a>';
const CLAIM_RE = /как на (настоящем )?экзамене|настоящ\S* экзамен|реальн\S* (тест|экзамен)|идентичн|формате? экзамена|official format|real exam|real test|like in the exam|identical|sınavdaki gibi|gerçek sınav|resmî .{0,20}biçimin|официальных списк|official .{0,20}lists|resmî .{0,20}listeler/i;
const FORMAT_RE = /\b156\b|\b90 (заданий|задания|tasks|görev|soru)|2 (часа|hours|saat) 50|50[-–]59|балл болгон|тапшырма/i;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── 1. Данные: формат и пруфы организатора удалены, а не спрятаны ───────── */
for (const k of ["exam", "retake", "shots", "jazuu"]) assert.ok(!(k in T), "в данных нет блока " + k);
for (const l of LANGS) {
  const u = T.ui[l], all = JSON.stringify(u);
  for (const k of ["examTitle", "examNote", "examCols", "retakeTitle", "retakeNote", "shotsTitle", "shotsIntro"])
    assert.ok(!(k in u), l + ": в ui нет поля " + k);
  assert.ok(!NAME_RE.test(all), l + ": в текстах страницы нет названия");
  assert.ok(!/kyrgyztest\.gov\.kg/.test(all), l + ": адрес сайта живёт только в ссылке под заданиями");
  assert.ok(!FORMAT_RE.test(all), l + ": числа и правила формата тестирования не публикуются");
  assert.ok(!CLAIM_RE.test(all), l + ": нет утверждений «как на экзамене / по официальным спискам»");
  assert.ok(!/гарантиру|guarantee|garanti/i.test(all), l + ": страница не обещает гарантию сдачи");
  assert.ok(u.faq.some((f) => /офиц|official|resmî/i.test(f.q) && /не связаны|not related|bağlantılı değil/i.test(f.a)),
    l + ": в FAQ прямо сказано, что задания не связаны с официальным тестированием");
  assert.ok(u.faq.some((f) => f.a.includes("|/blog/gostestirovanie-kak-podgotovitsya/" + l + "))")),
    l + ": FAQ ведёт на статью о подготовке своего языка");
  assert.ok(new RegExp(LEVEL, "i").test(u.title) && new RegExp(LEVEL, "i").test(u.h1), l + ": уровень в титуле и h1");
  for (const k of ["ctaDemo", "ctaWa", "ctaLogin"]) assert.ok(u[k], l + ": есть магнит " + k);
  assert.ok(u.timeLeft.includes("{t}"), l + ": подпись таймера с подстановкой времени");
  // «Задание» без номера — пустой чип на экране (поймано глазами на проде 22.08)
  assert.ok(u.qLabel.includes("{n}") && u.qLabel.includes("{t}"), l + ": подпись задания несёт номер и общее количество");
  assert.ok(u.timeUp, l + ": есть текст на случай, когда время вышло");
  assert.strictEqual(u.verdicts.length, 3, l + ": три вердикта");
  assert.strictEqual(u.verdicts[u.verdicts.length - 1].max, T.questions.length, l + ": верхний вердикт покрывает все задания");
}
assert.ok(T.limitSec >= 300, "лимит не меньше пяти минут — иначе это не тренировка, а угадайка");

/* ── 2. Задания взяты из вычитанного курса, а не сочинены ────────────────── */
const { loadData } = require("../deploy/gen-audio");
const CONTENT = loadData().CONTENT;
assert.ok(T.questions.length >= 18 && T.questions.length <= 24, "заданий 18–24");
const mods = new Set(), ids = new Set();
for (const q of T.questions) {
  assert.ok(/^m\d+_\d+$/.test(q.id), q.id + ": id вида <модуль>_<номер>");
  assert.ok(!ids.has(q.id), q.id + ": id не повторяется");
  ids.add(q.id);
  assert.ok(Array.isArray(q.options) && q.options.length === 4 && new Set(q.options).size === 4, q.id + ": четыре разных варианта");
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, q.id + ": correct в 0–3");
  assert.ok(q.mod && Number(q.mod.slice(1)) >= MIN_MOD, q.id + ": задание из курса " + LEVEL.toUpperCase() + " (m" + MIN_MOD + "+)");
  mods.add(q.mod);
  assert.ok(!NAME_RE.test([q.ky, ...q.options, q.note, q.noteEn, q.noteTr].join(" ")), q.id + ": в задании нет названия");
  // формулировка, варианты и ответ дословно совпадают с дриллом курса (вычитан носителем)
  const twin = ((CONTENT[q.mod] || {}).drill || []).find((d) => d.qKy === q.ky);
  assert.ok(twin, q.id + ": формулировка «" + q.ky.slice(0, 40) + "…» есть в дриллах " + q.mod);
  assert.deepStrictEqual(q.options, JSON.parse(JSON.stringify(twin.opts)), q.id + ": варианты совпадают с курсом");
  assert.strictEqual(q.correct, twin.c, q.id + ": верный ответ совпадает с курсом");
}
assert.ok(mods.size >= 5, "задания собраны минимум из пяти модулей, а не из одного: " + [...mods].join(","));
const COURSE_KY = new Set(Object.values(CONTENT).flatMap((c) => (c.vocab || []).map((v) => String(v.ky))));
for (const l of LANGS) assert.ok(!T.ui[l].askKy || COURSE_KY.has(T.ui[l].askKy), l + ": askKy — фраза курса");

/* ── 3–4. Отданная страница ───────────────────────────────────────────────── */
async function sectionPage() {
  const { startServer } = require("./helpers/serve");
  const dir = "/tmp/kga1-p" + LEVEL + "-" + process.pid;
  const srv = await startServer({ port: PORT, dataDir: dir });
  try {
    for (const l of LANGS) {
      const r = await srv.req("GET", BASE + "/" + l);
      assert.strictEqual(r.status, 200, BASE + "/" + l + " отвечает");
      const html = r.text, at = BASE + "/" + l;
      assert.ok(html.includes('"limitSec":' + T.limitSec), at + ": лимит времени уехал в клиент");
      assert.ok(html.includes(T.ui[l].ctaLogin), at + ": кнопка входа в результате");
      assert.ok(html.includes('<html lang="' + l + '"'), at + ": язык документа — язык варианта");
      assert.ok(html.includes('rel="canonical" href="https://learn.kg' + BASE + "/" + l + '"'), at + ": canonical на себя");
      for (const hl of [...LANGS, "x-default"]) assert.ok(html.includes('hreflang="' + hl + '"'), at + ": hreflang " + hl);
      // пометка о несвязанности — сразу под заданиями, отсылка к официальному сайту — ссылкой
      assert.ok(html.includes('<p class="muted quiz-note">' + esc(SITE_UI[l].quizNote) + "</p>"), at + ": пометка о несвязанности видима");
      assert.ok(html.includes(esc(SITE_UI[l].quizOfficial) + " " + OFFICIAL_A + "."), at + ": отсылка к официальному сайту — ссылкой");
      const iQuiz = html.indexOf('<div id="quiz"></div>'), iNote = html.indexOf("quiz-note"), iFaq = html.indexOf('<section class="faq">');
      assert.ok(iQuiz > 0 && iNote > iQuiz && iNote < iFaq, at + ": пометка стоит под заданиями, до FAQ");
      // ни названия, ни формата, ни пруф-блоков
      const rest = html.split(OFFICIAL_A).join("");
      assert.ok(!NAME_RE.test(rest) && !/kyrgyztest\.gov\.kg/.test(rest), at + ": названия и адреса нет нигде, кроме ссылки");
      assert.ok(!/<blockquote class="proof"|<figure class="shot"|\/lessons\/exam-real|<table/.test(html), at + ": нет цитат, скринов и таблицы субтестов");
      assert.ok(!FORMAT_RE.test(html) && !/субтест|subtest|alt test/i.test(html), at + ": нет формата и правил тестирования");
      assert.ok(!CLAIM_RE.test(html), at + ": нет утверждений «как на экзамене / по официальным спискам»");
      assert.ok(html.includes('<a href="/blog/gostestirovanie-kak-podgotovitsya/' + l + '">'), at + ": ссылка на статью о подготовке");
      assert.ok(!/voprosy-zhazuu-a1|kyrgyztest-kak-podgotovitsya/.test(html), at + ": нет ссылок на удалённые статьи");
      // ключ теста и название не попадают в LD-разметку
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join(" ");
      assert.ok(!NAME_RE.test(ld) && !/kyrgyztest/.test(ld), at + ": LD без названия");
      for (const q of T.questions.slice(0, 5)) {
        assert.ok(!ld.includes(q.ky), at + ": формулировка задания не попала в LD-разметку");
        assert.ok(!ld.includes('"' + q.options[q.correct] + '"'), at + ": верный ответ не попал в LD-разметку");
      }
    }
    // негоциация голого адреса — канон локализованных страниц
    const bare = await srv.req("GET", BASE, { al: "tr" });
    assert.strictEqual(bare.status, 301, "голый адрес — 301");
    assert.strictEqual(bare.headers.get("location"), BASE + "/tr", "ведёт по Accept-Language");
    assert.ok(/no-store/.test(bare.headers.get("cache-control") || ""), "редирект не кэшируется");
    const sm = (await srv.req("GET", "/sitemap.xml")).text;
    for (const l of LANGS) assert.ok(sm.includes("learn.kg" + BASE + "/" + l), "sitemap: " + BASE + "/" + l);

    /* Итоговый экран: поля вердикта, которые ЧИТАЕТ отданный код, обязаны быть в данных
       (класс бага «Ваш результат: 4/20 · undefined», v1.1.121). Поля вынимаются РАЗБОРОМ кода. */
    const page = (await srv.req("GET", BASE + "/ru")).text;
    const code = page.match(/\/\* ===QUIZ-LOGIC=== \*\/\n([\s\S]*?)<\/script>/)[1];
    const fields = new Set([...code.matchAll(/\bv(?:\[[^\]]+\])?\.([a-zA-Z_]\w*)/g)].map((m) => m[1]));
    fields.delete("length"); // v.length — работа с массивом вердиктов, не поле записи
    assert.ok(fields.has("short") && fields.has("h") && fields.has("p"), "разбор нашёл поля итога: " + [...fields].join(","));
    for (const l of LANGS) for (const v of T.ui[l].verdicts) for (const f of fields)
      assert.ok(v[f] !== undefined && String(v[f]).trim() !== "", l + ": вердикт до " + v.max + " не имеет поля " + f);
    const logic = page.match(/\/\* ===QUIZ-LOGIC=== \*\/\n([\s\S]*?)\/\* ===\/QUIZ-LOGIC=== \*\//)[1];
    assert.ok(/limitSec/.test(page) && /stopTimer/.test(page), "таймер в отданном коде");
    const sbv = { QUIZ: { verdicts: T.ui.ru.verdicts }, Math };
    vm.createContext(sbv);
    vm.runInContext(logic + "; this.verdictFor=verdictFor; this.shufQ=shufQ;", sbv);
    for (let sc = 0; sc <= T.questions.length; sc++) {
      const v = sbv.verdictFor(sc);
      for (const f of fields) assert.ok(v && v[f], "балл " + sc + ": вердикт с непустым " + f);
    }
    // рантайм-шафл: позиции верного равномерны, варианты — перестановка, correct следует за верным
    const pos = {};
    for (let k = 0; k < 400; k++) {
      const r = sbv.shufQ({ ky: "с", options: ["A", "B", "C", "D"], correct: 2 });
      assert.strictEqual(r.options[r.correct], "C", "верный ответ следует за перестановкой");
      assert.strictEqual(JSON.parse(JSON.stringify(r.options)).slice().sort().join(""), "ABCD", "варианты — перестановка исходных");
      pos[r.correct] = (pos[r.correct] || 0) + 1;
    }
    for (const p2 of [0, 1, 2, 3]) assert.ok((pos[p2] || 0) / 400 > 0.15, "позиция " + p2 + " выпадает: " + JSON.stringify(pos));
  } finally { await srv.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}

/* Итоговая строка «: OK» печатается последней, после всех секций: иначе предкоммитный
   подсчёт зелёных (grep -c ": OK") засчитал бы красный прогон. */
(async () => {
  await sectionPage();
  console.log("probny-" + LEVEL + ".test.js: OK (" + T.questions.length + " заданий из " + mods.size + " модулей курса " +
    LEVEL.toUpperCase() + " дословно, пометка о несвязанности и ссылка на официальный сайт × 3 языка, названия и формата нет, таймер " + T.limitSec / 60 + " мин)");
})().catch((e) => { console.error(e); process.exit(1); });
