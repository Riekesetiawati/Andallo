const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(request,env){
 try{
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/')){const asset=FILES[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});return new Response(Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff'}});}
 const owner=request.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'Silakan masuk melalui ChatGPT.'},401);
 if(!env.BUCKET)return json({error:'Penyimpanan belum tersedia. Coba lagi nanti.'},503);
 if(request.method!=='GET' && request.headers.get('origin')!==url.origin)return json({error:'Permintaan tidak diizinkan.'},403);
 const role=request.headers.get('x-andallo-role')||'customer',email=request.headers.get('x-andallo-email')||'customer@example.invalid';
 if(!['customer','admin','provider'].includes(role)||email.length>200)return json({error:'Peran akun tidak valid.'},400);
 const prefix='owners/'+encodeURIComponent(owner)+'/', key=prefix+'bookings.json';
 const obj=await env.BUCKET.get(key);const bookings=obj?await obj.json():[];
 const canRead=b=>role==='admin'||(role==='customer'&&b.customerEmail===email)||(role==='provider'&&CATALOG.find(p=>p.id===b.providerId)?.email===email);
 const write=async()=>{const result=await env.BUCKET.put(key,JSON.stringify(bookings),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(!result)throw Error('Data berubah di sesi lain. Muat ulang lalu coba lagi.');};
 if(path==='/api/bookings'&&request.method==='GET')return json(bookings.filter(canRead));
 if(path==='/api/bookings'&&request.method==='POST'){
 if(role!=='customer')return json({error:'Hanya pelanggan dapat memesan.'},403);
 const body=await request.json(),p=CATALOG.find(p=>p.id===body.providerId);
 if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)||!Number.isFinite(Date.parse(body.date+'T'+body.time+':00+07:00'))||Date.parse(body.date+'T'+body.time+':00+07:00')<Date.now())return json({error:'Pilih penyedia serta tanggal dan jam yang belum lewat.'},400);
 const b={id:Date.now(),customerEmail:email,providerId:p.id,total:p.price,date:body.date,time:body.time,status:'PENDING',rated:false,chat:[],proof:null};bookings.push(b);await write();return json(b,201);
 }
 const match=path.match(/^\/api\/bookings\/(\d+)(?:\/(proof|chat|rating))?$/);if(!match)return json({error:'Tidak ditemukan.'},404);
 const b=bookings.find(b=>b.id===Number(match[1]));
 // Proof links are owner-scoped so only the signed-in Site owner can review receipts.
 if(!b)return json({error:'Pesanan tidak ditemukan.'},404);
 if(match[2]==='proof'&&request.method==='GET'){if(!b.proof)return json({error:'Bukti belum tersedia.'},404);const file=await env.BUCKET.get(prefix+b.proof.key);if(!file)return json({error:'Bukti tidak ditemukan.'},404);return new Response(file.body,{headers:{'Content-Type':b.proof.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="bukti-pembayaran.'+(b.proof.type==='image/png'?'png':'jpg')+'"'}});}
 if(!canRead(b))return json({error:'Tidak berhak mengakses pesanan.'},403);
 if(match[2]==='proof'&&request.method==='POST'){
 if(role!=='customer'||!['PENDING','AWAITING_PAYMENT'].includes(b.status))return json({error:'Bukti transfer untuk pesanan ini sudah diproses.'},409);
 const type=request.headers.get('content-type');if(!['image/png','image/jpeg'].includes(type))return json({error:'Gunakan JPG atau PNG.'},400);
 if(Number(request.headers.get('content-length'))>5*1024*1024)return json({error:'Ukuran maksimal 5 MB.'},413);
 const reader=request.body?.getReader();if(!reader)return json({error:'Pilih berkas.'},400);let chunks=[],size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();return json({error:'Ukuran maksimal 5 MB.'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const png=bytes.length>24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if((type==='image/png'&&!png)||(type==='image/jpeg'&&!jpg))return json({error:'Isi berkas bukan gambar JPG/PNG yang valid.'},400);
 const proofKey='proofs/'+b.id+'/'+crypto.randomUUID();await env.BUCKET.put(prefix+proofKey,bytes,{httpMetadata:{contentType:type}});const old=b.proof;b.proof={key:proofKey,type,size,uploadedAt:new Date().toISOString()};b.status='PAYMENT_REVIEW';b.rejection=null;try{await write();}catch(e){await env.BUCKET.delete(prefix+proofKey);throw e;}if(old)await env.BUCKET.delete(prefix+old.key);return json(b);
 }
 if(match[2]==='chat'&&request.method==='POST'){const body=await request.json();if(typeof body.text!=='string'||!body.text.trim()||body.text.length>2000)return json({error:'Pesan wajib diisi, maksimal 2000 karakter.'},400);b.chat.push({sender:role==='customer'?'customer':'provider',text:body.text.trim(),time:new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})});if(role==='customer'){const q=body.text.toLowerCase();const reply=q.includes('proses')?'Layanan diproses setelah mitra menerima pembayaran.':q.includes('hubungi')?'Penyedia akan menghubungimu melalui ruang chat pesanan.':q.includes('bayar')?'Status pembayaran dapat dipantau dari halaman Pesanan Saya.':'Pesanmu sudah diteruskan. Silakan pantau status pesanan di dashboard.';b.chat.push({sender:'provider',text:reply,time:new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})});}await write();return json(b);}
 if(match[2]==='rating'&&request.method==='POST'){const body=await request.json();if(role!=='customer'||b.status!=='SELESAI'||b.rated||!Number.isInteger(body.stars)||body.stars<1||body.stars>5)return json({error:'Ulasan belum tersedia.'},409);b.rated=true;b.review={stars:body.stars,text:String(body.text||'').slice(0,2000)};await write();return json(b);}
 if(!match[2]&&request.method==='PATCH'){
 const body=await request.json();const allowed={PENDING:['CANCELLED'],AWAITING_PAYMENT:['CANCELLED'],PAYMENT_REVIEW:['DITERIMA','AWAITING_PAYMENT'],DITERIMA:['ON_PROGRESS'],DIMULAI:['ON_PROGRESS'],ON_PROGRESS:['SELESAI']};
 if(role==='customer'||!allowed[b.status]?.includes(body.status))return json({error:'Perubahan status tidak diizinkan. Ikuti urutan pembayaran.'},409);
 if(b.status==='PAYMENT_REVIEW'&&!b.proof)return json({error:'Bukti pembayaran belum tersedia.'},409);
 if(b.status==='PAYMENT_REVIEW'&&body.status==='AWAITING_PAYMENT'){if(typeof body.rejection!=='string'||!body.rejection.trim()||body.rejection.length>500)return json({error:'Isi alasan penolakan, maksimal 500 karakter.'},400);b.rejection=body.rejection.trim();}
 b.status=body.status;await write();return json(b);
 }
 return json({error:'Metode tidak tersedia.'},405);
 }catch(e){console.error('Andallo API:',e.message);return json({error:e.message?.startsWith('Data berubah')?e.message:'Gagal menyimpan. Coba lagi; masukanmu belum dihapus.'},503);}
}};
