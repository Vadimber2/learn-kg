"use strict";
/* Пересборка реестров уроков из скриптов озвучки. Один скрипт = один модуль;
   соответствие задаёт реестр LESSON_SCRIPTS ниже — его же читают
   tests/lessons.test.js, tests/pronunciation.test.js и deploy/gen-pronunciation.js
   (новый урок = скрипт + строка здесь). Транскрипция в уроке и текст, которым
   озвучено аудио, обязаны быть одним источником — правки вносить в скрипт и
   перегенерировать: node deploy/gen-lessons.js.
   m0 живёт в общем data/lessons.js (const LESSONS — он есть в каждом варианте),
   уроки модулей M1+ — в data/lessons/m<n>.js (LESSONS.m<n> = …): транскрипт урока —
   материал курса, часть едет только в варианты своего модуля (фильтр в appshell). */
const fs = require("fs"), path = require("path");

const LESSON_SCRIPTS = {
  m0: "pronunciation-script.json",
  m1: "lesson-m1-script.json",
  m2: "lesson-m2-script.json",
};

// Скрипт → запись реестра LESSONS (тот же вывод сегментов, что ждёт lessons.test.js)
function compileLesson(S) {
  const themes = [], segs = [];
  for (const t of S.tracks) {
    themes.push({ id: t.id, title: t.title });
    t.segments.forEach((seg, i) => {
      const n = String(i + 1).padStart(2, "0");
      const s = { theme: t.id, kind: seg.kind, a: "ph_" + t.id + "_" + n };
      if (seg.kind === "explain") { s.perLang = true; s.text = seg.text; }
      else { s.ky = seg.ky; s.gloss = seg.gloss; }
      if (seg.repeat) s.repeat = true;   // пауза на повтор вслух
      if (seg.gap) s.gap = true;         // небольшая пауза перед следующей темой
      segs.push(s);
    });
  }
  const L = S.lesson || {};
  // Роль голоса урока едет в реестр: по ней deploy/audit-audio.js понимает, какой
  // голос ждать от уроковых дорожек (у курса по умолчанию мужской, урок читает женский).
  return { id: L.id, title: L.title, intro: L.intro, voiceRole: S.voiceRole, themes, segments: segs };
}

function main() {
  for (const [mod, file] of Object.entries(LESSON_SCRIPTS)) {
    const S = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
    const lesson = compileLesson(S);
    if (mod === "m0") {
      const p = path.join(__dirname, "..", "app", "src", "data", "lessons.js");
      const prev = fs.readFileSync(p, "utf8");
      const head = prev.slice(0, prev.indexOf("const LESSONS = "));
      fs.writeFileSync(p, head + "const LESSONS = " + JSON.stringify({ m0: lesson }, null, 1) +
        ";\n/* ===/LESSONS=== */\n");
    } else {
      const p = path.join(__dirname, "..", "app", "src", "data", "lessons", mod + ".js");
      fs.writeFileSync(p,
        "/* ===LESSON-DATA:" + mod + "=== Урок модуля " + mod + ". ГЕНЕРИРУЕТСЯ из deploy/" + file + "\n" +
        "   (deploy/gen-lessons.js) — не редактировать руками; слайды тем — в " + mod + "-slides.js. */\n" +
        "LESSONS." + mod + " = " + JSON.stringify(lesson, null, 1) + ";\n" +
        "/* ===/LESSON-DATA:" + mod + "=== */\n");
    }
    console.log(mod + ": тем " + lesson.themes.length + ", сегментов " + lesson.segments.length);
  }
}

module.exports = { LESSON_SCRIPTS };
if (require.main === module) main();
