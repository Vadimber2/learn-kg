"use strict";
/* Промо-шортс learn.kg (челлендж владельца): 30 секунд, 9:16, для соцсетей.
   Ингредиенты — только своё: рисунки gpt-image в фирменном стиле «мел на доске»
   (deploy/promo-assets/*.png, генератор оставил владелец в истории), готовые
   апрувнутые озвучки фраз курса (никакого сочинённого кыргызского) и песня Suno
   из курса фоном. Сборка — ffmpeg: кен-бёрнс по кадрам, панчи настоящим текстом,
   голос поверх приглушённой музыки, fade в конце.
   Запуск: node deploy/make-promo.js → deploy/out/promo-learn-kg-ru.mp4 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const A = path.join(__dirname, "promo-assets");
const OUT = path.join(__dirname, "out");
const FONT = process.env.KGA1_FONT || "/Library/Fonts/Arial Unicode.ttf";
const FF = (() => {
  for (const c of [process.env.KGA1_FFMPEG, "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "ffmpeg"].filter(Boolean)) {
    try { if (execFileSync(c, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] }).toString().includes("drawtext")) return c; } catch (e) {}
  }
  console.error("нужен ffmpeg с drawtext"); process.exit(1);
})();
const run = (args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y"].concat(args), { stdio: ["ignore", "inherit", "inherit"] });

const CHALK = "#f2f6f8", ACCENT = "#ffd866", BG = "#11161b";
// Сцены: картинка + панч (верх) + кыргызская фраза с переводом (низ) + озвучка фразы.
// Тексты панчей — по смыслу лендинга; стоимость не упоминается (канон).
const SCENES = [
  { img: "yurt",  dur: 6, punch: "Живёшь в Кыргызстане,\nа кыргызский всё «потом»?", ky: null },
  { img: "hello", dur: 6, punch: "15 минут в день —\nи ты уже здороваешься", ky: "Салам! — привет", voice: "m0_01", vAt: 2.2 },
  { img: "tea",   dur: 6, punch: "Каждая фраза озвучена\nносителем языка", ky: "Рахмат! — спасибо", voice: "m0_18", vAt: 2.2 },
  { img: "lake",  dur: 6, punch: "Курсы A1–B1\nи подготовка к Кыргызтесту", ky: "Аш болсун!", voice: "m0_61", vAt: 2.2 },
];
const CTA_DUR = 6; // финал: learn.kg крупно

function wrapDT(work, i, text, size, color, y, extra) {
  const f = path.join(work, "t" + i + "-" + Math.round(y) + ".txt");
  fs.writeFileSync(f, text);
  return "drawtext=fontfile=" + FONT + ":textfile=" + f + ":fontsize=" + size +
    ":fontcolor=" + color + ":x=(w-text_w)/2:y=" + y + ":line_spacing=14" +
    ":borderw=6:bordercolor=" + BG + (extra || "");
}

function main() {
  if (!fs.existsSync(FONT)) { console.error("нет шрифта " + FONT); process.exit(1); }
  const work = fs.mkdtempSync(path.join(require("os").tmpdir(), "kga1-promo-"));
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Видеосцены: кен-бёрнс (медленный наезд) + панч сверху + фраза снизу
  const parts = [];
  SCENES.forEach((sc, i) => {
    const mp4 = path.join(work, "sc" + i + ".mp4");
    const fr = sc.dur * 30;
    let vf = "scale=1296:1944,zoompan=z='1.001+0.10*on/" + fr + "':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=" + fr + ":s=1080x1620:fps=30," +
      "pad=1080:1920:0:150:" + BG;
    vf += "," + wrapDT(work, i, sc.punch, 64, CHALK, 120);
    if (sc.ky) vf += "," + wrapDT(work, i, sc.ky, 66, ACCENT, 1720);
    vf += "," + wrapDT(work, i, "learn.kg", 36, "#9fb0bb", 1854);
    // вход — ОДИН кадр (без -loop/-t): zoompan сам порождает d кадров; поток на входе
    // размножается фильтром покадрово (наступил: час таймлайна и 236 МБ за «30 секунд»)
    run(["-i", path.join(A, sc.img + ".png"),
      "-filter_complex", vf, "-c:v", "libx264", "-crf", "26", "-preset", "medium",
      "-pix_fmt", "yuv420p", "-r", "30", "-an", mp4]);
    parts.push(mp4);
  });
  // финальный кадр CTA
  {
    const mp4 = path.join(work, "cta.mp4");
    let vf = "null," + wrapDT(work, 9, "learn.kg", 150, ACCENT, 800) +
      "," + wrapDT(work, 9, "Кыргызский — по-настоящему.\nДемо открыто без регистрации", 54, CHALK, 1030);
    run(["-f", "lavfi", "-i", "color=c=" + BG + ":s=1080x1920:r=30:d=" + CTA_DUR,
      "-vf", vf, "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-pix_fmt", "yuv420p", "-an", mp4]);
    parts.push(mp4);
  }
  const listF = path.join(work, "all.txt");
  fs.writeFileSync(listF, parts.map((p) => "file '" + p + "'").join("\n") + "\n");
  const vidOnly = path.join(work, "video.mp4");
  run(["-f", "concat", "-safe", "0", "-i", listF, "-c", "copy", vidOnly]);

  // 2. Звук: песня Suno фоном (приглушена, fade in/out) + фразы носителя в свои моменты
  const total = SCENES.reduce((s, x) => s + x.dur, 0) + CTA_DUR;
  const voiceIn = [];
  let off = SCENES[0].dur;
  const inputs = ["-i", vidOnly, "-i", path.join(A, "ph_song_mahabatym.mp3")];
  let fc = "[1]atrim=0:" + total + ",volume=0.35,afade=t=in:d=1.5,afade=t=out:st=" + (total - 2.5) + ":d=2.5[mus]";
  let idx = 2;
  for (const sc of SCENES.slice(1)) {
    inputs.push("-i", path.join(A, sc.voice + ".mp3"));
    fc += ";[" + idx + "]adelay=" + Math.round((off + sc.vAt) * 1000) + "|" + Math.round((off + sc.vAt) * 1000) + ",volume=1.9[v" + idx + "]";
    voiceIn.push("[v" + idx + "]");
    off += sc.dur; idx++;
  }
  fc += ";[mus]" + voiceIn.join("") + "amix=inputs=" + (1 + voiceIn.length) + ":normalize=0[a]";
  const out = path.join(OUT, "promo-learn-kg-ru.mp4");
  run(inputs.concat(["-filter_complex", fc, "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]));
  console.log("готово: " + out + " (" + (fs.statSync(out).size / 1048576).toFixed(1) + " МБ, " + total + " с)");
  fs.rmSync(work, { recursive: true, force: true });
}
main();
