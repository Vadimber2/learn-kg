"use strict";
/* Поиск обрезанной озвучки: v3 иногда отдаёт файл с откушенным хвостом фразы.
   Темп речи такой обрыв не выдаёт (у короткого слова длительность почти не меняется),
   зато выдаёт затухание: нормальная фраза кончается тишиной, обрезанная — на полной
   громкости. Метрика — энергия последних 80 мс к энергии всего файла:
   > 0.5 обрыв, 0.3–0.5 подозрительно, ниже норма (замер на 150 файлах m0).

   Использование:  node deploy/audit-audio.js m0 [m1 …]
   env KGA1_AUTH="логин:пароль" (teacher/admin), KGA1_BASE, KGA1_ONLY=<регексп по id>.
   env KGA1_FIX=1 — перегенерировать найденное: две попытки в обычном режиме,
       затем Robust (stability 1) — эскалация, проверенная на упорных случаях.
   env KGA1_VOICE=<voice_id> — голос для перегенерации (как в gen-audio.js).

   Декодирование — системным `afconvert` (macOS): инструмент локальной вычитки,
   не часть прода, поэтому зависимостей в проект не добавляет. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadData, targetsFor, voiceFor, stabilityFor, effectiveKy } = require("./gen-audio");

const CUT = 0.5, SUSPECT = 0.3, TAIL_MS = 80;

// Энергия хвоста относительно энергии всей записи: 1 — файл кончается на полном
// звуке (обрыв), около нуля — нормальное затухание в тишину.
function tailRatio(wav, tailMs = TAIL_MS) {
  let off = 12, dataOff = -1, dataLen = 0, rate = 44100;
  while (off < wav.length - 8) {
    const chunk = wav.toString("ascii", off, off + 4), len = wav.readUInt32LE(off + 4);
    if (chunk === "fmt ") rate = wav.readUInt32LE(off + 12);
    if (chunk === "data") { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) return { ratio: 1, dur: 0 };
  const n = Math.min(Math.floor(dataLen / 2), Math.floor((wav.length - dataOff) / 2));
  if (!n) return { ratio: 1, dur: 0 };
  const rms = (from, to) => {
    let sq = 0, cnt = 0;
    for (let i = Math.max(0, from); i < Math.min(n, to); i++) { const s = wav.readInt16LE(dataOff + i * 2) / 32768; sq += s * s; cnt++; }
    return cnt ? Math.sqrt(sq / cnt) : 0;
  };
  const body = rms(0, n), tail = rms(n - Math.round(rate * tailMs / 1000), n);
  return { ratio: body > 0 ? tail / body : 1, dur: n / rate };
}

function verdict(ratio) { return ratio > CUT ? "обрыв" : ratio >= SUSPECT ? "подозрительно" : "норма"; }

/* Дорожки «сам звук буквы» (ph_snd_*, дрилл аудирования) затуханием не проверяются:
   они кончаются гласной или слогом на полной громкости, и метрика хвоста у них
   высокая ВСЕГДА — 21.08.2026 такой прогон дал 7 «обрывов» из 19, притом что все
   звуки в файлах были на месте. Их дефект другой: v3 глотает повторы (было «И, и, и.»
   → два «и» из трёх). Поэтому критерий — счёт энергетических кусков: их должно быть
   не меньше, чем элементов в тексте запроса, разделённых точками. */
function isSoundTrack(t) { return /^ph_snd_/.test(t.id); }
function wantPieces(ky) { return String(ky).split(/[.…!?]+/).map((s) => s.trim()).filter(Boolean).length; }
// Куски = участки выше 0.2 пика; выход из куска — падение ниже 0.7 порога (иначе
// дрожание внутри одного звука считалось бы новым куском).
function pieces(wav) {
  let off = 12, dataOff = -1, dataLen = 0, rate = 44100;
  while (off < wav.length - 8) {
    const chunk = wav.toString("ascii", off, off + 4), len = wav.readUInt32LE(off + 4);
    if (chunk === "fmt ") rate = wav.readUInt32LE(off + 12);
    if (chunk === "data") { dataOff = off + 8; dataLen = len; break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) return 0;
  const n = Math.min(Math.floor(dataLen / 2), Math.floor((wav.length - dataOff) / 2));
  const win = Math.round(rate * 0.02), en = [];
  for (let i = 0; i < n; i += win) {
    let sq = 0, cnt = 0;
    for (let j = i; j < Math.min(n, i + win); j++) { const s = wav.readInt16LE(dataOff + j * 2) / 32768; sq += s * s; cnt++; }
    en.push(cnt ? Math.sqrt(sq / cnt) : 0);
  }
  const mx = Math.max(...en, 0), thr = mx * 0.2;
  let cnt = 0, on = false;
  for (const e of en) { if (e > thr && !on) { cnt++; on = true; } else if (e <= thr * 0.7 && on) on = false; }
  return cnt;
}

// Озвучка старше правки текста = голос читает прежний текст (кейс «тилмеч/котормочу»):
// файл генерировался до того, как преподаватель исправил ky. Сравнение ISO-строк.
function staleAgainstOverride(metaEntry, override) {
  return !!(override && typeof override.ky === "string" && override.ky.trim() && override.at
    && metaEntry && metaEntry.at && metaEntry.at < override.at);
}

async function main() {
  const BASE = process.env.KGA1_BASE || "https://kyrgyz-a1.xpertnet.ai";
  const CRED = process.env.KGA1_AUTH;
  if (!CRED) { console.error("Задай KGA1_AUTH=логин:пароль (роль teacher/admin)"); process.exit(1); }
  const AUTH = "Basic " + Buffer.from(CRED).toString("base64");
  const ONLY = process.env.KGA1_ONLY ? new RegExp(process.env.KGA1_ONLY) : null;
  const VOICE = process.env.KGA1_VOICE || "";
  const FIX = !!process.env.KGA1_FIX;
  // Голос берётся из того же реестра, что и у генератора: без него перегенерация
  // реплики уходит на голос курса по умолчанию и у персонажа меняется пол.
  const REG = JSON.parse(fs.readFileSync(process.env.KGA1_VOICES || path.join(__dirname, "voices.json"), "utf8"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kga1-audit-"));

  const data = loadData();
  const args = process.argv.slice(2);
  const mods = args.includes("all") || !args.length ? [...data.CONTENT_READY] : args;

  // Реплики и куплеты живут в бакете m0 — качаются и правятся только там.
  const bucket = (id) => (id.startsWith("ph_") ? "m0" : id.split("_")[0]);

  const measure = async (id) => {
    const r = await fetch(BASE + "/api/audio/" + bucket(id) + "/" + id + ".mp3", { headers: { Authorization: AUTH } });
    if (!r.ok) return null;
    const mp3 = path.join(tmp, id + ".mp3"), wav = path.join(tmp, id + ".wav");
    fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
    try { execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "1", mp3, wav], { stdio: "ignore" }); }
    catch { return null; }
    const buf = fs.readFileSync(wav);
    return Object.assign(tailRatio(buf), { pieces: pieces(buf) });
  };

  // правки текста преподавателем сильнее исходников — лечим тем текстом, что видит ученик
  const regen = async (t, robust, overrides) => {
    // дорожку урока нельзя перегенерировать здесь: её текст на языке ученика, а эта
    // ручка ушла бы в ky и получилась бы тарабарщина — лечит deploy/gen-pronunciation.js
    if (t.noGen) { console.log(`  ${t.id}: перегенерация только через gen-pronunciation.js (KGA1_ONLY='^${t.id}$')`); return false; }
    const r = await fetch(BASE + "/api/tts/" + bucket(t.id), {
      method: "POST", headers: { Authorization: AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, text: effectiveKy(t, overrides), force: true, voice: VOICE || voiceFor(t, REG),
        settings: { stability: robust ? 1 : stabilityFor(t.kind) } })
    });
    return r.ok;
  };

  let totalBad = 0, totalFixed = 0, totalStuck = [];
  for (const mod of mods) {
    const all = targetsFor(mod, data);
    if (!all) { console.log(mod + ": нет в CONTENT, пропуск"); continue; }
    const targets = ONLY ? all.filter((t) => ONLY.test(t.id)) : all;
    const have = new Set(await (await fetch(BASE + "/api/audio/" + mod + "/list", { headers: { Authorization: AUTH } })).json());
    const meta = await (await fetch(BASE + "/api/audio/" + mod + "/meta", { headers: { Authorization: AUTH } })).json();
    const overrides = await (await fetch(BASE + "/api/overrides/" + mod, { headers: { Authorization: AUTH } })).json().catch(() => ({}));
    // Записи преподавателя и эффекты не наши — их не проверяем и не правим
    const list = targets.filter((t) => have.has(t.id) && !["upload", "sfx"].includes(meta[t.id] && meta[t.id].source));
    console.log(`${mod}: проверяю ${list.length} из ${targets.length} целей`);

    // Чужой голос — второй дефект наравне с обрывом: реплику могли перегенерировать
    // без реестра, и у персонажа сменился пол. Проверяется по мете, а не на слух.
    const bad = [];
    for (const t of list) {
      const want = VOICE || voiceFor(t, REG), got = meta[t.id] && meta[t.id].voice;
      if (got && got !== want) { bad.push(t); console.log(`  чужой голос ${t.id} (${t.sp || t.kind}): в мете ${got}, ждём ${want} — ${t.ky}`); }
      if (staleAgainstOverride(meta[t.id], overrides[t.id]) && !bad.includes(t)) {
        bad.push(t);
        console.log(`  озвучка старше правки текста ${t.id}: файл ${meta[t.id].at}, правка ${overrides[t.id].at} — читать должен «${overrides[t.id].ky}»`);
      }
    }
    let i = 0;
    const worker = async () => {
      for (;;) {
        const t = list[i++];
        if (!t) return;
        const m = await measure(t.id);
        if (!m) { console.log(`  ? ${t.id}: не скачался/не декодировался`); continue; }
        if (isSoundTrack(t)) {
          // дорожка звука: смотрим полноту повторов, а не затухание
          const want = wantPieces(t.ky);
          if (m.pieces < want && !bad.includes(t)) { bad.push(t);
            console.log(`  глотает повтор ${t.id}: звуков ${m.pieces} из ${want}, ${m.dur.toFixed(2)}s — ${t.ky}`); }
          continue;
        }
        if (m.ratio >= SUSPECT && !bad.includes(t)) { bad.push(t); console.log(`  ${verdict(m.ratio)} ${t.id}: хвост/тело ${m.ratio.toFixed(2)}, ${m.dur.toFixed(2)}s — ${t.ky}`); }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    totalBad += bad.length;
    console.log(`${mod}: подозрительных ${bad.length} из ${list.length}`);

    if (FIX && bad.length) {
      for (const t of bad) {
        let fixed = false;
        for (let a = 1; a <= 4 && !fixed; a++) {
          if (!(await regen(t, a >= 3, overrides))) { console.log(`  ERR перегенерация ${t.id}`); break; }
          const m = await measure(t.id);
          const voiceOk = (await (await fetch(BASE + "/api/audio/" + bucket(t.id) + "/meta", { headers: { Authorization: AUTH } })).json())[t.id];
          const wantV = VOICE || voiceFor(t, REG);
          // лечение засчитывается по тому же критерию, каким дефект найден:
          // у дорожки звука — полнота повторов, у речи — затухание хвоста
          const wantP = isSoundTrack(t) ? wantPieces(t.ky) : 0;
          const ok = m && (isSoundTrack(t) ? m.pieces >= wantP : m.ratio < SUSPECT);
          if (ok && voiceOk && voiceOk.voice === wantV) {
            fixed = true; console.log(`  вылечен ${t.id} (попытка ${a}${a >= 3 ? ", Robust" : ""}): `
              + (isSoundTrack(t) ? `звуков ${m.pieces} из ${wantP}` : `затухание ${m.ratio.toFixed(2)}`) + `, голос ${wantV}`);
          }
        }
        if (fixed) totalFixed++; else totalStuck.push(t.id);
      }
    }
  }
  console.log(`\nИТОГО: подозрительных ${totalBad}` + (FIX ? `, вылечено ${totalFixed}, осталось ${totalStuck.length}` : " (перегенерация выключена: KGA1_FIX=1)"));
  if (totalStuck.length) console.log("не поддались (пробовать орфоэпическую перезапись текста): " + totalStuck.join(","));
  fs.rmSync(tmp, { recursive: true, force: true });
}

module.exports = { tailRatio, verdict, staleAgainstOverride, pieces, wantPieces, isSoundTrack, CUT, SUSPECT };
if (require.main === module) main();
