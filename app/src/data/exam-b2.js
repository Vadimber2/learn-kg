/* ===EXAM-B2=== Итоговая проверка курса learn.kg, уровень B2 (решение владельца 30.10.2026).

   Тот же движок и тот же принцип, что у EXAM_B1: части и объёмы — свои, по курсу
   B2; материал — только курс (дриллы, словарь, диалоги модулей B2, тексты
   data/exam-texts-b2.js, вопросительные фразы словаря, названия модулей). */
const EXAM_B2 = {
  level: "B2",   // подпись уровня в заголовке и питче ({lvl} в I18N)
  topicSkip: ["m46"],   // неделя повторения темой не служит
  subtests: [
    { id: "lexgram", ky: "Лексика. Грамматика", tasks: 50, min: 40, kind: "mcq",
      ru: "Лексика и грамматика", en: "Vocabulary and grammar", tr: "Söz varlığı ve dil bilgisi" },
    { id: "uguu", ky: "Угуу", tasks: 15, min: 20, kind: "listen",
      ru: "Аудирование", en: "Listening", tr: "Dinleme" },
    { id: "okuu", ky: "Окуу", tasks: 20, min: 25, kind: "read",
      ru: "Чтение", en: "Reading", tr: "Okuma" },
    { id: "jazuu", ky: "Жазуу", tasks: 2, min: 35, kind: "write",
      ru: "Письмо", en: "Writing", tr: "Yazma", qPick: 5, minSent: 10, maxSent: 14 },
    { id: "suiloo", ky: "Сүйлөө", tasks: 2, min: 12, kind: "speak",
      ru: "Говорение", en: "Speaking", tr: "Konuşma", qPick: 4, minSec: 90, maxSec: 150 },
  ],
};
/* Реестр спецификаций по курсам. EXAM_MODS и EXAM_LISTEN_MAX — общие для всех
   курсов, живут в data/exam-b1.js, здесь не дублируются. */
var EXAM_SPECS = EXAM_SPECS || {};
EXAM_SPECS.b2 = EXAM_B2;
/* ===/EXAM-B2=== */
