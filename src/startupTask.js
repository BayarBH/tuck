'use strict';
// Start at login for the Microsoft Store (MSIX) build. A packaged app can't use a Run-key login item; it
// declares a windows.startupTask in its manifest (TaskId below, see package.json build.appx) and switches it
// with the WinRT StartupTask API. PowerShell runs as our child, so it has the package identity that API needs.
// get() / set() resolve 'on' | 'off' | 'blocked' (turned off in Windows Settings, or by policy) | null (failed).
const { execFile } = require('child_process');

const TASK_ID = 'TuckStartup';

const script = (action) => [
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  "$m = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1",
  'function Wait($op, $t) { $task = $m.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }',
  '$T = [Windows.ApplicationModel.StartupTask, Windows.ApplicationModel, ContentType = WindowsRuntime]',
  `$st = Wait ($T::GetAsync('${TASK_ID}')) $T`,
  action === 'on' ? '$s = Wait ($st.RequestEnableAsync()) ([Windows.ApplicationModel.StartupTaskState])'
    : action === 'off' ? '$st.Disable(); $s = $st.State' : '$s = $st.State',
  'Write-Output ([string]$s)',
].join('; ');

// StartupTaskState: Disabled, DisabledByUser, Enabled, DisabledByPolicy, EnabledByPolicy
function toState(out) {
  const s = String(out || '').trim();
  if (s === 'Enabled' || s === 'EnabledByPolicy') return 'on';
  if (s === 'Disabled') return 'off';
  if (s === 'DisabledByUser' || s === 'DisabledByPolicy') return 'blocked';
  return null;
}

function run(action) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script(action)],
      { windowsHide: true, timeout: 15000 }, (err, stdout) => resolve(err ? null : toState(stdout)));
  });
}

module.exports = { TASK_ID, toState, get: () => run('get'), set: (on) => run(on ? 'on' : 'off') };
