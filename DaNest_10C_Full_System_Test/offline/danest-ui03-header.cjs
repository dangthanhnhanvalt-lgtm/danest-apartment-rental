const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/components/layout/header.tsx'),'utf8');
const nav = source.match(/const NAV_LINKS = \[[\s\S]*?\] as const;/)[0];
const logic = source.match(/  const isLandlord = [\s\S]*?  const navLinks = NAV_LINKS;/)[0];
const js = ts.transpileModule(`${nav}\n${logic}\nreturn {isLandlord,isRenter,hasAccountMenu,paths:navLinks.map(x=>x.to)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const compute = new Function('session',js);
let n=0;
for (const role of [undefined,'tenant','landlord','admin']) {
 const a=compute(role?{user:{role}}:undefined);
 assert.equal(a.isLandlord,role==='landlord'); n++;
 assert.equal(a.isRenter,role==='tenant'); n++;
 assert.equal(a.hasAccountMenu,role==='tenant'||role==='landlord'); n++;
 assert.deepEqual(a.paths,['/search','/#how-it-works','/about']); n++;
}
const left=source.slice(source.indexOf('data-header-group="left"'),source.indexOf('data-header-group="right"'));
const right=source.slice(source.indexOf('data-header-group="right"'),source.indexOf('{mobileOpen ? (\n        <div'));
const checks=[
 ()=>assert.match(left,/<Logo /),
 ()=>assert.match(left,/justify-start/),
 ()=>assert.match(left,/aria-controls="mobile-nav"/),
 ()=>assert.ok(!left.includes('justify-center gap-1 xl:flex')),
 ()=>assert.match(right,/ml-auto flex shrink-0/),
 ()=>assert.match(right,/\{!isLandlord && <Link\s+to="\/saved"/),
 ()=>assert.match(right,/\{session && <Link to="\/notifications"/),
 ()=>assert.match(right,/\{isLandlord && <Button[^\n]+navigate\("\/landlord\/listings\/new"\)/),
 ()=>assert.equal((source.match(/navigate\("\/landlord\/listings\/new"\)/g)||[]).length,1),
 ()=>assert.match(right,/<Plus className="size-5 sm:hidden"/),
 ()=>assert.match(right,/<span className="hidden sm:inline">\{pick\("List property", "Đăng tin"\)\}<\/span>/),
 ()=>assert.match(right,/aria-label=\{pick\("List property", "Đăng tin"\)\}/),
 ()=>assert.match(right,/to="\/login"/),
 ()=>assert.equal((source.match(/navLinks\.map\(/g)||[]).length,2),
 ()=>assert.match(left,/whitespace-nowrap/),
];
checks.forEach(x=>x());
console.log(`PASS: ${n+checks.length} role and left/right grouping assertions (offline).`);
