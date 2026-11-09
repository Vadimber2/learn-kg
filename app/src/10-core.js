/* ===/DATA=== */
// Демо-режим: сервер собирает /demo из этого же файла (buildDemoHtml), подставляя "1";
// ветка «/» для вошедших подставляет "0", file:// оставляет плейсхолдер — оба не-демо.
// Константа живёт ВНЕ маркер-блоков (их исполняют vm-тесты без неё) и ДО первой деривации VOCAB.
const IS_DEMO="__DEMO__"==="1";
/* ===REUSE=== */
// Переиспользование слов между модулями: alias-запись {ref:"m1_136",cat:"ilik"} резолвится
// в КОПИЮ карточки-донора с ИСХОДНЫМ id — SRS-прогресс, вычитка и аудио остаются едиными
// и живут в родном модуле слова. Слово вводится один раз, повторяется где нужно.
function homeOf(id){return id.startsWith("ph_")?"m0":id.split("_")[0];}
function resolveVocab(list,content){
  const out=[];
  for(const v of list){
    if(!v.ref){out.push(v);continue;}
    const donor=((content[homeOf(v.ref)]||{}).vocab||[]).find(d=>d.id===v.ref);
    if(!donor){console.warn("reuse: донор не найден: "+v.ref);continue;}
    out.push(Object.assign({},donor,{cat:v.cat,reuse:true}));
  }
  return out;
}
/* ===/REUSE=== */
// стартовый модуль сборки: М0, а где его нет (демо собирается из одного модуля) — первый готовый
const BOOT_MOD=CONTENT.m0?"m0":CONTENT_READY[0];
let CATS=CONTENT[BOOT_MOD].cats, VOCAB=resolveVocab(CONTENT[BOOT_MOD].vocab,CONTENT), DRILL=CONTENT[BOOT_MOD].drill;
let cardsTopic=null; // null = вперемешку; иначе ключ категории (сбрасывается при смене модуля)
let drillTopic=null; // null = вперемешку; иначе ключ группы дрилла (сбрасывается при смене модуля)
// «__marked» — виртуальная тема, валидна в любом модуле; обычные темы сбрасываются, если ключа нет
function applyModuleContent(){const c=CONTENT[activeModule]||CONTENT[BOOT_MOD];CATS=c.cats;VOCAB=resolveVocab(c.vocab,CONTENT);DRILL=c.drill;if(cardsTopic&&cardsTopic!=="__marked"&&!CATS[cardsTopic])cardsTopic=null;if(drillTopic&&!(c.drillGroups||{})[drillTopic])drillTopic=null;applyOverrides();}
// трёхъязычное поле объекта: bi(obj,"name") → obj.nameTr / obj.nameEn / obj.name по языку
function bi(o,f){const l=currentLang();return (l==="tr"&&o[f+"Tr"])||(l!=="ru"&&o[f+"En"])||o[f];}
function drillGroupsOf(){return (CONTENT[activeModule]||{}).drillGroups||{};}
function drillGroupName(k){const g=drillGroupsOf()[k];return g?bi(g,"name"):k;}
function drillGroupRule(k){const g=drillGroupsOf()[k];return g?bi(g,"rule"):"";}
function ownVocab(){return VOCAB.filter(c=>!c.reuse);} // свои (не переиспользованные) слова активного модуля

/* ---------- Логика карточек (Leitner + интервалы, Unicode-safe) ---------- */
const SCHEDULE_DAYS=[1,3,7,16], MASTERY_BOX=3, DAY=86400000;
// Unicode-фикс normalizeAnswer: \p{L}\p{N} вместо [a-z0-9] (reuse-audit §2.1)
// NFC обязателен: iOS-клавиатуры шлют й/ё разложенными (и + комбинирующий бревис),
// без него \p{L} выбрасывает диакритику и «кайырлуу» ученицы не совпадает с эталоном
function normalizeAnswer(s){
  // iOS-автозамена подсовывает латинские близнецы (a,c,e,k,m,o,p,t,x,y) в кириллический
  // ответ — глазами не отличить. Кыргызские ответы латиницы не содержат, близнецов
  // приводим к кириллице; сравнение симметрично, латиница-к-латинице не страдает.
  return (s||"").normalize("NFC").toLowerCase()
    .replace(/[acekmoptxy]/g,(ch)=>({a:"а",c:"с",e:"е",k:"к",m:"м",o:"о",p:"р",t:"т",x:"х",y:"у"})[ch])
    .replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
}
function checkAnswer(card,input){
  const n=normalizeAnswer(input); if(!n) return false;
  if(n===normalizeAnswer(card.ky)) return true;
  return (card.accept||[]).some(a=>n===normalizeAnswer(a));
}

/* ---------- Состояние v2 (localStorage) + модульная тропа ---------- */
// Демо пишет в СВОЙ ключ: pullState/pushState сравнивают updatedAt последней записью,
// и демо-прогресс в общем ключе мог бы затереть/залить прогресс реального аккаунта.
const LS_KEY=IS_DEMO?"kga1-demo-v1":"kga1-state-v2", LS_KEY_V1="kga1-m0-v1";
const ROUTE_KEY=IS_DEMO?"kga1-demo-route":"kga1-route";
const APP_VER="__APP_VERSION__"; // подставляется сервером из package.json при отдаче страницы
