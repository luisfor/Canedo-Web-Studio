#!/usr/bin/env node
'use strict';
const { controller } = require('./controller');
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
function server(options) {
  const api = controller(options); let phase = 'new', protocol = VERSIONS[0];
  const compact=options.compact===true,view=require('./context'),cap=view.budget(options.maxContextBytes);
  const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  const success = (id, result) => ({ jsonrpc: '2.0', id, result });
  function receive(message) {
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || Object.keys(message).some(k => !['jsonrpc', 'id', 'method', 'params'].includes(k))) return error(null, -32600, 'Solicitud inválida.');
    const hasId = Object.hasOwn(message, 'id');
    if (hasId && !(typeof message.id === 'string' || typeof message.id === 'number' && Number.isFinite(message.id))) return error(null, -32600, 'ID inválido.');
    if (!hasId) { if (message.method === 'notifications/initialized' && phase === 'negotiated') phase = 'ready'; return null; }
    const { id, method, params = {} } = message;
    if (!params || typeof params !== 'object' || Array.isArray(params)) return error(id, -32602, 'Parámetros inválidos.');
    if (method === 'ping') return success(id, {});
    if (method === 'initialize') {
      if (phase !== 'new' || typeof params.protocolVersion !== 'string' || !params.capabilities || typeof params.capabilities !== 'object' || Array.isArray(params.capabilities) || !params.clientInfo || typeof params.clientInfo.name !== 'string' || typeof params.clientInfo.version !== 'string') return error(id, -32602, 'Inicialización inválida.');
      protocol = VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0];
      phase = 'negotiated'; return success(id, { protocolVersion: protocol, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'canedo-devkit', version: require('../../package.json').version }, instructions: 'KIT-FIRST: kit_discover → kit_modules/dependencies → kit_plan → kit_validate → kit_generate. No hay ejecución de comandos. La generación solo está disponible cuando el operador la habilita.' });
    }
    if (phase !== 'ready') return error(id, -32002, 'Completa initialize y notifications/initialized.');
    if (method === 'tools/list') {
      if(!compact&&params.cursor)return error(id,-32602,'Cursor no admitido.');
      let selected=api.tools,nextCursor;
      if(compact){if(params.cursor&&!/^tools:\d+$/.test(params.cursor))return error(id,-32602,'Cursor inválido.');const p=view.page(selected,{cursor:params.cursor?Number(params.cursor.slice(6)):0,limit:5,maxBytes:cap});selected=p.items;if(p.nextCursor!==null)nextCursor='tools:'+p.nextCursor;}
      return success(id,{tools:selected.map(t=>{if(protocol!=='2024-11-05')return t;const {annotations,...legacy}=t;return legacy;}),...(nextCursor?{nextCursor}:{})});
    }
    if (method === 'tools/call') {
      if (!params || typeof params.name !== 'string' || !params.arguments || typeof params.arguments !== 'object' || Array.isArray(params.arguments)) return error(id, -32602, 'Llamada inválida.');
      try { const data = api.call(params.name, params.arguments),progressive=require('./progressive').definitions.some(t=>t.name===params.name),structured=protocol>='2025-06-18';
        const result=success(id,{content:[{type:'text',text:structured&&(compact||progressive)?'Resultado estructurado local en structuredContent.':JSON.stringify(data)}],...(structured?{structuredContent:data}:{}),isError:data.ok===false});
        if(compact||progressive)view.bounded(result,Math.min(params.arguments.maxBytes||cap,cap));return result;
      }
      catch (e) { return success(id, { content: [{ type: 'text', text: 'KIT-FIRST bloqueó la operación: ' + e.message }], isError: true }); }
    }
    return error(id, -32601, 'Método no admitido.');
  }
  return { receive };
}
function main(args) {
  let root, allowGenerate = false,compact=false,maxContextBytes;
  while (args.length) { const arg = args.shift(); if (arg === '--root' && !root && args.length) root = args.shift(); else if (arg === '--allow-generate' && !allowGenerate) allowGenerate = true;else if(arg==='--compact'&&!compact)compact=true;else if(arg==='--max-context-bytes'&&maxContextBytes===undefined&&/^\d+$/.test(args[0]||''))maxContextBytes=Number(args.shift()); else throw Error('Usa --root, --compact y presupuesto opcional.'); }
  const instance = server({ root, allowGenerate,compact,maxContextBytes }); let buffer = '', discarding = false;
  const emit = result => { if (result) process.stdout.write(JSON.stringify(result) + '\n'); };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    buffer += chunk; let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (discarding) { discarding = false; continue; }
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > 2 * 1024 * 1024) { emit({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Mensaje demasiado grande.' } }); continue; }
      let message;try { message = JSON.parse(line); } catch { emit({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON no válido.' } }); continue; }
      try { emit(instance.receive(message)); } catch { emit({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: 'Operación no completada.' } }); }
    }
    if (Buffer.byteLength(buffer) > 2 * 1024 * 1024) { buffer = ''; discarding = true; emit({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Mensaje demasiado grande.' } }); }
  });
  process.stdin.on('error', () => { process.exitCode = 1; });
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch { console.error('No se inicia MCP: verifica raíz autorizada y opciones.'); process.exitCode = 1; } }
module.exports = { server, main };
