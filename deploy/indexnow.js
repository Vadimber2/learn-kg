"use strict";
/* IndexNow-пинг (Яндекс/Bing — Google протокол не поддерживает): уведомляет поисковики
   об изменённых URL сразу, не дожидаясь обхода и не тратя квоту ручного переобхода.
   Ключ хоста раздаётся сервером как /<key>.txt (см. INDEXNOW_KEY в server/server.js).

   Запуск после деплоя, менявшего публичные страницы:
     node deploy/indexnow.js /blog/novaya-statya/ru /blog/novaya-statya/en   # точечно
     node deploy/indexnow.js --sitemap                                       # весь sitemap
   Пути — относительные (как в Вебмастере) или полные https://learn.kg/…
   Один POST на api.indexnow.org доставляет всем участникам протокола. */
const HOST = "learn.kg";
const KEY = "ebfda8721d76613a7f55f4be4bd1f932";

async function main() {
  let urls = process.argv.slice(2);
  if (!urls.length) {
    console.error("usage: node deploy/indexnow.js </path ...|--sitemap>");
    process.exit(1);
  }
  if (urls[0] === "--sitemap") {
    const xml = await (await fetch("https://" + HOST + "/sitemap.xml")).text();
    urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  }
  const urlList = urls.map((u) => (u.startsWith("http") ? u : "https://" + HOST + u));
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY,
      keyLocation: "https://" + HOST + "/" + KEY + ".txt", urlList }),
  });
  // 200 — принято; 202 — принято, ключ проверят позже (норма для первого пинга)
  console.log("IndexNow: HTTP " + r.status + ", отправлено URL: " + urlList.length);
  if (r.status >= 400) { console.error(await r.text()); process.exit(1); }
}
main();
