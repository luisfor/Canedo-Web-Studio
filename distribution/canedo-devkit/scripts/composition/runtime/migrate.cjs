'use strict';
const path=require('node:path');
const {migrate}=require('./db.cjs'),{domains}=require('../modules.json');
const role=process.env.SERVICE_ROLE||'app';if(!['app','commerce','crm'].includes(role))throw Error('Invalid role');
migrate(path.resolve(process.env.DATA_DIR||'data'),role==='app'?domains:domains.filter(d=>d===(role==='crm'?'communications':'commerce')));
console.log('Reviewed additive schema v1 applied; no seed data or credentials created.');
