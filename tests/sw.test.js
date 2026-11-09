"use strict";
/* Service worker: машина состояний офлайн-кэша исполняется в vm на мок-браузере.
   До этого сьюта sw.js не исполнялся ни одним тестом — контракт «оболочка живёт
   офлайн, logout её стирает, деплой не стирает» держался на чтении кода глазами. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const src = fs.readFileSync(path.join(__dirname, "..", "app", "sw.js"), "utf8");

// Мок-браузер: ровно то, что sw.js трогает — self/caches/fetch/Response/URL
function makeWorker() {
  const store = new Map(); // содержимое кэша kga1-shell
  const handlers = {};
  const cache = {
    async put(key, resp) { store.set(key, resp); },
    async delete(key) { return store.delete(key); },
    async match(key) { return store.get(key); },
  };
  const sb = {
    console,
    self: { addEventListener: (ev, fn) => { handlers[ev] = fn; }, skipWaiting() {}, clients: { claim() {} }, registration: { unregister() {} } },
    caches: { async open() { return cache; }, async delete() { return store.clear(); } },
    URL,
    Response: class {
      constructor(body, init) { this.body = body; this.status = (init && init.status) || 200; this._h = (init && init.headers) || {}; this.type = "basic"; }
      get headers() { const h = this._h; return { get: (k) => h[k] || h[k.toLowerCase()] || null }; }
      clone() { return this; }
    },
    fetch: null, // подставляется сценарием
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  // прогнать навигацию через обработчик fetch и вернуть, что увидел браузер
  async function navigate(pathname, netResponse) {
    sb.fetch = async () => { if (netResponse instanceof Error) throw netResponse; return netResponse; };
    let responded = null;
    const waits = [];
    const e = {
      request: { method: "GET", mode: "navigate", url: "https://learn.kg" + pathname },
      respondWith(p) { responded = p; },
      waitUntil(p) { waits.push(p); },
    };
    handlers.fetch(e);
    const out = responded ? await responded : null;
    await Promise.all(waits);
    return out;
  }
  const resp = (status, headers) => new sb.Response("body-" + status, { status, headers: headers || {} });
  return { navigate, store, resp, handlers };
}

(async () => {
  /* 1. Успешный вход: ответ с X-App-Shell кэшируется как офлайн-оболочка */
  {
    const w = makeWorker();
    const r = await w.navigate("/", w.resp(200, { "X-App-Shell": "52a7768a258ca3a9" }));
    assert.strictEqual(r.status, 200, "страница отдана как есть");
    assert.ok(w.store.get("/__shell"), "оболочка легла в кэш");
  }

  /* 2. Витрина анонима (без X-App-Shell) стирает оболочку — logout самоизлечивается */
  {
    const w = makeWorker();
    await w.navigate("/", w.resp(200, { "X-App-Shell": "abc" }));
    await w.navigate("/", w.resp(200, {}));
    assert.ok(!w.store.get("/__shell"), "выход стёр офлайн-оболочку");
  }

  /* 3. Деплой/падение (5xx) НЕ стирает кэш, а отдаёт оболочку из него */
  {
    const w = makeWorker();
    await w.navigate("/", w.resp(200, { "X-App-Shell": "abc" }));
    const r = await w.navigate("/", w.resp(503, {}));
    assert.ok(w.store.get("/__shell"), "5xx не тронул кэш");
    assert.strictEqual(r.body, "body-200", "ученику отдана оболочка, а не страница ошибки");
  }

  /* 4. Офлайн: оболочка из кэша; без кэша — вежливая заглушка, не белый экран */
  {
    const w = makeWorker();
    await w.navigate("/", w.resp(200, { "X-App-Shell": "abc" }));
    const r = await w.navigate("/", new Error("net down"));
    assert.strictEqual(r.body, "body-200", "офлайн отдаёт закэшированную оболочку");
    const w2 = makeWorker();
    const r2 = await w2.navigate("/", new Error("net down"));
    assert.strictEqual(r2.status, 503, "без кэша — офлайн-заглушка");
    assert.ok(String(r2.body).includes("Нет соединения"), "заглушка объясняет, что случилось");
  }

  /* 5. Метка варианта — truthy-контракт: хэш работает так же, как прежняя «1» */
  {
    const w = makeWorker();
    await w.navigate("/", w.resp(200, { "X-App-Shell": "1" }));
    assert.ok(w.store.get("/__shell"), "старый сервер (X-App-Shell: 1) кэшируется");
    await w.navigate("/", w.resp(200, { "X-App-Shell": "0f3a" }));
    assert.ok(w.store.get("/__shell"), "новый сервер (хэш варианта) кэшируется так же");
  }

  /* 6. Перехватываются только навигации приложения: API и статика идут мимо воркера */
  {
    const w = makeWorker();
    assert.strictEqual(await w.navigate("/api/progress", w.resp(200, {})), null, "API не перехвачен");
    const w2 = makeWorker();
    let hit = null;
    const e = { request: { method: "GET", mode: "no-cors", url: "https://learn.kg/" }, respondWith(p) { hit = p; }, waitUntil() {} };
    w2.handlers.fetch(e);
    assert.strictEqual(hit, null, "не-навигация не перехвачена");
  }

  console.log("sw.test.js: OK (кэш оболочки: вход, выход, деплой, офлайн, truthy-метка, скоуп)");
})().catch((e) => { console.error(e); process.exitCode = 1; });
