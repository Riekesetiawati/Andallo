import test from 'node:test';import assert from 'node:assert/strict';import worker from './dist/server/index.js';import fs from 'node:fs';import vm from 'node:vm';
class Bucket{data=new Map();async get(k){const v=this.data.get(k);return v?{etag:v.etag,json:async()=>JSON.parse(v.data),body:v.data}:null;}async put(k,data,opts={}){const old=this.data.get(k);if(opts.onlyIf?.etagMatches&&old?.etag!==opts.onlyIf.etagMatches)return null;if(opts.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=crypto.randomUUID();this.data.set(k,{data,etag});return {etag};}async delete(k){this.data.delete(k);}}
const env={BUCKET:new Bucket()};
async function call(path,method='GET',body,role='customer',extra={}){return worker.fetch(new Request('https://andallo.test/api/'+path,{method,headers:{'oai-authenticated-user-id':'test-owner',origin:'https://andallo.test','X-Demo-Role':role,'X-Demo-Email':role==='provider'?'barber@andallo.com':role==='admin'?'admin@andallo.com':'rieke@andallo.com','Content-Type':'application/json',...extra},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)}),env);}
test('manual payment workflow, durable reads, rejection, access and upload limits',async()=>{
 let r=await call('bookings','POST',{providerId:1,date:'2027-12-31',time:'10:00'});assert.equal(r.status,201);const b=await r.json(),path='bookings/'+b.id;
 assert.equal((await call(path,'PATCH',{status:'DIMULAI'},'admin')).status,409);
 const bytes=new Uint8Array(fs.readFileSync('assets/service-hero.png'));
 assert.equal((await call(path+'/proof','POST',bytes,'customer',{'Content-Type':'image/png'})).status,409);
 assert.equal((await call(path,'PATCH',{status:'AWAITING_PAYMENT'},'provider')).status,200);
 assert.equal((await call(path+'/proof','POST',new Uint8Array([1,2,3]),'customer',{'Content-Type':'image/png'})).status,400);
 assert.equal((await call(path+'/proof','POST',bytes,'customer',{'Content-Type':'image/png'})).status,200);
 assert.equal((await call(path,'PATCH',{status:'DIMULAI'},'provider')).status,409);
 assert.equal((await call(path,'PATCH',{status:'AWAITING_PAYMENT',rejection:'Gambar kurang jelas'},'admin')).status,200);
 assert.equal((await call(path+'/proof','POST',bytes,'customer',{'Content-Type':'image/png'})).status,200);
 assert.equal((await call(path+'/proof')).status,200);
 assert.equal((await call(path,'PATCH',{status:'DIMULAI'},'admin')).status,200);
 assert.equal((await call(path,'PATCH',{status:'ON_PROGRESS'},'customer')).status,409);
 assert.equal((await call(path,'PATCH',{status:'ON_PROGRESS'},'provider')).status,200);
 assert.equal((await call(path,'PATCH',{status:'SELESAI'},'provider')).status,200);
 assert.equal((await call(path+'/rating','POST',{stars:5,name:'Rieke',text:'Pelayanan bagus'})).status,200);
 assert.equal((await call(path+'/rating','POST',{stars:1,name:'Rieke',text:'Duplikat'})).status,409);
 const reviews=await (await call('reviews')).json();assert.deepEqual(reviews,[{bookingId:b.id,providerId:1,name:'Rieke',rating:5,comment:'Pelayanan bagus'}]);
 assert.deepEqual(await (await call('reviews', 'GET', undefined, 'provider')).json(), reviews);
 const rows=await (await call('bookings')).json();assert.equal(rows[0].status,'SELESAI');assert.ok(rows[0].proof);
 assert.equal((await worker.fetch(new Request('https://andallo.test/api/bookings'),env)).status,401);
 assert.equal((await call(path+'/proof','GET',undefined,'customer',{'oai-authenticated-user-id':'other-owner'})).status,404);
 assert.equal((await call('bookings','POST',{providerId:1,date:'2020-01-01',time:'10:00'})).status,400);
});
test('client script syntax and local asset references',()=>{const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);new vm.Script(fs.readFileSync('payments.js','utf8'));for(const m of html.matchAll(/(?:src|href)="\/(?!api)([^"]+)"/g))assert.ok(fs.existsSync(m[1]),m[1]);});

import {readFileSync} from "node:fs";
import {test as interfaceTest} from "node:test";
interfaceTest("brand, discovery, and requested controls",()=>{const html=readFileSync("index.html","utf8"),js=readFileSync("payments.js","utf8");assert.match(html,/assets\/andallo-logo\.png/);assert.match(html,/id="heroSearchInput"/);assert.match(html,/id="heroCityInput"/);assert.doesNotMatch(html,/class="nav-search/);assert.doesNotMatch(html+js,/(MVP privat|Private MVP|id="filterRadius"|quickRadius|Harga Anda)/);assert.doesNotMatch(js,/function heroSearch/);});
