function renderGrammarM12(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Прошедшее на -ган: факты биографии","The -ган past: biography facts","-ган geçmişi: öz geçmiş olguları")),
    h("p",{class:"muted"},L("Рассказ о жизни держится на форме -ган: она подаёт событие как факт-итог («я родился, вырос, окончил»). Простое прошедшее -ды остаётся для увиденных событий: кечээ бардым.","A life story rests on the -ган form: it presents an event as a resulting fact (“I was born, grew up, graduated”). The simple past -ды stays for witnessed events: кечээ бардым.","Hayat hikâyesi -ган biçimine dayanır: olayı olgu-sonuç olarak sunar (“doğdum, büyüdüm, bitirdim”). Görülen geçmiş -ды tanık olunan olaylarda kalır: кечээ бардым.")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы, у","-ган",h("span",{},kgw("барган","m12_75")," · ",kgw("окуган","m12_77"))],
      ["е, и, э","-ген",kgw("келген","m12_76")],
      ["о","-гон",["болгон"]],
      ["ө, ү","-гөн",kgw("көргөн","m12_78")],
      [L("после глухих","after voiceless","tonsuzlardan sonra"),"-кан/-кен/-кон/-көн",kgw("айткан","m12_80")]]),
    h("div",{class:"note"},L("Отрицание — как учил М9: -ган + жок — ","Negation — as taught in M9: -ган + жок — ","Olumsuz — M9'da öğretildiği gibi: -ган + жок — "),
      kgw("көргөн жокмун","m9_79"),
      L(" («не видел»). Вопрос: форма + личный аффикс + -бы/-би: чоңойгонсузбу?"," (“has not seen”). Question: form + personal affix + -бы/-би: чоңойгонсузбу?"," (“görmemiş”). Soru: biçim + kişi eki + -бы/-би: чоңойгонсузбу?"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Привычное прошедшее -чу: «раньше обычно…»","The habitual past -чу: “used to…”","Alışkanlık geçmişi -чу: “eskiden …-erdi”")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),L("Аффикс","Affix","Ek"),L("Пример","Example","Örnek")],[
      ["а, ы, о, у","-чу",h("span",{},kgw("барчу","m12_81")," · ",kgw("ойночу","m12_83"))],
      ["е, и, ө, ү","-чү",h("span",{},kgw("келчү","m12_82")," · ",kgw("иштечү","m12_85"))]]),
    harmonyTable([L("Лицо","Person","Kişi"),"-ган","-чу"],[
      ["мен",["төрөлгөнмүн"],["ойночумун"]],
      ["сен",["төрөлгөнсүң"],["ойночусуң"]],
      ["сиз",["төрөлгөнсүз"],["ойночусуз"]],
      ["ал",["төрөлгөн"],["ойночу"]],
      ["биз",["төрөлгөнбүз"],["ойночубуз"]]]),
    h("div",{class:"note"},L("Личный аффикс — после формы; в 3-м лице обе формы без аффикса. Три прошедших рядом: кечээ бардым (видел сам, вчера) · илгери барчумун (ходил регулярно) · Ошко барганмын (факт биографии).","The personal affix follows the form; the 3rd person takes none. Three pasts side by side: кечээ бардым (witnessed, yesterday) · илгери барчумун (used to go) · Ошко барганмын (biography fact).","Kişi eki biçimden sonra gelir; 3. kişide ek yok. Üç geçmiş yan yana: кечээ бардым (tanık olunan, dün) · илгери барчумун (düzenli giderdi) · Ошко барганмын (öz geçmiş olgusu)."))));
  const dlg=[["А: — Кайда төрөлгөнсүз?","А: — Где Вы родились?","A: — Where were you born?","A: — Nerede doğdunuz?"],
             ["Б: — Мен айылда төрөлгөнмүн, Ошто чоңойгонмун.","Б: — Я родился в селе, вырос в Оше.","B: — I was born in a village and grew up in Osh.","B: — Köyde doğdum, Oş'ta büyüdüm."],
             ["А: — Балалыгыңыз кандай өткөн?","А: — Как прошло Ваше детство?","A: — What was your childhood like?","A: — Çocukluğunuz nasıl geçti?"],
             ["Б: — Жакшы өткөн. Жайында айылга барчубуз, чоң апам жомок айтып берчү.","Б: — Хорошо. Летом мы ездили в село, бабушка рассказывала сказки.","B: — It was good. In summer we used to go to the village, and grandma told fairy tales.","B: — İyi geçti. Yazın köye giderdik, babaannem masal anlatırdı."],
             ["А: — Мектепти качан бүтүргөнсүз?","А: — Когда Вы окончили школу?","A: — When did you finish school?","A: — Okulu ne zaman bitirdiniz?"],
             ["Б: — Эки миң сегизинчи жылы. Ошондон бери Бишкекте жашайм.","Б: — В 2008 году. С тех пор живу в Бишкеке.","B: — In 2008. I have lived in Bishkek since then.","B: — 2008 yılında. O zamandan beri Bişkek'te yaşıyorum."],
             ["А: — Бала кезиңизде ким болгуңуз келчү?","А: — Кем Вы хотели стать в детстве?","A: — What did you want to become as a child?","A: — Çocukken ne olmak isterdiniz?"],
             ["Б: — Дарыгер болгум келчү, азыр мугалим болуп иштейм.","Б: — Хотел стать врачом, а сейчас работаю учителем.","B: — I wanted to be a doctor, but now I work as a teacher.","B: — Doktor olmak isterdim, şimdi öğretmen olarak çalışıyorum."]];
  weekDialog(m,"Диалог: «Өмүр баян»","Dialogue: «Өмүр баян»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы на -ган и -чу и объясни выбор гласной; 3) ответь на все вопросы СВОИМИ данными; 4) напиши свою биографию — 8–10 предложений (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) write out every -ган and -чу form and explain the vowel choice; 3) answer all questions with YOUR OWN details; 4) write your life story — 8–10 sentences (methodology §9, item 8).","Diyalog: «Өмүр баян»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün -ган ve -чу biçimlerini yazıp ünlü seçimini açıkla; 3) bütün sorulara KENDİ bilgilerinle cevap ver; 4) kendi öz geçmişini yaz — 8–10 cümle (metodoloji §9, madde 8).");
}
