"use strict";
/* Инлайн-ссылки данных (( анкор|/путь )) ведут в существующие адреса.
   Механизм renderP/INLINE_LINK_RE (server/site.js) превращает такой маркер в <a href>
   прямо из JSON: статьи блога, FAQ страниц-квизов, разговорник. До этого гейта путь не
   проверял НИКТО — validateLocalizedUi запрещает маркер в вопросе FAQ, но не резолвит
   адрес, а level-data/blog-гейты смотрят только наличие q/a. Опечатка в пути
   (/probny-a1 вместо /probny-test-a1) молча уехала бы в прод ссылкой на 404: находка
   адверсарного валидатора 17.09.2026 при разборе правки FAQ теста уровня.

   Проверка — поведение, а не греп: каждый уникальный путь запрашивается у живого
   сервера и обязан ответить 200, а якорь (#id) обязан существовать в отданном HTML. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./helpers/serve");

const PORT = 8231;
const APP = path.join(__dirname, "..", "app");
// та же регулярка, что и в рендерере: гейт обязан видеть ровно то, что станет ссылкой
const INLINE_LINK_RE = /\(\(([^|()]+)\|(\/[a-z0-9/_#-]+)\)\)/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

async function main() {
  const DATA = "/tmp/kga1-links-test-" + process.pid;
  fs.mkdirSync(DATA, { recursive: true });
  let srv;
  try {
    // путь → множество файлов-источников (сообщение об ошибке обязано назвать, где чинить)
    const where = new Map();
    for (const f of walk(APP)) {
      const raw = fs.readFileSync(f, "utf8");
      for (const m of raw.matchAll(INLINE_LINK_RE)) {
        const rel = path.relative(path.join(__dirname, ".."), f);
        if (!where.has(m[2])) where.set(m[2], new Set());
        where.get(m[2]).add(rel);
      }
    }
    assert.ok(where.size >= 50, "инлайн-ссылок в данных неожиданно мало (" + where.size + ") — регулярка разошлась с рендерером?");

    srv = await startServer({ port: PORT, dataDir: DATA });
    const { req } = srv;
    const cache = new Map(); // путь без якоря → html (страницы переиспользуются десятками ссылок)
    for (const [link, files] of [...where].sort()) {
      const at = link + " (" + [...files].sort().join(", ") + "): ";
      const [p, anchor] = link.split("#");
      if (!cache.has(p)) {
        const r = await req("GET", p);
        assert.strictEqual(r.status, 200, at + "адрес отвечает " + r.status + ", а ссылка уже стоит в тексте");
        cache.set(p, r.text);
      }
      if (anchor) {
        assert.ok(cache.get(p).includes('id="' + anchor + '"'),
          at + "якоря #" + anchor + " на странице нет — ссылка приведёт в начало");
      }
    }
    console.log("inline-links.test.js: OK (" + where.size + " уникальных ссылок из данных ведут в живые адреса)");
  } finally {
    if (srv) await srv.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
