'use strict';
const go = require('./go');
const engine = require('./archive-engine');
const { definitions } = require('./archive-recipes');
function choose(plan) {
  const candidates = [
    ...plan.items.filter(i => i.tool === 'go' && i.intent === 'install').map(() => 'go'),
    ...Object.keys(definitions).filter(id => plan.items.some(i => i.tool === id && ['install','review-existing'].includes(i.intent)))
  ];
  if (candidates.length !== 1) throw new Error('Selecciona una herramienta con receta por plan; consulta install coverage para ver las disponibles.');
  return candidates[0];
}
function prepare(plan, destination, manifest, capabilities) {
  if (!plan || !Array.isArray(plan.items)) throw new Error('Plan D inválido.');
  const id = choose(plan);
  return id === 'go' ? go.prepare(plan, destination, manifest, capabilities) : engine.prepare(definitions[id], plan, destination, manifest, capabilities);
}
function known(prepared) {
  if (prepared?.recipe === go.RECIPE) return go;
  if (Object.values(definitions).some(d => d.id === prepared?.recipe)) return engine;
  throw new Error('Receta no reconocida; no se ejecutó el contenido del archivo.');
}
function validatePrepared(prepared, manifest, capabilities) {
  try { return known(prepared).validatePrepared(prepared, manifest, capabilities); }
  catch { return { ok: false, errors: ['Receta no reconocida.'], environmentRechecked: false }; }
}
function apply(prepared) { known(prepared); return require('../commands/policy').execute(); }
function recipes() {
  return { schemaVersion: 2, recipes: [...go.recipes().recipes.map(r => ({ ...r, bundled: [], nativeCertification: 'pending', executionEnabled: false })), ...Object.values(definitions).map(d => ({ id: d.id, tool: d.tool, bundled: d.bundled, provider: 'official-archive', platforms: ['win32','darwin','linux'], architectures: ['x64','arm64'], scope: 'new-directory', elevation: false, requires: ['exact-version','official-checksums','sha256','system-tar','fresh-diagnosis','explicit-approval'], nativeCertification: 'pending', executionEnabled: false }))],
    note: 'Tres formatos de snapshot oficial conservados: Go, Node/npm y Terraform. Su ejecución pública está deshabilitada. Consulta commandRecipes para los adaptadores manuales; no se certifican instalaciones nativas.' };
}
function coverage(manifest) {
  const all = recipes().recipes;
  const tools = manifest.tools.map(tool => {
    const own = all.filter(r => r.tool === tool.id), bundled = all.filter(r => r.bundled?.includes(tool.id));
    return { tool: tool.id, status: own.length ? 'recipe-available' : bundled.length ? 'bundled-only' : 'not-implemented', recipes: [...own,...bundled].map(r => r.id) };
  });
  return { schemaVersion: 1, catalogVersion: manifest.catalogVersion, total: tools.length, recipeAvailable: tools.filter(t => t.status === 'recipe-available').length,
    bundledOnly: tools.filter(t => t.status === 'bundled-only').length, notImplemented: tools.filter(t => t.status === 'not-implemented').length, tools,
    note: 'Cobertura histórica de snapshots de archivos, con ejecución deshabilitada. El campo manual muestra las recetas de comandos; ninguna cifra acredita instalación o certificación nativa.' };
}
module.exports = { prepare, validatePrepared, apply, recipes, coverage, modes: require('../commands/policy').capabilities };
