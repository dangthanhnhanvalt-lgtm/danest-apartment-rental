// Offline regression: no network, auth or database calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file){const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,name=>name==='~/lib/format'?load('src/lib/format.ts'):require(name));return m.exports;}
const {matchPublicListings:match,emptyMatchPreferences:empty,validMatchBudget:budget,validMatchDate:date,vietnamToday,distanceMeters:distance}=load('src/lib/match-listings.ts');
const row=(id,over={})=>({id,status:'published',availability:'available',availableFrom:'2026-12-01',neighborhood:'my-an',rentalDurationMonths:[1,12],bedrooms:2,furnishing:'furnished',monthlyRent:500,costs:{monthlyRent:500,depositAmount:500,items:[]},amenities:['wifi','workspace','pool'],distanceToBeach:'550 m to beach',verificationBadge:false,...over});
const prefs={...empty(),budget:600,neighborhood:'my-an',duration:6,moveIn:'2026-12-05',bedrooms:2,furnishing:'furnished',lifestyle:['remote','beach'],amenities:['wifi','pool']};
const ids=(rows,p=prefs)=>match(rows,p).map(x=>x.listing.id);
let count=0;const eq=(actual,expected)=>{assert.deepEqual(actual,expected);count++;};
eq(ids([row('ok')]),['ok']);
for(const over of [{status:'hidden'},{status:'draft'},{availability:'reserved'},{availability:'unavailable'},{availableFrom:'2026-12-06'},{availableFrom:''},{availableFrom:'2026-02-30'},{availableFrom:undefined},{rentalDurationMonths:[7,12]},{bedrooms:1},{neighborhood:'son-tra'},{furnishing:'unfurnished'},{amenities:['wifi']},{costs:{monthlyRent:500,items:[{amount:150,state:'fixed',cadence:'monthly',unit:'per month'}]}}])eq(ids([row('no',over)]),[]);
eq(ids([row('larger',{bedrooms:3})]),['larger']);
eq(ids([row('paid',{sponsored:true,amenities:['wifi','pool'],distanceToBeach:'2 km'}),row('organic')]),['organic','paid']);
eq(ids([row('paid',{sponsored:true}),row('verified',{verificationBadge:true})]),['verified','paid']);
const unknown=row('unknown',{costs:{monthlyRent:500,items:[{amount:0.2,state:'reported',cadence:'monthly',unit:'per kWh'}]}});
eq(match([unknown],prefs)[0].unknownMonthly,1);eq(match([unknown],prefs)[0].costs.estimatedMonthly,500);
eq(ids([row('a'),row('b'),row('c'),row('d'),row('e')]),['a','b','c','d']);
eq(ids([row('different',{neighborhood:'son-tra'})],empty()),['different']);
eq([budget(''),budget('0'),budget('-1'),budget('Infinity'),budget('600')],[false,false,false,false,true]);
eq([date('2026-12-05','2026-12-05'),date('2026-12-04','2026-12-05'),date('2026-02-30','2026-01-01')],[true,false,false]);
eq(vietnamToday(new Date('2026-11-27T18:00:00Z')),'2026-11-28');
eq([distance('0.8 km'),distance('550 m to beach'),distance('1,000 m'),distance('10 minutes'),distance('1.2 km')],[800,550,null,null,1200]);
const {en}=load('src/i18n/en.ts'),{vi}=load('src/i18n/vi.ts');
const aiKeys=Object.keys(en).filter(k=>k.startsWith('ai.')).sort();eq(aiKeys,Object.keys(vi).filter(k=>k.startsWith('ai.')).sort());
for(const key of aiKeys){assert.ok(en[key]&&vi[key],key);assert.deepEqual((en[key].match(/\{\w+\}/g)||[]).sort(),(vi[key].match(/\{\w+\}/g)||[]).sort(),key);}
const assistant=fs.readFileSync(path.join(root,'src/components/match/assistant.tsx'),'utf8');
eq(assistant.includes('getSupabaseListings()'),true);eq(/getMySupabaseListings|useAppState|parsePrompt|sendFreeText/.test(assistant),false);eq((assistant.match(/t\("ai.start"\)/g)||[]).length,1);
for(const [,key] of assistant.matchAll(/t\("(ai\.[^"]+)"/g))assert.ok(en[key]&&vi[key],key);
console.log(`PASS: ${count} F1 assertions; ${aiKeys.length} AI translation keys and placeholders verified (offline).`);
