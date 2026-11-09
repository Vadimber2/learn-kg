function renderGrammarM8(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Буйрук ыңгай — вежливые просьбы","The imperative — polite requests","Buyruk kipi — kibar ricalar")),
    h("p",{class:"muted"},L("Основа + -ыңыз/-иңиз/-уңуз/-үңүз (после гласной — -ңыз/-ңуз). Это язык врача, кассира и учителя:","Stem + -ыңыз/-иңиз/-уңуз/-үңүз (after a vowel — -ңыз/-ңуз). The language of doctors, cashiers and teachers:","Gövde + -ыңыз/-иңиз/-уңуз/-үңүз (ünlüden sonra -ңыз/-ңуз). Doktorun, kasiyerin ve öğretmenin dili:")),
    harmonyTable([L("Основа","Stem","Gövde"),L("Просьба","Request","Rica"),L("Перевод","Meaning","Anlamı")],[
      ["кел-",["келиңиз"],L("придите","come","gelin")],
      ["отур-",["отуруңуз"],L("садитесь","sit down","oturun")],
      ["ач-",["ачыңыз"],L("откройте","open","açın")],
      ["көр-",["көрүңүз"],L("посмотрите","look","bakın")],
      ["оку- (гласная)",["окуңуз"],L("читайте","read","okuyun")]]),
    h("div",{class:"note"},L("Мягкая просьба — частица -чы: ","A softer request — the -чы particle: ","Daha yumuşak rica — -чы eki: "),kgw("бериңизчи","m8_61"),L(". Отрицание: -ба- + -ңыз: ",". Negation: -ба- + -ңыз: ",". Olumsuzu: -ба- + -ңыз: "),kgw("коркпоңуз","m8_82"),L(" (не бойтесь)."," (don’t be afraid)."," (korkmayın)."))));
  m.append(h("div",{class:"card"},h("h2",{},L("«Болит»: ооруйт + принадлежность","“It hurts”: ооруйт + possessives","“Ağrıyor”: ооруйт + iyelik")),
    h("p",{class:"muted"},L("Часть тела получает аффикс принадлежности (М2), затем ооруйт:","The body part takes a possessive affix (M2), then ооруйт:","Vücut bölümü önce iyelik eki alır (M2), sonra ооруйт gelir:")),
    h("table",{},
      h("tr",{},h("td",{},kgw("Башым ооруйт.","m8_71")),h("td",{class:"muted"},L("у меня болит голова","my head aches","başım ağrıyor")),
        h("td",{},h("span",{class:"kgword"},"Тиши ооруйт.")),h("td",{class:"muted"},L("у него болит зуб","his tooth hurts","onun dişi ağrıyor"))),
      h("tr",{},h("td",{},kgw("Ичим ооруйт.","m8_72")),h("td",{class:"muted"},L("у меня болит живот","my stomach hurts","karnım ağrıyor")),
        h("td",{},h("span",{class:"kgword"},"Ичиңиз ооруйтпу?")),h("td",{class:"muted"},L("у Вас болит живот?","does your stomach hurt?","karnınız ağrıyor mu?")))),
    h("div",{class:"note"},L("Озвончение на стыке (как китеп → китебим, М2): кекиртек → ","Joint voicing (like китеп → китебим, M2): кекиртек → ","Ek sınırında tonlulaşma (китеп → китебим gibi, M2): кекиртек → "),h("span",{class:"kgword"},"кекиртегим"),", жүрөк → ",h("span",{class:"kgword"},"жүрөгү"),L(". Номера служб: 101 — өрт, 102 — милиция, 103 — тез жардам."," Emergency numbers: 101 — fire, 102 — police, 103 — ambulance."," Acil numaralar: 101 — itfaiye, 102 — polis, 103 — ambulans."))));
  const dlg=[["Дарыгер: — Кириңиз, отуруңуз. Эмнеңиз ооруйт?","Врач: — Входите, садитесь. Что у Вас болит?","Doctor: — Come in, sit down. What hurts?","Doktor: — Buyurun, oturun. Neyiniz ağrıyor?"],
             ["Бейтап: — Башым ооруйт, ысытмам бар.","Пациент: — Болит голова, есть температура.","Patient: — My head aches and I have a fever.","Hasta: — Başım ağrıyor, ateşim var."],
             ["Дарыгер: — Качан башталды?","Врач: — Когда началось?","Doctor: — When did it start?","Doktor: — Ne zaman başladı?"],
             ["Бейтап: — Кечээ кечинде. Суук тийип калды окшойт.","Пациент: — Вчера вечером. Кажется, простудился.","Patient: — Yesterday evening. I think I caught a cold.","Hasta: — Dün akşam. Galiba üşüttüm."],
             ["Дарыгер: — Оозуңузду ачыңыз… Тумоо. Мына рецепт.","Врач: — Откройте рот… Грипп. Вот рецепт.","Doctor: — Open your mouth… Flu. Here is a prescription.","Doktor: — Ağzınızı açın… Grip. Buyurun reçete."],
             ["Бейтап: — Дарыны кантип ичем?","Пациент: — Как принимать лекарство?","Patient: — How do I take the medicine?","Hasta: — İlacı nasıl kullanacağım?"],
             ["Дарыгер: — Күнүнө үч жолу, тамактан кийин. Көп суу ичиңиз, эс алыңыз.","Врач: — Три раза в день, после еды. Пейте больше воды, отдыхайте.","Doctor: — Three times a day, after meals. Drink plenty of water and rest.","Doktor: — Günde üç kez, yemekten sonra. Bol su için, dinlenin."],
             ["Бейтап: — Рахмат! Соо болуңуз!","Пациент: — Спасибо! Будьте здоровы!","Patient: — Thank you! Stay well!","Hasta: — Teşekkürler! Sağlıcakla kalın!"]];
  weekDialog(m,"Диалог: «Дарыгерде»","Dialogue: «At the doctor’s»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) выпиши все формы повеления -ыңыз; 3) найди «болит» с принадлежностью; 4) разыграй визит к врачу со СВОИМИ симптомами (методика §9, п. 8). После М8 — мок-экзамен № 2!","Tasks: 1) read swapping roles; 2) list every -ыңыз imperative; 3) find “hurts” with possessives; 4) act out a doctor’s visit with YOUR OWN symptoms (methodology §9, item 8). After M8 — mock exam #2!","Diyalog: «Дарыгерде» (doktorda)","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) bütün -ыңыз buyruk biçimlerini yaz; 3) iyelik ekli «ağrıyor» kalıplarını bul; 4) KENDİ belirtilerinle doktor ziyaretini canlandır (metodoloji §9, madde 8). M8'den sonra — 2 numaralı deneme sınavı!");
}
