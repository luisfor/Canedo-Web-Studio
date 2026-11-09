'use strict';
const fs = require('node:fs');
const path = require('node:path');
const io = require('../workspace/files');
const { digest } = require('../planner/plan');

const OMIT = new Set(['.git', '.hg', '.svn', 'node_modules', '.venv', 'venv', 'vendor', 'target', 'dist', 'build', '.next', '__pycache__', '.aws', '.ssh', '.codex', 'secrets','secretos', 'credentials', 'cazas', 'data', 'uploads', 'logs', 'backups', '.cache','.devkit-cache','.wrangler','.pytest_cache','.mypy_cache','.ruff_cache','.gradle','.dart_tool','coverage']);
const TEXT = /\.(?:[cm]?js|jsx|tsx?|json|php|py|go|mod|sum|java|gradle|kts?|swift|dart|cs|csproj|fsproj|sln|rs|c|cpp|h|hpp|sql|xml|toml|ya?ml|md|txt|lock|html|css|sh|ps1)$/i;
const RECORDS = new Set(['devkit.project.json', 'devkit.compose.json', 'devkit.composition.json', '.devkit/project.json']);
const FRAMEWORKS = { next: 'nextjs', react: 'react', vue: 'vue', '@angular/core': 'angular', '@nestjs/core': 'nestjs', express: 'express', 'laravel/framework': 'laravel', django: 'django', fastapi: 'fastapi' };

function sensitive(name) {
  return /^\.env(?:\.|$)/i.test(name) || /(?:^|[-_.])(?:secret|token|password|credential|private[-_]?key)s?(?:[-_.]|$)/i.test(name) || /\.(?:pem|key|p12|pfx|sqlite(?:3)?|db)(?:[-.]|$)/i.test(name) || name.endsWith('.local.json');
}

function checkRoot(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target) || target !== path.normalize(target) || /[\x00-\x1f\x7f]/.test(target)) throw Error('Usa un destino absoluto normalizado.');
  let cursor = target;
  while (true) {
    try { const st = fs.lstatSync(cursor); if (st.isSymbolicLink() || !st.isDirectory()) throw Error('Destino o padre no es un directorio seguro.'); }
    catch (error) { if (error.code !== 'ENOENT' || cursor !== target) throw error; }
    const next = path.dirname(cursor);
    if (next === cursor) break;
    cursor = next;
  }
}

function inspect(target,options={}) { return analyze(target,options).inspection; }
function analyze(target,{cache='off',full=false}={}) {
  checkRoot(target);
  const metrics={filesRead:0,bytesRead:0,filesAnalyzed:0,analysisReused:0,excludedEntries:0,full:full===true};
  const store=require('./cache').open(target,full?'off':cache);
  const namespace=digest([fs.readFileSync(__filename,'utf8'),fs.readFileSync(path.join(__dirname,'cache.js'),'utf8'),process.version,process.platform,process.arch]);
  const targetId = digest(target);
  const exists = fs.existsSync(target);
  if (!exists) {
    io.parentForNew(target);
    const payload = { schemaVersion: 1, kind: 'project-inspection', targetId, scenario: 'new', files: [], signals: [], records: [], limitations: [], complete: true, executesProjectCode: false };
    return {inspection:{ inspectionId: digest(payload), ...payload },metrics};
  }
  const files = [], signals = [], records = [], limitations = [];
  let visited = 0, bytesRead = 0, complete = true;
  const add = (category, id, evidence, certainty) => {
    if (!signals.some(s => s.category === category && s.id === id && s.evidence === evidence)) signals.push({ category, id, evidence, certainty });
  };
  function analyzeFile(relative, content) {
    const name = path.basename(relative);
    if (RECORDS.has(relative)) records.push(relative);
    if (name === 'package.json' || name === 'composer.json') {
      try {
        const value = JSON.parse(content);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
        for (const key of ['dependencies', 'devDependencies', 'require']) if (value[key] !== undefined && (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key]))) throw Error();
        const dependencies = { ...value.dependencies, ...value.devDependencies, ...value.require };
        if (name === 'package.json') add('language', 'javascript', relative, 'declared');
        else add('language', 'php', relative, 'declared');
        for (const [dep, id] of Object.entries(FRAMEWORKS)) if (Object.hasOwn(dependencies, dep)) add('framework', id, relative, 'declared');
        for (const dependency of Object.keys(dependencies)) {
          if (/^(?:better-auth|next-auth|@auth\/|passport|laravel\/sanctum|laravel\/passport)/.test(dependency)) add('component', 'authentication', relative, 'declared');
          if (/^(?:prisma|@prisma\/client|drizzle-orm|pg|postgres|mysql2|sequelize|typeorm)$/.test(dependency)) add('component', 'persistence', relative, 'declared');
          if (['pg', 'postgres', 'mysql2'].includes(dependency)) add('database', dependency === 'mysql2' ? 'mysql' : 'postgresql', relative, 'declared');
        }
      } catch { complete = false; limitations.push({ code: 'invalid-manifest', path: relative }); }
    }
    if (relative === 'modules.json') {
      try {
        const value = JSON.parse(content);
        if (!Array.isArray(value.capabilities) || value.capabilities.some(c => typeof c !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(c))) throw Error();
        for (const id of value.capabilities) add('capability', id, relative, 'declared');
        if (typeof value.persistence?.provider === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value.persistence.provider)) add('database', value.persistence.provider, relative, 'declared');
      } catch { complete = false; limitations.push({ code: 'invalid-module-manifest', path: relative }); }
    }
    if(/^(?:requirements\.txt|pyproject\.toml)$/.test(name)){
      for(const id of ['fastapi','django','flask'])if(new RegExp('(?:^|[\\s"\\\'])'+id+'(?:[\\s"\\\'[<>=!~]|$)','im').test(content))add('framework',id,relative,'declared');
    }
    const languages = { '.js': 'javascript', '.jsx': 'javascript', '.cjs': 'javascript', '.mjs': 'javascript', '.go': 'go', '.py': 'python', '.php': 'php', '.java': 'java', '.cs': 'csharp', '.rs': 'rust', '.ts': 'typescript', '.tsx': 'typescript','.c':'c','.cpp':'cpp','.h':'c','.hpp':'cpp','.kt':'kotlin','.swift':'swift','.dart':'dart' };
    const language = languages[path.extname(name)];
    if (language) add('language', language, relative, 'observed-file');
    for (const [pattern, id] of [[/^go\.mod$/, 'go'], [/^(?:pyproject\.toml|requirements\.txt|\.python-version)$/, 'python'], [/^(?:pom\.xml|build\.gradle(?:\.kts)?)$/, 'java'], [/\.(?:csproj|fsproj)$/, 'csharp'], [/^Cargo\.toml$/, 'rust']]) if (pattern.test(name)) add('language', id, relative, 'declared');
    if (/\.sql$/i.test(name) && /CREATE\s+TABLE/i.test(content)) add('component', 'persistence', relative, 'inferred');
    if (/^(?:compose\.ya?ml|docker-compose\.ya?ml|Dockerfile)$/.test(name)) add('component', 'containers', relative, 'observed-file');
    if (/\.(?:[cm]?js|tsx?|php|py|go|cs|java)$/.test(name)) {
      if (/createServer\s*\(|(?:app|router)\.(?:get|post|put|delete)\s*\(|@(?:Get|Post|RequestMapping)|Route::|FastAPI\s*\(/.test(content)) add('component', 'api', relative, 'inferred');
      if (/\b(?:authenticate|authorize|authorization|bearer|session|login|sanctum|OIDC)\b/i.test(content)) add('component', 'authentication', relative, 'inferred');
      if (/node:sqlite|\b(?:DatabaseSync|DbContext|SQLAlchemy|mongoose)\b/.test(content)) add('component', 'persistence', relative, 'inferred');
      if (/node:sqlite|\bimport sqlite3\b/.test(content)) add('database', 'sqlite', relative, 'inferred');
    }
  }
  function walk(relative) {
    for (const entry of fs.readdirSync(path.join(target, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (++visited > 5000) { complete = false; limitations.push({ code: 'entry-limit', path: relative || '.' }); return; }
      const rel = relative ? relative + '/' + entry.name : entry.name;
      if (relative === '.devkit' && ['operations', '.write-lock','revisions'].includes(entry.name)) continue;
      if (OMIT.has(entry.name) || sensitive(entry.name)) {metrics.excludedEntries++;continue;}
      const absolute = path.join(target, rel), stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) { complete = false; limitations.push({ code: 'link-not-followed', path: rel }); continue; }
      if (stat.isDirectory()) { walk(rel); continue; }
      if (!stat.isFile() || !(TEXT.test(entry.name) || /^(Dockerfile|\.gitignore|\.(?:node|go|java|python)-version|\.nvmrc)$/.test(entry.name))) continue;
      if (stat.size > 1024 * 1024 || bytesRead + stat.size > 16 * 1024 * 1024) { complete = false; limitations.push({ code: 'size-limit', path: rel }); continue; }
      const fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      let content;
      try {
        const before = fs.fstatSync(fd);
        if (!before.isFile() || before.size > 1024 * 1024 || bytesRead + before.size > 16 * 1024 * 1024) { complete = false; limitations.push({ code: 'size-limit', path: rel }); continue; }
        const buffer = Buffer.alloc(before.size + 1), length = fs.readSync(fd, buffer, 0, buffer.length, 0), after = fs.fstatSync(fd);
        if (before.size !== length || before.size !== after.size || before.mtimeMs !== after.mtimeMs) { complete = false; limitations.push({ code: 'file-changed-during-inspection', path: rel }); continue; }
        content = buffer.subarray(0, length).toString('utf8'); bytesRead += length;
      } finally { fs.closeSync(fd); }
      metrics.filesRead++;metrics.bytesRead+=Buffer.byteLength(content);
      const hash=digest(content),key=digest([namespace,targetId,rel,hash]);files.push({ path: rel, digest: hash });
      const cached=rel==='modules.json'?null:store.get(key);
      if(cached){metrics.analysisReused++;for(const s of cached.signals)add(s.category,s.id,rel,s.certainty);if(cached.record)records.push(rel);for(const code of cached.limitations){complete=false;limitations.push({code,path:rel});}}
      else{metrics.filesAnalyzed++;const start=signals.length,errors=limitations.length,rec=records.length;analyzeFile(rel,content);if(rel!=='modules.json')store.put(key,{signals:signals.slice(start).map(({evidence,...s})=>s),limitations:limitations.slice(errors).map(l=>l.code),record:records.length>rec});}
    }
  }
  walk('');
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  signals.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  records.sort();
  const payload = { schemaVersion: 1, kind: 'project-inspection', targetId, scenario: records.length ? 'previously-generated' : 'existing', files, signals, records, limitations, complete, executesProjectCode: false };
  return {inspection:{ inspectionId: digest(payload), ...payload },metrics};
}

module.exports = { inspect, analyze, sensitive,checkRoot };
