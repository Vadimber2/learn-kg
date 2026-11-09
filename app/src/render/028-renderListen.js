/* ===STT=== Аудирование (эксперимент): слушай фразу — повтори вслух — сверка.
   Логика сверки и очереди — здесь, в маркер-блоке (vm-тестируется без DOM;
   sttSend — сеть без DOM, тестируется подменой fetch); микрофон — ниже, в рендере.
   Механика мировой практики (shadowing): текст фразы скрыт до ответа,
   распознанная речь сверяется пословно. */
// нормализация для сверки: регистр, пунктуация, ё→е (Scribe пишет литературно)
function sttNorm(s){return String(s||"").toLowerCase().replace(/ё/g,"е")
  .replace(/[^a-zа-яөүң\s-]/gi," ").replace(/\s+/g," ").trim();}
// Пословная сверка по LCS: слова эталона помечаются ok, если стоят в распознанном
// в том же порядке. Итог — доля совпавших слов эталона.
function sttCompare(refText,hypText){
  const ref=sttNorm(refText).split(" ").filter(Boolean);
  const hyp=sttNorm(hypText).split(" ").filter(Boolean);
  const n=ref.length,m=hyp.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    dp[i][j]=ref[i]===hyp[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const ok=new Array(n).fill(false);
  let i=0,j=0;
  while(i<n&&j<m){
    if(ref[i]===hyp[j]){ok[i]=true;i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;
  }
  const hit=ok.filter(Boolean).length;
  return {words:ref.map((w,k)=>({w,ok:ok[k]})),score:n?hit/n:0};
}
// Простая подсказка «на что обратить внимание»: несовпавшие слова эталона и особые
// звуки в них (тем же списком, что урок произношения) — без лингвистической ботвы.
function sttAdvice(cmp){
  const missed=cmp.words.filter(w=>!w.ok).map(w=>w.w);
  const SOUNDS=[["ө","ө"],["ү","ү"],["ң","ң"],["ж","ж = дж"],["ы","ы"]];
  const sounds=[];
  for(const [ch,label] of SOUNDS)if(missed.some(w=>w.includes(ch)))sounds.push(label);
  return {missed,sounds};
}
/* Отправка записи на распознавание — общее ядро вкладки аудирования и кнопки на
   карточке: POST api/stt/m0 (лимит дня один на всё) → сверка sttCompare → событие
   stt.result в журнал (ученику и учителю; track.block говорит, где занимались) +
   личный прогресс ST.stt (best/попытки). Дневной лимит (429) — {limited:true},
   прочие отказы — исключение с текстом сервера. */
/* Сетевое плечо распознавания — отдельно: экзамен (Сүйлөө) шлёт ту же запись
   на транскрипцию, но без карточного скоринга и событий stt.result. */
async function sttRecognize(blob){
  const r=await fetch("api/stt/m0",{method:"POST",headers:{"Content-Type":blob.type||"audio/webm"},body:blob});
  const d=await r.json().catch(()=>({}));
  if(r.status===429)return {limited:true,used:d.used,limit:d.limit};
  if(!r.ok)throw new Error(d.error||"ошибка");
  return d;
}
async function sttSend(c,blob,track){
  const d=await sttRecognize(blob);
  if(d.limited)return d;
  const cmp=sttCompare(c.ky,d.text||"");
  EV.stt=(EV.stt||0)+1;
  try{evPush("stt.result",Object.assign({id:c.id,ky:c.ky,mod:homeOf(c.id),score:Math.round(cmp.score*100)},track||{}));}catch(e){}
  ST.stt=ST.stt||{};
  const rec=ST.stt[c.id]||{best:0,n:0};
  rec.n++;rec.best=Math.max(rec.best,Math.round(cmp.score*100));
  ST.stt[c.id]=rec;try{save();}catch(e){}
  return {cmp,said:d.text||"",used:d.used,limit:d.limit};
}
// Видимая строка балла (вкладка и карточки): процент попытки, и лучший по фразе —
// только если он выше (равный дублировал бы цифру). best берётся из ST.stt уже
// с учётом текущей попытки.
function sttScoreText(score,best){
  const p=Math.round(score*100);
  return tf("stt_score",{p})+(best>p?" · "+tf("stt_best",{b:best}):"");
}
// общий пул упражнений: не-alias с текстом и озвучкой (alias тренируется донором)
function sttPool(vocab,hasAudio){return vocab.filter(c=>!c.ref&&c.ky&&hasAudio(c.id));}
/* Очередь дня — по науке listen-and-repeat:
   - elicited imitation (Yan et al. 2016, Language Testing — мета-анализ, r=0.66 с
     устной компетенцией): услышал → повторил вслух → пословная оценка;
   - shadowing улучшает фонемное восприятие и сильнее всего помогает начинающим
     (Hamada 2016, Language Teaching Research) — m0 и есть старт курса;
   - retrieval practice: сперва фразы, у которых подошёл срок SRS-повторения, —
     устное воспроизведение тоже акт извлечения;
   - прогрессия нагрузки: внутри группы от коротких фраз к длинным (рабочая память
     на имитации ограничена, EI-протоколы ранжируют стимулы по длине).
   Порядок стабилен внутри дня (лимит дневной — и набор дневной). */
function sttQueue(vocab,hasAudio,dayKey,isDue){
  const pool=sttPool(vocab,hasAudio);
  let seed=0;for(const ch of String(dayKey))seed=(seed*31+ch.charCodeAt(0))>>>0;
  const rnd=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296;};
  const jitter=new Map(pool.map(c=>[c.id,rnd()])); // стабильный внутри дня разброс между равными
  const len=(c)=>sttNorm(c.ky).split(" ").length;
  const due=isDue?pool.filter(c=>isDue(c.id)):[];
  const rest=pool.filter(c=>!due.includes(c));
  const byLoad=(a,b)=>(len(a)-len(b))||(jitter.get(a.id)-jitter.get(b.id));
  return due.slice().sort(byLoad).concat(rest.slice().sort(byLoad));
}
// Примеры для дрилла: фразы пула с этой подстрокой, короткие первыми (та же
// прогрессия нагрузки, что в очереди дня). chars — подстроки («е» и «э» — один
// звук, долгий гласный — сдвоенная буква, вопросительная частица — со знаком
// вопроса); skip — точные фразы-исключения: подстрока окончания «сиз» есть и в
// самом местоимении «сиз», а оно короче всех и вытеснило бы примеры окончания.
// Пул растёт сам с модулями варианта.
function sttDrillWords(vocab,hasAudio,chars,n,skip){
  const low=chars.map(c=>String(c).toLowerCase());
  const out=new Set((skip||[]).map(s=>String(s).toLowerCase()));
  return sttPool(vocab,hasAudio)
    .filter(c=>!out.has(String(c.ky).toLowerCase())&&low.some(ch=>String(c.ky).toLowerCase().includes(ch)))
    .sort((a,b)=>(String(a.ky).length-String(b.ky).length)||String(a.ky).localeCompare(String(b.ky)))
    .slice(0,n);
}
// Разбивка текста на сегменты для подсветки тренируемого куска: длинные подстроки
// первыми, иначе «а» съела бы половину «аа». Подстроки экранируются: «би?» из
// реестра иначе стал бы регуляркой «б» с необязательным «и» и подсветил бы одну «б».
function sttHl(text,chars){
  const cs=chars.map(c=>String(c).toLowerCase()).sort((a,b)=>b.length-a.length);
  if(!cs.length)return [{s:String(text),hit:false}];
  const re=new RegExp("("+cs.map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")","gi");
  return String(text).split(re).filter(s=>s!=="").map(s=>({s,hit:cs.includes(s.toLowerCase())}));
}
// Ограничения записи: выбранный микрофон (deviceId) либо системный по умолчанию.
// exact не ставим: выдернутый USB-микрофон валил бы запись вместо тихого фолбэка.
// Возврат несданной фразы: провал (меньше половины слов) ставит её в хвост очереди
// дня — ученик вернётся к ней сегодня же; «Позже» делает то же руками.
function sttShouldRetry(score){return score<0.5;}
// выбор устройства общий на все записи (вкладка аудирования И экзамен): локальный
// S.micId чужому рендеру не виден — экзамен всегда писал бы с системного микрофона
let sttMic=null;
function sttConstraints(deviceId){
  return {audio:deviceId?{deviceId:{ideal:deviceId}}:true};
}
// Текст об ошибке доступа — по причине и режиму запуска: в установленном приложении
// (PWA) разрешение живёт отдельно от вкладки браузера, и совет «нажмите замок в
// адресной строке» человеку в PWA не помогает — адресной строки у него нет.
function sttPermKey(err,standalone){
  const name=(err&&err.name)||"";
  if(name==="NotAllowedError"||name==="SecurityError")
    return standalone?"stt_mic_denied_pwa":"stt_mic_denied";
  if(name==="NotFoundError"||name==="OverconstrainedError")return "stt_mic_none";
  return "stt_mic_err";
}
/* Хоткеи — конвенция тренажёров с озвучкой (Anki: Space — главное действие,
   R — переслушать): Пробел — говорить/стоп, любой модификатор+Пробел — слушать,
   → — дальше. По физическому коду клавиши (layout-независимо); поля ввода не
   перехватываются. preventDefault обязателен: голый Пробел скроллит страницу. */
function sttHotkey(ev){
  const tag=String((ev&&ev.target&&ev.target.tagName)||"").toUpperCase();
  if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA")return null;
  if(ev.code==="Space")return (ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey)?"listen":"rec";
  if(ev.code==="ArrowRight")return "next";
  return null;
}
/* ===/STT=== */

/* Кнопка «повтори за диктором» на карточке узнавания: запись с системного
   микрофона (потолок 7 с) → распознавание тем же дневным лимитом, что вкладка
   «Аудирование» (общее ядро sttSend) → пословная сверка под карточкой.
   null (кнопки нет): в демо, без включённой опции (в т.ч. триал) и у слова без
   озвучки — повторять не за кем. Строгий протокол «сначала послушай» живёт на
   вкладке аудирования; на карточке слово видно и диктор в одном тапе (▶ рядом),
   лишний гейт мешал бы. Смена карточки во время распознавания глушится по
   isConnected: запись доигрывает до стопа, но попытка не тратится и в чужую
   карточку ничего не рисуется. */
function sttCardBtn(c){
  const demo=typeof IS_DEMO!=="undefined"&&IS_DEMO;
  const stt=(ME&&ME.stt)||(isTeacher()?{enabled:true}:null);
  if(demo||!stt||!stt.enabled||!AUDIO.has(c.id))return null;
  const out=h("div",{});
  const btn=h("button",{class:"btn ghost",style:"padding:2px 8px",title:t("stt_card_hint")});
  const idle=()=>{btn.textContent="";btn.append(icon("mic",13)," "+t("stt_rec"));};
  let rec=null,timer=null,busy=false;
  const stop=()=>{if(rec&&rec.state!=="inactive")rec.stop();};
  btn.addEventListener("click",async()=>{
    if(rec&&rec.state==="recording"){stop();return;}
    if(busy)return; // защёлка: пока идёт захват микрофона или распознавание, вторую запись не плодим
    busy=true;
    if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){clear(out).append(h("p",{class:"muted"},t("stt_mic_https")));busy=false;return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia(sttConstraints(null));
      const chunks=[];
      rec=new MediaRecorder(stream);
      rec.ondataavailable=(e)=>{if(e.data&&e.data.size)chunks.push(e.data);};
      rec.onstop=async()=>{
        try{
          clearTimeout(timer);
          stream.getTracks().forEach(tr=>tr.stop());
          idle();
          const blob=new Blob(chunks,{type:(rec&&rec.mimeType)||"audio/webm"});
          rec=null;
          if(!blob.size||!out.isConnected)return; // карточка сменилась — попытку не тратим
          clear(out).append(h("p",{class:"muted"},t("stt_sending")));
          const d=await sttSend(c,blob,{block:"card"});
          if(!out.isConnected)return;
          if(d.limited){clear(out).append(h("p",{class:"muted"},t("stt_limit_p")));return;}
          const line=h("p",{class:"ky",style:"margin:4px 0 0"});
          d.cmp.words.forEach((w,i)=>line.append(h("span",{style:"color:"+(w.ok?"var(--ok)":"var(--err)")},(i?" ":"")+w.w)));
          clear(out).append(line,h("p",{class:"muted",style:"margin:2px 0 0"},
            t("stt_said")+" "+(d.said||"—")+" · "+(d.cmp.score>=0.99?t("stt_great"):d.cmp.score>=0.5?t("stt_close"):t("stt_try"))),
            h("p",{class:"muted",style:"margin:2px 0 0"},sttScoreText(d.cmp.score,((ST.stt||{})[c.id]||{best:0}).best)));
        }catch(e){if(out.isConnected)clear(out).append(h("p",{class:"muted"},"⚠ "+e.message));}
        finally{busy=false;updateHold("rec",false);}
      };
      rec.start();
      updateHold("rec",true);   // запись и распознавание идут — самообновление вкладки ждёт
      btn.textContent="";btn.append(icon("pause",13)," "+t("stt_stop"));
      timer=setTimeout(stop,7000); // тот же потолок, что на вкладке: фразы курса короткие
    }catch(e){
      busy=false;
      const standalone=(typeof matchMedia!=="undefined"&&matchMedia("(display-mode: standalone)").matches)||!!navigator.standalone;
      clear(out).append(h("p",{class:"muted"},t(sttPermKey(e,standalone))));
    }
  });
  idle();
  return h("div",{class:"stt-card",style:"margin-top:10px"},btn,out);
}

function renderListen(m){
  const box=h("div",{});
  m.append(box);
  // blob-URL последней записи прошлого визита освобождается при новом входе и при
  // самоотцепе слушателя клавиш — иначе запись висела бы в памяти до перезагрузки
  const freeLast=()=>{if(renderListen._lastUrl){try{URL.revokeObjectURL(renderListen._lastUrl);}catch(e){}renderListen._lastUrl=null;}};
  freeLast();
  const S={block:"phrases",idx:0,b:{},busy:false,revealed:null,rec:null,chunks:[],micId:sttMic};
  const stt=(ME&&ME.stt)||(isTeacher()?{enabled:true,used:0,limit:20}:{enabled:false,why:"off",used:0,limit:20});
  const card=(kids)=>h("div",{class:"card"},...kids);
  const dash=()=>card([h("p",{class:"muted"},"—")]);
  const head=()=>h("h2",{},icon("mic")," "+t("tab_listen")+" ",
    h("span",{class:"chip warn",style:"vertical-align:middle"},t("stt_exp")));

  // Заперто (демо / триал / опция не включена) — тизер-магнит: сзади настоящая
  // карточка упражнения под блюром, поверх — «Запросить у Алтынай» (решение владельца).
  const demo=typeof IS_DEMO!=="undefined"&&IS_DEMO;
  if(demo||!stt.enabled){
    const why=demo?"demo":(stt.why||"off");
    const fake=h("div",{class:"card stt-fake","aria-hidden":"true"},
      h("div",{class:"lesson-row"},
        h("button",{class:"btn"},icon("play",15)," "+t("stt_listen")),
        h("button",{class:"btn primary"},icon("mic",15)," "+t("stt_rec")),
        h("span",{class:"muted",style:"margin-left:auto"},tf("stt_left",{n:20}))),
      h("p",{class:"ky",style:"font-size:1.15rem"},
        h("span",{style:"color:var(--ok)"},"Салам! "),
        h("span",{style:"color:var(--ok)"},"Менин "),
        h("span",{style:"color:var(--ok)"},"атым "),
        h("span",{style:"color:var(--err)"},"…")),
      h("p",{},t("stt_close")));
    const over=h("div",{class:"stt-over"},
      h("h3",{},t(why==="trial"?"stt_trial_h":why==="demo"?"stt_demo_h":"stt_off_h")),
      h("p",{class:"muted",style:"max-width:420px"},t(why==="trial"?"stt_trial_p":why==="demo"?"stt_demo_p":"stt_off_p")),
      h("a",{class:"btn primary",target:"_blank",rel:"noopener noreferrer",
        href:"https://wa.me/996505854856?text="+encodeURIComponent(t("stt_wa_text"))},t("stt_ask")));
    box.append(card([head(),h("p",{class:"muted"},tf("stt_intro",{n:20}))]),
      h("div",{class:"stt-teaser"},fake,over));
    return;
  }

  const hasAudio=(id)=>AUDIO.has(id);
  // приоритет — фразам с подошедшим сроком SRS: повтор вслух — тоже извлечение
  const isDue=(id)=>{try{const st=recOf(id);return !!st&&st.due<=Date.now();}catch(e){return false;}};
  const queue=sttQueue(VOCAB,hasAudio,dayKeyOf(new Date().toISOString()),isDue);
  if(!queue.length){box.append(card([head(),h("p",{class:"muted"},"—")]));return;}
  // limit=null — безлимит (преподаватель/админ)
  let left=stt.limit==null?Infinity:Math.max(0,stt.limit-(stt.used||0));
  const mastOf=(id)=>{const r=ST.stt&&ST.stt[id];return !!r&&r.best>=99;};

  const body=h("div",{});
  const mastered=Object.keys((ST&&ST.stt)||{}).filter(mastOf).length;
  box.append(card([head(),h("p",{class:"muted"},tf("stt_intro",{n:stt.limit==null?"∞":stt.limit})),
    mastered?h("p",{class:"muted",style:"font-size:.8rem"},tf("stt_mastered_n",{n:mastered})):null]),body);

  // реестр блоков — данные (data/stt-blocks.js); typeof-гейт держит рендер живым
  // в vm-срезах тестов запертых состояний, где файла данных нет. Блок с полем mods
  // виден только своим модулям: окончания сказуемости — грамматика M1, в алфавитном
  // m0 такой чип был бы дриллом ненайденного (в его словаре этих форм нет)
  const mod=typeof activeModule!=="undefined"?activeModule:"m0";
  const blocks=(typeof STT_BLOCKS!=="undefined"?STT_BLOCKS:[{id:"phrases",kind:"queue"}])
    .filter(b=>!b.mods||b.mods.indexOf(mod)>=0);
  // Смена упражнения гасит микрофон сразу, а запись выбрасывает: раньше она писалась до 7 с,
  // уходила в платное распознавание и показывала чужой результат на новой фразе (ревью 25.09.2026)
  const resetEx=()=>{S.revealed=null;S.saidText="";S.listened=false;
    if(S.rec&&S.rec.state==="recording"){S.rec.dropped=true;S.rec.stop();}};
  // ряд кнопок-чипов (переключатель блоков, звуки, слова) — один строитель
  const btnRow=(items,extra)=>{
    const row=h("div",{class:"lesson-row"+(extra?" "+extra:"")});
    for(const it of items)row.append(h("button",{class:"btn"+(it.active?" active":""),onclick:it.on},it.label));
    return row;
  };

  // Действия текущего упражнения: их дёргают и кнопки, и хоткеи; render() обнуляет —
  // на экране без упражнения (лимит, пустой звук) клавиши мертвы, а не бьют по старой
  // карточке. Слушатель один на документ (прошлый abort'ится), сам отцепляется,
  // когда вкладка ушла из DOM.
  const cur={};
  if(typeof document!=="undefined"){
    if(renderListen._ac)renderListen._ac.abort();
    const ac=renderListen._ac=new AbortController();
    document.addEventListener("keydown",(ev)=>{
      if(!box.isConnected){ac.abort();freeLast();return;}
      const a=sttHotkey(ev);
      if(!a||!cur[a])return;
      ev.preventDefault();cur[a]();
    },{signal:ac.signal});
  }

  /* Общее упражнение слушай-повтори — им пользуются все блоки. Эргономика: три
     фиксированных слота (Слушать · Говорить · Дальше/Позже) — кнопки не прыгают,
     primary всегда на следующем ожидаемом действии. opts: hl — показать текст
     сразу с подсветкой этих подстрок (дрилл звука: важна связь буква—звук),
     onNext/onLater (по наличию onLater третий слот — «Позже», иначе «Дальше»),
     onFail — провал сверки, track — доп. поля события stt.result. */
  const exercise=(c,opts)=>{
    const msg=h("p",{class:"muted",style:"min-height:1.2em"});
    const resultView=()=>{
      const cmp=S.revealed;
      const out=h("div",{});
      const line=h("p",{class:"ky",style:"font-size:1.15rem"});
      cmp.words.forEach((w,i)=>{line.append(h("span",{style:"color:"+(w.ok?"var(--ok)":"var(--err)")},(i?" ":"")+w.w));});
      out.append(h("p",{class:"muted",style:"margin-bottom:2px"},t("stt_target")),line,
        h("p",{class:"muted"},t("stt_said")+" "+(S.saidText||"—")),
        h("p",{class:"muted"},sttScoreText(cmp.score,((ST.stt||{})[c.id]||{best:0}).best)),
        h("p",{},cmp.score>=0.99?t("stt_great"):cmp.score>=0.5?t("stt_close"):t("stt_try")));
      // «на что обратить внимание»: несовпавшие слова + особые звуки в них
      const adv=sttAdvice(cmp);
      if(adv.missed.length&&cmp.score<0.99){
        out.append(h("p",{class:"muted"},t("stt_focus")+" ",h("b",{class:"ky"},adv.missed.join(", "))));
        if(adv.sounds.length)out.append(h("p",{class:"muted"},t("stt_sounds")+" "+adv.sounds.join(" · ")+" — ",
          h("a",{href:"#",onclick:(ev)=>{ev.preventDefault();go("lessons");}},t("tab_lessons"))));
      }
      return out;
    };
    // выбор микрофона: селект появляется, когда браузер открыл имена устройств и их >1
    const micRow=()=>{
      const sel=h("select",{class:"btn ghost",style:"padding:4px 8px;max-width:100%"});
      sel.append(h("option",{value:""},t("stt_mic_default")));
      for(const d of S.mics)sel.append(h("option",{value:d.deviceId},d.label||t("stt_mic_default")));
      sel.value=S.micId||"";
      sel.addEventListener("change",()=>{S.micId=sel.value||null;sttMic=S.micId;});
      return h("p",{class:"muted",style:"font-size:.8rem"},t("stt_mic_pick")+" ",sel);
    };
    // протокол elicited imitation: имитация — после предъявления; запись открывается
    // только когда фраза прослушана хотя бы раз
    const canRec=!!S.listened;
    // атрибуты собираются условно: h() пишет undefined строкой, и кнопка получала
    // disabled="undefined" — заперта навсегда, с тултипом «undefined» (поймал владелец)
    const recAttrs={class:"btn "+(canRec&&!S.revealed?"primary":"")};
    if(!canRec){recAttrs.disabled="disabled";recAttrs.title=t("stt_listen_first");}
    const recBtn=h("button",recAttrs,icon("mic",15)," "+t("stt_rec"));
    const stopRec=()=>{if(S.rec&&S.rec.state!=="inactive")S.rec.stop();};
    const recClick=async()=>{
      if(S.busy||!S.listened)return;
      if(S.rec&&S.rec.state==="recording"){stopRec();return;}
      if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){msg.textContent=t("stt_mic_https");return;}
      try{
        const stream=await navigator.mediaDevices.getUserMedia(sttConstraints(S.micId));
        // после первого разрешения браузер открывает имена устройств — обновляем селект
        if(!S.mics){try{
          const devs=await navigator.mediaDevices.enumerateDevices();
          S.mics=devs.filter(d=>d.kind==="audioinput"&&d.deviceId&&d.deviceId!=="default");
        }catch(e){S.mics=[];}}
        S.chunks=[];
        const rec=S.rec=new MediaRecorder(stream);
        rec.ondataavailable=(e)=>{if(e.data&&e.data.size)S.chunks.push(e.data);};
        rec.onstop=async()=>{try{
          clearTimeout(S.recTimer); // иначе таймер прошлой записи оборвал бы новую
          stream.getTracks().forEach(tr=>tr.stop());
          recBtn.textContent="";recBtn.append(icon("mic",15)," "+t("stt_rec"));
          const blob=new Blob(S.chunks,{type:rec.mimeType||"audio/webm"});
          // брошенная сменой упражнения или уходом с вкладки (кнопки уже нет в документе) — попытку не тратим
          if(!blob.size||rec.dropped||!recBtn.isConnected)return;
          // последняя запись хранится для прослушки: слышать себя рядом с эталоном —
          // часть петли обратной связи; живёт в памяти вкладки, повторно не отправляется
          freeLast();
          S.lastUrl=renderListen._lastUrl=URL.createObjectURL(blob);
          S.busy=true;msg.textContent=t("stt_sending");
          try{
            // общее ядро sttSend: распознавание, сверка, трекинг и прогресс ST.stt
            const d=await sttSend(c,blob,Object.assign({block:S.block},opts.track||{}));
            if(d.limited){left=0;render();return;}
            left=d.limit==null?Infinity:Math.max(0,d.limit-(d.used||0));
            S.saidText=d.said;
            S.revealed=d.cmp;
            if(sttShouldRetry(d.cmp.score)&&opts.onFail)opts.onFail();
            render();
          }catch(e){msg.textContent="⚠ "+e.message;}
          S.busy=false;
        }finally{updateHold("rec",false);}};   // ранние выходы (пустая запись, лимит) тоже отпускают
        rec.start();
        updateHold("rec",true);   // запись и распознавание идут — самообновление вкладки ждёт
        recBtn.textContent="";recBtn.append(icon("pause",15)," "+t("stt_stop"));
        S.recTimer=setTimeout(stopRec,7000); // фразы курса короткие: 7 с потолок записи
      }catch(e){
        const standalone=(typeof matchMedia!=="undefined"&&matchMedia("(display-mode: standalone)").matches)||!!navigator.standalone;
        msg.textContent=t(sttPermKey(e,standalone));
      }
    };
    recBtn.addEventListener("click",recClick);
    const listen=()=>{playAudio(c.id);if(!S.listened){S.listened=true;render();}};
    // primary ведёт по шагам: Слушать → Говорить → Дальше
    const listenBtn=h("button",{class:"btn"+(S.listened?"":" primary"),onclick:listen},icon("play",15)," "+t("stt_listen"));
    // третий слот — одно решение и для кнопки, и для хоткея «дальше»; пустой span
    // держит сетку: «продолжить» живёт в одном месте и не заставляет искать кнопку
    let act=null;
    if(S.revealed&&opts.onNext)act={fn:opts.onNext,cls:"btn primary",label:t("stt_next")+" ▶"};
    else if(!S.revealed&&canRec&&opts.onLater)act={fn:opts.onLater,cls:"btn ghost",label:t("stt_later"),title:t("stt_later_hint")};
    else if(!S.revealed&&!opts.onLater&&opts.onNext)act={fn:opts.onNext,cls:"btn ghost",label:t("stt_next")+" ▶"};
    let third=h("span",{});
    if(act){
      const a={class:act.cls,onclick:act.fn};
      if(act.title)a.title=act.title;
      third=h("button",a,act.label);
    }
    cur.listen=listen;
    cur.rec=recClick;
    cur.next=act&&act.fn;
    // показанный текст дрилла: тренируемый звук подсвечен
    let shown=null;
    if(opts.hl&&!S.revealed){
      shown=h("p",{class:"ky",style:"font-size:1.3rem;margin:2px 0 6px"});
      for(const seg of sttHl(c.ky,opts.hl))shown.append(seg.hit?h("b",{style:"color:var(--accent)"},seg.s):seg.s);
    }
    const kbd=(s)=>h("kbd",{},s);
    return card([
      shown,
      h("div",{class:"stt-actions"},listenBtn,recBtn,third),
      mastOf(c.id)?h("p",{class:"muted",style:"font-size:.8rem"},"✓ "+t("stt_mastered")):null,
      // до первого разрешения — подсказать, что браузер спросит доступ (в PWA — отдельно)
      S.mics==null?h("p",{class:"muted",style:"font-size:.8rem"},t("stt_mic_ask")):null,
      (S.mics&&S.mics.length>1)?micRow():null,
      h("div",{class:"lesson-row",style:"margin-top:2px"},
        S.lastUrl?h("button",{class:"btn ghost",title:t("stt_self_hint"),onclick:()=>{try{new Audio(S.lastUrl).play();}catch(e){}}},"🔁 "+t("stt_self")):null,
        left===Infinity?null:h("span",{class:"muted",style:"font-size:.8rem;margin-left:auto"},tf("stt_left",{n:left}))),
      h("p",{class:"stt-keys"},kbd(t("stt_key_space"))," — "+t("stt_rec")+" · ",
        kbd("Shift+"+t("stt_key_space"))," — "+t("stt_listen")+" · ",kbd("→")," — "+t("stt_next")),
      msg,S.revealed?resultView():null]);
  };

  // блок «Фразы дня»: SRS-очередь, провал и «Позже» возвращают фразу в хвост дня
  const renderPhrases=(el)=>{
    const full=queue.concat(S.requeue||[]);
    const c=full[S.idx%full.length];
    const requeue=()=>{S.requeue=(S.requeue||[]).concat([c]);};
    const onNext=()=>{resetEx();S.idx++;render();};
    el.append(exercise(c,{onNext,onLater:()=>{requeue();onNext();},onFail:requeue}));
  };

  // блок направленного дрилла (kind "sounds"): чипы → описание, как произносить →
  // фразы-примеры с подсветкой; текст открыт — тут тренируется связь письма и речи.
  // Всё специфичное — в данных записи (m/m2/hint/not/label/track и подписи блока),
  // состояние своё у каждого блока
  const renderSounds=(el,blk)=>{
    const items=blk.items||[];
    if(!items.length){el.append(dash());return;}
    const st=S.b[blk.id]||(S.b[blk.id]={sel:0,idx:0});
    const sel=items[st.sel];
    const chips=btnRow(items.map((it,i)=>({label:it.ch,active:i===st.sel,
      on:()=>{st.sel=i;st.idx=0;resetEx();render();}})));
    const words=sttDrillWords(VOCAB,hasAudio,sel.m,4,sel.not);
    const seen=new Set(words.map(c=>c.id));
    const extra=sel.m2?sttDrillWords(VOCAB,hasAudio,sel.m2,3,sel.not).filter(c=>!seen.has(c.id)):[];
    const all=words.concat(extra);
    // тема урока, где это объяснено с источниками (поле track записи) — ссылка
    // ведёт на вкладку уроков модуля; нет урока или темы — строки просто нет
    const thm=sel.track&&(((typeof LESSONS!=="undefined"&&LESSONS[activeModule]||{}).themes||[])
      .find(x=>x.id===sel.track));
    // сам звук буквы отдельной дорожкой (поля snd/snd2 записи): слово с этим звуком
    // даёт контекст, но не даёт услышать звук чисто — а его-то ученик и подменяет
    // привычным из своего языка. Есть только там, где дорожка озвучена (AUDIO).
    const sndBtns=[[sel.snd,sel.ch],[sel.snd2,sel.m2&&sel.m2[0]]]
      .filter(([id,lab])=>id&&lab&&hasAudio(id))
      .map(([id,lab])=>({label:"▶ "+lab,on:()=>playAudio(id)}));
    el.append(h("p",{class:"muted"},t(blk.intro||"stt_v_intro")),chips,card([
      h("h3",{class:"ky",style:"margin:0 0 4px"},sel.label||(sel.ch.toUpperCase()+" "+sel.ch+(sel.m2?" · "+sel.m2[0]:""))),
      sndBtns.length?h("div",{class:"lesson-row",style:"margin:0 0 6px"},
        h("span",{class:"muted",style:"font-size:.85rem"},t("stt_snd")),
        ...sndBtns.map(b=>h("button",{class:"btn ghost",onclick:b.on},b.label))):null,
      h("p",{},bi(sel,"d")),
      sel.hint?h("p",{class:"muted",style:"font-size:.85rem"},t(sel.hint)):null,
      thm?h("p",{class:"muted",style:"font-size:.85rem"},t("stt_e_lesson")+" ",
        h("a",{href:"#",onclick:(ev)=>{ev.preventDefault();go("lessons");}},
          thm.title[currentLang()]||thm.title.ru)):null]));
    if(!all.length){el.append(dash());return;}
    const wRow=btnRow(all.map((c2,i)=>({label:(mastOf(c2.id)?"✓ ":"")+c2.ky,active:i===st.idx,
      on:()=>{st.idx=i;resetEx();render();}})));
    const onNext=()=>{resetEx();st.idx=(st.idx+1)%all.length;render();};
    el.append(h("p",{class:"muted",style:"margin:8px 0 2px;font-size:.8rem"},t(blk.words||"stt_v_words")),wRow,
      exercise(all[st.idx],{hl:sel.m.concat(sel.m2||[]),onNext,track:{sound:sel.ch}}));
  };

  const render=()=>{
    clear(body);
    cur.listen=cur.rec=cur.next=null; // экран без упражнения — хоткеи мертвы
    if(left<=0){
      body.append(card([h("h3",{},t("stt_limit_h")),h("p",{class:"muted"},t("stt_limit_p"))]));
      return;
    }
    if(blocks.length>1)body.append(btnRow(blocks.map(b=>({label:t("stt_b_"+b.id),active:S.block===b.id,
      on:()=>{if(S.block!==b.id){S.block=b.id;resetEx();render();}}})),"stt-blocks"));
    const blk=blocks.find(b=>b.id===S.block)||blocks[0];
    if(blk.kind==="sounds")renderSounds(body,blk);
    else renderPhrases(body);
  };
  render();
}
