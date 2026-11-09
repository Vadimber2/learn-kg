function renderRefM10(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Неделя интеграции: как повторять","Integration week: how to revise","Pekiştirme haftası: nasıl tekrar edilir")),
    h("p",{class:"muted"},L("Новых слов нет. Цель недели — связать все модули в одну систему и закрыть слабые места перед экзаменационным интенсивом.","No new words. The goal is to tie all modules into one system and close weak spots before the exam intensive.","Yeni kelime yok. Haftanın amacı: bütün modülleri tek bir sisteme bağlamak ve yoğun sınav haftasından önce zayıf noktaları kapatmak.")),
    harmonyTable([L("Вопрос","Question","Soru"),L("Падеж","Case","Hâl"),L("Аффикс","Affix","Ek"),L("Модуль","Module","Modül")],[
      ["кимдин? эмненин?","илик","-нын/-дын/-тын","М2"],
      ["кимге? кайда? (куда)","барыш","-га/-ге/-ка/-ке","М3"],
      ["кимде? кайда? (где)","жатыш","-да/-де/-та/-те","М3"],
      ["кимден? кайдан?","чыгыш","-дан/-ден/-тан/-тен","М4"],
      ["кимди? эмнени?","табыш","-ны/-ды/-ты","М6"]]),
    harmonyTable([L("Маркер","Marker","İşaret"),L("Форма","Form","Biçim"),L("Пример","Example","Örnek")],[
      ["азыр","-ып жатат (М3)",h("span",{class:"kgword"},"иштеп жатам")],
      ["адатта, күн сайын, эртең",L("аорист (М5)","aorist (M5)","geniş zaman (M5)"),h("span",{class:"kgword"},"иштейм, келет")],
      ["кечээ, былтыр","-ды (М6)",h("span",{class:"kgword"},"иштедим, бардык")],
      [L("намерение","intention","niyet"),"-макчы (М7)",h("span",{class:"kgword"},"бармакчымын")]]),
    h("div",{class:"note"},L("Резюмирование (методика §5.3): прочитай любой текст недели М2–М9 и перескажи его 2–3 предложениями по-кыргызски. Формула: Ким? + Эмне кылат/кылды? + Кайда/качан?","Summarising (methodology §5.3): take any weekly text from M2–M9 and retell it in 2–3 Kyrgyz sentences. Formula: Who? + Does/did what? + Where/when?","Özetleme (metodoloji §5.3): M2–M9 haftalık metinlerinden birini oku ve Kırgızca 2–3 cümleyle yeniden anlat. Formül: Ким? + Эмне кылат/кылды? + Кайда/качан?")),
    h("div",{class:"note"},L("План недели: мок-экзамен № 3 с наставником; по слабому навыку — ремедиальный блок (методика §7.7). Карточки: пройди «Вперемешку» в КАЖДОМ модуле — статистика покажет, что просело.","Week plan: mock exam #3 with your mentor; a weak skill → a remedial block (methodology §7.7). Flashcards: run “Mixed” in EVERY module — the stats will show what slipped.","Hafta planı: danışmanla 3 numaralı deneme sınavı; zayıf çıkan beceriye telafi bloğu (metodoloji §7.7). Kartlar: HER modülde “Karışık” turunu yap — istatistik neyin gerilediğini gösterir."))));
}
