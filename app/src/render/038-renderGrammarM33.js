
function renderGrammarM33(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Пусть бы: -са экен","If only: -са экен","Keşke: -са экен")),
    h("p",{class:"muted"},L("Пожелание «пусть бы, хоть бы»: знакомое -са (М27) + экен. Отличие от условия: -са — «если», -са экен — мечта. Старинная книжная форма — -гай эле.","The wish “if only, may”: the familiar -са (M27) + экен. Unlike the condition: -са is “if”, -са экен is a heartfelt wish. The old literary form is -гай эле.","“Keşke” dileği: bildiğin -са (M27) + экен. Koşuldan farkı: -са “eğer”, -са экен içten dilek. Eski kitabî biçim -гай эле.")),
    harmonyTable([L("Пожелание","The wish","Dilek"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("мира","for peace","barış için"),"бол + -со экен",kgw("Тынчтык болсо экен.","m33_32")],
      [L("счастья детям","for the children","çocuklar için"),"бол + -со экен",kgw("Балдар бактылуу болсо экен.","m33_33")],
      [L("выздоровления","for recovery","şifa için"),"сакай + -са экен",kgw("Досум тез сакайса экен.","m33_36")],
      [L("книжное","literary","kitabî"),"бол + -гой эле",kgw("Элибиз ынтымактуу болгой эле.","m33_35")]]),
    h("div",{class:"note"},L("Вслух: ","Aloud: ","Sesli: "),kgw("Баарыңарга бакыт каалайм!","m33_37"))));
  m.append(h("div",{class:"card"},h("h2",{},L("То, что ты сделал: -ган","What you did: -ган","Yaptığın: -ган")),
    h("p",{class:"muted"},L("Причастие -ган (М24) с притяжанием — существительное «то, что…»: айтканың, кылганы, окуганым. Склоняется как имя. Так строятся самые короткие определения.","The -ган participle (M24) with a possessive is the noun “what one …”: айтканың, кылганы, окуганым. It declines like a noun. The shortest definitions are built this way.","-ган ortacı (M24) iyelikle “-dığın şey” adıdır: айтканың, кылганы, окуганым. Ad gibi çekimlenir.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("сказанное/сделанное","said/done","söylediğin/yaptığın"),"-ган + -ың",kgw("Айтканың — сөзүң, кылганың — ишиң.","m33_38")],
      [L("то, что говорит","what he says","söylediğini"),"-ган + -ын",kgw("Досумдун айтканын угам.","m33_40")],
      [L("того, кто делал","the one who did","yapanı"),"-ган + -ды",kgw("Жакшылык кылганды эл унутпайт.","m33_42")],
      [L("определение","a definition","tanım"),"болгон + -уң",kgw("Бакыт — сүйгөндөрүң менен болгонуң.","m33_05")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Макалдар: баалуулуктар","Proverbs: values","Atasözleri: değerler")),
    harmonyTable([L("Макал","Proverb","Atasözü"),L("Смысл","Meaning","Anlam")],[
      [kgw("Дос балаада билинер, баатыр талаада билинер.","m33_12"),L("друг познаётся в беде","a friend is known in trouble","dost belada belli olur")],
      [kgw("Ата Мекен — алтын бешик.","m33_20"),L("родина растит нас, как колыбель","the homeland raises us like a cradle","vatan beşik gibi büyütür")],
      [kgw("Жакшылык кыл да, сууга ташта.","m33_66"),L("делай добро, не жди награды","do good without expecting reward","karşılık bekleme")],
      [kgw("Ниети актын — жолу ачык.","m33_68"),L("чистым намерениям путь открыт","pure intentions find an open road","temiz niyete yol açık")]])));
  const dlg=[["А: — Сиз үчүн бакыт деген эмне?","А: — Что для Вас счастье?","A: — What is happiness for you?","A: — Sizin için mutluluk nedir?"],
             ["Б: — Менимче, бакыт — жөнөкөй нерселерде: үй-бүлөм аман болсо, мен бактылуумун.","Б: — По-моему, счастье — в простом: семья цела — и я счастлив.","B: — To my mind, happiness lies in simple things: if my family is well, I am happy.","B: — Bence mutluluk basit şeylerdedir: ailem iyiyse mutluyum."],
             ["А: — А чыныгы дос кандай болушу керек?","А: — А каким должен быть настоящий друг?","A: — And what should a true friend be like?","A: — Peki gerçek dost nasıl olmalı?"],
             ["Б: — Кубанычыңды да, кайгыңды да бөлүшкөн адам. Дос балаада билинер дешет го.","Б: — Тем, кто делит и радость, и горе. Друг ведь познаётся в беде.","B: — One who shares your joy and your sorrow. A friend is known in trouble, as they say.","B: — Sevincini de üzüntünü de paylaşan insan. Dost belada belli olur derler ya."],
             ["А: — Мекенди сүйүү эмнеден башталат деп ойлойсуз?","А: — С чего, по-вашему, начинается любовь к родине?","A: — Where do you think love for the homeland begins?","A: — Sizce vatan sevgisi nereden başlar?"],
             ["Б: — Эне тилден жана кичине иштерден. Тилегим — элимдин тынчтыгы!","Б: — С родного языка и малых дел. Моё желание — мир моему народу!","B: — With the mother tongue and small deeds. My wish is peace for my people!","B: — Ana dilden ve küçük işlerden. Dileğim halkımın huzurudur!"]];
  weekDialog(m,"Диалог: «Баалуулуктар»","Dialogue: «Баалуулуктар»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы «-са экен» и «-ган + притяжание», разбери состав; 3) расскажи «Бакыт деген эмне?» на 12–15 предложений — с определением через -ган и одним «-са экен»; 4) расскажи «Достук деген эмне?» — с макалом.","Tasks: 1) read the dialogue swapping roles; 2) write out the “-са экен” and possessive “-ган” forms and analyse them; 3) tell “Бакыт деген эмне?” in 12–15 sentences — with a -ган definition and one “-са экен”; 4) tell “Достук деген эмне?” — with the proverb.","Diyalog: “Баалуулуктар”","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) “-са экен” ve iyelikli “-ган” biçimlerini yazıp çözümle; 3) “Бакыт деген эмне?” konusunu 12–15 cümleyle anlat; 4) “Достук деген эмне?” konusunu atasözüyle anlat.");
}
