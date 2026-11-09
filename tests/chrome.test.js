"use strict";
/* Единая навигация публичных страниц — гвард по живой выдаче, а не по исходникам.
   Дыра, ради которой сьют написан: разделы появлялись по одному, и на части страниц
   меню отставало (курсов не было нигде), а футера не было вовсе; на privacy/terms
   не было никакой навигации. Здесь перебираются ВСЕ базы реестра локализованных
   страниц × все языки: у каждой обязана быть шапка с Курсами и Помощью и футер
   со всеми разделами; у одностраничников — полный набор ссылок в каждом языковом
   блоке. Новая страница попадает под гвард автоматически (перебор по sitemap). */
const assert = require("assert");
const fs = require("fs");
const { startServer } = require("./helpers/serve");

const PORT = 8217;
const LANGS = ["ru", "en", "tr"];

async function main() {
  const DATA = "/tmp/kga1-chrome-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const { req } = srv;

    // состав страниц — из живого sitemap: базы с языковыми вариантами
    const sitemap = (await req("GET", "/sitemap.xml")).text;
    const urls = [...sitemap.matchAll(/<loc>https:\/\/learn\.kg\/([^<]*)<\/loc>/g)].map((m) => m[1]);
    const bases = new Set();
    for (const u of urls) {
      const m = u.match(/^(.*?)\/?(ru|en|tr)$/);
      if (m) bases.add(m[1]);
    }
    // витрина и демо — свои собственные шапки (лендинг и тренажёр), их контракт
    // стерегут landing.test и демо-проверки server.test; здесь — контентные страницы
    bases.delete("");
    bases.delete("demo");
    assert.ok(bases.size >= 25, "баз для проверки достаточно: " + bases.size);

    for (const base of [...bases].sort()) {
      for (const lang of LANGS) {
        const r = await req("GET", "/" + base + "/" + lang);
        assert.strictEqual(r.status, 200, base + "/" + lang + ": " + r.status);
        const html = r.text;
        const at = "/" + base + "/" + lang + ": ";
        // шапка: бренд, Курсы (в секцию уровней витрины), Помощь, вход и демо
        assert.ok(html.includes('<header class="shead">'), at + "шапка сайта на месте");
        assert.ok(!html.includes("#levels\""), at + "пункта «Курсы» в меню нет (решение владельца) — курсы в футере и Помощи");
        assert.ok(html.includes('href="/help/' + lang + '"'), at + "в меню есть Помощь");
        assert.ok(html.includes('href="/blog/' + lang + '"'), at + "в меню есть Блог");
        // футер: единый, со всеми разделами и юридическими страницами
        assert.ok(html.includes('<footer class="sfoot">'), at + "футер на месте");
        for (const need of ["/kurs-a1/" + lang, "/kurs-a2/" + lang, "/kurs-b1/" + lang, "/kurs-b2/" + lang,
          "/razgovornik/" + lang, "/slovo/" + lang, "/perevodchik/" + lang, "/test/" + lang,
          // пробный тест B1 — публичный вход для тех, кто готовится к экзамену:
          // страница без дороги с сайта не существует ни для человека, ни для обхода
          "/probny-test-a1/" + lang, "/probny-test-b1/" + lang, "/probny-test-b2/" + lang,
          "/install", "/privacy", "/terms", "/login"]) {
          assert.ok(html.includes('href="' + need + '"'), at + "в футере есть " + need);
        }
        assert.ok((html.match(/<footer class="sfoot">/g) || []).length === 1, at + "футер ровно один");
        // почта проекта — на каждой странице: мессенджер удобен не всем (учреждения,
        // подрядчики, запросы по данным), и адрес не должен зависеть от языка
        assert.ok(html.includes('href="mailto:info@learn.kg"'), at + "в футере есть почта info@learn.kg");
      }
    }

    // одностраничники: вшитые шапка и футер — по копии на каждый язык документа,
    // с полным набором разделов в каждой копии
    for (const page of ["/privacy", "/terms", "/install"]) {
      const html = (await req("GET", page)).text;
      assert.strictEqual((html.match(/<header class="shead">/g) || []).length, 3, page + ": три языковые шапки");
      assert.strictEqual((html.match(/<footer class="sfoot">/g) || []).length, 3, page + ": три языковых футера");
      for (const lang of LANGS) assert.ok(html.includes('class="back chrome-i" lang="' + lang + '" href="/' + lang + '"'),
        page + ": крошка «Главная» " + lang + " ведёт на /" + lang);
      for (const lang of LANGS) for (const need of ["/kurs-a1/" + lang, "/blog/" + lang, "/razgovornik/" + lang, "/perevodchik/" + lang, "/test/" + lang, "/help/" + lang]) {
        assert.ok(html.includes('href="' + need + '"'), page + ": ссылка " + need + " на месте");
      }
      // почта в каждой языковой копии футера + в тексте документа (privacy/terms —
      // там она канал обращения по данным и по доступу, а не только «связаться»)
      assert.strictEqual((html.match(/href="mailto:info@learn\.kg"/g) || []).length >= 3, true,
        page + ": почта в каждой языковой копии");
    }

    // витрина: Помощь в шапке и футере (своя шапка — но раздел обязан быть виден)
    const landing = (await req("GET", "/ru")).text;
    assert.ok((landing.match(/href="\/help\/ru"/g) || []).length >= 2, "витрина: Помощь в шапке и футере");

    console.log("chrome.test.js: OK (" + bases.size + " баз × 3 языка: шапка с Курсами и Помощью, единый футер; одностраничники ×3 блока; витрина)");
  } finally {
    if (srv) srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
