"use strict";
/* Чат с преподавателем: идентификаторы тредов и подпись куки посетителя.
   Посетитель без учётной записи узнаётся по HttpOnly-куке kga1-chat = <id>.<hmac32>:
   подпись HMAC-SHA256 по секрету сессий не даёт перебирать чужие треды (id — 24 hex,
   но без подписи он ничего не открывает). Ученические треды (u-<login>) в куке не живут:
   их владельца определяет сессия, кука с u- отвергается. Форма самого id — в
   server/inbox-id.js, общая с хранилищем. Модуль без файлов и HTTP —
   тестируется на модельных данных (tests/chat.test.js). */
const crypto = require("crypto");
const { CHAT_ID_RE: ID_RE } = require("./inbox-id");

const COOKIE_NAME = "kga1-chat";

function createInboxAuth({ secret, timingEq }) {
  const sig = (id) => crypto.createHmac("sha256", String(secret)).update("chat|" + id).digest("hex").slice(0, 32);
  const newVisitorId = () => "v-" + crypto.randomBytes(12).toString("hex");
  const studentId = (login) => "u-" + login;
  const signChatId = (id) => id + "." + sig(id);
  function parseChatCookie(str) {
    if (typeof str !== "string" || !str) return null;
    const i = str.lastIndexOf(".");
    if (i <= 0) return null;
    const id = str.slice(0, i);
    if (!id.startsWith("v-") || !ID_RE.test(id)) return null;
    return timingEq(str, signChatId(id)) ? id : null;
  }
  const FLAGS = "; Path=/; HttpOnly; SameSite=Lax; Max-Age=";
  const cookieHeader = (id, secure, maxAgeSec) => COOKIE_NAME + "=" + signChatId(id) + FLAGS + maxAgeSec + (secure ? "; Secure" : "");
  const clearCookieHeader = () => COOKIE_NAME + "=" + FLAGS + "0"; // те же атрибуты, иначе браузер не сотрёт куку
  return { COOKIE_NAME, ID_RE, newVisitorId, studentId, signChatId, parseChatCookie, cookieHeader, clearCookieHeader };
}

module.exports = { createInboxAuth };
