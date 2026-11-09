"use strict";
/* Роутер скиллов (hook UserPromptSubmit): запрос по теме проекта обязан получать
   указатель на свой скилл, запрос вне тем — молчание. Проверка не грепом правил,
   а исполнением: реальные формулировки владельца прогоняются через routeFor, плюс
   сам хук запускается процессом с телом события на stdin — то, что видит Claude Code. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const HOOK = path.join(ROOT, ".claude", "hooks", "skill-router.js");
const { ROUTES, routeFor, hintFor } = require(HOOK);

// Живые формулировки: так владелец писал в переписке — на них и мерился выбор скилла
const CASES = [
  ["kyrgyz-course", "надо завести новый модуль в курс, тема — транспорт и дорога. что где прописывать?"],
  ["kyrgyz-course", "хочу открыть уровень B2, модули готовы. что тронуть кроме реестра курсов?"],
  ["kyrgyz-course", "почему сервер не стартует после добавления модуля: COURSES и app/src разошлись"],
  ["kyrgyz-lessons", "сделай аудиоурок для модуля M2, объяснение на трёх языках как в первом"],
  ["kyrgyz-lessons", "в уроке нужно правило про вопросительную частицу, как оформить с источником"],
  ["kyrgyz-lessons", "собери видео урока 2 и шортсы, заставку как в первом"],
  ["kyrgyz-listening", "добавь дрилл согласных в аудирование, там сейчас только гласные"],
  ["kyrgyz-listening", "какие лимиты у распознавания речи и где считаются затраты"],
  ["kyrgyz-tts", "озвучь заново карточку про рынок, диктор проглотил последний согласный"],
  ["kyrgyz-tts", "у персонажа Айбек голос слишком взрослый, поменяй на молодой"],
  ["kyrgyz-tts", "перегенери озвучку модуля 3, там у трёх слов обрыв хвоста"],
  ["kyrgyz-a1", "куда класть новую часть app/src, чтобы она попала в manifest.json"],
];
// Вне тем проекта хук обязан молчать: лишняя строка в каждом промпте — это шум,
// который стоит контекста и приучает игнорировать указатель
const SILENT = [
  "поправь опечатку в README", "задеплой на прод", "добавь тест на sitemap",
  "посчитай токены в файле", "почему упал docker build",
];

for (const [skill, prompt] of CASES) {
  const r = routeFor(prompt);
  assert.ok(r, "запрос «" + prompt.slice(0, 40) + "…» получил маршрут");
  assert.strictEqual(r.skill, skill, "маршрут запроса «" + prompt.slice(0, 40) + "…»");
}
for (const prompt of SILENT)
  assert.strictEqual(routeFor(prompt), null, "вне тем проекта — молчание: «" + prompt + "»");

// «озвучь урок» — работа по конвейеру уроков, а не перегенерация карточек: у уроков
// свой генератор (gen-pronunciation) и свои гейты, порядок правил это и держит
assert.strictEqual(routeFor("озвучь урок m1 заново").skill, "kyrgyz-lessons",
  "уроки выигрывают у общей озвучки");
assert.strictEqual(routeFor("озвучь карточки m1 заново").skill, "kyrgyz-tts",
  "без слова «урок» — обычная озвучка");

// подсказка называет скилл и требует его загрузить — иначе указатель бесполезен
for (const r of ROUTES) {
  const h = hintFor(r);
  assert.ok(h.includes("`" + r.skill + "`"), "подсказка называет скилл " + r.skill);
  assert.ok(/Skill/.test(h), "подсказка велит загрузить инструментом Skill (" + r.skill + ")");
}

// каждый маршрут ведёт в существующий скилл репозитория — переименовали каталог,
// а правило осталось = указатель в никуда при зелёном прогоне
for (const r of ROUTES)
  assert.ok(fs.existsSync(path.join(ROOT, ".claude", "skills", r.skill, "SKILL.md")),
    "скилл «" + r.skill + "» есть в репозитории");

// хук зарегистрирован в настройках проекта и запускается как процесс
const st = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
const cmds = (st.hooks && st.hooks.UserPromptSubmit || []).flatMap((g) => g.hooks || []).map((h) => h.command);
assert.ok(cmds.some((c) => c.includes("skill-router.js")), "роутер зарегистрирован на UserPromptSubmit");
const run = (payload) => execFileSync("node", [HOOK], { input: JSON.stringify(payload), encoding: "utf8" });
assert.ok(run({ prompt: "озвучь заново карточку, диктор проглотил окончание" }).includes("kyrgyz-tts"),
  "хук процессом: тема озвучки → указатель на kyrgyz-tts");
assert.strictEqual(run({ prompt: "поправь опечатку в README" }), "", "хук процессом: вне тем — пустой вывод");
assert.strictEqual(run({}), "", "событие без промпта не роняет хук");
assert.strictEqual(execFileSync("node", [HOOK], { input: "не json", encoding: "utf8" }), "",
  "мусор на входе не роняет хук — иначе он ломал бы каждый запрос");

console.log("skill-router.test.js: OK (маршруты " + ROUTES.length + " × живые формулировки, молчание вне тем, хук процессом)");
