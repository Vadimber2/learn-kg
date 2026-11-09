
function renderGrammarM25(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Пикир айтуу: ядро B1","Voicing an opinion: the B1 core","Görüş bildirme: B1 çekirdeği")),
    h("p",{class:"muted"},L("Ядро B1 — умение выражать точку зрения. Вот её инструменты.","The B1 core: being able to express your viewpoint. Here are its tools.","B1 çekirdeği: görüş bildirebilmek. İşte araçları.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("моё мнение","my opinion","görüşüm"),L("Менин оюмча… / Менимче (М9)","Менин оюмча… / Менимче (M9)","Менин оюмча… / Менимче (M9)"),kgw("Менин оюмча, бул туура чечим.","m25_17")],
      [L("считаю кого-то каким-то","I consider…","… sayıyorum"),L("… деп эсептейм (деп — М19)","… деп эсептейм (деп — M19)","… деп эсептейм (деп — M19)"),kgw("Мен аны чынчыл адам деп эсептейм.","m25_18")],
      [L("спросить мнение","ask an opinion","görüş sormak"),L("Сиз кандай ойлойсуз?","Сиз кандай ойлойсуз?","Сиз кандай ойлойсуз?"),kgw("Сиз кандай ойлойсуз?","m25_20")],
      [L("вежливое несогласие","polite disagreement","kibar itiraz"),L("кошулбайм · башкача ойлойм","кошулбайм · башкача ойлойм","кошулбайм · башкача ойлойм"),kgw("Мен буга кошулбайм.","m25_25")],
      [L("обе стороны","both sides","iki taraf"),L("Бир жагынан… экинчи жагынан…","Бир жагынан… экинчи жагынан…","Бир жагынан… экинчи жагынан…"),kgw("Бир жагынан, сиз туурасыз.","m25_26")]]),
    h("div",{class:"note"},L("Сомнение («күмөн саноо»): ","Doubt («күмөн саноо»): ","Şüphe («күмөн саноо»): "),kgw("Балким, сиз туура айтып жаткан чыгарсыз.","m25_28"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Умею: -а алуу","Can: -а алуу","Yapabilme: -а алуу")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("умею / могу","I can","yapabilirim"),"-а/-е/-й + алам",kgw("Мен кыргызча эркин сүйлөй алам.","m25_29")],
      [L("он может","he can","o yapabilir"),"-а/-е + алат",kgw("Ал ар кандай маселени чече алат.","m25_30")],
      [L("не могу","I cannot","yapamam"),"-а/-е + албайм",kgw("Мен ага ишене албайм.","m25_34")],
      [L("умение (имя)","the ability (noun)","yetenek (ad)"),"-а алуу",kgw("Кечире алуу — чоң сапат.","m25_33")]]),
    h("div",{class:"note"},L("Не путайте с М24: -са болот — «можно» (разрешение), -а алам — «умею/могу» (способность).","Do not confuse with M24: -са болот — “allowed” (permission), -а алам — “can” (ability).","M24 ile karıştırmayın: -са болот — “serbest” (izin), -а алам — “yapabilirim” (yetenek)."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Сравнение: -га караганда","Comparison: -га караганда","Karşılaştırma: -га караганда")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("по сравнению с кем-то","compared to someone","birine kıyasla"),L("барыш падеж + караганда","dative + караганда","yönelme + караганда"),kgw("Иниме караганда мен сабырдуумун.","m25_35")],
      [L("по сравнению с местом","compared to a place","bir yere kıyasla"),"-га караганда",kgw("Шаарга караганда айылда тынч.","m25_36")],
      [L("похож ↔ совсем другой","similar ↔ different","benzer ↔ bambaşka"),kgw("окшош","m25_37"),kgw("такыр башкача","m25_40")]]),
    h("div",{class:"note"},L("Разница — ","The difference — ","Fark — "),kgw("айырма","m25_38"),L("; отличается — ","; differs — ","; farklıdır — "),kgw("айырмаланат","m25_39"))));
  const dlg=[["А: — Менимче, эң маанилүү сапат — чынчылдык. Сиз кандай ойлойсуз?","А: — По-моему, важнейшее качество — честность. Как вы думаете?","A: — In my view honesty is the key quality. What do you think?","A: — Bence en önemli nitelik dürüstlük. Siz ne düşünüyorsunuz?"],
             ["Б: — Бир жагынан, туура. Экинчи жагынан, боорукердик да маанилүү деп эсептейм.","Б: — С одной стороны, верно. С другой — считаю, что доброта тоже важна.","B: — On the one hand, true. On the other, I consider kindness important too.","B: — Bir yandan doğru. Öte yandan iyi kalplilik de önemli bence."],
             ["А: — Балким. Бирок орой адамга ишене албайм.","А: — Возможно. Но грубому человеку я доверять не могу.","A: — Perhaps. But I cannot trust a rude person.","A: — Belki. Ama kaba birine güvenemem."],
             ["Б: — Мен буга кошулбайм: адам өзгөрө алат.","Б: — С этим не соглашусь: человек может измениться.","B: — I disagree: a person can change.","B: — Buna katılmıyorum: insan değişebilir."],
             ["А: — Ким сизге үлгү болгон?","А: — Кто стал для вас примером?","A: — Who has been your example?","A: — Sizin örneğiniz kim oldu?"],
             ["Б: — Чоң энем. Андан сабырдуу адамды тааныбайм.","Б: — Бабушка. Терпеливее её я никого не знаю.","B: — My grandmother. I know no one more patient than her.","B: — Büyükannem. Ondan daha sabırlısını tanımıyorum."]];
  weekDialog(m,"Диалог: «Талкуу»","Dialogue: «Талкуу»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы мнения (менимче, деп эсептейм, кошулбайм) и добавь три своих; 3) расскажи «Мага жаккан сапаттар» на 12–15 предложений — не меньше трёх формул мнения; 4) сравни двух знакомых через -га караганда.","Tasks: 1) read the dialogue swapping roles; 2) write out all the opinion formulas (менимче, деп эсептейм, кошулбайм) and add three of your own; 3) tell “Мага жаккан сапаттар” in 12–15 sentences — at least three opinion formulas; 4) compare two people you know with -га караганда.","Diyalog: «Талкуу»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) tüm görüş kalıplarını (менимче, деп эсептейм, кошулбайм) yazıp üçünü kendin ekle; 3) “Мага жаккан сапаттар” konusunu 12–15 cümleyle anlat — en az üç görüş kalıbı; 4) iki tanıdığını -га караганда ile karşılaştır.");
}
