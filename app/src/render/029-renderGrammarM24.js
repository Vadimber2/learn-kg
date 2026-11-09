
function renderGrammarM24(m){
  m.append(h("div",{class:"card"},h("h2",{},L("B1: задания — по-кыргызски","B1: tasks are in Kyrgyz","B1: görevler Kırgızca")),
    h("p",{class:"muted"},L("С этого модуля формулировки заданий даются на кыргызском (перевод открывается по клику). Новые слова вводятся кыргызской дефиницией через уже выученное; перевод и разбор незнакомого слова — по клику.","From this module on, task wording is in Kyrgyz (tap to see the translation). New words are introduced by a Kyrgyz definition built from what you already know; tap for the translation or an unfamiliar word.","Bu modülden itibaren görev ifadeleri Kırgızcadır (çeviri tıklamayla açılır). Yeni kelimeler öğrendiklerinizden kurulan Kırgızca tanımla verilir; çeviri ve bilinmeyen kelime tıklamayla.")),
    harmonyTable([L("Задание","Task","Görev"),L("Что делать","What to do","Ne yapmalı")],[
      [kgw("Туура жоопту белгилеңиз.","m24_01"),L("отметьте правильный ответ","mark the correct answer","doğru cevabı işaretleyin")],
      [kgw("Сүйлөмдү толуктаңыз.","m24_02"),L("дополните предложение","complete the sentence","cümleyi tamamlayın")],
      [kgw("Аудиону угуп, түшүнгөнүңүздү айтып бериңиз.","m24_04"),L("прослушайте и перескажите","listen and retell","dinleyip anlatın")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Надо: -ыш керек","Necessity: -ыш керек","Gereklilik: -ыш керек")),
    h("p",{class:"muted"},L("Уровень B1 включает модальность: возможность, необходимость, невозможность. «Надо» строится так: основа + -ыш/-иш/-уш/-үш + притяжание + керек.","Level B1 includes modality: possibility, necessity, impossibility. “Must” is built as stem + -ыш/-иш/-уш/-үш + possessive + керек.","B1 düzeyi kiplik içerir: olanak, gereklilik, olanaksızlık. “Gerek” şöyle kurulur: kök + -ыш/-иш/-уш/-үш + iyelik + керек.")),
    harmonyTable([L("Кто","Who","Kim"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("мен","I","ben"),"-ыш + -ым керек",kgw("Отчётту бүгүн бүтүрүшүм керек.","m24_52")],
      [L("Сиз","you (polite)","siz"),"-ыш + -ыңыз керек",kgw("Сиз арызга кол коюшуңуз керек.","m24_53")],
      [L("биз","we","biz"),"-ыш + -ыбыз керек",kgw("Эртең эрте келишибиз керек.","m24_55")],
      [L("не нужно","no need","gerek yok"),"…-нын кереги жок",kgw("Шашуунун кереги жок.","m24_56")]]),
    h("div",{class:"note"},L("«Зарыл» = сөзсүз керек: документ зарыл — документ обязательно нужен.","«Зарыл» = absolutely necessary: документ зарыл — the document is a must.","«Зарыл» = mutlaka gerekli: документ зарыл — belge şart."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Можно и нельзя: -са болот / -ууга болбойт","May and may not: -са болот / -ууга болбойт","İzin ve yasak: -са болот / -ууга болбойт")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("попросить разрешения","ask permission","izin istemek"),"-сам болобу?",kgw("Кирсем болобу?","m24_59")],
      [L("разрешить","give permission","izin vermek"),"-саңыз болот",kgw("Документти алып кетсеңиз болот.","m24_62")],
      [L("запретить","prohibit","yasaklamak"),L("имя действия + -га болбойт","verbal noun + -га болбойт","isim-fiil + -га болбойт"),kgw("Кечигүүгө болбойт.","m24_64")]]),
    h("div",{class:"note"},L("Вежливый вход в любую просьбу на работе: Суроо берсем болобу? Кирсем болобу?","The polite opener for any request at work: Суроо берсем болобу? Кирсем болобу?","İşte her ricanın kibar girişi: Суроо берсем болобу? Кирсем болобу?"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Порядок дел: -гандан кийин / -ганга чейин","Work order: -гандан кийин / -ганга чейин","İş sırası: -гандан кийин / -ганга чейин")),
    h("p",{class:"muted"},L("Причастие -ган (М12) с послелогами строит последовательность дел — основу любого рассказа о работе.","The -ган participle (M12) with postpositions builds a sequence of actions — the backbone of any story about work.","-ган ortacı (M12) edatlarla iş sırasını kurar — iş anlatısının omurgası.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("после того как","after doing","-dikten sonra"),"-гандан кийин",kgw("Отчётту жибергенден кийин эс алсам болот.","m24_66")],
      [L("до того как","before doing","-e kadar"),"-ганга чейин",kgw("Жетекчи келгенге чейин баары даяр болушу керек.","m24_67")],
      [L("сначала … потом","first … then","önce … sonra"),L("адегенде … анан","адегенде … анан","адегенде … анан"),kgw("Кол койгонго чейин документти окуп чыгыңыз.","m24_69")]]),
    h("div",{class:"note"},L("Сингармонизм меняет гласную суффикса: бүтүргөндөн кийин (ү-ряд), койгонго чейин (о-ряд).","Vowel harmony shifts the suffix vowel: бүтүргөндөн кийин (ү-row), койгонго чейин (о-row).","Ünlü uyumu ekin ünlüsünü değiştirir: бүтүргөндөн кийин (ү-sırası), койгонго чейин (о-sırası)."))));
  const dlg=[["А: — Кирсем болобу?","А: — Можно войти?","A: — May I come in?","A: — Girebilir miyim?"],
             ["Б: — Кириңиз, болот. Кандай маселе менен келдиңиз?","Б: — Входите, можно. С каким вопросом пришли?","B: — Come in. What matter brings you here?","B: — Girin. Hangi konuyla geldiniz?"],
             ["А: — Арыз жазышым керек. Кимге кайрылсам болот?","А: — Мне нужно написать заявление. К кому можно обратиться?","A: — I need to write an application. Whom may I address?","A: — Dilekçe yazmam gerek. Kime başvurabilirim?"],
             ["Б: — Адегенде катчыга барыңыз. Ал арызды кабыл алат.","Б: — Сначала идите к секретарю. Он примет заявление.","B: — First go to the secretary. They will receive the application.","B: — Önce sekretere gidin. Dilekçeyi o kabul eder."],
             ["А: — Жооп качан болот?","А: — Когда будет ответ?","A: — When will there be an answer?","A: — Cevap ne zaman olur?"],
             ["Б: — Жетекчи кол койгондон кийин билдиребиз. Кечиктирүүгө болбойт — эрежебиз ушундай.","Б: — Сообщим после подписи руководителя. Задерживать нельзя — таково наше правило.","B: — We will inform you once the manager has signed. Delays are not allowed — that is our rule.","B: — Yönetici imzaladıktan sonra bildiririz. Geciktirmek olmaz — kuralımız böyle."]];
  weekDialog(m,"Диалог: «Кабылдамада»","Dialogue: «Кабылдамада»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы -ыш керек и разбери притяжание; 3) расскажи «Биздин мекеме» и «Кызматтык милдеттерим» на 12–15 предложений; 4) составь список своих дел на завтра с «адегенде … анан …».","Tasks: 1) read the dialogue swapping roles; 2) write out the -ыш керек forms and analyse the possessives; 3) tell “Биздин мекеме” and “Кызматтык милдеттерим” in 12–15 sentences; 4) draw up tomorrow’s task list with «адегенде … анан …».","Diyalog: «Кабылдамада»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -ыш керек biçimlerini yazıp iyelikleri çözümle; 3) “Биздин мекеме” ve “Кызматтык милдеттерим” konularını 12–15 cümleyle anlat; 4) «адегенде … анан …» ile yarının iş listesini yaz.");
}
