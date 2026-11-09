'use strict';
const { normalize } = require('../tools/text');
const Ajv = require('ajv');
const checks={};
function checkSchema(name,value){const check=checks[name]||(checks[name]=new Ajv({allErrors:true}).compile(require('../../schemas/'+name+'.schema.json')));return check(value);}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function vocabulary(extension) {
  const value = JSON.parse(JSON.stringify(require('../../catalog/terminal/vocabulary.json')));
  if (extension) { if (!checkSchema('terminal-vocabulary',extension)) throw Error('Vocabulario fuera de esquema.'); value.entries.push(...extension.entries); }
  if (!checkSchema('terminal-vocabulary',value) || new Set(value.entries.map(e => e.facet + ':' + e.id)).size !== value.entries.length) throw Error('Vocabulario inválido o duplicado.');
  const aliases = new Map();
  for (const e of value.entries) for (const alias of e.aliases) { const key = normalize(alias); if (aliases.has(key) && aliases.get(key) !== e.id) throw Error('Sinónimo ambiguo.'); aliases.set(key, e.id); }
  return value;
}
function local(text, registry, options = {}) {
  require('../kit-first/service').validateRequest({ text });
  let remainder = normalize(text);
  const original = remainder, matched = [], required = new Set(), excluded = new Set();
  const terms = vocabulary(options.vocabulary).entries.flatMap(entry => entry.aliases.map(alias => ({ entry, alias: normalize(alias) }))).sort((a, b) => b.alias.length - a.alias.length);
  for (const { entry, alias } of terms) {
    const expression = new RegExp('(^|[^a-z0-9])(' + escape(alias) + ')(?=$|[^a-z0-9])', 'g');
    remainder = remainder.replace(expression, (match, prefix, word, offset) => {
      const before = remainder.slice(0, offset).split(/[,;.]/).pop();
      const negative = /\bsin\b|\bno (?:quiero|necesito|incluir)\b/.test(before) && !/\bcon\b/.test(before.slice(Math.max(before.lastIndexOf('sin'), before.lastIndexOf('no '))));
      if (negative) for (const id of entry.capabilities) excluded.add(id);
      else { if (!matched.some(e => e.id === entry.id && e.facet === entry.facet)) matched.push(entry); for (const id of entry.capabilities) required.add(id); }
      return prefix + ' ';
    });
  }
  const budgetMatch = /(?:presupuesto(?: de)?\s*)?(\d+(?:\.\d{1,2})?)\s*(usd|cop|eur)\b/i.exec(remainder);
  const budget = { amount: budgetMatch ? Number(budgetMatch[1]) : null, currency: budgetMatch ? budgetMatch[2].toUpperCase() : null, period: /\b(?:mensual|mensuales|al mes)\b/.test(original) ? 'monthly' : /\b(?:anual|anuales|al ano)\b/.test(original) ? 'yearly' : 'unspecified', paidAi: /\bsin (?:ia (?:paga|de pago)|servicios de ia pagos)\b|\bsin depender de (?:una )?ia de pago\b/.test(original) ? 'forbidden' : 'unspecified' };
  if (budgetMatch) remainder = remainder.replace(budgetMatch[0], ' ');
  remainder = remainder.replace(/\bsin (?:ia (?:paga|de pago)|servicios de ia pagos)\b|\bsin depender de (?:una )?ia de pago\b/g, ' ');
  const fillers = 'agregar anadir ampliar mejora mejorar actual plataforma tenga tengan mensual mensuales anual anuales presupuesto maximo maximos al mes ano mediante para'.split(' ');
  for (const word of fillers) remainder = remainder.replace(new RegExp('\\b' + word + '\\b', 'g'), ' ');
  const core = require('../composition/intents').local(remainder, registry);
  for (const id of core.selected) required.add(id); for (const id of core.excluded) excluded.add(id);
  const questions = [], facets = facet => matched.filter(e => e.facet === facet).map(e => e.id).sort();
  if (core.independent && core.modular) questions.push({ id: 'architecture', question: '¿Debe ser monolito modular o servicios independientes?', options: ['Monolito modular', 'Servicios independientes'] });
  const integrations = facets('integration').map(id => ({ id, activation: 'disabled' }));
  if (matched.some(e => e.id === 'omnichannel') && integrations.filter(i => ['whatsapp', 'messenger', 'instagram', 'tiktok'].includes(i.id)).length < 2) questions.push({ id: 'channels', question: '¿Qué canales necesitas en el CRM omnicanal?', options: ['WhatsApp y Facebook Messenger', 'WhatsApp e Instagram', 'WhatsApp, Facebook Messenger e Instagram', 'Incluir TikTok sujeto a acceso autorizado'] });
  if (facets('sector').includes('clinics') && !required.has('appointments')) questions.push({ id: 'clinical-scope', question: '¿El proyecto de clínicas necesita agenda o también gestión clínica?', options: ['Agenda y reservas', 'Gestión clínica: definir datos, permisos y alcance'] });
  if (core.unrecognized.length) questions.push({ id: 'unknown', question: 'Aclara estos requisitos no reconocidos: ' + core.unrecognized.join(', '), options: [] });
  for (const id of excluded) if (required.has(id)) questions.push({ id: 'contradiction-' + id, question: 'Se solicita y excluye la capacidad ' + id + '. ¿Debe incluirse?', options: ['Incluir', 'Excluir'] });
  const security = facets('security');
  return { schemaVersion: 1, provider: 'spanish-terminal-v1', applications: facets('application'), sectors: facets('sector'), capabilities: [...required].sort(), excluded: [...excluded].sort(), languages: core.languages, frameworks: core.frameworks, databases: core.databases, integrations,
    security: { multiUser: security.includes('multi-user') || security.includes('roles') ? true : null, multiTenant: security.includes('multi-tenant') || facets('application').includes('saas') ? true : null, reuseExistingIdentity: true },
    infrastructure: facets('infrastructure'), budget, architecture: core.independent || core.languages.length > 1 ? 'independent-services' : 'modular-monolith', unknown: core.unrecognized, questions };
}
function interpret(text, registry, options = {}) {
  require('../kit-first/service').validateRequest({ text });
  const provider = options.provider;
  if (provider && !options.allowProvider) throw Error('Proveedor externo no autorizado.');
  let result;
  if(provider){
    let response;
    try{response=provider.interpret(text,registry);}catch(e){if(options.usageLedger)options.usageLedger.record({provider:provider.id});throw e;}
    if(provider.usageEnvelope===true){
      if(!response||Object.keys(response).some(k=>!['result','usage'].includes(k))||!response.result){if(options.usageLedger)options.usageLedger.record({provider:provider.id});throw Error('Sobre semántico inválido.');}
      if(options.usageLedger)options.usageLedger.record({provider:provider.id,usage:response.usage||null});result=response.result;
    }else{if(options.usageLedger)options.usageLedger.record({provider:provider.id});result=response;}
  }else result=local(text,registry,options);
  if (!checkSchema('terminal',result)) throw Error('Salida del intérprete fuera de esquema; no puede convertirse en plan.');
  if (provider && result.provider !== provider.id) throw Error('Procedencia del proveedor no coincide.');
  if (/(?:password|contrase[ñn]a|api[_ -]?key|token|secret)\s*[:=]\s*\S|https?:\/\/[^\s/]+:[^\s/]+@/i.test(JSON.stringify(result))) throw Error('El proveedor incluyó datos sensibles.');
  return result;
}
// Technical requests use the same terminal entrypoint without requiring a
// commercial-capability vocabulary. Legacy semantic provider contracts remain.
module.exports = { interpret, local, vocabulary, technical:require('./technical').interpret };
