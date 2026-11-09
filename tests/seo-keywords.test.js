"use strict";
/* Guard связной схемы SEO-ключей (deploy/seo-keywords.json): каждый ключ реестра
   обязан присутствовать в СОБРАННОЙ странице каждого языка — проверяется живой
   ответ сервера, не греп исходников. Ловит потерю ключа при любой правке
   мета-текстов (LANDING_I18N, DEMO_SEO, level-test.json, BLOG_UI, одностраничники)
   и каннибализацию: primary одной страницы не смеет жить в титуле другой. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const PORT = 8209;
const REG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deploy", "seo-keywords.json"), "utf8"));
const LANGS = ["ru", "en", "tr"];
const LANGS_SORTED = [...LANGS].sort();
const TARGETS = new Set(["title", "meta_desc", "h1", "body"]);

// Нормализация для поиска подстроки: турецкая строчная (İ→i̇) + NFD-снятие
// комбинирующих знаков (иначе «ifade» не найдётся в «İfade», а «й» в NFD —
// это «и»+бревис). Применяется симметрично к иголке и стогу.
function norm(s, lang) {
  const low = lang === "tr" ? s.toLocaleLowerCase("tr") : s.toLowerCase();
  return low.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// body — документ БЕЗ <head>: иначе targets ["meta_desc","body"] были бы тавтологией
// (весь head и так внутри body-стога), а реестр обещал бы размещение, которого нет
function extract(html, lang) {
  const pick = (re) => { const m = html.match(re); return m ? m[1] : ""; };
  const raw = {
    title: pick(/<title>([^<]*)<\/title>/),
    meta_desc: pick(/<meta name="description" content="([^"]*)"/),
    h1: pick(/<h1[^>]*>([^<]*)<\/h1>/),
    body: html.slice(html.indexOf("</head>")),
  };
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = norm(v, lang); // нормализуем один раз
  return out;
}

/* ── схема реестра валидна сама по себе (до сети) ────────────────────────── */
for (const [base, page] of Object.entries(REG.pages)) {
  const at = "реестр " + (base || "/") + ": ";
  assert.ok(page.source, at + "source обязателен (куда идти правящему тексты)");
  assert.deepStrictEqual(Object.keys(page.primary).sort(), LANGS_SORTED, at + "primary — три языка");
  for (const l of LANGS) {
    assert.ok(page.primary[l].key && page.primary[l].match, at + l + ": key и match непусты");
    const m = page.primary[l].match;
    assert.strictEqual(m, l === "tr" ? m.toLocaleLowerCase("tr") : m.toLowerCase(), at + l + ": match записан строчными");
  }
  if (page.mode === "inline-multilang") {
    // у одностраничников проверяется только primary во всём документе; кластеры там
    // молча не проверялись бы — запрещаем на уровне схемы, чтобы не было ложных зелёных
    assert.ok(!page.clusters && !page.synonyms, at + "inline-multilang не несёт clusters/synonyms");
    continue;
  }
  for (const c of page.clusters || []) {
    assert.deepStrictEqual(Object.keys(c.match).sort(), LANGS_SORTED, at + c.id + ": match — три языка");
    assert.ok(Array.isArray(c.targets) && c.targets.length && c.targets.every((t) => TARGETS.has(t)), at + c.id + ": targets из словаря");
  }
  for (const l of Object.keys(page.synonyms || {})) {
    for (const s of page.synonyms[l]) assert.ok(s.match && s.targets.every((t) => TARGETS.has(t)), at + "синоним " + l);
  }
}
// решение владельца 30.10.2026: название организатора государственного тестирования не
// продвигается — ни ключом, ни match, ни пометкой в реестре
assert.ok(!/кыргыз\s*тест|k[ıi]rg[ıi]z\s*test/i.test(JSON.stringify(REG.pages)), "в реестре ключей нет названия организатора тестирования");

async function main() {
  const DATA = "/tmp/kga1-seo-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const { req } = srv;

    // полнота: каждая база sitemap (кроме статей блога) обязана быть в реестре
    const sitemap = (await req("GET", "/sitemap.xml")).text;
    const urls = [...sitemap.matchAll(/<loc>https:\/\/learn\.kg([^<]*)<\/loc>/g)].map((m) => m[1]);
    const bases = new Set();
    for (const u of urls) {
      const m = u.match(/^(.*?)\/?(ru|en|tr)$/);
      const base = m ? m[1] : u;
      if (/^\/blog\/.+/.test(base)) continue; // статьи — опциональны в реестре
      if (/^\/slovo\/.+/.test(base)) continue; // страницы-ответы «X по-кыргызски» — тоже (программатик из данных)
      bases.add(base === "/" ? "" : base);
    }
    for (const b of bases) assert.ok(REG.pages[b], "база sitemap без записи в реестре ключей: " + (b || "/"));

    // один проход: скачивание и все per-page проверки; титулы копятся для
    // финальной анти-каннибализации (ей одной нужен полный набор)
    const titles = {}; // base → lang → нормализованный title
    const pageHtml = {}; // base → lang → сырой html (переиспользуется блоком гигиены ниже)
    const singleHtml = {}; // одностраничники: base → html (для той же гигиены)
    for (const [base, page] of Object.entries(REG.pages)) {
      if (page.mode === "inline-multilang") {
        const r = await req("GET", base);
        assert.strictEqual(r.status, 200, base + " отвечает");
        for (const l of LANGS) {
          assert.ok(norm(r.text, l).includes(norm(page.primary[l].match, l)),
            base + ": ключ «" + page.primary[l].match + "» (" + l + ") не найден в документе");
        }
        singleHtml[base] = r.text;
        continue;
      }
      titles[base] = {};
      pageHtml[base] = {};
      for (const l of LANGS) {
        const r = await req("GET", (base || "") + "/" + l);
        assert.strictEqual(r.status, 200, base + "/" + l + " отвечает: " + r.status);
        pageHtml[base][l] = r.text;
        const t = extract(r.text, l);
        titles[base][l] = t.title;
        const at = (base || "/") + " [" + l + "]: ";
        assert.ok((t.title + " " + t.meta_desc).includes(norm(page.primary[l].match, l)),
          at + "primary «" + page.primary[l].match + "» отсутствует в title+description");
        for (const c of page.clusters || []) {
          const hay = c.targets.map((k) => t[k]).join(" ");
          assert.ok(hay.includes(norm(c.match[l], l)),
            at + "кластер " + c.id + ": «" + c.match[l] + "» отсутствует в " + c.targets.join("+"));
        }
        for (const s of (page.synonyms && page.synonyms[l]) || []) {
          const hay = s.targets.map((k) => t[k]).join(" ");
          assert.ok(hay.includes(norm(s.match, l)), at + "синоним «" + s.match + "» отсутствует в " + s.targets.join("+"));
        }
      }
    }

    // анти-каннибализация: primary страницы X не встречается в титулах других страниц
    const variantBases = Object.keys(titles);
    for (const x of variantBases) for (const y of variantBases) {
      if (x === y) continue;
      for (const l of LANGS) {
        const needle = norm(REG.pages[x].primary[l].match, l);
        assert.ok(!titles[y][l].includes(needle),
          "каннибализация [" + l + "]: primary «" + needle + "» страницы " + (x || "/") + " живёт в титуле " + (y || "/"));
      }
    }

    // SEO-гигиена ВСЕХ языковых вариантов sitemap, включая статьи блога (реестр их
    // не перечисляет, но сниппеты в выдаче у них те же): title с суффиксом ≤65,
    // description 80–160, title уникален по всему сайту (дубль «Blog · learn.kg»
    // en/tr — реальный промах аудита), непустой h1 и ровно один парсящийся LD-блок.
    // Одностраничники (/privacy, /terms, /install) проходят ту же гигиену (head у них
    // русскоязычный — язык «ru»). Страницы реестра выше уже скачаны — повторно
    // фетчатся только статьи блога.
    const seen = new Map(); // title → url
    const hygiene = (u, html, l, isHome) => {
      const t = extract(html, l), rawTitle = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
      assert.ok(rawTitle.length > 0 && rawTitle.length <= 65, u + ": title " + rawTitle.length + " вне (0,65]: " + rawTitle);
      const rawDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
      assert.ok(rawDesc.length >= 80 && rawDesc.length <= 160, u + ": description " + rawDesc.length + " вне 80–160");
      assert.ok(!seen.has(t.title), u + ": title дублирует " + seen.get(t.title));
      seen.set(t.title, u);
      assert.ok(t.h1.trim().length > 0, u + ": пустой или отсутствующий h1");
      const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      assert.strictEqual(lds.length, 1, u + ": LD-блоков " + lds.length + ", ожидался ровно один");
      const ld = JSON.parse(lds[0][1]); // невалидный JSON в LD — молчаливая потеря всей разметки
      if (!isHome) {
        // разметку BreadcrumbList несут все неглавные страницы; видимую цепочку —
        // все, кроме демо (решение владельца: приложению полоска не нужна)
        assert.ok((ld["@graph"] || []).some((n) => n["@type"] === "BreadcrumbList"), u + ": нет BreadcrumbList");
        if (!u.startsWith("/demo")) assert.ok(html.includes('class="crumbs"'), u + ": нет хлебных крошек");
      }
      // WebPage.description обязан совпадать с meta description (расхождение у /privacy
      // однажды проехало зелёным); name не сверяем — у страниц он намеренно без суффикса
      const wp = (ld["@graph"] || []).find((n) => n["@type"] === "WebPage");
      if (wp) assert.strictEqual(wp.description, rawDesc, u + ": LD description разошёлся с meta description");
    };
    for (const [base] of Object.entries(REG.pages)) {
      if (REG.pages[base].mode === "inline-multilang") { hygiene(base, singleHtml[base], "ru"); continue; }
      for (const l of LANGS) hygiene((base || "") + "/" + l, pageHtml[base][l], l, base === "");
    }
    for (const u of urls) {
      if (!/^\/blog\/.+\/(ru|en|tr)$/.test(u)) continue;
      const l = u.slice(-2);
      const r = await req("GET", u);
      assert.strictEqual(r.status, 200, u + " отвечает");
      hygiene(u, r.text, l);
    }

    console.log("seo-keywords.test.js: OK (реестр ×", Object.keys(REG.pages).length,
      "страниц × 3 языка: primary, кластеры, синонимы, полнота против sitemap, анти-каннибализация, гигиена",
      urls.length, "URL sitemap)");
  } finally {
    if (srv) await srv.stop();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
