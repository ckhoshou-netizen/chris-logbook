import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app/sw.js',import.meta.url),'utf8');
function setup(response){const handlers={},writes=[],saved=new Response('cached app',{headers:{'content-type':'text/javascript'}});const context={URL,Response,Request,Set,self:{location:{href:'https://example.test/sw.js',origin:'https://example.test'},clients:{claim(){}},addEventListener:(name,handler)=>handlers[name]=handler},caches:{match:async()=>saved,open:async()=>({put:async(...args)=>writes.push(args),addAll:async()=>{}})},fetch:async()=>{if(response instanceof Error)throw response;return response;}};vm.runInNewContext(source,context);return{handlers,writes};}
test('private authentication URLs and query state never enter the app cache',()=>{const {handlers}=setup(new Response(''));for(const path of ['/callback?code=secret','/signin-with-chatgpt','/signout-with-chatgpt','/?state=secret']){let handled=false;handlers.fetch({request:{url:'https://example.test'+path,method:'GET'},respondWith:()=>{handled=true;}});assert.equal(handled,false,path);}});
test('HTML sign-in response cannot replace cached JavaScript',async()=>{const {handlers,writes}=setup(new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}}));let result;handlers.fetch({request:{url:'https://example.test/main.mjs',method:'GET'},respondWith:r=>result=r});assert.equal(await(await result).text(),'cached app');assert.equal(writes.length,0);});
test('offline cached script remains usable',async()=>{const {handlers}=setup(new Error('offline'));let result;handlers.fetch({request:{url:'https://example.test/main.mjs',method:'GET'},respondWith:r=>result=r});assert.equal(await(await result).text(),'cached app');});

test('a new worker revalidates every install asset so fresh HTTP caches cannot install old screens',async()=>{
 const handlers={},requests=[];let completion;
 vm.runInNewContext(source,{URL,Request,Set,self:{location:{href:'https://example.test/chris-logbook/sw.js'},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>({addAll:async files=>requests.push(...files)})}});
 handlers.install({waitUntil:promise=>completion=promise});await completion;
 assert.equal(requests.length,14);for(const request of requests){assert.equal(request.cache,'reload');assert.ok(request.url.startsWith('https://example.test/chris-logbook/'));}
});

test('HTML errors never replace a cached Canadian food catalogue',async()=>{const {handlers,writes}=setup(new Response('<html>Error</html>',{headers:{'content-type':'text/html'}}));let result;handlers.fetch({request:{url:'https://example.test/data/cnf-2015.json',method:'GET'},respondWith:r=>result=r});assert.equal(await(await result).text(),'cached app');assert.equal(writes.length,0);});
