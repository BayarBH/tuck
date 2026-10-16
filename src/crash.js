'use strict';
// Local-only crash reports: Electron/Crashpad minidumps in app.getPath('crashDumps') (<userData>/Crashpad).
// uploadToServer:false means Crashpad never sends anything; there is no submitURL.
const fs = require('fs');
const path = require('path');
const { app, crashReporter } = require('electron');

function start() {
  try { crashReporter.start({ uploadToServer: false, compress: true }); } catch {}
}

// number of minidumps on disk (for the diagnostics summary); never their content
function dumpCount(dir = app.getPath('crashDumps')) {
  let n = 0;
  const walk = (d) => {
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.dmp')) n++;
    }
  };
  walk(dir);
  return n;
}

module.exports = { start, dumpCount };
