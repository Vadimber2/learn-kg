
function renderGrammarM4(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Чыгыш падеж: откуда? (-дан/-ден/-дон/-дөн)","The ablative case: from where? (-дан/-ден/-дон/-дөн)","Çıgış (çıkma) hâli: nereden? (-дан/-ден/-дон/-дөн)")),
    h("p",{class:"muted"},L("Исходная точка: ИЗ дома, С работы, ОТ кого. После глухих согласных «д» оглушается в «т»:","Starting point: FROM home, FROM work, FROM whom. After voiceless consonants «д» devoices to «т»:","Çıkış noktası: evDEN, işTEN, kimDEN. Tonsuz ünsüzlerden sonra “д” tonsuzlaşıp “т” olur:")),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),L("Вариант","Variant","Varyant"),L("Примеры","Examples","Örnekler")],[
      [L("гласной или звонкой","a vowel or voiced","ünlü ya da tonlu ünsüz"),h("b",{},"-дан/-ден/-дон/-дөн"),appendKids(h("span",{}),kgw("үйдөн","m4_61"),", ",kgw("шаардан","m4_64"),", ",h("span",{class:"kgword"},"китепканадан"))],
      [L("глухой (п, т, к, с, ч, ш)","voiceless (п, т, к, с, ч, ш)","tonsuz (п, т, к, с, ч, ш)"),h("b",{},"-тан/-тен/-тон/-төн"),appendKids(h("span",{}),kgw("мектептен","m4_62"),", ",kgw("жумуштан","m4_63"),", ",h("span",{class:"kgword"},"Бишкектен"))]]),
    h("div",{class:"note"},L("Теперь у тебя полная тройка направлений: ","You now have the full direction triple: ","Artık yön üçlüsünün tamamı elinde: "),h("span",{class:"kgword"},"үйгө"),L(" (куда, М3) · "," (where to, M3) · "," (nereye, M3) · "),h("span",{class:"kgword"},"үйдө"),L(" (где, М3) · "," (where, M3) · "," (nerede, M3) · "),h("span",{class:"kgword"},"үйдөн"),L(" (откуда, М4). Вопросы: кайда? кайдан? "," (from where, M4). Questions: кайда? кайдан? "," (nereden, M4). Sorular: кайда? кайдан? "),kgw("кимден?","m4_67")),
    gramVideos("m4.chygysh")));
  m.append(h("div",{class:"card"},h("h2",{},L("Послелоги места","Place postpositions","Yer edatları")),
    h("p",{class:"muted"},L("Точное расположение: существительное в илик падеже (М2) + послелок с притяжательным окончанием:","Exact location: the noun in the genitive (M2) + a postposition with a possessive ending:","Kesin konum: ilik hâlindeki isim (M2) + iyelik ekli son çekim edatı:")),
    h("table",{},
      h("tr",{},h("td",{},kgw("үстүндө","m4_54")),h("td",{class:"muted"},L("на","on","üstünde")),h("td",{},h("span",{class:"kgword"},"үстөлдүн үстүндө"))),
      h("tr",{},h("td",{},kgw("астында","m4_55")),h("td",{class:"muted"},L("под","under","altında")),h("td",{},h("span",{class:"kgword"},"керебеттин астында"))),
      h("tr",{},h("td",{},kgw("жанында","m4_53")),h("td",{class:"muted"},L("рядом с","next to","yanında")),h("td",{},h("span",{class:"kgword"},"үйдүн жанында"))),
      h("tr",{},h("td",{},kgw("алдында","m4_51")),h("td",{class:"muted"},L("перед","in front of","önünde")),h("td",{},h("span",{class:"kgword"},"үйдүн алдында"))),
      h("tr",{},h("td",{},kgw("артында","m4_52")),h("td",{class:"muted"},L("за","behind","arkasında")),h("td",{},h("span",{class:"kgword"},"үйдүн артында"))),
      h("tr",{},h("td",{},kgw("ичинде","m4_56")),h("td",{class:"muted"},L("внутри","inside","içinde")),h("td",{},h("span",{class:"kgword"},"шкафтын ичинде"))),
      h("tr",{},h("td",{},kgw("маңдайында","m4_60")),h("td",{class:"muted"},L("напротив","opposite","karşısında")),h("td",{},h("span",{class:"kgword"},"үйдүн маңдайында"))),
      h("tr",{},h("td",{},kgw("арасында","m4_59")),h("td",{class:"muted"},L("между","between","arasında")),h("td",{},h("span",{class:"kgword"},"эки үйдүн арасында")))),
    h("div",{class:"note"},L("Конструкция «бар/жок» + место — главный шаблон недели: ","The бар/жок + place pattern is the key template of the week: ","“бар/жок” + yer kalıbı, haftanın ana kalıbıdır: "),kgw("Үйдүн жанында парк бар.","m4_95"),L(" «Никого/ничего нет» — всегда с жок: "," “Nobody/nothing” always takes жок: "," “Kimse/hiçbir şey yok” her zaman жок ile kurulur: "),kgw("Үйдө эч ким жок.","m4_71"))));
  const dlg=[["А: — Сиз кайда жашайсыз?","А: — Где Вы живёте?","A: — Where do you live?","A: — Nerede yaşıyorsunuz?"],
             ["Б: — Мен Бишкекте, кичи районда жашайм.","Б: — Я живу в Бишкеке, в микрорайоне.","B: — I live in Bishkek, in a microdistrict.","B: — Bişkek'te, toplu konut bölgesinde yaşıyorum."],
             ["А: — Үйүңүз кандай?","А: — Какой у Вас дом?","A: — What is your home like?","A: — Eviniz nasıl?"],
             ["Б: — Батирим беш кабаттуу үйдө, үчүнчү кабатта. Үч бөлмө бар.","Б: — Квартира в пятиэтажке, на третьем этаже. Три комнаты.","B: — A flat in a five-storey building, third floor. Three rooms.","B: — Dairem beş katlı bir binada, üçüncü katta. Üç oda var."],
             ["А: — Жакын жерде эмне бар?","А: — Что есть поблизости?","A: — What is nearby?","A: — Yakında ne var?"],
             ["Б: — Үйдүн жанында парк, мектептин маңдайында дүкөн бар.","Б: — Рядом с домом парк, напротив школы магазин.","B: — A park next to the house, a shop opposite the school.","B: — Evin yanında park, okulun karşısında mağaza var."],
             ["А: — Айылдан келдиңизби?","А: — Вы приехали из села?","A: — Did you come from a village?","A: — Köyden mi geldiniz?"],
             ["Б: — Ооба, Ысык-Көлдөн келдим.","Б: — Да, я с Иссык-Куля.","B: — Yes, I came from Issyk-Kul.","B: — Evet, Issık Gölü'nden geldim."]];
  weekDialog(m,"Диалог: «Сиз кайда жашайсыз?»","Dialogue: «Сиз кайда жашайсыз?»",dlg,
    "Задание: 1) прочитай диалог дважды, меняясь ролями; 2) выпиши слова в барыш/жатыш/чыгыш падежах и определи падеж; 3) найди послелоги места; 4) опиши СВОЁ жильё письменно 5–8 предложений — это жазуу-задание недели (методика §9, п. 8).","Tasks: 1) read the dialogue twice, swapping roles; 2) list the dative/locative/ablative forms and name the case; 3) find the place postpositions; 4) describe YOUR OWN home in 5–8 sentences — this week’s writing task (methodology §9, item 8).","Diyalog: «Сиз кайда жашайсыз?»","Görev: 1) diyaloğu rolleri değiştirerek iki kez oku; 2) barış/catış/çıgış hâlindeki kelimeleri yaz ve hâllerini belirle; 3) yer edatlarını bul; 4) KENDİ evini 5–8 cümleyle yazılı anlat — bu, haftanın жазуу ödevi (metodoloji §9, madde 8).");
}
