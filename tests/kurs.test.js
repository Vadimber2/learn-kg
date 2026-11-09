"use strict";
/* Страницы описания курсов /kurs-a1|a2|b1|b2 — живой артефакт сервера, не греп исходников:
   перебор ВСЕХ курсов × ВСЕХ языков (канон: механизм с параметром-набором тестируется
   перебором). Цифры программы сверяются с CONTENT собранной страницы — страница не врёт. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { startServer } = require("./helpers/serve");

const PORT = 8213;
const LANGS = ["ru", "en", "tr"];
const COURSES = { a1: 12, a2: 12, b1: 12, b2: 12 }; // курс → ожидаемое число модулей в программе

// эталонные цифры: из той же сборки, что видит ученик (канон: не читать app/src поштучно)
const m0 = require("../server/appshell").buildAppHtml();
const dataSrc = m0.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
const csb = { console };
vm.createContext(csb);
vm.runInContext(dataSrc[1] + "; this.CONTENT=CONTENT;", csb);
const metaSrc = m0.match(/const MODULE_META=\[([\s\S]*?)\];/);
const modsOf = (cid) => [...metaSrc[1].matchAll(new RegExp('\\{id:"(m\\d+)",num:"[^"]*",course:"' + cid + '"', "g"))].map((x) => x[1]);
// первый LD-блок страницы (у витрины и страниц курсов он единственный)
const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/)[1]);
const ownOf = (mid) => csb.CONTENT[mid].vocab.filter((v) => !v.ref).length;

async function main() {
  const DATA = "/tmp/kga1-kurs-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const { req } = srv;
    // LD-граф витрины каждого языка — один раз, сверяется с каждым курсом ниже
    const vitrina = {};
    await Promise.all(LANGS.map(async (lang) => { vitrina[lang] = ldOf((await req("GET", "/" + lang)).text); }));
    for (const [cid, modCount] of Object.entries(COURSES)) {
      const base = "/kurs-" + cid;
      for (const lang of LANGS) {
        const r = await req("GET", base + "/" + lang);
        assert.strictEqual(r.status, 200, base + "/" + lang + " отвечает: " + r.status);
        const html = r.text;
        const at = base + "/" + lang + ": ";
        // программа: ровно N строк таблицы, счёт фраз совпадает с CONTENT
        const rows = [...html.matchAll(/<tr><td>[МM]?\d*[^<]*<\/td><td>/g)];
        const tbody = html.match(/<tbody>\n([\s\S]*?)\n<\/tbody>/);
        assert.ok(tbody, at + "таблица программы на месте");
        const trs = (tbody[1].match(/<tr>/g) || []).length;
        assert.strictEqual(trs, modCount, at + "в программе " + modCount + " модулей, найдено " + trs);
        const mods = modsOf(cid);
        const total = mods.reduce((s, m) => s + ownOf(m), 0);
        assert.ok(html.includes(String(total)), at + "итог " + total + " фраз заявлен");
        for (const mid of mods) {
          const n = ownOf(mid);
          if (n) assert.ok(html.includes(">" + n + "</td>"), at + mid + ": счёт " + n + " в таблице");
        }
        // магниты: демо → WhatsApp → вход (решение владельца)
        assert.ok(html.includes('href="/demo/' + lang + '"'), at + "магнит демо");
        assert.ok(html.includes("wa.me/996505854856"), at + "магнит WhatsApp");
        assert.ok(html.includes('href="/login"'), at + "магнит входа");
        // SEO-контракт: canonical на себя, полный hreflang, Course LD со своим уровнем
        assert.ok(html.includes('rel="canonical" href="https://learn.kg' + base + "/" + lang + '"'), at + "canonical на себя");
        for (const l of [...LANGS, "x-default"]) assert.ok(html.includes('hreflang="' + l + '"'), at + "hreflang " + l);
        const ld = ldOf(html);
        const course = ld["@graph"].find((n) => n["@type"] === "Course");
        assert.ok(course, at + "Course в LD");
        assert.strictEqual(course.educationalLevel, cid.toUpperCase(), at + "educationalLevel " + cid.toUpperCase());
        // Та же сущность на витрине /<lang> (склейка по @id) обязана называться и описываться
        // так же: до 08.10 Course A1 витрины звался «Курсы … A1–B2» с описанием всей витрины
        const twin = vitrina[lang]["@graph"].find((n) => n["@id"] === course["@id"]);
        assert.ok(twin, at + "витрина /" + lang + " объявляет Course с тем же @id " + course["@id"]);
        for (const f of ["name", "description", "teaches", "url", "educationalLevel"])
          assert.deepStrictEqual(twin[f], course[f], at + "Course." + f + " витрины /" + lang + " ≠ страницы курса");
        const item = vitrina[lang]["@graph"].find((n) => n["@type"] === "ItemList").itemListElement.find((x) => x.item["@id"] === course["@id"]);
        assert.strictEqual(item && item.name, course.name, at + "карусель витрины называет курс не его именем");
        assert.ok(ld["@graph"].some((n) => n["@type"] === "FAQPage"), at + "FAQPage в LD");
        assert.ok(ld["@graph"].some((n) => n["@type"] === "BreadcrumbList"), at + "хлебные крошки в LD");
        // Решение владельца 30.10.2026: названия организатора тестирования на странице нет
        // (адрес официального сайта — единственное исключение), «материал курса = официальный»
        // не утверждается, числа формата тестирования не публикуются
        const rest = html.replace(/kyrgyztest\.gov\.kg/g, "");
        assert.ok(!/кыргыз\s*тест|k[ıi]rg[ıi]z\s*test/i.test(rest), at + "названия организатора тестирования нет");
        assert.ok(!/официальн\S* (спис|формат|тем)|official (\w+ )?(topic )?lists|in the official (\w+ )?format|resmî (\S+ )?(konu listeler|listeler|format|biçim)|дословно с сайта|verbatim from|aynen alın|как на экзамене|like in the exam|sınavdaki gibi/i.test(html),
          at + "нет утверждений «по официальным спискам / в официальном формате / как на экзамене»");
        assert.ok(!/156 (задан|tasks|görev)|90 (задан|tasks|görev)|2 (часа|hours|saat) 50|субтест|subtest|alt test|15–18 (предложен|sentence|cümle)/i.test(html),
          at + "числа и субтесты формата тестирования не публикуются");
        if (cid !== "a2") assert.ok(/не связаны с заданиями официального тестирования|not related to the tasks of the official test|resmî sınavın görevleriyle bağlantılı değildir/.test(html),
          at + "в FAQ сказано, что задания курса не связаны с официальным тестированием");
        // FAQ виден человеку, не только разметке
        const faq = ld["@graph"].find((n) => n["@type"] === "FAQPage");
        for (const q of faq.mainEntity) assert.ok(html.includes(q.name.replace(/&/g, "&amp;").slice(0, 30)) || html.includes(q.name.slice(0, 30)), at + "вопрос FAQ виден: " + q.name.slice(0, 30));
      }
      // негоциация голого адреса — канон локализованных страниц: 301 + no-store
      const bare = await req("GET", base, { al: "tr" });
      assert.strictEqual(bare.status, 301, base + " голый — 301");
      assert.strictEqual(bare.headers.get("location"), base + "/tr", base + " ведёт по Accept-Language");
      assert.ok(/no-store/.test(bare.headers.get("cache-control") || ""), base + " редирект не кэшируется");
    }
    // страницы курсов есть в sitemap все двенадцать
    const sm = (await req("GET", "/sitemap.xml")).text;
    for (const cid of Object.keys(COURSES)) for (const l of LANGS)
      assert.ok(sm.includes("learn.kg/kurs-" + cid + "/" + l), "sitemap: /kurs-" + cid + "/" + l);
    console.log("kurs.test.js: OK (4 курса × 3 языка: программа сверена с CONTENT, магниты, Course LD = витрина, без названия и «официальности», негоциация, sitemap)");
  } finally {
    if (srv) await srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
