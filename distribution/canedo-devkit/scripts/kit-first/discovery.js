'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { digest } = require('../planner/plan');
const root = path.resolve(__dirname, '../..');
const loadedFingerprints=new Map();

function json(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  if (bytes.length > 2 * 1024 * 1024) throw Error('Catálogo demasiado grande.');
  return JSON.parse(bytes);
}

function fingerprint(technicalOnly=false) {
  const entries = [];
  function visit(relative) {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error('El código del kit no puede estar enlazado.');
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(relative + '/' + name);
    } else if (stat.isFile()) {
      if (stat.size > 4 * 1024 * 1024) throw Error('Archivo del kit fuera del límite.');
      entries.push({ path: relative, digest: digest(fs.readFileSync(absolute, 'utf8')) });
    }
  }
  // Binding to generator/policy source prevents stale evidence after a kit update.
  const items=technicalOnly?[
    'package.json','package-lock.json','AGENTS.md','CLAUDE.md','config/kit-capabilities.json',
    'catalog/tools','catalog/install-recipes','catalog/profiles',
    'schemas/kit-first.schema.json','schemas/agent-request.schema.json','schemas/technical-plan.schema.json',
    'schemas/tool-catalog.schema.json','schemas/tool-plan.schema.json','schemas/diagnostic-report.schema.json','schemas/install-recipes.schema.json','schemas/command-plan.schema.json',
    'scripts/kit.js','scripts/kit-first','scripts/tools','scripts/doctor','scripts/planner','scripts/commands',
    'scripts/terminal/technical.js','scripts/terminal/resources.js','scripts/terminal/service.js','scripts/terminal/interpret.js','scripts/devkit.js',
    'scripts/workspace/files.js','scripts/workspace/project.js','scripts/workspace/profiles.js','scripts/workspace/static-validation.js','scripts/agents','scripts/memory','schemas/project-memory.schema.json'
  ]:['package.json', 'package-lock.json', 'AGENTS.md', 'CLAUDE.md', 'config', 'catalog', 'schemas', 'scripts'];
  for (const item of items) visit(item);
  return digest(entries);
}

function discover({technicalOnly=false}={}) {
  const scope=technicalOnly?'technical':'full',currentFingerprint = fingerprint(technicalOnly);
  if (loadedFingerprints.has(scope) && loadedFingerprints.get(scope) !== currentFingerprint) throw Error('El kit cambió en disco; reinicia la interfaz antes de descubrir o generar.');
  loadedFingerprints.set(scope,currentFingerprint);
  const pkg = json('package.json');
  const legacy = json('config/kit-capabilities.json');
  const tools = require('../tools/catalog');
  const toolCatalog = tools.readToolCatalog();
  const toolsReport = tools.validateToolCatalog(toolCatalog, legacy);
  if (!toolsReport.ok) throw Error('Catálogo de herramientas inválido.');
  const recipes = require('../commands/catalog');
  const recipeCatalog = recipes.readRecipes();
  if (!recipes.validateRecipes(recipeCatalog, toolCatalog).ok) throw Error('Recetas inválidas.');
  const registry = technicalOnly ? {status:'not-loaded-for-technical-planning'} : json('catalog/composition/registry.json');
  if (!technicalOnly && !require('../composition/catalog').validate(registry).ok) throw Error('Catálogo de composición inválido.');
  const profiles = require('../workspace/profiles').list();
  const payload = {
    schemaVersion: 1,
    kind: 'kit-discovery',
    kit: { name: pkg.name, version: pkg.version, fingerprint: currentFingerprint },
    catalogs: {
      tools: toolCatalog,
      installationRecipes: recipeCatalog,
      setupProfiles: profiles,
      skills: legacy.skills,
      diagnosticProfiles: legacy.profiles,
      composition: registry,
      generators: technicalOnly ? [] : require('../composition/engine').describeAdapters(),
      commercial: technicalOnly ? {status:'not-loaded-for-technical-planning'} : require('../commercial/catalog').list()
    },
    policy: {
      id: 'kit-first-v1',
      order: ['discover', 'inspect', 'assess-reuse', 'plan', 'validate', 'generate'],
      executionAllowed: false,
      externalCodeImportAllowed: false,
      existingDestinations: 'incremental-plan-required',
      scope: 'agent-api-operations-only'
    }
  };
  return { discoveryId: digest(payload), ...payload };
}

module.exports = { discover };
