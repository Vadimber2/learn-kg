
function renderRefM22(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Неделя интеграции A2: как повторять","A2 integration week: how to revise","A2 pekiştirme haftası: nasıl tekrar edilir")),
    h("p",{class:"muted"},L("Новых слов нет. Цель недели — связать грамматику М12–М21 в одну систему и закрыть слабые места перед экзаменационной неделей.","No new words. The goal is to tie the M12–M21 grammar into one system and close weak spots before the exam week.","Yeni kelime yok. Amaç: M12–M21 dil bilgisini tek sisteme bağlamak ve sınav haftasından önce zayıf noktaları kapatmak.")),
    harmonyTable([L("Смысл","Meaning","Anlam"),L("Форма","Form","Biçim"),L("Модуль","Module","Modül")],[
      [L("хочется","feel like","istek"),"-гы келет","М13"],
      [L("надо","need","gerek"),"-ышым керек","М13"],
      [L("можно / нельзя","may / may not","izin / yasak"),"-са болот / болбойт","М15"],
      [L("наверное","probably","olasılık"),"-са керек","М16"],
      [L("давайте","let's","haydi"),"-алы / -айын","М20"]]),
    harmonyTable([L("Роль","Role","Rol"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      [L("цепочка действий","action chain","eylem zinciri"),"-ып (М14)",h("span",{class:"kgword"},"жасап, келип")],
      [L("«который» перед словом","“which” attribute","sıfat"),"-ган (М18)",h("span",{class:"kgword"},"кечиккен учак")],
      [L("сделан кем-то","done by someone","edilgen"),"-ыл (М21)",h("span",{class:"kgword"},"жазылган")],
      [L("чужие слова","reported speech","alıntı"),"деп (М19)",h("span",{class:"kgword"},"келем деп айтты")],
      [L("три прошедших","three pasts","üç geçmiş"),"-ды · -ган · -чу (М12)",h("span",{class:"kgword"},"бардым · барган · барчу")]]),
    h("div",{class:"note"},L("Резюмирование (методика §5.3): возьми любой диалог М12–М21 и перескажи его 2–3 предложениями. Формула: Ким? + Эмне кылды? + Эмне үчүн?","Summarising (methodology §5.3): take any M12–M21 dialogue and retell it in 2–3 sentences. Formula: Who? + Did what? + Why?","Özetleme (metodoloji §5.3): M12–M21 diyaloglarından birini al ve 2–3 cümleyle yeniden anlat. Formül: Ким? + Эмне кылды? + Эмне үчүн?")),
    h("div",{class:"note"},L("План недели: мок-экзамен уровня A2 с наставником; по слабому навыку — ремедиальный блок (методика §7.7). Карточки: пройди «Вперемешку» в каждом модуле A2.","Week plan: an A2 mock exam with your mentor; a weak skill → a remedial block (methodology §7.7). Flashcards: run “Mixed” in every A2 module.","Hafta planı: danışmanla A2 deneme sınavı; zayıf beceriye telafi bloğu (metodoloji §7.7). Kartlar: her A2 modülünde “Karışık” turunu yap."))));
}
