"use strict";
/* Тест генерализации UI: модульные расширения живут в реестре MODULE_EXTRAS,
   а не в захардкоженных ветках; общие строительные блоки (biTable, harmonyTable,
   weekTextsCard) определены один раз и используются всеми модулями. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();

// CONTENT_READY — из DATA-блока
const md = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
const sb = { console };
vm.createContext(sb);
vm.runInContext(md[1] + "; this.CONTENT_READY=CONTENT_READY;", sb);

// 1. Реестр MODULE_EXTRAS существует и покрывает все готовые модули (ref-вкладка)
const reg = html.match(/const MODULE_EXTRAS=\{([\s\S]*?)\n\};/);
assert.ok(reg, "реестр MODULE_EXTRAS найден");
for (const mid of sb.CONTENT_READY)
  assert.ok(new RegExp("\\b" + mid + ":\\{").test(reg[1]), "MODULE_EXTRAS содержит " + mid);

// 2. Диспетчеры ходят через реестр, старые ветки удалены
assert.ok(!html.includes('activeModule==="m1"?renderGrammarM1'), "тернарная цепочка грамматики удалена");
assert.ok(!html.includes('if(activeModule==="m1")renderTextsM1'), "if-ветки текстов обзора удалены");
assert.ok(/MODULE_EXTRAS\[activeModule\]/.test(html), "диспетчеризация через MODULE_EXTRAS");

// 3. biTable определён один раз; инлайн-дубликаты построения диалоговых таблиц удалены
assert.ok(html.includes("function biTable("), "biTable определён");
const inlineRows = (html.match(/h\("td",\{class:"kgword"\},row\[0\]\)/g) || []).length;
assert.strictEqual(inlineRows, 1, "строки двухколоночных таблиц строятся только внутри biTable: " + inlineRows);

// 4. harmonyTable определён и используется в нескольких модулях
assert.ok(html.includes("function harmonyTable("), "harmonyTable определён");
const htUses = (html.match(/harmonyTable\(/g) || []).length;
assert.ok(htUses >= 5, "harmonyTable используется ≥5 раз (определение + ≥4 вызова): " + htUses);

// 5. Заголовок «Тексты недели» строится одним хелпером
assert.ok(html.includes("function weekTextsCard("), "weekTextsCard определён");
const wtUses = (html.match(/weekTextsCard\(/g) || []).length;
assert.ok(wtUses >= 4, "weekTextsCard: определение + ≥3 вызова: " + wtUses);

// 6. Формы и списки вариантов — общие компоненты
assert.ok(html.includes("function optList("), "optList определён");
assert.ok(html.includes("function revealOpts("), "revealOpts определён");
assert.ok(html.includes("function answerInput("), "answerInput определён");
assert.ok(html.includes("function pickerRow("), "pickerRow определён");
// depModules обязана включать бакеты диалогового аудио: у М1+ словарь весь в своём
// модуле, а озвучка диалогов — в m0 (ph_*); без неё вкладка «Диалоги» немая
{
  const fn = html.match(/function depModules\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, "depModules извлекается");
  const sb = {
    VOCAB: [{ id: "m1_01" }],
    DIALOGS: { m1: { parts: [{ lines: [{ id: "ph_m1d1_01" }] }] } },
    activeModule: "m1",
    homeOf: (id) => (id.startsWith("ph_") ? "m0" : id.split("_")[0]),
  };
  vm.createContext(sb);
  vm.runInContext(fn[0] + ";this.mods=depModules();", sb);
  assert.ok(sb.mods.includes("m0") && sb.mods.includes("m1"), "depModules включает бакет диалогов: " + sb.mods);
}
const rawOpts = (html.match(/class:"opts"/g) || []).length;
assert.strictEqual(rawOpts, 2, 'контейнер .opts создаётся только в optList и pickerRow: ' + rawOpts);
const rawInputs = (html.match(/h\("input",\{type:"text",autocomplete:"off"/g) || []).length;
assert.strictEqual(rawInputs, 1, "поле ввода ответа создаётся только в answerInput: " + rawInputs);

// 7. dtr определён ровно один раз (без локальных копий)
const dtrDefs = (html.match(/function dtr\(|const dtr=/g) || []).length;
assert.strictEqual(dtrDefs, 1, "dtr определён один раз: " + dtrDefs);

// 8. Караоке куплетов: у КАЖДОГО куплета каждой песни есть kt — тайминги строк из
// пословных таймстампов STT (deploy/gen-karaoke.js), согласованные с числом строк
// и растущие от нуля. Перебор всех песен (канон), не «типовая».
{
  const ds = { console };
  vm.createContext(ds);
  vm.runInContext(md[1] + '; this.DIALOGS=typeof DIALOGS!=="undefined"?DIALOGS:{};', ds);
  let n = 0;
  for (const [mid, d] of Object.entries(ds.DIALOGS)) for (const s of d.songs || [])
    for (const v of s.verses || []) {
      n++;
      const at = mid + "/" + v.id + ": ";
      assert.ok(Array.isArray(v.kt) && v.kt.length, at + "нет kt — прогнать deploy/gen-karaoke.js");
      assert.strictEqual(v.kt.length, v.ky.split("\n").length, at + "kt разошёлся с числом строк");
      assert.strictEqual(v.kt[0], 0, at + "первая строка стартует не с нуля");
      for (let i = 1; i < v.kt.length; i++)
        assert.ok(v.kt[i] > v.kt[i - 1], at + "тайминги строк не растут: " + v.kt.join(","));
    }
  assert.ok(n >= 100, "куплетов с караоке подозрительно мало: " + n);
  // Караоке полной песни: skt — тайминги строк всего трека (выравнивание пения по STT
  // с гейтом качества: песня без уверенного матча остаётся без skt — это законно).
  // Где skt есть — длина равна суммарному числу строк, времена строго растут.
  let withSkt = 0;
  for (const [mid, d] of Object.entries(ds.DIALOGS)) for (const s of d.songs || []) {
    if (!s.skt) continue;
    withSkt++;
    const at = mid + "/" + s.fullId + ": ";
    const total = (s.verses || []).reduce((a, v) => a + v.ky.split("\n").length, 0);
    assert.strictEqual(s.skt.length, total, at + "skt разошёлся с числом строк песни");
    assert.ok(s.skt[0] >= 0, at + "первый тайминг отрицательный");
    for (let i = 1; i < s.skt.length; i++)
      assert.ok(s.skt[i] > s.skt[i - 1], at + "тайминги песни не растут: " + s.skt.join(","));
  }
  assert.ok(withSkt >= 1, "ни одна песня не получила skt — прогнать deploy/gen-karaoke.js по _full");
  // логика выбора строки — vm-исполнением отданного кода, перебором случаев
  const kl = html.match(/\/\* ===KARAOKE=== \*\/([\s\S]*?)\/\* ===\/KARAOKE=== \*\//);
  assert.ok(kl, "маркеры KARAOKE найдены");
  assert.ok(!/window|document|location/.test(kl[1]), "KARAOKE-логика DOM-free");
  const ks = { console };
  vm.createContext(ks);
  vm.runInContext(kl[1] + "; this.f=karaokeLineAt;", ks);
  assert.strictEqual(ks.f([0, 2, 5], [4, 4, 4], 0), 0, "карта: старт — первая строка");
  assert.strictEqual(ks.f([0, 2, 5], [4, 4, 4], 2), 1, "карта: t=старту строки — строка уже её");
  assert.strictEqual(ks.f([0, 2, 5], [4, 4, 4], 6.5), 2, "карта: хвост — последняя строка");
  assert.strictEqual(ks.f([19.3, 23.4, 27.5], [4, 4, 4], 5), -1, "вступление песни до первой строки — без подсветки");
  assert.strictEqual(ks.f(null, [10, 10, 20], 1.9, 8), 0, "фолбэк: пропорция по длинам строк");
  assert.strictEqual(ks.f(null, [10, 10, 20], 2.1, 8), 1, "фолбэк: вторая строка");
  assert.strictEqual(ks.f(null, [10, 10, 20], 7.9, 8), 2, "фолбэк: последняя строка");
  assert.strictEqual(ks.f(null, [4, 4], 1, NaN), -1, "без длительности не подсвечиваем");
  assert.strictEqual(ks.f([0, 2], [4, 4, 4], 3, NaN), -1, "карта не той длины не применяется");
}

/* ── «Обзор» модуля рассказывает про все его разделы ────────────────────────
   Правило владельца 21.08.2026: меню модуля и план недели в «Обзоре» — одно целое.
   Появились «Уроки» и «Аудирование», а план продолжал описывать только грамматику,
   карточки, дриллы и мини-тест — ученик открывал вкладку, которой нет в плане.
   Проверяем перебором: у модуля есть урок (LESSONS) или аудирование (STT_MODS) —
   значит раздел назван в плане, на каждом из трёх языков. */
{
  const page = html;
  const cut = (re) => { const m = page.match(re); assert.ok(m, "маркер найден: " + re); return m[1]; };
  const reg = { console, LESSONS: {}, LESSON_SLIDES: {} };
  vm.createContext(reg);
  // реестр блоков аудирования едет внутри ===DATA=== — второй раз его подключать нельзя
  vm.runInContext(cut(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//)
    + cut(/(\/\* ===I18N=== \*\/[\s\S]*?\/\* ===\/I18N=== \*\/)/).replace("const I18N=", "var I18N=")
    + "; this.C=CONTENT; this.L=LESSONS; this.MODS=STT_MODS; this.I18N=I18N;", reg);
  // как раздел называется в интерфейсе — из словарей, а не из литерала в тесте
  const nameOf = (key) => ({ ru: reg.I18N.ru[key], en: reg.I18N.en[key], tr: reg.I18N.tr[key] });
  const FIELD = { ru: "plan", en: "planEn", tr: "planTr" };
  const check = (mod, key, why) => {
    const names = nameOf(key);
    for (const lang of ["ru", "en", "tr"]) {
      const plan = (reg.C[mod] || {})[FIELD[lang]] || [];
      assert.ok(plan.length, mod + ": план недели на " + lang + " не пуст");
      assert.ok(plan.some((s2) => s2.includes(names[lang])),
        mod + " (" + lang + "): в плане назван раздел «" + names[lang] + "» — " + why);
    }
  };
  const withLesson = Object.keys(reg.L);
  assert.ok(withLesson.length >= 3, "уроков в реестре: " + withLesson.length);
  for (const mod of withLesson) check(mod, "tab_lessons", "у модуля есть аудиоурок");
  for (const mod of reg.MODS) check(mod, "tab_listen", "у модуля открыт раздел аудирования");
  // и наоборот: модуль без урока не обещает урок в плане (иначе ученик ищет вкладку)
  for (const mod of reg.C ? Object.keys(reg.C) : []) {
    if (withLesson.includes(mod)) continue;
    const names = nameOf("tab_lessons");
    assert.ok(!(reg.C[mod].plan || []).some((s2) => s2.includes("«" + names.ru + "»")),
      mod + ": плана без урока не обещает вкладку «" + names.ru + "»");
  }
}


/* ── Кнопка чата с преподавателем: видна везде, кроме учительского экрана ──
   Просьба владельца 21.08.2026: внутри тренажёра связи с преподавателем негде
   было взять. 05.09.2026 канал сменился: вместо ухода в WhatsApp кнопка открывает
   панель чата на самом сайте (в России мессенджеры заблокированы), WhatsApp
   остался второй кнопкой внутри панели. Проверяем исполнением: у ученика и в
   демо кнопка есть и открывает панель, у преподавателя её нет, непрочитанные
   ответы видны бейджем, а waHref() по-прежнему ведёт к преподавателю. */
{
  const src = html.match(/===CHAT-FAB===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/CHAT-FAB=== \*\//);
  assert.ok(src, "маркер ===CHAT-FAB=== в сборке");
  const mk = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], on: {},
    append(...k){ this.kids.push(...k); }, addEventListener(t2, f){ this.on[t2] = f; } });
  const run = (opts) => {
    const events = [], opened = [];
    const sb2 = { console, activeTab: "cards",
      t: (k) => k, tf: (k, v) => k + ":" + Object.values(v).join(","),
      icon: () => mk("svg"), evPush: (n, p) => events.push([n, p]),
      h: (tag, attrs, ...kids) => { const n = mk(tag, attrs); n.kids.push(...kids.filter(Boolean)); return n; },
      isTeacher: () => !!opts.teacher, ME: opts.me || null, encodeURIComponent,
      openChatPanel: (op, o) => opened.push([op, o || null]) };
    if (opts.demo) sb2.IS_DEMO = true;
    vm.createContext(sb2);
    vm.runInContext(src[1] + "; this.chatFab=chatFab; this.waFabLink=waFabLink; this.waHref=waHref; this.CHAT=CHAT;", sb2);
    return { sb: sb2, btn: sb2.chatFab(), wa: sb2.waFabLink(), href: sb2.waHref(), events, opened };
  };
  const badgeOf = (btn) => btn.kids.find((k) => k && k.attrs && k.attrs.class === "fab-badge");
  // ученик: кнопка есть, это КНОПКА (не внешняя ссылка), с доступным именем
  const stu = run({ me: { login: "aida" } });
  assert.ok(stu.btn, "у ученика кнопка есть");
  assert.strictEqual(stu.btn.tag, "button", "чат открывается на месте — это кнопка, а не переход по ссылке");
  assert.strictEqual(stu.btn.attrs.class, "chat-fab", "класс кнопки чата — свой, не зелёный WhatsApp");
  assert.strictEqual(stu.btn.attrs.type, "button", "кнопка не сабмитит форму");
  assert.ok(!stu.btn.attrs.href, "у кнопки нет href — она никуда не уводит");
  assert.ok(stu.btn.attrs["aria-label"], "у иконки есть доступное имя");
  // клик открывает панель чата и передаёт саму кнопку (фокус вернётся на неё)
  stu.btn.on.click();
  assert.strictEqual(stu.opened.length, 1, "клик открывает панель чата");
  assert.strictEqual(stu.opened[0][0], stu.btn, "панель знает, на что вернуть фокус");
  // WhatsApp — в один клик, второй плавающей кнопкой-ссылкой (решение владельца 06.09.2026)
  assert.ok(stu.href.startsWith("https://wa.me/996505854856?text="),
    "waHref ведёт в WhatsApp преподавателя с готовым текстом");
  assert.ok(decodeURIComponent(stu.href).includes("aida"), "в тексте — логин ученика");
  assert.ok(stu.wa && stu.wa.tag === "a", "WhatsApp — отдельная кнопка-ссылка");
  assert.strictEqual(stu.wa.attrs.class, "wa-fab");
  assert.strictEqual(stu.wa.attrs.href, stu.href, "ссылка ведёт по waHref в один клик");
  assert.strictEqual(stu.wa.attrs.target, "_blank"); assert.ok(/noopener/.test(stu.wa.attrs.rel), "noopener");
  assert.ok(stu.wa.attrs["aria-label"], "у ссылки есть доступное имя");
  stu.wa.on.click();
  assert.strictEqual(JSON.stringify(stu.events.pop()), JSON.stringify(["wa.click", { from: "cards" }]),
    "клик по WhatsApp остаётся в журнале");   // объекты из vm-контекста — другой realm, deepStrictEqual их не равняет
  // бейдж непрочитанного: пуст и скрыт, пока ответов нет
  const b0 = badgeOf(stu.btn);
  assert.ok(b0, "в кнопке есть место для счётчика непрочитанных");
  assert.ok(b0.attrs.hidden !== undefined, "без ответов счётчик скрыт");
  // ...и показывает число, когда преподаватель ответил
  stu.sb.CHAT.unread = 3;
  const b1 = badgeOf(stu.sb.chatFab());
  assert.strictEqual(b1.attrs.hidden, undefined, "с ответами счётчик виден");
  assert.strictEqual(String(b1.kids[0]), "3", "в счётчике — число непрочитанных ответов");
  // демо: кнопка тоже есть — это единственный способ попросить доступ
  const demo = run({ demo: true });
  assert.ok(demo.btn, "в демо кнопка есть");
  demo.btn.on.click();
  assert.strictEqual(demo.opened.length, 1, "в демо клик открывает ту же панель");
  assert.ok(demo.href.includes("wa.me/996505854856"), "в демо WhatsApp ведёт к преподавателю");
  // преподаватель: кнопки нет — писать самой себе незачем, у неё вкладка «Сообщения»
  assert.strictEqual(run({ teacher: true }).btn, null, "у преподавателя кнопки нет");
  assert.strictEqual(run({ teacher: true }).wa, null, "у преподавателя и WhatsApp-кнопки нет");
  // подписи и тексты — на трёх языках
  for (const key of ["wa_fab_label", "wa_fab_wa", "wa_fab_text", "wa_fab_text_user"])
    assert.strictEqual((html.match(new RegExp(key + ':"', "g")) || []).length, 3, key + " на трёх языках");
  // стили: круг на телефоне, подпись только на широком экране, вырез учтён, бейдж в углу
  assert.ok(html.includes(".wa-fab{position:fixed"), "кнопка закреплена над контентом");
  assert.ok(/\.chat-fab\{[^}]*position:fixed/.test(html) && /\.chat-fab\{[^}]*bottom:calc\(8\dpx/.test(html),
    "кнопка чата закреплена НАД кнопкой WhatsApp, обе видны и кликаются в один клик");
  assert.ok(html.includes("env(safe-area-inset-bottom"), "низ учитывает вырез телефона");
  assert.ok(!/\.wa-fab-t\{display:inline\}/.test(html) && /\.wa-fab-t\{display:none\}/.test(html),
    "подписи у плавающих кнопок нет ни на какой ширине — только иконка с aria-label (решение владельца 06.09.2026)");
  assert.ok(/\.fab-badge\{position:absolute/.test(html), "счётчик — кружок в углу кнопки");
  assert.ok(/\.fab-badge\{[\s\S]*?var\(--accent\)/.test(html), "счётчик виден акцентным цветом темы");
  assert.ok(html.includes(".chat-msg.me{"), "свои сообщения отличаются от ответов преподавателя");
}

/* ── Инбокс: чистые функции без DOM (сортировка, подписи, счётчик, обрезка) ──
   Порядок и подписи тредов — механизм, а не разметка: проверяем исполнением
   на модельных данных, а не грепом по реализации. */
{
  const { loadBlock } = require("./helpers/block");
  const sbc = loadBlock("CHAT", { expose: ["chatSortThreads", "chatThreadTitle", "chatUnreadTotal", "chatPreview"] });
  const { chatSortThreads, chatThreadTitle, chatUnreadTotal, chatPreview } = sbc;
  const T = (id, unread, updatedAt, extra) => Object.assign({ id, unread, updatedAt, kind: "visitor", lang: "ru" }, extra || {});
  const list = [
    T("a", 0, "2026-09-04T10:00:00.000Z"),
    T("b", 0, "2026-09-05T10:00:00.000Z"),
    T("c", 2, "2026-09-01T10:00:00.000Z"),
    T("d", 1, "2026-09-03T10:00:00.000Z")
  ];
  const order = chatSortThreads(list).map((x) => x.id);
  assert.deepStrictEqual(order, ["d", "c", "b", "a"],
    "непрочитанные сверху, внутри группы — свежие первыми: " + order.join(","));
  assert.deepStrictEqual(list.map((x) => x.id), ["a", "b", "c", "d"], "исходный список не переставлен на месте");
  assert.deepStrictEqual(chatSortThreads([]), [], "пустой список не роняет сортировку");
  assert.deepStrictEqual(chatSortThreads([T("z", 0, "2026-01-01T00:00:00.000Z")]).map((x) => x.id), ["z"],
    "один тред — тоже список");
  // подпись: ученик узнаётся по логину, гость — по странице и языку
  assert.strictEqual(chatThreadTitle({ kind: "student", login: "aida", lang: "ru" }, { visitor: "Гость" }), "aida",
    "у ученика в заголовке его логин");
  assert.strictEqual(chatThreadTitle({ kind: "visitor", firstPage: "/blog/vnzh/ru", lang: "tr" }, { visitor: "Гость" }),
    "Гость · /blog/vnzh/ru · TR", "у гостя — откуда написал и на каком языке");
  assert.strictEqual(chatThreadTitle({ kind: "visitor", firstPage: "", lang: "en" }, { visitor: "Гость" }),
    "Гость · / · EN", "без страницы подпись не разваливается");
  // счётчик и обрезка
  assert.strictEqual(chatUnreadTotal(list), 3, "счётчик складывает непрочитанные всех тредов");
  assert.strictEqual(chatUnreadTotal([]), 0, "пустой инбокс — ноль");
  assert.strictEqual(chatPreview("салам", 80), "салам", "короткий текст не режется");
  const long = chatPreview("а".repeat(200), 80);
  assert.ok(long.length <= 80, "длинный текст укорочен до предела: " + long.length);
  assert.ok(long.endsWith("…"), "обрезка помечена многоточием");
  assert.strictEqual(chatPreview("", 80), "", "пустой текст не превращается в многоточие");
}


/* ── Панель чата и вкладка «Сообщения»: поведение, а не состав сборки ──
   Состав артефакта ≠ поведение с ним: мало убедиться, что функции приехали в
   страницу — панель должна собраться, письмо уйти, ответ преподавателя записаться
   в журнал, а опрос сервера погаснуть при закрытии. Исполняем блок ===INBOX===
   в песочнице на бутафорском DOM и модельных ответах сервера. */
{
  const { blockSrc } = require("./helpers/block");
  const mkNode = (tag, attrs) => {
    const n = { tag, attrs: attrs || {}, kids: [], on: {}, value: "", disabled: false, textContent: "",
      append(...k){ for (const x of k) if (x != null) this.kids.push(x); },
      remove(){ this.removed = true; }, focus(){ this.focused = true; },
      addEventListener(t2, f){ this.on[t2] = f; } };
    return n;
  };
  const flatten = (n, out) => { out = out || []; if (n && n.tag) { out.push(n); for (const k of n.kids || []) flatten(k, out); } return out; };
  const thread = { id: "v-abc", kind: "visitor", lang: "ru", firstPage: "/ru", contact: "",
    createdAt: "2026-09-05T10:00:00.000Z", updatedAt: "2026-09-05T11:00:00.000Z",
    messages: [{ id: "1", ts: "2026-09-05T10:00:00.000Z", from: "visitor", text: "салам" },
               { id: "2", ts: "2026-09-05T11:00:00.000Z", from: "teacher", by: "altynai", text: "саламатсызбы" }] };
  const summaries = [
    { id: "v-abc", kind: "visitor", lang: "ru", firstPage: "/ru", contact: "", unread: 1,
      updatedAt: "2026-09-05T11:00:00.000Z", last: { ts: "x", from: "visitor", text: "салам" } },
    { id: "u-aida", kind: "student", login: "aida", lang: "en", firstPage: "/", contact: "", unread: 0,
      updatedAt: "2026-09-04T11:00:00.000Z", last: { ts: "x", from: "teacher", text: "ok" } }];
  const routes = { "api/chat": { thread, unread: 1 }, "api/chat/seen": { ok: true },
    "api/chat/unread": { threads: 2, messages: 3 },
    "api/chat/threads?state=unread": summaries, "api/chat/threads?state=all": summaries,
    "api/chat/threads/v-abc": thread, "api/chat/threads/v-abc/seen": { ok: true },
    "api/chat/threads/v-abc/reply": { ok: true, msg: { id: "3", ts: "z", from: "teacher", text: "ответ" } } };
  const net = [], evs = [];
  const ibox = { console, CHAT: { unread: 0 }, activeTab: "cards", IS_DEMO: true, ME: { login: "aida" },
    t: (k) => k, tf: (k, v) => k + JSON.stringify(v), icon: () => mkNode("svg"),
    h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.append(...kids); return n; },
    clear: (n) => { n.kids = []; return n; }, localeOf: () => "ru-RU", currentLang: () => "ru",
    evPush: (n, p) => evs.push([n, p]), waHref: () => "https://wa.me/996505854856?text=x",
    mountWaFab(){}, renderSidebar(){}, renderTab(){ ibox.__redraws = (ibox.__redraws || 0) + 1; },
    openRoster: (l) => { ibox.__roster = l; }, isTeacher: () => !!ibox.__teacher,
    chipRow: (items, act, on) => { const n = mkNode("div", { class: "rev-filters" }); n.pick = on; return n; },
    location: { pathname: "/ru", protocol: "https:" }, encodeURIComponent,
    setInterval: (f, ms) => { ibox.__pollMs = ms; return 7; },
    clearInterval: (id) => { ibox.__pollStopped = id; },
    fetch: (u, o) => { net.push([String(u), (o && o.method) || "GET"]);
      if (ibox.__failChat && String(u) === "api/chat") return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
      if (!(String(u) in routes)) return Promise.reject(new Error("нет маршрута " + u));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(routes[String(u)]) }); },
    document: { body: mkNode("body"), addEventListener(){}, removeEventListener(){} } };
  vm.createContext(ibox);
  vm.runInContext(blockSrc("CHAT") + ";" + blockSrc("INBOX") +
    ";this.openChatPanel=openChatPanel;this.renderInbox=renderInbox;", ibox);

  const tick = () => new Promise((r) => setTimeout(r, 20));
  (async () => {
    // 1. Ученик: панель собирается, история видна, предзаполнение доехало
    const opener = mkNode("button");
    ibox.openChatPanel(opener, { prefill: "нужна помощь с М3" });
    await tick();
    const panel = ibox.document.body.kids.find((n) => n.tag === "aside");
    assert.ok(panel, "панель смонтирована в документ");
    assert.strictEqual(panel.attrs.role, "dialog", "панель — диалог для скринридера");
    const nodes = flatten(panel);
    const ta = nodes.find((n) => n.tag === "textarea");
    assert.strictEqual(ta.value, "нужна помощь с М3", "предзаполнение доехало в поле ввода");
    assert.strictEqual(ta.attrs.maxlength, "2000", "длина письма ограничена как на сервере");
    const contact = nodes.find((n) => n.tag === "input");
    assert.ok(contact && contact.attrs.maxlength === "120", "в демо спрашиваем контакт (логина нет)");
    assert.strictEqual(nodes.filter((n) => String(n.attrs.class || "").startsWith("chat-msg")).length, 2,
      "история треда отрисована обеими сторонами");
    assert.ok(nodes.some((n) => n.attrs.class === "chat-msg me") && nodes.some((n) => n.attrs.class === "chat-msg them"),
      "своё письмо и ответ преподавателя различимы");
    const wa = nodes.find((n) => n.tag === "a");
    assert.ok(wa && wa.attrs.href.includes("wa.me/996505854856") && wa.attrs.rel === "noopener noreferrer",
      "WhatsApp остался второй кнопкой внутри панели");
    assert.ok(net.some(([u, m2]) => u === "api/chat/seen" && m2 === "POST"), "открытие панели помечает ответы прочитанными");
    assert.strictEqual(ibox.__pollMs, 60000, "опрос ответов — раз в минуту");
    // 2. Отправка: письмо уходит POST-ом и попадает в журнал занятий
    const send = nodes.find((n) => n.tag === "button" && n.kids[0] === "ch_send");
    ta.value = "  ";
    await send.on.click();
    assert.ok(!net.some(([u, m2]) => u === "api/chat" && m2 === "POST"), "пустое письмо не отправляется");
    ta.value = "салам, суроо бар";
    await send.on.click();
    assert.ok(net.some(([u, m2]) => u === "api/chat" && m2 === "POST"), "письмо ушло на сервер");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(evs)), [["chat.send", { from: "cards" }]],
      "обращение к преподавателю видно в журнале занятий");
    assert.strictEqual(ta.value, "", "поле очищено — письмо не отправится дважды");
    // 3. Закрытие: опрос гаснет, фокус возвращается на кнопку
    const close = nodes.find((n) => n.tag === "button" && n.kids[0] === "ch_close");
    close.on.click();
    assert.strictEqual(ibox.__pollStopped, 7, "закрытая панель не опрашивает сервер");
    assert.ok(opener.focused, "фокус вернулся на открывшую кнопку");
    // 3б. Сбой загрузки треда: «прочитано» не отправляется — бейдж ответа не гаснет вслепую
    ibox.__failChat = true; const netBefore = net.length;
    const opener2 = mkNode("button");
    ibox.openChatPanel(opener2, {});
    await tick(); await tick();
    assert.ok(net.slice(netBefore).some(([u]) => u === "api/chat"), "загрузка треда запрошена");
    assert.ok(!net.slice(netBefore).some(([u, m2]) => u === "api/chat/seen" && m2 === "POST"),
      "при неудачной загрузке seen не шлётся — иначе ответ преподавателя тихо потерял бы бейдж");
    ibox.__failChat = false;
    flatten(ibox.document.body).filter((n) => n.tag === "button" && n.kids[0] === "ch_close").pop().on.click();
    // 4. Преподаватель: список тредов, подписи, переход в тред
    ibox.__teacher = true;
    const m1 = mkNode("main");
    ibox.renderInbox(m1);
    await tick();
    const rows = flatten(m1).filter((n) => String(n.attrs.class || "").split(" ").includes("panel-row"));
    assert.strictEqual(rows.length, 2, "оба треда в списке");
    assert.ok(net.some(([u]) => u === "api/chat/threads?state=unread"), "по умолчанию открыты непрочитанные");
    rows[0].on.click();
    // 5. Тред: ответ уходит, событие с адресатом, «прочитано» и счётчик обновляются
    const m2 = mkNode("main");
    ibox.renderInbox(m2);
    await tick();
    const th = flatten(m2);
    assert.strictEqual(th.filter((n) => String(n.attrs.class || "").startsWith("chat-msg")).length, 2,
      "переписка треда отрисована");
    const rta = th.find((n) => n.tag === "textarea");
    const rbtn = th.find((n) => n.tag === "button" && (n.kids[0] === "ib_reply" || n.attrs["aria-label"] === "ib_reply"));
    rta.value = "жооп";
    await rbtn.on.click();
    await tick();
    assert.ok(net.some(([u, mm]) => u === "api/chat/threads/v-abc/reply" && mm === "POST"), "ответ ушёл в тред");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(evs.filter((e) => e[0] === "chat.reply"))),
      [["chat.reply", { to: "v-abc" }]], "ответ преподавателя записан с адресатом (не с полем login)");
    assert.ok(net.some(([u, mm]) => u === "api/chat/threads/v-abc/seen" && mm === "POST"), "открытый тред помечен прочитанным");
    assert.strictEqual(ibox.CHAT.unread, 2, "счётчик непрочитанных обновлён с сервера");
    // Итог печатается ЗДЕСЬ, а не в конце файла: иначе строка «OK» ушла бы в вывод
    // раньше асинхронных проверок и зелёный прогон ничего бы о них не говорил.
    console.log("ui-generic.test.js: OK (MODULE_EXTRAS:", sb.CONTENT_READY.join(","),
      "| harmonyTable:", htUses, "| weekTextsCard:", wtUses + ")");
  })();   // без catch: провал внутри — необработанный reject, процесс падает с ненулевым кодом
}
