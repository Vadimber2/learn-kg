function renderGrammarM5(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Числительные: 1–1000","Numerals: 1–1000","Sayılar: 1–1000")),
    h("p",{class:"muted"},L("Числа складываются слева направо, без союзов: 234 = эки жүз отуз төрт.","Numbers stack left to right, no connectors: 234 = эки жүз отуз төрт.","Sayılar soldan sağa, bağlaçsız dizilir: 234 = эки жүз отуз төрт.")),
    harmonyTable(["1–5","6–10",L("десятки","tens","onluklar"),L("большие","big","büyük sayılar")],[
      [appendKids(h("span",{}),kgw("бир","m5_01"),", ",kgw("эки","m5_02"),", ",kgw("үч","m5_03"),", ",kgw("төрт","m5_04"),", ",kgw("беш","m5_05")),
       appendKids(h("span",{}),kgw("алты","m5_06"),", ",kgw("жети","m5_07"),", ",kgw("сегиз","m5_08"),", ",kgw("тогуз","m5_09"),", ",kgw("он","m5_10")),
       appendKids(h("span",{}),kgw("жыйырма","m5_11"),", ",kgw("отуз","m5_12"),", ",kgw("кырк","m5_13"),", ",kgw("элүү","m5_14"),"…"),
       appendKids(h("span",{}),kgw("жүз","m5_19"),", ",kgw("миң","m5_20"))]]),
    h("div",{class:"note"},L("Главное правило недели: после числительного существительное — в ЕДИНСТВЕННОМ числе: ","The key rule of the week: after a numeral the noun stays SINGULAR: ","Haftanın ana kuralı: sayıdan sonra isim TEKİL kalır: "),kgw("эки бала","m5_83"),", ",kgw("беш адам","m5_84"),L(" — не «эки балдар»! Порядковые: число + -(ы)нчы: "," — never «эки балдар»! Ordinals: numeral + -(ы)нчы: "," — asla “эки балдар” değil! Sıra sayıları: sayı + -(ы)нчы: "),kgw("биринчи","m5_24"),", ",kgw("үчүнчү","m5_26"),".")));
  m.append(h("div",{class:"card"},h("h2",{},L("Аорист — настоящее-будущее время","The aorist — present-future tense","Geniş zaman — şimdiki-gelecek")),
    h("p",{class:"muted"},L("Регулярное действие или будущее: основа + -а/-е/-о/-ө (после гласной -й) + личный аффикс.","Habitual action or future: stem + -а/-е/-о/-ө (after a vowel -й) + personal affix.","Düzenli iş ya da gelecek: gövde + -а/-е/-о/-ө (ünlüden sonra -й) + kişi eki.")),
    harmonyTable([L("Лицо","Person","Kişi"),"бар-","кел-","оку-","иште-"],[
      ["мен",[ "барам"],["келем"],["окуйм"],["иштейм"]],
      ["сен",["барасың"],["келесиң"],["окуйсуң"],["иштейсиң"]],
      ["сиз",["барасыз"],["келесиз"],["окуйсуз"],["иштейсиз"]],
      ["ал",["барат"],["келет"],["окуйт"],["иштейт"]],
      ["биз",["барабыз"],["келебиз"],["окуйбуз"],["иштейбиз"]]]),
    h("div",{class:"note"},L("Время «во сколько» — жатыш падеж: ","Clock time “at …” — the locative: ","“Saat kaçta?” sorusunun cevabı bulunma (catış) hâliyle verilir: "),kgw("Мен саат жетиде турам.","m5_92"),L(" Вопросы: "," Questions: "," Sorular: "),kgw("Саат канча?","m5_60"),L(" (который час?) · "," (what time is it?) · "," (saat kaç?) · "),kgw("Саат канчада?","m5_61"),L(" (во сколько?)"," (at what time?)"," (saat kaçta?)"))));
  const dlg=[["А: — Бүгүн кайсы күн?","А: — Какой сегодня день?","A: — What day is it today?","A: — Bugün günlerden ne?"],
             ["Б: — Бүгүн шаршемби, он бешинчи май.","Б: — Сегодня среда, 15 мая.","B: — Today is Wednesday, May 15.","B: — Bugün çarşamba, on beş mayıs."],
             ["А: — Сабак саат канчада башталат?","А: — Во сколько начинается урок?","A: — What time does the lesson start?","A: — Ders saat kaçta başlıyor?"],
             ["Б: — Саат тогузда башталат, түшкө чейин бүтөт.","Б: — Начинается в девять, заканчивается до полудня.","B: — It starts at nine and ends before noon.","B: — Saat dokuzda başlıyor, öğleden önce bitiyor."],
             ["А: — Сиз саат канчада турасыз?","А: — Во сколько Вы встаёте?","A: — What time do you get up?","A: — Siz saat kaçta kalkıyorsunuz?"],
             ["Б: — Мен саат жетиде турам, саат он бирде уктайм.","Б: — Встаю в семь, ложусь в одиннадцать.","B: — I get up at seven and go to bed at eleven.","B: — Saat yedide kalkıyorum, saat on birde uyuyorum."],
             ["А: — Туулган күнүңүз качан?","А: — Когда Ваш день рождения?","A: — When is your birthday?","A: — Doğum gününüz ne zaman?"],
             ["Б: — Жыйырма экинчи августта.","Б: — Двадцать второго августа.","B: — On August 22.","B: — Yirmi iki ağustosta."]];
  weekDialog(m,"Диалог: «Саат канчада?»","Dialogue: «Саат канчада?»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) запиши все числа из диалога прописью; 3) ответь на все вопросы СВОИМИ данными; 4) напиши свой распорядок с часами (методика §9, п. 8). После М5 — мок-экзамен № 1!","Tasks: 1) read the dialogue swapping roles; 2) write out every number in words; 3) answer all questions with YOUR OWN details; 4) write your daily schedule with clock times (methodology §9, item 8). After M5 — mock exam #1!","Diyalog: «Саат канчада?»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) diyalogdaki bütün sayıları yazıyla yaz; 3) bütün sorulara KENDİ bilgilerinle cevap ver; 4) kendi günlük düzenini saatleriyle yaz (metodoloji §9, madde 8). M5'ten sonra — 1 numaralı deneme sınavı!");
}
