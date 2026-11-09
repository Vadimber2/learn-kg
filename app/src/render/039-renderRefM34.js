
function renderRefM34(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Грамматика B1 одним взглядом","B1 grammar at a glance","Tek bakışta B1 dil bilgisi")),
    h("p",{class:"muted"},L("Десять модулей — десять инструментов. Ниже — по одному опорному примеру на каждый; подробности — на грамм-странице своего модуля.","Ten modules — ten tools. One anchor example for each below; details are on each module’s grammar page.","On modül — on araç. Aşağıda her biri için birer örnek; ayrıntılar ilgili modülün sayfasında.")),
    harmonyTable([L("Модуль","Module","Modül"),L("Форма","Form","Biçim"),L("Опора","Anchor","Dayanak")],[
      ["М24","-ыш керек / -са болот",L("надо; можно/нельзя","must; may","gerek; olur")],
      ["М25","-а алуу / -га караганда",L("умею; по сравнению с","can; compared to","yeterlik; göre")],
      ["М26","-макчы / -ар",L("собираюсь; наверное","intend; probably","niyet; olasılık")],
      ["М27","эгер … -са",L("если","if","koşul")],
      ["М28","-майынча / -ганча",L("пока не; чем/пока","until; than/while","-madıkça; -ana kadar")],
      ["М29","-дыр, -т / -ганда",L("поручить; когда","have done; when","yaptırma; -ınca")],
      ["М30","… деп / -ыл",L("косвенная речь; пассив","reported speech; passive","dolaylı anlatım; edilgen")],
      ["М31","-а элек / -ыш",L("ещё не; вместе","not yet; together","henüz değil; işteş")],
      ["М32","-ганы / -гыдай",L("зачем; будто","purpose; as if","amaç; sanki")],
      ["М33","-са экен / -ган + -ың",L("пусть бы; «то, что…»","a wish; “what one did”","dilek; adlaşma")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Макалдар — темаларга","Proverbs for the topics","Konulara atasözleri")),
    h("p",{class:"muted"},L("Тема модуля звучит сильнее с пословицей: Ырыс алды — ынтымак (семья) · Алыскы туугандан жакынкы кошуна артык (соседи) · Өнөр алды — кызыл тил (искусство) · Жери байдын — эли бай (страна) · Дос балаада билинер (дружба) · Ата Мекен — алтын бешик (родина). Повтори их в карточках своих модулей.","A module topic sounds stronger with a proverb: Ырыс алды — ынтымак (family) · Алыскы туугандан жакынкы кошуна артык (neighbours) · Өнөр алды — кызыл тил (art) · Жери байдын — эли бай (country) · Дос балаада билинер (friendship) · Ата Мекен — алтын бешик (homeland). Revise them in their modules’ flashcards.","Modül konusu atasözüyle güçlenir: Ырыс алды — ынтымак (aile) · Алыскы туугандан жакынкы кошуна артык (komşular) · Өнөр алды — кызыл тил (sanat) · Жери байдын — эли бай (ülke) · Дос балаада билинер (dostluk) · Ата Мекен — алтын бешик (vatan). İlgili modüllerin kartlarında tekrar et."))));
  const dlg=[["А: — Кайсы форма кыйын болду?","А: — Какая форма оказалась трудной?","A: — Which form proved hard?","A: — Hangi biçim zor geldi?"],
             ["Б: — Кыйыр кеп: сөз өзгөрбөйт экен — «келем деп айтты». Эми түшүндүм!","Б: — Косвенная речь: цитата, оказывается, не меняется — «келем деп айтты». Теперь понял!","B: — Reported speech: the quote does not change — «келем деп айтты». Now I get it!","B: — Dolaylı anlatım: alıntı değişmiyormuş. Şimdi anladım!"]];
  weekDialog(m,"Диалог: «Даярдык»","Dialogue: «Даярдык»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) пройди сводный дрилл до ≥9/10; 3) выбери три темы модулей B1 и расскажи каждую на одну-две минуты — с макалом и двумя формами B1 на выбор; 4) слабые формы повтори на грамм-странице их модуля.","Tasks: 1) read the dialogue swapping roles; 2) do the round-up drill to ≥9/10; 3) pick three B1 module topics and tell each for one or two minutes — with a proverb and two B1 forms; 4) revise weak forms on their module’s grammar page.","Diyalog: “Даярдык”","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) özet alıştırmasını ≥9/10’a kadar yap; 3) üç B1 modül konusu seçip her birini bir iki dakika anlat — atasözü ve iki B1 biçimiyle; 4) zayıf biçimleri kendi modülünde tekrar et.");
}
