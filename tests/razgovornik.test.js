"use strict";
/* Целостность данных разговорника (app/razgovornik/razgovornik.json) против CONTENT
   собранной страницы: каждый pick резолвится, дублей нет, объём в коридоре, у каждой
   фразы четыре языка. Поведение живой страницы (гейт озвучки, негоциация, магниты)
   проверяет server.test.js — здесь быстрый guard самих данных, зеркалящий fail-fast
   сборщика buildRazgovornik: сломанные данные должны краснеть и без старта сервера. */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

const R = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "razgovornik", "razgovornik.json"), "utf8"));
const { CONTENT: C } = loadBlock("DATA", { expose: ["CONTENT"] });

assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(R.updated), "updated — дата (едет в sitemap; правка секций обязана её бампать)");

/* ── ui: паритет и SEO-лимиты ────────────────────────────────────────────── */
const LANGS = ["ru", "en", "tr"];
assert.deepStrictEqual(Object.keys(R.ui).sort(), [...LANGS].sort(), "ui — ровно три языка");
const ruKeys = Object.keys(R.ui.ru).sort();
for (const l of LANGS) {
  assert.deepStrictEqual(Object.keys(R.ui[l]).sort(), ruKeys, "паритет ключей ui: " + l);
  const u = R.ui[l];
  assert.ok(u.title.length <= 60, "title " + l + " ≤ 60, сейчас " + u.title.length);
  assert.ok(u.desc.length >= 80 && u.desc.length <= 160, "desc " + l + " в 80–160, сейчас " + u.desc.length);
  assert.ok(u.lead.includes("{n}"), "lead " + l + " несёт счётчик {n} (число не пишется руками — цифры не врут)");
  assert.ok(Array.isArray(u.faq) && u.faq.length >= 3, "faq " + l + " ≥ 3 пар");
  for (const f of u.faq) assert.ok(f.q && f.a, "faq " + l + ": пустая пара");
}

/* ── секции: резолв, дубли, объём ────────────────────────────────────────── */
const seen = new Set();
let total = 0;
for (const s of R.sections) {
  assert.ok(/^[a-z0-9_]+$/.test(s.id), "id секции валиден: " + s.id);
  for (const l of LANGS) assert.ok(s.title && s.title[l], "секция " + s.id + ": титул " + l);
  let n = 0;
  for (const p of s.pick || []) {
    assert.ok(C[p.mod], "секция " + s.id + ": модуль " + p.mod + " есть в CONTENT");
    assert.ok(C[p.mod].cats && C[p.mod].cats[p.cat], "секция " + s.id + ": категория " + p.mod + "/" + p.cat + " существует");
    for (const v of C[p.mod].vocab) {
      if (v.cat !== p.cat || v.ref) continue;
      assert.ok(!seen.has(v.id), "фраза " + v.id + " попала в две секции");
      seen.add(v.id);
      for (const f of ["ky", "ru", "en", "tr"]) assert.ok(v[f], "фраза " + v.id + " без поля " + f);
      n++;
    }
  }
  assert.ok(n > 0, "секция " + s.id + " не пуста");
  total += n;
}
// коридор объёма: разговорник — витрина курса, не его копия и не огрызок
assert.ok(total <= 350, "фраз " + total + " ≤ 350");
assert.ok(total >= 150, "фраз " + total + " ≥ 150");

console.log("razgovornik.test.js: OK (" + R.sections.length + " секций, " + total +
  " фраз, паритет ui ru/en/tr, лимиты title/desc)");
