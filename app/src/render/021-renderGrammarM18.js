
function renderGrammarM18(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Причастие -ган: «который»","The -ган participle: “which/who”","-ган ortacı: “-en / -diği”")),
    h("p",{class:"muted"},L("Знакомый аффикс -ган (перфект — М12), поставленный ПЕРЕД существительным, превращает действие в определение: кечиккен учак — «самолёт, который опоздал».","The familiar -ган affix (perfect — M12) placed BEFORE a noun turns an action into an attribute: кечиккен учак — “the plane that was delayed”.","Bildiğin -ган eki (geçmiş — M12) adın ÖNÜNE gelince eylemi sıfata çevirir: кечиккен учак — “rötar yapan uçak”.")),
    harmonyTable([L("Кто/что делает","Who does what","Kim ne yapıyor"),L("Определение","Attribute","Sıfat"),L("Пример","Example","Örnek")],[
      [L("самолёт опоздал","the plane was delayed","uçak rötar yaptı"),"кечик- + -кен",kgw("кечиккен учак","m18_62")],
      [L("пассажир купил билет","the passenger bought a ticket","yolcu bilet aldı"),"ал- + -ган",kgw("билет алган жүргүнчү","m18_65")],
      [L("я видел город","I saw the city","şehri gördüm"),L("мен + -гөн","мен + -гөн","мен + -гөн"),kgw("мен көргөн шаар","m18_67")],
      [L("мы вышли на остановке","we got off at the stop","durakta indik"),"түш- + -көн",kgw("биз түшкөн аялдама","m18_66")]]),
    h("div",{class:"note"},L("Отрицание — -баган: келбеген автобус. «Находящийся у/в» — -дагы: ","Negation — -баган: келбеген автобус. “Which is at” — -дагы: ","Olumsuz — -баган: келбеген автобус. “-deki” — -дагы: "),kgw("терезенин жанындагы орун","m18_64"),
      L(" «Сейчас едущий» — бараткан: "," “Currently going” — бараткан: "," “Şu an giden” — бараткан: "),kgw("Бишкекке бараткан поезд","m18_63"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Послелоги пути","Postpositions of the road","Yol edatları")),
    harmonyTable([L("Послелог","Postposition","Edat"),L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      [kgw("бою","m18_68"),L("вдоль; в течение","along; throughout","boyunca"),kgw("Жол бою ырдап бардык.","m18_72")],
      [kgw("карай","m18_69"),L("в сторону","towards","doğru"),["вокзалды карай"]],
      [kgw("баштап","m18_70"),L("начиная с","starting from","itibaren"),["шейшембиден баштап"]],
      [kgw("ортосунда","m4_58"),L("между (с родительным)","between (with genitive)","arasında (ilgi hâliyle)"),["эки шаардын ортосунда"]]]),
    h("div",{class:"note"},L("Уже знакомые: аркылуу — «через» (М7), чейин — «до» (М5), жанында (М4), -дан кийин/мурун (М8). Вместе они описывают весь маршрут.","Already familiar: аркылуу — “via” (M7), чейин — “up to” (M5), жанында (M4), -дан кийин/мурун (M8). Together they describe the whole route.","Zaten bildiğin: аркылуу — “üzerinden” (M7), чейин — “kadar” (M5), жанында (M4), -дан кийин/мурун (M8). Birlikte bütün güzergâhı anlatırlar."))));
  const dlg=[["А: — Кечиресиз, Ошко учкан каттамга каттоо кайда?","А: — Извините, где регистрация на рейс в Ош?","A: — Excuse me, where is check-in for the Osh flight?","A: — Affedersiniz, Oş uçuşunun check-in'i nerede?"],
             ["Б: — Бешинчи терезеде. Паспортуңузду даярдаңыз.","Б: — У пятого окна. Приготовьте паспорт.","B: — At window five. Have your passport ready.","B: — Beşinci gişede. Pasaportunuzu hazırlayın."],
             ["А: — Мына. Терезенин жанындагы орун барбы?","А: — Вот. Есть место у окна?","A: — Here it is. Is there a window seat?","A: — Buyurun. Cam kenarında yer var mı?"],
             ["Б: — Бар. Багажыңыз канча?","Б: — Есть. Сколько у Вас багажа?","B: — There is. How much luggage do you have?","B: — Var. Kaç bagajınız var?"],
             ["А: — Бир чемодан жана кол жүгүм бар.","А: — Один чемодан и ручная кладь.","A: — One suitcase and hand luggage.","A: — Bir valiz ve el bagajım var."],
             ["Б: — Болуптур. Мына учуу талонуңуз. Конуу онунчу чыгуудан.","Б: — Хорошо. Вот Ваш посадочный талон. Посадка через десятый выход.","B: — Fine. Here is your boarding pass. Boarding is at gate ten.","B: — Tamam. İşte biniş kartınız. Biniş onuncu kapıdan."],
             ["А: — Учак өз убагында учабы?","А: — Самолёт вылетает вовремя?","A: — Does the plane leave on time?","A: — Uçak zamanında kalkıyor mu?"],
             ["Б: — Ооба, кечикпейт. Жолуңуз шыдыр болсун!","Б: — Да, без опоздания. Счастливого пути!","B: — Yes, no delay. Have a good trip!","B: — Evet, rötar yok. Yolunuz açık olsun!"]];
  weekDialog(m,"Диалог: «Аэропортто»","Dialogue: «Аэропортто»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) найди все причастия на -ган/-кен и объясни их; 3) объясни дорогу от своего дома до работы с послелогами; 4) разыграй покупку билета на поезд (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) find all the -ган/-кен participles and explain them; 3) explain the way from your home to work using postpositions; 4) act out buying a train ticket (methodology §9, item 8).","Diyalog: «Аэропортто»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün -ган/-кен ortaçlarını bul ve açıkla; 3) evinden işine yolu edatlarla tarif et; 4) tren bileti alma sahnesi canlandır (metodoloji §9, madde 8).");
}
