
function renderGrammarM29(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Поручения: -дыр/-т","Having it done: -дыр/-т","Yaptırma: -дыр/-т")),
    h("p",{class:"muted"},L("Понудительный залог: дело делает другой, а ты поручаешь или заказываешь. В семье это язык распределения обязанностей.","The causative voice: someone else does the work, you have it done or order it. In the family it is the language of chores.","Ettirgen çatı: işi başkası yapar, sen yaptırırsın. Ailede görev dilidir.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("поручить помыть","have washed","yıkatmak"),"жуу + -дур",kgw("Апам мага идиш жуудурду.","m29_23")],
      [L("велеть читать","have read","okutmak"),"оку + -т",kgw("Атам иниме китеп окутту.","m29_24")],
      [L("поручить написать","have written","yazdırmak"),"жаз + -дыр",kgw("Кызына кат жаздырды.","m29_26")],
      [L("заказать мастеру","order from a craftsman","ustaya yaptırmak"),"тик + -тир",kgw("Той көйнөгүн тиктирдик.","m29_70")]]),
    h("div",{class:"note"},L("Правило тарбии: ","The upbringing rule: ","Terbiye kuralı: "),kgw("Баланын ишин өзүнө кылдырыңыз.","m29_71"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Когда: -ганда","When: -ганда","-ınca: -ганда")),
    h("p",{class:"muted"},L("-ганда — «когда»: событие-время. Не путайте с -са (М27): -ганда — когда (факт), -са — если (условие).","-ганда means “when”: an event in time. Do not confuse with -са (M27): -ганда — when (a fact), -са — if (a condition).","-ганда “-ınca” demektir. -са (M27) ile karıştırmayın: -ганда zaman, -са koşuldur.")),
    harmonyTable([L("Ряд","Row","Sıra"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("е-ряд","е-row","е-sırası"),"-генде",kgw("Үйгө келгенде, адегенде колумду жууйм.","m29_30")],
      [L("о-ряд","о-row","о-sırası"),"-гондо",kgw("Бала чоңойгондо, ата-энесин түшүнөт.","m29_29")],
      [L("а-ряд","а-row","а-sırası"),"-ганда",kgw("Кыйналганда үй-бүлөм колдойт.","m29_33")],
      [L("быт семьи","family life","aile hayatı"),"-генде",kgw("Атам келгенде, чогуу кечки тамак ичебиз.","m29_72")]]),
    h("p",{class:"muted"},L("Полный ряд: -ганда/-генде/-гондо/-гөндө (ө-ряд: көргөндө «когда видит»). После глухого согласного суффикс начинается с к: -канда/-кенде/-кондо/-көндө — укканда «когда слышит», айтканда «когда говорит».","The full set: -ганда/-генде/-гондо/-гөндө (ө-row: көргөндө “when seeing”). After a voiceless consonant the suffix starts with к: -канда/-кенде/-кондо/-көндө — укканда “when hearing”, айтканда “when saying”.","Tam dizi: -ганда/-генде/-гондо/-гөндө (ө-sırası: көргөндө “görünce”). Ötümsüz ünsüzden sonra ek к ile başlar: -канда/-кенде/-кондо/-көндө — укканда “duyunca”, айтканда “söyleyince”."))));
  m.append(h("div",{class:"card"},h("h2",{},L("Үй-бүлө жөнүндө макалдар","Family proverbs","Aile atasözleri")),
    harmonyTable([L("Макал","Proverb","Atasözü"),L("Смысл","Meaning","Anlam")],[
      [kgw("Ырыс алды — ынтымак.","m29_35"),L("согласие — начало счастья","harmony comes before fortune","bolluğun başı birlik")],
      [kgw("Уядан эмнени көрсө, учканда ошону алат.","m29_69"),L("ребёнок повторяет увиденное дома","a child repeats what it sees at home","çocuk evde gördüğünü tekrarlar")],
      [kgw("Улууга — урмат, кичүүгө — ызаат.","m29_37"),L("уважение — в обе стороны","respect goes both ways","saygı iki yönlüdür")]])));
  const dlg=[["А: — Үй жумуштарын үй-бүлөдө ким кылат?","А: — Кто в семье делает домашние дела?","A: — Who does the chores in your family?","A: — Ailede ev işlerini kim yapar?"],
             ["Б: — Баарыбыз. Милдеттерди так бөлүштүргөнбүз, кезек менен иштейбиз.","Б: — Все мы. Обязанности чётко распределили, работаем по очереди.","B: — All of us. We divided the duties clearly and work in turns.","B: — Hepimiz. Görevleri net paylaştık, sırayla çalışırız."],
             ["А: — Балдарга да милдет бересиздерби?","А: — И детям даёте обязанности?","A: — Do you give the children duties too?","A: — Çocuklara da görev verir misiniz?"],
             ["Б: — Албетте! Майда иштерди өздөрүнө кылдырабыз: гүл сугартабыз, бөлмө жыйнатабыз.","Б: — Конечно! Мелкие дела поручаем им самим: даём поливать цветы, убирать комнату.","B: — Of course! We have them do small tasks themselves: watering flowers, tidying the room.","B: — Elbette! Ufak işleri kendilerine yaptırırız: çiçek sulatır, oda toplatırız."],
             ["А: — Чогуу качан отурасыздар?","А: — А когда собираетесь вместе?","A: — And when do you sit together?","A: — Birlikte ne zaman oturursunuz?"],
             ["Б: — Атам келгенде, чогуу кечки тамак ичебиз. Ырыс алды — ынтымак!","Б: — Когда приходит отец, вместе ужинаем. Впереди счастья — согласие!","B: — When father comes, we have supper together. Harmony comes before fortune!","B: — Babam gelince birlikte akşam yemeği yeriz. Bolluğun başı birliktir!"]];
  weekDialog(m,"Диалог: «Милдеттер»","Dialogue: «Милдеттер»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши формы -дыр/-т и -ганда, разбери состав; 3) расскажи «Үй-бүлөдөгү милдеттерим» на 12–15 предложений — с макалом и двумя поручениями; 4) опиши одну семейную традицию через -ганда.","Tasks: 1) read the dialogue swapping roles; 2) write out the -дыр/-т and -ганда forms and analyse them; 3) tell “Үй-бүлөдөгү милдеттерим” in 12–15 sentences — with a proverb and two causatives; 4) describe one family tradition using -ганда.","Diyalog: «Милдеттер»","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -дыр/-т ve -ганда biçimlerini yazıp çözümle; 3) “Үй-бүлөдөгү милдеттерим” konusunu 12–15 cümleyle anlat — bir atasözü ve iki ettirgenle; 4) -ганда ile bir aile geleneğini anlat.");
}
