/* ===LESSON-SLIDES:m2=== Слайды тем урока модуля m2 («Семья и окружение»).
   Рисунок (app/lessons/<img>.webp) нарисован БЕЗ единой буквы — модель врёт в
   кириллице; буквы и слова кладёт клиент настоящим текстом панелями над и под
   картинкой. Кыргызские слова и глоссы — дословно из deploy/lesson-m2-script.json
   (гейт tests/lessons.test.js валит сочинённые). */
Object.assign(LESSON_SLIDES, {
 "m2t1": {
  "img": "m2t1",
  "top": ["атам", "апам"],
  "items": [
   { "ky": "атам", "gloss": { "ru": "мой отец", "en": "my father", "tr": "babam" } },
   { "ky": "апам", "gloss": { "ru": "моя мама", "en": "my mother", "tr": "annem" } },
   { "ky": "балам", "gloss": { "ru": "мой ребёнок", "en": "my child", "tr": "çocuğum" } },
   { "cap": { "ru": "Одно слово вместо двух: окончание уже значит «мой».",
              "en": "One word instead of two: the ending already means “my”.",
              "tr": "İki kelime yerine tek kelime: ek zaten «benim» demektir." } }
  ]
 },
 "m2t2": {
  "img": "m2t2",
  "top": ["кимдин"],
  "items": [
   { "ky": "кимдин?", "gloss": { "ru": "чей?", "en": "whose?", "tr": "kimin?" } },
   { "ky": "атамдын үйү", "gloss": { "ru": "дом моего отца", "en": "my father's house", "tr": "babamın evi" } },
   { "ky": "апамдын аты", "gloss": { "ru": "имя моей мамы", "en": "my mother's name", "tr": "annemin adı" } },
   { "cap": { "ru": "Хозяин и вещь работают парой: окончание есть у обоих.",
              "en": "Owner and thing work as a pair: both carry an ending.",
              "tr": "Sahip ve nesne birlikte çalışır: ikisi de ek alır." } }
  ]
 },
 "m2t3": {
  "img": "m2t3",
  "top": ["меники"],
  "items": [
   { "ky": "меники", "gloss": { "ru": "мой, моё", "en": "mine", "tr": "benimki" } },
   { "ky": "сеники", "gloss": { "ru": "твой, твоё", "en": "yours", "tr": "seninki" } },
   { "ky": "Бул кимдики?", "gloss": { "ru": "Чьё это?", "en": "Whose is this?", "tr": "Bu kimin?" } },
   { "cap": { "ru": "Вещь уже названа — хватает одного слова.",
              "en": "The thing is already named — one word is enough.",
              "tr": "Nesne zaten söylendi — tek kelime yeter." } }
  ]
 },
 "m2t4": {
  "img": "m2t4",
  "top": ["балдар"],
  "items": [
   { "ky": "кишилер", "gloss": { "ru": "люди", "en": "people", "tr": "insanlar" } },
   { "ky": "туугандар", "gloss": { "ru": "родственники", "en": "relatives", "tr": "akrabalar" } },
   { "ky": "достор", "gloss": { "ru": "друзья", "en": "friends", "tr": "arkadaşlar" } },
   { "ky": "балдар", "gloss": { "ru": "дети", "en": "children", "tr": "çocuklar" } },
   { "cap": { "ru": "Одно окончание, три начала — по последнему звуку слова.",
              "en": "One ending with three beginnings — picked by the last sound.",
              "tr": "Tek ek, üç başlangıç — son sese göre seçilir." } }
  ]
 },
 "m2t5": {
  "img": "m2t5",
  "top": ["бар", "жок"],
  "items": [
   { "ky": "Балдарыңыз барбы?", "gloss": { "ru": "У Вас есть дети?", "en": "Do you have children?", "tr": "Çocuklarınız var mı?" } },
   { "ky": "Менин эки балам бар.", "gloss": { "ru": "У меня двое детей.", "en": "I have two children.", "tr": "İki çocuğum var." } },
   { "ky": "Менин балдарым жок.", "gloss": { "ru": "У меня нет детей.", "en": "I have no children.", "tr": "Çocuğum yok." } },
   { "cap": { "ru": "После числительного слово остаётся в единственном числе.",
              "en": "After a numeral the noun stays singular.",
              "tr": "Sayıdan sonra ad tekil kalır." } }
  ]
 },
 "m2t6": {
  "img": "m2t6",
  "top": ["апам"],
  "items": [
   { "ky": "Апам мугалим.", "gloss": { "ru": "Моя мама — учительница.", "en": "My mother is a teacher.", "tr": "Annem öğretmen." } },
   { "ky": "Биз бирге жашайбыз.", "gloss": { "ru": "Мы живём вместе.", "en": "We live together.", "tr": "Birlikte yaşıyoruz." } },
   { "cap": { "ru": "Теперь расскажите о своей семье целиком.",
              "en": "Now tell the whole story of your family.",
              "tr": "Şimdi ailenizi baştan sona anlatın." } }
  ]
 }
});
/* ===/LESSON-SLIDES:m2=== */
