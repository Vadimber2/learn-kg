
function renderGrammarM16(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Сравнение: -ыраак и эң","Comparison: -ыраак and эң","Karşılaştırma: -ыраак ve эң")),
    h("p",{class:"muted"},L("Сравнительная степень — аффикс -ыраак по гармонии (после гласной — просто -раак); «чем» выражает исходный падеж -дан. Превосходная — слово эң.","The comparative is the -ыраак affix by harmony (just -раак after a vowel); “than” is the ablative -дан. The superlative is the word эң.","Karşılaştırma — uyuma göre -ыраак eki (ünlüden sonra yalnız -раак); “-den daha” çıkma hâliyle kurulur. En üstünlük — эң kelimesi.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы","-ыраак",["арзаныраак"]],
      ["е, и","-ирээк",kgw("бийигирээк","m16_65")],
      ["о, у","-ураак",kgw("чоңураак","m9_54")],
      ["ө, ү","-үрөөк",["көбүрөөк (п → б)"]],
      [L("гласная","vowel","ünlü"),"-раак",kgw("жылуураак","m16_64")]]),
    h("div",{class:"note"},L("«Чем» — исходный падеж (М9): ","“Than” — the ablative (M9): ","“-den daha” — çıkma hâli (M9): "),kgw("Бүгүн кечээгиден жылуураак.","m16_66"),
      L(" Превосходная — эң: "," Superlative — эң: "," En üstünlük — эң: "),kgw("Ысык-Көл — Кыргызстандагы эң чоң көл.","m16_67"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Предположение: -са керек","Probability: -са керек","Olasılık: -са керек")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("наверное, так","probably so","muhtemelen öyle"),"болсо керек",kgw("Азыр тоодо суук болсо керек.","m16_72")],
      [L("наверное, случится","will probably happen","muhtemelen olur"),L("основа + -са керек","stem + -са керек","kök + -са керек"),kgw("Эртең жамгыр жааса керек.","m16_71")],
      [L("догадка о собеседнике","a guess about the listener","muhataba dair tahmin"),"-саңыз керек",kgw("Чарчасаңыз керек.","m16_74")]]),
    h("div",{class:"note"},L("Это знакомое -са (М15) + керек. Не путай с необходимостью: барышым керек (М13) — «мне надо», барса керек — «наверное, пойдёт».","This is the familiar -са (M15) + керек. Do not confuse with necessity: барышым керек (M13) — “I need to”, барса керек — “he will probably go”.","Bu, bildiğin -са (M15) + керек. Zorunlulukla karıştırma: барышым керек (M13) — “gitmem gerek”, барса керек — “muhtemelen gider”."))));
  const dlg=[["А: — Дем алышта эмне кылабыз?","А: — Что будем делать в выходные?","A: — What shall we do at the weekend?","A: — Hafta sonu ne yapacağız?"],
             ["Б: — Жайлоого барсак кантет? Аба ырайы жакшы болсо керек.","Б: — Может, поедем на джайлоо? Погода, наверное, будет хорошая.","B: — How about going to the jailoo? The weather will probably be fine.","B: — Yaylaya gitsek nasıl olur? Hava muhtemelen güzel olur."],
             ["А: — Божомолдо эмне дешет?","А: — Что говорят в прогнозе?","A: — What does the forecast say?","A: — Tahminde ne diyorlar?"],
             ["Б: — Эртең күн ачык болот дешет, жыйырма беш градус.","Б: — Говорят, завтра будет ясно, двадцать пять градусов.","B: — They say it will be clear tomorrow, twenty-five degrees.","B: — Yarın hava açık olacakmış, yirmi beş derece."],
             ["А: — Анда палатка менен рюкзакты алып, эртең менен чыгабыз.","А: — Тогда берём палатку и рюкзак и выходим утром.","A: — Then we take the tent and the backpack and set off in the morning.","A: — O zaman çadırla sırt çantasını alıp sabah yola çıkarız."],
             ["Б: — Көл жакка барсак болобу? Ал жер жакыныраак.","Б: — А можно к озеру? Там ближе.","B: — May we go towards the lake? It is nearer.","B: — Göl tarafına gitsek olur mu? Orası daha yakın."],
             ["А: — Макул! Көлдө сүзүп, кечинде от жагып, эт бышырабыз.","А: — Хорошо! Поплаваем в озере, вечером разведём костёр и приготовим мясо.","A: — All right! We will swim in the lake, make a fire in the evening and cook meat.","A: — Tamam! Gölde yüzüp akşam ateş yakar, et pişiririz."],
             ["Б: — Сонун болот! Мен балык уулаганды да жакшы көрөм.","Б: — Будет здорово! Я ещё и рыбачить люблю.","B: — That will be great! I also love fishing.","B: — Harika olur! Ben balık tutmayı da severim."]];
  weekDialog(m,"Диалог: «Жайлоого сапар»","Dialogue: «Жайлоого сапар»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы на -ыраак и -са керек; 3) сравни два места Кыргызстана (какое выше, холоднее, красивее); 4) расскажи прогноз погоды на завтра (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out the -ыраак and -са керек forms; 3) compare two places in Kyrgyzstan (which is higher, colder, more beautiful); 4) give tomorrow's weather forecast (methodology §9, item 8).","Diyalog: «Жайлоого сапар»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -ыраак ve -са керек biçimlerini yaz; 3) Kırgızistan'ın iki yerini karşılaştır (hangisi daha yüksek, soğuk, güzel); 4) yarının hava tahminini anlat (metodoloji §9, madde 8).");
}
