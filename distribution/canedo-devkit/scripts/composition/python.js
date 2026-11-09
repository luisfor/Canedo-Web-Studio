'use strict';
const fs = require('node:fs'), path = require('node:path');
const contracts = require('./contracts');
function files(design) {
  const version = design.request.runtimeVersions?.python || '3.14.4';
  require('../workspace/project').normalize({ stack: 'python', version });
  const provider = design.intent.databases.includes('json-file') ? 'json-file' : 'sqlite';
  if (design.intent.databases.length > 1) throw Error('Selecciona un único proveedor de persistencia por inventario.');
  const result = [], add = (path, content) => result.push({ path, content, mode: 0o644 }), json = (path, value) => add(path, JSON.stringify(value, null, 2) + '\n');
  add('.python-version', version + '\n');
  add('pyproject.toml', `[project]\nname = "${design.request.name}"\nversion = "0.1.0"\nrequires-python = "==${version}"\ndependencies = []\n`);
  json('modules.json', { schemaVersion: 1, architecture: 'modular-monolith', capabilities: design.capabilities, domains: design.domains, persistence: { provider }, externalProvidersEnabled: false });
  json('contracts/openapi.json', contracts.document(design.capabilities)); add('contracts/interfaces.d.ts', contracts.interfaces());
  for (const capability of design.capabilities) json('modules/' + capability + '/module.json', { id: capability, version: '1.0.0', domain: 'commerce', language: 'python', persistence: provider });
  for (const [source, target] of [['inventory.py', 'inventory.py'], ['server.py', 'server.py'], ['migrate.py', 'migrate.py'], ['001.sql', 'migrations/001.sql'], ['test_inventory.py', 'tests/test_inventory.py']]) add(target, fs.readFileSync(path.join(__dirname, 'python-runtime', source), 'utf8'));
  json('PROVENANCE.json', { codeOrigin: 'original-kit-generated', importedExternalCode: false, references: design.references.filter(r => r.matchedCapabilities.length), catalogDigest: design.catalogDigest });
  add('.gitignore', '.env\n.env.*\n!.env.example\nsecrets/*\n!secrets/README.md\ndata/\n__pycache__/\n*.pyc\n');
  add('.env.example', 'HOST=127.0.0.1\nPORT=8080\nDATA_DIR=./data\nAUTH_TOKENS_FILE=./secrets/tenant-tokens.json\n');
  add('secrets/README.md', '# Local credentials\n\nCreate tenant-tokens.json locally as an object mapping each tenant ID to a distinct random token of at least 32 characters. No token is supplied. Keep it private. For Docker, the intended non-root UID must be able to read the mount.\n');
  add('README.md', `# ${design.request.name}\n\nOriginal functional products/inventory API in Python ${version}, using ${provider}. Standard library only; no pip install or virtualenv is needed for these generated sources. The kit does not install or select Python globally. No CRM, sales, cash, real providers or paid AI are included in this adapter.\n\n1. Review contracts/openapi.json and migrations/001.sql.\n2. Run python3 -m unittest discover -s tests -v (temporary databases and real localhost HTTP; no external service).\n3. Create the credential file described in secrets/README.md.\n4. Explicitly run python3 migrate.py for the intended DATA_DIR. Existing unknown data is rejected, never reset.\n5. Run python3 server.py (loopback default). Use the matching Python command on your OS.\n\n.env.example is documentation, not automatically loaded. Public operations require tenant-scoped Bearer credentials and X-Tenant-Id. Writes need Idempotency-Key and JSON. Inputs/responses follow the generated contract. Lists are limited to 1000 products. Schema v1 supports products and positive stock receipts, not warehouses, transfers, accounting or a full POS.\n\nSQLite uses parameterized statements and transactional receipts. JSON-file is a bounded local alternative (16 MiB), atomic replacement and cooperative directory locks; a stale lock after a crash requires manual review, not automatic deletion. It is not a distributed database. Do not switch providers to migrate existing data; choose a reviewed migration project.\n\nDocker files, when selected, are reviewable configurations only. No image availability, build or container has been verified by generating them. Secrets are external; no ports are published. Review/pin images before any separately authorized build/pull/up.\n`);
  add('ARCHITECTURE.md', '# Architecture\n\n' + design.justification + '\n\nPersistence: ' + provider + '. Tenant isolation and idempotency are applied at the API/domain boundary. The SQLite and JSON-file implementations share the same domain operations and contract. This adapter is intentionally limited to inventory; no language migration is forced for other modules. External projects are architectural references only, with no imported code.\n');
  if (design.request.docker) {
    const base = require('../docker/generate').plan({ name: design.request.name, services: [], backend: 'python', version, images: { runtime: 'python:' + version + '-alpine' } });
    const service = base.compose.services.backend;
    json('compose.yaml', { name: design.request.name, services: { inventory: { ...service, networks: ['private'], environment: { HOST: '0.0.0.0', PORT: '8080', DATA_DIR: '/app/data', AUTH_TOKENS_FILE: '/run/secrets/tenant_tokens' }, volumes: ['inventory_data:/app/data'], secrets: ['tenant_tokens'] } }, networks: { private: { internal: true } }, volumes: { inventory_data: {} }, secrets: { tenant_tokens: { file: './secrets/tenant-tokens.json' } } });
    add('Dockerfile', `FROM python:${version}-alpine\nWORKDIR /app\nRUN mkdir -p /app/data && chown -R 10001:10001 /app\nCOPY --chown=10001:10001 *.py modules.json ./\nCOPY --chown=10001:10001 migrations ./migrations\nCOPY --chown=10001:10001 contracts ./contracts\nUSER 10001:10001\nENV PYTHONDONTWRITEBYTECODE=1 HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/data\nEXPOSE 8080\nCMD ["python3","server.py"]\n`);
    add('.dockerignore', base.files.find(f => f.path === '.dockerignore').content + 'data\n**/*.sqlite*\n__pycache__\n');
  }
  return result;
}
function commands() {
  const { render } = require('../commands/render');
  return [['--version'], ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], ['migrate.py'], ['server.py']].map(args => { const run = { executable: 'python3', args, stdinFrom: null }; return { run, posix: render(run, 'posix'), powershell: render(run, 'powershell'), notes: 'Manual only. Use the matching Python executable on your platform; no interpreter or dependency is installed.' }; });
}
module.exports = { files, commands, languages: ['python'], frameworks: [], databases: ['sqlite', 'json-file'], domains: ['commerce'], capabilities: ['products', 'inventory'], testInstruction: 'Run generated Python unittest scenarios with isolated SQLite and JSON-file stores and real localhost HTTP.', architectureDecision: () => 'A single modular inventory service is sufficient. Python standard-library domain logic is independent of the selected SQLite or local JSON-file repository; no broker or external service is required.' };
