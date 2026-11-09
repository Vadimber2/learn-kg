"use strict";
/* Публичные страницы сайта — вынесены из server.js декомпозицией (решение владельца,
   2026-08-18): блог, тест уровня, разговорник, переводчик, страницы курсов, помощь,
   /slovo/* и хром документов. Код перенесён БАЙТ-В-БАЙТ (эталон — снимок хэшей всех
   публичных URL до/после), зависимости приходят из ctx. Две фазы, потому что buildDemo
   (остался в server.js — демо сцеплено с аудио-гейтом) пользуется хром-примитивами,
   а билдеры страниц пользуются DEMO:
     initChrome({YM_SNIPPET})            → примитивы шапки/футера/LD
     initPages({...chrome, DEMO, ...})   → собранные страницы для LOCALIZED_PAGES
   Маркер-блоки (===LEVEL-TEST=== и т.д.) переехали сюда — тесты ищут их по всем
   server/*.js через tests/helpers/server-src. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Почта проекта — одна на весь сайт (футер, помощь, юридические страницы, разметка
// Organization): адрес меняется в одном месте, гейт chrome.test следит, что он везде.
const SITE_EMAIL = "info@learn.kg";
const SITE_WA = "https://wa.me/996505854856"; // WhatsApp преподавателя — единая константа, а не 20 литералов
// Виджет чата с преподавателем — одной строкой после футера на каждой публичной странице
// (скрипт общий и кэшируемый, словарь подставляет сервер). Демо-тренажёр его не получает.
let CHAT_TAG = '<script src="/chat.js" defer></script>';
// версия из хеша исходников виджета (server.js считает её до сборки страниц): свежий тег после деплоя
const setChatVersion = (v) => { CHAT_TAG = '<script src="/chat.js?v=' + v + '" defer></script>'; };
// Словарь по языкам — ровно ru/en/tr с одинаковыми ключами: ключ, забытый в одном
// языке, отрисовался бы пустым местом. Одна проверка на все словари страниц-из-данных.
function keyParity(byLang, die, label) {
  if (Object.keys(byLang || {}).sort().join(",") !== "en,ru,tr") die(label + " не ровно ru/en/tr");
  const ru = Object.keys(byLang.ru).sort().join(",");
  for (const l of ["en", "tr"]) if (Object.keys(byLang[l]).sort().join(",") !== ru) die("паритет ключей " + label + " сломан: " + l);
}
// Тексты курсов (app/kurs/kurs.json) читаются один раз на сервер: ими живут и страницы
// /kurs-*, и Course-узлы витрины. Витрина собирается раньше initPages, поэтому
// загрузчик и узел — функции модуля, а не часть фаз init.
function loadKursText(APP_DIR) {
  const K = JSON.parse(fs.readFileSync(path.join(APP_DIR, "kurs", "kurs.json"), "utf8"));
  const die = (m) => { throw new Error("страницы курсов: " + m); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(K.updated || "")) die("updated не дата");
  keyParity(K.labels, die, "labels"); // общие подписи страниц курсов
  return K;
}
// Course-узел LD — один построитель на витрину и страницу курса: узлы с общим @id
// Google склеивает в одну сущность, поэтому собраны они обязаны быть одинаково.
function courseLd(K, cid, lang, orgId) {
  const ui = K.courses[cid].ui[lang], base = "https://learn.kg/kurs-" + cid;
  return { "@type": "Course", "@id": base + "#course",
    "name": ui.h1, "description": ui.desc, "url": base + "/" + lang,
    "image": "https://learn.kg/og.png", "provider": { "@id": orgId }, "teaches": K.labels[lang].teaches,
    // Ценовых полей в узле нет намеренно: условия человек обсуждает с преподавателем,
    // а поисковик показал бы такие поля ценой прямо в выдаче (тест это стережёт)
    "inLanguage": ["ru", "en", "tr"], "educationalLevel": cid.toUpperCase(),
    "hasCourseInstance": { "@type": "CourseInstance", "courseMode": "online",
      "courseSchedule": { "@type": "Schedule", "repeatFrequency": "P1D", "duration": "PT20M" } } };
}

function initChrome(ctx) {
  const { YM_SNIPPET, APP_DIR } = ctx;
// UI-строки сайта (шапка, футер, блоговые подписи, CTA) — данные, не код:
// app/site-ui.json. Паритет ключей трёх языков проверяется на старте (fail-fast),
// как у остальных страниц-из-данных.
const BLOG_UI = JSON.parse(fs.readFileSync(path.join(APP_DIR, "site-ui.json"), "utf8"));
{
  const ru = Object.keys(BLOG_UI.ru).sort().join(",");
  for (const l of ["en", "tr"]) if (Object.keys(BLOG_UI[l]).sort().join(",") !== ru) throw new Error("site-ui.json: паритет ключей сломан: " + l);
}
// Рубрики блога — реестр: section в JSON статьи хранит КЛЮЧ отсюда (не трёхъязычный
// литерал — те дрейфовали: на 15 статей набралось 6 разных формулировок). Порядок
// объекта = порядок групп на индексе. Неизвестный ключ роняет старт (см. buildBlog).
const BLOG_SECTIONS = {
  learn: { ru: "Как учить", en: "How to learn", tr: "Nasıl öğrenilir" },
  vocab: { ru: "Слова и фразы", en: "Words and phrases", tr: "Kelimeler ve ifadeler" },
  exam:  { ru: "Экзамен и закон", en: "Exam and the law", tr: "Sınav ve yasa" },
  lang:  { ru: "О языке", en: "About the language", tr: "Dil üzerine" },
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Инлайн-ссылка в тексте статьи: ((анкор|/путь)). Замена идёт ПОСЛЕ esc(), а путь
// ограничен безопасным классом символов — инъекция атрибута через текст невозможна.
const INLINE_LINK_RE = /\(\(([^|()]+)\|(\/[a-z0-9/_#-]+)\)\)/g; // # — якоря разделов (/razgovornik/ru#san)
const renderP = (x) => esc(x).replace(INLINE_LINK_RE, '<a href="$2">$1</a>');
const plainText = (x) => String(x).replace(INLINE_LINK_RE, "$1"); // для articleBody/wordCount — только текст анкора
// Единый узел Organization для LD-графов блога и теста уровня
const ORG_ID = "https://learn.kg/#org";
// logo — квадрат icon-512, не og-баннер: широкая картинка в слоте логотипа рисуется полосой
const ORG = { "@type": "Organization", "@id": ORG_ID, "name": "learn.kg", "url": "https://learn.kg/", "logo": "https://learn.kg/icon-512.png" };
// Единый примитив шапки и футера: одни и те же правила для контентных страниц
// (в составе BLOG_CSS) и для одностраничников (===DOC-CHROME===). Панельные фоны —
// с фолбэком на --card: у документов токена --panel нет.
const CHROME_CSS =
  '.topcta{margin-left:auto;background:var(--accent);color:#fff;text-decoration:none;border-radius:9px;padding:8px 13px;font-size:.82rem;font-weight:600;white-space:nowrap}' +
  '.mnav{display:none;position:relative}' +
  '.mnav summary{list-style:none;cursor:pointer;font-size:1.3rem;line-height:1;padding:7px 11px;border:1px solid var(--line);border-radius:9px;color:var(--ink)}' +
  '.mnav summary::-webkit-details-marker{display:none}' +
  '.mnav[open] summary{background:var(--line)}' +
  '.mlist{position:absolute;left:0;top:calc(100% + 8px);display:flex;flex-direction:column;min-width:230px;background:var(--panel,var(--card));border:1px solid var(--line);border-radius:12px;padding:8px;box-shadow:0 12px 32px rgba(16,24,40,.25);z-index:40}' +
  '.mlist a{padding:12px 14px;color:var(--ink);text-decoration:none;border-radius:8px;font-size:.95rem}' +
  '.mlist a:hover{background:var(--line)}' +
  '.mlist .mcta{background:var(--accent);color:#fff;text-align:center;font-weight:600;margin-top:4px}' +
  '.mlist .mlogin{display:none}' +
  '.shead{position:sticky;top:0;z-index:30;background:var(--panel,var(--card));border-bottom:1px solid var(--line);margin-bottom:14px}' +
  '.shead .hrow{display:flex;align-items:center;gap:14px;height:58px;max-width:1080px;margin:0 auto;padding:0 16px}' +
  '.brand{font-weight:700;font-size:1rem;white-space:nowrap;text-decoration:none;color:var(--ink)}' +
  '.brand small{display:block;font-weight:400;font-size:.7rem;color:var(--muted);letter-spacing:.04em}' +
  '.snav{display:flex;gap:14px;min-width:0}' +
  '.snav a{font-size:.88rem;color:var(--muted);text-decoration:none;white-space:nowrap;padding:8px 2px;display:inline-grid;justify-items:center}' +
  '.snav a:hover{color:var(--ink)}' +
  '.snav a[aria-current]{color:var(--ink);font-weight:600}' +
  '.snav a::after,.slogin::after,.topcta::after,.brand small::after{content:attr(data-rw);display:block;height:0;visibility:hidden;font-weight:600}' +
  '.shead .seg{margin-left:auto;border:1px solid var(--line);border-radius:10px;gap:0}' +
  '.shead .seg a{border:none;border-radius:9px;font-size:.8rem;font-weight:600;padding:9px 12px;color:var(--muted)}' +
  '.shead .seg a[aria-current]{background:var(--accent);color:#fff}' +
  '.slogin{color:var(--accent);border:1px solid var(--accent);border-radius:10px;padding:8px 16px;text-decoration:none;font-size:.85rem;font-weight:600;white-space:nowrap;display:inline-grid;justify-items:center}' +
  '.topcta{display:inline-grid;justify-items:center}' +
  '@media (max-width:900px){.shead .hrow{height:52px;gap:8px;padding:0 10px}.mnav{display:block}.snav{display:none}.topcta{display:none}.brand small{display:none}.shead .seg{margin-left:auto}.shead .seg a{padding:10px 9px}.mnav summary{padding:7px 9px}.slogin{padding:8px 10px}.crumbs a{padding:10px 0}.seg a{padding:10px 12px}}' +
  '@media (max-width:389px){.shead .hrow{gap:6px}.brand{font-size:.95rem}.mnav summary{padding:7px 7px}.shead .seg a{padding:10px 6px}.slogin{padding:8px 8px}}' +
  '@media (max-width:359px){.slogin{display:none}.mlist .mlogin{display:block}}' +
  '.seg{margin-left:10px;display:flex;gap:6px}' +
  '.seg a{color:var(--muted);text-decoration:none;font-size:.78rem;font-weight:600;padding:6px 9px;border:1px solid var(--line);border-radius:9px}' +
  '.seg a[aria-current="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}' +
  '.shead .seg button{border:none;background:transparent;cursor:pointer;font-family:inherit;border-radius:9px;font-size:.8rem;font-weight:600;padding:9px 12px;color:var(--muted)}' +
  '.shead .seg button[aria-pressed="true"]{background:var(--accent);color:#fff}' +
  '.sfoot{border-top:1px solid var(--line);margin-top:36px;background:var(--panel,var(--card))}' +
  '.sfoot .frow{max-width:1080px;margin:0 auto;padding:18px 16px 26px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;font-size:.85rem;color:var(--muted)}' +
  '.sfoot a{color:var(--muted);text-decoration:none;padding:4px 0}' +
  '.sfoot a:hover{color:var(--ink)}' +
  '.sfoot .fsp{flex:1 1 auto;min-width:8px}';
const BLOG_CSS = ':root{--bg:#f6f7f9;--card:#fff;--panel:#ffffff;--ink:#1c2430;--muted:#57616e;--accent:#0e7490;--line:#dde2e8}' +
  'html[data-theme="dark"]{--bg:#10151c;--card:#1a212b;--panel:#161c25;--ink:#e7ecf2;--muted:#8b98a7;--accent:#38bdf8;--line:#2a3442}' +
  '@media (prefers-color-scheme:dark){html[data-theme="auto"]{--bg:#10151c;--card:#1a212b;--panel:#161c25;--ink:#e7ecf2;--muted:#8b98a7;--accent:#38bdf8;--line:#2a3442}}' +
  '*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.65}' +
  '.wrap{max-width:720px;margin:0 auto;padding:32px 16px 64px}.top{display:flex;align-items:center;gap:10px;margin-bottom:18px}' +
  // порядок шапки: back | …auto… | CTA | переключатель. Переключатель ПОСЛЕДНИЙ и прижат
  // к краю: длина текста CTA меняется от языка к языку, и если seg стоит перед кнопкой,
  // RU/EN/TR прыгают при каждом переключении — гуляет только левая граница кнопки
  '.crumbs{display:flex;align-items:center;gap:6px;font-size:.85rem;min-width:0;flex:1;color:var(--muted)}.crumbs a{color:var(--accent);text-decoration:none;padding:6px 0;white-space:nowrap}.crumbs [aria-current]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crumbs .sep{color:var(--line);flex:none}.tw{overflow-x:auto;margin:14px 0}table{border-collapse:collapse;width:100%;font-size:.95rem}th,td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top}th{font-weight:600;background:var(--line)}' + CHROME_CSS + '' +
  'h1{font-size:1.75rem;letter-spacing:-.02em;line-height:1.22;margin:0 0 8px}h2{font-size:1.15rem;margin:30px 0 8px}' +
  '.meta{color:var(--muted);font-size:.82rem;margin-bottom:24px}.lead{font-size:1.05rem;color:var(--ink);margin:0 0 8px}' +
  'p{margin:0 0 12px}a{color:var(--accent)}article{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:26px 22px}' +
  '.post{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:12px;text-decoration:none;color:inherit}' +
  '.post:hover{border-color:var(--accent)}.post h2,.post h3{margin:0 0 6px;font-size:1.1rem}.post p{color:var(--muted);font-size:.9rem;margin:0}.posts{list-style:none;padding:0;margin:0 0 8px}.posts li{margin:0}.intro{color:var(--muted);margin:0 0 10px}.testcard{border:1.5px solid var(--accent);background:transparent}' +
  '.fig{display:block;width:100%;height:auto;margin:16px 0 18px;color:var(--muted)}' +
  '.callout{border:1px solid var(--accent);border-radius:12px;padding:16px 18px;margin:22px 0;background:var(--accent-soft,rgba(14,116,144,.08))}' +
  '.callout b{display:block;margin-bottom:6px}.callout p{margin:0 0 12px;color:var(--muted);font-size:.92rem}' +
  '.cta2{display:inline-block;margin:8px 8px 0 0;border:1px solid var(--accent);color:var(--accent);text-decoration:none;border-radius:10px;padding:10px 17px;font-weight:600}' +
  // пруф-цитата: дословный текст первоисточника + ссылка (блог: b.proof)
  '.proof{margin:10px 0;padding:10px 14px;border-left:3px solid var(--accent);background:var(--card);border-radius:0 10px 10px 0;font-style:italic}' +
  '.proof p{margin:0 0 6px}.proof cite{display:block;font-style:normal;font-size:.85rem;color:var(--muted)}.proof cite a{overflow-wrap:anywhere}' +
  '.refs{margin-top:26px;border-top:1px solid var(--line);padding-top:14px}.refs h2{margin:0 0 8px;font-size:1rem}' +
  '.refs ol{margin:0;padding-left:20px}.refs li{font-size:.85rem;color:var(--muted);margin-bottom:6px;overflow-wrap:anywhere}' +
  '.refs a{overflow-wrap:anywhere;word-break:break-all}article{overflow-wrap:anywhere}.post{overflow-wrap:anywhere}' +
  '.cta{display:inline-block;margin-top:8px;background:var(--accent);color:#fff;text-decoration:none;border-radius:10px;padding:11px 18px;font-weight:600}' +
  ':where(a):focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}';
/* Иллюстрации — рисованные inline-SVG: ни одного внешнего запроса, тема наследуется
   через currentColor, подпись берётся из заголовка блока (уже переведённого). */
const FIGS = {
  intervals: '<svg viewBox="0 0 640 150" class="fig" role="img"><title>{t}</title>' +
    '<line x1="30" y1="110" x2="610" y2="110" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>' +
    [[70, "1"], [190, "3"], [350, "7"], [560, "16"]].map(([x, d], i) =>
      '<circle cx="' + x + '" cy="110" r="7" fill="var(--accent)"/>' +
      '<text x="' + x + '" y="136" text-anchor="middle" font-size="13" fill="currentColor" opacity=".7">' + d + '</text>' +
      '<path d="M' + (i ? [70, 190, 350][i - 1] : 30) + ' 110 Q ' + ((x + (i ? [70, 190, 350][i - 1] : 30)) / 2) + ' ' + (60 - i * 8) + ' ' + x + ' 110" fill="none" stroke="var(--accent)" stroke-width="2" stroke-opacity=".55"/>').join("") +
    '<rect x="14" y="94" width="32" height="32" rx="7" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="2"/>' +
    '<text x="320" y="26" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  audio: '<svg viewBox="0 0 640 130" class="fig" role="img"><title>{t}</title>' +
    Array.from({ length: 34 }, (_, i) => {
      const hgt = 12 + Math.round(38 * Math.abs(Math.sin(i * 0.7)) + (i % 5) * 3);
      return '<rect x="' + (28 + i * 17) + '" y="' + (72 - hgt / 2) + '" width="7" height="' + hgt + '" rx="3.5" fill="var(--accent)" fill-opacity="' + (i % 3 ? ".45" : ".85") + '"/>';
    }).join("") +
    '<text x="30" y="118" font-size="13" fill="currentColor" opacity=".7">1×</text>' +
    '<text x="600" y="118" font-size="13" text-anchor="end" fill="currentColor" opacity=".7">0.5×</text></svg>',
  harmony: '<svg viewBox="0 0 640 170" class="fig" role="img"><title>{t}</title>' +
    '<rect x="24" y="20" width="270" height="120" rx="14" fill="var(--accent)" fill-opacity=".10" stroke="var(--accent)" stroke-width="2"/>' +
    '<rect x="346" y="20" width="270" height="120" rx="14" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<text x="159" y="52" text-anchor="middle" font-size="15" fill="currentColor" opacity=".75">а · ы · о · у</text>' +
    '<text x="159" y="90" text-anchor="middle" font-size="26" fill="currentColor">жумуш + та</text>' +
    '<text x="159" y="122" text-anchor="middle" font-size="13" fill="currentColor" opacity=".6">-да / -та · -до / -то</text>' +
    '<text x="481" y="52" text-anchor="middle" font-size="15" fill="currentColor" opacity=".75">е · и · ө · ү</text>' +
    '<text x="481" y="90" text-anchor="middle" font-size="26" fill="currentColor">үй + дө</text>' +
    '<text x="481" y="122" text-anchor="middle" font-size="13" fill="currentColor" opacity=".6">-де / -те · -дө / -тө</text></svg>',
  quiz: '<svg viewBox="0 0 640 130" class="fig" role="img"><title>{t}</title>' +
    Array.from({ length: 20 }, (_, i) =>
      '<rect x="' + (24 + (i % 10) * 42) + '" y="' + (24 + Math.floor(i / 10) * 46) + '" width="34" height="34" rx="8" ' +
      (i < 16 ? 'fill="var(--accent)" fill-opacity=".85"' : 'fill="currentColor" fill-opacity=".10" stroke="currentColor" stroke-opacity=".3" stroke-width="2"') + "/>").join("") +
    '<text x="470" y="52" font-size="20" fill="currentColor">16 / 20</text>' +
    '<text x="470" y="80" font-size="14" fill="currentColor" opacity=".65">80%</text></svg>',
  week: '<svg viewBox="0 0 640 160" class="fig" role="img"><title>{t}</title>' +
    [["1", 92, ".85"], ["2", 92, ".85"], ["3", 92, ".85"], ["4", 62, ".5"], ["5", 74, ".5"], ["6", 54, ".35"], ["7", 34, ".2"]]
      .map(([d, hgt, op], i) =>
        '<rect x="' + (30 + i * 84) + '" y="' + (120 - hgt) + '" width="54" height="' + hgt + '" rx="9" fill="var(--accent)" fill-opacity="' + op + '"/>' +
        '<text x="' + (57 + i * 84) + '" y="142" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">' + d + "</text>").join("") +
    '<text x="30" y="22" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  curve: '<svg viewBox="0 0 640 180" class="fig" role="img"><title>{t}</title>' +
    '<line x1="34" y1="150" x2="612" y2="150" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>' +
    '<line x1="34" y1="20" x2="34" y2="150" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>' +
    '<path d="M34 30 C 90 120, 140 140, 200 146" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="2.5" stroke-dasharray="6 5"/>' +
    '<path d="M34 30 C 70 90, 100 104, 150 106 L150 34 C 200 96, 240 112, 300 114 L300 38 C 380 100, 430 112, 500 116 L500 44 C 560 92, 590 104, 612 108" fill="none" stroke="var(--accent)" stroke-width="3"/>' +
    [150, 300, 500].map((x) => '<circle cx="' + x + '" cy="34" r="6" fill="var(--accent)"/>').join("") +
    '<text x="210" y="168" font-size="13" fill="currentColor" opacity=".6">{t}</text></svg>',
  streak: '<svg viewBox="0 0 640 110" class="fig" role="img"><title>{t}</title>' +
    Array.from({ length: 14 }, (_, i) =>
      '<rect x="' + (24 + i * 44) + '" y="30" width="34" height="34" rx="9" ' +
      (i === 5 ? 'fill="currentColor" fill-opacity=".10" stroke="currentColor" stroke-opacity=".3" stroke-width="2"' : 'fill="var(--accent)" fill-opacity=".8"') + "/>").join("") +
    '<text x="24" y="88" font-size="13" fill="currentColor" opacity=".6">{t}</text></svg>',
  levels: '<svg viewBox="0 0 640 190" class="fig" role="img"><title>{t}</title>' +
    [["A1", 90, 100, "1"], ["A2", 180, 200, ".75"], ["B1", 350, 400, ".5"]].map(([lv, h1, h2, op], i) =>
      '<rect x="' + (60 + i * 200) + '" y="' + (150 - h1 / 3) + '" width="120" height="' + (h1 / 3) + '" rx="10" fill="var(--accent)" fill-opacity="' + op + '"/>' +
      '<text x="' + (120 + i * 200) + '" y="' + (140 - h1 / 3) + '" text-anchor="middle" font-size="14" fill="currentColor">' + h1 + "–" + h2 + '</text>' +
      '<text x="' + (120 + i * 200) + '" y="172" text-anchor="middle" font-size="15" font-weight="bold" fill="currentColor">' + lv + '</text>').join("") +
    '<text x="320" y="24" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  exam: '<svg viewBox="0 0 640 150" class="fig" role="img"><title>{t}</title>' +
    ["А1", "А2", "В1", "В2", "С1"].map((lv, i) =>
      '<rect x="' + (28 + i * 120) + '" y="34" width="104" height="70" rx="12" fill="var(--accent)" fill-opacity="' + (0.9 - i * 0.16) + '"/>' +
      '<text x="' + (80 + i * 120) + '" y="78" text-anchor="middle" font-size="24" fill="#fff">' + lv + '</text>').join("") +
    '<text x="320" y="134" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  alphabet: '<svg viewBox="0 0 640 220" class="fig" role="img"><title>{t}</title>' +
    "АБВГДЕЁЖЗИЙКЛМНҢОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ".split("").map((ch, i) => {
      const sp = "ҢӨҮ".includes(ch);
      return '<rect x="' + (28 + (i % 12) * 49) + '" y="' + (20 + Math.floor(i / 12) * 52) + '" width="41" height="41" rx="9" ' +
        (sp ? 'fill="var(--accent)" fill-opacity=".85"' : 'fill="currentColor" fill-opacity=".07"') + "/>" +
        '<text x="' + (48.5 + (i % 12) * 49) + '" y="' + (48 + Math.floor(i / 12) * 52) + '" text-anchor="middle" font-size="19" fill="' + (sp ? "#fff" : "currentColor") + '">' + ch + "</text>";
    }).join("") +
    '<text x="320" y="205" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  morphemes: '<svg viewBox="0 0 640 150" class="fig" role="img"><title>{t}</title>' +
    [["китеп", 150, ".85"], ["тер", 96, ".6"], ["им", 76, ".45"], ["де", 76, ".3"]].reduce((acc, [m, w, op]) => {
      const x = acc.x;
      acc.out += '<rect x="' + x + '" y="40" width="' + w + '" height="52" rx="10" fill="var(--accent)" fill-opacity="' + op + '"/>' +
        '<text x="' + (x + w / 2) + '" y="73" text-anchor="middle" font-size="22" fill="currentColor">' + m + "</text>";
      acc.x = x + w + 14; return acc;
    }, { x: 60, out: "" }).out +
    '<text x="320" y="122" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
  tree: '<svg viewBox="0 0 640 200" class="fig" role="img"><title>{t}</title>' +
    '<line x1="320" y1="48" x2="180" y2="96" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<line x1="320" y1="48" x2="460" y2="96" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<line x1="180" y1="120" x2="110" y2="158" stroke="var(--accent)" stroke-opacity=".6" stroke-width="2"/>' +
    '<line x1="180" y1="120" x2="250" y2="158" stroke="var(--accent)" stroke-opacity=".6" stroke-width="2"/>' +
    '<line x1="460" y1="120" x2="460" y2="158" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>' +
    '<rect x="250" y="16" width="140" height="34" rx="10" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/>' +
    '<rect x="110" y="90" width="140" height="32" rx="10" fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width="2"/>' +
    '<rect x="390" y="90" width="140" height="32" rx="10" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/>' +
    '<rect x="48" y="152" width="124" height="32" rx="10" fill="var(--accent)" fill-opacity=".85"/>' +
    '<rect x="192" y="152" width="124" height="32" rx="10" fill="var(--accent)" fill-opacity=".55"/>' +
    '<rect x="398" y="152" width="124" height="32" rx="10" fill="currentColor" fill-opacity=".12"/>' +
    '<text x="320" y="38" text-anchor="middle" font-size="14" fill="currentColor">{a}</text>' +
    '<text x="180" y="111" text-anchor="middle" font-size="13" fill="currentColor">{b}</text>' +
    '<text x="460" y="111" text-anchor="middle" font-size="13" fill="currentColor">{c}</text>' +
    '<text x="110" y="173" text-anchor="middle" font-size="14" fill="#fff">{d}</text>' +
    '<text x="254" y="173" text-anchor="middle" font-size="14" fill="currentColor">{e}</text>' +
    '<text x="460" y="173" text-anchor="middle" font-size="14" fill="currentColor">{f}</text></svg>',
  meter: '<svg viewBox="0 0 640 170" class="fig" role="img"><title>{t}</title>' +
    [["{d} ↔ {e}", 0.72, "1"], ["{e} ↔ {f}", 0.3, ".6"], ["{d} ↔ {f}", 0.22, ".45"]].map(([lbl, v, op], i) =>
      '<text x="30" y="' + (44 + i * 44) + '" font-size="13" fill="currentColor" opacity=".8">' + lbl + '</text>' +
      '<rect x="240" y="' + (30 + i * 44) + '" width="370" height="18" rx="9" fill="currentColor" fill-opacity=".08"/>' +
      '<rect x="240" y="' + (30 + i * 44) + '" width="' + Math.round(370 * v) + '" height="18" rx="9" fill="var(--accent)" fill-opacity="' + op + '"/>').join("") +
    '<text x="320" y="158" text-anchor="middle" font-size="13" fill="currentColor" opacity=".65">{t}</text></svg>',
};
function figSvg(name, title, vars) {
  const f = FIGS[name];
  if (!f) throw new Error("блог: нет иллюстрации " + name);
  let out = f.split("{t}").join(esc(title));
  for (const [k, v] of Object.entries(vars || {})) out = out.split("{" + k + "}").join(esc(v));
  return out;
}
function blogHead(lang, urlPath, title, desc, ld, opts) {
  // opts — расширение для не-блоговых страниц канона (/test): og:type и добавка к CSS.
  // Без opts вывод обязан быть байт-в-байт прежним — блог это стерегут его тесты.
  const ogType = (opts && opts.ogType) || "article";
  const css = (opts && opts.css) || BLOG_CSS;
  // Картинка превью: по умолчанию общий баннер сайта, статья может назвать свою
  // (поле og в JSON статьи → файл app/og/<имя>, раздаётся с /og/<имя>)
  const ogImage = (opts && opts.ogImage) || "https://learn.kg/og.png";
  const alt = ["ru", "en", "tr"].map((l) =>
    '\n<link rel="alternate" hreflang="' + l + '" href="https://learn.kg' + urlPath + "/" + l + '">').join("") +
    '\n<link rel="alternate" hreflang="x-default" href="https://learn.kg' + urlPath + '">';
  return '<html lang="' + lang + '" data-srv-lang="' + lang + '" data-theme="auto">\n<head>\n<meta charset="UTF-8">' +
    '\n<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '\n<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">' +
    '\n<base href="/">' + // страница глубины 2–3: относительные пути иначе уводят вглубь
    '\n<link rel="canonical" href="https://learn.kg' + urlPath + "/" + lang + '">' + alt +
    '\n<meta property="og:type" content="' + ogType + '">\n<meta property="og:title" content="' + esc(title) + '">' +
    '\n<meta property="og:description" content="' + esc(desc) + '">' +
    '\n<meta property="og:url" content="https://learn.kg' + urlPath + "/" + lang + '">' +
    '\n<meta property="og:image" content="' + esc(ogImage) + '">' +
    '\n<meta property="og:locale" content="' + (lang === "ru" ? "ru_RU" : lang === "tr" ? "tr_TR" : "en_US") + '">' +
    '\n<link rel="icon" href="/favicon.ico">' +
    '\n<script>try{var _t=localStorage.getItem("kga1-theme");document.documentElement.dataset.theme=(_t==="light"||_t==="dark")?_t:"auto";}catch(e){}</script>' +
    '\n<style>' + css + '</style>\n' + YM_SNIPPET +
    '\n<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + '</script>\n</head>\n';
}
function langSeg(urlPath, lang) {
  return '<span class="seg">' + ["ru", "en", "tr"].map((l) =>
    '<a href="' + urlPath + "/" + l + '"' + (l === lang ? ' aria-current="true"' : "") + '>' + l.toUpperCase() + "</a>").join("") + "</span>";
}
// Канон «адрес авторитетен»: клик по переключателю — переход на соседний вариант, выбор
// дублируется в localStorage и куку (по ней сервер негоциирует голые адреса). Контракт
// куки живёт ОДНОЙ строкой — копии в страницах разъезжались бы молча.
const LANG_SEG_JS =
  'var seg=document.querySelectorAll(".seg a");\n' +
  'for(var i=0;i<seg.length;i++)(function(a){a.addEventListener("click",function(){\n' +
  '  var l=(a.textContent||"").toLowerCase();\n' +
  '  try{localStorage.setItem("kga1-lang",l);document.cookie="kga1-lang="+l+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}\n' +
  '});})(seg[i]);\n';
// Валидация ui-словаря локализованной страницы из данных: три языка, паритет ключей,
// SEO-лимиты title/desc, непустые FAQ-пары. Специфика страницы ({n}, verdicts) — у билдера.
function validateLocalizedUi(ui, die) {
  keyParity(ui, die, "ui");
  for (const [l, u] of Object.entries(ui)) {
    // 60 — про голый ui.title страниц из данных (суффикс « · learn.kg» им не клеится);
    // рендерный title с суффиксом стережёт tests/seo-keywords.test.js лимитом 65
    if (u.title.length > 60) die("title " + l + " длиннее 60");
    if (u.desc.length < 80 || u.desc.length > 160) die("desc " + l + " вне 80–160: " + u.desc.length);
    if (!Array.isArray(u.faq) || u.faq.length < 3) die("faq " + l + " меньше трёх");
    for (const f of u.faq) if (!f.q || !f.a) die("faq " + l + ": пустая пара");
    // Инлайн-ссылка ((анкор|/путь)) рендерится ТОЛЬКО в ответе FAQ (faqSection);
    // маркер в любом другом поле уехал бы в выдачу текстом — роняем старт.
    for (const [k, v] of Object.entries(u)) {
      if (k === "faq") { for (const f of v) if (String(f.q).includes("((")) die("faq " + l + ": маркер ((…)) в вопросе"); continue; }
      if (JSON.stringify(v).includes("((")) die(l + ": маркер ((…)) в поле " + k + " — ссылку рендерит только ответ FAQ");
    }
  }
}
// FAQ одной формой в двух представлениях: узел разметки FAQPage и HTML-секция —
// паритет между ними держится этими хелперами, а не руками на каждой странице.
// Ответ несёт инлайн-ссылку той же формы ((анкор|/путь)), что и абзац статьи:
// в HTML — ссылка, в разметку FAQPage едет текст анкора (маркер там был бы мусором).
const faqLd = (faq) => ({ "@type": "FAQPage", "mainEntity": faq.map((f) => ({ "@type": "Question", "name": f.q,
  "acceptedAnswer": { "@type": "Answer", "text": plainText(f.a) } })) });
const faqSection = (faqTitle, faq) => '<section class="faq"><h2>' + esc(faqTitle) + "</h2>\n" +
  faq.map((f) => "<h3>" + esc(f.q) + "</h3><p>" + renderP(f.a) + "</p>").join("\n") + "</section>\n";
// Узел WebPage LD одной формой (test/razgovornik/perevodchik — паритет хелпером)
const webPageLd = (base, lang, name, desc) => ({ "@type": "WebPage", "@id": "https://learn.kg" + base + "/" + lang,
  "name": name, "description": desc, "url": "https://learn.kg" + base + "/" + lang,
  "inLanguage": lang, "publisher": { "@id": ORG_ID } });
// Шапка публичной страницы: назад, переключатель языков, CTA демо
// Хлебные крошки: одна форма для видимой цепочки и узла BreadcrumbList.
// items: [[подпись, href|null]] — последний элемент = текущая страница (без href)
const crumbsNav = (label, items) => '<nav class="crumbs" aria-label="' + esc(label) + '">' +
  items.map(([t, h]) => h ? '<a href="' + h + '">' + esc(t) + "</a>" : '<span aria-current="page">' + esc(t) + "</span>")
    .join('<span class="sep" aria-hidden="true">›</span>') + "</nav>";
const crumbsLd = (items) => ({ "@type": "BreadcrumbList", "itemListElement": items.map(([t, h], i) =>
  Object.assign({ "@type": "ListItem", "position": i + 1, "name": t }, h ? { "item": "https://learn.kg" + h } : {})) });
// Единая шапка контентных страниц (мировой паттерн Stripe/Ahrefs: блог живёт под шапкой
// сайта): бренд → главную своего языка, разделы с подсветкой текущего, «Войти»,
// переключатель языков. Ниже неё — строка topBar: крошки + CTA демо.
// [база, ключ подписи, якорь?]: href = база + "/" + язык + якорь. «Курсов» в меню нет
// (решение владельца): к курсам ведут карточки витрины, футер (A1·A2·B1) и «Помощь».
const SITE_NAV = [["/blog", "blog"], ["/razgovornik", "navRz"], ["/perevodchik", "navPv"], ["/help", "navHelp"]];
// Резерв ширины под самый длинный из трёх переводов (приём data-rw с лендинга):
// иначе при переключении языка шапка «прыгает» — элементы меняют ширину
const rwOf = (key) => ["ru", "en", "tr"].map((l) => BLOG_UI[l][key]).sort((a, b) => b.length - a.length)[0];
const rwA = (key) => ' data-rw="' + esc(rwOf(key)) + '"';
const siteHeader = (base, lang, bui, opts) => '<header class="shead"><div class="hrow">' +
  // мобильный бургер (details/summary — работает без JS, доступен с клавиатуры);
  // на десктопе скрыт, разделы там живут в .snav той же строкой
  '<details class="mnav"><summary aria-label="' + (lang === "ru" ? "Меню" : lang === "tr" ? "Menü" : "Menu") + '">☰</summary><div class="mlist">' +
  SITE_NAV.map(([b, key, anchor]) => '<a href="' + b + "/" + lang + (anchor || "") + '">' + esc(bui[key]) + "</a>").join("") +
  '<a class="mlogin" href="/login">' + esc(bui.login) + '</a><a class="mcta" href="/demo/' + lang + '">' + esc(bui.tryDemo) + "</a></div></details>" +
  '<a class="brand" href="/' + lang +
  '"><span lang="ky">Кыргыз тили</span><small' + rwA("brandSub") + '>' + esc(bui.brandSub) + '</small></a><nav class="snav">' +
  SITE_NAV.map(([b, key, anchor]) => '<a href="' + b + "/" + lang + (anchor || "") + '"' + (b && (base === b || base.startsWith(b + "/")) ? ' aria-current="true"' : "") + rwA(key) + ">" +
    esc(bui[key]) + "</a>").join("") +
  "</nav>" + (opts && opts.docSeg ? '<span class="seg" role="group" aria-label="Тил / Language">' + ["ru", "en", "tr"].map((l) => '<button type="button" data-doclang="' + l + '" aria-pressed="' + (l === lang) + '">' + l.toUpperCase() + "</button>").join("") + "</span>" : langSeg(base, lang)) + '<a class="slogin" href="/login"' + rwA("login") + ">" + esc(bui.login) + "</a>" +
  '<a class="topcta" href="/demo/' + lang + '"' + rwA("tryDemo") + ">" + esc(bui.tryDemo) + "</a></div></header>\n";
// Единый футер публичных страниц — та же навигация, что в шапке, плюс курсы,
// тест уровня, установка и юридические страницы: с любой страницы виден весь сайт.
const siteFooter = (lang, bui) => '<footer class="sfoot"><div class="frow">' +
  '<span>© 2026 learn.kg · <span lang="ky">Кыргыз тили</span></span>' +
  '<span class="fsp"></span>' +
  '<a href="/kurs-a1/' + lang + '">' + esc(bui.navKurs) + " A1</a>" +
  '<a href="/kurs-a2/' + lang + '">A2</a>' +
  '<a href="/kurs-b1/' + lang + '">B1</a>' +
  '<a href="/kurs-b2/' + lang + '">B2</a>' +
  '<a href="/blog/' + lang + '">' + esc(bui.blog) + "</a>" +
  '<a href="/razgovornik/' + lang + '">' + esc(bui.navRz) + "</a>" +
  '<a href="/slovo/' + lang + '">' + esc(bui.ftWords) + "</a>" +
  '<a href="/perevodchik/' + lang + '">' + esc(bui.navPv) + "</a>" +
  '<a href="/test/' + lang + '">' + esc(bui.ftTest) + "</a>" +
  '<a href="/probny-test-a1/' + lang + '">' + esc(bui.ftPa1) + "</a>" +
  '<a href="/probny-test-b1/' + lang + '">' + esc(bui.ftPb1) + "</a>" +
  '<a href="/probny-test-b2/' + lang + '">' + esc(bui.ftPb2) + "</a>" +
  '<a href="/help/' + lang + '">' + esc(bui.navHelp) + "</a>" +
  '<a href="/install">' + esc(bui.ftInstall) + "</a>" +
  '<a href="/privacy">' + esc(bui.ftPrivacy) + "</a>" +
  '<a href="/terms">' + esc(bui.ftTerms) + "</a>" +
  '<a href="/login">' + esc(bui.login) + "</a>" +
  '<a href="' + SITE_WA + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
  '<a href="https://www.instagram.com/learnkg_edu" target="_blank" rel="noopener noreferrer">Instagram</a>' +
  // почта — на каждой странице: людям, которым мессенджер неудобен (учреждения,
  // подрядчики, запросы по данным), нужен адрес, а не только WhatsApp. Не переводится
  '<a href="mailto:' + SITE_EMAIL + '">' + SITE_EMAIL + "</a>" +
  "</div></footer>\n" + CHAT_TAG + "\n";
// DOM-порядок = визуальному (WCAG 1.3.2). Шапка сайта в topBar НЕ входит — она шире
// колонки контента (мировой паттерн: глобальная шапка на широком контейнере) и
// вставляется колл-сайтом до <div class="wrap">
const topBar = (base, lang, bui, crumbs) => '<div class="top">' + crumbsNav(bui.crumbsLabel, crumbs) + "</div>\n";
// Финальная карточка-магнит: демо + WhatsApp Алтынай (+ extra-маршруты страницы)
const ctaCallout = (lang, bui, o) => '<div class="callout"><b>' + esc(o.title) + "</b><p>" + esc(o.text) + "</p>" +
  "<p>" + esc(bui.waText) + "</p>" +
  '<p><a class="cta" href="/demo/' + lang + '">' + esc(o.demo) + '</a> ' +
  '<a class="cta" href="' + SITE_WA + '?text=' + encodeURIComponent(bui.waMsg) + '" target="_blank" rel="noopener noreferrer">' + esc(bui.waBtn) + "</a> " +
  (o.extra || []).map((e) => '<a class="cta2" href="' + e[0] + '">' + esc(e[1]) + "</a>").join(" ") + "</p></div>\n";
// Гейт качества артефакта: каждый <script> отдачи — валидный JS
const vmScanScripts = (buf) => { for (const m of buf.toString("utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]); };
// Транслитерация кыргызской кириллицы для en/tr-читателя: без неё слова на
// страницах en/tr нечитаемы. Конвенции разные: en — англо-практическая (ch/sh/j),
// tr — турецкая академическая (ç/ş/c, ң→ñ, ы→ı). Только отображение и поиск —
// поле ky в данных остаётся чистой кириллицей (канон).
const KY_LAT = {
  en: { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","ң":"ng","о":"o","ө":"ö","п":"p","р":"r","с":"s","т":"t","у":"u","ү":"ü","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya" },
  tr: { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"c","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","ң":"ñ","о":"o","ө":"ö","п":"p","р":"r","с":"s","т":"t","у":"u","ү":"ü","ф":"f","х":"h","ц":"ts","ч":"ç","ш":"ş","щ":"şç","ъ":"","ы":"ı","ь":"","э":"e","ю":"yu","я":"ya" },
};
function kyToLat(str, lang) {
  const map = KY_LAT[lang];
  let out = "";
  for (const ch of String(str).toLowerCase()) out += (map[ch] !== undefined ? map[ch] : ch);
  return out;
}

// Сборка демо живёт здесь, а не в блоке артефактов: вызову нужны и etagOf (выше),
// и ORG/webPageLd из общих хелперов (выше) — раньше любого из них будет TDZ на старте
  return { BLOG_CSS, BLOG_SECTIONS, BLOG_UI, CHROME_CSS, FIGS, INLINE_LINK_RE, KY_LAT, LANG_SEG_JS, ORG, ORG_ID, SITE_EMAIL, SITE_NAV, blogHead, crumbsLd, crumbsNav, ctaCallout, esc, faqLd, faqSection, figSvg, kyToLat, langSeg, plainText, renderP, rwA, rwOf, siteFooter, siteHeader, topBar, validateLocalizedUi, vmScanScripts, webPageLd };
}

function initPages(ctx) {
  const { APP_DIR, BLOG_CSS, BLOG_SECTIONS, BLOG_UI, CHROME_CSS, COURSES, COURSE_IDS, DATA_DIR, DEMO, KURS_TEXT, LANDING_DICT, LANG_SEG_JS, ORG, ORG_ID, YM_ID, YM_SNIPPET, appshell, blogHead, crumbsLd, ctaCallout, esc, etagOf, faqLd, faqSection, figSvg, kyToLat, logger, pack, plainText, renderP, siteFooter, siteHeader, topBar, validateLocalizedUi, vmScanScripts, webPageLd } = ctx;

function buildBlog() {
  let files = [];
  try { files = fs.readdirSync(path.join(APP_DIR, "blog")).filter((f) => f.endsWith(".json")).sort(); } catch {}
  const posts = files.map((f) => JSON.parse(fs.readFileSync(path.join(APP_DIR, "blog", f), "utf8")));
  const orgId = ORG_ID, org = ORG;
  // Маркер ((анкор)) обязан до отдачи превратиться в ссылку или текст. Уцелевший «((» —
  // маркер в поле, которое не рендерится ссылкой (lead/заголовок/desc), — роняем старт.
  const packChecked = (html, where) => {
    if (html.includes("((")) throw new Error("блог: маркер ((анкор|путь)) протёк в HTML " + where);
    return pack(html);
  };
  const pages = {}; // base → { vars, date }
  // Рубрика статьи — ключ реестра BLOG_SECTIONS; неизвестный ключ = ошибка старта,
  // иначе статья молча выпала бы из сгруппированного индекса
  for (const p of posts) if (!BLOG_SECTIONS[p.section])
    throw new Error("блог: у статьи " + p.slug + " неизвестная рубрика «" + p.section + "» (реестр BLOG_SECTIONS)");
  // Слаг, равный коду языка, перехватил бы индекс /blog/<lang> — ошибка старта, не молчание
  for (const p of posts) if (["ru", "en", "tr"].includes(p.slug))
    throw new Error("блог: слаг статьи совпадает с кодом языка: " + p.slug);
  // FAQ статьи опционален, но если есть — он есть на всех языках и непустыми парами:
  // в выдаче FAQPage тянет за собой расширенный сниппет, а пустой язык отдал бы
  // разметку без видимого текста (Google считает это несоответствием и снимает сниппет)
  // Таблица блока (поле t) — данные, а не HTML: ровность строк проверяется на старте,
  // иначе кривая таблица уехала бы в выдачу и в articleBody
  for (const p of posts) for (const l of ["ru", "en", "tr"]) {
    for (const [i, b] of (p.langs[l] ? p.langs[l].blocks : []).entries()) {
      if (!b.t) continue;
      const at = "блог: таблица " + p.slug + "/" + l + " блок " + i;
      if (!Array.isArray(b.t.head) || !b.t.head.length) throw new Error(at + " — пустой head");
      if (!Array.isArray(b.t.rows) || !b.t.rows.length) throw new Error(at + " — нет строк");
      for (const r of b.t.rows) if (!Array.isArray(r) || r.length !== b.t.head.length)
        throw new Error(at + " — строка на " + (r || []).length + " ячеек при " + b.t.head.length + " столбцах");
    }
  }
  // Пруфы блока (поле proof) — правило владельца 04.09.2026: цитата первоисточника и ссылка
  // на него живут В СТАТЬЕ, не только в списке литературы. Каждый пруф: дословная quote,
  // https-src и подпись label; битый пруф роняет старт, а не уезжает пустой рамкой.
  for (const p of posts) for (const l of ["ru", "en", "tr"]) {
    for (const [i, b] of (p.langs[l] ? p.langs[l].blocks : []).entries()) {
      if (b.proof === undefined) continue;
      const at = "блог: proof " + p.slug + "/" + l + " блок " + i;
      if (!Array.isArray(b.proof) || !b.proof.length) throw new Error(at + " — не массив или пуст");
      for (const q of b.proof) {
        if (!q || typeof q.quote !== "string" || !q.quote.trim()) throw new Error(at + " — пустая quote");
        if (typeof q.src !== "string" || !/^https:\/\//.test(q.src)) throw new Error(at + " — src не https-ссылка");
        if (typeof q.label !== "string" || !q.label.trim()) throw new Error(at + " — пустая подпись label");
      }
    }
  }
  for (const p of posts) if (p.faq) for (const l of ["ru", "en", "tr"]) {
    const f = p.faq[l];
    if (!Array.isArray(f) || f.length < 3) throw new Error("блог: faq " + p.slug + "/" + l + " — нужен массив из ≥3 пар");
    for (const x of f) if (!x.q || !x.a) throw new Error("блог: faq " + p.slug + "/" + l + " — пустая пара q/a");
  }
  /* Своя картинка превью у статьи (поле og) — имя файла в app/og/. Пока его нет ни у одной
     статьи: общий баннер /og.png остаётся фолбэком, а механизм готов принять рисунки, когда
     владелец их закажет. Имя проверяется белым шаблоном и НАЛИЧИЕМ файла на старте: og:image
     на 404 — худший вариант, чем общий баннер (превью в мессенджере просто пустое). */
  // og — имя файла (одна картинка на все языки) либо {ru,en,tr} (заголовок на баннере — на
  // языке страницы; файлы делает deploy/gen-og.py). Отсутствие — общий /og.png.
  const ogNameOf = (p, lang) => (p.og && typeof p.og === "object" ? p.og[lang] : p.og);
  const ogImageOf = (p, lang) => (ogNameOf(p, lang) ? "https://learn.kg/og/" + ogNameOf(p, lang) : "https://learn.kg/og.png");
  for (const p of posts) {
    if (p.og === undefined) continue;
    const names = typeof p.og === "object" && p.og !== null ? ["ru", "en", "tr"].map((l) => p.og[l]) : [p.og];
    for (const n of names) {
      if (typeof n !== "string" || !/^[a-z0-9-]{1,60}\.(png|jpg|webp)$/.test(n))
        throw new Error("блог: og статьи " + p.slug + " — не имя файла png/jpg/webp: " + n);
      if (!fs.existsSync(path.join(APP_DIR, "og", n)))
        throw new Error("блог: og статьи " + p.slug + " — нет файла app/og/" + n);
    }
  }
  // Группы индекса: порядок — реестр; внутри — свежие published выше, при равенстве slug
  // (детерминированно и одинаково на всех языках; сортировка файлов давала алфавит слагов)
  const grouped = Object.keys(BLOG_SECTIONS).map((key) => [key,
    posts.filter((p) => p.section === key).sort((a, b) => (a.published === b.published ? (a.slug < b.slug ? -1 : 1) : (a.published > b.published ? -1 : 1)))]);
  // индекс блога
  const idxVars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const ui = BLOG_UI[lang];
    const ld = { "@context": "https://schema.org", "@graph": [org,
      { "@type": "Blog", "@id": "https://learn.kg/blog/" + lang + "#blog", "name": "learn.kg — " + ui.blog,
        "description": ui.sub, "url": "https://learn.kg/blog/" + lang, "inLanguage": lang, "publisher": { "@id": orgId },
        "blogPost": posts.map((p) => ({ "@type": "BlogPosting", "headline": p.langs[lang].title,
          "description": p.langs[lang].desc, "url": "https://learn.kg/blog/" + p.slug + "/" + lang,
          "datePublished": p.published, "dateModified": p.updated, "inLanguage": lang, "author": { "@id": orgId } })) }] };
    const card = (href, title, desc) => '<li><a class="post" href="' + href + '"><h3>' + esc(title) + "</h3><p>" + esc(desc) + "</p></a></li>";
    const groupsHtml = grouped.map(([key, list]) =>
      "<h2>" + esc(BLOG_SECTIONS[key][lang]) + '</h2>\n<ul class="posts">\n' +
      list.map((p) => card("/blog/" + p.slug + "/" + lang, p.langs[lang].title, p.langs[lang].desc)).join("\n") +
      "\n</ul>").join("\n");
    const idxCrumbs = [[ui.home, "/" + lang], [ui.blog, null]];
    ld["@graph"].push(crumbsLd(idxCrumbs));
    const body = "<body>\n" + siteHeader("/blog", lang, ui) + "<main class=\"wrap\">\n" + topBar("/blog", lang, ui, idxCrumbs) +
      "<h1>" + esc(ui.idxH1) + '</h1>\n<p class="meta">' + esc(ui.sub) + '</p>\n<p class="intro">' + esc(ui.intro) + "</p>\n" +
      groupsHtml +
      // карточка теста уровня — вне списка статей и в своём стиле: это продукт, не текст
      '\n<a class="post testcard" href="/test/' + lang + '"><h3>' + esc(ui.testTitle) + "</h3><p>" + esc(ui.testDesc) + "</p></a>" +
      "\n</main>\n" + siteFooter(lang, ui) + "</body>\n</html>\n";
    idxVars[lang] = packChecked("<!DOCTYPE html>\n" + blogHead(lang, "/blog", ui.idxTitle + " · learn.kg", ui.idxDesc, ld, { ogType: "website" }) + body, "/blog/" + lang);
  }
  pages["/blog"] = { vars: new Map(Object.entries(idxVars)), date: posts.reduce((d, p) => (p.updated > d ? p.updated : d), "2026-01-01") };
  // статьи
  for (const p of posts) {
    const vars = {};
    for (const lang of ["ru", "en", "tr"]) {
      const a = p.langs[lang];
      // все три языка обязательны: hreflang и индекс строятся на полный набор, и статья
      // без одного из них тихо отдавала бы hreflang на 404 — лучше не стартовать
      if (!a) throw new Error("блог: у статьи " + p.slug + " нет языка " + lang);
      const ui = BLOG_UI[lang], urlPath = "/blog/" + p.slug;
      // articleBody/wordCount считаются из сырых строк ДО рендера — маркеры анкоров зачищаются до текста
      const faq = (p.faq && p.faq[lang]) || [];
      const tableText = (b) => (b.t ? b.t.head.concat(b.t.rows.flat()) : []);
      const proofText = (b) => (b.proof || []).map((q) => q.quote);
      const bodyText = [plainText(a.lead)]
        .concat(a.blocks.flatMap((b) => [plainText(b.h)].concat(b.p.map(plainText)).concat(proofText(b)).concat(tableText(b))))
        .concat(faq.flatMap((f) => [f.q, plainText(f.a)])).join("\n\n");
      const relatedHtml = (p.related || []).map((sl) => {
        const rp = posts.find((x) => x.slug === sl);
        if (!rp) throw new Error("блог: related-ссылка " + p.slug + " → " + sl + " не найдена");
        return '<a class="post" href="/blog/' + sl + "/" + lang + '"><h2>' + esc(rp.langs[lang].title) + "</h2><p>" + esc(rp.langs[lang].desc) + "</p></a>";
      }).join("\n");
      const relatedBlock = relatedHtml ? '<section class="refs"><h2>' + esc(ui.related) + "</h2></section>\n" + relatedHtml : "";
      const refs = p.refs || [];
      const refsHtml = refs.length ? '<section class="refs"><h2>' + esc(ui.refs) + "</h2><ol>" +
        refs.map((r) => "<li>" + esc(r.authors) + " (" + esc(String(r.year)) + "). " + esc(r.title) + ". <i>" + esc(r.source) + "</i>. " +
          '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.url.replace(/^https?:\/\//, "")) + "</a></li>").join("") +
        "</ol></section>" : "";
      const ld = { "@context": "https://schema.org", "@graph": [org,
        { "@type": "BlogPosting", "headline": a.title, "description": a.desc,
          "citation": refs.map((r) => ({ "@type": "CreativeWork", "name": r.title, "author": r.authors, "url": r.url })),
          "url": "https://learn.kg" + urlPath + "/" + lang,
          "mainEntityOfPage": { "@type": "WebPage", "@id": "https://learn.kg" + urlPath + "/" + lang },
          "datePublished": p.published, "dateModified": p.updated,
          "author": { "@type": "Organization", "@id": orgId, "name": "learn.kg" }, "publisher": { "@id": orgId },
          "articleSection": BLOG_SECTIONS[p.section][lang], "inLanguage": lang, "image": ogImageOf(p, lang),
          "isPartOf": { "@type": "Blog", "@id": "https://learn.kg/blog/" + lang + "#blog" },
          "wordCount": bodyText.split(/\s+/).filter(Boolean).length, "articleBody": bodyText }] };
      if (!refs.length) delete ld["@graph"][1].citation; // пустой citation — шум для парсеров
      // Месседж WhatsApp несёт заголовок статьи: Алтынай сразу видит, откуда и с каким
      // запросом пришёл человек (общий «уровень A1» врал читателям статей про B1/закон)
      const waHref = SITE_WA + "?text=" + encodeURIComponent(ui.waMsgArt.replace("{t}", a.title));
      const waCallout = '<aside class="callout"><b>' + esc(ui.waTitle) + "</b><p>" + esc(ui.waText) +
        '</p><a class="cta2" href="' + waHref + '" target="_blank" rel="noopener noreferrer">' + esc(ui.waBtn) + "</a></aside>";
      const midIdx = Math.floor((a.blocks.length - 1) / 2); // врезка после среднего блока: читатель уже втянулся
      const artCrumbs = [[ui.home, "/" + lang], [ui.blog, "/blog/" + lang], [a.title, null]];
      if (faq.length) ld["@graph"].push(faqLd(faq));
      ld["@graph"].push(crumbsLd(artCrumbs));
      const body = '<body>\n' + siteHeader(urlPath, lang, ui) + '<div class="wrap">\n' + topBar(urlPath, lang, ui, artCrumbs) + "<article>\n<h1>" + esc(a.title) + "</h1>\n" +
        '<p class="meta">' + esc(BLOG_SECTIONS[p.section][lang]) + " · " + esc(ui.updated) + " " + p.updated + "</p>\n" +
        '<p class="lead">' + esc(a.lead) + "</p>\n" +
        a.blocks.map((b, i) => "<h2>" + esc(b.h) + "</h2>\n" + b.p.map((x) => "<p>" + renderP(x) + "</p>").join("\n") +
          (b.proof || []).map((q) => '\n<blockquote class="proof"' + (q.lang ? ' lang="' + esc(q.lang) + '"' : "") + "><p>" + esc(q.quote) +
            '</p><cite><a href="' + esc(q.src) + '" target="_blank" rel="noopener noreferrer">' + esc(q.label) + "</a></cite></blockquote>").join("") +
          (b.t ? '\n<div class="tw"><table><thead><tr>' + b.t.head.map((c) => "<th>" + esc(c) + "</th>").join("") +
            "</tr></thead><tbody>" + b.t.rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
            "</tbody></table></div>" : "") +
          ((p.figs && p.figs[i]) ? "\n" + figSvg(p.figs[i], b.h, (p.figVars || {})[i] && ((p.figVars[i].langs || {})[lang] || p.figVars[i])) : "") + (i === midIdx ? "\n" + waCallout : "")).join("\n") +
        (faq.length ? "\n" + faqSection(ui.faqTitle, faq) : "") + refsHtml + relatedBlock +
        '\n<aside class="callout"><b>' + esc(ui.waTitle) + "</b><p>" + esc(ui.waText) + '</p>' +
        '<a class="cta" href="/demo/' + lang + '">' + esc(LANDING_DICT[lang].cta_demo) + "</a> " +
        '<a class="cta2" href="' + waHref + '" target="_blank" rel="noopener noreferrer">' + esc(ui.waBtn) + "</a> " +
        // третий маршрут финальной карточки: не готов писать/пробовать — узнай свой уровень
        '<a class="cta2" href="/test/' + lang + '">' + esc(ui.testCta) + "</a> " +
        // четвёртый: пришёл за фразами — вот справочник с озвучкой (и внутренняя перелинковка)
        '<a class="cta2" href="/razgovornik/' + lang + '">' + esc(ui.phrasebook) + "</a></aside>\n</article>\n</div>\n" + siteFooter(lang, ui) + "</body>\n</html>\n";
      vars[lang] = packChecked("<!DOCTYPE html>\n" +
        blogHead(lang, urlPath, a.title + " · learn.kg", a.desc, ld, { ogImage: ogImageOf(p, lang) }) + body, p.slug + "/" + lang);
    }
    pages["/blog/" + p.slug] = { vars: new Map(Object.entries(vars)), date: p.updated };
  }
  return pages;
}
const BLOG_PAGES = buildBlog();

/* ---------- Тест уровня /test: страницы при старте из app/test/level-test.json ----------
   Банк вопросов един для трёх языков (вопросы — по-кыргызски, это и есть предмет теста),
   интерфейс и вердикты — по языку варианта. Ответы видны в исходнике осознанно:
   это самооценка без приза, и в LD-разметке Quiz ответы тоже показаны честно.
   Разметка Quiz/FAQPage — ради Яндекса и он-пейдж ключей (rich-результатов Google
   у этих типов сейчас практически нет — ожиданий на них не строим). */
/* ===LEVEL-TEST=== */
// Дополнение к BLOG_CSS (не замена — иначе теряются .wrap/.seg/.callout): токены
// ok/err/line2 из палитры m0.html + упрощённые копии его правил квиза.
const TEST_CSS_EXTRA =   '.qhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}'+'.chip.timer{font-variant-numeric:tabular-nums}'+'.chip.timer.warn{border-color:#b91c1c;color:#b91c1c}'+
  ':root{--ok:#15803d;--ok-soft:#dcfce7;--err:#b91c1c;--err-soft:#fee2e2;--line2:#e8ecf1}' +
  'html[data-theme="dark"]{--ok:#4ade80;--ok-soft:#122b1c;--err:#f87171;--err-soft:#3b1a1a;--line2:#232d3a}' +
  '@media (prefers-color-scheme:dark){html[data-theme="auto"]{--ok:#4ade80;--ok-soft:#122b1c;--err:#f87171;--err-soft:#3b1a1a;--line2:#232d3a}}' +
  '.bigword{font-size:1.45rem;font-weight:700;margin:12px 0}' +
  '.bigword.long{font-size:1rem;font-weight:500;line-height:1.6;white-space:pre-line}' +
  '.opts{display:flex;flex-direction:column;gap:8px;margin:12px 0}' +
  '.opts button{text-align:left;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);cursor:pointer;font-size:.95rem;font-family:inherit}' +
  '.opts button:hover{border-color:var(--accent)}' +
  '.opts button.correct{background:var(--ok-soft);border-color:var(--ok);box-shadow:inset 0 0 0 1px var(--ok);font-weight:600}' +
  '.opts button.wrong{background:var(--err-soft);border-color:var(--err)}' +
  '.opts button:disabled{cursor:default;opacity:.9}' +
  '.feedback{padding:10px 14px;border-radius:10px;margin:10px 0;font-size:.95rem}' +
  '.feedback.ok{background:var(--ok-soft);color:var(--ok)}' +
  '.feedback.err{background:var(--err-soft);color:var(--err)}' +
  '.chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:.74rem;background:var(--line2);color:var(--muted);margin-right:6px}' +
  '.progressbar{height:10px;background:var(--line2);border-radius:99px;overflow:hidden;margin:6px 0 14px}' +
  '.progressbar>div{height:100%;background:var(--accent);border-radius:99px;transition:width .3s}' +
  '@media (prefers-reduced-motion:reduce){.progressbar>div{transition:none}}' +
  'button.cta,button.cta2{font:inherit;font-weight:600;cursor:pointer}' +
  'button.cta2{background:transparent}' +
  '.faq h3{font-size:1rem;margin:16px 0 4px}' +
  '.faq{margin-top:26px}';
// Для <script>-блоков модульный esc() не годится (превратил бы кавычки в &quot;) —
// экранируется только «<», чтобы контент не разорвал тег.
const jsonInScript = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
/* Поля вердикта, которые читает итоговый экран (QUIZ_IIFE). Список — рядом с кодом,
   что их читает, и по нему же проверяются данные КАЖДОЙ квиз-страницы: у пробного
   теста B1 в данных лежали свои {max,text}, и посетитель видел «4/20 · undefined»
   (поймано владельцем на проде 22.08.2026). */
const VERDICT_FIELDS = ["short", "h", "p"];
// Логика квиза, проверяемая vm-тестом в голом контексте: строго DOM-free
const QUIZ_LOGIC = '/* Варианты перемешиваются на каждом показе: порядок в данных фиксирован\n' +
  '   (он дословно сверяется с дриллами курса), но тест не должен решаться\n' +
  '   запоминанием позиций. */\n' +
  'function shufQ(q){\n' +
  '  var idx=q.options.map(function(_,k){return k;});\n' +
  '  for(var i=idx.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var x=idx[i];idx[i]=idx[j];idx[j]=x;}\n' +
  '  return {ky:q.ky,options:idx.map(function(k){return q.options[k];}),correct:idx.indexOf(q.correct)};\n' +
  '}\n' +
  'function verdictFor(s){var v=QUIZ.verdicts;for(var i=0;i<v.length;i++){if(s<=v[i].max)return v[i];}return v[v.length-1];}\n' +
  'function waTextFor(s){return QUIZ.waMsg.replace("{s}",s).replace("{t}",QUIZ.total).replace("{lvl}",verdictFor(s).short);}\n' +
  'function waHrefFor(s){return "https://wa.me/996505854856?text="+encodeURIComponent(waTextFor(s));}\n';
// Интерактив: стартовый экран → вопросы с мгновенной подсветкой → вердикт с CTA.
// DOM строится createElement/append (innerHTML запрещён политикой m0.html).
const QUIZ_IIFE = '(function(){\n' +
  'var box=document.getElementById("quiz");\n' +
  'if(!box)return;\n' +
  'var L=QUIZ.labels,total=QUIZ.total,idx=0,score=0;\n' +
  'function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.append(x);return e;}\n' +
  'function clear(){while(box.firstChild)box.removeChild(box.firstChild);}\n' +
  // Экзамен идёт на время, и тренировка обязана это воспроизводить: лимит берётся
  // из данных (QUIZ.limitSec). Нет лимита — таймера нет вовсе, тест уровня не задет.
  'var left=0,tick=null,tbox=null;\n' +
  'function mmss(s){var m=Math.floor(s/60);var r=s%60;return m+":"+(r<10?"0":"")+r;}\n' +
  'function stopTimer(){if(tick){clearInterval(tick);tick=null;}}\n' +
  'function startTimer(){\n' +
  '  if(!QUIZ.limitSec)return;\n' +
  '  left=QUIZ.limitSec;stopTimer();\n' +
  '  tick=setInterval(function(){\n' +
  '    left--;\n' +
  '    if(tbox)tbox.textContent=L.timeLeft.replace("{t}",mmss(Math.max(0,left)));\n' +
  '    if(tbox&&left<=60)tbox.classList.add("warn");\n' +
  '    if(left<=0){stopTimer();finish(true);}\n' +
  '  },1000);\n' +
  '}\n' +
  'function begin(){idx=0;score=0;startTimer();ask();}\n' +
  'function start(){\n' +
  '  clear();\n' +
  '  var b=el("button","cta",L.startBtn);\n' +
  '  b.addEventListener("click",begin);\n' +
  '  box.append(b);\n' +
  '}\n' +
  'function ask(){\n' +
  '  clear();\n' +
  '  var q=shufQ(QUIZ.questions[idx]);\n' +
  '  var head=el("div","qhead");\n' +
  '  head.append(el("span","chip",L.qLabel.replace("{n}",String(idx+1)).replace("{t}",String(total))));\n' +
  '  if(QUIZ.limitSec){tbox=el("span","chip timer",L.timeLeft.replace("{t}",mmss(Math.max(0,left))));\n' +
  '    if(left<=60)tbox.classList.add("warn");head.append(tbox);}\n' +
  '  box.append(head);\n' +
  '  var pb=el("div","progressbar"),fill=el("div");\n' +
  '  fill.style.width=Math.round(idx/total*100)+"%";pb.append(fill);box.append(pb);\n' +
  '  if(L.askKy)box.append(el("div","muted",L.askKy));\n' +
  '  box.append(el("div",q.ky.length>90?"bigword long":"bigword",q.ky));\n' +
  '  var opts=el("div","opts");\n' +
  '  q.options.forEach(function(o,i){\n' +
  '    var b=el("button",null,o);\n' +
  '    b.addEventListener("click",function(){\n' +
  '      var bs=opts.querySelectorAll("button");\n' +
  '      for(var j=0;j<bs.length;j++)bs[j].disabled=true;\n' +
  '      if(i===q.correct){score++;b.classList.add("correct");}\n' +
  '      else{b.classList.add("wrong");bs[q.correct].classList.add("correct");}\n' +
  '      setTimeout(function(){idx++;if(idx<total)ask();else finish();},700);\n' +
  '    });\n' +
  '    opts.append(b);\n' +
  '  });\n' +
  '  box.append(opts);\n' +
  '}\n' +
  'function finish(byTime){\n' +
  '  stopTimer();clear();\n' +
  '  var v=verdictFor(score),c=el("aside","callout");\n' +
  '  if(byTime&&L.timeUp)c.append(el("b",null,L.timeUp));\n' +
  '  c.append(el("b",null,L.resultTitle+": "+score+"/"+total+" \\u00b7 "+v.short));\n' +
  '  c.append(el("b",null,v.h));\n' +
  '  c.append(el("p",null,v.p));\n' +
  '  var demo=el("a","cta",L.ctaDemo);demo.href="/demo/"+QUIZ_LANG;\n' +
  '  var wa=el("a","cta2",L.ctaWa);wa.href=waHrefFor(score);wa.target="_blank";wa.rel="noopener";\n' +
  '  var again=el("button","cta2",L.restart);again.addEventListener("click",begin);\n' +
  '  var sp=function(){return document.createTextNode(" ");};\n' +
  '  c.append(demo,sp(),wa,sp());\n' +
  // вход — третий магнит: у сдавшего тест уже может быть доступ, и это его дорога внутрь
  '  if(L.ctaLogin){var lg=el("a","cta2",L.ctaLogin);lg.href="/login";c.append(lg,sp());}\n' +
  '  c.append(again);\n' +
  '  box.append(c);\n' +
  // window.ym существует только при данном согласии (его создаёт YM_SNIPPET) — guard безопасен
  '  try{window.ym&&ym(YM_ID,"reachGoal","test_done",{score:score})}catch(e){}\n' +
  '}\n' +
  'start();\n' +
  LANG_SEG_JS +
  '})();\n';
/* Страница-тест из данных. Все тесты живут на одном билдере: /test (уровень A1)
   и пробные тесты learn.kg /probny-test-a1|b1|b2. Различия — в конфиге: файл данных,
   база маршрута, диапазон числа заданий и градиент уровней (только у теста уровня).
   Под заданиями каждой страницы — пометка о несвязанности с официальным тестированием
   (site-ui.json: quizNote/quizOfficial). Новый тест = данные + строка вызова. */
function buildQuizPage(cfg) {
  const T = JSON.parse(fs.readFileSync(path.join(APP_DIR, ...cfg.file), "utf8"));
  // Fail-fast: битые данные теста должны ронять старт, а не тихо отдавать мусор
  const die = (m) => { throw new Error(cfg.name + ": " + m); };
  const LV = cfg.levels || [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(T.updated) || Number.isNaN(Date.parse(T.updated))) die("updated не дата: " + T.updated);
  if (!Array.isArray(T.questions) || T.questions.length < cfg.minQ || T.questions.length > cfg.maxQ)
    die("вопросов не " + cfg.minQ + "–" + cfg.maxQ);
  let prevRank = 0;
  for (const q of T.questions) {
    if (typeof q.ky !== "string" || !q.ky.trim()) die(q.id + ": пустой вопрос");
    if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4) die(q.id + ": не 4 уникальных варианта");
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) die(q.id + ": correct вне 0–3");
    if (LV.length) {
      const r = LV.indexOf(q.level);
      if (r < 0) die(q.id + ": level " + q.level);
      if (r < prevRank) die(q.id + ": уровень убывает — градиент сломан");
      prevRank = r;
    }
  }
  if (LV.length) {
    if (T.questions.filter((q) => q.level === LV[0]).length < 3) die("меньше трёх вопросов " + LV[0]);
    if (!T.questions.some((q) => q.level === LV[LV.length - 1])) die("нет потолочного " + LV[LV.length - 1]);
  }
  validateLocalizedUi(T.ui, die);
  for (const l of Object.keys(T.ui))
    for (const k of ["quizNote", "quizOfficial"]) if (!BLOG_UI[l] || !String(BLOG_UI[l][k] || "").trim()) die("site-ui.json " + l + ": нет " + k);
  for (const [l, u] of Object.entries(T.ui)) {
    if (!Array.isArray(u.verdicts) || u.verdicts.length !== 3) die("verdicts " + l + " не 3");
    let pm = -1;
    for (const v of u.verdicts) {
      if (!Number.isInteger(v.max) || v.max <= pm) die("verdicts " + l + ": max не растут"); pm = v.max;
      for (const f of VERDICT_FIELDS) if (!v[f] || !String(v[f]).trim()) die("verdicts " + l + ": нет поля " + f);
    }
    if (pm !== T.questions.length) die("verdicts " + l + ": последний max ≠ числу вопросов");
    if (!u.waMsg.includes("{s}") || !u.waMsg.includes("{t}")) die("waMsg " + l + " без {s}/{t}");
  }
  const vars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const ui = T.ui[lang], bui = BLOG_UI[lang];
    const ld = { "@context": "https://schema.org", "@graph": [ORG,
      webPageLd(cfg.base, lang, ui.title, ui.desc),
      // Без hasPart с вопросами-ответами — осознанно (аудит 19.08): Education Q&A
      // печатает ответы прямо в выдаче, а публиковать ключ теста уровня — самоподрыв.
      // Quiz остаётся тематическим узлом; ответы в индексируемую разметку не попадают.
      { "@type": "Quiz", "name": ui.h1, "about": { "@type": "Language", "name": "Кыргыз тили" },
        "educationalLevel": cfg.level, "inLanguage": "ky", "publisher": { "@id": ORG_ID } },
      faqLd(ui.faq)] };
    // В страницу едет только нужное клиенту: без level (подсказка градиента) и note (обоснования)
    const quiz = { total: T.questions.length, limitSec: T.limitSec || 0,
      questions: T.questions.map((q) => ({ ky: q.ky, options: q.options, correct: q.correct })),
      verdicts: ui.verdicts, waMsg: ui.waMsg,
      labels: { qLabel: ui.qLabel, startBtn: ui.startBtn, restart: ui.restart, resultTitle: ui.resultTitle,
        ctaDemo: ui.ctaDemo, ctaWa: ui.ctaWa, ctaLogin: ui.ctaLogin || "", timeLeft: ui.timeLeft || "",
        timeUp: ui.timeUp || "", askKy: ui.askKy || "" } };
    const script = "<script>\n\"use strict\";\n/* ===QUIZ-DATA=== */\nvar QUIZ_LANG=" + jsonInScript(lang) +
      ";\nvar YM_ID=" + Number(YM_ID) + // инжект серверной константы: владелец ID остаётся landing.html
      ";\nvar QUIZ=" + jsonInScript(quiz) + ";\n/* ===/QUIZ-DATA=== */\n/* ===QUIZ-LOGIC=== */\n" +
      QUIZ_LOGIC + "/* ===/QUIZ-LOGIC=== */\n" + QUIZ_IIFE + "</script>";
    const testCrumbs = [[bui.home, "/" + lang], [ui.h1, null]];
    ld["@graph"].push(crumbsLd(testCrumbs));
    // Пометка о несвязанности (решение владельца 30.10.2026) — видима рядом с заданиями
    // на КАЖДОЙ странице-тесте: задания наши, к официальному тестированию отношения
    // не имеют; формат, уровни и запись — только отсылкой на официальный сайт
    const noteBlock = '<p class="muted quiz-note">' + esc(bui.quizNote) + "</p>\n" +
      '<p class="muted">' + esc(bui.quizOfficial) +
      ' <a href="https://kyrgyztest.gov.kg" target="_blank" rel="noopener noreferrer">kyrgyztest.gov.kg</a>.</p>\n';
    const body = '<body>\n' + siteHeader(cfg.base, lang, bui) + '<div class="wrap">\n' + topBar(cfg.base, lang, bui, testCrumbs) +
      "<h1>" + esc(ui.h1) + '</h1>\n<p class="lead">' + esc(ui.lead) + "</p>\n" +
      '<div id="quiz"></div>\n' +
      '<noscript><p>' + esc(ui.lead) + ' <a href="/demo/' + lang + '">' + esc(ui.ctaDemo) + "</a></p></noscript>\n" +
      noteBlock + faqSection(ui.faqTitle, ui.faq) +
      script + "\n</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
    vars[lang] = pack("<!DOCTYPE html>\n" +
      blogHead(lang, cfg.base, ui.title, ui.desc, ld, { ogType: "website", css: BLOG_CSS + TEST_CSS_EXTRA }) + body);
  }
  // Прямая проверка артефакта, как у демо-сборки: каждый скрипт отдачи — валидный JS
  vmScanScripts(vars.ru.buf);
  return { vars, updated: T.updated };
}
const LEVEL_TEST = buildQuizPage({ name: "тест уровня", file: ["test", "level-test.json"],
  base: "/test", level: "A1", minQ: 14, maxQ: 16, levels: ["a0", "a1", "a1plus"] });
// Пробный тест learn.kg B1: задания собраны из дриллов курса B1 (вычитаны носителем),
// градиента уровней нет — все задания одного уровня.
const PROBNY_B1 = buildQuizPage({ name: "пробный тест B1", file: ["probny-b1", "probny-b1.json"],
  base: "/probny-test-b1", level: "B1", minQ: 18, maxQ: 24 });
// Пробный тест learn.kg A1: клоуз-задания на фразах курса A1 (m1–m10), тот же билдер.
const PROBNY_A1 = buildQuizPage({ name: "пробный тест A1", file: ["probny-a1", "probny-a1.json"],
  base: "/probny-test-a1", level: "A1", minQ: 18, maxQ: 24 });
// Пробный тест learn.kg B2: задания из дриллов курса B2 (m36–m45), тот же билдер.
const PROBNY_B2 = buildQuizPage({ name: "пробный тест B2", file: ["probny-b2", "probny-b2.json"],
  base: "/probny-test-b2", level: "B2", minQ: 18, maxQ: 24 });
/* ===/LEVEL-TEST=== */

/* ===RAZGOVORNIK=== */
// Разговорник — страница из данных курса: app/razgovornik/razgovornik.json выбирает
// категории (pick: mod+cat) из CONTENT, правка фразы в курсе сама обновляет страницу.
// Языковой вариант двуязычен со СВОИМ языком (ru — русско-кыргызский, en — English–Kyrgyz,
// tr — Türkçe–Kırgızca): глоссы и титулы секций берутся из vocab.<lang>. Тексты фраз
// публичны (решение владельца, 2026-08); озвучка — только снимком RAZGO.audio на старте
// (см. гейт /api/audio), живые файлы остаются за курсом.
// Клик по [data-a] — публичная озвучка (снимок): один плеер, кнопка подсвечивается
// на время звучания. Общий для разговорника и переводчика.
const PUB_AUDIO_JS =
  "var cur=null,curBtn=null;\n" +
  'document.addEventListener("click",function(e){\n' +
  '  var b=e.target&&e.target.closest?e.target.closest("[data-a]"):null;\n' +
  "  if(!b)return;\n" +
  "  try{if(cur)cur.pause();}catch(_){}\n" +
  '  if(curBtn)curBtn.setAttribute("aria-pressed","false");\n' +
  '  cur=new Audio("api/audio/"+b.getAttribute("data-a")+".mp3");curBtn=b;\n' +
  '  b.setAttribute("aria-pressed","true");\n' +
  '  cur.addEventListener("ended",function(){b.setAttribute("aria-pressed","false");});\n' +
  "  var p=cur.play();if(p&&p.catch)p.catch(function(){});\n" +
  "});\n";
const RZ_CSS_EXTRA = '.toc{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}' +
  '.toc a{padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);text-decoration:none;font-size:.9rem}' +
  '.ph{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}' +
  '.ph:last-child{border-bottom:none}' +
  '.ph .ky{font-weight:700;min-width:44%}' +
  // строка с транслитом (en/tr) — три колонки: ужимаем ky и lat, глоссе — остаток,
  // иначе перевод сжимается в узкий столбик и колонки гуляют между языками
  '.ph:has(.lat) .ky{min-width:30%}' +
  '.ph .gl{color:var(--muted);flex:1}' +
  '.ph .lat{color:var(--muted);font-style:italic;font-size:.88em;min-width:22%;max-width:26%}' +
  '.pl{flex:none;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink);cursor:pointer;font-family:inherit;font-size:.85rem;padding:4px 12px}' +
  '.pl[aria-pressed="true"]{border-color:var(--acc)}' +
  'section.rz{margin:26px 0}' +
  // мобильная раскладка: строка складывается — фраза+кнопка, под ними транслит, ниже перевод
  '@media (max-width:640px){' +
    '.ph{flex-wrap:wrap;row-gap:2px}' +
    '.ph .ky{min-width:0;flex:1 1 auto;order:1}' +
    '.ph:has(.lat) .ky{min-width:0}' +
    '.ph .pl{order:2;margin-left:auto}' +
    '.ph .lat{min-width:100%;max-width:100%;order:3}' +
    '.ph .gl{flex:1 1 100%;order:4}' +
  '}';
function buildRazgovornik() {
  const R = JSON.parse(fs.readFileSync(path.join(APP_DIR, "razgovornik", "razgovornik.json"), "utf8"));
  const die = (m) => { throw new Error("разговорник: " + m); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(R.updated || "")) die("updated не дата");
  validateLocalizedUi(R.ui, die);
  for (const [l, u] of Object.entries(R.ui)) if (!u.lead.includes("{n}")) die("lead " + l + " без счётчика {n}");
  const C = DEMO.content;
  const seen = new Set();
  const sections = (R.sections || []).map((s) => {
    if (!s.id || !/^[a-z0-9_]+$/.test(s.id)) die("секция без валидного id");
    for (const l of ["ru", "en", "tr"]) if (!s.title || !s.title[l]) die("секция " + s.id + ": нет титула " + l);
    const items = [];
    for (const p of s.pick || []) {
      const mod = C[p.mod];
      if (!mod) die("секция " + s.id + ": модуля " + p.mod + " нет в CONTENT");
      if (!mod.cats || !mod.cats[p.cat]) die("секция " + s.id + ": категории " + p.mod + "/" + p.cat + " нет");
      // ref-alias пропускаются: у них нет своего текста, донор либо уже в своей категории,
      // либо намеренно не выбран — молча тащить его значило бы дублировать фразы
      for (const v of mod.vocab) if (v.cat === p.cat && !v.ref) items.push({ mod: p.mod, id: v.id, ky: v.ky, ru: v.ru, en: v.en, tr: v.tr });
    }
    if (!items.length) die("секция " + s.id + " пуста");
    for (const x of items) {
      if (seen.has(x.id)) die("фраза " + x.id + " попала в две секции");
      seen.add(x.id);
      for (const f of ["ky", "ru", "en", "tr"]) if (!x[f]) die("фраза " + x.id + " без поля " + f);
    }
    return { id: s.id, title: s.title, items };
  });
  if (!sections.length) die("нет секций");
  const total = seen.size;
  // потолок: разговорник — витрина, а не весь курс; ослабление здесь = отдать курс страницей
  if (total > 350) die("фраз " + total + " — больше потолка 350");
  if (total < 150) die("фраз " + total + " — подозрительно мало, проверь pick");
  // Снимок озвучки: только фразы разговорника и только реально существующие файлы.
  // БЕЗ fail-fast: пустой /data (тесты, локальная разработка) не должен ронять старт;
  // полноту на проде стережёт deploy/audit-audio.js. Кнопка рендерится по снимку —
  // молчащих кнопок не бывает by design.
  const audio = new Map(); const missing = [];
  for (const s of sections) for (const x of s.items) {
    // фразы модуля демо уже лежат буферами в DEMO.audio — шарим объект, не копию
    const d = x.mod === DEMO.mod && DEMO.audio.get(x.id);
    if (d) { audio.set(x.mod + "/" + x.id, d); continue; }
    try { const b = fs.readFileSync(path.join(DATA_DIR, "audio", x.mod, x.id + ".mp3")); audio.set(x.mod + "/" + x.id, { buf: b, etag: etagOf(b) }); }
    catch { missing.push(x.mod + "/" + x.id); }
  }
  if (missing.length) logger.warn("razgovornik", "фразы без озвучки в публичном снимке", { count: missing.length, sample: missing.slice(0, 20).join(",") });
  const vars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const ui = R.ui[lang], bui = BLOG_UI[lang];
    const lead = ui.lead.replace("{n}", String(total));
    const ld = { "@context": "https://schema.org", "@graph": [ORG, webPageLd("/razgovornik", lang, ui.h1, ui.desc), faqLd(ui.faq)] };
    const toc = '<nav class="toc">' + sections.map((s) => '<a href="/razgovornik/' + lang + "#" + s.id + '">' + esc(s.title[lang]) + "</a>").join("") + "</nav>";
    const secHtml = sections.map((s) =>
      '<section class="rz" id="' + s.id + '"><h2>' + esc(s.title[lang]) + "</h2>\n" +
      s.items.map((x) => {
        const key = x.mod + "/" + x.id;
        const btn = audio.has(key) ? '<button class="pl" data-a="' + key + '" aria-label="' + esc(ui.play) + '">▶ ' + esc(ui.play) + "</button>" : "";
        // en/tr-читатель кириллицу не прочтёт — транслит своей конвенции рядом с фразой
        const lat = lang === "ru" ? "" : '<span class="lat">' + esc(kyToLat(x.ky, lang)) + "</span>";
        return '<div class="ph"><span class="ky">' + esc(x.ky) + "</span>" + lat + '<span class="gl">' + esc(x[lang]) + "</span>" + btn + "</div>";
      }).join("\n") + "\n</section>").join("\n");
    const script = "<script>\n\"use strict\";\n(function(){\n" + PUB_AUDIO_JS + LANG_SEG_JS + "})();\n</script>";
    const rzCrumbs = [[bui.home, "/" + lang], [ui.h1, null]];
    ld["@graph"].push(crumbsLd(rzCrumbs));
    const body = '<body>\n' + siteHeader("/razgovornik", lang, bui) + '<div class="wrap">\n' + topBar("/razgovornik", lang, bui, rzCrumbs) +
      "<h1>" + esc(ui.h1) + '</h1>\n<p class="lead">' + esc(lead) + "</p>\n" + toc + "\n" + secHtml + "\n" +
      faqSection(ui.faqTitle, ui.faq) +
      ctaCallout(lang, bui, { title: ui.ctaTitle, text: ui.ctaText, demo: ui.ctaDemo,
        extra: [["/test/" + lang, ui.ctaTest]] }) +

      script + "\n</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
    vars[lang] = pack("<!DOCTYPE html>\n" +
      blogHead(lang, "/razgovornik", ui.title, ui.desc, ld, { ogType: "website", css: BLOG_CSS + RZ_CSS_EXTRA }) + body);
  }
  vmScanScripts(vars.ru.buf);
  // ids — состав публичного набора (ключи mod/id) независимо от наличия mp3: по нему
  // страницы-ответы проверяют право на озвучку, не завися от содержимого /data
  const ids = new Set(sections.flatMap((s) => s.items.map((x) => x.mod + "/" + x.id)));
  return { vars, updated: R.updated, audio, ids, sections: sections.map((s) => ({ id: s.id, title: s.title })) };
}
const RAZGO = buildRazgovornik();
// Снимок озвучки «частых фраз» переводчика (фразы М0 с пометкой demo — его витрина): свой,
// не зависит от того, какой модуль открыт в демо. Без файлов на диске — просто без кнопок.
const PV_COMMON_AUDIO = (() => {
  const m = new Map();
  for (const v of ((DEMO.content.m0 || {}).vocab || []).filter((x) => x.demo && !x.ref)) {
    try { const b = fs.readFileSync(path.join(DATA_DIR, "audio", "m0", v.id + ".mp3")); m.set("m0/" + v.id, { buf: b, etag: etagOf(b) }); } catch {}
  }
  return m;
})();
// Публичная озвучка (аноним слышит без входа) — одно правило для гейта /api/audio и кнопок ▶
// на страницах: снимок демо (карточки модуля демо; ph_* — диалоги и уроки, бакет m0),
// снимок разговорника и частые фразы переводчика. Буфер с ETag или null.
const publicAudio = (mod, id) => ((mod === DEMO.mod || (mod === "m0" && id.startsWith("ph_"))) && DEMO.audio.get(id)) ||
  RAZGO.audio.get(mod + "/" + id) || PV_COMMON_AUDIO.get(mod + "/" + id) || null;
/* ===/RAZGOVORNIK=== */

/* ===PEREVODCHIK=== */
// Переводчик частых фраз — честная альтернатива машинному переводу: мгновенный
// клиентский поиск по ВСЕМ не-ref фразам курса (решение владельца: тексты публичны,
// озвучка и тренажёр — за курсом). В вариант языка вшиваются пары СВОЕГО языка
// (ru — ky↔ru, en — ky↔en, tr — ky↔tr, ~70 КБ raw / ~33 КБ gzip). Против thin
// content видимая часть — частые фразы демо-набора с озвучкой и темы разговорника.
const PV_CSS_EXTRA =
  '.pv-q{width:100%;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font-size:1.05rem;font-family:inherit;margin:14px 0}' +
  '.pv-q:focus{outline:none;border-color:var(--accent)}' +
  '.pv-miss .ph{padding:7px 0}.pv-near{font-weight:600;margin:14px 0 0}';
// Поиск — DOM-free в маркерах (канон: логика исполняется vm-тестом на модельных данных).
// Нормализация нарочно простая и симметричная: строчные, ё→е, схлоп пробелов.
// Сначала фразы, НАЧИНАЮЩИЕСЯ с запроса (по любой из колонок), затем вхождения.
const PV_LOGIC =
  "/* ===PEREVODCHIK-LOGIC=== */\n" +
  // NFC — iOS-клавиатуры шлют й/ё разложенными (урок normalizeAnswer, 10-core.js)
  // знаки препинания — пробел: «мен билбейм.» и «Привет, как дела» ищутся и считаются как слова
  'function pvNorm(s){return String(s).normalize("NFC").toLowerCase().replace(/ё/g,"е").replace(/[^\\p{L}\\p{N}]+/gu," ").trim();}\n' +
  // близнецы: iOS-автозамена подсовывает латинские a/c/e/k/m/o/p/t/x/y в кириллицу —
  // чиним ТОЛЬКО когда в строке есть кириллица (чисто латинский запрос — это
  // транслит-поиск, его портить нельзя)
  'var PV_TWINS={"a":"а","c":"с","e":"е","k":"к","m":"м","o":"о","p":"р","t":"т","x":"х","y":"у"};\n' +
  "function pvTwins(s){if(!/[а-яёөүң]/.test(s))return s;var o=\"\";for(var i=0;i<s.length;i++)o+=PV_TWINS[s[i]]||s[i];return o;}\n" +
  // фолдинг особых букв: без кыргызской раскладки ө/ү/ң набирают как о/у/н.
  // В тренажёр (проверку ответов) НЕ переносить: уй «корова» ≠ үй «дом» — там это ошибка
  'function pvFold(s){return pvTwins(pvNorm(s)).replace(/ө/g,"о").replace(/ү/g,"у").replace(/ң/g,"н");}\n' +
  // свёрнутая фраза: три колонки и их склейка (по ней ищут «все слова» и фуззи)
  'function pvFoldRow(ph){var a=pvFold(ph[0]),b=pvFold(ph[1]),c=ph[2]?pvFold(ph[2]):"";return [a,b,c,a+" "+b+(c?" "+c:"")];}\n' +
  // расстояние Левенштейна ≤ 1: общий префикс, затем сравнение хвостов
  // (замена — пропустить по букве с обеих сторон, вставка — букву длинной)
  "function pvOneEdit(a,b){\n" +
  "  if(a===b)return true;\n" +
  "  if(a.length>b.length){var t=a;a=b;b=t;}\n" +
  "  if(b.length-a.length>1)return false;\n" +
  "  var i=0;while(i<a.length&&a[i]===b[i])i++;\n" +
  "  return a.length===b.length?a.slice(i+1)===b.slice(i+1):a.slice(i)===b.slice(i+1);\n" +
  "}\n" +
  // сначала фразы, НАЧИНАЮЩИЕСЯ с запроса, затем вхождения, затем фразы со ВСЕМИ словами
  // запроса в любом порядке («мен билбейм» → «…Мен бул сөздү билбейм»), затем фуззи-ДОБАВКА
  // (одна правка по словам; порог 4 буквы — короче окрестность в одну правку
  // слишком плотная: «дом»→«дон/том/до…», фуззи превращается в шум).
  // Колонки: ky, глосса и (en/tr) транслит — латинский запрос ищет по транслиту.
  // folded — предвычисленные pvFoldRow (клиент строит один раз, ~5× быстрее)
  "function searchPhrases(q,phrases,lim,folded){\n" +
  "  q=pvFold(q);if(!q)return [];\n" +
  "  lim=lim||30;\n" +
  "  var pre=[],inc=[],all=[],fuz=[],qw=q.split(\" \");\n" +
  "  for(var i=0;i<phrases.length;i++){\n" +
  "    var p=folded?folded[i]:pvFoldRow(phrases[i]);\n" +
  "    var hit=0;\n" +
  "    for(var c=0;c<3;c++){var col=p[c];if(!col)continue;var x=col.indexOf(q);if(x===0){hit=2;break;}if(x>-1)hit=1;}\n" +
  "    if(hit===2){pre.push(i);continue;}\n" +
  "    if(hit===1){inc.push(i);continue;}\n" +
  "    if(qw.length>1&&qw.every(function(w){return p[3].indexOf(w)>-1;})){all.push(i);continue;}\n" +
  "    if(q.length>=4){\n" +
  '      var words=p[3].split(" ");\n' +
  "      for(var w=0;w<words.length;w++){if(pvOneEdit(q,words[w])){fuz.push(i);break;}}\n" +
  "    }\n" +
  "  }\n" +
  "  return pre.concat(inc,all,fuz).slice(0,lim);\n" +
  "}\n" +
  // запрос целиком не нашёлся — ищем по его словам: длинные первыми (в них смысл,
  // «как/мне» шумят), выдача по кругу, чтобы одно слово не заняло весь список
  // cache — выдача по слову на время страницы: при наборе фразы меняется лишь последнее слово
  "function pvNearby(q,phrases,lim,folded,cache){\n" +
  '  var words=pvFold(q).split(" ").filter(function(w){return w.length>=3;}).sort(function(a,b){return b.length-a.length;});\n' +
  "  cache=cache||{};\n" +
  "  var lists=words.map(function(w){var k=lim+\"|\"+w;return cache[k]||(cache[k]=searchPhrases(w,phrases,lim,folded));}),out=[],seen={};\n" +
  "  for(var r=0;r<lim;r++)for(var j=0;j<lists.length&&out.length<lim;j++){var i=lists[j][r];if(i!=null&&!seen[i]){seen[i]=1;out.push(i);}}\n" +
  "  return out;\n" +
  "}\n" +
  // машинный переводчик с готовым текстом: направление — по буквам запроса
  // (на ru кыргызский выдают ө/ү/ң, на en/tr — любая кириллица)
  "function pvMtUrl(tpl,q,lang){\n" +
  '  var ky=lang==="ru"?/[өүң]/i.test(q):/[а-яёөүң]/i.test(q);\n' +
  '  return tpl.replace("{from}",ky?"ky":lang).replace("{to}",ky?lang:"ky").replace("{q}",encodeURIComponent(String(q).trim()));\n' +
  "}\n" +
  "/* ===/PEREVODCHIK-LOGIC=== */\n";
// Та же логика на сервере — исполнением отданного текста, не копией: нормализация ключа
// промаха (/api/pv-miss) и заполнение шаблона внешнего переводчика совпадают со страницей
const PV_FN = vm.runInNewContext(PV_LOGIC + ";({pvNorm:pvNorm,pvMtUrl:pvMtUrl});");
function buildPerevodchik() {
  const P = JSON.parse(fs.readFileSync(path.join(APP_DIR, "perevodchik", "perevodchik.json"), "utf8"));
  const die = (m) => { throw new Error("переводчик: " + m); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(P.updated || "")) die("updated не дата");
  const C = DEMO.content;
  // фразы всех модулей: свой язык глоссы — при сборке варианта
  // кнопка озвучки — только у фраз публичного снимка (демо, разговорник, частые фразы): индекс → mod/id
  const all = [], audio = {};
  for (const mod of Object.keys(C)) for (const v of C[mod].vocab || []) {
    if (v.ref) continue;
    for (const f of ["ky", "ru", "en", "tr"]) if (!v[f]) die("фраза " + v.id + " без поля " + f);
    const key = mod + "/" + v.id;
    if (publicAudio(mod, v.id)) audio[all.length] = key;
    all.push(v);
  }
  if (all.length < 1000) die("фраз " + all.length + " — подозрительно мало, CONTENT неполон?");
  const total = all.length;
  // {n} подставляется ДО валидации: лимиты 60/80–160 должны мериться по живому тексту
  const ui = JSON.parse(JSON.stringify(P.ui).replace(/\{n\}/g, String(total)));
  validateLocalizedUi(ui, die);
  for (const [l, u] of Object.entries(ui))
    if (!/^https:\/\/[^"<>\s]+$/.test(u.mtUrl) || !["{from}", "{to}", "{q}"].every((k) => u.mtUrl.includes(k))) die("mtUrl " + l + " не https-шаблон с {from}/{to}/{q}");
  // видимая часть: частые фразы = фразы М0 с пометкой demo (их озвучка — снимок PV_COMMON_AUDIO)
  const common = C.m0.vocab.filter((v) => v.demo && !v.ref);
  if (common.length < 20) die("частых фраз " + common.length + " — демо-набор m0 усох?");
  const vars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const u = ui[lang], bui = BLOG_UI[lang];
    // en/tr: третья колонка — транслит ky (кириллицу этот читатель не прочтёт);
    // по ней же ищет searchPhrases — латинский запрос «salam» находит «Салам!»
    const pairs = lang === "ru" ? all.map((v) => [v.ky, v.ru]) : all.map((v) => [v.ky, v[lang], kyToLat(v.ky, lang)]);
    const ld = { "@context": "https://schema.org", "@graph": [ORG, webPageLd("/perevodchik", lang, u.h1, u.desc), faqLd(u.faq)] };
    // клиенту — только тексты блока промаха (miss*) и шаблон внешнего переводчика
    const pvUi = Object.fromEntries(Object.entries(u).filter(([k]) => k.startsWith("miss") || k === "mtUrl"));
    const script = "<script>\n\"use strict\";\n/* ===PEREVODCHIK-DATA=== */\nvar PV_UI=" + jsonInScript(pvUi) +
      ";\nvar PV_LANG=" + jsonInScript(lang) + ",YM_ID=" + Number(YM_ID) + ";\nvar PV_AUDIO=" + jsonInScript(audio) +
      ";\nvar PHRASES=" + jsonInScript(pairs) + ";\n/* ===/PEREVODCHIK-DATA=== */\n" + PV_LOGIC +
      "(function(){\n" +
      'var q=document.getElementById("pv-q"),res=document.getElementById("pv-res");\n' +
      // свёрнутые фразы один раз при загрузке: поиск на каждый ввод ~5× дешевле
      "var FOLDED=PHRASES.map(pvFoldRow);\n" +
      "function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e;}\n" +
      "function row(i){var p=PHRASES[i],d=el(\"div\",\"ph\");\n" +
      '  d.append(el("span","ky",p[0]));\n' +
      '  if(p[2])d.append(el("span","lat",p[2]));\n' +
      '  d.append(el("span","gl",p[1]));\n' +
      '  if(PV_AUDIO[i]){var b=el("button","pl","▶");b.setAttribute("data-a",PV_AUDIO[i]);b.setAttribute("aria-label","▶");d.append(b);}\n' +
      "  return d;}\n" +
      'function goal(g){try{if(window.ym)ym(YM_ID,"reachGoal",g);}catch(_){}try{if(typeof gtag==="function")gtag("event",g);}catch(_){}}\n' +
      // промах уходит раз на запрос и только после паузы ввода — иначе каждый префикс
      // набираемой фразы («спа», «спас»…) лёг бы в статистику отдельным запросом
      "var sent={},near={},missT=0;\n" +
      "function logMiss(v){missT=setTimeout(function(){var k=pvNorm(v);if(sent[k])return;sent[k]=1;goal(\"pv_miss\");\n" +
      '  try{fetch("/api/pv-miss",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:v,lang:PV_LANG}),keepalive:true}).catch(function(){});}catch(_){}},1500);}\n' +
      "function missBox(v){var box=el(\"div\",\"callout pv-miss\");\n" +
      '  box.append(el("b","",PV_UI.missTitle),el("p","",PV_UI.missText));\n' +
      "  var ids=pvNearby(v,PHRASES,6,FOLDED,near);\n" +
      '  if(ids.length){box.append(el("p","pv-near",PV_UI.missNear));for(var i=0;i<ids.length;i++)box.append(row(ids[i]));}\n' +
      '  var mt=el("a","cta2",PV_UI.missMt);mt.href=pvMtUrl(PV_UI.mtUrl,v,PV_LANG);mt.target="_blank";mt.rel="noopener noreferrer";\n' +
      '  mt.addEventListener("click",function(){goal("pv_mt");});\n' +
      '  var demo=el("a","cta",PV_UI.missDemo);demo.href="/demo/"+PV_LANG;\n' +
      '  var acts=el("p");acts.append(demo," ",mt);box.append(acts);return box;}\n' +
      "function render(){\n" +
      "  clearTimeout(missT);\n" +
      "  while(res.firstChild)res.removeChild(res.firstChild);\n" +
      "  var v=q.value;if(!pvNorm(v))return;\n" +
      "  var ids=searchPhrases(v,PHRASES,30,FOLDED);\n" +
      "  if(!ids.length){res.append(missBox(v));logMiss(v);return;}\n" +
      "  for(var i=0;i<ids.length;i++)res.append(row(ids[i]));\n" +
      "}\n" +
      'q.addEventListener("input",render);\n' +
      PUB_AUDIO_JS + LANG_SEG_JS +
      "})();\n</script>";
    const commonHtml = '<section class="rz" id="common"><h2>' + esc(u.commonTitle) + "</h2>\n" +
      common.map((v) => {
        const btn = publicAudio("m0", v.id) ? '<button class="pl" data-a="m0/' + v.id + '" aria-label="▶">▶</button>' : "";
        const lat = lang === "ru" ? "" : '<span class="lat">' + esc(kyToLat(v.ky, lang)) + "</span>";
        return '<div class="ph"><span class="ky">' + esc(v.ky) + "</span>" + lat + '<span class="gl">' + esc(v[lang]) + "</span>" + btn + "</div>";
      }).join("\n") + "\n</section>";
    const topics = '<section class="rz" id="topics"><h2>' + esc(u.phrasebookTitle) + '</h2><nav class="toc">' +
      RAZGO.sections.map((s) => '<a href="/razgovornik/' + lang + "#" + s.id + '">' + esc(s.title[lang]) + "</a>").join("") +
      "</nav></section>";
    const pvCrumbs = [[bui.home, "/" + lang], [u.h1, null]];
    ld["@graph"].push(crumbsLd(pvCrumbs));
    const body = '<body>\n' + siteHeader("/perevodchik", lang, bui) + '<div class="wrap">\n' + topBar("/perevodchik", lang, bui, pvCrumbs) +
      "<h1>" + esc(u.h1) + '</h1>\n<p class="lead">' + esc(u.lead) + "</p>\n" +
      '<input id="pv-q" class="pv-q" type="search" placeholder="' + esc(u.placeholder) + '" autocomplete="off">\n' +
      '<div id="pv-res"></div>\n' +
      '<p class="lead" style="font-size:.95rem">' + esc(u.note) + ' <a href="' + esc(PV_FN.pvMtUrl(u.mtUrl, "", lang)) + '" target="_blank" rel="noopener noreferrer">' + esc(u.mtBtn) + "</a></p>\n" +
      commonHtml + "\n" + topics + "\n" +
      faqSection(u.faqTitle, u.faq) +
      ctaCallout(lang, bui, { title: u.ctaTitle, text: u.ctaText, demo: u.ctaDemo,
        extra: [["/test/" + lang, u.ctaTest], ["/razgovornik/" + lang, bui.phrasebook]] }) +
      script + "\n</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
    vars[lang] = pack("<!DOCTYPE html>\n" +
      blogHead(lang, "/perevodchik", u.title, u.desc, ld, { ogType: "website", css: BLOG_CSS + RZ_CSS_EXTRA + PV_CSS_EXTRA }) + body);
  }
  vmScanScripts(vars.ru.buf);
  return { vars, updated: P.updated };
}
const PEREVODCHIK = buildPerevodchik();

/* ===KURS=== Страницы описания курсов /kurs-a1|a2|b1 — из данных: тексты в
   app/kurs/kurs.json, программа модулей — из MODULE_META собранной страницы
   (титулы ru/en/tr там же), счёт фраз — из CONTENT. Правка модуля в курсе сама
   обновляет программу; выдуманных цифр на странице нет by design.
   Магниты на каждой странице: демо → WhatsApp Алтынай → вход в тренажёр. */
// маркированный список-перечень (итоги курса, «другие слова») — одно правило на сайт
const LIST_CSS = '.kafter{margin:10px 0 18px;padding-left:22px}.kafter li{margin:6px 0}';
const KURS_CSS_EXTRA =
  '.kcta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}' +
  '.kcta a{display:inline-block;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;border:1px solid var(--accent);color:var(--accent)}' +
  '.kcta a.kmain{background:var(--accent);color:#fff}' +
  '.ktotals{color:var(--muted);margin:6px 0 14px}' +
  '.kchip{display:inline-block;padding:2px 9px;border-radius:999px;background:var(--line);color:var(--muted);font-size:.82rem;white-space:nowrap}' +
  LIST_CSS;
function buildKurs() {
  const K = KURS_TEXT; // прочитан и проверен loadKursText — тем же экземпляром живёт витрина
  const die = (m) => { throw new Error("страницы курсов: " + m); };
  // программа модулей: MODULE_META с титулами трёх языков живёт в собранной странице
  const appHtml = appshell.buildAppHtml();
  const metaSrc = appHtml.match(/const MODULE_META=\[[\s\S]*?\];/);
  const enSrc = appHtml.match(/const MODULE_TITLES_EN=\{[\s\S]*?\};/);
  const trSrc = appHtml.match(/const MODULE_TITLES_TR=\{[\s\S]*?\};/);
  if (!metaSrc || !enSrc || !trSrc) die("MODULE_META/титулы не найдены в сборке");
  const msb = {};
  vm.createContext(msb);
  vm.runInContext(metaSrc[0] + enSrc[0] + trSrc[0] +
    ";MODULE_META.forEach(mm=>{mm.titleEn=MODULE_TITLES_EN[mm.id]||mm.title;mm.titleTr=MODULE_TITLES_TR[mm.id]||mm.titleEn;});this.META=MODULE_META;", msb);
  const C = DEMO.content;
  const ownCount = (mid) => ((C[mid] || {}).vocab || []).filter((v) => !v.ref).length;
  if (Object.keys(K.courses).sort().join(",") !== COURSE_IDS.slice().sort().join(",")) die("courses ≠ реестру COURSES");
  const pages = {};
  for (const cid of COURSE_IDS) {
    validateLocalizedUi(K.courses[cid].ui, die);
    const mods = msb.META.filter((m) => m.course === cid);
    if (mods.length !== COURSES[cid].modules.length) die(cid + ": программа разошлась с COURSES");
    const total = mods.reduce((s, m) => s + ownCount(m.id), 0);
    const vars = {};
    for (const lang of ["ru", "en", "tr"]) {
      const ui = K.courses[cid].ui[lang], L = K.labels[lang], bui = BLOG_UI[lang];
      if (!ui.wa || !Array.isArray(ui.after) || ui.after.length < 4) die(cid + "/" + lang + ": wa/after неполны");
      const base = "/kurs-" + cid;
      const ld = { "@context": "https://schema.org", "@graph": [ORG,
        webPageLd(base, lang, ui.h1, ui.desc),
        // @id общий с Course-узлом витрины — тот же построитель, Google склеивает обе сущности
        courseLd(K, cid, lang, ORG_ID),
        faqLd(ui.faq)] };
      const crumbs = [[bui.home, "/" + lang], [ui.h1, null]];
      ld["@graph"].push(crumbsLd(crumbs));
      const modTitle = (m) => lang === "en" ? m.titleEn : lang === "tr" ? m.titleTr : m.title;
      const rows = mods.map((m) => {
        const n = ownCount(m.id);
        const extra = m.exam ? ' <span class="kchip">' + esc(L.chipExam) + "</span>"
          : n === 0 ? ' <span class="kchip">' + esc(L.chipRev) + "</span>" : "";
        return "<tr><td>" + esc(m.num) + "</td><td>" + esc(modTitle(m)) + extra + "</td><td>" + (n || "—") + "</td></tr>";
      }).join("\n");
      const cta =
        '<div class="kcta">' +
        '<a class="kmain" href="/demo/' + lang + '">' + esc(L.ctaDemo) + "</a>" +
        '<a href="' + SITE_WA + '?text=' + encodeURIComponent(ui.wa) + '" target="_blank" rel="noopener noreferrer">' + esc(L.ctaWa) + "</a>" +
        '<a href="/login">' + esc(L.ctaLogin) + "</a></div>";
      const body = "<body>\n" + siteHeader(base, lang, bui) + '<div class="wrap">\n' + topBar(base, lang, bui, crumbs) +
        "<h1>" + esc(ui.h1) + '</h1>\n<p class="lead">' + esc(ui.lead) + "</p>\n" + cta +
        '<p class="ktotals">' + esc(L.totalsTpl.replace("{m}", String(mods.length)).replace("{p}", String(total))) + "</p>\n" +
        "<h2>" + esc(L.programTitle) + '</h2>\n<div class="tw"><table><thead><tr><th>' + esc(L.colModule) + "</th><th>" +
        esc(L.colTopic) + "</th><th>" + esc(L.colPhrases) + "</th></tr></thead><tbody>\n" + rows + "\n</tbody></table></div>\n" +
        "<h2>" + esc(L.afterTitle) + '</h2>\n<ul class="kafter">' + ui.after.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul>\n" +
        faqSection(L.faqTitle, ui.faq) + cta +
        '<p class="fine">' + esc(L.ctaNote) + "</p>\n</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
      vars[lang] = pack("<!DOCTYPE html>\n" +
        blogHead(lang, base, ui.title + " · learn.kg", ui.desc, ld, { ogType: "website", css: BLOG_CSS + KURS_CSS_EXTRA }) + body);
    }
    pages["/kurs-" + cid] = { vars: new Map(Object.entries(vars)), date: K.updated };
  }
  return pages;
}
const KURS_PAGES = buildKurs();
/* ===/KURS=== */

/* ===HELP=== Раздел «Помощь» /help — человеческая карта сайта: с чего начать,
   курсы, открытые разделы, приложение, FAQ и контакты. Тексты — app/help/help.json;
   ссылки секций с {lang} разворачиваются в языковой вариант, состав ссылок обязан
   совпадать между языками (die при расхождении). */
function buildHelp() {
  const H = JSON.parse(fs.readFileSync(path.join(APP_DIR, "help", "help.json"), "utf8"));
  const die = (m) => { throw new Error("помощь: " + m); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(H.updated || "")) die("updated не дата");
  validateLocalizedUi(H.ui, die);
  // ссылки не должны разъезжаться между языками: сверяем структуру секций по ru
  const hrefsOf = (u) => u.sections.map((s) => s.items.map((i) => i[0]).join(",")).join(";");
  for (const l of ["en", "tr"]) if (hrefsOf(H.ui[l]) !== hrefsOf(H.ui.ru)) die("состав ссылок секций разошёлся: " + l);
  const vars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const ui = H.ui[lang], bui = BLOG_UI[lang];
    const ld = { "@context": "https://schema.org", "@graph": [ORG,
      webPageLd("/help", lang, ui.h1, ui.desc), faqLd(ui.faq)] };
    const crumbs = [[bui.home, "/" + lang], [ui.h1, null]];
    ld["@graph"].push(crumbsLd(crumbs));
    // карточки-ссылки .post — тот же примитив, что у списка статей блога; контакты —
    // рамка .callout, как финальные карточки-магниты статей (единый вид сайта)
    const sections = ui.sections.map((s) =>
      "<h2>" + esc(s.h) + "</h2>\n" + s.items.map(([href, label, note]) => {
        const h = href.replace("{lang}", lang);
        const ext = h.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
        return '<a class="post" href="' + h + '"' + ext + "><h3>" + esc(label) + "</h3><p>" + esc(note) + "</p></a>";
      }).join("\n") + "\n").join("\n");
    const contacts = '<div class="callout"><b>' + esc(ui.contactsTitle) + "</b><p>" + esc(bui.waText) + "</p><p>" +
      '<a class="cta" href="' + SITE_WA + '" target="_blank" rel="noopener noreferrer">WhatsApp</a> ' +
      '<a class="cta2" href="https://www.instagram.com/learnkg_edu" target="_blank" rel="noopener noreferrer">Instagram @learnkg_edu</a> ' +
      '<a class="cta2" href="tel:+996505854856">+996 505 854 856</a> ' +
      '<a class="cta2" href="mailto:' + SITE_EMAIL + '">' + SITE_EMAIL + "</a></p></div>\n";
    const body = "<body>\n" + siteHeader("/help", lang, bui) + '<div class="wrap">\n' + topBar("/help", lang, bui, crumbs) +
      "<h1>" + esc(ui.h1) + '</h1>\n<p class="lead">' + esc(ui.lead) + "</p>\n" +
      sections + faqSection(bui.faqTitle, ui.faq) + contacts +
      "</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
    vars[lang] = pack("<!DOCTYPE html>\n" +
      blogHead(lang, "/help", ui.title + " · learn.kg", ui.desc, ld, { ogType: "website", css: BLOG_CSS }) + body);
  }
  return { vars, updated: H.updated };
}
const HELP = buildHelp();
/* ===/HELP=== */

/* ===DOC-CHROME=== Одностраничники privacy/terms/install живут на одной URL с
   внутренним переключателем языка (html[data-doc]) — сервер вшивает им ТОТ ЖЕ
   примитив шапки и футера, что у контентных страниц (CHROME_CSS + siteHeader/
   siteFooter), тремя копиями: видима копия языка документа тем же механизмом,
   что и сами тексты. Переключатель языков — в шапке, как на остальных страницах:
   кнопки data-doclang зовут applyDocLang самой страницы; прежний переключатель
   в топбаре скрыт (#langs). */
const DOC_CHROME_CSS = "<style>" +
  ".chrome{display:none}.chrome-i{display:none}" +
  ['ru', 'en', 'tr'].map((l) => 'html[data-doc="' + l + '"] .chrome[lang="' + l + '"]{display:block}' +
    'html[data-doc="' + l + '"] .chrome-i[lang="' + l + '"]{display:inline}').join("") +
  'html:not([data-doc]) .chrome[lang="ru"]{display:block}html:not([data-doc]) .chrome-i[lang="ru"]{display:inline}' +
  "#langs{display:none}" +
  CHROME_CSS + "</style>";
function injectDocChrome(buf) {
  const src = buf.toString("utf8");
  const heads = ["ru", "en", "tr"].map((l) =>
    '<div class="chrome" lang="' + l + '">' + siteHeader("", l, BLOG_UI[l], { docSeg: true }) + "</div>").join("");
  const foots = ["ru", "en", "tr"].map((l) =>
    '<div class="chrome" lang="' + l + '">' + siteFooter(l, BLOG_UI[l]) + "</div>").join("");
  // кнопки шапки переключают язык документа его же функцией; копии шапки/футера
  // переключатся сами — их видимость привязана к html[data-doc]
  const seg = '<script>document.addEventListener("click",function(e){' +
    'var b=e.target&&e.target.closest?e.target.closest("[data-doclang]"):null;' +
    'if(b&&typeof applyDocLang==="function")applyDocLang(b.getAttribute("data-doclang"));});</' + "script>";
  // крошка «learn.kg» вела на голый «/» (для вошедшего это тренажёр) — как в блоге,
  // ведём на витрину своего языка с локализованной подписью «Главная»
  const oldCrumb = '<a class="back" href="/">learn.kg</a>';
  if (!src.includes(oldCrumb)) throw new Error("одностраничник: крошка learn.kg не найдена — разметка изменилась?");
  const crumbHome = ["ru", "en", "tr"].map((l) =>
    '<a class="back chrome-i" lang="' + l + '" href="/' + l + '">' + esc(BLOG_UI[l].home) + "</a>").join("");
  let out = src.replace(oldCrumb, crumbHome);
  out = out.replace("</head>", DOC_CHROME_CSS + "</head>");
  out = out.replace("<body>", "<body>\n" + heads);
  // три языковых копии футера — но тег виджета один на документ
  out = out.replace("</body>", foots.split(CHAT_TAG).join("") + CHAT_TAG + seg + "</body>");
  if (!out.includes('class="sfoot"') || !out.includes('class="shead"')) {
    throw new Error("одностраничник: шапка/футер не вшились — разметка страницы изменилась?");
  }
  return Buffer.from(out);
}
/* ===/DOC-CHROME=== */

/* ===WORDS=== Страницы-ответы «X по-кыргызски»: один узкий интент — одна страница.
   Кластер «X по-киргизски» — самый частотный в русской семантике (Wordstat), а
   конкуренции почти нет: ни у кого нет озвучки носителя под конкретное слово.
   Данные — app/words/words.json: фразы берутся ПО ID из CONTENT (не дублируются
   текстом), поэтому правка курса автоматически правит страницу. Озвучка работает
   для анонима, потому что все используемые фразы входят в публичный набор
   разговорника — это проверяет валидация ниже, а не надежда. */
function buildWords() {
  const W = JSON.parse(fs.readFileSync(path.join(APP_DIR, "words", "words.json"), "utf8"));
  // Тексты хаба — свой файл: реестр слов растёт отдельно от подписей страницы-списка
  const HUB = JSON.parse(fs.readFileSync(path.join(APP_DIR, "words", "hub.json"), "utf8"));
  const die = (m) => { throw new Error("слова: " + m); };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(W.updated || "")) die("updated не дата");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(HUB.updated || "")) die("hub.json: updated не дата");
  keyParity(W.ui, die, "ui");
  keyParity(HUB.ui, die, "hub.json: ui");
  const C = DEMO.content;
  // индекс всех не-alias фраз курса: id → запись с четырьмя языками
  const byId = new Map();
  for (const [mod, d] of Object.entries(C)) for (const v of (d.vocab || [])) if (!v.ref) byId.set(v.id, { mod, ...v });
  const pages = {};
  const seenSlug = new Set(), seenTitle = new Set();
  for (const w of (W.words || [])) {
    if (!/^[a-z0-9-]+$/.test(w.slug || "")) die("слаг не валиден: " + w.slug);
    if (["ru", "en", "tr"].includes(w.slug)) die("слаг совпадает с кодом языка и перехватил бы хаб /slovo: " + w.slug);
    if (seenSlug.has(w.slug)) die("слаг дважды: " + w.slug);
    seenSlug.add(w.slug);
    if (!BLOG_PAGES["/blog/" + w.related]) die(w.slug + ": related-статьи " + w.related + " нет");
    // heads — необязательное переименование заголовков блоков; если задано, то на всех
    // трёх языках и только для существующих блоков (иначе опечатка молча ничего не делает)
    if (w.heads) for (const l of ["ru", "en", "tr"]) {
      if (!w.heads[l]) die(w.slug + ": heads без языка " + l);
      for (const k of Object.keys(w.heads[l])) {
        if (!["variants", "replies", "examples"].includes(k)) die(w.slug + ": heads." + l + " — неизвестный блок " + k);
        if (!(w[k] || []).length) die(w.slug + ": heads." + l + "." + k + " переименовывает пустой блок");
      }
    }
    const ids = [w.main].concat(w.variants || [], w.replies || [], w.examples || []);
    for (const id of ids) {
      const x = byId.get(id);
      if (!x) die(w.slug + ": фразы " + id + " нет в CONTENT");
      // Ключевое условие: фраза обязана входить в публичный НАБОР разговорника — иначе
      // её озвучка закрыта гейтом и кнопка молчала бы анониму. Проверяется состав набора,
      // а не наличие mp3: файлов нет в тестах и в локальной разработке (канон: без
      // fail-fast по содержимому /data), а сама кнопка рендерится по publicAudio.
      if (!RAZGO.ids.has(x.mod + "/" + id)) die(w.slug + ": фраза " + id + " вне публичного набора разговорника");
    }
    const vars = {};
    for (const lang of ["ru", "en", "tr"]) {
      const ui = W.ui[lang], bui = BLOG_UI[lang];
      for (const f of ["titles", "descs", "leads", "notes"]) if (!w[f] || !w[f][lang]) die(w.slug + ": нет " + f + "." + lang);
      if (!w.faq || !Array.isArray(w.faq[lang]) || w.faq[lang].length < 2) die(w.slug + ": faq." + lang + " — нужно ≥2 пар");
      const title = w.titles[lang], base = "/slovo/" + w.slug;
      if (seenTitle.has(title)) die("титул дважды: " + title);
      seenTitle.add(title);
      const phrase = (id) => {
        const x = byId.get(id), key = x.mod + "/" + id;
        const lat = lang === "ru" ? "" : '<span class="lat">' + esc(kyToLat(x.ky, lang)) + "</span>";
        const btn = publicAudio(x.mod, id)
          ? '<button class="pl" data-a="' + key + '" aria-label="' + esc(ui.listen) + '">▶ ' + esc(ui.listen) + "</button>" : "";
        return '<div class="ph"><span class="ky">' + esc(x.ky) + "</span>" + lat +
          '<span class="gl">' + esc(x[lang]) + "</span>" + btn + "</div>";
      };
      // Заголовок блока — общий для семейства, но слово вправе назвать его по делу:
      // «Что отвечают» над числами 6–10 читалось бы как ответ на вопрос. Переименование —
      // данные (heads.<lang>.<блок>), одинаковый механизм для всех слов, без веток по slug.
      const head = (key) => ((w.heads && w.heads[lang] && w.heads[lang][key]) || ui[key]);
      const block = (heading, list) => (list && list.length)
        ? "<h2>" + esc(heading) + "</h2>\n" + list.map(phrase).join("\n") + "\n" : "";
      // цепочка идёт через хаб слов: у каждой страницы-ответа есть дорога к списку всех
      // (и обратная ссылка хабу — до него страницы были почти сиротами по перелинковке);
      // разговорник остаётся ссылкой в карточке ниже
      const crumbs = [[bui.home, "/" + lang], [ui.crumbLabel, "/slovo/" + lang], [title, null]];
      const ld = { "@context": "https://schema.org", "@graph": [ORG,
        webPageLd(base, lang, title, w.descs[lang]), faqLd(w.faq[lang]), crumbsLd(crumbs)] };
      // base, а не "/razgovornik": переключатель языков в шапке ведёт на СОСЕДНИЙ вариант
      // этой же страницы (канон «адрес авторитетен»), иначе клик по EN уводил читателя
      // слова в общий разговорник
      const body = "<body>\n" + siteHeader(base, lang, bui) + '<div class="wrap">\n' +
        topBar(base, lang, bui, crumbs) +
        "<h1>" + esc(title) + "</h1>\n" +
        '<p class="lead">' + esc(w.leads[lang]) + "</p>\n" +
        phrase(w.main) + "\n" +
        block(head("variants"), w.variants) + block(head("replies"), w.replies) + block(head("examples"), w.examples) +
        "<h2>" + esc(ui.howto) + "</h2>\n<p>" + esc(w.notes[lang]) + "</p>\n" +
        faqSection(ui.faqTitle, w.faq[lang]) +
        // соседние слова своего языка: страницы-ответы перелинкованы между собой, а не
        // только через хаб (до 08.10 слово было в трёх кликах от другого слова)
        "<h2>" + esc(ui.otherWords) + '</h2>\n<ul class="kafter owords">' + W.words.filter((o) => o !== w)
          .map((o) => '<li><a href="/slovo/' + o.slug + "/" + lang + '">' + esc(o.titles[lang]) + "</a></li>").join("") + "</ul>\n" +
        // внутренняя перелинковка: раздел разговорника с этой темой, поиск фраз и статья
        '<div class="callout"><b>' + esc(ui.moreTitle) + "</b><p>" + esc(ui.moreText) + "</p><p>" +
        '<a class="cta" href="/razgovornik/' + lang + "#" + esc(w.rzAnchor) + '">' + esc(ui.rzBtn) + "</a> " +
        '<a class="cta2" href="/perevodchik/' + lang + '">' + esc(ui.pvBtn) + "</a> " +
        '<a class="cta2" href="/blog/' + esc(w.related) + "/" + lang + '">' + esc(ui.artBtn) + "</a> " +
        '<a class="cta2" href="/slovo/' + lang + '">' + esc(HUB.ui[lang].allWords) + "</a></p></div>\n" +
        '<script>\n"use strict";\n(function(){\n' + PUB_AUDIO_JS + LANG_SEG_JS + "})();\n</script>\n" +
        "</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
      const html = "<!DOCTYPE html>\n" +
        blogHead(lang, base, title + " · learn.kg", w.descs[lang], ld, { ogType: "article", css: BLOG_CSS + RZ_CSS_EXTRA + LIST_CSS }) + body;
      if (html.includes("((")) die("маркер ((анкор|путь)) протёк в HTML " + base + "/" + lang);
      vars[lang] = pack(html);
    }
    pages["/slovo/" + w.slug] = { vars: new Map(Object.entries(vars)), date: W.updated };
  }
  if (!Object.keys(pages).length) die("нет ни одной страницы");
  /* Хаб /slovo — страница-список всех «X по-кыргызски». До него страницы-ответы были
     почти сиротами: входящих ссылок только из одной статьи, из меню и футера — ни одной,
     и внутренний вес до них не доходил (аудит 05.09.2026). Карточки собираются из того же
     реестра, что и сами страницы: новое слово появляется на хабе само, без правки текстов.
     Дата — более поздняя из updated реестра и updated текстов хаба: правка любого из двух
     двигает lastmod, иначе поисковики не перечитали бы список. */
  const firstSentence = (s) => (String(s).match(/^[\s\S]*?[.!?…](?=\s|$)/) || [String(s)])[0];
  const hubVars = {};
  for (const lang of ["ru", "en", "tr"]) {
    const ui = HUB.ui[lang], wui = W.ui[lang], bui = BLOG_UI[lang];
    const n = (s) => String(s).split("{n}").join(String(W.words.length));
    const title = n(ui.title), desc = n(ui.desc), h1 = n(ui.h1);
    if (title.length > 60) die("hub.json: title " + lang + " длиннее 60");
    if (desc.length < 80 || desc.length > 160) die("hub.json: desc " + lang + " вне 80–160: " + desc.length);
    const crumbs = [[bui.home, "/" + lang], [wui.crumbLabel, null]];
    const listId = "https://learn.kg/slovo/" + lang + "#words";
    const ld = { "@context": "https://schema.org", "@graph": [ORG,
      Object.assign(webPageLd("/slovo", lang, h1, desc), { "mainEntity": { "@id": listId } }),
      { "@type": "ItemList", "@id": listId, "name": h1, "numberOfItems": W.words.length,
        "itemListOrder": "https://schema.org/ItemListOrderAscending",
        "itemListElement": W.words.map((w, i) => ({ "@type": "ListItem", "position": i + 1,
          "name": w.titles[lang], "url": "https://learn.kg/slovo/" + w.slug + "/" + lang })) },
      crumbsLd(crumbs)] };
    // карточка = титул страницы-ответа + первая фраза её lead (прямой ответ, а не
    // пересказ): текст на хабе и на самой странице не разъезжаются по построению
    const cards = W.words.map((w) => '<a class="post" href="/slovo/' + w.slug + "/" + lang + '"><h2>' +
      esc(w.titles[lang]) + "</h2><p>" + esc(firstSentence(w.leads[lang])) + "</p></a>").join("\n");
    const body = "<body>\n" + siteHeader("/slovo", lang, bui) + '<div class="wrap">\n' +
      topBar("/slovo", lang, bui, crumbs) +
      "<h1>" + esc(h1) + "</h1>\n" +
      '<p class="lead">' + esc(n(ui.lead)) + "</p>\n" +
      cards + "\n" +
      '<div class="callout"><b>' + esc(wui.moreTitle) + "</b><p>" + esc(wui.moreText) + "</p><p>" +
      '<a class="cta" href="/razgovornik/' + lang + '">' + esc(wui.rzBtn) + "</a> " +
      '<a class="cta2" href="/perevodchik/' + lang + '">' + esc(wui.pvBtn) + "</a></p></div>\n" +
      '<script>\n"use strict";\n(function(){\n' + LANG_SEG_JS + "})();\n</script>\n" +
      "</div>\n" + siteFooter(lang, bui) + "</body>\n</html>\n";
    hubVars[lang] = pack("<!DOCTYPE html>\n" +
      blogHead(lang, "/slovo", title + " · learn.kg", desc, ld, { ogType: "website", css: BLOG_CSS }) + body);
  }
  // хаб первым ключом — для читаемости реестра; на маршрутизацию порядок не влияет:
  // вариант ищется точным ключом языка, и «/slovo» + «spasibo/ru» просто не находится
  return Object.assign({ "/slovo": { vars: new Map(Object.entries(hubVars)),
    date: HUB.updated > W.updated ? HUB.updated : W.updated } }, pages);
}
const WORD_PAGES = buildWords();

/* ===/PEREVODCHIK=== */
  return { BLOG_PAGES, DOC_CHROME_CSS, HELP, KURS_CSS_EXTRA, KURS_PAGES, LEVEL_TEST, PROBNY_A1, PROBNY_B1, PROBNY_B2, PEREVODCHIK, PUB_AUDIO_JS, PV_CSS_EXTRA, PV_FN, PV_LOGIC, QUIZ_IIFE, QUIZ_LOGIC, RAZGO, RZ_CSS_EXTRA, TEST_CSS_EXTRA, WORD_PAGES, buildBlog, buildHelp, buildKurs, buildQuizPage, buildPerevodchik, buildRazgovornik, buildWords, injectDocChrome, jsonInScript, publicAudio };
}

module.exports = { initChrome, initPages, SITE_EMAIL, SITE_WA, setChatVersion, CHAT_TAG: () => CHAT_TAG, loadKursText, courseLd };
