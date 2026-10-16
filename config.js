const path = require('path'), os = require('os');

module.exports = {
  LONG_PRESS_MS: 600,
  DOUBLE_GAP_MS: 1000,
  DEDUPE_MS: 3000,
  CLIPBOARD_DELAY_MS: 120,
  // ZHAILU_NOTES_DIR is for tests/E2E only, so they never touch the real notes file
  NOTES_DIR: process.env.ZHAILU_NOTES_DIR || path.join(os.homedir(), 'Documents', 'Excerpts'),
  NOTES_FILE: 'excerpts.md',
  BAR_WIDTH: 360,
  BAR_HEIGHT: 44,
  BAR_BOTTOM: 48,
  BAR_MAX_LINES: 4,
  CAPSULE_CHARS: 20,
};
