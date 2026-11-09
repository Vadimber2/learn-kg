"use strict";
/* mp4-экспорт аудиоурока: слайды + озвучка → видео для YouTube (решение владельца,
   публикация — руками владельца). Первый урок — произношение (m0/phonetics).

   Источники — те же, что у приложения (единый источник правды):
   - deploy/pronunciation-script.json — порядок тем и сегментов; id аудио строится
     тем же правилом, что в gen-pronunciation.js: ph_<тема>_<NN>[_<lang>];
   - app/src/data/lesson-slides.js — панели слайдов (буквы top + слова с глоссами);
   - app/lessons/<img>.webp — рисунки «мел на доске» (в кадре без изменений);
   - аудио скачивается с прода: дорожки ph_* публичны (демо-набор анонима).

   Текст панелей кладётся НАСТОЯЩИМ текстом через drawtext (тот же урок, что в
   слайдах приложения: модели врут в буквах, поэтому буквы — только текстом).

   Запуск:  node deploy/make-video.js            # русская дорожка, 1920×1080
            KGA1_VIDEO_LANG=en node deploy/make-video.js
            KGA1_VIDEO_FORMAT=shorts node deploy/make-video.js
   Формат shorts (просьба владельца, материал для соцсетей преподавателя):
   вертикаль 1080×1920, по ролику НА ТЕМУ (~40–70 с — лимит YouTube Shorts),
   выход lesson-<слаг>-<тема>-<lang>-shorts.mp4 (слаг = lesson.id скрипта без дефисов). Суффикс -shorts осознанный:
   карточка приложения фильтрует по -(ru|en|tr).mp4 и шортсы в плеер не тянет —
   они видны преподавателю отдельным списком «скачать».
   Требует ffmpeg с drawtext. Кэш скачанного аудио — deploy/video-cache/ (не в репо). */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
// Урок — env KGA1_LESSON=<mod> (по умолчанию m0); соответствие — реестр в gen-lessons.js.
// Видео нового урока делается только ПОСЛЕ оценки аудиоурока владельцем (правило 20.08.2026).
const { LESSON_SCRIPTS } = require("./gen-lessons");
const SCRIPT = path.join(__dirname, LESSON_SCRIPTS[process.env.KGA1_LESSON || "m0"]);
const SLIDES_SRC = path.join(ROOT, "app", "src", "data", "lesson-slides.js");
const LESSONS_DIR = path.join(ROOT, "app", "lessons");
const CACHE = path.join(__dirname, "video-cache");
const OUT_DIR = path.join(__dirname, "out");
const BASE = process.env.KGA1_BASE || "https://learn.kg";
const FONT = process.env.KGA1_FONT || "/Library/Fonts/Arial Unicode.ttf";

// Палитра кадра — канон доски: тёмный фон в любой теме, «мел» светлым, буквы — акцентом
const BG = "#11161b", CHALK = "#e8eef2", ACCENT = "#ffd866", MUTED = "#9fb0bb";
const PAUSE_SEG = 0.7, PAUSE_INTRO = 2.8, PAUSE_OUTRO = 4.0; // секунды

// Слайды приложения: общий файл + части уроков M1+ (data/lessons/*-slides.js
// дописывают LESSON_SLIDES через Object.assign) — исполняем их все по порядку
function loadSlides() {
  const dir = path.join(ROOT, "app", "src", "data", "lessons");
  let src = fs.readFileSync(SLIDES_SRC, "utf8");
  if (fs.existsSync(dir))
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-slides.js")).sort())
      src += "\n" + fs.readFileSync(path.join(dir, f), "utf8");
  const vm = require("vm");
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(src + "; this.OUT = LESSON_SLIDES;", sb);
  return sb.OUT;
}

/* План ролика — чистая функция (гоняется тестом без ffmpeg и сети): для каждой темы
   скрипта — тексты панелей слайда и список аудио-id в порядке прослушивания.
   Правило id обязано совпадать с генератором озвучки — расхождение = немой сегмент. */
function planFor(lang, S, slides) {
  const themes = [];
  for (const t of S.tracks) {
    const audio = t.segments.map((seg, i) => {
      const n = String(i + 1).padStart(2, "0");
      return seg.kind === "explain" ? "ph_" + t.id + "_" + n + "_" + lang : "ph_" + t.id + "_" + n;
    });
    const sl = slides[t.id] || { img: null, top: [], items: [] };
    themes.push({
      id: t.id,
      title: t.title[lang] || t.title.ru,
      img: sl.img,
      top: sl.top || [],
      // у слова может не быть глосса (пары орфография/орфоэпия в p7) — тогда только кыргызский
      items: (sl.items || []).map((it) => it.ky
        ? it.ky + (it.gloss ? " — " + (it.gloss[lang] || it.gloss.ru) : "")
        : ((it.cap && (it.cap[lang] || it.cap.ru)) || "")).filter(Boolean),
      audio,
    });
  }
  return themes;
}

/* Слайдам нужен drawtext, а брю-формула ffmpeg собрана без freetype (проверено:
   9.0.1 не знает фильтра) — текст умеет keg-only ffmpeg-full. Берём первый бинарь
   с drawtext; KGA1_FFMPEG перебивает выбор явно. */
let FFMPEG = null; // лениво: тесты require'ят planFor и без ffmpeg
function ffmpegBin() {
  if (FFMPEG) return FFMPEG;
  const cands = [process.env.KGA1_FFMPEG, "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "ffmpeg"].filter(Boolean);
  for (const c of cands) {
    try {
      if (execFileSync(c, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] }).toString().includes("drawtext")) return (FFMPEG = c);
    } catch (e) {}
  }
  console.error("не найден ffmpeg с фильтром drawtext (brew install ffmpeg-full, либо KGA1_FFMPEG=<путь>)");
  process.exit(1);
}
function run(args) { execFileSync(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y"].concat(args), { stdio: ["ignore", "inherit", "inherit"] }); }
// длительность готовой части — ffprobe лежит рядом с выбранным ffmpeg
function durOf(file) {
  const probe = ffmpegBin().replace(/ffmpeg$/, "ffprobe");
  return parseFloat(execFileSync(probe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
}

async function fetchAudio(id) {
  const f = path.join(CACHE, id + ".mp3");
  if (fs.existsSync(f) && fs.statSync(f).size > 0) return f;
  const r = await fetch(BASE + "/api/audio/m0/" + id + ".mp3");
  if (!r.ok) throw new Error("HTTP " + r.status + " на " + id + " — дорожка не опубликована?");
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}

// textfile для drawtext: никакого экранирования спецсимволов в командной строке
let tfN = 0;
function textFile(dir, text) {
  const f = path.join(dir, "t" + (tfN++) + ".txt");
  fs.writeFileSync(f, text);
  return f;
}

// Слайд темы: рисунок по центру, заголовок сверху, буквы top акцентом, слова снизу
function makeSlide(work, theme) {
  const png = path.join(work, "slide-" + theme.id + ".png");
  const parts = [];
  let chain = "[1]scale=-1:600[img];[0][img]overlay=(W-w)/2:236";
  const dt = (file, size, color, y, extra) =>
    "drawtext=fontfile=" + FONT + ":textfile=" + file + ":fontsize=" + size +
    ":fontcolor=" + color + ":x=(w-text_w)/2:y=" + y + (extra || "");
  chain += "," + dt(textFile(work, theme.title), 52, CHALK, 64);
  if (theme.top.length) chain += "," + dt(textFile(work, theme.top.join("   ")), 96, ACCENT, 132);
  if (theme.items.length) chain += "," + dt(textFile(work, theme.items.join("\n")), 44, CHALK, 872, ":line_spacing=18");
  // подпись — в правый нижний угол: по центру она наезжала на третью строку слов
  chain += ",drawtext=fontfile=" + FONT + ":textfile=" + textFile(work, "learn.kg") +
    ":fontsize=30:fontcolor=" + MUTED + ":x=w-text_w-48:y=h-52";
  run(["-f", "lavfi", "-i", "color=c=" + BG + ":s=1920x1080",
    "-i", path.join(LESSONS_DIR, theme.img + ".webp"),
    "-filter_complex", chain, "-frames:v", "1", png]);
  return png;
}

// drawtext не переносит строки сам: длинный заголовок режем по словам
function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

// Вертикальный слайд темы (шортс): тот же материал, компоновка под 1080×1920;
// подпись выше низа — нижнюю кромку в Shorts перекрывает интерфейс платформы
function makeSlideShorts(work, theme) {
  const png = path.join(work, "slide-" + theme.id + "-s.png");
  let chain = "[1]scale=960:-1[img];[0][img]overlay=(W-w)/2:640";
  const dt = (file, size, color, y, extra) =>
    "drawtext=fontfile=" + FONT + ":textfile=" + file + ":fontsize=" + size +
    ":fontcolor=" + color + ":x=(w-text_w)/2:y=" + y + (extra || "");
  chain += "," + dt(textFile(work, wrapText(theme.title, 26)), 58, CHALK, 160, ":line_spacing=16");
  if (theme.top.length) chain += "," + dt(textFile(work, theme.top.join("   ")), 118, ACCENT, 420);
  if (theme.items.length) chain += "," + dt(textFile(work, theme.items.join("\n")), 50, CHALK, 1330, ":line_spacing=26");
  chain += "," + dt(textFile(work, "learn.kg"), 42, MUTED, 1680);
  run(["-f", "lavfi", "-i", "color=c=" + BG + ":s=1080x1920",
    "-i", path.join(LESSONS_DIR, theme.img + ".webp"),
    "-filter_complex", chain, "-frames:v", "1", png]);
  return png;
}

// Титульный/финальный кадр (заставка): только текст на доске. Длинный титул
// урока переносится по словам, и каждая строка центруется своим drawtext —
// многострочный textfile ffmpeg рисует левым краем блока, «хвост» повисал слева.
function makeCard(work, name, lines) {
  const png = path.join(work, name + ".png");
  let chain = "null";
  let y = 400;
  for (const line of lines) {
    for (const row of wrapText(line.text, 34).split("\n")) {
      chain += ",drawtext=fontfile=" + FONT + ":textfile=" + textFile(work, row) +
        ":fontsize=" + line.size + ":fontcolor=" + line.color + ":x=(w-text_w)/2:y=" + y;
      y += line.size + 14;
    }
    y += 34;
  }
  run(["-f", "lavfi", "-i", "color=c=" + BG + ":s=1920x1080", "-vf", chain, "-frames:v", "1", png]);
  return png;
}

// Сегмент ролика: картинка + его аудио (concat mp3 с паузами) → одинаково кодированный mp4
function makePart(work, name, png, audioFiles, silence) {
  const listF = path.join(work, name + ".txt");
  const rows = [];
  for (const a of audioFiles) { rows.push("file '" + a + "'"); rows.push("file '" + silence + "'"); }
  fs.writeFileSync(listF, rows.join("\n") + "\n");
  const mp4 = path.join(work, name + ".mp4");
  run(["-loop", "1", "-i", png, "-f", "concat", "-safe", "0", "-i", listF,
    "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-shortest", mp4]);
  return mp4;
}

async function main() {
  const lang = process.env.KGA1_VIDEO_LANG || "ru";
  if (!["ru", "en", "tr"].includes(lang)) { console.error("KGA1_VIDEO_LANG: ru|en|tr"); process.exit(1); }
  if (!fs.existsSync(FONT)) { console.error("нет шрифта " + FONT + " (KGA1_FONT=<путь к ttf с кириллицей и ө/ү/ң>)"); process.exit(1); }
  const S = JSON.parse(fs.readFileSync(SCRIPT, "utf8"));
  // Слаг файлов — id урока без дефисов: имена парсит клиент (videoShortsTheme
  // ждёт lesson-<слаг>-<тема>-<lang>-shorts, дефис внутри слага сломал бы разбор)
  const SLUG = (S.lesson.id || "").replace(/-/g, "");
  if (!SLUG) { console.error("в скрипте нет lesson.id"); process.exit(1); }
  // Заставка — из титула урока «Урок N. Название» (тот же текст, что в приложении):
  // название крупно, «Урок N · learn.kg» акцентом — как в уроке 1
  const OUTRO = { ru: "Тренажёр кыргызского языка", en: "The Kyrgyz language trainer", tr: "Kırgızca alıştırma platformu" };
  const full = S.lesson.title[lang] || S.lesson.title.ru;
  const L = { [lang]: {
    title: full.replace(/^[^.]*\.\s*/, ""),
    sub: (full.match(/^[^.]*/) || [""])[0] + " · learn.kg",
    outro: OUTRO[lang], cta: "learn.kg",
  } };
  const themes = planFor(lang, S, loadSlides());

  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(require("os").tmpdir(), "kga1-video-"));

  console.log("аудио: скачивание " + themes.reduce((s, t) => s + t.audio.length, 0) + " дорожек из " + BASE + " …");
  for (const t of themes) for (const id of t.audio) await fetchAudio(id);

  // пауза между сегментами — один mp3, склеивается concat-демуксером наравне с речью
  const silence = path.join(work, "sil.mp3");
  run(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(PAUSE_SEG), "-c:a", "libmp3lame", "-b:a", "192k", silence]);

  // Шортсы: вертикальный ролик на каждую тему, без заставок — сразу материал.
  // Рядом — jpg-постер (слайд в пол-размера): плитки в приложении показывают
  // картинку, а видео грузится только по клику (решение владельца о трафике).
  if (process.env.KGA1_VIDEO_FORMAT === "shorts") {
    for (const t of themes) {
      console.log("шортс " + t.id + ": " + t.title);
      const png = makeSlideShorts(work, t);
      const mp4 = makePart(work, "s-" + t.id, png, t.audio.map((id) => path.join(CACHE, id + ".mp3")), silence);
      const base2 = path.join(OUT_DIR, "lesson-" + SLUG + "-" + t.id + "-" + lang + "-shorts");
      run(["-i", mp4, "-c", "copy", "-movflags", "+faststart", base2 + ".mp4"]);
      run(["-i", png, "-vf", "scale=540:-1", "-q:v", "5", base2 + ".jpg"]);
      console.log("  → " + base2 + ".mp4 (" + (fs.statSync(base2 + ".mp4").size / 1048576).toFixed(1) + " МБ)");
    }
    fs.rmSync(work, { recursive: true, force: true });
    return;
  }
  const longSil = (sec, name) => { const f = path.join(work, name); run(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(sec), "-c:a", "libmp3lame", "-b:a", "192k", f]); return f; };

  const parts = [];
  const introPng = makeCard(work, "intro", [
    { text: L[lang].title, size: 72, color: CHALK },
    { text: L[lang].sub, size: 40, color: ACCENT }]);
  parts.push(makePart(work, "p00-intro", introPng, [longSil(PAUSE_INTRO, "sil-intro.mp3")], silence));

  // Главы: тема ролика = тема урока; тайминг — фактическая длительность частей
  // (ffprobe), не расчёт по mp3: у склейки в aac появляется прайминг-сдвиг.
  const chapters = [];
  let acc = durOf(parts[0]);
  for (const [i, t] of themes.entries()) {
    console.log("тема " + t.id + ": " + t.title);
    const png = makeSlide(work, t);
    const mp4 = makePart(work, "p" + String(i + 1).padStart(2, "0") + "-" + t.id, png,
      t.audio.map((id) => path.join(CACHE, id + ".mp3")), silence);
    parts.push(mp4);
    chapters.push({ id: t.id, start: Math.round(acc) });
    acc += durOf(mp4);
  }

  const outroPng = makeCard(work, "outro", [
    { text: L[lang].cta, size: 96, color: ACCENT },
    { text: L[lang].outro, size: 44, color: CHALK }]);
  parts.push(makePart(work, "p99-outro", outroPng, [longSil(PAUSE_OUTRO, "sil-outro.mp3")], silence));

  const allF = path.join(work, "all.txt");
  fs.writeFileSync(allF, parts.map((p) => "file '" + p + "'").join("\n") + "\n");
  const out = path.join(OUT_DIR, "lesson-" + SLUG + "-" + lang + ".mp4");
  run(["-f", "concat", "-safe", "0", "-i", allF, "-c", "copy", "-movflags", "+faststart", out]);

  // главы кладём рядом с роликом — upload-video.js зальёт их в мету раздачи;
  // jpg-постер (титульный кадр) — чтобы плеер жил с preload="none" без серого экрана
  fs.writeFileSync(out.replace(/\.mp4$/, ".chapters.json"), JSON.stringify(chapters));
  run(["-i", introPng, "-vf", "scale=960:-1", "-q:v", "5", out.replace(/\.mp4$/, ".jpg")]);
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log("готово: " + out + " (" + mb + " МБ, глав: " + chapters.length + ")");
  fs.rmSync(work, { recursive: true, force: true });
}

module.exports = { planFor };
if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
