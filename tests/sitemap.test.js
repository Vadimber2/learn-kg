"use strict";
/* Генератор sitemap: актуальность гарантируется сверкой живой выдачи с
   ПЕРВОИСТОЧНИКАМИ данных, а не с кодом генератора:
   - состав: ровно (реестр локализованных страниц × его языки) + статьи блога из
     app/blog/*.json × их языки + три одностраничника — ни лишних, ни пропавших;
   - lastmod: у страниц-из-данных — поле updated их JSON (правка контента обязана
     его двигать), у витрины/демо/одностраничников — app/seo-lastmod.json, чей sha-гард
     (tests/landing.test.js) заставляет трогать манифест при любой правке файла;
   - даты валидны и не из будущего (опечатка года иначе прожила бы до жалобы);
   - манифест и updated страниц-из-данных не расходятся между собой. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const PORT = 8215;
const APP = path.join(__dirname, "..", "app");
const LANGS = ["ru", "en", "tr"];
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(APP, p), "utf8"));

async function main() {
  const DATA = "/tmp/kga1-sitemap-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const xml = (await srv.req("GET", "/sitemap.xml")).text;

    // разбор без потерь: каждый <url> обязан распасться на loc+lastmod
    const got = new Map([...xml.matchAll(
      /<url><loc>https:\/\/learn\.kg\/([^<]*)<\/loc><lastmod>([^<]*)<\/lastmod><\/url>/g,
    )].map((m) => [m[1], m[2]]));
    assert.strictEqual(got.size, (xml.match(/<url>/g) || []).length,
      "часть <url> не распарсилась (loc без lastmod или иной формат)");

    // ожидание строится из данных на диске — тех же, из которых собирается сайт
    const SEO = readJson("seo-lastmod.json");
    const LT = readJson("test/level-test.json");
    const RZ = readJson("razgovornik/razgovornik.json");
    const PV = readJson("perevodchik/perevodchik.json");
    const PB1 = readJson("probny-b1/probny-b1.json");   // пробный тест B1 — своя дата
    const PA1 = readJson("probny-a1/probny-a1.json");   // пробный тест A1 — своя дата
    const PB2 = readJson("probny-b2/probny-b2.json");   // пробный тест B2 — своя дата
    const KURS = readJson("kurs/kurs.json");
    const HELP = readJson("help/help.json");
    const posts = fs.readdirSync(path.join(APP, "blog")).filter((f) => f.endsWith(".json")).sort()
      .map((f) => readJson("blog/" + f));

    const expected = new Map();
    for (const l of LANGS) {
      expected.set(l, SEO["landing.html"].date); // витрина
      expected.set("demo/" + l, SEO["landing.html"].date); // демо едет релизами витрины
      expected.set("test/" + l, LT.updated);
      expected.set("razgovornik/" + l, RZ.updated);
      expected.set("perevodchik/" + l, PV.updated);
      expected.set("probny-test-b1/" + l, PB1.updated);
      expected.set("probny-test-a1/" + l, PA1.updated);
      expected.set("probny-test-b2/" + l, PB2.updated);
      for (const cid of Object.keys(KURS.courses)) expected.set("kurs-" + cid + "/" + l, KURS.updated);
      expected.set("help/" + l, HELP.updated);
      expected.set("blog/" + l, posts.reduce((d, p) => (p.updated > d ? p.updated : d), "2026-01-01"));
    }
    for (const p of posts) for (const l of LANGS.filter((l) => p.langs[l]))
      expected.set("blog/" + p.slug + "/" + l, p.updated);
    for (const f of ["privacy", "terms", "install"]) expected.set(f, SEO[f + ".html"].date);
    // страницы-ответы «X по-кыргызски»: состав — реестр app/words/words.json, дата — его updated
    // (правка реестра обязана двигать updated, иначе Яндекс и Google не перечитают страницы)
    const WORDS = readJson("words/words.json");
    for (const w of WORDS.words) for (const l of LANGS) expected.set("slovo/" + w.slug + "/" + l, WORDS.updated);
    // хаб слов: дата — более поздняя из updated реестра и updated текстов хаба (правка
    // любого из двух обязана двигать lastmod списка)
    const WHUB = readJson("words/hub.json");
    const hubDate = WHUB.updated > WORDS.updated ? WHUB.updated : WORDS.updated;
    for (const l of LANGS) expected.set("slovo/" + l, hubDate);

    assert.deepStrictEqual(
      Object.fromEntries([...got].sort()), Object.fromEntries([...expected].sort()),
      "sitemap разошёлся с первоисточниками (состав или lastmod)");

    // санитария дат: формат и «не из будущего» — опечатка года не должна жить до жалобы.
    // Люфт +1 день: даты манифеста ставятся по местному времени, а toISOString — UTC,
    // и у полуночи местное «сегодня» на день впереди UTC (реальная ночная гонка 15→16.08)
    const maxDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    for (const [u, d] of got) {
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d), u + ": lastmod не YYYY-MM-DD: " + d);
      assert.ok(d <= maxDate, u + ": lastmod из будущего: " + d);
    }

    // связка манифеста со страницами-из-данных: их запись в манифесте (sha-гард
    // заставляет трогать её при правке файла) обязана совпадать с updated самого JSON —
    // так правка контента не проскочит без осознанного решения о дате
    for (const [file, json] of [["test/level-test.json", LT],
      ["razgovornik/razgovornik.json", RZ], ["perevodchik/perevodchik.json", PV], ["probny-b1/probny-b1.json", PB1], ["probny-a1/probny-a1.json", PA1], ["probny-b2/probny-b2.json", PB2],
      ["kurs/kurs.json", KURS], ["help/help.json", HELP]]) {
      assert.ok(SEO[file], file + " отсутствует в app/seo-lastmod.json");
      assert.strictEqual(SEO[file].date, json.updated,
        file + ": date манифеста и updated JSON разошлись");
    }

    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(WORDS.updated), "words.json: updated не YYYY-MM-DD");
    console.log("sitemap.test.js: OK (" + got.size + " URL: состав и lastmod сверены с " +
      posts.length + " статьями, тремя JSON страниц-из-данных и seo-lastmod; даты валидны)");
  } finally {
    if (srv) await srv.stop();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
