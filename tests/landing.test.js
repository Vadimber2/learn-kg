"use strict";
/* Контракт публичной витрины app/landing.html:
   — паритет ru/en/tr и покрытие data-i / data-i-href в обе стороны;
   — цифры в тексте сверяются с реальным CONTENT собранной страницы (лендинг не врёт);
   — ноль внешних запросов и растра, ноль innerHTML;
   — палитра токенов совпадает с приложением;
   — контракт «kga1-lang» общий с login.html и m0.html. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "app");
const html = fs.readFileSync(path.join(APP, "landing.html"), "utf8");
const m0 = require("../server/appshell").buildAppHtml();
const loginHtml = fs.readFileSync(path.join(__dirname, "..", "server", "login.html"), "utf8");

/* ---------- словарь ---------- */
const dictSrc = html.match(/\/\* ===LANDING-I18N=== \*\/([\s\S]*?)\/\* ===\/LANDING-I18N=== \*\//);
assert.ok(dictSrc, "маркеры ===LANDING-I18N=== найдены");
const sb = { localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(sb);
vm.runInContext(dictSrc[1] + "; this.D=LANDING_I18N; this.lt=lt;", sb);
const D = sb.D;

const LANGS = ["ru", "en", "tr"];
assert.deepStrictEqual(Object.keys(D).sort(), LANGS.slice().sort(), "ровно три языка");
for (const l of LANGS) {
  assert.deepStrictEqual(Object.keys(D[l]).sort(), Object.keys(D.ru).sort(), "паритет ключей: " + l);
  for (const [k, v] of Object.entries(D[l])) {
    assert.strictEqual(typeof v, "string", l + "." + k + " — строка");
    assert.ok(v.trim().length > 0, l + "." + k + " не пустой");
  }
}
// плейсхолдеры не должны разъезжаться между языками
for (const k of Object.keys(D.ru)) {
  const ph = (s) => (s.match(/\{[a-z_]+\}/g) || []).sort().join(",");
  for (const l of LANGS) assert.strictEqual(ph(D[l][k]), ph(D.ru[k]), "плейсхолдеры " + l + "." + k);
}
assert.strictEqual(sb.lt("hero_h1"), D.ru.hero_h1, "lt() по умолчанию отдаёт русский");
assert.strictEqual(sb.lt("нет-такого-ключа"), "нет-такого-ключа", "lt() возвращает ключ, если строки нет");

/* ---------- покрытие data-i в обе стороны ---------- */
const usedText = new Set([...html.matchAll(/\sdata-i="([a-z0-9_]+)"/g)].map((x) => x[1]));
const usedHref = new Set([...html.matchAll(/\sdata-i-href="([a-z0-9_]+)"/g)].map((x) => x[1]));
assert.ok(usedText.size >= 40, "переводимых узлов много: " + usedText.size);
assert.ok(usedHref.size >= 1, "есть переводимая ссылка (WhatsApp с текстом)");
for (const k of [...usedText, ...usedHref]) assert.ok(D.ru[k] !== undefined, "ключ используется, но его нет в словаре: " + k);
// title/*_link не имеют своего узла — их выставляет скрипт
// meta_desc подставляет сервер в /en и /tr варианты страницы
const SCRIPTED = new Set(["title", "meta_desc", "og_alt", "ld_founder", "theme_auto", "theme_light", "theme_dark", "langs_label"]);
for (const k of Object.keys(D.ru)) {
  assert.ok(usedText.has(k) || usedHref.has(k) || SCRIPTED.has(k), "мёртвый ключ словаря: " + k);
}
assert.ok(/document\.title\s*=\s*lt\("title"\)/.test(html), "title переводится скриптом");
assert.ok(/documentElement\.lang\s*=\s*l/.test(html), "lang на <html> переключается");

/* ---------- русская разметка не разъезжается со словарём ---------- */
const h1 = html.match(/<h1[^>]*data-i="hero_h1">([^<]+)<\/h1>/);
assert.ok(h1, "H1 с data-i найден");
assert.strictEqual(h1[1], D.ru.hero_h1, "H1 в разметке совпадает с LANDING_I18N.ru");
assert.ok(html.includes(">" + D.ru.cta_wa + "<"), "главный CTA в разметке совпадает со словарём");
assert.ok(html.includes("<title>" + D.ru.title + "</title>"), "<title> совпадает со словарём");

/* ---------- контракт уровней ---------- */
const cards = [...html.matchAll(/<(a|div)\s+class="lvl[^"]*"\s+data-level="([a-z0-9]+)"([^>]*)>/g)];
assert.strictEqual(cards.length, 6, "ровно шесть уровней, найдено " + cards.length);
assert.deepStrictEqual(cards.map((c) => c[2]), ["a1", "a2", "b1", "b2", "c1", "c2"], "порядок уровней A1…C2");
for (const c of cards.slice(0, 4)) {
  assert.strictEqual(c[1], "a", c[2] + " — ссылка (курс открыт)");
  // карточка открытого уровня ведёт на страницу описания курса (магниты и вход — там),
  // href строго перед data-i-href — контракт серверного регекспа локализации ссылок
  assert.ok(new RegExp('href="/kurs-' + c[2] + '/ru" data-i-href="lvl_' + c[2] + '_href"').test(c[0] + c[3]),
    c[2] + " ведёт на /kurs-" + c[2] + "/ru с переводимой ссылкой");
  for (const l of LANGS) assert.strictEqual(D[l]["lvl_" + c[2] + "_href"], "/kurs-" + c[2] + "/" + l,
    "lvl_" + c[2] + "_href " + l + " ведёт на свой языковой вариант");
}
for (const c of cards.slice(4)) {
  assert.strictEqual(c[1], "div", c[2] + " не должен быть ссылкой");
  assert.ok(!/href=|onclick=/.test(c[3]), c[2] + " без href и обработчиков");
  assert.ok(/aria-disabled="true"/.test(c[3]), c[2] + " помечен aria-disabled");
  assert.ok(/class="lvl soon"/.test(c[0]), c[2] + " визуально приглушён (.soon)");
}
// два чипа «Скоро» (C1–C2) делят один ключ lvl_soon — дубликаты словаря свёрнуты
assert.strictEqual((html.match(/data-i="lvl_soon"/g) || []).length, 2, "два чипа «Скоро» на одном ключе");

/* ---------- цифры на странице не врут ---------- */
const dataSrc = m0.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
assert.ok(dataSrc, "маркеры ===DATA=== в m0.html найдены");
const csb = { console };
vm.createContext(csb);
vm.runInContext(dataSrc[1] + "; this.CONTENT=CONTENT; this.READY=CONTENT_READY;", csb);
// Витрина заявляет цифры КУРСА A1 («12 модулей, 1056 фраз» — характеристика уровня),
// поэтому считаем по модулям курса a1 из MODULE_META (каталог живёт вне ===DATA===),
// а не по всему CONTENT_READY: с появлением контента A2 суммарная цифра перестала бы
// быть цифрой уровня A1, и тест требовал бы вписать её в тексты витрины.
const metaSrc = m0.match(/const MODULE_META=\[([\s\S]*?)\];/);
assert.ok(metaSrc, "MODULE_META в m0.html найден");
// Цифры считаются по КАЖДОМУ открытому курсу (per-level на карточках) и суммарно
// (hero/meta): врать нельзя ни уровнем, ни итогом.
const countCourse = (cid) => {
  const mods = [...metaSrc[1].matchAll(new RegExp('\\{id:"(m\\d+)",num:"[^"]*",course:"' + cid + '"', "g"))].map((x) => x[1])
    .filter((m) => csb.READY.includes(m));
  let ph = 0;
  for (const mod of mods) for (const v of csb.CONTENT[mod].vocab) if (!v.ref) ph++;
  return { modules: mods.length, phrases: ph };
};
const a1n = countCourse("a1"), a2n = countCourse("a2"), b1n = countCourse("b1"), b2n = countCourse("b2");
assert.ok(a1n.modules >= 12 && a2n.modules >= 12 && b1n.modules >= 12 && b2n.modules >= 12, "модули всех четырёх курсов найдены");
for (const l of LANGS) {
  const all = Object.values(D[l]).join(" ");
  assert.ok(all.includes(String(a1n.phrases)), "в " + l + " заявлено " + a1n.phrases + " фраз A1");
  assert.ok(all.includes(String(a2n.phrases)), "в " + l + " заявлено " + a2n.phrases + " фраз A2");
  assert.ok(all.includes(String(b1n.phrases)), "в " + l + " заявлено " + b1n.phrases + " фраз B1");
  assert.ok(all.includes(String(b2n.phrases)), "в " + l + " заявлено " + b2n.phrases + " фраз B2");
  assert.ok(all.includes(String(a1n.phrases + a2n.phrases + b1n.phrases + b2n.phrases)), "в " + l + " заявлен итог " + (a1n.phrases + a2n.phrases + b1n.phrases + b2n.phrases) + " фраз");
  assert.ok(all.includes(String(a1n.modules + a2n.modules + b1n.modules + b2n.modules)), "в " + l + " заявлено " + (a1n.modules + a2n.modules + b1n.modules + b2n.modules) + " модулей всего");
}
// расписание Лейтнера в тексте совпадает с приходящим из приложения
const sched = m0.match(/SCHEDULE_DAYS\s*=\s*\[([0-9,\s]+)\]/);
assert.ok(sched, "SCHEDULE_DAYS найден в m0.html");
const days = sched[1].split(",").map((s) => s.trim());
for (const l of LANGS) {
  const all = Object.values(D[l]).join(" ");
  assert.ok(all.includes(days.join(" → ")), "расписание " + days.join(" → ") + " указано в " + l);
}

/* ---------- ноль внешних запросов, ноль растра, ноль innerHTML ---------- */
// единственный растровый элемент страницы — аватар преподавателя
const imgs = html.match(/<img\b[^>]*>/gi) || [];
assert.strictEqual(imgs.length, 1, "ровно один <img> (аватар), найдено " + imgs.length);
assert.ok(/src="\/avatar\.webp"/.test(imgs[0]), "img — это /avatar.webp");
assert.ok(/width="\d+" height="\d+"/.test(imgs[0]), "у аватара заданы размеры (нет сдвига макета)");
// WebP ровно 2× слота: крупнее — лишние байты на первом экране (PNG 288×288 весил 134 КБ)
{
  const av = fs.readFileSync(path.join(APP, "avatar.webp"));
  assert.ok(av.slice(0, 4).toString() === "RIFF" && av.slice(8, 12).toString() === "WEBP", "app/avatar.webp — настоящий WebP");
  assert.ok(av.length < 20 * 1024, "avatar.webp ≤ 20 КБ, сейчас " + av.length);
  // размер кадра простого VP8 (lossy): 14 бит ширины и высоты сразу за стартовым кодом
  assert.strictEqual(av.slice(12, 16).toString(), "VP8 ", "avatar.webp — простой VP8 (без альфы, она у фото не нужна)");
  assert.deepStrictEqual([av.readUInt16LE(26) & 0x3fff, av.readUInt16LE(28) & 0x3fff], [144, 144], "avatar.webp — 144×144, ровно 2× слота 72");
  assert.ok(!fs.existsSync(path.join(APP, "avatar.png")), "старый avatar.png убран — второго файла аватара нет");
}
assert.ok(!/\.(jpe?g|png|gif)(?![?"])/i.test(html), "других растровых форматов нет");
assert.ok(!/@font-face/i.test(html), "веб-шрифтов нет");
assert.ok(!/<link[^>]+rel="stylesheet"/i.test(html), "внешних стилей нет");
// внешних скриптов нет; свой же /chat.js (виджет чата с преподавателем) — ровно один и same-origin
assert.ok(!/<script[^>]+src="(?!\/)/i.test(html), "скриптов с чужих хостов нет");
assert.strictEqual((html.match(/<script src="\/chat\.js(\?v=[0-9a-f]{8})?" defer><\/script>/g) || []).length, 1, "ровно один тег виджета чата");
assert.ok(!/innerHTML/.test(html), "innerHTML запрещён (политика m0.html)");
const ALLOWED_HOSTS = ["wa.me", "learn.kg", "www.w3.org", "schema.org", "www.googletagmanager.com", "www.instagram.com", "mc.yandex.ru"];
for (const u of html.match(/https?:\/\/[^\s"')]+/g) || []) {
  const host = u.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  assert.ok(ALLOWED_HOSTS.includes(host), "неожиданный внешний адрес: " + u);
}

/* ---------- палитра совпадает с приложением ---------- */
const rootVars = (src) => {
  const block = src.match(/:root\{([^}]*--bg[^}]*)\}/);
  assert.ok(block, "блок :root с токенами найден");
  return [...block[1].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]).sort();
};
assert.deepStrictEqual(rootVars(html), rootVars(m0), "набор цветовых токенов совпадает с приложением");
assert.ok(/html\[data-theme="dark"\]/.test(html), "тёмная тема через data-theme, как в приложении");
assert.ok(/prefers-color-scheme: dark/.test(html), "авто-тема по системной настройке");

/* ---------- бюджет и контакты ---------- */
const bytes = Buffer.byteLength(html);
// потолок 108 КБ — осознанно: к прежним 84 КБ (FAQ ×3 языка + LD-граф + баннер согласия +
// перелинковка теста уровня) добавилась секция отзывов: 18 цитат на четырёх языках и
// 18 рисованных инлайн-SVG аватарок (внешних запросов по-прежнему ноль; SVG повторяет
// одни и те же примитивы и жмётся почти в ноль — по сети остаётся ~26 КБ gzip)
// 2026-08: аватарки уже дедуплицированы (<defs>/<use>, −4.7 КБ) — системный резерв выбран;
// рост дальше — реальный контент: секция «Бесплатные материалы» (4 карточки ×3 языка),
// +3 FAQ-пары ×3 языка. Бюджет сдвинут 108 → 112 осознанно.
// 2026-08-17: +2,9 КБ — шторка ожидания на переходах в тренажёр и демо (разметка, стили,
// делегированный обработчик, тексты ×3 языка). По сети это доли килобайта после gzip,
// а закрывает несколько секунд «ничего не происходит» на сборке персональной страницы.
// 2026-08-18: +7,6 КБ — курс B1 открыт: карточка уровня, плитки «Уроки произношения» и
// «Аудирование», FAQ-пара про подготовку к тестированию ×3 языка, Course B1 в LD-графе. Бюджет 116 → 124.
// 2026-08-18 (2): +7,3 КБ — E-E-A-T: секция «Методика и авторы» ×3 языка, Person-узлы
// (преподаватель и разработчик) в LD-графе, ссылка на Instagram в отзывах. Бюджет 124 → 132.
// 2026-09-04: +3,8 КБ — ВНЖ: второй оффер баннера ×3 языка, FAQ-пара «нужен ли кыргызский
// для ВНЖ» ×3 языка (закон о внешней миграции с августа 2025). Бюджет 132 → 136.
// 2026-09-04 (2): +1,0 КБ — дороги к пробному тесту A1 (строка «Без входа», футер, словарь
// ×3 языка) зеркально B1. Бюджет 136 → 140.
// 2026-09-14: +2,5 КБ — курс B2 открыт: карточка уровня со ссылкой, Course B2 в LD-графе
// (+ListItem), ключи lvl_b2/ld_course_b2 ×3 языка, дороги к пробному тесту B2 (строка
// «Без входа», футер, словарь ×3). Бюджет 140 → 144.
assert.ok(bytes < 144 * 1024, "лендинг ≤ 144 КБ, сейчас " + bytes);
const ogBytes = fs.statSync(path.join(APP, "og.png")).size;
assert.ok(ogBytes < 80 * 1024, "og.png ≤ 80 КБ, сейчас " + ogBytes);
assert.ok(html.includes("wa.me/996505854856"), "телефон Алтынай в ссылке WhatsApp");
assert.ok(html.includes("+996 505 854 856"), "телефон виден на странице");
for (const l of LANGS) assert.ok(D[l].ct_name.trim().length > 3, "имя преподавателя есть в " + l);
assert.ok(html.includes('rel="noopener noreferrer"'), "внешние ссылки с noopener");
assert.ok(html.includes('<link rel="canonical" href="https://learn.kg/ru">'), "canonical по канону — /ru");
assert.ok(html.includes("© 2026 learn.kg"), "копирайт в футере");
assert.ok(html.includes('href="/privacy"') && html.includes('href="/terms"'), "футер ссылается на политику и условия");
for (const f of ["privacy.html", "terms.html"]) assert.ok(fs.existsSync(path.join(APP, f)), "документ существует: " + f);
const crypto = require("crypto");
const ogHash = crypto.createHash("sha1").update(fs.readFileSync(path.join(APP, "og.png"))).digest("hex").slice(0, 6);
assert.ok(html.includes('og:image" content="https://learn.kg/og.png?v=' + ogHash + '"'),
  "og:image версионирован хешем содержимого (?v=" + ogHash + ") — перегенерировал картинку, подними версию");

/* ---------- SEO: длины сниппета (регрессионный забор) ---------- */
// 65 — тот же потолок, что у сайтовой гигиены в seo-keywords.test.js (два разных
// забора на одну величину разъезжались бы). 2026-09-05: ru-титул вырос до 63 —
// волна 3 SEO-плана, точная фраза «учить кыргызский язык» встала в начало титула.
for (const l of LANGS) {
  assert.ok(D[l].title.length <= 65, "title " + l + " ≤ 65, сейчас " + D[l].title.length);
  assert.ok(D[l].meta_desc.length >= 80 && D[l].meta_desc.length <= 160,
    "meta_desc " + l + " в 80–160, сейчас " + D[l].meta_desc.length);
}

/* ---------- SEO: LD-граф в маркерах, связность, FAQ ---------- */
const ldm = html.match(/<!-- ===LD-GRAPH=== -->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*<!-- ===\/LD-GRAPH=== -->/);
assert.ok(ldm, "LD-граф в маркерах ===LD-GRAPH===");
const graph = JSON.parse(ldm[1]);
assert.ok(Array.isArray(graph["@graph"]), "один блок @graph");
const byType = (t) => graph["@graph"].find((n) => [].concat(n["@type"]).includes(t));
const org = byType("Organization"), site = byType("WebSite"), course = byType("Course"), faq = byType("FAQPage");
assert.ok(org && org["@id"], "Organization с @id");
assert.ok(org.logo, "у Organization есть logo");
assert.ok((org.sameAs || []).some((u) => u.includes("instagram.com/learnkg_edu")), "Organization.sameAs → Instagram");
assert.ok(html.includes("instagram.com/learnkg_edu"), "ссылка на Instagram на странице");
assert.ok(site && site.publisher && site.publisher["@id"] === org["@id"], "WebSite.publisher → #org");
assert.ok(course && course.provider && course.provider["@id"] === org["@id"], "Course.provider → #org");
assert.ok(course.image, "у Course есть image");
assert.ok(!("courseWorkload" in (course.hasCourseInstance || {})), "courseWorkload убран (читался как «весь курс 20 минут»)");
assert.ok(JSON.stringify(course).includes("PT20M"), "ежедневные 20 минут описаны расписанием");
assert.ok(faq && Array.isArray(faq.mainEntity) && faq.mainEntity.length >= 5, "FAQPage ≥ 5 вопросов");
// все четыре открытых курса размечены отдельными Course-узлами со своим уровнем
assert.deepStrictEqual(graph["@graph"].filter((n) => n["@type"] === "Course").map((n) => n.educationalLevel),
  ["A1", "A2", "B1", "B2"], "Course-узлы графа: A1, A2, B1 и B2");
/* Карусель курсов: право на «Course list» даёт ItemList из ≥3 ListItem с position и url
   (schema-аудит 19.08). Элементы обязаны ССЫЛАТЬСЯ на Course-узлы графа по @id, а не
   дублировать сущности: копия дала бы два курса на один адрес. */
{
  const courses = graph["@graph"].filter((n) => n["@type"] === "Course");
  const list = graph["@graph"].find((n) => n["@type"] === "ItemList");
  assert.ok(list, "в графе витрины есть ItemList");
  assert.strictEqual(list.itemListElement.length, 4, "ItemList из четырёх курсов");
  assert.strictEqual(list.numberOfItems, 4, "numberOfItems = 4");
  assert.deepStrictEqual(list.itemListElement.map((x) => [x["@type"], x.position]),
    [["ListItem", 1], ["ListItem", 2], ["ListItem", 3], ["ListItem", 4]], "ListItem с позициями 1..4");
  assert.deepStrictEqual(list.itemListElement.map((x) => [x.name, x.url, x.item["@id"]]),
    courses.map((c) => [c.name, c.url, c["@id"]]),
    "элементы ItemList ссылаются на Course-узлы графа по @id и повторяют их имя и адрес");
  for (const x of list.itemListElement) assert.ok(!x.item["@type"], "элемент не дублирует сущность Course, а ссылается на неё");
}
for (const q of faq.mainEntity) {
  assert.ok(html.includes(q.name), "вопрос FAQPage дословно виден на странице: " + q.name.slice(0, 40));
  assert.ok(q.acceptedAnswer && q.acceptedAnswer.text, "у вопроса есть ответ");
}
// граф собирается из словаря — вопросы совпадают с faq_q* из D.ru
const faqKeys = Object.keys(D.ru).filter((k) => /^faq_q\d+$/.test(k));
assert.strictEqual(faq.mainEntity.length, faqKeys.length, "вопросов в графе столько же, сколько в словаре");
for (const k of faqKeys) assert.ok(faq.mainEntity.some((q) => q.name === D.ru[k]), "в графе есть " + k);

/* ---------- SEO: FAQ-секция и ограничение локализатора ---------- */
assert.ok(/<section id="faq"/.test(html), "секция #faq существует");
assert.ok((html.match(/<details/g) || []).length >= 5, "FAQ на <details> (работает без JS)");
// серверный локализатор заменяет текст data-i-узла до первого «<» — вложенная разметка запрещена
for (const m of html.matchAll(/\sdata-i="([a-z0-9_]+)"[^>]*>([^<]*)</g)) { /* захват до < по построению */ }
for (const m of html.matchAll(/<([a-z0-9]+)[^>]*\sdata-i="([a-z0-9_]+)"[^>]*>/g)) {
  const idx = m.index + m[0].length;
  const rest = html.slice(idx, html.indexOf("<", idx));
  assert.ok(!rest.includes("<"), "узел data-i=" + m[2] + " без вложенных тегов");
}

/* ---------- SEO: og:image:alt ---------- */
assert.ok(/property="og:image:alt" content="[^"]+"/.test(html), "og:image:alt задан");

/* ---------- Аналитика строго после согласия ---------- */
assert.ok(/id="consent"/.test(html), "баннер согласия существует");
assert.ok(/kga1-consent/.test(html), "выбор хранится в kga1-consent");
assert.ok(html.includes("G-YJG0X8KKRV"), "Measurement ID вшит");
assert.strictEqual((html.match(/googletagmanager\.com/g) || []).length, 1, "gtag-URL встречается ровно один раз (в ветке согласия)");
assert.ok(!/<script[^>]+src=[^>]*googletagmanager/.test(html), "gtag НЕ грузится статически");
const consentKeys = ["consent_text", "consent_accept", "consent_decline"];
for (const k of consentKeys) for (const l of LANGS) assert.ok(D[l][k], "ключ согласия " + k + " в " + l);

/* ---------- Политика раскрывает аналитику ---------- */
{
  const priv = fs.readFileSync(path.join(APP, "privacy.html"), "utf8");
  const arts = [...priv.matchAll(/<article class="doc" lang="(ru|en|tr)">([\s\S]*?)<\/article>/g)];
  assert.strictEqual(arts.length, 3, "в политике три языковых блока");
  for (const [, l, body] of arts) {
    assert.ok(/Google Analytics/i.test(body), "политика (" + l + ") называет Google Analytics");
    assert.ok(/_ga/.test(body), "политика (" + l + ") называет cookie _ga");
  }
  assert.ok(/kga1-consent/.test(priv), "в политике есть сброс выбора согласия");
}

/* ---------- контакт проекта виден и человеку, и поисковику ----------
   На витрине свой футер (не общий примитив siteFooter), поэтому почту сюда легко
   забыть: в первом прогоне 21.08.2026 она попала в разметку, но не в видимый футер. */
{
  assert.ok(/<a href="mailto:info@learn\.kg">info@learn\.kg<\/a>/.test(html),
    "почта проекта — ссылкой в футере витрины, а не только в разметке");
  const org = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"]
    .find((n) => n["@type"] === "Organization");
  assert.strictEqual(org.email, "info@learn.kg", "почта в Organization витрины");
  const mail = [].concat(org.contactPoint || []).find((p) => p.email);
  assert.ok(mail && mail.email === "info@learn.kg", "почта отдельным contactPoint");
}

/* ---------- бесплатные входы витрины ведут на свои страницы ----------
   Страницу можно сделать и забыть про дорогу к ней: пробный тест B1 сутки жил без
   единой ссылки с витрины (поймал владелец). Проверяем все три места и три языка. */
{
  const need = ["/probny-test-a1/ru", "/probny-test-b1/ru", "/probny-test-b2/ru", "/test/ru", "/razgovornik/ru", "/perevodchik/ru"];
  for (const href of need)
    assert.ok(html.includes('href="' + href + '"'), "витрина ведёт на " + href);
  /* Баннер даёт две дороги одной аудитории: кнопка — главный оффер ЭТОГО языка
     (ru — пробный тест B1, en — фразы для поездки, tr — сравнение с турецким),
     ссылка рядом — вторая. Проверяем по словарю: адреса приходят оттуда, и ошибка
     «en-кнопка ведёт на русскую страницу» видна только так. */
  assert.ok(/<div class="heropromo">/.test(html), "баннер — блок, а не одна большая ссылка");
  assert.ok(!/<a class="heropromo"/.test(html), "внутрь ссылки нельзя вложить вторую ссылку");
  for (const lang of ["ru", "en", "tr"]) {
    const roads = [D[lang].promo_btn, D[lang].promo_link];
    assert.ok(roads.includes("/probny-test-b1/" + lang),
      lang + ": из баннера есть дорога в пробный тест своего языка (" + roads.join(", ") + ")");
    assert.ok(roads.some((h) => h.startsWith("/blog/") && h.endsWith("/" + lang)),
      lang + ": вторая дорога баннера — статья блога своего языка");
    for (const key of ["promo_test", "promo_cta"])
      assert.ok(D[lang][key] && D[lang][key].length > 3, lang + ": подпись " + key + " на своём языке");
  }
  assert.strictEqual(D.ru.promo_btn, "/probny-test-b1/ru",
    "у русского баннера главный оффер — пробный тест: он про госслужащих, которым сдавать");
  /* Второй оффер того же баннера — ВНЖ: с августа 2025 кыргызский обязателен для вида
     на жительство; ведёт в разбор закона своего языка (адрес — из словаря) */
  assert.ok(/<div class="promo2">/.test(html), "в баннере есть второй оффер про ВНЖ");
  for (const lang of ["ru", "en", "tr"]) {
    assert.strictEqual(D[lang].promo2_link, "/blog/kyrgyzskiy-dlya-vnzh/" + lang, lang + ": оффер ВНЖ ведёт в статью своего языка");
    for (const key of ["promo2_h", "promo2_cta"])
      assert.ok(D[lang][key] && D[lang][key].length > 3, lang + ": подпись " + key + " на своём языке");
  }
  assert.ok(/href="\/blog\/kyrgyzskiy-dlya-vnzh\/ru" data-i="promo2_cta" data-i-href="promo2_link"/.test(html),
    "оффер ВНЖ: href строго перед data-i-href (контракт серверного регекспа)");
  // кнопка оффера ВНЖ ведёт в пробный тест A1 своего языка (просьба владельца 05.09.2026 — как у B1)
  assert.ok(/<a class="btn" href="\/probny-test-a1\/ru" data-i="promo2_test" data-i-href="promo2_btn">/.test(html),
    "оффер ВНЖ: кнопка пробного теста A1 (href перед data-i-href)");
  for (const lang of ["ru", "en", "tr"]) {
    assert.strictEqual(D[lang].promo2_btn, "/probny-test-a1/" + lang, lang + ": кнопка оффера ВНЖ ведёт на пробный тест A1 своего языка");
    assert.ok(D[lang].promo2_test && D[lang].promo2_test.length > 3, lang + ": подпись кнопки оффера ВНЖ");
  }
  // строка «Без входа», карточка инструментов и футер — три разных места
  assert.ok((html.match(/href="\/probny-test-b1\/ru"/g) || []).length >= 3,
    "пробный тест виден в строке «Без входа», среди бесплатных инструментов и в футере");
  // языковые словари: у каждой ссылки свой вариант, иначе en/tr уводят на русскую
  for (const [lang, path2] of [["ru", "/probny-test-b1/ru"], ["en", "/probny-test-b1/en"], ["tr", "/probny-test-b1/tr"]])
    assert.ok(html.includes('pb1_link:"' + path2 + '"'), lang + ": словарь ведёт на свой вариант пробного теста");
  // пробный тест A1 — те же дороги (строка «Без входа» и футер), словарь ведёт на свой язык
  assert.ok((html.match(/href="\/probny-test-a1\/ru"/g) || []).length >= 2, "пробный тест A1 виден в строке «Без входа» и в футере");
  for (const lang of ["ru", "en", "tr"])
    assert.ok(html.includes('pa1_link:"/probny-test-a1/' + lang + '"'), lang + ": словарь ведёт на свой вариант пробного теста A1");
  // пробный тест B2 — те же дороги (строка «Без входа» и футер), словарь ведёт на свой язык
  assert.ok((html.match(/href="\/probny-test-b2\/ru"/g) || []).length >= 2, "пробный тест B2 виден в строке «Без входа» и в футере");
  for (const lang of ["ru", "en", "tr"])
    assert.ok(html.includes('pb2_link:"/probny-test-b2/' + lang + '"'), lang + ": словарь ведёт на свой вариант пробного теста B2");
  for (const key of ["ft_pb1", "ft_pa1", "ft_pb2", "promo_test"])
    assert.strictEqual((html.match(new RegExp(key + ':"', "g")) || []).length, 3, key + " на трёх языках");
}

/* ---------- lastmod-манифест: дата привязана к содержимому ---------- */
{
  const manifest = JSON.parse(fs.readFileSync(path.join(APP, "seo-lastmod.json"), "utf8"));
  for (const [file, rec] of Object.entries(manifest)) {
    const sha = crypto.createHash("sha1").update(fs.readFileSync(path.join(APP, file))).digest("hex").slice(0, 8);
    assert.strictEqual(rec.sha, sha, file + " изменился — обнови date и sha в app/seo-lastmod.json");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(rec.date), "дата " + file + " в формате YYYY-MM-DD");
  }
}

/* ---------- контракты качества интерфейса (по итогам ревью) ---------- */
assert.ok(/<main\b/.test(html), "есть лендмарка <main>");
assert.ok(/class="skip"/.test(html), "есть skip-ссылка для клавиатуры");
assert.ok(/:focus-visible/.test(html), "стили фокуса для клавиатуры заданы");
assert.ok(/scroll-margin-top/.test(html), "якоря не прячутся под sticky-шапкой");
assert.ok(/--accent-ink/.test(html), "чернила акцентных поверхностей токенизированы (контраст тёмной темы)");
assert.ok(!/\.lvl\.soon\{[^}]*opacity/.test(html), "карточки «Скоро» не глушатся opacity (контраст)");
assert.ok(html.includes('href="tel:+996505854856"'), "телефон кликается (tel:)");
assert.ok(/aria-pressed="true"/.test(html), "выбранный язык размечен статически, до JS");
assert.ok(/prefers-reduced-motion/.test(html), "анимации отключаемы");
assert.ok(/@media print/.test(html), "печатные стили есть");
for (const m of html.match(/minmax\((\d+px)/g) || []) assert.ok(false, "grid minmax без min(): " + m);
assert.ok(!/og:locale:alternate/.test(html), "og:locale:alternate не используется (для языков есть hreflang)");
for (const l of ["ru", "en", "tr", "x-default"]) {
  assert.ok(html.includes('hreflang="' + l + '"'), "hreflang-альтернатива " + l + " объявлена");
}

/* ---------- общий контракт языка с приложением и формой входа ---------- */
for (const [name, src] of [["landing.html", html], ["login.html", loginHtml], ["m0.html", m0]]) {
  assert.ok(src.includes('"kga1-lang"'), name + " использует общий ключ kga1-lang");
  // автоопределение языка устройства — одна и та же политика во всех трёх файлах
  // (словарь → как есть, другой язык → en, языка нет → ru); копии без теста уже разъезжались
  assert.ok(src.includes('?n:n==="ky"?"ru":n?"en":"ru"'), name + " повторяет общий маппинг языка устройства (ky→ru: официальный язык)");
  // выбор языка обязан уехать и в куку: сервер решает по ней, на какой языковой вариант
  // отправить с голого адреса, а localStorage ему не виден
  assert.ok(/document\.cookie\s*=\s*"kga1-lang=/.test(src), name + " сохраняет выбор языка и в куку (её читает сервер)");
}
/* ---------- показ варианта ≠ выбор языка (исполняется, не грепается) ----------
   Реальный промах: applyLandingLang на старте страницы писала язык варианта в
   localStorage и куку — простое ОТКРЫТИЕ /en (второе окно, чужая ссылка) молча
   перезаписывало сохранённый ru, и язык «сам» слетал и на витрине, и в тренажёре. */
{
  const fnRemember = html.match(/function rememberLang\(l\)\{[\s\S]*?\n\}/);
  const fnApply = html.match(/function applyLandingLang\(l,remember\)\{[\s\S]*?\n\}/);
  assert.ok(fnRemember && fnApply, "rememberLang и applyLandingLang(l,remember) найдены");
  const writes = [];
  const lsb = {
    console, LANDING_I18N: D, lt: (k) => (D.ru[k] !== undefined ? D.ru[k] : k),
    localStorage: { setItem: (k, v) => writes.push(["ls", k, v]), getItem: () => null },
    syncThemeButton() {}, currentLandingTheme: () => "auto",
    document: {
      cookie: "",
      documentElement: { lang: "", dataset: {} },
      title: "",
      querySelectorAll: () => ({ forEach() {} }),
      getElementById: () => ({ setAttribute() {}, querySelectorAll: () => ({ forEach() {} }) }),
    },
  };
  Object.defineProperty(lsb.document, "cookie", {
    get(){ return ""; }, set(v){ writes.push(["cookie", v]); },
  });
  vm.createContext(lsb);
  vm.runInContext(fnRemember[0] + "\n" + fnApply[0], lsb);
  vm.runInContext('applyLandingLang("en")', lsb);
  assert.deepStrictEqual(writes, [], "показ варианта не пишет выбор (ни localStorage, ни куку)");
  vm.runInContext('applyLandingLang("en",true)', lsb);
  assert.ok(writes.some((w) => w[0] === "ls" && w[1] === "kga1-lang" && w[2] === "en")
    && writes.some((w) => w[0] === "cookie" && String(w[1]).startsWith("kga1-lang=en")),
    "явный выбор пишется и в localStorage, и в куку");
  assert.ok(/applyLandingLang\(landingLang\(\)\);/.test(html),
    "стартовый вызов — без remember (показ страницы выбором не является)");
  assert.ok(/applyLandingLang\(l,true\);/.test(html), "клик по переключателю запоминает выбор");
}

/* ---------- никаких заявлений о стоимости ----------
   Решение владельца: цену и условия человек обсуждает с преподавателем, публично
   стоимость (в т.ч. «запись бесплатная») не пишется. Исключение — само демо:
   оно действительно открыто без регистрации, и это ключевые слова для поиска. */
const PRICE_CLAIMS = [
  /(запис[ьи]|доступ|обучени[ея]|курс)[^.<"]{0,60}бесплатн/i,
  /(enrol|access|course|tuition)[^.<"]{0,60}\bfree\b/i,
  /(kayıt|erişim|kurs)[^.<"]{0,60}ücretsiz/i,
  /free of charge/i, /плат(ить|ы)\s+не\s+нужно/i, /no payment/i, /ödeme gerekmez/i,
  /isAccessibleForFree/, /"@type"\s*:\s*"Offer"/, /priceCurrency/,
];
// Серверный код — ЦЕЛИКОМ, одним стогом по всем server/*.js (helpers/server-src):
// прежний перечень срезов отставал при каждой новой странице и не переживёт
// декомпозицию; стог сканирует и будущие файлы автоматически. Маркер-блоки
// страниц при этом обязаны существовать и быть единственными — это навигационный
// контракт (пропавший или задвоенный маркер роняет тест внутри helper.marker).
const srvSrc = require("./helpers/server-src");
for (const m of ["LEVEL-TEST", "RAZGOVORNIK", "PEREVODCHIK", "KURS", "HELP", "DOC-CHROME"]) srvSrc.marker(m);
srvSrc.slice(/function buildGraph[\s\S]*?\n\}/, "buildGraph");
for (const [name, src] of [["landing.html", html], ["terms.html", fs.readFileSync(path.join(APP, "terms.html"), "utf8")],
  ["privacy.html", fs.readFileSync(path.join(APP, "privacy.html"), "utf8")],
  ["m0.html (демо-строки)", (m0.match(/\/\* ===I18N=== \*\/[\s\S]*?\/\* ===\/I18N=== \*\//) || [""])[0]],
  ["server/*.js", srvSrc.all],
  ["kurs/kurs.json", fs.readFileSync(path.join(APP, "kurs", "kurs.json"), "utf8")],
  ["help/help.json", fs.readFileSync(path.join(APP, "help", "help.json"), "utf8")],
  ["test/level-test.json", fs.readFileSync(path.join(APP, "test", "level-test.json"), "utf8")],
  ["razgovornik/razgovornik.json", fs.readFileSync(path.join(APP, "razgovornik", "razgovornik.json"), "utf8")],
  ["perevodchik/perevodchik.json", fs.readFileSync(path.join(APP, "perevodchik", "perevodchik.json"), "utf8")],
  ...fs.readdirSync(path.join(APP, "blog")).filter((f) => f.endsWith(".json"))
    .map((f) => ["blog/" + f, fs.readFileSync(path.join(APP, "blog", f), "utf8")])]) {
  for (const re of PRICE_CLAIMS) {
    const hit = src.match(re);
    assert.ok(!hit, name + ": заявление о стоимости — " + (hit ? JSON.stringify(hit[0].slice(0, 80)) : ""));
  }
}
// демо остаётся «попробовать бесплатно» во всех трёх словарях — это правда и SEO
for (const l of LANGS) assert.ok(/бесплатн|free|ücretsiz/i.test(D[l].cta_demo), "кнопка демо зовёт попробовать бесплатно: " + l);

/* ---------- перелинковка теста уровня ---------- */
for (const l of LANGS) {
  assert.strictEqual(D[l].test_link, "/test/" + l, "test_link " + l + " ведёт на свой языковой вариант");
  assert.ok(D[l].cta_test.trim().length > 0, "cta_test " + l + " непуст");
  assert.ok(D[l].ft_test.trim().length > 0, "ft_test " + l + " непуст");
}
assert.ok(/href="\/test\/ru" data-i="cta_test" data-i-href="test_link"/.test(html),
  "hero-кнопка теста уровня: href строго перед data-i-href (контракт серверного регекспа)");
assert.ok(/href="\/test\/ru" data-i="ft_test" data-i-href="test_link"/.test(html), "футер ведёт на тест уровня");

const loginDict = loginHtml.match(/const LOGIN_I18N=\{[\s\S]*?\n\};/);
assert.ok(loginDict, "LOGIN_I18N найден");
const lsb = {};
vm.createContext(lsb);
vm.runInContext(loginDict[0] + "; this.L=LOGIN_I18N;", lsb);
assert.deepStrictEqual(Object.keys(lsb.L).sort(), LANGS.slice().sort(), "форма входа знает три языка");
for (const l of LANGS) assert.deepStrictEqual(Object.keys(lsb.L[l]).sort(), Object.keys(lsb.L.ru).sort(), "паритет LOGIN_I18N: " + l);
assert.ok(loginHtml.includes('fetch("/api/login"'), "форма входа шлёт на абсолютный /api/login");
assert.ok(loginHtml.includes('href="/"'), "из формы входа можно вернуться на витрину");

/* ── шторка ожидания: вход и демо собираются на сервере секунды ─────────────── */
// Витрина: предикат «этот переход долгий» исполняется, а не пиннится грепом.
{
  const m = html.match(/if\(!(\/\^.*?\/)\.test\(a\.getAttribute\("href"\)\|\|""\)\)return;/);
  assert.ok(m, "в обработчике витрины есть предикат долгого перехода");
  const re = new RegExp(m[1].slice(1, -1));
  for (const href of ["/demo/ru", "/demo/en", "/demo/tr", "/login"])
    assert.ok(re.test(href), "шторка поднимается на " + href);
  for (const href of ["/blog/ru", "/razgovornik/ru", "/perevodchik/tr", "/test/ru", "/privacy", "/"])
    assert.ok(!re.test(href), "на быстром переходе " + href + " шторки быть не должно");
  assert.ok(/<div class="wait" id="wait" hidden>/.test(html), "шторка витрины по умолчанию скрыта");
  assert.ok(/data-i="wait_lead"/.test(html) && /data-i="wait_sub"/.test(html),
    "тексты шторки берутся из словаря (значит, есть на всех трёх языках)");
}
// Форма входа: исполняем сам обработчик со заглушками — успех держит шторку до перехода,
// ошибка её снимает (иначе неверный пароль оставил бы человека под вечным спиннером).
// Обработчик асинхронный, поэтому и проверка, и финальный отчёт живут в async-блоке.
(async () => {
  const mS = loginHtml.match(/\/\* ===LOGIN-SUBMIT===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/LOGIN-SUBMIT=== \*\//);
  assert.ok(mS, "маркер ===LOGIN-SUBMIT=== в форме входа");
  assert.ok(/<div class="wait" id="wait" hidden>/.test(loginHtml), "шторка формы входа скрыта по умолчанию");
  const run = async (ok, body) => {
    const nodes = { e: { style: {}, textContent: "" }, wait: { hidden: true },
      l: { value: " asel " }, p: { value: "pw" } };
    const replaced = [];
    const sb = { console, LOGIN_I18N: lsb.L, loginLang: () => "ru",
      document: { getElementById: (id) => nodes[id] },
      location: { pathname: "/login", replace: (u) => replaced.push(u) },
      fetch: async () => ({ ok, json: async () => body }) };
    vm.createContext(sb);
    vm.runInContext(mS[1] + "; this.RUN = submitLogin;", sb);
    await sb.RUN({ preventDefault(){} });
    return { nodes, replaced };
  };
  const good = await run(true, {});
  assert.deepStrictEqual(good.replaced, ["/"], "после успешного входа уходим в тренажёр");
  assert.strictEqual(good.nodes.wait.hidden, false, "во время перехода шторка поднята");
  const bad = await run(false, { error: "Неверный пароль" });
  assert.strictEqual(bad.nodes.wait.hidden, true, "на ошибке входа шторка снята");
  assert.strictEqual(bad.nodes.e.textContent, "Неверный пароль", "текст ошибки показан");
  assert.strictEqual(bad.nodes.e.style.display, "block", "блок ошибки видим");

  /* ── отданный сервером /ru: сниппет волны 3 (05.09.2026) ─────────────────── */
  // Не греп исходника: витрину собирает localizedLanding(), и в выдачу едет то,
  // что вернул живой сервер. Фраза «учить кыргызский язык» — точный запрос кластера
  // (Wordstat 117/мес, Яндекс поз. 1,9 по /ru): она обязана быть в титуле,
  // в description и в первом абзаце hero, иначе правка волны 3 молча откатилась.
  {
    const { startServer } = require("./helpers/serve");
    const DATA = "/tmp/kga1-landing-test-" + process.pid;
    fs.mkdirSync(DATA, { recursive: true });
    const srv = await startServer({ port: 8221, dataDir: DATA });
    try {
      const r = await srv.req("GET", "/ru");
      assert.strictEqual(r.status, 200, "/ru отвечает 200");
      const title = (r.text.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
      assert.strictEqual(title, "Учить кыргызский язык онлайн: курс с нуля с озвучкой · learn.kg",
        "/ru: титул волны 3, сейчас " + JSON.stringify(title));
      assert.ok(title.length <= 65, "/ru: титул " + title.length + " > 65 (обрежется в выдаче)");
      const desc = (r.text.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
      assert.ok(desc.toLowerCase().includes("учить кыргызский язык"),
        "/ru: description несёт «учить кыргызский язык», сейчас " + JSON.stringify(desc));
      assert.ok(desc.toLowerCase().includes("кыргызский язык онлайн"),
        "/ru: description несёт «кыргызский язык онлайн» (запрос 191/мес не теряем)");
      assert.ok(desc.length >= 80 && desc.length <= 160, "/ru: description " + desc.length + " вне 80–160");
      const lead = (r.text.match(/<p class="lead" data-i="hero_lead">([^<]*)<\/p>/) || [])[1] || "";
      assert.ok(lead.toLowerCase().includes("учить кыргызский язык"),
        "/ru: фраза в первом абзаце hero, сейчас " + JSON.stringify(lead));
      const og = (r.text.match(/property="og:title" content="([^"]*)"/) || [])[1] || "";
      assert.strictEqual(og, title.replace(" · learn.kg", ""), "/ru: og:title согласован с титулом");
      // бюджет байт витрины (тот же потолок, что у исходника выше)
      assert.ok(Buffer.byteLength(r.text) < 144 * 1024, "/ru отдан ≤ 144 КБ, сейчас " + Buffer.byteLength(r.text));
      // футер каждого варианта ведёт на хаб слов СВОЕГО языка (до 08.10 витрина хаб не линковала:
      // 28 из 30 страниц слов лежали на глубине 3); аватар отдаётся WebP-ом
      // хранимая копия LD-графа в landing.html (её читают проверки выше) = то, что отдаёт сервер
      const servedLd = r.text.match(/<!-- ===LD-GRAPH=== -->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert.deepStrictEqual(JSON.parse(servedLd[1]), graph, "LD-граф в landing.html устарел — перегенерируй из отданного /ru");
      const variants = { ru: r };
      for (const l of ["en", "tr"]) variants[l] = await srv.req("GET", "/" + l);
      for (const l of ["ru", "en", "tr"]) {
        const v = variants[l];
        const foot = (v.text.match(/<footer>[\s\S]*?<\/footer>/) || [""])[0];
        assert.ok(foot.includes('<a href="/slovo/' + l + '" data-i="ft_slovo" data-i-href="slovo_link">' + D[l].ft_slovo + "</a>"),
          "/" + l + ": в футере витрины ссылка на хаб /slovo/" + l);
        // Решение владельца 30.10.2026: на отданной витрине (текст, словарь, LD) нет названия
        // организатора тестирования — только адрес официального сайта; материал курса не
        // выдаётся за «официальные списки/формат», а в FAQ о подготовке сказано, что задания
        // курса с официальными не связаны
        const rest = v.text.replace(/kyrgyztest\.gov\.kg/g, "");
        assert.ok(!/кыргыз\s*тест|k[ıi]rg[ıi]z\s*test/i.test(rest), "/" + l + ": названия организатора тестирования на витрине нет");
        assert.ok(!/официальн\S* (спис|формат)|official (\w+ )?(topic )?lists|in the official (\w+ )?format|resmî (\S+ )?(konu listeler|listeler|format)|экзаменационного формата|exam-format|exam task formats|sınav formatında|sınav görev formatlar/i.test(v.text),
          "/" + l + ": нет утверждений «по официальным спискам / в формате экзамена»");
        assert.ok(/не связаны с заданиями официального тестирования|not related to the tasks of the official test|resmî sınavın görevleriyle bağlantılı değildir/.test(v.text),
          "/" + l + ": FAQ о подготовке говорит, что задания курса не связаны с официальным тестированием");
      }
      const av = await srv.req("GET", "/avatar.webp");
      assert.strictEqual(av.status, 200, "/avatar.webp отвечает 200");
      assert.strictEqual(av.headers.get("content-type"), "image/webp", "/avatar.webp отдаётся как image/webp");
      assert.strictEqual((await srv.req("GET", "/avatar.png")).status, 404, "старого /avatar.png больше нет");
    } finally { await srv.stop(); }
  }

  console.log("landing.test.js: OK (словарь ru/en/tr, уровни, A1 " + a1n.phrases + " + A2 " + a2n.phrases + " + B1 " + b1n.phrases + " + B2 " + b2n.phrases + " фраз / " + (a1n.modules + a2n.modules + b1n.modules + b2n.modules) + " модулей сверены с CONTENT, ноль внешних запросов, " + html.length + " Б)");
})();
