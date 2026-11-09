'use strict';
const Ajv=require('ajv');
module.exports=new Ajv({allErrors:true,strict:true}).compile(require('../../schemas/command-plan.schema.json'));
