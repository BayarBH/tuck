'use strict';
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

// Local log file only. PRIVACY: callers must never pass note text, clipboard content, window titles or keys.
// Never throws: logging must not be able to break capture.
function createLogger({ dir }) {
  const file = path.join(dir, 'tuck.log');
  const oneLine = (s) => String(s).replace(/\r?\n/g, ' | ');

  function write(level, scope, msg) {
    const line = `${new Date().toISOString()} ${level} [${oneLine(scope)}] ${msg}\n`;
    if (level !== 'INFO') { try { process.stderr.write(line); } catch {} }
    try {
      fs.mkdirSync(dir, { recursive: true });
      let size = 0;
      try { size = fs.statSync(file).size; } catch {}
      if (size >= MAX_BYTES) fs.renameSync(file, file + '.1');
      fs.appendFileSync(file, line, 'utf8');
    } catch {}
  }

  return {
    file,
    error(scope, err) {
      const msg = err instanceof Error ? oneLine(err.message) + (err.stack ? '\n    ' + err.stack.split('\n').slice(1).map((l) => l.trim()).join('\n    ') : '') : oneLine(err);
      write('ERROR', scope, msg);
    },
    warn: (scope, msg) => write('WARN', scope, oneLine(msg)),
    info: (scope, msg) => write('INFO', scope, oneLine(msg)),
  };
}

module.exports = { createLogger };
