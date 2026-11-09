
/* ---------- М34 «Повторение B1» (зеркало М22/М10): только повторение ----------
   Новых слов нет (гейт REVISION_MODS в content.test.js): фразы и вопросы всех
   модулей B1 — ref-ами, дриллы — сводка грамматики m24–m33 с qKy (канон B1). */
const CATS_M34 = {
  frazy:"Ключевые фразы B1 (повторение)", suroo:"Вопросы всех модулей B1 (повторение)"
};
const VOCAB_M34 = [
 {ref:"m24_01",cat:"frazy"},
 {ref:"m25_17",cat:"frazy"},
 {ref:"m26_08",cat:"frazy"},
 {ref:"m27_05",cat:"frazy"},
 {ref:"m28_02",cat:"frazy"},
 {ref:"m29_03",cat:"frazy"},
 {ref:"m30_24",cat:"frazy"},
 {ref:"m31_77",cat:"frazy"},
 {ref:"m32_33",cat:"frazy"},
 {ref:"m33_20",cat:"frazy"},
 {ref:"m24_72",cat:"suroo"},
 {ref:"m25_54",cat:"suroo"},
 {ref:"m26_38",cat:"suroo"},
 {ref:"m27_43",cat:"suroo"},
 {ref:"m28_36",cat:"suroo"},
 {ref:"m29_40",cat:"suroo"},
 {ref:"m30_47",cat:"suroo"},
 {ref:"m31_45",cat:"suroo"},
 {ref:"m32_51",cat:"suroo"},
 {ref:"m33_44",cat:"suroo"}
];
const DRILL_M34 = [
 {g:"chak",qKy:"«Ал Бишкекке көчүп кет…» (оказывается — пересказ).",q:"«Он, оказывается, переехал в Бишкек».",qEn:"“He has moved to Bishkek, it turns out”.",qTr:"“Bişkek’e taşınmış meğer”.",noteEn:"-иптир",noteTr:"-иптир",opts:["-иптир","-кен","-ет","-мек"],c:0,note:"капыскы өткөн -ыптыр — экзаменационная форма пересказа (разбор — М35)"},
 {g:"chak",qKy:"«Бала кезде айылда жаша…» (бывало — М12).",q:"«В детстве, бывало, жил в селе».",qEn:"“As a child I used to live in a village”.",qTr:"“Çocukken köyde yaşardım”.",noteEn:"-чумун",noteTr:"-чумун",opts:["-ганмын","-йм","-птырмын","-чумун"],c:3,note:"адат өткөн -чу (М12)"},
 {g:"chak",qKy:"«Мен кыргызча сүйлөй …» (умею — М25).",q:"«Я умею говорить по-кыргызски».",qEn:"“I can speak Kyrgyz”.",qTr:"“Kırgızca konuşabilirim”.",noteEn:"алам",noteTr:"алам",opts:["алам","берем","көрөм","болом"],c:0,note:"-а алуу (М25): умение"},
 {g:"chak",qKy:"«Шаар айыл… караганда чоң» (по сравнению — М25).",q:"«Город больше по сравнению с селом».",qEn:"“The city is bigger compared to the village”.",qTr:"“Şehir köye göre büyüktür”.",noteEn:"-га",noteTr:"-га",opts:["-дан","-га","-да","-дын"],c:1,note:"-га караганда (М25)"},
 {g:"chak",qKy:"«Жайында көлгө бар…» (собираюсь — М26).",q:"«Летом собираюсь поехать на озеро».",qEn:"“In summer I intend to go to the lake”.",qTr:"“Yazın göle gitmeyi düşünüyorum”.",noteEn:"-макчымын",noteTr:"-макчымын",opts:["-дым","-чумун","-сам","-макчымын"],c:3,note:"ниет -макчы (М26)"},
 {g:"chak",qKy:"«Эртең жамгыр жаа…» (наверное пойдёт — М26).",q:"«Завтра, наверное, будет дождь».",qEn:"“It will probably rain tomorrow”.",qTr:"“Yarın muhtemelen yağmur yağar”.",noteEn:"-ар",noteTr:"-ар",opts:["-ды","-ган","-ар","-птыр"],c:2,note:"арсар келер -ар (М26)"},
 {g:"baylanysh",qKy:"«Эгер убактым бол…, келем» (если — М27).",q:"«Если будет время, приду».",qEn:"“If I have time, I will come”.",qTr:"“Vaktim olursa gelirim”.",noteEn:"-со",noteTr:"-со",opts:["-гондо","-со","-гону","-майынча"],c:1,note:"шарт -са (М27)"},
 {g:"baylanysh",qKy:"«Тил үйрөн…, көнүгүү керек» (пока не — М28).",q:"«Пока не выучишь язык, нужна практика».",qEn:"“Until you learn the language, you need practice”.",qTr:"“Dili öğrenmedikçe alıştırma gerek”.",noteEn:"-мөйүнчө",noteTr:"-мөйүнчө",opts:["-гөнгө","-гөндө","-мөйүнчө","-гөнү"],c:2,note:"-майынча (М28): пока не"},
 {g:"baylanysh",qKy:"«Апам иниме бөлмө жыйна…» (поручила — М29).",q:"«Мама поручила брату убрать комнату».",qEn:"“Mother had my brother tidy the room”.",qTr:"“Annem kardeşime odayı toplattı”.",noteEn:"-тты",noteTr:"-тты",opts:["-ды","-лды","-тты","-шты"],c:2,note:"понудительный -т/-дыр (М29)"},
 {g:"baylanysh",qKy:"«Үйгө кел…, колумду жууйм» (когда — М29).",q:"«Придя домой, мою руки».",qEn:"“When I come home, I wash my hands”.",qTr:"“Eve gelince elimi yıkarım”.",noteEn:"-генде",noteTr:"-генде",opts:["-се","-генде","-гени","-гендей"],c:1,note:"-ганда (М29): когда"},
 {g:"baylanysh",qKy:"«Кошунам эртең келем … айтты» (кыйыр кеп — М30).",q:"«Сосед сказал, что придёт завтра».",qEn:"“The neighbour said he would come tomorrow”.",qTr:"“Komşum yarın gelirim dedi”.",noteEn:"деп",noteTr:"деп",opts:["деп","да","го","же"],c:0,note:"кыйыр кеп: цитата + деп (М30)"},
 {g:"baylanysh",qKy:"«Жаңы мектеп кур… жатат» (строится — М30).",q:"«Строится новая школа».",qEn:"“A new school is being built”.",qTr:"“Yeni okul yapılıyor”.",noteEn:"-улуп",noteTr:"-улуп",opts:["-уп","-дуруп","-ушуп","-улуп"],c:3,note:"пассив -ыл (М30)"},
 {g:"formalar",qKy:"«Бул китепти окуй …» (ещё не — М31).",q:"«Эту книгу ещё не читал».",qEn:"“I have not read this book yet”.",qTr:"“Bu kitabı henüz okumadım”.",noteEn:"элекмин",noteTr:"элекмин",opts:["элекмин","жокмун","албайм","бербейм"],c:0,note:"-а элек (М31): ещё не"},
 {g:"formalar",qKy:"«Туристтер көлдү көр… келишет» (посмотреть — М32).",q:"«Туристы приезжают посмотреть озеро».",qEn:"“Tourists come to see the lake”.",qTr:"“Turistler gölü görmeye gelir”.",noteEn:"-гөнү",noteTr:"-гөнү",opts:["-гөндө","-гүдөй","-гөнү","-гөнчө"],c:2,note:"максат -ганы (М32)"},
 {g:"formalar",qKy:"«Тынчтык бол… экен» (пусть бы — М33).",q:"«Пусть бы был мир».",qEn:"“If only there were peace”.",qTr:"“Keşke barış olsa”.",noteEn:"-со",noteTr:"-со",opts:["-гон","-уп","-со","-от"],c:2,note:"тилек -са экен (М33)"},
 {g:"formalar",qKy:"«Айтканың — сөзүң, кыл… — ишиң» (М33).",q:"«Сказанное — слова, сделанное — дела».",qEn:"“What you say is words; what you do is deeds”.",qTr:"“Söylediğin sözün, yaptığın işindir”.",noteEn:"-ганың",noteTr:"-ганың",opts:["-ганың","-ганда","-гандай","-ганы"],c:0,note:"субстантивация -ган (М33)"}
];
