/* ===STT-BLOCKS=== Реестр блоков аудирования. Блок = запись здесь: kind "queue" —
   фразы дня по SRS-очереди (пул растёт сам вместе с модулями варианта ученика),
   kind "sounds" — направленный дрилл со своим списком items. Запись item:
   ch — подпись чипа, m — подстроки поиска фраз в словаре модуля, m2 — второй
   набор (у гласных — долгая пара, у окончаний — вежливая или оглушённая форма)
   со своей подсказкой hint (ключ словаря), not — точные фразы-исключения
   (иначе дрилл окончания -сыз начинается с местоимения «сиз»), label — заголовок
   карточки, если ряд букв не сводится к одной, track — тема урока модуля, где
   это объяснено с источниками. Необязательные поля блока: mods — модули, где он
   показан (нет поля = везде), intro/words — свои ключи подписей вместо звуковых.
   Новый блок = новая запись с items + титул stt_b_<id> и подписи в словарях,
   ноль правок логики (рендерер kind "sounds" общий и слова «долгий» не знает).
   Описания пересказывают уроки: гласные — урок произношения
   (deploy/pronunciation-script.json), окончания — урок модуля M1
   (deploy/lesson-m1-script.json, треки m1t2–m1t4); утверждения с источниками —
   в refs там же, поле track держит связь. Ориентиры каждого языка — свои,
   по канону «Ориентир берётся из языка дорожки».
   Модули со вкладкой аудирования — STT_MODS: раздел открывается там, где есть
   свой материал (m0 — звуки алфавита, m1 — окончания сказуемости), а не везде
   подряд; следующий модуль = ещё одна строка списка. */
const STT_MODS=["m0","m1"];
const STT_VOWELS=[
 {ch:"а",m:["а"],m2:["аа"],hint:"stt_v_long",snd:"ph_snd_a",snd2:"ph_snd_aa",
  d:"Как русское «а». Никогда не глотается: широкие гласные в кыргызском звучат отчётливо в каждом слоге, даже без ударения.",
  dEn:"Like the a in “father”. It is never swallowed: broad vowels in Kyrgyz stay clear in every syllable, stressed or not.",
  dTr:"Türkçedeki «a» gibi. Asla yutulmaz: Kırgızcada geniş ünlüler vurgusuz hecede bile net söylenir."},
 {ch:"о",m:["о"],m2:["оо"],hint:"stt_v_long",snd:"ph_snd_o",snd2:"ph_snd_oo",
  d:"Всегда чистое «о», как под ударением; привычного русского «аканья» нет — каждое «о» звучит отчётливо.",
  dEn:"A clear rounded o, as in “more”; it is never weakened towards “a” — every o keeps its sound.",
  dTr:"Türkçedeki «o» gibi net ve yuvarlak; hiçbir zaman «a»ya kaymaz — her «o» sesini korur."},
 {ch:"у",m:["у"],m2:["уу"],hint:"stt_v_long",snd:"ph_snd_u",snd2:"ph_snd_uu",
  d:"Как русское «у»: губы трубочкой. В безударном слоге узкие гласные звучат короче.",
  dEn:"Like the oo in “moon”, lips rounded. In unstressed syllables narrow vowels get short.",
  dTr:"Türkçedeki «u» gibi, dudaklar yuvarlak. Vurgusuz hecede kısa söylenir."},
 {ch:"ы",m:["ы"],snd:"ph_snd_y",  d:"Похоже на русское «ы», но глубже: работает задняя часть языка, губы нейтральны.",
  dEn:"Say oo as in “moon”, then relax and unround your lips — the sound sits far back in the mouth.",
  dTr:"Türkçedeki «ı» gibi: dil geride, dudaklar düz."},
 {ch:"э",m:["э","е"],m2:["ээ"],hint:"stt_v_long",snd:"ph_snd_e",snd2:"ph_snd_ee",
  d:"Как «э» в слове «это». Внутри слова этот звук пишется буквой «е».",
  dEn:"Like the e in “bed”. Inside a word this sound is written with the letter «е».",
  dTr:"Türkçedeki «e» gibi. Kelime içinde «е» harfiyle yazılır."},
 {ch:"ө",m:["ө"],m2:["өө"],hint:"stt_v_long",snd:"ph_snd_oe",snd2:"ph_snd_ooe",
  d:"Скажите «э», задержите — и, не двигая язык, вытяните губы трубочкой, как для «о».",
  dEn:"Say e as in “bed”, hold it, and round your lips as for “o” — the tongue does not move.",
  dTr:"Türkçedeki «ö» ile aynı ses."},
 {ch:"ү",m:["ү"],m2:["үү"],hint:"stt_v_long",snd:"ph_snd_ue",snd2:"ph_snd_uue",
  d:"Тяните «и» и округлите губы, как для «у», — язык не двигается, меняются только губы.",
  dEn:"Say ee as in “see” and round your lips as for “oo” — only the lips change.",
  dTr:"Türkçedeki «ü» ile aynı ses."},
 {ch:"и",m:["и"],snd:"ph_snd_i",  d:"Как русское «и»; в безударном слоге звучит коротко, почти проглатывается.",
  dEn:"Like the ee in “see”, but short; in unstressed syllables it nearly disappears.",
  dTr:"Türkçedeki «i» gibi; vurgusuz hecede çok kısa söylenir."}
];
/* Согласные, где привычка чужого языка мешает: аффриката ж, велярный носовой ң,
   два аллофона к и г (в жоон-словах глубже, у язычка) и дрожащая р. Всё это —
   темы урока произношения (p5 «Согласные», ң — p1 «Три особых звука»), там же
   источники в refs. Слова подбираются подстрокой: у к и г второй набор (m2) —
   ичке-слова, где тот же звук звучит обычно, поэтому пара слышна рядом. */
const STT_CONSONANTS=[
 {ch:"ж",track:"p5",m:["ж"],snd:"ph_snd_zh",
  d:"Слитное «дж», как в слове «джем»: звук начинается смычкой, а не шипением. «Жакшы» звучит как «джакшы».",
  dEn:"The affricate j of “jam”: it starts with a stop, not with the soft buzz of “measure”. «Жакшы» sounds like “jakshy”.",
  dTr:"Türkçedeki «c» sesi (cam): sürtünmeli «j» değil, patlamalı bir başlangıçla söylenir. «Жакшы» → «cakşı»."},
 {ch:"ң",track:"p1",m:["ң"],snd:"ph_snd_ng",
  d:"Носовой звук у мягкого нёба: язык не касается зубов, воздух идёт через нос. Это не «н» и не «н» с «г» — один звук: «таң», «миң».",
  dEn:"A nasal made at the soft palate: the tongue never touches the teeth and the air goes through the nose. One sound, like the ng in “sing”: «таң», «миң».",
  dTr:"Damakta oluşan genizsi ses: dil dişlere değmez, hava burundan çıkar. «n» artı «g» değil, tek sestir — «denk» derken duyulan n gibi: «таң», «миң»."},
 {ch:"к",label:"К к",track:"p5",m:["ка","кы","ко","ку"],snd:"ph_snd_k",m2:["ки","ке","кү","кө"],hint:"stt_c_soft",
  d:"В твёрдых словах «к» уходит глубже в горло, к язычку: «кыз», «кол». В мягких словах это обычная «к»: «китеп», «Ким?».",
  dEn:"In back-vowel words к is made deep in the throat, near the uvula: «кыз», «кол». In front-vowel words it is the ordinary k: «китеп», «Ким?».",
  dTr:"Kalın ünlülü kelimelerde к küçük dile yakın, geriden çıkar: «кыз», «кол». İnce ünlülü kelimelerde olağan k'dır: «китеп», «Ким?»."},
 {ch:"г",label:"Г г",track:"p5",m:["га","гы","го","гу"],snd:"ph_snd_g",m2:["ги","ге","гү","гө"],hint:"stt_c_soft",
  d:"У «г» та же пара: в твёрдых словах звук рождается глубоко, у язычка («кагаз», «мугалим»), в мягких — обычная «г» («Сизге рахмат!»).",
  dEn:"г works the same way: in back-vowel words it is made deep, near the uvula («кагаз», «мугалим»), in front-vowel words it is the ordinary g («Сизге рахмат!»).",
  dTr:"г için de aynı ikili geçerli: kalın ünlülü kelimelerde ses geriden, küçük dile yakın çıkar («кагаз», «мугалим»), ince ünlülülerde olağan g'dir («Сизге рахмат!»)."},
 {ch:"р",track:"p5",m:["р"],snd:"ph_snd_r",
  d:"Раскатистая «р»: кончик языка дрожит у бугорков за зубами. Её не глотают даже в конце слова — «Рахмат!», «дептер».",
  dEn:"A rolled r: the tip of the tongue trills against the ridge behind the teeth. It is never swallowed, not even word-finally — «Рахмат!», «дептер».",
  dTr:"Çarpmalı r: dilin ucu diş etinde titrer. Kelime sonunda bile yutulmaz — «Рахмат!», «дептер»."}
];
/* Окончания сказуемости и вопросительная частица — главная грамматика M1: её и
   тренируем вслух, потому что гласный окончания подбирает гармония, а «б» после
   глухого оглушается — на письме это видно, а в речи ученик проговаривает мимо. */
const STT_ENDINGS=[
 {ch:"-мын",label:"-мын · -мин · -мун · -мүн",track:"m1t2",m:["мын","мин","мун","мүн"],
  d:"Связки «есть» в кыргызском нет: «я врач» — это само слово «врач» с личным окончанием. Гласный в окончании подбирает гармония, поэтому вариантов четыре: -мын, -мин, -мун, -мүн.",
  dEn:"There is no verb “to be” here: “I am a doctor” is the noun itself plus a personal ending. Vowel harmony picks its vowel, so the ending comes in four shapes: -мын, -мин, -мун, -мүн.",
  dTr:"Burada «olmak» fiili yoktur: «ben doktorum» sözcüğün kişi eki almasıyla kurulur. Ünlü uyumu gereği ekin dört biçimi vardır: -мын, -мин, -мун, -мүн."},
 {ch:"-сың",label:"-сың · -сиң · -сыз · -сиз",track:"m1t2",m:["сың","сиң","суң","сүң"],
  m2:["сыз","сиз","суз","сүз"],hint:"stt_e_pol",not:["сиз","сиздер","сиздин","сизчи?"],
  d:"У «ты» окончание -сың/-сиң/-суң/-сүң, у вежливого «Вы» — -сыз/-сиз/-суз/-сүз. Конечный «ң» произносится носом, одним звуком, а не «н» плюс «г».",
  dEn:"Informal “you” takes -сың/-сиң/-суң/-сүң, polite “you” takes -сыз/-сиз/-суз/-сүз. The final ң is one nasal sound made at the back of the mouth, not n followed by g.",
  dTr:"Senli hitapta ek -сың/-сиң/-суң/-сүң, nazik hitapta -сыз/-сиз/-суз/-сүз olur. Sondaki ң tek bir genizsi sestir, «n» ve «g» arka arkaya değildir."},
 {ch:"-быз",label:"-быз · -биз · -буз · -бүз",track:"m1t2",m:["быз","биз","буз","бүз"],not:["биз"],
  d:"Множественность несёт само окончание: «Биз кыргызбыз» — «мы кыргызы», отдельного слова для множественного числа не нужно.",
  dEn:"The ending alone carries the plural: “Биз кыргызбыз” means “we are Kyrgyz” — no separate plural word is needed.",
  dTr:"Çokluğu ekin kendisi taşır: «Биз кыргызбыз» — «biz Kırgız'ız»; ayrı bir çokluk sözcüğü gerekmez."},
 {ch:"-бы?",label:"-бы? · -би? · -пы? · -пи?",track:"m1t3",m:["бы?","би?","бу?","бү?"],
  m2:["пы?","пи?","пу?","пү?"],hint:"stt_e_dev",
  d:"Вопрос «да или нет» не меняет порядок слов: к сказуемому добавляется частица -бы/-би/-бу/-бү. Голосом ведите вверх на самой частице — она в конце фразы.",
  dEn:"A yes-or-no question keeps the word order and simply adds the particle -бы/-би/-бу/-бү to the predicate. Let your pitch rise on the particle itself — it sits at the very end.",
  dTr:"Evet-hayır sorusunda söz dizimi değişmez: yükleme -бы/-би/-бу/-бү eki eklenir. Sesinizi tam sondaki bu ekte yukarı kaldırın."},
 {ch:"эмес",track:"m1t4",m:["эмес"],
  d:"Отрицание при имени — отдельное слово «эмес» после сказуемого, и личное окончание переезжает на него: «Мен мугалим эмесмин».",
  dEn:"Noun negation is a separate word, эмес, standing after the predicate, and the personal ending moves onto it: “Мен мугалим эмесмин”.",
  dTr:"Ad cümlesinde olumsuzluk, yüklemden sonra gelen ayrı bir sözcükle kurulur: эмес; kişi eki de bu sözcüğe geçer: «Мен мугалим эмесмин»."}
];
const STT_BLOCKS=[
 {id:"phrases",kind:"queue"},
 {id:"vowels",kind:"sounds",items:STT_VOWELS},
 {id:"consonants",kind:"sounds",items:STT_CONSONANTS},
 {id:"endings",kind:"sounds",items:STT_ENDINGS,mods:["m1"],intro:"stt_e_intro",words:"stt_e_words"}
];
/* ===/STT-BLOCKS=== */
