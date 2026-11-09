#!/usr/bin/env node
"use strict";
/* Хэш пароля для server/users.json (база учёток правится руками, открытый текст в ней —
   наследие: сервер его принимает, но предупреждает в логе).
   Использование: node deploy/hash-password.js            — пароль спросит без эха
                  node deploy/hash-password.js --stdin    — пароль из stdin (скрипты)
   Печатает строку scrypt$… — её и вставить в "password". */
const { hashPassword } = require("../server/passwords");

function readStdin() {
  return new Promise((resolve) => { let s = ""; process.stdin.on("data", (c) => { s += c; }); process.stdin.on("end", () => resolve(s.replace(/\r?\n$/, ""))); });
}
function askHidden(q) {
  return new Promise((resolve) => {
    process.stdout.write(q);
    const stdin = process.stdin; let s = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    stdin.on("data", function on(ch) {
      if (ch === "\u0003") { stdin.setRawMode(false); process.stdout.write("\n"); process.exit(130); }   // эхо терминала — назад
      if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", on); process.stdout.write("\n"); return resolve(s); }
      if (ch === "\u007f") { s = s.slice(0, -1); return; }
      s += ch;
    });
  });
}
(async () => {
  const pass = process.argv.includes("--stdin") || !process.stdin.isTTY ? await readStdin() : await askHidden("Пароль: ");
  if (!pass) { console.error("пустой пароль"); process.exit(1); }
  console.log(hashPassword(pass));
})();
