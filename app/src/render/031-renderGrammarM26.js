
function renderGrammarM26(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Собираюсь: -макчы","Intending: -макчы","Niyet: -макчы")),
    h("p",{class:"muted"},L("Ниет ыңгай — форма планов и намерений: то, что вы сами решили сделать. Тема «Менин пландарым» рассказывается именно ею.","The intentional mood expresses plans and intentions — what you yourself have decided to do. The topic «Менин пландарым» is told with it.","Niyet kipi plan ve niyetleri anlatır. «Менин пландарым» konusu bununla anlatılır.")),
    harmonyTable([L("Кто","Who","Kim"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("я","I","ben"),"-макчы/-мөкчү + -мын",kgw("Келерки жылы мамлекеттик тест тапшырмакчымын.","m26_09")],
      [L("мы","we","biz"),"-макчы/-мөкчү + -быз",kgw("Биз жайында айылга бармакчыбыз.","m26_10")],
      [L("он/она","he/she","o"),"-макчы/-мөкчү",kgw("Ал жаңы кесип үйрөнмөкчү.","m26_11")],
      [L("вопрос","question","soru"),"-макчы/-мөкчү + -сыз?",kgw("Эмне кылмакчысыз?","m26_13")]]),
    h("div",{class:"note"},L("Ряд гласной выбирает сингармонизм: тапшырмакчы, үйрөнмөкчү, котормокчу, келмекчи. Неисполненное намерение — «-макчы элек»: ","Vowel harmony picks the row: тапшырмакчы, үйрөнмөкчү, котормокчу, келмекчи. An unfulfilled intention — «-макчы элек»: ","Ünlü uyumu sırayı seçer: тапшырмакчы, үйрөнмөкчү, котормокчу, келмекчи. Gerçekleşmemiş niyet — «-макчы элек»: "),kgw("Быйыл унаа алмакчы элек, кийинкиге калтырдык.","m26_65"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Наверное будет: -ар/-бас","Probably will: -ар/-бас","Muhtemelen: -ар/-бас")),
    h("p",{class:"muted"},L("Арсар келер — будущее-предположение: говорящий не уверен. Точное будущее — -ат (келет), предположительное — -ар (келер).","The probable future: the speaker is not certain. The definite future is -ат (келет), the probable one is -ар (келер).","Belirsiz gelecek: konuşan emin değildir. Kesin gelecek -ат (келет), belirsiz -ар (келер).")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Шаблон","Template","Kalıp"),L("Пример","Example","Örnek")],[
      [L("наверное будет","probably will","muhtemelen olur"),"-ар/-ер/-ор/-өр",kgw("Эртең жаан жаар.","m26_15")],
      [L("возможно придёт","perhaps will come","belki gelir"),L("балким + -ер","балким + -ер","балким + -ер"),kgw("Балким, ал кечинде келер.","m26_16")],
      [L("наверное не будет","probably will not","muhtemelen olmaz"),"-бас/-бес/-бос/-бөс",kgw("Мындай мүмкүнчүлүк кайра келбес.","m26_17")],
      [L("обобщение","a general truth","genelleme"),"-ер",kgw("Көп окуган адам көп билер.","m26_18")]]),
    h("div",{class:"note"},kgw("Убакыт көрсөтөр.","m26_67"),L(" — вежливый способ не давать точного обещания."," — a polite way to avoid an exact promise."," — kesin söz vermemenin kibar yolu."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Убакытты үнөмдөө","Saving time","Zaman tasarrufu")),
    harmonyTable([L("Принцип","Principle","İlke"),L("Кыргызча","In Kyrgyz","Kırgızca")],[
      [L("не откладывать","do not postpone","erteleme"),kgw("Бүгүнкү ишти эртеңкиге калтырба.","m26_23")],
      [L("главное — первым","key task first","önce en önemlisi"),kgw("Эң маанилүү иштен баштайм.","m26_26")],
      [L("понемногу каждый день","a little every day","her gün biraz"),kgw("Тил үйрөнүүгө күнүнө бир саат бөлөм.","m26_71")],
      [L("время дороже всего","time is precious","zaman değerlidir"),kgw("Убакыт — эң кымбат байлык.","m26_48")]])));
  const dlg=[["А: — Келерки жылга кандай пландарыңыз бар?","А: — Какие у вас планы на следующий год?","A: — What are your plans for next year?","A: — Gelecek yıl planlarınız neler?"],
             ["Б: — Мамлекеттик тест тапшырмакчымын. Ага күн сайын даярданам.","Б: — Собираюсь сдавать госэкзамен. Готовлюсь к нему каждый день.","B: — I intend to take the state language test. I prepare for it every day.","B: — Devlet dil sınavına girmeyi düşünüyorum. Her gün hazırlanıyorum."],
             ["А: — Үлгүрөсүзбү? Убакыт тез өтөт.","А: — Успеете? Время быстро идёт.","A: — Will you make it? Time flies.","A: — Yetişir misiniz? Zaman hızlı geçiyor."],
             ["Б: — Үлгүрөм деп ишенем. Ишти кечиктирбөөгө аракет кылам.","Б: — Верю, что успею. Стараюсь не откладывать дела.","B: — I believe I will. I try not to postpone things.","B: — Yetişeceğime inanıyorum. İşleri ertelememeye çalışırım."],
             ["А: — Өргүүңүздү кайда өткөрмөкчүсүз?","А: — Где собираетесь провести отпуск?","A: — Where do you intend to spend your leave?","A: — İzninizi nerede geçireceksiniz?"],
             ["Б: — Балким, Ысык-Көлгө барармын. Убакыт көрсөтөр.","Б: — Возможно, поеду на Иссык-Куль. Время покажет.","B: — Perhaps I will go to Issyk-Kul. Time will tell.","B: — Belki Issık Göl'e giderim. Zaman gösterir."]];
  weekDialog(m,"Диалог: «Пландар»","Dialogue: «Пландар»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы -макчы и -ар/-бас, разбери состав; 3) расскажи «Менин пландарым» на 12–15 предложений — минимум четыре -макчы; 4) опиши свой распорядок дня и одно правило экономии времени.","Tasks: 1) read the dialogue swapping roles; 2) write out the -макчы and -ар/-бас forms and analyse them; 3) tell “Менин пландарым” in 12–15 sentences — at least four -макчы; 4) describe your daily routine and one time-saving rule.","Diyalog: «Пландар»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -макчы ve -ар/-бас biçimlerini yazıp çözümle; 3) “Менин пландарым” konusunu 12–15 cümleyle anlat — en az dört -макчы; 4) günlük düzenini ve bir zaman tasarrufu kuralını anlat.");
}
