"use strict";
/* Гейты курса B1 (решения владельца 18.08.2026 и 30.10.2026):
   1) тема модуля — тема курса learn.kg: в данных модулей нет реестров пруфов M<n>_REFS,
      ссылок на сайт тестирования, названия тестирующей организации и заявлений
      «официальная тема / как на экзамене» (кыргызские фразы с названием — только
      явный список, ждущий решения владельца: сочинять замену запрещено);
   2) формулировки заданий — на кыргызском (qKy у каждого дрилла B1), перевод по клику;
   3) каждое новое слово введено кыргызской дефиницией через выученное: незнакомых
      токенов ≤20% массы дефиниции, каждый — в глоссарии модуля с ru/en/tr.
   Проверки — по артефакту (сборка варианта) и исполнением, не грепом. */
const assert = require("assert");
const vm = require("vm");
const { buildAppHtml } = require("../server/appshell");

const page = buildAppHtml();
const dm = page.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
assert.ok(dm, "маркеры DATA в сборке");
const sb = {};
vm.createContext(sb);
const metaSrc = page.match(/const MODULE_META=[\s\S]*?MODULE_META\.forEach[^\n]*\n/);
assert.ok(metaSrc, "реестр MODULE_META извлечён из сборки");
vm.runInContext(dm[1] + metaSrc[0] + ';this.C=CONTENT;this.G=DEF_GLOSS;this.META=MODULE_META;this.D=typeof DIALOGS!=="undefined"?DIALOGS:{};', sb);

const B1_MODS = ["m24","m25","m26","m27","m28","m29","m30","m31","m32","m33"]; // при добавлении модуля B1 — дописать сюда (и он попадёт под все гейты)

/* 1. Тема модуля — своя тема курса (решение владельца 30.10.2026, претензия
   тестирующей организации): реестров пруфов M<n>_REFS в сборке нет, ссылок на её
   сайт и её названия в данных модулей нет, заявлений «официальная тема / как на
   экзамене / дескриптор» в переводах и пояснениях нет. Кыргызский текст не
   переписывается (сочинять запрещено) — фразы курса с названием перечислены явно
   и ждут решения владельца; перевод несёт название только вслед за своим ky. */
const NAME = /кыргыз\s*тест|kyrgyz\s*test|k[ıi]rg[ıi]z\s*test/i;
const SITE = /kyrgyz\s*test\.gov\.kg|docs\/research\/kyrgyz\s*test/i;
const CLAIM = /официальн[^\s:;,.]*\s+([^\s:;,.]+\s+){0,2}(тем|задан|дескриптор|требован)|official\s+([^\s:;,.]+\s+){0,2}(topic|task|descriptor|requirement)|resm[iî]\s+([^\s:;,.]+\s+){0,2}(konu|betimleyici|tanımlayıcı)|как на экзамене|as in the exam|sınavdaki gibi|дескриптор|descriptor|betimleyici|tanımlayıcı|субтест|subtest|alt test/i;
const KY_FMT = /субтест|дескриптор/i;                              // их формат в кыргызском тексте
const KY_KEYS = new Set(["ky", "qKy", "def", "opts"]);          // кыргызские поля карточек и дриллов
const KY_KEYS_DLG = new Set(["ky", "q", "opts", "title", "name"]); // в диалогах q/title/name — кыргызские
// Фразы курса, где формат тестирования («субтест») стоит внутри кыргызского текста:
// ждут решения владельца (правка = сочинение кыргызского). Название учреждения в
// кыргызских фразах заменено на «мамлекеттик тест» (решение владельца 30.10.2026). Перевод такой фразы честно
// повторяет оригинал, поэтому проверка переводов на неё не распространяется.
// Ключ — id карточки/реплики или начало qKy/q (40 символов).
const PENDING = new Set([
  "m28:m28_59", "m28:ph_m28d1_02", "m28:ph_m28d1_04",
  "m28:Сынак канча субтесттен турат?", "m28:Сүйлөө субтестинде кайсы тема түштү?",
]);
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
  for (const mid of B1_MODS)
    assert.strictEqual(vm.runInContext("typeof " + mid.toUpperCase() + "_REFS", sb), "undefined", mid + ": реестр пруфов M_REFS удалён");
  const seen = new Set();
  for (const mid of B1_MODS) {
    scanModule(mid, sb.C[mid], KY_KEYS, seen);
    scanModule(mid, sb.D[mid], KY_KEYS_DLG, seen);
  }
  for (const k of PENDING) assert.ok(seen.has(k), "PENDING «" + k + "» больше не несёт названия — убери из списка");
  // справочные страницы B1 — то, что видит ученик: ни ссылки, ни названия

  for (let n = 24; n <= 33; n++) {
    const f = page.match(new RegExp("\\nfunction renderGrammarM" + n + "\\(m\\)\\{[\\s\\S]*?\\n\\}"));
    assert.ok(f, "renderGrammarM" + n + " в сборке");
    const src = f[0];
    assert.ok(!NAME.test(src) && !SITE.test(src), "renderGrammarM" + n + ": название или сайт тестирования на справочной странице");
    assert.ok(!/официальн\S* тем|official (\S+ )?topic|resmî (\S+ )?konu|как на экзамене|as in the exam|экзаменационн|exam answer|exam-answer|субтест|subtest|alt test|дескриптор|descriptor|betimleyici|tanımlayıcı/i.test(src),
      "renderGrammarM" + n + ": заявление «официальная тема / субтест / дескриптор» на справочной странице");
  }
}

/* 1б. Титул модуля соответствует заявленной теме (ловит «Детство» на модуле про
   мекеме — реальный промах первой сборки), плюс exam-флаги реестра: мок-карточка
   строится по ним, а не по «последнему модулю курса» */
{
  const m24 = sb.META.find((m) => m.id === "m24");
  assert.ok(/учреждени/i.test(m24.title), "ru-титул m24 — про учреждение: " + m24.title);
  assert.ok(/institution|workplace/i.test(m24.titleEn), "en-титул m24 — про учреждение");
  assert.ok(/kurum/i.test(m24.titleTr), "tr-титул m24 — про учреждение");
  assert.ok(!m24.exam, "m24 — не экзаменационный модуль");
  for (const mid of ["m11", "m23"])
    assert.ok(sb.META.find((m) => m.id === mid).exam === true, mid + " помечен exam:true (мок-экзамен строится по флагу)");
}

/* 2. Задания на кыргызском: у каждого дрилла B1 есть qKy и перевод-формулировка */
{
  for (const mid of B1_MODS) {
    for (const d of sb.C[mid].drill) {
      assert.ok(typeof d.qKy === "string" && d.qKy.length > 5, mid + ": у дрилла есть кыргызская формулировка qKy");
      assert.ok(/[а-яөүң]/i.test(d.qKy), mid + ": qKy — кириллицей");
      assert.ok(d.q && d.qEn && d.qTr, mid + ": перевод формулировки на все три языка (по клику)");
    }
  }
}

/* 3. Дефиниции: у каждого своего слова B1 — def; незнакомых токенов ≤20%,
   все незнакомые — в глоссарии модуля; глоссарий трёхъязычен. Корпус «выученного» —
   все ky-тексты фраз, опций дриллов, реплик и куплетов всей сборки. */
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
  // основы глагольных имён: талкуулоо → талкуул/талкуу, аткаруу → аткар
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
  for (const mid of B1_MODS) {
    const gm = sb.G[mid];
    assert.ok(gm && typeof gm === "object", mid + ": глоссарий дефиниций в реестре DEF_GLOSS");
    for (const [w, g] of Object.entries(gm))
      assert.ok(g.ru && g.en && g.tr, mid + ": глосс «" + w + "» трёхъязычен");
    let own = 0;
    for (const c of sb.C[mid].vocab) {
      if (c.ref) continue;
      own++;
      assert.ok(typeof c.def === "string" && c.def.length > 10, mid + "/" + c.id + ": новое слово введено кыргызской дефиницией");
      const words = norm(c.def).split(/\s+/).filter((w) => w.length > 2 && !/^-|-$/.test(w));
      const unk = words.filter((w) => !known(w));
      const unglossed = unk.filter((w) => !Object.prototype.hasOwnProperty.call(gm, w));
      assert.strictEqual(unglossed.length, 0, mid + "/" + c.id + ": незнакомые без глосса: " + unglossed.join(", "));
      assert.ok(words.length === 0 || unk.length / words.length <= 0.2,
        mid + "/" + c.id + ": незнакомых " + unk.length + "/" + words.length + " > 20%");
    }
    assert.ok(own >= 85, mid + ": ≥85 своих единиц (сейчас " + own + ")");
  }
}

/* 4. Движок B1 исполнением: qKy показан сразу, перевод — по клику; глосс-слово
   дефиниции кликом раскрывает разбор. Стабы DOM — как в stt.test.js. */
{
  const bm = page.match(/\/\* ===B1===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/B1=== \*\//);
  assert.ok(bm, "маркеры ===B1=== в сборке");
  const vsb = { console };
  vm.createContext(vsb);
  vm.runInContext(bm[1] + ";this.tk=b1DefTokens;this.gt=b1GlossText;this.mask=b1MaskDef;this.can=b1CanDefPrompt;this.pd=b1PromptDef;", vsb);
  // маска ответа: дефиниция не выдаёт слово в режиме ввода (реальный промах первой сборки)
  assert.strictEqual(vsb.mask("Мекеменин бир бөлүгү; ар бир бөлүм өз иши менен алектенет.", "бөлүм"),
    "Мекеменин бир … ар бир … өз иши менен алектенет.", "слово-ответ и его словоформы замаскированы");
  assert.strictEqual(vsb.mask("Иштин сапатын катуу талап кылган.", "талапчыл"),
    "Иштин сапатын катуу талап кылган.", "«талап кылган» у «талапчыл» не тронут (ложное срабатывание старой маски)");
  assert.strictEqual(vsb.mask("Расмий кагаз.", "арыз"), "Расмий кагаз.", "чужие слова не тронуты");
  // дефиниция-подсказка — только короткой цели; предложениям остаётся перевод
  assert.strictEqual(vsb.can("мекеме"), true, "слово — можно");
  assert.strictEqual(vsb.can("Биздин мекемеде беш бөлүм бар."), false, "предложение — нельзя (дефиниция там комментарий)");
  assert.strictEqual(vsb.can("Кирсем болобу?"), false, "вопрос — нельзя");
  // выеденная маской дефиниция не годится в подсказки — честный фолбэк на перевод
  assert.strictEqual(vsb.pd("Кызматта аткарыла турган милдет.", "кызматтык милдет"), null,
    "после маски меньше трёх значимых слов — подсказкой остаётся перевод");
  assert.strictEqual(vsb.pd("Мекеменин же бөлүмдүн башчысы.", "жетекчи"),
    "Мекеменин же бөлүмдүн башчысы.", "полная дефиниция без вхождений цели проходит как есть");
  const gm = { "мисалы": { ru: "например", en: "for example", tr: "örneğin" } };
  const parts = JSON.parse(JSON.stringify(vsb.tk("Расмий кагаз; мисалы, паспорт.", gm)));
  assert.ok(parts.some((p) => p.g && p.w === "мисалы"), "токен из глоссария получает ссылку на глосс (пунктуация не мешает)");
  assert.ok(parts.filter((p) => p.g).length === 1, "остальные токены — без глосса");
  assert.strictEqual(vsb.gt(gm["мисалы"], "ru"), "например", "глосс по-русски");
  assert.strictEqual(vsb.gt(gm["мисалы"], "en"), "for example", "глосс по-английски");
  assert.strictEqual(vsb.gt(gm["мисалы"], "tr"), "örneğin", "глосс по-турецки");

  // drillQNode/b1Prompt/b1DefNode — исполнение с DOM-стабом
  const fns = ["b1DefNode", "b1Prompt", "drillQNode"].map((n) => {
    const f = page.match(new RegExp("\\nfunction " + n + "\\(([^)]*)\\)\\{[\\s\\S]*?\\n\\}"));
    assert.ok(f, n + " извлечена из сборки");
    return f[0];
  }).join("\n");
  const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [],
    append(...k) { this.kids.push(...k); },
    replaceWith(n) { this.replaced = n; },
    addEventListener(type, fn) { (this.on = this.on || {})[type] = fn; } });
  const flat = (n, acc) => { if (!n || !n.kids) return acc;
    for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
  const esb = { console, t: (k) => k, currentLang: () => "ru", homeOf: () => "m24",
    DEF_GLOSS: { m24: gm }, gloss: (c) => c.ru, drillQ: (it) => it.q,
    h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; } };
  vm.createContext(esb);
  vm.runInContext(bm[1] + fns + ";this.dq=drillQNode;this.bp=b1Prompt;", esb);
  // дрилл B1: qKy на экране, перевод спрятан за кликом
  const node = esb.dq({ qKy: "Кыргызча суроо?", q: "Русский перевод?", opts: [] });
  const texts = flat(node, [node]).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
  assert.ok(texts.includes("Кыргызча суроо?"), "qKy показан сразу");
  assert.ok(!texts.includes("Русский перевод?"), "перевод формулировки скрыт до клика");
  const trBtn = flat(node, [node]).find((n) => n.on && n.on.click);
  assert.ok(trBtn, "клик-раскрытие перевода есть");
  trBtn.on.click();
  assert.ok(trBtn.replaced && trBtn.replaced.kids.includes("Русский перевод?"), "клик открывает перевод");
  // дрилл без qKy (старые модули) — прежний рендер
  const old = esb.dq({ q: "Обычный вопрос", opts: [] });
  assert.ok(flat(old, [old]).concat([old]).some((n) => n.kids && n.kids.includes("Обычный вопрос")), "без qKy — прежняя формулировка");
  // подсказка ввода: дефиниция с кликабельным глосс-словом, перевод по клику
  const p = esb.bp({ id: "x", ru: "документ", def: "Расмий кагаз; мисалы, паспорт." });
  const gw = flat(p, [p]).find((n) => String(n.attrs.class || "").includes("b1-gw"));
  assert.ok(gw, "незнакомое слово дефиниции кликабельно");
  gw.attrs.onclick();
  const info = flat(p, [p]).find((n) => n.textContent);
  assert.ok(info && /мисалы — например/.test(info.textContent), "клик по слову даёт разбор");
  const ptexts = flat(p, [p]).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
  assert.ok(!ptexts.includes("документ"), "перевод слова скрыт до клика");
}

/* 4б. Повторительные модули B1 (m34/m35): без новых слов (гейт own==0 — в content.test
   REVISION_MODS), но канон B1 держат: qKy у каждого дрилла, m35 — exam:true. */
{
  for (const mid of ["m34", "m35"]) {
    for (const d of sb.C[mid].drill) {
      assert.ok(typeof d.qKy === "string" && d.qKy.length > 5, mid + ": у дрилла есть qKy");
      assert.ok(/[а-яөүң]/i.test(d.qKy), mid + ": qKy — кириллицей");
      assert.ok(d.q && d.qEn && d.qTr, mid + ": перевод формулировки на все три языка");
    }
    assert.ok(sb.C[mid].vocab.every((c) => c.ref), mid + ": только ref-карточки (повторение)");
  }
  assert.ok(sb.META.find((m) => m.id === "m35").exam === true, "m35 помечен exam:true");
  assert.ok(!sb.META.find((m) => m.id === "m34").exam, "m34 — не экзаменационный");
}

/* 5. Диалоги B1: персонажи — в реестре голосов (иначе смена пола при генерации) */
{
  const voices = require("../deploy/voices.json");
  for (const mid of [...B1_MODS, "m34", "m35"]) {
    for (const part of (sb.D[mid] || {}).parts || [])
      for (const l of part.lines || [])
        assert.ok(voices.characters[l.sp], mid + ": персонаж «" + l.sp + "» есть в deploy/voices.json");
  }
}

console.log("b1.test.js: OK (темы курса без пруфов и названия, qKy у дриллов, дефиниции ≤20% с глоссами ru/en/tr, движок исполнением, персонажи в реестре голосов)");
