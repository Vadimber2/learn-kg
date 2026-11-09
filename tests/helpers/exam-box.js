"use strict";
/* Стенд движка экзамена для vm-гейтов: DOM-заглушки и глобали приложения, которых
   касается блок ===EXAM===. Один на все секции — правка сигнатуры стаба (например,
   addEventListener у textarea) иначе расходилась бы по рукописным копиям.
   В контексте нет ни одной глобали, которой нет в приложении (урок LANG, exam-b1 §12). */
const vm = require("vm");
const { blockSrc } = require("./block");

function mkNode(tag, attrs, kids) {
  return { tag, attrs: attrs || {}, kids: kids || [], value: "", style: {}, disabled: false,
    append(...x) { this.kids.push(...x); },
    addEventListener(ev, f) { (this.ev = this.ev || {})[ev] = f; } };
}

/* examBox(over): контекст с исполненным движком (блок ===EXAM=== из сборки).
   Все созданные узлы — box.nodes, область экрана — box.area (её и отдаёт el()).
   over переопределяет любую глобаль: ST, activeModule, MODULE_META, CONTENT,
   EXAM_SPECS, EXAM_TEXT_SETS, fetch… */
function examBox(over) {
  const nodes = [], area = mkNode("area");
  const box = {
    console, Date, Math, JSON,
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 2, clearTimeout() {},
    fgPlay() {}, fgStop() {},
    h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs, kids); nodes.push(n); return n; },
    el: () => area, clear: (x) => { x.kids.length = 0; return x; },
    t: (k) => k, harmonyTable: () => mkNode("table"), optList: () => mkNode("opts"),
    metaOf: (id) => ({ id, num: id, title: "" }), metaTitle: () => "", currentLang: () => "ru",
    evPush() {}, save() {}, saveLocal() {}, IS_DEMO: true, fetch: () => Promise.resolve({ ok: false }),
    activeModule: "m11", ST: {}, MODULE_META: [], CONTENT: {}, EXAM_TEXTS: [],
    ...(over || {}), nodes, area,
  };
  vm.createContext(box);
  vm.runInContext(blockSrc("EXAM").replace(/\bconst Exam=/, "this.Exam="), box);
  return box;
}

// все узлы под n — «что нарисовано»; textOf — строки узлов, «что человек увидит»
const flat = (n, acc = []) => { for (const k of (n.kids || [])) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
const textOf = (n) => JSON.stringify(flat(n).map((x) => x.kids.filter((k) => typeof k === "string")));
// узел с нужной строкой среди kids — для проверок «на экране есть …» по всем узлам стенда
const drawnWith = (nodes, needle) => nodes.some((n) => n.kids.some((k) => String(k).includes(needle)));

module.exports = { examBox, mkNode, flat, textOf, drawnWith };
