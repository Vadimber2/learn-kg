
/* ---------- Диалоги: понимание на слух и в чтении ----------
   Лучшие практики раздела: строка играется по тапу, «прослушать часть» ведёт по
   строкам с подсветкой, перевод скрыт по умолчанию (сначала понимание), после
   диалогов — вопросы на понимание; ответы считаются как обычная практика. */
/* ===KARAOKE=== */
// Индекс подсвечиваемой строки куплета в момент tCur. starts — карта таймингов
// (KARAOKE: секунды начала каждой строки, из пословных таймстампов STT); без карты —
// пропорция по длине строк от известной длительности дорожки. -1 = не подсвечивать
// (метаданные ещё не загружены). DOM-free: исполняется и проверяется вне браузера.
function karaokeLineAt(starts,lens,tCur,dur){
  if(starts&&starts.length===lens.length){
    let i=-1; // до старта первой строки (вступление полной песни) — не подсвечиваем
    for(let k=0;k<starts.length;k++)if(tCur>=starts[k])i=k;
    return i;
  }
  if(!dur||!isFinite(dur)||dur<=0)return -1;
  const sum=lens.reduce((a,b)=>a+b,0)||1;
  let acc=0;
  for(let k=0;k<lens.length;k++){acc+=lens[k];if(tCur<dur*acc/sum)return k;}
  return lens.length-1;
}
/* ===/KARAOKE=== */
// Тумблер «Показать/Скрыть перевод» для контейнера с классом dlg-hide-tr
function dlgTrBtn(box){
  const b=tglBtn([t("dlg_show_tr")],[t("dlg_hide_tr")]);
  b.addEventListener("click",()=>{box.classList.toggle("dlg-hide-tr");b.classList.toggle("on",!box.classList.contains("dlg-hide-tr"));});
  return b;
}
// Вопросы после каждой части и песни. Варианты — канонические optList/revealOpts
// (как дрилл и мини-тест); перевод вопроса скрыт: тап по вопросу или тумблер, как у реплик.
function dlgQuizCard(items){
  const qc=h("div",{class:"card dlg-hide-tr"});
  qc.append(h("h2",{},icon("check")," "+t("dlg_quiz_hdr")),h("p",{class:"muted"},t("dlg_quiz_hint")));
  items.forEach((qz,qi)=>{
    const block=h("div",{class:"dlg-q",style:"margin:14px 0",title:t("dlg_tap_tr")});
    block.addEventListener("click",(e)=>{if(e.target.closest("button"))return;block.classList.toggle("open");});
    block.append(h("p",{style:"font-weight:650;margin:0 0 2px"},(qi+1)+". ",h("span",{class:"kgword"},qz.q)),
      h("p",{class:"muted dlg-tr",style:"margin:0 0 8px;font-size:.85rem"},L(qz.qRu,qz.qEn,qz.qTr)));
    block.append(optList(qz.opts,(i,b,box)=>{
      const ok=i===qz.c;
      revealOpts(box,qz.c,i);
      block.append(h("div",{class:"feedback "+(ok?"ok":"err")},t(ok?"dlg_right":"dlg_wrong")));
      evPush("drill.answer",{mod:activeModule,ok}); // понимание — та же практика, что дрилл
    }));
    qc.append(block);
  });
  qc.append(h("div",{style:"margin-top:4px"},dlgTrBtn(qc)));
  return qc;
}
function renderDialogs(m){
  const D=DIALOGS[activeModule];
  if(!D){m.append(h("div",{class:"card"},h("p",{class:"muted"},"—")));return;}
  m.append(h("div",{class:"card"},h("h2",{},icon("users")," "+t("dlg_hdr")),
    h("p",{class:"muted"},t("dlg_hint"))));
  // Аудио живёт в модульных каналах fgPlay/AMB; здесь — только подсветка текущей реплики
  let nowRow=null;
  const setNow=(row)=>{if(nowRow)nowRow.classList.remove("now");nowRow=row;
    if(row){row.classList.add("now");row.scrollIntoView({block:"nearest",behavior:"smooth"});}};
  for(const part of D.parts){
    const card=h("div",{class:"card dlg-hide-tr"});
    card.append(h("h2",{},part.title),h("p",{class:"muted",style:"margin:-4px 0 10px"},bi(part,"sub")));
    const rowsById={};
    const listBox=h("div",{});
    for(const line of part.lines){
      const row=h("div",{class:"dlg-line",title:t("dlg_tap_tr")});
      row.addEventListener("click",(e)=>{if(e.target.closest("button"))return;row.classList.toggle("open");});
      const snd=sndBtn(line.id);
      if(snd)row.append(snd);
      row.append(h("b",{class:"dlg-sp"},line.sp+":")," ",h("span",{class:"kgword"},line.ky),
        h("span",{class:"muted dlg-tr"}," — "+gloss(line)));
      rowsById[line.id]=row;
      listBox.append(row);
    }
    // «прослушать часть»: цепочка реплик в канале переднего плана, подсветка текущей строки
    const playAllBtn=tglBtn([icon("play",13)," "+t("dlg_listen_all")],["⏸ "+t("dlg_stop")]);
    playAllBtn.addEventListener("click",()=>{
      if(fgOwner()===part){fgStop();return;} // повторный тап — стоп
      const done=()=>{playAllBtn.classList.remove("on");setNow(null);};
      const chain=(i)=>{
        while(i<part.lines.length&&!AUDIO.has(part.lines[i].id))i++;
        if(i>=part.lines.length){fgStop();return;}
        const id=part.lines[i].id;
        setNow(rowsById[id]);
        fgPlay(id,{owner:part,onended:()=>chain(i+1),done});
        const nx=part.lines[i+1];
        if(nx&&AUDIO.has(nx.id))fetch("api/audio/m0/"+nx.id+".mp3").catch(()=>{}); // прогрев кэша следующей реплики
        evPush("audio.play",{mod:"m0",cardId:id,ctx:"dialog"});
      };
      playAllBtn.classList.add("on");
      chain(0);
      // сцена начинается со звуком места: атмосфера включается сама (если ещё не крутится)
      if(ambBtn&&!(AMB&&AMB.btn===ambBtn))ambBtn.click();
    });
    const trBtn=dlgTrBtn(card);
    const ambBtn=part.amb&&AUDIO.has(part.amb)?h("button",{class:"btn ghost",title:t("dlg_amb"),onclick:()=>{
      const was=AMB&&AMB.btn===ambBtn;
      ambStop();
      if(was)return; // повторный тап — выключить
      const a=new Audio("api/audio/m0/"+part.amb+".mp3");
      a.loop=true;a.volume=0.22; // фон под репликами, а не вместо них
      a.play();ambBtn.classList.add("ambon");AMB={audio:a,btn:ambBtn};
    }},"🔊 "+t("dlg_amb")):null;
    card.append(appendKids(h("div",{class:"rev-controls dlg-ctlrow"},playAllBtn,trBtn),ambBtn),listBox);
    m.append(card);
    if(part.quiz&&part.quiz.length)m.append(dlgQuizCard(part.quiz));
  }
  // сен / сиз — краткая шпаргалка вежливости из диалогов
  m.append(h("div",{class:"card"},h("h2",{},t("dlg_note_hdr")),
    harmonyTable([L("Сен — другу, ровеснику","Сен — to a friend, a peer","Сен — arkadaşa, yaşıta"),L("Сиз — старшим и взрослым","Сиз — to elders and adults","Сиз — büyüklere")],[
      [h("span",{class:"kgword"},"Саламатсыңбы? Сен кандайсың?"),h("span",{class:"kgword"},"Саламатсызбы? Сиз кандайсыз?")],
      [h("span",{class:"kgword"},"Сага рахмат."),h("span",{class:"kgword"},"Сизге рахмат.")],
      [h("span",{class:"kgword"},"Жакшы кал! Жакшы бар!"),h("span",{class:"kgword"},"Жакшы калыңыз! Жакшы барыңыз!")],
      [h("span",{class:"kgword"},"Кел, отур."),h("span",{class:"kgword"},"Кириңиз, отуруңуз.")]])));
  // песня
  for(const song of (D.songs||[])){
    const sc=h("div",{class:"card dlg-hide-tr"});
    // строки всех куплетов по порядку — караоке полной песни ведёт по ним по карте skt
    const songLineEls=[];
    const songClear=()=>songLineEls.forEach((el)=>el.classList.remove("kara"));
    // полная песня — тот же канал переднего плана: повторный тап останавливает
    let full=null;
    if(song.fullId&&AUDIO.has(song.fullId)){
      full=tglBtn([icon("play",12)," "+t("dlg_song_play")],["⏸ "+t("dlg_stop")]);
      full.addEventListener("click",()=>{
        if(fgOwner()===song){fgStop();return;} // повторный тап — стоп
        const a=fgPlay(song.fullId,{owner:song,done:()=>{full.classList.remove("on");songClear();}});
        full.classList.add("on");
        evPush("audio.play",{mod:"m0",cardId:song.fullId,ctx:"song"});
        // Караоке полной песни — ТОЛЬКО по карте skt (выравнивание пения через STT,
        // deploy/gen-karaoke.js): пропорция на треке со вступлением и проигрышами врала бы,
        // поэтому без карты подсветки нет. До первой строки karaokeLineAt отдаёт -1.
        if(song.skt&&song.skt.length===songLineEls.length){
          let last=-2;
          a.ontimeupdate=()=>{
            if(fgOwner()!==song)return;
            const i=karaokeLineAt(song.skt,song.skt,a.currentTime,0);
            if(i===last)return;
            last=i;
            songLineEls.forEach((el,k)=>el.classList.toggle("kara",k===i));
            // строка ушла в следующий куплет-блок за экраном — без прокрутки казалось,
            // что подсветка «не перескакивает куплеты» (жалоба владельца); nearest
            // не дёргает экран, пока строка и так видна
            if(i>=0)try{songLineEls[i].scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
          };
        }
      });
    }
    sc.append(appendKids(h("h2",{},song.title+" "),full),h("p",{class:"muted",style:"margin:-4px 0 10px"},bi(song,"sub")));
    for(const v of song.verses){
      const block=h("div",{class:"dlg-verse"});
      const head=h("div",{style:"display:flex;gap:8px;align-items:center;margin-bottom:4px"},h("b",{},v.name));
      const lines=v.ky.split("\n");
      const lineEls=lines.map((s)=>h("div",{class:"kgword"},s));
      // Караоке: свой ▶ вместо sndBtn — тот же fgPlay-канал, но с подсветкой текущей
      // строки по timeupdate (~4 Гц — для строк куплета достаточно). Тайминги — поле kt
      // куплета (deploy/gen-karaoke.js, пословные таймстампы STT), фолбэк — пропорция.
      let snd=null;
      if(AUDIO.has(v.id)){
        const clear=()=>lineEls.forEach((el)=>el.classList.remove("kara"));
        snd=h("button",{class:"btn ghost sndbtn",title:t("rev_listen")},icon("play",11));
        snd.addEventListener("click",()=>{
          if(fgOwner()===snd){fgStop();return;}
          evPush("audio.play",{mod:"m0",cardId:v.id,ctx:"verse"});
          const a=fgPlay(v.id,{owner:snd,done:()=>{snd.replaceChildren(icon("play",11));clear();}});
          snd.replaceChildren(icon("pause",11));
          const lens=lines.map((s)=>s.length);
          a.ontimeupdate=()=>{
            if(fgOwner()!==snd)return;
            const i=karaokeLineAt(v.kt,lens,a.currentTime,a.duration);
            lineEls.forEach((el,k)=>el.classList.toggle("kara",k===i));
          };
        });
      }
      if(snd)head.append(snd);
      block.append(head);
      for(const el of lineEls){block.append(el);songLineEls.push(el);}
      block.append(h("div",{class:"muted dlg-tr",style:"margin-top:4px;font-size:.85rem"},gloss(v)));
      sc.append(block);
    }
    const trBtn2=dlgTrBtn(sc);
    sc.append(h("div",{style:"margin-top:10px"},trBtn2));
    m.append(sc);
    if(song.quiz&&song.quiz.length)m.append(dlgQuizCard(song.quiz));
  }
}
