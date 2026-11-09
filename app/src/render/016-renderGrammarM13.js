function renderGrammarM13(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Желание: -гы келет","Desire: -гы келет","İstek: -гы келет")),
    h("p",{class:"muted"},L("«Хочется» мягче, чем «каалайм»: подлежащее встаёт в родительный, глагол берёт -гы + притяжательный аффикс, а келет остаётся неизменным.","“Feel like doing” is softer than «каалайм»: the subject takes the genitive, the verb takes -гы + a possessive affix, and келет stays fixed.","“İçinden gelmek” «каалайм»dan yumuşaktır: özne ilgi hâline geçer, fiil -гы + iyelik eki alır, келет değişmez.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы","-гы",kgw("баргым келет","m13_76")],
      ["е, и","-ги",kgw("билгим келет","m13_77")],
      ["о, у","-гу",kgw("окугубуз келет","m13_79")],
      ["ө, ү","-гү",kgw("көргүм келет","m13_81")]]),
    h("div",{class:"note"},L("Отрицание — келбейт: ","Negation — келбейт: ","Olumsuz — келбейт: "),kgw("көргүм келбейт","m13_80"),
      L(". Вопрос — келеби: болгуңуз келеби? «Хотелось раньше» — келчү (М12): дарыгер болгум келчү.",". Question — келеби: болгуңуз келеби? Past desire — келчү (M12): дарыгер болгум келчү.",". Soru — келеби: болгуңуз келеби? Geçmişte istek — келчү (M12): дарыгер болгум келчү."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Цель и необходимость: -ыш үчүн · -ышым керек","Purpose and necessity: -ыш үчүн · -ышым керек","Amaç ve gereklilik: -ыш үчүн · -ышым керек")),
    harmonyTable([L("Форма","Form","Biçim"),L("Как строится","How it is built","Nasıl kurulur"),L("Пример","Example","Örnek")],[
      [L("имя действия","action noun","eylem adı"),L("основа + -ыш/-иш/-уш/-үш (после гласной — просто -ш)","stem + -ыш/-иш/-уш/-үш (just -ш after a vowel)","kök + -ыш/-иш/-уш/-үш (ünlüden sonra yalnız -ш)"),["барыш · иштеш · көрүш"]],
      [L("цель («чтобы»)","purpose (“in order to”)","amaç (“için”)"),L("имя действия + үчүн","action noun + үчүн","eylem adı + үчүн"),kgw("иштеш үчүн","m13_82")],
      [L("надо (мне/тебе/…)","need (I/you/…)","gereklilik"),L("имя действия + притяжательный + керек","action noun + possessive + керек","eylem adı + iyelik + керек"),kgw("барышым керек","m13_87")]]),
    harmonyTable([L("Лицо","Person","Kişi"),"-гы келет","-ышым керек"],[
      ["мен(ин)",kgw("баргым келет","m13_76"),["барышым керек"]],
      ["сен(ин)",["баргың келет"],["барышың керек"]],
      ["сиз(дин)",["баргыңыз келет"],["барышыңыз керек"]],
      ["ал (анын)",["баргысы келет"],["барышы керек"]],
      ["биз(дин)",["баргыбыз келет"],["барышыбыз керек"]]]),
    h("div",{class:"note"},L("Отрицание — керек эмес: барышым керек эмес. С существительным — без -ыш: мага убакыт керек (М7). Три оттенка рядом: баргым келет (хочется) · барышым керек (надо) · барыш үчүн (чтобы пойти).","Negation — керек эмес: барышым керек эмес. With a noun — no -ыш: мага убакыт керек (M7). Three shades side by side: баргым келет (want) · барышым керек (need) · барыш үчүн (in order to go).","Olumsuz — керек эмес: барышым керек эмес. İsimle -ыш yok: мага убакыт керек (M7). Üç ton yan yana: баргым келет (istek) · барышым керек (gereklilik) · барыш үчүн (gitmek için)."))));
  const dlg=[["А: — Келиңиз, отуруңуз. Өзүңүз жөнүндө айтып бериңиз.","А: — Проходите, садитесь. Расскажите о себе.","A: — Come in, take a seat. Tell me about yourself.","A: — Buyurun, oturun. Kendinizden bahsedin."],
             ["Б: — Университетти эки жыл мурун бүтүргөнмүн, адистигим — эсепчи.","Б: — Я окончил университет два года назад, моя специальность — бухгалтер.","B: — I graduated two years ago; my speciality is accounting.","B: — Üniversiteyi iki yıl önce bitirdim, uzmanlığım muhasebe."],
             ["А: — Тажрыйбаңыз барбы?","А: — У Вас есть опыт?","A: — Do you have experience?","A: — Deneyiminiz var mı?"],
             ["Б: — Эки жылдык тажрыйбам бар. Азыр өнүккүм келет, ошондуктан сиздерге келдим.","Б: — У меня два года опыта. Сейчас хочу развиваться, поэтому пришёл к вам.","B: — I have two years of experience. Now I want to grow, which is why I came to you.","B: — İki yıllık deneyimim var. Şimdi gelişmek istiyorum, bu yüzden size geldim."],
             ["А: — Эмне үчүн дал ушул ишти тандадыңыз?","А: — Почему Вы выбрали именно эту работу?","A: — Why did you choose this very job?","A: — Neden tam da bu işi seçtiniz?"],
             ["Б: — Кесибим боюнча иштеш үчүн жана жаңы көндүмдөрдү алыш үчүн.","Б: — Чтобы работать по специальности и получить новые навыки.","B: — In order to work in my field and gain new skills.","B: — Mesleğime uygun çalışmak ve yeni beceriler edinmek için."],
             ["А: — Качан баштай аласыз?","А: — Когда можете начать?","A: — When can you start?","A: — Ne zaman başlayabilirsiniz?"],
             ["Б: — Эртеңден баштап иштей алам. Чакырганыңызга рахмат!","Б: — Могу с завтрашнего дня. Спасибо за приглашение!","B: — From tomorrow. Thank you for inviting me!","B: — Yarından itibaren başlayabilirim. Davetiniz için teşekkürler!"]];
  weekDialog(m,"Диалог: «Аңгемелешүү»","Dialogue: «Аңгемелешүү»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы на -гы келет, -ыш үчүн и -ышым керек; 3) ответь на вопросы собеседования СВОИМИ данными; 4) напиши 5 своих целей со словами «үчүн» и «керек» (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out the -гы келет, -ыш үчүн and -ышым керек forms; 3) answer the interview questions with YOUR OWN details; 4) write 5 of your goals using «үчүн» and «керек» (methodology §9, item 8).","Diyalog: «Аңгемелешүү»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -гы келет, -ыш үчүн ve -ышым керек biçimlerini yaz; 3) görüşme sorularına KENDİ bilgilerinle cevap ver; 4) «үчүн» ve «керек» ile 5 hedefini yaz (metodoloji §9, madde 8).");
}
