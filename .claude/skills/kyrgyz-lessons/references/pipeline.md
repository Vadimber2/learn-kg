# Конвейер урока: команды и грабли

Все команды — из корня репозитория. `KGA1_AUTH="логин:пароль"` — учётка
преподавателя/админа (см. deploy/CREDENTIALS.md).

## Содержание
- 1. Реестр и данные приложения
- 2. Слайды тем
- 3. Озвучка на прод
- 4. Аудит затухания
- 5. Видео (после оценки владельцем)
- 6. Выпуск

## 1. Реестр и данные приложения

```bash
node deploy/gen-lessons.js          # все уроки из LESSON_SCRIPTS
```
- m0 пишется в `app/src/data/lessons.js` (`const LESSONS = {…}` — есть у всех).
- M1+ пишутся в `app/src/data/lessons/<mod>.js` (`LESSONS.<mod> = …`) — часть
  едет только в сборки своего модуля. **Новая часть обязана попасть в
  `app/src/manifest.json`** (файл вне манифеста роняет старт), а фильтр в
  `server/appshell.js` уже знает шаблон `data/lessons/m<n>[-slides].js`
  (там же — в `partsOfModule`, иначе донор-скан не увидит ссылок).
- Файлы генерируются: руками не править, правки — в скрипт.

## 2. Слайды тем

Рисунок генерирует OpenAI (`~/.config/openai/learn-kg.key`, модель `gpt-image-1`,
size `1536x1024`, quality `high`), **строго без текста** — модель врёт в буквах
(ң рисовала сербской Ћ, «көл» писала «кол»). Разовый скрипт держим в scratchpad
сессии; стиль промпта, проверенный на уроках 1–2:

> A child-like chalk drawing on a dark green school chalkboard. Thick, slightly
> rough colorful chalk strokes in white, pale yellow, soft pink, light blue and
> mint green. Naive, warm, hand-drawn style… Flat 2D, no perspective, generous
> empty chalkboard space around the drawing. IMPORTANT: absolutely no text, no
> letters, no numbers, no writing, no symbols that look like writing, anywhere
> in the image. + <сцена темы>

Дальше: `cwebp -q 82 <png> -o app/lessons/<тема>.webp` и запись в
`app/src/data/lessons/<mod>-slides.js`. Структура записи ровно такая
(`top` — панель букв, `items` — слова с глоссами; путать местами нельзя):

```js
Object.assign(LESSON_SLIDES, {
 "m2t1": {
  "img": "m2t1",                       // имя файла без .webp
  "top": ["мен", "сен"],               // строчные кириллические, ≤8 знаков
  "items": [
   { "ky": "үй", "gloss": { "ru": "дом", "en": "house", "tr": "ev" } },
   { "cap": { "ru": "подпись без кыргызского", "en": "…", "tr": "…" } }
  ]
 }
});
```
**Обязательно посмотреть глазами каждый рисунок** — гейт ловит текст в данных,
но не буквы, нарисованные внутри растра.

## 3. Озвучка на прод

```bash
KGA1_AUTH="…" PROD=1 KGA1_LESSON=m1 node deploy/gen-pronunciation.js
# точечно (после правки текста или по списку брака):
KGA1_AUTH="…" PROD=1 KGA1_LESSON=m1 KGA1_ONLY='^(ph_m1t1_01_tr|ph_m1t3_04)$' \
  node deploy/gen-pronunciation.js
# упорный обрыв — Robust:
… STABILITY=1 KGA1_ONLY='^ph_m1t1_05_tr$' node deploy/gen-pronunciation.js
```
- **`PROD=1` обязателен**: локальный режим скрипта остался от первой версии и
  формат нынешнего скрипта не понимает (ждёт `seg.text` строкой и `seg.lang`).
- Объяснения идут ×3 языка (`_ru/_en/_tr`), примеры — одной кыргызской дорожкой;
  всё ложится в бакет **m0** (`ph_*`), как реплики диалогов.
- Публичный снимок `ph_*` собирается ПРИ СТАРТЕ процесса → до деплоя ссылки
  анониму отдают 401, а свежие дорожки не слышны без авторизации.
- `LANGS=ru,en` сужает только объяснения — кыргызские примеры генерируются всегда.
- Позиционный аргумент — фильтр по id темы (`… node deploy/gen-pronunciation.js m1t3`).
- Объяснение длиннее 480 знаков скрипт **молча пропускает** (пишет ошибку в лог
  и идёт дальше) — дорожки просто не будет, поэтому гейт длины важнее, чем кажется.

## 4. Аудит затухания (обязателен, до 0)

```bash
KGA1_AUTH="…" KGA1_BASE=https://learn.kg KGA1_ONLY='^ph_m1t' node deploy/audit-audio.js m0
```
- `KGA1_BASE` указывай явно: по умолчанию этот скрипт ходит на другой алиас
  прода, чем генератор и загрузчик.
- Аудит проверяет не только затухание: ещё чужой голос (по мете файла) и
  «озвучка старше правки текста» (overrides преподавателя).
- Дорожки урока помечены `noGen` (текст на языке ученика): аудит их видит,
  пакетная генерация обходит. Из этого следует, что **`KGA1_FIX=1` для уроков
  бесполезен** — автопочинка их пропускает; лечение только точечным прогоном
  `gen-pronunciation.js`. Без `KGA1_FIX` аудит вообще ничего не перегенерирует,
  только печатает список.
- Эскалация до нуля подозрительных: 1–2 дубля обычным режимом → `STABILITY=1`
  (Robust) → орфоэпическая перезапись `say`. На уроке 2 путь был 11 → 2 → 1 → 0.

## 5. Видео (только после оценки урока владельцем)

```bash
for L in ru en tr; do KGA1_LESSON=m1 KGA1_VIDEO_LANG=$L node deploy/make-video.js; done
for L in ru en tr; do KGA1_LESSON=m1 KGA1_VIDEO_LANG=$L KGA1_VIDEO_FORMAT=shorts \
  node deploy/make-video.js; done
KGA1_AUTH="…" node deploy/upload-video.js      # deploy/out → прод, главы в мету
```
- Имена: `lesson-<слаг>-<lang>.mp4` и `lesson-<слаг>-<тема>-<lang>-shorts.mp4`,
  слаг = `lesson.id` без дефисов. Карточка «Видео» фильтрует список по слагу
  своего урока — иначе в уроке 2 показывались ролики урока 1.
- Заставка — титульная карта из `lesson.title`: название крупно, «Урок N ·
  learn.kg» акцентом; каждая строка переноса центруется отдельным drawtext
  (многострочный textfile ffmpeg рисует блоком по левому краю).
- Нужен ffmpeg **с drawtext** (`/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`,
  либо `KGA1_FFMPEG=<путь>`) и шрифт с кириллицей и ө/ү/ң
  (`/Library/Fonts/Arial Unicode.ttf`, либо `KGA1_FONT`).
- **Кэш аудио `deploy/video-cache/` не инвалидируется**: после перегенерации
  дорожки удали её mp3 оттуда, иначе ролик соберётся со старым звуком.
- Слайды для видео собираются из общего `lesson-slides.js` **плюс всех**
  `app/src/data/lessons/*-slides.js`. Темы без слайда попадают в план с пустым
  рисунком, и ffmpeg падает на несуществующем `.webp` — слайды делаются до видео.
- Постеры `.jpg` и `.chapters.json` кладутся рядом; заливка ищет главы только
  у mp4 (на jpg `JSON.parse` ронял скрипт — исправлено v1.1.101).
- Ролики видны сразу, рестарт не нужен: список строится из каталога `/data/video`.

## 6. Выпуск

`npm test` (сверить число зелёных сьютов, не exit-код) → докер-прогон на версии
прода → бамп третьего разряда версии → PR в main → деплой → проверить вкладку
«Уроки» модуля и, если трогали клиент, браузерный смоук.
