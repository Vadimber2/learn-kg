"use strict";
/* Самообновление открытой вкладки (===UPDATE===): версия сервера сверяется, расхождение —
   перезагрузка только в безопасный момент; петля в окно деплоя гасится отметкой на версию.
   Проверка исполнением блока из собранной страницы в vm без DOM (канон tests/helpers/block):
   песочница даёт поддельные document/элементы, и «занятость экрана» проверяется так же
   исполнением — холдом микрофона и живым событием input по полю ввода. */
const assert = require("assert");
const vm = require("vm");
const { fakeMic } = require("./helpers/mic-mock");
const { loadBlock, html } = require("./helpers/block");

// Поддельное поле ввода: ровно то, что читает блок (тег, тип, значение, живость в DOM)
function field(o = {}) { return Object.assign({ tagName: "TEXTAREA", isConnected: true, value: "" }, o); }

function ctx({ appVer = "1.1.155", srvVer = "1.1.156", enabled = true, tab = "overview", visible = true, sync = {} } = {}) {
  const calls = { reload: 0, fetch: 0, flush: 0, events: [] };
  let now = 1_000_000;
  const store = {};
  const listeners = {};
  const sb = {
    console, APP_VER: appVer, activeTab: tab, srv: srvVer,
    SYNC: Object.assign({ enabled, status: "ok", dirty: false, pending: false }, sync),
    document: {
      visibilityState: visible ? "visible" : "hidden", activeElement: null,
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    },
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { reload: () => { calls.reload++; } },
    fetch: async () => { calls.fetch++; const v = sb.srv; return { ok: v !== "err", json: async () => ({ version: v }) }; },
    evPush: (type, d) => calls.events.push([type, d]), evFlush: () => { calls.flush++; },
    Date: { now: () => now },
  };
  loadBlock("UPDATE", {
    sandbox: sb,
    expose: ["checkAppVersion", "applyUpdate", "updateSafeNow", "updateBusy", "updateHold", "verGt", "UPDATE"],
  });
  sb.tick = (ms) => { now += ms; };
  sb.type = (el) => { (listeners.input || []).forEach((fn) => fn({ target: el })); };   // живое событие ввода
  assert.ok((listeners.input || []).length, "блок слушает ввод в полях");
  return { sb, calls, store };
}

(async () => {
  /* 1. Та же версия — ничего не происходит */
  {
    const { sb, calls } = ctx({ srvVer: "1.1.155" });
    assert.strictEqual(await sb.checkAppVersion(true), false);
    assert.strictEqual(calls.fetch, 1, "версия запрошена");
    assert.strictEqual(calls.reload, 0, "перезагрузки нет");
    assert.strictEqual(sb.UPDATE.stale, null);
  }
  /* 2. Сервер новее, момент безопасный — перезагрузка, события сброшены, факт в журнале */
  {
    const { sb, calls } = ctx();
    assert.strictEqual(await sb.checkAppVersion(true), true);
    assert.strictEqual(calls.reload, 1, "перезагрузка выполнена");
    assert.strictEqual(calls.flush, 1, "журнал событий отправлен до перезагрузки");
    assert.strictEqual(JSON.stringify(calls.events[0]), JSON.stringify(["app.update", { from: "1.1.155", to: "1.1.156" }]), "факт обновления записан в журнал");
  }
  /* 3. Посреди теста/экзамена/тренажёра формата — не перезагружать; на переходе — да */
  for (const tab of ["test", "exam", "tr_uguu"]) {
    const { sb, calls } = ctx({ tab });
    assert.strictEqual(await sb.checkAppVersion(true), false, tab + ": не сейчас");
    assert.strictEqual(calls.reload, 0);
    assert.strictEqual(sb.UPDATE.stale, "1.1.156", "но версия запомнена");
    sb.activeTab = "overview";
    assert.strictEqual(sb.applyUpdate(), true, tab + ": при ближайшем переходе — перезагрузка");
    assert.strictEqual(calls.reload, 1);
  }
  /* 4. Неотправленный прогресс или ошибка синхронизации — ждём */
  for (const sync of [{ dirty: true }, { pending: true }, { status: "err" }]) {
    const { sb, calls } = ctx({ sync });
    assert.strictEqual(await sb.checkAppVersion(true), false, JSON.stringify(sync) + ": не сейчас");
    assert.strictEqual(calls.reload, 0);
    Object.assign(sb.SYNC, { dirty: false, pending: false, status: "ok" });
    assert.strictEqual(sb.applyUpdate(), true, "после отправки — перезагрузка");
  }
  /* 5. Вкладка не на экране — ждём возврата */
  {
    const { sb, calls } = ctx({ visible: false });
    assert.strictEqual(await sb.checkAppVersion(true), false);
    assert.strictEqual(calls.reload, 0);
  }
  /* 6. Петля в окно деплоя: та же серверная версия второй раз за 10 минут — без перезагрузки,
        позже — снова можно */
  {
    const { sb, calls } = ctx();
    assert.strictEqual(await sb.checkAppVersion(true), true);
    assert.strictEqual(await sb.checkAppVersion(true), false, "повтор в 10 минут гасится");
    assert.strictEqual(calls.reload, 1);
    sb.tick(11 * 60 * 1000);
    assert.strictEqual(await sb.checkAppVersion(true), true, "спустя 10 минут — попытка снова");
    assert.strictEqual(calls.reload, 2);
  }
  /* 7. Частота: без force — не чаще раза в минуту; демо/file:// и незаполненная версия — молчат */
  {
    const { sb, calls } = ctx({ srvVer: "1.1.155" });
    await sb.checkAppVersion(); await sb.checkAppVersion();
    assert.strictEqual(calls.fetch, 1, "второй запрос в ту же минуту не ушёл");
    sb.tick(61_000); await sb.checkAppVersion();
    assert.strictEqual(calls.fetch, 2, "через минуту — снова");
    const demo = ctx({ enabled: false });
    await demo.sb.checkAppVersion(true); assert.strictEqual(demo.calls.fetch, 0, "демо не проверяет");
    const raw = ctx({ appVer: "__APP_VERSION__" });
    await raw.sb.checkAppVersion(true); assert.strictEqual(raw.calls.fetch, 0, "без подставленной версии — молчим");
  }
  /* 8. Сеть упала при проверке — без последствий */
  {
    const { sb, calls } = ctx();
    sb.fetch = async () => { throw new Error("net"); };
    assert.strictEqual(await sb.checkAppVersion(true), false);
    assert.strictEqual(calls.reload, 0);
    assert.strictEqual(sb.UPDATE.checking, false, "флаг проверки снят");
  }
  /* 9. Запись микрофона (аудирование и кнопка «Говорить» на карточке): пока идёт запись и
        распознавание — не перезагружать; отпустили — можно. Обе вкладки обычные, по имени
        вкладки их исключить нельзя: там же идут обычные ответы. */
  for (const tab of ["listen", "cards"]) {
    const { sb, calls } = ctx({ tab });
    sb.updateHold("rec", true);
    assert.strictEqual(sb.updateBusy(), true, tab + ": микрофон занят");
    assert.strictEqual(await sb.checkAppVersion(true), false, tab + ": посреди записи не перезагружаем");
    assert.strictEqual(calls.reload, 0);
    sb.updateHold("rec", false);
    assert.strictEqual(sb.applyUpdate(), true, tab + ": запись кончилась — обновляемся");
    assert.strictEqual(calls.reload, 1);
  }
  /* 9б. Забытый холд не запирает обновление навсегда: отметка протухает (отказ микрофона,
        сорванный запрос — релиз мог не случиться) */
  {
    const { sb, calls } = ctx({ tab: "listen" });
    sb.updateHold("rec", true);
    assert.strictEqual(await sb.checkAppVersion(true), false);
    sb.tick(sb.UPDATE.HOLD + 1000);
    assert.strictEqual(sb.updateBusy(), false, "протухший холд больше не держит");
    assert.strictEqual(sb.applyUpdate(), true, "самообновление не заперто навсегда");
    assert.strictEqual(calls.reload, 1);
  }
  /* 10. Несохранённый ввод: письмо в композере, правка вычитки, балл за работу, ответ на
         карточке. Держит, пока текст есть и поле живёт в документе; опустело, уехало с
         экраном или отправилось — держать нечего. */
  {
    const { sb, calls } = ctx({ tab: "inbox" });
    const ta = field({ value: "Здравствуйте, " });
    sb.type(ta);                            // человек напечатал — поле запомнено
    sb.document.activeElement = null;       // и увёл курсор (кликнул мимо)
    assert.strictEqual(sb.updateBusy(), true, "недописанное письмо держит обновление");
    assert.strictEqual(await sb.checkAppVersion(true), false, "перезагрузки нет");
    assert.strictEqual(calls.reload, 0);
    ta.value = "";                          // письмо ушло — композер очищен
    assert.strictEqual(sb.updateBusy(), false);
    assert.strictEqual(sb.applyUpdate(), true, "после отправки — перезагрузка");
    assert.strictEqual(calls.reload, 1);
  }
  {
    const { sb, calls } = ctx({ tab: "review" });
    const inp = field({ tagName: "INPUT", type: "text", value: "кыргызча" });
    sb.type(inp);
    assert.strictEqual(await sb.checkAppVersion(true), false, "правка вычитки держит");
    inp.isConnected = false;                // экран перерисован — поле уехало вместе с ним
    assert.strictEqual(sb.updateBusy(), false, "мёртвое поле не держит");
    assert.strictEqual(sb.applyUpdate(), true);
    assert.strictEqual(calls.reload, 1);
  }
  {
    // курсор в поле = печатают прямо сейчас; кнопка и флажок полем ввода не считаются
    const { sb, calls } = ctx({ tab: "roster" });
    sb.document.activeElement = field({ tagName: "INPUT", type: "number", value: "" });
    assert.strictEqual(sb.updateBusy(), true, "курсор в поле балла — не момент");
    assert.strictEqual(await sb.checkAppVersion(true), false);
    assert.strictEqual(calls.reload, 0);
    sb.document.activeElement = { tagName: "BUTTON" };
    assert.strictEqual(sb.updateBusy(), false, "кнопка не ввод");
    sb.document.activeElement = field({ tagName: "INPUT", type: "checkbox" });
    assert.strictEqual(sb.updateBusy(), false, "флажок не ввод");
    // поиск по списку — фильтр, а не черновик: иначе набранный фильтр запирал бы экран целиком
    const srch = field({ tagName: "INPUT", type: "search", value: "ai" });
    sb.type(srch); sb.document.activeElement = srch;
    assert.strictEqual(sb.updateBusy(), false, "поле поиска не держит обновление");
    sb.document.activeElement = { tagName: "DIV", isContentEditable: true };
    assert.strictEqual(sb.updateBusy(), true, "contenteditable — тоже ввод");
    sb.document.activeElement = null;
    assert.strictEqual(sb.applyUpdate(), true);
    assert.strictEqual(calls.reload, 1);
  }
  /* 11. Направление версии. В окно деплоя и отката пару минут отвечают ОБА контейнера:
         ответ отставшего — не повод перезагружаться (иначе вкладку гоняет на старую сборку
         и в журнал едет «обновились» назад). Вверх — сразу, вниз — только когда сервер
         устойчиво отвечает старой версией дольше окна деплоя. */
  {
    assert.strictEqual(ctx().sb.verGt("1.1.156", "1.1.155"), true);
    assert.strictEqual(ctx().sb.verGt("1.1.155", "1.1.156"), false);
    assert.strictEqual(ctx().sb.verGt("1.2.0", "1.1.999"), true);
    assert.strictEqual(ctx().sb.verGt("1.1.9", "1.1.10"), false, "разряды числами, не строками");
    assert.strictEqual(ctx().sb.verGt("1.1.155", "1.1.155"), false);
  }
  {
    // отставший контейнер в окне деплоя: страница новее сервера
    const { sb, calls } = ctx({ appVer: "1.1.156", srvVer: "1.1.155" });
    assert.strictEqual(await sb.checkAppVersion(true), false, "ответ старого контейнера — не обновление");
    assert.strictEqual(calls.reload, 0);
    assert.strictEqual(sb.UPDATE.stale, null);
    assert.strictEqual(calls.events.length, 0, "в журнал ничего не пишем");
    // балансировщик отвечает вперемешку — по-прежнему тихо
    sb.tick(6 * 60 * 1000); sb.srv = "1.1.156";
    assert.strictEqual(await sb.checkAppVersion(true), false, "своя же версия — ничего");
    sb.tick(60_000); sb.srv = "1.1.155";
    assert.strictEqual(await sb.checkAppVersion(true), false, "отсчёт отката начат заново");
    assert.strictEqual(calls.reload, 0);
  }
  {
    // настоящий откат прода: сервер устойчиво отвечает старой версией — возвращаемся сами
    const { sb, calls } = ctx({ appVer: "1.1.156", srvVer: "1.1.155" });
    assert.strictEqual(await sb.checkAppVersion(true), false, "сразу не верим");
    sb.tick(sb.UPDATE.DOWN - 1000);
    assert.strictEqual(await sb.checkAppVersion(true), false, "окно деплоя ещё не закрылось");
    sb.tick(2000);
    assert.strictEqual(await sb.checkAppVersion(true), true, "откат подтверждён временем — обновляемся вниз");
    assert.strictEqual(calls.reload, 1);
    assert.strictEqual(JSON.stringify(calls.events[0]), JSON.stringify(["app.update", { from: "1.1.156", to: "1.1.155" }]));
  }
  {
    // новая версия поверх старой сверки — принимается немедленно, без ожидания
    const { sb, calls } = ctx({ appVer: "1.1.156", srvVer: "1.1.155" });
    assert.strictEqual(await sb.checkAppVersion(true), false);
    sb.tick(60_000); sb.srv = "1.1.157";
    assert.strictEqual(await sb.checkAppVersion(true), true, "сервер новее — сразу");
    assert.strictEqual(calls.reload, 1);
    assert.strictEqual(sb.UPDATE.older, null, "отсчёт отката сброшен");
  }
  /* 12. Проводка холда в самой кнопке «Говорить» на карточке — исполнением: настоящий блок
         ===UPDATE=== и настоящий исходник кнопки из отданной ученику страницы, поддельные
         только микрофон и DOM. Нажали «Говорить» — обновление ждёт; запись кончилась
         (даже пустая, ранним выходом) — обновление проходит. */
  {
    const { sb, calls } = ctx({ tab: "cards" });
    const mic = fakeMic({ syncOnstop: true });
    const node = (tag) => ({
      tagName: String(tag).toUpperCase(), isConnected: true, textContent: "", kids: [], style: {},
      append(...k) { this.kids.push(...k); }, addEventListener(t, fn) { (this._on = this._on || {})[t] = fn; },
    });
    Object.assign(sb, {
      IS_DEMO: false, ME: { stt: { enabled: true } }, ST: {}, AUDIO: { has: () => true },
      isTeacher: () => false, t: (k) => k, icon: () => node("svg"), h: (tag, attrs, ...kids) => {
        const n = node(tag); n.attrs = attrs || {}; n.kids = kids.slice(); return n;
      },
      clear: (n) => { n.kids = []; return n; },
      navigator: mic.navigator,
      sttConstraints: () => ({ audio: true }), sttSend: async () => { throw new Error("не должно дойти"); },
      MediaRecorder: mic.MediaRecorder, Blob: class { constructor() { this.size = 0; } },
      setTimeout: () => 1, clearTimeout: () => {},
    });
    const src = html.match(/\nfunction sttCardBtn\(c\)\{[\s\S]*?\n\}\n/);
    assert.ok(src, "исходник кнопки «Говорить» найден в отданной странице");
    vm.runInContext(src[0] + ";this.sttCardBtn=sttCardBtn;", sb);
    const btn = sb.sttCardBtn({ id: "m0_kel", ky: "Кел" }).kids[0];
    await btn._on.click();
    const rec = mic.recs[0];
    assert.strictEqual(rec.state, "recording", "микрофон включён");
    assert.strictEqual(sb.updateBusy(), true, "идёт запись — экран занят");
    assert.strictEqual(await sb.checkAppVersion(true), false, "посреди записи вкладку не перезагружаем");
    assert.strictEqual(calls.reload, 0);
    rec.stop(); await rec._p;
    assert.strictEqual(sb.updateBusy(), false, "запись кончилась — холд снят");
    assert.strictEqual(sb.applyUpdate(), true);
    assert.strictEqual(calls.reload, 1);
  }
  /* 13. Ни одна запись микрофона в отданной странице не остаётся без холда: перечень мест
         (карточка, аудирование, устный субтест экзамена) сверяется по самой сборке —
         новый микрофон без объявления занятости не проедет. */
  {
    const parts = html.split("new MediaRecorder(");
    assert.ok(parts.length - 1 >= 3, "места записи найдены: " + (parts.length - 1));
    parts.slice(1).forEach((p, i) => {
      const near = p.slice(0, 2500);
      assert.ok(/updateHold\("rec",true\)/.test(near), "запись #" + (i + 1) + ": старт объявляет занятость");
      assert.ok(/updateHold\("rec",false\)/.test(near), "запись #" + (i + 1) + ": конец отпускает");
    });
  }
  console.log("update.test.js: OK (самообновление вкладки: та же версия, безопасный момент, тест/экзамен, неотправленный прогресс, фон, петля деплоя, частота, обрыв сети, запись микрофона (проводка кнопки и перечень мест) и протухший холд, несохранённый ввод, направление версии и окно деплоя)");
})().catch((e) => { console.error(e); process.exitCode = 1; });
