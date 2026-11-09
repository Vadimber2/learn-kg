function renderGrammarM6(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Табыш падеж: кого? что? (-ны/-ды/-ты)","The accusative case: whom? what? (-ны/-ды/-ты)","Tabış (belirtme) hâli: kimi? neyi? (-ны/-ды/-ты)")),
    h("p",{class:"muted"},L("Оформляется ТОЛЬКО определённый объект («тот самый»). Неопределённый — без аффикса: нан алдым (купил хлеба) ↔ нанды алдым (взял тот хлеб).","Marks ONLY a definite object (“that particular one”). Indefinite — no affix: нан алдым (bought some bread) ↔ нанды алдым (took the bread).","YALNIZCA belirli nesne ek alır (“o belirli olan”). Belirsizse ek yoktur: нан алдым (ekmek aldım) ↔ нанды алдым (o ekmeği aldım).")),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),"а, ы","е, и","о, у","ө, ү"],[
      [L("гласной","a vowel","ünlü"),"-ны","-ни","-ну","-нү"],
      [L("звонкой","a voiced consonant","tonlu ünsüz"),"-ды","-ди","-ду","-дү"],
      [L("глухой","a voiceless consonant","tonsuz ünsüz"),"-ты","-ти","-ту","-тү"]]),
    h("p",{class:"muted"},L("Примеры: ","Examples: ","Örnekler: "),kgw("алманы","m6_61"),", ",kgw("нанды","m6_58"),", ",kgw("сүттү","m6_59"),", ",kgw("китепти","m6_60"),L(". Вопросы: ",". Questions: ",". Sorular: "),kgw("кимди?","m6_62")," · ",kgw("эмнени?","m6_63"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Прошедшее время: -ды/-ты","The past tense: -ды/-ты","Görülen geçmiş zaman: -ды/-ты")),
    h("p",{class:"muted"},L("Основа + -ды/-ди/-ду/-дү (после глухих — -ты/…) + личный аффикс:","Stem + -ды/-ди/-ду/-дү (voiceless → -ты/…) + personal affix:","Gövde + -ды/-ди/-ду/-дү (tonsuzlardan sonra -ты/…) + kişi eki:")),
    harmonyTable([L("Лицо","Person","Kişi"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["мен","-м",["бардым"]],
      ["сен","-ң",["бардың"]],
      ["сиз","-ңыз",["бардыңыз"]],
      ["ал","—",["барды"]],
      ["биз","-к",["бардык"]]]),
    h("p",{class:"muted"},L("Гласная аффикса — по последней гласной основы, а согласная — по последнему звуку: после глухих (п, т, к, с, ш, ч) д → т.","The affix vowel follows the last vowel of the stem, the consonant follows the last sound: after voiceless consonants (п, т, к, с, ш, ч) д → т.","Ekin ünlüsü gövdenin son ünlüsüne, ünsüzü son sese uyar: tonsuzlardan (п, т, к, с, ш, ч) sonra д → т.")),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),"а, ы","е, и","о, у","ө, ү"],[
      [L("гласной и звонкой","a vowel or voiced consonant","ünlü ve tonlu ünsüz"),["бардым"],["келдим"],"-ду",["көрдүм"]],
      [L("глухой","a voiceless consonant","tonsuz ünsüz"),["айттым"],["ичтим"],["уктум"],["түштүм"]]]),
    h("p",{class:"muted"},L("Примеры после глухих: ","Examples after voiceless consonants: ","Tonsuzlardan sonra örnekler: "),kgw("айттым","m6_97"),", ",kgw("саттым","m6_98"),", ",kgw("чыктым","m6_99"),", ",kgw("кеттим","m6_100"),", ",kgw("ичтим","m6_68"),", ",kgw("уктум","m6_101"),", ",kgw("түштүм","m6_102"),"."),
    h("div",{class:"note"},L("Глухость: ич → ","Voicelessness: ич → ","Tonsuzluk: ич → "),kgw("ичтим","m6_68"),", айт → ",h("span",{class:"kgword"},"айтты"),L(". Оценка и трансформация: "," Assessment & transformation: "," Değerlendirme ve dönüştürme: "),kgw("Абдан даамдуу!","m6_85")," · ",kgw("Бул кымбат эмес.","m6_84"),L(" · вопрос: Кымбатпы? Арзанбы? — этот навык войдёт в экзаменационное задание «Сүйлөө»."," · question: Кымбатпы? Арзанбы? — this skill feeds the «Сүйлөө» exam task."," · soru: Кымбатпы? Арзанбы? — bu beceri “Сүйлөө” sınav görevine girer."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Отрицание в прошедшем: -ба/-па + -ды","The negative past: -ба/-па + -ды","Olumsuz geçmiş: -ба/-па + -ды")),
    h("p",{class:"muted"},L("Отрицание ставится сразу после основы, до прошедшего времени и личного аффикса: бар + ба + ды + м → барбадым «я не ходил». После глухих (п, т, к, с, ш, ч) б → п.","Negation goes right after the stem, before the past tense and the personal affix: бар + ба + ды + м → барбадым “I didn’t go”. After voiceless consonants (п, т, к, с, ш, ч) б → п.","Olumsuzluk eki gövdeden hemen sonra, geçmiş zaman ve kişi ekinden önce gelir: бар + ба + ды + м → барбадым “gitmedim”. Tonsuzlardan (п, т, к, с, ш, ч) sonra б → п.")),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),"а, ы, у","е, и","о","ө, ү"],[
      [L("гласной и звонкой","a vowel or voiced consonant","ünlü ve tonlu ünsüz"),"-ба","-бе","-бо","-бө"],
      [L("глухой","a voiceless consonant","tonsuz ünsüz"),"-па","-пе","-по","-пө"],
      [L("дальше прошедшее","then the past tense","ardından geçmiş zaman"),"-ды","-ди","-ду","-дү"]]),
    h("div",{class:"note"},L("Внимание: после у — -ба/-па, а не -бо: ","Note: after у it is -ба/-па, not -бо: ","Dikkat: у’dan sonra -бо değil, -ба/-па: "),kgw("укпадым","m6_109"),L(". А после ү огубление есть: ",". After ү, though, the vowel is rounded: ",". ү’dan sonra ise yuvarlaklaşma olur: "),kgw("түшпөдүм","m6_112"),"."),
    h("p",{class:"muted"},L("Примеры: ","Examples: ","Örnekler: "),kgw("барбадым","m6_103"),", ",kgw("албадым","m6_104"),", ",kgw("келбедим","m6_105"),", ",kgw("жебедим","m6_106"),", ",kgw("ичпедим","m6_107"),", ",kgw("сатпадым","m6_108"),", ",kgw("көрбөдүм","m6_110"),", ",kgw("төлөбөдүм","m6_111"),", ",kgw("Автобус токтободу.","m6_113"),L(" В М7 то же отрицание встретится в настоящем-будущем: барбайм «не пойду».",". In M7 the same negation appears in the present-future: барбайм “I won’t go”.",". M7’de aynı olumsuzluk şimdiki-gelecek zamanda görünecek: барбайм “gitmem”."))));
  const dlg=[["А: — Саламатсызбы! Бир кило алма канча турат?","А: — Здравствуйте! Сколько стоит килограмм яблок?","A: — Hello! How much is a kilo of apples?","A: — Merhaba! Bir kilo elma kaç para?"],
             ["Б: — Сексен сом.","Б: — Восемьдесят сомов.","B: — Eighty som.","B: — Seksen som."],
             ["А: — Абдан кымбат! Арзаныраак барбы?","А: — Очень дорого! Есть подешевле?","A: — Very expensive! Anything cheaper?","A: — Çok pahalı! Daha ucuzu var mı?"],
             ["Б: — Бул алма даамдуу. Мына бул — алтымыш сом.","Б: — Эти яблоки вкусные. Вот эти — шестьдесят.","B: — These apples are tasty. These ones are sixty.","B: — Bu elma lezzetli. İşte bu — altmış som."],
             ["А: — Макул, эки кило бериңиз. Дагы жарым кило туз керек.","А: — Хорошо, дайте два кило. Ещё нужно полкило соли.","A: — Fine, two kilos please. I also need half a kilo of salt.","A: — Tamam, iki kilo verin. Bir de yarım kilo tuz lazım."],
             ["Б: — Баары жүз сексен сом болот.","Б: — Всего будет 180 сомов.","B: — That will be 180 som in total.","B: — Hepsi yüz seksen som eder."],
             ["А: — Мына акча. Рахмат!","А: — Вот деньги. Спасибо!","A: — Here is the money. Thanks!","A: — Buyurun para. Teşekkürler!"]];
  weekDialog(m,"Диалог: «Базарда»","Dialogue: «At the market»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) найди объекты в табыш падеже и без него — объясни разницу; 3) запиши цены прописью; 4) разыграй покупку СВОИХ продуктов (методика §9, п. 8).","Tasks: 1) read swapping roles; 2) find accusative and unmarked objects — explain the difference; 3) write the prices in words; 4) act out buying YOUR OWN groceries (methodology §9, item 8).","Diyalog: «Базарда» (pazarda)","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) tabış hâli alan ve almayan nesneleri bul — farkı açıkla; 3) fiyatları yazıyla yaz; 4) KENDİ alışverişini canlandır (metodoloji §9, madde 8).");
}
