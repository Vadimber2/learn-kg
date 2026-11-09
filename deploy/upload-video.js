"use strict";
/* Заливка готовых роликов на прод: deploy/out/*.mp4 → PUT /api/video/<имя>
   (гейт преподавателя); рядом лежащие <имя>.chapters.json уходят в мету раздачи —
   клиент рисует по ним главы и синхронизирует видео с темами урока.
   Ретрай на 5xx: большой PUT изредка ловит транзиентный 502 прокси (наступали).
   Запуск: KGA1_AUTH=login:pass [KGA1_BASE=…] node deploy/upload-video.js
   Карточка на вкладке Уроки появляется у всех сама — список строится из каталога
   /data/video на каждый запрос, рестарт не нужен. */
const fs = require("fs");
const path = require("path");

async function putRetry(url, opts, tries) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, opts).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
    // status 0 — оборванное соединение, ретраится наравне с 5xx
    if (r.ok || (r.status > 0 && r.status < 500) || i >= tries) return r;
    console.log("  HTTP " + r.status + ", повтор " + i + "/" + (tries - 1) + "…");
    await new Promise((res) => setTimeout(res, 1500 * i));
  }
}

async function main() {
  const auth = process.env.KGA1_AUTH;
  if (!auth) { console.error("нужен KGA1_AUTH=login:pass (преподаватель)"); process.exit(1); }
  const base = process.env.KGA1_BASE || "https://learn.kg";
  const H = { Authorization: "Basic " + Buffer.from(auth).toString("base64") };
  const dir = path.join(__dirname, "out");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z0-9-]{1,60}\.(mp4|jpg)$/.test(f)) : [];
  if (!files.length) { console.error("в deploy/out нет mp4 — сначала node deploy/make-video.js"); process.exit(1); }
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f));
    const r = await putRetry(base + "/api/video/" + f, { method: "PUT",
      headers: Object.assign({ "Content-Type": f.endsWith(".jpg") ? "image/jpeg" : "video/mp4" }, H), body }, 4);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { console.error("FAIL " + f + ": HTTP " + r.status + " " + (d.error || "")); process.exit(1); }
    console.log("ok " + f + " (" + (d.bytes / 1048576).toFixed(1) + " МБ)");
    // главы — только у mp4: у jpg replace не срабатывает, chF указывал бы на сам
    // постер и JSON.parse ронял скрипт на первом же jpg (наступили на уроке 2)
    const chF = path.join(dir, f.replace(/\.mp4$/, ".chapters.json"));
    if (f.endsWith(".mp4") && fs.existsSync(chF)) {
      const chapters = JSON.parse(fs.readFileSync(chF, "utf8"));
      const rm = await putRetry(base + "/api/video/meta", { method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, H),
        body: JSON.stringify({ file: f, chapters }) }, 4);
      if (!rm.ok) { console.error("FAIL главы " + f + ": HTTP " + rm.status); process.exit(1); }
      console.log("  главы: " + chapters.length);
    }
  }
  console.log("готово: " + base + "/#m0/lessons");
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
