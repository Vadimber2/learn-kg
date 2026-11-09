/* ---------- Общие строительные блоки модульных страниц ----------
   Определены один раз и используются всеми модулями:
   правка здесь меняет вид/поведение сразу во всех модулях. */
function dtr(row){const l=currentLang();return (l==="tr"&&row[3])||(l!=="ru"&&row[2])||row[1];}
// двухколоночная таблица «кыргызский → перевод» для диалогов, стихов и текстов: [[ky,ru,en,tr],...]
function biTable(rows){
  const tb=h("table",{});
  for(const row of rows)tb.append(h("tr",{},h("td",{class:"kgword"},row[0]),h("td",{class:"muted"},dtr(row))));
  return tb;
}
// карточка «Тексты недели» с подзаголовком; титул переопределяем (у М1 — «Текст недели»)
function weekTextsCard(subRu,subEn,titleRu,titleEn,subTr,titleTr){
  return h("div",{class:"card"},
    h("h2",{},L(titleRu||"Тексты недели ",titleEn||"Texts of the week ",titleTr||"Haftanın metinleri "),
      h("span",{class:"muted"},L(subRu,subEn,subTr))));
}
// стандартный хвост модуля: «Тексты недели» + заголовок диалога + таблица + задание.
// Возвращает карточку — модули с текстом-продолжением (М2, М3) дописывают в неё дальше.
function weekDialog(m,h3Ru,h3En,dlg,taskRu,taskEn,h3Tr,taskTr){
  const texts=weekTextsCard("(учебные, черновик до вычитки)","(study drafts until proofread)",null,null,"(ders taslakları, düzeltiden önce)");
  texts.append(h("h3",{},L(h3Ru,h3En,h3Tr)),biTable(dlg),h("div",{class:"note"},L(taskRu,taskEn,taskTr)));
  m.append(texts);
  return texts;
}
// список вариантов ответа (карточки, дриллы, мини-тест): labels — подписи, onPick(i, btn, box) — клик
function optList(labels,onPick){
  const box=h("div",{class:"opts"});
  labels.forEach((lb,i)=>{const b=h("button",{},lb);b.addEventListener("click",()=>onPick(i,b,box));box.append(b);});
  return box;
}
// заблокировать список и подсветить: correctIdx — верный вариант, pickedIdx — выбранный (ошибочный)
function revealOpts(box,correctIdx,pickedIdx){
  box.querySelectorAll("button").forEach((x,xi)=>{
    x.disabled=true;
    if(xi===correctIdx)x.classList.add("correct");
    else if(xi===pickedIdx)x.classList.add("wrong");
  });
}
// ряд-переключатель (настройки: тема, язык): items=[{val,label,ic?}], selected — текущий val
function pickerRow(items,selected,onPick){
  const row=h("div",{class:"opts"});
  for(const it of items){
    const sel=selected===it.val;
    const b=h("button",{class:sel?"correct":"",onclick:()=>onPick(it.val)});
    if(it.ic)b.append(icon(it.ic)," ");
    b.append(it.label);
    if(sel)b.append(h("span",{style:"margin-left:auto"},icon("check",15)));
    row.append(b);
  }
  return row;
}
// поле ввода ответа: стандартные атрибуты + Enter = onSubmit (без автоповтора)
function answerInput(onSubmit,placeholder){
  const input=h("input",{type:"text",autocomplete:"off",autocapitalize:"off",spellcheck:"false",placeholder:placeholder||"Кыргызча жазыңыз…"});
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.repeat)onSubmit();});
  return input;
}
// гармоническая таблица суффиксов: head — шапка, rows — строки;
// ячейка: строка, DOM-узел или [суффикс, пример] (пример — приглушённой строкой под суффиксом)
function harmonyTable(head,rows){
  const tb=h("table",{});
  tb.append(h("tr",{},...head.map(c=>h("th",{},c))));
  for(const r of rows){
    const tr=h("tr",{},h("td",{},r[0]));
    for(const cell of r.slice(1)){
      if(Array.isArray(cell))tr.append(h("td",{},h("span",{class:"kgword"},cell[0]),cell[1]?h("div",{class:"muted"},cell[1]):null));
      else tr.append(h("td",{},cell));
    }
    tb.append(tr);
  }
  return h("div",{class:"tablewrap"},tb);
}

/* ===GRAM-VIDEO=== */
/* Короткие ролики к разделам справочника модуля (решение владельца 29.10.2026):
   ролик стоит в карточке того правила, которое показывает. Реестр — данные:
   ключ «<модуль>.<раздел>» зовёт рендерер модуля (gramVideos("m3.barysh")),
   новый ролик = строка здесь + заливка mp4/jpg на том (/data/video, как у
   видеоуроков). Имена без языкового хвоста -ru/-en/-tr: такие файлы карточка
   «Уроки → Видео» не подхватывает. langs — языки интерфейса, которым ролик
   понятен (закадровый текст по-русски — только ru); у остальных субтитры
   русские, об этом подпись. Файла на томе нет — блок пуст, мёртвого плеера нет.
   Плеер — общий с видеоуроками (videoNode в ===VIDEO-CARD===): preload="none",
   постер, трекинг video.play. */
const GRAM_VIDEOS={
  "m1.pred":{file:"gram-m1-ar-bashka.mp4",
    title:{ru:"«Биз ар башкабыз» — мен узунмун, мен сарымын",en:"“Биз ар башкабыз” — мен узунмун, мен сарымын",tr:"“Биз ар башкабыз” — мен узунмун, мен сарымын"}},
  "m3.barysh":{file:"gram-m3-barysh.mp4",
    title:{ru:"«Тоого барам» — куда? (-га/-го)",en:"“Тоого барам” — where to? (-га/-го)",tr:"“Тоого барам” — nereye? (-га/-го)"}},
  "m3.jatysh":{file:"gram-m3-jatysh.mp4",
    title:{ru:"«Үйдөмүн» — где? (-да/-дө)",en:"“Үйдөмүн” — where? (-да/-дө)",tr:"“Үйдөмүн” — nerede? (-да/-дө)"}},
  "m3.vna":{file:"gram-m3-v-ili-na.mp4",langs:["ru"],
    title:{ru:"«в» или «на»? В кыргызском — один суффикс"}},
  "m4.chygysh":{file:"gram-m4-chygysh.mp4",
    title:{ru:"«Тоодон келдим» — откуда? (-дан/-дон)",en:"“Тоодон келдим” — from where? (-дан/-дон)",tr:"“Тоодон келдим” — nereden? (-дан/-дон)"}}
};
// список роликов тома — один запрос на страницу; сбой и не-200 не кэшируются (офлайн → повтор)
function gramVideoRows(){
  if(!gramVideoRows.p)gramVideoRows.p=fetch("api/video/list").then((r)=>{if(!r.ok)throw new Error(r.status);return r.json();})
    .catch(()=>{gramVideoRows.p=null;return [];});
  return gramVideoRows.p;
}
function gramVideo(key){
  const v=GRAM_VIDEOS[key];
  if(!v||(v.langs&&!v.langs.includes(currentLang())))return null;
  const box=h("div",{class:"gram-video",style:"flex:0 1 300px;min-width:200px;margin-top:12px"});
  box.ready=gramVideoRows().then((rows)=>{
    const row=(rows||[]).find((x)=>x.file===v.file);
    if(!row)return false;
    const vid=videoNode(row,"width:100%;max-width:300px;aspect-ratio:9/16;display:block;background:#000;border-radius:12px");
    // подпись — ПОД роликом: в ряду ролики начинаются на одной высоте, сколько бы строк
    // ни заняла подпись (над роликом длинная подпись сдвигала свой ролик вниз)
    appendKids(box,vid,h("div",{class:"muted",style:"margin-top:6px;font-size:.88rem;line-height:1.35"},L(v.title.ru,v.title.en,v.title.tr)),
      currentLang()==="ru"?null:h("div",{class:"muted",style:"font-size:.78rem;margin-top:2px"},L("","Subtitles in Russian","Altyazılar Rusça")));
    return true;
  });
  return box;
}
/* Несколько роликов одной карточки — рядом в ряд (вертикальные ролики друг под другом
   растягивали карточку на два экрана); на узком экране ряд сам переносится в столбик. */
function gramVideos(...keys){
  const boxes=keys.map(gramVideo).filter(Boolean);
  return boxes.length?h("div",{class:"gram-videos",style:"display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start"},...boxes):null;
}
/* ===/GRAM-VIDEO=== */

/* ---------- Визуализация прогресса: плитки/бары/спарклайн/heatmap/таблица (без библиотек) ---------- */
// Выдвижная панель справа — один экземпляр; закрытие: крестик, бэкдроп, Esc
let SIDEPANEL=null;
function closeSidePanel(){
  if(!SIDEPANEL)return;
  const {bd,p}=SIDEPANEL;SIDEPANEL=null;
  bd.classList.remove("on");p.classList.remove("on");
  setTimeout(()=>{bd.remove();p.remove();},220);
}
function sidePanel(title,build){
  closeSidePanel();
  const bd=h("div",{class:"sp-back"});
  const p=h("div",{class:"sp-panel"});
  p.append(h("div",{class:"sp-head"},h("h2",{style:"margin:0;font-size:1.02rem"},title),
    h("button",{class:"btn ghost",style:"padding:4px 10px",onclick:closeSidePanel},"✕")));
  const body=h("div",{class:"sp-body"});
  build(body);
  p.append(body);
  bd.addEventListener("click",closeSidePanel);
  document.body.append(bd,p);
  requestAnimationFrame(()=>{bd.classList.add("on");p.classList.add("on");});
  SIDEPANEL={bd,p};
}
// Мини-спарклайн: ряд чисел → полилиния (тренд под показателем и в панелях)
function sparkline(vals,w,hh){
  w=w||64;hh=hh||16;
  const max=Math.max(...vals),min=Math.min(...vals);
  const pts=vals.map((v,i)=>((i/(vals.length-1||1))*(w-2)+1)+","+(hh-1-((v-min)/((max-min)||1))*(hh-2)));
  const s=document.createElementNS(SVG_NS,"svg");
  s.setAttribute("width",w);s.setAttribute("height",hh);s.setAttribute("viewBox","0 0 "+w+" "+hh);s.classList.add("spark");
  const p=document.createElementNS(SVG_NS,"polyline");
  p.setAttribute("points",pts.join(" "));
  p.setAttribute("fill","none");p.setAttribute("stroke","currentColor");p.setAttribute("stroke-width","1.5");
  p.setAttribute("stroke-linejoin","round");p.setAttribute("stroke-linecap","round");
  s.append(p);return s;
}
// График успешности: линия с точками и пунктиром порога (история мини-тестов, разбор попытки)
function lineChart(vals,opts){
  opts=opts||{};
  const w=opts.w||300,hh=opts.h||64,max=opts.max||20,thr=opts.threshold;
  const s2=document.createElementNS(SVG_NS,"svg");
  s2.setAttribute("width","100%");s2.setAttribute("height",hh);s2.setAttribute("viewBox","0 0 "+w+" "+hh);
  s2.setAttribute("preserveAspectRatio","none");s2.style.display="block";
  const x=(i)=>vals.length===1?w/2:(i/(vals.length-1))*(w-16)+8;
  const y=(v)=>hh-6-(v/max)*(hh-12);
  if(thr!=null){
    const tl=document.createElementNS(SVG_NS,"line");
    tl.setAttribute("x1",0);tl.setAttribute("x2",w);tl.setAttribute("y1",y(thr));tl.setAttribute("y2",y(thr));
    tl.setAttribute("stroke","var(--warn)");tl.setAttribute("stroke-dasharray","5 4");tl.setAttribute("stroke-width","1");
    s2.append(tl);
  }
  const p=document.createElementNS(SVG_NS,"polyline");
  p.setAttribute("points",vals.map((v,i)=>x(i)+","+y(v)).join(" "));
  p.setAttribute("fill","none");p.setAttribute("stroke","var(--accent)");p.setAttribute("stroke-width","2");
  p.setAttribute("stroke-linejoin","round");p.setAttribute("stroke-linecap","round");
  s2.append(p);
  vals.forEach((v,i)=>{
    const c=document.createElementNS(SVG_NS,"circle");
    c.setAttribute("cx",x(i));c.setAttribute("cy",y(v));c.setAttribute("r","3.5");
    c.setAttribute("fill",thr!=null?(v>=thr?"var(--ok)":"var(--err)"):"var(--accent)");
    s2.append(c);
  });
  return s2;
}
// Тренд-строка под плиткой: спарклайн + дельта к прошлому периоду
function trendEl(series,cur,prev,unit){
  const w=h("span",{class:"trend"});
  if(series&&series.length>=2&&series.some((v)=>v!==series[0]))w.append(sparkline(series)," ");
  if(prev!=null&&cur!=null){
    const df=Math.round(cur-prev);
    if(df)w.append(h("span",{class:df>0?"up":"down"},(df>0?"▲ +":"▼ −")+Math.abs(df)+(unit||"")));
    else w.append("—");
  }
  return w.childNodes.length?w:null;
}
function statTile(value,label,opts){
  opts=opts||{};
  const b=h("b",{style:opts.tone?("color:var(--"+opts.tone+")"):""});
  if(opts.icon)b.append(icon(opts.icon,16)," ");
  b.append(String(value));
  const kids=[b];
  if(label)kids.push(h("span",{},label));
  if(opts.sub)kids.push(h("span",{class:"muted",style:"display:block;font-size:.72rem;margin-top:2px"},opts.sub));
  if(opts.trend)kids.push(opts.trend);
  const tile=h("div",{class:"stat"+(opts.big?" big":"")+(opts.onclick?" stat-click":""),title:opts.hint||""},...kids);
  if(opts.onclick)tile.addEventListener("click",opts.onclick);
  return tile;
}
function statRow(...tiles){return h("div",{class:"statrow"},...tiles);}
// одна полоса прогресса; opts.label сверху, opts.text — подпись справа под полосой
function bar(pct,opts){
  opts=opts||{};
  const p=Math.max(0,Math.min(100,Math.round(pct)));
  const track=h("div",{class:"progressbar"},
    h("div",{style:"width:"+p+"%"+(opts.tone?";background:var(--"+opts.tone+")":"")}));
  if(!opts.label&&!opts.text)return track;
  return h("div",{},
    opts.label?h("div",{class:"muted",style:"font-size:.78rem;margin-bottom:2px"},opts.label):null,
    track,
    opts.text?h("div",{class:"muted",style:"font-size:.78rem;text-align:right"},opts.text):null);
}
// Уровни интенсивности для heatmap: терции по ненулевым дням + отдельный максимум (5 уровней 0..4).
function heatLevels(days){
  const vals=Object.values(days).filter((n)=>n>0);
  if(!vals.length)return {};
  const sorted=[...vals].sort((a,b)=>a-b);
  const q1=sorted[Math.floor(sorted.length*0.33)],q2=sorted[Math.floor(sorted.length*0.66)];
  const maxN=sorted[sorted.length-1];
  const out={};
  for(const [k,n] of Object.entries(days)){
    if(!n){out[k]=0;continue;}
    out[k]=n>=maxN?4:n<=q1?1:n<=q2?2:3;
  }
  return out;
}
// Heatmap — сетка div, не SVG: нативные title-тултипы, нормальные тач-таргеты, без пересчёта координат.
function heatmap(days,opts){
  opts=opts||{};
  const weeks=opts.weeks||26;
  const levels=heatLevels(days);
  // Последняя ячейка сетки — ВСЕГДА сегодня (иначе «сделал ли я сегодня упражнения» не видно
  // с первого взгляда): сперва берём ровно weeks недель, кончающихся сегодня, потом ДОБАВЛЯЕМ
  // дней спереди для выравнивания начала на понедельник — не обрезаем хвост, а расширяем голову.
  const end=new Date();
  const endU=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()));
  const start=new Date(endU);start.setUTCDate(start.getUTCDate()-weeks*7+1);
  start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  const totalDays=Math.round((endU-start)/86400000)+1;
  const grid=h("div",{class:"hm"});
  let active=0;
  for(let i=0;i<totalDays;i++){
    const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);
    const key=d.toISOString().slice(0,10);
    const lvl=levels[key]||0;
    if(lvl)active++;
    grid.append(h("div",{class:"hm-c"+(lvl?" l"+lvl:""),title:key+(days[key]?": "+days[key]:""),"aria-hidden":"true"}));
  }
  const wrap=h("div",{class:"hm-wrap",role:"img","aria-label":opts.aria||""},grid);
  setTimeout(()=>{wrap.scrollLeft=wrap.scrollWidth;},0); // последние недели видны сразу
  return {wrap,active};
}
// Ряд чипов-фильтров — переиспользует .rev-filters (та же вкладка «Вычитка»), а не .opts:
// .opts в файле разрешён ui-generic.test.js только внутри optList/pickerRow.
function chipRow(items,activeVal,onPick){
  const row=h("div",{class:"rev-filters"});
  for(const it of items)row.append(h("button",{class:"btn "+(activeVal===it.val?"":"ghost"),onclick:()=>onPick(it.val)},it.label));
  return row;
}
// cols:[{key,label,cls,cell(r),val(r)}] — val задаёт колонку сортируемой
function sortableTable(cols,rows,state){
  state=state||{};
  const thead=h("tr",{});
  for(const c of cols){
    const active=state.sort===c.key;
    const th=h("th",{class:c.cls||""});
    if(c.val){
      th.setAttribute("aria-sort",active?(state.dir==="desc"?"descending":"ascending"):"none");
      th.append(h("button",{class:"btn ghost",style:"padding:2px 6px",onclick:()=>{
        state.onSort&&state.onSort(c.key,active&&state.dir==="asc"?"desc":"asc");
      }},c.label+(active?(state.dir==="desc"?" ▾":" ▴"):"")));
    }else th.append(c.label);
    thead.append(th);
  }
  const tb=h("table",{},thead);
  for(const r of rows){
    const tr=h("tr",{});
    for(const c of cols)tr.append(h("td",{class:c.cls||""},c.cell(r)));
    tb.append(tr);
  }
  return h("div",{class:"tablewrap"},tb);
}
function emptyState(iconName,title,text,actionBtn){
  return h("div",{class:"card",style:"text-align:center;padding:28px 20px"},
    h("div",{style:"opacity:.5;margin-bottom:8px"},icon(iconName,28)),
    h("div",{style:"font-weight:600;margin-bottom:4px"},title),
    text?h("div",{class:"muted"},text):null,
    actionBtn?h("div",{style:"margin-top:12px"},actionBtn):null);
}
// Ленивый индекс id→карточка по ВСЕМ модулям (не только активному VOCAB) — нужен ленте
// ответов и разбору слабых слов, где карточка может быть из любого модуля.
let CARD_INDEX=null;
// Подпись слабого места из мини-теста: id карточки → слово, служебные h_* → тип задания
function weakLabel(id){
  const c=cardById(id);
  if(c)return c.ky;
  if(id==="h_row")return t("weak_h_row");
  if(id==="h_affix")return t("weak_h_affix");
  return id;
}
function cardById(id){
  if(!CARD_INDEX){
    CARD_INDEX=new Map();
    for(const mid of Object.keys(CONTENT))
      for(const c of resolveVocab(CONTENT[mid].vocab,CONTENT))
        if(!CARD_INDEX.has(c.id))CARD_INDEX.set(c.id,c);
  }
  return CARD_INDEX.get(id);
}
