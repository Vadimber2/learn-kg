#!/usr/bin/env node
"use strict";
/* Быстрая проверка скрипта урока ДО генерации озвучки: те же правила, что в
   tests/pronunciation.test.js, но без полного прогона и без сборки приложения.
   Смысл — поймать ошибку до того, как она оплачена символами ElevenLabs.
   Запуск: node .claude/skills/kyrgyz-lessons/scripts/check-script.js deploy/lesson-m2-script.json
   Выход: 0 — чисто; 1 — список нарушений. Ничего не меняет. */
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) { console.error("укажи путь к скрипту урока"); process.exit(1); }
const S = JSON.parse(fs.readFileSync(file, "utf8"));
const LANGS = ["ru", "en", "tr"];
const ALPHABET = { ru: /[\p{Script=Cyrillic}]/u, en: /[A-Za-z]/, tr: /[A-Za-zçğıöşüâîûÇĞİÖŞÜÂÎÛ]/ };
const FOREIGN = {
  ru: /немецк|французск|турецк|арабск|испанск|умляут/i,
  en: /\b(French|German|Arabic|Spanish|Turkish|Russian|umlaut)\b/i,
  tr: /\b(Fransızca|Almanca|Arapça|İspanyolca|Rusça|Rus)\b/u,
};
const bad = [];
const at = (t, i) => t.id + "/" + (i + 1) + ": ";

if (!/^\d{4}-\d{2}-\d{2}$/.test(S.updated || "")) bad.push("updated не дата");
if (!S.lesson || !/^[a-z0-9-]{3,24}$/.test((S.lesson || {}).id || "")) bad.push("lesson.id не валиден");
for (const l of LANGS) {
  if (!((S.lesson || {}).title || {})[l]) bad.push("нет заголовка урока на " + l);
  if (!((S.lesson || {}).intro || {})[l]) bad.push("нет вступления урока на " + l);
}

let hasRepeat = -1, seg = 0;
for (const t of S.tracks || []) {
  if (!/^[a-z0-9]{1,12}$/.test(t.id || "")) bad.push("id трека не валиден: " + t.id);
  for (const l of LANGS) if (!(t.title || {})[l]) bad.push(t.id + ": нет заголовка на " + l);
  const segs = t.segments || [];
  if (segs.length < 2) bad.push(t.id + ": меньше двух сегментов");
  if (!segs.some((s) => s.kind === "explain")) bad.push(t.id + ": нет объяснения");
  if (!segs.some((s) => s.kind === "example")) bad.push(t.id + ": нет кыргызских примеров");
  if (!segs.filter((s) => s.kind === "example").some((s) => String(s.ky || "").trim().split(/\s+/).length >= 3))
    bad.push(t.id + ": нет примера-фразы из трёх слов и больше");
  if (segs.length && segs[segs.length - 1].gap !== true) bad.push(t.id + ": последний сегмент без gap");
  if (!Array.isArray(t.refs) || !t.refs.length) bad.push(t.id + ": нет refs");
  for (const r of t.refs || []) {
    if (!r.claim || r.claim.length < 15) bad.push(t.id + ": ref без внятного утверждения");
    if (!r.src || r.src.length < 10) bad.push(t.id + ": ref без источника");
    if (r.quote != null && r.quote.length < 15) bad.push(t.id + ": цитата короче 15 знаков");
  }
  if (!(t.refs || []).some((r) => r.quote) && !(t.refs || []).every((r) => /эмпирика|tests\//.test(r.src || "")))
    bad.push(t.id + ": ни одной дословной цитаты и не эмпирика курса");

  segs.forEach((s, i) => {
    seg++;
    if (!["explain", "example"].includes(s.kind)) bad.push(at(t, i) + "kind не explain и не example");
    if (s.repeat && hasRepeat < 0) hasRepeat = seg;
    if (s.repeat && s.gap) bad.push(at(t, i) + "gap и repeat на одном сегменте — пауза не наступит");
    if (s.kind === "explain") {
      if (s.say != null) bad.push(at(t, i) + "say в объяснении");
      for (const l of LANGS) {
        const txt = (s.text || {})[l];
        if (!txt) { bad.push(at(t, i) + "нет текста на " + l); continue; }
        if (txt.length > 480) bad.push(at(t, i) + l + ": длина " + txt.length + " > 480 (дорожка будет молча пропущена)");
        if (/[ңөү]/i.test(txt)) bad.push(at(t, i) + l + ": кыргызские буквы в объяснении");
        const alien = [...txt].filter((ch) => /\p{L}/u.test(ch) && !ALPHABET[l].test(ch));
        if (alien.length) bad.push(at(t, i) + l + ": буквы чужого алфавита " + JSON.stringify([...new Set(alien)]));
        if (FOREIGN[l].test(txt)) bad.push(at(t, i) + l + ": ориентир из чужого языка");
      }
      if (/\b(sing|song|singing)\b/i.test((s.text || {}).en || "")) bad.push(at(t, i) + "en: носовой написанным словом");
    } else {
      if (!String(s.ky || "").trim()) bad.push(at(t, i) + "пример без кыргызского текста");
      for (const l of LANGS) if (!(s.gloss || {})[l]) bad.push(at(t, i) + "нет глосса на " + l);
      if (s.say != null && (!/^[А-Яа-яЁёӨөҮүҢң .,!?—-]+$/.test(s.say) || s.say.length > 300))
        bad.push(at(t, i) + "say — только кириллическая орфоэпия до 300 знаков");
    }
  });
}
if (hasRepeat < 0) bad.push("в уроке нет сегмента практики (repeat)");
else if (hasRepeat === 1) bad.push("сегмент практики не может быть первым в уроке");

if (bad.length) { console.error("нарушений: " + bad.length + "\n- " + bad.join("\n- ")); process.exit(1); }
console.log("скрипт урока чист: треков " + (S.tracks || []).length + ", сегментов " + seg);
console.log("вычитку кыргызского против словаря курса делает npm test (pronunciation.test.js)");
