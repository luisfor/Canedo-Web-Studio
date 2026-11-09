'use strict';
const { randomBytes, timingSafeEqual } = require('node:crypto');
const ROLES = ['admin', 'manager', 'agent', 'viewer'];
const ID = /^[A-Za-z0-9_-]{1,80}$/;
function identity(actors, db) {
  if (!Array.isArray(actors) || !actors.length || actors.length > 1000 || actors.some(a => !a || Object.keys(a).some(k => !['tenantId', 'actorId', 'role', 'token','platformAdmin'].includes(k)) || a.platformAdmin!==undefined&&(typeof a.platformAdmin!=='boolean'||a.platformAdmin&&a.role!=='admin') || !ID.test(a.tenantId) || !ID.test(a.actorId) || !ROLES.includes(a.role) || typeof a.token !== 'string' || !/^[!-~]{32,500}$/.test(a.token)) || new Set(actors.map(a => a.token)).size !== actors.length || new Set(actors.map(a => a.tenantId + ':' + a.actorId)).size !== actors.length) throw Error('Configure distinct actor-scoped credentials and roles');
  const internal = Object.fromEntries([...new Set(actors.map(a => a.tenantId))].map(id => [id, randomBytes(32).toString('hex')]));
  function authenticate(headers) {
    const authorization = headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
    const value = Buffer.from(authorization.slice(7));
    const actor = actors.find(a => { const expected = Buffer.from(a.token); return expected.length === value.length && timingSafeEqual(value, expected); });
    if (!actor || headers['x-tenant-id'] !== actor.tenantId) return null;
    const override = db.prepare('SELECT role FROM member_role WHERE tenant_id=? AND actor_id=?').get(actor.tenantId, actor.actorId);
    return { tenantId: actor.tenantId, actorId: actor.actorId, role: override?.role || actor.role,platformAdmin:actor.platformAdmin===true };
  }
  function members(tenant) { return actors.filter(a => a.tenantId === tenant).map(a => ({ actorId: a.actorId, role: db.prepare('SELECT role FROM member_role WHERE tenant_id=? AND actor_id=?').get(tenant, a.actorId)?.role || a.role })); }
  function authorize(principal, method, route) {
    if (principal.role === 'admin') return true;
    if (method === 'GET') return true;
    if (/^\/(?:iam|saas|system)\//.test(route)) return false;
    if (principal.role === 'manager') return true;
    return principal.role === 'agent' && /^\/(?:crm|agenda)\//.test(route) && !route.startsWith('/crm/automation/');
  }
  return { authenticate, authorize, members, internal };
}
module.exports = { identity, ROLES };
