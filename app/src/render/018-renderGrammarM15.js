
function renderGrammarM15(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Условие: -са","The condition: -са","Koşul: -са")),
    h("p",{class:"muted"},L("«Если …» — основа + -са/-се/-со/-сө по гармонии; личный аффикс встаёт ПОСЛЕ условного: барса-м, барса-ңыз. Условная часть обычно идёт первой.","“If …” — stem + -са/-се/-со/-сө by harmony; the person affix comes AFTER the conditional: барса-м, барса-ңыз. The condition usually comes first.","“Eğer …” — kök + uyuma göre -са/-се/-со/-сө; kişi eki koşul ekinden SONRA gelir: барса-м, барса-ңыз. Koşul cümlesi genelde baştadır.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы","-са",["барса · жазса"]],
      ["е, и","-се",["келсе · ичсе"]],
      ["о, у","-со",["болсо · окуса"]],
      ["ө, ү","-сө",["көрсө · күлсө"]]]),
    harmonyTable([L("Лицо","Person","Kişi"),"-са"],[
      ["мен",["барсам"]],
      ["сен",["барсаң"]],
      ["сиз",["барсаңыз"]],
      ["ал",["барса"]],
      ["биз",["барсак"]]]),
    h("div",{class:"note"},L("Отрицание — перед -са: тартпаса. Пример: ","Negation goes before -са: тартпаса. Example: ","Olumsuz -са önüne gelir: тартпаса. Örnek: "),kgw("Убакыт болсо, сейилдейм.","m15_61"),
      " ",kgw("Тамеки тартпасаңыз, тез айыгасыз.","m15_63"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Совет и разрешение: -са болот / болбойт","Advice and permission: -са болот / болбойт","Öğüt ve izin: -са болот / болбойт")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("можно (разрешение)","allowed (permission)","izin"),"-са болот",kgw("Спорт менен машыкса болот.","m15_68")],
      [L("нельзя (запрет)","not allowed (prohibition)","yasak"),"-са болбойт",kgw("Тамеки тартса болбойт.","m15_67")],
      [L("можно ли? (вопрос)","may I? (question)","izin sorusu"),"-са болобу?",kgw("Сураса болобу?","m15_71")],
      [L("кому нельзя — дательный","who — in the dative","kime — yönelme hâli"),L("Сизге … -са болбойт","Сизге … -са болбойт","Сизге … -са болбойт"),kgw("Сизге муздак суу ичсе болбойт.","m15_69")]]),
    h("div",{class:"note"},L("Вежливый совет — -саңыз болот: «Суу ичсеңиз болот». Рядом — знакомые «-ыш керек» (М13) для «надо» и повелительное «ичиңиз» (М8) для назначений врача.","Polite advice — -саңыз болот: «Суу ичсеңиз болот». Alongside: the familiar «-ыш керек» (M13) for “need to” and the imperative «ичиңиз» (M8) for prescriptions.","Kibar öğüt — -саңыз болот: «Суу ичсеңиз болот». Yanında: “gerek” için bildiğin «-ыш керек» (M13) ve doktor talimatları için emir kipi «ичиңиз» (M8)."))));
  const dlg=[["А: — Кириңиз, отуруңуз. Эмнеңиз ооруйт?","А: — Заходите, садитесь. Что у Вас болит?","A: — Come in, take a seat. What hurts?","A: — Girin, oturun. Neyiniz ağrıyor?"],
             ["Б: — Эки күндөн бери башым ооруп жатат, ысытмам да бар.","Б: — Уже два дня болит голова, и температура есть.","B: — My head has been aching for two days, and I have a fever too.","B: — İki gündür başım ağrıyor, ateşim de var."],
             ["А: — Азыр текшерем. Оозуңузду ачыңыз… Тумоо экен.","А: — Сейчас осмотрю. Откройте рот… Это грипп.","A: — Let me examine you. Open your mouth… It is the flu.","A: — Şimdi muayene edeyim. Ağzınızı açın… Gripmiş."],
             ["Б: — Эмне кылышым керек?","Б: — Что мне нужно делать?","B: — What do I need to do?","B: — Ne yapmam gerek?"],
             ["А: — Бул дарыны күнүнө үч жолу тамактан кийин ичиңиз. Суу көп ичсеңиз болот.","А: — Принимайте это лекарство три раза в день после еды. Можно пить побольше воды.","A: — Take this medicine three times a day after meals. You may drink plenty of water.","A: — Bu ilacı günde üç kez yemekten sonra alın. Bol su içebilirsiniz."],
             ["Б: — Спорт менен машыкса болобу?","Б: — А спортом заниматься можно?","B: — May I do sport?","B: — Spor yapabilir miyim?"],
             ["А: — Азырынча болбойт. Айыксаңыз, машыгыңыз.","А: — Пока нельзя. Выздоровеете — тренируйтесь.","A: — Not yet. Once you recover, go ahead.","A: — Şimdilik olmaz. İyileşirseniz yapın."],
             ["Б: — Түшүндүм, рахмат!","Б: — Понял, спасибо!","B: — I see, thank you!","B: — Anladım, teşekkürler!"]];
  weekDialog(m,"Диалог: «Дарыгерде»","Dialogue: «Дарыгерде»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы на -са и объясни их; 3) составь 5 советов о здоровье со словами «болот/болбойт»; 4) расскажи о своём режиме дня: сон, еда, спорт (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out all the -са forms and explain them; 3) make 5 health tips with «болот/болбойт»; 4) describe your daily routine: sleep, food, sport (methodology §9, item 8).","Diyalog: «Дарыгерде»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün -са biçimlerini yaz ve açıkla; 3) «болот/болбойт» ile 5 sağlık öğüdü yaz; 4) günlük düzenini anlat: uyku, yemek, spor (metodoloji §9, madde 8).");
}
