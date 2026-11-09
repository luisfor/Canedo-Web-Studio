'use strict';
// Manual and assisted modes share structured proposals, never shell strings as authority.
// No executor is exposed in this release, including for previously approved snapshots.
function capabilities() {
  return { defaultMode: 'manual', modes: { manual: { available: true, executes: false }, assisted: { available: false, executes: false, requires: ['future-executor','fresh-environment','validated-recipe','explicit-approval-of-exact-effects'] } }, executionAllowed: false };
}
function requireManual(mode = 'manual') {
  if (mode !== 'manual') throw new Error('El modo asistido no está habilitado. Solo se generan comandos para revisión manual.');
}
async function execute() { throw new Error('Ejecución deshabilitada en fase E manual. Genera y revisa comandos; --approve no habilita el modo asistido.'); }
module.exports = { capabilities, requireManual, execute };
