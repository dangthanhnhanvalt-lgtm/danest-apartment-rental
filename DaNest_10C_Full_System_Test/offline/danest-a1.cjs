// Offline regression tests for cost and search logic; uses the existing TypeScript dev dependency.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(file){const src=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,require);return m.exports;}
const {summarizeCosts,summarizeStay,rentalMonthOptions}=load('src/lib/format.ts');
const {searchResults}=load('src/lib/search-results.ts');
const fee=(amount,state='fixed',cadence='monthly')=>({amount,state,cadence});
const listing=(items,months=[1,12],deposit=500)=>({costs:{monthlyRent:500,depositAmount:deposit,items},rentalDurationMonths:months});
const cases=[
 [listing([]),1,500,1000,500,1000,0],
 [listing([fee(30,'reported'),fee(8),fee(10),fee(15)]),6,563,1063,3378,3878,0],
 [listing([fee(null,'unknown'),fee(99,'unknown'),fee(20,'fixed','one-time')]),3,500,1020,1520,2020,2],
 [listing([fee(0),fee(12.5,'variable'),fee(null,'variable')], [3,6],1000),3,512.5,1512.5,1537.5,2537.5,1],
 [listing([fee(25,'reported','one-time'),fee(5.25),fee(null,'unknown','one-time')]),12,505.25,1030.25,6088,6588,1],
];
for(const [l,m,monthly,initial,excl,incl,unknown] of cases){const s=summarizeCosts(l),t=summarizeStay(l,m);assert.equal(s.estimatedMonthly,monthly);assert.equal(t.initialPayment,initial);assert.equal(t.withoutDeposit,excl);assert.equal(t.withDeposit,incl);assert.equal(t.unknownCount,unknown);}
assert.deepEqual(rentalMonthOptions(listing([],[3,6])),[3,4,5,6]);assert.equal(summarizeStay(listing([],[3,6]),1),null);
const f={minRent:'',maxRent:'',minArea:'',maxArea:'',duration:'',neighborhoods:[],bedrooms:null,bathrooms:null,types:[],furnishing:'',amenities:[],verifiedOnly:false,availability:'',checkIn:'',sort:'recommended',view:'grid'};
const row=(id,floorArea,monthlyRent,updatedAt,extra={})=>({id,floorArea,monthlyRent,updatedAt,status:'published',availability:'available',availableFrom:'2026-12-01',rentalDurationMonths:[1,12],verification:{checks:[]},...extra});
const rows=[row('a',35,400,'2026-11-25'),row('b',55,600,'2026-11-20'),row('c',75,800,'2026-11-26',{availableFrom:'2026-12-15'}),row('d',50,500,'2026-11-24',{status:'draft'}),row('e',50,450,undefined,{availability:'reserved'})];
const ids=(over={})=>searchResults(rows,{...f,...over}).map(x=>x.id);
assert.deepEqual(ids({minArea:'40',maxArea:'60'}),['b','e']);assert.deepEqual(ids({minArea:'40',maxRent:'500'}),['e']);assert.deepEqual(ids({checkIn:'2026-12-10'}),['a','b']);assert.deepEqual(ids({sort:'updated-desc'}),['c','a','b','e']);assert.deepEqual(ids({sort:'updated-asc'}),['b','a','c','e']);assert.deepEqual(ids({sort:'price-asc'}),['a','e','b','c']);assert.deepEqual(ids({sort:'price-desc'}),['c','b','e','a']);assert.deepEqual(ids({minArea:'40',maxArea:'60',view:'map'}),ids({minArea:'40',maxArea:'60'}));assert.deepEqual(ids({minArea:'100',maxArea:'50'}),[]);assert.deepEqual(ids(),['a','b','c','e']);
console.log('PASS: 5 cost fixtures, 2 duration assertions, 10 search assertions');
