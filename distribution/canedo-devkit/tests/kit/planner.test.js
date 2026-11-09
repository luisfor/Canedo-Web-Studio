'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readToolCatalog } = require('../../scripts/tools/catalog');
const { createPlan, validatePlan, canonical, digest } = require('../../scripts/planner/plan');
const manifest = readToolCatalog();
const capabilities = require('../../config/kit-capabilities.json');
const cli = path.resolve(__dirname, '../../scripts/kit.js');
function report(checks = [], platform = 'darwin', managers = [{ id: 'homebrew', status: 'detected', version: null }]) {
  return { schemaVersion: 2, system: { platform, architecture: 'arm64', version: '26.0', release: '25.0', distribution: null }, checks, packageManagers: managers };
}
const missing = tool => ({ tool, status: 'missing', version: null });
const detected = (tool, version) => ({ tool, status: 'detected', version });
const plan = (observation, request, catalog = manifest) => createPlan(catalog, capabilities, observation, request);
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000 });
function withReport(data, callback) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'canedo-plan-'));
  const file = path.join(folder, 'report with spaces.json');
  try { fs.writeFileSync(file, JSON.stringify(data)); callback(file, folder); }
  finally { fs.rmSync(folder, { recursive: true, force: true }); }
}
test('Go ausente genera intención de instalar, nunca ejecución o aprobación', () => {
  const result = plan(report([missing('go')]), { tools: ['go'], versions: { go: '1.27.3' }, manager: 'homebrew' });
  assert.equal(result.items[0].intent, 'install'); assert.equal(result.items[0].selectedProvider, 'homebrew');
  assert.equal(result.executionAllowed, false); assert.equal(result.approval, 'not-requested'); assert.equal(result.status, 'needs-decisions');
  assert.ok(result.decisions.some(i => i.code === 'execution-details-pending'));
  assert.equal(validatePlan(result, manifest, capabilities).ok, true);
});
test('selección compatible existente se reutiliza sin cambios de versión', () => {
  const result = plan(report([detected('node', '24.22.1')]), { tools: ['node'] });
  assert.equal(result.items[0].intent, 'reuse'); assert.equal(result.status, 'reviewable'); assert.equal(result.ok, true); assert.equal(result.executionAllowed, false);
});
test('Node 25 se revisa sin proponer reemplazo automático ni confiar en compatibilidad del reporte', () => {
  const raw = report([{ ...detected('node', '25.2.1'), compatibility: { status: 'compatible', reason: 'untrusted' } }]);
  const result = plan(raw, { tools: ['node'], versions: { node: '24.22.1' } });
  assert.equal(result.items[0].intent, 'review-existing'); assert.equal(result.items[0].current.compatibility.status, 'incompatible');
  assert.equal(result.items[0].ownership, 'pre-existing-or-unknown'); assert.ok(!canonical(result).includes('untrusted'));
});
test('no se declaran reutilizables herramientas sin una regla evaluada', () => {
  const result = plan(report([detected('git', '2.52.0')]), { tools: ['git'] });
  assert.equal(result.items[0].intent, 'review-existing'); assert.equal(result.items[0].current.compatibility.status, 'not-assessed');
});
test('una versión distinta de una instalación compatible requiere revisión', () => {
  const result = plan(report([detected('node', '24.22.1')]), { tools: ['node'], versions: { node: '24.22.0' } });
  assert.equal(result.items[0].intent, 'review-existing');
});
test('resuelve dependencias obligatorias ordenadas y deduplicadas, sin activar opcionales', () => {
  const result = plan(report([missing('go')]), { tools: ['govulncheck', 'go'], exclude: ['git'] });
  assert.deepEqual(result.items.map(i => i.tool), ['go', 'govulncheck']);
  assert.ok(!result.items.some(i => i.tool === 'git' || i.tool === 'golangci-lint'));
  assert.equal(validatePlan(result, manifest, capabilities).ok, true);
});
test('una dependencia obligatoria excluida bloquea el plan', () => {
  const result = plan(report([missing('node'), missing('npm')]), { tools: ['npm'], exclude: ['node'] });
  assert.equal(result.status, 'blocked'); assert.ok(result.blockers.some(b => b.code === 'required-tool-excluded'));
});
test('conflictos entre raíces de la selección se detectan', () => {
  const other = structuredClone(manifest); other.tools.find(t => t.id === 'node').conflicts = ['go'];
  const result = plan(report([missing('node'), missing('go')]), { tools: ['go', 'node'] }, other);
  assert.equal(result.status, 'blocked'); assert.ok(result.blockers.some(b => b.code === 'selected-tools-conflict'));
});
test('Xcode en Windows se bloquea sin tratarlo como instalable', () => {
  const result = plan(report([], 'win32'), { tools: ['xcode'] });
  assert.equal(result.items[0].intent, 'blocked'); assert.ok(result.blockers.some(b => b.code === 'platform-restriction'));
});
test('una versión solicitada fuera de la política bloquea y no se corrige sola', () => {
  const result = plan(report([missing('go')]), { tools: ['go'], versions: { go: '1.25.9' } });
  assert.equal(result.status, 'blocked'); assert.equal(result.items[0].targetVersion, '1.25.9');
  assert.ok(result.blockers.some(b => b.code === 'target-outside-policy'));
});
test('no se inventa una versión exacta ni se asume que exista un artefacto', () => {
  const result = plan(report([missing('go')]), { tools: ['go'] });
  assert.equal(result.items[0].targetVersion, null); assert.ok(result.decisions.some(d => d.code === 'exact-version-required'));
  assert.ok(result.items[0].providerCandidates.every(c => !c.recipeVerified));
});
test('un gestor ausente o no aplicable no se instala ni se sustituye silenciosamente', () => {
  const missingManager = plan(report([missing('go')], 'darwin', [{ id: 'homebrew', status: 'missing', version: null }]), { tools: ['go'], manager: 'homebrew' });
  assert.ok(missingManager.decisions.some(d => d.code === 'provider-not-verified'));
  assert.ok(!missingManager.items.some(i => i.tool === 'homebrew'));
  const wrong = plan(report([missing('go')]), { tools: ['go'], manager: 'npm' });
  assert.equal(wrong.status, 'blocked');
});
test('PostgreSQL servidor obliga a decidir despliegue, sin asumir instalación local', () => {
  const result = plan(report([]), { tools: ['postgresql-server'] });
  assert.equal(result.items[0].intent, 'choose-deployment'); assert.equal(result.items[0].scope, 'undecided');
  assert.ok(!result.items.some(i => i.tool === 'postgresql'));
});
test('paquetes por proyecto se inspeccionan, sin inferir que faltan o instalarlos globalmente', () => {
  const result = plan(report([detected('node', '24.22.1')]), { tools: ['react'], manager: 'npm' });
  const react = result.items.find(i => i.tool === 'react');
  assert.equal(react.intent, 'inspect'); assert.equal(react.scope, 'project'); assert.equal(react.selectedProvider, 'npm');
});
test('un reporte incompleto produce inspección, no una falsa ausencia', () => {
  const result = plan(report([]), { tools: ['go'] });
  assert.equal(result.items[0].intent, 'inspect'); assert.equal(validatePlan(result, manifest, capabilities).ok, true);
});
test('perfil SQL sin motor produce una decisión pendiente', () => {
  const result = plan(report([]), { profile: 'sql' });
  assert.equal(result.status, 'needs-decisions'); assert.equal(result.items.length, 0);
});
test('rechaza solicitudes desconocidas, versiones ambiguas y versiones sin herramienta seleccionada', () => {
  for (const request of [{ tools: ['not-in-catalog'] }, { tools: ['go'], exclude: ['unknown'] }, { tools: ['go'], versions: { go: 'latest' } }, { tools: ['go'], versions: { node: '24.22.1' } }, { tools: ['go'], manager: 'curl' }]) assert.throws(() => plan(report([]), request));
});
test('rechaza estados contradictorios y diagnósticos duplicados', () => {
  assert.throws(() => plan(report([{ tool: 'go', status: 'missing', version: '1.27.3' }]), { tools: ['go'] }), /diagnóstico inválido/);
  assert.throws(() => plan(report([missing('go'), missing('go')]), { tools: ['go'] }), /duplicados/);
});
test('el plan descarta comandos, valores privados y rutas del reporte de entrada', () => {
  const raw = report([{ ...missing('go'), command: 'malicious payload', stderr: 'synthetic-private-value' }]);
  raw.env = { TOKEN: 'synthetic-private-value' }; raw.system.hostname = 'private-host'; raw.privateFile = '/private/user-file';
  const result = plan(raw, { tools: ['go'] }); const text = canonical(result);
  for (const value of ['synthetic-private-value','malicious payload','private-host','/private/user-file']) assert.ok(!text.includes(value));
});
test('huella determinista no depende del orden de selección ni del diagnóstico', () => {
  const a = plan(report([missing('go'), missing('node')]), { tools: ['node','go'] });
  const b = plan(report([missing('node'), missing('go')]), { tools: ['go','node','go'] });
  assert.equal(a.planId, b.planId);
});
test('no muta catálogos, diagnóstico ni elecciones recibidas', () => {
  const raw = report([missing('go')]), request = { tools: ['go'] };
  const before = canonical({ manifest, capabilities, raw, request }); plan(raw, request);
  assert.equal(canonical({ manifest, capabilities, raw, request }), before);
});
test('huellas y validación detectan modificaciones y catálogo obsoleto', () => {
  const result = plan(report([missing('go')]), { tools: ['go'] });
  const changed = structuredClone(result); changed.items[0].intent = 'reuse';
  assert.equal(validatePlan(changed, manifest, capabilities).ok, false);
  const { planId, ...payload } = changed; changed.planId = digest(payload);
  assert.equal(validatePlan(changed, manifest, capabilities).ok, false);
  const other = structuredClone(manifest); other.tools[0].label += ' changed';
  assert.equal(validatePlan(result, other, capabilities).ok, false);
});
test('un plan validado no puede otorgar aprobación ni permitir ejecución', () => {
  const result = plan(report([missing('go')]), { tools: ['go'] });
  for (const changed of [{ ...result, executionAllowed: true }, { ...result, approval: 'approved' }, { ...result, command: 'install anything' }]) assert.equal(validatePlan(changed, manifest, capabilities).ok, false);
  assert.equal(validatePlan(result, manifest, capabilities).environmentRechecked, false);
});
test('CLI crea y valida un plan con reporte local y rutas con espacios', () => {
  withReport(report([missing('go')]), (file, folder) => {
    const result = run('plan','--tool','go','--report',file,'--json'); assert.equal(result.status, 0, result.stderr);
    const saved = path.join(folder, 'plan.json'); fs.writeFileSync(saved, result.stdout);
    const validated = run('plan','validate','--file',saved,'--json'); assert.equal(validated.status, 0, validated.stderr);
    assert.equal(JSON.parse(validated.stdout).environmentRechecked, false);
  });
});
test('CLI no expone apply, yes o flags de instalación', () => {
  for (const args of [['plan','apply'],['plan','--tool','go','--yes'],['plan','--tool','go','--apply'],['plan','--tool','go','--version','go=latest'],['plan','--tool','go','--version','go=1.27.3','--version','go=1.27.2']]) assert.equal(run(...args).status, 1);
});
test('CLI falla ante bloqueos y strict distingue decisiones pendientes', () => {
  withReport(report([missing('go')]), file => {
    assert.equal(run('plan','--tool','go','--exclude','go','--report',file,'--json').status, 1);
    assert.equal(run('plan','--tool','go','--report',file,'--strict','--json').status, 1);
    assert.equal(run('plan','--tool','go','--report',file,'--json').status, 0);
  });
});
test('CLI rechaza JSON inválido sin imprimir el contenido privado', () => {
  withReport({}, file => {
    fs.writeFileSync(file, '{"token":"synthetic-private-value"');
    const result = run('plan','--tool','go','--report',file,'--json');
    assert.equal(result.status, 1); assert.ok(!result.stderr.includes('synthetic-private-value'));
  });
});
