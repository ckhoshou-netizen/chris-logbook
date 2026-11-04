import {VERSION,emptyStore,validate,clone,migrateStore} from './domain.mjs';
const DB='chris-logbook',STORE='records';
let connection;
export async function openStore(){
 if(connection)return connection;
 connection=await new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,VERSION);
  let migrationError;
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains(STORE)){request.result.createObjectStore(STORE);return;}
   const store=request.transaction.objectStore(STORE),r=store.get('state');
   r.onsuccess=()=>{try{if(r.result)store.put(migrateStore(r.result),'state');}catch(error){migrationError=error;request.transaction.abort();}};
  };
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();location.reload();};resolve(request.result);};
  request.onerror=()=>reject(migrationError??new Error('Device storage could not open. No records were saved.'));
  request.onblocked=()=>reject(new Error('Close other Logbook tabs and reopen to finish updating storage.'));
 });return connection;
}
export async function readStore(){const db=await openStore();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),r=store.get('state');let result,error;r.onsuccess=()=>{try{result=migrateStore(r.result??emptyStore());if(r.result&&r.result.schemaVersion!==result.schemaVersion)store.put(result,'state');}catch(e){error=e;tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(error??tx.error??new Error('Device storage could not be read.'));});}
export async function updateStore(mutate){
 const db=await openStore();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),r=store.get('state');let next,error;
  r.onsuccess=()=>{try{const current=migrateStore(r.result??emptyStore());const draft=clone(current);const result=mutate(draft);next=result&&typeof result==='object'?result:draft;next.revision=current.revision+1;validate(next);store.put(next,'state');}catch(e){error=e;tx.abort();}};
  tx.oncomplete=()=>{resolve(next);const channel=new BroadcastChannel('chris-logbook');channel.postMessage('changed');channel.close();};
  tx.onabort=tx.onerror=()=>reject(error??tx.error??new Error('Storage write failed. Your previous records remain unchanged.'));
 });
}
