// Offline fee math regression. No database calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/format.ts'),'utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,require);
const {summarizeCosts,summarizeStay,estimateUsage}=m.exports;
const fee=(id,amount,unit,state='fixed',cadence='monthly')=>({id,label:id,amount,unit,state,cadence});
const l={costs:{monthlyRent:500,depositAmount:500,items:[fee('electric',0.20,'per kWh','variable'),fee('water',1,'per m³','variable'),fee('internet',10,'per month'),fee('cleaning',20,'per stay','fixed','one-time'),fee('unknown',null,'per month','unknown')]},rentalDurationMonths:[1,12]};
assert.equal(summarizeCosts(l).estimatedMonthly,510);assert.equal(summarizeCosts(l).unknownItems.length,3);assert.equal(summarizeStay(l,3).withDeposit,2050);
const q=estimateUsage(l,{electric:'100',water:'5'});assert.equal(summarizeCosts(q).estimatedMonthly,535);assert.equal(summarizeCosts(q).unknownItems.length,1);assert.equal(summarizeStay(q,3).withDeposit,2125);assert.equal(summarizeStay(q,3).initialPayment,1055);
assert.equal(summarizeCosts(estimateUsage(l,{electric:'0',water:'0'})).unknownItems.length,1);assert.equal(summarizeCosts(estimateUsage(l,{electric:'',water:'-2'})).unknownItems.length,3);assert.equal(summarizeCosts(estimateUsage(l,{electric:'Infinity',water:'1000001'})).unknownItems.length,3);assert.equal(l.costs.items[0].amount,.2);
console.log('PASS: 11 B1 usage/fee assertions (offline)');
