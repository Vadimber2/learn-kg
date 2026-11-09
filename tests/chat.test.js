"use strict";
/* Чат с преподавателем (асинхронный инбокс): посетитель пишет на сайте, преподаватель
   отвечает из панели учителя, посетитель видит ответ при возвращении (решение владельца
   05.09.2026 — мессенджеры недоступны части аудитории).

   Порядок сьюта — порядок TDD: сначала два маленьких модуля без сети (подпись куки,
   хранилище), затем живой сервер полным циклом, границы, лимиты, виджет и подключение. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { fakeDom } = require("./helpers/fake-dom");

const DATA = "/tmp/kga1-chat-" + process.pid;
const B = (l, p) => "Basic " + Buffer.from(l + ":" + p).toString("base64");
const ILIM = B("ilim", "Tst-vKIxmveh-9"), ALT = B("altynai", "Tst-lwxo2c1U-9"), VADIM = B("vadim", "Tst-sFVPwRvG-9");

function timingEq(a, b) {
  const ab = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/* ---------- 1. inbox-auth: идентификаторы и подпись куки (чистый модуль) ---------- */
function testAuth() {
  const { createInboxAuth } = require("../server/inbox-auth");
  const A = createInboxAuth({ secret: "s3cret", timingEq });
  const B2 = createInboxAuth({ secret: "other", timingEq });
  const id = A.newVisitorId();
  assert.ok(/^v-[0-9a-f]{24}$/.test(id), "id посетителя: v- и 24 hex: " + id);
  assert.notStrictEqual(A.newVisitorId(), id, "id случайны");
  assert.strictEqual(A.studentId("ilim"), "u-ilim");
  assert.ok(A.ID_RE.test(id) && A.ID_RE.test("u-ilim") && !A.ID_RE.test("x-1") && !A.ID_RE.test("v-../etc"),
    "ID_RE принимает v-/u- и режет чужое");
  const c = A.signChatId(id);
  assert.ok(c.startsWith(id + ".") && /\.[0-9a-f]{32}$/.test(c), "кука = id.hmac32");
  assert.strictEqual(A.parseChatCookie(c), id, "своя подпись читается");
  assert.strictEqual(A.parseChatCookie(B2.signChatId(id)), null, "подпись чужим секретом — мусор");
  assert.strictEqual(A.parseChatCookie(id), null, "без подписи — мусор");
  assert.strictEqual(A.parseChatCookie(c.slice(0, -1) + (c.endsWith("0") ? "1" : "0")), null, "битая подпись — мусор");
  assert.strictEqual(A.parseChatCookie(A.signChatId("u-ilim")), null, "ученический id в куке не принимается — только v-");
  assert.strictEqual(A.parseChatCookie(""), null); assert.strictEqual(A.parseChatCookie(undefined), null);
  const h = A.cookieHeader(id, true, 100);
  assert.ok(h.startsWith("kga1-chat=" + c + ";") && /HttpOnly/.test(h) && /SameSite=Lax/.test(h) && /Path=\//.test(h) && /Max-Age=100/.test(h) && /; Secure/.test(h),
    "заголовок куки: " + h);
  assert.ok(!/Secure/.test(A.cookieHeader(id, false, 100)), "без https нет Secure");
  assert.strictEqual(A.clearCookieHeader(), "kga1-chat=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0", "сброс куки — теми же атрибутами");
  console.log("  · auth ✓");
}

/* ---------- 2. inbox-store: файлы и данные (без сети) ---------- */
function testStore() {
  const { createInboxStore, LIMITS } = require("../server/inbox-store");
  const dir = path.join(DATA, "inbox-unit");
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const rid = () => "r" + (++n).toString(36).padStart(4, "0");
  const logs = [];
  const logger = { info: (...a) => logs.push(["info", ...a]), warn: (...a) => logs.push(["warn", ...a]), error: (...a) => logs.push(["error", ...a]) };
  const atomicWrite = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + ".tmp", data); fs.renameSync(file + ".tmp", file); };
  const S = createInboxStore({ dir, atomicWrite, rid, logger });

  // validateInput — границы
  const ok = S.validateInput({ text: "  Салам!  ", contact: " a@b.kg ", lang: "tr", page: "/blog/x/tr" });
  assert.deepStrictEqual(ok, { text: "Салам!", contact: "a@b.kg", lang: "tr", page: "/blog/x/tr" });
  assert.strictEqual(S.validateInput({ text: "" }).error, "empty text");
  assert.strictEqual(S.validateInput({ text: "x".repeat(LIMITS.MAX_TEXT + 1) }).error, "text too long");
  assert.strictEqual(S.validateInput({ text: "ok", contact: "x".repeat(LIMITS.MAX_CONTACT + 1) }).error, "contact too long");
  assert.strictEqual(S.validateInput({ text: "ok", lang: "xx" }).lang, "ru", "чужой язык → ru");
  assert.strictEqual(S.validateInput({ text: "ok", page: "javascript:alert(1)" }).page, "", "не путь → пусто");
  assert.strictEqual(S.validateInput({ text: "ok", page: "/blog/ru?utm=1" }).page, "", "query не путь → пусто (клиент шлёт pathname)");
  assert.strictEqual(S.validateInput({ text: "ok", page: "//evil.com/x" }).page, "", "протокол-относительный адрес — не наш путь");
  assert.strictEqual(S.validateInput({ text: "ok", page: "/" }).page, "/", "корень — путь");
  assert.strictEqual(S.validateInput({ text: "ok", page: "/./x" }).page, "", "точка после слэша — не путь");
  assert.strictEqual(S.validateInput({ text: "ok", page: "/" + "a".repeat(LIMITS.MAX_PAGE) }).page, "", "слишком длинный путь → пусто");
  assert.strictEqual(S.validateInput({ text: 5 }).error, "empty text", "не строка — пусто");

  // тред посетителя: создание, сообщения, непрочитанное
  const t = S.newThread({ id: "v-" + "0".repeat(24), kind: "visitor", lang: "tr", firstPage: "/blog/x/tr", contact: "" });
  assert.strictEqual(t.v, 1); assert.strictEqual(t.kind, "visitor"); assert.deepStrictEqual(t.messages, []);
  const m1 = S.appendMessage(t, "visitor", "Салам");
  assert.ok(m1.id && m1.ts && m1.from === "visitor" && m1.text === "Салам", "сообщение записано");
  assert.strictEqual(S.readThread(t.id).messages.length, 1, "тред на диске после appendMessage");
  assert.strictEqual(S.unreadFor(S.readThread(t.id), "teacher"), 1, "учителю 1 непрочитанное");
  assert.strictEqual(S.unreadFor(S.readThread(t.id), "visitor"), 0, "посетителю 0");
  S.appendMessage(S.readThread(t.id), "teacher", "Салам! Жооп.", "altynai");
  const t2 = S.readThread(t.id);
  assert.strictEqual(t2.messages[1].by, "altynai");
  assert.ok(t2.seenByTeacherAt, "ответ учителя = прочитано учителем");
  assert.strictEqual(S.unreadFor(t2, "teacher"), 0); assert.strictEqual(S.unreadFor(t2, "visitor"), 1);
  S.markSeen(t2, "visitor");
  assert.strictEqual(S.unreadFor(S.readThread(t.id), "visitor"), 0, "markSeen посетителя");

  // ученический тред и сводки
  const u = S.newThread({ id: "u-ilim", kind: "student", login: "ilim", lang: "ru", firstPage: "/", contact: "" });
  S.appendMessage(u, "visitor", "Суроо бар");
  const list = S.listSummaries();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, "u-ilim", "непрочитанный сверху");
  assert.deepStrictEqual(Object.keys(list[0]).sort(), ["contact", "count", "createdAt", "firstPage", "id", "kind", "lang", "last", "login", "unread", "updatedAt"].sort());
  assert.strictEqual(list[0].unread, 1); assert.strictEqual(list[1].unread, 0);
  assert.ok(!("messages" in list[0]), "сводка без полного списка сообщений");
  assert.deepStrictEqual(S.unreadForTeacher(), { threads: 1, messages: 1 });
  assert.strictEqual(S.readThread("nope"), null); assert.strictEqual(S.readThread("../x"), null, "чужой id не читается с диска");

  // обрезка сообщений
  for (let i = 0; i < LIMITS.MAX_MSGS + 5; i++) S.appendMessage(S.readThread(u.id), "visitor", "m" + i);
  assert.strictEqual(S.readThread(u.id).messages.length, LIMITS.MAX_MSGS, "не больше MAX_MSGS");
  assert.strictEqual(S.readThread(u.id).messages[LIMITS.MAX_MSGS - 1].text, "m" + (LIMITS.MAX_MSGS + 4), "остаются свежие");

  // индекс переживает новый экземпляр (файлы — источник истины)
  const S2 = createInboxStore({ dir, atomicWrite, rid, logger });
  assert.strictEqual(S2.listSummaries().length, 2, "индекс пересобирается сканом каталога");
  assert.strictEqual(S2.countVisitorThreads(), 1);

  // ретеншн: без ответа >90 дней — удалить; с ответом — держать до 365
  const old = S2.newThread({ id: "v-" + "1".repeat(24), kind: "visitor", lang: "ru", firstPage: "/", contact: "" });
  S2.appendMessage(old, "visitor", "давно");
  const o = S2.readThread(old.id); o.updatedAt = new Date(Date.now() - 100 * 86400000).toISOString(); S2.writeThread(o);
  const t3 = S2.readThread(t.id); t3.updatedAt = new Date(Date.now() - 100 * 86400000).toISOString(); S2.writeThread(t3); // отвеченный
  const removed = S2.sweep(Date.now());
  assert.strictEqual(removed, 1, "снесён ровно один тред");
  assert.strictEqual(S2.readThread(old.id), null, "неотвеченный старше 90 дней удалён");
  assert.ok(S2.readThread(t.id), "отвеченный держится до 365 дней");
  assert.ok(S2.readThread(u.id), "ученический не трогаем");
  // атомарная правка по id: читает свежий файл перед записью (гонка «снимок до ожидания тела»)
  const raceT = S2.newThread({ id: "v-" + "2".repeat(24), kind: "visitor", lang: "ru", firstPage: "/", contact: "" });
  const stale = S2.readThread(raceT.id);
  S2.appendMessageById(raceT.id, "visitor", "первое");
  S2.appendMessageById(raceT.id, "teacher", "второе", "altynai");
  assert.strictEqual(S2.readThread(raceT.id).messages.length, 2, "appendMessageById не теряет чужих записей");
  assert.strictEqual(stale.messages.length, 0, "старый снимок не участвует в записи");
  assert.strictEqual(S2.appendMessageById("v-" + "3".repeat(24), "visitor", "нет"), null, "нет треда — null, файла не создаёт");
  S2.markSeenById(raceT.id, "visitor");
  assert.strictEqual(S2.unreadFor(S2.readThread(raceT.id), "visitor"), 0);
  // отметка «прочитано» не отстаёт от показанных писем: письмо с ts позже часов сервера
  // (та же миллисекунда, сдвиг часов) всё равно считается прочитанным после markSeen
  const late = S2.readThread(raceT.id);
  S2.appendMessage(late, "visitor", "поздний ts");
  const late2 = S2.readThread(raceT.id); late2.messages[late2.messages.length - 1].ts = new Date(Date.now() + 5000).toISOString(); S2.writeThread(late2);
  S2.markSeenById(raceT.id, "teacher");
  assert.strictEqual(S2.unreadFor(S2.readThread(raceT.id), "teacher"), 0, "seen = не раньше ts последнего показанного письма");
  // архив треда при переиспользовании логина: файл уходит в .bak, из индекса исчезает
  assert.strictEqual(S2.archive("u-ilim"), true);
  assert.strictEqual(S2.readThread("u-ilim"), null, "тред ученика после архива не читается");
  assert.ok(fs.readdirSync(dir).some((f) => /^u-ilim\.json\..*\.bak$/.test(f)), "файл переехал в .bak");
  assert.ok(!S2.listSummaries().some((x) => x.id === "u-ilim"), "и из сводок исчез");
  assert.strictEqual(S2.archive("u-nikogo"), false, "нечего архивировать — false");
  // старый архив уходит по сроку хранения отвеченных тредов
  const bakName = fs.readdirSync(dir).find((f) => /^u-ilim\.json\..*\.bak$/.test(f));
  const oldT = new Date(Date.now() - 400 * 86400000); fs.utimesSync(path.join(dir, bakName), oldT, oldT);
  assert.ok(S2.sweep(Date.now()) >= 1, "sweep снёс просроченный архив");
  assert.ok(!fs.existsSync(path.join(dir, bakName)), "архив старше срока удалён");
  console.log("  · store ✓");
}

/* ---------- 3–6. Живой сервер: цикл, кука, роли, границы, лимиты, логи ---------- */
const { startServer } = require("./helpers/serve");
const LOG_HEAD_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[[a-z0-9-]+\] (INFO|WARN|ERROR|DEBUG): /;
const STACK_RE = /^(\s+at |Error|[A-Za-z]+Error|Caused by)/;
const cookieOf = (r) => { const sc = r.headers.get("set-cookie") || ""; const m = sc.match(/kga1-chat=([^;]+)/); return m ? m[1] : null; };
const J = (r) => JSON.parse(r.text);

async function testHttp(srv) {
  {
    const req = srv.req;
    // 3. аноним: тред + кука
    const p1 = await req("POST", "/api/chat", { body: { text: "Салам! Суроо бар.", lang: "tr", page: "/blog/kak-uchit/tr", contact: "a@b.kg" } });
    assert.strictEqual(p1.status, 200, "аноним пишет: " + p1.text);
    const c1 = cookieOf(p1);
    assert.ok(c1 && /^v-[0-9a-f]{24}\.[0-9a-f]{32}$/.test(c1), "выдана подписанная кука kga1-chat: " + p1.headers.get("set-cookie"));
    assert.ok(/HttpOnly/.test(p1.headers.get("set-cookie")) && /SameSite=Lax/.test(p1.headers.get("set-cookie")), "флаги куки");
    const vid = c1.split(".")[0];
    assert.strictEqual(J(p1).id, vid);
    const g1 = await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 });
    assert.strictEqual(g1.status, 200);
    assert.strictEqual(J(g1).thread.messages.length, 1, "посетитель видит своё сообщение");
    assert.strictEqual(J(g1).thread.lang, "tr"); assert.strictEqual(J(g1).unread, 0);
    assert.ok(!("seenByTeacherAt" in J(g1).thread) && !("v" in J(g1).thread), "посетителю — проекция треда, не файл целиком");
    // второе сообщение той же кукой — тот же тред, новой куки не выдаётся
    const p2 = await req("POST", "/api/chat", { body: { text: "Дагы бир суроо" }, cookie: "kga1-chat=" + c1 });
    assert.strictEqual(p2.status, 200); assert.strictEqual(J(p2).id, vid, "тот же тред"); assert.strictEqual(cookieOf(p2), null, "повторной Set-Cookie нет");
    // без куки — пусто; поддельные куки — как без куки; поддельная при POST даёт НОВЫЙ тред
    assert.deepStrictEqual(J(await req("GET", "/api/chat")), { thread: null }, "аноним без куки — пусто");
    for (const fake of ["kga1-chat=" + vid, "kga1-chat=" + vid + "." + "0".repeat(32), "kga1-chat=%ZZ", "kga1-chat=" + c1.slice(0, -1) + (c1.endsWith("a") ? "b" : "a")])
      assert.strictEqual(J(await req("GET", "/api/chat", { cookie: fake })).thread, null, "поддельная кука пуста: " + fake.slice(0, 40));
    const p3 = await req("POST", "/api/chat", { body: { text: "чужак" }, cookie: "kga1-chat=" + vid + "." + "0".repeat(32) });
    assert.strictEqual(p3.status, 200); assert.notStrictEqual(J(p3).id, vid, "подделка создаёт свой тред, чужой не тронут");
    assert.strictEqual(J(await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 })).thread.messages.length, 2, "чужой тред не изменился");
    // валидная подпись, файла нет (ретеншн) → пусто + сброс куки
    const gone = await req("GET", "/api/chat", { cookie: "kga1-chat=" + J(p3).id + "." + cookieOf(p3).split(".")[1] });
    assert.strictEqual(gone.status, 200); // тред p3 существует — это контроль формы
    fs.unlinkSync(path.join(DATA, "inbox", J(p3).id + ".json"));
    const gone2 = await req("GET", "/api/chat", { cookie: "kga1-chat=" + cookieOf(p3) });
    assert.strictEqual(J(gone2).thread, null); assert.ok(/Max-Age=0/.test(gone2.headers.get("set-cookie") || ""), "кука без треда сбрасывается");

    // 4. приостановленный ученик пишет, остальное ему закрыто
    const SUS = B("sus", "Sus-2026");
    const mk = await req("PUT", "/api/students", { auth: ALT, body: { login: "sus", create: true, password: "Sus-2026" } });
    assert.strictEqual(mk.status, 200, "ученик sus создан: " + mk.text);
    const sp = await req("PUT", "/api/students", { auth: ALT, body: { login: "sus", suspended: true } });
    assert.strictEqual(sp.status, 200, "приостановлен: " + sp.text);
    assert.strictEqual((await req("GET", "/api/me", { auth: SUS })).status, 403, "приостановленному API закрыто");
    const ps = await req("POST", "/api/chat", { auth: SUS, body: { text: "Ачып бериңизчи" } });
    assert.strictEqual(ps.status, 200, "приостановленный может написать преподавателю: " + ps.text);
    assert.strictEqual(J(ps).id, "u-sus"); assert.strictEqual(cookieOf(ps), null, "вошедшему кука не нужна");

    // 5. ученик: свой тред; учитель: список, тред, ответ, seen, счётчик
    assert.strictEqual(J(await req("GET", "/api/chat", { auth: ILIM })).thread, null, "у Илима пока пусто");
    assert.strictEqual((await req("POST", "/api/chat", { auth: ILIM, body: { text: "Мугалим, суроо" } })).status, 200);
    const gi = J(await req("GET", "/api/chat", { auth: ILIM }));
    assert.strictEqual(gi.thread.id, "u-ilim"); assert.strictEqual(gi.thread.kind, "student"); assert.strictEqual(gi.thread.messages.length, 1);
    assert.strictEqual((await req("GET", "/api/chat/threads", { auth: ILIM })).status, 403, "ученику список закрыт");
    assert.strictEqual((await req("GET", "/api/chat/threads")).status, 401, "анониму список закрыт");
    assert.strictEqual((await req("GET", "/api/chat/threads/u-ilim", { auth: ILIM })).status, 403);
    const me = J(await req("GET", "/api/me", { auth: ALT }));
    assert.deepStrictEqual(me.chat, { unread: 3 }, "у учителя в /api/me счётчик непрочитанных тредов: " + JSON.stringify(me.chat));
    assert.ok(!("chat" in J(await req("GET", "/api/me", { auth: ILIM }))), "у ученика поля chat нет");
    const lst = J(await req("GET", "/api/chat/threads?state=unread", { auth: ALT }));
    assert.strictEqual(lst.length, 3, "три треда с непрочитанным (посетитель, sus, ilim)");
    assert.ok(lst.every((s) => s.unread > 0 && !s.messages), "сводки без тел");
    const v = lst.find((s) => s.id === vid);
    assert.strictEqual(v.kind, "visitor"); assert.strictEqual(v.lang, "tr"); assert.strictEqual(v.firstPage, "/blog/kak-uchit/tr"); assert.strictEqual(v.contact, "a@b.kg"); assert.strictEqual(v.unread, 2);
    assert.strictEqual((await req("GET", "/api/chat/threads/v-" + "f".repeat(24), { auth: ALT })).status, 404, "нет треда — 404");
    assert.strictEqual((await req("GET", "/api/chat/threads/..%2Fstudents", { auth: ALT })).status, 404, "id вне шаблона — 404");
    const full = J(await req("GET", "/api/chat/threads/" + vid, { auth: ALT }));
    assert.strictEqual(full.messages.length, 2); assert.strictEqual(full.messages[0].text, "Салам! Суроо бар.");
    assert.strictEqual((await req("POST", "/api/chat/threads/" + vid + "/reply", { auth: ALT, body: { text: "" } })).status, 400, "пустой ответ");
    const rp = await req("POST", "/api/chat/threads/" + vid + "/reply", { auth: ALT, body: { text: "Салам! Жооп берем." } });
    assert.strictEqual(rp.status, 200, "ответ учителя: " + rp.text); assert.strictEqual(J(rp).msg.by, "altynai");
    assert.strictEqual(J(await req("GET", "/api/chat/threads?state=unread", { auth: ALT })).length, 2, "отвеченный тред ушёл из непрочитанных");
    assert.deepStrictEqual(J(await req("GET", "/api/chat/unread", { auth: ALT })), { threads: 2, messages: 2 });
    const g3 = J(await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 }));
    assert.strictEqual(g3.thread.messages.length, 3); assert.strictEqual(g3.unread, 1, "посетитель видит непрочитанный ответ");
    assert.strictEqual(g3.thread.messages[2].from, "teacher");
    assert.ok(!("by" in g3.thread.messages[2]), "логин преподавателя посетителю не отдаётся");
    assert.strictEqual(J(await req("POST", "/api/chat/seen", { cookie: "kga1-chat=" + c1, body: {} })).unread, 0);
    assert.strictEqual(J(await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 })).unread, 0, "seen посетителя");
    assert.strictEqual((await req("POST", "/api/chat/seen", { body: {} })).status, 200, "seen без треда — 200");
    assert.strictEqual((await req("POST", "/api/chat/threads/u-ilim/seen", { auth: ALT, body: {} })).status, 200);
    assert.strictEqual(J(await req("GET", "/api/chat/unread", { auth: ALT })).threads, 1, "seen учителя снимает тред");
    // учитель отвечает ученику — ученик видит; второй ученик не видит
    assert.strictEqual((await req("POST", "/api/chat/threads/u-ilim/reply", { auth: ALT, body: { text: "Жооп Илимге" } })).status, 200);
    assert.strictEqual(J(await req("GET", "/api/chat", { auth: ILIM })).unread, 1);
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "aida", create: true, password: "Aida-2026" } })).status, 200);
    assert.strictEqual(J(await req("GET", "/api/chat", { auth: B("aida", "Aida-2026") })).thread, null, "чужой ученик своего чужого не видит");
    // переиспользование логина: новый владелец не получает переписку прежнего (ревью 06.09)
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tmp1", create: true, password: "Tmp1-2026" } })).status, 200);
    assert.strictEqual((await req("POST", "/api/chat", { auth: B("tmp1", "Tmp1-2026"), body: { text: "секрет первого владельца" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tmp1", remove: true } })).status, 200, "логин удалён");
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tmp1", create: true, password: "Tmp1-new" } })).status, 200, "логин заведён заново");
    assert.strictEqual(J(await req("GET", "/api/chat", { auth: B("tmp1", "Tmp1-new") })).thread, null, "новому владельцу логина чужая переписка не видна");
    assert.ok(fs.readdirSync(path.join(DATA, "inbox")).some((f) => /^u-tmp1\.json\..*\.bak$/.test(f)), "старый тред ушёл в архив, не удалён");
    assert.ok(!J(await req("GET", "/api/chat/threads?state=all", { auth: ALT })).some((x) => x.id === "u-tmp1"), "у учителя в списке его тоже нет");
    // удалённая учётка: переписка в архив, у учителя в списке её нет
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tmp2", create: true, password: "Tmp2-2026" } })).status, 200);
    assert.strictEqual((await req("POST", "/api/chat", { auth: B("tmp2", "Tmp2-2026"), body: { text: "до удаления" } })).status, 200);
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT, body: { login: "tmp2", remove: true } })).status, 200);
    assert.ok(!J(await req("GET", "/api/chat/threads?state=all", { auth: ALT })).some((x) => x.id === "u-tmp2"), "переписка удалённого ученика ушла из списка");
    assert.ok(fs.readdirSync(path.join(DATA, "inbox")).some((f) => /^u-tmp2\.json\..*\.bak$/.test(f)), "…и лежит в архиве");
    // преподаватель не пишет сам себе через публичный маршрут — только из панели
    assert.strictEqual((await req("POST", "/api/chat", { auth: ALT, body: { text: "себе" } })).status, 400, "учителю POST /api/chat закрыт");
    // тред учителя (t-…) не заводится: учитель пишет из панели, не как ученик
    const on = JSON.parse(fs.readFileSync(path.join(DATA, "inbox", "u-ilim.json"), "utf8"));
    assert.strictEqual(on.v, 1); assert.strictEqual(on.kind, "student"); assert.strictEqual(on.login, "ilim"); assert.strictEqual(on.messages.length, 2, "файл на диске той формы");

    // 6. границы
    assert.strictEqual((await req("POST", "/api/chat", { body: "null", raw: true, ct: "application/json" })).status, 400, "null не роняет процесс");
    assert.strictEqual((await req("POST", "/api/chat", { body: {} })).status, 400);
    assert.strictEqual((await req("POST", "/api/chat", { body: { text: "x".repeat(2001) } })).status, 400);
    assert.strictEqual((await req("POST", "/api/chat", { body: { text: "ok", contact: "x".repeat(121) } })).status, 400);
    assert.strictEqual((await req("POST", "/api/chat", { body: "{" + "\"a\":\"" + "x".repeat(1024 * 1024 + 10) + "\"}", raw: true, ct: "application/json" })).status, 413);
    const before = fs.readdirSync(path.join(DATA, "inbox")).length;
    const hp = await req("POST", "/api/chat", { body: { text: "spam", hp: "http://x" } });
    assert.strictEqual(hp.status, 200); assert.strictEqual(cookieOf(hp), null);
    assert.strictEqual(fs.readdirSync(path.join(DATA, "inbox")).length, before, "honeypot: 200, но записи нет");
    const jsx = await req("POST", "/api/chat", { body: { text: "p", page: "javascript:x", lang: "xx" }, headers: { "x-forwarded-for": "10.9.9.9" } });
    const jsT = J(await req("GET", "/api/chat/threads/" + J(jsx).id, { auth: ALT }));
    assert.strictEqual(jsT.firstPage, ""); assert.strictEqual(jsT.lang, "ru");
    // лимиты: новых тредов с одного IP — 5/час
    let last;
    for (let i = 0; i < 6; i++) last = await req("POST", "/api/chat", { body: { text: "n" + i }, headers: { "x-forwarded-for": "10.1.1.1" } });
    assert.strictEqual(last.status, 429, "6-й новый тред с IP за час — 429"); assert.ok(last.headers.get("retry-after"), "Retry-After");
    assert.strictEqual((await req("POST", "/api/chat", { body: { text: "ok" }, headers: { "x-forwarded-for": "10.1.1.2" } })).status, 200, "другой IP не задет");
    // сообщений в один тред — 30/10 мин (существующий тред, кука с1: уже 2 от посетителя)
    for (let i = 0; i < 40 && last.status !== 429; i++) last = await req("POST", "/api/chat", { body: { text: "m" + i }, cookie: "kga1-chat=" + c1, headers: { "x-forwarded-for": "10.2.2." + (i % 7) } });
    assert.strictEqual(last.status, 429, "поток в один тред упирается в лимит треда");
    // гонка: тело первого запроса приходит по частям, второй успевает записаться между
    // чтением снимка и записью — оба сообщения обязаны остаться
    const c1len = J(await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 })).thread.messages.length;
    const http = require("http");
    const slow = new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify({ text: "медленное сообщение" });
      const rq = http.request({ host: "localhost", port: 8225, path: "/api/chat", method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(bodyStr), cookie: "kga1-chat=" + c1, "x-forwarded-for": "10.7.7.1" } },
        (r) => { let d = ""; r.on("data", (c) => d += c); r.on("end", () => resolve({ status: r.statusCode, text: d })); });
      rq.on("error", reject);
      rq.write(bodyStr.slice(0, 10));
      setTimeout(async () => {
        const fast = await req("POST", "/api/chat", { body: { text: "быстрое сообщение" }, cookie: "kga1-chat=" + c1, headers: { "x-forwarded-for": "10.7.7.2" } });
        assert.strictEqual(fast.status, 200, "быстрое принято: " + fast.text);
        rq.end(bodyStr.slice(10));
      }, 250);
    });
    assert.strictEqual((await slow).status, 200, "медленное принято");
    const afterRace = J(await req("GET", "/api/chat", { cookie: "kga1-chat=" + c1 })).thread.messages;
    assert.strictEqual(afterRace.length, c1len + 2, "оба сообщения на месте — снимок перечитан перед записью");
    assert.ok(afterRace.some((m) => m.text === "быстрое сообщение") && afterRace.some((m) => m.text === "медленное сообщение"));
    // лимит сообщений с одного IP (40/10 мин) — через пять тредов, чтобы не упереться в лимит треда
    const IPX = { "x-forwarded-for": "10.5.5.5" }; const cks = [];
    for (let i = 0; i < 5; i++) { const r = await req("POST", "/api/chat", { body: { text: "t" + i }, headers: IPX }); assert.strictEqual(r.status, 200); cks.push(cookieOf(r)); }
    let ipLast;
    for (let i = 0; i < 40; i++) { ipLast = await req("POST", "/api/chat", { body: { text: "x" + i }, cookie: "kga1-chat=" + cks[i % 5], headers: IPX }); if (ipLast.status === 429) break; }
    assert.strictEqual(ipLast.status, 429, "41-е сообщение с одного IP за 10 минут — 429");
    assert.strictEqual(ipLast.headers.get("retry-after"), "600");
    // потолок визитёрских тредов (в тесте занижен через KGA1_CHAT_MAX_VISITOR_THREADS)
    let fullLast;
    for (let i = 0; i < 30; i++) { fullLast = await req("POST", "/api/chat", { body: { text: "f" + i }, headers: { "x-forwarded-for": "10.8." + i + ".1" } }); if (fullLast.status === 429) break; }
    assert.strictEqual(fullLast.status, 429, "потолок тредов даёт 429");
    assert.strictEqual(J(fullLast).error, "inbox full"); assert.strictEqual(fullLast.headers.get("retry-after"), "86400");
    assert.ok(srv.logs.some((l) => /\[chat\] WARN: inbox full/.test(l)), "переполнение логируется");
    // логи: контракт и ни одного текста сообщения
    const bad = srv.logs.filter((l) => !LOG_HEAD_RE.test(l) && !STACK_RE.test(l));
    assert.deepStrictEqual(bad, [], "строки вне контракта логов: " + JSON.stringify(bad));
    assert.ok(srv.logs.some((l) => /\[chat\] INFO: message \{/.test(l)), "сообщение логируется");
    assert.ok(srv.logs.some((l) => /\[chat\] WARN: honeypot/.test(l)), "honeypot логируется");
    assert.ok(!srv.logs.some((l) => /Суроо бар|Жооп берем|a@b\.kg|медленное|быстрое/.test(l)), "текст и контакт в логи не попадают");
    console.log("  · http ✓");
  }
}

/* ---------- 7. Виджет /chat.js и его подключение на всех публичных страницах ---------- */
async function testWidget(srv) {
  const req = srv.req;
  const js = await req("GET", "/chat.js");
  assert.strictEqual(js.status, 200, "/chat.js отдаётся анониму");
  assert.ok(/^text\/javascript/.test(js.headers.get("content-type")), "тип text/javascript: " + js.headers.get("content-type"));
  assert.ok(/max-age=86400/.test(js.headers.get("cache-control")), "кэш на сутки (адрес версионирован): " + js.headers.get("cache-control"));
  const et = js.headers.get("etag"); assert.ok(et, "ETag есть");
  assert.strictEqual((await req("GET", "/chat.js", { etag: et })).status, 304, "If-None-Match → 304");
  new vm.Script(js.text); // синтаксис
  assert.ok(!/innerHTML/.test(js.text), "innerHTML запрещён");
  assert.ok(/\.kgc-panel\[hidden\][^}]*display:none!important/.test(js.text),
    "hidden у панели перебивает display:flex класса — закрытая панель реально исчезает (баг владельца 06.09)");
  assert.ok(/wa\.me\/996505854856/.test(js.text), "WhatsApp остаётся второй кнопкой");
  assert.ok(/class: "kgc-wafab", href: WA, target: "_blank"/.test(js.text) && /\.kgc-wafab\{position:fixed/.test(js.text),
    "WhatsApp — отдельная плавающая ссылка в один клик, а не только внутри панели");
  assert.ok(/fetch\("\/api\/chat/.test(js.text), "виджет ходит абсолютным путём /api/chat (страницы глубины 2)");
  const im = js.text.match(/\/\* ===CHAT-WIDGET-I18N=== \*\/([\s\S]*?)\/\* ===\/CHAT-WIDGET-I18N=== \*\//);
  assert.ok(im, "маркер словаря виджета");
  const sb = {}; vm.createContext(sb); vm.runInContext(im[1] + "; this.T=T;", sb);
  const keys = Object.keys(sb.T.ru).sort();
  for (const l of ["en", "tr"]) assert.deepStrictEqual(Object.keys(sb.T[l]).sort(), keys, "паритет ключей словаря виджета: " + l);
  for (const k of ["open", "title", "intro", "ph", "contactPh", "send", "sent", "wa", "empty", "you", "teacher", "close", "err", "privacy"])
    assert.ok(keys.includes(k), "ключ словаря " + k);
  const allText = ["ru", "en", "tr"].map((l) => Object.values(sb.T[l]).join(" ")).join(" ");
  assert.ok(!/сом|руб|₽|\$|€|tenge|som\b/i.test(allText), "цен в виджете нет");
  assert.ok(!/в течение|within \d|saat içinde|минут|minutes|dakika/i.test(allText), "сроков ответа не обещаем");
  // подключение: ровно один тег на каждой публичной странице sitemap (кроме демо) и на документах
  const sm = (await req("GET", "/sitemap.xml")).text;
  const locs = [...sm.matchAll(/<loc>https:\/\/learn\.kg([^<]*)<\/loc>/g)].map((m) => m[1] || "/").filter((u) => !u.startsWith("/demo"));
  assert.ok(locs.length > 100, "sitemap отдан: " + locs.length);
  // тег версионирован хешем исходников виджета — один и тот же на всех страницах, включая витрину
  const tagRe = /<script src="\/chat\.js\?v=[0-9a-f]{8}" defer><\/script>/g;
  const vers = new Set();
  for (const u of locs.concat(["/privacy", "/terms", "/install"])) {
    const r = await req("GET", u, { al: "ru" });
    const status = r.status === 301 ? (await req("GET", r.headers.get("location"))).status : r.status;
    const html = r.status === 301 ? (await req("GET", r.headers.get("location"))).text : r.text;
    assert.strictEqual(status, 200, u + " отдаётся");
    assert.strictEqual((html.match(tagRe) || []).length, 1, u + ": ровно один тег виджета");
    vers.add(html.match(tagRe)[0]);
  }
  assert.strictEqual(vers.size, 1, "версия тега одна на весь сайт: " + [...vers].join(" | "));
  assert.strictEqual((await req("GET", "/chat.js" + [...vers][0].match(/\?v=[0-9a-f]{8}/)[0])).status, 200, "адрес с версией отдаётся");
  assert.strictEqual(((await req("GET", "/demo/ru")).text.match(tagRe) || []).length, 0, "в демо-тренажёре виджета нет — там своя панель");
  console.log("  · widget ✓");
  // политика конфиденциальности называет куку и сроки теми же числами, что и код
  const { LIMITS } = require("../server/inbox-store");
  const priv = fs.readFileSync(path.join(__dirname, "..", "app", "privacy.html"), "utf8");
  assert.strictEqual((priv.match(/kga1-chat/g) || []).length >= 6, true, "cookie kga1-chat названа во всех трёх языках политики (данные + cookie)");
  for (const n of [LIMITS.KEEP_UNANSWERED_DAYS, 180]) assert.ok(new RegExp("\\b" + n + "\\b").test(priv), "политика называет срок " + n);
  for (const l of ["ru", "en", "tr"]) await testWidgetDom(js.text, sb.T, l);   // виджет на странице каждого языка
}

/* ---------- 8. Виджет исполняется в vm на бутафорском DOM: поведение, а не текст ---------- */
function testWidgetDom(src, T, lang) {
  const { doc, q } = fakeDom();
  doc.documentElement.lang = lang;
  const net = []; let failPost = false;
  const thread = { id: "v-1", kind: "visitor", lang: "ru", contact: "", messages: [{ id: "m1", ts: "2026-09-06T08:00:00.000Z", from: "teacher", text: "Жооп" }] };
  const sb = { console, document: doc, location: { pathname: "/blog/x/ru" }, observers: [],
    MutationObserver: class { constructor(f) { sb.observers.push(f); } observe() {} },
    setInterval: (f, ms) => { sb.__poll = ms; return 5; }, clearInterval: (id) => { sb.__pollStopped = id; },
    fetch: (u, o) => { const m = (o && o.method) || "GET"; net.push([u, m, o && o.body ? JSON.parse(o.body) : null]);
      if (m === "POST" && u === "/api/chat" && failPost) return Promise.reject(new Error("net"));
      const body = u === "/api/chat" && m === "GET" ? { thread, unread: 1 } : m === "POST" && u === "/api/chat" ? { ok: true, id: "v-1", msg: { id: "m2", ts: "2026-09-06T09:00:00.000Z" } } : { ok: true };
      return Promise.resolve({ status: 200, json: () => Promise.resolve(body) }); } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(src, sb);
  const tick = () => new Promise((r) => setImmediate(r));
  return (async () => {
    await tick(); await tick();
    const fab = doc.body.querySelector(".kgc-fab"), wafab = doc.body.querySelector(".kgc-wafab"), badge = fab.querySelector(".kgc-badge");
    assert.ok(fab && wafab, "две плавающие кнопки в документе");
    assert.strictEqual(wafab.attrs.href.indexOf("https://wa.me/"), 0, "WhatsApp — ссылка в один клик");
    assert.strictEqual(badge.textContent, "1"); assert.ok(!badge.hidden, "бейдж непрочитанного после загрузки");
    assert.ok(/1/.test(fab.attrs["aria-label"]), "счётчик озвучивается в aria-label кнопки");
    fab.dispatch("click"); await tick(); await tick();
    const panel = doc.body.querySelector(".kgc-panel");
    assert.ok(panel && !panel.hidden, "клик открывает панель"); assert.strictEqual(fab.attrs["aria-expanded"], "true");
    assert.strictEqual(doc.activeElement, panel.querySelector(".kgc-x"), "фокус — на кнопке закрытия");
    assert.ok(net.some(([u, m]) => u === "/api/chat/seen" && m === "POST"), "открытие помечает ответ прочитанным");
    assert.ok(badge.hidden, "бейдж погас");
    assert.strictEqual(panel.querySelectorAll(".kgc-msg").length, 1, "ответ преподавателя показан");
    const area = panel.querySelector("textarea"); area.value = "Салам!";
    panel.querySelector(".kgc-send").dispatch("click"); await tick(); await tick();
    const post = net.find(([u, m]) => u === "/api/chat" && m === "POST");
    assert.deepStrictEqual([post[2].text, post[2].lang, post[2].page, post[2].hp], ["Салам!", lang, "/blog/x/ru", ""], "тело отправки: текст, язык страницы, страница, пустой honeypot");
    assert.strictEqual(panel.querySelectorAll(".kgc-msg").length, 2, "своё сообщение дописано локально");
    assert.strictEqual(panel.querySelector(".kgc-status").textContent, T[lang].sent, "статус «отправлено» на языке страницы");
    assert.strictEqual(fab.attrs.title, T[lang].open); assert.strictEqual(wafab.attrs["aria-label"], T[lang].wa, "подписи кнопок на языке страницы");
    assert.strictEqual(area.value, "", "поле очищено");
    doc.dispatch("keydown", { key: "Escape" });
    assert.ok(panel.hidden, "Esc закрывает"); assert.strictEqual(doc.activeElement, fab, "фокус вернулся на кнопку"); assert.strictEqual(sb.__pollStopped, 5, "опрос остановлен");
    fab.dispatch("click"); await tick();
    doc.dispatch("click", { target: panel.querySelector("textarea") });
    assert.ok(!panel.hidden, "клик внутри панели не закрывает");
    doc.dispatch("click", { target: doc.body });
    assert.ok(panel.hidden, "клик вне панели закрывает");
    fab.dispatch("click"); await tick();
    failPost = true; area.value = "ещё"; panel.querySelector(".kgc-send").dispatch("click"); await tick(); await tick();
    assert.strictEqual(panel.querySelector(".kgc-status").textContent, T[lang].err, "сбой сети — понятный статус, панель жива");
    const other = lang === "en" ? "tr" : "en";
    doc.documentElement.lang = other; sb.observers.forEach((f) => f());
    assert.strictEqual(fab.attrs["aria-label"], T[other].open, "смена языка страницы перерисовывает подписи");
    assert.strictEqual(panel.querySelector("#kgc-title").textContent, T[other].title);
    console.log("  · widget-dom " + lang + " ✓");
  })();
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  try {
    testAuth();
    testStore();
    fs.writeFileSync(path.join(DATA, "students.json"), JSON.stringify({ ilim: { courses: ["a1"] }, sus: { courses: ["a1"], suspended: true } }));
    const srv = await startServer({ port: 8225, dataDir: DATA, env: { KGA1_CHAT_MAX_VISITOR_THREADS: "40", KGA1_CHAT_SWEEP_AUTO: "0" } });
    try {
      await testHttp(srv);
      await testWidget(srv);
    } finally { srv.stop({ keepData: true }); }
    console.log("chat.test.js: OK (подпись куки, хранилище, HTTP-цикл аноним/ученик/учитель, границы, лимиты, логи, виджет на всех страницах)");
  } finally { fs.rmSync(DATA, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
