"use strict";
/* Поддельный микрофон для vm-стендов: getUserMedia + MediaRecorder. Один на все сьюты —
   правка контракта (сигнатура конструктора, onstop) иначе расходилась бы по рукописным
   копиям (stt, update, exam-a1 держали по своей).
   fakeMic({ syncOnstop, syncMedia }):
     syncOnstop — stop() сразу зовёт onstop (как если бы браузер ответил мгновенно);
                  без него onstop тест вызывает сам — так видна асинхронность браузера;
     syncMedia  — getUserMedia отдаёт синхронный thenable (для секций без await).
   Возвращает { navigator, MediaRecorder, recs, tracks, live() }. */
function fakeMic({ syncOnstop = false, syncMedia = false } = {}) {
  const recs = [], tracks = [];
  const stream = () => {
    const tr = { live: true, stop() { this.live = false; } };
    tracks.push(tr);
    return { getTracks: () => [tr] };
  };
  class MediaRecorder {
    constructor(s) { this.stream = s; this.state = "inactive"; recs.push(this); }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; if (syncOnstop && this.onstop) this._p = this.onstop(); }
  }
  const getUserMedia = syncMedia
    ? () => { const s = stream(); return { then(cb) { cb(s); return { catch() {} }; } }; }
    : async () => stream();
  return {
    navigator: { mediaDevices: { getUserMedia, enumerateDevices: async () => [] } },
    MediaRecorder, recs, tracks,
    live: () => tracks.some((tr) => tr.live),   // горит ли ещё хоть одна дорожка микрофона
  };
}

module.exports = { fakeMic };
