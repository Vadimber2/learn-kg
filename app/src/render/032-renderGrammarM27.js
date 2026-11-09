
function renderGrammarM27(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Если: эгер …-са","If: эгер …-са","Eğer: эгер …-са")),
    h("p",{class:"muted"},L("Шарттуу ыңгай — полное условие. В М24 вы видели его узкий случай («Кирсем болобу?»); теперь вся парадигма.","The conditional mood — the full condition. In M24 you saw its narrow case («Кирсем болобу?»); now the whole paradigm.","Şart kipi — tam koşul. M24’te dar hâlini gördünüz; şimdi tüm paradigma.")),
    harmonyTable([L("Кто","Who","Kim"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("я","I","ben"),"-са + -м",kgw("Эгер эрте жатсам, эрте турам.","m27_18")],
      [L("ты","you (informal)","sen"),"-са + -ң",kgw("Суу көп ичсең, денең таза болот.","m27_19")],
      [L("Вы","you (polite)","siz"),"-са + -ңыз",kgw("Эгер спорт менен машыксаңыз, ден соолугуңуз чың болот.","m27_17")],
      [L("мы","we","biz"),"-са + -к",kgw("Эгер чарчасак, эс алышыбыз керек.","m27_20")],
      [L("он/оно","he/it","o"),"-са",kgw("Ден соолук болсо, баары болот.","m27_52")]]),
    h("div",{class:"note"},L("«Даже если не» — -баса да: ","“Even if not” — -баса да: ","“Olmasa da” — -баса да: "),kgw("Оорубасаңыз да, дарыгерге текшерилип туруңуз.","m27_21"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Себеп жана натыйжа","Cause & effect","Sebep ve sonuç")),
    h("p",{class:"muted"},L("Рассуждение B1 держится на связках. Схема рассказа: тезис → себеби… → ошондуктан… → жыйынтыктап айтканда…","A B1 argument stands on connectors. The pattern: thesis → себеби… → ошондуктан… → жыйынтыктап айтканда…","B1 akıl yürütmesi bağlaçlara dayanır: tez → себеби… → ошондуктан… → жыйынтыктап айтканда…")),
    harmonyTable([L("Связка","Connector","Bağlaç"),L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      ["ошондуктан",L("поэтому","therefore","bu yüzden"),kgw("Спорт иммунитетти чыңдайт, ошондуктан оорубайм.","m27_23")],
      ["натыйжада",L("в результате","as a result","sonuç olarak"),kgw("Аз кыймылдайм, натыйжада тез чарчайм.","m27_27")],
      [L("анын үстүнө","анын үстүнө","анын үстүнө"),L("к тому же","moreover","üstelik"),kgw("Анын үстүнө таза аба маанайды жакшыртат.","m27_74")],
      [L("жыйынтыктап айтканда","жыйынтыктап айтканда","жыйынтыктап айтканда"),L("подводя итог","to sum up","özetle"),kgw("жыйынтыктап айтканда","m27_75")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Кеңеш берүү","Giving advice","Öğüt verme")),
    harmonyTable([L("Шаблон","Template","Kalıp"),L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      ["-саңыз жакшы болот",L("будет хорошо, если…","it would be good if…","…-sanız iyi olur"),kgw("Эрте жатсаңыз жакшы болот.","m27_32")],
      ["-ганыңыз оң",L("лучше вам…","you had better…","…-manız daha iyi"),kgw("Таттууну азайтканыңыз оң.","m27_34")],
      [L("кеңеш берем","кеңеш берем","кеңеш берем"),L("советую…","I advise…","öneririm"),kgw("Күнүнө көбүрөөк басууну кеңеш берем.","m27_33")],
      ["-беңиз",L("совет-запрет","advising prohibition","öğüt-yasak"),kgw("Ашыкча иштебеңиз — денеге зыян.","m27_76")]])));
  const dlg=[["А: — Тез эле чарчап калам. Эмне кылсам болот?","А: — Быстро устаю. Что мне делать?","A: — I tire quickly. What can I do?","A: — Çabuk yoruluyorum. Ne yapabilirim?"],
             ["Б: — Эгер күн сайын сейилдесеңиз, күчүңүз кайтат.","Б: — Если будете гулять каждый день, силы вернутся.","B: — If you walk every day, your strength will return.","B: — Her gün gezinirseniz gücünüz döner."],
             ["А: — Убактым аз. Ошондуктан үйдө эле отурам.","А: — Времени мало. Поэтому сижу дома.","A: — I have little time. Therefore I just sit at home.","A: — Vaktim az. Bu yüzden evde oturuyorum."],
             ["Б: — Он мүнөт да жетиштүү! Эртең мененки көнүгүүнү адат кылганыңыз оң.","Б: — Даже десяти минут достаточно! Лучше вам взять зарядку в привычку.","B: — Even ten minutes is enough! You had better make morning exercises a habit.","B: — On dakika bile yeter! Sabah jimnastiğini alışkanlık edinseniz iyi olur."],
             ["А: — Туура. Таттуунучу?","А: — Верно. А сладкое?","A: — True. And sweets?","A: — Doğru. Peki tatlı?"],
             ["Б: — Ченемден ашпаңыз. Ден соолук болсо, баары болот!","Б: — Не превышайте меру. Будет здоровье — будет всё!","B: — Do not exceed the measure. If there is health, there is everything!","B: — Ölçüyü aşmayın. Sağlık olursa her şey olur!"]];
  weekDialog(m,"Диалог: «Кеңеш»","Dialogue: «Кеңеш»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы -са и разбери личные окончания; 3) расскажи «Ден соолук — зор байлык» на 12–15 предложений по схеме тезис → себеби → ошондуктан → жыйынтыктап айтканда; 4) дай другу три совета о здоровье трёх разных шаблонов.","Tasks: 1) read the dialogue swapping roles; 2) write out all the -са forms and analyse the endings; 3) tell “Ден соолук — зор байлык” in 12–15 sentences following thesis → себеби → ошондуктан → жыйынтыктап айтканда; 4) give a friend three pieces of health advice with three different templates.","Diyalog: «Кеңеш»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) tüm -са biçimlerini yazıp ekleri çözümle; 3) “Ден соолук — зор байлык” konusunu 12–15 cümleyle anlat: tez → себеби → ошондуктан → жыйынтыктап айтканда; 4) arkadaşına üç farklı kalıpla üç sağlık öğüdü ver.");
}
