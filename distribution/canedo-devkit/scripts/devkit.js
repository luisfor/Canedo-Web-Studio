#!/usr/bin/env node
'use strict';
const path = require('node:path');
const io = require('./workspace/files');
const terminal = require('./terminal/service');
function parse(args) {
  const action = args.shift();
  if (!['plan', 'create', 'enhance', 'inspect'].includes(action)) throw Error('Usa plan, create, enhance o inspect. Los comandos kit:* existentes se conservan.');
  const options = {}; let text;
  while (args.length) {
    const item = args.shift();
    if (item === '--json') { if (options.json) throw Error('Opción duplicada.'); options.json = true; }
    else if(item==='--technical'){if(options.technical||action!=='plan')throw Error('--technical solo se admite una vez en plan.');options.technical=true;}
    else if(item==='--diagnose'){if(options.diagnose||action!=='plan')throw Error('--diagnose solo se admite una vez en plan.');options.diagnose=true;}
    else if(item==='--version'){const value=args.shift(),match=value&&/^([a-z][a-z0-9-]{0,63})=(\d+\.\d+\.\d+)$/.exec(value);if(action!=='plan'||!match||Object.hasOwn(options.versions||{},match[1]))throw Error('Usa --version herramienta=X.Y.Z sin duplicados.');(options.versions||={})[match[1]]=match[2];}
    else if(['--manager','--report'].includes(item)){const key=item.slice(2);if(action!=='plan'||options[key]!==undefined||!args.length||args[0].startsWith('--'))throw Error('Opción de planificación duplicada o incompleta.');options[key]=args.shift();}
    else if (['--out', '--project', '--file'].includes(item)) { const key = item.slice(2); if (options[key] !== undefined || !args.length || args[0].startsWith('--')) throw Error('Opción duplicada o incompleta.'); options[key] = args.shift(); }
    else if (!item.startsWith('--') && text === undefined) text = item;
    else throw Error('Argumento no admitido; escribe la solicitud entre comillas.');
  }
  if (options.out && options.project || options.file && text !== undefined || action === 'inspect' && (text || options.file || options.out) || action === 'enhance' && (options.out || options.file) || action === 'create' && options.project || action === 'plan' && options.file) throw Error('Opciones no compatibles con la operación.');
  if (action !== 'inspect' && !text && !options.file) throw Error('Se requiere una solicitud.');
  if(options.diagnose&&options.report)throw Error('--diagnose y --report son excluyentes.');
  return { action, options, text };
}
function dispatch({ action, options, text }, cwd = process.cwd()) {
  if (action === 'inspect') return require('./kit-first/service').discover({ destination: path.resolve(cwd, options.project || '.'), agent: 'codex-cli-json' });
  const destination = path.resolve(cwd, options.out || options.project || (action === 'enhance' ? '.' : 'devkit-project'));
  if (action === 'create' && options.file && !options.out) throw Error('Indica --out con el destino vinculado al plan.');
  const resourceOptions={...(options.versions?{versions:options.versions}:{}),...(options.manager?{manager:options.manager}:{}),...(options.report?{report:io.readJson(options.report)}:{})};
  const value = options.file ? io.readJson(options.file) : terminal.prepare(text, { destination, action, explicitDestination: !!options.out,technicalOnly:options.technical===true,resourceOptions,diagnose:options.diagnose===true });
  if (action === 'create' && value.ok) return { ...terminal.create(value, destination), preparedPlanId: value.planId };
  return value;
}
function main(args) { try { const result = dispatch(parse([...args])); console.log(JSON.stringify(result, null, 2)); if (result.ok === false) process.exitCode = 1; } catch (e) { console.error(e.message); process.exitCode = 1; } }
if (require.main === module) main(process.argv.slice(2));
module.exports = { parse, dispatch, main };
