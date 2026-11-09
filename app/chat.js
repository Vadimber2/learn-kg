"use strict";
/* Чат с преподавателем — виджет публичных страниц learn.kg (витрина, блог, разговорник,
   переводчик, слова, тесты, документы). Асинхронный инбокс: сообщение уходит на /api/chat,
   ответ преподавателя появляется в этом же окне при возвращении (кука kga1-chat ставит сервер).
   Словарь ru/en/tr подставляет сервер из app/chat-ui.json между маркерами; язык — <html lang>.
   DOM — только createElement/textContent (вставка разметки строкой запрещена политикой проекта). Пути к API
   абсолютные: страницы глубины 2 иначе ушли бы вглубь. WhatsApp остаётся второй кнопкой. */
(function () {
  /* ===CHAT-WIDGET-I18N=== */
  var T = __CHAT_UI__;
  /* ===/CHAT-WIDGET-I18N=== */
  if (typeof document === "undefined") return;
  if (window.__kgchat) return; // футер документов вставляется трижды — виджет один
  window.__kgchat = 1;

  var WA = __CHAT_WA__; // адрес WhatsApp подставляет сервер из общей константы SITE_WA
  var lang = function () { var l = document.documentElement.lang; return T[l] ? l : "ru"; };
  var t = function (k) { return T[lang()][k] || T.ru[k] || k; };
  var el = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === "text") e.textContent = attrs[k]; else if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.append(c); });
    return e;
  };

  var css = el("style", { text:
    // Две плавающие кнопки одной геометрии (решение владельца 06.09.2026): зелёная
    // WhatsApp внизу, синяя кнопка чата над ней. Разнятся только отступ снизу и цвет,
    // остальное — общим селектором. Обе — круглые иконки: подпись .kgc-fab-t остаётся
    // в разметке для скринридера, но не показывается ни на какой ширине.
    ".kgc-fab{position:fixed;bottom:calc(80px + env(safe-area-inset-bottom,0px));background:var(--accent,#0e7490);color:#fff;border:0;cursor:pointer}" +
    ".kgc-wafab{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));background:#25d366;color:#08210f;text-decoration:none}" +
    ".kgc-fab,.kgc-wafab{right:16px;z-index:45;display:flex;align-items:center;justify-content:center;gap:8px;width:52px;height:52px;padding:0;border-radius:26px;box-shadow:0 8px 24px rgba(16,24,40,.28);font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    ".kgc-fab:focus-visible,.kgc-wafab:focus-visible{outline:3px solid var(--ink,#1c2430);outline-offset:2px}" +
    ".kgc-fab svg,.kgc-wafab svg{width:22px;height:22px;flex:none}" +
    ".kgc-fab .kgc-fab-t,.kgc-wafab .kgc-fab-t{display:none}" +
    // атрибут hidden обязан побеждать display:flex классов — иначе панель «закрыта», но видна
    ".kgc-panel[hidden],.kgc-badge[hidden]{display:none!important}" +
    ".kgc-badge{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#e11d48;color:#fff;font:700 12px/20px sans-serif;text-align:center}" +
    ".kgc-panel{position:fixed;margin:0;padding:0;right:16px;bottom:calc(144px + env(safe-area-inset-bottom,0px));z-index:46;width:360px;max-width:calc(100vw - 32px);max-height:min(560px,calc(100vh - 100px));display:flex;flex-direction:column;background:var(--card,#fff);color:var(--ink,#1c2430);border:1px solid var(--line,#dde2e8);border-radius:16px;box-shadow:0 16px 48px rgba(16,24,40,.3);font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    "@media(max-width:480px){.kgc-panel{right:0;left:0;bottom:0;width:auto;max-width:none;max-height:85vh;border-radius:16px 16px 0 0}}" +
    ".kgc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line,#dde2e8)}" +
    ".kgc-head h2{margin:0;font-size:17px}" +
    ".kgc-x{border:0;background:transparent;color:var(--muted,#57616e);font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}.kgc-x:focus-visible{outline:2px solid var(--accent,#0e7490)}" +
    ".kgc-list{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}" +
    ".kgc-intro,.kgc-empty{color:var(--muted,#57616e);font-size:14px;margin:0}" +
    ".kgc-msg{max-width:85%;padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}" +
    ".kgc-me{align-self:flex-end;background:var(--accent,#0e7490);color:#fff}" +
    ".kgc-them{align-self:flex-start;background:var(--bg,#f6f7f9);border:1px solid var(--line,#dde2e8)}" +
    ".kgc-meta{display:block;font-size:11px;opacity:.75;margin-top:4px}" +
    ".kgc-form{padding:12px 16px;border-top:1px solid var(--line,#dde2e8);display:flex;flex-direction:column;gap:8px}" +
    ".kgc-form textarea,.kgc-form input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line,#dde2e8);border-radius:10px;background:var(--bg,#f6f7f9);color:var(--ink,#1c2430);font:inherit}" +
    ".kgc-form textarea{min-height:72px;resize:vertical}" +
    ".kgc-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}" +
    ".kgc-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".kgc-send{border:0;border-radius:10px;padding:10px 16px;background:var(--accent,#0e7490);color:#fff;font:600 15px/1 inherit;cursor:pointer}.kgc-send[disabled]{opacity:.6}" +
    ".kgc-wa{color:var(--accent,#0e7490);font-size:14px;text-decoration:none}.kgc-wa:hover{text-decoration:underline}" +
    ".kgc-status{font-size:13px;color:var(--muted,#57616e);min-height:1.2em;margin:0}" +
    ".kgc-foot{padding:0 16px 12px;font-size:12px}.kgc-foot a{color:var(--muted,#57616e)}" });
  document.head.append(css);

  var icon = function (paths) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2"); svg.setAttribute("aria-hidden", "true");
    (paths || ["M3 6h18v12H3z", "M3 6l9 7 9-7"]).forEach(function (d) { var p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); svg.append(p); });
    return svg;
  };
  var WA_ICON = ["M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z", "M9.2 8.4c0 3.4 2.9 6.3 6.3 6.3l.8-1.7-2.2-1-.9 1a5.6 5.6 0 0 1-2.3-2.3l1-.9-1-2.2-1.7.8z"];

  var state = { thread: null, unread: 0, open: false, timer: null };
  var api = function (method, path, body) {
    return fetch("/api/chat" + path, { method: method, headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { j.__status = r.status; return j; }); });
  };

  // --- плавающая кнопка ---
  var badge = el("span", { class: "kgc-badge", hidden: "" });
  var fabT = el("span", { class: "kgc-fab-t", text: t("open") });
  var fab = el("button", { class: "kgc-fab", type: "button", "aria-label": t("open"), "aria-expanded": "false", title: t("open") }, [icon(), fabT, badge]);
  var waT = el("span", { class: "kgc-fab-t", text: t("wa") });
  var wafab = el("a", { class: "kgc-wafab", href: WA, target: "_blank", rel: "noopener noreferrer", "aria-label": t("wa"), title: t("wa") }, [icon(WA_ICON), waT]);
  document.body.append(wafab, fab);
  // подпись плавающей кнопки живёт в трёх местах сразу — доступное имя, подсказка и скрытый текст
  var labelFab = function (node, span, txt) { node.setAttribute("aria-label", txt); node.title = txt; span.textContent = txt; };
  // счётчик озвучивается через aria-label самой кнопки: подпись бейджа скринридер не читает
  var setBadge = function (n) {
    state.unread = n;
    if (n > 0) { badge.textContent = String(n); badge.removeAttribute("hidden"); } else badge.setAttribute("hidden", "");
    fab.setAttribute("aria-label", n > 0 ? t("open") + ", " + t("unread") + ": " + n : t("open"));
  };

  // cookie-баннер витрины лежит внизу на всю ширину мобильного экрана — поднимаем кнопку над ним
  var consent = document.getElementById("consent");
  var lift = function () {
    if (consent && !consent.hidden) {
      var h = consent.getBoundingClientRect().height;
      wafab.style.bottom = "calc(" + (h + 24) + "px + env(safe-area-inset-bottom,0px))";
      fab.style.bottom = "calc(" + (h + 88) + "px + env(safe-area-inset-bottom,0px))";
    } else { fab.style.bottom = ""; wafab.style.bottom = ""; }
  };
  if (consent) { lift(); new MutationObserver(lift).observe(consent, { attributes: true, attributeFilter: ["hidden"] }); }

  // --- панель ---
  var POLL_MS = 60000;
  var panel = null, list, area, contact, status, sendBtn, hp, closeBtn, waLink, titleEl, footLink;
  // опрос ответов идёт только при открытой панели: закрытая не должна дёргать сервер
  var poll = function (on) {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (on) state.timer = setInterval(load, POLL_MS);
  };
  // поле контакта прячется, как только контакт известен: второй раз его не спрашивают
  var syncContact = function () { if (contact) contact.hidden = !!(state.thread && state.thread.contact); };
  var fmt = function (ts) { try { return new Date(ts).toLocaleString(lang() === "ru" ? "ru-RU" : lang() === "tr" ? "tr-TR" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  var renderList = function () {
    while (list.firstChild) list.removeChild(list.firstChild);
    var msgs = (state.thread && state.thread.messages) || [];
    if (!msgs.length) { list.append(el("p", { class: "kgc-intro", text: t("intro") })); return; }
    msgs.forEach(function (m) {
      var me = m.from === "visitor";
      list.append(el("div", { class: "kgc-msg " + (me ? "kgc-me" : "kgc-them") }, [
        document.createTextNode(m.text),
        el("span", { class: "kgc-meta", text: (me ? t("you") : t("teacher")) + " · " + fmt(m.ts) })]));
    });
    list.scrollTop = list.scrollHeight;
  };
  var load = function () {
    return api("GET", "").then(function (j) {
      state.thread = j.thread || null;
      setBadge(j.thread ? (j.unread || 0) : 0);
      if (state.open) { renderList(); syncContact(); seen(); } // ответ пришёл в открытую панель — он показан
    }).catch(function () {});
  };
  var seen = function () { if (state.unread) { api("POST", "/seen", {}).then(function () { setBadge(0); }).catch(function () {}); } };
  var send = function () {
    var text = area.value.trim();
    if (!text) { area.focus(); return; }
    sendBtn.disabled = true; status.textContent = "";
    var body = { text: text, lang: lang(), page: location.pathname, hp: hp.value };
    if (contact && !contact.hidden && contact.value.trim()) body.contact = contact.value.trim().slice(0, 120);
    api("POST", "", body).then(function (j) {
      sendBtn.disabled = false;
      if (!j.ok) { status.textContent = t("err"); return; }
      if (!state.thread) state.thread = { id: j.id, messages: [], contact: body.contact || "" };
      if (body.contact) state.thread.contact = body.contact;
      state.thread.messages.push({ id: j.msg.id, ts: j.msg.ts, from: "visitor", text: text });
      area.value = ""; syncContact();
      // воронка: отправка из чата — цель Метрики и событие GA (счётчики есть только по согласию)
      try { if (window.ym && window.YM_ID) ym(window.YM_ID, "reachGoal", "chat_send"); } catch (e) {}
      try { if (typeof gtag === "function") gtag("event", "chat_send"); } catch (e) {}
      renderList(); status.textContent = t("sent");
    }).catch(function () { sendBtn.disabled = false; status.textContent = t("err"); });
  };
  var build = function () {
    hp = el("input", { class: "kgc-hp", type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    list = el("div", { class: "kgc-list" });
    area = el("textarea", { class: "kgc-area", maxlength: "2000", placeholder: t("ph"), "aria-label": t("ph") });
    contact = el("input", { type: "text", maxlength: "120", placeholder: t("contactPh"), "aria-label": t("contactPh"), autocomplete: "email" });
    status = el("p", { class: "kgc-status", "aria-live": "polite" });
    sendBtn = el("button", { class: "kgc-send", type: "button", text: t("send") });
    sendBtn.addEventListener("click", send);
    area.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); });
    waLink = el("a", { class: "kgc-wa", href: WA, target: "_blank", rel: "noopener noreferrer", text: t("wa") });
    closeBtn = el("button", { class: "kgc-x", type: "button", "aria-label": t("close"), text: "×" });
    closeBtn.addEventListener("click", close);
    titleEl = el("h2", { id: "kgc-title", text: t("title") });
    footLink = el("a", { href: "/privacy", text: t("privacy") });
    // div, не section: витрина стилизует все section (padding 72px), панель не должна их наследовать
    panel = el("div", { class: "kgc-panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "kgc-title", hidden: "" }, [
      el("div", { class: "kgc-head" }, [titleEl, closeBtn]),
      list,
      el("div", { class: "kgc-form" }, [area, contact, hp, el("div", { class: "kgc-row" }, [sendBtn, waLink]), status]),
      el("div", { class: "kgc-foot" }, [footLink])]);
    document.body.append(panel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && state.open) close(); });
    // клик вне панели и кнопок закрывает её (как у обычных всплывающих окон)
    document.addEventListener("click", function (e) {
      if (!state.open) return;
      var tgt = e.target;   // не t: так зовут словарь виджета, и подмена имени сбивает с толку
      if (panel.contains(tgt) || fab.contains(tgt) || wafab.contains(tgt)) return;
      close();
    });
  };
  var open = function () {
    if (!panel) build();
    panel.removeAttribute("hidden"); state.open = true; fab.setAttribute("aria-expanded", "true");
    renderList(); syncContact();
    load().then(seen);
    poll(true);
    closeBtn.focus();
  };
  var close = function () {
    if (!panel) return;
    panel.setAttribute("hidden", ""); state.open = false; fab.setAttribute("aria-expanded", "false");
    poll(false);
    fab.focus();
  };
  fab.addEventListener("click", function () { state.open ? close() : open(); });
  // вкладка ушла в фон — опрос гасим, вернулась при открытой панели — заводим снова
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) poll(false); else if (state.open && !state.timer) poll(true);
  });

  // смена языка страницы на лету (витрина, документы) — перерисовать тексты
  var retext = function () {
    labelFab(fab, fabT, t("open"));
    labelFab(wafab, waT, t("wa"));
    if (badge.hasAttribute("hidden") === false) badge.setAttribute("aria-label", t("unread"));
    if (panel) {
      titleEl.textContent = t("title"); closeBtn.setAttribute("aria-label", t("close"));
      area.placeholder = t("ph"); area.setAttribute("aria-label", t("ph")); contact.placeholder = t("contactPh"); contact.setAttribute("aria-label", t("contactPh"));
      sendBtn.textContent = t("send"); waLink.textContent = t("wa"); footLink.textContent = t("privacy");
      renderList();
    }
  };
  new MutationObserver(retext).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  load(); // бейдж непрочитанного при возвращении — если у браузера есть кука, сервер её пришлёт
})();
