/* Слайды тем урока M1 (см. канон в data/lesson-slides.js): рисунок OpenAI БЕЗ текста,
   буквы и слова кладёт клиент настоящим текстом. Кыргызские слова — только слова
   скрипта озвучки deploy/lesson-m1-script.json, глоссы — дословно из него
   (гейт tests/lessons.test.js). Часть едет только в варианты с m1. */
Object.assign(LESSON_SLIDES, {
 "m1t1": {
  "img": "m1t1",
  "top": ["мен", "сен", "сиз"],
  "items": [
   { "ky": "ал", "gloss": { "ru": "он/она", "en": "he/she", "tr": "o" } },
   { "ky": "биз", "gloss": { "ru": "мы", "en": "we", "tr": "biz" } },
   { "ky": "алар", "gloss": { "ru": "они", "en": "they", "tr": "onlar" } }
  ]
 },
 "m1t2": {
  "img": "m1t2",
  "top": [],
  "items": [
   { "ky": "Мен дарыгермин.", "gloss": { "ru": "Я врач.", "en": "I am a doctor.", "tr": "Ben doktorum." } },
   { "ky": "Ал инженер.", "gloss": { "ru": "Он/она инженер.", "en": "He/she is an engineer.", "tr": "O mühendis." } }
  ]
 },
 "m1t3": {
  "img": "m1t3",
  "top": ["бы", "би", "бу", "бү"],
  "items": [
   { "ky": "Сиз дарыгерсизби?", "gloss": { "ru": "Вы врач?", "en": "Are you a doctor?", "tr": "Siz doktor musunuz?" } },
   { "ky": "Студентпи?", "gloss": { "ru": "студент?", "en": "a student?", "tr": "öğrenci mi?" } }
  ]
 },
 "m1t4": {
  "img": "m1t4",
  "top": ["эмес"],
  "items": [
   { "ky": "Мен мугалим эмесмин.", "gloss": { "ru": "Я не учитель.", "en": "I am not a teacher.", "tr": "Ben öğretmen değilim." } },
   { "ky": "Ал мугалим эмес.", "gloss": { "ru": "Он не учитель.", "en": "(S)he is not a teacher.", "tr": "O öğretmen değil." } }
  ]
 },
 "m1t5": {
  "img": "m1t5",
  "top": [],
  "items": [
   { "ky": "Канча жаштасыз?", "gloss": { "ru": "Сколько Вам лет?", "en": "How old are you?", "tr": "Kaç yaşındasınız?" } },
   { "ky": "Кайда жашайсыз?", "gloss": { "ru": "Где Вы живёте?", "en": "Where do you live?", "tr": "Nerede yaşıyorsunuz?" } },
   { "ky": "Кайдансыз?", "gloss": { "ru": "Откуда Вы?", "en": "Where are you from?", "tr": "Nerelisiniz?" } }
  ]
 },
 "m1t6": {
  "img": "m1t6",
  "top": [],
  "items": [
   { "ky": "Тааныш болдук!", "gloss": { "ru": "Приятно познакомиться!", "en": "Nice to meet you!", "tr": "Tanıştığımıza memnun oldum!" } },
   { "cap": { "ru": "Повторяйте вслух в паузах!", "en": "Repeat aloud in the pauses!", "tr": "Duraklamalarda yüksek sesle tekrarlayın!" } }
  ]
 }
});
