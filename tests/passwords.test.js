"use strict";
/* Пароли в хэшах и лимит Basic-входа (ревью кодовой базы 25.09.2026).
   - Учётки хранятся как scrypt-хэши: оверлей /data/users-extra.json мигрирует при старте,
     новые и сменённые пароли пишутся хэшем, база users.json принимает хэш (и открытый
     пароль — как наследие, с предупреждением).
   - Миграция не разлогинивает: cookie, подписанная прежним открытым паролем, живёт
     до конца своего срока; смена пароля отзывает и её.
   - Перебор пароля через заголовок Basic ограничен по адресу так же, как форма входа. */
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");
const { hashPassword, hashPasswordAsync, verifyPassword, verifyPasswordAsync, isHashed } = require("../server/passwords");

const PORT = 8235;
const DATA = "/tmp/kga1-passwords-" + process.pid;
const USERS = DATA + "-users.json";
const SECRET = "test-session-secret-0001";
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
// cookie, как её подписывал сервер до хэшей: HMAC(секрет, login|открытый пароль)
const legacyCookie = (login, plain) =>
  "kga1=" + login + "." + crypto.createHmac("sha256", SECRET).update(login + "|" + plain).digest("hex").slice(0, 32);
const cookieOf = (r) => ((r.headers.get("set-cookie") || "").match(/kga1=([^;]*)/) || [])[1];

(async () => {
  /* 0. Модуль хэшей сам по себе */
  {
    const h = hashPassword("Stu-12345");
    assert.ok(isHashed(h) && !h.includes("Stu-12345"), "хэш не содержит пароля");
    assert.notStrictEqual(hashPassword("Stu-12345"), h, "соль случайная: одинаковые пароли — разные хэши");
    assert.strictEqual(verifyPassword(h, "Stu-12345"), true, "верный пароль проходит");
    assert.strictEqual(verifyPassword(h, "Stu-12346"), false, "неверный — нет");
    assert.strictEqual(verifyPassword(h, "Stu-12345"), true, "повторная проверка (кэш) — та же");
    assert.strictEqual(verifyPassword("plain-1", "plain-1"), true, "открытый пароль-наследие сверяется");
    assert.strictEqual(verifyPassword("scrypt$broken", "x"), false, "битый хэш — отказ, а не исключение");
    // асинхронные версии дают тот же ответ и совместимы с синхронными
    const ha = await hashPasswordAsync("Stu-12345");
    assert.strictEqual(await verifyPasswordAsync(ha, "Stu-12345"), true, "async-хэш проверяется async");
    assert.strictEqual(verifyPassword(ha, "Stu-12345"), true, "и синхронно");
    assert.strictEqual(await verifyPasswordAsync(h, "Stu-12346"), false, "неверный async — нет");
    assert.strictEqual(await verifyPasswordAsync("scrypt$broken", "x"), false, "битый хэш async — отказ");
    // async-проверка не держит основной поток: пока идёт scrypt, цикл событий крутится
    // (вход формой и миграция сервера идут через неё — сервер в это время отвечает другим)
    let ticks = 0, spinning = true;
    const spin = () => { if (!spinning) return; ticks++; setImmediate(spin); };
    spin();
    await verifyPasswordAsync(ha, "wrong-pass");
    spinning = false;
    assert.ok(ticks > 1, "за время одной async-проверки цикл событий прокрутился " + ticks + " раз");
  }

  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, "session-secret"), SECRET);
  const bulk = {};
  for (let i = 0; i < 40; i++) bulk["bulk" + i] = { password: "Bulk-" + i + "-pass", role: "student" };
  fs.writeFileSync(path.join(DATA, "users-extra.json"), JSON.stringify(Object.assign(bulk, {
    stu1: { password: "Stu-12345", role: "student" },
    tch1: { password: "Tch-12345", role: "teacher" },
  })));
  fs.writeFileSync(USERS, JSON.stringify({
    adm: { password: hashPassword("Adm-12345"), role: "admin" },
    adm2: { password: "Adm2-12345", role: "admin" },   // наследие: открытый пароль в базе
  }));
  const srv = await startServer({ port: PORT, dataDir: DATA, usersFile: USERS });
  const req = srv.req;
  const extra = () => JSON.parse(fs.readFileSync(path.join(DATA, "users-extra.json"), "utf8"));
  try {
    /* 1а. Миграция идёт в фоне: сервер уже отвечает, а пароль, сменённый через API за время
          хэширования, миграция не перетирает (перечитывает файл перед записью) */
    const raced = await req("PUT", "/api/students", { auth: B("adm", "Adm-12345"), body: { login: "bulk39", password: "Raced-12345" } });
    assert.strictEqual(raced.status, 200, "смена пароля во время миграции принята");
    for (let i = 0; i < 100 && !srv.logs.some((l) => /passwords hashed/.test(l)); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(srv.logs.some((l) => /passwords hashed .*"skipped":1/.test(l)),
      "гонка действительно была: смена пароля пришла посреди миграции, и её запись пропущена");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("bulk39", "Raced-12345") })).status, 200, "новый пароль пережил миграцию");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("bulk39", "Bulk-39-pass") })).status, 401, "старый не воскрес");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("bulk7", "Bulk-7-pass") })).status, 200, "соседние учётки мигрировали и входят");
    /* 1. Миграция оверлея при старте: открытых паролей в файле не осталось */
    {
      const raw = fs.readFileSync(path.join(DATA, "users-extra.json"), "utf8");
      assert.ok(!raw.includes("Stu-12345") && !raw.includes("Tch-12345") && !raw.includes("Bulk-"), "открытых паролей в оверлее нет");
      assert.ok(isHashed(extra().stu1.password) && isHashed(extra().tch1.password), "в оверлее — хэши");
      assert.strictEqual(extra().tch1.role, "teacher", "роль при миграции не потеряна");
      assert.ok(srv.logs.some((l) => /\[users\] INFO: passwords hashed \{/.test(l)), "миграция видна в логах");
    }

    /* 2. Вход после миграции: Basic и форма */
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu1", "Stu-12345") })).status, 200, "Basic с прежним паролем");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu1", "Stu-00000") })).status, 401, "неверный пароль — 401");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("adm", "Adm-12345") })).status, 200, "хэш в базе users.json");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("adm2", "Adm2-12345") })).status, 200, "открытый пароль-наследие в базе");
    assert.ok(srv.logs.some((l) => /\[users\] WARN: plaintext password in users\.json/.test(l)), "о наследии предупреждает лог");
    const form = await fetch("http://localhost:" + PORT + "/api/login", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "stu1", password: "Stu-12345" }) });
    assert.strictEqual(form.status, 200, "форма входа");
    const freshCookie = "kga1=" + cookieOf(form);
    assert.strictEqual((await req("GET", "/api/me", { cookie: freshCookie })).status, 200, "новая cookie работает");

    /* 3. Миграция не разлогинивает: cookie, выданная до хэшей, живёт */
    const oldStu = legacyCookie("stu1", "Stu-12345");
    assert.strictEqual((await req("GET", "/api/me", { cookie: oldStu })).status, 200, "cookie до миграции действует");
    assert.notStrictEqual(freshCookie, oldStu, "новые cookie подписаны уже не открытым паролем");
    assert.strictEqual((await req("GET", "/api/me", { cookie: legacyCookie("stu1", "Stu-99999") })).status, 401,
      "подделка «под наследие» с чужим паролем не проходит");
    // срок наследия истёк (правка файла мимо API подхватывается сразу) — старая cookie отвергнута
    const oldTch = legacyCookie("tch1", "Tch-12345");
    assert.strictEqual((await req("GET", "/api/me", { cookie: oldTch })).status, 200);
    const ex = extra(); ex.tch1.legacyUntil = "2000-01-01T00:00:00.000Z";
    fs.writeFileSync(path.join(DATA, "users-extra.json"), JSON.stringify(ex));
    assert.strictEqual((await req("GET", "/api/me", { cookie: oldTch })).status, 401, "после срока наследия старая cookie недействительна");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("tch1", "Tch-12345") })).status, 200, "а пароль по-прежнему верен");

    /* 4. Смена пароля: пишется хэшем, отзывает и старую, и новую cookie */
    assert.strictEqual((await req("PUT", "/api/students", { auth: B("adm", "Adm-12345"), body: { login: "stu1", password: "Stu-99999" } })).status, 200);
    const rawAfter = fs.readFileSync(path.join(DATA, "users-extra.json"), "utf8");
    assert.ok(!rawAfter.includes("Stu-99999") && isHashed(extra().stu1.password), "сменённый пароль — хэшем");
    assert.ok(!extra().stu1.legacySig, "наследная подпись снята");
    assert.strictEqual((await req("GET", "/api/me", { cookie: oldStu })).status, 401, "cookie до миграции отозвана сменой пароля");
    assert.strictEqual((await req("GET", "/api/me", { cookie: freshCookie })).status, 401, "и выданная после — тоже");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu1", "Stu-99999") })).status, 200, "новый пароль работает");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu1", "Stu-12345") })).status, 401, "старый — нет");

    /* 5. Новая учётка через API — сразу хэшем */
    assert.strictEqual((await req("PUT", "/api/students", { auth: B("adm", "Adm-12345"),
      body: { login: "stu2", create: true, password: "Stu2-12345" } })).status, 200);
    assert.ok(isHashed(extra().stu2.password) && !JSON.stringify(extra()).includes("Stu2-12345"), "новый ученик — хэшем");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu2", "Stu2-12345") })).status, 200);

    /* 5б. Существование логина не видно по времени ответа: для неизвестного логина сервер
          тоже считает scrypt (по фиктивному хэшу), иначе ответ «такого логина нет» приходил
          мгновенно, а «неверный пароль» — через ~25 мс (ревью PR #237) */
    {
      const avg = async (login, pfx) => { let s = 0;
        for (let i = 0; i < 5; i++) { const t = Date.now();
          const r = await req("GET", "/api/me", { auth: B(login, "zz-" + i), headers: { "x-forwarded-for": pfx + i } });
          assert.strictEqual(r.status, 401); s += Date.now() - t; }
        return s / 5; };
      const known = await avg("stu2", "8.8.1."), unknown = await avg("ghost-login", "8.8.2.");
      assert.ok(unknown > known * 0.5, "неизвестный логин отвечает не быстрее известного: " + unknown + " мс против " + known + " мс");
      const formT = async (login, ip) => { const t = Date.now();
        const r = await req("POST", "/api/login", { body: { login, password: "zz" }, headers: { "x-forwarded-for": ip } });
        assert.strictEqual(r.status, 401); return Date.now() - t; };
      let fk = 0, fu = 0;
      for (let i = 0; i < 5; i++) { fk += await formT("stu2", "8.8.3." + i); fu += await formT("ghost-login", "8.8.4." + i); }
      assert.ok(fu > fk * 0.5, "и в форме входа: " + fu / 5 + " мс против " + fk / 5 + " мс");
    }

    /* 6. Перебор через Basic ограничен по адресу, как форма входа */
    let limitAt = 0;
    for (let i = 0; i < 25; i++) {
      const r = await req("GET", "/api/me", { auth: B("stu2", "wrong-" + i), headers: { "x-forwarded-for": "7.7.7.7" } });
      if (r.status === 429) { limitAt = i; break; }
      assert.strictEqual(r.status, 401, "до лимита — 401");
    }
    assert.ok(limitAt > 0 && limitAt <= 21, "перебор через Basic упирается в 429: " + limitAt);
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu2", "Stu2-12345"), headers: { "x-forwarded-for": "7.7.7.7" } })).status, 429,
      "с заблокированного адреса ждёт и верный пароль");
    assert.strictEqual((await req("GET", "/api/me", { auth: B("stu2", "Stu2-12345"), headers: { "x-forwarded-for": "7.7.7.8" } })).status, 200,
      "другой адрес — своё окно");
    assert.ok(srv.logs.some((l) => /\[auth\] WARN: basic auth rate limited \{/.test(l)), "срабатывание видно в логах");

    console.log("passwords.test.js: OK (scrypt-хэши, миграция оверлея без разлогина, срок наследия, смена пароля отзывает cookie, лимит перебора через Basic)");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    srv.stop();
    fs.rmSync(USERS, { force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
