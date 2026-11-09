"use strict";
/* Переводчик частых фраз /perevodchik: живой артефакт сервера. Поиск — вырезается
   из ОТДАННОЙ страницы (маркеры ===PEREVODCHIK-LOGIC===/===PEREVODCHIK-DATA===)
   и исполняется в vm: нормализация (ё→е, регистр, пробелы), приоритет префикса,
   лимит выдачи. Полнота: PHRASES каждого варианта = все не-ref фразы CONTENT
   в паре своего языка. Бюджет размера — чтобы рост курса не раздул страницу молча. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { startServer } = require("./helpers/serve");
const { loadBlock } = require("./helpers/block");
const { fakeDom } = require("./helpers/fake-dom");
const { LIMITS, createMissStore, validateMiss } = require("../server/pv-miss");

const PORT = 8213;
const { CONTENT: C } = loadBlock("DATA", { expose: ["CONTENT"] });
const expected = [];
for (const mod of Object.keys(C)) for (const v of C[mod].vocab || []) if (!v.ref) expected.push(v);
const PV = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "perevodchik", "perevodchik.json"), "utf8"));
const RZ = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "razgovornik", "razgovornik.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9"), ILIM = B("ilim", "Tst-vKIxmveh-9");

// Озвучка в выдаче: кнопка только у фраз публичного снимка. Фикстуры — фраза демо m0,
// фраза разговорника из другого модуля и её сосед вне разговорника (файл есть, но он за курсом)
const demoV = C.m0.vocab.find((v) => v.demo && !v.ref);
// модуль фикстуры — вне демо: m0 (демо-срез) и модуль демо (М1 открыт целиком) публичны и так
const rzPick = RZ.sections.flatMap((x) => x.pick).find((p) => p.mod !== "m0" && p.mod !== "m1");
const rzCats = new Set(RZ.sections.flatMap((x) => x.pick).filter((p) => p.mod === rzPick.mod).map((p) => p.cat));
const rzV = C[rzPick.mod].vocab.find((v) => !v.ref && v.cat === rzPick.cat);
const closedV = C[rzPick.mod].vocab.find((v) => !v.ref && !rzCats.has(v.cat));
const PUBLIC_AUDIO = { [expected.indexOf(demoV)]: "m0/" + demoV.id, [expected.indexOf(rzV)]: rzPick.mod + "/" + rzV.id };

// Клиент страницы целиком (данные + логика + обработчики) — в vm на бутафорском DOM
function runPage(html) {
  const src = html.match(/<script>\n("use strict";\n\/\* ===PEREVODCHIK-DATA=== \*\/[\s\S]*?)<\/script>/)[1];
  const { doc, mk } = fakeDom();
  const input = mk("input"); input.setAttribute("id", "pv-q");
  const res = mk("div"); res.setAttribute("id", "pv-res");
  doc.body.append(input, res);
  const timers = new Map(); let tid = 0;
  const net = [], goals = [];
  const sb = { console, document: doc, encodeURIComponent, JSON,
    setTimeout: (f) => { timers.set(++tid, f); return tid; }, clearTimeout: (id) => timers.delete(id),
    fetch: (u, o) => { net.push([u, o.method, JSON.parse(o.body), o.keepalive]); return Promise.resolve({ status: 200 }); },
    ym: (...a) => goals.push(a[2]) };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(src, sb);
  const type = (v) => { input.value = v; input.dispatch("input"); };
  const flush = () => { const fs_ = [...timers.values()]; timers.clear(); fs_.forEach((f) => f()); };
  return { sb, res, type, flush, net, goals, timers };
}

async function main() {
  const DATA = "/tmp/kga1-pv-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  assert.ok(demoV && rzV && closedV, "фикстуры озвучки: демо, разговорник и закрытая фраза нашлись");
  for (const [mod, v] of [["m0", demoV], [rzPick.mod, rzV], [rzPick.mod, closedV]]) {
    fs.mkdirSync(path.join(DATA, "audio", mod), { recursive: true });
    fs.writeFileSync(path.join(DATA, "audio", mod, v.id + ".mp3"), Buffer.from("pvfixture-" + v.id));
  }
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const { req } = srv;

    for (const lang of ["ru", "en", "tr"]) {
      const r = await req("GET", "/perevodchik/" + lang);
      assert.strictEqual(r.status, 200, "/perevodchik/" + lang + " отвечает");
      const html = r.text;

      // бюджет: страница несёт весь словарь пар — рост курса не должен раздувать её молча.
      // 160 → 200 КБ поднято осознанно с курсом B1 (m24–m30 добавили ~600 фраз); gzip ~55 КБ.
      // 200 → 300 КБ — курс B2 (m36–m45, +920 фраз, словарь 2789 → 3709): замер 2026-09-14 —
      // ru 210 / en 284 / tr 272 КБ (en/tr тяжелее ru колонкой транслита), по сети 96–120 КБ
      // gzip. Потолок оставляет запас на правки текстов, не на следующий курс: C1 — новое решение.
      assert.ok(html.length <= 300 * 1024, lang + ": страница ≤ 300 КБ, сейчас " + Math.round(html.length / 1024) + " КБ");

      // данные: все не-ref фразы, пара СВОЕГО языка
      const dm = html.match(/\/\* ===PEREVODCHIK-DATA=== \*\/([\s\S]*?)\/\* ===\/PEREVODCHIK-DATA=== \*\//);
      assert.ok(dm, lang + ": маркеры PEREVODCHIK-DATA");
      const dsb = {};
      vm.createContext(dsb);
      vm.runInContext(dm[1] + "; this.PHRASES=PHRASES;", dsb);
      assert.strictEqual(dsb.PHRASES.length, expected.length,
        lang + ": PHRASES = все не-ref фразы CONTENT (" + expected.length + ")");
      // выборочная сверка пары своего языка: первая и последняя фразы
      assert.strictEqual(dsb.PHRASES[0][0], expected[0].ky, lang + ": ky первой фразы");
      assert.strictEqual(dsb.PHRASES[0][1], expected[0][lang], lang + ": глосса первой фразы — свой язык");
      const last = expected.length - 1;
      assert.strictEqual(dsb.PHRASES[last][1], expected[last][lang], lang + ": глосса последней фразы — свой язык");
      // en/tr: третья колонка — транслит ky латиницей своей конвенции (кириллицу не прочтут);
      // ru-вариант транслита не несёт (читателю кириллица родная, байты не тратим)
      if (lang === "ru") {
        assert.strictEqual(dsb.PHRASES[0].length, 2, "ru: пары без транслита");
        assert.ok(!html.includes('class="lat"'), "ru: транслит-спанов нет");
      } else {
        assert.strictEqual(dsb.PHRASES[0].length, 3, lang + ": тройки с транслитом");
        assert.ok(/^[^а-яёА-ЯЁ]+$/.test(dsb.PHRASES[0][2]), lang + ": транслит без кириллицы: " + dsb.PHRASES[0][2]);
        assert.ok(html.includes('class="lat"'), lang + ": транслит виден в частых фразах");
      }
      if (lang === "tr") {
        // турецкая конвенция: ч→ç, ш→ş, ы→ı — берём фразу с «ч» и сверяем
        const chIdx = expected.findIndex((v) => v.ky.toLowerCase().includes("ч"));
        assert.ok(chIdx >= 0 && dsb.PHRASES[chIdx][2].includes("ç"), "tr: ч → ç в транслите");
      }

      // счётчик {n} подставлен настоящим числом и не остался плейсхолдером
      assert.ok(!html.includes("{n}"), lang + ": плейсхолдер {n} не протёк в страницу");
      assert.ok(html.includes(String(expected.length)), lang + ": заявленное число фраз = " + expected.length);

      // магниты и перелинковка
      assert.ok(html.includes('href="/demo/' + lang + '"'), lang + ": CTA на демо");
      assert.ok(!/кыргызтест|kyrgyztest|kırgıztest/i.test(html), lang + ": фраз с названием учреждения тестирования на странице нет");
      assert.ok(html.includes("wa.me/996505854856"), lang + ": контакт Алтынай");
      assert.ok(html.includes('href="/razgovornik/' + lang), lang + ": ссылки на разговорник");
      // машинный переводчик — шаблон из данных (ru — Яндекс, en/tr — Google) в паре своего языка
      // шаблон заполняет та же pvMtUrl, что отдана странице (сервер исполняет её текст, не копию)
      const pg = runPage(html);
      const mt = PV.ui[lang].mtUrl, mtFill = (q) => pg.sb.pvMtUrl(mt, q, lang);
      assert.ok(mtFill("").includes("=" + lang + "&") && mtFill("").includes("=ky&"), lang + ": пустой запрос — " + lang + "→ky");
      assert.ok(html.includes('href="' + esc(mtFill("")) + '"'), lang + ": ссылка на машинный перевод " + lang + "→ky");
      if (lang === "ru") assert.ok(mt.startsWith("https://translate.yandex.ru/"), "ru: Яндекс Переводчик (решение владельца 08.10.2026)");

      // озвучка в выдаче: ровно фразы публичного снимка, индекс указывает на свою фразу,
      // и каждая отдаётся анониму (закрытая фраза с файлом на диске кнопки не получает)
      assert.deepStrictEqual({ ...vm.runInContext("PV_AUDIO", dsb) }, PUBLIC_AUDIO, lang + ": PV_AUDIO = демо + разговорник");
      for (const [i, k] of Object.entries(PUBLIC_AUDIO)) {
        assert.strictEqual(dsb.PHRASES[i][0], expected[i].ky, lang + ": кнопка " + k + " на своей фразе");
        assert.strictEqual((await req("GET", "/api/audio/" + k + ".mp3")).status, 200, lang + ": " + k + " звучит анониму");
      }

      // клиент целиком: промах → блок «нет в базе», похожие фразы, внешний перевод, демо,
      // и ОДНА отправка промаха после паузы ввода (префиксы набора не уходят)
      const u = JSON.parse(JSON.stringify(PV.ui[lang]).replace(/\{n\}/g, String(expected.length)));
      const query = lang === "ru" ? "рахмат qqzzqq" : lang === "en" ? "thank qqzzqq" : "teşekkürler qqzzqq";
      pg.type(query.slice(0, -1));
      pg.type(query);
      const box = pg.res.querySelector(".pv-miss");
      assert.ok(box, lang + ": промах показывает блок «нет в базе»");
      assert.strictEqual(box.querySelector("b").textContent, u.missTitle, lang + ": заголовок промаха");
      assert.ok(box.textContent.includes(u.missText), lang + ": пояснение со счётчиком фраз");
      const near = [...vm.runInContext("pvNearby(" + JSON.stringify(query) + ",PHRASES,6)", pg.sb)];
      assert.ok(near.length > 0, lang + ": по слову запроса нашлись похожие фразы");
      assert.deepStrictEqual(box.querySelectorAll(".ph").map((r) => r.querySelector(".ky").textContent), near.map((i) => dsb.PHRASES[i][0]), lang + ": похожие фразы в выдаче");
      assert.strictEqual(box.querySelector(".pv-near").textContent, u.missNear);
      const mtA = box.querySelector(".cta2");
      assert.strictEqual(mtA.href, mtFill(query), lang + ": внешний перевод с готовым текстом");
      assert.ok(mtA.href.includes(encodeURIComponent(query)), lang + ": текст запроса в адресе");
      assert.strictEqual(mtA.rel, "noopener noreferrer");
      assert.strictEqual(box.querySelector(".cta").href, "/demo/" + lang, lang + ": приглашение в демо");
      assert.strictEqual(pg.net.length, 0, lang + ": до паузы ввода промах не отправлен");
      assert.strictEqual(pg.timers.size, 1, lang + ": таймер префикса снят новым вводом");
      pg.flush();
      assert.deepStrictEqual(pg.net, [["/api/pv-miss", "POST", { q: query, lang }, true]], lang + ": один промах — полный запрос");
      pg.type(query); pg.flush();
      assert.strictEqual(pg.net.length, 1, lang + ": повтор того же запроса не шлётся");
      mtA.dispatch("click");
      assert.deepStrictEqual(pg.goals, ["pv_miss", "pv_mt"], lang + ": цели Метрики промаха и перехода");
      pg.type(lang === "ru" ? "рахмат" : lang === "en" ? "thank" : "teşekkür");
      assert.ok(!pg.res.querySelector(".pv-miss") && pg.res.querySelectorAll(".ph").length > 0, lang + ": найденное — выдача без блока промаха");
      assert.strictEqual(pg.timers.size, 0, lang + ": находка промах не отправляет");
      const sentBefore = pg.net.length;
      pg.type("?!");
      assert.ok(!pg.res.querySelector(".pv-miss") && pg.res.querySelectorAll(".ph").length === 0, lang + ": одни знаки — ни выдачи, ни блока промаха");
      assert.strictEqual(pg.timers.size, 0, lang + ": одни знаки промах не заводят");
      pg.flush();
      assert.strictEqual(pg.net.length, sentBefore, lang + ": одни знаки на сервер не уходят");
      const [aIdx, aKey] = Object.entries(PUBLIC_AUDIO)[0];
      pg.type(expected[aIdx].ky);
      const withBtn = pg.res.querySelectorAll(".pl").map((b) => b.attrs["data-a"]);
      assert.ok(withBtn.includes(aKey), lang + ": у найденной фразы снимка есть ▶");
    }

    // ── промахи на сервере: приём, агрегат, видимость учителю, отказы, лимит ──
    const post = (body, ip) => req("POST", "/api/pv-miss", { body, headers: { "x-forwarded-for": ip || "10.0.0.1" } });
    assert.strictEqual((await post({ q: "Как доехать  до Оша", lang: "ru" })).status, 200, "промах принят");
    assert.strictEqual((await post({ q: "как доехать до оша", lang: "ru" })).status, 200, "тот же запрос в другой записи");
    assert.strictEqual((await post({ q: "+996 505 85 48 56", lang: "ru" })).status, 200, "телефон молча не храним");
    assert.strictEqual((await post({ q: "me@mail.kg", lang: "en" })).status, 200, "почту молча не храним");
    for (const [b, why] of [[{ q: "x", lang: "ru" }, "одна буква"], [{ q: "салам", lang: "de" }, "чужой язык"],
      [{ q: "а".repeat(LIMITS.MAX_RAW + 1), lang: "ru" }, "длиннее потолка"], [{ lang: "ru" }, "без запроса"]])
      assert.strictEqual((await post(b)).status, 400, "отказ: " + why);
    assert.strictEqual((await req("GET", "/api/admin/pv-miss")).status, 401, "аноним промахи не видит");
    assert.strictEqual((await req("GET", "/api/admin/pv-miss", { auth: ILIM })).status, 403, "ученик промахи не видит");
    const adm = await req("GET", "/api/admin/pv-miss", { auth: ALT });
    assert.strictEqual(adm.status, 200, "преподаватель видит промахи");
    const items = JSON.parse(adm.text).items;
    const hit = items.find((x) => x.q === "как доехать до оша" && x.lang === "ru");
    assert.ok(hit && hit.n === 2, "нормализованный запрос сложен в один счётчик: " + JSON.stringify(items));
    assert.ok(!items.some((x) => /505|mail/.test(x.q)), "контакты в агрегат не попали");
    assert.ok(fs.readFileSync(path.join(DATA, "pv-miss.json"), "utf8").includes("как доехать до оша"), "агрегат лежит на диске");
    // удаление по просьбе: только преподаватель, запрос уходит из списка и с диска
    const del = (auth, body) => req("DELETE", "/api/admin/pv-miss", { auth, body });
    assert.strictEqual((await del(ILIM, { lang: "ru", q: "как доехать до оша" })).status, 403, "ученик удалять не может");
    assert.strictEqual((await del(ALT, { lang: "ru", q: "нет такого" })).status, 404, "несуществующий запрос — 404");
    assert.strictEqual((await del(ALT, { lang: "ru" })).status, 400, "без q — 400");
    assert.strictEqual((await del(ALT, { lang: "ru", q: "как доехать до оша" })).status, 200, "преподаватель удаляет запрос");
    const after = JSON.parse((await req("GET", "/api/admin/pv-miss", { auth: ALT })).text).items;
    assert.ok(!after.some((x) => x.q === "как доехать до оша"), "удалённого нет в списке");
    assert.ok(!fs.readFileSync(path.join(DATA, "pv-miss.json"), "utf8").includes("как доехать до оша"), "удалённого нет на диске");
    for (let i = 0; i < 30; i++) await post({ q: "лимит " + i, lang: "ru" }, "10.0.0.99");
    assert.strictEqual((await post({ q: "лимит 31", lang: "ru" }, "10.0.0.99")).status, 429, "31-й промах за 10 минут с IP — 429");
    assert.strictEqual((await post({ q: "другой адрес", lang: "ru" }, "10.0.0.100")).status, 200, "лимит — по адресу, не общий");

    // ── логика поиска: вырезается из отданного ru-варианта, гоняется на модельных данных ──
    const ruHtml = (await req("GET", "/perevodchik/ru")).text;
    const lm = ruHtml.match(/\/\* ===PEREVODCHIK-LOGIC=== \*\/([\s\S]*?)\/\* ===\/PEREVODCHIK-LOGIC=== \*\//);
    assert.ok(lm, "маркеры PEREVODCHIK-LOGIC в артефакте");
    const sb = {};
    vm.createContext(sb);
    vm.runInContext(lm[1] + "; this.searchPhrases=searchPhrases; this.pvNorm=pvNorm; this.pvFold=pvFold; this.pvOneEdit=pvOneEdit;", sb);

    const model = [
      ["саламатсызбы", "здравствуйте (вежливо)"],   // 0
      ["салам", "привет"],                           // 1
      ["рахмат", "спасибо"],                         // 2
      ["чоң рахмат", "большое спасибо"],             // 3
      ["үй", "дом"],                                 // 4
      ["мен үйдөмүн", "я дома, ЁЛКА для теста"],     // 5
    ];
    // нормализация: регистр, ё→е, схлоп пробелов
    assert.strictEqual(sb.pvNorm("  ЁлКа   ТеСт "), "елка тест", "pvNorm: регистр, ё→е, пробелы");
    // префикс сильнее вхождения: «салам» — сначала точные префиксы, потом «саламатсызбы»?
    // нет: «саламатсызбы» тоже начинается с «салам» — оба префиксные, порядок исходный
    assert.deepStrictEqual([...sb.searchPhrases("салам", model)], [0, 1], "префиксы по ky в исходном порядке");
    // вхождение НЕ с начала — после префиксных: «рахмат» в «чоң рахмат» — вхождение
    assert.deepStrictEqual([...sb.searchPhrases("рахмат", model)], [2, 3], "префикс раньше вхождения");
    // поиск по глоссе: «спасибо»
    assert.deepStrictEqual([...sb.searchPhrases("спасибо", model)], [2, 3], "поиск по колонке перевода");
    // ё→е симметрично: запрос «елка» находит глоссу с «ЁЛКА»
    assert.deepStrictEqual([...sb.searchPhrases("елка", model)], [5], "ё→е в обе стороны");
    // пустой запрос — пусто
    assert.deepStrictEqual([...sb.searchPhrases("   ", model)], [], "пустой запрос — пустая выдача");
    // фолдинг особых букв: без кыргызской раскладки «уй» обязан находить «үй»
    assert.deepStrictEqual([...sb.searchPhrases("уй", model)], [4, 0, 5], "ө/ү/ң сворачиваются: уй → үй (префикс), затем вхождения (здравст-уй-те, үйдөмүн)");
    assert.deepStrictEqual([...sb.searchPhrases("чон рахмат", model)], [3], "ң→н: «чон рахмат» находит «чоң рахмат»");
    // фуззи-фолбэк: одна правка по слову, только когда точных совпадений нет
    assert.deepStrictEqual([...sb.searchPhrases("ракмат", model)], [2, 3], "опечатка в одну букву: ракмат → рахмат");
    assert.deepStrictEqual([...sb.searchPhrases("спасибa", model)], [2, 3], "одна замена в глоссе: спасибa → спасибо");
    assert.deepStrictEqual([...sb.searchPhrases("абракадабра", model)], [], "две и больше правок — не тянем");
    assert.ok(sb.pvOneEdit("рахмат", "рахмат") && sb.pvOneEdit("ахмат", "рахмат") && sb.pvOneEdit("рахмато", "рахмат"), "oneEdit: замена/удаление/вставка");
    assert.ok(!sb.pvOneEdit("рахмат", "тамхар"), "oneEdit: перестановки не пролезают");
    // точное совпадение раньше фуззи-добавки: сосед в одну правку идёт ПОСЛЕ точных
    const model2 = model.concat([["рахмет", "спасибо (каз.)"]]);
    assert.deepStrictEqual([...sb.searchPhrases("рахмат", model2)], [2, 3, 6], "фуззи-сосед после точных, не вместо");
    // порог фуззи: на трёх буквах окрестность в одну правку слишком плотная — молчим
    assert.deepStrictEqual([...sb.searchPhrases("дым", model)], [], "3-буквенная опечатка фуззи не тянется");
    // транслит-колонка: латинский запрос находит фразу по третьей колонке
    const model3 = [["салам", "hello", "salam"], ["рахмат", "thank you", "rahmat"]];
    assert.deepStrictEqual([...sb.searchPhrases("salam", model3)], [0], "латинский запрос ищет по транслиту");
    assert.deepStrictEqual([...sb.searchPhrases("rahmat", model3)], [1], "транслит-префикс работает");
    // близнецы iOS-автозамены: латинская «a» внутри кириллического запроса чинится
    assert.deepStrictEqual([...sb.searchPhrases("сaлaм", model)], [0, 1], "латинские близнецы в кириллице чинятся");
    // NFC: разложенная ё (е + U+0308) нормализуется
    assert.strictEqual(sb.pvNorm("Ё\u0301".normalize("NFD").slice(0,1) === "Ё" ? "ёлка" : "е\u0308лка"), "елка", "NFC-нормализация разложенных букв");

    // похожие фразы промаха: по словам запроса, длинные первыми, по кругу, без повторов
    vm.runInContext(lm[1] + "; this.pvNearby=pvNearby; this.pvMtUrl=pvMtUrl;", sb);
    assert.deepStrictEqual([...sb.pvNearby("мен рахмат", model, 6)], [2, 5, 3], "длинное слово первым, выдача по кругу");
    assert.deepStrictEqual([...sb.pvNearby("рахмат спасибо", model, 6)], [2, 3], "одна фраза по двум словам — один раз");
    assert.deepStrictEqual([...sb.pvNearby("мен рахмат", model, 2)], [2, 5], "лимит уважается");
    assert.deepStrictEqual([...sb.pvNearby("до уй", model, 6)], [], "слова короче трёх букв не ищутся");
    // кэш по слову: повторный набор не ищет заново, а выдача та же
    const cache = {};
    const first = [...sb.pvNearby("мен рахмат", model, 6, null, cache)];
    const keys = Object.keys(cache).sort();
    assert.deepStrictEqual(keys, ["6|мен", "6|рахмат"], "кэш заведён по слову и лимиту");
    cache["6|мен"] = [4];
    assert.deepStrictEqual([...sb.pvNearby("мен рахмат", model, 6, null, cache)], [2, 4, 3], "второй вызов берёт слово из кэша");
    assert.deepStrictEqual(first, [2, 5, 3], "с кэшем выдача прежняя");
    // направление внешнего перевода — по буквам запроса
    const T = "https://mt/?f={from}&t={to}&q={q}";
    assert.strictEqual(sb.pvMtUrl(T, " как дела ", "ru"), "https://mt/?f=ru&t=ky&q=" + encodeURIComponent("как дела"), "ru: русский текст → на кыргызский");
    assert.strictEqual(sb.pvMtUrl(T, "Чоң рахмат", "ru"), "https://mt/?f=ky&t=ru&q=" + encodeURIComponent("Чоң рахмат"), "ru: ө/ү/ң — с кыргызского");
    assert.strictEqual(sb.pvMtUrl(T, "how are you", "en"), "https://mt/?f=en&t=ky&q=how%20are%20you", "en: латиница → на кыргызский");
    assert.strictEqual(sb.pvMtUrl(T, "рахмат", "tr"), "https://mt/?f=ky&t=tr&q=" + encodeURIComponent("рахмат"), "tr: кириллица — с кыргызского");
    assert.strictEqual(sb.pvMtUrl(T, "a&b=c", "en"), "https://mt/?f=en&t=ky&q=a%26b%3Dc", "текст экранирован для адреса");

    // знаки препинания не мешают: точка/запятая/«?» в запросе и во фразе — разделители слов
    const model4 = [["Билбейм.", "Не знаю."], ["Арыз деген эмне? Мен бул сөздү билбейм.", "Что такое «арыз»? Я не знаю этого слова."], ["Салам! Кандайсың?", "Привет! Как дела?"]];
    assert.deepStrictEqual([...sb.searchPhrases("билбейм?", model4)], [0, 1], "«билбейм?» находит «Билбейм.» (префикс) и вхождение");
    assert.deepStrictEqual([...sb.searchPhrases("привет, как дела", model4)], [2], "запятая в запросе против «!» во фразе");
    assert.strictEqual(sb.pvNorm(" Мен, билбейм... "), "мен билбейм", "pvNorm: знаки → пробел, края срезаны");
    assert.deepStrictEqual([...sb.searchPhrases("?!", model4)], [], "запрос из одних знаков — пусто");
    // все слова запроса в любом порядке — после точных совпадений, до фуззи
    assert.deepStrictEqual([...sb.searchPhrases("мен билбейм.", model4)], [1], "«мен билбейм.» находит фразу со словами «мен» и «билбейм»");
    assert.deepStrictEqual([...sb.searchPhrases("знаю я", model4)], [1], "порядок слов не важен, слова ищутся по любой колонке");
    assert.deepStrictEqual([...sb.searchPhrases("мен салам", model4)], [], "нужны ВСЕ слова — одного мало");
    const model5 = [["мен үйдөмүн", "я дома"], ["үйдөмүн мен", "дома я"], ["мен үйдөмүнбү", "я дома?"]];
    assert.deepStrictEqual([...sb.searchPhrases("үйдөмүн мен", model5)], [1, 0, 2], "сплошное вхождение раньше «всех слов вразброс», слово ищется и внутри длинного");

    // лимит выдачи
    const many = Array.from({ length: 50 }, (_, i) => ["сөз" + i, "слово" + i]);
    assert.strictEqual(sb.searchPhrases("сөз", many).length, 30, "лимит 30 по умолчанию");
    assert.strictEqual(sb.searchPhrases("сөз", many, 5).length, 5, "явный лимит уважается");

    // хранилище промахов модулем: переживает рестарт, хранит без срока, потолок ключей, отсев контактов
    const SF = path.join(DATA, "store-unit.json");
    const aw = (f, d) => fs.writeFileSync(f, d);
    let t0 = Date.parse("2026-10-08T10:00:00Z");
    const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
    const st = createMissStore({ file: SF, atomicWrite: aw, dayKey, now: () => t0 });
    st.note("ru", "как доехать"); st.note("ru", "как доехать"); st.note("en", "bus");
    const st2 = createMissStore({ file: SF, atomicWrite: aw, dayKey, now: () => t0 });
    assert.deepStrictEqual(st2.top().map((x) => [x.lang, x.q, x.n]), [["ru", "как доехать", 2], ["en", "bus", 1]], "агрегат переживает рестарт, частые первыми");
    t0 += 10 * 365 * 86400000;
    assert.deepStrictEqual(createMissStore({ file: SF, atomicWrite: aw, dayKey, now: () => t0 }).top().map((x) => x.q), ["как доехать", "bus"], "срока хранения нет: через 10 лет запросы на месте");
    const full = createMissStore({ file: path.join(DATA, "nope", "x.json"), atomicWrite: () => {}, dayKey, maxKeys: 100 });
    for (let i = 0; i < 100; i++) full.note("ru", "q" + i);
    assert.strictEqual(full.note("ru", "новый"), false, "потолок ключей: новый запрос не заводится");
    assert.strictEqual(full.note("ru", "q0"), true, "потолок ключей: старые счётчики растут");
    // нормализация ключа — pvNorm отданной страницы (сервер исполняет тот же текст)
    assert.deepStrictEqual(validateMiss({ q: "  Рахмат  ЁЛКА ", lang: "ru" }, sb.pvNorm), { q: "рахмат елка", lang: "ru" }, "нормализация как у поиска");
    assert.deepStrictEqual(validateMiss({ q: "Мен билбейм?!", lang: "ru" }, sb.pvNorm), { q: "мен билбейм", lang: "ru" }, "знаки препинания не плодят отдельные ключи");
    assert.deepStrictEqual(validateMiss({ q: "?!", lang: "ru" }, sb.pvNorm), { error: "too short" }, "одни знаки — не запрос");
    for (const x of ["0555 123 456", "+996 (505) 85-48-56", "http://x.kg", "www.site.kg", "a@b", "me@mail.kg"]) assert.deepStrictEqual(validateMiss({ q: x, lang: "ru" }, sb.pvNorm), { skip: true }, "контакт не храним: " + x);
    // политика говорит то же, что делает код: без срока, на каждом языке, без прежних 180 дней
    const priv = fs.readFileSync(path.join(__dirname, "..", "app", "privacy.html"), "utf8");
    assert.ok(!("KEEP_DAYS" in LIMITS), "в коде нет срока хранения промахов");
    for (const phrase of ["переводчика\nхранятся без срока", "no result are kept without a time limit", "aramalar\nsüre sınırı olmadan saklanır"])
      assert.ok(priv.includes(phrase), "политика: промахи хранятся без срока — " + phrase);
    assert.ok(!/дней с последнего повтора|after they were last repeated|son tekrarlarından/.test(priv), "политика не обещает удаления по сроку");

    console.log("perevodchik.test.js: OK (3 варианта ×", expected.length,
      "фраз пары своего языка, бюджет ≤300КБ, vm-поиск: нормализация/фолдинг ө-ү-ң/фуззи/лимит, магниты;",
      "промах: блок, похожие фразы, внешний перевод, одна отправка, агрегат/лимит/доступ учителю)");
  } finally {
    if (srv) await srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
