
function renderGrammarM20(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Побуждение: -алы и -айын","The hortative: -алы and -айын","Çağrı kipi: -алы ve -айын")),
    h("p",{class:"muted"},L("«Давайте …!» зовёт к совместному действию и включает говорящего. Аффикс — по гармонии; после гласной — -йлы. «Давай-ка я сам» — -айын.","“Let's …!” calls to joint action and includes the speaker. The affix follows harmony; just -йлы after a vowel. “Let me do it myself” is -айын.","“Haydi …!” ortak eyleme çağırır ve konuşanı kapsar. Ek uyuma göre seçilir; ünlüden sonra -йлы. “Ben yapayım” — -айын.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Мы: -алы","We: -алы","Biz: -алы"),L("Я: -айын","I: -айын","Ben: -айын")],[
      ["а, ы",kgw("баралы","m20_65"),["барайын"]],
      ["е, и",["келели"],["келейин"]],
      ["о, у",["бололу"],["болоюн"]],
      ["ө, ү",kgw("көрөлү","m20_66"),["көрөйүн"]],
      [L("гласная","vowel","ünlü"),["баштайлы · ырдайлы"],["баштайын"]]]),
    h("div",{class:"note"},L("Примеры: ","Examples: ","Örnekler: "),kgw("Тойду баштайлы!","m20_67")," ",kgw("Сүрөткө түшөлү!","m20_68")," ",kgw("Мен тост айтайын.","m20_69"),
      L(" Не путай с повелительным (М8): барыңыз — «вы идите», баралы — «пойдёмте вместе»."," Do not confuse with the imperative (M8): барыңыз — “you go”, баралы — “let us go together”."," Emir kipiyle karıştırma (M8): барыңыз — “siz gidin”, баралы — “birlikte gidelim”."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Поздравления и благопожелания","Congratulations and good wishes","Kutlamalar ve dilekler")),
    harmonyTable([L("Формула","Template","Kalıp"),L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      ["… менен!",L("с …! (М0)","happy …! (M0)","… kutlu olsun! (M0)"),kgw("Майрамыңыздар менен!","m20_11")],
      ["… куттуу болсун!",L("пусть будет благословенным","may it be blessed","kutlu olsun"),kgw("Жаңы жашың куттуу болсун!","m20_63")],
      ["… каалайм!",L("желаю …","I wish you …","… dilerim"),kgw("Узун өмүр каалайм!","m20_59")],
      [L("бата","бата","бата"),L("благословение старших","the elders' blessing","büyüklerin duası"),kgw("ак бата берүү","m20_43")]]),
    h("div",{class:"note"},L("Усиление — чын жүрөктөн («от чистого сердца»): ","Emphasis — чын жүрөктөн (“from the bottom of the heart”): ","Vurgu — чын жүрөктөн (“yürekten”): "),kgw("Чын жүрөктөн куттуктайм!","m20_58"))));
  const dlg=[["А: — Кош келиңиздер! Төргө өтүңүздөр!","А: — Добро пожаловать! Проходите на почётное место!","A: — Welcome! Please take the seat of honour!","A: — Hoş geldiniz! Baş köşeye buyurun!"],
             ["Б: — Чакырганыңызга рахмат! Тоюңуздар куттуу болсун!","Б: — Спасибо за приглашение! Пусть ваш той будет благословенным!","B: — Thank you for inviting us! May your toi be blessed!","B: — Davetiniz için teşekkürler! Düğününüz kutlu olsun!"],
             ["А: — Дасторконго келиңиздер. Бешбармак даяр.","А: — Прошу к столу. Бешбармак готов.","A: — Come to the table. The beshbarmak is ready.","A: — Sofraya buyurun. Beşbarmak hazır."],
             ["Б: — Мен тост айтайын: жаш жубайларга бакыт каалайм!","Б: — Скажу-ка я тост: желаю счастья молодожёнам!","B: — Let me make a toast: I wish the newly-weds happiness!","B: — Ben bir konuşma yapayım: yeni evlilere mutluluk dilerim!"],
             ["А: — Рахмат! Эми бийлейли!","А: — Спасибо! А теперь давайте танцевать!","A: — Thank you! Now let us dance!","A: — Teşekkürler! Şimdi dans edelim!"],
             ["Б: — Сүрөткө түшөлү да!","Б: — И давайте сфотографируемся!","B: — And let us take a photo!","B: — Fotoğraf da çektirelim!"],
             ["А: — Албетте! Эстелик сүрөт болсун.","А: — Конечно! Пусть будет фото на память.","A: — Of course! Let it be a keepsake photo.","A: — Elbette! Hatıra fotoğrafı olsun."],
             ["Б: — Майрамыңар шаттыкка толсун!","Б: — Пусть ваш праздник наполнится радостью!","B: — May your feast be full of joy!","B: — Bayramınız sevinçle dolsun!"]];
  weekDialog(m,"Диалог: «Тойдо»","Dialogue: «Тойдо»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы на -алы/-айын; 3) поздравь друга тремя формулами (менен / куттуу болсун / каалайм); 4) расскажи о любимом празднике своей семьи (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out the -алы/-айын forms; 3) congratulate a friend with the three templates (менен / куттуу болсун / каалайм); 4) tell about your family's favourite holiday (methodology §9, item 8).","Diyalog: «Тойдо»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -алы/-айын biçimlerini yaz; 3) üç kalıpla bir arkadaşını kutla (менен / куттуу болсун / каалайм); 4) ailenin en sevdiği bayramı anlat (metodoloji §9, madde 8).");
}
