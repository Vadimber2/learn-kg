# Источники для refs: проверенные цитаты по кыргызской грамматике

Цитаты ниже сверены дословно с сырым текстом источника (август 2026). Большая
часть уже стоит в `deploy/lesson-m1-script.json`; остальные — заготовки для
следующих уроков грамматики. Источники **урока произношения** (m0) живут прямо
в `deploy/pronunciation-script.json` (Kyrgyz alphabets, Kyrgyz phonology,
фонетический справочник скилла `kyrgyz-tts`) и здесь не дублируются.

Новые утверждения — по той же процедуре: скачать источник, найти строку,
скопировать дословно, указать раздел и дату проверки.

## Как доставать источники (не по памяти!)

```bash
curl -s -G "https://en.wikipedia.org/w/index.php" \
  --data-urlencode "title=Kyrgyz language" --data-urlencode "action=raw" -o src.wiki
curl -s "https://en.wikibooks.org/w/index.php?title=A_Handbook_of_Kyrgyz_Grammar/Simple_Sentences&action=raw"
curl -sL "https://archive.org/download/ERIC_ED461284/ERIC_ED461284_djvu.txt"   # Peace Corps
```
- `Kyrgyz grammar` в Википедии — редирект на `Kyrgyz language#Morphology_and_syntax`.
- Мануал Корпуса мира лежит в OCR-виде: кириллица распознана латиницей
  («-6bi» = «-бы», «3Mec» = «эмес»). Цитировать можно только английские фразы;
  кыргызские формы восстанавливать по смыслу и **отмечать это в `src`**.
- Кыргызская Википедия отвечает на URL-энкоденный `-G --data-urlencode`.

## Wikipedia — Kyrgyz language (разделы Pronouns, Morphology)

| Утверждение | Дословная цитата |
|---|---|
| Восемь личных местоимений; сен/сиз, силер/сиздер | `Kyrgyz has eight personal pronouns:` |
| Вежливое сиз исторически — множественное | `Singular pronouns (with the exception of сиз, which used to be plural) exhibit irregularities, while plural pronouns don't.` |
| Гармония выбирает гласный аффикса | `the vowel in suffixes is decided based on the preceding vowel in the word` |

Таблица `Morphemes indicating person` — копулы: 1 sg `-mIn`, 2 sg informal
`-sIŋ`, 2 sg formal `-sIz`, **3 sg — прочерк** (кросс-валидация «3-е лицо без
окончания»). Заглавные I/A в записи означают гармонический набор гласных.

## Wikibooks — A Handbook of Kyrgyz Grammar / Simple Sentences

| Утверждение | Дословная цитата |
|---|---|
| Связка не нужна: два имени = предложение | `In Kyrgyz (as in many other languages), we don't have to use a verb. Two nouns (both in the nominative) can form a complete sentence, without any word specifically translating the English "is."` |
| Личные окончания только у 1–2 лица | `However, Kyrgyz also uses a number of personal endings to reinforce the relationship of the second noun to the first. These endings appear in the first and second person.` |
| Образец 1 л. | `Мен мугалиммин: “I am a teacher.”` |
| 3 л. без окончания | `Ал мугалим: “(S)he is a teacher.”` |
| Множественность несёт само окончание | `The plural sense is carried by the personal ending alone, so the suffix д←р is unnecessary.` |
| Оглушение б→п после глухого | `The only personal ending that changes its first letter is б→з. If it is added to a noun that ends in a voiceless consonant, the б becomes is voiceless counterpart п.` (опечатка «is» вместо «its» — в оригинале, цитировать как есть) |
| Отрицание именного сказуемого | `These sentences are negated with the particle эмес, which follows the predicate noun. (that is, the second noun in the sentence.)` |
| Окончание переезжает на эмес | `In these cases, the negative particle takes the personal ending.` |
| Пример 3 л. | `Ал мугалим эмес: “(S)he is not a teacher.”` |

Глава «Interrogative words» в этой книге **пуста** (книга готова на 25%) —
вопросительную частицу брать из мануала Корпуса мира.

## Peace Corps Kyrgyz Language Manual (1997), ERIC ED461284

| Утверждение | Дословная цитата |
|---|---|
| Порядок слов в вопросе не меняется | `Kyrgyz use the same sentence structure for statements and questions.` |
| Род не различается | `Depending on the context, the third person pronoun "ал" is translated as "She/he/it"` |

Раздел «Interrogative particle» описывает набор `-бы/-би, -бу/-бү, -пы/-пи,
-пу/-пү` и оглушение после глухих `к, п, с, т, ш, ч` (в OCR — латиницей).
Таблица «Personal pronouns / Endings» даёт четыре гармонических варианта
каждого личного окончания (`-мын/-мин/-мун/-мүн` и т. д.).

## Эмпирика курса (законный источник без внешней цитаты)

Если факт проверяется тестом или вычитанными данными — так и пишем в `src`,
без `quote`; гейт это принимает:
- `эмпирика курса learn.kg: VOCAB_M1 (вычитан носителем)` — фразы примеров;
- `эмпирика курса learn.kg: DRILL_M1 (группа suroo)` — формы вроде
  «оруспу», «студентпи»;
- `эмпирика курса learn.kg: 0 из 1943 слов лексики начинаются на ң` — счётные
  утверждения (в комментарии указывай дату проверки).

Фонетика и орфоэпия (долгота, сингармонизм, ассимиляция, аллофоны к/г) —
`.claude/skills/kyrgyz-tts/references/kyrgyz-phonetics.md` по Жапарову/Сыдыковой
«Азыркы кыргыз тилинин фонетикасы» (Бишкек, 2013); оттуда же взяты записи
белого списка `LESSON_DEMOS` для урока произношения.
