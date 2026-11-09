"use strict";
/* Общий харнесс интеграционных сьютов: поднять server/server.js на своём порту,
   дождаться готовности и отдать req() к нему. stop() гасит процесс и прибирает
   каталог данных (keepData — для второго сервера поверх общего каталога). */
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

async function startServer({ port, dataDir, usersFile, env } = {}) {
  const base = "http://localhost:" + port;
  const logs = []; // stdout+stderr построчно — сьюты проверяют контракт формата логов
  const proc = spawn("node", [path.join(__dirname, "..", "..", "server", "server.js")], {
    env: Object.assign({}, process.env, {
      PORT: String(port), DATA_DIR: dataDir,
      USERS_FILE: usersFile || path.join(__dirname, "..", "fixtures", "users.json"),
    }, env || {}),
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => logs.push(...String(d).split("\n").filter(Boolean)));
  proc.stderr.on("data", (d) => logs.push(...String(d).split("\n").filter(Boolean)));

  async function req(method, p, { auth, body, ct, cookie, raw, etag, al, gzip, headers: extra } = {}) {
    const headers = Object.assign({}, extra || {}); // extra — произвольные заголовки (x-forwarded-for и т.п.)
    if (auth) headers.Authorization = auth;
    if (cookie) headers.Cookie = cookie;
    if (etag) headers["If-None-Match"] = etag;
    if (al) headers["Accept-Language"] = al;
    if (gzip) headers["Accept-Encoding"] = "gzip";
    if (body != null && !raw) headers["Content-Type"] = ct || "application/json";
    if (raw && ct) headers["Content-Type"] = ct;
    const r = await fetch(base + p, {
      method, headers,
      body: raw ? body : (body != null ? JSON.stringify(body) : undefined),
      redirect: "manual",
    });
    const text = await r.text();
    return { status: r.status, text, headers: r.headers };
  }

  /* Сырой запрос без fetch: undici сам разжимает gzip/br и прячет Content-Encoding,
     поэтому договор о сжатии (что именно отдал сервер и в каких байтах) проверяется
     только на голом http-клиенте. Возвращает заголовки как есть и НЕразжатое тело. */
  function rawGet(p, headers) {
    return new Promise((resolve, reject) => {
      const rq = http.request({ host: "localhost", port, path: p, method: "GET", headers: headers || {} }, (r) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
      });
      rq.on("error", reject);
      rq.end();
    });
  }

  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { up = (await req("GET", "/api/health")).status === 200; } catch {}
  }
  if (!up) {
    proc.kill();
    throw new Error("сервер не поднялся:\n" + logs.join("\n"));
  }

  return {
    req, rawGet, logs, proc,
    stop({ keepData } = {}) {
      proc.kill();
      if (!keepData && dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

module.exports = { startServer };
