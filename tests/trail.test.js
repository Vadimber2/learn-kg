"use strict";
/* Тропа ученика: блок ===TRAIL=== исполняется без DOM на модельных ME/ST.
   Этот сьют появился как ответ на дыру в подходе: состав персональной сборки был
   покрыт, а ПОВЕДЕНИЕ клиента при том же наборе прав — нет, и дефекты у ученика
   без курса A1 (пустая тропа офлайн, старт на чужом М0) прошли мимо зелёных тестов.
   Поэтому здесь перебираются все наборы курсов, а не только «типовой» A1. */
const assert = require("assert");
const { loadBlock } = require("./helpers/block");

const A1 = ["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11"];
const A2 = ["m12", "m13", "m14", "m15", "m16", "m17", "m18", "m19", "m20", "m21", "m22", "m23"];
const B1 = ["m24", "m25", "m26", "m27", "m28", "m29", "m30", "m31", "m32", "m33", "m34", "m35"];
const B2 = ["m36", "m37", "m38", "m39", "m40", "m41", "m42", "m43", "m44", "m45", "m46", "m47"];
const META = A1.concat(A2).concat(B1).concat(B2).map((id) => ({ id, num: id.toUpperCase(), course: A1.includes(id) ? "a1" : A2.includes(id) ? "a2" : B1.includes(id) ? "b1" : "b2", title: id }));

// Песочница повторяет то, что даёт странице сборка варианта: MODULE_META и CONTENT_READY
// урезаны до модулей ученика (плюс m0 — он в каждом варианте).
function ctx({ me, st, ready, active, demoMod }) {
  const sb = {
    console, ME: me || null, ST: st || {}, activeTab: "overview", activeModule: active || "m0",
    MODULE_META: META.filter((m) => (ready || A1.concat(A2)).includes(m.id)),
    CONTENT_READY: ready || A1.concat(A2),
    metaOf: (id) => META.find((m) => m.id === id) || { id, num: id, title: "" },
    isTeacher: () => !!(sb.ME && (sb.ME.role === "teacher" || sb.ME.role === "admin")),
  };
  if (demoMod) sb.DEMO_MOD = demoMod;
  return loadBlock("TRAIL", { sandbox: sb,
    expose: ["myCourses", "startModule", "studyOpen", "studyBlocked", "isRevoked", "readyCourses", "moduleStatusOf"] });
}
const student = (courses, mods) => ({ login: "s", role: "student", courses, modules: mods });
const openAll = (ids) => ids.map((id) => ({ id, status: "open" }));

/* 1. Ученик A1: тропа его курса, старт на первом модуле */
{
  const s = ctx({ me: student(["a1"], openAll(A1)), ready: A1 });
  assert.strictEqual(s.myCourses().join(), "a1");
  assert.strictEqual(s.startModule(), "m0");
  assert.ok(s.studyOpen("m0") && !s.studyBlocked(), "свой модуль открыт");
}

/* 2. Ученик БЕЗ A1 (сдал его вне тренажёра): старт на своём первом модуле, а не на чужом М0.
   Именно это ломалось: приложение открывалось заглушкой «курс закрыт». */
{
  const ready = ["m0"].concat(A2); // m0 есть в любом варианте
  const s = ctx({ me: student(["a2"], openAll(A2)), ready });
  assert.strictEqual(s.myCourses().join(), "a2");
  assert.strictEqual(s.startModule(), "m12", "старт — первый модуль выданного курса");
  assert.ok(!s.studyOpen("m0"), "чужой М0 для занятий закрыт");
  assert.ok(!s.isRevoked("m0"), "но и «отнятым курсом» он не считается — его просто не выдавали");
}

/* 3. Офлайн у того же ученика (ME ещё нет): тропа не пустеет.
   Прежний жёсткий откат на «a1» оставлял ученика без A1 с пустым сайдбаром. */
{
  const ready = ["m0"].concat(A2);
  const saved = ctx({ me: null, st: { courses: ["a2"] }, ready });
  assert.strictEqual(saved.myCourses().join(), "a2", "берём последний известный список курсов");
  // первый заход офлайн, локального списка ещё нет — тропа из состава самой сборки
  const cold = ctx({ me: null, st: {}, ready });
  assert.ok(cold.myCourses().includes("a2"), "иначе — курсы готового контента сборки: " + cold.myCourses());
  assert.ok(cold.myCourses().length, "тропа никогда не пуста");
}

/* 4. Демо (сборка только с М0): каталог платных курсов не светится */
{
  const s = ctx({ me: null, st: {}, ready: ["m0"] });
  assert.strictEqual(s.myCourses().join(), "a1", "в демо виден ровно курс демо-модуля");
  assert.strictEqual(s.readyCourses().join(), "a1");
  // модуль демо — параметр сервера (DEMO_MOD): открыт он, остальные (и М0) заперты —
  // иначе клик по М0 в меню демо открывал пустую страницу, а М1 вставал под замок
  for (const dm of ["m1", "m2"]) {
    const d = ctx({ me: null, st: {}, ready: [dm], demoMod: dm });
    assert.strictEqual(d.moduleStatusOf(dm), "open", "демо " + dm + ": модуль демо открыт");
    assert.strictEqual(d.moduleStatusOf("m0"), "locked", "демо " + dm + ": М0 заперт");
  }
  assert.strictEqual(ctx({ me: null, st: {}, ready: ["m0"] }).moduleStatusOf("m0"), "open", "без DEMO_MOD (локальный режим) открыт М0");
}

/* 5. Отнятый курс: результаты видны, занятия закрыты.
   Сервер называет такие модули своим статусом result_only в /api/me —
   клиент не восстанавливает это состояние пересечением списков. */
{
  const ready = A1.concat(["m12", "m13"]); // модули отнятого A2 приехали ради результатов
  const mods = openAll(A1).concat([{ id: "m12", status: "result_only" }, { id: "m13", status: "result_only" }]);
  const s = ctx({ me: student(["a1"], mods), ready, active: "m12" });
  assert.ok(s.isRevoked("m12"), "модуль отнятого курса распознан по статусу");
  assert.ok(!s.studyOpen("m12"), "занятия по нему закрыты");
  assert.ok(s.studyBlocked(), "учебные вкладки отдают заглушку");
  assert.strictEqual(s.startModule(), "m0", "старт всё равно в своём курсе");
  // а закрытый преподавателем модуль своего курса — другое состояние, не «отняли курс»
  const s2 = ctx({ me: student(["a1"], A1.map((id) => ({ id, status: id === "m3" ? "locked_by_teacher" : "open" }))), ready: A1, active: "m3" });
  assert.ok(s2.studyBlocked() && !s2.isRevoked("m3"), "локом преподавателя курс не считается отнятым");
}

/* 6. Оба курса и преподаватель */
{
  const both = ctx({ me: student(["a1", "a2"], openAll(A1.concat(A2))) });
  assert.strictEqual(both.myCourses().join(), "a1,a2");
  assert.ok(both.studyOpen("m23"), "модули обоих курсов открыты");
  const teacher = ctx({ me: { login: "t", role: "teacher" }, ready: A1.concat(A2).concat(B1).concat(B2) });
  assert.strictEqual(teacher.myCourses().join(), "a1,a2,b1,b2", "преподавателю — весь каталог");
  assert.ok(teacher.studyOpen("m35") && !teacher.studyBlocked(), "и ничего не заперто");
}

/* 7. Ученик с непройденной тропой: старт — на первом ОТКРЫТОМ, а не на первом по списку */
{
  const mods = A1.map((id, i) => ({ id, status: i < 2 ? "passed" : i === 2 ? "open" : "locked" }));
  const s = ctx({ me: student(["a1"], mods), ready: A1 });
  assert.strictEqual(s.startModule(), "m0", "пройденный модуль тоже годится для входа");
  const s2 = ctx({ me: student(["a1"], A1.map((id, i) => ({ id, status: i === 5 ? "open" : "locked" }))), ready: A1 });
  assert.strictEqual(s2.startModule(), "m5", "первый открытый модуль тропы");
}

/* 9. Чистый B1 (A1/A2 сданы вне тренажёра): старт на m24, чужой М0 закрыт.
   Тот же класс дефекта, что ловил кейс 2, — на новом курсе. */
{
  const ready = ["m0"].concat(B1);
  const s = ctx({ me: student(["b1"], openAll(B1)), ready });
  assert.strictEqual(s.myCourses().join(), "b1");
  assert.strictEqual(s.startModule(), "m24", "старт — первый модуль B1");
  assert.ok(s.studyOpen("m35"), "экзаменационная неделя B1 открыта");
  assert.ok(!s.studyOpen("m0"), "чужой М0 для занятий закрыт");
  // офлайн у того же ученика
  const off = ctx({ me: null, st: { courses: ["b1"] }, ready });
  assert.strictEqual(off.myCourses().join(), "b1", "офлайн-тропа B1 не пустеет");
}

/* 10. A2+B1 без A1 и все три курса */
{
  const ready2 = ["m0"].concat(A2).concat(B1);
  const s = ctx({ me: student(["a2", "b1"], openAll(A2.concat(B1))), ready: ready2 });
  assert.strictEqual(s.myCourses().join(), "a2,b1");
  assert.strictEqual(s.startModule(), "m12", "старт — первый модуль первого выданного курса");
  assert.ok(s.studyOpen("m24") && s.studyOpen("m23"), "модули обоих курсов открыты");
  const all = ctx({ me: student(["a1", "a2", "b1"], openAll(A1.concat(A2).concat(B1))), ready: A1.concat(A2).concat(B1) });
  assert.strictEqual(all.myCourses().join(), "a1,a2,b1");
  assert.ok(all.studyOpen("m0") && all.studyOpen("m35"), "открыт весь путь от М0 до М35");
}

/* 9б. Чистый B2 (A1–B1 сданы вне тренажёра): старт на m36, чужой М0 закрыт —
   тот же класс дефекта на четвёртом курсе (механизм с набором — перебором). */
{
  const ready = ["m0"].concat(B2);
  const s = ctx({ me: student(["b2"], openAll(B2)), ready });
  assert.strictEqual(s.myCourses().join(), "b2");
  assert.strictEqual(s.startModule(), "m36", "старт — первый модуль B2");
  assert.ok(s.studyOpen("m47"), "экзаменационная неделя B2 открыта");
  assert.ok(!s.studyOpen("m0"), "чужой М0 для занятий закрыт");
  const off = ctx({ me: null, st: { courses: ["b2"] }, ready });
  assert.strictEqual(off.myCourses().join(), "b2", "офлайн-тропа B2 не пустеет");
  // B1+B2 без младших курсов и все четыре курса
  const two = ctx({ me: student(["b1", "b2"], openAll(B1.concat(B2))), ready: ["m0"].concat(B1).concat(B2) });
  assert.strictEqual(two.myCourses().join(), "b1,b2");
  assert.strictEqual(two.startModule(), "m24", "старт — первый модуль первого выданного курса");
  assert.ok(two.studyOpen("m35") && two.studyOpen("m36"), "модули обоих курсов открыты");
  const all4 = ctx({ me: student(["a1", "a2", "b1", "b2"], openAll(A1.concat(A2).concat(B1).concat(B2))), ready: A1.concat(A2).concat(B1).concat(B2) });
  assert.strictEqual(all4.myCourses().join(), "a1,a2,b1,b2");
  assert.ok(all4.studyOpen("m0") && all4.studyOpen("m47"), "открыт весь путь от М0 до М47");
  // сдача последнего модуля B1 не открывает B2: тропа считается по каждому курсу отдельно
  const b1only = ctx({ me: student(["b1"], openAll(B1)), ready: ["m0"].concat(B1).concat(B2) });
  assert.ok(!b1only.studyOpen("m36"), "без выдачи B2 его первый модуль закрыт");
}

/* 11. Отнятый B1 у ученика с живым A2: результаты видны, занятия закрыты */
{
  const ready = ["m0"].concat(A2).concat(["m24", "m25"]);
  const mods = openAll(A2).concat([{ id: "m24", status: "result_only" }, { id: "m25", status: "result_only" }]);
  const s = ctx({ me: student(["a2"], mods), ready, active: "m24" });
  assert.ok(s.isRevoked("m24"), "модуль отнятого B1 распознан по статусу");
  assert.ok(!s.studyOpen("m24") && s.studyBlocked(), "занятия по нему закрыты");
  assert.strictEqual(s.startModule(), "m12", "старт — в живом курсе");
}

/* 8. Битые данные не роняют тропу */
{
  const s = ctx({ me: { login: "s", role: "student", courses: ["c9"], modules: [] }, ready: A1 });
  assert.ok(s.myCourses().length, "неизвестный курс отбрасывается, тропа остаётся: " + s.myCourses());
  assert.ok(s.startModule(), "стартовый модуль всегда есть");
}

console.log("trail.test.js: OK (наборы курсов: A1, A2 без A1, оба, чистый B1, A2+B1, все три, чистый B2, B1+B2, все четыре, демо, отнятые A2 и B1, офлайн)");
