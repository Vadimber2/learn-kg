
function renderGrammarM14(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Деепричастие -ып: действия цепочкой","The -ып converb: chaining actions","-ып ulacı: eylem zinciri")),
    h("p",{class:"muted"},L("Форма на -ып соединяет действия одного героя: сначала «сделав» первое, потом главное. Аффикс выбирается по гармонии; после гласной — просто -п.","The -ып form links one subject's actions: having done the first, then the main one. The affix follows vowel harmony; just -п after a vowel.","-ып biçimi aynı öznenin eylemlerini bağlar: önce ilkini “yapıp”, sonra ana eylem. Ek ünlü uyumuna göre seçilir; ünlüden sonra yalnız -п.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы","-ып",["барып · жазып"]],
      ["е, и, э","-ип",["келип · ичип"]],
      ["о, у","-уп",["болуп · туруп"]],
      ["ө, ү","-үп",["көрүп · күлүп"]],
      [L("гласная","vowel","ünlü"),"-п",["окуп · ойноп · иштеп"]]]),
    h("div",{class:"note"},L("Цепочка: ","Chain: ","Zincir: "),kgw("Тамак жасап, кино көрдүм.","m14_90"),
      L(" Отрицание — -бай/-бей: "," Negation — -бай/-бей: "," Olumsuz — -бай/-бей: "),kgw("Китепти окубай койдум.","m14_92"),
      L(" Знакомое «иштеп жатам» (М3) — та же форма + жатам."," The familiar «иштеп жатам» (M3) is the same form + жатам."," Bildiğin “иштеп жатам” (M3) aynı biçim + жатам."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Как часто? И как оценить","How often? And how to rate it","Ne sıklıkla? Ve nasıl değerlendirilir")),
    harmonyTable([L("Как часто?","How often?","Ne sıklıkla?"),L("Пример","Example","Örnek")],[
      [L("N раз в неделю / месяц / год","N times a week / month / year","haftada / ayda / yılda N kez"),kgw("Жумасына үч жолу спорт залына барам.","m14_12")],
      ["күн сайын · ар дайым",L("каждый день · всегда (М3)","every day · always (M3)","her gün · her zaman (M3)")],
      ["көбүнчө · тез-тез · кээде",L("чаще всего (М9) · часто · иногда (М3)","mostly (M9) · often · sometimes (M3)","çoğunlukla (M9) · sık sık · bazen (M3)")],
      ["сейрек · эч качан",L("редко (М9) · никогда + отрицание (М3)","rarely (M9) · never + negation (M3)","nadiren (M9) · hiçbir zaman + olumsuz (M3)")]]),
    harmonyTable([L("Оценка","Rating","Değerlendirme"),L("Пример","Example","Örnek")],[
      [L("понравилось (результат)","liked it (result)","hoşuma gitti (sonuç)"),kgw("жагып калды","m14_76")],
      [L("совсем нет","not at all","hiç değil"),kgw("Эч жакпады.","m14_77")],
      [L("моё мнение","my opinion","benim görüşüm"),kgw("Менин оюмча, бул эң мыкты тасма.","m14_73")]]),
    h("div",{class:"note"},L("Шкала впечатлений: эң сонун болду · таасирлүү · таң калыштуу · орточо · зериктирме. «Менин оюмча» = менимче (М9).","A scale of impressions: эң сонун болду · таасирлүү · таң калыштуу · орточо · зериктирме. «Менин оюмча» = менимче (M9).","İzlenim ölçeği: эң сонун болду · таасирлүү · таң калыштуу · орточо · зериктирме. “Менин оюмча” = менимче (M9)."))));
  const dlg=[["А: — Эртең бош убактың барбы?","А: — Ты завтра свободен?","A: — Are you free tomorrow?","A: — Yarın boş vaktin var mı?"],
             ["Б: — Ооба, эртең дем алыш күнү. Эмнени сунуш кыласың?","Б: — Да, завтра выходной. Что предлагаешь?","B: — Yes, tomorrow is a day off. What do you suggest?","B: — Evet, yarın tatil günü. Ne öneriyorsun?"],
             ["А: — Кинотеатрда жаңы тарыхый тасма жүрүп жатат. Бирге көрөбүзбү?","А: — В кинотеатре идёт новый исторический фильм. Посмотрим вместе?","A: — A new historical film is on at the cinema. Shall we watch it together?","A: — Sinemada yeni bir tarihî film oynuyor. Birlikte izleyelim mi?"],
             ["Б: — Кызыктуубу?","Б: — Он интересный?","B: — Is it interesting?","B: — İlginç mi?"],
             ["А: — Абдан кызыктуу дешет. Мага мындай тасмалар жагат.","А: — Говорят, очень интересный. Мне такие фильмы нравятся.","A: — They say it is very interesting. I like such films.","A: — Çok ilginç diyorlar. Ben böyle filmleri severim."],
             ["Б: — Сонун! Сеанс саат канчада башталат?","Б: — Здорово! Во сколько начинается сеанс?","B: — Great! What time does the show start?","B: — Harika! Seans saat kaçta başlıyor?"],
             ["А: — Жетиде башталат. Кинодон кийин кафеге кирип, чай ичебиз.","А: — В семь. После кино зайдём в кафе и выпьем чаю.","A: — At seven. After the film we will drop into a café and have tea.","A: — Yedide başlıyor. Sinemadan sonra kafeye girip çay içeriz."],
             ["Б: — Макул, жетиге чейин келем!","Б: — Хорошо, приду к семи!","B: — All right, I will come by seven!","B: — Tamam, yediye kadar gelirim!"]];
  weekDialog(m,"Диалог: «Чакыруу»","Dialogue: «Чакыруу»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы на -ып и объясни выбор варианта; 3) пригласи собеседника на фильм или концерт по образцу; 4) расскажи о своём хобби: что, как часто, почему нравится (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out all the -ып forms and explain the variant choice; 3) invite your partner to a film or concert following the model; 4) talk about your hobby: what, how often, why you like it (methodology §9, item 8).","Diyalog: «Чакыруу»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün -ып biçimlerini yaz ve seçimi açıkla; 3) arkadaşını örneğe göre bir filme veya konsere davet et; 4) hobin hakkında anlat: ne, ne sıklıkla, neden hoşuna gidiyor (metodoloji §9, madde 8).");
}
