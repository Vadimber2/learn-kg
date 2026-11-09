"use strict";
/* learn.kg (тренажёр кыргызского) — минимальный сервер без зависимостей и без БД.
   - приложение: сборка app/src/* (/, /m0.html) — только для вошедших
   - витрина: app/landing.html — «/» для анонима, плюс /landing, /og.png, /robots.txt (публично)
   - вход: форма (login.html) на /login → POST /api/login → HMAC-cookie; GET /api/logout
   - совместимость: basic auth тоже принимается (curl/скрипты)
   - прогресс: GET/PUT /api/progress → JSON-файл /data/progress/<логин>.json
   Хранение только в файлах: users.json (учётки), /data (прогресс, секрет сессий). */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const logger = require("./logger");
const PASSWORDS = require("./passwords"); // scrypt-хэши учёток и их проверка
// Код тренажёра собирается из частей app/src/* (канон — CLAUDE.md «Исходники приложения»):
// один сборщик на сервер, демо-артефакт, генератор аудио и тесты.
const appshell = require("./appshell");
// адрес проекта нужен разметке Organization ниже — берём из site.js, где он объявлен
// один раз для футера, помощи и юридических страниц (site целиком подключается позже)
const { SITE_EMAIL, SITE_WA } = require("./site");

/* Brotli рядом с gzip: зона learn.kg в Cloudflare стоит DNS-only (deploy/CREDENTIALS.md
   «DNS: Cloudflare» — прокси включается вручную; живой ответ прода приходит без cf-ray),
   значит сжимает сам origin, и без brotli мы отдавали только gzip.
   Качество 9, а не 11: на оболочке приложения (2,7 МБ) q11 стоит 2,4 с — столько ленивая
   пересборка персонального варианта заняла бы прямо в запросе ученика. q9 = 72 мс
   (дешевле нынешнего gzip level 9 — 84 мс) и даёт 631 КБ против 805 КБ у gzip: −22%.
   Замер 05.09.2026, node 26, MacBook. */
const brotli = (buf) => zlib.brotliCompressSync(buf, { params: {
  [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
  [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } });

const PORT = Number(process.env.PORT || 80);
const DATA_DIR = process.env.DATA_DIR || "/data";
const APP_DIR = path.join(__dirname, "..", "app");
// Версия — из package.json (единственный источник); третий разряд бампается каждым PR.
// Чтение отказоустойчивое: отсутствие файла в образе не должно ронять сервер на старте.
let APP_VERSION = "0.0.0";
try { APP_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || "0.0.0"; } catch {}
// Файл учёток можно подменить (USERS_FILE) — тесты берут свою фикстуру и не зависят
// от того, кто заведён на проде: иначе удаление боевого пользователя ломает полсотни проверок.
const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, "users.json");
const RAW_USERS = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
// users.json: {"login":"пароль"} (роль student) или {"login":{"password":"...","role":"..."}} — база;
// role admin заводится ТОЛЬКО здесь (git-аудит) — оверлей ниже не может ни создать, ни снять админа.
// /data/users-extra.json: {"login":{"password":"...","role":"student"|"teacher","removed":true}} —
// созданные преподавателем/админом учётки, смены паролей, удаления. Итоговый список = база + extra.
const USERS_EXTRA_FILE = () => path.join(DATA_DIR, "users-extra.json");
const BASE_ROLES = new Set(["student", "teacher", "admin"]);
const EXTRA_ROLES = new Set(["student", "teacher"]); // admin не принимается из оверлея, даже если файл поправили руками
// Логины, совпадающие со служебными свойствами Object: обычный объект-словарь на таком ключе
// пишет в прототип (Object.assign(extra["__proto__"], …) заражает весь процесс), поэтому
// словари ниже — с нулевым прототипом, а сами имена запрещены на входе (isValidLogin).
const RESERVED_LOGINS = new Set(["__proto__", "constructor", "prototype"]);
function isValidLogin(s) { return /^[a-z0-9_-]{2,24}$/.test(s) && !RESERVED_LOGINS.has(s); }
let PLAINTEXT_WARNED = false;   // о паролях открытым текстом в users.json — один раз, не на каждую пересборку
function buildUsers() {
  const out = Object.create(null);
  for (const [k, v] of Object.entries(RAW_USERS)) {
    if (RESERVED_LOGINS.has(k)) { logger.warn("users", "reserved login in users.json ignored", { login: k }); continue; }
    if (typeof v === "string") {
      if (!v) { logger.warn("users", "empty password in users.json, login ignored", { login: k }); continue; }
      out[k] = { password: v, role: "student" }; continue;
    }
    if (!v || typeof v.password !== "string" || !v.password) {
      logger.warn("users", "missing password in users.json, login ignored", { login: k });
      continue;
    }
    let role = v.role || "student";
    if (!BASE_ROLES.has(role)) {
      logger.warn("users", "unknown role in users.json, defaulting to student", { login: k, role });
      role = "student";
    }
    out[k] = { password: v.password, role };
  }
  const plainBase = Object.keys(out).filter((k) => !PASSWORDS.isHashed(out[k].password));
  if (plainBase.length && !PLAINTEXT_WARNED) {
    PLAINTEXT_WARNED = true;
    logger.warn("users", "plaintext password in users.json — replace with a hash (node deploy/hash-password.js)", { logins: plainBase.join(",") });
  }
  let extra = Object.create(null);
  try { Object.assign(extra, JSON.parse(fs.readFileSync(USERS_EXTRA_FILE(), "utf8"))); } catch {}
  for (const [l, e] of Object.entries(extra)) {
    if (RESERVED_LOGINS.has(l)) { logger.warn("users", "reserved login in users-extra.json ignored", { login: l }); continue; }
    if (out[l] && out[l].role === "admin") {
      if (e && (e.password != null || e.removed || e.role)) logger.warn("users", "users-extra entry ignored for admin login", { login: l });
      continue;
    }
    if (e && e.removed) {
      // Надгробие от старых версий могло накрыть логин из users.json: новые удаления такое
      // не создают (см. ветку remove), но молчать об уже лежащем в /data нельзя — иначе
      // «поправил users.json, а человек не входит» выглядит необъяснимо.
      if (out[l]) logger.warn("users", "users-extra tombstone hides a users.json login — remove the entry to restore", { login: l });
      delete out[l];
      continue;
    }
    const base = out[l] || { role: "student" };
    if (e && e.password != null) {
      base.password = e.password;
      // подпись cookie, выданных до хэшей (см. migrateUsersExtra) — до своего срока
      if (e.legacySig && e.legacyUntil) { base.legacySig = e.legacySig; base.legacyUntil = e.legacyUntil; }
    }
    if (e && e.role) {
      if (EXTRA_ROLES.has(e.role)) base.role = e.role;
      else logger.warn("users", "unknown role in users-extra.json, ignored", { login: l, role: e.role });
    }
    if (base.password) out[l] = base;
  }
  return out;
}
let USERS = buildUsers();
// Оверлей мог измениться мимо этого процесса — правкой файла руками (или другой репликой,
// если такая появится). Штамп — ХЭШ содержимого, не mtime+size: перезапись файла на месте
// тем же размером в ту же миллисекунду для mtime-штампа невидима — это реальная гонка,
// годами флакавшая server.test в докере (смена пароля «мимо API» не подхватывалась).
// Файл мал (записи учеников), sha1 на auth-пути стоит десятки микросекунд.
function usersStamp() {
  try { return crypto.createHash("sha1").update(fs.readFileSync(USERS_EXTRA_FILE())).digest("hex"); } catch { return ""; }
}
let USERS_STAMP = usersStamp();
function refreshUsers() {
  const s = usersStamp();
  if (s !== USERS_STAMP) {
    USERS_STAMP = s;
    USERS = buildUsers();
    logger.info("users", "reloaded after external change", { users: Object.keys(USERS).length });
  }
}
function mutateUsersExtra(login, patch) {
  if (RESERVED_LOGINS.has(login)) throw new Error("reserved login");
  const extra = Object.create(null);
  try { Object.assign(extra, JSON.parse(fs.readFileSync(USERS_EXTRA_FILE(), "utf8"))); } catch {}
  if (typeof patch.password === "string" && !PASSWORDS.isHashed(patch.password))
    patch = Object.assign({}, patch, { password: PASSWORDS.hashPassword(patch.password) });
  extra[login] = Object.assign(Object.create(null), extra[login] || {}, patch);
  // любая смена пароля (и удаление) отзывает подпись cookie, выданных до хэшей
  if ("password" in patch) { delete extra[login].legacySig; delete extra[login].legacyUntil; }
  atomicWrite(USERS_EXTRA_FILE(), JSON.stringify(extra));
  USERS = buildUsers();
  USERS_STAMP = usersStamp();
}
function roleOf(login) { return (USERS[login] && USERS[login].role) || "student"; }
function canEdit(login) { const r = roleOf(login); return r === "teacher" || r === "admin"; }
const LOGIN_HTML = fs.readFileSync(path.join(__dirname, "login.html"));
// Публичная витрина learn.kg: читается один раз, как login.html — меняется только релизом,
// а анонимный «/» самый горячий адрес (боты, ссылки из WhatsApp) в однопоточном сервере.
const site = require("./site"); // билдеры публичных страниц и хром (initChrome/initPages ниже)
const LANDING_HTML = fs.readFileSync(path.join(APP_DIR, "landing.html"));
// Версия виджета чата — хеш его исходников: тег <script src="/chat.js?v=…"> меняется с каждым
// деплоем, поэтому кэш на сутки не задерживает обновление (старый виджет жил 10 минут после выкладки)
const CHAT_VER = crypto.createHash("sha1").update(fs.readFileSync(path.join(APP_DIR, "chat.js")))
  .update(fs.readFileSync(path.join(APP_DIR, "chat-ui.json"))).digest("hex").slice(0, 8);
site.setChatVersion(CHAT_VER);
// /en и /tr — те же страницы, локализованные на старте из словаря самой витрины
// (===LANDING-I18N=== — единственный источник переводов; сервер ничего не дублирует).
// Нужны поисковикам: клиентское переключение языка краулеры не выполняют.
const vm = require("vm");
const LANDING_DICT = (() => {
  const m = LANDING_HTML.toString("utf8").match(/\/\* ===LANDING-I18N=== \*\/([\s\S]*?)\/\* ===\/LANDING-I18N=== \*\//);
  const sbx = { localStorage: { getItem: () => null, setItem: () => {} } };
  vm.createContext(sbx);
  vm.runInContext(m[1] + "; this.D = LANDING_I18N;", sbx);
  return sbx.D;
})();
// Тексты курсов — один экземпляр на сервер: им живут и витрина, и страницы /kurs-*
// (у витрины были свои имена курсов: A1 звался «Курсы … A1–B2» с описанием всей витрины)
const KURS_TEXT = site.loadKursText(APP_DIR);
// LD-граф собирается из словаря программно (JSON.stringify) — кавычка в будущем
// тексте не сломает разметку, в отличие от текстовых регекспов.
function buildGraph(lang) {
  const D = LANDING_DICT;
  const T = (k) => (D[lang] && D[lang][k] !== undefined ? D[lang][k] : (D.en[k] !== undefined ? D.en[k] : D.ru[k]));
  const orgId = "https://learn.kg/#org";
  const faqKeys = Object.keys(D.ru).filter((k) => /^faq_q\d+$/.test(k)).sort();
  // Курс = уровень: узел строит site.courseLd — тот же, что на странице /kurs-<lvl>
  // (url на языковую страницу курса, @id общий, Google склеивает сущности). Витрина —
  // summary-страница «Course list»: право на карусель даёт ItemList из ≥3 ListItem
  // с position и url (аудит 19.08: без него три Course россыпью не дают ничего).
  // Курсы объявляются один раз и переиспользуются каруселью ниже: имя и адрес ListItem
  // берутся из самого узла, поэтому разъехаться им негде. Список — ключи kurs.json
  // (buildKurs роняет старт, если он разошёлся с реестром COURSES).
  const courses = Object.keys(KURS_TEXT.courses).map((cid) => site.courseLd(KURS_TEXT, cid, lang, orgId));
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": orgId, "name": "learn.kg", "url": "https://learn.kg/",
      // logo — квадрат ≥112×112 (icon-512), не og-баннер 1200×630: баннер в слоте логотипа
      // выдача рисует сплющенной полосой (schema-аудит 19.08)
      "logo": "https://learn.kg/icon-512.png", "sameAs": ["https://www.instagram.com/learnkg_edu"],
      // E-E-A-T: за платформой стоят названные люди — преподаватель-носитель и разработчик
      "employee": [{ "@type": "Person", "name": T("ct_name"), "jobTitle": T("ct_role"), "knowsLanguage": ["ky", "ru"] }],
      "founder": { "@type": "Person", "name": T("ld_founder") },
      // два канала: мессенджер для учеников и почта для всех остальных (учреждения,
      // запросы по данным) — поисковики показывают их в панели знаний
      "email": SITE_EMAIL,
      "contactPoint": [
        { "@type": "ContactPoint", "contactType": "customer service", "url": SITE_WA },
        { "@type": "ContactPoint", "contactType": "customer support", "email": SITE_EMAIL,
          "availableLanguage": ["ru", "en", "tr", "ky"] }] },
    { "@type": "WebSite", "@id": "https://learn.kg/#website", "name": "learn.kg", "url": "https://learn.kg/",
      "inLanguage": ["ru", "en", "tr"], "publisher": { "@id": orgId } },
    ...courses,
    // Карусель курсов. ListItem ссылается на уже объявленный Course по @id (item), а не
    // повторяет сущность: копия дала бы в графе два курса на один url. name и url в самом
    // ListItem продублированы сознательно — Google читает их у summary-страницы списка.
    { "@type": "ItemList", "@id": "https://learn.kg/#courses",
      "numberOfItems": courses.length, "itemListOrder": "https://schema.org/ItemListOrderAscending",
      "itemListElement": courses.map((c, i) => ({ "@type": "ListItem", "position": i + 1,
        "name": c.name, "url": c.url, "item": { "@id": c["@id"] } })) },
    { "@type": "FAQPage", "mainEntity": faqKeys.map((k) => ({ "@type": "Question", "name": T(k),
      "acceptedAnswer": { "@type": "Answer", "text": T(k.replace(/q(\d+)$/, "a$1")) } })) } ] };
}
function localizedLanding(lang) {
  const src = LANDING_HTML.toString("utf8");
  const D = LANDING_DICT;
  const T = (k) => (D[lang][k] !== undefined ? D[lang][k] : (D.en[k] !== undefined ? D.en[k] : D.ru[k]));
  let out = src;
  // data-srv-lang — метка «страница отдана сервером как языковой вариант»: по ней клиент
  // знает, что адрес авторитетнее сохранённого выбора (иначе /en показывал бы русский)
  out = out.replace('<html lang="ru"', '<html lang="' + lang + '" data-srv-lang="' + lang + '"');
  out = out.replace(/<title>[^<]*<\/title>/, "<title>" + T("title") + "</title>");
  out = out.replace(/(<meta name="description" content=")[^"]*/, "$1" + T("meta_desc"));
  out = out.replace(/(property="og:title" content=")[^"]*/, "$1" + T("title").replace(/ · learn\.kg$/, ""));
  out = out.replace(/(property="og:description" content=")[^"]*/, "$1" + T("meta_desc"));
  out = out.replace(/(property="og:locale" content=")[^"]*/, "$1" + (lang === "tr" ? "tr_TR" : "en_US"));
  out = out.replace(/(property="og:url" content=")[^"]*/, "$1https://learn.kg/" + lang);
  out = out.replace(/(rel="canonical" href=")[^"]*/, "$1https://learn.kg/" + lang);
  out = out.replace(/(property="og:image:alt" content=")[^"]*/, "$1" + T("og_alt"));
  out = out.replace(/(<!-- ===LD-GRAPH=== -->\s*<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
    (a, open, close) => open + "\n" + JSON.stringify(buildGraph(lang)) + "\n" + close);
  out = out.replace(/(\sdata-i="([a-z0-9_]+)"[^>]*>)[^<]*/g, (all, open, k) => open + T(k));
  out = out.replace(/href="[^"]*"([^>]*data-i-href="([a-z0-9_]+)")/g, (all, rest, k) => 'href="' + T(k) + '"' + rest);
  out = out.replace('<script src="/chat.js" defer></script>', site.CHAT_TAG());
  return Buffer.from(out, "utf8");
}
// Все три варианта строятся одинаково (канон симметрии): ru тоже получает метку
// серверного варианта, иначе на /ru сохранённый выбор перебивал бы язык адреса
const LANDING_VARIANTS = {};
for (const lang of ["ru", "en", "tr"]) {
  const buf = localizedLanding(lang);
  LANDING_VARIANTS[lang] = { buf, gz: zlib.gzipSync(buf, { level: 9 }), br: brotli(buf), etag: null };
}
// Даты — из манифеста app/seo-lastmod.json (правится руками при изменении контента;
// тест сверяет sha файла). mtime в Docker-образе = время сборки и врал бы каждый деплой.
const SEO_DATES = JSON.parse(fs.readFileSync(path.join(APP_DIR, "seo-lastmod.json"), "utf8"));
let PRIVACY_HTML = fs.readFileSync(path.join(APP_DIR, "privacy.html"));
let PRIVACY_GZ = zlib.gzipSync(PRIVACY_HTML, { level: 9 });
let PRIVACY_BR = brotli(PRIVACY_HTML);
let TERMS_HTML = fs.readFileSync(path.join(APP_DIR, "terms.html"));
let TERMS_GZ = zlib.gzipSync(TERMS_HTML, { level: 9 });
let TERMS_BR = brotli(TERMS_HTML);
const OG_PNG = fs.readFileSync(path.join(APP_DIR, "og.png"));
// Слайды аудиоурока (app/lessons/*.webp): читаются один раз — их меняет только релиз,
// а урок открыт и анониму в демо, поэтому раздача публичная, как og.png.
const LESSON_SLIDE_FILES = (() => {
  const map = new Map();
  try {
    for (const f of fs.readdirSync(path.join(APP_DIR, "lessons")).filter((x) => /^[a-z0-9_-]{1,32}\.webp$/.test(x))) {
      const b = fs.readFileSync(path.join(APP_DIR, "lessons", f));
      // etagOf объявлен ниже по файлу (const, TDZ) — здесь тот же хеш руками
      map.set(f, { buf: b, etag: '"' + crypto.createHash("sha1").update(b).digest("hex").slice(0, 16) + '"' });
    }
  } catch { /* каталога может не быть в старых развёртках — урок обойдётся SVG-рисунками */ }
  return map;
})();
// Аватар преподавателя на витрине: WebP 144×144 — ровно 2× слота 72×72 (PNG 288×288 весил 134 КБ)
const AVATAR_WEBP = fs.readFileSync(path.join(APP_DIR, "avatar.webp"));
const FAVICON_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="14" fill="#0e7490"/>' +
  '<text x="32" y="45" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">Ө</text></svg>');
const NOT_FOUND_HTML = Buffer.from('<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Страница не найдена · learn.kg</title>' +
  '<style>:root{--bg:#f6f7f9;--ink:#1c2430;--muted:#57616e;--accent:#0e7490}' +
  '@media (prefers-color-scheme:dark){:root{--bg:#10151c;--ink:#e7ecf2;--muted:#8b98a7;--accent:#38bdf8}}' +
  'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);' +
  'min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px}' +
  'h1{font-size:1.6rem;margin:0 0 8px}p{color:var(--muted);margin:0 0 18px}a{color:var(--accent)}</style></head>' +
  '<body><div><h1>404 — страница не найдена</h1><p>Такой страницы на learn.kg нет.</p>' +
  '<a href="/">На главную · learn.kg</a></div></body></html>');
// PWA: манифест, service worker и иконки — публичные (браузер тянет их без куки).
const MANIFEST_JSON = fs.readFileSync(path.join(APP_DIR, "manifest.webmanifest"));
const SW_JS = Buffer.from(fs.readFileSync(path.join(APP_DIR, "sw.js"), "utf8").replace("__APP_VERSION__", APP_VERSION));
/* ---------- Курсы: реестр уровней ----------
   Единственный источник таксономии. Новый уровень (A2…C2) — одна строка здесь плюс
   контент; id модулей продолжают сквозную нумерацию (m12, m13…), поэтому регекспы
   (m\d+), каталоги /data/audio|review|overrides, прогресс и журнал событий не требуют
   миграции. Порядок ключей = канонический порядок курсов. Объявлен до демо-сборки:
   она считает публичные цифры (DEMO_TOTAL) по курсу A1, а не по всему контенту. */
const COURSES = {
  a1: { label: "A1", modules: ["m0","m1","m2","m3","m4","m5","m6","m7","m8","m9","m10","m11"] },
  a2: { label: "A2", modules: ["m12","m13","m14","m15","m16","m17","m18","m19","m20","m21","m22","m23"] }, // модули добавляются по мере готовности контента
  b1: { label: "B1", modules: ["m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35"] }, // курс B1
  b2: { label: "B2", modules: ["m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47"] }, // B2: m46 повторение, m47 экзаменационная неделя
};
const COURSE_IDS = Object.keys(COURSES);
const MODULES = COURSE_IDS.flatMap((c) => COURSES[c].modules);
// Реестр курсов и исходники приложения обязаны знать один и тот же набор модулей:
// модуль без данных (или данные без строки в COURSES) роняют старт, а не отдельный экран.
{
  const inSrc = appshell.MODULES.join(",");
  if (inSrc !== MODULES.join(",")) throw new Error("COURSES и app/src разошлись по модулям: " + MODULES.join(",") + " ≠ " + inSrc);
}
const modulesOfCourses = (courses) => courses.flatMap((c) => (COURSES[c] || { modules: [] }).modules);
// Нормализация списка курсов: только известные, без дублей, в каноническом порядке.
// null — «не задано» (не путать с пустым списком: тот означал бы «ни одного курса» и запрещён).
function validCourses(v) {
  if (!Array.isArray(v)) return null;
  const set = new Set(v.filter((c) => typeof c === "string" && COURSES[c]));
  if (!set.size || set.size !== v.length) return null; // мусор или дубли — не принимаем молча
  return COURSE_IDS.filter((c) => set.has(c));
}

// Версия и флаг демо подставляются в собранную страницу; сами варианты страницы
// кэшируются (см. shellVariant) — прежде файл в 1,5 МБ читался с диска синхронно
// на каждую навигацию. Правка исходников без рестарта больше не подхватывается —
// в образе файлы всё равно иммутабельны.
const fillPlaceholders = (html, demo) => html.replace(/__APP_VERSION__|__DEMO__/g, (m) => (m === "__DEMO__" ? (demo ? "1" : "0") : APP_VERSION));

/* ---------- Демо /demo: артефакт m0_demo, собираемый при старте из полной сборки страницы ----------
   Форма (код/стили) берётся из боевого файла как есть, урезается только содержание:
   DATA-блок заменяется сгенерированным (только М0, только карточки с пометкой demo:1,
   с вшитыми правками преподавателя из /data/overrides), а справочные страницы платных
   модулей вырезаются (их материал захардкожен в самих render-функциях) — контент
   остальных модулей в исходник публичной страницы НЕ попадает. Аудио — копиями, снятыми
   здесь же при сборке (не публичный доступ к живому /api/audio). Руками не редактируется. */
// Справочники платных модулей: таблицы и примеры живут прямо в коде, поэтому урезать данные мало.
// В демо эти модули недоступны, функции остаются пустыми заглушками — MODULE_EXTRAS цел.
// Список выводится из манифеста частей (одна часть = один рендерер модуля): руками
// поддерживаемая копия имён расходилась бы с исходниками при каждом новом модуле.
/* Модуль демо — данные, а не ветки (решение владельца 29.10.2026: «М1 пробным вместо М0»):
   из него собираются карточки, диалоги, урок и справочник; его рендеры не вырезаются, его
   озвучка публична. Других модулей в демо нет (клиент стартует с первого готового модуля). */
// Параметр окружения DEMO_MOD (Coolify): «m2» и т.п. — смена модуля демо без правки кода.
// Неверное значение — отказ старта в buildDemo (модуля нет в CONTENT_READY).
const DEMO_MOD = process.env.DEMO_MOD || "m1";
if (!/^m\d{1,2}$/.test(DEMO_MOD)) throw new Error("DEMO_MOD: ожидается id модуля вида m1, получено «" + DEMO_MOD + "»");
const PAID_RENDERERS = appshell.manifest
  .map((p) => (p.match(/^render\/\d+-(render\w*M\d+)\.js$/) || [])[1])
  .filter(Boolean)
  .filter((n) => "m" + n.match(/M(\d+)$/)[1] !== DEMO_MOD);
// Один проход одним глобальным регекспом: пофункционный цикл сканировал файл 2×N раз
// (число рендереров × размер файла растут с каждым модулем A2 — рост квадратичный),
// а так стоимость постоянна, и ошибка называет сразу ВСЕ ненайденные тела.
function stripPaidRenderers(src) {
  // тело до первой закрывающей скобки в начале строки — стиль файла: верхнеуровневые «}».
  // Хвостовой \n — lookahead'ом, не потреблением: рендеры идут в файле подряд, и съеденный
  // перевод строки лишил бы следующую функцию её ведущего \n (матчился бы каждый второй).
  const re = new RegExp("\\nfunction (" + PAID_RENDERERS.join("|") + ")\\(m\\)\\{[\\s\\S]*?\\n\\}(?=\\n)", "g");
  const seen = new Set();
  const out = src.replace(re, (all, n) => { seen.add(n); return "\nfunction " + n + "(m){}"; });
  const missing = PAID_RENDERERS.filter((n) => !seen.has(n));
  if (missing.length) throw new Error("демо-сборка: не найдены тела " + missing.join(", ") + " — вырезать платный контент нечем");
  return out;
}
function buildDemo() {
  const src = stripPaidRenderers(appshell.buildAppHtml());
  const dm = src.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
  const sb = {}; vm.createContext(sb);
  vm.runInContext(dm[1] + ";this.CONTENT=CONTENT;this.CONTENT_READY=CONTENT_READY;this.DIALOGS=typeof DIALOGS===\"undefined\"?{}:DIALOGS;", sb);
  let total = 0;
  // Публичный счётчик «{n} фраз из {total}» — про курс A1 (демо и есть срез A1/М0):
  // по всему CONTENT_READY он с появлением модулей A2 начал бы завышать цифру курса
  for (const mod of sb.CONTENT_READY) if (COURSES.a1.modules.includes(mod)) for (const v of sb.CONTENT[mod].vocab) if (!v.ref) total++;
  const M = sb.CONTENT[DEMO_MOD];
  if (!M || !sb.CONTENT_READY.includes(DEMO_MOD)) throw new Error("buildDemo: модуля демо " + DEMO_MOD + " нет среди готовых (CONTENT_READY)");
  let ovr = {};
  try { ovr = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "overrides", DEMO_MOD + ".json"), "utf8")); } catch {}
  // Правки преподавателя вшиваются НАСТОЯЩЕЙ applyOverrides из ===OVERRIDES===-блока (как в
  // tests/overrides.test.js) — своя копия логики мёржа молча разъехалась бы при её изменении.
  // срез карточек: помеченные demo, а у модуля без пометок — весь модуль (М1 открыт целиком)
  const inDemo = M.vocab.some((c) => c.demo) ? (c) => c.demo : () => true;
  const vocab = M.vocab.filter((c) => inDemo(c) && !c.ref).map((c) => Object.assign({}, c));
  const om = src.match(/\/\* ===OVERRIDES=== \*\/([\s\S]*?)\/\* ===\/OVERRIDES=== \*\//);
  const osb = { VOCAB: vocab, OVERRIDES: ovr };
  vm.createContext(osb);
  vm.runInContext(om[1] + ";applyOverrides();", osb);
  const cats = {};
  for (const [k, v] of Object.entries(M.cats)) if (vocab.some((c) => c.cat === k)) cats[k] = v;
  const demoContent = { [DEMO_MOD]: Object.assign({}, M, { vocab, cats }) };
  // Функция/regex/undefined в данных потерялись бы в JSON.stringify МОЛЧА — падаем на старте.
  // Обход руками, а не isDeepStrictEqual: объекты пришли из vm-песочницы (другой realm),
  // строгое сравнение прототипов дало бы ложную тревогу на абсолютно чистых данных.
  function assertPure(v, p) {
    if (v === null) return;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return;
    const tag = Object.prototype.toString.call(v);
    if (t !== "object" || (tag !== "[object Object]" && tag !== "[object Array]"))
      throw new Error("данные не JSON-чисты (" + tag + " в " + p + "): потеряется в демо-сборке");
    for (const [k, x] of Object.entries(v)) assertPure(x, p + "." + k);
  }
  assertPure(demoContent, "CONTENT");
  // Демо-срез диалогов: части и куплеты с пометкой demo. Символ DIALOGS обязан существовать
  // в демо-артефакте всегда — studyTabsFor читает его на верхнем уровне при старте страницы.
  // У песни сознательно нет fullId (полный трек — платная фишка) и quiz (спрашивает про
  // куплеты вне среза).
  const demoDialogs = {};
  for (const [mid, D] of Object.entries(sb.DIALOGS || {})) {
    if (mid !== DEMO_MOD) continue;
    // у модуля без пометок demo — все части и куплеты (как и карточки)
    const any = (D.parts || []).some((p) => p.demo) || (D.songs || []).some((sn) => (sn.verses || []).some((v) => v.demo));
    const ok = (x) => !any || x.demo;
    const parts = (D.parts || []).filter(ok);
    const songs = (D.songs || [])
      .map((sn) => ({ title: sn.title, sub: sn.sub, subEn: sn.subEn, subTr: sn.subTr,
                      verses: (sn.verses || []).filter(ok) }))
      .filter((sn) => sn.verses.length);
    if (parts.length || songs.length) demoDialogs[mid] = { parts, songs };
  }
  assertPure(demoDialogs, "DIALOGS");
  const audio = new Map(); // копии mp3 демо-набора (с ETag), снятые при сборке
  for (const c of vocab) {
    try { const b = fs.readFileSync(path.join(DATA_DIR, "audio", DEMO_MOD, c.id + ".mp3")); audio.set(c.id, { buf: b, etag: etagOf(b) }); } catch {}
  }

  // Озвучка алфавита (ph_*) — часть справочника М0, который открыт в демо: кладём в снимок
  // всё, что реально существует; DEMO_AUDIO заодно показывает снаружи, что озвучено на проде
  try {
    for (const f of fs.readdirSync(path.join(DATA_DIR, "audio", "m0")).filter((x) => /^ph_[a-z0-9_]{1,36}\.mp3$/.test(x))) {
      try { const b = fs.readFileSync(path.join(DATA_DIR, "audio", "m0", f)); audio.set(f.slice(0, -4), { buf: b, etag: etagOf(b) }); } catch {}
    }
  } catch {}
  // </script> в правке преподавателя не должен разорвать <script>-блок публичной страницы
  const esc = (s) => s.replace(/</g, "\\u003c");
  // Уроки демо: реестр из сборки приложения, оставляем записи модулей демо-набора
  const demoLessons = {};
  {
    const mL = src.match(/const LESSONS = ([\s\S]*?);\n\/\* ===\/LESSONS===/);
    if (mL) { const all = JSON.parse(mL[1]); if (all[DEMO_MOD]) demoLessons[DEMO_MOD] = all[DEMO_MOD]; }
    // урок модуля M1+ живёт своей частью (LESSONS.m<n> = {…} между маркерами LESSON-DATA)
    const mM = src.match(new RegExp("\\/\\* ===LESSON-DATA:" + DEMO_MOD + "===[\\s\\S]*?\\nLESSONS\\." + DEMO_MOD + " = ([\\s\\S]*?);\\n\\/\\* ===\\/LESSON-DATA:" + DEMO_MOD + "=== \\*\\/"));
    if (mM) demoLessons[DEMO_MOD] = JSON.parse(mM[1]);
  }
  // слайды тем урока модуля M1+ — своя часть (Object.assign(LESSON_SLIDES, {…})), едет как есть
  let demoSlidesExtra = "";
  try { demoSlidesExtra = fs.readFileSync(path.join(__dirname, "..", "app", "src", "data", "lessons", DEMO_MOD + "-slides.js"), "utf8"); } catch {}
  // Иллюстрации и слайды тем урока — те же данные, что в приложении: срез вырезается
  // из сборки, чтобы демо не разъезжалось с приложением при правке наборов.
  const sliceByTheme = (marker) => {
    const mF = src.match(new RegExp("const " + marker + " = ([\\s\\S]*?);\\n\\/\\* ===\\/" + marker.replace(/_/g, "-") + "===", ""));
    if (!mF) return {};
    const all = JSON.parse(mF[1]);
    const keep = {};
    for (const th of (demoLessons[DEMO_MOD] ? demoLessons[DEMO_MOD].themes : [])) if (all[th.id]) keep[th.id] = all[th.id];
    return keep;
  };
  const demoFigs = sliceByTheme("LESSON_FIGS");
  const demoSlides = sliceByTheme("LESSON_SLIDES");
  const dataJs = "\nconst CONTENT=" + esc(JSON.stringify(demoContent)) +
    ";\nconst CONTENT_READY=[\"" + DEMO_MOD + "\"];\nconst DEMO_MOD=\"" + DEMO_MOD + "\";\nconst DEMO_TOTAL=" + total +
    ";\nconst DEMO_AUDIO=" + esc(JSON.stringify([...audio.keys()])) + // факт о наличии озвучки едет с артефактом
    ";\nconst DIALOGS=" + esc(JSON.stringify(demoDialogs)) +
    // Урок произношения едет в демо целиком: его озвучка (ph_*) и так в публичном
    // снимке, а вкладка «Уроки» выводится из наличия LESSONS[mid] — без объявления
    // демо падал бы ReferenceError на первом же рендере сайдбара
    ";\nconst LESSONS=" + esc(JSON.stringify(demoLessons)) +
    ";\nconst LESSON_FIGS=" + esc(JSON.stringify(demoFigs)) +
    ";\nconst LESSON_SLIDES=" + esc(JSON.stringify(demoSlides)) + ";\n" + demoSlidesExtra.replace(/<\/script/gi, "<\\/script") +
    // B1-глоссарии дефиниций: в демо контента B1 нет, но движок карточек ссылается
    // на реестр вне DATA — объявляем пустым (гейт класса бага DIALOGS v1.0.48)
    ";\nconst DEF_GLOSS={};\n" +
    // Реестр блоков аудирования — справочные описания звуков, не платный контент;
    // renderListen ссылается на STT_BLOCKS вне DATA, и гейт server.test.js требует
    // объявления в демо (класс бага DIALOGS v1.0.48). Промах маркеров — громкий
    // отказ сборки, а не молча пустое демо
    (() => {
      const b = src.match(/\/\* ===STT-BLOCKS===[\s\S]*?===\/STT-BLOCKS=== \*\//);
      if (!b) throw new Error("buildDemo: маркеры ===STT-BLOCKS=== не найдены в сборке");
      return b[0] + "\n";
    })() +
    // Спецификация итоговой проверки курса B1 (данные движка экзамена),
    // на них ссылается движок вне DATA (тот же гейт). Вкладки экзамена в демо нет:
    // она открывается реестром EXAM_MODS, а модулей B1 в демо-срезе не бывает.
    (() => {
      const b = src.match(/\/\* ===EXAM-B1===[\s\S]*?===\/EXAM-B1=== \*\//);
      if (!b) throw new Error("buildDemo: маркеры ===EXAM-B1=== не найдены в сборке");
      return b[0] + "\n";
    })() +
    // Спецификация A1 — та же природа (публичные требования с цитатами), тот же гейт.
    (() => {
      const b = src.match(/\/\* ===EXAM-A1===[\s\S]*?===\/EXAM-A1=== \*\//);
      if (!b) throw new Error("buildDemo: маркеры ===EXAM-A1=== не найдены в сборке");
      return b[0] + "\n";
    })() +
    // Спецификация B2 — та же природа, тот же гейт.
    (() => {
      const b = src.match(/\/\* ===EXAM-B2===[\s\S]*?===\/EXAM-B2=== \*\//);
      if (!b) throw new Error("buildDemo: маркеры ===EXAM-B2=== не найдены в сборке");
      return b[0] + "\n";
    })() +
    // Тексты экзамена — материал курсов, в демо их нет: объявляем пустым списком,
    // иначе движок падал бы ReferenceError на первом же рендере (класс бага DIALOGS).
    // EXAM_TEXT_SETS в демо не объявлен — движок штатно падает на одиночный EXAM_TEXTS.
    "const EXAM_TEXTS=[];\n";
  const DEMO_SEO = {
    // титулы демо намеренно разведены с primary-ключами витрины (deploy/seo-keywords.json):
    // «кыргызский язык онлайн»/«learn kyrgyz online» — ключи витрины, демо целит в «демо-урок»
    ru: { title: "Демо-урок кыргызского — попробуйте бесплатно · learn.kg",
          desc: "Бесплатное демо: модуль «О себе» целиком — карточки с озвучкой, аудиоурок, справочник с видео, диалоги, мини-тест. A1, без регистрации." },
    en: { title: "Kyrgyz demo lesson — try it free · learn.kg",
          desc: "Free Kyrgyz demo: the whole “About yourself” module — audio flashcards, an audio lesson, video reference, dialogues, a quiz. A1, no sign-up." },
    tr: { title: "Kırgızca demo dersi — ücretsiz deneyin · learn.kg",
          desc: "Ücretsiz Kırgızca demo: “Kendin hakkında” modülünün tamamı — sesli kartlar, sesli ders, videolu başvuru, diyaloglar, sınav. A1, kayıtsız." },
  };
  const HREFLANG = '\n<link rel="alternate" hreflang="ru" href="https://learn.kg/demo/ru">' +
    '\n<link rel="alternate" hreflang="en" href="https://learn.kg/demo/en">' +
    '\n<link rel="alternate" hreflang="tr" href="https://learn.kg/demo/tr">' +
    '\n<link rel="alternate" hreflang="x-default" href="https://learn.kg/demo">';
  const base = src.slice(0, dm.index) + "/* ===DATA=== */" + dataJs + "/* ===/DATA=== */" + src.slice(dm.index + dm[0].length);
  const vars = {};
  for (const dl of ["ru", "en", "tr"]) {
    const bareTitle = DEMO_SEO[dl].title.replace(/ · learn\.kg$/, ""); // og/LD/h1 — без суффикса вкладки
    let html = fillPlaceholders(base, true) // общий филлер: одноразовый .replace() пропустил бы второе вхождение
      .replace('<html lang="ru"', '<html lang="' + dl + '"')
      // язык интерфейса по умолчанию = язык страницы (сохранённый выбор важнее — см. currentLang)
      .replace("const CONTENT_READY=", 'const DEMO_LANG="' + dl + '";const CONTENT_READY=')
      .replace(/<title>[^<]*<\/title>/,
        "<title>" + DEMO_SEO[dl].title + "</title>" +
        '\n<meta name="description" content="' + DEMO_SEO[dl].desc + '">' +
        '\n<base href="/">' + // страница глубины 2: относительные пути (api/audio/…) должны бить в корень
        '\n<link rel="canonical" href="https://learn.kg/demo/' + dl + '">' + HREFLANG +
        '\n<meta property="og:title" content="' + bareTitle + '">' +
        '\n<meta property="og:description" content="' + DEMO_SEO[dl].desc + '">' +
        '\n<meta property="og:image" content="https://learn.kg/og.png">' +
        '\n<meta property="og:url" content="https://learn.kg/demo/' + dl + '">' +
        '\n<script type="application/ld+json">' + esc(JSON.stringify({ "@context": "https://schema.org",
          "@graph": [ORG, webPageLd("/demo", dl, bareTitle, DEMO_SEO[dl].desc),
            crumbsLd([[BLOG_UI[dl].home, "/" + dl], [bareTitle, null]])] })) + "</script>" +
        "\n" + YM_SNIPPET)
      .replace('<link rel="manifest" href="/manifest.webmanifest">\n', "")
      .replace('<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n', "")
      // Странице-приложению нужен заголовок для поисковика и скринридера; визуально
      // его нет (у тренажёра своя шапка), поэтому h1 — вне потока, за краем экрана
      .replace("<body>\n", "<body>\n<h1 style=\"position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden\">" +
        bareTitle + "</h1>\n");
    const buf = Buffer.from(html);
    vars[dl] = { buf, gz: zlib.gzipSync(buf, { level: 9 }), br: brotli(buf), etag: etagOf(buf) };
  }
  // Прямая проверка готового артефакта: ни одного слова платных модулей и валидный
  // синтаксис каждого скрипта — иначе публикуем протекающую или сломанную страницу
  const ruTxt = vars.ru.buf.toString("utf8");
  const leaked = ruTxt.match(new RegExp('kgw\\("[^"]*","m(?!0_|' + DEMO_MOD.slice(1) + '_)[0-9]+_[0-9]+"\\)', "g"));
  if (leaked) throw new Error("демо-сборка: утёк контент платных модулей (" + leaked.length + " вхождений)");
  for (const s of ruTxt.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(s[1]);
  try { fs.writeFileSync(path.join(DATA_DIR, "m0_demo.html"), vars.ru.buf); } catch {} // для инспекции; производный файл
  return { vars, audio, mod: DEMO_MOD, content: sb.CONTENT }; // content: полный CONTENT для сборщиков страниц из данных (разговорник)
}
// Метрика для статических публичных страниц. Единственный владелец ключа согласия и ID
// счётчика — витрина (там живут баннер согласия и enableAnalytics); сервер извлекает их
// при старте, ротация правится только в landing.html. Не нашли — не стартуем.
// Ключей ровно один: при ротации (v2→v3) старый читать нельзя, только удалять —
// иначе сервер молча вшил бы в статические страницы заброшенный ключ, и Метрика на них
// не включилась бы никогда. Два разных ключа на чтении = ошибка старта, а не тихий сбой.
const CONSENT_KEYS = [...new Set([...LANDING_HTML.toString("utf8")
  .matchAll(/localStorage\.getItem\("(kga1-consent[\w-]*)"\)/g)].map((m) => m[1]))];
const CONSENT_KEY = CONSENT_KEYS[0];
const YM_ID = (LANDING_HTML.toString("utf8").match(/YM_ID=(\d+)/) || [])[1];
if (CONSENT_KEYS.length !== 1 || !YM_ID)
  throw new Error("landing.html: ожидались ровно один читаемый ключ согласия (kga1-consent*) и YM_ID, найдено: " +
    JSON.stringify(CONSENT_KEYS) + ", " + YM_ID);
const YM_SNIPPET = '<script>try{if(localStorage.getItem("' + CONSENT_KEY + '")==="granted"){var ys=document.createElement("script");ys.async=true;ys.src="https://mc.yandex.ru/metrika/tag.js?id=' + YM_ID + '";document.head.appendChild(ys);window.ym=window.ym||function(){(ym.a=ym.a||[]).push(arguments)};ym.l=Date.now();ym(' + YM_ID + ',"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});}}catch(e){}</script>';
let INSTALL_HTML = Buffer.from(fs.readFileSync(path.join(APP_DIR, "install.html"), "utf8").replace("<!--__YM__-->", YM_SNIPPET));
let INSTALL_GZ = zlib.gzipSync(INSTALL_HTML, { level: 9 });
let INSTALL_BR = brotli(INSTALL_HTML);
const etagOf = (buf) => '"' + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16) + '"';
// Готовый артефакт статической страницы: тело + gzip + brotli + ETag одним объектом
const pack = (html) => { const buf = Buffer.from(html); return { buf, gz: zlib.gzipSync(buf, { level: 9 }), br: brotli(buf), etag: etagOf(buf) }; };
// Виджет чата публичных страниц: словарь ru/en/tr из app/chat-ui.json (паритет ключей —
// отказ старта), скрипт app/chat.js с подстановкой словаря; синтаксис проверяется на старте.
const CHAT_JS = (() => {
  const ui = JSON.parse(fs.readFileSync(path.join(APP_DIR, "chat-ui.json"), "utf8"));
  const ru = Object.keys(ui.ru).sort().join(",");
  for (const l of ["en", "tr"]) if (Object.keys(ui[l] || {}).sort().join(",") !== ru) throw new Error("chat-ui.json: паритет ключей сломан: " + l);
  const src = fs.readFileSync(path.join(APP_DIR, "chat.js"), "utf8").replace("__CHAT_UI__", JSON.stringify(ui).replace(/</g, "\\u003c")).replace("__CHAT_WA__", JSON.stringify(SITE_WA));
  new vm.Script(src);
  return pack(src);
})();
// Иконки PWA + иллюстрации страницы /install: один словарь — одна семантика отдачи (png, сутки)
const STATIC_PNGS = Object.fromEntries(
  ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png",
   "install-and-1.png", "install-and-2.png", "install-ios-1.png", "install-ios-2.png",
   "install-home.png", "install-mac-1.png", "install-mac-2.png", "install-mac-3.png"].map((n) => {
    const buf = fs.readFileSync(path.join(APP_DIR, n));
    return ["/" + n, { buf, etag: etagOf(buf) }];
  }));
// Свои картинки превью статей (app/og/*): читаются один раз, как иконки и слайды уроков.
// Каталога может не быть — общий баннер /og.png остаётся у всех, и это не ошибка.
const OG_FILES = (() => {
  const map = new Map();
  const type = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
  try {
    for (const f of fs.readdirSync(path.join(APP_DIR, "og")).filter((x) => /^[a-z0-9-]{1,60}\.(png|jpg|webp)$/.test(x))) {
      const buf = fs.readFileSync(path.join(APP_DIR, "og", f));
      map.set(f, { buf, etag: etagOf(buf), type: type[f.split(".").pop()] });
    }
  } catch {}
  return map;
})();
for (const v of Object.values(LANDING_VARIANTS)) v.etag = etagOf(v.buf);
const OG_ETAG = etagOf(OG_PNG);
let PRIVACY_ETAG = etagOf(PRIVACY_HTML);
let TERMS_ETAG = etagOf(TERMS_HTML);
const AVATAR_ETAG = etagOf(AVATAR_WEBP);
const MANIFEST_ETAG = etagOf(MANIFEST_JSON);
let INSTALL_ETAG = etagOf(INSTALL_HTML);

/* ---------- Блог: статьи-данные из app/blog/*.json → страницы при старте ----------
   Текст статьи живёт в JSON (по варианту на язык), HTML собирается здесь: разметка
   BlogPosting с полным articleBody нужна и поисковикам, и контентной аналитике
   Метрики — ей не за что зацепиться, пока на сайте нет сущности «статья». */
// Публичные страницы сайта — server/site.js (декомпозиция; см. шапку модуля).
// Хром-примитивы нужны buildDemo ниже, поэтому фаза chrome инициализируется до него.
const CHROME = site.initChrome({ YM_SNIPPET, APP_DIR });
const { BLOG_CSS, BLOG_SECTIONS, BLOG_UI, CHROME_CSS, FIGS, INLINE_LINK_RE, KY_LAT, LANG_SEG_JS, ORG, ORG_ID, SITE_NAV, blogHead, crumbsLd, crumbsNav, ctaCallout, esc, faqLd, faqSection, figSvg, kyToLat, langSeg, plainText, renderP, rwA, rwOf, siteFooter, siteHeader, topBar, validateLocalizedUi, vmScanScripts, webPageLd } = CHROME;
const DEMO = buildDemo();
const PAGES = site.initPages({ ...CHROME, APP_DIR, BLOG_CSS, BLOG_SECTIONS, BLOG_UI, CHROME_CSS, COURSES, COURSE_IDS, DATA_DIR, DEMO, KURS_TEXT, LANDING_DICT, LANG_SEG_JS, ORG, ORG_ID, YM_ID, YM_SNIPPET, appshell, blogHead, crumbsLd, ctaCallout, esc, etagOf, faqLd, faqSection, figSvg, kyToLat, logger, pack, plainText, renderP, siteFooter, siteHeader, topBar, validateLocalizedUi, vmScanScripts, webPageLd });
const { BLOG_PAGES, DOC_CHROME_CSS, HELP, KURS_CSS_EXTRA, KURS_PAGES, LEVEL_TEST, PROBNY_A1, PROBNY_B1, PROBNY_B2, PEREVODCHIK, PUB_AUDIO_JS, PV_CSS_EXTRA, PV_FN, PV_LOGIC, QUIZ_IIFE, QUIZ_LOGIC, RAZGO, RZ_CSS_EXTRA, TEST_CSS_EXTRA, WORD_PAGES, buildBlog, buildHelp, buildKurs, buildQuizPage, buildPerevodchik, buildRazgovornik, buildWords, injectDocChrome, jsonInScript, publicAudio } = PAGES;
PRIVACY_HTML = injectDocChrome(PRIVACY_HTML);
PRIVACY_GZ = zlib.gzipSync(PRIVACY_HTML, { level: 9 });
PRIVACY_BR = brotli(PRIVACY_HTML);
PRIVACY_ETAG = etagOf(PRIVACY_HTML);
TERMS_HTML = injectDocChrome(TERMS_HTML);
TERMS_GZ = zlib.gzipSync(TERMS_HTML, { level: 9 });
TERMS_BR = brotli(TERMS_HTML);
TERMS_ETAG = etagOf(TERMS_HTML);
INSTALL_HTML = injectDocChrome(INSTALL_HTML);
INSTALL_GZ = zlib.gzipSync(INSTALL_HTML, { level: 9 });
INSTALL_BR = brotli(INSTALL_HTML);
INSTALL_ETAG = etagOf(INSTALL_HTML);
// Канон локализованных страниц (CLAUDE.md): base → языковые варианты. Новая страница
// добавляется сюда одной строкой — маршруты /<base>/<lang>, голый /<base> (301 по
// Accept-Language), слеш-дубли и sitemap выводятся из реестра. У витрины base "":
// её голый адрес «/» двулик (вошедший видит приложение) и негоциируется после auth.
// vars — Map, а не объект: ключ приходит из URL, и обычный литерал отдал бы
// «/constructor» с прототипа (truthy-мусор вместо 404 — падение отдачи).
// У блога дата берётся из самой статьи (поле updated), а не из манифеста файлов:
// текст статьи и есть источник, и правка текста сама двигает lastmod.
/* Снятые публичные страницы → их замена (решение владельца 30.10.2026: статьи с материалами
   официального тестирования сняты, их адреса ведут на статью о подготовке без них). */
const MOVED_PAGES = {
  "/blog/voprosy-zhazuu-a1": "/blog/gostestirovanie-kak-podgotovitsya",
  "/blog/kyrgyztest-kak-podgotovitsya": "/blog/gostestirovanie-kak-podgotovitsya",
};
const LOCALIZED_PAGES = Object.assign({
  "": { vars: new Map(Object.entries(LANDING_VARIANTS)), lastmod: "landing.html" },
  // demo собирается из полной сборки страницы при старте; отдельного файла-источника нет,
  // датой lastmod служит дата витрины — обновляется теми же релизами
  "/demo": { vars: new Map(Object.entries(DEMO.vars)), lastmod: "landing.html" },
  // тест уровня: дата — из самого банка вопросов (правка вопросов двигает lastmod)
  "/test": { vars: new Map(Object.entries(LEVEL_TEST.vars)), date: LEVEL_TEST.updated },
  // пробный тест learn.kg B1: тот же билдер, свои данные и своя дата
  "/probny-test-a1": { vars: new Map(Object.entries(PROBNY_A1.vars)), date: PROBNY_A1.updated },
  "/probny-test-b1": { vars: new Map(Object.entries(PROBNY_B1.vars)), date: PROBNY_B1.updated },
  "/probny-test-b2": { vars: new Map(Object.entries(PROBNY_B2.vars)), date: PROBNY_B2.updated },
  // разговорник: дата — из своего JSON (правка секций обязана бампать updated)
  "/razgovornik": { vars: new Map(Object.entries(RAZGO.vars)), date: RAZGO.updated },
  // переводчик частых фраз: фразы выводятся из CONTENT при сборке, дата — из своего JSON
  "/perevodchik": { vars: new Map(Object.entries(PEREVODCHIK.vars)), date: PEREVODCHIK.updated },
  // помощь: человеческая карта сайта, дата — из своего JSON
  "/help": { vars: new Map(Object.entries(HELP.vars)), date: HELP.updated },
}, KURS_PAGES, BLOG_PAGES, WORD_PAGES);
// Слеш-дубли публичных адресов → 301 на канон (иначе опечатка давала 401 с Basic-попапом);
// у локализованной страницы канонизируются и «/demo/», и «/demo/ru/»
const SLASHED = new Set(["/login/", "/landing/", "/metodika/", "/privacy/", "/terms/", "/install/"]);
for (const [base, p] of Object.entries(LOCALIZED_PAGES)) {
  if (base) SLASHED.add(base + "/");
  for (const l of p.vars.keys()) SLASHED.add(base + "/" + l + "/");
}
const SITEMAP_XML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  Object.entries(LOCALIZED_PAGES)
    .flatMap(([base, p]) => [...p.vars.keys()].map((l) => [(base + "/" + l).slice(1), p.date || SEO_DATES[p.lastmod].date]))
    .concat([["privacy", "privacy.html"], ["terms", "terms.html"], ["install", "install.html"]]
      .map(([l, f]) => [l, SEO_DATES[f].date]))
    .map(([l, date]) => "  <url><loc>https://learn.kg/" + l + "</loc><lastmod>" + date + "</lastmod></url>")
    .join("\n") + "\n</urlset>\n";
// /llms.txt (llmstxt.org) — курируемая маркдаун-карта сайта для AI-агентов, строится из
// того же реестра, что и sitemap: новая страница попадает сюда сама. Google Search файл
// игнорирует («Google Search ignores them», ai-optimization-guide, ред. 10.07.2026) —
// это рычаг не ранжирования, а AI-поиска: Perplexity подтвердила поддержку (приоритизация
// страниц), Claude учитывает в retrieval. Строки — по en-варианту (аудитория файла
// читает по-английски), языковые версии агент найдёт по hreflang самих страниц.
const LLMS_TXT = (() => {
  const titleOf = (p) => {
    const v = p.vars.get("en") || p.vars.get([...p.vars.keys()][0]);
    const m = /<title>([^<]*)<\/title>/.exec(v.buf.toString("utf8"));
    return (m ? m[1] : "").replace(/\s*·\s*learn\.kg\s*$/, "").trim();
  };
  const line = ([base, p]) => "- [" + titleOf(p) + "](https://learn.kg" + base + "/en)";
  const entries = Object.entries(LOCALIZED_PAGES);
  const pick = (fn) => entries.filter(fn).map(line).join("\n");
  return "# learn.kg — Learn Kyrgyz\n\n" +
    "> Interactive Kyrgyz language trainer: structured courses A1–B2, phrases voiced by a " +
    "native speaker, spaced repetition, free demo and level test. Every page below also " +
    "exists in Russian (/ru) and Turkish (/tr) — see hreflang on the page.\n\n" +
    "## Start here\n" + pick(([b]) => b === "" || b === "/demo" || b === "/test" || b === "/probny-test-a1" || b === "/probny-test-b1" || b === "/probny-test-b2") + "\n\n" +
    "## Courses\n" + pick(([b]) => b.startsWith("/kurs-")) + "\n\n" +
    "## Free tools\n" + pick(([b]) => b === "/razgovornik" || b === "/perevodchik" || b === "/help") + "\n\n" +
    "## Blog\n" + pick(([b]) => b === "/blog" || b.startsWith("/blog/")) + "\n\n" +
    "## Kyrgyz words\n" + pick(([b]) => b === "/slovo" || b.startsWith("/slovo/")) + "\n\n" +
    "## Legal\n- [Privacy](https://learn.kg/privacy)\n- [Terms](https://learn.kg/terms)\n";
})();
// IndexNow-ключ хоста learn.kg (не секрет — раздаётся публично по требованию протокола)
const INDEXNOW_KEY = "ebfda8721d76613a7f55f4be4bd1f932";
const MAX_BODY = 1024 * 1024;
const COOKIE = "kga1";
const SESSION_DAYS = 30;

// Секрет сессий — файл в /data (переживает редеплой); без /data — эфемерный.
const SECRET = (() => {
  const f = path.join(DATA_DIR, "session-secret");
  try { return fs.readFileSync(f, "utf8").trim(); } catch {}
  const s = crypto.randomBytes(32).toString("hex");
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, s); } catch (e) {
    logger.warn("session", "secret is ephemeral", { error: e.message });
  }
  return s;
})();

/* Миграция оверлея учёток на хэши (ревью 25.09.2026). Cookie подписаны HMAC(секрет,
   login|пароль): с хэшем в файле подпись меняется, и миграция разлогинила бы всех
   учеников разом. Поэтому прежняя подпись сохраняется рядом с хэшем как legacySig и
   принимается до конца срока жизни cookie (legacyUntil); новые cookie подписываются
   уже хэшем, а смена пароля снимает legacySig (mutateUsersExtra).
   Идёт в фоне после старта: scrypt на каждого ученика синхронно держал бы запуск секунды.
   Пока она идёт, открытые пароли работают как наследие. Перед записью файл перечитывается:
   пароль, сменённый через API за время хэширования, не перетирается. */
async function migrateUsersExtra() {
  const readExtra = () => { try { return JSON.parse(fs.readFileSync(USERS_EXTRA_FILE(), "utf8")); } catch { return null; } };
  const extra = readExtra();
  if (!extra || typeof extra !== "object") return;
  const plain = Object.entries(extra).filter(([l, e]) => !RESERVED_LOGINS.has(l) && e &&
    typeof e.password === "string" && e.password && !PASSWORDS.isHashed(e.password));
  if (!plain.length) return;
  const hashed = [];
  for (const [l, e] of plain) hashed.push({ l, from: e.password, password: await PASSWORDS.hashPasswordAsync(e.password),
    legacySig: crypto.createHmac("sha256", SECRET).update(l + "|" + e.password).digest("hex").slice(0, 32) });
  const cur = readExtra();   // от перечитывания до записи await нет — вклиниться некому
  if (!cur || typeof cur !== "object") return;
  const until = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const moved = hashed.filter((h) => cur[h.l] && cur[h.l].password === h.from);
  for (const h of moved) Object.assign(cur[h.l], { password: h.password, legacySig: h.legacySig, legacyUntil: until });
  if (!moved.length) return;
  atomicWrite(USERS_EXTRA_FILE(), JSON.stringify(cur));
  logger.info("users", "passwords hashed", { count: moved.length, skipped: hashed.length - moved.length });
  USERS = buildUsers();
  USERS_STAMP = usersStamp();
}
migrateUsersExtra().catch((err) => logger.error("users", "password migration failed", err, {}));

/* ---------- Ученики: тропа модулей, overrides, приостановка (files-only) ---------- */
const STUDENTS_FILE = () => path.join(DATA_DIR, "students.json");
function readStudents() {
  const out = Object.create(null); // словарь по логину — без прототипа, как USERS
  try { Object.assign(out, JSON.parse(fs.readFileSync(STUDENTS_FILE(), "utf8"))); } catch {}
  return out;
}
/* Триал-доступы: поле trials = { "<курс|модуль>": "YYYY-MM-DD" | null } — доступ до даты
   ВКЛЮЧИТЕЛЬНО (конец дня по Бишкеку, UTC+6, DST нет) либо без ограничения (null).
   Формат аддитивен: у существующих учеников поля нет — их постоянный доступ не меняется,
   а сервер прежней версии незнакомое поле просто не читает (откат безопасен).
   Истёкший триал ведёт себя как отнятый курс: результаты видны, занятия закрыты. */
function validTrials(v) {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  const out = {};
  for (const [id, until] of Object.entries(v)) {
    if (!COURSE_IDS.includes(id) && !MODULES.includes(id)) return null;
    if (until !== null && !(typeof until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(until)
      && !Number.isNaN(Date.parse(until + "T00:00:00Z")))) return null;
    out[id] = until;
  }
  return out;
}
const trialActive = (until) => until == null || Date.now() <= Date.parse(until + "T23:59:59+06:00");
function splitTrials(trials) {
  const t = { courses: [], mods: [], expiredCourses: [], expiredMods: [] };
  for (const [id, until] of Object.entries(trials)) {
    const live = trialActive(until);
    if (COURSE_IDS.includes(id)) (live ? t.courses : t.expiredCourses).push(id);
    else (live ? t.mods : t.expiredMods).push(id);
  }
  return t;
}
function studentInfo(login) {
  const s = readStudents()[login] || {};
  const trials = validTrials(s.trials) || {};
  const tsplit = splitTrials(trials);
  return {
    trials,
    // курс, выданный постоянно, триалом не является: постоянная выдача сильнее
    trialCourses: tsplit.courses.filter((c) => !(validCourses(s.courses) || ["a1"]).includes(c)),
    trialMods: tsplit.mods,
    expiredTrialCourses: tsplit.expiredCourses,
    expiredTrialMods: tsplit.expiredMods,
    // courses — выданные курсы; дефолт при чтении (не миграция файла): все существующие
    // ученики — это ученики A1, и откат сервера на версию без курсов ничего не ломает
    courses: validCourses(s.courses) || ["a1"],
    // formerly — курсы, которые у ученика забрали. Учиться по ним нельзя, но свои
    // результаты он видит: право на просмотр даёт история выдач, а не прогресс
    // (прогресс ученик присылает сам и мог бы вписать себе чужой курс).
    formerly: (Array.isArray(s.formerly) ? validCourses(s.formerly) : null) || [],
    granted: Array.isArray(s.granted) ? s.granted : [],
    locked: Array.isArray(s.locked) ? s.locked : [],
    suspended: !!s.suspended,
    // owner — чей это ученик. Это НЕ `by`: тот меняется при каждой правке (кто последним
    // трогал запись), и группировка по нему «переселяла» бы учеников между преподавателями.
    owner: typeof s.owner === "string" ? s.owner : ""
  };
}
// Учеников, заведённых до появления владельца, приписываем преподавателю, который их и завёл.
// Разовая операция: у кого owner уже есть — не трогаем, поэтому повторный старт безвреден.
const DEFAULT_OWNER = process.env.DEFAULT_OWNER || "altynai";
function backfillOwners() {
  const map = readStudents();
  const touched = [];
  for (const [l, s] of Object.entries(map)) {
    if (!s || typeof s !== "object" || typeof s.owner === "string") continue;
    s.owner = DEFAULT_OWNER;
    touched.push(l);
  }
  if (!touched.length) return;
  try {
    atomicWrite(STUDENTS_FILE(), JSON.stringify(map));
    logger.info("students", "owners backfilled", { owner: DEFAULT_OWNER, count: touched.length });
  } catch (e) {
    logger.error("students", "owner backfill failed", e, { count: touched.length });
  }
}
function readProgress(login) {
  try { return JSON.parse(fs.readFileSync(progressFile(login), "utf8")); } catch { return null; }
}
// Сдан ли модуль КОГДА-ЛИБО (монотонно): v2 everPassed; v1-fallback только для m0.
function everPassedMod(st, mod) {
  if (!st) return false;
  if (st.v === 2) return !!(st.modules && st.modules[mod] && st.modules[mod].test && st.modules[mod].test.everPassed);
  if (st.v === 1 && mod === "m0") return !!(st.test && st.test.passed);
  return false;
}
// Статусы тропы. Приоритет: locked_by_teacher > passed > open > locked;
// отдельно result_only — модули отнятого курса с результатами (дописываются в конце).
// Цепочка авто-открытия идёт по сырому everPassed предыдущего (лок N не отбирает N+1).
// Тропа считается ПО КАЖДОМУ выданному курсу отдельно: у каждого курса свой
// виртуальный «пройденный» перед первым модулем, поэтому сдача последнего модуля
// A1 НЕ открывает первый модуль A2 — барьер между курсами держит выдача курса.
// Модули НИКОГДА не выданных курсов в ответ не попадают; отнятые с результатами —
// попадают со статусом result_only (контракт аддитивен: старый клиент незнакомый
// статус трактует как запертый).
// Курсы, по которым ученик УЧИТСЯ сейчас: постоянные + активные триалы.
// Триал-курс ведёт себя как выданный (та же тропа), пока не истёк.
const effCoursesOf = (si) => si.courses.concat(si.trialCourses);

/* ---------- Аудирование: состояние опции и учёт затрат ---------- */
const STT_LIMIT = 20; // дефолт; персонально — поле sttLimit в students.json
function sttLimitOf(login) {
  if (canEdit(login)) return Infinity; // преподавателю и админу — безлимит
  const v = (readStudents()[login] || {}).sttLimit;
  return (Number.isInteger(v) && v >= 1 && v <= 500) ? v : STT_LIMIT;
}
const STT_URL = process.env.ELEVEN_STT_URL || "https://api.elevenlabs.io/v1/speech-to-text";
// как у TTS: зависший внешний сервис отвечает 502 за таймаут, а не держит запрос ученика
const STT_TIMEOUT_MS = Number(process.env.ELEVEN_STT_TIMEOUT_MS) || 30000;
const STT_USAGE_FILE = () => path.join(DATA_DIR, "stt-usage.json");
function readSttUsage() {
  try { const u = JSON.parse(fs.readFileSync(STT_USAGE_FILE(), "utf8")); return u && u.users ? u : { users: {} }; }
  catch { return { users: {} }; }
}
function sttUsedToday(login) {
  const day = dayKeyOf(new Date().toISOString());
  const rec = (readSttUsage().users[login] || {})[day];
  return rec ? rec.n : 0;
}
function sttTotals(login) {
  const byDay = readSttUsage().users[login] || {};
  const day = dayKeyOf(new Date().toISOString());
  const total = { n: 0, sec: 0, chars: 0 };
  for (const r of Object.values(byDay)) { total.n += r.n; total.sec += r.sec; total.chars += r.chars; }
  total.sec = Math.round(total.sec * 10) / 10;
  return { today: (byDay[day] || { n: 0, sec: 0 }).n, total };
}
// Почему аудирование (не)доступно — называет сервер, клиент только показывает.
// trial сильнее off: триальному опцию не включить вовсе.
function sttState(login) {
  if (canEdit(login)) return { on: true, why: null };
  const si = studentInfo(login);
  if (!(si.courses || []).length) return { on: false, why: "trial" }; // чисто триальный: ни одного постоянного курса
  const raw = readStudents()[login];
  if (!raw || !raw.stt) return { on: false, why: "off" };
  return { on: true, why: null };
}
// Снимок остатка квоты аккаунта ElevenLabs после распознавания: реальный расход
// в «токенах» виден преподавателю без арифметики по нашим полям. Best effort.
function snapshotSttRemaining(key) {
  fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } })
    .then((r) => r.json())
    .then((d) => {
      const sub = d && d.subscription;
      if (!sub || typeof sub.character_count !== "number") return;
      const u = readSttUsage();
      u.account = { used: sub.character_count, limit: sub.character_limit, at: new Date().toISOString() };
      atomicWrite(STT_USAGE_FILE(), JSON.stringify(u));
    })
    .catch(() => {});
}
function moduleStatuses(login) {
  if (canEdit(login)) return MODULES.map((id) => ({ id, status: "open" }));
  const si = studentInfo(login);
  const st = readProgress(login);
  const out = [];
  for (const cid of effCoursesOf(si)) {
    let prevPassed = true; // виртуальный «пройденный» перед первым модулем курса
    for (const id of COURSES[cid].modules) {
      const passed = everPassedMod(st, id);
      let status;
      if (si.locked.includes(id)) status = "locked_by_teacher";
      else if (passed) status = "passed";
      else if (prevPassed || si.granted.includes(id)) status = "open";
      else status = "locked";
      out.push({ id, status });
      prevPassed = passed;
    }
  }
  // Триал-модули вне выданных курсов: открыты сразу (у одиночного модуля нет тропы),
  // ручное закрытие преподавателем и сдача работают как обычно.
  const covered = new Set(out.map((x) => x.id));
  for (const id of si.trialMods) {
    if (covered.has(id)) continue;
    covered.add(id);
    out.push({ id, status: si.locked.includes(id) ? "locked_by_teacher" : everPassedMod(st, id) ? "passed" : "open" });
  }
  // Модули отнятого курса — с собственным статусом: результаты по ним видны, занятия
  // закрыты. Прежде их просто не было в списке, и клиент отличал «курс отняли» от
  // «ещё не дошёл» пересечением списков — сервер знает ответ и обязан его называть.
  // Старый закэшированный клиент незнакомого статуса не знает и трактует как запертый.
  for (const cid of resultCourses(si, st)) for (const id of COURSES[cid].modules)
    if (!covered.has(id)) { covered.add(id); out.push({ id, status: "result_only" }); }
  // истёкший триал-модуль с прогрессом — тоже result_only (как отнятый курс), без прогресса — исчезает
  for (const id of expiredTrialModsWithProgress(si, st))
    if (!covered.has(id)) { covered.add(id); out.push({ id, status: "result_only" }); }
  return out;
}
function expiredTrialModsWithProgress(si, st) {
  return si.expiredTrialMods.filter((mid) => {
    const b = st && st.modules && st.modules[mid];
    return everPassedMod(st, mid) || !!(b && b.vocab && Object.keys(b.vocab).length);
  });
}

/* ---------- Страница приложения под пользователя ----------
   Ученик получает данные только своих курсов: прежде каждому вошедшему уезжали все 24
   модуля, то есть материал курса, за который он не платил (около 40% файла), лежал
   в исходнике страницы. Вариант собирается лениво по набору модулей и кэшируется —
   наборов в жизни единицы, а с курсами B1–C2 перечислять комбинации заранее нельзя.
   Модули отнятых курсов (formerly) входят в вариант, чтобы ученик видел свои
   результаты; учиться по ним нельзя — /api/me отдаёт их со статусом result_only,
   и клиент запирает занятия по этому статусу. */
function resultCourses(si, st) {
  // истёкший триал-курс ведёт себя как отнятый: право на просмотр даёт история выдач
  const gone = si.formerly.concat(si.expiredTrialCourses.filter((c) => !si.formerly.includes(c)));
  if (!gone.length || !st || !st.modules) return [];
  return gone.filter((cid) => COURSES[cid].modules.some((mid) => {
    const b = st.modules[mid];
    return everPassedMod(st, mid) || !!(b && b.vocab && Object.keys(b.vocab).length);
  }));
}
const SHELL_VARIANTS = new Map();
function appShellFor(login) {
  if (canEdit(login)) return shellVariant("__all__", null);
  const si = studentInfo(login);
  const st = readProgress(login);
  const res = resultCourses(si, st);
  const study = modulesOfCourses(effCoursesOf(si)).concat(si.trialMods.filter((m) => !modulesOfCourses(effCoursesOf(si)).includes(m)));
  const resMods = modulesOfCourses(res).concat(expiredTrialModsWithProgress(si, st));
  // Ключ варианта включает сами триалы С ДАТАМИ: истечение срока меняет ключ,
  // и ученик получает пересобранный вариант без ожидания рестарта.
  const tKey = Object.entries(si.trials).sort()
    .map(([id, u]) => id + ":" + (u || "") + ":" + (trialActive(u) ? 1 : 0)).join(",");
  const key = si.courses.join("+") + (res.length ? "|r:" + res.join("+") : "")
    + (tKey ? "|t:" + tKey : "") + (resMods.length ? "|rm:" + resMods.join("+") : "");
  return shellVariant(key, study, resMods);
}
function shellVariant(key, mods, resultMods) {
  let v = SHELL_VARIANTS.get(key);
  if (!v) { v = pack(fillPlaceholders(appshell.buildAppHtml(mods, resultMods))); SHELL_VARIANTS.set(key, v); }
  return v;
}
// Модули, доступные ученику по API. Вычитка, правки и аудио были открыты любому
// вошедшему для любого модуля — контент чужого курса вынимался одним curl.
// Доноры alias-слов обязательны: клиент легитимно тянет их для reuse-карточек,
// m0 — тоже (в его бакете живёт озвучка диалогов всех модулей).
function allowedMods(login) {
  if (canEdit(login)) return null; // преподаватель и админ видят весь каталог
  const si = studentInfo(login);
  // живой API открыт тому, по чему ученик УЧИТСЯ: постоянные курсы + активные триалы
  // (курсы и одиночные модули); истёкшие — нет, как и отнятые курсы
  const mods = new Set(modulesOfCourses(effCoursesOf(si)));
  for (const m of si.trialMods) mods.add(m);
  return new Set(appshell.dataModsFor(mods));
}
const modAllowed = (login, mod) => { const a = allowedMods(login); return !a || a.has(mod); };

/* Лимит перебора паролей на форме входа: пароли лежат плейнтекстом, а призом теперь может быть
   учётка преподавателя, поэтому неудачи считаем по адресу. Счётчик — в памяти процесса (как USERS):
   переживать рестарт ему незачем. Basic auth сознательно не ограничиваем — им ходят скрипты. */
function makeRateLimiter(windowMs, max) {
  const hits = new Map(); // key -> { n, until }
  return {
    blocked(key) {
      const e = hits.get(key);
      if (!e) return false;
      if (Date.now() > e.until) { hits.delete(key); return false; }
      return e.n >= max;
    },
    note(key, count) {
      const now = Date.now();
      const e = hits.get(key);
      if (!e || now > e.until) hits.set(key, { n: count, until: now + windowMs });
      else e.n += count;
      if (hits.size > 5000) for (const [k, v] of hits) if (now > v.until) hits.delete(k);
    },
    reset(key) { hits.delete(key); },
  };
}
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 20;
const loginLimiter = makeRateLimiter(LOGIN_WINDOW_MS, LOGIN_MAX_FAILS);
const basicLimiter = makeRateLimiter(LOGIN_WINDOW_MS, LOGIN_MAX_FAILS);   // тот же порог для заголовка Basic
// Язык редиректа по Accept-Language: ru/tr — свой вариант, любой другой или пусто — en.
// Канон: x-default в hreflang указывает на негоциирующий корень (/ и /demo).
function pickLang(req) {
  // Раньше языка браузера — сохранённый выбор человека: клиент кладёт его в куку
  // kga1-lang (localStorage серверу не виден), иначе голый адрес уводил бы на вариант,
  // с которого человек уже ушёл, — «/en с русским интерфейсом».
  const saved = parseCookies(req)["kga1-lang"];
  if (saved === "ru" || saved === "en" || saved === "tr") return saved;
  const m = String(req.headers["accept-language"] || "").toLowerCase().match(/^\s*([a-z]{2})/);
  const l = m ? m[1] : "";
  if (l === "ky") return "ru"; // кыргызский — на русскую версию: официальное двуязычие
  return l === "ru" || l === "tr" ? l : "en";
}
// Адрес клиента — ПОСЛЕДНИЙ элемент X-Forwarded-For: его дописывает наш прокси (Traefik),
// а всё левее присылает сам клиент. Первый элемент можно менять на каждом запросе, и лимиты
// входа и антиспам чата по адресу обходились подменой заголовка (ревью 25.09.2026).
function clientIp(req) {
  const hops = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return hops[hops.length - 1] || req.socket.remoteAddress || "?";
}

const { timingEq } = PASSWORDS;   // сравнение за постоянное время — одно на сервер
// Подпись включает текущий пароль: смена пароля или пересоздание логина после удаления
// отзывает все ранее выданные cookie этого логина (иначе они молча живут до 30 дней).
function sign(login) {
  const pass = (USERS[login] && USERS[login].password) || "";
  return login + "." + crypto.createHmac("sha256", SECRET).update(login + "|" + pass).digest("hex").slice(0, 32);
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function sessionUser(req) {
  const c = parseCookies(req)[COOKIE];
  if (!c) return null;
  const i = c.lastIndexOf(".");
  if (i <= 0) return null;
  // Битый процент-эскейп в чужой cookie — обычный мусор из интернета, а не повод уронить процесс:
  // decodeURIComponent бросает URIError синхронно, и без catch он валит весь сервер.
  let login;
  try { login = decodeURIComponent(c.slice(0, i)); } catch { return null; }
  if (!Object.prototype.hasOwnProperty.call(USERS, login)) return null;
  if (timingEq(c, sign(login))) return login;
  // cookie, выданная до хэшей паролей, — до своего срока (см. migrateUsersExtra)
  const u = USERS[login];
  if (u.legacySig && Date.now() < Date.parse(u.legacyUntil) && timingEq(c, login + "." + u.legacySig)) return login;
  return null;
}
function basicUser(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return null;
  let dec;
  try { dec = Buffer.from(h.slice(6), "base64").toString("utf8"); } catch { return null; }
  const i = dec.indexOf(":");
  if (i < 0) return null;
  const login = dec.slice(0, i), pass = dec.slice(i + 1);
  const ip = clientIp(req);
  // неизвестный логин проверяется по фиктивному хэшу той же цены: по времени ответа
  // нельзя узнать, есть ли такой логин (иначе «нет логина» приходил мгновенно, без scrypt)
  const known = Object.prototype.hasOwnProperty.call(USERS, login);
  const ok = PASSWORDS.verifyPassword(known ? USERS[login].password : PASSWORDS.DUMMY_HASH, pass) && known;
  // перебор через Basic ограничен по адресу, как форма входа (ревью 25.09.2026); блокировка
  // отвечает 429 до разбора учётки — см. гейт перед currentUser
  if (!ok) { basicLimiter.note(ip, 1); return null; }
  return login;
}
function currentUser(req) { return sessionUser(req) || basicUser(req); }
function cookieFlags(req) {
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https");
  return "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + SESSION_DAYS * 86400 + (secure ? "; Secure" : "");
}
function safeLoginSlug(login) { return login.replace(/[^a-zA-Z0-9_.-]/g, "_"); }
function progressFile(login) {
  return path.join(DATA_DIR, "progress", safeLoginSlug(login) + ".json");
}
/* Слияние прогресса при записи. Клиент присылает состояние ЦЕЛИКОМ, но оно может быть
   неполным: другое устройство, вкладка со старым снимком, гонка с pullState (он не
   применяет серверное, если локальное свежее). Прежде файл переписывался как есть, и
   отметка о сдаче исчезала: ученик возвращался в m0 повторить слова, m1 переставал быть
   passed и требовал теста заново, а m2 запирался (жалоба преподавателя 21.08.2026).
   Правило: достижения не убывают. Факт сдачи (everPassed) и выученные слова остаются,
   всё остальное — как прислал клиент: только он знает актуальные интервалы SRS.
   Уменьшение возможно единственным законным путём — архивированием файла при передаче
   логина другому человеку (archiveProgress), а туда эта функция не вмешивается. */
// Слияние записи мини-теста модуля (устаревшая копия второго устройства не должна стирать
// сдачу — потеря 16/20 у ученицы 12.09.2026): попытки — объединение (ключ дата+счёт+ошибки,
// без дублей, хронологически, хвост 20), everPassed монотонен. lastAttempt/consecutiveFails
// берутся у той стороны, чья последняя попытка замыкает объединённую историю: даты попыток
// без времени, и при равной дате порядок «сначала серверные, потом присланные» сам отдаёт
// победу присланной, кроме случая, когда присланный список — усечённая часть серверного.
// Возвращает {test, changed}: changed — серверная копия что-то добавила к присланной.
function mergeTest(pt, nt) {
  if (!pt || typeof pt !== "object") return { test: nt || null, changed: false };
  if (!nt || typeof nt !== "object") return { test: pt, changed: true };
  const key = (a) => String(a.date || "") + "|" + a.score + "|" + (Array.isArray(a.wrong) ? a.wrong.join(",") : "");
  const pa = (pt.attempts || []).filter((a) => a && typeof a === "object");
  const na = (nt.attempts || []).filter((a) => a && typeof a === "object");
  const seen = new Set(); const attempts = [];
  for (const a of pa.concat(na)) { const k = key(a); if (seen.has(k)) continue; seen.add(k); attempts.push(a); }
  attempts.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const lastKey = attempts.length ? key(attempts[attempts.length - 1]) : null;
  const pl = pt.lastAttempt || null, nl = nt.lastAttempt || null;
  const src = (nl && key(nl) === lastKey) ? nt : (pl && key(pl) === lastKey) ? pt : (nl ? nt : pt);
  const everPassed = !!(pt.everPassed || nt.everPassed);
  const test = Object.assign({}, pt, nt, {
    everPassed, lastAttempt: src.lastAttempt || null, consecutiveFails: src.consecutiveFails || 0, attempts: attempts.slice(-20),
  });
  const changed = src !== nt || attempts.length !== na.length || everPassed !== !!nt.everPassed;
  return { test, changed };
}
// Форма v2-состояния прогресса — одна проверка для PUT ученика и для админского ремонта.
const isV2State = (st) => !!(st && typeof st === "object" && st.v === 2 && typeof st.modules === "object" && st.modules !== null);
function mergeProgress(prev, next) {
  if (!prev || prev.v !== 2 || !next || next.v !== 2 || !next.modules) return next;
  const modules = Object.assign({}, next.modules);
  let restored = false;   // что-то вернули из серверной копии — пометим свежим временем,
                          // иначе устройство-источник неполной отправки так и останется без данных
  for (const [mid, pm] of Object.entries(prev.modules || {})) {
    if (!pm || typeof pm !== "object") continue;
    const nm = modules[mid];
    if (!nm) { modules[mid] = pm; restored = true; continue; }   // модуль вовсе пропал из присланного
    // Осознанный сброс модуля учеником (кнопка в настройках) — единственный способ
    // уменьшить прогресс. Он помечен отметкой времени: пока она новее прошлой,
    // состояние принимается как есть. Отметка сохраняется, поэтому повторные
    // отправки того же сброса уже не отключают защиту.
    const prevReset = pm.resetAt || null;
    if (nm.reset && (!prevReset || nm.reset > prevReset)) {
      // метка — с часов устройства; из будущего она запирала бы все следующие сбросы
      const nowIso = new Date().toISOString();
      modules[mid] = Object.assign({}, nm, { resetAt: nm.reset > nowIso ? nowIso : nm.reset });
      continue;
    }
    // Устройство, не видевшее сброса (в его копии модуля нет ни reset, ни resetAt не младше
    // серверного), прислало модуль из времени ДО сброса: взять его за основу — значит молча
    // откатить сброс (ревью 25.09.2026). Модуль остаётся серверным, устройство заберёт копию.
    const seen = [nm.reset, nm.resetAt].filter(Boolean).sort().pop() || "";
    if (prevReset && seen < prevReset) { modules[mid] = pm; restored = true; continue; }
    const merged = Object.assign({}, nm, prevReset ? { resetAt: prevReset } : {});
    if (pm.test || nm.test) {   // история мини-тестов не убывает — см. mergeTest
      const mt = mergeTest(pm.test, nm.test);
      if (mt.changed) restored = true;
      merged.test = mt.test;
    }
    const nv = Object.assign({}, nm.vocab || {});
    for (const [wid, box] of Object.entries(pm.vocab || {})) if (!(wid in nv)) { nv[wid] = box; restored = true; }
    merged.vocab = nv;
    modules[mid] = merged;
  }
  const out = Object.assign({}, next, { modules });
  // История пробного экзамена живёт на верхнем уровне (ST.exam): устройство, где
  // экзамен не открывали, прислало бы состояние без него и затёрло попытки —
  // возвращаем серверную копию (то же правило «прогресс не убывает», что и для vocab)
  if (prev.exam && !out.exam) { out.exam = prev.exam; restored = true; }
  // Попытки двух устройств (одно было офлайн) сливаются, а не заменяются: иначе попытка
  // второго устройства пропадала целиком (ревью PR #237). Ключ дубля — все поля попытки.
  else if (prev.exam && typeof prev.exam === "object" && out.exam && typeof out.exam === "object") {
    const key = (a) => JSON.stringify([a.date, a.course, a.subs, a.pct, a.right, a.total]);
    const pa = Array.isArray(prev.exam.attempts) ? prev.exam.attempts : [], na = Array.isArray(out.exam.attempts) ? out.exam.attempts : [];
    const seen = new Set(na.map(key)), lost = pa.filter((a) => a && !seen.has(key(a)));
    if (lost.length) {
      const attempts = na.concat(lost).sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).slice(-20);
      const pl = prev.exam.last, nl = out.exam.last;
      const last = pl && (!nl || String(pl.date || "") > String(nl.date || "")) ? pl : nl;
      out.exam = Object.assign({}, out.exam, { attempts, last });
      restored = true;
    }
  }
  if (restored) out.updatedAt = new Date().toISOString();   // клиент подтянет восстановленное
  return out;
}
// Логин освобождается и достаётся другому человеку — прогресс прежнего владельца не удаляем
// (вдруг удаление было ошибкой), но и не отдаём: уводим в .bak рядом.
function archiveProgress(login) {
  const f = progressFile(login);
  if (!fs.existsSync(f)) return;
  const bak = f + "." + new Date().toISOString().replace(/[:.]/g, "-") + ".bak";
  try { fs.renameSync(f, bak); logger.info("progress", "archived on login reuse", { login, file: path.basename(bak) }); }
  catch (e) { logger.warn("progress", "archive failed", { login, error: e.message }); }
}

/* ---------- Журнал занятий: каждый ответ ученика, JSONL по месяцам + агрегат ----------
   /data/events/<логин>/<YYYY-MM>.jsonl — append-only, одна строка = одно событие.
   atomicWrite (tmp+rename) для этого не годится: он переписывает файл целиком, а тут нужен
   дешёвый append. Безопасно при одном процессе (см. CREDENTIALS.md: деплой на одну реплику) —
   Node однопоточен, fs.appendFileSync = open(O_APPEND)+write+close без чужого await между ними.
   agg.json — инкрементальный кэш (не источник правды): пересобирается из jsonl той же foldEvent,
   что обновляет его на лету, поэтому пересборка и обычное обновление не могут разойтись. */
const EVENTS_DIR = () => path.join(DATA_DIR, "events");
function eventsLoginDir(login) { return path.join(EVENTS_DIR(), safeLoginSlug(login)); }
function eventsFile(login, yyyymm) { return path.join(eventsLoginDir(login), yyyymm + ".jsonl"); }
function eventsAggFile(login) { return path.join(eventsLoginDir(login), "agg.json"); }
const EV_MAX_BATCH = 200;
const EV_MAX_STR = 200;
const EV_MAX_MS = 600000; // 10 минут — дольше уже не «раздумье», а «ушёл заваривать чай»
const EV_MAX_DT_MS = 7 * 86400000; // старше недели в прошлом не доверяем клиентской задержке отправки
const EV_MAX_FILE_BYTES = Number(process.env.EV_MAX_FILE_MB || 32) * 1024 * 1024;
const EV_MAX_PER_MIN = 900;
const yyyymmOf = (ts) => ts.slice(0, 7); // "2026-08-04T..." → "2026-08"
function clampInt(v, lo, hi, dflt) {
  // Number(null) === 0 (конечное число!) — отсутствующий query-параметр (URLSearchParams.get
  // отдаёт null, не undefined) иначе тихо становился бы нулём вместо дефолта: limit=200
  // превращался бы в limit=1, и лента отдавала бы одно последнее событие вместо ленты.
  if (v == null || v === "") return dflt;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
function evStr(v) { return typeof v === "string" ? v.slice(0, EV_MAX_STR) : undefined; }
// Белый список полей на тип — а не blacklist: иначе «валидное» событие можно раздуть
// произвольным мусорным ключом внутри известного типа.
const EV_FIELDS = {
  "session.start": ["lang", "w", "h", "mob"], "session.end": ["ms"],
  "cards.start": ["mod", "topic", "queue", "practice"], "cards.end": ["mod", "seen", "ok", "ms"],
  "card.show": ["mod", "cardId", "phase", "box0"],
  "card.answer": ["mod", "cardId", "phase", "ok", "ms", "in", "box0", "box1", "try", "hint", "kbd"],
  "card.reveal": ["mod", "cardId", "ms"], "card.mark": ["mod", "cardId", "on"],
  // Решения ученика о слове: «уже знаю» (закрепил без ввода) и «отложить» (убрал из колод).
  // Хранятся как обычные события — попадают и в ленту занятия, и в сводку карточки ученика.
  "card.know": ["mod", "cardId", "box0"], "card.skip": ["mod", "cardId", "on"],
  "drill.start": ["mod", "topic", "n"], "drill.answer": ["mod", "g", "ok", "ms", "pick"],
  "drill.end": ["mod", "score", "total", "ms"],
  "test.start": ["mod"], "test.answer": ["mod", "q", "ref", "ok", "ms", "in", "i", "kbd"],
  "test.finish": ["mod", "score", "passed", "wrong", "right", "ms"],
  "audio.play": ["mod", "cardId", "ctx"],
  "b1.tr": ["mod", "cardId", "kind"], "b1.gloss": ["mod", "w"], "app.update": ["from", "to"], "app.install": ["how", "outcome"],
  // Интерфейсная аналитика: где ученикам неудобно. tab/k/val — короткие техстроки,
  // msg ошибки режется evStr'ом — стек не шлём вовсе (туда может попасть что угодно).
  "ui.nav": ["tab"], "ui.setting": ["k", "val"], "ui.error": ["msg", "src", "line"],
  /* Экзаменационная неделя: попытка, тренажёр формата по субтестам, работа ученика
     и балл преподавателя. Поля — те, что читает лента (см. renderFeedBody). */
  "exam.start": ["mod", "subs"],
  "exam.sub": ["mod", "sub", "n", "limitMin"],
  "exam.answer": ["mod", "sub", "ref", "q", "ok", "i"],
  "exam.finish": ["mod", "sub", "subs", "pct", "right", "total", "byTime", "sec"],
  "exam.train": ["mod", "sub"],
  "exam.train_done": ["mod", "sub", "subs", "pct", "right", "total", "byTime", "sec"],
  "exam.submit": ["mod", "sub", "sentences", "sec", "stt"],
  "exam.grade": ["to", "id", "score"],   // адресат — «to»: поле login перезаписывается (см. инвариант ниже)
  // Аудирование, уроки, майлстоуны, видео, обращение к преподавателю
  "stt.result": ["id", "ky", "mod", "score", "block", "sound", "ending"],
  "lesson.theme": ["mod", "lesson", "theme", "seg", "total"],
  "lesson.finish": ["mod", "lesson", "themes"],
  "badge.earn": ["badge", "mod"],
  "video.play": ["file"], "video.tab": ["tab"],
  "video.chapter": ["file", "theme"], "video.share": ["ch", "file"],
  "wa.click": ["from"],
  // Чат с преподавателем. ИНВАРИАНТ: поле с именем «login» в любой схеме сервер перезаписывает
  // логином владельца журнала (appendEvents: ev.login = login) — адресат ответа зовётся «to».
  "chat.send": ["from"], "chat.reply": ["to"]
};
/* Род значения по имени поля: новый раздел дописывает имя в нужный набор, а не
   удлиняет цепочку сравнений внутри sanitizeEvent (она исполняется на каждое поле
   каждого события батча — до 200 событий). Поля со своей логикой (mod, cardId/ref,
   ms, wrong) разобраны отдельно ниже и сюда не входят. */
const EV_NUM = new Set(["seen", "n", "i", "score", "total", "box0", "box1", "try", "w", "h", "line", "kbd", "queue",
  "pct", "right", "sec", "sentences", "subs", "limitMin", "seg", "themes"]);
const EV_BOOL = new Set(["ok", "passed", "on", "hint", "mob", "byTime", "stt", "auto", "practice"]);
const EV_STR = new Set(["in", "topic", "phase", "q", "g", "pick", "ctx", "lang", "tab", "k", "val", "msg", "src",
  "sub", "lesson", "theme", "badge", "block", "sound", "ending", "ky", "id", "file", "ch", "from", "kind", "to",
  "how", "outcome"]);
/* Типы событий — ровно ключи схемы EV_FIELDS: два рукописных списка расходились
   молча (тип без схемы ронял запись всего батча 500-й ошибкой, 22.08.2026).
   Один источник — одно место правки при новом разделе. */
const EV_TYPES = new Set(Object.keys(EV_FIELDS));
// Инвариант схемы проверяется при старте, а не комментарием: поле «login» appendEvents
// перезаписывает владельцем журнала, и адресат в нём пропадал (exam.grade, ревью 25.09.2026)
for (const [t, f] of Object.entries(EV_FIELDS))
  if (f.includes("login")) throw new Error("EV_FIELDS." + t + ": поле login перезаписывается владельцем журнала — назовите адресата «to»");
// Валидация одной строки события пришедшего батча. Возвращает объект для записи или null
// (строка отбрасывается, батч не падает целиком — один кривой элемент не должен топить остальные).
function sanitizeEvent(raw, ctx) {
  if (!raw || typeof raw !== "object") return null;
  const type = typeof raw.type === "string" ? raw.type : "";
  if (!EV_TYPES.has(type)) return null;
  const seq = clampInt(raw.seq, 1, 1e7, null);
  if (seq == null) return null;
  const dt = clampInt(raw.dt, 0, EV_MAX_DT_MS, 0);
  const out = { v: 1, seq, type };
  // тип без схемы полей роняет запись всего батча (TypeError в колбэке): пишем
  // событие голым, а расхождение списков ловит гейт tests/events.test.js
  for (const f of (EV_FIELDS[type] || [])) {
    const val = raw[f];
    if (val == null) continue;
    // mod/cardId/ref — не «пропустить поле», а «событие целиком мусорное»: тихо потерянный mod
    // сделал бы событие невидимым в разбивке по модулям, не попав при этом в счётчик dropped.
    if (f === "mod") { if (!MODULES.includes(val)) return null; out.mod = val; continue; }
    if (f === "cardId" || f === "ref") {
      if (typeof val !== "string" || !(ID_RE.test(val) || val === "h_row" || val === "h_affix")) return null;
      out[f] = val;
      continue;
    }
    if (f === "ms") { out.ms = clampInt(val, 0, EV_MAX_MS, 0); continue; }
    if (EV_NUM.has(f)) { out[f] = clampInt(val, 0, 4294967295, 0); continue; }
    if (EV_BOOL.has(f)) { out[f] = !!val; continue; }
    if (f === "wrong") { out.wrong = Array.isArray(val) ? val.slice(0, 20).map((x) => evStr(String(x))) : undefined; continue; }
    if (EV_STR.has(f)) { const s = evStr(String(val)); if (s) out[f] = s; continue; }
  }
  out.ts = ctx.ts;
  // Задержавшийся батч (оффлайн-ретрай, sendBeacon) уезжает в файл прошлого месяца, если ts
  // туда и указывает; событие старше предыдущего месяца пишем в ТЕКУЩИЙ с пометкой approx —
  // иначе чтение по диапазону дат должно было бы сканировать произвольно далёкое прошлое.
  out.file = ctx.file;
  return out;
}
// Одна строка = событие → приём ts (когда сервер получил батч) минус клиентская дельта dt
// (сколько времени событие ждало отправки, по performance.now() — монотонной, в отличие
// от часов). Абсолютное время всегда ставит сервер: клиентским меткам не доверяем.
function resolveEventTs(rx, raw) {
  const dt = clampInt(raw.dt, 0, EV_MAX_DT_MS, 0);
  const ts = new Date(rx - dt).toISOString();
  const rxMonth = yyyymmOf(new Date(rx).toISOString());
  const month = yyyymmOf(ts);
  if (month === rxMonth) return { ts, file: rxMonth, approx: false };
  const rxDate = new Date(rx);
  const prevMonth = yyyymmOf(new Date(Date.UTC(rxDate.getUTCFullYear(), rxDate.getUTCMonth() - 1, 1)).toISOString());
  if (month === prevMonth) return { ts, file: month, approx: false };
  return { ts, file: rxMonth, approx: true }; // старше предыдущего месяца — складываем в текущий
}
const eventsLimiter = makeRateLimiter(60000, EV_MAX_PER_MIN);
// экзамен-записи: не больше 12 загрузок в минуту на ученика (спам-защита) и не
// больше EXAM_AUDIO_KEEP свежих файлов на диске (ротация) — том не забить
const examVoiceLimiter = makeRateLimiter(60000, 12);
const EXAM_AUDIO_KEEP = 8;
function readAgg(login) {
  try { return JSON.parse(fs.readFileSync(eventsAggFile(login), "utf8")); } catch { return null; }
}
// Пересборка — по месяцам, не всей историей разом: при «хранить всё» через годы полная
// пересборка блокировала бы однопоточный сервер на десятки секунд, а бамп версии агрегата
// при деплое устроил бы такую пересборку сразу у всех учеников одновременно.
const AGG_V = 3; // v3: tests[].right — разбор попытки показывает и верные ответы
function freshAgg(login) {
  return { v: AGG_V, login, updatedAt: null, lastSeen: null,
    days: {}, mods: {}, weak: {}, decide: {}, tests: [], sessions: {}, seenSeq: {}, totals: { ans: 0, ok: 0, ms: 0 } };
}
// Ключ дня — по времени Бишкека (UTC+6), не UTC: иначе занятие в 23:30 по местному
// уезжает «на завтра» и рвёт стрик самым дисциплинированным вечерним ученикам.
const TZ_OFFSET_MS = 6 * 3600000;
// Серия дней по агрегату журнала: сегодня без занятий серию не рвёт (общая для
// overview и /api/me — две копии этого правила уже однажды разъезжались на клиенте)
function streakOfAgg(days, today) {
  const daySet = new Set(Object.keys(days).filter((k) => days[k].ans > 0));
  let streak = 0, cursor = new Date(today + "T00:00:00Z");
  while (true) {
    const k = cursor.toISOString().slice(0, 10);
    if (daySet.has(k)) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
    else if (k === today) { cursor.setUTCDate(cursor.getUTCDate() - 1); continue; }
    else break;
  }
  return streak;
}
function dayKeyOf(iso) {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}
const EV_IDLE_GAP_MS = 120000; // дольше — «отошёл», а не «думал»; в занятость не засчитываем
function foldEvent(agg, ev) {
  const day = dayKeyOf(ev.ts);
  agg.days[day] = agg.days[day] || { ms: 0, ans: 0, ok: 0 };
  const sid = ev.sid || "-";
  let s = agg.sessions[sid];
  if (!s) { s = agg.sessions[sid] = { start: ev.ts, end: ev.ts, ms: 0, mods: [], ans: 0, ok: 0, lastSeq: 0 }; }
  if (s.lastTs) {
    const gap = new Date(ev.ts) - new Date(s.lastTs);
    if (gap > 0 && gap <= EV_IDLE_GAP_MS) { s.ms += gap; agg.days[day].ms += gap; agg.totals.ms += gap; }
  }
  s.lastTs = ev.ts; s.end = ev.ts; s.lastSeq = Math.max(s.lastSeq, ev.seq);
  if (ev.mod && !s.mods.includes(ev.mod)) s.mods.push(ev.mod);
  const isAnswer = ev.type === "card.answer" || ev.type === "test.answer" || ev.type === "drill.answer";
  if (isAnswer) {
    agg.days[day].ans++; s.ans++;
    agg.totals.ans++;
    const kind = ev.type === "card.answer" ? (ev.phase === "rec" ? "rec" : "type") : ev.type === "test.answer" ? "test" : "drill";
    agg.mods[ev.mod] = agg.mods[ev.mod] || { ans: 0, ok: 0, ms: ev.mod ? 0 : undefined, by: {} };
    agg.mods[ev.mod].ans++; agg.mods[ev.mod].by[kind] = agg.mods[ev.mod].by[kind] || { n: 0, ok: 0 };
    agg.mods[ev.mod].by[kind].n++;
    if (ev.ok) { agg.days[day].ok++; s.ok++; agg.totals.ok++; agg.mods[ev.mod].ok++; agg.mods[ev.mod].by[kind].ok++; }
    else {
      const ref = ev.cardId || ev.ref;
      if (ref) {
        const w = agg.weak[ref] = agg.weak[ref] || { mod: ev.mod, wrong: 0, seen: 0, ins: [] };
        w.wrong++; w.seen++;
        if (ev.in) { w.ins.unshift(ev.in); w.ins = w.ins.slice(0, 3); }
      }
    }
  } else if (ev.type === "card.know" || ev.type === "card.skip") {
    // Текущее решение ученика по слову, а не счётчик нажатий: «отложил, потом вернул»
    // не должно оставлять слово в отчёте отложенным. Возврат снимает запись.
    const ref = ev.cardId;
    if (ref) {
      // Поле аддитивное: у агрегатов, собранных до появления решений, его просто нет —
      // доращиваем на месте, чтобы не гонять пересборку журнала у всех учеников разом.
      const dec = agg.decide || (agg.decide = {});
      if (ev.type === "card.know") dec[ref] = { mod: ev.mod, kind: "know", at: ev.ts };
      else if (ev.on) dec[ref] = { mod: ev.mod, kind: "skip", at: ev.ts };
      else delete dec[ref];
    }
  } else if (ev.type === "test.finish") {
    agg.tests.unshift({ mod: ev.mod, score: ev.score, passed: !!ev.passed, at: ev.ts, ms: ev.ms || 0,
      wrong: Array.isArray(ev.wrong) ? ev.wrong.slice(0, 12) : [],
      right: Array.isArray(ev.right) ? ev.right.slice(0, 20) : [] });
    agg.tests = agg.tests.slice(0, 50);
  }
  agg.lastSeen = ev.ts;
  agg.updatedAt = new Date().toISOString();
}
function pruneAgg(agg) {
  // Обрезка одинакова для всех разделов агрегата: отсортировать и снять лишнее с хвоста.
  // Сортируем только при переполнении — на каждый батч событий она обычно не нужна.
  const prune = (obj, limit, worstFirst, onDrop) => {
    const keys = Object.keys(obj);
    if (keys.length <= limit) return;
    for (const k of keys.sort(worstFirst).slice(limit)) { if (onDrop) onDrop(k); delete obj[k]; }
  };
  prune(agg.days, 120, (a, b) => (a < b ? 1 : -1), (k) => { agg.totals.ms -= agg.days[k].ms; });
  prune(agg.weak, 200, (a, b) => agg.weak[b].wrong - agg.weak[a].wrong);
  prune(agg.decide || {}, 300, (a, b) => (agg.decide[a].at < agg.decide[b].at ? 1 : -1)); // даты ISO — сравнимы как строки
  prune(agg.sessions, 100, (a, b) => (agg.sessions[a].end < agg.sessions[b].end ? 1 : -1));
}
function rebuildAgg(login) {
  const dir = eventsLoginDir(login);
  let months = [];
  try { months = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort(); } catch { return freshAgg(login); }
  const agg = freshAgg(login);
  for (const f of months) {
    let text = "";
    try { text = fs.readFileSync(path.join(dir, f), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; } // битая строка (обрыв записи) — пропускаем, не роняем пересборку
      if (!ev || ev.v !== 1) continue;
      foldEvent(agg, ev);
    }
  }
  pruneAgg(agg);
  return agg;
}
function statsFor(login) {
  let agg = readAgg(login);
  if (!agg || agg.v !== AGG_V) { agg = rebuildAgg(login); try { atomicWrite(eventsAggFile(login), JSON.stringify(agg)); } catch {} }
  return agg;
}
// Логин освобождается и достаётся другому человеку — тот же принцип, что и archiveProgress:
// не удаляем (вдруг ошибка), но и не отдаём новому владельцу чужой транскрипт и агрегат.
function archiveEvents(login) {
  const dir = eventsLoginDir(login);
  if (!fs.existsSync(dir)) return;
  const bak = dir + "." + new Date().toISOString().replace(/[:.]/g, "-") + ".bak";
  try { fs.renameSync(dir, bak); logger.info("events", "archived on login reuse", { login, dir: path.basename(bak) }); }
  catch (e) { logger.warn("events", "archive failed", { login, error: e.message }); }
}
// Приём батча: валидация → группировка по месячным файлам → один appendFileSync на файл →
// сворачивание в агрегат тем же foldEvent, что использует rebuildAgg (одна логика — один набор багов).
function appendEvents(login, sid, rawEvents) {
  const rx = Date.now();
  const byFile = new Map(); // file -> строки
  let agg = readAgg(login);
  if (!agg || agg.v !== AGG_V) agg = rebuildAgg(login);
  const lastSeq = (agg.seenSeq && agg.seenSeq[sid]) || 0;
  // appendEvents исполняется полностью синхронно (без await), а agg.seenSeq пишется на диск
  // до возврата — двум запросам никогда не интерлевиться, поэтому дедуп внутри батча достаточно
  // держать в локальной переменной; отдельный персистентный кэш дублировал бы agg.seenSeq.
  let accepted = 0, dropped = 0, maxSeq = lastSeq;
  for (const raw of rawEvents.slice(0, EV_MAX_BATCH)) {
    const seq = clampInt(raw && raw.seq, 0, 1e7, -1);
    if (seq <= maxSeq) { dropped++; continue; }
    const { ts, file, approx } = resolveEventTs(rx, raw || {});
    const ev = sanitizeEvent(raw, { ts, file });
    if (!ev) { dropped++; continue; }
    ev.login = login; ev.sid = evStr(sid) || "-";
    if (approx) ev.approx = true;
    delete ev.file;
    const arr = byFile.get(file) || []; arr.push(JSON.stringify(ev)); byFile.set(file, arr);
    foldEvent(agg, ev);
    if (ev.seq > maxSeq) maxSeq = ev.seq;
    accepted++;
  }
  if (accepted) {
    for (const [file, lines] of byFile) {
      const f = eventsFile(login, file);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      // Обрыв предыдущей записи (disk-full, крэш) мог оставить файл без завершающего \n —
      // тогда наша строка приклеится к битому хвосту и тоже станет нечитаемой.
      let needsPrologue = false;
      try { const st = fs.statSync(f); if (st.size > 0) { const fd = fs.openSync(f, "r"); const buf = Buffer.alloc(1); fs.readSync(fd, buf, 0, 1, st.size - 1); fs.closeSync(fd); needsPrologue = buf[0] !== 10; } } catch {}
      fs.appendFileSync(f, (needsPrologue ? "\n" : "") + lines.join("\n") + "\n");
    }
    agg.seenSeq = agg.seenSeq || {}; agg.seenSeq[sid] = maxSeq;
    pruneAgg(agg);
    try { atomicWrite(eventsAggFile(login), JSON.stringify(agg)); } catch (e) { logger.error("events", "agg write failed", e, { login }); }
  }
  return { accepted, dropped };
}
function eventsFileQuotaExceeded(login, file) {
  try { return fs.statSync(eventsFile(login, file)).size > EV_MAX_FILE_BYTES; } catch { return false; }
}
function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {}));
  res.end(body);
}
// Публичная статика: extra побеждает в Object.assign выше, поэтому глобальный no-store
// переопределяется точечно и только для витрины. Content-Length ставим явно —
// превью-краулеры (WhatsApp, Telegram) капризны к chunked у картинок.
// If-None-Match разбираем как список и срезаем W/ — прокси ослабляют валидатор.
// enc — упакованные копии тела: { gz, br }. Кодировка выбирается по Accept-Encoding
// с уважением к q=0 (так браузер отключает алгоритм); brotli предпочтительнее gzip.
const encQ = (ae, name) => {
  const m = new RegExp("(?:^|,)\\s*(?:" + name + "|\\*)(?![a-z-])\\s*(?:;\\s*q=([0-9.]+))?").exec(ae || "");
  return m ? (m[1] === undefined ? 1 : parseFloat(m[1])) : 0;
};
function sendStatic(req, res, buf, type, etag, maxAge, enc, vary, extra) {
  const ae = req.headers["accept-encoding"] || "";
  const alg = !enc ? null
    : (enc.br && encQ(ae, "br") > 0) ? "br"
    : (enc.gz && encQ(ae, "gzip") > 0) ? "gzip" : null;
  // ETag зависит от кодировки: тела разные, и общий кэш не должен отдать gzip тому,
  // кто просил brotli. Суффикс «+gz» исторический — его не трогаем.
  const tag = alg ? etag.replace(/"$/, (alg === "br" ? '+br"' : '+gz"')) : etag;
  // maxAge 0 — «кэшируй, но каждый раз спрашивай»: для адресов, чей ответ зависит от того,
  // кто спрашивает. ETag оставляет ревалидацию дешёвой (304 без тела).
  // extra перекрывает базовые заголовки (персональная страница — private, no-cache)
  // и едет как с 200, так и с 304: sw.js читает X-App-Shell на любом ответе.
  const base = Object.assign({ "Cache-Control": maxAge > 0 ? "public, max-age=" + maxAge : "no-cache", ETag: tag }, extra || {});
  const varyOn = [];
  if (enc) varyOn.push("Accept-Encoding");
  if (vary) varyOn.push(vary);
  if (varyOn.length) base.Vary = varyOn.join(", ");
  const inm = (req.headers["if-none-match"] || "").split(",").map((s) => s.trim().replace(/^W\//, ""));
  // Совпадать обязан ETag ИМЕННО текущей кодировки: 304 на чужой тег отдал бы клиенту
  // «не изменилось» про тело другого сжатия (поймано валидатором 05.09.2026).
  if (inm.includes(tag)) {
    res.writeHead(304, base);
    return res.end();
  }
  const body = alg === "br" ? enc.br : alg === "gzip" ? enc.gz : buf;
  const headers = Object.assign({ "Content-Length": body.length }, base);
  if (alg) headers["Content-Encoding"] = alg;
  return send(res, 200, body, type, headers);
}
function readBody(req, res, cb) {
  // Buffer'ы, не строку: `body += chunk` конвертирует каждый чанк отдельно, и многобайтовый
  // символ (кириллица), разрезанный границей чанка, превращается в "�" — воспроизводимо
  // на длинных телах вроде батча событий с сырым вводом ученика.
  // При переполнении НЕ рвём соединение (req.destroy() убивает общий с res сокет раньше,
  // чем успевает уйти ответ, — клиент получает голый разрыв связи вместо 413): просто
  // перестаём копить чанки и отвечаем, когда клиент сам закончит отправку тела.
  const chunks = []; let size = 0, overflow = false;
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY) overflow = true; else chunks.push(c); });
  req.on("end", () => {
    if (overflow) return void send(res, 413, '{"error":"too large"}');
    cb(Buffer.concat(chunks).toString("utf8"));
  });
}
// Тело-объект JSON: разбор и проверка «это объект» в одном месте. JSON.parse("null") (и "7",
// "[]") проходит без ошибки, а первое же d.x в колбэке readBody бросало TypeError — и падал весь
// процесс, в том числе от анонимного POST /api/login (ревью 25.09.2026). Ручки с телом — только так.
function readJson(req, res, cb) {
  readBody(req, res, (body) => {
    let d;
    try { d = JSON.parse(body); } catch { return send(res, 400, '{"error":"bad json"}'); }
    if (!d || typeof d !== "object" || Array.isArray(d)) return send(res, 400, '{"error":"bad json"}');
    cb(d);
  });
}
function readBinary(req, res, maxBytes, cb) {
  const chunks = []; let size = 0, overflow = false;
  req.on("data", (c) => { size += c.length; if (size > maxBytes) overflow = true; else chunks.push(c); });
  req.on("end", () => {
    if (overflow) return void send(res, 413, '{"error":"too large"}');
    cb(Buffer.concat(chunks));
  });
}
function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/* Бэкапы тома /data: tar.gz системным tar (busybox в alpine, bsdtar на macOS в тестах —
   поэтому исключение каталога бэкапов задано в обеих принятых ими формах). Хранятся в
   ${DATA_DIR}/backups и сами в архив не попадают — иначе каждый бэкап тащил бы предыдущие
   и рос бы геометрически. Ротация: BACKUP_KEEP свежих, старее — удаляются после каждого
   успешного создания. Env-ручки нужны тестам (крошечные интервалы) и особым случаям. */
const backupDir = () => path.join(DATA_DIR, "backups");
/* Помощники экзаменационных работ — на модульном уровне, как backupDir:
   определение внутри обработчика заводило их заново на каждый запрос. */
const EXAM_WORK_DIR = () => path.join(DATA_DIR, "exam-work");
/* Экзамен сдаёт ученик, которому открыта ХОТЬ ОДНА экзаменационная неделя из
   реестра EXAM_MODS — единственный источник реестра здесь тот же, что у клиента:
   собранная страница (гейт по захардкоженному m35 закрывал бы экзамен A1). */
let EXAM_MODS_CACHE = null;
const examMods = () => {
  if (EXAM_MODS_CACHE) return EXAM_MODS_CACHE;
  const m = (appshell.buildAppHtml().match(/const EXAM_MODS\s*=\s*\[([^\]]*)\]/) || [, ""])[1].match(/m\d+/g);
  // тихий фолбэк на m35 закрыл бы экзамен A1 без строки в логе — лучше громкий отказ старта
  if (!m || !m.length) throw new Error("реестр EXAM_MODS не найден в сборке (data/exam-b1.js)");
  return (EXAM_MODS_CACHE = m);
};
// одно чтение students.json на запрос, а не по чтению на каждый модуль реестра
const examAllowed = (login) => { const a = allowedMods(login); return !a || examMods().some((mm) => a.has(mm)); };
examMods();   // читается на старте: промах регекспа — отказ старта, а не тихие 403 всем
// тот же санитайзер логина, что везде (safeLoginSlug), а не свой расходящийся вырез
const examWorkFile = (l) => path.join(EXAM_WORK_DIR(), safeLoginSlug(l) + ".json");
const readExamWork = (l) => { try { return JSON.parse(fs.readFileSync(examWorkFile(l), "utf8")); } catch { return []; } };
// случайный суффикс id/имени файла: Date.now() не уникален — две сдачи в одну мс
// затирали файл и коллизировали id (ревью 22.08). randomBytes убирает оба.
const rid = () => Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");

/* ===CHAT-INIT=== Чат с преподавателем (асинхронный инбокс, решение владельца 05.09.2026):
   хранилище — server/inbox-store.js (DATA_DIR/inbox/<id>.json), идентификаторы и подпись
   куки посетителя — server/inbox-auth.js. Уведомление учителю — счётчик в /api/me;
   notifyTeacher — точка расширения (этап 2: Telegram-мост «Ответить» на сообщение бота). */
const { createInboxStore, LIMITS: CHAT_LIMITS } = require("./inbox-store");
const { createInboxAuth } = require("./inbox-auth");
const INBOX = createInboxStore({ dir: path.join(DATA_DIR, "inbox"), atomicWrite, rid, logger });
const CHAT_AUTH = createInboxAuth({ secret: SECRET, timingEq });
const CHAT_COOKIE_DAYS = 180;
const CHAT_MAX_VISITOR_THREADS = Number(process.env.KGA1_CHAT_MAX_VISITOR_THREADS) || CHAT_LIMITS.MAX_VISITOR_THREADS;
const notifyTeacher = (_thread, _msg) => {}; // этап 2: Telegram/почта; сейчас — только счётчик в панели
// Лимиты по IP и по треду (blocked до действия, note после — как loginLimiter): новых
// тредов 5/час с IP, сообщений 40/10 мин с IP (NAT школ и офисов) и 30/10 мин в один тред.
const chatNewLimiter = makeRateLimiter(60 * 60 * 1000, 5);
const chatIpLimiter = makeRateLimiter(10 * 60 * 1000, 40);
const chatThreadLimiter = makeRateLimiter(10 * 60 * 1000, 30);
// Ретеншн — по таймеру (скан каталога синхронный, из запроса он бы блокировал цикл событий)
if (process.env.KGA1_CHAT_SWEEP_AUTO !== "0") {
  setInterval(() => INBOX.sweep(Date.now()), 60 * 60 * 1000).unref();
  setTimeout(() => INBOX.sweep(Date.now()), 90 * 1000).unref();
}
/* ===/CHAT-INIT=== */
// Ненайденные запросы переводчика — спрос для новых фраз курса (server/pv-miss.js).
// Клиент шлёт промах раз на запрос после паузы ввода; 30/10 мин с IP гасят мусорный поток.
const { createMissStore, validateMiss } = require("./pv-miss");
const PV_MISS = createMissStore({ file: path.join(DATA_DIR, "pv-miss.json"), atomicWrite, dayKey: (ms) => dayKeyOf(new Date(ms).toISOString()) });
const pvMissLimiter = makeRateLimiter(10 * 60 * 1000, 30);
// владелец записи — разбором имени ЕДИНОЙ формулой и сравнением на равенство:
// префикс startsWith у логина «ali» присваивал (и в ротации — сносил) файлы «ali-bek»
const examAudioOwner = (f) => String(f).replace(/-[0-9a-z]+-[0-9a-f]{8}\.webm$/i, "");
const EXAM_VOICE_RE = /^\/api\/exam\/voice\/([a-zA-Z0-9_.-]+-[0-9a-z-]+\.webm)$/;
const BACKUP_RE = /^kga1-backup-\d{8}-\d{6}(-\d+)?\.tar\.gz$/;
const BACKUP_KEEP = Math.max(1, parseInt(process.env.KGA1_BACKUP_KEEP, 10) || 5);
const BACKUP_MAX_AGE = parseInt(process.env.KGA1_BACKUP_MAX_AGE_MS, 10) || 24 * 3600 * 1000;
const BACKUP_TICK = parseInt(process.env.KGA1_BACKUP_TICK_MS, 10) || 3600 * 1000;
const BACKUP_MAX_UPLOAD = parseInt(process.env.KGA1_BACKUP_MAX_UPLOAD, 10) || 2 * 1024 * 1024 * 1024;
let BACKUP_BUSY = false;

function listBackups() {
  try {
    return fs.readdirSync(backupDir()).filter((n) => BACKUP_RE.test(n))
      .map((n) => { const st = fs.statSync(path.join(backupDir(), n)); return { name: n, bytes: st.size, at: st.mtime.toISOString() }; })
      .sort((a, b) => (a.name < b.name ? -1 : 1)); // имя = время создания, сортировка хронологична
  } catch { return []; }
}

function makeBackup(cb) {
  if (BACKUP_BUSY) return cb(new Error("busy"));
  BACKUP_BUSY = true;
  fs.mkdirSync(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  let name = "kga1-backup-" + stamp + ".tar.gz";
  for (let n = 2; fs.existsSync(path.join(backupDir(), name)); n++) name = "kga1-backup-" + stamp + "-" + n + ".tar.gz";
  const tmp = path.join(backupDir(), name + ".tmp");
  const child = require("child_process").spawn("tar",
    ["-czf", tmp, "-C", DATA_DIR, "--exclude=./backups", "--exclude=./backups/*", "."]);
  let errTxt = "";
  child.stderr.on("data", (d) => { errTxt += d; });
  child.on("error", (e) => { BACKUP_BUSY = false; try { fs.unlinkSync(tmp); } catch {} cb(e); });
  child.on("close", (code) => {
    BACKUP_BUSY = false;
    if (code !== 0) { try { fs.unlinkSync(tmp); } catch {} return cb(new Error("tar exit " + code + ": " + errTxt.slice(0, 200))); }
    fs.renameSync(tmp, path.join(backupDir(), name));
    const all = listBackups();
    while (all.length > BACKUP_KEEP) {
      const oldest = all.shift();
      try { fs.unlinkSync(path.join(backupDir(), oldest.name)); logger.info("backup", "rotated out", { name: oldest.name }); } catch {}
    }
    cb(null, { name, bytes: fs.statSync(path.join(backupDir(), name)).size });
  });
}

function restoreBackup(file, cb) {
  const child = require("child_process").spawn("tar", ["-xzf", file, "-C", DATA_DIR]);
  let errTxt = "";
  child.stderr.on("data", (d) => { errTxt += d; });
  child.on("error", cb);
  child.on("close", (code) => cb(code === 0 ? null : new Error("tar exit " + code + ": " + errTxt.slice(0, 200))));
}

// Ежедневный автобэкап: тик раз в час (плюс ранний тик после старта — деплой среди дня
// не должен отодвигать бэкап на сутки), создание — только если свежайший старше суток.
// unref: таймер не держит процесс (тесты и graceful shutdown).
function backupTick() {
  const all = listBackups();
  const newest = all.length ? all[all.length - 1] : null;
  if (newest && Date.now() - Date.parse(newest.at) < BACKUP_MAX_AGE) return;
  makeBackup((e, r) => {
    if (e && e.message !== "busy") logger.error("backup", "auto failed", e);
    else if (!e) logger.info("backup", "auto created", r);
  });
}
if (process.env.KGA1_BACKUP_AUTO !== "0") {
  setInterval(backupTick, BACKUP_TICK).unref();
  setTimeout(backupTick, Math.min(BACKUP_TICK, 60 * 1000)).unref();
}
// req.url в обработчике уже отрезан по "?" (см. `url = req.url.split("?")[0]`) — ручкам
// журнала занятий нужна и query-строка, разбираем её тут же по требованию.
function q(req) { return new URL(req.url, "http://x").searchParams; }

/* ---------- Секреты (в /data, не в git) и TTS через ElevenLabs ---------- */
function getSecret(name) {
  try { return fs.readFileSync(path.join(DATA_DIR, "secrets", name + ".key"), "utf8").trim(); } catch { return null; }
}
// Голос курса: env сильнее, но по умолчанию — голос male_adult из реестра
// deploy/voices.json (голос — данные, не код): прежний захардкоженный стоковый
// голос означал, что при пустом env любая генерация без явного voice уходит
// на английскую дикторшу вместо клона нейтив-спикера.
const VOICES_REG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deploy", "voices.json"), "utf8")); }
  catch { return null; }
})();
const TTS_VOICE_ID = process.env.ELEVEN_VOICE_ID
  || (VOICES_REG && VOICES_REG.voices && VOICES_REG.voices[VOICES_REG.default]) || "";
const TTS_MODEL = process.env.ELEVEN_MODEL || "eleven_v3";
const TTS_LANG = process.env.ELEVEN_LANG || "ky"; // кыргызский принудительно; при отказе модели — авто-детект
let VOICE_ID_CACHE = null;
function currentVoiceId() {
  if (VOICE_ID_CACHE) return VOICE_ID_CACHE;
  try { VOICE_ID_CACHE = fs.readFileSync(path.join(DATA_DIR, "tts-voice"), "utf8").trim(); } catch {}
  return VOICE_ID_CACHE || TTS_VOICE_ID;
}
function elevenVoices(key, cb) {
  const rq = https.request({ hostname: "api.elevenlabs.io", path: "/v1/voices", method: "GET", headers: { "xi-api-key": key } }, (r) => {
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => cb(null, r.statusCode, Buffer.concat(chunks)));
  });
  rq.on("error", (e) => cb(e));
  rq.setTimeout(15000, () => rq.destroy(new Error("voices timeout")));
  rq.end();
}
function elevenTts(key, voiceId, text, langCode, cb, model, settings) {
  const body = { text, model_id: model || TTS_MODEL };
  if (langCode) body.language_code = langCode;
  // Настройки голоса: env — дефолт курса, settings — оверрайд конкретного запроса (A/B-подбор).
  // У v3 stability — режимы: 0 Creative / 0.5 Natural / 1 Robust.
  const vs = {};
  const num = (v) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
  const stab = settings && settings.stability != null ? num(settings.stability) : num(process.env.ELEVEN_STABILITY);
  const sim = settings && settings.similarity != null ? num(settings.similarity) : num(process.env.ELEVEN_SIMILARITY);
  const style = settings && settings.style != null ? num(settings.style) : num(process.env.ELEVEN_STYLE);
  const speed = settings && settings.speed != null ? num(settings.speed) : num(process.env.ELEVEN_SPEED);
  if (stab != null) vs.stability = stab;
  if (sim != null) vs.similarity_boost = sim;
  if (style != null) vs.style = style;
  if (speed != null) vs.speed = speed;
  if (Object.keys(vs).length) body.voice_settings = vs;
  // Словарь произношения (до 3 у API; нам хватает одного курсового)
  if (process.env.ELEVEN_DICT_ID) body.pronunciation_dictionary_locators = [
    Object.assign({ pronunciation_dictionary_id: process.env.ELEVEN_DICT_ID },
      process.env.ELEVEN_DICT_VERSION ? { version_id: process.env.ELEVEN_DICT_VERSION } : {})];
  const payload = JSON.stringify(body);
  const rq = https.request({
    hostname: "api.elevenlabs.io",
    // 192kbps доступен с плана Creator; ELEVEN_FORMAT позволяет откатиться без релиза
    path: "/v1/text-to-speech/" + voiceId + "?output_format=" + (process.env.ELEVEN_FORMAT || "mp3_44100_192"),
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
  }, (r) => {
    const chunks = [];
    r.on("data", (c) => chunks.push(c));
    r.on("end", () => cb(null, r.statusCode, Buffer.concat(chunks)));
  });
  rq.on("error", (e) => cb(e));
  rq.setTimeout(30000, () => rq.destroy(new Error("elevenlabs timeout")));
  rq.write(payload); rq.end();
}
function audioFile(mod, id) { return path.join(DATA_DIR, "audio", mod, id + ".mp3"); }
// Метаданные источника аудио: «upload» (кастомная запись преподавателя) защищена от TTS-перезаписи.
function audioMetaFile(mod) { return path.join(DATA_DIR, "audio", mod, "_meta.json"); }
function readAudioMeta(mod) {
  try { return JSON.parse(fs.readFileSync(audioMetaFile(mod), "utf8")); } catch { return {}; }
}
function setAudioMeta(mod, id, entry) {
  const m = readAudioMeta(mod);
  m[id] = entry;
  atomicWrite(audioMetaFile(mod), JSON.stringify(m));
}
const ID_RE = /^[a-z0-9_]{1,40}$/;

const server = http.createServer((req, res) => {
  // Снаружи сервер живёт только за https (TLS терминирует Traefik), поэтому HSTS
  // безусловный: после первого визита браузер больше не делает cleartext-хоп на :80
  res.setHeader("Strict-Transport-Security", "max-age=15552000");
  // Базовая безопасность — на КАЖДОМ ответе (единая точка, а не по маршрутам):
  // nosniff запрещает браузеру угадывать тип (mp3/json/webp отдаются с явным типом,
  // угадывание тут может только навредить), Referrer-Policy не выпускает путь ученика
  // на чужой домен (в реферере уходит только https://learn.kg), X-Frame-Options
  // защищает /login от кликджекинга. SAMEORIGIN, а не DENY: «Методика» встраивается
  // в тренажёр своим же iframe (app/src/12-app.js, metodika?embed=1).
  // CSP тут нет намеренно: страница тренажёра целиком инлайнит скрипты, и новая
  // политика погасила бы её — это отдельная работа, а не побочный эффект заголовков.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  const url = req.url.split("?")[0];
  // Хвост запроса переживает языковые редиректы: реклама ведёт на голый /demo,
  // и utm/gclid обязаны доехать до варианта, иначе переход теряет атрибуцию
  const qs = req.url.slice(url.length);

  // www — синоним, а не второй сайт: единый канонический адрес для поиска и превью
  if ((req.headers.host || "").split(":")[0] === "www.learn.kg") {
    return send(res, 301, "", "text/plain", { Location: "https://learn.kg" + req.url });
  }

  if (url === "/api/health") return send(res, 200, '{"ok":true}');
  // публично: по нему после деплоя проверяется, какая версия реально живёт на проде
  if (url === "/api/version") return send(res, 200, JSON.stringify({ version: APP_VERSION }));

  if (url === "/api/login" && req.method === "POST") {
    // async: scrypt считается в пуле потоков, основной поток в это время обслуживает других
    return readJson(req, res, async (d) => { try {
      refreshUsers();
      const login = String(d.login || "").trim(), pass = String(d.password || "");
      const ip = clientIp(req);
      if (loginLimiter.blocked(ip)) {
        logger.warn("auth", "login rate limited", { ip, login: login || "(empty)" });
        return send(res, 429, '{"error":"Слишком много попыток входа — подождите 15 минут"}');
      }
      const known = Object.prototype.hasOwnProperty.call(USERS, login);
      // неизвестный логин — тот же scrypt по фиктивному хэшу (время ответа не выдаёт логин)
      if (!(await PASSWORDS.verifyPasswordAsync(known ? USERS[login].password : PASSWORDS.DUMMY_HASH, pass)) || !known) {
        loginLimiter.note(ip, 1);
        logger.warn("auth", "login failed", { login: login || "(empty)" });
        return send(res, 401, '{"error":"Неверный логин или пароль"}');
      }
      loginLimiter.reset(ip);
      if (roleOf(login) !== "admin" && studentInfo(login).suspended) {
        logger.warn("auth", "login of suspended user", { login });
        return send(res, 403, '{"error":"Доступ приостановлен преподавателем"}');
      }
      return send(res, 200, JSON.stringify({ ok: true, login }), null,
        { "Set-Cookie": COOKIE + "=" + sign(login) + cookieFlags(req) });
    } catch (e) {   // исключение в async-колбэке — отклонённый промис, а он роняет процесс
      logger.error("auth", "login failed with exception", e, {});
      return send(res, 500, '{"error":"login failed"}');
    } });
  }

  if (url === "/api/logout") {
    return send(res, 302, "", "text/plain",
      { "Set-Cookie": COOKIE + "=; Path=/; HttpOnly; Max-Age=0", Location: "/" });
  }

  /* Публичная витрина и её файлы — до вычисления пользователя: они одинаковы для всех,
     и так же они доступны приостановленному ученику (иначе он получал бы JSON-403). */
  // ru-вариант, а не сырой файл: статический LD-блок исходника — лишь болванка для
  // localizedLanding, наружу он не отдаётся (иначе дрейф болванки от словаря публикуем)
  if (url === "/landing") { const v = LANDING_VARIANTS.ru; return sendStatic(req, res, v.buf, "text/html; charset=utf-8", v.etag, 300, v); }
  // Снятые страницы → 301 на замену (тот же язык, хвост запроса сохраняется): ссылки и
  // поисковики не упираются в 404. Реестр — данные MOVED_PAGES, новая запись = строка.
  {
    const mm = url.match(/^(\/[a-z0-9\/-]+?)(?:\/(ru|en|tr))?\/?$/);
    const to = mm && MOVED_PAGES[mm[1]];
    if (to) return send(res, 301, "", "text/plain", { Location: to + "/" + (mm[2] || pickLang(req)) + qs,
      "Cache-Control": mm[2] ? "public, max-age=86400" : "no-store", "Vary": "Cookie, Accept-Language" });
  }
  // Канон локализованных страниц: /<base>/<lang> и голый /<base> (301 по Accept-Language) — из реестра
  for (const [base, p] of Object.entries(LOCALIZED_PAGES)) {
    if (base && url === base)
      return send(res, 301, "", "text/plain", { Location: base + "/" + pickLang(req) + qs, "Cache-Control": "no-store", "Vary": "Cookie, Accept-Language" });
    if (url.startsWith(base + "/")) {
      const v = p.vars.get(url.slice(base.length + 1));
      if (v) return sendStatic(req, res, v.buf, "text/html; charset=utf-8", v.etag, 300, v);
    }
  }
  if (url === "/privacy") return sendStatic(req, res, PRIVACY_HTML, "text/html; charset=utf-8", PRIVACY_ETAG, 3600, { gz: PRIVACY_GZ, br: PRIVACY_BR });
  if (url === "/terms") return sendStatic(req, res, TERMS_HTML, "text/html; charset=utf-8", TERMS_ETAG, 3600, { gz: TERMS_GZ, br: TERMS_BR });
  if (url === "/sitemap.xml") {
    return send(res, 200, SITEMAP_XML, "application/xml; charset=utf-8", { "Cache-Control": "public, max-age=86400" });
  }
  if (url === "/og.png") return sendStatic(req, res, OG_PNG, "image/png", OG_ETAG, 86400);
  // Своя картинка превью статьи: /og/<имя> из app/og (наличие файла проверено на старте)
  if (url.startsWith("/og/")) {
    // превью снятых страниц (MOVED_PAGES) — 301 на общее превью: в кэшах соцсетей ссылки живут годами
    const om = url.match(/^\/og\/([a-z0-9-]+)-(?:ru|en|tr)\.png$/);
    if (om && MOVED_PAGES["/blog/" + om[1]]) return send(res, 301, "", "text/plain", { Location: "/og.png", "Cache-Control": "public, max-age=86400" });
    const f = OG_FILES.get(url.slice("/og/".length));
    if (f) return sendStatic(req, res, f.buf, f.type, f.etag, 86400);
  }
  if (url === "/avatar.webp") return sendStatic(req, res, AVATAR_WEBP, "image/webp", AVATAR_ETAG, 86400);
  // Слайды аудиоурока: публично (урок открыт анониму в демо), кэш сутки — меняются релизом
  if (url.startsWith("/lessons/")) {
    const s = LESSON_SLIDE_FILES.get(url.slice("/lessons/".length));
    if (s) return sendStatic(req, res, s.buf, "image/webp", s.etag, 86400);
  }
  if (url === "/favicon.ico") return sendStatic(req, res, FAVICON_SVG, "image/svg+xml", etagOf(FAVICON_SVG), 86400);
  if (url === "/manifest.webmanifest") return sendStatic(req, res, MANIFEST_JSON, "application/manifest+json; charset=utf-8", MANIFEST_ETAG, 3600);
  // Тип обязателен явно: дефолт send() — JSON, а для SW-скриптов браузер делает строгую
  // MIME-проверку и молча отверг бы регистрацию. no-store (дефолт send) — сознательно:
  // браузер перечитывает sw.js на каждой навигации, любой деплой заменяет воркер сразу.
  if (url === "/sw.js") return send(res, 200, SW_JS, "text/javascript; charset=utf-8");
  if (url === "/chat.js") return sendStatic(req, res, CHAT_JS.buf, "text/javascript; charset=utf-8", CHAT_JS.etag, 86400, CHAT_JS); // адрес версионирован ?v=, кэш на сутки
  if (STATIC_PNGS[url]) return sendStatic(req, res, STATIC_PNGS[url].buf, "image/png", STATIC_PNGS[url].etag, 86400);
  if (url === "/install") return sendStatic(req, res, INSTALL_HTML, "text/html; charset=utf-8", INSTALL_ETAG, 3600, { gz: INSTALL_GZ, br: INSTALL_BR });
  // Верификация Яндекс.Вебмастера — файл в корне с точным содержимым от Яндекса (не удалять)
  if (url === "/yandex_821d13437f099635.html") {
    return send(res, 200, '<html>\n    <head>\n        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n    </head>\n    <body>Verification: 821d13437f099635</body>\n</html>',
      "text/html; charset=utf-8", { "Cache-Control": "public, max-age=86400" });
  }
  // Аудио демо-набора — копии, снятые при сборке; живой /api/audio остаётся за авторизацией.
  // Запросы с кукой/авторизацией пропускаем дальше: вошедшие (в т.ч. преподаватель после
  // перезаливки) слышат живой файл, а не снимок на момент старта.
  // HEAD тоже: превью-боты и прокси ходят им, а 401 с Basic-попапом на публичном адресе не нужен
  const mPubAud = (req.method === "GET" || req.method === "HEAD") && url.startsWith("/api/audio/") &&
    url.match(/^\/api\/audio\/(m\d+)\/([a-z0-9_]{1,40})\.mp3$/);
  // Публичный аудио-слой — два снимка, снятые на старте: демо-набор m0 (DEMO.audio, ключ id)
  // и фразы разговорника из любых модулей (RAZGO.audio, ключ mod/id). Живой /api/audio
  // остаётся за курсом — снимок и есть граница публичного.
  const pubAud = mPubAud ? publicAudio(mPubAud[1], mPubAud[2]) : null;
  // Vary: Cookie — тело этого адреса зависит от входа (снимок сборки vs живой файл),
  // без него общий кэш отдал бы снимок и вошедшему преподавателю. Ответ, выданный ПО куке
  // (вошедший без доступа к модулю), не смеет лечь в общий кэш как public — private.
  const sendPubAud = () => sendStatic(req, res, pubAud.buf, "audio/mpeg", pubAud.etag, 600, null, "Cookie",
    ((req.headers.cookie || "").includes(COOKIE + "=") || req.headers.authorization) ? { "Cache-Control": "private, max-age=600" } : null);
  if (pubAud && !(req.headers.cookie || "").includes(COOKIE + "=") && !req.headers.authorization) {
    return sendPubAud();
  }
  /* ===VIDEO=== Видеоуроки: mp4 на томе (/data/video) + YouTube-ссылки в
     video-meta.json там же. Раздача и список публичные: ролики делаются для
     YouTube и шаринга, их материал — открытый урок m0 (в демо он и так у
     анонима); наружу отдаются только имена белого шаблона из каталога video.
     Range обязателен — без 206 у <video> не работает перемотка. Заливка,
     ссылка и удаление — преподавателю (ниже, в авторизованной зоне). */
  const mVideoFile = url.match(/^\/api\/video\/([a-z0-9-]{1,60}\.mp4)$/);
  // jpg-постеры рядом с роликами: плитки и плеер показывают картинку, само видео
  // грузится только по клику (решение владельца о трафике)
  const mVideoJpg = url.match(/^\/api\/video\/([a-z0-9-]{1,60}\.jpg)$/);
  if (mVideoJpg && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const buf = fs.readFileSync(path.join(DATA_DIR, "video", mVideoJpg[1]));
      res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length, "Cache-Control": "public, max-age=600" });
      return res.end(req.method === "HEAD" ? undefined : buf);
    } catch { return send(res, 404, '{"error":"нет постера"}'); }
  }
  if (url === "/api/video/list" && req.method === "GET") {
    let rows = [];
    try {
      let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "video", "video-meta.json"), "utf8")); } catch {}
      const files = fs.readdirSync(path.join(DATA_DIR, "video"));
      rows = files.filter((f) => /^[a-z0-9-]{1,60}\.mp4$/.test(f)).sort()
        .map((f) => ({ file: f, bytes: fs.statSync(path.join(DATA_DIR, "video", f)).size,
          youtube: (meta[f] && meta[f].youtube) || null,
          chapters: (meta[f] && meta[f].chapters) || null,
          poster: files.includes(f.replace(/\.mp4$/, ".jpg")) ? f.replace(/\.mp4$/, ".jpg") : null }));
    } catch {}
    return send(res, 200, JSON.stringify(rows), "application/json; charset=utf-8", { "Cache-Control": "no-cache" });
  }
  if (mVideoFile && (req.method === "GET" || req.method === "HEAD")) {
    const file = path.join(DATA_DIR, "video", mVideoFile[1]);
    let st; try { st = fs.statSync(file); } catch { return send(res, 404, '{"error":"нет ролика"}'); }
    const base = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=600" };
    const mR = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (mR && (mR[1] || mR[2])) {
      const start = mR[1] ? parseInt(mR[1], 10) : Math.max(0, st.size - parseInt(mR[2], 10));
      const end = (mR[1] && mR[2]) ? Math.min(parseInt(mR[2], 10), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { "Content-Range": "bytes */" + st.size }); return res.end(); }
      res.writeHead(206, Object.assign(base, { "Content-Range": "bytes " + start + "-" + end + "/" + st.size,
        "Content-Length": end - start + 1 }));
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(base, { "Content-Length": st.size }));
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(file).pipe(res);
  }
  /* ===/VIDEO=== */
  if (url === "/robots.txt") {
    return send(res, 200, "User-agent: *\nDisallow: /api/\nSitemap: https://learn.kg/sitemap.xml\n", "text/plain; charset=utf-8",
      { "Cache-Control": "public, max-age=86400" });
  }
  if (url === "/llms.txt") {
    return send(res, 200, LLMS_TXT, "text/markdown; charset=utf-8", { "Cache-Control": "public, max-age=86400" });
  }
  // IndexNow (Яндекс/Bing): ключ-файл в корне подтверждает владение хостом; сам ключ
  // не секрет — протокол требует его публичной раздачи. Пинг — deploy/indexnow.js.
  if (url === "/" + INDEXNOW_KEY + ".txt") {
    return send(res, 200, INDEXNOW_KEY, "text/plain; charset=utf-8", { "Cache-Control": "public, max-age=86400" });
  }
  // Публичный адрес легко набрать со слешем — без этого опечатка даёт 401 с Basic-попапом
  if (SLASHED.has(url)) {
    return send(res, 301, "", "text/plain", { Location: url.slice(0, -1) + qs }); // 301: слэш-дубль не должен делить SEO-сигналы
  }

  // Публичная витрина обслужена выше и за это не платит: statSync только там,
  // где дальше решается, кто пользователь и что ему можно.
  refreshUsers();
  // Basic с адреса, исчерпавшего попытки, ждёт окно — и с верным паролем, как форма входа
  const reqIp = clientIp(req);
  if (String(req.headers.authorization || "").startsWith("Basic ") && basicLimiter.blocked(reqIp)) {
    logger.warn("auth", "basic auth rate limited", { ip: reqIp });
    return send(res, 429, '{"error":"Слишком много попыток входа — подождите 15 минут"}');
  }
  const login = currentUser(req);

  /* ===CHAT-PUBLIC=== Чат с преподавателем — ДО гейта приостановки и до общего 401:
     пишет аноним (кука kga1-chat), ученик (тред u-<login>) и приостановленный ученик
     (ему как раз есть что спросить). Текст и контакт в логи не попадают — только счётчики. */
  if (url === "/api/chat" || url === "/api/chat/seen") {
    const cookieId = login ? null : CHAT_AUTH.parseChatCookie(parseCookies(req)[CHAT_AUTH.COOKIE_NAME]);
    const ownId = login ? CHAT_AUTH.studentId(login) : cookieId;
    const own = ownId ? INBOX.readThread(ownId) : null;
    if (url === "/api/chat" && req.method === "GET") {
      if (!own) {
        if (!cookieId) return send(res, 200, '{"thread":null}');
        INBOX.forget(cookieId); // подпись верна, треда нет (ретеншн) — сводку забываем, куку гасим
        return send(res, 200, '{"thread":null}', null, { "Set-Cookie": CHAT_AUTH.clearCookieHeader() });
      }
      // посетителю — проекция: без логина преподавателя (by) и служебных полей файла
      const pub = { id: own.id, kind: own.kind, lang: own.lang, firstPage: own.firstPage, contact: own.contact,
        messages: own.messages.map((m) => ({ id: m.id, ts: m.ts, from: m.from, text: m.text })) };
      return send(res, 200, JSON.stringify({ thread: pub, unread: INBOX.unreadFor(own, "visitor") }));
    }
    if (url === "/api/chat/seen" && req.method === "POST") {
      return readBody(req, res, () => {
        if (own) INBOX.markSeenById(own.id, "visitor"); // перечитать: снимок own взят до ожидания тела
        return send(res, 200, '{"ok":true,"unread":0}');
      });
    }
    if (url === "/api/chat" && req.method === "POST") {
      if (login && canEdit(login)) return send(res, 400, '{"error":"преподаватель отвечает из вкладки «Сообщения»"}');
      const ip = clientIp(req);
      if (chatIpLimiter.blocked(ip)) return send(res, 429, '{"error":"слишком часто"}', null, { "Retry-After": "600" });
      chatIpLimiter.note(ip, 1);   // считаем попытку, а не только удачную запись: поток мусора тоже нагрузка
      return readJson(req, res, (d) => {
        if (typeof d.hp === "string" && d.hp) { logger.warn("chat", "honeypot", { ip }); return send(res, 200, '{"ok":true}'); }
        const v = INBOX.validateInput(d);
        if (v.error) return send(res, 400, JSON.stringify({ error: v.error }));
        // own — снимок до ожидания тела; для записи тред перечитывается (гонка двух сообщений)
        let t = own ? INBOX.readThread(own.id) : null; const extra = {};
        if (!t) {
          if (login) t = INBOX.newThread({ id: ownId, kind: "student", login, lang: v.lang, firstPage: v.page, contact: v.contact });
          else {
            if (chatNewLimiter.blocked(ip)) return send(res, 429, '{"error":"слишком часто"}', null, { "Retry-After": "3600" });
            if (INBOX.countVisitorThreads() >= CHAT_MAX_VISITOR_THREADS) {
              logger.warn("chat", "inbox full", { ip });
              return send(res, 429, '{"error":"inbox full"}', null, { "Retry-After": "86400" });
            }
            t = INBOX.newThread({ id: CHAT_AUTH.newVisitorId(), kind: "visitor", lang: v.lang, firstPage: v.page, contact: v.contact });
            chatNewLimiter.note(ip, 1);
            const secure = String(req.headers["x-forwarded-proto"] || "").includes("https");
            extra["Set-Cookie"] = CHAT_AUTH.cookieHeader(t.id, secure, CHAT_COOKIE_DAYS * 86400);
          }
        } else if (v.contact && !t.contact) { t.contact = v.contact; }
        if (chatThreadLimiter.blocked(t.id)) return send(res, 429, '{"error":"слишком часто"}', null, { "Retry-After": "600" });
        let msg;
        try { msg = INBOX.appendMessage(t, "visitor", v.text); }
        catch (e) { logger.error("chat", "write failed", e, { id: t.id }); return send(res, 500, '{"error":"write failed"}'); }
        chatThreadLimiter.note(t.id, 1);
        logger.info("chat", "message", { id: t.id, kind: t.kind, len: v.text.length, new: t.messages.length === 1 });
        notifyTeacher(t, msg);
        return send(res, 200, JSON.stringify({ ok: true, id: t.id, msg: { id: msg.id, ts: msg.ts } }), null, extra);
      });
    }
  }
  /* ===/CHAT-PUBLIC=== */
  // Промах переводчика — публичный, как чат: пишет аноним; текст запроса в логи не идёт
  if (url === "/api/pv-miss" && req.method === "POST") {
    const ip = clientIp(req);
    if (pvMissLimiter.blocked(ip)) return send(res, 429, '{"error":"слишком часто"}', null, { "Retry-After": "600" });
    pvMissLimiter.note(ip, 1);
    return readJson(req, res, (d) => {
      const v = validateMiss(d, PV_FN.pvNorm);
      if (v.error) return send(res, 400, JSON.stringify({ error: v.error }));
      if (v.skip) return send(res, 200, '{"ok":true}');
      try { if (!PV_MISS.note(v.lang, v.q)) logger.warn("pv-miss", "store full", {}); }
      catch (e) { logger.error("pv-miss", "write failed", e); return send(res, 500, '{"error":"write failed"}'); }
      return send(res, 200, '{"ok":true}');
    });
  }

  if (login && roleOf(login) !== "admin" && studentInfo(login).suspended && url !== "/api/logout") {
    // Демо публично и открыто приостановленному (страницу он получает выше как аноним) —
    // озвучка обязана звучать так же, иначе демо у него молчит из-за живой куки
    if (pubAud) return sendPubAud();
    // Приостановленному — форма входа, а не витрина с промо-обещаниями.
    // Асимметрия с анонимом (тот получает 302 на «/») намеренная: не «унифицировать».
    if (url === "/" || url === "/index.html" || url === "/m0.html" || url === "/login") {
      return send(res, 200, LOGIN_HTML, "text/html; charset=utf-8");
    }
    return send(res, 403, '{"error":"Доступ приостановлен преподавателем"}');
  }

  // «/» двулико — и потому не кэшируется «навсегда»: закэшированная витрина подставлялась
  // сразу после входа (location.replace("/") берёт ответ из кэша, не спрашивая сервер),
  // человек возвращался на витрину, а «Войти» вело по кругу через 302. Лечится только
  // ревалидацией: no-cache + Vary: Cookie. Отдельный /landing кэшируется как прежде.
  // «/» двулико: вошедший видит тренажёр, аноним — витрину learn.kg.
  // Старые адреса для анонима сводим к «/», чтобы витрина жила по одному URL.
  if (url === "/" || url === "/index.html" || url === "/m0.html") {
    // X-App-Shell — контракт с sw.js: только ответ с этим заголовком кэшируется как
    // офлайн-оболочка; его отсутствие (витрина, форма входа) стирает кэш оболочки.
    if (login) {
      const v = appShellFor(login);
      // private: страница персональная (свои курсы), поэтому общий кэш её хранить не должен.
      // ETag варианта — он же метка оболочки для sw.js: смена состава курсов меняет обе.
      return sendStatic(req, res, v.buf, "text/html; charset=utf-8", v.etag, 0, v, "Cookie",
        { "Cache-Control": "private, no-cache", "X-App-Shell": v.etag.replace(/"/g, "") });
    }
    // Аноним: постоянный редирект на канонический /ru. no-store обязателен — закэшированный
    // редирект после входа уводил бы на витрину (та же петля, что чинили ревалидацией «/»).
    return send(res, 301, "", "text/plain", { Location: "/" + pickLang(req) + qs, "Cache-Control": "no-store", "Vary": "Cookie, Accept-Language" });
  }

  // Форма входа на своём адресе. Вошедшего — сразу в тренажёр, иначе навигация
  // после успешного входа возвращала бы ту же форму.
  if (url === "/login") {
    if (login) return send(res, 302, "", "text/plain", { Location: "/" });
    return send(res, 200, LOGIN_HTML, "text/html; charset=utf-8");
  }

  // Методика — отдельная страница только для преподавателя/админа
  if (url === "/metodika") {
    if (!login) return send(res, 200, LOGIN_HTML, "text/html; charset=utf-8");
    if (!canEdit(login)) return send(res, 302, "", "text/plain", { Location: "/" });
    return send(res, 200, fs.readFileSync(path.join(APP_DIR, "metodika.html")), "text/html; charset=utf-8");
  }

  // Неизвестный не-API путь для GET/HEAD — честный 404 (крашлер и человек), а не 401
  // с Basic-попапом. Все публичные и app-страницы обслужены выше; ниже — только /api/*.
  if (!url.startsWith("/api/") && (req.method === "GET" || req.method === "HEAD")) {
    return send(res, 404, NOT_FOUND_HTML, "text/html; charset=utf-8");
  }

  if (!login) {
    // Протухшая кука (бывший ученик, ротация секрета) не должна молча глушить демо-озвучку:
    // быстрый путь выше пропустил такой запрос сюда, здесь авторизация РЕАЛЬНО провалилась —
    // отдаём снапшот демо-набора, как анониму.
    if (pubAud) return sendPubAud();
    // Без WWW-Authenticate: browser на этот заголовок рисует нативную Basic-модалку, и она
    // всплывала поверх витрины после «Выйти» — прощальный автосинк приложения (keepalive
    // /api/me) доживает до момента, когда кука уже стёрта logout'ом, и ловит этот 401.
    // Скриптам challenge не нужен: curl/gen-audio шлют Authorization проактивно, а
    // единственный интерактивный вход — форма /login.
    return send(res, 401, '{"error":"auth required"}');
  }

  if (url === "/api/me") {
    // day — дневной агрегат и серия ТЕМ ЖЕ счётом, что дашборд преподавателя (streakOfAgg):
    // виджет ученика и роспись прогресса обязаны показывать одно число
    // чтение без персиста: statsFor писал бы агрегат и СОЗДАВАЛ каталог events/<login>
    // на каждый /api/me (в т.ч. преподавателю) — тест «чужой каталог не создан» это стережёт
    let agg = readAgg(login); if (!agg || agg.v !== AGG_V) agg = rebuildAgg(login);
    const today = dayKeyOf(new Date().toISOString());
    const day = { key: today, ans: (agg.days[today] && agg.days[today].ans) || 0, streak: streakOfAgg(agg.days, today) };
    // courses — по чему ученик учится (постоянные + активные триалы): по нему клиент
    // строит тропу; trials — сроки для бейджей «до даты» (аддитивно, старый клиент игнорирует)
    const meSi = canEdit(login) ? null : studentInfo(login);
    const sttSt = sttState(login);
    return send(res, 200, JSON.stringify({ login, role: roleOf(login),
      courses: meSi ? effCoursesOf(meSi) : COURSE_IDS,
      trials: meSi ? meSi.trials : {},
      stt: { enabled: sttSt.on, why: sttSt.why, used: sttUsedToday(login),
        limit: sttLimitOf(login) === Infinity ? null : sttLimitOf(login) },
      modules: moduleStatuses(login), day,
      // преподавателю — счётчик непрочитанных тредов чата (аддитивно; индекс в памяти, без I/O)
      ...(canEdit(login) ? { chat: { unread: INBOX.unreadForTeacher().threads } } : {}) }));
  }

  // Пользователи: список и управление (teacher управляет учениками, admin — ещё и учителями)
  if (url === "/api/students" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    const isAdmin = roleOf(login) === "admin";
    const out = Object.keys(USERS)
      .filter((l) => isAdmin || roleOf(l) === "student")
      .map((l) => {
        const si = studentInfo(l);
        const r = roleOf(l);
        // Админа suspended не запирает (см. гейты входа), поэтому и в списке он всегда активен —
        // иначе UI показывал бы «приостановлен» тому, кто спокойно работает.
        // у преподавателя/админа «выданных курсов» нет — им доступен весь каталог,
        // как и в /api/me (единый контракт, вместо случайного дефолта studentInfo)
        return { login: l, role: r, courses: r === "student" ? si.courses : COURSE_IDS, trials: r === "student" ? si.trials : {}, modules: moduleStatuses(l), granted: si.granted, locked: si.locked, suspended: r === "admin" ? false : si.suspended, owner: si.owner,
          sttOn: r === "student" ? !!(readStudents()[l] || {}).stt : true, sttLimit: r === "student" ? sttLimitOf(l) : null, sttUse: sttTotals(l) };
      });
    return send(res, 200, JSON.stringify(out));
  }
  if (url === "/api/students" && req.method === "PUT") {
    return readJson(req, res, (d) => {
      const target = typeof d.login === "string" ? d.login : "";
      // Пароль принимаем только строкой: String({}) дал бы «[object Object]» длиной 15 — «валидный» пароль.
      const passOf = (v) => (typeof v === "string" ? v : null);
      // granted/locked валидируются по модулям ИТОГОВЫХ курсов ученика (сначала применяется
      // d.courses): «открыть досрочно» модуль невыданного курса — ошибка запроса, а не
      // молчаливый no-op, и в файле не копится мусор, ломающий запись при откате сервера.
      // При create — чистый лист, как и сама запись (cur = {}): остаточная запись прежнего
      // владельца логина не должна влиять на валидацию нового ученика (находка валидатора).
      const finalCourses = () => (d.courses != null ? validCourses(d.courses)
        : (d.create ? ["a1"] : studentInfo(target).courses)) || [];
      // Триалы участвуют в валидации granted/locked: досрочное открытие модуля
      // триал-курса — легитимно, как и у постоянного.
      const finalTrials = () => (d.trials != null ? validTrials(d.trials)
        : (d.create ? {} : studentInfo(target).trials)) || {};
      const validMods = (a) => {
        const ts = splitTrials(finalTrials());
        const allowed = new Set(modulesOfCourses(finalCourses().concat(ts.courses.filter((c) => !finalCourses().includes(c)))));
        for (const m of ts.mods) allowed.add(m);
        return Array.isArray(a) && a.every((m) => allowed.has(m));
      };
      const respondWith = (finalRole, si) => send(res, 200, JSON.stringify({
        ok: true, student: { login: target, role: finalRole, courses: si.courses, trials: si.trials, modules: moduleStatuses(target), granted: si.granted, locked: si.locked, suspended: !!si.suspended, owner: si.owner,
          sttOn: !!(readStudents()[target] || {}).stt, sttLimit: finalRole === "student" ? sttLimitOf(target) : null, sttUse: sttTotals(target) }
      }));

      // Свой пароль меняет любой вошедший, включая ученика — единственная операция без роли
      // преподавателя: иначе ротация пароля возможна только чужими руками.
      if (target === login) {
        const onlyPassword = d.password != null && !d.create && d.remove == null && d.role == null && d.granted == null && d.locked == null && d.suspended == null && d.owner == null && d.trials == null && d.stt == null;
        if (!onlyPassword) return send(res, 400, '{"error":"на своём аккаунте можно только сменить пароль"}');
        // Учётка админа живёт только в users.json, и оверлей для неё игнорируется (buildUsers):
        // записать пароль сюда — значит ответить «ок» и не сменить ничего.
        if (roleOf(login) === "admin") return send(res, 400, '{"error":"пароль админа меняется правкой users.json + деплой"}');
        const pass = passOf(d.password);
        if (pass == null || pass.length < 6) return send(res, 400, '{"error":"пароль минимум 6 символов"}');
        try {
          mutateUsersExtra(target, { password: pass });
          logger.info("students", "self password changed", { target });
          return respondWith(roleOf(target), studentInfo(target));
        } catch (e) { logger.error("students", "self password change failed", e, { target }); return send(res, 500, '{"error":"write failed"}'); }
      }

      if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
      if (d.role != null && !d.create) return send(res, 400, '{"error":"смена роли не поддерживается"}');
      if (d.create && d.remove) return send(res, 400, '{"error":"create и remove одновременно"}');
      // Валидация модулей — до любой записи: иначе «bad granted» откатывал бы ответ,
      // но уже созданный аккаунт оставался бы жить.
      if (d.courses != null && !validCourses(d.courses)) return send(res, 400, '{"error":"bad courses"}');
      if (d.trials != null && !validTrials(d.trials)) return send(res, 400, '{"error":"bad trials"}');
      if (d.sttLimit !== undefined && d.sttLimit !== null && !(Number.isInteger(d.sttLimit) && d.sttLimit >= 1 && d.sttLimit <= 500))
        return send(res, 400, '{"error":"bad sttLimit (1..500)"}');
      if (d.granted != null && !validMods(d.granted)) return send(res, 400, '{"error":"bad granted"}');
      if (d.locked != null && !validMods(d.locked)) return send(res, 400, '{"error":"bad locked"}');
      if (d.owner != null) {
        // Передавать учеников может только админ: иначе преподаватель забирал бы чужих себе.
        if (roleOf(login) !== "admin") return send(res, 403, '{"error":"передавать учеников может только админ"}');
        if (typeof d.owner !== "string") return send(res, 400, '{"error":"bad owner"}');
        // Пустая строка — «без преподавателя»; иначе владельцем может быть только учитель или админ.
        if (d.owner !== "" && !canEdit(d.owner)) return send(res, 400, '{"error":"владелец должен быть преподавателем"}');
      }

      if (d.create) {
        if (!isValidLogin(target)) return send(res, 400, '{"error":"логин: 2-24 символа, латиница/цифры/-/_"}');
        if (Object.prototype.hasOwnProperty.call(USERS, target)) return send(res, 400, '{"error":"такой логин уже есть"}');
        const pass = passOf(d.password);
        if (pass == null || pass.length < 6) return send(res, 400, '{"error":"пароль минимум 6 символов"}');
        const newRole = d.role || "student";
        if (newRole !== "student" && newRole !== "teacher") return send(res, 400, '{"error":"недопустимая роль"}');
        if (newRole === "teacher" && roleOf(login) !== "admin") return send(res, 403, '{"error":"учителей создаёт только админ"}');
        if (newRole === "teacher" && (d.granted != null || d.locked != null || d.suspended != null || d.courses != null || d.trials != null || d.stt != null || d.sttLimit !== undefined)) return send(res, 400, '{"error":"модули, курсы и приостановка — только ученикам"}');
        try {
          // Логин мог принадлежать другому человеку: прогресс и журнал занятий прежнего
          // владельца уводим в архив — иначе новый ученик получает чужие сданные модули
          // (и открытую по ним тропу) или чужой транскрипт занятий.
          archiveProgress(target);
          archiveEvents(target);
          INBOX.archive(CHAT_AUTH.studentId(target));   // и переписка с преподавателем
          // role пишем всегда явно — иначе пересоздание ранее удалённого логина может унаследовать
          // старую роль из оверлея (mutateUsersExtra мержит поля, а не заменяет запись целиком).
          mutateUsersExtra(target, { password: pass, removed: false, role: newRole });
          logger.info("students", "created", { target, role: newRole, by: login });
        } catch (e) { logger.error("students", "create failed", e, { target }); return send(res, 500, '{"error":"write failed"}'); }
      }

      if (!Object.prototype.hasOwnProperty.call(USERS, target)) return send(res, 400, '{"error":"нет такого пользователя"}');
      const finalRole = roleOf(target);
      // Единственное, что можно править у админа, — owner (чей он ученик): поле не даёт
      // прав и не ломает доступ, а «очередь внимания» преподавателя без него слепа.
      const onlyOwner = d.owner != null && d.create == null && d.remove == null && d.role == null &&
        d.password == null && d.granted == null && d.locked == null && d.suspended == null && d.courses == null && d.trials == null && d.stt == null;
      if (finalRole === "admin" && !onlyOwner) return send(res, 400, '{"error":"менять админа нельзя"}');
      if (finalRole === "teacher" && roleOf(login) !== "admin") return send(res, 403, '{"error":"учителей меняет только админ"}');

      if (d.remove) {
        // Логин из users.json удаляется правкой файла: надгробие в оверлее сильнее базы,
        // и потом восстановление через git молча не срабатывало бы («поправил файл — не входит»).
        if (Object.prototype.hasOwnProperty.call(RAW_USERS, target)) {
          return send(res, 400, '{"error":"пользователь заведён в users.json — удаляется правкой файла; здесь можно приостановить доступ"}');
        }
        try {
          // role:null — иначе повторное создание того же логина другим учителем унаследует роль teacher.
          mutateUsersExtra(target, { removed: true, password: null, role: null });
          INBOX.archive(CHAT_AUTH.studentId(target));   // переписка удалённой учётки — в архив, не в список учителя
          logger.info("students", "removed", { target, role: finalRole, by: login });
          return send(res, 200, '{"ok":true,"removed":true}');
        } catch (e) { logger.error("students", "remove failed", e, { target }); return send(res, 500, '{"error":"write failed"}'); }
      }

      if (d.password != null && !d.create) {
        const pass = passOf(d.password);
        if (pass == null || pass.length < 6) return send(res, 400, '{"error":"пароль минимум 6 символов"}');
        try {
          mutateUsersExtra(target, { password: pass });
          logger.info("students", "password changed", { target, by: login });
        } catch (e) { logger.error("students", "password change failed", e, { target }); return send(res, 500, '{"error":"write failed"}'); }
      }

      if ((d.granted != null || d.locked != null || d.courses != null || d.trials != null || d.stt != null || d.sttLimit !== undefined) && finalRole !== "student") {
        return send(res, 400, '{"error":"модули и курсы — только ученикам"}');
      }
      // owner допустим любой роли: админ/учитель тоже учится (владелец проходит курс
      // как ученик), и его результаты должны попадать в очередь внимания своего преподавателя.

      // Учителя без пришедшего suspended не трогаем в students.json — не плодить пустые записи.
      if (!d.create && finalRole === "teacher" && d.suspended == null && d.owner == null) {
        return respondWith(finalRole, studentInfo(target));
      }

      const map = readStudents();
      // На create — чистый лист: логин мог раньше принадлежать приостановленному/закрытому ученику,
      // и этот остаток в students.json не должен наследоваться новым владельцем логина.
      const cur = d.create ? {} : (map[target] || {});
      if (d.trials != null) {
        // полная замена, как courses; пустой объект = «снять все триалы» = поле уходит из файла.
        // Применяется ДО ветки d.courses: её чистка granted/locked должна видеть новые триалы.
        const tv = validTrials(d.trials);
        if (Object.keys(tv).length) cur.trials = tv; else delete cur.trials;
      }
      if (d.courses != null) {
        // Отнятый курс попадает в formerly: ученик перестаёт по нему учиться, но свои
        // результаты видит дальше. Старые курсы читаем через studentInfo (в файле поля
        // может не быть — дефолт «a1» живёт на чтении), иначе у давних учеников
        // formerly записался бы пустым и их прогресс пропал бы с глаз.
        const was = studentInfo(target); // нормализованные courses и formerly (в файле полей может не быть)
        const next = validCourses(d.courses); // канонический порядок (проверено выше — не null)
        const formerly = COURSE_IDS.filter((c) => !next.includes(c) && (was.courses.includes(c) || was.formerly.includes(c)));
        if (formerly.length) cur.formerly = formerly; else delete cur.formerly;
        cur.courses = next;
        // Отъём курса вычищает его модули из granted/locked: иначе в файле копится мусор,
        // а сервер до курсовой модели ответил бы 400 на любой PUT, эхом несущий этот массив.
        // Модули живых триалов (курсов и одиночные) при этом легитимны — их не выкидываем.
        const ts = splitTrials(validTrials(cur.trials) || {});
        const allowed = new Set(modulesOfCourses(cur.courses.concat(ts.courses.filter((c) => !cur.courses.includes(c)))));
        for (const m of ts.mods) allowed.add(m);
        if (Array.isArray(cur.granted)) cur.granted = cur.granted.filter((m) => allowed.has(m));
        if (Array.isArray(cur.locked)) cur.locked = cur.locked.filter((m) => allowed.has(m));
      }
      // постоянная выдача курса гасит его же триал: срок больше не нужен, в файле не мусорим
      if (cur.trials && Array.isArray(cur.courses)) {
        for (const c of cur.courses) delete cur.trials[c];
        if (!Object.keys(cur.trials).length) delete cur.trials;
      }
      if (d.granted != null) cur.granted = d.granted;
      if (d.locked != null) cur.locked = d.locked;
      if (d.suspended != null) cur.suspended = !!d.suspended;
      // аудирование — платная опция: true пишем, false убирает поле (в файле не мусорим)
      if (d.stt != null) { if (d.stt) cur.stt = true; else delete cur.stt; }
      // дневной лимит распознаваний: дефолт (20) в файле не храним
      if (d.sttLimit !== undefined) {
        if (d.sttLimit === null || d.sttLimit === STT_LIMIT) delete cur.sttLimit;
        else cur.sttLimit = d.sttLimit;
      }
      // Заводящий становится владельцем; дальше владельца меняет только админ (проверено выше).
      // У учителя преподавателя нет — поле осталось бы мусором в файле.
      if (d.create && finalRole === "student") cur.owner = login;
      else if (d.owner != null) cur.owner = d.owner;
      cur.by = login; cur.at = new Date().toISOString();
      map[target] = cur;
      try {
        atomicWrite(STUDENTS_FILE(), JSON.stringify(map));
        logger.info("students", "updated", { target, courses: cur.courses || ["a1"], granted: cur.granted || [], locked: cur.locked || [], suspended: !!cur.suspended, by: login });
        return respondWith(finalRole, studentInfo(target));
      } catch (e) {
        logger.error("students", "write failed", e, { target });
        return send(res, 500, '{"error":"write failed"}');
      }
    });
  }

  if (url === "/api/progress" && req.method === "GET") {
    try { return send(res, 200, fs.readFileSync(progressFile(login), "utf8")); }
    catch { return send(res, 200, "null"); }
  }

  if (url === "/api/progress" && req.method === "PUT") {
    return readJson(req, res, (st) => {
      if (st.v !== 1 && st.v !== 2) return send(res, 400, '{"error":"bad state"}');
      // sanity: структура и границы (подделка прогресса принята как риск, но мусор не пишем)
      if (st.v === 1 && (typeof st.vocab !== "object" || st.vocab === null)) return send(res, 400, '{"error":"bad state"}');
      if (st.v === 2) {
        if (!isV2State(st)) return send(res, 400, '{"error":"bad state"}');
        for (const m of Object.values(st.modules)) {
          const sc = m && m.test && m.test.lastAttempt && m.test.lastAttempt.score;
          if (sc != null && (typeof sc !== "number" || sc < 0 || sc > 20)) return send(res, 400, '{"error":"bad score"}');
        }
      }
      // копия другого логина (вкладка пережила смену аккаунта на общем устройстве) — не наша
      if (typeof st.login === "string" && st.login !== login) {
        logger.warn("progress", "foreign state rejected", { login, owner: st.login });
        return send(res, 409, '{"error":"состояние другого пользователя — страница обновится"}');
      }
      // защита от отката версии (гонка со старой вкладкой)
      const prev = readProgress(login);
      if (prev && prev.v === 2 && st.v === 1) {
        logger.warn("progress", "version downgrade rejected", { login });
        return send(res, 409, '{"error":"устаревшая версия страницы — обновите (Cmd/Ctrl+Shift+R)"}');
      }
      const file = progressFile(login);
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = file + "." + process.pid + ".tmp";
        const merged = mergeProgress(prev, st);
        fs.writeFileSync(tmp, JSON.stringify(merged));
        fs.renameSync(tmp, file);
        // restored — серверная копия что-то вернула (слияние поменяло updatedAt): клиент
        // забирает её только тогда, а не после каждой отправки
        return send(res, 200, JSON.stringify({ ok: true, restored: merged !== st && merged.updatedAt !== st.updatedAt }));
      } catch (e) {
        logger.error("progress", "write failed", e, { login });
        return send(res, 500, '{"error":"write failed"}');
      }
    });
  }

  // Журнал занятий: приём батча событий и его чтение.
  // Цель-ученик доступна учителю/админу; цель-teacher/admin — только админу (иначе один
  // преподаватель читал бы сырой ввод другого через тот же canEdit-гейт, что и для учеников).
  function resolveEventsTarget(req, login) {
    const wantLogin = q(req).get("login");
    if (!wantLogin || wantLogin === login) return { login, ok: true };
    // Роль проверяем ДО существования цели: иначе ответ 400 vs 403 позволял бы любому
    // вошедшему ученику перебором узнавать чужие логины, не имея права видеть чей-либо журнал.
    if (!canEdit(login)) return { ok: false, code: 403, error: "нужна роль преподавателя" };
    if (!Object.prototype.hasOwnProperty.call(USERS, wantLogin)) return { ok: false, code: 400, error: "нет такого пользователя" };
    const targetRole = roleOf(wantLogin);
    if (targetRole !== "student" && roleOf(login) !== "admin") return { ok: false, code: 403, error: "чужой журнал преподавателя видит только админ" };
    return { login: wantLogin, ok: true };
  }

  if (url === "/api/events" && req.method === "POST") {
    if (eventsLimiter.blocked(login)) {
      logger.warn("events", "rate limited", { login });
      return send(res, 429, '{"error":"слишком часто"}', null, { "Retry-After": "60" });
    }
    return readJson(req, res, (d) => {
      if (!Array.isArray(d.events)) return send(res, 400, '{"error":"bad json"}');
      const sid = typeof d.sid === "string" && /^[a-z0-9]{6,32}$/.test(d.sid) ? d.sid : null;
      if (!sid) return send(res, 400, '{"error":"bad sid"}');
      const month = yyyymmOf(new Date().toISOString());
      if (eventsFileQuotaExceeded(login, month)) {
        logger.warn("events", "file quota exceeded", { login, file: month });
        return send(res, 429, '{"error":"квота журнала исчерпана"}', null, { "Retry-After": "3600" });
      }
      try {
        const { accepted, dropped } = appendEvents(login, sid, d.events);
        eventsLimiter.note(login, accepted + dropped);
        return send(res, 200, JSON.stringify({ ok: true, accepted, dropped }));
      } catch (e) {
        // сырой ввод ученика в лог не попадает никогда — только счётчики
        logger.error("events", "write failed", e, { login, count: d.events.length });
        return send(res, 500, '{"error":"write failed"}');
      }
    });
  }

  if (url === "/api/events" && req.method === "GET") {
    const t = resolveEventsTarget(req, login);
    if (!t.ok) return send(res, t.code, JSON.stringify({ error: t.error }));
    const limit = clampInt(q(req).get("limit"), 1, 500, 200);
    // Курсор — по ts, не по (файл,строка): батч, отлежавший оффлайн, дописывается ПОСЛЕ более
    // свежих событий, и внутри файла хронологического порядка нет; отбор по ts переживает это,
    // сортировка — уже после отбора. Коллизии ts на одной мс теоретически возможны, но при
    // масштабе этой школы цена — редкий дубль/пропуск строки в глубине истории, не в текущей.
    const before = q(req).get("before");
    const beforeMs = before ? Date.parse(before) : Infinity;
    const dir = eventsLoginDir(t.login);
    let months = [];
    try { months = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort().reverse(); } catch {}
    months = months.slice(0, 3); // диапазон по умолчанию — 3 месяца, иначе линейное чтение всей истории на один запрос
    const items = [];
    for (const f of months) {
      let text = "";
      try { text = fs.readFileSync(path.join(dir, f), "utf8"); } catch { continue; }
      const lines = text.split("\n").filter(Boolean);
      const parsed = [];
      for (const line of lines) {
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev && ev.v === 1 && Date.parse(ev.ts) < beforeMs) parsed.push(ev);
      }
      parsed.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)); // новые сверху
      for (const ev of parsed) { items.push(ev); if (items.length >= limit) break; }
      if (items.length >= limit) break;
    }
    const nextBefore = items.length === limit ? items[items.length - 1].ts : null;
    return send(res, 200, JSON.stringify({ items, nextBefore }));
  }

  if (url === "/api/events/sessions" && req.method === "GET") {
    const t = resolveEventsTarget(req, login);
    if (!t.ok) return send(res, t.code, JSON.stringify({ error: t.error }));
    const agg = statsFor(t.login);
    const sessions = Object.entries(agg.sessions)
      .map(([sid, s]) => Object.assign({ sid }, s))
      .sort((a, b) => new Date(b.end) - new Date(a.end))
      .slice(0, 100);
    return send(res, 200, JSON.stringify(sessions));
  }

  if (url === "/api/stats" && req.method === "GET") {
    const t = resolveEventsTarget(req, login);
    if (!t.ok) return send(res, t.code, JSON.stringify({ error: t.error }));
    return send(res, 200, JSON.stringify(statsFor(t.login)));
  }

  if (url === "/api/stats/overview" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    // Список — от USERS, не от каталогов /data/events: иначе удалённый ученик,
    // чей журнал ещё не архивирован, всплыл бы в дашборде призраком.
    // Дашборд показывает только учеников (teacher/admin здесь не строки, а наблюдатели) —
    // как и GET /api/students, где учитель видит всех учеников.
    const today = dayKeyOf(new Date().toISOString());
    const out = Object.keys(USERS)
      .filter((l) => roleOf(l) === "student")
      .map((l) => {
        const agg = statsFor(l);
        const si = studentInfo(l);
        const streak = streakOfAgg(agg.days, today);
        // точность/время за 7 календарных дней (ключи дня — уже в TZ Бишкека, dayKeyOf)
        let ans7 = 0, ok7 = 0, ms7 = 0, c2 = new Date(today + "T00:00:00Z");
        for (let i = 0; i < 7; i++) {
          const d = agg.days[c2.toISOString().slice(0, 10)];
          if (d) { ans7 += d.ans; ok7 += d.ok; ms7 += d.ms; }
          c2.setUTCDate(c2.getUTCDate() - 1);
        }
        const prog = readProgress(l);
        // Прогресс — по модулям ВЫДАННЫХ курсов (и числитель, и знаменатель): по глобальному
        // MODULES ученик A1 «просел» бы с появлением модулей A2, а после отъёма курса со
        // сданными модулями получил бы прогресс больше единицы.
        const myMods = modulesOfCourses(si.courses);
        const passedMods = myMods.filter((mid) => everPassedMod(prog, mid)).length;
        // сигнал «тест провален дважды подряд» — из прогресса (авторитетный источник), не из
        // журнала: agg.tests хранит последние попытки вперемешку по всем модулям сразу
        const testFails2 = !!(prog && prog.modules && Object.values(prog.modules)
          .some((mm) => mm && mm.test && (mm.test.consecutiveFails || 0) >= 2));
        // Журнал появился позже прогресса: у тех, кто занимался до него, он пуст. Активность и
        // последнюю попытку теста добираем из файла прогресса — иначе дашборд писал «ни разу»
        // и «—» тому, кто реально учился, да ещё и рядом с сигналом «тест провален 2×».
        const attempts = prog && prog.modules ? Object.entries(prog.modules)
          .map(([mid, mm]) => mm && mm.test && mm.test.lastAttempt ? Object.assign({ mod: mid }, mm.test.lastAttempt) : null)
          .filter(Boolean).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))) : [];
        const lastTest = agg.tests[0] ||
          (attempts[0] ? { mod: attempts[0].mod, score: attempts[0].score, total: attempts[0].total || 20, ts: attempts[0].date } : null);
        return {
          login: l, owner: si.owner, lastSeen: agg.lastSeen || (prog && prog.updatedAt) || null,
          streak, totals: agg.totals,
          progress: myMods.length ? passedMods / myMods.length : 0, acc7: ans7 ? ok7 / ans7 : null,
          minutes7: Math.round(ms7 / 60000), lastTest, testFails2
        };
      });
    return send(res, 200, JSON.stringify(out));
  }

  // Вычитка (review) и правки контента (overrides): /api/review/m0, /api/overrides/m0.
  // Читают все вошедшие; пишут только роли teacher/admin. Хранение — JSON-файлы в /data.
  const mrev = url.match(/^\/api\/(review|overrides)\/(m\d+)$/);
  if (mrev) {
    const kind = mrev[1], mod = mrev[2];
    // Материал чужого курса не отдаём даже построчно: вычитка и правки несут сами фразы.
    if (!modAllowed(login, mod)) return send(res, 403, '{"error":"модуль вне выданных курсов"}');
    const file = path.join(DATA_DIR, kind, mod + ".json");
    if (req.method === "GET") {
      try { return send(res, 200, fs.readFileSync(file, "utf8")); }
      catch { return send(res, 200, "{}"); }
    }
    if (req.method === "PUT") {
      if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
      return readJson(req, res, (d) => {
        const id = String(d.id || "");
        if (!/^[a-z0-9_]{1,40}$/.test(id)) return send(res, 400, '{"error":"bad id"}');
        let map = {};
        try { map = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
        if (d.remove) { delete map[id]; }
        else {
          const entry = { by: login, at: new Date().toISOString() };
          if (kind === "review") {
            if (d.status == null && d.comment == null && d.audioOk == null) return send(res, 400, '{"error":"empty review"}');
            if (d.status != null) {
              if (!["ok", "fixed", "question"].includes(d.status)) return send(res, 400, '{"error":"bad status"}');
              entry.status = d.status;
            }
            if (d.comment) entry.comment = String(d.comment).slice(0, 2000);
            if (d.audioOk != null) entry.audioOk = !!d.audioOk;
          } else {
            // правка перевода хранится для всех языков интерфейса: ученик в en/tr
            // иначе продолжит видеть старый глосс, и на нём же строятся дистракторы теста
            if (d.ky != null) entry.ky = String(d.ky).slice(0, 500);
            // Произношение для озвучки: на экране ученик по-прежнему видит `ky`, а TTS
            // читает `say`. Нужно там, где орфография вводит модель в заблуждение:
            // заимствование «команда» v3 читал как [куманда], транскрипция /komɑndɑ/
            // держит кыргызское [о] (замер формант, 2026-08-17).
            if (d.say != null) entry.say = String(d.say).slice(0, 300);
            if (d.ru != null) entry.ru = String(d.ru).slice(0, 500);
            if (d.en != null) entry.en = String(d.en).slice(0, 500);
            if (d.tr != null) entry.tr = String(d.tr).slice(0, 500);
            if (Array.isArray(d.accept)) entry.accept = d.accept.map((x) => String(x).slice(0, 200)).slice(0, 10);
          }
          map[id] = Object.assign(map[id] || {}, entry);
        }
        try {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          const tmp = file + "." + process.pid + ".tmp";
          fs.writeFileSync(tmp, JSON.stringify(map));
          fs.renameSync(tmp, file);
          return send(res, 200, JSON.stringify({ ok: true, item: map[id] || null }));
        } catch (e) {
          logger.error("content", "write failed", e, { kind, mod, id });
          return send(res, 500, '{"error":"write failed"}');
        }
      });
    }
  }

  // Бэкапы тома /data (только admin): создание — tar.gz всего каталога кроме самих
  // бэкапов; ротация оставляет BACKUP_KEEP свежих; скачивание и загрузка — потоками
  // (архив в сотни МБ не должен жить в памяти однопоточного сервера); восстановление —
  // только с явным confirm. Ежедневный автобэкап — таймер ниже (backupTick).
  if (url === "/api/admin/backups" && req.method === "GET") {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    return send(res, 200, JSON.stringify(listBackups()));
  }
  if (url === "/api/admin/backups" && req.method === "POST") {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    return makeBackup((e, r) => {
      if (e && e.message === "busy") return send(res, 429, '{"error":"бэкап уже идёт"}');
      if (e) { logger.error("backup", "create failed", e); return send(res, 500, '{"error":"backup failed"}'); }
      logger.info("backup", "created", { name: r.name, bytes: r.bytes, by: login });
      return send(res, 200, JSON.stringify({ ok: true, name: r.name, bytes: r.bytes }));
    });
  }
  /* Прогресс ученика для диагностики и ремонта — только админ. GET отдаёт файл как есть;
     PUT заменяет его целиком БЕЗ слияния (для восстановления из бэкапа после порчи),
     прежняя копия остаётся рядом как <login>.json.<ts>.bak, факт — в журнале сервера. */
  const mAdmProg = url.match(/^\/api\/admin\/progress\/([a-z0-9_-]{2,24})$/);
  if (mAdmProg) {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    const target = mAdmProg[1];
    if (!Object.prototype.hasOwnProperty.call(USERS, target)) return send(res, 400, '{"error":"нет такого пользователя"}');
    if (req.method === "GET") {
      try { return send(res, 200, fs.readFileSync(progressFile(target), "utf8")); }
      catch { return send(res, 200, "null"); }
    }
    if (req.method === "PUT") {
      return readJson(req, res, (st) => {
        if (!isV2State(st)) return send(res, 400, '{"error":"bad state"}');
        const file = progressFile(target);
        try {
          let bak = null;
          if (fs.existsSync(file)) { bak = file + "." + new Date().toISOString().replace(/[:.]/g, "-") + ".bak"; fs.copyFileSync(file, bak); }
          atomicWrite(file, JSON.stringify(st));
          logger.warn("progress", "admin replaced", { login: target, by: login, bak: bak && path.basename(bak) });
          return send(res, 200, JSON.stringify({ ok: true, bak: bak && path.basename(bak) }));
        } catch (e) { logger.error("progress", "admin replace failed", e, { login: target }); return send(res, 500, '{"error":"write failed"}'); }
      });
    }
    return send(res, 405, '{"error":"method"}');
  }
  const mBak = url.match(/^\/api\/admin\/backups\/([A-Za-z0-9._-]{1,80})(\/restore)?$/);
  if (mBak) {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    const name = mBak[1];
    if (!BACKUP_RE.test(name)) return send(res, 400, '{"error":"bad name"}');
    const file = path.join(backupDir(), name);
    if (mBak[2] && req.method === "POST") {
      // Восстановление затирает живые данные — только с явной подписью. Кэши процесса
      // (демо-набор, варианты страницы) останутся старыми — нужен рестарт, о чём и отвечаем.
      return readJson(req, res, (d) => {
        if (d.confirm !== "restore") return send(res, 400, '{"error":"нужен confirm:\\"restore\\""}');
        if (!fs.existsSync(file)) return send(res, 404, '{"error":"нет такого бэкапа"}');
        restoreBackup(file, (e) => {
          if (e) { logger.error("backup", "restore failed", e, { name }); return send(res, 500, '{"error":"restore failed"}'); }
          logger.warn("backup", "RESTORED", { name, by: login });
          return send(res, 200, JSON.stringify({ ok: true, note: "данные восстановлены; кэши процесса старые — нужен рестарт контейнера" }));
        });
      });
    }
    if (req.method === "GET") {
      let st; try { st = fs.statSync(file); } catch { return send(res, 404, '{"error":"нет такого бэкапа"}'); }
      res.writeHead(200, { "Content-Type": "application/gzip", "Content-Length": st.size,
        "Content-Disposition": 'attachment; filename="' + name + '"', "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (req.method === "DELETE") {
      try { fs.unlinkSync(file); } catch { return send(res, 404, '{"error":"нет такого бэкапа"}'); }
      logger.info("backup", "deleted", { name, by: login });
      return send(res, 200, '{"ok":true}');
    }
    if (req.method === "PUT") {
      // Приём архива потоком во временный файл: readBinary держал бы сотни МБ в памяти.
      fs.mkdirSync(backupDir(), { recursive: true });
      const tmp = file + "." + process.pid + ".up.tmp";
      const out = fs.createWriteStream(tmp);
      let size = 0, overflow = false;
      req.on("data", (c) => { size += c.length; if (size > BACKUP_MAX_UPLOAD) { overflow = true; req.pause(); out.destroy(); } });
      req.pipe(out);
      req.on("end", () => {
        if (overflow) { try { fs.unlinkSync(tmp); } catch {} return send(res, 413, '{"error":"too large"}'); }
        out.end(() => {
          // подпись gzip (1f 8b) — защита от заливки не-архива на место бэкапа
          const head = Buffer.alloc(2);
          try { const fd = fs.openSync(tmp, "r"); fs.readSync(fd, head, 0, 2, 0); fs.closeSync(fd); } catch {}
          if (size < 2 || head[0] !== 0x1f || head[1] !== 0x8b) { try { fs.unlinkSync(tmp); } catch {} return send(res, 400, '{"error":"не gzip-архив"}'); }
          fs.renameSync(tmp, file);
          logger.info("backup", "uploaded", { name, bytes: size, by: login });
          return send(res, 200, JSON.stringify({ ok: true, name, bytes: size }));
        });
      });
      req.on("error", () => { try { fs.unlinkSync(tmp); } catch {} });
      return;
    }
    return send(res, 405, '{"error":"method"}');
  }

  // Секреты (только admin): PUT /api/admin/secret {name, value} → /data/secrets/<name>.key
  if (url === "/api/admin/secret" && req.method === "PUT") {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    return readJson(req, res, (d) => {
      const name = String(d.name || "");
      if (!/^[a-z0-9-]{1,32}$/.test(name) || !d.value) return send(res, 400, '{"error":"bad name/value"}');
      try { atomicWrite(path.join(DATA_DIR, "secrets", name + ".key"), String(d.value).trim()); logger.info("secrets", "secret stored", { name }); return send(res, 200, '{"ok":true}'); }
      catch (e) { logger.error("secrets", "write failed", e, { name }); return send(res, 500, '{"error":"write failed"}'); }
    });
  }

  // Ненайденные запросы переводчика: преподавателю и админу — что люди ищут, а в курсе нет
  if (url === "/api/admin/pv-miss" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"только преподаватель"}');
    return send(res, 200, JSON.stringify({ items: PV_MISS.top() }));
  }
  // удалить запрос по просьбе человека (в нём имя, адрес и т.п.): тело {lang, q} — как в списке
  if (url === "/api/admin/pv-miss" && req.method === "DELETE") {
    if (!canEdit(login)) return send(res, 403, '{"error":"только преподаватель"}');
    return readJson(req, res, (d) => {
      if (typeof d.lang !== "string" || typeof d.q !== "string") return send(res, 400, '{"error":"bad input"}');
      try {
        if (!PV_MISS.remove(d.lang, d.q)) return send(res, 404, '{"error":"not found"}');
        logger.info("pv-miss", "deleted", { lang: d.lang, by: login }); // сам текст — нет: в нём может быть личное
        return send(res, 200, '{"ok":true}');
      }
      catch (e) { logger.error("pv-miss", "write failed", e, {}); return send(res, 500, '{"error":"write failed"}'); }
    });
  }
  // Сброс голосового оверрайда (только admin): /data/tts-voice пишет автофолбэк,
  // когда заданный голос недоступен (402/404), и файл сильнее env и реестра —
  // без этой ручки после смены голоса он снимался бы только шеллом в контейнер.
  if (url === "/api/admin/tts-voice" && req.method === "DELETE") {
    if (roleOf(login) !== "admin") return send(res, 403, '{"error":"только админ"}');
    try { fs.rmSync(path.join(DATA_DIR, "tts-voice"), { force: true }); }
    catch (e) { logger.error("tts", "override delete failed", e); return send(res, 500, '{"error":"delete failed"}'); }
    VOICE_ID_CACHE = null;
    logger.info("tts", "voice override cleared", { voice: TTS_VOICE_ID || null });
    return send(res, 200, JSON.stringify({ ok: true, voice: TTS_VOICE_ID }));
  }

  // Аудио фраз: список, отдача, загрузка (teacher/admin), генерация TTS (teacher/admin)
  // Один гард на всё семейство: список, мета и сами файлы несут материал модуля,
  // и открывать их шире, чем страницу, значило бы отдать курс в обход сборки.
  const mAudioMod = url.match(/^\/api\/audio\/(m\d+)\//);
  if (mAudioMod && req.method === "GET" && !modAllowed(login, mAudioMod[1])) {
    // фразы разговорника публичны снимком — вошедший без курса слышит их так же,
    // как аноним (private-кэш ставит sendPubAud по куке); всё остальное — 403
    if (pubAud) return sendPubAud();
    return send(res, 403, '{"error":"модуль вне выданных курсов"}');
  }
  const mMeta = url.match(/^\/api\/audio\/(m\d+)\/meta$/);
  if (mMeta && req.method === "GET") return send(res, 200, JSON.stringify(readAudioMeta(mMeta[1])));
  const mList = url.match(/^\/api\/audio\/(m\d+)\/list$/);
  if (mList && req.method === "GET") {
    try {
      const ids = fs.readdirSync(path.join(DATA_DIR, "audio", mList[1])).filter(f => f.endsWith(".mp3")).map(f => f.slice(0, -4));
      return send(res, 200, JSON.stringify(ids));
    } catch { return send(res, 200, "[]"); }
  }
  const mAud = url.match(/^\/api\/audio\/(m\d+)\/([a-z0-9_]{1,40})\.mp3$/);
  if (mAud && req.method === "GET") {
    try {
      const buf = fs.readFileSync(audioFile(mAud[1], mAud[2]));
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": buf.length, "Cache-Control": "private, max-age=600" });
      return res.end(buf);
    } catch { return send(res, 404, '{"error":"нет аудио"}'); }
  }
  if (mAud && req.method === "DELETE") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    try { fs.unlinkSync(audioFile(mAud[1], mAud[2])); } catch { return send(res, 404, '{"error":"нет такого аудио"}'); }
    const meta = readAudioMeta(mAud[1]);
    if (meta[mAud[2]]) { delete meta[mAud[2]]; atomicWrite(audioMetaFile(mAud[1]), JSON.stringify(meta)); }
    logger.info("audio", "deleted", { mod: mAud[1], id: mAud[2], by: login });
    return send(res, 200, '{"ok":true}');
  }
  if (mAud && req.method === "PUT") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    return readBinary(req, res, 8 * 1024 * 1024, (buf) => {
      if (!buf.length) return send(res, 400, '{"error":"пустой файл"}');
      try {
        atomicWrite(audioFile(mAud[1], mAud[2]), buf);
        setAudioMeta(mAud[1], mAud[2], { source: "upload", by: login, at: new Date().toISOString() });
        logger.info("audio", "uploaded", { mod: mAud[1], id: mAud[2], bytes: buf.length, by: login });
        return send(res, 200, '{"ok":true}');
      }
      catch (e) { logger.error("audio", "write failed", e, { mod: mAud[1], id: mAud[2] }); return send(res, 500, '{"error":"write failed"}'); }
    });
  }
  /* Видеоуроки: заливка mp4, YouTube-ссылка и удаление — преподавателю (раздача
     публичная выше, в незалогиненной зоне). Приём — потоком во временный файл
     (ролик ~15 МБ, readBinary держал бы его в памяти целиком), подпись ftyp в
     заголовке файла — защита от заливки не-mp4 на публичный адрес. */
  const mVideoPut = url.match(/^\/api\/video\/([a-z0-9-]{1,60}\.(mp4|jpg))$/);
  if (mVideoPut && req.method === "PUT") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    fs.mkdirSync(path.join(DATA_DIR, "video"), { recursive: true });
    const file = path.join(DATA_DIR, "video", mVideoPut[1]);
    const tmp = file + "." + process.pid + ".up.tmp";
    const out = fs.createWriteStream(tmp);
    let size = 0, overflow = false;
    req.on("data", (c) => { size += c.length; if (size > 200 * 1024 * 1024) { overflow = true; req.pause(); out.destroy(); } });
    req.pipe(out);
    req.on("end", () => {
      if (overflow) { try { fs.unlinkSync(tmp); } catch {} return send(res, 413, '{"error":"too large"}'); }
      out.end(() => {
        // подпись по типу: ftyp у mp4, ffd8 у jpg — чужое на публичный адрес не заливается
        const head = Buffer.alloc(8);
        try { const fd = fs.openSync(tmp, "r"); fs.readSync(fd, head, 0, 8, 0); fs.closeSync(fd); } catch {}
        const okSig = mVideoPut[2] === "jpg" ? (size >= 2 && head[0] === 0xff && head[1] === 0xd8)
          : (size >= 8 && head.slice(4, 8).toString("latin1") === "ftyp");
        if (!okSig) { try { fs.unlinkSync(tmp); } catch {} return send(res, 400, '{"error":"не " + mVideoPut[2]}'); }
        fs.renameSync(tmp, file);
        logger.info("video", "uploaded", { file: mVideoPut[1], bytes: size, by: login });
        return send(res, 200, JSON.stringify({ ok: true, file: mVideoPut[1], bytes: size }));
      });
    });
    req.on("error", () => { try { fs.unlinkSync(tmp); } catch {} });
    return;
  }
  if (mVideoPut && req.method === "DELETE") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    try { fs.unlinkSync(path.join(DATA_DIR, "video", mVideoPut[1])); } catch { return send(res, 404, '{"error":"нет ролика"}'); }
    logger.info("video", "deleted", { file: mVideoPut[1], by: login });
    return send(res, 200, '{"ok":true}');
  }
  if (url === "/api/video/meta" && req.method === "PUT") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    return readJson(req, res, (d) => {
      const f = String(d.file || "");
      if (!/^[a-z0-9-]{1,60}\.mp4$/.test(f) || !fs.existsSync(path.join(DATA_DIR, "video", f)))
        return send(res, 400, '{"error":"нет такого ролика"}');
      // поля независимы: непереданное не трогаем, null снимает (заливка глав
      // не должна стирать сохранённую YouTube-ссылку, и наоборот)
      const mf = path.join(DATA_DIR, "video", "video-meta.json");
      let meta = {}; try { meta = JSON.parse(fs.readFileSync(mf, "utf8")); } catch {}
      const rec = meta[f] || {};
      if ("youtube" in d) {
        const yt = d.youtube == null || d.youtube === "" ? null : String(d.youtube);
        if (yt && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/[\w\-?&=./%]+$/.test(yt))
          return send(res, 400, '{"error":"ссылка должна вести на YouTube"}');
        if (yt) rec.youtube = yt; else delete rec.youtube;
      }
      if ("chapters" in d) {
        const ch = d.chapters;
        if (ch != null) {
          if (!Array.isArray(ch) || ch.length > 50 ||
            ch.some((c) => !c || !/^[a-z0-9]{1,20}$/.test(String(c.id || "")) || !Number.isFinite(c.start) || c.start < 0))
            return send(res, 400, '{"error":"главы: массив {id, start≥0}"}');
          rec.chapters = ch.map((c) => ({ id: String(c.id), start: Math.round(c.start) }));
        } else delete rec.chapters;
      }
      if (Object.keys(rec).length) meta[f] = rec; else delete meta[f];
      atomicWrite(mf, JSON.stringify(meta));
      logger.info("video", "meta", { file: f, youtube: rec.youtube || null, chapters: (rec.chapters || []).length, by: login });
      return send(res, 200, JSON.stringify({ ok: true, file: f, youtube: rec.youtube || null, chapters: rec.chapters || null }));
    });
  }
  // Здоровье TTS: жив ли ключ ElevenLabs (список голосов — бесплатный вызов).
  // Нужен, когда ключ ротируют на стороне ElevenLabs: генерация ломается молча.
  if (url === "/api/tts/voices" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    const key = getSecret("elevenlabs") || process.env.ELEVENLABS_API_KEY;
    if (!key) return send(res, 400, '{"error":"ключ ElevenLabs не настроен"}');
    return elevenVoices(key, (err, code, body) => {
      if (err || code !== 200) return send(res, 502, '{"error":"tts: голоса недоступны"}');
      let list; try { list = JSON.parse(String(body)).voices || []; } catch { list = []; }
      const out = list.map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels || {} }));
      return send(res, 200, JSON.stringify(out));
    });
  }
  // Звуковые сцены (ElevenLabs sound generation) для «Диалогов»: школьный звонок,
  // перемена, вечер во дворе. Файл ложится рядом с TTS-фразами модуля.
  const mSfx = url.match(/^\/api\/tts\/sfx\/(m\d+)$/);
  if (mSfx && req.method === "POST") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    return readJson(req, res, (d) => {
      const id = String(d.id || ""), text = String(d.text || "").slice(0, 300).trim();
      const dur = Math.min(22, Math.max(2, Number(d.duration) || 8)); // 22 — потолок ElevenLabs sound-generation
      if (!ID_RE.test(id) || !text) return send(res, 400, '{"error":"bad id/text"}');
      const key = getSecret("elevenlabs") || process.env.ELEVENLABS_API_KEY;
      if (!key) return send(res, 400, '{"error":"ключ ElevenLabs не настроен"}');
      const payload = JSON.stringify({ text, duration_seconds: dur });
      const rq = https.request({ hostname: "api.elevenlabs.io", path: "/v1/sound-generation",
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, (r) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (r.statusCode !== 200 || !buf.length) { logger.warn("tts", "sfx failed", { id, status: r.statusCode }); return send(res, 502, JSON.stringify({ error: "sfx: HTTP " + r.statusCode })); }
          try {
            atomicWrite(audioFile(mSfx[1], id), buf);
            setAudioMeta(mSfx[1], id, { source: "sfx", by: login, at: new Date().toISOString() });
            logger.info("tts", "sfx generated", { id, bytes: buf.length });
            return send(res, 200, JSON.stringify({ ok: true, bytes: buf.length }));
          } catch (e) { return send(res, 500, '{"error":"write failed"}'); }
        });
      });
      rq.on("error", () => send(res, 502, '{"error":"sfx недоступен"}'));
      rq.setTimeout(45000, () => rq.destroy(new Error("sfx timeout")));
      rq.write(payload); rq.end();
    });
  }
  if (url === "/api/tts/health" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    const key = getSecret("elevenlabs") || process.env.ELEVENLABS_API_KEY;
    if (!key) return send(res, 400, '{"error":"ключ ElevenLabs не настроен"}');
    return elevenVoices(key, (err, code, buf) => {
      if (err) return send(res, 502, JSON.stringify({ ok: false, error: String(err.message || err) }));
      if (code !== 200) return send(res, 200, JSON.stringify({ ok: false, status: code, hint: "ключ отклонён — вероятно, ротирован на стороне ElevenLabs" }));
      let n = 0; try { n = (JSON.parse(buf).voices || []).length; } catch {}
      return send(res, 200, JSON.stringify({ ok: true, voices: n, voice: currentVoiceId(), model: TTS_MODEL }));
    });
  }

  /* ---------- Аудирование (эксперимент): распознавание речи ученика ----------
     Платная опция per-ученик: поле stt в students.json включает преподаватель,
     по умолчанию выключено у всех (аддитивно — существующие записи не задеты).
     Триальному недоступно даже включённым: m0 обязан идти постоянным курсом.
     Лимит STT_LIMIT распознаваний в день. Затраты — в единицах ElevenLabs
     (секунды аудио, символы распознанного, снимок остатка квоты аккаунта) —
     копятся по ученикам в /data/stt-usage.json. */
  if (url === "/api/stt/state" && req.method === "GET") {
    const st = sttState(login);
    const lim = sttLimitOf(login);
    return send(res, 200, JSON.stringify({ enabled: st.on, why: st.why, used: sttUsedToday(login), limit: lim === Infinity ? null : lim }));
  }
  if (url === "/api/stt/usage" && req.method === "GET") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    return send(res, 200, JSON.stringify(readSttUsage()));
  }
  if (url === "/api/stt/m0" && req.method === "POST") {
    const st = sttState(login);
    if (!st.on) {
      return send(res, 403, JSON.stringify({ error: st.why === "trial"
        ? "Аудирование недоступно на триальном доступе" : "Аудирование не включено преподавателем", code: st.why }));
    }
    const used = sttUsedToday(login);
    const lim = sttLimitOf(login);
    if (used >= lim) { // у преподавателя lim = Infinity — безлимит
      return send(res, 429, JSON.stringify({ error: "Дневной лимит аудирования исчерпан", used, limit: lim }));
    }
    const key = getSecret("elevenlabs-stt") || process.env.ELEVEN_STT_KEY;
    if (!key) return send(res, 400, '{"error":"ключ распознавания не настроен"}');
    const ctype = String(req.headers["content-type"] || "audio/webm").split(";")[0];
    if (!/^audio\//.test(ctype) && ctype !== "video/webm") return send(res, 400, '{"error":"нужно аудио"}');
    return readBinary(req, res, 2 * 1024 * 1024, (buf) => {
      if (!buf.length) return send(res, 400, '{"error":"пустая запись"}');
      const fd = new FormData();
      fd.append("model_id", "scribe_v1");
      fd.append("language_code", "ky");
      fd.append("file", new Blob([buf], { type: ctype }), "rec.webm");
      const started = Date.now();
      fetch(STT_URL, { method: "POST", headers: { "xi-api-key": key }, body: fd, signal: AbortSignal.timeout(STT_TIMEOUT_MS) })
        .then(async (r) => {
          const bodyText = await r.text();
          if (r.status !== 200) {
            logger.warn("stt", "non-200 from elevenlabs", { status: r.status, excerpt: bodyText.slice(0, 160) });
            return send(res, 502, '{"error":"распознавание недоступно"}');
          }
          let d = {};
          try { d = JSON.parse(bodyText); } catch {}
          const text = String(d.text || "").slice(0, 500);
          // секунды — из таймингов слов (Scribe тарифицируется длительностью аудио)
          const words = Array.isArray(d.words) ? d.words : [];
          const sec = Math.max(0, Math.round(((words.length && words[words.length - 1].end) || 0) * 10) / 10);
          const day = dayKeyOf(new Date().toISOString());
          try {
            const u = readSttUsage();
            u.users[login] = u.users[login] || {};
            const rec = u.users[login][day] || { n: 0, sec: 0, chars: 0 };
            rec.n += 1; rec.sec = Math.round((rec.sec + sec) * 10) / 10; rec.chars += text.length;
            u.users[login][day] = rec;
            atomicWrite(STT_USAGE_FILE(), JSON.stringify(u));
          } catch (e) { logger.error("stt", "usage write failed", e, { login }); }
          logger.info("stt", "recognized", { login, sec, chars: text.length, ms: Date.now() - started });
          // снимок остатка квоты аккаунта — best effort, поверх основного ответа
          snapshotSttRemaining(key);
          const lim2 = sttLimitOf(login);
          return send(res, 200, JSON.stringify({ text, sec, used: sttUsedToday(login), limit: lim2 === Infinity ? null : lim2 }));
        })
        .catch((e) => { logger.error("stt", "request failed", e, {}); return send(res, 502, '{"error":"распознавание недоступно"}'); });
    });
  }

  /* ===CHAT-TEACHER=== Входящие преподавателя: список сводок, тред, ответ, «прочитано», счётчик */
  if (url.startsWith("/api/chat/")) {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    if (url === "/api/chat/unread" && req.method === "GET") return send(res, 200, JSON.stringify(INBOX.unreadForTeacher()));
    if (url === "/api/chat/threads" && req.method === "GET") {
      const qs = q(req);
      const limit = clampInt(qs.get("limit"), 1, 500, 200);
      const all = INBOX.listSummaries();
      const rows = qs.get("state") === "unread" ? all.filter((s) => s.unread > 0) : all;
      return send(res, 200, JSON.stringify(rows.slice(0, limit)));
    }
    const m = url.match(/^\/api\/chat\/threads\/([^/]+)(\/reply|\/seen)?$/);
    if (m) {
      let id; try { id = decodeURIComponent(m[1]); } catch { id = ""; }
      const t = CHAT_AUTH.ID_RE.test(id) ? INBOX.readThread(id) : null;
      if (!t) return send(res, 404, '{"error":"нет треда"}');
      if (!m[2] && req.method === "GET") return send(res, 200, JSON.stringify(t));
      if (m[2] === "/seen" && req.method === "POST") return readBody(req, res, () => { INBOX.markSeenById(t.id, "teacher"); return send(res, 200, '{"ok":true}'); });
      if (m[2] === "/reply" && req.method === "POST") {
        return readJson(req, res, (d) => {
          const v = INBOX.validateInput({ text: d.text }); // предел длины ответа — тот же, что у письма
          if (v.error) return send(res, 400, JSON.stringify({ error: v.error }));
          let msg;
          try { msg = INBOX.appendMessageById(t.id, "teacher", v.text, login); } // перечитывает тред перед записью
          catch (e) { logger.error("chat", "write failed", e, { id: t.id }); return send(res, 500, '{"error":"write failed"}'); }
          if (!msg) return send(res, 404, '{"error":"нет треда"}');
          logger.info("chat", "reply", { id: t.id, by: login, len: v.text.length });
          return send(res, 200, JSON.stringify({ ok: true, msg }));
        });
      }
    }
    return send(res, 404, '{"error":"not found"}');
  }
  /* ===/CHAT-TEACHER=== */

  /* ===EXAM-WORK=== Продуктивные субтесты экзаменов (Жазуу, Сүйлөө — любой курс).
     Машина их не оценит: работа (текст письма либо запись монолога с транскрипцией)
     уходит преподавателю, он выставляет балл — решение владельца 22.08.2026.
     Хранение: /data/exam-work/<login>.json (последние 50 работ) + аудио рядом.
     Доступ: сдаёт только ученик с открытой экзаменационной неделей (реестр
     EXAM_MODS из сборки), список и оценка — свои работы либо преподаватель. */
  if (url === "/api/exam/work" && req.method === "GET") {
    const target = q(req).get("login") || login;
    if (target !== login && !canEdit(login)) return send(res, 403, '{"error":"чужие работы видит преподаватель"}');
    // файл и есть готовый JSON (atomicWrite ниже) — parse→stringify не нужен
    let raw; try { raw = fs.readFileSync(examWorkFile(target), "utf8"); } catch { raw = "[]"; }
    return send(res, 200, raw);
  }
  if (url === "/api/exam/voice" && req.method === "POST") {
    if (!examAllowed(login)) return send(res, 403, '{"error":"экзамен закрыт: нет доступа к экзаменационной неделе"}');
    // квота как у аудирования: без лимита один ученик забивал том (ревью 22.08,
    // critical) — записи живут ещё и в ротации бэкапов. Триальному доступу
    // отказ такой же, как в STT: ресурс ограниченный.
    if (sttState(login).why === "trial") return send(res, 403, '{"error":"запись недоступна на триальном доступе"}');
    if (examVoiceLimiter.blocked(login)) return send(res, 429, '{"error":"слишком много записей, подождите"}');
    const ctype = String(req.headers["content-type"] || "audio/webm").split(";")[0];
    // ctype уже без параметров (split по ";"): MediaRecorder даёт audio/webm;codecs=opus.
    // Анкер обязателен, иначе «audio/…» проходило любым префиксом.
    if (!/^audio\/[a-z0-9.+-]+$|^video\/webm$/.test(ctype)) return send(res, 400, '{"error":"нужно аудио"}');
    return readBinary(req, res, 5 * 1024 * 1024, (buf) => {
      if (!buf.length) return send(res, 400, '{"error":"пустая запись"}');
      examVoiceLimiter.note(login, 1);
      const dir = path.join(EXAM_WORK_DIR(), "audio");
      fs.mkdirSync(dir, { recursive: true });
      // ротация записей: держим до EXAM_AUDIO_KEEP свежих .webm на ученика,
      // старые сносим — иначе список работ обрезается на 50, а файлы копятся вечно
      try {
        // имя несёт base36-время (rid) — лексикографический порядок хронологичен,
        // statSync на каждый файл не нужен
        const mine = fs.readdirSync(dir).filter((f) => examAudioOwner(f) === safeLoginSlug(login))
          .sort().reverse();
        for (const old of mine.slice(EXAM_AUDIO_KEEP - 1)) fs.rmSync(path.join(dir, old), { force: true });
      } catch {}
      const file = safeLoginSlug(login) + "-" + rid() + ".webm";
      fs.writeFileSync(path.join(dir, file), buf);
      return send(res, 200, JSON.stringify({ file }));
    });
  }
  {
    const mv = url.match(EXAM_VOICE_RE);
    if (mv && req.method === "GET") {
      // владелец — по разбору имени той же формулой, что при записи, и сравнение
      // на РАВЕНСТВО (префиксное startsWith пускало логин-префикс чужого — ревью 22.08)
      const owner = examAudioOwner(mv[1]);
      if (owner !== safeLoginSlug(login) && !canEdit(login)) return send(res, 403, '{"error":"чужая запись"}');
      const f = path.join(EXAM_WORK_DIR(), "audio", mv[1]);
      if (!fs.existsSync(f)) return send(res, 404, '{"error":"нет записи"}');
      res.writeHead(200, { "Content-Type": "audio/webm", "Content-Length": fs.statSync(f).size,
        "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
      return fs.createReadStream(f).pipe(res);
    }
  }
  if (url === "/api/exam/work" && req.method === "POST") {
    if (!examAllowed(login)) return send(res, 403, '{"error":"экзамен закрыт: нет доступа к экзаменационной неделе"}');
    return readJson(req, res, (d) => {
      if (!["jazuu", "suiloo"].includes(d.kind)) return send(res, 400, '{"error":"bad kind"}');
      const topic = String(d.topic || "").slice(0, 120);
      if (!topic) return send(res, 400, '{"error":"нет темы"}');
      const rec = { id: rid(), ts: new Date().toISOString(), kind: d.kind, topic, score: null };
      // курс экзамена (a1/b1): без него работы обоих курсов смешивались бы у ученика и учителя
      if (/^[a-z]\d$/.test(String(d.course || ""))) rec.course = d.course;
      // вопросы задания (формат A1 — выборка из официального списка): тема на 120
      // символов их не вмещала, и преподаватель оценивал ответы вслепую
      if (Array.isArray(d.qs) && d.qs.length)
        rec.qs = d.qs.slice(0, 12).map((x) => String(x).slice(0, 200)).filter(Boolean);
      if (d.kind === "jazuu") {
        const text = String(d.text || "").slice(0, 4000).trim();
        // та же формула, что у клиента (examSentences/examAnswers в 041-renderExam) —
        // менять только парой: ответ на вопрос — строка либо предложение
        const sentences = text.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean).length;
        const lines = text.split(/\n/).map((x) => x.trim()).filter(Boolean).length;
        if (!text || Math.max(sentences, lines) < 3) return send(res, 400, '{"error":"текст слишком короткий"}');
        rec.text = text; rec.sentences = sentences;
      } else {
        const audio = String(d.audio || "");
        if (!/^[a-zA-Z0-9_.-]+-[0-9a-z-]+\.webm$/.test(audio)) return send(res, 400, '{"error":"нет записи"}');
        // владение — равенством разобранного owner, и файл обязан существовать
        // (иначе в работу вписывалось любое валидное имя → битый плеер у преподавателя)
        const owner = examAudioOwner(audio);
        if (owner !== safeLoginSlug(login)) return send(res, 403, '{"error":"чужая запись"}');
        if (!fs.existsSync(path.join(EXAM_WORK_DIR(), "audio", audio))) return send(res, 400, '{"error":"записи нет на сервере"}');
        rec.audio = audio;
        if (d.transcript) rec.transcript = String(d.transcript).slice(0, 2000);
        if (d.sec) rec.sec = Math.min(600, Math.max(0, Number(d.sec) || 0));
      }
      fs.mkdirSync(EXAM_WORK_DIR(), { recursive: true });
      const list = readExamWork(login).concat([rec]).slice(-50);
      atomicWrite(examWorkFile(login), JSON.stringify(list));
      logger.info("exam", "work submitted", { login, kind: d.kind, id: rec.id });
      return send(res, 200, JSON.stringify({ id: rec.id }));
    });
  }
  if (url === "/api/exam/grade" && req.method === "POST") {
    if (!canEdit(login)) return send(res, 403, '{"error":"оценивает преподаватель"}');
    return readJson(req, res, (d) => {
      // пустое поле ввода — не «0»: Number("") === 0 проходил проверку диапазона
      const rawScore = typeof d.score === "string" ? d.score.trim() : d.score;
      const target = String(d.login || ""),
        score = typeof rawScore === "number" || (typeof rawScore === "string" && rawScore !== "") ? Number(rawScore) : NaN;
      if (!target || !Number.isFinite(score) || score < 0 || score > 100)
        return send(res, 400, '{"error":"login и score 0..100 обязательны"}');
      const list = readExamWork(target);
      const rec = list.find((x) => x.id === d.id);
      if (!rec) return send(res, 404, '{"error":"работа не найдена"}');
      rec.score = Math.round(score);
      if (d.comment) rec.comment = String(d.comment).slice(0, 1000); else delete rec.comment;
      rec.gradedAt = new Date().toISOString(); rec.gradedBy = login;
      atomicWrite(examWorkFile(target), JSON.stringify(list));
      logger.info("exam", "work graded", { login: target, id: rec.id, score: rec.score, by: login });
      return send(res, 200, JSON.stringify(rec));
    });
  }
  /* ===/EXAM-WORK=== */

  const mTts = url.match(/^\/api\/tts\/(m\d+)$/);
  if (mTts && req.method === "POST") {
    if (!canEdit(login)) return send(res, 403, '{"error":"нужна роль преподавателя"}');
    return readJson(req, res, (d) => {
      const id = String(d.id || ""), text = String(d.text || "").slice(0, 500).trim();
      if (!ID_RE.test(id) || !text) return send(res, 400, '{"error":"bad id/text"}');
      // voice — голос конкретной реплики (диалоги озвучиваются по персонажам); без него — голос курса
      const reqVoice = /^[A-Za-z0-9]{10,40}$/.test(String(d.voice || "")) ? String(d.voice) : null;
      // model/lang — подбор произношения (кыргызского в списке ElevenLabs нет,
      // «классический» звук ищется ухом): admin шлёт варианты, слушаем, фиксируем env-ами
      const OK_MODELS = new Set(["eleven_v3", "eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"]);
      const reqModel = OK_MODELS.has(d.model) ? d.model : null;
      const reqLang = d.lang === "auto" ? null
        : (typeof d.lang === "string" && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(d.lang) ? d.lang : TTS_LANG);
      const reqSettings = (d.settings && typeof d.settings === "object")
        ? { stability: d.settings.stability, similarity: d.settings.similarity, style: d.settings.style, speed: d.settings.speed }
        : null;
      // кастомную запись преподавателя TTS не перезаписывает (только явный force)
      const curMeta = readAudioMeta(mTts[1])[id];
      if (curMeta && curMeta.source === "upload" && !d.force) {
        return send(res, 409, '{"error":"здесь кастомная запись преподавателя — перегенерация только с подтверждением"}');
      }
      const key = getSecret("elevenlabs") || process.env.ELEVENLABS_API_KEY;
      if (!key) return send(res, 400, '{"error":"ключ ElevenLabs не настроен"}');
      const started = Date.now();
      const finish = (code, buf, voiceId) => {
        // ElevenLabs v3 на сверхкоротких словах отвечает 200 с пустым телом; записать
        // ноль байт и сказать ok — значит молча сломать озвучку («өз» так и онемел)
        if (!buf || !buf.length) { logger.error("tts", "empty audio body", null, { id }); return send(res, 502, '{"error":"tts вернул пустое аудио"}'); }
        try {
          atomicWrite(audioFile(mTts[1], id), buf);
          setAudioMeta(mTts[1], id, { source: "tts", by: login, at: new Date().toISOString(), voice: voiceId });
          logger.info("tts", "generated", { id, bytes: buf.length, ms: Date.now() - started, voice: voiceId });
          return send(res, 200, JSON.stringify({ ok: true, bytes: buf.length }));
        } catch (e) { logger.error("tts", "audio save failed", e, { id }); return send(res, 500, '{"error":"write failed"}'); }
      };
      const FALLBACK_MODEL = "eleven_multilingual_v2";
      const tryGen = (voiceId, retriedVoice, langCode, model) => {
        elevenTts(key, voiceId, text, langCode, ((err, code, buf) => {
          if (err) { logger.error("tts", "request failed", err, { id }); return send(res, 502, '{"error":"tts недоступен"}'); }
          // v3 на одиночном коротком слове отдаёт 200 с пустым телом — пробуем
          // multilingual-модель, она короткие слова озвучивает; второй пустой — честная ошибка
          if (code === 200 && (!buf || !buf.length) && (model || TTS_MODEL) !== FALLBACK_MODEL) {
            logger.warn("tts", "empty body, retrying with fallback model", { id, model: model || TTS_MODEL });
            return tryGen(voiceId, retriedVoice, langCode, FALLBACK_MODEL);
          }
          if (code === 200) return finish(code, buf, voiceId);
          // модель не принимает language_code — повтор без принудительного языка (авто-детект)
          if (code === 400 && langCode) {
            logger.warn("tts", "language_code rejected, retrying with auto-detect", { status: code, lang: langCode });
            return tryGen(voiceId, retriedVoice, null, model);
          }
          // голос недоступен на тарифе — берём первый голос аккаунта и повторяем один раз
          if (!retriedVoice && (code === 402 || code === 404)) {
            logger.warn("tts", "voice unavailable, picking account voice", { status: code, voice: voiceId });
            return elevenVoices(key, (e2, c2, b2) => {
              if (e2 || c2 !== 200) { logger.warn("tts", "voices list failed", { status: c2 || 0, error: e2 && e2.message }); return send(res, 502, '{"error":"tts: голоса недоступны"}'); }
              let pick = null;
              try { const v = JSON.parse(b2.toString()).voices; pick = v && v[0] && v[0].voice_id; } catch {}
              if (!pick) return send(res, 502, '{"error":"tts: нет доступных голосов"}');
              try { atomicWrite(path.join(DATA_DIR, "tts-voice"), pick); } catch {}
              VOICE_ID_CACHE = pick;
              logger.info("tts", "account voice selected", { voice: pick });
              tryGen(pick, true, langCode, model);
            });
          }
          logger.warn("tts", "non-200 from elevenlabs", { status: code, excerpt: buf.slice(0, 200).toString().replace(/\s+/g, " ") });
          return send(res, 502, JSON.stringify({ error: "tts: HTTP " + code }));
        }), model, reqSettings);
      };
      tryGen(reqVoice || currentVoiceId(), !!reqVoice, reqLang, reqModel || undefined); // явный голос реплики не подменяется фолбэком на голос курса
    });
  }

  send(res, 404, '{"error":"not found"}');
});

backfillOwners();
server.listen(PORT, () => {
  logger.info("server", "started", { port: PORT, dataDir: DATA_DIR, users: Object.keys(USERS).length });
});
