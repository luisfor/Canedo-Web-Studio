'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('integral KIT-FIRST acceptance executes A–I and Spanish SaaS store, records truthful local verification',()=>{
 const report=require('../../scripts/composition/acceptance').verify();assert.equal(report.ok,true,JSON.stringify(report));assert.equal(report.checks.length,10);assert.ok(report.totalTests>=51);assert.equal(report.executedTests+report.notExercisedTests,report.totalTests);assert.ok(report.notExercisedTests>0);assert.ok(report.executedTests<report.totalTests);assert.equal(report.liveProvidersVerified,false);assert.equal(report.dependenciesInstalled,false);assert.equal(report.dockerExecuted,false);assert.ok(report.checks.every(c=>c.manifestValidated&&c.verificationRecorded&&c.filesPreserved&&c.failed===0&&c.passed>0));
});
test('README navigation names actual entrypoints and distinguishes native tests, partial packages and disabled integrations',()=>{
 const root=path.resolve(__dirname,'../..'),text=fs.readFileSync(path.join(root,'README.md'),'utf8');
 for(const term of ['KIT-FIRST','scripts/devkit.js','kit:packages','test:kit','docs/integrations/agents.md','docs/continuity/README.md','docs/monetization/README.md','docs/integrations/omnichannel.md','docs/architecture/README.md','docs/security/README.md','docs/tutorials/tienda-saas.md'])assert.ok(text.includes(term),term);
 for(const match of text.matchAll(/\]\((docs\/[a-zA-Z0-9_./-]+\.md)(?:#[^)]*)?\)/g))assert.ok(fs.existsSync(path.join(root,match[1])),match[1]);
 assert.ok(/parcial/i.test(text));assert.ok(/deshabilitad/i.test(text));
});
