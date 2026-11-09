"use strict";
/* Чат с преподавателем: хранилище тредов в DATA_DIR/inbox/<id>.json.
   Только файлы и данные — ни крипто, ни HTTP (это server/inbox-auth.js и маршруты в
   server.js). Файлы — единственный источник истины; индекс сводок живёт в памяти
   процесса и пересобирается сканом каталога (одна реплика, синхронный I/O — как журнал
   занятий). Формат треда аддитивен (v:1): незнакомые поля старый сервер не читает.
   {v, id, kind: visitor|student, login?, lang, firstPage, contact,
    messages:[{id, ts, from: visitor|teacher, by?, text}],
    seenByTeacherAt, seenByVisitorAt, createdAt, updatedAt} */
const fs = require("fs");
const path = require("path");
const { CHAT_ID_RE } = require("./inbox-id");

const LIMITS = Object.freeze({
  MAX_TEXT: 2000, MAX_CONTACT: 120, MAX_PAGE: 200, MAX_MSGS: 200, MAX_VISITOR_THREADS: 2000,
  KEEP_UNANSWERED_DAYS: 90, KEEP_ANSWERED_DAYS: 365,
});
const LANGS = ["ru", "en", "tr"];
// путь сайта: один ведущий слэш и не точка после него («//host» — чужой адрес, «/./» — мусор)
const PAGE_RE = /^\/(?:[a-zA-Z0-9_-][a-zA-Z0-9_\-\/.]*)?$/;
const DAY = 86400000;

function createInboxStore({ dir, atomicWrite, rid, logger }) {
  let index = null; // Map id → сводка; null — ещё не сканировали

  const file = (id) => path.join(dir, id + ".json");
  const now = () => new Date().toISOString();

  function validateInput(d) {
    const text = typeof d.text === "string" ? d.text.trim() : "";
    if (!text) return { error: "empty text" };
    if (text.length > LIMITS.MAX_TEXT) return { error: "text too long" };
    const contact = typeof d.contact === "string" ? d.contact.trim() : "";
    if (contact.length > LIMITS.MAX_CONTACT) return { error: "contact too long" };
    const lang = LANGS.includes(d.lang) ? d.lang : "ru";
    const p = typeof d.page === "string" ? d.page : "";
    const page = p.length <= LIMITS.MAX_PAGE && PAGE_RE.test(p) ? p : "";
    return { text, contact, lang, page };
  }

  function readThread(id) {
    if (!CHAT_ID_RE.test(String(id))) return null;
    try { return JSON.parse(fs.readFileSync(file(id), "utf8")); } catch { return null; }
  }
  function summaryOf(t) {
    const last = t.messages[t.messages.length - 1] || null;
    return { id: t.id, kind: t.kind, login: t.login || null, lang: t.lang, firstPage: t.firstPage || "", contact: t.contact || "",
      createdAt: t.createdAt, updatedAt: t.updatedAt, count: t.messages.length, unread: unreadFor(t, "teacher"),
      last: last ? { ts: last.ts, from: last.from, text: String(last.text).slice(0, 120) } : null };
  }
  function ensureIndex() {
    if (index) return index;
    index = new Map();
    let names = [];
    try { names = fs.readdirSync(dir); } catch {}
    for (const n of names) {
      if (!n.endsWith(".json")) continue;
      const t = readThread(n.slice(0, -5));
      if (t && t.messages) index.set(t.id, summaryOf(t));
    }
    return index;
  }
  function writeThread(t) {
    atomicWrite(file(t.id), JSON.stringify(t));
    ensureIndex().set(t.id, summaryOf(t));
  }
  function newThread({ id, kind, login, lang, firstPage, contact }) {
    const ts = now();
    const t = { v: 1, id, kind, lang: lang || "ru", firstPage: firstPage || "", contact: contact || "",
      messages: [], seenByTeacherAt: null, seenByVisitorAt: null, createdAt: ts, updatedAt: ts };
    if (login) t.login = login;
    writeThread(t);
    return t;
  }
  function appendMessage(t, from, text, by) {
    const msg = { id: rid(), ts: now(), from, text };
    if (by) msg.by = by;
    t.messages = t.messages.concat([msg]).slice(-LIMITS.MAX_MSGS);
    t.updatedAt = msg.ts;
    if (from === "teacher") t.seenByTeacherAt = msg.ts; // ответ = прочитано
    writeThread(t);
    return msg;
  }
  // непрочитанное стороной who: сообщения другой стороны позже её отметки seen
  function unreadFor(t, who) {
    const other = who === "teacher" ? "visitor" : "teacher";
    const seen = who === "teacher" ? t.seenByTeacherAt : t.seenByVisitorAt;
    return t.messages.filter((m) => m.from === other && (!seen || m.ts > seen)).length;
  }
  // Отметка «прочитано» — не раньше ts последнего показанного письма другой стороны:
  // письмо той же миллисекунды или с часов, ушедших вперёд, иначе осталось бы «непрочитанным»
  function markSeen(t, who) {
    const other = who === "teacher" ? "visitor" : "teacher";
    const last = t.messages.filter((m) => m.from === other).pop();
    const at = last && last.ts > now() ? last.ts : now();
    if (who === "teacher") t.seenByTeacherAt = at; else t.seenByVisitorAt = at;
    writeThread(t);
  }
  // Логин переиспользован (ученика удалили и завели заново): переписка прежнего владельца
  // уходит в архив рядом с прогрессом и журналом — новому она не принадлежит
  function archive(id) {
    if (!readThread(id)) return false;
    const bak = file(id) + "." + new Date().toISOString().replace(/[:.]/g, "-") + ".bak";
    try { fs.renameSync(file(id), bak); } catch (e) { logger.warn("chat", "archive failed", { id, error: e.message }); return false; }
    ensureIndex().delete(id);
    logger.info("chat", "archived on login reuse", { id });
    return true;
  }
  // Правки ПО ID: маршрут читает снимок треда до ожидания тела запроса, а запись заменяет файл
  // целиком — параллельное сообщение в тот же тред терялось бы (валидатор 05.09.2026).
  // Перечитываем файл непосредственно перед записью, одним синхронным шагом.
  function appendMessageById(id, from, text, by) {
    const t = readThread(id);
    return t ? appendMessage(t, from, text, by) : null;
  }
  function markSeenById(id, who) {
    const t = readThread(id);
    if (t) markSeen(t, who);
    return !!t;
  }
  function listSummaries() {
    return [...ensureIndex().values()].sort((a, b) =>
      (b.unread > 0) - (a.unread > 0) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }
  function unreadForTeacher() {
    let threads = 0, messages = 0;
    for (const s of ensureIndex().values()) if (s.unread > 0) { threads++; messages += s.unread; }
    return { threads, messages };
  }
  const forget = (id) => { ensureIndex().delete(id); }; // файл исчез (ретеншн) — сводка тоже
  const countVisitorThreads = () => [...ensureIndex().values()].filter((s) => s.kind === "visitor").length;
  // Ретеншн: визитёрские треды без ответа — 90 дней, с ответом — 365; ученические живут с учёткой.
  // Возвращает число удалённых. Вызывается по таймеру (не из запроса — скан каталога блокирует цикл).
  function sweep(nowMs) {
    let removed = 0;
    for (const s of [...ensureIndex().values()]) {
      if (s.kind !== "visitor") continue;
      const t = readThread(s.id);
      if (!t) { index.delete(s.id); continue; }
      const answered = t.messages.some((m) => m.from === "teacher");
      const keep = (answered ? LIMITS.KEEP_ANSWERED_DAYS : LIMITS.KEEP_UNANSWERED_DAYS) * DAY;
      if (nowMs - Date.parse(t.updatedAt) > keep) {
        try { fs.unlinkSync(file(t.id)); removed++; } catch (e) { logger.error("chat", "sweep unlink failed", e, { id: t.id }); }
        index.delete(t.id);
      }
    }
    // архивы (.bak после переиспользования логина) — по сроку хранения отвеченных тредов
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".bak")); } catch {}
    for (const n of names) {
      let st; try { st = fs.statSync(path.join(dir, n)); } catch { continue; }
      if (nowMs - st.mtimeMs > LIMITS.KEEP_ANSWERED_DAYS * DAY) { try { fs.unlinkSync(path.join(dir, n)); removed++; } catch {} }
    }
    if (removed) logger.info("chat", "sweep", { removed });
    return removed;
  }
  return { validateInput, readThread, writeThread, newThread, appendMessage, unreadFor, markSeen,
    appendMessageById, markSeenById, listSummaries, unreadForTeacher, countVisitorThreads, forget, archive, sweep };
}

module.exports = { createInboxStore, LIMITS };
