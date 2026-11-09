"use strict";
/* Логгер по контракту autobugfix-детектора CCE (skill logging-standards):
   <ISO ts> [<module-kebab>] <LEVEL>: <стабильное сообщение> {"json":"хвост"}
   - уровень заглавными до текста; переменные данные ТОЛЬКО в JSON-хвосте;
   - стектрейс — сырыми строками сразу после строки-заголовка;
   - секреты/PII в аргументы не передавать. */
function line(level, module, msg, data) {
  let tail = "";
  if (data !== undefined && data !== null) {
    try { tail = " " + JSON.stringify(data); } catch { tail = ' {"logger":"unserializable"}'; }
  }
  return new Date().toISOString() + " [" + module + "] " + level + ": " + msg + tail;
}
module.exports = {
  info(module, msg, data) { console.log(line("INFO", module, msg, data)); },
  warn(module, msg, data) { console.warn(line("WARN", module, msg, data)); },
  debug(module, msg, data) { if (process.env.DEBUG) console.log(line("DEBUG", module, msg, data)); },
  error(module, msg, err, data) {
    console.error(line("ERROR", module, msg, data));
    if (err && err.stack) console.error(err.stack);
  }
};
