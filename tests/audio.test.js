"use strict";
/* Тест playAudio: обычное воспроизведение и замедленное 0.5× на карточках.
   Функция извлекается из собранной страницы и гоняется без DOM на фейковом Audio. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = require("../server/appshell").buildAppHtml();

const reuse = html.match(/\/\* ===REUSE=== \*\/([\s\S]*?)\/\* ===\/REUSE=== \*\//);
assert.ok(reuse, "маркеры ===REUSE=== найдены (homeOf)");
const fn = html.match(/function playAudio\([^)]*\)\{[^\n]*\}/);
assert.ok(fn, "playAudio найдена одной строкой");

const created = [];
class FakeAudio {
  constructor(src) { this.src = src; this.playbackRate = 1; this.played = false; created.push(this); }
  play() { this.played = true; }
}
// AUDIO_FRESH — кэш-бастер свежих правок озвучки: живёт рядом с playAudio
const fresh = html.match(/const AUDIO_FRESH=\{\};[^\n]*/);
assert.ok(fresh, "AUDIO_FRESH найден");
const sb = { console, Audio: FakeAudio };
vm.createContext(sb);
vm.runInContext(reuse[1] + "\n" + fresh[0] + "\n" + fn[0] + "; this.playAudio=playAudio; this.AUDIO_FRESH=AUDIO_FRESH;", sb);

// 1. без параметра — обычная скорость
sb.playAudio("m0_01");
assert.strictEqual(created.length, 1);
assert.strictEqual(created[0].src, "api/audio/m0/m0_01.mp3", "url аудио");
assert.strictEqual(created[0].playbackRate, 1, "по умолчанию 1×");
assert.ok(created[0].played, "play() вызван");

// 2. rate=0.5 — замедленное воспроизведение
sb.playAudio("m1_05", 0.5);
assert.strictEqual(created[1].src, "api/audio/m1/m1_05.mp3");
assert.strictEqual(created[1].playbackRate, 0.5, "замедление 0.5×");
assert.ok(created[1].played);

// 3. свежеперегенерированная запись не залипает в HTTP-кэше (max-age=600):
// после правки озвучки URL несёт кэш-бастер, у нетронутых записей URL прежний
sb.AUDIO_FRESH.m1_05 = 1755000000000;
sb.playAudio("m1_05");
assert.strictEqual(created[2].src, "api/audio/m1/m1_05.mp3?v=1755000000000", "правленая запись — с кэш-бастером");
sb.playAudio("m0_01");
assert.strictEqual(created[3].src, "api/audio/m0/m0_01.mp3", "нетронутая запись — без бастера");
// genTts и uploadAudio обязаны помечать правку — иначе бастер мёртв
assert.ok(/source:"tts"\};AUDIO_FRESH\[id\]=Date\.now\(\)/.test(html), "genTts помечает свежую озвучку");
assert.ok(/source:"upload"\};AUDIO_FRESH\[id\]=Date\.now\(\)/.test(html), "uploadAudio помечает свежую запись");

// 4. пара ▶/0.5× строится хелпером cardAudioBtns и стоит на карточках в обоих режимах.
// Обе кнопки идут через канал fgPlay: тап по ▶ обязан глушить автоозвучку, а не звучать поверх неё.
assert.ok(/fgPlay\(id,\{owner:"cards-manual",rate:0\.5\}\)/.test(html), "кнопка 0.5× внутри cardAudioBtns идёт через канал");
assert.ok(/fgPlay\(id,\{owner:"cards-manual"\}\)/.test(html), "кнопка ▶ внутри cardAudioBtns идёт через канал");
// Шапка карточки одна на оба режима — проверяем, что обе фазы её строят и что в ней есть всё нужное
const cardHead = html.match(/cardHead\(c,mode\)\{[\s\S]*?\n {2}\},/);
assert.ok(cardHead, "Cards.cardHead найден");
const heads = (html.match(/this\.cardHead\(c,/g) || []).length;
assert.strictEqual(heads, 2, "шапку строят обе фазы: узнавание и ввод");
assert.ok(/cardAudioBtns\(c\.id\)/.test(cardHead[0]), "кнопки звука — в шапке карточки");

// 5. автоозвучка: только при включённой настройке и только апрувнутое, через тот же канал,
// с gen-гардом — иначе фраза покинутой карточки звучит поверх следующей.
const auto = html.match(/autoPlay\(id\)\{[\s\S]*?\n {2}\}/);
assert.ok(auto, "Cards.autoPlay найден");
assert.ok(/autoplayOn\(\)&&audioApproved\(id\)/.test(auto[0]), "автоозвучка под тумблером и апрувом");
assert.ok(/fgPlay\(id,\{owner:"cards-auto"\}\)/.test(auto[0]), "автоозвучка через канал");
assert.ok(/g===Cards\.gen/.test(auto[0]), "таймер автоозвучки гасится сменой карточки");
assert.ok(/fgOwner\(\)==="cards-auto"\)fgStop\(\)/.test(html), "переход к следующей карточке глушит автоозвучку");
assert.ok(/function autoplayOn\(\)\{return !!\(ST\.settings&&ST\.settings\.autoplay\);\}/.test(html), "автоозвучка выключена, пока её не включили");

console.log("audio.test.js: OK (playAudio 1×/0.5×, кэш-бастер свежей озвучки, шапка карточки, автоозвучка под тумблером)");
