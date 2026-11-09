"use strict";
/* Тест батч-генератора озвучки deploy/gen-audio.js: перечисление целей
   (vocab + реплики диалогов + куплеты песен) и отбор к генерации (safe-force).
   Функции импортируются и гоняются на модельных данных — без сети и без прода;
   require без KGA1_AUTH не должен ни падать, ни лезть в сеть (main под гардом). */
const assert = require("assert");
const vm = require("vm");

delete process.env.KGA1_AUTH; // require обязан пережить отсутствие кредов
const gen = require("../deploy/gen-audio");
assert.strictEqual(typeof gen.targetsFor, "function", "targetsFor экспортирован");
assert.strictEqual(typeof gen.splitTodo, "function", "splitTodo экспортирован");
assert.strictEqual(typeof gen.loadData, "function", "loadData экспортирован");

const ID_RE = /^[a-z0-9_]{1,40}$/; // серверный гейт id (server.js)

/* ── 1. Цели на модельных данных: перебор наборов ─────────────────────────────
   Наборы: модуль с диалогами и песнями; модуль без диалогов; песня без куплетов;
   реюз-карточки; модуль вне CONTENT. */
const model = {
  CONTENT_READY: ["m0", "m5", "m10"],
  CONTENT: {
    m0: { vocab: [{ id: "m0_01", ky: "саламатсызбы" }] },
    m5: { vocab: [{ id: "m5_01", ky: "нан" }, { id: "m5_02", ky: "чай", ref: "m2_09" }] },
    m10: { vocab: [{ id: "m10_01", ky: "кайталоо", ref: "m1_01" }] } // повторительный: всё реюз
  },
  DIALOGS: {
    m5: {
      parts: [{ amb: "ph_amb_bus", lines: [{ id: "ph_m5d1_01", ky: "Салам!" }, { id: "ph_m5d1_02", ky: "Кандайсың?" }] }],
      songs: [
        { fullId: "ph_m5s_full", verses: [{ id: "ph_m5s_01", ky: "Ала-Тоо" }] },
        { fullId: "ph_m5s2_full" } // песня без куплетов — генератор обязан пережить
      ]
    }
    // m10 в DIALOGS отсутствует — как реальные повторительные модули
  }
};

// m0 собирает свой vocab + фонетику алфавитной карточки + реплики и куплеты
// ВСЕХ модулей (бакет ph_* живёт в m0)
const PHON_IDS = gen.PHONETICS.map((p) => p.id);
const m0 = gen.targetsFor("m0", model);
assert.deepStrictEqual(m0.map((t) => t.id),
  ["m0_01", ...PHON_IDS, "ph_m5d1_01", "ph_m5d1_02", "ph_m5s_01"],
  "m0: vocab + фонетика + реплики m5 + куплет; fullId песни и амбиент — не цели");

// реплики чужого диалога НЕ попадают в прогон родного модуля — только в m0
const m5 = gen.targetsFor("m5", model);
assert.deepStrictEqual(m5.map((t) => t.id), ["m5_01"], "m5: только свой vocab без ref, реплики уехали в m0");

// повторительный модуль: одни ref — целей ноль, но не падение
assert.deepStrictEqual(gen.targetsFor("m10", model), [], "m10: все карточки реюз — целей нет");

// модуль вне CONTENT — null (вызывающий печатает «пропуск»)
assert.strictEqual(gen.targetsFor("m99", model), null, "неизвестный модуль — null");

// DIALOGS может отсутствовать целиком (старые срезы данных)
assert.deepStrictEqual(gen.targetsFor("m0", { ...model, DIALOGS: undefined }).map((t) => t.id),
  ["m0_01", ...PHON_IDS], "без DIALOGS m0 остаётся на своём vocab и фонетике");

/* ── 2. splitTodo: идемпотентность и safe-force ──────────────────────────── */
const targets = [
  { id: "a_new", ky: "жаңы" },       // файла нет
  { id: "a_tts", ky: "бар" },        // есть, source:tts
  { id: "a_nometa", ky: "эски" },    // есть, меты нет (легаси-озвучка)
  { id: "a_upload", ky: "кол" },     // есть, запись преподавателя
  { id: "a_sfx", ky: "шар" }         // есть, эффект
];
const have = new Set(["a_tts", "a_nometa", "a_upload", "a_sfx", "ph_amb_x", "ph_x_full"]); // в каталоге есть и не-цели
const meta = { a_tts: { source: "tts" }, a_upload: { source: "upload" }, a_sfx: { source: "sfx" } };

// без FORCE — только отсутствующие
const plain = gen.splitTodo(targets, have, meta, false);
assert.deepStrictEqual(plain.todo.map((t) => t.id), ["a_new"], "без force генерируются только недостающие");
assert.deepStrictEqual(plain.skipped, [], "без force нечего пропускать");

// с FORCE — tts и легаси перегенерируются, upload и sfx неприкосновенны
const forced = gen.splitTodo(targets, have, meta, true);
assert.deepStrictEqual(forced.todo.map((t) => t.id), ["a_new", "a_tts", "a_nometa"],
  "force перегенерирует tts и записи без меты");
assert.deepStrictEqual(forced.skipped, [{ id: "a_upload", source: "upload" }, { id: "a_sfx", source: "sfx" }],
  "force не трогает upload (записи преподавателя, песни) и sfx (амбиенты)");

/* ── 1а. Режим голоса по типу цели: карточки Robust, связная речь Natural ── */
assert.deepStrictEqual(m0.map((t) => t.kind),
  ["vocab", ...PHON_IDS.map(() => "vocab"), "line", "line", "verse"],
  "тип цели проставлен; фонетика — слова, им Robust");
assert.strictEqual(gen.stabilityFor("vocab"), 1, "карточка-слово — Robust: Natural съедает последний согласный");
assert.strictEqual(gen.stabilityFor("line"), 0.5, "реплика диалога — Natural");
assert.strictEqual(gen.stabilityFor("verse"), 0.5, "куплет — Natural");
// v3 понимает только три режима; промежуточных значений быть не должно
for (const kind of ["vocab", "line", "verse"]) assert.ok([0, 0.5, 1].includes(gen.stabilityFor(kind)), kind + ": режим из трёх допустимых");

/* ── 1б. Голос по персонажу: реестр deploy/voices.json ────────────────────
   Реплики диалогов озвучиваются голосом своего персонажа (поле sp), карточки и
   куплеты — голосом по умолчанию. Перебор: женская роль, мужская, персонаж вне
   реестра, цель без sp, роль без голоса, пустой реестр персонажей. */
const REG = JSON.parse(require("fs").readFileSync(__dirname + "/../deploy/voices.json", "utf8"));
assert.ok(REG.voices[REG.default], "у роли по умолчанию есть голос");
const AGES = ["child", "young", "adult", "elder"], GENDERS = ["male", "female", "mixed"];
for (const [sp, c] of Object.entries(REG.characters)) {
  assert.ok(GENDERS.includes(c.gender), `персонаж ${sp}: пол из списка, получено ${c.gender}`);
  assert.ok(AGES.includes(c.age), `персонаж ${sp}: возраст из списка, получено ${c.age}`);
  assert.ok(REG.voices[c.gender + "_" + c.age], `персонаж ${sp}: у роли ${c.gender}_${c.age} есть голос`);
  if (c.voice) assert.ok(REG.voices[c.voice], `персонаж ${sp}: индивидуальный голос ${c.voice} есть в voices`);
}
// voice_id — форма, которую принимает серверный гейт (иначе оверрайд молча игнорируется)
for (const [role, id] of Object.entries(REG.voices)) {
  assert.ok(/^[A-Za-z0-9]{10,40}$/.test(id), `роль ${role}: voice_id проходит серверный гейт, получено ${id}`);
}
// каждый говорящий из живых данных обязан быть в реестре — иначе он молча уедет
// на голос по умолчанию и в диалоге сменится персонаж
const speakers = new Set();
for (const d of Object.values(gen.loadData().DIALOGS)) for (const p of d.parts || []) for (const l of p.lines || []) if (l.sp) speakers.add(l.sp);
const unknown = [...speakers].filter((sp) => !REG.characters[sp]);
assert.deepStrictEqual(unknown, [], "все говорящие диалогов есть в deploy/voices.json");

// возрастная политика: ребёнок и взрослый одного пола НЕ должны звучать одним голосом
assert.notStrictEqual(REG.voices.male_child, REG.voices.male_adult, "школьник и взрослый мужчина — разные голоса");
assert.notStrictEqual(REG.voices.female_child, REG.voices.female_adult, "школьница и взрослая женщина — разные голоса");
assert.notStrictEqual(REG.voices.male_young, REG.voices.male_adult, "студент и взрослый — разные голоса");

// участники одной сцены различимы: у Асана, Айдара и Айбека — разные голоса
const boys = ["Асан", "Айдар", "Айбек"].map((sp) => gen.voiceFor({ kind: "line", sp }, REG));
assert.strictEqual(new Set(boys).size, 3, "три школьника одной сцены звучат тремя разными голосами");

const DEF = REG.voices[REG.default];
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Асан" }, REG), "boy_a", "индивидуальный голос персонажа сильнее роли");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Айпери" }, REG), "female_child", "школьница — женская детская роль");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Нургүл" }, REG), "female_young", "студентка — женская молодая роль");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Ата" }, REG), "male_adult", "отец — взрослая мужская роль");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Эне" }, REG), "female_adult", "мать — взрослая женская роль");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Балдар" }, REG), "mixed_child", "класс хором — своя роль");
assert.strictEqual(gen.roleFor({ kind: "line", sp: "Неизвестный" }, REG), REG.default, "персонаж вне реестра — роль по умолчанию");
assert.strictEqual(gen.roleFor({ kind: "vocab" }, REG), REG.default, "карточка без sp — роль по умолчанию");
assert.strictEqual(gen.voiceFor({ kind: "line", sp: "Асан" }, REG), REG.voices.male_child, "voiceFor отдаёт голос роли");
assert.strictEqual(gen.voiceFor({ kind: "vocab" }, REG), DEF, "карточка — голос по умолчанию");
assert.strictEqual(gen.voiceFor({ kind: "verse" }, REG), DEF, "куплет — голос по умолчанию");
// роль объявлена, а голоса для неё нет — падать нельзя, уходим на дефолтный
const broken = { voices: { male_adult: DEF }, default: "male_adult", characters: { "Х": { gender: "female", age: "elder" } } };
assert.strictEqual(gen.voiceFor({ kind: "line", sp: "Х" }, broken), DEF, "роль без голоса — фолбэк на дефолт");
assert.strictEqual(gen.voiceFor({ kind: "line", sp: "Х" }, { voices: {}, default: "male_adult", characters: {} }), "", "пустой реестр — пустая строка, не исключение");

/* ── 1в. Правки преподавателя сильнее исходников (кейс «тилмеч/котормочу») ── */
const OV = { m1_58: { ky: "котормочу", ru: "переводчик" }, m1_09: { ru: "только перевод" }, m1_10: { ky: "   " } };
assert.strictEqual(gen.effectiveKy({ id: "m1_58", ky: "тилмеч" }, OV), "котормочу", "правка ky побеждает исходник");
assert.strictEqual(gen.effectiveKy({ id: "m1_09", ky: "мугалим" }, OV), "мугалим", "правка только перевода не трогает озвучку");
assert.strictEqual(gen.effectiveKy({ id: "m1_10", ky: "окуучу" }, OV), "окуучу", "пустая правка ky игнорируется");
assert.strictEqual(gen.effectiveKy({ id: "m1_11", ky: "мектеп" }, OV), "мектеп", "без правки — исходник");
assert.strictEqual(gen.effectiveKy({ id: "m1_11", ky: "мектеп" }, undefined), "мектеп", "нет оверрайдов вовсе — исходник");

/* ── 1г. Аудит ловит озвучку старше правки текста ────────────────────────── */
const auditMod = require("../deploy/audit-audio");
assert.strictEqual(auditMod.staleAgainstOverride(
  { at: "2026-08-13T15:00:00Z" }, { ky: "котормочу", at: "2026-08-14T09:00:00Z" }), true,
  "файл старше правки — дефект (кейс тилмеч/котормочу)");
assert.strictEqual(auditMod.staleAgainstOverride(
  { at: "2026-08-14T10:00:00Z" }, { ky: "котормочу", at: "2026-08-14T09:00:00Z" }), false,
  "файл моложе правки — норма (переозвучен исправленным текстом)");
assert.strictEqual(auditMod.staleAgainstOverride(
  { at: "2026-08-13T15:00:00Z" }, { ru: "только перевод", at: "2026-08-14T09:00:00Z" }), false,
  "правка только перевода озвучку не устаревает");
assert.strictEqual(auditMod.staleAgainstOverride(
  { at: "2026-08-13T15:00:00Z" }, undefined), false, "без правки — норма");
assert.strictEqual(auditMod.staleAgainstOverride(
  undefined, { ky: "х", at: "2026-08-14T09:00:00Z" }), false, "без меты сравнивать нечего — не падаем");

/* ── 2а. tooShort: грубый обрыв по темпу; порог калиброван замером ────────
   На 150 файлах m0 живая речь дала медиану 14.5 знаков/сек, p90 18, максимум 23.6 —
   порог 26 обязан пропускать самую быструю живую фразу и ловить только нефизичный темп. */
const sec = (s) => Math.round(s * 192000 / 8);
assert.strictEqual(gen.tooShort("Биздин үйдө үч бөлмө бар: конок бөлмө, уктоочу бөлмө жана ашкана.", sec(1.5), 192000), true,
  "грубый обрыв: 64 знака за 1.5 с (43 зн/с) — так не читают");
assert.strictEqual(gen.tooShort("Кайырлуу таң, кайырлуу күн, салам, салам айтам бүгүн.", sec(2.3), 192000), false,
  "самый быстрый замеренный темп (23 зн/с) — не тревога");
assert.strictEqual(gen.tooShort("Ийгилик каалайм!", sec(0.68), 192000), false,
  "откушенный хвост короткой фразы темпом НЕ ловится (это работа audit-audio.js)");
assert.strictEqual(gen.tooShort("үй", 0, 192000), true, "ноль байт — всегда обрыв");

/* ── 2б. tailRatio: настоящий детект обрыва по затуханию ─────────────────── */
const audit = require("../deploy/audit-audio");
// синтетический WAV 44.1 кГц моно: 1 с «речи» + хвост (тишина либо резкий обрыв)
function wav(seconds, tailSilenceSec) {
  const SR = 44100, n = Math.round(SR * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  const speech = n - Math.round(SR * tailSilenceSec);
  for (let i = 0; i < n; i++) {
    const amp = i < speech ? 0.5 * Math.sin(2 * Math.PI * 200 * i / SR) : 0;
    buf.writeInt16LE(Math.round(amp * 32767), 44 + i * 2);
  }
  return buf;
}
const cutOff = audit.tailRatio(wav(1.0, 0));      // звук до последнего сэмпла — обрыв
const finished = audit.tailRatio(wav(1.0, 0.25)); // 250 мс тишины в конце — норма
assert.ok(cutOff.ratio > audit.CUT, "обрыв: хвост на полной громкости даёт ratio > 0.5, получено " + cutOff.ratio.toFixed(2));
assert.ok(finished.ratio < audit.SUSPECT, "норма: затухание в тишину даёт ratio < 0.3, получено " + finished.ratio.toFixed(2));
assert.strictEqual(audit.verdict(cutOff.ratio), "обрыв");
assert.strictEqual(audit.verdict(finished.ratio), "норма");
assert.strictEqual(audit.verdict(0.4), "подозрительно", "серая зона 0.3–0.5 отделена от обрыва");
assert.ok(Math.abs(cutOff.dur - 1.0) < 0.01, "длительность считается по data-чанку");
assert.strictEqual(audit.tailRatio(Buffer.from("не wav")).ratio, 1, "мусор вместо wav — считаем обрывом, а не падаем");

/* ── 2в. дорожки «сам звук буквы»: критерий не затухание, а полнота повторов ──
   Такой файл кончается гласной на полной громкости, и метрика хвоста у него высокая
   ВСЕГДА (прогон 21.08.2026: 7 «обрывов» из 19 при целых файлах). Дефект у них
   другой — v3 глотает повторы, поэтому считаем звуковые куски. */
{
  // синтетика: несколько всплесков, разделённых тишиной
  function pulses(count, pulseSec, gapSec) {
    const SR = 44100, per = Math.round(SR * (pulseSec + gapSec)), n = count * per;
    const buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
    buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
    const on = Math.round(SR * pulseSec);
    for (let i = 0; i < n; i++) {
      const amp = (i % per) < on ? 0.5 * Math.sin(2 * Math.PI * 200 * i / SR) : 0;
      buf.writeInt16LE(Math.round(amp * 32767), 44 + i * 2);
    }
    return buf;
  }
  assert.strictEqual(audit.pieces(pulses(3, 0.3, 0.2)), 3, "три звука через паузы — три куска");
  assert.strictEqual(audit.pieces(pulses(2, 0.3, 0.2)), 2, "проглоченный повтор виден как нехватка куска");
  assert.strictEqual(audit.pieces(pulses(1, 0.9, 0.2)), 1, "слитный тянущийся звук — один кусок");
  assert.strictEqual(audit.pieces(Buffer.from("не wav")), 0, "мусор вместо wav не роняет счётчик");
  // сколько кусков ждём — из самого текста запроса
  assert.strictEqual(audit.wantPieces("А. А. А."), 3);
  assert.strictEqual(audit.wantPieces("Ка. Ко. Ки. Ке."), 4);
  assert.strictEqual(audit.wantPieces("Ө… Ө… Ө."), 3, "многоточие — тоже разделитель");
  assert.strictEqual(audit.wantPieces("Салам!"), 1, "обычная фраза — один элемент");
  // критерий выбирается по id: дорожка звука против обычной карточки
  assert.strictEqual(audit.isSoundTrack({ id: "ph_snd_a" }), true);
  assert.strictEqual(audit.isSoundTrack({ id: "ph_oz" }), false, "фонетический пример словом — обычная проверка");
  assert.strictEqual(audit.isSoundTrack({ id: "m0_01" }), false);
  // и все дорожки звука реестра действительно попадают под этот критерий
  for (const p of gen.PHONETICS.filter((x) => /^ph_snd_/.test(x.id))) {
    assert.strictEqual(audit.isSoundTrack(p), true, p.id + " распознан как дорожка звука");
    assert.ok(audit.wantPieces(p.ky) >= 2, p.id + ": в тексте не меньше двух элементов («" + p.ky + "»)");
  }

  /* Слова дорожек звука — ТОЛЬКО из курса. Изолированную букву слать нельзя вовсе:
     кириллица без контекста читается по-русски (21.08.2026: «Ө. Ө. Ө.» звучало как
     русское «о», «Жа. Жо. Жу.» — «ж» вместо «дж»). Звук задаётся словами, а сочинять
     кыргызский запрещено — значит каждое слово обязано встречаться в текстах курса. */
  {
    const live = gen.loadData();
    const known = new Set();
    const add = (s) => { for (const w of String(s).toLowerCase().replace(/[^а-яёөүң\s-]/g, " ").split(/\s+/)) if (w) known.add(w); };
    for (const c of Object.values(live.CONTENT)) for (const v of c.vocab || []) if (!v.ref && v.ky) add(v.ky);
    for (const d of Object.values(live.DIALOGS || {})) {
      for (const p of d.parts || []) for (const l of p.lines || []) add(l.ky);
      for (const s of d.songs || []) for (const v of s.verses || []) add(v.ky);
    }
    for (const p of gen.PHONETICS.filter((x) => /^ph_snd_/.test(x.id))) {
      const words = p.ky.toLowerCase().replace(/[—.]/g, " ").split(/\s+/).filter(Boolean);
      assert.ok(words.length >= 3, p.id + ": в дорожке не меньше трёх слов («" + p.ky + "»)");
      for (const w of words)
        assert.ok(known.has(w), p.id + ": слово «" + w + "» есть в текстах курса (сочинять кыргызский нельзя)");
      // одиночная буква запрещена: её модель прочтёт по-русски
      assert.ok(!words.some((w) => w.length === 1), p.id + ": ни одного изолированного символа-буквы");
    }
  }
}

/* ── 3. Реальные данные: полный набор через buildAppHtml ─────────────────── */
const data = gen.loadData();
assert.ok(Array.isArray(data.CONTENT_READY) && data.CONTENT_READY.length, "CONTENT_READY загружен");

// каждая цель каждого модуля валидна для серверного гейта и несёт текст
let dialogTargets = 0;
for (const mod of data.CONTENT_READY) {
  const t = gen.targetsFor(mod, data);
  assert.ok(Array.isArray(t), mod + ": цели перечислены");
  for (const x of t) {
    assert.ok(ID_RE.test(x.id), mod + ": id проходит серверный гейт: " + x.id);
    assert.ok(typeof x.ky === "string" && x.ky.trim(), mod + ": у цели есть текст ky: " + x.id);
  }
  if (mod !== "m0") {
    // бакет: реплики и куплеты (ph_*) не смеют попасть в прогон другого модуля —
    // файл лёг бы в чужой каталог, клиент ищет их через homeOf только в m0
    assert.ok(t.every((x) => !x.id.startsWith("ph_")), mod + ": ph_* целей нет вне m0");
  }
}

// m0 покрывает каждую реплику и каждый куплет всех диалогов без исключения
const m0real = new Set(gen.targetsFor("m0", data).map((t) => t.id));
for (const [mid, d] of Object.entries(data.DIALOGS)) {
  for (const p of d.parts || []) for (const l of p.lines || []) {
    dialogTargets++;
    assert.ok(m0real.has(l.id), `реплика ${l.id} (${mid}) в целях m0`);
  }
  for (const s of d.songs || []) for (const v of s.verses || []) {
    dialogTargets++;
    assert.ok(m0real.has(v.id), `куплет ${v.id} (${mid}) в целях m0`);
  }
}
assert.ok(dialogTargets > 0, "диалоги в данных есть — покрытие не тривиально");

/* ── 3а. Фонетическая карточка «Алфавит и фонетика» покрыта целями m0 ──────
   Карточка (12-app.js) озвучивает примеры напрямую по id (kgw/sndBtn), в vocab
   и DIALOGS их нет — потому каждый такой id обязан быть целью m0 (иначе смена
   голоса молча пропустит файл: так они и остались стоковым голосом в 2026-08),
   а слово цели обязано совпадать со словом на экране (иначе голос читает не то). */
{
  const appHtml = require("../server/appshell").buildAppHtml();
  const m0targets = gen.targetsFor("m0", data);
  const m0byId = new Map(m0targets.map((t) => [t.id, t]));
  const kgwPairs = [...appHtml.matchAll(/kgw\("([^"]+)","(ph_[a-z0-9_]+)"\)/g)];
  const sndIds = [...appHtml.matchAll(/sndBtn\("(ph_[a-z0-9_]+)"\)/g)].map((x) => x[1]);
  assert.ok(kgwPairs.length >= 11 && sndIds.length >= 4, "карточка фонетики на странице найдена (kgw/sndBtn)");
  for (const [, word, id] of kgwPairs) {
    assert.ok(m0byId.has(id), `озвучка карточки ${id} — цель m0, иначе смена голоса её пропустит`);
    assert.strictEqual(m0byId.get(id).ky, word, `текст цели ${id} совпадает со словом на карточке`);
  }
  for (const id of sndIds) assert.ok(m0byId.has(id), `озвучка карточки ${id} — цель m0`);
  // Дрилл звуков в «Аудировании» ссылается на дорожки полями snd/snd2 реестра блоков.
  // Ссылка без цели = кнопка «сам звук», которая молчит у ученика, а прогон её не
  // сгенерирует; проверяем перебором всех записей всех sounds-блоков.
  {
    const bm = appHtml.match(/===STT-BLOCKS===[\s\S]*?\*\/([\s\S]*?)\/\* ===\/STT-BLOCKS=== \*\//);
    assert.ok(bm, "реестр блоков аудирования на странице");
    const reg = { console };
    vm.createContext(reg);
    vm.runInContext(bm[1] + "; this.B=STT_BLOCKS;", reg);
    const items = JSON.parse(JSON.stringify(reg.B)).filter((b) => b.kind === "sounds").flatMap((b) => b.items);
    const snds = items.flatMap((it) => [it.snd, it.snd2]).filter(Boolean);
    assert.ok(snds.length >= 18, "звуки букв озвучены не выборочно: ссылок " + snds.length);
    for (const id of snds) assert.ok(m0byId.has(id), `дорожка звука ${id} — цель m0`);
    // у гласной с долгой парой обязаны быть обе дорожки: слышать долготу можно
    // только в сравнении, одна кнопка из двух — половина дрилла
    for (const it of items) if (it.m2 && it.snd && /^[аоуэөү]$/.test(it.ch))
      assert.ok(it.snd2, "у гласной «" + it.ch + "» есть дорожка долгой пары");
    // текст дорожки звука — не одиночная буква: на сверхкоротком теле v3 отдаёт
    // пустой ответ, и сервер молча уходит на модель без кыргызского
    for (const id of snds) assert.ok(m0byId.get(id).ky.length >= 6,
      `текст дорожки ${id} достаточной длины («${m0byId.get(id).ky}»)`);
  }
  // PHONETICS не смеет дублировать vocab или диалоги — дубль означал бы двойную
  // генерацию одного файла в одном прогоне
  const ids = m0targets.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length, "цели m0 без дубликатов id");
}

console.log("gen-audio.test.js: OK (цели vocab+фонетика+диалоги+куплеты, бакет m0, safe-force, детект обрывов по темпу и затуханию)");
