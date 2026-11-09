
function renderGrammarM32(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Зачем: -ганы","Purpose: -ганы","Amaç: -ганы")),
    h("p",{class:"muted"},L("-ганы/-гени/-гону/-гөнү — цель движения: зачем идёшь, едешь, приезжаешь. Не путайте с -ганда (М29): -ганда — когда, -ганы — зачем.","-ганы/-гени/-гону/-гөнү marks the purpose of movement: what you go or come for. Do not confuse with -ганда (M29): -ганда is “when”, -ганы is “what for”.","-ганы/-гени/-гону/-гөнү hareketin amacını bildirir. -ганда (M29) ile karıştırmayın: -ганда zaman, -ганы amaç.")),
    harmonyTable([L("Зачем","What for","Ne için"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("посмотреть","to see","görmeye"),"көр + -гөнү",kgw("Туристтер көлдү көргөнү келишет.","m32_27")],
      [L("отдохнуть","to rest","dinlenmeye"),"эс ал + -ганы",kgw("Тоого эс алганы барабыз.","m32_41")],
      [L("за водой","to fetch water","su almaya"),"ал + -ганы",kgw("Суу алганы булакка бардым.","m32_43")],
      [L("работать","to work","çalışmaya"),"иште + -гени",kgw("Иштегени шаарга көчүп келди.","m32_46")]]),
    h("div",{class:"note"},L("Встретить: ","To meet: ","Karşılamaya: "),kgw("Досум мени тосуп алганы чыкты.","m32_42"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Будто: -гыдай","As if: -гыдай","Sanki: -гыдай")),
    h("p",{class:"muted"},L("-гыдай/-гидей/-гудай/-гүдөй — «будто, хоть, можно»: степень и подобие. После глухого согласного — -кыдай. Родня — «не …»: айтып бүткүс (не описать), тойгус (не насытиться).","-гыдай/-гидей/-гудай/-гүдөй — “as if, enough to”: degree and likeness. After a voiceless consonant — -кыдай. Related “beyond …” forms: айтып бүткүс (beyond words), тойгус (one cannot get enough).","-гыдай/-гидей/-гудай/-гүдөй — “-acak gibi, -acak kadar”. Ötümsüz ünsüzden sonra -кыдай. Akrabası: айтып бүткүс (bitmez), тойгус (doyulmaz).")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("будто до неба","as if to the sky","göğe değecek gibi"),"жет + -кидей",kgw("Асманга жеткидей бийик тоолор.","m32_39")],
      [L("хоть пей","enough to drink","içilecek kadar"),"ич + -кидей",kgw("Көлдүн суусу ичкидей таза.","m32_47")],
      [L("стоит увидеть","worth seeing","görülmeye değer"),"көр + -гүдөй",kgw("Бүт дүйнө көргүдөй кооз жерлер.","m32_50")],
      [L("не описать","beyond words","anlatmakla bitmez"),"бүт + -күс",kgw("Бул жердин кооздугу айтып бүткүс.","m32_48")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Кыргызстан: беш факт","Kyrgyzstan: five facts","Kırgızistan: beş bilgi")),
    harmonyTable([L("Факт","Fact","Bilgi"),L("Кыскача","In short","Kısaca")],[
      [kgw("Борбор калаабыз — Бишкек.","m32_05"),L("столица","the capital","başkent")],
      [kgw("Ысык-Көл — дүйнөдөгү экинчи чоң тоо көлү.","m32_33"),L("и зимой не замерзает","and it does not freeze in winter","kışın donmaz")],
      [kgw("Эң бийик чокубуз — Жеңиш чокусу.","m32_37"),L("выше семи тысяч метров","above seven thousand metres","yedi bin metreden yüksek")],
      [kgw("Өлкөбүздүн дээрлик бүт аймагы — тоо.","m32_08"),L("горная страна","a mountainous country","dağlık ülke")],
      [kgw("Кыргызстандын калкы жети миллиондон ашуун.","m32_10"),L("многонациональный народ","a multi-ethnic people","çok uluslu halk")]]),
    h("div",{class:"note"},L("Макал: ","Proverb: ","Atasözü: "),kgw("Жери байдын — эли бай.","m32_81"))));
  const dlg=[["А: — Кыргызстанга биринчи жолу келдиңизби? Кайсы жерлерди көргүңүз келет?","А: — Вы впервые в Кыргызстане? Что хотите посмотреть?","A: — Is this your first time in Kyrgyzstan? What would you like to see?","A: — Kırgızistan’a ilk kez mi geldiniz? Nereleri görmek istersiniz?"],
             ["Б: — Ооба, биринчи жолу. Ысык-Көлдү көргөнү келдим — суусу ичкидей таза дешет!","Б: — Да, впервые. Приехал посмотреть Иссык-Куль — говорят, вода чистая, хоть пей!","B: — Yes, my first time. I came to see Issyk-Kul — they say the water is clean enough to drink!","B: — Evet, ilk kez. Isık Göl’ü görmeye geldim — suyu içilecek kadar temizmiş!"],
             ["А: — Туура дешет! Жайлоого да барыңыз: боз үйдө жашап, кымыз ичесиз.","А: — Правильно говорят! Съездите и на джайлоо: поживёте в юрте, попьёте кумыс.","A: — They say it right! Visit a jailoo too: stay in a yurt and drink kumis.","A: — Doğru derler! Yaylaya da gidin: boz üyde kalır, kımız içersiniz."],
             ["Б: — Сонун! Тоолоруңуз асманга жеткидей бийик экен.","Б: — Отлично! Горы у вас, оказывается, — будто до неба.","B: — Wonderful! Your mountains seem to reach the sky.","B: — Harika! Dağlarınız göğe değecek gibi yüksekmiş."],
             ["А: — Биз тоолорубуз менен сыймыктанабыз. Бирок жаратылышты коргош керек: таштанды таштабаңыз.","А: — Мы гордимся нашими горами. Но природу надо беречь: не оставляйте мусор.","A: — We are proud of our mountains. But nature must be protected: leave no rubbish.","A: — Dağlarımızla gurur duyarız. Ama doğa korunmalı: çöp bırakmayın."],
             ["Б: — Албетте! Кыргызстан — бүт дүйнө көргүдөй кооз өлкө экен.","Б: — Конечно! Кыргызстан — страна, которую стоит увидеть всему миру.","B: — Of course! Kyrgyzstan is a country the whole world should see.","B: — Elbette! Kırgızistan bütün dünyanın görmesi gereken bir ülkeymiş."]];
  weekDialog(m,"Диалог: «Кыргызстанга кош келиңиз!»","Dialogue: «Кыргызстанга кош келиңиз!»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы «-ганы» и «-гыдай», разбери состав; 3) расскажи «Кыргызстандын туризми» на 12–15 предложений — с двумя «-ганы»; 4) расскажи «Кыргызстандын экологиясы» — что угрожает природе и как её беречь.","Tasks: 1) read the dialogue swapping roles; 2) write out the “-ганы” and “-гыдай” forms and analyse them; 3) tell “Кыргызстандын туризми” in 12–15 sentences — with two “-ганы” forms; 4) tell “Кыргызстандын экологиясы”: what threatens nature and how to protect it.","Diyalog: “Кыргызстанга кош келиңиз!”","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) “-ганы” ve “-гыдай” biçimlerini yazıp çözümle; 3) “Кыргызстандын туризми” konusunu 12–15 cümleyle anlat — iki “-ганы” ile; 4) “Кыргызстандын экологиясы” konusunu anlat.");
}
