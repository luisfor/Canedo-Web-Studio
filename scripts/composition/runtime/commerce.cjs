'use strict';
const {randomUUID}=require('node:crypto');
const {memo,fail}=require('./db.cjs');
function commerce(db,{emitSales=true}={}){
 const product=(tenant,id)=>{const p=db.prepare('SELECT id,name,price_cents AS priceCents,stock FROM product WHERE tenant_id=? AND id=?').get(tenant,id);if(!p)fail(404,'Product not found');return {...p};};
 const movement=(tenant,id,quantity,reason)=>db.prepare('INSERT INTO stock_movement VALUES(?,?,?,?,?)').run(tenant,randomUUID(),id,quantity,reason);
 function handle(tenant,key,operation,input){
  if(operation==='listProducts')return db.prepare('SELECT id,name,price_cents AS priceCents,stock FROM product WHERE tenant_id=? ORDER BY id LIMIT 1000').all(tenant);
  if(operation==='listSales')return db.prepare('SELECT id,product_id AS productId,quantity,contact_id AS contactId,total_cents AS totalCents FROM sale WHERE tenant_id=? ORDER BY id LIMIT 1000').all(tenant);
  if(operation==='cashLedger')return db.prepare('SELECT id,sale_id AS saleId,amount_cents AS amountCents FROM cash_entry WHERE tenant_id=? ORDER BY id LIMIT 1000').all(tenant);
  return memo(db,tenant,key,operation,input,()=>{
   if(operation==='createProduct'){db.prepare('INSERT INTO product VALUES(?,?,?,?,?)').run(tenant,input.id,input.name,input.priceCents,input.stock);movement(tenant,input.id,input.stock,'initial');return product(tenant,input.id);}
   if(operation==='receiveStock'){product(tenant,input.productId);db.prepare('UPDATE product SET stock=stock+? WHERE tenant_id=? AND id=?').run(input.quantity,tenant,input.productId);movement(tenant,input.productId,input.quantity,'receipt');return product(tenant,input.productId);}
   if(operation==='createSupplier'){db.prepare('INSERT INTO supplier VALUES(?,?,?)').run(tenant,input.id,input.name);return input;}
   if(operation==='receivePurchase'){
    product(tenant,input.productId);if(!db.prepare('SELECT id FROM supplier WHERE tenant_id=? AND id=?').get(tenant,input.supplierId))fail(404,'Supplier not found');
    const id=randomUUID();db.prepare('INSERT INTO purchase VALUES(?,?,?,?,?,?)').run(tenant,id,input.productId,input.supplierId,input.quantity,input.totalCents);
    db.prepare('UPDATE product SET stock=stock+? WHERE tenant_id=? AND id=?').run(input.quantity,tenant,input.productId);movement(tenant,input.productId,input.quantity,'purchase');return {id};
   }
   if(operation==='createSale'){
    const p=product(tenant,input.productId),totalCents=p.priceCents*input.quantity;
    if(!Number.isSafeInteger(totalCents)||totalCents>1000000000000000)fail(400,'Sale total exceeds supported range');
    const change=db.prepare('UPDATE product SET stock=stock-? WHERE tenant_id=? AND id=? AND stock>=?').run(input.quantity,tenant,p.id,input.quantity);
    if(change.changes!==1)fail(409,'Insufficient stock');
    const sale={id:randomUUID(),...input,totalCents};
    db.prepare('INSERT INTO sale VALUES(?,?,?,?,?,?)').run(tenant,sale.id,p.id,input.quantity,input.contactId,totalCents);
    db.prepare('INSERT INTO cash_entry VALUES(?,?,?,?)').run(tenant,randomUUID(),sale.id,totalCents);movement(tenant,p.id,-input.quantity,'sale');
    if(emitSales){const event={id:randomUUID(),version:1,type:'sale.confirmed.v1',tenantId:tenant,sale};db.prepare('INSERT INTO outbox(tenant_id,id,payload) VALUES(?,?,?)').run(tenant,event.id,JSON.stringify(event));}
    return sale;
   }
   fail(404,'Unknown commerce operation');
  });
 }
 async function flush(deliver,{now=Date.now(),maxAttempts=5}={}){
  const rows=db.prepare('SELECT * FROM outbox WHERE delivered=0 AND attempts<? AND next_at<=? ORDER BY rowid LIMIT 100').all(maxAttempts,now),result={delivered:0,failed:0};
  for(const row of rows){try{const ack=await deliver(JSON.parse(row.payload));if(ack?.accepted!==true)throw Error('Missing durable acknowledgement');db.prepare('UPDATE outbox SET delivered=1 WHERE tenant_id=? AND id=?').run(row.tenant_id,row.id);result.delivered++;}catch{db.prepare('UPDATE outbox SET attempts=attempts+1,next_at=? WHERE tenant_id=? AND id=?').run(now+Math.min(60000,1000*2**row.attempts),row.tenant_id,row.id);result.failed++;}}
  return result;
 }
 return {handle,flush};
}
module.exports={commerce};
