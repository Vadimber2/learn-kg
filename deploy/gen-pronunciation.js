"use strict";
/* Генератор аудиокурса произношения (объяснение по-русски, примеры по-кыргызски).
   Пишет mp3 ТОЛЬКО в локальную папку — в /data и на прод ничего не отправляет:
   треки сначала слушает владелец, публикация — отдельным осознанным шагом.

   Запуск:
     node deploy/gen-pronunciation.js                      # все треки в ./pronunciation-out
     OUT=/путь node deploy/gen-pronunciation.js pron_01_intro   # выборочно
     LANG_MODE=both node deploy/gen-pronunciation.js pron_01_intro  # два варианта: auto и ky

   Ключ: ~/.config/elevenlabs/learn-kg.key (вне репозитория) либо env ELEVENLABS_API_KEY.

   Почему language_code по умолчанию НЕ ставится: текст смешанный — русское
   объяснение с кыргызскими примерами. Жёсткий ky на русской фразе портит русскую
   часть, поэтому по умолчанию модель определяет язык сама (LANG_MODE=auto).
   Режим both даёт обе версии одного трека для сравнения на слух. */
const fs = require("fs");
const os = require("os");
const path = require("path");

// Урок выбирается env KGA1_LESSON=<mod> (по умолчанию m0 — урок произношения);
// соответствие модуль → скрипт задаёт реестр LESSON_SCRIPTS в gen-lessons.js.
// Аудио любого урока живёт в бакете m0 (ph_<тема>_NN) — как реплики диалогов.
const { LESSON_SCRIPTS } = require("./gen-lessons");
const LESSON_MOD = process.env.KGA1_LESSON || "m0";
if (!LESSON_SCRIPTS[LESSON_MOD]) {
  console.error("неизвестный урок " + LESSON_MOD + "; есть: " + Object.keys(LESSON_SCRIPTS).join(", "));
  process.exit(1);
}
const SCRIPT = path.join(__dirname, LESSON_SCRIPTS[LESSON_MOD]);
const VOICES = path.join(__dirname, "voices.json");
const OUT = process.env.OUT || path.join(process.cwd(), "pronunciation-out");
const LANG_MODE = process.env.LANG_MODE || "auto"; // auto | ky | both
const MODEL = process.env.ELEVEN_MODEL || "eleven_v3";
// Связная речь — Natural (0.5). Robust (1.0) в v3 нужен коротким словам-карточкам,
// на объяснении он звучит деревянно (канон: kyrgyz-tts/SKILL.md).
const STABILITY = Number(process.env.STABILITY || 0.5);

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const p = path.join(os.homedir(), ".config", "elevenlabs", "learn-kg.key");
  try { return fs.readFileSync(p, "utf8").trim(); } catch {
    console.error("Ключ не найден: положи его в " + p + " или задай ELEVENLABS_API_KEY");
    process.exit(1);
  }
}

async function tts(key, voiceId, text, lang, speed) {
  const body = {
    text, model_id: MODEL,
    voice_settings: { stability: STABILITY, similarity_boost: 0.75, speed: speed || 1 },
  };
  if (lang) body.language_code = lang;
  const r = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/" + voiceId + "?output_format=mp3_44100_192",
    { method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0, 200));
  const buf = Buffer.from(await r.arrayBuffer());
  // v3 на коротком тексте умеет ответить 200 с пустым телом — записать ноль байт
  // и сказать «готово» значит молча отдать тишину
  if (!buf.length) throw new Error("пустое тело ответа (v3 иногда так отвечает — повтори запрос)");
  return buf;
}

/* Прод-режим (PROD=1): генерация серверной ручкой POST /api/tts/m0, файл ложится в
   /data/audio/m0. Идентификатор начинается на ph_ — при старте процесса все ph_*.mp3
   из m0 попадают в ПУБЛИЧНЫЙ снимок озвучки, поэтому после прогона нужен рестарт
   (редеплой), и только тогда ссылка /api/audio/m0/<id>.mp3 открывается без входа.
   Ручка режет текст до 500 знаков — трек бьётся на сегменты по границам предложений.
   Временные дорожки удалять после прослушивания: они висят в публичном наборе. */
function segments(text, limit) {
  const out = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((cur + " " + s).trim().length > limit) { if (cur) out.push(cur.trim()); cur = s; }
    else cur = (cur ? cur + " " : "") + s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function mainProd() {
  const S = JSON.parse(fs.readFileSync(SCRIPT, "utf8"));
  const REG = JSON.parse(fs.readFileSync(VOICES, "utf8"));
  const voiceId = REG.voices[S.voiceRole];
  const cred = process.env.KGA1_AUTH;
  if (!cred) { console.error("нужен KGA1_AUTH=логин:пароль (teacher/admin)"); process.exit(1); }
  const base = process.env.KGA1_BASE || "https://learn.kg";
  const auth = "Basic " + Buffer.from(cred).toString("base64");
  const only = process.argv.slice(2);
  const langsOnly = (process.env.LANGS || "ru,en,tr").split(",");
  const tracks = only.length ? S.tracks.filter((t) => only.includes(t.id)) : S.tracks;
  // Правка одного объяснения не должна перезаписывать соседние дорожки: у кыргызских
  // примеров есть риск нового обрыва хвоста, а принятый файл лучше не трогать.
  const onlyId = process.env.KGA1_ONLY ? new RegExp(process.env.KGA1_ONLY) : null;
  const out = [];
  let chars = 0;
  const send = async (id, text, lang, speed) => {
    if (onlyId && !onlyId.test(id)) return false;
    const r = await fetch(base + "/api/tts/m0", { method: "POST",
      headers: { Authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ id, text, voice: voiceId, model: MODEL, lang, force: true,
        settings: { stability: STABILITY, similarity: 0.75, speed } }) });
    const body = await r.text();
    if (!r.ok) { console.error("  FAIL " + id + ": HTTP " + r.status + " " + body.slice(0, 130)); return false; }
    chars += text.length; console.log("  ok " + id + " [" + lang + "] " + text.length + " зн.");
    return true;
  };
  for (const t of tracks) {
    for (const [i, seg] of t.segments.entries()) {
      const n = String(i + 1).padStart(2, "0");
      if (seg.kind === "explain") {
        // объяснение звучит на языке ученика: три дорожки с суффиксом языка.
        // Голос один и тот же (KG Voice Female) — en/tr звучат с кыргызским акцентом,
        // это осознанное решение владельца: единый голос курса важнее нейтива.
        for (const lang of ["ru", "en", "tr"]) {
          if (!langsOnly.includes(lang)) continue;
          const text = seg.text[lang];
          if (!text) { console.error("  нет текста " + t.id + "/" + n + " [" + lang + "]"); continue; }
          if (text.length > 480) { console.error("  " + t.id + "/" + n + " [" + lang + "] длиннее 480"); continue; }
          if (await send("ph_" + t.id + "_" + n + "_" + lang, text, lang, 1)) out.push({ id: "ph_" + t.id + "_" + n + "_" + lang, kind: "explain", lang, theme: t.id });
        }
      } else {
        // кыргызский пример — одна дорожка для всех языков интерфейса.
        // say — орфоэпическая запись только для TTS (экран показывает ky):
        // «Жол.» модель читала русским фрикативным [ж], «Джол.» держит аффрикату.
        if (await send("ph_" + t.id + "_" + n, seg.say || seg.ky, "ky", seg.speed || 0.8))
          out.push({ id: "ph_" + t.id + "_" + n, kind: "example", theme: t.id });
      }
    }
  }
  fs.writeFileSync(path.join(process.cwd(), "pronunciation-manifest.json"),
    JSON.stringify({ base, voice: S.voiceRole, tracks: out }, null, 1));
  console.log("\nдорожек: " + out.length + ", символов: ~" + chars);
  console.log("Ссылки заработают ПОСЛЕ рестарта (публичный снимок собирается при старте).");
}

async function main() {
  if (process.env.PROD) return mainProd();
  const key = readKey();
  const S = JSON.parse(fs.readFileSync(SCRIPT, "utf8"));
  const REG = JSON.parse(fs.readFileSync(VOICES, "utf8"));
  const voiceId = REG.voices[S.voiceRole];
  if (!voiceId) { console.error("нет голоса " + S.voiceRole + " в voices.json"); process.exit(1); }
  const only = process.argv.slice(2);
  const tracks = only.length ? S.tracks.filter((t) => only.includes(t.id)) : S.tracks;
  if (!tracks.length) { console.error("нечего генерировать: " + only.join(",")); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  console.log("голос " + S.voiceRole + ", модель " + MODEL + ", треков " + tracks.length + " → " + OUT);
  let chars = 0;
  for (const t of tracks) {
    for (const [i, seg] of t.segments.entries()) {
      const id = t.id + "_" + String(i + 1).padStart(2, "0");
      try {
        const buf = await tts(key, voiceId, seg.text, seg.lang === "ky" ? "ky" : null,
          seg.speed || (seg.lang === "ky" ? 0.8 : 1));
        fs.writeFileSync(path.join(OUT, id + ".mp3"), buf);
        chars += seg.text.length;
        console.log("  ok " + id + " [" + seg.lang + "] " + Math.round(buf.length / 1024) + " КБ");
      } catch (e) { console.error("  FAIL " + id + ": " + e.message); }
    }
  }
  console.log("символов: ~" + chars + "; файлы локально в " + OUT + " — ничего не загружено");
}

main().catch((e) => { console.error(e); process.exit(1); });
