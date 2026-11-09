
/* М43 — восьмой модуль курса B2: «Адам жана жаратылыш. Суу – өмүр булагы».
   Тема курса: человек и природа; пословица «Суу – өмүр булагы» — тема для письма
   (небольшая статья с причиной, условием, обстоятельствами и результатом).
   B2-механика (канон B1 сохраняется):
   qKy на кыргызском, дефиниции def через выученное (≤20% незнакомых, разбор —
   DEF_GLOSS_M43), плюс полная причинно-следственная грамматика B2: -гандыктан,
   -ганынан улам, -уунун натыйжасында, -ганы үчүн, ошонун айынан, натыйжада;
   условие → следствие -са…-ат; процесс/результат -ып баратат, -бай калуу,
   -ып бүтүү. Базовая лексика природы (тоо, көл, дарыя, мөңгү, жаратылыш,
   экология, климат) введена в B1 (M16, M27, M30, M32) — здесь reuse через alias,
   новые единицы B2 — абстрактные (экосистема, флора, фауна, парник эффекти)
   и официальные формулы охраны природы. Гейты — как у B1 (tests/b2.test.js). */
const CATS_M43 = {
  tapshyrma:"Тапшырма тили (задания B2)", jaratylysh:"Жаратылыш жана экология",
  suu:"Вода и водные ресурсы", sebep:"Причина-следствие: -гандыктан, улам, натыйжасында (образцы)",
  shart:"Условие → результат: -са … -ат (образцы)", process:"Процесс и результат: -ып баратат, -бай калуу (образцы)",
  coruu:"Охрана окружающей среды", suroo:"Вопросы темы", joop:"Ответы-шаблоны (сочинение)",
  etish:"Глаголы модуля", makal:"Пословица: Суу – өмүр булагы", paydaluu:"Полезные слова"
};
const VOCAB_M43 = [
 // --- Тапшырма тили: формулировки B2 (Жазуу 15–18 сүйлөм, Сүйлөө 2 мүнөт, баа берүү)
 {id:"m43_01",cat:"tapshyrma",ky:"Берилген макал боюнча талапка ылайык көлөмдө жазуу жүзүндө баяндап бериңиз.",ru:"Изложите письменно свои мысли по заданной пословице в требуемом объёме.",en:"Within the required length, describe the given proverb in writing.",tr:"Verilen atasözü hakkında gerekli uzunlukta yazılı olarak anlatın.",def:"Бул — «Жазуу» субтестинин ортодон жогору деңгээлиндеги тапшырмасы."},
 {id:"m43_02",cat:"tapshyrma",ky:"Берилген тема боюнча эки мүнөттүн ичинде оозеки баяндап бериңиз.",ru:"Расскажите устно на заданную тему в течение двух минут.",en:"Speak on the given topic for two minutes.",tr:"Verilen konu hakkında iki dakika içinde sözlü olarak anlatın.",def:"Бул — «Сүйлөө» субтестинин экинчи тапшырмасы; убакыт мурунку деңгээлдерге караганда узагыраак."},
 {id:"m43_03",cat:"tapshyrma",ky:"Тексттеги автордун көз карашын аныктаңыз.",ru:"Определите точку зрения автора в тексте.",en:"Identify the author’s point of view in the text.",tr:"Metindeki yazarın bakış açısını belirleyin.",def:"«Окуу» субтестинин тапшырмасы: автор эмнени ойлойт деп аныктоо."},
 {id:"m43_04",cat:"tapshyrma",ky:"Окуянын себебин жана натыйжасын түшүндүрүңүз.",ru:"Объясните причину и следствие события.",en:"Explain the cause and effect of the event.",tr:"Olayın nedenini ve sonucunu açıklayın.",def:"Себеп-натыйжа тапшырмасы: эмне үчүн болду, эмнеге алып келди."},
 {id:"m43_05",cat:"tapshyrma",ky:"Автордун оюна карата өз пикириңизди билдириңиз.",ru:"Выразите своё мнение по поводу мысли автора.",en:"Express your opinion about the author’s idea.",tr:"Yazarın düşüncesi hakkında kendi görüşünüzü belirtin.",def:"Ортодон жогору деңгээлдеги баа берүү тапшырмасы: макул болосузбу, жокпу."},
 // --- Жаратылыш жана экология
 {id:"m43_06",cat:"jaratylysh",ky:"флора",ru:"флора (растительный мир)",en:"flora (the plant world)",tr:"flora (bitki dünyası)",def:"Белгилүү бир аймактагы өсүмдүктөрдүн бардыгы."},
 {id:"m43_07",cat:"jaratylysh",ky:"фауна",ru:"фауна (животный мир)",en:"fauna (the animal world)",tr:"fauna (hayvanlar dünyası)",def:"Белгилүү бир аймактагы жаныбарлардын бардыгы."},
 {id:"m43_08",cat:"jaratylysh",ky:"экосистема",ru:"экосистема",en:"an ecosystem",tr:"ekosistem",def:"Флора, фауна жана алар жашаган жер биригип түзгөн бир бүтүн."},
 {id:"m43_09",cat:"jaratylysh",ky:"биологиялык ар түрдүүлүк",ru:"биологическое разнообразие",en:"biological diversity",tr:"biyolojik çeşitlilik",def:"Жаратылыштагы өсүмдүктөрдүн жана жаныбарлардын түрлөрүнүн көптүгү."},
 {id:"m43_10",cat:"jaratylysh",ky:"парник эффекти",ru:"парниковый эффект",en:"the greenhouse effect",tr:"sera etkisi",def:"Абадагы белгилүү заттар себеп болуп, жердин акырындык менен ысышы."},
 {id:"m43_11",cat:"jaratylysh",ky:"глобалдык жылуулануу",ru:"глобальное потепление",en:"global warming",tr:"küresel ısınma",def:"Бүткүл дүйнөдө абанын жана суунун акырындык менен ысышы."},
 {id:"m43_12",cat:"jaratylysh",ky:"корук",ru:"заповедник",en:"a nature reserve",tr:"doğa koruma alanı",def:"Флора менен фауна мамлекет тарабынан корголо турган жер."},
 {id:"m43_13",cat:"jaratylysh",ky:"өсүмдүктөр дүйнөсү",ru:"мир растений",en:"the plant world",tr:"bitki dünyası",def:"Флора; жердеги бардык чөптөр менен дарактар."},
 {ref:"m14_56",cat:"jaratylysh"},
 {ref:"m32_17",cat:"jaratylysh"},
 {ref:"m32_18",cat:"jaratylysh"},
 {ref:"m16_30",cat:"jaratylysh"},
 {ref:"m32_84",cat:"jaratylysh"},
 {ref:"m16_51",cat:"jaratylysh"},
 // --- Суу жана суу ресурстары
 {id:"m43_14",cat:"suu",ky:"суу ресурстары",ru:"водные ресурсы",en:"water resources",tr:"su kaynakları",def:"Жер үстүндөгү жана жер астындагы бардык пайдаланылуучу суулар."},
 {id:"m43_15",cat:"suu",ky:"таза суу",ru:"чистая вода",en:"clean water",tr:"temiz su",def:"Булганбаган, ичүүгө жарамдуу суу."},
 {id:"m43_16",cat:"suu",ky:"суу тартыштыгы",ru:"нехватка воды, дефицит воды",en:"water scarcity",tr:"su kıtlığı",def:"Суу элдин керектөөсүнө жетпей калган абал."},
 {id:"m43_17",cat:"suu",ky:"кургакчылык",ru:"засуха",en:"a drought",tr:"kuraklık",def:"Узак убакыт жамгыр жаабай, топурак кургап калган мезгил."},
 {id:"m43_18",cat:"suu",ky:"ташкын",ru:"наводнение, паводок",en:"a flood",tr:"sel",def:"Суунун көбөйүп, жерди каптап кетиши."},
 {id:"m43_19",cat:"suu",ky:"суунун булганышы",ru:"загрязнение воды",en:"water pollution",tr:"su kirliliği",def:"Сууга зыяндуу нерселер кирип, таза бойдон калбай калышы."},
 {id:"m43_20",cat:"suu",ky:"агын суу",ru:"проточная вода, речной поток",en:"running water, a stream",tr:"akarsu",def:"Токтобой, дайыма бир багытта аккан суу."},
 {id:"m43_21",cat:"suu",ky:"жер асты суулары",ru:"подземные воды",en:"groundwater",tr:"yeraltı suları",def:"Жердин ичинде жаткан, көрүнбөгөн суулар."},
 {id:"m43_22",cat:"suu",ky:"суу үнөмдөө",ru:"экономия воды",en:"water conservation",tr:"su tasarrufu",def:"Сууну ысырапсыз, керектүү өлчөмдө колдонуу."},
 {id:"m43_23",cat:"suu",ky:"суунун айлануусу",ru:"круговорот воды",en:"the water cycle",tr:"su döngüsü",def:"Суунун бууланып, булутка айланып, жамгыр болуп кайра жерге түшүшү."},
 {id:"m43_24",cat:"suu",ky:"суу деңгээли",ru:"уровень воды",en:"the water level",tr:"su seviyesi",def:"Дарыядагы же көлдөгү суунун канчалык бийик турганы."},
 {id:"m43_25",cat:"suu",ky:"суу сактагыч",ru:"водохранилище",en:"a water reservoir",tr:"su rezervuarı",def:"Сууну чогултуп, кийин пайдалануу үчүн курулган жер."},
 {ref:"m16_37",cat:"suu"},
 {ref:"m16_36",cat:"suu"},
 {ref:"m16_50",cat:"suu"},
 {ref:"m30_26",cat:"suu"},
 {ref:"m9_88",cat:"suu"},
 // --- Себеп-натыйжа: -гандыктан, -ганынан улам, -уунун натыйжасында, -ганы үчүн, натыйжада, ошонун айынан
 {id:"m43_26",cat:"sebep",ky:"Жамгыр көп жаагандыктан, дарыялар ташыды.",ru:"Так как дождь шёл сильно, реки вышли из берегов. (-гандыктан)",en:"Because it rained heavily, the rivers overflowed.",tr:"Çok yağmur yağdığı için nehirler taştı.",def:"Себеп-натыйжа: жаа- + -гандыктан — жамгырдын көптүгү себеп болду."},
 {id:"m43_27",cat:"sebep",ky:"Мөңгүлөр ысыктан эригенинен улам, көлдүн деңгээли көтөрүлдү.",ru:"Из-за того что ледники растаяли от жары, уровень озера поднялся. (-ганынан улам)",en:"Because the glaciers melted from the heat, the lake level rose.",tr:"Buzullar sıcaktan eridiği için gölün seviyesi yükseldi.",def:"Себеп-натыйжа: эри- + -генинен улам."},
 {id:"m43_28",cat:"sebep",ky:"Токойлорду кыюунун натыйжасында, топурактын сапаты начарлайт.",ru:"В результате вырубки лесов качество почвы ухудшается. (-уунун натыйжасында)",en:"As a result of felling forests, soil quality deteriorates.",tr:"Ormanların kesilmesi sonucunda toprağın kalitesi bozulur.",def:"Себеп-натыйжа: кыюу + -нун натыйжасында."},
 {id:"m43_29",cat:"sebep",ky:"Суу булганганы үчүн, аны ичүүгө болбойт.",ru:"Так как вода загрязнена, её нельзя пить. (-ганы үчүн)",en:"Because the water is polluted, it cannot be drunk.",tr:"Su kirlendiği için onu içmek olmaz.",def:"Себеп-натыйжа: булган- + -ганы үчүн."},
 {id:"m43_30",cat:"sebep",ky:"Жамгыр аз жаады. Натыйжада, дыйкандар зыян тартты.",ru:"Дождя выпало мало. В результате фермеры понесли убытки. (натыйжада)",en:"There was little rain. As a result, farmers suffered losses.",tr:"Az yağmur yağdı. Sonuç olarak çiftçiler zarar gördü.",def:"Эки сүйлөм «натыйжада» деген сөз менен байланышат."},
 {id:"m43_31",cat:"sebep",ky:"Заводдор сууну булгады. Ошонун айынан, балыктар кырылды.",ru:"Заводы загрязнили воду. Из-за этого рыбы погибли. (ошонун айынан)",en:"Factories polluted the water. Because of that, fish died.",tr:"Fabrikalar suyu kirletti. Bunun yüzünden balıklar öldü.",def:"«Ошонун айынан» мурунку сүйлөмдү себеп кылып көрсөтөт."},
 {id:"m43_32",cat:"sebep",ky:"Кургакчылык узакка созулгандыктан, айыл тургундары сууну алыстан ташышы керек болду.",ru:"Так как засуха затянулась надолго, жителям села пришлось возить воду издалека. (-гандыктан)",en:"Because the drought dragged on for a long time, the villagers had to bring water from afar.",tr:"Kuraklık uzun sürdüğü için köy sakinleri suyu uzaktan taşımak zorunda kaldı.",def:"Себеп-натыйжа: узакка созулуу + -гандыктан."},
 {ref:"m27_24",cat:"sebep"},
 {ref:"m27_26",cat:"sebep"},
 // --- Шарт → натыйжа: -са … -ат
 {id:"m43_33",cat:"shart",ky:"Суу булганса, ден соолукка зыян келет.",ru:"Если вода загрязняется, здоровью наносится вред. (-са … -ат)",en:"If water becomes polluted, it harms health.",tr:"Su kirlenirse sağlığa zarar gelir.",def:"Шарт: булган- + -са, натыйжа: зыян келет."},
 {id:"m43_34",cat:"shart",ky:"Токойлорду сактасак, аба дайыма таза болот.",ru:"Если мы сохраним леса, воздух всегда будет чистым.",en:"If we preserve the forests, the air will always be clean.",tr:"Ormanları korursak hava her zaman temiz olur.",def:"Шарт: сакта- + -сак, натыйжа: аба таза болот."},
 {id:"m43_35",cat:"shart",ky:"Адамдар сууну үнөмдөсө, суу ресурстары сакталат.",ru:"Если люди будут экономить воду, водные ресурсы сохранятся.",en:"If people conserve water, water resources will be preserved.",tr:"İnsanlar sudan tasarruf ederse su kaynakları korunur.",def:"Шарт: үнөмдө- + -сө, натыйжа: сакталат."},
 {id:"m43_36",cat:"shart",ky:"Жамгыр узакка жаабаса, кургакчылык башталат.",ru:"Если долго не будет дождя, начнётся засуха.",en:"If it does not rain for a long time, drought begins.",tr:"Uzun süre yağmur yağmazsa kuraklık başlar.",def:"Терс шарт: жаа- + -баса, натыйжа: кургакчылык башталат."},
 {id:"m43_37",cat:"shart",ky:"Жер катуу ысыса, мөңгүлөр тезирээк эрийт.",ru:"Если земля сильно нагреется, ледники будут таять быстрее.",en:"If the earth heats up strongly, glaciers melt faster.",tr:"Dünya çok ısınırsa buzullar daha hızlı erir.",def:"Шарт: ысы- + -са, натыйжа: мөңгүлөр тезирээк эрийт."},
 // --- Процесс жана натыйжа: -ып баратат, -бай калуу, -ып бүтүү
 {id:"m43_38",cat:"process",ky:"Кээ бир көлдөрдүн деңгээли жыл сайын түшүп баратат.",ru:"Уровень некоторых озёр с каждым годом снижается. (-ып баратат)",en:"The level of some lakes is dropping every year.",tr:"Bazı göllerin seviyesi her yıl düşüyor.",def:"Процесс: түш- + -үп баратат — акырындык менен өзгөрүү."},
 {id:"m43_39",cat:"process",ky:"Мөңгүлөр акырындык менен эрип баратат.",ru:"Ледники постепенно тают. (-ып баратат)",en:"The glaciers are gradually melting.",tr:"Buzullar yavaş yavaş eriyor.",def:"Процесс: эри- + -п баратат."},
 {id:"m43_40",cat:"process",ky:"Дарыя суусу жыл өткөн сайын азайып баратат.",ru:"Вода в реке уменьшается с каждым годом.",en:"The river's water is decreasing year by year.",tr:"Nehrin suyu her geçen yıl azalıyor.",def:"Процесс: азай- + -ып баратат."},
 {id:"m43_41",cat:"process",ky:"Суу жетишсиз болгондуктан, эгин өспөй калды.",ru:"Из-за нехватки воды посевы не смогли вырасти. (-бай калуу)",en:"Because of insufficient water, the crops failed to grow.",tr:"Su yetersiz olduğu için ekin büyüyemedi.",def:"Натыйжа: өс- + -пөй калды — болбой калган иш."},
 {id:"m43_42",cat:"process",ky:"Кыштакка суу түтүгүн тартып бүтүштү.",ru:"Провели водопровод до посёлка — работу полностью закончили. (-ып бүтүү)",en:"They finished laying the water pipe to the village.",tr:"Köye su borusunu döşeyip bitirdiler.",def:"Аяктоо: тарт- + -ып бүттү — иш толук бүттү."},
 {id:"m43_43",cat:"process",ky:"Токойду отургузуп бүтүштү.",ru:"Посадку леса полностью завершили. (-ып бүтүү)",en:"They finished planting the forest.",tr:"Ormanı dikip bitirdiler.",def:"Аяктоо: отургуз- + -уп бүттү."},
 // --- Айлана-чөйрөнү коргоо
 {id:"m43_44",cat:"coruu",ky:"айлана-чөйрөнү коргоо",ru:"охрана окружающей среды",en:"environmental protection",tr:"çevre koruma",def:"Абаны, сууну, жерди булганыштан сактоо иштери."},
 {id:"m43_45",cat:"coruu",ky:"экологиялык маданият",ru:"экологическая культура",en:"ecological culture, environmental awareness",tr:"ekolojik kültür",def:"Жаратылышка аяр мамиле кылуу үлгүсү, адаттары."},
 {id:"m43_46",cat:"coruu",ky:"калдыктарды кайра иштетүү",ru:"переработка отходов",en:"waste recycling",tr:"atıkların geri dönüşümü",def:"Керексиз калган нерселерди дагы бир жолу пайдалуу кылуу."},
 {id:"m43_47",cat:"coruu",ky:"суу ресурстарын сактоо",ru:"сохранение водных ресурсов",en:"conservation of water resources",tr:"su kaynaklarının korunması",def:"Сууну болочок үчүн үнөмдөп, булгабай сактоо."},
 {id:"m43_48",cat:"coruu",ky:"экологиялык коопсуздук",ru:"экологическая безопасность",en:"environmental safety",tr:"çevre güvenliği",def:"Айлана-чөйрөнүн адамга, жаныбарларга коркунуч алып келбеши."},
 {id:"m43_49",cat:"coruu",ky:"мамлекеттик инспекция",ru:"государственная инспекция",en:"state inspection",tr:"devlet denetimi",def:"Мыйзамдын сакталышын текшерген мамлекеттик орган."},
 {ref:"m32_19",cat:"coruu"},
 // --- Вопросы темы
 {id:"m43_50",cat:"suroo",ky:"Эмне үчүн суу адам үчүн эң маанилүү зат болуп саналат?",ru:"Почему вода является самым важным веществом для человека?",en:"Why is water the most important substance for a person?",tr:"Su neden insan için en önemli maddedir?",def:"Теманын башкы суроосу."},
 {id:"m43_51",cat:"suroo",ky:"Кыргызстан суу ресурстарына канчалык бай өлкө?",ru:"Насколько Кыргызстан богат водными ресурсами?",en:"How rich is Kyrgyzstan in water resources?",tr:"Kırgızistan su kaynakları bakımından ne kadar zengin bir ülke?",def:"Өлкөнүн байлыгы жөнүндө суроо."},
 {id:"m43_52",cat:"suroo",ky:"Кургакчылыктын кандай себептери болушу мүмкүн?",ru:"Какие могут быть причины засухи?",en:"What could be the causes of drought?",tr:"Kuraklığın hangi nedenleri olabilir?",def:"Себеп жөнүндө суроо."},
 {id:"m43_53",cat:"suroo",ky:"Биз айлана-чөйрөнү кантип коргой алабыз?",ru:"Как мы можем охранять окружающую среду?",en:"How can we protect the environment?",tr:"Çevreyi nasıl koruyabiliriz?",def:"Аракет жөнүндө суроо."},
 {id:"m43_54",cat:"suroo",ky:"Сиздин аймакта суу тартыштыгы барбы?",ru:"В вашем регионе есть нехватка воды?",en:"Is there a water shortage in your area?",tr:"Bölgenizde su kıtlığı var mı?",def:"Жеке тажрыйба жөнүндө суроо."},
 {id:"m43_55",cat:"suroo",ky:"Мөңгүлөрдүн эришинин натыйжасында эмне болушу мүмкүн?",ru:"Что может произойти в результате таяния ледников?",en:"What might happen as a result of glaciers melting?",tr:"Buzulların erimesi sonucunda ne olabilir?",def:"Натыйжа жөнүндө суроо."},
 {id:"m43_56",cat:"suroo",ky:"Суу ресурстарын сактоо үчүн эмне кылуу керек?",ru:"Что нужно делать, чтобы сохранить водные ресурсы?",en:"What must be done to preserve water resources?",tr:"Su kaynaklarını korumak için ne yapmak gerekir?",def:"Сунуш жөнүндө суроо."},
 // --- Ответы-шаблоны: скелет чакан макала «Суу – өмүр булагы» (17 сүйлөм, талапка ылайык)
 {id:"m43_57",cat:"joop",ky:"Суу — жердеги бардык тирүү жандыктар үчүн эң маанилүү зат.",ru:"Вода — самое важное вещество для всех живых существ на земле.",en:"Water is the most important substance for all living things on earth.",tr:"Su, dünyadaki tüm canlılar için en önemli maddedir.",def:"Аңгеменин биринчи сүйлөмү: суунун баалуулугу."},
 {id:"m43_58",cat:"joop",ky:"Адам суусуз бир нече күн гана жашай алат.",ru:"Человек без воды может прожить лишь несколько дней.",en:"A person can live only a few days without water.",tr:"İnsan susuz sadece birkaç gün yaşayabilir.",def:"Суунун адам үчүн зарылдыгы жөнүндө факт."},
 {id:"m43_59",cat:"joop",ky:"Суу – өмүр булагы, ошондуктан аны сарамжал колдонуу зарыл.",ru:"Вода – источник жизни, поэтому её нужно использовать бережно.",en:"Water is the source of life, therefore it must be used sparingly.",tr:"Su hayatın kaynağıdır, bu yüzden onu tutumlu kullanmak gerekir.",def:"Теманын макалы сүйлөмгө айланды: макал + ошондуктан."},
 {id:"m43_60",cat:"joop",ky:"Кыргызстан суу ресурстарына бай өлкө.",ru:"Кыргызстан — страна, богатая водными ресурсами.",en:"Kyrgyzstan is a country rich in water resources.",tr:"Kırgızistan su kaynakları bakımından zengin bir ülkedir.",def:"Өлкө жөнүндө факт."},
 {id:"m43_61",cat:"joop",ky:"Бирок акыркы жылдары айлана-чөйрөдөгү көйгөйлөр күндөн күнгө көбөйүп баратат.",ru:"Но в последние годы экологические проблемы день ото дня растут.",en:"But in recent years environmental problems are growing day by day.",tr:"Ama son yıllarda çevre sorunları günden güne artıyor.",def:"Каршы ой: «бирок» менен башталат."},
 {id:"m43_62",cat:"joop",ky:"Мөңгүлөр климаттын өзгөрүшүнөн улам акырындык менен эрип баратат.",ru:"Ледники постепенно тают из-за изменения климата.",en:"Glaciers are gradually melting due to climate change.",tr:"Buzullar iklim değişikliğinden dolayı yavaş yavaş eriyor.",def:"Себеп-натыйжа: климаттын өзгөрүшүнөн улам."},
 {id:"m43_63",cat:"joop",ky:"Мөңгүлөр эригендиктен, кээ бир дарыялардын суусу азайып жатат.",ru:"Из-за того что ледники тают, вода некоторых рек убывает.",en:"Because the glaciers are melting, the water of some rivers is decreasing.",tr:"Buzullar eridiği için bazı nehirlerin suyu azalıyor.",def:"Себеп-натыйжа: эригендиктен."},
 {id:"m43_64",cat:"joop",ky:"Ошондой эле заводдордун таштандысынан улам суу булганып жатат.",ru:"Также из-за отходов заводов вода загрязняется.",en:"Also, due to factory waste, water is getting polluted.",tr:"Ayrıca fabrikaların atığından dolayı su kirleniyor.",def:"Себеп: таштандысынан улам."},
 {id:"m43_65",cat:"joop",ky:"Булганган сууну ичкен адамдар ар кандай ооруларга чалдыгышы мүмкүн.",ru:"Люди, пьющие загрязнённую воду, могут заболеть разными болезнями.",en:"People who drink polluted water may fall ill with various diseases.",tr:"Kirli su içen insanlar çeşitli hastalıklara yakalanabilir.",def:"Натыйжа: ден соолукка коркунуч."},
 {id:"m43_66",cat:"joop",ky:"Кургакчылык болгон жылдары дыйкандар чоң зыян тартышат.",ru:"В засушливые годы фермеры несут большие убытки.",en:"In drought years, farmers suffer great losses.",tr:"Kurak yıllarda çiftçiler büyük zarar görür.",def:"Экономикалык натыйжа жөнүндө ой."},
 {id:"m43_67",cat:"joop",ky:"Суу жетишсиз болгондуктан, айрым айылдарда эгин начар өнөт.",ru:"Из-за нехватки воды в некоторых сёлах посевы растут плохо.",en:"Because of insufficient water, crops grow poorly in some villages.",tr:"Su yetersiz olduğu için bazı köylerde ekin kötü büyür.",def:"Себеп-натыйжа: жетишсиз болгондуктан."},
 {id:"m43_68",cat:"joop",ky:"Ушул көйгөйлөрдүн натыйжасында, суу маселеси мамлекеттик деңгээлде каралып жатат.",ru:"В результате этих проблем вопрос воды рассматривается на государственном уровне.",en:"As a result of these problems, the water issue is being considered at the state level.",tr:"Bu sorunlar sonucunda su meselesi devlet düzeyinde ele alınıyor.",def:"Жыйынтыктоочу ой: мамлекеттик деңгээлде."},
 {id:"m43_69",cat:"joop",ky:"Менин оюмча, ар бир адам сууну үнөмдөп колдонушу керек.",ru:"По моему мнению, каждый человек должен использовать воду экономно.",en:"In my opinion, every person must use water sparingly.",tr:"Bence her insan suyu tutumlu kullanmalı.",def:"Автордун жеке пикири."},
 {id:"m43_70",cat:"joop",ky:"Ошондуктан үйдө да, иште да сууну ысырап кылбоо керек.",ru:"Поэтому нельзя тратить воду впустую ни дома, ни на работе.",en:"Therefore water should not be wasted at home or at work.",tr:"Bu yüzden evde de işte de suyu israf etmemek gerekir.",def:"Сунуш: ысырап кылбоо."},
 {id:"m43_71",cat:"joop",ky:"Мамлекет да суу ресурстарын коргоо боюнча мыйзамдарды бекитиши керек.",ru:"Государство тоже должно утверждать законы по охране водных ресурсов.",en:"The state too must approve laws to protect water resources.",tr:"Devlet de su kaynaklarını koruma konusunda kanunlar çıkarmalı.",def:"Мамлекеттин милдети жөнүндө ой."},
 {id:"m43_72",cat:"joop",ky:"Ар бирибиз айлана-чөйрөгө кам көрсөк, суу таза бойдон сакталат.",ru:"Если каждый из нас позаботится об окружающей среде, вода останется чистой.",en:"If each of us cares for the environment, water will remain clean.",tr:"Her birimiz çevreye özen gösterirsek su temiz kalır.",def:"Шарт жана натыйжа: көр- (кам көрүү) + -сак."},
 {id:"m43_73",cat:"joop",ky:"Жыйынтыктап айтканда, суу – биздин келечегибиз.",ru:"Подводя итог, вода – наше будущее.",en:"In conclusion, water is our future.",tr:"Özetle, su bizim geleceğimizdir.",def:"Аңгеменин корутунду сүйлөмү."},
 // --- Глаголы модуля
 {id:"m43_74",cat:"etish",ky:"ташуу",ru:"выходить из берегов, разливаться; также носить, возить (основа ташы-)",en:"to overflow, to flood; also to carry, to haul",tr:"taşmak; taşımak",def:"Суунун көбөйүп, жээктен чыгып кетиши."},
 {id:"m43_75",cat:"etish",ky:"булгоо",ru:"загрязнять (основа булга-)",en:"to pollute (something)",tr:"kirletmek",def:"Тазалыкты бузуп, зыяндуу кылуу."},
 {id:"m43_76",cat:"etish",ky:"булгануу",ru:"загрязняться (основа булган-)",en:"to become polluted",tr:"kirlenmek",def:"Таза бойдон калбай, зыяндуу болуп калуу."},
 {ref:"m40_83",cat:"etish"},
 {id:"m43_77",cat:"etish",ky:"ысырап кылуу",ru:"растрачивать впустую",en:"to waste",tr:"israf etmek",def:"Кереги жок жерге көп коротуу."},
 {id:"m43_78",cat:"etish",ky:"чалдыгуу",ru:"заболевать, подвергаться (основа чалдык-)",en:"to fall ill with, to be afflicted by",tr:"yakalanmak (hastalığa)",def:"Ооруга же башка жаман нерсеге дуушар болуу."},
 {id:"m43_79",cat:"etish",ky:"ысуу",ru:"нагреваться (основа ысы-)",en:"to heat up, to get hot",tr:"ısınmak",def:"Ысык болуп калуу; суук болуунун тескериси."},
 {ref:"m32_66",cat:"etish"},
 {ref:"m15_75",cat:"etish"},
 {ref:"m17_75",cat:"etish"},
 // --- Макал: Суу – өмүр булагы (расмий тема Жазуу B2)
 {id:"m43_80",cat:"makal",ky:"Суу – өмүр булагы.",ru:"Вода – источник жизни.",en:"Water is the source of life.",tr:"Su, hayatın kaynağıdır.",def:"Ушул модулдун негизги макалы; «Жазуу» субтестинин расмий темасы."},
 {id:"m43_81",cat:"makal",ky:"Суу бар жерде жашоо бар.",ru:"Где есть вода, там есть жизнь. (изречение)",en:"Where there is water, there is life.",tr:"Suyun olduğu yerde hayat vardır.",def:"Суунун маанилүүлүгү жөнүндө дагы бир накыл сөз."},
 // --- Полезные слова
 {ref:"m8_47",cat:"paydaluu"},
 {id:"m43_82",cat:"paydaluu",ky:"тирүү",ru:"живой",en:"alive, living",tr:"canlı",def:"Дем алган, кыймылдаган, жашоочу."},
 {id:"m43_83",cat:"paydaluu",ky:"жандык",ru:"живое существо",en:"a living being, a creature",tr:"canlı varlık",def:"Тирүү болгон ар кандай организм: адам же жаныбар."},
 {id:"m43_84",cat:"paydaluu",ky:"зат",ru:"вещество, предмет",en:"a substance, a thing",tr:"madde, nesne",def:"Дүйнөдөгү ар кандай нерсенин жалпы аты."},
 {id:"m43_85",cat:"paydaluu",ky:"сарамжал",ru:"бережливый, экономный",en:"thrifty, prudent",tr:"tutumlu",def:"Ысырапсыз, ойлонуп чыгымдаган."},
 {id:"m43_86",cat:"paydaluu",ky:"коопсуздук",ru:"безопасность",en:"safety, security",tr:"güvenlik",def:"Коркунуч жок, тынч абал."},
 {id:"m43_87",cat:"paydaluu",ky:"жаратылыш байлыгы",ru:"природные богатства",en:"natural wealth, natural resources",tr:"doğal zenginlik",def:"Жаратылыш адамга тартуулаган нерселер: суу, токой, жер."},
 {ref:"m8_88",cat:"paydaluu"},
 {ref:"m27_75",cat:"paydaluu"}
];
const DEF_GLOSS_M43 = {
 "узагыраак":{ru:"подольше (сравнительная степень от «узак» — долгий)",en:"a bit longer (comparative of “узак” — long)",tr:"biraz daha uzun (“узак” — uzun kelimesinin karşılaştırma hali)"},
 "түрлөрүнүн":{ru:"их видов (родительный падеж мн. ч. от «түр» — вид)",en:"of their kinds (genitive plural of “түр” — a kind, a type)",tr:"türlerinin (“түр” — tür kelimesinin çoğul hali)"},
 "ысышы":{ru:"его нагревание, разогрев",en:"its heating up",tr:"onun ısınması"},
 "бууланып":{ru:"испарившись",en:"having evaporated",tr:"buharlaşıp"},
 "аяр":{ru:"бережный, заботливый",en:"careful, considerate",tr:"özenli"},
 "орган":{ru:"орган, инстанция (учреждение)",en:"an agency, a body",tr:"kurum, merci"},
 "дуушар":{ru:"подвергшийся (беде, болезни)",en:"afflicted by, exposed to",tr:"maruz kalan"},
 "организм":{ru:"организм",en:"an organism",tr:"organizma"}
};
DEF_GLOSS.m43=DEF_GLOSS_M43; // реестр объявлен в data/b1.head.js — модуль лишь дописывает свой глоссарий
const DRILL_M43 = [
 {g:"sebep",qKy:"«Жамгыр көп жаа… дарыялар ташыды» (себеп).",q:"«Так как дождь шёл сильно, реки разлились» — какой суффикс?",qEn:"“Because it rained heavily, the rivers flooded” — which suffix?",qTr:"“Çok yağmur yağdığı için nehirler taştı” — hangi ek?",noteEn:"-гандыктан",noteTr:"-гандыктан",opts:["-гандыктан","-са","-гыдай","-ганча"],c:0,note:"причина-следствие: жаа+гандыктан"},
 {g:"sebep",qKy:"«Мөңгүлөр эри… улам, суунун деңгээли көтөрүлдү».",q:"«Из-за того что ледники растаяли, уровень воды поднялся» — какой суффикс?",qEn:"“Because the glaciers melted, the water level rose” — which suffix?",qTr:"“Buzullar eridiği için su seviyesi yükseldi” — hangi ek?",noteEn:"-генинен",noteTr:"-генинен",opts:["-гидей","-генинен","-са","-ганча"],c:1,note:"-ганынан улам: эри+ген+инен улам"},
 {g:"sebep",qKy:"«Токойлорду кыюу… натыйжасында, топурак начарлайт».",q:"«В результате вырубки лесов почва ухудшается» — какое окончание?",qEn:"“As a result of felling forests, soil deteriorates” — which ending?",qTr:"“Ormanların kesilmesi sonucunda toprak bozulur” — hangi ek?",noteEn:"-нун",noteTr:"-нун",opts:["-га","-дай","-нун","-ча"],c:2,note:"кыюу + -нун натыйжасында"},
 {g:"sebep",qKy:"«Суу булган… үчүн, аны ичүүгө болбойт».",q:"«Так как вода загрязнена, её нельзя пить» — какой суффикс?",qEn:"“Because the water is polluted, it cannot be drunk” — which suffix?",qTr:"“Su kirlendiği için onu içmek olmaz” — hangi ek?",noteEn:"-ганы",noteTr:"-ганы",opts:["-са","-гыдай","-ганча","-ганы"],c:3,note:"булган+ганы үчүн"},
 {g:"shart",qKy:"«Суу булган… ден соолукка зыян келет» (шарт).",q:"«Если вода загрязняется, здоровью наносится вред» — какой суффикс?",qEn:"“If water becomes polluted, it harms health” — which suffix?",qTr:"“Su kirlenirse sağlığa zarar gelir” — hangi ek?",noteEn:"-са",noteTr:"-са",opts:["-са","-гандыктан","-ганы","-гыдай"],c:0,note:"условие: булган+са"},
 {g:"shart",qKy:"«Токойлорду сакта… аба таза болот» (шарт).",q:"«Если мы сохраним леса, воздух будет чистым» — какой суффикс?",qEn:"“If we preserve the forests, the air will be clean” — which suffix?",qTr:"“Ormanları korursak hava temiz olur” — hangi ek?",noteEn:"-сак",noteTr:"-сак",opts:["-гандыктан","-сак","-ганча","-гыдай"],c:1,note:"условие: сакта+сак"},
 {g:"shart",qKy:"«Жамгыр узакка жаа… кургакчылык башталат» (шарт).",q:"«Если долго не будет дождя, начнётся засуха» — какой суффикс?",qEn:"“If it does not rain for a long time, drought begins” — which suffix?",qTr:"“Uzun süre yağmur yağmazsa kuraklık başlar” — hangi ek?",noteEn:"-баса",noteTr:"-баса",opts:["-багандыктан","-бачу","-баса","-бай"],c:2,note:"отрицательное условие: жаа+баса"},
 {g:"process",qKy:"«Кээ бир көлдөрдүн деңгээли жыл сайын түшүп …» (процесс).",q:"«Уровень некоторых озёр с каждым годом снижается» — какое слово?",qEn:"“The level of some lakes is dropping every year” — which word?",qTr:"“Bazı göllerin seviyesi her yıl düşüyor” — hangi kelime?",noteEn:"баратат",noteTr:"баратат",opts:["калды","бүттү","алат","баратат"],c:3,note:"-ып баратат: постепенное изменение"},
 {g:"process",qKy:"«Суу жетишсиз болгондуктан, эгин өс… калды» — иш болбой калды (терс натыйжа).",q:"«Из-за нехватки воды посевы не смогли вырасти» — какое окончание?",qEn:"“Because of insufficient water, the crops failed to grow” — which ending?",qTr:"“Su yetersiz olduğu için ekin büyüyemedi” — hangi ek?",noteEn:"-пөй",noteTr:"-пөй",opts:["-пөй","-үп","-кен","-гөн"],c:0,note:"-бай калуу: несостоявшееся действие"},
 {g:"process",qKy:"«Токойду отургузуп …» — иш толук бүттү.",q:"«Посадку леса полностью завершили» — какое слово?",qEn:"“They finished planting the forest” — which word?",qTr:"“Ormanı dikip bitirdiler” — hangi kelime?",noteEn:"finished",noteTr:"bitirme",opts:["баратышты","бүтүштү","калышты","алышты"],c:1,note:"-ып бүтүү: действие полностью завершено"},
 {g:"baa",qKy:"«Сен туура кылдың!» — бул сүйлөмдө автор эмне кылып жатат?",q:"Что делает автор в этой фразе?",qEn:"What is the author doing in this sentence?",qTr:"Yazar bu cümlede ne yapıyor?",noteEn:"praising",noteTr:"övüyor",opts:["жемелөө","күмөн саноо","мактоо","тыюу салуу"],c:2,note:"интенция оценки: мактоо — положительная оценка"},
 {g:"baa",qKy:"«Мындай кылганың туура эмес!» — бул кайсы интенция?",q:"Какая это интенция?",qEn:"Which intention is this?",qTr:"Bu hangi niyettir?",noteEn:"reproach",noteTr:"kınama",opts:["колдоо","ынандыруу","чакыруу","жемелөө"],c:3,note:"жемелөө — отрицательная оценка"},
 {g:"baa",qKy:"«Балким, бул чын эмес чыгар» — бул кайсы интенция?",q:"Какая это интенция?",qEn:"Which intention is this?",qTr:"Bu hangi niyettir?",noteEn:"doubt",noteTr:"şüphe",opts:["күмөн саноо","макулдук берүү","мактоо","убада берүү"],c:0,note:"күмөн саноо — недоверие"},
 {g:"baa",qKy:"«Ишенгиле, баары жакшы болот!» — бул кайсы интенция?",q:"Какая это интенция?",qEn:"Which intention is this?",qTr:"Bu hangi niyettir?",noteEn:"persuasion",noteTr:"ikna",opts:["каршы болуу","ынандыруу","кечирим суроо","тыюу салуу"],c:1,note:"ынандыруу — призыв поверить"},
 {g:"leks",qKy:"«Флора» деген эмне?",q:"Что значит «флора»?",qEn:"What does “флора” mean?",qTr:"“Флора” ne demek?",noteEn:"plants",noteTr:"bitkiler",opts:["Жаныбарлар дүйнөсү","Суу ресурстары","Өсүмдүктөр дүйнөсү","Аба ырайы"],c:2,note:"флора — мир растений"},
 {g:"leks",qKy:"Суу көп болгон жылдары кандай коркунуч жаралат?",q:"Какая опасность возникает в годы с обилием воды?",qEn:"What danger arises in years with a lot of water?",qTr:"Suyun bol olduğu yıllarda hangi tehlike ortaya çıkar?",noteEn:"flood",noteTr:"sel",opts:["кургакчылык","жер титирөө","өрт","ташкын"],c:3,note:"много воды — опасность наводнения"},
 {g:"leks",qKy:"«Корук» деген эмне?",q:"Что значит «корук»?",qEn:"What does “корук” mean?",qTr:"“Корук” ne demek?",noteEn:"reserve",noteTr:"koruma alanı",opts:["Флора-фауна корголо турган жер","Суу электр станциясы","Мамлекеттик мекеме","Токой кесилген жер"],c:0,note:"корук — заповедник"}
];
