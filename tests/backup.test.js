"use strict";
/* Интеграционные тесты бэкапов /data: роли, создание, скачивание побайтово,
   загрузка, восстановление с подписью, ротация, автотаймер, traversal.
   Живой сервер на временном каталоге — поведение, не грепы. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { startServer } = require("./helpers/serve");

const PORT = 8207;
const BASE = "http://localhost:" + PORT;
const DATA = "/tmp/kga1-backup-test-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ILIM = B("ilim", "Tst-vKIxmveh-9"), VADIM = B("vadim", "Tst-sFVPwRvG-9");

async function main() {
  // осмысленные данные: прогресс + аудио-мета, чтобы восстановлению было что возвращать
  fs.mkdirSync(path.join(DATA, "progress"), { recursive: true });
  fs.writeFileSync(path.join(DATA, "progress", "ilim.json"), JSON.stringify({ v: 1, marker: "до-бэкапа" }));

  const srv = await startServer({ port: PORT, dataDir: DATA, env: { KGA1_BACKUP_AUTO: "0" } });
  const req = srv.req;
  try {
    // --- роли: бэкапы — строго админ (том несёт пароли и весь журнал занятий) ---
    assert.strictEqual((await req("GET", "/api/admin/backups")).status, 401, "аноним — 401");
    assert.strictEqual((await req("GET", "/api/admin/backups", { auth: ILIM })).status, 403, "ученик — 403");
    assert.strictEqual((await req("POST", "/api/admin/backups", { auth: ILIM })).status, 403, "создание учеником — 403");

    // --- создание и список ---
    const made = JSON.parse((await req("POST", "/api/admin/backups", { auth: VADIM })).text);
    assert.ok(made.ok && /^kga1-backup-\d{8}-\d{6}(-\d+)?\.tar\.gz$/.test(made.name), "создан с каноничным именем: " + made.name);
    assert.ok(made.bytes > 20, "архив не пустой");
    const list1 = JSON.parse((await req("GET", "/api/admin/backups", { auth: VADIM })).text);
    assert.strictEqual(list1.length, 1, "в списке один бэкап");
    assert.strictEqual(list1[0].name, made.name);
    assert.strictEqual(list1[0].bytes, made.bytes, "размер в списке совпадает с созданным");

    // --- скачивание: побайтово равно файлу на диске, это валидный gzip с нашими данными ---
    const dl = await fetch(BASE + "/api/admin/backups/" + made.name, { headers: { Authorization: VADIM } });
    assert.strictEqual(dl.status, 200);
    assert.strictEqual(dl.headers.get("content-type"), "application/gzip");
    const body = Buffer.from(await dl.arrayBuffer());
    const onDisk = fs.readFileSync(path.join(DATA, "backups", made.name));
    assert.ok(body.equals(onDisk), "скачанное побайтово равно файлу на томе");
    assert.ok(body[0] === 0x1f && body[1] === 0x8b, "gzip-подпись на месте");
    const toc = execFileSync("tar", ["-tzf", path.join(DATA, "backups", made.name)]).toString();
    assert.ok(toc.includes("progress/ilim.json"), "в архиве лежит прогресс ученика");
    assert.ok(!toc.includes("backups/"), "каталог бэкапов в архив не попадает — иначе рос бы геометрически");

    // --- восстановление: только с подписью, и оно реально возвращает данные ---
    fs.writeFileSync(path.join(DATA, "progress", "ilim.json"), JSON.stringify({ v: 1, marker: "испорчено" }));
    assert.strictEqual((await req("POST", "/api/admin/backups/" + made.name + "/restore", { auth: VADIM, body: {} })).status, 400,
      "restore без confirm отклонён");
    const rst = await req("POST", "/api/admin/backups/" + made.name + "/restore", { auth: VADIM, body: { confirm: "restore" } });
    assert.strictEqual(rst.status, 200, "restore с подписью прошёл: " + rst.text);
    assert.ok(JSON.parse(rst.text).note.includes("рестарт"), "ответ честно предупреждает про кэши процесса");
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(DATA, "progress", "ilim.json"), "utf8")).marker, "до-бэкапа",
      "восстановление вернуло данные из архива");

    // --- загрузка: скачанный архив заливается под валидным именем, мусор — нет ---
    const upName = "kga1-backup-20200101-000000.tar.gz";
    const up = await fetch(BASE + "/api/admin/backups/" + upName, { method: "PUT", headers: { Authorization: VADIM }, body: body });
    assert.strictEqual(up.status, 200, "загрузка валидного архива");
    const list2 = JSON.parse((await req("GET", "/api/admin/backups", { auth: VADIM })).text);
    assert.ok(list2.some((b) => b.name === upName && b.bytes === body.length), "загруженный появился в списке");
    const junk = await fetch(BASE + "/api/admin/backups/kga1-backup-20200101-000001.tar.gz",
      { method: "PUT", headers: { Authorization: VADIM }, body: "это не архив" });
    assert.strictEqual(junk.status, 400, "не-gzip отклонён по подписи файла");
    assert.strictEqual((await req("PUT", "/api/admin/backups/evil.tar.gz", { auth: VADIM, raw: true, body: "x" })).status, 400,
      "имя вне канона — 400");

    // --- traversal: точки и кодированные слэши не выводят из каталога бэкапов ---
    for (const evil of ["/api/admin/backups/..%2Fusers-extra.json", "/api/admin/backups/....json", "/api/admin/backups/kga1-backup-1.tar.gz"]) {
      const r = await req("GET", evil, { auth: VADIM });
      assert.ok(r.status === 400 || r.status === 404, evil + " не отдал файл: " + r.status);
    }

    // --- ротация: KEEP свежих, старейшие уходят ---
    // KEEP по умолчанию 5; уже есть 2 (созданный + загруженный «2020 год» — он старейший по имени)
    for (let i = 0; i < 4; i++) {
      const r = await req("POST", "/api/admin/backups", { auth: VADIM });
      assert.strictEqual(r.status, 200, "бэкап " + i + ": " + r.text);
    }
    const list3 = JSON.parse((await req("GET", "/api/admin/backups", { auth: VADIM })).text);
    assert.strictEqual(list3.length, 5, "ротация держит ровно 5");
    assert.ok(!list3.some((b) => b.name === upName), "старейший (2020) ушёл первым");

    // --- удаление ---
    const victim = list3[0].name;
    assert.strictEqual((await req("DELETE", "/api/admin/backups/" + victim, { auth: VADIM })).status, 200);
    assert.strictEqual(JSON.parse((await req("GET", "/api/admin/backups", { auth: VADIM })).text).length, 4, "после удаления 4");
    assert.strictEqual((await req("DELETE", "/api/admin/backups/" + victim, { auth: VADIM })).status, 404, "повторное удаление — 404");
  } finally {
    srv.stop();
  }

  // --- автотаймер: свежий сервер с крошечным тиком сам делает бэкап, но не плодит их ---
  const DATA2 = DATA + "-auto";
  fs.mkdirSync(path.join(DATA2, "progress"), { recursive: true });
  fs.writeFileSync(path.join(DATA2, "progress", "x.json"), "{}");
  const srv2 = await startServer({ port: PORT + 1, dataDir: DATA2,
    env: { KGA1_BACKUP_TICK_MS: "150", KGA1_BACKUP_MAX_AGE_MS: "60000" } });
  try {
    await new Promise((r) => setTimeout(r, 1200)); // несколько тиков
    const auto = JSON.parse((await srv2.req("GET", "/api/admin/backups", { auth: VADIM })).text);
    assert.strictEqual(auto.length, 1, "автобэкап создан ровно один: свежий (<MAX_AGE) не пересоздаётся, получено " + auto.length);
    assert.ok(srv2.logs.some((l) => /\[backup\] INFO: auto created/.test(l)), "автосоздание видно в логах");
  } finally {
    srv2.stop();
  }

  console.log("backup.test.js: OK (роли, создание, скачивание побайтово, restore с подписью, загрузка, ротация 5, автотаймер, traversal)");
}

main().catch((e) => { console.error(e); process.exit(1); });
