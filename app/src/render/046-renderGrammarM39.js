
function renderGrammarM39(m){
  m.append(h("div",{class:"card"},h("h2",{},L("B2: Справедливость и закон","B2: Justice and the law","B2: Adalet ve kanun")),
    h("p",{class:"muted"},L("Тема «Адилеттүүлүк» и правовая оценка (оправдание, защита, обвинение) требуют не просто лексики, а официального стиля: право и долг, нереальное условие, цель с отрицанием.","The topic «Адилеттүүлүк» and legal evaluation (acquit, defend, accuse) require not just vocabulary but an official style: rights and duties, unreal condition, negative purpose.","«Адилеттүүлүк» konusu ve hukuki değerlendirme (aklama, savunma, suçlama), sadece kelime değil resmî üslup ister: hak ve görev, gerçekleşmemiş şart, olumsuz amaç.")),
    h("div",{class:"note"},L("Важен не перевод слов, а распознавание действия автора: колдоо / актоо / коргоо / күнөөлөө.","What matters is not a translation of words but recognising the author's action: support / acquit / defend / accuse.","Önemli olan kelime çevirisi değil, yazarın eylemini tanımaktır: destekleme / aklama / savunma / suçlama."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Право и долг: -ууга укуктуу / -ууга милдеттүү / -ууга тийиш","Rights & duties: -ууга укуктуу / -ууга милдеттүү / -ууга тийиш","Hak ve görev: -ууга укуктуу / -ууга милдеттүү / -ууга тийиш")),
    h("p",{class:"muted"},L("Имя действия (-уу) + дательный падеж (-га/-го/-ге/-ко) + укуктуу/милдеттүү/тийиш — три оттенка официальной модальности.","The verbal noun (-уу) + dative (-га/-го/-ге/-ко) + укуктуу/милдеттүү/тийиш — three shades of official modality.","İsim-fiil (-уу) + yönelme hâli (-га/-го/-ге/-ко) + укуктуу/милдеттүү/тийиш — resmî kipliğin üç tonu.")),
    harmonyTable([L("Значение","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      [L("имеет право (свобода)","has the right","hakkı var"),kgw("Ар бир жаран билим алууга укуктуу.","m39_16")],
      [L("обязан","is obliged","yükümlü"),kgw("Жаран мыйзамды сактоого милдеттүү.","m39_17")],
      [L("официальное предписание (надлежит)","formal norm (“is to”)","resmî kural (“-malıdır”)"),kgw("Сот адилеттүү чечим чыгарууга тийиш.","m39_18")]]),
    h("div",{class:"note"},L("Разница: укуктуу — свобода; милдеттүү — строгая обязанность; тийиш — официальное «надлежит»: аткарылууга тийиш = аткарылышы керек (надлежит выполнить).","The difference: укуктуу — a freedom; милдеттүү — a strict duty; тийиш — the formal-style “керек”: аткарылууга тийиш = аткарылышы керек (it is to be carried out).","Fark: укуктуу — bir özgürlük; милдеттүү — katı bir görev; тийиш — resmî üslubun «керек»i: аткарылууга тийиш = аткарылышы керек (yerine getirilmelidir)."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Нереальное условие: -са болмок / -са … -мак эле","Unreal condition: -са болмок / -са … -мак эле","Gerçekleşmemiş şart: -са болмок / -са … -мак эле")),
    h("p",{class:"muted"},L("Условная форма (-са/-се/-со/-сө) + -мак/-мек (эле) — действие не произошло, но если бы условие выполнилось, оно бы произошло.","The conditional (-са/-се/-со/-сө) + -мак/-мек (эле) — the action did not happen, but had the condition been met, it would have.","Şart kipi (-са/-се/-со/-сө) + -мак/-мек (эле) — eylem gerçekleşmedi, ama şart yerine gelseydi öyle olurdu.")),
    harmonyTable([L("Тип","Type","Tür"),L("Пример","Example","Örnek")],[
      [L("утвердительная форма","affirmative","olumlu"),kgw("Мыйзам так болсо, бул иш тезирээк чечилмек.","m39_42")],
      [L("отрицательная форма","negative","olumsuz"),kgw("Күбө болбосо, чындык далилденмек эмес.","m39_43")],
      [L("сожаление (-мак элем)","regret (-мак элем)","pişmanlık (-мак элем)"),kgw("Мен мурда билсем, сизге жардам бермек элем.","m39_44")],
      [L("ещё один пример","one more example","bir örnek daha"),kgw("Убагында кайрылса, айыпты төлөбөй эле коймок.","m39_45")]]),
    h("div",{class:"note"},L("«-мак элем» усиливает сожаление: действие было возможным, но не произошло.","“-мак элем” intensifies regret: the action was possible but did not happen.","“-мак элем” pişmanlığı güçlendirir: eylem mümkündü ama gerçekleşmedi."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Отрицательная цель: -бас үчүн / -маганда","Negative purpose: -бас үчүн / -маганда","Olumsuz amaç: -бас үчүн / -маганда")),
    h("p",{class:"muted"},L("«Чтобы не случилось» — отрицательное причастие будущего времени (-бас/-бес/-бос/-бөс) + үчүн. «Если не будет сделано» — отрицательная форма -ганда (-баганда/-бегенде/-богондо/-бөгөндө).","“So that it does not happen” — the negative future participle (-бас/-бес/-бос/-бөс) + үчүн. “If it is not done” — negative -ганда (-баганда/-бегенде/-богондо/-бөгөндө).","“Olmasın diye” — olumsuz gelecek ortacı (-бас/-бес/-бос/-бөс) + үчүн. “Eğer yapılmazsa” — olumsuz -ганда (-баганда/-бегенде/-богондо/-бөгөндө).")),
    harmonyTable([L("Значение","Meaning","Anlam"),L("Пример","Example","Örnek")],[
      [L("отрицательная цель №1","negative purpose #1","olumsuz amaç #1"),kgw("Соттук ката кетирбес үчүн, бардык далилдерди кылдат текшеришет.","m39_50")],
      [L("отрицательная цель №2","negative purpose #2","olumsuz amaç #2"),kgw("Адилетсиздик болбос үчүн, ар бир иш кылдат териштирилет.","m39_51")],
      [L("отрицательное условие №1","negative condition #1","olumsuz şart #1"),kgw("Күбөлөр угулбаганда, чечим туура болбойт.","m39_52")],
      [L("отрицательное условие №2","negative condition #2","olumsuz şart #2"),kgw("Жаран өз укугун билбегенде, аны коргоо кыйын.","m39_53")]])));
  m.append(h("div",{class:"card"},h("h2",{},L("Устойчивые формулы: «мыйзам боюнча», «сот аркылуу»","Set formulas: «мыйзам боюнча», «сот аркылуу»","Kalıp ifadeler: «мыйзам боюнча», «сот аркылуу»")),
    harmonyTable([L("Формула","Formula","Kalıp"),L("Пример","Example","Örnek")],[
      [L("согласно закону","according to the law","kanuna göre"),kgw("мыйзам боюнча","m39_22")],
      [L("через суд","through the court","mahkeme yoluyla"),kgw("сот аркылуу","m39_21")]]),
    h("div",{class:"note"},L("Это опорные словосочетания официального стиля — они постоянно встречаются в обращениях, исковых заявлениях и текстах приговоров.","These are the backbone phrases of the official style — they appear constantly in appeals, statements of claim, and verdicts.","Bunlar resmî üslubun temel kalıplarıdır — başvuru, dava dilekçesi ve hüküm metinlerinde sürekli görülür."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Правовая оценка: оправдание / защита / обвинение","Legal evaluation: acquit / defend / accuse","Hukuki değerlendirme: aklama / savunma / suçlama")),
    h("p",{class:"muted"},L("Правовая оценка: распознай, что делает автор — оправдывает, защищает или обвиняет.","Legal evaluation: recognise what the author is doing — acquitting, defending, or accusing.","Hukuki değerlendirme: yazarın ne yaptığını tanı — aklıyor, savunuyor mu, yoksa suçluyor mu.")),
    harmonyTable([L("Интенция","Intent","Niyet"),L("Кыргызское слово","Kyrgyz word","Kırgızca kelime")],[
      [L("оправдать","to acquit","aklamak"),kgw("актоо","m39_32")],
      [L("защитить (в суде)","to defend (in court)","(mahkemede) savunmak"),"коргоо"],
      [L("обвинить (официально)","to formally accuse","(resmî) suçlamak"),kgw("айыптоо","m39_35")]])));
  const dlg=[
   ["Жон: — Инспектор мени жолдо токтотуп, негизсиз айып салды.","Джон: — Инспектор остановил меня на дороге и выписал необоснованный штраф.","John: — An inspector stopped me on the road and imposed an unfounded fine.","John: — Bir müfettiş beni yolda durdurdu ve asılsız bir ceza yazdı."],
   ["Нургүл: — Ар бир жаран мыйзам алдында адилет мамилеге укуктуу.","Нургуль: — Каждый гражданин имеет право на справедливое отношение перед законом.","Nurgul: — Every citizen has the right to fair treatment before the law.","Nurgül: — Her vatandaşın kanun önünde adil muamele görme hakkı var."],
   ["Жон: — Кандай далил чогултсам болот?","Джон: — Какие доказательства я могу собрать?","John: — What evidence can I gather?","John: — Hangi delilleri toplayabilirim?"],
   ["Нургүл: — Инспектор да өз чечимин негиздөөгө милдеттүү.","Нургуль: — Инспектор тоже обязан обосновать своё решение.","Nurgul: — The inspector is also obliged to justify his decision.","Nurgül: — Müfettiş de kararını gerekçelendirmekle yükümlü."],
   ["Жон: — Эгер айып негизсиз болсо, эмне кылышым керек?","Джон: — Если штраф необоснован, что мне делать?","John: — If the fine is unfounded, what should I do?","John: — Ceza asılsızsa, ne yapmalıyım?"],
   ["Нургүл: — Аны сотко даттанууга укуктуусуң.","Нургуль: — Ты имеешь право обжаловать его в суде.","Nurgul: — You have the right to appeal it in court.","Nurgül: — Mahkemede itiraz etme hakkın var."]];
  weekDialog(m,"Диалог: «Адилетсиз айып»","Dialogue: «Адилетсиз айып»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы -ууга укуктуу / -ууга милдеттүү / -ууга тийиш из карточек модуля и разбери их; 3) расскажи на тему «Адилеттүүлүк» на 15–18 предложений — тема для монолога; 4) составь свой пример на -са болмок и на -бас үчүн.","Tasks: 1) read the dialogue swapping roles; 2) write out the -ууга укуктуу / -ууга милдеттүү / -ууга тийиш forms from the module cards and analyse them; 3) speak about адилеттүүлүк in 15–18 sentences — a topic for a monologue; 4) compose your own example with -са болмок and with -бас үчүн.","Diyalog: «Адилетсиз айып»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) modül kartlarındaki -ууга укуктуу / -ууга милдеттүү / -ууга тийиш biçimlerini yazıp çözümle; 3) адилеттүүлүк hakkında 15–18 cümleyle anlat — monolog konusu; 4) -са болмок ve -бас үчүн ile kendi örneğini oluştur.");
}
