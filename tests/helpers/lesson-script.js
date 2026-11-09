"use strict";
/* Общие примитивы гейтов аудиоуроков (tests/lessons.test.js и tests/pronunciation.test.js):
   одна нормализация кыргызских высказываний и один способ собрать словарь слов
   примеров скрипта — чтобы правила «дословно из скрипта» в обоих гейтах не расходились. */

// нормализация: регистр, пунктуация, кратные пробелы
const norm = (s) => s.toLowerCase().replace(/[!?.,;:—–…"«»()]/g, " ").replace(/\s+/g, " ").trim();

// все слова кыргызских примеров скрипта урока (после нормализации)
function exampleWords(S) {
  const out = new Set();
  for (const t of S.tracks) for (const seg of t.segments.filter((x) => x.kind === "example"))
    for (const w of norm(seg.ky).split(" ")) if (w) out.add(w);
  return out;
}

module.exports = { norm, exampleWords };
