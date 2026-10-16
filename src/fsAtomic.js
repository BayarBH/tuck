'use strict';
const fs = require('fs');
const path = require('path');

// Write tmp file in the same dir, fsync, rename over the target. A crash leaves either the old or the
// new file, never a half-written one. Windows rename can fail when another process holds the target
// (editor, antivirus, sync client: EPERM/EACCES/EBUSY) or across devices (EXDEV): fall back to a copy.
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, data, null, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    if (!['EXDEV', 'EPERM', 'EACCES', 'EBUSY'].includes(e.code)) { try { fs.unlinkSync(tmp); } catch {} throw e; }
    try { fs.copyFileSync(tmp, file); } finally { try { fs.unlinkSync(tmp); } catch {} }
  }
}

module.exports = { writeFileAtomic };
