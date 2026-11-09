"use strict";
/* Пароли учёток — scrypt-хэши (ревью кодовой базы 25.09.2026: раньше users.json и
   /data/users-extra.json хранили пароли открытым текстом, и утечка файла или бэкапа
   выдавала пароли всех учеников). Формат строки: scrypt$N$r$p$<соль b64>$<ключ b64>.
   Открытый пароль в файле принимается как наследие: сервер мигрирует его после старта
   (оверлей) или предупреждает в логе (база users.json правится руками).

   scrypt стоит десятки миллисекунд. Сервер однопоточный, поэтому вход формой и миграция
   считают его асинхронно (пул потоков libuv, основной поток свободен) — verifyPasswordAsync,
   hashPasswordAsync. Синхронная проверка осталась только для заголовка Basic: он сверяется
   внутри синхронного разбора запроса; удачные пары там берутся из кэша, неудачные
   ограничены лимитом попыток (basicLimiter в server.js).
   Кэш удачных проверок — по паре (хэш, sha256 пароля): смена пароля меняет хэш, и старая
   запись просто перестаёт совпадать. Вытесняется самая старая запись (LRU). */
const crypto = require("crypto");

const N = 16384, R = 8, P = 1, KEYLEN = 32;
const PREFIX = "scrypt$";
const OK_CACHE = new Map();
const CACHE_MAX = 2000;

function timingEq(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ab.length !== bb.length) { crypto.timingSafeEqual(bb, bb); return false; }
  return crypto.timingSafeEqual(ab, bb);
}

function isHashed(s) { return typeof s === "string" && s.startsWith(PREFIX); }

const encode = (salt, dk) => [PREFIX.slice(0, -1), N, R, P, salt.toString("base64"), dk.toString("base64")].join("$");
const scryptAsync = (pass, salt, len, opts) =>
  new Promise((ok, fail) => crypto.scrypt(pass, salt, len, opts, (e, k) => (e ? fail(e) : ok(k))));

function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  return encode(salt, crypto.scryptSync(String(pass), salt, KEYLEN, { N, r: R, p: P }));
}
async function hashPasswordAsync(pass) {
  const salt = crypto.randomBytes(16);
  return encode(salt, await scryptAsync(String(pass), salt, KEYLEN, { N, r: R, p: P }));
}

/* Общая часть проверки: наследие, кэш, разбор строки. Возвращает готовый ответ (done)
   или то, что осталось посчитать scrypt'ом, — синхронно или асинхронно. */
function prepare(stored, pass) {
  if (typeof stored !== "string" || !stored) return { done: false };
  if (!isHashed(stored)) return { done: timingEq(stored, pass) };   // наследие: открытый пароль
  const key = stored + "\0" + crypto.createHash("sha256").update(String(pass)).digest("hex");
  if (OK_CACHE.has(key)) { OK_CACHE.delete(key); OK_CACHE.set(key, true); return { done: true }; }   // LRU: свежие — в конец
  const parts = stored.split("$");
  if (parts.length !== 6) return { done: false };
  const [, n, r, p, saltB64, dkB64] = parts;
  const want = Buffer.from(dkB64, "base64");
  if (!want.length) return { done: false };
  return { key, want, salt: Buffer.from(saltB64, "base64"),
    opts: { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 } };
}
function settle(job, got) {
  const ok = got.length === job.want.length && crypto.timingSafeEqual(got, job.want);
  // вытесняется самая старая запись, а не весь кэш: сброс разом дал бы волну scrypt подряд
  if (ok) {
    if (OK_CACHE.size >= CACHE_MAX) OK_CACHE.delete(OK_CACHE.keys().next().value);
    OK_CACHE.set(job.key, true);
  }
  return ok;
}

function verifyPassword(stored, pass) {
  const job = prepare(stored, pass);
  if ("done" in job) return job.done;
  try { return settle(job, crypto.scryptSync(String(pass), job.salt, job.want.length, job.opts)); }
  catch { return false; }
}
async function verifyPasswordAsync(stored, pass) {
  const job = prepare(stored, pass);
  if ("done" in job) return job.done;
  try { return settle(job, await scryptAsync(String(pass), job.salt, job.want.length, job.opts)); }
  catch { return false; }
}

// Хэш, с которым сверяется неизвестный логин: та же цена scrypt, но совпасть не может —
// пароль случайный и нигде не хранится (равное время ответа для «нет логина» и «неверный пароль»)
const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString("hex"));

module.exports = { hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync, isHashed, timingEq, DUMMY_HASH };
