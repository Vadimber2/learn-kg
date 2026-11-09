/* ===LESSONS=== Реестр уроков модуля. ГЕНЕРИРУЕТСЯ из deploy/pronunciation-script.json
   (deploy/gen-lessons.js) — транскрипция в уроке и текст, которым озвучено аудио, обязаны
   быть одним источником, иначе на экране будет одно, а в наушниках другое. Правки вносить
   в скрипт озвучки и перегенерировать; соответствие стережёт tests/lessons.test.js. */
const LESSONS = {
 "m0": {
  "id": "phonetics",
  "title": {
   "ru": "Урок 1. Произношение: звуки кыргызского",
   "en": "Lesson 1. Pronunciation: the sounds of Kyrgyz",
   "tr": "Ders 1. Sesletim: Kırgızcanın sesleri"
  },
  "intro": {
   "ru": "Восемь тем: три особых звука, долгота, сингармонизм, ударение, согласные, редукция, стыки слов и практика. Объяснение на вашем языке, примеры — голосом носителя. Можно слушать подряд, с текстом или без.",
   "en": "Eight topics: three special sounds, vowel length, harmony, stress, consonants, reduction, word boundaries and practice. Explanations in your language, examples in a native voice. Listen straight through, with or without text.",
   "tr": "Sekiz konu: üç özel ses, ünlü uzunluğu, ünlü uyumu, vurgu, ünsüzler, daralma, kelime sınırları ve alıştırma. Açıklamalar sizin dilinizde, örnekler ana dili sesiyle. Baştan sona, metinli ya da metinsiz dinleyin."
  },
  "voiceRole": "female_adult",
  "themes": [
   {
    "id": "p1",
    "title": {
     "ru": "Три особых звука: ө, ү, ң",
     "en": "Three special sounds: ө, ү, ң",
     "tr": "Üç özel ses: ө, ү, ң"
    }
   },
   {
    "id": "p2",
    "title": {
     "ru": "Долгота гласных меняет смысл",
     "en": "Vowel length changes the meaning",
     "tr": "Ünlü uzunluğu anlamı değiştirir"
    }
   },
   {
    "id": "p3",
    "title": {
     "ru": "Сингармонизм: почему окончания меняются",
     "en": "Vowel harmony: why endings change",
     "tr": "Ünlü uyumu: ekler neden değişir"
    }
   },
   {
    "id": "p4",
    "title": {
     "ru": "Ударение на последнем слоге",
     "en": "Stress falls on the last syllable",
     "tr": "Vurgu son hecede"
    }
   },
   {
    "id": "p5",
    "title": {
     "ru": "Согласные: ж как дж, к и г из глубины",
     "en": "Consonants: ж as “j”, к and г from deeper",
     "tr": "Ünsüzler: ж “c” gibi, к ve г daha gırtlaktan"
    }
   },
   {
    "id": "p6",
    "title": {
     "ru": "Что редуцируется, а что нет",
     "en": "What gets reduced and what does not",
     "tr": "Ne zayıflar, ne zayıflamaz"
    }
   },
   {
    "id": "p7",
    "title": {
     "ru": "Стыки слов: почему нейтив говорит иначе",
     "en": "Word boundaries: why natives sound different",
     "tr": "Kelime sınırları: ana dili konuşurları neden farklı söyler"
    }
   },
   {
    "id": "p8",
    "title": {
     "ru": "Практика: слова и фразы со всеми звуками",
     "en": "Practice: words and phrases with every sound",
     "tr": "Alıştırma: tüm sesleri içeren kelimeler ve kalıplar"
    }
   }
  ],
  "segments": [
   {
    "theme": "p1",
    "kind": "explain",
    "a": "ph_p1_01",
    "perLang": true,
    "text": {
     "ru": "Кыргызский пишется кириллицей: тридцать три знакомые буквы плюс три собственные. Начнём с них. Первый новый звук делается так: скажите «э», задержите — и, не двигая язык, вытяните губы трубочкой, как для «о». Язык остаётся на месте, работают только губы. Слушайте три слова.",
     "en": "Kyrgyz uses the Cyrillic alphabet: thirty-three letters plus three of its own. Start with those. The first one is a rounded front vowel. Say the vowel in “bed”, hold it, and then round your lips as if you were about to whistle — the tongue does not move at all. Listen to three words.",
     "tr": "Kırgızca Kiril alfabesiyle yazılır: otuz üç harf, artı üçü kendine özgü. İyi haber: bu üç sesin ikisi sizde zaten var. İlki tam olarak Türkçedeki ö. Üç kelimeyi dinleyin."
    }
   },
   {
    "theme": "p1",
    "kind": "example",
    "a": "ph_p1_02",
    "ky": "Көл. Көз. Өз.",
    "gloss": {
     "ru": "озеро · глаз · сам",
     "en": "lake · eye · self",
     "tr": "göl · göz · kendi"
    }
   },
   {
    "theme": "p1",
    "kind": "explain",
    "a": "ph_p1_03",
    "perLang": true,
    "text": {
     "ru": "Тот же звук внутри фразы — так он звучит в потоке речи.",
     "en": "The same sound inside a phrase — this is how it sounds in running speech.",
     "tr": "Aynı ses bir cümle içinde — akıcı konuşmada böyle duyulur."
    }
   },
   {
    "theme": "p1",
    "kind": "example",
    "a": "ph_p1_04",
    "ky": "Биз көлгө бардык. Өзүңүздү кандай сезип жатасыз?",
    "gloss": {
     "ru": "Мы ездили на озеро. · Как Вы себя чувствуете?",
     "en": "We went to the lake. · How do you feel?",
     "tr": "Biz göle gittik. · Kendinizi nasıl hissediyorsunuz?"
    }
   },
   {
    "theme": "p1",
    "kind": "explain",
    "a": "ph_p1_05",
    "perLang": true,
    "text": {
     "ru": "Второй новый звук делается так же, только начните с «и»: тяните «и» и округлите губы, как для «у». Язык снова не двигается — меняются только губы. Слушайте.",
     "en": "The second one is made the same way, only you start from the vowel in “see”: hold it and round your lips, again without moving the tongue. Listen.",
     "tr": "İkincisi Türkçedeki ü ile aynı — yeni bir şey öğrenmenize gerek yok, sadece Kırgızca kelimelerde duymaya alışın."
    }
   },
   {
    "theme": "p1",
    "kind": "example",
    "a": "ph_p1_06",
    "ky": "Үй. Сүт. Гүл.",
    "gloss": {
     "ru": "дом · молоко · цветок",
     "en": "house · milk · flower",
     "tr": "ev · süt · çiçek"
    }
   },
   {
    "theme": "p1",
    "kind": "explain",
    "a": "ph_p1_07",
    "perLang": true,
    "text": {
     "ru": "И третий новый звук — носовой. Язык смыкается с мягким нёбом, а воздух идёт через нос, и никакого «г» на конце не слышно. Ближайший русский ориентир — «н» в слове «банк»: она произносится глубже обычной. В начале слова этот звук не встречается.",
     "en": "The third sound is nasal, and English has it too — but only as a spelling of two letters, never on its own. The back of the tongue meets the soft palate, the air goes out through the nose, and nothing is released after it: no hard consonant at the end. Spelling it out would be misleading, so let the native voice show it. In Kyrgyz this sound never begins a word.",
     "tr": "Üçüncü ses genizden gelir: Türkçede “renk” ya da “yankı” derken duyduğunuz o arka “n”. Dil yumuşak damağa değer, hava burundan çıkar, sonunda ayrı bir “g” duyulmaz. Kırgızcada bu ses kelime başında bulunmaz."
    }
   },
   {
    "theme": "p1",
    "kind": "example",
    "a": "ph_p1_08",
    "ky": "Миң. Таң. Сиңди.",
    "gloss": {
     "ru": "тысяча · рассвет · младшая сестра",
     "en": "thousand · dawn · younger sister",
     "tr": "bin · şafak · küçük kız kardeş"
    }
   },
   {
    "theme": "p1",
    "kind": "explain",
    "a": "ph_p1_09",
    "perLang": true,
    "text": {
     "ru": "А теперь носовой внутри фраз — вместе с утренним приветствием и пожеланием доброго пути.",
     "en": "Now the nasal inside phrases — together with a morning greeting and a wish for a good journey.",
     "tr": "Şimdi genizden gelen ses cümle içinde — sabah selamı ve iyi yolculuk dileğiyle birlikte."
    }
   },
   {
    "theme": "p1",
    "kind": "example",
    "a": "ph_p1_10",
    "ky": "Кайырлуу таң! Жолуңуз шыдыр болсун!",
    "gloss": {
     "ru": "Доброе утро! · Счастливого пути!",
     "en": "Good morning! · Have a good trip!",
     "tr": "Günaydın! · Yolunuz açık olsun!"
    },
    "gap": true
   },
   {
    "theme": "p2",
    "kind": "explain",
    "a": "ph_p2_01",
    "perLang": true,
    "text": {
     "ru": "В кыргызском восемь кратких гласных и шесть долгих. Долгота различает слова, поэтому её нельзя проглатывать. Слушайте пару: «продай» и «час».",
     "en": "Kyrgyz has eight short vowels and six long ones. Length distinguishes words, so it must not be swallowed. Listen to a pair: “sell” and “hour”.",
     "tr": "Kırgızcada sekiz kısa, altı uzun ünlü var. Uzunluk kelimeleri birbirinden ayırır, bu yüzden yutulmamalı. Bir çifti dinleyin: “sat” ve “saat”."
    }
   },
   {
    "theme": "p2",
    "kind": "example",
    "a": "ph_p2_02",
    "ky": "Сат. Саат.",
    "gloss": {
     "ru": "продай · час (долгота меняет слово)",
     "en": "sell · hour (length changes the word)",
     "tr": "sat · saat (uzunluk kelimeyi değiştirir)"
    }
   },
   {
    "theme": "p2",
    "kind": "explain",
    "a": "ph_p2_03",
    "perLang": true,
    "text": {
     "ru": "Ещё две пары: «спина» и «толстый», затем «серый» и «сурок».",
     "en": "Two more pairs: “back” and “thick”, then “grey” and “marmot”.",
     "tr": "İki çift daha: “sırt” ve “kalın”, ardından “gri” ve “dağ sıçanı”."
    }
   },
   {
    "theme": "p2",
    "kind": "example",
    "a": "ph_p2_04",
    "ky": "Жон. Жоон. Сур. Суур.",
    "gloss": {
     "ru": "спина · толстый · серый · сурок",
     "en": "back · thick · grey · marmot",
     "tr": "sırt · kalın · gri · dağ sıçanı"
    }
   },
   {
    "theme": "p2",
    "kind": "explain",
    "a": "ph_p2_05",
    "perLang": true,
    "text": {
     "ru": "На письме долгий гласный — всегда сдвоенная буква, ошибиться нельзя. Послушайте долготу внутри фраз.",
     "en": "In writing a long vowel is always a doubled letter, so you cannot miss it. Now hear length inside phrases.",
     "tr": "Yazıda uzun ünlü her zaman çift harfle gösterilir, yani gözden kaçmaz. Şimdi uzunluğu cümle içinde duyun."
    }
   },
   {
    "theme": "p2",
    "kind": "example",
    "a": "ph_p2_06",
    "ky": "Учак бир саатка кечигип жатат. Сууга түшүү.",
    "gloss": {
     "ru": "Самолёт опаздывает на час. · купаться",
     "en": "The plane is an hour late. · to bathe, to swim",
     "tr": "Uçak bir saat rötarlı. · yüzmek, suya girmek"
    },
    "gap": true
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_01",
    "perLang": true,
    "text": {
     "ru": "Главный закон кыргызского — сингармонизм: гласные внутри слова и во всех его окончаниях принадлежат одному ряду. Рядов два. Сначала послушайте твёрдый ряд — его гласные произносит носитель.",
     "en": "The main law of Kyrgyz is vowel harmony: the vowels inside a word and in all its endings belong to one row. There are two rows. First listen to the back row — a native speaker pronounces its vowels.",
     "tr": "Kırgızcanın temel kuralı ünlü uyumudur: kelimenin içindeki ve tüm eklerindeki ünlüler aynı sıradan olur. İki sıra var. Önce kalın sırayı dinleyin — ünlüleri ana dili konuşuru söylüyor."
    }
   },
   {
    "theme": "p3",
    "kind": "example",
    "a": "ph_p3_02",
    "ky": "А. О. У. Ы.",
    "gloss": {
     "ru": "твёрдый ряд гласных",
     "en": "the back (hard) vowel row",
     "tr": "kalın ünlü sırası"
    },
    "repeat": true
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_03",
    "perLang": true,
    "text": {
     "ru": "А это мягкий ряд. Два звука в нём — те самые, с округлёнными губами, с которых начинался урок.",
     "en": "And this is the front row. Two of its vowels are the rounded ones we started the lesson with.",
     "tr": "Bu da ince sıra. İçindeki iki ünlü, derse başladığımız yuvarlak seslerdir."
    }
   },
   {
    "theme": "p3",
    "kind": "example",
    "a": "ph_p3_04",
    "ky": "Э. Ө. Ү. И.",
    "gloss": {
     "ru": "мягкий ряд гласных",
     "en": "the front (soft) vowel row",
     "tr": "ince ünlü sırası"
    },
    "repeat": true
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_05",
    "perLang": true,
    "text": {
     "ru": "Теперь посмотрим, как ряд управляет окончаниями. Слово твёрдого ряда — и все окончания твёрдые.",
     "en": "Now see how the row governs the endings. A back-row word — and all its endings are back-row too.",
     "tr": "Şimdi sıranın ekleri nasıl yönettiğine bakın. Kalın sıradan bir kelime — ekleri de kalın."
    }
   },
   {
    "theme": "p3",
    "kind": "example",
    "a": "ph_p3_06",
    "ky": "Айыл. Айылдаштарыбыз.",
    "gloss": {
     "ru": "село · наши односельчане (окончания твёрдые)",
     "en": "village · our fellow villagers (back-vowel suffixes)",
     "tr": "köy · köylülerimiz (kalın ekler)"
    }
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_07",
    "perLang": true,
    "text": {
     "ru": "А это слово мягкого ряда — и окончания тоже мягкие.",
     "en": "And this is a front-row word — its endings are front-row as well.",
     "tr": "Bu ise ince sıradan bir kelime — ekleri de ince."
    }
   },
   {
    "theme": "p3",
    "kind": "example",
    "a": "ph_p3_08",
    "ky": "Тегирмен. Тегирменчилер.",
    "gloss": {
     "ru": "мельница · мельники (окончания мягкие)",
     "en": "mill · millers (front-vowel suffixes)",
     "tr": "değirmen · değirmenciler (ince ekler)"
    }
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_09",
    "perLang": true,
    "text": {
     "ru": "Есть и губное правило: после губных гласных окончание тоже становится губным. Сравните на живых фразах.",
     "en": "There is also a rounding rule: after rounded vowels the ending becomes rounded too. Compare on real phrases.",
     "tr": "Bir de yuvarlaklaşma kuralı var: yuvarlak ünlülerden sonra ek de yuvarlak olur. Gerçek cümlelerde karşılaştırın."
    }
   },
   {
    "theme": "p3",
    "kind": "example",
    "a": "ph_p3_10",
    "ky": "Жумуш күнү. Мен китеп окуганды жакшы көрөм.",
    "gloss": {
     "ru": "рабочий день · Я люблю читать книги.",
     "en": "working day · I love reading books.",
     "tr": "iş günü · Ben kitap okumayı severim."
    }
   },
   {
    "theme": "p3",
    "kind": "explain",
    "a": "ph_p3_11",
    "perLang": true,
    "text": {
     "ru": "Практический вывод: не заучивайте таблицы окончаний. Прислушайтесь к первому слогу — он подскажет, какое окончание звучит естественно.",
     "en": "Practical takeaway: do not memorise tables of endings. Listen to the first syllable — it tells you which ending sounds natural.",
     "tr": "Pratik sonuç: ek tablolarını ezberlemeyin. İlk heceyi dinleyin — hangi ekin doğal duyulacağını o söyler."
    },
    "gap": true
   },
   {
    "theme": "p4",
    "kind": "explain",
    "a": "ph_p4_01",
    "perLang": true,
    "text": {
     "ru": "Ударение в кыргызском почти всегда на последнем слоге — не на корне, как часто в русском. Слушайте слова.",
     "en": "In Kyrgyz the stress almost always falls on the last syllable. English stress is unpredictable and has to be learned word by word; here there is one rule that covers nearly everything. Listen to the words.",
     "tr": "Kırgızcada vurgu neredeyse her zaman son hecededir — Türkçede olduğu gibi. Bu, sizin için bilindik bir ritim. Kelimeleri dinleyin."
    }
   },
   {
    "theme": "p4",
    "kind": "example",
    "a": "ph_p4_02",
    "ky": "Китеп. Мугалим. Саламатсызбы.",
    "gloss": {
     "ru": "книга · учитель · Здравствуйте! (вежливо)",
     "en": "book · teacher · Hello! (polite)",
     "tr": "kitap · öğretmen · Merhaba! (kibar)"
    }
   },
   {
    "theme": "p4",
    "kind": "explain",
    "a": "ph_p4_03",
    "perLang": true,
    "text": {
     "ru": "При добавлении окончаний ударение переезжает вместе с концом слова.",
     "en": "When endings are added, the stress moves along with the end of the word.",
     "tr": "Ekler eklendiğinde vurgu kelimenin sonuyla birlikte kayar."
    }
   },
   {
    "theme": "p4",
    "kind": "example",
    "a": "ph_p4_04",
    "ky": "Китеп. Китепте. Китептерде.",
    "gloss": {
     "ru": "книга · в книге · в книгах (ударение едет к концу)",
     "en": "book · in the book · in the books (stress moves to the end)",
     "tr": "kitap · kitapta · kitaplarda (vurgu sona kayar)"
    }
   },
   {
    "theme": "p4",
    "kind": "explain",
    "a": "ph_p4_05",
    "perLang": true,
    "text": {
     "ru": "Из-за этого фраза звучит ровно, с лёгким подъёмом к концу каждого слова. Послушайте целые фразы и повторите за мной.",
     "en": "Because of this a phrase sounds even, with a slight rise towards the end of each word. Listen to full phrases and repeat after me.",
     "tr": "Bu yüzden cümle düz akar, her kelimenin sonuna doğru hafif bir yükselme olur. Tam cümleleri dinleyin ve ardımdan tekrarlayın."
    }
   },
   {
    "theme": "p4",
    "kind": "example",
    "a": "ph_p4_06",
    "ky": "Саламатсызбы! Кандайсыз? Жакшы, рахмат. Көрүшкөнчө!",
    "gloss": {
     "ru": "Здравствуйте! (вежливо) · Как Вы? / Как дела? (вежливо) · Хорошо, спасибо (ответ на «как дела?») · До встречи!",
     "en": "Hello! (polite) · How are you? (polite) · Fine, thanks (reply to “how are you?”) · See you!",
     "tr": "Merhaba! (kibar) · Nasılsınız? (kibar) · İyiyim, teşekkürler (“nasılsın?” sorusuna cevap) · Görüşmek üzere!"
    },
    "gap": true
   },
   {
    "theme": "p5",
    "kind": "explain",
    "a": "ph_p5_01",
    "perLang": true,
    "text": {
     "ru": "Теперь согласные, где русская привычка мешает. Буква ж читается не как русское «ж», а как звонкое «дж». Слушайте внимательно.",
     "en": "Now the consonants that surprise learners. The first consonant of the words you are about to hear is not the soft sound in “measure” — it is the full “j” of “jam”, an affricate with a hard start. Listen closely.",
     "tr": "Şimdi ünsüzler. Birazdan duyacağınız kelimelerin ilk ünsüzü tam olarak Türkçedeki “c” sesidir — “cam”, “can” derken çıkardığınız ses. Dikkatle dinleyin."
    }
   },
   {
    "theme": "p5",
    "kind": "example",
    "a": "ph_p5_02",
    "ky": "Жол. Жаңы. Жакшы.",
    "gloss": {
     "ru": "дорога · новый · хорошо (ж как дж)",
     "en": "road · new · good (ж sounds like “j”)",
     "tr": "yol · yeni · iyi (ж, “c” gibi)"
    }
   },
   {
    "theme": "p5",
    "kind": "explain",
    "a": "ph_p5_03",
    "perLang": true,
    "text": {
     "ru": "Тот же звук во фразах — именно так он звучит в живой речи.",
     "en": "The same sound in phrases — this is how it works in living speech.",
     "tr": "Aynı ses cümlelerde — canlı konuşmada böyle işler."
    }
   },
   {
    "theme": "p5",
    "kind": "example",
    "a": "ph_p5_04",
    "ky": "Эс алуу жакшы өттү. Мен китеп окуганды жакшы көрөм.",
    "gloss": {
     "ru": "Отдых прошёл хорошо. · Я люблю читать книги.",
     "en": "The holiday went well. · I love reading books.",
     "tr": "Tatil iyi geçti. · Ben kitap okumayı severim."
    }
   },
   {
    "theme": "p5",
    "kind": "explain",
    "a": "ph_p5_05",
    "perLang": true,
    "text": {
     "ru": "Дальше к и г. В мягких словах они обычные, а в твёрдых уходят глубже в горло. Сначала мягкие, потом твёрдые.",
     "en": "Next, the k and the g. In front-vowel words they sound as you expect; in back-vowel words they slide deeper, made further back in the throat, almost against the uvula. First the front-vowel words, then the back-vowel ones.",
     "tr": "Sırada k ve g sesleri var. İnce ünlülü kelimelerde beklediğiniz gibi çıkarlar; kalın ünlülü kelimelerde daha arkadan, neredeyse gırtlaktan söylenir. Önce ince, sonra kalın olanlar."
    }
   },
   {
    "theme": "p5",
    "kind": "example",
    "a": "ph_p5_06",
    "ky": "Күл. Гүл. Кызыл. Кол.",
    "gloss": {
     "ru": "пепел · цветок · красный · рука (к и г глубже в твёрдых словах)",
     "en": "ash · flower · red · hand (к and г go deeper in back-vowel words)",
     "tr": "kül · gül · kızıl · el (kalın kelimelerde к ve г gırtlaktan)"
    }
   },
   {
    "theme": "p5",
    "kind": "explain",
    "a": "ph_p5_07",
    "perLang": true,
    "text": {
     "ru": "И то же во фразе. Заодно услышите раскатистое кыргызское р — его не глотают.",
     "en": "And the same inside a phrase. You will also hear the rolled Kyrgyz “r” — it is never swallowed.",
     "tr": "Aynısı cümle içinde. Ayrıca Kırgızcanın çarpmalı “r”sini duyacaksınız — asla yutulmaz."
    }
   },
   {
    "theme": "p5",
    "kind": "example",
    "a": "ph_p5_08",
    "ky": "Кайда эс алдыңыз? Учак канчада учат?",
    "gloss": {
     "ru": "Где Вы отдыхали? · Во сколько вылетает самолёт?",
     "en": "Where did you spend your holiday? · What time does the plane take off?",
     "tr": "Tatilinizi nerede geçirdiniz? · Uçak saat kaçta kalkıyor?"
    },
    "gap": true
   },
   {
    "theme": "p6",
    "kind": "explain",
    "a": "ph_p6_01",
    "perLang": true,
    "text": {
     "ru": "Частая ошибка русскоязычных — переносить русскую редукцию. В русском «молоко» мы произносим с тремя разными «о». В кыргызском широкие гласные так не глотают: каждое а и о звучит отчётливо.",
     "en": "A habit worth unlearning: English reduces unstressed vowels to a schwa — think of “banana”, where two of the three a's almost disappear. Kyrgyz keeps wide vowels full: every a and o stays clear.",
     "tr": "İyi haber: Türkçe gibi Kırgızca da geniş ünlüleri yutmaz — her a ve o net kalır. İngilizcedeki gibi vurgusuz ünlüleri belirsiz bir sese indirme alışkanlığı burada yok."
    }
   },
   {
    "theme": "p6",
    "kind": "example",
    "a": "ph_p6_02",
    "ky": "Бала. Балалар. Ата-энеси.",
    "gloss": {
     "ru": "ребёнок · дети · его родители (широкие гласные не глотаются)",
     "en": "child · children · their parents (wide vowels stay full)",
     "tr": "çocuk · çocuklar · anne babası (geniş ünlüler tam okunur)"
    }
   },
   {
    "theme": "p6",
    "kind": "explain",
    "a": "ph_p6_03",
    "perLang": true,
    "text": {
     "ru": "А узкие гласные — «и», «ы», «у» и тот четвёртый, с округлёнными губами, с которого мы начинали урок — в безударных слогах действительно ослабляются. Послушайте разницу.",
     "en": "The narrow vowels are another matter — the ones close to “ee” and “oo”, plus the two rounded vowels we began the lesson with. In unstressed syllables these do weaken. Hear the difference.",
     "tr": "Ancak dar ünlüler — Türkçedeki “i”, “ı”, “u” ve “ü” karşılıkları — vurgusuz hecelerde zayıflar. Farkı duyun."
    }
   },
   {
    "theme": "p6",
    "kind": "example",
    "a": "ph_p6_04",
    "ky": "Киши. Тышкы. Күчүк.",
    "gloss": {
     "ru": "человек · внешний · щенок (узкие гласные ослаблены)",
     "en": "person · outer · puppy (narrow vowels are reduced)",
     "tr": "kişi · dış · köpek yavrusu (dar ünlüler zayıflar)"
    }
   },
   {
    "theme": "p6",
    "kind": "explain",
    "a": "ph_p6_05",
    "perLang": true,
    "text": {
     "ru": "И то же внутри фраз: узкие гласные звучат коротко, почти проглатываются.",
     "en": "And the same inside phrases: narrow vowels sound short, almost swallowed.",
     "tr": "Aynısı cümle içinde: dar ünlüler kısa, neredeyse yutulmuş duyulur."
    }
   },
   {
    "theme": "p6",
    "kind": "example",
    "a": "ph_p6_06",
    "ky": "Бир кишилик бөлмө. Өрт өчүрүү кызматы — жүз бир.",
    "gloss": {
     "ru": "одноместный номер · Пожарная служба — 101.",
     "en": "single room · Fire service — 101.",
     "tr": "tek kişilik oda · İtfaiye — yüz bir."
    },
    "gap": true
   },
   {
    "theme": "p7",
    "kind": "explain",
    "a": "ph_p7_01",
    "perLang": true,
    "text": {
     "ru": "Самая полезная тема, если хотите звучать естественно. На стыке слов звуки подстраиваются друг под друга, и нейтив произносит не то, что написано. Написано «аш болсун», а звучит аш полсун. Слушайте.",
     "en": "The most useful topic if you want to sound natural. At word boundaries sounds adjust to each other, and a native does not pronounce what is written. It is written “ash bolsun” — “enjoy your meal” — but it sounds “ash polsun”. Listen.",
     "tr": "Doğal duyulmak istiyorsanız en yararlı konu. Kelime sınırlarında sesler birbirine uyar ve ana dili konuşuru yazılanı söylemez. “Aş bolsun” yazılır — “afiyet olsun” — ama “aş polsun” duyulur. Dinleyin."
    }
   },
   {
    "theme": "p7",
    "kind": "example",
    "a": "ph_p7_02",
    "ky": "Аш болсун! Ак паш. Үч пөлмө.",
    "gloss": {
     "ru": "приятного аппетита · «ак баш» и «үч бөлмө» как слышится",
     "en": "enjoy your meal · “ак баш” and “үч бөлмө” as actually pronounced",
     "tr": "afiyet olsun · “ак баш” ve “үч бөлмө”nün duyulan hâli"
    }
   },
   {
    "theme": "p7",
    "kind": "explain",
    "a": "ph_p7_03",
    "perLang": true,
    "text": {
     "ru": "Это оглушение: звонкий рядом с глухим теряет голос. Бывает и наоборот — глухой между гласными или после сонорного озвончается. Написано «ар кандай», звучит ар гандай.",
     "en": "That is devoicing: a voiced consonant next to a voiceless one loses its voice — the same thing English does in “cats” versus “dogs”. The reverse also happens: a voiceless consonant between vowels or after a sonorant becomes voiced.",
     "tr": "Bu, Türkçeden bildiğiniz ünsüz benzeşmesinin aynısı: sedalı ünsüz, sedasızın yanında sedasızlaşır. Tersi de olur — ünlüler arasında ya da akıcı ünsüzden sonra sedasız ünsüz sedalanır."
    }
   },
   {
    "theme": "p7",
    "kind": "example",
    "a": "ph_p7_04",
    "ky": "Ар гандай. Тил гат. Аг нан.",
    "gloss": {
     "ru": "«ар кандай», «тил кат», «ак нан» как слышится",
     "en": "“ар кандай”, “тил кат”, “ак нан” as actually pronounced",
     "tr": "“ар кандай”, “тил кат”, “ак нан”ın duyulan hâli"
    }
   },
   {
    "theme": "p7",
    "kind": "explain",
    "a": "ph_p7_05",
    "perLang": true,
    "text": {
     "ru": "Писать нужно по правилам, а произносить — как удобно языку. Именно это делает речь живой, а не учебной.",
     "en": "Write by the rules, pronounce the way the tongue prefers. That is exactly what makes speech alive rather than textbook.",
     "tr": "Kurala göre yazın, dilin rahat ettiği gibi söyleyin. Konuşmayı ders kitabı gibi değil, canlı yapan tam olarak budur."
    },
    "gap": true
   },
   {
    "theme": "p8",
    "kind": "explain",
    "a": "ph_p8_01",
    "perLang": true,
    "text": {
     "ru": "Закрепим всё вместе. Я произношу слово, вы повторяете вслух в паузе. Не спешите: важно попасть в звук, а не в темп.",
     "en": "Let us put it all together. I say a word, you repeat it aloud in the pause. Do not rush: hitting the sound matters more than keeping the tempo.",
     "tr": "Şimdi hepsini birleştirelim. Ben bir kelime söylüyorum, siz duraklamada yüksek sesle tekrarlıyorsunuz. Acele etmeyin: sesi tutturmak, tempoyu tutturmaktan önemli."
    }
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_02",
    "ky": "Үй.",
    "gloss": {
     "ru": "дом",
     "en": "house",
     "tr": "ev"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_03",
    "ky": "Көл.",
    "gloss": {
     "ru": "озеро",
     "en": "lake",
     "tr": "göl"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_04",
    "ky": "Сүт.",
    "gloss": {
     "ru": "молоко",
     "en": "milk",
     "tr": "süt"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_05",
    "ky": "Гүл.",
    "gloss": {
     "ru": "цветок",
     "en": "flower",
     "tr": "çiçek"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_06",
    "ky": "Миң.",
    "gloss": {
     "ru": "тысяча",
     "en": "thousand",
     "tr": "bin"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_07",
    "ky": "Таң.",
    "gloss": {
     "ru": "рассвет, утро",
     "en": "dawn, morning",
     "tr": "şafak, sabah"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_08",
    "ky": "Жол.",
    "gloss": {
     "ru": "дорога",
     "en": "road",
     "tr": "yol"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_09",
    "ky": "Кызыл.",
    "gloss": {
     "ru": "красный",
     "en": "red",
     "tr": "kızıl, kırmızı"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_10",
    "ky": "Саат.",
    "gloss": {
     "ru": "час; часы",
     "en": "hour; clock",
     "tr": "saat"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_11",
    "ky": "Көрүшкөнчө.",
    "gloss": {
     "ru": "До встречи!",
     "en": "See you!",
     "tr": "Görüşmek üzere!"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "explain",
    "a": "ph_p8_12",
    "perLang": true,
    "text": {
     "ru": "Теперь две фразы. Слушайте, потом повторяйте целиком в паузе.",
     "en": "Now two phrases. Listen, then repeat each one in full during the pause.",
     "tr": "Şimdi iki cümle. Dinleyin, sonra duraklamada her birini bütün olarak tekrarlayın."
    }
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_13",
    "ky": "Кайырлуу таң! Кандайсыз?",
    "gloss": {
     "ru": "Доброе утро! · Как Вы? / Как дела? (вежливо)",
     "en": "Good morning! · How are you? (polite)",
     "tr": "Günaydın! · Nasılsınız? (kibar)"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "example",
    "a": "ph_p8_14",
    "ky": "Жакшы, рахмат. Чоң рахмат, көрүшкөнчө!",
    "gloss": {
     "ru": "хорошо, спасибо · большое спасибо, до встречи",
     "en": "fine, thanks · thank you very much, see you",
     "tr": "iyiyim, teşekkürler · çok teşekkürler, görüşürüz"
    },
    "repeat": true
   },
   {
    "theme": "p8",
    "kind": "explain",
    "a": "ph_p8_15",
    "perLang": true,
    "text": {
     "ru": "Если вы произнесли это, не подглядывая в текст, базовая фонетика кыргызского у вас уже есть. Дальше слушайте живые фразы с озвучкой носителя и повторяйте каждый день по пятнадцать минут.",
     "en": "If you managed that without looking at the text, you already have the basic phonetics of Kyrgyz. From here on, listen to real phrases with native audio and repeat for fifteen minutes a day.",
     "tr": "Metne bakmadan başardıysanız Kırgızcanın temel sesletimi sizde var demektir. Bundan sonra ana dili sesiyle gerçek cümleleri dinleyin ve günde on beş dakika tekrar edin."
    },
    "gap": true
   }
  ]
 }
};
/* ===/LESSONS=== */
