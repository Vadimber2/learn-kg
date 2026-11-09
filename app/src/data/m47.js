
/* ---------- М47 «Экзаменационная неделя B2» (зеркало М35/М23/М11): только повторение ---
   exam:true в MODULE_META (мок-карточка строится по флагу; общая инфраструктура —
   «Как готовиться»/«Тренажёр формата»/«Пробный экзамен» — как у М35). Новых слов нет:
   фразы-ответы и вопросы B2 — ref-ами (ids проверены по m36..m45.js, отличны от М46,
   чтобы не дублировать SRS-карточки), дриллы — форматы итоговой проверки курса B2:
   пересказ (Сүйлөө 1-тапшырма), аргумент, официальное письмо (15–18 сүйлөм), макала,
   интенции «баа берүү» (моралдык/укуктук/рационалдуу/эмоциялык). */
const CATS_M47 = {
  frazy:"Ответы-шаблоны экзамена B2 (повторение)", suroo:"Вопросы экзамена B2 (повторение)"
};
const VOCAB_M47 = [
 {ref:"m36_73",cat:"frazy"},
 {ref:"m37_66",cat:"frazy"},
 {ref:"m38_57",cat:"frazy"},
 {ref:"m39_58",cat:"frazy"},
 {ref:"m40_57",cat:"frazy"},
 {ref:"m41_72",cat:"frazy"},
 {ref:"m42_79",cat:"frazy"},
 {ref:"m43_58",cat:"frazy"},
 {ref:"m44_76",cat:"frazy"},
 {ref:"m45_77",cat:"frazy"},
 {ref:"m36_67",cat:"suroo"},
 {ref:"m37_59",cat:"suroo"},
 {ref:"m38_64",cat:"suroo"},
 {ref:"m39_64",cat:"suroo"},
 {ref:"m40_61",cat:"suroo"},
 {ref:"m41_67",cat:"suroo"},
 {ref:"m42_71",cat:"suroo"},
 {ref:"m43_54",cat:"suroo"},
 {ref:"m44_68",cat:"suroo"},
 {ref:"m45_73",cat:"suroo"}
];
const DRILL_M47 = [
 {g:"suiloo1",qKy:"Угуп алып кайра айт: «Министрлик жаңы эрежени киргизди» дегенди укканыңды кантип айтасың?",q:"Пересказ услышанного (Сүйлөө, задание 1): как передать «Министерство ввело новое правило»?",qEn:"Retelling (Speaking, task 1): how do you report “the ministry has introduced a new rule”?",qTr:"Duyduğunu aktarma: “Bakanlık yeni kural getirdi”yi nasıl aktarırsın?",noteEn:"киргизиптир",noteTr:"getirmiş",opts:["киргизет","киргизсин","киргизиптир","киргизбептир"],c:2,note:"И на B2 при пересказе услышанного используется -ыптыр: то, что узнал понаслышке, передаёшь в форме «оказывается» (Сүйлөө, задание 1)"},
 {g:"suiloo1",qKy:"«Комиссия арызды карап чыкты» дегенди расмий кабар түрүндө айт: «Комиссия арызды карап чыкты … .»",q:"Передай официально: «Комиссия сообщила, что рассмотрела заявление».",qEn:"Report it formally: “The commission stated that it had reviewed the application”.",qTr:"Resmî aktar: “Komisyon dilekçeyi incelediğini bildirdi”.",noteEn:"деп билдирди",noteTr:"bildirdi",opts:["деп сурады","деп билдирди","дешет","деп жатышат"],c:1,note:"официальное сообщение: … деп билдирди/маалымдады (М45, формат экзамена)"},
 {g:"suiloo1",qKy:"Кайра айтып бергенде өз көзүң менен көргөндү кантип айтасың (уккан эмес)?",q:"Как передать то, что видел сам (не с чужих слов)?",qEn:"How do you report what you saw yourself (not hearsay)?",qTr:"Kendi gördüğünü nasıl aktarırsın (duyduğunu değil)?",noteEn:"-ды/-ган",noteTr:"-dı/-ган",opts:["-ыптыр","-са экен","-гыдай","-ды/-ган"],c:3,note:"то, что видел сам, — обычное прошедшее время; то, что слышал с чужих слов, — заглазное -ыптыр"},
 {g:"argument",qKy:"«Мен … менен макул эмесмин, анткени …» — бул кайсы тапшырмага таандык?",q:"«Я не согласен с …, потому что …» — к какому заданию относится этот шаблон?",qEn:"“I disagree with …, because …” — which task does this template belong to?",qTr:"“… ile aynı fikirde değilim, çünkü …” — bu kalıp hangi göreve ait?",noteEn:"argument",noteTr:"argüman",opts:["өмүр баян жазуу","расмий кат жазуу","талаш маселени аргумент менен чечүү","маалымдама берүү"],c:2,note:"Сүйлөө: доступный аргумент при решении спорных вопросов"},
 {g:"argument",qKy:"«Биринчиден, … Экинчиден, … Демек, …» — бул эмнени түзөт?",q:"«Во-первых, … Во-вторых, … Следовательно, …» — что это выстраивает?",qEn:"“Firstly, … Secondly, … Therefore, …” — what does this build?",qTr:"“Birincisi, … İkincisi, … Dolayısıyla, …” — bu neyi kurar?",noteEn:"skeleton",noteTr:"iskelet",opts:["өмүр баяндын түзүлүшү","аргументтин түзүлүшү","макалдын мааниси","суроонун түзүлүшү"],c:1,note:"аргумент: тезис → доказательства → заключение (указание причины — ядро интенции B2)"},
 {g:"argument",qKy:"«Бул чечим натыйжалуу эмес, … көп убакыт талап кылат.» — толукта (потому что).",q:"«Это решение неэффективно, потому что требует много времени» — вставь.",qEn:"“This decision is not effective, because it takes a lot of time” — fill in.",qTr:"“Bu karar etkili değil, çünkü çok zaman alır” — yerleştir.",noteEn:"себеби",noteTr:"çünkü",opts:["бирок","андан кийин","мисалы","себеби"],c:3,note:"причинный союз в аргументе: себеби/анткени/ошондуктан"},
 {g:"kat",qKy:"Расмий каттын биринчи бөлүгү эмнени көрсөтөт?",q:"Что показывает первая часть официального письма?",qEn:"What does the first part of an official letter show?",qTr:"Resmî mektubun ilk bölümü neyi gösterir?",noteEn:"from whom, to whom",noteTr:"kimden kime",opts:["корутунду","кимден, кимге","макал-лакап","аргумент"],c:1,note:"структура официального письма: вступление → основная → заключительная часть (М36)"},
 {g:"kat",qKy:"Жазуу B2 канча сүйлөм талап кылат?",q:"Сколько предложений требует «Жазуу» на B2?",qEn:"How many sentences does B2 Writing require?",qTr:"B2 Yazma bölümü kaç cümle ister?",noteEn:"15–18",noteTr:"15–18",opts:["12–15","15–18","5–8","20–25"],c:1,note:"15–18 предложений — объём письма B2 в нашем курсе (на B1 — 12–15)"},
 {g:"kat",qKy:"Каттын эң аягында, кол тамгадан мурун, эмне жазылат?",q:"Что пишут в самом конце письма, перед подписью?",qEn:"What is written at the very end of the letter, before the signature?",qTr:"Mektubun en sonunda, imzadan önce ne yazılır?",noteEn:"сый-урмат менен",noteTr:"saygılarımla",opts:["урматтуу мекеме кызматкерлери","маселенин баяны","сый-урмат менен","кимден, кимге"],c:2,note:"«сый-урмат менен» — в самом конце письма, перед подписью (М36)"},
 {g:"makala",qKy:"Макаланын биринчи бөлүгү эмне болот?",q:"Что открывает статью?",qEn:"What opens an article?",qTr:"Makaleyi ne açar?",noteEn:"introduction",noteTr:"giriş",opts:["корутунду","негизги ой","кол тамга","кириш сөз"],c:3,note:"структура статьи: вступление → основная мысль → заключение (М45)"},
 {g:"makala",qKy:"Жыйынга (отурумга) расмий кайрылуу кантип башталат?",q:"Как начинают официальное обращение к собранию?",qEn:"How does a formal address to an assembly begin?",qTr:"Bir toplantıya resmî hitap nasıl başlar?",noteEn:"dear participants",noteTr:"sayın katılımcılar",opts:["Салам, кандайсыңар?","Урматтуу катышуучулар!","Эй, угуп тургула!","Кел, баштайлы"],c:1,note:"официальное обращение открывает собрание — в зависимости от роли обращающегося (М45, интенция «установление контакта»)"},
 {g:"baa",qKy:"«Бул иш-аракетти колдойм, анткени ал адептүү» — кайсы баа берүү түрү?",q:"«Поддерживаю этот поступок, потому что он нравственный» — какой вид оценки?",qEn:"“I support this act because it is decent” — which kind of evaluation?",qTr:"“Bu davranışı destekliyorum, çünkü ahlaklı” — hangi değerlendirme türü?",noteEn:"moral evaluation",noteTr:"ahlaki değerlendirme",opts:["моралдык-адептик баа","социалдык-укуктук баа","рационалдуу баа","эмоционалдык баа"],c:0,note:"морально-этическая оценка: поддержка/похвала/порицание/обвинение"},
 {g:"baa",qKy:"«Бул чечим натыйжалуу, себеби стандартка дал келет» — кайсы баа?",q:"«Это решение эффективно, так как соответствует стандарту» — какая оценка?",qEn:"“This decision is effective because it matches the standard” — which evaluation?",qTr:"“Bu karar etkilidir, çünkü standarda uyar” — hangi değerlendirme?",noteEn:"rational evaluation",noteTr:"rasyonel değerlendirme",opts:["эмоционалдык баа","моралдык-адептик баа","социалдык-укуктук баа","рационалдуу баа"],c:3,note:"рациональная оценка: сравнение со стандартом/нормой, оценка эффективности"},
 {g:"baa",qKy:"«Мен бул жаңылыкка суктанам» — кайсы баа?",q:"«Я восхищаюсь этой новостью» — какая оценка?",qEn:"“I admire this news” — which evaluation?",qTr:"“Bu habere hayranım” — hangi değerlendirme?",noteEn:"emotional evaluation",noteTr:"duygusal değerlendirme",opts:["социалдык-укуктук баа","эмоционалдык баа","рационалдуу баа","моралдык-адептик баа"],c:1,note:"эмоциональная оценка: восхищение/удивление/интерес/раздражение и т.п. (требования B2)"},
 {g:"baa",qKy:"«Ал өз ишин коргой алды, анткени мыйзамга ылайык иштеген» — кайсы баа?",q:"«Он смог защитить своё дело, так как действовал по закону» — какая оценка?",qEn:"“He could defend his case because he acted according to the law” — which evaluation?",qTr:"“İşini savunabildi, çünkü kanuna uygun çalıştı” — hangi değerlendirme?",noteEn:"social-legal evaluation",noteTr:"sosyal-hukuki değerlendirme",opts:["моралдык-адептик баа","рационалдуу баа","социалдык-укуктук баа","эмоционалдык баа"],c:2,note:"социально-правовая оценка: оправдание/защита/обвинение"}
];
