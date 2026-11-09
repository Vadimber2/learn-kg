"use strict";
/* Видеоуроки: раздача mp4 с Range (без 206 у <video> мертва перемотка), публичный
   список, заливка/YouTube-ссылка/удаление за гейтом преподавателя, подпись ftyp
   против заливки не-mp4, белый шаблон имён. Клиентская карточка — исполнением
   renderVideoCard с мок-fetch: гейты (ученик/преподаватель/пусто/демо), выбор
   языка по интерфейсу, шаринг-ссылки и приоритет YouTube. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { startServer } = require("./helpers/serve");

const PORT = 8207;
const DATA = "/tmp/kga1-video-" + process.pid;
const B = (u, p) => "Basic " + Buffer.from(u + ":" + p).toString("base64");
const ALT = B("altynai", "Tst-lwxo2c1U-9");
const STU = B("vid_stu", "vid-KgA1-26");
// валидный заголовок mp4: размер бокса + "ftyp" на байтах 4–8
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom-fake-video-bytes-0123456789")]);

(async () => {
  let srv;
  try {
    srv = await startServer({ port: PORT, dataDir: DATA });
    const req = srv.req;
    const raw = async (method, url, opts) => {
      const r = await fetch("http://127.0.0.1:" + PORT + url, Object.assign({ method }, opts || {}));
      return { status: r.status, headers: r.headers, buf: Buffer.from(await r.arrayBuffer()) };
    };
    assert.strictEqual((await req("PUT", "/api/students", { auth: ALT,
      body: { login: "vid_stu", password: "vid-KgA1-26", create: true, role: "student", courses: ["a1"] } })).status, 200);

    /* 1. Заливка: аноним/ученик — нет, преподаватель — да, не-mp4 отвергается */
    {
      const put = (auth, body) => raw("PUT", "/api/video/lesson-phonetics-ru.mp4",
        { headers: Object.assign({ "Content-Type": "video/mp4" }, auth ? { Authorization: auth } : {}), body });
      assert.strictEqual((await put(null, MP4)).status, 401, "аноним не заливает");
      assert.strictEqual((await put(STU, MP4)).status, 403, "ученик не заливает");
      assert.strictEqual((await put(ALT, Buffer.from("not a video at all"))).status, 400, "не-mp4 отвергнут по подписи");
      const ok = await put(ALT, MP4);
      assert.strictEqual(ok.status, 200, "преподаватель заливает");
      assert.ok(fs.existsSync(path.join(DATA, "video", "lesson-phonetics-ru.mp4")), "файл лёг на том");
      // постер: подпись jpg, раздача картинкой, появляется в списке
      const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpeg-body")]);
      const putJ = (body) => raw("PUT", "/api/video/lesson-phonetics-ru.jpg",
        { headers: { Authorization: ALT, "Content-Type": "image/jpeg" }, body });
      assert.strictEqual((await putJ(Buffer.from("not a jpeg"))).status, 400, "не-jpg отвергнут по подписи");
      assert.strictEqual((await putJ(JPG)).status, 200, "постер залит");
      const gJ = await raw("GET", "/api/video/lesson-phonetics-ru.jpg");
      assert.strictEqual(gJ.status, 200);
      assert.strictEqual(gJ.headers.get("content-type"), "image/jpeg");
      const wl = JSON.parse((await raw("GET", "/api/video/list")).buf.toString());
      assert.strictEqual(wl[0].poster, "lesson-phonetics-ru.jpg", "список знает постер");
      assert.strictEqual((await req("DELETE", "/api/video/lesson-phonetics-ru.jpg", { auth: ALT })).status, 200, "постер удаляется тем же гейтом");
    }

    /* 2. Список публичен и несёт размер; чужие имена не пролезают */
    {
      const r = await raw("GET", "/api/video/list");
      assert.strictEqual(r.status, 200);
      const rows = JSON.parse(r.buf.toString());
      assert.deepStrictEqual(rows, [{ file: "lesson-phonetics-ru.mp4", bytes: MP4.length, youtube: null, chapters: null, poster: null }],
        "список анониму: файл, размер, без YouTube/глав/постера");
      // имена вне белого шаблона не доходят до раздачи: анониму это 401 общей зоны /api
      assert.ok([401, 404].includes((await raw("GET", "/api/video/Evil%2e%2e.mp4")).status), "имя вне белого шаблона не отдаётся");
      assert.ok([401, 404].includes((await raw("GET", "/api/video/video-meta.json")).status), "реестр наружу не отдаётся");
    }

    /* 3. Раздача: полный файл, Range-срезы, суффикс, 416, HEAD */
    {
      const full = await raw("GET", "/api/video/lesson-phonetics-ru.mp4");
      assert.strictEqual(full.status, 200);
      assert.strictEqual(full.headers.get("accept-ranges"), "bytes", "перемотка объявлена");
      assert.ok(full.buf.equals(MP4), "тело — залитый файл");
      const part = await raw("GET", "/api/video/lesson-phonetics-ru.mp4", { headers: { Range: "bytes=4-7" } });
      assert.strictEqual(part.status, 206, "срез — 206");
      assert.strictEqual(part.buf.toString(), "ftyp", "байты среза точные");
      assert.strictEqual(part.headers.get("content-range"), "bytes 4-7/" + MP4.length);
      const tail = await raw("GET", "/api/video/lesson-phonetics-ru.mp4", { headers: { Range: "bytes=-4" } });
      assert.strictEqual(tail.status, 206);
      assert.ok(tail.buf.equals(MP4.slice(-4)), "суффиксный Range — хвост файла");
      const open = await raw("GET", "/api/video/lesson-phonetics-ru.mp4", { headers: { Range: "bytes=4-" } });
      assert.strictEqual(open.status, 206);
      assert.ok(open.buf.equals(MP4.slice(4)), "открытый Range — до конца");
      assert.strictEqual((await raw("GET", "/api/video/lesson-phonetics-ru.mp4",
        { headers: { Range: "bytes=99999-" } })).status, 416, "за концом — 416");
      const head = await raw("HEAD", "/api/video/lesson-phonetics-ru.mp4");
      assert.strictEqual(head.status, 200);
      assert.strictEqual(head.buf.length, 0, "HEAD без тела");
    }

    /* 4. YouTube-ссылка: гейт, валидация, появляется в списке, снимается */
    {
      const put = (auth, body) => req("PUT", "/api/video/meta", { auth, body });
      assert.strictEqual((await put(STU, { file: "lesson-phonetics-ru.mp4", youtube: "https://youtu.be/x1" })).status, 403, "ученику нельзя");
      assert.strictEqual((await put(ALT, { file: "nope.mp4", youtube: "https://youtu.be/x1" })).status, 400, "несуществующий файл");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", youtube: "https://evil.example/v" })).status, 400, "не-YouTube отвергнут");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", youtube: "https://youtu.be/abc_123" })).status, 200, "ссылка сохранена");
      let rows = JSON.parse((await raw("GET", "/api/video/list")).buf.toString());
      assert.strictEqual(rows[0].youtube, "https://youtu.be/abc_123", "список несёт ссылку");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", youtube: null })).status, 200, "ссылка снимается");
      rows = JSON.parse((await raw("GET", "/api/video/list")).buf.toString());
      assert.strictEqual(rows[0].youtube, null);
      // главы: валидация, независимость от youtube (заливка глав не стирает ссылку)
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", chapters: "x" })).status, 400, "главы-не-массив отвергнуты");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", chapters: [{ id: "p1", start: -1 }] })).status, 400, "отрицательный старт отвергнут");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", chapters: [{ id: "P!!", start: 1 }] })).status, 400, "мусорный id отвергнут");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", youtube: "https://youtu.be/keepme" })).status, 200);
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", chapters: [{ id: "p1", start: 4 }, { id: "p2", start: 64.4 }] })).status, 200, "главы сохранены");
      rows = JSON.parse((await raw("GET", "/api/video/list")).buf.toString());
      assert.deepStrictEqual(rows[0].chapters, [{ id: "p1", start: 4 }, { id: "p2", start: 64 }], "список несёт главы, старт округлён");
      assert.strictEqual(rows[0].youtube, "https://youtu.be/keepme", "заливка глав не стёрла YouTube-ссылку");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", chapters: null })).status, 200, "главы снимаются");
      rows = JSON.parse((await raw("GET", "/api/video/list")).buf.toString());
      assert.strictEqual(rows[0].chapters, null);
      assert.strictEqual(rows[0].youtube, "https://youtu.be/keepme", "и ссылка снова пережила");
      assert.strictEqual((await put(ALT, { file: "lesson-phonetics-ru.mp4", youtube: null })).status, 200);
    }

    /* 5. Удаление: гейт и результат */
    {
      assert.strictEqual((await req("DELETE", "/api/video/lesson-phonetics-ru.mp4", { auth: STU })).status, 403);
      assert.strictEqual((await req("DELETE", "/api/video/lesson-phonetics-ru.mp4", { auth: ALT })).status, 200);
      assert.deepStrictEqual(JSON.parse((await raw("GET", "/api/video/list")).buf.toString()), [], "список пуст");
      assert.strictEqual((await raw("GET", "/api/video/lesson-phonetics-ru.mp4")).status, 404, "файла больше нет");
    }

    /* 6. Клиентская карточка: исполнение renderVideoCard с мок-fetch */
    {
      const page = (await req("GET", "/", { auth: STU })).text;
      const m = page.match(/\/\* ===VIDEO-CARD=== \*\/([\s\S]*?)\/\* ===\/VIDEO-CARD=== \*\//);
      assert.ok(m, "маркеры ===VIDEO-CARD=== в сборке");
      const mkNode = (tag, attrs) => ({ tag, attrs: attrs || {}, kids: [], isConnected: true, paused: true,
        set textContent(v) { this.kids = v === "" ? [] : [v]; }, get textContent() { return ""; },
        append(...k) { this.kids.push(...k); },
        setAttribute(k, val) { this.attrs[k] = val; }, removeAttribute(k) { delete this.attrs[k]; },
        pause() {},
        addEventListener(type, fnc) { (this.on = this.on || {})[type] = fnc; } });
      const flat = (n, acc) => { if (!n || !n.kids) return acc;
        for (const k of n.kids) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const runCard = async (opts) => {
        const box = mkNode("div");
        const sb = { console, t: (k) => k, icon: () => null,
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          clear: (n) => { n.kids = []; return n; },
          isTeacher: () => !!opts.teacher, currentLang: () => opts.lang || "ru",
          LESSONS: { m0: { id: "phonetics", title: { ru: "Урок 1" }, themes: [
            { id: "p1", title: { ru: "Тема-1" } }, { id: "p2", title: { ru: "Тема-2" } }] } }, activeModule: "m0",
          evPush() {}, location: { origin: "https://learn.kg" },
          navigator: opts.share ? { share: async () => {} } : {},
          fetch: async () => ({ ok: true, json: async () => opts.rows || [] }),
          BOX: box };
        if (opts.mobile) sb.matchMedia = () => ({ matches: true });
        vm.createContext(sb);
        await vm.runInContext(m[1] + "; (async()=>{ this.HAS = await renderVideoCard(this.BOX); })()", sb);
        vm.runInContext("this.SY=renderVideoCard._sync||null;", sb);
        return { box, all: flat(box, [box]), sb, has: sb.HAS };
      };
      // порядок в списке нарочно en-первым: чипы обязаны стать каноническими RU EN;
      // ролик ЧУЖОГО урока (selfintro) в списке нарочно — карточка m0 обязана его
      // отфильтровать (в «Уроке 2» показывались ролики урока 1)
      const rows = [
        { file: "lesson-phonetics-en.mp4", bytes: 14900000, youtube: null },
        { file: "lesson-selfintro-ru.mp4", bytes: 14900000, youtube: null },
        { file: "lesson-phonetics-ru.mp4", bytes: 14900000, youtube: null }];
      // ученик: плеер на языке интерфейса, чипы языков, шаринг прямой ссылкой, без блока преподавателя
      const stu = await runCard({ rows });
      const video = stu.all.find((n) => n.tag === "video");
      assert.ok(video, "плеер отрисован");
      assert.strictEqual(video.attrs.src, "api/video/lesson-phonetics-ru.mp4", "по умолчанию — ролик языка интерфейса");
      const langChips = stu.all.filter((n) => n.tag === "button" && (n.kids.includes("RU") || n.kids.includes("EN")));
      assert.deepStrictEqual(langChips.map((n) => n.kids[0]), ["RU", "EN"], "порядок чипов канонический RU EN, не алфавит файлов");
      const wa = stu.all.find((n) => n.tag === "a" && String(n.attrs.href).startsWith("https://wa.me/"));
      assert.ok(wa && wa.attrs.href.includes(encodeURIComponent("https://learn.kg/api/video/lesson-phonetics-ru.mp4")),
        "WhatsApp шарит прямую ссылку, пока YouTube не задан");
      assert.ok(stu.all.some((n) => n.tag === "a" && String(n.attrs.href).startsWith("https://t.me/share/url")), "Telegram-кнопка");
      assert.ok(stu.all.some((n) => n.tag === "button" && n.kids.includes("vid_copy")), "копирование ссылки");
      assert.ok(!stu.all.some((n) => n.tag === "input"), "у ученика нет поля YouTube");
      assert.ok(!stu.all.some((n) => n.tag === "button" && n.kids.includes("vid_share")), "без navigator.share нет системной кнопки");
      // сохранённый YouTube побеждает в шаринге, появляется своя кнопка
      const yrows = [{ file: "lesson-phonetics-ru.mp4", bytes: 1, youtube: "https://youtu.be/abc" }];
      const yt = await runCard({ rows: yrows });
      const wa2 = yt.all.find((n) => n.tag === "a" && String(n.attrs.href).startsWith("https://wa.me/"));
      assert.ok(wa2.attrs.href.includes(encodeURIComponent("https://youtu.be/abc")), "шарится YouTube-ссылка");
      assert.ok(yt.all.some((n) => n.tag === "a" && n.attrs.href === "https://youtu.be/abc"), "кнопка YouTube видна");
      // мобильный системный шит
      const sysr = await runCard({ rows, share: true });
      assert.ok(sysr.all.some((n) => n.tag === "button" && n.kids.includes("vid_share")), "с navigator.share есть системная кнопка");
      // преподаватель: скачивание и поле ссылки; пустой список — подсказка
      const tch = await runCard({ rows, teacher: true });
      assert.ok(tch.all.some((n) => n.tag === "a" && n.attrs.download), "преподавателю — скачать mp4");
      assert.ok(tch.all.some((n) => n.tag === "input"), "и поле YouTube-ссылки");
      const tchEmpty = await runCard({ rows: [], teacher: true });
      assert.ok(flat(tchEmpty.box, [tchEmpty.box]).some((n) => n.kids.includes("vid_none_teacher")), "пусто: преподавателю подсказка");
      const stuEmpty = await runCard({ rows: [] });
      assert.strictEqual(stuEmpty.box.kids.length, 0, "пусто: ученику карточка не показывается");
      assert.strictEqual(stuEmpty.has, false, "и подвкладка «Видео» не появляется");
      assert.strictEqual(stu.has, true, "с роликами подвкладка появляется");
      // язык интерфейса en выбирает en-ролик
      const en = await runCard({ rows, lang: "en" });
      assert.strictEqual(en.all.find((n) => n.tag === "video").attrs.src, "api/video/lesson-phonetics-en.mp4");
      // главы: чипы тем мотают видео, выбор темы урока подматывает на паузе и не трогает играющее
      const chRows = [{ file: "lesson-phonetics-ru.mp4", bytes: 1, youtube: null,
        chapters: [{ id: "p1", start: 4 }, { id: "p2", start: 64 }] }];
      const chp = await runCard({ rows: chRows });
      const vC = chp.all.find((n) => n.tag === "video");
      const chip2 = chp.all.find((n) => n.tag === "button" && n.kids.includes("Тема-2"));
      assert.ok(chip2, "чип главы с названием темы урока");
      chip2.attrs.onclick();
      assert.strictEqual(vC.currentTime, 64, "клик главы мотает видео");
      vC.paused = true;
      vm.runInContext("renderVideoCard._sync('p1')", chp.sb);
      assert.strictEqual(vC.currentTime, 4, "выбор темы урока подматывает видео на паузе");
      vC.paused = false;
      vm.runInContext("renderVideoCard._sync('p2')", chp.sb);
      assert.strictEqual(vC.currentTime, 4, "играющее видео тема не дёргает");
      // мобильный режим: вертикальная серия шортсов по темам вместо широкого ролика
      const mixRows = rows.concat([
        { file: "lesson-phonetics-p1-ru-shorts.mp4", bytes: 1, youtube: null },
        { file: "lesson-phonetics-p2-ru-shorts.mp4", bytes: 1, youtube: null }]);
      const mob = await runCard({ rows: mixRows, mobile: true });
      const vM = mob.all.find((n) => n.tag === "video");
      assert.strictEqual(vM.attrs.src, "api/video/lesson-phonetics-p1-ru-shorts.mp4", "телефону — вертикальный формат");
      const mChip = mob.all.find((n) => n.tag === "button" && n.kids.includes("Тема-2"));
      assert.ok(mChip, "темы серии — чипами");
      mChip.attrs.onclick();
      assert.strictEqual(vM.attrs.src, "api/video/lesson-phonetics-p2-ru-shorts.mp4",
        "смена темы меняет src у ЖИВОГО плеера");
      assert.ok(flat(mob.box, [mob.box]).filter((n) => n.tag === "video").length === 1 &&
        flat(mob.box, [mob.box]).includes(vM), "плеер не пересоздан — не моргает");
      const desk = await runCard({ rows: mixRows });
      assert.strictEqual(desk.all.find((n) => n.tag === "video").attrs.src, "api/video/lesson-phonetics-ru.mp4",
        "десктопу — широкий ролик, шортсы в его плеер не попадают");
      // трафик: видео не грузится само — preload=none, постер картинкой
      assert.strictEqual(video.attrs.preload, "none", "видео не тянется до клика");
      const pRows = [{ file: "lesson-phonetics-ru.mp4", bytes: 1, youtube: null, poster: "lesson-phonetics-ru.jpg" }];
      const pr = await runCard({ rows: pRows });
      assert.strictEqual(pr.all.find((n) => n.tag === "video").attrs.poster, "api/video/lesson-phonetics-ru.jpg", "постер из списка");
      // шортсы преподавателю — плитками с постерами, видео по клику
      const tileRows = rows.concat([
        { file: "lesson-phonetics-p1-ru-shorts.mp4", bytes: 1, youtube: null, poster: "lesson-phonetics-p1-ru-shorts.jpg" },
        { file: "lesson-phonetics-p1-en-shorts.mp4", bytes: 1, youtube: null, poster: "lesson-phonetics-p1-en-shorts.jpg" }]);
      const tiles = await runCard({ rows: tileRows, teacher: true });
      const tileImg = tiles.all.find((n) => n.tag === "img");
      assert.ok(tileImg && tileImg.attrs.loading === "lazy", "плитка шортса — ленивая картинка, не video");
      const tileImgs = tiles.all.filter((n) => n.tag === "img");
      assert.deepStrictEqual(tileImgs.map((n) => n.attrs.src), ["api/video/lesson-phonetics-p1-ru-shorts.jpg"],
        "плитки — только язык видимого ролика, не все разом");
      assert.ok(!tiles.all.some((n) => n.tag === "video" && /shorts/.test(n.attrs.src)), "видео шортса не создано до клика");
      tileImg.on.click();
      assert.ok(flat(tiles.box, [tiles.box]).some((n) => n.tag === "video" && /shorts/.test(n.attrs.src)), "клик по плитке разворачивает плеер");
      const mobNoShorts = await runCard({ rows, mobile: true });
      assert.strictEqual(mobNoShorts.all.find((n) => n.tag === "video").attrs.src, "api/video/lesson-phonetics-ru.mp4",
        "телефон без шортсов честно получает широкий ролик");
      // титулы карточки — в трёх словарях
      for (const key of ["vid_hdr", "vid_share", "vid_copy", "vid_dl", "vid_yt_ph", "vid_yt_save", "vid_none_teacher"])
        assert.strictEqual((page.match(new RegExp(key + ':"', "g")) || []).length, 3, key + " в ru/en/tr");
    }

    /* 7. Ролики в справочнике модуля (===GRAM-VIDEO===): исполнение блока с мок-fetch
       и прогон рендереров модулей со шпионом — каждый ролик реестра стоит ровно в
       одной карточке СВОЕГО модуля, мёртвых ключей и ключей вне реестра нет. */
    {
      const html = require("../server/appshell").buildAppHtml();
      const blk = html.match(/\/\* ===GRAM-VIDEO=== \*\/([\s\S]*?)\/\* ===\/GRAM-VIDEO=== \*\//);
      assert.ok(blk, "маркеры ===GRAM-VIDEO=== в сборке");
      const mkNode = (tag, attrs) => ({ tag, attrs: Object.assign({}, attrs || {}), kids: [], on: {},
        append(...k) { this.kids.push(...k); }, setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(t, f) { this.on[t] = f; } });
      const texts = (n) => (n && n.kids ? n.kids.map((k) => (typeof k === "string" ? k : texts(k))).join("") : "");
      const flat = (n, acc) => { for (const k of (n && n.kids) || []) if (k && k.tag) { acc.push(k); flat(k, acc); } return acc; };
      const gram = (opts) => {
        const sb = { console, calls: 0, events: [],
          h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          appendKids: (n, ...kids) => { n.kids.push(...kids.filter((x) => x != null)); return n; },
          icon: () => null, currentLang: () => opts.lang || "ru",
          L: (ru, en, tr) => { const l = opts.lang || "ru"; return l === "tr" ? (tr !== undefined ? tr : en) : l === "en" ? en : ru; },
          evPush(ev, d) { sb.events.push([ev, d]); },
          fetch: async (u) => { sb.calls++; assert.strictEqual(u, "api/video/list");
            if (opts.fail) throw new Error("offline"); return { ok: true, json: async () => opts.rows || [] }; } };
        vm.createContext(sb);
        // плеер общий с видеоуроками — его определение живёт в блоке ===VIDEO-CARD===
        const card = html.match(/\/\* ===VIDEO-CARD=== \*\/([\s\S]*?)\/\* ===\/VIDEO-CARD=== \*\//)[1];
        vm.runInContext(card + blk[1] + "; this.GV=GRAM_VIDEOS; this.gramVideo=gramVideo; this.gramVideos=gramVideos;", sb);
        return sb;
      };
      const all = [{ file: "gram-m3-barysh.mp4", bytes: 1, poster: "gram-m3-barysh.jpg" },
        { file: "gram-m3-v-ili-na.mp4", bytes: 1, poster: null }];
      // ролик залит: плеер с постером, без автозагрузки, трекинг video.play один раз
      let sb = gram({ rows: all });
      let box = sb.gramVideo("m3.barysh");
      assert.strictEqual(await box.ready, true, "файл на томе — блок показан");
      const vid = flat(box, []).find((n) => n.tag === "video");
      assert.strictEqual(vid.attrs.src, "api/video/gram-m3-barysh.mp4");
      assert.strictEqual(vid.attrs.poster, "api/video/gram-m3-barysh.jpg", "постер из списка");
      assert.strictEqual(vid.attrs.preload, "none", "видео не тянется до клика");
      assert.ok(texts(box).includes("Тоого барам"), "подпись ролика на языке интерфейса");
      assert.strictEqual(box.kids[0].tag, "video", "подпись под роликом: в ряду ролики начинаются на одной высоте");
      assert.ok(!/^Видео/.test(texts(box)), "без лишнего «Видео:» под плеером");
      assert.ok(!texts(box).includes("Subtitles"), "русскому интерфейсу пометка о субтитрах не нужна");
      vid.on.play();
      assert.strictEqual(JSON.stringify(sb.events), JSON.stringify([["video.play", { file: "gram-m3-barysh.mp4" }]]), "событие в журнал");
      // список общий: второй ролик страницы не делает второго запроса
      await sb.gramVideo("m3.vna").ready;
      assert.strictEqual(sb.calls, 1, "один запрос списка на страницу");
      // несколько роликов карточки — ряд с переносом (десктоп: рядом, телефон: столбиком)
      sb = gram({ rows: all });
      const row = sb.gramVideos("m3.jatysh", "m3.vna");
      assert.strictEqual(row.kids.length, 2, "два ролика — в одном ряду");
      assert.ok(/display:flex/.test(row.attrs.style) && /flex-wrap:wrap/.test(row.attrs.style), "ряд гибкий, с переносом");
      assert.ok(row.kids.every((k) => /flex:0 1 300px/.test(k.attrs.style)), "ролик не шире 300px и сжимается на узком экране");
      assert.strictEqual(gram({ rows: all, lang: "en" }).gramVideos("m3.jatysh", "m3.vna").kids.length, 1, "en: ролик с русской озвучкой не встаёт в ряд");
      assert.strictEqual(sb.gramVideos("m99.nope"), null, "ряд без роликов — ничего");
      // нет файла на томе — пустой блок, без мёртвого плеера; чужой ключ — null
      sb = gram({ rows: [] });
      box = sb.gramVideo("m4.chygysh");
      assert.strictEqual(await box.ready, false);
      assert.strictEqual(box.kids.length, 0, "файла нет — блок пуст");
      assert.strictEqual(sb.gramVideo("m99.nope"), null, "ключ вне реестра — ничего");
      // офлайн: сбой не кэшируется, следующий рендер спрашивает снова
      sb = gram({ fail: true });
      assert.strictEqual(await sb.gramVideo("m3.barysh").ready, false);
      await sb.gramVideo("m3.barysh").ready;
      assert.strictEqual(sb.calls, 2, "после сбоя список запрашивается заново");
      // языки: русская озвучка — только ru; субтитры по-русски — пометка en/tr
      for (const lang of ["en", "tr"]) {
        sb = gram({ rows: all, lang });
        assert.strictEqual(sb.gramVideo("m3.vna"), null, "ролик с русской озвучкой не показан " + lang);
        box = sb.gramVideo("m3.barysh");
        await box.ready;
        assert.ok(/Subtitles in Russian|Altyazılar Rusça/.test(texts(box)), "пометка о русских субтитрах " + lang);
        assert.ok(!/Видео|куда/.test(texts(box)), "подпись без русского текста " + lang);
      }
      // имена: белый шаблон раздачи и не под фильтр карточки уроков (lesson-…, -ru.mp4)
      sb = gram({});
      const reg = sb.GV;
      for (const [key, v] of Object.entries(reg)) {
        assert.ok(/^[a-z0-9-]{1,60}\.mp4$/.test(v.file), key + ": имя проходит белый шаблон раздачи");
        assert.ok(!/^lesson-/.test(v.file) && !/-(ru|en|tr)(-shorts)?\.mp4$/.test(v.file), key + ": не попадает в «Уроки → Видео»");
        assert.ok(v.title && v.title.ru, key + ": подпись");
        if (!v.langs) assert.ok(v.title.en && v.title.tr, key + ": подписи en/tr у ролика для всех языков");
      }
      // рендереры модулей: шпион на gramVideo, недостающие хелперы — заглушки
      const keysByRenderer = {};
      for (const mod of [...new Set(Object.keys(reg).map((k) => k.split(".")[0]))]) {
        const name = "renderGrammar" + mod.toUpperCase();
        const fn = html.match(new RegExp("function " + name + "\\(m\\)\\{[\\s\\S]*?\\n\\}"));
        assert.ok(fn, name + " в сборке");
        const used = [];
        const stub = () => mkNode("x");
        const rsb = { console, used, h: (tag, attrs, ...kids) => { const n = mkNode(tag, attrs); n.kids.push(...kids.filter((x) => x != null)); return n; },
          L: (ru) => ru, gramVideos: (...ks) => { used.push(...ks); return null; } };
        vm.createContext(rsb);
        for (let tries = 0; ; tries++) {
          try { vm.runInContext(fn[0] + "; " + name + "(h('main',{}));", rsb); break; }
          catch (e) {
            const miss = /^(\w+) is not defined$/.exec(e.message);
            assert.ok(miss && tries < 40, name + ": " + e.message);
            rsb[miss[1]] = stub; used.length = 0;
          }
        }
        keysByRenderer[mod] = used.slice();
      }
      const usedAll = Object.values(keysByRenderer).flat();
      assert.deepStrictEqual(usedAll.slice().sort(), Object.keys(reg).sort(), "каждый ролик реестра стоит в справочнике ровно один раз");
      for (const [mod, keys] of Object.entries(keysByRenderer))
        for (const k of keys) assert.ok(k.startsWith(mod + "."), k + " стоит в справочнике своего модуля " + mod);
    }

    console.log("video.test.js: OK (заливка за гейтом, подпись mp4, публичные список и Range-раздача, YouTube-мета, карточка перебором ролей, ролики справочника по модулям)");
  } finally {
    if (srv) await srv.stop();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
