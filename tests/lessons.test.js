"use strict";
/* Раздел «Уроки»: проверяется не наличие кода, а поведение урока на модельных данных.
   Уроков теперь несколько (реестр LESSON_SCRIPTS в deploy/gen-lessons.js), поэтому всё,
   что параметризовано уроком, проверяется ПЕРЕБОРОМ уроков (канон), а не «типовым» m0:
   плеер, сверка со скриптом озвучки, слайды, покрытие тем. Плюс вариантная гигиена:
   урок модуля — материал курса и не едет в чужие варианты. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { buildAppHtml } = require("../server/appshell");
const { LESSON_SCRIPTS } = require("../deploy/gen-lessons");
const html = buildAppHtml();
const LANGS = ["ru", "en", "tr"];
const SCRIPTS = {};
for (const [mod, f] of Object.entries(LESSON_SCRIPTS))
  SCRIPTS[mod] = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deploy", f), "utf8"));

/* Финальные реестры — как их видит клиент: vm-исполнение DATA-региона собранной
   страницы (уроки M1+ дописывают LESSONS и LESSON_SLIDES из своих частей,
   JSON-парс одного литерала их бы не увидел). */
function registriesOf(pageHtml) {
  const md = pageHtml.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
  assert.ok(md, "маркеры ===DATA=== найдены");
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(md[1] + "; this.LESSONS=LESSONS; this.FIGS=LESSON_FIGS; this.SLIDES=LESSON_SLIDES;", sb);
  // vm-объекты живут в чужом realm — deepStrictEqual сравнил бы прототипы; выравниваем
  return JSON.parse(JSON.stringify({ LESSONS: sb.LESSONS, FIGS: sb.FIGS, SLIDES: sb.SLIDES }));
}
const { LESSONS, FIGS, SLIDES } = registriesOf(html);

/* ── данные: реестр 1:1 со скриптами озвучки, перебором уроков ─────────────── */
assert.deepStrictEqual(Object.keys(LESSONS).sort(), Object.keys(SCRIPTS).sort(),
  "каждому скрипту — запись LESSONS, лишних уроков нет");
for (const [mod, S] of Object.entries(SCRIPTS)) {
  const L = LESSONS[mod];
  assert.strictEqual(S.lesson && S.lesson.mod, mod, mod + ": lesson.mod скрипта совпадает с ключом реестра");
  assert.strictEqual(L.id, S.lesson.id, mod + ": id урока из скрипта");
  assert.strictEqual(L.voiceRole, S.voiceRole, mod + ": роль голоса урока из скрипта");
  for (const l of LANGS) {
    assert.ok(L.title[l], mod + ": заголовок урока на " + l);
    assert.ok(L.intro[l], mod + ": вступление урока на " + l);
  }
  const expect = [];
  for (const t of S.tracks) t.segments.forEach((seg, i) => {
    const n = String(i + 1).padStart(2, "0");
    const s = { theme: t.id, kind: seg.kind, a: "ph_" + t.id + "_" + n };
    if (seg.kind === "explain") { s.perLang = true; s.text = seg.text; }
    else { s.ky = seg.ky; s.gloss = seg.gloss; }
    if (seg.repeat) s.repeat = true;
    if (seg.gap) s.gap = true;
    expect.push(s);
  });
  assert.deepStrictEqual(L.segments, expect,
    mod + ": реестр урока разошёлся со скриптом озвучки — перегенерируй: node deploy/gen-lessons.js");
  assert.deepStrictEqual(L.themes.map((x) => x.id), S.tracks.map((t) => t.id), mod + ": порядок тем");
  for (const th of L.themes) for (const l of LANGS)
    assert.ok(th.title[l], mod + ": заголовок темы " + th.id + " на " + l);
  // объяснения звучат на языке ученика, примеры — общей кыргызской дорожкой
  assert.ok(L.segments.some((s) => s.perLang) && L.segments.some((s) => s.kind === "example"),
    mod + ": в уроке есть и объяснения по языкам, и кыргызские примеры");
}
// id тем глобально уникальны: аудио всех уроков живёт в одном бакете m0 (ph_<тема>_NN)
{
  const seen = new Set();
  for (const L of Object.values(LESSONS)) for (const th of L.themes) {
    assert.ok(!seen.has(th.id), "id темы уникален между уроками: " + th.id);
    seen.add(th.id);
  }
}

/* ── вкладка появляется только там, где урок есть ──────────────────────────── */
assert.ok(/LESSONS\[id\]\)\?\[\["lessons"/.test(html), "вкладка выводится из реестра, а не зашита");
assert.ok(html.includes('activeTab==="lessons"'), "роутер знает вкладку уроков");
for (const key of ["tab_lessons", "lesson_play", "lesson_text_hidden", "lesson_themes", "lesson_next", "lesson_repeat_now"])
  assert.strictEqual((html.match(new RegExp(key + ":", "g")) || []).length, 3, key + " переведён на три языка");

/* ── вариантная гигиена: урок модуля не едет чужим (перебор вариантов) ──────
   Транскрипт урока — материал курса: у ученика без m1 в сборке нет ни LESSONS.m1,
   ни его слайдов; у ученика с m1 — есть. Вопрос о СОСТАВЕ артефакта — отвечаем
   составом (маркеры частей), поведение с реестром проверяет плеер выше на полной
   сборке. Демо стережёт server.test (срез литерала). */
{
  const slideKey = '"' + LESSONS.m1.themes[0].id + '"'; // тема m1 из данных, не из соглашения об именах
  for (const [own, wantM1] of [[["m1"], true], [["m2"], false], [["m24"], false]]) {
    const v = buildAppHtml(own);
    assert.strictEqual(v.includes("LESSONS.m1 ="), wantM1,
      "вариант " + own.join("+") + ": LESSONS.m1 " + (wantM1 ? "обязан быть" : "не должен ехать"));
    assert.strictEqual(v.includes(slideKey), wantM1,
      "вариант " + own.join("+") + ": слайды m1 " + (wantM1 ? "есть" : "не едут"));
  }
}

/* ── поведение плеера в vm — перебором уроков ──────────────────────────────── */
const mUI = html.match(/===LESSONS-UI===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/LESSONS-UI===/);
assert.ok(mUI, "маркер ===LESSONS-UI===");
const EVENTS = [];
function runPlayer(mod) {
  const segs = LESSONS[mod].segments;
  const played = [];
  const sb = {
    console, activeModule: mod, LESSONS,
    evPush: (type, data) => EVENTS.push({ type, data }),
    localStorage: { store: {}, getItem(k){ return this.store[k] || null; }, setItem(k, v){ this.store[k] = v; } },
    renderLessonBody(){}, // рендер не нужен: проверяем состояние, не DOM
    currentLang: () => "ru",              // язык интерфейса: дорожка объяснения зависит от него
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {},
    playAudio(id, rate){ played.push({ id, rate }); const a = { playbackRate: rate, pause(){}, onended: null };
      sb.__last = a; return a; },
  };
  vm.createContext(sb);
  vm.runInContext(mUI[1] + "; this.Lesson = Lesson;", sb);
  const L = sb.Lesson;
  L.load();
  assert.strictEqual(L.seg, 0, mod + ": новый ученик начинает с первого сегмента");
  assert.strictEqual(L.text, true, mod + ": текст по умолчанию показан");

  L.play();
  assert.strictEqual(played.length, 1, mod + ": старт проигрывает текущий сегмент");
  assert.ok(played[0].id.startsWith(segs[0].a), mod + ": играет именно первый сегмент (дорожка своего языка)");
  sb.__last.onended();                       // автопереход
  assert.strictEqual(L.seg, 1, mod + ": после сегмента урок сам идёт дальше");
  assert.strictEqual(played.length, 2, mod + ": следующий сегмент запущен без нажатия");

  // доигрываем первую тему до конца — она обязана отметиться пройденной
  const firstTheme = segs[0].theme;
  let guard = 0;
  while (segs[L.seg] && segs[L.seg].theme === firstTheme && guard++ < 50) sb.__last.onended();
  assert.ok(L.done[firstTheme], mod + ": пройденная тема отмечена");

  // текст и скорость: переключаются и переживают уход из раздела
  L.toggleText(); assert.strictEqual(L.text, false, mod + ": текст скрывается");
  L.setRate(0.75); assert.strictEqual(L.rate, 0.75, mod + ": скорость 0.75 применяется");
  assert.strictEqual(sb.__last.playbackRate, 0.75, mod + ": скорость применена к текущему аудио");
  const at = L.seg;
  const L2 = vm.runInContext("(function(){ var c = Object.create(Lesson); return c; })()", sb);
  L2.load();
  assert.strictEqual(L2.seg, at, mod + ": возврат в раздел продолжает с места");
  assert.strictEqual(L2.text, false, mod + ": выбор «без текста» сохранён");
  assert.strictEqual(L2.rate, 0.75, mod + ": скорость сохранена");

  // Практика: после сегмента с repeat плеер держит паузу на повтор вслух
  {
    const rep = segs.findIndex((s) => s.repeat);
    assert.ok(rep > 0, mod + ": в уроке есть сегменты практики с паузой на повтор");
    const timers = [];
    sb.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    sb.clearTimeout = () => {};
    L.goto(rep, false); L.play();
    sb.__last.duration = 2;              // двухсекундное слово
    sb.__last.onended();
    assert.strictEqual(L.waitingRepeat, true, mod + ": во время паузы плеер ждёт, а не играет дальше");
    assert.strictEqual(L.seg, rep, mod + ": в паузе сегмент не сменился");
    assert.ok(timers.length === 1 && timers[0].ms >= 1200 && timers[0].ms <= 4000,
      mod + ": пауза в разумных границах 1,2–4 с, получено " + (timers[0] || {}).ms);
    timers[0].fn();                       // пауза истекла
    assert.strictEqual(L.waitingRepeat, false, mod + ": после паузы ожидание снято");
    assert.strictEqual(L.seg, rep + 1, mod + ": после паузы урок идёт дальше");
    L.stop();
    sb.setTimeout = (fn) => { fn(); return 1; };
  }
  /* Ручной режим (просьба владельца 21.08.2026): кыргызская фраза пробегает быстрее,
     чем ученик успевает нажать паузу. Выключенное автопродолжение обязано ждать
     человека после КАЖДОГО сегмента — включая практику с repeat, где иначе таймер
     утащил бы урок дальше. */
  {
    const from = played.length;
    L.goto(0, false);
    assert.strictEqual(L.auto, true, mod + ": по умолчанию автопродолжение включено");
    L.toggleAuto();
    assert.strictEqual(L.auto, false, mod + ": тумблер выключает автопродолжение");
    L.play(); sb.__last.onended();
    assert.strictEqual(L.seg, 0, mod + ": без автопродолжения сегмент не сменился сам");
    assert.strictEqual(L.playing, false, mod + ": и плеер ждёт человека");
    const afterPlay = played.length;
    L.again();
    assert.strictEqual(played.length, afterPlay + 1, mod + ": «Повторить» играет тот же сегмент заново");
    assert.strictEqual(L.seg, 0, mod + ": повтор не двигает место в уроке");
    // на сегменте практики таймерная пауза в ручном режиме не заводится
    const rep2 = segs.findIndex((s) => s.repeat);
    const timers2 = [];
    sb.setTimeout = (fn, ms) => { timers2.push({ fn, ms }); return timers2.length; };
    L.goto(rep2, false); L.play(); sb.__last.duration = 2; sb.__last.onended();
    assert.strictEqual(timers2.length, 0, mod + ": в ручном режиме паузу держит человек, а не таймер");
    assert.strictEqual(L.waitingRepeat, false, mod + ": и ожидание таймера не включается");
    assert.strictEqual(L.seg, rep2, mod + ": сегмент практики остаётся на месте");
    sb.setTimeout = (fn) => { fn(); return 1; };
    // выбор режима переживает уход из раздела, как текст и скорость
    const L3 = vm.runInContext("(function(){ var c = Object.create(Lesson); return c; })()", sb);
    L3.load();
    assert.strictEqual(L3.auto, false, mod + ": ручной режим сохранён между заходами");
    // включение на паузе продолжает урок сам — иначе тумблер выглядит сломанным
    const before = played.length;
    L.toggleAuto();
    assert.strictEqual(L.auto, true, mod + ": тумблер возвращает автопродолжение");
    assert.strictEqual(played.length, before + 1, mod + ": включение на паузе сразу продолжает урок");
    assert.ok(played.length > from, mod + ": проверка ручного режима действительно играла дорожки");
    L.stop(); L.goto(0, false);
  }

  // края очереди: за последний сегмент не уезжаем
  L.goto(segs.length - 1, false);
  L.play(); sb.__last.onended();
  assert.strictEqual(L.playing, false, mod + ": после последнего сегмента плеер останавливается");
  assert.strictEqual(L.seg, segs.length - 1, mod + ": индекс не уходит за конец");
  L.goto(-1, false);
  assert.strictEqual(L.seg, segs.length - 1, mod + ": шаг назад с первого не ломает состояние");
}
for (const mod of Object.keys(LESSONS)) runPlayer(mod);

/* ── главная кнопка плеера не прыгает: ширину держит невидимая мерка ─────────
   «Слушать урок» → «Пауза» дёргали весь ряд кнопок (жалоба владельца 21.08.2026).
   Мерка обязана быть самой длинной надписью по ОБОИМ состояниям и ВСЕМ языкам —
   иначе при смене языка интерфейса ширина снова поедет. */
{
  const fn = html.match(/function lessonMainWidest\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, "функция мерки в странице");
  const di = html.indexOf("const I18N={"), dj = html.indexOf("\n};", di);
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(html.slice(di, dj + 3).replace("const I18N=", "var I18N=") + "\n" + fn[0] + "\nvar WIDEST=lessonMainWidest();", sb);
  const all = Object.values(sb.I18N).flatMap((d) => [d.lesson_play, d.lesson_pause]).filter(Boolean);
  assert.strictEqual(all.length, 6, "в словарях обе надписи на трёх языках");
  const longest = all.slice().sort((a, b) => b.length - a.length)[0];
  assert.strictEqual(sb.WIDEST, longest, "мерка — самая длинная надпись из всех языков и состояний");
  for (const s2 of all) assert.ok(sb.WIDEST.length >= s2.length, "мерка не короче варианта «" + s2 + "»");
  // без словаря (vm-срезы) функция не падает, а возвращает хоть что-то
  const bare = { console, t: (k) => k };
  vm.createContext(bare);
  vm.runInContext(fn[0] + "\nvar W=lessonMainWidest();", bare);
  assert.strictEqual(bare.W, "lesson_play", "без словаря — текущая надпись, а не падение");
  // разметка кнопки и стили, которые прячут мерку: без них она была бы видна
  assert.ok(/class: "btn primary lesson-main"/.test(html), "кнопка помечена классом lesson-main");
  assert.ok(html.includes(".lesson-main-size{visibility:hidden"), "мерка невидима");
  assert.ok(html.includes(".lesson-main-label{position:absolute"), "видимая надпись поверх мерки");
  assert.ok(html.includes(".lesson-main{position:relative}"), "кнопка — контекст позиционирования");
}

/* ── иллюстрации тем: набор, корректность путей и реальная отрисовка ────────── */
const allThemes = Object.values(LESSONS).flatMap((L) => L.themes.map((x) => x.id));
// Рисованный SVG-набор — запасной: у урока он либо покрывает ВСЕ темы, либо
// отсутствует целиком (частичный набор = у части тем пропадает картинка молча).
for (const k of Object.keys(FIGS)) assert.ok(allThemes.includes(k), "SVG-рисунок без темы: " + k);
for (const L of Object.values(LESSONS)) {
  const covered = L.themes.filter((th) => FIGS[th.id]).length;
  assert.ok(covered === 0 || covered === L.themes.length,
    "SVG-набор покрывает урок частично: " + covered + "/" + L.themes.length);
}
const PALETTE = ["w", "y", "p", "c", "m"];
for (const [id, f] of Object.entries(FIGS)) {
  assert.ok(/^0 0 \d+ \d+$/.test(f.vb), id + ": viewBox вида «0 0 W H»");
  const [, , W, H] = f.vb.split(" ").map(Number);
  // картинка живёт в блоке с aspect-ratio 16/9 — иная пропорция даст поля или обрез
  assert.ok(Math.abs(W / H - 16 / 9) < 0.02, id + ": пропорция должна быть 16:9, а не " + (W / H).toFixed(2));
  assert.ok(Array.isArray(f.s) && f.s.length >= 5, id + ": рисунок из ≥5 штрихов");
  for (const st of f.s) {
    // только команды пути: буквы в SVG рисунке запрещены (текст даёт интерфейс на своём языке)
    assert.ok(/^[MLCZ][\d\s.,MLCZ-]*$/.test(st.d), id + ": путь содержит не команды пути: " + st.d.slice(0, 40));
    assert.ok(PALETTE.includes(st.c), id + ": цвет мела вне палитры: " + st.c);
    assert.ok(st.w >= 2 && st.w <= 8, id + ": толщина штриха вне 2–8: " + st.w);
    // координаты не должны выпадать за доску
    for (const n of st.d.match(/-?\d+(\.\d+)?/g).map(Number))
      assert.ok(n >= -2 && n <= Math.max(W, H) + 2, id + ": координата за пределами доски: " + n);
  }
}
// отрисовка исполняется, а не пиннится грепом: два прохода на штрих (распыл мела + сам штрих)
{
  const src = html.match(/function lessonFig\(theme, label\)\{[\s\S]*?\n\}/)
    || html.match(/function lessonFig\(theme, label\) \{[\s\S]*?\n\}/);
  assert.ok(src, "функция lessonFig найдена в сборке");
  const nodes = [];
  const box = { className: "", append(){}, classList: { add(){} } };
  const sbf = {
    console, LESSON_FIGS: FIGS, SVG_NS: "http://www.w3.org/2000/svg",
    CHALK: { w: "#f4f1e8", y: "#ffe08a", p: "#ff9fb0", c: "#8fd6e8", m: "#a8e6b0" },
    h: () => box,
    document: { createElementNS(ns, tag){
      const n = { tag, attrs: {}, setAttribute(k, v){ this.attrs[k] = v; }, append(){} };
      nodes.push(n);
      return n;
    } },
  };
  vm.createContext(sbf);
  vm.runInContext(src[0] + "; this.OUT = lessonFig('p1','Тема');", sbf);
  const paths = nodes.filter((n) => n.tag === "path");
  assert.strictEqual(paths.length, FIGS.p1.s.length * 2,
    "каждый штрих рисуется двумя проходами, получено " + paths.length);
  assert.ok(paths.every((p) => /^#[0-9a-f]{6}$/i.test(p.attrs.stroke)), "у всех штрихов цвет мела");
  assert.ok(paths.some((p) => Number(p.attrs.opacity) < 0.5) && paths.some((p) => Number(p.attrs.opacity) === 1),
    "есть и полупрозрачный распыл, и крепкий штрих");
  assert.strictEqual(sbf.OUT, box, "иллюстрация возвращается контейнером");
  // темы без рисунка не должны валить рендер (новый урок появится раньше картинок)
  vm.runInContext("this.NONE = lessonFig('нет-такой','x');", sbf);
  assert.strictEqual(sbf.NONE, null, "для темы без рисунка возвращается null, а не исключение");
}

/* ── слайды тем: рисунок OpenAI без текста + буквы/слова настоящим текстом ────
   Модель врёт в буквах (ң → сербская Ћ, «көл» → «кол» — проверено 17.08.2026),
   поэтому текст живёт в данных, а не в растре. Гейты: КАЖДАЯ тема КАЖДОГО урока
   покрыта слайдом, слайд ссылается на существующий файл, кыргызские слова слайда —
   слова скрипта СВОЕГО урока (или явно обоснованы), глоссы — дословно из него. */
{
  assert.deepStrictEqual(Object.keys(SLIDES).sort(), [...allThemes].sort(),
    "у каждой темы каждого урока свой слайд, лишних нет");
  // тема → скрипт её урока: словарь допустимых слов и глоссов берётся из своего урока
  const { norm, exampleWords } = require("./helpers/lesson-script");
  const scriptOfTheme = {}, wordsOfScript = new Map();
  for (const S of Object.values(SCRIPTS)) {
    wordsOfScript.set(S, exampleWords(S));
    for (const t of S.tracks) scriptOfTheme[t.id] = S;
  }
  const ORTHOEPIC = { "аш полсун": "оглушение на стыке: пишется «аш болсун» (kyrgyz-phonetics.md, раздел «Ассимиляция»)" };
  const KY_LETTERS = /^[а-яёөүң ]+$/;
  for (const [id, sl] of Object.entries(SLIDES)) {
    const S = scriptOfTheme[id];
    const allowed = wordsOfScript.get(S);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "app", "lessons", sl.img + ".webp")),
      id + ": файл слайда app/lessons/" + sl.img + ".webp существует");
    for (const t of (sl.top || [])) {
      assert.ok(KY_LETTERS.test(t) && t.length <= 8, id + ": верхняя панель — только кыргызские буквы/ряды: " + t);
    }
    assert.ok(Array.isArray(sl.items) && sl.items.length >= 1, id + ": на слайде есть подписи");
    for (const it of sl.items) {
      if (it.ky) {
        const u = norm(it.ky);
        const ok = u.split(" ").every((w) => allowed.has(w)) || allowed.has(u) || ORTHOEPIC[u];
        assert.ok(ok, id + ": слово слайда вне скрипта озвучки (сочинено?): " + it.ky);
      }
      const cap = it.gloss || it.cap;
      assert.ok(cap, id + ": у подписи нет текста ни на одном языке");
      for (const l of LANGS) assert.ok(cap[l] && cap[l].trim(), id + ": подпись слайда без языка " + l);
      // глоссы валидированных слов — дословно из скрипта своего урока: сверяем хотя бы русский
      if (it.gloss) {
        const inScript = S.tracks.some((t) => t.segments.some((sg) => sg.kind === "example"
          && sg.gloss && sg.gloss.ru.includes(it.gloss.ru)));
        assert.ok(inScript, id + ": русский глосс «" + it.gloss.ru + "» не найден в скрипте озвучки урока");
      }
    }
  }
  // рендер слайда исполняется: правильный файл, буквы панели, глосс по языку интерфейса
  const src = html.match(/function lessonSlide\(theme, label\)\{[\s\S]*?\n\}/);
  assert.ok(src, "функция lessonSlide найдена в сборке");
  const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], append(...k){ this.kids.push(...k); },
    classList: { add(){} } });
  // контекст на язык, исходник компилируется один раз (тем × языков стало 42 вызова)
  const slideCtx = new Map();
  const runSlide = (lang, theme) => {
    let sbs = slideCtx.get(lang);
    if (!sbs) {
      sbs = { console, LESSON_SLIDES: SLIDES, currentLang: () => lang,
        h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids); return n; } };
      vm.createContext(sbs);
      vm.runInContext(src[0], sbs);
      slideCtx.set(lang, sbs);
    }
    return vm.runInContext("lessonSlide(" + JSON.stringify(theme) + ",'Тема')", sbs);
  };
  const flat = (n, acc) => { if (!n || !n.kids) return acc; for (const k of n.kids) { if (k && k.tag) { acc.push(k); flat(k, acc); } } return acc; };
  const out = runSlide("ru", "p1"), nodes = flat(out, [out]);
  const img = nodes.find((n) => n.tag === "img");
  assert.ok(img && img.attrs.src === "lessons/p1.webp", "слайд p1 ссылается на lessons/p1.webp");
  const letters = nodes.filter((n) => n.attrs && n.attrs.class && String(n.attrs.class).includes("slide-letter")).map((n) => n.kids[0]);
  assert.deepStrictEqual(letters, ["ө", "ү", "ң"], "панель букв слайда p1 — настоящий текст ө/ү/ң");
  // «Слайд для каждого языка» — перебором (канон: параметризованное набором тестируется
  // перебором, а не типовым элементом): каждая тема × каждый язык рендерится, подписи
  // приходят на языке интерфейса, рисунок остаётся общим (он без текста и внеязыков).
  for (const theme of Object.keys(SLIDES)) {
    const perLang = {};
    for (const lang of LANGS) {
      const nodes2 = flat(runSlide(lang, theme), []);
      const img2 = nodes2.find((n) => n.tag === "img");
      assert.ok(img2 && img2.attrs.src === "lessons/" + SLIDES[theme].img + ".webp",
        theme + "/" + lang + ": слайд ссылается на свой файл");
      const caps = nodes2.filter((n) => n.tag === "small").map((n) => n.kids[0]);
      assert.strictEqual(caps.length, SLIDES[theme].items.length,
        theme + "/" + lang + ": подпись есть у каждого элемента");
      const want = SLIDES[theme].items.map((it) => (it.gloss || it.cap)[lang]);
      assert.deepStrictEqual(caps, want, theme + "/" + lang + ": подписи — на языке интерфейса");
      perLang[lang] = caps.join("|");
    }
    assert.ok(perLang.ru !== perLang.en && perLang.ru !== perLang.tr,
      theme + ": языковые версии слайда действительно различаются текстом");
  }
  assert.strictEqual(runSlide("ru", "нет-такой"), null, "тема без слайда не роняет рендер (падает на SVG)");
}

/* ── трекинг прохождения: дослушанная тема и весь урок уходят событиями в журнал ── */
{
  for (const mod of Object.keys(LESSONS)) {
    const th = EVENTS.find((e) => e.type === "lesson.theme" && e.data.lesson === LESSONS[mod].id);
    assert.ok(th, mod + ": дослушанная тема отправляет lesson.theme (лента учителя и «Мой прогресс»)");
    assert.ok(th.data.lesson && th.data.theme && th.data.total > 0, mod + ": событие несёт урок, тему и объём");
  }
}

/* ── mp4-экспорт: план ролика deploy/make-video.js совпадает с уроком m0 ───────
   Видео других уроков делается только ПОСЛЕ оценки аудиоурока владельцем
   (правило 20.08.2026), поэтому план сверяется для m0. */
{
  const { planFor } = require("../deploy/make-video.js");
  for (const lang of LANGS) {
    const plan = planFor(lang, SCRIPTS.m0, SLIDES);
    assert.strictEqual(plan.length, SCRIPTS.m0.tracks.length, lang + ": в ролике все темы скрипта");
    const ids = plan.flatMap((t) => t.audio);
    assert.deepStrictEqual(ids, LESSONS.m0.segments.map((sg) => sg.perLang ? sg.a + "_" + lang : sg.a),
      lang + ": id дорожек ролика — ровно дорожки урока, в том же порядке");
    for (const t of plan) {
      assert.ok(t.title && typeof t.title === "string", lang + "/" + t.id + ": заголовок темы");
      assert.ok(fs.existsSync(path.join(__dirname, "..", "app", "lessons", t.img + ".webp")),
        t.id + ": рисунок слайда существует");
      for (const line of t.items) assert.ok(line && !/undefined/.test(line), t.id + ": строка панели без undefined: " + line);
    }
  }
}

console.log("lessons.test.js: OK (" + Object.entries(LESSONS).map(([m, L]) =>
  m + ": " + L.themes.length + " тем/" + L.segments.length + " сегментов").join(", ") +
  " — сверены со скриптами; плеер перебором уроков; слайды всех тем; вариантная гигиена)");
