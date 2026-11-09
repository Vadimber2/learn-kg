/* ---------- Карточки ---------- */
// фабрика чипов тем — общая для карточек и дриллов; правка стиля/поведения — здесь
function topicChip(label,active,pick){
  const b=h("button",{class:"chip mpchip "+(active?"acc":"")},label);
  b.addEventListener("click",()=>{pick();renderTab();});
  return b;
}
/* ===CARDSPOOL=== */
// Пул сессии: тема, «на запоминание» (__marked) или весь модуль.
// Звёздочки — личный список ученика поверх модулей (ставятся и на reuse-словах чужих
// модулей), поэтому колода «на запоминание» собирается по всему контенту, а не по
// активному VOCAB: иначе кнопка обещала «17», а в колоде оказывалось три слова.
// Слово доступно для занятий, если оно входит в словарь хотя бы одного открытого
// модуля тропы. Проверять родной модуль нельзя: слово A1, переиспользованное в модуле
// A2, живёт в бакете m1–m9, и ученик, у которого выдан только A2, законно его учит.
// Обратное тоже важно: звёздочка, поставленная до отъёма курса, материал не открывает.
let STUDYABLE={key:null,ids:null};
function studyableIds(){
  const open=CONTENT_READY.filter(studyOpen);
  const key=open.join(",");
  if(STUDYABLE.key!==key){
    const ids=new Set();
    for(const mid of open)for(const id of vocabIdsOf(mid))ids.add(id);
    STUDYABLE={key,ids};
  }
  return STUDYABLE.ids;
}
function studyableCard(c){return !!c&&studyableIds().has(c.id);}
function markedCards(){
  const ok=studyableIds(); // один раз на колоду, а не на каждую звёздочку
  return notSkipped((ST.marked||[]).map(cardById).filter(c=>!!c&&ok.has(c.id)));
}
function cardsPool(){
  if(cardsTopic==="__marked")return markedCards();
  return notSkipped(cardsTopic?VOCAB.filter(c=>c.cat===cardsTopic):VOCAB);
}
/* ===/CARDSPOOL=== */
function cardsTopicName(){return cardsTopic==="__marked"?t("cards_marked"):cardsTopic?catName(cardsTopic):t("cards_mix");}
function renderCardTopics(){ // живые счётчики тем — перерисовываются после каждого ответа
  const box=el("cards-topics");if(!box)return;clear(box);
  const mkChip=(key,label)=>topicChip(label,cardsTopic===key,()=>{cardsTopic=key;});
  const mix=mkChip(null,t("cards_mix"));mix.prepend(icon("shuffle",13)," ");box.append(mix," ");
  const marked=markedCards(); // тем же выражением, что и колода: счётчик не должен обещать больше, чем даст
  if(marked.length||cardsTopic==="__marked"){
    const doneM=marked.filter(c=>!isNew(c.id)).length;
    const chip=mkChip("__marked",t("cards_marked")+" "+doneM+"/"+marked.length);
    chip.prepend(icon("star",13)," ");box.append(chip," ");
  }
  // один проход по словарю на все темы: чипы перерисовываются после каждого ответа
  const byCat=new Map();
  for(const c of notSkipped(VOCAB)){
    let e=byCat.get(c.cat);
    if(!e)byCat.set(c.cat,e={n:0,done:0});
    e.n++;if(!isNew(c.id))e.done++;
  }
  for(const k of Object.keys(CATS)){
    const {n,done}=byCat.get(k)||{n:0,done:0};
    const full=done===n&&n>0;
    const chip=mkChip(k,(full?"✓ ":"")+catName(k)+" "+done+"/"+n);
    if(full&&cardsTopic!==k)chip.classList.add("ok");
    box.append(chip," ");
  }
  // тема меняется и мимо чипов (фокус-клик из панелей) — свёрнутая строка не врёт
  const tg=el("cards-help-tgl");
  if(tg&&!(ST.settings&&ST.settings.cardsHelp))tg.textContent="▸ "+t("cards_help_tgl")+" · "+cardsTopicName();
}
// Правила карточек и выбор темы — за разворотом (просьба владельца: блок нужен
// новичку один раз, дальше съедал пол-экрана). Свёрнуто по умолчанию; строка
// сворота называет скрытое и текущую тему, выбор живёт в ST.settings.cardsHelp
// между сессиями. Прогресс-бар и счётчик — статус, остаются видимыми всегда.
function renderCardsShell(m){
  const help=h("div",{id:"cards-help"},
    h("div",{class:"muted"},t("cards_instruction")),
    h("div",{class:"muted",style:"margin-top:8px"},t("cards_topic")),
    h("div",{id:"cards-topics",style:"margin:10px 0 4px"}));
  const tgl=h("button",{class:"btn ghost",id:"cards-help-tgl",style:"padding:2px 8px;margin:2px 0 6px"});
  const sync=()=>{
    const open=!!(ST.settings&&ST.settings.cardsHelp);
    help.style.display=open?"":"none";
    tgl.textContent=open?"▾ "+t("cards_help_tgl"):"▸ "+t("cards_help_tgl")+" · "+cardsTopicName();
  };
  tgl.addEventListener("click",()=>{
    ST.settings=ST.settings||{};
    ST.settings.cardsHelp=!ST.settings.cardsHelp;
    try{save();}catch(e){}
    sync();
  });
  sync();
  m.append(h("div",{class:"card"},
    h("h2",{},t("cards_hdr")),
    tgl,help,
    h("div",{class:"progressbar"},h("div",{id:"cards-progress",style:"width:0%"})),
    h("div",{class:"muted",id:"cards-counter"}),
    h("div",{id:"cards-area",style:"margin-top:12px"})));
}
/* ===B1=== Механика B1 (решение владельца, 18.08.2026): формулировки заданий —
   на кыргызском (поле qKy у дрилла), новые слова вводятся кыргызской дефиницией
   (поле def у карточки) через выученное; перевод — по клику. Незнакомое слово
   дефиниции (≤20% массы — гейт tests/b1.test.js) разбирается по клику через
   глоссарий модуля (реестр DEF_GLOSS в данных). Чистые функции — vm-тестируются. */
// разбивка дефиниции на куски: у токена из глоссария появляется ссылка на глосс
function b1DefTokens(def,glossMap){
  return String(def).split(/(\s+)/).map(part=>{
    const w=part.toLowerCase().replace(/ё/g,"е").replace(/[^а-яеөүң\-]/gi,"");
    return {s:part,w,g:(glossMap&&w&&Object.prototype.hasOwnProperty.call(glossMap,w))?glossMap[w]:null};
  });
}
// глосс по языку интерфейса: tr → en → ru (тот же порядок, что bi())
function b1GlossText(g,lang){return (lang==="tr"&&g.tr)||(lang!=="ru"&&g.en)||g.ru;}
// дефиниция как подсказка ввода годится только короткой цели: у предложения
// дефиниция — комментарий, а не смысл, там подсказкой остаётся перевод
function b1CanDefPrompt(ky){const w=String(ky).trim();return !/[.?!]/.test(w)&&w.split(/\s+/).length<=3;}
// маскировка основы ответа в дефиниции — иначе она выдаёт слово («Мекеменин бир
// бөлүгү…» для «бөлүм»). Маскируется точное слово цели и его словоформы (основа
// без двух последних букв, разница длин ≤3) — «талап кылган» у «талапчыл» не задет
function b1MaskDef(def,ky){
  const words=String(ky).toLowerCase().replace(/[^а-яеёөүң\- ]/gi," ").split(/\s+/).filter(w=>w.length>=3);
  if(!words.length)return String(def);
  const hit=(w)=>words.some(t=>{
    if(w===t)return true;
    if(t.length<5)return false; // короткую цель ловим только точным совпадением
    const base=t.slice(0,-(t.length>=7?2:1)); // основа: длинные слова теряют два суффиксальных знака
    return w.startsWith(base)&&Math.abs(w.length-t.length)<=3;
  });
  return String(def).split(/(\s+)/).map(p=>{
    const w=p.toLowerCase().replace(/[^а-яеёөүң\-]/gi,"");
    return (w&&hit(w))?"…":p;
  }).join("");
}
// дефиниция как подсказка ввода: короткая цель + после маски остаётся читаемый
// текст (≥3 значимых слов), иначе подсказкой честно остаётся перевод
function b1PromptDef(def,ky){
  if(!b1CanDefPrompt(ky))return null;
  const masked=b1MaskDef(def,ky);
  const left=masked.toLowerCase().replace(/[^а-яеёөүң\- ]/gi," ").split(/\s+/).filter(w=>w.length>=3).length;
  return left>=3?masked:null;
}
/* ===/B1=== */
// дефиниция с кликабельными незнакомыми словами; глоссарий — реестр DEF_GLOSS[модуль]
function b1DefNode(c,defText){
  defText=defText||c.def;
  if(!defText)return null;
  const gm=(typeof DEF_GLOSS!=="undefined"&&DEF_GLOSS[homeOf(c.id)])||null;
  const line=h("div",{class:"ky",style:"font-size:1.02rem"});
  const info=h("div",{class:"muted",style:"font-size:.8rem;min-height:1em"});
  for(const tk of b1DefTokens(defText,gm)){
    if(tk.g)line.append(h("span",{class:"b1-gw",onclick:()=>{
      info.textContent=tk.w+" — "+b1GlossText(tk.g,currentLang());
      try{evPush("b1.gloss",{mod:homeOf(c.id),w:tk.w});}catch(e){} // трекинг: какие слова дефиниций незнакомы
    }},tk.s));
    else line.append(tk.s);
  }
  return h("div",{class:"b1-def"},line,info);
}
// подсказка ввода для карточки с дефиницией: сперва понимаем по-кыргызски,
// перевод — по клику (билингвализованный подход, Laufer & Hadar 1997)
function b1Prompt(c,maskedDef){
  const tr=h("div",{class:"muted b1-tr"},"🌐 "+t("b1_show_tr"));
  tr.addEventListener("click",()=>{
    tr.replaceWith(h("div",{class:"bigword"},gloss(c)));
    try{evPush("b1.tr",{mod:homeOf(c.id),kind:"card",cardId:c.id});}catch(e){} // трекинг: понял ли без перевода
  });
  return h("div",{},b1DefNode(c,maskedDef),tr);
}
// формулировка дрилла: B1 — по-кыргызски (qKy), перевод по клику; иначе как раньше
function drillQNode(it){
  if(!it.qKy)return h("div",{class:"bigword"},drillQ(it));
  const tr=h("div",{class:"muted b1-tr"},"🌐 "+t("b1_show_tr"));
  tr.addEventListener("click",()=>{
    tr.replaceWith(h("div",{class:"muted"},drillQ(it)));
    try{evPush("b1.tr",{mod:activeModule,kind:"drill"});}catch(e){}
  });
  return h("div",{},h("div",{class:"bigword"},it.qKy),tr);
}
/* ===CARDSQ=== */
// Сборка очереди — чистые функции без DOM и глобалов: движок карточек иначе
// проверяется только грепом по исходнику. deps: {stateOf, skipped, mastered, now, shuffle}.
function queuePhase(st){return st&&st.box>0?"type":"rec";} // бокс 0 (новое или сбитое ошибкой) — сначала узнавание
function buildFocusQueue(ids,cardOf,deps){
  const out=[];
  for(const id of ids){ // порядок сохраняем: первым идёт то, по чему кликнули
    const c=cardOf(id);
    if(!c||deps.skipped(id))continue;
    out.push({c,phase:queuePhase(deps.stateOf(id))});
  }
  return out;
}
function buildSessionQueue(pool,deps){
  // повторения — сразу ввод; новые — узнавание, затем ввод в ЭТОЙ ЖЕ сессии (short-loop);
  // grade() зовётся один раз — по результату ввода
  const due=[],fresh=[];
  for(const c of pool){
    if(deps.skipped(c.id))continue;
    const st=deps.stateOf(c.id);
    if(!st)fresh.push({c,phase:"rec"});
    else if(st.due<=deps.now)due.push({c,phase:queuePhase(st)});
  }
  const items=deps.shuffle(due).concat(deps.shuffle(fresh).slice(0,12));
  if(items.length)return {items,practice:false};
  // На сегодня всё отлежало: даём материал для практики честной меткой — боксы в ней
  // не растут (grade сам не поднимет уровень раньше срока), интервалы не сокращаются.
  const rest=deps.shuffle(pool.filter(c=>!deps.skipped(c.id)&&!deps.mastered(c.id))).slice(0,12);
  return {items:rest.map(c=>({c,phase:queuePhase(deps.stateOf(c.id))})),practice:true};
}
/* ===/CARDSQ=== */
// Фокус-колода: панели дашборда кладут сюда id слов («в работе», ошибки попытки) —
// следующая сессия карточек собирается из них, а не из общей очереди. Одноразово.
let FOCUS_POOL=null;
function cardsDeps(){return {stateOf:recOf,skipped:isSkipped,mastered:isMastered,now:Date.now(),shuffle};}
const Cards={
  queue:[],cur:null,gen:0,practice:false, // {c, phase}; gen инвалидирует отложенные таймеры при смене сессии/вкладки
  key:null, // модуль+тема, для которых собрана очередь: уход с вкладки сессию не сбрасывает
  start(){
    this.gen++;
    if(!el("cards-area"))return; // оболочка ещё не отрисована — фокус-колоду не потребляем
    // Возврат на вкладку продолжает начатую сессию с ТОЙ ЖЕ карточки: заглянуть в диалоги
    // или прогресс — не повод терять место и получать новую перетасованную очередь.
    // Свежая сессия — только по явному поводу: клик из панели (FOCUS_POOL), смена
    // модуля или темы, конец прежней очереди.
    if(!FOCUS_POOL&&this.cur&&this.key===activeModule+"|"+(cardsTopic||"")){
      this.updateBar();
      const area=clear(el("cards-area"));
      if(this.practice)area.append(h("p",{class:"muted",style:"margin:0 0 8px"},t("cards_practice_note")));
      if(this.cur.phase==="rec")this.renderRecognition(area,this.cur.c);
      else this.renderTyping(area,this.cur.c);
      return;
    }
    const deps=cardsDeps();
    if(Array.isArray(FOCUS_POOL)&&FOCUS_POOL.length){
      const want=FOCUS_POOL;FOCUS_POOL=null;
      cardsTopic=null; // клик по слову — явное намерение: липкая тема (в т.ч. «__marked») его не фильтрует
      const focus=buildFocusQueue(want,(id)=>{const c=cardById(id);return studyableCard(c)?c:null;},deps); // индекс по всему контенту, не по пулу темы
      if(focus.length){
        this.queue=focus;this.practice=false;this.key=activeModule+"|"+(cardsTopic||"");
        evPush("cards.start",{mod:activeModule,topic:"focus",queue:this.queue.length});
        this.next();return;
      }
    }
    const ses=buildSessionQueue(cardsPool(),deps);
    this.queue=ses.items;this.practice=ses.practice;this.key=activeModule+"|"+(cardsTopic||"");
    // практика — отдельный факт, а не подмена темы: иначе в отчёте теряется, по какой теме шла сессия
    evPush("cards.start",{mod:activeModule,topic:cardsTopic||"",queue:ses.items.length,practice:ses.practice});
    this.next();
  },
  // Шапка карточки одинакова в обоих режимах: чип переиспользования, кнопки звука,
  // звёздочка и решения о слове. Автоозвучка — здесь же, под общим гардом апрува.
  cardHead(c,mode){
    const head=h("div",{class:"muted"},`${catName(c.cat)} · ${mode} `);
    if(c.reuse)head.append(h("span",{class:"chip"},tf("reuse_chip",{m:metaOf(homeOf(c.id)).num}))," ");
    const ab=cardAudioBtns(c.id);
    if(ab)head.append(ab);
    this.autoPlay(c.id);
    head.append(" ",starBtn(c.id)," ",knowSkipBtns(c.id,(msg)=>this.decided(c.id,msg)));
    return head;
  },
  // Автоозвучка карточки — только по включённой настройке и только апрувнутое,
  // через канал fgPlay: renderTab глушит его при уходе с вкладки, а gen-гард не даёт
  // прозвучать фразе карточки, которую ученик уже пролистал.
  autoPlay(id){
    if(!(autoplayOn()&&audioApproved(id)))return;
    const g=this.gen;
    setTimeout(()=>{if(g===Cards.gen&&el("cards-area"))fgPlay(id,{owner:"cards-auto"});},200);
  },
  // «Уже знаю» / «Отложить»: слово уходит из очереди целиком (в т.ч. из отложенных
  // повторов внутри сессии), показывается подтверждение и сессия идёт дальше.
  decided(id,msg){
    this.queue=this.queue.filter(q=>q.c.id!==id);
    const area=el("cards-area");
    if(area)clear(area).append(h("div",{class:"feedback ok"},msg));
    renderCardTopics();
    const g=this.gen;setTimeout(()=>{if(g===Cards.gen)this.next();},700);
  },
  next(){
    if(!el("cards-area"))return; // ушли с вкладки — таймер ничего не рисует
    if(fgOwner()==="cards-auto")fgStop(); // звук прошлой карточки не переживает переход
    this.updateBar();
    const area=clear(el("cards-area"));
    if(!this.queue.length){
      const pool=cardsPool();
      const seen=pool.filter(c=>!isNew(c.id)).length,masteredN=pool.filter(c=>isMastered(c.id)).length;
      evPush("cards.end",{mod:activeModule,seen,ok:masteredN});
      const pfx=cardsTopic?cardsTopicName()+": ":"";
      area.append(
        h("div",{class:"feedback ok"},pfx+tf("session_done",{d:seen,m:masteredN,t:pool.length})),
        h("button",{class:"btn",onclick:()=>this.start()},t("more_cards")));
      if(IS_DEMO)area.append(h("p",{class:"muted",style:"margin-top:10px"},t("demo_end")),demoWaBtn());
      this.cur=null;return;
    }
    // Практика — честной пометкой: ученик должен понимать, почему уровни слов стоят на месте
    if(this.practice)area.append(h("p",{class:"muted",style:"margin:0 0 8px"},t("cards_practice_note")));
    this.cur=this.queue.shift();
    this.draft=null; // следующая карточка начинает с чистого поля
    evPush("card.show",{mod:homeOf(this.cur.c.id),cardId:this.cur.c.id,phase:this.cur.phase,box0:cardState(this.cur.c.id).box});
    if(this.cur.phase==="rec")this.renderRecognition(area,this.cur.c);
    else this.renderTyping(area,this.cur.c);
  },
  renderRecognition(area,c){
    const shownAt=performance.now();
    const head=this.cardHead(c,t("mode_rec"));
    const fb=h("div",{});
    const options=shuffle([gloss(c),...pickDistractors(c,3)]);
    const correct=options.indexOf(gloss(c));
    let erred=false; // была ли ошибка на этой карточке
    const opts=optList(options,(i,b,box)=>{
      if(i!==correct){ // неверно: не листаем — поясняем, чей это перевод, и даём выбрать снова
        erred=true;
        evPush("card.answer",{mod:homeOf(c.id),cardId:c.id,phase:"rec",ok:false,ms:Math.round(performance.now()-shownAt)});
        b.disabled=true;b.classList.add("wrong");
        const owner=VOCAB.find(v=>gloss(v)===options[i]);
        const msg=h("div",{class:"feedback err"},t("rec_wrong"));
        if(owner)msg.append(" "+tf("rec_hint",{o:options[i]}),h("span",{class:"kgword"},owner.ky));
        clear(fb).append(msg);
        return;
      }
      evPush("card.answer",{mod:homeOf(c.id),cardId:c.id,phase:"rec",ok:true,ms:Math.round(performance.now()-shownAt)});
      revealOpts(box,correct);
      clear(fb);
      // узнавание НЕ оценивается (grade — только на вводе): чисто → шаг «ввод» в этой же сессии, после ошибки — ещё раз «узнавание»
      this.queue.push({c,phase:erred?"rec":"type"});
      const g=Cards.gen;setTimeout(()=>{if(g===Cards.gen)this.next();},700);
    });
    // скоринг произношения: слово видно и озвучено — можно повторить за диктором;
    // виджет внизу карточки, чтобы результат не сдвигал варианты ответа
    const mic=sttCardBtn(c);
    area.append(head,h("div",{class:"bigword kgword"},c.ky),...(c.def?[b1DefNode(c,b1MaskDef(c.def,c.ky))]:[]),opts,fb,...(mic?[mic]:[]));
  },
  renderTyping(area,c){
    const input=answerInput(()=>submit());
    // Черновик ввода переживает уход с вкладки: возврат перерисовывает карточку заново,
    // и без этого недописанный ответ пропадал. Привязан к id — чужой карточке не достанется.
    if(this.draft&&this.draft.id===c.id)input.value=this.draft.value;
    input.addEventListener("input",()=>{this.draft={id:c.id,value:input.value};});
    const fb=h("div",{});
    const shownAt=performance.now();let tries=0;
    const kbd0=EV.kbd||0; // сколько раз за эту карточку нажали экранную ө/ү/ң
    let revealed=false,revealTimer=null,gradedWrong=false,answered=false; // оценка — по первой попытке; после подсказки ввод не оценивается
    const submit=()=>{
      if(answered)return; // верный ответ уже принят — ждём следующую карточку
      clearInterval(revealTimer);
      const ok=checkAnswer(c,input.value);
      tries++;
      const ms=Math.round(performance.now()-shownAt);
      const kbd=(EV.kbd||0)-kbd0;
      if(revealed){
        // попытка после подсказки не оценивается (grade уже поставлен один раз при показе ответа),
        // но для разбора занятия учителю важно видеть и её — тоже в журнал, с пометкой hint
        evPush("card.answer",{mod:homeOf(c.id),cardId:c.id,phase:"type",ok,ms,in:input.value,try:tries,hint:true,kbd});
        if(ok){
          answered=true;
          clear(fb).append(h("div",{class:"feedback ok"},"Туура! ✓")); // повтор уже поставлен при подсказке
          const g=Cards.gen;setTimeout(()=>{if(g===Cards.gen)this.next();},700);
        }else{
          clear(fb).append(h("div",{class:"feedback err"},t("fb_wrong"),h("span",{class:"kgword"},c.ky)));
          input.focus();
        }
        return;
      }
      if(ok){
        answered=true;
        const box0=cardState(c.id).box;
        if(!gradedWrong)grade(c.id,true); // чистый успех с первой попытки
        evPush("card.answer",{mod:homeOf(c.id),cardId:c.id,phase:"type",ok:true,ms,in:input.value,try:tries,box0,box1:cardState(c.id).box,kbd});
        clear(fb).append(h("div",{class:"feedback ok"},"Туура! ✓ ",h("span",{class:"kgword"},c.ky)));
        this.autoPlay(c.id); // «как это звучит» после верного ввода — тоже автоозвучка, под тем же тумблером
        const g=Cards.gen;setTimeout(()=>{if(g===Cards.gen)this.next();},800);
      }else{
        const box0=cardState(c.id).box;
        if(!gradedWrong){ // первая ошибка: фиксируем результат и ставим повтор позже в сессии
          gradedWrong=true;grade(c.id,false);this.queue.push({c,phase:"type"});
        }
        evPush("card.answer",{mod:homeOf(c.id),cardId:c.id,phase:"type",ok:false,ms,in:input.value,try:tries,box0,box1:cardState(c.id).box,kbd});
        clear(fb).append(h("div",{class:"feedback err"},t("fb_try")));
        input.focus();input.select(); // остаёмся на карточке — исправляй
      }
    };
    const typeHead=this.cardHead(c,t("mode_type"));
    area.append(
      typeHead,
      (()=>{const dp=c.def?b1PromptDef(c.def,c.ky):null;return dp?b1Prompt(c,dp):h("div",{class:"bigword"},gloss(c));})(),
      input,kbdFor(input),
      h("div",{style:"display:flex;gap:8px;margin-top:6px"},
        h("button",{class:"btn",onclick:submit},t("btn_check")),
        h("button",{class:"btn secondary",onclick:()=>{
          if(!revealed){
            revealed=true;
            evPush("card.reveal",{mod:homeOf(c.id),cardId:c.id,ms:Math.round(performance.now()-shownAt)});
            if(!gradedWrong){gradedWrong=true;grade(c.id,false);this.queue.push({c,phase:"type"});}
          } // неуспех (ошибка или подсказка) фиксируется один раз, повтор уже в очереди
          clearInterval(revealTimer);
          let left=15;
          const cnt=h("b",{},String(left));
          clear(fb).append(h("div",{class:"feedback err"},t("fb_reveal_1"),h("span",{class:"kgword"},c.ky),t("fb_hide_1"),cnt,t("fb_hide_2")));
          input.value="";this.draft=null;
          revealTimer=setInterval(()=>{
            left--;cnt.textContent=String(left);
            if(left<=0){clearInterval(revealTimer);clear(fb);input.focus();}
          },1000);
        }},t("btn_show"))),
      fb);
    input.focus();
  },
  updateBar(){
    renderCardTopics();
    if(!el("cards-progress")||!el("cards-counter"))return;
    const pool=cardsPool();
    let done=0,mast=0;
    for(const c of pool){if(!isNew(c.id))done++;if(isMastered(c.id))mast++;}
    const pct=Math.round(progressScoreFor(pool)*100);
    const label=cardsTopicName();
    el("cards-progress").style.width=pct+"%";
    el("cards-counter").textContent=`${label}: ${t("lbl_progress")} ${pct}% · ${t("lbl_done1")} ${done}/${pool.length} · ${t("lbl_mastered")} ${mast} · ${t("lbl_queue")}: ${this.queue.length+(this.cur?1:0)}`;
  }
};

/* ---------- Сингармонизм ---------- */
function renderDrillTopics(){ // чипы групп дрилла — как темы в карточках
  const box=el("harmony-topics");if(!box)return;clear(box);
  const mkChip=(key,label)=>topicChip(label,drillTopic===key,()=>{drillTopic=key;});
  const mix=mkChip(null,t("cards_mix"));mix.prepend(icon("shuffle",13)," ");box.append(mix," ");
  for(const k of Object.keys(drillGroupsOf())){
    const n=DRILL.filter(d=>d.g===k).length;
    box.append(mkChip(k,drillGroupName(k)+" · "+n)," ");
  }
}
function renderHarmonyShell(m){
  const c=CONTENT[activeModule]||{};
  m.append(h("div",{class:"card"},
    h("h2",{},L("Дрилл: ","Drill: ","Alıştırma: ")+bi(c,"drillLabel")),
    h("div",{class:"harmony-legend"},h("span",{class:"soft"},bi(c,"drillHint")||"")),
    h("div",{class:"muted",style:"margin-top:8px"},t("drill_topic")),
    h("div",{id:"harmony-topics",style:"margin:10px 0 4px"}),
    h("div",{class:"muted",id:"harmony-counter"}),
    h("div",{id:"harmony-area",style:"margin-top:10px"})));
}
function drillQ(it){const l=currentLang();return (l==="tr"&&it.qTr)||(l!=="ru"&&it.qEn)||it.q;}
function drillNote(it){const l=currentLang();return (l==="tr"&&it.noteTr)||(l!=="ru"&&it.noteEn)||it.note;}
function drillW(it){const l=currentLang();return (l==="tr"&&it.wTr)||(l!=="ru"&&it.wEn)||it.w;}
const Harmony={
  items:[],i:0,score:0,
  start(){
    renderDrillTopics();
    const pool=drillTopic?DRILL.filter(d=>d.g===drillTopic):DRILL; // группа блоком или вперемешку
    this.items=shuffle(pool).slice(0,10);this.i=0;this.score=0;
    evPush("drill.start",{mod:activeModule,topic:drillTopic||"",n:this.items.length});
    this.next();
  },
  next(){
    const len=this.items.length,goal=Math.ceil(len*0.8); // серия короче 10, если группа маленькая; цель — 80%
    el("harmony-counter").textContent=`${t("drill_task")} ${Math.min(this.i+1,len)}/${len} · ${t("drill_correct")}: ${this.score}`;
    const area=clear(el("harmony-area"));
    if(this.i>=len){
      const ok=this.score>=goal;
      evPush("drill.end",{mod:activeModule,score:this.score,total:len});
      area.append(
        h("div",{class:"feedback "+(ok?"ok":"err")},`${this.score}/${len}. ${ok?tf("drill_goal_ok",{g:goal}):tf("drill_goal_no",{g:goal,t:len})}`),
        h("button",{class:"btn",onclick:()=>this.start()},t("drill_again")));
      return;
    }
    const it=this.items[this.i],note=h("div",{}),qShownAt=performance.now();
    const head=h("div",{class:"muted"},drillGroupName(it.g));
    const rule=h("div",{class:"note"},h("b",{},t("drill_rule")+" "),drillGroupRule(it.g));
    const finish=(ok,noteText,pick)=>{
      evPush("drill.answer",{mod:activeModule,g:it.g,ok,ms:Math.round(performance.now()-qShownAt),pick});
      if(ok)this.score++;
      if(noteText)clear(note).append(h("div",{class:"note"},noteText));
      this.i++;setTimeout(()=>this.next(),noteText?1900:900);
    };
    if(it.type==="row"){
      const correct=it.soft?1:0;
      const opts=optList([t("q_hard"),t("q_soft")],(i,b,box)=>{
        revealOpts(box,correct,i);
        finish(i===correct,i===correct?null:`«${drillW(it)}» — ${it.soft?t("q_soft_s"):t("q_hard_s")}.`,i);
      });
      area.append(head,h("div",{class:"bigword kgword"},drillW(it)),h("div",{class:"muted"},t("test_row")),rule,opts,note);
    }else{
      const opts=optList(it.opts,(i,b,box)=>{
        revealOpts(box,it.c,i);
        finish(i===it.c,drillNote(it),i);
      });
      area.append(head,drillQNode(it),rule,opts,note);
    }
  }
};

/* ---------- Мини-тест: 8 узнавание + 6 ввод + 6 сингармонизм ---------- */
function renderTestShell(m){
  m.append(h("div",{class:"card"},h("h2",{},t("tab_test")+" · "+metaOf(activeModule).num+" "+metaTitle(metaOf(activeModule))),h("div",{id:"test-area"})));
}
const Test={
  items:[],i:0,score:0,wrong:[],
  renderIntro(){
    const area=clear(el("test-area"));
    const tst=mod().test;
    const p=h("p",{class:"muted"},t(IS_DEMO?"demo_test_intro":"test_intro"));
    if(tst&&tst.lastAttempt)p.append(tf("test_last",{s:tst.lastAttempt.score,t:tst.lastAttempt.total||20,p:tst.lastAttempt.passed?t("test_passed_w"):t("test_failed_w"),d:tst.lastAttempt.date}));
    if(tst&&tst.everPassed)p.append(h("span",{class:"chip ok",style:"margin-left:6px"},t("test_chip_passed")),
      h("span",{class:"muted"},t("test_retake_note")));
    if(!IS_DEMO&&!quizReady(VOCAB,REVIEW)){ // демо-набор курируется из вычитанного — гейт вычитки не о нём
      const lockMsg=h("div",{class:"feedback"},icon("lock",14)," ",tf("test_locked_review",{d:reviewedCount(),t:quizGateBase(VOCAB).length,n:QUIZ_MIN_REVIEWED}));
      if(isTeacher()){ // преподаватель может прогнать превью по вычитанной части
        area.append(p,lockMsg,h("button",{class:"btn",onclick:()=>this.start()},t("test_start_preview")));
      }else area.append(p,lockMsg);
      return;
    }
    area.append(p,h("button",{class:"btn",onclick:()=>this.start()},t("test_start")));
  },
  start(){
    let qp=IS_DEMO?VOCAB:quizPool(VOCAB,REVIEW); // в демо REVIEW пуст, пул — весь демо-набор
    if(qp.length<14&&isTeacher())qp=VOCAB; // превью преподавателя при недовычитанном модуле
    const [nm,nt,nd]=IS_DEMO?[4,3,3]:[8,6,6]; // демо-тест укорочен: 10 заданий
    const mcq=shuffle(qp).slice(0,nm).map(c=>({type:"mcq",card:c}));
    const learned=shuffle(qp.filter(c=>!isNew(c.id)));
    const typ=(learned.length>=nt?learned:shuffle(qp)).slice(0,nt).map(c=>({type:"type",card:c}));
    const dr=shuffle(DRILL).slice(0,nd);
    this.items=shuffle([...mcq,...typ,...dr]);this.i=0;this.score=0;this.wrong=[];this.right=[];
    this._startedAt=performance.now();
    evPush("test.start",{mod:activeModule});
    this.next();
  },
  // единая точка на все 4 типа вопросов — сюда же вешаем журнал ответа
  answer(ok,ref,extra){
    const it=this.items[this.i];
    evPush("test.answer",Object.assign({mod:activeModule,q:it&&it.type,ref,ok,
      ms:Math.round(performance.now()-(this._qAt||performance.now())),i:this.i,kbd:(EV.kbd||0)-(this._kbd0||0)},extra));
    if(ok){this.score++;this.right.push(ref);}else this.wrong.push(ref);this.i++;this.next();
  },
  next(){
    const area=clear(el("test-area"));
    this._qAt=performance.now();this._kbd0=EV.kbd||0;
    if(this.i>=this.items.length)return this.finish(area);
    const it=this.items[this.i];
    area.append(h("div",{class:"muted"},`${t("test_q")} ${this.i+1}/${this.items.length}`));
    if(it.type==="mcq"){
      const options=shuffle([gloss(it.card),...pickDistractors(it.card,3)]);
      const opts=optList(options,(i)=>this.answer(options[i]===gloss(it.card),it.card.id));
      area.append(h("div",{class:"muted"},t("test_what")),h("div",{class:"bigword kgword"},it.card.ky),opts);
    }else if(it.type==="type"){
      const input=answerInput(()=>submit());
      const submit=()=>this.answer(checkAnswer(it.card,input.value),it.card.id,{in:input.value});
      area.append(h("div",{class:"muted"},t("test_write")),h("div",{class:"bigword"},gloss(it.card)),
        input,kbdFor(input),h("button",{class:"btn",onclick:submit},t("test_answer")));
      input.focus();
    }else if(it.type==="row"){
      const opts=optList([t("q_hard_s"),t("q_soft_s")],(i)=>this.answer(i===(it.soft?1:0),"h_row"));
      area.append(h("div",{class:"muted"},t("test_row")),h("div",{class:"bigword kgword"},drillW(it)),opts);
    }else{
      const opts=optList(it.opts,(i)=>this.answer(i===it.c,"h_affix"));
      area.append(h("div",{class:"muted"},t("test_harm")),drillQNode(it),opts);
    }
  },
  finish(area){
    const total=this.items.length,th=Math.ceil(total*0.8),passed=this.score>=th,date=new Date().toISOString().slice(0,10);
    // НЕ называть эту переменную `t` — она живёт до конца функции и затеняет глобальную t(),
    // а строки ниже (test_res_pass и т.п.) вызывают именно t(...): с именем `t` здесь падало
    // TypeError "t is not a function", и экран результата теста не отрисовывался вовсе —
    // прогресс при этом уже сохранён (mod().test=…;save() выше), терялся только сам экран.
    const rec=mod().test||{everPassed:false,lastAttempt:null,consecutiveFails:0,attempts:[]};
    const firstPass=passed&&!rec.everPassed;
    rec.lastAttempt={score:this.score,total,passed,date,wrong:this.wrong};
    rec.attempts=(rec.attempts||[]).concat([{score:this.score,date,wrong:this.wrong.slice(0,12)}]).slice(-20);
    if(passed){rec.everPassed=true;rec.consecutiveFails=0;}
    else rec.consecutiveFails=(rec.consecutiveFails||0)+1;
    mod().test=rec;save();
    evPush("test.finish",{mod:activeModule,score:this.score,passed,wrong:this.wrong,right:this.right,
      ms:Math.round(performance.now()-(this._startedAt||performance.now()))});
    if(firstPass){ // обновить замки тропы
      setTimeout(()=>{fetchMe().then(()=>{renderModulesPath();});},1200);
    }
    const t2=mod().test;
    const fb=h("div",{class:"feedback "+(passed?"ok":"err")},
      h("b",{},`${this.score}/${total} — ${passed?t("test_res_pass"):tf("test_res_fail",{th,t:total})}`),
      passed?((firstPass&&!IS_DEMO)?tf("test_first_pass",{num:metaOf(activeModule).num}):t("test_retake")) // в демо тропа не открывается — не обещаем
      :(t2.consecutiveFails>=2?t("test_fail2"):t("test_fail1")),
      SYNC.enabled&&SYNC.status!=="ok"?h("div",{class:"note"},t("test_local")):null);
    if(IS_DEMO){ // в демо вместо «скопировать наставнику» — путь к полному курсу
      area.append(fb,h("p",{class:"muted",style:"margin-top:10px"},t("demo_end")),demoWaBtn(),
        h("button",{class:"btn ghost",style:"margin-left:8px",onclick:()=>this.renderIntro()},t("btn_close")));
      return;
    }
    // Результат уходит преподавателю сам (test.finish в журнале) — копипаста не нужна;
    // ученик сразу видит слабые места здесь и на «Моём прогрессе».
    area.append(fb);
    if(this.wrong.length){
      const weak=h("div",{style:"margin-top:10px"},h("h3",{},t("test_weak_hdr")));
      for(const wid of this.wrong.slice(0,10))weak.append(h("span",{class:"chip",style:"margin:2px 4px 2px 0"},weakLabel(wid))," ");
      area.append(weak);
    }
    area.append(
      h("p",{class:"muted",style:"margin-top:10px"},t("test_sent_note")),
      h("button",{class:"btn ghost",onclick:()=>this.renderIntro()},t("btn_close")));
  }
};

/* ---------- Футер / сброс / запуск ---------- */
function updateFooter(){ // панель статуса в сайдбаре
  const bs=el("brand-sub");if(bs)bs.textContent=t("brand_sub");
  // Бренд ведёт на витрину текущего языка (не на «/»: он для вошедшего — само приложение)
  const bh=el("brand-home");if(bh)bh.href="/"+currentLang();
  document.title=t("app_title");
  el("f-cards").textContent=`${Math.round(progressScore()*100)}% (${t("lbl_mastered")} ${masteredCount()}/${VOCAB.length})`;
  const tst=mod().test;
  el("f-test").textContent=(tst&&tst.lastAttempt)?`${metaOf(activeModule).num}: ${tst.lastAttempt.score}/${tst.lastAttempt.total||20} (${tst.everPassed?t("test_passed_w"):t("test_failed_w")})`:metaOf(activeModule).num+": —";
  const sync=clear(el("f-sync"));
  if(!SYNC.enabled)sync.append(t(typeof IS_DEMO!=="undefined"&&IS_DEMO?"sync_demo":"sync_local")); // в демо честное имя режима (просьба владельца)
  else if(SYNC.status==="ok")sync.append(icon("cloud",14)," "+t("sync_ok"));
  else if(SYNC.status==="err")sync.append(icon("warn",14)," "+t("sync_err"));
  else sync.append("…");
  const u=clear(el("s-user"));
  u.append(icon("user",14)," ",SYNC.enabled?(ME?ME.login+(isAdmin()?" · "+t("role_admin"):isTeacher()?" · "+t("role_teacher"):""):"…"):t(typeof IS_DEMO!=="undefined"&&IS_DEMO?"sync_demo":"sync_local"));
  // Версию подставляет сервер при отдаче m0.html; в режиме file:// остаётся плейсхолдер — не показываем
  if(!APP_VER.startsWith("__"))u.append(h("span",{class:"muted",style:"margin-left:6px"},"v"+APP_VER));
}
el("burger").addEventListener("click",()=>el("layout").classList.toggle("side-open"));
// Тап вне открытого мобильного сайдбара (по бэкдропу/контенту) закрывает его; Esc — тоже
document.addEventListener("click",(e)=>{
  const lay=el("layout");
  if(!lay.classList.contains("side-open"))return;
  if(e.target.closest("aside")||e.target.closest("#burger"))return;
  lay.classList.remove("side-open");
});
document.addEventListener("keydown",(e)=>{if(e.key!=="Escape")return;el("layout").classList.remove("side-open");closeSidePanel();});
// PWA: офлайн-оболочка (sw.js кэширует последний ответ сервера с X-App-Shell)
if(SYNC.enabled&&"serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
applyTheme();applyLang();
const wantRepeat=parseRoute(); // до загрузки данных — чтобы review/audio тянулись для нужного модуля
(async()=>{
  // при #repeat модуль сменится почти наверняка — review/audio для него тянем один раз ПОСЛЕ выбора
  const base=[fetchMe().then(pullState)];   // pull только после профиля: pullState сверяет владельца копии с ME.login
  if(!wantRepeat)base.push(fetchReviewData(),fetchAudioList());
  await Promise.all(base);
  applyTheme();applyLang(); // язык мог приехать с сервера вместе с профилем
  // валидация восстановленного маршрута после получения роли и статусов
  let modChanged=wantRepeat;
  if(ME&&ME.role==="student"&&!studyOpen(activeModule)&&moduleStatusOf(activeModule)!=="locked_by_teacher"){
    // Откат — на первый модуль тропы, а не жёстко на М0: ученику без курса A1 (сдал его
    // вне тренажёра) М0 не выдан, и приложение открывалось бы заглушкой «курс закрыт».
    activeModule=startModule();activeTab="overview";modChanged=true;
  }
  if(!isTeacher()&&["review","students","metodika","roster","inbox"].includes(activeTab))activeTab="overview";
  if(wantRepeat){ // шорткат «Повторить»: модуль с самой длинной очередью, вкладка карточек
    const p=duePlan();
    if(p.best)activeModule=p.best;
    activeTab="cards";
  }
  if(modChanged){applyModuleContent();await Promise.all([fetchReviewData(),fetchAudioList()]);}
  renderModulesPath();renderNav();renderTab();updateFooter();updateBanner();saveRoute();
  updateDaymeter();
  const bootWait=document.getElementById("boot-wait");if(bootWait)bootWait.remove();
  setTimeout(()=>checkAppVersion(true),3000);   // оболочка из кэша воркера в окно деплоя — обновиться самим
  // PWA уже открыта: тап по шорткату меняет хэш без перезагрузки — ловим и доводим
  addEventListener("hashchange",()=>{
    if(location.hash==="#repeat"){
      history.replaceState(null,"",location.pathname+location.search);
      const p=duePlan();
      if(p.best)setModule(p.best);
      go("cards");
    }
  });
  // Срез окружения на старте сессии: язык, вьюпорт, touch — по нему видно, у кого
  // тренажёр живёт на телефоне и не связаны ли с этим неудобства (клавиатура, ширина).
  evPush("session.start",{lang:currentLang(),w:innerWidth,h:innerHeight,mob:matchMedia("(pointer:coarse)").matches});
  evPush("ui.nav",{tab:routeToken()}); // с какого экрана началась сессия (прямая ссылка / восстановленный маршрут)
})();
</script>
</body>
</html>
