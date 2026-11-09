"use strict";
/* Пакетная озвучка модуля через серверный TTS (/api/tts/<mod>, ElevenLabs).
   Идемпотентно: сверяется со списком готовых файлов, генерирует только недостающие.
   Использование:  node deploy/gen-audio.js m4 [m5 …]   (или all)
   Доступ: env KGA1_AUTH="логин:пароль" (нужна роль teacher/admin),
           env KGA1_BASE (по умолчанию https://kyrgyz-a1.xpertnet.ai).
   env KGA1_VOICE=<voice_id> — явный голос ElevenLabs для всех запросов; при явном
           голосе сервер не подменяет его первым голосом аккаунта на 402/404.
   env FORCE=1 — перегенерировать фразы модуля заново; кастомные записи
           (source:"upload") и звуковые эффекты (source:"sfx") не трогаются никогда.
   env KGA1_ONLY=<регексп по id> — точечный прогон: только совпавшие цели
           (например `^(m0_|ph_dlg)` — карточки и диалоги самого m0, без диалогов
           других модулей, которые тоже живут в бакете m0).
   env KGA1_ROLE=female — только реплики этой роли (роли и голоса — deploy/voices.json,
           путь перебивается env KGA1_VOICES).
   Реплики диалогов и куплеты песен (id с префиксом ph_) живут в бакете m0 —
   их генерирует только прогон m0, независимо от модуля-владельца диалога. */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

function loadData() {
  const html = require("../server/appshell").buildAppHtml();
  const m = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(m[1] + "; this.CONTENT=CONTENT; this.CONTENT_READY=CONTENT_READY;"
    + " this.DIALOGS=typeof DIALOGS!==\"undefined\"?DIALOGS:{};"
    + " this.LESSONS=typeof LESSONS!==\"undefined\"?LESSONS:{};", sb);
  return { CONTENT: sb.CONTENT, CONTENT_READY: sb.CONTENT_READY, DIALOGS: sb.DIALOGS, LESSONS: sb.LESSONS };
}

// Карточка «Алфавит и фонетика» (app/src/12-app.js) озвучивает примеры напрямую
// по id (kgw/sndBtn): в vocab и DIALOGS их нет, и без этого списка смена голоса
// молча пропускает их — так они и просидели на стоковом голосе после перехода
// на клона (2026-08). Слово обязано совпадать с текстом карточки — guard в
// tests/gen-audio.test.js сверяет пары kgw(слово, id) собранной страницы.
const PHONETICS = [
  { id: "ph_oz", ky: "өз" }, { id: "ph_tor", ky: "төр" }, { id: "ph_soz", ky: "сөз" },
  { id: "ph_koel", ky: "көл" }, { id: "ph_uy", ky: "үй" }, { id: "ph_kun", ky: "күн" },
  { id: "ph_tun", ky: "түн" }, { id: "ph_un", ky: "үн" }, { id: "ph_tang", ky: "таң" },
  { id: "ph_atyngyz", ky: "атыңыз" }, { id: "ph_kalyngyz", ky: "калыңыз" },
  { id: "ph_koychu", ky: "койчу" }, { id: "ph_balykchy", ky: "балыкчы" },
  { id: "ph_mergenchi", ky: "мергенчи" }, { id: "ph_surotchu", ky: "сүрөтчү" },
  // Сам звук буквы — для дрилла в «Аудировании» (реестр STT_VOWELS/STT_CONSONANTS
  // ссылается на эти id полями snd/snd2). ГЛАВНОЕ ПРАВИЛО: изолированную букву
  // отправлять нельзя — кириллица без контекста читается по РУССКИ (замер 21.08.2026:
  // «Ө. Ө. Ө.» звучало как русское «о», «Жа. Жо. Жу.» — как «ж» вместо «дж»; поймал
  // владелец на слух, машинные проверки полноты и затухания этого не видят).
  // Звук задаётся словами курса: где есть минимальная пара — контрастом
  // («Кол — көл»: русский заменитель против кыргызского звука, выбор владельца),
  // где пары нет — тремя словами с этим звуком. Пары найдены перебором словаря
  // курса, не выдуманы; гейт в gen-audio.test держит это правило.
  { id: "ph_snd_a", ky: "Ал. Аты. Жаш." }, { id: "ph_snd_aa", ky: "Ал — баа. Ал — баа." },
  { id: "ph_snd_o", ky: "Так — ток. Так — ток." }, { id: "ph_snd_oo", ky: "Ош — ооз. Ош — ооз." },
  { id: "ph_snd_u", ky: "Түз — туз. Түз — туз." }, { id: "ph_snd_uu", ky: "Уй — уул. Уй — уул." },
  { id: "ph_snd_y", ky: "Куш — кыш. Куш — кыш." }, { id: "ph_snd_e", ky: "Эт. Эң. Эл." },
  { id: "ph_snd_ee", ky: "Эт — жээн. Эт — жээн." }, { id: "ph_snd_oe", ky: "Кол — көл. Кол — көл." },
  { id: "ph_snd_ooe", ky: "Нөл — жөө. Нөл — жөө." }, { id: "ph_snd_ue", ky: "Уй — үй. Уй — үй." },
  { id: "ph_snd_uue", ky: "Үй — күү. Үй — күү." }, { id: "ph_snd_i", ky: "Иш. Ич. Ким." },
  { id: "ph_snd_zh", ky: "Жол. Жаңы. Жакшы." }, { id: "ph_snd_ng", ky: "Эң. Чоң. Миң." },
  { id: "ph_snd_k", ky: "Кыз — ким. Кыз — ким." }, { id: "ph_snd_g", ky: "Ага — гүл. Ага — гүл." },
  { id: "ph_snd_r", ky: "Ыр. Бар. Жер." },
];

// Цели озвучки модуля: свой vocab (реюз озвучен в родном модуле); для m0 — плюс
// фонетические примеры алфавитной карточки и реплики/куплеты диалогов ВСЕХ
// модулей (клиент ищет ph_* через homeOf в m0).
// kind нужен для выбора режима голоса: см. stabilityFor.
function targetsFor(mod, data) {
  const c = data.CONTENT[mod];
  if (!c) return null;
  const targets = c.vocab.filter((v) => !v.ref).map((v) => ({ id: v.id, ky: v.ky, kind: "vocab" }));
  if (mod === "m0") {
    for (const p of PHONETICS) targets.push({ id: p.id, ky: p.ky, kind: "vocab" });
    for (const d of Object.values(data.DIALOGS || {})) {
      for (const p of d.parts || []) for (const l of p.lines || []) targets.push({ id: l.id, ky: l.ky, kind: "line", sp: l.sp });
      for (const s of d.songs || []) for (const v of s.verses || []) targets.push({ id: v.id, ky: v.ky, kind: "verse" });
    }
    // Дорожки аудиоурока (раздел «Уроки», бакет m0). Генерирует их deploy/gen-pronunciation.js —
    // у объяснения текст на языке ученика, а не кыргызский, поэтому здесь они помечены
    // noGen: аудит обязан их видеть (иначе 127 файлов урока вне проверки затухания),
    // а пакетная генерация — обходить.
    for (const L of Object.values(data.LESSONS || {})) {
      const role = L.voiceRole;
      for (const s of L.segments || []) {
        if (s.perLang) for (const lang of Object.keys(s.text || {}))
          targets.push({ id: s.a + "_" + lang, ky: s.text[lang], kind: "lesson", lang, role, noGen: true });
        else targets.push({ id: s.a, ky: s.ky, kind: "lesson", lang: "ky", role, noGen: true });
      }
    }
  }
  return targets;
}

// Кто каким голосом говорит — данные, не логика: реестр deploy/voices.json.
// Персонаж описан полом и возрастом (`characters`), голос — ключ `<пол>_<возраст>`
// в `voices`. Новый персонаж = строка в characters; новый возрастной голос = строка
// в voices. Роль берётся по полю sp диалога; у карточек и куплетов sp нет — им голос
// по умолчанию (KGA1_VOICE перебивает реестр целиком, для проб одним голосом).
// Детских голосов у ElevenLabs нет (запрещены политикой), поэтому ключи *_child
// в реестре указывают на молодые голоса — возраст в данных остаётся честным.
function roleFor(target, reg) {
  if (target.role) return target.role;   // роль задана данными (урок читает свой голос)
  const c = target.sp && reg.characters && reg.characters[target.sp];
  if (!c) return reg.default;
  // индивидуальный голос персонажа сильнее роли: участники одной сцены
  // (Асан/Айдар/Айбек — все male_child) обязаны звучать различимо
  return c.voice || c.gender + "_" + c.age;
}
function voiceFor(target, reg) {
  return reg.voices[roleFor(target, reg)] || reg.voices[reg.default] || "";
}

// Правки преподавателя (/api/overrides/<mod>) сильнее исходников: ученик видит
// исправленный текст, значит и озвучка обязана читать его — иначе карточка
// показывает «котормочу», а голос говорит «тилмеч» (реальный промах вычитки).
function effectiveKy(target, overrides) {
  const o = overrides && overrides[target.id];
  // Произношение преподавателя (`say`) сильнее написания: заимствования модель читает
  // с чужим гласным («команда» → [куманда]), и это поле — единственный способ поправить
  // звук, не меняя написание на карточке. Клиентский аналог — sayText в ===OVERRIDES===.
  if (o && typeof o.say === "string" && o.say.trim()) return o.say.trim();
  return (o && typeof o.ky === "string" && o.ky.trim()) ? o.ky : target.ky;
}

// Режим голоса v3: 1 Robust для карточек-слов — на коротком тексте Natural съедает
// последний согласный («Атыңыз ким?» без [м], «Ийгилик каалайм!» обрывом), Robust его
// выговаривает (речь длиннее на треть). Связная речь реплик и куплетов остаётся на
// Natural: там Robust звучит ровнее, но беднее интонацией, а обрывов нет.
function stabilityFor(kind) { return kind === "vocab" ? 1 : 0.5; }

// Усечение: v3 иногда обрезает хвост фразы. Дешёвый детектор — темп: замер по 150
// перегенерированным файлам m0 дал медиану 14.5 знаков/сек, p90 18, максимум 23.6,
// поэтому порог 26 — выше живой речи, ложных тревог не даёт. Ловит только грубые
// обрывы длинных фраз: у короткого слова откушенный хвост темпа почти не меняет —
// такие ищет deploy/audit-audio.js по затуханию звука.
const MAX_CPS = 26;
function tooShort(text, bytes, bitrate) {
  return bytes * 8 / bitrate < text.length / MAX_CPS;
}

// Отбор к генерации: без FORCE — только отсутствующие файлы; с FORCE — ещё и
// перегенерация TTS-озвучки, но upload (записи преподавателя, песни) и sfx
// (амбиенты) пропускаются всегда.
function splitTodo(targets, have, meta, force) {
  const todo = [], skipped = [];
  for (const t of targets) {
    // цели урока озвучивает gen-pronunciation.js (текст на языке ученика, не кыргызский)
    if (t.noGen) { skipped.push({ id: t.id, source: "lesson" }); continue; }
    if (!have.has(t.id)) { todo.push(t); continue; }
    if (!force) continue;
    const source = meta[t.id] && meta[t.id].source;
    if (source === "upload" || source === "sfx") skipped.push({ id: t.id, source });
    else todo.push(t);
  }
  return { todo, skipped };
}

async function main() {
  const BASE = process.env.KGA1_BASE || "https://kyrgyz-a1.xpertnet.ai";
  const CRED = process.env.KGA1_AUTH;
  if (!CRED) { console.error("Задай KGA1_AUTH=логин:пароль (роль teacher/admin)"); process.exit(1); }
  const AUTH = "Basic " + Buffer.from(CRED).toString("base64");
  const VOICE = process.env.KGA1_VOICE || "";
  if (VOICE && !/^[A-Za-z0-9]{10,40}$/.test(VOICE)) {
    console.error("KGA1_VOICE: ожидается voice_id ElevenLabs (10–40 символов A-Za-z0-9)"); process.exit(1);
  }
  const REG = JSON.parse(fs.readFileSync(process.env.KGA1_VOICES || path.join(__dirname, "voices.json"), "utf8"));
  // KGA1_ROLE=female — прогон реплик одной роли (у карточек и куплетов роль по умолчанию)
  const ROLE = process.env.KGA1_ROLE || "";
  const FORCE = !!process.env.FORCE;
  const WORKERS = Math.max(1, parseInt(process.env.CONCURRENCY, 10) || 2); // лимиты ElevenLabs: 2–4
  const BITRATE = parseInt(process.env.KGA1_BITRATE, 10) || 192000; // прод отдаёт mp3_44100_192
  // Точечный прогон: прогон m0 иначе кроет диалоги ВСЕХ модулей (их бакет — m0),
  // а перегенерировать бывает нужно один модуль или одно слово.
  const ONLY = process.env.KGA1_ONLY ? new RegExp(process.env.KGA1_ONLY) : null;

  const data = loadData();
  const args = process.argv.slice(2);
  const mods = args.includes("all") || !args.length ? [...data.CONTENT_READY] : args;

  const fetchJson = async (p) =>
    (await fetch(BASE + p, { headers: { Authorization: AUTH } })).json();

  let totalOk = 0, totalFail = 0, totalSkipped = 0;
  for (const mod of mods) {
    const all = targetsFor(mod, data);
    if (!all) { console.log(mod + ": нет в CONTENT, пропуск"); continue; }
    let targets = ONLY ? all.filter((t) => ONLY.test(t.id)) : all;
    if (ROLE) targets = targets.filter((t) => roleFor(t, REG) === ROLE);
    if (ONLY || ROLE) console.log(`${mod}: фильтры (${[ONLY && "id", ROLE && "роль " + ROLE].filter(Boolean).join(", ")}) — из ${all.length} целей осталось ${targets.length}`);
    const have = new Set(await fetchJson("/api/audio/" + mod + "/list"));
    const meta = await fetchJson("/api/audio/" + mod + "/meta");
    // правки текста преподавателем: озвучиваем то, что ученик видит
    const overrides = await fetchJson("/api/overrides/" + mod).catch(() => ({}));
    const { todo, skipped } = splitTodo(targets, have, meta, FORCE);
    const kept = skipped.filter((s) => s.source !== "lesson"), lessons = skipped.length - kept.length;
    console.log(`${mod}: целей ${targets.length}, есть ${have.size}, к генерации ${todo.length}`
      + (kept.length ? `, пропущено (upload/sfx): ${kept.map((s) => s.id).join(",")}` : "")
      + (lessons ? `, дорожек урока ${lessons} (их озвучивает gen-pronunciation.js)` : ""));
    let ok = 0, quota = false; const fail = [], shorts = [];
    // общий курсор: воркеры разбирают очередь по одному — ретраи не дисбалансируют пул
    let i = 0;
    const worker = async () => {
      for (;;) {
        const v = todo[i++];
        if (!v || quota) return;
        const ky = effectiveKy(v, overrides);
        let done = false;
        for (let attempt = 1; attempt <= 3 && !done; attempt++) {
          try {
            const r = await fetch(BASE + "/api/tts/" + mod, {
              method: "POST",
              headers: { Authorization: AUTH, "Content-Type": "application/json" },
              // force после первой попытки: усечённый дубль уже лёг файлом, его надо перезаписать;
              // с третьей попытки — Robust даже для связной речи: на упорных обрывах помогает он
              body: JSON.stringify({ id: v.id, text: ky, force: FORCE || attempt > 1,
                voice: VOICE || voiceFor(v, REG),
                settings: { stability: attempt >= 3 ? 1 : stabilityFor(v.kind) } })
            });
            if (r.ok) {
              const bytes = (await r.json().catch(() => ({}))).bytes || 0;
              if (tooShort(ky, bytes, BITRATE) && attempt < 3) {
                console.log(`короткий дубль ${v.id} attempt ${attempt}: ${(bytes * 8 / BITRATE).toFixed(2)}s на ${ky.length} знаков — ретрай`);
                continue;
              }
              if (tooShort(ky, bytes, BITRATE)) shorts.push(v.id); // 3 коротких подряд — оставляем, но в отчёт
              ok++; done = true; console.log(`ok ${v.id} (${ok}/${todo.length}) ${ky}`);
            }
            else {
              const t = await r.text();
              console.log(`ERR ${v.id} attempt ${attempt}: HTTP ${r.status} ${t.slice(0, 100)}`);
              if (t.includes("HTTP 401")) { quota = true; break; } // квота ElevenLabs — дальше без толку
              await new Promise((res) => setTimeout(res, 3000 * attempt));
            }
          } catch (e) {
            console.log(`ERR ${v.id} attempt ${attempt}: ${e.message}`);
            await new Promise((res) => setTimeout(res, 3000 * attempt));
          }
        }
        if (!done) fail.push(v.id);
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    totalOk += ok; totalFail += todo.length - ok; totalSkipped += skipped.length;
    console.log(`${mod}: ok=${ok}, не сгенерировано=${todo.length - ok}, пропущено=${skipped.length}`);
    if (fail.length) console.log(`${mod}: не удалось: ${fail.join(",")}`);
    if (shorts.length) console.log(`${mod}: ПОДОЗРЕНИЕ НА ОБРЫВ (нефизичный темп после 3 дублей): ${shorts.join(",")}`);
    // сверка полноты: каждая цель обязана существовать файлом (кроме upload/sfx они и есть файлы)
    const after = new Set(await fetchJson("/api/audio/" + mod + "/list"));
    const missing = targets.filter((t) => !after.has(t.id)).map((t) => t.id);
    if (missing.length) console.log(`${mod}: БЕЗ ОЗВУЧКИ: ${missing.join(",")}`);
    // сверка голоса: у каждой сгенерированной цели в мете обязан стоять голос её роли —
    // расхождение значит, что кто-то (другой прогон, ручная генерация) пишет чужим голосом
    if (ok) {
      const meta2 = await fetchJson("/api/audio/" + mod + "/meta");
      const wrong = todo.filter((t) => meta2[t.id] && meta2[t.id].source === "tts"
        && meta2[t.id].voice !== (VOICE || voiceFor(t, REG)))
        .map((t) => `${t.id}(${t.sp || t.kind}: ждали ${VOICE || voiceFor(t, REG)}, в мете ${meta2[t.id].voice})`);
      if (wrong.length) { console.log(`СТОП: голос в мете не совпал с ожидаемым: ${wrong.slice(0, 5).join("; ")}`); break; }
    }
    if (quota) { console.log("Останов: кончились кредиты ElevenLabs. Пополни и перезапусти — скрипт продолжит с места остановки."); break; }
  }
  console.log(`ИТОГО: ok=${totalOk}, осталось=${totalFail}, пропущено (upload/sfx)=${totalSkipped}`);
}

module.exports = { loadData, targetsFor, splitTodo, tooShort, stabilityFor, roleFor, voiceFor, effectiveKy, PHONETICS };
if (require.main === module) main();
