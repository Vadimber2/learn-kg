
/* ---------- М2: Грамматика (справочная вкладка) ---------- */
function renderGrammarM2(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Множественное число -лар: 12 форм","The plural -лар: 12 forms","Çokluk eki -лар: 12 biçim")),
    h("p",{class:"muted"},L("Один суффикс — 12 вариантов: гласная выбирается по гармонии (М0), первая согласная — по последнему звуку слова.","One suffix — 12 variants: the vowel follows harmony (M0), the first consonant follows the word’s final sound.","Tek ek — 12 varyant: ünlü, uyuma göre seçilir (M0); ilk ünsüz ise kelimenin son sesine göre.")),
    harmonyTable([L("Слово кончается на…","Word ends in…","Kelimenin sonu…"),"а, ы, у","е, и","о","ө, ү"],[
      [L("гласную, «р», «й»","a vowel, «р», «й»","ünlü, “р”, “й”"),["-лар","шаарлар"],["-лер","эжелер"],["-лор","тоолор"],["-лөр","түлкүлөр"]],
      [L("звонкую (л, м, н, ң, з, ж, б, г, д)","a voiced consonant (л, м, н, ң, з, ж, б, г, д)","tonlu ünsüz (л, м, н, ң, з, ж, б, г, д)"),["-дар","аялдар"],["-дер","мугалимдер"],["-дор","колдор"],["-дөр","сөздөр"]],
      [L("глухую (п, т, к, с, ш, ч, х)","a voiceless consonant (п, т, к, с, ш, ч, х)","tonsuz ünsüz (п, т, к, с, ш, ч, х)"),["-тар","сааттар"],["-тер","китептер"],["-тор","достор"],["-төр","өсүмдүктөр"]]]),
    h("div",{class:"note"},L("Исключение недели: ","Exception of the week: ","Haftanın istisnası: "),h("span",{class:"kgword"},"бала → балдар"),L(" (гласная выпадает). И запомни на будущее (М5): после числительного — ЕДИНСТВЕННОЕ число: "," (the vowel drops). And note for later (M5): after a numeral the noun stays SINGULAR: "," (ünlü düşer). Ve ileriye not (M5): sayıdan sonra isim TEKİL kalır: "),h("span",{class:"kgword"},"эки бала, беш адам"),L(" — не «эки балдар»."," — not «эки балдар»."," — “эки балдар” değil.")),
    h("p",{class:"muted"},L("«у» в корне ведёт себя как «а»: ","«у» in the stem behaves like «а»: ","Kökteki “у”, “а” gibi davranır: "),h("span",{class:"kgword"},"уулдар, суулар"),".")));

  m.append(h("div",{class:"card"},h("h2",{},L("Илик падеж — чей? кого?","The genitive (илик) case — whose?","İlik (genitif) hâli — kimin?")),
    h("p",{class:"muted"},L("Отвечает на вопросы ","Answers the questions ","Şu sorulara cevap verir: "),h("span",{class:"kgword"},"кимдин?"),L(" (чей? — о людях) и "," (whose? — people) and "," (kimin? — insanlar için) ve "),h("span",{class:"kgword"},"эмненин?"),L(" (чего? — о предметах). Согласная выбирается как у -лар: после гласных — «н», после звонких — «д», после глухих — «т»."," (of what? — things). The consonant is picked like -лар: «н» after vowels, «д» after voiced, «т» after voiceless."," (neyin? — nesneler için). Ünsüz, -лар'daki gibi seçilir: ünlülerden sonra “н”, tonlulardan sonra “д”, tonsuzlardan sonra “т”.")),
    harmonyTable([L("Слово кончается на…","Word ends in…","Kelimenin sonu…"),"а, ы","е, и","о, у","ө, ү"],[
      [L("гласную","a vowel","ünlü"),"-нын","-нин","-нун","-нүн"],
      [L("звонкую","a voiced consonant","tonlu ünsüz"),"-дын","-дин","-дун","-дүн"],
      [L("глухую","a voiceless consonant","tonsuz ünsüz"),"-тын","-тин","-тун","-түн"]]),
    h("h3",{},L("Конструкция «чей + что»: двойное оформление","The “whose + what” construction: double marking","“kimin + ne” kalıbı: çift işaretleme")),
    h("p",{class:"muted"},L("Владелец получает илик, а предмет — аффикс 3-го лица (-ы/-и/-сы/-си):","The owner takes the genitive, the possessed noun takes the 3rd-person affix (-ы/-и/-сы/-си):","Sahip ilik hâlini, sahip olunan sözcük ise 3. kişi iyelik ekini (-ы/-и/-сы/-си) alır:")),
    h("table",{},
      h("tr",{},h("td",{},kgw("атамдын үйү","m2_81")),h("td",{class:"muted"},L("дом моего отца (букв. «отца-моего дом-его»)","my father’s house (lit. “father-my house-his”)","babamın evi (kelimesi kelimesine “babam-ın ev-i”)"))),
      h("tr",{},h("td",{},kgw("апамдын аты","m2_82")),h("td",{class:"muted"},L("имя моей мамы","my mother’s name","annemin adı"))),
      h("tr",{},h("td",{},kgw("мугалимдин китеби","m2_83")),h("td",{class:"muted"},L("книга учителя (п → б!)","the teacher’s book (п → б!)","öğretmenin kitabı (п → б!)"))),
      h("tr",{},h("td",{},kgw("Айданын үйү чоң.","m2_84")),h("td",{class:"muted"},L("Дом Айданы большой.","Aida’s house is big.","Ayda'nın evi büyük.")))),
    h("div",{class:"note"},L("Вопрос: ","Question: ","Soru: "),h("span",{class:"kgword"},"Бул кимдин үйү?"),L(" — Чей это дом? Ответ: "," — Whose house is this? Answer: "," — Bu kimin evi? Cevap: "),h("span",{class:"kgword"},"Бул атамдын үйү."))));

  m.append(h("div",{class:"card"},h("h2",{},L("Аффиксы принадлежности","Possessive affixes","İyelik ekleri")),
    h("p",{class:"muted"},L("«Мой/твой/его» чаще выражается не местоимением, а окончанием на самом слове. Местоимение в илик (менин, сенин…) можно добавить для усиления — или опустить.","“My/your/his” is usually an ending on the noun itself. The genitive pronoun (менин, сенин…) may be added for emphasis — or dropped.","“Benim/senin/onun” çoğu zaman zamirle değil, kelimenin kendi ekiyle anlatılır. İlik hâlindeki zamir (менин, сенин…) vurgu için eklenebilir — ya da hiç söylenmez.")),
    h("div",{class:"tablewrap"},h("table",{},
      h("tr",{},h("th",{},L("Чей (илик)","Whose (genitive)","Kimin (ilik)")),h("th",{},L("После гласной","After a vowel","Ünlüden sonra")),h("th",{},L("После согласной","After a consonant","Ünsüzden sonra")),h("th",{},"ата"),h("th",{},"китеп")),
      h("tr",{},h("td",{},"менин"),h("td",{},"-м"),h("td",{},"-ым/-им/-ум/-үм"),h("td",{},h("span",{class:"kgword"},"атам")),h("td",{},h("span",{class:"kgword"},"китебим"))),
      h("tr",{},h("td",{},"сенин"),h("td",{},"-ң"),h("td",{},"-ың/-иң/-уң/-үң"),h("td",{},h("span",{class:"kgword"},"атаң")),h("td",{},h("span",{class:"kgword"},"китебиң"))),
      h("tr",{},h("td",{},"сиздин"),h("td",{},"-ңыз/-ңиз/-ңуз/-ңүз"),h("td",{},"-ыңыз/-иңиз/-уңуз/-үңүз"),h("td",{},h("span",{class:"kgword"},"атаңыз")),h("td",{},h("span",{class:"kgword"},"китебиңиз"))),
      h("tr",{},h("td",{},"анын"),h("td",{},"-сы/-си/-су/-сү"),h("td",{},"-ы/-и/-у/-ү"),h("td",{},h("span",{class:"kgword"},"атасы")),h("td",{},h("span",{class:"kgword"},"китеби"))),
      h("tr",{},h("td",{},"биздин"),h("td",{},"-быз/-биз/-буз/-бүз"),h("td",{},"-ыбыз/-ибиз/-убуз/-үбүз"),h("td",{},h("span",{class:"kgword"},"атабыз")),h("td",{},h("span",{class:"kgword"},"китебибиз"))),
      h("tr",{},h("td",{},"силердин"),h("td",{},"-ңар/-ңер/-ңор/-ңөр"),h("td",{},"-ыңар/-иңер/-уңор/-уңар/-үңөр"),h("td",{},h("span",{class:"kgword"},"атаңар")),h("td",{},h("span",{class:"kgword"},"китебиңер"))),
      h("tr",{},h("td",{},"сиздердин"),h("td",{},"-ңыздар/-ңиздер/-ңуздар/-ңүздөр"),h("td",{},"-ыңыздар/-иңиздер/-уңуздар/-үңүздөр"),h("td",{},h("span",{class:"kgword"},"атаңыздар")),h("td",{},h("span",{class:"kgword"},"китебиңиздер"))),
      h("tr",{},h("td",{},"алардын"),h("td",{},"-сы/-си/-су/-сү"),h("td",{},"-ы/-и/-у/-ү"),h("td",{},h("span",{class:"kgword"},"атасы")),h("td",{},h("span",{class:"kgword"},"китеби"))))),
    h("p",{class:"muted"},L("Местоимения в илик — исключения из правила соседней карточки: менин, сенин, анын (а не «мендин», «сендин», «алдын»); сиздин, биздин, силердин, сиздердин, алардын строятся по правилу.","The genitive pronouns are exceptions to the rule in the previous card: менин, сенин, анын (not «мендин», «сендин», «алдын»); сиздин, биздин, силердин, сиздердин, алардын follow the rule.","İlik hâlindeki zamirler, yandaki karttaki kuralın istisnasıdır: менин, сенин, анын (“мендин”, “сендин”, “алдын” değil); сиздин, биздин, силердин, сиздердин, алардын kurala uyar.")),
    h("p",{class:"muted"},L("«Они» отдельного аффикса не имеют — берут тот же 3-й лицо, что и «ал»: ","«They» has no affix of its own — it takes the same 3rd person as «ал»: ","“Onlar” için ayrı ek yoktur — “ал” ile aynı 3. kişi ekini alır: "),h("span",{class:"kgword"},"алардын китеби"),L(" (их книга); множественность видна из «алардын»."," (their book); the plural is carried by «алардын»."," (onların kitabı); çokluk “алардын” ile belli olur.")),
    h("div",{class:"note"},L("Широкий гласный в -ңар/-ыңар подчиняется тому же исключению, что и -лар (М2): после «о» идёт «о» (кол → колуңор, тоо → тооңор), после «у» — «а» (жумуш → жумушуңар, суу → сууңар). Формы о-класса стоит подтвердить у преподавателя.","The wide vowel in -ңар/-ыңар follows the same exception as -лар (M2): after «о» it is «о» (кол → колуңор, тоо → тооңор), after «у» it is «а» (жумуш → жумушуңар, суу → сууңар). Ask your teacher to confirm the о-class forms.","-ңар/-ыңар ekindeki geniş ünlü, -лар ekindeki istisnanın aynısına uyar (M2): о sesinden sonra о gelir (кол → колуңор, тоо → тооңор), у sesinden sonra а gelir (жумуш → жумушуңар, суу → сууңар). о sınıfındaki biçimleri öğretmenine doğrulat.")),
    h("div",{class:"note"},L("Чередование на стыке: глухие «п, к, т» озвончаются перед гласной аффикса — ","Joint alternation: voiceless «п, к, т» voice before the affix vowel — ","Ek sınırındaki değişim: tonsuz “п, к, т”, ekin ünlüsünden önce tonlulaşır — "),h("span",{class:"kgword"},"китеп → китебим"),", ",h("span",{class:"kgword"},"дептер → дептериң"),L(". Типичная ошибка — «китепим»."," A typical mistake is «китепим».",". Sık yapılan hata: “китепим”.")),
    h("p",{class:"muted"},L("Семья «по умолчанию» звучит с притяжательными: ","Family words normally carry possessives: ","Aile sözcükleri normalde iyelik ekiyle söylenir: "),h("span",{class:"kgword"},"атам, апам, эжем, иним, үй-бүлөм"),L(" — «отец» без «мой» звучит отстранённо."," — a bare “father” sounds detached."," — “benim” eklenmemiş yalın bir “baba” mesafeli durur."))));

  m.append(h("div",{class:"card"},h("h2",{},L("-ныкы: «чей» отдельным словом","-ныкы: standalone “whose”","-ныкы: ayrı bir kelime olarak “kimin”")),
    h("p",{class:"muted"},L("Когда предмет назван раньше или ясен из контекста, принадлежность выражается самостоятельным словом на -ныкы/-дыкы/-тыкы:","When the possessed thing is already known, possession is a standalone word in -ныкы/-дыкы/-тыкы:","Nesne daha önce anılmışsa ya da bağlamdan belliyse, aidiyet -ныкы/-дыкы/-тыкы ekli bağımsız bir kelimeyle anlatılır:")),
    h("table",{},
      h("tr",{},h("td",{},kgw("меники","m2_86")),h("td",{class:"muted"},L("мой, моё","mine","benim, benimki")),h("td",{},kgw("биздики","m2_89")),h("td",{class:"muted"},L("наш, наше","ours","bizim, bizimki"))),
      h("tr",{},h("td",{},kgw("сеники","m2_87")),h("td",{class:"muted"},L("твой, твоё","yours","senin, seninki")),h("td",{},kgw("силердики","m2_90")),h("td",{class:"muted"},L("ваш, ваше","yours (pl.)","sizin, sizinki"))),
      h("tr",{},h("td",{},kgw("аныкы","m2_88")),h("td",{class:"muted"},L("его, её","his / hers","onun, onunki")),h("td",{},kgw("алардыкы","m2_91")),h("td",{class:"muted"},L("их","theirs","onların, onlarınki")))),
    h("table",{},
      h("tr",{},h("th",{},L("Вопрос","Question","Soru")),h("th",{},L("Ответ","Answer","Cevap"))),
      h("tr",{},h("td",{},kgw("Бул кимдики?","m2_93")),h("td",{},kgw("Бул китеп меники.","m2_92"))),
      h("tr",{},h("td",{},h("span",{class:"kgword"},"Бул үй кимдики?")),h("td",{},h("span",{class:"kgword"},"Биздики.")))),
    h("div",{class:"note"},L("Сравни: ","Compare: ","Karşılaştır: "),h("span",{class:"kgword"},"менин үйүм"),L(" — «мой дом» (предмет назван) · "," — “my house” (thing named) · "," — “benim evim” (nesne anılmış) · "),h("span",{class:"kgword"},"Үй меники."),L(" — «Дом — мой» (предмет уже известен)."," — “The house is mine” (thing already known)."," — “Ev benim” (nesne zaten biliniyor)."))));

  m.append(h("div",{class:"card"},h("h2",{},L("Кто есть кто в семье","Who is who in the family","Ailede kim kimdir")),
    h("p",{class:"muted"},L("Кыргызская система родства различает старших/младших и линию отца/матери:","Kyrgyz kinship distinguishes older/younger and the father’s/mother’s line:","Kırgız akrabalık sistemi büyük/küçüğü ve baba/anne tarafını ayırır:")),
    h("div",{class:"tablewrap"},h("table",{},
      h("tr",{},h("th",{},""),h("th",{},L("старше меня","older than me","benden büyük")),h("th",{},L("младше меня","younger than me","benden küçük"))),
      h("tr",{},h("td",{},L("брат","brother","erkek kardeş")),h("td",{},kgw("ага","m2_14")),h("td",{},kgw("ини","m2_15"))),
      h("tr",{},h("td",{},L("сестра","sister","kız kardeş")),h("td",{},h("span",{class:"kgword"},"эже")),h("td",{},appendKids(h("span",{}),kgw("карындаш","m2_16"),L(" (для брата) · "," (of a man) · "," (bir erkeğin kız kardeşi) · "),kgw("сиңди","m2_17"),L(" (для сестры)"," (of a woman)"," (bir kadının kız kardeşi)")))))),
    h("div",{class:"tablewrap"},h("table",{},
      h("tr",{},h("th",{},""),h("th",{},L("по отцу","father’s line","baba tarafı")),h("th",{},L("по маме","mother’s line","anne tarafı"))),
      h("tr",{},h("td",{},L("дедушка","grandfather","dede")),h("td",{},kgw("чоң ата","m2_18")),h("td",{},kgw("таята","m2_20"))),
      h("tr",{},h("td",{},L("бабушка","grandmother","nine")),h("td",{},kgw("чоң апа","m2_19")),h("td",{},kgw("таэне","m2_21"))))),
    h("div",{class:"note"},L("Обращения «Байке!» и «Эже!» из М0 — те же слова родства: к незнакомым старшим обращаются как к родне. «Старший брат» и «старшая сестра» здесь удобно запомнить сразу в притяжательной форме: ","The М0 addresses «Байке!» and «Эже!» are the same kinship words: strangers are addressed as family. It is handy to memorise “my older brother/sister” directly in the possessive: ","M0'daki “Байке!” ve “Эже!” hitapları aynı akrabalık sözcükleridir: tanımadığın büyüklere akraban gibi seslenilir. “Ağabeyim” ve “ablam” sözcüklerini doğrudan iyelikli biçimde ezberlemek işe yarar: "),h("span",{class:"kgword"},"агам, эжем"),".")));

  m.append(h("div",{class:"card"},h("h2",{},L("Разговор о семье — экзаменационный шаблон","Talking about family — the exam template","Aileden söz etmek — sınav kalıbı")),
    h("table",{},
      h("tr",{},h("th",{},L("Вопрос","Question","Soru")),h("th",{},L("Шаблон ответа","Answer template","Cevap kalıbı"))),
      h("tr",{},h("td",{},kgw("Үй-бүлөңүздө канча адам бар?","m2_49")),h("td",{},kgw("Үй-бүлөбүздө беш адам бар.","m2_58"))),
      h("tr",{},h("td",{},kgw("Балдарыңыз барбы?","m2_50")),h("td",{},appendKids(h("span",{}),kgw("Менин эки балам бар.","m2_59")," / ",kgw("Менин балдарым жок.","m2_60")))),
      h("tr",{},h("td",{},kgw("Сиз үй-бүлөлүүсүзбү?","m2_54")),h("td",{},appendKids(h("span",{}),kgw("Мен үй-бүлөлүүмүн.","m2_61")," / ",kgw("Мен бойдокмун.","m2_62")))),
      h("tr",{},h("td",{},kgw("Атаңыз ким болуп иштейт?","m2_52")),h("td",{},kgw("Атам дарыгер болуп иштейт.","m2_63"))),
      h("tr",{},h("td",{},kgw("Бир туугандарыңыз барбы?","m2_51")),h("td",{},kgw("Менин агам жана эжем бар.","m2_66")))),
    h("div",{class:"note"},L("Конструкция «у меня есть/нет»: [чей + что] + ","The “I have / don’t have” construction: [whose + what] + ","“Benim … var / yok” kalıbı: [kimin + ne] + "),h("span",{class:"kgword"},"бар / жок"),L(". Обрати внимание: после числительного — ед. число («эки балам», не «эки балдарым»). По методике §9, п. 8 отвечай про СВОЮ семью — на экзамене спросят именно о ней."," Note the singular after numerals («эки балам», not «эки балдарым»). Per methodology §9, item 8 answer about YOUR OWN family — that is what the exam asks.",". Dikkat: sayıdan sonra tekil gelir (“эки балам”, “эки балдарым” değil). Metodoloji §9, madde 8 gereği KENDİ ailen hakkında cevap ver — sınavda tam olarak o sorulur."))));
}
