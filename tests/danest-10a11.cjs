// Offline checks: dynamic catalog IDs survive URL round-trip; source wiring and guards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function load(f){const js=ts.transpileModule(read(f),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module','require',js)(m.exports,m,n=>n==='~/data/constants'?load('src/data/constants.ts'):require(n));return m.exports;}
const {parseFilters,toQuery}=load('src/components/search/filter-config.ts');
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++};
const query=new URLSearchParams('neighborhood=hai-chau,my-an,unknown&amenities=bathtub,wifi,unknown');
const f=parseFilters(query,['hai-chau','my-an'],['bathtub','wifi']);eq(f.neighborhoods,['hai-chau','my-an']);eq(f.amenities,['bathtub','wifi']);
eq(parseFilters(query).neighborhoods,['my-an']);eq(parseFilters(query).amenities,['wifi']);eq(toQuery(f).neighborhood,'hai-chau,my-an');eq(toQuery(f).amenities,'bathtub,wifi');
const migration=read('supabase/migrations/DaNest_10A11_Listing_Configuration.sql');
for(const name of ['danest_confirm_material_edit_10a11','danest_catalog_guard_10a11','danest_duplicate_candidates_internal_10a11','danest_save_required_10a11','danest_register_image_hash_10a11'])eq(migration.includes(name),true);
eq(read('src/pages/search.tsx').includes('areas.map(a=>a.id),amenities.map(a=>a.id)'),true);
eq(read('src/components/match/assistant.tsx').includes('labels.amenities.map'),true);
eq(read('src/pages/landlord/property-form.tsx').includes('catalog.required.includes("floorLevel")'),true);
eq(read('src/api/supabase-listings.ts').includes('crypto.subtle.digest("SHA-256"'),true);
eq(read('src/pages/admin/listings.tsx').includes('onOpen={setSelectedId}'),true);
console.log(`PASS: ${n} G1 URL and static integration assertions (offline).`);
