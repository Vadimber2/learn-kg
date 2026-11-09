
function renderGrammarM28(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Пока не: -майынча","Until: -майынча","-madıkça: -майынча")),
    h("p",{class:"muted"},L("Составное деепричастие: «пока не сделаешь X — не будет Y». Главное предложение почти всегда отрицательное.","The compound converb: “until you do X, Y will not happen”. The main clause is almost always negative.","Bileşik ulaç: “X yapılmadıkça Y olmaz”. Ana cümle hemen her zaman olumsuzdur.")),
    harmonyTable([L("Ряд","Row","Sıra"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("а-ряд","а-row","а-sırası"),"-майынча",kgw("Көп окумайынча, көп билбейсиң.","m28_21")],
      [L("ү-ряд","ү-row","ү-sırası"),"-мөйүнчө",kgw("Тил үйрөнмөйүнчө, элди түшүнбөйсүң.","m28_20")],
      [L("е/и-ряд","е/и-row","е/и-sırası"),"-мейинче",kgw("Суроо бермейинче, жооп укпайсың.","m28_23")],
      [L("вывод модуля","the module’s motto","modülün özü"),"-мөйүнчө",kgw("Сүйлөшмөйүнчө, тил өнүкпөйт.","m28_45")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Чем/пока: -ганча","Rather/until: -ганча","-maktansa: -ганча")),
    h("p",{class:"muted"},L("Два смысла, различает контекст: «чем делать X — лучше Y» и «пока не произойдёт X».","Two meanings, told apart by context: “rather than X, better Y” and “until X happens”.","İki anlam, bağlam ayırt eder: “X yapmaktansa Y iyi” ve “X olana kadar”.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("чем X — лучше Y","rather than X, better Y","X’tense Y iyi"),L("-ганча + совет (М27)","-ганча + advice (M27)","-ганча + öğüt (M27)"),kgw("Телевизор көргөнчө, китеп окуганыңыз оң.","m28_24")],
      [L("чем X — давайте Y","rather than X, let us Y","X’tense Y yapalım"),"-ганча + -алы",kgw("Үйдө отурганча, сабакка баралы.","m28_25")],
      [L("пока не X","until X","X olana kadar"),"-ганча",kgw("Автобус келгенче, сөздөрдү кайталайм.","m28_26")],
      [L("совет о речи","advice on speech","konuşma öğüdü"),"-гөнчө",kgw("Шаша сүйлөгөнчө, так сүйлөгөнүңүз жакшы.","m28_84")]]),
    h("div",{class:"note"},L("Не путайте: -майынча — «пока не» с отрицательным главным; -ганча — «чем/пока» с утвердительным.","Do not confuse: -майынча — “until” with a negative main clause; -ганча — “rather/until” with an affirmative one.","Karıştırmayın: -майынча — olumsuz ana cümleyle; -ганча — olumluyla."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Тил жөнүндө макалдар","Proverbs about language","Dil üzerine atasözleri")),
    harmonyTable([L("Макал","Proverb","Atasözü"),L("Смысл","Meaning","Anlam")],[
      [kgw("Тил билген — дил билет.","m28_14"),L("язык открывает душу народа","language opens a people’s soul","dil halkın gönlünü açar")],
      [kgw("Канча тил билсең, ошончо адамсың.","m28_15"),L("каждый язык — новая жизнь","each language is a new life","her dil yeni bir hayat")],
      [kgw("Кайталоо — билимдин энеси.","m28_30"),L("повторение — мать учения","repetition is the mother of learning","tekrar bilginin anasıdır")],
      [kgw("Билим — түгөнбөс байлык.","m28_02"),L("знание неисчерпаемо","knowledge is inexhaustible","bilgi tükenmez")]])));
  const dlg=[["А: — Кыргыз тилин үйрөнүү кыйынбы?","А: — Трудно ли учить кыргызский?","A: — Is Kyrgyz hard to learn?","A: — Kırgızca öğrenmek zor mu?"],
             ["Б: — Аракет кылмайынча, эч нерсе чыкпайт. Ал эми күн сайын машыксаң — оңой.","Б: — Без стараний ничего не выйдет. А если заниматься каждый день — легко.","B: — Without effort nothing comes. But if you practise daily, it is easy.","B: — Çaba göstermedikçe bir şey çıkmaz. Her gün çalışırsan kolay."],
             ["А: — Сөздөрдү кантип жаттайсыз?","А: — Как вы заучиваете слова?","A: — How do you memorize words?","A: — Kelimeleri nasıl ezberlersiniz?"],
             ["Б: — Сүйлөм ичинде жаттайм. Тизме жаттаганча, сүйлөм жаттаганың оң.","Б: — Внутри предложений. Чем зубрить списки, лучше учить фразы.","B: — Inside sentences. Rather than cram lists, better learn phrases.","B: — Cümle içinde. Liste ezberlemektense cümle öğrenmek iyidir."],
             ["А: — Сүйлөгөндөн уялам, ката кетирем го.","А: — Стесняюсь говорить: вдруг ошибусь.","A: — I am shy to speak: what if I err.","A: — Konuşmaktan çekiniyorum: ya hata yaparsam."],
             ["Б: — Ката кетиргенден коркпоңуз! Сүйлөшмөйүнчө, тил өнүкпөйт.","Б: — Не бойтесь ошибок! Пока не разговариваешь, язык не развивается.","B: — Do not fear mistakes! Unless you speak, the language does not grow.","B: — Hatadan korkmayın! Konuşmadıkça dil gelişmez."]];
  weekDialog(m,"Диалог: «Тил үйрөнүү»","Dialogue: «Тил үйрөнүү»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы -майынча и -ганча, определи смысл каждой («пока не» или «чем»); 3) расскажи «Чет тилдерди билүүнүн пайдасы» на 12–15 предложений — начни с макала, закончи личным опытом; 4) составь три своих совета изучающему кыргызский.","Tasks: 1) read the dialogue swapping roles; 2) write out the -майынча and -ганча forms and identify each meaning; 3) tell “Чет тилдерди билүүнүн пайдасы” in 12–15 sentences — open with a proverb, close with your own story; 4) compose three pieces of advice for a learner of Kyrgyz.","Diyalog: «Тил үйрөнүү»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -майынча ve -ганча biçimlerini yazıp anlamlarını belirle; 3) “Чет тилдерди билүүнүн пайдасы” konusunu 12–15 cümleyle anlat — atasözüyle başla, kendi hikâyenle bitir; 4) Kırgızca öğrenen birine üç öğüt yaz.");
}
