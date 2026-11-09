/* ===CHAT=== Чистые функции инбокса — порядок тредов, подписи, счётчик, обрезка.
   Без DOM и без сети: их проверяет ui-generic.test исполнением на модельных данных.
   Порядок повторяет серверную сводку (непрочитанные сверху, внутри — свежие), но
   клиент не полагается на порядок ответа: список приходит и из фильтра, и из кэша. */
function chatSortThreads(list){
  return (list||[]).slice().sort((a,b)=>
    ((b.unread>0)-(a.unread>0))||(a.updatedAt<b.updatedAt?1:a.updatedAt>b.updatedAt?-1:0));
}
// Ученик узнаётся по логину; гость — по странице, с которой написал, и языку письма:
// это всё, что о нём известно, и этого хватает, чтобы отвечать на его языке.
function chatThreadTitle(tr,dict){
  if(tr.kind==="student")return tr.login||tr.id;
  return ((dict&&dict.visitor)||"")+" · "+(tr.firstPage||"/")+" · "+String(tr.lang||"ru").toUpperCase();
}
function chatUnreadTotal(list){return (list||[]).reduce((s,x)=>s+(x.unread||0),0);}
function chatPreview(text,n){
  const s=String(text||"").replace(/\s+/g," ").trim();
  return s.length>n?s.slice(0,n-1).replace(/\s+$/,"")+"…":s;
}
/* ===/CHAT=== */

/* ===INBOX=== Панель чата ученика и гостя демо + вкладка «Сообщения» преподавателя.
   Разметка и поведение — по образцу openRosterPanel: Esc, клик по фону, кнопка
   закрытия, возврат фокуса на открывшую кнопку. Опрос ответов — раз в минуту и
   ТОЛЬКО пока панель открыта: закрытая панель не должна дёргать сервер.
   Блок исполняется тестом на бутафорском DOM: «что отдали» и «что человек
   увидит» — разные вопросы, поэтому проверяется поведение, а не состав сборки. */
const CHAT_POLL_MS=60000;
// Форматы дат чата — в одном месте: «ЧЧ:ММ», «ДД.ММ», их пара и «5 сентября».
const CHAT_HM={hour:"2-digit",minute:"2-digit"};
const CHAT_DM={day:"2-digit",month:"2-digit"};
const CHAT_DMHM=Object.assign({},CHAT_DM,CHAT_HM);
const CHAT_DAY={day:"numeric",month:"long"};
// Одна обёртка на все даты чата: Intl спотыкается о битую метку, а пустая подпись
// у письма лучше, чем пустой экран.
function chatWhen(ts,method,opts){
  if(!ts)return "";
  try{return new Date(ts)[method](localeOf(),opts);}catch(e){return "";}
}
const chatHM=(ts)=>chatWhen(ts,"toLocaleTimeString",CHAT_HM);
const chatDM=(ts)=>chatWhen(ts,"toLocaleDateString",CHAT_DM);
const chatDMHM=(ts)=>chatWhen(ts,"toLocaleString",CHAT_DMHM);
// Один способ ходить к серверу чата: GET без кэша сразу с разбором JSON (не-200 —
// исключение, его ловит вызывающий), POST — телом-объектом.
const chatGet=(u)=>fetch(u,{cache:"no-store"})
  .then((r)=>{if(!r.ok)throw new Error("http "+r.status);return r.json();});
const chatPost=(u,body)=>fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body||{})});
// viewer — чья это панель: у ученика/гостя «Вы» = visitor, у преподавателя «Вы» = teacher,
// а письмо собеседника подписано его именем (логин ученика либо «Гость»)
function chatMsgRow(msg,viewer,otherName){
  const mine=viewer==="teacher"?msg.from==="teacher":msg.from!=="teacher";
  const who=mine?t("ch_you"):(viewer==="teacher"?(otherName||t("ib_visitor")):t("ch_teacher"));
  const when=viewer==="teacher"?chatHM(msg.ts):chatDMHM(msg.ts);   // у учителя дата — в разделителе ленты
  return h("div",{class:"chat-msg "+(mine?"me":"them")},
    h("span",{},String(msg.text||"")),
    h("span",{class:"chat-meta"},(viewer==="teacher"&&mine?"":who+" · ")+when));
}
// Лента панели: пусто — строка-заглушка, иначе письма подряд. Возвращает их число —
// по нему отправитель понимает, надо ли убрать заглушку перед первым письмом.
function chatFillList(list,msgs){
  clear(list);
  if(!msgs.length){list.append(h("p",{class:"muted"},t("ch_empty")));return 0;}
  for(const msg of msgs)list.append(chatMsgRow(msg));
  return msgs.length;
}
/* Каркас панели: подложка, диалог, шапка с крестиком, Esc, клик по фону и возврат
   фокуса. Наполнение собирает вызывающий — в готовом теле body. */
function chatPanelFrame(opener,onClose){
  const back=h("div",{class:"panel-back"});
  const panel=h("aside",{class:"panel",role:"dialog","aria-modal":"true","aria-label":t("ch_title")});
  const close=()=>{
    onClose();
    back.remove();panel.remove();document.removeEventListener("keydown",onKey);
    // Пока панель открыта, счётчик обнуляется и FAB перерисовывается — открывшая
    // кнопка к этому моменту уже не в документе, и фокус ушёл бы в начало страницы.
    const target=(opener&&opener.isConnected===false)?document.querySelector(".wa-fab"):opener;
    if(target&&target.focus)target.focus();
  };
  const onKey=(e)=>{if(e.key==="Escape")close();};
  document.addEventListener("keydown",onKey);
  back.addEventListener("click",close);
  const closeBtn=h("button",{class:"btn ghost",type:"button"},t("ch_close"));
  closeBtn.addEventListener("click",close);
  const body=h("div",{class:"panel-body"});
  panel.append(h("div",{class:"panel-head"},h("h2",{},icon("mail",16)," "+t("ch_title")),closeBtn),body);
  return {back,panel,body,closeBtn};
}
function openChatPanel(opener,opts){
  opts=opts||{};
  let timer=null;
  const fr=chatPanelFrame(opener,()=>{if(timer){clearInterval(timer);timer=null;}});   // закрыли — опрос прекращается
  const body=fr.body;
  const list=h("div",{class:"chat-list"});
  const status=h("p",{class:"muted",style:"margin:8px 0 0;font-size:.82rem"});
  body.append(h("p",{class:"muted",style:"margin:0 0 8px;font-size:.85rem"},t("ch_intro")),list);
  let hasMsgs=false;
  chatFillList(list,[]);
  const ta=h("textarea",{rows:"3",maxlength:"2000",placeholder:t("ch_ph"),
    style:"width:100%;box-sizing:border-box"});
  if(opts.prefill)ta.value=opts.prefill;
  body.append(ta);
  // Контакт спрашиваем только у гостя демо: у вошедшего ученика есть логин,
  // и лишнее поле в панели — просьба отдать то, что и так известно.
  let contactInp=null;
  if(typeof IS_DEMO!=="undefined"&&IS_DEMO){
    contactInp=h("input",{type:"text",maxlength:"120",placeholder:t("ch_contact_ph"),
      style:"width:100%;box-sizing:border-box;margin-top:6px"});
    body.append(contactInp);
  }
  const sendBtn=h("button",{class:"btn",type:"button"},t("ch_send"));
  const waLink=h("a",{class:"btn ghost",href:waHref(),target:"_blank",rel:"noopener noreferrer"},t("ch_wa"));
  waLink.addEventListener("click",()=>{try{evPush("wa.click",{from:"chat"});}catch(e){}});
  body.append(h("div",{class:"rev-controls",style:"margin-top:10px"},sendBtn,waLink),status);
  const load=()=>chatGet("api/chat").then((d)=>{
    hasMsgs=chatFillList(list,(d&&d.thread&&d.thread.messages)||[])>0;
    CHAT.unread=0;mountWaFab();   // открытая панель = прочитано
    // «прочитано» — только после удачного показа, и при каждом опросе: ответ, пришедший
    // в открытую панель, иначе остался бы непрочитанным на сервере и вернул бы бейдж
    try{chatPost("api/chat/seen");}catch(e){}
    return true;
  }).catch(()=>false);
  sendBtn.addEventListener("click",async()=>{
    const text=String(ta.value||"").trim();
    if(!text)return;
    sendBtn.disabled=true;status.textContent="";
    try{
      const payload={text,lang:currentLang(),page:location.pathname};
      if(contactInp&&contactInp.value.trim())payload.contact=contactInp.value.trim();
      const r=await chatPost("api/chat",payload);
      if(!r.ok)throw new Error("http "+r.status);
      const d=await r.json().catch(()=>({}));
      ta.value="";
      if(!hasMsgs){clear(list);hasMsgs=true;}   // «пока пусто» уступает место первому письму
      list.append(chatMsgRow({ts:(d.msg&&d.msg.ts)||new Date().toISOString(),from:"visitor",text}));
      status.textContent=t("ch_sent_note");
      try{evPush("chat.send",{from:activeTab});}catch(e){}
    }catch(e){status.textContent=t("ch_err");}
    sendBtn.disabled=false;
  });
  document.body.append(fr.back,fr.panel);
  fr.closeBtn.focus();
  // «прочитано» — только когда письма реально показаны: сбой загрузки не должен гасить
  // бейдж ответа (та же логика, что у треда преподавателя ниже)
  load();
  timer=setInterval(load,CHAT_POLL_MS);
}
// Счётчик непрочитанного: у преподавателя приезжает в /api/me, у ученика и гостя —
// отдельным запросом (тред опознаётся кукой или логином, тела не нужно).
async function chatBadgeSync(){
  if(typeof isTeacher==="function"&&isTeacher()){
    CHAT.unread=(ME&&ME.chat&&ME.chat.unread)||0;mountWaFab();renderSidebar();return;
  }
  if(typeof location==="undefined"||!/^https?:$/.test(location.protocol))return;
  try{const d=await chatGet("api/chat");CHAT.unread=(d&&d.unread)||0;mountWaFab();}catch(e){}
}
async function chatUnreadRefresh(){
  try{const d=await chatGet("api/chat/unread");CHAT.unread=(d&&d.threads)||0;renderSidebar();}catch(e){}
}

/* ---------- Вкладка «Сообщения» (преподаватель) ----------
   Список тредов и один тред. Опроса тут нет намеренно: преподаватель обновляет
   счётчик действием (открыл тред, ответил), а фоновый таймер в панели учителя
   переписывал бы экран под руками. */
let inboxFilter="unread";
let inboxThread=null;
function inboxDict(){return {visitor:t("ib_visitor")};}
// Время в списке — как в мессенджерах: сегодня «ЧЧ:ММ», иначе «ДД.ММ»
function inboxTime(ts){
  if(!ts)return "";
  return new Date(ts).toDateString()===new Date().toDateString()?chatHM(ts):chatDM(ts);
}
const inboxDay=(ts)=>chatWhen(ts,"toLocaleDateString",CHAT_DAY);
// Строка списка: аватар, имя, время, начало последнего письма и счётчик непрочитанного
function inboxRow(tr){
  const name=chatThreadTitle(tr,inboxDict());
  const row=h("button",{class:"panel-row ib-row"+(tr.unread?" ib-unread":""),type:"button"},
    h("span",{class:"ib-avatar"+(tr.kind==="student"?" ib-avatar-s":"")},(tr.kind==="student"?(tr.login||"?"):name).slice(0,1).toUpperCase()),
    h("span",{class:"ib-row-body"},
      h("span",{class:"ib-row-top"},h("b",{},name),h("span",{class:"ib-time"},inboxTime(tr.updatedAt))),
      h("span",{class:"ib-row-sub"},
        (tr.last&&tr.last.from==="teacher")?h("span",{class:"ib-you"},t("ch_you")+": "):null,
        chatPreview(tr.last?tr.last.text:"",90))),
    tr.unread?h("span",{class:"ib-badge"},String(tr.unread)):null);
  row.addEventListener("click",()=>{inboxThread=tr.id;renderTab();});
  return row;
}
function renderInbox(m){
  if(!isTeacher()){m.append(h("div",{class:"card"},h("p",{class:"muted"},t("ib_none"))));return;}
  if(inboxThread)return renderInboxThread(m,inboxThread);
  const card=h("div",{class:"card ib-card"});
  const title=h("h2",{class:"ib-title"},icon("mail")," "+t("ib_hdr"));
  const top=h("div",{class:"ib-top"},title,
    chipRow([{val:"unread",label:t("ib_unread")},{val:"all",label:t("ib_all")}],
      inboxFilter,(v)=>{inboxFilter=v;renderTab();}));
  const box=h("div",{class:"ib-rows"});
  card.append(top,box);
  m.append(card);
  chatGet("api/chat/threads?state="+inboxFilter)
    .then((list)=>{
      clear(box);
      const rows=chatSortThreads(Array.isArray(list)?list:[]);
      // ждущие ответа — числом у заголовка: тредов может быть много, писем в них — больше
      const waiting=chatUnreadTotal(rows);
      if(waiting)title.append(h("span",{class:"chip ok ib-count"},String(waiting)));
      if(!rows.length){box.append(h("p",{class:"muted ib-empty"},t("ib_none")));return;}
      for(const tr of rows)box.append(inboxRow(tr));
    })
    .catch(()=>{clear(box);box.append(h("p",{class:"muted"},t("ch_err")));});
}
// Шапка треда: назад · имя · страница и контакт · карточка ученика
function inboxThreadHead(tr,isStu){
  const backBtn=h("button",{class:"ib-back",type:"button","aria-label":t("ib_back"),title:t("ib_back")},icon("back",20));
  backBtn.addEventListener("click",()=>{inboxThread=null;renderTab();});
  const sub=[t("ib_page")+": "+(tr.firstPage||"/")].concat(tr.contact?[tr.contact]:[]).join(" · ");
  const head=h("div",{class:"ib-head"},backBtn,
    h("div",{class:"ib-head-t"},h("b",{},chatThreadTitle(tr,inboxDict())),h("small",{},sub)));
  if(isStu){
    const open=h("button",{class:"btn ghost ib-roster",type:"button"},t("rst_open"));
    open.addEventListener("click",()=>openRoster(tr.login));
    head.append(open);
  }
  return head;
}
// Лента треда с разделителями дат
function inboxThreadList(tr,isStu){
  const list=h("div",{class:"chat-list ib-msgs"});
  let day="";
  for(const msg of tr.messages||[]){
    const d=msg.ts?new Date(msg.ts).toDateString():"";
    if(d&&d!==day){day=d;list.append(h("div",{class:"chat-day"},inboxDay(msg.ts)));}
    list.append(chatMsgRow(msg,"teacher",isStu?tr.login:null));
  }
  if(!(tr.messages||[]).length)list.append(h("p",{class:"muted ib-empty"},t("ch_empty")));
  return list;
}
// Композер приклеен снизу: поле растёт с текстом, Ctrl/Cmd+Enter отправляет.
// reload — перерисовка треда после удачного ответа (ошибки ловит сама).
function inboxComposer(tr,status,reload){
  const ta=h("textarea",{rows:"1",maxlength:"2000",placeholder:t("ib_reply_ph"),"aria-label":t("ib_reply_ph")});
  const grow=()=>{if(!ta.style)return;ta.style.height="auto";ta.style.height=Math.min(160,ta.scrollHeight||42)+"px";};
  ta.addEventListener("input",grow);
  const btn=h("button",{class:"ib-send",type:"button","aria-label":t("ib_reply"),title:t("ib_reply")},icon("send",20));
  const send=async()=>{
    const text=String(ta.value||"").trim();
    if(!text){ta.focus();return;}
    btn.disabled=true;status.textContent="";
    try{
      const r=await chatPost("api/chat/threads/"+encodeURIComponent(tr.id)+"/reply",{text});
      if(!r.ok)throw new Error("http "+r.status);
      ta.value="";grow();
      try{evPush("chat.reply",{to:tr.login||tr.id});}catch(e){}
      // перерисовка треда пересобирает композер — курсор возвращаем в новое поле
      const p=reload();chatUnreadRefresh();
      if(p&&p.then)p.then(()=>{try{const nt=document.querySelector(".ib-composer textarea");if(nt)nt.focus();}catch(e){}});
    }catch(e){status.textContent=t("ch_err");}
    btn.disabled=false;
  };
  btn.addEventListener("click",send);
  ta.addEventListener("keydown",(e)=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))send();});
  return h("div",{class:"ib-composer"},ta,btn);
}
function renderInboxThread(m,id){
  const card=h("div",{class:"card ib-thread"});
  m.append(card);
  const draw=(tr)=>{
    clear(card);
    const isStu=tr.kind==="student"&&tr.login;
    const list=inboxThreadList(tr,isStu);
    const status=h("p",{class:"muted ib-status","aria-live":"polite"});
    card.append(inboxThreadHead(tr,isStu),list,inboxComposer(tr,status,load),status);
    // свежее — внизу, как в мессенджере
    try{const last=list.lastElementChild;if(last&&last.scrollIntoView)last.scrollIntoView({block:"nearest"});}catch(e){}
  };
  // load() сам сообщает, удался ли он: помечать тред прочитанным и обнулять
  // счётчик, не сумев его показать, — значит потерять письмо из виду
  const load=()=>chatGet("api/chat/threads/"+encodeURIComponent(id))
    .then((tr)=>{draw(tr);return true;})
    .catch(()=>{clear(card);card.append(h("p",{class:"muted"},t("ch_err")));return false;});
  load().then((ok)=>ok&&chatPost("api/chat/threads/"+encodeURIComponent(id)+"/seen")
    .then(()=>chatUnreadRefresh()));
}
/* ===/INBOX=== */
