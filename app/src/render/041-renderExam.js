
/* ===EXAM=== Итоговая проверка курса learn.kg — один движок на все курсы.

   Отличие от «Мини-теста»: тот тренирует один модуль, эта проверка идёт по всему
   курсу — части подряд, у каждой свой таймер, назад хода нет, задания выдаются
   случайной выборкой из материала всего курса. Спецификация (части, число
   заданий, минуты) живёт в data/exam-<курс>.js и регистрируется в EXAM_SPECS;
   здесь — только механика. Задания составлены learn.kg по материалам курса и не
   связаны с заданиями официального тестирования. Курс выбирается по неделе
   (Exam.use), новый курс = данные. */
/* Единственная ссылка на официальный сайт тестирования: формат, уровни и запись —
   там, а не в тренажёре. */
const EXAM_SITE="https://kyrgyztest.gov.kg";
/* Курс модуля — по каталогу MODULE_META (в собранной странице то же делает courseOf
   из ===TRAIL===; здесь без умолчания «a1»: неизвестный модуль = null, и гарды
   «своя ли неделя» не срабатывают на стендах без каталога). */
function examCourseOf(mid){
  const mm=(typeof MODULE_META!=="undefined"?MODULE_META:[]).find(x=>x.id===mid);
  return (mm&&mm.course)||null;
}
/* Что уже работает и что честно помечено «готовится», решает поле ready субтеста:
   Окуу/Угуу стоят на вычитанных текстах своего курса, Жазуу и Сүйлөө проверяет
   преподаватель. Ученику показывается ровно то, что есть: молчащих кнопок не бывает. */

/* Банк субтеста «Лексика. Грамматика»: дриллы модулей курса (формулировки на
   кыргызском), предложения и дефиниции словаря и пары
   «реплика → ответ» из диалогов курса. Чистая функция — исполняется в тестах
   на модельных данных. */
function examBank(content, mods, dialogs){
  const drills=[],lex=[],replies=[];
  // служебная пометка курса: «(М9», «(3-е лицо», «из М2)», «(образец»; время «(10:30)» — не пометка
  const service=/\(М\d|\(\d+-е|\(образц|\(пример|М\d\)/i;
  for(const id of mods){
    const c=content[id]||{};
    for(let i=0;i<(c.drill||[]).length;i++){
      const d=c.drill[i];
      if(d&&Array.isArray(d.opts)&&d.opts.length>=2&&Number.isInteger(d.c)
         &&!service.test(String(d.qKy||d.q||""))&&!d.opts.some(o=>service.test(String(o))))
        drills.push({id:id+"_d"+i,kind:"drill",mod:id,q:d.qKy||d.q||"",opts:d.opts.slice(),c:d.c,
          ru:d.q||"",rule:((c.drillGroups||{})[d.g]||{}).rule||""});
    }
    for(const v of (c.vocab||[])){
      // def и cat нужны заданиям «дефиниция → слово» и «лишнее слово»: без них
      // эти типы молча не собирались бы, и экзамен снова стал бы однообразным.
      // Глосса со служебной пометкой («(3-е лицо)», «ср. … из М2») — не
      // экзаменационный текст: в разборе она стала бы методической подсказкой
      // (поймано гейтом A1 на m0_65)
      if(v&&!v.ref&&v.ky&&v.ru&&!service.test(String(v.ru)))
        lex.push({id:v.id,kind:"lex",mod:id,ky:v.ky,ru:v.ru,def:v.def||"",cat:v.cat||""});
    }
    /* Реплика → ответ: вопрос одного персонажа и ответ ДРУГОГО, обе строки —
       вычитанные реплики диалога курса. Ответ — не меньше двух слов: «Ооба.»
       подходит к любому вопросу и дал бы два верных варианта. */
    for(const part of ((dialogs||{})[id]||{}).parts||[]){
      const ls=part.lines||[];
      for(let i=0;i+1<ls.length;i++){
        const a=ls[i],b=ls[i+1];
        if(!a||!b||!a.ky||!b.ky||!a.sp||a.sp===b.sp||!/\?\s*$/.test(a.ky))continue;
        if(String(b.ky).split(/\s+/).length<2||service.test(String(b.ru||"")))continue;
        replies.push({id:b.id+"_r",mod:id,q:a.ky,ky:b.ky,ru:b.ru||"",qSt:examStems(a.ky),kySt:examStems(b.ky)});
      }
    }
  }
  return {drills,lex,replies};
}
/* Выборка попытки: детерминирована сидом, поэтому обновление страницы во время
   проверки не подсовывает другой набор (лист попытки один). */
function examSeedPick(arr,n,seed){
  const a=arr.slice();let s=seed>>>0||1;
  for(let i=a.length-1;i>0;i--){s=(s*1664525+1013904223)>>>0;const j=s%(i+1);const x=a[i];a[i]=a[j];a[j]=x;}
  return a.slice(0,n);
}
/* Задания субтеста «Лексика. Грамматика».

   Лист целиком на кыргызском, а варианты ответа похожи друг на друга
   (решение владельца 29.10.2026: перевод подсказывал ответ). Поэтому заданий «слово → перевод» нет,
   а шесть типов собираются из вычитанного материала курса, ничего не сочиняется:

     drill  — грамматический дрилл модуля: варианты — формы одного слова
     def    — кыргызская дефиниция → слово (канон B1: слово вводится через выученное)
     cloze  — пропуск в предложении курса; дистракторы — реальные слова курса
     reply  — реплика диалога → ответ собеседника; дистракторы — ответы из других
              диалогов, похожие на верный (общие слова, та же длина)
     order  — восстановить порядок слов предложения (ответ один — сама фраза)
     odd    — лишнее слово: три из одной темы курса, одно из чужой

   У каждого задания есть explain — фраза-источник с переводом и модуль: после
   ответа ученик видит не «неверно», а живой пример и куда вернуться. Без этого
   экзамен только измеряет, а должен ещё и учить. */
const EXAM_KINDS=["drill","def","cloze","reply","order","odd"];
function examCloze(w,pool,seed){
  const parts=String(w.ky).split(/\s+/);
  if(parts.length<4)return null;
  const at=1+(seed%(parts.length-2));           // не первое и не последнее слово
  const hole=parts[at].replace(/[.,!?;:]$/,"");
  if(hole.length<3)return null;
  const cap=(x)=>/^[А-ЯЁӨҮҢA-Z]/.test(x);
  const others=examSameLen(pool.filter(x=>x!==hole&&x.length>=3&&x[0]!==hole[0]&&cap(x)===cap(hole)
    &&/[.!?]$/.test(x)===/[.!?]$/.test(hole)),hole).slice(0,3);
  if(others.length<3)return null;
  const opts=examSeedPick([hole,...others],4,seed);
  return {t:"cloze",ref:w.id,mod:w.mod,q:parts.map((p,i)=>i===at?"____":p).join(" "),
    opts,c:opts.indexOf(hole),explain:{ky:w.ky,ru:w.ru}};
}
/* Основы слов реплики: первые четыре буквы каждого слова длиннее двух —
   «кандайсың» и «кандай» дают одну основу, падежные хвосты не мешают сравнению. */
function examStems(x){
  return new Set(String(x).toLowerCase().replace(/[^\p{L}\s-]/gu," ").split(/\s+/)
    .filter(w=>w.length>=3).map(w=>w.slice(0,4)));
}
function examReply(r,all,seed){
  const shares=(a,b)=>{for(const w of a)if(b.has(w))return true;return false;};
  /* Чужой ответ годится в дистракторы, только если его вопрос не похож на наш:
     ответы на «Кандайсыз?» и «Иштер кандай?» оба верны — второй верный вариант
     и есть главный брак самодельных тестов. */
  const fits=all.filter(x=>x.ky!==r.ky&&x.q!==r.q&&!shares(x.qSt,r.qSt));
  // похожие на верный: делят с ним основу слова — так варианты отличаются смыслом, а не видом
  const near=fits.filter(x=>shares(x.kySt,r.kySt));
  const pool=examSameLen(near.length>=3?near:fits,r.ky,(x)=>x.ky);
  const others=[...new Set(examSeedPick(pool,8,seed).map(x=>x.ky))].slice(0,3);
  if(others.length<3)return null;
  const opts=examSeedPick([r.ky,...others],4,(seed+3)>>>0);
  return {t:"reply",ref:r.id,mod:r.mod,q:r.q,opts,c:opts.indexOf(r.ky),explain:{ky:r.q+" — "+r.ky,ru:r.ru}};
}
function examOrder(w,seed){
  const parts=String(w.ky).replace(/[.!?]$/,"").split(/\s+/);
  if(parts.length<4||parts.length>6)return null;
  const right=parts.join(" ");
  const opts=[right];
  for(let k=0;k<6&&opts.length<4;k++){
    const cand=examSeedPick(parts,parts.length,(seed+k*31)>>>0).join(" ");
    if(!opts.includes(cand))opts.push(cand);
  }
  if(opts.length<4)return null;
  const mixed=examSeedPick(opts,4,(seed+5)>>>0);
  let q="";
  for(let k=0;k<8;k++){q=examSeedPick(parts,parts.length,(seed+9+k*101)>>>0).join(" · ");
    if(q.replace(/ · /g," ")!==right)break;q="";}
  if(!q)return null;   // не удалось перемешать (все слова одинаковы) — задание не выпускаем
  return {t:"order",ref:w.id,mod:w.mod,q,
    opts:mixed,c:mixed.indexOf(right),explain:{ky:w.ky,ru:w.ru}};
}
function examOdd(w,sameCat,otherCat,seed){
  if(sameCat.length<3||!otherCat.length)return null;
  const three=examSeedPick(examSameLen(sameCat,(otherCat[seed%otherCat.length]||{}).ky||"",(x)=>x.ky),3,seed).map(x=>x.ky);
  const alien=otherCat[seed%otherCat.length];
  if(three.includes(alien.ky))return null;
  const opts=examSeedPick([...three,alien.ky],4,(seed+3)>>>0);
  return {t:"odd",ref:w.id+"_odd",mod:w.mod,q:"",opts,c:opts.indexOf(alien.ky),
    explain:{ky:alien.ky,ru:alien.ru}};
}
function examItems(bank,n,seed){
  const lex=bank.lex,drills=bank.drills,replies=bank.replies||[];
  const pool=[...new Set(lex.flatMap(x=>String(x.ky).split(/\s+/)).map(x=>x.replace(/[.,!?;:]$/,"")).filter(x=>x.length>=3))];
  const sentences=lex.filter(x=>String(x.ky).split(/\s+/).length>=4);
  const isWord=(x)=>String(x.ky).split(/\s+/).length<=2&&!/[.!?]$/.test(String(x.ky));
  // дефиниция с методической пометкой курса («… (М9)») — не экзаменационный текст:
  // ученик видит служебную ссылку на модуль вместо задания (поймано на проде)
  const cleanDef=(x)=>x.def&&!/\(М?\d|\(образц|\(пример/i.test(x.def);
  const withDef=lex.filter(x=>cleanDef(x)&&isWord(x));
  const byCat={};for(const x of lex)if(x.cat)(byCat[x.cat]=byCat[x.cat]||[]).push(x);
  const cats=Object.keys(byCat).filter(c=>byCat[c].length>=3);
  const out=[],used=new Set();
  /* Задание не выпускается, если верный ответ вычисляется БЕЗ ЗНАНИЯ ЯЗЫКА:
     он единственный с заглавной буквы, единственный с точкой или резко длиннее
     (короче) остальных. Такие задания измеряют внимательность, а не кыргызский —
     все три ловушки найдены адверсарной проверкой на моих же данных. */
  const giveaway=(it)=>{
    const right=String(it.opts[it.c]);
    const uniqBy=(f)=>{const y=it.opts.filter(x=>f(String(x)));return y.length===1&&f(right);};
    if(uniqBy(x=>/^[А-ЯЁӨҮҢA-Z]/.test(x)))return true;
    if(uniqBy(x=>/[.!?]$/.test(x)))return true;
    const lens=it.opts.map(x=>String(x).length);
    const mx=Math.max(...lens),mn=Math.min(...lens);
    if(mx>mn*2.5&&(right.length===mx||right.length===mn))return true;
    return false;
  };
  const add=(it)=>{
    if(!it||used.has(it.ref)||new Set(it.opts).size!==it.opts.length||giveaway(it))return false;
    used.add(it.ref);out.push(it);return true;
  };
  /* Один конструктор на тип: источник (перемешан сидом попытки) + сборка задания
     из его k-го элемента. Ими пользуются и план, и добор — тип заводится в одном месте. */
  const KINDS={
    // грамматике объяснение нужнее всего: перевод задания и правило группы из данных курса
    drill:{src:examSeedPick(drills,drills.length,seed),
      make:(d)=>({t:"drill",ref:d.id,mod:d.mod,q:d.q,opts:d.opts,c:d.c,explain:{ky:d.q,ru:d.ru,rule:d.rule}})},
    cloze:{src:examSeedPick(sentences,sentences.length,(seed^0x44)>>>0),
      make:(w,k)=>examCloze(w,examSeedPick(pool,12,(seed+k*17)>>>0),(seed+k*13)>>>0)},
    reply:{src:examSeedPick(replies,replies.length,(seed^0x66)>>>0),
      make:(r,k)=>examReply(r,replies,(seed+k*211)>>>0)},
    def:{src:examSeedPick(withDef,withDef.length,(seed^0x33)>>>0),
      make:(w,k)=>{
        const others=examSeedPick(examSameLen(withDef.filter(x=>x.id!==w.id&&x.ky!==w.ky),w.ky,(x)=>x.ky),3,(seed+k*613)>>>0).map(x=>x.ky);
        if(others.length<3)return null;
        const opts=examSeedPick([w.ky,...others],4,(seed+k*977)>>>0);
        return {t:"def",ref:w.id+"_def",mod:w.mod,q:w.def,opts,c:opts.indexOf(w.ky),explain:{ky:w.ky,ru:w.ru}};
      }},
    order:{src:examSeedPick(sentences,sentences.length,(seed^0x55)>>>0),
      make:(w,k)=>examOrder(w,(seed+k*29)>>>0)},
    odd:{src:cats.length?Array.from({length:cats.length*3},(_,k)=>k):[],
      make:(k)=>{
        const cat=cats[(seed+k)%cats.length];
        const len=1+((seed+k)%2);                       // все четыре — одной длины в словах
        const fit=(x)=>isWord(x)&&String(x.ky).split(/\s+/).length===len;
        const same=byCat[cat].filter(fit);
        const other=lex.filter(x=>x.cat&&x.cat!==cat&&fit(x));
        return examOdd({id:cat+"_"+k,mod:(same[0]||{}).mod||"m24"},same,other,(seed+k*97)>>>0);
      }}};
  const pos={},cnt={};
  // следующее годное задание типа; false — источник исчерпан
  const take=(kind)=>{
    const K=KINDS[kind];
    while((pos[kind]||0)<K.src.length){
      const k=pos[kind]=(pos[kind]||0)+1;
      if(add(K.make(K.src[k-1],k-1))){cnt[kind]=(cnt[kind]||0)+1;return true;}
    }
    return false;
  };
  // доли типов: грамматика — треть субтеста, затем текст (пропуск, диалог), остальное поровну
  const plan=[["drill",0.34],["cloze",0.2],["reply",0.16],["def",0.12],["order",0.1],["odd",0.08]];
  for(const [kind,share] of plan)while((cnt[kind]||0)<Math.round(n*share)&&take(kind));
  // Добор: по плану не набралось (короткий банк, у A1 нет дефиниций) — те же типы
  // по кругу, пока лист не полон: ученик получает полный лист и не один тип подряд
  let live=plan.map((x)=>x[0]);
  for(let k=0;out.length<n&&live.length;k++){
    const kind=live[k%live.length];
    if(!take(kind))live=live.filter((x)=>x!==kind);
  }
  return examSeedPick(out,Math.min(n,out.length),(seed+1)>>>0);
}
/* Тексты из диалогов курса для Окуу и Угуу. Отзыв ученицы (29.10.2026): шесть
   предложений реестра — слишком короткий текст против связного диалога. Часть диалога — это уже вычитанный кыргызский текст в
   ~100 слов с вопросами на кыргызском (quiz) и озвучкой каждой реплики, поэтому
   ничего не сочиняется. Предложение-доказательство — первая реплика, где стоит
   верный ответ; не нашлось — разбор показывает весь вопрос без цитаты.
   Для Угуу годится только часть, у каждой реплики которой есть дорожка (id). */
function examDialogTexts(dialogs,mods,kind){
  const out=[];
  const norm=(x)=>String(x).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim();
  for(const id of mods){
    (((dialogs||{})[id]||{}).parts||[]).forEach((p,pi)=>{
      const ls=(p.lines||[]).filter(l=>l&&l.ky);
      const qz=(p.quiz||[]).filter(q=>q&&q.q&&Array.isArray(q.opts)&&q.opts.length===4&&Number.isInteger(q.c));
      if(ls.length<4||qz.length<2)return;
      if(kind==="uguu"&&!ls.every(l=>l.id))return;
      const nl=ls.map(l=>norm(l.ky));
      out.push({id:"dlg_"+id+"_"+pi,kind,mod:id,audio:kind==="uguu"?"lines":"",
        title:{ky:p.title||""},
        lines:ls.map(l=>({ky:(l.sp?l.sp+": ":"")+l.ky,src:l.id||""})),
        qs:qz.map(q=>{const ans=norm(q.opts[q.c]);
          return {ky:q.q,opts:q.opts.slice(),c:q.c,s:nl.findIndex(l=>l.includes(ans))};})});
    });
  }
  return out;
}
/* Задания субтестов Окуу и Угуу: текст показывается целиком, вопросы к нему идут
   подряд. Ответ ученика сверяется с данными текста, разбор указывает предложение,
   из которого ответ следует, — экзамен объясняет, а не только считает. */
function examTextItems(texts,n,seed){
  const out=[];const librand=7919;
  for(const T of examSeedPick(texts,texts.length,seed)){
    const mod=T.mod||String((T.lines[0]||{}).src||"").split("_")[0];
    const lines=T.lines.map(l=>l.ky),srcs=T.lines.map(l=>l.src);
    for(const q of T.qs){
      // перемешивание обязательно: в данных верный всегда первым (c:0), и без
      // шафла Окуу/Угуу решались «жми первую кнопку» (ревью 22.08, critical)
      const opts=examSeedPick(q.opts,4,(seed+out.length*librand)>>>0);
      out.push({t:"text",ref:T.id+"_"+T.qs.indexOf(q),mod,textId:T.id,title:T.title,
        lines,srcs,audio:T.audio||"",q:q.ky,opts,c:opts.indexOf(q.opts[q.c]),
        explain:{ky:(T.lines[q.s]||{}).ky||q.ky,ru:"",rule:""}});
      if(out.length>=n)return out;
    }
  }
  return out;
}
/* Варианты одного порядка длины: иначе верный ответ вычисляется линейкой,
   а не языком (дефект пойман адверсарной проверкой на задании m26_01_def). */
function examSameLen(list,target,pick){
  const L=String(target).length;
  const near=list.filter(x=>{const l=String(pick?pick(x):x).length;return l>=L/1.8&&l<=L*1.8;});
  return near.length>=3?near:list;
}
function examPct(right,total){return total?Math.round((right/total)*100):0;}
/* Итог попытки по ВСЕМ ответам всех субтестов. Отдельной функцией, потому что
   первая версия считала «верные по всем, всего — по последнему листу» и выдавала
   до 400% (поймано ревью 22.08.2026). */
function examSummary(answers){
  const right=answers.filter(x=>x.ok).length,total=answers.length;
  const byMod={},bySub={};
  for(const x of answers){
    const r=byMod[x.mod]||(byMod[x.mod]={n:0,ok:0});r.n++;if(x.ok)r.ok++;
    const q=bySub[x.sub]||(bySub[x.sub]={n:0,ok:0});q.n++;if(x.ok)q.ok++;
  }
  return {right,total,pct:examPct(right,total),byMod,bySub};
}
/* Вопросы письма и речи — вопросительные фразы словаря курса (ky кончается на «?»).
   Кыргызский не сочиняется: берётся банк лексики курса (examBank уже отсёк алиасы
   и служебные пометки), одна фраза — один раз. Чистая функция — для тестов. */
function examQuestions(lex){
  const seen=new Set(),out=[];
  for(const x of lex||[]){
    const ky=String((x&&x.ky)||"").trim();
    if(!/\?$/.test(ky)||ky.split(/\s+/).length<2||seen.has(ky))continue;
    seen.add(ky);out.push({id:x.id,mod:x.mod,ky});
  }
  return out;
}
/* Темы письма и рассказа — названия модулей курса (MODULE_META), а не чужие списки:
   экзаменационные недели и модули из skip темой не служат, have(id) — модуль есть
   в варианте ученика. */
function examTopics(meta,course,skip,have){
  return (meta||[]).filter(mm=>mm.course===course&&!mm.exam&&!(skip||[]).includes(mm.id)&&(!have||have(mm.id)))
    .map(mm=>({mod:mm.id,ru:mm.title,en:mm.titleEn||mm.title,tr:mm.titleTr||mm.titleEn||mm.title}));
}

/* Курс записи (снимок, итог, работа): записи до экзамена A1 поля course не имели —
   все они B1. Единственное место, где живёт это легаси-правило. */
function examRecCourse(x){return (x&&x.course)||"b1";}
const Exam={
  /* Единственное состояние — курс открытой недели; спека из него выводится
     (реестр EXAM_SPECS). Стенды без реестра выставляют spec руками — сеттер
     хранит её как запасную. */
  course:null,
  _spec:(typeof EXAM_B1!=="undefined"?EXAM_B1:null),
  get spec(){return this.specOf(this.course);},
  set spec(v){this._spec=v;},
  st:null,
  use(course){if(course)this.course=course;},
  /* Спека по курсу: попытка живёт спекой СВОЕГО курса (st.course), вкладка —
     своего; переключение this.spec на курс попытки ломало интро на экране. */
  specOf(course){
    const R=(typeof EXAM_SPECS!=="undefined")?EXAM_SPECS:null;
    return (course&&R&&R[course])||this._spec;
  },
  /* Своя ли запись (снимок, итог, работа, попытка) открытой неделе — один
     предикат на все гарды; тренировка чужого курса — тоже чужая. */
  own(x){return examRecCourse(x)===(this.course||"b1");},
  /* Протухший снимок не поднимается и не блокирует: старше суток или с давно
     истёкшим дедлайном — иначе первый тик выбрасывал из субтеста (ревью 22.08). */
  stale(run){return (Date.now()-(run.startedAt||0))>24*3600*1000||(run.deadline||0)<Date.now()-60000;},
  /* Чужая ПОПЫТКА — живая ИЛИ в снимке: после F5 на неделе A1 живого st нет, а
     снимок B1 есть, и интро с «Начать» перезаписало бы его (поймано живым
     браузером 04.09.2026). Тренировка чужого курса неделю не блокирует: это
     репетиция без записи — «Начать» на другой неделе её просто заменяет (как
     и на своей). Протухший чужой снимок убирается, как в resume. */
  foreignRec(){
    if(this.st)return (this.st.train||this.own(this.st))?null:this.st;
    const run=ST.examRun;
    if(!run||!Array.isArray(run.queue)||run.train||this.own(run))return null;
    if(this.stale(run)){delete ST.examRun;save();return null;}
    return run;
  },
  // текущий субтест всегда queue[qi]: выводимое не хранится отдельным полем
  subSpec(){const st=this.st;return this.specOf(st.course).subtests[st.queue[st.qi]];},
  /* Готовность субтеста выводится из данных: «Лексика. Грамматика» стоит на банке
     курса, Окуу — на текстах реестра. Появятся тексты с дорожками — включится Угуу,
     ноль правок логики. Жазуу и Сүйлөө проверяет преподаватель — отдельный поток. */
  texts(kind,course){
    // тексты — реестр EXAM_TEXT_SETS по курсу (файл на курс); стенд без реестра
    // даёт одиночный EXAM_TEXTS, стенд без курса — все наборы разом
    course=course||this.course;
    const R=(typeof EXAM_TEXT_SETS!=="undefined")?EXAM_TEXT_SETS:null;
    const list=R?(course?(R[course]||[]):Object.values(R).flat()):(typeof EXAM_TEXTS!=="undefined"?EXAM_TEXTS:[]);
    // + длинные тексты из диалогов курса (см. examDialogTexts) — у курса попытки
    const mods=(course&&typeof MODULE_META!=="undefined")?MODULE_META.filter(mm=>mm.course===course).map(mm=>mm.id):[];
    // кэш как у банка: диалоги статичны, итог зависит только от курса и субтеста
    this._dlg=this._dlg||{};
    const key=course+"|"+kind;
    if(!this._dlg[key])this._dlg[key]=(kind==="okuu"||kind==="uguu")
      ?examDialogTexts(typeof DIALOGS!=="undefined"?DIALOGS:{},mods,kind):[];
    const dlg=this._dlg[key];
    return list.concat(dlg).filter(x=>x.kind===kind&&(kind!=="uguu"||x.audio));
  },
  /* Готовность и лист выводятся из kind реестра, а не из перечней id: субтест
     того же рода в новом курсе — строка данных, ноль правок логики. */
  ready(id){
    const sp=this.spec.subtests.find(x=>x.id===id)||{};
    if(sp.kind==="mcq")return true;                              // банк курса есть всегда
    if(sp.kind==="read"||sp.kind==="listen")return this.texts(id).length>0;
    // письмо и речь проверяет преподаватель; лист есть, если в курсе нашлись вопросы и темы
    if(sp.kind==="write"||sp.kind==="speak")return this.itemsFor(sp,1).length>0;
    return false;
  },
  render(m){
    this.stopAudio();   // все ветки ниже (и интро, и чужая неделя) — новый экран: звук и запись прежнего гаснут
    const card=h("div",{class:"card"},h("div",{id:"exam-area"}));
    m.append(card);
    // на вкладке пробного экзамена живёт только сам экзамен: тренировка субтеста
    // продолжается на своём разделе, попытка ЧУЖОГО курса — на своей неделе
    const foreign=this.foreignRec();
    if(foreign)return this.foreign(foreign);
    if(this.st)return this.st.train?this.intro():this.step();
    if(ST.examRun&&!ST.examRun.train&&this.own(ST.examRun)&&this.resume())return this.step();
    this.intro();
  },
  /* На неделе ДРУГОГО курса идёт живая попытка или тренировка: интро с кнопкой
     «Начать» здесь перезаписало бы её без итога — только заглушка со ссылкой. */
  foreign(rec){
    rec=rec||this.foreignRec();
    const area=el("exam-area");if(!area||!rec)return;clear(area);
    const course=examRecCourse(rec),S=this.specOf(course);
    area.append(h("div",{class:"feedback",style:"display:block"},
      tf2("exam_foreign",{lvl:S.level||course})," ",
      h("a",{href:"#"+(rec.mod||"")+"/exam"},t("exam_foreign_go"))));
  },
  intro(){
    const area=el("exam-area");if(!area)return;clear(area);const S=this.spec;
    /* Стартовый экран отвечает на три вопроса за секунду: что это, сколько идёт,
       что будет дальше. Кнопка — первым делом, до всякой справки: экзамен начинают,
       а не изучают таблицу (претензия владельца 22.08.2026 — «где внятный старт»). */
    area.append(h("div",{class:"exam-hero"},
      h("div",{class:"bigword"},tf2("exam_hdr",{lvl:S.level||""})),
      // состав собирается из готовых субтестов: добавился субтест — строка
      // обновилась сама, и экран не врёт про объём
      h("p",{},t("exam_now")+" "+S.subtests.filter(x=>this.ready(x.id))
        .map(x=>{
          // объём — тем же счётом, что и на интро тренировки
          const fact=this.factCount(x);
          return bi3(x).toLowerCase()+" ("+tf2("exam_nm",{n:fact<x.tasks?fact+"/"+x.tasks:x.tasks,m:x.min})+")";
        }).join(", ")+"."),
      h("p",{},tf2("exam_pitch",{lvl:S.level||""})),
      h("button",{class:"btn big",onclick:()=>this.begin()},t("exam_start")),
      h("p",{class:"muted"},t("exam_warn")),
      // пометка о происхождении заданий — на интро и на итоге (решение владельца 30.10.2026)
      h("div",{class:"note"},t("exam_disclaimer"))));
    const rec=(ST.exam&&ST.exam.last)||null;
    if(rec&&this.own(rec))
      area.append(h("p",{class:"muted"},t("exam_last").replace("{p}",rec.pct).replace("{d}",rec.date)));
    // баллы за письмо и говорение приходят от преподавателя — ученик видит их здесь
    if(!IS_DEMO)fetch("api/exam/work").then(r=>r.ok?r.json():[]).then(list=>{
      // ответ мог прийти после старта экзамена: блок работ не дописывается в идущий лист
      if(!list.length||this.st)return;
      const box=h("div",{class:"feedback",style:"display:block"});
      for(const w of list.filter(w=>this.own(w)).slice(-6).reverse())
        box.append(h("p",{},h("b",{},bi3(this.spec.subtests.find(x=>x.id===w.kind)||{ky:w.kind})+": "),
          h("span",{class:"kgword"},w.topic),
          h("span",{class:"muted"}," — "+(w.score==null?t("exam_wk_pending")
            :t("exam_wk_score")+": "+w.score+(w.comment?" · "+w.comment:"")))));
      area.append(box);
    }).catch(()=>{});
    // формат, уровни и запись на государственное тестирование — только отсылкой
    area.append(h("p",{class:"muted"},t("exam_site")+" ",
      h("a",{href:EXAM_SITE,target:"_blank",rel:"noopener noreferrer"},EXAM_SITE.replace(/^https:\/\//,""))));
  },
  /* Токен попытки: растёт на каждом старте/возобновлении и на каждой смене
     субтеста. Любой отложенный отклик сверяет его перед тем, как двигать
     состояние: иначе ответ сервера, пришедший после истечения времени,
     листает УЖЕ ДРУГОЙ субтест (ревью 22.08) — а finish вне вкладки оставлял
     st живым, и попытка-зомби писала в ведомость вторую строку. */
  tokenOf(){return this.st?(this.st.run+":"+this.st.qi):null;},
  fresh(tok){return this.st&&this.tokenOf()===tok;},
  /* Одна дорожка «шагнуть дальше» для отложенных действий продуктивных субтестов:
     охрана токеном, отметка отправки, снятие черновика, снимок, перерисовка.
     В четырёх рукописных копиях пропуск snap() расходился бы молча. */
  advance(tok,sent,draftKey){
    if(!this.fresh(tok))return;
    if(sent)(this.st.sent=this.st.sent||{})[sent]=true;
    if(draftKey&&this.st.draft)delete this.st.draft[draftKey];
    this.st.i++;this.snap();this.step();
  },
  /* Тренировка навыка (правило владельца 22.08.2026): часть отрабатывается
     отдельно, но ТЕМ ЖЕ движком — очередь из одного элемента. Ученик видит тот же
     интерфейс и таймер, что в итоговой проверке; отличие одно — результат
     тренировки не идёт в историю попыток (ST.exam). */
  /* Живая попытка или тренировка ДРУГОГО курса не перезаписывается ни экзаменом,
     ни тренировкой: «Начать» на чужой неделе уничтожало её без итога. */
  train(subId){
    if(this.foreignRec())return false;
    const i=this.spec.subtests.findIndex(x=>x.id===subId);
    if(i<0||!this.ready(subId))return false;
    const seed=(Date.now()^(Math.random()*1e9))>>>0;
    this._run=(this._run||0)+1;
    this.st={queue:[i],qi:0,i:0,seed,answers:[],startedAt:Date.now(),items:[],deadline:0,
      run:this._run,train:true,course:this.course,mod:activeModule};
    this.loadSub();this.snap();
    evPush("exam.train",{mod:this.st.mod,sub:subId});
    this.tick();this.step();
    return true;
  },
  /* Интро тренировки: тот же разговор, что у проверки, — что это, сколько заданий
     и минут (числа из спецификации курса), и кнопка. */
  trainIntro(subId){
    const area=this.openArea();if(!area)return;
    const sp=this.spec.subtests.find(x=>x.id===subId);
    if(!sp)return void area.append(h("p",{class:"muted"},"—"));
    const ready=this.ready(subId);
    area.append(h("div",{class:"exam-hero"},
      h("div",{class:"bigword"},bi3(sp)),
      h("p",{},t("exam_tr_intro")),
      h("p",{class:"muted"},tf2("exam_nm",{n:this.factCount(sp),m:sp.min})),
      ready?h("button",{class:"btn big",onclick:()=>{if(this.train(subId))return;}},t("exam_tr_start"))
           :h("p",{class:"muted"},t("exam_st_soon")),
      h("p",{class:"muted"},t("exam_tr_note")),
      h("div",{class:"note"},t("exam_disclaimer"))));
  },
  begin(){
    if(this.foreignRec())return this.foreign();
    const S=this.spec;
    // проверка идёт по ВСЕМ готовым частям подряд, в порядке спецификации
    const queue=S.subtests.map((x,i)=>i).filter(i=>this.ready(S.subtests[i].id));
    const seed=(Date.now()^(Math.random()*1e9))>>>0;
    this._run=(this._run||0)+1;
    // mod — неделя, где попытка началась: события журнала помечаются ею и после
    // ухода на другую вкладку (истёкший таймер B1 писался как «экзамен на m11»)
    this.st={queue,qi:0,i:0,seed,answers:[],startedAt:Date.now(),items:[],deadline:0,run:this._run,
      course:this.course,mod:activeModule};
    this.loadSub();this.snap();
    evPush("exam.start",{mod:this.st.mod,subs:queue.length});
    this.tick();this.step();
  },
  /* Каждая часть — свой лист и свой таймер. */
  loadSub(){
    const st=this.st;
    /* Попытка владеет своим курсом: таймер субтеста истекает и на чужой вкладке
       (ученик с A1+B1 открыл неделю A1), и лист обязан собираться спекой, банком
       и текстами курса ПОПЫТКИ — по параметру, не переключая спеку вкладки. */
    const spec=this.subSpec();
    st.i=0;
    st.items=this.itemsFor(spec,st.seed,st.course);
    st.deadline=Date.now()+spec.min*60*1000;
    evPush("exam.sub",{mod:st.mod,sub:spec.id,n:st.items.length,limitMin:spec.min});
  },
  /* Единственное место, где субтест превращается в лист заданий: раньше
     формула жила дважды (loadSub и resume) и уже расходилась бы при правке.
     Банк лексики строится лениво — возобновлению на Окуу/Жазуу он не нужен. */
  /* Банк лексики курса — свойство движка с ленивым кэшем, а не поле попытки:
     он один на все попытки и тренировки, а спрашивают его и там, где попытки
     ещё нет (интро тренировки). */
  bank(course){
    course=course||this.course||"b1";   // стенды без курса живут на прежнем поведении
    this._banks=this._banks||{};
    if(!this._banks[course]){
      const mods=MODULE_META.filter(mm=>mm.course===course).map(mm=>mm.id);
      this._banks[course]=examBank(CONTENT,mods.filter(id=>CONTENT[id]),typeof DIALOGS!=="undefined"?DIALOGS:{});
    }
    return this._banks[course];
  },
  /* Сколько заданий реально соберётся — один ответ для интро проверки и интро
     тренировки. У Окуу/Угуу — сколько даст реестр текстов, у письма и речи — сколько
     листов собралось; у «Лексика. Грамматика» — число спецификации. */
  factCount(spec){return spec.kind==="mcq"?spec.tasks:this.itemsFor(spec,1).length;},
  // course — курс попытки: банк и тексты берутся его, а не открытой вкладки
  itemsFor(spec,seed,course){
    course=course||this.course;
    if(spec.kind==="mcq")return examItems(this.bank(course),spec.tasks,seed);
    if(spec.kind==="write"||spec.kind==="speak"){
      /* Письмо и речь: задание 1 — ответы на qPick вопросов курса (письменно или
         вслух), задание 2 — текст или рассказ на тему модуля курса, если в
         спецификации задан объём (minSent/maxSent, minSec/maxSec). Сид у речи
         сдвинут: лист письма и лист речи одной попытки не совпадают. */
      const sd=(seed+(spec.kind==="speak"?7:0))>>>0;
      const qs=examSeedPick(examQuestions(this.bank(course).lex),spec.qPick||0,sd);
      const out=[];
      if(qs.length)out.push({t:spec.kind,part:1,ref:spec.id+"1",qs:qs.map(x=>x.ky),qSrc:qs.map(x=>x.id)});
      if(spec.kind==="write"?spec.minSent:spec.minSec){
        const topic=this.topic(sd,course);
        if(topic)out.push({t:spec.kind,part:2,ref:spec.id+"2",topic});
      }
      return out;
    }
    return examTextItems(this.texts(spec.id,course),spec.tasks,seed);
  },
  /* Тема задания 2 — название модуля курса, который есть в варианте ученика. */
  topic(seed,course){
    course=course||this.course||"b1";   // как у bank(): стенды без курса живут на прежнем поведении
    const S=this.specOf(course)||{};
    const list=examTopics(typeof MODULE_META!=="undefined"?MODULE_META:[],course,S.topicSkip,
      (id)=>typeof CONTENT==="undefined"||!!CONTENT[id]);
    return examSeedPick(list,1,seed)[0]||null;
  },
  nextSub(byTime){
    const st=this.st;
    if(st.qi+1>=st.queue.length)return this.finish(!!byTime);
    st.qi++;
    if(byTime)st.notice="timeup";   // step покажет «время субтеста вышло» один раз
    this.loadSub();this.snap();this.tick();this.step();
  },
  tick(){
    clearInterval(this._timer);
    this._timer=setInterval(()=>{
      if(!this.st)return clearInterval(this._timer);
      const left=this.st.deadline-Date.now();
      const node=el("exam-clock");
      if(node)node.textContent=t("exam_left").replace("{t}",fmtClock(Math.max(0,left)));
      if(left<=0){clearInterval(this._timer);this.nextSub(true);}
    },1000);
  },
  /* Текст аудирования — дорожки его предложений подряд: пауза 350 мс между
     фразами, повторный клик начинает сначала. stopAudio зовётся из step/review —
     звук не переживает свой экран. */
  playLines(srcs){
    /* Через владельческий канал fgPlay, а не голым playAudio: renderTab зовёт
       fgStop() на смене вкладки, поэтому текст экзамена больше не читается
       поверх другого раздела и не играет одновременно с карточкой (ревью 22.08).
       fgPlay сам переходит по onended И onerror — битая дорожка не рвёт цепочку. */
    this.stopAudio();
    let i=0;const ch={dead:false};this._aud=ch;   // ch, не st: st в этом файле — состояние попытки
    const next=()=>{
      if(ch.dead)return;
      if(i>=srcs.length)return void this.stopAudio();
      const id=srcs[i++];
      fgPlay(id,{owner:"exam",onended:()=>{ch.t=setTimeout(next,350);},done:()=>{ch.dead=true;clearTimeout(ch.t);}});
    };
    next();
  },
  // преамбула каждого экрана: звук не переживает свой экран (ответил — озвучка молчит)
  // на чужой неделе экрана попытки нет — как на другой вкладке
  openArea(){this.stopAudio();if(this.st&&!this.own(this.st))return null;const area=el("exam-area");if(!area)return null;clear(area);return area;},
  stopAudio(){
    // запись Сүйлөө не переживает свой экран: «Пропустить», смена задания и субтеста
    // гасят микрофон и снимают холд самообновления (ревью 25.09.2026)
    if(this._recStop){const f=this._recStop;this._recStop=null;f();}
    const ch=this._aud;if(!ch)return;
    ch.dead=true;clearTimeout(ch.t);this._aud=null;
    fgStop();
  },
  // черновик пишется не на каждый символ, и только локально (см. snap)
  snapSoon(){clearTimeout(this._snapT);this._snapT=setTimeout(()=>this.snap(false),1200);},
  /* snap(false) — только localStorage (на каждый ответ и черновик: полный save()
     здесь гнал бы PUT+GET всего прогресса ~110 раз за попытку — ревью 22.08);
     snap() без аргумента — ещё и на сервер, на границах: begin, смена субтеста,
     отправка работы, finish. */
  snap(toServer){
    const st=this.st;if(!st)return;
    ST.examRun={queue:st.queue,qi:st.qi,i:st.i,seed:st.seed,answers:st.answers,train:!!st.train,
      course:st.course,mod:st.mod,   // чей экзамен и где начат
      deadline:st.deadline,startedAt:st.startedAt,sent:st.sent||{},draft:st.draft||{},plays:st.plays||{}};
    if(toServer===false)saveLocal();else save();
  },
  /* Возврат к прерванной попытке: листы пересобираются тем же сидом (лист
     попытки один), часы продолжают идти от сохранённого дедлайна. */
  resume(){
    const run=ST.examRun;if(!run||!Array.isArray(run.queue))return false;
    /* Протухшая попытка не поднимается: снимок старше суток или с давно истёкшим
       дедлайном раньше «продолжался» — первый тик выбрасывал ученика из субтеста,
       а следующему доставались свежие 25 минут (ревью 22.08). */
    if(this.stale(run)){delete ST.examRun;save();return false;}
    const course=examRecCourse(run);   // лист пересобирается спекой СВОЕГО курса
    this._run=(this._run||0)+1;
    this.st={queue:run.queue,qi:run.qi,i:run.i,seed:run.seed,train:!!run.train,course,mod:run.mod||activeModule,
      answers:run.answers||[],startedAt:run.startedAt||Date.now(),items:[],deadline:run.deadline,
      run:this._run,sent:run.sent||{},draft:run.draft||{},plays:run.plays||{}};
    this.st.items=this.itemsFor(this.subSpec(),this.st.seed,course);
    this.tick();
    return true;
  },
  answer(k,box,fb){
    if(!this.st)return;   // попытка закрыта (время вышло вне вкладки) — ответ уже некуда писать
    const it=this.st.items[this.st.i];
    const ok=k===it.c;
    this.st.answers.push({ref:it.ref,mod:it.mod,t:it.t,ok,sub:this.subSpec().id});
    evPush("exam.answer",{mod:this.st.mod,sub:this.subSpec().id,ref:it.ref,q:it.t,ok,i:this.st.i});
    this.st.i++;
    this.snap(false);   // локально: полный save() на каждый ответ — ~110 запросов за попытку
    this.review(it,ok,k,box,fb);
  },
  /* Разбор — НА МЕСТЕ, без смены экрана (замечание владельца 23.08.2026: вердикт
     на следующем экране стирал контекст, ошибку разбирали по памяти). Мировой
     паттерн тренажёров: вопрос и варианты остаются, выбранное краснеет, верное
     зеленеет, разбор выезжает ниже. Верный ответ листается сам через 700 мс
     (как в публичном квизе), над ошибкой таймера нет — темп задаёт ученик. */
  review(it,ok,picked,box,fb){
    this.stopAudio();   // ответил, не дослушав, — озвучка не читает дальше
    if(box&&typeof revealOpts==="function")revealOpts(box,it.c,ok?null:picked);
    const tok=this.tokenOf();
    if(ok){
      if(fb){clear(fb);fb.append(h("div",{class:"feedback ok"},t("exam_ok")));}
      setTimeout(()=>{if(this.fresh(tok))this.step();},700);
      return;
    }
    if(!fb)return;   // vm-прогоны без DOM: состояние уже записано, рисовать некуда
    clear(fb);
    fb.append(h("div",{class:"feedback"},t("exam_no")));
    if(it.explain){
      fb.append(h("p",{class:"kgword"},it.explain.ky));
      if(it.explain.ru)fb.append(h("p",{class:"muted"},it.explain.ru));
      if(it.explain.rule)fb.append(h("div",{class:"feedback"},it.explain.rule));
    }
    const meta=metaOf(it.mod);
    if(meta)fb.append(h("p",{class:"muted"},t("exam_from")+" "+meta.num+" "+metaTitle(meta)));
    const nb=h("button",{class:"btn",onclick:()=>{if(this.fresh(tok))this.step();}},t("exam_next"));
    fb.append(nb);
    if(nb.focus)nb.focus();   // Enter/Space листают дальше с клавиатуры
  },
  step(){
    if(!this.st)return this.intro();   // попытка закрылась, пока ученик читал разбор
    const area=this.openArea();if(!area)return;   // вкладку покинули или чужая неделя: рисовать некуда
    if(this.st.i>=this.st.items.length)return this.nextSub();
    const it=this.st.items[this.st.i];const spec=this.subSpec();
    if(this.st.notice==="timeup"){this.st.notice=null;area.append(h("div",{class:"feedback"},t("exam_timeup")));}
    area.append(h("div",{class:"exam-bar"},
      h("span",{class:"chip"},bi3(spec)),
      h("span",{class:"muted"},t("exam_q").replace("{n}",this.st.i+1).replace("{t}",this.st.items.length)),
      h("span",{class:"muted",id:"exam-clock"},t("exam_left").replace("{t}",fmtClock(Math.max(0,this.st.deadline-Date.now()))))));
    // у каждого типа своя формулировка задания: «выберите перевод» и «восстановите
    // порядок слов» — разные умения, и ученик должен понимать, что от него хотят
    if(it.t==="text"){
      // текст показывается над каждым вопросом: лист лежит перед глазами
      const box=h("div",{class:"card"},h("b",{},bi3(it.title)));
      if(it.audio==="lines"&&typeof fgPlay==="function"){
        /* Прослушиваний — ограниченное число (решение владельца
           22.08.2026): счётчик на ТЕКСТ, а не на вопрос — вопросы
           к одному тексту идут подряд, и «ещё раз» на каждом обесценивало бы лимит. */
        const plays=(this.st.plays=this.st.plays||{});
        const left=()=>EXAM_LISTEN_MAX-(plays[it.textId]||0);
        const lb=h("button",{class:"btn secondary"});
        const sync=()=>{lb.textContent=t("exam_listen")+" ("+left()+")";lb.disabled=left()<=0;};
        lb.addEventListener("click",()=>{
          if(left()<=0)return;
          plays[it.textId]=(plays[it.textId]||0)+1;this.snap();
          sync();
          this.playLines(it.srcs);
        });
        sync();
        box.append(lb,h("p",{class:"muted"},tf2("exam_uguu_hint",{n:EXAM_LISTEN_MAX})));
      }
      else it.lines.forEach(ln=>box.append(h("p",{class:"kgword"},ln)));
      area.append(box);
    }
    if(it.t==="write")return this.stepWrite(area,it,spec);
    if(it.t==="speak")return this.stepSpeak(area,it,spec);
    const ask=t("exam_ask_"+it.t);
    const body=it.t==="odd"?null
      :it.t==="def"?h("div",{class:"bigword"},it.q)
      :h("div",{class:"bigword kgword"},it.q);
    area.append(h("div",{},h("div",{class:"muted"},ask),body||h("span",{})));
    const fb=h("div",{});
    area.append(optList(it.opts,(k,_b,box)=>this.answer(k,box,fb)),fb);
  },
  /* Жазуу: задание 1 — письменные ответы на вопросы курса, задание 2 — текст на
     тему модуля курса объёмом из спецификации. Инструкции — на языке интерфейса:
     кыргызский на экране только из фраз курса. Самопроверка — наша памятка
     (I18N exam_w_chk), работа уходит преподавателю. */
  stepWrite(area,it,spec){
    if(it.qs){
      area.append(h("p",{style:"font-weight:700"},t("exam_w_qs")));
      const ol=h("ol",{});it.qs.forEach(q=>ol.append(h("li",{class:"kgword"},q)));
      area.append(ol);
    }else{
      area.append(h("p",{style:"font-weight:700"},t("exam_w_ask")),
        h("div",{class:"bigword"},bi3(it.topic||{})),
        h("p",{class:"muted"},tf2("exam_w_size",{a:spec.minSent,b:spec.maxSent})));
    }
    const chk=h("details",{},h("summary",{},t("exam_w_check")));
    for(const d of String(t("exam_w_chk")).split(" · "))chk.append(h("p",{class:"muted"},"— "+d));
    area.append(chk);
    /* Черновик живёт в состоянии попытки (st.draft) и едет в снимок: уход на
       другую вкладку, смена языка и F5 больше не стирают 20 минут письма —
       то же правило, что для карточек (v1.0.89). */
    const key=it.ref;
    const st0=this.st;st0.draft=st0.draft||{};
    const ta=h("textarea",{class:"exam-ta",rows:"10"});
    ta.value=st0.draft[key]||"";
    /* Считаются ответы — строки либо предложения (та же формула, что у сервера);
       подпись и предупреждение — по формату: у списка вопросов свои (без {a}–{b}). */
    const count=()=>examAnswers(ta.value);
    const cntText=()=>it.qs?tf2("exam_w_cnt_qs",{n:count(),q:it.qs.length}):tf2("exam_w_cnt",{n:count()});
    const cnt=h("p",{class:"muted"},cntText());
    ta.addEventListener("input",()=>{
      st0.draft[key]=ta.value;this.snapSoon();
      cnt.textContent=cntText();
    });
    const tok=this.tokenOf();
    const btn=h("button",{class:"btn",onclick:()=>{
      const n=count();
      // молчащей кнопки не бывает: слишком короткий текст объясняется, а не игнорируется
      if(n<3){cnt.textContent=it.qs?tf2("exam_w_short_qs",{n,q:it.qs.length})
        :tf2("exam_w_short",{a:spec.minSent,b:spec.maxSent,n});return;}
      btn.disabled=true;
      // у листа вопросов преподавателю едут САМИ вопросы отдельным полем qs
      // (тема режется сервером до 120 символов — вопросы туда не влезали);
      // course помечает работу её экзаменом
      examPost("api/exam/work",{kind:spec.id,course:this.st.course,
        topic:examWorkTopic(it),qs:it.qs,text:ta.value})
        .then(()=>{
          evPush("exam.submit",{mod:this.st.mod,sub:spec.id,sentences:n});
          // отклик мог прийти в другую попытку/субтест — advance сверяет токен
          this.advance(tok,spec.id,key);
        })
        .catch(e=>{btn.disabled=false;cnt.textContent=(e&&e.message)||t("exam_w_err");});
    }},t("exam_send"));
    area.append(ta,cnt,h("div",{class:"btnrow"},btn,
      h("button",{class:"btn ghost",onclick:()=>{this.advance(tok);}},t("exam_skip"))));
  },
  /* Сүйлөө: задание 1 — ответы вслух на вопросы курса одной записью, задание 2 —
     рассказ на тему модуля курса (minSec–maxSec). Запись уходит преподавателю;
     если у ученика включено распознавание — рядом едет транскрипция (STT-ядро). */
  stepSpeak(area,it,spec){
    if(it.qs){
      area.append(h("p",{style:"font-weight:700"},t("exam_s_qs")));
      const ol=h("ol",{});it.qs.forEach(q=>ol.append(h("li",{class:"kgword"},q)));
      area.append(ol);
    }else{
      area.append(h("p",{style:"font-weight:700"},t("exam_s_ask")),
        h("div",{class:"bigword"},bi3(it.topic||{})),
        h("p",{class:"muted"},tf2("exam_s_size",{a:spec.minSec,b:spec.maxSec})));
    }
    area.append(h("p",{class:"muted"},t("exam_s_hint")));
    const st8={rec:null,chunks:[],blob:null,t0:0,timer:null,done:false};
    const tok=this.tokenOf();
    const status=h("p",{class:"muted"},"");
    // причина отказа микрофона — общим разборщиком аудирования (PWA/нет устройства)
    const micFail=e=>{status.textContent=t(typeof sttPermKey==="function"
      ?sttPermKey(e,typeof matchMedia==="function"&&matchMedia("(display-mode: standalone)").matches):"stt_mic_err");};
    const play=h("button",{class:"btn ghost",style:"display:none"},t("stt_self"));
    const sendB=h("button",{class:"btn",style:"display:none"},t("exam_send"));
    const recB=h("button",{class:"btn"},t("stt_rec"));
    recB.addEventListener("click",()=>{
      if(st8.rec&&st8.rec.state==="recording"){st8.rec.stop();return;}
      // те же охраны, что в аудировании: без HTTPS/устройства кнопка не молчит, а объясняет
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder!=="function")
        return void(status.textContent=t("stt_mic_https"));
      // sttMic — общий с вкладкой аудирования выбор устройства (раньше тут стоял
      // typeof S — локальная переменная чужого рендера, всегда undefined)
      const cons=typeof sttConstraints==="function"?sttConstraints(typeof sttMic!=="undefined"?sttMic:null):{audio:true};
      navigator.mediaDevices.getUserMedia(cons).then(ms=>{
        // разрешение пришло, когда ученик уже ушёл с задания, — микрофон не включаем
        if(!this.fresh(tok)){ms.getTracks().forEach(x=>x.stop());return;}
        let rec;
        try{rec=new MediaRecorder(ms);}
        catch(e){ms.getTracks().forEach(x=>x.stop());micFail(e);return;}
        st8.chunks=[];st8.rec=rec;st8.t0=Date.now();
        rec.ondataavailable=e=>{if(e.data.size)st8.chunks.push(e.data);};
        rec.onstop=()=>{
          this._recStop=null;
          clearTimeout(st8.timer);st8.timer=null;
          ms.getTracks().forEach(x=>x.stop());
          updateHold("rec",false);
          if(st8.discard)return;   // ушли с экрана посреди записи — итог не рисуем
          st8.blob=new Blob(st8.chunks,{type:rec.mimeType||"audio/webm"});
          st8.sec=Math.round((Date.now()-st8.t0)/1000);
          status.textContent=tf2("exam_s_len",{s:st8.sec});
          recB.textContent=t("stt_again");play.style.display="";sendB.style.display="";
        };
        rec.start();recB.textContent=t("stt_stop");status.textContent=t("exam_s_rec");
        updateHold("rec",true);   // запись идёт — самообновление вкладки ждёт (===UPDATE===)
        // уход с экрана посреди записи: та же уборка в onstop, но запись выбрасывается
        this._recStop=()=>{st8.discard=true;try{rec.stop();}catch(e){rec.onstop();}};
        // рассказ не длиннее верхней границы; таймер снимается в onstop, иначе
        // старый автостоп обрывал следующую запись. У ответов на вопросы
        // границы нет — время держит таймер части
        clearTimeout(st8.timer);
        if(spec.maxSec&&!it.qs)st8.timer=setTimeout(()=>{if(st8.rec&&st8.rec.state==="recording")st8.rec.stop();},spec.maxSec*1000);
      }).catch(micFail);
    });
    play.addEventListener("click",()=>{if(st8.blob){const a=new Audio(URL.createObjectURL(st8.blob));a.play();}});
    sendB.addEventListener("click",()=>{
      if(!st8.blob||st8.done)return;                  // повторный клик не отправляет второй раз
      st8.done=true;sendB.disabled=true;status.textContent=t("exam_s_up");
      const ct=st8.blob.type||"audio/webm";
      /* Единая цепочка: транскрипция — необязательное плечо (STT может быть
         выключен или исчерпан), но отказ САМОЙ отправки работы обязан быть виден.
         Раньше внутренняя цепочка не возвращалась наружу: при 403 экран навсегда
         оставался «Отправляю…», а .catch(()=>fin("")) мог отправить работу дважды. */
      examPost("api/exam/voice",st8.blob,ct)
        // транскрипция — необязательное плечо (STT выключен/исчерпан → без неё),
        // сетевое ядро то же, что у карточек и вкладки аудирования (sttRecognize)
        .then(v=>(typeof sttRecognize==="function"?sttRecognize(st8.blob).catch(()=>null):Promise.resolve(null))
          .then(d=>examPost("api/exam/work",{kind:spec.id,course:this.st.course,
              topic:examWorkTopic(it),qs:it.qs,audio:v.file,
              transcript:(d&&d.text)||"",sec:st8.sec||0})
            .then(()=>{
              evPush("exam.submit",{mod:this.st.mod,sub:spec.id,sec:st8.sec||0,stt:!!(d&&d.text)});
              this.advance(tok,spec.id);})))
        .catch(e=>{st8.done=false;sendB.disabled=false;status.textContent=(e&&e.message)||t("exam_w_err");});
    });
    area.append(h("div",{class:"btnrow"},recB,play,sendB),status,
      h("button",{class:"btn ghost",onclick:()=>{
        this.advance(tok);}},t("exam_skip")));
  },
  finish(byTime){
    this.stopAudio();clearInterval(this._timer);
    // попытка закрывается ДО отрисовки: раньше ранний выход «нет области» оставлял
    // st живым, и вернувшийся ученик листал закрытую попытку, дописывая ответы
    const st=this.st;if(!st||st.done)return;st.done=true;this.st=null;
    const S=this.specOf(st.course);   // итог — спекой курса попытки, не открытой вкладки
    const sum=examSummary(st.answers);
    const {right,total,pct,byMod,bySub}=sum;
    const date=new Date().toISOString().slice(0,10);
    const subs=st.queue.map(i=>S.subtests[i].id);
    // тренировка одного субтеста НЕ идёт в историю попыток: там счёт всего экзамена,
    // и один субтест в этой строке выглядел бы сданным экзаменом
    if(!st.train){
      // курс — в записи истории: без него попытка A1 читалась бы «последним
      // результатом» на неделе B1 (ids субтестов у курсов общие)
      const course=st.course;
      ST.exam=ST.exam||{};
      ST.exam.last={subs,pct,right,total,date,byMod,course};
      ST.exam.attempts=(ST.exam.attempts||[]).concat([{subs,pct,right,total,date,course}]).slice(-20);
    }
    delete ST.examRun;   // попытка закрыта — снимок больше не поднимет её
    save();
    evPush(st.train?"exam.train_done":"exam.finish",{mod:st.mod,sub:subs[0],subs:subs.length,
      pct,right,total,byTime,sec:Math.round((Date.now()-st.startedAt)/1000)});
    // экран итога — только на неделе своего курса (на чужой он лёг бы поверх её интро)
    if(!this.own(st))return;
    const area=el("exam-area");if(!area)return;clear(area);   // экран не нужен: итог уже записан
    if(byTime)area.append(h("div",{class:"feedback"},t("exam_timeup")));
    area.append(h("div",{class:"bigword"},pct+"%"),
      h("p",{class:"muted"},t("exam_res").replace("{r}",right).replace("{t}",total)),
      // калибровка: процент — доля верных в заданиях с автопроверкой, не прогноз балла
      h("div",{class:"note"},t("exam_calib")),
      h("div",{class:"note"},t("exam_disclaimer")));
    // итог по каждой части
    if(Object.keys(bySub).length>1)
      area.append(harmonyTable([t("exam_c_sub"),t("exam_c_res")],
        Object.entries(bySub).map(([id,r])=>{
          const sp=S.subtests.find(x=>x.id===id)||{ky:id};
          return [bi3(sp),examPct(r.ok,r.n)+"% ("+r.ok+"/"+r.n+")"];
        })));
    const weak=Object.entries(byMod).map(([id,r])=>[id,examPct(r.ok,r.n),r.n])
      .filter(x=>x[1]<80).sort((x,y)=>x[1]-y[1]).slice(0,5);
    if(weak.length){
      area.append(h("h3",{},t("exam_weak")));
      area.append(harmonyTable([t("exam_c_mod"),t("exam_c_res")],
        weak.map(([id,p,n])=>[metaTitle(metaOf(id)),p+"% ("+n+")"])));
    }
    // продуктивные субтесты в итоге не молчат: отправлено — «у преподавателя»,
    // нет — честное «пропущено» (иначе 100% по машинным читалось как полный успех)
    const sent=st.sent||{};
    for(const sp of S.subtests.filter(x=>x.kind==="write"||x.kind==="speak")){
      if(!st.queue.some(i=>S.subtests[i].id===sp.id))continue;
      area.append(h("p",{class:"muted"},bi3(sp)+": "+t(sent[sp.id]?"exam_sent_note":"exam_skipped_note")));
    }
    area.append(st.train
      ? h("button",{class:"btn",onclick:()=>this.trainIntro(subs[0])},t("exam_tr_again"))
      : h("button",{class:"btn",onclick:()=>this.intro()},t("exam_again")));
  },
};
/* Тема работы для ведомости преподавателя: у листа вопросов — подпись задания
   (сами вопросы едут полем qs), у задания 2 — название модуля-темы по-русски:
   журнал преподавателя один на всех учеников, независимо от языка интерфейса. */
function examWorkTopic(it){return it.qs?t("exam_qs_topic"):String((it.topic||{}).ru||"");}
// та же формула, что на сервере (POST /api/exam/work) — менять только парой
function examSentences(text){return String(text).split(/[.!?]+/).map(x=>x.trim()).filter(Boolean).length;}
// ответы на вопросы пишут построчно и не всегда с точкой: ответ — строка либо предложение
function examAnswers(text){return Math.max(examSentences(text),String(text).split(/\n/).map(x=>x.trim()).filter(Boolean).length);}
/* Отказ сервера доносится текстом (конвенция putReview/putStudent): «текст слишком
   короткий» и «нет доступа» — разные действия ученика, а не общее «ошибка». */
function examPost(url,body,ct){
  return fetch(url,{method:"POST",headers:{"Content-Type":ct||"application/json"},body:ct?body:JSON.stringify(body)})
    .then(r=>r.json().catch(()=>({})).then(j=>{if(!r.ok)throw new Error(j.error||"HTTP "+r.status);return j;}));
}
function tf2(key,vals){return String(t(key)).replace(/\{(\w+)\}/g,(m,k)=>vals[k]!==undefined?vals[k]:m);}
function fmtClock(ms){const s=Math.floor(ms/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
// язык интерфейса берётся у приложения (currentLang), а не у выдуманной глобали:
// с LANG экран экзамена падал ReferenceError и вкладка не открывалась вовсе
function bi3(o){const l=currentLang();return l==="en"?(o.en||o.ky):l==="tr"?(o.tr||o.ky):(o.ru||o.ky);}
/* Вкладка тренажёра формата: идущая попытка (в том числе поднятая из снимка)
   рисуется как есть, иначе — интро своего субтеста. */
function renderExamTrain(m,subId){
  Exam.use(examCourseOf(activeModule));
  if(!Exam.spec)return m.append(h("div",{class:"card"},h("p",{class:"muted"},"—")));
  m.append(h("div",{class:"card"},h("div",{id:"exam-area"})));
  // идущая попытка продолжается только на СВОЁМ разделе: иначе вкладка «Угуу»
  // открывала незакрытую тренировку «Окуу» (поймано живым браузером 22.08.2026)
  if(Exam.st)return examTrainSubOf(Exam.st)===subId?Exam.step():Exam.trainIntro(subId);
  if(examTrainSubOf(ST.examRun)===subId&&Exam.resume())return Exam.step();
  Exam.trainIntro(subId);
}
/* Чья это тренировка: идущая попытка и снимок описываются одинаково (queue+train),
   поэтому вопрос один — какой субтест тренирует ЭТО состояние. Пустая строка
   значит «не тренировка» (итоговая проверка или ничего) — или тренировка
   ЧУЖОГО курса: неделя A1 не должна открывать тренировку B1. */
function examTrainSubOf(state){
  if(!state||!state.train||!Exam.own(state))return "";
  return (Exam.spec.subtests[(state.queue||[])[0]]||{}).id||"";
}
function renderExam(m){
  Exam.use(examCourseOf(activeModule));
  if(!Exam.spec)return m.append(h("div",{class:"card"},h("p",{class:"muted"},"—")));
  Exam.render(m);
}
/* ===/EXAM=== */
