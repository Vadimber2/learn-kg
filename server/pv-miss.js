"use strict";
/* Ненайденные запросы переводчика /perevodchik — спрос, которого в курсе нет.
   Только данные: агрегат {"<lang>\t<запрос>": {n, first, last}} в одном файле, без IP,
   cookie и времени до секунды. Похожее на контакт (телефон, почта, ссылка) не храним
   вовсе: люди вставляют в переводчик что угодно. HTTP и лимиты — в server.js.
   Нормализацию ключа даёт вызывающий — pvNorm самой страницы (PV_FN в site.js), чтобы
   клиент и сервер считали одну фразу одним запросом. Срока хранения нет (решение владельца
   11.10.2026: редкий запрос тоже кандидат в разговорник); потолок ключей — против мусорного
   потока (старые счётчики растут дальше, ~100 байт на ключ). */
const fs = require("fs");

const LIMITS = Object.freeze({ MAX_RAW: 200, MAX_Q: 120, MIN_Q: 2, MAX_KEYS: 50000 });
const LANGS = ["ru", "en", "tr"];
// телефон — пять цифр подряд после снятия разделителей; почта и ссылка — по самому тексту
const looksPersonal = (q) => /@|https?:|www\./.test(q) || /\d{5}/.test(q.replace(/[\s()+.-]/g, ""));

function validateMiss(d, norm) {
  if (!d || typeof d.q !== "string" || !LANGS.includes(d.lang)) return { error: "bad input" };
  if (d.q.length > LIMITS.MAX_RAW) return { error: "too long" }; // до нормализации: мусор не гоняем
  const q = norm(d.q);
  if (q.length < LIMITS.MIN_Q) return { error: "too short" };
  if (q.length > LIMITS.MAX_Q) return { error: "too long" };
  if (looksPersonal(d.q)) return { skip: true }; // по исходному тексту: нормализация стирает @ : . в пробелы
  return { q, lang: d.lang };
}

// dayKey(ms) → "YYYY-MM-DD" (сервер даёт день по Бишкеку, как у всех дневных ключей);
// maxKeys — параметр ради теста: потолок в 50 000 заполнять честно — квадрат сериализаций
function createMissStore({ file, atomicWrite, dayKey, now = () => Date.now(), maxKeys = LIMITS.MAX_KEYS }) {
  let items = {};
  try { items = JSON.parse(fs.readFileSync(file, "utf8")).items || {}; } catch { /* нет файла — пустой агрегат */ }
  const keyOf = (lang, q) => lang + "\t" + q;
  const save = () => atomicWrite(file, JSON.stringify({ v: 1, items }));
  // синхронная запись на каждый промах: поток мал (лимит по IP в server.js), потерь при рестарте нет
  function note(lang, q) {
    const key = keyOf(lang, q), d = dayKey(now()), e = items[key];
    if (e) { e.n++; e.last = d; }
    else {
      if (Object.keys(items).length >= maxKeys) return false;
      items[key] = { n: 1, first: d, last: d };
    }
    save();
    return true;
  }
  // удаление по просьбе (политика конфиденциальности): ключ — как его показал top()
  function remove(lang, q) {
    const key = keyOf(lang, q);
    if (!items[key]) return false;
    delete items[key];
    save();
    return true;
  }
  // самые частые первыми, при равенстве — свежие
  const top = () => Object.entries(items)
    .map(([k, e]) => { const i = k.indexOf("\t"); return { lang: k.slice(0, i), q: k.slice(i + 1), ...e }; })
    .sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));
  return { note, remove, top };
}

module.exports = { LIMITS, createMissStore, validateMiss };
