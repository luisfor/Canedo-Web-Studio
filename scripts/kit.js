#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { diagnose } = require('./doctor/environment');
const toolRegistry = require('./tools/catalog');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/kit-capabilities.json'), 'utf8'));
function parse(args) {
  const options = { command: args.shift() || 'catalog', json: false, strict: false };
  if (options.command === 'install') {
    options.action = args.shift();
    if (!['recipes', 'coverage', 'commands', 'prepare', 'validate', 'apply', 'modes'].includes(options.action)) throw new Error('Usa install commands, recipes, coverage, modes, prepare o validate; apply está deshabilitado.');
  }
  if (options.command === 'plan') {
    options.action = args[0] && !args[0].startsWith('--') ? args.shift() : 'create';
    if (!['create', 'validate'].includes(options.action)) throw new Error('El planificador solo admite create o validate; no existe apply.');
  }
  if (options.command === 'tools') {
    options.action = args[0] && !args[0].startsWith('--') ? args.shift() : 'list';
    if (!['list', 'show', 'dependencies', 'validate'].includes(options.action)) throw new Error('Usa tools list, show, dependencies o validate.');
    if (['show', 'dependencies'].includes(options.action)) {
      options.id = args.shift();
      if (!options.id || !/^[a-z][a-z0-9-]{0,63}$/.test(options.id)) throw new Error('Identificador de herramienta inválido.');
    }
  }
  while (args.length) {
    const arg = args.shift();
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--repository-ready') options.repositoryReady = true;
    else if (arg === '--package-version' && args.length) {
      const match = /^([a-z][a-z0-9-]*)=([0-9][A-Za-z0-9.+:~_-]{0,99})$/.exec(args.shift());
      if (!match || Object.hasOwn(options.packageVersions || {}, match[1])) throw new Error('Versión de paquete inválida o duplicada.');
      (options.packageVersions ||= {})[match[1]] = match[2];
    }
    else if (['--method','--mode','--plan', '--destination', '--approve'].includes(arg) && args.length) {
      const key = arg.slice(2);
      if (options[key] !== undefined) throw new Error('Opción de instalación duplicada.');
      options[key] = args.shift();
    }
    else if (['--exclude', '--manager', '--report', '--file', '--version'].includes(arg) && args.length) {
      const value = args.shift();
      if (arg === '--exclude') (options.exclude ||= []).push(value);
      else if (arg === '--version') {
        const match = /^([a-z][a-z0-9-]{0,63})=(\d+\.\d+\.\d+)$/.exec(value);
        if (!match || Object.hasOwn(options.versions || {}, match[1])) throw new Error('Versión inválida o duplicada; usa --version herramienta=X.Y.Z.');
        (options.versions ||= {})[match[1]] = match[2];
      } else {
        const key = arg.slice(2);
        if (options[key] !== undefined) throw new Error('Opción duplicada: ' + arg);
        options[key] = value;
      }
    }
    else if (arg === '--profile' && args.length) options.profile = args.shift();
    else if (arg === '--kind' && args.length) options.kind = args.shift();
    else if (arg === '--tool' && args.length) (options.tools ||= []).push(args.shift());
    else throw new Error(`Opción no válida: ${arg}`);
  }
  if (!['catalog', 'doctor', 'validate', 'tools', 'plan', 'install'].includes(options.command)) throw new Error('Usa catalog, doctor, validate, tools, plan o install.');
  if (options.profile && !catalog.profiles.some(p => p.id === options.profile)) throw new Error(`Perfil desconocido: ${options.profile}`);
  if (options.tools && !((options.command === 'doctor' && !options.profile) || (options.command === 'plan' && options.action === 'create'))) throw new Error('--tool se usa con doctor (sin perfil) o plan create.');
  if (options.kind && (options.command !== 'tools' || options.action !== 'list')) throw new Error('--kind solo se usa con tools list.');
  if (options.command === 'tools' && options.profile) throw new Error('Usa --kind para filtrar herramientas; --profile corresponde al catálogo de capacidades.');
  const installFlags = ['plan','destination','approve','method','mode','packageVersions','repositoryReady'];
  if (options.command !== 'install' && installFlags.some(k => options[k] !== undefined)) throw new Error('Las opciones de instalación solo se admiten en install.');
  if (options.command === 'install') {
    const allowed = { commands: ['plan','file','method','mode','packageVersions','repositoryReady'], modes: [], recipes: [], coverage: [], prepare: ['plan','destination'], validate: ['file'], apply: ['file','approve'] }[options.action];
    const provided = Object.keys(options).filter(k => !['command','action','json'].includes(k) && options[k] !== false);
    const required = options.action === 'commands' ? [] : allowed;
    if (options.action === 'commands' && (!options.plan && !options.file || options.plan && options.file)) throw new Error('Usa install commands con --plan o --file, no ambos.');
    if (required.some(k => !options[k]) || provided.some(k => !allowed.includes(k))) throw new Error('Opciones incompletas o no admitidas para install ' + options.action + '.');
  }
  const planFlags = ['exclude','versions','manager','report'];
  if (options.file !== undefined && !['plan','install'].includes(options.command)) throw new Error('--file solo se usa con plan validate o install.');
  if (options.command !== 'plan' && planFlags.some(k => options[k] !== undefined)) throw new Error('Las opciones de planificación solo se admiten en plan.');
  if (options.command === 'plan') {
    if (options.action === 'validate' && (!options.file || ['profile','tools','exclude','versions','manager','report'].some(k => options[k] !== undefined))) throw new Error('Usa plan validate --file archivo.json.');
    if (options.action === 'create' && options.file) throw new Error('--file solo se admite en plan validate.');
  }
  return options;
}
function validate() {
  const errors = [];
  const ids = new Set();
  for (const profile of catalog.profiles) {
    if (ids.has(profile.id)) errors.push(`Perfil duplicado: ${profile.id}`);
    ids.add(profile.id);
    if (!catalog.skills.some(s => s.id === profile.skill)) errors.push(`Skill no declarada: ${profile.skill}`);
    for (const tool of profile.tools) if (!catalog.tools[tool]) errors.push(`Herramienta no declarada: ${tool}`);
  }
  for (const skill of catalog.skills) {
    const file = path.join(root, '.agents/skills', skill.id, 'SKILL.md');
    if (!fs.existsSync(file)) { errors.push(`Falta ${skill.id}/SKILL.md`); continue; }
    const text = fs.readFileSync(file, 'utf8');
    const header = /^---\r?\n([\s\S]+?)\r?\n---/.exec(text);
    if (!header || !header[1].includes(`name: ${skill.id}`) || !/\ndescription:\s*\S/.test('\n' + header[1])) errors.push(`Frontmatter no válido: ${skill.id}`);
    for (const match of text.matchAll(/\]\((references\/[^)#]+)(?:#[^)]*)?\)/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      if (!target.startsWith(path.dirname(file) + path.sep) || !fs.existsSync(target)) errors.push(`Referencia ausente o fuera de skill: ${skill.id}/${match[1]}`);
    }
  }
  let toolReport, commandRecipeReport, profileReport;
  try { toolReport = toolRegistry.validateToolCatalog(toolRegistry.readToolCatalog(), catalog); errors.push(...toolReport.errors); }
  catch (error) { errors.push(error.message); }
  try { const recipes = require('./commands/catalog'); commandRecipeReport = recipes.validateRecipes(recipes.readRecipes(), toolRegistry.loadToolCatalog(catalog)); errors.push(...commandRecipeReport.errors); }
  catch (error) { errors.push(error.message); }
  try { profileReport = require('./workspace/profiles').validateCatalog(); } catch (error) { errors.push(error.message); }
  let compositionReport;try{const composition=require('./composition/catalog');compositionReport=composition.validate(composition.read());errors.push(...compositionReport.errors);}catch(error){errors.push(error.message);}
  let commercialReport;try{const commercial=require('./commercial/catalog');commercialReport=commercial.validate(commercial.read());errors.push(...commercialReport.errors);require('./terminal/interpret').vocabulary();}catch(error){errors.push(error.message);}
  return { commercialCatalog:commercialReport||null, compositionCatalog:compositionReport||null, setupProfiles: profileReport || null, commandRecipes: commandRecipeReport || null, ok: errors.length === 0, skills: catalog.skills.length, profiles: catalog.profiles.length, toolCatalog: toolReport || null, errors };
}
function doctor(options) {
  const manifest = toolRegistry.loadToolCatalog(catalog);
  const diagnostics = toolRegistry.doctorCatalog(catalog, manifest);
  if (options.tools?.some(id => !Object.hasOwn(diagnostics.tools, id))) throw new Error('Herramienta desconocida o sin diagnóstico; consulta tools show.');
  return { ...diagnose(diagnostics, options), toolCatalogVersion: manifest.catalogVersion };
}

function plan(options) {
  const planner = require('./planner/plan');
  const manifest = toolRegistry.loadToolCatalog(catalog);
  if (options.action === 'validate') return planner.validatePlan(planner.readJson(options.file), manifest, catalog);
  const request = planner.normalizeRequest(manifest, catalog, options);
  const selection = planner.selectTools(manifest, catalog, request);
  const report = options.report ? planner.readJson(options.report) : diagnose(
    { ...toolRegistry.doctorCatalog(catalog, manifest), profiles: [] },
    { tools: selection.ordered.filter(id => selection.byId.get(id).availability === 'diagnostic') }
  );
  return planner.createPlan(manifest, catalog, report, request, { source: options.report ? 'provided-report' : 'live-doctor' });
}

async function main() {
  if(process.argv[2]==='efficiency')return require('./agents/cli').main(process.argv.slice(3));
  if (['docker','project','profiles','environment','verify','composition','agent','memory','packages'].includes(process.argv[2])) return require('./workspace/cli').main(process.argv.slice(2));
  try {
    const options = parse(process.argv.slice(2));
    let result;
    if (options.command === 'install') {
      const installer = require('./installers');
      const planner = require('./planner/plan');
      const manifest = toolRegistry.loadToolCatalog(catalog);
      if (options.action === 'apply') throw new Error('install apply está deshabilitado en modo manual; --approve no habilita ejecución. Usa install commands.');
      if (options.action === 'modes') result = installer.modes();
      else if (options.action === 'recipes') result = { ...installer.recipes(), commandRecipes: require('./commands/catalog').loadRecipes(manifest), modes: installer.modes() };
      else if (options.action === 'coverage') result = { ...installer.coverage(manifest), manual: require('./commands/catalog').coverage(require('./commands/catalog').loadRecipes(manifest), manifest), modes: installer.modes() };
      else if (options.action === 'commands') {
        const snapshot = options.file ? planner.readJson(options.file) : null;
        const source = snapshot ? snapshot.plan : planner.readJson(options.plan);
        result = require('./commands/plan').generate(source, { ...options, method: options.method || (snapshot ? 'official' : 'auto') }, manifest, catalog, undefined, snapshot);
      }
      else if (options.action === 'prepare') result = await installer.prepare(planner.readJson(options.plan), options.destination, manifest, catalog);
      else if (options.action === 'validate') {
        const saved = planner.readJson(options.file);
        result = saved.schemaVersion === 3 ? require('./commands/plan').validateCommandPlan(saved, manifest, catalog) : installer.validatePrepared(saved, manifest, catalog);
      }
      else result = await installer.apply(planner.readJson(options.file), options.approve, manifest, catalog, message => console.error(message));
    }
    else if (options.command === 'plan') result = plan(options);
    else if (options.command === 'tools') {
      if (options.action === 'validate') result = toolRegistry.validateToolCatalog(toolRegistry.readToolCatalog(), catalog);
      else {
        const manifest = toolRegistry.loadToolCatalog(catalog);
        result = options.action === 'show' ? toolRegistry.selectTool(manifest, options.id) : options.action === 'dependencies' ? toolRegistry.dependencyDetails(manifest, options.id) : toolRegistry.listTools(manifest, options.kind);
      }
    }
    else if (options.command === 'validate') result = validate();
    else if (options.command === 'doctor') result = doctor(options);
    else result = options.profile ? catalog.profiles.find(p => p.id === options.profile) : catalog;
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (options.command === 'install') {
      if (options.action === 'commands') {
        console.log(`Modo manual — ${result.status}. No se ejecutaron comandos.`);
        result.items.forEach(item => console.log(`${item.tool}: ${item.status}; objetivo ${item.targetVersion || 'pendiente'}; método ${item.method || 'pendiente'}; paquete ${item.package || 'pendiente'}; permisos ${item.permissions}; espacio no estimado`));
        result.steps.forEach(step => { console.log(`\n[${step.id}] ${step.stage}${step.requiresSuccessfulSteps.length ? '; requiere éxito de ' + step.requiresSuccessfulSteps.join(', ') : ''}${step.requiresReviewedSteps.length ? '; revisa ' + step.requiresReviewedSteps.join(', ') : ''}`); console.log(step.command); if (step.notes) console.log(step.notes); });
        [...result.blockers, ...result.decisions].forEach(issue => console.log(`${issue.code}: ${issue.message}`));
      } else if (options.action === 'coverage') console.log(`Modo manual: ${result.manual.recipeAvailable} herramientas con recetas de comandos, ${result.manual.bundledOnly} componente incluido, ${result.manual.notImplemented} sin receta. ${result.manual.total} entradas conservadas. Snapshots históricos de archivos: ${result.recipeAvailable}; ejecución deshabilitada.`);
      else console.log(JSON.stringify(result, null, 2));
      if (options.action === 'prepare') console.log('Snapshot de metadatos. Usa install commands --file snapshot.local.json para obtener comandos revisables. apply está deshabilitado.');
      if (options.action === 'commands') console.log(result.instructions);
    }
    else if (options.command === 'plan') {
      if (options.action === 'validate') { console.log(result.ok ? 'Plan válido para revisión; entorno no revalidado.' : 'Plan inválido.'); result.errors.forEach(e => console.error(e)); }
      else {
        console.log(`Plan ${result.planId.slice(0, 12)} — ${result.status}`);
        result.items.forEach(i => console.log(`- ${i.tool}: ${i.intent}; actual ${i.current.version || i.current.status}; objetivo ${i.targetVersion || 'sin seleccionar'}`));
        [...result.blockers, ...result.decisions].forEach(i => console.log(`${i.code}${i.tool ? ' [' + i.tool + ']' : ''}: ${i.message}`));
        console.log(result.note);
      }
    }
    else if (options.command === 'tools') {
      if (options.action === 'list') { console.log(`Catálogo ${result.catalogVersion}: ${result.count} herramientas`); result.tools.forEach(t => console.log(`- ${t.id}: ${t.label} [${t.kind}; ${t.availability}]`)); }
      else if (options.action === 'validate') { console.log(result.ok ? `Catálogo válido: ${result.tools} herramientas` : 'Catálogo inválido'); result.errors.forEach(e => console.error(e)); }
      else console.log(JSON.stringify(result, null, 2));
    }
    else if (options.command === 'catalog') {
      if (options.profile) console.log(`${result.id}: ${result.label}\nSkill: ${result.skill}\nHerramientas a comprobar: ${result.tools.join(', ') || 'ninguna; elegir motor o stack'}`);
      else { console.log('Skills del kit:'); catalog.skills.forEach(s => console.log(`- ${s.id}: ${s.label}`)); console.log('\nPerfiles: ' + catalog.profiles.map(p => p.id).join(', ')); }
    } else if (options.command === 'validate') { console.log(`${result.skills} skills, ${result.profiles} perfiles: ${result.ok ? 'válidos' : 'errores'}`); result.errors.forEach(e => console.error(e)); }
    else {
      console.log(`Sistema: ${result.system.name} ${result.system.version || result.system.release || ''} (${result.system.architecture})`);
      result.checks.forEach(c => console.log(`${c.tool}: ${c.status}${c.version ? ' — ' + c.version : ''} (${c.reason}; compatibilidad: ${c.compatibility.status})`));
      console.log('Gestores encontrados: ' + (result.packageManagers.filter(m => m.status !== 'missing').map(m => m.id).join(', ') || 'ninguno'));
      console.log(result.scope);
    }
    if (options.command === 'install' && result.ok === false) process.exitCode = 1;
    if (options.command === 'plan' && (result.status === 'blocked' || (options.action === 'validate' && !result.ok))) process.exitCode = 1;
    if ((options.command === 'validate' || (options.command === 'tools' && options.action === 'validate') || options.strict) && result.ok === false) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
main();
