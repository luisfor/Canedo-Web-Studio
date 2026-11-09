'use strict';
function quote(value, shell) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Argumento de comando inválido.');
  return shell === 'powershell' ? "'" + value.replace(/'/g,"''") + "'" : "'" + value.replace(/'/g,"'\\''") + "'";
}
function invocation(run, shell) {
  const text = [run.executable,...run.args].map(value=>quote(value,shell)).join(' ');
  return (shell === 'powershell' ? '& ' : '') + text;
}
function render(run, shell) {
  if (!['posix','powershell'].includes(shell)) throw new Error('Shell no admitido.');
  return (run.stdinFrom ? invocation(run.stdinFrom,shell) + ' | ' : '') + invocation(run,shell);
}
module.exports = { quote, render };
