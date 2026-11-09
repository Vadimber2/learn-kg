
function renderGrammarM38(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Намерения в разговоре","Intentions in a conversation","Konuşmadaki niyetler")),
    h("p",{class:"muted"},L("На уровне B2 в беседе нужно уметь менять направление и тему беседы и реализовывать разные намерения — одобрение, поддержку, запрет, несогласие или сомнение, гарантию, убеждение.","At B2 you need to be able to change the direction and topic of a conversation and to carry out various intentions — approving, supporting, prohibiting, being against or unsure, guaranteeing, convincing.","B2 düzeyinde konuşmanın yönünü ve konusunu değiştirerek çeşitli niyetleri gerçekleştirebilmek gerekir — onaylama, destekleme, yasaklama, karşı/kararsız olma, güvence verme, ikna etme.")),
    harmonyTable([L("Намерение","Intention","Niyet"),L("Пример","Example","Örnek")],[
      [L("одобрить","to approve","onaylamak"),kgw("кубаттоо","m38_09")],
      [L("запретить","to prohibit","yasaklamak"),kgw("тыюу салуу","m38_12")],
      [L("быть против","to be against","karşı olmak"),kgw("каршы болуу","m38_13")],
      [L("дать гарантию","to guarantee","güvence vermek"),kgw("кепилдик берүү","m38_15")],
      [L("упрекнуть","to reproach","sitem etmek"),kgw("жемелөө","m38_17")],
      [L("сомневаться","to doubt","şüphe etmek"),kgw("күмөн саноо","m38_18")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Уступка: -са да / -ганы менен / -ганына карабастан","Concession: -са да / -ганы менен / -ганына карабастан","Karşıtlık: -са да / -ганы менен / -ганына карабастан")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("даже если","even if","-se de"),"-са да",kgw("Жаан жааса да, жыйынга барам.","m38_30")],
      [L("хотя","although","-e rağmen"),"-гону менен",kgw("Убакыт аз болгону менен, баарын айтып бүттүм.","m38_31")],
      [L("несмотря на то что","despite the fact that","-mesine rağmen"),"-ганына карабастан",kgw("Көп талкуулаганыбызга карабастан, чечим табылган жок.","m38_32")],
      [L("но всё же","but still","yine de"),L("деген менен","деген менен","деген менен"),kgw("Сиз макул болбойсуз, деген менен мен өз оюмда калам.","m38_33")]]),
    h("div",{class:"note"},L("-са да строится на знакомом условном -са (М27) и усиливает условие до «даже если»; -ганы менен и -ганына карабастан строятся на причастии -ган.","-са да builds on the familiar conditional -са (M27) and strengthens it into “even if”; -ганы менен and -ганына карабастан build on the -ган participle.","-са да bildiğiniz koşul eki -са’ya (M27) dayanır ve onu “-se bile”ye güçlendirir; -ганы менен ve -ганына карабастан ise -ган ortacına dayanır."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Причина: -гандыктан, анткени, ошондуктан","Reason: -гандыктан, анткени, ошондуктан","Neden: -гандыктан, анткени, ошондуктан")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("так как…","since…","-dığı için"),"-гандыктан",kgw("Жыйын узакка созулгандыктан, баары чарчады.","m38_37")],
      [L("потому что","because","çünkü"),"анткени",kgw("Мен макул эмесмин, анткени планда каталар бар.","m38_38")],
      [L("поэтому (вывод)","so (consequence)","bu yüzden"),"ошондуктан",kgw("Талкуу узакка созулду, ошондуктан тыныгуу жарыяланды.","m38_40")]]),
    h("div",{class:"note"},L("Анткени/себеби вводят причину второй частью после запятой (или отдельным предложением) и стоят перед причиной; ошондуктан стоит после причины и вводит следствие.","Анткени/себеби introduce the reason after a comma or as a new sentence and precede the reason; ошондуктан follows the reason and introduces the consequence.","Анткени/себеби nedeni virgülden sonra ya da yeni cümlede verir ve nedenden önce gelir; ошондуктан ise nedenden sonra gelip sonucu bildirir."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Построение аргумента: биринчиден … демек","Building an argument: firstly … so","Argüman kurma: birincisi … demek ki")),
    h("p",{class:"muted"},L("В споре по спорному вопросу ответ строится по этой структуре.","In a debate on a disputed question, the answer is built with this structure.","Tartışmalı bir soruda cevap bu yapıyla kurulur.")),
    harmonyTable([L("Функция","Function","İşlev"),L("Пример","Example","Örnek")],[
      [L("первый аргумент","first argument","ilk argüman"),kgw("Биринчиден, бул сунуш убакытты үнөмдөйт.","m38_23")],
      [L("второй аргумент","second argument","ikinci argüman"),kgw("Экинчиден, ал кызматкерлерге ыңгайлуу.","m38_26")],
      [L("вывод","conclusion","sonuç"),kgw("Демек, бул сунушту кабыл алуу керек.","m38_27")],
      [L("противоположная мысль","opposite thought","zıt düşünce"),kgw("Тескерисинче, чыгым көбөйүшү мүмкүн.","m38_28")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Модальность мнения: -са керек, -ышы мүмкүн, -гандай","Opinion modality: -са керек, -ышы мүмкүн, -гандай","Görüş kipliği: -са керек, -ышы мүмкүн, -гандай")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("наверное","probably","galiba"),"-са керек",kgw("Жыйын саат бешке чейин созулса керек.","m38_42")],
      [L("возможно","possibly","-ebilir / belki"),"-ышы мүмкүн",kgw("Бул сунуш кабыл алынышы мүмкүн.","m38_43")],
      [L("похоже, что","it seems that","-mış gibi"),"-гандай",kgw("Жетекчи биздин сунушту жактыргандай.","m38_46")]]),
    h("div",{class:"note"},L("Не факт, а предположение: в споре это говорится вежливо этими формами, а не категоричным тоном.","Not a fact but a guess: in a debate it is said politely with these forms rather than a categorical tone.","Kesin değil tahmin: tartışmada kesin bir tonla değil, bu biçimlerle nazikçe söylenir."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Формулы согласия/несогласия","Agreement/disagreement formulas","Onay/itiraz kalıpları")),
    harmonyTable([L("Формула","Formula","Kalıp"),L("Значение","Meaning","Anlam")],[
      [kgw("Мен буга макулмун.","m38_49"),L("согласен","I agree","katılıyorum")],
      [kgw("Мен буга каршымын.","m38_50"),L("против","I am against","karşıyım")],
      [kgw("Менин бул жөнүндө күмөнүм бар.","m38_51"),L("сомневаюсь","I have a doubt","şüphem var")],
      [kgw("Мен сиздин далилиңизге ишенем.","m38_52"),L("доверяю","I trust","güveniyorum")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Скелет развёрнутого ответа (15–18 предложений)","Extended answer skeleton (15–18 sentences)","Kapsamlı cevap iskeleti (15–18 cümle)")),
    h("p",{class:"muted"},L("Порядок связок для рассказа-аргумента на уровне B2: сначала слушаем, потом формулируем позицию, приводим два аргумента, признаём уступку и заключаем.","The order of connectors for a B2 argument narrative: first listen, then state a position, give two arguments, acknowledge a concession, and conclude.","B2 argüman anlatısının bağlaç sırası: önce dinle, sonra konumunu belirt, iki argüman ver, bir karşıtlığı kabul et ve sonuçlandır.")),
    h("ol",{},
      h("li",{},kgw("Мен жумада бир жолу кеңешмеге катышам.","m38_70")),
      h("li",{},kgw("Талкууда адегенде башкалардын оюн угам.","m38_71")),
      h("li",{},kgw("Андан кийин өз пикиримди так айтам.","m38_72")),
      h("li",{},kgw("Оюмду айтканда, дайыма далил келтирүүгө аракет кылам.","m38_73")),
      h("li",{},kgw("Биринчиден жана экинчиден деген сөздөр менен аргументтеримди тартипке келтирем.","m38_74")),
      h("li",{},kgw("Эгер бирөө менен макул болбосом, сылык түрдө каршы пикиримди билдирем.","m38_75")),
      h("li",{},kgw("Кыйын учурларда «деген менен» сөзүн колдонуп, өз оюмда калам.","m38_77")),
      h("li",{},kgw("Талкуунун аягында биз көбүнчө бир жыйынтыкка келебиз.","m38_78")),
      h("li",{},kgw("Мен өз оюмду ачык, бирок сылык түрдө билдирүүгө аракет кылам.","m38_79")))));
  const dlg=[["Бакыт мырза: — Кутман күн, урматтуу кесиптештер! Веб-жыйынды ачык деп жарыялайм.","Бакыт мырза: — Добрый день, уважаемые коллеги! Объявляю веб-собрание открытым.","Mr Bakyt: — Good day, dear colleagues! I declare the web meeting open.","Bakıt Bey: — İyi günler değerli meslektaşlar! Web toplantısını açık ilan ediyorum."],
             ["Нургүл: — Мен жумуш убактысын ийкемдүү кылуу сунушун киргизгим келет.","Нургүл: — Я хочу внести предложение сделать рабочее время гибким.","Nurgul: — I would like to put forward a proposal to make working hours flexible.","Nurgül: — Çalışma saatlerini esnek yapma önerisini sunmak istiyorum."],
             ["Жон: — Мен бул сунушту толук колдойм. Биринчиден, ал кызматкерлерге ыңгайлуу.","Жон: — Я полностью поддерживаю это предложение. Во-первых, оно удобно сотрудникам.","John: — I fully support this proposal. Firstly, it is convenient for the staff.","John: — Bu öneriyi tamamen destekliyorum. Birincisi, çalışanlar için uygun."],
             ["Айгүл эже: — Мен бул сунушка карата арсармын. Тартип бузулуп калышы мүмкүн го.","Айгүл эже: — Я испытываю сомнение насчёт этого предложения. Дисциплина может нарушиться.","Aigul eje: — I am unsure about this proposal. Discipline might break down.","Aygül abla: — Bu öneri konusunda kararsızım. Disiplin bozulabilir."],
             ["Нургүл: — Түшүнөм, Айгүл эже, деген менен биз так эрежелерди бекитсек болот.","Нургүл: — Понимаю, Айгуль эже, но всё же мы можем утвердить чёткие правила.","Nurgul: — I understand, Aigul eje, but still we can set clear rules.","Nurgül: — Anlıyorum Aygül abla, yine de net kurallar belirleyebiliriz."],
             ["Бакыт мырза: — Жакшы пикирлер айтылды. Эми маектин багытын өзгөртүп, экинчи маселеге өтөлү.","Бакыт мырза: — Прозвучали хорошие мнения. Теперь, изменив направление беседы, перейдём ко второму вопросу.","Mr Bakyt: — Good opinions were voiced. Now, changing the direction of our talk, let us move to the second item.","Bakıt Bey: — Güzel görüşler dile getirildi. Şimdi konuşmanın yönünü değiştirip ikinci konuya geçelim."]];
  weekDialog(m,"Диалог: «Веб-жыйын»","Dialogue: «Веб-жыйын»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы уступки и причины (-са да, -гону менен, -гандыктан, анткени) и разбери их состав; 3) расскажи на 15–18 предложений об управлении намерениями в беседе — с двумя аргументами через «биринчиден/экинчиден» и одной уступкой через «деген менен»; 4) подготовь такую же речь о решении спорного вопроса с формулами согласия/несогласия.","Tasks: 1) read the dialogue swapping roles; 2) write out the concession and reason forms (-са да, -гону менен, -гандыктан, анткени) and analyse them; 3) tell in 15–18 sentences about managing the intentions of a conversation — with two arguments using “firstly/secondly” and one concession using “still”; 4) prepare the same kind of speech about resolving a disputed question with agreement/disagreement formulas.","Diyalog: «Web toplantısı»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) karşıtlık ve neden biçimlerini (-са да, -гону менен, -гандыктан, анткени) yazıp çözümle; 3) konuşmadaki niyetleri yönetme üzerine 15–18 cümleyle anlat — “birincisi/ikincisi” ile iki argüman ve “yine de” ile bir karşıtlıkla; 4) tartışmalı bir soruyu çözme üzerine aynı türde bir konuşma hazırla.");
}
