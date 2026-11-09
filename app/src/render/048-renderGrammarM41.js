
function renderGrammarM41(m){
  m.append(h("div",{class:"card"},h("h2",{},L("B2: научный стиль","B2: scientific style","B2: bilimsel üslup")),
    h("p",{class:"muted"},L("На B2 требуется выражать основную мысль не только фактами, но и аргументом и оценкой. В научном стиле термины вводятся с определениями, а выводы оформляются устойчивыми конструкциями вроде «деп аталат», «болуп саналат».","At B2 you are expected to express the main idea not just with facts but with argument and evaluation. In scientific style, terms are introduced with definitions, and conclusions are framed with fixed constructions like «деп аталат», «болуп саналат».","B2 seviyesinde ana fikrin sadece olgularla değil, argüman ve değerlendirmeyle ifade edilmesi beklenir. Bilimsel üslupta terimler tanımlarla tanıtılır, sonuçlar ise «деп аталат», «болуп саналат» gibi sabit yapılarla verilir.")),
    h("div",{class:"note"},L("B1↔B2: на B1 основными были деловые бумаги и рабочие темы («керек», «болот»). На B2 добавляются аргументация (приведение доводов), определение терминов и страдательный залог — признак научного и публицистического стиля.","B1↔B2: at B1 the focus was official paperwork and work topics («керек», «болот»). At B2, argumentation, defining terms and the passive voice are added — the mark of scientific and publicistic style.","B1↔B2: B1'de resmî evrak ve iş konuları temeldi («керек», «болот»). B2'de argümantasyon, tanım verme ve edilgen çatı eklenir — bu bilimsel ve gazetecilik üslubunun işaretidir."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Называние: … деп аталат","Naming: … деп аталат","Adlandırma: … деп аталат")),
    harmonyTable([L("Функция","Function","İşlev"),L("Пример","Example","Örnek")],[
      [L("метод называется","a method is called","yöntem adlandırılır"),kgw("Бул усул илимде эксперимент деп аталат.","m41_28")],
      [L("этап называется","a stage is called","aşama adlandırılır"),kgw("Изилдөөнүн биринчи баскычы гипотеза түзүү деп аталат.","m41_29")],
      [L("закономерность называется","a regularity is called","düzenlilik adlandırılır"),kgw("Бул көрүнүш илимде мыйзам ченемдүүлүк деп аталат.","m41_32")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Оценка: … болуп саналат/эсептелет","Evaluation: … болуп саналат/эсептелет","Değerlendirme: … болуп саналат/эсептелет")),
    harmonyTable([L("Функция","Function","İşlev"),L("Пример","Example","Örnek")],[
      [L("оценка значимости","evaluating significance","önem değerlendirmesi"),kgw("Сабаттуулук заманбап жашоонун негизи болуп саналат.","m41_35")],
      [L("оценка довода","evaluating an argument","argüman değerlendirmesi"),kgw("Бул далил изилдөөдөгү эң күчтүү аргумент болуп саналат.","m41_37")],
      [L("оценка учреждения","evaluating an institution","kurum değerlendirmesi"),kgw("Бул университет өлкөдөгү эң алдыңкы окуу жай болуп саналат.","m41_39")]]),
    h("div",{class:"note"},L("«Болуп саналат» и «болуп эсептелет» — полные синонимы, используются попеременно, чтобы избежать повторов.","«Болуп саналат» and «болуп эсептелет» are full synonyms, used alternately to avoid repetition.","«Болуп саналат» ve «болуп эсептелет» tam eş anlamlıdır, tekrardan kaçınmak için değişerek kullanılır."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Состав и классификация: -дан турат / -га бөлүнөт","Composition & classification: -дан турат / -га бөлүнөт","Bileşim ve sınıflandırma: -дан турат / -га бөлүнөт")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      [L("состоит из","consists of","-den oluşur"),kgw("Илимий макала киришүүдөн, негизги бөлүктөн жана корутундудан турат.","m41_42")],
      [L("делится на","is divided into","-e ayrılır"),kgw("Илим табигый, гуманитардык жана так илимдерге бөлүнөт.","m41_43")],
      [L("этапы работы","stages of work","çalışma aşamaları"),kgw("Изилдөө иши үч баскычтан турат: план түзүү, маалымат чогултуу жана талдоо.","m41_44")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Средство: -нун жардамы менен / аркылуу","Means: -нун жардамы менен / аркылуу","Araç: -нун жардамы менен / аркылуу")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      [L("инструмент","an instrument","araç"),kgw("Илимпоздор микроскоптун жардамы менен клеткаларды изилдешет.","m41_49")],
      [L("способ","a method","yöntem"),kgw("Эксперимент аркылуу гипотеза текшерилет.","m41_51")],
      [L("возможность","opportunity","olanak"),kgw("Санарип китепкана аркылуу дүйнөнүн каалаган бурчунан маалымат алууга болот.","m41_54")]]),
    h("div",{class:"note"},L("«Аркылуу» чаще для способа/пути, «жардамы менен» — для инструмента или человека.","«Аркылуу» tends to mark a method/way, «жардамы менен» — a tool or a person.","«Аркылуу» daha çok yöntem/yol için, «жардамы менен» ise araç veya kişi için kullanılır."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Страдательный залог (туюк мамиле) в научном стиле","Passive voice in scientific style","Bilimsel üslupta edilgen çatı")),
    harmonyTable([L("Функция","Function","İşlev"),L("Пример","Example","Örnek")],[
      [L("исследуется","is studied","incelenir"),kgw("Бул көрүнүш көптөгөн окумуштуулар тарабынан изилденет.","m41_56")],
      [L("применяется","is used","kullanılır"),kgw("Бул ыкма дүйнөнүн көп өлкөлөрүндө колдонулат.","m41_57")],
      [L("определяется","is determined","belirlenir"),kgw("Сөздүн мааниси сүйлөмдүн курамында аныкталат.","m41_58")]]),
    h("div",{class:"note"},L("Действующее лицо, если нужно, добавляется через «тарабынан» (кем): окумуштуулар тарабынан изилденет.","The doer, if needed, is added with «тарабынан» (by): окумуштуулар тарабынан изилденет.","Yapan gerekirse «тарабынан» (tarafından) ile eklenir: окумуштуулар тарабынан изилденет."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Скелет развёрнутого ответа (15–18 предложений)","Extended answer skeleton (15–18 sentences)","Kapsamlı cevap iskeleti (15–18 cümle)")),
    harmonyTable([L("Часть","Part","Bölüm"),L("Предложение","Sentence","Cümle")],[
      [L("Введение","Introduction","Giriş"),kgw("Мен илимге бала кезимден кызыгам.","m41_70")],
      [L("Введение","Introduction","Giriş"),kgw("Менин оюмча, сабаттуулук — заманбап адамдын эң маанилүү сапаты.","m41_71")],
      [L("Основная часть: определение","Main part: definition","Ana bölüm: tanım"),kgw("Сабаттуулук жөн гана окуй жана жаза билүү эмес, маалыматты туура түшүнө билүү дагы.","m41_72")],
      [L("Основная часть: причина","Main part: reason","Ana bölüm: neden"),kgw("Айрым окумуштуулардын пикири боюнча, сабаттуулук деңгээли өлкөнүн өнүгүүсүнө түздөн-түз таасир этет.","m41_76")],
      [L("Основная часть: пример","Main part: example","Ana bölüm: örnek"),kgw("Мисалы, сабаттуу адамдар жумуш издөөдө жана иштеринде ийгиликтүү болушат.","m41_77")],
      [L("Основная часть: контраргумент","Main part: counter-argument","Ana bölüm: karşı görüş"),kgw("Бирок кээ бир адамдар технологияны туура эмес колдонушат, натыйжада жалган маалыматка ишенип калышат.","m41_79")],
      [L("Заключение","Conclusion","Sonuç"),kgw("Демек, сабаттуулук — бир жолку жетишкендик эмес, өмүр бою улантыла турган процесс.","m41_83")],
      [L("Заключение","Conclusion","Sonuç"),kgw("Жыйынтыктап айтканда, илим жана сабаттуулук коомдун өнүгүүсүнүн негизги шарты болуп саналат.","m41_84")]]),
    h("div",{class:"note"},L("Связующие слова: «ошондуктан» (поэтому), «тескерисинче» (наоборот), «демек» (следовательно), «жыйынтыктап айтканда» (подводя итог).","Connectors: «ошондуктан» (therefore), «тескерисинче» (on the contrary), «демек» (so, hence), «жыйынтыктап айтканда» (to sum up).","Bağlaçlar: «ошондуктан» (bu yüzden), «тескерисинче» (aksine), «демек» (demek ki), «жыйынтыктап айтканда» (özetle)."))));
  const dlg=[["А: — Сабаттуулук деген эмне?","А: — Что такое грамотность?","A: — What is literacy?","A: — Okuryazarlık nedir?"],
             ["Б: — Окуй жана жаза билүү, ошондой эле маалыматты туура колдоно билүү жөндөмү сабаттуулук деп аталат.","Б: — Умение читать и писать, а также правильно использовать информацию называется грамотностью.","B: — The ability to read and write, as well as to use information correctly, is called literacy.","B: — Okuma yazma ve bilgiyi doğru kullanabilme yeteneğine okuryazarlık denir."],
             ["А: — Ал эми санарип сабаттуулук эмнени билдирет?","А: — А что означает цифровая грамотность?","A: — And what does digital literacy mean?","A: — Peki dijital okuryazarlık ne anlama gelir?"],
             ["Б: — Ал компьютерди жана интернетти коопсуз колдоно билүү жөндөмү болуп саналат.","Б: — Она считается способностью безопасно использовать компьютер и интернет.","B: — It is considered the ability to use a computer and the internet safely.","B: — O, bilgisayarı ve interneti güvenli kullanabilme yeteneği sayılır."],
             ["А: — Бул эки сабаттуулук өз ара кандай байланышта?","А: — Как эти два вида грамотности связаны между собой?","A: — How are these two kinds of literacy connected?","A: — Bu iki okuryazarlık türü birbiriyle nasıl bağlantılı?"],
             ["Б: — Алар бирин-бири толуктайт: экөө тең маалыматты сынчыл баалоонун жардамы менен ишке ашат.","Б: — Они дополняют друг друга: обе реализуются с помощью критической оценки информации.","B: — They complement each other: both are realised with the help of critically evaluating information.","B: — Birbirini tamamlarlar: ikisi de bilgiyi eleştirel değerlendirme yardımıyla gerçekleşir."]];
  weekDialog(m,"Диалог: «Сабаттуулук деген эмне?»","Dialogue: «Сабаттуулук деген эмне?»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши конструкции «деп аталат» и «болуп саналат», разбери их разницу; 3) расскажи «Адам жана илим» и «Сабаттуулук» на 15–18 предложений — темы для монолога и письма; 4) составь 3 предложения о своей специальности с «-дан турат» и «аркылуу».","Tasks: 1) read the dialogue swapping roles; 2) write out the «деп аталат» and «болуп саналат» constructions and analyse their difference; 3) tell “Адам жана илим” and “Сабаттуулук” in 15–18 sentences — topics for a monologue and for writing; 4) write 3 sentences about your specialty with «-дан турат» and «аркылуу».","Diyalog: «Сабаттуулук деген эмне?»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) «деп аталат» ve «болуп саналат» yapılarını yazıp farklarını çözümle; 3) “Адам жана илим” ve “Сабаттуулук” konularını 15–18 cümleyle anlat — monolog ve yazma konuları; 4) kendi uzmanlığın hakkında «-дан турат» ve «аркылуу» ile 3 cümle yaz.");
}
