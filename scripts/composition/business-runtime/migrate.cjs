'use strict';
const fs = require('node:fs'), path = require('node:path');
const { open, migrate } = require('../db.cjs');
function migrateBusiness(dataDir) {
  const file = path.join(dataDir, 'communications.sqlite');
  if (fs.existsSync(file)) { const db = open(file); try { if (db.prepare('SELECT MAX(version) AS version FROM kit_extension_schema').get()?.version !== 1) throw Error(); } catch { throw Error('Existing data needs a separately reviewed migration; it is never reset or adopted automatically'); } finally { db.close(); } }
  migrate(dataDir, require('../../modules.json').domains);
}
if (require.main === module) { try { migrateBusiness(path.resolve(process.env.DATA_DIR || 'data')); console.log('Reviewed business schema applied; no seed credentials or provider calls.'); } catch { console.error('Migration blocked: review target, permissions and existing schema. No data was deleted.'); process.exitCode = 1; } }
module.exports = { migrateBusiness };
