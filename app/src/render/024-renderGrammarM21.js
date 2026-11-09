
function renderGrammarM21(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Годы, века и рассказ о прошлом","Years, centuries and telling the past","Yıllar, yüzyıllar ve geçmişi anlatmak")),
    h("p",{class:"muted"},L("Год называется порядковым числительным (М17): … -инчи жылы. Рассказ о прошлом, которого сам не видел, ведётся перфектом -ган (М12).","A year is an ordinal numeral (M17): … -инчи жылы. Telling about a past you did not witness uses the -ган perfect (M12).","Yıl sıra sayısıyla söylenir (M17): … -инчи жылы. Tanık olmadığın geçmiş -ган ile anlatılır (M12).")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("в … году","in the year …","… yılında"),L("числ. + -инчи жылы","numeral + -инчи жылы","sayı + -инчи жылы"),kgw("Ал миң тогуз жүз жыйырма сегизинчи жылы төрөлгөн.","m21_10")],
      [L("в … веке","in the … century","… yüzyılda"),L("числ. + -нчы кылымда","numeral + -нчы кылымда","sayı + -нчы кылымда"),kgw("жыйырманчы кылымда","m21_59")],
      [L("с … (до сих пор)","since …","…-den beri"),"-дан бери",kgw("эки миңинчи жылдан бери","m21_63")],
      [L("давно / тогда","long ago / then","eskiden / o zaman"),L("илгери · ошол убакта","илгери · ошол убакта","илгери · ошол убакта"),kgw("илгери","m12_56")]]),
    h("div",{class:"note"},L("Начало и конец: кылымдын башында / аягында. Эпохи: байыркы доор ↔ азыркы доор.","Beginning and end: кылымдын башында / аягында. Eras: байыркы доор ↔ азыркы доор.","Başı ve sonu: кылымдын башында / аягында. Çağlar: байыркы доор ↔ азыркы доор."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Пассив: -ыл","The passive: -ыл","Edilgen: -ыл")),
    h("p",{class:"muted"},L("Когда важно событие, а не деятель, глагол берёт -ыл/-ил/-ул/-үл (после гласной — -л): жаз → жазыл- «быть написанным».","When the event matters and the doer does not, the verb takes -ыл/-ил/-ул/-үл (just -л after a vowel): жаз → жазыл- “to be written”.","Olay önemliyse, yapan değilse, fiil -ыл/-ил/-ул/-үл alır (ünlüden sonra -л): жаз → жазыл-.")),
    harmonyTable([L("Актив","Active","Etken"),L("Пассив","Passive","Edilgen"),L("Пример","Example","Örnek")],[
      [L("жазуу — писать","жазуу — to write","жазуу — yazmak"),kgw("жазылган","m21_65"),kgw("Бул китеп көп тилге которулган.","m21_13")],
      [L("куруу — строить","куруу — to build","куруу — inşa etmek"),kgw("курулган","m21_66"),["Театр борбордо курулган."]],
      [L("атоо — называть","атоо — to name","атоо — adlandırmak"),kgw("аталган","m21_68"),kgw("Курманжан датка «Алай ханышасы» деп аталган.","m21_12")],
      [L("белгилөө — отмечать (М20)","белгилөө — to celebrate (M20)","белгилөө — kutlamak (M20)"),kgw("белгиленет","m21_70"),["Эгемендүүлүк күнү ар жылы белгиленет."]]]),
    h("div",{class:"note"},L("Отрицание — -ылбайт: ","Negation — -ылбайт: ","Olumsuz — -ылбайт: "),kgw("унутулбайт","m21_71"),
      L(" Баатырлар эч качан унутулбайт — герои не забываются."," Баатырлар эч качан унутулбайт — heroes are never forgotten."," Баатырлар эч качан унутулбайт — kahramanlar asla unutulmaz."))));
  const dlg=[["А: — Бул сүрөттө ким?","А: — Кто на этом портрете?","A: — Who is in this portrait?","A: — Bu resimde kim var?"],
             ["Б: — Бул Курманжан датка. Ал «Алай ханышасы» деп аталган.","Б: — Это Курманжан датка. Её называли «Алайской царицей».","B: — This is Kurmanjan Datka. She was called “the Queen of Alai”.","B: — Bu Kurmancan Datka. “Alay Kraliçesi” diye anılmış."],
             ["А: — Качан жашаган?","А: — Когда она жила?","A: — When did she live?","A: — Ne zaman yaşamış?"],
             ["Б: — Он тогузунчу кылымда. Ал элин коргогон баатыр аял болгон.","Б: — В девятнадцатом веке. Она была героиней, защищавшей свой народ.","B: — In the nineteenth century. She was a heroine who protected her people.","B: — On dokuzuncu yüzyılda. Halkını koruyan kahraman bir kadınmış."],
             ["А: — Эмнеси менен белгилүү?","А: — Чем она известна?","A: — What is she famous for?","A: — Neyiyle ünlü?"],
             ["Б: — Тынчтыкты сактап калган. Ага эстелик орнотулган.","Б: — Она сохранила мир. Ей установлен памятник.","B: — She preserved peace. A monument has been erected to her.","B: — Barışı korumuş. Ona anıt dikilmiş."],
             ["А: — Айтматовду окуп көрдүң беле?","А: — А Айтматова ты читал?","A: — Have you read Aitmatov?","A: — Aytmatov'u okudun mu?"],
             ["Б: — Ооба! Анын чыгармалары көп тилге которулган.","Б: — Да! Его произведения переведены на многие языки.","B: — Yes! His works have been translated into many languages.","B: — Evet! Eserleri birçok dile çevrilmiş."]];
  weekDialog(m,"Диалог: «Музейде»","Dialogue: «Музейде»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши пассивные формы на -ыл и разбери их состав; 3) назови три даты своей жизни по-кыргызски (… -инчи жылы); 4) расскажи об известном человеке КР по плану: когда родился — чем известен — что осталось (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out the -ыл passive forms and analyse them; 3) name three dates of your life in Kyrgyz (… -инчи жылы); 4) tell about a famous person of Kyrgyzstan: born — famous for — legacy (methodology §9, item 8).","Diyalog: «Музейде»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -ыл edilgen biçimlerini yazıp çözümle; 3) hayatının üç tarihini Kırgızca söyle (… -инчи жылы); 4) Kırgızistan'ın ünlü bir kişisini anlat: doğumu — ünü — mirası (metodoloji §9, madde 8).");
}
