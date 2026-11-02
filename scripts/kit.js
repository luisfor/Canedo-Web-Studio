#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/kit-capabilities.json'), 'utf8'));
function parse(args) {
  const options = { command: args.shift() || 'catalog', json: false, strict: false };
  while (args.length) {
    const arg = args.shift();
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--profile' && args.length) options.profile = args.shift();
    else throw new Error(`Opción no válida: ${arg}`);
  }
  if (!['catalog', 'doctor', 'validate'].includes(options.command)) throw new Error('Usa catalog, doctor o validate.');
  if (options.profile && !catalog.profiles.some(p => p.id === options.profile)) throw new Error(`Perfil desconocido: ${options.profile}`);
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
  return { ok: errors.length === 0, skills: catalog.skills.length, profiles: catalog.profiles.length, errors };
}
function doctor(options) {
  const profiles = catalog.profiles.filter(p => !options.profile || p.id === options.profile);
  const tools = [...new Set(profiles.flatMap(p => p.tools))];
  const checks = tools.map(id => {
    const tool = catalog.tools[id];
    const result = spawnSync(tool.command, tool.args, { encoding: 'utf8', timeout: 4000, maxBuffer: 4096, shell: false, windowsHide: true });
    const status = result.error?.code === 'ENOENT' ? 'missing' : result.error || result.status !== 0 ? 'error' : 'detected';
    return { tool: id, status, command: tool.command };
  });
  return { profiles: profiles.map(p => p.id), checks, ok: checks.every(c => c.status === 'detected'), scope: 'Solo detección de CLI. No instala, autentica ni comprueba servicios, SDKs o hardware.' };
}
function main() {
  try {
    const options = parse(process.argv.slice(2));
    let result;
    if (options.command === 'validate') result = validate();
    else if (options.command === 'doctor') result = doctor(options);
    else result = options.profile ? catalog.profiles.find(p => p.id === options.profile) : catalog;
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (options.command === 'catalog') {
      if (options.profile) console.log(`${result.id}: ${result.label}\nSkill: ${result.skill}\nHerramientas a comprobar: ${result.tools.join(', ') || 'ninguna; elegir motor o stack'}`);
      else { console.log('Skills del kit:'); catalog.skills.forEach(s => console.log(`- ${s.id}: ${s.label}`)); console.log('\nPerfiles: ' + catalog.profiles.map(p => p.id).join(', ')); }
    } else if (options.command === 'validate') { console.log(`${result.skills} skills, ${result.profiles} perfiles: ${result.ok ? 'válidos' : 'errores'}`); result.errors.forEach(e => console.error(e)); }
    else { result.checks.forEach(c => console.log(`${c.tool}: ${c.status}`)); console.log(result.scope); }
    if ((options.command === 'validate' || options.strict) && result.ok === false) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
main();
