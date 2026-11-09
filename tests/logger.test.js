"use strict";
/* Тесты логгера — контракт autobugfix-детектора CCE (logging-standards):
   ISO-таймстамп в начале, [module] kebab, LEVEL заглавными до текста,
   переменные данные в JSON-хвосте, стек — сырыми строками после заголовка. */
const assert = require("assert");
const logger = require("../server/logger");

const LINE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[[a-z0-9-]+\] (INFO|WARN|ERROR|DEBUG): [^{]*(\{.*\})?$/;

function capture(fn) {
  const out = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (s) => out.push(String(s));
  try { fn(); } finally { Object.assign(console, orig); }
  return out;
}

// 1. INFO: формат строки + JSON-хвост
{
  const out = capture(() => logger.info("test-module", "something happened", { a: 1, b: "x" }));
  assert.strictEqual(out.length, 1);
  assert.ok(LINE_RE.test(out[0]), "INFO line format: " + out[0]);
  const tail = JSON.parse(out[0].slice(out[0].indexOf("{")));
  assert.deepStrictEqual(tail, { a: 1, b: "x" });
}

// 2. WARN без данных — без хвоста
{
  const out = capture(() => logger.warn("mod-x", "plain warning"));
  assert.strictEqual(out.length, 1);
  assert.ok(LINE_RE.test(out[0]), "WARN line format: " + out[0]);
  assert.ok(!out[0].includes("{"), "no tail expected");
}

// 3. ERROR: заголовок + сырой стек отдельными строками сразу после
{
  const err = new Error("boom");
  const out = capture(() => logger.error("mod-err", "operation failed", err, { id: "m0_01" }));
  assert.ok(out.length >= 2, "header + stack");
  assert.ok(LINE_RE.test(out[0]), "ERROR header format: " + out[0]);
  assert.ok(out[0].includes('"id":"m0_01"'), "data tail present");
  assert.ok(out[1].startsWith("Error: boom"), "raw stack first line");
  assert.ok(/at .+logger\.test\.js:\d+/.test(out[1]), "stack has frames with file:line");
}

// 4. ERROR без err-объекта — только заголовок
{
  const out = capture(() => logger.error("mod-err", "failed without stack", null, { n: 2 }));
  assert.strictEqual(out.length, 1);
}

// 5. Сообщение стабильно: переменные не в тексте (контроль по построению — logger не форматирует msg)
{
  const out = capture(() => logger.info("mod", "fixed message", { userId: 42 }));
  assert.ok(out[0].includes("fixed message {"), "message immediately followed by tail");
}

// 6. DEBUG пишется только при DEBUG=1
{
  const had = process.env.DEBUG;
  delete process.env.DEBUG;
  let out = capture(() => logger.debug("mod", "hidden"));
  assert.strictEqual(out.length, 0, "debug silent by default");
  process.env.DEBUG = "1";
  out = capture(() => logger.debug("mod", "visible"));
  assert.strictEqual(out.length, 1);
  assert.ok(LINE_RE.test(out[0]), "DEBUG line format");
  if (had === undefined) delete process.env.DEBUG; else process.env.DEBUG = had;
}

console.log("logger.test.js: OK (6 групп проверок)");
