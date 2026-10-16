'use strict';
// "Report a problem…": opens a prefilled GitHub issue in the browser, only after the user confirms.
// Nothing is sent automatically. The prefill reuses src/diagnostics.js rows minus anything that holds a
// path (paths contain the Windows user name): never note text, window titles, keys, paths or log lines.
// Users attach the log themselves via "Open log folder".
const path = require('path');

const ISSUES = 'https://github.com/BayarBH/tuck/issues/new';
// rows from diagnostics.collect that may contain personal data
const PRIVATE_ROWS = new Set(['Notes file', 'Log file']);

// any value (e.g. a native-module load error in "Key hook") may embed a path with the user name
const redact = (v) => String(v).replace(/\\\\\?\\\S+|[A-Za-z]:[\\/][^\s'"]*|\\\\[^\s'"]+/g, '<path>');

// rows: [{ label, value }] -> publishable text
function summary(rows, crashDumps) {
  const lines = rows.filter((r) => !PRIVATE_ROWS.has(r.label))
    // a write error is kept only as a bare code (EPERM...): its message may hold a path
    .map((r) => `${r.label}: ${r.label === 'Notes folder writable' && !/^(yes|no: [A-Z]+)$/.test(r.value) ? 'no' : redact(r.value)}`);
  lines.push(`Local crash dumps: ${crashDumps}`);
  return lines.join('\n');
}

function issueUrl(diag) {
  const body = [
    '**What happened?**', '', '', '**What did you expect?**', '', '', '**Steps to reproduce**', '1. ', '',
    '**Diagnostics** (filled in by Tuck, no note text)', '```', diag, '```', '',
    '_If you like, drag tuck.log from the log folder here. It contains errors only, never your notes or keys._',
  ].join('\n');
  return `${ISSUES}?title=&body=${encodeURIComponent(body)}`;
}

function createFeedback(ctx) {
  const { dialog, shell, screen } = require('electron');
  const { collect } = require('./diagnostics');
  const { dumpCount } = require('./crash');

  async function build() {
    let rows = [];
    try {
      rows = await collect({ app: ctx.app, screen, settings: ctx.settings, store: ctx.store, logger: ctx.logger, status: ctx.status });
    } catch (e) {
      ctx.logger.error('feedback', e);
      rows = [{ label: 'Tuck', value: ctx.app.getVersion() }, { label: 'Electron', value: process.versions.electron }];
    }
    let dumps = '?';
    try { dumps = dumpCount(); } catch {}
    return summary(rows, dumps);
  }

  return {
    async openReport() {
      const diag = await build();
      const { response } = await dialog.showMessageBox({
        type: 'question',
        title: 'Report a problem',
        message: 'Open a GitHub issue in your browser?',
        detail: 'Tuck will open a new-issue page prefilled with the details below. Nothing is sent until you ' +
          'press Submit on GitHub yourself, and you can edit or delete anything first.\n\n' + diag +
          '\n\nNo note text, window titles, keys or file paths are included. To attach the log, use "Open log folder".',
        buttons: ['Open GitHub', 'Open log folder', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      if (response === 0) {
        ctx.logger.info('feedback', 'issue page opened');
        await shell.openExternal(issueUrl(diag));
      } else if (response === 1) {
        const err = await shell.openPath(path.dirname(ctx.logger.file));
        if (err) ctx.logger.warn('feedback', 'open log folder failed: ' + err);
      }
    },
  };
}

module.exports = { createFeedback, summary, issueUrl };
