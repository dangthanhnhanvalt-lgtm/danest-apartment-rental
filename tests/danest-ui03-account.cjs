const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/components/layout/header.tsx'),'utf8');
const layout=fs.readFileSync(path.join(__dirname,'../src/pages/landlord/layout.tsx'),'utf8');
const branch=source.slice(source.indexOf('{session && hasAccountMenu ? ('),source.indexOf(') : session ? ('));
const landlord=source.match(/const LANDLORD_LINKS = \[[\s\S]*?\] as const;/)[0];
const routes=Array.from(landlord.matchAll(/to: "([^"]+)"/g),m=>m[1]);
const checks=[
 ()=>assert.match(branch,/ref=\{accountButtonRef\}/),
 ()=>assert.ok(!branch.includes("ChevronDown")),
 ()=>assert.match(branch,/onClick=\{\(\) => \{ setLangOpen\(false\); setMobileOpen\(false\); setAccountOpen\(v => !v\); \}\}/),
 ()=>assert.match(branch,/size-10 shrink-0 cursor-pointer/),
 ()=>assert.match(branch,/\{session.user.avatarInitials\}/),
 ()=>assert.match(branch,/aria-expanded=\{accountOpen\}/),
 ()=>assert.match(branch,/id="account-panel"/),
 ()=>assert.match(branch,/\{isRenter && <>[\s\S]*?to="\/requests"[\s\S]*?to="\/profile"[\s\S]*?<\/>\}/),
 ()=>assert.match(branch,/\{isLandlord && LANDLORD_LINKS\.map/),
 ()=>assert.deepEqual(routes,['/landlord','/landlord/listings','/landlord/requests','/landlord/viewings','/landlord/featured','/landlord/settings']),
 ...routes.map(route=>()=>assert.ok(layout.includes(`to: "${route}"`))),
 ()=>assert.match(branch,/void logout\(\)/),
 ()=>assert.match(branch,/counts.messages > 99 \? "99\+" : counts.messages/),
 ()=>assert.match(branch,/to === "\/landlord\/requests" && counts.messages > 0/),
 ()=>assert.equal((source.match(/to="\/requests"/g)||[]).length,1),
 ()=>assert.equal((source.match(/to="\/profile"/g)||[]).length,1),
 ()=>assert.ok(!branch.includes('xl:hidden')&&!branch.includes('xl:flex')),
 ()=>assert.match(source,/document.addEventListener\("pointerdown", onPointerDown\)/),
 ()=>assert.match(source,/event.key === "Escape"/),
 ()=>assert.match(source,/accountButtonRef.current\?\.focus\(\)/),
 ()=>assert.match(source,/document.removeEventListener\("keydown", onKeyDown\)/),
 ()=>assert.match(branch,/setLangOpen\(false\); setMobileOpen\(false\); setAccountOpen/),
];
checks.forEach(x=>x());
console.log(`PASS: ${checks.length} account menu, route and disclosure assertions (offline).`);
