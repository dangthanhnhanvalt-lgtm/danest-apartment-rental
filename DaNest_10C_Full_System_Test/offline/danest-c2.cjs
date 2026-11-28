const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/inquiry-notices.ts'),'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,require);
const {isMessageNotice,loadedMessageNoticeIds,parseVietnamViewingTime}=m.exports;
const make=(id,type,payload={},message_read_at=null)=>({id,type,payload,message_read_at});
const ns=[make('initial','inquiry-created'),make('other','inquiry-replied',{event:'message',message_id:'a'}),make('own','inquiry-replied',{event:'message',message_id:'b'}),make('missing','inquiry-replied',{event:'message',message_id:'c'}),make('read','inquiry-replied',{event:'message',message_id:'a'},'done'),make('reminder','inquiry-viewing-scheduled',{event:'viewing-reminder'})];
assert.equal(isMessageNotice(ns[0]),true);assert.equal(isMessageNotice(ns[5]),false);assert.deepEqual(loadedMessageNoticeIds(ns,[{id:'a',sender_id:'other'},{id:'b',sender_id:'self'}],'self'),['initial','other']);assert.deepEqual(loadedMessageNoticeIds(ns,[],'self'),[]);
assert.equal(parseVietnamViewingTime('2026-12-01T10:30').toISOString(),'2026-12-01T03:30:00.000Z');assert.equal(parseVietnamViewingTime('2026-02-30T10:30'),null);assert.equal(parseVietnamViewingTime(''),null);assert.equal(parseVietnamViewingTime('2026-12-01T25:00'),null);
console.log('PASS: 8 C2 unread/time assertions (offline)');
