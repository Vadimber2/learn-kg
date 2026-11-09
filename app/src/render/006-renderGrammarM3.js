function renderGrammarM3(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Барыш падеж: куда? кому? (-га/-ге/-го/-гө)","The dative case: where to? to whom? (-га/-ге/-го/-гө)","Barış (yönelme) hâli: nereye? kime? (-га/-ге/-го/-гө)")),
    h("p",{class:"muted"},L("Направление и адресат: иду В школу, звоню ЕМУ. Гласная — по гармонии, согласная зависит от последнего звука слова:","Direction and addressee: going TO school, calling TO him. The vowel follows harmony, the consonant depends on the word’s final sound:","Yön ve muhatap: okulA gidiyorum, onA telefon ediyorum. Ünlü uyuma göre, ünsüz ise kelimenin son sesine göre seçilir:")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),"а, ы, у","э/е, и","о","ө, ү"],[
      [L("Гласная аффикса","Affix vowel","Ekin ünlüsü"),"а","е","о","ө"]]),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),L("Вариант","Variant","Varyant"),L("Примеры","Examples","Örnekler")],[
      [L("гласной или звонкой","a vowel or voiced","ünlü ya da tonlu ünsüz"),h("b",{},"-га/-ге/-го/-гө"),appendKids(h("span",{}),h("span",{class:"kgword"},"китепканага"),", ",h("span",{class:"kgword"},"шаарга"),", ",kgw("үйгө","m3_90"))],
      [L("глухой (п, т, к, с, ч, ш)","voiceless (п, т, к, с, ч, ш)","tonsuz (п, т, к, с, ч, ш)"),h("b",{},"-ка/-ке/-ко/-кө"),appendKids(h("span",{}),kgw("мектепке","m3_87"),", ",kgw("жумушка","m3_89"),", ",kgw("сабакка","m3_91"))]]),
    h("div",{class:"note"},L("Личные местоимения — исключения: мен → ","Personal pronouns are irregular: мен → ","Kişi zamirleri istisnadır: мен → "),kgw("мага","m3_92"),L(" (мне), сен → "," (to me), сен → "," (bana), сен → "),kgw("сага","m3_93"),L(" (тебе), ал → "," (to you), ал → "," (sana), ал → "),h("span",{class:"kgword"},"ага"),L(" (ему/ей). Вопросы: "," (to him/her). Questions: "," (ona). Sorular: "),kgw("кимге?","m3_94"),L(" — кому?, "," — to whom?, "," — kime?, "),h("span",{class:"kgword"},"эмнеге?"),L(" — чему? зачем?"," — to what? why?"," — neye? niçin?")),
    h("p",{class:"muted"},L("Образцы: ","Samples: ","Örnekler: "),kgw("Мен эртең менен жумушка барам.","m3_122")," · ",kgw("Кечинде үйгө келем.","m3_123")),
    gramVideos("m3.barysh")));

  m.append(h("div",{class:"card"},h("h2",{},L("Жатыш падеж: где? (-да/-де/-до/-дө)","The locative case: where? (-да/-де/-до/-дө)","Catış (bulunma) hâli: nerede? (-да/-де/-до/-дө)")),
    h("p",{class:"muted"},L("Место: работаю В школе, книга НА столе. После глухих согласных «д» оглушается в «т»:","Location: working AT school, the book is ON the table. After voiceless consonants «д» devoices to «т»:","Yer: okulDA çalışıyorum, kitap masaDA. Tonsuz ünsüzlerden sonra “д” tonsuzlaşıp “т” olur:")),
    harmonyTable([L("После чего","After","Hangi sesten sonra"),L("Вариант","Variant","Varyant"),L("Примеры","Examples","Örnekler")],[
      [L("гласной или звонкой","a vowel or voiced","ünlü ya da tonlu ünsüz"),h("b",{},"-да/-де/-до/-дө"),appendKids(h("span",{}),kgw("китепканада","m3_100"),", ",kgw("үйдө","m3_98"),", ",h("span",{class:"kgword"},"көлдө"))],
      [L("глухой (п, т, к, с, ч, ш)","voiceless (п, т, к, с, ч, ш)","tonsuz (п, т, к, с, ч, ш)"),h("b",{},"-та/-те/-то/-тө"),appendKids(h("span",{}),kgw("мектепте","m3_95"),", ",kgw("жумушта","m3_97"),", ",h("span",{class:"kgword"},"Бишкекте"))]]),
    h("div",{class:"note"},L("Вопросы: ","Questions: ","Sorular: "),h("span",{class:"kgword"},"кайда?"),L(" — где? (М1), "," — where? (M1), "," — nerede? (M1), "),kgw("кимде?","m3_101"),L(" — у кого? Жатыш от местоимений: менде, сенде, сизде, анда — «менде китеп бар» = у меня есть книга (конструкция «бар» — М2)."," — who has? Locative of pronouns: менде, сенде, сизде, анда — «менде китеп бар» = I have a book (the «бар» construction — M2)."," — kimde? Zamirlerin bulunma hâli: менде, сенде, сизде, анда — “менде китеп бар” = bende kitap var (bu “бар” kalıbı M2'de).")),
    h("p",{class:"muted"},L("Сравни пары: ","Compare the pairs: ","Çiftleri karşılaştır: "),h("span",{class:"kgword"},"мектепке")," (",L("в школу — куда?","to school — where to?","okula — nereye?"),") ↔ ",h("span",{class:"kgword"},"мектепте")," (",L("в школе — где?","at school — where?","okulda — nerede?"),") · ",h("span",{class:"kgword"},"үйгө")," ↔ ",h("span",{class:"kgword"},"үйдө")),
    gramVideos("m3.jatysh","m3.vna")));

  m.append(h("div",{class:"card"},h("h2",{},L("Настоящее время: -ып жатат (действие сейчас)","The present continuous: -ып жатат (happening now)","Şimdiki zaman: -ып жатат (şu anda olan iş)")),
    h("p",{class:"muted"},L("«Иштейм» — работаю вообще (аорист, М1), «иштеп жатам» — работаю ПРЯМО СЕЙЧАС. Форма: деепричастие на -ып + жатат.","«Иштейм» — I work in general (aorist, M1), «иштеп жатам» — I am working RIGHT NOW. Form: the -ып converb + жатат.","“Иштейм” — genel olarak çalışırım (geniş zaman, M1), “иштеп жатам” — TAM ŞU ANDA çalışıyorum. Yapısı: -ып zarf-fiili + жатат.")),
    harmonyTable([L("Основа","Stem","Gövde"),L("Деепричастие","Converb","Zarf-fiil"),L("Пример","Example","Örnek")],[
      ["жаз (а/ы)",h("b",{},"-ып"),kgw("жазып жатат","m3_104")],
      ["бер (е/и)",h("b",{},"-ип"),h("span",{class:"kgword"},"берип жатат")],
      ["отур (о/у)",h("b",{},"-уп"),h("span",{class:"kgword"},"отуруп жатат")],
      ["көр (ө/ү)",h("b",{},"-үп"),h("span",{class:"kgword"},"көрүп жатат")],
      [L("на гласную: оку, иште","vowel-final: оку, иште","ünlüyle biten: оку, иште"),h("b",{},"-п"),appendKids(h("span",{}),kgw("окуп жатат","m3_103"),", ",kgw("иштеп жатат","m3_102"))]]),
    harmonyTable([L("Лицо","Person","Kişi"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      ["мен","… жатам",kgw("Мен иштеп жатам.","m3_106")],
      ["сен","… жатасың",h("span",{class:"kgword"},"Сен окуп жатасың.")],
      ["сиз","… жатасыз",kgw("Эмне кылып жатасыз?","m3_108")],
      ["ал","… жатат",h("span",{class:"kgword"},"Ал эс алып жатат.")],
      ["биз","… жатабыз",kgw("Биз сабакка бара жатабыз.","m3_124")]]),
    h("div",{class:"note"},L("Глаголы движения — особые: «идёт (сюда)» = ","Movement verbs are special: “is coming” = ","Hareket fiilleri özeldir: “(buraya) geliyor” = "),kgw("келе жатат","m3_109"),L(", «идёт (туда)» = ",", “is going” = ",", “(oraya) gidiyor” = "),h("span",{class:"kgword"},"бара жатат"),L(" (не «барып жатат»). Вопрос: "," (not «барып жатат»). Question: "," (“барып жатат” değil). Soru: "),kgw("Кайда бара жатасыз?","m3_115")),
    h("div",{class:"note"},L("Сравни: ","Compare: ","Karşılaştır: "),h("span",{class:"kgword"},"Мен мектепте иштейм"),L(" (вообще, каждый день) ↔ "," (in general, every day) ↔ "," (genel olarak, her gün) ↔ "),h("span",{class:"kgword"},"Мен азыр иштеп жатам"),L(" (прямо сейчас). Слова-маркеры: азыр — сейчас, адатта — обычно, күн сайын — каждый день."," (right now). Marker words: азыр — now, адатта — usually, күн сайын — every day."," (tam şu anda). İşaret kelimeleri: азыр — şimdi, адатта — genellikle, күн сайын — her gün."))));

  const dlg=[["А: — Саламатсызбы! Ким болуп иштейсиз?","А: — Здравствуйте! Кем Вы работаете?","A: — Hello! What do you work as?","A: — Merhaba! Ne iş yapıyorsunuz?"],
             ["Б: — Мен мугалим болуп иштейм. Мектепте иштейм.","Б: — Я работаю учителем. Работаю в школе.","B: — I work as a teacher. I work at a school.","B: — Öğretmen olarak çalışıyorum. Okulda çalışıyorum."],
             ["А: — Жумушуңуз канчада башталат?","А: — Во сколько начинается Ваша работа?","A: — What time does your work start?","A: — İşiniz saat kaçta başlıyor?"],
             ["Б: — Саат сегизде башталат, саат төрттө бүтөт.","Б: — Начинается в восемь, заканчивается в четыре.","B: — It starts at eight and ends at four.","B: — Saat sekizde başlıyor, saat dörtte bitiyor."],
             ["А: — Азыр эмне кылып жатасыз?","А: — Что Вы сейчас делаете?","A: — What are you doing now?","A: — Şu anda ne yapıyorsunuz?"],
             ["Б: — Мен сабакка даярданып жатам. Сизчи?","Б: — Я готовлюсь к уроку. А Вы?","B: — I am preparing for a lesson. And you?","B: — Derse hazırlanıyorum. Ya siz?"],
             ["А: — Мен университетте окуйм. Азыр китепканага бара жатам.","А: — Я учусь в университете. Сейчас иду в библиотеку.","A: — I study at a university. Now I am going to the library.","A: — Ben üniversitede okuyorum. Şimdi kütüphaneye gidiyorum."],
             ["Б: — Ийгилик каалайм!","Б: — Желаю удачи!","B: — Good luck!","B: — Başarılar dilerim!"]];
  const texts=weekDialog(m,"Диалог: «Ким болуп иштейсиз?»","Dialogue: «Ким болуп иштейсиз?»",dlg,
    "Задание: 1) прочитай диалог дважды, меняясь ролями; 2) выпиши все слова в барыш (-га/-ка) и жатыш (-да/-та) падежах и определи падеж; 3) найди формы на -ып жатат и назови лицо; 4) разыграй диалог про СВОЮ работу или учёбу.","Tasks: 1) read the dialogue twice, swapping roles; 2) list every word in the dative (-га/-ка) and locative (-да/-та) and name the case; 3) find the -ып жатат forms and name the person; 4) act it out about YOUR OWN work or study.","Diyalog: «Ким болуп иштейсиз?»","Görev: 1) diyaloğu rolleri değiştirerek iki kez oku; 2) barış (-га/-ка) ve catış (-да/-та) hâlindeki kelimeleri yaz ve hâllerini belirle; 3) -ып жатат biçimlerini bul ve kişisini söyle; 4) KENDİ işin ya da eğitimin hakkında diyaloğu canlandır.");
  texts.append(h("h3",{},L("Текст: «Менин күн тартибим»","Text: «Менин күн тартибим»","Metin: “Менин күн тартибим”")),
    h("p",{},h("span",{class:"kgword"},"Менин атым Гүлназ. Мен мугалиммин, мектепте иштейм. Күн сайын эрте турам. Эртең менен саат сегизде жумушка барам. Сабак саат тогузда башталат. Түштө тыныгуу бар. Мен түштө китепканага барам, китеп окуйм. Жумушум саат беште бүтөт. Кечинде үйгө келем. Азыр мен үйдө эс алып жатам, чай ичип жатам.")),
    h("p",{class:"muted"},L("Разбор: жумушка/китепканага — барыш (куда?); мектепте/үйдө — жатыш (где?); эс алып жатам, ичип жатам — «прямо сейчас». Прочитай текст вслух, затем напиши такой же о своём дне (5–8 предложений) — это письменное задание недели.","Notes: жумушка/китепканага — dative (where to?); мектепте/үйдө — locative (where?); эс алып жатам, ичип жатам — “right now”. Read the text aloud, then write the same about your own day (5–8 sentences) — this week’s writing task.","Çözümleme: жумушка/китепканага — yönelme (nereye?); мектепте/үйдө — bulunma (nerede?); эс алып жатам, ичип жатам — “tam şu anda”. Metni yüksek sesle oku, sonra kendi günün hakkında aynısını yaz (5–8 cümle) — bu, haftanın yazma ödevi.")));
}
