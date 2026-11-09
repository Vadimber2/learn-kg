/* Service worker тренажёра (версия приложения: __APP_VERSION__).
   Задача одна: приложение открывается офлайн из кэша. Ничего больше не перехватываем —
   /api/**, витрина, статика ходят в сеть напрямую, их ETag/304/Vary логика не тронута.
   Kill-switch: /sw.js отдаётся с no-store, любой деплой заменяет этот файл на следующей
   навигации; для полного отката задеплоить заглушку: install→skipWaiting,
   activate→caches.delete("kga1-shell")+self.registration.unregister(). */
const CACHE = "kga1-shell";
const SHELL = "/__shell";
const APP_URLS = ["/", "/index.html", "/m0.html"];
const OFFLINE_HTML = '<!doctype html><html lang="ru"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Нет соединения</title>' +
  '<style>:root{--bg:#f6f7f9;--ink:#1c2430;--muted:#57616e;--accent:#0e7490}' +
  '@media (prefers-color-scheme:dark){:root{--bg:#10151c;--ink:#e7ecf2;--muted:#8b98a7;--accent:#38bdf8}}' +
  'body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px}' +
  'h1{font-size:1.2rem}p{color:var(--muted)}a{color:var(--accent)}</style>' +
  '<body><div><div style="font-size:3rem">Ө</div><h1>Нет соединения</h1>' +
  '<p>Откройте тренажёр при подключении к интернету — после этого он будет доступен и офлайн.</p>' +
  '<p><a href="/">Повторить</a></p></div>';

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  if (!APP_URLS.includes(new URL(req.url).pathname)) return; // /api/** и прочее — мимо, в сеть напрямую
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const resp = await fetch(req);
      // Машина состояний: кэш оболочки зеркалит последний ОДНОЗНАЧНЫЙ ответ сервера.
      // 5xx (деплой, падение, CF 52x) и редиректы кэш не трогают — иначе каждый деплой
      // стирал бы офлайн-оболочку ровно в тот момент, ради которого она существует.
      if (resp.type === "basic" && resp.status === 200) {
        // запись/чистка — через waitUntil, параллельно с отдачей страницы: await здесь
        // задержал бы первый байт HTML до полного скачивания всей оболочки.
        // X-App-Shell теперь несёт метку варианта (страница персональна — данные только
        // выданных курсов), но контракт прежний: важна лишь непустота заголовка.
        // Слот один на устройство, и это осознанно: офлайн воркер не знает, кто вошёл
        // (кука HttpOnly). Сменить пользователя без сети нельзя, а первая же онлайн-
        // навигация перезаписывает слот СВОИМ вариантом. Плата: до первого захода в сети
        // офлайн остаётся оболочка прежнего входа — включая курс, который успели отобрать.
        if (resp.headers.get("X-App-Shell")) e.waitUntil(cache.put(SHELL, resp.clone()));
        else e.waitUntil(cache.delete(SHELL)); // витрина анонима / логин приостановленного — logout самоизлечивается
      } else if (resp.status >= 500) {
        const shell = await cache.match(SHELL);
        if (shell) return shell;
      }
      return resp;
    } catch {
      const shell = await cache.match(SHELL);
      return shell || new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
  })());
});
