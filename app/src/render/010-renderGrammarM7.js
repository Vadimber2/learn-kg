function renderGrammarM7(m){
  m.append(h("div",{class:"card"},h("h2",{},L("Будущее намеренное: -макчы","The intentional future: -макчы","Niyet geleceği: -макчы")),
    h("p",{class:"muted"},L("«Собираюсь / намерен»: основа + -макчы (4 варианта по гармонии) + личный аффикс:","“I intend to”: stem + -макчы (4 harmony variants) + personal affix:","“Niyetliyim / niyetindeyim”: gövde + -макчы (uyuma göre 4 varyant) + kişi eki:")),
    harmonyTable([L("Последняя гласная","Last vowel","Son ünlü"),"а, ы, у","э/е, и","о","ө, ү"],[
      [L("Вариант","Variant","Varyant"),["-макчы","бармакчымын"],["-мекчи","келмекчимин"],["-мокчу","брондомокчумун"],["-мөкчү","көрмөкчүмүн"]]]),
    h("p",{class:"muted"},L("Образцы: ","Samples: ","Örnekler: "),kgw("Мен Ошко учмакчымын.","m7_75")," · ",kgw("Мен бир бөлмө брондомокчумун.","m7_74"))));
  m.append(h("div",{class:"card"},h("h2",{},L("Отрицание глагола: -бай · Керек","Verb negation: -бай · Керек","Fiil olumsuzluğu: -бай · Керек")),
    h("p",{class:"muted"},L("Три отрицания кыргызского теперь в сборе: глагольное -ба- (барбайм), именное эмес (мугалим эмесмин, М1), бытийное жок (акча жок, М4).","All three Kyrgyz negations are now in place: verbal -ба- (барбайм), nominal эмес (M1), existential жок (M4).","Kırgızcanın üç olumsuzu artık tamam: fiilde -ба- (барбайм), isimde эмес (мугалим эмесмин, M1), varlıkta жок (акча жок, M4).")),
    harmonyTable([L("Основа","Stem","Gövde"),L("Отрицание","Negation","Olumsuz"),L("Пример","Example","Örnek")],[
      ["бар- (а)","-бай",["барбайм"]],
      ["кел- (е)","-бей",["келбейт"]],
      ["ич- (глухая ч)","-пей",["ичпейм"]],
      ["айт- (глухая т)","-пай",["айтпайм"]],
      ["көр- (ө)","-бөй",["көрбөйм"]]]),
    h("div",{class:"note"},L("Керек «нужно»: кому — барыш + что + керек: ","Керек “need”: dative + thing + керек: ","Керек “gerek”: kime — yönelme + ne + керек: "),kgw("Мага эки билет керек.","m7_76"),L(" Вопрос: Сизге бөлмө керекпи? Отрицание: керек эмес."," Question: Сизге бөлмө керекпи? Negation: керек эмес."," Soru: Сизге бөлмө керекпи? Olumsuzu: керек эмес."))));
  const dlg=[["А: — Саламатсызбы! Бош бөлмө барбы?","А: — Здравствуйте! Есть свободный номер?","A: — Hello! Do you have a vacant room?","A: — Merhaba! Boş oda var mı?"],
             ["Б: — Ооба, бар. Канча күнгө керек?","Б: — Да, есть. На сколько дней нужно?","B: — Yes. For how many days?","B: — Evet, var. Kaç gün için lazım?"],
             ["А: — Үч күнгө. Мен бир бөлмө брондомокчумун.","А: — На три дня. Я хочу забронировать номер.","A: — For three days. I’d like to book a room.","A: — Üç gün için. Bir oda ayırtmak istiyorum."],
             ["Б: — Паспортуңузду көрсөтүңүз. Каттоо беш мүнөт болот.","Б: — Покажите паспорт. Регистрация займёт пять минут.","B: — Your passport, please. Check-in takes five minutes.","B: — Pasaportunuzu gösterin. Kayıt beş dakika sürer."],
             ["А: — Бул жерде вай-фай барбы?","А: — Здесь есть Wi-Fi?","A: — Is there Wi-Fi here?","A: — Burada Wi-Fi var mı?"],
             ["Б: — Бар, акысыз. Пароль — бөлмөдө.","Б: — Есть, бесплатный. Пароль — в номере.","B: — Yes, free. The password is in the room.","B: — Var, ücretsiz. Şifre odada."],
             ["А: — Рахмат! Эртең мен аэропортко бармакчымын. Такси канча турат?","А: — Спасибо! Завтра я собираюсь в аэропорт. Сколько стоит такси?","A: — Thanks! Tomorrow I intend to go to the airport. How much is a taxi?","A: — Teşekkürler! Yarın havalimanına gitmeye niyetliyim. Taksi kaç para?"],
             ["Б: — Төрт жүз сом. Кечинде брондоңуз — эртең менен күтпөйсүз.","Б: — 400 сомов. Забронируйте вечером — утром не будете ждать.","B: — 400 som. Book in the evening — no waiting in the morning.","B: — Dört yüz som. Akşamdan ayırtın — sabah beklemezsiniz."]];
  weekDialog(m,"Диалог: «Мейманканада»","Dialogue: «At the hotel»",dlg,
    "Задание: 1) прочитай диалог, меняясь ролями; 2) найди формы -макчы и объясни гармонию; 3) найди отрицание -бай/-пей; 4) ролевой диалог с Claude-тьютором: администратор гостиницы, кассир вокзала (методика §6.5).","Tasks: 1) read swapping roles; 2) find the -макчы forms and explain the harmony; 3) find the -бай/-пей negation; 4) role-play with the Claude tutor: hotel receptionist, station cashier (methodology §6.5).","Diyalog: «Мейманканада» (otelde)","Görev: 1) diyaloğu rolleri değiştirerek oku; 2) -макчы biçimlerini bul ve uyumu açıkla; 3) -бай/-пей olumsuzluğunu bul; 4) Claude öğretmeniyle rol yap: otel resepsiyonisti, gar gişe görevlisi (metodoloji §6.5).");
}
