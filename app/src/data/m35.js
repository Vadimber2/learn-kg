
/* ---------- М35 «Экзаменационная неделя B1» (зеркало М23/М11): только повторение ----
   exam:true в MODULE_META (мок-карточка строится по флагу). Новых слов нет:
   фразы-ответы и вопросы B1 — ref-ами, дриллы — экзаменационные форматы
   курса B1 (пересказ -ыптыр = Сүйлөө зад.1, кыйыр кеп, клоуз). */
const CATS_M35 = {
  frazy:"Ответы-шаблоны экзамена B1 (повторение)", suroo:"Вопросы экзамена B1 (повторение)"
};
const VOCAB_M35 = [
 {ref:"m29_45",cat:"frazy"},
 {ref:"m29_79",cat:"frazy"},
 {ref:"m30_54",cat:"frazy"},
 {ref:"m30_58",cat:"frazy"},
 {ref:"m31_52",cat:"frazy"},
 {ref:"m31_84",cat:"frazy"},
 {ref:"m32_57",cat:"frazy"},
 {ref:"m32_60",cat:"frazy"},
 {ref:"m33_49",cat:"frazy"},
 {ref:"m33_53",cat:"frazy"},
 {ref:"m24_73",cat:"suroo"},
 {ref:"m25_55",cat:"suroo"},
 {ref:"m26_39",cat:"suroo"},
 {ref:"m27_44",cat:"suroo"},
 {ref:"m28_37",cat:"suroo"},
 {ref:"m29_43",cat:"suroo"},
 {ref:"m30_51",cat:"suroo"},
 {ref:"m31_49",cat:"suroo"},
 {ref:"m32_54",cat:"suroo"},
 {ref:"m33_45",cat:"suroo"}
];
const DRILL_M35 = [
 {g:"suiloo1",qKy:"Угуп алып, кайра айтып бер: «Асан келди» дегенди укканыңды кантип айтасың?",q:"Пересказ услышанного (Сүйлөө, 1-тапшырма): как передать «Асан пришёл»?",qEn:"Retelling (Speaking, task 1): how do you report “Асан came”?",qTr:"Duyduğunu aktarma: “Асан келди”yi nasıl aktarırsın?",noteEn:"келиптир",noteTr:"келиптир",opts:["Асан келет","Асан келсин","Асан келиптир","Асан келбейт"],c:2,note:"пересказ — капыскы өткөн -ыптыр (разбор — страница «Экзамен»)"},
 {g:"suiloo1",qKy:"«Жайлоо кооз экен» дегенди кыйыр кепке кой: «Ал жайлоо кооз экен … айтты».",q:"Передай косвенно: «Он сказал, что джайлоо красивое».",qEn:"Report it: “He said the jailoo was beautiful”.",qTr:"Dolaylı aktar: “Yayla güzelmiş dedi”.",noteEn:"деп",noteTr:"деп",opts:["деп","да","го","же"],c:0,note:"кыйыр кеп (М30): цитата не меняется"},
 {g:"suiloo1",qKy:"«Качан келесиң?» деген суроону кыйыр кепке кой.",q:"Передай вопрос косвенно.",qEn:"Report the question indirectly.",qTr:"Soruyu dolaylı aktar.",noteEn:"деп сурады",noteTr:"деп сурады",opts:["Качан келет деп сурады","Качан келесиң деп сурады","Качан келсин деди","Качан деп айтты"],c:1,note:"суроо + деп сурады (М30)"},
 {g:"suiloo1",qKy:"Монологду (Сүйлөө, 2-тапшырма) эмне менен баштоо туура?",q:"Начало монолога (Сүйлөө, задание 2): каким предложением открыть тему?",qEn:"Opening the monologue: which sentence opens the topic?",qTr:"Monoloğa başlama: konuyu hangi cümle açar?",noteEn:"негизги сүйлөм",noteTr:"негизги сүйлөм",opts:["Санап чыгуу менен","Суроо менен гана","Макал менен гана","Теманын негизги сүйлөмү менен"],c:3,note:"Сүйлөө — 2–3 мүнөт, Жазуу — 12–15 сүйлөм: башкы ой → мисалдар → жыйынтык"},
 {g:"kloz3",qKy:"«Досум тез сакай… экен» — толукта (пожелание).",q:"«Поскорее бы друг выздоровел» — вставь.",qEn:"“If only my friend would recover” — fill in.",qTr:"“Keşke dostum iyileşse” — yerleştir.",noteEn:"-са",noteTr:"-са",opts:["-ганда","-ганы","-майынча","-са"],c:3,note:"тилек -са экен (М33)"},
 {g:"kloz3",qKy:"«Эл Соң-Көлдү көр… барат» — толукта (цель).",q:"«Люди едут посмотреть Сон-Куль» — вставь.",qEn:"“People go to see Son-Kul” — fill in.",qTr:"“İnsanlar Son Göl’ü görmeye gider” — yerleştir.",noteEn:"-гөнү",noteTr:"-гөнү",opts:["-гөндө","-гөнчө","-гөнү","-сө"],c:2,note:"максат -ганы (М32)"},
 {g:"kloz3",qKy:"«Театрга бара …» — толукта (мы ещё не).",q:"«Мы ещё не ходили в театр» — вставь.",qEn:"“We have not been to the theatre yet” — fill in.",qTr:"“Henüz tiyatroya gitmedik” — yerleştir.",noteEn:"элекпиз",noteTr:"элекпиз",opts:["элекпиз","жокпуз","албайбыз","бербейбиз"],c:0,note:"-а элек (М31)"},
 {g:"kloz3",qKy:"«Таштанды күн сайын чыгар…» — толукта (вывозится).",q:"«Мусор вывозится каждый день» — вставь.",qEn:"“The rubbish is taken out daily” — fill in.",qTr:"“Çöp her gün çıkarılır” — yerleştir.",noteEn:"-ылат",noteTr:"-ылат",opts:["-ат","-ылат","-тат","-ышат"],c:1,note:"пассив -ыл (М30)"},
 {g:"kloz3",qKy:"«Балдарга бөлмөсүн жыйна…» — толукта (поручаем).",q:"«Поручаем детям убирать комнату» — вставь.",qEn:"“We have the children tidy the room” — fill in.",qTr:"“Çocuklara odayı toplatırız” — yerleştir.",noteEn:"-табыз",noteTr:"-табыз",opts:["-йбыз","-лабыз","-табыз","-шабыз"],c:2,note:"понудительный -т (М29)"},
 {g:"kloz3",qKy:"«Тил бил…, чет өлкөдө кыйын» — толукта (пока не).",q:"«Пока не знаешь языка, за границей трудно» — вставь.",qEn:"“Until you know the language, it is hard abroad” — fill in.",qTr:"“Dili bilmedikçe yurt dışında zor” — yerleştir.",noteEn:"-мейинче",noteTr:"-мейинче",opts:["-генде","-мейинче","-гени","-се"],c:1,note:"-майынча (М28)"},
 {g:"suiloo2",qKy:"«Ден соолук — зор байлык» темасын ачканда эмнени айтуу керек?",q:"Что раскрыть в теме «Здоровье — большое богатство»?",qEn:"What should the health topic cover?",qTr:"Sağlık konusunda ne anlatılmalı?",noteEn:"адаттар + кеңеш",noteTr:"адаттар + кеңеш",opts:["Кино тизмеси","Пайдалуу адаттар жана кеңештер","Шаар планы","Оюн эрежелери"],c:1,note:"М27: адаттар, кыймыл, туура тамактануу"},
 {g:"suiloo2",qKy:"«Менин өлкөм» темасында кайсы факт туура?",q:"Какой факт верен для темы «Моя страна»?",qEn:"Which fact fits the “My country” topic?",qTr:"“Ülkem” konusu için hangi bilgi doğru?",noteEn:"Ысык-Көл",noteTr:"Ысык-Көл",opts:["Бишкек — айыл","Ысык-Көл кышында тоңбойт","Тоолор аз","Калк үч миң"],c:1,note:"М32: факты страноведения"},
 {g:"suiloo2",qKy:"«Достук деген эмне?» темасына кайсы макал жарайт?",q:"Какая пословица подходит теме о дружбе?",qEn:"Which proverb fits the friendship topic?",qTr:"Dostluk konusuna hangi atasözü uyar?",noteEn:"Дос балаада билинер",noteTr:"Дос балаада билинер",opts:["Жери байдын — эли бай","Өнөр алды — кызыл тил","Ырыс алды — ынтымак","Дос балаада билинер, баатыр талаада билинер"],c:3,note:"М33: макал к теме"},
 {g:"suiloo2",qKy:"Жазуу бөлүмүндө канча сүйлөм талап кылынат?",q:"Сколько предложений требует «Жазуу»?",qEn:"How many sentences does the writing part require?",qTr:"Yazma bölümü kaç cümle ister?",noteEn:"12–15",noteTr:"12–15",opts:["3–5","5–8","12–15","30–40"],c:2,note:"«12-15 сүйлөмдүн чегинде» — официальное требование"},
 {g:"suiloo2",qKy:"Сүйлөшүүдө пикириңди кантип сылык айтасың?",q:"Как вежливо выразить мнение в беседе?",qEn:"How do you politely give an opinion?",qTr:"Görüşünü nasıl kibarca söylersin?",noteEn:"Менин оюмча…",noteTr:"Менин оюмча…",opts:["Сен билбейсиң!","Мага баары бир","Менин оюмча, …","Айтпайм"],c:2,note:"М25: Менин оюмча / деп эсептейм"},
 {g:"suiloo2",qKy:"Экзамен алдында эң туура даярдык кайсы?",q:"Какова лучшая подготовка накануне экзамена?",qEn:"What is the best preparation before the exam?",qTr:"Sınavdan önce en iyi hazırlık nedir?",noteEn:"уйку",noteTr:"уйку",opts:["Эрте жатып, жакшы уктоо","Түнү бою окуу","Эч нерсе кылбоо","Экзаменди калтыруу"],c:0,note:"уйку — эң жакшы даярдык (М23 да ушуну айткан)"}
];
