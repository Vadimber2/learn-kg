"use strict";
/* Тест контент-реестра модулей собранной страницы (buildAppHtml):
   данные лежат между маркерами ===DATA=== и валидируются без DOM. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();
const m = html.match(/\/\* ===DATA=== \*\/([\s\S]*?)\/\* ===\/DATA=== \*\//);
assert.ok(m, "маркеры ===DATA=== найдены");
const sb = { console };
vm.createContext(sb);
vm.runInContext(m[1] + "; this.CONTENT=CONTENT; this.CONTENT_READY=CONTENT_READY; this.DIALOGS=typeof DIALOGS===\"undefined\"?{}:DIALOGS;", sb);
const { CONTENT, CONTENT_READY, DIALOGS } = sb;

assert.strictEqual(JSON.stringify([...CONTENT_READY]),
  '["m0","m1","m2","m3","m4","m5","m6","m7","m8","m9","m10","m11","m12","m13","m14","m15","m16","m17","m18","m19","m20","m21","m22","m23","m24","m25","m26","m27","m28","m29","m30","m31","m32","m33","m34","m35","m36","m37","m38","m39","m40","m41","m42","m43","m44","m45","m46","m47"]', "готовы m0–m11 (A1) + m12–m23 (A2) + m24–m35 (B1) + m36–m47 (B2)");
for (const mid of CONTENT_READY) assert.ok(CONTENT[mid], "CONTENT содержит " + mid);

const homeOf = (id) => (id.startsWith("ph_") ? "m0" : id.split("_")[0]);
const allIds = new Set();
for (const [modId, c] of Object.entries(CONTENT)) {
  assert.ok(c.cats && typeof c.cats === "object", modId + ": cats");
  assert.ok(Array.isArray(c.vocab) && c.vocab.length > 0, modId + ": vocab");
  const seenRefs = new Set();
  for (const v of c.vocab) {
    if (v.ref) { // alias: переиспользование слова из более раннего модуля
      assert.ok(/^m\d+_\d+$/.test(v.ref), modId + ": ref формат " + v.ref);
      const donorMod = homeOf(v.ref);
      assert.notStrictEqual(donorMod, modId, modId + ": alias на собственный модуль " + v.ref);
      const iDonor = CONTENT_READY.indexOf(donorMod), iSelf = CONTENT_READY.indexOf(modId);
      assert.ok(iDonor >= 0 && (iSelf === -1 || iDonor < iSelf),
        modId + ": донор " + v.ref + " должен быть из более раннего готового модуля");
      const donor = (CONTENT[donorMod] || { vocab: [] }).vocab.find((d) => d.id === v.ref);
      assert.ok(donor, modId + ": донор " + v.ref + " не найден");
      assert.ok(!donor.ref, modId + ": alias на alias запрещён (" + v.ref + ")");
      assert.ok(!v.id && !v.ky && !v.ru && !v.en, modId + ": у alias " + v.ref + " не должно быть id/ky/ru/en");
      assert.ok(c.cats[v.cat], modId + ": категория " + v.cat + " у alias " + v.ref);
      assert.ok(!seenRefs.has(v.ref), modId + ": дубль ref " + v.ref);
      seenRefs.add(v.ref);
      continue;
    }
    assert.ok(/^m\d+_\d+$/.test(v.id), modId + ": id формат " + v.id);
    assert.ok(v.id.startsWith(modId + "_"), modId + ": id префикс " + v.id);
    assert.ok(!allIds.has(v.id), "дубль id " + v.id);
    allIds.add(v.id);
    assert.ok(v.ky && v.ru, modId + ": ky/ru у " + v.id);
    assert.ok(v.en, modId + ": en-глосс у " + v.id);
    assert.ok(c.cats[v.cat], modId + ": категория " + v.cat + " у " + v.id);
  }
  assert.ok(Array.isArray(c.drill) && c.drill.length >= 10, modId + ": дриллов ≥10");
  for (const d of c.drill) {
    if (d.type === "row") { assert.ok(d.w && typeof d.soft === "boolean", modId + ": row-дрилл"); continue; }
    assert.ok(Array.isArray(d.opts) && d.opts.length === 4, modId + ": 4 варианта у «" + d.q + "»");
    assert.ok(Number.isInteger(d.c) && d.c >= 0 && d.c <= 3, modId + ": индекс ответа у «" + d.q + "»");
  }
  assert.ok(c.drillLabel && c.refLabel, modId + ": подписи вкладок");
  // группы дрилла (как темы карточек): у каждой — имя и видимое правило формирования (ru+en);
  // каждый айтем привязан к существующей группе, пустых групп нет
  assert.ok(c.drillGroups && typeof c.drillGroups === "object" && Object.keys(c.drillGroups).length >= 2,
    modId + ": drillGroups — минимум 2 группы");
  for (const [gk, g] of Object.entries(c.drillGroups)) {
    assert.ok(g.name && g.rule, modId + ": name/rule у группы " + gk);
    assert.ok(g.nameEn && g.ruleEn, modId + ": nameEn/ruleEn у группы " + gk);
    assert.ok(c.drill.some((d) => d.g === gk), modId + ": группа " + gk + " без заданий");
  }
  for (const d of c.drill)
    assert.ok(d.g && c.drillGroups[d.g], modId + ": группа у дрилла «" + (d.q || d.w) + "»");
}

// сингармонизм m0: каждая группа дрилла — ровно 20 заданий
for (const gk of Object.keys(CONTENT.m0.drillGroups)) {
  const n = CONTENT.m0.drill.filter((d) => d.g === gk).length;
  assert.strictEqual(n, 20, "m0: в группе " + gk + " должно быть 20 заданий, есть " + n);
}

// пороги лексики — только по СВОИМ (не-alias) единицам: арифметика 900 слов методики §5.3
const ownCount = (mid) => CONTENT[mid].vocab.filter((v) => !v.ref).length;
// Порог по умолчанию — ≥85 своих единиц для КАЖДОГО модуля из CONTENT_READY: планка A1,
// перенесённая на A2 как есть (методики A2 пока нет — при её появлении порог уровня
// пересматривается здесь). Новый модуль (m13+) попадает под проверку автоматически —
// кроме списка-эталона CONTENT_READY выше, который правится осознанно.
const RAISED = { m0: 90, m1: 90, m2: 90, m3: 90 }; // m1–m3 — методика §5.3/§7.3 (~95); m0 — эмпирический пол
// Правило курса: последние модули — повторение, ноль новых слов (A1 — m10/m11 по
// методике §5.3; для A2 сюда же лягут его завершающие модули).
const REVISION_MODS = new Set(["m10", "m11", "m22", "m23", "m34", "m35", "m46", "m47"]);
for (const mid of [...Object.keys(RAISED), ...REVISION_MODS])
  assert.ok(CONTENT_READY.includes(mid), "исключение порога ссылается на несуществующий модуль: " + mid);
for (const mid of CONTENT_READY) {
  if (REVISION_MODS.has(mid)) { assert.strictEqual(ownCount(mid), 0, mid + " без новых слов: " + ownCount(mid)); continue; }
  const min = RAISED[mid] || 85;
  assert.ok(ownCount(mid) >= min, mid + " ≥" + min + " своих единиц: " + ownCount(mid));
}

// дубли кыргызских фраз между модулями (точное совпадение) — запрещены; реюз — только через alias
const kyByNorm = new Map();
for (const [modId, c] of Object.entries(CONTENT)) {
  for (const v of c.vocab) {
    if (v.ref) continue;
    const k = v.ky.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    assert.ok(!kyByNorm.has(k), "дубль фразы «" + v.ky + "» (" + kyByNorm.get(k) + " и " + v.id + ")");
    kyByNorm.set(k, v.id);
  }
  // модуль не может одновременно alias-ить слово и переопределять его же текстом
  for (const v of c.vocab) {
    if (!v.ref) continue;
    const donor = CONTENT[homeOf(v.ref)].vocab.find((d) => d.id === v.ref);
    if (!donor) continue;
    const k = donor.ky.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    assert.ok(kyByNorm.get(k) === donor.id, modId + ": «" + donor.ky + "» и alias, и переопределено");
  }
}

// kgw("текст","id") в рендерах: карточка обязана существовать, текст — совпадать
// с её ky побуквенно (иначе перенумерация id или правка карточки молча отвязала бы
// озвучку слова в грамматике от словаря)
const kyById = new Map();
for (const c of Object.values(CONTENT)) for (const v of c.vocab) if (v.id) kyById.set(v.id, v.ky);
let kgwRefs = 0;
for (const g of html.matchAll(/kgw\("([^"]+)","(m\d+_\d+)"\)/g)) {
  kgwRefs += 1;
  assert.ok(kyById.has(g[2]), "kgw: карточка " + g[2] + " не существует");
  assert.strictEqual(kyById.get(g[2]), g[1], "kgw: текст «" + g[1] + "» ≠ ky карточки " + g[2]);
}
assert.ok(kgwRefs > 100, "kgw-ссылки с id найдены (регексп не разъехался с кодом)");

// перекос дриллов: UI не перемешивает opts, поэтому если правильный ответ слишком
// часто стоит на одной позиции, дрилл (и мини-тест, который подмешивает 6 дриллов)
// сдаётся «первой кнопкой» — ловим на этапе данных
for (const [modId, c] of Object.entries(CONTENT)) {
  const withOpts = c.drill.filter((d) => Array.isArray(d.opts));
  if (withOpts.length < 8) continue;
  const byPos = [0, 0, 0, 0];
  for (const d of withOpts) byPos[d.c] += 1;
  const share = Math.max(...byPos) / withOpts.length;
  assert.ok(share <= 0.5, modId + ": " + Math.round(share * 100) + "% дриллов с ответом на одной позиции — перемешай opts");
}

// Диалоги: id уникальны и в бакете m0 (префикс ph_), у каждой строки говорящий и
// переводы ×3, у вопросов 4 варианта и валидный ответ; трёхъязычные подписи частей
{
  const dIds = new Set();
  for (const [mid, D] of Object.entries(DIALOGS)) {
    assert.ok(CONTENT_READY.includes(mid), "диалоги у неготового модуля " + mid);
    for (const part of D.parts) {
      assert.ok(part.title && part.sub && part.subEn && part.subTr, mid + ": подписи части ×3");
      for (const ln of part.lines) {
        assert.ok(/^ph_[a-z0-9_]+$/.test(ln.id), "формат id строки " + ln.id);
        assert.ok(!dIds.has(ln.id), "дубль id строки " + ln.id);
        dIds.add(ln.id);
        assert.ok(ln.sp && ln.ky && ln.ru && ln.en && ln.tr, "строка " + ln.id + ": sp/ky/ru/en/tr");
      }
    }
    for (const sng of (D.songs || [])) for (const v of sng.verses) {
      assert.ok(/^ph_[a-z0-9_]+$/.test(v.id) && !dIds.has(v.id), "id куплета " + v.id);
      dIds.add(v.id);
      assert.ok(v.name && v.ky && v.ru && v.en && v.tr, "куплет " + v.id + " ×3");
    }
    for (const part of D.parts) assert.ok((part.quiz || []).length >= 1, mid + ": вопросы после части " + part.title);
    for (const sng of (D.songs || [])) assert.ok((sng.quiz || []).length >= 1, mid + ": вопросы после песни " + sng.title);
    const allQuiz = D.parts.concat(D.songs || []).flatMap((x) => x.quiz || []);
    for (const q of allQuiz) {
      assert.ok(q.q && q.qRu && q.qEn && q.qTr, mid + ": вопрос ×3 — " + q.q);
      assert.ok(Array.isArray(q.opts) && q.opts.length === 4, mid + ": 4 варианта — " + q.q);
      assert.ok(Number.isInteger(q.c) && q.c >= 0 && q.c <= 3, mid + ": ответ — " + q.q);
    }
  }
}

// Глаголы движения в настоящем длительном — только -а/-е + жатат (келе жатат, бара жатат):
// «келип жатат» ученик поймал в таблице M3 (13.09.2026) вопреки собственной заметке страницы.
// Проверяется вся отданная страница: таблицы, дриллы, правила «Обзора», дистракторы.
for (const bad of ["келип жатат", "келип жатам", "келип жатасыз"]) {
  assert.ok(!html.includes(bad), "нестандартная форма в отданной странице: " + bad);
}
// Русский перевод карточки говорит «квартира» → кыргызский обязан быть про батир, не про үй
for (const v of CONTENT.m4.vocab) {
  if (v.ru && /квартир/i.test(v.ru) && v.ky) assert.ok(/батир/i.test(v.ky), "m4 «квартира» без «батир»: " + v.id + " " + v.ky);
}

const reuseTotal = Object.values(CONTENT).reduce((s, c) => s + c.vocab.filter((v) => v.ref).length, 0);
console.log("content.test.js: OK (m0:", ownCount("m0"), "ед., m1:", ownCount("m1"), "ед., m2:", ownCount("m2"), "ед., m3:", ownCount("m3"), "ед., реюз:", reuseTotal, "alias)");
