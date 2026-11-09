#!/usr/bin/env node
"use strict";
/* Текущее состояние курсов и реестров — вместо чисел, зашитых в текст скилла.
   Запуск: node .claude/skills/kyrgyz-course/scripts/state.js
   Печатает: курсы и их модули, следующий свободный id, ожидаемое число
   тестовых наборов, модули без данных. Ничего не меняет. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..", "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function courses() {
  const src = read("server/server.js");
  const block = src.slice(src.indexOf("const COURSES = {"));
  const out = {};
  for (const m of block.slice(0, block.indexOf("\n};")).matchAll(/(\w+):\s*\{[^}]*modules:\s*\[([^\]]*)\]/g))
    out[m[1]] = m[2].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  return out;
}

function suites() {
  const pkg = JSON.parse(read("package.json"));
  const cmd = (pkg.scripts && pkg.scripts.test) || "";
  return (cmd.match(/tests\/[\w-]+\.test\.js/g) || []).length;
}

const C = courses();
const all = Object.values(C).flat();
const nums = all.map((m) => Number(m.slice(1))).filter((n) => !Number.isNaN(n));
const ready = JSON.parse("[" + read("app/src/data/content.ready.js").match(/\[([\s\S]*?)\]/)[1] + "]");

console.log("Курсы:");
for (const [id, mods] of Object.entries(C))
  console.log("  " + id.padEnd(4) + mods.length + " модулей: " + mods[0] + "…" + mods[mods.length - 1]);
console.log("Всего модулей: " + all.length);
console.log("Следующий свободный id: m" + (Math.max(...nums) + 1));
console.log("Ожидаемое число зелёных сьютов: " + suites());
const noData = all.filter((m) => !ready.includes(m));
console.log("Модули вне CONTENT_READY: " + (noData.length ? noData.join(", ") : "нет"));
console.log("\nПорядок id обязан идти возрастающими блоками по курсам —");
console.log("сверка COURSES с манифестом идёт строкой (см. module-checklist.md).");
