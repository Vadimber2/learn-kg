"use strict";
/* Исходники сервера для тестов-срезов. Декомпозиция server.js переносит блоки
   между файлами server/*.js — тесты привязываются к МАРКЕРАМ и содержимому,
   а не к имени файла: срез ищется по всем файлам и обязан встретиться ровно
   один раз (дубль маркера в двух файлах — ошибка, а не «взяли первый»). */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "..", "server");
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort()
  .map((f) => [f, fs.readFileSync(path.join(DIR, f), "utf8")]);

// весь серверный код одним стогом — для грепов, которым не важен файл
const all = FILES.map(([, src]) => src).join("\n");

// срез по регекспу: ровно одно совпадение во всём server/*.js;
// возвращает { file, text } — file идёт в сообщение ассерта
function slice(re, what) {
  const hits = [];
  for (const [f, src] of FILES) {
    const m = src.match(re);
    if (m) hits.push({ file: f, text: m[0] });
  }
  if (hits.length !== 1) {
    throw new Error("срез «" + what + "»: найден в " + hits.length +
      " файлах server/*.js (" + hits.map((h) => h.file).join(", ") + ") — ожидался ровно один");
  }
  return hits[0];
}

// маркер-блок /* ===NAME=== */ … /* ===/NAME=== */
const marker = (name) => slice(new RegExp("/\\* ===" + name + "===[\\s\\S]*?/\\* ===/" + name + "=== \\*/"), "===" + name + "===");

module.exports = { all, slice, marker, FILES };
