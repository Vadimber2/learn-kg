
/* ---------- М1: Тексты недели ---------- */
function renderTextsM1(m){
  const dlg1=[["Мугалим: — Саламатсызбы! Атыңыз ким?","Учитель: — Здравствуйте! Как Ваше имя?","Teacher: — Hello! What is your name?","Öğretmen: — Merhaba! Adınız ne?"],
             ["Окуучу: — Саламатчылык! Менин атым Нурлан. Ал эми сиздин атыңыз ким?","Ученик: — Здравствуйте! Меня зовут Нурлан. А как Ваше имя?","Student: — Hello! My name is Nurlan. And what is your name?","Öğrenci: — Merhaba! Benim adım Nurlan. Peki sizin adınız ne?"],
             ["Мугалим: — Менин атым Айгүл. Сиз окуучусузбу?","Учитель: — Меня зовут Айгүл. Вы ученик?","Teacher: — My name is Aigül. Are you a student?","Öğretmen: — Benim adım Aygül. Siz öğrenci misiniz?"],
             ["Окуучу: — Ооба, мен окуучумун. Сиз мугалимсизби?","Ученик: — Да, я ученик. Вы учитель?","Student: — Yes, I am. Are you a teacher?","Öğrenci: — Evet, ben öğrenciyim. Siz öğretmen misiniz?"],
             ["Мугалим: — Ооба, мен мугалиммин. Таанышканыма кубанычтамын!","Учитель: — Да, я учитель. Рад(а) знакомству!","Teacher: — Yes, I am. Nice to meet you!","Öğretmen: — Evet, ben öğretmenim. Tanıştığımıza memnun oldum!"]];
  m.append(h("div",{class:"card"},
    h("h2",{},L("Диалог урока 1: знакомство ","Lesson 1 dialogue: introductions ","1. dersin diyaloğu: tanışma "),h("span",{class:"muted"},L("(образец, читать вслух за обе роли)","(sample — read aloud playing both roles)","(örnek — iki rolü de yüksek sesle oku)"))),
    biTable(dlg1),
    h("div",{class:"note"},L("Финальный шаг урока: представься полностью без опоры на записи — имя, «Мен …мын/мин» о себе и один вопрос собеседнику с -бы/-би.","Lesson finale: introduce yourself fully without notes — your name, a “Мен …мын/мин” sentence and one -бы/-би question for your partner.","Dersin son adımı: nota bakmadan kendini tam olarak tanıt — adın, kendinle ilgili bir “Мен …мын/мин” cümlesi ve karşındakine -бы/-би ile bir soru."))));
  const dlg=[["А: — Саламатсызбы!","А: — Здравствуйте!","А: — Hello!","A: — Merhaba!"],
             ["Б: — Саламатчылык! Кандайсыз?","Б: — Здравствуйте! Как Вы?","Б: — Hello! How are you?","B: — Merhaba! Nasılsınız?"],
             ["А: — Жакшы, рахмат. Менин атым Айбек. Атыңыз ким?","А: — Хорошо, спасибо. Меня зовут Айбек. Как Вас зовут?","А: — Fine, thanks. My name is Aibek. What is your name?","A: — İyiyim, teşekkürler. Benim adım Aybek. Adınız ne?"],
             ["Б: — Менин атым Максим. Таанышканыма кубанычтамын.","Б: — Меня зовут Максим. Рад знакомству.","Б: — My name is Maksim. Nice to meet you.","B: — Benim adım Maksim. Tanıştığımıza memnun oldum."],
             ["А: — Мен да. Сиз кайсы улуттансыз?","А: — Я тоже. Кто Вы по национальности?","А: — Me too. What is your nationality?","A: — Ben de. Hangi milliyettensiniz?"],
             ["Б: — Мен орусмун. Сиз кыргызсызбы?","Б: — Я русский. Вы кыргыз?","Б: — I am Russian. Are you Kyrgyz?","B: — Ben Rusum. Siz Kırgız mısınız?"],
             ["А: — Ооба, мен кыргызмын. Жашыңыз канчада?","А: — Да, я кыргыз. Сколько Вам лет?","А: — Yes, I am Kyrgyz. How old are you?","A: — Evet, ben Kırgızım. Kaç yaşındasınız?"],
             ["Б: — Мен отуз жаштамын. Сизчи?","Б: — Мне 30 лет. А Вам?","Б: — I am 30. And you?","B: — Ben otuz yaşındayım. Ya siz?"],
             ["А: — Мен жыйырма беш жаштамын. Кайда жашайсыз?","А: — Мне 25 лет. Где Вы живёте?","А: — I am 25. Where do you live?","A: — Ben yirmi beş yaşındayım. Nerede yaşıyorsunuz?"],
             ["Б: — Мен Бишкекте, Чүй проспектисинде жашайм.","Б: — Я живу в Бишкеке, на проспекте Чуй.","Б: — I live in Bishkek, on Chuy Avenue.","B: — Ben Bişkek'te, Çüy caddesinde yaşıyorum."],
             ["А: — Сиз студентсизби?","А: — Вы студент?","А: — Are you a student?","A: — Siz öğrenci misiniz?"],
             ["Б: — Жок, мен студент эмесмин. Мен программистмин. Сиз кайда иштейсиз?","Б: — Нет, я не студент. Я программист. Где Вы работаете?","Б: — No, I am not a student. I am a programmer. Where do you work?","B: — Hayır, öğrenci değilim. Ben yazılımcıyım. Siz nerede çalışıyorsunuz?"],
             ["А: — Мен мектепте мугалим болуп иштейм.","А: — Я работаю учителем в школе.","А: — I work as a teacher at a school.","A: — Ben okulda öğretmen olarak çalışıyorum."],
             ["Б: — Абдан жакшы! Таанышканыма аябай кубанычтамын.","Б: — Очень хорошо! Очень рад знакомству.","Б: — Very nice! Very glad to meet you.","B: — Çok güzel! Tanıştığımıza gerçekten çok sevindim."],
             ["А: — Мен да. Көрүшкөнчө!","А: — Я тоже. До встречи!","А: — Me too. See you!","A: — Ben de. Görüşmek üzere!"]];
  const texts=weekTextsCard("(учебный диалог, черновик до вычитки)","(study dialogue, draft until proofread)","Текст недели ","Text of the week ","(ders diyaloğu, düzeltiden önceki taslak)","Haftanın metni ");
  texts.append(h("h3",{},L("Диалог урока 2: «Атыңыз ким?» — полный","Lesson 2 dialogue: «Атыңыз ким?» — full version","2. dersin diyaloğu: “Атыңыз ким?” — tam biçim")),
    biTable(dlg),
    h("div",{class:"note"},L("Задание: 1) прочитай диалог дважды, меняясь ролями; 2) найди все личные аффиксы (-мын, -сыз, -мин…); 3) найди два вопроса «да/нет» с -бы/-би (Саламатсызбы! — приветствие, не в счёт); 4) разыграй диалог со СВОИМИ данными. «Кайда жашайсыз?» → ответ с «-те/-то»: Бишкек","Tasks: 1) read the dialogue twice, swapping roles; 2) find all personal affixes (-мын, -сыз, -мин…); 3) find the two yes/no -бы/-би questions (Саламатсызбы! is a greeting, not counted); 4) act it out with YOUR OWN details. «Кайда жашайсыз?» → answer with «-те/-то»: Бишкек","Görev: 1) diyaloğu rolleri değiştirerek iki kez oku; 2) bütün kişi eklerini bul (-мын, -сыз, -мин…); 3) -бы/-би ile kurulmuş iki “evet/hayır” sorusunu bul (Саламатсызбы! bir selamlamadır, sayılmaz); 4) diyaloğu KENDİ bilgilerinle canlandır. “Кайда жашайсыз?” → “-те/-то” ile cevap: Бишкек"),h("b",{},"те"),", Ош",h("b",{},"то"),"."));
  m.append(texts);
}
