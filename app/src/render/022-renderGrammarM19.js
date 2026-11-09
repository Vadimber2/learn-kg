
function renderGrammarM19(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Косвенная речь: деп","Reported speech: деп","Dolaylı anlatım: деп")),
    h("p",{class:"muted"},L("деп — это де- («сказать») + деепричастие -п (М14), буквально «говоря». Чужие слова НЕ меняются: цитата + деп + глагол речи или действия.","деп is де- (“say”) + the -п converb (M14), literally “saying”. The quoted words do NOT change: quote + деп + a verb of speech or action.","деп = де- (“demek”) + -п ulacı (M14), yani “diyerek”. Alıntı DEĞİŞMEZ: alıntı + деп + konuşma ya da eylem fiili.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("он сказал, что …","he said that …","… dedi"),L("«…» + деп айтты","“…” + деп айтты","“…” + деп айтты"),kgw("Администратор эртең бошойт деп айтты.","m19_63")],
      [L("говорят, что …","they say that …","… diyorlar"),L("«…» + дешет","“…” + дешет","“…” + дешет"),kgw("Бул мейманкана жакшы дешет.","m19_65")],
      [L("обещание","a promise","söz"),L("«…» + деп убада берүү","“…” + деп убада берүү","“…” + деп убада берүү"),kgw("Мен келем деп убада бердим.","m19_66")],
      [L("с любым действием","with any action","her eylemle"),L("«…» + деп + глагол","“…” + деп + verb","“…” + деп + fiil"),kgw("Тамак даяр деп чакырышты.","m19_64")]]),
    h("div",{class:"note"},L("Знакомое деп ойлойм (М9) — тот же узор: «кызыктуу деп ойлойм». Вопрос «как сказать по-кыргызски?» — кыргызча кантип дейт?","The familiar деп ойлойм (M9) is the same pattern: «кызыктуу деп ойлойм». “How do you say it in Kyrgyz?” — кыргызча кантип дейт?","Bildiğin деп ойлойм (M9) aynı kalıp: «кызыктуу деп ойлойм». “Kırgızca nasıl denir?” — кыргызча кантип дейт?"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Просьбы: -ып бер- и -ып кой-","Requests: -ып бер- and -ып кой-","Ricalar: -ып бер- ve -ып кой-")),
    harmonyTable([L("Оттенок","Nuance","Nüans"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("сделать для другого","do it for someone","başkası için yapmak"),"-ып бер-",kgw("Которуп бересизби?","m19_69")],
      [L("заранее / окончательно","in advance / for good","önceden / kesin"),"-ып кой-",kgw("Эшикти ачып коюңузчу.","m19_71")],
      [L("вежливое смягчение","polite softener","kibar yumuşatma"),L("-чы/-чу (М8)","-чы/-чу (M8)","-чы/-чу (M8)"),kgw("Тезирээк оңдоп бериңизчи.","m19_72")],
      [L("услуга гостю","a service for the guest","misafire hizmet"),"-ып беребиз",kgw("Дароо алмаштырып беребиз.","m19_18")]]),
    h("div",{class:"note"},L("Оба вспомогательных глагола стоят после деепричастия -ып (М14). Сравни: жазам — пишу · жазып берем — запишу для тебя · жазып коём — запишу (чтобы не забыть).","Both auxiliaries follow the -ып converb (M14). Compare: жазам — I write · жазып берем — I will write it for you · жазып коём — I will jot it down (so as not to forget).","İki yardımcı fiil de -ып ulacından sonra gelir (M14). Karşılaştır: жазам — yazarım · жазып берем — senin için yazarım · жазып коём — not ederim (unutmamak için)."))));
  const dlg=[["А: — Саламатсызбы! Эки кишилик бөлмө барбы?","А: — Здравствуйте! Есть двухместный номер?","A: — Hello! Do you have a double room?","A: — Merhaba! İki kişilik oda var mı?"],
             ["Б: — Бар. Канча түнгө токтойсуздар?","Б: — Есть. На сколько ночей остановитесь?","B: — We do. How many nights will you stay?","B: — Var. Kaç gece kalacaksınız?"],
             ["А: — Үч түнгө. Эртең мененки тамак киреби?","А: — На три ночи. Завтрак включён?","A: — Three nights. Is breakfast included?","A: — Üç gece. Kahvaltı dâhil mi?"],
             ["Б: — Кирет. Бир түнү эки миң сом болот.","Б: — Включён. Одна ночь — две тысячи сомов.","B: — It is. One night is two thousand soms.","B: — Dâhil. Bir gece iki bin som."],
             ["А: — Жакшы. Терезеси көлдү караган бөлмө барбы?","А: — Хорошо. Есть номер с окнами на озеро?","A: — Good. Is there a room whose windows face the lake?","A: — İyi. Penceresi göle bakan oda var mı?"],
             ["Б: — Бар, бирок кошумча акы төлөнөт. Паспортуңузду калтырыңыз.","Б: — Есть, но за доплату. Оставьте паспорт.","B: — There is, but for an extra charge. Please leave your passport.","B: — Var ama ek ücretli. Pasaportunuzu bırakın."],
             ["А: — Мына. Эртең саат жетиде ойготуп коёсузбу?","А: — Вот. Разбудите завтра в семь?","A: — Here. Will you wake us at seven tomorrow?","A: — Buyurun. Yarın yedide uyandırır mısınız?"],
             ["Б: — Албетте. Мына ачкычыңыз, төртүнчү кабат. Жакшы эс алыңыздар!","Б: — Конечно. Вот ключ, четвёртый этаж. Хорошего отдыха!","B: — Of course. Here is your key, fourth floor. Have a good rest!","B: — Elbette. İşte anahtarınız, dördüncü kat. İyi dinlenmeler!"]];
  weekDialog(m,"Диалог: «Мейманканада»","Dialogue: «Мейманканада»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) найди просьбы с -ып бер-/-ып кой- и объясни оттенок; 3) пожалуйся на проблему в номере тремя фразами; 4) перескажи слова администратора через деп (методика §9, п. 8).","Tasks: 1) read the dialogue swapping roles; 2) find the -ып бер-/-ып кой- requests and explain the nuance; 3) complain about a room problem in three phrases; 4) report the receptionist's words with деп (methodology §9, item 8).","Diyalog: «Мейманканада»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -ып бер-/-ып кой- ricalarını bul ve nüansı açıkla; 3) odadaki bir sorunu üç cümleyle şikâyet et; 4) resepsiyonistin sözlerini деп ile aktar (metodoloji §9, madde 8).");
}
