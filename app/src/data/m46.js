
/* ---------- М46 «Повторение B2» (зеркало М34/М22/М10): только повторение ----------
   Новых слов нет (гейт REVISION_MODS в content.test.js): фразы и вопросы всех
   десяти модулей B2 (m36–m45) — ref-ами, дриллы — сводка грамматики m36–m45 с qKy
   (канон B1/B2). Ids проверены по реальным файлам app/src/data/m36..m45.js. */
const CATS_M46 = {
  frazy:"Ключевые фразы B2 (повторение)", suroo:"Вопросы всех модулей B2 (повторение)"
};
const VOCAB_M46 = [
 {ref:"m36_72",cat:"frazy"},
 {ref:"m37_65",cat:"frazy"},
 {ref:"m38_73",cat:"frazy"},
 {ref:"m39_70",cat:"frazy"},
 {ref:"m40_66",cat:"frazy"},
 {ref:"m41_71",cat:"frazy"},
 {ref:"m42_78",cat:"frazy"},
 {ref:"m43_59",cat:"frazy"},
 {ref:"m44_74",cat:"frazy"},
 {ref:"m45_78",cat:"frazy"},
 {ref:"m36_66",cat:"suroo"},
 {ref:"m37_58",cat:"suroo"},
 {ref:"m38_65",cat:"suroo"},
 {ref:"m39_63",cat:"suroo"},
 {ref:"m40_60",cat:"suroo"},
 {ref:"m41_66",cat:"suroo"},
 {ref:"m42_74",cat:"suroo"},
 {ref:"m43_53",cat:"suroo"},
 {ref:"m44_67",cat:"suroo"},
 {ref:"m45_72",cat:"suroo"}
];
const DRILL_M46 = [
 {g:"rasmiy",qKy:"«Арыз мекеме тарабынан кабыл ал… .» (расмий, туюк мамиле).",q:"«Заявление принимается учреждением» (официально, страдательный залог).",qEn:"“The application is accepted by the institution” (formal, passive).",qTr:"“Dilekçe kurum tarafından kabul edilir” (resmî, edilgen çatı).",noteEn:"passive -ын",noteTr:"edilgen -ын",opts:["алынат","алат","алдырат","алышат"],c:0,note:"страдательный залог: ал- + -ын + -ат (М36)"},
 {g:"rasmiy",qKy:"«Мыйзамга … иш жүргүзүлөт.» (эрежеге дал келип).",q:"«Дело ведётся в соответствии с законом».",qEn:"“The matter is conducted in accordance with the law”.",qTr:"“İş kanuna uygun yürütülür”.",noteEn:"ылайык",noteTr:"uygun",opts:["ылайык","боюнча","карата","тарабынан"],c:0,note:"«ылайык» — при соответствии правилу, после дательного падежа (М36)"},
 {g:"rasmiy",qKy:"«Беш жылдан … ушул мекемеде иштейм.» (с тех пор как — пять лет).",q:"«Я работаю в этом учреждении вот уже пять лет».",qEn:"“I have been working at this institution for five years now”.",qTr:"“Beş yıldır bu kurumda çalışıyorum”.",noteEn:"-бери",noteTr:"-den beri",opts:["кийин","мурун","бери","чейин"],c:2,note:"-дан бери — действие, длящееся от начального момента до настоящего времени (М37)"},
 {g:"rasmiy",qKy:"«Сабак … мугалим бүгүн эс алууда.» (обычно ведущий уроки).",q:"«Учитель, обычно ведущий уроки, сегодня отдыхает».",qEn:"“The teacher who usually gives the lessons is off today”.",qTr:"“Genelde ders veren öğretmen bugün izinli”.",noteEn:"-үүчү",noteTr:"-en öğretmen",opts:["берген","берүүчү","берип","берет"],c:1,note:"-уучу — название человека, постоянно выполняющего действие (М37)"},
 {g:"rasmiy",qKy:"«Убакыт аз … , тез бүттүм.» (потому что было мало времени).",q:"«Так как времени было мало, я закончил быстро».",qEn:"“Since there was little time, I finished quickly”.",qTr:"“Vakit az olduğundan çabuk bitirdim”.",noteEn:"-гандыктан",noteTr:"-dığından",opts:["болсо","болгондо","болот эле","болгондуктан"],c:3,note:"-гандыктан выражает причину (М38)"},
 {g:"modaldyk",qKy:"«Ар бир жаран мыйзамды … .» (обязан соблюдать).",q:"«Каждый гражданин обязан соблюдать закон».",qEn:"“Every citizen is obliged to obey the law”.",qTr:"“Her vatandaş kanuna uymakla yükümlüdür”.",noteEn:"-ууга милдеттүү",noteTr:"-mekle yükümlü",opts:["сактоого милдеттүү","сактоого укуктуу","сактаган соң","сактабай коёт"],c:0,note:"имя действия + дательный падеж + милдеттүү: выражает обязанность (М39)"},
 {g:"modaldyk",qKy:"«Убагында айт… , мунун баары болмок эмес.» (если бы сказал вовремя).",q:"«Если бы сказал вовремя, ничего этого не случилось бы».",qEn:"“If he had said it in time, none of this would have happened”.",qTr:"“Zamanında söyleseydi, bunların hiçbiri olmazdı”.",noteEn:"-са болмок",noteTr:"-seydi",opts:["айтканда","айткандыктан","айтса","айтса дагы"],c:2,note:"-са болмок: несостоявшееся условие (М39)"},
 {g:"modaldyk",qKy:"«Иштеген … , көбүрөк үйрөнөсүң.» (чем больше работаешь).",q:"«Чем больше работаешь, тем больше учишься».",qEn:"“The more you work, the more you learn”.",qTr:"“Ne kadar çok çalışırsan, o kadar çok öğrenirsin”.",noteEn:"сайын",noteTr:"-dıkça",opts:["чейин","сайын","кийин","бери"],c:1,note:"сайын присоединяется к форме на -ган: иштеген сайын (М40)"},
 {g:"modaldyk",qKy:"«Бул жыл мурунку жыл… ийгиликтүү.» (по сравнению с прошлым годом).",q:"«Этот год успешнее по сравнению с прошлым».",qEn:"“This year is more successful compared to the last one”.",qTr:"“Bu yıl geçen yıla göre daha başarılı”.",noteEn:"-га караганда",noteTr:"-e göre",opts:["-дан кийин","-га чейин","-нын алдында","-га караганда"],c:3,note:"-га караганда — выражает сравнение (М40)"},
 {g:"modaldyk",qKy:"«Бул ыкма илимде эксперимент деп … .» (называется).",q:"«Этот метод в науке называется экспериментом».",qEn:"“This method is called an experiment in science”.",qTr:"“Bu yönteme bilimde deney denir”.",noteEn:"аталат",noteTr:"denir",opts:["саналат","турат","аталат","жардам берет"],c:2,note:"«деп аталат» — называние по имени (М41)"},
 {g:"baaberuu",qKy:"«Анын чебер … суктанам.» (восхищаюсь тем, что он мастер).",q:"«Я восхищаюсь тем, что он мастер».",qEn:"“I admire that he is a master”.",qTr:"“Usta olmasına hayranım”.",noteEn:"болгонуна",noteTr:"olduğuna",opts:["болгондон","болгонуна","болсо","болгондо"],c:1,note:"-ганына суктанам: эмоциональная оценка (М42)"},
 {g:"baaberuu",qKy:"«Мөңгүлөрдүн эри… , суу деңгээли көтөрүлдү.» (в результате таяния).",q:"«В результате таяния ледников уровень воды поднялся».",qEn:"“As a result of the glaciers melting, the water level rose”.",qTr:"“Buzulların erimesi sonucunda su seviyesi yükseldi”.",noteEn:"натыйжасында",noteTr:"sonucunda",opts:["эришине чейин","эрибей калгандыктан","эриши үчүн","эришинин натыйжасында"],c:3,note:"-ынын натыйжасында — выражает следствие (М43)"},
 {g:"baaberuu",qKy:"«Ынтымакта жашаганы жакшы деп мугалим … .» (сказал, что).",q:"«Учитель сказал, что жить в согласии — хорошо».",qEn:"“The teacher said that living in harmony is good”.",qTr:"“Öğretmen uyum içinde yaşamanın iyi olduğunu söyledi”.",noteEn:"айтты",noteTr:"söyledi",opts:["айтылды","айтылат","айтты","айтса"],c:2,note:"-ганын айтты: оценка в косвенной речи (М44)"},
 {g:"baaberuu",qKy:"«Массалык маалымат каражаттары чындыкты … .» (обязаны писать правду).",q:"«СМИ обязаны писать правду».",qEn:"“The media are obliged to write the truth”.",qTr:"“Medya gerçeği yazmakla yükümlüdür”.",noteEn:"жазууга тийиш",noteTr:"yazmakla yükümlü",opts:["жазган соң","жазууга тийиш","жазса болмок","жазганы жакшы"],c:1,note:"отглагольное имя -үү + -гө тийиш: выражает обязанность (М45)"},
 {g:"baaberuu",qKy:"«Министрлик жаңы эреже … .» (заявило, что вступает в силу).",q:"«Министерство заявило, что новое правило вступает в силу».",qEn:"“The ministry stated that the new rule comes into force”.",qTr:"“Bakanlık yeni kuralın yürürlüğe girdiğini bildirdi”.",noteEn:"күчүнө кирет деп билдирди",noteTr:"yürürlüğe girdiğini bildirdi",opts:["күчүнө кирсин деди","күчүнө кирген экен","күчүнө кире электир","күчүнө кирет деп билдирди"],c:3,note:"косвенная речь с глаголами сообщения: маалымдады/билдирди (М45)"}
];
