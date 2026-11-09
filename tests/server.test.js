"use strict";
/* Интеграционные тесты сервера: auth/роли, прогресс, вычитка, overrides,
   аудио, секреты, методика + контракт формата логов (logging-standards). */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { startServer } = require("./helpers/serve");

const PORT = 8191;
const BASE = "http://localhost:" + PORT;
const DATA = "/tmp/kga1-test-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
// то же экранирование, что у сервера (server.js): сверка данных с HTML идёт после него
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ILIM = B("ilim", "Tst-vKIxmveh-9"), ALT = B("altynai", "Tst-lwxo2c1U-9"), VADIM = B("vadim", "Tst-sFVPwRvG-9");

const LOG_HEAD_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[[a-z0-9-]+\] (INFO|WARN|ERROR|DEBUG): /;
const STACK_RE = /^(\s+at |Error|[A-Za-z]+Error|Caused by)/;

let req; // даёт харнесс serve.js после старта сервера

// Канон: каждый языковой вариант несёт полный hreflang-набор, x-default — на негоциирующий корень
function assertHreflangs(text, prefix, where) {
  for (const l of ["ru", "en", "tr"])
    assert.ok(text.includes('hreflang="' + l + '" href="https://learn.kg' + prefix + "/" + l + '"'), where + " несёт hreflang " + l);
  assert.ok(text.includes('hreflang="x-default" href="https://learn.kg' + (prefix || "/") + '"'), where + " несёт x-default");
}

// Исходники для статических guard'ов ниже — читаются один раз на весь файл
const M0_SRC = require("../server/appshell").buildAppHtml();
const SRV_SRC = require("./helpers/server-src").all; // весь server/*.js — переживает декомпозицию
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version;

// Guard демо-утечки: stripPaidRenderers вырезает ТОЛЬКО перечисленное в PAID_RENDERERS,
// поэтому платный рендер, забытый в списке, молча уехал бы в публичный /demo.
// Равенство множеств в обе стороны: ловит и забытую регистрацию, и мёртвую запись.
// Семейство render\w*M\d+ шире трёх нынешних имён — рендер нового вида (m13+) тоже попадёт.
{
  // Список выводится из манифеста частей; сверяем его с функциями, реально лежащими
  // в собранной странице: часть, названная не по своей функции, иначе оставила бы
  // платный справочник в публичном /demo.
  const listed = require("../server/appshell").manifest
    .map((p) => (p.match(/^render\/\d+-(render\w*M\d+)\.js$/) || [])[1]).filter(Boolean).sort();
  const paid = [...M0_SRC.matchAll(/\nfunction (render\w*M\d+)\(m\)\{/g)]
    .map((m) => m[1]).filter((n) => !n.endsWith("M0")).sort(); // М0 открыт в демо
  assert.deepStrictEqual(listed, paid,
    "части render/* ≠ платные рендеры страницы: расхождение — либо утечка в /demo, либо мёртвая часть");
}

// Сверка трёх реестров модулей: MODULE_META (клиентский каталог с курсами), COURSES
// (серверная таксономия) и CONTENT_READY (готовый контент) обязаны совпадать —
// регистрация нового модуля, забытая в любом из них, означала бы тихо потерянный
// модуль (его не увидит ни один ученик, и ни один другой тест этого не поймает).
// Литералы ВЫЧИСЛЯЮТСЯ в vm (как ===DATA=== в соседних тестах), а не парсятся
// регекспами по форме: переформатирование реестра не сломает и не ослепит guard;
// match(...)[0] сам падает, если литерал не найден.
const REGISTRY = (() => {
  const sb = {};
  vm.createContext(sb);
  vm.runInContext([
    M0_SRC.match(/const MODULE_META=\[[\s\S]*?\n\];/)[0],
    M0_SRC.match(/const CONTENT_READY\s*=\s*\[[^\]]*\];/)[0],
    SRV_SRC.match(/const COURSES = \{[\s\S]*?\n\};/)[0],
    "this.META=MODULE_META;this.READY=CONTENT_READY;this.C=COURSES;",
  ].join("\n"), sb);
  // spread-копия: массивы из vm-контекста несут прототип чужого realm, и deepStrictEqual
  // забраковал бы их против местных при полностью одинаковых данных
  const srvByCourse = Object.fromEntries(Object.entries(sb.C).map(([c, v]) => [c, [...v.modules]]));
  const metaByCourse = {};
  for (const mm of sb.META) (metaByCourse[mm.course] = metaByCourse[mm.course] || []).push(mm.id);
  // сравнение массивов — порядок каталога обязан совпадать с порядком тропы курса
  assert.deepStrictEqual(metaByCourse, srvByCourse, "курсовая карта MODULE_META расходится с COURSES сервера");
  // без .sort(): порядок CONTENT_READY семантичен (донор alias обязан стоять раньше)
  assert.deepStrictEqual(Object.values(srvByCourse).flat(), [...sb.READY],
    "модули COURSES ≠ CONTENT_READY: контент и таксономия разъехались");
  return srvByCourse;
})();

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  // до старта сервера: демо-аудио снимается копией ПРИ СБОРКЕ — файл должен существовать
  // к моменту запуска; m0_01 входит в демо-набор и позже переиспользуется аудио-тестами
  fs.mkdirSync(path.join(DATA, "audio", "m0"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "audio", "m0", "m0_01.mp3"), Buffer.from("demofixture-mp3"));
  fs.writeFileSync(path.join(DATA, "audio", "m0", "ph_oz.mp3"), Buffer.from("alphafixture-mp3"));
  // разговорник: публичный аудио-слой снимается ПРИ СТАРТЕ — фикстура фразы платного
  // модуля кладётся заранее. Пример открытой и закрытой фразы ВЫЧИСЛЯЕТСЯ из данных
  // (razgovornik.json + CONTENT), а не пиннится литералом: смена состава секций не
  // должна ни ронять тест, ни делать его слепым.
  const RZ_CONF = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "razgovornik", "razgovornik.json"), "utf8"));
  const rzPaid = (() => {
    const dataSrc = M0_SRC.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//)[1];
    const csb = { console };
    vm.createContext(csb);
    vm.runInContext(dataSrc + "; this.C=CONTENT;", csb);
    // первый pick платного модуля (не m0) + сосед из того же модуля вне разговорника
    const rzCats = new Set(); const rzMods = new Set();
    for (const s of RZ_CONF.sections) for (const p of s.pick || []) { rzCats.add(p.mod + "/" + p.cat); rzMods.add(p.mod); }
    // модуль курса A2: ученик-фикстура ходит по авто-тропе A1, и только фраза A2
    // проверяет снимок (модуль A1 отдался бы живым файлом и тест ослеп бы)
    const mod = [...rzMods].find((m) => REGISTRY.a2.includes(m));
    const inRz = csb.C[mod].vocab.find((v) => !v.ref && rzCats.has(mod + "/" + v.cat));
    const outRz = csb.C[mod].vocab.find((v) => !v.ref && !rzCats.has(mod + "/" + v.cat));
    assert.ok(inRz && outRz, "нашлись открытая и закрытая фразы модуля " + mod);
    return { mod, open: inRz.id, closed: outRz.id };
  })();
  fs.mkdirSync(path.join(DATA, "audio", rzPaid.mod), { recursive: true });
  fs.writeFileSync(path.join(DATA, "audio", rzPaid.mod, rzPaid.open + ".mp3"), Buffer.from("razgofixture-mp3"));
  fs.writeFileSync(path.join(DATA, "audio", rzPaid.mod, rzPaid.closed + ".mp3"), Buffer.from("closedfixture-mp3"));
  // Учётки берём из фикстуры, а не из боевого users.json: состав пользователей на проде
  // меняется (кого-то заводят, кого-то убирают), и тесты не должны от этого зависеть.
  let srv;
  try {
    // ELEVEN_VOICE_ID гасится: тест сброса голоса проверяет фолбэк на реестр
    // deploy/voices.json, и env машины запуска не должен его перебивать
    srv = await startServer({ port: PORT, dataDir: DATA, env: { ELEVEN_VOICE_ID: "" } });
    req = srv.req;
    const logs = srv.logs;

    // --- витрина по канону: /ru|/en|/tr; аноним на «/» — SEO-301 на /ru (no-store: без кэш-петли входа) ---
    // аноним на «/»: язык браузера (ru/tr — свой вариант), любой другой или без заголовка — /en
    for (const [al, want] of [["ru-RU,ru;q=0.9", "/ru"], ["tr-TR,tr;q=0.8", "/tr"], ["ky-KG,ky;q=0.9", "/ru"], ["de-DE,de;q=0.9", "/en"], [null, "/en"]]) {
      const r0 = await req("GET", "/", al ? { al } : {});
      assert.strictEqual(r0.status, 301, "аноним на «/» — постоянный редирект (SEO)");
      assert.strictEqual(r0.headers.get("location"), want, "«/» при Accept-Language=" + al + " → " + want);
      assert.ok(/no-store/.test(r0.headers.get("cache-control") || ""), "редирект «/» не кэшируется");
      assert.ok(/Cookie/i.test(r0.headers.get("vary") || "") && /Accept-Language/i.test(r0.headers.get("vary") || ""),
        "редирект «/» варьируется по Cookie и Accept-Language");
    }
    // Сохранённый выбор языка едет на сервер кукой и побеждает язык браузера: иначе
    // «/» уводил бы на вариант, чей интерфейс человек уже сменил на другой
    for (const [ck, al, want] of [["kga1-lang=tr", "ru-RU", "/tr"], ["kga1-lang=ru", "de-DE", "/ru"],
      ["kga1-lang=xx", "ru-RU", "/ru"], ["kga1-lang=", "de-DE", "/en"]]) {
      assert.strictEqual((await req("GET", "/", { cookie: ck, al })).headers.get("location"), want,
        "«/» при " + ck + " + " + al + " → " + want);
      assert.strictEqual((await req("GET", "/demo", { cookie: ck, al })).headers.get("location"), "/demo" + want,
        "/demo при " + ck + " + " + al + " → /demo" + want);
    }
    assert.ok(/Cookie/i.test((await req("GET", "/demo")).headers.get("vary") || ""),
      "/demo варьируется и по Cookie: ответ зависит от сохранённого языка");

    const anon = await req("GET", "/ru");
    assert.strictEqual(anon.status, 200, "/ru — русская витрина");
    assert.ok(anon.text.includes('data-i="hero_h1"'), "витрина на /ru");
    assert.ok(!anon.text.includes("===DATA==="), "лендинг не тянет приложение");
    assert.ok(anon.text.includes('<html lang="ru"'), "/ru — русский документ");
    assert.ok(anon.text.includes('rel="canonical" href="https://learn.kg/ru"'), "/ru canonical на себя");
    const etag = anon.headers.get("etag");
    assert.ok(etag, "у витрины есть ETag");
    assert.strictEqual((await req("GET", "/ru", { etag })).status, 304, "повторный запрос с If-None-Match — 304");
    assert.strictEqual((await req("GET", "/ru", { etag: "W/" + etag })).status, 304, "слабый валидатор от прокси тоже даёт 304");
    assert.strictEqual(anon.headers.get("content-encoding"), "gzip", "витрина отдаётся gzip'ом");
    assert.ok(/accept-encoding/i.test(anon.headers.get("vary") || ""), "Vary: Accept-Encoding при сжатии");
    assert.ok(/max-age=300/.test(anon.headers.get("cache-control") || ""), "/ru кэшируется как языковые варианты");
    for (const v of ["ru", "en", "tr"]) assertHreflangs((await req("GET", "/" + v)).text, "", "/" + v);
    // URL авторитетен: на серверном языковом варианте интерфейс равен языку страницы,
    // что бы ни лежало в сохранённом выборе — иначе адрес /en показывал бы русский текст
    for (const v of ["ru", "en", "tr"]) {
      const body = (await req("GET", "/" + v)).text;
      assert.ok(body.includes('data-srv-lang="' + v + '"'), "/" + v + " помечен как серверный вариант");
      const lm = body.match(/\/\* ===LANDING-I18N=== \*\/([\s\S]*?)\/\* ===\/LANDING-I18N=== \*\//);
      assert.ok(lm, "словарь витрины в отдаче найден");
      const lsb = {
        document: { documentElement: { lang: v, dataset: { srvLang: v } } },
        navigator: { language: "de-DE" },
        localStorage: { getItem: () => "ru", setItem() {} }, // сохранён русский
      };
      vm.createContext(lsb);
      vm.runInContext(lm[1] + ";this.landingLang=landingLang;", lsb);
      assert.strictEqual(lsb.landingLang(), v, "/" + v + ": язык страницы важнее сохранённого выбора");
    }
    // --- Блог по канону: индекс /blog/<lang> и статьи /blog/<slug>/<lang> ---
    // Разметка Article нужна не «для галочки»: контентная аналитика Метрики цепляется
    // именно за неё (articleBody, автор, рубрика), а до блога цепляться было не за что.
    for (const [al, want] of [["ru", "/blog/ru"], ["tr-TR", "/blog/tr"], ["ky", "/blog/ru"], ["fr", "/blog/en"]]) {
      const rb = await req("GET", "/blog", { al });
      assert.strictEqual(rb.status, 301, "/blog — редирект по языку");
      assert.strictEqual(rb.headers.get("location"), want, "/blog при " + al + " → " + want);
      assert.ok(/no-store/.test(rb.headers.get("cache-control") || ""), "негоциирующий /blog не кэшируется");
    }
    assert.strictEqual((await req("GET", "/blog", { cookie: "kga1-lang=tr", al: "ru" })).headers.get("location"), "/blog/tr",
      "сохранённый язык важнее браузерного и для блога");
    for (const SLUG of ["kak-ustroen-trenazher", "pochemu-regulyarno", "kyrgyzskiy-alfavit",
      "slozhno-li-vyuchit-kyrgyzskiy", "kyrgyzskiy-kazahskiy-turetskiy", "skolko-vremeni-uchit-kyrgyzskiy", "gostestirovanie-kak-podgotovitsya"]) {
    for (const l of ["ru", "en", "tr"]) {
      const idx = await req("GET", "/blog/" + l);
      assert.strictEqual(idx.status, 200, "/blog/" + l + " публичен");
      assert.ok(idx.text.includes('<html lang="' + l + '"'), "/blog/" + l + " — документ lang=" + l);
      assert.ok(idx.text.includes('data-srv-lang="' + l + '"'), "/blog/" + l + ": адрес авторитетен для языка");
      assert.ok(idx.text.includes('rel="canonical" href="https://learn.kg/blog/' + l + '"'), "/blog/" + l + " canonical на себя");
      assertHreflangs(idx.text, "/blog", "/blog/" + l);
      assert.ok(idx.text.includes("/blog/" + SLUG + "/" + l), "индекс ведёт на статью того же языка");
      assert.strictEqual((await req("GET", "/blog/" + l + "/")).status, 301, "/blog/" + l + "/ канонизируется");

      const art = await req("GET", "/blog/" + SLUG + "/" + l);
      assert.strictEqual(art.status, 200, "статья на " + l + " публична");
      assert.ok(art.text.includes('<html lang="' + l + '"'), "статья — документ lang=" + l);
      assert.ok(art.text.includes('rel="canonical" href="https://learn.kg/blog/' + SLUG + "/" + l + '"'), "статья canonical на себя");
      assertHreflangs(art.text, "/blog/" + SLUG, "статья " + l);
      assert.ok(art.text.includes('<base href="/">'), "страница глубины 3 несёт base href");
      assert.ok(/mc\.yandex\.ru/.test(art.text) && art.text.includes("kga1-consent-v2"), "Метрика на статье — по согласию");
      assert.strictEqual((await req("GET", "/blog/" + SLUG + "/" + l + "/")).status, 301, "слеш у статьи канонизируется");
      // ПРЯМАЯ проверка разметки: граф парсится, это BlogPosting с телом статьи
      const blocks = [...art.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const post = blocks.flatMap((b) => b["@graph"] || [b]).find((x) => x["@type"] === "BlogPosting");
      assert.ok(post, "в графе статьи есть BlogPosting");
      for (const f of ["headline", "description", "articleBody", "author", "publisher", "datePublished", "dateModified", "articleSection", "inLanguage", "mainEntityOfPage"])
        assert.ok(post[f], "BlogPosting несёт " + f + " (" + l + ")");
      assert.ok(post.articleBody.length > 500, "articleBody — полный текст статьи, " + post.articleBody.length + " символов (" + l + ")");
      assert.strictEqual(post.inLanguage, l, "язык статьи в разметке совпадает с вариантом");
      assert.ok(post.wordCount > 100, "wordCount проставлен");
      // текст статьи реально на странице, а не только в разметке
      assert.ok(art.text.includes(post.headline.slice(0, 30)), "заголовок виден в теле страницы");
    }
    }
    assert.strictEqual((await req("GET", "/blog/net-takoy-stati/ru")).status, 404, "несуществующая статья — 404");
    assert.strictEqual((await req("GET", "/blog/kak-ustroen-trenazher/xx")).status, 404, "неизвестный язык статьи — 404");
    // иллюстрации: рисованные inline-SVG, без единого внешнего запроса
    for (const l of ["ru", "en", "tr"]) {
      const art = (await req("GET", "/blog/kak-ustroen-trenazher/" + l)).text;
      const svgs = art.match(/<svg[\s\S]*?<\/svg>/g) || [];
      assert.ok(svgs.length >= 4, "в статье " + l + " есть иллюстрации: " + svgs.length);
      for (const sv of svgs) assert.ok(/<title>/.test(sv), "у иллюстрации есть подпись для скринридера");
      assert.ok(!/<img[\s>]/.test(art), "картинок-файлов нет — только встроенные svg (" + l + ")");
      for (const sv of svgs) assert.ok(!/https?:|xlink:href/.test(sv), "внутри svg нет внешних ссылок (" + l + ")");
    }
    // Продакт-плейсменты: с любой страницы блога до продукта один клик
    for (const l of ["ru", "en", "tr"]) {
      const idx = (await req("GET", "/blog/" + l)).text;
      assert.ok(idx.includes('class="topcta" href="/demo/' + l + '"'), "шапка индекса /blog/" + l + " несёт кнопку демо");
      const art = (await req("GET", "/blog/kak-ustroen-trenazher/" + l)).text;
      assert.ok(art.includes('class="topcta" href="/demo/' + l + '"'), "шапка статьи несёт кнопку демо (" + l + ")");
      const wa = art.match(/https:\/\/wa\.me\/996505854856\?text=[^"]+/g) || [];
      assert.ok(wa.length >= 2, "врезка и финал зовут написать Алтынай: " + wa.length + " (" + l + ")");
      assert.ok(art.includes('class="callout"'), "мотивирующая врезка присутствует (" + l + ")");
      assert.ok((art.match(/class="cta"/g) || []).length >= 1 && (art.match(/class="cta2"/g) || []).length >= 2,
        "финальная карточка: кнопки демо и WhatsApp (" + l + ")");
    }
    // Источники: в конце каждой статьи — список литературы, и он же в разметке citation
    for (const SLUG2 of ["kak-ustroen-trenazher", "pochemu-regulyarno", "kyrgyzskiy-alfavit",
      "slozhno-li-vyuchit-kyrgyzskiy", "kyrgyzskiy-kazahskiy-turetskiy", "skolko-vremeni-uchit-kyrgyzskiy", "gostestirovanie-kak-podgotovitsya"]) {
      for (const l of ["ru", "en", "tr"]) {
        const art = (await req("GET", "/blog/" + SLUG2 + "/" + l)).text;
        // перелинковка воронки: из КАЖДОЙ статьи есть путь и к покупке (WhatsApp),
        // и к прохождению теста уровня — оба на языке статьи
        assert.ok(art.includes('href="/test/' + l + '"'), SLUG2 + "/" + l + ": финальная карточка ведёт на тест уровня");
        assert.ok((art.match(/https:\/\/wa\.me\/996505854856\?text=/g) || []).length >= 2,
          SLUG2 + "/" + l + ": статья зовёт написать Алтынай");
        assert.ok(art.includes('class="refs"'), SLUG2 + "/" + l + ": блок источников присутствует");
        const items = (art.match(/<li>[^<]*\(\d{4}\)/g) || []).length;
        assert.ok(items >= 5, SLUG2 + "/" + l + ": источников не меньше пяти: " + items);
        const lb = [...art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
        const post2 = lb.flatMap((x) => x["@graph"] || [x]).find((x) => x["@type"] === "BlogPosting");
        assert.ok(Array.isArray(post2.citation) && post2.citation.length >= 5, SLUG2 + "/" + l + ": citation в разметке");
        for (const c of post2.citation) assert.ok(/^https?:\/\//.test(c.url), "у цитаты есть URL");
      }
    }
    // Перелинковка: у каждой статьи блок «Читайте также» со ссылками своего языка
    for (const l of ["ru", "en", "tr"]) {
      const art = (await req("GET", "/blog/kyrgyzskiy-alfavit/" + l)).text;
      assert.ok(art.includes("/blog/slozhno-li-vyuchit-kyrgyzskiy/" + l), "алфавит ведёт на «сложность» того же языка (" + l + ")");
    }
    // Снятые статьи (материалы официального тестирования, решение владельца 30.10.2026) →
    // 301 на статью о подготовке того же языка; хвост запроса сохраняется; страниц больше нет
    for (const old of ["/blog/voprosy-zhazuu-a1", "/blog/kyrgyztest-kak-podgotovitsya"]) {
      for (const l of ["ru", "en", "tr"]) {
        const r = await req("GET", old + "/" + l + "?utm_source=x");
        assert.strictEqual(r.status, 301, old + "/" + l + " — 301");
        assert.strictEqual(r.headers.get("location"), "/blog/gostestirovanie-kak-podgotovitsya/" + l + "?utm_source=x", old + "/" + l + " → новая статья того же языка");
      }
      const bare = await req("GET", old, { al: "tr" });
      assert.strictEqual(bare.headers.get("location"), "/blog/gostestirovanie-kak-podgotovitsya/tr", old + " голый → по языку");
      assert.ok(/no-store/.test(bare.headers.get("cache-control") || ""), "негоциирующий редирект не кэшируется");
    }
    for (const og of ["/og/voprosy-zhazuu-a1-ru.png", "/og/kyrgyztest-kak-podgotovitsya-tr.png"]) {
      const r = await req("GET", og);
      assert.ok(r.status === 301 && r.headers.get("location") === "/og.png", og + " → 301 на общее превью, не 404");
    }
    const smMoved = (await req("GET", "/sitemap.xml")).text;
    assert.ok(!/voprosy-zhazuu-a1|kyrgyztest-kak-podgotovitsya/.test(smMoved) && smMoved.includes("/blog/gostestirovanie-kak-podgotovitsya/ru"),
      "в sitemap только новая статья, снятых адресов нет");
    // Инлайн-анкоры ((текст|/путь)) из JSON статей рендерятся ссылками на тест уровня,
    // а в articleBody разметки маркеры зачищены до текста анкора
    for (const SLUG3 of ["gostestirovanie-kak-podgotovitsya", "skolko-vremeni-uchit-kyrgyzskiy"]) {
      for (const l of ["ru", "en", "tr"]) {
        const art = (await req("GET", "/blog/" + SLUG3 + "/" + l)).text;
        assert.ok(art.includes('href="/test/' + l + '"'), SLUG3 + "/" + l + " ведёт на тест уровня своего языка");
        assert.ok(!art.includes("(("), SLUG3 + "/" + l + ": маркеры анкоров не протекли в HTML");
        const lb3 = [...art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
        const post3 = lb3.flatMap((x) => x["@graph"] || [x]).find((x) => x["@type"] === "BlogPosting");
        assert.ok(!post3.articleBody.includes("(("), SLUG3 + "/" + l + ": articleBody без маркеров анкоров");
      }
    }
    /* Страницы-ответы «X по-кыргызски» (/slovo/<slug>/<lang>): проверяется не наличие
       страницы, а что механизм собрал её из ДАННЫХ — каждая фраза реестра доехала в HTML
       со своим переводом, разметка полная, ссылки ведут в существующие разделы. Перебор
       всех слов × 3 языка: механизм параметризован набором, «типовое» слово дефект в
       одном языке не поймало бы. */
    {
      const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "words", "words.json"), "utf8"));
      assert.ok(W.words.length >= 6, "ожидались страницы-ответы (сейчас " + W.words.length + ")");
      const vocab = new Map(); // id → фраза курса (источник истины для текстов)
      {
        const html = require("../server/appshell").buildAppHtml();
        const m = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
        const sb = { console };
        vm.createContext(sb);
        vm.runInContext(m[1] + "; this.CONTENT=CONTENT;", sb);
        for (const [mod, d] of Object.entries(sb.CONTENT)) for (const v of (d.vocab || [])) if (!v.ref) vocab.set(v.id, { mod, ...v });
      }
      for (const w of W.words) for (const l of ["ru", "en", "tr"]) {
        const u = "/slovo/" + w.slug + "/" + l, at = u + ": ";
        const r = await req("GET", u);
        assert.strictEqual(r.status, 200, at + "отвечает " + r.status);
        const h = r.text;
        assert.ok(h.includes("<h1>" + esc(w.titles[l]) + "</h1>"), at + "h1 не из реестра");
        // «Другие слова»: ссылки на ВСЕ остальные слова своего языка с титулом-анкором, на себя — нет
        {
          const ow = h.match(/<ul class="kafter owords">([\s\S]*?)<\/ul>/);
          assert.ok(ow, at + "нет блока «другие слова»");
          const links = [...ow[1].matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)].map((x) => [x[1], x[2]]);
          assert.deepStrictEqual(links, W.words.filter((o) => o !== w).map((o) => ["/slovo/" + o.slug + "/" + l, esc(o.titles[l])]),
            at + "блок «другие слова» разошёлся с реестром");
          assert.ok(h.includes("<h2>" + esc(W.ui[l].otherWords) + "</h2>"), at + "заголовок блока «другие слова» не из ui");
        }
        assert.ok(h.includes(esc(w.leads[l])), at + "прямой ответ (lead) отсутствует");
        assert.ok(h.includes(esc(w.notes[l])), at + "заметка о произношении отсутствует");
        // каждая фраза реестра — в HTML, с кыргызским текстом и переводом своего языка
        for (const id of [w.main].concat(w.variants || [], w.replies || [], w.examples || [])) {
          const v = vocab.get(id);
          assert.ok(v, at + "фразы " + id + " нет в курсе");
          assert.ok(h.includes(esc(v.ky)), at + "нет кыргызского текста " + id);
          assert.ok(h.includes(esc(v[l])), at + "нет перевода " + id + " на " + l);
          // кнопка рендерится только если mp3 существует (в тестовом /data их часть) —
          // проверяем не наличие кнопки, а что чужих озвучек на странице нет
        }
        // каждая кнопка озвучки на странице ведёт на фразу ЭТОЙ страницы (чужих нет)
        const own = new Set([w.main].concat(w.variants || [], w.replies || [], w.examples || [])
          .map((id) => vocab.get(id).mod + "/" + id));
        for (const b of [...h.matchAll(/data-a="([^"]+)"/g)].map((m) => m[1]))
          assert.ok(own.has(b), at + "кнопка озвучки чужой фразы: " + b);
        const graph = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((m) => JSON.parse(m[1])["@graph"] || []);
        for (const type of ["WebPage", "FAQPage", "BreadcrumbList"])
          assert.ok(graph.some((x) => x["@type"] === type), at + "нет узла " + type);
        const faq = graph.find((x) => x["@type"] === "FAQPage");
        assert.strictEqual(faq.mainEntity.length, w.faq[l].length, at + "число вопросов разошлось с данными");
        for (const f of w.faq[l]) assert.ok(h.includes(esc(f.q)) && h.includes(esc(f.a)), at + "пара FAQ не видна: " + f.q);
        // внутренние ссылки ведут в существующие разделы своего языка
        assert.ok(h.includes('href="/razgovornik/' + l + "#" + w.rzAnchor + '"'), at + "нет ссылки в раздел разговорника");
        assert.ok(h.includes('href="/perevodchik/' + l + '"'), at + "нет ссылки на переводчик");
        assert.ok(h.includes('href="/blog/' + w.related + "/" + l + '"'), at + "нет ссылки на статью");
        // канон «адрес авторитетен»: переключатель языков ведёт на соседний вариант ЭТОЙ
        // страницы, а не в общий разговорник (клик по EN уводил читателя слова прочь)
        for (const l2 of ["ru", "en", "tr"])
          assert.ok(h.includes('<a href="/slovo/' + w.slug + "/" + l2 + '"'), at + "переключатель языков не ведёт на " + l2 + "-вариант слова");
        assert.strictEqual((await req("GET", "/blog/" + w.related + "/" + l)).status, 200, at + "related-статья 404");
        // heads — переименование заголовка блока данными: своё название видно, общее
        // не осталось рядом (иначе «Что отвечают» над числами 6–10 жило бы дальше)
        for (const [k, head] of Object.entries((w.heads || {})[l] || {})) {
          assert.ok(h.includes("<h2>" + esc(head) + "</h2>"), at + "заголовок блока " + k + " не из heads: " + head);
          assert.ok(!h.includes("<h2>" + esc(W.ui[l][k]) + "</h2>"), at + "общий заголовок блока " + k + " остался рядом с heads");
        }
      }
      /* Сниппет НЕ договаривает ответ. Замер 15.09.2026 (Google, 28 дней) по всему
         семейству /slovo/*: 4800 показов, 22 клика, CTR 0,46% на позициях 5–10 —
         /slovo/mama-papa/en стоит 3,7 и не получил ни одного клика. Причина в данных:
         и титул, и description выдавали слово-ответ целиком, поэтому запрос
         закрывался прямо в выдаче. Правка 15.09: описания перестали перечислять ответ
         и обещают то, что даёт только клик (озвучка носителя, что отвечают, какая
         форма когда). Титулы НЕ тронуты — они держат позиции в Яндексе, и менять
         за один замер две переменные нельзя. Предыдущее решение (04.09: перечислить
         числа в description под кластер «kırgızca sayılar okunuşu») отменено этим
         замером: за 28 дней оно дало 2156 показов и 7 кликов. */
      {
        const t = (await req("GET", "/slovo/chisla/tr")).text;
        assert.ok(t.includes("<title>Kırgızca sayılar 1'den 10'a: okunuşu ve sesli · learn.kg</title>"),
          "/slovo/chisla/tr: титул под интент «okunuşu»");
        const dsc = (t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
        assert.ok(/sayılar/i.test(dsc), "/slovo/chisla/tr: description потерял ключ «sayılar»");
        assert.ok(/sesi|sesiyle|sesli/i.test(dsc), "/slovo/chisla/tr: description не обещает озвучку");
        for (const num of ["eki", "tört", "beş", "altı", "segiz", "toguz"])
          assert.ok(!dsc.includes(num), "/slovo/chisla/tr: description снова перечисляет ответ (" + num + ")");
        for (const ky of ["жыйырма", "элүү", "жүз"])
          assert.ok(t.includes(ky), "/slovo/chisla/tr: блок счёта до 100 без " + ky);
      }
      /* То же правило — всему семейству: описание не выдаёт ответ целиком, но обещает
         голос носителя. «Ответ целиком» проверяется по кыргызским словам страницы:
         главное слово и его варианты в description больше не стоят. */
      {
        const listen = { ru: /голосом носителя|озвучкой носителя/, en: /native[- ]speaker/i, tr: /ana dili konuşurunun/ };
        for (const w of W.words) for (const l of ["ru", "en", "tr"]) {
          const at = "/slovo/" + w.slug + "/" + l + ": ";
          const dsc = w.descs[l];
          assert.ok(listen[l].test(dsc), at + "description не обещает голос носителя");
          for (const id of [w.main].concat(w.variants || [])) {
            const ky = vocab.get(id).ky.replace(/[?!.,]/g, "").trim();
            // по границам слова, а не подстрокой: «апа» живёт внутри «папа» русского
            // заголовка, и наивный includes ловил бы собственный перевод как ответ.
            // Флаг i обязателен: в курсе фраза хранится репликой с заглавной («Рахмат!»,
            // «Саламатсызбы!», «Кандайсыз?» — 6 слов из 10), а в описании ответ пишется
            // строчными посреди предложения. Без i гейт искал «Рахмат» и пропускал
            // «…по-кыргызски — рахмат» — ровно тот откат, ради которого он написан
            // (дыру нашёл адверсарный валидатор мутационным тестом 17.09.2026).
            const re = new RegExp("(^|[^\\p{L}])" + ky.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}]|$)", "iu");
            assert.ok(!re.test(dsc), at + "description договаривает ответ: " + ky);
          }
        }
      }
      // якоря разделов разговорника, на которые ссылаются страницы, реально существуют
      const rz = (await req("GET", "/razgovornik/ru")).text;
      for (const w of W.words) assert.ok(rz.includes('id="' + w.rzAnchor + '"'), "разговорник: нет якоря " + w.rzAnchor);
      // голый адрес страницы-ответа негоциируется 301 (канон локализованных страниц)
      assert.strictEqual((await req("GET", "/slovo/" + W.words[0].slug)).status, 301, "голый /slovo/<slug> → 301");
    }
    /* Хаб слов /slovo — страница-список всех «X по-кыргызски». Проверяется канон
       локализованной страницы (три варианта, canonical на себя, полный hreflang, sitemap,
       негоциация голого адреса) и то, что список СОБРАН ИЗ ДАННЫХ: карточка каждого слова
       ведёт на его страницу, несёт её титул и дословное начало её же lead — сочинённый или
       отставший от реестра текст здесь падает. Плюс перелинковка в обе стороны. */
    {
      const W = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "words", "words.json"), "utf8"));
      const HUB = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "words", "hub.json"), "utf8"));
      const sm = (await req("GET", "/sitemap.xml")).text;
      for (const l of ["ru", "en", "tr"]) {
        const at = "/slovo/" + l + ": ";
        const r = await req("GET", "/slovo/" + l);
        assert.strictEqual(r.status, 200, at + "отвечает " + r.status);
        const h = r.text;
        assert.ok(h.includes('<html lang="' + l + '" data-srv-lang="' + l + '"'), at + "язык страницы = язык адреса");
        assert.ok(h.includes('rel="canonical" href="https://learn.kg/slovo/' + l + '"'), at + "canonical на себя");
        assertHreflangs(h, "/slovo", at);
        assert.ok(sm.includes("<loc>https://learn.kg/slovo/" + l + "</loc>"), at + "в sitemap");
        assert.ok(h.includes(esc(HUB.ui[l].h1)), at + "h1 хаба не из данных");
        // карточка каждого слова: ссылка → титул страницы → дословное начало её lead
        for (const w of W.words) {
          const m = new RegExp('<a class="post" href="/slovo/' + w.slug + "/" + l + '">([\\s\\S]*?)</a>').exec(h);
          assert.ok(m, at + "нет карточки слова " + w.slug);
          const text = m[1].replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
            .replace(/\s+/g, " ").trim();
          assert.ok(text.startsWith(w.titles[l]), at + w.slug + ": карточка не начинается титулом страницы");
          const tail = text.slice(w.titles[l].length).trim();
          assert.ok(tail.length >= 20 && w.leads[l].startsWith(tail),
            at + w.slug + ": текст карточки не является дословным началом lead страницы");
        }
        // ItemList: весь реестр, по порядку, с адресами языковых вариантов
        const graph = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((x) => JSON.parse(x[1])["@graph"] || []);
        const list = graph.find((x) => x["@type"] === "ItemList");
        assert.ok(list, at + "нет узла ItemList");
        assert.strictEqual(list.numberOfItems, W.words.length, at + "numberOfItems разошёлся с реестром");
        assert.deepStrictEqual(list.itemListElement.map((x) => [x.position, x.name, x.url]),
          W.words.map((w, i) => [i + 1, w.titles[l], "https://learn.kg/slovo/" + w.slug + "/" + l]),
          at + "список хаба разошёлся с реестром слов");
        // ссылки: футер сайта и обратная дорога со страницы-ответа (крошка + карточка)
        assert.ok(h.includes('<footer class="sfoot">') && h.includes('href="/razgovornik/' + l + '"'),
          at + "футер и ссылка на разговорник");
        const word = (await req("GET", "/slovo/" + W.words[0].slug + "/" + l)).text;
        assert.ok(word.includes('href="/slovo/' + l + '"'), at + "со страницы-ответа нет ссылки на хаб");
        const crumbs = [...word.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((x) => JSON.parse(x[1])["@graph"] || []).find((x) => x["@type"] === "BreadcrumbList");
        assert.ok(crumbs.itemListElement.some((x) => x.item === "https://learn.kg/slovo/" + l),
          at + "хаб не попал в крошки страницы-ответа");
      }
      // голый /slovo негоциируется и НЕ съедает страницы-ответы (порядок маршрутов)
      const bare = await req("GET", "/slovo");
      assert.strictEqual(bare.status, 301, "голый /slovo → 301");
      assert.strictEqual(bare.headers.get("cache-control"), "no-store", "негоциация /slovo не кэшируется");
      assert.ok(/accept-language/i.test(bare.headers.get("vary") || ""), "/slovo варьируется по Accept-Language");
      assert.strictEqual((await req("GET", "/slovo", { al: "ru" })).headers.get("location"), "/slovo/ru", "/slovo по ru");
      assert.strictEqual((await req("GET", "/slovo/")).status, 301, "/slovo/ канонизируется");
      assert.strictEqual((await req("GET", "/slovo/" + W.words[0].slug + "/ru")).status, 200,
        "страница-ответ жива при существующем хабе");
      assert.strictEqual((await req("GET", "/slovo/net-takogo-slova/ru")).status, 404, "несуществующее слово — 404");
    }
    /* Security-заголовки — на каждом ответе, а не на «страницах»: проверяются три разных
       ветки отдачи (HTML-страница, JSON API, статика). Заголовки ставятся один раз в начале
       обработчика, и этот перебор ловит ветку, которая пишет свои заголовки мимо него. */
    {
      for (const u of ["/slovo/ru", "/api/version", "/icon-192.png", "/sitemap.xml", "/sw.js"]) {
        const r = await srv.rawGet(u, {});
        const at = u + ": ";
        assert.strictEqual(r.status, 200, at + "отвечает " + r.status);
        assert.strictEqual(r.headers["x-content-type-options"], "nosniff", at + "нет nosniff");
        assert.strictEqual(r.headers["referrer-policy"], "strict-origin-when-cross-origin", at + "нет Referrer-Policy");
        assert.strictEqual(r.headers["x-frame-options"], "SAMEORIGIN", at + "нет X-Frame-Options");
      }
      // SAMEORIGIN, а не DENY: «Методика» встраивается в тренажёр своим же iframe
      assert.ok(M0_SRC.includes("metodika?embed=1"), "iframe методики жив — DENY сломал бы его");
    }
    /* Сжатие: origin отдаёт brotli и gzip по Accept-Encoding (Cloudflare зоны — DNS-only,
       edge не сжимает за нас). Проверяются реальные байты и заголовки, поэтому запрос —
       голым http-клиентом: fetch разжимает ответ сам и прячет Content-Encoding. */
    {
      const zlib = require("zlib");
      const plain = await srv.rawGet("/slovo/ru", { "Accept-Encoding": "identity" });
      assert.ok(!plain.headers["content-encoding"], "identity — без сжатия");
      const br = await srv.rawGet("/slovo/ru", { "Accept-Encoding": "br, gzip" });
      assert.strictEqual(br.headers["content-encoding"], "br", "brotli предпочтительнее gzip");
      assert.deepStrictEqual(zlib.brotliDecompressSync(br.body), plain.body, "brotli разжимается в то же тело");
      assert.ok(br.body.length < plain.body.length, "brotli меньше исходника");
      const gz = await srv.rawGet("/slovo/ru", { "Accept-Encoding": "gzip" });
      assert.strictEqual(gz.headers["content-encoding"], "gzip", "без br отдаём gzip");
      assert.ok(br.body.length < gz.body.length, "brotli меньше gzip: " + br.body.length + " vs " + gz.body.length);
      // q=0 — способ браузера отключить алгоритм; ответ обязан это уважать
      const noBr = await srv.rawGet("/slovo/ru", { "Accept-Encoding": "br;q=0, gzip" });
      assert.strictEqual(noBr.headers["content-encoding"], "gzip", "br;q=0 — не brotli");
      // ETag зависит от кодировки, иначе общий кэш подсунет чужие байты
      assert.notStrictEqual(br.headers.etag, gz.headers.etag, "ETag brotli и gzip различаются");
      assert.ok(/accept-encoding/i.test(br.headers.vary || ""), "Vary: Accept-Encoding");
      // ревалидация работает в каждой кодировке
      assert.strictEqual((await srv.rawGet("/slovo/ru", { "Accept-Encoding": "br", "If-None-Match": br.headers.etag })).status,
        304, "If-None-Match brotli → 304");
      assert.strictEqual((await srv.rawGet("/slovo/ru", { "Accept-Encoding": "gzip", "If-None-Match": br.headers.etag })).status,
        200, "ETag brotli при запросе gzip — не 304: тело другой кодировки");
      assert.strictEqual((await srv.rawGet("/slovo/ru", { "Accept-Encoding": "identity", "If-None-Match": br.headers.etag })).status,
        200, "ETag brotli при запросе без сжатия — не 304");
      // тот же договор — у персональной оболочки приложения (ленивая упаковка варианта)
      const shell = await srv.rawGet("/", { "Accept-Encoding": "br", Authorization: ILIM });
      assert.strictEqual(shell.headers["content-encoding"], "br", "оболочка тренажёра тоже brotli");
      assert.ok(zlib.brotliDecompressSync(shell.body).toString("utf8").includes("===DATA==="),
        "оболочка разжимается в страницу тренажёра");
    }
    /* og:image статьи: по умолчанию общий баннер, поле og статьи даёт свою картинку.
       Гейт проверяет не поле, а результат: адрес из og:image ОБЯЗАН отдаваться сервером —
       появится своя картинка, и проверка сама начнёт стеречь её файл. */
    {
      const posts = fs.readdirSync(path.join(__dirname, "..", "app", "blog")).filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "blog", f), "utf8")));
      const seen = new Set();
      for (const p2 of posts) for (const l of ["ru", "en", "tr"].filter((x) => p2.langs[x])) {
        const at = "/blog/" + p2.slug + "/" + l + ": ";
        const h = (await req("GET", "/blog/" + p2.slug + "/" + l)).text;
        const img = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
        assert.ok(img, at + "нет og:image");
        const ogName = p2.og && typeof p2.og === "object" ? p2.og[l] : p2.og;
        assert.strictEqual(img, ogName ? "https://learn.kg/og/" + ogName : "https://learn.kg/og.png",
          at + "og:image не соответствует полю og статьи (на языке страницы)");
        // картинка BlogPosting — та же, что og:image: аудит 25.09 нашёл общий og.png
        // в разметке всех 54 статей при своих баннерах в og
        const ldPost = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((m) => JSON.parse(m[1])["@graph"] || []).find((x) => x["@type"] === "BlogPosting");
        assert.strictEqual(ldPost && ldPost.image, img, at + "BlogPosting.image расходится с og:image");
        seen.add(img);
      }
      for (const img of seen) {
        const r = await req("GET", img.replace("https://learn.kg", ""));
        assert.strictEqual(r.status, 200, "og:image " + img + " не отдаётся сервером");
      }
    }
    /* Таблицы статей (поле t у блока): «состав артефакта ≠ поведение» — проверяется не
       наличие тега, а что КАЖДАЯ ячейка данных доехала и в видимый HTML, и в articleBody
       (контентная аналитика и поисковик читают именно его). Перебор всех статей × 3 языка. */
    {
      const withTables = fs.readdirSync(path.join(__dirname, "..", "app", "blog"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "blog", f), "utf8")))
        .filter((p) => ["ru", "en", "tr"].some((l) => p.langs[l].blocks.some((b) => b.t)));
      assert.ok(withTables.length >= 1, "ожидались статьи с таблицами");
      for (const p of withTables) for (const l of ["ru", "en", "tr"]) {
        const at = "/blog/" + p.slug + "/" + l + ": ";
        const art = (await req("GET", "/blog/" + p.slug + "/" + l)).text;
        const post = [...art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((m) => JSON.parse(m[1])["@graph"] || []).find((x) => x["@type"] === "BlogPosting");
        for (const b of p.langs[l].blocks.filter((x) => x.t)) {
          assert.ok(art.includes("<table>"), at + "таблица не отрендерилась");
          for (const cell of b.t.head.concat(b.t.rows.flat())) {
            assert.ok(art.includes(esc(cell)), at + "ячейка отсутствует в HTML: " + cell.slice(0, 40));
            assert.ok(post.articleBody.includes(cell), at + "ячейка не попала в articleBody: " + cell.slice(0, 40));
          }
        }
      }
    }
    /* FAQ статей: разметка FAQPage и видимая секция — ОДНА форма. Google снимает
       расширенный сниппет, если размеченного вопроса нет в видимом тексте, поэтому
       проверяется паритет: каждая пара из JSON присутствует и в LD, и в HTML, и в
       articleBody. Перебор — по всем статьям с faq и всем трём языкам (механизм
       параметризован набором: «типовая» статья дефект в одном языке не поймала бы). */
    {
      const withFaq = fs.readdirSync(path.join(__dirname, "..", "app", "blog"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "blog", f), "utf8")))
        .filter((p) => p.faq);
      assert.ok(withFaq.length >= 4, "ожидались статьи с FAQ (сейчас " + withFaq.length + ")");
      for (const p of withFaq) for (const l of ["ru", "en", "tr"]) {
        const at = "/blog/" + p.slug + "/" + l + ": ";
        const art = (await req("GET", "/blog/" + p.slug + "/" + l)).text;
        assert.ok(art.includes('class="faq"'), at + "нет видимой секции FAQ");
        const graph = [...art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
          .flatMap((m) => JSON.parse(m[1])["@graph"] || []);
        const faqNode = graph.find((x) => x["@type"] === "FAQPage");
        assert.ok(faqNode, at + "нет узла FAQPage в LD");
        assert.strictEqual(faqNode.mainEntity.length, p.faq[l].length, at + "число вопросов в LD разошлось с данными");
        const post = graph.find((x) => x["@type"] === "BlogPosting");
        // ответ FAQ несёт инлайн-анкоры ((текст|/путь)) наравне с абзацем статьи:
        // в HTML — ссылка, в LD и articleBody — только текст анкора
        const plain = (s) => String(s).replace(/\(\(([^|()]+)\|(\/[a-z0-9/_#-]+)\)\)/g, "$1");
        const linksOf = (s) => [...String(s).matchAll(/\(\(([^|()]+)\|(\/[a-z0-9/_#-]+)\)\)/g)];
        for (const [i, f] of p.faq[l].entries()) {
          assert.strictEqual(faqNode.mainEntity[i].name, f.q, at + "вопрос " + i + " в LD не тот");
          assert.strictEqual(faqNode.mainEntity[i].acceptedAnswer.text, plain(f.a), at + "ответ " + i + " в LD не тот");
          assert.ok(art.includes(esc(f.q)), at + "вопрос отсутствует в видимом тексте: " + f.q);
          assert.ok(art.includes(esc(plain(f.a))) || linksOf(f.a).length, at + "ответ отсутствует в видимом тексте: " + f.q);
          assert.ok(post.articleBody.includes(f.q) && post.articleBody.includes(plain(f.a)),
            at + "пара FAQ не попала в articleBody: " + f.q);
          for (const [, anchor, href] of linksOf(f.a))
            assert.ok(art.includes('<a href="' + href + '">' + esc(anchor) + "</a>"),
              at + "анкор ответа не стал ссылкой: " + anchor + " → " + href);
        }
        assert.ok(!art.includes("(("), at + "маркеры анкоров не протекли в HTML");
      }
    }
    /* Точные формулировки поиска в FAQ статьи о трёх языках: 468 показов / 1 клик /
       поз. 8,7 по 21 формулировке «mutually intelligible …» (GSC, замер 04.09.2026).
       Проверяется разметка FAQPage — за неё цепляется PAA, а не видимый текст. */
    {
      const art = (await req("GET", "/blog/kyrgyzskiy-kazahskiy-turetskiy/en")).text;
      const faqNode = [...art.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .flatMap((m) => JSON.parse(m[1])["@graph"] || []).find((x) => x["@type"] === "FAQPage");
      const names = faqNode.mainEntity.map((q) => q.name.toLowerCase());
      for (const need of ["are kazakh and kyrgyz mutually intelligible", "can kyrgyz speakers understand turkish",
        "are kyrgyz and turkish mutually intelligible", "is kyrgyz similar to turkish", "kyrgyz vs kazakh"])
        assert.ok(names.some((n) => n.includes(need)), "en FAQ статьи без формулировки запроса: " + need);
    }
    /* Инлайн-анкор в ответе FAQ — общий механизм и для страниц-из-данных: разговорник и
       переводчик перелинковываются текстом ответа, а не только кнопками. Проверяется живой
       HTML: каждый анкор данных стал ссылкой, маркер не протёк ни в одном языке. */
    for (const [base, ...rel] of [["/razgovornik", "razgovornik", "razgovornik.json"], ["/perevodchik", "perevodchik", "perevodchik.json"]]) {
      const D = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", ...rel), "utf8"));
      for (const l of ["ru", "en", "tr"]) {
        const h = (await req("GET", base + "/" + l)).text, at = base + "/" + l + ": ";
        assert.ok(!h.includes("(("), at + "маркеры анкоров не протекли в HTML");
        const links = [...JSON.stringify(D.ui[l].faq).matchAll(/\(\(([^|()]+)\|(\/[a-z0-9/_#-]+)\)\)/g)];
        assert.ok(links.length, at + "в FAQ нет ни одного инлайн-анкора");
        for (const [, anchor, href] of links) {
          assert.ok(h.includes('<a href="' + href + '">' + esc(anchor) + "</a>"), at + "анкор не стал ссылкой: " + anchor);
          assert.strictEqual((await req("GET", href)).status, 200, at + "анкор ведёт в никуда: " + href);
        }
      }
    }
    // единая шапка контентных страниц: бренд, разделы, подсветка текущего, «Войти»
    for (const [path0, cur] of [["/blog/ru", "/blog"], ["/razgovornik/en", "/razgovornik"],
      ["/perevodchik/tr", "/perevodchik"], ["/test/ru", null], ["/blog/kyrgyzskiy-alfavit/ru", "/blog"]]) {
      const h = (await req("GET", path0)).text;
      assert.ok(h.includes('class="shead"'), path0 + ": нет шапки сайта");
      for (const b of ["/blog", "/razgovornik", "/perevodchik"])
        assert.ok(h.includes('href="' + b + "/" + path0.split("/").pop() + '"') || h.includes('href="' + b + "/"),
          path0 + ": в шапке нет раздела " + b);
      assert.ok(h.includes('href="/login"'), path0 + ": в шапке нет «Войти»");
      assert.ok(!h.includes(">undefined<"), path0 + ": в шапке undefined — ключ словаря не найден");
      const shead = (h.match(/<header class="shead">[\s\S]*?<\/header>/) || [""])[0];
      assert.ok(/>[^<]{3,}<\/a><\/nav>/.test(shead), path0 + ": у пунктов шапки нет видимых подписей");
      if (cur) assert.ok(new RegExp('href="' + cur + '/(ru|en|tr)" aria-current="true"').test(h),
        path0 + ": текущий раздел не подсвечен");
    }
    // индекс блога ведёт и на тест уровня — акцентная карточка после групп статей;
    // заодно гард группировки: все четыре рубрики реестра присутствуют заголовками,
    // и каждая статья попала в индекс ровно один раз
    // число статей — из самих данных: новая статья = новый JSON, а не правка теста
    const BLOG_COUNT = fs.readdirSync(path.join(__dirname, "..", "app", "blog")).filter((f) => f.endsWith(".json")).length;
    for (const l of ["ru", "en", "tr"]) {
      const idx = (await req("GET", "/blog/" + l)).text;
      assert.ok(idx.includes('class="post testcard" href="/test/' + l + '"'),
        "индекс /blog/" + l + " несёт карточку теста уровня");
      assert.strictEqual((idx.match(/<ul class="posts">/g) || []).length, 4,
        "индекс /blog/" + l + ": четыре группы рубрик");
      const links = [...idx.matchAll(/class="post" href="(\/blog\/[a-z0-9-]+\/)/g)].map((m) => m[1]);
      assert.strictEqual(new Set(links).size, links.length, "индекс /blog/" + l + ": статья в группах дважды");
      assert.strictEqual(links.length, BLOG_COUNT, "индекс /blog/" + l + ": все " + BLOG_COUNT + " статей в группах");
    }
    /* Пруфы в статье (правило владельца 04.09.2026): цитата первоисточника и ссылка на него
       живут в тексте статьи, а не только в списке литературы. Проверяется отданный HTML:
       блок proof — blockquote с дословной цитатой закона и <cite> со внешней https-ссылкой;
       цитата входит в articleBody разметки BlogPosting (за неё цепляется аналитика). */
    for (const l of ["ru", "en", "tr"]) {
      const html = (await req("GET", "/blog/kyrgyzskiy-dlya-vnzh/" + l)).text;
      const proofs = [...html.matchAll(/<blockquote class="proof"[^>]*><p>([^<]+)<\/p><cite><a href="(https:\/\/[^"]+)" target="_blank" rel="noopener noreferrer">([^<]+)<\/a><\/cite><\/blockquote>/g)];
      assert.ok(proofs.length >= 8, "/blog/kyrgyzskiy-dlya-vnzh/" + l + ": пруф-цитат " + proofs.length + ", ожидалось ≥8");
      assert.ok(proofs.some((m) => m[1].includes("слова «или официальным» исключить") && /cbd\.minjust\.gov\.kg/.test(m[2])),
        l + ": ключевая норма (закон № 195) процитирована дословно со ссылкой на ЦБД Минюста");
      assert.ok(proofs.some((m) => m[1].includes("на уровне А1") && /kaktus\.media/.test(m[2])),
        l + ": слова Нацкомиссии про A1 — цитатой со ссылкой на источник");
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      const post = ld["@graph"].find((n) => n["@type"] === "BlogPosting");
      assert.ok(post.articleBody.includes("слова «или официальным» исключить"), l + ": цитата вошла в articleBody");
    }
    /* «Какой язык в Кыргызстане» (28.09.2026): статус языков — цитатой ст. 13 Конституции
       на обоих языках, цифры — из переписи 2022 (пруф Нацстаткома и три таблицы: родной
       язык, уровень владения, регионы). Разговорник — страница №1 сайта в Яндексе — ведёт
       на статью из FAQ. Проверяется отданный HTML каждого языка. */
    for (const l of ["ru", "en", "tr"]) {
      const html = (await req("GET", "/blog/yazyk-v-kyrgyzstane/" + l)).text;
      const proofs = [...html.matchAll(/<blockquote class="proof" lang="(ru|ky)"><p>([^<]+)<\/p><cite><a href="(https:\/\/[^"]+)"/g)];
      const has = (lang, text, src) => proofs.some((m) => m[1] === lang && m[2].includes(text) && src.test(m[3]));
      assert.ok(has("ru", "в качестве официального используется русский язык", /cbd\.minjust\.gov\.kg\/.*\/ru$/), l + ": ст. 13 Конституции, русский текст");
      assert.ok(has("ky", "Кыргыз тили - Кыргыз Республикасынын мамлекеттик тили", /cbd\.minjust\.gov\.kg\/.*\/kg$/), l + ": ст. 13 Конституции, кыргызский текст");
      assert.ok(has("ru", "Впервые в переписи населения 2022 года", /stat\.gov\.kg\//), l + ": перепись 2022 — пруф Нацстаткома");
      const tables = [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((m) => (m[1].match(/<tr>/g) || []).length - 1);
      assert.deepStrictEqual(tables, [3, 5, 9], l + ": таблицы родного языка (3), уровня владения (5) и регионов (9)");
      assert.ok(html.includes('href="/razgovornik/' + l + '"'), l + ": статья ведёт в разговорник");
      const rz = (await req("GET", "/razgovornik/" + l)).text;
      assert.ok(rz.includes('href="/blog/yazyk-v-kyrgyzstane/' + l + '"'), l + ": разговорник ведёт на статью о языке");
    }
    /* «Кыргыз, кыргызы, кыргызка» (25.09.2026): статья учит писать «кыргызский», и формы
       названия народа опираются на кыргызские первоисточники — Конституцию (ru и ky тексты
       статьи 51, статья 13 о госязыке) и госагентство «Кабар». Проверяется отданный HTML
       каждого языка. Решение владельца: без примеров из указов о выходе из гражданства
       (частные люди, чувствительная тема) и без формулировок «„киргизский“ — не ошибка». */
    for (const l of ["ru", "en", "tr"]) {
      const html = (await req("GET", "/blog/kyrgyzskiy-ili-kirgizskiy/" + l)).text;
      const proofs = [...html.matchAll(/<blockquote class="proof" lang="(ru|ky)"><p>([^<]+)<\/p><cite><a href="(https:\/\/[^"]+)"/g)];
      const has = (lang, text, src) => proofs.some((m) => m[1] === lang && m[2].includes(text) && src.test(m[3]));
      assert.ok(has("ru", "Кыргызский язык - государственный язык", /cbd\.minjust\.gov\.kg\/.*\/ru$/), l + ": «кыргызский» — Конституция, ст. 13");
      assert.ok(has("ru", "Кыргызы, проживающие за пределами", /cbd\.minjust\.gov\.kg\/.*\/ru$/), l + ": «кыргызы» — Конституция, русский текст");
      assert.ok(has("ky", "жашаган кыргыздар", /cbd\.minjust\.gov\.kg\/.*\/kg$/), l + ": «кыргыздар» — Конституция, кыргызский текст");
      assert.ok(has("ru", "первой кыргызкой", /kabar\.kg\//), l + ": «кыргызка» — госагентство «Кабар»");
      assert.ok(/<p>[^<]*«кыргызка»[^<]*<\/p>/.test(html), l + ": форма «кыргызка» названа в тексте раздела");
      assert.ok(!/up_no_69|гражданства Кыргызской Республики»|1958 года рождения/.test(html), l + ": примеров из указа о выходе из гражданства нет");
    }
    // Сингармонизм в иллюстрации — лингвистически верная раскладка (эталон — правило локатива М3)
    const harmSvg = (await req("GET", "/blog/kak-ustroen-trenazher/ru")).text;
    assert.ok(harmSvg.includes("а · ы · о · у") && harmSvg.includes("е · и · ө · ү"), "ряды гласных из курса");
    assert.ok(harmSvg.includes("жумуш + та") && harmSvg.includes("үй + дө"), "примеры соответствуют своим рядам");
    assert.ok(harmSvg.includes("-да / -та · -до / -то") && harmSvg.includes("-де / -те · -дө / -тө"),
      "пары аффиксов не склеены поперёк рядов");
    assert.ok(!harmSvg.includes("китеп + те"), "«китеп» (мягкий ряд) больше не стоит в твёрдой колонке");
    // витрина ведёт в блог на своём языке
    for (const [l, want] of [["ru", "/blog/ru"], ["en", "/blog/en"], ["tr", "/blog/tr"]])
      assert.ok((await req("GET", "/" + l)).text.includes('href="' + want + '"'), "/" + l + " ведёт в блог на своём языке");

    const landing = await req("GET", "/landing");
    assert.ok(/max-age=300/.test(landing.headers.get("cache-control") || ""), "отдельный /landing кэшируется как прежде");
    // вошедший на «/» получает приложение (двуликость сохранена)
    const lgc = await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } });
    const ck = (lgc.headers.get("set-cookie") || "").split(";")[0];
    const asUser = await req("GET", "/", { cookie: ck, etag });
    assert.strictEqual(asUser.status, 200, "вошедший на «/» — приложение, не редирект");
    assert.ok(asUser.text.includes("===DATA==="), "вошедший сразу видит тренажёр");
    // Страница = сборка частей app/src по манифесту (с подстановкой версии/демо-флага).
    // Ученику собирается вариант его курсов, преподавателю — весь каталог; часть,
    // выпавшая из манифеста, иначе исчезла бы из отдачи молча.
    const FULL_SHELL = M0_SRC.replace(/__APP_VERSION__|__DEMO__/g, (mm) => (mm === "__DEMO__" ? "0" : PKG_VERSION));
    assert.strictEqual((await req("GET", "/", { auth: ALT })).text, FULL_SHELL, "преподавателю отдаётся полная сборка app/src");
    assert.notStrictEqual(asUser.text, FULL_SHELL, "ученику A1 отдаётся его вариант, а не весь каталог");

    assert.ok((await req("GET", "/login")).text.includes("Кириңиз"), "форма входа на /login");
    assert.strictEqual((await req("GET", "/index.html")).status, 301, "аноним: /index.html — 301");
    assert.strictEqual((await req("GET", "/m0.html")).status, 301, "аноним: /m0.html — 301");
    assert.strictEqual((await req("GET", "/login/")).status, 301, "слеш в конце — редирект, не 401");
    assert.ok((await req("GET", "/landing")).text.includes('data-i="hero_h1"'), "витрина и по своему адресу");
    const og = await req("GET", "/og.png");
    assert.strictEqual(og.status, 200);
    assert.strictEqual(og.headers.get("content-type"), "image/png");
    assert.ok(Number(og.headers.get("content-length")) > 1000, "og.png отдаётся с Content-Length");
    assert.strictEqual((await req("GET", "/favicon.ico")).status, 200, "фавиконка публична");

    // --- PWA: манифест, service worker, иконки — публичны и корректны ---
    const mf = await req("GET", "/manifest.webmanifest");
    assert.strictEqual(mf.status, 200, "манифест публичен");
    assert.ok(/application\/manifest\+json/.test(mf.headers.get("content-type") || ""), "манифест с правильным типом");
    const mfj = JSON.parse(mf.text);
    assert.strictEqual(mfj.start_url, "/", "start_url — корень");
    assert.strictEqual(mfj.icons.length, 3, "в манифесте 3 иконки");
    const sw = await req("GET", "/sw.js");
    assert.strictEqual(sw.status, 200, "sw.js публичен");
    // строгая MIME-проверка браузера: JSON-тип по умолчанию молча убил бы регистрацию SW
    assert.ok(/javascript/.test(sw.headers.get("content-type") || ""), "sw.js отдаётся как javascript");
    assert.ok(/no-store/.test(sw.headers.get("cache-control") || ""), "sw.js не кэшируется (kill-switch)");
    assert.ok(sw.text.includes("kga1-shell"), "sw.js использует фиксированное имя кэша");
    assert.ok(!sw.text.includes("__APP_VERSION__"), "версия в sw.js подставлена");
    for (const ic of ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png"]) {
      const r0 = await req("GET", ic);
      assert.strictEqual(r0.status, 200, ic + " публична");
      assert.strictEqual(r0.headers.get("content-type"), "image/png", ic + " — png");
      assert.ok(Number(r0.headers.get("content-length")) > 1000, ic + " не пустышка");
    }
    const inst = await req("GET", "/install");
    assert.strictEqual(inst.status, 200, "/install публична");
    for (const mark of ["Установите learn.kg как приложение", "Install learn.kg as an app", "learn.kg'yi uygulama olarak kurun"])
      assert.ok(inst.text.includes(mark), "/install содержит версию: " + mark);
    for (const l of ["ru", "en", "tr"])
      assert.ok(inst.text.includes('class="doc" lang="' + l + '"'), "в /install есть блок lang=" + l);
    assert.strictEqual((await req("GET", "/install-home.png")).status, 200, "иллюстрации /install публичны");
    assert.strictEqual((await req("GET", "/install/")).status, 301, "/install/ канонизируется");

    const yv = await req("GET", "/yandex_821d13437f099635.html");
    assert.strictEqual(yv.status, 200, "файл верификации Яндекса публичен");
    assert.ok(yv.text.includes("Verification: 821d13437f099635"), "содержимое верификации точное");

    // --- Демо: канон локализованных страниц — /demo/ru|en|tr симметрично ---
    for (const [al, want] of [["ru", "/demo/ru"], ["tr-TR", "/demo/tr"], ["ky", "/demo/ru"], ["fr", "/demo/en"], [null, "/demo/en"]]) {
      const rd = await req("GET", "/demo", al ? { al } : {});
      assert.strictEqual(rd.status, 301, "/demo — постоянный редирект");
      assert.strictEqual(rd.headers.get("location"), want, "/demo при Accept-Language=" + al + " → " + want);
      assert.ok(/no-store/.test(rd.headers.get("cache-control") || ""), "негоциирующий /demo не кэшируется");
      assert.ok(/Accept-Language/i.test(rd.headers.get("vary") || ""), "/demo варьируется по Accept-Language");
    }
    const DVAR = {
      ru: { title: "попробуйте бесплатно", canon: "https://learn.kg/demo/ru" },
      en: { title: "try it free", canon: "https://learn.kg/demo/en" },
      tr: { title: "ücretsiz", canon: "https://learn.kg/demo/tr" },
    };
    let demo = null; // ru-вариант используется ниже в общих демо-проверках
    for (const [dl, x] of Object.entries(DVAR)) {
      const d = await req("GET", "/demo/" + dl);
      if (dl === "ru") demo = d;
      assert.strictEqual(d.status, 200, "/demo/" + dl + " публичен");
      assert.ok(d.text.includes('<html lang="' + dl + '"'), "/demo/" + dl + " — документ lang=" + dl);
      assert.ok(d.text.toLowerCase().includes(x.title), "/demo/" + dl + " — локализованный SEO-title");
      assert.ok(d.text.includes('rel="canonical" href="' + x.canon + '"'), "/demo/" + dl + " canonical на себя");
      assertHreflangs(d.text, "/demo", "/demo/" + dl);
      assert.ok(d.text.includes('<base href="/">'), "/demo/" + dl + ": относительные пути живут на глубине 2");
      assert.ok(!d.headers.get("x-app-shell"), "/demo/" + dl + " вне SW-оболочки");
      assert.strictEqual(d.headers.get("content-encoding"), "gzip", "/demo/" + dl + " в gzip");
      assert.ok(d.headers.get("etag"), "/demo/" + dl + " с ETag");
      assert.ok(d.text.includes('IS_DEMO="1"') && !d.text.includes("__DEMO__"), "/demo/" + dl + ": флаг подставлен");
      assert.ok(d.text.includes('DEMO_LANG="' + dl + '"'), "/demo/" + dl + " задаёт язык интерфейса");
      // ПРЯМАЯ проверка поведения: исполняем I18N-блок ИЗ ОТДАННОГО ТЕЛА — интерфейс равен
      // языку страницы, и сохранённый выбор его НЕ перебивает (URL авторитетен)
      const im = d.text.match(/\/\* ===I18N=== \*\/([\s\S]*?)\/\* ===\/I18N=== \*\//);
      assert.ok(im, "I18N-блок в отдаче найден");
      const isb = { console, ST: {}, localStorage: { getItem: () => null, setItem() {} }, DEMO_LANG: dl };
      vm.createContext(isb);
      vm.runInContext(im[1] + ";this.currentLang=currentLang;this.t=t;", isb);
      assert.strictEqual(isb.currentLang(), dl, "интерфейс /demo/" + dl + " на " + dl);
      const saved = { console, ST: { settings: { lang: "en" } }, localStorage: { getItem: (k) => k === "kga1-lang" ? "tr" : null, setItem() {} }, DEMO_LANG: dl };
      vm.createContext(saved);
      vm.runInContext(im[1] + ";this.currentLang=currentLang;", saved);
      assert.strictEqual(saved.currentLang(), dl, "/demo/" + dl + ": адрес важнее сохранённого выбора");
      assert.strictEqual((await req("GET", "/demo/" + dl + "/")).status, 301, "/demo/" + dl + "/ канонизируется");
    }
    // Модуль демо — М1 целиком (решение владельца 29.10.2026), М0 — только служебный срез.
    // Утечка контента остальных модулей: и данные, и захардкоженные в коде справочники
    assert.ok(demo.text.includes('const DEMO_MOD="m1"') && demo.text.includes('const CONTENT_READY=["m1"]'), "модуль демо — М1");
    assert.ok(demo.text.includes('const LESSONS={"m1":{"id"') && demo.text.includes("Object.assign(LESSON_SLIDES"), "урок М1 и его слайды едут в демо");
    assert.strictEqual((demo.text.match(/"id":"m(?!1_)\d+_/g) || []).length, 0, "данные других модулей (и М0) не утекли в демо");
    assert.strictEqual((demo.text.match(/kgw\("[^"]*","m(?!0_|1_)\d+_\d+"\)/g) || []).length, 0,
      "справочники платных модулей вырезаны из демо (материал захардкожен в render-функциях)");
    assert.ok(!/Множественное число/.test(demo.text), "грамматика М2 не едет в публичную страницу");
    assert.ok(demo.text.includes("function renderGrammarM2(m){}"), "вырезано заглушкой — MODULE_EXTRAS остаётся цел");
    assert.ok(!demo.text.includes("function renderGrammarM1(m){}") && /Аффиксы сказуемости на примере/.test(demo.text),
      "справочник М1 едет в демо целиком");
    {
      const ddm0 = demo.text.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
      const csb = {}; vm.createContext(csb);
      vm.runInContext(ddm0[1] + ";this.CONTENT=CONTENT;", csb);
      const full = require("../deploy/gen-audio").loadData().CONTENT.m1.vocab.filter((v) => !v.ref).length;
      assert.strictEqual(csb.CONTENT.m1.vocab.length, full, "в демо все карточки М1 (" + full + ")");
      assert.deepStrictEqual(Object.keys(csb.CONTENT).join(","), "m1", "в данных демо только модуль демо — М0 не тащится");
    }
    assert.ok(demo.text.includes("function renderAlphabet(m)") && demo.text.includes("function renderTextsM0(m)"),
      "справочники М0 (алфавит, тексты) в демо остаются");
    // Ключ поиска варианта приходит из URL: свойство с прототипа обязано давать 404, а не падение
    for (const p of ["/constructor", "/__proto__", "/toString", "/demo/constructor", "/demo/__proto__",
      "/test/constructor", "/test/__proto__", "/razgovornik/constructor", "/razgovornik/__proto__", "/perevodchik/constructor", "/perevodchik/__proto__"])
      assert.strictEqual((await req("GET", p)).status, 404, p + " — 404, а не мусор с прототипа");
    assert.strictEqual((await req("GET", "/api/health")).status, 200, "сервер жив после запросов по прототипу");
    assert.strictEqual((await req("GET", "/demo/")).status, 301, "/demo/ канонизируется, как и /privacy/");
    // Хвост запроса переживает языковой редирект — иначе рекламный переход теряет атрибуцию
    const utm = await req("GET", "/demo?utm_source=fb&gclid=x", { al: "tr" });
    assert.strictEqual(utm.headers.get("location"), "/demo/tr?utm_source=fb&gclid=x", "/demo сохраняет query");
    assert.strictEqual((await req("GET", "/?utm_source=fb", { al: "tr" })).headers.get("location"), "/tr?utm_source=fb",
      "«/» сохраняет query");
    assert.ok(!demo.text.includes('rel="manifest"'), "PWA-манифест в демо убран");
    assert.ok(demo.text.includes('"id":"m1_01"'), "карточки модуля демо присутствуют");
    // публичные аудио-снимки: m0_01 — частая фраза переводчика (свой снимок, не демо),
    // анониму 200; чужой id — 401 (живой API за авторизацией)
    const dAud = await req("GET", "/api/audio/m0/m0_01.mp3");
    assert.strictEqual(dAud.status, 200, "аноним слышит частую фразу переводчика (снимок)");
    assert.strictEqual(dAud.headers.get("content-type"), "audio/mpeg");
    assert.strictEqual((await req("GET", "/api/audio/m0/m0_03.mp3")).status, 401, "не-демо id остаётся за авторизацией");
    const staleAud = await req("GET", "/api/audio/m0/m0_01.mp3", { cookie: "kga1=stale.garbage" });
    assert.strictEqual(staleAud.status, 200, "протухшая кука не глушит демо-озвучку (фолбэк на снапшот)");
    // озвучка алфавита — часть открытого в демо справочника: снимок и факт в DEMO_AUDIO
    assert.strictEqual((await req("GET", "/api/audio/m0/ph_oz.mp3")).status, 200, "аноним слышит озвучку алфавита (снимок)");
    assert.ok(demo.text.includes('"ph_oz"'), "DEMO_AUDIO объявляет алфавитную озвучку");

    // --- публичный аудио-слой разговорника: снимок фраз из платных модулей ---
    // открытая фраза: анониму — 200 public, вошедшему БЕЗ доступа к модулю — 200 private
    // (снимок, не живой файл); сосед по модулю вне разговорника — 401/403 как раньше
    const rzAnon = await req("GET", "/api/audio/" + rzPaid.mod + "/" + rzPaid.open + ".mp3");
    assert.strictEqual(rzAnon.status, 200, "аноним слышит фразу разговорника (снимок): " + rzPaid.mod + "/" + rzPaid.open);
    assert.ok(/public/.test(rzAnon.headers.get("cache-control") || ""), "снимок анониму кэшируется как public");
    assert.ok(/Cookie/i.test(rzAnon.headers.get("vary") || ""), "аудио-снимок варьируется по Cookie");
    const rzStudent = await req("GET", "/api/audio/" + rzPaid.mod + "/" + rzPaid.open + ".mp3", { auth: ILIM });
    assert.strictEqual(rzStudent.status, 200, "ученик без курса слышит фразу разговорника из снимка");
    assert.ok(/private/.test(rzStudent.headers.get("cache-control") || ""), "снимок по авторизации — private (не в общий кэш)");
    assert.strictEqual((await req("GET", "/api/audio/" + rzPaid.mod + "/" + rzPaid.closed + ".mp3")).status, 401,
      "сосед по модулю вне разговорника закрыт для анонима");
    assert.strictEqual((await req("GET", "/api/audio/" + rzPaid.mod + "/" + rzPaid.closed + ".mp3", { auth: ILIM })).status, 403,
      "и для ученика без курса — 403 (файл существует, но модуль не выдан)");
    // страница рендерит кнопку ровно для озвученного снимком: одна фикстура — одна кнопка
    const rzRu = await req("GET", "/razgovornik/ru");
    assert.strictEqual(rzRu.status, 200, "/razgovornik/ru отвечает");
    assert.ok(rzRu.text.includes('data-a="' + rzPaid.mod + "/" + rzPaid.open + '"'), "кнопка озвучки у фразы со снимком");
    assert.ok(!rzRu.text.includes('data-a="' + rzPaid.mod + "/" + rzPaid.closed + '"'), "у фразы вне снимка кнопки нет");
    // Guard класса бага «символ из ===DATA=== используется вне блока, а демо его не объявляет»
    // (так /demo падал ReferenceError на DIALOGS с v1.0.48): каждый верхнеуровневый const
    // DATA-блока, на который ссылается код снаружи, обязан быть объявлен в демо-артефакте.
    {
      const src = M0_SRC;
      const dm = src.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
      const outside = (src.slice(0, dm.index) + src.slice(dm.index + dm[0].length)).replace(/\/\/[^\n]*/g, "");
      for (const mt of dm[1].matchAll(/^const\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
        if (!new RegExp("\\b" + mt[1] + "\\b").test(outside)) continue;
        assert.ok(new RegExp("const\\s+" + mt[1] + "\\s*=").test(demo.text),
          "код вне DATA использует " + mt[1] + ", а демо-артефакт его не объявляет");
      }
    }
    // Демо-диалоги: состав среза проверяем структурно (vm по DATA-блоку артефакта, не grep —
    // строка fullId живёт и в коде рендерера), вкладка dialogs — настоящей studyTabsFor
    {
      const ddm = demo.text.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
      const dsb = {}; vm.createContext(dsb);
      vm.runInContext(ddm[1] + ";this.DIALOGS=DIALOGS;this.CONTENT=CONTENT;", dsb);
      const D = dsb.DIALOGS.m1;
      const srcD = require("../deploy/gen-audio").loadData().DIALOGS.m1;
      assert.ok(D && D.parts.length === srcD.parts.length, "в демо все части диалога М1 (" + srcD.parts.length + ")");
      assert.ok(D.parts.every((p) => (p.quiz || []).length >= 1), "квизы частей едут в демо");
      assert.ok(!dsb.DIALOGS.m0 && Object.keys(dsb.DIALOGS).join(",") === "m1", "диалоги других модулей (и М0) не в демо");
      for (const sn of D.songs || []) assert.ok(!("fullId" in sn) && !sn.quiz, "полный трек и квиз песни не в демо");
      assert.ok(demo.text.indexOf("const DIALOGS=") < demo.text.indexOf("function studyTabsFor"), "DIALOGS объявлен до studyTabsFor");
      // хвост функции теперь «…:[])];}» — экзамен-вкладка замыкает список
      const trailSrc = demo.text.match(/\/\* ===TRAIL=== \*\/([\s\S]*?)\/\* ===\/TRAIL=== \*\//)[1];
      const fnm = demo.text.match(/function studyTabsFor\(id\)\{[\s\S]*?\)\];\}/);
      assert.ok(fnm, "studyTabsFor извлекается из артефакта");
      const tsb = { CONTENT: dsb.CONTENT, DIALOGS: dsb.DIALOGS, t: (k) => k, bi: (o, f) => o[f] || "" };
      vm.createContext(tsb);
      vm.runInContext(trailSrc + fnm[0] + ';this.tabs=studyTabsFor("m1").map((x)=>x[0]);', tsb);
      assert.ok(tsb.tabs.includes("dialogs"), "вкладка «Диалоги» доступна в демо");
    }
    // здоровье TTS: студенту — 403, преподавателю без ключа — 400 (ключа в тестовой среде нет)
    assert.strictEqual((await req("GET", "/api/tts/health", { auth: ILIM })).status, 403, "tts/health — только преподавателю");
    // удаление аудио: роль, снос файла и меты, 404 на повторе
    assert.strictEqual((await req("DELETE", "/api/audio/m0/ph_oz.mp3", { auth: ILIM })).status, 403, "ученик не удаляет аудио");
    fs.writeFileSync(path.join(DATA, "audio", "m0", "zz_del.mp3"), Buffer.from("bye"));
    assert.strictEqual((await req("DELETE", "/api/audio/m0/zz_del.mp3", { auth: ALT })).status, 200, "преподаватель удаляет аудио");
    assert.strictEqual((await req("DELETE", "/api/audio/m0/zz_del.mp3", { auth: ALT })).status, 404, "повторное удаление — 404");
    // длинные URL источников не выламывают вёрстку: контейнеру задан перенос
    assert.ok((await req("GET", "/blog/skolko-vremeni-uchit-kyrgyzskiy/ru")).text.includes("overflow-wrap:anywhere"),
      "перенос длинных строк включён на страницах блога");
    assert.strictEqual((await req("GET", "/api/tts/health", { auth: ALT })).status, 400, "без ключа — честное 400, не 500");
    assert.strictEqual((await req("HEAD", "/api/audio/m0/m0_01.mp3")).status, 200,
      "HEAD демо-озвучки — 200, а не Basic-попап (превью-боты и прокси)");
    assert.ok(/Cookie/i.test(dAud.headers.get("vary") || ""),
      "демо-озвучка варьируется по Cookie: общий кэш не подменит вошедшему живой файл снимком");

    // --- Разговорник /razgovornik: канон локализованных страниц, пара языков своя ---
    for (const [al, want] of [["ru", "/razgovornik/ru"], ["tr-TR", "/razgovornik/tr"], ["ky", "/razgovornik/ru"], [null, "/razgovornik/en"]]) {
      const rr = await req("GET", "/razgovornik", al ? { al } : {});
      assert.strictEqual(rr.status, 301, "/razgovornik — постоянный редирект");
      assert.strictEqual(rr.headers.get("location"), want, "/razgovornik при Accept-Language=" + al + " → " + want);
      assert.ok(/no-store/.test(rr.headers.get("cache-control") || ""), "негоциирующий /razgovornik не кэшируется");
    }
    assert.strictEqual((await req("GET", "/razgovornik", { cookie: "kga1-lang=tr", al: "ru" })).headers.get("location"),
      "/razgovornik/tr", "сохранённый язык важнее браузерного и для разговорника");
    assert.strictEqual((await req("GET", "/razgovornik/")).status, 301, "/razgovornik/ канонизируется");
    // пара языков у варианта СВОЯ: ru — русско-кыргызский, en — English–Kyrgyz, tr — Türkçe–Kırgızca
    const RZT = { ru: "Русско-кыргызский разговорник", en: "English–Kyrgyz Phrasebook", tr: "Türkçe–Kırgızca Konuşma Kılavuzu" };
    for (const l of ["ru", "en", "tr"]) {
      const t = await req("GET", "/razgovornik/" + l);
      assert.strictEqual(t.status, 200, "/razgovornik/" + l + " публичен");
      assert.ok(t.text.includes('<html lang="' + l + '"') && t.text.includes('data-srv-lang="' + l + '"'), "/razgovornik/" + l + ": lang и data-srv-lang");
      assert.ok(t.text.includes(RZT[l]), "/razgovornik/" + l + " — двуязычный титул своего языка");
      // en/tr-читатель кириллицу не прочтёт: транслит обязателен; ru его не несёт
      assert.strictEqual(t.text.includes('class="lat"'), l !== "ru",
        "/razgovornik/" + l + ": транслит " + (l === "ru" ? "не нужен" : "присутствует"));
      assert.ok(t.text.includes('rel="canonical" href="https://learn.kg/razgovornik/' + l + '"'), "/razgovornik/" + l + " canonical на себя");
      assertHreflangs(t.text, "/razgovornik", "/razgovornik/" + l);
      assert.ok(t.text.includes('<base href="/">'), "/razgovornik/" + l + ": base на глубине 2");
      assert.strictEqual(t.headers.get("content-encoding"), "gzip", "/razgovornik/" + l + " в gzip");
      assert.ok(!t.headers.get("x-app-shell"), "/razgovornik/" + l + " вне SW-оболочки");
      assert.ok(!t.text.includes("innerHTML"), "/razgovornik/" + l + " без innerHTML");
      // магнит: демо + WhatsApp Алтынай + тест уровня
      assert.ok(t.text.includes('href="/demo/' + l + '"'), "/razgovornik/" + l + ": CTA на демо");
      assert.ok(t.text.includes("wa.me/996505854856"), "/razgovornik/" + l + ": контакт Алтынай (WhatsApp)");
      assert.ok(t.text.includes('href="/test/' + l + '"'), "/razgovornik/" + l + ": CTA на тест уровня");
      // разметка: Organization + WebPage + FAQPage
      const blocks = [...t.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const nodes = blocks.flatMap((b) => b["@graph"] || [b]);
      for (const need of ["Organization", "WebPage", "FAQPage"])
        assert.ok(nodes.some((n) => [].concat(n["@type"]).includes(need)), "/razgovornik/" + l + ": в графе есть " + need);
      const rwp = nodes.find((n) => [].concat(n["@type"]).includes("WebPage"));
      assert.strictEqual(rwp.inLanguage, l, "/razgovornik/" + l + ": WebPage.inLanguage = " + l);
    }

    // --- Переводчик /perevodchik: канон локализованных страниц, пара языков своя ---
    for (const [al, want] of [["ru", "/perevodchik/ru"], ["tr-TR", "/perevodchik/tr"], [null, "/perevodchik/en"]]) {
      const rp = await req("GET", "/perevodchik", al ? { al } : {});
      assert.strictEqual(rp.status, 301, "/perevodchik — постоянный редирект");
      assert.strictEqual(rp.headers.get("location"), want, "/perevodchik при Accept-Language=" + al + " → " + want);
      assert.ok(/no-store/.test(rp.headers.get("cache-control") || ""), "негоциирующий /perevodchik не кэшируется");
    }
    assert.strictEqual((await req("GET", "/perevodchik/")).status, 301, "/perevodchik/ канонизируется");
    // эталон-литерал h1: правится руками вместе с ui.h1 — осознанная подпись под сменой интента
    // (05.09.2026 «переводчик частых фраз» → «переводчик онлайн»: 906 показов / 2 клика в Google)
    const PVT = { ru: "Русско-кыргызский переводчик онлайн", en: "English–Kyrgyz Translator Online", tr: "Türkçe–Kırgızca Çeviri" };
    for (const l of ["ru", "en", "tr"]) {
      const t = await req("GET", "/perevodchik/" + l);
      assert.strictEqual(t.status, 200, "/perevodchik/" + l + " публичен");
      assert.ok(t.text.includes('<html lang="' + l + '"') && t.text.includes('data-srv-lang="' + l + '"'), "/perevodchik/" + l + ": lang и data-srv-lang");
      assert.ok(t.text.includes(PVT[l]), "/perevodchik/" + l + " — двуязычный титул своего языка");
      assert.ok(t.text.includes('rel="canonical" href="https://learn.kg/perevodchik/' + l + '"'), "/perevodchik/" + l + " canonical на себя");
      assertHreflangs(t.text, "/perevodchik", "/perevodchik/" + l);
      assert.ok(t.text.includes('<base href="/">'), "/perevodchik/" + l + ": base на глубине 2");
      assert.strictEqual(t.headers.get("content-encoding"), "gzip", "/perevodchik/" + l + " в gzip");
      assert.ok(!t.headers.get("x-app-shell"), "/perevodchik/" + l + " вне SW-оболочки");
      assert.ok(!t.text.includes("innerHTML"), "/perevodchik/" + l + " без innerHTML");
    }

    // --- Тест уровня /test: канон локализованных страниц + квиз ---
    for (const [al, want] of [["ru", "/test/ru"], ["tr-TR", "/test/tr"], ["ky", "/test/ru"], ["fr", "/test/en"], [null, "/test/en"]]) {
      const rt = await req("GET", "/test", al ? { al } : {});
      assert.strictEqual(rt.status, 301, "/test — постоянный редирект");
      assert.strictEqual(rt.headers.get("location"), want, "/test при Accept-Language=" + al + " → " + want);
      assert.ok(/no-store/.test(rt.headers.get("cache-control") || ""), "негоциирующий /test не кэшируется");
      assert.ok(/Accept-Language/i.test(rt.headers.get("vary") || "") && /Cookie/i.test(rt.headers.get("vary") || ""),
        "/test варьируется по Accept-Language и Cookie");
    }
    assert.strictEqual((await req("GET", "/test", { cookie: "kga1-lang=tr", al: "ru" })).headers.get("location"), "/test/tr",
      "сохранённый язык важнее браузерного и для /test");
    assert.strictEqual((await req("GET", "/test/")).status, 301, "/test/ канонизируется");
    const LVLT = {
      ru: "Тест уровня кыргызского языка",
      en: "Kyrgyz level test",
      tr: "Kırgızca seviye testi",
    };
    const lvl = {}; // тела вариантов — ниже переиспользуются квизом и Метрикой
    for (const l of ["ru", "en", "tr"]) {
      const t = await req("GET", "/test/" + l);
      lvl[l] = t.text;
      assert.strictEqual(t.status, 200, "/test/" + l + " публичен");
      assert.ok(t.text.includes('<html lang="' + l + '"'), "/test/" + l + " — документ lang=" + l);
      assert.ok(t.text.includes('data-srv-lang="' + l + '"'), "/test/" + l + ": адрес авторитетен для языка");
      assert.ok(t.text.includes(LVLT[l]), "/test/" + l + " — локализованный title");
      assert.ok(t.text.includes('rel="canonical" href="https://learn.kg/test/' + l + '"'), "/test/" + l + " canonical на себя");
      assertHreflangs(t.text, "/test", "/test/" + l);
      assert.ok(t.text.includes('<base href="/">'), "/test/" + l + ": относительные пути живут на глубине 2");
      assert.strictEqual(t.headers.get("content-encoding"), "gzip", "/test/" + l + " в gzip");
      assert.ok(t.headers.get("etag"), "/test/" + l + " с ETag");
      assert.ok(!t.headers.get("x-app-shell"), "/test/" + l + " вне SW-оболочки");
      assert.ok(t.text.includes(".wrap{") && t.text.includes(".seg a{"), "/test/" + l + ": CSS-каркас блога не потерян");
      assert.ok(!t.text.includes("innerHTML"), "/test/" + l + " без innerHTML (политика m0.html)");
      assert.strictEqual((await req("GET", "/test/" + l + "/")).status, 301, "/test/" + l + "/ канонизируется");
      // разметка: Organization + WebPage + Quiz + FAQPage, вопросы FAQ дословно видны
      const blocks = [...t.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const nodes = blocks.flatMap((b) => b["@graph"] || [b]);
      for (const need of ["Organization", "WebPage", "Quiz", "FAQPage"])
        assert.ok(nodes.some((n) => [].concat(n["@type"]).includes(need)), "/test/" + l + ": в графе есть " + need);
      const wp = nodes.find((n) => [].concat(n["@type"]).includes("WebPage"));
      assert.strictEqual(wp.inLanguage, l, "/test/" + l + ": WebPage.inLanguage = " + l);
      const fq = nodes.find((n) => [].concat(n["@type"]).includes("FAQPage"));
      assert.ok(fq.mainEntity.length >= 3, "/test/" + l + ": FAQPage ≥ 3 вопросов");
      for (const q of fq.mainEntity)
        assert.ok(t.text.includes(q.name), "/test/" + l + ": вопрос FAQ дословно виден: " + q.name.slice(0, 40));
    }
    // ПРЯМОЙ vm-тест квиза: DATA+LOGIC исполняются из отданного тела в голом контексте
    const quizOf = (body) => {
      const dm2 = body.match(/\/\* ===QUIZ-DATA=== \*\/([\s\S]*?)\/\* ===\/QUIZ-DATA=== \*\//);
      const lm2 = body.match(/\/\* ===QUIZ-LOGIC=== \*\/([\s\S]*?)\/\* ===\/QUIZ-LOGIC=== \*\//);
      assert.ok(dm2 && lm2, "маркеры QUIZ-DATA и QUIZ-LOGIC найдены");
      // логика обязана быть DOM-free: она исполняется и проверяется вне браузера
      assert.ok(!/window|document|location/.test(lm2[1]), "QUIZ-LOGIC не трогает window/document/location");
      const sbx = {};
      vm.createContext(sbx);
      vm.runInContext(dm2[1] + lm2[1] +
        ";this.QUIZ=QUIZ;this.QUIZ_LANG=QUIZ_LANG;this.verdictFor=verdictFor;this.waTextFor=waTextFor;this.waHrefFor=waHrefFor;", sbx);
      return sbx;
    };
    const qru = quizOf(lvl.ru);
    assert.strictEqual(qru.QUIZ.total, 15, "QUIZ.total = 15");
    assert.strictEqual(qru.QUIZ.questions.length, 15, "в квизе 15 вопросов");
    for (const q of qru.QUIZ.questions) {
      assert.ok(q.ky && q.options.length === 4 && Number.isInteger(q.correct), "вопрос несёт ky/options/correct");
      assert.ok(!("level" in q) && !("note" in q), "служебные level/note не едут в страницу");
    }
    // «всегда правильный» и «всегда неправильный» прогоны — счёт считается как в IIFE
    const score = (pick) => qru.QUIZ.questions.reduce((n, q) => n + (pick(q) === q.correct ? 1 : 0), 0);
    assert.strictEqual(score((q) => q.correct), 15, "все верные ответы дают 15");
    assert.strictEqual(score((q) => (q.correct + 1) % 4), 0, "все неверные дают 0");
    // границы вердиктов
    for (const [s, i] of [[0, 0], [5, 0], [6, 1], [11, 1], [12, 2], [15, 2]])
      assert.strictEqual(qru.verdictFor(s), qru.QUIZ.verdicts[i], "verdictFor(" + s + ") — ступень " + i);
    assert.strictEqual(qru.waTextFor(9), "Прошёл тест уровня на learn.kg: 9/15, ~A1 — хочу на курс.",
      "WhatsApp-текст собирается из счёта и вердикта");
    const wa9 = qru.waHrefFor(9);
    assert.ok(wa9.startsWith("https://wa.me/996505854856?text="), "waHrefFor ведёт в WhatsApp Алтынай");
    assert.strictEqual(decodeURIComponent(wa9.split("text=")[1]), qru.waTextFor(9), "текст в ссылке декодируется обратно");
    // en/tr: единый кыргызский банк, локализованный интерфейс
    for (const l of ["en", "tr"]) {
      const ql = quizOf(lvl[l]);
      assert.strictEqual(ql.QUIZ_LANG, l, "QUIZ_LANG=" + l);
      // сравнение через JSON: объекты пришли из разных vm-контекстов (разные realm),
      // deepStrictEqual завалился бы на прототипах абсолютно одинаковых данных
      assert.strictEqual(JSON.stringify(ql.QUIZ.questions), JSON.stringify(qru.QUIZ.questions),
        "вопросы " + l + " поэлементно равны ru (банк един)");
      assert.notStrictEqual(ql.waTextFor(9), qru.waTextFor(9), "waTextFor локализован (" + l + ")");
    }
    // SEO: русская версия несёт оба написания названия языка — «кыргызский» (норма
    // Кыргызстана, основное) и «киргизский» (привычное в России) — иначе половина
    // спроса не находит страницу
    assert.ok(lvl.ru.includes("кыргызского") && lvl.ru.includes("киргизск"), "/test/ru несёт оба написания названия языка");
    // цель Метрики: код зовёт reachGoal test_done через guard, ID — только серверным инжектом
    assert.ok(lvl.ru.includes("window.ym&&ym(") && lvl.ru.includes('"test_done"'), "квиз шлёт цель test_done через guard");
    // каждый скрипт отданного тела — валидный JS (та же проверка, что у демо-сборки)
    for (const l of ["ru", "en", "tr"])
      for (const s of lvl[l].matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(s[1]);

    // Метрика: ключ согласия и счётчик у всех страниц едины с витриной — единственным их владельцем
    const ckey = (anon.text.match(/localStorage\.getItem\("(kga1-consent[\w-]*)"\)/) || [])[1];
    const ymid = (anon.text.match(/YM_ID=(\d+)/) || [])[1];
    assert.ok(ckey && ymid, "витрина несёт ключ согласия и YM_ID");
    assert.ok(lvl.ru.includes("var YM_ID=" + ymid + ";"), "счётчик в квиз инжектится сервером из витрины, не литералом");
    for (const [name, page] of [["/install", inst.text], ["/demo/ru", demo.text], ["/test/ru", lvl.ru]]) {
      assert.ok(page.includes('"' + ckey + '"'), name + " гейтит Метрику тем же ключом согласия");
      assert.ok(page.includes("id=" + ymid), name + " несёт тот же счётчик");
    }

    assert.ok(!anon.headers.get("x-app-shell"), "витрина анонима — без X-App-Shell");
    // X-App-Shell — метка варианта оболочки (контракт с sw.js). Она же меняется при смене
    // состава курсов, поэтому у ученика и преподавателя оболочки разные.
    assert.ok(asUser.headers.get("x-app-shell"), "вошедший получает X-App-Shell: контракт офлайн-оболочки");
    assert.notStrictEqual(asUser.headers.get("x-app-shell"), (await req("GET", "/", { auth: ALT })).headers.get("x-app-shell"),
      "у ученика и преподавателя разные оболочки");
    assert.ok(asUser.text.includes('rel="manifest"'), "приложение линкует манифест");
    assert.ok(asUser.text.includes("serviceWorker"), "приложение регистрирует service worker");
    assert.ok(asUser.text.includes('IS_DEMO="0"') && !asUser.text.includes("__DEMO__"), "вошедший получает не-демо");

    assert.ok((await req("GET", "/robots.txt")).text.includes("Disallow: /api/"), "robots.txt закрывает API");
    assert.ok((await req("GET", "/robots.txt")).text.includes("Sitemap:"), "robots.txt указывает sitemap");
    // /llms.txt: карта сайта для AI-агентов строится из того же реестра, что sitemap —
    // проверка перебором (канон): каждый en-вариант из sitemap обязан быть и в llms.txt
    {
      const llms = await req("GET", "/llms.txt");
      assert.strictEqual(llms.status, 200, "llms.txt отдаётся");
      assert.ok(llms.text.startsWith("# learn.kg"), "llms.txt начинается с H1 по спеке llmstxt.org");
      const enUrls = [...(await req("GET", "/sitemap.xml")).text.matchAll(/<loc>(https:\/\/learn\.kg\/[^<]*\/en)<\/loc>/g)].map((m) => m[1]);
      assert.ok(enUrls.length > 10, "sitemap отдал en-варианты для сверки");
      for (const u of enUrls) assert.ok(llms.text.includes("(" + u + ")"), "llms.txt потерял страницу: " + u);
      assert.ok(!/\[\]\(/.test(llms.text), "у каждой ссылки llms.txt есть титул");
    }
    // IndexNow: ключ в deploy/indexnow.js и ключ-файл сервера — один контракт
    {
      const inKey = (fs.readFileSync(path.join(__dirname, "..", "deploy", "indexnow.js"), "utf8")
        .match(/KEY = "([0-9a-f]{32})"/) || [])[1];
      assert.ok(inKey, "в deploy/indexnow.js есть 32-hex KEY");
      const kf = await req("GET", "/" + inKey + ".txt");
      assert.strictEqual(kf.status, 200, "ключ-файл IndexNow отдаётся");
      assert.strictEqual(kf.text, inKey, "содержимое ключ-файла равно ключу");
    }
    /* Schema-фиксы аудита 19.08 — перебором по языкам (канон): Course list витрины
       (ItemList + языковые url + @id, склеивающий курс со своей страницей), квадратный
       логотип вместо og-баннера, Quiz без ключа ответов в индексируемой разметке. */
    for (const l of ["ru", "en", "tr"]) {
      const graphOf = (body) => [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
        .flatMap((m) => JSON.parse(m[1])["@graph"] || []);
      const lg = graphOf((await req("GET", "/" + l)).text);
      const org = lg.find((n) => n["@type"] === "Organization");
      assert.strictEqual(org.logo,
        "https://learn.kg/icon-512.png", "/" + l + ": логотип — квадрат icon-512, не og-баннер");
      // контакты организации: мессенджер для учеников и почта для всех прочих
      // (учреждения, подрядчики, запросы по данным) — оба канала в панели знаний
      assert.strictEqual(org.email, "info@learn.kg", "/" + l + ": почта проекта в Organization");
      const points = [].concat(org.contactPoint || []);
      assert.ok(points.some((p) => p.url === "https://wa.me/996505854856"), "/" + l + ": канал WhatsApp");
      const mail = points.find((p) => p.email);
      assert.ok(mail && mail.email === "info@learn.kg", "/" + l + ": канал почты отдельным contactPoint");
      assert.deepStrictEqual(mail.availableLanguage, ["ru", "en", "tr", "ky"],
        "/" + l + ": языки поддержки перечислены");
      const courses = lg.filter((n) => n["@type"] === "Course");
      assert.strictEqual(courses.length, 4, "/" + l + ": четыре Course");
      for (const [i, lvl] of ["a1", "a2", "b1", "b2"].entries()) {
        assert.strictEqual(courses[i].url, "https://learn.kg/kurs-" + lvl + "/" + l,
          "/" + l + ": Course.url ведёт на языковую страницу курса, не на редирект");
        assert.strictEqual(courses[i]["@id"], "https://learn.kg/kurs-" + lvl + "#course",
          "/" + l + ": у Course есть @id уровня");
        const kg = graphOf((await req("GET", "/kurs-" + lvl + "/" + l)).text);
        assert.strictEqual(kg.find((n) => n["@type"] === "Course")["@id"],
          "https://learn.kg/kurs-" + lvl + "#course",
          "/kurs-" + lvl + "/" + l + ": @id совпадает с витриной — сущности склеены");
      }
      const il = lg.find((n) => n["@type"] === "ItemList");
      assert.ok(il, "/" + l + ": есть ItemList (право на Course list)");
      assert.deepStrictEqual(il.itemListElement.map((x) => [x.position, x.url]),
        [1, 2, 3, 4].map((p, i) => [p, "https://learn.kg/kurs-" + ["a1", "a2", "b1", "b2"][i] + "/" + l]),
        "/" + l + ": ListItem с позициями и языковыми url");
      // Элементы ссылаются на Course-узлы того же отданного графа по @id, не дублируют сущность
      const lcourses = lg.filter((n) => n["@type"] === "Course");
      assert.deepStrictEqual(il.itemListElement.map((x) => [x.name, x.item && x.item["@id"], x.item && x.item["@type"]]),
        lcourses.map((c) => [c.name, c["@id"], undefined]),
        "/" + l + ": ItemList ссылается на Course по @id с их именами, без копии сущности");
      const quiz = graphOf((await req("GET", "/test/" + l)).text).find((n) => n["@type"] === "Quiz");
      assert.ok(quiz && !quiz.hasPart, "/test/" + l + ": Quiz без hasPart — ключ ответов не публикуется в LD");
    }
    // HSTS на каждом ответе (сервер снаружи живёт только за https, TLS терминирует Traefik):
    // после первого визита браузер не делает cleartext-хоп на :80. Проверяются обе природы
    // ответа — статика и API: заголовок ставится до всех веток и не должен оттуда уехать
    for (const r of [anon, await req("GET", "/api/version")]) {
      const hsts = r.headers.get("strict-transport-security") || "";
      const ma = +(((hsts.match(/max-age=(\d+)/) || [])[1]) || 0);
      assert.ok(ma >= 15552000, "HSTS слабее 180 суток или отсутствует: " + JSON.stringify(hsts));
    }
    assert.ok((await req("GET", "/sitemap.xml")).text.includes("learn.kg/en"), "sitemap перечисляет языковые URL");
    // языковые варианты витрины: серверная локализация для поисковиков
    // перевод проверяется по самому словарю LANDING_I18N (vm, как это делает сервер),
    // а не пиннингом литералов: смена копирайта не должна требовать правки теста
    const dictSrc = fs.readFileSync(path.join(__dirname, "..", "app", "landing.html"), "utf8")
      .match(/\/\* ===LANDING-I18N=== \*\/([\s\S]*?)\/\* ===\/LANDING-I18N=== \*\//)[1];
    const dsb = { localStorage: { getItem: () => null, setItem: () => {} } };
    vm.createContext(dsb);
    vm.runInContext(dictSrc + "; this.LD=LANDING_I18N;", dsb);
    const en = await req("GET", "/en");
    assert.ok(en.text.includes('<html lang="en"'), "/en отдаёт английский документ");
    assert.ok(en.text.includes(dsb.LD.en.hero_h1), "/en переведён по словарю (hero_h1)");
    assert.ok(en.text.includes('hreflang="tr"'), "/en несёт hreflang-альтернативы");
    const tr = await req("GET", "/tr");
    assert.ok(tr.text.includes('<html lang="tr"'), "/tr отдаёт турецкий документ");
    assert.ok(tr.text.includes(dsb.LD.tr.hero_h1), "/tr переведён по словарю (hero_h1)");
    assert.strictEqual((await req("GET", "/en/")).status, 301, "/en/ канонизируется");
    const priv = (await req("GET", "/privacy")).text;
    for (const mark of ["Политика конфиденциальности", "Privacy Policy", "Gizlilik Politikası"])
      assert.ok(priv.includes(mark), "/privacy содержит версию: " + mark);
    const trm = (await req("GET", "/terms")).text;
    for (const mark of ["оферта", "Terms of Use", "Kullanım Koşulları"])
      assert.ok(trm.includes(mark), "/terms содержит версию: " + mark);
    for (const doc of [priv, trm])
      for (const l of ["ru", "en", "tr"])
        assert.ok(doc.includes('class="doc" lang="' + l + '"'), "в документе есть блок lang=" + l);
    assert.strictEqual((await req("GET", "/privacy/")).status, 301, "/privacy/ канонизируется");
    // --- SEO: 404 вместо 401-стены для людей и краулеров (GET|HEAD вне /api/) ---
    const nf = await req("GET", "/nonexistent-page");
    assert.strictEqual(nf.status, 404, "аноним на неизвестном пути получает 404");
    assert.ok(/text\/html/.test(nf.headers.get("content-type") || ""), "404 — человекочитаемый HTML");
    assert.ok(!nf.headers.get("www-authenticate"), "404 без Basic-попапа");
    assert.strictEqual((await req("GET", "/nonexistent-page", { auth: ILIM })).status, 404, "и вошедшему тоже 404");
    assert.strictEqual((await req("HEAD", "/nonexistent-page")).status, 404, "HEAD — тоже 404");
    assert.strictEqual((await req("GET", "/api/unknown")).status, 401, "API-контракт не тронут: аноним → 401");
    // Регресс «модалка после Выйти»: прощальный keepalive-запрос приложения приходит уже
    // без куки, и 401 с Basic-challenge рисовал нативный логин-попап поверх витрины.
    // Сценарий целиком: вход → выход → анонимный /api/me = 401 и БЕЗ WWW-Authenticate.
    {
      const inR = await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } });
      assert.strictEqual(inR.status, 200);
      const cookie = (inR.headers.get("set-cookie") || "").split(";")[0];
      assert.ok(cookie, "вход выдал куку");
      assert.strictEqual((await req("GET", "/api/logout", { cookie })).status, 302, "выход — редирект на витрину");
      const after = await req("GET", "/api/me");
      assert.strictEqual(after.status, 401, "после выхода API снова закрыт");
      assert.ok(!after.headers.get("www-authenticate"), "401 без Basic-challenge — браузер не рисует модалку");
    }

    // --- SEO: sitemap с lastmod и юридическими страницами ---
    const sm = (await req("GET", "/sitemap.xml")).text;
    assert.strictEqual((sm.match(/<url>/g) || []).length, 132, "sitemap: 132 URL (−6 снятых статей, +3 /blog/gostestirovanie-kak-podgotovitsya)");
    assert.ok(sm.includes("learn.kg/ru") && sm.includes("learn.kg/install") && sm.includes("learn.kg/demo/ru") && sm.includes("learn.kg/demo/en") && sm.includes("learn.kg/demo/tr") && sm.includes("learn.kg/test/ru") && sm.includes("learn.kg/razgovornik/ru") && sm.includes("learn.kg/razgovornik/en") && sm.includes("learn.kg/razgovornik/tr") && sm.includes("learn.kg/perevodchik/ru") && sm.includes("learn.kg/perevodchik/tr"), "sitemap: канон-URL витрины, демо, теста уровня и разговорника");
    assert.ok(sm.includes("learn.kg/privacy") && sm.includes("learn.kg/terms"), "sitemap: privacy и terms");
    assert.strictEqual((sm.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, (sm.match(/<url>/g) || []).length, "у каждого URL валидный lastmod");
    assert.ok(sm.includes("learn.kg/blog/ru") && sm.includes("learn.kg/blog/kak-ustroen-trenazher/tr"), "sitemap: блог и статья во всех языках");

    // --- SEO: JSON-LD живых ответов парсится и локализован ---
    const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]));
    const typesOf = (blocks) => {
      const t = new Set();
      const walk = (n) => { if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === "object") { if (n["@type"]) [].concat(n["@type"]).forEach((x) => t.add(x)); Object.values(n).forEach(walk); } };
      walk(blocks); return t;
    };
    for (const pth of ["/ru", "/en", "/tr"]) { // канон: ru-витрина на /ru, «/» — редирект
      const body = (await req("GET", pth)).text;
      const blocks = ldOf(body); // JSON.parse бросит — тест упадёт, это и есть проверка
      const types = typesOf(blocks);
      for (const need of ["Course", "Organization", "WebSite", "FAQPage"])
        assert.ok(types.has(need), pth + ": в графе есть " + need);
    }
    // локализация графа: вопрос из словаря en присутствует в графе /en
    const enBody = (await req("GET", "/en")).text;
    const dm = enBody.match(/\/\* ===LANDING-I18N=== \*\/([\s\S]*?)\/\* ===\/LANDING-I18N=== \*\//);
    assert.ok(dm, "словарь виден и в /en");
    const sb2 = { localStorage: { getItem: () => null, setItem: () => {} } };
    vm.createContext(sb2); vm.runInContext(dm[1] + "; this.D=LANDING_I18N;", sb2);
    assert.ok(JSON.stringify(ldOf(enBody)).includes(sb2.D.en.faq_q1), "/en: граф говорит по-английски");

    // вход обязан ходить на абсолютный /api/login: относительный из вложенного пути упал бы в гейт
    assert.strictEqual((await req("POST", "/login/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } })).status, 401,
      "относительный путь до /api/login не работает — поэтому в форме абсолютный");

    // --- auth ---
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "ilim", password: "WRONG" } })).status, 401);
    const lg = await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } });
    assert.strictEqual(lg.status, 200);
    const cookie = (lg.headers.get("set-cookie") || "").split(";")[0];
    assert.ok(cookie.startsWith("kga1="), "cookie выдан");
    assert.ok((await req("GET", "/", { cookie })).text.includes("===DATA==="), "с cookie — приложение");
    assert.strictEqual((await req("GET", "/api/logout")).status, 302);

    // --- роли ---
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text).role, "student");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: ALT })).text).role, "admin");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: VADIM })).text).role, "admin");

    // --- прогресс ---
    const st = { v: 1, vocab: { m0_01: { box: 1, streak: 1, due: 1 } }, test: null, updatedAt: "2026-01-01T00:00:00Z" };
    assert.strictEqual((await req("PUT", "/api/progress", { auth: ILIM, body: st })).status, 200);
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/progress", { auth: ILIM })).text), st);
    assert.strictEqual((await req("GET", "/api/progress", { auth: ALT })).text, "null", "прогресс раздельный");
    assert.strictEqual((await req("PUT", "/api/progress", { auth: ILIM, body: "oops", raw: true })).status, 400);

    // --- вычитка и overrides: права ---
    assert.strictEqual((await req("PUT", "/api/review/m0", { auth: ILIM, body: { id: "m0_01", status: "ok" } })).status, 403, "ученику нельзя");
    assert.strictEqual((await req("PUT", "/api/review/m0", { auth: ALT, body: { id: "m0_01", status: "hmm" } })).status, 400, "плохой статус");
    assert.strictEqual((await req("PUT", "/api/review/m0", { auth: ALT, body: { id: "m0_01", status: "ok" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/review/m0", { auth: ALT, body: { id: "m0_01", audioOk: true } })).status, 200, "audioOk отдельно");
    const rev = JSON.parse((await req("GET", "/api/review/m0", { auth: ILIM })).text);
    assert.strictEqual(rev.m0_01.status, "ok");
    assert.strictEqual(rev.m0_01.audioOk, true, "merge, не перезапись");
    assert.strictEqual((await req("PUT", "/api/overrides/m0", { auth: ALT, body: { id: "m0_83", ky: "калем", ru: "ручка" } })).status, 200);
    assert.strictEqual(JSON.parse((await req("GET", "/api/overrides/m0", { auth: ILIM })).text).m0_83.ru, "ручка");
    // правка перевода должна доезжать до всех языков интерфейса, а не только до русского:
    // иначе ученик в en/tr видит старый неверный смысл, и на нём же строятся дистракторы
    assert.strictEqual((await req("PUT", "/api/overrides/m0", { auth: ALT, body: { id: "m0_83", en: "pen", tr: "kalem" } })).status, 200);
    const ovr = JSON.parse((await req("GET", "/api/overrides/m0", { auth: ILIM })).text).m0_83;
    assert.strictEqual(ovr.en, "pen", "override.en сохранён");
    assert.strictEqual(ovr.tr, "kalem", "override.tr сохранён");
    assert.strictEqual(ovr.ru, "ручка", "прежние поля не потеряны при merge");
    // произношение для озвучки: хранится рядом с правками, но написание не подменяет
    assert.strictEqual((await req("PUT", "/api/overrides/m0", { auth: ALT, body: { id: "m0_83", say: "/kɑlem sɑp/" } })).status, 200);
    const ovrSay = JSON.parse((await req("GET", "/api/overrides/m0", { auth: ILIM })).text).m0_83;
    assert.strictEqual(ovrSay.say, "/kɑlem sɑp/", "override.say сохранён");
    assert.strictEqual(ovrSay.ky, "калем", "say не затирает написание карточки");
    assert.strictEqual((await req("PUT", "/api/overrides/m0", { auth: ALT, body: { id: "m0_83", remove: true } })).status, 200);
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/overrides/m0", { auth: ILIM })).text), {});

    // --- аудио ---
    const fake = Buffer.alloc(1500, 7);
    assert.strictEqual((await req("PUT", "/api/audio/m0/m0_01.mp3", { auth: ILIM, body: fake, raw: true, ct: "audio/mpeg" })).status, 403);
    assert.strictEqual((await req("PUT", "/api/audio/m0/m0_01.mp3", { auth: ALT, body: fake, raw: true, ct: "audio/mpeg" })).status, 200);
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/audio/m0/list", { auth: ILIM })).text).sort(), ["m0_01", "ph_oz"]);
    const aud = await fetch(BASE + "/api/audio/m0/m0_01.mp3", { headers: { Authorization: ILIM } });
    assert.strictEqual(aud.status, 200);
    assert.strictEqual(aud.headers.get("content-type"), "audio/mpeg");
    assert.strictEqual((await aud.arrayBuffer()).byteLength, 1500);
    assert.strictEqual((await req("GET", "/api/audio/m0/nope.mp3", { auth: ILIM })).status, 404);
    // источник аудио: загрузка помечается «upload», TTS не смеет её перезаписать без force
    const meta1 = JSON.parse((await req("GET", "/api/audio/m0/meta", { auth: ILIM })).text);
    assert.strictEqual(meta1.m0_01.source, "upload", "загрузка помечена как кастомная");
    const overTts = await req("POST", "/api/tts/m0", { auth: ALT, body: { id: "m0_01", text: "Салам!" } });
    assert.strictEqual(overTts.status, 409, "TTS поверх кастомной записи запрещён: " + overTts.status);
    const forced = await req("POST", "/api/tts/m0", { auth: ALT, body: { id: "m0_01", text: "Салам!", force: true } });
    assert.notStrictEqual(forced.status, 409, "с force защита снимается (дальше падает лишь на фейковом ключе)");

    // --- секреты ---
    assert.strictEqual((await req("PUT", "/api/admin/secret", { auth: ALT, body: { name: "elevenlabs", value: "test-key" } })).status, 200, "altynai теперь admin — тоже видит секреты");
    assert.strictEqual((await req("PUT", "/api/admin/secret", { auth: VADIM, body: { name: "elevenlabs", value: "test-key" } })).status, 200);
    assert.ok(fs.existsSync(path.join(DATA, "secrets", "elevenlabs.key")));

    // --- сброс голосового оверрайда: /data/tts-voice сильнее env и реестра ---
    // файл пишет автофолбэк при недоступном голосе; снять его без шелла в контейнер
    // может только админ — и после сброса сервер обязан вернуться на голос реестра
    fs.writeFileSync(path.join(DATA, "tts-voice"), "CwhRBWXzGAHq8TQ4Fs17");
    assert.strictEqual((await req("DELETE", "/api/admin/tts-voice", { auth: ILIM })).status, 403, "ученик не сбрасывает голос");
    assert.ok(fs.existsSync(path.join(DATA, "tts-voice")), "отказ не трогает файл");
    const vreset = await req("DELETE", "/api/admin/tts-voice", { auth: VADIM });
    assert.strictEqual(vreset.status, 200, "админ сбрасывает оверрайд: " + vreset.text);
    assert.ok(!fs.existsSync(path.join(DATA, "tts-voice")), "оверрайд удалён");
    // голос по умолчанию — из реестра deploy/voices.json (голос — данные, не хардкод)
    const VREG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deploy", "voices.json"), "utf8"));
    assert.strictEqual(JSON.parse(vreset.text).voice, VREG.voices[VREG.default],
      "после сброса действует голос male_adult из реестра");
    assert.strictEqual((await req("DELETE", "/api/admin/tts-voice", { auth: VADIM })).status, 200, "повторный сброс идемпотентен");

    // --- tts без валидного ключа: аккуратная ошибка, не падение ---
    const tts = await req("POST", "/api/tts/m0", { auth: ALT, body: { id: "m0_02", text: "Салам!" } });
    assert.ok([502, 400].includes(tts.status), "tts с фейковым ключом отвечает ошибкой, сервер жив: " + tts.status);
    assert.strictEqual((await req("POST", "/api/tts/m0", { auth: ILIM, body: { id: "m0_02", text: "х" } })).status, 403);
    // тело «null» — валидный JSON без полей: раньше d.id бросал TypeError внутри колбэка
    // readBody, и падал весь процесс (ревью 25.09.2026); теперь 400, сервер жив
    const ttsNull = await req("POST", "/api/tts/m0", { auth: ALT, ct: "application/json", body: "null", raw: true });
    assert.strictEqual(ttsNull.status, 400, "tts: тело null отклонено, а не роняет процесс");
    assert.strictEqual((await req("GET", "/api/health")).status, 200, "сервер жив после тела null");
    // Тот же класс по всем ручкам с телом-объектом, включая /api/login — туда можно без входа:
    // JSON.parse("null") проходил, d.x бросал TypeError в колбэке, и падал весь процесс
    // (ревью /simplify 25.09.2026). Разбор теперь один — readJson.
    for (const [method, url, auth] of [["POST", "/api/login", null], ["PUT", "/api/review/m0", ALT], ["PUT", "/api/overrides/m0", ALT],
      ["PUT", "/api/admin/secret", VADIM], ["PUT", "/api/video/meta", ALT], ["POST", "/api/tts/sfx/m0", ALT],
      ["PUT", "/api/progress", ALT], ["POST", "/api/events", ALT], ["PUT", "/api/students", ALT]]) {
      for (const body of ["null", "[]", "7", '"x"']) {
        const r = await req(method, url, Object.assign({ ct: "application/json", body, raw: true }, auth ? { auth } : {}));
        assert.strictEqual(r.status, 400, method + " " + url + " с телом " + body + " — 400, сейчас " + r.status);
      }
      assert.strictEqual((await req("GET", "/api/health")).status, 200, "сервер жив после " + url);
    }
    // единственный разбор тела-объекта — readJson: голый JSON.parse(body) в ручке снова открыл бы падение
    assert.ok(!/JSON\.parse\(body\)/.test(SRV_SRC.replace(/function readJson[\s\S]*?\n\}/, "")),
      "в ручках нет голого JSON.parse(body) — только readJson");

    // --- ученики: тропа модулей и приостановка (контракт granted/locked) ---
    const modmap = (me) => Object.fromEntries(me.modules.map((m) => [m.id, m.status]));
    assert.strictEqual((await req("GET", "/api/students", { auth: ILIM })).status, 403, "список — только преподавателю");
    const students = JSON.parse((await req("GET", "/api/students", { auth: ALT })).text);
    const ilimRow = students.find((s) => s.login === "ilim");
    assert.strictEqual(ilimRow.modules.length, 12, "тропа из 12 модулей");
    assert.strictEqual(ilimRow.modules[0].id, "m0");
    assert.strictEqual(ilimRow.modules[0].status, "open", "М0 открыт по умолчанию");
    assert.strictEqual(ilimRow.modules[1].status, "locked", "М1 закрыт до сдачи М0");
    assert.deepStrictEqual(ilimRow.granted, []);
    assert.deepStrictEqual(ilimRow.locked, []);
    assert.strictEqual(ilimRow.suspended, false);
    assert.strictEqual((await req("PUT", "/api/students", { auth: ILIM, body: { login: "altynai", suspended: true } })).status, 403, "ученик не управляет чужими");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ILIM, body: { login: "ilim", suspended: true } })).status, 400, "и на себе — только пароль");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "vadim", suspended: true } })).status, 400, "админа менять нельзя");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ghost", suspended: true } })).status, 400, "неизвестный логин");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", granted: ["hack!"] } })).status, 400, "кривой id модуля");
    // приостановка
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", suspended: true } })).status, 200);
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } })).status, 403, "вход закрыт");
    assert.strictEqual((await req("GET", "/api/me", { auth: ILIM })).status, 403, "API закрыт");
    assert.ok((await req("GET", "/", { auth: ILIM })).text.includes("Кириңиз"), "вместо приложения — форма входа");
    assert.ok((await req("GET", "/login", { auth: ILIM })).text.includes("Кириңиз"), "и на /login тоже форма, а не 403");
    assert.ok((await req("GET", "/landing", { auth: ILIM })).text.includes('data-i="hero_h1"'), "витрина доступна и приостановленному");
    assert.strictEqual((await req("GET", "/demo/ru", { auth: ILIM })).status, 200, "демо доступно приостановленному");
    assert.strictEqual((await req("GET", "/api/audio/m0/m0_01.mp3", { auth: ILIM })).status, 200,
      "и озвучка в демо у него звучит: страница без звука — сломанное демо");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", suspended: false } })).status, 200, "возобновление");
    assert.strictEqual((await req("GET", "/login", { auth: ILIM })).status, 302, "вошедшему /login — редирект в тренажёр");
    assert.ok((await req("GET", "/index.html", { auth: ILIM })).text.includes("===DATA==="), "вошедшему старые адреса — приложение");
    // lock/unlock: закрытие преподавателем сильнее всего
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", locked: ["m0"] } })).status, 200);
    assert.strictEqual(modmap(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text)).m0, "locked_by_teacher");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", locked: [] } })).status, 200);
    assert.strictEqual(modmap(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text)).m0, "open");

    // --- курсы: выдача, отъём, валидация (мульти-курсная модель) ---
    const meIlim = JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text);
    assert.deepStrictEqual(meIlim.courses, ["a1"], "дефолт ученика — курс a1 (без миграции файла)");
    assert.deepStrictEqual(students.find((s) => s.login === "ilim").courses, ["a1"], "строка списка несёт courses");
    const meAlt = JSON.parse((await req("GET", "/api/me", { auth: ALT })).text);
    assert.deepStrictEqual(meAlt.courses, ["a1", "a2", "b1", "b2"], "преподавателю видны все курсы реестра");
    // барьер курсов: ученик БЕЗ a2 не видит m12 в тропе вообще
    assert.ok(!modmap(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text)).m12,
      "модуль невыданного курса не отдаётся вовсе");
    // выдача второго курса: его первый модуль открывается (виртуальный prevPassed курса)
    const putC = await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a2", "a1"] } });
    assert.strictEqual(putC.status, 200, "teacher выдаёт курсы");
    assert.deepStrictEqual(JSON.parse(putC.text).student.courses, ["a1", "a2"], "порядок курсов канонизируется");
    const meBoth = JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text);
    assert.deepStrictEqual(meBoth.courses, ["a1", "a2"]);
    // метрика дня одна на всех потребителей: /api/me отдаёт тот же агрегат, что дашборд
    assert.ok(meBoth.day && typeof meBoth.day.ans === "number" && typeof meBoth.day.streak === "number"
      && /^\d{4}-\d{2}-\d{2}$/.test(meBoth.day.key), "/api/me отдаёт day:{key,ans,streak}");
    // состав, а не длина: тропа = модули выданных курсов в порядке реестра —
    // ассерт остаётся верным при каждом следующем модуле A2 без подкрутки числа
    assert.deepStrictEqual(meBoth.modules.map((m) => m.id), [...REGISTRY.a1, ...REGISTRY.a2],
      "тропа обоих курсов = реестр a1 + реестр a2");
    assert.strictEqual(modmap(meBoth)[REGISTRY.a2[0]], "open", "первый модуль выданного курса открыт");
    for (const id of REGISTRY.a2.slice(1)) assert.strictEqual(modmap(meBoth)[id], "locked",
      id + " заперт до сдачи предыдущего (цепочка внутри курса)");
    // валидация
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: [] } })).status, 400, "пустой список курсов запрещён (для бана есть suspended)");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["b7"] } })).status, 400, "неизвестный курс");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a1", "a1"] } })).status, 400, "дубли не принимаются молча");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ILIM, body: { login: "ilim", courses: ["a1"] } })).status, 400, "ученик себе курсы не выдаёт");
    // отъём курса возвращает как было
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a1"] } })).status, 200);
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text).courses, ["a1"]);
    // Отъём курса ВЫЧИЩАЕТ его granted/locked — единственный путь, где новый код
    // переписывает данные ученика; courses:["a2"] валиден уже сейчас (сдал A1 вне тренажёра)
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", granted: ["m3"], locked: ["m1"] } })).status, 200);
    const onlyA2 = JSON.parse((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a2"] } })).text).student;
    assert.deepStrictEqual(onlyA2.courses, ["a2"], "остаться только с a2 можно (сдал A1 вне тренажёра)");
    assert.deepStrictEqual(onlyA2.granted, [], "отъём a1 вычистил granted его модулей");
    assert.deepStrictEqual(onlyA2.locked, [], "и locked");
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text).modules.map((m) => m.id), REGISTRY.a2,
      "у a2-only ученика — только модули a2 (барьер: ни одного a1)");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", granted: ["m3"] } })).status, 400,
      "granted модуля невыданного курса — 400, не молчаливый no-op");
    const ovA2 = JSON.parse((await req("GET", "/api/stats/overview", { auth: ALT })).text).find((r) => r.login === "ilim");
    assert.strictEqual(ovA2.progress, 0, "прогресс a2-ученика без сданного — 0, не NaN и не 13/12");
    // комбинированный запрос: d.courses применяется ПЕРВЫМ, granted валидируется по итогу
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a1", "a2"], granted: ["m3"] } })).status, 200,
      "granted валидируется по итоговым курсам из этого же запроса");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "ilim", courses: ["a1"], granted: [], locked: [] } })).status, 200, "вернули исходное");
    // create: courses пишутся при создании; без courses ключ в файл НЕ попадает (откат-совместимость);
    // остаточная запись прежнего владельца логина не влияет на валидацию create (чистый лист)
    const crt = JSON.parse((await req("PUT", "/api/students", { auth: ALT, body: { login: "tcrs", create: true, password: "Tc-123456", courses: ["a2", "a1"] } })).text).student;
    assert.deepStrictEqual(crt.courses, ["a1", "a2"], "create с courses — канонизировано и записано");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tcrs", courses: ["a2"] } })).status, 200); // остаточная запись: courses=["a2"]
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tcrs", remove: true } })).status, 200);
    const rec = await req("PUT", "/api/students", { auth: ALT, body: { login: "tcrs", create: true, password: "Tc-654321", granted: ["m3"] } });
    assert.strictEqual(rec.status, 200, "create поверх остатка с courses:['a2']: granted валидируется по чистому листу a1");
    assert.deepStrictEqual(JSON.parse(rec.text).student.courses, ["a1"], "create без courses — дефолт a1");
    {
      const sj = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      assert.ok(!("courses" in sj.tcrs), "create без courses не пишет ключ в файл (откат-совместимость)");
      // мусорный courses в файле (ручная правка) → дефолт a1, сервер жив
      sj.ilim.courses = ["zz"];
      fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(sj));
      assert.deepStrictEqual(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text).courses, ["a1"], "неизвестный курс в файле → дефолт a1");
      sj.ilim.courses = "a1";
      fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(sj));
      assert.deepStrictEqual(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text).courses, ["a1"], "строка вместо массива → дефолт a1");
      delete sj.ilim.courses;
      fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(sj));
    }
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tcrs", remove: true } })).status, 200);

    // --- тропа: авто-прогрессия, монотонность, downgrade ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", create: true, password: "Aida-123" } })).status, 200);
    const AIDA = B("aida", "Aida-123");
    let aidaMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text));
    assert.strictEqual(aidaMods.m0, "open");
    assert.strictEqual(aidaMods.m1, "locked");
    assert.strictEqual(aidaMods.m11, "locked");
    // преподаватель видит все модули открытыми
    const altMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: ALT })).text));
    assert.ok(Object.values(altMods).every((s) => s === "open"), "teacher: всё open");
    // v2-прогресс со сданным М0 → М1 открывается
    const v2 = (test, mods = ["m0"]) => ({ v: 2, updatedAt: "2026-01-02T00:00:00Z", settings: {},
      modules: Object.fromEntries(mods.map((mid) => [mid, { vocab: {}, test }])) });
    assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: v2({ everPassed: true, lastAttempt: { score: 17, passed: true, date: "2026-01-02" }, consecutiveFails: 0, attempts: [{ score: 17, date: "2026-01-02" }] }) })).status, 200);
    aidaMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text));
    assert.strictEqual(aidaMods.m0, "passed");
    assert.strictEqual(aidaMods.m1, "open", "М1 открыт после сдачи М0");
    assert.strictEqual(aidaMods.m2, "locked");
    // монотонность: пересдача с провалом НЕ закрывает М1
    assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: v2({ everPassed: true, lastAttempt: { score: 9, passed: false, date: "2026-01-03" }, consecutiveFails: 1, attempts: [{ score: 17, date: "2026-01-02" }, { score: 9, date: "2026-01-03" }] }) })).status, 200);
    aidaMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text));
    assert.strictEqual(aidaMods.m0, "passed", "everPassed монотонен");
    assert.strictEqual(aidaMods.m1, "open", "провал пересдачи не запирает М1");
    // Устаревшая копия со второго устройства (everPassed ещё false, в истории только провал)
    // не стирает сдавшую попытку: попытки объединяются, lastAttempt — из полной истории
    // (реальная потеря 16/20 у ученицы 12.09.2026).
    {
      const full = v2({ everPassed: true, lastAttempt: { score: 16, total: 20, passed: true, date: "2026-09-12", wrong: ["m0_09"] }, consecutiveFails: 0,
        attempts: [{ score: 9, date: "2026-09-12", wrong: ["m0_68"] }, { score: 16, date: "2026-09-12", wrong: ["m0_09"] }] });
      full.updatedAt = "2026-09-12T13:01:00Z";
      assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: full })).status, 200);
      const stale = v2({ everPassed: false, lastAttempt: { score: 9, total: 20, passed: false, date: "2026-09-12", wrong: ["m0_68"] }, consecutiveFails: 1,
        attempts: [{ score: 9, date: "2026-09-12", wrong: ["m0_68"] }] });
      stale.updatedAt = "2026-09-12T06:01:00Z";
      const staleRes = await req("PUT", "/api/progress", { auth: AIDA, body: stale });
      assert.strictEqual(staleRes.status, 200);
      assert.strictEqual(JSON.parse(staleRes.text).restored, true, "ответ сообщает, что сервер вернул потерянное — клиент заберёт копию");
      const got = JSON.parse((await req("GET", "/api/progress", { auth: AIDA })).text).modules.m0.test;
      assert.strictEqual(got.everPassed, true, "everPassed монотонен и после устаревшей копии");
      const sept = (a) => a.filter((x) => x.date === "2026-09-12");
      assert.strictEqual(sept(got.attempts).length, 2, "попытки объединены, сдача не потеряна: " + JSON.stringify(got.attempts));
      assert.ok(got.attempts.some((x) => x.score === 17), "прежняя история сьюта тоже цела (объединение, не замена)");
      assert.strictEqual(got.lastAttempt.score, 16, "lastAttempt — из полной истории, не из усечённой");
      assert.strictEqual(got.consecutiveFails, 0, "счётчик провалов — от той же стороны, что lastAttempt");
      // а новая честная попытка позже — принимается и становится последней
      const later = v2({ everPassed: true, lastAttempt: { score: 12, total: 20, passed: false, date: "2026-09-14", wrong: [] }, consecutiveFails: 1,
        attempts: [{ score: 9, date: "2026-09-12", wrong: ["m0_68"] }, { score: 16, date: "2026-09-12", wrong: ["m0_09"] }, { score: 12, date: "2026-09-14", wrong: [] }] });
      later.updatedAt = "2026-09-14T10:00:00Z";
      assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: later })).status, 200);
      // копия, равная серверной, ничего не восстанавливает — клиенту тянуть нечего
      const same = JSON.parse((await req("GET", "/api/progress", { auth: AIDA })).text);
      assert.strictEqual(JSON.parse((await req("PUT", "/api/progress", { auth: AIDA, body: same })).text).restored, false, "полная копия — restored:false");
      const got2 = JSON.parse((await req("GET", "/api/progress", { auth: AIDA })).text).modules.m0.test;
      assert.ok(got2.attempts.some((x) => x.score === 12 && x.date === "2026-09-14"), "новая попытка добавлена");
      assert.strictEqual(got2.lastAttempt.score, 12, "более поздняя попытка стала последней");
      // Копия, подписанная другим логином (вкладка пережила смену аккаунта) — 409, файл не тронут
      const foreign = Object.assign({}, later, { login: "altynai", updatedAt: "2026-09-15T02:58:00Z" });
      foreign.modules = Object.assign({}, later.modules, { m5: { vocab: { m5_01: { box: 3 } }, test: {} } });
      assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: foreign })).status, 409, "чужая копия отвергнута");
      assert.ok(!JSON.parse((await req("GET", "/api/progress", { auth: AIDA })).text).modules.m5, "и в файл ничего не попало");
      // Ремонт прогресса админом: GET отдаёт файл ученика, PUT заменяет без слияния, чужим — 403
      const admGet = await req("GET", "/api/admin/progress/aida", { auth: ALT });
      assert.strictEqual(admGet.status, 200, "админ читает прогресс ученика");
      assert.strictEqual(JSON.parse(admGet.text).modules.m0.test.lastAttempt.score, 12, "ручка отдаёт живой файл ученика");
      assert.strictEqual((await req("GET", "/api/admin/progress/aida", { auth: AIDA })).status, 403, "ученику ручка закрыта");
      assert.strictEqual((await req("GET", "/api/admin/progress/nobody", { auth: ALT })).status, 400, "неизвестный логин — 400");
      const repaired = v2({ everPassed: true, lastAttempt: { score: 16, total: 20, passed: true, date: "2026-09-12", wrong: ["m0_09"] }, consecutiveFails: 0,
        attempts: [{ score: 16, date: "2026-09-12", wrong: ["m0_09"] }] });
      const put = await req("PUT", "/api/admin/progress/aida", { auth: ALT, body: repaired });
      assert.strictEqual(put.status, 200, "админ заменил прогресс: " + put.text);
      assert.ok(JSON.parse(put.text).bak, "прежняя копия сохранена рядом");
      const after = JSON.parse((await req("GET", "/api/progress", { auth: AIDA })).text).modules.m0.test;
      assert.strictEqual(after.attempts.length, 1, "замена — без слияния с прежним файлом");
      assert.strictEqual((await req("PUT", "/api/admin/progress/aida", { auth: ALT, body: { v: 1 } })).status, 400, "мусор не принимается");
      // вернуть ученику полную историю для дальнейших проверок сьюта
      assert.strictEqual((await req("PUT", "/api/admin/progress/aida", { auth: ALT, body: later })).status, 200);
    }
    // downgrade-защита: v1-payload при v2-файле → 409
    assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: { v: 1, vocab: {}, test: null, updatedAt: "2026-01-04T00:00:00Z" } })).status, 409, "откат версии отклонён");
    // sanity: v2 без modules → 400
    assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: { v: 2, updatedAt: "x" } })).status, 400);
    // grant досрочно / lock сданного
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", granted: ["m3"] } })).status, 200);
    aidaMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text));
    assert.strictEqual(aidaMods.m3, "open", "открыт досрочно");
    assert.strictEqual(aidaMods.m2, "locked", "grant не трогает соседей");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", locked: ["m0"] } })).status, 200);
    aidaMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text));
    assert.strictEqual(aidaMods.m0, "locked_by_teacher", "лок сильнее passed");
    assert.strictEqual(aidaMods.m1, "open", "цепочка идёт по everPassed, лок М0 не отбирает М1");
    // выпускник A1 без выданного a2: сдан ВЕСЬ курс — первый модуль A2 всё равно не появляется
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", locked: [] } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/progress", { auth: AIDA, body: v2({ everPassed: true }, REGISTRY.a1) })).status, 200);
    const gradMods = JSON.parse((await req("GET", "/api/me", { auth: AIDA })).text).modules;
    assert.ok(gradMods.every((m) => m.status === "passed"), "весь a1 сдан");
    assert.ok(!gradMods.some((m) => m.id === REGISTRY.a2[0]), "выпускник A1 без гранта курса не видит модулей A2");
    // v1-fallback: st.test.passed => m0 passed (файл ilim всё ещё v1)
    assert.strictEqual((await req("PUT", "/api/progress", { auth: ILIM, body: { v: 1, vocab: {}, test: { score: 16, passed: true, date: "2026-01-05", wrong: [] }, updatedAt: "2026-01-05T00:00:00Z" } })).status, 200);
    const ilimMods = modmap(JSON.parse((await req("GET", "/api/me", { auth: ILIM })).text));
    assert.strictEqual(ilimMods.m0, "passed", "v1-fallback");
    assert.strictEqual(ilimMods.m1, "open");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", remove: true } })).status, 200);

    // --- управление учениками: создать / сменить пароль / удалить ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "nur", create: true, password: "Nur-123" } })).status, 200, "создание ученика");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("nur", "Nur-123") })).text).role, "student");
    assert.ok(JSON.parse((await req("GET", "/api/students", { auth: ALT })).text).some((s) => s.login === "nur"), "в списке");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "nur", create: true, password: "x12345" } })).status, 400, "дубль логина");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "bad name", create: true, password: "x12345" } })).status, 400, "кривой логин");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "nur", create: true, password: "x" } })).status, 400, "слишком короткий пароль");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "vadim", password: "pwned" } })).status, 400, "пароль админа менять нельзя");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "nur", password: "Nur-456" } })).status, 200, "смена пароля");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("nur", "Nur-123") })).status, 401, "старый пароль мёртв");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("nur", "Nur-456") })).text).login, "nur");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "nur", remove: true } })).status, 200, "удаление");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("nur", "Nur-456") })).status, 401, "удалённый не входит");
    assert.ok(!JSON.parse((await req("GET", "/api/students", { auth: ALT })).text).some((s) => s.login === "nur"), "из списка исчез");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "vadim", remove: true } })).status, 400, "админа не удалить");

    // --- учителя: только admin создаёт, эскалация закрыта, cookie отзывается паролем ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", create: true, password: "Aigul-123", role: "teacher" } })).status, 200, "админ создаёт учителя");
    const AIGUL = B("aigul", "Aigul-123");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: AIGUL })).text).role, "teacher");
    const extraAfterCreate = JSON.parse(fs.readFileSync(path.join(DATA, "users-extra.json"), "utf8"));
    assert.strictEqual(extraAfterCreate.aigul.role, "teacher", "роль сохранена в оверлее — переживёт рестарт");

    // учитель видит и создаёт только учеников
    const aigulList = JSON.parse((await req("GET", "/api/students", { auth: AIGUL })).text);
    assert.ok(aigulList.every((s) => s.role === "student"), "учитель не видит других учителей/админов в списке");
    assert.strictEqual((await req("PUT", "/api/students", { auth: AIGUL, body: { login: "temir", create: true, password: "Temir-123" } })).status, 200, "учитель создаёт ученика");
    assert.strictEqual((await req("PUT", "/api/admin/secret", { auth: AIGUL, body: { name: "elevenlabs", value: "y" } })).status, 403, "учитель — не админ");

    // эскалация закрыта
    assert.strictEqual((await req("PUT", "/api/students", { auth: AIGUL, body: { login: "someone", create: true, password: "Someone1", role: "teacher" } })).status, 403, "учитель не создаёт учителей");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("someone", "Someone1") })).status, 401, "и аккаунт не появился");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "anyone", create: true, password: "Anyone12", role: "admin" } })).status, 400, "роль admin через API недопустима даже для админа");
    assert.strictEqual((await req("PUT", "/api/students", { auth: AIGUL, body: { login: "aigul2", create: true, password: "Aigul2-12", role: "Teacher" } })).status, 400, "строгая валидация роли");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "temir", role: "teacher" } })).status, 400, "смена роли без create не поддерживается");

    // К1: роль не переживает remove — пересозданный логин не наследует teacher
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", create: true, password: "Kanat-123", role: "teacher" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", remove: true } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: AIGUL, body: { login: "kanat", create: true, password: "Kanat-456" } })).status, 200, "любой учитель создаёт ученика на б/у логине");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("kanat", "Kanat-456") })).text).role, "student", "роль не унаследована от удалённого учителя");

    // cookie отзывается remove и сменой пароля (подпись сессии привязана к паролю)
    const lgK = await req("POST", "/api/login", { body: { login: "kanat", password: "Kanat-456" } });
    assert.strictEqual(lgK.status, 200);
    const kanatCookie = (lgK.headers.get("set-cookie") || "").split(";")[0];
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", remove: true } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { cookie: kanatCookie })).status, 401, "cookie мертва после remove");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", create: true, password: "Kanat-789" } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { cookie: kanatCookie })).status, 401, "старая cookie не оживает при пересоздании логина");
    const lgK2 = await req("POST", "/api/login", { body: { login: "kanat", password: "Kanat-789" } });
    const kanatCookie2 = (lgK2.headers.get("set-cookie") || "").split(";")[0];
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", password: "Kanat-000" } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { cookie: kanatCookie2 })).status, 401, "cookie отзывается сменой пароля");

    // create сбрасывает students.json — suspended прежнего владельца логина не переходит новому
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", suspended: true } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", remove: true } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "kanat", create: true, password: "Kanat-final", role: "teacher" } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { auth: B("kanat", "Kanat-final") })).status, 200, "suspended не унаследован новым владельцем логина");

    // admin управляет учителем: пароль, приостановка, модули — запрещены, удаление
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", password: "Aigul-999" } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { auth: AIGUL })).status, 401, "старый пароль учителя мёртв");
    const AIGUL2 = B("aigul", "Aigul-999");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", suspended: true } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { auth: AIGUL2 })).status, 403, "приостановленный учитель не проходит");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", suspended: false } })).status, 200);
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: AIGUL2 })).text).role, "teacher", "возобновлён");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", granted: ["m1"] } })).status, 400, "модули — только ученикам");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "aigul", remove: true } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { auth: AIGUL2 })).status, 401, "уволенный учитель не входит");

    // self-service: teacher/admin меняет только свой пароль, ничего больше
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "elmira", create: true, password: "Elmira-123", role: "teacher" } })).status, 200);
    const ELMIRA = B("elmira", "Elmira-123");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ELMIRA, body: { login: "elmira", password: "Elmira-456" } })).status, 200, "сам себе меняет пароль");
    assert.strictEqual((await req("GET", "/api/me", { auth: ELMIRA })).status, 401, "старый пароль мёртв после self-service");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("elmira", "Elmira-456") })).text).role, "teacher");
    assert.strictEqual((await req("PUT", "/api/students", { auth: B("elmira", "Elmira-456"), body: { login: "elmira", suspended: true } })).status, 400, "на себе — только пароль");

    // защита админов: altynai/vadim не трогать; и порча users-extra.json не выключает базового админа (К2)
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "altynai", remove: true } })).status, 400, "altynai — админ, не удаляется");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "vadim", suspended: true } })).status, 400, "vadim — админ, не приостанавливается");
    const extraFile = path.join(DATA, "users-extra.json");
    const extraNow = JSON.parse(fs.readFileSync(extraFile, "utf8"));
    extraNow.vadim = { removed: true };
    fs.writeFileSync(extraFile, JSON.stringify(extraNow));
    // любая следующая мутация перечитывает users-extra.json и пересобирает USERS
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "triggerrebuild", create: true, password: "Trigger-123" } })).status, 200);
    assert.strictEqual((await req("GET", "/api/me", { auth: VADIM })).status, 200, "правка users-extra.json не может выключить базового админа (К2)");

    // --- устойчивость к вредным входам: прототип, битая cookie, типы ---
    // логин-«__proto__» заражал бы Object.prototype через Object.assign в mutateUsersExtra:
    // после этого КАЖДОЕ тело запроса наследовало бы .role и всё управление отвечало бы 400
    for (const bad of ["__proto__", "constructor", "prototype"]) {
      assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: bad, create: true, password: "pwned123" } })).status, 400, "служебное имя как логин отвергнуто: " + bad);
    }
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "canary", create: true, password: "Canary-12" } })).status, 200, "создание живо после попытки заражения прототипа");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "canary", suspended: true } })).status, 200, "и обычное обновление тоже (заражённый прототип дал бы 400)");
    // битый процент-эскейп в анонимной cookie ронял процесс (URIError из decodeURIComponent)
    assert.strictEqual((await req("GET", "/api/me", { cookie: "kga1=%zz.x" })).status, 401, "битая cookie — 401");
    assert.strictEqual((await req("GET", "/api/health")).status, 200, "сервер жив после битой cookie");
    // пароль только строкой: String({}) дал бы «[object Object]» длиной 15 — «валидный» пароль
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "objpass", create: true, password: {} } })).status, 400, "пароль-объект отвергнут");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "numpass", create: true, password: 12345678 } })).status, 400, "пароль-число отвергнуто");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "combo", create: true, password: "Combo-123", remove: true } })).status, 400, "create+remove — противоречие");
    // валидация модулей до записи: при 400 аккаунт не должен появиться
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "backdoor", create: true, password: "secret12", granted: ["hack!"] } })).status, 400, "кривой granted при create");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("backdoor", "secret12") })).status, 401, "аккаунт не создан вопреки 400");

    // --- смена своего пароля: доступна всем ролям, кроме админа (его учётка — только в users.json) ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "vadim", password: "NewAdmin-1" } })).status, 400, "админу self-service запрещён: оверлей для него игнорируется");
    assert.strictEqual((await req("GET", "/api/me", { auth: VADIM })).status, 200, "пароль админа не изменился и не «потерялся»");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "puser", create: true, password: "Puser-123" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: B("puser", "Puser-123"), body: { login: "puser", password: "Puser-456" } })).status, 200, "ученик меняет свой пароль сам");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("puser", "Puser-123") })).status, 401, "старый пароль ученика мёртв");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("puser", "Puser-456") })).text).role, "student");

    // --- пересозданный логин не наследует прогресс прежнего владельца ---
    assert.strictEqual((await req("PUT", "/api/progress", { auth: B("puser", "Puser-456"), body: v2({ everPassed: true, lastAttempt: { score: 18, passed: true, date: "2026-01-02" }, consecutiveFails: 0, attempts: [] }) })).status, 200);
    assert.strictEqual(modmap(JSON.parse((await req("GET", "/api/me", { auth: B("puser", "Puser-456") })).text)).m0, "passed");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "puser", remove: true } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "puser", create: true, password: "Puser-789" } })).status, 200);
    const reborn = modmap(JSON.parse((await req("GET", "/api/me", { auth: B("puser", "Puser-789") })).text));
    assert.strictEqual(reborn.m0, "open", "новый владелец логина не получает чужой сданный модуль");
    assert.strictEqual(reborn.m1, "locked", "и не получает открытую по нему тропу");
    assert.ok(fs.readdirSync(path.join(DATA, "progress")).some((f) => f.startsWith("puser.json.") && f.endsWith(".bak")), "прогресс прежнего владельца сохранён в архив");

    // --- матрица прав: непокрытые ветки ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "t1", create: true, password: "T1-12345", role: "teacher" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "t2", create: true, password: "T2-12345", role: "teacher" } })).status, 200);
    const T1 = B("t1", "T1-12345");
    assert.strictEqual((await req("PUT", "/api/students", { auth: T1, body: { login: "t2", password: "Hacked-1" } })).status, 403, "учитель не меняет пароль другому учителю");
    assert.strictEqual((await req("PUT", "/api/students", { auth: T1, body: { login: "t2", remove: true } })).status, 403, "учитель не удаляет другого учителя");
    assert.strictEqual((await req("PUT", "/api/students", { auth: T1, body: { login: "t2", suspended: true } })).status, 403, "учитель не приостанавливает другого учителя");
    assert.strictEqual((await req("PUT", "/api/students", { auth: T1, body: { login: "vadim", suspended: true } })).status, 400, "учитель не трогает админа");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "t3", create: true, password: "T3-12345", role: "teacher", suspended: true } })).status, 400, "учителя нельзя создать сразу приостановленным");

    // --- оверлей не может выдать роль admin и не воскрешает мусорные роли ---
    const extraPath = path.join(DATA, "users-extra.json");
    const ex = JSON.parse(fs.readFileSync(extraPath, "utf8"));
    ex.t1 = Object.assign({}, ex.t1, { role: "admin" });
    ex.t2 = Object.assign({}, ex.t2, { role: "superuser" });
    fs.writeFileSync(extraPath, JSON.stringify(ex));
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "rebuild1", create: true, password: "Rebuild-1" } })).status, 200); // мутация пересобирает USERS
    // Невалидная роль в оверлее не принимается, и права не «дотягиваются» до неё:
    // запись остаётся без роли, а значит пользователь падает до student — fail-safe, а не эскалация.
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: T1 })).text).role, "student", "роль admin из оверлея не выдаётся");
    assert.strictEqual(JSON.parse((await req("GET", "/api/me", { auth: B("t2", "T2-12345") })).text).role, "student", "мусорная роль из оверлея не выдаётся");
    assert.strictEqual((await req("PUT", "/api/admin/secret", { auth: T1, body: { name: "elevenlabs", value: "z" } })).status, 403, "и секреты по-прежнему закрыты");

    // --- suspended в students.json не запирает админа (иначе тупик: разблокировать некому) ---
    const smap = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
    smap.vadim = { suspended: true, by: "manual", at: "2026-01-01T00:00:00Z" };
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(smap));
    assert.strictEqual((await req("GET", "/api/me", { auth: VADIM })).status, 200, "админ проходит вопреки suspended");
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "vadim", password: "Tst-sFVPwRvG-9" } })).status, 200, "и входит формой");
    delete smap.vadim;
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(smap));

    // --- владение учениками: кто завёл, тот и преподаватель ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ownt", create: true, password: "Ownt-1234", role: "teacher" } })).status, 200);
    const OWNT = B("ownt", "Ownt-1234");
    const madeByTeacher = JSON.parse((await req("PUT", "/api/students", { auth: OWNT, body: { login: "pupil1", create: true, password: "Pupil-123" } })).text);
    assert.strictEqual(madeByTeacher.student.owner, "ownt", "заводящий становится владельцем");
    const madeByAdmin = JSON.parse((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil2", create: true, password: "Pupil-456" } })).text);
    assert.strictEqual(madeByAdmin.student.owner, "vadim");
    // владелец не меняется при обычных правках — иначе ученик «переезжал» бы к тому, кто последним его трогал
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil1", granted: ["m3"] } })).status, 200);
    assert.strictEqual(JSON.parse((await req("GET", "/api/students", { auth: VADIM })).text).find((s) => s.login === "pupil1").owner, "ownt", "правка чужого ученика не переносит его к правившему");
    // передача — только админом
    assert.strictEqual((await req("PUT", "/api/students", { auth: OWNT, body: { login: "pupil2", owner: "ownt" } })).status, 403, "учитель не может забрать чужого ученика");
    assert.strictEqual(JSON.parse((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil2", owner: "ownt" } })).text).student.owner, "ownt", "админ передаёт ученика");
    assert.strictEqual(JSON.parse((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil2", owner: "" } })).text).student.owner, "", "и может снять преподавателя");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil2", owner: "ghost" } })).status, 400, "владельцем может быть только преподаватель");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "pupil2", owner: "pupil1" } })).status, 400, "ученик не может быть владельцем");
    // Новый контракт (решение владельца): owner допустим любой роли — учитель/админ
    // тоже проходит курс как ученик, и его результаты идут в очередь внимания наставника.
    assert.strictEqual(JSON.parse((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ownt", owner: "vadim" } })).text).student.owner, "vadim", "учителю можно назначить наставника");
    assert.strictEqual(JSON.parse((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ownt", owner: "" } })).text).student.owner, "", "и снять его");
    // ученики уволенного преподавателя не исчезают — владелец просто перестаёт существовать
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ownt", remove: true } })).status, 200);
    assert.strictEqual(JSON.parse((await req("GET", "/api/students", { auth: VADIM })).text).find((s) => s.login === "pupil1").owner, "ownt", "ссылка на удалённого сохраняется — интерфейс покажет «преподаватель удалён»");

    // --- правка users-extra.json мимо API подхватывается без рестарта ---
    // (без этого реплика/ручная правка узнавала бы о смене пароля только сделав мутацию сама)
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "extuser", create: true, password: "Ext-12345" } })).status, 200);
    const extFile = path.join(DATA, "users-extra.json");
    const extNow = JSON.parse(fs.readFileSync(extFile, "utf8"));
    extNow.extuser = { password: "Ext-99999", removed: false, role: "student" };
    fs.writeFileSync(extFile, JSON.stringify(extNow));
    assert.strictEqual((await req("GET", "/api/me", { auth: B("extuser", "Ext-99999") })).status, 200, "новый пароль из файла работает сразу");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("extuser", "Ext-12345") })).status, 401, "старый — уже нет");
    extNow.extuser = { removed: true };
    fs.writeFileSync(extFile, JSON.stringify(extNow));
    assert.strictEqual((await req("GET", "/api/me", { auth: B("extuser", "Ext-99999") })).status, 401, "удаление правкой файла тоже мгновенно");
    assert.ok(logs.some((l) => /\[users\] INFO: reloaded after external change \{/.test(l)), "перечитывание видно в логах");

    // --- пользователи из users.json удаляются только правкой файла ---
    // иначе надгробие в оверлее сильнее базы: правишь users.json, а человек молча не входит
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ilim", remove: true } })).status, 400, "базового ученика через API не удалить");
    assert.strictEqual((await req("GET", "/api/me", { auth: ILIM })).status, 200, "и он продолжает работать");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ilim", suspended: true } })).status, 200, "но приостановить можно");
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } })).status, 403);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "ilim", suspended: false } })).status, 200);

    // --- suspended админа не показывается в списке: сервер его всё равно игнорирует ---
    const smap2 = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
    smap2.vadim = { suspended: true, by: "manual", at: "2026-01-01T00:00:00Z" };
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(smap2));
    const vadimRow = JSON.parse((await req("GET", "/api/students", { auth: ALT })).text).find((s) => s.login === "vadim");
    assert.strictEqual(vadimRow.suspended, false, "список не врёт: админ активен, раз гейты его пропускают");
    delete smap2.vadim;
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(smap2));

    // --- лимит перебора паролей на форме входа ---
    let sawLimit = 0;
    for (let i = 0; i < 25; i++) {
      const r = await req("POST", "/api/login", { body: { login: "ilim", password: "nope" + i } });
      if (r.status === 429) { sawLimit = i; break; }
      assert.strictEqual(r.status, 401, "до лимита — обычный 401");
    }
    assert.ok(sawLimit > 0 && sawLimit <= 21, "перебор упирается в 429 после ~20 попыток, а не бесконечен: " + sawLimit);
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" } })).status, 429, "верный пароль тоже ждёт: лимит по адресу, а не по логину");
    assert.strictEqual((await req("GET", "/api/me", { auth: ILIM })).status, 200, "basic auth для скриптов не ограничен");
    // Адрес клиента — последний элемент X-Forwarded-For (его дописывает наш прокси), а не
    // первый (его пишет сам клиент): иначе смена первого элемента на каждой попытке обходила
    // лимит входа и антиспам чата (ревью 25.09.2026). Здесь прокси нет — последний элемент
    // «5.5.5.5» играет роль адреса, дописанного прокси, первый меняется на каждой попытке.
    let xffLimit = 0;
    for (let i = 0; i < 25; i++) {
      const r = await req("POST", "/api/login", { body: { login: "ilim", password: "nope" + i },
        headers: { "x-forwarded-for": "10.0.0." + i + ", 5.5.5.5" } });
      if (r.status === 429) { xffLimit = i; break; }
      assert.strictEqual(r.status, 401, "до лимита — обычный 401");
    }
    assert.ok(xffLimit > 0 && xffLimit <= 21, "подмена первого элемента X-Forwarded-For не обходит лимит: " + xffLimit);
    assert.strictEqual((await req("POST", "/api/login", { body: { login: "ilim", password: "Tst-vKIxmveh-9" },
      headers: { "x-forwarded-for": "5.5.5.6" } })).status, 200, "другой адрес за прокси — своё окно лимита");
    assert.ok(logs.some((l) => /\[auth\] WARN: login rate limited \{/.test(l)), "срабатывание лимита видно в логах");

    // --- журнал занятий: приём, обрезка, дедуп, лимиты ---
    const postEvents = (auth, sid, events) => req("POST", "/api/events", { auth, body: { sid, events } });
    const monthNow = new Date().toISOString().slice(0, 7);
    const evFile = (login, month) => path.join(DATA, "events", login, (month || monthNow) + ".jsonl");
    const readLines = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evstu", create: true, password: "Evstu-123" } })).status, 200);
    const EVSTU = B("evstu", "Evstu-123");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evstu2", create: true, password: "Evstu2-12" } })).status, 200);
    const EVSTU2 = B("evstu2", "Evstu2-12");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evteach", create: true, password: "Evteach-1", role: "teacher" } })).status, 200);
    const EVTEACH = B("evteach", "Evteach-1");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evteach2", create: true, password: "Evteach-2", role: "teacher" } })).status, 200);
    const EVTEACH2 = B("evteach2", "Evteach-2");

    // приём: несколько валидных событий одним батчем
    let r = await postEvents(EVSTU, "sidsid01", [
      { seq: 1, dt: 5000, type: "session.start", lang: "ru" },
      { seq: 2, dt: 3000, type: "card.answer", mod: "m0", cardId: "m0_01", phase: "type", ok: true, ms: 2000, in: "салам" },
      { seq: 3, dt: 1000, type: "test.finish", mod: "m0", score: 17, passed: true, wrong: ["m0_01"], ms: 5000 }
    ]);
    assert.strictEqual(r.status, 200);
    let body = JSON.parse(r.text);
    assert.strictEqual(body.accepted, 3, "3 события приняты");
    assert.strictEqual(body.dropped, 0);
    let lines = readLines(evFile("evstu"));
    assert.strictEqual(lines.length, 3, "3 строки в файле месяца");
    for (const l of lines) {
      assert.strictEqual(l.v, 1);
      assert.strictEqual(l.login, "evstu", "login проставлен сервером, не из тела");
      assert.ok(l.ts, "ts есть");
    }

    // login в теле события игнорируется — сервер всегда пишет login из сессии
    await postEvents(EVSTU, "sidsid01", [{ seq: 4, dt: 0, type: "session.start", lang: "ru", login: "altynai" }]);
    assert.ok(!fs.existsSync(path.join(DATA, "events", "altynai")), "чужой каталог не создан");
    assert.strictEqual(readLines(evFile("evstu")).find((l) => l.seq === 4).login, "evstu");

    // учитель/админ видит сырой ввод ученика — проверяем сразу, пока файл мал (дальше
    // в файл лягут сотни служебных событий и «салам» может выпасть за лимит выдачи)
    assert.ok(JSON.parse((await req("GET", "/api/events?login=evstu", { auth: ALT })).text).items.some((e) => e.in === "салам"), "админ/учитель видит сырой ввод ученика");
    // отсутствующий ?limit= не должен становиться нулём (Number(null)===0): дефолт 200 работает
    assert.strictEqual(JSON.parse((await req("GET", "/api/events?login=evstu", { auth: ALT })).text).items.length, 4, "без limit возвращаются все 4 события, а не одно");

    // некорректные тела запроса
    assert.strictEqual((await req("POST", "/api/events", { auth: EVSTU, body: "not json", raw: true, ct: "application/json" })).status, 400, "bad json");
    assert.strictEqual((await req("POST", "/api/events", { auth: EVSTU, body: { sid: "abcdef12", events: "nope" } })).status, 400, "events не массив");
    assert.strictEqual((await req("POST", "/api/events", { auth: EVSTU, body: { sid: "..", events: [] } })).status, 400, "кривой sid отклонён");

    // мусорные строки не топят батч целиком
    r = await postEvents(EVSTU, "sidsid02", [
      { seq: 1, dt: 0, type: "session.start" },
      { seq: 2, dt: 0, type: "card.answer", mod: "m0", cardId: "m0_02", ok: true },
      { seq: 3, dt: 0, type: "evil" },
      { seq: 4, dt: 0, type: "card.answer", mod: "m99", cardId: "m0_03", ok: true }
    ]);
    body = JSON.parse(r.text);
    assert.strictEqual(body.accepted, 2, "2 валидных принято");
    assert.strictEqual(body.dropped, 2, "неизвестный type и невалидный mod отброшены");

    // обрезка/клампинг полей, лишние ключи не попадают в строку
    r = await postEvents(EVSTU, "sidsid03", [
      { seq: 1, dt: 0, type: "card.answer", mod: "m0", cardId: "m0_04", ok: false, ms: 99999999, in: "х".repeat(5000), payload: "x".repeat(100000) }
    ]);
    assert.strictEqual(JSON.parse(r.text).accepted, 1);
    const clamped = readLines(evFile("evstu")).find((l) => l.cardId === "m0_04");
    assert.strictEqual(clamped.ms, 600000, "ms прижат к потолку 10 минут");
    assert.strictEqual(clamped.in.length, 200, "сырой ввод обрезан до 200 символов");
    assert.strictEqual(clamped.payload, undefined, "поле вне белого списка не попало в строку");

    // интерфейсная аналитика: ui.*-типы и поля окружения session.start принимаются и режутся
    r = await postEvents(EVSTU, "sidui0001", [
      { seq: 1, dt: 0, type: "session.start", lang: "ru", w: 390, h: 844, mob: true },
      { seq: 2, dt: 0, type: "ui.nav", tab: "cards" },
      { seq: 3, dt: 0, type: "ui.setting", k: "theme", val: "dark" },
      { seq: 4, dt: 0, type: "ui.error", msg: "e".repeat(500), src: "m0.html", line: 42 },
      { seq: 5, dt: 0, type: "card.answer", mod: "m0", cardId: "m0_05", ok: true, kbd: 3 }
    ]);
    assert.strictEqual(JSON.parse(r.text).accepted, 5, "ui-события и поля окружения приняты");
    const uiLines = readLines(evFile("evstu")).filter((l) => l.sid === "sidui0001");
    assert.strictEqual(uiLines.find((l) => l.type === "session.start").w, 390, "ширина окна записана");
    assert.strictEqual(uiLines.find((l) => l.type === "session.start").mob, true, "флаг touch записан");
    assert.strictEqual(uiLines.find((l) => l.type === "ui.nav").tab, "cards");
    assert.strictEqual(uiLines.find((l) => l.type === "ui.setting").val, "dark");
    assert.strictEqual(uiLines.find((l) => l.type === "ui.error").msg.length, 200, "текст ошибки обрезан");
    assert.strictEqual(uiLines.find((l) => l.type === "card.answer").kbd, 3, "счётчик экранной клавиатуры записан");

    // дедуп по seq внутри sid — повторная отправка того же батча ничего не добавляет
    const before5 = readLines(evFile("evstu")).length;
    r = await postEvents(EVSTU, "sidsid03", [{ seq: 1, dt: 0, type: "card.answer", mod: "m0", cardId: "m0_04", ok: false, ms: 1000 }]);
    assert.strictEqual(JSON.parse(r.text).accepted, 0, "повтор seq не принят повторно");
    assert.strictEqual(readLines(evFile("evstu")).length, before5, "файл не вырос");

    // батч длиннее EV_MAX_BATCH обрезается
    const bigBatch = Array.from({ length: 500 }, (_, i) => ({ seq: 1000 + i, dt: 0, type: "audio.play" }));
    assert.strictEqual(JSON.parse((await postEvents(EVSTU, "sidbig001", bigBatch)).text).accepted, 200, "батч режется до 200 событий");

    // тело больше MAX_BODY
    assert.strictEqual((await req("POST", "/api/events", { auth: EVSTU, body: "x".repeat(1024 * 1024 + 10), raw: true, ct: "application/json" })).status, 413, "слишком большое тело");

    // аноним и приостановленный ученик
    assert.strictEqual((await req("POST", "/api/events", { body: { sid: "anonanon", events: [] } })).status, 401, "аноним не пишет журнал");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evstu2", suspended: true } })).status, 200);
    assert.strictEqual((await postEvents(EVSTU2, "susp0001", [{ seq: 1, dt: 0, type: "session.start" }])).status, 403, "приостановленный ученик не пишет журнал");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evstu2", suspended: false } })).status, 200);

    // --- журнал занятий: чтение и права доступа ---
    r = await req("GET", "/api/events", { auth: EVSTU });
    assert.strictEqual(r.status, 200);
    assert.ok(JSON.parse(r.text).items.length > 0, "свой журнал читается");
    assert.strictEqual((await req("GET", "/api/events?login=altynai", { auth: EVSTU })).status, 403, "ученик не читает чужой журнал");
    assert.strictEqual((await req("GET", "/api/events?login=..", { auth: ALT })).status, 400, "обход каталога через login отклонён");
    assert.strictEqual((await req("GET", "/api/events?login=evstu", { auth: ALT })).status, 200);
    // учитель не читает журнал ДРУГОГО учителя (не владение, а роль запрашивающего)
    await postEvents(EVTEACH2, "tsid0001", [{ seq: 1, dt: 0, type: "session.start" }]);
    assert.strictEqual((await req("GET", "/api/events?login=evteach2", { auth: EVTEACH })).status, 403, "учитель не читает журнал другого учителя");
    assert.strictEqual((await req("GET", "/api/events?login=evteach2", { auth: VADIM })).status, 200, "админ читает журнал учителя");
    // exam.grade: адресат оценки — поле «to». Поле «login» сервер перезаписывает владельцем
    // журнала (инвариант EV_FIELDS), и логин оценённого ученика пропадал (ревью 25.09.2026)
    assert.strictEqual((await postEvents(EVTEACH, "gradesid1", [{ seq: 1, dt: 0, type: "exam.grade", to: "evstu", id: "w1", score: 80 }])).status, 200);
    const grades = JSON.parse((await req("GET", "/api/events", { auth: EVTEACH })).text).items.filter((e) => e.type === "exam.grade");
    assert.strictEqual(grades.length, 1, "событие оценки записано");
    assert.strictEqual(grades[0].to, "evstu", "в событии оценки сохранён оценённый ученик");
    assert.strictEqual(grades[0].score, 80, "и балл");
    assert.strictEqual((await req("GET", "/api/events/sessions?login=evstu", { auth: EVSTU })).status, 200);
    assert.strictEqual((await req("GET", "/api/events/sessions?login=evstu", { auth: EVSTU2 })).status, 403, "чужие сессии не видны другому ученику");

    // --- дашборд: обзор ---
    assert.strictEqual((await req("GET", "/api/stats/overview", { auth: EVSTU })).status, 403, "обзор — только преподавателю");
    r = await req("GET", "/api/stats/overview", { auth: ALT });
    assert.strictEqual(r.status, 200);
    const evstuRow = JSON.parse(r.text).find((s) => s.login === "evstu");
    assert.ok(evstuRow, "evstu присутствует в обзоре");
    assert.ok(evstuRow.lastSeen, "последняя активность проставлена");

    // --- журнал занятий: точность агрегата ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evagg", create: true, password: "Evagg-123" } })).status, 200);
    const EVAGG = B("evagg", "Evagg-123");
    await postEvents(EVAGG, "aggsid01", [
      { seq: 1, dt: 60000, type: "card.answer", mod: "m0", cardId: "m0_01", ok: true, ms: 2000 },
      { seq: 2, dt: 50000, type: "card.answer", mod: "m0", cardId: "m0_02", ok: true, ms: 2000 },
      { seq: 3, dt: 40000, type: "card.answer", mod: "m0", cardId: "m0_03", ok: true, ms: 2000 },
      { seq: 4, dt: 30000, type: "card.answer", mod: "m0", cardId: "m0_04", ok: false, ms: 2000, in: "неверно" },
      { seq: 5, dt: 20000, type: "test.finish", mod: "m0", score: 17, passed: true, ms: 5000 }
    ]);
    let stats = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text);
    assert.strictEqual(stats.totals.ans, 4, "4 ответа учтено (test.finish в счёт ответов не входит)");
    assert.strictEqual(stats.totals.ok, 3, "3 верных из 4");
    assert.strictEqual(stats.tests[0].score, 17, "результат теста записан");
    assert.ok(stats.weak.m0_04, "ошибочная карточка попала в топ слабых");
    assert.strictEqual(stats.weak.m0_04.ins[0], "неверно", "неверный ввод сохранён для разбора");
    assert.strictEqual(Object.values(stats.days).reduce((a, d) => a + d.ans, 0), 4, "дневная разбивка сходится с totals");

    // время занятия: промежуток 30с засчитывается, промежуток дольше 2 минут (простой) — нет
    const msBefore = stats.totals.ms;
    await postEvents(EVAGG, "timesid1", [
      { seq: 1, dt: 40000, type: "card.answer", mod: "m0", cardId: "m0_05", ok: true },
      { seq: 2, dt: 10000, type: "card.answer", mod: "m0", cardId: "m0_06", ok: true }
    ]);
    const msAfter = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text).totals.ms;
    assert.strictEqual(msAfter - msBefore, 30000, "промежуток 30с засчитан в время занятия");
    await postEvents(EVAGG, "timesid2", [
      { seq: 1, dt: 700000, type: "card.answer", mod: "m0", cardId: "m0_07", ok: true },
      { seq: 2, dt: 10000, type: "card.answer", mod: "m0", cardId: "m0_08", ok: true }
    ]);
    const msAfter2 = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text).totals.ms;
    assert.strictEqual(msAfter2, msAfter, "простой дольше 2 минут (idle-порог) не засчитан");

    // Решения ученика о словах («уже знаю», «отложить») сохраняются и попадают в отчёт
    // преподавателя. Отчёт показывает ТЕКУЩЕЕ решение: вернувшееся в колоду слово из него уходит.
    await postEvents(EVAGG, "decsid01", [
      { seq: 1, dt: 0, type: "card.know", mod: "m0", cardId: "m0_11", box0: 1 },
      { seq: 2, dt: 0, type: "card.skip", mod: "m0", cardId: "m0_12", on: true },
      { seq: 3, dt: 0, type: "card.skip", mod: "m0", cardId: "m0_13", on: true },
      { seq: 4, dt: 0, type: "card.skip", mod: "m0", cardId: "m0_13", on: false }
    ]);
    const dec = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text).decide;
    assert.strictEqual(dec.m0_11.kind, "know", "«уже знаю» видно в отчёте");
    assert.strictEqual(dec.m0_12.kind, "skip", "отложенное слово видно в отчёте");
    assert.ok(!dec.m0_13, "возвращённое в колоду слово в отчёте не числится отложенным");
    assert.ok(JSON.parse((await req("GET", "/api/events?login=evagg", { auth: ALT })).text)
      .items.some((e) => e.type === "card.know" && e.cardId === "m0_11"), "решение видно преподавателю в ленте");

    // пересборка агрегата из jsonl даёт те же числа
    const aggPath = path.join(DATA, "events", "evagg", "agg.json");
    const statsBefore = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text);
    fs.unlinkSync(aggPath);
    const statsRebuilt = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text);
    assert.strictEqual(statsRebuilt.totals.ans, statsBefore.totals.ans, "пересборка: те же ответы");
    assert.strictEqual(statsRebuilt.totals.ok, statsBefore.totals.ok, "пересборка: та же точность");
    assert.strictEqual(statsRebuilt.totals.ms, statsBefore.totals.ms, "пересборка: то же время занятий");

    // устаревшая версия агрегата пересобирается прозрачно
    fs.writeFileSync(aggPath, JSON.stringify({ v: 0, login: "evagg" }));
    assert.strictEqual(JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text).v, 3, "устаревшая версия агрегата пересобрана");

    // битая строка (обрыв записи) не роняет чтение и пересборку
    fs.appendFileSync(evFile("evagg"), "{битая строка без закрывающей скобки\n");
    fs.unlinkSync(aggPath);
    const statsAfterCorrupt = JSON.parse((await req("GET", "/api/stats", { auth: EVAGG })).text);
    assert.strictEqual(statsAfterCorrupt.totals.ans, statsBefore.totals.ans, "битая строка пропущена, остальные данные целы");

    // --- дашборд: сигналы (progress/acc7/testFails2) в /api/stats/overview ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evsig", create: true, password: "Evsig-123" } })).status, 200);
    const EVSIG = B("evsig", "Evsig-123");
    assert.strictEqual((await req("PUT", "/api/progress", { auth: EVSIG, body: v2({ everPassed: true, lastAttempt: { score: 9, passed: false, date: "2026-01-05" }, consecutiveFails: 2, attempts: [] }) })).status, 200);
    const overviewRow = JSON.parse((await req("GET", "/api/stats/overview", { auth: ALT })).text).find((s) => s.login === "evsig");
    assert.ok(overviewRow, "evsig в обзоре");
    assert.strictEqual(overviewRow.testFails2, true, "два провала теста подряд — сигнал есть");
    assert.strictEqual(overviewRow.progress, 1 / 12, "прогресс = доля сданных модулей (m0 сдан когда-либо)");
    assert.strictEqual(overviewRow.acc7, null, "точность за 7 дней — null без ответов в журнале");
    const evstuOverview = JSON.parse((await req("GET", "/api/stats/overview", { auth: ALT })).text).find((s) => s.login === "evstu");
    assert.strictEqual(evstuOverview.testFails2, false, "у обычного ученика сигнала нет");
    // Ученик занимался ДО появления журнала: журнал пуст, но прогресс сохранялся. Дашборд
    // обязан показывать его активность и последнюю попытку теста, а не «ни разу» и «—»
    // (иначе рядом с пустой колонкой «Тесты» висел сигнал «тест провален 2×»).
    assert.ok(overviewRow.lastSeen, "активность берётся из прогресса, когда журнала ещё нет");
    assert.ok(overviewRow.lastTest, "последняя попытка теста видна из прогресса");
    assert.strictEqual(overviewRow.lastTest.score, 9, "счёт последней попытки");
    assert.strictEqual(overviewRow.lastTest.total, 20, "длина теста: старые записи без total считаются двадцатью");
    // и журнал остаётся главнее прогресса, когда он есть
    assert.ok(Date.parse(evstuOverview.lastSeen) >= 0, "у ученика с журналом активность из журнала");

    // --- журнал занятий: ротация по месяцам ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evrot", create: true, password: "Evrot-123" } })).status, 200);
    const EVROT = B("evrot", "Evrot-123");
    await postEvents(EVROT, "rotsid01", [{ seq: 1, dt: 0, type: "session.start" }]);
    const prevDate = new Date(); prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
    const prevMonth = prevDate.toISOString().slice(0, 7);
    const prevFile = evFile("evrot", prevMonth);
    fs.mkdirSync(path.dirname(prevFile), { recursive: true });
    fs.writeFileSync(prevFile, JSON.stringify({ v: 1, ts: prevDate.toISOString(), seq: 1, sid: "oldsid01", login: "evrot", type: "session.start" }) + "\n");
    const rotResp = JSON.parse((await req("GET", "/api/events?login=evrot&limit=10", { auth: ALT })).text);
    assert.ok(rotResp.items.length >= 2, "видны события из текущего и прошлого месяца одним запросом");
    assert.strictEqual(rotResp.nextBefore, null, "меньше лимита — курсора для догрузки нет");

    // --- журнал занятий: курсорная пагинация (before) ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evpage", create: true, password: "Evpage-123" } })).status, 200);
    const EVPAGE = B("evpage", "Evpage-123");
    await postEvents(EVPAGE, "pagesid01", Array.from({ length: 5 }, (_, i) => ({ seq: i + 1, dt: (5 - i) * 1000, type: "audio.play" })));
    const page1 = JSON.parse((await req("GET", "/api/events?login=evpage&limit=2", { auth: ALT })).text);
    assert.strictEqual(page1.items.length, 2, "первая страница — 2 события");
    assert.ok(page1.nextBefore, "есть курсор для догрузки — событий больше, чем лимит");
    const page2 = JSON.parse((await req("GET", "/api/events?login=evpage&limit=2&before=" + encodeURIComponent(page1.nextBefore), { auth: ALT })).text);
    assert.strictEqual(page2.items.length, 2, "вторая страница — следующие 2 события");
    const seqsPage1 = page1.items.map((e) => e.seq), seqsPage2 = page2.items.map((e) => e.seq);
    assert.ok(!seqsPage1.some((s) => seqsPage2.includes(s)), "страницы не пересекаются: " + seqsPage1 + " / " + seqsPage2);

    // --- журнал занятий: пересоздание логина архивирует прежний ---
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evarch", create: true, password: "Evarch-123" } })).status, 200);
    const EVARCH1 = B("evarch", "Evarch-123");
    await postEvents(EVARCH1, "archsid1", [{ seq: 1, dt: 0, type: "session.start" }]);
    assert.ok(fs.existsSync(path.join(DATA, "events", "evarch")), "каталог событий создан");
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evarch", remove: true } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evarch", create: true, password: "Evarch-456" } })).status, 200);
    const EVARCH2 = B("evarch", "Evarch-456");
    assert.ok(fs.readdirSync(path.join(DATA, "events")).some((d) => d.startsWith("evarch.") && d.endsWith(".bak")), "прежний журнал архивирован в .bak");
    assert.deepStrictEqual(JSON.parse((await req("GET", "/api/events", { auth: EVARCH2 })).text).items, [], "новый владелец логина не наследует чужой журнал");

    // --- журнал занятий: лимит частоты и квота файла (отдельные серверы, чтобы не задеть остальные тесты) ---
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evrate", create: true, password: "Evrate-123" } })).status, 200);
      const EVRATE = B("evrate", "Evrate-123");
      let rateBlocked = false;
      for (let batch = 0; batch < 8 && !rateBlocked; batch++) {
        const evs = Array.from({ length: 200 }, (_, i) => ({ seq: batch * 200 + i + 1, dt: 0, type: "audio.play" }));
        if ((await postEvents(EVRATE, "ratesid1", evs)).status === 429) rateBlocked = true;
      }
      assert.ok(rateBlocked, "лимит ~900 событий/мин на логин срабатывает");
      assert.ok(logs.some((l) => /\[events\] WARN: rate limited \{/.test(l)), "срабатывание лимита частоты видно в логах");
    }
    {
      assert.strictEqual((await req("PUT", "/api/students", { auth: VADIM, body: { login: "evquota", create: true, password: "Evquota-1" } })).status, 200);
      const EVQUOTA = B("evquota", "Evquota-1");
      const srv3 = await startServer({ port: PORT + 2, dataDir: DATA, env: { EV_MAX_FILE_MB: "0" } });
      try {
        assert.strictEqual((await srv3.req("POST", "/api/events", { auth: EVQUOTA, body: { sid: "quotasid1", events: [{ seq: 1, dt: 0, type: "session.start" }] } })).status, 200, "первый батч проходит (файла ещё нет)");
        assert.strictEqual((await srv3.req("POST", "/api/events", { auth: EVQUOTA, body: { sid: "quotasid1", events: [{ seq: 2, dt: 0, type: "session.start" }] } })).status, 429, "второй батч упирается в квоту файла (EV_MAX_FILE_MB=0)");
      } finally { srv3.stop({ keepData: true }); } // DATA общий с основным сервером
    }

    // сырой ввод ученика не попадает в логи сервера ни при каких обстоятельствах
    assert.ok(!logs.some((l) => l.includes("салам") || l.includes("неверно")), "сырой ввод ученика не логируется");

    // --- методика ---
    assert.strictEqual((await req("GET", "/metodika", { auth: ALT })).status, 200);
    assert.strictEqual((await req("GET", "/metodika", { auth: ILIM })).status, 302, "ученику redirect");
    assert.ok((await req("GET", "/metodika")).text.includes("Кириңиз"), "без входа — форма");

    // --- контракт логов: каждая строка = заголовок по формату или сырой стек ---
    assert.ok(logs.length >= 2, "есть логи (старт + события)");
    const bad = logs.filter((l) => !LOG_HEAD_RE.test(l) && !STACK_RE.test(l));
    assert.deepStrictEqual(bad, [], "строки вне контракта логов: " + JSON.stringify(bad));
    assert.ok(logs.some((l) => /\[server\] INFO: started \{/.test(l)), "стартовая строка с JSON-хвостом");
    assert.ok(logs.some((l) => /\[auth\] WARN: login failed \{/.test(l)), "неудачный вход: WARN, логин в хвосте");
    assert.ok(!logs.some((l) => l.includes("test-key")), "секреты не попадают в логи");

    // --- разовая привязка исторических учеников к преподавателю, который их завёл ---
    // (у заведённых до появления owner поля просто нет; повторный старт ничего не переписывает)
    {
      const smap = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
      smap.legacy1 = { granted: ["m2"], by: "altynai", at: "2026-01-01T00:00:00Z" }; // без owner
      smap.legacy2 = { suspended: false, owner: "vadim", by: "vadim", at: "2026-01-01T00:00:00Z" }; // owner уже есть
      fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify(smap));
      // привязка происходит на старте — startServer возвращается уже после неё
      const srv2 = await startServer({ port: PORT + 1, dataDir: DATA, env: { DEFAULT_OWNER: "altynai" } });
      try {
        const after = JSON.parse(fs.readFileSync(path.join(DATA, "students.json"), "utf8"));
        assert.strictEqual(after.legacy1.owner, "altynai", "ученик без преподавателя привязан к Алтынай");
        assert.deepStrictEqual(after.legacy1.granted, ["m2"], "остальные поля не тронуты");
        assert.strictEqual(after.legacy2.owner, "vadim", "у кого преподаватель уже был — не переписан");
      } finally { srv2.stop({ keepData: true }); } // DATA общий с основным сервером
    }

    // Модуль демо — параметр окружения DEMO_MOD (владелец 29.10.2026: «потом я М2 захочу»):
    // сервер с DEMO_MOD=m2 собирает демо из М2 (карточки, урок), без данных М1;
    // несуществующий модуль — отказ старта, а не пустое демо
    {
      const srv4 = await startServer({ port: PORT + 3, dataDir: DATA, env: { DEMO_MOD: "m2" } });
      try {
        const d2 = (await srv4.req("GET", "/demo/ru")).text;
        assert.ok(d2.includes('const DEMO_MOD="m2"') && d2.includes('const CONTENT_READY=["m2"]'), "DEMO_MOD=m2 — демо из М2");
        assert.strictEqual((d2.match(/"id":"m(?!2_)\d+_/g) || []).length, 0, "при М2 в демо нет данных М0, М1 и других модулей");
        assert.ok(d2.includes("function renderGrammarM1(m){}") && !d2.includes("function renderGrammarM2(m){}"), "справочник М2 едет, М1 вырезан");
        assert.ok(d2.includes('const LESSONS={"m2":{"id"'), "урок М2 едет в демо");
      } finally { srv4.stop({ keepData: true }); } // DATA общий с основным сервером
      const bad = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
        env: Object.assign({}, process.env, { PORT: String(PORT + 4), DATA_DIR: DATA, DEMO_MOD: "m99",
          USERS_FILE: path.join(__dirname, "fixtures", "users.json") }), encoding: "utf8", timeout: 30000 });
      assert.ok(bad.status !== 0 && /DEMO_MOD|модуля демо m99/.test(bad.stderr + bad.stdout), "неверный DEMO_MOD — отказ старта с понятной причиной");
    }

    console.log("server.test.js: OK (лендинг, auth, роли, прогресс, вычитка, overrides, аудио, секреты, методика, формат логов)");
  } finally {
    if (srv) srv.stop(); // гасит сервер и прибирает DATA
    else fs.rmSync(DATA, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
