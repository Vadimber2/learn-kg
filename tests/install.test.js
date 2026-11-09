"use strict";
/* Установка приложением (===INSTALL===): предложение показывается только там, где браузер
   действительно умеет ставить, отказ не считается ошибкой, установленное приложение ничего
   не предлагает. Проверка исполнением блока из собранной страницы и настоящей карточки
   настроек — не грепом (канон tests/helpers/block). */
const assert = require("assert");
const { loadBlock, html } = require("./helpers/block");
const vm = require("vm");

// Песочница блока: браузер задаётся стабами (ua/standalone/событие установки).
function ctx({ ua = "Mozilla/5.0 (Linux; Android 13)", standalone = false, tab = "settings", maxTouch = 0, platform = "Linux" } = {}) {
  const calls = { events: [], prompts: 0, renders: 0 };
  const listeners = {};
  const sb = {
    console, activeTab: tab,
    navigator: { userAgent: ua, platform, maxTouchPoints: maxTouch, standalone: standalone ? true : undefined },
    matchMedia: (q) => ({ matches: standalone && /standalone/.test(q) }),
    window: { addEventListener: (n, f) => { listeners[n] = f; } },
    evPush: (type, d) => calls.events.push([type, d]),
    renderTab: () => { calls.renders++; },
  };
  loadBlock("INSTALL", { sandbox: sb, expose: ["INSTALL", "installState", "installNow", "installStandalone", "installIOS"] });
  sb.fire = (name, e) => listeners[name] && listeners[name](e);
  return { sb, calls, listeners };
}
// Событие браузера: prompt() + обещание выбора человека.
const evt = (outcome, calls) => ({ prevented: false, preventDefault() { this.prevented = true; },
  prompt() { calls.prompts++; }, userChoice: Promise.resolve(outcome ? { outcome } : undefined) });

(async () => {
  /* 1. Android/Chrome: браузер сказал «установка возможна» — предлагаем, плашку браузера
        откладываем, чтобы показать своё место, а не чужую полоску поверх урока */
  {
    const { sb, calls } = ctx();
    assert.strictEqual(sb.installState(), "none", "до события браузера кнопки нет");
    const e = evt("accepted", calls);
    sb.fire("beforeinstallprompt", e);
    assert.strictEqual(e.prevented, true, "браузерная плашка отложена");
    assert.strictEqual(sb.installState(), "prompt", "теперь ставится в один тап");
    assert.strictEqual(calls.renders, 1, "открытые настройки перерисованы — кнопка появилась сразу");
    assert.strictEqual(await sb.installNow(), "accepted");
    assert.strictEqual(calls.prompts, 1, "показан системный диалог установки");
    assert.strictEqual(JSON.stringify(calls.events[0]), JSON.stringify(["app.install", { how: "prompt", outcome: "accepted" }]), "факт в журнале");
    assert.strictEqual(sb.installState(), "none", "поставили — больше не предлагаем");
    assert.strictEqual(await sb.installNow(), null, "второй раз по тому же событию нечего показывать");
  }
  /* 2. Отказ — не ошибка: предложение исчезает до следующего события браузера, приложение живёт */
  {
    const { sb, calls } = ctx();
    sb.fire("beforeinstallprompt", evt("dismissed", calls));
    assert.strictEqual(await sb.installNow(), "dismissed");
    assert.strictEqual(sb.installState(), "none", "после отказа не навязываемся");
    assert.strictEqual(calls.events[0][1].outcome, "dismissed", "в журнале честный исход");
    // браузер передумал и прислал событие снова — предлагаем опять
    sb.fire("beforeinstallprompt", evt("accepted", calls));
    assert.strictEqual(sb.installState(), "prompt");
  }
  /* 2б. Сломанное событие (prompt бросил) не роняет вкладку */
  {
    const { sb, calls } = ctx();
    sb.fire("beforeinstallprompt", { preventDefault() {}, prompt() { throw new Error("no"); }, userChoice: Promise.resolve() });
    assert.strictEqual(await sb.installNow(), "error");
    assert.strictEqual(calls.events[0][1].outcome, "error");
  }
  /* 3. iPhone: события установки не существует — ведём на инструкцию, а не рисуем мёртвую кнопку */
  {
    const { sb } = ctx({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" });
    assert.strictEqual(sb.installIOS(), true);
    assert.strictEqual(sb.installState(), "guide", "iPhone — только инструкция");
  }
  /* 3б. iPad на десктопном движке (MacIntel + тач) — тоже iPhone-путь */
  {
    const { sb } = ctx({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouch: 5 });
    assert.strictEqual(sb.installState(), "guide");
  }
  /* 4. Уже установлено (standalone) — не предлагаем ничего даже после события браузера */
  {
    const { sb, calls } = ctx({ standalone: true });
    assert.strictEqual(sb.installStandalone(), true);
    assert.strictEqual(sb.installState(), "none");
    sb.fire("beforeinstallprompt", evt("accepted", calls));
    assert.strictEqual(sb.installState(), "none", "в установленном приложении кнопки установки нет");
  }
  /* 5. Браузер без установки (десктопный Firefox/Safari): ни кнопки, ни инструкции */
  {
    const { sb } = ctx({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Firefox/128", platform: "MacIntel" });
    assert.strictEqual(sb.installState(), "none", "не обещаем того, чего браузер не сделает");
  }
  /* 6. Событие «приложение установлено» (поставили из меню браузера, мимо нашей кнопки) */
  {
    const { sb, calls } = ctx();
    sb.fire("beforeinstallprompt", evt("accepted", calls));
    sb.fire("appinstalled");
    assert.strictEqual(sb.installState(), "none", "кнопка ушла сама");
    assert.strictEqual(JSON.stringify(calls.events[0]), JSON.stringify(["app.install", { how: "appinstalled", outcome: "accepted" }]));
  }

  /* 7. Карточка настроек — исполнением настоящей installCard из сборки: на Android кнопка
        с обработчиком, на iPhone ссылка на инструкцию, в установленном приложении — ничего. */
  {
    const src = html.match(/\nfunction installCard\(\)\{[\s\S]*?\n\}/);
    assert.ok(src, "installCard извлечена из сборки");
    const mk = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], append(...k) { this.kids.push(...k.filter((x) => x != null)); } });
    const flat = (n, acc = []) => { for (const k of n.kids || []) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
    const run = (state, prompt) => {
      const sb = { console, installState: () => state, installNow: async () => "accepted", renderTab() {},
        t: (k) => k, icon: (n) => ({ tag: "i", attrs: { n }, kids: [] }),
        h: (tag, attrs, ...kids) => { const n = mk(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; } };
      vm.createContext(sb);
      vm.runInContext(src[0] + ";this.card=installCard();", sb);
      return sb.card;
    };
    assert.strictEqual(run("none"), null, "установленному приложению карточки нет");

    const android = run("prompt");
    assert.ok(android, "на Android карточка есть");
    const btn = flat(android).find((n) => n.tag === "button" && typeof n.attrs.onclick === "function");
    assert.ok(btn, "кнопка установки с обработчиком");
    assert.ok(flat(android).some((n) => n.tag === "a" && n.attrs.href === "/install"), "рядом — путь на инструкцию");
    const texts = flat(android).flatMap((n) => n.kids.filter((k) => typeof k === "string"));
    assert.ok(texts.some((s) => s.includes("inst_btn")), "подпись кнопки из словаря: " + texts.join("|"));

    const ios = run("guide");
    assert.ok(!flat(ios).some((n) => n.tag === "button"), "на iPhone мёртвой кнопки нет");
    const link = flat(ios).find((n) => n.tag === "a");
    assert.strictEqual(link.attrs.href, "/install", "ведём на инструкцию со скриншотами");
  }

  /* 8. Витрина: кнопка спрятана в разметке и показывается только по событию браузера,
        ключ подписи есть во всех трёх словарях (иначе на en/tr она была бы пустой). */
  {
    const fs = require("fs");
    const path = require("path");
    const land = fs.readFileSync(path.join(__dirname, "..", "app", "landing.html"), "utf8");
    const tag = land.match(/<button id="pwa-install"[^>]*>/);
    assert.ok(tag, "кнопка установки есть на витрине");
    assert.ok(/\shidden/.test(tag[0]), "и спрятана по умолчанию: " + tag[0]);
    assert.ok(/data-i="pwa_btn"/.test(tag[0]), "подпись из словаря");
    assert.strictEqual((land.match(/pwa_btn:"/g) || []).length, 3, "ключ во всех трёх словарях");
    assert.ok(/addEventListener\("beforeinstallprompt"/.test(land), "витрина слушает предложение браузера");
    assert.ok(/btn\.hidden=false/.test(land), "и только тогда показывает кнопку");
    assert.ok(/addEventListener\("appinstalled"/.test(land), "после установки кнопка убирается");
  }
  console.log("install.test.js: OK (Android — установка в один тап, отказ и сломанное событие, iPhone — инструкция, установленное приложение молчит, браузер без установки, карточка настроек и кнопка витрины исполнением)");
})().catch((e) => { console.error(e); process.exitCode = 1; });
