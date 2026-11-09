function metaOf(id){return MODULE_META.find(m=>m.id===id)||{id,num:id,title:""};}
// Курсы: подписи уровней и выборки. Список курсов ученика приходит с сервера (/api/me);
// без сервера (демо, file://) — только a1: заголовки будущих курсов не должны светиться в демо.
const COURSE_LABELS={a1:"A1",a2:"A2",b1:"B1",b2:"B2"};
/* ===TRAIL=== */
// Тропа ученика: какие курсы у него есть, какие модули открыты для занятий и с какого
// начинать. Один набор правил на весь интерфейс — сайдбар, маршрут, гейт учебных вкладок
// и переходы из панелей спрашивают отсюда, а не выводят доступ каждый по-своему.
function courseOf(id){return metaOf(id).course||"a1";}
// экзаменационная неделя (реестр EXAM_MODS): у неё своё меню, свой «Обзор» и нет
// полосы вычитки. Один предикат на все три места — иначе выражение жило копиями
function isExamWeek(id){return (typeof EXAM_MODS!=="undefined"?EXAM_MODS:[]).indexOf(id)>=0;}
// реестр спецификаций экзаменов по курсам (data/exam-<курс>.js) — один аксессор,
// иначе typeof-выражение жило бы копиями; живёт рядом с isExamWeek, в срезе тропы
function examSpecs(){return (typeof EXAM_SPECS!=="undefined")?EXAM_SPECS:{};}
function courseModules(cid){return MODULE_META.filter(mm=>mm.course===cid);}
function knownCourses(){return [...new Set(MODULE_META.map(mm=>mm.course))];}
// Курсы готового контента этой сборки. Это НЕ права (в CONTENT_READY входят и модули
// отнятого курса ради результатов) — только последний довод для тропы без профиля.
// В демо это ровно a1 — заголовки платных курсов не светятся.
function readyCourses(){return [...new Set(CONTENT_READY.map(courseOf))];}
function myCourses(){
  if(ME&&ME.role&&ME.role!=="student")return knownCourses(); // преподавателю — весь каталог
  const fromMe=ME&&Array.isArray(ME.courses)?ME.courses:null;
  // Без ME (офлайн, момент до ответа /api/me) — последний известный список курсов,
  // и лишь затем содержимое сборки: жёсткий откат на «a1» оставлял ученика A2 без тропы.
  const c=(fromMe||(Array.isArray(ST.courses)?ST.courses:null)||readyCourses()).filter(x=>knownCourses().includes(x));
  return c.length?c:readyCourses();
}
function moduleStatusOf(id){
  if(isTeacher())return "open";
  // локальный режим: открыт только М0; в демо — модуль демо (DEMO_MOD, параметр сервера)
  if(!ME||!Array.isArray(ME.modules))return id===(typeof DEMO_MOD!=="undefined"?DEMO_MOD:"m0")?"open":"locked";
  const m=ME.modules.find(x=>x.id===id);
  return m?m.status:"locked";
}
// Модуль, по которому идут занятия (а не только просмотр результатов)
function studyOpen(mid){const st=moduleStatusOf(mid);return st==="open"||st==="passed";}
// Курс отняли: материал модуля остался в странице ради результатов, но учиться нельзя.
// Сервер называет это состояние сам (result_only в /api/me) — клиент ничего не выводит
// пересечением списков. Незнакомый статус безопасен и для старого клиента: любые его
// проверки открытости (open/passed) на нём ложны.
function isRevoked(mid){return moduleStatusOf(mid)==="result_only";}
// Учебные вкладки закрыты, если модуль закрыт преподавателем или курс отняли
function studyBlocked(){
  if(!(ME&&ME.role==="student"))return false;
  return moduleStatusOf(activeModule)==="locked_by_teacher"||isRevoked(activeModule);
}
// Стартовый модуль тропы: первый доступный ученику. М0 остаётся дефолтом там,
// где тропы ещё нет (демо, преподаватель, загрузка до ответа /api/me).
function startModule(){
  for(const cid of myCourses())for(const mm of courseModules(cid))if(studyOpen(mm.id))return mm.id;
  const first=(courseModules(myCourses()[0])[0]||{}).id;
  return first||"m0";
}
/* ===/TRAIL=== */
function freshModule(){return {vocab:{},test:null};}
function freshState(){return {v:2,updatedAt:null,settings:{},modules:{}};}
// v1 {vocab,test} -> v2 {modules:{m0:...}}; test.passed -> история {everPassed,lastAttempt,...}
function migrateTestV1(t){
  if(!t)return null;
  return {everPassed:!!t.passed,lastAttempt:{score:t.score,passed:!!t.passed,date:t.date,wrong:t.wrong||[]},
          consecutiveFails:t.passed?0:1,attempts:[{score:t.score,date:t.date}]};
}
function migrateV1(sv){
  return {v:2,updatedAt:sv.updatedAt||null,settings:sv.settings||{},
          modules:{m0:{vocab:sv.vocab||{},test:migrateTestV1(sv.test)}}};
}
function normalizeState(sv){
  if(!sv||typeof sv!=="object")return null;
  if(sv.v===1&&typeof sv.vocab==="object")return migrateV1(sv);
  if(sv.v===2&&sv.modules&&typeof sv.modules==="object")return sv;
  return null;
}
function loadState(){
  try{
    const raw=localStorage.getItem(LS_KEY)||(IS_DEMO?null:localStorage.getItem(LS_KEY_V1)); // v1-миграция не для демо: утащила бы реальный прогресс
    return normalizeState(raw?JSON.parse(raw):null)||freshState();
  }catch(e){return freshState();}
}
let ST=loadState();
function mod(){return ST.modules[activeModule]||(ST.modules[activeModule]=freshModule());}
// localStorage.setItem может бросить (переполнена квота, приватный режим) — прогресс в памяти
// (ST) и на сервере (pushState) важнее локальной копии; из-за неё карточная механика падать не должна.
// локальная запись без сети: снимок экзамена пишется на КАЖДЫЙ ответ, и полный
// save() (PUT+GET всего прогресса) там разорителен — сервер получает снимок на
// границах субтестов (ревью производительности 22.08)
function saveLocal(){ST.updatedAt=new Date().toISOString();try{localStorage.setItem(LS_KEY,JSON.stringify(ST));}catch(e){}}
function save(){saveLocal();pushState();updateFooter();}

/* ---------- Синхронизация с сервером (per-user JSON, без БД) ----------
   При открытии по http(s) прогресс тянется/пушится на /api/progress
   (файл /data/progress/<логин>.json на сервере). Логин определяет сервер
   по basic auth. При открытии файла напрямую (file://) — только localStorage. */
const SYNC={enabled:/^https?:$/.test(location.protocol)&&!IS_DEMO,timer:null,status:"off",pulled:false,pending:false,dirty:false}; // демо — как file://: только localStorage
// Снимок копии, КАКОЙ ОНА БЫЛА при загрузке вкладки: первый pull решает «кто новее» по нему,
// а не по отметке после первых ответов (см. overlayLocal у pullState)
SYNC.base=(()=>{try{return JSON.parse(JSON.stringify(ST));}catch(e){return null;}})();
let ME=null;
async function fetchMe(){
  if(!SYNC.enabled){chatBadgeSync();return;}   // демо тоже видит ответ на своё письмо
  try{
    const r=await fetch("api/me",{cache:"no-store"});
    if(r.ok){
      ME=await r.json();
      // Курсы запоминаем локально: офлайн (PWA) и в первые мгновения загрузки ME ещё нет,
      // а сайдбар уже рисуется — без этого ученик без A1 видел бы пустую тропу.
      // save() только при реальной смене курсов: иначе цикл push → pull → fetchMe → save → push
      // гонял PUT прогресса раз в секунду всё время, пока открыта вкладка
      // save() и до первого pull безопасен: «кто новее» pull решает по снимку загрузки
      // SYNC.base, а не по отметке, которую ставит save (смоук 25.09.2026)
      if(Array.isArray(ME.courses)&&ME.courses.length&&JSON.stringify(ST.courses||[])!==JSON.stringify(ME.courses)){ST.courses=ME.courses;save();}
    }
  }catch(e){}
  chatBadgeSync();   // счётчик чата: у преподавателя из ME.chat, у ученика — своим запросом
}
function isTeacher(){return !!(ME&&(ME.role==="teacher"||ME.role==="admin"));}
function isAdmin(){return !!(ME&&ME.role==="admin");}

/* ---------- Вычитка и правки контента (персистентно на сервере) ---------- */
let REVIEW={},OVERRIDES={};
// модули, чьи данные нужны активному модулю: словарь (родной + доноры reuse-слов)
// и диалоги — их озвучка живёт в бакетах homeOf(id) (ph_* → m0), без них у М1+
// не грузится список аудио и раздел «Диалоги» остаётся без ▶ и атмосфер
function depModules(){
  const mods=new Set(VOCAB.map(c=>homeOf(c.id)));
  const D=typeof DIALOGS!=="undefined"&&DIALOGS[activeModule];
  if(D)for(const p of D.parts)for(const ln of p.lines)mods.add(homeOf(ln.id));
  return [...mods];
}
async function fetchReviewData(){
  if(!SYNC.enabled)return;
  try{
    const mods=depModules();
    const res=await Promise.all(mods.map(mid=>Promise.all([
      fetch("api/review/"+mid,{cache:"no-store"}),fetch("api/overrides/"+mid,{cache:"no-store"})])));
    const review={},overrides={}; // собираем заново; из ответа модуля берём только его собственные id
    for(let i=0;i<mods.length;i++){
      const [r1,r2]=res[i];
      if(r1.ok)for(const [id,v] of Object.entries(await r1.json()||{}))if(homeOf(id)===mods[i])review[id]=v;
      if(r2.ok)for(const [id,v] of Object.entries(await r2.json()||{}))if(homeOf(id)===mods[i])overrides[id]=v;
    }
    REVIEW=review;OVERRIDES=overrides;
    applyOverrides();
  }catch(e){}
}
/* ===OVERRIDES=== */
// Правка преподавателя применяется ко ВСЕМ языкам, которые он заполнил: иначе ученик
// в англ./тур. режиме видит старый (уже отвергнутый) перевод — и по нему же строятся
// дистракторы мини-теста. Пустое поле означает «не задано» и исходное не затирает.
function applyOverrides(){
  for(const [id,o] of Object.entries(OVERRIDES)){
    const c=VOCAB.find(v=>v.id===id);
    if(!c)continue;
    // say здесь намеренно нет: это произношение для озвучки, а не текст карточки —
    // ученик обязан видеть написание, иначе он выучит транскрипцию вместо слова
    for(const f of ["ky","ru","en","tr"])if(o[f])c[f]=o[f];
    if(o.accept)c.accept=o.accept;
  }
}
// Текст, который читает голос: произношение преподавателя сильнее написания.
// Заимствования вроде «команда» модель читает с чужим гласным, и транскрипция
// (/komɑndɑ/) или запись «как слышится» — единственный способ это поправить,
// не ломая написание на экране.
function sayText(id,ky){
  const o=OVERRIDES[id];
  return (o&&typeof o.say==="string"&&o.say.trim())?o.say.trim():ky;
}
/* ===/OVERRIDES=== */
async function putReview(id,payload){
  const r=await fetch("api/review/"+activeModule,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({id},payload))});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  const d=await r.json();
  if(d.item)REVIEW[id]=d.item;else delete REVIEW[id];
  updateBanner();
}
async function putOverride(id,payload){
  const r=await fetch("api/overrides/"+activeModule,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({id},payload))});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  const d=await r.json();
  if(d.item)OVERRIDES[id]=d.item;else delete OVERRIDES[id];
  applyOverrides();
}
/* ===QUIZLOGIC=== */
// Зачётный мини-тест собирается ТОЛЬКО из вычитанных преподавателем фраз (статус ok/fixed).
function reviewedOk(review,id){const r=review[id];return !!r&&(r.status==="ok"||r.status==="fixed");}
function quizPool(vocab,review){return vocab.filter(c=>reviewedOk(review,c.id));}
const QUIZ_MIN_REVIEWED=20; // минимум вычитанных фраз для зачётного билета (8 узнавание + 6 ввод + запас вариативности)
// Замок — по СВОИМ словам модуля (reuse вычитан в родном модуле и открытие не ускоряет);
// билет — по всем (quizPool). Модуль без своих слов (М10/М11) гейтится по reuse.
function quizGateBase(vocab){const own=vocab.filter(c=>!c.reuse);return own.length?own:vocab;}
function quizReady(vocab,review){return quizPool(quizGateBase(vocab),review).length>=QUIZ_MIN_REVIEWED;}
/* ===/QUIZLOGIC=== */
function reviewedCount(){return quizGateBase(VOCAB).filter(c=>reviewedOk(REVIEW,c.id)).length;}

/* ---------- Аудио фраз (ElevenLabs TTS или запись преподавателя) ---------- */
let AUDIO=new Set(),AUDIO_META={};
// Демо: список озвученного вшит в артефакт при сборке (DEMO_AUDIO — только реально
// существовавшие файлы), сервер отдаёт их копии; с сервера ничего не тянем.
if(IS_DEMO)AUDIO=new Set(DEMO_AUDIO);
async function fetchAudioList(){
  if(!SYNC.enabled)return;
  try{
    const mods=depModules();
    const res=await Promise.all(mods.map(mid=>Promise.all([
      fetch("api/audio/"+mid+"/list",{cache:"no-store"}),
      fetch("api/audio/"+mid+"/meta",{cache:"no-store"})])));
    const audio=new Set(),meta={};
    for(let i=0;i<mods.length;i++){
      const [r,rm]=res[i];
      if(r.ok)for(const id of await r.json())if(homeOf(id)===mods[i])audio.add(id);
      if(rm.ok)for(const [id,v] of Object.entries((await rm.json())||{}))if(homeOf(id)===mods[i])meta[id]=v;
    }
    AUDIO=audio;AUDIO_META=meta;
  }catch(e){}
}
function isCustomAudio(id){return !!(AUDIO_META[id]&&AUDIO_META[id].source==="upload");}
// в учебные карточки звук попадает только после апрува преподавателем («Аудио ок»)
function audioApproved(id){return AUDIO.has(id)&&(IS_DEMO||!!(REVIEW[id]&&REVIEW[id].audioOk));} // демо-набор курируется только из одобренного
// Свежая перегенерация/загрузка обязана звучать сразу: тот же URL до 10 минут живёт
// в HTTP-кэше браузера (аудио отдаётся с max-age=600), и после «Перегенерить» плеер
// играл прежнюю запись — правленым в этой сессии записям добавляется кэш-бастер.
const AUDIO_FRESH={}; // id → метка последней правки озвучки в этой сессии
function playAudio(id,rate){const a=new Audio("api/audio/"+homeOf(id)+"/"+id+".mp3"+(AUDIO_FRESH[id]?"?v="+AUDIO_FRESH[id]:""));a.playbackRate=rate||1;a.preservesPitch=true;const p=a.play();if(p&&p.catch)p.catch(()=>{});return a;} // отказ play() глотаем: автоплей до жеста блокируют политики браузера, кнопка ▶ остаётся
// Канал «переднего плана»: строчный ▶, цепочка диалога и песня занимают один слот —
// новое воспроизведение глушит предыдущее. owner — маркер источника (кнопка/часть/песня),
// done зовётся при любом стопе (вернуть иконку/класс), onended — продолжение цепочки.
let FG=null;
function fgOwner(){return FG&&FG.owner;}
function fgStop(){if(!FG)return;const f=FG;FG=null;f.audio.onended=null;f.audio.onerror=null;f.audio.pause();if(f.done)f.done();}
function fgPlay(id,o){
  o=o||{};
  if(FG&&FG.owner===o.owner){const f=FG;FG=null;f.audio.onended=null;f.audio.onerror=null;f.audio.pause();} // тот же источник продолжает цепочку — done не дёргаем
  else fgStop();
  const a=playAudio(id,o.rate);
  const next=()=>{if(FG&&FG.audio===a){if(o.onended)o.onended();else fgStop();}};
  a.onended=next;a.onerror=next;
  FG={audio:a,owner:o.owner,done:o.done};
  return a;
}
// Атмосфера диалогов — независимый фоновый луп; renderTab глушит оба канала при уходе
let AMB=null;
function ambStop(){if(!AMB)return;AMB.audio.pause();AMB.btn.classList.remove("ambon");AMB=null;}
// Кнопка-тумблер стабильной ширины: обе подписи в одной grid-ячейке (ширина = максимум),
// состояние переключается классом .on — вёрстка не прыгает.
function tglBtn(idle,act,attrs){
  return h("button",Object.assign({class:"btn ghost tgl"},attrs||{}),
    h("span",{class:"tgl-idle"},...idle),h("span",{class:"tgl-act"},...act));
}
// маленькая кнопка ▶/⏸: повторный тап останавливает, новый источник глушит прежний
// evPush — на месте клика, не внутри playAudio: та должна остаться однострочной для audio.test.js.
function sndBtn(id){
  if(!AUDIO.has(id))return null;
  const b=h("button",{class:"btn ghost sndbtn",title:t("rev_listen")},icon("play",11));
  b.addEventListener("click",()=>{
    if(fgOwner()===b){fgStop();return;}
    evPush("audio.play",{mod:homeOf(id),cardId:id,ctx:"listen"});
    fgPlay(id,{owner:b,done:()=>b.replaceChildren(icon("play",11))});
    b.replaceChildren(icon("pause",11));
  });
  return b;
}
// компактная кнопка-«призрак» шапки карточки (▶/✓/⏱/★): общий вид, свои title/onclick;
// attrs.class — дополнительный класс поверх btn ghost (звёздочке нужен starred)
function ghostBtn(attrs,...kids){
  return h("button",Object.assign({},attrs,
    {class:"btn ghost"+(attrs.class?" "+attrs.class:""),style:"padding:2px 8px"}),...kids);
}
// пара кнопок ▶ / ▶ 0.5× для шапки карточки (оба режима); null, если аудио нет.
// Через канал fgPlay, а не голым playAudio: иначе тап по ▶ звучал бы поверх автоозвучки.
function cardAudioBtns(id){
  if(!AUDIO.has(id))return null;
  return appendKids(h("span",{}),
    ghostBtn({onclick:()=>{evPush("audio.play",{mod:homeOf(id),cardId:id,ctx:"play"});fgPlay(id,{owner:"cards-manual"});}},icon("play",13)),
    " ",ghostBtn({title:t("audio_slow_hint"),onclick:()=>{evPush("audio.play",{mod:homeOf(id),cardId:id,ctx:"slow"});fgPlay(id,{owner:"cards-manual",rate:0.5});}},icon("play",13)," 0.5×"));
}
// Автоозвучка карточки — по умолчанию ВЫКЛЮЧЕНА: звук, играющий сам при каждом
// показе, для занятия в тишине хуже, чем лишний тап по ▶.
function autoplayOn(){return !!(ST.settings&&ST.settings.autoplay);}
// Решения ученика о слове в шапке карточки: «уже знаю» (закрепить без ввода) и
// «отложить» (убрать из колод, обратимо). onDone листает сессию дальше.
function knowSkipBtns(id,onDone){
  const box=h("span",{});
  if(!isMastered(id)){
    box.append(ghostBtn({title:t("know_hint"),
      onclick:()=>{const box0=cardState(id).box;setKnown(id);evPush("card.know",{mod:homeOf(id),cardId:id,box0});onDone(t("know_fb"));}},icon("check",13))," ");
  }
  box.append(ghostBtn({title:t("skip_hint"),
    onclick:()=>{toggleSkipped(id);evPush("card.skip",{mod:homeOf(id),cardId:id,on:isSkipped(id)});onDone(t("skip_fb"));}},icon("clock",13)));
  return box;
}
// звёздочка «на запоминание» для шапки карточки (оба режима)
function starBtn(id){
  const b=ghostBtn({class:isMarked(id)?"starred":"",title:t("mark_hint"),
    onclick:()=>{toggleMarked(id);evPush("card.mark",{mod:homeOf(id),cardId:id,on:isMarked(id)});b.classList.toggle("starred",isMarked(id));renderCardTopics();}},icon("star",13));
  return b;
}
// слово с озвучкой
function kgw(w,id){
  const s=h("span",{},h("span",{class:"kgword"},w));
  const b=sndBtn(id);if(b)s.append(b);
  return s;
}
async function genTts(id,text,force){
  const r=await fetch("api/tts/"+homeOf(id),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,text,force:!!force})});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка tts");
  AUDIO.add(id);AUDIO_META[id]={source:"tts"};AUDIO_FRESH[id]=Date.now();
}
async function uploadAudio(id,file){
  const r=await fetch("api/audio/"+homeOf(id)+"/"+id+".mp3",{method:"PUT",headers:{"Content-Type":file.type||"audio/mpeg"},body:file});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка загрузки");
  AUDIO.add(id);AUDIO_META[id]={source:"upload"};AUDIO_FRESH[id]=Date.now();
}
// Кнопка «Написать в WhatsApp» с предзаполненным текстом — реюз: демо-баннер,
// конец очереди карточек, финиш демо-теста, настройки.
function demoWaBtn(){
  return h("a",{class:"btn",href:"https://wa.me/996505854856?text="+encodeURIComponent(t("demo_wa_text")),
    target:"_blank",rel:"noopener noreferrer"},t("demo_wa"));
}
function updateBanner(){
  const b=el("banner");if(!b)return;
  if(IS_DEMO){ // в демо баннер вычитки не о чем: показываем, что это демо, и куда идти за полным курсом
    b.className="banner";
    clear(b).append(tf("demo_banner",{n:VOCAB.length,total:DEMO_TOTAL})," ",demoWaBtn());
    return;
  }
  /* Экзаменационная неделя: баннер вычитки говорит про зачётный мини-тест, а его
     в этом модуле нет (правило владельца 22.08.2026) — строка вводила бы в
     заблуждение. Полоса убирается целиком, а не заполняется другим текстом. */
  if(isExamWeek(activeModule)){
    b.className="banner";clear(b);b.style.display="none";return;
  }
  b.style.display="";
  const base=quizGateBase(VOCAB);
  const total=base.length,done=reviewedCount();
  const q=base.filter(c=>REVIEW[c.id]&&REVIEW[c.id].status==="question").length;
  clear(b);
  if(done>=total){
    b.className="banner ok";
    b.append(icon("check",14)," "+tf("banner_ok",{d:done,t:total}));
  }else{
    b.className="banner";
    b.append(icon("warn",14)," "+tf("banner_draft",{d:done,t:total,q:q?tf("banner_q",{q}):""}));
  }
}

/* ---------- Тема (светлая/тёмная/системная) ---------- */
function currentTheme(){return (ST.settings&&ST.settings.theme)||localStorage.getItem("kga1-theme")||"auto";}
function applyTheme(){document.documentElement.setAttribute("data-theme",currentTheme());}
function setTheme(t){
  ST.settings=ST.settings||{};ST.settings.theme=t;
  localStorage.setItem("kga1-theme",t);
  evPush("ui.setting",{k:"theme",val:t});
  applyTheme();save();
}
/* ===SYNCPULL=== */
// Гард «кто новее»: pull НЕ затирает локальное состояние, если оно свежее серверного —
// иначе бут на втором устройстве откатывал бы ответы, ещё не доехавшие до сервера.
// Обратная сторона осознанна: из двух устройств побеждает последнее писавшее.
// Два исключения (порча прогресса 12–15.09.2026): (1) локальная копия принадлежит другому
// логину (общий телефон преподавателя и ученика) — она не наследуется, берётся серверная;
// (2) до первого pull ничего не пушится: бут раньше слал локальную копию параллельно с
// pull, и устаревшая копия второго браузера уезжала на сервер поверх свежей.
/* Изменения, сделанные в этой вкладке после загрузки: всё, что отличается от снимка SYNC.base.
   Первый pull при серверной копии новее снимка берёт её за основу и накладывает сверху только
   это — ответ, данный до окончания pull, ставил updatedAt=сейчас, и устаревшая копия целиком
   побеждала серверную (ревью 25.09.2026). Офлайн-сессия при этом не теряется: её ответы — тоже
   изменения относительно снимка. Поля профиля (login, courses) и отметка времени — не прогресс. */
function overlayLocal(srv,base,cur){
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const next=JSON.parse(JSON.stringify(srv));next.modules=next.modules||{};
  let changed=false;
  for(const [mid,cm] of Object.entries(cur.modules||{})){
    const bm=(base.modules||{})[mid]||{};
    if(same(cm,bm))continue;
    const nm=next.modules[mid];
    if(!nm||(cm.reset&&cm.reset!==bm.reset)){next.modules[mid]=cm;changed=true;continue;}   // модуль начат или сброшен здесь
    for(const [id,v] of Object.entries(cm.vocab||{}))
      if(!same(v,(bm.vocab||{})[id])){(nm.vocab=nm.vocab||{})[id]=v;changed=true;}
    if(!same(cm.test,bm.test)){nm.test=cm.test;changed=true;}   // история тестов сливается сервером (mergeTest)
  }
  for(const k of Object.keys(cur))
    if(!["modules","updatedAt","login","courses","v"].includes(k)&&!same(cur[k],base[k])){next[k]=cur[k];changed=true;}
  if(changed)next.updatedAt=new Date().toISOString();
  return {next,changed};
}
async function pullState(){
  if(!SYNC.enabled)return;
  const me=ME||null;
  const foreign=!!(me&&me.login&&ST.login&&ST.login!==me.login);
  try{
    const r=await fetch("api/progress",{cache:"no-store"});
    if(r.ok){
      const srv=normalizeState(await r.json());
      let next=null;
      // «кто новее» при первом pull — по снимку загрузки, а не по отметке после первых ответов
      const base=!SYNC.pulled&&SYNC.base&&SYNC.base.login===ST.login?SYNC.base:null;
      const known=base?base.updatedAt:ST.updatedAt;
      if(foreign)next=srv||freshState();
      else if(srv&&(!known||(srv.updatedAt&&srv.updatedAt>known))){
        if(base){const o=overlayLocal(srv,base,ST);next=o.next;if(o.changed)SYNC.pending=true;}
        else next=srv;
      }
      // локальная копия новее серверной (ответы прошлой сессии не доехали) — отправить сразу,
      // а не при следующем ответе: иначе на другом устройстве их не будет
      else if(!SYNC.pulled&&srv&&srv.updatedAt&&ST.updatedAt>srv.updatedAt)SYNC.pending=true;
      // курсы — данные профиля, а не прогресса: принятая копия получает их из ME
      if(next&&me&&Array.isArray(me.courses)&&me.courses.length)next.courses=me.courses;
      if(next)ST=next;
      // владелец копии ставится ТОЛЬКО здесь, после сверки: поставь его раньше (в fetchMe) —
      // и чужая копия стала бы «своей» до того, как pull успел её отбросить
      const stamp=!!(me&&me.login&&ST.login!==me.login);
      if(stamp)ST.login=me.login;
      if(next||stamp){try{localStorage.setItem(LS_KEY,JSON.stringify(ST));}catch(e){}}
      SYNC.status="ok";
    }else SYNC.status="err";
  }catch(e){SYNC.status="err";}
  // Сверено — только после УДАЧНОГО pull: при ошибке серверную копию никто не видел, и
  // отложенная устаревшая копия затёрла бы её (ревью 25.09.2026). Pull повторяется сам.
  if(SYNC.status==="ok"){clearTimeout(SYNC.pullRetry);
    if(!SYNC.pulled){SYNC.pulled=true;SYNC.base=null;if(SYNC.pending){SYNC.pending=false;pushState();}}}
  else if(!SYNC.pulled){clearTimeout(SYNC.pullRetry);SYNC.pullRetry=setTimeout(pullState,20000);}
}
function scheduleSyncRetry(){clearTimeout(SYNC.retryTimer);SYNC.retryTimer=setTimeout(()=>pushState(),20000);}
function pushState(){
  if(!SYNC.enabled)return;
  if(!SYNC.pulled){SYNC.pending=true;return;}   // до первого pull локальная копия на сервер не уезжает
  clearTimeout(SYNC.timer);
  SYNC.dirty=true;   // есть неотправленное — самообновление подождёт (===UPDATE===)
  SYNC.timer=setTimeout(async()=>{
    try{
      const r=await fetch("api/progress",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(ST)});
      SYNC.status=r.ok?"ok":"err";
      if(r.ok)SYNC.dirty=false;
      // 409: сервер отверг копию другого логина (вкладка пережила смену аккаунта) — профиль
      // переспрашивается и серверная копия забирается, повторять отправку бессмысленно
      if(r.status===409){clearTimeout(SYNC.retryTimer);await fetchMe();await pullState();}
      else if(!r.ok)scheduleSyncRetry();
      // Серверная копия забирается только когда слияние что-то вернуло (restored в ответе):
      // тогда у неё свежее updatedAt, и pull приносит потерянное на это устройство, а профиль
      // перечитывается ради замков тропы. Раньше pull и fetchMe шли после КАЖДОЙ отправки —
      // два лишних запроса на каждый ответ карточки; сдача теста обновляет профиль сама (15-boot).
      else{
        clearTimeout(SYNC.retryTimer);
        const j=await r.json().catch(()=>({}));
        if(j&&j.restored){await pullState();fetchMe().then(()=>{renderModulesPath();});}
      }
    }catch(e){SYNC.status="err";scheduleSyncRetry();}
    updateFooter();
  },800);
}
/* ===/SYNCPULL=== */
/* ===INSTALL=== Установка приложения. Chrome (Android и компьютер) сам решает, можно ли
   поставить сайт приложением, и сообщает событием beforeinstallprompt — перехватываем его,
   чтобы предложить установку там, где человек уже занимается, а не ждать, пока он найдёт
   пункт в меню браузера (его находят единицы). Safari на iPhone такого события не шлёт и
   программной установки не имеет — там ведём на инструкцию со скриншотами (/install).
   Уже установленному приложению (standalone) не предлагаем ничего. */
const INSTALL={prompt:null,installed:false};
function installStandalone(){
  try{return !!(navigator.standalone||(typeof matchMedia==="function"&&matchMedia("(display-mode: standalone)").matches));}catch(e){return false;}
}
function installIOS(){
  try{const ua=navigator.userAgent||"";
    return /iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);}catch(e){return false;}
}
// prompt — ставится в один тап; guide — только инструкция (iPhone); none — уже стоит или
// браузер установку не предлагает (тогда и кнопки нет: обещать то, чего не будет, нельзя)
function installState(){
  if(INSTALL.installed||installStandalone())return "none";
  if(INSTALL.prompt)return "prompt";
  return installIOS()?"guide":"none";
}
async function installNow(){
  const p=INSTALL.prompt;
  if(!p)return null;
  INSTALL.prompt=null;   // событие одноразовое: второй prompt() по нему уже не сработает
  let outcome="dismissed";
  try{p.prompt();const c=await p.userChoice;outcome=(c&&c.outcome)||"dismissed";}catch(e){outcome="error";}
  if(outcome==="accepted")INSTALL.installed=true;
  evPush("app.install",{how:"prompt",outcome});
  return outcome;
}
window.addEventListener("beforeinstallprompt",(e)=>{
  if(e&&e.preventDefault)e.preventDefault();   // браузерную плашку откладываем — предложим у себя
  INSTALL.prompt=e;
  if(typeof activeTab!=="undefined"&&activeTab==="settings")renderTab();
});
window.addEventListener("appinstalled",()=>{
  INSTALL.installed=true;INSTALL.prompt=null;
  evPush("app.install",{how:"appinstalled",outcome:"accepted"});
  if(typeof activeTab!=="undefined"&&activeTab==="settings")renderTab();
});
/* ===/INSTALL=== */
/* ===UPDATE=== Самообновление открытой вкладки/PWA. Сервис-воркер отдаёт свежую страницу
   на каждой навигации, но вкладка, пережившая деплой (PWA на телефоне живёт днями), крутит
   старую сборку, пока человек сам не перезагрузит — просить об этом людей нельзя.
   Версия сервера сверяется при возврате в сеть, при возврате вкладки на экран, раз в полчаса
   и после старта; расхождение — перезагрузка в безопасный момент: прогресс отправлен, экран
   ничем не занят, не идёт тест/экзамен/тренажёр формата (иначе — при ближайшем переходе
   между вкладками).
   Защита от петли (в окно деплоя воркер отдаёт старую оболочку по 5xx): одна попытка на
   версию сервера в 10 минут, отметка в sessionStorage. */
const UPDATE={stale:null,checking:false,lastCheck:0,older:null,holds:{},drafts:[],
  GAP:60000,RETRY:600000,HOLD:60000,DOWN:300000};
// Версии сравниваются по разрядам, а не «на неравенство»: при каждом деплое и откате пару
// минут отвечают ОБА контейнера (deploy/CREDENTIALS.md), и неравенство гоняло бы вкладку на
// перезагрузку из-за отставшего ответа, да ещё писало бы в журнал «обновились» на старую
// сборку. Вверх — сразу. Вниз (откат прода) — тоже сами, иначе вкладки останутся на той
// версии, ради которой откат и делали, но лишь когда сервер отвечает одной и той же старой
// версией дольше окна деплоя (DOWN): за это время отставший контейнер уже погашен.
function verGt(a,b){
  const x=String(a||"").split("."),y=String(b||"").split(".");
  for(let i=0;i<Math.max(x.length,y.length);i++){
    const d=(parseInt(x[i],10)||0)-(parseInt(y[i],10)||0);
    if(d)return d>0;
  }
  return false;
}
function updateStale(v){
  if(!v||v===APP_VER){UPDATE.older=null;return null;}
  if(verGt(v,APP_VER)){UPDATE.older=null;return v;}
  const now=Date.now();
  if(!UPDATE.older||UPDATE.older.v!==v){UPDATE.older={v,at:now};return null;}
  return now-UPDATE.older.at>=UPDATE.DOWN?v:null;   // откат прода подтверждён временем
}
// Занятость экрана: перезагрузка стирает без следа то, чего ещё нет ни в прогрессе, ни на
// сервере. Раздел объявляет её сам одной строкой — updateHold("rec",true/false) на запись
// микрофона и распознавание. Отметка ПРОТУХАЕТ (HOLD): пропущенный релиз (отказ микрофона,
// сорванный запрос) не должен запирать самообновление до конца сессии.
function updateHold(k,on){if(on)UPDATE.holds[k]=Date.now();else delete UPDATE.holds[k];}
function updateHeld(){const now=Date.now();return Object.keys(UPDATE.holds).some(k=>now-UPDATE.holds[k]<UPDATE.HOLD);}
function updateTextField(e){
  if(!e)return false;
  if(e.isContentEditable)return true;
  const tag=String(e.tagName||"").toUpperCase();
  if(tag==="TEXTAREA")return true;
  // search — фильтр списка, а не черновик: его содержимое никуда не отправляют,
  // и держать им самообновление (поиск по ростеру живёт весь экран) не за что
  return tag==="INPUT"&&!["checkbox","radio","button","submit","reset","range","file","color","search"].includes(String(e.type||"text").toLowerCase());
}
// Несохранённый ввод виден по самому DOM, а не по списку вкладок: письмо в композере,
// правка вычитки, балл за работу, ответ на карточке. Держит, пока поле НЕ опустело и живёт
// в документе — ушёл экран (перерисовка), отправилось письмо (поле очищено) — держать нечего.
// Плюс поле под курсором: человек печатает прямо сейчас.
function updateDrafts(){
  UPDATE.drafts=UPDATE.drafts.filter(e=>e&&e.isConnected&&String(e.value==null?(e.textContent||""):e.value).trim());
  return UPDATE.drafts.length>0||updateTextField(document.activeElement);
}
function updateBusy(){return updateHeld()||updateDrafts();}
function updateSafeNow(){
  return SYNC.status==="ok"&&!SYNC.dirty&&!SYNC.pending
    &&!["test","exam"].includes(activeTab)&&activeTab.slice(0,3)!=="tr_"
    &&!updateBusy();
}
async function checkAppVersion(force){
  if(!SYNC.enabled||APP_VER.startsWith("__")||UPDATE.checking)return false;
  const now=Date.now();
  if(!force&&now-UPDATE.lastCheck<UPDATE.GAP)return false;
  UPDATE.checking=true;UPDATE.lastCheck=now;
  try{
    const r=await fetch("api/version",{cache:"no-store"});
    if(r.ok){const j=await r.json();UPDATE.stale=updateStale(j&&j.version);}
  }catch(e){}
  UPDATE.checking=false;
  return applyUpdate();
}
function applyUpdate(){
  if(!UPDATE.stale||document.visibilityState!=="visible"||!updateSafeNow())return false;
  let tried=null;try{tried=JSON.parse(sessionStorage.getItem("kga1-upd")||"null");}catch(e){}
  if(tried&&tried.v===UPDATE.stale&&Date.now()-tried.at<UPDATE.RETRY)return false;
  try{sessionStorage.setItem("kga1-upd",JSON.stringify({v:UPDATE.stale,at:Date.now()}));}catch(e){}
  evPush("app.update",{from:APP_VER,to:UPDATE.stale});evFlush(true);
  location.reload();
  return true;
}
// Набранное, но не отправленное — поле запоминается на первом же вводе: курсор к моменту
// проверки мог уйти (кликнули по кнопке, свернули вкладку), а текст остался.
document.addEventListener("input",(e)=>{
  const tgt=e&&e.target;   // не t: снаружи так зовут перевод
  if(updateTextField(tgt)&&UPDATE.drafts.indexOf(tgt)<0&&UPDATE.drafts.length<200)UPDATE.drafts.push(tgt);
},true);
/* ===/UPDATE=== */
window.addEventListener("online",()=>{pushState();checkAppVersion(true);});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkAppVersion();});
setInterval(()=>checkAppVersion(),30*60*1000);

/* ---------- Журнал занятий: каждый ответ ученика, батчами на api/events ----------
   Отдельно от pushState выше: там дебаунс 800мс и идемпотентная переотправка ВСЕГО прогресса,
   тут — накопление и другая семантика отказа. Никакого зеркала в localStorage и ретраев:
   performance.now() обнуляется на перезагрузке, честный dt для отлежавшего батча посчитать
   нечем, а зеркало тянет за собой персистентный дедуп и риск QuotaExceededError. Недоставленное
   при жёстком закрытии вкладки — единицы событий, best-effort, не источник истины о прогрессе. */
const EV={sid:Math.random().toString(36).slice(2,10)+Date.now().toString(36),seq:0,buf:[]};
function evPush(type,data){
  if(/\.answer$/.test(type)){DAY_DELTA++;updateDaymeter();} // дневная цель — тем же счётом, что журнал сервера
  if(!SYNC.enabled)return; // file:// — очередь копилась бы в никуда, отправлять некуда
  EV.buf.push(Object.assign({seq:++EV.seq,_at:performance.now(),type},data));
  if(EV.buf.length>=20)evFlush();
  else if(!EV.timer)EV.timer=setTimeout(evFlush,10000);
}
function evFlush(beacon){
  clearTimeout(EV.timer);EV.timer=null;
  if(!EV.buf.length)return;
  const now=performance.now();
  const events=EV.buf.slice(0,200).map(e=>{
    const o=Object.assign({},e,{dt:Math.round(now-e._at)});delete o._at;return o;
  });
  EV.buf=EV.buf.slice(events.length);
  const payload=JSON.stringify({sid:EV.sid,events});
  if(beacon&&navigator.sendBeacon){navigator.sendBeacon("api/events",new Blob([payload],{type:"application/json"}));return;}
  fetch("api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:payload}).catch(()=>{});
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){evPush("session.end",{});evFlush(true);}});
window.addEventListener("pagehide",()=>evFlush(true));
// JS-ошибки у ученика: до 5 уникальных сообщений за сессию, без стека —
// в стек может попасть что угодно, а для «у ученика сломалось» хватает msg+строки.
const EVERR=new Set();
window.addEventListener("error",(e)=>{
  const msg=String((e&&e.message)||"").slice(0,200);
  if(!msg||EVERR.size>=5||EVERR.has(msg))return;
  EVERR.add(msg);
  evPush("ui.error",{msg,src:String((e&&e.filename)||"").slice(-100),line:(e&&e.lineno)||0});
});
/* ===SRS=== */
// Прогресс карточки живёт в бакете её РОДНОГО модуля (id-префикс), а не активного:
// переиспользованное слово имеет единый SRS-прогресс во всех модулях, где встречается.
function bucketOf(id){const hm=homeOf(id);return ST.modules[hm]||(ST.modules[hm]=freshModule());}
function recOf(id){return bucketOf(id).vocab[id]||null;}
function cardState(id){return recOf(id)||{box:0,streak:0,due:0};}
// Состояния различаются НАЛИЧИЕМ записи, а не только боксом. Слово, сбитое ошибкой
// в бокс 0, — не «новое»: раньше оно выпадало и из «в работе», и из очереди повторений
// (та требовала box>0), то есть именно трудные слова переставали возвращаться.
function isNew(id){return !recOf(id);}
function isFixing(id){const r=recOf(id);return !!r&&r.box===0;}
function isDue(id){const r=recOf(id);return !!r&&r.due<=Date.now();} // закреплённые с истёкшим интервалом — тоже
function isMastered(id){const cs=cardState(id);return cs.box>=MASTERY_BOX&&cs.due>Date.now();}
// Пометки слов — однотипные глобальные списки id в ST, синкаются как весь прогресс:
// «на запоминание» (marked) собирает колоду, «отложено» (skip) вычитается из колод и
// знаменателей. Один механизм на оба (и на будущие): список + его Set для проверок.
// Set пересобирается, когда меняется сам массив — pullState подменяет ST целиком.
const ID_LISTS={};
function idList(name){
  const arr=Array.isArray(ST[name])?ST[name]:(ST[name]=[]);
  let e=ID_LISTS[name];
  if(!e||e.arr!==arr){e=ID_LISTS[name]={arr,set:new Set(arr)};}
  return e;
}
function hasId(name,id){return idList(name).set.has(id);}
function toggleId(name,id){
  const {arr,set}=idList(name);
  if(set.has(id)){arr.splice(arr.indexOf(id),1);set.delete(id);}else{arr.push(id);set.add(id);}
  save();
}
function isMarked(id){return hasId("marked",id);}
function toggleMarked(id){toggleId("marked",id);}
// Отложенное слово исключается из колод И из знаменателей: «выучено 12 из 40», где
// восемь слов сам ученик отложил, — неверная дробь. Список виден и обратим.
function isSkipped(id){return hasId("skip",id);}
function toggleSkipped(id){toggleId("skip",id);}
function notSkipped(list){const {set}=idList("skip");return set.size?list.filter(c=>!set.has(c.id)):list;}
function grade(id,correct){
  const cs=cardState(id);
  if(correct){
    cs.streak++;
    // Бокс растёт только когда интервал отлежал. Иначе «Ещё карточки» трижды подряд
    // проводили слово 0→3 за одну посадку, и «закреплено» переставало означать
    // обещанные верные вводы с интервалом в днях. Вне интервала ответ — практика.
    if(cs.due<=Date.now()){
      cs.box=Math.min(cs.box+1,SCHEDULE_DAYS.length); // box 4 = подтверждённое закрепление (интервал 16 дней)
      cs.due=Date.now()+SCHEDULE_DAYS[Math.min(cs.box-1,SCHEDULE_DAYS.length-1)]*DAY;
    }
  }
  else{cs.streak=0;cs.box=Math.max(cs.box-1,0);cs.due=Date.now();}
  bucketOf(id).vocab[id]=cs;save();
}
// «Уже знаю»: слово закрепляется сразу, но подтверждение — через неделю, а не через
// 16 дней: самооценку проверяет ввод, ошибка вернёт слово обычной деградацией.
function setKnown(id){
  const cs=cardState(id);
  cs.box=MASTERY_BOX;cs.streak=MASTERY_BOX;cs.due=Date.now()+SCHEDULE_DAYS[MASTERY_BOX-1]*DAY;
  bucketOf(id).vocab[id]=cs;save();
}
// Счётчики модуля — по словам, которые ученик учит: отложенные не в счёт (см. notSkipped)
function countVocab(pred){let n=0;for(const c of notSkipped(VOCAB))if(pred(c.id))n++;return n;}
function masteredCount(){return countVocab(isMastered);}
function doneOnceCount(){return countVocab(id=>!isNew(id));} // слово в обороте: была хотя бы одна попытка ввода
function fixingCount(){return countVocab(isFixing);} // была ошибка ввода, вернётся в порцию
// Градуированный прогресс: сумма боксов (0..3) по неотложенным словам / максимум.
// «Закреплено» требует верных вводов с интервалами и в первый день честно равно нулю,
// поэтому бар считаем по боксам, а не по мастерству.
function progressScoreFor(pool){const p=notSkipped(pool);let s=0;for(const c of p){s+=Math.min(cardState(c.id).box,MASTERY_BOX);}return p.length?s/(MASTERY_BOX*p.length):0;}
/* ===/SRS=== */
/* Дневная цель и очередь повторений. Метрика дня ОДНА — серверный журнал:
   /api/me отдаёт базу (day:{key,ans,streak}), клиент добавляет дельту текущей
   сессии по тем же событиям (*.answer), что считает сервер. Локального стора нет —
   он был вторым источником правды и расходился с кольцом в 2–3 раза. */
const DAILY_GOAL=20, CARDS_PER_MIN=3; // темп для оценки «~N мин» в кнопке «Продолжить»
let DAY_DELTA=0; // ответы этой сессии поверх базы из /api/me
function dailyToday(){return dayKeyOf(new Date().toISOString());}
function dayNow(){
  const base=(ME&&ME.day&&ME.day.key===dailyToday())?ME.day:{ans:0,streak:0};
  const ans=(base.ans||0)+DAY_DELTA;
  // первый ответ сегодня продлевает серию, не дожидаясь следующего пулла
  const streak=(base.streak||0)+((base.ans||0)===0&&ans>0?1:0);
  return {ans,streak};
}
// Словарь модуля как список id — CONTENT статичен, resolveVocab с его линейным
// поиском доноров по alias-ам достаточно прогнать один раз на модуль за сессию.
const VOCAB_IDS=new Map();
function vocabIdsOf(mid){
  let ids=VOCAB_IDS.get(mid);
  if(!ids){ids=resolveVocab(CONTENT[mid].vocab,CONTENT).map((c)=>c.id);VOCAB_IDS.set(mid,ids);}
  return ids;
}
// Очередь повторений: total (с дедупом реюза), best — куда вести «Продолжить»,
// byMod — разбивка для чипов тропы (один счёт на всех потребителей)
function duePlan(){
  const seen=new Set();let total=0,best=null,bestN=0;const byMod={};
  for(const mid of CONTENT_READY){
    if(!studyOpen(mid))continue;
    let n=0;
    for(const id of vocabIdsOf(mid)){
      if(isSkipped(id)||!isDue(id))continue;
      n++;
      if(!seen.has(id)){seen.add(id);total++;}
    }
    byMod[mid]=n;
    if(n>bestN){bestN=n;best=mid;}
  }
  return {total,best,byMod};
}
// кольцо дневной цели: SVG строится DOM-методами (никакого innerHTML)
function goalRing(val,goal){
  const box=h("div",{style:"position:relative;width:64px;height:64px;flex-shrink:0"});
  const sv=document.createElementNS(SVG_NS,"svg");
  sv.setAttribute("viewBox","0 0 64 64");sv.setAttribute("width","64");sv.setAttribute("height","64");sv.setAttribute("aria-hidden","true");
  const C=2*Math.PI*26, pct=Math.min(1,val/goal);
  const mk=(stroke,dash)=>{
    const c=document.createElementNS(SVG_NS,"circle");
    c.setAttribute("cx","32");c.setAttribute("cy","32");c.setAttribute("r","26");
    c.setAttribute("fill","none");c.setAttribute("stroke",stroke);c.setAttribute("stroke-width","7");
    if(dash){c.setAttribute("stroke-linecap","round");c.setAttribute("stroke-dasharray",dash);c.setAttribute("transform","rotate(-90 32 32)");}
    return c;
  };
  sv.append(mk("var(--line2)",null),mk("var(--ok)",(C*pct)+" "+C));
  const label=h("b",{style:"position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.78rem"},val+"/"+goal);
  box.append(sv,label);
  return box;
}
function updateDaymeter(){
  const top=document.getElementById("daymeter"),side=document.getElementById("side-day");
  if(!(ME&&ME.role==="student")){ // преподавателю мёртвый мотиватор «0/20» ни к чему
    if(top)top.textContent="";
    if(side)clear(side);
    return;
  }
  const d=dayNow();
  if(top)top.textContent="🔥 "+d.streak+" · "+d.ans+"/"+DAILY_GOAL;
  if(side)clear(side).append(L("Сегодня: ","Today: ","Bugün: "),h("b",{},d.ans+"/"+DAILY_GOAL)," · 🔥 ",h("b",{},String(d.streak)));
}
function progressScore(){return progressScoreFor(VOCAB);} // бар активного модуля
// Мастерство по ВСЕМ модулям (не только активному VOCAB) — для «Мой прогресс».
// Дедуп по id обязателен: resolveVocab отдаёт reuse-слова под id их родного модуля,
// и без Set одно и то же слово посчиталось бы в каждом модуле, где оно переиспользовано.
// Все слова тропы с дедупом по id: resolveVocab отдаёт reuse-слова под id родного модуля,
// и без дедупа одно слово считалось бы в каждом модуле, где переиспользовано. Список
// статичен в пределах сборки, поэтому строится один раз — его гоняют счётчики и панели.
let ALL_CARDS=null;
function allCards(){
  if(!ALL_CARDS){
    const seen=new Set();ALL_CARDS=[];
    for(const mid of CONTENT_READY)for(const c of resolveVocab(CONTENT[mid].vocab,CONTENT)){
      if(seen.has(c.id))continue;
      seen.add(c.id);ALL_CARDS.push(c);
    }
  }
  return ALL_CARDS;
}
function globalMastery(){
  let total=0,mastered=0,inwork=0,skipped=0;
  for(const c of allCards()){
    if(isSkipped(c.id)){skipped++;continue;} // отложенные — отдельной строкой, не в знаменателе
    total++;
    if(isMastered(c.id))mastered++;else if(!isNew(c.id))inwork++;
  }
  return {total,mastered,inwork,skipped};
}

/* ---------- TTS (черновик; кыргызский голос обычно недоступен) ---------- */
let TTS_VOICE=null;
function detectVoice(){
  if(!("speechSynthesis" in window)) return;
  const pick=()=>{const v=speechSynthesis.getVoices().find(v=>/^ky/i.test(v.lang));if(v)TTS_VOICE=v;};
  pick(); speechSynthesis.onvoiceschanged=pick;
}
function speak(text){
  if(!TTS_VOICE) return;
  const u=new SpeechSynthesisUtterance(text);u.voice=TTS_VOICE;u.rate=.85;speechSynthesis.speak(u);
}
detectVoice();

/* ---------- DOM-хелперы (динамический контент — только через textContent) ---------- */
function el(id){return document.getElementById(id);}
function h(tag,attrs,...kids){
  const n=document.createElement(tag);
  for(const k in (attrs||{})){
    if(k==="class")n.className=attrs[k];
    else if(k.startsWith("on"))n.addEventListener(k.slice(2),attrs[k]);
    else if(k==="html")throw new Error("html prop is forbidden");
    else n.setAttribute(k,attrs[k]);
  }
  for(const kid of kids){
    if(kid==null)continue;
    n.append(kid.nodeType?kid:document.createTextNode(String(kid)));
  }
  return n;
}
function clear(node){node.textContent="";return node;}
// как node.append, но молча пропускает null/undefined (нативный append вставил бы текст "null")
function appendKids(node,...kids){for(const k of kids)if(k!=null)node.append(k);return node;}

/* ---------- SVG-иконки (стиль lucide: stroke, currentColor) ---------- */
const SVG_NS="http://www.w3.org/2000/svg";
const ICONS={
  // пузырь сообщения с хвостиком и трубкой внутри — узнаваемый знак мессенджера
  // без логотипа бренда (рисуем теми же штрихами, что остальные иконки)
  whatsapp:["M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z","M9.2 8.4c0 3.4 2.9 6.3 6.3 6.3l.8-1.7-2.2-1-.9 1a5.6 5.6 0 0 1-2.3-2.3l1-.9-1-2.2-1.7.8z"],
  // конверт — знак письма, а не мессенджера: чат на сайте асинхронный
  mail:["M3 6h18v12H3z","M3 6l9 7 9-7"],
  send:["M22 2 11 13","M22 2l-7 20-4-9-9-4z"],       // отправка в композере чата
  back:["M19 12H5","M12 19l-7-7 7-7"],
  home:["M3 10.5 12 3l9 7.5","M5 9.5V21h14V9.5","M9 21v-6h6v6"],
  type:["M4 7V5h16v2","M12 5v14","M9 19h6"],
  mic:["M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z","M19 10v2a7 7 0 0 1-14 0v-2","M12 19v3","M8 22h8"],
  cards:["M12 2 2 7l10 5 10-5-10-5z","M2 17l10 5 10-5","M2 12l10 5 10-5"],
  wave:["M2 12h3l2-7 4 14 3-10 2 3h6"],
  check:["M20 6 9 17l-5-5"],
  sliders:["M4 21v-7","M4 10V3","M12 21v-9","M12 8V3","M20 21v-5","M20 12V3","M1 14h6","M9 12h6","M17 16h6"],
  pen:["M12 20h9","M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"],
  user:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"],
  sun:["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M12 1v2","M12 21v2","M4.2 4.2l1.4 1.4","M18.4 18.4l1.4 1.4","M1 12h2","M21 12h2","M4.2 19.8l1.4-1.4","M18.4 5.6l1.4-1.4"],
  moon:["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  monitor:["M2 4h20v12H2z","M8 20h8","M12 16v4"],
  cloud:["M17.5 19a4.5 4.5 0 1 0 0-9 7 7 0 0 0-13 2.7A4 4 0 0 0 6 19h11.5"],
  warn:["M12 3l10 18H2L12 3z","M12 9v5","M12 17v.5"],
  logout:["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","M16 17l5-5-5-5","M21 12H9"],
  reset:["M23 4v6h-6","M20.5 15a8.5 8.5 0 1 1-2-8.5L23 10"],
  question:["M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3","M12 17v.5"],
  play:["M6 4l14 8-14 8z"],
  pause:["M8 5v14","M16 5v14"],
  plus:["M12 5v14","M5 12h14"],
  key:["M14 10l7-7","M18 3l3 3","M14 10a5 5 0 1 1-7 7 5 5 0 0 1 7-7z"],
  trash:["M3 6h18","M8 6V4h8v2","M6 6l1 15h10l1-15","M10 11v6","M14 11v6"],
  upload:["M12 17V4","M6 10l6-6 6 6","M4 21h16"],
  book:["M4 19.5A2.5 2.5 0 0 1 6.5 17H20","M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"],
  users:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
  lock:["M5 11h14v10H5z","M8 11V7a4 4 0 0 1 8 0v4"],
  shuffle:["M16 3h5v5","M4 20 21 3","M21 16v5h-5","M15 15l6 6","M4 4l5 5"],
  star:["M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3z"],
  flame:["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  calendar:["M8 2v4","M16 2v4","M3 10h18","M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"],
  chart:["M3 3v18h18","M18 17V9","M13 17V5","M8 17v-3"],
  clock:["M12 8v4l3 3","M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"],
  target:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z","M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"]
};
/* ---------- i18n: русский / английский / турецкий интерфейс ---------- */
/* ===I18N=== */
const I18N={
 ru:{app_title:"Кыргыз тили — тренажёр",brand:"Кыргыз тили",brand_sub:"тренажёр кыргызского языка",
  lesson_play:"Слушать урок",lesson_pause:"Пауза",lesson_text_on:"Текст",lesson_text_off:"Текст",lesson_text_hidden:"Текст скрыт — слушайте и повторяйте вслух.",lesson_repeat_now:"Ваша очередь — повторите вслух",lesson_themes:"Темы урока",lesson_again:"Повторить",lesson_again_hint:"Прослушать эту часть ещё раз",lesson_auto:"Автопродолжение",lesson_auto_hint:"Включено — части идут одна за другой; выключено — урок ждёт после каждой, повторяйте сколько нужно",lesson_manual_hint:"Урок ждёт вас: «↻ Повторить» — ещё раз, «▶» — дальше.",vid_hdr:"Видеоурок",lsn_tab_lesson:"Урок",lsn_tab_video:"Видео",vid_share:"Поделиться",vid_copy:"Скопировать ссылку",vid_copied:"Скопировано ✓",vid_dl:"Скачать mp4",vid_yt_ph:"Ссылка YouTube…",vid_yt_save:"Сохранить",vid_shorts:"Шортсы (для соцсетей):",vid_none_teacher:"Роликов пока нет. Соберите локально: node deploy/make-video.js, затем залейте: node deploy/upload-video.js — карточка появится у всех.",lesson_next:"Дальше в модуле",sec_course:"Курс",sec_trial:"Триал",tab_listen:"Аудирование",stt_exp:"эксперимент",stt_off_h:"Аудирование пока не подключено",stt_off_p:"Это дополнительная опция: вы слушаете фразу, повторяете вслух, а тренажёр распознаёт вашу речь и показывает, что получилось. Подключение — у преподавателя.",stt_trial_h:"Недоступно на триальном доступе",stt_trial_p:"Аудирование открывается ученикам с постоянным доступом к курсу. Напишите преподавателю.",stt_intro:"Слушайте фразу и повторяйте её вслух — тренажёр распознает вашу речь и покажет, что совпало. {n} попыток в день.",stt_listen:"Слушать",stt_card_hint:"Повторите слово за диктором — тренажёр распознает вашу речь и покажет совпадение",stt_rec:"Говорить",stt_stop:"Стоп",stt_next:"Дальше",stt_again:"Ещё раз",stt_left:"Осталось сегодня: {n}",stt_said:"Распознано:",stt_score:"Совпадение: {p}%",stt_best:"лучший: {b}%",stt_target:"Фраза:",stt_limit_h:"На сегодня всё",stt_limit_p:"Дневной лимит аудирования исчерпан — возвращайтесь завтра.",stt_mic_err:"Не получилось начать запись — попробуйте ещё раз.",stt_mic_ask:"При первой записи браузер спросит доступ к микрофону — нажмите «Разрешить». В установленном приложении разрешение спрашивается отдельно.",stt_mic_denied:"Доступ к микрофону запрещён. Нажмите значок замка в адресной строке → Микрофон → Разрешить, затем обновите страницу.",stt_mic_denied_pwa:"Доступ к микрофону запрещён. В установленном приложении: откройте learn.kg в обычном браузере, разрешите микрофон (замок в адресной строке), затем вернитесь в приложение. На iPhone: Настройки → Приложения → ваш браузер → Микрофон.",stt_mic_none:"Микрофон не найден. Подключите гарнитуру или выберите другое устройство ниже.",stt_mic_https:"Запись работает только по HTTPS в современном браузере.",stt_mic_pick:"Микрофон:",stt_mic_default:"Системный по умолчанию",stt_self:"Моя запись",stt_later:"Позже",stt_later_hint:"Отложить фразу — она вернётся в конце сегодняшнего набора",stt_mastered:"эта фраза вам уже удавалась полностью",stt_mastered_n:"Освоено фраз (сказаны без ошибок): {n}",stt_self_hint:"Прослушать, как вы сказали (последняя запись)",stt_sending:"распознаю…",stt_great:"Отлично! Всё совпало.",stt_close:"Почти! Сверьте подсвеченные слова.",stt_try:"Не совпало — послушайте ещё раз и повторите.",stt_focus:"Обратите внимание:",stt_listen_first:"Сначала прослушайте фразу",stt_demo_h:"Доступно ученикам курса",stt_demo_p:"В демо аудирование не работает: распознавание речи — персональная опция курса. Так это выглядит у учеников.",stt_ask:"Запросить у Алтынай",stt_wa_text:"Здравствуйте! Хочу подключить аудирование (распознавание речи) в тренажёре learn.kg.",b1_show_tr:"перевод",stt_sounds:"Потренируйте звуки:",wa_fab_label:"Написать преподавателю",wa_fab_wa:"Написать в WhatsApp",wa_fab_text:"Здравствуйте! Пишу из тренажёра learn.kg — хочу спросить про занятия.",wa_fab_text_user:"Здравствуйте! Это {u} из тренажёра learn.kg. У меня вопрос:",stt_b_phrases:"Фразы дня",stt_b_vowels:"Гласные",stt_b_consonants:"Согласные",stt_c_soft:"Второй ряд слов — мягкие: там та же буква звучит обычно, не в глубине горла.",stt_b_endings:"Окончания",stt_e_intro:"Выберите окончание: прочитайте, как оно работает, послушайте фразы с ним и повторите вслух.",stt_e_words:"Фразы с этим окончанием:",stt_e_pol:"Второй ряд фраз — вежливое «Вы»: то же окончание, но на конце «з».",stt_e_dev:"После глухого согласного частица оглушается: «б» превращается в «п» — кыргызбы, но оруспу.",stt_e_lesson:"Подробно в уроке:",stt_v_intro:"Выберите звук: прочитайте, как он произносится, послушайте слова с ним и повторите вслух.",stt_v_long:"Долгий звук — та же буква дважды: держите его заметно дольше, долгота меняет смысл (сат «продай» — саат «час»).",stt_v_words:"Слова с этим звуком:",stt_snd:"Звук в словах курса:",stt_key_space:"Пробел",trial_until:"до {d}",trial_hint:"Пробный доступ: после даты занятия закроются, результаты останутся видны",sec_teacher:"Преподаватель",tab_overview:"Обзор",tab_lessons:"Уроки",tab_cards:"Карточки",tab_test:"Мини-тест",tab_howto:"Как готовиться",tab_grp_format:"Тренировка навыков",howto_hdr:"Методика подготовки",exam_tr_intro:"Тренировка одной части — тот же интерфейс и таймер, что в итоговой проверке курса. Результат сюда не записывается: это репетиция, а не попытка.",exam_tr_start:"Начать тренировку",exam_tr_again:"Ещё раз",exam_tr_note:"Время ограничено, как в итоговой проверке. Прервать можно в любой момент — уйдите на другой раздел.",tab_exam:"Итоговая проверка",fd_exam:"итоговая проверка",fd_exam_time:"время вышло",fd_train:"тренажёр",fd_work:"работа отправлена",fd_work_sent:"{n} предложений",fd_graded:"оценено",exam_hdr:"Итоговая проверка курса {lvl}",exam_w_ask:"Напишите текст на тему:",exam_w_size:"Объём — {a}–{b} предложений.",exam_w_check:"Проверьте себя перед отправкой",exam_w_cnt:"Предложений: {n}",exam_w_cnt_qs:"Ответов: {n} из {q}",exam_w_short_qs:"Пока {n} — ответьте на все {q} вопросов, каждый ответ с новой строки.",exam_foreign:"Сейчас идёт ваша итоговая проверка {lvl} — она продолжается на своей неделе.",exam_foreign_go:"Перейти к нему",exam_w_short:"Пока {n} — нужно {a}–{b} предложений.",exam_send:"Отправить преподавателю",exam_w_err:"Не отправилось — попробуйте ещё раз.",exam_s_ask:"Расскажите на тему:",exam_s_size:"Рассказ на {a}–{b} секунд.",exam_s_rec:"Идёт запись…",exam_s_len:"Записано: {s} с",exam_s_up:"Отправляю…",exam_skip:"Пропустить",exam_sent_note:"работа у преподавателя, балл появится после проверки",exam_skipped_note:"пропущено — без этой части итоговая проверка неполная",exam_works_hdr:"Работы итоговой проверки",exam_wk_score:"Балл",exam_wk_save:"Сохранить",exam_wk_pending:"ждёт проверки",exam_wk_none:"Работ пока нет",exam_pitch:"Задания каждый раз новые: семь типов, выборка из всего курса {lvl}. После каждого ответа — разбор с правилом.",exam_now:"Сейчас доступны:",exam_nm:"{n} заданий, {m} минут",exam_warn:"Части идут подряд, у каждой свой таймер. Вернуться к предыдущему заданию нельзя.",exam_calib:"Это тренировка курса, а не прогноз балла официального тестирования. Процент — доля верных ответов в заданиях с автопроверкой; письмо и речь оценивает преподаватель.",exam_ok:"Верно",exam_no:"Неверно",exam_right:"Правильный ответ:",exam_from:"Из модуля:",exam_next:"Дальше",exam_ask_drill:"Выберите верную форму:",exam_ask_reply:"Выберите ответ на реплику:",exam_ask_def:"О каком слове речь?",exam_ask_cloze:"Вставьте пропущенное слово:",exam_ask_order:"Восстановите порядок слов:",exam_ask_odd:"Найдите лишнее:",exam_ask_text:"Ответьте по тексту:",exam_listen:"Прослушать",exam_uguu_hint:"Текст не показывается — слушайте. Прослушать можно {n} раза.",exam_start:"Начать проверку",exam_again:"Пройти ещё раз",exam_c_sub:"Субтест",exam_c_mod:"Модуль",exam_c_res:"Результат",exam_st_soon:"готовим",exam_q:"Задание {n} из {t}",exam_left:"Осталось: {t}",exam_res:"Верно {r} из {t}",exam_last:"Прошлая попытка: {p}% ({d})",exam_timeup:"Время этой части вышло — она закрыта.",exam_weak:"Где просело",exam_w_chk:"ответ на каждый вопрос — полным предложением · сказуемое в конце предложения · слова и формы из модулей курса, а не перевод с русского",exam_qs_topic:"Ответы на вопросы курса",exam_s_hint:"Говорите в микрофон; когда закончите, остановите запись и отправьте ответ.",exam_s_qs:"Ответьте на вопросы вслух по порядку — одной записью.",exam_w_qs:"Ответьте на вопросы письменно: каждый ответ — полным предложением, с новой строки.",exam_site:"Формат, уровни и запись на тестирование — на официальном сайте:",exam_disclaimer:"Задания составлены learn.kg по материалам курса. Они не являются заданиями официального тестирования по кыргызскому языку и не связаны с ними.",
  next_course_note:"Курс {c}: доступ открывает преподаватель — напишите Алтынай в WhatsApp.",next_course_btn:"Продолжить обучение",
  tab_review:"Вычитка",tab_students:"Ученики",tab_metodika:"Методика",tab_settings:"Настройки",
  more_modules:"Ещё {n} модулей…",collapse:"Свернуть список ▴",unlock_after:"Откроется после мини-теста ",
  locked_by_teacher:"Закрыт преподавателем",content_soon:"Контент готовится",
  st_passed:"сдан",st_open:"открыт",st_locked:"закрыт",st_locked_t:"закрыт преподавателем",
  lbl_progress:"Прогресс",lbl_inwork:"в работе",lbl_done1:"пройдено",lbl_mastered:"закреплено",lbl_queue:"очередь сессии",stat_done1:"в обороте (была хотя бы одна попытка ввода)",
  stat_progress:"общий прогресс",stat_progress_hint:"Сумма боксов Лейтнера всех карточек / максимум (3 на карточку)",stat_inwork:"в работе",stat_fixing:"исправляются (ошибка или подсказка — вернутся в порцию)",stat_mastered:"закреплено (верные вводы с интервалом в днях)",stat_test:"мини-тест",stat_voiced:"фраз озвучено",
  dict:"Словарь модуля",vi_fix:"исправляется",vi_new:"новое",vi_learn:"учится",vi_done:"✓ освоено",
  mode_rec:"режим: узнавание",mode_type:"режим: ввод (набери по-кыргызски)",btn_check:"Проверить",btn_show:"Показать ответ",
  fb_wrong:"Пока нет. Правильно: ",fb_try:"Пока нет — исправь и нажми «Проверить» ещё раз. Нужен ответ — кнопка «Показать ответ».",fb_reveal_1:"Ответ: ",fb_hide_1:" — запомни! Скроется через ",fb_hide_2:" с — потом напиши по памяти.",
  session_done:"Сессия закончена. Пройдено: {d}/{t}, закреплено: {m}. Возвращайся завтра — интервалы повторения [1, 3, 7, 16] дней.",more_cards:"Ещё порция",
  drill_task:"Задание",drill_correct:"верно",drill_again:"Ещё серия",drill_goal_ok:"Отлично — цель ≥{g} достигнута.",drill_goal_no:"Цель ≥{g} из {t} — перечитай правило и попробуй снова.",
  drill_topic:"Группа блоком, затем вперемешку:",drill_rule:"Правило:",
  audio_slow_hint:"Медленно (0.5×)",
  rec_wrong:"Пока нет — выбери другой вариант.",rec_hint:"«{o}» — это ",
  cards_marked:"На запоминание",mark_hint:"Отметить «на запоминание» — заниматься ими отдельной темой",
  test_start:"Начать тест",test_q:"Задание",test_what:"Что означает:",test_write:"Напиши по-кыргызски:",test_row:"Ряд гласных:",test_harm:"Выбери гармоничную форму:",test_answer:"Ответить",
  q_hard:"твёрдый (задний): а, ы, о, у",q_soft:"мягкий (передний): э/е, и, ө, ү",q_hard_s:"твёрдый ряд",q_soft_s:"мягкий ряд",
  settings_theme:"Тема оформления",th_light:"Светлая",th_dark:"Тёмная",th_auto:"Системная",
  settings_audio:"Аудио",ap_on:"Автоозвучка",ap_off:"Тишина",
  set_autoplay_note:"Когда включена автоозвучка, фраза играет сама при показе карточки и после верного ответа. Кнопки ▶ работают в любом случае.",
  know_hint:"Слово закрепится сразу и вернётся на подтверждение через 7 дней",
  know_fb:"Закреплено — подтверждение через 7 дней",
  skip_hint:"Убрать из колод — вернуть можно в списке «Отложенные»",skip_fb:"Отложено — вернуть можно в «Мой прогресс»",
  sp_skipped:"Отложенные слова",sp_skipped_empty:"Отложенных слов нет.",skip_return:"Вернуть",
  pg_skipped:"отложено: {n} — посмотреть",pg_decide:"решения о словах: «уже знаю» {k}, отложено {s}",
  fd_know:"уже знаю",fd_skip:"отложил",fd_skip_off:"вернул в колоду",fd_mark:"на запоминание",fd_mark_off:"снял отметку",
  cards_practice_note:"Очередь на сегодня пуста — это дополнительная практика: уровни слов не растут, интервалы не сокращаются.",
  settings_lang:"Язык интерфейса",settings_account:"Аккаунт",logged_as:"Вы вошли как: ",logout:"Выйти",settings_data:"Данные",reset_btn:"Сбросить прогресс ",
  role_student:"ученик",role_teacher:"преподаватель",role_admin:"администратор",
  sync_ok:"синхронизировано",sync_err:"синк недоступен",sync_local:"локальный режим",sync_demo:"демонстрационный режим",
  banner_draft:"Вычитано преподавателем: {d}/{t}{q} — в зачётный мини-тест входят только вычитанные фразы.",banner_q:" (вопросов: {q})",banner_ok:"Все фразы модуля вычитаны преподавателем ({d}/{t}) — мини-тест в полном объёме.",
  rev_todo:"Вычитывается",rev_done:"Вычитано",rev_q:"Вопросы",rev_checked:"Проверено",
  test_locked_review:"Зачётный мини-тест откроется после вычитки: преподаватель проверил {d}/{t} фраз (нужно ≥{n}). Карточки и дриллы доступны уже сейчас.",test_start_preview:"Превью (модуль ещё вычитывается)",
  test_intro:"20 заданий без подсказок: 8 на узнавание фраз, 6 на ввод с клавиатуры, 6 на дрилл модуля. Порог — 16/20 (80%, методика §7.2). ",
  test_last:"Последняя попытка: {s}/{t} ({p}) от {d}.",test_passed_w:"сдана",test_failed_w:"не сдана",
  test_chip_passed:"модуль сдан ✓",test_retake_note:" Пересдача возможна — на статус модуля не влияет.",
  test_res_pass:"тест сдан ✓",test_res_fail:"ниже порога {th}/{t}.",
  test_first_pass:" {num} сдан! Следующий модуль добавлен в вашу тропу — контент готовится и откроется после вычитки.",
  test_retake:" Пересдача — на статус модуля не влияет.",
  test_fail2:" Второй провал подряд — поговорите с преподавателем: возможно, стоит повторить неделю или сменить темп (методика §7.2).",
  test_fail1:" Повтори слабые места и вернись завтра (методика §7.2).",
  test_local:"Результат сохранён локально — статусы модулей обновятся при появлении связи.",
  btn_close:"Закрыть",
  cards_instruction:"Новая карточка проходит два шага в одной сессии: «Узнавание» (видишь фразу — выбираешь перевод), затем тут же «Ввод» (печатаешь фразу по памяти, клавиатура ө/ү/ң под полем). В следующие дни — только «Ввод» по интервалам [1, 3, 7, 16]. Освоено = верные вводы с интервалами.",
  cards_hdr:"Карточки — фразы модуля",cards_help_tgl:"Как это работает и выбор темы",cards_mix:"Вперемешку",cards_topic:"Тема блоком, затем вперемешку (методика §4, принцип 4):",
  stub_revoked_hdr:"Курс закрыт",stub_revoked_txt:"{mod} входит в курс, который вам больше не выдан. Свои результаты по нему вы видите в «Моём прогрессе», занятия закрыты — свяжитесь с преподавателем.",
  stub_locked_hdr:"Модуль закрыт преподавателем",stub_locked_txt:"{mod} закрыт на повтор. Свяжитесь с преподавателем — после открытия обновите страницу.",
  stub_soon_txt:"Контент модуля готовится и появится после вычитки преподавателем. А пока продолжайте повторять карточки предыдущих модулей — интервальные повторения не ждут.",
  set_theme_note:"«Системная» следует настройке ОС. Выбор сохраняется в профиле и применяется на всех устройствах.",
  set_acc_note:"Прогресс привязан к логину и хранится на сервере — на любом устройстве под этим логином будет один и тот же прогресс.",
  set_local_note:"Локальный режим (файл открыт без сервера): вход не требуется, прогресс хранится только в этом браузере.",
  rev_btn_ok:"Верно",rev_btn_edit:"Править",rev_btn_q:"Вопрос",rev_listen:"Слушать",rev_gen:"Сгенерить",rev_regen:"Перегенерить",rev_upload:"Залить",rev_audio_ok:"Аудио ок",
  reuse_chip:"из {m}",
  stu_add:"Добавить ученика",stu_pass:"Сменить пароль",stu_del:"Удалить",stu_suspend:"Приостановить доступ",stu_resume:"Возобновить доступ",stu_active:"активен",stu_suspended:"доступ приостановлен",
  tch_section:"Учителя",tch_add:"Добавить учителя",tch_hint:"Учитель видит и может изменять учеников. Добавлять и удалять учителей может только администратор.",tch_del_confirm:"Удалить учителя «{login}»? Вход будет закрыт.",tch_pass_prompt:"Новый пароль для «{login}» (мин. 6 символов):",tch_admin_note:"администратор — доступ меняется правкой users.json",
  stu_pass_prompt:"Новый пароль для «{login}» (мин. 6 символов):",stu_del_confirm:"Удалить ученика «{login}»? Вход будет закрыт. Файл прогресса на сервере останется.",
  acc_pass_prompt:"Новый пароль (мин. 6 символов):",acc_pass_ok:"пароль обновлён ✓",acc_pass_admin:"Пароль администратора меняется правкой server/users.json и деплоем.",
  own_mine:"Мои ученики",own_none:"Без преподавателя",own_label:"преподаватель:",own_gone:"преподаватель удалён",own_move:"Передать",
  tab_progress:"Мой прогресс",tab_roster:"Успеваемость",
  tab_dialogs:"Диалоги",dlg_hdr:"Диалоги: слушай и понимай",dlg_hint:"Сначала слушай без перевода — цель понять сцену. ▶ у строки играет реплику, «Прослушать часть» ведёт по диалогу с подсветкой. Тап по строке открывает её перевод, кнопка — перевод всей части. После каждой части и песни — вопросы на понимание.",dlg_listen_all:"Прослушать часть",dlg_song_play:"Слушать песню",dlg_amb:"Атмосфера",dlg_stop:"Остановить",dlg_tap_tr:"Тап по строке — её перевод",dlg_show_tr:"Показать перевод",dlg_hide_tr:"Скрыть перевод",dlg_note_hdr:"Запомни: сен и сиз",dlg_quiz_hdr:"Вопросы на понимание",dlg_quiz_hint:"Ответь по содержанию диалогов — без подглядывания в перевод.",dlg_right:"✓ туура! (верно)",dlg_wrong:"✗ туура эмес (неверно)",pg_hello:"Салам, {name}!",pg_continue:"Продолжить",pg_due:"Ждут повторения: {n} {w} · ~{m} мин",pg_due_go:"Повторить {n} {w}",pg_card_forms:"карточка|карточки|карточек",pg_day_forms:"день|дня|дней",pg_mod_forms:"модуль|модуля|модулей",pg_all_done:"Очередь пуста — самое время взять новые слова",pg_today_done:"сегодня: {n} ответов",pg_today_none:"сегодня ещё не занимался — 5 минут хватит",pg_weak_hdr:"Слабые места по мини-тестам",pg_weak_go:"Повторить",test_weak_hdr:"Слабые места",test_sent_note:"Результат уже виден преподавателю — он подскажет, что повторить.",weak_h_row:"сингармонизм: ряд гласной",weak_h_affix:"сингармонизм: выбор аффикса",fd_weak:"слабые места:",
  pg_streak_days:"{n} {w} подряд",pg_streak_best:"личный рекорд: {n} дн.",pg_streak_none:"начни серию сегодня",
  pg_tile_mastered:"слов закреплено",pg_tile_inwork:"в работе",pg_tile_acc:"точность за 7 дней",pg_tile_time:"время за 7 дней",pg_min:"{n} мин",pg_hmin:"{h} ч {m} мин",
  pg_tile_modpassed:"модулей сдано",pg_tile_modopen:"открыто в тропе",
  pg_cal_hdr:"Активность",pg_cal_aria:"Активность за последние недели: {n} дней с занятиями",
  pg_weak_hdr:"Слова, которым нужно внимание",pg_weak_empty:"Слабых слов нет — отличная работа",
  inst_hdr:"Приложение на телефон",inst_p:"Тренажёр ставится как приложение: своя иконка на экране, полный экран без адресной строки и запуск даже без интернета.",inst_btn:"Установить",inst_how:"Как установить вручную →",inst_later:"Хорошо, предложим позже.",
  pg_tests_hdr:"История мини-тестов",pg_tests_hint:"Тап по строке — слабые места попытки, повтор карточек и связь с преподавателем.",pg_tests_empty:"Мини-тестов пока не было",pg_test_nodetails:"Подробности появятся после следующей попытки.",pg_test_write:"Написать преподавателю",pg_test_wa:"Саламатсызбы, Алтынай! Мини-тест {m}: {s}/20. Слабые места: {w}. Подскажите, что повторить?",sp_wrong:"Ошибки",sp_right:"Верно",sp_dyn:"Динамика попыток",sp_boxes:"Распределение по уровням запоминания",sp_go_cards:"→ карточки",sp_go_drill:"→ дриллы",sp_retry_test:"Ещё попытка",sp_gap:"До порога не хватило {n} — повтори слабые места и возвращайся!",pg_test_ok:"сдан",pg_test_retry:"ещё попытка",
  pg_mods_hdr:"Путь по модулям",pg_week_ring:"активных дней недели",pg_week_cmp:"Эта неделя к прошлой: {a} отв. ({da}) · точность {p} ({dp}) · {m} мин ({dm})",cs_fail2:"Мини-тест {num} «{title}» упрямится второй раз — это сигнал разобрать тему вместе с преподавателем, одного занятия обычно хватает.",cs_fail2_wa:"Здравствуйте! Мини-тест модуля {num} «{title}» не даётся — хочу разобрать тему на занятии.",cs_lowacc:"Точность за неделю — {p}%. Похоже, где-то системная ошибка: разбор с преподавателем поможет найти её быстро.",cs_lowacc_wa:"Здравствуйте! Точность ответов упала — хочу разобрать мои ошибки на занятии.",cs_mock:"Впереди экзаменационная неделя {lvl}. По методике перед ней проходят мок-экзамен с наставником — договорись о времени заранее.",cs_mock_wa:"Здравствуйте! Хочу пройти мок-экзамен уровня {lvl} с наставником.",cs_talk:"{num} «{title}» сдан! Тренажёр не учит говорить вслух — закрепи тему разговором с преподавателем.",cs_talk_wa:"Здравствуйте! Сдал(а) модуль {num} «{title}» — хочу разговорную практику по этой теме.",cs_btn_talk:"Написать преподавателю",cs_btn_mock:"Договориться о мок-экзамене",cs_hide:"Скрыть",pg_forecast:"{r} {n} {w} — при текущем ритме финиш ≈ {d}",pg_left_forms:"Остался|Осталось|Осталось",pg_due_chip:"{n} к повторению",bd_hdr:"Вехи",bd_10:"Первые 10 фраз в работе",bd_100:"100 фраз закреплено",bd_500:"500 фраз закреплено",bd_1000w:"1000 фраз закреплено",bd_streak7:"Серия 7 дней",bd_streak30:"Серия 30 дней",bd_streak100:"Серия 100 дней",bd_mod1:"Первый модуль сдан",bd_a1:"Курс A1 пройден",bd_a2:"Первый модуль A2 сдан",bd_1000:"1000 ответов",bd_perfect:"Мини-тест 20/20",pg_privacy:"Твой преподаватель видит этот прогресс и историю занятий.",
  pg_start_hdr:"Ты только начал",pg_start_txt:"Пройди несколько карточек — здесь появится календарь активности и разбор ошибок.",pg_load_err:"Не удалось загрузить прогресс",
  rst_today:"занимались сегодня: {a}/{b}",rst_week:"на этой неделе: {a}/{b}",rst_attention:"требуют внимания: {n}",
  rst_f_all:"Все",rst_f_mine:"Мои",rst_f_attention:"Требуют внимания",rst_f_active:"Активные сегодня",rst_search:"Поиск по логину…",
  rst_c_student:"Ученик",rst_c_last:"Активность",rst_c_streak:"Серия",rst_c_progress:"Прогресс",rst_c_acc:"Точность 7д",rst_c_tests:"Тесты",rst_c_flags:"Сигналы",
  rst_never:"ни разу",rst_today_w:"сегодня",rst_yesterday:"вчера",rst_ago:"{n} дн. назад",
  rst_flag_idle:"не заходил {n} дн.",rst_flag_never:"ни разу не заходил",rst_flag_fail2:"тест провален 2×",rst_flag_streak:"серия {n} дн.",
  rst_p_today:"Занимались сегодня",rst_p_week:"Занимались на этой неделе",rst_p_attention:"Требуют внимания",
  rst_p_empty:"Пока никого",rst_p_close:"Закрыть",rst_p_hint:"Нажмите на ученика, чтобы открыть карточку",
  rst_open:"Открыть",rst_back:"← к списку",rst_empty:"Пока нет ни одного ученика",
  fd_hdr:"Лента занятий",fd_all:"Все",fd_t_cards:"Карточки",fd_t_test:"Тесты и экзамен",fd_t_drill:"Сингармонизм",fd_t_ui:"Интерфейс",fd_t_listen:"Аудирование и уроки",
  fd_p_7:"7 дней",fd_p_30:"30 дней",fd_p_all:"Всё",fd_more:"Показать ещё",fd_empty:"Записей пока нет",
  fd_sess:"{d} · {n} мин · {a} ответов · {p}%",fd_c_time:"Время",fd_c_card:"Карточка",fd_c_answer:"Ответ",
  ev_notice_txt:"Мы записываем ход занятий (ответы, время, подсказки) — это видит твой преподаватель. Подробнее в политике конфиденциальности.",ev_notice_ok:"Понятно",
  demo_banner:"Это демо: {n} фраз из {total}. Полный доступ открывает преподаватель.",
  tab_inbox:"Сообщения",
  ch_title:"Написать преподавателю",ch_intro:"Напишите здесь — преподаватель ответит в этом же окне.",
  ch_ph:"Ваше сообщение…",ch_contact_ph:"Как с вами связаться (необязательно)",
  ch_send:"Отправить",ch_sent_note:"Ответ появится здесь — загляните позже.",
  ch_wa:"WhatsApp",ch_empty:"Здесь пока пусто — напишите первое сообщение.",
  ch_you:"Вы",ch_teacher:"Преподаватель",ch_close:"Закрыть",ch_err:"Не отправилось — попробуйте ещё раз.",
  ib_hdr:"Сообщения",ib_unread:"Непрочитанные",ib_all:"Все",ib_none:"Сообщений нет.",
  ib_visitor:"Гость",ib_reply:"Ответить",ib_reply_ph:"Ответ ученику…",ib_back:"← К списку",
  ib_contact:"Контакт",ib_page:"Страница",fd_chat:"сообщение",
  demo_wa:"Написать в WhatsApp",
  demo_wa_text:"Здравствуйте! Попробовал(а) демо на learn.kg — хочу учить кыргызский (уровень A1).",
  demo_test_intro:"Демо-тест: 10 заданий без подсказок — узнавание, ввод и сингармонизм. Порог — 8/10.",
  demo_end:"Понравилось? В полном курсе — 12 модулей, звук к каждой фразе, интервальные повторения и ежедневный план.",
  demo_local_note:"Это демо-режим: прогресс живёт только в этом браузере и не сохраняется на сервере. Полный доступ открывает преподаватель."},
 en:{app_title:"Kyrgyz Language — Trainer",brand:"Кыргыз тили",brand_sub:"Kyrgyz language trainer",
  lesson_play:"Play lesson",lesson_pause:"Pause",lesson_text_on:"Text",lesson_text_off:"Text",lesson_text_hidden:"Text hidden — listen and repeat aloud.",lesson_repeat_now:"Your turn — repeat aloud",lesson_themes:"Lesson topics",lesson_again:"Repeat",lesson_again_hint:"Play this part once more",lesson_auto:"Autoplay",lesson_auto_hint:"On — the parts follow one another; off — the lesson waits after each one, repeat as many times as you need",lesson_manual_hint:"The lesson is waiting for you: “↻ Repeat” to hear it again, “▶” to move on.",vid_hdr:"Video lesson",lsn_tab_lesson:"Lesson",lsn_tab_video:"Video",vid_share:"Share",vid_copy:"Copy link",vid_copied:"Copied ✓",vid_dl:"Download mp4",vid_yt_ph:"YouTube link…",vid_yt_save:"Save",vid_shorts:"Shorts (for social media):",vid_none_teacher:"No videos yet. Build locally: node deploy/make-video.js, then upload: node deploy/upload-video.js — the card will appear for everyone.",lesson_next:"Next in this module",sec_course:"Course",sec_trial:"Trial",tab_listen:"Listening",stt_exp:"experimental",stt_off_h:"Listening practice is not enabled yet",stt_off_p:"An add-on option: you listen to a phrase, repeat it aloud, and the trainer recognises your speech and shows how close you were. Ask your teacher to enable it.",stt_trial_h:"Not available on trial access",stt_trial_p:"Listening practice is for students with permanent course access. Contact your teacher.",stt_intro:"Listen to the phrase and repeat it aloud — the trainer recognises your speech and shows what matched. {n} attempts per day.",stt_listen:"Listen",stt_card_hint:"Repeat the word after the speaker — the trainer recognises your speech and shows the match",stt_rec:"Speak",stt_stop:"Stop",stt_next:"Next",stt_again:"Try again",stt_left:"Left today: {n}",stt_said:"Recognised:",stt_score:"Match: {p}%",stt_best:"best: {b}%",stt_target:"Phrase:",stt_limit_h:"That is all for today",stt_limit_p:"The daily listening limit is used up — come back tomorrow.",stt_mic_err:"Could not start recording — please try again.",stt_mic_ask:"On the first recording the browser will ask for microphone access — tap Allow. In the installed app the permission is asked separately.",stt_mic_denied:"Microphone access is blocked. Tap the lock icon in the address bar → Microphone → Allow, then reload the page.",stt_mic_denied_pwa:"Microphone access is blocked. In the installed app: open learn.kg in your regular browser, allow the microphone (lock icon in the address bar), then return to the app. On iPhone: Settings → Apps → your browser → Microphone.",stt_mic_none:"No microphone found. Plug in a headset or pick another device below.",stt_mic_https:"Recording only works over HTTPS in a modern browser.",stt_mic_pick:"Microphone:",stt_mic_default:"System default",stt_self:"My recording",stt_later:"Later",stt_later_hint:"Put the phrase off — it will return at the end of today's set",stt_mastered:"you have already nailed this phrase",stt_mastered_n:"Phrases mastered (said with no mistakes): {n}",stt_self_hint:"Listen to how you said it (last recording)",stt_sending:"recognising…",stt_great:"Excellent! Everything matched.",stt_close:"Almost! Check the highlighted words.",stt_try:"No match — listen again and repeat.",stt_focus:"Pay attention to:",stt_listen_first:"Listen to the phrase first",stt_demo_h:"Available to course students",stt_demo_p:"Speech recognition is a personal course option and does not run in the demo. This is how it looks for students.",stt_ask:"Ask Altynai",stt_wa_text:"Hello! I would like to enable listening practice (speech recognition) in the learn.kg trainer.",b1_show_tr:"translation",stt_sounds:"Practise the sounds:",wa_fab_label:"Message the teacher",wa_fab_wa:"Write on WhatsApp",wa_fab_text:"Hello! I am writing from the learn.kg trainer — I have a question about the lessons.",wa_fab_text_user:"Hello! This is {u} from the learn.kg trainer. My question:",stt_b_phrases:"Daily phrases",stt_b_vowels:"Vowels",stt_b_consonants:"Consonants",stt_c_soft:"The second row is the front-vowel words: there the same letter is made in its ordinary place, not deep in the throat.",stt_b_endings:"Endings",stt_e_intro:"Pick an ending: read how it works, listen to phrases that carry it and repeat them aloud.",stt_e_words:"Phrases with this ending:",stt_e_pol:"The second row is the polite “you”: the same ending, but finishing in з.",stt_e_dev:"After a voiceless consonant the particle devoices: б turns into п — кыргызбы, but оруспу.",stt_e_lesson:"Explained in the lesson:",stt_v_intro:"Pick a sound: read how it is made, listen to words with it and repeat them aloud.",stt_v_long:"A long sound is the same letter doubled: hold it noticeably longer — length changes meaning (sat “sell” — saat “hour”).",stt_v_words:"Words with this sound:",stt_snd:"The sound in course words:",stt_key_space:"Space",trial_until:"until {d}",trial_hint:"Trial access: after this date lessons close, your results stay visible",sec_teacher:"Teacher",tab_overview:"Overview",tab_lessons:"Lessons",tab_cards:"Flashcards",tab_test:"Quiz",tab_howto:"How to prepare",tab_grp_format:"Skill practice",howto_hdr:"Preparation method",exam_tr_intro:"Practice one part on its own — the same interface and clock as in the course final check. The result is not recorded here: this is a rehearsal, not an attempt.",exam_tr_start:"Start the drill",exam_tr_again:"Once more",exam_tr_note:"Time is limited, as in the final check. You may stop any time — just leave for another section.",tab_exam:"Final check",fd_exam:"final check",fd_exam_time:"time was up",fd_train:"drill",fd_work:"work sent",fd_work_sent:"{n} sentences",fd_graded:"graded",exam_hdr:"{lvl} course final check",exam_w_ask:"Write a text on the topic:",exam_w_size:"Length — {a}–{b} sentences.",exam_w_check:"Check yourself before sending",exam_w_cnt:"Sentences: {n}",exam_w_cnt_qs:"Answers: {n} of {q}",exam_w_short_qs:"Only {n} so far — answer all {q} questions, each on a new line.",exam_foreign:"Your {lvl} final check is in progress — it continues on its own week.",exam_foreign_go:"Go to it",exam_w_short:"Only {n} so far — {a}–{b} sentences are needed.",exam_send:"Send to the teacher",exam_w_err:"Sending failed — try again.",exam_s_ask:"Speak on the topic:",exam_s_size:"A talk of {a}–{b} seconds.",exam_s_rec:"Recording…",exam_s_len:"Recorded: {s} s",exam_s_up:"Sending…",exam_skip:"Skip",exam_sent_note:"the work is with your teacher; the score appears after review",exam_skipped_note:"skipped — the final check is incomplete without this part",exam_works_hdr:"Final check works",exam_wk_score:"Score",exam_wk_save:"Save",exam_wk_pending:"awaiting review",exam_wk_none:"No works yet",exam_pitch:"The tasks are new every time: seven types drawn from the whole {lvl} course. After every answer — a breakdown with the rule.",exam_now:"Available now:",exam_nm:"{n} tasks, {m} minutes",exam_warn:"The parts run one after another, each with its own clock. There is no going back to a previous task.",exam_calib:"This is course practice, not a forecast of an official test score. The percentage is the share of correct answers in the auto-checked tasks; writing and speaking are graded by the teacher.",exam_ok:"Correct",exam_no:"Wrong",exam_right:"The correct answer:",exam_from:"From module:",exam_next:"Next",exam_ask_drill:"Choose the correct form:",exam_ask_reply:"Choose the reply to this line:",exam_ask_def:"Which word is described?",exam_ask_cloze:"Fill in the missing word:",exam_ask_order:"Put the words in order:",exam_ask_odd:"Find the odd one out:",exam_ask_text:"Answer from the text:",exam_listen:"Listen",exam_uguu_hint:"The text is hidden — listen. You may play it {n} times.",exam_start:"Start the check",exam_again:"Take it again",exam_c_sub:"Subtest",exam_c_mod:"Module",exam_c_res:"Result",exam_st_soon:"in progress",exam_q:"Task {n} of {t}",exam_left:"Left: {t}",exam_res:"{r} correct out of {t}",exam_last:"Previous attempt: {p}% ({d})",exam_timeup:"Time for this part is up — it is closed.",exam_weak:"Where it slipped",exam_w_chk:"every answer is a full sentence · the verb comes at the end of the sentence · words and forms from the course modules, not a translation from English",exam_qs_topic:"Answers to course questions",exam_s_hint:"Speak into the microphone; when you finish, stop the recording and send your answer.",exam_s_qs:"Answer the questions aloud, in order — in one recording.",exam_w_qs:"Answer the questions in writing: each answer a full sentence, on a new line.",exam_site:"Format, levels and registration — on the official testing website:",exam_disclaimer:"The tasks are written by learn.kg from the course materials. They are not tasks of the official Kyrgyz language test and are not related to them.",
  next_course_note:"Course {c}: the teacher opens the way forward — message Altynai on WhatsApp.",next_course_btn:"Continue learning",
  tab_review:"Proofreading",tab_students:"Students",tab_metodika:"Methodology",tab_settings:"Settings",
  more_modules:"{n} more modules…",collapse:"Collapse ▴",unlock_after:"Unlocks after the quiz of ",
  locked_by_teacher:"Locked by teacher",content_soon:"Content coming soon",
  st_passed:"passed",st_open:"open",st_locked:"locked",st_locked_t:"locked by teacher",
  lbl_progress:"Progress",lbl_inwork:"learning",lbl_done1:"done",lbl_mastered:"consolidated",lbl_queue:"session queue",stat_done1:"in circulation (at least one typing attempt)",stat_fixing:"being corrected (slip or reveal — back in the next batch)",
  stat_progress:"overall progress",stat_progress_hint:"Sum of Leitner boxes across all cards / max (3 per card)",stat_inwork:"learning",stat_mastered:"consolidated (correct answers spaced over days)",stat_test:"quiz",stat_voiced:"phrases voiced",
  dict:"Module vocabulary",vi_fix:"being corrected",vi_new:"new",vi_learn:"learning",vi_done:"✓ mastered",
  mode_rec:"mode: recognition",mode_type:"mode: typing (type in Kyrgyz)",btn_check:"Check",btn_show:"Show answer",
  fb_wrong:"Not yet. Correct: ",fb_try:"Not yet — fix it and press “Check” again. Need the answer? Use “Show answer”.",fb_reveal_1:"Answer: ",fb_hide_1:" — memorise it! Hides in ",fb_hide_2:" s — then type from memory.",
  session_done:"Session finished. Done: {d}/{t}, consolidated: {m}. Come back tomorrow — spaced repetition intervals are [1, 3, 7, 16] days.",more_cards:"More cards",
  drill_task:"Task",drill_correct:"correct",drill_again:"New round",drill_goal_ok:"Great — the ≥{g} goal is reached.",drill_goal_no:"Goal is ≥{g} of {t} — review the rule and try again.",
  drill_topic:"One group first, then mixed:",drill_rule:"Rule:",
  audio_slow_hint:"Slow (0.5×)",
  rec_wrong:"Not yet — pick another option.",rec_hint:"“{o}” is ",
  cards_marked:"To memorize",mark_hint:"Mark “to memorize” — practice them as a separate topic",
  test_start:"Start quiz",test_q:"Task",test_what:"What does it mean:",test_write:"Write in Kyrgyz:",test_row:"Vowel class:",test_harm:"Pick the harmonic form:",test_answer:"Answer",
  q_hard:"back (hard): а, ы, о, у",q_soft:"front (soft): э/е, и, ө, ү",q_hard_s:"back vowels",q_soft_s:"front vowels",
  settings_theme:"Theme",th_light:"Light",th_dark:"Dark",th_auto:"System",
  settings_audio:"Audio",ap_on:"Autoplay",ap_off:"Silent",
  set_autoplay_note:"With autoplay on, the phrase sounds by itself when a card appears and after a correct answer. The ▶ buttons work either way.",
  know_hint:"Consolidates the word right away; it comes back for confirmation in 7 days",
  know_fb:"Consolidated — confirmation in 7 days",
  skip_hint:"Removes the word from decks — bring it back from the “Set aside” list",skip_fb:"Set aside — bring it back from “My progress”",
  sp_skipped:"Set-aside words",sp_skipped_empty:"No set-aside words.",skip_return:"Bring back",
  pg_skipped:"set aside: {n} — view",pg_decide:"decisions about words: “I know this” {k}, set aside {s}",
  fd_know:"knows it",fd_skip:"set aside",fd_skip_off:"back in the deck",fd_mark:"to memorise",fd_mark_off:"unmarked",
  cards_practice_note:"Today’s queue is empty — this is extra practice: word levels don’t grow and intervals don’t shrink.",
  settings_lang:"Interface language",settings_account:"Account",logged_as:"Signed in as: ",logout:"Sign out",settings_data:"Data",reset_btn:"Reset progress ",
  role_student:"student",role_teacher:"teacher",role_admin:"admin",
  sync_ok:"synced",sync_err:"sync unavailable",sync_local:"local mode",sync_demo:"demo mode",
  banner_draft:"Proofread by the teacher: {d}/{t}{q} — the graded quiz uses proofread phrases only.",banner_q:" (questions: {q})",banner_ok:"All module phrases proofread by the teacher ({d}/{t}) — the quiz is at full strength.",
  rev_todo:"To proofread",rev_done:"Proofread",rev_q:"Questions",rev_checked:"Checked",
  test_locked_review:"The graded quiz opens after proofreading: the teacher has checked {d}/{t} phrases (≥{n} needed). Cards and drills are already available.",test_start_preview:"Preview (module still being proofread)",
  test_intro:"20 tasks, no hints: 8 recognition, 6 typing, 6 module drill. Pass mark — 16/20 (80%, methodology §7.2). ",
  test_last:"Last attempt: {s}/{t} ({p}) on {d}.",test_passed_w:"passed",test_failed_w:"failed",
  test_chip_passed:"module passed ✓",test_retake_note:" Retakes are allowed and do not affect the module status.",
  test_res_pass:"quiz passed ✓",test_res_fail:"below the {th}/{t} mark.",
  test_first_pass:" {num} passed! The next module is added to your path — its content opens after proofreading.",
  test_retake:" A retake — does not affect the module status.",
  test_fail2:" Second fail in a row — talk to your teacher: maybe repeat the week or change the pace (methodology §7.2).",
  test_fail1:" Review the weak spots and come back tomorrow (methodology §7.2).",
  test_local:"The result is saved locally — module statuses will update when the connection is back.",
  btn_close:"Close",
  cards_instruction:"A new card goes through two steps in one session: “Recognition” (see the phrase — pick the meaning), then immediately “Typing” (type the phrase from memory; the ө/ү/ң keyboard is under the field). On following days — “Typing” only, at intervals [1, 3, 7, 16]. Mastered = correct typed answers spaced over days.",
  cards_hdr:"Flashcards — module phrases",cards_help_tgl:"How it works & topic choice",cards_mix:"Mixed",cards_topic:"One topic first, then mixed (methodology §4, principle 4):",
  stub_revoked_hdr:"Course closed",stub_revoked_txt:"{mod} belongs to a course you no longer have. Your results for it stay visible in “My progress”; lessons are closed — contact your teacher.",
  stub_locked_hdr:"Module locked by the teacher",stub_locked_txt:"{mod} is locked for revision. Contact your teacher — refresh the page once it is reopened.",
  stub_soon_txt:"This module’s content is being prepared and will appear after proofreading. Meanwhile keep reviewing flashcards of previous modules — spaced repetition doesn’t wait.",
  set_theme_note:"“System” follows your OS setting. The choice is stored in your profile and applies on all devices.",
  set_acc_note:"Progress is tied to your login and stored on the server — any device with this login sees the same progress.",
  set_local_note:"Local mode (file opened without a server): no sign-in needed, progress lives only in this browser.",
  rev_btn_ok:"Correct",rev_btn_edit:"Edit",rev_btn_q:"Question",rev_listen:"Listen",rev_gen:"Generate",rev_regen:"Regenerate",rev_upload:"Upload",rev_audio_ok:"Approve audio",
  reuse_chip:"from {m}",
  stu_add:"Add student",stu_pass:"Change password",stu_del:"Delete",stu_suspend:"Suspend access",stu_resume:"Resume access",stu_active:"active",stu_suspended:"access suspended",
  tch_section:"Teachers",tch_add:"Add teacher",tch_hint:"Teachers manage students. Only an admin can add or remove teachers.",tch_del_confirm:"Delete teacher “{login}”? Access will be revoked.",tch_pass_prompt:"New password for “{login}” (min. 6 characters):",tch_admin_note:"admin — access is managed by editing users.json",
  stu_pass_prompt:"New password for “{login}” (min. 6 characters):",stu_del_confirm:"Delete student “{login}”? Access will be revoked. The progress file stays on the server.",
  acc_pass_prompt:"New password (min. 6 characters):",acc_pass_ok:"password updated ✓",acc_pass_admin:"An admin password is changed by editing server/users.json and redeploying.",
  own_mine:"My students",own_none:"No teacher",own_label:"teacher:",own_gone:"teacher deleted",own_move:"Reassign",
  tab_progress:"My Progress",tab_roster:"Progress board",
  tab_dialogs:"Dialogues",dlg_hdr:"Dialogues: listen and understand",dlg_hint:"Listen without translation first — the goal is to grasp the scene. ▶ plays a line, “Play the part” walks the dialogue with highlighting. Tap a line for its translation, the button reveals the whole part. Comprehension questions follow each part and song.",dlg_listen_all:"Play the part",dlg_song_play:"Play the song",dlg_amb:"Ambience",dlg_stop:"Stop",dlg_tap_tr:"Tap a line for its translation",dlg_show_tr:"Show translation",dlg_hide_tr:"Hide translation",dlg_note_hdr:"Remember: сен and сиз",dlg_quiz_hdr:"Comprehension questions",dlg_quiz_hint:"Answer from the dialogues — no peeking at the translation.",dlg_right:"✓ туура! (correct)",dlg_wrong:"✗ туура эмес (wrong)",pg_hello:"Hi, {name}!",pg_continue:"Continue",pg_due:"Waiting for review: {n} {w} · ~{m} min",pg_due_go:"Review {n} {w}",pg_card_forms:"card|cards",pg_day_forms:"day|days",pg_mod_forms:"module|modules",pg_all_done:"The queue is empty — time to pick up new words",pg_today_done:"today: {n} answers",pg_today_none:"haven't studied today yet — 5 minutes is enough",pg_weak_hdr:"Weak spots from mini-tests",pg_weak_go:"Review",test_weak_hdr:"Weak spots",test_sent_note:"Your teacher already sees this result and will suggest what to review.",weak_h_row:"vowel harmony: vowel row",weak_h_affix:"vowel harmony: affix choice",fd_weak:"weak spots:",
  pg_streak_days:"{n} {w} in a row",pg_streak_best:"personal best: {n} d.",pg_streak_none:"start a streak today",
  pg_tile_mastered:"words mastered",pg_tile_inwork:"in progress",pg_tile_acc:"accuracy, 7 days",pg_tile_time:"time, 7 days",pg_min:"{n} min",pg_hmin:"{h} h {m} min",
  pg_tile_modpassed:"modules passed",pg_tile_modopen:"open on the path",
  pg_cal_hdr:"Activity",pg_cal_aria:"Activity over the recent weeks: {n} days with study",
  pg_weak_hdr:"Words that need attention",pg_weak_empty:"No weak words — great work",
  inst_hdr:"App on your phone",inst_p:"The trainer installs as an app: its own icon on the home screen, full screen without the address bar, and it opens even offline.",inst_btn:"Install",inst_how:"How to install manually →",inst_later:"Fine — we'll offer again later.",
  pg_tests_hdr:"Quiz history",pg_tests_hint:"Tap a row for the attempt’s weak spots, card review and a message to the teacher.",pg_tests_empty:"No quizzes yet",pg_test_nodetails:"Details will appear after the next attempt.",pg_test_write:"Message the teacher",pg_test_wa:"Hello Altynai! Mini-test {m}: {s}/20. Weak spots: {w}. What should I review?",sp_wrong:"Mistakes",sp_right:"Correct",sp_dyn:"Attempt history",sp_boxes:"Memory level distribution",sp_go_cards:"→ cards",sp_go_drill:"→ drills",sp_retry_test:"Try again",sp_gap:"You were {n} short of the pass mark — review the weak spots and come back!",pg_test_ok:"passed",pg_test_retry:"one more try",
  pg_mods_hdr:"Module path",pg_week_ring:"active days this week",pg_week_cmp:"This week vs last: {a} answers ({da}) · accuracy {p} ({dp}) · {m} min ({dm})",cs_fail2:"The {num} “{title}” quiz has resisted twice — a sign to go through the topic with your teacher; one lesson is usually enough.",cs_fail2_wa:"Hello! The module {num} “{title}” quiz will not give in — I would like to sort the topic out in a lesson.",cs_lowacc:"This week's accuracy is {p}%. It looks like a systematic slip — a session with your teacher will find it quickly.",cs_lowacc_wa:"Hello! My accuracy has dropped — I would like to go over my mistakes in a lesson.",cs_mock:"The {lvl} exam week is ahead. The methodology calls for a mock exam with your mentor first — arrange a time in advance.",cs_mock_wa:"Hello! I would like to take a level {lvl} mock exam with a mentor.",cs_talk:"{num} “{title}” is passed! The trainer cannot teach you to speak aloud — cement the topic in a conversation with your teacher.",cs_talk_wa:"Hello! I have passed module {num} “{title}” — I would like speaking practice on this topic.",cs_btn_talk:"Message the teacher",cs_btn_mock:"Arrange a mock exam",cs_hide:"Hide",pg_forecast:"{n} {w} {r} — at your current pace you finish ≈ {d}",pg_left_forms:"left",pg_due_chip:"{n} to review",bd_hdr:"Milestones",bd_10:"First 10 phrases in progress",bd_100:"100 phrases mastered",bd_500:"500 phrases mastered",bd_1000w:"1000 phrases mastered",bd_streak7:"7-day streak",bd_streak30:"30-day streak",bd_streak100:"100-day streak",bd_mod1:"First module passed",bd_a1:"Course A1 completed",bd_a2:"First A2 module passed",bd_1000:"1000 answers",bd_perfect:"A 20/20 quiz",pg_privacy:"Your teacher can see this progress and study history.",
  pg_start_hdr:"You just started",pg_start_txt:"Go through a few cards — an activity calendar and error review will show up here.",pg_load_err:"Couldn’t load progress",
  rst_today:"studied today: {a}/{b}",rst_week:"this week: {a}/{b}",rst_attention:"need attention: {n}",
  rst_f_all:"All",rst_f_mine:"Mine",rst_f_attention:"Need attention",rst_f_active:"Active today",rst_search:"Search by login…",
  rst_c_student:"Student",rst_c_last:"Activity",rst_c_streak:"Streak",rst_c_progress:"Progress",rst_c_acc:"Accuracy 7d",rst_c_tests:"Quizzes",rst_c_flags:"Signals",
  rst_never:"never",rst_today_w:"today",rst_yesterday:"yesterday",rst_ago:"{n} d. ago",
  rst_flag_idle:"away {n} d.",rst_flag_never:"never signed in",rst_flag_fail2:"quiz failed 2×",rst_flag_streak:"{n}-day streak",
  rst_p_today:"Studied today",rst_p_week:"Studied this week",rst_p_attention:"Need attention",
  rst_p_empty:"Nobody yet",rst_p_close:"Close",rst_p_hint:"Click a student to open their card",
  rst_open:"Open",rst_back:"← back to list",rst_empty:"No students yet",
  fd_hdr:"Study feed",fd_all:"All",fd_t_cards:"Flashcards",fd_t_test:"Quizzes & exam",fd_t_drill:"Harmony",fd_t_ui:"Interface",fd_t_listen:"Listening & lessons",
  fd_p_7:"7 days",fd_p_30:"30 days",fd_p_all:"All",fd_more:"Show more",fd_empty:"No entries yet",
  fd_sess:"{d} · {n} min · {a} answers · {p}%",fd_c_time:"Time",fd_c_card:"Card",fd_c_answer:"Answer",
  ev_notice_txt:"We record the course of your sessions (answers, time, hints) — your teacher can see this. See the privacy policy for details.",ev_notice_ok:"Got it",
  demo_banner:"This is a demo: {n} phrases of {total}. Full access is opened by the teacher.",
  tab_inbox:"Messages",
  ch_title:"Message the teacher",ch_intro:"Write here — the teacher replies in this same window.",
  ch_ph:"Your message…",ch_contact_ph:"How to reach you (optional)",
  ch_send:"Send",ch_sent_note:"The reply will appear here — check back later.",
  ch_wa:"WhatsApp",ch_empty:"Nothing here yet — write the first message.",
  ch_you:"You",ch_teacher:"Teacher",ch_close:"Close",ch_err:"Not sent — please try again.",
  ib_hdr:"Messages",ib_unread:"Unread",ib_all:"All",ib_none:"No messages.",
  ib_visitor:"Visitor",ib_reply:"Reply",ib_reply_ph:"Reply to the student…",ib_back:"← Back to list",
  ib_contact:"Contact",ib_page:"Page",fd_chat:"message",
  demo_wa:"Message on WhatsApp",
  demo_wa_text:"Hello! I tried the demo at learn.kg — I want to learn Kyrgyz (A1 level).",
  demo_test_intro:"Demo quiz: 10 tasks with no hints — recognition, typing and vowel harmony. Pass mark — 8/10.",
  demo_end:"Liked it? The full course has 12 modules, audio for every phrase, spaced repetition and a daily plan.",
  demo_local_note:"This is demo mode: progress lives only in this browser and is not saved to the server. Full access is opened by the teacher."},
 tr:{app_title:"Kırgızca — antrenör",brand:"Кыргыз тили",brand_sub:"Kırgızca antrenörü",
  lesson_play:"Dersi dinle",lesson_pause:"Duraklat",lesson_text_on:"Metin",lesson_text_off:"Metin",lesson_text_hidden:"Metin gizli — dinleyin ve yüksek sesle tekrarlayın.",lesson_repeat_now:"Sıra sizde — yüksek sesle tekrarlayın",lesson_themes:"Ders konuları",lesson_again:"Tekrarla",lesson_again_hint:"Bu bölümü bir kez daha dinle",lesson_auto:"Otomatik devam",lesson_auto_hint:"Açık — bölümler arka arkaya gelir; kapalı — ders her bölümden sonra bekler, istediğiniz kadar tekrar edin",lesson_manual_hint:"Ders sizi bekliyor: «↻ Tekrarla» yeniden dinlemek, «▶» devam etmek için.",vid_hdr:"Video ders",lsn_tab_lesson:"Ders",lsn_tab_video:"Video",vid_share:"Paylaş",vid_copy:"Bağlantıyı kopyala",vid_copied:"Kopyalandı ✓",vid_dl:"mp4 indir",vid_yt_ph:"YouTube bağlantısı…",vid_yt_save:"Kaydet",vid_shorts:"Shorts (sosyal medya için):",vid_none_teacher:"Henüz video yok. Yerelde derleyin: node deploy/make-video.js, sonra yükleyin: node deploy/upload-video.js — kart herkeste görünür.",lesson_next:"Modülde sırada",sec_course:"Kurs",sec_trial:"Deneme",tab_listen:"Dinleme",stt_exp:"deneysel",stt_off_h:"Dinleme alıştırması henüz açık değil",stt_off_p:"Ek bir seçenek: cümleyi dinler, yüksek sesle tekrarlarsınız; sistem konuşmanızı tanır ve ne kadar yaklaştığınızı gösterir. Açmak için öğretmeninize yazın.",stt_trial_h:"Deneme erişiminde kullanılamaz",stt_trial_p:"Dinleme alıştırması kalıcı kurs erişimi olan öğrenciler içindir. Öğretmeninize yazın.",stt_intro:"Cümleyi dinleyin ve yüksek sesle tekrarlayın — sistem konuşmanızı tanır ve eşleşenleri gösterir. Günde {n} deneme.",stt_listen:"Dinle",stt_card_hint:"Kelimeyi konuşmacıdan sonra tekrarlayın — sistem konuşmanızı tanır ve eşleşmeyi gösterir",stt_rec:"Konuş",stt_stop:"Dur",stt_next:"Sonraki",stt_again:"Tekrar dene",stt_left:"Bugün kalan: {n}",stt_said:"Tanınan:",stt_score:"Eşleşme: %{p}",stt_best:"en iyi: %{b}",stt_target:"Cümle:",stt_limit_h:"Bugünlük bu kadar",stt_limit_p:"Günlük dinleme sınırı doldu — yarın devam edin.",stt_mic_err:"Kayıt başlatılamadı — tekrar deneyin.",stt_mic_ask:"İlk kayıtta tarayıcı mikrofon izni isteyecek — İzin ver deyin. Yüklü uygulamada izin ayrıca sorulur.",stt_mic_denied:"Mikrofon erişimi engellendi. Adres çubuğundaki kilit simgesi → Mikrofon → İzin ver, sonra sayfayı yenileyin.",stt_mic_denied_pwa:"Mikrofon erişimi engellendi. Yüklü uygulamada: learn.kg'yi normal tarayıcıda açın, mikrofona izin verin (adres çubuğundaki kilit), sonra uygulamaya dönün. iPhone'da: Ayarlar → Uygulamalar → tarayıcınız → Mikrofon.",stt_mic_none:"Mikrofon bulunamadı. Kulaklık takın ya da aşağıdan başka bir aygıt seçin.",stt_mic_https:"Kayıt yalnızca modern tarayıcıda HTTPS üzerinden çalışır.",stt_mic_pick:"Mikrofon:",stt_mic_default:"Sistem varsayılanı",stt_self:"Kaydım",stt_later:"Sonra",stt_later_hint:"Cümleyi ertele — bugünkü setin sonunda geri gelir",stt_mastered:"bu cümleyi zaten hatasız söylediniz",stt_mastered_n:"Hatasız söylenen cümleler: {n}",stt_self_hint:"Nasıl söylediğinizi dinleyin (son kayıt)",stt_sending:"tanınıyor…",stt_great:"Harika! Hepsi eşleşti.",stt_close:"Az kaldı! Vurgulanan kelimelere bakın.",stt_try:"Eşleşmedi — tekrar dinleyip söyleyin.",stt_focus:"Şuna dikkat edin:",stt_listen_first:"Önce cümleyi dinleyin",stt_demo_h:"Kurs öğrencilerine açık",stt_demo_p:"Konuşma tanıma kişisel bir kurs seçeneğidir ve demoda çalışmaz. Öğrencilerde böyle görünür.",stt_ask:"Altınay'a yazın",stt_wa_text:"Merhaba! learn.kg'de dinleme alıştırmasını (konuşma tanıma) açmak istiyorum.",b1_show_tr:"çeviri",stt_sounds:"Bu sesleri çalışın:",wa_fab_label:"Öğretmene yaz",wa_fab_wa:"WhatsApp'tan yaz",wa_fab_text:"Merhaba! learn.kg uygulamasından yazıyorum — dersler hakkında sorum var.",wa_fab_text_user:"Merhaba! Ben {u}, learn.kg uygulamasından. Sorum:",stt_b_phrases:"Günün cümleleri",stt_b_vowels:"Ünlüler",stt_b_consonants:"Ünsüzler",stt_c_soft:"İkinci sıra ince ünlülü kelimelerdir: orada aynı harf gırtlaktan değil, olağan yerinden çıkar.",stt_b_endings:"Ekler",stt_e_intro:"Bir ek seçin: nasıl işlediğini okuyun, bu eki taşıyan cümleleri dinleyip yüksek sesle tekrarlayın.",stt_e_words:"Bu eki taşıyan cümleler:",stt_e_pol:"İkinci sıra nazik «siz» biçimidir: aynı ek, ama sonu «з».",stt_e_dev:"Tonsuz ünsüzden sonra ek tonsuzlaşır: «б» sesi «п» olur — кыргызбы ama оруспу.",stt_e_lesson:"Derste ayrıntısıyla:",stt_v_intro:"Bir ses seçin: nasıl çıkarıldığını okuyun, bu sesi taşıyan kelimeleri dinleyip yüksek sesle tekrarlayın.",stt_v_long:"Uzun ses aynı harfin iki kez yazılışıdır: belirgin biçimde uzun tutun — uzunluk anlamı değiştirir (sat «sat» — saat «saat»).",stt_v_words:"Bu sesi taşıyan kelimeler:",stt_snd:"Ses, kurs kelimelerinde:",stt_key_space:"Boşluk",trial_until:"{d}'e kadar",trial_hint:"Deneme erişimi: bu tarihten sonra dersler kapanır, sonuçlarınız görünür kalır",sec_teacher:"Öğretmen",tab_overview:"Genel bakış",tab_lessons:"Dersler",tab_cards:"Kartlar",tab_test:"Mini sınav",tab_howto:"Nasıl hazırlanılır",tab_grp_format:"Beceri alıştırması",howto_hdr:"Hazırlık yöntemi",exam_tr_intro:"Tek bir bölümün provası — kurs bitirme kontrolüyle aynı arayüz ve süre. Sonuç buraya yazılmaz: bu bir prova, deneme hakkı değil.",exam_tr_start:"Alıştırmaya başla",exam_tr_again:"Bir kez daha",exam_tr_note:"Süre, bitirme kontrolündeki gibi sınırlıdır. İstediğiniz an durabilirsiniz — başka bölüme geçmeniz yeterli.",tab_exam:"Bitirme kontrolü",fd_exam:"bitirme kontrolü",fd_exam_time:"süre doldu",fd_train:"alıştırma",fd_work:"çalışma gönderildi",fd_work_sent:"{n} cümle",fd_graded:"puanlandı",exam_hdr:"{lvl} kursu bitirme kontrolü",exam_w_ask:"Şu konuda bir metin yazın:",exam_w_size:"Hacim — {a}–{b} cümle.",exam_w_check:"Göndermeden önce kendinizi kontrol edin",exam_w_cnt:"Cümle: {n}",exam_w_cnt_qs:"Cevap: {n} / {q}",exam_w_short_qs:"Şimdilik {n} — {q} sorunun hepsini cevaplayın, her cevap yeni satırda.",exam_foreign:"{lvl} bitirme kontrolünüz sürüyor — kendi haftasında devam ediyor.",exam_foreign_go:"Sınava git",exam_w_short:"Şimdilik {n} — {a}–{b} cümle gerekiyor.",exam_send:"Öğretmene gönder",exam_w_err:"Gönderilemedi — tekrar deneyin.",exam_s_ask:"Şu konuda konuşun:",exam_s_size:"{a}–{b} saniyelik anlatım.",exam_s_rec:"Kayıt sürüyor…",exam_s_len:"Kaydedildi: {s} sn",exam_s_up:"Gönderiliyor…",exam_skip:"Atla",exam_sent_note:"çalışma öğretmende; puan incelemeden sonra görünür",exam_skipped_note:"atlandı — bu bölüm olmadan bitirme kontrolü eksik kalır",exam_works_hdr:"Bitirme kontrolü çalışmaları",exam_wk_score:"Puan",exam_wk_save:"Kaydet",exam_wk_pending:"inceleme bekliyor",exam_wk_none:"Henüz çalışma yok",exam_pitch:"Sorular her seferinde yeni: tüm {lvl} kursundan seçilen yedi tip. Her cevaptan sonra kuralıyla birlikte açıklama.",exam_now:"Şu an açık:",exam_nm:"{n} görev, {m} dakika",exam_warn:"Bölümler arka arkaya gelir, her birinin kendi süresi vardır. Önceki göreve dönülemez.",exam_calib:"Bu bir kurs alıştırmasıdır, resmî sınav puanı tahmini değildir. Yüzde, otomatik kontrol edilen görevlerdeki doğru cevapların oranıdır; yazma ve konuşmayı öğretmen değerlendirir.",exam_ok:"Doğru",exam_no:"Yanlış",exam_right:"Doğru cevap:",exam_from:"Modülden:",exam_next:"Sonraki",exam_ask_drill:"Doğru biçimi seçin:",exam_ask_reply:"Bu söze uygun cevabı seçin:",exam_ask_def:"Hangi kelime tarif ediliyor?",exam_ask_cloze:"Eksik kelimeyi yerleştirin:",exam_ask_order:"Kelimeleri sıraya koyun:",exam_ask_odd:"Farklı olanı bulun:",exam_ask_text:"Metne göre cevaplayın:",exam_listen:"Dinle",exam_uguu_hint:"Metin gösterilmez — dinleyin. {n} kez dinleyebilirsiniz.",exam_start:"Kontrolü başlat",exam_again:"Tekrar çöz",exam_c_sub:"Alt test",exam_c_mod:"Modül",exam_c_res:"Sonuç",exam_st_soon:"hazırlanıyor",exam_q:"Görev {n} / {t}",exam_left:"Kalan: {t}",exam_res:"{t} sorudan {r} doğru",exam_last:"Önceki deneme: %{p} ({d})",exam_timeup:"Bu bölümün süresi doldu — kapandı.",exam_weak:"Nerede düştü",exam_w_chk:"her cevap tam bir cümle · yüklem cümlenin sonunda · kelimeler ve biçimler kurs modüllerinden, Türkçeden çeviri değil",exam_qs_topic:"Kurs sorularına cevaplar",exam_s_hint:"Mikrofona konuşun; bitince kaydı durdurup cevabı gönderin.",exam_s_qs:"Soruları sırayla sesli cevaplayın — tek kayıtta.",exam_w_qs:"Soruları yazılı cevaplayın: her cevap tam bir cümle, yeni satırda.",exam_site:"Biçim, seviyeler ve kayıt — resmî sınav sitesinde:",exam_disclaimer:"Görevler learn.kg tarafından kurs materyallerinden hazırlanmıştır. Resmî Kırgızca dil sınavının görevleri değildir ve onlarla bağlantılı değildir.",
  next_course_note:"Kurs {c}: yolu öğretmen açar — Altınay'a WhatsApp'tan yazın.",next_course_btn:"Öğrenmeye devam et",
  tab_review:"Düzelti",tab_students:"Öğrenciler",tab_metodika:"Metodoloji",tab_settings:"Ayarlar",
  more_modules:"{n} modül daha…",collapse:"Listeyi kapat ▴",unlock_after:"Şu mini sınavdan sonra açılır: ",
  locked_by_teacher:"Öğretmen kapattı",content_soon:"İçerik hazırlanıyor",
  st_passed:"geçildi",st_open:"açık",st_locked:"kapalı",st_locked_t:"öğretmen kapattı",
  lbl_progress:"İlerleme",lbl_inwork:"çalışılıyor",lbl_done1:"tamamlandı",lbl_mastered:"pekiştirildi",lbl_queue:"oturum sırası",stat_done1:"dolaşımda (en az bir yazma denemesi)",stat_fixing:"düzeltiliyor (hata ya da ipucu — sonraki partide geri gelir)",
  stat_progress:"genel ilerleme",stat_progress_hint:"Tüm kartların Leitner kutuları toplamı / azami (kart başına 3)",stat_inwork:"çalışılıyor",stat_mastered:"pekiştirildi (günlere yayılmış doğru yanıtlar)",stat_test:"mini sınav",stat_voiced:"ifade seslendirildi",
  dict:"Modül sözlüğü",vi_fix:"düzeltiliyor",vi_new:"yeni",vi_learn:"öğreniliyor",vi_done:"✓ öğrenildi",
  mode_rec:"mod: tanıma",mode_type:"mod: yazma (Kırgızca yaz)",btn_check:"Kontrol et",btn_show:"Cevabı göster",
  fb_wrong:"Henüz değil. Doğrusu: ",fb_try:"Henüz değil — düzelt ve yeniden «Kontrol et»e bas. Cevap gerekiyorsa «Cevabı göster» düğmesi var.",fb_reveal_1:"Cevap: ",fb_hide_1:" — ezberle! Gizlenmesine ",fb_hide_2:" sn — sonra ezberden yaz.",
  session_done:"Oturum bitti. Tamamlanan: {d}/{t}, pekiştirilen: {m}. Yarın yine gel — tekrar aralıkları [1, 3, 7, 16] gün.",more_cards:"Yeni parti",
  drill_task:"Görev",drill_correct:"doğru",drill_again:"Yeni seri",drill_goal_ok:"Harika — ≥{g} hedefine ulaşıldı.",drill_goal_no:"Hedef: {t} içinden ≥{g} — kuralı yeniden oku ve tekrar dene.",
  drill_topic:"Önce grup hâlinde, sonra karışık:",drill_rule:"Kural:",
  audio_slow_hint:"Yavaş (0.5×)",
  rec_wrong:"Henüz değil — başka bir seçenek seç.",rec_hint:"«{o}» şu demek: ",
  cards_marked:"Ezberlenecekler",mark_hint:"«Ezberlenecek» olarak işaretle — ayrı bir konu olarak çalış",
  test_start:"Sınavı başlat",test_q:"Görev",test_what:"Anlamı nedir:",test_write:"Kırgızca yaz:",test_row:"Ünlü sırası:",test_harm:"Uyumlu biçimi seç:",test_answer:"Yanıtla",
  q_hard:"kalın (art): а, ы, о, у",q_soft:"ince (ön): э/е, и, ө, ү",q_hard_s:"kalın sıra",q_soft_s:"ince sıra",
  settings_theme:"Tema",th_light:"Açık",th_dark:"Koyu",th_auto:"Sistem",
  settings_audio:"Ses",ap_on:"Otomatik ses",ap_off:"Sessiz",
  set_autoplay_note:"Otomatik ses açıkken kart göründüğünde ve doğru yanıttan sonra ifade kendiliğinden çalar. ▶ düğmeleri her durumda çalışır.",
  know_hint:"Kelime hemen pekişir; 7 gün sonra onay için geri gelir",
  know_fb:"Pekişti — onay 7 gün sonra",
  skip_hint:"Kelimeyi destelerden çıkarır — «Ertelenenler» listesinden geri alınır",skip_fb:"Ertelendi — «İlerlemem» bölümünden geri alınır",
  sp_skipped:"Ertelenen kelimeler",sp_skipped_empty:"Ertelenen kelime yok.",skip_return:"Geri al",
  pg_skipped:"ertelenen: {n} — göster",pg_decide:"kelime kararları: «biliyorum» {k}, ertelenen {s}",
  fd_know:"biliyorum dedi",fd_skip:"erteledi",fd_skip_off:"desteye geri aldı",fd_mark:"ezberlenecek",fd_mark_off:"işareti kaldırdı",
  cards_practice_note:"Bugünkü kuyruk boş — bu ek alıştırma: kelime seviyeleri artmaz, aralıklar kısalmaz.",
  settings_lang:"Arayüz dili",settings_account:"Hesap",logged_as:"Giriş yapan: ",logout:"Çıkış yap",settings_data:"Veriler",reset_btn:"İlerlemeyi sıfırla ",
  role_student:"öğrenci",role_teacher:"öğretmen",role_admin:"yönetici",
  sync_ok:"eşitlendi",sync_err:"eşitleme yok",sync_local:"yerel mod",sync_demo:"demo modu",
  banner_draft:"Öğretmen düzeltisi: {d}/{t}{q} — notlu mini sınava yalnızca düzeltilmiş ifadeler girer.",banner_q:" (soru: {q})",banner_ok:"Modülün tüm ifadeleri öğretmen tarafından düzeltildi ({d}/{t}) — mini sınav tam kapsamlı.",
  rev_todo:"Düzeltilecek",rev_done:"Düzeltildi",rev_q:"Sorular",rev_checked:"Kontrol edildi",
  test_locked_review:"Notlu mini sınav düzeltiden sonra açılır: öğretmen {d}/{t} ifadeyi kontrol etti (≥{n} gerekli). Kartlar ve alıştırmalar şimdiden açık.",test_start_preview:"Ön izleme (modül hâlâ düzeltiliyor)",
  test_intro:"İpucusuz 20 görev: 8 ifade tanıma, 6 klavyeden yazma, 6 modül alıştırması. Geçme eşiği — 16/20 (%80, metodoloji §7.2). ",
  test_last:"Son deneme: {s}/{t} ({p}), {d} tarihinde.",test_passed_w:"geçti",test_failed_w:"geçemedi",
  test_chip_passed:"modül geçildi ✓",test_retake_note:" Tekrar girilebilir — modül durumunu etkilemez.",
  test_res_pass:"sınav geçildi ✓",test_res_fail:"{th}/{t} eşiğinin altında.",
  test_first_pass:" {num} geçildi! Sonraki modül yoluna eklendi — içeriği hazırlanıyor, düzeltiden sonra açılacak.",
  test_retake:" Tekrar deneme — modül durumunu etkilemez.",
  test_fail2:" Üst üste ikinci başarısızlık — öğretmeninle konuş: haftayı tekrarlamak ya da tempoyu değiştirmek gerekebilir (metodoloji §7.2).",
  test_fail1:" Zayıf noktaları tekrar et ve yarın geri dön (metodoloji §7.2).",
  test_local:"Sonuç yerel olarak kaydedildi — bağlantı gelince modül durumları güncellenecek.",
  btn_close:"Kapat",
  cards_instruction:"Yeni kart tek oturumda iki adımdan geçer: «Tanıma» (ifadeyi görürsün — çevirisini seçersin), hemen ardından «Yazma» (ifadeyi ezberden yazarsın, ө/ү/ң klavyesi alanın altında). Sonraki günlerde yalnızca «Yazma», [1, 3, 7, 16] aralıklarıyla. Öğrenildi = günlere yayılmış doğru yazımlar.",
  cards_hdr:"Kartlar — modül ifadeleri",cards_help_tgl:"Nasıl çalışır ve konu seçimi",cards_mix:"Karışık",cards_topic:"Önce konu bloğu, sonra karışık (metodoloji §4, ilke 4):",
  stub_revoked_hdr:"Kurs kapalı",stub_revoked_txt:"{mod}, artık sana verilmeyen bir kursa ait. Sonuçların «İlerlemem» bölümünde görünmeye devam eder, dersler kapalı — öğretmeninle iletişime geç.",
  stub_locked_hdr:"Modülü öğretmen kapattı",stub_locked_txt:"{mod} tekrar için kapatıldı. Öğretmeninle iletişime geç — açıldıktan sonra sayfayı yenile.",
  stub_soon_txt:"Bu modülün içeriği hazırlanıyor ve öğretmen düzeltisinden sonra görünecek. Bu arada önceki modüllerin kartlarını tekrar etmeye devam et — aralıklı tekrar beklemez.",
  set_theme_note:"«Sistem» seçeneği işletim sistemi ayarını izler. Seçim profilinde saklanır ve tüm cihazlarda geçerli olur.",
  set_acc_note:"İlerleme girişine bağlıdır ve sunucuda saklanır — bu girişle bağlanan her cihazda aynı ilerlemeyi görürsün.",
  set_local_note:"Yerel mod (dosya sunucusuz açıldı): giriş gerekmez, ilerleme yalnızca bu tarayıcıda saklanır.",
  rev_btn_ok:"Doğru",rev_btn_edit:"Düzelt",rev_btn_q:"Soru",rev_listen:"Dinle",rev_gen:"Üret",rev_regen:"Yeniden üret",rev_upload:"Yükle",rev_audio_ok:"Sesi onayla",
  reuse_chip:"{m} modülünden",
  stu_add:"Öğrenci ekle",stu_pass:"Şifre değiştir",stu_del:"Sil",stu_suspend:"Erişimi durdur",stu_resume:"Erişimi aç",stu_active:"aktif",stu_suspended:"erişim durduruldu",
  tch_section:"Öğretmenler",tch_add:"Öğretmen ekle",tch_hint:"Öğretmenler öğrencileri yönetir. Öğretmen eklemek/silmek yalnızca yöneticiye özeldir.",tch_del_confirm:"«{login}» öğretmenini sil? Erişimi kapatılacak.",tch_pass_prompt:"«{login}» için yeni şifre (en az 6 karakter):",tch_admin_note:"yönetici — users.json düzenlenerek yönetilir",
  stu_pass_prompt:"«{login}» için yeni şifre (en az 6 karakter):",stu_del_confirm:"«{login}» öğrencisini sil? Erişimi kapatılacak. Sunucudaki ilerleme dosyası kalır.",
  acc_pass_prompt:"Yeni şifre (en az 6 karakter):",acc_pass_ok:"şifre güncellendi ✓",acc_pass_admin:"Yönetici şifresi server/users.json düzenlenip yeniden dağıtılarak değiştirilir.",
  own_mine:"Öğrencilerim",own_none:"Öğretmensiz",own_label:"öğretmen:",own_gone:"öğretmen silindi",own_move:"Aktar",
  tab_progress:"İlerlemem",tab_roster:"Başarı panosu",
  tab_dialogs:"Diyaloglar",dlg_hdr:"Diyaloglar: dinle ve anla",dlg_hint:"Önce çevirisiz dinle — amaç sahneyi anlamak. ▶ satırı çalar, “Bölümü dinle” diyaloğu vurgulayarak ilerletir. Satıra dokun — çevirisi açılır, düğme bölümün tamamını açar. Her bölümden ve şarkıdan sonra anlama soruları var.",dlg_listen_all:"Bölümü dinle",dlg_song_play:"Şarkıyı dinle",dlg_amb:"Ortam sesi",dlg_stop:"Durdur",dlg_tap_tr:"Satıra dokun — çevirisi açılır",dlg_show_tr:"Çeviriyi göster",dlg_hide_tr:"Çeviriyi gizle",dlg_note_hdr:"Unutma: сен ve сиз",dlg_quiz_hdr:"Anlama soruları",dlg_quiz_hint:"Diyalogların içeriğine göre cevapla — çeviriye bakmadan.",dlg_right:"✓ туура! (doğru)",dlg_wrong:"✗ туура эмес (yanlış)",pg_hello:"Salam, {name}!",pg_continue:"Devam et",pg_due:"Tekrar bekleyen: {n} {w} · ~{m} dk",pg_due_go:"{n} {w} tekrar et",pg_card_forms:"kart",pg_day_forms:"gün",pg_mod_forms:"modül",pg_all_done:"Kuyruk boş — yeni kelimelerin tam zamanı",pg_today_done:"bugün: {n} yanıt",pg_today_none:"bugün henüz çalışmadın — 5 dakika yeter",pg_weak_hdr:"Mini test sonuçlarına göre zayıf noktalar",pg_weak_go:"Tekrar et",test_weak_hdr:"Zayıf noktalar",test_sent_note:"Sonucu öğretmenin de görüyor — neyi tekrar edeceğini önerecek.",weak_h_row:"ünlü uyumu: ünlü sırası",weak_h_affix:"ünlü uyumu: ek seçimi",fd_weak:"zayıf noktalar:",
  pg_streak_days:"{n} {w} üst üste",pg_streak_best:"kişisel rekor: {n} g.",pg_streak_none:"bugün yeni bir seri başlat",
  pg_tile_mastered:"öğrenilen kelime",pg_tile_inwork:"çalışılıyor",pg_tile_acc:"doğruluk, 7 gün",pg_tile_time:"süre, 7 gün",pg_min:"{n} dk",pg_hmin:"{h} sa {m} dk",
  pg_tile_modpassed:"geçilen modül",pg_tile_modopen:"yolda açık",
  pg_cal_hdr:"Aktivite",pg_cal_aria:"Son haftalardaki aktivite: {n} çalışma günü",
  pg_weak_hdr:"Dikkat gereken kelimeler",pg_weak_empty:"Zayıf kelime yok — harika iş",
  inst_hdr:"Telefonda uygulama",inst_p:"Antrenör uygulama olarak kurulur: ana ekranda kendi simgesi, adres çubuğu olmadan tam ekran ve internetsiz bile açılır.",inst_btn:"Kur",inst_how:"Elle kurulum →",inst_later:"Tamam, sonra tekrar önereceğiz.",
  pg_tests_hdr:"Mini sınav geçmişi",pg_tests_hint:"Satıra dokun — denemenin zayıf noktaları, kart tekrarı ve öğretmene mesaj.",pg_tests_empty:"Henüz mini sınav yok",pg_test_nodetails:"Ayrıntılar bir sonraki denemeden sonra görünecek.",pg_test_write:"Öğretmene yaz",pg_test_wa:"Merhaba Altınay! Mini test {m}: {s}/20. Zayıf noktalar: {w}. Neyi tekrar etmeliyim?",sp_wrong:"Hatalar",sp_right:"Doğru",sp_dyn:"Deneme geçmişi",sp_boxes:"Hafıza seviyesi dağılımı",sp_go_cards:"→ kartlar",sp_go_drill:"→ alıştırmalar",sp_retry_test:"Tekrar dene",sp_gap:"Barajın {n} altında kaldın — zayıf noktaları tekrar et ve geri dön!",pg_test_ok:"geçildi",pg_test_retry:"tekrar dene",
  pg_mods_hdr:"Modül yolu",pg_week_ring:"bu haftaki aktif günler",pg_week_cmp:"Bu hafta / geçen hafta: {a} yanıt ({da}) · doğruluk {p} ({dp}) · {m} dk ({dm})",cs_fail2:"{num} “{title}” mini sınavı ikinci kez direniyor — konuyu öğretmenle birlikte çözme işareti; genelde tek ders yeter.",cs_fail2_wa:"Merhaba! {num} “{title}” modülünün mini sınavı geçmiyor — konuyu derste çözmek istiyorum.",cs_lowacc:"Bu haftaki doğruluk %{p}. Sistematik bir hata olabilir — öğretmenle bir ders hızlıca bulur.",cs_lowacc_wa:"Merhaba! Doğruluğum düştü — hatalarımı derste incelemek istiyorum.",cs_mock:"{lvl} sınav haftası yaklaşıyor. Metodolojiye göre önce danışmanla deneme sınavı yapılır — zamanı önceden ayarla.",cs_mock_wa:"Merhaba! Danışmanla {lvl} seviyesinde deneme sınavı yapmak istiyorum.",cs_talk:"{num} “{title}” geçildi! Alıştırma sistemi konuşmayı öğretemez — konuyu öğretmenle konuşarak pekiştir.",cs_talk_wa:"Merhaba! {num} “{title}” modülünü geçtim — bu konuda konuşma pratiği istiyorum.",cs_btn_talk:"Öğretmene yaz",cs_btn_mock:"Deneme sınavı ayarla",cs_hide:"Gizle",pg_forecast:"{n} {w} {r} — bu tempoyla bitiş ≈ {d}",pg_left_forms:"kaldı",pg_due_chip:"{n} tekrar bekliyor",bd_hdr:"Kilometre taşları",bd_10:"İlk 10 ifade çalışmada",bd_100:"100 ifade pekişti",bd_500:"500 ifade pekişti",bd_1000w:"1000 ifade pekişti",bd_streak7:"7 günlük seri",bd_streak30:"30 günlük seri",bd_streak100:"100 günlük seri",bd_mod1:"İlk modül geçildi",bd_a1:"A1 kursu tamamlandı",bd_a2:"İlk A2 modülü geçildi",bd_1000:"1000 yanıt",bd_perfect:"20/20 mini sınav",pg_privacy:"Öğretmenin bu ilerlemeyi ve çalışma geçmişini görebilir.",
  pg_start_hdr:"Yeni başladın",pg_start_txt:"Birkaç kart çalış — burada aktivite takvimi ve hata analizi görünecek.",pg_load_err:"İlerleme yüklenemedi",
  rst_today:"bugün çalışan: {a}/{b}",rst_week:"bu hafta: {a}/{b}",rst_attention:"dikkat gereken: {n}",
  rst_f_all:"Tümü",rst_f_mine:"Benimkiler",rst_f_attention:"Dikkat gereken",rst_f_active:"Bugün aktif",rst_search:"Kullanıcı adına göre ara…",
  rst_c_student:"Öğrenci",rst_c_last:"Aktivite",rst_c_streak:"Seri",rst_c_progress:"İlerleme",rst_c_acc:"Doğruluk 7g",rst_c_tests:"Sınavlar",rst_c_flags:"Sinyaller",
  rst_never:"hiç",rst_today_w:"bugün",rst_yesterday:"dün",rst_ago:"{n} g. önce",
  rst_flag_idle:"{n} g. girmedi",rst_flag_never:"hiç girmedi",rst_flag_fail2:"sınav 2× başarısız",rst_flag_streak:"{n} günlük seri",
  rst_p_today:"Bugün çalışanlar",rst_p_week:"Bu hafta çalışanlar",rst_p_attention:"Dikkat gerekenler",
  rst_p_empty:"Henüz kimse yok",rst_p_close:"Kapat",rst_p_hint:"Kartını açmak için öğrenciye tıklayın",
  rst_open:"Aç",rst_back:"← listeye dön",rst_empty:"Henüz öğrenci yok",
  fd_hdr:"Çalışma akışı",fd_all:"Tümü",fd_t_cards:"Kartlar",fd_t_test:"Test ve sınav",fd_t_drill:"Uyum",fd_t_ui:"Arayüz",fd_t_listen:"Dinleme ve dersler",
  fd_p_7:"7 gün",fd_p_30:"30 gün",fd_p_all:"Tümü",fd_more:"Daha fazla göster",fd_empty:"Henüz kayıt yok",
  fd_sess:"{d} · {n} dk · {a} yanıt · {p}%",fd_c_time:"Zaman",fd_c_card:"Kart",fd_c_answer:"Yanıt",
  ev_notice_txt:"Oturumlarının seyrini kaydediyoruz (yanıtlar, süre, ipuçları) — öğretmenin bunu görebilir. Ayrıntılar için gizlilik politikasına bakın.",ev_notice_ok:"Anladım",
  demo_banner:"Bu bir demo: {total} ifadeden {n} tanesi. Tam erişimi öğretmen açar.",
  tab_inbox:"Mesajlar",
  ch_title:"Öğretmene yazın",ch_intro:"Buraya yazın — öğretmen aynı pencerede yanıtlar.",
  ch_ph:"Mesajınız…",ch_contact_ph:"Size nasıl ulaşalım (isteğe bağlı)",
  ch_send:"Gönder",ch_sent_note:"Yanıt burada görünecek — daha sonra bakın.",
  ch_wa:"WhatsApp",ch_empty:"Burası henüz boş — ilk mesajı yazın.",
  ch_you:"Siz",ch_teacher:"Öğretmen",ch_close:"Kapat",ch_err:"Gönderilemedi — lütfen tekrar deneyin.",
  ib_hdr:"Mesajlar",ib_unread:"Okunmamış",ib_all:"Tümü",ib_none:"Mesaj yok.",
  ib_visitor:"Ziyaretçi",ib_reply:"Yanıtla",ib_reply_ph:"Öğrenciye yanıt…",ib_back:"← Listeye dön",
  ib_contact:"İletişim",ib_page:"Sayfa",fd_chat:"mesaj",
  demo_wa:"WhatsApp'tan yazın",
  demo_wa_text:"Merhaba! learn.kg'deki demoyu denedim — Kırgızca öğrenmek istiyorum (A1 seviyesi).",
  demo_test_intro:"Demo sınavı: ipucu olmadan 10 görev — tanıma, yazma ve ünlü uyumu. Geçme eşiği — 8/10.",
  demo_end:"Beğendiniz mi? Tam kursta 12 modül, her ifade için ses, aralıklı tekrar ve günlük plan var.",
  demo_local_note:"Bu demo modu: ilerleme yalnızca bu tarayıcıda yaşar ve sunucuya kaydedilmez. Tam erişimi öğretmen açar."}
};
// Язык по умолчанию — из настроек устройства: ru/tr — как есть, ky → ru (официальный язык), иначе английский.
// Явный выбор (ST.settings.lang / kga1-lang) всегда важнее. typeof-guard обязателен:
// блок ===I18N=== исполняется тестом в песочнице без navigator.
function detectLang(){const n=typeof navigator==="undefined"?"":String(navigator.language||"").slice(0,2).toLowerCase();return I18N[n]?n:n==="ky"?"ru":n?"en":"ru";}
// Порядок: язык страницы (демо-вариант /demo/<lang> — адрес авторитетен, смена языка там
// ведёт на соседний вариант; typeof: блок исполняется vm-тестами и не-демо страницами, где
// DEMO_LANG не определён) → свежий выбор на ЭТОМ устройстве (kga1-lang: его пишут и
// витрина по клику, и setLang) → настройка из серверного прогресса → устройство.
// localStorage раньше ST намеренно: ST мог приехать со старым языком с другого
// устройства и перебивал только что выбранный на витрине — язык «сам» слетал ru→en.
function currentLang(){let s=null;try{s=localStorage.getItem("kga1-lang");}catch(e){}
  return (typeof DEMO_LANG!=="undefined"?DEMO_LANG:"")||(I18N[s]?s:"")||(ST.settings&&ST.settings.lang)||detectLang();}
function t(k){const l=I18N[currentLang()]||I18N.ru;const v=[l[k],I18N.en[k],I18N.ru[k]].find(x=>x!==undefined);return v!==undefined?v:k;}
// Число + слово: формы в словаре через | (день|дня|дней); правило русское,
// для en/tr достаточно первых форм (day|days, gün)
function nword(n,formsKey){
  const f=t(formsKey).split("|");
  if(f.length===1)return f[0];
  const m10=n%10,m100=n%100;
  if(f.length===2)return n===1?f[0]:f[1];
  if(m10===1&&m100!==11)return f[0];
  if(m10>=2&&m10<=4&&(m100<12||m100>14))return f[1];
  return f[2];
}
function tf(k,vars){let x=t(k);for(const [a,b] of Object.entries(vars||{}))x=x.split("{"+a+"}").join(b);return x;}
// <html lang> и заголовок вкладки — из сохранённого языка; зовётся и при смене языка,
// и на старте, иначе после перезагрузки атрибут остаётся "ru" (скринридер и авто-перевод врут)
function applyLang(){
  const l=currentLang();
  document.documentElement.lang=(l==="en"||l==="tr")?l:"ru";
  document.title=t("app_title");
  if(typeof updateDaymeter==="function")try{updateDaymeter();}catch(e){}
}
function setLang(l){
  ST.settings=ST.settings||{};ST.settings.lang=l;
  localStorage.setItem("kga1-lang",l);
  // и в куку: по ней сервер выбирает языковой вариант при заходе на голый адрес
  try{document.cookie="kga1-lang="+l+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){}
  // В демо язык — часть адреса: уходим на соседний вариант, иначе URL и интерфейс разъедутся
  if(typeof IS_DEMO!=="undefined"&&IS_DEMO&&I18N[l]){save();location.assign("/demo/"+l);return;}
  evPush("ui.setting",{k:"lang",val:l});
  applyLang();
  save();renderSidebar();renderTab();updateFooter();updateBanner();
}
// tr ещё переведён не везде: непереведённая строка мягко откатывается на английскую
function L(ru,en,tr){const l=currentLang();return l==="tr"?(tr!==undefined?tr:en):(l==="en"?en:ru);}
function metaTitle(mm){const l=currentLang();return (l==="tr"&&mm.titleTr)||(l!=="ru"&&mm.titleEn)||mm.title;}
function gloss(c){const l=currentLang();return (l==="tr"&&c.tr)||(l!=="ru"&&c.en)||c.ru;}
/* ===/I18N=== */
// Правдоподобные неверные варианты: сперва та же категория (похожие по смыслу), затем добор из прочих.
// Дедупликация — по смысловой базе перевода (без скобочных пояснений, без регистра/пунктуации):
// «Кто Вы по национальности?» и «Кто Вы по национальности? (букв. …)» — один смысл, и такой
// «неверный» вариант нельзя предлагать рядом с верным — ученик различить их не может.
function glossBase(s){
  const base=normalizeAnswer(String(s).replace(/\s*[(（][^)）]*[)）]/g,""));
  return base||normalizeAnswer(s); // текст целиком в скобках — не даём базе схлопнуться в пустоту
}
function pickDistractors(c,n){
  const seen=new Set([glossBase(gloss(c))]);
  const pool=shuffle(VOCAB.filter(v=>v.id!==c.id&&v.cat===c.cat))
    .concat(shuffle(VOCAB.filter(v=>v.id!==c.id&&v.cat!==c.cat)));
  const out=[];
  for(const v of pool){
    const g=gloss(v),b=glossBase(g);
    if(seen.has(b))continue;
    seen.add(b);out.push(g);
    if(out.length>=n)break;
  }
  return out;
}
function catName(k){const c=CONTENT[activeModule]||{};const l=currentLang();
  return (l==="tr"&&c.catsTr&&c.catsTr[k])||(l!=="ru"&&c.catsEn&&c.catsEn[k])||(c.cats&&c.cats[k])||k;}
function icon(name,size){
  const s=document.createElementNS(SVG_NS,"svg");
  s.setAttribute("viewBox","0 0 24 24");
  s.setAttribute("width",size||18);s.setAttribute("height",size||18);
  s.setAttribute("fill","none");s.setAttribute("stroke","currentColor");
  s.setAttribute("stroke-width","2");s.setAttribute("stroke-linecap","round");s.setAttribute("stroke-linejoin","round");
  s.classList.add("ic");
  for(const d of (ICONS[name]||[])){const p=document.createElementNS(SVG_NS,"path");p.setAttribute("d",d);s.append(p);}
  return s;
}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Экранная клавиатура: вставляет символ в переданный input
function kbdFor(input){
  const bar=h("div",{class:"kbd"});
  for(const ch of ["ө","ү","ң","Ө","Ү","Ң"]){
    const b=h("button",{type:"button"},ch);
    b.addEventListener("mousedown",e=>e.preventDefault()); // не терять фокус
    b.addEventListener("click",()=>{
      EV.kbd=(EV.kbd||0)+1; // счётчик для журнала: пользуются ли экранной клавиатурой
      const s=input.selectionStart??input.value.length,e2=input.selectionEnd??input.value.length;
      input.value=input.value.slice(0,s)+ch+input.value.slice(e2);
      input.focus();input.selectionStart=input.selectionEnd=s+ch.length;
    });
    bar.append(b);
  }
  return bar;
}

/* ============================================================ ВКЛАДКИ */
// иконка тренировки — по роду субтеста из реестра (kind), а не по его id
const EXAM_TAB_ICON={mcq:"wave",listen:"mic",read:"type",write:"pen",speak:"mic"};
function studyTabsFor(id){const c=CONTENT[id]||{};
  /* Экзаменационная неделя устроена иначе учебного модуля (правило владельца 22.08.2026):
     «Как готовиться» (обзор недели + стратегия по навыкам + методика), тренировка навыков
     по частям реестра, итоговая проверка. Учебные вкладки скрыты — материал модуля
     никуда не делся, к нему ведут разборы после попытки. Новый субтест в спеке
     курса (EXAM_SPECS) = новый пункт тренажёра, ноль правок логики. */
  const exSpec=isExamWeek(id)?examSpecs()[metaOf(id).course]:null;
  if(exSpec)
    return [["overview",t("tab_howto"),"book"],
            ["grp",t("tab_grp_format"),null],
            ...exSpec.subtests.map(x=>["tr_"+x.id,bi3(x),EXAM_TAB_ICON[x.kind]||"wave"]),
            ["exam",t("tab_exam"),"target"]];
  return [["overview",t("tab_overview"),"home"],
          // уроки — там, где они есть в реестре LESSONS: новый урок = данные, не правка логики
          ...((typeof LESSONS!=="undefined"&&LESSONS[id])?[["lessons",t("tab_lessons"),"play"]]:[]),
          ["alphabet",bi(c,"refLabel")||"—","type"],
          ["cards",t("tab_cards"),"cards"],
          ...(DIALOGS[id]?[["dialogs",t("tab_dialogs"),"users"]]:[]),
          // аудирование (эксперимент): модули из реестра STT_MODS (data/stt-blocks.js) —
          // там, где для раздела есть свой материал. Вкладка видна ВСЕМ, включая демо и
          // триал — запертым показывается тизер с кнопкой WhatsApp (магнит-апселл,
          // решение владельца); само упражнение открывает опция stt.
          ...((typeof STT_MODS!=="undefined"?STT_MODS:["m0"]).indexOf(id)>=0?[["listen",t("tab_listen"),"mic"]]:[]),
          ["harmony",bi(c,"drillLabel")||"—","wave"],
          ["test",t("tab_test"),"check"],
          // итоговая проверка — кульминация недели, поэтому последний в меню и со своей
          // иконкой (мишень): рядом с «Мини-тестом» под одной галкой их путали.
          // Модули — из реестра EXAM_MODS (data/exam-b1.js)
          ...(isExamWeek(id)?[["exam",t("tab_exam"),"target"]]:[])];}
// «Сообщения» первой строкой: письмо ученика или гостя ждёт ответа, и это
// единственное место, где преподаватель о нём узнаёт (уведомлений наружу нет)
const TEACHER_TABS_DEF=[["inbox","Сообщения","mail"],["review","Вычитка","pen"],["students","Ученики","users"],["roster","Успеваемость","chart"],["metodika","Методика","book"]];
let activeTab="overview";
/* ---------- Сайдбар-аккордеон (паттерн LMS: модули → вложенные разделы) ---------- */
let showAllLocked=false;
/* ---------- Маршрут (#модуль/вкладка): переживает рефреш ---------- */
const GLOBAL_TABS=["settings","students","metodika","progress","roster","inbox"];
let rosterLogin=null; // выбранный ученик на вкладке «Успеваемость»; null — список
// PWA-шорткат «Повторить» (#repeat): parseRoute возвращает признак, boot доводит
// Токен текущего маршрута — единый для адресной строки, localStorage и журнала (ui.nav).
// Карточка ученика внутри «Успеваемости» — свой токен roster:<login>, а не под-маршрут
// модуля: у преподавателя открыт СВОЙ activeModule, ученик тут ни при чём.
function routeToken(){
  const tab=(activeTab==="roster"&&rosterLogin)?("roster:"+rosterLogin):activeTab;
  return GLOBAL_TABS.includes(activeTab)?tab:activeModule+"/"+tab;
}
function saveRoute(){
  const r=routeToken();
  try{localStorage.setItem(ROUTE_KEY,r);}catch(e){}
  // от pathname, не голый "#…": на демо-страницах глубины 2 стоит <base href="/">,
  // и относительный hash-URL переписал бы адрес на корень (перезагрузка теряла бы демо)
  try{history.replaceState(null,"",location.pathname+"#"+r);}catch(e){}
}
// Единый источник допустимых вкладок — те же определения, что рисует сайдбар:
// учебные из studyTabsFor, преподавательские из TEACHER_TABS_DEF (+«Мой прогресс»).
// В демо остаются только учебные и настройки.
function availableTabs(){
  const tabs=studyTabsFor(activeModule).map(x=>x[0]).filter(x=>x!=="grp").concat("settings");
  if(!IS_DEMO)tabs.push("progress",...TEACHER_TABS_DEF.map(x=>x[0]));
  return tabs;
}
function parseRoute(){
  const raw=(location.hash||"").replace(/^#/,"")||localStorage.getItem(ROUTE_KEY)||"";
  let [mod,tab]=raw.split("/");
  if(mod&&!tab&&!MODULE_META.some(x=>x.id===mod)){tab=mod;mod=null;} // «#settings» — глобальная вкладка без модуля
  let wantRepeat=false;
  if(tab==="repeat"){wantRepeat=true;tab="cards";} // конкретный модуль выберем после загрузки прогресса
  if(mod&&MODULE_META.some(x=>x.id===mod))activeModule=mod;
  if(IS_DEMO)activeModule=(typeof DEMO_MOD!=="undefined"?DEMO_MOD:"m0"); // в демо другие модули недоступны и по прямой ссылке
  const validTabs=availableTabs();
  if(!IS_DEMO&&tab&&tab.slice(0,7)==="roster:"){
    const login=tab.slice(7);
    if(/^[a-z0-9_-]{2,24}$/.test(login)){activeTab="roster";rosterLogin=login;}
  }else if(tab&&validTabs.includes(tab)){activeTab=tab;rosterLogin=null;}
  applyModuleContent();
  return wantRepeat;
}
function openRoster(login){rosterLogin=login;go("roster");}
function closeRoster(){rosterLogin=null;go("roster");}
function setModule(id,keepTab){
  activeModule=id;if(!keepTab)activeTab="overview";
  evPush("ui.nav",{tab:routeToken()}); // смена модуля — тоже переход, иначе «#m0/overview» не виден в ленте
  applyModuleContent();
  renderSidebar();renderTab();updateFooter();saveRoute();
  el("layout").classList.remove("side-open");
  if(SYNC.enabled){ // вычитка/правки/аудио — у каждого модуля свои
    Promise.all([fetchReviewData(),fetchAudioList()]).then(()=>{
      // Начатую сессию карточек не перерисовываем: повторный renderTab запускал вторую
      // сессию поверх первой, а фокус-колода (клик по слову) к тому моменту уже потреблена —
      // и вместо выбранного слова ученик получал обычную очередь. Кнопки ▶ у первой
      // карточки в этом случае появятся со следующей — аудио как раз догрузилось.
      if(activeTab==="cards"&&Cards.cur){renderCardTopics();updateBanner();return;}
      renderTab();updateBanner();
    });
  }
}
/* Бейдж срока триала: у курса или модуля с датой — «до 25.08», без даты — ничего
   (бессрочный триал внешне не отличается от выданного). Сроки приезжают в ME.trials. */
function fmtTrialUntil(until){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(until||"");
  return m?m[3]+"."+m[2]:"";}
function trialChip(id){
  const tr=ME&&ME.trials;
  if(!tr||!(id in tr)||tr[id]==null)return null;
  return h("span",{class:"chip warn",title:t("trial_hint")},tf("trial_until",{d:fmtTrialUntil(tr[id])}));
}
function renderSidebar(){
  const nav=clear(el("nav"));
  const courses=myCourses();
  let anyLocked=false,lastCoursePassed=false;

  // --- Курсы: аккордеон модулей на каждый выданный курс ---
  let courseIdx=0;
  for(const cid of courses){
    const mods=courseModules(cid);
    if(!mods.length)continue;
    const statuses=mods.map(mm=>moduleStatusOf(mm.id));
    const passedCount=statuses.filter(st=>st==="passed").length;
    lastCoursePassed=statuses[statuses.length-1]==="passed"; // после цикла — про последний курс
    nav.append(h("div",{class:"sec-label sec-course"+(courseIdx++===0?" first":"")},
      t("sec_course")+" "+(COURSE_LABELS[cid]||cid.toUpperCase()),
      h("span",{class:"chip"},passedCount+"/"+mods.length),
      trialChip(cid)));
    const hint=h("div",{class:"mp-hint"});
    // видимы: все не-locked + первый locked (ближайшая цель); хвост — одной строкой
    let frontier=0;
    statuses.forEach((st,i)=>{if(st!=="locked")frontier=Math.max(frontier,i);});
    const firstLocked=Math.min(frontier+1,mods.length-1);
    let hiddenCount=0;
    mods.forEach((mm,i)=>{
      const st=statuses[i];
      if(st==="locked")anyLocked=true;
      if(!showAllLocked&&st==="locked"&&i>firstLocked){hiddenCount++;return;}
      const isActive=mm.id===activeModule;
      const row=h("button",{class:"mod-item"+(isActive?" active":"")+(st==="locked"?" locked":"")},
        icon(st==="passed"?"check":st==="open"?"play":"lock",13),
        h("span",{class:"mod-name"},mm.num+" · "+metaTitle(mm)));
      row.addEventListener("click",()=>{
        if(st==="locked"){
          // подсказка — про предыдущий модуль ЭТОГО курса (первый модуль курса заперт
          // не «после М11», а до выдачи/старта курса — там и подсказывать нечего)
          if(i>0){hint.textContent=t("unlock_after")+mods[i-1].num;row.after(hint);}
          return;
        }
        setModule(mm.id);
      });
      nav.append(row);
      if(isActive){ // разделы активного модуля — вложенно
        if(st==="locked_by_teacher"&&!isTeacher()){
          nav.append(h("div",{class:"mod-sub note-sub muted"},icon("lock",12)," "+t("locked_by_teacher")));
        }else if(!CONTENT_READY.includes(mm.id)){
          nav.append(h("div",{class:"mod-sub note-sub muted"},icon("book",12)," "+t("content_soon")));
        }else{
          for(const [k,t,ic] of studyTabsFor(mm.id)){
            // «grp» — подпись группы разделов (тренажёр формата), не переход
            if(k==="grp"){nav.append(h("div",{class:"mod-grp"},t));continue;}
            nav.append(h("button",{class:"mod-sub"+(k===activeTab?" active":""),onclick:()=>go(k)},icon(ic,13),t));
          }
        }
      }
    });
    if(hiddenCount>0){
      nav.append(h("button",{class:"mod-item locked",onclick:()=>{showAllLocked=true;renderSidebar();}},
        icon("lock",13),h("span",{class:"mod-name"},tf("more_modules",{n:hiddenCount}))));
    }
  }
  if(showAllLocked&&anyLocked){
    nav.append(h("button",{class:"mod-item",onclick:()=>{showAllLocked=false;renderSidebar();}},
      h("span",{class:"mod-name",style:"color:var(--muted)"},t("collapse"))));
  }
  // --- Триал-модули вне выданных курсов: без своей секции их не было бы видно вовсе,
  // ведь сайдбар строится по курсам. result_only сюда не попадает — истёкший триал
  // показывают результаты, а не тропа занятий.
  if(ME&&Array.isArray(ME.modules)&&!isTeacher()){
    const inCourses=new Set(courses.flatMap(c=>courseModules(c).map(mm=>mm.id)));
    const trialMods=ME.modules.filter(x=>!inCourses.has(x.id)&&(x.status==="open"||x.status==="passed"))
      .map(x=>MODULE_META.find(mm=>mm.id===x.id)).filter(Boolean);
    if(trialMods.length){
      nav.append(h("div",{class:"sec-label sec-course"},t("sec_trial")));
      for(const mm of trialMods){
        const st=moduleStatusOf(mm.id);
        const row=h("button",{class:"mod-item"+(mm.id===activeModule?" active":"")},
          icon(st==="passed"?"check":"play",13),
          h("span",{class:"mod-name"},mm.num+" · "+metaTitle(mm)),trialChip(mm.id));
        row.addEventListener("click",()=>setModule(mm.id));
        nav.append(row);
      }
    }
  }
  // Апселл следующего курса: каталог знает курс, которого ученику не выдали, а последний
  // выданный уже сдан целиком — дальше только через преподавателя. Пока каталог = один A1,
  // блок не рендерится вовсе (ничего не меняется для нынешних учеников).
  const nextCid=knownCourses().find(c=>!courses.includes(c));
  if(nextCid&&lastCoursePassed&&!isTeacher()){
    nav.append(h("div",{class:"sec-label sec-course"},t("sec_course")+" "+(COURSE_LABELS[nextCid]||nextCid.toUpperCase())));
    nav.append(h("div",{class:"mod-sub note-sub muted"},tf("next_course_note",{c:COURSE_LABELS[nextCid]||nextCid})));
    nav.append(h("a",{class:"mod-item",href:"https://wa.me/996505854856",target:"_blank",rel:"noopener noreferrer"},
      icon("play",13),h("span",{class:"mod-name"},t("next_course_btn"))));
  }

  // --- Мой прогресс: свой, у любой роли — преподаватель тоже проходит карточки ---
  if(SYNC.enabled){
    nav.append(h("div",{class:"sec-label"}));
    nav.append(h("button",{class:"mod-item"+(activeTab==="progress"?" active":""),onclick:()=>go("progress")},
      icon("chart",13),h("span",{class:"mod-name"},t("tab_progress"))));
  }

  // --- ПРЕПОДАВАТЕЛЬ ---
  if(isTeacher()){
    nav.append(h("div",{class:"sec-label"},t("sec_teacher")));
    for(const [k,_lbl,ic] of TEACHER_TABS_DEF){
      // счётчик непрочитанных тредов рядом с «Сообщениями»: письмо не должно ждать
      const badge=(k==="inbox"&&CHAT.unread>0)?h("span",{class:"chip"},String(CHAT.unread)):null;
      nav.append(appendKids(h("button",{class:"mod-item"+(k===activeTab?" active":""),onclick:()=>go(k)},
        icon(ic,13),h("span",{class:"mod-name"},t("tab_"+k))),badge));
    }
  }

  // --- Настройки ---
  nav.append(h("div",{class:"sec-label"}));
  nav.append(h("button",{class:"mod-item"+(activeTab==="settings"?" active":""),onclick:()=>go("settings")},
    icon("sliders",13),h("span",{class:"mod-name"},t("tab_settings"))));
}
function renderNav(){renderSidebar();}
function renderModulesPath(){renderSidebar();}
function go(tab){
  activeTab=tab;
  evPush("ui.nav",{tab:routeToken()}); // в журнал — полный маршрут, как в адресной строке
  saveRoute();renderNav();renderTab();
  el("layout").classList.remove("side-open"); // мобильный сайдбар закрывается при выборе
}
// Разовое уведомление о журнале занятий: показываем ОТКРЫТО, а не постфактум в политике —
// один раз на аккаунт (флаг в ST.settings синкается с сервером, переживает устройство).
function maybeEventsNotice(m){
  if(!SYNC.enabled||(ST.settings&&ST.settings.eventsNoticeSeen))return;
  const box=h("div",{class:"card",style:"border-color:var(--accent)"});
  box.append(h("p",{},icon("clock",15)," "+t("ev_notice_txt")));
  box.append(h("button",{class:"btn",onclick:()=>{
    ST.settings=ST.settings||{};ST.settings.eventsNoticeSeen=true;save();box.remove();
  }},t("ev_notice_ok")));
  m.prepend(box);
}
/* ===CHAT-FAB=== Связь с преподавателем одним касанием. Раньше WhatsApp жил только
   в футере витрины, в «Помощи» и в тизере аудирования — внутри тренажёра ученик
   его не находил. Кнопка висит в углу над контентом на любом экране: на телефоне
   это круг с иконкой (палец достаёт, safe-area учтена), на десктопе — та же кнопка
   с подписью. Преподавателю не показывается: у неё для этого вкладка «Сообщения».
   05.09.2026 канал сменился: кнопка больше не уводит в мессенджер (в России они
   заблокированы), а открывает панель чата на самом сайте; WhatsApp остался второй
   кнопкой ВНУТРИ панели — waHref() по-прежнему собирает готовый текст, ученику
   с его логином, гостю демо — просьбу открыть доступ. Ответ преподавателя виден
   бейджем на кнопке: другого уведомления у ученика нет. */
const CHAT={unread:0};
function waHref(){
  const demo=typeof IS_DEMO!=="undefined"&&IS_DEMO;
  const who=(ME&&ME.login)?tf("wa_fab_text_user",{u:ME.login}):t(demo?"demo_wa_text":"wa_fab_text");
  return "https://wa.me/996505854856?text="+encodeURIComponent(who);
}
/* Две плавающие кнопки, обе в один клик (решение владельца 06.09.2026): зелёная WhatsApp —
   ссылка наружу, синяя «Написать преподавателю» — панель чата на месте. Учителю — ни одной:
   писать самой себе незачем, у неё вкладка «Сообщения». */
const chatFabsOff=()=>typeof isTeacher==="function"&&isTeacher();
function chatFab(){
  if(chatFabsOff())return null;
  const n=CHAT.unread||0;
  const badge=h("span",Object.assign({class:"fab-badge"},n?{}:{hidden:"hidden"}),n?String(n):"");
  const label=n?t("wa_fab_label")+", "+t("ib_unread").toLowerCase()+": "+n:t("wa_fab_label");   // счётчик озвучивается
  const b=h("button",{class:"chat-fab",type:"button",
    "aria-label":label,title:t("wa_fab_label")},
    icon("mail",22),h("span",{class:"wa-fab-t"},t("wa_fab_label")),badge);
  b.addEventListener("click",()=>openChatPanel(b));
  return b;
}
function waFabLink(){
  if(chatFabsOff())return null;
  const a=h("a",{class:"wa-fab",href:waHref(),target:"_blank",rel:"noopener noreferrer",
    "aria-label":t("wa_fab_wa"),title:t("wa_fab_wa")},
    icon("whatsapp",22),h("span",{class:"wa-fab-t"},t("wa_fab_wa")));
  a.addEventListener("click",()=>{try{evPush("wa.click",{from:activeTab});}catch(e){}});
  return a;
}
function mountWaFab(){
  if(typeof document==="undefined")return;
  const old=document.querySelector(".chat-fab"), oldWa=document.querySelector(".wa-fab");
  // перерисовка не должна красть фокус: закрытая панель вернула его на кнопку, а следующий
  // рендер (Escape ловит и приложение) пересобирает её — фокус переезжает на новую
  const hadFocus=!!old&&document.activeElement===old;
  if(old)old.remove();if(oldWa)oldWa.remove();   // язык, роль или счётчик сменились — перерисуем
  const wa=waFabLink();if(wa)document.body.append(wa);
  const b=chatFab();
  if(b){document.body.append(b);if(hadFocus&&b.focus)b.focus();}
}
/* ===/CHAT-FAB=== */
function renderTab(){
  if(UPDATE.stale&&applyUpdate())return;   // отложенное самообновление — на границе вкладок
  fgStop();ambStop();
  mountWaFab();          // кнопка связи живёт над контентом на любой вкладке // смена вкладки/модуля — аудио и фоновый луп не должны пережить свой DOM
  const m=clear(el("main"));
  maybeEventsNotice(m);
  // exam в списке обязателен: без него ученик с ОТНЯТЫМ курсом B1 проходил бы
  // итоговую проверку через прямой маршрут #m35/exam (дыра найдена ревью 22.08.2026)
  const STUDY_TABS=["overview","alphabet","cards","dialogs","harmony","test","exam"];
  const isTrain=activeTab.slice(0,3)==="tr_";   // тренажёр формата закрыт теми же гейтами
  if(studyBlocked()&&(isTrain||STUDY_TABS.includes(activeTab))){
    const revoked=isRevoked(activeModule); // курс забрали: результаты видны, занятия закрыты
    m.append(h("div",{class:"card"},
      h("h2",{},icon("lock")," "+t(revoked?"stub_revoked_hdr":"stub_locked_hdr")),
      h("p",{class:"muted"},tf(revoked?"stub_revoked_txt":"stub_locked_txt",{mod:metaOf(activeModule).num+" «"+metaTitle(metaOf(activeModule))+"»"}))));
    return;
  }
  if(!CONTENT_READY.includes(activeModule)&&(isTrain||STUDY_TABS.includes(activeTab))){
    m.append(h("div",{class:"card"},
      h("h2",{},icon("book")," "+metaOf(activeModule).num+" · "+metaTitle(metaOf(activeModule))),
      h("p",{class:"muted"},t("stub_soon_txt"))));
    return;
  }
  if(isTrain)return renderExamTrain(m,activeTab.slice(3));
  if(activeTab==="dialogs")return renderDialogs(m);
  if(activeTab==="overview")renderOverview(m);
  else if(activeTab==="lessons")renderLessons(m);
  else if(activeTab==="listen")renderListen(m);
  else if(activeTab==="exam")renderExam(m);
  else if(activeTab==="alphabet")(((MODULE_EXTRAS[activeModule]||{}).ref)||renderAlphabet)(m);
  else if(activeTab==="cards"){renderCardsShell(m);Cards.start();}
  else if(activeTab==="harmony"){renderHarmonyShell(m);Harmony.start();}
  else if(activeTab==="test"){renderTestShell(m);Test.renderIntro();}
  else if(activeTab==="inbox")renderInbox(m);
  else if(activeTab==="review")renderReview(m);
  else if(activeTab==="students")renderStudents(m);
  else if(activeTab==="roster"){if(rosterLogin)renderStudentCard(m,rosterLogin);else renderRoster(m);}
  else if(activeTab==="progress")renderProgress(m,ME?ME.login:null,{teacher:false});
  else if(activeTab==="metodika")m.append(h("iframe",{src:"metodika?embed=1",style:"width:100%;height:calc(100vh - 130px);border:1px solid var(--line);border-radius:12px;background:var(--card)"}));
  else if(activeTab==="settings")renderSettings(m);
  window.scrollTo(0,0);
}

/* ---------- Ученики (для преподавателя): тропа и доступ ---------- */
async function fetchStudents(){
  const r=await fetch("api/students",{cache:"no-store"});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  return r.json();
}
async function putStudent(payload){
  const r=await fetch("api/students",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  return r.json();
}

/* ===ACCESS=== */
/* Меню «Доступ» карточки ученика: чистые построители PUT-нагрузки для /api/students.
   Контракт сервера: courses — непустой список выданных курсов; granted/locked —
   модульные исключения поверх авто-тропы, валидируются по модулям итоговых курсов.
   Вся логика решений живёт здесь и проверяется напрямую (tests/access.test.js);
   рендер только раскладывает кнопки. null = действие недоступно, кнопку не рисуем. */
function accCourses(s){return Array.isArray(s.courses)&&s.courses.length?s.courses:["a1"];}
function accStatus(s,id){const e=(s.modules||[]).find(x=>x.id===id);return e?e.status:"locked";}
function accGrantCourse(s,cid){const sc=accCourses(s);return sc.includes(cid)?null:{courses:sc.concat([cid])};}
function accRevokeCourse(s,cid){const sc=accCourses(s);
  if(!sc.includes(cid)||sc.length<2)return null; // единственный курс не забрать (сервер ответит 400)
  return {courses:sc.filter(x=>x!==cid)};}
function accOpenAll(s,cid,meta){ // открыть разом все модули курса (сданные не трогаем)
  const ids=meta.filter(m=>m.course===cid).map(m=>m.id);
  if(!ids.some(id=>accStatus(s,id)==="locked"||accStatus(s,id)==="locked_by_teacher"))return null;
  const granted=new Set(s.granted||[]);
  ids.forEach(id=>{if(accStatus(s,id)!=="passed")granted.add(id);});
  return {granted:[...granted],locked:(s.locked||[]).filter(x=>!ids.includes(x))};}
function accResetManual(s,cid,meta){ // вернуть авто-тропу: снять все ручные правки курса
  const ids=new Set(meta.filter(m=>m.course===cid).map(m=>m.id));
  if(!(s.granted||[]).some(x=>ids.has(x))&&!(s.locked||[]).some(x=>ids.has(x)))return null;
  return {granted:(s.granted||[]).filter(x=>!ids.has(x)),locked:(s.locked||[]).filter(x=>!ids.has(x))};}
/* Триал-доступ: trials = { "<курс|модуль>": "YYYY-MM-DD"|null } — до даты включительно
   либо без ограничения. Пресеты считаются от «сегодня»; дата дня n-дневного триала —
   сегодня + n (последний день — n-й включительно). Постоянных учеников триалы не
   касаются: их courses не трогаются вовсе. */
function accTrialDate(days,now){const d=now?new Date(now):new Date();d.setDate(d.getDate()+days);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function accTrialSet(s,id,until){const t=Object.assign({},s.trials||{});t[id]=until;return {trials:t};}
function accTrialRemove(s,id){const t=Object.assign({},s.trials||{});
  if(!(id in t))return null;delete t[id];return {trials:t};}
function accTrialActive(until,now){return until==null||((now||Date.now())<=Date.parse(until+"T23:59:59+06:00"));}
/* ===/ACCESS=== */

/* ---------- Журнал занятий: агрегаты, обзор дашборда, лента ---------- */
async function fetchStats(login){
  const r=await fetch("api/stats"+(login?("?login="+encodeURIComponent(login)):""),{cache:"no-store"});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  return r.json();
}
async function fetchRoster(){
  const r=await fetch("api/stats/overview",{cache:"no-store"});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  return r.json();
}
async function fetchEvents(login,opts){
  opts=opts||{};
  const q=new URLSearchParams();
  if(login)q.set("login",login);
  if(opts.limit)q.set("limit",String(opts.limit));
  if(opts.before)q.set("before",opts.before);
  const r=await fetch("api/events?"+q.toString(),{cache:"no-store"});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
  return r.json();
}
function userRow(s,opts){
  opts=opts||{};
  const withModules=opts.withModules!==false;
  const passPrompt=opts.passPrompt||((login)=>tf("stu_pass_prompt",{login}));
  const delConfirm=opts.delConfirm||((login)=>tf("stu_del_confirm",{login}));
  const onRemoved=opts.onRemoved||(()=>renderTab());
  const teachers=opts.teachers||null;
  const onOwnerChange=opts.onOwnerChange||(()=>renderTab());
  const msg=h("span",{class:"muted"});
  const row=h("div",{class:"card rev-row"});
  const chipsRow=h("div",{style:"margin-top:8px"});
  const chipMenu=h("div",{});
  const ownerMenu=h("div",{});
  const renderChips=()=>{
    if(!withModules)return;
    clear(chipsRow);
    const sc=accCourses(s);
    // Единый диалог подтверждения под блоком доступа: полная фраза + кнопки действий.
    const ask=(text,acts)=>{
      const note=h("div",{class:"note"},text+" ");
      for(const [label,payloadOrFn] of acts){
        note.append(h("button",{class:"btn ghost",style:"margin-left:6px",onclick:async()=>{
          // действие может быть ленивым (спросить дату у преподавателя); null = передумал
          const payload=typeof payloadOrFn==="function"?payloadOrFn():payloadOrFn;
          if(!payload)return;
          try{const d=await putStudent(Object.assign({login:s.login},payload));Object.assign(s,d.student);renderChips();clear(chipMenu);}
          catch(e){msg.textContent="⚠ "+e.message;}
        }},label));
      }
      note.append(h("button",{class:"btn ghost",style:"margin-left:6px",onclick:()=>clear(chipMenu)},acts.length?"Отмена":"✕"));
      clear(chipMenu).append(note);
    };
    const rowStyle="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center";
    const lblStyle="min-width:86px";
    // Строка «Курсы» — когда каталог знает больше одного курса (до выхода A2 строка не
    // рендерилась, карточка выглядела как прежде) ИЛИ когда у ученика нестандартный
    // набор курсов (например, только a2, выданный напрямую через API): без неё
    // преподаватель не смог бы вернуть такому ученику a1 из интерфейса.
    if(knownCourses().length>1||JSON.stringify(sc)!==JSON.stringify(["a1"])){
      const crow=h("div",{style:rowStyle},h("span",{class:"muted",style:lblStyle},"Курсы:"));
      for(const cid of knownCourses()){
        const lbl=COURSE_LABELS[cid]||cid.toUpperCase();
        const has=sc.includes(cid);
        const mods=MODULE_META.filter(m=>m.course===cid);
        const span=mods.length?mods[0].num+"–"+mods[mods.length-1].num:"";
        const cchip=h("button",{class:"chip mpchip "+(has?"acc":""),
          title:has?("Курс "+lbl+" выдан. Клик — забрать курс"):("Курс "+lbl+" не выдан. Клик — выдать курс")},
          has?lbl+" ✓":"+ "+lbl);
        cchip.addEventListener("click",()=>{
          if(!has){
            const tu=(s.trials||{})[cid];
            const isTrial=tu!==undefined&&accTrialActive(tu);
            if(isTrial)return ask("Курс "+lbl+" у ученика в триале"+(tu?" до "+tu:" без срока")+".",
              [["Продлить на неделю",accTrialSet(s,cid,accTrialDate(7))],
               ["Продлить на месяц",accTrialSet(s,cid,accTrialDate(30))],
               ["Сделать постоянным",accGrantCourse(s,cid)],
               ["Снять триал",accTrialRemove(s,cid)]]);
            return ask("Открыть ученику курс "+lbl+" ("+span+")? Первый модуль откроется сразу, дальше — по мере сдачи. Триал по истечении закроет занятия, результаты останутся видны.",
              [["Выдать насовсем",accGrantCourse(s,cid)],
               ["Триал неделя",accTrialSet(s,cid,accTrialDate(7))],
               ["Триал 2 недели",accTrialSet(s,cid,accTrialDate(14))],
               ["Триал месяц",accTrialSet(s,cid,accTrialDate(30))],
               ["Триал до даты…",()=>{const dstr=prompt("Последний день триала (ГГГГ-ММ-ДД):",accTrialDate(30));
                 if(!dstr)return null;
                 if(!/^\d{4}-\d{2}-\d{2}$/.test(dstr.trim())){alert("Формат даты: ГГГГ-ММ-ДД");return null;}
                 return accTrialSet(s,cid,dstr.trim());}]]);
          }
          const payload=accRevokeCourse(s,cid);
          if(!payload)return ask("Курс "+lbl+" — единственный выданный, забрать нельзя. Чтобы отключить ученика целиком, есть «Приостановить доступ».",[]);
          ask("Забрать у ученика курс "+lbl+" ("+span+")? Прогресс сохранится, но модули исчезнут из его тропы.",
            [["Забрать "+lbl,payload]]);
        });
        crow.append(cchip);
        // активный триал виден прямо в строке курсов — не открывая меню
        const tu=(s.trials||{})[cid];
        if(!has&&tu!==undefined&&accTrialActive(tu))
          crow.append(h("span",{class:"chip warn"},"триал"+(tu?" до "+tu:"")));
      }
      chipsRow.append(crow);
    }
    // Строка модулей на каждый выданный или триал-курс: чипы + пакетные действия.
    for(const cid of knownCourses()){
      const trialLive=(s.trials||{})[cid]!==undefined&&accTrialActive((s.trials||{})[cid]);
      if(!sc.includes(cid)&&!trialLive)continue;
      const lbl=COURSE_LABELS[cid]||cid.toUpperCase();
      const mods=MODULE_META.filter(m=>m.course===cid);
      const mrow=h("div",{style:rowStyle},h("span",{class:"muted",style:lblStyle},"Модули "+lbl+":"));
      for(const mm of mods){
        const stt=accStatus(s,mm.id);
        const cls=stt==="passed"?"ok":stt==="open"?"acc":stt==="locked_by_teacher"?"warn":"";
        const sttText=stt==="passed"?"сдан ✓":stt==="open"?"открыт":stt==="locked_by_teacher"?"закрыт вручную":"закрыт (откроется по тропе)";
        const chip=h("button",{class:"chip mpchip "+cls,title:mm.num+" · "+mm.title+" — "+sttText+". Клик — открыть/закрыть"},mm.num);
        chip.addEventListener("click",()=>{
          const granted=s.granted||[],locked=s.locked||[];
          const acts=[];
          if(locked.includes(mm.id))acts.push(["Снять закрытие",{locked:locked.filter(x=>x!==mm.id)}]);
          else acts.push(["Закрыть (на повтор)",{locked:locked.concat([mm.id])}]);
          if(granted.includes(mm.id))acts.push(["Убрать досрочное открытие",{granted:granted.filter(x=>x!==mm.id)}]);
          else if(stt==="locked")acts.push(["Открыть досрочно",{granted:granted.concat([mm.id])}]);
          ask(mm.num+" · "+mm.title+" — "+sttText+".",acts);
        });
        mrow.append(chip);
      }
      const openAll=accOpenAll(s,cid,MODULE_META);
      if(openAll){
        const b=h("button",{class:"chip mpchip",title:"Открыть ученику сразу все модули курса "+lbl},"открыть все");
        b.addEventListener("click",()=>ask("Открыть ученику сразу все модули "+lbl+" (кроме сданных)? Правило «сдал предыдущий — открылся следующий» для них перестанет действовать.",
          [["Открыть все "+lbl,openAll]]));
        mrow.append(b);
      }
      const reset=accResetManual(s,cid,MODULE_META);
      if(reset){
        const b=h("button",{class:"chip mpchip",title:"Снять все ручные открытия и закрытия в курсе "+lbl},"вернуть авто-тропу");
        b.addEventListener("click",()=>ask("Снять все ручные открытия и закрытия в "+lbl+"? Модули снова пойдут по тропе: сдал предыдущий — открылся следующий.",
          [["Вернуть авто-тропу",reset]]));
        mrow.append(b);
      }
      chipsRow.append(mrow);
    }
    // Триал-модули: одиночный модуль любого невыданного курса на срок. Активные — чипами
    // (клик — меню), новый — из селекта. Модули выданных курсов сюда не попадают:
    // внутри курса доступом управляет тропа и granted/locked.
    {
      const issued=new Set(accCourses(s).concat(Object.keys(s.trials||{}).filter(id=>knownCourses().includes(id)&&accTrialActive((s.trials||{})[id]))));
      const modTrials=Object.entries(s.trials||{}).filter(([id])=>!knownCourses().includes(id));
      const trow=h("div",{style:rowStyle},h("span",{class:"muted",style:lblStyle},"Триал-модули:"));
      for(const [mid,tu] of modTrials){
        const mm=MODULE_META.find(x=>x.id===mid);
        const live=accTrialActive(tu);
        const chip=h("button",{class:"chip mpchip "+(live?"acc":"warn"),
          title:(mm?mm.num+" · "+mm.title:mid)+(live?(tu?" — триал до "+tu:" — триал без срока"):" — триал истёк "+tu)+". Клик — меню"},
          (mm?mm.num:mid)+(live?(tu?" до "+tu.slice(5):""):" ✕"));
        chip.addEventListener("click",()=>ask((mm?mm.num+" · "+mm.title:mid)+(live?" — триал"+(tu?" до "+tu:" без срока"):" — триал истёк "+tu+" (результаты видны, занятия закрыты)")+".",
          [["Продлить на неделю",accTrialSet(s,mid,accTrialDate(7))],
           ["Продлить на месяц",accTrialSet(s,mid,accTrialDate(30))],
           ["Сделать постоянным (без срока)",accTrialSet(s,mid,null)],
           ["Снять триал",accTrialRemove(s,mid)]]));
        trow.append(chip);
      }
      const candidates=MODULE_META.filter(mm=>!issued.has(mm.course)&&!(s.trials||{})[mm.id]);
      if(candidates.length){
        const sel=h("select",{class:"btn ghost",style:"padding:4px 8px"});
        sel.append(h("option",{value:""},"+ модуль…"));
        for(const mm of candidates)sel.append(h("option",{value:mm.id},mm.num+" · "+mm.title));
        sel.addEventListener("change",()=>{
          const mid=sel.value;if(!mid)return;
          const mm=MODULE_META.find(x=>x.id===mid);sel.value="";
          ask("Триал модуля "+mm.num+" · "+mm.title+"? Модуль откроется сразу; по истечении занятия закроются, результаты останутся видны.",
            [["Неделя",accTrialSet(s,mid,accTrialDate(7))],
             ["2 недели",accTrialSet(s,mid,accTrialDate(14))],
             ["Месяц",accTrialSet(s,mid,accTrialDate(30))],
             ["Насовсем (без срока)",accTrialSet(s,mid,null)],
             ["До даты…",()=>{const dstr=prompt("Последний день триала (ГГГГ-ММ-ДД):",accTrialDate(30));
               if(!dstr)return null;
               if(!/^\d{4}-\d{2}-\d{2}$/.test(dstr.trim())){alert("Формат даты: ГГГГ-ММ-ДД");return null;}
               return accTrialSet(s,mid,dstr.trim());}]]);
        });
        trow.append(sel);
      }
      if(modTrials.length||candidates.length)chipsRow.append(trow);
    }
    // Аудирование — платная опция (эксперимент): тумблер + расход в единицах ElevenLabs.
    // Триальному не включить: сервер всё равно ответит «недоступно», поэтому тумблер прячем.
    if(accCourses(s).includes("a1")){
      const use=s.sttUse||{today:0,total:{n:0,sec:0}};
      const srow=h("div",{style:rowStyle},h("span",{class:"muted",style:lblStyle},"Аудирование:"),
        h("button",{class:"chip mpchip "+(s.sttOn?"acc":""),
          title:s.sttOn?"Опция включена. Клик — выключить":"Опция выключена (платная, эксперимент). Клик — включить"},
          s.sttOn?"вкл ✓":"выкл"),
        h("button",{class:"chip mpchip",title:"Дневной лимит распознаваний. Клик — изменить"},"лимит "+(s.sttLimit||20)+"/дн"),
        h("span",{class:"muted",style:"font-size:12px"},
          "сегодня "+use.today+"/"+(s.sttLimit||20)+" · всего "+use.total.n+" зап., "+Math.round(use.total.sec)+" с, "+(use.total.chars||0)+" зн."));
      srow.children[1].addEventListener("click",()=>{
        ask(s.sttOn?"Выключить ученику аудирование?":"Включить ученику аудирование (эксперимент)? Распознавание речи тратит квоту ElevenLabs; лимит по умолчанию — 20 записей в день.",
          [[s.sttOn?"Выключить":"Включить",{stt:!s.sttOn}]]);
      });
      srow.children[2].addEventListener("click",()=>{
        ask("Дневной лимит распознаваний для этого ученика (сейчас "+(s.sttLimit||20)+").",
          [["Изменить…",()=>{const v=prompt("Максимум распознаваний в день (1–500):",String(s.sttLimit||20));
             if(v==null)return null;
             const n=parseInt(v,10);
             if(!Number.isInteger(n)||n<1||n>500){alert("Число от 1 до 500");return null;}
             return {sttLimit:n};}],
           ["Вернуть 20 (по умолчанию)",{sttLimit:null}]]);
      });
      chipsRow.append(srow);
    }
    chipsRow.append(h("div",{class:"muted",style:"margin-top:4px;font-size:12px"},
      "Цвета: зелёный — сдан · синий — открыт · оранжевый — закрыт вручную · серый — откроется по тропе. Клик по чипу — меню."));
  };
  const controls=h("div",{class:"rev-controls",style:"margin-top:8px"});
  const renderControls=()=>{
    clear(controls);
    controls.append(h("button",{class:"btn "+(s.suspended?"":"secondary"),onclick:async()=>{
      try{const d=await putStudent({login:s.login,suspended:!s.suspended});Object.assign(s,d.student);renderControls();renderHead();}
      catch(e){msg.textContent="⚠ "+e.message;}
    }},icon(s.suspended?"play":"pause",14)," "+(s.suspended?t("stu_resume"):t("stu_suspend"))));
    // смена пароля
    controls.append(h("button",{class:"btn ghost",onclick:()=>{
      const np=prompt(passPrompt(s.login));
      if(np==null)return;
      putStudent({login:s.login,password:np}).then(()=>{msg.textContent="пароль обновлён ✓";})
        .catch(e=>{msg.textContent="⚠ "+e.message;});
    }},icon("key",14)," "+t("stu_pass")));
    // удаление
    controls.append(h("button",{class:"btn ghost",style:"color:var(--err);border-color:var(--err)",onclick:()=>{
      if(!confirm(delConfirm(s.login)))return;
      putStudent({login:s.login,remove:true}).then(onRemoved)
        .catch(e=>{msg.textContent="⚠ "+e.message;});
    }},icon("trash",14)," "+t("stu_del")));
    // Передача другому преподавателю — только админу и только для учеников. Прячем под кнопку:
    // группа уже подписана именем преподавателя, и повторять его в каждой карточке незачем.
    if(withModules&&isAdmin()&&teachers){
      controls.append(h("button",{class:"btn ghost",onclick:()=>{
        if(ownerMenu.firstChild){clear(ownerMenu);return;}
        const sel=h("select",{class:"btn ghost",style:"padding:6px 10px",onchange:async(ev)=>{
          try{await putStudent({login:s.login,owner:ev.target.value});onOwnerChange();}
          catch(e){msg.textContent="⚠ "+e.message;clear(ownerMenu);}
        }});
        sel.append(h("option",{value:""},t("own_none")));
        for(const tl of teachers)sel.append(h("option",{value:tl},tl));
        sel.value=s.owner||"";
        clear(ownerMenu).append(h("div",{class:"note"},t("own_label")+" ",sel,
          h("button",{class:"btn ghost",style:"margin-left:6px",onclick:()=>clear(ownerMenu)},"✕")));
      }},icon("shuffle",14)," "+t("own_move")));
    }
    controls.append(msg);
  };
  const head=h("div",{});
  const renderHead=()=>{
    clear(head).append(icon("user",15)," ",h("b",{},s.login),
      s.suspended?h("span",{class:"chip warn",style:"margin-left:8px"},t("stu_suspended")):h("span",{class:"chip ok",style:"margin-left:8px"},t("stu_active")));
  };
  renderHead();renderChips();renderControls();
  row.append(head,chipsRow,chipMenu,controls,ownerMenu);
  return row;
}
function adminRow(s){
  const row=h("div",{class:"card rev-row"});
  row.append(h("div",{},icon("user",15)," ",h("b",{},s.login),
    h("span",{class:"chip",style:"margin-left:8px"},t("role_admin"))),
    h("p",{class:"muted",style:"margin-top:6px"},t("tch_admin_note")));
  return row;
}
function renderStudents(m){
  if(!isTeacher()){m.append(h("div",{class:"card"},h("p",{class:"muted"},"Доступно только преподавателю.")));return;}
  const teacherListWrap=h("div",{});
  const studentListWrap=h("div",{});
  if(isAdmin()){
    const box=h("div",{class:"card"},
      h("h2",{},icon("users")," "+t("tch_section")),
      h("p",{class:"muted"},t("tch_hint")));
    const addMsg=h("span",{class:"muted"});
    const inpLogin=h("input",{type:"text",placeholder:"логин (латиница, 2–24)",autocapitalize:"off",style:"max-width:220px"});
    const inpPass=h("input",{type:"text",placeholder:"пароль (мин. 6)",style:"max-width:220px"});
    const addBtn=h("button",{class:"btn",onclick:async()=>{
      addMsg.textContent="";
      try{
        await putStudent({login:inpLogin.value.trim(),create:true,password:inpPass.value,role:"teacher"});
        inpLogin.value="";inpPass.value="";load();
      }catch(e){addMsg.textContent="⚠ "+e.message;}
    }},icon("plus",14)," "+t("tch_add"));
    box.append(h("div",{class:"rev-controls",style:"margin-top:10px"},inpLogin,inpPass,addBtn,addMsg));
    m.append(box,teacherListWrap);
  }
  // Очередь внимания: кого подтолкнуть и кого похвалить — по сигналам журнала занятий.
  const queueWrap=h("div",{});
  m.append(queueWrap);
  (async()=>{
    let rows;try{rows=await fetchRoster();}catch(e){return;}
    const now=Date.now();
    const dec=rows.map((r)=>Object.assign({flags:flagsOf(r,now)},r));
    const q=attentionQueue(dec);
    if(!q.need.length&&!q.praise.length)return;
    const card=h("div",{class:"card"},h("h2",{},icon("flame")," Очередь внимания"),
      h("p",{class:"muted"},"Сигналы из журнала занятий. «Скопировать» кладёт готовое сообщение в буфер — отправьте его ученику в WhatsApp или Telegram."));
    const copyBtn=(r)=>{
      const b=h("button",{class:"btn ghost"},"Скопировать сообщение");
      b.addEventListener("click",async()=>{
        try{await navigator.clipboard.writeText(nudgeText(r));b.textContent="Скопировано ✓";}
        catch{const ta=h("textarea",{style:"width:100%;margin-top:6px"},nudgeText(r));b.after(ta);ta.select();}
        setTimeout(()=>{b.textContent="Скопировать сообщение";},2500);
      });
      return b;
    };
    const row=(r)=>h("div",{style:"margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"},
      h("a",{href:"#",onclick:(e)=>{e.preventDefault();openRoster(r.login);}},h("b",{},r.login)),
      ...r.flags.map(flagChip).filter(Boolean),copyBtn(r));
    if(q.need.length){
      card.append(h("div",{class:"muted",style:"margin-top:8px;font-weight:700"},"Нужен толчок — "+q.need.length));
      q.need.forEach((r)=>card.append(row(r)));
    }
    if(q.praise.length){
      card.append(h("div",{class:"muted",style:"margin-top:10px;font-weight:700"},"Похвалить — "+q.praise.length));
      q.praise.forEach((r)=>card.append(row(r)));
    }
    queueWrap.append(card);
  })();
  const box2=h("div",{class:"card"},
    h("h2",{},icon("users")," "+t("tab_students")),
    h("p",{class:"muted"},"Добавляйте учеников, назначайте модули, меняйте пароли и управляйте доступом. Приостановленный ученик не может войти; его прогресс сохраняется и вернётся при возобновлении."));
  // форма добавления ученика
  const addMsg2=h("span",{class:"muted"});
  const inpLogin2=h("input",{type:"text",placeholder:"логин (латиница, 2–24)",autocapitalize:"off",style:"max-width:220px"});
  const inpPass2=h("input",{type:"text",placeholder:"пароль (мин. 6)",style:"max-width:220px"});
  const addBtn2=h("button",{class:"btn",onclick:async()=>{
    addMsg2.textContent="";
    try{
      await putStudent({login:inpLogin2.value.trim(),create:true,password:inpPass2.value});
      inpLogin2.value="";inpPass2.value="";load();
    }catch(e){addMsg2.textContent="⚠ "+e.message;}
  }},icon("plus",14)," "+t("stu_add"));
  box2.append(h("div",{class:"rev-controls",style:"margin-top:10px"},inpLogin2,inpPass2,addBtn2,addMsg2));
  m.append(box2,studentListWrap);
  const load=async()=>{
    clear(teacherListWrap);clear(studentListWrap);
    let students;
    try{students=await fetchStudents();}catch(e){studentListWrap.append(h("div",{class:"feedback err"},"⚠ "+e.message));return;}
    if(isAdmin()){
      for(const s of students.filter(x=>x.role==="admin"))teacherListWrap.append(adminRow(s));
      for(const s of students.filter(x=>x.role==="teacher")){
        teacherListWrap.append(userRow(s,{
          withModules:false,
          passPrompt:(login)=>tf("tch_pass_prompt",{login}),
          delConfirm:(login)=>tf("tch_del_confirm",{login}),
          onRemoved:load
        }));
      }
    }
    // Ученики — группами по преподавателю. Свои идут первыми: их открывают чаще всего.
    const pupils=students.filter(x=>x.role==="student");
    const teachers=students.filter(x=>x.role==="teacher"||x.role==="admin").map(x=>x.login);
    const groups=new Map();
    for(const s of pupils){
      const key=s.owner||"";
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(s);
    }
    const order=[...groups.keys()].sort((a,b)=>{
      if(a===ME.login)return -1;
      if(b===ME.login)return 1;
      if(a==="")return 1;          // «без преподавателя» — в конец
      if(b==="")return -1;
      return a.localeCompare(b);
    });
    for(const key of order){
      const list=groups.get(key);
      const title=key===""?t("own_none"):key===ME.login?t("own_mine"):key;
      // Владелец мог быть удалён — не молчим об этом, иначе ученики просто «пропадают из виду».
      const gone=key!==""&&!teachers.includes(key);
      studentListWrap.append(h("div",{class:"card",style:"padding:10px 14px"},
        h("b",{},icon("users",14)," "+title+" · "+list.length),
        gone?h("span",{class:"chip warn",style:"margin-left:8px"},t("own_gone")):null));
      for(const s of list)studentListWrap.append(userRow(s,{withModules:true,onRemoved:load,teachers,onOwnerChange:load}));
    }
  };
  load();
}

/* ---------- Мой прогресс: своя страница ученика и та же карточка у учителя ---------- */
function renderProgress(m,login,opts){
  opts=opts||{};
  const wrap=h("div",{});m.append(wrap);
  if(!login){wrap.append(h("div",{class:"card"},h("p",{class:"feedback err"},"⚠ "+t("pg_load_err"))));return;}
  loadProgress(wrap,login,opts);
}
async function loadProgress(wrap,login,opts){
  clear(wrap).append(h("div",{class:"card"},h("p",{class:"muted"},"…")));
  let stats,studentsRow=null;
  try{
    const studentsP=opts.teacher?fetchStudents().then(list=>list.find(s=>s.login===login)||null).catch(()=>null):Promise.resolve(null);
    [stats,studentsRow]=await Promise.all([fetchStats(login),studentsP]);
  }catch(e){
    clear(wrap).append(h("div",{class:"card"},h("p",{class:"feedback err"},"⚠ "+e.message)));
    return;
  }
  clear(wrap);
  renderProgressBody(wrap,login,stats,studentsRow,opts);
}
function localeOf(){return currentLang()==="tr"?"tr-TR":currentLang()==="en"?"en-US":"ru-RU";}
function renderProgressBody(wrap,login,stats,studentsRow,opts){
  const self=!opts.teacher||login===(ME&&ME.login);
  const today=dayKeyOf(new Date().toISOString());
  const streak=streakOf(stats.days,today);
  const activeDays=Object.values(stats.days).filter((d)=>d.ans>0).length;

  if(opts.teacher){
    wrap.append(h("div",{class:"rev-controls",style:"margin-bottom:6px"},
      h("button",{class:"btn ghost",onclick:closeRoster},t("rst_back")),
      h("b",{style:"margin-left:6px"},login)));
  }

  // 1. Приветствие, кольцо дневной цели и умный «Продолжить»: кнопка ведёт в модуль
  // с самой длинной очередью повторений — от открытия вкладки до первого ответа один тап.
  // Общие для нескольких блоков ниже величины считаются один раз:
  // план очереди, агрегат 7 дней, глобальное мастерство, статусы модулей.
  const plan=self?duePlan():null;
  const gm=self?globalMastery():null;
  let ans7=0,ok7=0,ms7=0,c7=new Date(today+"T00:00:00Z");
  for(let i=0;i<7;i++){
    const d=stats.days[c7.toISOString().slice(0,10)];
    if(d){ans7+=d.ans;ok7+=d.ok;ms7+=d.ms;}
    c7.setUTCDate(c7.getUTCDate()-1);
  }
  const myPassed=self?MODULE_META.filter((mm)=>moduleStatusOf(mm.id)==="passed"):[];
  if(self){
    const box1=h("div",{class:"card"});
    const todayAns=(stats.days[today]&&stats.days[today].ans)||0;
    box1.append(h("div",{style:"display:flex;gap:14px;align-items:center"},goalRing(todayAns,DAILY_GOAL),
      h("div",{},
        h("h2",{style:"margin:0 0 4px"},tf("pg_hello",{name:login})),
        h("p",{class:"muted",style:"margin:0"},plan.total
          ?tf("pg_due",{n:plan.total,w:nword(plan.total,"pg_card_forms"),m:Math.max(1,Math.ceil(plan.total/CARDS_PER_MIN))})
          :(streak.activeToday?tf("pg_today_done",{n:todayAns}):t("pg_all_done"))))));
    box1.append(h("button",{class:"btn",style:"margin-top:12px",onclick:()=>{if(plan.best)setModule(plan.best);go("cards");}},
      plan.total?tf("pg_due_go",{n:plan.total,w:nword(plan.total,"pg_card_forms")}):t("pg_continue")));
    wrap.append(box1);
  }

  // 1б-2. Слабые места по мини-тестам: последняя попытка каждого модуля с ошибками —
  // и одна кнопка, чтобы уйти повторять. Работает для всех М0–М23 из выданных курсов.
  if(self){
    const weakRows=[];
    for(const mm of MODULE_META){
      if(!myCourses().includes(mm.course))continue;
      const trec=(ST.modules[mm.id]&&ST.modules[mm.id].test)||null;
      const last=trec&&trec.attempts&&trec.attempts.length?trec.attempts[trec.attempts.length-1]:null;
      if(!last||!last.wrong||!last.wrong.length)continue;
      weakRows.push({mm,last});
    }
    if(weakRows.length){
      const wc=h("div",{class:"card"});
      wc.append(h("h2",{},icon("warn")," "+t("pg_weak_hdr")));
      for(const {mm,last} of weakRows){
        const row=h("div",{style:"margin:10px 0"});
        row.append(h("b",{},mm.num)," ",h("span",{class:"chip"},last.score+"/20")," ");
        for(const wid of last.wrong.slice(0,8))row.append(h("span",{class:"chip"},weakLabel(wid))," ");
        row.append(h("button",{class:"btn ghost",style:"padding:4px 10px;margin-left:4px",onclick:()=>goTab(mm.id,"cards",(last.wrong||[]).filter((wid)=>cardById(wid)))},t("pg_weak_go")));
        wc.append(row);
      }
      wrap.append(wc);
    }
  }

  // 1в. Мост к преподавателю: карточка появляется по сигналу, а не висит рекламой.
  if(self){
    let fails2Mod=null;
    for(const mm of MODULE_META){
      const trec=(ST.modules[mm.id]&&ST.modules[mm.id].test)||null;
      if(trec&&(trec.consecutiveFails||0)>=2&&moduleStatusOf(mm.id)==="open"){fails2Mod=mm.id;break;}
    }
    // экзаменационный модуль — по флагу exam в реестре (у курса без экзаменационной
    // недели, как одномодульный B1, мок-карточки нет — иначе она висела бы с первого дня)
    const mockMod=myCourses().map((cid)=>courseModules(cid).filter((mm)=>mm.exam).slice(-1)[0])
      .filter(Boolean).map((mm)=>mm.id).find((mid)=>moduleStatusOf(mid)==="open")||null;
    const lastPassed=myPassed.length?myPassed[myPassed.length-1].id:null;
    let dismissed=null;try{dismissed=localStorage.getItem("kga1-consult-hide");}catch{}
    const sig=consultSignal({fails2Mod,ans7,acc7:ans7?ok7/ans7:null,mockMod,lastPassed,dismissed});
    if(sig){
      const mm=sig.mod?metaOf(sig.mod):null;
      const sub={num:mm?mm.num:"",title:mm?metaTitle(mm):""};
      const lvl=sig.mod?(COURSE_LABELS[courseOf(sig.mod)]||""):"";
      let texts;
      switch(sig.kind){ // строим только выбранный вариант — остальным не нужны ни tf, ни гарды
        case "fail2":texts={txt:tf("cs_fail2",sub),wa:tf("cs_fail2_wa",sub),btn:t("cs_btn_talk")};break;
        case "lowacc":texts={txt:tf("cs_lowacc",{p:Math.round(ok7/ans7*100)}),wa:t("cs_lowacc_wa"),btn:t("cs_btn_talk")};break;
        case "mock":texts={txt:tf("cs_mock",{lvl}),wa:tf("cs_mock_wa",{lvl}),btn:t("cs_btn_mock")};break;
        default:texts={txt:tf("cs_talk",sub),wa:tf("cs_talk_wa",sub),btn:t("cs_btn_talk")};
      }
      const card=h("div",{class:"card",style:"border-left:4px solid var(--accent);display:flex;flex-direction:column;gap:12px;align-items:flex-start"});
      const row=h("div",{style:"display:flex;gap:10px;align-items:flex-start;width:100%"});
      row.append(h("span",{style:"flex:1;line-height:1.55"},texts.txt));
      if(sig.kind==="talk"){
        row.append(h("button",{class:"btn ghost",style:"padding:2px 8px;flex-shrink:0","aria-label":t("cs_hide"),
          onclick:()=>{try{localStorage.setItem("kga1-consult-hide",sig.mod);}catch{}card.remove();}},"✕"));
      }
      card.append(row);
      // разговор начинается здесь же: панель чата открывается с готовым текстом,
      // а не уводит в мессенджер (у части учеников он заблокирован)
      const cta=h("button",{class:"btn",type:"button"},texts.btn);
      cta.addEventListener("click",()=>openChatPanel(cta,{prefill:texts.wa}));
      card.append(cta);
      wrap.append(card);
    }
  }

  // 2. Серия дней + недельная цель (кольцо: активные дни недели из 5, микроцикл §5.4)
  //    + точки недели + эта неделя против прошлой. Прерванную серию подаём нейтрально.
  const streakBox=h("div",{class:"card"});
  streakBox.append(h("div",{style:"display:flex;align-items:center;gap:10px"},
    icon("flame",26),
    h("div",{style:"flex:1"},
      h("b",{style:"font-size:1.6rem;display:block"},streak.current?tf("pg_streak_days",{n:streak.current,w:nword(streak.current,"pg_day_forms")}):t("pg_streak_none")),
      h("span",{class:"muted",style:"font-size:.78rem"},tf("pg_streak_best",{n:streak.best}))),
    h("div",{style:"text-align:center;flex-shrink:0"},
      goalRing(weekActiveDays(stats.days,today),WEEK_GOAL_DAYS),
      h("span",{class:"muted",style:"font-size:.7rem;display:block;margin-top:2px"},t("pg_week_ring")))));
  const weekStart=new Date(today+"T00:00:00Z");weekStart.setUTCDate(weekStart.getUTCDate()-((weekStart.getUTCDay()+6)%7));
  const dots=h("div",{style:"display:flex;gap:6px;margin-top:10px"});
  for(let i=0;i<7;i++){
    const d=new Date(weekStart);d.setUTCDate(d.getUTCDate()+i);
    const k=d.toISOString().slice(0,10);
    const active=stats.days[k]&&stats.days[k].ans>0;
    dots.append(h("span",{style:"width:20px;height:20px;border-radius:99px;display:inline-block;background:var(--"+(active?"ok":"line2")+")"+(k===today?";box-shadow:0 0 0 2px var(--accent)":"")}));
  }
  streakBox.append(dots);
  const wcmp=weekCompare(stats.days,today);
  if(wcmp)streakBox.append(h("p",{class:"muted",style:"margin:10px 0 0;font-size:.85rem"},
    tf("pg_week_cmp",{a:wcmp.cur.ans,da:deltaTxt(wcmp.dAns),
      p:wcmp.cur.acc!=null?wcmp.cur.acc+"%":"—",dp:wcmp.dAcc!=null?deltaTxt(wcmp.dAcc):"—",
      m:wcmp.cur.min,dm:deltaTxt(wcmp.dMin)})));
  wrap.append(streakBox);

  // 3. Четыре плитки. У себя — слова из Лейтнера (есть локальный ST); у чужого ученика
  // (учитель) сырых боксов нет — GET /api/progress?login= не открыт (итерация 2),
  // поэтому берём модульный прогресс из уже доступного /api/students.
  // Ряды по дням (старые → новые) для спарклайнов и панелей; прошлая неделя — для дельты
  const days14=[];
  {
    const c=new Date(today+"T00:00:00Z");c.setUTCDate(c.getUTCDate()-13);
    for(let i=0;i<14;i++){
      const k=c.toISOString().slice(0,10);const d=stats.days[k]||{ans:0,ok:0,ms:0};
      days14.push({k,ans:d.ans||0,ok:d.ok||0,ms:d.ms||0});
      c.setUTCDate(c.getUTCDate()+1);
    }
  }
  let ansP=0,okP=0,msP=0;
  for(let i=0;i<7;i++){const d=days14[i];ansP+=d.ans;okP+=d.ok;msP+=d.ms;}
  const accSeries=days14.map((d)=>d.ans?Math.round(d.ok/d.ans*100):0);
  const minsSeries=days14.map((d)=>Math.round(d.ms/60000));
  const dayRows=()=>days14.slice().reverse().map((d)=>[
    new Date(d.k+"T00:00:00Z").toLocaleDateString(localeOf(),{day:"numeric",month:"short"}),
    String(d.ans),d.ans?Math.round(d.ok/d.ans*100)+"%":"—",String(Math.round(d.ms/60000))]);
  const daysPanel=(title)=>sidePanel(title,(body)=>{
    body.append(h("div",{style:"margin:0 0 10px"},sparkline(title===t("pg_tile_acc")?accSeries:minsSeries,200,40)));
    body.append(harmonyTable([L("Дата","Date","Tarih"),L("Ответы","Answers","Yanıt"),L("Точность","Accuracy","Doğruluk"),L("Мин","Min","Dk")],dayRows()));
  });
  // Дневные снапшоты закреплено/в работе — копятся локально, тренд появляется со 2-го дня
  if(self&&gm){
    ST.hist=ST.hist||{};
    const hcur=ST.hist[today];
    if(!hcur||hcur.m!==gm.mastered||hcur.w!==gm.inwork){
      ST.hist[today]={m:gm.mastered,w:gm.inwork};
      const keys=Object.keys(ST.hist).sort();
      while(keys.length>30)delete ST.hist[keys.shift()];
      try{localStorage.setItem(LS_KEY,JSON.stringify(ST));}catch(e){}
    }
  }
  const histSeries=(f)=>{
    if(!ST.hist)return [];
    return Object.keys(ST.hist).sort().slice(-14).map((k)=>ST.hist[k][f]);
  };
  // Слово в панели — не тупик: строка показывает уровень Лейтнера и дату повтора,
  // тап уводит в карточки модуля. Сверху — распределение слов по уровням.
  // cardsTopic сбрасывается: клик по слову — явное намерение, и липкая тема карточек
  // (в первую очередь «__marked», которая не сбрасывалась никогда) не должна его фильтровать.
  const goTab=(mid,tab,ids)=>{FOCUS_POOL=Array.isArray(ids)&&ids.length?ids:null;cardsTopic=null;closeSidePanel();setModule(mid,true);go(tab);};
  const boxDots=(box)=>{
    const wrap2=h("span",{style:"letter-spacing:2px;font-size:.72rem"});
    for(let i=0;i<MASTERY_BOX;i++)wrap2.append(h("span",{style:"color:var(--"+(i<box?"accent":"line")+")"},i<box?"●":"○"));
    // бокс 4 — закрепление, подтверждённое через 16 дней; без метки он неотличим от свежего
    if(box>MASTERY_BOX)wrap2.append(h("span",{style:"color:var(--ok)"},"✓"));
    return wrap2;
  };
  const dueText=(cs)=>{
    if(!cs.due)return "";
    const days=Math.ceil((cs.due-Date.now())/86400000);
    if(days<=0)return L("повторить сегодня","review today","bugün tekrar et");
    return L("повтор через "+days+" "+nword(days,"pg_day_forms"),"review in "+days+" "+nword(days,"pg_day_forms"),days+" "+nword(days,"pg_day_forms")+" sonra tekrar");
  };
  const wordsPanel=(kind)=>sidePanel(t(kind==="m"?"pg_tile_mastered":"pg_tile_inwork"),(body)=>{
    const byMod={};const boxes=new Array(MASTERY_BOX+1).fill(0);let n=0;
    for(const c of allCards()){
      if(isSkipped(c.id))continue; // отложенные — в своей панели, не среди изучаемых
      const hit=kind==="m"?isMastered(c.id):(!isMastered(c.id)&&!isNew(c.id));
      if(!hit)continue;
      boxes[Math.min(cardState(c.id).box,MASTERY_BOX)]++;
      const hm=homeOf(c.id);
      (byMod[hm]=byMod[hm]||[]).push(c);n++;
    }
    // распределение по уровням: подложка во весь рост, нулевые ступени честно пустые
    body.append(h("h3",{style:"margin:0 0 6px"},t("sp_boxes")));
    const maxB=Math.max(...boxes,1);
    const bars=h("div",{style:"display:flex;gap:8px;justify-content:center;margin-bottom:16px"});
    boxes.forEach((cnt,bi)=>{
      const fill=h("b",{style:"height:"+(cnt?Math.max(4,Math.round(cnt/maxB*36)):0)+"px"});
      bars.append(h("div",{class:"wp-bar"},
        h("div",{class:"muted",style:"font-size:.7rem"},String(cnt)),
        h("i",{},fill),
        h("div",{class:"muted",style:"font-size:.7rem"},bi===MASTERY_BOX?"✓":String(bi))));
    });
    body.append(bars);
    for(const [mid,list] of Object.entries(byMod)){
      const ids=list.map((c)=>c.id);
      const hd=h("div",{style:"display:flex;align-items:center;justify-content:space-between;margin:12px 0 4px"});
      hd.append(h("h3",{style:"margin:0"},metaOf(mid).num+" · "+list.length));
      // Курс отняли — результаты по нему видны, но увести в занятия отсюда нельзя
      if(studyOpen(mid))hd.append(h("button",{class:"btn ghost",style:"padding:3px 10px;font-size:.8rem",onclick:()=>goTab(mid,"cards",ids)},t("sp_go_cards")));
      body.append(hd);
      for(const c of list.slice(0,40)){
        const cs=cardState(c.id);
        const row=h("div",{class:"wp-row"});
        row.append(h("span",{class:"kgword"},c.ky),
          h("span",{class:"wp-gloss"},gloss(c)),
          h("span",{class:"wp-meta"},boxDots(cs.box),h("span",{class:"wp-due"},dueText(cs))));
        // клик по слову: колода начинается с него, дальше — остальные слова этой группы
        if(studyOpen(mid))row.addEventListener("click",()=>goTab(mid,"cards",[c.id].concat(ids.filter((x)=>x!==c.id))));
        body.append(row);
      }
      if(list.length>40)body.append(h("p",{class:"muted",style:"margin:4px 0"},"+"+(list.length-40)));
    }
  });
  // Отложенные слова: их нет ни в одной колоде и ни в одном знаменателе, поэтому
  // список обязан быть виден и обратим — иначе слово исчезает без следа.
  const skippedPanel=()=>sidePanel(t("sp_skipped"),(body)=>{
    const byMod={};
    for(const c of allCards()){
      if(!isSkipped(c.id))continue;
      const hm=homeOf(c.id);(byMod[hm]=byMod[hm]||[]).push(c);
    }
    if(!Object.keys(byMod).length){body.append(h("p",{class:"muted"},t("sp_skipped_empty")));return;}
    for(const [mid,list] of Object.entries(byMod)){
      body.append(h("h3",{style:"margin:12px 0 4px"},metaOf(mid).num+" · "+list.length));
      for(const c of list){
        const row=h("div",{class:"wp-row"});
        row.append(h("span",{class:"kgword"},c.ky),h("span",{class:"wp-gloss"},gloss(c)),
          h("button",{class:"btn ghost",style:"padding:3px 10px;font-size:.8rem",
            onclick:()=>{toggleSkipped(c.id);evPush("card.skip",{mod:homeOf(c.id),cardId:c.id,on:false});closeSidePanel();skippedPanel();}},t("skip_return")));
        body.append(row);
      }
    }
  });
  const tiles=[];
  if(self){
    const mh=histSeries("m"),wh=histSeries("w");
    tiles.push(statTile(gm.mastered,t("pg_tile_mastered"),{onclick:()=>wordsPanel("m"),
      trend:trendEl(mh,gm.mastered,mh.length>=2?mh[0]:null,"")}));
    tiles.push(statTile(gm.inwork,t("pg_tile_inwork"),{onclick:()=>wordsPanel("w"),
      trend:trendEl(wh,gm.inwork,wh.length>=2?wh[0]:null,"")}));
  }else{
    const modsArr=(studentsRow&&studentsRow.modules)||[];
    // знаменатель — тропа ученика (сервер отдаёт только модули выданных ему курсов),
    // а не весь каталог: с появлением A2 у ученика A1 он не должен «разбухнуть»
    const studyMods=modsArr.filter((x)=>x.status!=="result_only"); // отнятый курс не раздувает знаменатель
    tiles.push(statTile(studyMods.filter((x)=>x.status==="passed").length+"/"+(studyMods.length||MODULE_META.length),t("pg_tile_modpassed")));
    tiles.push(statTile(modsArr.filter((x)=>x.status==="open").length,t("pg_tile_modopen")));
  }
  const acc7=ans7?Math.round(ok7/ans7*100):null,accP=ansP?Math.round(okP/ansP*100):null;
  tiles.push(statTile(acc7!=null?acc7+"%":"—",t("pg_tile_acc"),{onclick:()=>daysPanel(t("pg_tile_acc")),
    trend:trendEl(accSeries,acc7,accP," пп")}));
  const mins7=Math.round(ms7/60000),minsP=Math.round(msP/60000);
  tiles.push(statTile(mins7>=60?tf("pg_hmin",{h:Math.floor(mins7/60),m:mins7%60}):tf("pg_min",{n:mins7}),t("pg_tile_time"),
    {onclick:()=>daysPanel(t("pg_tile_time")),trend:trendEl(minsSeries,mins7,minsP,"м")}));
  wrap.append(statRow(...tiles));
  if(self&&gm.skipped)wrap.append(h("p",{class:"muted",style:"margin:6px 0 0;cursor:pointer",onclick:skippedPanel},
    tf("pg_skipped",{n:gm.skipped})));
  // Решения ученика о словах — и в карточке у преподавателя: «уже знаю» без единого
  // ввода и отложенные слова видны сводкой, не только построчно в ленте.
  if(!self){
    const dec=Object.values(stats.decide||{});
    const known=dec.filter((d)=>d.kind==="know").length,skipped=dec.filter((d)=>d.kind==="skip").length;
    if(known||skipped)wrap.append(h("p",{class:"muted",style:"margin:6px 0 0"},tf("pg_decide",{k:known,s:skipped})));
  }

  // 3б. Вехи: ачивки из уже имеющихся данных. Неполученные показываем приглушённо
  // с условием — цель видна заранее, это и есть мотивация.
  if(self){
    let totalAns=0;for(const d of Object.values(stats.days))totalAns+=d.ans||0;
    const passedSet=new Set(myPassed.map((mm)=>mm.id));
    const a1Mods=courseModules("a1");
    const a1All=a1Mods.every((mm)=>passedSet.has(mm.id));
    const a2Any=courseModules("a2").some((mm)=>passedSet.has(mm.id));
    const passedN=myPassed.length;
    const perfect=(stats.tests||[]).some((ts)=>ts.score>=20);
    const BADGES=[
      ["cards","bd_10",gm.mastered+gm.inwork>=10],
      ["star","bd_100",gm.mastered>=100],
      ["star","bd_500",gm.mastered>=500],
      ["star","bd_1000w",gm.mastered>=1000],
      ["flame","bd_streak7",streak.best>=7],
      ["flame","bd_streak30",streak.best>=30],
      ["flame","bd_streak100",streak.best>=100],
      ["check","bd_mod1",passedN>=1],
      ["book","bd_a1",a1All],
      ["chart","bd_a2",a2Any],
      ["wave","bd_1000",totalAns>=1000],
      ["check","bd_perfect",perfect]
    ];
    // Фиксация с датой: заработанное не гаснет (mastered может просесть после
    // ошибок), свежая веха — событием в журнал (видят ученик и преподаватель).
    ST.badges=ST.badges||{};
    const freshB=badgesCommit(ST.badges,BADGES.map((b)=>[b[1],b[2]]),today);
    if(freshB.length){
      for(const key of freshB){try{evPush("badge.earn",{badge:key});}catch(e){}}
      try{save();}catch(e){}
    }
    const got=BADGES.filter((b)=>ST.badges[b[1]]).length;
    const bBox=h("div",{class:"card"});
    bBox.append(h("h2",{},icon("star")," "+t("bd_hdr")+" ",h("span",{class:"chip"},got+"/"+BADGES.length)));
    const grid=h("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px"});
    for(const [ic,key] of BADGES){
      const date=ST.badges[key];
      grid.append(h("div",{style:"display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px"+(date?"":";opacity:.45")},
        h("span",{style:"width:34px;height:34px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--"+(date?"ok-soft":"line2")+");color:var(--"+(date?"ok":"muted")+")"},icon(ic,17)),
        h("span",{style:"font-size:.82rem;line-height:1.25"},t(key),
          date?h("span",{class:"muted",style:"display:block;font-size:.7rem"},new Date(date+"T00:00:00Z").toLocaleDateString(localeOf(),{day:"numeric",month:"short",year:"numeric"})):null)));
    }
    bBox.append(grid);
    wrap.append(bBox);
  }

  // Первые дни — вместо календаря и истории тестов одна карточка-цель: нули на графике
  // демотивируют сильнее, чем их отсутствие.
  if(activeDays<3){
    wrap.append(emptyState("flame",t("pg_start_hdr"),t("pg_start_txt")));
  }

  // 4. Календарь активности
  if(activeDays>=3){
    const calBox=h("div",{class:"card"});
    calBox.append(h("h2",{},icon("calendar")," "+t("pg_cal_hdr")));
    // heatmap() принимает {день: число} — stats.days хранит {день:{ms,ans,ok}}, разворачиваем
    // в счётчик ответов (интенсивность занятия), иначе сравнение объекта с числом всегда ложно.
    const dayCounts={};
    for(const [k,d] of Object.entries(stats.days))dayCounts[k]=d.ans||0;
    calBox.append(heatmap(dayCounts,{weeks:26,aria:tf("pg_cal_aria",{n:activeDays})}).wrap);
    wrap.append(calBox);
  }

  // 5. Слова, которым нужно внимание — топ-10 по доле ошибок
  const weakBox=h("div",{class:"card"});
  weakBox.append(h("h2",{},icon("target")," "+t("pg_weak_hdr")));
  const weakEntries=Object.entries(stats.weak||{}).sort((a,b)=>b[1].wrong-a[1].wrong).slice(0,10);
  if(!weakEntries.length){
    weakBox.append(h("p",{class:"muted"},t("pg_weak_empty")));
  }else{
    for(const [id,w] of weakEntries){
      const c=cardById(id);
      const row=h("div",{class:"rev-row",style:"padding:6px 0;border-bottom:1px solid var(--line)"});
      if(c)row.append(h("span",{class:"kgword"},c.ky)," ",h("span",{class:"muted"},gloss(c)));
      else row.append(h("span",{class:"muted"},id));
      row.append(h("span",{class:"chip warn",style:"margin-left:8px"},w.wrong+"/"+w.seen));
      if(c){const snd=sndBtn(c.id);if(snd)row.append(snd);}
      weakBox.append(row);
    }
  }
  wrap.append(weakBox);

  // 6. История мини-тестов — провал подаём нейтрально, не как ошибку. Тап по строке
  // открывает панель разбора: динамика попыток, ошибки и верные ответы, выходы
  // в карточки модуля и к преподавателю (текст письма уже собран из результата).
  if(activeDays>=3||(stats.tests||[]).length){
    const openAttempt=(ts)=>sidePanel(metaOf(ts.mod).num+" — "+metaTitle(metaOf(ts.mod)),(body)=>{
      // герой: крупный счёт, полоса до порога, статус
      body.append(h("div",{style:"display:flex;align-items:baseline;gap:10px;margin:0 0 4px"},
        h("b",{style:"font-size:1.9rem"},ts.score+"/20"),
        ts.passed?h("span",{class:"chip ok"},t("pg_test_ok")):h("span",{class:"chip"},t("pg_test_retry")),
        h("span",{class:"muted",style:"font-size:.8rem"},new Date(ts.at).toLocaleString(localeOf()))));
      body.append(bar(ts.score/20*100));
      if(!ts.passed)body.append(h("p",{class:"muted",style:"margin:6px 0 0;font-size:.85rem"},tf("sp_gap",{n:Math.max(1,16-ts.score)})));
      const hist=stats.tests.filter((x)=>x.mod===ts.mod).slice(0,12).reverse();
      if(hist.length>=2){
        body.append(h("h3",{style:"margin:16px 0 6px"},t("sp_dyn")),lineChart(hist.map((x)=>x.score),{threshold:16}),
          h("p",{class:"muted",style:"margin:4px 0 0;font-size:.78rem"},hist.map((x)=>x.score).join(" → ")+" · "+L("порог 16","pass mark 16","geçme barajı 16")));
      }
      // ошибки — строками с перевод-подсказкой и переходом в нужную тренировку
      if(ts.wrong&&ts.wrong.length){
        body.append(h("h3",{style:"margin:16px 0 4px;color:var(--err)"},t("sp_wrong")+" · "+ts.wrong.length));
        const wrongWordIds=ts.wrong.filter((wid)=>cardById(wid));
        for(const wid of ts.wrong){
          const c=cardById(wid);
          const drill=!c; // h_row/h_affix — задания дриллов, слова — карточки
          const row=h("div",{class:"wp-row"});
          row.append(h("span",{class:"kgword",style:"color:var(--err)"},weakLabel(wid)),
            c?h("span",{class:"wp-gloss"},gloss(c)):h("span",{}),
            h("span",{class:"wp-meta muted",style:"font-size:.75rem"},drill?t("sp_go_drill"):t("sp_go_cards")));
          if(studyOpen(ts.mod))row.addEventListener("click",()=>goTab(ts.mod,drill?"harmony":"cards",
            drill?null:[wid].concat(wrongWordIds.filter((x)=>x!==wid))));
          body.append(row);
        }
      }
      if(ts.right&&ts.right.length){
        body.append(h("h3",{style:"margin:16px 0 4px;color:var(--ok)"},t("sp_right")+" · "+ts.right.length));
        for(const rid of ts.right)body.append(h("span",{class:"chip ok",style:"margin:2px 4px 2px 0"},weakLabel(rid))," ");
      }else if(!(ts.wrong&&ts.wrong.length)){
        body.append(h("p",{class:"muted"},t("pg_test_nodetails")));
      }
      const btns=h("div",{class:"rev-controls",style:"margin-top:18px"});
      if(studyOpen(ts.mod)){ // модуль отнятого курса: разбор попытки виден, вернуться в занятия нельзя
        btns.append(h("button",{class:"btn",onclick:()=>goTab(ts.mod,"cards",(ts.wrong||[]).filter((wid)=>cardById(wid)))},t("pg_weak_go")));
        btns.append(h("button",{class:"btn secondary",onclick:()=>goTab(ts.mod,"test")},t("sp_retry_test")));
      }
      if(self){
        const weakTxt=(ts.wrong||[]).slice(0,8).map(weakLabel).join(", ");
        const askTxt=tf("pg_test_wa",{m:metaOf(ts.mod).num,s:ts.score,w:weakTxt||"—"});
        const askBtn=h("button",{class:"btn ghost",type:"button"},t("pg_test_write"));
        askBtn.addEventListener("click",()=>openChatPanel(askBtn,{prefill:askTxt}));
        btns.append(askBtn);
      }
      body.append(btns);
    });
    const testsBox=h("div",{class:"card"});
    testsBox.append(h("h2",{},icon("check")," "+t("pg_tests_hdr")),
      h("p",{class:"muted",style:"margin:-4px 0 10px;font-size:.85rem"},t("pg_tests_hint")));
    if(!stats.tests.length){
      testsBox.append(h("p",{class:"muted"},t("pg_tests_empty")));
    }else{
      const recent=stats.tests.slice(0,12).reverse();
      if(recent.length>=2)testsBox.append(lineChart(recent.map((x)=>x.score),{threshold:16,h:72}),
        h("p",{class:"muted",style:"margin:2px 0 12px;font-size:.75rem"},L("Порог сдачи — 16/20 (пунктир)","Pass mark — 16/20 (dashed)","Geçme barajı — 16/20 (kesikli çizgi)")));
      const list=stats.tests.slice(0,20);
      const tbl=harmonyTable([L("Модуль","Module","Modül"),L("Дата","Date","Tarih"),L("Счёт","Score","Puan"),L("Статус","Status","Durum"),"✗"],
        list.map((ts)=>[
          metaOf(ts.mod).num,
          new Date(ts.at).toLocaleDateString(localeOf()),
          ts.score+"/20",
          ts.passed?h("span",{class:"chip ok"},t("pg_test_ok")):h("span",{class:"chip"},t("pg_test_retry")),
          (ts.wrong&&ts.wrong.length)?String(ts.wrong.length):"—"
        ]));
      // строки таблицы кликабельны — открывают панель разбора
      tbl.querySelectorAll("tbody tr,tr").forEach((tr,i)=>{
        if(!tr.querySelector("td"))return;
        const idx=Array.prototype.filter.call(tr.parentNode.children,(x)=>x.querySelector&&x.querySelector("td")).indexOf(tr);
        if(idx<0||idx>=list.length)return;
        tr.style.cursor="pointer";
        tr.addEventListener("click",()=>openAttempt(list[idx]));
      });
      testsBox.append(tbl);
    }
    wrap.append(testsBox);
  }

  // 7. Путь по модулям — у себя точный градуированный прогресс (есть ST), у чужого — по статусу.
  // Итерация — по курсам смотримого человека, не по всему каталогу: ученик без A2 не должен
  // видеть в своём прогрессе запертые модули невыданного курса.
  const modsBox=h("div",{class:"card"});
  modsBox.append(h("h2",{},icon("book")," "+t("pg_mods_hdr")));
  if(self){
    // остаток — по модулям выданных курсов (тот же скоуп, что и список ниже)
    const remaining=myCourses().reduce((n,cid)=>n+courseModules(cid).filter((mm)=>!myPassed.some((p)=>p.id===mm.id)).length,0);
    const fc=finishForecast(stats.days,today,remaining);
    if(fc){
      const fdate=new Date(fc+"T00:00:00Z").toLocaleDateString(localeOf(),{day:"numeric",month:"long"});
      modsBox.append(h("p",{class:"muted",style:"margin:4px 0 0;font-size:.85rem"},tf("pg_forecast",{n:remaining,w:nword(remaining,"pg_mod_forms"),r:nword(remaining,"pg_left_forms"),d:fdate})));
    }
  }
  const modsArr=self?((ME&&ME.modules)||[]):((studentsRow&&studentsRow.modules)||[]);
  const pathCourses=self?myCourses():(((studentsRow&&studentsRow.courses)||["a1"]).filter((c)=>knownCourses().includes(c)));
  for(const cid of pathCourses.length?pathCourses:["a1"]){
    if(pathCourses.length>1)modsBox.append(h("div",{class:"muted",style:"font-size:.8rem;margin:10px 0 2px;font-weight:600"},
      t("sec_course")+" "+(COURSE_LABELS[cid]||cid.toUpperCase())));
  for(const mm of courseModules(cid)){
    const st=(modsArr.find((x)=>x.id===mm.id)||{}).status||"locked";
    const pct=self&&CONTENT[mm.id]?Math.round(progressScoreFor(vocabIdsOf(mm.id).map((id)=>({id})))*100)
      :(st==="passed"?100:st==="open"?40:0);
    const cls=st==="passed"?"ok":st==="open"?"acc":"";
    const label=st==="passed"?t("st_passed"):st==="open"?t("st_open"):st==="locked_by_teacher"?t("st_locked_t"):t("st_locked");
    // «N к повторению» — из уже посчитанного duePlan().byMod, тап ведёт в карточки модуля
    const dueN=plan?(plan.byMod[mm.id]||0):0;
    const dueChip=dueN?h("button",{class:"chip warn",style:"cursor:pointer;border:0",
      onclick:()=>{setModule(mm.id);go("cards");}},tf("pg_due_chip",{n:dueN})):null;
    modsBox.append(h("div",{style:"margin:8px 0"},
      h("div",{style:"display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:.85rem;margin-bottom:2px"},
        h("span",{},mm.num+" · "+metaTitle(mm)),
        appendKids(h("span",{style:"display:flex;gap:6px;align-items:center"}),dueChip,h("span",{class:"chip "+cls},label))),
      bar(pct)));
  }
  }
  wrap.append(modsBox);

  // 8. Приватность
  wrap.append(h("p",{class:"muted",style:"font-size:.78rem;text-align:center;margin-top:6px"},t("pg_privacy")));
}

/* ---------- Успеваемость: дашборд учителя ---------- */
let rosterFilter="all",rosterSearch="",rosterSort="flags",rosterDir="desc";
function renderRoster(m){
  if(!isTeacher()){m.append(h("div",{class:"card"},h("p",{class:"muted"},"Доступно только преподавателю.")));return;}
  const wrap=h("div",{});m.append(wrap);
  loadRoster(wrap);
}
async function loadRoster(wrap){
  clear(wrap).append(h("div",{class:"card"},h("p",{class:"muted"},"…")));
  let rows;
  try{rows=await fetchRoster();}
  catch(e){clear(wrap).append(h("div",{class:"card"},h("p",{class:"feedback err"},"⚠ "+e.message)));return;}
  renderRosterBody(wrap,rows);
}
function lastSeenText(iso,now){
  if(!iso)return t("rst_never");
  const days=Math.floor((now-Date.parse(iso))/86400000);
  if(days<=0)return t("rst_today_w");
  if(days===1)return t("rst_yesterday");
  return tf("rst_ago",{n:days});
}
function flagChip(f){
  if(f.key==="never")return h("span",{class:"chip warn"},t("rst_flag_never"));
  if(f.key==="idle")return h("span",{class:"chip warn"},tf("rst_flag_idle",{n:f.n}));
  if(f.key==="fail2")return h("span",{class:"chip warn"},t("rst_flag_fail2"));
  if(f.key==="streak")return h("span",{class:"chip ok"},tf("rst_flag_streak",{n:f.n}));
  return null;
}
function buildRosterTable(rows,now,onChange){
  const sorted=[...rows].sort((a,b)=>{
    let av,bv;
    if(rosterSort==="login"){av=a.login;bv=b.login;}
    else if(rosterSort==="last"){av=a.lastSeen?Date.parse(a.lastSeen):0;bv=b.lastSeen?Date.parse(b.lastSeen):0;}
    else if(rosterSort==="streak"){av=a.streak;bv=b.streak;}
    else if(rosterSort==="progress"){av=a.progress;bv=b.progress;}
    else if(rosterSort==="acc"){av=a.acc7==null?-1:a.acc7;bv=b.acc7==null?-1:b.acc7;}
    else{av=a.flags.some((f)=>f.key==="idle"||f.key==="fail2")?1:0;bv=b.flags.some((f)=>f.key==="idle"||f.key==="fail2")?1:0;}
    const cmp=av<bv?-1:av>bv?1:0;
    return rosterDir==="desc"?-cmp:cmp;
  });
  if(!sorted.length)return h("div",{class:"card"},h("p",{class:"muted"},t("rst_empty")));
  const cols=[
    {key:"login",label:t("rst_c_student"),val:(r)=>r.login,cell:(r)=>h("a",{href:"#",onclick:(e)=>{e.preventDefault();openRoster(r.login);}},r.login)},
    {key:"last",label:t("rst_c_last"),val:(r)=>r.lastSeen||"",cell:(r)=>lastSeenText(r.lastSeen,now)},
    {key:"streak",label:t("rst_c_streak"),cls:"col-opt",val:(r)=>r.streak,cell:(r)=>r.streak?("🔥 "+r.streak):"—"},
    {key:"progress",label:t("rst_c_progress"),val:(r)=>r.progress,cell:(r)=>bar(Math.round(r.progress*100),{text:Math.round(r.progress*100)+"%"})},
    {key:"acc",label:t("rst_c_acc"),cls:"col-opt",val:(r)=>(r.acc7==null?-1:r.acc7),cell:(r)=>(r.acc7==null?"—":Math.round(r.acc7*100)+"%")},
    {key:"tests",label:t("rst_c_tests"),cls:"col-opt",cell:(r)=>(r.lastTest?(r.lastTest.score+"/"+(r.lastTest.total||20)):"—")},
    {key:"flags",label:t("rst_c_flags"),cell:(r)=>h("span",{},...r.flags.map(flagChip).filter(Boolean))},
    {key:"open",label:"",cell:(r)=>h("button",{class:"btn ghost",onclick:()=>openRoster(r.login)},t("rst_open"))}
  ];
  return sortableTable(cols,sorted,{sort:rosterSort,dir:rosterDir,onSort:(key,dir)=>{rosterSort=key;rosterDir=dir;onChange();}});
}
/* Панель деталей справа: за числом сводки — поимённый список. Своя разметка, без
   библиотек; закрывается по Esc, клику по фону и кнопке, фокус уходит внутрь и
   возвращается на плитку — иначе с клавиатуры панель была бы ловушкой. */
function openRosterPanel(kind,list,opener){
  // плитку запоминаем явно, а не через activeElement: Safari не фокусирует кнопку по клику,
  // и фокус после закрытия улетал бы в начало страницы
  const back=h("div",{class:"panel-back"});
  const panel=h("aside",{class:"panel",role:"dialog","aria-modal":"true","aria-label":t("rst_p_"+kind)});
  const close=()=>{back.remove();panel.remove();document.removeEventListener("keydown",onKey);if(opener&&opener.focus)opener.focus();};
  const onKey=(e)=>{if(e.key==="Escape")close();};
  document.addEventListener("keydown",onKey);
  back.addEventListener("click",close);
  const closeBtn=h("button",{class:"btn ghost",type:"button"},t("rst_p_close"));
  closeBtn.addEventListener("click",close);
  panel.append(h("div",{class:"panel-head"},h("h2",{},t("rst_p_"+kind)," ",h("span",{class:"chip"},String(list.length))),closeBtn));
  const body=h("div",{class:"panel-body"});
  if(!list.length)body.append(h("p",{class:"muted"},t("rst_p_empty")));
  else{
    body.append(h("p",{class:"muted",style:"margin:0 0 8px"},t("rst_p_hint")));
    const now=Date.now();
    for(const r of list){
      const row=h("button",{class:"panel-row",type:"button"},
        h("span",{class:"panel-row-top"},h("b",{},r.login),h("span",{class:"muted"},lastSeenText(r.lastSeen,now))),
        h("span",{class:"panel-row-sub"},
          h("span",{class:"muted"},t("rst_c_progress")+": "+Math.round(r.progress*100)+"%"),
          h("span",{class:"muted"},t("rst_c_acc")+": "+(r.acc7==null?"—":Math.round(r.acc7*100)+"%")),
          h("span",{class:"muted"},t("rst_c_tests")+": "+(r.lastTest?(r.lastTest.score+"/"+(r.lastTest.total||20)):"—"))),
        h("span",{class:"panel-row-flags"},...r.flags.map(flagChip).filter(Boolean)));
      row.addEventListener("click",()=>{close();openRoster(r.login);});
      body.append(row);
    }
  }
  panel.append(body);
  document.body.append(back,panel);
  closeBtn.focus();
}
function renderRosterBody(wrap,rows){
  clear(wrap);
  const now=Date.now();
  const decorated=rows.map((r)=>Object.assign({flags:flagsOf(r,now)},r));
  const todayKey=dayKeyOf(new Date().toISOString());
  const subset=(kind)=>rosterSubset(decorated,kind,now,todayKey);
  // Плитка — кнопка: за каждым числом стоит список, и он открывается панелью справа
  const miniStat=(text,kind,tone)=>{
    const b=h("button",{class:"stat statbtn",type:"button"},h("b",{style:tone?("color:var(--"+tone+")"):""},text));
    b.addEventListener("click",()=>openRosterPanel(kind,subset(kind),b));
    return b;
  };
  const attentionN=subset("attention").length;
  const summary=h("div",{class:"card"});
  summary.append(h("h2",{},icon("chart")," "+t("tab_roster")));
  summary.append(statRow(
    miniStat(tf("rst_today",{a:subset("today").length,b:decorated.length}),"today"),
    miniStat(tf("rst_week",{a:subset("week").length,b:decorated.length}),"week"),
    miniStat(tf("rst_attention",{n:attentionN}),"attention",attentionN?"warn":null)));
  wrap.append(summary);

  const tableWrap=h("div",{});
  const rerender=()=>{
    clear(tableWrap);
    let filtered=decorated;
    if(rosterFilter==="mine")filtered=filtered.filter((r)=>r.owner===(ME&&ME.login));
    else if(rosterFilter==="attention")filtered=subset("attention");
    else if(rosterFilter==="active")filtered=subset("today");
    if(rosterSearch)filtered=filtered.filter((r)=>r.login.toLowerCase().includes(rosterSearch));
    tableWrap.append(buildRosterTable(filtered,now,rerender));
  };
  const filters=chipRow([
    {val:"all",label:t("rst_f_all")},{val:"mine",label:t("rst_f_mine")},
    {val:"attention",label:t("rst_f_attention")},{val:"active",label:t("rst_f_active")}
  ],rosterFilter,(v)=>{rosterFilter=v;rerender();});
  const searchInp=h("input",{type:"search",placeholder:t("rst_search"),style:"max-width:220px"});
  searchInp.addEventListener("input",()=>{rosterSearch=searchInp.value.trim().toLowerCase();rerender();});
  wrap.append(h("div",{class:"rev-controls",style:"margin:10px 0"},filters,searchInp),tableWrap);
  rerender();
}

/* ---------- Карточка ученика у учителя: тот же renderProgress + лента ответов ---------- */
function renderStudentCard(m,login){
  renderProgress(m,login,{teacher:true});
  renderExamWorks(m,login);   // работы Жазуу/Сүйлөө: текст/запись + балл (===EXAM-WORKS===)
  const feedWrap=h("div",{});m.append(feedWrap);
  renderFeed(feedWrap,login);
}
/* ===EXAM-WORKS=== Проверка продуктивных субтестов экзамена B1 преподавателем:
   письмо читается, запись слушается (с транскрипцией, если ученику доступен STT),
   балл 0–100 и комментарий уходят ученику — он видит их на экране экзамена. */
function renderExamWorks(m,login){
  const card=h("div",{class:"card"},h("h2",{},t("exam_works_hdr")));m.append(card);
  fetch("api/exam/work?login="+encodeURIComponent(login)).then(r=>r.ok?r.json():[]).then(list=>{
    if(!list.length)return card.append(h("p",{class:"muted"},t("exam_wk_none")));
    for(const w of list.slice().reverse()){
      const row=h("div",{class:"feedback",style:"display:block;margin-bottom:10px"});
      // уровень работы — по курсу записи (легаси без course — B1)
      const crs=examRecCourse(w),lvl=(examSpecs()[crs]||{}).level||COURSE_LABELS[crs]||crs;
      row.append(h("p",{},h("b",{},lvl+" · "+examSubName(w.kind,crs)+" · "),   // имя субтеста — по языку интерфейса
        h("span",{class:"kgword"},w.topic),
        h("span",{class:"muted"}," · "+String(w.ts).slice(0,10)+
          (w.score==null?" · "+t("exam_wk_pending"):" · "+t("exam_wk_score")+": "+w.score))));
      // вопросы задания (формат A1) — списком: по ним и оценивается ответ
      if(Array.isArray(w.qs)&&w.qs.length){const ol=h("ol",{class:"muted"});w.qs.forEach(q=>ol.append(h("li",{class:"kgword"},q)));row.append(ol);}
      if(w.text)row.append(h("p",{class:"kgword",style:"white-space:pre-wrap"},w.text));
      if(w.audio){
        // preload=none: записей в списке до 50, файлов на диске до 8 (ротация) —
        // дефолтный preload=metadata давал до ~42 гарантированных 404 при открытии карточки
        const au=h("audio",{controls:"",preload:"none",src:"api/exam/voice/"+w.audio,style:"width:100%"});
        row.append(au);
      }
      if(w.transcript)row.append(h("p",{class:"muted"},t("stt_said")+" "+w.transcript));
      const score=h("input",{type:"number",min:"0",max:"100",value:w.score==null?"":String(w.score),
        style:"width:80px;margin-right:8px"});
      const comment=h("input",{type:"text",value:w.comment||"",placeholder:"…",
        style:"width:50%;margin-right:8px"});
      const saveB=h("button",{class:"btn ghost",onclick:()=>{
        // пустое поле — не «0»: Number("")===0 молча ставил ученику ноль
        const sc=String(score.value).trim()===""?NaN:Number(score.value);
        if(!Number.isFinite(sc)||sc<0||sc>100)return;
        saveB.disabled=true;
        fetch("api/exam/grade",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({login,id:w.id,score:sc,comment:comment.value})})
          .then(r=>{
            saveB.disabled=false;
            // сбой не залипает кнопкой и не притворяется успехом (ревью 22.08)
            if(r.ok){saveB.textContent="✓ "+t("exam_wk_save");evPush("exam.grade",{to:login,id:w.id,score:sc});}
            else saveB.textContent="✗ "+t("exam_wk_save");
          })
          .catch(()=>{saveB.disabled=false;saveB.textContent="✗ "+t("exam_wk_save");});
      }},t("exam_wk_save"));
      row.append(h("div",{style:"margin-top:6px"},score,comment,saveB));
      card.append(row);
    }
  }).catch(()=>card.append(h("p",{class:"muted"},"—")));
}
/* ===/EXAM-WORKS=== */
// имя субтеста для ленты и работ — из реестра спецификаций, а не литералом в строке;
// ids у курсов общие: сначала спека названного курса, затем любая, где субтест описан
function examSubName(id,course){
  const R=examSpecs();
  for(const k of [course,...Object.keys(R)].filter(Boolean)){
    const sp=R[k]&&R[k].subtests.find(x=>x.id===id);
    if(sp)return bi3(sp);
  }
  return id||"";
}
let feedFilter="all",feedPeriod="7";
function renderFeed(wrap,login){
  const box=h("div",{});wrap.append(box);
  loadFeed(box,login,null,[]);
}
async function loadFeed(box,login,before,acc){
  let resp;
  try{resp=await fetchEvents(login,{limit:200,before});}
  catch(e){clear(box).append(h("div",{class:"card"},h("p",{class:"feedback err"},"⚠ "+e.message)));return;}
  renderFeedBody(box,login,acc.concat(resp.items),resp.nextBefore);
}
function renderFeedBody(box,login,items,nextBefore){
  clear(box);
  const hdr=h("div",{class:"card"});
  hdr.append(h("h2",{},icon("clock")," "+t("fd_hdr")));
  hdr.append(chipRow([
    {val:"all",label:t("fd_all")},{val:"cards",label:t("fd_t_cards")},
    {val:"test",label:t("fd_t_test")},{val:"drill",label:t("fd_t_drill")},
    {val:"listen",label:t("fd_t_listen")},{val:"ui",label:t("fd_t_ui")}
  ],feedFilter,(v)=>{feedFilter=v;renderFeedBody(box,login,items,nextBefore);}));
  hdr.append(chipRow([
    {val:"7",label:t("fd_p_7")},{val:"30",label:t("fd_p_30")},{val:"all",label:t("fd_p_all")}
  ],feedPeriod,(v)=>{feedPeriod=v;loadFeed(box,login,null,[]);})); // смена периода — новый запрос с начала
  box.append(hdr);

  const cutoff=feedPeriod==="all"?0:Date.now()-Number(feedPeriod)*86400000;
  const filtered=items.filter((ev)=>{
    if(new Date(ev.ts).getTime()<cutoff)return false;
    if(feedFilter==="all")return true;
    if(feedFilter==="cards")return ev.type.startsWith("card.")||ev.type.startsWith("cards.")||ev.type.startsWith("b1.");
    if(feedFilter==="test")return ev.type.startsWith("test.")||ev.type.startsWith("exam.");
    if(feedFilter==="drill")return ev.type.startsWith("drill.");
    if(feedFilter==="listen")return ev.type.startsWith("stt.")||ev.type.startsWith("lesson.");
    if(feedFilter==="ui")return ev.type.startsWith("ui.")||ev.type.startsWith("session.");
    return true;
  });
  const sessions=groupBySession(filtered);
  const list=h("div",{class:"card"});
  if(!sessions.length){
    list.append(h("p",{class:"muted"},t("fd_empty")));
  }else{
    for(const s of sessions){
      const durMin=Math.max(0,Math.round((new Date(s.end)-new Date(s.start))/60000));
      const acc=s.ans?Math.round(s.ok/s.ans*100):0;
      list.append(h("div",{class:"feed-sess"},tf("fd_sess",{d:new Date(s.start).toLocaleString(localeOf()),n:durMin,a:s.ans,p:acc})));
      for(const ev of s.items){
        const answerish=ev.type==="card.answer"||ev.type==="test.answer"||ev.type==="drill.answer";
        const refId=ev.cardId||((ev.ref&&ev.ref!=="h_row"&&ev.ref!=="h_affix")?ev.ref:null);
        const c=refId?cardById(refId):null;
        const row=h("div",{class:"feed-row"});
        row.append(h("span",{class:"muted"},new Date(ev.ts).toLocaleTimeString(localeOf(),{hour:"2-digit",minute:"2-digit"})));
        if(ev.mod)row.append(h("span",{class:"chip"},metaOf(ev.mod).num));
        if(c)row.append(h("span",{class:"kgword"},c.ky));
        if(ev.in)row.append(h("span",{class:"in"},ev.in));
        if(ev.type==="test.finish"){
          row.append(h("span",{class:"chip "+(ev.passed?"ok":"")},ev.score+"/20"));
          if(ev.wrong&&ev.wrong.length)row.append(h("span",{class:"muted"},t("fd_weak")+" "+ev.wrong.map(weakLabel).join(", ")));
        }
        if(answerish)row.append(ev.ok?h("span",{style:"color:var(--ok)"},"✓"):h("span",{style:"color:var(--err)"},"✗"));
        if(ev.hint)row.append(icon("question",13));
        // Решения ученика о слове — материал для разбора занятия: «уже знаю» без единого
        // ввода и отложенные слова преподаватель должен видеть, а не угадывать по пропускам.
        if(ev.type==="card.know")row.append(h("span",{class:"chip ok"},t("fd_know")));
        /* Экзаменационная неделя в ленте: попытка, тренировка субтеста, отправленная
           работа и выставленный балл — по каждой строке видно, что именно было. */
        if(ev.type==="exam.finish"){
          row.append(h("span",{class:"chip"},t("fd_exam")),
            h("span",{class:"chip "+(ev.pct>=60?"ok":"")},ev.pct+"%"),
            h("span",{class:"muted"},ev.right+"/"+ev.total));
          if(ev.byTime)row.append(h("span",{class:"muted"},t("fd_exam_time")));
        }
        if(ev.type==="exam.train_done")
          row.append(h("span",{class:"chip"},t("fd_train")+" · "+examSubName(ev.sub)),
            h("span",{class:"chip "+(ev.pct>=60?"ok":"")},ev.pct+"%"),
            h("span",{class:"muted"},ev.right+"/"+ev.total));
        if(ev.type==="exam.submit")
          row.append(h("span",{class:"chip"},t("fd_work")+" · "+examSubName(ev.sub)),
            h("span",{class:"muted"},ev.sentences?tf("fd_work_sent",{n:ev.sentences}):(ev.sec?ev.sec+"с":"")));
        if(ev.type==="exam.grade")
          row.append(h("span",{class:"chip ok"},t("fd_graded")+": "+ev.score),
            ev.to?h("span",{class:"muted"},"→ "+ev.to):"");
        // письмо ученика в ленте: преподаватель видит его рядом с занятием, из которого написали
        if(ev.type==="chat.send")row.append(h("span",{class:"chip"},t("fd_chat")));
        if(ev.type==="badge.earn")row.append(h("span",{class:"chip ok"},"🏅 "+t("bd_"+(ev.badge||"")).replace(/^bd_/,"")));
        if(ev.type==="card.skip")row.append(h("span",{class:"chip"},t(ev.on?"fd_skip":"fd_skip_off")));
        if(ev.type==="card.mark")row.append(h("span",{class:"chip"},t(ev.on?"fd_mark":"fd_mark_off")));
        // интерфейсные события — техстроки без перевода: значения-ключи (tab/theme/lang) не локализуем
        if(ev.type==="ui.nav")row.append(h("span",{class:"muted"},"→ "+(ev.tab||"")));
        if(ev.type==="ui.setting")row.append(h("span",{class:"muted"},(ev.k||"")+" → "+(ev.val||"")));
        if(ev.type==="ui.error")row.append(h("span",{style:"color:var(--err)"},"⚠ "+(ev.msg||"")));
        if(ev.type==="session.start"&&ev.w)row.append(h("span",{class:"muted"},(ev.mob?"📱 ":"🖥 ")+ev.w+"×"+ev.h));
        if(ev.ms)row.append(h("span",{class:"muted"},Math.round(ev.ms/1000)+"с"));
        list.append(row);
      }
    }
  }
  box.append(list);
  if(nextBefore)box.append(h("button",{class:"btn ghost",style:"margin-top:8px",onclick:()=>loadFeed(box,login,nextBefore,items)},t("fd_more")));
}

/* ---------- Вычитка (для преподавателя) ---------- */
let reviewFilter="todo";
function renderReview(m){
  if(!isTeacher()){m.append(h("div",{class:"card"},h("p",{class:"muted"},"Доступно только преподавателю.")));return;}
  const own=ownVocab(),reused=VOCAB.filter(c=>c.reuse);
  const total=own.length,done=own.filter(c=>reviewedOk(REVIEW,c.id)).length;
  const qCount=own.filter(c=>REVIEW[c.id]&&REVIEW[c.id].status==="question").length;
  const head=h("div",{class:"card"},
    h("h2",{},icon("pen")," "+t("tab_review")+" · "+metaOf(activeModule).num+" «"+metaTitle(metaOf(activeModule))+"»"),
    h("p",{class:"muted"},"«Верно» — всё правильно; «Править» — исправь и сохрани (правка сразу у всех учеников); «Вопрос» — комментарий для разбора. Аудио: слушай, апрувь («Аудио ок») или залей свою запись — в карточки учеников звук попадает только после апрува."));
  // переключатель модулей
  const mods=h("div",{class:"rev-filters"});
  for(const mid of CONTENT_READY){
    mods.append(h("button",{class:"btn "+(mid===activeModule?"":"ghost"),onclick:()=>{
      if(mid===activeModule)return;
      setModule(mid,true); // остаёмся во вкладке Вычитка; setModule сам дотянет review/audio и перерисует
    }},metaOf(mid).num+" · "+metaOf(mid).title));
  }
  head.append(mods,
    h("div",{class:"progressbar"},h("div",{style:"width:"+(total?done/total*100:0)+"%"})),
    h("div",{class:"muted"},`${t("rev_checked")} ${done}/${total}`));
  if(reused.length){ // reuse-слова вычитываются в родном модуле — здесь только справка
    const byMod={};for(const c of reused)(byMod[homeOf(c.id)]=byMod[homeOf(c.id)]||[]).push(c);
    head.append(h("div",{class:"note"},"Переиспользовано "+reused.length+" ед.: "+
      Object.entries(byMod).map(([mid,arr])=>metaOf(mid).num+" ("+arr.length+")").join(", ")+" — вычитываются в родном модуле."));
  }
  // табы состояний
  const filters=h("div",{class:"rev-filters"});
  for(const [k,label,count] of [["todo",t("rev_todo"),total-done],["done",t("rev_done"),done],["question",t("rev_q"),qCount]]){
    filters.append(h("button",{class:"btn "+(reviewFilter===k?"":"ghost"),onclick:()=>{reviewFilter=k;renderTab();}},label+" ("+count+")"));
  }
  head.append(filters);
  m.append(head);
  const items=own.filter(c=>{
    const r=REVIEW[c.id];
    const isDone=r&&(r.status==="ok"||r.status==="fixed");
    if(reviewFilter==="todo")return !isDone;
    if(reviewFilter==="done")return isDone;
    if(reviewFilter==="question")return r&&r.status==="question";
    return true;
  });
  if(!items.length){m.append(h("div",{class:"card"},h("div",{class:"feedback ok"},reviewFilter==="done"?"Пока ничего не вычитано в этом списке.":"Здесь пусто — всё проверено. Рахмат!")));return;}
  for(const c of items)m.append(reviewRow(c));
}
function reviewRow(c){
  const r=REVIEW[c.id];
  const st=r?r.status:null;
  const chip=st==="ok"?h("span",{class:"chip ok"},"верно"):st==="fixed"?h("span",{class:"chip ok"},"исправлено"):st==="question"?h("span",{class:"chip warn"},"вопрос"):h("span",{class:"chip"},"не проверено");
  const row=h("div",{class:"card rev-row"});
  const msg=h("span",{class:"muted"});
  const editBox=h("div",{style:"display:none;margin-top:10px"});
  let editOpen=false;
  const inpKy=h("input",{type:"text",value:c.ky});inpKy.value=c.ky;
  const inpRu=h("input",{type:"text",value:c.ru});inpRu.value=c.ru;
  // переводы для остальных языков интерфейса — необязательные: пустое поле не переопределяет
  const inpEn=h("input",{type:"text",placeholder:"перевод для англоязычного интерфейса (можно оставить пустым)"});inpEn.value=c.en||"";
  const inpTr=h("input",{type:"text",placeholder:"перевод для турецкого интерфейса (можно оставить пустым)"});inpTr.value=c.tr||"";
  const inpAcc=h("input",{type:"text",placeholder:"альтернативные написания через запятую"});inpAcc.value=(c.accept||[]).join(", ");
  // Произношение для озвучки: ученик по-прежнему видит написание из «Кыргызча», а голос
  // читает это поле. Нужно, когда орфография сбивает модель (заимствования: «команда»
  // читалось как [куманда]).
  const inpSay=h("input",{type:"text",placeholder:"только если озвучка звучит неверно, например /komɑndɑ/"});
  inpSay.value=(OVERRIDES[c.id]&&OVERRIDES[c.id].say)||"";
  const inpCom=h("input",{type:"text",placeholder:"комментарий (обязателен для «Вопроса»)"});if(r&&r.comment)inpCom.value=r.comment;
  const busy=(on)=>{row.style.opacity=on?".6":"1";};
  const doSave=async(status)=>{
    busy(true);msg.textContent="";
    try{
      const sayWas=(OVERRIDES[c.id]&&OVERRIDES[c.id].say)||"";
      const changed=inpKy.value.trim()!==c.ky||inpRu.value.trim()!==c.ru
        ||inpEn.value.trim()!==(c.en||"")||inpTr.value.trim()!==(c.tr||"")
        ||inpAcc.value.trim()!==(c.accept||[]).join(", ")
        ||inpSay.value.trim()!==sayWas;
      if(changed){
        await putOverride(c.id,{ky:inpKy.value.trim(),ru:inpRu.value.trim(),
          en:inpEn.value.trim(),tr:inpTr.value.trim(),say:inpSay.value.trim(),
          accept:inpAcc.value.split(",").map(s=>s.trim()).filter(Boolean)});
      }
      await putReview(c.id,{status,comment:inpCom.value.trim()||undefined});
      renderTab();
    }catch(e){msg.textContent="⚠ "+e.message;busy(false);}
  };
  editBox.append(
    h("label",{class:"muted"},"Кыргызча:"),inpKy,kbdFor(inpKy),
    h("label",{class:"muted"},"Перевод:"),inpRu,
    h("label",{class:"muted"},"English:"),inpEn,
    h("label",{class:"muted"},"Türkçe:"),inpTr,
    h("label",{class:"muted"},"Принимать также:"),inpAcc,
    h("label",{class:"muted"},"Произношение для озвучки:"),inpSay,
    h("p",{class:"muted",style:"font-size:.8rem;margin:4px 0 0"},
      "Заполняйте, только если голос читает слово неверно. На экране ученик видит написание "
      + "из «Кыргызча» — это поле читает лишь озвучка, и при следующей генерации будет "
      + "использовано оно. Пишите так, как слово должно звучать: либо кыргызскими буквами "
      + "«как слышится» (аш полсун), либо транскрипцией в косых чертах (/komɑndɑ/) — "
      + "по ней модель держит нужный гласный. После сохранения нажмите «Перегенерировать»."),
    h("label",{class:"muted"},"Комментарий:"),inpCom,
    h("div",{style:"display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"},
      h("button",{class:"btn",onclick:()=>doSave("fixed")},"Сохранить как исправлено"),
      h("button",{class:"btn secondary",onclick:()=>{
        if(!inpCom.value.trim()){msg.textContent="Для «Вопроса» нужен комментарий";return;}
        doSave("question");
      }},"Сохранить вопрос"),
      OVERRIDES[c.id]?h("button",{class:"btn ghost",onclick:async()=>{busy(true);try{await putOverride(c.id,{remove:true});await fetchReviewData();renderTab();}catch(e){msg.textContent="⚠ "+e.message;busy(false);}}},"Убрать правку (вернуть оригинал)"):null,
      // Отмена: закрывает правку и возвращает поля к исходному — иначе выйти из формы
      // можно было только сохранением или перезагрузкой
      h("button",{class:"btn ghost",onclick:()=>{
        inpKy.value=c.ky;inpRu.value=c.ru;inpEn.value=c.en||"";inpTr.value=c.tr||"";
        inpAcc.value=(c.accept||[]).join(", ");
        inpSay.value=(OVERRIDES[c.id]&&OVERRIDES[c.id].say)||"";
        inpCom.value=(REVIEW[c.id]&&REVIEW[c.id].comment)||"";
        msg.textContent="";editOpen=false;editBox.style.display="none";
      }},"Отмена"),
      msg));
  // Аудио-блок: слушать / апрув / генерация ElevenLabs / загрузка своей записи
  const audioLine=h("div",{class:"rev-controls",style:"margin-top:6px"});
  const fileInp=h("input",{type:"file",accept:"audio/*",style:"display:none"});
  fileInp.addEventListener("change",async()=>{
    if(!fileInp.files||!fileInp.files[0])return;
    busy(true);msg.textContent="";
    try{await uploadAudio(c.id,fileInp.files[0]);renderAudioLine();playAudio(c.id);}
    catch(e){msg.textContent="⚠ "+e.message;}
    busy(false);
  });
  function renderAudioLine(){
    const has=AUDIO.has(c.id);
    const audioOk=REVIEW[c.id]&&REVIEW[c.id].audioOk;
    const custom=isCustomAudio(c.id);
    clear(audioLine);
    appendKids(audioLine,
      h("span",{class:"chip "+(has?(audioOk?"ok":""):"warn")},has?(audioOk?"аудио ✓":"аудио не апрувлено"):"нет аудио"),
      custom?h("span",{class:"chip ok"},"своя запись"):null,
      has?h("button",{class:"btn ghost",onclick:()=>playAudio(c.id)},icon("play",14)," "+t("rev_listen")):null,
      h("button",{class:"btn ghost",onclick:async()=>{
        const force=custom;
        if(force&&!confirm("Здесь ваша собственная запись — заменить её машинной озвучкой?"))return;
        busy(true);msg.textContent="генерирую…";
        // озвучка читает произношение преподавателя, если он его задал (см. поле «Произношение»)
        try{await genTts(c.id,sayText(c.id,c.ky),force);msg.textContent="";renderAudioLine();playAudio(c.id);}
        catch(e){msg.textContent="⚠ "+e.message;}
        busy(false);
      }},icon("wave",14)," "+(has?t("rev_regen"):t("rev_gen"))),
      h("button",{class:"btn ghost",onclick:()=>fileInp.click()},icon("upload",14)," "+t("rev_upload")),
      has&&!audioOk?h("button",{class:"btn secondary",onclick:async()=>{
        try{await putReview(c.id,{audioOk:true});renderAudioLine();}catch(e){msg.textContent="⚠ "+e.message;}
      }},icon("check",14)," "+t("rev_audio_ok")):null,
      fileInp);
  }
  renderAudioLine();
  appendKids(row,
    h("div",{},chip,OVERRIDES[c.id]?h("span",{class:"chip"},"есть правка"):null,
      h("span",{class:"muted",style:"float:right"},CATS[c.cat]||c.cat)),
    h("div",{class:"bigword kgword",style:"font-size:1.15rem;margin:4px 0"},c.ky),
    h("div",{class:"muted"},c.ru),
    r&&r.comment?h("div",{class:"note"},"Комментарий: "+r.comment):null,
    h("div",{class:"rev-controls",style:"margin-top:8px"},
      h("button",{class:"btn",onclick:async()=>{try{await putReview(c.id,{status:"ok"});renderTab();}catch(e){msg.textContent="⚠ "+e.message;}}},icon("check",14)," "+t("rev_btn_ok")),
      h("button",{class:"btn secondary",onclick:()=>{editOpen=!editOpen;editBox.style.display=editOpen?"block":"none";}},icon("pen",14)," "+t("rev_btn_edit")),
      h("button",{class:"btn ghost",onclick:()=>{editOpen=true;editBox.style.display="block";inpCom.focus();}},icon("question",14)," "+t("rev_btn_q")),
      msg),
    audioLine,
    editBox);
  return row;
}

/* ---------- Настройки пользователя ---------- */
/* Бэкапы /data — карточка в настройках, только админ. Расписание живёт на сервере
   (раз в день, хранится 5 свежих) — здесь ручное управление: создать, скачать,
   загрузить, удалить, восстановить (с подтверждением; после восстановления кэши
   процесса старые — нужен рестарт, сервер об этом отвечает прямым текстом). */
function renderBackupsCard(){
  if(!isAdmin()||!SYNC.enabled)return null;
  const fmtB=n=>n>=1048576?(n/1048576).toFixed(1)+" МБ":Math.round(n/1024)+" КБ";
  const jf=(url,opt)=>fetch(url,opt).then(r=>r.json().catch(()=>({})).then(j=>{if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j;}));
  const list=h("div",{},h("p",{class:"muted"},"Загружаю…"));
  const msg=h("span",{class:"muted",style:"margin-left:8px"});
  const refresh=()=>jf("api/admin/backups").then(items=>{
    list.replaceChildren();
    if(!items.length){list.append(h("p",{class:"muted"},"Бэкапов ещё нет."));return;}
    for(const b of items.slice().reverse()){
      list.append(h("p",{style:"display:flex;align-items:center;gap:8px;flex-wrap:wrap"},
        h("b",{},b.name.replace(/^kga1-backup-|\.tar\.gz$/g,"")),
        h("span",{class:"muted"},fmtB(b.bytes)),
        h("a",{class:"btn ghost",href:"api/admin/backups/"+b.name,download:b.name},"Скачать"),
        h("button",{class:"btn ghost",onclick:()=>{
          if(!confirm("Удалить бэкап "+b.name+"?"))return;
          jf("api/admin/backups/"+b.name,{method:"DELETE"}).then(refresh).catch(e=>{msg.textContent="⚠ "+e.message;});
        }},"Удалить"),
        h("button",{class:"btn ghost",onclick:()=>{
          if(!confirm("ВОССТАНОВИТЬ данные из "+b.name+"? Текущие данные будут перезаписаны этим архивом."))return;
          jf("api/admin/backups/"+b.name+"/restore",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"confirm":"restore"}'})
            .then(r=>{msg.textContent=r.note||"восстановлено";}).catch(e=>{msg.textContent="⚠ "+e.message;});
        }},"Восстановить")));
    }
  }).catch(e=>{list.replaceChildren(h("p",{class:"muted"},"⚠ "+e.message));});
  const up=h("input",{type:"file",accept:".gz,.tar.gz",style:"display:none",onchange:()=>{
    const f=up.files&&up.files[0]; if(!f)return;
    msg.textContent="загружаю…";
    jf("api/admin/backups/"+encodeURIComponent(f.name),{method:"PUT",body:f})
      .then(()=>{msg.textContent="загружен";refresh();}).catch(e=>{msg.textContent="⚠ "+e.message;});
    up.value="";
  }});
  setTimeout(refresh,0);
  return h("div",{class:"card"},h("h2",{},icon("cloud")," Бэкапы данных"),
    h("p",{class:"muted"},"Сервер делает бэкап раз в день и хранит 5 последних (том /data целиком: прогресс, журнал, аудио, вычитка). Восстановление перезаписывает данные — после него нужен рестарт контейнера."),
    h("p",{},
      h("button",{class:"btn",onclick:()=>{msg.textContent="делаю…";jf("api/admin/backups",{method:"POST"}).then(r=>{msg.textContent="готово: "+fmtB(r.bytes);refresh();}).catch(e=>{msg.textContent="⚠ "+e.message;});}},"Создать сейчас"),
      h("button",{class:"btn ghost",style:"margin-left:8px",onclick:()=>up.click()},"Загрузить файл"),up,msg),
    list);
}

// Карточка установки: показывается только там, где установка реально возможна
// (см. installState) — иначе кнопка обещала бы то, чего браузер не сделает.
function installCard(){
  const st=installState();
  if(st==="none")return null;
  const card=h("div",{class:"card"},h("h2",{},icon("app")," "+t("inst_hdr")),h("p",{class:"muted"},t("inst_p")));
  if(st==="guide"){
    card.append(h("p",{},h("a",{class:"btn ghost",href:"/install",target:"_blank",rel:"noopener",
      style:"display:inline-flex;align-items:center;gap:7px"},icon("download",15)," "+t("inst_how"))));
    return card;
  }
  const msg=h("span",{class:"muted"});
  const btn=h("button",{class:"btn",style:"display:inline-flex;align-items:center;gap:7px",
    onclick:async(ev)=>{
      const b=ev&&ev.currentTarget;if(b)b.disabled=true;
      const out=await installNow();
      if(out==="accepted"){renderTab();return;}
      // отказ — не ошибка: кнопку убираем (событие одноразовое, второй раз она бы молчала),
      // браузер пришлёт предложение снова — покажем опять
      if(b&&b.replaceWith)b.replaceWith(msg);
      msg.textContent=t("inst_later");
    }},icon("download",15)," "+t("inst_btn"));
  card.append(h("p",{},btn),
    h("p",{class:"muted",style:"font-size:.85rem"},h("a",{href:"/install",target:"_blank",rel:"noopener"},t("inst_how"))));
  return card;
}
function renderSettings(m){
  const themeRow=pickerRow([{val:"light",label:t("th_light"),ic:"sun"},{val:"dark",label:t("th_dark"),ic:"moon"},{val:"auto",label:t("th_auto"),ic:"monitor"}],
    currentTheme(),val=>{setTheme(val);renderTab();});
  const ROLE_RU={student:t("role_student"),teacher:t("role_teacher"),admin:t("role_admin")};
  const langRow=pickerRow([{val:"ru",label:"Русский"},{val:"en",label:"English"},{val:"tr",label:"Türkçe"}],currentLang(),val=>setLang(val));
  const acc=h("div",{class:"card"},h("h2",{},icon("user")," "+t("settings_account")));
  if(SYNC.enabled){
    // Свой пароль меняет любой вошедший, кроме админа: его учётка живёт в users.json,
    // и сервер такую попытку отклоняет — поэтому вместо кнопки показываем, что делать.
    const passMsg=h("span",{class:"muted",style:"margin-left:8px"});
    const passBtn=isAdmin()?h("p",{class:"muted"},t("acc_pass_admin")):h("p",{},
      h("button",{class:"btn ghost",style:"display:inline-flex;align-items:center;gap:7px",onclick:()=>{
        const np=prompt(t("acc_pass_prompt"));
        if(np==null)return;
        passMsg.textContent="";
        putStudent({login:ME.login,password:np}).then(()=>{passMsg.textContent=t("acc_pass_ok");})
          .catch(e=>{passMsg.textContent="⚠ "+e.message;});
      }},icon("key",15)," "+t("stu_pass")),passMsg);
    appendKids(acc,
      h("p",{},t("logged_as"),h("b",{},ME?ME.login:"…"),ME?" ("+(ROLE_RU[ME.role]||ME.role)+")":""),
      h("p",{class:"muted"},t("set_acc_note")),
      isTeacher()?h("p",{class:"muted"},"Как преподавателю вам доступна вкладка «Вычитка»: проверка фраз, правки материалов и комментарии. Тесты и карточки при этом работают как у ученика — свой прогресс, своя статистика."):null,
      ME?passBtn:null,
      h("button",{class:"btn",style:"display:inline-flex;align-items:center;gap:7px",onclick:()=>{location.href="api/logout";}},icon("logout",15)," "+t("logout")));
  }else{
    acc.append(h("p",{class:"muted"},t(IS_DEMO?"demo_local_note":"set_local_note")));
    if(IS_DEMO)acc.append(demoWaBtn());
  }
  const audioRow=pickerRow([{val:"off",label:t("ap_off")},{val:"on",label:t("ap_on"),ic:"play"}],
    autoplayOn()?"on":"off",val=>{ST.settings=ST.settings||{};ST.settings.autoplay=val==="on";save();evPush("ui.setting",{k:"autoplay",val});renderTab();});
  appendKids(m,
    installCard(),
    h("div",{class:"card"},h("h2",{},t("settings_lang")),langRow),
    h("div",{class:"card"},h("h2",{},t("settings_theme")),themeRow,
      h("p",{class:"muted"},t("set_theme_note"))),
    h("div",{class:"card"},h("h2",{},icon("play")," "+t("settings_audio")),audioRow,
      h("p",{class:"muted"},t("set_autoplay_note"))),
    acc,
    renderBackupsCard(),
    IS_DEMO?null:h("div",{class:"card"},h("h2",{},t("settings_data")),
      h("p",{class:"muted"},L("Синхронизация: ","Sync: ","Eşitleme: ")+(SYNC.enabled?(SYNC.status==="ok"?t("sync_ok"):t("sync_err")):t("sync_local"))),
      h("button",{class:"btn ghost",onclick:()=>{
        if(!confirm(L("Сбросить прогресс модуля ","Reset the progress of ","Şu modülün ilerlemesi sıfırlansın mı: ")+metaOf(activeModule).num+L("? Это затрёт его и на сервере. Прогресс слов, переиспользованных из других модулей (и в других модулях), хранится в их родном модуле.","? This also wipes it on the server. Progress of words reused from other modules is stored in their home module.","? Bu, sunucudaki kaydı da siler. Başka modüllerden yeniden kullanılan kelimelerin ilerlemesi kendi modüllerinde saklanır.")))return;
        // отметка времени сброса: сервер иначе восстановит стёртое из своей копии
        // (слияние прогресса — защита от потери сдачи при неполной отправке)
        ST.modules[activeModule]=Object.assign(freshModule(),{reset:new Date().toISOString()});
        save();go("overview");
      }},t("reset_btn")+metaOf(activeModule).num)));
}

/* ===STATS=== */
/* Чистая логика статистики занятий: только аргументы, без DOM/ST/CONTENT — как WEEKPLAN ниже,
   tests/stats.test.js выдёргивает этот блок по маркерам и гоняет в песочнице без браузера.
   Данные приходят готовыми с сервера (GET /api/stats, /api/stats/overview) — здесь их
   раскладка для конкретных экранов (серия, недели, сигналы дашборда, группировка ленты). */
// День — как на сервере (dayKeyOf, server.js): по времени Бишкека (UTC+6), не UTC — иначе
// занятие в 23:30 по местному уезжает «на завтра» и рвёт стрик у вечерних учеников.
function dayKeyOf(ts){
  const d=new Date(new Date(ts).getTime()+6*3600000);
  return d.toISOString().slice(0,10);
}
// Текущая и лучшая серия дней подряд по ключам объекта days ({"YYYY-MM-DD":{ans,ok,ms}, ...}).
// «Сегодня ещё не занимался» не рвёт текущую серию — иначе она гасла бы каждое утро до занятия.
function streakOf(days,todayKey){
  const set=new Set(Object.keys(days).filter((k)=>days[k]&&days[k].ans>0));
  const sorted=[...set].sort();
  let best=0,run=0,prevKey=null;
  for(const k of sorted){
    run=(prevKey&&(new Date(k)-new Date(prevKey))===86400000)?run+1:1;
    if(run>best)best=run;
    prevKey=k;
  }
  let current=0,cursor=new Date(todayKey+"T00:00:00Z");
  for(;;){
    const k=cursor.toISOString().slice(0,10);
    if(set.has(k)){current++;cursor.setUTCDate(cursor.getUTCDate()-1);}
    else if(k===todayKey){cursor.setUTCDate(cursor.getUTCDate()-1);} // сегодня — пропуск, не разрыв
    else break;
  }
  return {current,best:Math.max(best,current),activeToday:set.has(todayKey)};
}
// Понедельник недели, содержащей dayKey — ключ для группировки по неделям.
function isoWeekKeyOf(dayKey){
  const d=new Date(dayKey+"T00:00:00Z");
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  return d.toISOString().slice(0,10);
}
// Последние n недель: точность, ответы, минуты. Недели без данных не создаются —
// пустой промежуток на графике честнее нуля (нуль читается как «занимался и ошибался во всём»).
function weeksOf(days,n){
  const byWeek={};
  for(const [k,d] of Object.entries(days)){
    const wk=isoWeekKeyOf(k);
    const w=byWeek[wk]||(byWeek[wk]={w:wk,ans:0,ok:0,ms:0});
    w.ans+=d.ans||0;w.ok+=d.ok||0;w.ms+=d.ms||0;
  }
  return Object.values(byWeek).sort((a,b)=>a.w<b.w?-1:1).slice(-n)
    .map((w)=>({w:w.w,acc:w.ans?w.ok/w.ans:null,answers:w.ans,minutes:Math.round(w.ms/60000)}));
}
// Тревожные и позитивные сигналы для строки дашборда учителя (row — из GET /api/stats/overview).
// Калиброванный минимум первой итерации: «не заходил», «два провала теста подряд», «серия».
function flagsOf(row,nowMs){
  const flags=[];
  // «ни разу не заходил» — отдельный сигнал: у него нет числа дней, и подстановка пустого
  // значения в «не заходил {n} дн.» давала бессмысленное «не заходил — дн.»
  if(!row.lastSeen)flags.push({key:"never"});
  else if(Math.floor((nowMs-Date.parse(row.lastSeen))/86400000)>=4)flags.push({key:"idle",n:Math.floor((nowMs-Date.parse(row.lastSeen))/86400000)});
  if(row.testFails2)flags.push({key:"fail2"});
  if(row.streak>=7)flags.push({key:"streak",n:row.streak});
  return flags;
}
// Списки за числами сводки: одно вычисление и для цифры, и для панели с деталями,
// поэтому «занимались сегодня: 2» и список из панели не могут разойтись
function rosterSubset(rows,kind,nowMs,todayKey){
  if(kind==="today")return rows.filter((r)=>r.lastSeen&&dayKeyOf(r.lastSeen)===todayKey);
  if(kind==="week")return rows.filter((r)=>r.lastSeen&&(nowMs-Date.parse(r.lastSeen))<7*86400000);
  return rows.filter((r)=>r.flags.some((f)=>f.key==="idle"||f.key==="fail2"||f.key==="never"));
}
// Плоская лента событий (GET /api/events) → сессии для заголовков в ленте учителя.
// Группируем по sid (уже граница сессии на клиенте), не по разрыву времени — sid стабильнее
// произвольного порога и не требует повторно калибровать его на клиенте.
function groupBySession(events){
  const order=[],map={};
  for(const ev of events){
    const sid=ev.sid||"-";
    let s=map[sid];
    if(!s){s=map[sid]={sid,items:[],start:ev.ts,end:ev.ts,ans:0,ok:0};order.push(sid);}
    s.items.push(ev);
    if(ev.ts<s.start)s.start=ev.ts;
    if(ev.ts>s.end)s.end=ev.ts;
    if(ev.type==="card.answer"||ev.type==="test.answer"||ev.type==="drill.answer"){s.ans++;if(ev.ok)s.ok++;}
  }
  return order.map((sid)=>map[sid]);
}
// Прогноз финиша курса: остаток модулей × темп «неделя на модуль», делённый на
// регулярность (доля активных дней за 14 дней; пол 0.25 — чтобы прогноз не улетал
// в годы у только начавших). Возвращает дату строкой YYYY-MM-DD или null.
function finishForecast(days, todayKey, remainingMods) {
  if (!remainingMods) return null;
  let active = 0;
  const d = new Date(todayKey + "T00:00:00Z");
  for (let i = 0; i < 14; i++) {
    const rec = days[d.toISOString().slice(0, 10)];
    if (rec && rec.ans > 0) active++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  if (!active) return null; // не занимался две недели — прогнозировать нечестно
  const regularity = Math.max(0.25, active / 14);
  const daysNeeded = Math.round(remainingMods * 7 / regularity);
  const f = new Date(todayKey + "T00:00:00Z");
  f.setUTCDate(f.getUTCDate() + daysNeeded);
  return f.toISOString().slice(0, 10);
}
// Сигнал «пора к преподавателю»: одна карточка за раз, по старшинству сигнала.
// dismissed гасит только разговорную карточку (талалка), тревожные — не прячутся.
function consultSignal(inp) {
  if (inp.fails2Mod) return { kind: "fail2", mod: inp.fails2Mod };
  if (inp.ans7 >= 30 && inp.acc7 !== null && inp.acc7 < 0.7) return { kind: "lowacc" };
  if (inp.mockMod) return { kind: "mock", mod: inp.mockMod };
  if (inp.lastPassed && inp.lastPassed !== inp.dismissed) return { kind: "talk", mod: inp.lastPassed };
  return null;
}
// Очередь внимания куратора: кому написать (сигналы тревоги) и кого похвалить
// (длинная серия). Ученик не попадает в обе группы сразу — тревога важнее.
function attentionQueue(rows){
  const need=rows.filter((r)=>r.flags.some((f)=>f.key==="never"||f.key==="idle"||f.key==="fail2"));
  const praise=rows.filter((r)=>r.flags.some((f)=>f.key==="streak")&&!need.includes(r));
  return {need,praise};
}
// Шаблон сообщения ученику по старшему сигналу: провал теста важнее тишины,
// тишина важнее «ни разу не заходил» у только что созданных.
function nudgeText(r){
  const f=(k)=>r.flags.find((x)=>x.key===k);
  if(f("fail2"))return "Салам, "+r.login+"! Вижу, мини-тест пока упрямится — это нормально, тема непростая. Давайте разберём сложные места вместе: напишите, когда удобно.";
  if(f("idle"))return "Салам, "+r.login+"! Вы уже "+f("idle").n+" дн. не заходили на learn.kg — 15 минут сегодня вернут ритм 🙂 Если что-то мешает, напишите, помогу.";
  if(f("never"))return "Салам, "+r.login+"! Ждём вас на learn.kg: начните с первого модуля — это 15 минут в день. Если не получается войти, напишите мне.";
  const st=f("streak");
  if(st)return "Салам, "+r.login+"! 🔥 "+st.n+" дн. занятий подряд — отличный ритм, так держать!";
  return "";
}
/* ===/STATS=== */

/* ===GAMIF=== */
/* Геймификация (решение владельца: вехи-майлстоуны, недельная цель,
   сравнение недель; без лиг). Чистые функции без DOM — vm-тесты в stats.test.js. */
// Фиксация вех: веха, однажды заработанная, не отбирается — mastered может
// просесть после ошибок, серия прерваться, а достижение — свершившийся факт.
// map — ST.badges ({ключ: "YYYY-MM-DD"}), earned — снимок условий [[ключ, bool]].
// Возвращает свежезаработанные ключи — вызывающий журналит их по одному разу.
function badgesCommit(map,earned,todayKey){
  const fresh=[];
  for(const [key,got] of earned)if(got&&!map[key]){map[key]=todayKey;fresh.push(key);}
  return fresh;
}
// Недельная цель — активные дни календарной недели (пн–вс). Пять дней, как
// микроцикл методики §5.4: пять учебных дней + разгрузка.
const WEEK_GOAL_DAYS=5;
function weekActiveDays(days,todayKey){
  const d=new Date(isoWeekKeyOf(todayKey)+"T00:00:00Z");
  let n=0;
  for(let i=0;i<7;i++){
    const k=d.toISOString().slice(0,10);
    if(days[k]&&days[k].ans>0)n++;
    d.setUTCDate(d.getUTCDate()+1);
  }
  return n;
}
// Эта календарная неделя против прошлой; null, пока прошлой недели нет —
// сравнение из нулей читалось бы упрёком новичку в первый же день.
function weekCompare(days,todayKey){
  const wkNow=isoWeekKeyOf(todayKey);
  const d=new Date(wkNow+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-7);
  const wkPrev=d.toISOString().slice(0,10);
  const sum=(wk)=>{
    let ans=0,ok=0,ms=0,has=false;
    for(const [k,v] of Object.entries(days))if(isoWeekKeyOf(k)===wk){ans+=v.ans||0;ok+=v.ok||0;ms+=v.ms||0;has=true;}
    return {has,ans,acc:ans?Math.round(ok/ans*100):null,min:Math.round(ms/60000)};
  };
  const prev=sum(wkPrev);
  if(!prev.has)return null;
  const cur=sum(wkNow);
  return {cur,prev,dAns:cur.ans-prev.ans,dMin:cur.min-prev.min,
    dAcc:(cur.acc!=null&&prev.acc!=null)?cur.acc-prev.acc:null};
}
// подпись дельты: знак виден всегда, «+0» честнее пустоты
function deltaTxt(d){return (d>0?"+":"")+d;}
/* ===/GAMIF=== */

/* ---------- Обзор ---------- */
/* ===WEEKPLAN=== */
/* План повторения лексики по дням недели — по микроциклу методики §5.4: новые слова
   порциями в дни 1–3, день 4 — продукция, день 5 — interleaved-повтор и мини-тест,
   день 6 — ролевой диалог, день 7 — разгрузка (только карточки).
   Повторение темы: на следующий день и через три (первые две ступени интервалов
   [1, 3, 7, 16], методика §7.6); дальние ступени добирает сам движок карточек. */
const WEEK_DAYS=[
  {ky:"дүйшөмбү",ru:"понедельник",en:"Monday",tr:"pazartesi"},
  {ky:"шейшемби",ru:"вторник",en:"Tuesday",tr:"salı"},
  {ky:"шаршемби",ru:"среда",en:"Wednesday",tr:"çarşamba"},
  {ky:"бейшемби",ru:"четверг",en:"Thursday",tr:"perşembe"},
  {ky:"жума",ru:"пятница",en:"Friday",tr:"cuma"},
  {ky:"ишемби",ru:"суббота",en:"Saturday",tr:"cumartesi"},
  {ky:"жекшемби",ru:"воскресенье",en:"Sunday",tr:"pazar"}];
const STUDY_DAYS=3; // дни 1–3: ввод новой лексики порциями (§5.4), дальше только повторение
const TEST_DAY=4;   // день 5: interleaved-повторение и мини-тест недели (§5.4)
function weekPlan(cats,vocab){
  const size=k=>vocab.filter(v=>v.cat===k).length;
  const keys=Object.keys(cats||{}).filter(size); // порядок словаря = порядок модуля
  const days=WEEK_DAYS.map(()=>({fresh:[],review:[],count:0}));
  // жадная балансировка: самая большая тема уходит в самый разгруженный день
  for(const k of [...keys].sort((a,b)=>size(b)-size(a)||keys.indexOf(a)-keys.indexOf(b))){
    let best=0;
    for(let i=1;i<STUDY_DAYS;i++)if(days[i].count<days[best].count)best=i;
    days[best].fresh.push(k);days[best].count+=size(k);
  }
  for(const d of days)d.fresh.sort((a,b)=>keys.indexOf(a)-keys.indexOf(b));
  for(let i=0;i<days.length;i++){
    // тем меньше, чем учебных дней (М10–М11 — недели повторения): день без новой темы
    // не пустует, а забирает всё введённое ранее, как выходные
    const short=i<STUDY_DAYS&&!days[i].fresh.length;
    const from=(i<STUDY_DAYS&&!short)?[i-1,i-3].filter(j=>j>=0):[...Array(Math.min(i,STUDY_DAYS)).keys()];
    for(const j of from)for(const k of days[j].fresh)if(!days[i].review.includes(k))days[i].review.push(k);
  }
  return days;
}
/* ===/WEEKPLAN=== */
function renderOverview(m){
  // хвост экзаменационной недели дорисовывается ниже (см. isExamWeek)
  // неделя — порядковый номер модуля ВНУТРИ его курса: первый модуль A2 — «неделя 1», не «13»
  const week=courseModules(courseOf(activeModule)).findIndex(x=>x.id===activeModule)+1;
  const plan=h("div",{class:"card"},
    h("h2",{},metaOf(activeModule).num+" · "+metaTitle(metaOf(activeModule))+L(" — неделя "," — week "," — hafta ")+week),
    h("ol",{class:"muted"},...(bi(CONTENT[activeModule]||{},"plan")||[]).map(x=>h("li",{},x))));
  /* Плитки считают карточки, озвучку и мини-тест — разделы, которых в
     экзаменационной неделе нет: пустой счётчик «Мини-тест M35» звал бы туда,
     куда не попасть. Её «Как готовиться» — это план, методика и стратегия по навыкам. */
  if(!isExamWeek(activeModule))plan.append(statRow(
    statTile(Math.round(progressScore()*100)+"%",t("stat_progress"),{hint:t("stat_progress_hint")}),
    statTile(`${doneOnceCount()}/${VOCAB.length}`,t("stat_done1")),
    statTile(`${fixingCount()}`,t("stat_fixing")),
    statTile(`${masteredCount()}/${VOCAB.length}`,t("stat_mastered")),
    statTile((mod().test&&mod().test.lastAttempt)?`${mod().test.lastAttempt.score}/${mod().test.lastAttempt.total||20}`:"—",t("stat_test")+" "+metaOf(activeModule).num),
    statTile(`${VOCAB.filter(c=>AUDIO.has(c.id)).length}/${VOCAB.length}`,t("stat_voiced"))));
  if(SYNC.enabled&&VOCAB.every(c=>!AUDIO.has(c.id)))plan.append(h("div",{class:"note"},L("Озвучка ещё не готова — преподаватель может сгенерировать или записать её во вкладке «Вычитка».","Audio is not ready yet — the teacher can generate or record it in the Proofreading tab.","Seslendirme henüz hazır değil — öğretmen bunu “Düzelti” sekmesinde üretebilir ya da kaydedebilir.")));
  m.append(plan);

  /* «Как готовиться» экзаменационной недели — это обзор И стратегия по навыкам в
     одном разделе (правило владельца 22.08.2026): методика подготовки из данных
     модуля, следом та же справочная страница, что была отдельной вкладкой —
     контент не продублирован, а переиспользован. */
  const examWeek=isExamWeek(activeModule);
  if(examWeek){
    const steps=bi(CONTENT[activeModule]||{},"howto")||[];
    if(steps.length)m.append(h("div",{class:"card"},
      h("h2",{},icon("book")," "+t("howto_hdr")),
      h("ol",{class:"muted"},...steps.map(x=>h("li",{},x)))));
  }
  const extras=MODULE_EXTRAS[activeModule]||{};
  /* Экзаменационная неделя: словарь и расписание лексики ей не нужны — учат не
     слова, а механику; зато прямо здесь лежит стратегия по навыкам (справочная
     страница недели — тот же рендер, тот же материал). */
  if(examWeek){
    if(extras.ref)extras.ref(m);
    return;
  }
  weekPlanCard(m); // расписание лексики по дням недели

  if(extras.overviewTexts)extras.overviewTexts(m); // тексты недели модуля — из реестра

  renderModuleDict(m);
}
/* ---------- Словарь модуля (общий для всех модулей) ---------- */
function renderModuleDict(m){
  const dict=h("div",{class:"card"},h("h2",{},t("dict")));
  for(const k of Object.keys(CATS)){
    const items=VOCAB.filter(c=>c.cat===k);
    const doneK=items.filter(c=>!isNew(c.id)).length;
    dict.append(h("h3",{},`${catName(k)} `,h("span",{class:"muted"},`(${doneK}/${items.length})`),(items.length&&doneK===items.length)?h("span",{class:"chip ok",style:"margin-left:6px"},t("lbl_done1")):null));
    const grid=h("div",{class:"catgrid"});
    for(const c of items){
      const rec=bucketOf(c.id).vocab[c.id];const st=isMastered(c.id)?["m",t("vi_done")]:(rec&&rec.box===0?["l",t("vi_fix")]:(isNew(c.id)?["n",t("vi_new")]:["l",t("vi_learn")]));
      const vi=h("div",{class:"vocab-item"},
        h("span",{class:"st "+st[0]},st[1]),
        h("span",{class:"kgword"},c.ky));
      const vb=sndBtn(c.id);if(vb)vi.append(vb);
      if(c.reuse)vi.append(" ",h("span",{class:"chip"},tf("reuse_chip",{m:metaOf(homeOf(c.id)).num})));
      vi.append(h("br"),h("span",{class:"muted"},gloss(c)));
      grid.append(vi);
    }
    dict.append(grid);
  }
  m.append(dict);
}
/* ---------- План повторения лексики по дням недели (общий для всех модулей) ---------- */
function weekPlanCard(m){
  const plan=weekPlan(CATS,VOCAB);
  if(plan.every(d=>!d.fresh.length&&!d.review.length))return; // модуль без карточек вообще
  const today=(new Date().getDay()+6)%7; // неделя с понедельника
  const topicBtn=k=>{
    const items=VOCAB.filter(c=>c.cat===k);
    const done=items.filter(c=>!isNew(c.id)).length;
    const full=items.length>0&&done===items.length;
    const b=h("button",{class:"chip mpchip"+(full?" ok":"")},(full?"✓ ":"")+catName(k)+" "+done+"/"+items.length);
    b.addEventListener("click",()=>{cardsTopic=k;go("cards");});
    return b;
  };
  const actBtn=(label,fn)=>{const b=h("button",{class:"chip mpchip"},label);b.addEventListener("click",fn);return b;};
  const row=(label,nodes)=>nodes.length?h("div",{style:"margin:2px 0"},h("span",{class:"muted"},label+" "),...nodes):null;

  // роль дня — из микроцикла методики §5.4, чтобы карточка не противоречила плану недели выше
  const ROLE=[
    L("новые слова, порция 1","new words, batch 1","yeni kelimeler, 1. parti"),
    L("новые слова, порция 2","new words, batch 2","yeni kelimeler, 2. parti"),
    L("новые слова, порция 3","new words, batch 3","yeni kelimeler, 3. parti"),
    L("продукция: письмо и речь своими данными","production: writing and speaking with your own details","üretim: kendi bilgilerinle yazma ve konuşma"),
    L("всё вперемешку + мини-тест недели","everything mixed + the weekly quiz","hepsi karışık + haftanın mini sınavı"),
    L("ролевой диалог с тьютором","role-play with your tutor","öğretmenle rol yapma"),
    L("разгрузка: только карточки","light day: flashcards only","hafif gün: yalnızca kartlar")];

  const card=h("div",{class:"card"},
    h("h2",{},L("План повторения по дням недели","Day-by-day revision plan","Günlere göre tekrar planı")),
    h("p",{class:"muted"},L("Новые слова — порциями в дни 1–3, дальше продукция, мини-тест и разгрузка (методика §5.4). Тема возвращается на следующий день и через три — это первые ступени интервалов [1, 3, 7, 16] (§7.6), дальние движок карточек добирает сам. Нажми на тему, чтобы открыть её карточки.","New words come in three batches on days 1–3, then production, the quiz and a light day (methodology §5.4). A topic returns the next day and three days later — the first steps of the [1, 3, 7, 16] intervals (§7.6); the card engine handles the later ones. Tap a topic to open its flashcards.","Yeni kelimeler 1–3. günlerde üç parti hâlinde girer, sonra üretim, mini sınav ve hafif gün gelir (metodoloji §5.4). Bir konu ertesi gün ve üç gün sonra geri döner — bu, [1, 3, 7, 16] aralıklarının ilk basamakları (§7.6); sonraki basamakları kart motoru kendi hesaplar. Kartlarını açmak için konuya dokun.")));
  const tb=h("table",{class:"wpt"});
  plan.forEach((d,i)=>{
    const wd=WEEK_DAYS[i];
    const day=h("td",{},
      h("span",{class:"muted"},L("День ","Day ","Gün ")+(i+1)+" · "),h("span",{class:"kgword"},wd.ky),
      i===today?h("span",{class:"chip acc",style:"margin-left:6px"},L("сегодня","today","bugün")):null,
      h("br"),h("span",{class:"muted"},L(wd.ru,wd.en,wd.tr)));
    const tasks=h("td",{},h("div",{class:"muted",style:"font-size:.9em"},ROLE[i]));
    const fresh=row(L("Жаңы (новое):","Жаңы (new):","Жаңы (yeni):"),d.fresh.map(topicBtn));
    if(fresh)tasks.append(fresh);
    const rev=row(L("Кайталоо (повторение):","Кайталоо (revision):","Кайталоо (tekrar):"),d.review.map(topicBtn));
    if(rev)tasks.append(rev);
    if(i>=STUDY_DAYS){
      tasks.append(h("div",{style:"margin:2px 0"},
        h("span",{class:"muted"},L("Всё вперемешку: ","Everything mixed: ","Hepsi karışık: ")),
        actBtn(t("cards_mix"),()=>{cardsTopic=null;go("cards");}),
        (ST.marked&&ST.marked.length)?actBtn(t("cards_marked")+" "+ST.marked.length,()=>{cardsTopic="__marked";go("cards");}):null,
        i===TEST_DAY?actBtn(t("tab_test"),()=>go("test")):null));
    }
    tb.append(h("tr",{},day,tasks));
  });
  card.append(h("div",{class:"tablewrap"},tb),
    h("div",{class:"note"},L("Дни недели — ориентир: если модуль начат не в понедельник, считай их днями 1–7 своей недели. Кыргызские названия здесь заодно повторяют лексику М5.","The weekday names are a guide: if you started the module midweek, read them as days 1–7 of your own week. The Kyrgyz names double as M5 vocabulary.","Hafta günleri yalnızca bir kılavuz: modüle hafta ortasında başladıysan bunları kendi haftanın 1–7. günleri olarak oku. Kırgızca adlar aynı zamanda M5 kelimelerini tekrar ettirir.")));
  m.append(card);
}
/* ---------- М0: Тексты недели (учебник «Кыргыз тили», стр. от заказчика) ---------- */
function renderTextsM0(m){
  const dlg=[["— Саламатсыңбы, Айгерим.","— Здравствуй, Айгерим. (старшая — ребёнку, неформально)","— Hello, Aigerim. (elder to child, informal)","— Merhaba, Aygerim. (büyük olan çocuğa, samimi)"],
             ["— Саламатчылык, Айгүл эже.","— Здравствуйте, Айгүл-эже. (ребёнок — старшей, уважительно + обращение «эже»)","— Hello, Aigül-eje. (child to elder, respectful «эже»)","— Merhaba, Aygül-ece. (çocuk büyüğe, saygılı + “эже” hitabı)"],
             ["— Кандай?","— Как дела?","— How are things?","— Ne haber?"],
             ["— Жакшы.","— Хорошо.","— Fine.","— İyiyim."]];
  const poem=[["Салам айтам «салам» деп,","Здороваюсь, говоря «салам»,","I greet by saying «салам»,","“Салам” diyerek selam veriyorum,"],
              ["Ишин сурайм «кандай» деп.","Про дела спрашиваю — «кандай».","I ask how things are — «кандай».","“Кандай” diyerek halini soruyorum."],
              ["Айжан айтат «жакшы» деп,","Айжан отвечает «жакшы»,","Aijan replies «жакшы»,","Aycan “жакшы” diye cevap veriyor,"],
              ["Саша айтат «сонун» деп.","Саша отвечает «сонун».","Sasha replies «сонун».","Saşa “сонун” diye cevap veriyor."]];
  const texts=weekTextsCard("(из учебника «Кыргыз тили»)","(from the «Кыргыз тили» textbook)",null,null,"(«Кыргыз тили» ders kitabından)");
  texts.append(h("h3",{},L("Диалог: старшая и младшая","Dialogue: elder and younger","Diyalog: büyük ve küçük")),
    biTable(dlg),
    h("div",{class:"note"},L("Обрати внимание на асимметрию вежливости: старшая говорит ребёнку «саламатсыңбы» (неформально), ребёнок отвечает «саламатчылык» и добавляет уважительное обращение «эже». Так работает этикет старшинства.","Note the politeness asymmetry: the elder says «саламатсыңбы» (informal) to the child, the child replies «саламатчылык» and adds the respectful «эже». That is how seniority etiquette works.","Nezaketteki asimetriye dikkat et: büyük olan çocuğa “саламатсыңбы” (samimi) der, çocuk “саламатчылык” diye cevap verir ve saygılı “эже” hitabını ekler. Yaş hiyerarşisinin görgü kuralı böyle işler.")),
    h("h3",{},L("Стих: Б. Топоева-Ставинская","Poem: B. Topoeva-Stavinskaya","Şiir: B. Topoyeva-Stavinskaya")));
  texts.append(biTable(poem),
    h("p",{class:"muted"},L("Разбор: айтам — говорю; айтат — говорит; сурайм — спрашиваю; иш(ин) — дело (его/её); деп — частица цитирования «говоря/мол». Прочитай стих вслух 3–4 раза — это тренировка ритма и ударения на последний слог.","Glossary: айтам — I say; айтат — says; сурайм — I ask; иш(ин) — matter; деп — the quoting particle. Read the poem aloud 3–4 times — rhythm and final-syllable stress practice.","Çözümleme: айтам — söylüyorum; айтат — söylüyor; сурайм — soruyorum; иш(ин) — (onun) işi; деп — “diye” işlevindeki aktarma sözcüğü. Şiiri 3–4 kez yüksek sesle oku — bu, ritim ve son hece vurgusu alıştırmasıdır.")),
    h("h3",{},L("Лесенка приветствий (от простого к вежливому)","The greeting ladder (casual → polite)","Selamlaşma merdiveni (sadeden kibara)")),
    h("ul",{class:"muted"},
      h("li",{},h("span",{class:"kgword"},"Салам!"),L(" — друзьям, ровесникам"," — to friends and peers"," — arkadaşlara ve yaşıtlara")),
      h("li",{},h("span",{class:"kgword"},"Саламатсыңбы!"),L(" — одному, неформально"," — to one person, informal"," — bir kişiye, samimi")),
      h("li",{},h("span",{class:"kgword"},"Саламатсыңарбы!"),L(" — нескольким, неформально"," — to several, informal"," — birkaç kişiye, samimi")),
      h("li",{},h("span",{class:"kgword"},"Саламатсызбы!"),L(" — вежливо (незнакомым, старшим)"," — polite (strangers, elders)"," — kibar (yabancılara, büyüklere)")),
      h("li",{},h("span",{class:"kgword"},"Саламатчылык!"),L(" — универсальный ответ на приветствие"," — the universal reply to a greeting"," — selama verilen, her duruma uygun karşılık")),
      h("li",{},L("Прощание: ","Farewells: ","Vedalaşma: "),h("span",{class:"kgword"},"Жакшы кал! / Жакшы калыңыз!"),L(" (уходящий) · "," (the one leaving) · "," (giden söyler) · "),h("span",{class:"kgword"},"Жакшы бар! / Жакшы баргыла! / Жакшы барыңыз!"),L(" (остающийся)"," (the one staying)"," (kalan söyler)"))),
    h("h3",{},L("Знакомство (Таанышуу)","Introductions (Таанышуу)","Tanışma (Таанышуу)")),
    h("ul",{class:"muted"},
      h("li",{},h("span",{class:"kgword"},"Сенин атың ким?"),L(" — Как тебя зовут? (на «ты»)"," — What is your name? (informal)"," — Adın ne? (samimi)")),
      h("li",{},h("span",{class:"kgword"},"Атыңыз ким?"),L(" — Как Вас зовут? (вежливо)"," — What is your name? (polite)"," — Adınız ne? (kibar)")),
      h("li",{},h("span",{class:"kgword"},"Менин атым Асан."),L(" — Меня зовут Асан. (подставь своё имя)"," — My name is Asan (insert your own name)"," — Benim adım Asan. (kendi adını koy)"))),
    h("p",{class:"muted"},L("Заметь пару атың / атыңыз: «-ың» — твоё, «-ыңыз» — Ваше. Это притяжательные аффиксы — подробно разберём в модулях М1–М2, пока просто запомни обе формы вопроса.","Note the pair атың / атыңыз: «-ың» — yours, «-ыңыз» — yours (polite). These are possessive affixes — detailed in M1–M2; for now memorise both question forms.","атың / атыңыз çiftine dikkat et: “-ың” — senin, “-ыңыз” — sizin. Bunlar iyelik ekleridir — ayrıntısı M1–M2 modüllerinde; şimdilik sorunun her iki biçimini de ezberle.")),
    h("h3",{},L("Ким? Эмне? (кто? что?)","Ким? Эмне? (who? what?)","Ким? Эмне? (kim? ne?)")),
    h("ul",{class:"muted"},
      h("li",{},h("span",{class:"kgword"},"Ким?"),L(" — кыз бала, эркек бала, мугалим (люди)"," — кыз бала, эркек бала, мугалим (people)"," — кыз бала, эркек бала, мугалим (insanlar)")),
      h("li",{},h("span",{class:"kgword"},"Эмне?"),L(" — мектеп (предметы)"," — мектеп (things)"," — мектеп (nesneler)"))),
    h("div",{class:"note"},L("Важное отличие от русского: «ким?» спрашивают только о людях. О животных по-кыргызски спрашивают «эмне?» — не «кто?», как в русском. Эта пара вопросов — основа падежной системы (кимге? эмнеге? кимде? эмнеде?…), которая начнётся с модуля М2.","Important: «ким?» asks only about people. Animals take «эмне?». This question pair is the base of the case system (кимге? эмнеге? кимде? эмнеде?…), starting from module M2.","Türkçeyle aynı: “ким?” yalnızca insanlar için sorulur, hayvanlar için “эмне?” denir — tıpkı Türkçedeki kim? / ne? ayrımı gibi. Bu soru çifti, M2'den itibaren başlayan hâl sisteminin temelidir (кимге? эмнеге? кимде? эмнеде?…).")),
    h("h3",{},L("Окуу куралдары — «Бул эмне?»","School supplies — «Бул эмне?»","Okul gereçleri — “Бул эмне?”")),
    h("ul",{class:"muted"},
      h("li",{},h("span",{class:"kgword"},"— Бул эмне? — Бул китеп."),L(" — «Что это? — Это книга.» Главный шаблон недели: подставляй любое слово (Бул дептер. Бул калем сап. Бул мектеп.)"," — “What is this? — This is a book.” The key template of the week: plug in any word (Бул дептер. Бул калем сап. Бул мектеп.)"," — “Bu ne? — Bu bir kitap.” Haftanın ana kalıbı: yerine istediğin kelimeyi koy (Бул дептер. Бул калем сап. Бул мектеп.)")),
      h("li",{},h("span",{class:"kgword"},"калем жана китеп"),L(" — «ручка и книга»: союз "," — “pen and book”: the conjunction "," — “kalem ve kitap”: bağlaç "),h("span",{class:"kgword"},"жана"),L(" (и) соединяет слова"," (and) joins words"," (ve) kelimeleri birbirine bağlar"))),
    h("div",{class:"note"},L("Бонус для сингармонизма: суффикс инструмента -гыч/-гич/-гуч/-гүч — сыз (чертить) → сызгыч (линейка), өчүр (стирать) → өчүргүч (ластик), учта (точить) → учтагыч (точилка). Три школьных предмета — три варианта одного суффикса; такие задания добавлены в дрилл «Сингармонизм».","Harmony bonus: the tool suffix -гыч/-гич/-гуч/-гүч — сыз (draw) → сызгыч (ruler), өчүр (erase) → өчүргүч (eraser), учта (sharpen) → учтагыч (sharpener). Three school items — three variants of one suffix; these are in the “Vowel harmony” drill.","Ünlü uyumu bonusu: alet eki -гыч/-гич/-гуч/-гүч — сыз (çizmek) → сызгыч (cetvel), өчүр (silmek) → өчүргүч (silgi), учта (uçlamak) → учтагыч (kalemtıraş). Üç okul eşyası — tek bir ekin üç varyantı; bu tür sorular “Ünlü uyumu” alıştırmasında var.")));
  m.append(texts);
}

/* ---------- Алфавит и фонетика (статический справочник) ---------- */
/* ===ALPHABET=== */
/* Справочник алфавита: звук (IPA), латинское соответствие (турецкая раскладка ложится
   на кыргызскую кириллицу почти один в один) и описание произношения на трёх языках.
   snd/ex — тройки [ru, en, tr]; word — кыргызский пример с этой буквой. */
const ALPHABET=[
 {up:"А",low:"а",ipa:"[ɑ]",lat:"a",word:"ата",ex:["отец","father","baba"],
  snd:["как русское «а», но заднее — как «а» в «палка»","like a in father","Türkçedeki a gibi, biraz daha art damaktan"]},
 {up:"Б",low:"б",ipa:"[b]",lat:"b",word:"бала",ex:["ребёнок","child","çocuk"],
  snd:["как русское «б»","like b in book","Türkçedeki b gibi"]},
 {up:"В",low:"в",ipa:"[v]",lat:"v",word:"вокзал",ex:["вокзал","station","gar"],
  snd:["как русское «в»; в исконных словах почти не встречается","like v in van; rare outside loanwords","Türkçedeki v gibi; alıntı kelimeler dışında neredeyse yok"]},
 {up:"Г",low:"г",ipa:"[g] / [ʁ]",lat:"g / ğ",word:"гүл",ex:["цветок","flower","çiçek"],
  snd:["«г»; в твёрдых словах между гласными звучит как гортанное фрикативное [ʁ] (тоого) — примерно как «г» в беглом «ага»","g; between vowels in back words it becomes a throaty fricative [ʁ] (тоого)","g; kalın kelimelerde ünlüler arasında Arapçadaki gayın (غ) gibi gırtlaktan sürtünmeli [ʁ] olur (тоого) — Türkçedeki ğ gibi düşmez"]},
 {up:"Д",low:"д",ipa:"[d]",lat:"d",word:"дос",ex:["друг","friend","arkadaş"],
  snd:["как русское «д»","like d in door","Türkçedeki d gibi"]},
 {up:"Е",low:"е",ipa:"[je] / [e]",lat:"ye / e",word:"мектеп",ex:["школа","school","okul"],
  snd:["в начале слова — «йэ» (в основном в заимствованиях: Европа), после согласной — «э»","“ye” at the start (mostly in loanwords: Европа), plain “e” after a consonant","kelime başında ye (çoğunlukla alıntılarda: Европа), ünsüzden sonra e"]},
 {up:"Ё",low:"ё",ipa:"[jo]",lat:"yo",word:"ёлка",ex:["ёлка (заимствование)","New Year tree (loanword)","yılbaşı ağacı (alıntı)"],
  snd:["«йо»; встречается только в заимствованиях из русского","“yo”; only in Russian loanwords","yo; yalnızca Rusçadan alıntılarda"]},
 {up:"Ж",low:"ж",ipa:"[dʒ] / [ʒ]",lat:"c / j",word:"жол",ex:["дорога","road","yol"],
  snd:["в кыргызских словах — «дж», как в «джем» (жол); в русских заимствованиях сохраняется «ж» (инженер, багаж)","in native words it is “j” as in jam (жол); Russian loanwords keep the “zh” of measure (инженер, багаж)","öz kelimelerde Türkçedeki c gibi (cam): жол; Rusça alıntılarda j gibi kalır (инженер, багаж). Not: kelime başındaki ж sık sık Türkçedeki y ile eşleşir — жол/yol, жыл/yıl, жаңы/yeni"]},
 {up:"З",low:"з",ipa:"[z]",lat:"z",word:"көз",ex:["глаз","eye","göz"],
  snd:["как русское «з»","like z in zoo","Türkçedeki z gibi"]},
 {up:"И",low:"и",ipa:"[i]",lat:"i",word:"ини",ex:["младший брат","younger brother","küçük erkek kardeş"],
  snd:["как русское «и»","like ee in see, but short","Türkçedeki i gibi"]},
 {up:"Й",low:"й",ipa:"[j]",lat:"y",word:"үй",ex:["дом","house","ev"],
  snd:["краткое «й»","like y in yes","Türkçedeki y gibi"]},
 {up:"К",low:"к",ipa:"[k] / [q]",lat:"k",word:"китеп",ex:["книга","book","kitap"],
  snd:["в мягких словах — «к», в твёрдых — глубокое горловое [q] (кыз)","“k” in front words; a deep uvular [q] in back words (кыз)","ince kelimelerde k, kalın kelimelerde Arapçadaki kaf gibi derin [q]"]},
 {up:"Л",low:"л",ipa:"[l]",lat:"l",word:"көл",ex:["озеро","lake","göl"],
  snd:["как русское «л»","like l in lake","Türkçedeki l gibi"]},
 {up:"М",low:"м",ipa:"[m]",lat:"m",word:"мен",ex:["я","I","ben"],
  snd:["как русское «м»","like m in me","Türkçedeki m gibi"]},
 {up:"Н",low:"н",ipa:"[n]",lat:"n",word:"нан",ex:["хлеб","bread","ekmek"],
  snd:["как русское «н»","like n in no","Türkçedeki n gibi"]},
 {up:"Ң",low:"ң",ipa:"[ŋ]",lat:"ñ (ng)",word:"таң",ex:["рассвет","dawn","şafak"],special:true,
  snd:["носовое «н» без «г» на конце — как английское ng в sing","the ng of sing — one nasal sound, no separate g","genizden n; İngilizce sing sözcüğündeki ng, eski Türkçedeki ñ (nazal n)"]},
 {up:"О",low:"о",ipa:"[o]",lat:"o",word:"оку",ex:["учись, читай","study, read","oku"],
  snd:["как русское «о» под ударением (без «а»-редукции)","like o in more, always full — never reduced to “a”","Türkçedeki o gibi; vurgusuzken bile a'ya dönüşmez"]},
 {up:"Ө",low:"ө",ipa:"[ø]",lat:"ö",word:"сөз",ex:["слово","word","söz"],special:true,
  snd:["скажите «э» и округлите губы, как для «о» (немецкое ö)","say “e” and round your lips as for “o” (German ö)","tam olarak Türkçedeki ö"]},
 {up:"П",low:"п",ipa:"[p]",lat:"p",word:"апа",ex:["мама","mother","anne"],
  snd:["как русское «п»; перед гласной аффикса озвончается в «б» (китеп → китебим)","like p in pen; voices to “b” before an affix vowel (китеп → китебим)","Türkçedeki p gibi; ek ünlüsünden önce b'ye döner (китеп → китебим)"]},
 {up:"Р",low:"р",ipa:"[r]",lat:"r",word:"ыр",ex:["песня","song","şarkı"],
  snd:["раскатистое «р», как в русском","a rolled r, as in Spanish or Russian","Türkçedeki tek vuruşlu r yerine İtalyancadaki gibi yuvarlanan, çok vuruşlu r"]},
 {up:"С",low:"с",ipa:"[s]",lat:"s",word:"суу",ex:["вода","water","su"],
  snd:["как русское «с»","like s in sun","Türkçedeki s gibi"]},
 {up:"Т",low:"т",ipa:"[t]",lat:"t",word:"тил",ex:["язык","language","dil"],
  snd:["как русское «т»","like t in top","Türkçedeki t gibi"]},
 {up:"У",low:"у",ipa:"[u]",lat:"u",word:"уул",ex:["сын","son","oğul"],
  snd:["как русское «у»","like oo in food","Türkçedeki u gibi"]},
 {up:"Ү",low:"ү",ipa:"[y]",lat:"ü",word:"күн",ex:["день, солнце","day, sun","gün, güneş"],special:true,
  snd:["скажите «и» и округлите губы, как для «у» (немецкое ü). НЕ «ю»","say “i” and round your lips as for “u” (German ü, French u)","tam olarak Türkçedeki ü"]},
 {up:"Ф",low:"ф",ipa:"[f]",lat:"f",word:"фильм",ex:["фильм (заимствование)","film (loanword)","film (alıntı)"],
  snd:["как русское «ф»; только в заимствованиях","like f in film; loanwords only","Türkçedeki f gibi; yalnızca alıntılarda"]},
 {up:"Х",low:"х",ipa:"[χ]",lat:"h",word:"тарых",ex:["история","history","tarih"],
  snd:["как русское «х», глубже к горлу; редкая буква","a raspy h, further back in the throat; a rare letter","gırtlaktan gelen sert h; nadir bir harf"]},
 {up:"Ц",low:"ц",ipa:"[ts]",lat:"ts",word:"цирк",ex:["цирк (заимствование)","circus (loanword)","sirk (alıntı)"],
  snd:["как русское «ц»; только в заимствованиях","the ts of cats; loanwords only","ts sesi; yalnızca alıntılarda"]},
 {up:"Ч",low:"ч",ipa:"[tʃ]",lat:"ç",word:"чай",ex:["чай","tea","çay"],
  snd:["как русское «ч», но твёрже","like ch in chair","tam olarak Türkçedeki ç"]},
 {up:"Ш",low:"ш",ipa:"[ʃ]",lat:"ş",word:"шаар",ex:["город","city","şehir"],
  snd:["как русское «ш»","like sh in shop","tam olarak Türkçedeki ş"]},
 {up:"Щ",low:"щ",ipa:"[ʃtʃ]",lat:"şç",word:"щётка",ex:["щётка (заимствование)","brush (loanword)","fırça (alıntı)"],
  snd:["как русское «щ»; только в русских заимствованиях","“shch”; Russian loanwords only","şç sesi; yalnızca Rusça alıntılarda"]},
 {up:"Ъ",low:"ъ",ipa:"—",lat:"—",word:"объект",ex:["объект (заимствование)","object (loanword)","nesne (alıntı)"],
  snd:["звука нет: твёрдый знак, только в русских заимствованиях","no sound: a hard sign, Russian loanwords only","sesi yok: sertlik işareti, yalnızca Rusça alıntılarda"]},
 {up:"Ы",low:"ы",ipa:"[ɯ]",lat:"ı",word:"кыз",ex:["девочка, дочь","girl, daughter","kız"],
  snd:["как русское «ы», но глубже — ближе к турецкому ı","a back unrounded vowel: spread your lips and say “oo” without rounding","tam olarak Türkçedeki ı"]},
 {up:"Ь",low:"ь",ipa:"—",lat:"—",word:"пароль",ex:["пароль (заимствование)","password (loanword)","şifre (alıntı)"],
  snd:["звука нет: мягкий знак, только в заимствованиях","no sound: a soft sign, loanwords only","sesi yok: yumuşaklık işareti, yalnızca alıntılarda"]},
 {up:"Э",low:"э",ipa:"[e]",lat:"e",word:"эже",ex:["старшая сестра","older sister","abla"],
  snd:["как русское «э»; в начале кыргызских слов пишется именно «э»","like e in bed; native words start with э, not е","Türkçedeki e gibi; öz Kırgızca kelimeler е ile değil э ile başlar"]},
 {up:"Ю",low:"ю",ipa:"[ju] / [y]",lat:"yu / yü",word:"оюн",ex:["игра","game","oyun"],
  snd:["«йу» после гласной и в начале (оюн, юрист); после согласной в заимствованиях — просто «ю» (костюм)","“yu” after a vowel or at the start (оюн); after a consonant in loanwords it is plain [y] (костюм)","ünlüden sonra ve kelime başında yu (оюн); alıntılarda ünsüzden sonra sadece [y] (костюм)"]},
 {up:"Я",low:"я",ipa:"[jɑ]",lat:"ya",word:"аял",ex:["жена; женщина","wife; woman","eş; kadın"],
  snd:["«йа» — и в кыргызских словах (аял, таята, коюңуз), и в заимствованиях (январь)","“ya” — in native words too (аял, таята), and in loanwords (январь)","ya — öz Kırgızca kelimelerde de var (аял, таята), alıntılarda da (январь)"]}];
/* ===/ALPHABET=== */
function renderAlphabet(m){
  const alpha=h("div",{class:"card"},h("h2",{},L("Кыргызский алфавит (кириллица, 36 букв)","Kyrgyz alphabet (Cyrillic, 36 letters)","Kırgız alfabesi (Kiril, 36 harf)")));
  const row=h("div",{});
  for(const a of ALPHABET)row.append(h("span",{class:"letter"+(a.special?" special":"")},a.up));
  // подпись опирается на язык читателя: русскому эти буквы новы целиком, турку ө/ү знакомы
  // как ö/ü, англоязычному нужна опора на латиницу и знакомые английские звуки
  alpha.append(row,h("p",{class:"muted"},L(
    "Фиолетовым — три буквы, которых нет в русском: ө, ү, ң. Остальные 33 читаются как в русском, с оговорками из таблицы ниже.",
    "Purple marks the three letters Kyrgyz adds to the Russian alphabet: ө (German ö), ү (German ü) and ң (the ng of sing). The other 33 are the standard Russian Cyrillic set — see the table below for the details.",
    "Mor renkli üç harf Rusçada yoktur — ama ikisi sana yabancı değil: ө = ö, ү = ü. Yalnızca üçüncüsü yeni: ң, eski Türkçedeki ñ (nazal n). Kalan 33 harf Rusçadaki gibi okunur; ayrıntılar aşağıdaki tabloda.")));
  // Транскрипция каждой буквы: звук, латинское соответствие и описание на языке интерфейса
  const tb=h("table",{},h("tr",{},
    h("th",{},L("Буква","Letter","Harf")),
    h("th",{},L("Звук","Sound","Ses")),
    h("th",{},L("Латиницей","Latin","Latin harf")),
    h("th",{},L("Как звучит","How it sounds","Nasıl duyulur")),
    h("th",{},L("Пример","Example","Örnek"))));
  for(const a of ALPHABET){
    const ex=h("td",{},h("span",{class:"kgword"},a.word),h("br"),h("span",{class:"muted"},L(...a.ex)));
    tb.append(h("tr",{},
      h("td",{style:"white-space:nowrap"},h("span",{class:"letter"+(a.special?" special":""),style:"font-size:1.15rem"},a.up+" "+a.low)),
      h("td",{style:"white-space:nowrap"},a.ipa),
      h("td",{style:"white-space:nowrap"},h("b",{},a.lat)),
      h("td",{class:"muted"},L(...a.snd)),
      ex));
  }
  alpha.append(h("div",{class:"tablewrap"},tb),
    h("div",{class:"note"},L("Колонка «Латиницей» — запись на основе турецкого алфавита: кыргызская кириллица ложится на него почти один в один (ж = c, ч = ç, ш = ş, ы = ı, ө = ö, ү = ü). Для ң, ц, щ, ё, ю, я турецких букв нет — там дана условная передача.","The “Latin” column uses the Turkish alphabet as its base: Kyrgyz Cyrillic maps onto it almost one to one (ж = c, ч = ç, ш = ş, ы = ı, ө = ö, ү = ü). For ң, ц, щ, ё, ю, я Turkish has no letter, so the value is conventional.","“Latin harf” sütunu Türk alfabesini temel alır: Kırgız Kirili buna neredeyse birebir oturur (ж = c, ч = ç, ш = ş, ы = ı, ө = ö, ү = ü). ң, ц, щ, ё, ю, я için Türkçede harf yok — oradaki karşılık yaklaşıktır.")));
  m.append(alpha);

  const mkRow=(...cells)=>h("tr",{},...cells.map((c,i)=>h(i===0?"td":"td",{},...(Array.isArray(c)?c:[c]))));
  const t3=h("div",{class:"card"},h("h2",{},L("Три новые буквы","Three new letters","Üç yeni harf")),
    h("table",{},
      h("tr",{},h("th",{},L("Буква","Letter","Harf")),h("th",{},L("Звук","Sound","Ses")),h("th",{},L("Как произнести","How to pronounce","Nasıl söylenir")),h("th",{},L("Примеры","Examples","Örnekler"))),
      mkRow(h("span",{class:"kgword",style:"font-size:1.3rem"},"ө"),"[ø]",L("Скажите «э» и округлите губы, как для «о» (немецкое ö). Средний звук между «о» и «э».","Say “e” and round your lips as for “o” (German ö). A sound between “o” and “e”.","“e” deyip dudaklarını “o” için yuvarla (Almanca ö). “o” ile “e” arasında bir ses."),[kgw("өз","ph_oz"),L(" (сам), "," (self), "," (kendi), "),kgw("төр","ph_tor"),L(" (почётное место), "," (seat of honour), "," (başköşe), "),kgw("сөз","ph_soz"),L(" (слово), "," (word), "," (söz), "),kgw("көл","ph_koel"),L(" (озеро)"," (lake)"," (göl)")]),
      mkRow(h("span",{class:"kgword",style:"font-size:1.3rem"},"ү"),"[y]",L("Скажите «и» и округлите губы, как для «у» (немецкое ü, французское u). НЕ русское «ю».","Say “i” and round your lips as for “u” (German ü, French u).","“i” deyip dudaklarını “u” için yuvarla (Almanca ü, Fransızca u). Rusçadaki “ю” DEĞİL."),[kgw("үй","ph_uy"),L(" (дом), "," (house), "," (ev), "),kgw("күн","ph_kun"),L(" (день), "," (day), "," (gün), "),kgw("түн","ph_tun"),L(" (ночь), "," (night), "," (gece), "),kgw("үн","ph_un"),L(" (голос)"," (voice)"," (ses)")]),
      mkRow(h("span",{class:"kgword",style:"font-size:1.3rem"},"ң"),"[ŋ]",L("Носовое «н», как английское ng в sing — единый звук, БЕЗ отдельного «г» в конце.","Nasal “n”, like English ng in sing — one sound, WITHOUT a separate “g”.","Genizden “n”, İngilizce sing sözcüğündeki ng gibi — tek ses, sonunda ayrı bir “g” YOK."),[kgw("таң","ph_tang"),L(" (рассвет), "," (dawn), "," (şafak), "),kgw("атыңыз","ph_atyngyz"),L(" (ваше имя), "," (your name), "," (adınız), "),kgw("калыңыз","ph_kalyngyz"),L(" (оставайтесь)"," (stay)"," (kalınız)")])),
    // ловушки у носителей разных языков разные: русскому трудны ө/ү, турку они знакомы,
    // зато его подводят ң (произносит с отдельным «г») и ж (читает как своё j вместо c)
    h("div",{class:"note"},L(
      "Типичная ошибка русскоязычных №1: заменять ө→о/е и ү→у/ю. Слово может поменять смысл, а гармония гласных дальше по слову «поедет» неправильно (методика §9).",
      "Typical mistake #1: replacing ө→о/е and ү→у/ю. The word may change meaning, and vowel harmony down the word goes wrong (methodology §9).",
      "Türkçe konuşan için ө/ү/ы kolaydır — asıl tuzak başka yerde: ң’ı sonunda ayrı bir “g” ile söylemek (таң, “tang” değil) ve ж’yi Türkçedeki j gibi okumak (doğrusu c: жол ≈ “col”). Ünlü uyumu ise Türkçedekiyle aynı mantıkta işler (metodoloji §9).")));
  m.append(t3);

  const harm=h("div",{class:"card"},h("h2",{},L("Сингармонизм — закон гармонии гласных","Vowel harmony — the core law","Ünlü uyumu — dilin temel yasası")),
    h("p",{class:"muted"},L("Главное правило языка: гласный корня определяет гласные всех суффиксов. Поэтому у большинства суффиксов 4 варианта (иногда 12 — с учётом озвончения согласных).","The language’s core rule: the stem vowel determines the vowels of all suffixes. That is why most suffixes have 4 variants (sometimes 12, counting consonant voicing).","Dilin ana kuralı: kökteki ünlü, bütün eklerin ünlülerini belirler. Bu yüzden eklerin çoğunun 4 varyantı vardır (ünsüz yumuşamasıyla birlikte bazen 12).")),
    h("table",{},
      h("tr",{},h("th",{},""),h("th",{},L("неогубленные","unrounded","düz")),h("th",{},L("огубленные","rounded","yuvarlak"))),
      h("tr",{},h("td",{},h("b",{},L("твёрдые (задний ряд)","back (hard)","kalın (art ünlüler)"))),h("td",{class:"hard",style:"text-align:center"},"а, ы"),h("td",{class:"hard",style:"text-align:center"},"о, у")),
      h("tr",{},h("td",{},h("b",{},L("мягкие (передний ряд)","front (soft)","ince (ön ünlüler)"))),h("td",{class:"soft",style:"text-align:center"},"э (е), и"),h("td",{class:"soft",style:"text-align:center"},"ө, ү"))),
    h("h3",{},L("Как это работает","How it works","Nasıl işler")),
    (function(){const pp=h("p",{},h("span",{class:"kgword"},"кой")," (о) → кой",h("b",{},"чу"));let b=sndBtn("ph_koychu");if(b)pp.append(b);pp.append(L(" — чабан · "," — shepherd · "," — çoban · "),h("span",{class:"kgword"},"балык")," (а/ы) → балык",h("b",{},"чы"));b=sndBtn("ph_balykchy");if(b)pp.append(b);pp.append(L(" — рыбак · "," — fisherman · "," — balıkçı · "),h("span",{class:"kgword"},"мерген")," (е) → мерген",h("b",{},"чи"));b=sndBtn("ph_mergenchi");if(b)pp.append(b);pp.append(L(" — охотник · "," — hunter · "," — avcı · "),h("span",{class:"kgword"},"сүрөт")," (ү/ө) → сүрөт",h("b",{},"чү"));b=sndBtn("ph_surotchu");if(b)pp.append(b);pp.append(L(" — художник"," — artist"," — ressam"));return pp;})(),
    h("p",{class:"muted"},L("Тот же суффикс «-чы» (профессия) — четыре формы. Выбор формы — навык №1 всего курса, дрилл на соседней вкладке.","The same profession suffix «-чы» — four forms. Choosing the form is skill #1 of the whole course; the drill is on the next tab.","Aynı “-чы” meslek eki — dört biçim. Doğru biçimi seçmek kursun bir numaralı becerisidir; alıştırma yan sekmede.")));
  m.append(harm);

  m.append(h("div",{class:"card"},h("h2",{},L("Ударение","Stress","Vurgu")),
    h("p",{class:"muted"},L("Как правило — на последний слог, и при наращивании суффиксов оно «переезжает» в конец слова. По инерции из русского хочется держать ударение на корне — следите за этим при чтении вслух.","As a rule — on the last syllable, and it “moves” to the end as suffixes are added. Watch it while reading aloud.","Kural olarak son hecede; ek geldikçe vurgu kelimenin sonuna “taşınır”. Yüksek sesle okurken buna dikkat et."))));

  m.append(h("div",{class:"card"},h("h2",{},L("Мини-правила чтения","Mini reading rules","Kısa okuma kuralları")),
    h("ul",{class:"muted"},
      h("li",{},L("Читается как пишется; редукции безударных гласных (как в русском «мОлОко») нет.","Read as written; there is no unstressed-vowel reduction.","Yazıldığı gibi okunur; vurgusuz ünlülerin daralması (Rusçadaki “мОлОко” gibi) yoktur.")),
      h("li",{},L("К и Г звучат твёрже/глубже в «твёрдых» словах (кол, кыз) и мягче в «мягких» (күн, кел) — происходит само, отдельно учить не надо.","К and Г sound deeper in “back” words (кол, кыз) and softer in “front” ones (күн, кел) — it happens naturally.","К ve Г, kalın kelimelerde daha derin (кол, кыз), ince kelimelerde daha yumuşak (күн, кел) duyulur — kendiliğinden olur, ayrıca çalışmaya gerek yok.")),
      h("li",{},L("На стыке морфем глухие озвончаются: китеп → китебим (моя книга). Встретится со 2-го модуля.","At morpheme joints voiceless consonants voice: китеп → китебим (my book). Appears from module M2.","Ek sınırında tonsuzlar tonlulaşır: китеп → китебим (kitabım). M2'den itibaren karşına çıkacak.")))));
}
