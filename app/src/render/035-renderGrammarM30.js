
function renderGrammarM30(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Кыйыр кеп: … деп","Reported speech: … деп","Dolaylı anlatım: … деп")),
    h("p",{class:"muted"},L("Чужие слова пересказываем через деп (М19) — и цитата сохраняет свою форму: лицо и время не меняются, в отличие от русского, где «Приду» превращается в «что придёт».","We report someone’s words with деп (M19) — and the quote keeps its form: person and tense do not shift as in English.","Başkasının sözünü деп (M19) ile aktarırız — alıntı biçimini korur: kişi ve zaman değişmez.")),
    harmonyTable([L("Что передаём","What we report","Ne aktarıyoruz"),L("Образец","Pattern","Kalıp"),L("Пример","Example","Örnek")],[
      [L("слова","a statement","söz"),"… деп айтты",kgw("Кошунам эртең келем деп айтты.","m30_34")],
      [L("вопрос","a question","soru"),"… деп сурады",kgw("Айылга качан барасың деп сурады.","m30_37")],
      [L("просьбу","a request","rica"),"… деп чакырды",kgw("Чоң атам келгиле деп чакырды.","m30_35")],
      [L("обещание","a promise","söz verme"),"… деп убада берди",kgw("Мэрия жолдор оңдолот деп убада берди.","m30_36")],
      [L("пожелание","a wish","dilek"),"-сын деп",kgw("Эне уулу жакшы окусун деп тилейт.","m30_40")]]),
    h("div",{class:"note"},L("Дейт = деп айтат: ","Дейт = деп айтат: ","Дейт = деп айтат: "),kgw("Атам шаарга көчпөйлү дейт.","m30_39"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Жасалууда: -ыл","Being done: -ыл","Edilgen: -ыл")),
    h("p",{class:"muted"},L("Страдательный залог -ыл/-ил/-ул/-үл (после гласной — -л): важно дело, а не кто его делает. Это язык городских новостей и объявлений. Отличие от -дыр (М29): кылдыруу — ты поручаешь, -ыл — исполнитель не назван.","The passive -ыл/-ил/-ул/-үл (just -л after a vowel): the deed matters, not the doer. It is the language of city news and notices. Unlike -дыр (M29): -дыр means you have it done, with -ыл the doer is unnamed.","Edilgen çatı -ыл/-ил/-ул/-үл (ünlüden sonra -л): iş önemli, yapan değil. Haber ve duyuru dilidir. -дыр’dan (M29) farkı: -дыр yaptırma, -ыл’da yapan söylenmez.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("строится","is being built","yapılıyor"),"кур + -ул",kgw("Жаңы мектеп курулуп жатат.","m30_41")],
      [L("отремонтирована","has been repaired","onarıldı"),"оңдо + -л",kgw("Жол оңдолду.","m30_42")],
      [L("подаётся","is supplied","veriliyor"),"бер + -ил",kgw("Айылга таза суу берилет.","m30_43")],
      [L("вывозится","is taken out","çıkarılır"),"чыгар + -ыл",kgw("Таштанды күн сайын чыгарылат.","m30_44")],
      [L("открывается","opens","açılır"),"ач + -ыл",kgw("Базар эрте ачылат.","m30_46")],
      [L("проложены","have been laid","yapıldı"),"сал + -ын",kgw("Жаңы жолдор салынды.","m30_45")]]),
    h("p",{class:"muted"},L("Основы на л берут -ын: сал → салынды, ал → алынган (иначе два л подряд).","Stems ending in л take -ын: сал → салынды, ал → алынган (avoiding double л).","л ile biten kökler -ын alır: сал → салынды, ал → алынган."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Шаар менен айыл: салыштыруу","City and village compared","Şehir ile köy: karşılaştırma")),
    harmonyTable([L("Шаар","The city","Şehir"),L("Айыл","The village","Köy")],[
      [kgw("Шаарда мүмкүнчүлүк көп: иш, окуу, маданият.","m30_05"),kgw("Айылда аба таза, жашылча өз бакчаңдан.","m30_24")],
      [kgw("Жол тыгынында көп убакыт кетет.","m30_14"),kgw("Айылда жашоо тынч, бирок иш аз.","m30_56")],
      [kgw("Шаарда адам көп, жер тар.","m30_16"),kgw("Айылда баары бири-бирин тааныйт.","m30_82")]]),
    h("div",{class:"note"},L("Макал: ","Proverb: ","Atasözü: "),kgw("Алыскы туугандан жакынкы кошуна артык.","m30_30"))));
  const dlg=[["А: — Сиз шаарда же айылда жашагыңыз келеби?","А: — Вы хотите жить в городе или в селе?","A: — Would you like to live in the city or in a village?","A: — Şehirde mi köyde mi yaşamak istersiniz?"],
             ["Б: — Шаарда: мүмкүнчүлүк көп. Бирок көйгөйлөрү да бар — тыгын, кымбатчылык.","Б: — В городе: много возможностей. Но есть и проблемы — пробки, дороговизна.","B: — In the city: it has many opportunities. But it has problems too — jams, high prices.","B: — Şehirde: imkân çok. Ama sorunları da var — sıkışıklık, pahalılık."],
             ["А: — Айылды сагынбайсызбы?","А: — По селу не скучаете?","A: — Do you not miss the village?","A: — Köyü özlemiyor musunuz?"],
             ["Б: — Сагынам! Жайында чоң атама барып, бакчаны сугарып, малга жардам берем.","Б: — Скучаю! Летом езжу к дедушке, поливаю огород, помогаю со скотом.","B: — I do! In summer I visit my grandfather, water the garden and help with the livestock.","B: — Özlerim! Yazın dedeme gidip bahçeyi sular, hayvanlara yardım ederim."],
             ["А: — Айылда кандай көйгөйлөр бар деп ойлойсуз?","А: — Какие проблемы, по-вашему, есть в селе?","A: — What problems do you think the village has?","A: — Sizce köyde ne gibi sorunlar var?"],
             ["Б: — Иш аз, ошондуктан жаштар шаарга кетип жатат дешет. Бирок айыл — элдин түп тамыры!","Б: — Работы мало, поэтому, говорят, молодёжь уезжает в город. Но село — корни народа!","B: — Little work, so they say the youth are leaving for the city. But the village is the people’s roots!","B: — İş az, o yüzden gençler şehre gidiyor diyorlar. Ama köy halkın köküdür!"]];
  weekDialog(m,"Диалог: «Шаар же айыл?»","Dialogue: «Шаар же айыл?»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы «… деп» и «-ыл», разбери состав; 3) расскажи «Шаар көйгөйлөрү» на 12–15 предложений — с двумя формами -ыл; 4) расскажи «Айылдагы жашоо-тиричилик» — с макалом и кыйыр кеп.","Tasks: 1) read the dialogue swapping roles; 2) write out the «… деп» and «-ыл» forms and analyse them; 3) tell “Шаар көйгөйлөрү” in 12–15 sentences — with two -ыл forms; 4) tell “Айылдагы жашоо-тиричилик” — with the proverb and reported speech.","Diyalog: “Шаар же айыл?”","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) «… деп» ve «-ыл» biçimlerini yazıp çözümle; 3) “Шаар көйгөйлөрү” konusunu 12–15 cümleyle anlat — iki -ыл biçimiyle; 4) “Айылдагы жашоо-тиричилик” konusunu anlat — atasözü ve dolaylı anlatımla.");
}
