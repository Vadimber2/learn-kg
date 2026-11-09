"use strict";
// Общая vm-преамбула клиентских сьютов: страница собирается один раз, маркер-блок
// «===NAME===» вырезается и исполняется в песочнице без DOM.
// Канон: тесты берут код только через buildAppHtml() — то, что получает ученик.
const assert = require("assert");
const vm = require("vm");

const html = require("../../server/appshell").buildAppHtml();

// Текст маркер-блока — для сьютов, которым нужен сам вырез (склейки, повторные прогоны).
// После открывающего маркера допустима проза («/* ===EXAM=== Полный пробный экзамен …»),
// поэтому возвращается блок целиком вместе с маркер-комментариями — для vm они пусты.
function blockSrc(name) {
  const m = html.match(new RegExp("/\\* ===" + name + "===[\\s\\S]*?/\\* ===/" + name + "=== \\*/"));
  assert.ok(m, "маркеры ===" + name + "=== найдены");
  return m[0];
}

// Исполнить блок (или склейку блоков, если name — массив) в песочнице и вернуть её;
// expose — имена из блока, становящиеся свойствами песочницы; scheduleDays приклеивает
// строку const SCHEDULE_DAYS=… (блок ===SRS=== без неё не исполняется).
function loadBlock(name, { sandbox = {}, expose = [], scheduleDays = false } = {}) {
  if (!("console" in sandbox)) sandbox.console = console;
  let pre = "";
  if (scheduleDays) {
    const c = html.match(/const SCHEDULE_DAYS=[^\n]*;/);
    assert.ok(c, "константы интервалов найдены");
    pre = c[0] + "\n";
  }
  vm.createContext(sandbox);
  vm.runInContext(pre + [].concat(name).map(blockSrc).join(";") + ";" +
    expose.map((n) => "this." + n + "=" + n + ";").join(""), sandbox);
  return sandbox;
}

module.exports = { html, blockSrc, loadBlock };
