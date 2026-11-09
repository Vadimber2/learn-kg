
function renderGrammarM45(m){
  m.append(h("div",{class:"card"},h("h2",{},L("B2: средства массовой информации","B2: mass media","B2: kitle iletişim araçları")),
    h("p",{class:"muted"},L("На уровне B2 нужно уметь получать нужную информацию из кратких объявлений в общественных местах (вокзал, аэропорт, стадион) и понимать информацию в прямом эфире, связанную с работой.","At B2 you need to be able to get the information you need from prompt announcements in public places (station, airport, stadium), and understanding information in a live broadcast related to your job.","B2 düzeyinde şunlar gerekir: istasyon, havalimanı, stadyum gibi kamusal yerlerdeki hızlı duyurulardan gerekli bilgiyi almak ve işle ilgili canlı yayındaki bilgiyi anlamak.")),
    harmonyTable([L("Средство","Outlet","Araç"),L("Пример","Example","Örnek")],[
      [kgw("массалык маалымат каражаттары","m45_07"),L("газета, журнал, радио, телевидение","newspapers, magazines, radio, TV","gazete, dergi, radyo, televizyon")],
      [kgw("гезит","m45_13"),kgw("журнал","m45_14")],
      [kgw("радио","m45_16"),kgw("телеберүү","m45_17")],
      [kgw("түз эфир","m45_12"),kgw("кулактандыруу","m45_18")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Структура статьи","Article structure","Makale yapısı")),
    h("p",{class:"muted"},L("Небольшая статья требует точной структуры: заголовок, введение, основная часть, заключение.","A short article requires a precise structure: title, introduction, main part, conclusion.","Kısa bir makale kesin bir yapı ister: başlık, giriş, ana bölüm, sonuç.")),
    harmonyTable([L("Часть","Part","Bölüm"),L("Роль","Role","Görevi"),L("Пример","Example","Örnek")],[
      [kgw("аталышы","m45_35"),L("называет тему","names the topic","konuyu adlandırır"),""],
      [kgw("кириш сөз","m45_36"),L("вводит читателя","introduces the reader","okuyucuyu konuya sokar"),kgw("Макала кыска кириш сөз менен башталат.","m45_40")],
      [L("основная часть","the main part","ana bölüm"),L("аргументы и примеры","arguments and examples","kanıt ve örnek"),kgw("Негизги бөлүктө үч далил келтирилет.","m45_41")],
      [kgw("корутунду","m45_38"),L("заключение","the conclusion","sonuç"),kgw("Корутундуда жыйынтык так айтылат.","m45_42")]]),
    h("div",{class:"note"},L("Одна мысль — один абзац: «абзац» начинает каждую новую мысль с новой строки.","One idea — one paragraph: an «абзац» starts each new idea from a new line.","Bir fikir — bir paragraf: «абзац» her yeni fikri yeni satırdan başlatır."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Косвенная речь: деп билдирди / маалымдады / белгиледи","Reported speech: деп билдирди / маалымдады / белгиледи","Dolaylı anlatım: деп билдирди / маалымдады / белгиледи")),
    h("p",{class:"muted"},L("В публицистическом стиле событие излагается не своими словами, а с опорой на источник.","In the publicistic style, an event is not reported in one's own words but by relying on a source.","Gazetecilik üslubunda bir olay kendi sözlerimizle değil, bir kaynağa dayanarak aktarılır.")),
    harmonyTable([L("Структура","Structure","Yapı"),L("Пример","Example","Örnek")],[
      [L("-ган + притяжание + -н + билдирди","-ган + possessive + -н + билдирди","-ган + iyelik + -н + билдирди"),kgw("Кабарчы жол кырсыгы болгонун билдирди.","m45_43")],
      [L("-ар + притяжание + -н + маалымдады (будущее)","-ар + possessive + -н + маалымдады (future)","-ар + iyelik + -н + маалымдады (gelecek)"),kgw("Синоптик эртең жамгыр жаарын маалымдады.","m45_44")],
      [L("-ып жат + -кан + притяжание + -н + белгиледи","-ып жат + -кан + possessive + -н + белгиледи","-ып жат + -кан + iyelik + -н + белгиледи"),kgw("Министр билим берүү реформасы ийгиликтүү болуп жатканын белгиледи.","m45_45")],
      [L("маалыматка ылайык, …","маалыматка ылайык, …","маалыматка ылайык, …"),kgw("Расмий маалыматка ылайык, жол кыймылы калыбына келди.","m45_46")]]),
    h("div",{class:"note"},L("Прямая речь передаётся тоже с «деп»: Он ответил «даярмын», деп. Косвенная речь передаётся и с «деп» (…деп билдирди), и без «деп» — формой на -ганын.","Direct speech uses «деп»: He answered «I'm ready», деп. Reported speech can also use «деп» (…деп билдирди), or drop it and use -ганын instead.","Doğrudan alıntı «деп» ile de verilir: «Hazırım» деп cevap verdi. Dolaylı anlatım «деп» ile de (…деп билдирди), «деп» olmadan -ганын ile de kurulabilir."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Обращение и риторический вопрос","Addressing an audience & rhetorical questions","Topluluğa hitap ve retorik sorular")),
    harmonyTable([L("Цель","Purpose","Amaç"),L("Пример","Example","Örnek")],[
      [L("обращение к собранию","addressing an assembly","toplantıya hitap"),kgw("Урматтуу жыйынга катышуучулар!","m45_50")],
      [L("обращение к читателям","addressing readers","okuyucuya hitap"),kgw("Кымбаттуу окурмандар!","m45_51")],
      [L("риторический вопрос","a rhetorical question","retorik soru"),kgw("Бул адилеттикпи?","m45_54")],
      [L("риторический вопрос","a rhetorical question","retorik soru"),kgw("Ким бул маселеге кайдыгер кала алат?","m45_55")]]),
    h("div",{class:"note"},L("Риторический вопрос не требует ответа — он даётся, чтобы заставить слушателя задуматься.","A rhetorical question does not expect an answer — it makes the audience think.","Retorik soru cevap beklemez — dinleyiciyi düşündürmek içindir."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Долженствование: -ууга тийиш (B1↔B2)","Obligation: -ууга тийиш (B1↔B2)","Yükümlülük: -ууга тийиш (B1↔B2)")),
    h("p",{class:"muted"},L("М24 (B1) научил личной необходимости через «-ыш керек»: бүтүрүшүм керек. «-ууга тийиш» в B2 — формальное, профессиональное долженствование, чаще о третьем лице.","M24 (B1) taught personal necessity with «-ыш керек»: бүтүрүшүм керек. B2's «-ууга тийиш» is a formal, professional obligation, often about a third person.","M24 (B1) kişisel gerekliliği «-ыш керек» ile öğretti: бүтүрүшүм керек. B2'deki «-ууга тийиш» resmî, meslekî bir yükümlülüktür, genelde üçüncü şahıs için.")),
    harmonyTable([L("Кто/что","Who/what","Kim/ne"),L("Пример","Example","Örnek")],[
      [L("журналист","a journalist","gazeteci"),kgw("Журналист фактыны текшерүүгө тийиш.","m45_57")],
      [L("статья","an article","makale"),kgw("Макала так жана негиздүү болууга тийиш.","m45_58")],
      [L("выступающий","a speaker","konuşmacı"),kgw("Сүйлөөчү убакытты сактоого тийиш.","m45_61")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Замысел автора","The author's intent","Yazarın niyeti")),
    h("p",{class:"muted"},L("Навык чтения B2: распознавать точку зрения автора и логику аргументации в объёмных текстах.","A B2 reading skill: discerning the author's viewpoint and argumentative logic in long texts.","B2 okuma becerisi: uzun metinlerdeki yazarın bakış açısını ve kanıtlama mantığını sezmek.")),
    harmonyTable([L("Замысел","Intent","Niyet"),L("Пример","Example","Örnek")],[
      [L("упрёк","reproach","eleştiri"),kgw("Автор бул чечимди кабыл алгандарды катуу жемелейт.","m45_65")],
      [L("поддержка","support","destek"),kgw("Сынчы жаңы тасманы жогору баалап, аны колдойт.","m45_66")],
      [L("убеждение","persuasion","ikna"),kgw("Автор окурманду ынандыруу үчүн так мисал келтирет.","m45_67")],
      [L("сомнение","doubt","şüphe"),kgw("Кээ бир окурмандар автордун пикирине күмөн санашат.","m45_68")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Скелет публичной речи (15–18 предложений)","The public speech skeleton (15–18 sentences)","Kamuya açık konuşmanın iskeleti (15–18 cümle)")),
    h("ol",{},
      h("li",{},kgw("Азыркы дүйнөдө массалык маалымат каражаттары чоң роль ойнойт.","m45_76")),
      h("li",{},kgw("Мен күн сайын жаңылыктарды түз эфирден көрөм.","m45_77")),
      h("li",{},kgw("Ишенимдүү маалымат алуу үчүн бир нече булакты салыштырам.","m45_78")),
      h("li",{},kgw("Кээде интернеттеги маалымат так эмес болот.","m45_79")),
      h("li",{},kgw("Ошондуктан ар бир кабарды текшерүү маанилүү.","m45_80")),
      h("li",{},kgw("Менин оюмча, ар бир кабар ишенимдүү булакка таянууга тийиш.","m45_81")),
      h("li",{},kgw("Мен өткөн жылы студенттик жыйында биринчи жолу эл алдында сүйлөдүм.","m45_82")),
      h("li",{},kgw("Ал учурда даярдыгым жок эле, бирок ойлорумду так жеткирдим.","m45_83")),
      h("li",{},kgw("Азыр макала жазганда, адегенде кыска кириш сөз жазам.","m45_84")),
      h("li",{},kgw("Анан негизги бөлүктө үч далил келтирем.","m45_85")),
      h("li",{},kgw("Акырында корутундуда өз пикиримди жыйынтыктайм.","m45_86")),
      h("li",{},kgw("Телеберүүдөн кызыктуу репортаждарды көргөндү жактырам.","m45_88")),
      h("li",{},kgw("Журналистика — коомго абдан маанилүү кесип деп эсептейм.","m45_89")),
      h("li",{},kgw("Келечекте кесиптик темада макалаларды кыйынчылыксыз жазгым келет.","m45_87")),
      h("li",{},kgw("Ар бир адам оюн негиздүү жеткирүүгө умтулушу керек.","m45_90"))),
    h("div",{class:"note"},L("Скелет: введение (1-3) → проблема и метод (4-6) → личный опыт, введение-аргумент-заключение (7-14) → общий вывод (15).","Skeleton: intro (1–3) → problem and method (4–6) → personal experience, intro-argument-conclusion (7–14) → overall conclusion (15).","İskelet: giriş (1-3) → sorun ve yöntem (4-6) → kişisel deneyim, giriş-kanıt-sonuç (7-14) → genel sonuç (15)."))));
  const dlg=[["А: — Урматтуу курсташтар! Бир суроо берейин: спорт бизге эмне үчүн керек?","А: — Уважаемые однокурсники! Позвольте задать вопрос: зачем нам нужен спорт?","A: — Dear fellow students! Let me ask: why do we need sport?","A: — Değerli sınıf arkadaşları! Bir soru sorayım: bize spor neden gerekli?"],
             ["А: — Биринчиден, спорт ден соолукту чыңдайт. Экинчиден, ал биримдикти бекемдейт. Үчүнчүдөн, ал мүнөздү тарбиялайт.","А: — Во-первых, спорт укрепляет здоровье. Во-вторых, он укрепляет единство. В-третьих, он воспитывает характер.","A: — Firstly, sport strengthens health. Secondly, it strengthens unity. Thirdly, it cultivates character.","A: — Birincisi, spor sağlığı güçlendirir. İkincisi, birliği pekiştirir. Üçüncüsü, karakteri geliştirir."],
             ["А: — Ошондуктан баарыңызды бул мелдешке катышууга чакырам!","А: — Поэтому призываю всех вас принять участие в этом соревновании!","A: — Therefore I call on all of you to take part in this competition!","A: — Bu yüzden hepinizi bu müsabakaya katılmaya çağırıyorum!"],
             ["Б: — Таптакыр даярдыксыз ушунчалык так сүйлөдүңүз — таң калдым!","Б: — Вы так чётко говорили совершенно без подготовки — я удивлён!","B: — You spoke so clearly completely without preparation — I'm amazed!","B: — Tamamen hazırlıksız bu kadar net konuştunuz — şaşırdım!"],
             ["А: — Рахмат! Чынын айтсам, жүрөгүм катуу согуп жатты, бирок үч аргументти эстен чыгарган жокмун.","А: — Спасибо! Честно говоря, сердце сильно колотилось, но я не забыла три аргумента.","A: — Thank you! Honestly my heart was pounding hard, but I did not forget the three arguments.","A: — Teşekkürler! Doğrusu kalbim hızlı çarpıyordu ama üç argümanı unutmadım."],
             ["В: — Мына ушундай — кириш, далилдер жана чакырык менен бүткөн мыкты сөз болду.","В: — Вот так — с введением, доказательствами и призывом получилась отличная речь.","C: — There we are — a fine speech with an introduction, arguments and a call to action.","C: — İşte böyle — giriş, kanıtlar ve çağrıyla harika bir konuşma oldu."]];
  weekDialog(m,"Диалог: «Даярдыгы жок сөз»","Dialogue: «Даярдыгы жок сөз»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) найди обращение, риторический вопрос и призыв; 3) две минуты говори без подготовки на одну тему; 4) напиши статью в газету (вступление, основная часть, заключение).","Tasks: 1) read the dialogue swapping roles; 2) find the address, the rhetorical question and the call to action; 3) speak two minutes unprepared on a topic; 4) write a newspaper article (introduction, main part, conclusion).","Diyalog: «Даярдыгы жок сөз»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) hitabı, retorik soruyu ve çağrıyı bul; 3) hazırlıksız iki dakika bir konuda konuş; 4) gazeteye makale yaz (giriş, ana bölüm, sonuç).");
}
