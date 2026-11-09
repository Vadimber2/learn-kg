/* ===LESSONS-UI=== Раздел «Уроки»: аудиоурок, который слушают подряд.
   Устройство как у сильных языковых приложений: одна очередь сегментов, автопереход,
   текст по желанию, скорость для тренировки слуха и возврат на место после ухода.
   Данные — реестр LESSONS (генерируется из скрипта озвучки), логика — в маркер-блоке,
   чтобы её можно было исполнить в тестах, а не пиннить грепом. */
const Lesson = {
  seg: 0, playing: false, audio: null, text: true, rate: 1, done: {}, auto: true,
  key(){ return "kga1-lesson-" + (LESSONS[activeModule] || {}).id; },
  load(){
    try {
      const s = JSON.parse(localStorage.getItem(this.key()) || "{}");
      this.seg = Number.isInteger(s.seg) ? s.seg : 0;
      this.text = s.text !== false; this.rate = s.rate || 1; this.done = s.done || {};
      this.auto = s.auto !== false; // прежние снимки без поля — прежнее поведение
    } catch { /* повреждённый снимок — начинаем с начала, это не повод падать */ }
  },
  save(){ try { localStorage.setItem(this.key(),
    JSON.stringify({ seg: this.seg, text: this.text, rate: this.rate, done: this.done, auto: this.auto })); } catch {} },
  segments(){ return ((LESSONS[activeModule] || {}).segments) || []; },
  // Объяснение звучит на языке интерфейса (у дорожки суффикс языка), кыргызский пример —
  // один для всех языков. Транскрипт берётся из того же реестра, что и озвучка.
  fileOf(s){ return s.perLang ? s.a + "_" + currentLang() : s.a; },
  lineOf(s){ return s.perLang ? (s.text[currentLang()] || s.text.ru)
    : (s.ky + (s.gloss ? " — " + (s.gloss[currentLang()] || s.gloss.ru) : "")); },
  // прогресс считается по темам: пройдена та, у которой прослушан последний сегмент
  themeDone(id){ return !!this.done[id]; },
  stop(){ if (this.audio) { this.audio.pause(); this.audio = null; }
    if (this.gapTimer) { clearTimeout(this.gapTimer); this.gapTimer = null; }
    this.waitingRepeat = false; this.waitingGap = false; this.playing = false; },
  goto(i, andPlay){
    const segs = this.segments();
    if (i < 0 || i >= segs.length) { this.stop(); this.save(); renderLessonBody(); return; }
    this.seg = i; this.save();
    if (andPlay) this.play(); else renderLessonBody();
  },
  // Плавность без склейки в один файл: следующий сегмент подгружается заранее, пока
  // играет текущий. Композит-трек звучал бы так же гладко, но отнял бы главное —
  // прыжки по темам, повтор одного сегмента и текст, синхронный с речью.
  prefetch(){
    const nxt = this.segments()[this.seg + 1];
    if (!nxt || typeof Audio === "undefined") return;
    const f = this.fileOf(nxt);
    try { const a = new Audio("api/audio/" + homeOf(f) + "/" + f + ".mp3"); a.preload = "auto"; a.load(); } catch {}
  },
  play(){
    const segs = this.segments(), s = segs[this.seg];
    if (!s) return;
    this.stop(); this.playing = true;
    this.audio = playAudio(this.fileOf(s), this.rate);
    this.prefetch();
    // Автопереход: урок слушают подряд. У сегментов практики (repeat) держим паузу
    // длиной самого сегмента — в неё ученик повторяет вслух; 1,2–4 с, чтобы не заснуть
    // на односложном слове и не ждать вечность на фразе.
    if (this.audio) this.audio.onended = () => {
      const last = this.seg === segs.length - 1 || segs[this.seg + 1].theme !== s.theme;
      if (last && !this.done[s.theme]) {
        this.done[s.theme] = true;
        // трекинг прохождения урока: тема дослушана → событие в журнал занятий
        // (лента учителя и «Мой прогресс» ученика); полный урок — отдельным событием
        try{
          evPush("lesson.theme",{lesson:(LESSONS[activeModule]||{}).id||activeModule,theme:s.theme,seg:this.seg+1,total:segs.length});
          const themes=(LESSONS[activeModule]||{themes:[]}).themes;
          if(themes.length&&themes.every((th)=>this.done[th.id]))
            evPush("lesson.finish",{lesson:(LESSONS[activeModule]||{}).id||activeModule,themes:themes.length});
        }catch(e){}
      } else if (last) { this.done[s.theme] = true; }
      const next = () => {
        if (this.seg + 1 < segs.length) { this.seg++; this.save(); this.play(); }
        else { this.playing = false; this.save(); renderLessonBody(); }
      };
      // Режим без автопродолжения (просьба владельца 21.08.2026): кыргызская фраза
      // пробегает и ученик не успевает её повторить — на паузу он не нажмёт вовремя,
      // а на следующем сегменте уже поздно. Поэтому урок останавливается сам после
      // каждого сегмента: сколько угодно раз «Повторить», дальше — по кнопке.
      // Таймерные паузы (gap/repeat) тут не нужны: ждёт человек, а не таймер.
      if (!this.auto) { this.playing = false; this.save(); renderLessonBody(); return; }
      if (s.gap && this.seg + 1 < segs.length) {
        // небольшая пауза между темами: слушатель успевает переключиться
        this.waitingGap = true; renderLessonBody();
        this.gapTimer = setTimeout(() => { this.waitingGap = false; next(); }, 1500);
      } else if (s.repeat) {
        const dur = (this.audio && this.audio.duration) || 2;
        const gap = Math.min(4000, Math.max(1200, dur * 1000));
        this.waitingRepeat = true; renderLessonBody();
        this.gapTimer = setTimeout(() => { this.waitingRepeat = false; next(); }, gap);
      } else next();
    };
    renderLessonBody();
  },
  toggle(){ if (this.playing) { this.stop(); renderLessonBody(); } else this.play(); },
  // повтор текущего сегмента: главное действие в режиме без автопродолжения —
  // услышать фразу ещё раз, не перематывая и не теряя места
  again(){ this.play(); },
  toggleAuto(){ this.auto = !this.auto; this.save();
    // включили автопродолжение на паузе — урок продолжает сам с текущего места,
    // иначе тумблер выглядел бы неработающим до следующего нажатия «Слушать»
    if (this.auto && !this.playing) this.play(); else renderLessonBody(); },
  setRate(r){ this.rate = r; this.save(); if (this.audio) this.audio.playbackRate = r; renderLessonBody(); },
  toggleText(){ this.text = !this.text; this.save(); renderLessonBody(); },
};
/* ===/LESSONS-UI=== */

/* Иллюстрация темы: мел на доске. Рисуется DOM-методами из LESSON_FIGS — innerHTML
   в приложении запрещён, поэтому картинка описана путями, как иконки. Доска тёмная
   в обеих темах (это доска), в тёмной её слегка притеняем — правило в CSS. */
const CHALK = { w: "#f4f1e8", y: "#ffe08a", p: "#ff9fb0", c: "#8fd6e8", m: "#a8e6b0" };
function lessonFig(theme, label){
  const F = (typeof LESSON_FIGS !== "undefined") && LESSON_FIGS[theme];
  if (!F) return null;
  const sv = document.createElementNS(SVG_NS, "svg");
  sv.setAttribute("viewBox", F.vb);
  sv.setAttribute("preserveAspectRatio", "xMidYMid meet");
  sv.setAttribute("role", "img");
  sv.setAttribute("aria-label", label || "");
  sv.setAttribute("fill", "none");
  sv.setAttribute("stroke-linecap", "round");
  sv.setAttribute("stroke-linejoin", "round");
  for (const st of F.s) {
    const col = CHALK[st.c] || CHALK.w;
    // два прохода: широкий полупрозрачный даёт распыл мела, узкий — сам штрих
    for (const [w, o] of [[(st.w || 3) + 3, 0.22], [st.w || 3, 1]]) {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", st.d);
      p.setAttribute("stroke", col);
      p.setAttribute("stroke-width", w);
      p.setAttribute("opacity", o);
      if (st.f && o === 1) p.setAttribute("fill", col);
      sv.append(p);
    }
  }
  const box = h("div", { class: "lesson-fig" });
  box.append(sv);
  return box;
}

/* Слайд темы: рисунок OpenAI без текста + буквы и слова НАСТОЯЩИМ текстом панелями
   сверху и снизу (модель врёт в буквах — проверено; текст читает и скринридер).
   Глоссы берутся по языку интерфейса — один слайд обслуживает ru/en/tr. */
function lessonSlide(theme, label){
  const S = (typeof LESSON_SLIDES !== "undefined") && LESSON_SLIDES[theme];
  if (!S) return null;
  const box = h("div", { class: "lesson-fig lesson-slide" });
  if (S.top && S.top.length) {
    const band = h("div", { class: "slide-band" });
    S.top.forEach((t, i) => band.append(h("span", { class: "slide-letter sc" + (i % 5), lang: "ky" }, t)));
    box.append(band);
  }
  box.append(h("img", { src: "lessons/" + S.img + ".webp", alt: label || "", loading: "lazy" }));
  const band = h("div", { class: "slide-band" });
  for (const it of (S.items || [])) {
    const cell = h("div", { class: "slide-item" });
    if (it.ky) cell.append(h("b", { class: "ky", lang: "ky" }, it.ky));
    const cap = it.gloss || it.cap;
    if (cap) cell.append(h("small", {}, cap[currentLang()] || cap.ru));
    band.append(cell);
  }
  if ((S.items || []).length) box.append(band);
  return box;
}

function renderLessons(m){
  const L = LESSONS[activeModule];
  if (!L) return;
  Lesson.load();
  m.append(h("div", { class: "card" },
    h("h2", {}, icon("play"), " " + (L.title[currentLang()] || L.title.ru)),
    h("p", { class: "muted" }, L.intro[currentLang()] || L.intro.ru)));
  // Подвкладки «Урок» / «Видео» (решение владельца: вперемешку конфьюзит).
  // Ряд появляется, только когда видео есть что показать; переключение на видео
  // останавливает аудиоурок — двух звуков разом не бывает.
  const tabsRow = h("div", { class: "lesson-row", style: "display:none;margin-bottom:8px" });
  const bodyLesson = h("div", { id: "lesson-body" });
  const bodyVideo = h("div", { style: "display:none" });
  m.append(tabsRow, bodyLesson, bodyVideo);
  renderLessonBody();
  renderVideoCard(bodyVideo).then((has) => {
    if (!has || !tabsRow.isConnected) return;
    const bL = h("button", { class: "btn active" }, t("lsn_tab_lesson"));
    const bV = h("button", { class: "btn" }, t("lsn_tab_video"));
    const sel = (v) => {
      bL.classList.toggle("active", v === "lesson"); bV.classList.toggle("active", v === "video");
      bodyLesson.style.display = v === "lesson" ? "" : "none";
      bodyVideo.style.display = v === "video" ? "" : "none";
      if (v === "video") { Lesson.stop(); renderLessonBody(); try { evPush("video.tab", {}); } catch (e) {} }
    };
    bL.addEventListener("click", () => sel("lesson"));
    bV.addEventListener("click", () => sel("video"));
    tabsRow.append(bL, bV);
    tabsRow.style.display = "";
  });
}

/* ===VIDEO-CARD=== */
/* Видеоуроки (решение владельца): тот же урок роликом — подвкладка «Видео».
   Список публичен (api/video/list), карточка живёт и в демо. Трафик бережём:
   постеры-картинки вместо автозагрузки видео (preload="none"), файл едет только
   по клику. «Поделиться» — у всех (виральность): системный шит + WhatsApp/
   Telegram/копия; сохранённая YouTube-ссылка побеждает прямую. Мобильным —
   вертикальная серия шортсов, десктопу — широкий ролик с главами (главы = темы
   урока, чипы мотают, выбор темы урока подматывает на паузе). Преподавателю —
   скачивание, поле YouTube и плитки шортсов с постерами.
   Трекинг: video.play / video.share / video.chapter / video.tab.
   Возвращает true, когда есть что показать (подвкладка «Видео» появляется). */
function videoLangOf(file){const mm=/-(ru|en|tr)\.mp4$/.exec(file);return mm?mm[1]:null;}
function videoShortsTheme(file){const mm=/^lesson-[a-z0-9]+-([a-z0-9]+)-(?:ru|en|tr)-shorts\.mp4$/.exec(file);return mm?mm[1]:null;}
/* Плеер ролика тома — один на видеоуроки и ролики справочника (===GRAM-VIDEO===):
   без автозагрузки (preload="none"), постер из списка, video.play в журнал один раз. */
function videoNode(row,style){
  const attrs={controls:"controls",preload:"none",playsinline:"playsinline",src:"api/video/"+row.file,style};
  if(row.poster)attrs.poster="api/video/"+row.poster;
  const v=h("video",attrs);
  v.addEventListener("play",()=>{try{evPush("video.play",{file:row.file});}catch(e){}},{once:true});
  return v;
}
function videoShareUrl(row){return row.youtube||((typeof location!=="undefined"?location.origin:"")+"/api/video/"+row.file);}
async function renderVideoCard(box){
  let all=[];
  try{const r=await fetch("api/video/list");if(r.ok)all=await r.json();}catch(e){}
  if(!box.isConnected)return false;
  // список общий на все уроки, а карточка — своего: имена lesson-<слаг>-…
  // (слаг = id урока без дефисов); без фильтра в «Уроке 2» показывались ролики урока 1
  const slug=String((LESSONS[activeModule]||{}).id||"").replace(/-/g,"");
  all=all.filter((x)=>x.file.startsWith("lesson-"+slug+"-"));
  const shorts=all.filter((x)=>/-shorts\.mp4$/.test(x.file));
  // порядок языков канонический RU EN TR (как везде), не алфавит имён файлов
  const LANG_ORD={ru:0,en:1,tr:2};
  const rows=all.filter((x)=>videoLangOf(x.file))
    .sort((a,b)=>LANG_ORD[videoLangOf(a.file)]-LANG_ORD[videoLangOf(b.file)]);
  if(!rows.length&&!shorts.length){
    // ученикам пусто не показываем; преподавателю — подсказка, как залить
    if(isTeacher()){box.append(h("div",{class:"card"},h("h3",{},icon("play")," "+t("vid_hdr")),
      h("p",{class:"muted"},t("vid_none_teacher"))));return true;}
    return false;
  }
  let cur=rows.find((x)=>videoLangOf(x.file)===currentLang())||rows[0];
  // Мобильный режим (решение владельца): в контент телефона идёт вертикальный
  // формат — серия шортсов по темам; широкий ролик с главами остаётся десктопу.
  const mobile=typeof matchMedia!=="undefined"&&matchMedia("(max-width: 720px)").matches;
  const shortsLangs=["ru","en","tr"].filter((l)=>shorts.some((x)=>x.file.endsWith("-"+l+"-shorts.mp4")));
  const serial=mobile&&shortsLangs.length>0;
  let sLang=shortsLangs.includes(currentLang())?currentLang():shortsLangs[0];
  let sCur=null;
  const themeTitle=(id)=>{const th=((LESSONS[activeModule]||{}).themes||[]).find((x)=>x.id===id);
    return th?(th.title[currentLang()]||th.title.ru):id;};
  // язык видимого ролика — чипом в заголовке карточки (просьба владельца)
  const langChip=h("span",{class:"chip",style:"margin-left:6px;vertical-align:middle"});
  const poster=(row)=>row.poster?"api/video/"+row.poster:null;
  const shareRow=(row)=>{
    const url=videoShareUrl(row);
    const txt=((LESSONS[activeModule]||{title:{}}).title[currentLang()]||"")+" · learn.kg";
    const track=(ch)=>{try{evPush("video.share",{ch,file:row.file});}catch(e){}};
    const r2=h("div",{class:"lesson-row",style:"margin-top:8px"});
    if(typeof navigator!=="undefined"&&navigator.share)
      r2.append(h("button",{class:"btn primary",onclick:()=>{track("sys");navigator.share({title:txt,url}).catch(()=>{});}},t("vid_share")));
    r2.append(
      h("a",{class:"btn",target:"_blank",rel:"noopener noreferrer",onclick:()=>track("wa"),
        href:"https://wa.me/?text="+encodeURIComponent(txt+" "+url)},"WhatsApp"),
      h("a",{class:"btn",target:"_blank",rel:"noopener noreferrer",onclick:()=>track("tg"),
        href:"https://t.me/share/url?url="+encodeURIComponent(url)+"&text="+encodeURIComponent(txt)},"Telegram"),
      h("button",{class:"btn",onclick:(ev)=>{track("copy");try{navigator.clipboard.writeText(url);ev.target.textContent=t("vid_copied");}catch(e){}}},t("vid_copy")));
    if(row.youtube)r2.append(h("a",{class:"btn",target:"_blank",rel:"noopener noreferrer",onclick:()=>track("yt"),href:row.youtube},"YouTube"));
    // Скачать файл — преподавателю в общем ряду шаринга: так кнопка есть и в мобильной
    // вертикали (заливать шортс в соцсети с телефона), и на широкой раскладке
    if(isTeacher())r2.append(h("a",{class:"btn ghost",href:"api/video/"+row.file,download:row.file,
      onclick:()=>track("dl")},t("vid_dl")+" ("+Math.round(row.bytes/1048576)+" MB)"));
    return r2;
  };
  const body=h("div",{});
  // Шортсы преподавателю — плитками с постерами (24 текстовые кнопки нечитаемы,
  // замечание владельца): картинка + подпись, видео грузится только по клику
  // (плитка разворачивается в плеер), ⬇ — скачать файл.
  const renderShorts=()=>{
    if(!isTeacher())return;
    // плитки — только язык видимого ролика (замечание владельца: все 24 разом — каша);
    // переключение языковых чипов перерисовывает и их
    const lang=serial?sLang:(cur?videoLangOf(cur.file):currentLang());
    const myShorts=shorts.filter((x)=>x.file.endsWith("-"+lang+"-shorts.mp4"));
    if(!myShorts.length)return;
    body.append(h("p",{class:"muted",style:"margin:10px 0 4px"},t("vid_shorts")));
    const grid=h("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px"});
    for(const s2 of myShorts){
      const cap=themeTitle(videoShortsTheme(s2.file)||"");
      const slot=h("div",{});
      const img=poster(s2)
        ?h("img",{src:poster(s2),loading:"lazy",alt:cap,style:"width:100%;display:block;aspect-ratio:9/16;object-fit:cover;cursor:pointer"})
        :h("div",{style:"width:100%;aspect-ratio:9/16;background:var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.6rem"},"▶");
      img.addEventListener("click",()=>{
        const v2=h("video",{controls:"controls",autoplay:"autoplay",playsinline:"playsinline",
          src:"api/video/"+s2.file,style:"width:100%;display:block;aspect-ratio:9/16;background:#000"});
        try{evPush("video.play",{file:s2.file});}catch(e){}
        clear(slot).append(v2);
      });
      slot.append(img);
      grid.append(h("div",{style:"border:1px solid var(--line);border-radius:10px;overflow:hidden"},
        slot,
        h("div",{style:"display:flex;align-items:center;justify-content:space-between;padding:4px 8px"},
          h("span",{class:"muted",style:"font-size:.72rem"},cap),
          h("a",{href:"api/video/"+s2.file,download:s2.file,title:t("vid_dl")},"⬇"))));
    }
    body.append(grid);
  };
  const render=()=>{
    clear(body);
    if(serial){
      // Каркас серии строится ОДИН раз: смена темы/языка меняет src у живого
      // плеера и подсветку чипов, а не пересоздаёт блок — пересоздание схлопывало
      // и моргало плеером на телефоне (жалоба владельца).
      const langRow=h("div",{class:"lesson-row",style:"margin-bottom:8px"});
      const v=h("video",{controls:"controls",preload:"none",playsinline:"playsinline",
        style:"display:block;margin:0 auto;max-width:100%;max-height:72vh;aspect-ratio:9/16;border-radius:12px;background:#000"});
      v.addEventListener("play",()=>{
        if(v._trk===(sCur&&sCur.file))return; // трекаем первый пуск каждого файла, не каждый resume
        v._trk=sCur&&sCur.file;
        try{evPush("video.play",{file:sCur&&sCur.file});}catch(e){}
      });
      const chipsRow=h("div",{class:"lesson-row",style:"margin-top:8px"});
      const shareBox=h("div",{});
      const listOf=()=>shorts.filter((x)=>x.file.endsWith("-"+sLang+"-shorts.mp4"))
        .sort((a,b)=>a.file.localeCompare(b.file,undefined,{numeric:true}));
      const update=()=>{
        const list=listOf();
        if(!sCur||!list.includes(sCur))sCur=list[0];
        langChip.textContent=sLang.toUpperCase();
        clear(langRow);
        if(shortsLangs.length>1)for(const l of shortsLangs)langRow.append(h("button",{class:"btn"+(l===sLang?" active":""),
          onclick:()=>{if(l!==sLang){sLang=l;sCur=null;update();}}},l.toUpperCase()));
        if(!v.paused){try{v.pause();}catch(e){}}
        v.setAttribute("src","api/video/"+sCur.file);
        if(sCur.poster)v.setAttribute("poster","api/video/"+sCur.poster);else v.removeAttribute("poster");
        clear(chipsRow);
        for(const f of list)chipsRow.append(h("button",{class:"btn ghost"+(f===sCur?" active":""),style:"padding:3px 10px;font-size:.8rem",
          onclick:()=>{if(f!==sCur){sCur=f;update();}}},themeTitle(videoShortsTheme(f.file))));
        clear(shareBox).append(shareRow(sCur));
      };
      update();
      body.append(langRow,v,chipsRow,shareBox);
      renderVideoCard._sync=(themeId)=>{
        const f=listOf().find((x)=>videoShortsTheme(x.file)===themeId);
        if(f&&f!==sCur&&v.paused&&v.isConnected){sCur=f;update();}
      };
      return;
    }
    if(!cur){body.append(h("p",{class:"muted"},t("vid_none_teacher")));renderShorts();return;}
    langChip.textContent=videoLangOf(cur.file).toUpperCase();
    if(rows.length>1){
      const rowB=h("div",{class:"lesson-row",style:"margin-bottom:8px"});
      for(const rw of rows)rowB.append(h("button",{class:"btn"+(rw===cur?" active":""),
        onclick:()=>{cur=rw;render();}},videoLangOf(rw.file).toUpperCase()));
      body.append(rowB);
    }
    const v=videoNode(cur,"width:100%;border-radius:12px;background:#000");
    body.append(v);
    // Главы = темы урока (залиты вместе с роликом): чипы мотают видео на тему.
    const chapters=Array.isArray(cur.chapters)?cur.chapters:[];
    if(chapters.length){
      const chRow=h("div",{class:"lesson-row",style:"margin-top:8px"});
      for(const ch of chapters)chRow.append(h("button",{class:"btn ghost",style:"padding:3px 10px;font-size:.8rem",
        onclick:()=>{v.currentTime=ch.start;try{evPush("video.chapter",{file:cur.file,theme:ch.id});}catch(e){}}},themeTitle(ch.id)));
      body.append(chRow);
    }
    renderVideoCard._sync=(themeId)=>{
      if(!v.isConnected||!chapters.length)return;
      const ch=chapters.find((x)=>x.id===themeId);
      if(ch&&v.paused)v.currentTime=ch.start; // играющее видео не дёргаем — юзер занят им
    };
    body.append(shareRow(cur));
    if(isTeacher()){
      const inp=h("input",{class:"answer-input",style:"flex:1;min-width:200px",placeholder:t("vid_yt_ph"),value:cur.youtube||""});
      const st=h("span",{class:"muted",style:"font-size:.8rem"});
      body.append(h("div",{class:"lesson-row",style:"margin-top:8px"},
        inp,
        h("button",{class:"btn",onclick:async()=>{
          try{
            const r=await fetch("api/video/meta",{method:"PUT",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({file:cur.file,youtube:inp.value.trim()||null})});
            if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"ошибка");
            cur.youtube=inp.value.trim()||null;st.textContent="✓";render();
          }catch(e){st.textContent="⚠ "+e.message;}
        }},t("vid_yt_save")),st));
      renderShorts();
    }
  };
  render();
  box.append(h("div",{class:"card"},h("h3",{},icon("play")," "+t("vid_hdr"),langChip),body));
  return true;
}
/* ===/VIDEO-CARD=== */

/* Самая длинная надпись главной кнопки плеера — по обоим состояниям и всем языкам
   словаря. Считается по числу символов: сравниваются короткие подписи одного
   начертания, и разница между «Слушать урок» и «Пауза» очевидна без замера пикселей.
   typeof-гейт держит функцию живой в vm-срезах тестов, где словаря нет. */
function lessonMainWidest(){
  const keys = ["lesson_play", "lesson_pause"];
  const dicts = (typeof I18N !== "undefined") ? Object.values(I18N) : [];
  let best = "";
  for (const d of dicts) for (const k of keys) {
    const s = d && d[k];
    if (typeof s === "string" && s.length > best.length) best = s;
  }
  return best || (typeof t === "function" ? t("lesson_play") : "");
}

function renderLessonBody(){
  const box = el("lesson-body"); if (!box) return;
  box.textContent = "";
  const L = LESSONS[activeModule], segs = Lesson.segments(), cur = segs[Lesson.seg] || segs[0];
  const themeIdx = L.themes.findIndex((x) => x.id === cur.theme);
  const themeTitle = L.themes[themeIdx]
    ? (L.themes[themeIdx].title[currentLang()] || L.themes[themeIdx].title.ru) : "";
  // тело перерисовывается на каждом сегменте — проявляем картинку только при смене темы,
  // иначе она мигала бы каждые несколько секунд. Слайд (рисунок + буквы текстом)
  // главнее рисованного SVG; SVG остаётся запасным для тем без слайда.
  const fig = lessonSlide(cur.theme, themeTitle) || lessonFig(cur.theme, themeTitle);
  if (fig && Lesson.figTheme !== cur.theme) {
    fig.classList.add("fresh"); Lesson.figTheme = cur.theme;
    // тема сменилась — видеоурок ниже подматывается на ту же главу (если стоит на паузе)
    if (typeof renderVideoCard !== "undefined" && renderVideoCard._sync) renderVideoCard._sync(cur.theme);
  }

  // Плеер: одна главная кнопка, шаги, скорость и тумблер текста — ничего лишнего
  box.append(h("div", { class: "card lesson-player" },
    h("div", { class: "lesson-row" },
      // ширину держит невидимая мерка — самая длинная надпись среди обоих состояний
      // и всех языков (ключи берутся из словарей целиком, а не из текущего языка):
      // иначе «Слушать урок» → «Пауза» дёргает весь ряд кнопок под курсором
      h("button", { class: "btn primary lesson-main", onclick: () => Lesson.toggle() },
        h("span", { class: "lesson-main-size", "aria-hidden": "true" }, lessonMainWidest()),
        h("span", { class: "lesson-main-label" },
          icon(Lesson.playing ? "pause" : "play", 15), " " + t(Lesson.playing ? "lesson_pause" : "lesson_play"))),
      // шаг соседним сегментом: в ручном режиме он сразу звучит — иначе ученик
      // нажимает «дальше» и попадает в тишину, из которой снова надо нажимать
      h("button", { class: "btn", onclick: () => Lesson.goto(Lesson.seg - 1, Lesson.playing || !Lesson.auto) }, "◀"),
      h("button", { class: "btn" + (!Lesson.auto && !Lesson.playing ? " primary" : ""),
        onclick: () => Lesson.goto(Lesson.seg + 1, Lesson.playing || !Lesson.auto) }, "▶"),
      h("button", { class: "btn", title: t("lesson_again_hint"), onclick: () => Lesson.again() },
        "↻ " + t("lesson_again")),
      h("span", { class: "muted" }, (Lesson.seg + 1) + " / " + segs.length),
      // тумблер автопродолжения: включён — части идут одна за другой, выключен —
      // урок ждёт после каждой, чтобы повторить вслух столько раз, сколько нужно
      h("button", { class: "btn" + (Lesson.auto ? " active" : ""), title: t("lesson_auto_hint"),
        onclick: () => Lesson.toggleAuto() }, icon("play", 14), " " + t("lesson_auto")),
      h("button", { class: "btn" + (Lesson.text ? " active" : ""), onclick: () => Lesson.toggleText() },
        icon("type", 14), " " + t(Lesson.text ? "lesson_text_on" : "lesson_text_off")),
      ...[0.75, 1].map((r) => h("button", { class: "btn" + (Lesson.rate === r ? " active" : ""),
        onclick: () => Lesson.setRate(r) }, r + "×"))),
    // Сцена: картинка темы и текущая строка рядом — на широком экране в две колонки,
    // на телефоне друг под другом (картинка сверху, текст всегда виден вместе с ней).
    h("div", { class: "lesson-stage" }, fig,
      h("div", { class: "lesson-text" },
        h("div", { class: "lesson-now" },
          h("span", { class: "lesson-badge" }, cur.kind === "example" ? "KY" : currentLang().toUpperCase()),
          h("b", {}, themeTitle)),
        Lesson.waitingRepeat ? h("p", { class: "lesson-line lesson-repeat" }, icon("mic", 15), " " + t("lesson_repeat_now"))
          : Lesson.waitingGap ? h("p", { class: "muted lesson-line" }, "…")
          : Lesson.text ? h("p", { class: cur.kind === "example" ? "ky lesson-line" : "lesson-line" }, Lesson.lineOf(cur))
                        : h("p", { class: "muted lesson-line" }, t("lesson_text_hidden")),
        // в ручном режиме на паузе видно, что урок ждёт человека, а не завис
        (!Lesson.auto && !Lesson.playing)
          ? h("p", { class: "muted", style: "font-size:.85rem;margin:4px 0 0" }, t("lesson_manual_hint")) : null))));

  // Темы урока: видно, где ты и что уже прослушано
  const list = h("div", { class: "lesson-themes" });
  L.themes.forEach((th) => {
    const first = segs.findIndex((s) => s.theme === th.id);
    list.append(h("button", {
      class: "lesson-theme" + (th.id === cur.theme ? " active" : "") + (Lesson.themeDone(th.id) ? " done" : ""),
      onclick: () => Lesson.goto(first, true) },
      icon(Lesson.themeDone(th.id) ? "check" : "play", 13), " " + (th.title[currentLang()] || th.title.ru)));
  });
  box.append(h("div", { class: "card" }, h("h3", {}, t("lesson_themes")), list));

  // Связь с остальным модулем: после звуков сразу есть куда идти
  box.append(h("div", { class: "card" }, h("h3", {}, t("lesson_next")),
    h("div", { class: "lesson-row" },
      h("button", { class: "btn", onclick: () => { Lesson.stop(); go("alphabet"); } }, icon("type", 14), " " + (bi(CONTENT[activeModule] || {}, "refLabel") || t("tab_overview"))),
      h("button", { class: "btn", onclick: () => { Lesson.stop(); go("cards"); } }, icon("cards", 14), " " + t("tab_cards")),
      h("button", { class: "btn", onclick: () => { Lesson.stop(); go("harmony"); } }, icon("wave", 14), " " + (bi(CONTENT[activeModule] || {}, "drillLabel") || t("tab_test"))))));
}
