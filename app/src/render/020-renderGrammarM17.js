
function renderGrammarM17(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Порядковые и дробные: -ынчы, жарым, пайыз","Ordinals and fractions: -ынчы, жарым, пайыз","Sıra ve kesir sayıları: -ынчы, жарым, пайыз")),
    h("p",{class:"muted"},L("Порядковое числительное — число + -ынчы по гармонии (после гласной — -нчы). В составных числах аффикс берёт только последнее слово.","An ordinal is the number + -ынчы by harmony (just -нчы after a vowel). In compound numbers only the last word takes the affix.","Sıra sayısı — sayı + uyuma göre -ынчы (ünlüden sonra -нчы). Bileşik sayılarda eki yalnız son kelime alır.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы","-ынчы",["алтынчы (после гласной — -нчы)"]],
      ["е, и","-инчи",kgw("биринчи","m5_24")],
      ["о, у","-унчу",["онунчу"]],
      ["ө, ү","-үнчү",kgw("үчүнчү","m5_26")]]),
    h("div",{class:"note"},L("Составные: ","Compounds: ","Bileşikler: "),kgw("он биринчи","m17_62"),
      L(". Дроби: жарым (М5) · ",". Fractions: жарым (M5) · ",". Kesirler: жарым (M5) · "),kgw("чейрек","m17_63")," · ",kgw("он пайыз","m17_64")," · ",kgw("үчтөн бири","m17_66"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Оплата, обмен, торг","Payment, exchange, bargaining","Ödeme, bozdurma, pazarlık")),
    harmonyTable([L("Ситуация","Situation","Durum"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("оплата картой/наличными","paying by card/cash","kartla/nakit ödeme"),L("карта менен / накталай + төлөө","карта менен / накталай + төлөө","карта менен / накталай + төлөө"),kgw("Карта менен төлөсөм болобу?","m17_05")],
      [L("обмен валюты","currency exchange","döviz bozdurma"),L("…ды …га алмаштыруу","…ды …га алмаштыруу","…ды …га алмаштыруу"),kgw("Долларды сомго алмаштырам.","m17_17")],
      [L("просьба для себя","request for oneself","kendin için rica"),"-ып бер-",kgw("Баасын түшүрүп бериңизчи.","m17_71")],
      [L("торг","bargaining","pazarlık"),"-са болобу? (М15)",kgw("Арзандатса болобу?","m17_69")]]),
    h("div",{class:"note"},L("«Не хватает» — жетпейт: ","“Not enough” — жетпейт: ","“Yetmiyor” — жетпейт: "),kgw("Акчам жетпейт.","m17_15"),
      L(" Скидки: "," Discounts: "," İndirimler: "),kgw("Акциядагы товарлар арзаныраак.","m17_72"))));
  const dlg=[["А: — Бул калпак канча турат?","А: — Сколько стоит этот калпак?","A: — How much is this kalpak?","A: — Bu kalpak ne kadar?"],
             ["Б: — Сегиз жүз сом. Кол менен жасалган.","Б: — Восемьсот сомов. Ручная работа.","B: — Eight hundred soms. Handmade.","B: — Sekiz yüz som. El yapımı."],
             ["А: — Кымбат экен. Арзандатса болобу?","А: — Дороговато. Можно подешевле?","A: — A bit expensive. Can you make it cheaper?","A: — Pahalıymış. Biraz indirir misiniz?"],
             ["Б: — Канча бересиз?","Б: — Сколько дадите?","B: — How much will you give?","B: — Ne kadar verirsiniz?"],
             ["А: — Алты жүз сомго алам.","А: — Возьму за шестьсот.","A: — I will take it for six hundred.","A: — Altı yüz soma alırım."],
             ["Б: — Макул, жети жүз сомго болот. Сапаты жакшы, таза жүн.","Б: — Ладно, за семьсот отдам. Качество хорошее, чистая шерсть.","B: — All right, seven hundred. Good quality, pure wool.","B: — Tamam, yedi yüz soma olur. Kalitesi iyi, saf yün."],
             ["А: — Болуптур. Карта менен төлөсөм болобу?","А: — Договорились. Можно картой?","A: — Deal. May I pay by card?","A: — Anlaştık. Kartla ödeyebilir miyim?"],
             ["Б: — Кечиресиз, накталай гана. Банкомат тигинде.","Б: — Извините, только наличные. Банкомат вон там.","B: — Sorry, cash only. The ATM is over there.","B: — Kusura bakmayın, yalnız nakit. ATM şurada."]];
  weekDialog(m,"Диалог: «Базарда»","Dialogue: «Базарда»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши числительные и превратись их в порядковые; 3) разыграй торг о другой вещи (чапан, өтүк); 4) посчитай свои расходы за неделю по-кыргызски (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out the numerals and turn them into ordinals; 3) act out bargaining over another item (чапан, өтүк); 4) count your weekly expenses in Kyrgyz (methodology §9, item 8).","Diyalog: «Базарда»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) sayıları yazıp sıra sayısına çevir; 3) başka bir eşya için pazarlık canlandır (чапан, өтүк); 4) haftalık masraflarını Kırgızca say (metodoloji §9, madde 8).");
}
