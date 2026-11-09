"use strict";
/* Гейты курса B2 (тот же канон, что у B1 — решения владельца 18.08.2026, перенесённые
   на уровень «ортодон жогору»; решение владельца 30.10.2026):
   1) тема модуля — тема курса learn.kg: в данных модулей нет реестров пруфов M<n>_REFS,
      ссылок на сайт тестирования, названия тестирующей организации и заявлений
      «официальная тема / как на экзамене / дескриптор / субтест»;
   2) формулировки заданий — на кыргызском (qKy у каждого дрилла), перевод по клику;
   3) каждое новое слово введено кыргызской дефиницией через выученное: незнакомых
      токенов ≤20% массы дефиниции, каждый — в глоссарии модуля с ru/en/tr.
   Механизм, параметризованный курсом, тестируется на новом элементе набора: B1-гейты
   на данных B2 не запускаются автоматически (списки модулей там свои).
   Проверки — по артефакту (сборка варианта) и исполнением, не грепом. */
const assert = require("assert");
const vm = require("vm");
const { buildAppHtml } = require("../server/appshell");

const B2_MODS = ["m36", "m37", "m38", "m39", "m40", "m41", "m42", "m43", "m44", "m45"]; // при добавлении модуля B2 — дописать сюда
const REV_MODS = ["m46", "m47"];   // повторение и экзаменационная неделя: без своих слов

const page = buildAppHtml();
const dm = page.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
assert.ok(dm, "маркеры DATA в сборке");
const sb = {};
vm.createContext(sb);
const metaSrc = page.match(/const MODULE_META=[\s\S]*?MODULE_META\.forEach[^\n]*\n/);
assert.ok(metaSrc, "реестр MODULE_META извлечён из сборки");
vm.runInContext(dm[1] + metaSrc[0] + ";this.C=CONTENT;this.G=DEF_GLOSS;this.META=MODULE_META;" +
  "this.D=typeof DIALOGS!==\"undefined\"?DIALOGS:{};", sb);

/* 1. Тема модуля — своя тема курса (решение владельца 30.10.2026, претензия
   тестирующей организации): реестров пруфов M<n>_REFS в сборке нет, ссылок на её
   сайт и её названия в данных модулей нет, заявлений «официальная тема / как на
   экзамене / дескриптор / субтест» в переводах и пояснениях нет. Кыргызский текст
   (ky, qKy, def, опции) не переписывается — сочинять запрещено. Та же механика, что
   в b1.test.js, перебором модулей B2 и их справочных страниц. */
const NAME = /кыргыз\s*тест|kyrgyz\s*test|k[ıi]rg[ıi]z\s*test/i;
const SITE = /kyrgyz\s*test\.gov\.kg|docs\/research\/kyrgyz\s*test/i;
const CLAIM = /официальн[^\s:;,.]*\s+([^\s:;,.]+\s+){0,2}(тем|задан|дескриптор|требован)|official\s+([^\s:;,.]+\s+){0,2}(topic|task|descriptor|requirement)|resm[iî]\s+([^\s:;,.]+\s+){0,2}(konu|betimleyici|tanımlayıcı)|как на экзамене|as in the exam|sınavdaki gibi|дескриптор|descriptor|betimleyici|tanımlayıcı|субтест|subtest|alt test/i;
const KY_FMT = /субтест|дескриптор/i;                              // их формат в кыргызском тексте
const KY_KEYS = new Set(["ky", "qKy", "def", "opts"]);          // кыргызские поля карточек и дриллов
const KY_KEYS_DLG = new Set(["ky", "q", "opts", "title", "name"]); // в диалогах q/title/name — кыргызские
// Фразы курса, где название или формат тестирования стоит внутри кыргызского текста:
// ждут решения владельца (правка = сочинение кыргызского). Перевод такой фразы честно
// повторяет оригинал, поэтому проверка переводов на неё не распространяется.
// Ключ — id карточки/реплики или начало qKy/q (40 символов).
const PENDING = new Set([]);   // в B2 таких фраз нет
function scanModule(mid, root, kyKeys, seen) {
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const own = [];
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") own.push([k, v]);
      else if (Array.isArray(v) && v.every((x) => typeof x === "string")) for (const x of v) own.push([k, x]);
      else walk(v);
    }
    const key = mid + ":" + (o.id || String(o.qKy || o.q || "").slice(0, 40));
    const bad = [];
    for (const [k, v] of own) {
      assert.ok(!SITE.test(v), key + "." + k + ": ссылка на сайт тестирования в данных модуля: " + v.slice(0, 80));
      if (NAME.test(v) || (!kyKeys.has(k) && CLAIM.test(v))) bad.push(k + "=" + v.slice(0, 70));
    }
    if (!bad.length) return;
    assert.ok(PENDING.has(key), key + ": название тестирования или заявление «официальное / субтест / как на экзамене»: " + bad.join(" | "));
    assert.ok(own.some(([k, v]) => kyKeys.has(k) && (NAME.test(v) || KY_FMT.test(v))),
      key + ": в переводе название/формат тестирования, которого нет в кыргызском оригинале");
    seen.add(key);
  };
  walk(root);
}
{
  for (const mid of B2_MODS)
    assert.strictEqual(vm.runInContext("typeof " + mid.toUpperCase() + "_REFS", sb), "undefined", mid + ": реестр пруфов M_REFS удалён");
  const seen = new Set();
  for (const mid of B2_MODS) {
    scanModule(mid, sb.C[mid], KY_KEYS, seen);
    scanModule(mid, sb.D[mid], KY_KEYS_DLG, seen);
  }
  for (const k of PENDING) assert.ok(seen.has(k), "PENDING «" + k + "» больше не несёт названия — убери из списка");
  for (let n = 36; n <= 45; n++) {
    const f = page.match(new RegExp("\\nfunction renderGrammarM" + n + "\\(m\\)\\{[\\s\\S]*?\\n\\}"));
    assert.ok(f, "renderGrammarM" + n + " в сборке");
    assert.ok(!NAME.test(f[0]) && !SITE.test(f[0]), "renderGrammarM" + n + ": название или сайт тестирования на справочной странице");
    assert.ok(!/официальн\S* тем|official (\S+ )?topic|resmî (\S+ )?konu|как на экзамене|as in the exam|экзаменационн|exam answer|exam-answer|субтест|subtest|alt test|дескриптор|descriptor|betimleyici|tanımlayıcı/i.test(f[0]),
      "renderGrammarM" + n + ": заявление «официальная тема / экзамен / субтест / дескриптор» на справочной странице");
  }
}

/* 1б. Титул модуля соответствует заявленной теме (ловит «Детство» на модуле про
   письмо), плюс exam-флаги реестра: мок-карточка строится по ним. */
{
  const m36 = sb.META.find((m) => m.id === "m36");
  assert.ok(m36 && m36.course === "b2", "m36 — модуль курса b2");
  assert.ok(/письм|обращен/i.test(m36.title), "ru-титул m36 — про письмо/обращение: " + m36.title);
  assert.ok(/letter|appeal/i.test(m36.titleEn), "en-титул m36 — про письмо/обращение: " + m36.titleEn);
  assert.ok(/mektup|başvuru/i.test(m36.titleTr), "tr-титул m36 — про письмо/обращение: " + m36.titleTr);
  assert.ok(!m36.exam, "m36 — не экзаменационный модуль");
  for (const mid of [...B2_MODS, ...REV_MODS]) {
    const m = sb.META.find((x) => x.id === mid);
    assert.ok(m && m.course === "b2", mid + " в каталоге курса b2");
    assert.ok(m.titleEn && m.titleEn !== m.title, mid + ": есть свой en-титул");
    assert.ok(m.titleTr && m.titleTr !== m.titleEn, mid + ": есть свой tr-титул");
  }
  assert.ok(sb.META.find((m) => m.id === "m47").exam === true, "m47 помечен exam:true (мок-экзамен строится по флагу)");
  assert.ok(!sb.META.find((m) => m.id === "m46").exam, "m46 — не экзаменационный");
  for (const mid of ["m11", "m35"])
    assert.ok(sb.META.find((m) => m.id === mid).exam === true, mid + " по-прежнему exam:true");
}

/* 2. Задания на кыргызском: у каждого дрилла B2 есть qKy и перевод-формулировка */
{
  for (const mid of [...B2_MODS, ...REV_MODS]) {
    assert.ok(sb.C[mid] && sb.C[mid].drill.length >= 12, mid + ": не меньше 12 дриллов");
    for (const d of sb.C[mid].drill) {
      assert.ok(typeof d.qKy === "string" && d.qKy.length > 5, mid + ": у дрилла есть кыргызская формулировка qKy");
      assert.ok(/[а-яөүң]/i.test(d.qKy), mid + ": qKy — кириллицей");
      assert.ok(d.q && d.qEn && d.qTr, mid + ": перевод формулировки на все три языка (по клику)");
      assert.ok(Array.isArray(d.opts) && d.opts.length === 4 && new Set(d.opts).size === 4, mid + ": четыре разных варианта");
      assert.ok(Number.isInteger(d.c) && d.c >= 0 && d.c < 4, mid + ": верный ответ внутри списка");
    }
  }
}

/* 3. Дефиниции: у каждого своего слова B2 — def; незнакомых токенов ≤20%,
   все незнакомые — в глоссарии модуля; глоссарий трёхъязычен. Корпус «выученного» —
   все ky-тексты фраз, опций дриллов, реплик и куплетов всей сборки (A1–B2). */
{
  const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^а-яеөүң\- ]/gi, " ");
  const toks = new Set();
  const feed = (s) => { for (const w of norm(s).split(/\s+/)) if (w && w.length > 2 && !/^-|-$/.test(w)) toks.add(w); };
  for (const mid of Object.keys(sb.C)) {
    for (const c of sb.C[mid].vocab || []) feed(c.ky);
    for (const d of sb.C[mid].drill || []) for (const o of d.opts || []) feed(o);
  }
  for (const mid of Object.keys(sb.D)) {
    for (const p of sb.D[mid].parts || []) for (const l of p.lines || []) feed(l.ky);
    for (const sn of sb.D[mid].songs || []) for (const v of sn.verses || []) feed(v.ky);
  }
  for (const t of [...toks]) {
    if (/(оо|уу|өө|үү)$/.test(t) && t.length >= 5) {
      const b = t.slice(0, -2); toks.add(b);
      if (/л$/.test(b) && b.length >= 5) toks.add(b.slice(0, -1));
    }
  }
  const known = (w) => {
    if (toks.has(w)) return true;
    for (const t of toks) {
      if (t.length >= 3 && w.startsWith(t) && w.length - t.length <= (t.length >= 4 ? 6 : 4)) return true;
      if (w.length >= 4 && t.startsWith(w) && t.length - w.length <= 6) return true;
      if (t.length >= 5 && w.length >= 5 && t.slice(0, 5) === w.slice(0, 5)) return true;
    }
    return false;
  };
  let totalOwn = 0;
  for (const mid of B2_MODS) {
    const gm = sb.G[mid];
    assert.ok(gm && typeof gm === "object", mid + ": глоссарий дефиниций в реестре DEF_GLOSS");
    for (const [w, g] of Object.entries(gm))
      assert.ok(g.ru && g.en && g.tr, mid + ": глосс «" + w + "» трёхъязычен");
    let own = 0;
    for (const c of sb.C[mid].vocab) {
      if (c.ref) continue;
      own++;
      assert.ok(typeof c.def === "string" && c.def.length > 10, mid + "/" + c.id + ": новое слово введено кыргызской дефиницией");
      assert.ok(c.ru && c.en && c.tr, mid + "/" + c.id + ": перевод на три языка");
      const words = norm(c.def).split(/\s+/).filter((w) => w.length > 2 && !/^-|-$/.test(w));
      const unk = words.filter((w) => !known(w));
      const unglossed = unk.filter((w) => !Object.prototype.hasOwnProperty.call(gm, w));
      assert.strictEqual(unglossed.length, 0, mid + "/" + c.id + ": незнакомые без глосса: " + unglossed.join(", "));
      assert.ok(words.length === 0 || unk.length / words.length <= 0.2,
        mid + "/" + c.id + ": незнакомых " + unk.length + "/" + words.length + " > 20%");
    }
    assert.ok(own >= 85, mid + ": ≥85 своих единиц (сейчас " + own + ")");
    totalOwn += own;
  }
  // фраза, совпавшая с уже введённой в другом модуле, обязана быть alias (единый прогресс)
  const seenKy = new Map();
  for (const mid of Object.keys(sb.C)) for (const c of sb.C[mid].vocab || []) {
    if (c.ref || !c.ky) continue;
    const k = c.ky.trim().toLowerCase();
    if (B2_MODS.includes(mid) && seenKy.has(k) && !B2_MODS.includes(seenKy.get(k)))
      assert.fail(mid + "/" + c.id + ": «" + c.ky + "» уже введена в " + seenKy.get(k) + " — нужен alias {ref}");
    if (!seenKy.has(k)) seenKy.set(k, mid);
  }
  console.log("  своих единиц B2: " + totalOwn + " в " + B2_MODS.length + " модулях, дефиниции ≤20% незнакомых, глоссы ru/en/tr");
}

/* 3б. Смысл alias-карточки — тот, что видит ученик. resolveVocab копирует ru/en/tr донора
   без изменений, поэтому alias полисемичного слова несёт в тематический словарь чужой
   смысл (находка 15.09.2026: alias m3_42 «баа» = «оценка» стоял среди экономики m40 между
   «каражат» и «насыя», тогда как дефиниция «инфляция» того же модуля употребляет «баа»
   как «цена»). Автоматически различить смыслы нельзя (эвристика «глосс донора поддержан
   переводами модуля» даёт 6 ложных срабатываний на 1 верное — замерено), поэтому гейт —
   регресс на настоящем REUSE-блоке сборки и реальных данных: экономический словарь m40
   после резолва вводит «баа» в значении «цена» (ru/en/tr), содержит «нарк» (М6) и не
   содержит школьной «оценки»; alias-ы B2 не битые (warn резолвера = провал). */
{
  const reuse = page.match(/\/\* ===REUSE=== \*\/([\s\S]*?)\/\* ===\/REUSE=== \*\//);
  assert.ok(reuse, "блок REUSE в сборке");
  const rb = { console: { warn: (m) => assert.fail("битый alias в B2: " + m), log() {} } };
  vm.createContext(rb);
  vm.runInContext(dm[1] + reuse[1] + ";this.resolve=(m)=>resolveVocab(CONTENT[m].vocab,CONTENT);", rb);
  for (const mid of [...B2_MODS, ...REV_MODS]) rb.resolve(mid);
  const eco = rb.resolve("m40").filter((c) => c.cat === "ekonomika");
  assert.ok(eco.some((c) => /баа/.test(c.ky) && /цена/.test(c.ru) && /price/.test(c.en) && /fiyat/.test(c.tr)),
    "m40/ekonomika: «баа» введено в значении «цена» (ru/en/tr)");
  assert.ok(eco.some((c) => c.ky === "нарк" && c.reuse && /цена/.test(c.ru)), "m40/ekonomika: «нарк» (М6) — alias цены");
  for (const c of eco)
    assert.ok(!/оценк/i.test(c.ru) && !/grade|\bmark\b/i.test(c.en), "m40/ekonomika: школьная «оценка» в экономике: " + c.id + " = " + c.ru);
  // дефиниция, употребляющая «баа» как цену, опирается на введённое в модуле значение
  const infl = eco.find((c) => c.ky === "инфляция");
  assert.ok(infl && /баа/i.test(infl.def), "m40: дефиниция «инфляция» через «баа» (цена) — значение введено в том же словаре");
  console.log("  alias-ы B2 резолвятся без потерь; m40/ekonomika — «баа» = цена, «нарк» (М6), без «оценки»");
}

/* 4. Повторительные модули B2 (m46/m47): без новых слов (гейт own==0 — в content.test
   REVISION_MODS), но канон держат: qKy у каждого дрилла (проверено выше), ref-карточки
   ведут на слова СВОЕГО курса, m47 — exam:true с планом недели по разделам меню. */
{
  for (const mid of REV_MODS) {
    assert.ok(sb.C[mid].vocab.length >= 20, mid + ": повторение не пустое (как у m34/m35 — 20 ref-карточек)");
    assert.ok(sb.C[mid].vocab.every((c) => c.ref), mid + ": только ref-карточки (повторение)");
    for (const c of sb.C[mid].vocab)
      assert.ok(B2_MODS.includes(c.ref.split("_")[0]), mid + ": ref " + c.ref + " ведёт на слово курса B2");
  }
  // план недели m47 называет разделы меню экзаменационной недели (правило владельца 21.08)
  const i18n = page.match(/\/\* ===I18N=== \*\/([\s\S]*?)\/\* ===\/I18N=== \*\//);
  assert.ok(i18n, "словарь интерфейса найден");
  const ib = { console }; vm.createContext(ib);
  vm.runInContext(i18n[1].replace("const I18N=", "var I18N=") + "; this.I18N=I18N;", ib);
  const FIELD = { ru: "plan", en: "planEn", tr: "planTr" };
  for (const lang of ["ru", "en", "tr"]) {
    const plan = sb.C.m47[FIELD[lang]] || [];
    assert.ok(plan.length, "план недели m47 на " + lang + " не пуст");
    for (const key of ["tab_howto", "tab_grp_format", "tab_exam"]) {
      const name = ib.I18N[lang][key];
      assert.ok(plan.some((s2) => s2.includes(name)), "m47 (" + lang + "): план называет раздел «" + name + "»");
    }
    const howto = sb.C.m47[lang === "ru" ? "howto" : lang === "en" ? "howtoEn" : "howtoTr"] || [];
    assert.ok(howto.length >= 4, "m47 (" + lang + "): методика подготовки из " + howto.length + " шагов");
  }
}

/* 5. Диалоги B2: у каждого контентного модуля есть диалог, персонажи — в реестре
   голосов (иначе смена пола при генерации), реплики на трёх языках. */
{
  const voices = require("../deploy/voices.json");
  for (const mid of B2_MODS) {
    assert.ok(sb.D[mid] && (sb.D[mid].parts || []).length >= 1, mid + ": диалог есть");
    for (const part of sb.D[mid].parts || [])
      for (const l of part.lines || []) {
        assert.ok(voices.characters[l.sp], mid + ": персонаж «" + l.sp + "» есть в deploy/voices.json");
        assert.ok(l.ky && l.ru && l.en && l.tr, mid + ": реплика «" + String(l.ky).slice(0, 30) + "» на четырёх языках");
      }
  }
  for (const mid of REV_MODS) assert.ok(!sb.D[mid], mid + ": у повторительного модуля диалога нет");
}

/* 6. Сборка варианта: чистый B2 несёт свои модули и доноров alias-слов, но не
   материал чужих курсов (диалоги, справочные страницы); справочник m36–m47 — по одной
   функции на модуль, и она едет только своему варианту. */
{
  const appshell = require("../server/appshell");
  const own = [...B2_MODS, ...REV_MODS];
  const html = appshell.buildAppHtml(own);
  for (let n = 36; n <= 47; n++) {
    const fn = n <= 45 ? "renderGrammarM" + n : "renderRefM" + n;
    assert.ok(new RegExp("function " + fn + "\\(").test(html), "вариант B2: справочная страница " + fn + " на месте");
    assert.ok(new RegExp("function " + fn + "\\(").test(page), "полная сборка: " + fn + " на месте");
  }
  assert.ok(!/function renderGrammarM24\(/.test(html), "в вариант B2 не едет справочник B1");
  assert.ok(!/function renderGrammarM12\(/.test(html), "в вариант B2 не едет справочник A2");
  const b1 = appshell.buildAppHtml(["m24", "m25", "m26", "m27", "m28", "m29", "m30", "m31", "m32", "m33", "m34", "m35"]);
  assert.ok(!/function renderGrammarM36\(/.test(b1) && !b1.includes("DRILL_M36"), "в вариант B1 материал B2 не едет");
  // экзаменационная спецификация B2 — публичная, едет в любой вариант
  assert.ok(html.includes("===EXAM-B2==="), "спека экзамена B2 в варианте B2");
  assert.ok(b1.includes("===EXAM-B2==="), "спека — публичные требования, есть и в варианте B1");
  // тексты экзамена — материал курса: только своему варианту
  assert.ok(html.includes("===EXAM-TEXTS-B2===") && html.includes("EXAM_TEXT_SETS.b2"), "тексты экзамена B2 — в варианте B2");
  assert.ok(!b1.includes("okuu_rasmiy_kat"), "тексты экзамена B2 не едут в вариант B1");
}

console.log("b2.test.js: OK (темы курса без пруфов и названия у 10 модулей, qKy у дриллов, дефиниции ≤20% с глоссами ru/en/tr, " +
  "повторение m46/m47 по своему курсу, персонажи в реестре голосов, изоляция варианта)");
