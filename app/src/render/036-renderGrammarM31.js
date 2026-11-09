
function renderGrammarM31(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Ещё не: -а элек","Not yet: -а элек","Henüz değil: -а элек")),
    h("p",{class:"muted"},L("Деепричастие -а/-й + элек: дело пока не сделано, но ожидается. «Окуган жокмун» — просто не читал; «окуй элекмин» — ещё не читал, но собираюсь.","The -а/-й converb + элек: the deed has not happened yet but is expected. «Окуган жокмун» is simply “I did not read”; «окуй элекмин» is “not yet — but I mean to”.","-а/-й ulacı + элек: iş henüz olmadı ama bekleniyor. «Окуган жокмун» sadece “okumadım”; «окуй элекмин» “henüz okumadım ama niyetliyim”.")),
    harmonyTable([L("Лицо","Person","Kişi"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("я","I","ben"),"окуй элек + -мин",kgw("Бул китепти окуй элекмин.","m31_33")],
      [L("я","I","ben"),"көрө элек + -мин",kgw("Бул фильмди көрө элекмин.","m31_34")],
      [L("мы","we","biz"),"бара элек + -пиз",kgw("Театрга бара элекпиз.","m31_35")],
      [L("оно (дело)","it","o"),"бүтө элек",kgw("Иш али бүтө элек.","m31_38")]]),
    h("div",{class:"note"},L("С условием: ","With a condition: ","Koşulla: "),kgw("Айтматовду окуй элек болсоң, башта!","m31_37"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Чогуу: -ыш","Together: -ыш","Birlikte: -ыш")),
    h("p",{class:"muted"},L("Взаимно-совместный залог -ыш/-иш/-уш/-үш (после гласной — -ш): дело делают вместе или друг для друга. Ряд залогов B1: -дыр (М29) — поручаешь, -ыл (М30) — исполнитель не назван, -ыш — вместе.","The reciprocal voice -ыш/-иш/-уш/-үш (just -ш after a vowel): done together or for each other. The B1 voices: -дыр (M29) — you have it done, -ыл (M30) — the doer is unnamed, -ыш — together.","İşteş çatı -ыш/-иш/-уш/-үш (ünlüden sonra -ш): iş birlikte ya da karşılıklı yapılır. B1 çatıları: -дыр (M29) — yaptırma, -ыл (M30) — yapan söylenmez, -ыш — birlikte.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("поиграли вместе","played together","birlikte oynadılar"),"ойно + -ш",kgw("Балдар футбол ойношту.","m31_42")],
      [L("переписываемся","write to each other","yazışırız"),"жаз + -ыш",kgw("Биз досум менен жазышабыз.","m31_43")],
      [L("состязаться","to race","yarışmak"),"жарыш-",kgw("жарышуу","m31_39")],
      [L("состязание акынов","the poets’ contest","atışma"),"айт + -ыш",kgw("айтыш","m31_75")]]),
    h("div",{class:"note"},L("Макал: ","Proverb: ","Atasözü: "),kgw("Өнөр алды — кызыл тил.","m31_77"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Улуттук оюндар","National games","Millî oyunlar")),
    harmonyTable([L("Оюн","Game","Oyun"),L("Кыскача","In short","Kısaca")],[
      [kgw("көк бөрү","m14_29"),L("всадники борются за тушу козла","horsemen contend for a goat carcass","atlılar oğlak için çekişir")],
      [kgw("ат чабыш","m31_25"),L("скачки","horse racing","at yarışı")],
      [kgw("кыз куумай","m31_26"),L("догони девушку на коне","chase the girl on horseback","atla kız kovalama")],
      [kgw("тогуз коргоол","m31_27"),L("игра ума с камешками","a mind game with stones","taşlarla zekâ oyunu")],
      [kgw("ордо","m31_28"),L("игра в альчики","the knucklebone game","aşık kemiği oyunu")],
      [kgw("балбан күрөш","m31_30"),L("борьба силачей","wrestling","güreş")]]),
    h("div",{class:"note"},L("Оюндар майрамдарда ойнолот (-ыл, М30); ","Games are played at festivals (-ыл, M30); ","Oyunlar bayramlarda oynanır (-ыл, M30); "),kgw("Дүйнөлүк көчмөндөр оюндары","m31_32"))));
  const dlg=[["А: — Кандай чыгармаларды жактырасыз?","А: — Какие произведения Вам нравятся?","A: — What works do you like?","A: — Ne tür eserleri seversiniz?"],
             ["Б: — Айтматовдун романдарын жакшы көрөм. «Ак кемени» кайра-кайра окуйм.","Б: — Люблю романы Айтматова. «Белый пароход» перечитываю снова и снова.","B: — I love Aitmatov’s novels. I read “The White Ship” again and again.","B: — Aytmatov’un romanlarını severim. “Ak Keme”yi tekrar tekrar okurum."],
             ["А: — «Биринчи мугалимди» окудуңуз беле?","А: — А «Первого учителя» читали?","A: — Have you read “The First Teacher”?","A: — “Birinci Öğretmen”i okudunuz mu?"],
             ["Б: — Окуй элекмин, бирок окугум келет. Сиз улуттук оюндарды билесизби?","Б: — Ещё не читал, но хочу. А Вы знаете национальные игры?","B: — Not yet, but I want to. Do you know the national games?","B: — Henüz okumadım ama isterim. Siz millî oyunları bilir misiniz?"],
             ["А: — Албетте! Бала кезде ордо ойночубуз, азыр тогуз коргоол ойношобуз.","А: — Конечно! В детстве играли в ордо, теперь играем в тогуз-коргоол.","A: — Of course! As children we played ordo; now we play toguz korgool together.","A: — Elbette! Çocukken ordo oynardık, şimdi dokuz korgool oynarız."],
             ["Б: — Мелдешели! Ким утса, ошол чай куят.","Б: — Давайте состязаться! Кто выиграет, тот наливает чай.","B: — Let us have a contest! Whoever wins pours the tea.","B: — Yarışalım! Kim kazanırsa çayı o koyar."]];
  weekDialog(m,"Диалог: «Чыгармалар жана оюндар»","Dialogue: «Чыгармалар жана оюндар»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы «-а элек» и «-ыш», разбери состав; 3) расскажи «Мага жаккан чыгармалар» на 12–15 предложений — с «-а элек» и макалом «Өнөр алды — кызыл тил»; 4) опиши одну национальную игру: эрежеси, ким утат.","Tasks: 1) read the dialogue swapping roles; 2) write out the “-а элек” and “-ыш” forms and analyse them; 3) tell “Мага жаккан чыгармалар” in 12–15 sentences — with “-а элек” and the proverb; 4) describe one national game: its rules and who wins.","Diyalog: “Чыгармалар жана оюндар”","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) “-а элек” ve “-ыш” biçimlerini yazıp çözümle; 3) “Мага жаккан чыгармалар” konusunu 12–15 cümleyle anlat — “-а элек” ve atasözüyle; 4) bir millî oyunu anlat: kuralları, kim kazanır.");
}
