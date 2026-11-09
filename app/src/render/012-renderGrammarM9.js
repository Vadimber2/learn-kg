function renderGrammarM9(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Сравнение: -ыраак и эң","Comparison: -ыраак and эң","Karşılaştırma: -ыраак ve эң")),
    h("p",{class:"muted"},L("Сравнительная степень — прилагательное + аффикс. Вариант аффикса выбирает последняя гласная слова; после гласной — без первой гласной аффикса:","The comparative is adjective + affix. The last vowel of the word picks the variant; after a vowel the affix drops its first vowel:","Üstünlük derecesi — sıfat + ek. Ekin biçimini kelimenin son ünlüsü seçer; ünlüden sonra ekin ilk ünlüsü düşer:")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Примеры","Examples","Örnekler")],[
      ["а, ы",h("b",{},"-ыраак"),appendKids(h("span",{}),kgw("арзаныраак","m9_58"),", ",kgw("кымбатыраак","m9_57"))],
      ["е, и",h("b",{},"-ирээк"),["бийигирээк","к → г"]],
      ["о, у",h("b",{},"-ураак"),appendKids(h("span",{}),kgw("чоңураак","m9_54"),", ",h("span",{class:"kgword"},"суугураак"),h("div",{class:"muted"},"к → г"))],
      ["ө, ү",h("b",{},"-үрөөк"),["көбүрөөк","п → б"]],
      [L("слово на гласную","vowel-final word","ünlüyle biten kelime"),h("b",{},"-раак/-рээк/-рөөк"),kgw("жакшыраак","m9_56")]]),
    harmonyTable([L("Прилагательное","Adjective","Sıfat"),L("Сравнительная","Comparative","Üstünlük derecesi"),L("Превосходная","Superlative","En üstünlük derecesi")],[
      ["чоң",["чоңураак"],[ "эң чоң"]],
      ["жакшы",["жакшыраак"],["эң жакшы"]],
      ["бийик",["бийигирээк","к → г!"],["эң бийик"]],
      ["кичине",["кичирээк",L("исключение","exception","istisna")],["эң кичине"]]]),
    h("div",{class:"note"},L("«Чем» выражается чыгыш падежом: ","“Than” is the ablative: ","“-den” karşılaştırması çıkma hâliyle yapılır: "),kgw("Бишкек Оштон чоң.","m9_61"),L(" — «Бишкек больше Оша»."," — “Bishkek is bigger than Osh.”"," — “Bişkek Oş'tan büyük”."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Мнение, оценка, «понравилось»","Opinion, assessment, “I liked it”","Görüş, değerlendirme, “hoşuma gitti”")),
    h("table",{},
      h("tr",{},h("td",{},kgw("менимче","m9_63")),h("td",{class:"muted"},L("по-моему","in my opinion","bence"))),
      h("tr",{},h("td",{},kgw("деп ойлойм","m9_64")),h("td",{class:"muted"},L("«думаю, что…» (после мысли)","“I think that…” (after the thought)","“… diye düşünüyorum” (düşünceden sonra)"))),
      h("tr",{},h("td",{},kgw("Мага музыка жагат.","m9_68")),h("td",{class:"muted"},L("мне нравится (сейчас, вообще)","I like (now, in general)","hoşuma gidiyor (şimdi, genel olarak)"))),
      h("tr",{},h("td",{},kgw("Мага жакты.","m9_66")),h("td",{class:"muted"},L("мне понравилось (прошедшее)","I liked it (past)","hoşuma gitti (geçmiş)"))),
      h("tr",{},h("td",{},kgw("Мага жаккан жок.","m9_67")),h("td",{class:"muted"},L("мне не понравилось","I didn’t like it","hoşuma gitmedi")))),
    h("div",{class:"note"},L("Отрицание прошедшего для рассказа: причастие -ган + жок: ","Past negation for narration: the -ган participle + жок: ","Anlatımda geçmiş zamanın olumsuzu: -ган sıfat-fiili + жок: "),kgw("барган жокмун","m9_78"),", ",kgw("көргөн жокмун","m9_79"),L(". Поздравления: [что] + кут болсун! (М0). Ввод новых слов курса завершается на этой неделе — дальше только повторение."," Greetings: [what] + кут болсун! (M0). New vocabulary ends this week — revision only from here."," Kutlamalar: [ne] + кут болсун! (M0). Kursun yeni kelime girişi bu haftayla biter — bundan sonrası yalnızca tekrardır."))));
  const dlg=[["А: — Кайда эс алдыңыз?","А: — Где Вы отдыхали?","A: — Where did you spend your holiday?","A: — Tatilinizi nerede geçirdiniz?"],
             ["Б: — Быйыл Ысык-Көлгө бардык.","Б: — В этом году мы ездили на Иссык-Куль.","B: — This year we went to Issyk-Kul.","B: — Bu yıl Issık Gölü'ne gittik."],
             ["А: — Саякат кандай өттү?","А: — Как прошла поездка?","A: — How was the trip?","A: — Seyahat nasıl geçti?"],
             ["Б: — Укмуш өттү! Күн ачык, көл абдан кооз.","Б: — Потрясающе! Солнечно, озеро очень красивое.","B: — Amazing! Sunny, and the lake is beautiful.","B: — Muhteşem geçti! Hava açıktı, göl çok güzel."],
             ["А: — Эмне кылдыңыздар?","А: — Что вы делали?","A: — What did you do?","A: — Neler yaptınız?"],
             ["Б: — Сууга түштүк, балык ууладык, кечинде комуз уктук.","Б: — Купались, рыбачили, вечером слушали комуз.","B: — We swam, fished, and listened to the komuz in the evening.","B: — Yüzdük, balık tuttuk, akşam komuz dinledik."],
             ["А: — Аба ырайы кандай болду?","А: — Какая была погода?","A: — How was the weather?","A: — Hava nasıldı?"],
             ["Б: — Күндүз ысык, кечинде салкын. Менимче, жай — эң жакшы мезгил!","Б: — Днём жарко, вечером прохладно. По-моему, лето — лучшее время!","B: — Hot by day, cool in the evening. In my opinion summer is the best season!","B: — Gündüz sıcak, akşam serin. Bence yaz en güzel mevsim!"]];
  weekDialog(m,"Диалог: «Саякат кандай өттү?»","Dialogue: «How was the trip?»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все глаголы прошедшего времени; 3) найди сравнение и мнение (менимче, эң); 4) расскажи про СВОЙ лучший отдых — устно и письменно (методика §9, п. 8).","Tasks: 1) read swapping roles; 2) list all past-tense verbs; 3) find the comparison and opinion (менимче, эң); 4) tell about YOUR OWN best holiday — orally and in writing (methodology §9, item 8).","Diyalog: «Саякат кандай өттү?»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün geçmiş zaman fiillerini yaz; 3) karşılaştırma ve görüş ifadelerini bul (менимче, эң); 4) EN GÜZEL tatilini anlat — sözlü ve yazılı (metodoloji §9, madde 8).");
}
